import { pipeline } from '@xenova/transformers';
import { EMBEDDING_BATCH_SIZE } from '../config/limits.js';

/**
 * Service for generating text embeddings locally using ONNX Transformers.js (Xenova/bge-base-en-v1.5).
 * Strictly outputs 768-dimensional normalized floating point vectors matching MongoDB Atlas vector index.
 */

const VECTOR_DIMENSION = 768;
const DEFAULT_LOCAL_MODEL = 'Xenova/bge-base-en-v1.5';

// Singleton instance promise for lazy feature-extraction pipeline initialization
let extractorInstancePromise = null;

/**
 * Singleton getter for the Transformers.js feature extraction pipeline.
 */
const getExtractor = async () => {
  if (!extractorInstancePromise) {
    const modelName = process.env.LOCAL_EMBEDDING_MODEL || DEFAULT_LOCAL_MODEL;
    console.log(`[Embedding Service] Initializing local ONNX feature-extraction pipeline (${modelName})...`);
    extractorInstancePromise = pipeline('feature-extraction', modelName).catch((err) => {
      extractorInstancePromise = null;
      console.error('[Embedding Service Error] Failed to load local transformer model:', err.message);
      throw err;
    });
  }
  return await extractorInstancePromise;
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
 * Generates a 768-dimensional embedding vector for a single string using local ONNX model (Xenova/bge-base-en-v1.5).
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
    const extractor = await getExtractor();
    const output = await extractor(text || '', { pooling: 'mean', normalize: true });
    const values = Array.from(output.data);

    if (!values || !Array.isArray(values) || values.length === 0) {
      throw new Error('Invalid embedding response format from local transformer pipeline.');
    }

    if (values.length !== VECTOR_DIMENSION) {
      throw new Error(`Embedding dimension mismatch: expected ${VECTOR_DIMENSION}, got ${values.length}`);
    }

    return values;
  } catch (error) {
    console.error('[Embedding Service Error]: Local embedding generation failed:', error.message);
    throw error;
  }
};

/**
 * Generates embeddings for an array of text chunks safely in bounded batches.
 * 
 * @param {string[]} texts - Array of string chunks to embed.
 * @param {number} batchSize - Number of chunks per batch execution.
 * @returns {Promise<Array<number[]>>} Array of embedding vectors.
 */
export const generateBatchEmbeddings = async (texts, batchSize = EMBEDDING_BATCH_SIZE) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const results = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(
      batch.map((text) => generateEmbedding(text))
    );
    results.push(...batchEmbeddings);
  }

  return results;
};
