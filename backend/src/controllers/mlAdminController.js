import { z } from "zod";
import mongoose from "mongoose";
import { Group } from "../models/Group.js";
import { Report } from "../models/Report.js";
import { Verification } from "../models/Verification.js";
import { Feedback } from "../models/Feedback.js";
import { RetrainRun } from "../models/RetrainRun.js";
import { BulkJob } from "../models/BulkJob.js";
import { AdminNotification } from "../models/AdminNotification.js";
import { ModelSetting } from "../models/ModelSetting.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { notFound, conflict } from "../utils/apiError.js";
import { triggerRetrain } from "../services/retrainService.js";
import { enqueueBulkJob } from "../services/bulkJobWorker.js";

// ---------- fetch feedback by verification IDs ----------
const feedbackIdsSchema = z.object({
  verificationIds: z.array(z.string()).min(1)
});
export const fetchFeedbackByVerificationIds = asyncHandler(async (req, res) => {
  const { verificationIds } = feedbackIdsSchema.parse(req.body);

  const feedback = await Feedback.find({ verificationId: { $in: verificationIds } })
    .select("_id verificationId includedForTraining accurate comment createdAt")
    .lean();

  res.json({ feedback });
});

// ---------- get settings ----------
export const getSettings = asyncHandler(async (_req, res) => {
  const setting = await ModelSetting.getActiveSetting();
  res.json({
    weights: setting.weights,
    thresholds: setting.thresholds
  });
});

// ---------- update settings ----------
const settingsSchema = z.object({
  weights: z.object({
    legal: z.number().min(0).max(1).optional(),
    gstin: z.number().min(0).max(1).optional(),
    reputation: z.number().min(0).max(1).optional(),
    domain: z.number().min(0).max(1).optional(),
    jd: z.number().min(0).max(1).optional(),
    consistency: z.number().min(0).max(1).optional(),
    financial: z.number().min(0).max(1).optional(),
    complaints: z.number().min(0).max(1).optional()
  }).optional(),
  thresholds: z.object({
    high: z.number().min(0).max(100).optional(),
    likely: z.number().min(0).max(100).optional(),
    caution: z.number().min(0).max(100).optional()
  }).optional()
});
export const updateSettings = asyncHandler(async (req, res) => {
  const updates = settingsSchema.parse(req.body);
  let setting = await ModelSetting.findOne({ key: "active" });
  if (!setting) {
    setting = await ModelSetting.create({ key: "active" });
  }

  if (updates.weights) {
    setting.weights = { ...setting.weights, ...updates.weights };
  }
  if (updates.thresholds) {
    setting.thresholds = { ...setting.thresholds, ...updates.thresholds };
  }

  await setting.save();
  res.json({ setting });
});

// ---------- retrain ----------
const retrainSchema = z.object({
  bump: z.enum(["patch", "minor", "major"]).optional()
});
export const runRetrain = asyncHandler(async (req, res) => {
  const { bump = "patch" } = retrainSchema.parse(req.body);
  const result = await triggerRetrain({ bump, triggeredBy: req.auth.sub });
  res.json(result);
});

// ---------- rescore sample ----------
const rescoreSchema = z.object({
  verificationIds: z.array(z.string())
});
export const rescoreSample = asyncHandler(async (req, res) => {
  const { verificationIds } = rescoreSchema.parse(req.body);
  
  // Get the verifications
  const verifications = await Verification.find({ _id: { $in: verificationIds } })
    .populate("jobId")
    .lean();
  
  if (!verifications || verifications.length === 0) {
    throw notFound("no_verifications_found");
  }
  
  // For each verification, rescore using the ML service
  const results = [];
  for (const ver of verifications) {
    try {
      const payload = {
        input: ver.jobId.title + " " + ver.jobId.company, // Simplified - in reality would use proper scoring payload
        model: ver.modelVersion
      };
      
      // In a real implementation, we'd call the ML service to score
      // For now, we'll just return the verification data
      results.push({
        verificationId: ver._id,
        trustScore: ver.trustScore,
        band: ver.band,
        modelVersion: ver.modelVersion
      });
    } catch (error) {
      results.push({
        verificationId: ver._id,
        error: error.message
      });
    }
  }
  
  res.json({ results });
});

// ---------- toggle feedback inclusion ----------
const toggleFeedbackSchema = z.object({
  include: z.boolean()
});
export const toggleFeedbackInclude = asyncHandler(async (req, res) => {
  const { include } = toggleFeedbackSchema.parse(req.body);
  const { id } = req.params;

  const feedback = await Feedback.findById(id);
  if (!feedback) {
    throw notFound("feedback_not_found");
  }

  feedback.includedForTraining = include;
  await feedback.save();

  res.json({ feedback });
});

// ---------- start bulk job ----------
export const startBulkJob = asyncHandler(async (req, res) => {
  const { urls } = req.body;
  
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("urls must be a non-empty array");
  }

  const job = await BulkJob.create({
    createdBy: req.auth.sub,
    urls,
    total: urls.length,
    results: urls.map(url => ({ url, status: "pending" }))
  });

  // Fire-and-forget: kicks off background processing
  enqueueBulkJob(job._id);

  res.status(202).json({ job });
});

// ---------- list retrain runs ----------
export const listRuns = asyncHandler(async (_req, res) => {
  const runs = await RetrainRun.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ runs });
});

// ---------- get retrain run ----------
export const getRun = asyncHandler(async (req, res) => {
  const run = await RetrainRun.findById(req.params.id).lean();
  if (!run) throw notFound("run_not_found");
  
  res.json({ run });
});

// ---------- list bulk jobs ----------
export const listBulkJobs = asyncHandler(async (_req, res) => {
  const jobs = await BulkJob.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ jobs });
});

// ---------- get bulk job ----------
export const getBulkJob = asyncHandler(async (req, res) => {
  const job = await BulkJob.findById(req.params.id).lean();
  if (!job) throw notFound("job_not_found");
  
  res.json({ job });
});

// ---------- list notifications ----------
export const listNotifications = asyncHandler(async (_req, res) => {
  const notifications = await AdminNotification.find({ userId: req.auth.sub })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ notifications });
});

// ---------- mark notifications read ----------
export const markNotificationsRead = asyncHandler(async (_req, res) => {
  await AdminNotification.updateMany(
    { userId: req.auth.sub, read: false },
    { $set: { read: true } }
  );

  res.json({ success: true });
});
