# NEXUS

**Private communication. Nothing more.**

NEXUS is a completely private communication application designed for exactly two authorized users. Built with React Native + Expo on the frontend, Node.js + Express + Socket.IO on the backend, and PostgreSQL + Prisma for the database.

---

## Architecture

```
                    ┌───────────────────────┐
                    │   NEXUS MOBILE APP    │
                    │ React Native + Expo   │
                    │     TypeScript        │
                    └───────────┬───────────┘
                                │
                       HTTPS REST API
                                │
                         WebSocket / Socket.IO
                                │
                    ┌───────────▼───────────┐
                    │   NEXUS BACKEND       │
                    │ Node.js + TypeScript  │
                    │       Express         │
                    └───────┬───────┬───────┘
                            │       │
                 ┌──────────▼─┐   ┌─▼─────────────┐
                 │ PostgreSQL │   │ Private Cloud │
                 │ + Prisma   │   │ Image Storage │
                 └────────────┘   └───────────────┘
```

## Technology Stack

### Mobile
- React Native 0.73
- Expo SDK 50
- TypeScript
- Expo Router (file-based navigation)
- React Native Reanimated (animations)
- React Native Gesture Handler
- Zustand (state management)
- Socket.IO Client
- Expo SecureStore (secure token storage)
- Expo Notifications (push notifications)

### Backend
- Node.js
- TypeScript
- Express.js
- Socket.IO (WebSocket)
- Prisma ORM
- PostgreSQL
- Argon2 (password hashing)
- JWT (authentication tokens)
- Zod (validation)
- AWS S3-compatible cloud storage
- WebRTC signaling

### Multimedia
- Expo AV (audio recording/playback)
- Expo Camera (photo capture)
- Expo Image Picker (gallery access)
- WebRTC (voice/video calls)
- Real-time call signaling via Socket.IO

## Project Structure

```
nexus/
├── apps/
│   ├── mobile/          # React Native + Expo app
│   │   ├── src/
│   │   │   ├── app/         # Expo Router screens
│   │   │   │   ├── auth/    # Auth screens
│   │   │   │   ├── (app)/   # Main app screens
│   │   │   │   └── api/     # API routes
│   │   │   ├── components/  # UI components
│   │   │   ├── hooks/       # Custom hooks
│   │   │   ├── lib/         # Utilities, stores, API client
│   │   │   ├── types/       # TypeScript types
│   │   │   └── constants/   # Theme, constants
│   │   ├── app.config.ts    # Expo configuration
│   │   └── eas.json         # EAS Build configuration
│   └── server/          # Node.js + Express backend
│       ├── src/
│       │   ├── config/      # Configuration
│       │   ├── middleware/   # Auth, rate limiting
│       │   ├── routes/      # API routes
│       │   ├── services/    # Socket.IO, etc.
│       │   ├── lib/         # Prisma, crypto, storage, etc.
│       │   └── types/       # TypeScript types
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       └── tsconfig.json
├── packages/
│   └── shared/          # Shared TypeScript types
│       └── src/types/
├── .env.example
├── package.json
└── README.md
```

## Local Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)

### 1. Clone and Install

```bash
git clone <repository-url>
cd nexus
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE nexus;
```

### 3. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/nexus"
JWT_SECRET="generate-a-strong-random-secret"
STORAGE_ENDPOINT="your-s3-compatible-endpoint"
STORAGE_ACCESS_KEY="your-access-key"
STORAGE_SECRET_KEY="your-secret-key"
STORAGE_BUCKET="nexus-storage"
```

### 4. Run Migrations

```bash
cd apps/server
npx prisma migrate dev
npx prisma generate
```

### 5. Start Backend

```bash
npm run dev:server
```

The server starts at `http://localhost:3000`.

### 6. Start Mobile App

```bash
npm run dev:mobile
```

Scan the QR code with Expo Go on your phone.

## First-Time Setup

1. Open the app → tap "First time? Set up NEXUS"
2. Create the **owner** account
3. After setup, go to Home → "Generate Invitation"
4. Copy the invitation token
5. On the second device, tap "Have an invitation? Join NEXUS"
6. Paste the invitation token and create an account
7. The communication space is now locked to exactly two users

## PostgreSQL Setup

### Using Docker
```bash
docker run -d \
  --name nexus-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=nexus \
  -p 5432:5432 \
  postgres:15
```

### Using Managed Service
- **Render**: Create a PostgreSQL database at render.com
- **Supabase**: Create a project at supabase.com
- **Neon**: Create a database at neon.tech

Update `DATABASE_URL` in `.env` accordingly.

## Expo / EAS Setup

### Install EAS CLI
```bash
npm install -g eas-cli
```

### Login to Expo
```bash
eas login
```

### Configure Project
```bash
cd apps/mobile
eas build:configure
```

### Development Build
```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

### Preview Build (Internal Testing)
```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

### Production Build
```bash
eas build --profile production --platform ios
eas build --profile production --platform android
```

## Android Build

### APK (Testing)
```bash
eas build --profile preview --platform android
```

### AAB (Play Store)
```bash
eas build --profile production --platform android
```

## iOS Build

### TestFlight (Testing)
```bash
eas build --profile preview --platform ios
eas submit --platform ios
```

### App Store
```bash
eas build --profile production --platform ios
eas submit --platform ios
```

## Cloud Storage Configuration

NEXUS uses S3-compatible object storage for image attachments.

### Options
- **AWS S3**: Create a bucket, configure IAM credentials
- **DigitalOcean Spaces**: Create a space, get API keys
- **Backblaze B2**: Create a bucket, get application keys
- **MinIO** (self-hosted): Deploy MinIO server

### Required Environment Variables
```env
STORAGE_ENDPOINT=https://your-endpoint.amazonaws.com
STORAGE_ACCESS_KEY=your-key
STORAGE_SECRET_KEY=your-secret
STORAGE_BUCKET=nexus-storage
STORAGE_REGION=us-east-1
STORAGE_PUBLIC_URL=
```

## Push Notification Configuration

### Expo Push Notifications
1. Create an Expo account at expo.dev
2. Create a new project
3. Get your project ID and access token
4. Add to `.env`:

```env
EXPO_PROJECT_ID=your-project-id
EXPO_ACCESS_TOKEN=your-access-token
```

### Firebase (Android)
- Create a Firebase project
- Download `google-services.json`
- Place in `apps/mobile/android/app/`

### Apple Push Notifications (iOS)
- Configure in Apple Developer Console
- Add push notification entitlement to your app

## Invitation System

### How It Works
1. Owner creates an invitation token via the app
2. Token is cryptographically random (32 bytes)
3. Token is hashed before storage (SHA-256)
4. Token has configurable expiration (default 48 hours)
5. Token is single-use only
6. After the second user joins, invitations are permanently disabled

### Security
- Rate-limited validation (10 attempts per 15 minutes)
- Tokens never stored in plaintext
- Tokens never logged to server console
- Deep links use the `nexus://invite/<token>` scheme

## Security Features

### Authentication
- Argon2id password hashing (memory-hard)
- JWT tokens with session management
- Secure token storage (Expo SecureStore, never AsyncStorage)
- Session expiration and revocation
- Rate limiting on login (5 attempts per 15 minutes)

### Authorization
- Every API endpoint requires authentication
- User identity verified from JWT, never from client input
- Conversation membership verified for all operations
- Message operations require sender ownership

### Input Validation
- Zod schema validation on all endpoints
- SQL injection protection via Prisma ORM
- XSS prevention through output sanitization
- File type validation (MIME type + magic bytes)

### Infrastructure
- Helmet security headers
- CORS configuration
- Rate limiting (global + per-route)
- HTTPS-only in production
- Environment variables for all secrets
- No secrets committed to Git

## Audit Logging

The following events are logged:
- Login / Failed login
- Logout / Logout all
- Registration
- Password changes
- Invitation creation / use / revocation
- Profile updates
- Settings changes
- Avatar uploads
- Message operations
- Account deletion
- Device registration

## Testing

### Running Tests
```bash
cd apps/server
npm test
```

### Manual Testing Checklist

**User 1 (Owner)**
- [ ] Create owner account via first-time setup
- [ ] Generate invitation token
- [ ] Send messages
- [ ] Receive messages
- [ ] Edit messages
- [ ] Delete messages
- [ ] Send reactions
- [ ] Upload images
- [ ] Update profile
- [ ] Change settings
- [ ] View active sessions

**User 2 (Member)**
- [ ] Join via invitation token
- [ ] Send messages
- [ ] Receive messages
- [ ] Verify real-time delivery
- [ ] Verify read receipts
- [ ] Verify typing indicators
- [ ] Upload images

**Photo Messaging**
- [ ] Select photo from gallery
- [ ] Take photo with camera
- [ ] Preview before sending
- [ ] Send photo message
- [ ] Photo displayed in chat
- [ ] Tap to view full screen

**Voice Messages**
- [ ] Record voice message
- [ ] Preview before sending
- [ ] Send voice message
- [ ] Play received voice message
- [ ] Pause/play toggle
- [ ] Progress bar visible

**Voice Calls**
- [ ] Start voice call
- [ ] Incoming call notification
- [ ] Accept call
- [ ] Decline call
- [ ] Two-way audio works
- [ ] Mute/unmute
- [ ] Speaker toggle
- [ ] End call
- [ ] Call history recorded

**Video Calls**
- [ ] Start video call
- [ ] Incoming call notification
- [ ] Accept call
- [ ] Two-way video works
- [ ] Camera toggle
- [ ] Front/rear camera switch
- [ ] Mute/unmute
- [ ] End call
- [ ] Call history recorded

**Security Tests**
- [ ] Third user cannot join (space is full)
- [ ] Invalid invitation token rejected
- [ ] Expired invitation rejected
- [ ] Used invitation rejected
- [ ] Cannot access other user's data
- [ ] Cannot modify other user's messages
- [ ] Session revocation works
- [ ] Rate limiting works
- [ ] Password validation enforced

### Third User Test
1. Create a third account (should fail at registration)
2. Verify "Space full" error message
3. Verify no new invitations can be created

## Production Deployment

### Backend (Render/Railway/Fly.io)

1. Create a new service
2. Connect Git repository
3. Set environment variables
4. Configure build:
   - Build command: `cd apps/server && npm install && npx prisma generate`
   - Start command: `cd apps/server && node dist/index.js`
5. Run migrations on deploy

### Database (Managed PostgreSQL)
- Use a managed service (Render, Supabase, Neon)
- Enable SSL connections
- Configure connection pooling

### Mobile (Expo EAS)
1. Build with `eas build --profile production`
2. Submit to App Store / Play Store
3. Configure deep linking

## Deep Linking

### URL Scheme
```
nexus://invite/<token>
nexus://conversation/<id>
nexus://message/<conversationId>/<messageId>
```

### Universal Links (iOS)
Configure `apple-app-site-association` on your domain.

### App Links (Android)
Configure `assetlinks.json` on your domain.

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret key for JWT signing |
| `STORAGE_ENDPOINT` | Yes | S3-compatible storage endpoint |
| `STORAGE_ACCESS_KEY` | Yes | Storage access key |
| `STORAGE_SECRET_KEY` | Yes | Storage secret key |
| `STORAGE_BUCKET` | Yes | Storage bucket name |
| `EXPO_PROJECT_ID` | No | Expo project ID for push notifications |
| `EXPO_ACCESS_TOKEN` | No | Expo access token |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (default: development) |
| `JWT_EXPIRES_IN` | No | JWT expiry (default: 30d) |
| `SESSION_MAX_AGE_DAYS` | No | Session max age (default: 30) |
| `MAX_SESSIONS` | No | Max concurrent sessions (default: 5) |
| `INVITATION_EXPIRATION_HOURS` | No | Invitation TTL (default: 48) |
| `LOGIN_RATE_LIMIT` | No | Login rate limit (default: 5) |
| `MAX_UPLOAD_SIZE` | No | Max image upload size (default: 10MB) |
| `MAX_AUDIO_UPLOAD_SIZE` | No | Max audio upload size (default: 20MB) |
| `STUN_URLS` | No | Comma-separated STUN servers for WebRTC |
| `TURN_URL` | No | TURN server URL (optional) |
| `TURN_USERNAME` | No | TURN server username |
| `TURN_CREDENTIAL` | No | TURN server credential |
| `CORS_ORIGIN` | No | Allowed CORS origins |

## Troubleshooting

### Database Connection
```bash
# Test connection
psql $DATABASE_URL

# Reset migrations
cd apps/server
npx prisma migrate reset
npx prisma migrate dev
```

### Push Notifications Not Working
1. Verify `EXPO_PROJECT_ID` and `EXPO_ACCESS_TOKEN` are set
2. Check device has notification permissions
3. Ensure app is not in Do Not Disturb mode
4. Test with Expo push notification tool

### WebSocket Connection Issues
1. Ensure server is accessible over HTTPS in production
2. Check CORS configuration
3. Verify authentication token is valid
4. Check network connectivity

### Build Failures
```bash
# Clear Expo cache
cd apps/mobile
npx expo r -c

# Clear npm cache
npm cache clean --force
rm -rf node_modules
npm install
```

## License

Private. All rights reserved.

---

## Multimedia Features

### Photo Messaging
- Select images from phone gallery
- Take photos using device camera
- Preview images before sending
- Image compression and resizing
- Thumbnails for fast loading
- Full-screen image viewer
- Secure cloud storage with signed URLs

### Voice Messages
- Record audio directly in the app
- Microphone permission handling
- Recording waveform visualization
- Preview recording before sending
- Play/pause with progress bar
- Duration display
- Secure audio storage

### Voice Calls
- Real-time WebRTC audio
- Outgoing call screen with ringing
- Incoming call screen with accept/decline
- Call duration timer
- Mute/unmute microphone
- Speaker/earpiece toggle
- Call history in PostgreSQL
- STUN/TURN server support

### Video Calls
- Real-time WebRTC video
- Local camera preview
- Remote video display
- Camera enable/disable
- Front/rear camera switching
- Mute/unmute audio
- Call history recorded
- Network interruption handling

### Call Signaling
- Socket.IO-based call signaling
- WebRTC offer/answer exchange
- ICE candidate exchange
- Call state management
- Missed/declined call tracking
- Push notifications for incoming calls

---

**NEXUS** — Private communication. Nothing more.
