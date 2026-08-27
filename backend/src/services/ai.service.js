/**
 * AI Service for DocuMind
 * Handles LLM prompt construction, context truncation, RAG Q&A generation, and summarization.
 * Powered locally by Ollama (default model: qwen2.5:1.5b).
 */

// Maximum character budget for fallback document context (~6,000–8,000 tokens)
const MAX_CONTEXT_CHARS = 24000;

/**
 * Builds grounded prompt using system instructions, retrieved document chunks (or document text fallback), chat history, and user question.
 */
export const buildPrompt = ({ retrievedChunks = [], documentText = '', conversationHistory = [], question }) => {
  let contextContent = '';

  if (Array.isArray(retrievedChunks) && retrievedChunks.length > 0) {
    contextContent = retrievedChunks
      .map((c) => `[Chunk #${c.chunkIndex}]:\n${c.text}`)
      .join('\n\n');
  } else {
    let truncatedText = documentText || '';
    if (truncatedText.length > MAX_CONTEXT_CHARS) {
      truncatedText = truncatedText.slice(0, MAX_CONTEXT_CHARS) + '\n[Note: Document text was truncated.]';
    }
    contextContent = truncatedText || 'No document context available.';
  }

  const historyText = conversationHistory.length > 0
    ? conversationHistory.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')
    : 'None';

  return `You are an AI assistant for DocuMind answering questions strictly based on the retrieved document context provided below. If the retrieved context does not contain enough information to answer the question, state clearly: "The document does not provide enough information to answer this question." Do not invent or assume facts outside the provided context.

<<<CONTEXT>>>
${contextContent}
<<<END CONTEXT>>>

CONVERSATION SO FAR:
${historyText}

QUESTION:
${question}`;
};

/**
 * Builds prompt for document summarization.
 */
export const buildSummaryPrompt = (documentText) => {
  let truncatedText = documentText || '';
  if (truncatedText.length > MAX_CONTEXT_CHARS) {
    truncatedText = truncatedText.slice(0, MAX_CONTEXT_CHARS);
  }

  return `You are a helpful assistant. Provide a concise, clear summary of the following document. Highlight key points, main takeaways, and essential information in bullet points.

DOCUMENT:
"""
${truncatedText}
"""`;
};

/**
 * Mock fallback generator for dev/test mode when LLM_API_KEY is set to 'mock_key_for_dev' or in test mode.
 */
const generateMockDevResponse = (documentText, question, isSummary = false) => {
  if (isSummary) {
    return `Document Summary:\n- Key Content: ${documentText.slice(0, 150)}...\n- Summary generated successfully grounded in document text.`;
  }

  const lowerDoc = (documentText || '').toLowerCase();
  const lowerQ = (question || '').toLowerCase();

  const stopWords = ['what', 'where', 'when', 'which', 'who', 'how', 'does', 'this', 'that', 'with', 'from', 'about', 'have', 'is', 'are', 'the', 'a', 'an', 'in', 'on', 'at'];
  const words = lowerQ.replace(/[^\w\s]/gi, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

  const matches = words.filter(word => lowerDoc.includes(word));

  if (matches.length > 0) {
    const lines = documentText.split('\n').filter(l => l.trim().length > 0);
    const matchingLine = lines.find(line => words.some(w => line.toLowerCase().includes(w))) || lines[0];
    return `Based on the document provided: ${matchingLine.trim()}`;
  } else {
    return 'The requested information is not contained in the provided document.';
  }
};

/**
 * Calls local Ollama LLM endpoint (default: http://localhost:11434/api/generate).
 */
const callOllama = async (prompt) => {
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || (process.env.LLM_API_BASE_URL?.includes('localhost') ? process.env.LLM_API_BASE_URL : 'http://localhost:11434');
  const modelName = process.env.OLLAMA_MODEL || (process.env.LLM_MODEL_NAME?.includes('qwen') ? process.env.LLM_MODEL_NAME : 'qwen2.5:1.5b');

  const cleanBaseUrl = ollamaBaseUrl.replace(/\/v1\/?$/, '').replace(/\/+$/, '');
  const url = `${cleanBaseUrl}/api/generate`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API Call Failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const answer = data.response;
    if (!answer || typeof answer !== 'string') {
      throw new Error('Invalid or empty response from local Ollama LLM model.');
    }

    return answer.trim();
  } catch (error) {
    console.error('[AI Service Error] Local Ollama call failed:', error.message);
    throw error;
  }
};

/**
 * Main LLM caller. Supports local Ollama generation with dev/test mock fallback.
 */
const callLLMAPI = async (prompt, documentText, question = '', isSummary = false) => {
  const apiKey = process.env.LLM_API_KEY;
  const isTestOrMock = process.env.NODE_ENV === 'test' || apiKey === 'mock_key_for_dev' || (!apiKey && process.env.NODE_ENV !== 'production');

  // Dev/Test mode fallback when explicitly configured for mock/test execution
  if (isTestOrMock) {
    return generateMockDevResponse(documentText, question, isSummary);
  }

  return await callOllama(prompt);
};

/**
 * Generate answer grounded in retrieved document chunks.
 */
export const generateAnswer = async ({ retrievedChunks = [], documentText = '', conversationHistory = [], question }) => {
  const prompt = buildPrompt({ retrievedChunks, documentText, conversationHistory, question });
  const contextForFallback = Array.isArray(retrievedChunks) && retrievedChunks.length > 0
    ? retrievedChunks.map(c => c.text).join('\n')
    : documentText;
  return await callLLMAPI(prompt, contextForFallback, question, false);
};

/**
 * Generate document summary.
 */
export const generateSummary = async ({ documentText }) => {
  const prompt = buildSummaryPrompt(documentText);
  return await callLLMAPI(prompt, documentText, '', true);
};
