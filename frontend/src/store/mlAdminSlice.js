import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../api/client.js";

export const fetchMlSettings = createAsyncThunk("mlAdmin/settings", async () => {
  const { data } = await api.get("/admin/ml/settings"); return data.settings;
});
export const saveMlSettings = createAsyncThunk("mlAdmin/saveSettings", async (patch) => {
  const { data } = await api.put("/admin/ml/settings", patch); return data.settings;
});
export const fetchRuns = createAsyncThunk("mlAdmin/runs", async () => {
  const { data } = await api.get("/admin/ml/runs"); return data.runs;
});
export const runRetrain = createAsyncThunk("mlAdmin/retrain", async (body = {}) => {
  const { data } = await api.post("/admin/ml/retrain", body); return data;
});
export const fetchPendingFeedback = createAsyncThunk("mlAdmin/pendingFeedback", async () => {
  const { data } = await api.get("/admin/feedback?pending=1"); return data.feedback;
});
export const toggleFeedbackInclude = createAsyncThunk("mlAdmin/toggleInclude", async ({ id, include }) => {
  const { data } = await api.patch(`/admin/ml/feedback/${id}/include`, { include }); return data.feedback;
});
export const startBulkJob = createAsyncThunk("mlAdmin/bulk", async (urls) => {
  const { data } = await api.post("/admin/ml/bulk", { urls }); return data.job;
});
export const fetchBulkJobs = createAsyncThunk("mlAdmin/bulkJobs", async () => {
  const { data } = await api.get("/admin/ml/bulk"); return data.jobs;
});
export const fetchNotifications = createAsyncThunk("mlAdmin/notifications", async () => {
  const { data } = await api.get("/admin/ml/notifications"); return data.notifications;
});
export const markNotificationsRead = createAsyncThunk("mlAdmin/notificationsRead", async () => {
  await api.post("/admin/ml/notifications/read"); return true;
});

const slice = createSlice({
  name: "mlAdmin",
  initialState: { settings: null, runs: [], pending: [], bulk: [], notifications: [], loading: false },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchMlSettings.fulfilled, (s, { payload }) => { s.settings = payload; });
    b.addCase(saveMlSettings.fulfilled, (s, { payload }) => { s.settings = payload; });
    b.addCase(fetchRuns.fulfilled, (s, { payload }) => { s.runs = payload; });
    b.addCase(fetchPendingFeedback.fulfilled, (s, { payload }) => { s.pending = payload; });
    b.addCase(toggleFeedbackInclude.fulfilled, (s, { payload }) => {
      s.pending = s.pending.map((f) => (f._id === payload._id ? { ...f, includedForTraining: payload.includedForTraining } : f));
    });
    b.addCase(fetchBulkJobs.fulfilled, (s, { payload }) => { s.bulk = payload; });
    b.addCase(startBulkJob.fulfilled, (s, { payload }) => { s.bulk = [payload, ...s.bulk]; });
    b.addCase(fetchNotifications.fulfilled, (s, { payload }) => { s.notifications = payload; });
  },
});
export default slice.reducer;