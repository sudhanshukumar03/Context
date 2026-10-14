import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({ openai: { chat: { completions: { create: mocks.create } } } }));
vi.mock("../../lib/logger.js", () => ({ logger: { error: vi.fn() } }));
import { requestIncidentAnswer, requestPostmortem, requestRootCause } from "../incident-ai.js";
class APIConnectionTimeoutError extends Error {}
const output = (data: unknown) => ({ choices: [{ message: { content: JSON.stringify(data) } }] });
beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
describe("incident AI reliability", () => {
  it("validates root-cause evidence and sets attempt deadlines", async () => {
    const data = { cause: "Deployment", confidence: 0.9, suggestedFixes: ["Rollback"], estimatedLoss: "Unknown", reasoning: ["Event"] };
    mocks.create.mockResolvedValue(output(data)); expect(await requestRootCause("context")).toEqual(data);
    expect(mocks.create.mock.calls[0][1]).toEqual({ timeout: 15000, maxRetries: 0 });
  });
  it.each([{ answer: "x", confidence: 12 }, { answer: "x", confidence: 0.8, actions: [12] }, {}])("rejects invalid incident answers", async (data) => {
    mocks.create.mockResolvedValue(output(data));
    const result = requestIncidentAnswer("context", "question"); const assertion = expect(result).rejects.toThrow();
    await vi.runAllTimersAsync(); await assertion; expect(mocks.create).toHaveBeenCalledTimes(3);
  });
  it("preserves supported string reasoning and missing optional lists", async () => {
    mocks.create.mockResolvedValue(output({ answer: "Evidence", confidence: 0.8, reasoning: "Observed" }));
    expect(await requestIncidentAnswer("context", "question")).toEqual({ answer: "Evidence", confidence: 0.8, reasoning: ["Observed"], actions: [], impact: [], sources: [] });
  });
  it("preserves structured evidence findings and open questions", async () => {
    const data = { answer: "Checkout is recorded healthy.", confidence: .8,
      findings: [{ statement: "Checkout status is healthy", basis: "observed", sourceIds: ["service:1"] }], unknowns: ["Live error rate is not supplied"] };
    mocks.create.mockResolvedValue(output(data));
    expect(await requestIncidentAnswer("context", "question")).toMatchObject(data);
    expect(mocks.create.mock.calls[0][0].max_completion_tokens).toBe(4096);
  });
  it("accepts aggregate findings supported by more than five source records", async () => {
    const sourceIds = Array.from({ length: 10 }, (_, i) => `service:${i + 1}`);
    const data = { answer: "All recorded services are healthy", confidence: .8,
      findings: [{ statement: "Ten service records report healthy status", basis: "observed", sourceIds }] };
    mocks.create.mockResolvedValue(output(data));
    expect(await requestIncidentAnswer("context", "question")).toMatchObject(data);
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it.each([
    { statement: "Unverified", basis: "confirmed", sourceIds: [] },
    { statement: "", basis: "observed", sourceIds: [] },
    { statement: "Unverified", basis: "observed", sourceIds: [12] },
  ])("rejects malformed evidence findings", async finding => {
    mocks.create.mockResolvedValue(output({ answer: "Answer", confidence: .8, findings: [finding] }));
    const assertion = expect(requestIncidentAnswer("context", "question")).rejects.toThrow();
    await vi.runAllTimersAsync(); await assertion;
  });
  it("fails immediately for permanent provider errors", async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error("private body"), { status: 401 }));
    await expect(requestPostmortem("context")).rejects.toThrow("provider request failed");
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("rejects empty postmortems instead of returning placeholder success", async () => {
    mocks.create.mockResolvedValue({ choices: [] });
    const result = requestPostmortem("context"); const assertion = expect(result).rejects.toThrow();
    await vi.runAllTimersAsync(); await assertion; expect(mocks.create).toHaveBeenCalledTimes(3);
  });
  it("gives reports more time while keeping retries within one deadline", async () => {
    mocks.create.mockImplementationOnce(async () => {
      await new Promise(resolve => setTimeout(resolve, 50_000));
      throw new APIConnectionTimeoutError();
    }).mockResolvedValue({ choices: [{ message: { content: "# Incident report" } }] });
    const pending = requestPostmortem("context");
    await vi.advanceTimersByTimeAsync(50_800);
    expect(await pending).toBe("# Incident report");
    expect(mocks.create.mock.calls[0][1]).toEqual({ timeout: 50_000, maxRetries: 0 });
    expect(mocks.create.mock.calls[1][1].timeout).toBeGreaterThan(0);
    expect(mocks.create.mock.calls[1][1].timeout).toBeLessThanOrEqual(4200);
    expect(mocks.create.mock.calls[0][0].max_completion_tokens).toBe(4096);
  });
  it("does not start a third report attempt after the overall deadline expires", async () => {
    mocks.create.mockImplementation((_body, options) => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new APIConnectionTimeoutError()), options.timeout);
    }));
    const assertion = expect(requestPostmortem("context")).rejects.toThrow("provider request failed");
    await vi.advanceTimersByTimeAsync(55_000); await assertion;
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects truncated reports rather than presenting an incomplete download as success", async () => {
    mocks.create.mockResolvedValue({ choices: [{ finish_reason: "length", message: { content: "# Partial report" } }] });
    const assertion = expect(requestPostmortem("context")).rejects.toThrow("expected output");
    await vi.runAllTimersAsync(); await assertion;
    expect(mocks.create).toHaveBeenCalledTimes(3);
  });
});
