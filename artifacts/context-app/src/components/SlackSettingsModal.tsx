import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import { useAuth } from "../lib/auth-session";
import { isSlackWebhookUrl } from "../lib/workspace-preferences";
import { sendWorkspaceSlack, type SlackApiRequest } from "../lib/slack-notifications";

export default function SlackSettingsModal({ onClose, onSave, current, request }: {
  onClose: () => void; onSave: (url: string) => void; current: string; request: SlackApiRequest;
}) {
  const [url, setUrl] = useState(current);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "err" | null>(null);
  const { getToken, user, orgId, orgRole } = useAuth();
  const canManage = !orgId || orgRole === "org:admin";
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    pending.current = false; setTesting(false); setTestResult(null);
    return () => { generation.current++; };
  }, [user?.id, orgId, orgRole]);

  const testWebhook = async () => {
    if (!canManage || pending.current) return;
    if (!isSlackWebhookUrl(url)) { setTestResult("err"); return; }
    const started = generation.current;
    const isCurrent = () => generation.current === started;
    pending.current = true; setTesting(true); setTestResult(null);
    try {
      const sent = await sendWorkspaceSlack(url, "✅ Context is connected! You'll receive incident alerts here.", getToken, isCurrent, request);
      if (isCurrent()) setTestResult(sent ? "ok" : null);
    } catch { if (isCurrent()) setTestResult("err"); }
    finally { if (isCurrent()) { pending.current = false; setTesting(false); } }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1629] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4A154B] flex items-center justify-center"><MessageSquare size={13} className="text-white" /></div>
            <h2 className="text-sm font-semibold text-white">Slack Notifications</h2>
          </div>
          <button onClick={onClose} aria-label="Close Slack settings" className="min-h-11 min-w-11 flex items-center justify-center text-slate-600 hover:text-white"><X size={16} /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">Paste your Slack Incoming Webhook URL. Context will send a message whenever a new incident is detected.</p>
        <div className="space-y-3">
          <label htmlFor="slack-webhook-url" className="block text-xs text-slate-300">Webhook URL</label>
          <input id="slack-webhook-url" value={url} onChange={e => { setUrl(e.target.value); setTestResult(null); }}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full rounded-xl bg-slate-800/80 border border-white/10 text-xs text-white placeholder:text-slate-600 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono" />
          {testResult === "ok" && <p role="status" className="text-xs text-emerald-400">✓ Test message sent — check your Slack channel</p>}
          {testResult === "err" && <p role="alert" className="text-xs text-red-400">✗ Could not reach Slack — check the URL</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={testWebhook} disabled={!canManage || testing || !isSlackWebhookUrl(url)}
              className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-300 py-2.5 transition-all disabled:opacity-40">
              {testing ? "Testing…" : "Send test message"}
            </button>
            <button onClick={() => { if (canManage && isSlackWebhookUrl(url)) { onSave(url); onClose(); } }} disabled={!canManage || testing || !isSlackWebhookUrl(url)}
              className="min-h-11 flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white py-2.5 transition-all disabled:opacity-40">Save</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
