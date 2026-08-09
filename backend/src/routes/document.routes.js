import express from 'express';
import { uploadSingleDocument } from '../middleware/upload.middleware.js';
import {
  uploadDocument,
  getDocuments,
  getDocument,
  deleteDocument,
} from '../controllers/document.controller.js';

const router = express.Router();

// Document Routes
router.post('/upload', uploadSingleDocument, uploadDocument);
router.get('/', getDocuments);
router.get('/:id', getDocument);
router.delete('/:id', deleteDocument);

export default router;
