import { useEffect, useRef, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

/** Native disclosure: Enter/Space opens it, Tab visits actions, Escape closes. */
export default function WorkspaceActions({ children }: { children: ReactNode }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !disclosure.current?.contains(event.target) && disclosure.current) disclosure.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  const close = (restoreFocus: boolean) => {
    if (disclosure.current) disclosure.current.open = false;
    if (restoreFocus) trigger.current?.focus();
  };
  return (
    <details ref={disclosure} className="ctx-workspace-actions relative"
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(true); } }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(false); }}>
      <summary ref={trigger} className="ctx-header-button cursor-pointer list-none" aria-label="Workspace actions" title="Workspace actions">
        <MoreHorizontal size={20} aria-hidden="true" />
      </summary>
      <div className="ctx-actions-panel absolute right-0 top-full mt-2 z-50 rounded-2xl border p-2 shadow-xl"
        onClick={event => { if ((event.target as HTMLElement).closest("button:not(:disabled)")) close(true); }}>
        <p className="ctx-muted px-3 py-2 text-xs font-semibold uppercase tracking-wider">Workspace actions</p>
        {children}
      </div>
    </details>
  );
}
