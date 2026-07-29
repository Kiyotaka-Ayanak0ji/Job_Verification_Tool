import { Schema, model } from "mongoose";

const RetrainRunSchema = new Schema(
  {
    status: { type: String, enum: ["queued", "running", "success", "failed"], default: "queued", index: true },
    bump: { type: String, enum: ["patch", "minor", "major"], default: "patch" },
    triggeredBy: { type: Schema.Types.ObjectId, ref: "User" },
    feedbackIds: [{ type: Schema.Types.ObjectId, ref: "Feedback" }],
    rowsSent: Number,
    version: String,
    metrics: Schema.Types.Mixed,
    error: String,
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true },
);

export const RetrainRun = model("RetrainRun", RetrainRunSchema);