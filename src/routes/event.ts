import { Router } from 'express';
import {
  listEvents,
  getMyEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  joinEvent,
  leaveEvent,
  reactEvent,
  getParticipants,
  removeParticipant,
  getMessages,
  sendMessage
} from '../controllers/eventController';
import { authenticateToken, optionalAuth } from '../middleware/auth';

const router = Router();

// Browse events (exclude my hosted/joined); optional auth for exclusion
router.get('/', optionalAuth, listEvents);

// My events (hosting + joined)
router.get('/my', authenticateToken, getMyEvents);

// Get single event
router.get('/:id', optionalAuth, getEvent);

// Create event
router.post('/', authenticateToken, createEvent);

// Update event (organizer only)
router.put('/:id', authenticateToken, updateEvent);

// Delete event (organizer only)
router.delete('/:id', authenticateToken, deleteEvent);

// Join / leave
router.post('/:id/join', authenticateToken, joinEvent);
router.post('/:id/leave', authenticateToken, leaveEvent);

// Heart reaction
router.put('/:id/react', authenticateToken, reactEvent);

// Participants (public for display; remove requires auth + organizer)
router.get('/:id/participants', getParticipants);
router.delete('/:id/participants/:userId', authenticateToken, removeParticipant);

// Chat (only if joined)
router.get('/:id/messages', authenticateToken, getMessages);
router.post('/:id/messages', authenticateToken, sendMessage);

export default router;
