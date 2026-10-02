import Document from '../models/Document.js';
import Message from '../models/Message.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateAnswer, generateSummary, generateOverviewAnswer, UNGROUNDED_RESPONSE } from '../services/ai.service.js';
import { retrieveRelevantChunks } from '../services/retrieval.service.js';
import { rewriteQuery, hybridSearch } from '../services/advancedRetrieval.service.js';
import { rerankChunks } from '../services/reranker.service.js';

/**
 * Deterministic helper to detect broad document-overview queries.
 * Normalizes case, punctuation, and whitespace.
 * Conservative: only matches document-level overview intents.
 */
export const isDocumentOverviewQuery = (query) => {
  if (!query || typeof query !== 'string') return false;
  const clean = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const overviewPatterns = [
    /^(what is in (this|the) document)$/,
    /^(what (is|does) (this|the) document (about|contain|discuss|cover|covering))$/,
    /^(what are the (main|key) (topics|themes) in (this|the) document)$/,
    /^(main (topics|themes) in (this|the) document)$/,
    /^((give me an? |provide an? )?overview of (this|the) document)$/,
    /^((can you |please )?summarize (this|the) document)$/,
    /^(document (overview|summary))$/,
    /^(what does (this|the) document say)$/,
  ];

  return overviewPatterns.some((pattern) => pattern.test(clean));
};

/**
 * @desc    Send question to document, execute RAG vector search, get AI answer & store in chat history
 * @route   POST /api/documents/:id/messages
 * @access  Private
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, user ID missing.',
    });
  }

  const { id } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Message content is required.',
    });
  }

  // 1. Find document owned by authenticated user
  const document = await Document.findOne({ _id: id, userId });
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found.',
    });
  }

  // 2. Fetch last 6 messages for context owned by authenticated user
  const previousMessages = await Message.find({ documentId: id, userId })
    .sort({ createdAt: -1 })
    .limit(6);
  
  // Sort chronologically for prompt builder
  const conversationHistory = previousMessages.reverse();

  let assistantResponse;
  let sources = [];

  const isOverview = isDocumentOverviewQuery(content);

  if (isOverview) {
    // Dedicated Document-Overview Path:
    // Bypasses chunk similarity threshold check while keeping context strictly document-scoped.
    if (!document.extractedText || !document.extractedText.trim()) {
      assistantResponse = UNGROUNDED_RESPONSE;
      sources = [];
    } else {
      let overviewContext = '';
      if (document.summary && typeof document.summary === 'string' && document.summary.trim()) {
        overviewContext = `Document Summary:\n${document.summary.trim()}`;
      } else {
        const rawText = document.extractedText.trim();
        overviewContext = rawText.length > 6000 ? rawText.substring(0, 6000) + '...' : rawText;
      }

      try {
        assistantResponse = await generateOverviewAnswer({
          documentText: overviewContext,
          conversationHistory,
          question: content.trim(),
        });
      } catch (overviewErr) {
        console.warn('[Chat Controller Warning] Overview generation failed:', overviewErr.message);
        assistantResponse = UNGROUNDED_RESPONSE;
      }

      const isUngrounded =
        !assistantResponse ||
        assistantResponse.trim() === UNGROUNDED_RESPONSE ||
        assistantResponse.trim().toLowerCase().includes('not contained in the provided document');

      if (isUngrounded) {
        sources = [];
      } else {
        sources = document.chunks && document.chunks.length > 0
          ? [
              {
                chunkIndex: document.chunks[0].index ?? 0,
                similarity: 1.0,
                text: (document.chunks[0].text || overviewContext).substring(0, 300),
              },
            ]
          : [
              {
                chunkIndex: 0,
                similarity: 1.0,
                text: overviewContext.substring(0, 300),
              },
            ];
      }
    }
  } else {
    // 3. Advanced RAG Retrieval: Query Rewriting -> Hybrid Retrieval -> Multi-Signal Reranking
    let retrievedChunks = [];
    try {
      const trimmedQuestion = content.trim();
      const { rewrittenQuery } = await rewriteQuery({
        query: trimmedQuestion,
        conversationHistory,
      });
      const effectiveQuery = (rewrittenQuery && rewrittenQuery.trim().length > 0)
        ? rewrittenQuery.trim()
        : trimmedQuestion;

      const hybridCandidates = await hybridSearch({
        userId,
        documentId: id,
        query: effectiveQuery,
        topK: 5,
        vectorWeight: 0.7,
        textWeight: 0.3,
      });

      if (hybridCandidates && hybridCandidates.length > 0) {
        const reranked = await rerankChunks({
          query: effectiveQuery,
          chunks: hybridCandidates,
          topK: 3,
        });

        retrievedChunks = reranked.map((c) => ({
          chunkIndex: c.chunkIndex,
          text: c.text,
          similarity: typeof c.rerankScore === 'number'
            ? c.rerankScore
            : (typeof c.hybridScore === 'number' ? c.hybridScore : (c.similarity ?? 0)),
          rerankScore: c.rerankScore,
          hybridScore: c.hybridScore,
        }));
      }
    } catch (advancedRagError) {
      console.warn('[Chat Controller Warning] Advanced RAG pipeline failed, falling back to baseline retrieval:', advancedRagError.message);
      // Safe fallback to baseline retrieval
      retrievedChunks = await retrieveRelevantChunks({
        documentId: id,
        userId,
        question: content.trim(),
        topK: 3,
      });
    }

    const RAG_MIN_RELEVANCE_THRESHOLD = parseFloat(process.env.RAG_MIN_RELEVANCE_THRESHOLD || '0.15');
    const maxSimilarity = retrievedChunks.length > 0
      ? Math.max(...retrievedChunks.map((c) => (typeof c.similarity === 'number' ? c.similarity : 0)))
      : 0;

    // Retrieval Check Logic:
    // If vector search returns 0 chunks or all retrieved chunks fall below the minimum relevance threshold,
    // DO NOT call the LLM to generate an open-ended answer.
    if (retrievedChunks.length === 0 || maxSimilarity < RAG_MIN_RELEVANCE_THRESHOLD) {
      assistantResponse = UNGROUNDED_RESPONSE;
      sources = [];
    } else {
      // 4. Generate grounded AI response using retrieved chunks context
      assistantResponse = await generateAnswer({
        retrievedChunks,
        documentText: document.extractedText,
        conversationHistory,
        question: content.trim(),
      });

      // Guardrail: if assistant response indicates information is not in document, do not attach citation badges
      const isUngrounded =
        !assistantResponse ||
        assistantResponse.trim() === UNGROUNDED_RESPONSE ||
        assistantResponse.trim().toLowerCase().includes('not contained in the provided document');

      if (isUngrounded) {
        sources = [];
      } else {
        sources = retrievedChunks.map((c) => ({
          chunkIndex: c.chunkIndex,
          similarity: c.similarity,
          text: c.text ? c.text.substring(0, 300) : '',
        }));
      }
    }
  }

  // 5. Save User Message with userId
  const userMessage = await Message.create({
    documentId: id,
    userId,
    role: 'user',
    content: content.trim(),
  });

  // 6. Save Assistant Message with userId and source citation metadata
  const assistantMessage = await Message.create({
    documentId: id,
    userId,
    role: 'assistant',
    content: assistantResponse,
    sources,
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
  const userId = req.user?._id || req.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, user ID missing.',
    });
  }

  const { id } = req.params;

  const document = await Document.findOne({ _id: id, userId });
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found.',
    });
  }

  const messages = await Message.find({ documentId: id, userId }).sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    count: messages.length,
    messages: messages.map((msg) => ({
      id: msg._id,
      role: msg.role,
      content: msg.content,
      sources: msg.sources || [],
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
  const userId = req.user?._id || req.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, user ID missing.',
    });
  }

  const { id } = req.params;

  const document = await Document.findOne({ _id: id, userId });
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

/**
 * @desc    Clear all chat messages for a document owned by authenticated user
 * @route   DELETE /api/documents/:id/messages
 * @access  Private
 */
export const clearMessages = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.userId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized, user ID missing.',
    });
  }

  const { id } = req.params;

  const document = await Document.findOne({ _id: id, userId });
  if (!document) {
    return res.status(404).json({
      success: false,
      error: 'Document not found.',
    });
  }

  await Message.deleteMany({ documentId: id, userId });

  res.status(200).json({
    success: true,
    message: 'Chat history cleared successfully.',
  });
});
