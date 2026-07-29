import rateLimit from "express-rate-limit";

export const generalLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true });
export const authLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true });
export const verifyLimiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true });