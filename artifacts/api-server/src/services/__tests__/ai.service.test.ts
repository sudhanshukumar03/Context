import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), error: vi.fn() }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mocks.create } } },
}));
vi.mock("../../lib/logger.js", () => ({ logger: { error: mocks.error } }));

import {
  askQuestion, breakdownTask, explainDocument, explainRelationship,
  generateContextBrief, generateDailyFocus, simplifyConcept, logAiError,
} from "../ai.service.js";

const qa = { answer: "Read the runbook", confidence: 80, sources: ["runbook"] };
const cases = [
  { name: "brief", call: () => generateContextBrief({ role: "pm" }), output: {
    team: "Platform", goal: "Learn", keyPerson: "Alex", suggestedReading: "Runbook",
    nextAction: "Read", whyThisMatters: "Reliability", confidence: 80,
    explanation: "Evidence", sources: ["runbook"],
  } },
  { name: "ask", call: () => askQuestion({ question: "Next?", contextData: "Runbook" }), output: qa },
  { name: "document", call: () => explainDocument({ title: "Runbook", content: "Text", role: "backend" }), output: {
    summary: "Summary", keyPoints: ["Point"], simplifiedExplanation: "Explanation", relevanceForRole: "Relevant",
  } },
  { name: "task", call: () => breakdownTask({ title: "Deploy", description: "Safely" }), output: {
    steps: ["Test"], dependencies: [], estimatedEffort: "1 day", requiredKnowledge: ["CI"],
  } },
  { name: "relationship", call: () => explainRelationship({ entityId: "a", entityLabel: "API", graph: {
    nodes: [{ id: "a", label: "API", type: "service" }], edges: [],
  } }), output: { explanation: "Standalone", relatedEntities: [], impact: "None" } },
  { name: "daily", call: () => generateDailyFocus({ role: "frontend" }), output: {
    priorities: [{ title: "Test", reason: "Quality", urgency: "high" }], recommendedDocs: [], suggestedActions: ["Read"],
  } },
  { name: "simplify", call: () => simplifyConcept({ concept: "Queue" }), output: {
    simpleExplanation: "A queue", analogy: "A line", keyTakeaways: ["Ordered"],
  } },
];

function response(content: string | null) {
  return { choices: [{ message: { content } }] };
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe("AI service characterization", () => {
  it.each(cases)("returns the existing $name response shape", async ({ call, output }) => {
    mocks.create.mockResolvedValue(response(JSON.stringify(output)));
    expect(await call()).toEqual(output);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ temperature: 0.3, max_completion_tokens: 1024 });
  });

  it("accepts fenced JSON after a conversational preamble", async () => {
    mocks.create.mockResolvedValue(response(`Here is the answer:\n\`\`\`json\n${JSON.stringify(qa)}\n\`\`\``));
    expect(await askQuestion({ question: "Next?", contextData: "Runbook" })).toEqual(qa);
  });

  it("retries malformed JSON and returns a later valid result", async () => {
    vi.useFakeTimers();
    mocks.create.mockResolvedValueOnce(response("not JSON")).mockResolvedValue(response(JSON.stringify(qa)));
    const pending = askQuestion({ question: "Next?", contextData: "Runbook" });
    const assertion = expect(pending).resolves.toEqual(qa);
    await vi.runAllTimersAsync();
    await assertion;
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("limits Q&A context to the current 3000-character window", async () => {
    mocks.create.mockResolvedValue(response(JSON.stringify(qa)));
    await askQuestion({ question: "Next?", contextData: "a".repeat(4000) });
    expect(mocks.create.mock.calls[0][0].messages[1].content).toBe(`CONTEXT:\n${"a".repeat(3000)}\n\nQUESTION: Next?`);
  });
});

describe("model response validation", () => {
  it.each(cases)("rejects an empty object for $name", async ({ call }) => {
    vi.useFakeTimers();
    mocks.create.mockResolvedValue(response("{}"));
    const assertion = expect(call()).rejects.toThrow("expected output");
    await vi.runAllTimersAsync();
    await assertion;
    expect(mocks.create).toHaveBeenCalledTimes(3);
  });

  it.each([null, "", "   ", "[]", '{"answer":123,"confidence":80,"sources":[]}',
    '{"answer":"test","confidence":101,"sources":[]}',
    '{"answer":"test","confidence":80,"sources":[42]}'])("rejects invalid Q&A content %j", async (content) => {
    vi.useFakeTimers();
    mocks.create.mockResolvedValue(response(content));
    const assertion = expect(askQuestion({ question: "Next?", contextData: "Runbook" })).rejects.toThrow("expected output");
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("preserves extra fields in otherwise valid responses", async () => {
    const output = { ...qa, extra: "Provider extension" };
    mocks.create.mockResolvedValue(response(JSON.stringify(output)));
    expect(await askQuestion({ question: "Next?", contextData: "Runbook" })).toEqual(output);
  });

  it("retries wrong-shaped output and accepts a valid replacement", async () => {
    vi.useFakeTimers();
    mocks.create.mockResolvedValueOnce(response("{}")).mockResolvedValue(response(JSON.stringify(qa)));
    const assertion = expect(askQuestion({ question: "Next?", contextData: "Runbook" })).resolves.toEqual(qa);
    await vi.runAllTimersAsync();
    await assertion;
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
});

describe("evidence context", () => {
  it.each(["", " \n\t "])("returns insufficient evidence without a provider call for %j", async (contextData) => {
    expect(await askQuestion({ question: "What is my team?", contextData })).toEqual({
      answer: "Not enough data", confidence: 0, sources: [],
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("selects complete direct connections even when the target occurs late in a large graph", async () => {
    mocks.create.mockResolvedValue(response(JSON.stringify({ explanation: "Connected", relatedEntities: [], impact: "Useful" })));
    const unrelated = Array.from({ length: 40 }, (_, i) => ({ id: `unrelated-${i}`, label: "Unrelated".repeat(50), type: "service" }));
    const direct = Array.from({ length: 30 }, (_, i) => ({ id: `neighbor-${i}`, label: "Neighbor".repeat(50), type: "service" }));
    await explainRelationship({ entityId: "target", entityLabel: "Target", graph: {
      nodes: [...unrelated, ...direct, { id: "target", label: "Target", type: "service" }],
      edges: direct.map((node, i) => i % 2 ? { from: node.id, to: "target" } : { from: "target", to: node.id }),
    } });
    const serialized = mocks.create.mock.calls[0][0].messages[1].content.split("Graph:\n")[1];
    const graph = JSON.parse(serialized);
    expect(serialized.length).toBeLessThanOrEqual(1500);
    expect(graph.nodes.some((node: { id: string }) => node.id === "target")).toBe(true);
    expect(graph.nodes.some((node: { id: string }) => node.id.startsWith("unrelated"))).toBe(false);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.omittedConnections).toBeGreaterThan(0);
    expect(graph.edges.length + graph.omittedConnections).toBe(30);
    for (const edge of graph.edges) {
      expect(graph.nodes.map((node: { id: string }) => node.id)).toEqual(expect.arrayContaining([edge.from, edge.to]));
    }
  });
});

describe("provider retry policy", () => {
  it("logs safe metadata for callers without a request logger", () => {
    logAiError("ask", new Error("private provider data"));
    expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ tool: "ask", errorType: "operation_error" }), "AI tool error");
    expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("private");
  });
  it.each([400, 401, 403, 404, 422])("does not retry permanent HTTP %i failures", async (status) => {
    mocks.create.mockRejectedValue(Object.assign(new Error("secret provider body"), { status }));
    await expect(askQuestion({ question: "Next?", contextData: "Runbook" })).rejects.toMatchObject({
      tool: "ask", attempts: 1, status,
    });
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it.each([408, 409, 429, 500, 503])("limits transient HTTP %i failures to three attempts", async (status) => {
    vi.useFakeTimers();
    mocks.create.mockRejectedValue(Object.assign(new Error("unavailable"), { status }));
    const assertion = expect(askQuestion({ question: "Next?", contextData: "Runbook" })).rejects.toMatchObject({
      tool: "ask", attempts: 3, status,
    });
    await vi.runAllTimersAsync();
    await assertion;
    expect(mocks.create).toHaveBeenCalledTimes(3);
    expect(mocks.create.mock.calls[0][1]).toEqual({ timeout: 15_000, maxRetries: 0 });
  });

  it("honors a provider directive not to retry", async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error("unavailable"), {
      status: 503, headers: new Headers({ "x-should-retry": "false" }),
    }));
    await expect(askQuestion({ question: "Next?", contextData: "Runbook" })).rejects.toMatchObject({ attempts: 1 });
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("caps provider-requested backoff and recovers after a transient failure", async () => {
    vi.useFakeTimers();
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("busy"), {
      status: 429, headers: new Headers({ "retry-after": "100" }),
    })).mockResolvedValue(response(JSON.stringify(qa)));
    const assertion = expect(askQuestion({ question: "Next?", contextData: "Runbook" })).resolves.toEqual(qa);
    await vi.advanceTimersByTimeAsync(4999);
    expect(mocks.create).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it("retries SDK connection timeouts without leaking their message in the operation error", async () => {
    vi.useFakeTimers();
    class APIConnectionTimeoutError extends Error {}
    mocks.create.mockRejectedValue(new APIConnectionTimeoutError("private request content"));
    const assertion = expect(askQuestion({ question: "Next?", contextData: "Runbook" })).rejects.toThrow(
      "AI ask failed after 3 attempt(s): provider request failed",
    );
    await vi.runAllTimersAsync();
    await assertion;
    expect(mocks.create).toHaveBeenCalledTimes(3);
  });
});
