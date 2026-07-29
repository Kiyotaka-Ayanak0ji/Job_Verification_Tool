import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as c from "../controllers/firecrawlController.js";

const r = Router();
r.use(requireAuth);
r.post("/scrape", c.scrapeUrl);
r.post("/search", c.searchWeb);
export default r;