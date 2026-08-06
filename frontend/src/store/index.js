import { configureStore } from "@reduxjs/toolkit";
import { setupApiInterceptors } from "../api/client.js";
import auth from "./authSlice.js";
import reports from "./reportsSlice.js";
import groups from "./groupsSlice.js";
import usage from "./usageSlice.js";
import admin from "./adminSlice.js";
import billing from "./billingSlice.js";
import mlAdmin from "./mlAdminSlice.js";
import feedback from "./feedbackSlice.js";

export const store = configureStore({
  reducer: { auth, reports, groups, usage, admin, billing, mlAdmin, feedback },
});

setupApiInterceptors(store);