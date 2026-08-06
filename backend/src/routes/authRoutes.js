import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import * as c from "../controllers/authController.js";

const r = Router();
r.post("/signup", authLimiter, c.signup);
r.post("/login", authLimiter, c.login);
r.post("/refresh", c.refresh);
r.post("/logout", requireAuth, c.logout);
r.get("/me", requireAuth, c.me);
r.patch("/profile", requireAuth, c.updateProfile);
r.post("/change-password", requireAuth, c.changePassword);
r.post("/oauth/google/link", requireAuth, c.linkGoogle);
r.post("/oauth/google/unlink", requireAuth, c.unlinkGoogle);
export default r;