import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
const mocks = vi.hoisted(() => ({ org: vi.fn(), ingest: vi.fn() }));
vi.mock("../../services/webhook-credentials.js", () => ({ resolveWebhookOrganization: mocks.org }));
vi.mock("../../services/event-ingestion.js", () => ({ ingestServiceEvent: mocks.ingest }));
import router from "../webhook.js";
let server: Server; let base: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use(router);
  server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
beforeEach(() => { vi.clearAllMocks(); mocks.org.mockResolvedValue(10); mocks.ingest.mockResolvedValue({ duplicate: false, eventId: 1 }); });
async function post(body: unknown, suffix = "") { return fetch(`${base}/ingest/webhook${suffix}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
describe("webhook ingestion routes", () => {
  it("rejects unauthenticated deliveries before ingestion", async () => {
    mocks.org.mockResolvedValue(null); expect((await post({})).status).toBe(401); expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it.each([{ service: 12, title: "x" }, { service: "x", title: [] }, { service: "x", title: "x", severity: "wrong" }])("rejects malformed payloads", async (body) => {
    expect((await post(body)).status).toBe(400); expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("passes generic event IDs and timestamps to atomic ingestion", async () => {
    expect((await post({ service: "DB", title: "failure", eventId: "123", occurredAt: "2026-10-12T00:00:00Z" })).status).toBe(200);
    expect(mocks.ingest).toHaveBeenCalledWith(10, expect.objectContaining({ externalId: "generic:123", occurredAt: expect.any(Date) }));
  });
  it("handles actual PagerDuty V3 payloads", async () => {
    const response = await post({ event: { id: "delivery", event_type: "incident.resolved", occurred_at: "2026-10-12T00:00:00Z",
      data: { title: "Recovered", urgency: "high", service: { name: "DB" } } } }, "/pagerduty");
    expect(response.status).toBe(200); expect(mocks.ingest).toHaveBeenCalledWith(10, expect.objectContaining({ externalId: "pagerduty:delivery", status: "healthy" }));
  });
});
