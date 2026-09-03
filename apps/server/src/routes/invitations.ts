import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { generateSecureToken, generateTokenHash } from '../lib/crypto';
import { authenticate, requireOwner } from '../middleware/auth';
import { invitationRateLimit } from '../middleware/rateLimit';
import { createAuditLog, AuditActions } from '../lib/audit';
import { config } from '../config';

const router = Router();

// ---- POST /api/invitations ----
// Create a new invitation (owner only)
router.post('/', authenticate, requireOwner, async (req, res: Response): Promise<void> => {
  try {
    // Check if space is already full
    const userCount = await prisma.user.count();
    if (userCount >= 2) {
      res.status(400).json({
        success: false,
        error: { code: 'SPACE_FULL', message: 'This communication space already has two users' },
      });
      return;
    }

    // Check if there's already an active invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        createdBy: req.user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      // Return existing invitation
      res.json({
        success: true,
        data: {
          id: existingInvitation.id,
          token: '(existing)', // Don't expose token again
          expiresAt: existingInvitation.expiresAt.toISOString(),
          createdAt: existingInvitation.createdAt.toISOString(),
          deepLink: `${config.deepLink.scheme}://invite/existing`,
        },
      });
      return;
    }

    // Generate new invitation
    const rawToken = generateSecureToken(32);
    const tokenHash = generateTokenHash(rawToken);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.invitation.expirationHours);

    const invitation = await prisma.invitation.create({
      data: {
        tokenHash,
        createdBy: req.user.id,
        expiresAt,
      },
    });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.INVITATION_CREATE,
      metadata: { invitationId: invitation.id },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: {
        id: invitation.id,
        token: rawToken,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
        deepLink: `${config.deepLink.scheme}://invite/${rawToken}`,
      },
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- GET /api/invitations/validate/:token ----
// Validate an invitation token (rate-limited)
router.get('/validate/:token', invitationRateLimit, async (req, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token || token.length < 10) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid invitation token' },
      });
      return;
    }

    const tokenHash = generateTokenHash(token);
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      res.status(404).json({
        success: false,
        error: { code: 'INVALID_INVITATION', message: 'Invalid or expired invitation' },
      });
      return;
    }

    if (invitation.usedAt) {
      res.status(400).json({
        success: false,
        error: { code: 'INVITATION_USED', message: 'This invitation has already been used' },
      });
      return;
    }

    if (new Date() > invitation.expiresAt) {
      res.status(400).json({
        success: false,
        error: { code: 'INVITATION_EXPIRED', message: 'This invitation has expired' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        valid: true,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Validate invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- DELETE /api/invitations/:id ----
// Revoke an invitation (owner only)
router.delete('/:id', authenticate, requireOwner, async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const invitation = await prisma.invitation.findUnique({ where: { id } });

    if (!invitation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invitation not found' },
      });
      return;
    }

    if (invitation.createdBy !== req.user.id) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
      return;
    }

    await prisma.invitation.delete({ where: { id } });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.INVITATION_REVOKE,
      metadata: { invitationId: id },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { message: 'Invitation revoked' } });
  } catch (error) {
    console.error('Revoke invitation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- GET /api/invitations/status ----
// Check invitation status (owner only)
router.get('/status', authenticate, requireOwner, async (req, res: Response): Promise<void> => {
  try {
    const userCount = await prisma.user.count();
    const spaceFull = userCount >= 2;

    const activeInvitation = await prisma.invitation.findFirst({
      where: {
        createdBy: req.user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    res.json({
      success: true,
      data: {
        spaceFull,
        userCount,
        hasActiveInvitation: !!activeInvitation,
        invitationId: activeInvitation?.id || null,
        expiresAt: activeInvitation?.expiresAt.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Get invitation status error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

export default router;
