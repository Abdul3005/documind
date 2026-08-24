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

/**
 * Retrieves the Top-K most relevant document chunks for a question.
 * Strictly scoped to documentId and userId to prevent cross-user data exposure.
 * Supports MongoDB Atlas $vectorSearch with in-memory Cosine Similarity fallback.
 * 
 * @param {Object} options
 * @param {string} options.documentId - Target document ID.
 * @param {string} options.userId - Authenticated user ID.
 * @param {string} options.question - User query.
 * @param {number} [options.topK=3] - Number of top chunks to retrieve.
 * @returns {Promise<Array<{ chunkIndex: number, text: string, similarity: number }>>} Ranked chunks.
 */
export const retrieveRelevantChunks = async ({ documentId, userId, question, topK = 3 }) => {
  if (!documentId || !userId || !question) {
    return [];
  }

  // 1. Ownership validation: Find document scoped to authenticated userId
  const document = await Document.findOne({ _id: documentId, userId });
  if (!document || !document.chunks || document.chunks.length === 0) {
    return [];
  }

  // 2. Generate embedding vector for the query
  const queryEmbedding = await generateEmbedding(question);

  // 3. Attempt Atlas $vectorSearch if running on Atlas with search index configured
  try {
    if (process.env.USE_ATLAS_VECTOR_SEARCH === 'true') {
      const pipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'chunks.embedding',
            queryVector: queryEmbedding,
            numCandidates: 20,
            limit: topK,
            filter: {
              _id: document._id,
              userId: document.userId,
            },
          },
        },
        {
          $project: {
            chunks: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];
      const results = await Document.aggregate(pipeline);
      if (results && results.length > 0 && results[0].chunks) {
        return results[0].chunks.slice(0, topK).map((c) => ({
          chunkIndex: c.index,
          text: c.text,
          similarity: results[0].score || 1.0,
        }));
      }
    }
  } catch (atlasErr) {
    console.warn('[Retrieval Service] Atlas $vectorSearch unavailable, using in-memory cosine fallback:', atlasErr.message);
  }

  // 4. In-Memory Cosine Similarity Fallback
  const scoredChunks = document.chunks.map((chunk) => {
    const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
    return {
      chunkIndex: chunk.index,
      text: chunk.text,
      similarity: Number(similarity.toFixed(4)),
    };
  });

  // Sort descending by similarity score
  scoredChunks.sort((a, b) => b.similarity - a.similarity);

  // Return Top-K chunks
  return scoredChunks.slice(0, topK);
};
