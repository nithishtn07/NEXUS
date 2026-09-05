import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  port: parseInt(optionalEnv('PORT', '3000'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isProduction: optionalEnv('NODE_ENV', 'development') === 'production',

  database: {
    url: requiredEnv('DATABASE_URL'),
  },

  jwt: {
    secret: requiredEnv('JWT_SECRET'),
    expiresIn: optionalEnv('JWT_EXPIRES_IN', '30d'),
  },

  session: {
    maxAgeDays: parseInt(optionalEnv('SESSION_MAX_AGE_DAYS', '30'), 10),
    maxSessions: parseInt(optionalEnv('MAX_SESSIONS', '5'), 10),
  },

  storage: {
    endpoint: optionalEnv('STORAGE_ENDPOINT', ''),
    accessKey: optionalEnv('STORAGE_ACCESS_KEY', ''),
    secretKey: optionalEnv('STORAGE_SECRET_KEY', ''),
    bucket: optionalEnv('STORAGE_BUCKET', 'nexus-storage'),
    region: optionalEnv('STORAGE_REGION', 'us-east-1'),
    publicUrl: optionalEnv('STORAGE_PUBLIC_URL', ''),
  },

  push: {
    projectId: optionalEnv('EXPO_PROJECT_ID', ''),
    accessToken: optionalEnv('EXPO_ACCESS_TOKEN', ''),
  },

  cors: {
    origin: optionalEnv('CORS_ORIGIN', 'http://localhost:8081'),
  },

  rateLimit: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(optionalEnv('LOGIN_RATE_LIMIT', '30'), 10),
    },
    invitation: {
      windowMs: 15 * 60 * 1000,
      max: parseInt(optionalEnv('INVITATION_RATE_LIMIT', '10'), 10),
    },
    general: {
      windowMs: 15 * 60 * 1000,
      max: parseInt(optionalEnv('GENERAL_RATE_LIMIT', '100'), 10),
    },
  },

  invitation: {
    expirationHours: parseInt(optionalEnv('INVITATION_EXPIRATION_HOURS', '48'), 10),
  },

  upload: {
    maxSizeBytes: parseInt(optionalEnv('MAX_UPLOAD_SIZE', '10485760'), 10), // 10MB
    maxAudioSizeBytes: parseInt(optionalEnv('MAX_AUDIO_UPLOAD_SIZE', '20971520'), 10), // 20MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ],
    allowedAudioMimeTypes: [
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/ogg',
      'audio/wav',
      'audio/aac',
      'audio/webm',
    ],
  },

  webrtc: {
    stunUrls: optionalEnv('STUN_URLS', 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302').split(','),
    turnUrl: optionalEnv('TURN_URL', ''),
    turnUsername: optionalEnv('TURN_USERNAME', ''),
    turnCredential: optionalEnv('TURN_CREDENTIAL', ''),
  },

  deepLink: {
    scheme: 'nexus',
  },
} as const;
