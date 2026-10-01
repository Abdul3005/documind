import mongoose from 'mongoose';
import Document from '../models/Document.js';
import { generateEmbedding } from './embedding.service.js';
import { cosineSimilarity } from './retrieval.service.js';

/**
 * Advanced Retrieval Service for DocuMind
 * Implements:
 * 1. LLM-based Query Expansion / Rewriting
 * 2. Hybrid Search (MongoDB Vector Search + Normalized Text Search with configurable weights)
 * 3. Strict Multi-Tenant Metadata Filtering (userId isolation & optional documentId)
 */

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 'could', 'did', 'do',
  'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out',
  'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
  'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Extracts normalized query search terms.
 * 
 * @param {string} text 
 * @returns {string[]}
 */
export const extractSearchTerms = (text) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
};

/**
 * LLM-assisted Query Expander & Rewriter
 * Resolves conversational pronouns and outputs optimized search terms.
 * Safe fallback in test and offline mode.
 * 
 * @param {Object} params
 * @param {string} params.query - Raw user query
 * @param {Array<{ role: string, content: string }>} [params.conversationHistory=[]] - Chat context
 * @returns {Promise<{ rewrittenQuery: string, originalQuery: string, expandedTerms: string[] }>}
 */
export const rewriteQuery = async ({ query, conversationHistory = [] }) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      rewrittenQuery: '',
      originalQuery: query || '',
      expandedTerms: [],
    };
  }

  const rawQuery = query.trim();
  const searchTerms = extractSearchTerms(rawQuery);

  // Coreference Resolution & Expansion Context
  let contextSnippet = '';
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-4);
    contextSnippet = recent
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join(' | ');
  }

  // Check if query contains conversational pronouns that need resolution
  const hasPronouns = /\b(it|its|they|them|this|that|these|those|the document|the report)\b/i.test(rawQuery);

  // If in test or mock environment, generate high-quality deterministic rewritten query
  const isMockOrTest =
    process.env.NODE_ENV === 'test' ||
    process.env.LLM_API_KEY === 'mock_key_for_dev' ||
    (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY);

  if (isMockOrTest) {
    let rewritten = rawQuery;
    if (hasPronouns && contextSnippet) {
      const contextTerms = extractSearchTerms(contextSnippet);
      const topContextTerms = contextTerms.slice(0, 3);
      if (topContextTerms.length > 0) {
        rewritten = `${rawQuery} (${topContextTerms.join(' ')})`;
      }
    }
    return {
      rewrittenQuery: rewritten,
      originalQuery: rawQuery,
      expandedTerms: [...new Set([...searchTerms, ...extractSearchTerms(rewritten)])],
    };
  }

  // Production LLM Query Expansion
  try {
    const { generateAnswer } = await import('./ai.service.js');
    const prompt = `You are a search query optimizer for a document retrieval system.
Given the user query and recent conversation context, produce an expanded, self-contained search query.
Resolve pronouns (it, this, they) using the context.
Do NOT answer the question. Output ONLY the optimized search query string.

Context: ${contextSnippet || 'None'}
User Query: ${rawQuery}
Optimized Search Query:`;

    const llmResult = await generateAnswer(prompt);
    const cleaned = (llmResult || '').replace(/^["']|["']$/g, '').trim();

    const finalRewritten = cleaned && cleaned.length > 0 && !cleaned.toLowerCase().includes('not contained')
      ? cleaned
      : rawQuery;

    return {
      rewrittenQuery: finalRewritten,
      originalQuery: rawQuery,
      expandedTerms: [...new Set([...searchTerms, ...extractSearchTerms(finalRewritten)])],
    };
  } catch (err) {
    console.warn('[Advanced Retrieval] Query rewrite LLM call failed, falling back to original query:', err.message);
    return {
      rewrittenQuery: rawQuery,
      originalQuery: rawQuery,
      expandedTerms: searchTerms,
    };
  }
};

/**
 * Calculates keyword / text matching relevance score for a chunk (0.0 to 1.0).
 * 
 * @param {string} chunkText 
 * @param {string} query 
 * @param {string[]} queryTerms 
 * @returns {number} Text score between 0.0 and 1.0
 */
export const calculateTextScore = (chunkText, query, queryTerms) => {
  if (!chunkText || typeof chunkText !== 'string') return 0;
  const lowerChunk = chunkText.toLowerCase();
  const lowerQuery = (query || '').toLowerCase().trim();

  let score = 0;

  // Exact phrase match bonus
  if (lowerQuery.length > 3 && lowerChunk.includes(lowerQuery)) {
    score += 0.5;
  }

  if (queryTerms.length === 0) {
    return Math.min(score, 1.0);
  }

  // Term occurrence & density
  let matchedTerms = 0;
  let totalOccurrences = 0;

  for (const term of queryTerms) {
    if (lowerChunk.includes(term)) {
      matchedTerms++;
      // Count frequency
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = lowerChunk.match(regex);
      totalOccurrences += matches ? matches.length : 1;
    }
  }

  // Coverage ratio (fraction of unique query terms found)
  const coverageRatio = matchedTerms / queryTerms.length;
  score += coverageRatio * 0.4;

  // Frequency bonus (capped at 0.1)
  const frequencyBonus = Math.min(totalOccurrences * 0.02, 0.1);
  score += frequencyBonus;

  return Math.min(Number(score.toFixed(4)), 1.0);
};

/**
 * Executes Hybrid Search combining Vector Search and Text Keyword Matching
 * with strict multi-tenant isolation.
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId - Authenticated User ID (MANDATORY)
 * @param {string|mongoose.Types.ObjectId} [params.documentId] - Optional document ID filter
 * @param {string} params.query - Search query
 * @param {number} [params.topK=5] - Number of candidate chunks to retrieve
 * @param {number} [params.vectorWeight=0.7] - Weight assigned to vector similarity (0.0 - 1.0)
 * @param {number} [params.textWeight=0.3] - Weight assigned to keyword text match (0.0 - 1.0)
 * @param {number} [params.minScore=0.0] - Minimum hybrid score cutoff
 * @param {boolean} [params.autoRewrite=false] - Whether to rewrite query before searching
 * @returns {Promise<Array<{ documentId: string, chunkIndex: number, text: string, vectorScore: number, textScore: number, hybridScore: number }>>}
 */
export const hybridSearch = async ({
  userId,
  documentId = null,
  query,
  topK = 5,
  vectorWeight = 0.7,
  textWeight = 0.3,
  minScore = 0.0,
  autoRewrite = false,
}) => {
  // 1. Strict Tenant Isolation & Input Validation
  if (!userId) {
    console.warn('[Advanced Retrieval] hybridSearch called without mandatory userId.');
    return [];
  }

  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  let searchQuery = query.trim();
  if (autoRewrite) {
    const rewriteRes = await rewriteQuery({ query: searchQuery });
    if (rewriteRes.rewrittenQuery) {
      searchQuery = rewriteRes.rewrittenQuery;
    }
  }

  const queryTerms = extractSearchTerms(searchQuery);

  // 2. Generate Query Vector Embedding (768 dimensions)
  const queryEmbedding = await generateEmbedding(searchQuery);

  // 3. Document Query Scoping
  const filter = { userId };
  if (documentId) {
    filter._id = documentId;
  }

  // Attempt Atlas $vectorSearch aggregation if running against Atlas with vector search index
  let candidates = [];
  let atlasSuccess = false;

  try {
    // Only attempt $vectorSearch if in Atlas or explicit configuration
    if (process.env.ATLAS_VECTOR_SEARCH_ENABLED === 'true') {
      const vectorPipeline = [
        {
          $vectorSearch: {
            index: process.env.ATLAS_VECTOR_INDEX_NAME || 'vector_index',
            path: 'chunks.embedding',
            queryVector: queryEmbedding,
            numCandidates: Math.max(topK * 10, 50),
            limit: Math.max(topK * 5, 20),
            filter: {
              userId: new mongoose.Types.ObjectId(userId),
              ...(documentId ? { _id: new mongoose.Types.ObjectId(documentId) } : {}),
            },
          },
        },
      ];

      const aggResults = await Document.aggregate(vectorPipeline);
      if (Array.isArray(aggResults) && aggResults.length > 0) {
        atlasSuccess = true;
        // Map Atlas results
        for (const doc of aggResults) {
          if (Array.isArray(doc.chunks)) {
            for (const chunk of doc.chunks) {
              const vectorSim = cosineSimilarity(queryEmbedding, chunk.embedding || []);
              candidates.push({
                documentId: doc._id.toString(),
                chunkIndex: chunk.index,
                text: chunk.text,
                vectorScore: Math.max(0, Number(vectorSim.toFixed(4))),
              });
            }
          }
        }
      }
    }
  } catch (err) {
    // MongoDB Atlas $vectorSearch not supported on local Mongo or MongoMemoryServer
    atlasSuccess = false;
  }

  // Fallback: Exact in-memory cosine similarity and chunk search across tenant documents
  if (!atlasSuccess) {
    const documents = await Document.find(filter).lean();
    if (!documents || documents.length === 0) {
      return [];
    }

    for (const doc of documents) {
      if (Array.isArray(doc.chunks)) {
        for (const chunk of doc.chunks) {
          if (Array.isArray(chunk.embedding) && chunk.embedding.length > 0) {
            const vectorSim = cosineSimilarity(queryEmbedding, chunk.embedding);
            candidates.push({
              documentId: doc._id.toString(),
              chunkIndex: chunk.index,
              text: chunk.text,
              vectorScore: Math.max(0, Number(vectorSim.toFixed(4))),
            });
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  // 4. Compute Text Score & Combine into Hybrid Score
  // Ensure weights are normalized so vectorWeight + textWeight = 1.0
  const totalWeight = (vectorWeight + textWeight) || 1.0;
  const normVecWeight = vectorWeight / totalWeight;
  const normTxtWeight = textWeight / totalWeight;

  const scoredResults = candidates.map((cand) => {
    const textScore = calculateTextScore(cand.text, searchQuery, queryTerms);
    const hybridScore = Number(
      ((cand.vectorScore * normVecWeight) + (textScore * normTxtWeight)).toFixed(4)
    );

    return {
      documentId: cand.documentId,
      chunkIndex: cand.chunkIndex,
      text: cand.text,
      vectorScore: cand.vectorScore,
      textScore,
      hybridScore,
    };
  });

  // 5. Sort Descending by Hybrid Score
  scoredResults.sort((a, b) => b.hybridScore - a.hybridScore);

  // 6. Filter by minScore threshold
  const filtered = minScore > 0
    ? scoredResults.filter((item) => item.hybridScore >= minScore)
    : scoredResults;

  // 7. Return Top-K chunks
  return filtered.slice(0, Math.max(1, topK));
};
