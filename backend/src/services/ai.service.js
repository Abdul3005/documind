import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Document Summarization ke liye
export const generateSummary = async (text) => {
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Please provide a clear and detailed summary of the following text:\n\n${text}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content || "Summary could not be generated.";
  } catch (error) {
    console.error("Groq Summary Error:", error);
    throw new Error("Failed to generate summary using Groq.");
  }
};

// Document Q&A (Question Answering) ke liye
export const generateAnswer = async (prompt) => {
  try {
    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content || "No answer generated.";
  } catch (error) {
    console.error("Groq Answer Error:", error);
    throw new Error("Failed to generate answer using Groq.");
  }
};