import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';

const router = Router();

// ---- GET /api/conversations ----
// Get all conversations for the current user (in a two-user app, there's only one)
router.get('/', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const memberships = await prisma.conversationMember.findMany({
      where: { userId: req.user.id },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    lastSeenAt: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                content: true,
                type: true,
                senderId: true,
                createdAt: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    const conversations = memberships.map((m: any) => {
      const otherMember = m.conversation.members.find(
        (mem: any) => mem.userId !== req.user.id,
      );

      return {
        id: m.conversation.id,
        createdAt: m.conversation.createdAt.toISOString(),
        updatedAt: m.conversation.updatedAt.toISOString(),
        otherUser: otherMember
          ? {
              id: otherMember.user.id,
              username: otherMember.user.username,
              displayName: otherMember.user.displayName,
              avatarUrl: otherMember.user.avatarUrl,
              status: null,
              isOnline: false,
              lastSeenAt: otherMember.user.lastSeenAt?.toISOString() || null,
            }
          : null,
        lastMessage: m.conversation.messages[0]
          ? {
              id: m.conversation.messages[0].id,
              content: m.conversation.messages[0].deletedAt ? null : m.conversation.messages[0].content,
              type: m.conversation.messages[0].type,
              senderId: m.conversation.messages[0].senderId,
              createdAt: m.conversation.messages[0].createdAt.toISOString(),
            }
          : null,
      };
    });

    res.json({ success: true, data: conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- GET /api/conversations/:id ----
router.get('/:id', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
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

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                status: true,
                lastSeenAt: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Conversation not found' },
      });
      return;
    }

    const otherMember = conversation.members.find(
      (m: any) => m.userId !== req.user.id,
    );

    res.json({
      success: true,
      data: {
        id: conversation.id,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        otherUser: otherMember
          ? {
              id: otherMember.user.id,
              username: otherMember.user.username,
              displayName: otherMember.user.displayName,
              avatarUrl: otherMember.user.avatarUrl,
              status: otherMember.user.status,
              isOnline: false,
              lastSeenAt: otherMember.user.lastSeenAt?.toISOString() || null,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/conversations/:id/read ----
// Mark all messages in conversation as read
router.post('/:id/read', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
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

    // Get all messages not yet read by this user
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId: id,
        senderId: { not: req.user.id },
        readReceipts: {
          none: { userId: req.user.id },
        },
      },
      select: { id: true },
    });

    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map((msg: any) => ({
          messageId: msg.id,
          userId: req.user.id,
        })),
        skipDuplicates: true,
      });
    }

    res.json({
      success: true,
      data: {
        conversationId: id,
        readCount: unreadMessages.length,
      },
    });
  } catch (error) {
    console.error('Mark conversation read error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

export default router;
