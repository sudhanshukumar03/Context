import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { ok, fail } from "../lib/response.js";
import { resolveWebhookOrganization } from "../services/webhook-credentials.js";
import { ingestServiceEvent } from "../services/event-ingestion.js";
const router = Router();
const bounded = z.string().trim().min(1).max(200);
const schema = z.object({ repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/), service: bounded,
  environment: bounded, sha: z.string().regex(/^[a-f0-9]{40,64}$/), runId: z.string().regex(/^\d+$/).max(30),
  runAttempt: z.number().int().positive().default(1), status: z.enum(["started", "success", "failure"]),
  occurredAt: z.string().datetime({ offset: true }).optional() });
router.post("/ingest/github-actions", async (req, res) => {
  const orgId = await resolveWebhookOrganization(req);
  if (!orgId) { fail(res, "Invalid or missing webhook key", 401); return; }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid GitHub Actions deployment payload"); return; }
  const data = parsed.data;
  const externalId = "github-actions:" + createHash("sha256").update(JSON.stringify([
    data.repository, data.runId, data.runAttempt, data.service, data.environment, data.status,
  ])).digest("hex");
  const result = await ingestServiceEvent(orgId, { service: data.service,
    title: `[GitHub Actions] ${data.service} deployment ${data.status}`,
    description: JSON.stringify({ repository: data.repository, environment: data.environment, sha: data.sha,
      runUrl: `https://github.com/${data.repository}/actions/runs/${data.runId}`, runAttempt: data.runAttempt }),
    type: "deployment", severity: data.status === "failure" ? "critical" : "info", externalId,
    // A successful deployment is evidence, not a service health check.
    occurredAt: data.occurredAt ? new Date(data.occurredAt) : undefined });
  ok(res, { ingested: true, service: data.service, ...result });
});
export default router;
