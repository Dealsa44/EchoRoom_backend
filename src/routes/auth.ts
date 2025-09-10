import { Router } from 'express';
import {
  sendVerificationCode,
  verifyEmailCode,
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/send-verification-code', sendVerificationCode);
router.post('/verify-email-code', verifyEmailCode);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);

// Protected routes
router.get('/me', authenticateToken, getCurrentUser);

export default router;
