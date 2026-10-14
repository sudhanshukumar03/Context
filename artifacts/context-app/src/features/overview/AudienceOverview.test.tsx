// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AudienceOverview from "./AudienceOverview";
import { readAudience, saveAudience } from "./audience";
import type { Service, TimelineItem } from "../../types";

const services: Service[] = [
  {
    id: 1,
    name: "Checkout",
    status: "healthy",
    ownerTeam: "Commerce",
    criticality: "high",
    description: null,
    createdAt: "2026-10-14T08:00:00Z",
  },
];
const feed: TimelineItem[] = [
  {
    id: "1",
    kind: "event",
    serviceName: "Checkout",
    createdAt: "2026-10-14T08:00:00Z",
    type: "deployment",
    title: "Checkout deployment recorded",
    severity: "info",
  },
  {
    id: "2",
    kind: "event",
    serviceName: "Checkout",
    createdAt: "2026-10-14T08:05:00Z",
    type: "failure",
    title: "Checkout errors reported",
    severity: "critical",
  },
  {
    id: "3",
    kind: "message",
    serviceName: null,
    createdAt: "2026-10-14T08:10:00Z",
    content: "Incident resolved",
    author: "Responder",
    channel: "incident",
  },
];
const defaults = {
  services,
  feed,
  edges: [{ from: "1", to: "2", label: "depends on" }],
  rootCause: null,
  onNavigate: vi.fn(),
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("audience workspaces", () => {
  it("gives an engineer change evidence and per-service investigation, with historical alerts distinguished from current health", () => {
    render(<AudienceOverview {...defaults} role="engineer" />);
    expect(
      screen.getByRole("heading", { name: "Recent changes" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Service investigation" }),
    ).toBeTruthy();
    expect(screen.getByText("healthy")).toBeTruthy();
    expect(
      screen.getByText(
        "Historical evidence; current health is shown separately.",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/1 dependency/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inspect topology" }));
    expect(defaults.onNavigate).toHaveBeenCalledWith("graph");
    expect(screen.queryByRole("heading", { name: "What we know" })).toBeNull();
  });
  it("gives an SRE current priority and recovery checkpoints without converting old alerts into current failures", () => {
    render(<AudienceOverview {...defaults} role="sre" />);
    expect(screen.getByLabelText("Response checkpoints")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("Incident resolved")).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Service investigation" }),
    ).toBeNull();
  });
  it("gives a manager a briefing, ownership and communications, and does not invent financial impact or an ETA", () => {
    render(<AudienceOverview {...defaults} role="manager" />);
    expect(
      screen.getByText("All 1 recorded services are currently healthy."),
    ).toBeTruthy();
    expect(screen.getByText(/Not measured in this workspace/)).toBeTruthy();
    expect(screen.getByText("Commerce")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Team communications" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Recorded alerts" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare an AI briefing" }),
    );
    expect(defaults.onNavigate).toHaveBeenCalledWith("ai");
  });
  it("explains empty data without claiming healthy services or a completed incident", () => {
    render(
      <AudienceOverview {...defaults} services={[]} feed={[]} role="manager" />,
    );
    expect(screen.getByText("No service data available.")).toBeTruthy();
    expect(
      screen.getByText("No recovery report is available in this window."),
    ).toBeTruthy();
  });
  it("keeps a prior recovery report separate from current unhealthy status and an unconfirmed ETA", () => {
    render(
      <AudienceOverview
        {...defaults}
        services={[{ ...services[0], status: "failing" }]}
        role="manager"
      />,
    );
    expect(
      screen.getByText("1 of 1 services need attention: Checkout."),
    ).toBeTruthy();
    expect(
      screen.getByText(/A recovery ETA has not been confirmed/),
    ).toBeTruthy();
    expect(screen.getByText("1 need attention")).toBeTruthy();
    expect(screen.queryByText("Recorded healthy")).toBeNull();
  });
  it("remembers the audience separately for each account and workspace, with safe fallback when storage is unavailable", () => {
    const entries = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => entries.set(key, value),
    });
    saveAudience(storage, "alice", "team", "manager");
    expect(readAudience(storage, "alice", "team")).toBe("manager");
    expect(readAudience(storage, "bob", "team")).toBe("sre");
    expect(readAudience(storage, "alice", null)).toBe("sre");
    expect(
      readAudience(
        () => {
          throw new Error("Storage blocked");
        },
        "alice",
        "team",
      ),
    ).toBe("sre");
    expect(() =>
      saveAudience(
        () => {
          throw new Error("Storage blocked");
        },
        "alice",
        "team",
        "engineer",
      ),
    ).not.toThrow();
  });
});
