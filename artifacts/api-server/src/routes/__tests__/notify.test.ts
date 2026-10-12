import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
const mocks = vi.hoisted(() => ({ role: "org:admin", signedIn: true, provider: vi.fn() }));
vi.mock("../../middleware/auth.js", async () => ({ ...(await import("../../middleware/organization-permissions.js")),
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!mocks.signedIn) { res.status(401).end(); return; }
    req.auth = { userId: 1, clerkUserId: "user_test", organizationId: 20, role: "backend", clerkOrganizationId: "org_test", organizationRole: mocks.role }; next();
  } }));
import router from "../notify.js";
const originalFetch = globalThis.fetch;
let server: Server; let base: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use(router);
  server = await new Promise<Server>((resolve) => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => {
  vi.clearAllMocks(); mocks.role = "org:admin"; mocks.signedIn = true; mocks.provider.mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", mocks.provider);
});
afterEach(() => vi.unstubAllGlobals());
const send = (body: unknown) => originalFetch(base + "/notify/slack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const body = { webhookUrl: "https://hooks.slack.com/services/TEST/CHANNEL/SYNTHETIC", text: "Synthetic incident" };
describe("Slack notifications", () => {
  it("requires sign-in and a verified admin role for shared notifications", async () => {
    mocks.signedIn = false; expect((await send(body)).status).toBe(401);
    mocks.signedIn = true; mocks.role = "org:member";
    expect((await send({ ...body, role: "org:admin" })).status).toBe(403); expect(mocks.provider).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...body, text: 123 }, { ...body, text: " " }, { ...body, text: "a".repeat(40001) },
    { ...body, webhookUrl: "not a URL" }, { ...body, webhookUrl: "https://hooks.slack.com.evil.test/services/A/B/C" },
    { ...body, webhookUrl: "https://hooks.slack.com/services/A/B/C?redirect=evil" },
    { ...body, webhookUrl: "https://user:password@hooks.slack.com/services/A/B/C" }])("rejects malformed payloads without making a provider request: %j", async (value) => {
    expect((await send(value)).status).toBe(400); expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("bounds provider requests and refuses redirects", async () => {
    expect((await send(body)).status).toBe(200);
    expect(mocks.provider).toHaveBeenCalledWith(body.webhookUrl, expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal), body: JSON.stringify({ text: body.text }) }));
  });
  it("returns a safe error for provider failure", async () => {
    mocks.provider.mockRejectedValue(new Error("secret webhook in network error"));
    const response = await send(body); expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
