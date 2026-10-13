import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const mocks = vi.hoisted(() => ({ create: vi.fn(), error: vi.fn() }));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: mocks.create } } },
}));
vi.mock("../../lib/logger.js", () => ({ logger: { error: mocks.error } }));
vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  return { ...schema, db: { select: () => ({ from: (table: unknown) => {
    const rows = table === schema.services
      ? [{ id: 1, name: "Checkout", status: "healthy", updatedAt: new Date() }]
      : table === schema.serviceEvents
        ? [{ id: 1, serviceId: 1, type: "recovery", title: "Synthetic recovery", severity: "info", createdAt: new Date() }]
        : table === schema.documents ? [{ title: "Runbook", content: "Inspect telemetry." }] : [];
    const query = { where: () => query, orderBy: () => query, limit: async () => rows,
      then: (resolve: (value: object[]) => unknown) => Promise.resolve(rows).then(resolve) };
    return query;
  } }) } };
});
vi.mock("../../middleware/auth.js", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.auth = { userId: 2, organizationId: 10, clerkUserId: "test-member", role: "backend",
      clerkOrganizationId: "org_test", organizationRole: "org:member" };
    next();
  },
}));

import insights from "../insights.js";
import postmortem from "../postmortem.js";
import tools from "../ai-tools.js";

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.assign(req, { log: { error: mocks.error }, id: "test-request" }); next(); });
  app.use(insights); app.use(postmortem); app.use(tools);
  server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
beforeEach(() => vi.resetAllMocks());

async function post(path: string, body: object) {
  const response = await fetch(base + path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const incidentBody = { question: "Is Checkout recovered?" };
describe("AI provider availability responses", () => {
  it.each([
    { path: "/ai/incident-ask", body: incidentBody },
    { path: "/insights/postmortem", body: {} },
    { path: "/ai/brief", body: { role: "backend" } },
    { path: "/ai/ask", body: { question: "Next?" } },
    { path: "/ai/explain-doc", body: { title: "Runbook", content: "Inspect telemetry." } },
    { path: "/ai/breakdown-task", body: { title: "Inspect telemetry" } },
    { path: "/ai/explain-relationship", body: { entityId: "1", entityLabel: "Checkout", graph: { nodes: [], edges: [] } } },
    { path: "/ai/daily-focus", body: {} },
    { path: "/ai/simplify", body: { concept: "Telemetry" } },
  ])("explains upstream exhaustion safely for $path", async ({ path, body }) => {
    mocks.create.mockRejectedValue(Object.assign(new Error("private provider details and credentials"), {
      status: 429, headers: new Headers({ "x-should-retry": "false" }),
    }));
    expect(await post(path, body)).toEqual({ status: 503, body: {
      success: false, data: null, error: "AI provider is rate limited or out of quota. Try again later.",
    } });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("private");
  });

  it.each([
    { path: "/ai/incident-ask", body: incidentBody, status: 503 },
    { path: "/insights/postmortem", body: {}, status: 502 },
    { path: "/ai/simplify", body: { concept: "Telemetry" }, status: 500 },
  ])("explains provider HTTP $status safely for $path", async ({ path, body, status }) => {
    mocks.create.mockRejectedValue(Object.assign(new Error("private provider details and credentials"), {
      status, headers: new Headers({ "x-should-retry": "false" }),
    }));
    expect(await post(path, body)).toEqual({ status: 503, body: {
      success: false, data: null, error: "AI provider is temporarily unavailable. Try again later.",
    } });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(JSON.stringify(mocks.error.mock.calls)).not.toContain("private");
  });

  it.each([429, 503])("allows a later Member incident request to succeed after provider HTTP %s recovery", async status => {
    mocks.create.mockRejectedValueOnce(Object.assign(new Error("private body"), {
      status, headers: new Headers({ "x-should-retry": "false" }),
    }));
    expect((await post("/ai/incident-ask", incidentBody)).status).toBe(503);
    const answer = { answer: "Checkout is healthy.", confidence: 0.9, reasoning: [], impact: [], actions: [], sources: ["Checkout"] };
    mocks.create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(answer) } }] });
    expect(await post("/ai/incident-ask", incidentBody)).toEqual({ status: 200, body: {
      success: true, data: answer, error: null,
    } });
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });

  it.each([
    { path: "/ai/incident-ask", body: incidentBody, error: "AI request failed" },
    { path: "/insights/postmortem", body: {}, error: "Post-mortem generation failed" },
  ])("preserves the safe fallback for permanent failures on $path", async ({ path, body, error }) => {
    mocks.create.mockRejectedValue(Object.assign(new Error("private body"), { status: 401 }));
    expect(await post(path, body)).toEqual({ status: 500, body: { success: false, data: null, error } });
    expect(mocks.create).toHaveBeenCalledOnce();
  });
});
