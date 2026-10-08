import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { logger } from "./lib/logger.js";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middleware/clerkProxyMiddleware.js";
import router from "./routes/index.js";

const app: Express = express();

app.set("trust proxy", 1);

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:5173", "http://localhost:3000", "http://localhost:4173"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(new Error("CORS origin not allowed"));
      }
    },
    credentials: true,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Clerk proxy must come before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
      secretKey: process.env.CLERK_SECRET_KEY,
    })),
  );
} else {
  logger.warn("CLERK_SECRET_KEY not set; running in local dev / demo mode");
  app.use((req, _res, next) => {
    (req as any).auth = (req as any).auth || {};
    next();
  });
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: "Too many requests, please try again later." },
});

app.use("/api", globalLimiter);
app.use("/api", router);

// JSON 404 handler — catches any unmatched /api route
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ success: false, data: null, error: "Not found" });
});

// Global JSON error handler — catches unhandled async throws from route handlers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, "unhandled route error");
  const isProd = process.env.NODE_ENV === "production";
  const message = isProd ? "Internal server error" : (err instanceof Error ? err.message : "Internal server error");
  if (!res.headersSent) {
    res.status(500).json({ success: false, data: null, error: message });
  }
});

export default app;
