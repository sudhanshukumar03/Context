import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { setImmediate as nextTurn } from "node:timers/promises";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({ create: vi.fn(), info: vi.fn(), error: vi.fn(), insert: vi.fn(),
  update: vi.fn(), where: vi.fn(), docs: [] as object[], rows: [] as object[], updates: [] as object[],
}));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mocks.create } } },
}));
vi.mock("../../lib/logger.js", () => ({ logger: { info: mocks.info, error: mocks.error } }));
vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  return { ...schema, db: {
    insert: () => ({ values: (values: object) => { mocks.insert(values); return { returning: async () => [{ id: 1, ...values }] }; } }),
    update: () => ({ set: (change: object) => ({ where: async (condition: unknown) => {
      mocks.updates.push(change); mocks.where(condition); return mocks.update(change);
    } }) }),
    select: () => ({ from: (table: unknown) => ({ where: (condition: unknown) => {
      mocks.where(condition);
      const query = { limit: async () => table === schema.documents ? mocks.docs : mocks.rows, orderBy: () => query };
      return query;
    } }) }),
  } };
});
vi.mock("../../middleware/auth.js", () => ({ requireAuth: (req: Request, _res: Response, next: NextFunction) => {
  req.auth = { userId: 1, organizationId: 10, clerkUserId: "test", role: "backend" }; next();
} }));
import router, { generateBriefAsync } from "../briefs.js";

const output = { team: "Platform", goal: "Learn", keyPerson: "Alex", suggestedReading: "Runbook", nextAction: "Read",
  whyThisMatters: "Reliability", confidence: 80, explanation: "Evidence", sources: ["Runbook"], extra: "preserved" };
let server: Server;
let baseURL: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.assign(req, { log: { error: mocks.error }, id: "brief-request" }); next(); });
  app.use("/api", router);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); });
beforeEach(() => {
  vi.resetAllMocks(); mocks.docs = []; mocks.rows = []; mocks.updates = [];
  mocks.create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(output) } }] });
});
async function post(body: object = {}) {
  const response = await fetch(`${baseURL}/generate-brief`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  await nextTurn();
  return { status: response.status, body: await response.json() };
}
async function get(path: string) {
  const response = await fetch(`${baseURL}${path}`);
  return { status: response.status, body: await response.json() };
}

describe("background brief characterization", () => {
  it("acknowledges the existing job response and persists a valid brief", async () => {
    const result = await post();
    expect(result).toEqual({ status: 202, body: { success: true, error: null, data: {
      jobId: expect.any(String), briefId: 1, status: "pending", message: "Brief generation started",
    } } });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, organizationId: 10, role: "backend", status: "pending" }));
    expect(mocks.updates).toEqual([expect.objectContaining({ status: "processing" }),
      expect.objectContaining({ status: "done", data: JSON.stringify(output) })]);
  });
  it.each(["backend", "frontend", "pm"])("uses the existing %s role and tenant documents", async (role) => {
    mocks.docs = [{ title: "Runbook", content: "company knowledge" }];
    await post({ role });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ role }));
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ max_completion_tokens: 2048 });
    expect(mocks.create.mock.calls[0][0].messages[1].content).toContain("Document: Runbook\ncompany knowledge");
  });
  it("marks provider failures as failed", async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error("private provider body"), { status: 401 }));
    expect((await post()).status).toBe(202);
    expect(mocks.updates.at(-1)).toEqual(expect.objectContaining({ status: "failed" }));
  });
  it("returns the existing empty live response", async () => {
    expect(await get("/brief/live")).toEqual({ status: 200, body: { success: true, error: null, data: {
      status: "none", message: "No briefs generated yet. POST /api/generate-brief to start.",
    } } });
  });
  it("preserves persisted response fields when polling by ID", async () => {
    mocks.rows = [{ id: 1, jobId: "job", status: "done", role: "pm", data: JSON.stringify(output), createdAt: "created", updatedAt: "updated" }];
    expect(await get("/brief/1")).toEqual({ status: 200, body: { success: true, error: null, data: {
      id: 1, jobId: "job", status: "done", role: "pm", data: output, createdAt: "created", updatedAt: "updated",
    } } });
    const query = new PgDialect().sqlToQuery(mocks.where.mock.calls[0][0]);
    expect(query.params).toEqual([1, 1, 10]);
    expect(query.sql).toContain('"user_id"');
  });
  it("returns 404 for a missing specific brief", async () => {
    expect(await get("/brief/99")).toEqual({ status: 404, body: { success: false, data: null, error: "Brief not found" } });
  });
  it.each(["manager", 12, {}, ""])("rejects unsupported roles: %s", async (role) => {
    expect((await post({ role })).status).toBe(400); expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(["1abc", "0", "-2", "1.5"])("rejects invalid brief IDs: %s", async (id) => {
    expect((await get(`/brief/${id}`)).status).toBe(400);
  });
  it("contains both provider and failure-persistence errors without logging provider content", async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error("private provider body"), { status: 401 }));
    mocks.update.mockImplementation(async (change) => { if (change.status === "failed") throw new Error("write failed"); });
    await expect(generateBriefAsync(1, "backend", 10, "request", "job")).resolves.toBeUndefined();
    expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("private provider body");
    expect(mocks.error).toHaveBeenCalledWith(expect.objectContaining({ requestId: "request", jobId: "job", organizationId: 10 }), expect.any(String));
  });
  it("rejects malformed model output after three bounded attempts", async () => {
    vi.useFakeTimers();
    try {
      mocks.create.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
      const job = generateBriefAsync(1, "backend", 10);
      await vi.runAllTimersAsync(); await job;
      expect(mocks.create).toHaveBeenCalledTimes(3);
      expect(mocks.updates.at(-1)).toEqual(expect.objectContaining({ status: "failed" }));
      expect(mocks.create.mock.calls[0][1]).toEqual({ timeout: 15000, maxRetries: 0 });
      expect(mocks.updates.some((row) => "status" in row && row.status === "done")).toBe(false);
    } finally { vi.useRealTimers(); }
  });
});
