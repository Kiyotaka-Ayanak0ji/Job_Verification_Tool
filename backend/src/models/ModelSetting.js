import { Schema, model } from "mongoose";

// Singleton document holding runtime-tunable ML model settings.
// Weights are keyed by SUB_KEYS in ml-service; thresholds map to bands.py.
const ModelSettingSchema = new Schema(
  {
    key: { type: String, default: "active", unique: true, index: true },
    weights: {
      legal: { type: Number, default: 0.2 },
      gstin: { type: Number, default: 0.15 },
      reputation: { type: Number, default: 0.2 },
      domain: { type: Number, default: 0.1 },
      jd: { type: Number, default: 0.15 },
      consistency: { type: Number, default: 0.1 },
      financial: { type: Number, default: 0.05 },
      complaints: { type: Number, default: 0.05 },
    },
    thresholds: {
      high: { type: Number, default: 90 },
      likely: { type: Number, default: 70 },
      caution: { type: Number, default: 40 },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const ModelSetting = model("ModelSetting", ModelSettingSchema);

export async function getActiveSetting() {
  let doc = await ModelSetting.findOne({ key: "active" });
  if (!doc) doc = await ModelSetting.create({ key: "active" });
  return doc;
}