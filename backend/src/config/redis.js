import { Redis } from "ioredis";
import { env } from "./env.js";

// Redis connection options for reliability
const redisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      console.error("[redis] max retries reached, giving up");
      return null; // Stop retrying
    }
    const delay = Math.min(times * 200, 2000);
    console.warn(`[redis] retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  reconnectOnError: (err) => {
    const targetErrors = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND"];
    return targetErrors.some(e => err.message.includes(e));
  },
  lazyConnect: true, // Connect on first command
  enableReadyCheck: true,
  maxLoadingRetryTime: 5000,
  family: 4, // IPv4
  tls: env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
};

// Main client
export const redis = new Redis(env.REDIS_URL, redisOptions);

// Pub/Sub clients (separate connections)
export const pub = new Redis(env.REDIS_URL, { ...redisOptions, lazyConnect: true });
export const sub = new Redis(env.REDIS_URL, { ...redisOptions, lazyConnect: true });

// Event handlers
function attachEvents(client, name) {
  client.on("connect", () => console.log(`[redis:${name}] connecting...`));
  client.on("ready", () => console.log(`[redis:${name}] ready`));
  client.on("error", (e) => console.error(`[redis:${name}] error:`, e.message));
  client.on("close", () => console.warn(`[redis:${name}] closed`));
  client.on("reconnecting", () => console.log(`[redis:${name}] reconnecting...`));
}

attachEvents(redis, "main");
attachEvents(pub, "pub");
attachEvents(sub, "sub");

// Graceful shutdown
async function shutdownRedis() {
  console.log("[redis] closing connections...");
  await Promise.all([redis.quit(), pub.quit(), sub.quit()]);
  console.log("[redis] connections closed");
}

process.on("SIGINT", shutdownRedis);
process.on("SIGTERM", shutdownRedis);

// Health check helper
export async function checkRedisHealth() {
  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    return { status: "ok", latencyMs: latency };
  } catch (err) {
    return { status: "error", error: err.message };
  }
}

// Lua scripts for atomic operations
export const LUA_SCRIPTS = {
  // Atomic increment with expiry
  INCR_WITH_EXPIRY: `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    return current
  `,
  // Atomic get-and-set with TTL check
  GET_SET_IF_NOT_EXPIRED: `
    local val = redis.call('GET', KEYS[1])
    if val == false then return nil end
    local ttl = redis.call('TTL', KEYS[1])
    if ttl <= 0 then return nil end
    return val
  `,
};