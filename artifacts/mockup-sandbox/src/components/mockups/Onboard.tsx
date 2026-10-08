import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  User,
  GitBranch,
  MessageCircle,
  LayoutDashboard,
  FileText,
  Users,
  FolderOpen,
  Settings,
  Sparkles,
  RefreshCw,
  X,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
  Send,
  ExternalLink,
} from "lucide-react";

// --- Auth types & helpers ---
interface AuthUser { id: number; email: string; name: string; role: string; organizationId: number | null; createdAt: string; }
const getToken = () => localStorage.getItem("ob_access");
const storeAuth = (a: string, r: string, u: AuthUser) => {
  localStorage.setItem("ob_access", a); localStorage.setItem("ob_refresh", r); localStorage.setItem("ob_user", JSON.stringify(u));
};
const clearAuth = () => ["ob_access", "ob_refresh", "ob_user"].forEach(k => localStorage.removeItem(k));
const storedUser = (): AuthUser | null => { try { const s = localStorage.getItem("ob_user"); return s ? JSON.parse(s) as AuthUser : null; } catch { return null; } };

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
        email: `demo.${provider}@onboard.ai`,
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

  const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.18 }}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center"><Sparkles size={12} className="text-white" /></div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Onboard</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          {(["login", "register"] as const).map(t => (
            <button key={t} type="button" onClick={() => { setTab(t); setError(""); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-500 -mb-px" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
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
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/60 px-3 py-2.5">
              <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{error}</p>
            </div>
          )}
          <button type="submit" disabled={busy}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {busy && <RefreshCw size={13} className="animate-spin" />}
            {tab === "login" ? "Sign in" : "Create account"}
          </button>
          {tab === "login" ? (
            <p className="text-center text-xs text-slate-400">No account?{" "}<button type="button" onClick={() => { setTab("register"); setError(""); }} className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Create one free</button></p>
          ) : (
            <p className="text-center text-xs text-slate-400">Have an account?{" "}<button type="button" onClick={() => { setTab("login"); setError(""); }} className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Sign in</button></p>
          )}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-800" /></div>
            <div className="relative flex justify-center"><span className="bg-white dark:bg-slate-900 px-2 text-[10px] text-slate-400 uppercase tracking-wider">or continue with</span></div>
          </div>
          <button type="button" onClick={() => simulateOAuth("google")} disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-60">
            {oauthLoading === "google" ? <RefreshCw size={15} className="animate-spin text-slate-400" /> : <GoogleIcon />}
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
              className="w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors py-1">
              ↗ Fill demo credentials
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

const MOCK_DATA = {
  teamMembers: [
    { initials: "SC", name: "Sarah Chen", role: "Tech Lead", color: "bg-violet-500", why: "Owns the backend you'll be working in" },
    { initials: "RP", name: "Ravi Patel", role: "Product", color: "bg-indigo-500", why: "Defines the roadmap for your squad" },
    { initials: "MZ", name: "Mei Zhou", role: "Design", color: "bg-teal-500", why: "Your go-to for component questions" },
    { initials: "JK", name: "James Kirk", role: "DevOps", color: "bg-amber-500", why: "Manages infra and deploy pipeline" },
    { initials: "LF", name: "Lena Fox", role: "EM", color: "bg-rose-500", why: "Your direct manager — weekly 1:1 on Tuesdays" },
  ],
  documents: [
    { name: "Engineering Handbook", tag: "Read First", modified: "2 days ago", summary: "Covers the engineering principles, deployment process, and incident response playbook used across all backend teams. Establishes expectations for code review turnaround and on-call rotations. Essential reading before your first deploy." },
    { name: "Payments Team PRD", tag: "Read First", modified: "1 day ago", summary: "Product requirements for Auth v2, including the token refresh flow, backward-compat constraints, and the rollout plan targeting Q2. Contains the acceptance criteria your squad owns for this sprint." },
    { name: "Org Chart (Engineering)", tag: "Important", modified: "1 week ago", summary: "Current reporting structure for the 140-person engineering org. Shows the Payments cluster, TPM assignments, and cross-functional pods shipping in H1. Helpful for navigating stakeholder relationships." },
    { name: "System Design: Auth v2", tag: "Important", modified: "3 days ago", summary: "Detailed design doc for the Auth v2 token architecture. Covers the decision to move from opaque tokens to JWTs with short expiry, and the tradeoffs considered during design review." },
    { name: "Onboarding Checklist", tag: "Optional", modified: "5 days ago", summary: "30-60-90 day milestones for new engineers, including required training modules, system access requests, and suggested first contributions by week three." },
  ],
  testimonials: [
    { initials: "JL", name: "Jordan Lee", role: "Senior Engineer @ Stripe", color: "bg-indigo-500", quote: "I felt oriented before my first standup. I knew who was who, what we were building, and why it mattered. That's never happened to me in 8 years of joining companies." },
    { initials: "PN", name: "Priya Nair", role: "Head of People @ Vercel", color: "bg-violet-500", quote: "Our onboarding time dropped from 3 weeks to 3 days. New hires are productive on day one and we've stopped losing them in the first 90 days." },
    { initials: "MW", name: "Marcus Webb", role: "EM @ Linear", color: "bg-teal-500", quote: "It's like a cheat code for new hires. I used to spend two hours per person on intro calls. Now those calls are genuinely useful because everyone already has context." },
  ],
  suggestedPrompts: [
    "Who leads the Payments team?",
    "What's the team's current sprint focus?",
    "Where do I find the system design docs?",
  ],
  aiResponses: {
    "Who leads the Payments team?": "Sarah Chen is the Tech Lead for the Payments team. She's been at the company for 3 years and owns the backend infrastructure your role touches directly. She runs a team sync every Tuesday at 10am — you'll be added automatically. Your EM Lena Fox reports alongside her to VP Engineering.",
    "What's the team's current sprint focus?": "The Payments team is in sprint 24, shipping Auth v2. The primary deliverable is a new token refresh architecture moving from opaque tokens to short-lived JWTs. The sprint ends in 6 days. There's a well-scoped onboarding task in the token validation middleware waiting for you.",
    "Where do I find the system design docs?": "System design docs live in Notion under Engineering → Payments → Architecture. The most relevant for you is 'Auth v2: Token Architecture' — linked in your brief. The PRD is in Linear under the 'Auth v2' project. Ping James Kirk if you need access to the infra runbooks.",
  } as Record<string, string>,
  typewriterLines: [
    "Analyzing engineering-team.pdf...",
    "Building your context graph...",
    "You'll be working with the Payments team. Your lead is Sarah Chen...",
  ],
  navItems: [
    { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
    { icon: FileText, label: "My Brief", id: "brief" },
    { icon: Users, label: "Team Context", id: "team" },
    { icon: FolderOpen, label: "Documents", id: "documents" },
  ],
  features: [
    { icon: Zap, label: "instant context", title: "Company Brain", description: "Get the full picture of your org, team, and stack — the moment you join." },
    { icon: User, label: "role-aware", title: "Built for your role", description: "Your brief adapts to your title, team, and what you'll actually own." },
    { icon: GitBranch, label: "relationships", title: "Know who matters", description: "Understand your key stakeholders before your first 1:1." },
    { icon: MessageCircle, label: "always on", title: "Ask anything", description: "A persistent AI assistant trained on your company docs." },
  ],
  howItWorks: [
    { step: "01", title: "Upload your docs", description: "Employee handbook, org chart, wikis, and internal knowledge bases." },
    { step: "02", title: "AI builds the graph", description: "Relationships, ownership, terminology, and team dynamics extracted automatically." },
    { step: "03", title: "Get your brief", description: "Personalized, scannable, role-specific context delivered before day one." },
  ],
};

function useTypewriter(lines: string[], speed = 40, loopDelay = 6000) {
  const [displayText, setDisplayText] = useState("");
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const currentLine = lines[lineIndex];
    if (charIndex < currentLine.length) {
      const t = setTimeout(() => setCharIndex((c) => c + 1), speed);
      return () => clearTimeout(t);
    }
    const isLast = lineIndex === lines.length - 1;
    if (isLast) {
      const t = setTimeout(() => { setLineIndex(0); setCharIndex(0); setDisplayText(""); }, loopDelay);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => { setLineIndex((i) => i + 1); setCharIndex(0); }, 500);
    return () => clearTimeout(t);
  }, [charIndex, lineIndex, lines, speed, loopDelay]);

  useEffect(() => {
    setDisplayText(lines[lineIndex].slice(0, charIndex));
  }, [charIndex, lineIndex, lines]);

  return { displayText, lineIndex };
}

function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return [dark, () => setDark((d) => !d)];
}

function useOnScreen(ref: React.RefObject<Element | null>) {
  const [isVisible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return isVisible;
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

function Button({
  children, variant = "primary", className = "", onClick, "aria-label": ariaLabel, type = "button",
}: {
  children: React.ReactNode; variant?: "primary" | "ghost" | "outline";
  className?: string; onClick?: () => void; "aria-label"?: string; type?: "button" | "submit";
}) {
  const base = "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.97]",
    ghost: "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800",
    outline: "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800",
  };
  return (
    <button type={type} onClick={onClick} aria-label={ariaLabel} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Badge({ children, variant = "indigo" }: { children: React.ReactNode; variant?: "indigo" | "amber" | "slate" }) {
  const variants = {
    indigo: "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    amber: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

function Avatar({ initials, color = "bg-indigo-500", size = "md" }: { initials: string; color?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-7 h-7 text-xs", md: "w-9 h-9 text-sm", lg: "w-11 h-11 text-sm" };
  return (
    <div className={`${color} ${sizes[size]} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 select-none`}>
      {initials}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

function Hero({ onEnterDashboard }: { onEnterDashboard: () => void }) {
  const { displayText, lineIndex } = useTypewriter(MOCK_DATA.typewriterLines, 36, 5500);
  const [activeStep, setActiveStep] = useState(0);
  const steps = ["Upload docs", "AI processing", "Your brief"];

  useEffect(() => {
    const t = setInterval(() => setActiveStep((s) => (s + 1) % 3), 2100);
    return () => clearInterval(t);
  }, []);

  const completedLines = MOCK_DATA.typewriterLines.slice(0, lineIndex);
  const currentLine = displayText;

  return (
    <motion.section
      initial="hidden" animate="visible" variants={stagger}
      className="min-h-[100svh] flex flex-col items-center justify-center px-6 pt-24 pb-20 text-center"
    >
      <motion.div variants={fadeInUp} className="mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Now in private beta
        </span>
      </motion.div>

      <motion.h1 variants={fadeInUp} className="max-w-2xl text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
        Understand your company<br className="hidden sm:block" />{" "}
        <span className="text-indigo-600 dark:text-indigo-400">in minutes, not weeks</span>
      </motion.h1>

      <motion.p variants={fadeInUp} className="mt-5 max-w-md text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
        Onboard turns scattered knowledge into clear, role-specific context — before your first standup.
      </motion.p>

      <motion.div variants={fadeInUp} className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Button onClick={onEnterDashboard} aria-label="Start for free">Start for free</Button>
        <button
          onClick={onEnterDashboard}
          aria-label="See it in action"
          className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
        >
          See it in action <ArrowRight size={14} />
        </button>
      </motion.div>

      <motion.div variants={fadeInUp} className="mt-12 w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-5">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                activeStep === i
                  ? "bg-indigo-600 text-white ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeStep === i ? "bg-white animate-pulse" : "bg-slate-300 dark:bg-slate-600"}`} />
                {s}
              </div>
              {i < steps.length - 1 && <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5 text-left shadow-md">
          <div className="flex items-center gap-1.5 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-amber-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
            <span className="ml-2 text-slate-500 text-xs font-mono">onboard — context engine</span>
          </div>
          <div className="space-y-2 min-h-[84px] font-mono text-sm">
            {completedLines.map((line, i) => (
              <div key={i} className="text-slate-400">
                <span className="text-indigo-400">› </span>{line}
              </div>
            ))}
            {currentLine && (
              <div className="text-slate-300">
                <span className="text-indigo-400">› </span>
                {currentLine}
                <span className="inline-block w-0.5 h-4 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.section>
  );
}

function Features() {
  return (
    <motion.section
      initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={stagger}
      className="px-6 py-24 max-w-5xl mx-auto"
    >
      <motion.div variants={fadeInUp} className="text-center mb-12">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">What you get</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Built for how teams actually work</h2>
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MOCK_DATA.features.map(({ icon: Icon, label, title, description }) => (
          <motion.div key={title} variants={fadeInUp}>
            <Card className="p-6 group cursor-default hover:-translate-y-1 hover:ring-1 hover:ring-indigo-200 dark:hover:ring-indigo-800 hover:shadow-md transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-4">
                <Icon size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{label}</p>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useOnScreen(ref);

  return (
    <motion.section
      initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={stagger}
      className="px-6 py-24 bg-slate-50 dark:bg-slate-900/60"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div variants={fadeInUp} className="text-center mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">From scattered docs to instant clarity</h2>
        </motion.div>
        <div ref={ref} className="relative flex flex-col md:flex-row items-center gap-10 md:gap-0">
          {MOCK_DATA.howItWorks.map(({ step, title, description }, i) => (
            <div key={step} className="relative flex-1 flex flex-col items-center text-center px-4">
              {i < MOCK_DATA.howItWorks.length - 1 && (
                <div className="hidden md:block absolute top-[22px] left-[58%] right-[-42%] h-px overflow-hidden">
                  <motion.div
                    className="h-full"
                    style={{ background: "repeating-linear-gradient(90deg,#6366f1 0,#6366f1 6px,transparent 6px,transparent 13px)" }}
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={visible ? { scaleX: 1 } : { scaleX: 0 }}
                    transition={{ duration: 0.55, delay: i * 0.25, ease: "easeOut" }}
                  />
                </div>
              )}
              <motion.div variants={fadeInUp} className="flex flex-col items-center">
                <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold mb-4 relative z-10">
                  {step}
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[190px] leading-relaxed">{description}</p>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function BeforeAfter() {
  return (
    <motion.section
      initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={stagger}
      className="px-6 py-24 max-w-5xl mx-auto"
    >
      <motion.div variants={fadeInUp} className="text-center mb-12">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">The difference</p>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Day one, redefined</h2>
      </motion.div>
      <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-[1fr_56px_1fr] gap-4 items-center">
        <Card className="p-6 opacity-60 dark:opacity-50">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <AlertCircle size={18} className="text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Before</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Flying blind</p>
            </div>
          </div>
          <ul className="space-y-3">
            {["Asking the same questions twice", "Don't know who owns what", "3 weeks to feel productive"].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-slate-500 dark:text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mt-1.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex items-center justify-center">
          <div className="w-9 h-9 rounded-full border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
            <ArrowRight size={15} className="text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        <Card className="p-6 ring-1 ring-indigo-200 dark:ring-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center">
              <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">After</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Fully oriented</p>
            </div>
          </div>
          <ul className="space-y-3">
            {["Context on day one", "Clear ownership map", "Productive in 48 hours"].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <CheckCircle2 size={14} className="text-indigo-500 mt-0.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>
    </motion.section>
  );
}

function Testimonials() {
  return (
    <motion.section
      initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={stagger}
      className="px-6 py-24 bg-slate-50 dark:bg-slate-900/60"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div variants={fadeInUp} className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">From the field</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Teams that use it, keep it</h2>
        </motion.div>
        <div className="flex gap-4 overflow-x-auto pb-3 md:grid md:grid-cols-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {MOCK_DATA.testimonials.map(({ initials, name, role, color, quote }) => (
            <motion.div key={name} variants={fadeInUp} className="flex-shrink-0 w-[300px] md:w-auto">
              <Card className="p-6 h-full flex flex-col">
                <p className="text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed flex-1 mb-6">"{quote}"</p>
                <div className="flex items-center gap-3">
                  <Avatar initials={initials} color={color} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                    <p className="text-xs text-slate-400">{role}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function Footer({ onEnterDashboard }: { onEnterDashboard: () => void }) {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row justify-between gap-10 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
                <Sparkles size={12} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Onboard</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed max-w-[200px]">Built for humans, not HR software.</p>
          </div>
          <div className="flex gap-8">
            {[["Product", onEnterDashboard], ["GitHub", () => {}], ["Contact", () => {}], ["Status", () => {}]].map(([label, handler]) => (
              <button key={label as string} onClick={handler as () => void} aria-label={label as string}
                className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                {label as string}
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 text-xs text-slate-400 text-center">
          MIT License · 2025 · Made with intent
        </div>
      </div>
    </footer>
  );
}

function Sidebar({ activeNav, setActiveNav, onBackToLanding }: {
  activeNav: string; setActiveNav: (id: string) => void; onBackToLanding: () => void;
}) {
  return (
    <aside className="hidden md:flex flex-col w-60 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 h-screen sticky top-0">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <button onClick={onBackToLanding} aria-label="Go to homepage"
          className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-0.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Onboard</span>
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {MOCK_DATA.navItems.map(({ icon: Icon, label, id }) => (
          <button key={id} onClick={() => setActiveNav(id)} aria-label={label}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              activeNav === id
                ? "bg-indigo-600 text-white"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
            }`}>
            <Icon size={16} />{label}
          </button>
        ))}
        <div className="pt-1 pb-0.5"><div className="border-t border-slate-100 dark:border-slate-800" /></div>
        <button onClick={() => setActiveNav("settings")} aria-label="Settings"
          className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            activeNav === "settings"
              ? "bg-indigo-600 text-white"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
          }`}>
          <Settings size={16} />Settings
        </button>
      </nav>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Avatar initials="AR" color="bg-indigo-600" size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">Alex Rivera</p>
            <p className="text-xs text-slate-400 truncate">Backend Engineer</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileBottomNav({ activeNav, setActiveNav }: { activeNav: string; setActiveNav: (id: string) => void }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex z-40" aria-label="Mobile navigation">
      {MOCK_DATA.navItems.map(({ icon: Icon, label, id }) => (
        <button key={id} onClick={() => setActiveNav(id)} aria-label={label}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
            activeNav === id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}>
          <Icon size={18} /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function WelcomeHeader() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{greeting}, Alex.</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Here's your context for this week.</p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 sm:mt-0 flex-shrink-0">
        <RefreshCw size={12} className="text-slate-400" />
        <span>Last updated 2 hours ago</span>
      </div>
    </div>
  );
}

function AIBriefCard() {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 1500); return () => clearTimeout(t); }, []);
  const tiles = [
    { icon: Zap, label: "Key insight", value: "The Payments team is shipping Auth v2 this sprint.", color: "text-indigo-500" },
    { icon: FolderOpen, label: "Focus area", value: "Backend infrastructure — review PRD in /docs", color: "text-violet-500" },
    { icon: Users, label: "Suggested action", value: "Intro call with Sarah Chen (Tech Lead) recommended", color: "text-teal-500" },
  ];
  return (
    <div className="mb-6 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900">
      <div className="px-5 pt-4 pb-3.5 border-b border-indigo-100 dark:border-indigo-900 flex items-center gap-2">
        <Sparkles size={15} className="text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">This Week's Context</h2>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {loading
          ? [0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-800 p-4 space-y-2.5">
                <div className="h-2.5 w-16 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                <div className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
                <div className="h-3.5 w-4/5 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
              </div>
            ))
          : tiles.map(({ icon: Icon, label, value, color }) => (
              <motion.div key={label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={13} className={color} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{value}</p>
              </motion.div>
            ))}
      </div>
    </div>
  );
}

function ContextGraph() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const nodes = [
    { id: "you", x: 300, y: 140, label: "You", color: "#6366f1", r: 30 },
    { id: "team", x: 140, y: 72, label: "Team", color: "#8b5cf6", r: 24 },
    { id: "projects", x: 460, y: 72, label: "Projects", color: "#14b8a6", r: 24 },
    { id: "docs", x: 140, y: 208, label: "Docs", color: "#64748b", r: 24 },
    { id: "stakeholders", x: 460, y: 208, label: "Stakeholders", color: "#f59e0b", r: 24 },
  ];
  const edges = [["you","team"],["you","projects"],["you","docs"],["you","stakeholders"],["team","projects"]];
  const getNode = (id: string) => nodes.find((n) => n.id === id)!;

  return (
    <Card className="mb-6 p-5">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Context Graph</h2>
      <div className="overflow-x-auto">
        <svg width="600" height="280" viewBox="0 0 600 280" className="w-full" role="img" aria-label="Context graph showing your connections">
          <defs>
            <marker id="arr" markerWidth="7" markerHeight="7" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill="#cbd5e1" className="dark:fill-slate-600" />
            </marker>
          </defs>
          {edges.map(([a, b]) => {
            const na = getNode(a), nb = getNode(b);
            const dx = nb.x - na.x, dy = nb.y - na.y, len = Math.sqrt(dx*dx + dy*dy);
            const ux = dx/len, uy = dy/len;
            return (
              <line key={`${a}-${b}`}
                x1={na.x + ux*na.r} y1={na.y + uy*na.r}
                x2={nb.x - ux*(nb.r+5)} y2={nb.y - uy*(nb.r+5)}
                stroke="#cbd5e1" strokeWidth={1.5} markerEnd="url(#arr)" />
            );
          })}
          {nodes.map(({ id, x, y, label, color, r }) => (
            <g key={id} style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredNode(id)}
              onMouseLeave={() => setHoveredNode(null)}
              aria-label={`${label} — 3 connected items`}>
              <circle cx={x} cy={y} r={hoveredNode === id ? r + 5 : r} fill={color}
                fillOpacity={hoveredNode && hoveredNode !== id ? 0.35 : 1}
                style={{ transition: "r 0.15s ease, fill-opacity 0.15s ease" }} />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                fill="white" fontSize={11} fontWeight={600} pointerEvents="none">
                {label}
              </text>
              {hoveredNode === id && (
                <>
                  <rect x={x + r + 8} y={y - 15} width={126} height={30} rx={6} fill="white" stroke="#e2e8f0" strokeWidth={1} />
                  <text x={x + r + 71} y={y} textAnchor="middle" dominantBaseline="central" fill="#475569" fontSize={11} fontWeight={500}>
                    3 connected items
                  </text>
                </>
              )}
            </g>
          ))}
        </svg>
      </div>
    </Card>
  );
}

function TeamSection() {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Your Team</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MOCK_DATA.teamMembers.map(({ initials, name, role, color, why }) => (
          <div key={name} style={{ minWidth: "220px" }} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex-shrink-0">
            <div className="flex items-center gap-2.5 mb-3">
              <Avatar initials={initials} color={color} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{name}</p>
                <p className="text-xs text-slate-400 truncate">{role}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{why}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocsSection() {
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const tagVariant = (tag: string): "indigo" | "amber" | "slate" =>
    tag === "Read First" ? "indigo" : tag === "Important" ? "amber" : "slate";

  return (
    <div className="mb-24 md:mb-8">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Documents</h2>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                {["Name","Tag","Last Modified","Action"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_DATA.documents.map(({ name, tag, modified }) => (
                <tr key={name} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{name}</td>
                  <td className="px-4 py-3"><Badge variant={tagVariant(tag)}>{tag}</Badge></td>
                  <td className="px-4 py-3 text-slate-400">{modified}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setActiveDoc(activeDoc === name ? null : name)} aria-label={`Preview ${name}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">
                      Preview <ExternalLink size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {activeDoc && (() => {
          const doc = MOCK_DATA.documents.find((d) => d.name === activeDoc);
          return (
            <motion.div key="slide-over"
              initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl z-50 flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate pr-4">{activeDoc}</h3>
                <button onClick={() => setActiveDoc(null)} aria-label="Close preview"
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <X size={16} className="text-slate-500" />
                </button>
              </div>
              <div className="flex-1 p-5 overflow-y-auto">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500 mb-3 flex items-center gap-1.5">
                  <Sparkles size={11} /> AI Summary
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{doc?.summary}</p>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

function AIChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [showDots, setShowDots] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamText, showDots]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg = text.trim();
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    setInput("");
    setShowDots(true);
    const response = MOCK_DATA.aiResponses[userMsg] ?? "I don't have specific information on that yet, but I can help you find the right person. Try checking with Sarah Chen or reviewing the Engineering Handbook in your Documents tab.";
    const words = response.split(" ");
    let i = 0;
    setTimeout(() => {
      setShowDots(false);
      setStreaming(true);
      setStreamText("");
      const interval = setInterval(() => {
        if (i < words.length) { setStreamText((t) => (t ? t + " " + words[i] : words[i])); i++; }
        else {
          clearInterval(interval);
          setMessages((m) => [...m, { role: "ai", text: response }]);
          setStreamText(""); setStreaming(false);
        }
      }, 40);
    }, 750);
  }, [streaming]);

  const showSuggestions = messages.length === 0 && !streaming && !showDots;

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="chat"
          initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="fixed inset-y-0 right-0 w-full sm:w-[360px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
                <Sparkles size={12} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">Ask Onboard</span>
            </div>
            <button onClick={onClose} aria-label="Close chat"
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <X size={16} className="text-slate-500" />
            </button>
          </div>

          {showSuggestions && (
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 mb-3">Suggested questions</p>
              <div className="flex flex-wrap gap-2">
                {MOCK_DATA.suggestedPrompts.map((p) => (
                  <button key={p} onClick={() => sendMessage(p)} aria-label={p}
                    className="text-xs rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" && (
                  <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Sparkles size={10} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[86%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-sm"
                }`}>{msg.text}</div>
              </div>
            ))}
            {showDots && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={10} className="text-white" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                  {[0,1,2].map((i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            {streaming && streamText && (
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles size={10} className="text-white" />
                </div>
                <div className="max-w-[86%] bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {streamText}<span className="inline-block w-0.5 h-[14px] bg-indigo-400 ml-0.5 animate-pulse align-middle" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your company…" aria-label="Chat input"
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors" />
              <button type="submit" aria-label="Send message" disabled={!input.trim() || streaming}
                className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <Send size={14} className="text-white" />
              </button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Dashboard({ onBackToLanding }: { onBackToLanding: () => void }) {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [dark, toggleDark] = useDarkMode();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} onBackToLanding={onBackToLanding} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex justify-end mb-5">
            <button onClick={toggleDark} aria-label="Toggle dark mode"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              {dark ? <Sun size={15} className="text-slate-500" /> : <Moon size={15} className="text-slate-500" />}
            </button>
          </div>
          <WelcomeHeader />
          <AIBriefCard />
          <ContextGraph />
          <TeamSection />
          <DocsSection />
        </div>
      </main>
      <MobileBottomNav activeNav={activeNav} setActiveNav={setActiveNav} />
      <button onClick={() => setChatOpen(true)} aria-label="Open AI assistant"
        className="fixed bottom-20 md:bottom-6 right-6 w-12 h-12 rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-500 hover:shadow-lg transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 z-30">
        <MessageCircle size={20} />
      </button>
      <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

function Landing({ onEnterDashboard }: { onEnterDashboard: () => void }) {
  const [dark, toggleDark] = useDarkMode();
  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
              <Sparkles size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Onboard</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleDark} aria-label="Toggle dark mode"
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              {dark ? <Sun size={15} className="text-slate-500" /> : <Moon size={15} className="text-slate-500" />}
            </button>
            <Button variant="ghost" onClick={onEnterDashboard} aria-label="Sign in">Sign in</Button>
            <Button onClick={onEnterDashboard} aria-label="Get started">Get started</Button>
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto">
        <Hero onEnterDashboard={onEnterDashboard} />
        <Features />
      </div>
      <HowItWorks />
      <div className="max-w-5xl mx-auto">
        <BeforeAfter />
      </div>
      <Testimonials />
      <div className="max-w-5xl mx-auto">
        <Footer onEnterDashboard={onEnterDashboard} />
      </div>
    </div>
  );
}

export default function Onboard() {
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
        ? <Landing onEnterDashboard={() => setView("auth")} />
        : <Dashboard onBackToLanding={() => { clearAuth(); setView("landing"); }} />
      }
    </>
  );
}
