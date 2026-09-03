import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { createAuditLog } from '../lib/audit';
import { config } from '../config';

const router = Router();

// ---- GET /api/calls/history ----
router.get('/history', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 50);
    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      prisma.callSession.findMany({
        where: {
          OR: [
            { callerId: req.user.id },
            { receiverId: req.user.id },
          ],
        },
        include: {
          caller: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          receiver: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.callSession.count({
        where: {
          OR: [
            { callerId: req.user.id },
            { receiverId: req.user.id },
          ],
        },
      }),
    ]);

    res.json({
      success: true,
      data: calls.map((c: any) => ({
        ...c,
        startedAt: c.startedAt.toISOString(),
        answeredAt: c.answeredAt?.toISOString() || null,
        endedAt: c.endedAt?.toISOString() || null,
      })),
      meta: {
        page,
        limit,
        total,
        hasMore: skip + calls.length < total,
      },
    });
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/calls ----
// Create a call record (called when initiating a call)
router.post('/', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const schema = z.object({
      conversationId: z.string().uuid(),
      callType: z.enum(['voice', 'video']),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
      return;
    }

    // Verify membership
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: parsed.data.conversationId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
      return;
    }

    // Check if there's an active call in this conversation
    const activeCall = await prisma.callSession.findFirst({
      where: {
        conversationId: parsed.data.conversationId,
        status: { in: ['answered'] },
        endedAt: null,
      },
    });

    if (activeCall) {
      res.status(409).json({
        success: false,
        error: { code: 'CALL_IN_PROGRESS', message: 'A call is already in progress' },
      });
      return;
    }

    // Get the other user
    const otherMember = await prisma.conversationMember.findFirst({
      where: {
        conversationId: parsed.data.conversationId,
        userId: { not: req.user.id },
      },
    });

    if (!otherMember) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_RECEIVER', message: 'No other user in conversation' },
      });
      return;
    }

    const call = await prisma.callSession.create({
      data: {
        callerId: req.user.id,
        receiverId: otherMember.userId,
        conversationId: parsed.data.conversationId,
        callType: parsed.data.callType,
        status: 'missed',
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: call.id,
        callType: call.callType,
        status: call.status,
        startedAt: call.startedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Create call error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- PATCH /api/calls/:id/answer ----
router.patch('/:id/answer', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const call = await prisma.callSession.findUnique({ where: { id } });

    if (!call) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Call not found' },
      });
      return;
    }

    // Only the receiver can answer
    if (call.receiverId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
      return;
    }

    const updated = await prisma.callSession.update({
      where: { id },
      data: {
        status: 'answered',
        answeredAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        answeredAt: updated.answeredAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Answer call error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- PATCH /api/calls/:id/end ----
router.patch('/:id/end', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const call = await prisma.callSession.findUnique({ where: { id } });

    if (!call) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Call not found' },
      });
      return;
    }

    // Only participants can end
    if (call.callerId !== req.user.id && call.receiverId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
      return;
    }

    const now = new Date();
    const duration = call.answeredAt
      ? Math.floor((now.getTime() - call.answeredAt.getTime()) / 1000)
      : 0;

    const updated = await prisma.callSession.update({
      where: { id },
      data: {
        status: call.answeredAt ? 'ended' : 'missed',
        endedAt: now,
        duration,
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        duration: updated.duration,
        endedAt: updated.endedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- PATCH /api/calls/:id/decline ----
router.patch('/:id/decline', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const call = await prisma.callSession.findUnique({ where: { id } });

    if (!call) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Call not found' },
      });
      return;
    }

    if (call.receiverId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
      return;
    }

    const updated = await prisma.callSession.update({
      where: { id },
      data: {
        status: 'declined',
        endedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (error) {
    console.error('Decline call error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- GET /api/calls/ice-servers ----
router.get('/ice-servers', authenticate, async (_req, res: Response): Promise<void> => {
  try {
    const iceServers: Array<{ urls: string; username?: string; credential?: string }> = [];

    // STUN servers
    for (const url of config.webrtc.stunUrls) {
      if (url.trim()) {
        iceServers.push({ urls: url.trim() });
      }
    }

    // TURN server
    if (config.webrtc.turnUrl) {
      iceServers.push({
        urls: config.webrtc.turnUrl,
        username: config.webrtc.turnUsername,
        credential: config.webrtc.turnCredential,
      });
    }

    res.json({
      success: true,
      data: { iceServers },
    });
  } catch (error) {
    console.error('Get ICE servers error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

export default router;
