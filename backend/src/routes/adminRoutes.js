import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import * as c from "../controllers/adminController.js";
import { listAdminReports, labelReport } from "../controllers/adminReportsController.js";

const r = Router();
r.use(requireAuth, requireRole("admin"));
r.get("/users", c.listUsers);
r.patch("/users/:id", c.updateUser);
r.delete("/users/:id", c.deleteUser);
r.get("/analytics", c.analytics);
r.get("/audit-logs", c.listAuditLogs);
r.get("/feedback", c.listFeedback);
r.get("/model-metrics", c.listModelMetrics);
r.get("/reports", listAdminReports);
r.post("/reports/:id/label", labelReport);
export default r;