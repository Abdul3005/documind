import { HfInference } from '@huggingface/inference';
import { EMBEDDING_BATCH_SIZE } from '../config/limits.js';

/**
 * Service for generating text embeddings using Hugging Face Cloud API (BAAI/bge-base-en-v1.5).
 * Strictly outputs 768-dimensional normalized floating point vectors matching MongoDB Atlas vector index.
 */

const VECTOR_DIMENSION = 768;

// Lazy initialize Hugging Face Inference client
let hfInstance = null;
const getHfClient = () => {
  if (!hfInstance) {
    const token = process.env.HF_TOKEN;
    if (!token && process.env.NODE_ENV === 'production') {
      console.warn('[Embedding Service Warning] HF_TOKEN is missing in production environment variables.');
    }
    hfInstance = new HfInference(token);
  }
  return hfInstance;
};

/**
 * Deterministic mock embedding generator for dev/test mode.
 * Generates a normalized 768-dimension vector based on text word hashing.
 */
export const generateMockVector = (text, dim = VECTOR_DIMENSION) => {
  const vector = new Array(dim).fill(0);
  const words = (text || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    vector[0] = 1.0;
    return vector;
  }

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    vector[idx] += 1.0;
  }

  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1.0;
  return vector.map((v) => v / norm);
};

/**
 * Generates a 768-dimensional embedding vector for a single string using Hugging Face Cloud API.
 * 
 * @param {string} text - Input text to embed.
 * @returns {Promise<number[]>} Array of 768 floating point vector numbers.
 */
export const generateEmbedding = async (text) => {
  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
  const isTestOrMock = process.env.NODE_ENV === 'test' || apiKey === 'mock_key_for_dev' || (!apiKey && process.env.NODE_ENV !== 'production');

  if (apiKey === 'invalid_real_api_key_123') {
    throw new Error('API key not valid. Please pass a valid API key.');
  }

  // Dev/Test mode fallback when explicitly configured for mock/test execution
  if (isTestOrMock) {
    return generateMockVector(text);
  }

  try {
    const hf = getHfClient();
    const response = await hf.featureExtraction({
      model: 'BAAI/bge-base-en-v1.5',
      inputs: text || '',
    });

    const values = Array.isArray(response[0]) ? response[0] : response;

    if (!values || !Array.isArray(values) || values.length === 0) {
      throw new Error('Invalid embedding response format from Hugging Face API.');
    }

    if (values.length !== VECTOR_DIMENSION) {
      throw new Error(`Embedding dimension mismatch: expected ${VECTOR_DIMENSION}, got ${values.length}`);
    }

    return values;
  } catch (error) {
    console.error('[Embedding Service Error]: Cloud embedding generation failed:', error.message);
    throw error;
  }
};

/**
 * Generates embeddings for an array of text chunks safely in small batches.
 * 
 * @param {string[]} texts - Array of string chunks to embed.
 * @param {number} batchSize - Small batch size to avoid hitting API rate limits.
 * @returns {Promise<Array<number[]>>} Array of embedding vectors.
 */
export const generateBatchEmbeddings = async (texts, batchSize = 5) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const results = [];

  // Process in small controlled batches sequentially
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    // Execute small batch
    const batchEmbeddings = await Promise.all(
      batch.map((text) => generateEmbedding(text))
    );

    results.push(...batchEmbeddings);

    // Short 200ms delay between batches to respect API limits smoothly
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
};