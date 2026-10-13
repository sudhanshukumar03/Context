export function resolveAiConfiguration(env: Record<string, string | undefined> = process.env) {
  const geminiKey = env.GEMINI_API_KEY;
  const openaiKey = env.OPENAI_API_KEY || env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const isGemini = Boolean(geminiKey || !openaiKey);
  return {
    provider: isGemini ? "gemini" : "openai",
    transport: isGemini && env.GEMINI_TRANSPORT === "native" ? "native" : "openai",
    apiKey: (isGemini ? geminiKey : openaiKey) || "dummy-key",
    model: isGemini ? env.GEMINI_MODEL || "gemini-3.8-flash" : env.OPENAI_MODEL || "gpt-4o-mini",
    baseURL: isGemini ? env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/"
      : env.OPENAI_BASE_URL || env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
  };
}
