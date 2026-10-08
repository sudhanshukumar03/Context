import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, documents } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { ok, fail } from "../lib/response.js";
import {
  generateContextBrief,
  askQuestion,
  explainDocument,
  breakdownTask,
  explainRelationship,
  generateDailyFocus,
  simplifyConcept,
  logAiError,
} from "../services/ai.service.js";

const router = Router();

// ─── Zod schemas ────────────────────────────────────────────────────────────

const AskSchema = z.object({
  question: z.string().min(1).max(1000),
  contextData: z.string().optional(),
});

const ExplainDocSchema = z.object({
  docId: z.number().int().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  role: z.enum(["backend", "frontend", "pm"]).default("backend"),
});

const BreakdownTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  role: z.enum(["backend", "frontend", "pm"]).optional(),
});

const RelationshipSchema = z.object({
  entityId: z.string().min(1),
  entityLabel: z.string().min(1),
  graph: z.object({
    nodes: z.array(z.object({ id: z.string(), label: z.string(), type: z.string() })),
    edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })),
  }),
});

const DailyFocusSchema = z.object({
  role: z.enum(["backend", "frontend", "pm"]).default("backend"),
  recentActivity: z.array(z.string()).optional(),
  pendingTasks: z.array(z.string()).optional(),
  teamUpdates: z.array(z.string()).optional(),
});

const SimplifySchema = z.object({
  concept: z.string().min(1).max(500),
  context: z.string().optional(),
  role: z.string().optional(),
});

// ─── Helper: fetch org documents as context string ──────────────────────────

async function getOrgContext(orgId: number): Promise<string> {
  if (!orgId) return "";
  const docs = await db.select({ title: documents.title, content: documents.content })
    .from(documents)
    .where(eq(documents.organizationId, orgId))
    .limit(8);
  if (!docs.length) return "";
  return docs.map((d) => `[${d.title}]: ${d.content.slice(0, 600)}`).join("\n\n");
}

// ─── 1. POST /api/ai/brief ────────────────────────────────────────────────────

router.post("/ai/brief", requireAuth, async (req: Request, res: Response) => {
  const role = String(req.body.role ?? req.auth!.role ?? "backend");
  const orgId = req.auth!.organizationId ?? 0;

  try {
    const orgDocs = orgId
      ? await db.select({ title: documents.title, content: documents.content })
          .from(documents).where(eq(documents.organizationId, orgId)).limit(8)
      : [];

    const result = await generateContextBrief({
      role,
      documents: orgDocs,
    });
    ok(res, result);
  } catch (err) {
    logAiError("brief", err);
    fail(res, "Brief generation failed", 500);
  }
});

// ─── 2. POST /api/ai/ask ─────────────────────────────────────────────────────

router.post("/ai/ask", requireAuth, async (req: Request, res: Response) => {
  const parsed = AskSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "question is required"); return; }

  const orgId = req.auth!.organizationId ?? 0;

  try {
    let contextData = parsed.data.contextData ?? "";
    if (!contextData && orgId) {
      contextData = await getOrgContext(orgId);
    }
    if (!contextData) {
      contextData = "Company: Tech startup in the payments space. Teams: Backend (Auth/Payments), Frontend (Design Systems). Current priority: Auth v2 migration.";
    }

    const result = await askQuestion({ question: parsed.data.question, contextData });
    ok(res, result);
  } catch (err) {
    logAiError("ask", err);
    fail(res, "Q&A failed", 500);
  }
});

// ─── 3. POST /api/ai/explain-doc ────────────────────────────────────────────

router.post("/ai/explain-doc", requireAuth, async (req: Request, res: Response) => {
  const parsed = ExplainDocSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid request"); return; }

  try {
    let title = parsed.data.title ?? "";
    let content = parsed.data.content ?? "";

    const orgId = req.auth!.organizationId ?? 0;
    if (parsed.data.docId) {
      const [doc] = await db.select().from(documents)
        .where(and(eq(documents.id, parsed.data.docId), eq(documents.organizationId, orgId)))
        .limit(1);
      if (!doc) { fail(res, "Document not found", 404); return; }
      title = doc.title;
      content = doc.content;
    }

    if (!title || !content) { fail(res, "title and content are required"); return; }

    const result = await explainDocument({ title, content, role: parsed.data.role });
    ok(res, result);
  } catch (err) {
    logAiError("explain-doc", err);
    fail(res, "Document explanation failed", 500);
  }
});

// ─── 4. POST /api/ai/breakdown-task ─────────────────────────────────────────

router.post("/ai/breakdown-task", requireAuth, async (req: Request, res: Response) => {
  const parsed = BreakdownTaskSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "title is required"); return; }

  try {
    const result = await breakdownTask({
      title: parsed.data.title,
      description: parsed.data.description,
      role: parsed.data.role,
    });
    ok(res, result);
  } catch (err) {
    logAiError("breakdown-task", err);
    fail(res, "Task breakdown failed", 500);
  }
});

// ─── 5. POST /api/ai/explain-relationship ───────────────────────────────────

router.post("/ai/explain-relationship", requireAuth, async (req: Request, res: Response) => {
  const parsed = RelationshipSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "entityId, entityLabel, and graph are required"); return; }

  try {
    const result = await explainRelationship(parsed.data);
    ok(res, result);
  } catch (err) {
    logAiError("explain-relationship", err);
    fail(res, "Relationship explanation failed", 500);
  }
});

// ─── 6. POST /api/ai/daily-focus ────────────────────────────────────────────

router.post("/ai/daily-focus", requireAuth, async (req: Request, res: Response) => {
  const parsed = DailyFocusSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid request"); return; }

  const orgId = req.auth!.organizationId ?? 0;

  try {
    let teamUpdates = parsed.data.teamUpdates;
    if (!teamUpdates?.length && orgId) {
      const orgDocs = await db.select({ title: documents.title })
        .from(documents).where(eq(documents.organizationId, orgId)).limit(5);
      teamUpdates = orgDocs.map((d) => `New document: ${d.title}`);
    }

    const result = await generateDailyFocus({
      role: parsed.data.role,
      recentActivity: parsed.data.recentActivity,
      pendingTasks: parsed.data.pendingTasks,
      teamUpdates,
    });
    ok(res, result);
  } catch (err) {
    logAiError("daily-focus", err);
    fail(res, "Daily focus generation failed", 500);
  }
});

// ─── 7. POST /api/ai/simplify ───────────────────────────────────────────────

router.post("/ai/simplify", requireAuth, async (req: Request, res: Response) => {
  const parsed = SimplifySchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "concept is required"); return; }

  try {
    const result = await simplifyConcept(parsed.data);
    ok(res, result);
  } catch (err) {
    logAiError("simplify", err);
    fail(res, "Simplification failed", 500);
  }
});

export default router;
