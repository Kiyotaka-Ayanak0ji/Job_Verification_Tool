import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { myUsage } from "../controllers/usageController.js";

const r = Router();
r.get("/me", requireAuth, myUsage);
export default r;