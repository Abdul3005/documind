import path from 'path';
import fs from 'fs';
import Document from '../models/Document.js';
import Message from '../models/Message.js';
import { extractText } from './ocr.service.js';
import { chunkText } from './chunking.service.js';
import { generateBatchEmbeddings, generateMockVector } from './embedding.service.js';

/**
 * Service to process document upload, run OCR/PDF text extraction, chunking, RAG embeddings, and manage Document records scoped to a specific User.
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
    const { extractedText, extractionMethod } = await extractText(file.path, fileType);

    // 3. Chunk text and generate embeddings for RAG pipeline
    if (extractedText && extractedText.trim().length > 0) {
      console.log(`[Document Service] Chunking & generating embeddings for document ${document._id}...`);
      const rawChunks = chunkText(extractedText, 800, 150);
      if (rawChunks.length > 0) {
        const chunkTexts = rawChunks.map((c) => c.text);
        let embeddings = [];
        try {
          embeddings = await generateBatchEmbeddings(chunkTexts);
        } catch (embErr) {
          console.warn('[Document Service] Batch embedding generation warning, using fallback vectors:', embErr.message);
          embeddings = chunkTexts.map((text) => generateMockVector(text));
        }
        
        document.chunks = rawChunks.map((c, i) => ({
          index: c.index,
          text: c.text,
          embedding: embeddings[i] || generateMockVector(c.text),
        }));
      }
    }

    // 4. Update document record with extracted text, RAG chunks, extraction method, and status 'ready'
    document.extractedText = extractedText;
    document.extractionMethod = extractionMethod || (fileType === 'image' ? 'ocr' : 'text');
    document.status = 'ready';
    await document.save();

    console.log(`[Document Service] Extraction & embedding complete for document ${document._id}. Status set to ready.`);
    return document;
  } catch (extractionError) {
    console.error(`[Document Service Error] Processing failed for document ${document._id}:`, extractionError.message);
    
    // Mark status as failed in database
    document.status = 'failed';
    document.extractedText = `Extraction failed: ${extractionError.message}`;
    await document.save();

    const error = new Error(`Failed to extract text from document: ${extractionError.message}`);
    error.statusCode = 422;
    throw error;
  } finally {
    // 5. Delete temporary uploaded file from disk AFTER processing completes
    if (fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
        console.log(`[File Cleanup] Temp file deleted successfully: ${file.path}`);
      } catch (unlinkErr) {
        console.error(`[File Cleanup Error] Failed to delete temp file ${file.path}:`, unlinkErr.message);
      }
    }
  }
};

/**
 * Get all document records owned by a specific User (excluding heavy chunks/extractedText for list performance).
 */
export const getAllDocuments = async (userId) => {
  return await Document.find({ userId })
    .select('-extractedText -chunks')
    .sort({ createdAt: -1 });
};

/**
 * Get single document record by ID owned by a specific User.
 */
export const getDocumentById = async (id, userId) => {
  const document = await Document.findOne({ _id: id, userId });
  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }
  return document;
};

/**
 * Delete document record by ID owned by a specific User, and cascade delete associated messages.
 */
export const deleteDocumentById = async (id, userId) => {
  const document = await Document.findOneAndDelete({ _id: id, userId });
  if (!document) {
    const error = new Error('Document not found');
    error.statusCode = 404;
    throw error;
  }

  // Cascade deletion of messages owned by this user for this document
  await Message.deleteMany({ documentId: id, userId });
  return document;
};
