export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message ?? code);
    this.status = status;
    this.code = code;
    this.details = details;
    // Capture stack trace for debugging
    Error.captureStackTrace(this, this.constructor);
  }
}

// Standard error constructors
export const badRequest = (code, message, details) => new ApiError(400, code, message, details);
export const unauthorized = (code = "unauthorized", message) => new ApiError(401, code, message);
export const forbidden = (code = "forbidden", message) => new ApiError(403, code, message);
export const notFound = (code = "not_found", message) => new ApiError(404, code, message);
export const conflict = (code, message) => new ApiError(409, code, message);
export const paymentRequired = (code, message, details) => new ApiError(402, code, message, details);
export const tooManyRequests = (code = "rate_limited", message) => new ApiError(429, code, message);
export const internalError = (code = "internal_error", message, details) => new ApiError(500, code, message, details);
export const serviceUnavailable = (code = "service_unavailable", message, details) => new ApiError(503, code, message, details);
export const gatewayTimeout = (code = "gateway_timeout", message, details) => new ApiError(504, code, message, details);

// Generic factory for arbitrary status codes
export const apiError = (status, code, message, details) => new ApiError(status, code, message, details);

// Helper to wrap async route handlers with automatic error handling
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Retryable error marker - for errors that might succeed on retry
export class RetryableApiError extends ApiError {
  constructor(status, code, message, details, retryAfterSeconds = 30) {
    super(status, code, message, details);
    this.retryAfter = retryAfterSeconds;
  }
}

export const isRetryableError = (err) => err instanceof RetryableApiError;

// Validation error formatter for consistent Zod error responses
export function formatZodError(zodError) {
  const fieldErrors = zodError.flatten().fieldErrors;
  const formatted = {};
  for (const [field, errors] of Object.entries(fieldErrors)) {
    if (errors.length > 0) {
      formatted[field] = errors.map(e => e.message).join("; ");
    }
  }
  return formatted;
}