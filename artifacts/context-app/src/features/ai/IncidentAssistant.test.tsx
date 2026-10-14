// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PersistedTabPanel from "../../components/PersistedTabPanel";
import Assistant from "./IncidentAssistant";

const auth = vi.hoisted(() => ({ getToken: vi.fn(async () => "test-token"), user: { id: "test-user" }, orgId: "test-team" as string | null }));
vi.mock("../../lib/auth-session", () => ({ useAuth: () => auth }));

const context = { services: 2, affected: 1, records: 4 };
const answer = { answer: "Inspect the database latency.\n\nCompare it with the recent deployment.", confidence: .8, sources: ["Database alert"], reasoning: ["The alert follows a deployment."], impact: ["Checkout is degraded."], actions: ["Compare the timestamps."] };
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(request: (path: string, token: string | null, options?: RequestInit) => Promise<unknown>, active = true, workspace = auth.orgId) {
  return <PersistedTabPanel key={workspace} active={active} id="panel-ai" labelledBy="tab-ai"><Assistant active={active} role="sre" request={request} context={context} onNavigate={() => {}} /></PersistedTabPanel>;
}
function ask(question: string) {
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "Send question" }));
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); auth.orgId = "test-team"; });

describe("AI investigation interaction", () => {
  it("uses the selected audience for new questions while retaining the original audience on earlier answers", async () => {
    const request = vi.fn((path: string) => Promise.resolve(path === "/ai/auto-insights" ? [] : answer));
    const view = render(<Assistant role="engineer" request={request} context={context} onNavigate={() => {}} />);
    ask("What changed?");
    expect(await screen.findByText("Context AI · Engineer view")).toBeTruthy();
    view.rerender(<Assistant role="manager" request={request} context={context} onNavigate={() => {}} />);
    expect(screen.getByText("Context AI · Engineer view")).toBeTruthy();
    expect(screen.getByText("Investigation steps")).toBeTruthy();
    ask("What should I communicate?");
    expect(await screen.findByText("Context AI · Manager view")).toBeTruthy();
    expect(screen.getByText("Follow-up decisions")).toBeTruthy();
    const calls = request.mock.calls as unknown as [string, string | null, RequestInit][];
    expect(calls.filter(([path]) => path === "/ai/incident-ask").map(([, , options]) => JSON.parse(String(options.body)).role)).toEqual(["engineer", "manager"]);
  });
  it("does not fetch until first visit, and preserves the draft and answer across navigation", async () => {
    const result = deferred();
    const request = vi.fn((path: string) => path === "/ai/auto-insights" ? Promise.resolve([]) : result.promise);
    const view = render(fixture(request, false));
    expect(request).not.toHaveBeenCalled();
    view.rerender(fixture(request));
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Why is Checkout slow?" } });
    view.rerender(fixture(request, false));
    expect(screen.queryByLabelText("Your question")).not.toBeNull();
    expect(document.getElementById("panel-ai")?.hidden).toBe(true);
    view.rerender(fixture(request));
    expect((screen.getByLabelText("Your question") as HTMLInputElement).value).toBe("Why is Checkout slow?");
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(request.mock.calls.filter(([path]) => path === "/ai/incident-ask")).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Waiting for AI response" }).hasAttribute("disabled")).toBe(true);
    view.rerender(fixture(request, false));
    await act(async () => result.resolve(answer));
    view.rerender(fixture(request));
    expect(screen.getByText("Inspect the database latency.")).toBeTruthy();
    expect(screen.getByText("Compare it with the recent deployment.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send question" })).toBeTruthy();
  });
  it("shows provider errors and lets the user submit another question", async () => {
    let attempt = 0;
    const request = vi.fn((path: string) => path === "/ai/auto-insights" ? Promise.resolve([]) : ++attempt === 1 ? Promise.reject(new Error("AI provider unavailable. Try again.")) : Promise.resolve(answer));
    render(fixture(request)); ask("Explain this alert");
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "AI provider unavailable. Try again.");
    ask("Try the investigation again");
    expect(await screen.findByText("Inspect the database latency.")).toBeTruthy();
  });
  it("aborts a pending request and clears conversation when the workspace changes", async () => {
    const result = deferred(); let signal: AbortSignal | undefined;
    const request = vi.fn((path: string, _token: string | null, options?: RequestInit) => {
      if (path === "/ai/auto-insights") return Promise.resolve([]);
      signal = options?.signal ?? undefined; return result.promise;
    });
    const view = render(fixture(request)); ask("Old team incident");
    await waitFor(() => expect(signal).toBeDefined());
    auth.orgId = "new-team";
    view.rerender(fixture(request));
    expect(signal?.aborted).toBe(true);
    await act(async () => result.resolve(answer));
    expect(screen.queryByText("Old team incident")).toBeNull();
    expect(screen.queryByText("Inspect the database latency.")).toBeNull();
    expect((screen.getByLabelText("Your question") as HTMLInputElement).value).toBe("");
  });
  it("does not send duplicate requests while awaiting the authentication token", async () => {
    const token = deferred(); const result = deferred();
    const request = vi.fn((path: string) => path === "/ai/auto-insights" ? Promise.resolve([]) : result.promise);
    render(fixture(request));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/ai/auto-insights", "test-token", expect.anything()));
    auth.getToken.mockImplementationOnce(() => token.promise as Promise<string>);
    ask("Check current health");
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Duplicate question" } });
    fireEvent.submit(screen.getByLabelText("Your question").closest("form")!);
    await act(async () => { token.resolve("test-token"); result.resolve(answer); });
    expect(request.mock.calls.filter(([path]) => path === "/ai/incident-ask")).toHaveLength(1);
  });
  it("ends the pending state when token retrieval exceeds the request deadline", async () => {
    const token = deferred();
    const request = vi.fn((path: string) => Promise.resolve(path === "/ai/auto-insights" ? [] : answer));
    render(fixture(request));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/ai/auto-insights", "test-token", expect.anything()));
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValueOnce(deadline.signal);
    auth.getToken.mockImplementationOnce(() => token.promise as Promise<string>);
    ask("Check my incident");
    await act(async () => deadline.abort(new DOMException("Timed out", "TimeoutError")));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "The AI response took too long. Send your question again.");
    expect(screen.queryByRole("button", { name: "Waiting for AI response" })).toBeNull();
    expect(request.mock.calls.filter(([path]) => path === "/ai/incident-ask")).toHaveLength(0);
    await act(async () => token.resolve("test-token"));
    expect(request.mock.calls.filter(([path]) => path === "/ai/incident-ask")).toHaveLength(0);
  });
});
