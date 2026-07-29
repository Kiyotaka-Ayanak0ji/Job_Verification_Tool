import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { verifyLimiter } from "../middleware/rateLimit.js";
import { verifyCompanyController } from "../controllers/verifyController.js";

const r = Router();
r.post("/company", requireAuth, verifyLimiter, verifyCompanyController);
export default r;