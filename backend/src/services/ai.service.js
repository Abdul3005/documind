import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_API_BASE_URL,
});

// Document Summarization
export const generateSummary = async (text) => {
  try {
    const stringText =
      typeof text === "string" ? text : JSON.stringify(text || "");

    const trimmedText =
      stringText.length > 15000
        ? stringText.substring(0, 15000)
        : stringText;

    const response = await client.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Please provide a clear and detailed summary of the following text:\n\n${trimmedText}`,
        },
      ],
      model: process.env.LLM_MODEL_NAME,
      temperature: 0.5,
      max_tokens: 1024,
    });

    return (
      response.choices[0]?.message?.content ||
      "Summary could not be generated."
    );
  } catch (error) {
    console.error("LLM Summary Error:", error);
    throw new Error(`LLM Summary Failed: ${error.message}`);
  }
};

// Document Q&A
export const generateAnswer = async (prompt) => {
  try {
    const stringPrompt =
      typeof prompt === "string"
        ? prompt
        : JSON.stringify(prompt || "");

    const safePrompt =
      stringPrompt.length > 15000
        ? stringPrompt.substring(0, 15000)
        : stringPrompt;

    const response = await client.chat.completions.create({
      messages: [{ role: "user", content: safePrompt }],
      model: process.env.LLM_MODEL_NAME,
      temperature: 0.5,
      max_tokens: 1024,
    });

    return (
      response.choices[0]?.message?.content ||
      "No answer generated."
    );
  } catch (error) {
    console.error("LLM Answer Error:", error);
    throw new Error(`LLM Answer Failed: ${error.message}`);
  }
};