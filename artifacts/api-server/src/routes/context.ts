import { Router, type Request, type Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, contextBriefs, documents } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { fail, ok } from "../lib/response.js";
import { parseStoredBrief, parseTeamDirectory } from "../services/onboarding-data.js";

const router = Router();
const roles = z.enum(["backend", "frontend", "pm"]);

router.get("/context/brief", requireAuth, async (req: Request, res: Response) => {
  const orgId = req.auth!.organizationId;
  if (!orgId) { fail(res, "Organization required", 403); return; }
  const role = roles.safeParse(req.query.role ?? req.auth!.role);
  if (!role.success) { fail(res, "role must be backend, frontend, or pm"); return; }
  const [brief] = await db.select().from(contextBriefs)
    .where(and(eq(contextBriefs.organizationId, orgId), eq(contextBriefs.userId, req.auth!.userId), eq(contextBriefs.role, role.data)))
    .orderBy(desc(contextBriefs.createdAt), desc(contextBriefs.id)).limit(1);
  const status = brief?.status ?? "none";
  if (!["none", "pending", "processing", "done", "failed"].includes(status)) {
    fail(res, "Saved brief is unavailable. Generate a new brief.", 500); return;
  }
  if (status !== "done") {
    ok(res, {
      status, briefId: brief?.id, role: role.data,
      keyInsight: status === "none" ? "No onboarding brief has been generated for this workspace." : status === "failed" ? "Brief generation failed." : "Your onboarding brief is being generated.",
      nextAction: status === "none" ? "Upload workspace knowledge, then generate a brief." : status === "failed" ? "Check your workspace knowledge and retry brief generation." : "Wait for brief generation to finish.",
      whyMatters: "Onboarding guidance should reflect your current workspace knowledge.",
      confidence: 0, suggestedPerson: null, reasoning: [], sources: [],
    }); return;
  }
  const data = parseStoredBrief(brief!.data);
  if (!data) { fail(res, "Saved brief is unavailable. Generate a new brief.", 500); return; }
  ok(res, {
    status, briefId: brief!.id, role: role.data,
    keyInsight: data.goal, nextAction: data.nextAction, whyMatters: data.whyThisMatters,
    confidence: Math.round(data.confidence),
    suggestedPerson: data.keyPerson.trim() ? { name: data.keyPerson, role: "" } : null,
    reasoning: data.explanation ? [data.explanation] : [], sources: data.sources,
  });
});

async function workspaceTeam(req: Request, res: Response) {
  const orgId = req.auth!.organizationId;
  if (!orgId) { fail(res, "Organization required", 403); return; }
  const [directory] = await db.select({ content: documents.content }).from(documents)
    .where(and(eq(documents.organizationId, orgId), eq(documents.title, "Team Structure"), eq(documents.fileType, "application/json")))
    .orderBy(desc(documents.createdAt), desc(documents.id)).limit(1);
  if (!directory) { ok(res, []); return; }
  const members = parseTeamDirectory(directory.content);
  if (!members) { fail(res, "The uploaded team directory is invalid. Upload names and roles again.", 422); return; }
  ok(res, members.map((member) => ({
    name: member.name, role: member.role, tags: member.tags,
    initials: member.name.split(/\s+/u).slice(0, 2).map((part) => Array.from(part)[0]).join("").toUpperCase(),
    color: "#6366f1", why: "Listed in your workspace's uploaded team directory.",
  })));
}
router.get("/context/team", requireAuth, workspaceTeam);
router.get("/team", requireAuth, workspaceTeam);

async function recommendedDocuments(req: Request, res: Response) {
  const orgId = req.auth!.organizationId;
  if (!orgId) { fail(res, "Organization required", 403); return; }
  const orgDocs = await db.select({ id: documents.id, title: documents.title }).from(documents)
    .where(eq(documents.organizationId, orgId)).orderBy(desc(documents.createdAt), desc(documents.id)).limit(20);
  ok(res, orgDocs.map((document) => ({ name: document.title, why: "Uploaded to your current workspace." })));
}
router.get("/context/documents", requireAuth, recommendedDocuments);
router.get("/documents/recommended", requireAuth, recommendedDocuments);

router.get("/context-graph", requireAuth, async (req: Request, res: Response) => {
  const orgId = req.auth!.organizationId;
  if (!orgId) { fail(res, "Organization required", 403); return; }
  const orgDocs = await db.select({ id: documents.id, title: documents.title, userId: documents.userId }).from(documents)
    .where(eq(documents.organizationId, orgId)).orderBy(desc(documents.createdAt), desc(documents.id)).limit(20);
  const workspaceId = `workspace-${orgId}`;
  ok(res, {
    nodes: [
      { id: "you", label: "You", type: "user", color: "#6366f1" },
      { id: workspaceId, label: "Current workspace", type: "workspace", color: "#8b5cf6" },
      ...orgDocs.map((d) => ({ id: `doc-${d.id}`, label: d.title, type: "document", color: "#64748b" })),
    ],
    edges: [
      { from: "you", to: workspaceId, type: "USER_TO_WORKSPACE", label: "active workspace" },
      ...orgDocs.flatMap((d) => [
        { from: workspaceId, to: `doc-${d.id}`, type: "WORKSPACE_TO_DOC", label: "contains" },
        ...(d.userId === req.auth!.userId ? [{ from: "you", to: `doc-${d.id}`, type: "USER_TO_DOC", label: "uploaded" }] : []),
      ]),
    ],
  });
});

export default router;
