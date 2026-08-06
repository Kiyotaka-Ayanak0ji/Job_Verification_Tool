import { z } from "zod";
import { Feedback } from "../models/Feedback.js";
import { Verification } from "../models/Verification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { badRequest, notFound } from "../utils/apiError.js";

const submitSchema = z.object({
  verificationId: z.string().min(6),
  accurate: z.boolean(),
  tags: z.array(z.string().max(40)).max(6).optional(),
  comment: z.string().max(2000).optional(),
  userRating: z.number().int().min(1).max(5).optional(),
  userReview: z.enum(["positive", "moderate", "negative"]).optional(),
});

export const submitFeedback = asyncHandler(async (req, res) => {
  const { verificationId, accurate, tags, comment, userRating, userReview } = submitSchema.parse(req.body);
  const ver = await Verification.findById(verificationId).lean();
  if (!ver) throw notFound("verification_not_found");
  const noteParts = [];
  if (tags?.length) noteParts.push(`tags: ${tags.join(", ")}`);
  if (comment) noteParts.push(comment);
  const fb = await Feedback.create({
    verificationId, jobId: ver.jobId, userId: req.auth.sub, accurate,
    comment: noteParts.join(" | ") || undefined,
    userRating, userReview: userReview || null,
  });
  res.status(201).json({ feedback: fb });
});

export const listMyFeedback = asyncHandler(async (req, res) => {
  const rows = await Feedback.find({ userId: req.auth.sub }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({ feedback: rows });
});

export const listAllFeedback = asyncHandler(async (req, res) => {
  const label = req.query.label;
  const filter = {};
  if (label === "accurate") filter.accurate = true;
  if (label === "inaccurate") filter.accurate = false;
  if (req.query.pending === "1") filter.consumedInRun = null;
  const rows = await Feedback.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("userId", "email name")
    .populate("jobId", "company title")
    .lean();
  res.json({
    feedback: rows.map((r) => ({
      _id: r._id, accurate: r.accurate, comment: r.comment, createdAt: r.createdAt,
      userRating: r.userRating, userReview: r.userReview,
      includedForTraining: r.includedForTraining, consumedInRun: r.consumedInRun,
      effectiveLabel: r.effectiveLabel,
      user: r.userId ? { email: r.userId.email, name: r.userId.name } : null,
      job: r.jobId ? { company: r.jobId.company, title: r.jobId.title } : null,
      jobId: r.jobId?._id, verificationId: r.verificationId,
    })),
  });
});

/**
 * Transform Feedback documents into ML service training row format.
 * This is the single source of truth for how feedback becomes training data.
 *
 * @param {Array} rows - Array of Feedback documents (from DB, with populated verificationId)
 * @returns {Array} Array of training rows compatible with Flask /retrain endpoint
 */
export function feedbackToTrainingRows(rows) {
  return rows.map((r) => {
    const params = r.verificationId?.parameters || [];
    const subs = {};
    for (const p of params) if (p?.key) subs[p.key] = p.score;

    return {
      feedback_id: String(r._id),
      verdict: r.accurate ? "accurate" : "inaccurate",
      label: r.accurate ? 1 : 0,
      sub_scores: subs,
      jd_text: r.jdText || r.comment || null, // Use comment as JD text if available
      jd_label: r.jdLabel ?? null,
      user_id: String(r.userId),
      job_id: String(r.jobId),
      model_version: r.verificationId?.modelVersion,
      user_rating: r.userRating || null,
      user_review: r.userReview || null,
      comment: r.comment || null,
    };
  }).filter((r) => Object.keys(r.sub_scores).length > 0);
}

// Backward-compatible alias
export function feedbackToTrainingRowsLegacy(rows) {
  return rows.map((r) => ({
    verdict: r.accurate ? "accurate" : "inaccurate",
    label: r.accurate ? 1 : 0,
    sub_scores: r.subScores || {},
    jd_text: r.jdText || null,
    jd_label: r.jdLabel ?? null,
    user_id: String(r.userId),
    job_id: String(r.jobId),
  }));
}