import { env } from "../config/env.js";
import { unauthorized, forbidden } from "../utils/apiError.js";

/**
 * API Key authentication middleware for ML service communication.
 * Checks for x-api-key header against ML_SERVICE_API_KEY.
 */
export function requireApiKey(req, _res, next) {
  const expectedKey = env.ML_SERVICE_API_KEY;

  // If no key is configured, allow (development mode)
  if (!expectedKey) {
    return next();
  }

  const providedKey = req.headers["x-api-key"] || req.headers["x-ml-api-key"];

  if (!providedKey) {
    throw unauthorized("api_key_required", "ML service API key required");
  }

  // Constant-time comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(expectedKey);
  const providedBuffer = Buffer.from(providedKey);

  if (expectedBuffer.length !== providedBuffer.length) {
    throw unauthorized("invalid_api_key", "Invalid ML service API key");
  }

  const isValid = expectedBuffer.every((byte, index) => byte === providedBuffer[index]);

  if (!isValid) {
    throw unauthorized("invalid_api_key", "Invalid ML service API key");
  }

  next();
}

/**
 * Optional API key - adds ML service flag to request if valid key provided
 */
export function optionalApiKey(req, _res, next) {
  const expectedKey = env.ML_SERVICE_API_KEY;

  if (!expectedKey) {
    req.mlService = { authenticated: false, reason: "not_configured" };
    return next();
  }

  const providedKey = req.headers["x-api-key"] || req.headers["x-ml-api-key"];

  if (!providedKey) {
    req.mlService = { authenticated: false, reason: "not_provided" };
    return next();
  }

  const expectedBuffer = Buffer.from(expectedKey);
  const providedBuffer = Buffer.from(providedKey);

  const isValid = expectedBuffer.length === providedBuffer.length &&
    expectedBuffer.every((byte, index) => byte === providedBuffer[index]);

  req.mlService = {
    authenticated: isValid,
    reason: isValid ? "valid" : "invalid",
  };

  next();
}

/**
 * Internal service-to-service authentication for internal endpoints
 * Uses a separate INTERNAL_API_KEY env var
 */
export function requireInternalAuth(req, _res, next) {
  const expectedKey = env.INTERNAL_API_KEY;

  if (!expectedKey) {
    throw forbidden("internal_auth_not_configured", "Internal API not configured");
  }

  const providedKey = req.headers["x-internal-key"] || req.headers["authorization"]?.replace("Bearer ", "");

  if (!providedKey) {
    throw unauthorized("internal_key_required", "Internal API key required");
  }

  // Constant-time comparison
  const expectedBuffer = Buffer.from(expectedKey);
  const providedBuffer = Buffer.from(providedKey);

  if (expectedBuffer.length !== providedBuffer.length) {
    throw unauthorized("invalid_internal_key", "Invalid internal API key");
  }

  const isValid = expectedBuffer.every((byte, index) => byte === providedBuffer[index]);

  if (!isValid) {
    throw unauthorized("invalid_internal_key", "Invalid internal API key");
  }

  next();
}

/**
 * Generate a secure API key
 */
export function generateApiKey(prefix = "th") {
  const crypto = require("crypto");
  const bytes = crypto.randomBytes(32);
  return `${prefix}_${bytes.toString("hex")}`;
}

/**
 * Hash an API key for storage (never store plaintext)
 */
export async function hashApiKey(key) {
  const crypto = require("crypto");
  // Use PBKDF2 with high iteration count
  const salt = crypto.randomBytes(16);
  const iterations = 100000;
  const hash = crypto.pbkdf2Sync(key, salt, iterations, 64, "sha256");
  return `${iterations}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verify a hashed API key
 */
export async function verifyApiKey(key, hashed) {
  const crypto = require("crypto");
  const [iterations, salt, hash] = hashed.split(":");
  const computedHash = crypto.pbkdf2Sync(key, Buffer.from(salt, "hex"), parseInt(iterations), 64, "sha256");
  return computedHash.toString("hex") === hash;
}