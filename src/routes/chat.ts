import { Router } from 'express';
import {
  createRoom,
  getJoinableCount,
  getChatRooms,
  getChatRoom,
  joinChatRoom,
  leaveChatRoom,
  kickMember,
  deleteRoom,
  getRoomMessages,
  sendMessage,
  updateRoom,
  setRoomTheme,
  setRoomArchived,
  clearRoomChat,
  deleteMessageForMe,
  addMessageReaction,
  listMyRooms,
} from '../controllers/chatController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Order: specific paths before :id
router.get('/rooms/joinable-count', getJoinableCount);
router.get('/rooms/my', listMyRooms);
router.post('/rooms', createRoom);
router.get('/rooms', getChatRooms);
router.get('/rooms/:id', getChatRoom);
router.post('/rooms/:id/join', joinChatRoom);
router.post('/rooms/:id/leave', leaveChatRoom);
router.post('/rooms/:id/kick/:userId', kickMember);
router.delete('/rooms/:id', deleteRoom);
router.get('/rooms/:id/messages', getRoomMessages);
router.post('/rooms/:id/messages', sendMessage);
router.patch('/rooms/:id', updateRoom);
router.put('/rooms/:id/theme', setRoomTheme);
router.put('/rooms/:id/archive', setRoomArchived);
router.post('/rooms/:id/clear', clearRoomChat);
router.delete('/rooms/:id/messages/:messageId', deleteMessageForMe);
router.put('/rooms/:id/messages/:messageId/react', addMessageReaction);

export default router;
