import React from "react";
import { motion } from "framer-motion";
import { Package, Database, Shield, Radio, Server } from "lucide-react";

export function Card({
  children,
  className = "",
  onClick,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glow?: string;
}) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { y: -2, transition: { duration: 0.15 } } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      className={`rounded-2xl backdrop-blur-sm ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{
        background: "var(--ctx-surface)",
        border: "1px solid var(--ctx-border)",
        ...(glow ? { boxShadow: `0 0 20px ${glow}22, 0 0 60px ${glow}08` } : {}),
      }}
    >
      {children}
    </motion.div>
  );
}

export const STATUS_COLOR: Record<string, string> = {
  healthy: "#22c55e",
  at_risk: "#f59e0b",
  degraded: "#f97316",
  failing: "#ef4444",
};

export const STATUS_BG: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  at_risk: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  degraded: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  failing: "bg-red-500/10 text-red-400 border-red-500/20",
};

export const SEVERITY_BG: Record<string, string> = {
  info: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium ${
        STATUS_BG[status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20"
      }`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: STATUS_COLOR[status] ?? "#64748b" }}
      />
      {status.replace("_", " ")}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${
        SEVERITY_BG[severity] ?? SEVERITY_BG.info
      }`}
    >
      {severity}
    </span>
  );
}

export const SERVICE_ICONS: Record<string, React.ElementType> = {
  checkout: Package,
  payments: Database,
  database: Database,
  auth: Shield,
  notification: Radio,
  default: Server,
};

export function serviceIcon(name: string): React.ElementType {
  const k = name.toLowerCase();
  for (const [kw, v] of Object.entries(SERVICE_ICONS)) {
    if (k.includes(kw)) return v;
  }
  return SERVICE_ICONS.default;
}
