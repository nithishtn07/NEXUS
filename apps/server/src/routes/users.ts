import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { uploadFile, generateStorageKey, getSignedDownloadUrl } from '../lib/storage';
import { createAuditLog, AuditActions } from '../lib/audit';
import { config } from '../config';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxSizeBytes,
  },
  fileFilter: (_req, file, cb) => {
    if ((config.upload.allowedMimeTypes as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

// ---- GET /api/users/me ----
router.get('/me', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { settings: true },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    let avatarUrl = user.avatarUrl;
    if (avatarUrl) {
      avatarUrl = await getSignedDownloadUrl(avatarUrl);
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        avatarUrl,
        status: user.status,
        role: user.role,
        lastSeenAt: user.lastSeenAt?.toISOString() || null,
        createdAt: user.createdAt.toISOString(),
        settings: user.settings
          ? {
              pushNotifications: user.settings.pushNotifications,
              messageNotifications: user.settings.messageNotifications,
              soundEnabled: user.settings.soundEnabled,
              vibrationEnabled: user.settings.vibrationEnabled,
              showOnlineStatus: user.settings.showOnlineStatus,
              showLastSeen: user.settings.showLastSeen,
              showReadReceipts: user.settings.showReadReceipts,
              theme: user.settings.theme,
              reducedMotion: user.settings.reducedMotion,
            }
          : null,
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

// ---- PATCH /api/users/me ----
router.patch('/me', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      displayName: z.string().min(1).max(50).optional(),
      status: z.string().max(200).optional(),
      username: z.string().min(3).max(30).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
      return;
    }

    const updates: Record<string, string> = {};
    if (parsed.data.displayName) updates.displayName = parsed.data.displayName;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;

    if (parsed.data.username && parsed.data.username !== req.user.username) {
      const existing = await prisma.user.findUnique({
        where: { username: parsed.data.username },
      });
      if (existing) {
        res.status(409).json({
          success: false,
          error: { code: 'USERNAME_TAKEN', message: 'Username already taken' },
        });
        return;
      }
      updates.username = parsed.data.username;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
    });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.PROFILE_UPDATE,
      metadata: { fields: Object.keys(updates) },
    });

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/users/me/avatar ----
router.post('/me/avatar', authenticate, upload.single('avatar'), async (req, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: 'No file uploaded' },
      });
      return;
    }

    // Validate MIME type from actual file content
    const fileBuffer = req.file.buffer;
    const metadata = await sharp(fileBuffer).metadata();

    if (!metadata.format || !['jpeg', 'png', 'webp', 'gif'].includes(metadata.format)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILE', message: 'Unsupported image format' },
      });
      return;
    }

    // Resize avatar
    const processedBuffer = await sharp(fileBuffer)
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();

    const storageKey = generateStorageKey(req.user.id, 'avatar', 'avatar.jpg');
    await uploadFile(processedBuffer, storageKey, 'image/jpeg');

    // Delete old avatar if exists
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user?.avatarUrl) {
      try {
        const { deleteFile } = require('../lib/storage');
        await deleteFile(user.avatarUrl);
      } catch {
        // Old avatar deletion is best effort
      }
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: storageKey },
    });

    const avatarUrl = await getSignedDownloadUrl(storageKey);

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.AVATAR_UPLOAD,
    });

    res.json({
      success: true,
      data: { avatarUrl },
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_FAILED', message: 'Failed to upload avatar' },
    });
  }
});

// ---- PATCH /api/users/me/settings ----
router.patch('/me/settings', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      pushNotifications: z.boolean().optional(),
      messageNotifications: z.boolean().optional(),
      soundEnabled: z.boolean().optional(),
      vibrationEnabled: z.boolean().optional(),
      showOnlineStatus: z.boolean().optional(),
      showLastSeen: z.boolean().optional(),
      showReadReceipts: z.boolean().optional(),
      theme: z.enum(['dark', 'light', 'system']).optional(),
      reducedMotion: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
      return;
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...parsed.data },
      update: parsed.data,
    });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.SETTINGS_UPDATE,
      metadata: { fields: Object.keys(parsed.data) },
    });

    res.json({
      success: true,
      data: {
        pushNotifications: settings.pushNotifications,
        messageNotifications: settings.messageNotifications,
        soundEnabled: settings.soundEnabled,
        vibrationEnabled: settings.vibrationEnabled,
        showOnlineStatus: settings.showOnlineStatus,
        showLastSeen: settings.showLastSeen,
        showReadReceipts: settings.showReadReceipts,
        theme: settings.theme,
        reducedMotion: settings.reducedMotion,
      },
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- DELETE /api/users/me ----
router.delete('/me', authenticate, async (req, res: Response): Promise<void> => {
  try {
    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.ACCOUNT_DELETE,
      ipAddress: req.ip,
    });

    await prisma.user.delete({ where: { id: req.user.id } });

    res.json({ success: true, data: { message: 'Account deleted' } });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- GET /api/users/partner ----
// Get the other user's info (the partner in the two-user space)
router.get('/partner', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const otherUser = await prisma.user.findFirst({
      where: {
        id: { not: req.user.id },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    if (!otherUser) {
      res.json({
        success: true,
        data: null,
      });
      return;
    }

    let avatarUrl = otherUser.avatarUrl;
    if (avatarUrl) {
      avatarUrl = await getSignedDownloadUrl(avatarUrl);
    }

    res.json({
      success: true,
      data: {
        ...otherUser,
        avatarUrl,
        lastSeenAt: otherUser.lastSeenAt?.toISOString() || null,
        createdAt: otherUser.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get partner error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

export default router;
