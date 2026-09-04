import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { config } from './config';
import { initializeSocket } from './services/socket';
import { generalRateLimit } from './middleware/rateLimit';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import invitationRoutes from './routes/invitations';
import conversationRoutes from './routes/conversations';
import messageRoutes from './routes/messages';
import attachmentRoutes from './routes/attachments';
import sessionRoutes from './routes/sessions';
import callRoutes from './routes/calls';

const app = express();
const server = http.createServer(app);

// ---- Middleware ----
app.use(helmet());
app.use(cors({
  origin: config.isProduction
    ? (config.cors.origin === '*' ? true : config.cors.origin.split(','))
    : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalRateLimit);

// ---- Health Check ----
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- API Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/calls', callRoutes);

// ---- Error Handling ----
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);

  if (err.message === 'Unsupported file type') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_FILE_TYPE', message: 'Unsupported file type' },
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' },
  });
});

// ---- 404 ----
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// ---- Initialize Socket.IO ----
const io = initializeSocket(server);

// ---- Start Server ----
server.listen(config.port, '0.0.0.0', () => {
  console.log(`NEXUS server running on port ${config.port} (0.0.0.0)`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`WebSocket: enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down...');
  io.close();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down...');
  io.close();
  server.close(() => {
    process.exit(0);
  });
});

export { app, server, io };
