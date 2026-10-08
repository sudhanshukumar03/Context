import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, X, CheckCircle2, RefreshCw } from "lucide-react";

export const SCENARIO_STEPS = [
  { label: "System healthy", detail: "All 5 services nominal. Baseline established." },
  { label: "Webhook misconfigured", detail: "Payments API v2.4.1 deployed with wrong STRIPE_WEBHOOK_URL." },
  { label: "Payments API failing", detail: "503 errors at 34%. p99 latency > 8s. Customers impacted." },
  { label: "Retry storm begins", detail: "Clients hammering Payments API. 10× traffic amplification." },
  { label: "Database degrading", detail: "Connection pool at 94%. Retry storm holding connections open." },
  { label: "Checkout impacted", detail: "15% order failure rate. ~$12k/hr revenue impact." },
  { label: "AI identifies root cause", detail: "94% confidence — v2.4.1 deployment. Rollback recommended." },
  { label: "Rollback applied", detail: "v2.4.0 being restored. Service temporarily degraded." },
  { label: "System recovering", detail: "All services healthy. Incident resolved in 23 minutes." },
];

export function DemoScenarioPanel({
  onClose,
  onStepComplete,
}: {
  onClose: () => void;
  onStepComplete: (step: number) => void;
}) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advanceStep = useCallback(
    (step: number) => {
      setCurrentStep(step);
      onStepComplete(step);
      if (step < SCENARIO_STEPS.length - 1) {
        timerRef.current = setTimeout(() => advanceStep(step + 1), 4500);
      } else {
        setRunning(false);
        setDone(true);
      }
    },
    [onStepComplete]
  );

  const start = useCallback(() => {
    setRunning(true);
    setDone(false);
    setCurrentStep(0);
    onStepComplete(0);
    timerRef.current = setTimeout(() => advanceStep(1), 4500);
  }, [advanceStep, onStepComplete]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const progress = currentStep >= 0 ? ((currentStep + 1) / SCENARIO_STEPS.length) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl border border-indigo-500/20 bg-slate-900/95 backdrop-blur-sm p-5 shadow-2xl"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <Play size={14} className="text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Demo Scenario</h3>
            <p className="text-[11px] text-slate-500">Checkout → Payments → Database incident</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300">
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
          <span>Progress</span>
          <span>{currentStep >= 0 ? currentStep + 1 : 0}/{SCENARIO_STEPS.length} steps</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-indigo-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto mb-4">
        {SCENARIO_STEPS.map((step, i) => {
          const complete = i < currentStep;
          const active = i === currentStep;
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-all ${
                active ? "bg-indigo-500/8 border border-indigo-500/15" : complete ? "opacity-50" : "opacity-30"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  complete
                    ? "bg-emerald-500"
                    : active
                    ? "bg-indigo-600 ring-2 ring-indigo-500/30"
                    : "bg-white/10"
                }`}
              >
                {complete ? (
                  <CheckCircle2 size={10} className="text-white" />
                ) : (
                  <span className="text-[9px] text-white font-bold">{i + 1}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-medium ${active ? "text-white" : complete ? "text-slate-500" : "text-slate-600"}`}>
                  {step.label}
                </p>
                {active && <p className="text-[11px] text-indigo-300 mt-0.5">{step.detail}</p>}
              </div>
              {active && running && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="flex-shrink-0"
                >
                  <RefreshCw size={11} className="text-indigo-400" />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {done ? (
        <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/15 px-4 py-3 text-center">
          <CheckCircle2 size={16} className="text-emerald-400 mx-auto mb-1" />
          <p className="text-xs font-semibold text-emerald-400">Demo complete! Explore all 4 tabs to see the full picture.</p>
        </div>
      ) : (
        <button
          onClick={start}
          disabled={running}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 transition-all"
        >
          {running ? (
            <>
              <RefreshCw size={13} className="animate-spin" />Running scenario…
            </>
          ) : (
            <>
              <Play size={13} />Start demo scenario
            </>
          )}
        </button>
      )}
    </motion.div>
  );
}
