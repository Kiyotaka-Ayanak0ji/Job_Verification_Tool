import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

// Idempotent: creates the initial admin if credentials are configured and none exists.
export async function ensureBootstrapAdmin() {
  if (!env.ADMIN_BOOTSTRAP_EMAIL || !env.ADMIN_BOOTSTRAP_PASSWORD) return;
  const exists = await User.exists({ email: env.ADMIN_BOOTSTRAP_EMAIL.toLowerCase() });
  if (exists) return;
  const passwordHash = await bcrypt.hash(env.ADMIN_BOOTSTRAP_PASSWORD, 12);
  await User.create({
    email: env.ADMIN_BOOTSTRAP_EMAIL,
    name: "Root Admin",
    passwordHash,
    role: "admin",
    plan: "pro_yearly",
  });
  console.log(`[bootstrap] admin user created: ${env.ADMIN_BOOTSTRAP_EMAIL}`);
}