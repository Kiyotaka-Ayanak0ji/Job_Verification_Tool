import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as c from "../controllers/feedbackController.js";

const r = Router();
r.use(requireAuth);
r.post("/", c.submitFeedback);
r.get("/mine", c.listMyFeedback);
export default r;