import { createHash } from "node:crypto";
import type { Request } from "express";

const MAX_ACTIVE_PER_TENANT = 4;
const MAX_ACTIVE_TOTAL = 32;
const inFlight = new Map<string, Promise<unknown>>();
const activeByTenant = new Map<string, number>();
let activeTotal = 0;

export function runAiTool(
  req: Pick<Request, "auth" | "path" | "body">,
  work: () => Promise<unknown>,
): Promise<unknown> {
  if (!req.auth) throw new Error("AI execution requires authentication");
  const { organizationId, userId } = req.auth;
  const tenant = organizationId === null ? `user:${userId}` : `org:${organizationId}`;
  const key = createHash("sha256").update(JSON.stringify([tenant, userId, req.path, req.body])).digest("hex");
  const existing = inFlight.get(key);
  if (existing) return existing;

  const tenantActive = activeByTenant.get(tenant) ?? 0;
  if (tenantActive >= MAX_ACTIVE_PER_TENANT || activeTotal >= MAX_ACTIVE_TOTAL) {
    throw new Error("AI concurrency limit reached");
  }
  activeByTenant.set(tenant, tenantActive + 1);
  activeTotal++;
  // Install the promise before invoking work so simultaneous submissions share it.
  // Retain only a hash and a pending result; completed responses are never cached.
  const pending = Promise.resolve().then(work).finally(() => {
    inFlight.delete(key);
    activeTotal--;
    const remaining = (activeByTenant.get(tenant) ?? 1) - 1;
    if (remaining === 0) activeByTenant.delete(tenant);
    else activeByTenant.set(tenant, remaining);
  });
  inFlight.set(key, pending);
  return pending;
}
