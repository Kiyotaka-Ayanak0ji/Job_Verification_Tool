import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import * as c from "../controllers/mlAdminController.js";
import {
  listAdminReports, labelReport, mlAnalytics,
  csvUploadMiddleware, bulkCsvUpload
} from "../controllers/adminReportsController.js";
import { fetchFeedbackByVerificationIds } from "../controllers/mlAdminController.js";

const r = Router();
r.use(requireAuth, requireRole("admin"));

// New (spec §6): condensed analytics + labeled reports + CSV bulk upload.
r.get("/analytics", mlAnalytics);
r.get("/reports", listAdminReports);
r.post("/reports/:id/label", labelReport);
r.post("/bulk/csv", csvUploadMiddleware, bulkCsvUpload);
r.post("/feedback/by-ids", fetchFeedbackByVerificationIds); // New endpoint to fetch feedback by verification IDs

r.get("/settings", c.getSettings);
r.put("/settings", c.updateSettings);
r.post("/retrain", c.runRetrain);
r.post("/rescore", c.rescoreSample);
r.post("/feedback/:id/include", c.toggleFeedbackInclude); // Toggle feedback inclusion for training
r.post("/bulk", c.startBulkJob);

// Kept for back-compat (bulk job status, notifications).
r.get("/runs", c.listRuns);
r.get("/runs/:id", c.getRun);
r.get("/bulk", c.listBulkJobs);
r.get("/bulk/:id", c.getBulkJob);
r.get("/notifications", c.listNotifications);
r.post("/notifications/read", c.markNotificationsRead);

export default r;