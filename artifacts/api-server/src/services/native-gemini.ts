type GeminiCompletion = { content: string; truncated: boolean };

class GeminiProviderError extends Error {
  constructor(readonly status: number, readonly headers: Headers) {
    super("Gemini provider request failed");
  }
}
class NativeGeminiConnectionError extends Error { readonly status = 502; }
class NativeGeminiTimeoutError extends Error { readonly status = 408; }

/** Native transport is explicit; credentials never enter URLs or error messages. */
export async function requestNativeGemini(apiKey: string, model: string, systemPrompt: string,
  userMessage: string, maxTokens: number, timeoutMs: number): Promise<GeminiCompletion> {
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens } }),
    });
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new NativeGeminiTimeoutError("Gemini request timed out");
    throw new NativeGeminiConnectionError("Gemini connection failed");
  }
  if (!response.ok) throw new GeminiProviderError(response.status, response.headers);
  const body = await response.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[] };
  const candidate = body.candidates?.[0];
  return { content: candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text ?? "").join("") ?? "",
    truncated: candidate?.finishReason === "MAX_TOKENS" };
}
