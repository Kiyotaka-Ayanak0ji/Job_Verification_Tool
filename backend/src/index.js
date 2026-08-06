import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import { env } from "./config/env.js";
import { connectMongo } from "./config/db.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { requestId, requestLogger, securityHeaders, requestTimeout, responseTime, responseCompression, conditionalRequests } from "./middleware/request.js";
import router from "./routes/index.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import { ensureBootstrapAdmin } from "./bootstrap/adminSeed.js";
import { startRetrainCron } from "./jobs/retrainCron.js";

async function main() {
  await connectMongo();
  await ensureBootstrapAdmin();

  const app = express();

  // Trust proxy for correct IP addresses behind load balancer
  app.set("trust proxy", 1);

  // Security headers (helmet + custom)
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(securityHeaders());

  // CORS
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        // allow same-origin / curl / server-to-server (no Origin header)
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes("*") || allowedOrigins.includes(origin) || allowedOrigins.includes("https://job-verification-backend.onrender.com")) return cb(null, true);
        return cb(new Error(`origin_not_allowed: ${origin}`));
      },
      credentials: true,
    }),
  );

  // Request ID and logging
  app.use(requestId());
  app.use(requestLogger());
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  // Response time header
  app.use(responseTime());

  // Request parsing
  app.use(cookieParser());

  // Webhooks receive raw bodies for signature verification and MUST be
  // registered before the JSON body parser.
  app.use("/api/webhooks", webhookRoutes);
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Response compression and conditional requests
  app.use(responseCompression());
  app.use(conditionalRequests());

  // Request timeout (30s default)
  app.use(requestTimeout(30000));

  // General rate limiting
  app.use(generalLimiter);

  // Health check (no rate limit)
  app.get("/health", (req, res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      requestId: req.requestId,
    });
  });

  // API routes
  app.get("/", (_req, res) => res.json({ service: "trusthire-api", ok: true }));
  app.use("/api", router);

  // Error handlers (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(env.PORT, () => console.log(`[api] listening on :${env.PORT}`));
  startRetrainCron();
}

main().catch((e) => { console.error("[fatal]", e); process.exit(1); });