import { z } from "zod";
import { User } from "../models/User.js";
import { Job } from "../models/Job.js";
import { Verification } from "../models/Verification.js";
import { Report } from "../models/Report.js";
import { UsageLog } from "../models/UsageLog.js";
import { coalesce, hashKey } from "../services/verificationCoalescer.js";
import { verifyCompany } from "../services/mlClient.js";
import { nextCount } from "../models/VerificationCounter.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { paymentRequired, unauthorized, badRequest, apiError } from "../utils/apiError.js";
import { quotasFor } from "../config/env.js";

const bodySchema = z.object({
  input: z.string().min(2).max(500),
  deepThink: z.boolean().optional().default(false),
  groupId: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
});

export const verifyCompanyController = asyncHandler(async (req, res) => {
  const { input, deepThink, groupId, model } = bodySchema.parse(req.body);
  const user = await User.findById(req.auth.sub);
  if (!user) throw unauthorized();

  user.resetIfNewMonth();

  if (user.role !== "admin") {
    const q = quotasFor(user.plan);
    if (user.searchesThisMonth >= q.verify) {
      throw paymentRequired("quota_exceeded", "Monthly verification quota reached", { quota: q.verify });
    }
    if (deepThink && user.deepThinkThisMonth >= q.deep) {
      throw paymentRequired("deep_quota_exceeded", "Deep Think quota reached", { quota: q.deep });
    }
  }

  // Spec §2.2: every 10th call bypasses enrichment cache (fresh); the
  // other 9 add small Gaussian noise so repeat inputs are never identical.
  const n = await nextCount("verify");
  const mode = n % 10 === 0 ? "fresh" : "cached";
  const noise = mode !== "fresh";
  const key = hashKey(input, deepThink ? "deep" : "std", model || "active", String(n));
  let report;
  try {
    report = await coalesce(key, () => verifyCompany({ input, deepThink, model: model || undefined, mode, noise }));
  } catch (e) {
    const status = e?.response?.status;
    const data = e?.response?.data;
    const detail = data?.detail || data?.error || e?.message || "unknown";
    console.error("[verify] ml call failed:", status, detail);
    if (e?.code === "ECONNABORTED" || /timeout/i.test(e?.message || "")) {
      throw apiError(504, "enrichment_timeout", "Enrichment pipeline timed out — try again in a moment");
    }
    if (status === 502 && data?.error === "resolve_failed") {
      throw apiError(502, "resolve_failed", "Could not resolve the company from the given input", { detail });
    }
    throw apiError(502, "ml_service_unavailable", `Scoring service error: ${detail}`);
  }
  if (!report || typeof report.trustScore !== "number" || !report.band) {
    throw badRequest("ml_bad_response", "Scoring service returned an unexpected payload");
  }

  const title = String(report.title ?? "Verification");
  const company = String(report.company ?? input);
  const source = String(report.source ?? "");
  const verificationHash = hashKey(title, company, source);
  const job = await Job.findOneAndUpdate(
    { verificationHash },
    { $setOnInsert: {
        title, company, sourceUrl: source, source: source ? "web" : "manual",
        description: report.description, verificationHash, postedAt: new Date(),
      } },
    { upsert: true, new: true },
  );

  const verification = await Verification.create({
    jobId: job._id, createdBy: user._id, deepThink,
    mode: deepThink ? "deep" : "normal",
    modelVersion: report.modelVersion,
    trustScore: report.trustScore,
    band: report.band,
    reason: report.reason,
    parameters: report.parameters,
    citations: report.citations,
  });

  const reportDoc = await Report.create({
    userId: user._id,
    verificationId: verification._id,
    jobId: job._id,
    groupId: groupId || null,
    title,
    company,
    trustScore: verification.trustScore,
    band: verification.band,
    deepThink,
  });

  user.searchesThisMonth += 1;
  if (deepThink) user.deepThinkThisMonth += 1;
  await user.save();
  await UsageLog.create({ userId: user._id, action: deepThink ? "verify_deep" : "verify", reportId: reportDoc._id });

  res.json({ report: reportDoc, verification, job, raw: report });
});