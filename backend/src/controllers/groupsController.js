import { z } from "zod";
import mongoose from "mongoose";
import { Group } from "../models/Group.js";
import { Report } from "../models/Report.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { notFound, conflict } from "../utils/apiError.js";

export const listGroups = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.auth.sub);
  const groups = await Group.find({ userId }).sort({ createdAt: 1 }).lean();
  const raw = await Report.aggregate([
    { $match: { userId } },
    { $group: { _id: "$groupId", count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(raw.map((r) => [String(r._id), r.count]));
  res.json({
    groups: groups.map((g) => ({ ...g, count: map[String(g._id)] ?? 0 })),
    ungroupedCount: map["null"] ?? 0,
  });
});

const createSchema = z.object({ name: z.string().min(1).max(80), color: z.string().optional() });

export const createGroup = asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  try {
    const g = await Group.create({ ...body, userId: req.auth.sub });
    res.status(201).json({ group: g });
  } catch (e) {
    if (e.code === 11000) throw conflict("group_exists");
    throw e;
  }
});

export const updateGroup = asyncHandler(async (req, res) => {
  const body = createSchema.partial().parse(req.body);
  const g = await Group.findOneAndUpdate({ _id: req.params.id, userId: req.auth.sub }, body, { new: true });
  if (!g) throw notFound();
  res.json({ group: g });
});

export const deleteGroup = asyncHandler(async (req, res) => {
  const g = await Group.findOneAndDelete({ _id: req.params.id, userId: req.auth.sub });
  if (!g) throw notFound();
  await Report.updateMany({ userId: req.auth.sub, groupId: g._id }, { $set: { groupId: null } });
  res.json({ ok: true });
});