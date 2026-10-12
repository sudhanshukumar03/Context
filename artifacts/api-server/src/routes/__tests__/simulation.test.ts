import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ rows: [] as object[], where: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  return { ...schema, db: { select: () => ({ from: () => ({ where: (condition: unknown) => {
    mocks.where(condition); return { limit: async () => mocks.rows }; } }) }), update: mocks.update, insert: mocks.insert } };
});
vi.mock("../../middleware/auth.js", () => ({ requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  req.auth = { userId: 1, organizationId: 10, clerkUserId: "clerk", role: "backend" }; next();
} }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({ openai: {} }));
vi.mock("../../lib/logger.js", () => ({ logger: { error: vi.fn() } }));
import router from "../root-cause.js";
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use(router);
  server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
beforeEach(() => { vi.clearAllMocks(); mocks.rows = [{ id: 1, name: "DB", status: "failing" }]; });
describe("simulation isolation", () => {
  it.each(["rollback", "restart", "throttle"])("returns a %s preview without service or event writes", async (action) => {
    const response = await fetch(`${base}/insights/simulate-action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, serviceId: 1 }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { service: "DB", simulation: { originalStatus: "failing", projectedStatus: "healthy", action } } });
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled();
    expect(new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]).params).toEqual([1, 10]);
  });
  it("rejects foreign or missing services", async () => {
    mocks.rows = [];
    const response = await fetch(`${base}/insights/simulate-action`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"action":"rollback","serviceId":99}' });
    expect(response.status).toBe(404); expect(mocks.update).not.toHaveBeenCalled();
  });
});
