import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@workspace/integrations-openai-ai-server", () => ({ openai: { chat: { completions: { create: vi.fn(() => { throw new Error("Compatibility transport must not be called"); }) } } } }));
vi.mock("../../lib/logger.js", () => ({ logger: { error: vi.fn() } }));
beforeEach(() => { vi.resetModules(); vi.stubEnv("GEMINI_API_KEY", "synthetic-key"); vi.stubEnv("GEMINI_TRANSPORT", "native"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const completion = (text: string) => Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }] });
describe("native Gemini through actual AI services", () => {
  it("gives full-context generation time while retries share a 55-second budget", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const timeouts = vi.spyOn(AbortSignal, "timeout").mockReturnValue(new AbortController().signal);
    const provider = vi.fn().mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 45_000)); return new Response("busy", { status: 503 });
    }).mockImplementation(async () => completion("Recovered"));
    vi.stubGlobal("fetch", provider);
    const { callAi, withRetry } = await import("../ai.service.js");
    const assertion = expect(withRetry("budget-test", () => callAi("Synthetic", "Question"))).resolves.toBe("Recovered");
    await vi.runAllTimersAsync(); await assertion;
    expect(timeouts.mock.calls[0][0]).toBe(50_000);
    expect(timeouts.mock.calls[1][0]).toBeGreaterThan(0);
    expect(timeouts.mock.calls[1][0]).toBeLessThanOrEqual(10_000);
  });
  it("validates a native incident answer using the existing application schema", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => completion(JSON.stringify({ answer: "Check latency", confidence: 0.7, sources: [], reasoning: [], impact: [], actions: [] }))));
    const { requestIncidentAnswer } = await import("../incident-ai.js");
    expect(await requestIncidentAnswer("Synthetic", "Next?")).toMatchObject({ answer: "Check latency", confidence: 0.7 });
  });
  it("retries temporary native failures and accepts recovery", async () => {
    vi.useFakeTimers();
    const provider = vi.fn().mockImplementationOnce(async () => new Response("private error", { status: 503 }))
      .mockImplementation(async () => completion("Recovered report"));
    vi.stubGlobal("fetch", provider);
    const { requestPostmortem } = await import("../incident-ai.js");
    const assertion = expect(requestPostmortem("Synthetic")).resolves.toBe("Recovered report");
    await vi.runAllTimersAsync(); await assertion; expect(provider).toHaveBeenCalledTimes(2);
  });
  it("rejects truncated output before a report is returned", async () => {
    vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn(async () => Response.json({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "Partial report" }] } }] })));
    const { requestPostmortem } = await import("../incident-ai.js");
    const assertion = expect(requestPostmortem("Synthetic")).rejects.toThrow("expected output");
    await vi.runAllTimersAsync(); await assertion;
  });
});
