import type { Response } from "express";

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data, error: null });
}

export function fail(res: Response, error: string, status = 400): void {
  res.status(status).json({ success: false, data: null, error });
}
