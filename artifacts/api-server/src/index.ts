import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { startBriefWorker, stopBriefWorker } from "./services/brief-worker.js";
import { generateBriefAsync } from "./routes/briefs.js";

const rawPort = process.env["PORT"] || "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startBriefWorker((job) => generateBriefAsync(job.id, job.role, job.organizationId, undefined, job.jobId ?? undefined));
});

let shuttingDown = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => {
  if (shuttingDown) return;
  shuttingDown = true;
  const timeout = setTimeout(() => process.exit(1), 60_000); timeout.unref();
  void (async () => {
    await Promise.all([new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())), stopBriefWorker()]);
    await pool.end();
    clearTimeout(timeout);
  })().catch(() => { logger.error({}, "graceful shutdown failed"); process.exitCode = 1; });
});
