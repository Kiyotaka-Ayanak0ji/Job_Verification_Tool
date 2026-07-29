import { Schema, model } from "mongoose";

// User-facing verification history entry (what the dashboard shows).
// Wraps a Verification with grouping + display metadata the user controls.
const ReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    verificationId: { type: Schema.Types.ObjectId, ref: "Verification", required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
    groupId: { type: Schema.Types.ObjectId, ref: "Group", default: null, index: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    trustScore: Number,
    band: String,
    deepThink: { type: Boolean, default: false },
    starred: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ReportSchema.index({ userId: 1, createdAt: -1 });

export const Report = model("Report", ReportSchema);