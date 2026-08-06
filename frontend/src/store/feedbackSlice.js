import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../api/client.js";

export const submitFeedback = createAsyncThunk("feedback/submit", async (payload) => {
  const { data } = await api.post("/feedback", payload);
  return data;
});

export const fetchMyFeedback = createAsyncThunk("feedback/mine", async () => {
  const { data } = await api.get("/feedback/mine");
  return data;
});

export const fetchAllFeedback = createAsyncThunk("feedback/all", async (params = {}) => {
  const { data } = await api.get("/admin/feedback", { params });
  return data;
});

const slice = createSlice({
  name: "feedback",
  initialState: { items: [], loading: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(submitFeedback.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(submitFeedback.fulfilled, (s, { payload }) => { s.loading = false; s.items.unshift(payload); });
    b.addCase(submitFeedback.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(fetchMyFeedback.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchMyFeedback.fulfilled, (s, { payload }) => { s.loading = false; s.items = payload; });
    b.addCase(fetchMyFeedback.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(fetchAllFeedback.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchAllFeedback.fulfilled, (s, { payload }) => { s.loading = false; s.items = payload.feedback || payload; });
    b.addCase(fetchAllFeedback.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });
  },
});
export default slice.reducer;