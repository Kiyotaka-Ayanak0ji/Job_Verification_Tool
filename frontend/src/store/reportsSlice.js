import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../api/client.js";

export const fetchReports = createAsyncThunk("reports/list", async (params = {}) => {
  const { data } = await api.get("/reports", { params });
  return data;
});
export const verifyCompany = createAsyncThunk("reports/verify", async (payload) => {
  const { data } = await api.post("/verify/company", payload);
  return data;
});
export const patchReport = createAsyncThunk("reports/patch", async ({ id, patch }) => {
  const { data } = await api.patch(`/reports/${id}`, patch);
  return data.report;
});
export const removeReport = createAsyncThunk("reports/remove", async (id) => {
  await api.delete(`/reports/${id}`); return id;
});
export const getReport = createAsyncThunk("reports/get", async (id) => {
  const { data } = await api.get(`/reports/${id}`); return data;
});

const slice = createSlice({
  name: "reports",
  initialState: { items: [], current: null, loading: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchReports.pending, (s) => { s.loading = true; });
    b.addCase(fetchReports.fulfilled, (s, { payload }) => { s.loading = false; s.items = payload.reports || payload; });
    b.addCase(fetchReports.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });
    b.addCase(verifyCompany.fulfilled, (s, { payload }) => { s.items.unshift(payload.report); s.current = payload; });
    b.addCase(getReport.fulfilled, (s, { payload }) => { s.current = payload; });
    b.addCase(patchReport.fulfilled, (s, { payload }) => {
      s.items = s.items.map((r) => (r._id === payload._id ? payload : r));
    });
    b.addCase(removeReport.fulfilled, (s, { payload }) => {
      s.items = s.items.filter((r) => r._id !== payload);
    });
  },
});
export default slice.reducer;