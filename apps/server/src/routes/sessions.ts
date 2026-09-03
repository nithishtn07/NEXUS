import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { createAuditLog, AuditActions } from '../lib/audit';

const router = Router();

// ---- GET /api/sessions ----
// Get all active sessions for the current user
router.get('/', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId: req.user.id,
        revokedAt: null,
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    res.json({
      success: true,
      data: sessions.map((s: any) => ({
        id: s.id,
        deviceName: s.deviceName || 'Unknown Device',
        platform: s.platform || 'unknown',
        isCurrent: s.id === req.sessionId,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- DELETE /api/sessions/:id ----
// Revoke a specific session
router.delete('/:id', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({ where: { id } });

    if (!session || session.userId !== req.user.id) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' },
      });
      return;
    }

    if (session.id === req.sessionId) {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_REVOKE_CURRENT', message: 'Cannot revoke current session' },
      });
      return;
    }

    await prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.SESSION_REVOKE,
      metadata: { sessionId: id },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: { message: 'Session revoked' } });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/devices/register ----
// Register push notification token
router.post('/devices/register', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { pushToken, platform, deviceName } = req.body;

    if (!pushToken || !platform) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Push token and platform are required' },
      });
      return;
    }

    await prisma.device.upsert({
      where: {
        // Use a composite approach - find existing or create new
        id: `device-${req.user.id}-${pushToken.slice(0, 20)}`,
      },
      create: {
        id: `device-${req.user.id}-${pushToken.slice(0, 20)}`,
        userId: req.user.id,
        pushToken,
        platform,
        deviceName: deviceName || 'Unknown Device',
      },
      update: {
        pushToken,
        platform,
        deviceName: deviceName || undefined,
        lastSeenAt: new Date(),
      },
    });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.DEVICE_REGISTER,
      metadata: { platform, deviceName },
    });

    res.json({ success: true, data: { message: 'Device registered' } });
  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

export default router;
