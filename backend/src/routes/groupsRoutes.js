import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as c from "../controllers/groupsController.js";

const r = Router();
r.use(requireAuth);
r.get("/", c.listGroups);
r.post("/", c.createGroup);
r.patch("/:id", c.updateGroup);
r.delete("/:id", c.deleteGroup);
export default r;