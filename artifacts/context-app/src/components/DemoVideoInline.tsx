import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Shared helpers ───────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: "easeOut" as const, delay },
});

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <motion.span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`}
      animate={pulse ? { opacity: [1, 0.3, 1], scale: [1, 1.25, 1] } : {}}
      transition={{ duration: 1.3, repeat: Infinity }}
    />
  );
}

// ─── Scene 1 — Critical alert fires ──────────────────────────────────────────
function Scene1() {
  const ALERTS = [
    { sev: "CRITICAL", msg: "payment-service latency p99 > 8000ms",   time: "14:02:11" },
    { sev: "CRITICAL", msg: "auth-service error rate > 42%",           time: "14:02:14" },
    { sev: "WARNING",  msg: "checkout-service queue depth > 12,000",   time: "14:02:17" },
    { sev: "WARNING",  msg: "notif-service: upstream connection refused", time: "14:02:21" },
  ];
  return (
    <div className="flex flex-col justify-center items-center h-full px-12 gap-5">
      <motion.p {...fadeUp(0.1)}
        className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
        Incoming alerts
      </motion.p>
      <div className="w-full max-w-xl flex flex-col gap-3">
        {ALERTS.map((a, i) => (
          <motion.div
            key={i}
            {...fadeUp(0.25 + i * 0.18)}
            className={`flex items-center gap-3 rounded-xl px-5 py-3.5 border
              ${a.sev === "CRITICAL"
                ? "bg-red-500/[0.08] border-red-500/25 shadow-[0_0_30px_rgba(239,68,68,0.08)]"
                : "bg-amber-500/[0.06] border-amber-500/20"}`}
          >
            <Dot color={a.sev === "CRITICAL" ? "bg-red-500" : "bg-amber-400"} pulse />
            <span className={`font-mono text-[10px] font-bold tracking-widest
              ${a.sev === "CRITICAL" ? "text-red-400" : "text-amber-400"}`}>
              {a.sev}
            </span>
            <span className="text-sm text-white/80 flex-1">{a.msg}</span>
            <span className="text-white/25 font-mono text-xs flex-shrink-0">{a.time} UTC</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Scene 2 — Cascade graph ──────────────────────────────────────────────────
const NODES = [
  { id: "db",      label: "db-pool",          sub: "postgres · pool",      color: "border-red-500/50   bg-red-500/[0.08]",    dot: "bg-red-500",    status: "FAILING",  x: "20%",  y: "30%" },
  { id: "auth",    label: "auth-service",      sub: "node · v18",           color: "border-red-500/50   bg-red-500/[0.08]",    dot: "bg-red-500",    status: "FAILING",  x: "55%",  y: "15%" },
  { id: "pay",     label: "payment-service",   sub: "go · v2.4.1",          color: "border-red-500/50   bg-red-500/[0.08]",    dot: "bg-red-500",    status: "FAILING",  x: "55%",  y: "48%" },
  { id: "checkout",label: "checkout-service",  sub: "node · v14",           color: "border-amber-400/50 bg-amber-400/[0.06]",  dot: "bg-amber-400",  status: "DEGRADED", x: "80%",  y: "30%" },
  { id: "notif",   label: "notif-service",     sub: "python · v3.11",       color: "border-yellow-400/40 bg-yellow-400/[0.05]",dot: "bg-yellow-400", status: "AT RISK",  x: "80%",  y: "60%" },
];
const EDGES = [
  { from: "db", to: "auth" }, { from: "db", to: "pay" },
  { from: "auth", to: "checkout" }, { from: "pay", to: "checkout" },
  { from: "pay", to: "notif" },
];

function Scene2() {
  return (
    <div className="flex flex-col justify-center items-center h-full px-8 gap-4">
      <motion.p {...fadeUp(0.1)}
        className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
        Dependency cascade map
      </motion.p>
      <div className="relative w-full max-w-2xl" style={{ height: 300 }}>
        {/* Edges */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {EDGES.map((e, i) => {
            const f = NODES.find(n => n.id === e.from)!;
            const t = NODES.find(n => n.id === e.to)!;
            const x1 = parseFloat(f.x) + 7, y1 = parseFloat(f.y) + 6;
            const x2 = parseFloat(t.x) + 7, y2 = parseFloat(t.y) + 6;
            return (
              <motion.line
                key={i}
                x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                stroke="rgba(239,68,68,0.25)" strokeWidth={1.5} strokeDasharray="4 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 + i * 0.12 }}
              />
            );
          })}
        </svg>
        {/* Nodes */}
        {NODES.map((n, i) => (
          <motion.div
            key={n.id}
            {...fadeUp(0.3 + i * 0.12)}
            className={`absolute flex items-center gap-2 border rounded-xl px-3 py-2.5 ${n.color}`}
            style={{ left: n.x, top: n.y, transform: "translate(-50%,-50%)" }}
          >
            <Dot color={n.dot} pulse={n.status === "FAILING"} />
            <div>
              <p className="text-xs font-medium text-white/90 leading-none">{n.label}</p>
              <p className="text-[9px] text-slate-600 mt-0.5">{n.sub}</p>
            </div>
            <span className={`text-[8px] font-bold uppercase tracking-wider ml-1
              ${n.status === "FAILING" ? "text-red-400"
              : n.status === "DEGRADED" ? "text-amber-400" : "text-yellow-400"}`}>
              {n.status}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Scene 3 — AI root cause analysis ────────────────────────────────────────
const EVIDENCE = [
  "db-pool connection limit hit at 14:02:08 UTC (3,200 concurrent connections)",
  "auth-service upstream timeouts cascade to 94% of auth requests",
  "payment-service v2.4.1 deployed at 13:54 UTC — 10× connection rate vs v2.4.0",
  "4,200 failed payment transactions in 9 min — revenue impact critical",
];

function Scene3() {
  return (
    <div className="flex flex-col justify-center items-center h-full px-12 gap-5">
      <motion.div {...fadeUp(0.05)}
        className="w-full max-w-2xl bg-indigo-500/[0.05] border border-indigo-500/20
                   rounded-2xl px-6 py-5 shadow-[0_0_60px_rgba(99,102,241,0.08)]">
        <div className="flex items-center gap-2.5 mb-4">
          <motion.div
            className="w-4 h-4 bg-[#6366F1] rounded-sm flex-shrink-0"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
          />
          <span className="text-[#6366F1] font-mono text-xs tracking-widest uppercase font-semibold">
            Context AI — Root Cause Analysis
          </span>
          <span className="ml-auto text-[10px] bg-indigo-500/15 border border-indigo-500/25
                           text-indigo-300 px-2 py-0.5 rounded-md font-mono">
            87% confidence
          </span>
        </div>
        <motion.div {...fadeUp(0.2)}>
          <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-1.5">Primary cause</p>
          <p className="text-sm text-white font-medium leading-relaxed">
            db-pool connection exhaustion triggered cascading timeouts across auth and payment — caused by
            Payments API v2.4.1 deployment at 13:54 UTC which increased connection rate 10×.
          </p>
        </motion.div>
        <motion.div {...fadeUp(0.4)} className="mt-4">
          <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-2">Evidence</p>
          <div className="space-y-2 border-l-2 border-indigo-500/25 pl-3.5">
            {EVIDENCE.map((e, i) => (
              <motion.p key={i} {...fadeUp(0.45 + i * 0.1)}
                className="text-[11px] text-slate-400 leading-relaxed flex gap-2">
                <span className="flex-shrink-0 text-indigo-500 font-bold">{i + 1}.</span>
                {e}
              </motion.p>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Scene 4 — Suggested fixes + revenue ─────────────────────────────────────
function Scene4() {
  const FIXES = [
    { label: "Rollback payment-service → v2.4.0",  tag: "primary",   eta: "~2 min" },
    { label: "Throttle retry rate on auth-service", tag: "secondary", eta: "~1 min" },
    { label: "Scale db-pool: 100 → 400 connections",tag: "secondary", eta: "~3 min" },
  ];
  return (
    <div className="flex flex-col justify-center items-center h-full px-12 gap-5">
      <motion.p {...fadeUp(0.1)}
        className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
        Suggested actions
      </motion.p>
      <div className="w-full max-w-xl flex flex-col gap-3">
        {FIXES.map((f, i) => (
          <motion.div key={i} {...fadeUp(0.2 + i * 0.15)}
            className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.07]
                       rounded-xl px-5 py-3.5">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border
              ${f.tag === "primary"
                ? "bg-indigo-600/80 border-indigo-500/50 text-white"
                : "bg-white/[0.04] border-white/10 text-slate-400"}`}>
              {f.tag}
            </span>
            <span className="text-sm text-white/85 flex-1">{f.label}</span>
            <span className="text-[10px] text-slate-600 font-mono flex-shrink-0">{f.eta}</span>
          </motion.div>
        ))}
        <motion.div {...fadeUp(0.7)}
          className="flex items-center justify-between px-5 py-3 mt-1
                     bg-red-500/[0.06] border border-red-500/20 rounded-xl">
          <span className="text-[10px] text-slate-500">Estimated revenue at risk</span>
          <span className="text-base font-bold text-red-400">~$14,200 · 9 min elapsed</span>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Scene 5 — Resolution / Postmortem ───────────────────────────────────────
function Scene5() {
  return (
    <div className="flex flex-col justify-center items-center h-full px-12 gap-6">
      <motion.div {...fadeUp(0.1)}
        className="flex flex-col items-center gap-3">
        <motion.div
          className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30
                     flex items-center justify-center"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
        <p className="text-xl font-semibold text-white">Incident resolved</p>
        <p className="text-sm text-slate-500 text-center max-w-sm">
          payment-service rolled back to v2.4.0 · all services nominal · postmortem auto-drafted
        </p>
      </motion.div>
      <motion.div {...fadeUp(0.4)}
        className="w-full max-w-md bg-white/[0.025] border border-white/[0.07] rounded-xl px-5 py-4">
        <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-3">Timeline</p>
        {[
          { t: "13:54", txt: "payment-service v2.4.1 deployed", c: "text-amber-400" },
          { t: "14:02", txt: "Context detected anomaly — 4 alerts in 10s", c: "text-red-400" },
          { t: "14:04", txt: "Root cause identified (87% confidence)", c: "text-indigo-400" },
          { t: "14:11", txt: "Rollback complete · all services green", c: "text-emerald-400" },
        ].map((row, i) => (
          <motion.div key={i} {...fadeUp(0.5 + i * 0.1)}
            className="flex items-center gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
            <span className="font-mono text-xs text-slate-600 w-10 flex-shrink-0">{row.t}</span>
            <span className={`text-xs ${row.c}`}>{row.txt}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Scene registry ───────────────────────────────────────────────────────────
const SCENES = [Scene1, Scene2, Scene3, Scene4, Scene5];
const SCENE_DURATION = 6000; // ms per scene

// ─── Main export ──────────────────────────────────────────────────────────────
export default function DemoVideoInline() {
  const [scene, setScene] = useState(0);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setDirection(1);
    setScene(s => (s + 1) % SCENES.length);
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(advance, SCENE_DURATION);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scene, advance]);

  const Current = SCENES[scene];

  return (
    <div className="relative w-full h-full bg-[#080c14] overflow-hidden text-white select-none font-sans">

      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.055]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_90%_80%_at_50%_50%,transparent_30%,#080c14_100%)]" />

      {/* Ambient glows */}
      <motion.div className="absolute w-[500px] h-[500px] rounded-full blur-[130px] pointer-events-none"
        style={{ top: "-120px", left: "-100px", background: "rgba(239,68,68,0.08)" }}
        animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 5, repeat: Infinity }} />
      <motion.div className="absolute w-[520px] h-[520px] rounded-full blur-[140px] pointer-events-none"
        style={{ bottom: "-140px", right: "-120px", background: "rgba(99,102,241,0.10)" }}
        animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 6, repeat: Infinity, delay: 2 }} />

      {/* Scene crossfade */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <Current />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
