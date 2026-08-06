import axios from "axios";
import { env } from "../config/env.js";
import { Feedback } from "../models/Feedback.js";
import { ModelMetric } from "../models/ModelMetric.js";
import { Verification } from "../models/Verification.js";
import { RetrainRun } from "../models/RetrainRun.js";
import { getActiveSetting } from "../models/ModelSetting.js";
import { feedbackToTrainingRows } from "../controllers/feedbackController.js";

// Build the payload the Flask /retrain endpoint expects (see ml-service/app.py).
async function buildTrainingRows({ since, feedbackIds } = {}) {
  let filter = { includedForTraining: true };
  if (feedbackIds?.length) {
    filter = { _id: { $in: feedbackIds }, includedForTraining: true };
  } else if (since) {
    filter.createdAt = { $gt: since };
  }
  const rows = await Feedback.find(filter)
    .sort({ createdAt: -1 })
    .limit(2000)
    .populate("verificationId", "parameters modelVersion")
    .lean();

  // Convert to ML service format using shared transformation
  const mlRows = feedbackToTrainingRows(rows);

  // Also return original rows for tracking
  return rows.map((r, i) => ({
    ...mlRows[i],
    feedback_id: String(r._id),
    sub_scores: mlRows[i].sub_scores,
    jd_text: mlRows[i].jd_text,
    jd_label: mlRows[i].jd_label,
    model_version: mlRows[i].model_version,
  })).filter((r) => Object.keys(r.sub_scores).length > 0);
}

export async function triggerRetrain({ since = null, bump = "patch", feedbackIds = null, triggeredBy = null } = {}) {
  const rows = await buildTrainingRows({ since, feedbackIds });
  const run = await RetrainRun.create({
    status: "running", bump, triggeredBy, feedbackIds: feedbackIds || [],
    rowsSent: rows.length, startedAt: new Date(),
  });
  const client = axios.create({
    baseURL: env.FLASK_URL,
    timeout: 120_000,
    headers: env.ML_SERVICE_API_KEY ? { "x-api-key": env.ML_SERVICE_API_KEY } : {},
  });
  let data;
  try {
    // Push current settings alongside training payload so Flask can honor
    // admin-tuned weights/thresholds on the next model version.
    const setting = await getActiveSetting();
    const settingsPayload = {
      weights: setting.weights?.toObject ? setting.weights.toObject() : setting.weights,
      thresholds: setting.thresholds?.toObject ? setting.thresholds.toObject() : setting.thresholds,
    };
    ({ data } = await client.post(`/retrain?bump=${encodeURIComponent(bump)}`, { rows, settings: settingsPayload }));
  } catch (err) {
    run.status = "failed";
    run.error = err?.response?.data?.error || err.message;
    run.finishedAt = new Date();
    await run.save();
    throw err;
  }
  // Persist a metric row for the analytics dashboard.
  if (data?.version) {
    const metrics = data.metrics || {};
    try {
      await ModelMetric.updateOne(
        { modelVersion: data.version, day: startOfDay(new Date()) },
        {
          $set: {
            precision: metrics.precision, recall: metrics.recall, f1: metrics.f1,
            audits: metrics.n_feedback ?? rows.length,
            feedbackAgreement: metrics.accuracy,
            bandDistribution: await bandDistribution(),
          },
        },
        { upsert: true },
      );
    } catch (err) {
      console.warn("[retrain] failed to persist ModelMetric:", err.message);
    }
  }
  run.status = "success";
  run.version = data?.version;
  run.metrics = data?.metrics || {};
  run.finishedAt = new Date();
  await run.save();
  // Mark rows as consumed so subsequent "pending" queries hide them.
  const ids = rows.map((r) => r.feedback_id).filter(Boolean);
  if (ids.length) {
    await Feedback.updateMany({ _id: { $in: ids } }, { $set: { consumedInRun: run._id } });
  }
  return { rowsSent: rows.length, runId: String(run._id), ...data };
}

function startOfDay(d) { const c = new Date(d); c.setUTCHours(0, 0, 0, 0); return c; }

async function bandDistribution() {
  const agg = await Verification.aggregate([
    { $group: { _id: "$band", count: { $sum: 1 } } },
  ]);
  const out = { high: 0, likely: 0, caution: 0, risk: 0 };
  for (const { _id, count } of agg) if (_id && out[_id] !== undefined) out[_id] = count;
  return out;
}

// Export the transformation function for external use
export { feedbackToTrainingRows };