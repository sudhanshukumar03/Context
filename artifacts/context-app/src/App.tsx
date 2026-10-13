import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  Sparkles, Bot, ChevronRight, ArrowRight, CheckCircle2, X, Sun, Moon,
  AlertTriangle, Activity, Network, MessageSquare, Clock, RefreshCw,
  Shield, Terminal, Zap, Send, AlertCircle, TrendingDown, Radio,
  Database, Server, Package, ChevronDown, Play, Info, SkipForward,
  Siren, TrendingUp, Wrench, RotateCcw, Pause, Users, BarChart3,
  ChevronUp, Eye, Copy, Check, Search, ZoomIn, ZoomOut, Timer,
  FileText, Download, Webhook, ListChecks,
} from "lucide-react";
import {
  ClerkProvider, ClerkLoading, ClerkLoaded, ClerkFailed, SignIn, SignUp, Show, useClerk, OrganizationSwitcher,
} from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import DemoVideoInline from "./components/DemoVideoInline";
import ContextLogo, { ContextMark } from "./components/ContextLogo";
import WebhookKeySettings from "./components/WebhookKeySettings";
import SlackSettingsModal from "./components/SlackSettingsModal";
import AIAssistant from "./features/ai/IncidentAssistant";
import { TimelineTab, IncidentHistoryTab } from "./features/timeline/IncidentTimeline";
import { chronological, categoryOf, CATEGORY_META, recordTitle, timeLabel } from "./features/timeline/timeline-model";
import WorkspaceActions from "./components/WorkspaceActions";
import { ApplicationStatus, AuthenticationLoading } from "./components/ApplicationStartup";
import { ClerkSession, DevSession, isDevAuthBypass, useAuth, useUser } from "./lib/auth-session";
import { readSlackWebhook, saveSlackWebhook } from "./lib/workspace-preferences";
import { sendWorkspaceSlack } from "./lib/slack-notifications";

const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(p: string) { return basePath && p.startsWith(basePath) ? p.slice(basePath.length) || "/" : p; }

async function apiFetch(path: string, token: string | null, options?: RequestInit) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(`/api${path}`, { ...options, headers, signal: options?.signal ?? AbortSignal.timeout(60_000) });
  let json: { success: boolean; data: unknown; error: string | null } | null = null;
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "The server returned an unexpected response. Please try again." : `Server error (${res.status}). Please try again.`);
  }
  if (!res.ok || !json?.success) throw new Error(json?.error ?? `API error ${res.status}`);
  return json!.data;
}

import type {
  Role, Service, ServiceEvent, RiskEntry, GraphNode, GraphEdge,
  TimelineItem, RootCauseCandidate, RootCause, Prediction, AutoInsight,
} from "./types.js";
import { DemoScenarioPanel, SCENARIO_STEPS } from "./features/demo/ScenarioControls.js";
import { GraphView, computeLayout } from "./features/graph/DependencyGraph.js";

// ── Clerk ─────────────────────────────────────────────────────────────────────

if (!clerkPubKey && !isDevAuthBypass) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

const clerkAppearance = {
  baseTheme: dark, cssLayerName: "clerk",
  options: { logoPlacement: "inside" as const, logoLinkUrl: basePath || "/", logoImageUrl: `${window.location.origin}${basePath}/logo.svg`, socialButtonsPlacement: "top" as const, socialButtonsVariant: "blockButton" as const },
  variables: { colorPrimary: "#6366f1", colorForeground: "#f8fafc", colorMutedForeground: "#94a3b8", colorDanger: "#f87171", colorBackground: "#0f172a", colorInput: "#1e293b", colorInputForeground: "#f8fafc", colorNeutral: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif", borderRadius: "0.75rem" },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "!bg-slate-900 rounded-2xl w-[420px] max-w-full overflow-hidden border border-white/10 shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none", footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-bold", headerSubtitle: "text-slate-400",
    socialButtonsBlockButtonText: "text-white font-medium", formFieldLabel: "text-slate-300 text-xs font-medium",
    footerActionLink: "text-indigo-400 hover:text-indigo-300", footerActionText: "text-slate-500",
    dividerText: "text-slate-600 text-xs uppercase tracking-wider", identityPreviewEditButton: "text-indigo-400",
    formFieldSuccessText: "text-emerald-400", alertText: "text-red-300", logoBox: "flex justify-center", logoImage: "w-10 h-10",
    socialButtonsBlockButton: "!bg-white/5 !border !border-white/10 hover:!bg-white/10 !rounded-xl transition-all",
    formButtonPrimary: "!bg-indigo-600 hover:!bg-indigo-500 !rounded-xl font-semibold transition-all",
    formFieldInput: "!bg-slate-800 !border !border-white/10 !text-white !rounded-lg focus:!ring-2 focus:!ring-indigo-500/60",
    footerAction: "!bg-transparent", dividerLine: "!bg-white/8",
    alert: "!bg-red-500/10 !border !border-red-500/20 !rounded-xl",
    otpCodeFieldInput: "!bg-slate-800 !border !border-white/10 !text-white", formFieldRow: "gap-2", main: "gap-4",
  },
};

// Organization profiles contain a sidebar and tables; sign-in cards stay compact.
const organizationProfileAppearance = {
  elements: { cardBox: "!bg-slate-900 !w-[min(960px,calc(100vw-2rem))] !max-w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl" },
};

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={clerkAppearance} fallback={<AuthenticationLoading contained />} /></div>;
}
function SignUpPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={clerkAppearance} fallback={<AuthenticationLoading contained />} /></div>;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function useDarkMode(): [boolean, () => void] {
  const [d, setD] = useState(() => {
    try { return localStorage.getItem("ctx-theme") !== "light"; } catch { return true; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("ctx-theme", d ? "dark" : "light"); } catch {}
  }, [d]);
  return [d, () => setD(x => !x)];
}
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } } };
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };
function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`;
}
function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60), rm = m % 60;
  return `${h}h ${rm}m`;
}

// ── Shared components ─────────────────────────────────────────────────────────

function Card({ children, className = "", onClick, glow }: { children: React.ReactNode; className?: string; onClick?: () => void; glow?: string }) {
  return (
    <motion.div onClick={onClick} whileHover={onClick ? { y: -2, transition: { duration: 0.15 } } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      className={`rounded-2xl backdrop-blur-sm ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{ background: "var(--ctx-surface)", border: "1px solid var(--ctx-border)", ...(glow ? { boxShadow: `0 0 20px ${glow}22, 0 0 60px ${glow}08` } : {}) }}>
      {children}
    </motion.div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = { healthy: "#22c55e", at_risk: "#f59e0b", degraded: "#f97316", failing: "#ef4444" };
const STATUS_BG: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  at_risk: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  degraded: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  failing: "bg-red-500/10 text-red-400 border-red-500/20",
};
const SEVERITY_BG: Record<string, string> = {
  info: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};
function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_BG[status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] ?? "#64748b" }} />{status.replace("_", " ")}</span>;
}
function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${SEVERITY_BG[severity] ?? SEVERITY_BG.info}`}>{severity}</span>;
}
const SERVICE_ICONS: Record<string, React.ElementType> = { checkout: Package, payments: Database, database: Database, auth: Shield, notification: Radio, default: Server };
function serviceIcon(name: string): React.ElementType {
  const k = name.toLowerCase();
  for (const [kw, v] of Object.entries(SERVICE_ICONS)) if (k.includes(kw)) return v;
  return SERVICE_ICONS.default;
}

// ── Root Cause Panel ──────────────────────────────────────────────────────────

function RootCausePanel({ rootCause, role, onAction, services }: { rootCause: RootCause; role: Role; onAction: (action: string, svcName: string) => void; services: Service[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const confidence = Math.round(rootCause.confidence * 100);
  const failingSvc = services.find(s => rootCause.cascadePath[0] && s.name === rootCause.cascadePath[0]);

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] overflow-hidden"
      style={{ boxShadow: "0 0 30px #ef444415, 0 0 80px #ef444406" }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-label="Toggle root cause investigation details"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCollapsed(!collapsed); } }}
        onClick={() => setCollapsed(!collapsed)}
        className="px-5 py-4 flex items-start justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded-xl"
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Siren size={16} className="text-red-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">🔥 Root Cause</span>
              <span className="inline-flex items-center rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-300">{confidence}% confidence</span>
              {rootCause.llmEnriched && (
                <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                  <Bot size={9} aria-hidden="true" />AI‑reasoned
                </span>
              )}
              {rootCause.incidentMinutes > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/8 px-2 py-0.5 text-xs font-semibold text-amber-300">
                  <Timer size={9} />{rootCause.incidentMinutes}m elapsed
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white leading-snug">{rootCause.cause}</p>
            {role === "manager" && (
              <p className="text-sm text-red-300/70 mt-1">📉 Revenue impact: <span className="font-semibold text-red-300">{rootCause.estimatedLoss}</span></p>
            )}
          </div>
        </div>
        <button type="button" tabIndex={-1} aria-label={collapsed ? "Expand details" : "Collapse details"} className="text-slate-600 hover:text-slate-300 flex-shrink-0 mt-1">
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4 border-t border-red-500/10 pt-4">
              {/* Cascade chain */}
              {rootCause.cascadePath.length > 1 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">🔗 Failure cascade</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {rootCause.cascadePath.map((name, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        <span className={`px-2.5 py-1 rounded-lg text-sm font-medium border ${i === 0 ? "bg-red-500/15 border-red-500/25 text-red-600 dark:text-red-300" : "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"}`}>{name}</span>
                        {i < rootCause.cascadePath.length - 1 && <ArrowRight size={12} className="text-slate-600" />}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Impacted services */}
                {rootCause.impactedServices.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">📉 Impacted services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {rootCause.impactedServices.map((s, i) => (
                        <span key={`${s}-${i}`} className="px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-sm text-orange-300">{s}</span>
                      ))}
                    </div>
                    {role === "manager" && (
                      <p className="text-sm text-slate-500 mt-2">Estimated loss: <span className="text-amber-400 font-semibold">{rootCause.estimatedLoss}</span></p>
                    )}
                  </div>
                )}

                {/* LLM reasoning chain */}
                {rootCause.reasoning && rootCause.reasoning.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      <ListChecks size={10} className="inline mr-1 text-indigo-400" />AI reasoning chain
                    </p>
                    <ol className="space-y-1.5">
                      {rootCause.reasoning.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-400 leading-relaxed">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Confidence bar */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">AI confidence</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${confidence}%` }} transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400" />
                    </div>
                    <span className="text-sm font-bold text-white w-10 text-right">{confidence}%</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {role === "engineer" && rootCause.suggestedFixes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">🛠 Suggested actions</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {rootCause.suggestedFixes.slice(0, 3).map((fix, i) => {
                      const isRollback = fix.toLowerCase().includes("roll");
                      const isThrottle = fix.toLowerCase().includes("throttle");
                      const Icon = isRollback ? RotateCcw : isThrottle ? Pause : Wrench;
                      const action = isRollback ? "rollback" : isThrottle ? "throttle" : "restart";
                      const svcName = rootCause.cascadePath[0] ?? "";
                      return (
                        <button key={i} onClick={() => onAction(action, svcName)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${i === 0 ? "bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white" : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300"}`}>
                          <Icon size={11} />{fix}
                        </button>
                      );
                    })}
                  </div>
                  {/* Engineer-specific fix commands */}
                  <div className="ctx-terminal rounded-lg border px-3 py-2.5" style={{ background: "#1e293b", borderColor: "var(--ctx-border)" }}>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">Quick fix commands</p>
                    <div className="space-y-1.5">
                      {(() => {
                        const targetSvc = (rootCause.cascadePath[0] ?? "service").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") || "service";
                        return [
                          { label: "Rollback deployment", cmd: `kubectl rollout undo deployment/${targetSvc}` },
                          { label: "Restart service", cmd: `kubectl rollout restart deployment/${targetSvc}` },
                          { label: "Check logs", cmd: `kubectl logs -l app=${targetSvc} --tail=50` },
                        ];
                      })().map(({ label, cmd }, i) => (
                        <div key={i} className="flex items-start justify-between gap-2">
                          <code className="text-xs text-emerald-400 font-mono flex-1 leading-relaxed">{cmd}</code>
                          <button onClick={() => navigator.clipboard?.writeText(cmd).catch(() => {})} className="flex-shrink-0 p-1 text-slate-700 hover:text-slate-400 transition-colors" aria-label={`Copy ${label} command`} title={`Copy: ${label}`}><Copy size={10} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {role === "sre" && rootCause.suggestedFixes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">🛠 Suggested actions</p>
                  <div className="flex flex-wrap gap-2">
                    {rootCause.suggestedFixes.slice(0, 3).map((fix, i) => {
                      const isRollback = fix.toLowerCase().includes("roll");
                      const isThrottle = fix.toLowerCase().includes("throttle");
                      const Icon = isRollback ? RotateCcw : isThrottle ? Pause : Wrench;
                      const action = isRollback ? "rollback" : isThrottle ? "throttle" : "restart";
                      const svcName = rootCause.cascadePath[0] ?? "";
                      return (
                        <button key={i} onClick={() => onAction(action, svcName)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${i === 0 ? "bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white" : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300"}`}>
                          <Icon size={11} />{fix}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {role === "manager" && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-indigo-500/8 border border-indigo-500/15 px-4 py-3">
                    <p className="text-sm font-semibold text-indigo-300 mb-1.5">Executive Summary</p>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      <strong className="text-white">{rootCause.cascadePath[0]}</strong> is experiencing a critical failure that has cascaded to {rootCause.impactedServices.length} downstream service{rootCause.impactedServices.length !== 1 ? "s" : ""}{rootCause.incidentMinutes > 0 ? `, ongoing for ${rootCause.incidentMinutes} minutes` : ""}. Engineering is actively working on a resolution.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-red-500/8 border border-red-500/15 px-3 py-2 text-center">
                      <div className="text-sm font-bold text-white">{rootCause.impactedServices.length + 1}</div>
                      <div className="text-xs text-red-400 uppercase tracking-wide">Services down</div>
                    </div>
                    <div className="rounded-lg bg-amber-500/8 border border-amber-500/15 px-3 py-2 text-center">
                      <div className="text-sm font-bold text-white">{rootCause.incidentMinutes > 0 ? `${rootCause.incidentMinutes}m` : "—"}</div>
                      <div className="text-xs text-amber-400 uppercase tracking-wide">Elapsed</div>
                    </div>
                    <div className="rounded-lg bg-orange-500/8 border border-orange-500/15 px-3 py-2 text-center">
                      <div className="text-sm font-bold text-white truncate">{confidence}%</div>
                      <div className="text-xs text-orange-400 uppercase tracking-wide">AI confidence</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Alternative root-cause candidates */}
              {rootCause.candidates && rootCause.candidates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5 mb-px" />
                    Other candidates
                    <span className="ml-1.5 text-slate-600 normal-case tracking-normal font-normal">— ranked by probability</span>
                  </p>
                  <div className="space-y-1.5">
                    {rootCause.candidates.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/6 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-slate-300">{c.service}</span>
                            <span className="text-xs font-semibold text-slate-500">{c.confidence}%</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed truncate">{c.reasoning}</p>
                        </div>
                        <div className="flex-shrink-0 w-12">
                          <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                            <div className="h-full rounded-full bg-slate-600" style={{ width: `${c.confidence}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Prediction Panel ──────────────────────────────────────────────────────────

const RISK_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", label: "HIGH" },
  medium: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", label: "MED" },
  low: { bg: "bg-slate-500/10 border-slate-500/20", text: "text-slate-400", label: "LOW" },
};

function PredictionsPanel({ predictions }: { predictions: Prediction[] }) {
  if (!predictions.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown size={13} className="text-orange-400" />
        <h3 className="text-sm font-semibold text-white">⚠️ Likely Next Failures</h3>
        <span className="inline-flex items-center rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 text-xs font-medium">{predictions.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {predictions.map((p) => {
          const style = RISK_STYLE[p.riskLevel] ?? RISK_STYLE.low;
          return (
            <div key={p.serviceId} className={`rounded-xl border ${style.bg} px-4 py-3 flex items-center gap-3`}>
              <div className={`text-xs font-bold rounded-md px-1.5 py-0.5 border ${style.bg} ${style.text} flex-shrink-0`}>{style.label}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate">{p.service}</span>
                  <span className={`text-xs font-medium flex-shrink-0 ${style.text}`}>{p.timeToFailure}</span>
                </div>
                <p className="text-sm text-slate-500 truncate">{p.reason}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Demo Scenario Panel (extracted to features/demo/ScenarioControls.tsx) ───────

// ── Graph View (extracted to features/graph/DependencyGraph.tsx) ──────────────

// ── Timeline with phases ──────────────────────────────────────────────────────

function RiskCard({ risk: r, role, onAction }: { risk: RiskEntry; role: Role; onAction: (a: string, s: string) => void }) {
  const [exp, setExp] = useState(false);
  const Icon = serviceIcon(r.service.name);
  const color = STATUS_COLOR[r.service.status] ?? "#64748b";
  return (
    <div className="rounded-xl border border-white/8 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
            <Icon size={14} style={{ color }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-white">{r.service.name}</span>
              <StatusBadge status={r.service.status} />
            </div>
            {r.rootCause && <p className="text-sm text-slate-500">← depends on <span className="text-red-400">{r.rootCause.name}</span></p>}
            <div className="flex items-center gap-1.5 mt-1">
              {r.service.criticality && (
                <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-bold uppercase ${r.service.criticality === "high" ? "bg-red-500/10 border-red-500/20 text-red-400" : r.service.criticality === "medium" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-slate-500/10 border-slate-500/20 text-slate-400"}`}>{r.service.criticality}</span>
              )}
              {r.service.ownerTeam && (
                <span className="text-xs text-slate-600">👤 {r.service.ownerTeam}</span>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => setExp(!exp)} aria-label={`${exp ? "Hide" : "Show"} risk details for ${r.service.name}`} aria-expanded={exp} className="text-slate-600 hover:text-slate-300 flex-shrink-0">
          <ChevronDown size={14} className={`transition-transform ${exp ? "rotate-180" : ""}`} />
        </button>
      </div>
      <AnimatePresence>
        {exp && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 pt-3 border-t border-white/6 space-y-2">
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/10 px-3 py-2">
                <Zap size={11} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-300 leading-relaxed">{r.reasoning}</p>
              </div>
              {r.recentEvent && (
                <div className="rounded-lg bg-white/3 px-3 py-2 flex items-start gap-2">
                  <AlertCircle size={11} className="text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-300 font-medium">{r.recentEvent.title}</p>
                    {r.recentEvent.description && <p className="text-xs text-slate-600 mt-0.5">{r.recentEvent.description}</p>}
                  </div>
                </div>
              )}
              {(role === "engineer" || role === "sre") && (
                <div className="flex gap-2 flex-wrap pt-1">
                  {["rollback", "throttle", "restart"].map(a => (
                    <button key={a} onClick={() => onAction(a, r.service.name)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors capitalize">
                      <Wrench size={10} />{a}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

// ── Copy Button ───────────────────────────────────────────────────────────────
function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (reset.current) clearTimeout(reset.current); }, []);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setError(false); }
        catch { setCopied(false); setError(true); }
        if (reset.current) clearTimeout(reset.current);
        reset.current = setTimeout(() => { setCopied(false); setError(false); }, 1800);
      }}
      title={error ? "Copy failed; select the text and copy it manually" : copied ? "Copied" : "Copy to clipboard"}
      className={`flex-shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${copied ? "text-emerald-600" : ""} ${className}`}
      style={copied ? undefined : { color: "var(--ctx-text-2)" }}
    >
      {error ? <AlertCircle size={14} /> : copied ? <Check size={14} /> : <Copy size={14} />}
      <span className="sr-only" aria-live="polite">{error ? "Copy failed" : copied ? "Copied" : "Copy to clipboard"}</span>
    </button>
  );
}

function OverviewTab({ risks, services, rootCause, predictions, loading, role, onAction, userId, feed, onNavigate }: {
  risks: RiskEntry[]; services: Service[]; rootCause: RootCause | null; predictions: Prediction[];
  loading: boolean; role: Role; onAction: (a: string, s: string) => void; userId?: string;
  feed: TimelineItem[]; onNavigate: (tab: "timeline" | "graph" | "ai") => void;
}) {
  const [onlyAffected, setOnlyAffected] = useState(false);
  const affected = services.filter(service => service.status !== "healthy");
  const priority: Record<string, number> = { failing: 0, degraded: 1, at_risk: 2, healthy: 3 };
  const visibleServices = [...(onlyAffected ? affected : services)].sort((a, b) => priority[a.status] - priority[b.status] || a.name.localeCompare(b.name));
  const recent = chronological(feed).slice(-3).reverse();
  if (loading) return <p className="ctx-empty" role="status">Loading workspace health…</p>;
  return <div className="ctx-overview">
    <div className="ctx-page-heading"><h2>Workspace overview</h2><p>Current health, services that need attention, and the latest recorded activity.</p></div>
    <section className={`ctx-panel ctx-health-brief ${affected.length ? "has-alerts" : ""}`}>
      <div className="ctx-health-message"><span className={`ctx-health-icon ctx-status-${affected.length ? "warning" : "healthy"}`}>{affected.length ? <AlertTriangle size={25} aria-hidden="true" /> : <CheckCircle2 size={25} aria-hidden="true" />}</span><div><h3>{!services.length ? "Waiting for service data" : affected.length ? `${affected.length} service${affected.length === 1 ? " needs" : "s need"} attention` : "All recorded services are healthy"}</h3><p>{services.length ? `${services.length - affected.length} of ${services.length} services healthy` : "Connect an alert source or ask an admin to run a demo."}{affected.length ? ` · ${affected.map(service => service.name).join(", ")}` : ""}</p>{rootCause && affected.length > 0 && <p className="ctx-health-analysis"><strong>Latest analysis:</strong> {rootCause.cause}</p>}</div></div>
      <button className="ctx-primary-button" onClick={() => onNavigate(affected.length ? "ai" : "timeline")}>{affected.length ? "Investigate with AI" : "Review activity"}<ArrowRight size={17} aria-hidden="true" /></button>
    </section>
    <div className="ctx-overview-grid">
      <section className="ctx-panel ctx-service-inventory"><div className="ctx-section-heading"><div><h3>Service health</h3><p>Recorded status and ownership, ordered by attention needed.</p></div><button className="ctx-secondary-button" onClick={() => onNavigate("graph")}>Explore dependencies</button></div>
        <div className="ctx-inventory-filter"><button className={!onlyAffected ? "is-selected" : ""} aria-pressed={!onlyAffected} onClick={() => setOnlyAffected(false)}>All services <span>{services.length}</span></button><button className={onlyAffected ? "is-selected" : ""} aria-pressed={onlyAffected} onClick={() => setOnlyAffected(true)}>Needs attention <span>{affected.length}</span></button></div>
        <div className="ctx-service-table" role="table" aria-label="Service health and ownership"><div className="ctx-service-row ctx-service-table-head" role="row"><span role="columnheader">Service</span><span role="columnheader">Health</span><span role="columnheader">Owner / priority</span></div>
          {visibleServices.map(service => { const Icon = serviceIcon(service.name); return <div key={service.id} className="ctx-service-row" role="row"><div role="cell" className="ctx-service-name"><Icon size={18} className="ctx-muted" aria-hidden="true" /><div><strong>{service.name}</strong>{service.description && <p>{service.description}</p>}</div></div><div role="cell"><span className={`ctx-badge ctx-status-${service.status}`}>{service.status.replace(/_/g, " ")}</span></div><div role="cell" className="ctx-service-owner"><strong>{service.ownerTeam || "Owner not provided"}</strong><span>{service.criticality} priority</span></div></div>; })}
        </div>{!visibleServices.length && <div className="ctx-empty"><p>{onlyAffected ? "No services currently need attention." : "No services recorded yet."}</p></div>}
      </section>
      <aside className="ctx-overview-aside"><section className="ctx-panel ctx-recent-activity"><div className="ctx-section-heading"><h3>Latest activity</h3><Clock size={18} className="ctx-muted" aria-hidden="true" /></div>{recent.length ? <ol>{recent.map(item => <li key={`${item.kind}:${item.id}`}><span className={`ctx-category ctx-tone-${categoryOf(item)}`}>{CATEGORY_META[categoryOf(item)].label}</span><p>{recordTitle(item)}</p><span className="ctx-muted">{item.serviceName || "Team update"}</span><time dateTime={item.createdAt}>{timeLabel(item.createdAt, true)}</time></li>)}</ol> : <p className="ctx-muted">No activity recorded yet.</p>}<button className="ctx-secondary-button" onClick={() => onNavigate("timeline")}>Open full timeline<ArrowRight size={16} aria-hidden="true" /></button></section>
      <section className="ctx-panel ctx-investigation-guide"><h3>A path through an incident</h3><ol><li><strong>Check the sequence</strong><p>Find the earliest alert and nearby changes in Timeline.</p></li><li><strong>Trace dependencies</strong><p>Use Graph to see which services rely on the affected service.</p></li><li><strong>Review the evidence</strong><p>Ask AI to explain the records and possible next steps.</p></li></ol></section></aside>
    </div>
    {(risks.length > 0 || predictions.length > 0 || (rootCause && affected.length > 0)) && <details className="ctx-panel ctx-overview-diagnostics"><summary><div><strong>Investigation details</strong><span>{risks.length} active risk records · {predictions.length} predictions</span></div><ChevronDown size={18} aria-hidden="true" /></summary><div>{rootCause && <RootCausePanel rootCause={rootCause} role={role} onAction={onAction} services={services} />}{predictions.length > 0 && <PredictionsPanel predictions={predictions} />}{risks.map(risk => <RiskCard key={risk.service.id} risk={risk} role={role} onAction={onAction} />)}</div></details>}
    <details className="ctx-panel ctx-connections-setup"><summary><div><strong>Connections & ingestion</strong><span>Supported sources, webhook keys and setup instructions</span></div><ChevronDown size={18} aria-hidden="true" /></summary><div><IntegrationsPanel userId={userId} /></div></details>
  </div>;
}

const LIVE_INTEGRATIONS = [
  { name: "GitHub Actions", desc: "Deployment evidence from workflows", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: Package },
  { name: "Generic Webhook", desc: "Any JSON alerting tool", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: Webhook },
  { name: "PagerDuty V3", desc: "Incident trigger / resolve", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: Siren },
  { name: "Slack Alerts", desc: "Outbound incident notifications", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: MessageSquare },
];

const COMING_SOON = [
  { name: "Datadog", desc: "Metrics and monitor alerts", icon: Activity },
  { name: "Grafana", desc: "Dashboard and alert context", icon: BarChart3 },
  { name: "OpsGenie", desc: "Incident sync and escalation", icon: Siren },
  { name: "AWS CloudWatch", desc: "Native AWS alarm ingestion", icon: Server },
  { name: "New Relic", desc: "APM traces and error rates", icon: TrendingUp },
];

function IntegrationsPanel({ userId }: { userId?: string }) {

  const genericUrl = `${window.location.origin}/api/ingest/webhook`;
  const pagerdutyUrl = `${window.location.origin}/api/ingest/webhook/pagerduty`;
  const payload = `{ "service": "payments-api", "title": "p99 > 8s", "severity": "critical", "status": "failing" }`;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--ctx-border)", background: "var(--ctx-surface)" }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--ctx-border)" }}>
        <Webhook size={13} className="text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">Integrations</h3>
        <span className="ml-auto text-xs font-semibold rounded-full px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          {LIVE_INTEGRATIONS.length} supported · {COMING_SOON.length} coming
        </span>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Live */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-2.5">Supported sources</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {LIVE_INTEGRATIONS.map(({ name, desc, color, bg, icon: Icon }) => (
              <div key={name} className={`rounded-xl border px-3 py-2.5 flex items-start gap-2.5 ${bg}`}>
                <Icon size={13} className={`${color} mt-0.5 flex-shrink-0`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white leading-none mb-0.5">{name}</p>
                  <p className="text-xs text-slate-500 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <WebhookKeySettings />

          {/* Webhook endpoints */}
          <div className="mt-2.5 space-y-2">
            {[
              { label: "Generic webhook", url: genericUrl },
              { label: "PagerDuty V3", url: pagerdutyUrl },
              { label: "GitHub Actions deployments", url: `${window.location.origin}/api/ingest/github-actions` },
            ].map(({ label, url }) => (
              <div key={label} className="rounded-lg border px-3 py-2.5" style={{ background: "var(--ctx-surface)", borderColor: "var(--ctx-border)" }}>
                <p className="text-sm font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--ctx-text-2)" }}>{label}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 flex-shrink-0">POST</span>
                  <code className="text-sm font-mono flex-1 min-w-0 truncate" style={{ color: "var(--ctx-text-2)" }}>{url}</code>
                  <CopyButton text={url} />
                </div>
              </div>
            ))}
            <div className="rounded-lg border px-3 py-2.5" style={{ background: "var(--ctx-surface)", borderColor: "var(--ctx-border)" }}>
              <p className="text-sm font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--ctx-text-2)" }}>Example payload</p>
              <div className="flex items-start gap-1.5">
                <pre className="text-sm font-mono leading-relaxed flex-1 whitespace-pre-wrap" style={{ color: "var(--ctx-text-2)" }}>{payload}</pre>
                <CopyButton text={payload} className="mt-0.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Coming soon */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-600 mb-2.5">Coming soon</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {COMING_SOON.map(({ name, desc, icon: Icon }) => (
              <div key={name}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 flex items-start gap-2.5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Icon size={13} className="text-slate-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-slate-400">{name}</p>
                    <span className="text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      Planned
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-slate-400">Planned connectors have no scheduled release date. You can send supported alerts through the generic webhook today.</p>
      </div>
    </div>
  );
}

// ── Role Selector ─────────────────────────────────────────────────────────────

const ROLES: { id: Role; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "engineer", label: "Engineer", icon: Terminal, desc: "Logs, fixes, technical detail" },
  { id: "sre", label: "SRE", icon: Activity, desc: "Full picture, blast radius, MTTR" },
  { id: "manager", label: "Manager", icon: BarChart3, desc: "Revenue impact, ETA, summary" },
];

function RoleSelector({ role, onChange }: { role: Role; onChange: (r: Role) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = ROLES.find(r => r.id === role)!;
  return (
    <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
      <button ref={trigger} onClick={() => setOpen(!open)} aria-label={`${current.label} view`} aria-expanded={open}
        className="ctx-header-button flex items-center gap-2 rounded-xl border px-3 text-sm transition-colors">
        <current.icon size={11} />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown size={11} className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="ctx-dropdown absolute left-0 top-full mt-2 z-50 w-52 rounded-xl overflow-hidden" style={{ border: "1px solid var(--ctx-border)", background: "var(--ctx-bg)", boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}>
            {ROLES.map(r => (
              <button key={r.id} onClick={() => { onChange(r.id); setOpen(false); trigger.current?.focus(); }}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${r.id === role ? "bg-indigo-500/8" : ""}`}>
                <r.icon size={13} className={r.id === role ? "text-indigo-400" : "text-slate-500"} />
                <div>
                  <p className={`text-sm font-semibold ${r.id === role ? "text-indigo-400" : "text-white"}`}>{r.label}</p>
                  <p className="text-xs text-slate-500">{r.desc}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Incident History Tab ──────────────────────────────────────────────────────

type Tab = "overview" | "graph" | "timeline" | "ai" | "history";

function Dashboard({ onBack }: { onBack: () => void }) {
  const { user } = useUser();
  const { getToken, orgId, orgRole } = useAuth();
  const canManageWorkspace = !orgId || orgRole === "org:admin";
  const [isDark, toggleDark] = useDarkMode();
  const [tab, setTab] = useState<Tab>("overview");
  const [role, setRole] = useState<Role>("sre");
  const [isLive, setIsLive] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [greetingMsg, setGreetingMsg] = useState<string | null>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [showSlackSettings, setShowSlackSettings] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(() => user
    ? readSlackWebhook(() => window.localStorage, user.id, orgId) : "");

  const [risks, setRisks] = useState<RiskEntry[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [rootCause, setRootCause] = useState<RootCause | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [graphNodes, setGraphNodes] = useState<GraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetching = useRef(false);
  const [incidentElapsed, setIncidentElapsed] = useState(0);
  const [postmortemLoading, setPostmortemLoading] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // ── Greeting toast on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const name = user.firstName || user.fullName?.split(" ")[0] || "there";
    const createdMs = user.createdAt ? new Date(user.createdAt).getTime() : 0;
    const isNew = Date.now() - createdMs < 90_000; // signed up within the last 90s
    setGreetingMsg(isNew ? `Hello, ${name}!` : `Welcome back, ${name}!`);
    const t = setTimeout(() => setGreetingMsg(null), 4500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const slackGeneration = useRef(0);
  useEffect(() => () => { slackGeneration.current++; }, [user?.id, orgId, orgRole]);

  // ── Slack + in-app notification on new incident ────────────────────────────
  const hasIncidentRef = useRef(false);
  useEffect(() => {
    const nowHas = services.some(s => s.status !== "healthy");
    if (nowHas && !hasIncidentRef.current) {
      // bump unread badge
      setNotifCount(c => c + 1);
      // fire Slack if configured
      if (slackWebhookUrl && canManageWorkspace) {
        const affected = services.filter(s => s.status !== "healthy").map(s => s.name).join(", ");
        const started = slackGeneration.current;
        void sendWorkspaceSlack(slackWebhookUrl,
          `🚨 *Context — New Incident Detected*\n${affected} are failing or degraded. Open the dashboard to investigate.`,
          getToken, () => mounted.current && slackGeneration.current === started, apiFetch).catch(() => {});
      }
    }
    hasIncidentRef.current = nowHas;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  const incidentStartedAt = rootCause?.incidentStartedAt ?? null;
  useEffect(() => {
    if (!incidentStartedAt) { setIncidentElapsed(0); return; }
    const update = () => setIncidentElapsed(Math.floor((Date.now() - new Date(incidentStartedAt).getTime()) / 1000));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [incidentStartedAt]);

  const fetchAll = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setRefreshing(true);
    try {
      const token = await getToken();
      const [summary, rc] = await Promise.allSettled([
        apiFetch("/insights/summary?limit=50", token),
        apiFetch("/insights/root-cause", token),
      ]);
      if (summary.status === "fulfilled") {
        const d = summary.value as { risks?: RiskEntry[]; services?: Service[]; predictions?: Prediction[]; graph?: { nodes?: GraphNode[]; edges?: GraphEdge[] }; timeline?: TimelineItem[] };
        setRisks(d.risks ?? []);
        setServices(d.services ?? []);
        setPredictions(d.predictions ?? []);
        setGraphNodes(d.graph?.nodes ?? []);
        setGraphEdges(d.graph?.edges ?? []);
        setTimeline(d.timeline ?? []);
      }
      if (rc.status === "fulfilled") setRootCause(rc.value as RootCause | null);
      const failed = [summary, rc].find((result) => result.status === "rejected");
      setFetchError(failed?.status === "rejected" ? "Live data could not be refreshed. Previously loaded data may be stale." : null);
    } catch {
      setFetchError("Live data could not be refreshed. Please retry.");
    }
    fetching.current = false;
    setLoading(false);
    setRefreshing(false);
  }, [getToken]);

  useEffect(() => { fetchAll(); }, [fetchAll, lastRefresh]);

  // Auto-poll every 15s when LIVE and document is visible
  useEffect(() => {
    if (!isLive) return;
    const poll = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        fetchAll();
      }
    };
    const t = setInterval(poll, 15000);
    return () => clearInterval(t);
  }, [isLive, fetchAll]);

  const handleScenarioStep = useCallback(async (step: number) => {
    try {
      const token = await getToken();
      if (!mounted.current) throw new Error("Workspace changed. Start the scenario in the current workspace.");
      if (step === 0) {
        await apiFetch("/demo/reset", token, { method: "POST" });
        setTab("overview");
      }
      await apiFetch("/demo/advance", token, { method: "POST", body: JSON.stringify({ step }) });
      setLastRefresh(n => n + 1);
    } catch (error) {
      if (mounted.current) setActionFeedback(error instanceof Error ? error.message : "The demo step failed. Please retry.");
      throw error;
    }
  }, [getToken]);

  const handleAction = useCallback(async (action: string, svcName: string) => {
    try {
      const token = await getToken();
      const svc = services.find(s => s.name === svcName);
      if (!svc) return;
      await apiFetch("/insights/simulate-action", token, { method: "POST", body: JSON.stringify({ action, serviceId: svc.id }) });
      setActionFeedback(`${action} preview: ${svcName} could recover. Live telemetry is unchanged; verify recovery after executing the command.`);
      setTimeout(() => { setActionFeedback(null); setLastRefresh(n => n + 1); }, 8000);
    } catch (error) { setActionFeedback(error instanceof Error ? error.message : "The simulation preview failed. Please retry."); }
  }, [getToken, services]);

  const handleExportPostmortem = useCallback(async () => {
    if (postmortemLoading) return;
    setPostmortemLoading(true);
    try {
      const token = await getToken();
      const data = await apiFetch("/insights/postmortem", token, { method: "POST" }) as { markdown: string };
      if (!mounted.current) return;
      const blob = new Blob([data.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `postmortem-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setActionFeedback("✓ Post-mortem downloaded");
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (error) {
      setActionFeedback(error instanceof Error ? `${error.message}. Please retry.` : "Could not generate the post-mortem. Please retry.");
      setTimeout(() => setActionFeedback(null), 3000);
    }
    setPostmortemLoading(false);
  }, [getToken, postmortemLoading]);

  const hasIncident = services.some(s => s.status !== "healthy");

  const TABS: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "overview", label: "Overview", icon: Activity, count: risks.length || undefined },
    { id: "graph", label: "Graph", icon: Network },
    { id: "timeline", label: "Timeline", icon: Clock, count: timeline.length || undefined },
    { id: "ai", label: "AI", icon: Bot },
    { id: "history", label: "History", icon: ListChecks },
  ];

  return (
    <div className="ctx-dashboard min-h-screen" style={{ background: "var(--ctx-bg)", color: "var(--ctx-text)" }}>
      <a href="#dashboard-content" className="ctx-skip-link">Skip to dashboard content</a>
      {/* Greeting toast */}
      <AnimatePresence>
        {greetingMsg && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
                       rounded-2xl border border-indigo-500/25 bg-[#0f1629]/90 backdrop-blur-md
                       px-5 py-3 shadow-[0_8px_32px_rgba(99,102,241,0.18)]"
          >
            <motion.div
              className="w-7 h-7 flex items-center justify-center flex-shrink-0"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <ContextMark decorative className="w-7 h-7" />
            </motion.div>
            <span className="text-sm font-semibold text-white">{greetingMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action feedback toast */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-emerald-500/20 bg-emerald-500/10 backdrop-blur-sm px-5 py-3 text-sm font-medium text-emerald-400 shadow-xl">
            {actionFeedback}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-30 backdrop-blur-md" style={{ borderBottom: "1px solid var(--ctx-border)", background: "var(--ctx-bg-alpha)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="flex items-center justify-between md:justify-start gap-3 min-w-0 w-full md:w-auto">
            <ContextLogo compact />
            {!isDevAuthBypass ? <OrganizationSwitcher appearance={{ variables: { colorForeground: isDark ? "#f8fafc" : "#17243b", colorMutedForeground: isDark ? "#b6c2d4" : "#475569", colorBackground: isDark ? "#101a2f" : "#ffffff", colorInput: isDark ? "#1e293b" : "#eef2f7", colorInputForeground: isDark ? "#f8fafc" : "#17243b", colorNeutral: isDark ? "#e2e8f0" : "#17243b" }, elements: { organizationSwitcherTrigger: "ctx-organization-trigger min-h-11 min-w-11 max-w-[220px] rounded-xl text-sm", organizationSwitcherTriggerIcon: "text-indigo-400" } }}
              organizationProfileProps={{ appearance: { ...organizationProfileAppearance, baseTheme: isDark ? dark : undefined, variables: { colorForeground: isDark ? "#f8fafc" : "#17243b", colorBackground: isDark ? "#101a2f" : "#ffffff", colorInputForeground: isDark ? "#f8fafc" : "#17243b" }, elements: { cardBox: "ctx-organization-profile !w-[min(960px,calc(100vw-2rem))] !max-w-full rounded-2xl overflow-hidden border shadow-2xl" } } }} /> : <span className="ctx-muted text-sm">Personal workspace</span>}
          </div>
          <div className="flex items-center justify-between md:justify-start gap-2 w-full md:w-auto" aria-label="Workspace controls">
            <RoleSelector role={role} onChange={setRole} />
            <button onClick={() => setIsLive(value => !value)} aria-pressed={isLive}
              aria-label={isLive ? "Disable live telemetry streaming" : "Enable live telemetry streaming"}
              title={isLive ? "Pause live updates" : "Enable live updates"}
              className="ctx-header-button" data-active={isLive}>
              <Radio size={18} aria-hidden="true" />
            </button>
            <button onClick={fetchAll} disabled={refreshing} aria-label="Refresh telemetry and incidents" title="Refresh telemetry" className="ctx-header-button">
              <RefreshCw size={18} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
            </button>
            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs(n => !n); setNotifCount(0); }}
                aria-label="View notifications" aria-expanded={showNotifs}
                className="ctx-header-button relative"
                title="Notifications"
              >
                <Siren size={18} aria-hidden="true" />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-xs font-bold text-white flex items-center justify-center leading-none">
                    {notifCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {showNotifs && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="ctx-popover fixed right-4 top-28 md:absolute md:right-0 md:top-full md:mt-2 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border shadow-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">Notifications</span>
                      <button onClick={() => setShowNotifs(false)} aria-label="Close notifications" className="p-2 min-w-11 min-h-11 flex items-center justify-center rounded hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                        <X size={12} className="text-slate-400 hover:text-white" />
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {timeline.filter(t => t.severity === "critical").slice(0, 10).map(t => (
                        <div key={t.id} className="px-4 py-2.5 border-b border-white/5 last:border-0 flex items-start gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/80 leading-snug truncate">{t.title ?? t.content}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{t.serviceName} · {new Date(t.createdAt).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      ))}
                      {timeline.filter(t => t.severity === "critical").length === 0 && (
                        <p className="px-4 py-4 text-sm text-slate-600 text-center">No critical alerts</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <WorkspaceActions>
              <button onClick={toggleDark} className="ctx-action-item">
                {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                {isDark ? "Switch to light mode" : "Switch to dark mode"}
              </button>
              <button onClick={() => setShowSlackSettings(true)} disabled={!canManageWorkspace} className="ctx-action-item"
                title={canManageWorkspace ? "Configure Slack notifications" : "An organization admin manages Slack notifications"}>
                <MessageSquare size={18} aria-hidden="true" />Slack notifications
              </button>
              <button onClick={handleExportPostmortem} disabled={postmortemLoading} className="ctx-action-item">
                <FileText size={18} aria-hidden="true" />{postmortemLoading ? "Generating report…" : "Export post-mortem"}
              </button>
              <button onClick={() => { setShowDemo(value => !value); setIsLive(true); }} disabled={!canManageWorkspace} className="ctx-action-item"
                title={canManageWorkspace ? "Run the demo scenario" : "An organization admin can run a shared demo"}>
                <Play size={18} aria-hidden="true" />{showDemo ? "Hide demo controls" : "Run demo"}
              </button>
              <div className="ctx-muted px-3 pt-3 mt-1 border-t text-sm" style={{ borderColor: "var(--ctx-border)" }}>Signed in as {user?.firstName || "a Context user"}</div>
              <button onClick={onBack} className="ctx-action-item"><Users size={18} aria-hidden="true" />Sign out</button>
            </WorkspaceActions>
          </div>
        </div>

        <nav aria-label="Dashboard views" style={{ borderTop: "1px solid var(--ctx-border)" }}>
          <div role="tablist" aria-label="Dashboard sections" className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-0.5 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onKeyDown={event => {
                  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
                  const index = TABS.findIndex(item => item.id === id);
                  const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : null;
                  if (next === null) return;
                  event.preventDefault(); setTab(TABS[next].id);
                  document.getElementById(`tab-${TABS[next].id}`)?.focus();
                }}
                onClick={() => setTab(id)}
                className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${tab === id ? "text-white border-b-2 border-indigo-500" : "text-slate-500 hover:text-slate-300 border-b-2 border-transparent"}`}>
                <Icon size={12} />{label}
                {count !== undefined && count > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${id === "overview" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-slate-400"}`}>{count}</span>
                )}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Incident status banner */}
      <AnimatePresence>
        {hasIncident && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="border-b border-red-500/10 bg-red-500/4 overflow-hidden">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-1.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                  <motion.span className="w-1.5 h-1.5 rounded-full bg-red-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                  Active Incident
                </span>
                {incidentElapsed > 0 && (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Timer size={10} />
                    <span className="font-mono">{formatDuration(incidentElapsed)}</span>
                  </span>
                )}
                <span className="text-slate-600 hidden sm:block">
                  {services.filter(s => s.status !== "healthy").length} service{services.filter(s => s.status !== "healthy").length !== 1 ? "s" : ""} affected
                </span>
              </div>
              {rootCause && (
                <span className="text-xs text-slate-600 hidden sm:block truncate max-w-[220px]">{rootCause.estimatedLoss}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="dashboard-content" tabIndex={-1} className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <h1 className="sr-only">Context workspace dashboard</h1>
        {fetchError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm">{fetchError}</p>
          <button onClick={() => void fetchAll()} disabled={refreshing} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50">Retry refresh</button>
        </div>}
        {/* Demo panel */}
        <AnimatePresence>
          {showDemo && (
            <DemoScenarioPanel onClose={() => setShowDemo(false)} onStepComplete={handleScenarioStep} />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "overview" && (
              <OverviewTab risks={risks} services={services} rootCause={rootCause} predictions={predictions} loading={loading} role={role} onAction={handleAction} userId={user?.id} feed={timeline} onNavigate={setTab} />
            )}
            {tab === "graph" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">Service Dependency Graph</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Trace which services use each other, then select a service to inspect its connections.</p>
                  </div>
                </div>
                <Card className="p-4 overflow-hidden">
                  <GraphView nodes={graphNodes} edges={graphEdges} predictions={predictions} />
                </Card>
                {graphNodes.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-4">
                    {[
                      { color: STATUS_COLOR.healthy, label: "Healthy" },
                      { color: STATUS_COLOR.failing, label: "Failing" },
                      { color: STATUS_COLOR.at_risk, label: "At Risk" },
                      { color: STATUS_COLOR.degraded, label: "Degraded" },
                      { color: "#f97316", label: "Predicted failure" },
                    ].map(({ color, label }) => (
                      <div key={label} className="flex items-center gap-1.5 text-sm text-slate-500">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />{label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === "timeline" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">Incident Timeline</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Follow recorded changes, alerts, responses and recovery in time order.</p>
                  </div>
                </div>
                <TimelineTab feed={timeline} loading={loading} />
              </div>
            )}
            {tab === "ai" && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-white">AI Incident Commander</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {role === "manager" ? "Business impact, ETAs, and plain-English summaries" : role === "engineer" ? "Detailed diagnostics, fix commands, and root cause tracing" : "Full system picture — blast radius, MTTR, and resolution paths"}
                    </p>
                  </div>
                </div>
                <AIAssistant role={role} request={apiFetch} />
              </div>
            )}
            {tab === "history" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">Incident History</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Review past activity windows and the evidence recorded within each one.</p>
                  </div>
                </div>
                <IncidentHistoryTab feed={timeline} loading={loading} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Slack settings modal */}
      <AnimatePresence>
        {showSlackSettings && (
          <SlackSettingsModal
            current={slackWebhookUrl}
            request={apiFetch}
            onClose={() => setShowSlackSettings(false)}
            onSave={url => {
              if (!user || !canManageWorkspace) return;
              const saved = saveSlackWebhook(() => window.localStorage, user.id, orgId, url);
              setSlackWebhookUrl(url);
              setActionFeedback(saved ? "✓ Slack webhook saved for this workspace" : "Slack webhook enabled for this session; browser storage is unavailable.");
              setTimeout(() => setActionFeedback(null), 3000);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Animated Hero Graph ───────────────────────────────────────────────────────

const HERO_NODES = [
  { id: "db", label: "Database", x: 80, y: 110 },
  { id: "pay", label: "Payments", x: 240, y: 65 },
  { id: "checkout", label: "Checkout", x: 400, y: 65 },
  { id: "auth", label: "Auth", x: 240, y: 160 },
];
const HERO_EDGES = [
  { from: "pay", to: "db" },
  { from: "checkout", to: "pay" },
  { from: "auth", to: "db" },
];
// phase 0=healthy, 1=db fails, 2=payments+auth fail, 3=checkout impacted, 4=root cause badge, 5=recovery
const HERO_PHASE_MS = [2200, 1400, 1400, 1400, 2800, 900];

function HeroGraph() {
  const [phase, setPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let p = 0;
    const advance = () => {
      p = (p + 1) % HERO_PHASE_MS.length;
      setPhase(p);
      timerRef.current = setTimeout(advance, HERO_PHASE_MS[p]);
    };
    timerRef.current = setTimeout(advance, HERO_PHASE_MS[0]);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const recovering = phase === 5;
  const nodeColor = (id: string) => {
    if (recovering || phase === 0) return "#22c55e";
    if (id === "db" && phase >= 1) return "#ef4444";
    if ((id === "pay" || id === "auth") && phase >= 2) return "#ef4444";
    if (id === "checkout" && phase >= 3) return "#f59e0b";
    return "#22c55e";
  };
  const edgeActive = (from: string, to: string) => {
    if (recovering || phase === 0) return false;
    if (from === "pay" && to === "db" && phase >= 2) return true;
    if (from === "auth" && to === "db" && phase >= 2) return true;
    if (from === "checkout" && to === "pay" && phase >= 3) return true;
    return false;
  };
  const isPulsing = (id: string) =>
    !recovering && ((id === "db" && phase >= 1) || ((id === "pay" || id === "auth") && phase >= 2));

  return (
    <div className="relative rounded-2xl border border-white/8 bg-slate-900/70 overflow-hidden">
      <style>{`
        @keyframes hero-flow { to { stroke-dashoffset: -18; } }
        .hero-active { animation: hero-flow 0.9s linear infinite; }
      `}</style>

      {/* Phase label */}
      <div className="absolute top-3 left-4 flex items-center gap-2">
        <motion.span className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: phase === 0 || recovering ? "#22c55e" : "#ef4444" }}
          animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {recovering ? "Recovering…" : phase === 0 ? "All systems nominal" : phase === 1 ? "Database failing" : phase === 2 ? "Failure propagating" : phase === 3 ? "Checkout impacted" : "Root cause found"}
        </span>
      </div>

      <svg viewBox="0 0 480 230" className="w-full" style={{ minHeight: 160 }}>
        {HERO_EDGES.map(e => {
          const a = HERO_NODES.find(n => n.id === e.from)!;
          const b = HERO_NODES.find(n => n.id === e.to)!;
          const active = edgeActive(e.from, e.to);
          return (
            <line key={`${e.from}-${e.to}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={active ? "#ef4444" : "#1e293b"}
              strokeWidth={active ? 2 : 1.5}
              strokeDasharray={active ? "9 4" : "4 4"}
              className={active ? "hero-active" : ""}
              style={{ transition: "stroke 0.6s" }} />
          );
        })}

        {HERO_NODES.map(n => {
          const c = nodeColor(n.id);
          const pulse = isPulsing(n.id);
          return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              {pulse && (
                <motion.circle r={28} fill={c} opacity={0.1}
                  animate={{ r: [22, 32, 22] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
              )}
              <circle r={22} fill="#0f172a" stroke={c} strokeWidth={2} style={{ transition: "stroke 0.6s" }} />
              <text y={5} textAnchor="middle" fill={c} fontSize={9} fontWeight="600" className="select-none" style={{ transition: "fill 0.6s" }}>{n.label}</text>
              <circle r={4.5} cx={15} cy={-15} fill={c} stroke="#0f172a" strokeWidth={1.5} style={{ transition: "fill 0.6s" }} />
            </g>
          );
        })}
      </svg>

      {/* Root cause badge */}
      <AnimatePresence>
        {phase === 4 && (
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
            className="absolute bottom-4 right-4 rounded-xl border border-red-500/25 bg-red-500/10 backdrop-blur-sm px-4 py-3 text-left"
            style={{ boxShadow: "0 0 24px #ef444420" }}>
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-0.5">🔥 Root cause identified</p>
            <p className="text-sm font-bold text-white">Database</p>
            <p className="text-xs text-slate-400 mt-0.5">Payments → Checkout cascade</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-red-500" style={{ width: "94%" }} />
              </div>
              <span className="text-xs text-red-400 font-semibold">94%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Propagation arrow hint */}
      <AnimatePresence>
        {phase >= 2 && phase <= 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute bottom-4 left-4 text-xs text-slate-600">
            Failure spreading → {phase >= 3 ? "Checkout affected" : "Payments affected"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────

const INTRO_DURATION = 31000; // ms — 5 scenes × 6s each + 1s buffer

function DemoIntro({ onSkip }: { onSkip: () => void }) {
  const [showSkip, setShowSkip] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const skipT = setTimeout(() => setShowSkip(true), 1800);
    const autoT = setTimeout(onSkip, INTRO_DURATION);
    const raf = { id: 0 };
    const tick = () => {
      setProgress(Math.min(100, ((performance.now() - start) / INTRO_DURATION) * 100));
      raf.id = requestAnimationFrame(tick);
    };
    raf.id = requestAnimationFrame(tick);
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onSkip(); };
    document.addEventListener("keydown", handler);
    return () => {
      clearTimeout(skipT);
      clearTimeout(autoT);
      cancelAnimationFrame(raf.id);
      document.removeEventListener("keydown", handler);
    };
  }, [onSkip]);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "#080c14" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ContextLogo dark />
        </div>
        <AnimatePresence>
          {showSkip && (
            <motion.button
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
              onClick={onSkip}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-all"
            >
              Skip <ChevronRight size={12} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Video — fills the rest */}
      <div className="flex-1 min-h-0">
        <DemoVideoInline />
      </div>

      {/* Progress bar — bottom of screen */}
      <div className="h-0.5 w-full bg-white/[0.06] flex-shrink-0">
        <div
          className="h-full bg-indigo-500/70 transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}

function Landing({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const [d, toggleDark] = useDarkMode();
  const [showIntro, setShowIntro] = useState(true);
  return (
    <div className="min-h-screen" style={{ background: "var(--ctx-bg)", color: "var(--ctx-text)" }}>
      <AnimatePresence>{showIntro && <DemoIntro onSkip={() => setShowIntro(false)} />}</AnimatePresence>
      <header className="fixed top-0 left-0 right-0 z-30 backdrop-blur-sm" style={{ borderBottom: "1px solid var(--ctx-border)", background: "var(--ctx-bg-alpha)" }}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ContextLogo compact />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleDark} aria-label={d ? "Switch to light mode" : "Switch to dark mode"} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              {d ? <Sun size={14} className="text-slate-500" /> : <Moon size={14} className="text-slate-500" />}
            </button>
            <button onClick={onSignIn} className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5">Sign in</button>
            <button onClick={onSignUp} className="text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97] text-white px-3.5 py-2 transition-all">Get started</button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto">
        <section className="pt-32 pb-16 px-6 text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/8 px-3.5 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[11px] font-medium text-indigo-300">Real-time incident intelligence</span>
            </motion.div>
            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight tracking-tight">
              Understand why your system<br />is failing — <span className="text-indigo-400">instantly</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-base text-slate-500 max-w-lg mx-auto mb-8 leading-relaxed">
              Not dashboards. Not alerts. Real-time causality.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={onSignUp} className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97] text-white text-sm font-semibold px-5 py-3 transition-all shadow-lg shadow-indigo-500/20">
                Run Live Incident <ArrowRight size={14} />
              </button>
              <button onClick={onSignIn} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-white transition-colors px-2 py-3">Sign in →</button>
            </motion.div>
          </motion.div>

          {/* Animated hero dependency graph */}
          <div className="w-full max-w-2xl mx-auto mt-10">
            <HeroGraph />
          </div>
        </section>
      </div>

      <section className="px-6 py-12" style={{ borderTop: "1px solid var(--ctx-border)", borderBottom: "1px solid var(--ctx-border)" }}>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[{ v: "8×", l: "Faster root cause", s: "vs manual log hunting" }, { v: "< 5min", l: "Time to first answer", s: "from alert to insight" }, { v: "60%", l: "MTTR reduction", s: "mean time to resolution" }].map(({ v, l, s }) => (
            <div key={l}><div className="text-3xl font-bold text-white mb-1">{v}</div><div className="text-sm font-medium text-slate-400 mb-0.5">{l}</div><div className="text-xs text-slate-600">{s}</div></div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="text-center mb-10">
            <motion.div variants={fadeUp}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">Core capabilities</p>
              <h2 className="text-2xl font-bold text-white">An AI SRE, not just a dashboard</h2>
            </motion.div>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Siren, title: "Root Cause Engine", desc: "Automatically pinpoints the root cause, builds the cascade chain, and estimates revenue impact — no manual correlation needed." },
              { icon: Network, title: "Live Dependency Graph", desc: "Animated edges light up as failures propagate. Click any node to inspect its health, connections, and predicted risk." },
              { icon: TrendingDown, title: "Prediction Engine", desc: "If Payments is failing and Checkout depends on it — Context flags Checkout as high risk before it fails, with ETA." },
            ].map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp}>
                <Card className="p-5 hover:border-indigo-500/20 transition-all">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4"><Icon size={16} className="text-indigo-400" /></div>
                  <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <footer className="px-6 py-10" style={{ borderTop: "1px solid var(--ctx-border)" }}>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <ContextLogo />
            <span className="text-xs text-slate-700 ml-1">— Your AI incident commander.</span>
          </div>
          <p className="text-xs text-slate-700">MIT License · 2025 · Built for engineers</p>
        </div>
      </footer>

    </div>
  );
}

// ── Routing ───────────────────────────────────────────────────────────────────

function HomeRedirect() {
  const [, setLocation] = useLocation();
  const { orgId, user } = useAuth();
  if (isDevAuthBypass) return <Dashboard onBack={() => setLocation("/welcome")} />;
  return (
    <>
      <Show when="signed-in"><Dashboard key={JSON.stringify([user?.id, orgId])} onBack={() => setLocation("/sign-out")} /></Show>
      <Show when="signed-out"><Landing onSignIn={() => setLocation("/sign-in")} onSignUp={() => setLocation("/sign-up")} /></Show>
    </>
  );
}

function SignOutPage() {
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  useEffect(() => { signOut().then(() => setLocation("/")); }, [signOut, setLocation]);
  return <div className="flex min-h-screen items-center justify-center bg-slate-950"><RefreshCw size={20} className="animate-spin text-slate-500" /></div>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  if (isDevAuthBypass) return <DevSession><Switch>
    <Route path="/welcome"><Landing onSignIn={() => setLocation("/")} onSignUp={() => setLocation("/")} /></Route>
    <Route><HomeRedirect /></Route>
  </Switch></DevSession>;
  return (
    <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
      <ClerkLoading><AuthenticationLoading /></ClerkLoading>
      <ClerkFailed><ApplicationStatus failed title="Sign-in could not load" message="Check your connection, then try again. You can also open this page in a regular browser." /></ClerkFailed>
      <ClerkLoaded><ClerkSession><Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign"><Redirect to="/sign-in" replace /></Route>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/sign-out" component={SignOutPage} />
        <Route><ApplicationStatus failed title="Page not found" message="Return to Context to open your workspace or sign in." recoveryHref={`${basePath}/`} /></Route>
      </Switch></ClerkSession></ClerkLoaded>
    </ClerkProvider>
  );
}

export default function App() {
  return <MotionConfig reducedMotion="user"><WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter></MotionConfig>;
}
