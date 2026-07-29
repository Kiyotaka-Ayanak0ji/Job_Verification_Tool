import { forbidden, unauthorized } from "../utils/apiError.js";

// Frontend hides UI; this is the actual authorization gate.
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  if (!roles.includes(req.auth.role)) return next(forbidden());
  next();
};