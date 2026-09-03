import prisma from './prisma';

export interface AuditLogData {
  userId: string;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export const AuditActions = {
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  LOGOUT_ALL: 'auth.logout_all',
  REGISTER: 'auth.register',
  PASSWORD_CHANGE: 'auth.password_change',
  PASSWORD_RESET: 'auth.password_reset',
  SESSION_CREATE: 'session.create',
  SESSION_REVOKE: 'session.revoke',
  INVITATION_CREATE: 'invitation.create',
  INVITATION_USE: 'invitation.use',
  INVITATION_REVOKE: 'invitation.revoke',
  ACCOUNT_DELETE: 'account.delete',
  PROFILE_UPDATE: 'profile.update',
  AVATAR_UPLOAD: 'avatar.upload',
  SETTINGS_UPDATE: 'settings.update',
  MESSAGE_SEND: 'message.send',
  MESSAGE_DELETE: 'message.delete',
  MESSAGE_EDIT: 'message.edit',
  ATTACHMENT_UPLOAD: 'attachment.upload',
  DEVICE_REGISTER: 'device.register',
  PUSH_TOKEN_UPDATE: 'device.push_token_update',
} as const;

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        metadata: (data.metadata || {}) as Record<string, string>,
        ipAddress: data.ipAddress,
      },
    });
  } catch {
    // Audit logging should never crash the application
    // In production, you'd want to log this to an external service
  }
}

export async function getAuditLogs(
  userId: string,
  page: number = 1,
  limit: number = 50,
): Promise<{ logs: Awaited<ReturnType<typeof prisma.auditLog.findMany>>; total: number }> {
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where: { userId } }),
  ]);

  return { logs, total };
}
