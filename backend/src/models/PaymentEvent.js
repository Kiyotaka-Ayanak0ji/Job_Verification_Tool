import { Schema, model } from "mongoose";

// Idempotent audit log for every incoming billing webhook.
const PaymentEventSchema = new Schema(
  {
    provider: { type: String, enum: ["razorpay"], required: true, index: true },
    eventId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    payload: Schema.Types.Mixed,
    processedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

export const PaymentEvent = model("PaymentEvent", PaymentEventSchema);