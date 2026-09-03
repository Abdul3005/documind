import { HfInference } from '@huggingface/inference';

// -----------------------------------------------------------------------------
// Hugging Face Client Setup
// -----------------------------------------------------------------------------
const hfToken = process.env.HF_TOKEN || '';
const hf = new HfInference(hfToken);

// Context / generation limits
const MAX_CONTEXT_CHARS = 24000;
const MAX_SUMMARY_CHARS = 10000;
const SUMMARY_MAX_TOKENS = 500;

// Model to use on Hugging Face Serverless API
const HF_MODEL = process.env.HF_MODEL_NAME || 'mistralai/Mistral-7B-Instruct-v0.2';

// -----------------------------------------------------------------------------
// RAG Prompt
// -----------------------------------------------------------------------------
export const buildPrompt = ({
  retrievedChunks = [],
  documentText = '',
  conversationHistory = [],
  question,
}) => {
  let contextContent = '';

  if (Array.isArray(retrievedChunks) && retrievedChunks.length > 0) {
    contextContent = retrievedChunks
      .map((c) => `[Chunk #${c.chunkIndex}]:\n${c.text}`)
      .join('\n\n');
  } else {
    let truncatedText = documentText || '';
    if (truncatedText.length > MAX_CONTEXT_CHARS) {
      truncatedText =
        truncatedText.slice(0, MAX_CONTEXT_CHARS) +
        '\n[Note: Document text was truncated.]';
    }
    contextContent = truncatedText || 'No document context available.';
  }

  const historyText =
    Array.isArray(conversationHistory) && conversationHistory.length > 0
      ? conversationHistory
        .map((m) => `${String(m.role || '').toUpperCase()}: ${m.content || ''}`)
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
export const buildSummaryPrompt = (documentText) => {
  const text = documentText || '';
  let summaryText = text;

  if (text.length > MAX_SUMMARY_CHARS) {
    const sectionSize = Math.floor(MAX_SUMMARY_CHARS / 3);
    const beginning = text.slice(0, sectionSize);
    const middleStart = Math.floor((text.length - sectionSize) / 2);
    const middle = text.slice(middleStart, middleStart + sectionSize);
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
- Keep the summary reasonably short.

DOCUMENT:
<<<DOCUMENT>>>
${summaryText}
<<<END DOCUMENT>>>

SUMMARY:`;
};

// -----------------------------------------------------------------------------
// Hugging Face API Call Handler
// -----------------------------------------------------------------------------
const callHuggingFace = async (prompt, maxTokens = 500) => {
  try {
    const response = await hf.chatCompletion({
      model: HF_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a precise, document-grounded AI assistant for DocuMind.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.2,
    });

    const answer = response.choices?.[0]?.message?.content;

    if (!answer || typeof answer !== 'string') {
      throw new Error('Invalid or empty response from Hugging Face API.');
    }

    return answer.trim();
  } catch (error) {
    console.error('[AI Service Error] Hugging Face call failed:', error.message);
    throw error;
  }
};

// -----------------------------------------------------------------------------
// Main LLM Dispatcher
// -----------------------------------------------------------------------------
const callLLMAPI = async (prompt, documentText, question = '', isSummary = false, maxTokens = 500) => {
  return await callHuggingFace(prompt, maxTokens);
};

// -----------------------------------------------------------------------------
// RAG Answer Generator
// -----------------------------------------------------------------------------
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

  return await callLLMAPI(prompt, documentText, question, false, 600);
};

// -----------------------------------------------------------------------------
// Document Summary Generator
// -----------------------------------------------------------------------------
export const generateSummary = async ({ documentText }) => {
  const prompt = buildSummaryPrompt(documentText);
  return await callLLMAPI(prompt, documentText, '', true, SUMMARY_MAX_TOKENS);
};