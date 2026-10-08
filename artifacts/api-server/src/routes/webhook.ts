import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, services, serviceEvents, users } from "@workspace/db";
import { ok, fail } from "../lib/response.js";

const router = Router();

// ── Resolve organization from API key (Clerk user ID) ─────────────────────────

async function resolveOrg(apiKey: string): Promise<number | null> {
  if (!apiKey) return null;
  const [clerkUser] = await db.select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.clerkUserId, apiKey))
    .limit(1);
  if (clerkUser?.organizationId) return clerkUser.organizationId;

  // Fallback for internal JWT users / numeric ID
  const numericId = apiKey.startsWith("user_") ? parseInt(apiKey.slice(5), 10) : parseInt(apiKey, 10);
  if (!isNaN(numericId)) {
    const [localUser] = await db.select({ organizationId: users.organizationId })
      .from(users)
      .where(eq(users.id, numericId))
      .limit(1);
    return localUser?.organizationId ?? null;
  }
  return null;
}

// ── Upsert service by name within an org ──────────────────────────────────────

async function upsertService(orgId: number, name: string): Promise<number> {
  const [existing] = await db.select({ id: services.id })
    .from(services)
    .where(and(eq(services.organizationId, orgId), eq(services.name, name)))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(services)
    .values({ organizationId: orgId, name, status: "healthy" })
    .returning({ id: services.id });
  return created.id;
}

// ── POST /api/ingest/webhook ───────────────────────────────────────────────────
// Generic webhook format — works with any alerting tool that supports JSON webhooks.
//
// Authentication: pass your Clerk user ID as the ?apiKey= query param.
// You can find it in the dashboard under Settings → Webhook Integration.
//
// Payload shape:
// {
//   "service": "Payments API",              ← service name (auto-created if not exists)
//   "title": "Connection pool at 94%",      ← event title
//   "description": "...",                   ← optional detail
//   "severity": "critical",                 ← "info" | "warning" | "critical"
//   "type": "alert",                        ← "alert" | "failure" | "deployment" | "recovery"
//   "status": "failing"                     ← optional: update service status
// }

router.post("/ingest/webhook", async (req: Request, res: Response) => {
  const apiKey =
    (req.query.apiKey as string) ||
    (req.query.apikey as string) ||
    (req.headers["x-api-key"] as string) ||
    (req.headers.authorization?.replace(/^Bearer\s+/i, "") as string) ||
    "";
  const orgId = await resolveOrg(apiKey);
  if (!orgId) {
    fail(res, "Invalid or missing API key. Provide via ?apiKey= query param, X-API-Key, or Authorization header", 401);
    return;
  }

  const body = req.body as {
    service?: string;
    title?: string;
    description?: string;
    severity?: string;
    type?: string;
    status?: string;
  };

  const serviceName = body.service?.trim();
  const title = body.title?.trim();
  if (!serviceName || !title) {
    fail(res, "service and title are required");
    return;
  }

  const severity = (["info", "warning", "critical"].includes(body.severity ?? "")
    ? body.severity : "warning") as "info" | "warning" | "critical";
  const type = (["alert", "failure", "deployment", "recovery", "info"].includes(body.type ?? "")
    ? body.type : "alert") as "alert" | "failure" | "deployment" | "recovery" | "info";

  try {
    const serviceId = await upsertService(orgId, serviceName);

    if (body.status && ["healthy", "at_risk", "degraded", "failing"].includes(body.status)) {
      await db.update(services)
        .set({ status: body.status as "healthy" | "at_risk" | "degraded" | "failing", updatedAt: new Date() })
        .where(eq(services.id, serviceId));
    }

    await db.insert(serviceEvents).values({
      organizationId: orgId,
      serviceId,
      type,
      title,
      description: body.description ?? null,
      severity,
    });

    ok(res, { ingested: true, service: serviceName, eventTitle: title });
  } catch (err) {
    const logger = (req as { log?: { error: (o: object, m: string) => void } }).log;
    logger?.error({ err }, "generic webhook error");
    fail(res, "Webhook ingestion failed", 500);
  }
});

// ── POST /api/ingest/webhook/pagerduty ─────────────────────────────────────────
// Accepts PagerDuty webhook V3 messages format.
// Configure in PagerDuty: Integrations → Generic Webhook → URL: /api/ingest/webhook/pagerduty?apiKey=<id>
//
// Supports: trigger, acknowledge, resolve events

router.post("/ingest/webhook/pagerduty", async (req: Request, res: Response) => {
  const apiKey =
    (req.query.apiKey as string) ||
    (req.query.apikey as string) ||
    (req.headers["x-api-key"] as string) ||
    (req.headers.authorization?.replace(/^Bearer\s+/i, "") as string) ||
    "";
  const orgId = await resolveOrg(apiKey);
  if (!orgId) {
    fail(res, "Invalid or missing API key. Provide via ?apiKey= query param, X-API-Key, or Authorization header", 401);
    return;
  }

  const body = req.body as {
    messages?: Array<{
      event?: string;
      payload?: {
        summary?: string;
        severity?: string;
        source?: string;
        component?: string;
        custom_details?: Record<string, string>;
      };
    }>;
  };

  const messages = body.messages ?? [];
  if (!messages.length) {
    fail(res, "No messages in PagerDuty payload");
    return;
  }

  const ingested: string[] = [];

  try {
    for (const msg of messages) {
      const event = msg.event ?? "trigger";
      const payload = msg.payload ?? {};
      const title = payload.summary ?? "PagerDuty alert";
      const rawSource = payload.source ?? payload.component ?? "Unknown Service";
      // Normalise source to a service name
      const serviceName = rawSource.split(".")[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

      const pdSeverityMap: Record<string, "info" | "warning" | "critical"> = {
        critical: "critical", error: "critical", warning: "warning", info: "info",
      };
      const severity = pdSeverityMap[payload.severity ?? "warning"] ?? "warning";

      const typeMap: Record<string, "alert" | "failure" | "recovery"> = {
        trigger: "alert", acknowledge: "alert", resolve: "recovery",
      };
      const type = typeMap[event] ?? "alert";

      const statusMap: Record<string, "healthy" | "degraded" | "failing"> = {
        trigger: "failing", acknowledge: "degraded", resolve: "healthy",
      };
      const status = statusMap[event] ?? "at_risk";

      const serviceId = await upsertService(orgId, serviceName);

      await db.update(services)
        .set({ status, updatedAt: new Date() })
        .where(eq(services.id, serviceId));

      await db.insert(serviceEvents).values({
        organizationId: orgId,
        serviceId,
        type,
        title: `[PagerDuty] ${title}`,
        description: payload.custom_details ? JSON.stringify(payload.custom_details) : null,
        severity,
      });

      ingested.push(serviceName);
    }

    ok(res, { ingested: true, services: ingested });
  } catch (err) {
    const logger = (req as { log?: { error: (o: object, m: string) => void } }).log;
    logger?.error({ err }, "pagerduty webhook error");
    fail(res, "PagerDuty webhook ingestion failed", 500);
  }
});

export default router;
