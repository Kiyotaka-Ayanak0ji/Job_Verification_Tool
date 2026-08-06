import { BulkJob } from "../models/BulkJob.js";
import { AdminNotification } from "../models/AdminNotification.js";
import { Verification } from "../models/Verification.js";
import { Job } from "../models/Job.js";
import { Feedback } from "../models/Feedback.js";
import { Report } from "../models/Report.js"; // ADD THIS IMPORT
import { verifyCompany } from "./mlClient.js";
import { hashKey } from "./verificationCoalescer.js";

const CONCURRENCY = 3;
const running = new Set();

// Fire-and-forget: kicks off background processing for a bulk job.
// Uses a simple bounded promise pool — no external dep, per Cloudflare-style
// serverless limits do not apply since we run on Node/Express.
export function enqueueBulkJob(jobId) {
  if (running.has(String(jobId))) return;
  running.add(String(jobId));
  processBulkJob(jobId).catch((e) => console.error("[bulk] fatal", jobId, e))
    .finally(() => running.delete(String(jobId)));
}

async function processBulkJob(jobId) {
  const job = await BulkJob.findById(jobId);
  if (!job) return;
  job.status = "running";
  job.startedAt = new Date();
  await job.save();

  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= job.urls.length) return;
      const url = job.urls[idx];
      const slot = job.results[idx];
      slot.status = "processing";
      await BulkJob.updateOne({ _id: job._id, [`results.${idx}.url`]: url }, {
        $set: { [`results.${idx}.status`]: "processing" },
      });
      try {
        const report = await verifyCompany({ input: url, deepThink: false });
        if (!report || typeof report.trustScore !== "number") throw new Error("bad_ml_response");
        const title = String(report.title ?? "Bulk verification");
        const company = String(report.company ?? url);
        const source = String(report.source ?? url);
        const verificationHash = hashKey(title, company, source);
        const jobDoc = await Job.findOneAndUpdate(
          { verificationHash },
          { $setOnInsert: { title, company, sourceUrl: source, source: "bulk",
              description: report.description, verificationHash, postedAt: new Date() } },
          { upsert: true, new: true },
        );
        const ver = await Verification.create({
          jobId: jobDoc._id, createdBy: job.createdBy, deepThink: false,
          modelVersion: report.modelVersion, trustScore: report.trustScore, band: report.band,
          reason: report.reason, parameters: report.parameters, citations: report.citations,
        });
        // CREATE REPORT RECORD (MISSING FROM ORIGINAL CODE)
        const reportDoc = await Report.create({
          userId: job.createdBy,
          verificationId: ver._id,
          jobId: jobDoc._id,
          title,
          company,
          trustScore: ver.trustScore,
          band: ver.band,
          deepThink: false,
        });
        // Auto-create a training-eligible Feedback stub so admins can review
        // + include in the next retrain from the ML admin page.
        await Feedback.create({
          jobId: jobDoc._id, verificationId: ver._id, userId: job.createdBy,
          accurate: report.trustScore >= 70,
          comment: `[bulk] auto-generated from ${url}`,
          includedForTraining: false, // admin opts in on the retrain page
        });
        await BulkJob.updateOne({ _id: job._id }, {
          $set: {
            [`results.${idx}.status`]: "success",
            [`results.${idx}.verificationId`]: ver._id,
            [`results.${idx}.reportId`]: reportDoc._id, // ALSO STORE REFERENCE TO REPORT
            [`results.${idx}.company`]: company,
            [`results.${idx}.trustScore`]: report.trustScore,
            [`results.${idx}.band`]: report.band,
          },
          $inc: { processed: 1 },
        });
      } catch (err) {
        await BulkJob.updateOne({ _id: job._id }, {
          $set: {
            [`results.${idx}.status`]: "failed",
            [`results.${idx}.error`]: err?.response?.data?.detail || err.message,
          },
          $inc: { processed: 1 },
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, job.urls.length) }, worker);
  await Promise.all(workers);

  const final = await BulkJob.findById(jobId);
  final.status = "completed";
  final.finishedAt = new Date();
  await final.save();

  await AdminNotification.create({
    userId: final.createdBy,
    type: "bulk_complete",
    message: `Bulk training finished — ${final.results.filter(r => r.status === "success").length}/${final.urls.length} succeeded`,
    payload: { jobId: String(final._id) },
  });
  // Silence unused var
  void queue;
}