import type { Response } from "express";
import { fail } from "./response.js";

/** Keep provider details private while explaining an exhausted upstream limit. */
export function failAi(res: Response, error: unknown, fallback: string): void {
  const rateLimited = typeof error === "object" && error !== null &&
    "status" in error && error.status === 429;
  fail(res, rateLimited
    ? "AI provider is rate limited or out of quota. Try again later."
    : fallback, rateLimited ? 503 : 500);
}
