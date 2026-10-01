import { extractSearchTerms } from './advancedRetrieval.service.js';

/**
 * Post-Retrieval Reranking Service for DocuMind
 * Re-scores and re-orders candidate chunks using cross-matching, query coverage,
 * exact phrase boosts, and term proximity before passing context to the LLM.
 */

/**
 * Computes lexical density and term proximity bonus.
 * Measures how close query terms appear to each other in the candidate text.
 * 
 * @param {string} text - Chunk text
 * @param {string[]} queryTerms - Extracted search terms
 * @returns {number} Proximity bonus between 0.0 and 0.2
 */
export const calculateProximityScore = (text, queryTerms) => {
  if (!text || queryTerms.length < 2) return 0;
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);

  const positions = [];
  for (let i = 0; i < words.length; i++) {
    const cleanWord = words[i].replace(/[^\w]/g, '');
    if (queryTerms.includes(cleanWord)) {
      positions.push(i);
    }
  }

  if (positions.length < 2) return 0;

  // Find minimum span containing at least two distinct query terms
  let minSpan = Infinity;
  for (let i = 0; i < positions.length - 1; i++) {
    const span = positions[i + 1] - positions[i];
    if (span < minSpan) {
      minSpan = span;
    }
  }

  if (minSpan <= 5) return 0.2;
  if (minSpan <= 15) return 0.1;
  return 0.05;
};

/**
 * Reranks candidate chunks based on multi-factor cross-scoring.
 * 
 * @param {Object} params
 * @param {string} params.query - User query
 * @param {Array<Object>} params.chunks - Candidate chunks from initial retrieval
 * @param {number} [params.topK=3] - Target number of reranked chunks to return
 * @param {Object} [params.options={}] - Custom weighting configuration
 * @returns {Promise<Array<Object>>} Re-ordered top-K chunks with rerankScore
 */
export const rerankChunks = async ({
  query,
  chunks = [],
  topK = 3,
  options = {},
}) => {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return [];
  }

  if (!query || typeof query !== 'string' || !query.trim()) {
    return chunks.slice(0, Math.max(1, topK)).map((c, idx) => ({
      ...c,
      originalRank: idx,
      rerankScore: c.hybridScore || c.similarity || 0,
    }));
  }

  const cleanQuery = query.trim().toLowerCase();
  const queryTerms = extractSearchTerms(cleanQuery);

  const {
    baseWeight = 0.40,
    coverageWeight = 0.30,
    phraseWeight = 0.20,
    proximityWeight = 0.10,
    useLLM = false,
  } = options;

  // Optional LLM Reranking (when explicitly requested and not in test/mock mode)
  if (useLLM && process.env.NODE_ENV !== 'test' && process.env.LLM_API_KEY !== 'mock_key_for_dev') {
    try {
      const { generateAnswer } = await import('./ai.service.js');
      const candidatePreviews = chunks
        .map((c, i) => `[ID ${i}]: ${c.text.substring(0, 180)}...`)
        .join('\n');

      const prompt = `You are a relevance scoring engine.
Given the User Query and candidate document chunks, rank the candidates by relevance.
User Query: "${cleanQuery}"
Candidates:
${candidatePreviews}

Output the IDs of the top ${topK} most relevant chunks in order of relevance, separated by commas (e.g. 1, 0, 2):`;

      const llmOrder = await generateAnswer(prompt);
      const matchedIds = (llmOrder || '')
        .match(/\d+/g)
        ?.map(Number)
        .filter((id) => id >= 0 && id < chunks.length);

      if (matchedIds && matchedIds.length > 0) {
        const ordered = [];
        const seen = new Set();
        for (const id of matchedIds) {
          if (!seen.has(id)) {
            seen.add(id);
            ordered.push({
              ...chunks[id],
              originalRank: id,
              rerankScore: 1.0 - (ordered.length * 0.1),
            });
          }
        }
        for (let i = 0; i < chunks.length; i++) {
          if (!seen.has(i)) {
            ordered.push({
              ...chunks[i],
              originalRank: i,
              rerankScore: Math.max(0.1, 0.5 - (ordered.length * 0.05)),
            });
          }
        }
        return ordered.slice(0, Math.max(1, topK));
      }
    } catch (llmErr) {
      console.warn('[Reranker Service] LLM reranking failed, proceeding with deterministic cross-scoring:', llmErr.message);
    }
  }

  // High-performance deterministic Cross-Scoring
  const reranked = chunks.map((chunk, originalRank) => {
    const text = chunk.text || '';
    const lowerText = text.toLowerCase();

    // 1. Base Retrieval Score Retention
    const baseScore = typeof chunk.hybridScore === 'number'
      ? chunk.hybridScore
      : typeof chunk.similarity === 'number'
        ? chunk.similarity
        : 0.5;

    // 2. Query Term Coverage
    let coverageScore = 0;
    if (queryTerms.length > 0) {
      let matchedCount = 0;
      for (const term of queryTerms) {
        if (lowerText.includes(term)) {
          matchedCount++;
        }
      }
      coverageScore = matchedCount / queryTerms.length;
    }

    // 3. Exact Phrase Matching
    let phraseScore = 0;
    if (cleanQuery.length > 3 && lowerText.includes(cleanQuery)) {
      phraseScore = 1.0;
    } else if (queryTerms.length >= 2) {
      // Check 2-term subphrases
      const firstTwo = `${queryTerms[0]} ${queryTerms[1]}`;
      if (lowerText.includes(firstTwo)) {
        phraseScore = 0.5;
      }
    }

    // 4. Proximity / Clustering Score
    const proximityScore = calculateProximityScore(text, queryTerms) * 5; // normalize to 0..1

    // Combined Weighted Rerank Score
    const totalScore =
      (baseScore * baseWeight) +
      (coverageScore * coverageWeight) +
      (phraseScore * phraseWeight) +
      (proximityScore * proximityWeight);

    return {
      ...chunk,
      originalRank,
      rerankScore: Number(Math.min(totalScore, 1.0).toFixed(4)),
    };
  });

  // Sort descending by rerankScore
  reranked.sort((a, b) => b.rerankScore - a.rerankScore);

  return reranked.slice(0, Math.max(1, topK));
};
