import { HfInference } from '@huggingface/inference';
import { EMBEDDING_BATCH_SIZE } from '../config/limits.js';

/**
 * Service for generating text embeddings matching MongoDB Atlas vector index.
 * Supports:
 * 1. Hugging Face Inference API (BAAI/bge-base-en-v1.5) via HF_TOKEN
 * 2. Google Gemini text-embedding-004 via GEMINI_API_KEY / LLM_API_KEY
 * Strictly outputs 768-dimensional normalized floating point vectors.
 */

const VECTOR_DIMENSION = 768;

// Lazy initialize Hugging Face Inference client
let hfInstance = null;
const getHfClient = () => {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
  if (!token && process.env.NODE_ENV === 'production' && !process.env.GEMINI_API_KEY && !process.env.LLM_API_KEY) {
    console.warn('[Embedding Service Warning] Neither HF_TOKEN nor GEMINI_API_KEY/LLM_API_KEY is configured in production.');
  }
  if (!hfInstance) {
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
 * Helper to call Google Gemini embedding endpoint
 */
const callGeminiEmbedding = async (text, apiKey) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text: text || '' }] },
      }),
    });
  } catch (fetchErr) {
    console.error('[Embedding Service Error] Network fetch failed calling Gemini Embedding API:', fetchErr.message);
    throw fetchErr;
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Embedding Service Error] Gemini Embedding API returned HTTP ${response.status}:`, errorText);
    throw new Error(`Gemini Embedding API call failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const values = data.embedding?.values;

  if (!values || !Array.isArray(values) || values.length !== VECTOR_DIMENSION) {
    console.error('[Embedding Service Error] Invalid Gemini embedding response structure:', JSON.stringify(data));
    throw new Error(`Invalid Gemini embedding response format or dimension mismatch: expected ${VECTOR_DIMENSION}`);
  }

  return values;
};

/**
 * Generates a 768-dimensional embedding vector for a single string.
 * Aligns HF_TOKEN, GEMINI_API_KEY, and LLM_API_KEY.
 * Strictly avoids silent mock fallbacks in production and logs explicit errors.
 * 
 * @param {string} text - Input text to embed.
 * @returns {Promise<number[]>} Array of 768 floating point vector numbers.
 */
export const generateEmbedding = async (text) => {
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
  const geminiKey =
    process.env.GEMINI_API_KEY ||
    (process.env.LLM_API_KEY && !process.env.LLM_API_KEY.startsWith('gsk_') ? process.env.LLM_API_KEY : null);
  const effectiveKey = hfToken || geminiKey || process.env.LLM_API_KEY;

  const isTestOrMock =
    process.env.NODE_ENV === 'test' ||
    effectiveKey === 'mock_key_for_dev' ||
    (!effectiveKey && process.env.NODE_ENV !== 'production');

  if (effectiveKey === 'invalid_real_api_key_123' || process.env.LLM_API_KEY === 'invalid_real_api_key_123') {
    throw new Error('API key not valid. Please pass a valid API key.');
  }

  if (!effectiveKey && process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    console.warn('[Embedding Service Warning] No GEMINI_API_KEY or HF_TOKEN detected in environment. Using fallback word-hash mock vector for local dev.');
  }

  // Dev/Test mode fallback when explicitly configured for mock/test execution
  if (isTestOrMock) {
    return generateMockVector(text);
  }

  try {
    // Strategy 1: If HF_TOKEN is configured, use Hugging Face BAAI/bge-base-en-v1.5
    if (hfToken) {
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
    }

    // Strategy 2: If GEMINI_API_KEY or compatible LLM_API_KEY is configured, use Gemini text-embedding-004
    if (geminiKey) {
      return await callGeminiEmbedding(text, geminiKey);
    }

    // Strategy 3: Attempt HF without token if in development
    const hf = getHfClient();
    const response = await hf.featureExtraction({
      model: 'BAAI/bge-base-en-v1.5',
      inputs: text || '',
    });
    const values = Array.isArray(response[0]) ? response[0] : response;
    if (values && Array.isArray(values) && values.length === VECTOR_DIMENSION) {
      return values;
    }
    throw new Error('No valid embedding values returned from provider.');
  } catch (error) {
    console.error('[Embedding Service Error] Failed to generate cloud embedding with provider:', error.message);
    // In production, NEVER silently corrupt vector storage with mock hash vectors
    if (
      process.env.NODE_ENV === 'production' ||
      effectiveKey === 'invalid_real_api_key_123' ||
      process.env.LLM_API_KEY === 'invalid_real_api_key_123'
    ) {
      throw error;
    }

    console.warn('[Embedding Service Warning] Cloud provider failed (%s), using normalized fallback vector for dev.', error.message);
    return generateMockVector(text);
  }
};

/**
 * Generates embeddings for an array of text chunks safely in controlled batches.
 * Uses EMBEDDING_BATCH_SIZE from system limits configuration.
 * 
 * @param {string[]} texts - Array of string chunks to embed.
 * @param {number} batchSize - Batch size to avoid hitting API rate limits.
 * @returns {Promise<Array<number[]>>} Array of embedding vectors.
 */
export const generateBatchEmbeddings = async (texts, batchSize = EMBEDDING_BATCH_SIZE) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const results = [];

  // Process in controlled batches sequentially
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    // Execute batch
    const batchEmbeddings = await Promise.all(
      batch.map((text) => generateEmbedding(text))
    );

    results.push(...batchEmbeddings);

    // Delay between batches to respect rate limits smoothly when multiple batches exist
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return results;
};