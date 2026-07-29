import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { quotasFor } from "../config/env.js";

export const myUsage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.sub);
  user.resetIfNewMonth();
  await user.save();
  const q = quotasFor(user.plan);
  const isAdmin = user.role === "admin";
  res.json({
    plan: user.plan,
    role: user.role,
    quotas: isAdmin
      ? { verify: Infinity, deep: Infinity, pdf: Infinity }
      : q,
    usage: {
      verify: user.searchesThisMonth,
      deep: user.deepThinkThisMonth,
      pdf: user.pdfExportsThisMonth,
    },
    quotaResetAt: user.quotaResetAt,
  });
});