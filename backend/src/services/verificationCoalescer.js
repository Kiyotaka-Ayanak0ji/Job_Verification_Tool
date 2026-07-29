import crypto from "node:crypto";
import { redis, pub, sub } from "../config/redis.js";
import { env } from "../config/env.js";

/**
 * Redis Pub/Sub single-flight for expensive verification calls.
 *
 * Prevents "thundering herd" against the ML service and third-party scrapers:
 *   - First caller acquires a SETNX lock, runs the compute, caches + publishes.
 *   - Concurrent callers subscribe and get the answer without doing the work.
 *   - Later callers within TTL are served from cache.
 */
export function hashKey(...parts) {
  return crypto
    .createHash("sha256")
    .update(parts.map((p) => String(p ?? "").trim().toLowerCase()).join("|"))
    .digest("hex")
    .slice(0, 24);
}

export async function coalesce(key, compute) {
  const cacheKey = `cache:verify:${key}`;
  const lockKey = `lock:verify:${key}`;
  const channel = `verify:${key}`;

  // Graceful degradation: if Redis is unavailable, skip caching/single-flight
  // and just run the compute so local development works without Redis.
  let cached = null;
  try {
    cached = await redis.get(cacheKey);
  } catch (e) {
    console.warn("[coalesce] redis unavailable, bypassing cache:", e.message);
    return compute();
  }
  if (cached) return JSON.parse(cached);

  let gotLock;
  try {
    gotLock = await redis.set(lockKey, "1", "EX", env.VERIFY_LOCK_TTL_SECONDS, "NX");
  } catch (e) {
    console.warn("[coalesce] redis lock failed, running direct:", e.message);
    return compute();
  }
  if (gotLock === "OK") {
    try {
      const result = await compute();
      const payload = JSON.stringify(result);
      await redis.set(cacheKey, payload, "EX", env.VERIFY_CACHE_TTL_SECONDS);
      await pub.publish(channel, payload);
      return result;
    } finally {
      await redis.del(lockKey);
    }
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      sub.off("message", onMessage);
      sub.unsubscribe(channel).catch(() => {});
      const late = await redis.get(cacheKey);
      if (late) resolve(JSON.parse(late));
      else reject(new Error("verification_timeout"));
    }, (env.VERIFY_LOCK_TTL_SECONDS + 5) * 1000);

    const onMessage = (ch, msg) => {
      if (ch !== channel) return;
      clearTimeout(timer);
      sub.off("message", onMessage);
      sub.unsubscribe(channel).catch(() => {});
      resolve(JSON.parse(msg));
    };

    sub.subscribe(channel).then(() => sub.on("message", onMessage)).catch(reject);
  });
}