import { config } from '../config';

interface PushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: string;
}

interface ExpoPushTicket {
  id: string;
  status: 'ok' | 'error';
  message?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendPushNotification(payload: PushPayload): Promise<boolean> {
  if (!config.push.accessToken || !payload.to) {
    return false;
  }

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.push.accessToken}`,
      },
      body: JSON.stringify({
        ...payload,
        sound: payload.sound || 'default',
        channelId: payload.channelId || 'messages',
      }),
    });

    if (!response.ok) {
      return false;
    }

    const tickets = (await response.json()) as ExpoPushTicket[];
    return tickets.some((t) => t.status === 'ok');
  } catch {
    return false;
  }
}

export async function sendBulkPushNotifications(
  payloads: PushPayload[],
): Promise<number> {
  if (!config.push.accessToken || payloads.length === 0) {
    return 0;
  }

  // Expo recommends batches of max 100
  const batchSize = 100;
  let sentCount = 0;

  for (let i = 0; i < payloads.length; i += batchSize) {
    const batch = payloads.slice(i, i + batchSize).filter((p) => p.to);

    if (batch.length === 0) continue;

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.push.accessToken}`,
        },
        body: JSON.stringify(batch.map((p) => ({
          ...p,
          sound: p.sound || 'default',
          channelId: p.channelId || 'messages',
        }))),
      });

      if (response.ok) {
        const tickets = (await response.json()) as ExpoPushTicket[];
        sentCount += tickets.filter((t) => t.status === 'ok').length;
      }
    } catch {
      // Continue with next batch
    }
  }

  return sentCount;
}

export function shouldNotifyUser(
  senderId: string,
  recipientId: string,
  messageContent: string | null,
  settings: {
    pushNotifications: boolean;
    messageNotifications: boolean;
  },
  recipientOnline: boolean,
): { shouldNotify: boolean; title: string; body: string } {
  if (!settings.pushNotifications || !settings.messageNotifications) {
    return { shouldNotify: false, title: '', body: '' };
  }

  // Don't notify if user is online (they'll see it in-app)
  if (recipientOnline) {
    return { shouldNotify: false, title: '', body: '' };
  }

  const title = 'NEXUS';
  const body = messageContent
    ? messageContent.length > 100
      ? `${messageContent.slice(0, 100)}...`
      : messageContent
    : 'New message';

  return { shouldNotify: true, title, body };
}
