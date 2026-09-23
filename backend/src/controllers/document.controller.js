import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createDocumentRecord,
  getAllDocuments,
  getDocumentById,
  deleteDocumentById,
} from '../services/document.service.js';

/**
 * @desc    Upload document file and create record
 * @route   POST /api/documents/upload
 * @access  Private
 */
export const uploadDocument = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, user ID missing.',
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'Please select a file to upload (PDF, JPG, JPEG, or PNG).',
    });
  }

  const document = await createDocumentRecord(req.file, userId);

  res.status(201).json({
    success: true,
    document: {
      id: document._id,
      filename: document.filename,
      fileType: document.fileType,
      status: document.status,
      extractionMethod: document.extractionMethod,
      extractedText: document.extractedText,
      createdAt: document.createdAt,
    },
  });
});

/**
 * @desc    Get list of all documents owned by authenticated user
 * @route   GET /api/documents
 * @access  Private
 */
export const getDocuments = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, user ID missing.',
    });
  }

  const documents = await getAllDocuments(userId);
  res.status(200).json({
    success: true,
    count: documents.length,
    documents: documents.map((doc) => ({
      id: doc._id,
      filename: doc.filename,
      fileType: doc.fileType,
      status: doc.status,
      extractionMethod: doc.extractionMethod,
      createdAt: doc.createdAt,
    })),
  });
});

/**
 * @desc    Get single document details owned by authenticated user
 * @route   GET /api/documents/:id
 * @access  Private
 */
export const getDocument = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, user ID missing.',
    });
  }

  const document = await getDocumentById(req.params.id, userId);
  res.status(200).json({
    success: true,
    document: {
      id: document._id,
      filename: document.filename,
      fileType: document.fileType,
      status: document.status,
      extractionMethod: document.extractionMethod,
      extractedText: document.extractedText,
      summary: document.summary,
      createdAt: document.createdAt,
    },
  });
});

/**
 * @desc    Delete document by ID owned by authenticated user
 * @route   DELETE /api/documents/:id
 * @access  Private
 */
export const deleteDocument = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, user ID missing.',
    });
  }

  await deleteDocumentById(req.params.id, userId);
  res.status(200).json({
    success: true,
    message: 'Document deleted successfully',
  });
});
