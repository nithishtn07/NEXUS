import argon2 from 'argon2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticatedUser } from '../types';

// ---- Password Hashing ----
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// ---- Token Generation ----
export function generateSecureToken(length: number = 48): string {
  return crypto.randomBytes(length).toString('base64url');
}

export function generateTokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): string {
  return generateSecureToken(32);
}

// ---- JWT ----
export function generateJWT(user: AuthenticatedUser, sessionId: string): string {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      sessionId,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn as any }
  );
}

export function verifyJWT(token: string): (AuthenticatedUser & { sessionId: string }) | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      sub: string;
      username: string;
      email: string;
      displayName: string;
      role: string;
      sessionId: string;
    };
    return {
      id: decoded.sub,
      username: decoded.username,
      email: decoded.email,
      displayName: decoded.displayName,
      role: decoded.role,
      sessionId: decoded.sessionId,
    };
  } catch {
    return null;
  }
}

// ---- Password Validation ----
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return { valid: errors.length === 0, errors };
}

// ---- Input Validation ----
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 1000);
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}
