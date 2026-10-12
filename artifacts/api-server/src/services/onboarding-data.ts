import { z } from "zod";

export const briefOutputSchema = z.object({
  team: z.string(), goal: z.string(), keyPerson: z.string(), suggestedReading: z.string(),
  nextAction: z.string(), whyThisMatters: z.string(), confidence: z.number().min(0).max(100),
  explanation: z.string(), sources: z.array(z.string()),
}).passthrough();

// Uploaded contacts describe onboarding context. They never grant Clerk membership.
export const teamDirectorySchema = z.array(z.object({
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
})).min(1).max(100);

export function parseStoredBrief(raw: string | null) {
  try {
    const result = briefOutputSchema.safeParse(JSON.parse(raw ?? "null"));
    return result.success ? result.data : null;
  } catch { return null; }
}

export function parseTeamDirectory(raw: string) {
  try {
    const result = teamDirectorySchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}
