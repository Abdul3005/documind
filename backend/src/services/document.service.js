import path from 'path';
import fs from 'fs';
import Document from '../models/Document.js';

/**
 * Service to manage Document operations
 */
export const createDocumentRecord = async (file) => {
  if (!file) {
    const error = new Error('No file uploaded.');
    error.statusCode = 400;
    throw error;
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const fileType = ext === '.pdf' ? 'pdf' : 'image';

  // Create Document record in MongoDB
  const document = await Document.create({
    filename: file.originalname,
    fileType,
    extractedText: 'Initial upload complete. Text extraction pending Phase 5 integration.',
    status: 'ready',
  });

  // Clean up uploaded temporary file from disk if extraction is complete or not needed on disk
  if (fs.existsSync(file.path)) {
    fs.unlink(file.path, (err) => {
      if (err) console.error(`[Upload Cleanup Error] Failed to delete temp file ${file.path}:`, err);
    });
  }

  return document;
};

export const getAllDocuments = async () => {
  return await Document.find().sort({ createdAt: -1 });
};

export const getDocumentById = async (id) => {
  const document = await Document.findById(id);
  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }
  return document;
};

export const deleteDocumentById = async (id) => {
  const document = await Document.findByIdAndDelete(id);
  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }
  return document;
};
