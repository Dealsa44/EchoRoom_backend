import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import chatRoutes from './routes/chat';

// Import email service
import GmailEmailService from './services/gmailEmailService';

// Load environment variables
dotenv.config();

// Initialize Prisma client
export const prisma = new PrismaClient();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Gmail service
const gmailService = new GmailEmailService();

// Middleware
app.use(helmet());

// CORS configuration to allow multiple origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:8081', // Your current development port
  'http://localhost:5173', // Default Vite port
  'http://localhost:3000', // Common React port
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});


// Gmail service test endpoint
app.get('/test-gmail-service', async (req, res) => {
  try {
    console.log('🧪 Testing Gmail service...');
    
    // Test Gmail connection
    const isConnected = await gmailService.verifyConnection();
    
    if (isConnected) {
      res.json({
        success: true,
        message: 'Gmail service is working correctly',
        emailUser: process.env.EMAIL_USER,
        emailHost: process.env.EMAIL_HOST || 'smtp.gmail.com',
        emailPort: process.env.EMAIL_PORT || '587'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Gmail service connection failed'
      });
    }
  } catch (error: any) {
    console.error('❌ Gmail service test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Gmail service test failed',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(err.errors).map((e: any) => e.message)
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  return res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EchoRoom Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
