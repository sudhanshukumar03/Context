import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
const mocks = vi.hoisted(() => ({ org: vi.fn(), ingest: vi.fn() }));
vi.mock("../../services/webhook-credentials.js", () => ({ resolveWebhookOrganization: mocks.org }));
vi.mock("../../services/event-ingestion.js", () => ({ ingestServiceEvent: mocks.ingest }));
import router from "../github-actions.js";
let server: Server; let base: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use(router);
  server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
beforeEach(() => { vi.clearAllMocks(); mocks.org.mockResolvedValue(10); mocks.ingest.mockResolvedValue({ eventId: 1, duplicate: false }); });
const payload = { service: "DB", repository: "team/repo", environment: "production", sha: "a".repeat(40), runId: "123", status: "success" };
async function post(body: object) { return fetch(`${base}/ingest/github-actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
describe("GitHub Actions deployment ingestion", () => {
  it("uses stable replay identities without asserting service recovery", async () => {
    await post(payload); await post(payload);
    const first = mocks.ingest.mock.calls[0][1]; const second = mocks.ingest.mock.calls[1][1];
    expect(first.externalId).toBe(second.externalId); expect(first.type).toBe("deployment");
    expect(first).not.toHaveProperty("status"); expect(first.description).toContain("https://github.com/team/repo/actions/runs/123");
  });
  it("keeps matrix services and re-run attempts distinct", async () => {
    await post(payload); await post({ ...payload, service: "API" }); await post({ ...payload, runAttempt: 2 });
    expect(new Set(mocks.ingest.mock.calls.map(([, event]) => event.externalId)).size).toBe(3);
  });
  it("rejects malformed evidence", async () => {
    expect((await post({ ...payload, sha: "invalid" })).status).toBe(400); expect(mocks.ingest).not.toHaveBeenCalled();
  });
  it("requires a secret credential", async () => {
    mocks.org.mockResolvedValue(null); expect((await post(payload)).status).toBe(401); expect(mocks.ingest).not.toHaveBeenCalled();
  });
});
