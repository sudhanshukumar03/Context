import { describe, expect, it } from "vitest";
import { isSlackWebhookUrl, readSlackWebhook, saveSlackWebhook, slackStorageKey } from "./workspace-preferences";

describe("Slack workspace preferences", () => {
  it("accepts only Slack service destinations and rejects invalid input safely", () => {
    expect(isSlackWebhookUrl("https://hooks.slack.com/services/A/B/C")).toBe(true);
    for (const value of ["", "invalid", "https://hooks.slack.com/", "https://hooks.slack.com.evil.test/services/A/B/C", "https://hooks.slack.com/services/A/B/C?x=y"]) {
      expect(isSlackWebhookUrl(value)).toBe(false);
    }
  });
  it("separates accounts, personal workspaces, and teams without delimiter collisions", () => {
    const values = [["user", null], ["user", "team"], ["other", "team"], ["a:b", "c"], ["a", "b:c"]] as const;
    expect(new Set(values.map(([user, org]) => slackStorageKey(user, org))).size).toBe(values.length);
  });
  it("never imports an unscoped legacy webhook into a workspace", () => {
    const values = new Map([["ctx-slack-webhook", "legacy-private-url"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(readSlackWebhook(storage, "user", null)).toBe("");
    expect(saveSlackWebhook(storage, "user", "team", "team-url")).toBe(true);
    expect(readSlackWebhook(storage, "user", "team")).toBe("team-url");
    expect(readSlackWebhook(storage, "user", null)).toBe("");
    expect(readSlackWebhook(storage, "other", "team")).toBe("");
    expect(values.get("ctx-slack-webhook")).toBe("legacy-private-url");
  });
  it("handles disabled browser storage without breaking the dashboard", () => {
    const storage = { getItem: () => { throw new Error("Unavailable"); }, setItem: () => { throw new Error("Unavailable"); } };
    expect(readSlackWebhook(storage, "user", null)).toBe("");
    expect(saveSlackWebhook(storage, "user", null, "url")).toBe(false);
    const deniedGetter = () => { throw new Error("SecurityError"); };
    expect(readSlackWebhook(deniedGetter, "user", null)).toBe("");
    expect(saveSlackWebhook(deniedGetter, "user", null, "url")).toBe(false);
  });
});
