import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  generateTokenHash,
  generateJWT,
  validatePasswordStrength,
  validateEmail,
  validateUsername,
} from '../lib/crypto';
import { authenticate, requireOwner } from '../middleware/auth';
import { loginRateLimit } from '../middleware/rateLimit';
import { createAuditLog, AuditActions } from '../lib/audit';
import { config } from '../config';

const router = Router();

// ---- Validation Schemas ----
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceName: z.string().max(100).optional(),
});

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50),
  invitationToken: z.string().min(1),
  deviceName: z.string().max(100).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// ---- POST /api/auth/setup ----
// First-time setup: create the owner account
router.post('/setup', loginRateLimit, async (req, res: Response): Promise<void> => {
  try {
    // Check if any users exist
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      res.status(400).json({
        success: false,
        error: { code: 'SETUP_COMPLETE', message: 'Initial setup has already been completed' },
      });
      return;
    }

    const schema = z.object({
      username: z.string().min(3).max(30),
      email: z.string().email(),
      password: z.string().min(8).max(128),
      displayName: z.string().min(1).max(50),
      deviceName: z.string().max(100).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
      return;
    }

    const { username, email, password, displayName, deviceName } = parsed.data;

    // Validate
    if (!validateEmail(email)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Invalid email address' },
      });
      return;
    }

    if (!validateUsername(username)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_USERNAME', message: 'Username must be 3-30 characters, alphanumeric with underscores/hyphens' },
      });
      return;
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: passwordValidation.errors[0] },
      });
      return;
    }

    // Check uniqueness
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User with this email or username already exists' },
      });
      return;
    }

    const passwordHash = await hashPassword(password);

    // Create user and default settings in transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          username,
          email,
          displayName,
          passwordHash,
          role: 'owner',
        },
      });

      await tx.userSettings.create({
        data: { userId: user.id },
      });

      return user;
    });

    // Create session
    const sessionToken = generateSessionToken();
    const tokenHash = generateTokenHash(sessionToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.session.maxAgeDays);

    const session = await prisma.session.create({
      data: {
        userId: result.id,
        tokenHash,
        deviceName: deviceName || 'Unknown Device',
        platform: 'unknown',
        expiresAt,
      },
    });

    await createAuditLog({
      userId: result.id,
      action: AuditActions.REGISTER,
      metadata: { role: 'owner' },
      ipAddress: req.ip,
    });

    const jwtToken = generateJWT(
      {
        id: result.id,
        username: result.username,
        email: result.email,
        displayName: result.displayName,
        role: result.role,
      },
      session.id,
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: result.id,
          username: result.username,
          displayName: result.displayName,
          avatarUrl: result.avatarUrl,
          status: result.status,
          isOnline: true,
          lastSeenAt: result.lastSeenAt?.toISOString() || null,
          createdAt: result.createdAt.toISOString(),
        },
        token: jwtToken,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/auth/login ----
router.post('/login', loginRateLimit, async (req, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
      return;
    }

    const { email, password, deviceName } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Use generic error message
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      await createAuditLog({
        userId: user.id,
        action: AuditActions.LOGIN_FAILED,
        metadata: { email },
        ipAddress: req.ip,
      });

      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    // Create session
    const sessionToken = generateSessionToken();
    const tokenHash = generateTokenHash(sessionToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.session.maxAgeDays);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceName: deviceName || 'Unknown Device',
        platform: 'unknown',
        expiresAt,
      },
    });

    // Update user last seen
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    // Enforce max sessions
    const allSessions = await prisma.session.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    if (allSessions.length > config.session.maxSessions) {
      const sessionsToRevoke = allSessions.slice(0, allSessions.length - config.session.maxSessions);
      await prisma.session.updateMany({
        where: { id: { in: sessionsToRevoke.map((s: any) => s.id) } },
        data: { revokedAt: new Date() },
      });
    }

    await createAuditLog({
      userId: user.id,
      action: AuditActions.LOGIN,
      metadata: { deviceName },
      ipAddress: req.ip,
    });

    const jwtToken = generateJWT(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
      session.id,
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          status: user.status,
          isOnline: true,
          lastSeenAt: user.lastSeenAt?.toISOString() || null,
          createdAt: user.createdAt.toISOString(),
        },
        token: jwtToken,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/auth/register ----
router.post('/register', loginRateLimit, async (req, res: Response): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
      return;
    }

    const { username, email, password, displayName, invitationToken, deviceName } = parsed.data;

    // Validate inputs
    if (!validateEmail(email)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Invalid email address' },
      });
      return;
    }

    if (!validateUsername(username)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_USERNAME', message: 'Username must be 3-30 characters, alphanumeric with underscores/hyphens' },
      });
      return;
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: passwordValidation.errors[0] },
      });
      return;
    }

    // Validate invitation
    const tokenHash = generateTokenHash(invitationToken);
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation || invitation.usedAt || new Date() > invitation.expiresAt) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INVITATION', message: 'Invalid or expired invitation' },
      });
      return;
    }

    // Check two-user limit
    const userCount = await prisma.user.count();
    if (userCount >= 2) {
      res.status(400).json({
        success: false,
        error: { code: 'SPACE_FULL', message: 'This communication space is full' },
      });
      return;
    }

    // Check uniqueness
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existingUser) {
      res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'User with this email or username already exists' },
      });
      return;
    }

    const passwordHash = await hashPassword(password);

    // Create user, conversation, mark invitation in transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          username,
          email,
          displayName,
          passwordHash,
          role: 'member',
        },
      });

      await tx.userSettings.create({
        data: { userId: user.id },
      });

      // Mark invitation as used
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          usedAt: new Date(),
          usedBy: user.id,
        },
      });

      // Create conversation between owner and new member
      const owner = await tx.user.findFirst({ where: { role: 'owner' } });
      if (owner) {
        const conversation = await tx.conversation.create({ data: {} });
        await tx.conversationMember.createMany({
          data: [
            { conversationId: conversation.id, userId: owner.id },
            { conversationId: conversation.id, userId: user.id },
          ],
        });
      }

      return user;
    });

    // Create session
    const sessionToken = generateSessionToken();
    const tokenHash2 = generateTokenHash(sessionToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.session.maxAgeDays);

    const session = await prisma.session.create({
      data: {
        userId: result.id,
        tokenHash: tokenHash2,
        deviceName: deviceName || 'Unknown Device',
        platform: 'unknown',
        expiresAt,
      },
    });

    await createAuditLog({
      userId: result.id,
      action: AuditActions.REGISTER,
      metadata: { role: 'member' },
      ipAddress: req.ip,
    });

    const jwtToken = generateJWT(
      {
        id: result.id,
        username: result.username,
        email: result.email,
        displayName: result.displayName,
        role: result.role,
      },
      session.id,
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: result.id,
          username: result.username,
          displayName: result.displayName,
          avatarUrl: result.avatarUrl,
          status: result.status,
          isOnline: true,
          lastSeenAt: result.lastSeenAt?.toISOString() || null,
          createdAt: result.createdAt.toISOString(),
        },
        token: jwtToken,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/auth/change-password ----
router.post('/change-password', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
      return;
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    const validPassword = await verifyPassword(currentPassword, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
      });
      return;
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      res.status(400).json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: passwordValidation.errors[0] },
      });
      return;
    }

    const newPasswordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all other sessions
    await prisma.session.updateMany({
      where: {
        userId: req.user.id,
        id: { not: req.sessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.PASSWORD_CHANGE,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/auth/logout ----
router.post('/logout', authenticate, async (req, res: Response): Promise<void> => {
  try {
    await prisma.session.updateMany({
      where: { userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.LOGOUT,
      metadata: { allDevices: false },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/auth/logout-all ----
router.post('/logout-all', authenticate, async (req, res: Response): Promise<void> => {
  try {
    // Revoke all sessions except current
    await prisma.session.updateMany({
      where: {
        userId: req.user.id,
        id: { not: req.sessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.LOGOUT_ALL,
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { message: 'Logged out from all devices' } });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- GET /api/auth/me ----
router.get('/me', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        avatarUrl: true,
        status: true,
        role: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...user,
        lastSeenAt: user.lastSeenAt?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

export default router;
