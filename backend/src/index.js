import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { connectMongo } from "./config/db.js";
import { generalLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import router from "./routes/index.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import { ensureBootstrapAdmin } from "./bootstrap/adminSeed.js";
import { startRetrainCron } from "./jobs/retrainCron.js";

async function main() {
  await connectMongo();
  await ensureBootstrapAdmin();

  const app = express();
  app.use(helmet({ crossOriginResourcePolicy: false }));
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        // allow same-origin / curl / server-to-server (no Origin header)
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes("https://job-verification-backend.onrender.com") || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`origin_not_allowed: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(cookieParser());
  // Webhooks receive raw bodies for signature verification and MUST be
  // registered before the JSON body parser.
  app.use("/api/webhooks", webhookRoutes);
  app.use(express.json({ limit: "1mb" }));
  app.use(generalLimiter);

  app.get("/", (_req, res) => res.json({ service: "trusthire-api", ok: true }));
  app.use("/api", router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(env.PORT, () => console.log(`[api] listening on :${env.PORT}`));
  startRetrainCron();
}

main().catch((e) => { console.error("[fatal]", e); process.exit(1); });