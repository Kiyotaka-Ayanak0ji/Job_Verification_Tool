import { z } from "zod";
import { Report } from "../models/Report.js";
import { Verification } from "../models/Verification.js";
import { Job } from "../models/Job.js";
import { User } from "../models/User.js";
import { UsageLog } from "../models/UsageLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { notFound, paymentRequired } from "../utils/apiError.js";
import { quotasFor } from "../config/env.js";

export const listReports = asyncHandler(async (req, res) => {
  const { groupId } = req.query;
  const filter = { userId: req.auth.sub };
  if (groupId === "none") filter.groupId = null;
  else if (groupId) filter.groupId = groupId;
  const reports = await Report.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ reports });
});

export const getReport = asyncHandler(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, userId: req.auth.sub }).lean();
  if (!report) throw notFound();
  const [verification, job] = await Promise.all([
    Verification.findById(report.verificationId).lean(),
    Job.findById(report.jobId).lean(),
  ]);
  res.json({ report, verification, job: job || null });
});

const patchSchema = z.object({
  groupId: z.string().nullable().optional(),
  starred: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
});

export const updateReport = asyncHandler(async (req, res) => {
  const patch = patchSchema.parse(req.body);
  const report = await Report.findOneAndUpdate(
    { _id: req.params.id, userId: req.auth.sub },
    patch,
    { new: true },
  );
  if (!report) throw notFound();
  res.json({ report });
});

export const deleteReport = asyncHandler(async (req, res) => {
  const report = await Report.findOneAndDelete({ _id: req.params.id, userId: req.auth.sub });
  if (!report) throw notFound();
  // Verification kept as an anonymised historical record for admin analytics.
  res.json({ ok: true });
});

export const consumePdfQuota = asyncHandler(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, userId: req.auth.sub });
  if (!report) throw notFound();
  const user = await User.findById(req.auth.sub);
  user.resetIfNewMonth();
  if (user.role !== "admin") {
    const q = quotasFor(user.plan);
    if (user.pdfExportsThisMonth >= q.pdf) {
      throw paymentRequired("pdf_quota_exceeded", "Monthly PDF export quota reached", { quota: q.pdf });
    }
  }
  user.pdfExportsThisMonth += 1;
  await user.save();
  await UsageLog.create({ userId: user._id, action: "pdf_export", reportId: report._id });
  res.json({ ok: true, pdfExportsThisMonth: user.pdfExportsThisMonth });
});