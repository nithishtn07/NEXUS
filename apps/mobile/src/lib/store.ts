import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { io, Socket } from 'socket.io-client';
import { config } from './config';

// ---- Types ----
interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: string | null;
  role: string;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt?: string;
  settings: UserSettings | null;
}

interface UserSettings {
  pushNotifications: boolean;
  messageNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  showReadReceipts: boolean;
  theme: string;
  reducedMotion: boolean;
}

interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  otherUser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    status: string | null;
    isOnline: boolean;
    lastSeenAt: string | null;
  } | null;
  lastMessage: {
    id: string;
    content: string | null;
    type: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount?: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  type: string;
  status: string;
  replyToId: string | null;
  replyTo: Message | null;
  reactions: Array<{
    reaction: string;
    users: { id: string; username: string }[];
    count: number;
  }>;
  readBy: Array<{ userId: string; readAt: string }>;
  attachments: Array<{
    id: string;
    storageKey: string;
    mimeType: string;
    fileSize: number;
    width?: number;
    height?: number;
    thumbnailKey?: string;
    url?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  tempId?: string;
}

// ---- Auth Store ----
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSetupComplete: boolean;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  setup: (data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
    invitationToken: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  updateProfile: (data: { displayName?: string; status?: string }) => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  isSetupComplete: false,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),

  login: async (email: string, password: string) => {
    const response = await api.login({ email, password });
    if (response.success) {
      await SecureStore.setItemAsync('auth_token', response.data.token);
      await SecureStore.setItemAsync('auth_expires_at', response.data.expiresAt);
      set({
        user: { ...response.data.user, email, settings: null, role: 'member', isOnline: true },
        token: response.data.token,
        isAuthenticated: true,
      });
    } else {
      throw new Error(response.error?.message || 'Login failed');
    }
  },

  setup: async (data) => {
    const response = await api.setup(data);
    if (response.success) {
      await SecureStore.setItemAsync('auth_token', response.data.token);
      await SecureStore.setItemAsync('auth_expires_at', response.data.expiresAt);
      set({
        user: { ...response.data.user, email: data.email, settings: null, role: 'owner', isOnline: true },
        token: response.data.token,
        isAuthenticated: true,
        isSetupComplete: true,
      });
    } else {
      throw new Error(response.error?.message || 'Setup failed');
    }
  },

  register: async (data) => {
    const response = await api.register(data);
    if (response.success) {
      await SecureStore.setItemAsync('auth_token', response.data.token);
      await SecureStore.setItemAsync('auth_expires_at', response.data.expiresAt);
      set({
        user: { ...response.data.user, email: data.email, settings: null, role: 'member', isOnline: true },
        token: response.data.token,
        isAuthenticated: true,
      });
    } else {
      throw new Error(response.error?.message || 'Registration failed');
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Logout even if API call fails
    }
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_expires_at');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const expiresAt = await SecureStore.getItemAsync('auth_expires_at');

      if (!token || !expiresAt) {
        set({ isLoading: false, isSetupComplete: false });
        return;
      }

      // Check if token is expired
      if (new Date(expiresAt) < new Date()) {
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('auth_expires_at');
        set({ isLoading: false, isSetupComplete: false });
        return;
      }

      // Fetch user data
      const response = await api.getMe();
      if (response.success) {
        set({
          user: { ...response.data, isOnline: true },
          token,
          isAuthenticated: true,
          isLoading: false,
          isSetupComplete: true,
        });
      } else {
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('auth_expires_at');
        set({ isLoading: false, isSetupComplete: false });
      }
    } catch {
      set({ isLoading: false, isSetupComplete: false });
    }
  },

  updateProfile: async (data) => {
    const response = await api.updateProfile(data);
    if (response.success) {
      const currentUser = get().user;
      if (currentUser) {
        set({
          user: {
            ...currentUser,
            ...response.data,
          },
        });
      }
    }
  },

  updateSettings: async (settings) => {
    const response = await api.updateSettings(settings);
    if (response.success) {
      const currentUser = get().user;
      if (currentUser) {
        set({
          user: {
            ...currentUser,
            settings: { ...currentUser.settings, ...response.data } as UserSettings,
          },
        });
      }
    }
  },
}));

// ---- Chat Store ----
interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
  typingUsers: Map<string, string>;
  partnerOnline: boolean;
  partnerLastSeen: string | null;
  connectionStatus: 'connected' | 'reconnecting' | 'offline';

  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (conversation: Conversation | null) => void;
  loadMessages: (conversationId: string, cursor?: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  setTypingUser: (userId: string, conversationId: string) => void;
  removeTypingUser: (userId: string) => void;
  setPartnerOnline: (isOnline: boolean, lastSeenAt?: string) => void;
  setConnectionStatus: (status: 'connected' | 'reconnecting' | 'offline') => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  isLoadingMessages: false,
  hasMoreMessages: true,
  typingUsers: new Map(),
  partnerOnline: false,
  partnerLastSeen: null,
  connectionStatus: 'offline',

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (conversation) => set({
    activeConversation: conversation,
    messages: [],
    hasMoreMessages: true,
  }),

  loadMessages: async (conversationId: string, cursor?: string) => {
    const state = get();
    if (state.isLoadingMessages) return;

    set({ isLoadingMessages: true });

    try {
      const response = await api.getMessages(conversationId, cursor);
      if (response.success) {
        const newMessages = cursor
          ? [...state.messages, ...response.data]
          : response.data;

        set({
          messages: newMessages,
          hasMoreMessages: response.meta?.hasMore || false,
          isLoadingMessages: false,
        });
      }
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  addMessage: (message) => {
    const state = get();
    // Check for duplicates
    const exists = state.messages.some((m) => m.id === message.id || m.tempId === message.tempId);
    if (exists) return;

    set({
      messages: [message, ...state.messages],
    });
  },

  updateMessage: (messageId, updates) => {
    set({
      messages: get().messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m,
      ),
    });
  },

  removeMessage: (messageId) => {
    set({
      messages: get().messages.map((m) =>
        m.id === messageId
          ? { ...m, deletedAt: new Date().toISOString(), content: null }
          : m,
      ),
    });
  },

  setTypingUser: (userId, _conversationId) => {
    const newMap = new Map(get().typingUsers);
    newMap.set(userId, new Date().toISOString());
    set({ typingUsers: newMap });

    // Auto-remove after 5 seconds
    setTimeout(() => {
      const current = get().typingUsers;
      if (current.has(userId)) {
        const updated = new Map(current);
        updated.delete(userId);
        set({ typingUsers: updated });
      }
    }, 5000);
  },

  removeTypingUser: (userId) => {
    const newMap = new Map(get().typingUsers);
    newMap.delete(userId);
    set({ typingUsers: newMap });
  },

  setPartnerOnline: (isOnline, lastSeenAt) => {
    set({
      partnerOnline: isOnline,
      partnerLastSeen: lastSeenAt || get().partnerLastSeen,
    });
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));

// ---- Socket Manager ----
class SocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  async connect(token: string) {
    if (this.socket?.connected) return;

    this.socket = io(config.wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      useChatStore.getState().setConnectionStatus('connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      useChatStore.getState().setConnectionStatus('offline');
    });

    this.socket.on('connect_error', () => {
      this.reconnectAttempts++;
      useChatStore.getState().setConnectionStatus('reconnecting');
    });

    this.setupEventListeners();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Message events
    this.socket.on('message:new', (message: Message) => {
      useChatStore.getState().addMessage(message);
    });

    this.socket.on('message:updated', (message: Message) => {
      useChatStore.getState().updateMessage(message.id, message);
    });

    this.socket.on('message:deleted', (data: { messageId: string }) => {
      useChatStore.getState().removeMessage(data.messageId);
    });

    // Typing events
    this.socket.on('typing:start', (data: { userId: string; conversationId: string }) => {
      useChatStore.getState().setTypingUser(data.userId, data.conversationId);
    });

    this.socket.on('typing:stop', (data: { userId: string }) => {
      useChatStore.getState().removeTypingUser(data.userId);
    });

    // Presence events
    this.socket.on('presence:changed', (data: { userId: string; isOnline: boolean; lastSeenAt: string }) => {
      useChatStore.getState().setPartnerOnline(data.isOnline, data.lastSeenAt);
    });

    // Reaction events
    this.socket.on('reaction:added', (data: { messageId: string; reaction: string; userId: string }) => {
      const messages = useChatStore.getState().messages;
      const message = messages.find((m) => m.id === data.messageId);
      if (message) {
        const existingReaction = message.reactions.find((r) => r.reaction === data.reaction);
        if (existingReaction) {
          useChatStore.getState().updateMessage(data.messageId, {
            reactions: message.reactions.map((r) =>
              r.reaction === data.reaction
                ? { ...r, count: r.count + 1, users: [...r.users, { id: data.userId, username: '' }] }
                : r,
            ),
          });
        } else {
          useChatStore.getState().updateMessage(data.messageId, {
            reactions: [...message.reactions, {
              reaction: data.reaction,
              users: [{ id: data.userId, username: '' }],
              count: 1,
            }],
          });
        }
      }
    });

    this.socket.on('reaction:removed', (data: { messageId: string; reaction: string; userId: string }) => {
      const messages = useChatStore.getState().messages;
      const message = messages.find((m) => m.id === data.messageId);
      if (message) {
        useChatStore.getState().updateMessage(data.messageId, {
          reactions: message.reactions
            .map((r) =>
              r.reaction === data.reaction
                ? { ...r, count: r.count - 1, users: r.users.filter((u) => u.id !== data.userId) }
                : r,
            )
            .filter((r) => r.count > 0),
        });
      }
    });

    // Read receipt events
    this.socket.on('read:updated', (data: { messageId: string; userId: string; readAt: string }) => {
      const messages = useChatStore.getState().messages;
      const message = messages.find((m) => m.id === data.messageId);
      if (message) {
        const exists = message.readBy.some((r) => r.userId === data.userId);
        if (!exists) {
          useChatStore.getState().updateMessage(data.messageId, {
            readBy: [...message.readBy, { userId: data.userId, readAt: data.readAt }],
          });
        }
      }
    });

    // Delivery events
    this.socket.on('message:delivered', (data: { messageId: string }) => {
      useChatStore.getState().updateMessage(data.messageId, { status: 'delivered' });
    });

    this.socket.on('message:sent', (data: { tempId: string; messageId: string }) => {
      const messages = useChatStore.getState().messages;
      const message = messages.find((m) => m.tempId === data.tempId);
      if (message) {
        useChatStore.getState().updateMessage(message.id, {
          id: data.messageId,
          status: 'sent',
        });
      }
    });
  }

  sendMessage(data: {
    conversationId: string;
    content: string;
    type: string;
    replyToId?: string;
    tempId: string;
  }) {
    this.socket?.emit('message:send', data);
  }

  sendTypingStart(conversationId: string) {
    this.socket?.emit('typing:start', { conversationId });
  }

  sendTypingStop(conversationId: string) {
    this.socket?.emit('typing:stop', { conversationId });
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('conversation:join', { conversationId });
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('conversation:leave', { conversationId });
  }

  sendReadReceipt(messageId: string, conversationId: string) {
    this.socket?.emit('message:read', { messageId, conversationId });
  }

  addReaction(messageId: string, reaction: string) {
    this.socket?.emit('reaction:add', { messageId, reaction });
  }

  removeReaction(messageId: string, reaction: string) {
    this.socket?.emit('reaction:remove', { messageId, reaction });
  }

  updatePresence(isOnline: boolean) {
    this.socket?.emit('presence:update', { isOnline });
  }

  // ---- Call Signaling ----
  emitCallInvite(conversationId: string, callType: string, callId: string, callerName: string) {
    this.socket?.emit('call:invite', { conversationId, callType, callId, callerName });
  }

  emitCallAccept(conversationId: string, callId: string) {
    this.socket?.emit('call:accept', { conversationId, callId });
  }

  emitCallDecline(conversationId: string, callId: string) {
    this.socket?.emit('call:decline', { conversationId, callId });
  }

  emitCallCancel(conversationId: string, callId: string) {
    this.socket?.emit('call:cancel', { conversationId, callId });
  }

  emitCallEnd(conversationId: string, callId: string) {
    this.socket?.emit('call:end', { conversationId, callId });
  }

  emitCallOffer(conversationId: string, callId: string, offer: unknown) {
    this.socket?.emit('call:offer', { conversationId, callId, offer });
  }

  emitCallAnswer(conversationId: string, callId: string, answer: unknown) {
    this.socket?.emit('call:answer', { conversationId, callId, answer });
  }

  emitCallIceCandidate(conversationId: string, callId: string, candidate: unknown) {
    this.socket?.emit('call:ice-candidate', { conversationId, callId, candidate });
  }

  emitCallBusy(conversationId: string, callId: string) {
    this.socket?.emit('call:busy', { conversationId, callId });
  }

  // ---- Call Event Listeners ----
  onCallRinging(callback: (data: any) => void): () => void {
    this.socket?.on('call:ringing', callback);
    return () => { this.socket?.off('call:ringing', callback); };
  }

  onCallAccepted(callback: (data: any) => void): () => void {
    this.socket?.on('call:accepted', callback);
    return () => { this.socket?.off('call:accepted', callback); };
  }

  onCallDeclined(callback: (data: any) => void): () => void {
    this.socket?.on('call:declined', callback);
    return () => { this.socket?.off('call:declined', callback); };
  }

  onCallCancelled(callback: (data: any) => void): () => void {
    this.socket?.on('call:cancelled', callback);
    return () => { this.socket?.off('call:cancelled', callback); };
  }

  onCallEnded(callback: (data: any) => void): () => void {
    this.socket?.on('call:ended', callback);
    return () => { this.socket?.off('call:ended', callback); };
  }

  onCallOffer(callback: (conversationId: string, callId: string, offer: any) => void): () => void {
    const handler = (data: any) => callback(data.conversationId, data.callId, data.offer);
    this.socket?.on('call:offer', handler);
    return () => { this.socket?.off('call:offer', handler); };
  }

  onCallAnswer(callback: (conversationId: string, callId: string, answer: any) => void): () => void {
    const handler = (data: any) => callback(data.conversationId, data.callId, data.answer);
    this.socket?.on('call:answer', handler);
    return () => { this.socket?.off('call:answer', handler); };
  }

  onCallIceCandidate(callback: (conversationId: string, callId: string, candidate: any) => void): () => void {
    const handler = (data: any) => callback(data.conversationId, data.callId, data.candidate);
    this.socket?.on('call:ice-candidate', handler);
    return () => { this.socket?.off('call:ice-candidate', handler); };
  }

  onCallBusy(callback: (data: any) => void): () => void {
    this.socket?.on('call:busy', callback);
    return () => { this.socket?.off('call:busy', callback); };
  }

  get isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketManager = new SocketManager();
