import { ZodError } from "zod";
import { ApiError } from "../utils/apiError.js";

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "validation_error", details: err.flatten() });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }
  console.error("[error]", err);
  res.status(500).json({ error: "internal_error", message: err?.message ?? "unknown" });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: "route_not_found" });
}