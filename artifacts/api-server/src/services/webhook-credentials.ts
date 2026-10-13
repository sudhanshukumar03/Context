import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, organizations, users, webhookKeys } from "@workspace/db";
import type { Request } from "express";

export function hashWebhookKey(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createWebhookKey() {
  const token = `ctx_wh_${randomBytes(32).toString("hex")}`;
  return { token, tokenHash: hashWebhookKey(token), prefix: token.slice(0, 15) };
}

export async function resolveWebhookOrganization(req: Request): Promise<number | null> {
  const token = req.headers["x-api-key"] ?? req.headers.authorization?.replace(/^Bearer\s+/i, "")
    ?? req.query.apiKey ?? req.query.apikey;
  if (typeof token !== "string" || !/^ctx_wh_[a-f0-9]{64}$/.test(token)) return null;
  const [key] = await db.select({ organizationId: webhookKeys.organizationId, personalOrganizationId: users.organizationId,
    clerkUserId: users.clerkUserId, organizationSlug: organizations.slug })
    .from(webhookKeys).innerJoin(users, eq(users.id, webhookKeys.userId))
    .innerJoin(organizations, eq(organizations.id, webhookKeys.organizationId))
    .where(and(eq(webhookKeys.tokenHash, hashWebhookKey(token)), isNull(webhookKeys.revokedAt))).limit(1);
  if (!key) return null;
  if (!key.organizationSlug.startsWith("clerk-org-")) return key.personalOrganizationId === key.organizationId ? key.organizationId : null;
  if (!process.env.CLERK_SECRET_KEY || !key.clerkUserId) return null;
  // Check current membership for each shared key use, including after removal/demotion.
  const organizationId = key.organizationSlug.slice("clerk-org-".length);
  const url = new URL(`https://api.clerk.com/v1/organizations/${encodeURIComponent(organizationId)}/memberships`);
  // Clerk uses repeated user_id parameters, not bracket-suffixed array keys.
  // An ignored filter plus limit=1 can otherwise return a different member.
  url.searchParams.append("user_id", key.clerkUserId); url.searchParams.set("limit", "1");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` }, signal: AbortSignal.timeout(5000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Webhook membership verification unavailable");
  const result = await response.json() as { data?: { role?: string; public_user_data?: { user_id?: string } }[] };
  return Array.isArray(result.data) && result.data.some((membership) => membership.role === "org:admin"
    && membership.public_user_data?.user_id === key.clerkUserId) ? key.organizationId : null;
}
