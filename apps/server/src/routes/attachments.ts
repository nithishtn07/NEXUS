import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { uploadFile, getSignedDownloadUrl, generateStorageKey } from '../lib/storage';
import { createAuditLog, AuditActions } from '../lib/audit';
import { config } from '../config';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.upload.maxAudioSizeBytes, // Use the larger limit for audio
  },
  fileFilter: (_req, file, cb) => {
    const allAllowed: string[] = [...config.upload.allowedMimeTypes, ...config.upload.allowedAudioMimeTypes];
    if (allAllowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

// ---- POST /api/attachments/upload/:conversationId ----
router.post(
  '/upload/:conversationId',
  authenticate,
  upload.single('file'),
  async (req, res: Response): Promise<void> => {
    try {
      const { conversationId } = req.params;

      // Verify membership
      const membership = await prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId: req.user.id,
          },
        },
      });

      if (!membership) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not authorized' },
        });
        return;
      }

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' },
        });
        return;
      }

      const isAudio = (config.upload.allowedAudioMimeTypes as readonly string[]).includes(req.file.mimetype);

      if (isAudio) {
        // Audio upload - store as-is (no processing needed)
        const tempMessageId = `temp-${Date.now()}`;
        const storageKey = generateStorageKey(req.user.id, tempMessageId, req.file.originalname || 'audio.m4a');
        await uploadFile(req.file.buffer, storageKey, req.file.mimetype);
        const url = await getSignedDownloadUrl(storageKey, 3600);

        const duration = parseFloat(req.body.duration || '0');

        res.json({
          success: true,
          data: {
            storageKey,
            mimeType: req.file.mimetype,
            fileSize: req.file.buffer.length,
            width: null,
            height: null,
            thumbnailKey: null,
            duration,
            url,
            isAudio: true,
          },
        });
        return;
      }

      // Validate image MIME type from actual file content
      const metadata = await sharp(req.file.buffer).metadata();
      if (!metadata.format || !['jpeg', 'png', 'webp', 'gif'].includes(metadata.format)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_FILE', message: 'Unsupported image format' },
        });
        return;
      }

      const mimeType = `image/${metadata.format === 'jpg' ? 'jpeg' : metadata.format}`;

      // Process image - resize for optimal storage
      let processedBuffer = req.file.buffer;
      if (metadata.width && metadata.width > 1920) {
        processedBuffer = await sharp(req.file.buffer)
          .resize(1920, null, { withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
      }

      // Create thumbnail
      let thumbnailKey: string | undefined;
      try {
        const thumbnailBuffer = await sharp(req.file.buffer)
          .resize(200, 200, { fit: 'cover' })
          .jpeg({ quality: 60 })
          .toBuffer();

        const thumbKey = generateStorageKey(req.user.id, 'thumb', 'thumb.jpg');
        await uploadFile(thumbnailBuffer, thumbKey, 'image/jpeg');
        thumbnailKey = thumbKey;
      } catch {
        // Thumbnail creation is best effort
      }

      // Upload main image
      const tempMessageId = `temp-${Date.now()}`;
      const storageKey = generateStorageKey(req.user.id, tempMessageId, req.file.originalname);
      await uploadFile(processedBuffer, storageKey, mimeType);

      // Get signed URL
      const url = await getSignedDownloadUrl(storageKey, 3600);

      await createAuditLog({
        userId: req.user.id,
        action: AuditActions.ATTACHMENT_UPLOAD,
        metadata: { conversationId, mimeType, fileSize: processedBuffer.length },
      });

      res.json({
        success: true,
        data: {
          storageKey,
          mimeType,
          fileSize: processedBuffer.length,
          width: metadata.width || null,
          height: metadata.height || null,
          thumbnailKey,
          duration: null,
          url,
          isAudio: false,
        },
      });
    } catch (error) {
      console.error('Upload attachment error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'UPLOAD_FAILED', message: 'Failed to upload file' },
      });
    }
  },
);

// ---- GET /api/attachments/:id/url ----
router.get('/:id/url', authenticate, async (req, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        message: {
          include: {
            conversation: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Attachment not found' },
      });
      return;
    }

    // Verify user is member of the conversation
    const isMember = attachment.message.conversation.members.some(
      (m: any) => m.userId === req.user.id,
    );

    if (!isMember) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized' },
      });
      return;
    }

    const url = await getSignedDownloadUrl(attachment.storageKey, 3600);

    res.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    console.error('Get attachment URL error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
    });
  }
});

export default router;
