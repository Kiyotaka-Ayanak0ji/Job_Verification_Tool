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
  initialState: { settings: null, runs: [], pending: [], bulk: [], notifications: [], loading: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    const handlePending = (s) => { s.loading = true; s.error = null; };
    const handleRejected = (s, a) => { s.loading = false; s.error = a.error.message; };

    b.addCase(fetchMlSettings.pending, handlePending);
    b.addCase(fetchMlSettings.fulfilled, (s, { payload }) => { s.loading = false; s.settings = payload; });
    b.addCase(fetchMlSettings.rejected, handleRejected);

    b.addCase(saveMlSettings.pending, handlePending);
    b.addCase(saveMlSettings.fulfilled, (s, { payload }) => { s.loading = false; s.settings = payload; });
    b.addCase(saveMlSettings.rejected, handleRejected);

    b.addCase(fetchRuns.pending, handlePending);
    b.addCase(fetchRuns.fulfilled, (s, { payload }) => { s.loading = false; s.runs = payload; });
    b.addCase(fetchRuns.rejected, handleRejected);

    b.addCase(runRetrain.pending, handlePending);
    b.addCase(runRetrain.fulfilled, (s, { payload }) => { s.loading = false; });
    b.addCase(runRetrain.rejected, handleRejected);

    b.addCase(fetchPendingFeedback.pending, handlePending);
    b.addCase(fetchPendingFeedback.fulfilled, (s, { payload }) => { s.loading = false; s.pending = payload; });
    b.addCase(fetchPendingFeedback.rejected, handleRejected);

    b.addCase(toggleFeedbackInclude.pending, handlePending);
    b.addCase(toggleFeedbackInclude.fulfilled, (s, { payload }) => {
      s.loading = false; s.pending = s.pending.map((f) => (f._id === payload._id ? { ...f, includedForTraining: payload.includedForTraining } : f));
    });
    b.addCase(toggleFeedbackInclude.rejected, handleRejected);

    b.addCase(startBulkJob.pending, handlePending);
    b.addCase(startBulkJob.fulfilled, (s, { payload }) => { s.loading = false; s.bulk = [payload, ...s.bulk]; });
    b.addCase(startBulkJob.rejected, handleRejected);

    b.addCase(fetchBulkJobs.pending, handlePending);
    b.addCase(fetchBulkJobs.fulfilled, (s, { payload }) => { s.loading = false; s.bulk = payload; });
    b.addCase(fetchBulkJobs.rejected, handleRejected);

    b.addCase(fetchNotifications.pending, handlePending);
    b.addCase(fetchNotifications.fulfilled, (s, { payload }) => { s.loading = false; s.notifications = payload; });
    b.addCase(fetchNotifications.rejected, handleRejected);

    b.addCase(markNotificationsRead.pending, handlePending);
    b.addCase(markNotificationsRead.fulfilled, (s) => { s.loading = false; });
    b.addCase(markNotificationsRead.rejected, handleRejected);
  },
});
export default slice.reducer;