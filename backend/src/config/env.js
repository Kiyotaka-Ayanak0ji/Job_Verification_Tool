import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGO_URI: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  JWT_ISSUER: z.string().default("trusthire"),
  FLASK_URL: z.string().url().default("http://localhost:8001"),
  ML_SERVICE_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  VERIFY_CACHE_TTL_SECONDS: z.coerce.number().default(21600),
  VERIFY_LOCK_TTL_SECONDS: z.coerce.number().default(30),
  FREE_VERIFY_QUOTA: z.coerce.number().default(10),
  FREE_DEEP_QUOTA: z.coerce.number().default(1),
  FREE_PDF_QUOTA: z.coerce.number().default(2),
  PRO_VERIFY_QUOTA: z.coerce.number().default(50),
  PRO_DEEP_QUOTA: z.coerce.number().default(10),
  PRO_PDF_QUOTA: z.coerce.number().default(10),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().optional(),
  // ---- Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // ---- Billing (only Razorpay enabled; missing keys disable that provider)
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_MONTHLY: z.string().optional(),
  RAZORPAY_PLAN_YEARLY: z.string().optional(),
  BILLING_SUCCESS_URL: z.string().default("http://localhost:5173/billing/success"),
  BILLING_CANCEL_URL: z.string().default("http://localhost:5173/billing/cancel"),
  // ---- Retrain cron
  DISABLE_CRON: z.string().optional(),
  RETRAIN_MIN_FEEDBACK: z.coerce.number().default(20),
  RETRAIN_CRON: z.string().default("0 3 * * *"),
});

export const env = schema.parse(process.env);

export const quotasFor = (plan) => {
  if (plan === "pro_monthly" || plan === "pro_yearly") {
    return { verify: env.PRO_VERIFY_QUOTA, deep: env.PRO_DEEP_QUOTA, pdf: env.PRO_PDF_QUOTA };
  }
  return { verify: env.FREE_VERIFY_QUOTA, deep: env.FREE_DEEP_QUOTA, pdf: env.FREE_PDF_QUOTA };
};