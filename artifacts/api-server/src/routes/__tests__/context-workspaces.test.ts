import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({ orgId: 20 as number | null, signedIn: true, query: vi.fn(), rows: [] as object[], reject: false }));
vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  return { ...schema, db: { select: () => ({ from: () => ({ where: (condition: unknown) => {
    mocks.query(condition); return { limit: async () => { if (mocks.reject) throw new Error("Private database error"); return mocks.rows; } };
  } }) }) } };
});
vi.mock("../../middleware/auth.js", () => ({ requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!mocks.signedIn) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.auth = { userId: 1, clerkUserId: "test-user", organizationId: mocks.orgId, role: "backend" }; next();
} }));
import router from "../context.js";
let server: Server; let base: string;
beforeAll(async () => {
  const app = express(); app.use(router);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ error: "Unavailable" }));
  server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => { vi.clearAllMocks(); mocks.orgId = 20; mocks.signedIn = true; mocks.reject = false; mocks.rows = [{ id: 8, title: "Team runbook" }]; });
describe("workspace context reads", () => {
  it.each(["/context-graph", "/context/documents", "/documents/recommended"])("requires authentication for %s", async (path) => {
    mocks.signedIn = false;
    expect((await fetch(base + path)).status).toBe(401); expect(mocks.query).not.toHaveBeenCalled();
  });
  it.each(["/context-graph", "/context/documents", "/documents/recommended"])("uses only the verified selected workspace for %s", async (path) => {
    const response = await fetch(`${base}${path}?organizationId=10&role=pm`);
    expect(response.status).toBe(200);
    expect(new PgDialect().sqlToQuery(mocks.query.mock.calls[0][0]).params).toEqual([20]);
    expect(JSON.stringify(await response.json())).toContain("Team runbook");
  });
  it("returns actual uploaded titles and an empty list when there are no uploads", async () => {
    expect(await (await fetch(base + "/context/documents")).json()).toMatchObject({ data: [{ name: "Team runbook", why: "Uploaded to your current workspace." }] });
    mocks.rows = [];
    expect(await (await fetch(base + "/documents/recommended")).json()).toMatchObject({ data: [] });
  });
  it("does not query documents without an organization or silently substitute examples after failure", async () => {
    mocks.orgId = null;
    expect((await fetch(base + "/context-graph")).status).toBe(403); expect(mocks.query).not.toHaveBeenCalled();
    mocks.orgId = 20; mocks.reject = true;
    expect((await fetch(base + "/context-graph")).status).toBe(500);
  });
});
