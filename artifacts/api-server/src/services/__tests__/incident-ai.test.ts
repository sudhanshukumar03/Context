import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({ openai: { chat: { completions: { create: mocks.create } } } }));
vi.mock("../../lib/logger.js", () => ({ logger: { error: vi.fn() } }));
import { requestIncidentAnswer, requestPostmortem, requestRootCause } from "../incident-ai.js";
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
});
