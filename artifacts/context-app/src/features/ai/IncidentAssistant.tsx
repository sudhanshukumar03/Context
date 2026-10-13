import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send, Copy, Check, ChevronDown, ArrowRight } from "lucide-react";
import { useAuth } from "../../lib/auth-session";
import AiRequestStatus from "../../components/AiRequestStatus";
import type { Role, AutoInsight } from "../../types";

type Answer = { answer: string; confidence: number; sources: string[]; reasoning: string[]; impact: string[]; actions: string[] };
type Message = { id: number; role: "user" | "ai"; text: string; answer?: Answer; error?: boolean };
type Request = (path: string, token: string | null, options?: RequestInit) => Promise<unknown>;
const STARTERS: Record<Role, string[]> = {
  engineer: ["What changed before the latest alert?", "Which service should I investigate first?"],
  sre: ["Summarize the current service health", "Explain the latest incident in time order"],
  manager: ["Summarize the customer impact", "What do we know about recovery?"],
};

export default function AIAssistant({ role, request }: { role: Role; request: Request }) {
  const { getToken, user, orgId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]), [input, setInput] = useState("");
  const [loading, setLoading] = useState(false), [phase, setPhase] = useState<"preparing" | "answer">("preparing");
  const [insights, setInsights] = useState<AutoInsight[]>([]), [insightsLoading, setInsightsLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);
  const generation = useRef(0), pending = useRef(false), controller = useRef<AbortController | null>(null), sequence = useRef(0);
  const copyReset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  useEffect(() => {
    generation.current++; controller.current?.abort(); pending.current = false;
    setMessages([]); setInput(""); setLoading(false); setCopied(null);
    return () => { generation.current++; controller.current?.abort(); if (copyReset.current) clearTimeout(copyReset.current); };
  }, [user?.id, orgId]);
  useEffect(() => {
    const abort = new AbortController(); let active = true;
    setInsights([]); setInsightsLoading(true);
    void (async () => { try { const token = await getToken(); if (!active) return; const data = await request("/ai/auto-insights", token, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(60_000)]) }); if (active) setInsights(data as AutoInsight[]); } catch { /* signals are secondary; conversation remains usable */ } finally { if (active) setInsightsLoading(false); } })();
    return () => { active = false; abort.abort(); };
  }, [getToken, user?.id, orgId, request]);
  useEffect(() => { if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight; }, [messages, loading]);
  const ask = useCallback(async (question: string) => {
    const text = question.trim(); if (!text || pending.current) return;
    pending.current = true; const started = generation.current;
    const abort = new AbortController(); controller.current = abort;
    const isCurrent = () => generation.current === started && !abort.signal.aborted;
    setInput(""); setMessages(current => [...current, { id: sequence.current++, role: "user", text }]); setLoading(true); setPhase("preparing");
    try {
      const token = await getToken(); if (!isCurrent()) return; setPhase("answer");
      const data = await request("/ai/incident-ask", token, { method: "POST", body: JSON.stringify({ question: text, role }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(60_000)]) }) as Answer;
      if (isCurrent()) setMessages(current => [...current, { id: sequence.current++, role: "ai", text: data.answer, answer: data }]);
    } catch (error) { if (isCurrent()) setMessages(current => [...current, { id: sequence.current++, role: "ai", text: error instanceof DOMException && error.name === "TimeoutError" ? "The AI response took too long. Send your question again." : error instanceof Error ? error.message : "The answer could not be generated. Try another question.", error: true }]); }
    finally { if (generation.current === started) { pending.current = false; setLoading(false); } }
  }, [getToken, request, role]);
  const copy = async (message: Message) => {
    try { await navigator.clipboard.writeText(message.text); setCopied(message.id); if (copyReset.current) clearTimeout(copyReset.current); copyReset.current = setTimeout(() => setCopied(null), 1800); } catch { /* native clipboard availability is browser-dependent */ }
  };
  const anomalies = insights.filter(item => item.severity !== "info");
  return <div className="ctx-assistant-layout">
    <section className="ctx-panel ctx-assistant-main" aria-label="Ask Context AI">
      <div className="ctx-assistant-heading"><span className="ctx-ai-avatar"><Bot size={22} aria-hidden="true" /></span><div><h3>Ask Context</h3><p>Understand this workspace's services and recorded activity.</p></div><span className="ctx-badge ctx-status-info">{role === "sre" ? "SRE" : role === "manager" ? "Manager" : "Engineer"} view</span></div>
      <div ref={transcript} className="ctx-conversation" role="log" aria-label="Incident conversation" aria-live="polite" aria-relevant="additions">
        {!messages.length && <div className="ctx-assistant-empty"><h4>Start with what you need to know</h4><p>Ask about service health, recent changes, affected services or the evidence behind an incident.</p><div className="ctx-starter-questions">{STARTERS[role].map(question => <button key={question} className="ctx-secondary-button" onClick={() => void ask(question)}>{question}<ArrowRight size={16} aria-hidden="true" /></button>)}</div></div>}
        {messages.map(message => message.role === "user" ? <div key={message.id} className="ctx-user-question"><span>You</span><p>{message.text}</p></div> : <article key={message.id} className={`ctx-answer ${message.error ? "ctx-answer-error" : ""}`}>
          <div className="ctx-answer-heading"><span><Bot size={16} aria-hidden="true" />{message.error ? "Unable to answer" : "Context AI"}</span><button className="ctx-icon-button" aria-label={copied === message.id ? "Response copied" : "Copy response"} onClick={() => void copy(message)}>{copied === message.id ? <Check size={16} /> : <Copy size={16} />}</button></div>
          <p className="ctx-answer-text" role={message.error ? "alert" : undefined}>{message.text}</p>
          {message.answer && <>
            {!!message.answer.impact?.length && <section className="ctx-answer-section"><h4>Impact</h4><ul>{message.answer.impact.map((item, i) => <li key={i}>{item}</li>)}</ul></section>}
            {!!message.answer.actions?.length && <section className="ctx-answer-section"><h4>Suggested next steps</h4><ol>{message.answer.actions.map((item, i) => <li key={i}>{item}</li>)}</ol></section>}
            <details className="ctx-answer-evidence"><summary>Reasoning & sources<span>{Math.round(Math.min(1, Math.max(0, message.answer.confidence || 0)) * 100)}% model confidence</span><ChevronDown size={16} aria-hidden="true" /></summary><div><h4>Reasoning</h4>{message.answer.reasoning?.length ? <ol>{message.answer.reasoning.map((item, i) => <li key={i}>{item}</li>)}</ol> : <p>No reasoning provided.</p>}<h4>Sources referenced</h4><ul>{message.answer.sources?.map((item, i) => <li key={i}>{item}</li>)}</ul></div></details>
          </>}
        </article>)}
        {loading && <AiRequestStatus phase={phase} />}
      </div>
      <div className="ctx-composer"><label htmlFor="incident-question">Your question</label><form onSubmit={event => { event.preventDefault(); void ask(input); }}><input id="incident-question" name="question" className="ctx-input" autoComplete="off" value={input} onChange={event => setInput(event.target.value)} aria-describedby="incident-question-hint" placeholder="What should I investigate?" /><button type="submit" className="ctx-primary-button" disabled={!input.trim() || loading} aria-label={loading ? "Waiting for AI response" : "Send question"}><Send size={18} aria-hidden="true" /><span>Send</span></button></form><p id="incident-question-hint">Answers use this workspace's service graph and recorded events.</p></div>
    </section>
    <aside className="ctx-assistant-sidebar"><section className="ctx-panel ctx-ai-guide"><h3>Keep the evidence in view</h3><p>Use Timeline for the sequence of events and Graph for dependency relationships. Ask AI to help explain them.</p><p className="ctx-footnote">Suggested next steps are guidance. Asking a question does not change service state.</p></section><details className="ctx-panel ctx-workspace-signals"><summary><div><strong>Workspace signals</strong><span>{insightsLoading ? "Checking recorded signals…" : anomalies.length ? `${anomalies.length} signal${anomalies.length === 1 ? "" : "s"} to review` : insights.length ? "No anomalies reported" : "No signal summary available"}</span></div><ChevronDown size={18} aria-hidden="true" /></summary><div>{insights.map((item, i) => <article key={i}><h4>{item.title}</h4><p>{item.description}</p>{!!item.affectedServices.length && <p className="ctx-footnote">Services: {item.affectedServices.join(", ")}</p>}</article>)}</div></details></aside>
  </div>;
}
