import { Router, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, contextBriefs, documents } from "@workspace/db";
import { callAi, logAiError, outputSchemas, safeParseJson, withRetry } from "../services/ai.service.js";
import { z } from "zod";
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

export async function generateBriefAsync(briefId: number, role: string, orgId: number, requestId?: string, jobId?: string) {
  const startedAt = Date.now();
  const correlation = { briefId, jobId, organizationId: orgId, requestId };
  const scopedId = and(eq(contextBriefs.id, briefId), eq(contextBriefs.organizationId, orgId));
  try {
    await db.update(contextBriefs)
      .set({ status: "processing", updatedAt: new Date() })
      .where(scopedId);

    const orgDocs = await db.select().from(documents)
      .where(eq(documents.organizationId, orgId))
      .limit(10);

    const roleLabel = role === "pm" ? "Product Manager" : role === "frontend" ? "Frontend Developer" : "Backend Developer";
    const docsContext = orgDocs.length > 0
      ? orgDocs.map((d) => `Document: ${d.title}\n${d.content.slice(0, 800)}`).join("\n---\n")
      : "No company documents uploaded yet. Use general software engineering onboarding knowledge.";

    const userMessage = `Generate an onboarding Context Brief for a new ${roleLabel}. Company knowledge:\n\n${docsContext}`;

    const data = await withRetry("brief", async () =>
      safeParseJson(await callAi(BRIEF_SYSTEM_PROMPT, userMessage, 2048), outputSchemas.brief));

    await db.update(contextBriefs)
      .set({ status: "done", data: JSON.stringify(data), updatedAt: new Date() })
      .where(scopedId);

    logger.info({ ...correlation, elapsedMs: Date.now() - startedAt }, "brief generation complete");
  } catch (err) {
    logger.error({ ...correlation, elapsedMs: Date.now() - startedAt }, "brief generation failed");
    logAiError("background-brief", err);
    try {
      await db.update(contextBriefs).set({ status: "failed", updatedAt: new Date() }).where(scopedId);
    } catch {
      logger.error(correlation, "brief failure state could not be persisted; recovery required");
    }
  }
}

// POST /api/generate-brief — enqueue a brief generation job
router.post("/generate-brief", requireAuth, async (req: Request, res: Response) => {
  const parsed = z.enum(["backend", "frontend", "pm"]).safeParse(req.body?.role ?? req.auth!.role ?? "backend");
  if (!parsed.success) { fail(res, "role must be backend, frontend, or pm"); return; }
  const role = parsed.data;
  const orgId = req.auth!.organizationId;
  if (!orgId) { fail(res, "Organization required", 403); return; }
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
    setImmediate(() => { void generateBriefAsync(brief.id, role, orgId, String(req.id), jobId)
      .catch(() => logger.error({ briefId: brief.id, jobId, organizationId: orgId }, "brief dispatch failed")); });

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
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) { fail(res, "Invalid brief id"); return; }
  const userId = req.auth!.userId;
  const orgId = req.auth!.organizationId;
  if (!orgId) { fail(res, "Organization required", 403); return; }

  try {
    const [brief] = await db.select().from(contextBriefs)
      .where(and(eq(contextBriefs.id, id), eq(contextBriefs.userId, userId), eq(contextBriefs.organizationId, orgId)))
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
