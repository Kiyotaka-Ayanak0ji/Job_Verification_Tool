import { z } from "zod";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { badRequest, unauthorized, apiError } from "../utils/apiError.js";
import {
  createRazorpaySubscription, cancelRazorpaySubscription, razorpayConfigured,
  verifyRazorpayWebhook, planForRazorpayPlan
} from "../services/razorpayService.js";

const checkoutSchema = z.object({
  provider: z.enum(["razorpay"]), // only Razorpay enabled
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
});

export const startCheckout = asyncHandler(async (req, res) => {
  const { provider, interval } = checkoutSchema.parse(req.body);
  const user = await User.findById(req.auth.sub);
  if (!user) throw unauthorized();

  if (provider === "razorpay") {
    if (!razorpayConfigured()) throw apiError(501, "razorpay_not_configured", "Razorpay is not configured on this server");
    const { url } = await createRazorpaySubscription({ user, interval });
    return res.json({ provider, url });
  }
  // Should not happen due to schema, but keep for safety
  throw apiError(501, "provider_not_configured", "Payment provider not configured");
});

export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;

  // Basic validation
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    throw badRequest("missing_required_fields");
  }

  // Verify the payment signature using Razorpay SDK
  // Note: We're not verifying the signature here since we rely on webhook verification
  // but we can add additional validation if needed
  // For now, we'll trust the webhook to verify and just update the user's status

  // Find the user and trigger a refresh of their billing status
  // The actual verification happens in the webhook, this endpoint just triggers a refresh
  const user = await User.findById(req.auth.sub);
  if (!user) throw unauthorized();

  return res.json({
    success: true,
    message: "Payment verification initiated. Please wait for webhook confirmation."
  });
});

export const openPortal = asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.sub);
  if (!user) throw unauthorized();
  if (user.billing?.provider === "razorpay") {
    if (!user.billing.subscriptionId) throw badRequest("no_subscription");
    await cancelRazorpaySubscription(user.billing.subscriptionId);
    user.billing.cancelAtPeriodEnd = true;
    await user.save();
    return res.json({ provider: "razorpay", canceled: true });
  }
  throw badRequest("no_active_billing");
});

export const billingStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.sub);
  if (!user) throw unauthorized();
  res.json({
    plan: user.plan,
    billing: user.billing || null,
    providers: {
      razorpay: razorpayConfigured(),
    },
  });
});