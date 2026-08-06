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
    // fetchReports
    b.addCase(fetchReports.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchReports.fulfilled, (s, { payload }) => { s.loading = false; s.items = payload.reports || payload; });
    b.addCase(fetchReports.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    // verifyCompany
    b.addCase(verifyCompany.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(verifyCompany.fulfilled, (s, { payload }) => { s.loading = false; s.items.unshift(payload.report); s.current = payload; });
    b.addCase(verifyCompany.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    // patchReport
    b.addCase(patchReport.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(patchReport.fulfilled, (s, { payload }) => {
      s.loading = false;
      s.items = s.items.map((r) => (r._id === payload._id ? payload : r));
    });
    b.addCase(patchReport.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    // removeReport
    b.addCase(removeReport.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(removeReport.fulfilled, (s, { payload }) => {
      s.loading = false;
      s.items = s.items.filter((r) => r._id !== payload);
    });
    b.addCase(removeReport.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    // getReport
    b.addCase(getReport.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(getReport.fulfilled, (s, { payload }) => { s.loading = false; s.current = payload; });
    b.addCase(getReport.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });
  },
});
export default slice.reducer;