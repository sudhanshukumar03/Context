import type { Request, Response, NextFunction } from "express";
import { fail } from "../lib/response.js";
/** Role lenses never grant permission to change shared data. */
export function requireOrganizationAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.organizationId) { fail(res, "Organization required", 403); return; }
  if (req.auth.clerkOrganizationId && req.auth.organizationRole !== "org:admin") {
    fail(res, "An organization admin must authorize this change", 403); return;
  }
  next();
}
