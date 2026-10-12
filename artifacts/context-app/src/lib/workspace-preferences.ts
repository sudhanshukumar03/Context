export function slackStorageKey(userId: string, organizationId: string | null) {
  return `ctx-slack-webhook:${JSON.stringify([userId, organizationId])}`;
}

type StorageSource<T> = T | (() => T);
export function readSlackWebhook(storage: StorageSource<Pick<Storage, "getItem">>, userId: string, organizationId: string | null) {
  try { return (typeof storage === "function" ? storage() : storage).getItem(slackStorageKey(userId, organizationId)) ?? ""; }
  catch { return ""; }
}

export function saveSlackWebhook(storage: StorageSource<Pick<Storage, "setItem">>, userId: string, organizationId: string | null, value: string) {
  try { (typeof storage === "function" ? storage() : storage).setItem(slackStorageKey(userId, organizationId), value); return true; }
  catch { return false; }
}
export function isSlackWebhookUrl(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === "hooks.slack.com" && !url.port
      && !url.username && !url.password && !url.search && !url.hash
      && /^\/services\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname);
  } catch { return false; }
}
