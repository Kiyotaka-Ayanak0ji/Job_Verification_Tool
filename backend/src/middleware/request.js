import { randomUUID } from "crypto";
import compression from "compression";
import { createHash } from "crypto";

/**
 * Request ID middleware - adds a unique request ID to each request for tracing.
 * The ID is available as req.requestId and also added to response headers.
 */
export function requestId() {
  return (req, _res, next) => {
    // Use existing ID if provided by upstream (e.g., load balancer)
    req.requestId = req.headers["x-request-id"] || req.headers["x-correlation-id"] || randomUUID();
    next();
  };
}

/**
 * Request logging middleware - logs incoming requests with timing
 */
export function requestLogger() {
  return (req, res, next) => {
    const start = Date.now();
    const { requestId, method, path, ip, headers } = req;

    // Log request
    console.log("[request]", JSON.stringify({
      requestId,
      method,
      path,
      ip: ip || headers["x-forwarded-for"] || "unknown",
      userAgent: headers["user-agent"],
      userId: req.auth?.sub || "anonymous",
      timestamp: new Date().toISOString(),
    }));

    // Log response when finished
    res.on("finish", () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 400 ? "warn" : "info";
      console[level]("[response]", JSON.stringify({
        requestId,
        method,
        path,
        statusCode: res.statusCode,
        durationMs: duration,
        userId: req.auth?.sub || "anonymous",
        timestamp: new Date().toISOString(),
      }));
    });

    next();
  };
}

/**
 * Security headers middleware - adds additional security headers
 */
export function securityHeaders() {
  return (_req, res, next) => {
    // Prevent MIME type sniffing
    res.set("X-Content-Type-Options", "nosniff");
    // Prevent clickjacking
    res.set("X-Frame-Options", "DENY");
    // XSS protection (legacy but still useful)
    res.set("X-XSS-Protection", "1; mode=block");
    // Referrer policy
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    // Permissions policy (formerly Feature Policy)
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  };
}

/**
 * Timeout middleware - adds request timeout
 */
export function requestTimeout(timeoutMs = 30000) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.warn("[timeout]", JSON.stringify({
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          timeoutMs,
          timestamp: new Date().toISOString(),
        }));
        res.status(504).json({ error: "request_timeout", message: "Request timed out" });
      }
    }, timeoutMs);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  };
}

/**
 * Response time header middleware
 */
export function responseTime() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const end = process.hrtime.bigint();
      const ms = Number(end - start) / 1_000_000;
      res.set("X-Response-Time", `${ms.toFixed(2)}ms`);
    });
    next();
  };
}

/**
 * Response compression middleware
 */
export function responseCompression() {
  return compression({
    threshold: 1024,
    level: 6,
    filter: (req, res) => {
      if (req.headers["accept-encoding"]?.includes("identity")) return false;
      return compression.filter(req, res);
    },
  });
}

/**
 * ETag/conditional request middleware for GET endpoints
 */
export function conditionalRequests() {
  return (req, res, next) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      return next();
    }

    const originalJson = res.json.bind(res);

    res.json = (data) => {
      // Generate ETag from response body
      const etag = generateETag(JSON.stringify(data));
      res.set("ETag", etag);

      const ifNoneMatch = req.headers["if-none-match"];
      if (ifNoneMatch && ifNoneMatch === etag) {
        return res.status(304).end();
      }

      const ifModifiedSince = req.headers["if-modified-since"];
      if (ifModifiedSince && data.lastModified) {
        const modifiedSince = new Date(ifModifiedSince).getTime();
        const lastModified = new Date(data.lastModified).getTime();
        if (lastModified <= modifiedSince) {
          return res.status(304).end();
        }
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Health check middleware - lightweight endpoint for load balancers
 */
export function healthCheck() {
  return (req, res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      requestId: req.requestId,
    });
  };
}

/**
 * Generate ETag from content
 */
function generateETag(content) {
  const hash = createHash("md5").update(content).digest("hex");
  return `"${hash}"`;
}