import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const generateAIResponse = async (prompt) => {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.1-8b-instant", // Super fast & free
      temperature: 0.5,
      max_tokens: 1024,
    });

    return chatCompletion.choices[0]?.message?.content || "No response generated.";
  } catch (error) {
    console.error("Groq AI Error:", error);
    throw new Error("AI processing failed");
  }
};