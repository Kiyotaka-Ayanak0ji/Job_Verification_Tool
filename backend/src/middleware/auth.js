import { verifyAccess } from "../services/tokenService.js";
import { unauthorized } from "../utils/apiError.js";

// Attaches req.auth = { sub, role, plan } from a valid Bearer token.
export function requireAuth(req, _res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return next(unauthorized());
  try {
    req.auth = verifyAccess(h.slice(7));
    next();
  } catch {
    next(unauthorized("invalid_token"));
  }
}

export function optionalAuth(req, _res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return next();
  try { req.auth = verifyAccess(h.slice(7)); } catch { /* ignore */ }
  next();
}