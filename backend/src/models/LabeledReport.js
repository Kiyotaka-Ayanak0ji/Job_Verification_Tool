import { Schema, model } from "mongoose";

// Every admin label produces one LabeledReport. When the count of
// unconsumed rows crosses AUTO_RETRAIN_THRESHOLD, the auto-retrain
// worker fires (spec §5: zero-manual retraining).
const LabeledReportSchema = new Schema(
  {
    verificationId: { type: Schema.Types.ObjectId, ref: "Verification", required: true, index: true },
    reportId: { type: Schema.Types.ObjectId, ref: "Report", required: true, index: true },
    label: { type: String, enum: ["accurate", "not_accurate"], required: true },
    labeledBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    consumedInRun: { type: Schema.Types.ObjectId, ref: "RetrainRun", default: null, index: true },
  },
  { timestamps: true },
);

LabeledReportSchema.index({ verificationId: 1 }, { unique: true });

export const LabeledReport = model("LabeledReport", LabeledReportSchema);
export const AUTO_RETRAIN_THRESHOLD = 100;