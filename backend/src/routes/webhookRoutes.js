import express, { Router } from "express";
import { razorpayWebhook } from "../controllers/webhookController.js";

// These handlers need the raw request body for signature verification.
// Mount this router BEFORE app.use(express.json()) in src/index.js.
const r = Router();
r.post("/razorpay", express.raw({ type: "*/*" }), razorpayWebhook);
export default r;