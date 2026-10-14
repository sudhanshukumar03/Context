import { useEffect, useState, type ReactNode } from "react";

/** Visit lazily, then preserve drafts and requests until the workspace unmounts. */
export default function PersistedTabPanel({ active, id, labelledBy, children }: {
  active: boolean; id: string; labelledBy: string; children: ReactNode;
}) {
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  if (!active && !visited) return null;
  return <div role="tabpanel" id={id} aria-labelledby={labelledBy} hidden={!active}>{children}</div>;
}
