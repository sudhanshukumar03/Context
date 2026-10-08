import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { eq, and, gte } from "drizzle-orm";
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

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["backend", "frontend", "pm"]).default("backend"),
  organizationName: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
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
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) { fail(res, "Email already in use", 409); return; }

    let orgId: number | null = null;
    if (organizationName) {
      const slug = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
      const [org] = await db.insert(organizations).values({ name: organizationName, slug }).returning();
      orgId = org.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(users).values({ email, name, role, passwordHash, organizationId: orgId }).returning();

    const accessToken = signAccessToken({ userId: user.id, organizationId: orgId, role });
    const refreshToken = generateRefreshToken();
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiresAt(),
    });

    ok(res, { user: safeUser(user), accessToken, refreshToken }, 201);
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
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
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
    const tokenHash = hashToken(refreshToken);
    const [revoked] = await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(and(
        eq(refreshTokens.tokenHash, tokenHash),
        eq(refreshTokens.isRevoked, false),
        gte(refreshTokens.expiresAt, new Date())
      ))
      .returning();

    if (!revoked) {
      fail(res, "Invalid, expired, or already-revoked refresh token", 401);
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, revoked.userId)).limit(1);
    if (!user) { fail(res, "User not found", 404); return; }

    const newAccessToken = signAccessToken({ userId: user.id, organizationId: user.organizationId, role: user.role });
    const newRefreshToken = generateRefreshToken();
    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: refreshTokenExpiresAt(),
    });

    ok(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
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
