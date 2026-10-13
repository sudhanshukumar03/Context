import type { TimelineItem } from "../../types";

export type ActivityCategory = "change" | "detection" | "investigation" | "response" | "recovery" | "update";
export const CATEGORY_META: Record<ActivityCategory, { label: string; explanation: string }> = {
  change: { label: "Change", explanation: "A deployment or configuration change was recorded." },
  detection: { label: "Alert", explanation: "A service problem was reported. This alone does not establish its cause." },
  investigation: { label: "Investigation", explanation: "Analysis or a suggested next step was recorded." },
  response: { label: "Response", explanation: "An action to address the problem was recorded." },
  recovery: { label: "Recovery", explanation: "Recovery was reported for this event's scope." },
  update: { label: "Update", explanation: "Supporting activity or a team update." },
};

export function recordTime(item: TimelineItem) {
  const time = Date.parse(item.createdAt);
  return Number.isFinite(time) ? time : null;
}
export function chronological(feed: TimelineItem[]) {
  return [...feed].sort((a, b) => (recordTime(a) ?? Infinity) - (recordTime(b) ?? Infinity) || `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
}
export function categoryOf(item: TimelineItem): ActivityCategory {
  const type = item.type?.toLowerCase() ?? "";
  const text = `${item.title ?? ""} ${item.content ?? ""}`.toLowerCase();
  if (/\b(fully recovered|incident resolved|all services healthy|service restored)\b/.test(text)) return "recovery";
  // A recommendation is evidence of investigation, not proof that an action ran.
  if (/\b(recommended|recommendation|suggested|root cause identified|root cause found|investigating)\b/.test(text)) return "investigation";
  if (["rollback", "restart", "throttle", "mitigation"].includes(type) || /\b(rollback|restart|throttling)(?:\s+to\s+[\w.-]+)?\s+(applied|triggered|initiated|started|completed)\b/.test(text)) return "response";
  if (type === "recovery") return "recovery";
  if (["deployment", "configuration", "config_change"].includes(type)) return "change";
  if (item.kind === "event" && (["failure", "alert", "error", "latency", "error_rate"].includes(type) || item.severity === "critical" || item.severity === "warning")) return "detection";
  return "update";
}
export function recordTitle(item: TimelineItem) {
  return item.kind === "message" ? item.content || "Team update" : item.title || "Service event";
}
export function matchesSearch(item: TimelineItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [item.title, item.content, item.description, item.serviceName, item.author, item.channel, item.type]
    .some(value => value?.toLowerCase().includes(normalized));
}
export function timeLabel(value: string, includeDate = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, includeDate
    ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }
    : { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

export interface ActivityWindow {
  id: string;
  items: TimelineItem[];
  startedAt: string;
  endedAt: string;
  services: string[];
  alerts: number;
  status: "Recovery recorded" | "Needs review" | "Activity only";
}
export function summarizeWindow(items: TimelineItem[]): ActivityWindow {
  const sorted = chronological(items);
  const alerts = sorted.filter(item => categoryOf(item) === "detection");
  const recoveries = sorted.filter(item => categoryOf(item) === "recovery");
  const lastAlert = recordTime(alerts[alerts.length - 1] ?? sorted[0]);
  const lastRecovery = recoveries.length ? recordTime(recoveries[recoveries.length - 1]) : null;
  return {
    id: `${sorted[0].kind}:${sorted[0].id}`, items: sorted, startedAt: sorted[0].createdAt, endedAt: sorted[sorted.length - 1].createdAt,
    services: [...new Set(sorted.map(item => item.serviceName).filter((name): name is string => !!name))], alerts: alerts.length,
    status: recoveries.length && (alerts.length === 0 || (lastRecovery !== null && lastAlert !== null && lastRecovery >= lastAlert))
      ? "Recovery recorded" : alerts.length ? "Needs review" : "Activity only",
  };
}
/** Time windows, not fabricated incident IDs. Invalid timestamps remain visible separately. */
export function buildActivityWindows(feed: TimelineItem[]): ActivityWindow[] {
  const sorted = chronological(feed);
  const windows: ActivityWindow[] = [];
  let current: TimelineItem[] = [];
  for (const item of sorted) {
    const previous = current[current.length - 1];
    const time = recordTime(item);
    const previousTime = previous ? recordTime(previous) : null;
    if (previous && (time === null || previousTime === null || time - previousTime > 2 * 60 * 60 * 1000)) {
      windows.push(summarizeWindow(current)); current = [];
    }
    current.push(item);
  }
  if (current.length) windows.push(summarizeWindow(current));
  return windows.reverse();
}
