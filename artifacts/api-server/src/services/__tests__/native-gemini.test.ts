import { afterEach, describe, expect, it, vi } from "vitest";
import { requestNativeGemini } from "../native-gemini.js";
afterEach(() => vi.unstubAllGlobals());
describe("native Gemini transport", () => {
  it("uses bounded native requests and excludes private thinking from output", async () => {
    const provider = vi.fn().mockResolvedValue(Response.json({ candidates: [{ finishReason: "STOP", content: {
      parts: [{ text: "private thoughts", thought: true }, { text: '{"answer":"OK"}' }],
    } }] }));
    vi.stubGlobal("fetch", provider);
    expect(await requestNativeGemini("synthetic-key", "gemini-3.5-flash-lite", "System", "Question", 2048, 1000))
      .toEqual({ content: '{"answer":"OK"}', truncated: false });
    const [url, init] = provider.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    expect(url).not.toContain("synthetic-key");
    expect(init).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal), headers: { "x-goog-api-key": "synthetic-key" } });
    expect(JSON.parse(init.body)).toMatchObject({ generationConfig: { maxOutputTokens: 2048 }, systemInstruction: { parts: [{ text: "System" }] } });
  });
  it.each([429, 503])("preserves status %s and retry headers without leaking provider text", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private provider error", { status, headers: { "retry-after": "3" } })));
    try { await requestNativeGemini("secret", "gemini-test", "System", "Question", 100, 1000); throw new Error("Expected failure"); }
    catch (error) { expect(error).toMatchObject({ status }); expect(String(error)).not.toMatch(/private|secret/); expect((error as { headers: Headers }).headers.get("retry-after")).toBe("3"); }
  });
  it("marks token-truncated output and handles blocked content", async () => {
    const provider = vi.fn().mockResolvedValueOnce(Response.json({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "partial" }] } }] }))
      .mockResolvedValueOnce(Response.json({ promptFeedback: { blockReason: "SAFETY" } }));
    vi.stubGlobal("fetch", provider);
    expect(await requestNativeGemini("test", "gemini-test", "", "", 100, 1000)).toEqual({ content: "partial", truncated: true });
    expect(await requestNativeGemini("test", "gemini-test", "", "", 100, 1000)).toEqual({ content: "", truncated: false });
  });
  it("redacts network errors while retaining retryable error classes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private URL with secret")));
    try { await requestNativeGemini("test", "gemini-test", "", "", 100, 1000); throw new Error("Expected failure"); }
    catch (error) { expect(error).toMatchObject({ status: 502 }); expect(String(error)).not.toMatch(/private|secret/); }
  });
  it("classifies native timeouts independently of bundled class names", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("private input", "TimeoutError")));
    await expect(requestNativeGemini("test", "gemini-test", "", "", 100, 1000)).rejects.toMatchObject({ status: 408, message: "Gemini request timed out" });
  });
});
