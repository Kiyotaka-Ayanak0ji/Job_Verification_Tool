import { Schema, model } from "mongoose";

const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true, index: true },
    target: String,
    metadata: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true },
);

export const AuditLog = model("AuditLog", AuditLogSchema);