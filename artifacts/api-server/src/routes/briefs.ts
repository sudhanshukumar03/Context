import { Router, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, contextBriefs, documents } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middleware/auth.js";
import { ok, fail } from "../lib/response.js";
import { logger } from "../lib/logger.js";
import crypto from "node:crypto";

const router = Router();

const BRIEF_SYSTEM_PROMPT = `You are an AI onboarding intelligence system. Generate a clear, actionable Context Brief for a new employee based on company knowledge provided.

RULES:
- Be concise and specific
- Focus on what matters most for the given role
- Include concrete next actions
- Output ONLY valid JSON, no markdown

OUTPUT FORMAT:
{
  "team": "team name",
  "goal": "primary team goal",
  "keyPerson": "name and title of most important contact",
  "suggestedReading": "most critical document to read",
  "nextAction": "specific first action to take",
  "whyThisMatters": "why this context matters for onboarding",
  "confidence": 87,
  "explanation": "brief explanation of how this brief was generated",
  "sources": ["source1", "source2"]
}`;

async function generateBriefAsync(briefId: number, role: string, orgId: number) {
  try {
    await db.update(contextBriefs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(contextBriefs.id, briefId));

    const orgDocs = await db.select().from(documents)
      .where(eq(documents.organizationId, orgId))
      .limit(10);

    const roleLabel = role === "pm" ? "Product Manager" : role === "frontend" ? "Frontend Developer" : "Backend Developer";
    const docsContext = orgDocs.length > 0
      ? orgDocs.map((d) => `Document: ${d.title}\n${d.content.slice(0, 800)}`).join("\n---\n")
      : "No company documents uploaded yet. Use general software engineering onboarding knowledge.";

    const userMessage = `Generate an onboarding Context Brief for a new ${roleLabel}. Company knowledge:\n\n${docsContext}`;

    const response = await openai.chat.completions.create({
      model: process.env.GEMINI_MODEL || process.env.OPENAI_MODEL || "gemini-2.0-flash",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: BRIEF_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found in OpenAI response");
    const data = JSON.parse(match[0]);

    await db.update(contextBriefs)
      .set({ status: "done", data: JSON.stringify(data), updatedAt: new Date() })
      .where(eq(contextBriefs.id, briefId));

    logger.info({ briefId }, "brief generation complete");
  } catch (err) {
    logger.error({ err, briefId }, "brief generation failed");
    await db.update(contextBriefs)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(contextBriefs.id, briefId));
  }
}

// POST /api/generate-brief — enqueue a brief generation job
router.post("/generate-brief", requireAuth, async (req: Request, res: Response) => {
  const role = (req.body.role as string) ?? req.auth!.role ?? "backend";
  const orgId = req.auth!.organizationId ?? 0;
  const userId = req.auth!.userId;
  const jobId = crypto.randomUUID();

  try {
    const [brief] = await db.insert(contextBriefs).values({
      organizationId: orgId,
      userId,
      role,
      status: "pending",
      jobId,
    }).returning();

    // Kick off async processing — non-blocking
    setImmediate(() => { void generateBriefAsync(brief.id, role, orgId); });

    ok(res, { jobId, briefId: brief.id, status: "pending", message: "Brief generation started" }, 202);
  } catch (err) {
    req.log.error({ err }, "generate brief error");
    fail(res, "Failed to start brief generation", 500);
  }
});

// GET /api/brief/live — most recent brief for the current user
router.get("/brief/live", requireAuth, async (req: Request, res: Response) => {
  const orgId = req.auth!.organizationId ?? 0;
  const userId = req.auth!.userId;

  try {
    const [brief] = await db.select().from(contextBriefs)
      .where(and(eq(contextBriefs.userId, userId), eq(contextBriefs.organizationId, orgId)))
      .orderBy(desc(contextBriefs.createdAt))
      .limit(1);

    if (!brief) {
      ok(res, { status: "none", message: "No briefs generated yet. POST /api/generate-brief to start." });
      return;
    }

    ok(res, {
      id: brief.id,
      status: brief.status,
      role: brief.role,
      data: brief.data ? JSON.parse(brief.data) : null,
      createdAt: brief.createdAt,
      updatedAt: brief.updatedAt,
    });
  } catch (err) {
    req.log.error({ err }, "brief live error");
    fail(res, "Internal server error", 500);
  }
});

// GET /api/brief/:id — fetch a specific brief by ID
router.get("/brief/:id", requireAuth, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { fail(res, "Invalid brief id"); return; }
  const userId = req.auth!.userId;

  try {
    const [brief] = await db.select().from(contextBriefs)
      .where(and(eq(contextBriefs.id, id), eq(contextBriefs.userId, userId)))
      .limit(1);

    if (!brief) { fail(res, "Brief not found", 404); return; }

    ok(res, {
      id: brief.id,
      jobId: brief.jobId,
      status: brief.status,
      role: brief.role,
      data: brief.data ? JSON.parse(brief.data) : null,
      createdAt: brief.createdAt,
      updatedAt: brief.updatedAt,
    });
  } catch (err) {
    req.log.error({ err }, "get brief error");
    fail(res, "Internal server error", 500);
  }
});

export default router;
