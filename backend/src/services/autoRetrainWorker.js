import { redis } from "../config/redis.js";
import { LabeledReport, AUTO_RETRAIN_THRESHOLD } from "../models/LabeledReport.js";
import { AdminNotification } from "../models/AdminNotification.js";
import { triggerRetrain } from "./retrainService.js";

const LOCK_KEY = "retrain:lock";
const LOCK_TTL_SECONDS = 30 * 60; // 30 min

// Called after every admin label. If unconsumed labels crossed the
// threshold, acquire a redis lock and fire a retrain. Idempotent.
export async function maybeTriggerAutoRetrain({ triggeredBy = null } = {}) {
  const unconsumed = await LabeledReport.countDocuments({ consumedInRun: null });
  if (unconsumed < AUTO_RETRAIN_THRESHOLD) {
    return { fired: false, unconsumed, threshold: AUTO_RETRAIN_THRESHOLD };
  }
  // NX + EX ensures a single winner across replicas for LOCK_TTL_SECONDS.
  let locked;
  try {
    locked = await redis.set(LOCK_KEY, String(Date.now()), "EX", LOCK_TTL_SECONDS, "NX");
  } catch (e) {
    console.warn("[auto-retrain] redis lock unavailable, falling back:", e.message);
    locked = "OK"; // fail open — better to retry than never train
  }
  if (locked !== "OK") return { fired: false, unconsumed, reason: "locked" };

  // Run in background so the label API stays snappy.
  runAutoRetrain({ triggeredBy }).catch((e) =>
    console.error("[auto-retrain] failed:", e?.message || e));
  return { fired: true, unconsumed };
}

async function runAutoRetrain({ triggeredBy }) {
  const labels = await LabeledReport.find({ consumedInRun: null }).select("_id").lean();
  try {
    const result = await triggerRetrain({ bump: "minor", triggeredBy });
    // Mark labels as consumed regardless of promotion — they were used.
    if (result.runId && labels.length) {
      await LabeledReport.updateMany(
        { _id: { $in: labels.map((l) => l._id) } },
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
      payload: { version: result.version, metrics: result.metrics },
    });
  } finally {
    try { await redis.del(LOCK_KEY); } catch { /* noop */ }
  }
}