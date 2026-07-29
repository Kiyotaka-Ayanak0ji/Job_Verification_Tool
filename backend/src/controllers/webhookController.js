import { User } from "../models/User.js";
import { PaymentEvent } from "../models/PaymentEvent.js";
import { AuditLog } from "../models/AuditLog.js";
import {
  verifyRazorpayWebhook, planForRazorpayPlan,
} from "../services/razorpayService.js";
import { env } from "../config/env.js";

// The routes that mount these MUST use express.raw() — Razorpay
// signature verification is computed over the exact byte stream of the body.

export async function razorpayWebhook(req, res) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return res.status(501).send("razorpay_not_configured");
  const signature = req.headers["x-razorpay-signature"];
  if (!verifyRazorpayWebhook(req.body, signature)) {
    return res.status(400).send("invalid_signature");
  }
  let event;
  try { event = JSON.parse(req.body.toString("utf8")); } catch { return res.status(400).send("bad_json"); }

  const eventId = req.headers["x-razorpay-event-id"] || `${event.event}:${event.created_at}:${event.payload?.subscription?.entity?.id || event.payload?.payment?.entity?.id}`;
  if (await PaymentEvent.exists({ eventId })) return res.json({ received: true, duplicate: true });

  try {
    const subEntity = event.payload?.subscription?.entity;
    const payEntity = event.payload?.payment?.entity;
    const userId = subEntity?.notes?.userId || payEntity?.notes?.userId;
    const planId = subEntity?.plan_id;
    const plan = planForRazorpayPlan(planId);

    if (userId && ["subscription.activated", "subscription.charged", "subscription.updated"].includes(event.event)) {
      await applyPlanUpdate(userId, {
        provider: "razorpay", customerId: subEntity?.customer_id, subscriptionId: subEntity?.id,
        status: subEntity?.status || "active", plan: plan || "pro_monthly",
        currentPeriodEnd: subEntity?.current_end ? new Date(subEntity.current_end * 1000) : null,
      });
    } else if (userId && ["subscription.cancelled", "subscription.completed", "subscription.halted"].includes(event.event)) {
      await applyPlanUpdate(userId, {
        provider: "razorpay", customerId: subEntity?.customer_id, subscriptionId: subEntity?.id,
        status: "canceled", plan: "free",
      });
    }

    await PaymentEvent.create({
      provider: "razorpay", eventId, type: event.event,
      userId: userId || undefined, payload: event,
    });
    res.json({ received: true });
  } catch (err) {
    console.error("[razorpay webhook] handler failed:", err);
    res.status(500).send("handler_failed");
  }
}

async function applyPlanUpdate(userId, patch) {
  const user = await User.findById(userId);
  if (!user) return;
  user.billing = user.billing || {};
  user.billing.provider = patch.provider || user.billing.provider;
  if (patch.customerId) user.billing.customerId = patch.customerId;
  if (patch.subscriptionId) user.billing.subscriptionId = patch.subscriptionId;
  if (patch.status) user.billing.status = patch.status;
  if (patch.currentPeriodEnd) user.billing.currentPeriodEnd = patch.currentPeriodEnd;
  if (patch.plan) user.plan = patch.plan;
  await user.save();
  await AuditLog.create({
    actorId: userId, action: `billing.${patch.provider}.${patch.status || "update"}`,
    target: userId, metadata: { plan: user.plan, ...patch },
  });
}