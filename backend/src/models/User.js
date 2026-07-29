import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    plan: { type: String, enum: ["free", "pro_monthly", "pro_yearly"], default: "free" },
    // Monthly usage counters. Reset by the periodResetAt cron / on-read check.
    searchesThisMonth: { type: Number, default: 0 },
    deepThinkThisMonth: { type: Number, default: 0 },
    pdfExportsThisMonth: { type: Number, default: 0 },
    quotaResetAt: { type: Date, default: () => new Date() },
    suspended: { type: Boolean, default: false },
    googleId: { type: String, index: true, sparse: true },
    avatarUrl: String,
    billing: {
      provider: { type: String, enum: ["razorpay", null], default: null },
      customerId: String,
      subscriptionId: String,
      status: String,          // active | past_due | canceled | ...
      currentPeriodEnd: Date,
      cancelAtPeriodEnd: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

// Reset counters if we've crossed a calendar month boundary.
UserSchema.methods.resetIfNewMonth = function () {
  const now = new Date();
  const last = this.quotaResetAt ?? now;
  if (last.getUTCFullYear() !== now.getUTCFullYear() || last.getUTCMonth() !== now.getUTCMonth()) {
    this.searchesThisMonth = 0;
    this.deepThinkThisMonth = 0;
    this.pdfExportsThisMonth = 0;
    this.quotaResetAt = now;
  }
};

UserSchema.methods.toPublic = function () {
  return {
    id: String(this._id),
    email: this.email,
    name: this.name,
    role: this.role,
    plan: this.plan,
    avatarUrl: this.avatarUrl,
    googleLinked: !!this.googleId,
    searchesThisMonth: this.searchesThisMonth,
    deepThinkThisMonth: this.deepThinkThisMonth,
    pdfExportsThisMonth: this.pdfExportsThisMonth,
    quotaResetAt: this.quotaResetAt,
    suspended: this.suspended,
    billing: this.billing
      ? {
          provider: this.billing.provider || null,
          status: this.billing.status || null,
          currentPeriodEnd: this.billing.currentPeriodEnd || null,
          cancelAtPeriodEnd: !!this.billing.cancelAtPeriodEnd,
        }
      : null,
    createdAt: this.createdAt,
  };
};

export const User = model("User", UserSchema);