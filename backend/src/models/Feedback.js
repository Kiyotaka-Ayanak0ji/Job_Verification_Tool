import { Schema, model } from "mongoose";

const FeedbackSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    verificationId: { type: Schema.Types.ObjectId, ref: "Verification", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accurate: { type: Boolean, required: true },
    comment: String,
    userRating: { type: Number, min: 1, max: 5 },
    userReview: { type: String, enum: ["positive", "moderate", "negative", null], default: null },
    includedForTraining: { type: Boolean, default: true, index: true },
    consumedInRun: { type: Schema.Types.ObjectId, ref: "RetrainRun", default: null, index: true },
    effectiveLabel: { type: Number, min: 0, max: 1 }, // set by ML soft-label logic
  },
  { timestamps: true },
);

export const Feedback = model("Feedback", FeedbackSchema);