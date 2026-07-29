import { z } from "zod";
import { User } from "../models/User.js";
import { Verification } from "../models/Verification.js";
import { Feedback } from "../models/Feedback.js";
import { Report } from "../models/Report.js";
import { Group } from "../models/Group.js";
import { UsageLog } from "../models/UsageLog.js";
import { AuditLog } from "../models/AuditLog.js";
import { ModelMetric } from "../models/ModelMetric.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { notFound, badRequest } from "../utils/apiError.js";
import { triggerRetrain } from "../services/retrainService.js";
import { listAllFeedback as listFeedbackController } from "./feedbackController.js";

export const listFeedback = listFeedbackController;

export const retrain = asyncHandler(async (req, res) => {
  const bump = ["patch", "minor", "major"].includes(req.body?.bump) ? req.body.bump : "patch";
  const result = await triggerRetrain({ bump });
  await AuditLog.create({
    actorId: req.auth.sub, action: "model.retrain", target: result.version || "unknown",
    metadata: { rowsSent: result.rowsSent, metrics: result.metrics }, ip: req.ip,
  });
  res.json(result);
});

export const listModelMetrics = asyncHandler(async (_req, res) => {
  const metrics = await ModelMetric.find().sort({ createdAt: -1 }).limit(30).lean();
  res.json({ metrics });
});

export const listUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const filter = q ? { $or: [{ email: new RegExp(q, "i") }, { name: new RegExp(q, "i") }] } : {};
  const users = await User.find(filter).limit(500).lean();
  res.json({
    users: users.map((u) => ({
      id: String(u._id),
      email: u.email,
      name: u.name,
      role: u.role,
      plan: u.plan,
      suspended: u.suspended,
      searchesThisMonth: u.searchesThisMonth,
      deepThinkThisMonth: u.deepThinkThisMonth,
      pdfExportsThisMonth: u.pdfExportsThisMonth,
      createdAt: u.createdAt,
    })),
  });
});

const patchSchema = z.object({
  role: z.enum(["user", "admin"]).optional(),
  plan: z.enum(["free", "pro_monthly", "pro_yearly"]).optional(),
  suspended: z.boolean().optional(),
});

export const updateUser = asyncHandler(async (req, res) => {
  const patch = patchSchema.parse(req.body);
  const user = await User.findByIdAndUpdate(req.params.id, patch, { new: true });
  if (!user) throw notFound();
  await AuditLog.create({
    actorId: req.auth.sub, action: "user.update", target: req.params.id, metadata: patch, ip: req.ip,
  });
  res.json({ user: user.toPublic() });
});

// Permanently erase a user and every record tied to them.
export const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.auth.sub) throw badRequest("cannot_delete_self");
  const target = await User.findById(req.params.id).select("email role");
  if (!target) throw notFound();
  const [ver, fb, rp, gp, ul] = await Promise.all([
    Verification.deleteMany({ createdBy: target._id }),
    Feedback.deleteMany({ userId: target._id }),
    Report.deleteMany({ userId: target._id }),
    Group.deleteMany({ userId: target._id }),
    UsageLog.deleteMany({ userId: target._id }),
  ]);
  await User.deleteOne({ _id: target._id });
  await AuditLog.create({
    actorId: req.auth.sub, action: "user.delete", target: String(target._id),
    metadata: {
      email: target.email, role: target.role,
      verificationsRemoved: ver.deletedCount, feedbackRemoved: fb.deletedCount,
      reportsRemoved: rp.deletedCount, groupsRemoved: gp.deletedCount, usageRemoved: ul.deletedCount,
    },
    ip: req.ip,
  });
  res.json({ ok: true });
});

export const analytics = asyncHandler(async (_req, res) => {
  const [
    totalUsers, totalReports, totalVerifications, totalFeedback, agreed,
    bandAgg, planAgg, dailyMetrics,
  ] = await Promise.all([
    User.countDocuments(),
    Report.countDocuments(),
    Verification.countDocuments(),
    Feedback.countDocuments(),
    Feedback.countDocuments({ accurate: true }),
    Verification.aggregate([{ $group: { _id: "$band", count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),
    ModelMetric.find().sort({ day: -1 }).limit(7).lean(),
  ]);

  // 30-day verification volume from UsageLog for the chart.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const volume = await UsageLog.aggregate([
    { $match: { createdAt: { $gte: since }, action: { $in: ["verify", "verify_deep"] } } },
    { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
        deep: { $sum: { $cond: [{ $eq: ["$action", "verify_deep"] }, 1, 0] } },
      } },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    totals: { users: totalUsers, reports: totalReports, verifications: totalVerifications, feedback: totalFeedback },
    feedbackAgreement: totalFeedback ? agreed / totalFeedback : 0,
    bandDistribution: bandAgg,
    planDistribution: planAgg,
    dailyMetrics: dailyMetrics.reverse(),
    dailyVolume: volume,
  });
});

export const listAuditLogs = asyncHandler(async (_req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean();
  res.json({ logs });
});