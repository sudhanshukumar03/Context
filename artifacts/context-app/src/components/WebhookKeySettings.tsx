import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth-session";

type Key = { id: number; name: string; prefix: string };
export default function WebhookKeySettings() {
  const { getToken, orgId, orgRole } = useAuth();
  const canManage = !orgId || orgRole === "org:admin";
  const [keys, setKeys] = useState<Key[]>([]);
  const [secret, setSecret] = useState<{ id: number; token: string } | null>(null);
  const [name, setName] = useState("Monitoring");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("Loading webhook keys…");
  const mounted = useRef(true);
  const createButton = useRef<HTMLButtonElement>(null);
  async function request(path: string, method = "GET", body?: object, signal?: AbortSignal) {
    const token = await getToken();
    const response = await fetch(`/api/webhook-keys${path}`, { method, signal,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    const result = await response.json() as { data: unknown; error?: string };
    if (!response.ok) throw new Error(result.error || "Unable to manage webhook keys");
    return result.data;
  }
  useEffect(() => {
    mounted.current = true;
    setKeys([]); setSecret(null); setBusy(true); setMessage("Loading webhook keys…");
    if (!canManage) { setBusy(false); setMessage("An organization admin can create and revoke webhook keys."); return; }
    const controller = new AbortController();
    request("", "GET", undefined, controller.signal).then((data) => {
      if (!controller.signal.aborted && mounted.current) { setKeys(data as Key[]); setMessage(""); }
    }).catch((error) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Unable to load keys"); })
      .finally(() => { if (!controller.signal.aborted && mounted.current) setBusy(false); });
    return () => { mounted.current = false; controller.abort(); };
  }, [getToken, orgId, canManage]);
  async function create() {
    if (busy) return;
    setBusy(true); setMessage("Creating key…");
    try {
      const key = await request("", "POST", { name }) as Key & { token: string };
      if (!mounted.current) return;
      setKeys((current) => [{ id: key.id, name: key.name, prefix: key.prefix }, ...current]); setSecret({ id: key.id, token: key.token });
      setMessage("Key created. Copy it now; it is shown only once.");
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "Unable to create key"); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function revoke(id: number) {
    if (busy) return;
    setBusy(true); setMessage("Revoking key…");
    try {
      await request(`/${id}`, "DELETE");
      if (!mounted.current) return;
      setKeys((current) => current.filter((key) => key.id !== id));
      setSecret((current) => current?.id === id ? null : current); setMessage("Key revoked. It can no longer ingest events.");
      requestAnimationFrame(() => createButton.current?.focus());
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "Unable to revoke key"); }
    finally { if (mounted.current) setBusy(false); }
  }
  const control = "min-h-11 rounded-lg border px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-50";
  if (!canManage) return <p className="mt-3 text-sm" role="status">An organization admin can create and revoke webhook keys.</p>;
  return <section aria-labelledby="webhook-keys-title" aria-busy={busy} className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--ctx-border)", color: "var(--ctx-text)" }}>
    <h4 id="webhook-keys-title" className="text-sm font-semibold">Webhook keys</h4>
    <p className="mt-1 text-xs">Use a secret key in the X-API-Key header. User IDs are no longer accepted.</p>
    <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void create(); }}>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs">Key name
        <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} disabled={busy}
          className={`${control} w-full bg-transparent`} />
      </label>
      <button ref={createButton} type="submit" disabled={busy || !name.trim()} className={`${control} self-end bg-indigo-600 text-white`}>Create key</button>
    </form>
    <p role="status" aria-live="polite" className="mt-2 min-h-10 text-xs">{message}</p>
    {secret && <div className="mb-3 space-y-2">
      <label className="flex flex-col gap-1 text-xs">New secret key
        <input readOnly value={secret.token} onFocus={(event) => event.target.select()} className={`${control} w-full bg-transparent font-mono`} />
      </label>
      <button type="button" className={control} onClick={() => {
        void navigator.clipboard.writeText(secret.token).then(() => setMessage("Secret key copied."))
          .catch(() => setMessage("Copy unavailable. Select the key and copy it manually."));
      }}>Copy secret key</button>
    </div>}
    <ul className="space-y-2">{keys.map((key) => <li key={key.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="break-all">{key.name} · {key.prefix}…</span>
      <button type="button" disabled={busy} className={`${control} text-red-500`} aria-label={`Revoke ${key.name}`} onClick={() => void revoke(key.id)}>Revoke</button>
    </li>)}</ul>
  </section>;
}
