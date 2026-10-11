import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { setImmediate } from "node:timers/promises";

const mocks = vi.hoisted(() => ({ create: vi.fn(), error: vi.fn(), docs: [] as object[] }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mocks.create } } },
}));
vi.mock("../../lib/logger.js", () => ({ logger: { error: mocks.error } }));
vi.mock("@workspace/db", () => ({
  documents: { title: "title", content: "content", organizationId: "organizationId", id: "id" },
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.docs }) }) }) },
}));
vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.auth = { userId: Number(req.headers["x-test-user"] ?? 1), organizationId: Number(req.headers["x-test-org"] ?? 10),
      clerkUserId: "test", role: "backend" };
    next();
  },
}));

import router from "../ai-tools.js";

let server: Server;
let baseURL: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.assign(req, { log: { error: mocks.error }, id: "test-request" }); next(); });
  app.use("/api", router);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())); });
beforeEach(() => { vi.clearAllMocks(); mocks.docs = []; });

async function post(path: string, body: object) {
  const response = await fetch(`${baseURL}${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

describe("AI route characterization", () => {
  it("shares model work for simultaneous identical HTTP requests", async () => {
    let release!: () => void;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const output = { answer: "Read", confidence: 80, sources: [] };
    mocks.create.mockImplementation(async () => {
      started();
      await gate;
      return { choices: [{ message: { content: JSON.stringify(output) } }] };
    });
    const first = post("/ai/ask", { question: "Next?", contextData: "Runbook" });
    await startedPromise;
    const second = post("/ai/ask", { question: "Next?", contextData: "Runbook" });
    // Wait until the second HTTP request is received by Express before releasing AI.
    await new Promise<void>((resolve) => server.once("request", () => { void setImmediate().then(resolve); }));
    release();
    const results = await Promise.all([first, second]);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].status).toBe(200);
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("keeps the existing failure envelope for permanent provider errors", async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error("sensitive provider details"), { status: 401 }));
    expect(await post("/ai/ask", { question: "Next?", contextData: "Runbook" })).toEqual({ status: 500, body: {
      success: false, data: null, error: "Q&A failed",
    } });
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("never invents company context when organization documents are absent", async () => {
    expect(await post("/ai/ask", { question: "What is my team?" })).toEqual({ status: 200, body: {
      success: true, data: { answer: "Not enough data", confidence: 0, sources: [] }, error: null,
    } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns the existing validation error without calling AI", async () => {
    expect(await post("/ai/ask", {})).toEqual({ status: 400, body: {
      success: false, data: null, error: "question is required",
    } });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("uses organization documents and preserves the success envelope", async () => {
    mocks.docs = [{ title: "Runbook", content: "Read first" }];
    const output = { answer: "Read first", confidence: 80, sources: ["Runbook"] };
    mocks.create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(output) } }] });
    expect(await post("/ai/ask", { question: "Next?" })).toEqual({ status: 200, body: {
      success: true, data: output, error: null,
    } });
    expect(mocks.create.mock.calls[0][0].messages[1].content).toContain("[Runbook]: Read first");
  });

  it("returns 404 for an inaccessible document without calling AI", async () => {
    expect(await post("/ai/explain-doc", { docId: 99 })).toEqual({ status: 404, body: {
      success: false, data: null, error: "Document not found",
    } });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
