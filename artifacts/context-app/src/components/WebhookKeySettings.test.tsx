// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Settings from "./WebhookKeySettings";

const auth = vi.hoisted(() => ({ getToken: vi.fn(async () => "test-token"), orgId: "team-a", orgRole: "org:admin" }));
vi.mock("../lib/auth-session", () => ({ useAuth: () => auth }));
let requests: ReturnType<typeof vi.fn>;
beforeEach(() => {
  auth.orgId = "team-a"; auth.orgRole = "org:admin"; auth.getToken.mockResolvedValue("test-token");
  requests = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }));
  vi.stubGlobal("fetch", requests);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("does not create a key after its pending token request changes workspace", async () => {
  const view = render(<Settings />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Create key" }).hasAttribute("disabled")).toBe(false));
  let resolve!: (token: string) => void;
  auth.getToken.mockImplementationOnce(() => new Promise<string>(yes => { resolve = yes; }));
  fireEvent.click(screen.getByRole("button", { name: "Create key" }));
  auth.orgId = "team-b";
  view.rerender(<Settings />);
  await waitFor(() => expect(requests).toHaveBeenCalledTimes(2));
  await act(async () => resolve("old-workspace-token"));
  expect(requests.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
  expect(screen.queryByLabelText("New secret key")).toBeNull();
});
it("ends a key operation when authentication exceeds the deadline", async () => {
  render(<Settings />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Create key" }).hasAttribute("disabled")).toBe(false));
  const deadline = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(deadline.signal);
  auth.getToken.mockImplementationOnce(() => new Promise<string>(() => {}));
  fireEvent.click(screen.getByRole("button", { name: "Create key" }));
  await act(async () => deadline.abort(new DOMException("Authentication timed out. Please retry.", "TimeoutError")));
  expect(await screen.findByText("Webhook request timed out. Please retry.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Create key" }).hasAttribute("disabled")).toBe(false);
  expect(requests).toHaveBeenCalledTimes(1);
});
