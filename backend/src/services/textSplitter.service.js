/**
 * Text Splitter & Chunk Size Configuration Service
 * Provides configurable chunk sizes (256, 512, 1024 tokens) with overlap configuration
 * and boundary-aware sentence/word sliding windows.
 */

// Heuristic: ~4 characters per token for English text
export const CHARS_PER_TOKEN = 4;

export const CHUNK_PRESETS = {
  256: {
    tokens: 256,
    targetChars: 256 * CHARS_PER_TOKEN, // 1024 chars
    defaultOverlapTokens: 50,
    defaultOverlapChars: 50 * CHARS_PER_TOKEN, // 200 chars
  },
  512: {
    tokens: 512,
    targetChars: 512 * CHARS_PER_TOKEN, // 2048 chars
    defaultOverlapTokens: 100,
    defaultOverlapChars: 100 * CHARS_PER_TOKEN, // 400 chars
  },
  1024: {
    tokens: 1024,
    targetChars: 1024 * CHARS_PER_TOKEN, // 4096 chars
    defaultOverlapTokens: 200,
    defaultOverlapChars: 200 * CHARS_PER_TOKEN, // 800 chars
  },
};

export const DEFAULT_CHUNK_SIZE = 800; // characters
export const DEFAULT_CHUNK_OVERLAP = 150; // characters

/**
 * Estimates token count for a text string using standard ~4 chars/token heuristic.
 * 
 * @param {string} text - Input text
 * @returns {number} Estimated token count
 */
export const estimateTokenCount = (text) => {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.trim().length / CHARS_PER_TOKEN);
};

/**
 * Splits text into chunks of target chunkSize with overlap.
 * Preserves backwards compatibility for existing tests and pipelines.
 * 
 * @param {string} text - Raw document text to chunk.
 * @param {number} [chunkSize=800] - Maximum target characters per chunk.
 * @param {number} [overlap=150] - Overlapping characters between consecutive chunks.
 * @returns {Array<{ index: number, text: string, offsetStart: number, offsetEnd: number }>}
 */
export const chunkText = (text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Validate parameters to prevent infinite loops or invalid window sliding
  if (typeof chunkSize !== 'number' || chunkSize <= 0) {
    chunkSize = DEFAULT_CHUNK_SIZE;
  }
  if (typeof overlap !== 'number' || overlap < 0 || overlap >= chunkSize) {
    overlap = Math.floor(chunkSize * 0.2); // Default to 20% overlap if invalid or >= chunkSize
  }

  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return [];
  }

  // Short text under chunkSize fits in a single chunk
  if (trimmedText.length <= chunkSize) {
    return [{
      index: 0,
      text: trimmedText,
      offsetStart: 0,
      offsetEnd: trimmedText.length,
    }];
  }

  const chunks = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < trimmedText.length) {
    let end = start + chunkSize;

    // If not at the end of the text, look for a clean sentence or word boundary
    if (end < trimmedText.length) {
      const boundaryMatch = trimmedText.slice(start, end).search(/[\.\?\!\n](?=[^\.\?\!\n]*$)/);
      if (boundaryMatch > Math.floor(chunkSize * 0.5)) {
        end = start + boundaryMatch + 1;
      } else {
        const spaceMatch = trimmedText.slice(start, end).lastIndexOf(' ');
        if (spaceMatch > Math.floor(chunkSize * 0.5)) {
          end = start + spaceMatch;
        }
      }
    }

    const rawSlice = trimmedText.slice(start, end);
    const chunkContent = rawSlice.trim();
    if (chunkContent.length > 0) {
      const relativeStart = rawSlice.indexOf(chunkContent);
      const offsetStart = start + (relativeStart >= 0 ? relativeStart : 0);
      const offsetEnd = offsetStart + chunkContent.length;

      chunks.push({
        index: chunkIndex,
        text: chunkContent,
        offsetStart,
        offsetEnd,
      });
      chunkIndex++;
    }

    if (end >= trimmedText.length) {
      break;
    }
    // Slide window forward safely by chunkSize - overlap
    const nextStart = end - overlap;
    start = nextStart > start ? nextStart : start + 1;
  }

  return chunks;
};

/**
 * Splits document text using token-based configuration (256, 512, 1024 tokens)
 * with configurable overlap.
 * 
 * @param {string} text - Raw document text
 * @param {Object} [options]
 * @param {256|512|1024|number} [options.preset=512] - Token preset (256, 512, 1024)
 * @param {number} [options.chunkSizeTokens] - Custom chunk size in tokens (overrides preset)
 * @param {number} [options.overlapTokens] - Custom overlap in tokens (overrides preset default)
 * @returns {Array<{ index: number, text: string, tokenEstimate: number, offsetStart: number, offsetEnd: number }>}
 */
export const splitTextByTokens = (text, options = {}) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const { preset = 512, chunkSizeTokens, overlapTokens } = options;

  let targetTokens = chunkSizeTokens;
  let targetOverlapTokens = overlapTokens;

  if (!targetTokens) {
    const presetConfig = CHUNK_PRESETS[preset] || CHUNK_PRESETS[512];
    targetTokens = presetConfig.tokens;
    if (targetOverlapTokens === undefined) {
      targetOverlapTokens = presetConfig.defaultOverlapTokens;
    }
  } else if (targetOverlapTokens === undefined) {
    targetOverlapTokens = Math.floor(targetTokens * 0.2);
  }

  const targetChars = targetTokens * CHARS_PER_TOKEN;
  const targetOverlapChars = Math.min(targetOverlapTokens * CHARS_PER_TOKEN, Math.floor(targetChars * 0.5));

  const baseChunks = chunkText(text, targetChars, targetOverlapChars);

  return baseChunks.map((chunk) => ({
    ...chunk,
    tokenEstimate: estimateTokenCount(chunk.text),
  }));
};
