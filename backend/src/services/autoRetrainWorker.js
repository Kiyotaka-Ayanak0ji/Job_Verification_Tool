import { redis } from "../config/redis.js";
import { LabeledReport, AUTO_RETRAIN_THRESHOLD } from "../models/LabeledReport.js";
import { Feedback } from "../models/Feedback.js";
import { AdminNotification } from "../models/AdminNotification.js";
import { triggerRetrain } from "./retrainService.js";

const LOCK_KEY = "retrain:lock";
const LOCK_TTL_SECONDS = 30 * 60; // 30 min

// Called after every admin label. If unconsumed labels crossed the
// threshold, acquire a redis lock and fire a retrain. Idempotent.
export async function maybeTriggerAutoRetrain({ triggeredBy = null } = {}) {
  // Check both LabeledReport and Feedback for unconsumed training data
  const [unconsumedLabels, pendingFeedback] = await Promise.all([
    LabeledReport.countDocuments({ consumedInRun: null }),
    Feedback.countDocuments({ includedForTraining: true, consumedInRun: null }),
  ]);

  const totalUnconsumed = unconsumedLabels + pendingFeedback;

  if (totalUnconsumed < AUTO_RETRAIN_THRESHOLD) {
    return { fired: false, unconsumed: totalUnconsumed, threshold: AUTO_RETRAIN_THRESHOLD, labels: unconsumedLabels, feedback: pendingFeedback };
  }

  // NX + EX ensures a single winner across replicas for LOCK_TTL_SECONDS.
  let locked;
  try {
    locked = await redis.set(LOCK_KEY, String(Date.now()), "EX", LOCK_TTL_SECONDS, "NX");
  } catch (e) {
    console.warn("[auto-retrain] redis lock unavailable, falling back:", e.message);
    locked = "OK"; // fail open — better to retry than never train
  }
  if (locked !== "OK") return { fired: false, unconsumed: totalUnconsumed, reason: "locked" };

  // Run in background so the label API stays snappy.
  runAutoRetrain({ triggeredBy }).catch((e) =>
    console.error("[auto-retrain] failed:", e?.message || e));
  return { fired: true, unconsumed: totalUnconsumed };
}

async function runAutoRetrain({ triggeredBy }) {
  const [labels, feedbackItems] = await Promise.all([
    LabeledReport.find({ consumedInRun: null }).select("_id").lean(),
    Feedback.find({ includedForTraining: true, consumedInRun: null }).select("_id").lean(),
  ]);

  try {
    // Pass feedback IDs to triggerRetrain so it uses those specific items
    const feedbackIds = feedbackItems.map((f) => f._id);
    const result = await triggerRetrain({ bump: "minor", triggeredBy, feedbackIds });

    // Mark labels as consumed regardless of promotion — they were used.
    if (result.runId && labels.length) {
      await LabeledReport.updateMany(
        { _id: { $in: labels.map((l) => l._id) } },
        { $set: { consumedInRun: result.runId } },
      );
    }

    // Also mark feedback as consumed
    if (result.runId && feedbackIds.length) {
      await Feedback.updateMany(
        { _id: { $in: feedbackIds } },
        { $set: { consumedInRun: result.runId } },
      );
    }

    const promoted = result?.metrics?.promoted;
    await AdminNotification.create({
      userId: triggeredBy || null,
      type: promoted ? "auto_retrain_promoted" : "auto_retrain_blocked",
      message: promoted
        ? `Auto-retrain promoted ${result.version} (accuracy ${(result.metrics.accuracy * 100).toFixed(1)}%)`
        : `Auto-retrain blocked — accuracy ${((result.metrics?.accuracy || 0) * 100).toFixed(1)}% < 95%. Model unchanged.`,
      payload: { version: result.version, metrics: result.metrics, rowsSent: result.rowsSent },
    });
  } finally {
    try { await redis.del(LOCK_KEY); } catch { /* noop */ }
  }
}

// Scheduled daily check — ensures retrain fires even if no new labels arrive
export async function scheduledAutoRetrainCheck() {
  console.log("[auto-retrain] Running scheduled check...");
  return maybeTriggerAutoRetrain({ triggeredBy: "scheduled" });
}