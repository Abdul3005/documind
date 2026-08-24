import path from 'path';
import fs from 'fs';
import Document from '../models/Document.js';
import Message from '../models/Message.js';
import { extractText } from './ocr.service.js';

/**
 * Service to process document upload, run OCR/PDF text extraction, and manage Document records scoped to a specific User.
 */
export const createDocumentRecord = async (file, userId) => {
  if (!file) {
    const error = new Error('No file uploaded.');
    error.statusCode = 400;
    throw error;
  }

  if (!userId) {
    const error = new Error('User ID is required.');
    error.statusCode = 401;
    throw error;
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const fileType = ext === '.pdf' ? 'pdf' : 'image';

  // 1. Create Document record in MongoDB with status 'processing' owned by userId
  let document = await Document.create({
    userId,
    filename: file.originalname,
    fileType,
    extractedText: 'Processing document text...',
    status: 'processing',
  });

  try {
    // 2. Perform PDF parsing or Image OCR extraction from file on disk
    console.log(`[Document Service] Extracting text for document ${document._id} (${file.originalname}) for user ${userId}...`);
    const extractedContent = await extractText(file.path, fileType);

    // 3. Update document record with extracted text and status 'ready'
    document.extractedText = extractedContent;
    document.status = 'ready';
    await document.save();

    console.log(`[Document Service] Extraction complete for document ${document._id}. Status set to ready.`);
    return document;
  } catch (extractionError) {
    console.error(`[Document Service Error] Extraction failed for document ${document._id}:`, extractionError.message);
    
    // Mark status as failed in database
    document.status = 'failed';
    document.extractedText = `Extraction failed: ${extractionError.message}`;
    await document.save();

    const error = new Error(`Failed to extract text from document: ${extractionError.message}`);
    error.statusCode = 422;
    throw error;
  } finally {
    // 4. Delete temporary uploaded file from disk AFTER extraction completes
    if (fs.existsSync(file.path)) {
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error(`[File Cleanup Error] Failed to delete temp file ${file.path}:`, err);
        } else {
          console.log(`[File Cleanup] Temp file deleted successfully: ${file.path}`);
        }
      });
    }
  }
};

export const getAllDocuments = async (userId) => {
  return await Document.find({ userId }).sort({ createdAt: -1 });
};

export const getDocumentById = async (id, userId) => {
  const document = await Document.findOne({ _id: id, userId });
  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }
  return document;
};

export const deleteDocumentById = async (id, userId) => {
  const document = await Document.findOneAndDelete({ _id: id, userId });
  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  // Cascade delete all messages associated with this document and user
  await Message.deleteMany({ documentId: id, userId });

  return document;
};
