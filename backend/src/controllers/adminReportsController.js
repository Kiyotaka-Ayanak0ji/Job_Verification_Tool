import { z } from "zod";
import multer from "multer";
import { asyncHandler } from "../utils/asyncHandler.js";
import { badRequest, notFound } from "../utils/apiError.js";
import { Report } from "../models/Report.js";
import { Verification } from "../models/Verification.js";
import { Feedback } from "../models/Feedback.js";
import { LabeledReport } from "../models/LabeledReport.js";
import { RetrainRun } from "../models/RetrainRun.js";
import { BulkJob } from "../models/BulkJob.js";
import { AuditLog } from "../models/AuditLog.js";
import { maybeTriggerAutoRetrain } from "../services/autoRetrainWorker.js";
import { enqueueBulkJob } from "../services/bulkJobWorker.js";
import { bulkCsv } from "../services/mlClient.js";

// GET /api/admin/reports?page=&filter=&band=&labeled=
export const listAdminReports = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const perPage = 25;
  const filter = {};
  if (req.query.band) filter.band = req.query.band;
  const [rows, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage)
      .populate("userId", "email name")
      .populate("verificationId", "modelVersion mode parameters")
      .lean(),
    Report.countDocuments(filter),
  ]);
  const verIds = rows.map((r) => r.verificationId?._id).filter(Boolean);
  const labels = await LabeledReport.find({ verificationId: { $in: verIds } })
    .select("verificationId label labeledBy createdAt").lean();
  const labelMap = new Map(labels.map((l) => [String(l.verificationId), l]));

  let items = rows.map((r) => ({
    _id: r._id,
    company: r.company,
    title: r.title,
    trustScore: r.trustScore,
    band: r.band,
    deepThink: r.deepThink,
    createdAt: r.createdAt,
    user: r.userId ? { email: r.userId.email, name: r.userId.name } : null,
    verificationId: r.verificationId?._id,
    modelVersion: r.verificationId?.modelVersion,
    mode: r.verificationId?.mode,
    label: labelMap.get(String(r.verificationId?._id))?.label || null,
  }));

  const labeledFilter = req.query.labeled;
  if (labeledFilter === "labeled") items = items.filter((i) => i.label);
  if (labeledFilter === "unlabeled") items = items.filter((i) => !i.label);

  res.json({ items, page, perPage, total, hasMore: page * perPage < total });
});

const labelSchema = z.object({ label: z.enum(["accurate", "not_accurate"]) });

// POST /api/admin/reports/:id/label
export const labelReport = asyncHandler(async (req, res) => {
  const { label } = labelSchema.parse(req.body);
  const report = await Report.findById(req.params.id);
  if (!report) throw notFound("report_not_found");
  const verification = await Verification.findById(report.verificationId).lean();
  if (!verification) throw notFound("verification_not_found");

  // Upsert LabeledReport (one per verification).
  const labeled = await LabeledReport.findOneAndUpdate(
    { verificationId: verification._id },
    {
      $set: { label, labeledBy: req.auth.sub, reportId: report._id },
      $setOnInsert: { consumedInRun: null },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Mirror into Feedback so the existing training pipeline is fed.
  const accurate = label === "accurate";
  await Feedback.findOneAndUpdate(
    { verificationId: verification._id, userId: req.auth.sub },
    {
      $set: {
        jobId: verification.jobId,
        accurate,
        comment: `[admin-label] ${label}`,
        includedForTraining: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await AuditLog.create({
    actorId: req.auth.sub, action: "report.label", target: String(report._id),
    metadata: { label, verificationId: String(verification._id) }, ip: req.ip,
  });

  // Fire and forget — will only trigger when unconsumed >= 100.
  const trigger = await maybeTriggerAutoRetrain({ triggeredBy: req.auth.sub });
  res.json({ ok: true, labeled, trigger });
});

// GET /api/admin/ml/analytics — three tiles for the condensed page.
export const mlAnalytics = asyncHandler(async (_req, res) => {
  const [latest, accurateReports] = await Promise.all([
    RetrainRun.findOne({ status: "success" }).sort({ createdAt: -1 }).lean(),
    LabeledReport.countDocuments({ label: "accurate" }),
  ]);
  const m = latest?.metrics || {};
  res.json({
    accuracy: typeof m.accuracy === "number" ? m.accuracy : null,
    precision: typeof m.precision === "number" ? m.precision : null,
    accurateReports,
    activeVersion: latest?.version || null,
    lastRunAt: latest?.finishedAt || latest?.createdAt || null,
    lastRunPromoted: m.promoted ?? null,
  });
});

// ---- Admin CSV bulk upload ----
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
export const csvUploadMiddleware = upload.single("file");

export const bulkCsvUpload = asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest("file_required", "Attach a CSV under field name 'file'");
  const parsed = await bulkCsv(req.file.buffer, req.file.originalname);
  const rows = (parsed.rows || []).map((r) => r.input).filter(Boolean);
  if (rows.length === 0) throw badRequest("empty_csv", "No usable rows found in CSV");
  const job = await BulkJob.create({
    createdBy: req.auth.sub,
    urls: rows,
    total: rows.length,
    results: rows.map((u) => ({ url: u, status: "pending" })),
  });
  enqueueBulkJob(job._id);
  await AuditLog.create({ actorId: req.auth.sub, action: "bulk.csv", target: String(job._id),
    metadata: { count: rows.length, filename: req.file.originalname }, ip: req.ip });
  res.status(202).json({ job, count: rows.length });
});