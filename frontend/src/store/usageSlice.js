import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../api/client.js";

export const fetchUsage = createAsyncThunk("usage/me", async () => {
  const { data } = await api.get("/usage/me"); return data;
});

const slice = createSlice({
  name: "usage",
  initialState: { data: null, loading: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchUsage.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchUsage.fulfilled, (s, { payload }) => { s.loading = false; s.data = payload; });
    b.addCase(fetchUsage.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });
  },
});
export default slice.reducer;