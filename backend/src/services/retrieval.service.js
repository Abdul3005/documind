import Document from '../models/Document.js';
import { generateEmbedding } from './embedding.service.js';

/**
 * Calculates Cosine Similarity between two numerical vector arrays.
 * Formula: (A • B) / (||A|| * ||B||)
 * 
 * @param {number[]} vecA - Vector A
 * @param {number[]} vecB - Vector B
 * @returns {number} Cosine similarity score between -1.0 and 1.0.
 */
export const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const DEFAULT_MIN_RELEVANCE_THRESHOLD = 0.15;

/**
 * Retrieves the Top-K most relevant document chunks for a question.
 * Strictly scoped to documentId and userId to prevent cross-user data exposure.
 * Utilizes exact in-memory Cosine Similarity ranking over the document's embedded chunks.
 * 
 * @param {Object} options
 * @param {string} options.documentId - Target document ID.
 * @param {string} options.userId - Authenticated user ID.
 * @param {string} options.question - User query.
 * @param {number} [options.topK=3] - Number of top chunks to retrieve.
 * @param {number} [options.minScore=0.0] - Minimum similarity threshold cutoff.
 * @returns {Promise<Array<{ chunkIndex: number, text: string, similarity: number }>>} Ranked chunks.
 */
export const retrieveRelevantChunks = async ({
  documentId,
  userId,
  question,
  topK = 3,
  minScore = 0.0,
}) => {
  if (!documentId || !userId || !question || !question.trim()) {
    return [];
  }

  // 1. Ownership validation: Find document scoped to authenticated userId
  const document = await Document.findOne({ _id: documentId, userId });
  if (!document || !document.chunks || document.chunks.length === 0) {
    return [];
  }

  // 2. Generate embedding vector for the query
  const queryEmbedding = await generateEmbedding(question.trim());

  // 3. Exact In-Memory Cosine Similarity Ranking across document chunks
  const scoredChunks = document.chunks
    .filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length > 0)
    .map((chunk) => {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        chunkIndex: chunk.index,
        text: chunk.text,
        similarity: Number(similarity.toFixed(4)),
      };
    });

  // Sort descending by similarity score
  scoredChunks.sort((a, b) => b.similarity - a.similarity);

  // 4. Enforce minimum similarity threshold cutoff when specified
  const filteredChunks = minScore > 0
    ? scoredChunks.filter((chunk) => chunk.similarity >= minScore)
    : scoredChunks;

  // Return Top-K chunks
  return filteredChunks.slice(0, Math.max(1, topK));
};
