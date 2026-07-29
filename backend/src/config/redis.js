import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const pub = new Redis(env.REDIS_URL);
export const sub = new Redis(env.REDIS_URL);

redis.on("error", (e) => console.error("[redis]", e.message));