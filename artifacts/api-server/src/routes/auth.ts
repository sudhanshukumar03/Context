import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { eq, and, gte, sql } from "drizzle-orm";
import { db, users, organizations, refreshTokens } from "@workspace/db";
import { z } from "zod";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiresAt,
  verifyAccessToken,
} from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { ok, fail } from "../lib/response.js";

const router = Router();
router.use("/auth", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.use(["/auth/register", "/auth/login", "/auth/refresh"], rateLimit({ windowMs: 60_000, limit: 20,
  standardHeaders: true, legacyHeaders: false, message: { success: false, data: null, error: "Too many authentication attempts. Try again shortly." } }));

const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).refine(value => Buffer.byteLength(value, "utf8") <= 72, "Password must fit within 72 UTF-8 bytes"),
  name: z.string().trim().min(1).max(200),
  role: z.enum(["backend", "frontend", "pm"]).default("backend"),
  organizationName: z.string().trim().min(1).max(200).optional(),
});

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string(),
});

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

function safeUser(u: typeof users.$inferSelect) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, organizationId: u.organizationId, createdAt: u.createdAt };
}

router.post("/auth/register", async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid request body"); return; }
  const { email, password, name, role, organizationName } = parsed.data;

  try {
    const existing = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (existing.length > 0) { fail(res, "Email already in use", 409); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(4414, hashtext(${email}))`);
      const existing = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
      if (existing.length) return null;
      const organization = organizationName || `${name}'s workspace`;
      const [org] = await tx.insert(organizations).values({ name: organization,
        slug: `workspace-${randomUUID()}` }).returning();
      const [user] = await tx.insert(users).values({ email, name, role, passwordHash, organizationId: org.id }).returning();
      const accessToken = signAccessToken({ userId: user.id, organizationId: org.id, role });
      const refreshToken = generateRefreshToken();
      await tx.insert(refreshTokens).values({ userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshTokenExpiresAt() });
      return { user: safeUser(user), accessToken, refreshToken };
    });
    if (!result) { fail(res, "Email already in use", 409); return; }
    ok(res, result, 201);
  } catch (err) {
    req.log.error({ err }, "register error");
    fail(res, "Internal server error", 500);
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "Invalid request body"); return; }
  const { email, password } = parsed.data;

  try {
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (!user) { fail(res, "Invalid credentials", 401); return; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { fail(res, "Invalid credentials", 401); return; }

    const accessToken = signAccessToken({ userId: user.id, organizationId: user.organizationId, role: user.role });
    const refreshToken = generateRefreshToken();
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt(),
    });

    ok(res, { user: safeUser(user), accessToken, refreshToken });
  } catch (err) {
    req.log.error({ err }, "login error");
    fail(res, "Internal server error", 500);
  }
});

router.post("/auth/refresh", async (req: Request, res: Response) => {
  const parsed = RefreshSchema.safeParse(req.body);
  if (!parsed.success) { fail(res, "refreshToken required"); return; }
  const { refreshToken } = parsed.data;

  try {
    const result = await db.transaction(async tx => {
      const [revoked] = await tx.update(refreshTokens).set({ isRevoked: true })
        .where(and(eq(refreshTokens.tokenHash, hashToken(refreshToken)), eq(refreshTokens.isRevoked, false),
          gte(refreshTokens.expiresAt, new Date()))).returning();
      if (!revoked) return null;
      const [user] = await tx.select().from(users).where(eq(users.id, revoked.userId)).limit(1);
      if (!user) throw new Error("Refresh user is unavailable");
      const accessToken = signAccessToken({ userId: user.id, organizationId: user.organizationId, role: user.role });
      const replacement = generateRefreshToken();
      await tx.insert(refreshTokens).values({ userId: user.id, tokenHash: hashToken(replacement), expiresAt: refreshTokenExpiresAt() });
      return { accessToken, refreshToken: replacement };
    });
    if (!result) { fail(res, "Invalid, expired, or already-revoked refresh token", 401); return; }
    ok(res, result);
  } catch (err) {
    req.log.error({ err }, "refresh error");
    fail(res, "Internal server error", 500);
  }
});

router.post("/auth/logout", requireAuth, async (req: Request, res: Response) => {
  try {
    await db.update(refreshTokens)
      .set({ isRevoked: true })
      .where(and(eq(refreshTokens.userId, req.auth!.userId), eq(refreshTokens.isRevoked, false)));
    ok(res, { message: "Logged out" });
  } catch (err) {
    req.log.error({ err }, "logout error");
    fail(res, "Internal server error", 500);
  }
});

router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.auth!.userId)).limit(1);
    if (!user) { fail(res, "User not found", 404); return; }
    ok(res, safeUser(user));
  } catch (err) {
    req.log.error({ err }, "me error");
    fail(res, "Internal server error", 500);
  }
});

export default router;
