import { Router } from 'express';
import { getUserProfile, updateUserProfile, searchUsers, getDiscoverUsers, getPublicProfile } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

// User profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);

// Search routes
router.get('/search', searchUsers);

// Discover feed for Match page (compatible users only)
router.get('/discover', getDiscoverUsers);

// Public profile by id (must be after /profile and /search)
router.get('/:id', getPublicProfile);

export default router;
