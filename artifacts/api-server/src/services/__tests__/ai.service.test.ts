import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn(), error: vi.fn() }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mocks.create } } },
}));
vi.mock("../../lib/logger.js", () => ({ logger: { error: mocks.error } }));

import {
  askQuestion, breakdownTask, explainDocument, explainRelationship,
  generateContextBrief, generateDailyFocus, simplifyConcept,
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
