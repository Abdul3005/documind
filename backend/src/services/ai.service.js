import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Document Summarization
export const generateSummary = async (text) => {
  try {
    // Groq token limit safety ke liye text trim karein
    const trimmedText = text.length > 15000 ? text.substring(0, 15000) : text;

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Please provide a clear and detailed summary of the following text:\n\n${trimmedText}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content || "Summary could not be generated.";
  } catch (error) {
    console.error("Groq Summary Error:", error);
    throw new Error(`Groq Summary Failed: ${error.message}`);
  }
};

// Document Q&A (Question Answering)
export const generateAnswer = async (prompt) => {
  try {
    // Large context safety
    const safePrompt = prompt.length > 15000 ? prompt.substring(0, 15000) : prompt;

    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: safePrompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content || "No answer generated.";
  } catch (error) {
    console.error("Groq Answer Error:", error);
    throw new Error(`Groq Answer Failed: ${error.message}`);
  }
};