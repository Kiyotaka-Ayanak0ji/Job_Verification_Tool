import { Schema, model } from "mongoose";

const ParameterScoreSchema = new Schema(
  { key: String, label: String, weight: Number, score: Number, status: String, evidence: String },
  { _id: false },
);
const CitationSchema = new Schema({ title: String, url: String }, { _id: false });

const VerificationSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", index: true },
    modelVersion: { type: String, required: true, index: true },
    trustScore: { type: Number, required: true },
    band: { type: String, enum: ["high", "likely", "caution", "risk"], required: true, index: true },
    reason: String,
    parameters: [ParameterScoreSchema],
    deepThink: { type: Boolean, default: false },
    mode: { type: String, enum: ["normal", "deep"], default: "normal", index: true },
    citations: { type: [CitationSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true },
);

export const Verification = model("Verification", VerificationSchema);