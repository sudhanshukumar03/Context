import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { sendWorkspaceSlack, type SlackApiRequest } from "./slack-notifications";
import { readSlackWebhook, saveSlackWebhook } from "./workspace-preferences";

const destinations = {
  personal: "https://hooks.slack.com/services/LOCAL/PERSONAL/QA",
  teamA: "https://hooks.slack.com/services/LOCAL/TEAM_A/QA",
  teamB: "https://hooks.slack.com/services/LOCAL/TEAM_B/QA",
  otherAdmin: "https://hooks.slack.com/services/LOCAL/OTHER_ADMIN/QA",
};
let server: Server; let receiver: string;
let captured: { webhookUrl: string; text: string; authorization: string }[] = [];
const values = new Map<string, string>();
const storage = { getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); } };
const request: SlackApiRequest = async (path, token, options) => {
  expect(path).toBe("/notify/slack");
  const response = await fetch(receiver, { ...options,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Local receiver rejected notification");
  return response.json();
};
beforeAll(async () => {
  server = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    captured.push({ ...body, authorization: req.headers.authorization ?? "" });
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ sent: true }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  receiver = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
beforeEach(() => { captured = []; values.clear(); });

describe("Slack dispatch workspace isolation with a local HTTP receiver", () => {
  it("routes saved destinations separately for personal workspaces, teams and another admin", async () => {
    const scopes = [["admin", null, destinations.personal], ["admin", "team-a", destinations.teamA],
      ["admin", "team-b", destinations.teamB], ["other-admin", "team-a", destinations.otherAdmin]] as const;
    for (const [user, org, url] of scopes) saveSlackWebhook(storage, user, org, url);
    for (const [user, org] of [...scopes, scopes[0], scopes[1]]) {
      const url = readSlackWebhook(storage, user, org);
      expect(await sendWorkspaceSlack(url, `Synthetic ${org ?? "personal"}`, async () => `${user}/${org ?? "personal"}`,
        () => true, request)).toBe(true);
    }
    expect(captured.map(item => item.webhookUrl)).toEqual([
      destinations.personal, destinations.teamA, destinations.teamB, destinations.otherAdmin, destinations.personal, destinations.teamA,
    ]);
    expect(captured.map(item => item.authorization)).toEqual([
      "Bearer admin/personal", "Bearer admin/team-a", "Bearer admin/team-b", "Bearer other-admin/team-a", "Bearer admin/personal", "Bearer admin/team-a",
    ]);
    expect(readSlackWebhook(storage, "member", "team-a")).toBe("");
  });

  it.each(["workspace switch", "account switch", "role change", "unmount"])("drops a delayed test message after %s", async () => {
    let release!: (token: string) => void; let current = true;
    const token = new Promise<string>(resolve => { release = resolve; });
    const pending = sendWorkspaceSlack(destinations.teamA, "Synthetic pending", () => token, () => current, request);
    current = false; release("token-for-later-scope");
    expect(await pending).toBe(false); expect(captured).toEqual([]);
  });

  it("does not request a token for an already abandoned scope", async () => {
    const getToken = vi.fn();
    expect(await sendWorkspaceSlack(destinations.teamA, "Synthetic", getToken, () => false, request)).toBe(false);
    expect(getToken).not.toHaveBeenCalled(); expect(captured).toEqual([]);
  });

  it("does not mark an old response successful in a later scope", async () => {
    let current = true; let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const delayedRequest = vi.fn(async () => { await gate; });
    const pending = sendWorkspaceSlack(destinations.teamA, "Synthetic", async () => "test-token", () => current, delayedRequest);
    await vi.waitFor(() => expect(delayedRequest).toHaveBeenCalledOnce());
    current = false; finish(); expect(await pending).toBe(false);
  });

  it("rejects invalid destinations before authentication or dispatch", async () => {
    const getToken = vi.fn();
    await expect(sendWorkspaceSlack("https://evil.example/", "Synthetic", getToken, () => true, request)).rejects.toThrow("valid Slack");
    expect(getToken).not.toHaveBeenCalled(); expect(captured).toEqual([]);
  });
});
