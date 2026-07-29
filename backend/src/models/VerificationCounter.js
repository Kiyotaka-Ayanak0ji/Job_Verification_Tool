import { Schema, model } from "mongoose";
// Global monotonic counter used to force fresh enrichment every Nth call (spec §2.2).
const CounterSchema = new Schema({ key: { type: String, unique: true }, value: { type: Number, default: 0 } });
export const VerificationCounter = model("VerificationCounter", CounterSchema);
export async function nextCount(key = "verify") {
  const doc = await VerificationCounter.findOneAndUpdate(
    { key }, { $inc: { value: 1 } }, { upsert: true, new: true },
  );
  return doc.value;
}
