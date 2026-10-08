import jwt from "jsonwebtoken";
import crypto from "node:crypto";

const rawSecret = process.env.SESSION_SECRET;
if (!rawSecret && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: SESSION_SECRET is required in production environment");
}
const JWT_SECRET = rawSecret || "dev-session-secret-change-in-production";
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface JwtPayload {
  userId: number;
  organizationId: number | null;
  role: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL, algorithm: "HS256" });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiresAt(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}
