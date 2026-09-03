import { Request } from 'express';
import { Socket } from 'socket.io';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  sessionId: string;
}

export interface AuthenticatedSocket extends Socket {
  userId: string;
  username: string;
  sessionId: string;
}

export interface PaginationParams {
  cursor?: string;
  limit: number;
  direction?: 'before' | 'after';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    cursor?: string;
    hasMore: boolean;
    total: number;
  };
}
