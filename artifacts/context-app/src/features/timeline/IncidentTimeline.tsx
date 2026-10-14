import { useMemo, useState } from "react";
import { Activity, CheckCircle2, GitBranch, Search, MessageSquare, Wrench, FileSearch, ChevronDown, X, Clock } from "lucide-react";
import type { TimelineItem } from "../../types";
import { buildActivityWindows, categoryOf, CATEGORY_META, chronological, highlightActivity, matchesSearch, recordTime, recordTitle, timeLabel, type ActivityCategory } from "./timeline-model";

const ICONS = { change: GitBranch, detection: Activity, investigation: FileSearch, response: Wrench, recovery: CheckCircle2, update: MessageSquare };

export function ActivityStory({ items }: { items: TimelineItem[] }) {
  return <ol className="ctx-story" aria-label="Activity in chronological order">
    {chronological(items).map(item => {
      const category = categoryOf(item), Icon = ICONS[category];
      const title = recordTitle(item);
      return <li key={`${item.kind}:${item.id}`} className="ctx-story-row">
        <time className="ctx-story-time" dateTime={recordTime(item) === null ? undefined : item.createdAt} title={timeLabel(item.createdAt, true)}>{recordTime(item) === null ? "Time unavailable" : <><span>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><strong>{timeLabel(item.createdAt)}</strong></>}</time>
        <div className={`ctx-story-marker ctx-tone-${category}`}><Icon size={16} aria-hidden="true" /></div>
        <article className="ctx-story-content">
          <div className="ctx-record-meta"><span className={`ctx-category ctx-tone-${category}`}>{CATEGORY_META[category].label}</span><span>{item.serviceName || (item.kind === "message" ? "Team communication" : "Workspace activity")}</span>{item.severity && item.severity !== "info" && <span className={`ctx-badge ctx-status-${item.severity}`}>{item.severity}</span>}</div>
          <h3 className="ctx-record-title">{title}</h3>
          {item.description && item.description !== title && <p className="ctx-record-description">{item.description}</p>}
          <div className="ctx-record-source">{item.kind === "message" ? `${item.author || "Team"}${item.channel ? ` in #${item.channel}` : ""}` : "Service event"}</div>
          <details className="ctx-record-details"><summary>View evidence <ChevronDown size={14} aria-hidden="true" /></summary><dl className="ctx-detail-grid">
            <div><dt>Source</dt><dd>{item.kind === "message" ? `${item.author || "Team"}${item.channel ? ` in #${item.channel}` : ""}` : "Service event"}</dd></div>
            <div><dt>Recorded at</dt><dd>{recordTime(item) === null ? "Time unavailable" : new Date(item.createdAt).toLocaleString()}</dd></div>
            <div><dt>Event type</dt><dd>{item.type || (item.kind === "message" ? "Message" : "Not provided")}</dd></div>
            <div><dt>Interpretation</dt><dd>{CATEGORY_META[category].explanation}</dd></div>
          </dl></details>
        </article>
      </li>;
    })}
  </ol>;
}

export function TimelineTab({ feed, loading }: { feed: TimelineItem[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [service, setService] = useState("all");
  const [view, setView] = useState<"highlights" | "all">("highlights");
  const sorted = useMemo(() => chronological(feed), [feed]);
  const highlights = useMemo(() => highlightActivity(feed), [feed]);
  const services = [...new Set(feed.map(item => item.serviceName).filter((name): name is string => !!name))];
  const records = view === "highlights" ? highlights : sorted;
  const filtered = records.filter(item => matchesSearch(item, search) && (category === "all" || categoryOf(item) === category) && (service === "all" || item.serviceName === service));
  const counts = sorted.reduce((result, item) => { result[categoryOf(item)]++; return result; }, { change: 0, detection: 0, investigation: 0, response: 0, recovery: 0, update: 0 });
  const latestFirst = [...sorted].reverse();
  const checkpoints = [
    { label: "First alert", item: sorted.find(item => categoryOf(item) === "detection") },
    { label: "Latest response", item: latestFirst.find(item => categoryOf(item) === "response") },
    { label: "Latest recovery evidence", item: latestFirst.find(item => categoryOf(item) === "recovery") },
  ];
  const reset = () => { setSearch(""); setCategory("all"); setService("all"); };
  if (loading) return <p role="status" className="ctx-empty">Loading recorded activity…</p>;
  if (!feed.length) return <div className="ctx-empty"><Clock size={28} aria-hidden="true" /><h3>No activity recorded yet</h3><p>Connect an alert source or ask an admin to run a demo. Events and team messages will appear here in time order.</p></div>;
  return <div className="ctx-timeline-layout">
    <section className="ctx-panel ctx-timeline-brief" aria-label="Timeline summary">
      <div><h3>Activity briefing</h3><p>{feed.length} records across {services.length} service{services.length === 1 ? "" : "s"}.</p><p className="ctx-window-range">{timeLabel(sorted[0].createdAt, true)} to {timeLabel(sorted[sorted.length - 1].createdAt, true)}</p></div>
      <dl className="ctx-evidence-counts"><div><dt>Changes</dt><dd>{counts.change}</dd></div><div><dt>Alerts</dt><dd>{counts.detection}</dd></div><div><dt>Responses</dt><dd>{counts.response}</dd></div><div><dt>Recoveries</dt><dd>{counts.recovery}</dd></div></dl>
      <dl className="ctx-story-checkpoints">{checkpoints.map(checkpoint => <div key={checkpoint.label}><dt>{checkpoint.label}</dt><dd>{checkpoint.item ? recordTitle(checkpoint.item) : "Not recorded"}</dd>{checkpoint.item && <time dateTime={checkpoint.item.createdAt}>{timeLabel(checkpoint.item.createdAt, true)}</time>}</div>)}</dl>
    </section>
    <section className="ctx-panel ctx-timeline-surface">
      <div className="ctx-activity-view"><div className="ctx-segmented" role="group" aria-label="Activity detail level"><button aria-pressed={view === "highlights"} onClick={() => setView("highlights")}>Highlights <span>{highlights.length}</span></button><button aria-pressed={view === "all"} onClick={() => setView("all")}>All activity <span>{feed.length}</span></button></div><p>{view === "highlights" ? "First and latest records per service and type. Critical alerts and team messages stay visible." : "Every recorded event and team message."}</p></div>
      <div className="ctx-timeline-tools">
        <div className="ctx-search-field"><label htmlFor="activity-search">Find a record</label><div><Search size={17} aria-hidden="true" /><input id="activity-search" type="search" className="ctx-input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search events, people or messages" autoComplete="off" />{search && <button aria-label="Clear timeline search" onClick={() => setSearch("")}><X size={16} /></button>}</div></div>
        <label className="ctx-filter-label">Service<select value={service} onChange={event => setService(event.target.value)} className="ctx-input"><option value="all">All services</option>{services.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <label className="ctx-filter-label">Record type<select value={category} onChange={event => setCategory(event.target.value as ActivityCategory | "all")} className="ctx-input"><option value="all">All records</option>{Object.entries(CATEGORY_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></label>
      </div>
      <div className="ctx-timeline-order"><span>{filtered.length} of {records.length} {view === "highlights" ? "highlights" : "records"}</span><span>Earliest to latest · your timezone</span></div>
      {filtered.length ? <ActivityStory items={filtered} /> : <div className="ctx-empty"><h3>No matching records</h3><p>{view === "highlights" ? "Search all activity to include records omitted from Highlights, or adjust your filters." : "Try another service, record type or search term."}</p>{view === "highlights" && <button className="ctx-primary-button" onClick={() => setView("all")}>Search all activity</button>}<button className="ctx-secondary-button" onClick={reset}>Clear filters</button></div>}
    </section>
    <p className="ctx-footnote">Categories describe the evidence in each record. A change is not automatically a root cause, and a recovery event is not proof that the whole system recovered.</p>
  </div>;
}

export function IncidentHistoryTab({ feed, loading }: { feed: TimelineItem[]; loading: boolean }) {
  const windows = useMemo(() => buildActivityWindows(feed), [feed]);
  if (loading) return <p className="ctx-empty" role="status">Loading activity history…</p>;
  if (!windows.length) return <div className="ctx-empty"><Clock size={28} /><h3>No history recorded</h3><p>Past service events and team updates will be organized here when activity arrives.</p></div>;
  return <div className="ctx-history">
    <p className="ctx-footnote">{windows.length} activity window{windows.length === 1 ? "" : "s"}. A gap of more than two hours starts a new window. These are grouped records, not confirmed incident boundaries.</p>
    {windows.map(window => {
      const minutes = Math.max(0, Math.round(((Date.parse(window.endedAt) || 0) - (Date.parse(window.startedAt) || 0)) / 60000));
      return <details key={window.id} className="ctx-panel ctx-history-window">
        <summary><div className="ctx-history-heading"><span className={`ctx-badge ctx-status-${window.status === "Recovery recorded" ? "healthy" : window.status === "Needs review" ? "warning" : "info"}`}>{window.status}</span><h3>{window.services.length ? window.services.slice(0, 2).join(" & ") : "Workspace activity"}{window.services.length > 2 ? ` +${window.services.length - 2}` : ""}</h3><p>{timeLabel(window.startedAt, true)}{recordTime(window.items[0]) !== null ? ` · ${minutes} min between first and last record` : ""}</p></div><div className="ctx-history-count"><strong>{window.items.length} records</strong><span>{window.alerts} alert{window.alerts === 1 ? "" : "s"}</span><ChevronDown size={18} aria-hidden="true" /></div></summary>
        <div className="ctx-history-body"><div className="ctx-history-note"><p><strong>Services mentioned:</strong> {window.services.join(", ") || "None specified"}</p><p>{window.status === "Recovery recorded" ? "Recovery evidence appears after the last alert. Review the records to verify the scope." : window.status === "Needs review" ? "No later recovery evidence follows the latest alert in this window." : "This window contains supporting activity without a recorded alert."}</p></div><ActivityStory items={window.items} /></div>
      </details>;
    })}
  </div>;
}
