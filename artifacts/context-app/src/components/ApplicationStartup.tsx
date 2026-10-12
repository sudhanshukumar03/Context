import { Component, useEffect, useState, type ReactNode } from "react";

export function ApplicationStatus({ failed = false, title, message, contained = false, recoveryHref }: {
  failed?: boolean; title?: string; message?: string; contained?: boolean; recoveryHref?: string;
}) {
  return <div className={`${contained ? "w-full max-w-md" : "min-h-[100dvh]"} flex items-center justify-center bg-slate-950 px-6 py-10 text-slate-100`}>
    <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-7" role={failed ? "alert" : "status"} aria-live="polite">
      <p className="mb-5 text-sm font-semibold tracking-wide text-indigo-300">Context</p>
      <h1 className="text-xl font-semibold leading-tight">{title ?? (failed ? "Unable to open Context" : "Opening your workspace")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{message ?? (failed
        ? "The page could not finish loading. Check your connection, then try again."
        : "Loading secure sign-in. This may take a moment.")}</p>
      {failed && recoveryHref ? <a href={recoveryHref}
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">Open Context</a> : failed ? <button type="button" onClick={() => window.location.reload()}
        className="mt-6 min-h-11 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">Try again</button> : null}
      <p className="mt-5 text-xs leading-relaxed text-slate-400">If this page stays here, open it in your regular browser.</p>
    </section>
  </div>;
}

export function AuthenticationLoading({ contained = false }: { contained?: boolean }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setSlow(true), 15_000);
    return () => window.clearTimeout(timeout);
  }, []);
  return <ApplicationStatus contained={contained} failed={slow}
    title={slow ? "Sign-in is taking longer than expected" : "Loading secure sign-in"}
    message={slow ? "Check your connection and try again. If loading finishes, the sign-in form will appear automatically." : "Connecting to sign-in. Your workspace will open when it is ready."} />;
}

export class ApplicationErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <ApplicationStatus failed /> : this.props.children; }
}
