import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signAccess = (user) =>
  jwt.sign(
    { sub: String(user._id), role: user.role, plan: user.plan },
    env.JWT_SECRET,
    { algorithm: "HS256", issuer: env.JWT_ISSUER, expiresIn: env.JWT_ACCESS_TTL },
  );

export const signRefresh = (user) =>
  jwt.sign(
    { sub: String(user._id), type: "refresh" },
    env.JWT_REFRESH_SECRET,
    { algorithm: "HS256", issuer: env.JWT_ISSUER, expiresIn: env.JWT_REFRESH_TTL },
  );

export const verifyAccess = (token) =>
  jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"], issuer: env.JWT_ISSUER });

export const verifyRefresh = (token) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"], issuer: env.JWT_ISSUER });