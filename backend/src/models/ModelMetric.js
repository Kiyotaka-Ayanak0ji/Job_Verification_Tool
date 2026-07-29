import { Schema, model } from "mongoose";

const ModelMetricSchema = new Schema(
  {
    modelVersion: { type: String, required: true, index: true },
    day: { type: Date, required: true, index: true },
    precision: Number,
    recall: Number,
    f1: Number,
    audits: Number,
    feedbackAgreement: Number,
    bandDistribution: { high: Number, likely: Number, caution: Number, risk: Number },
  },
  { timestamps: true },
);

ModelMetricSchema.index({ modelVersion: 1, day: 1 }, { unique: true });

export const ModelMetric = model("ModelMetric", ModelMetricSchema);