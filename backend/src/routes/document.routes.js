import express from 'express';
import { uploadSingleDocument } from '../middleware/upload.middleware.js';
import { protect } from '../middleware/auth.middleware.js';
import { uploadRateLimiter } from '../middleware/rateLimit.middleware.js';
import {
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocument,
} from '../controllers/document.controller.js';

const router = express.Router();

// Protect all document management endpoints
router.use(protect);

// Document Routes
router.post('/upload', uploadRateLimiter, uploadSingleDocument, uploadDocument);
router.get('/', getDocuments);
router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);

export default router;
