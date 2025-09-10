import { Router } from 'express';
import { getUserProfile, updateUserProfile, searchUsers } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

// User profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);

// Search routes
router.get('/search', searchUsers);

export default router;
