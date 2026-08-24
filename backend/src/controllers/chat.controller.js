import Document from '../models/Document.js';
import Message from '../models/Message.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateAnswer, generateSummary } from '../services/ai.service.js';

/**
 * @desc    Send question to document, get AI answer & store in chat history
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

  // 3. Generate grounded AI response
  const assistantResponse = await generateAnswer({
    documentText: document.extractedText,
    conversationHistory,
    question: content.trim(),
  });

  // 4. Save User Message with userId
  const userMessage = await Message.create({
    documentId: id,
    userId: req.userId,
    role: 'user',
    content: content.trim(),
  });

  // 5. Save Assistant Message with userId
  const assistantMessage = await Message.create({
    documentId: id,
    userId: req.userId,
    role: 'assistant',
    content: assistantResponse,
  });

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
    messages: messages.map((m) => ({
      id: m._id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
});

/**
 * @desc    Generate summary for document owned by authenticated user
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

  // If document already has a summary, return cached summary
  if (document.summary) {
    return res.status(200).json({
      success: true,
      summary: document.summary,
      cached: true,
    });
  }

  const summary = await generateSummary({ documentText: document.extractedText });

  document.summary = summary;
  await document.save();

  res.status(200).json({
    success: true,
    summary: document.summary,
    cached: false,
  });
});
