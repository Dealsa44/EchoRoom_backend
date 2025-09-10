import { Router } from 'express';
import {
  getChatRooms,
  getChatRoom,
  joinChatRoom,
  leaveChatRoom,
  getRoomMessages,
  sendMessage
} from '../controllers/chatController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();

// Public routes (can be accessed without authentication)
router.get('/rooms', optionalAuth, getChatRooms);
router.get('/rooms/:id', optionalAuth, getChatRoom);

// Protected routes (require authentication)
router.use(authenticateToken);

// Room membership
router.post('/rooms/:id/join', joinChatRoom);
router.post('/rooms/:id/leave', leaveChatRoom);

// Messages
router.get('/rooms/:id/messages', getRoomMessages);
router.post('/rooms/:id/messages', sendMessage);

export default router;
