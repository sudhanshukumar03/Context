import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Users, FileText, Zap, ChevronRight, ArrowRight,
  CheckCircle2, X, Sun, Moon, GitBranch, Info, User, Code2,
  Layers, Target, Clock, TrendingUp, RefreshCw, BookOpen,
  Lightbulb, Shield, ChevronDown, AlertCircle, MessageSquare,
} from "lucide-react";

// --- Auth types & helpers ---
interface AuthUser { id: number; email: string; name: string; role: string; organizationId: number | null; createdAt: string; }
const getToken = () => localStorage.getItem("ctx_access");
const storeAuth = (a: string, r: string, u: AuthUser) => {
  localStorage.setItem("ctx_access", a); localStorage.setItem("ctx_refresh", r); localStorage.setItem("ctx_user", JSON.stringify(u));
};
const clearAuth = () => ["ctx_access", "ctx_refresh", "ctx_user"].forEach(k => localStorage.removeItem(k));
const storedUser = (): AuthUser | null => { try { const s = localStorage.getItem("ctx_user"); return s ? JSON.parse(s) as AuthUser : null; } catch { return null; } };

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const LinkedInIcon = ({ white }: { white?: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill={white ? "#fff" : "#0A66C2"}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

function AuthModal({ onSuccess, onClose }: { onSuccess: (u: AuthUser) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [name, setName] = useState(""); const [role, setRole] = useState("backend"); const [org, setOrg] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "linkedin" | null>(null);

  async function simulateOAuth(provider: "google" | "linkedin") {
    setOauthLoading(provider); setBusy(true); setError("");
    await new Promise(r => setTimeout(r, 600));
    try {
      const mockUser: AuthUser = {
        id: 9999,
        email: `demo.${provider}@context.ai`,
        name: provider === "google" ? "Google Demo User" : "LinkedIn Demo User",
        role: "backend",
        organizationId: 1,
        createdAt: new Date().toISOString(),
      };
      storeAuth("mock-demo-token", "mock-demo-refresh", mockUser);
      onSuccess(mockUser);
    } catch {
      setError(`Could not sign in with ${provider}.`);
    } finally {
      setOauthLoading(null);
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const path = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = tab === "login" ? { email, password } : { email, password, name, role, ...(org ? { organizationName: org } : {}) };
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json() as { success: boolean; data: { accessToken: string; refreshToken: string; user: AuthUser }; error: string | null };
      if (!json.success) { setError(json.error ?? "Something went wrong"); return; }
      storeAuth(json.data.accessToken, json.data.refreshToken, json.data.user);
      onSuccess(json.data.user);
    } catch { setError("Network error — please try again."); }
    finally { setBusy(false); }
  }

  const inputCls = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center"><Sparkles size={12} className="text-white" /></div>
            <span className="text-sm font-semibold text-white">Context</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-white/8 transition-colors"><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="flex border-b border-white/6">
          {(["login", "register"] as const).map(t => (
            <button key={t} type="button" onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? "text-indigo-400 border-b-2 border-indigo-500 -mb-px" : "text-slate-500 hover:text-slate-300"}`}>
              {t === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="p-6 space-y-3">
          {tab === "register" && (
            <div className="space-y-3">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" required className={inputCls} />
              <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
                <option value="backend">Backend Developer</option>
                <option value="frontend">Frontend Developer</option>
                <option value="pm">Product Manager</option>
              </select>
              <input value={org} onChange={e => setOrg(e.target.value)} placeholder="Company name (optional)" className={inputCls} />
            </div>
          )}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required className={inputCls} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={tab === "register" ? "Password (min 8 chars)" : "Password"} required minLength={8} className={inputCls} />
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}
          <button type="submit" disabled={busy}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {busy && <RefreshCw size={13} className="animate-spin" />}
            {tab === "login" ? "Sign in" : "Create account"}
          </button>
          {tab === "login" ? (
            <p className="text-center text-xs text-slate-500">No account?{" "}<button type="button" onClick={() => { setTab("register"); setError(""); }} className="text-indigo-400 hover:underline font-medium">Create one free</button></p>
          ) : (
            <p className="text-center text-xs text-slate-500">Have an account?{" "}<button type="button" onClick={() => { setTab("login"); setError(""); }} className="text-indigo-400 hover:underline font-medium">Sign in</button></p>
          )}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/8" /></div>
            <div className="relative flex justify-center"><span className="bg-slate-900 px-2 text-[10px] text-slate-500 uppercase tracking-wider">or continue with</span></div>
          </div>
          <button type="button" onClick={() => simulateOAuth("google")} disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60">
            {oauthLoading === "google" ? <RefreshCw size={15} className="animate-spin" /> : <GoogleIcon />}
            {oauthLoading === "google" ? "Connecting to Google…" : "Continue with Google"}
          </button>
          <button type="button" onClick={() => simulateOAuth("linkedin")} disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: oauthLoading === "linkedin" ? "#094da3" : "#0A66C2" }}>
            {oauthLoading === "linkedin" ? <RefreshCw size={15} className="animate-spin" /> : <LinkedInIcon white />}
            {oauthLoading === "linkedin" ? "Connecting to LinkedIn…" : "Continue with LinkedIn"}
          </button>
          <div className="pt-1">
            <button type="button" onClick={() => { setEmail("test@context.ai"); setPassword("password123"); setTab("login"); }}
              className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors py-1">
              ↗ Fill demo credentials
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

type Role = "backend" | "frontend" | "pm";

const MOCK_DATA = {
  roles: [
    { id: "backend" as Role, label: "Backend Developer", icon: Code2 },
    { id: "frontend" as Role, label: "Frontend Developer", icon: Layers },
    { id: "pm" as Role, label: "Product Manager", icon: Target },
  ],
  briefByRole: {
    backend: {
      keyInsight: "The Payments team is migrating auth to JWT. Your work begins in the token validation layer.",
      nextAction: "Review the Auth v2 system design doc and sync with Sarah Chen before sprint kickoff.",
      whyMatters: "Auth v2 is the highest-priority backend initiative this quarter. Missing context here delays your first meaningful contribution.",
      suggestedPerson: { name: "Sarah Chen", role: "Tech Lead, Payments", initials: "SC", color: "#6366f1" },
      confidence: 91,
      reasoning: [
        "Your role maps to 3 active backend PRDs in the Payments cluster",
        "Sarah Chen is the primary contributor on 6 of your relevant docs",
        "Auth v2 is flagged as highest-priority in Q2 planning docs",
      ],
    },
    frontend: {
      keyInsight: "The design system is migrating to Radix primitives. New components ship in 2 sprints.",
      nextAction: "Clone the design-system repo and review the component migration guide with Mei Zhou.",
      whyMatters: "Every frontend team in the org is a consumer of this system. Getting ahead of the migration saves weeks of rework.",
      suggestedPerson: { name: "Mei Zhou", role: "Design Systems Lead", initials: "MZ", color: "#14b8a6" },
      confidence: 87,
      reasoning: [
        "Your role matches 4 open frontend tasks in the design-system project",
        "Mei Zhou is actively reviewing PRs in the codebase you'll own",
        "Component migration is the highest-impact frontend initiative this month",
      ],
    },
    pm: {
      keyInsight: "Auth v2 is at 60% completion. The team needs a PM to own the rollout plan and stakeholder comms.",
      nextAction: "Read the Auth v2 PRD, then schedule an alignment call with Ravi Patel and the eng leads.",
      whyMatters: "Without a PM owner, engineering is making product decisions in isolation. You're the missing link.",
      suggestedPerson: { name: "Ravi Patel", role: "Head of Product", initials: "RP", color: "#f59e0b" },
      confidence: 89,
      reasoning: [
        "Your role matches the open PM seat on the Payments squad",
        "Ravi Patel is the direct stakeholder for all Q2 product initiatives",
        "Auth v2 rollout lacks a PM owner — flagged in 3 recent planning docs",
      ],
    },
  },
  teamByRole: {
    backend: [
      { initials: "SC", name: "Sarah Chen", role: "Tech Lead", color: "#6366f1", tags: ["Auth", "APIs", "Infra"], why: "Owns the systems your role touches directly." },
      { initials: "JK", name: "James Kirk", role: "DevOps", color: "#8b5cf6", tags: ["CI/CD", "K8s", "Infra"], why: "Controls the deploy pipeline you'll use daily." },
      { initials: "TP", name: "Tom Park", role: "Backend Eng", color: "#64748b", tags: ["Payments", "Go", "gRPC"], why: "Your onboarding pair for the first sprint." },
    ],
    frontend: [
      { initials: "MZ", name: "Mei Zhou", role: "Design Systems", color: "#14b8a6", tags: ["React", "Radix", "Tokens"], why: "Your primary collaborator on component work." },
      { initials: "LF", name: "Lena Fox", role: "Frontend Eng", color: "#6366f1", tags: ["TypeScript", "Vite", "Perf"], why: "Owns the frontend build system you'll work in." },
      { initials: "JL", name: "Jordan Lee", role: "UI Eng", color: "#8b5cf6", tags: ["a11y", "Motion", "CSS"], why: "Go-to for accessibility and animation questions." },
    ],
    pm: [
      { initials: "RP", name: "Ravi Patel", role: "Head of Product", color: "#f59e0b", tags: ["Roadmap", "Strategy", "OKRs"], why: "Your direct stakeholder for all Q2 launches." },
      { initials: "SC", name: "Sarah Chen", role: "Tech Lead", color: "#6366f1", tags: ["Engineering", "Scoping"], why: "Key technical partner for feature scoping." },
      { initials: "AN", name: "Anya Nair", role: "Product Analyst", color: "#14b8a6", tags: ["Metrics", "SQL", "Funnels"], why: "Provides data to back your product decisions." },
    ],
  },
  docsByRole: {
    backend: [
      { name: "Auth v2: System Design", why: "Directly relevant to your first sprint tasks." },
      { name: "Engineering Handbook", why: "Defines the coding standards you'll be held to." },
      { name: "Payments API Reference", why: "The primary API surface you'll build against." },
      { name: "On-Call Runbook", why: "You're on rotation in week 3." },
    ],
    frontend: [
      { name: "Design System Migration Guide", why: "Your first major contribution touches this." },
      { name: "Component Contribution Docs", why: "Required reading before opening your first PR." },
      { name: "Figma Handoff Standards", why: "Defines how design specs reach your codebase." },
      { name: "Accessibility Checklist", why: "All components must pass this before shipping." },
    ],
    pm: [
      { name: "Auth v2: Product Requirements", why: "The project you're expected to own from day one." },
      { name: "Q2 Roadmap & OKRs", why: "Context for every prioritization decision you'll make." },
      { name: "Stakeholder Map (Engineering)", why: "Who to loop in for which decisions." },
      { name: "PM Onboarding Checklist", why: "Your 30/60/90 day plan." },
    ],
  },
  graphNodes: [
    { id: "you", x: 300, y: 140, label: "You", fill: "#6366f1", r: 32, connections: ["team", "docs", "tasks", "tools"] },
    { id: "team", x: 150, y: 68, label: "Team", fill: "#8b5cf6", r: 26, connections: ["you", "docs"] },
    { id: "docs", x: 450, y: 68, label: "Docs", fill: "#64748b", r: 26, connections: ["you", "team"] },
    { id: "tasks", x: 150, y: 212, label: "Tasks", fill: "#14b8a6", r: 26, connections: ["you", "tools"] },
    { id: "tools", x: 450, y: 212, label: "Tools", fill: "#f59e0b", r: 26, connections: ["you", "tasks"] },
  ],
  graphEdges: [["you","team"],["you","docs"],["you","tasks"],["you","tools"],["team","docs"],["tasks","tools"]] as [string, string][],
  graphPanels: {
    you: { title: "You", desc: "Your context graph shows 4 direct relationships: Team, Docs, Tasks, and Tools. Each is weighted by relevance to your role and current sprint.", items: ["Payments team — high relevance", "Auth v2 docs — 3 unread", "Sprint 24 tasks — 2 assigned", "Dev toolchain — access pending"] },
    team: { title: "Team", desc: "3 people are directly relevant to your onboarding. Sarah Chen has the highest connection weight based on doc co-authorship and active PRs.", items: ["Sarah Chen — Tech Lead", "James Kirk — DevOps", "Tom Park — Backend Eng"] },
    docs: { title: "Docs", desc: "4 documents are recommended for your role. 2 are marked Read First based on sprint timing and ownership overlap.", items: ["Auth v2 System Design — urgent", "Engineering Handbook — required", "Payments API Reference — reference", "On-Call Runbook — week 3"] },
    tasks: { title: "Tasks", desc: "2 tasks have been pre-assigned in Linear. Both are scoped for onboarding — low risk, high learning value.", items: ["Fix token validation edge case", "Write unit tests for refresh flow"] },
    tools: { title: "Tools", desc: "5 tools used by your team. Access requests for 2 are pending approval from James Kirk.", items: ["GitHub — active", "Linear — active", "Datadog — pending", "PagerDuty — pending", "Notion — active"] },
  } as Record<string, { title: string; desc: string; items: string[] }>,
  impactMetrics: [
    { value: "70%", label: "Faster onboarding", sub: "avg across 200+ hires" },
    { value: "3×", label: "Faster task clarity", sub: "vs traditional onboarding" },
    { value: "48h", label: "Time to first contribution", sub: "down from 3 weeks" },
  ],
  demoSteps: [
    { id: 1, label: "Uploading company knowledge", detail: "Handbook, org chart, Notion wikis, Linear projects…" },
    { id: 2, label: "Understanding relationships", detail: "Mapping team structure, ownership, and activity patterns…" },
    { id: 3, label: "Generating your brief", detail: "Personalizing by role, team, and current priorities…" },
  ],
};

function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(true);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return [dark, () => setDark((d) => !d)];
}

function useOnScreen(ref: React.RefObject<Element | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return visible;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info size={11} className="text-slate-500 cursor-help" />
      <AnimatePresence>
        {show && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 w-max max-w-[180px] bg-slate-800 border border-white/10 text-slate-300 text-[10px] rounded-lg px-2.5 py-1.5 z-50 pointer-events-none shadow-xl">
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "indigo" | "amber" | "teal" }) {
  const v = {
    default: "bg-white/5 text-slate-400 border-white/8",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    teal: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${v[variant]}`}>{children}</span>;
}

function Avatar({ initials, color, size = "md" }: { initials: string; color: string; size?: "sm" | "md" }) {
  const s = { sm: "w-7 h-7 text-[11px]", md: "w-9 h-9 text-sm" };
  return (
    <div className={`${s[size]} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 select-none`}
      style={{ backgroundColor: color }}>{initials}</div>
  );
}

function Card({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <motion.div onClick={onClick} whileHover={onClick ? { y: -2, transition: { duration: 0.15 } } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      className={`rounded-2xl border border-white/8 bg-slate-900/60 backdrop-blur-sm ${onClick ? "cursor-pointer" : ""} ${className}`}>
      {children}
    </motion.div>
  );
}

function DemoFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (done) return undefined;
    if (step < 3) {
      setProgress(0);
      const pInterval = setInterval(() => {
        setProgress((p) => { if (p >= 100) { clearInterval(pInterval); return 100; } return p + 5; });
      }, 45);
      const t = setTimeout(() => {
        clearInterval(pInterval);
        if (step === 2) setTimeout(() => setDone(true), 350);
        else setTimeout(() => setStep((s) => s + 1), 250);
      }, 1000);
      return () => { clearInterval(pInterval); clearTimeout(t); };
    }
    return undefined;
  }, [step, done]);

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}
        className="w-full max-w-sm">
        <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center">
                <Sparkles size={10} className="text-white" />
              </div>
              <span className="text-xs font-semibold text-white">Context Brief</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ready
            </div>
          </div>
          <div className="space-y-0">
            {[
              { icon: Users, label: "Team", value: "Payments" },
              { icon: Target, label: "Goal", value: "Reduce API latency" },
              { icon: User, label: "Key Person", value: "Sarah — Tech Lead" },
              { icon: BookOpen, label: "Read first", value: "API Architecture Guide" },
              { icon: ArrowRight, label: "Next Action", value: "Review latency logs" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                <Icon size={13} className="text-indigo-400 flex-shrink-0" />
                <span className="text-[11px] text-slate-500 w-20 flex-shrink-0">{label}</span>
                <span className="text-xs text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
          <button onClick={onComplete}
            className="mt-4 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-semibold py-2.5 transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            Open Dashboard <ArrowRight size={13} />
          </button>
        </div>
      </motion.div>
    );
  }

  const overall = ((step * 100) + progress) / 3;
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-white/8 bg-slate-900/70 p-5">
        <div className="space-y-4 mb-5">
          {MOCK_DATA.demoSteps.map(({ id, label, detail }, i) => {
            const active = step === i;
            const complete = step > i;
            return (
              <div key={id} className={`flex items-start gap-3 transition-opacity duration-300 ${i > step ? "opacity-25" : "opacity-100"}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-300 ${
                  complete ? "bg-emerald-500" : active ? "bg-indigo-600 ring-4 ring-indigo-500/20" : "bg-white/10"
                }`}>
                  {complete ? <CheckCircle2 size={11} className="text-white" /> : <span className="text-[9px] text-white font-bold">{id}</span>}
                </div>
                <div>
                  <p className={`text-xs font-medium transition-colors ${active ? "text-white" : complete ? "text-slate-500" : "text-slate-600"}`}>{label}</p>
                  {active && <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <div className="h-1 rounded-full bg-white/8 overflow-hidden">
            <motion.div className="h-full bg-indigo-500 rounded-full" style={{ width: `${overall}%` }} transition={{ duration: 0.08 }} />
          </div>
          <p className="text-[10px] text-slate-600 text-right">{Math.round(overall)}%</p>
        </div>
      </div>
    </div>
  );
}

function HeroSplit() {
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-xl mx-auto mt-10">
      <div className="rounded-xl border border-red-500/10 bg-red-500/4 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertCircle size={12} className="text-red-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">Before</span>
          </div>
          <div className="space-y-1.5 blur-[0.3px] opacity-75">
            {["engineering-v3-FINAL.pdf", "Slack: #general (847 unread)", "Who owns auth? 🤷", "onboarding-2023-old.docx"].map((t) => (
              <div key={t} className="flex items-center gap-2 rounded-lg bg-white/4 px-2.5 py-1.5 text-[10px] text-slate-500">
                <div className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />{t}
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-0.5">
            <p className="text-[11px] font-semibold text-slate-400">Weeks to understand anything</p>
            <p className="text-[10px] text-slate-600">Too many tools. No clarity.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Sparkles size={12} className="text-indigo-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">After</span>
          </div>
          <div className="space-y-1.5">
            {["Your brief is ready", "Talk to: Sarah Chen", "Read: Auth v2 Design", "Focus: Token validation"].map((t) => (
              <div key={t} className="flex items-center gap-2 rounded-lg bg-indigo-500/8 border border-indigo-500/10 px-2.5 py-1.5 text-[10px] text-indigo-300">
                <CheckCircle2 size={10} className="text-indigo-400 flex-shrink-0" />{t}
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-0.5">
            <p className="text-[11px] font-semibold text-white">Clarity in minutes</p>
            <p className="text-[10px] text-slate-400">Know exactly what to do.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero({ onStart }: { onStart: () => void }) {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <section className="min-h-[100svh] flex flex-col items-center justify-center px-6 pt-20 pb-16 text-center">
      <motion.div initial="hidden" animate="visible" variants={stagger} className="w-full max-w-2xl mx-auto">
        <motion.div variants={fadeUp} className="mb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/8 px-3 py-1 text-xs font-medium text-indigo-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI-powered onboarding intelligence
          </span>
        </motion.div>

        <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.1]">
          From Zero Context to<br />
          <span className="text-indigo-400">Clear Action</span> — Instantly
        </motion.h1>

        <motion.p variants={fadeUp} className="mt-4 text-base text-slate-400 leading-relaxed max-w-md mx-auto">
          AI that understands your company and tells you exactly what matters.
        </motion.p>

        <AnimatePresence mode="wait">
          {!showDemo ? (
            <motion.div key="cta" variants={fadeUp} className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => setShowDemo(true)} aria-label="See how it works"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97] text-white text-sm font-semibold px-6 py-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                See How It Works <ChevronRight size={15} />
              </button>
              <button onClick={onStart} aria-label="View demo"
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-3 py-2">
                View Demo →
              </button>
            </motion.div>
          ) : (
            <motion.div key="demo" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-7 flex justify-center">
              <DemoFlow onComplete={onStart} />
            </motion.div>
          )}
        </AnimatePresence>

        {!showDemo && <motion.div variants={fadeUp}><HeroSplit /></motion.div>}
      </motion.div>
    </section>
  );
}

function ImpactSection() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useOnScreen(ref);

  return (
    <section ref={ref} className="px-6 py-16 border-y border-white/5">
      <div className="max-w-3xl mx-auto">
        <motion.div initial="hidden" animate={visible ? "visible" : "hidden"} variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {MOCK_DATA.impactMetrics.map(({ value, label, sub }) => (
            <motion.div key={label} variants={fadeUp}>
              <p className="text-4xl font-bold text-white tracking-tight">{value}</p>
              <p className="text-sm font-medium text-slate-300 mt-1">{label}</p>
              <p className="text-xs text-slate-600 mt-1">{sub}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function RoleDropdown({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  const [open, setOpen] = useState(false);
  const current = MOCK_DATA.roles.find((r) => r.id === role)!;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Select your role"
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/8 px-3 py-2 text-xs font-medium text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <current.icon size={13} className="text-indigo-400" />
        {current.label}
        <ChevronDown size={12} className={`text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 left-0 w-48 rounded-xl border border-white/10 bg-slate-900 shadow-xl z-50 overflow-hidden">
            {MOCK_DATA.roles.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setRole(id); setOpen(false); }} aria-label={label}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none ${
                  role === id ? "bg-indigo-600/20 text-indigo-300" : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}>
                <Icon size={13} />
                {label}
                {role === id && <CheckCircle2 size={11} className="text-indigo-400 ml-auto" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContextBriefCard({ role, onWhyClick }: { role: Role; onWhyClick: () => void }) {
  const brief = MOCK_DATA.briefByRole[role];
  return (
    <AnimatePresence mode="wait">
      <motion.div key={role} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Context Brief</h2>
            </div>
            <button onClick={onWhyClick} aria-label="Why this suggestion?"
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-indigo-400 transition-colors rounded-lg px-2 py-1 hover:bg-indigo-500/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <Info size={11} />
              Why this?
              <Tooltip text="AI-generated insight based on your role, team, and company docs" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: Lightbulb, label: "Key Insight", value: brief.keyInsight, color: "text-indigo-400" },
              { icon: ArrowRight, label: "Next Action", value: brief.nextAction, color: "text-teal-400" },
              { icon: User, label: "Who to Talk To", value: `${brief.suggestedPerson.name} — ${brief.suggestedPerson.role}`, color: "text-violet-400" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-xl border border-white/6 bg-white/[0.03] p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={12} className={color} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-amber-500/10 bg-amber-500/5 px-3.5 py-3 flex items-start gap-2.5">
            <MessageSquare size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide mb-0.5">Why this matters</p>
              <p className="text-xs text-slate-400 leading-relaxed">{brief.whyMatters}</p>
            </div>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

function WhyPanel({ role, onClose }: { role: Role; onClose: () => void }) {
  const brief = MOCK_DATA.briefByRole[role];
  return (
    <motion.div initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" as const }}
      className="fixed inset-y-0 right-0 w-full sm:w-[340px] bg-slate-950 border-l border-white/8 z-50 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between p-5 border-b border-white/6">
        <div className="flex items-center gap-2">
          <Info size={13} className="text-indigo-400" />
          <span className="text-sm font-semibold text-white">Why this suggestion?</span>
        </div>
        <button onClick={onClose} aria-label="Close"
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          <X size={14} className="text-slate-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Confidence Score</p>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-white">{brief.confidence}%</span>
              <Tooltip text="AI-generated insight. Based on role match, doc overlap, and activity signals." />
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <motion.div className="h-full rounded-full bg-indigo-500"
              initial={{ width: 0 }} animate={{ width: `${brief.confidence}%` }} transition={{ duration: 0.6, ease: "easeOut" as const }} />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2.5">Based on</p>
          <div className="space-y-1.5">
            {["Team structure", "Documents", "Activity patterns"].map((s) => (
              <div key={s} className="flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" />{s}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Reasoning</p>
          <ul className="space-y-3">
            {brief.reasoning.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
                <div className="w-4 h-4 rounded-full bg-indigo-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-indigo-400">{i + 1}</span>
                </div>{r}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-white/6 bg-white/[0.03] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Suggested contact</p>
          <div className="flex items-center gap-3">
            <Avatar initials={brief.suggestedPerson.initials} color={brief.suggestedPerson.color} size="sm" />
            <div>
              <p className="text-sm font-medium text-white">{brief.suggestedPerson.name}</p>
              <p className="text-xs text-slate-500">{brief.suggestedPerson.role}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GraphPanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const panel = MOCK_DATA.graphPanels[nodeId];
  if (!panel) return null;
  return (
    <motion.div initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" as const }}
      className="fixed inset-y-0 right-0 w-full sm:w-[320px] bg-slate-950 border-l border-white/8 z-50 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between p-5 border-b border-white/6">
        <div className="flex items-center gap-2">
          <GitBranch size={13} className="text-indigo-400" />
          <span className="text-sm font-semibold text-white">{panel.title}</span>
        </div>
        <button onClick={onClose} aria-label="Close"
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          <X size={14} className="text-slate-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <p className="text-xs text-slate-400 leading-relaxed">{panel.desc}</p>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Relationships</p>
          <ul className="space-y-2">
            {panel.items.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-xs text-slate-400 py-2 border-b border-white/5 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />{item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

function ContextGraph() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const nodes = MOCK_DATA.graphNodes;
  const edges = MOCK_DATA.graphEdges;
  const getN = useCallback((id: string) => nodes.find((n) => n.id === id)!, [nodes]);

  return (
    <>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Context Graph</h2>
          </div>
          <span className="text-[10px] text-slate-600">click a node to explore</span>
        </div>
        <div className="overflow-x-auto">
          <svg width="600" height="280" viewBox="0 0 600 280" className="w-full" role="img" aria-label="Context graph">
            <defs>
              <marker id="garr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.1)" />
              </marker>
            </defs>
            {edges.map(([a, b]) => {
              const na = getN(a), nb = getN(b);
              const dx = nb.x - na.x, dy = nb.y - na.y, len = Math.sqrt(dx*dx + dy*dy);
              const ux = dx/len, uy = dy/len;
              return (
                <line key={`${a}-${b}`} x1={na.x+ux*na.r} y1={na.y+uy*na.r}
                  x2={nb.x-ux*(nb.r+4)} y2={nb.y-uy*(nb.r+4)}
                  stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} markerEnd="url(#garr)" />
              );
            })}
            {nodes.map(({ id, x, y, label, fill, r }) => (
              <g key={id} style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)}
                onClick={() => setActivePanel(id)} aria-label={`${label} node — click to explore`}>
                <circle cx={x} cy={y} r={hovered === id || activePanel === id ? r + 5 : r} fill={fill}
                  fillOpacity={hovered && hovered !== id ? 0.3 : 1}
                  style={{ transition: "r 0.15s ease, fill-opacity 0.15s ease" }} />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                  fill="white" fontSize={11} fontWeight={600} pointerEvents="none">{label}</text>
              </g>
            ))}
          </svg>
        </div>
      </Card>
      <AnimatePresence>
        {activePanel && <GraphPanel nodeId={activePanel} onClose={() => setActivePanel(null)} />}
      </AnimatePresence>
    </>
  );
}

function TeamIntelligence({ role }: { role: Role }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key={role} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Team Intelligence</h2>
          </div>
          <div className="space-y-0">
            {MOCK_DATA.teamByRole[role].map(({ initials, name, role: mr, color, tags, why }) => (
              <motion.div key={name} whileHover={{ backgroundColor: "rgba(255,255,255,0.02)" }}
                className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0 rounded-lg px-1 transition-colors">
                <Avatar initials={initials} color={color} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-medium text-white truncate">{name}</p>
                    <span className="text-[10px] text-slate-600">·</span>
                    <p className="text-[10px] text-slate-500 truncate">{mr}</p>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{why}</p>
                </div>
                <div className="hidden sm:flex items-center gap-1 flex-wrap justify-end">
                  {tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

function SmartDocuments({ role }: { role: Role }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key={role} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Smart Documents</h2>
            </div>
            <span className="text-[10px] text-slate-600">AI-recommended for your role</span>
          </div>
          <div className="space-y-0">
            {MOCK_DATA.docsByRole[role].map(({ name, why }, i) => (
              <motion.div key={name} whileHover={{ backgroundColor: "rgba(255,255,255,0.02)" }}
                className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0 rounded-lg px-1 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <BookOpen size={12} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{why}</p>
                </div>
                {i < 2 && <Badge variant="indigo">Read First</Badge>}
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/60 p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 rounded-full bg-white/8" />
      <div className="grid grid-cols-3 gap-3">
        {[0,1,2].map((i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2">
            <div className="h-2 w-12 rounded-full bg-white/8" />
            <div className="h-2.5 w-full rounded-full bg-white/8" />
            <div className="h-2.5 w-4/5 rounded-full bg-white/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ onBack }: { onBack: () => void }) {
  const [role, setRole] = useState<Role>("backend");
  const [whyOpen, setWhyOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dark, toggleDark] = useDarkMode();

  useEffect(() => { const t = setTimeout(() => setLoaded(true), 1200); return () => clearTimeout(t); }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-white/6 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button onClick={onBack} aria-label="Go to home"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white">Context</span>
          </button>
          <div className="flex items-center gap-2.5">
            <RoleDropdown role={role} setRole={(r) => { setLoaded(false); setRole(r); setTimeout(() => setLoaded(true), 800); }} />
            <button onClick={toggleDark} aria-label="Toggle theme"
              className="p-2 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              {dark ? <Sun size={14} className="text-slate-500" /> : <Moon size={14} className="text-slate-500" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-white">Your Context</h1>
            <p className="text-xs text-slate-500 mt-0.5">Personalized for {MOCK_DATA.roles.find(r => r.id === role)?.label}.</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <RefreshCw size={10} /><span>Updated now</span>
          </div>
        </div>

        <div className="space-y-4">
          {loaded ? (
            <ContextBriefCard role={role} onWhyClick={() => setWhyOpen(true)} />
          ) : (
            <SkeletonCard />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ContextGraph />
            <TeamIntelligence role={role} />
          </div>
          <SmartDocuments role={role} />
        </div>
      </main>

      <AnimatePresence>
        {whyOpen && <WhyPanel role={role} onClose={() => setWhyOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

function Landing({ onStart }: { onStart: () => void }) {
  const [dark, toggleDark] = useDarkMode();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="fixed top-0 left-0 right-0 z-30 border-b border-white/6 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white">Context</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleDark} aria-label="Toggle theme"
              className="p-2 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              {dark ? <Sun size={14} className="text-slate-500" /> : <Moon size={14} className="text-slate-500" />}
            </button>
            <button onClick={onStart} aria-label="Sign in"
              className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              Sign in
            </button>
            <button onClick={onStart} aria-label="Get started"
              className="text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97] text-white px-3.5 py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              Get started
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto">
        <Hero onStart={onStart} />
      </div>

      <ImpactSection />

      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="text-center mb-10">
            <motion.div variants={fadeUp}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400 mb-3">What's inside</p>
              <h2 className="text-2xl font-bold text-white">Built to be trusted, not just impressive</h2>
            </motion.div>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Sparkles, title: "Context Brief", desc: "Key insight, next action, and who to talk to — personalized by role with a confidence score." },
              { icon: GitBranch, title: "Context Graph", desc: "Click any node — team, docs, tasks, or tools — to see a full relationship panel." },
              { icon: Shield, title: "AI Transparency", desc: "Every suggestion shows its reasoning, sources, and confidence. Nothing is a black box." },
            ].map(({ icon: Icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp}>
                <Card className="p-5 hover:border-indigo-500/20 transition-all duration-200">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4">
                    <Icon size={16} className="text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-white/6 px-6 py-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center">
              <Sparkles size={10} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-white">Context</span>
            <span className="text-xs text-slate-700 ml-1">— Company chaos to clear action.</span>
          </div>
          <p className="text-xs text-slate-700">MIT License · 2025 · Made with intent</p>
        </div>
      </footer>
    </div>
  );
}

export default function ContextApp() {
  const [view, setView] = useState<"landing" | "auth" | "dashboard">(() =>
    storedUser() && getToken() ? "dashboard" : "landing"
  );

  return (
    <>
      <AnimatePresence>
        {view === "auth" && (
          <AuthModal
            onSuccess={() => setView("dashboard")}
            onClose={() => setView("landing")}
          />
        )}
      </AnimatePresence>
      {view !== "dashboard"
        ? <Landing onStart={() => setView("auth")} />
        : <Dashboard onBack={() => { clearAuth(); setView("landing"); }} />
      }
    </>
  );
}
