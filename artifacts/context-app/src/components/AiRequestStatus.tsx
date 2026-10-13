import { useEffect, useState } from "react";

export default function AiRequestStatus({ phase }: { phase: "preparing" | "answer" }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const slow = phase === "answer" && elapsed >= 20;
  return (
    <div className="ctx-ai-status rounded-2xl border px-4 py-4 min-w-0" data-state="pending">
      <div className="flex items-center justify-between gap-4">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-semibold">
          {phase === "preparing" ? "Preparing your question…" : slow ? "Still waiting for the AI response…" : "Generating your answer…"}
        </p>
        <span className="ctx-muted text-xs tabular-nums whitespace-nowrap" aria-hidden="true">{elapsed}s</span>
      </div>
      <p className="ctx-muted text-sm leading-relaxed mt-1">
        {phase === "preparing" ? "Your answer will appear here." : "Responses can take up to a minute. Your question has been sent."}
      </p>
      <span className="ctx-ai-status-dots mt-3 flex gap-1.5" aria-hidden="true">
        <i /><i /><i />
      </span>
    </div>
  );
}
