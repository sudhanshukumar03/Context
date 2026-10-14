import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send, Copy, Check, ChevronDown, ArrowRight, RefreshCw, Plus } from "lucide-react";
import AnalysisAnswer, { formatAnswerForCopy, type Answer } from "./AnalysisAnswer";
import { useAuth } from "../../lib/auth-session";
import AiRequestStatus from "../../components/AiRequestStatus";
import { abortable } from "../../lib/abortable";
import { AUDIENCES } from "../overview/audience";
import type { Role, AutoInsight } from "../../types";

type Message = { id: number; role: "user" | "ai"; text: string; answer?: Answer; error?: boolean; view?: Role };
type Request = (path: string, token: string | null, options?: RequestInit) => Promise<unknown>;
const STARTERS: Record<Role, string[]> = {
  engineer: ["What changed before the latest alert?", "Which service should I investigate first?"],
  sre: ["Summarize the current service health", "Explain the latest incident in time order"],
  manager: ["Summarize the customer impact", "What do we know about recovery?"],
};

export default function AIAssistant({ role, request, context, onNavigate, active = true }: { role: Role; request: Request; context: { services: number; affected: number; records: number }; onNavigate: (view: "timeline" | "graph") => void; active?: boolean }) {
  const { getToken, user, orgId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]), [input, setInput] = useState("");
  const [loading, setLoading] = useState(false), [phase, setPhase] = useState<"preparing" | "answer">("preparing");
  const [insights, setInsights] = useState<AutoInsight[]>([]), [insightsLoading, setInsightsLoading] = useState(true);
  const [copied, setCopied] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0), pending = useRef(false), controller = useRef<AbortController | null>(null), sequence = useRef(0);
  const copyReset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const questionInput = useRef<HTMLInputElement>(null);
  const resetChat = useCallback(() => {
    generation.current++; controller.current?.abort(); controller.current = null; pending.current = false;
    if (copyReset.current) { clearTimeout(copyReset.current); copyReset.current = null; }
    setMessages([]); setInput(""); setLoading(false); setRefreshing(false); setCopied(null); setPhase("preparing");
  }, []);
  useEffect(() => {
    resetChat();
    return () => { generation.current++; controller.current?.abort(); if (copyReset.current) clearTimeout(copyReset.current); };
  }, [user?.id, orgId, resetChat]);
  useEffect(() => {
    const abort = new AbortController(); let active = true;
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(60_000)]);
    setInsights([]); setInsightsLoading(true);
    void (async () => { try { const token = await abortable(getToken(), signal); if (!active) return; const data = await request("/ai/auto-insights", token, { signal }); if (active) setInsights(data as AutoInsight[]); } catch { /* signals are secondary; conversation remains usable */ } finally { if (active) setInsightsLoading(false); } })();
    return () => { active = false; abort.abort(); };
  }, [getToken, user?.id, orgId, request]);
  useEffect(() => {
    if (!active || !transcript.current) return;
    const container = transcript.current;
    const latestAnswer = Array.from(container.querySelectorAll<HTMLElement>(".ctx-answer")).at(-1);
    if (!loading && messages.at(-1)?.role === "ai" && latestAnswer) {
      // Start long reports at their summary rather than skipping to the final section.
      container.scrollTop += latestAnswer.getBoundingClientRect().top - container.getBoundingClientRect().top - 24;
    } else container.scrollTop = container.scrollHeight;
  }, [messages, loading, active]);
  const ask = useCallback(async (question: string, refresh = false) => {
    const text = question.trim(); if (!text || pending.current) return;
    pending.current = true; const started = generation.current;
    const abort = new AbortController(); controller.current = abort;
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(60_000)]);
    const isCurrent = () => generation.current === started && !abort.signal.aborted;
    if (!refresh) setInput("");
    // Refresh replaces only the latest response; earlier turns and the draft stay intact.
    const message: Message = { id: sequence.current++, role: "user", text };
    setMessages(current => refresh ? current.slice(0, current.findLastIndex(item => item.role === "user") + 1) : [...current, message]);
    setCopied(null); setLoading(true); setRefreshing(refresh); setPhase("preparing");
    try {
      const token = await abortable(getToken(), signal); if (!isCurrent()) return; setPhase("answer");
      const data = await request("/ai/incident-ask", token, { method: "POST", body: JSON.stringify({ question: text, role }), signal }) as Answer;
      if (isCurrent()) setMessages(current => [...current, { id: sequence.current++, role: "ai", text: data.answer, answer: data, view: role }]);
    } catch (error) { if (isCurrent()) setMessages(current => [...current, { id: sequence.current++, role: "ai", text: error instanceof DOMException && error.name === "TimeoutError" ? "The AI response took too long. Send your question again." : error instanceof Error ? error.message : "The answer could not be generated. Try another question.", error: true }]); }
    finally { if (generation.current === started) { pending.current = false; controller.current = null; setLoading(false); setRefreshing(false); } }
  }, [getToken, request, role]);
  const copy = async (message: Message) => {
    const started = generation.current;
    try { await navigator.clipboard.writeText(message.answer ? formatAnswerForCopy(message.answer, message.view || "sre") : message.text); if (generation.current !== started) return; setCopied(message.id); if (copyReset.current) clearTimeout(copyReset.current); copyReset.current = setTimeout(() => setCopied(null), 1800); } catch { /* native clipboard availability is browser-dependent */ }
  };
  const latestQuestion = messages.findLast(message => message.role === "user");
  const anomalies = insights.filter(item => item.severity !== "info");
  return <div className="ctx-assistant-layout">
    <section className="ctx-panel ctx-assistant-main" aria-label="Ask Context AI">
      <div className="ctx-assistant-heading"><span className="ctx-ai-avatar"><Bot size={22} aria-hidden="true" /></span><div className="ctx-assistant-title"><h3>Ask Context</h3><span className="ctx-badge ctx-status-info">{role === "sre" ? "SRE" : role === "manager" ? "Manager" : "Engineer"} view</span></div><div className="ctx-assistant-actions" role="group" aria-label="Chat controls"><button type="button" className="ctx-secondary-button" disabled={loading || !latestQuestion} title="Regenerate the latest answer using current workspace data" aria-label={refreshing ? "Refreshing latest answer" : "Refresh latest answer"} aria-busy={refreshing} onClick={() => { if (latestQuestion) void ask(latestQuestion.text, true); }}><RefreshCw size={16} aria-hidden="true" /><span>Refresh</span></button><button type="button" className="ctx-secondary-button" title="Clear this conversation and start a new chat" onClick={() => { resetChat(); questionInput.current?.focus(); }}><Plus size={16} aria-hidden="true" /><span>New chat</span></button></div></div>
      <div ref={transcript} className="ctx-conversation" role="log" aria-label="Incident conversation" aria-live="polite" aria-relevant="additions">
        {!messages.length && <div className="ctx-assistant-empty"><h4>{role === "manager" ? "Prepare a stakeholder update" : role === "engineer" ? "Start with a change or symptom" : "What needs attention?"}</h4><p>Choose a starting question or ask your own.</p><div className="ctx-starter-questions">{STARTERS[role].map(question => <button key={question} disabled={loading} className="ctx-secondary-button" onClick={() => void ask(question)}>{question}<ArrowRight size={16} aria-hidden="true" /></button>)}</div></div>}
        {messages.map(message => message.role === "user" ? <div key={message.id} className="ctx-user-question"><span>You</span><p>{message.text}</p></div> : <article key={message.id} className={`ctx-answer ${message.error ? "ctx-answer-error" : ""}`}>
          <div className="ctx-answer-heading"><span><Bot size={16} aria-hidden="true" />{message.error ? "Unable to answer" : `Context AI · ${message.view === "manager" ? "Manager" : message.view === "engineer" ? "Engineer" : "SRE"} view`}</span><button className="ctx-icon-button" aria-label={copied === message.id ? "Response copied" : "Copy response"} onClick={() => void copy(message)}>{copied === message.id ? <Check size={16} /> : <Copy size={16} />}</button></div>
          {message.answer ? <AnalysisAnswer answer={message.answer} role={message.view || "sre"} messageId={message.id} /> : <div className="ctx-answer-text" role={message.error ? "alert" : undefined}>{message.text.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>}
        </article>)}
        {loading && <AiRequestStatus phase={phase} />}
      </div>
      <div className="ctx-composer"><label htmlFor="incident-question">Your question</label><form onSubmit={event => { event.preventDefault(); void ask(input); }}><input ref={questionInput} id="incident-question" name="question" className="ctx-input" autoComplete="off" value={input} onChange={event => setInput(event.target.value)} aria-describedby="incident-question-hint" placeholder={AUDIENCES[role].placeholder} /><button type="submit" className="ctx-primary-button" disabled={!input.trim() || loading} aria-label={loading ? "Waiting for AI response" : "Send question"}><Send size={18} aria-hidden="true" /><span>Send</span></button></form><p id="incident-question-hint">Answers use this workspace's service graph and recorded events.</p></div>
    </section>
    <aside className="ctx-assistant-sidebar"><section className="ctx-ai-guide"><h3>Workspace context</h3><dl className="ctx-context-facts"><div><dt>Services recorded</dt><dd>{context.services}</dd></div><div><dt>Need attention</dt><dd className={context.affected ? "ctx-status-warning" : ""}>{context.affected}</dd></div><div><dt>Activity records</dt><dd>{context.records}</dd></div></dl><nav className="ctx-context-links" aria-label="AI investigation references"><button onClick={() => onNavigate("timeline")}><span>Review the timeline</span><ArrowRight size={16} aria-hidden="true" /></button><button onClick={() => onNavigate("graph")}><span>Trace dependencies</span><ArrowRight size={16} aria-hidden="true" /></button></nav><p className="ctx-footnote">Answers and suggested steps are guidance. Review the evidence before taking action.</p></section><details className="ctx-workspace-signals"><summary><div><strong>Automated signals</strong><span>{insightsLoading ? "Checking recorded signals…" : anomalies.length ? `${anomalies.length} signal${anomalies.length === 1 ? "" : "s"} to review` : insights.length ? "No anomalies reported" : "No signal summary available"}</span></div><ChevronDown size={18} aria-hidden="true" /></summary><div>{insights.map((item, i) => <article key={i}><h4>{item.title}</h4><p>{item.description}</p>{!!item.affectedServices.length && <p className="ctx-footnote">Services: {item.affectedServices.join(", ")}</p>}</article>)}</div></details></aside>
  </div>;
}
