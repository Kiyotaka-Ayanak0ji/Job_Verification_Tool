import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../api/client.js";

export const fetchUsers = createAsyncThunk("admin/users", async () => {
  const { data } = await api.get("/admin/users"); return data.users || data;
});
export const patchUser = createAsyncThunk("admin/patchUser", async ({ id, patch }) => {
  const { data } = await api.patch(`/admin/users/${id}`, patch); return data.user;
});
export const deleteUser = createAsyncThunk("admin/deleteUser", async (id) => {
  await api.delete(`/admin/users/${id}`); return id;
});
export const fetchAnalytics = createAsyncThunk("admin/analytics", async () => {
  const { data } = await api.get("/admin/analytics"); return data;
});
export const fetchAuditLogs = createAsyncThunk("admin/auditLogs", async (params = {}) => {
  const { data } = await api.get("/admin/audit-logs", { params }); return data;
});
export const fetchAllFeedback = createAsyncThunk("admin/feedback", async (params = {}) => {
  const { data } = await api.get("/admin/feedback", { params }); return data;
});
export const fetchModelMetrics = createAsyncThunk("admin/modelMetrics", async (params = {}) => {
  const { data } = await api.get("/admin/model-metrics", { params }); return data;
});

const slice = createSlice({
  name: "admin",
  initialState: { users: [], analytics: null, auditLogs: null, allFeedback: null, modelMetrics: null, loading: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchUsers.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchUsers.fulfilled, (s, { payload }) => { s.loading = false; s.users = payload; });
    b.addCase(fetchUsers.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(patchUser.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(patchUser.fulfilled, (s, { payload }) => {
      s.loading = false;
      s.users = s.users.map((u) => (u.id === payload.id ? payload : u));
    });
    b.addCase(patchUser.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(deleteUser.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(deleteUser.fulfilled, (s, { payload }) => {
      s.loading = false;
      s.users = s.users.filter((u) => u.id !== payload);
    });
    b.addCase(deleteUser.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(fetchAnalytics.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchAnalytics.fulfilled, (s, { payload }) => { s.loading = false; s.analytics = payload; });
    b.addCase(fetchAnalytics.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(fetchAuditLogs.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchAuditLogs.fulfilled, (s, { payload }) => { s.loading = false; s.auditLogs = payload; });
    b.addCase(fetchAuditLogs.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(fetchAllFeedback.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchAllFeedback.fulfilled, (s, { payload }) => { s.loading = false; s.allFeedback = payload.feedback || payload; });
    b.addCase(fetchAllFeedback.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(fetchModelMetrics.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchModelMetrics.fulfilled, (s, { payload }) => { s.loading = false; s.modelMetrics = payload; });
    b.addCase(fetchModelMetrics.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });
  },
});
export default slice.reducer;