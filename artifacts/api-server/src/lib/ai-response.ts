import type { Response } from "express";
import { fail } from "./response.js";

/** Keep provider details private while explaining retryable upstream failures. */
export function failAi(res: Response, error: unknown, fallback: string): void {
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
  if (status === 429) {
    fail(res, "AI provider is rate limited or out of quota. Try again later.", 503);
  } else if (typeof status === "number" && status >= 500 && status <= 599) {
    fail(res, "AI provider is temporarily unavailable. Try again later.", 503);
  } else {
    fail(res, fallback, 500);
  }
}
