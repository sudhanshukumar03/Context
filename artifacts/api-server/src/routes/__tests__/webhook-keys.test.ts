import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ rows: [] as object[], where: vi.fn(), values: vi.fn(), select: vi.fn() }));
vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const query = { innerJoin: () => query, where: (condition: unknown) => { mocks.where(condition); return query; },
    orderBy: () => query, limit: async () => mocks.rows, returning: async () => mocks.rows };
  return { ...schema, db: {
    select: () => { mocks.select(); return { from: () => query }; },
    insert: () => ({ values: (value: unknown) => { mocks.values(value); return query; } }),
    update: () => ({ set: () => query }),
  } };
});
vi.mock("../../middleware/auth.js", () => ({ requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  req.auth = { userId: 1, organizationId: 10, clerkUserId: "clerk", role: "backend" }; next();
} }));
import router from "../webhook-keys.js";
import { createWebhookKey, hashWebhookKey, resolveWebhookOrganization } from "../../services/webhook-credentials.js";
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use(router);
  server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
beforeEach(() => { vi.clearAllMocks(); mocks.rows = []; });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const request = (token: unknown) => ({ headers: { "x-api-key": token }, query: {} }) as unknown as express.Request;
describe("webhook credentials", () => {
  it.each(["1", "user_1", "user_clerk", "", ["ctx_wh_"], "ctx_wh_bad"])("rejects identifiers and malformed keys: %s", async (token) => {
    expect(await resolveWebhookOrganization(request(token))).toBeNull(); expect(mocks.select).not.toHaveBeenCalled();
  });
  it("uses only a digest and requires non-revoked keys", async () => {
    const { token } = createWebhookKey(); mocks.rows = [{ organizationId: 10, personalOrganizationId: 10, organizationSlug: "personal" }];
    expect(await resolveWebhookOrganization(request(token))).toBe(10);
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.params).toEqual([hashWebhookKey(token)]);
    expect(query.sql).toContain('"revoked_at" is null'); expect(query.params).not.toContain(token);
  });
  it("rejects unknown/revoked credentials", async () => {
    expect(await resolveWebhookOrganization(request(createWebhookKey().token))).toBeNull();
  });
  it("returns a fresh secret once and stores its digest", async () => {
    mocks.rows = [{ id: 2, name: "CI", prefix: "prefix" }];
    const response = await fetch(`${base}/webhook-keys`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "CI" }) });
    const { data } = await response.json() as { data: { token: string } };
    expect(response.status).toBe(201); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(data.token).toMatch(/^ctx_wh_[a-f0-9]{64}$/);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, organizationId: 10, tokenHash: hashWebhookKey(data.token) }));
    expect(JSON.stringify(mocks.values.mock.calls)).not.toContain(data.token);
    expect(createWebhookKey().token).not.toBe(data.token);
  });
  it("rejects invalid names", async () => {
    const response = await fetch(`${base}/webhook-keys`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"name":""}' });
    expect(response.status).toBe(400); expect(mocks.values).not.toHaveBeenCalled();
  });
  it("scopes revocation to current user and organization", async () => {
    mocks.rows = [{ id: 2 }];
    expect((await fetch(`${base}/webhook-keys/2`, { method: "DELETE" })).status).toBe(200);
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.params).toEqual([2, 1, 10]);
  });
  it("does not disclose another user's key", async () => {
    expect((await fetch(`${base}/webhook-keys/2`, { method: "DELETE" })).status).toBe(404);
  });
  it("keeps shared keys scoped to current admin membership after switching personal workspaces", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "test-only");
    mocks.rows = [{ organizationId: 20, personalOrganizationId: 10, organizationSlug: "clerk-org-org_team", clerkUserId: "user_admin" }];
    const provider = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ role: "org:admin", public_user_data: { user_id: "user_admin" } }] })));
    vi.stubGlobal("fetch", provider);
    expect(await resolveWebhookOrganization(request(createWebhookKey().token))).toBe(20);
    expect(String(provider.mock.calls[0][0])).toContain("/organizations/org_team/memberships");
    provider.mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    expect(await resolveWebhookOrganization(request(createWebhookKey().token))).toBeNull();
    provider.mockResolvedValue(new Response(JSON.stringify({ data: [{ role: "org:member", public_user_data: { user_id: "user_admin" } }] })));
    expect(await resolveWebhookOrganization(request(createWebhookKey().token))).toBeNull();
  });
  it("fails closed when membership verification is unavailable", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "test-only");
    mocks.rows = [{ organizationId: 20, organizationSlug: "clerk-org-org_team", clerkUserId: "user_admin" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(resolveWebhookOrganization(request(createWebhookKey().token))).rejects.toThrow("verification unavailable");
  });
  it("filters the actual issuer when a newer member is first in the organization", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "test-only");
    mocks.rows = [{ organizationId: 20, organizationSlug: "clerk-org-org_team", clerkUserId: "user_admin" }];
    const provider = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      // The provider ignores unsupported bracketed parameter names and returns
      // its newest member first. The issuer must be selected before limit=1.
      const issuerSelected = url.searchParams.getAll("user_id").includes("user_admin");
      return new Response(JSON.stringify({ total_count: issuerSelected ? 1 : 2, data: [{
        role: issuerSelected ? "org:admin" : "org:member",
        public_user_data: { user_id: issuerSelected ? "user_admin" : "user_member" },
      }] }));
    });
    vi.stubGlobal("fetch", provider);
    expect(await resolveWebhookOrganization(request(createWebhookKey().token))).toBe(20);
    const url = new URL(String(provider.mock.calls[0][0]));
    expect(url.searchParams.getAll("user_id")).toEqual(["user_admin"]);
    expect(url.searchParams.has("user_id[]")).toBe(false);
    expect(url.searchParams.get("limit")).toBe("1");
  });
  it("does not accept a different admin returned by the membership provider", async () => {
    vi.stubEnv("CLERK_SECRET_KEY", "test-only");
    mocks.rows = [{ organizationId: 20, organizationSlug: "clerk-org-org_team", clerkUserId: "user_removed" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{
      role: "org:admin", public_user_data: { user_id: "user_other_admin" },
    }] }))));
    expect(await resolveWebhookOrganization(request(createWebhookKey().token))).toBeNull();
  });
});
