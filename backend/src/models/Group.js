import { Schema, model } from "mongoose";

// Named folder for organising Reports. Owned by a single user.
const GroupSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    color: { type: String, default: "cyan" },
  },
  { timestamps: true },
);

GroupSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Group = model("Group", GroupSchema);