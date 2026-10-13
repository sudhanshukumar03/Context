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
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current?.showModal();
    if (window.matchMedia("(pointer: fine)").matches) dialog.current?.querySelector("input")?.focus();
    return () => {
      dialog.current?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
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
      <motion.dialog ref={dialog} aria-labelledby="slack-settings-title" aria-describedby="slack-settings-description"
        onCancel={event => { event.preventDefault(); onClose(); }}
        onKeyDown={event => {
          if (event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), [tabindex='0']"));
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}
        onClick={event => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
        }}
        initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="ctx-slack-dialog w-[calc(100%_-_2rem)] max-w-md rounded-2xl border p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4A154B] flex items-center justify-center"><MessageSquare size={13} className="text-white" /></div>
            <h2 id="slack-settings-title" className="text-base font-semibold">Slack Notifications</h2>
          </div>
          <button onClick={onClose} aria-label="Close Slack settings" className="min-h-11 min-w-11 flex items-center justify-center text-slate-600 hover:text-white"><X size={16} /></button>
        </div>
        <p id="slack-settings-description" className="text-sm text-slate-500 mb-4 leading-relaxed">Paste your Slack Incoming Webhook URL. Context will send a message whenever a new incident is detected.</p>
        <div className="space-y-3">
          <label htmlFor="slack-webhook-url" className="block text-sm text-slate-300">Webhook URL</label>
          <input id="slack-webhook-url" name="slack-webhook-url" type="url" autoComplete="off" spellCheck={false} value={url} onChange={e => { setUrl(e.target.value); setTestResult(null); }}
            placeholder="https://hooks.slack.com/services/..."
            className="ctx-input w-full min-h-12 rounded-xl border text-base placeholder:text-slate-600 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 font-mono" />
          {testResult === "ok" && <p role="status" className="text-xs text-emerald-400">✓ Test message sent — check your Slack channel</p>}
          {testResult === "err" && <p role="alert" className="text-xs text-red-400">✗ Could not reach Slack — check the URL</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={testWebhook} disabled={!canManage || testing || !isSlackWebhookUrl(url)}
              className="min-h-11 flex-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-slate-300 py-2.5 transition-colors disabled:opacity-40">
              {testing ? "Testing…" : "Send test message"}
            </button>
            <button onClick={() => { if (canManage && isSlackWebhookUrl(url)) { onSave(url); onClose(); } }} disabled={!canManage || testing || !isSlackWebhookUrl(url)}
              className="min-h-11 flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white py-2.5 transition-colors disabled:opacity-40">Save</button>
          </div>
        </div>
      </motion.dialog>
  );
}
