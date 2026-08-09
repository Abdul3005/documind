import express from 'express';
import {
  sendMessage,
  getMessages,
  summarizeDocument,
} from '../controllers/chat.controller.js';

const router = express.Router();

// Chat & Summary Routes
router.post('/:id/messages', sendMessage);
router.get('/:id/messages', getMessages);
router.post('/:id/summarize', summarizeDocument);

export default router;
