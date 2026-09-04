import { Response, NextFunction } from 'express';
import { verifyJWT } from '../lib/crypto';
import { AuthenticatedRequest } from '../types';
import prisma from '../lib/prisma';

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    const token = authHeader.slice(7);
    const decoded = verifyJWT(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
      return;
    }

    // Verify session is still valid
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt) {
      res.status(401).json({
        success: false,
        error: { code: 'SESSION_EXPIRED', message: 'Session has been revoked' },
      });
      return;
    }

    if (new Date() > session.expiresAt) {
      res.status(401).json({
        success: false,
        error: { code: 'SESSION_EXPIRED', message: 'Session has expired' },
      });
      return;
    }

    // Update last seen
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      displayName: decoded.displayName,
      role: decoded.role,
    };
    req.sessionId = decoded.sessionId;

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication failed' },
    });
  }
}

export function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.user.role !== 'owner') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Owner access required' },
    });
    return;
  }
  next();
}
