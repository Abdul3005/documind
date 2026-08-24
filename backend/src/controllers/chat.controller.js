import Document from '../models/Document.js';
import Message from '../models/Message.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateAnswer, generateSummary } from '../services/ai.service.js';
import { retrieveRelevantChunks } from '../services/retrieval.service.js';

/**
 * @desc    Send question to document, execute RAG vector search, get AI answer & store in chat history
 * @route   POST /api/documents/:id/messages
 * @access  Private
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Message content is required.',
    });
  }

  // 1. Find document owned by authenticated user
  const document = await Document.findOne({ _id: id, userId: req.userId });
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found.',
    });
  }

  // 2. Fetch last 6 messages for context owned by authenticated user
  const previousMessages = await Message.find({ documentId: id, userId: req.userId })
    .sort({ createdAt: -1 })
    .limit(6);
  
  // Sort chronologically for prompt builder
  const conversationHistory = previousMessages.reverse();

  // 3. Vector search / RAG retrieval of Top-K relevant chunks scoped to documentId and userId
  const retrievedChunks = await retrieveRelevantChunks({
    documentId: id,
    userId: req.userId,
    question: content.trim(),
    topK: 3,
  });

  // 4. Generate grounded AI response using retrieved chunks context
  const assistantResponse = await generateAnswer({
    retrievedChunks,
    documentText: document.extractedText,
    conversationHistory,
    question: content.trim(),
  });

  // 5. Save User Message with userId
  const userMessage = await Message.create({
    documentId: id,
    userId: req.userId,
    role: 'user',
    content: content.trim(),
  });

  // 6. Save Assistant Message with userId
  const assistantMessage = await Message.create({
    documentId: id,
    userId: req.userId,
    role: 'assistant',
    content: assistantResponse,
  });

  // Format source citation metadata
  const sources = retrievedChunks.map((c) => ({
    chunkIndex: c.chunkIndex,
    similarity: c.similarity,
  }));

  res.status(201).json({
    success: true,
    userMessage: {
      id: userMessage._id,
      role: userMessage.role,
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    },
    assistantMessage: {
      id: assistantMessage._id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      sources,
      createdAt: assistantMessage.createdAt,
    },
  });
});

/**
 * @desc    Get all chat messages for a document owned by authenticated user
 * @route   GET /api/documents/:id/messages
 * @access  Private
 */
export const getMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const document = await Document.findOne({ _id: id, userId: req.userId });
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found.',
    });
  }

  const messages = await Message.find({ documentId: id, userId: req.userId }).sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    count: messages.length,
    messages: messages.map((msg) => ({
      id: msg._id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    })),
  });
});

/**
 * @desc    Summarize a document owned by authenticated user
 * @route   POST /api/documents/:id/summarize
 * @access  Private
 */
export const summarizeDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const document = await Document.findOne({ _id: id, userId: req.userId });
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found.',
    });
  }

  // If document already has a generated summary, return cached summary
  if (document.summary) {
    return res.status(200).json({
      success: true,
      summary: document.summary,
      cached: true,
    });
  }

  // Generate new summary
  const summaryText = await generateSummary({
    documentText: document.extractedText,
  });

  // Save summary to document
  document.summary = summaryText;
  await document.save();

  res.status(200).json({
    success: true,
    summary: summaryText,
    cached: false,
  });
});
