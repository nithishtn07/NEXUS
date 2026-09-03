import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

// S3-compatible cloud storage client (works with AWS S3, DigitalOcean Spaces, Backblaze B2, etc.)
const s3Client = new S3Client({
  endpoint: config.storage.endpoint,
  region: config.storage.region,
  credentials: {
    accessKeyId: config.storage.accessKey,
    secretAccessKey: config.storage.secretKey,
  },
  forcePathStyle: true,
});

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
  const command = new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    // Make object private by default - use signed URLs for access
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

export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function getSignedUploadUrl(
  key: string,
  mimeType: string,
  expiresIn: number = 300,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    ContentType: mimeType,
    ACL: 'private',
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
  });

  await s3Client.send(command);
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
