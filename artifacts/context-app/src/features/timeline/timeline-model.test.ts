import { describe, expect, it } from "vitest";
import type { TimelineItem } from "../../types";
import { buildActivityWindows, categoryOf, chronological, highlightActivity, matchesSearch } from "./timeline-model";
const item = (id: string, time: string, overrides: Partial<TimelineItem> = {}): TimelineItem => ({ id, kind: "event", createdAt: time, serviceName: "Payments API", severity: "info", type: "webhook", title: "Information recorded", ...overrides });
describe("Timeline evidence", () => {
  it("keeps information as an update and deployment as a change regardless of feed order", () => {
    expect(categoryOf(item("1", "2026-10-14T10:00:00Z"))).toBe("update");
    expect(categoryOf(item("2", "2026-10-14T10:01:00Z", { type: "deployment", title: "Checkout deployment", severity: "info" }))).toBe("change");
  });
  it("distinguishes suggested rollback from a recorded action", () => {
    expect(categoryOf(item("1", "2026-10-14T10:00:00Z", { kind: "message", content: "Rollback recommended after investigation" }))).toBe("investigation");
    expect(categoryOf(item("2", "2026-10-14T10:01:00Z", { kind: "message", content: "Rollback triggered on Payments API" }))).toBe("response");
    expect(categoryOf(item("3", "2026-10-14T10:02:00Z", { type: "recovery", title: "Payments API: rollback to v2.4.0 initiated" }))).toBe("response");
  });
  it("does not turn negated or conditional recovery messages into recovery evidence", () => {
    for (const content of ["Database is not fully recovered", "When all services healthy, close the incident", "Service restored is unconfirmed", "Incident resolved? Not yet; still investigating."]) {
      expect(categoryOf(item("message", "2026-10-14T10:10:00Z", { kind: "message", content }))).not.toBe("recovery");
    }
    expect(categoryOf(item("event", "2026-10-14T10:10:00Z", { type: "recovery", title: "Payments API is not fully recovered", severity: "warning" }))).toBe("detection");
    const records = [item("alert", "2026-10-14T10:00:00Z", { type: "failure" }), item("update", "2026-10-14T10:10:00Z", { kind: "message", content: "Database is not fully recovered" })];
    expect(buildActivityWindows(records)[0].status).toBe("Needs review");
    expect(categoryOf(item("ok", "2026-10-14T10:10:00Z", { kind: "message", content: "Incident resolved. All services healthy." }))).toBe("recovery");
  });
  it("does not treat one earlier recovery as resolution of a later alert", () => {
    const windows = buildActivityWindows([
      item("3", "2026-10-14T10:20:00Z", { type: "failure", severity: "critical" }),
      item("1", "2026-10-14T10:00:00Z", { type: "failure", severity: "critical" }),
      item("2", "2026-10-14T10:10:00Z", { type: "recovery" }),
    ]);
    expect(windows[0].status).toBe("Needs review");
    expect(windows[0].items.map(record => record.id)).toEqual(["1", "2", "3"]);
  });
  it("labels recovery evidence without claiming confirmed resolution or incident duration", () => {
    const windows = buildActivityWindows([item("1", "2026-10-14T10:00:00Z", { type: "failure" }), item("2", "2026-10-14T10:20:00Z", { type: "recovery" })]);
    expect(windows[0].status).toBe("Recovery recorded");
    expect(windows[0].alerts).toBe(1);
    expect(windows[0].services).toEqual(["Payments API"]);
  });
  it("separates distant windows and preserves invalid timestamp records", () => {
    const feed = [item("bad", "not-a-date"), item("later", "2026-10-14T15:00:00Z"), item("first", "2026-10-14T10:00:00Z")];
    expect(chronological(feed).map(record => record.id)).toEqual(["first", "later", "bad"]);
    expect(buildActivityWindows(feed)).toHaveLength(3);
    expect(buildActivityWindows(feed).flatMap(window => window.items)).toHaveLength(3);
  });
  it("can find author, channel and descriptions as well as a service or title", () => {
    const record = item("1", "2026-10-14T10:00:00Z", { kind: "message", author: "ops-bot", channel: "incidents", description: "Pool exhausted" });
    for (const search of ["OPS-BOT", "incidents", "pool", "payments"]) expect(matchesSearch(record, search)).toBe(true);
    expect(matchesSearch({ id: "empty", kind: "event", serviceName: null, createdAt: "2026-10-14T10:00:00Z" }, " ")).toBe(true);
  });
  it("highlights first/latest service evidence while preserving communications and unknown times", () => {
    const feed = [
      item("first", "2026-10-14T10:00:00Z", { type: "failure" }),
      item("repeat", "2026-10-14T10:01:00Z", { type: "latency" }),
      item("latest", "2026-10-14T10:02:00Z", { type: "failure" }),
      item("critical", "2026-10-14T10:01:30Z", { type: "failure", severity: "critical" }),
      item("other-service", "2026-10-14T10:03:00Z", { type: "failure", serviceName: "Database" }),
      item("decision", "2026-10-14T10:04:00Z", { kind: "message", content: "Investigating errors" }),
      item("recovery", "2026-10-14T10:05:00Z", { type: "recovery" }),
      item("unknown", "invalid", { type: "failure" }),
    ];
    expect(highlightActivity(feed).map(record => record.id)).toEqual(["first", "critical", "latest", "other-service", "decision", "recovery", "unknown"]);
    expect(highlightActivity([...feed].reverse())).toEqual(highlightActivity(feed));
    expect(feed).toHaveLength(8);
  });
  it("does not hide earlier activity windows when later records concern the same service", () => {
    const feed = [item("earlier", "2026-10-14T10:00:00Z", { type: "failure" }), item("later", "2026-10-14T15:00:00Z", { type: "failure" })];
    expect(highlightActivity(feed).map(record => record.id)).toEqual(["earlier", "later"]);
    expect(highlightActivity([])).toEqual([]);
  });
});
