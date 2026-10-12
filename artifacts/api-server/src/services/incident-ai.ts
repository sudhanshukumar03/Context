import { z } from "zod";
import { callAi, safeParseJson, withRetry } from "./ai.service.js";

const strings = z.array(z.string());
const rootCauseSchema = z.object({ cause: z.string().min(1), confidence: z.number().min(0).max(1),
  suggestedFixes: strings.max(4), estimatedLoss: z.string(), reasoning: strings.max(4) });
const answerSchema = z.object({ answer: z.string().min(1), confidence: z.number().min(0).max(1),
  sources: strings.default([]), reasoning: z.preprocess((value) => typeof value === "string" ? [value] : value, strings.default([])),
  impact: strings.default([]), actions: strings.default([]) });

export function requestRootCause(systemPrompt: string) {
  return withRetry("root-cause", async () => safeParseJson(await callAi(systemPrompt, "Analyse now.", 1024), rootCauseSchema));
}
export function requestIncidentAnswer(systemPrompt: string, question: string) {
  return withRetry("incident-ask", async () => safeParseJson(await callAi(systemPrompt, question, 2048), answerSchema));
}
export function requestPostmortem(systemPrompt: string) {
  // Reports need more generation time than short JSON answers. All attempts and
  // backoff share a 55-second budget within the dashboard's 60-second deadline.
  const deadline = performance.now() + 55_000;
  return withRetry("postmortem", () => {
    const remaining = Math.floor(deadline - performance.now());
    if (remaining <= 0) throw new Error("Postmortem generation deadline exceeded");
    return callAi(systemPrompt, "Generate the post-mortem now.", 4096, Math.min(50_000, remaining));
  }, 3, deadline);
}
