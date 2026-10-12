import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../lib/response.js";
import { resolveWebhookOrganization } from "../services/webhook-credentials.js";
import { ingestServiceEvent } from "../services/event-ingestion.js";
const router = Router();
router.use("/ingest/webhook", async (req, res, next) => {
  const organizationId = await resolveWebhookOrganization(req);
  if (!organizationId) { fail(res, "Invalid or missing webhook key", 401); return; }
  res.locals.organizationId = organizationId; next();
});
const bounded = z.string().trim().min(1).max(300);
const genericSchema = z.object({ service: bounded, title: bounded, description: z.string().max(16000).optional(),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  type: z.enum(["alert", "failure", "deployment", "recovery", "info"]).default("alert"),
  status: z.enum(["healthy", "at_risk", "degraded", "failing"]).optional(),
  eventId: bounded.optional(), occurredAt: z.string().datetime({ offset: true }).optional() });
router.post("/ingest/webhook", async (req, res) => {
  const parsed = genericSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid webhook payload"); return; }
  const data = parsed.data;
  const result = await ingestServiceEvent(res.locals.organizationId, { ...data,
    externalId: data.eventId ? `generic:${data.eventId}` : undefined,
    occurredAt: data.occurredAt ? new Date(data.occurredAt) : undefined });
  ok(res, { ingested: true, service: data.service, eventTitle: data.title, ...result });
});
const legacySchema = z.object({ messages: z.array(z.object({ id: bounded.optional(), event: z.enum(["trigger", "acknowledge", "resolve"]).default("trigger"),
  payload: z.object({ summary: bounded.default("PagerDuty alert"), severity: z.enum(["critical", "error", "warning", "info"]).default("warning"),
    source: bounded.optional(), component: bounded.optional(), custom_details: z.record(z.string().max(16000)).optional() }).default({}),
})).min(1).max(100) });
const pagerDutySchema = z.object({ event: z.object({ id: bounded, event_type: bounded,
  occurred_at: z.string().datetime({ offset: true }), data: z.object({ title: bounded,
    urgency: z.enum(["high", "low"]).optional(), service: z.object({ name: bounded.optional(), summary: bounded.optional() }) }),
}) });
router.post("/ingest/webhook/pagerduty", async (req, res) => {
  const orgId = res.locals.organizationId as number;
  const v3 = pagerDutySchema.safeParse(req.body);
  if (v3.success) {
    const event = v3.data.event;
    const status = { "incident.triggered": "failing", "incident.acknowledged": "degraded", "incident.resolved": "healthy" }[event.event_type];
    if (!status) { ok(res, { ingested: false, ignored: true }); return; }
    const service = event.data.service.name ?? event.data.service.summary;
    if (!service) { fail(res, "PagerDuty service name is required"); return; }
    const result = await ingestServiceEvent(orgId, { service, title: `[PagerDuty] ${event.data.title}`,
      type: status === "healthy" ? "recovery" : "alert", severity: event.data.urgency === "low" ? "warning" : "critical",
      status: status as "healthy" | "degraded" | "failing", externalId: `pagerduty:${event.id}`, occurredAt: new Date(event.occurred_at) });
    ok(res, { ingested: true, services: [service], ...result }); return;
  }
  const legacy = legacySchema.safeParse(req.body);
  if (!legacy.success) { fail(res, "Invalid PagerDuty payload"); return; }
  const names: string[] = [];
  for (const message of legacy.data.messages) {
    const payload = message.payload;
    const service = (payload.source ?? payload.component ?? "Unknown Service").split(".")[0]
      .replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
    await ingestServiceEvent(orgId, { service, title: `[PagerDuty] ${payload.summary}`,
      type: message.event === "resolve" ? "recovery" : "alert", severity: payload.severity === "error" ? "critical" : payload.severity,
      status: message.event === "resolve" ? "healthy" : message.event === "acknowledge" ? "degraded" : "failing",
      externalId: message.id ? `pagerduty:${message.id}` : undefined,
      description: payload.custom_details ? JSON.stringify(payload.custom_details) : undefined });
    names.push(service);
  }
  ok(res, { ingested: true, services: names });
});
export default router;
