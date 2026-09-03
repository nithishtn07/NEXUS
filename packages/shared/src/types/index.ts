// ============================================
// NEXUS Shared Types
// ============================================

// ---- User ----
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  status: string | null;
  role: 'owner' | 'member';
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
}

// ---- Auth ----
export interface LoginRequest {
  email: string;
  password: string;
  deviceName?: string;
}

export interface LoginResponse {
  user: PublicUser;
  token: string;
  expiresAt: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName: string;
  invitationToken: string;
  deviceName?: string;
}

export interface RegisterResponse {
  user: PublicUser;
  token: string;
  expiresAt: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ---- Session ----
export interface Session {
  id: string;
  userId: string;
  deviceName: string | null;
  platform: string | null;
  isCurrent: boolean;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
}

// ---- Invitation ----
export interface Invitation {
  id: string;
  token: string;
  createdBy: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface CreateInvitationResponse {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  deepLink: string;
}

export interface ValidateInvitationResponse {
  valid: boolean;
  expiresAt: string;
  createdAt: string;
}

// ---- Conversation ----
export interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  otherUser: PublicUser;
  lastMessage: MessagePreview | null;
  unreadCount: number;
}

export interface MessagePreview {
  id: string;
  content: string | null;
  type: MessageType;
  senderId: string;
  createdAt: string;
}

// ---- Message ----
export type MessageType = 'text' | 'image' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'edited' | 'deleted';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  type: MessageType;
  status: MessageStatus;
  replyToId: string | null;
  replyTo: Message | null;
  reactions: Reaction[];
  readBy: ReadReceipt[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: PublicUser;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  reaction: string;
  createdAt: string;
}

export interface Reaction {
  reaction: string;
  users: { id: string; username: string }[];
  count: number;
}

export interface ReadReceipt {
  userId: string;
  readAt: string;
}

// ---- Attachment ----
export interface Attachment {
  id: string;
  messageId: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  thumbnailKey?: string;
  url?: string;
  createdAt: string;
}

// ---- Device ----
export interface Device {
  id: string;
  userId: string;
  platform: string;
  deviceName: string | null;
  isCurrent: boolean;
  createdAt: string;
  lastSeenAt: string;
}

// ---- Settings ----
export interface UserSettings {
  pushNotifications: boolean;
  messageNotifications: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  showReadReceipts: boolean;
  theme: 'dark' | 'light' | 'system';
  reducedMotion: boolean;
}

// ---- Audit Log ----
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ---- API Responses ----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    cursor?: string;
    hasMore?: boolean;
  };
}

// ---- Pagination ----
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    cursor?: string;
    hasMore: boolean;
    total: number;
  };
}

// ---- WebSocket Events ----
export interface SocketEvents {
  // Client -> Server
  'presence:update': { isOnline: boolean };
  'typing:start': { conversationId: string };
  'typing:stop': { conversationId: string };
  'message:send': {
    conversationId: string;
    content: string;
    type: MessageType;
    replyToId?: string;
    tempId: string;
  };
  'message:delivered': { messageId: string; conversationId: string };
  'message:read': { messageId: string; conversationId: string };
  'reaction:add': { messageId: string; reaction: string };
  'reaction:remove': { messageId: string; reaction: string };

  // Server -> Client
  'message:new': Message;
  'message:updated': Message;
  'message:deleted': { messageId: string; conversationId: string };
  'typing:start': { userId: string; conversationId: string };
  'typing:stop': { userId: string; conversationId: string };
  'presence:changed': { userId: string; isOnline: boolean; lastSeenAt: string };
  'reaction:added': { messageId: string; reaction: string; userId: string };
  'reaction:removed': { messageId: string; reaction: string; userId: string };
  'read:updated': { messageId: string; userId: string; readAt: string };
}

// ---- Deep Links ----
export type DeepLink = {
  type: 'invite';
  token: string;
} | {
  type: 'conversation';
  conversationId: string;
} | {
  type: 'message';
  conversationId: string;
  messageId: string;
};
