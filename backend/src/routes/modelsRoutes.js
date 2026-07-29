import { Router } from "express";
import { getModels } from "../controllers/modelsController.js";
const r = Router();
r.get("/", getModels);
export default r;
