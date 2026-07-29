import { listModels } from "../services/mlClient.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export const getModels = asyncHandler(async (_req, res) => {
  try { res.json(await listModels()); }
  catch { res.json({ models: [], active: null }); }
});
