import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config';

// Detect if valid S3 credentials are provided
const isS3Configured = Boolean(
  config.storage.endpoint &&
  config.storage.accessKey &&
  config.storage.secretKey &&
  !config.storage.endpoint.includes('your-region') &&
  !config.storage.accessKey.includes('your-access-key')
);

const s3Client = isS3Configured
  ? new S3Client({
      endpoint: config.storage.endpoint,
      region: config.storage.region,
      credentials: {
        accessKeyId: config.storage.accessKey,
        secretAccessKey: config.storage.secretKey,
      },
      forcePathStyle: true,
    })
  : null;

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!isS3Configured && !fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export async function uploadFile(
  buffer: Buffer,
  key: string,
  mimeType: string,
): Promise<UploadResult> {
  if (s3Client) {
    const command = new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ACL: 'private',
    });
    await s3Client.send(command);

    return {
      key,
      url: config.storage.publicUrl
        ? `${config.storage.publicUrl}/${key}`
        : key,
      size: buffer.length,
    };
  }

  // Fallback to local storage
  const filePath = path.join(UPLOADS_DIR, key.replace(/\//g, '_'));
  await fs.promises.writeFile(filePath, buffer);

  return {
    key,
    url: `/api/attachments/raw/${encodeURIComponent(key)}`,
    size: buffer.length,
  };
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (s3Client) {
    const command = new GetObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
  }

  // Fallback URL for local file
  return `/api/attachments/raw/${encodeURIComponent(key)}`;
}

export async function getSignedUploadUrl(
  key: string,
  mimeType: string,
  expiresIn: number = 300,
): Promise<string> {
  if (s3Client) {
    const command = new PutObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      ContentType: mimeType,
      ACL: 'private',
    });
    return getSignedUrl(s3Client, command, { expiresIn });
  }

  return `/api/attachments/upload-raw`;
}

export async function deleteFile(key: string): Promise<void> {
  if (s3Client) {
    const command = new DeleteObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
    });
    await s3Client.send(command);
    return;
  }

  const filePath = path.join(UPLOADS_DIR, key.replace(/\//g, '_'));
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}

export function getLocalFilePath(key: string): string | null {
  const filePath = path.join(UPLOADS_DIR, key.replace(/\//g, '_'));
  return fs.existsSync(filePath) ? filePath : null;
}

export function generateStorageKey(
  userId: string,
  messageId: string,
  filename: string,
): string {
  const timestamp = Date.now();
  const ext = filename.split('.').pop() || 'jpg';
  return `nexus/attachments/${userId}/${messageId}/${timestamp}-${crypto.randomUUID()}.${ext}`;
}
