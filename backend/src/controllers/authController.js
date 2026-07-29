import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models/User.js";
import { signAccess, signRefresh, verifyRefresh } from "../services/tokenService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { conflict, unauthorized, badRequest } from "../utils/apiError.js";

const signupSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = signupSchema.parse(req.body);
  if (await User.exists({ email: email.toLowerCase() })) throw conflict("email_taken");
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash });
  res.status(201).json({
    token: signAccess(user),
    refreshToken: signRefresh(user),
    user: user.toPublic(),
  });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || user.suspended) throw unauthorized("invalid_credentials");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw unauthorized("invalid_credentials");
  res.json({
    token: signAccess(user),
    refreshToken: signRefresh(user),
    user: user.toPublic(),
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
  let claims;
  try { claims = verifyRefresh(refreshToken); } catch { throw unauthorized("invalid_refresh"); }
  const user = await User.findById(claims.sub);
  if (!user || user.suspended) throw unauthorized("invalid_refresh");
  res.json({ token: signAccess(user), refreshToken: signRefresh(user) });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.sub);
  if (!user) throw unauthorized();
  user.resetIfNewMonth();
  await user.save();
  res.json({ user: user.toPublic() });
});

const profileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  avatarUrl: z.string().url().optional(),
});

export const updateProfile = asyncHandler(async (req, res) => {
  const patch = profileSchema.parse(req.body);
  const user = await User.findByIdAndUpdate(req.auth.sub, patch, { new: true });
  if (!user) throw unauthorized();
  res.json({ user: user.toPublic() });
});

const changePwSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(200),
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePwSchema.parse(req.body);
  const user = await User.findById(req.auth.sub).select("+passwordHash");
  if (!user) throw unauthorized();
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw badRequest("wrong_password");
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.json({ ok: true });
});

// Placeholder OAuth linking endpoint — real flow requires a Google client id.
export const linkGoogle = asyncHandler(async (req, res) => {
  const { googleId } = z.object({ googleId: z.string().min(4) }).parse(req.body);
  const user = await User.findByIdAndUpdate(req.auth.sub, { googleId }, { new: true });
  res.json({ user: user.toPublic() });
});

export const unlinkGoogle = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.auth.sub, { $unset: { googleId: 1 } }, { new: true });
  res.json({ user: user.toPublic() });
});