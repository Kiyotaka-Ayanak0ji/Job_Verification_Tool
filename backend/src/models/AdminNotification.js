import { Schema, model } from "mongoose";

const AdminNotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    message: String,
    payload: Schema.Types.Mixed,
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

export const AdminNotification = model("AdminNotification", AdminNotificationSchema);