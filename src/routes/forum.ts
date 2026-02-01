import { Router } from 'express';
import {
  listPosts,
  getPostCount,
  createPost,
  getPost,
  reactPost,
  addComment,
  reactComment
} from '../controllers/forumController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();

// List posts (optional auth for future "liked" state on list)
router.get('/posts', listPosts);

// Get total post count (for community stats)
router.get('/posts/count', getPostCount);

// Get single post with comments (optional auth for "liked" state)
router.get('/posts/:id', optionalAuth, getPost);

// Create post (auth required)
router.post('/posts', authenticateToken, createPost);

// Toggle heart on post
router.put('/posts/:id/react', authenticateToken, reactPost);

// Add comment or reply (body: { content, parentId? })
router.post('/posts/:id/comments', authenticateToken, addComment);

// Toggle heart on comment
router.put('/comments/:id/react', authenticateToken, reactComment);

export default router;
