import cron from "node-cron";
import { env } from "../config/env.js";
import { Feedback } from "../models/Feedback.js";
import { ModelMetric } from "../models/ModelMetric.js";
import { triggerRetrain } from "../services/retrainService.js";

export function startRetrainCron() {
  if (env.DISABLE_CRON === "1" || env.NODE_ENV === "test") {
    console.log("[retrain-cron] disabled");
    return;
  }
  if (!cron.validate(env.RETRAIN_CRON)) {
    console.warn(`[retrain-cron] invalid RETRAIN_CRON expression "${env.RETRAIN_CRON}" — skipping`);
    return;
  }
  cron.schedule(env.RETRAIN_CRON, runIfDue, { timezone: "UTC" });
  console.log(`[retrain-cron] scheduled ${env.RETRAIN_CRON} (>= ${env.RETRAIN_MIN_FEEDBACK} new rows)`);
}

async function runIfDue() {
  try {
    const last = await ModelMetric.findOne().sort({ createdAt: -1 }).lean();
    const since = last?.createdAt || null;
    const newRows = await Feedback.countDocuments(since ? { createdAt: { $gt: since } } : {});
    if (newRows < env.RETRAIN_MIN_FEEDBACK) {
      console.log(`[retrain-cron] skip: ${newRows}/${env.RETRAIN_MIN_FEEDBACK} new feedback rows`);
      return;
    }
    console.log(`[retrain-cron] running retrain on ${newRows} new rows`);
    const result = await triggerRetrain({ since, bump: "patch" });
    console.log("[retrain-cron] done:", result.version, result.metrics);
  } catch (err) {
    console.error("[retrain-cron] failed:", err.message);
  }
}