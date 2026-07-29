import { Schema, model } from "mongoose";

const JobSchema = new Schema(
  {
    title: { type: String, required: true, index: "text" },
    company: { type: String, required: true, index: "text" },
    location: String,
    source: String,
    sourceUrl: String,
    description: String,
    salary: String,
    verificationHash: { type: String, required: true, unique: true, index: true },
    postedAt: Date,
  },
  { timestamps: true },
);

export const Job = model("Job", JobSchema);