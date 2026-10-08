import OpenAI from "openai";

const geminiKey = process.env.GEMINI_API_KEY || "";
const openAiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";

// Route to Google Gemini free tier API by default if GEMINI_API_KEY is present or OpenAI key is omitted
const isGemini = Boolean(geminiKey || !openAiKey);
const apiKey = geminiKey || openAiKey || "dummy-key";
const baseURL = isGemini
  ? (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/")
  : (process.env.OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined);

export const openai = new OpenAI({
  apiKey,
  baseURL,
});

