import { Schema, model } from "mongoose";

// Event stream powering both quota enforcement and admin analytics.
// action: verify | verify_deep | pdf_export
const UsageLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, enum: ["verify", "verify_deep", "pdf_export"], required: true, index: true },
    reportId: { type: Schema.Types.ObjectId, ref: "Report" },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);

UsageLogSchema.index({ createdAt: -1 });

export const UsageLog = model("UsageLog", UsageLogSchema);