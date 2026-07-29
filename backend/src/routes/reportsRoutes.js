import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as c from "../controllers/reportsController.js";

const r = Router();
r.use(requireAuth);
r.get("/", c.listReports);
r.get("/:id", c.getReport);
r.patch("/:id", c.updateReport);
r.delete("/:id", c.deleteReport);
r.post("/:id/pdf-export", c.consumePdfQuota);
export default r;