/**
 * Service for generating text embeddings using Google Gemini models (default: gemini-embedding-2).
 */

const VECTOR_DIMENSION = 768;

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
 * Generates an embedding vector for a single string using Gemini API (gemini-embedding-2).
 * Strictly outputs 768-dimensional normalized floating point vectors.
 * 
 * @param {string} text - Input text to embed.
 * @returns {Promise<number[]>} Array of 768 floating point vector numbers.
 */
export const generateEmbedding = async (text) => {
  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = process.env.LLM_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  const modelName = process.env.LLM_EMBEDDING_MODEL || 'gemini-embedding-2';
  const isTestOrMock = process.env.NODE_ENV === 'test' || apiKey === 'mock_key_for_dev' || (!apiKey && process.env.NODE_ENV !== 'production');

  // Dev/Test mode fallback when explicitly configured for mock/test execution
  if (isTestOrMock) {
    return generateMockVector(text);
  }

  try {
    const url = `${baseUrl}/models/${modelName}:embedContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${modelName}`,
        content: {
          parts: [{ text }],
        },
        outputDimensionality: VECTOR_DIMENSION,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Embedding Service Error] API call failed (${response.status}): ${errorText}`);
      throw new Error(`Embedding API call failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const values = data.embedding?.values;
    if (!values || !Array.isArray(values)) {
      throw new Error('Invalid embedding response format from Gemini API.');
    }

    if (values.length !== VECTOR_DIMENSION) {
      throw new Error(`Embedding dimension mismatch: expected ${VECTOR_DIMENSION}, got ${values.length}`);
    }

    return values;
  } catch (error) {
    console.error('[Embedding Service Error]: Live API call failed:', error.message);
    // Rethrow error so real API key failures are NOT silently hidden behind mock vectors
    throw error;
  }
};

/**
 * Generates embeddings for an array of text chunks.
 * 
 * @param {string[]} texts - Array of string chunks to embed.
 * @returns {Promise<Array<number[]>>} Array of embedding vectors.
 */
export const generateBatchEmbeddings = async (texts) => {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  // Process chunk embeddings sequentially / concurrently
  const embeddings = await Promise.all(
    texts.map((text) => generateEmbedding(text))
  );

  return embeddings;
};
