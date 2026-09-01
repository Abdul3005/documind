/**
 * Service for splitting document text into overlapping chunks for RAG embedding.
 */

const DEFAULT_CHUNK_SIZE = 800; // characters
const DEFAULT_CHUNK_OVERLAP = 150; // characters

/**
 * Splits text into chunks of target chunkSize with overlap.
 * 
 * @param {string} text - Raw document text to chunk.
 * @param {number} chunkSize - Maximum target characters per chunk (default 800).
 * @param {number} overlap - Overlapping characters between consecutive chunks (default 150).
 * @returns {Array<{ index: number, text: string }>} Array of chunk objects.
 */
export const chunkText = (text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const trimmedText = text.trim();
  if (trimmedText.length === 0) {
    return [];
  }

  // Short text under chunkSize fits in a single chunk
  if (trimmedText.length <= chunkSize) {
    return [{ index: 0, text: trimmedText }];
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

    const chunkContent = trimmedText.slice(start, end).trim();
    if (chunkContent.length > 0) {
      chunks.push({
        index: chunkIndex,
        text: chunkContent,
      });
      chunkIndex++;
    }

    if (end >= trimmedText.length) {
      break;
    }
    // Slide window forward by chunkSize - overlap
    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
};
