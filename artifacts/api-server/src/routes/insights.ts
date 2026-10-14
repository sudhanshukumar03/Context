import { serviceRiskSignals } from "../services/incident-risk.js";
import { Router, type Request, type Response } from "express";
import { eq, desc, inArray, and, gte } from "drizzle-orm";
import { db, services, serviceDependencies, serviceEvents, serviceMessages } from "@workspace/db";
import { requireAuth } from "../middleware/auth.js";
import { requireOrganizationAdmin } from "../middleware/organization-permissions.js";
import { ok, fail } from "../lib/response.js";
import { failAi } from "../lib/ai-response.js";
import { requestIncidentAnswer } from "../services/incident-ai.js";
import { logAiError } from "../services/ai.service.js";
import { runAiTool } from "./ai-tools-execution.js";
import { z } from "zod";

const router = Router();
const summaryQuery = z.object({ limit: z.preprocess(value => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().min(1).max(100).default(50)) });
const incidentAudience = {
  engineer: "Audience: Engineer. Prioritize technical evidence, recent deployments/configuration, dependency causality, and concrete diagnostic checks. Separate hypotheses from confirmed causes. Do not invent logs, metrics, commands or infrastructure identifiers. Describe remediation as proposed checks or actions; never imply it ran.",
  sre: "Audience: SRE. Prioritize current service health, dependency exposure, failure propagation, response priorities and recovery verification. Distinguish historical alerts from current status. Do not invent SLOs, MTTR, incident timing or recovery estimates when the context does not establish them.",
  manager: "Audience: Manager. Use plain language and prioritize observed status, confirmed customer/business impact, coordination and follow-up decisions. Explain what is unknown. Do not infer financial loss, affected customer counts, an ETA or global incident closure from service health alone. Avoid command-level instructions; actions should be communication, ownership or verification steps.",
};

// ── GET /insights/risks ───────────────────────────────────────────────────────
// Services that depend on a failing/degraded service within the last 24h

router.get("/insights/risks", requireAuth, async (req: Request, res: Response) => {
  const orgId = req.auth!.organizationId ?? 0;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // Get all service statuses
    const allServices = await db.select()
      .from(services)
      .where(eq(services.organizationId, orgId));

    const orgServiceIds = allServices.map((s) => s.id);
    // Current telemetry determines active risk; old alerts remain in the timeline.
    const failingServiceIds = allServices.filter((s) => s.status === "failing" || s.status === "degraded").map((s) => s.id);
    // Build dependency map: strictly scope dependencies to the organization
    const deps = (orgServiceIds.length && failingServiceIds.length)
      ? await db.select()
          .from(serviceDependencies)
          .where(and(
            inArray(serviceDependencies.serviceId, orgServiceIds),
            inArray(serviceDependencies.dependsOnId, failingServiceIds)
          ))
      : [];

    const atRiskIds = new Set(deps.map((d) => d.serviceId));

    // Project service statuses dynamically in memory without mutating database on GET
    const updatedServices = allServices.map((svc) => {
      if (svc.status === "healthy" && atRiskIds.has(svc.id)) {
        return { ...svc, status: "at_risk" };
      }
      return svc;
    });

    const risks = await Promise.all(
      updatedServices
        .filter((s) => s.status === "at_risk" || s.status === "failing" || s.status === "degraded")
        .map(async (svc) => {
          // Find which failing service this depends on
          const dep = deps.find((d) => d.serviceId === svc.id);
          const rootCause = dep
            ? updatedServices.find((s) => s.id === dep.dependsOnId)
            : null;

          const recentEvent = await db.select()
            .from(serviceEvents)
            .where(and(
              eq(serviceEvents.organizationId, orgId),
              eq(serviceEvents.serviceId, svc.id),
              gte(serviceEvents.createdAt, since)
            ))
            .orderBy(desc(serviceEvents.createdAt), desc(serviceEvents.id))
            .limit(1);

          return {
            service: svc,
            rootCause,
            recentEvent: recentEvent[0] ?? null,
            reasoning: rootCause
              ? `${svc.name} depends on ${rootCause.name}, which is currently ${rootCause.status}.`
              : `${svc.name} has recent ${svc.status} events.`,
          };
        })
    );

    ok(res, { risks, services: updatedServices });
  } catch (err) {
    req.log.error({ err }, "risks error");
    fail(res, "Internal server error", 500);
  }
});

// ── GET /insights/graph ───────────────────────────────────────────────────────
// Returns full service dependency graph with health status

router.get("/insights/graph", requireAuth, async (req: Request, res: Response) => {
  const orgId = req.auth!.organizationId ?? 0;
  try {
    const allServices = await db.select().from(services).where(eq(services.organizationId, orgId));
    const orgServiceIds = allServices.map((s) => s.id);
    const allDeps = orgServiceIds.length
      ? await db.select().from(serviceDependencies).where(inArray(serviceDependencies.serviceId, orgServiceIds))
      : [];

    const statusColor: Record<string, string> = {
      healthy: "#22c55e",
      at_risk: "#f59e0b",
      degraded: "#f97316",
      failing: "#ef4444",
    };

    const nodes = allServices.map((s) => ({
      id: String(s.id),
      label: s.name,
      status: s.status,
      color: statusColor[s.status] ?? "#6366f1",
      description: s.description,
      ownerTeam: s.ownerTeam,
      criticality: s.criticality,
    }));

    const edges = allDeps
      .filter((d) => allServices.some((s) => s.id === d.serviceId) && allServices.some((s) => s.id === d.dependsOnId))
      .map((d) => ({
        from: String(d.serviceId),
        to: String(d.dependsOnId),
        label: "depends on",
      }));

    ok(res, { nodes, edges });
  } catch (err) {
    req.log.error({ err }, "graph error");
    fail(res, "Internal server error", 500);
  }
});

// ── GET /insights/timeline ────────────────────────────────────────────────────
// Combined chronological feed of events + messages

router.get("/insights/timeline", requireAuth, async (req: Request, res: Response) => {
  const orgId = req.auth!.organizationId ?? 0;
  const query = summaryQuery.safeParse({ ...req.query, limit: req.query.limit ?? "40" });
  if (!query.success) return fail(res, "limit must be an integer between 1 and 100", 400);
  const limit = query.data.limit;

  try {
    const events = await db.select({
      id: serviceEvents.id,
      type: serviceEvents.type,
      title: serviceEvents.title,
      description: serviceEvents.description,
      severity: serviceEvents.severity,
      serviceId: serviceEvents.serviceId,
      createdAt: serviceEvents.createdAt,
    }).from(serviceEvents)
      .where(eq(serviceEvents.organizationId, orgId))
      .orderBy(desc(serviceEvents.createdAt), desc(serviceEvents.id))
      .limit(limit);

    const messages = await db.select({
      id: serviceMessages.id,
      content: serviceMessages.content,
      author: serviceMessages.author,
      channel: serviceMessages.channel,
      serviceId: serviceMessages.serviceId,
      createdAt: serviceMessages.createdAt,
    }).from(serviceMessages)
      .where(eq(serviceMessages.organizationId, orgId))
      .orderBy(desc(serviceMessages.createdAt), desc(serviceMessages.id))
      .limit(limit);

    const allServices = await db.select({ id: services.id, name: services.name }).from(services)
      .where(eq(services.organizationId, orgId));
    const svcMap = new Map(allServices.map((s) => [s.id, s.name]));

    const feed = [
      ...events.map((e) => ({
        kind: "event" as const,
        id: `evt-${e.id}`,
        title: e.title,
        description: e.description,
        type: e.type,
        severity: e.severity,
        serviceName: e.serviceId ? svcMap.get(e.serviceId) : null,
        createdAt: e.createdAt,
      })),
      ...messages.map((m) => ({
        kind: "message" as const,
        id: `msg-${m.id}`,
        content: m.content,
        author: m.author,
        channel: m.channel,
        serviceName: m.serviceId ? svcMap.get(m.serviceId) : null,
        createdAt: m.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    ok(res, feed);
  } catch (err) {
    req.log.error({ err }, "timeline error");
    fail(res, "Internal server error", 500);
  }
});

// ── POST /demo/seed ───────────────────────────────────────────────────────────
// Seeds sample incident data for the demo flow

router.post("/demo/seed", requireAuth, requireOrganizationAdmin, async (req: Request, res: Response) => {
  const orgId = req.auth!.organizationId ?? 0;

  try {
    // Insert services
    const svcRows: Array<{ id: number; name: string }> = [];
    const svcDefs = [
      { name: "Checkout", description: "Customer checkout and cart service", status: "at_risk" as const, ownerTeam: "frontend", criticality: "high" },
      { name: "Payments API", description: "Payment processing and transaction service", status: "failing" as const, ownerTeam: "payments-team", criticality: "high" },
      { name: "User Auth", description: "Authentication and session management", status: "healthy" as const, ownerTeam: "platform", criticality: "high" },
      { name: "Database", description: "Primary PostgreSQL database cluster", status: "degraded" as const, ownerTeam: "infra", criticality: "high" },
      { name: "Notification Service", description: "Email and push notification delivery", status: "healthy" as const, ownerTeam: "platform", criticality: "medium" },
    ];

    for (const svc of svcDefs) {
      const [row] = await db.insert(services).values({ organizationId: orgId, ...svc }).returning();
      svcRows.push({ id: row.id, name: row.name });
    }

    const byName = new Map(svcRows.map((s) => [s.name, s.id]));

    // Wire dependencies
    const deps: Array<[string, string]> = [
      ["Checkout", "Payments API"],
      ["Checkout", "User Auth"],
      ["Payments API", "Database"],
      ["Notification Service", "Database"],
    ];

    for (const [from, to] of deps) {
      const sId = byName.get(from);
      const dId = byName.get(to);
      if (sId && dId) await db.insert(serviceDependencies).values({ serviceId: sId, dependsOnId: dId });
    }

    // Seed events
    const paymentsId = byName.get("Payments API");
    const checkoutId = byName.get("Checkout");
    const dbId = byName.get("Database");

    const now = new Date();
    const ago = (mins: number) => new Date(now.getTime() - mins * 60 * 1000);

    await db.insert(serviceEvents).values([
      { organizationId: orgId, serviceId: paymentsId, type: "deployment", title: "Payments API v2.4.1 deployed", description: "New payment provider integration deployed to production.", severity: "info", createdAt: ago(92) },
      { organizationId: orgId, serviceId: paymentsId, type: "failure", title: "Payments API: 503 errors spike", description: "Error rate jumped to 34% after deployment. Latency p99 > 8s.", severity: "critical", createdAt: ago(87) },
      { organizationId: orgId, serviceId: checkoutId, type: "alert", title: "Checkout: elevated error rate", description: "Checkout is returning 15% failure rate due to downstream Payments API failures.", severity: "warning", createdAt: ago(82) },
      { organizationId: orgId, serviceId: dbId, type: "alert", title: "Database: connection pool near limit", description: "Connection pool at 89% capacity. Slow queries from Payments API suspected.", severity: "warning", createdAt: ago(75) },
      { organizationId: orgId, serviceId: paymentsId, type: "alert", title: "Payments API: rollback attempted", description: "Auto-rollback to v2.4.0 initiated but blocked by migration lock.", severity: "critical", createdAt: ago(60) },
    ]);

    // Seed messages
    await db.insert(serviceMessages).values([
      { organizationId: orgId, serviceId: paymentsId, content: "@team Payments API is throwing 503s after the v2.4.1 deploy. Looks like the new Stripe provider config is misconfigured.", author: "sarah.chen", channel: "incidents", createdAt: ago(85) },
      { organizationId: orgId, serviceId: checkoutId, content: "Checkout is failing ~15% of orders. Customers are getting \"Payment failed\" errors. Escalating now.", author: "ravi.patel", channel: "incidents", createdAt: ago(80) },
      { organizationId: orgId, serviceId: paymentsId, content: "Root cause identified: the new Stripe webhook URL was misconfigured in the env vars. Hotfix being prepared.", author: "james.kirk", channel: "incidents", createdAt: ago(55) },
      { organizationId: orgId, serviceId: dbId, content: "DB connection pool pressure is coming from Payments retry storms. Applying backoff patch.", author: "sarah.chen", channel: "db-ops", createdAt: ago(45) },
      { organizationId: orgId, content: "Incident P0 declared. ETA to resolution: 30 minutes. Revenue impact: ~$12k/hr.", author: "ops-bot", channel: "incidents", createdAt: ago(40) },
    ]);

    ok(res, { message: "Demo data seeded", services: svcRows.length }, 201);
  } catch (err) {
    req.log.error({ err }, "demo seed error");
    fail(res, "Seed failed", 500);
  }
});

// ── POST /ai/incident-ask ────────────────────────────────────────────────────
// Answers questions using live service graph + recent events/messages as context

router.post("/ai/incident-ask", requireAuth, async (req: Request, res: Response) => {
  const orgId = req.auth!.organizationId ?? 0;
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  try {
    const input = z.object({ question: z.string().trim().min(1).max(4000), role: z.enum(["engineer", "sre", "manager"]).default("sre") }).safeParse(req.body);
    if (!input.success) { fail(res, "question must contain 1–4000 characters and role must be engineer, sre or manager"); return; }
    const { question, role } = input.data;
    const [allServices, recentEvents, recentMessages] = await Promise.all([
      db.select().from(services).where(eq(services.organizationId, orgId)),
      db.select().from(serviceEvents).where(and(eq(serviceEvents.organizationId, orgId), gte(serviceEvents.createdAt, since))).orderBy(desc(serviceEvents.createdAt), desc(serviceEvents.id)).limit(30),
      db.select().from(serviceMessages).where(and(eq(serviceMessages.organizationId, orgId), gte(serviceMessages.createdAt, since))).orderBy(desc(serviceMessages.createdAt), desc(serviceMessages.id)).limit(20),
    ]);

    const orgServiceIds = allServices.map((s) => s.id);
    const allDeps = orgServiceIds.length
      ? await db.select().from(serviceDependencies).where(inArray(serviceDependencies.serviceId, orgServiceIds))
      : [];

    const svcMap = new Map(allServices.map((s) => [s.id, s.name]));

    const serviceContext = allServices.map((s) => `- ${s.name} (status: ${s.status}${s.description ? `, desc: ${s.description}` : ""})`).join("\n");

    const depContext = allDeps
      .filter((d) => svcMap.has(d.serviceId) && svcMap.has(d.dependsOnId))
      .map((d) => `- ${svcMap.get(d.serviceId)} depends on ${svcMap.get(d.dependsOnId)}`)
      .join("\n");

    const eventContext = recentEvents.map((e) =>
      `- [${e.severity.toUpperCase()}] ${svcMap.get(e.serviceId ?? -1) ?? "unknown"}: ${e.title}${e.description ? ` — ${e.description}` : ""} (${e.createdAt.toISOString()})`
    ).join("\n");

    const messageContext = recentMessages.map((m) =>
      `- #${m.channel} @${m.author}: "${m.content}" (${m.createdAt.toISOString()})`
    ).join("\n");

    const systemPrompt = `You are an expert site reliability engineer and incident analyst (AI Incident Commander).
${incidentAudience[role]}
You have access to the following real-time system context:

SERVICES:
${serviceContext || "No services registered."}

DEPENDENCIES:
${depContext || "No dependencies registered."}

RECENT EVENTS (last 48h):
${eventContext || "No recent events."}

RECENT MESSAGES (last 48h):
${messageContext || "No recent messages."}

Answer the user's question using ONLY this context. Be direct, precise, and actionable.
Explain causality — why things are failing, which dependency edges are involved, and what the propagation path is.

You MUST respond with a valid JSON object in this EXACT shape (no markdown, no extra text):
{
  "answer": "Clear, direct 1-2 sentence answer to the question",
  "reasoning": [
    "Step 1: specific causal observation grounded in the event/service data",
    "Step 2: next causal link",
    "Step 3: conclusion or impact"
  ],
  "impact": [
    "User-facing or business impact 1",
    "User-facing or business impact 2"
  ],
  "actions": [
    "Specific actionable fix 1",
    "Specific actionable fix 2"
  ],
  "confidence": 0.0,
  "sources": ["service or event name 1", "service or event name 2"]
}

Rules:
- reasoning must be an array of 2-4 concrete steps, each grounded in an event or dependency
- impact must be an array of 1-3 user-facing consequences
- actions must be an array of 1-3 specific next steps appropriate to the selected audience
- State missing evidence explicitly; do not infer customer impact, a recovery ETA or root cause from a status badge alone
- No hallucination — every claim must map to the provided context
- confidence must be 0.0-1.0 based on evidence density`;

    const parsed = await runAiTool(req, () => requestIncidentAnswer(systemPrompt, question));

    ok(res, parsed);
  } catch (err) {
    logAiError("incident-ask", err, req);
    failAi(res, err, "AI request failed");
  }
});

// ── GET /insights/summary ─────────────────────────────────────────────────────
// Single endpoint that returns all dashboard data — replaces 5-endpoint polling.
// Risk/graph/timeline + rootCause + predictions all in one round-trip.

router.get("/insights/summary", requireAuth, async (req: Request, res: Response) => {
  const query = summaryQuery.safeParse(req.query);
  if (!query.success) return fail(res, "limit must be an integer between 1 and 100", 400);
  const orgId = req.auth!.organizationId ?? 0;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const since6h  = new Date(Date.now() - 6  * 60 * 60 * 1000);
  const limit = query.data.limit;

  try {
    // Run all DB queries in parallel
    const [allServices, allEvents48h, allMessages48h, allEvents6h] = await Promise.all([
      db.select().from(services).where(eq(services.organizationId, orgId)),
      db.select().from(serviceEvents)
        .where(and(eq(serviceEvents.organizationId, orgId), gte(serviceEvents.createdAt, since48h)))
        .orderBy(desc(serviceEvents.createdAt), desc(serviceEvents.id)).limit(Math.max(60, limit)),
      db.select().from(serviceMessages)
        .where(and(eq(serviceMessages.organizationId, orgId), gte(serviceMessages.createdAt, since48h)))
        .orderBy(desc(serviceMessages.createdAt), desc(serviceMessages.id)).limit(Math.max(40, limit)),
      db.select().from(serviceEvents)
        .where(and(eq(serviceEvents.organizationId, orgId), gte(serviceEvents.createdAt, since6h))),
    ]);

    const orgSvcIds = allServices.map((s) => s.id);
    const allDeps = orgSvcIds.length
      ? await db.select().from(serviceDependencies).where(inArray(serviceDependencies.serviceId, orgSvcIds))
      : [];

    const svcMap = new Map(allServices.map((s) => [s.id, s]));

    // ── Risks ──────────────────────────────────────────────────────────────────
    const failingSvcIds = allServices.filter((s) => s.status === "failing" || s.status === "degraded").map((s) => s.id);
    const atRiskDeps = (orgSvcIds.length && failingSvcIds.length)
      ? await db.select().from(serviceDependencies).where(and(
          inArray(serviceDependencies.serviceId, orgSvcIds),
          inArray(serviceDependencies.dependsOnId, failingSvcIds)
        ))
      : [];
    const atRiskIds = new Set(atRiskDeps.map((d) => d.serviceId));
    // Project service statuses dynamically in memory without mutating database on GET
    const updatedServices = allServices.map((svc) => {
      if (svc.status === "healthy" && atRiskIds.has(svc.id)) {
        return { ...svc, status: "at_risk" };
      }
      return svc;
    });

    const risks = await Promise.all(
      updatedServices
        .filter((s) => s.status === "at_risk" || s.status === "failing" || s.status === "degraded")
        .map(async (svc) => {
          const dep = atRiskDeps.find((d) => d.serviceId === svc.id);
          const rootCauseSvc = dep ? updatedServices.find((s) => s.id === dep.dependsOnId) : null;
          const recentEvent = allEvents48h.find((e) => e.serviceId === svc.id && new Date(e.createdAt) >= since24h) ?? null;
          return {
            service: svc,
            rootCause: rootCauseSvc ?? null,
            recentEvent,
            reasoning: rootCauseSvc
              ? `${svc.name} depends on ${rootCauseSvc.name}, which is currently ${rootCauseSvc.status}.`
              : `${svc.name} has recent ${svc.status} events.`,
          };
        })
    );

    // ── Graph ──────────────────────────────────────────────────────────────────
    const statusColor: Record<string, string> = { healthy: "#22c55e", at_risk: "#f59e0b", degraded: "#f97316", failing: "#ef4444" };
    const nodes = updatedServices.map((s) => ({
      id: String(s.id), label: s.name, status: s.status,
      color: statusColor[s.status] ?? "#6366f1",
      description: s.description, ownerTeam: s.ownerTeam, criticality: s.criticality,
    }));
    const edges = allDeps
      .filter((d) => svcMap.has(d.serviceId) && svcMap.has(d.dependsOnId))
      .map((d) => ({ from: String(d.serviceId), to: String(d.dependsOnId), label: "depends on" }));

    // ── Timeline ───────────────────────────────────────────────────────────────
    const feed = [
      ...allEvents48h.slice(0, limit).map((e) => ({
        kind: "event" as const, id: `evt-${e.id}`, title: e.title, description: e.description,
        type: e.type, severity: e.severity,
        serviceName: e.serviceId ? (svcMap.get(e.serviceId)?.name ?? null) : null,
        createdAt: e.createdAt,
      })),
      ...allMessages48h.slice(0, limit).map((m) => ({
        kind: "message" as const, id: `msg-${m.id}`, content: m.content,
        author: m.author, channel: m.channel,
        serviceName: m.serviceId ? (svcMap.get(m.serviceId)?.name ?? null) : null,
        createdAt: m.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);

    // ── Predictions ────────────────────────────────────────────────────────────
    const predictions = serviceRiskSignals(updatedServices, allDeps, allEvents6h);

    ok(res, {
      risks,
      services: updatedServices,
      graph: { nodes, edges },
      timeline: feed,
      predictions: predictions.slice(0, 4),
    });
  } catch (err) {
    req.log.error({ err }, "summary error");
    fail(res, "Internal server error", 500);
  }
});

export default router;

