import crypto from "node:crypto";
import Razorpay from "razorpay";
import { env } from "../config/env.js";

let _rp = null;
export function razorpayClient() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  if (!_rp) _rp = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return _rp;
}

export function razorpayConfigured() {
  return Boolean(
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET &&
    env.RAZORPAY_PLAN_MONTHLY &&
    env.RAZORPAY_PLAN_YEARLY,
  );
}

// Creates a Razorpay subscription and returns the hosted-checkout URL.
export async function createRazorpaySubscription({ user, interval }) {
  const rp = razorpayClient();
  if (!rp) throw new Error("razorpay_not_configured");
  const plan_id = interval === "yearly" ? env.RAZORPAY_PLAN_YEARLY : env.RAZORPAY_PLAN_MONTHLY;
  if (!plan_id) throw new Error("razorpay_plan_missing");
  const sub = await rp.subscriptions.create({
    plan_id,
    total_count: interval === "yearly" ? 5 : 12,
    customer_notify: 1,
    notes: { userId: String(user._id), interval },
  });
  // short_url is the Razorpay-hosted checkout page
  return { url: sub.short_url, id: sub.id };
}

export async function cancelRazorpaySubscription(subscriptionId) {
  const rp = razorpayClient();
  if (!rp) throw new Error("razorpay_not_configured");
  return rp.subscriptions.cancel(subscriptionId, false);
}

export function verifyRazorpayWebhook(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  if (!signature) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function planForRazorpayPlan(planId) {
  if (!planId) return null;
  if (planId === env.RAZORPAY_PLAN_YEARLY) return "pro_yearly";
  if (planId === env.RAZORPAY_PLAN_MONTHLY) return "pro_monthly";
  return null;
}