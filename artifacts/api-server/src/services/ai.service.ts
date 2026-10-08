import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger.js";

const MODEL = process.env.GEMINI_MODEL || process.env.OPENAI_MODEL || "gemini-2.0-flash";
const TEMPERATURE = 0.3;
const MAX_TOKENS = 1024;

function safeParseJson<T>(raw: string): T {
  const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) {
    throw new Error("No JSON object or array found in model response");
  }
  return JSON.parse(match[0]) as T;
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

async function callAi(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: TEMPERATURE,
    max_completion_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });
  return response.choices[0]?.message?.content ?? "{}";
}

// --- 1. Context Brief Generator ---

export interface ContextBriefInput {
  role: string;
  teamData?: object[];
  documents?: Array<{ title: string; content: string }>;
  tasks?: object[];
}

export interface ContextBriefOutput {
  team: string;
  goal: string;
  keyPerson: string;
  suggestedReading: string;
  nextAction: string;
  whyThisMatters: string;
  confidence: number;
  explanation: string;
  sources: string[];
}

const BRIEF_SYSTEM = `You are an onboarding intelligence AI. Generate a concise, actionable Context Brief for a new employee.
STRICT RULES:
- Output ONLY valid JSON. No markdown, no extra text.
- Be specific, not generic
- confidence must be a number 0-100
- sources must be an array of strings referencing the provided documents/teams
OUTPUT FORMAT:
{"team":"string","goal":"string","keyPerson":"string","suggestedReading":"string","nextAction":"string","whyThisMatters":"string","confidence":87,"explanation":"string","sources":["string"]}`;

export async function generateContextBrief(input: ContextBriefInput): Promise<ContextBriefOutput> {
  const roleLabel = input.role === "pm" ? "Product Manager" : input.role === "frontend" ? "Frontend Developer" : "Backend Developer";
  const docsText = input.documents?.map((d) => `Doc: ${d.title}\n${d.content.slice(0, 600)}`).join("\n---\n") ?? "No documents provided.";
  const teamText = input.teamData ? JSON.stringify(input.teamData).slice(0, 800) : "No team data provided.";
  const tasksText = input.tasks ? JSON.stringify(input.tasks).slice(0, 600) : "No tasks provided.";

  const userMsg = `Role: ${roleLabel}\n\nTeam:\n${teamText}\n\nDocuments:\n${docsText}\n\nTasks:\n${tasksText}`;

  return withRetry(async () => {
    const raw = await callAi(BRIEF_SYSTEM, userMsg);
    return safeParseJson<ContextBriefOutput>(raw);
  });
}

// --- 2. Smart Q&A ---

export interface AskQuestionInput {
  question: string;
  contextData: string;
}

export interface AskQuestionOutput {
  answer: string;
  confidence: number;
  sources: string[];
}

const QA_SYSTEM = `You are a company knowledge expert. Answer questions using ONLY the provided context.
STRICT RULES:
- Output ONLY valid JSON. No markdown, no extra text.
- If the answer is not in the context, set answer to exactly: "Not enough data"
- confidence must be a number 0-100
- sources must list the specific documents or data items you referenced
OUTPUT FORMAT:
{"answer":"string","confidence":85,"sources":["string"]}`;

export async function askQuestion(input: AskQuestionInput): Promise<AskQuestionOutput> {
  const userMsg = `CONTEXT:\n${input.contextData.slice(0, 3000)}\n\nQUESTION: ${input.question}`;

  return withRetry(async () => {
    const raw = await callAi(QA_SYSTEM, userMsg);
    return safeParseJson<AskQuestionOutput>(raw);
  });
}

// --- 3. Document Explainer ---

export interface ExplainDocumentInput {
  title: string;
  content: string;
  role: string;
}

export interface ExplainDocumentOutput {
  summary: string;
  keyPoints: string[];
  simplifiedExplanation: string;
  relevanceForRole: string;
}

const DOC_EXPLAINER_SYSTEM = `You are an expert technical writer. Explain documents clearly for a specific role.
STRICT RULES:
- Output ONLY valid JSON. No markdown, no extra text.
- keyPoints must be an array of 3-5 concise strings
- Keep summaries under 3 sentences
- relevanceForRole should explain exactly why this matters for the given role
OUTPUT FORMAT:
{"summary":"string","keyPoints":["string"],"simplifiedExplanation":"string","relevanceForRole":"string"}`;

export async function explainDocument(input: ExplainDocumentInput): Promise<ExplainDocumentOutput> {
  const roleLabel = input.role === "pm" ? "Product Manager" : input.role === "frontend" ? "Frontend Developer" : "Backend Developer";
  const userMsg = `Role: ${roleLabel}\n\nDocument Title: ${input.title}\n\nContent:\n${input.content.slice(0, 2000)}`;

  return withRetry(async () => {
    const raw = await callAi(DOC_EXPLAINER_SYSTEM, userMsg);
    return safeParseJson<ExplainDocumentOutput>(raw);
  });
}

// --- 4. Task Breakdown AI ---

export interface BreakdownTaskInput {
  title: string;
  description: string;
  role?: string;
}

export interface BreakdownTaskOutput {
  steps: string[];
  dependencies: string[];
  estimatedEffort: string;
  requiredKnowledge: string[];
}

const TASK_BREAKDOWN_SYSTEM = `You are an expert engineering manager. Break tasks into clear, actionable steps.
STRICT RULES:
- Output ONLY valid JSON. No markdown, no extra text.
- steps must be 3-7 concrete, ordered action items
- dependencies are things that must be done or known before starting
- estimatedEffort is a string like "2-4 hours", "1 day", "2-3 days"
- requiredKnowledge lists skills or docs needed
OUTPUT FORMAT:
{"steps":["string"],"dependencies":["string"],"estimatedEffort":"string","requiredKnowledge":["string"]}`;

export async function breakdownTask(input: BreakdownTaskInput): Promise<BreakdownTaskOutput> {
  const roleLabel = input.role ? (input.role === "pm" ? "Product Manager" : input.role === "frontend" ? "Frontend Developer" : "Backend Developer") : "Engineer";
  const userMsg = `Role: ${roleLabel}\n\nTask: ${input.title}\n\nDescription: ${input.description}`;

  return withRetry(async () => {
    const raw = await callAi(TASK_BREAKDOWN_SYSTEM, userMsg);
    return safeParseJson<BreakdownTaskOutput>(raw);
  });
}

// --- 5. Relationship Explainer ---

export interface ExplainRelationshipInput {
  entityId: string;
  entityLabel: string;
  graph: { nodes: Array<{ id: string; label: string; type: string }>; edges: Array<{ from: string; to: string; label?: string }> };
}

export interface ExplainRelationshipOutput {
  explanation: string;
  relatedEntities: Array<{ id: string; label: string; relationship: string }>;
  impact: string;
}

const RELATIONSHIP_SYSTEM = `You are a system architecture expert. Explain how an entity connects in a knowledge graph.
STRICT RULES:
- Output ONLY valid JSON. No markdown, no extra text.
- relatedEntities must list direct connections with a brief relationship description
- impact explains why these connections matter for the user's work
OUTPUT FORMAT:
{"explanation":"string","relatedEntities":[{"id":"string","label":"string","relationship":"string"}],"impact":"string"}`;

export async function explainRelationship(input: ExplainRelationshipInput): Promise<ExplainRelationshipOutput> {
  const graphText = JSON.stringify(input.graph).slice(0, 1500);
  const userMsg = `Entity: ${input.entityLabel} (id: ${input.entityId})\n\nGraph:\n${graphText}`;

  return withRetry(async () => {
    const raw = await callAi(RELATIONSHIP_SYSTEM, userMsg);
    return safeParseJson<ExplainRelationshipOutput>(raw);
  });
}

// --- 6. Daily Context Feed ---

export interface DailyFocusInput {
  role: string;
  recentActivity?: string[];
  pendingTasks?: string[];
  teamUpdates?: string[];
}

export interface DailyFocusOutput {
  priorities: Array<{ title: string; reason: string; urgency: "high" | "medium" | "low" }>;
  recommendedDocs: Array<{ title: string; why: string }>;
  suggestedActions: string[];
}

const DAILY_FOCUS_SYSTEM = `You are a productivity coach for software teams. Generate a focused daily plan.
STRICT RULES:
- Output ONLY valid JSON. No markdown, no extra text.
- priorities must be 2-4 items ordered by urgency (high first)
- urgency must be exactly "high", "medium", or "low"
- recommendedDocs must be 1-3 items most relevant for today
- suggestedActions must be 3-5 concrete actions for today
OUTPUT FORMAT:
{"priorities":[{"title":"string","reason":"string","urgency":"high"}],"recommendedDocs":[{"title":"string","why":"string"}],"suggestedActions":["string"]}`;

export async function generateDailyFocus(input: DailyFocusInput): Promise<DailyFocusOutput> {
  const roleLabel = input.role === "pm" ? "Product Manager" : input.role === "frontend" ? "Frontend Developer" : "Backend Developer";
  const activityText = input.recentActivity?.join(", ") ?? "No recent activity";
  const tasksText = input.pendingTasks?.join(", ") ?? "No pending tasks";
  const updatesText = input.teamUpdates?.join(", ") ?? "No recent team updates";

  const userMsg = `Role: ${roleLabel}\n\nRecent Activity: ${activityText}\nPending Tasks: ${tasksText}\nTeam Updates: ${updatesText}`;

  return withRetry(async () => {
    const raw = await callAi(DAILY_FOCUS_SYSTEM, userMsg);
    return safeParseJson<DailyFocusOutput>(raw);
  });
}

// --- 7. Confusion Resolver ---

export interface SimplifyConceptInput {
  concept: string;
  context?: string;
  role?: string;
}

export interface SimplifyConceptOutput {
  simpleExplanation: string;
  analogy: string;
  keyTakeaways: string[];
}

const SIMPLIFY_SYSTEM = `You are an expert at explaining complex concepts in simple terms.
STRICT RULES:
- Output ONLY valid JSON. No markdown, no extra text.
- simpleExplanation must be 1-2 sentences a non-expert can understand
- analogy must relate to everyday life (not technical)
- keyTakeaways must be 2-4 bullet points of what matters most
OUTPUT FORMAT:
{"simpleExplanation":"string","analogy":"string","keyTakeaways":["string"]}`;

export async function simplifyConcept(input: SimplifyConceptInput): Promise<SimplifyConceptOutput> {
  const roleHint = input.role ? ` Tailor explanation for a ${input.role}.` : "";
  const contextHint = input.context ? `\n\nAdditional context: ${input.context}` : "";
  const userMsg = `Concept: ${input.concept}${roleHint}${contextHint}`;

  return withRetry(async () => {
    const raw = await callAi(SIMPLIFY_SYSTEM, userMsg);
    return safeParseJson<SimplifyConceptOutput>(raw);
  });
}

// --- Utility: log AI errors ---
export function logAiError(toolName: string, err: unknown): void {
  logger.error({ err, tool: toolName }, "AI tool error");
}
