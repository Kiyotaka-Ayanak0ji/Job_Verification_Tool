import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

// Helper to create a custom key generator that considers user ID when available
function createKeyGenerator(prefix = "rl") {
  return (req) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const userId = req.auth?.sub || "anon";
    return `${prefix}:${userId}:${ip}`;
  };
}

// Skip rate limiting for health checks and webhooks
function skipPaths(...paths) {
  return (req) => paths.some(p => req.path === p || req.path.startsWith(p + "/"));
}

export const generalLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator("general"),
  skip: skipPaths("/api/health", "/api/webhooks"),
  message: { error: "rate_limited", message: "Too many requests, please try again later" },
  handler: (req, res, next, options) => {
    res.set("Retry-After", String(Math.ceil(options.windowMs / 1000)));
    res.status(options.statusCode).json(options.message);
  },
});

export const authLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator("auth"),
  skip: skipPaths("/api/health"),
  message: { error: "rate_limited", message: "Too many auth attempts, please try again later" },
  handler: (req, res, next, options) => {
    res.set("Retry-After", String(Math.ceil(options.windowMs / 1000)));
    res.status(options.statusCode).json(options.message);
  },
});

export const verifyLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator("verify"),
  skip: skipPaths("/api/health"),
  message: { error: "rate_limited", message: "Too many verification requests, please try again later" },
  handler: (req, res, next, options) => {
    res.set("Retry-After", String(Math.ceil(options.windowMs / 1000)));
    res.status(options.statusCode).json(options.message);
  },
});

// Stricter limiter for expensive operations
export const expensiveLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator("expensive"),
  message: { error: "rate_limited", message: "This operation is limited, please try again later" },
});

// Bulk operations limiter
export const bulkLimiter = rateLimit({
  windowMs: 5 * 60_000, // 5 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: createKeyGenerator("bulk"),
  message: { error: "rate_limited", message: "Too many bulk operations, please try again later" },
});

// Export a function to create custom limiters
export function createLimiter({ prefix, max, windowMs = 60_000, message } = {}) {
  return rateLimit({
    windowMs,
    max: max ?? 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: createKeyGenerator(prefix ?? "custom"),
    message: message ?? { error: "rate_limited", message: "Too many requests" },
  });
}