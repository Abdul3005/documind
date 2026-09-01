/**
 * AI Service for DocuMind
 * Handles:
 * - Grounded RAG prompt construction
 * - Context truncation
 * - RAG Q&A generation
 * - Document summarization
 *
 * Powered locally by Ollama.
 * Default model: qwen2.5:1.5b
 *
 * NOTE:
 * The deleted ml_training/ directory is NOT required by this service.
 */

// -----------------------------------------------------------------------------
// Context / generation limits
// -----------------------------------------------------------------------------

// Maximum context for normal RAG fallback.
// ~6,000–8,000 tokens depending on document content.
const MAX_CONTEXT_CHARS = 24000;

// Summary uses a smaller bounded context because summarization sends
// document content directly to the LLM.
const MAX_SUMMARY_CHARS = 10000;

// Keep summary output short so the small local model does not spend
// excessive time generating unnecessary text.
const SUMMARY_MAX_TOKENS = 300;

// -----------------------------------------------------------------------------
// RAG Prompt
// -----------------------------------------------------------------------------

/**
 * Builds a grounded prompt using:
 * - retrieved document chunks
 * - document text fallback
 * - conversation history
 * - user question
 */
export const buildPrompt = ({
  retrievedChunks = [],
  documentText = '',
  conversationHistory = [],
  question,
}) => {
  let contextContent = '';

  // Prefer retrieved chunks when available.
  if (Array.isArray(retrievedChunks) && retrievedChunks.length > 0) {
    contextContent = retrievedChunks
      .map((c) => `[Chunk #${c.chunkIndex}]:\n${c.text}`)
      .join('\n\n');
  } else {
    // Fallback to document text, but keep the existing context safety limit.
    let truncatedText = documentText || '';

    if (truncatedText.length > MAX_CONTEXT_CHARS) {
      truncatedText =
        truncatedText.slice(0, MAX_CONTEXT_CHARS) +
        '\n[Note: Document text was truncated.]';
    }

    contextContent =
      truncatedText || 'No document context available.';
  }

  const historyText =
    Array.isArray(conversationHistory) &&
      conversationHistory.length > 0
      ? conversationHistory
        .map(
          (m) =>
            `${String(m.role || '').toUpperCase()}: ${m.content || ''}`
        )
        .join('\n')
      : 'None';

  return `You are an AI assistant for DocuMind answering questions strictly based on the retrieved document context provided below.

If the retrieved context does not contain enough information to answer the question, state clearly:

"The document does not provide enough information to answer this question."

Do not invent, assume, or use outside facts.

<<<CONTEXT>>>
${contextContent}
<<<END CONTEXT>>>

CONVERSATION SO FAR:
${historyText}

QUESTION:
${question}`;
};

// -----------------------------------------------------------------------------
// Summary Prompt
// -----------------------------------------------------------------------------

/**
 * Creates a compact summary context.
 *
 * For large documents we do NOT send the entire document to the small
 * local LLM. Instead we preserve:
 * - beginning
 * - middle
 * - ending
 *
 * This keeps summary generation fast while representing more of the
 * document than simply taking the first N characters.
 */
export const buildSummaryPrompt = (documentText) => {
  const text = documentText || '';

  let summaryText = text;

  if (text.length > MAX_SUMMARY_CHARS) {
    const sectionSize = Math.floor(MAX_SUMMARY_CHARS / 3);

    const beginning = text.slice(0, sectionSize);

    const middleStart = Math.floor(
      (text.length - sectionSize) / 2
    );

    const middle = text.slice(
      middleStart,
      middleStart + sectionSize
    );

    const ending = text.slice(-sectionSize);

    summaryText = [
      '[BEGINNING OF DOCUMENT]',
      beginning,
      '[MIDDLE OF DOCUMENT]',
      middle,
      '[END OF DOCUMENT]',
      ending,
    ].join('\n\n');
  }

  return `You are DocuMind's document summarization assistant.

Summarize ONLY the information contained in the document below.

Requirements:
- Be concise.
- Use clear bullet points.
- Identify the main topic.
- Include important facts, names, dates, numbers, findings, and conclusions when present.
- Do not invent or assume information.
- Do not use outside knowledge.
- Do not mention information that is not present in the document.
- If the document is partially extracted, summarize only the available content.
- Keep the summary reasonably short.

DOCUMENT:
<<<DOCUMENT>>
${summaryText}
<<<END DOCUMENT>>

SUMMARY:`;
};

// -----------------------------------------------------------------------------
// Mock fallback for tests / development
// -----------------------------------------------------------------------------

/**
 * Mock fallback generator for:
 * - NODE_ENV=test
 * - LLM_API_KEY=mock_key_for_dev
 * - non-production environments without an API key
 */
const generateMockDevResponse = (
  documentText,
  question,
  isSummary = false
) => {
  if (isSummary) {
    return `Document Summary:
- Key Content: ${(documentText || '').slice(0, 150)}...
- Summary generated successfully grounded in document text.`;
  }

  const lowerDoc = (documentText || '').toLowerCase();
  const lowerQ = (question || '').toLowerCase();

  const stopWords = [
    'what',
    'where',
    'when',
    'which',
    'who',
    'how',
    'does',
    'this',
    'that',
    'with',
    'from',
    'about',
    'have',
    'is',
    'are',
    'the',
    'a',
    'an',
    'in',
    'on',
    'at',
  ];

  const words = lowerQ
    .replace(/[^\w\s]/gi, '')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !stopWords.includes(w)
    );

  const matches = words.filter((word) =>
    lowerDoc.includes(word)
  );

  if (matches.length > 0) {
    const lines = documentText
      .split('\n')
      .filter((l) => l.trim().length > 0);

    const matchingLine =
      lines.find((line) =>
        words.some((w) =>
          line.toLowerCase().includes(w)
        )
      ) || lines[0];

    return `Based on the document provided: ${matchingLine.trim()}`;
  }

  return 'The requested information is not contained in the provided document.';
};

// -----------------------------------------------------------------------------
// Ollama
// -----------------------------------------------------------------------------

/**
 * Calls the local Ollama LLM endpoint.
 *
 * Default:
 * http://localhost:11434/api/generate
 */
const callOllama = async (
  prompt,
  ollamaOptions = {}
) => {
  const ollamaBaseUrl =
    process.env.OLLAMA_BASE_URL ||
    (
      process.env.LLM_API_BASE_URL?.includes('localhost')
        ? process.env.LLM_API_BASE_URL
        : 'http://localhost:11434'
    );

  const modelName =
    process.env.OLLAMA_MODEL ||
    (
      process.env.LLM_MODEL_NAME?.includes('qwen')
        ? process.env.LLM_MODEL_NAME
        : 'qwen2.5:1.5b'
    );

  const cleanBaseUrl = ollamaBaseUrl
    .replace(/\/v1\/?$/, '')
    .replace(/\/+$/, '');

  const url = `${cleanBaseUrl}/api/generate`;

  try {
    const response = await fetch(url, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      // Keep the reliability protection.
      // A request must not hang forever.
      signal: AbortSignal.timeout(60000),

      body: JSON.stringify({
        model: modelName,
        prompt,

        // Summary and RAG requests both need a complete response
        // before the API returns.
        stream: false,

        options: {
          temperature: 0.2,

          // Allow individual operations such as summarization
          // to provide their own generation limits.
          ...ollamaOptions,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `Ollama API Call Failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();

    const answer = data.response;

    if (!answer || typeof answer !== 'string') {
      throw new Error(
        'Invalid or empty response from local Ollama LLM model.'
      );
    }

    return answer.trim();
  } catch (error) {
    if (
      error.name === 'AbortError' ||
      error.name === 'TimeoutError'
    ) {
      console.error(
        '[AI Service Error] Ollama request timed out after 60s'
      );

      throw new Error(
        'LLM request timed out. Please try again.'
      );
    }

    console.error(
      '[AI Service Error] Local Ollama call failed:',
      error.message
    );

    throw error;
  }
};

// -----------------------------------------------------------------------------
// Main LLM dispatcher
// -----------------------------------------------------------------------------

/**
 * Main LLM caller.
 *
 * Supports:
 * - local Ollama in production/runtime
 * - mock responses in tests/dev
 */
const callLLMAPI = async (
  prompt,
  documentText,
  question = '',
  isSummary = false,
  ollamaOptions = {}
) => {
  const apiKey = process.env.LLM_API_KEY;

  const isTestOrMock =
    process.env.NODE_ENV === 'test' ||
    apiKey === 'mock_key_for_dev' ||
    (
      !apiKey &&
      process.env.NODE_ENV !== 'production'
    );

  // Keep test/dev behavior unchanged.
  if (isTestOrMock) {
    return generateMockDevResponse(
      documentText,
      question,
      isSummary
    );
  }

  return await callOllama(
    prompt,
    ollamaOptions
  );
};

// -----------------------------------------------------------------------------
// RAG Answer
// -----------------------------------------------------------------------------

/**
 * Generate an answer grounded in retrieved document chunks.
 */
export const generateAnswer = async ({
  retrievedChunks = [],
  documentText = '',
  conversationHistory = [],
  question,
}) => {
  const prompt = buildPrompt({
    retrievedChunks,
    documentText,
    conversationHistory,
    question,
  });

  const contextForFallback =
    Array.isArray(retrievedChunks) &&
      retrievedChunks.length > 0
      ? retrievedChunks
        .map((c) => c.text)
        .join('\n')
      : documentText;

  return await callLLMAPI(
    prompt,
    contextForFallback,
    question,
    false
  );
};

// -----------------------------------------------------------------------------
// Document Summary
// -----------------------------------------------------------------------------

/**
 * Generate a concise document summary.
 *
 * Summary-specific optimizations:
 * - bounded document context
 * - beginning/middle/end sampling for large documents
 * - maximum 300 generated tokens
 * - 4096-token model context window
 *
 * These settings apply ONLY to summaries and do not change
 * normal RAG Q&A behavior.
 */
export const generateSummary = async ({
  documentText,
}) => {
  const prompt = buildSummaryPrompt(
    documentText
  );

  return await callLLMAPI(
    prompt,
    documentText,
    '',
    true,
    {
      num_predict: SUMMARY_MAX_TOKENS,
      num_ctx: 4096,
    }
  );
}