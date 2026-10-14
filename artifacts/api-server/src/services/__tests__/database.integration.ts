import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Request } from "express";
import { db, pool, contextBriefs, documents, organizations, users, webhookKeys } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createWebhookKey, resolveWebhookOrganization } from "../webhook-credentials.js";
import { ingestServiceEvent } from "../event-ingestion.js";
import { getOrCreateBrief } from "../brief-submissions.js";
import { runBriefJob } from "../brief-worker.js";
import { resolveClerkOrganization } from "../organization-session.js";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
vi.mock("../../middleware/auth.js", () => ({ requireAuth: (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => {
  req.auth = { userId: 1, organizationId: 1, clerkUserId: "test", role: "backend" }; next();
} }));
vi.mock("../../lib/logger.js", () => ({ logger: { error: vi.fn() } }));
let orgId: number; let userId: number;
beforeAll(async () => {
  await pool.query(await readFile("lib/db/test/baseline.sql", "utf8"));
  await promisify(execFile)(process.execPath, ["lib/db/migrate.mjs"]);
  await promisify(execFile)(process.execPath, ["lib/db/migrate.mjs"]);
  [orgId] = (await db.insert(organizations).values({ name: "Test", slug: "test" }).returning()).map((row) => row.id);
  [userId] = (await db.insert(users).values({ organizationId: orgId, name: "Test", email: "test@example.test" }).returning()).map((row) => row.id);
});
afterAll(() => pool.end());
describe("disposable PostgreSQL verification", () => {
  it("stores multilingual incident text and emoji without an encoding failure", async () => {
    expect((await pool.query("SHOW server_encoding")).rows[0].server_encoding).toBe("UTF8");
    const message = "✅ Context — 日本語 हिन्दी";
    const saved = await pool.query("INSERT INTO service_events (organization_id, title) VALUES ($1,$2) RETURNING title", [orgId, message]);
    expect(saved.rows[0].title).toBe(message);
  });
  it("applies versioned migration exactly once", async () => {
    expect((await pool.query("SELECT count(*)::int AS count FROM context_migrations")).rows[0].count).toBe(1);
  });
  it("verifies and revokes a real hashed credential", async () => {
    const { token, tokenHash, prefix } = createWebhookKey();
    const [key] = await db.insert(webhookKeys).values({ organizationId: orgId, userId, name: "CI", tokenHash, prefix }).returning();
    const req = { headers: { "x-api-key": token }, query: {} } as unknown as Request;
    expect(await resolveWebhookOrganization(req)).toBe(orgId);
    await db.update(webhookKeys).set({ revokedAt: new Date() }).where(eq(webhookKeys.id, key.id));
    expect(await resolveWebhookOrganization(req)).toBeNull();
  });
  it("serializes concurrent replay and creates only one service/event", async () => {
    const event = { service: "API", title: "Failure", type: "failure", severity: "critical", status: "failing" as const, externalId: "test:replay" };
    const results = await Promise.all([ingestServiceEvent(orgId, event), ingestServiceEvent(orgId, event)]);
    expect(results.map((row) => row.duplicate).sort()).toEqual([false, true]);
    expect((await pool.query("SELECT count(*)::int AS count FROM services WHERE name = 'API'")).rows[0].count).toBe(1);
    expect((await pool.query("SELECT count(*)::int AS count FROM service_events WHERE external_id = 'test:replay'")).rows[0].count).toBe(1);
  });
  it("rolls back service creation when event persistence fails", async () => {
    await pool.query("CREATE FUNCTION reject_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title = 'reject' THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_test BEFORE INSERT ON service_events FOR EACH ROW EXECUTE FUNCTION reject_event()");
    await expect(ingestServiceEvent(orgId, { service: "Rollback", title: "reject", type: "info", severity: "info" })).rejects.toThrow();
    expect((await pool.query("SELECT count(*)::int AS count FROM services WHERE name = 'Rollback'")).rows[0].count).toBe(0);
  });
  it("coordinates duplicate submissions and interrupted job recovery", async () => {
    const results = await Promise.all([getOrCreateBrief(orgId, userId, "backend"), getOrCreateBrief(orgId, userId, "backend")]);
    expect(results[0].brief.id).toBe(results[1].brief.id);
    expect(results.filter((row) => row.created)).toHaveLength(1);
    const brief = results[0].brief;
    let entered!: () => void; let finish!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const generate = vi.fn(async () => { entered(); await pending; });
    const first = runBriefJob(brief, generate); await started;
    await runBriefJob(brief, generate); expect(generate).toHaveBeenCalledOnce();
    finish(); await first;
    const recover = vi.fn(async () => { await db.update(contextBriefs).set({ status: "done" }).where(eq(contextBriefs.id, brief.id)); });
    await runBriefJob(brief, recover); await runBriefJob(brief, recover);
    expect(recover).toHaveBeenCalledOnce();
  });
  it("maps concurrent verified team sessions to one shared tenant without moving personal data", async () => {
    const ids = await Promise.all([resolveClerkOrganization("org_test"), resolveClerkOrganization("org_test")]);
    expect(ids[0]).toBe(ids[1]); expect(ids[0]).not.toBe(orgId);
    expect((await pool.query("SELECT organization_id FROM users WHERE id = $1", [userId])).rows[0].organization_id).toBe(orgId);
  });
  it("reads onboarding knowledge from the selected workspace and current user's role-specific brief", async () => {
    const [otherOrg] = await db.insert(organizations).values({ name: "Other workspace", slug: "onboarding-other" }).returning();
    const [otherUser] = await db.insert(users).values({ organizationId: orgId, name: "Other user", email: "other-onboarding@example.test" }).returning();
    const ownData = { team: "Actual team", goal: "Own workspace goal", keyPerson: "", suggestedReading: "Actual runbook", nextAction: "Read actual runbook", whyThisMatters: "Service operation", confidence: 80, explanation: "Uploaded knowledge", sources: ["Actual runbook"] };
    await db.insert(contextBriefs).values([
      { organizationId: orgId, userId, role: "backend", status: "done", data: JSON.stringify(ownData) },
      { organizationId: otherOrg.id, userId, role: "backend", status: "done", data: JSON.stringify({ ...ownData, goal: "Foreign workspace goal" }) },
      { organizationId: orgId, userId: otherUser.id, role: "backend", status: "done", data: JSON.stringify({ ...ownData, goal: "Other user's goal" }) },
      { organizationId: orgId, userId, role: "frontend", status: "done", data: JSON.stringify({ ...ownData, goal: "Frontend goal" }) },
    ]);
    const [ownDoc, foreignDoc] = await db.insert(documents).values([
      { organizationId: orgId, userId, title: "Actual runbook", content: "Actual knowledge" },
      { organizationId: otherOrg.id, userId, title: "Foreign runbook", content: "Foreign knowledge" },
    ]).returning();
    const { default: contextRouter } = await import("../../routes/context.js");
    const { default: uploadRouter } = await import("../../routes/upload.js");
    const app = express(); app.use(express.json()); app.use(contextRouter); app.use(uploadRouter);
    const server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const response = await fetch(`${base}/context/brief?organizationId=${otherOrg.id}&userId=${otherUser.id}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { keyInsight: "Own workspace goal", suggestedPerson: null, status: "done" } });
      expect(await (await fetch(base + "/context/brief?role=frontend")).json()).toMatchObject({ data: { keyInsight: "Frontend goal" } });
      const graph = await (await fetch(base + "/context-graph")).json() as { data: { nodes: { id: string }[] } };
      expect(graph.data.nodes.map((node) => node.id)).toContain(`doc-${ownDoc.id}`);
      expect(graph.data.nodes.map((node) => node.id)).not.toContain(`doc-${foreignDoc.id}`);
      expect(await (await fetch(base + "/team")).json()).toMatchObject({ data: [] });
      const uploaded = await fetch(base + "/upload/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: otherOrg.id, members: [{ name: "Actual Contact", role: "Maintainer" }] }) });
      expect(uploaded.status).toBe(201); await uploaded.json();
      expect(await (await fetch(base + "/context/team")).json()).toMatchObject({ data: [{ name: "Actual Contact", role: "Maintainer" }] });
      expect((await pool.query("SELECT count(*)::int AS count FROM documents WHERE organization_id=$1 AND title='Team Structure'", [otherOrg.id])).rows[0].count).toBe(0);
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
  it("persists GitHub delivery/replay/rerun through HTTP without asserting healthy service status", async () => {
    const [workspace] = await db.insert(organizations).values({ name: "GitHub delivery", slug: "github-delivery-test" }).returning();
    const [owner] = await db.insert(users).values({ organizationId: workspace.id, name: "CI owner", email: "ci-owner@example.test" }).returning();
    const key = createWebhookKey();
    const [savedKey] = await db.insert(webhookKeys).values({ organizationId: workspace.id, userId: owner.id, name: "Disposable CI", tokenHash: key.tokenHash, prefix: key.prefix }).returning();
    await ingestServiceEvent(workspace.id, { service: "API", title: "Synthetic degradation", type: "info", severity: "info", status: "degraded" });
    const { default: github } = await import("../../routes/github-actions.js");
    const app = express(); app.use(express.json()); app.use(github);
    const server = await new Promise<Server>(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ingest/github-actions`;
    const payload = { repository: "synthetic/context", service: "API", environment: "staging", sha: "a".repeat(40), runId: "123", runAttempt: 1, status: "success" };
    const send = async (body = payload) => { const response = await fetch(url, { method: "POST", headers: { "x-api-key": key.token, "content-type": "application/json" }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() as { data: { duplicate: boolean; eventId: number } } }; };
    try {
      const first = await send(); const replay = await send();
      expect(first.status).toBe(200); expect(first.body.data.duplicate).toBe(false);
      expect(replay.body.data).toMatchObject({ duplicate: true, eventId: first.body.data.eventId });
      const rerun = await send({ ...payload, runAttempt: 2 }); expect(rerun.body.data.duplicate).toBe(false);
      const matrix = await send({ ...payload, service: "Worker" }); expect(matrix.body.data.duplicate).toBe(false);
      expect((await pool.query("SELECT status FROM services WHERE organization_id=$1 AND name='API'", [workspace.id])).rows[0].status).toBe("degraded");
      expect((await pool.query("SELECT count(*)::int AS count FROM service_events WHERE organization_id=$1 AND type='deployment'", [workspace.id])).rows[0].count).toBe(3);
      await db.update(webhookKeys).set({ revokedAt: new Date() }).where(eq(webhookKeys.id, savedKey.id));
      expect((await send({ ...payload, runAttempt: 3 })).status).toBe(401);
      expect((await pool.query("SELECT count(*)::int AS count FROM service_events WHERE organization_id=$1 AND type='deployment'", [workspace.id])).rows[0].count).toBe(3);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it("rejects shared ingestion immediately after issuer demotion/removal and preserves personal data", async () => {
    const [shared] = await db.insert(organizations).values({ name: "Issuer transitions", slug: "clerk-org-org_issuer_test" }).returning();
    const [issuer] = await db.insert(users).values({ organizationId: orgId, clerkUserId: "user_issuer_test", name: "Issuer", email: "issuer@example.test" }).returning();
    const key = createWebhookKey();
    const [savedKey] = await db.insert(webhookKeys).values({ organizationId: shared.id, userId: issuer.id, name: "Disposable issuer", tokenHash: key.tokenHash, prefix: key.prefix }).returning();
    const personalBefore = (await pool.query("SELECT count(*)::int AS count FROM service_events WHERE organization_id=$1", [orgId])).rows[0].count;
    let membership: { role: string; public_user_data: { user_id: string } }[] = [{ role: "org:admin", public_user_data: { user_id: issuer.clerkUserId! } }];
    let providerDown = false;
    const originalFetch = globalThis.fetch;
    vi.stubEnv("CLERK_SECRET_KEY", "synthetic-clerk-key");
    const interception = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "api.clerk.com") {
        expect(url.searchParams.getAll("user_id")).toEqual([issuer.clerkUserId]);
        return providerDown ? new Response("synthetic failure", { status: 503 }) : Response.json({ data: membership });
      }
      if (url.hostname !== "127.0.0.1") throw new Error("No external requests permitted");
      return originalFetch(input, init);
    });
    const { default: webhook } = await import("../../routes/webhook.js");
    const app = express(); app.use(express.json()); app.use(webhook);
    app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(503).json({ error: "Verification unavailable" }));
    const server = await new Promise<Server>(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ingest/webhook`;
    const send = async (eventId: string) => { const response = await fetch(url, { method: "POST", headers: { "x-api-key": key.token, "content-type": "application/json" }, body: JSON.stringify({ service: "Issuer QA", title: "Synthetic info", type: "info", severity: "info", eventId }) }); await response.text(); return response.status; };
    try {
      expect(await send("before-change")).toBe(200);
      membership[0].role = "org:member"; expect(await send("after-demotion")).toBe(401);
      membership = []; expect(await send("after-removal")).toBe(401);
      membership = [{ role: "org:admin", public_user_data: { user_id: "different-admin" } }]; expect(await send("wrong-issuer")).toBe(401);
      providerDown = true; expect(await send("outage")).toBe(503);
      providerDown = false; membership = [{ role: "org:admin", public_user_data: { user_id: issuer.clerkUserId! } }];
      expect(await send("after-restoration")).toBe(200);
      await db.update(webhookKeys).set({ revokedAt: new Date() }).where(eq(webhookKeys.id, savedKey.id));
      expect(await send("after-revoke")).toBe(401);
      expect((await pool.query("SELECT count(*)::int AS count FROM service_events WHERE organization_id=$1", [shared.id])).rows[0].count).toBe(2);
      expect((await pool.query("SELECT count(*)::int AS count FROM service_events WHERE organization_id=$1", [orgId])).rows[0].count).toBe(personalBefore);
    } finally { interception.mockRestore(); vi.unstubAllEnvs(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  async function withApi(routers: express.Router[], work: (base: string) => Promise<void>) {
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.log = { error: vi.fn() } as unknown as typeof req.log; next(); });
    for (const router of routers) app.use(router);
    const server = await new Promise<Server>(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
    try { await work(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
    finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }
  const sendJson = (base: string, path: string, data: unknown) => fetch(base + path,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  it("reuses services under concurrent imports and preserves omitted health while updating ownership", async () => {
    const { default: router } = await import("../../routes/ingestion.js");
    await withApi([router], async base => {
      const body = { services: [{ name: "Import API", status: "failing", ownerTeam: "Payments", criticality: "high" }] };
      const responses = await Promise.all([sendJson(base, "/upload/services", body), sendJson(base, "/upload/services", body)]);
      expect(responses.map(response => response.status)).toEqual([201, 201]);
      const rows = (await pool.query("SELECT * FROM services WHERE organization_id=$1 AND name='Import API'", [orgId])).rows;
      expect(rows).toHaveLength(1); expect(rows[0].status).toBe("failing"); expect(rows[0].owner_team).toBe("Payments");
      const timestamp = rows[0].updated_at;
      expect((await sendJson(base, "/upload/services", { services: [{ name: "Import API", description: "Changed definition" }] })).status).toBe(201);
      const updated = (await pool.query("SELECT * FROM services WHERE id=$1", [rows[0].id])).rows[0];
      expect(updated.status).toBe("failing"); expect(updated.updated_at).toEqual(timestamp);
      expect(updated.description).toBe("Changed definition");
    });
  });
  it("connects an imported service to an existing dependency and rolls back invalid cross-workspace references", async () => {
    const { default: router } = await import("../../routes/ingestion.js");
    await withApi([router], async base => {
      expect((await sendJson(base, "/upload/services", { services: [{ name: "Import caller", dependencies: ["Import API"] }] })).status).toBe(201);
      expect((await pool.query("SELECT count(*)::int AS count FROM service_dependencies d JOIN services s ON s.id=d.service_id WHERE s.name='Import caller'")).rows[0].count).toBe(1);
      const [other] = await db.insert(organizations).values({ name: "Other import", slug: "other-import" }).returning();
      await pool.query("INSERT INTO services (organization_id,name) VALUES ($1,'Foreign dependency')", [other.id]);
      const response = await sendJson(base, "/upload/services", { services: [{ name: "Must roll back", dependencies: ["Foreign dependency"] }] });
      expect(response.status).toBe(400);
      expect((await pool.query("SELECT count(*)::int AS count FROM services WHERE name='Must roll back'")).rows[0].count).toBe(0);
    });
  });
  it("applies event batches in supplied order and does not change health for a failed deployment", async () => {
    const { default: router } = await import("../../routes/ingestion.js");
    await withApi([router], async base => {
      const response = await sendJson(base, "/upload/events", { events: [
        { serviceName: "Import API", type: "failure", title: "Batch failure", severity: "critical" },
        { serviceName: "Import API", type: "recovery", title: "Batch recovery", severity: "critical" },
        { serviceName: "Import API", type: "deployment", title: "Deployment failed", severity: "critical" },
      ] });
      expect(response.status).toBe(201);
      expect((await pool.query("SELECT status FROM services WHERE organization_id=$1 AND name='Import API'", [orgId])).rows[0].status).toBe("healthy");
    });
  });
  it("rolls back earlier batch events and health when a later event cannot be stored", async () => {
    const { default: router } = await import("../../routes/ingestion.js");
    await withApi([router], async base => {
      const response = await sendJson(base, "/upload/events", { events: [
        { serviceName: "Import API", type: "failure", title: "Batch should disappear" }, { title: "reject" },
      ] });
      expect(response.status).toBe(500);
      expect((await pool.query("SELECT count(*)::int AS count FROM service_events WHERE title='Batch should disappear'")).rows[0].count).toBe(0);
      expect((await pool.query("SELECT status FROM services WHERE name='Import API'")).rows[0].status).toBe("healthy");
    });
  });
  it("creates a private workspace when registration omits an organization name", async () => {
    const { default: router } = await import("../../routes/auth.js");
    await withApi([router], async base => {
      const response = await sendJson(base, "/auth/register", { email: "registration@example.test", password: "synthetic-test-password", name: "New account" });
      expect(response.status).toBe(201);
      const result = await response.json() as { data: { user: { organizationId: number } } };
      expect(result.data.user.organizationId).toBeGreaterThan(0);
      expect((await pool.query("SELECT name FROM organizations WHERE id=$1", [result.data.user.organizationId])).rows[0].name).toBe("New account's workspace");
    });
  });
  it("rolls back token revocation when storing its replacement fails", async () => {
    const { default: router } = await import("../../routes/auth.js");
    await withApi([router], async base => {
      const registered = await sendJson(base, "/auth/register", { email: "refresh-rollback@example.test", password: "synthetic-test-password", name: "Refresh" });
      expect(registered.status).toBe(201);
      const { data } = await registered.json() as { data: { refreshToken: string } };
      await pool.query("CREATE FUNCTION reject_refresh() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic token failure'; END $$; CREATE TRIGGER reject_refresh BEFORE INSERT ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION reject_refresh()");
      try {
        expect((await sendJson(base, "/auth/refresh", { refreshToken: data.refreshToken })).status).toBe(500);
        const before = (await pool.query("SELECT count(*)::int AS count FROM organizations")).rows[0].count;
        expect((await sendJson(base, "/auth/register", { email: "registration-rollback@example.test", password: "synthetic-test-password", name: "Must roll back" })).status).toBe(500);
        expect((await pool.query("SELECT count(*)::int AS count FROM organizations")).rows[0].count).toBe(before);
        expect((await pool.query("SELECT count(*)::int AS count FROM users WHERE email='registration-rollback@example.test'")).rows[0].count).toBe(0);
      }
      finally { await pool.query("DROP TRIGGER reject_refresh ON refresh_tokens; DROP FUNCTION reject_refresh()"); }
      expect((await sendJson(base, "/auth/refresh", { refreshToken: data.refreshToken })).status).toBe(200);
      expect((await sendJson(base, "/auth/refresh", { refreshToken: data.refreshToken })).status).toBe(401);
    });
  });
  it("returns a client error for an unsupported document upload", async () => {
    const { default: router } = await import("../../routes/upload.js");
    await withApi([router], async base => {
      const form = new FormData(); form.append("files", new Blob(["synthetic pdf"], { type: "application/pdf" }), "test.pdf");
      expect((await fetch(base + "/upload/docs", { method: "POST", body: form })).status).toBe(400);
      expect((await sendJson(base, "/upload/tasks", null)).status).toBe(400);
    });
  });
  it("reverses the additive migration on this disposable database", async () => {
    await pool.query(await readFile("lib/db/migrations/001_webhook_credentials.down.sql", "utf8"));
    expect((await pool.query("SELECT to_regclass('webhook_keys') AS name")).rows[0].name).toBeNull();
  });
  it("initializes the full schema on an empty disposable database and refuses an existing one", async () => {
    // setupFiles rejects every URL except the generated loopback-only test DB.
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await promisify(execFile)(process.execPath, ["lib/db/initialize.mjs"]);
    await promisify(execFile)(process.execPath, ["lib/db/migrate.mjs"]);
    await expect(promisify(execFile)(process.execPath, ["lib/db/initialize.mjs"])).rejects.toThrow("empty database");
    expect((await pool.query("SELECT to_regclass('documents') AS name")).rows[0].name).toBe("documents");
    expect((await pool.query("SELECT to_regclass('webhook_keys') AS name")).rows[0].name).toBe("webhook_keys");
  });
  it("rolls back an entire demo step if a recovery event fails to persist", async () => {
    await pool.query("INSERT INTO organizations (name, slug) VALUES ('Scenario', 'scenario')");
    await pool.query("INSERT INTO services (organization_id, name, status) VALUES (1,'Payments API','failing'), (1,'Database','failing')");
    await pool.query("CREATE FUNCTION reject_recovery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title = 'Database: fully recovered' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_recovery BEFORE INSERT ON service_events FOR EACH ROW EXECUTE FUNCTION reject_recovery()");
    const { default: router } = await import("../../routes/root-cause.js");
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.log = { error: vi.fn() } as unknown as typeof req.log; next(); });
    app.use(router);
    const server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/demo/advance`;
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: '{"step":8}' });
      expect(response.status).toBe(500); await response.json();
      expect((await pool.query("SELECT status FROM services ORDER BY id")).rows.map(row => row.status)).toEqual(["failing", "failing"]);
      expect((await pool.query("SELECT count(*)::int AS count FROM service_events")).rows[0].count).toBe(0);
      expect((await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: '{"step":9}' })).status).toBe(400);
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
});
