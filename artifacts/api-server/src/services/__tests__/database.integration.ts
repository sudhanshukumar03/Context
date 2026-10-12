import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Request } from "express";
import { db, pool, contextBriefs, organizations, users, webhookKeys } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createWebhookKey, resolveWebhookOrganization } from "../webhook-credentials.js";
import { ingestServiceEvent } from "../event-ingestion.js";
import { getOrCreateBrief } from "../brief-submissions.js";
import { runBriefJob } from "../brief-worker.js";
import { resolveClerkOrganization } from "../organization-session.js";
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
  it("reverses the additive migration on this disposable database", async () => {
    await pool.query(await readFile("lib/db/migrations/001_webhook_credentials.down.sql", "utf8"));
    expect((await pool.query("SELECT to_regclass('webhook_keys') AS name")).rows[0].name).toBeNull();
  });
});
