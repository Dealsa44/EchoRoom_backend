# Driftzo Backend

A Node.js/Express backend API for the Driftzo social platform.

## Features

- ✅ **Authentication System**
  - Email verification with 6-digit codes
  - JWT token-based authentication
  - Password hashing with bcrypt
  - User registration and login

- ✅ **User Management**
  - Complete user profiles
  - Profile updates
  - User search functionality

- ✅ **Chat System**
  - Chat room management
  - Real-time messaging (ready for WebSocket)
  - Room membership
  - Message history

- ✅ **Database**
  - PostgreSQL with Prisma ORM
  - Comprehensive data models
  - Relationships and constraints

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Email**: Resend
- **Validation**: Custom validation utilities

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Copy `env.example` to `.env` and fill in your values:

```bash
cp env.example .env
```



Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string (Supabase pooler URL with `?pgbouncer=true`)
- `DIRECT_URL` - Direct PostgreSQL URL (for Prisma migrations)
- `JWT_SECRET` - Random secret for JWT tokens
- `RESEND_API_KEY` - Resend API key ([resend.com/api-keys](https://resend.com/api-keys))
- `FRONTEND_URL` - Your frontend URL (for CORS)

### 3. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Prisma Studio
npm run db:studio
```

### 4. Email (Resend)
1. Sign up at [resend.com](https://resend.com)
2. Create an API key at [resend.com/api-keys](https://resend.com/api-keys)
3. Set `RESEND_API_KEY` in your `.env`. Optional: `RESEND_FROM` (default: `Driftzo <onboarding@resend.dev>`)

### 5. Run Development Server
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/send-verification-code` - Send email verification code
- `POST /api/auth/verify-email-code` - Verify email code
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user (protected)

### User Management
- `GET /api/user/profile` - Get user profile (protected)
- `PUT /api/user/profile` - Update user profile (protected)
- `GET /api/user/search` - Search users (protected)

### Chat System
- `GET /api/chat/rooms` - Get all chat rooms
- `GET /api/chat/rooms/:id` - Get specific chat room
- `POST /api/chat/rooms/:id/join` - Join chat room (protected)
- `POST /api/chat/rooms/:id/leave` - Leave chat room (protected)
- `GET /api/chat/rooms/:id/messages` - Get room messages (protected)
- `POST /api/chat/rooms/:id/messages` - Send message (protected)

## Deployment Options

### 1. Render + Supabase
- Backend on Render; database on Supabase (PostgreSQL)
- Set `DATABASE_URL`, `DIRECT_URL`, `RESEND_API_KEY`, `JWT_SECRET`, `FRONTEND_URL` in Render environment

### 2. Vercel
- Great for serverless functions
- Easy frontend integration

### 3. AWS/GCP/Azure
- Full control and scalability
- More complex setup

## Next Steps

1. **Deploy backend** to your chosen platform
2. **Update frontend** to use API endpoints instead of localStorage
3. **Add WebSocket** for real-time messaging
4. **Add file upload** for images and voice messages
5. **Add push notifications** for mobile app

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Database Schema

The database includes comprehensive models for:
- Users with detailed profiles
- Chat rooms and messages
- User languages and interests
- Email verification codes
- Room memberships

See `prisma/schema.prisma` for complete schema details.
