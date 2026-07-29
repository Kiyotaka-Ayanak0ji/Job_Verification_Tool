import { Schema, model } from "mongoose";

const BulkResultSchema = new Schema(
  {
    url: String,
    status: { type: String, enum: ["pending", "processing", "success", "failed"], default: "pending" },
    verificationId: { type: Schema.Types.ObjectId, ref: "Verification" },
    reportId: { type: Schema.Types.ObjectId, ref: "Report" }, // ADD THIS
    company: String,
    trustScore: Number,
    band: String,
    error: String,
  },
  { _id: false },
);

const BulkJobSchema = new Schema(
  {
    status: { type: String, enum: ["queued", "running", "completed", "failed"], default: "queued", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    urls: [String],
    results: [BulkResultSchema],
    processed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    error: String,
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true },
);

export const BulkJob = model("BulkJob", BulkJobSchema);