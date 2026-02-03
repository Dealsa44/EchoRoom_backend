import { Router } from 'express';
import {
  listConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  setArchived,
  setConversationTheme,
  deleteConversation,
  reactToMessage,
} from '../controllers/conversationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', listConversations);
router.get('/with/:userId', getOrCreateConversation);
router.get('/:conversationId/messages', getMessages);
router.post('/:conversationId/messages', sendMessage);
router.patch('/:conversationId/archive', setArchived);
router.patch('/:conversationId/theme', setConversationTheme);
router.delete('/:conversationId', deleteConversation);
router.put('/messages/:messageId/react', reactToMessage);

export default router;
