import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    if (process.env.DATABASE_URL) {
      const { pool } = await import("@workspace/db");
      await pool.query("SELECT 1");
    }
    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
  } catch (err) {
    res.status(503).json({ status: "unhealthy" });
  }
});

export default router;
