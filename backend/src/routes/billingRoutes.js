import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as c from "../controllers/billingController.js";

const r = Router();
r.get("/status", requireAuth, c.billingStatus);
r.post("/checkout", requireAuth, c.startCheckout);
r.post("/verify-razorpay", requireAuth, c.verifyRazorpayPayment);
r.post("/portal", requireAuth, c.openPortal);
export default r;