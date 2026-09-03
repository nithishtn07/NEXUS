import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { createAuditLog, AuditActions } from '../lib/audit';
import { PaginationParams } from '../types';

const router = Router();

// ---- GET /api/messages/:conversationId ----
// Get messages for a conversation with cursor-based pagination
router.get('/:conversationId', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);

    // Verify user is member of conversation
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to access this conversation' },
      });
      return;
    }

    const where: Record<string, unknown> = {
      conversationId,
    };

    if (cursor) {
      const cursorMessage = await prisma.message.findUnique({ where: { id: cursor } });
      if (cursorMessage) {
        where.createdAt = { lt: cursorMessage.createdAt };
      }
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        readReceipts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        attachments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, limit) : messages;

    // Transform reactions
    const transformedMessages = data.map((msg: any) => ({
      ...msg,
      createdAt: msg.createdAt.toISOString(),
      updatedAt: msg.updatedAt.toISOString(),
      editedAt: msg.editedAt?.toISOString() || null,
      deletedAt: msg.deletedAt?.toISOString() || null,
      replyTo: msg.replyTo
        ? {
            ...msg.replyTo,
            createdAt: msg.replyTo.createdAt.toISOString(),
            updatedAt: msg.replyTo.updatedAt.toISOString(),
          }
        : null,
      reactions: groupReactions(msg.reactions),
      readReceipts: msg.readReceipts.map((rr: any) => ({
        userId: rr.userId,
        readAt: rr.readAt.toISOString(),
      })),
      attachments: msg.attachments.map((a: any) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
      })),
    }));

    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

    res.json({
      success: true,
      data: transformedMessages,
      meta: {
        cursor: nextCursor,
        hasMore,
        total: await prisma.message.count({ where: { conversationId, deletedAt: null } }),
      },
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/messages/:conversationId ----
// Send a message
router.post('/:conversationId', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;

    const schema = z.object({
      content: z.string().max(5000).optional(),
      type: z.enum(['text', 'image', 'voice']).default('text'),
      replyToId: z.string().uuid().optional(),
      tempId: z.string().optional(),
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
          conversationId,
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

    // Verify reply target if provided
    if (parsed.data.replyToId) {
      const replyMessage = await prisma.message.findUnique({
        where: { id: parsed.data.replyToId },
      });

      if (!replyMessage || replyMessage.conversationId !== conversationId) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_REPLY', message: 'Invalid reply target' },
        });
        return;
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: req.user.id,
        content: parsed.data.content || null,
        type: parsed.data.type,
        replyToId: parsed.data.replyToId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
          },
        },
        reactions: true,
        readReceipts: true,
        attachments: true,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // The message will be broadcast via Socket.IO in the socket handler
    // For REST API, we return the created message
    res.status(201).json({
      success: true,
      data: {
        ...message,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        status: 'sent',
        reactions: [],
        readReceipts: [],
        attachments: [],
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- PATCH /api/messages/:messageId ----
// Edit a message
router.patch('/:messageId', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;

    const schema = z.object({
      content: z.string().min(1).max(5000),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
      return;
    }

    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Message not found' },
      });
      return;
    }

    if (message.senderId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Can only edit your own messages' },
      });
      return;
    }

    if (message.deletedAt) {
      res.status(400).json({
        success: false,
        error: { code: 'MESSAGE_DELETED', message: 'Cannot edit deleted message' },
      });
      return;
    }

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: parsed.data.content,
        editedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
        readReceipts: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
        attachments: true,
      },
    });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.MESSAGE_EDIT,
      metadata: { messageId },
    });

    res.json({
      success: true,
      data: {
        ...updatedMessage,
        createdAt: updatedMessage.createdAt.toISOString(),
        updatedAt: updatedMessage.updatedAt.toISOString(),
        editedAt: updatedMessage.editedAt?.toISOString() || null,
        deletedAt: updatedMessage.deletedAt?.toISOString() || null,
        reactions: groupReactions(updatedMessage.reactions),
        readReceipts: updatedMessage.readReceipts.map((rr: any) => ({
          userId: rr.userId,
          readAt: rr.readAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- DELETE /api/messages/:messageId ----
// Soft delete a message
router.delete('/:messageId', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({ where: { id: messageId } });

    if (!message) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Message not found' },
      });
      return;
    }

    if (message.senderId !== req.user.id) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Can only delete your own messages' },
      });
      return;
    }

    await prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: null,
      },
    });

    await createAuditLog({
      userId: req.user.id,
      action: AuditActions.MESSAGE_DELETE,
      metadata: { messageId },
    });

    res.json({
      success: true,
      data: { messageId, deleted: true },
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/messages/:messageId/reactions ----
// Add/remove reaction
router.post('/:messageId/reactions', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;

    const schema = z.object({
      reaction: z.string().min(1).max(10),
      action: z.enum(['add', 'remove']),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input' },
      });
      return;
    }

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Message not found' },
      });
      return;
    }

    if (parsed.data.action === 'add') {
      await prisma.messageReaction.upsert({
        where: {
          messageId_userId_reaction: {
            messageId,
            userId: req.user.id,
            reaction: parsed.data.reaction,
          },
        },
        create: {
          messageId,
          userId: req.user.id,
          reaction: parsed.data.reaction,
        },
        update: {},
      });
    } else {
      await prisma.messageReaction.deleteMany({
        where: {
          messageId,
          userId: req.user.id,
          reaction: parsed.data.reaction,
        },
      });
    }

    // Get updated reactions
    const reactions = await prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        messageId,
        reaction: parsed.data.reaction,
        action: parsed.data.action,
        reactions: groupReactions(reactions),
      },
    });
  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- POST /api/messages/:messageId/read ----
// Mark message as read
router.post('/:messageId/read', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;

    await prisma.messageRead.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: req.user.id,
        },
      },
      create: {
        messageId,
        userId: req.user.id,
      },
      update: {},
    });

    res.json({ success: true, data: { messageId, read: true } });
  } catch (error) {
    console.error('Read receipt error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- GET /api/messages/search/:conversationId ----
// Search messages
router.get('/search/:conversationId', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const query = req.query.q as string;

    if (!query || query.length < 2) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: 'Search query must be at least 2 characters' },
      });
      return;
    }

    // Verify membership
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
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

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        content: { contains: query, mode: 'insensitive' },
        deletedAt: null,
      },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: messages.map((m: any) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

// ---- Helper: Group reactions ----
function groupReactions(
  reactions: Array<{
    reaction: string;
    user: { id: string; username: string };
    userId: string;
  }>,
) {
  const grouped: Record<string, { reaction: string; users: { id: string; username: string }[]; count: number }> = {};

  for (const r of reactions) {
    if (!grouped[r.reaction]) {
      grouped[r.reaction] = { reaction: r.reaction, users: [], count: 0 };
    }
    grouped[r.reaction].users.push(r.user);
    grouped[r.reaction].count++;
  }

  return Object.values(grouped);
}

export default router;
