import { Server as SocketIOServer, Socket } from 'socket.io';
import http from 'http';
import { verifyJWT } from '../lib/crypto';
import prisma from '../lib/prisma';
import { config } from '../config';
import { AuthenticatedSocket } from '../types';
import { shouldNotifyUser, sendPushNotification } from '../lib/notifications';

// Track online users
const onlineUsers = new Map<string, { socketId: string; userId: string; lastPresence: Date }>();
const typingUsers = new Map<string, { userId: string; timeout: NodeJS.Timeout }>();

export function initializeSocket(server: http.Server): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: config.isProduction
        ? (config.cors.origin === '*' ? true : config.cors.origin.split(','))
        : true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        next(new Error('Authentication required'));
        return;
      }

      const decoded = verifyJWT(token);
      if (!decoded) {
        next(new Error('Invalid token'));
        return;
      }

      // Verify session
      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
      });

      if (!session || session.revokedAt || new Date() > session.expiresAt) {
        next(new Error('Session expired'));
        return;
      }

      const authSocket = socket as AuthenticatedSocket;
      authSocket.userId = decoded.id;
      authSocket.username = decoded.username;
      authSocket.sessionId = decoded.sessionId;

      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;

    console.log(`User connected: ${userId}`);

    // Track online status
    onlineUsers.set(userId, {
      socketId: socket.id,
      userId,
      lastPresence: new Date(),
    });

    // Broadcast presence
    socket.broadcast.emit('presence:changed', {
      userId,
      isOnline: true,
      lastSeenAt: new Date().toISOString(),
    });

    // Handle presence updates
    socket.on('presence:update', (data: { isOnline: boolean }) => {
      const presence = onlineUsers.get(userId);
      if (presence) {
        presence.lastPresence = new Date();
      }

      if (!data.isOnline) {
        socket.broadcast.emit('presence:changed', {
          userId,
          isOnline: false,
          lastSeenAt: new Date().toISOString(),
        });
      }
    });

    // Handle typing indicators
    socket.on('typing:start', (data: { conversationId: string }) => {
      const key = `${userId}:${data.conversationId}`;

      // Clear existing timeout
      const existing = typingUsers.get(key);
      if (existing) {
        clearTimeout(existing.timeout);
      }

      // Set new timeout (auto-stop after 5 seconds)
      const timeout = setTimeout(() => {
        typingUsers.delete(key);
        socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
          userId,
          conversationId: data.conversationId,
        });
      }, 5000);

      typingUsers.set(key, { userId, timeout });

      socket.to(`conversation:${data.conversationId}`).emit('typing:start', {
        userId,
        conversationId: data.conversationId,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      const key = `${userId}:${data.conversationId}`;
      const existing = typingUsers.get(key);
      if (existing) {
        clearTimeout(existing.timeout);
      }
      typingUsers.delete(key);

      socket.to(`conversation:${data.conversationId}`).emit('typing:stop', {
        userId,
        conversationId: data.conversationId,
      });
    });

    // Handle sending messages
    socket.on('message:send', async (data: {
      conversationId: string;
      content: string;
      type: string;
      replyToId?: string;
      tempId: string;
    }) => {
      try {
        // Verify membership
        const membership = await prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: {
              conversationId: data.conversationId,
              userId,
            },
          },
        });

        if (!membership) {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        // Create message in database
        const message = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderId: userId,
            content: data.content || null,
            type: data.type || 'text',
            replyToId: data.replyToId,
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
            attachments: true,
          },
        });

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { updatedAt: new Date() },
        });

        const messageData = {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          content: message.content,
          type: message.type,
          status: 'sent' as const,
          replyToId: message.replyToId,
          replyTo: message.replyTo
            ? {
                ...message.replyTo,
                createdAt: message.replyTo.createdAt.toISOString(),
                updatedAt: message.replyTo.updatedAt.toISOString(),
              }
            : null,
          reactions: [],
          readBy: [],
          attachments: message.attachments.map((a: any) => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
          })),
          createdAt: message.createdAt.toISOString(),
          updatedAt: message.updatedAt.toISOString(),
          editedAt: null,
          deletedAt: null,
          sender: message.sender,
        };

        // Broadcast to conversation
        io.to(`conversation:${data.conversationId}`).emit('message:new', messageData);

        // Send ack to sender with tempId for deduplication
        socket.emit('message:sent', {
          tempId: data.tempId,
          messageId: message.id,
        });

        // Send push notification if recipient is not online
        const otherMember = await prisma.conversationMember.findFirst({
          where: {
            conversationId: data.conversationId,
            userId: { not: userId },
          },
          include: { user: { include: { settings: true, devices: true } } },
        });

        if (otherMember) {
          const isRecipientOnline = onlineUsers.has(otherMember.userId);
          const settings = otherMember.user.settings;

          if (settings) {
            const { shouldNotify, title, body } = shouldNotifyUser(
              userId,
              otherMember.userId,
              data.content,
              {
                pushNotifications: settings.pushNotifications,
                messageNotifications: settings.messageNotifications,
              },
              isRecipientOnline,
            );

            if (shouldNotify) {
              const devices = otherMember.user.devices.filter((d: any) => d.pushToken);
              for (const device of devices) {
                if (device.pushToken) {
                  await sendPushNotification({
                    to: device.pushToken,
                    title,
                    body,
                    data: {
                      conversationId: data.conversationId,
                      messageId: message.id,
                    },
                    sound: settings.soundEnabled ? 'default' : undefined,
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle delivery receipts
    socket.on('message:delivered', async (data: { messageId: string; conversationId: string }) => {
      try {
        socket.to(`conversation:${data.conversationId}`).emit('message:delivered', {
          messageId: data.messageId,
          userId,
        });
      } catch (error) {
        console.error('Delivery receipt error:', error);
      }
    });

    // Handle read receipts
    socket.on('message:read', async (data: { messageId: string; conversationId: string }) => {
      try {
        await prisma.messageRead.upsert({
          where: {
            messageId_userId: {
              messageId: data.messageId,
              userId,
            },
          },
          create: {
            messageId: data.messageId,
            userId,
          },
          update: {},
        });

        socket.to(`conversation:${data.conversationId}`).emit('read:updated', {
          messageId: data.messageId,
          userId,
          readAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Read receipt error:', error);
      }
    });

    // Handle reactions
    socket.on('reaction:add', async (data: { messageId: string; reaction: string }) => {
      try {
        const message = await prisma.message.findUnique({
          where: { id: data.messageId },
          select: { conversationId: true },
        });

        if (!message) return;

        await prisma.messageReaction.upsert({
          where: {
            messageId_userId_reaction: {
              messageId: data.messageId,
              userId,
              reaction: data.reaction,
            },
          },
          create: {
            messageId: data.messageId,
            userId,
            reaction: data.reaction,
          },
          update: {},
        });

        io.to(`conversation:${message.conversationId}`).emit('reaction:added', {
          messageId: data.messageId,
          reaction: data.reaction,
          userId,
        });
      } catch (error) {
        console.error('Add reaction error:', error);
      }
    });

    socket.on('reaction:remove', async (data: { messageId: string; reaction: string }) => {
      try {
        const message = await prisma.message.findUnique({
          where: { id: data.messageId },
          select: { conversationId: true },
        });

        if (!message) return;

        await prisma.messageReaction.deleteMany({
          where: {
            messageId: data.messageId,
            userId,
            reaction: data.reaction,
          },
        });

        io.to(`conversation:${message.conversationId}`).emit('reaction:removed', {
          messageId: data.messageId,
          reaction: data.reaction,
          userId,
        });
      } catch (error) {
        console.error('Remove reaction error:', error);
      }
    });

    // ---- CALL SIGNALING ----
    // Incoming call
    socket.on('call:invite', (data: {
      conversationId: string;
      callType: 'voice' | 'video';
      callId: string;
      callerName: string;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit('call:ringing', {
        callId: data.callId,
        callerId: userId,
        callerName: data.callerName,
        callType: data.callType,
        conversationId: data.conversationId,
      });
    });

    // Accept call
    socket.on('call:accept', (data: {
      conversationId: string;
      callId: string;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit('call:accepted', {
        callId: data.callId,
        acceptedBy: userId,
      });
    });

    // Decline call
    socket.on('call:decline', (data: {
      conversationId: string;
      callId: string;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit('call:declined', {
        callId: data.callId,
        declinedBy: userId,
      });
    });

    // Cancel outgoing call
    socket.on('call:cancel', (data: {
      conversationId: string;
      callId: string;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit('call:cancelled', {
        callId: data.callId,
        cancelledBy: userId,
      });
    });

    // End active call
    socket.on('call:end', (data: {
      conversationId: string;
      callId: string;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit('call:ended', {
        callId: data.callId,
        endedBy: userId,
      });
    });

    // WebRTC offer
    socket.on('call:offer', (data: {
      conversationId: string;
      callId: string;
      offer: unknown;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit('call:offer', {
        callId: data.callId,
        offer: data.offer,
        from: userId,
      });
    });

    // WebRTC answer
    socket.on('call:answer', (data: {
      conversationId: string;
      callId: string;
      answer: unknown;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit('call:answer', {
        callId: data.callId,
        answer: data.answer,
        from: userId,
      });
    });

    // ICE candidate
    socket.on('call:ice-candidate', (data: {
      conversationId: string;
      callId: string;
      candidate: unknown;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit('call:ice-candidate', {
        callId: data.callId,
        candidate: data.candidate,
        from: userId,
      });
    });

    // Busy signal
    socket.on('call:busy', (data: {
      conversationId: string;
      callId: string;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit('call:busy', {
        callId: data.callId,
        userId,
      });
    });

    // Handle joining conversation rooms
    socket.on('conversation:join', async (data: { conversationId: string }) => {
      const membership = await prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: data.conversationId,
            userId,
          },
        },
      });

      if (membership) {
        socket.join(`conversation:${data.conversationId}`);
      }
    });

    socket.on('conversation:leave', (data: { conversationId: string }) => {
      socket.leave(`conversation:${data.conversationId}`);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);

      // Clear typing indicators
      for (const [key, value] of typingUsers.entries()) {
        if (value.userId === userId) {
          clearTimeout(value.timeout);
          typingUsers.delete(key);
        }
      }

      // Remove from online users
      onlineUsers.delete(userId);

      // Update last seen
      await prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      });

      // Broadcast offline status
      socket.broadcast.emit('presence:changed', {
        userId,
        isOnline: false,
        lastSeenAt: new Date().toISOString(),
      });
    });
  });

  return io;
}

// Helper to check if a user is online
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}

// Helper to get online users
export function getOnlineUsers(): string[] {
  return Array.from(onlineUsers.keys());
}
