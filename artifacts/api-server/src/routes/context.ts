import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, documents } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { fail, ok } from "../lib/response.js";

type Role = "backend" | "frontend" | "pm";
const VALID_ROLES: Role[] = ["backend", "frontend", "pm"];

function parseRole(raw: unknown): Role {
  if (typeof raw === "string" && VALID_ROLES.includes(raw as Role)) return raw as Role;
  return "backend";
}

const BRIEFS: Record<Role, object> = {
  backend: {
    keyInsight: "The Payments team is migrating auth to JWT. Your work begins in the token validation layer.",
    nextAction: "Review the Auth v2 system design doc and sync with Sarah Chen before sprint kickoff.",
    whyMatters: "Auth v2 is the highest-priority backend initiative this quarter. Missing context here delays your first meaningful contribution.",
    confidence: 91,
    suggestedPerson: { name: "Sarah Chen", role: "Tech Lead, Payments" },
    reasoning: [
      "Your role maps to 3 active backend PRDs in the Payments cluster",
      "Sarah Chen is the primary contributor on 6 of your relevant docs",
      "Auth v2 is flagged as highest-priority in Q2 planning docs",
    ],
  },
  frontend: {
    keyInsight: "The design system is migrating to Radix primitives. New components ship in 2 sprints.",
    nextAction: "Clone the design-system repo and review the component migration guide with Mei Zhou.",
    whyMatters: "Every frontend team in the org is a consumer of this system. Getting ahead of the migration saves weeks of rework.",
    confidence: 87,
    suggestedPerson: { name: "Mei Zhou", role: "Design Systems Lead" },
    reasoning: [
      "Your role matches 4 open frontend tasks in the design-system project",
      "Mei Zhou is actively reviewing PRs in the codebase you'll own",
      "Component migration is the highest-impact frontend initiative this month",
    ],
  },
  pm: {
    keyInsight: "Auth v2 is at 60% completion. The team needs a PM to own the rollout plan and stakeholder comms.",
    nextAction: "Read the Auth v2 PRD, then schedule an alignment call with Ravi Patel and the eng leads.",
    whyMatters: "Without a PM owner, engineering is making product decisions in isolation. You're the missing link.",
    confidence: 89,
    suggestedPerson: { name: "Ravi Patel", role: "Head of Product" },
    reasoning: [
      "Your role matches the open PM seat on the Payments squad",
      "Ravi Patel is the direct stakeholder for all Q2 product initiatives",
      "Auth v2 rollout lacks a PM owner — flagged in 3 recent planning docs",
    ],
  },
};

const TEAM: Record<Role, object[]> = {
  backend: [
    { initials: "SC", name: "Sarah Chen", role: "Tech Lead", color: "#6366f1", tags: ["Auth", "APIs", "Infra"], why: "Owns the systems your role touches directly." },
    { initials: "JK", name: "James Kirk", role: "DevOps", color: "#8b5cf6", tags: ["CI/CD", "K8s", "Infra"], why: "Controls the deploy pipeline you'll use daily." },
    { initials: "TP", name: "Tom Park", role: "Backend Eng", color: "#64748b", tags: ["Payments", "Go", "gRPC"], why: "Your onboarding pair for the first sprint." },
  ],
  frontend: [
    { initials: "MZ", name: "Mei Zhou", role: "Design Systems", color: "#14b8a6", tags: ["React", "Radix", "Tokens"], why: "Your primary collaborator on component work." },
    { initials: "LF", name: "Lena Fox", role: "Frontend Eng", color: "#6366f1", tags: ["TypeScript", "Vite", "Perf"], why: "Owns the frontend build system you'll work in." },
    { initials: "JL", name: "Jordan Lee", role: "UI Eng", color: "#8b5cf6", tags: ["a11y", "Motion", "CSS"], why: "Go-to for accessibility and animation questions." },
  ],
  pm: [
    { initials: "RP", name: "Ravi Patel", role: "Head of Product", color: "#f59e0b", tags: ["Roadmap", "Strategy", "OKRs"], why: "Your direct stakeholder for all Q2 launches." },
    { initials: "SC", name: "Sarah Chen", role: "Tech Lead", color: "#6366f1", tags: ["Engineering", "Scoping"], why: "Key technical partner for feature scoping." },
    { initials: "AN", name: "Anya Nair", role: "Product Analyst", color: "#14b8a6", tags: ["Metrics", "SQL", "Funnels"], why: "Provides data to back your product decisions." },
  ],
};

const GRAPH_NODES = [
  { id: "you", label: "You", type: "user", color: "#6366f1" },
  { id: "team", label: "Team", type: "team", color: "#8b5cf6" },
  { id: "docs", label: "Docs", type: "documents", color: "#64748b" },
  { id: "tasks", label: "Tasks", type: "tasks", color: "#14b8a6" },
  { id: "tools", label: "Tools", type: "tools", color: "#f59e0b" },
];

const GRAPH_EDGES = [
  { from: "you", to: "team", type: "USER_TO_TEAM", label: "member of" },
  { from: "you", to: "docs", type: "USER_TO_DOC", label: "assigned reading" },
  { from: "you", to: "tasks", type: "USER_TO_TASK", label: "assigned tasks" },
  { from: "you", to: "tools", type: "USER_TO_TOOL", label: "has access" },
  { from: "team", to: "docs", type: "TEAM_TO_DOC", label: "owns" },
  { from: "tasks", to: "tools", type: "TASK_TO_TOOL", label: "requires" },
];

const router = Router();

router.get("/context/brief", (req: Request, res: Response) => {
  const role = parseRole(req.query.role);
  ok(res, BRIEFS[role]);
});

router.get("/context/team", (req: Request, res: Response) => {
  const role = parseRole(req.query.role);
  ok(res, TEAM[role]);
});

async function recommendedDocuments(req: Request, res: Response) {
  const orgId = req.auth!.organizationId;
  if (!orgId) { fail(res, "Organization required", 403); return; }
  const orgDocs = await db.select({ id: documents.id, title: documents.title }).from(documents)
    .where(eq(documents.organizationId, orgId)).limit(20);
  ok(res, orgDocs.map((document) => ({ name: document.title, why: "Uploaded to your current workspace." })));
}
router.get("/context/documents", requireAuth, recommendedDocuments);

router.get("/context-graph", requireAuth, async (req: Request, res: Response) => {
  const orgId = req.auth!.organizationId;
  if (!orgId) { fail(res, "Organization required", 403); return; }
  const orgDocs = await db.select({ id: documents.id, title: documents.title }).from(documents)
    .where(eq(documents.organizationId, orgId)).limit(5);
  const extraNodes = orgDocs.map((d) => ({ id: `doc-${d.id}`, label: d.title, type: "document", color: "#64748b" }));
  const extraEdges = orgDocs.map((d) => ({ from: "docs", to: `doc-${d.id}`, type: "DOC_TO_FILE", label: "contains" }));
  ok(res, {
    nodes: [...GRAPH_NODES, ...extraNodes],
    edges: [...GRAPH_EDGES, ...extraEdges],
  });
});

router.get("/team", (req: Request, res: Response) => {
  const role = parseRole(req.query.role);
  ok(res, TEAM[role]);
});

router.get("/documents/recommended", requireAuth, recommendedDocuments);

export default router;
