import { ZodError } from "zod";
import { ApiError } from "../utils/apiError.js";

export function errorHandler(err, req, res, _next) {
  // Structured logging with request context
  const errorContext = {
    method: req.method,
    path: req.path,
    ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
    userAgent: req.headers["user-agent"],
    userId: req.auth?.sub || "anonymous",
    timestamp: new Date().toISOString(),
    error: {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    },
  };

  if (err instanceof ZodError) {
    console.warn("[validation_error]", JSON.stringify({ ...errorContext, details: err.flatten() }));
    return res.status(400).json({ error: "validation_error", details: err.flatten() });
  }

  if (err instanceof ApiError) {
    const logLevel = err.status >= 500 ? "error" : "warn";
    console[logLevel](`[${err.code}]`, JSON.stringify({ ...errorContext, status: err.status, details: err.details }));
    return res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Unhandled errors
  console.error("[internal_error]", JSON.stringify(errorContext));
  res.status(500).json({ error: "internal_error", message: "An unexpected error occurred" });
}

export function notFoundHandler(req, res) {
  console.warn("[route_not_found]", JSON.stringify({
    method: req.method,
    path: req.path,
    ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
    timestamp: new Date().toISOString(),
  }));
  res.status(404).json({ error: "route_not_found" });
}