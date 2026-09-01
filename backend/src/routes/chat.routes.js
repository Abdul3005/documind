import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  sendMessage,
  getMessages,
  summarizeDocument,
} from '../controllers/chat.controller.js';

const router = express.Router();

// Protect all chat & summary endpoints
router.use(protect);

// Chat & Summary Routes
router.post('/:id/messages', sendMessage);
router.get('/:id/messages', getMessages);
router.post('/:id/summarize', summarizeDocument);

export default router;
