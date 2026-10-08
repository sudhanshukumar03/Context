import type { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, users, organizations } from "@workspace/db";
import { fail } from "../lib/response.js";
import { logger } from "../lib/logger.js";
import { verifyAccessToken } from "../lib/jwt.js";

export interface AuthPayload {
  userId: number;
  clerkUserId: string;
  organizationId: number | null;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

/**
 * Resolves or provisions a local user record for an external Clerk identity.
 * Invariant: Every authenticated user must belong to at least one organization.
 * Throws on database write failures.
 */
async function resolveDbUser(clerkUserId: string): Promise<AuthPayload> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (existing) {
    return {
      userId: existing.id,
      clerkUserId,
      organizationId: existing.organizationId ?? null,
      role: existing.role,
    };
  }

  // Suffix prevents slug collision when multiple Clerk accounts share similar prefix IDs.
  const [org] = await db
    .insert(organizations)
    .values({
      name: "My Organization",
      slug: `org-${clerkUserId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}-${crypto.randomUUID().slice(0, 6)}`,
      plan: "free",
    })
    .returning();

  // Clerk owns credentials; placeholder satisfies non-null DB constraint without storing a valid hash.
  const [user] = await db
    .insert(users)
    .values({
      clerkUserId,
      organizationId: org.id,
      email: `${clerkUserId}@context.app`,
      name: "New User",
      role: "backend",
      passwordHash: "clerk-managed",
    })
    .returning();

  logger.info({ userId: user.id, clerkUserId }, "auto-provisioned new user");

  return {
    userId: user.id,
    clerkUserId,
    organizationId: org.id,
    role: user.role,
  };
}

/**
 * Authenticates request via custom HS256 Bearer JWT or Clerk session.
 * Hydrates req.auth on success; halts request flow with 401/500 on failure.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      // Internal tokens take precedence to support API clients and tests without Clerk sessions.
      const payload = verifyAccessToken(token);
      const [dbUser] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      if (dbUser) {
        req.auth = {
          userId: dbUser.id,
          clerkUserId: dbUser.clerkUserId ?? `user_${dbUser.id}`,
          organizationId: dbUser.organizationId ?? null,
          role: dbUser.role,
        };
        return next();
      }
    } catch (tokenErr) {
      logger.debug({ tokenErr }, "Bearer token verification failed; falling back to Clerk");
    }
  }

  let clerkUserId: string | null | undefined;
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const auth = getAuth(req);
      clerkUserId = auth.userId;
    } catch {
      clerkUserId = null;
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      logger.fatal("CLERK_SECRET_KEY is missing in production environment");
      fail(res, "Authentication service unconfigured", 500);
      return;
    }
    const allowBypass = process.env.ALLOW_DEV_AUTH_BYPASS === "true";
    if (!allowBypass) {
      fail(res, "Unauthorized: authentication credentials required", 401);
      return;
    }
    clerkUserId = (req.headers["x-demo-user"] as string) || "user_local_dev";
  }

  if (!clerkUserId) {
    fail(res, "Unauthorized", 401);
    return;
  }

  try {
    req.auth = await resolveDbUser(clerkUserId);
    next();
  } catch (err) {
    logger.error({ err }, "auth resolve error");
    fail(res, "Authentication error", 500);
  }
}
