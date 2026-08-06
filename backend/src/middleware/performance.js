import compression from "compression";
import { Redis } from "ioredis";

/**
 * Response compression middleware
 * Compresses responses larger than threshold
 */
export function responseCompression() {
  return compression({
    threshold: 1024, // Only compress responses > 1KB
    level: 6,        // Balance between speed and compression ratio
    filter: (req, res) => {
      // Don't compress if client doesn't accept it
      if (req.headers["accept-encoding"]?.includes("identity")) return false;
      // Use default filter
      return compression.filter(req, res);
    },
  });
}

/**
 * ETag/conditional request middleware for GET endpoints
 * Reduces bandwidth by returning 304 Not Modified when content hasn't changed
 */
export function conditionalRequests() {
  return (req, res, next) => {
    // Only for safe methods
    if (!["GET", "HEAD"].includes(req.method)) {
      return next();
    }

    const originalJson = res.json.bind(res);

    res.json = (data) => {
      // Generate ETag from response body
      const etag = generateETag(JSON.stringify(data));

      // Set ETag header
      res.set("ETag", etag);

      // Check If-None-Match header
      const ifNoneMatch = req.headers["if-none-match"];
      if (ifNoneMatch && ifNoneMatch === etag) {
        return res.status(304).end();
      }

      // Check If-Modified-Since header (for resources with timestamps)
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
 * Simple in-memory cache for frequent reads
 * Use with caution - not suitable for multi-instance deployments
 */
class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.ttls = new Map();
    this.maxSize = 1000;
  }

  set(key, value, ttlMs = 60000) {
    // Enforce max size
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }

    this.cache.set(key, value);
    this.ttls.set(key, Date.now() + ttlMs);
  }

  get(key) {
    const expiry = this.ttls.get(key);
    if (!expiry || Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.cache.delete(key);
    this.ttls.delete(key);
  }

  clear() {
    this.cache.clear();
    this.ttls.clear();
  }

  // Cleanup expired entries periodically
  startCleanup() {
    return setInterval(() => {
      const now = Date.now();
      for (const [key, expiry] of this.ttls.entries()) {
        if (now > expiry) {
          this.delete(key);
        }
      }
    }, 30000);
  }
}

export const memoryCache = new MemoryCache();

// Start cleanup on module load
const cleanupInterval = memoryCache.startCleanup();
process.on("exit", () => clearInterval(cleanupInterval));

/**
 * Cache middleware using memory cache
 * @param {Object} options - { ttlMs, keyGenerator, skip }
 */
export function cacheMiddleware(options = {}) {
  const { ttlMs = 60000, keyGenerator, skip } = options;

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") return next();

    // Check skip function
    if (skip && skip(req)) return next();

    // Generate cache key
    const cacheKey = keyGenerator ? keyGenerator(req) : `cache:${req.method}:${req.originalUrl}`;

    // Try to get from cache
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      res.set("X-Cache", "HIT");
      return res.json(cached);
    }

    // Intercept response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      // Only cache successful responses
      if (res.statusCode === 200) {
        memoryCache.set(cacheKey, data, ttlMs);
        res.set("X-Cache", "MISS");
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Redis-backed cache for multi-instance deployments
 */
export function createRedisCache(redisClient, options = {}) {
  const { prefix = "cache:", defaultTtl = 60 } = options;

  return {
    async get(key) {
      try {
        const data = await redisClient.get(`${prefix}${key}`);
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    },

    async set(key, value, ttl = defaultTtl) {
      try {
        await redisClient.setex(`${prefix}${key}`, ttl, JSON.stringify(value));
      } catch (err) {
        console.warn("[redis-cache] set failed:", err.message);
      }
    },

    async delete(key) {
      try {
        await redisClient.del(`${prefix}${key}`);
      } catch (err) {
        console.warn("[redis-cache] delete failed:", err.message);
      }
    },

    async clearPattern(pattern) {
      try {
        const keys = await redisClient.keys(`${prefix}${pattern}`);
        if (keys.length) await redisClient.del(...keys);
      } catch (err) {
        console.warn("[redis-cache] clearPattern failed:", err.message);
      }
    },

    middleware: (ttlMs = 60000) => {
      return cacheMiddleware({ ttlMs, keyGenerator: (req) => req.originalUrl });
    },
  };
}

/**
 * Database query optimization helpers
 */
export const queryOptimizers = {
  // Lean query - returns plain JS objects instead of Mongoose documents
  lean: (query) => query.lean(),

  // Select only needed fields
  select: (query, fields) => query.select(fields),

  // Populate with specific fields only
  populate: (query, path, fields) => query.populate(path, fields),

  // Pagination with cursor-based approach (more efficient than skip/limit for large datasets)
  paginateCursor: (query, { before, after, limit = 25, sortField = "_id", sortOrder = -1 } = {}) => {
    const sort = { [sortField]: sortOrder };

    if (before) {
      query = query.find({ [sortField]: { $lt: before } }).sort({ [sortField]: -1 }).limit(limit);
    } else if (after) {
      query = query.find({ [sortField]: { $gt: after } }).sort(sort).limit(limit);
    } else {
      query = query.sort(sort).limit(limit);
    }

    return query;
  },

  // Efficient count with limit
  countEstimated: (model) => model.estimatedDocumentCount(),

  // Aggregate with explanation for debugging
  explain: (pipeline) => ({ pipeline, explain: true }),
};

/**
 * Generate ETag from content
 */
function generateETag(content) {
  const crypto = require("crypto");
  const hash = crypto.createHash("md5").update(content).digest("hex");
  return `"${hash}"`;
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