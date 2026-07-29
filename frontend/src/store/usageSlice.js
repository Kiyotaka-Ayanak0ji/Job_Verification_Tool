import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../api/client.js";

export const fetchUsage = createAsyncThunk("usage/me", async () => {
  const { data } = await api.get("/usage/me"); return data;
});

const slice = createSlice({
  name: "usage",
  initialState: { data: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchUsage.fulfilled, (s, { payload }) => { s.data = payload; });
  },
});
export default slice.reducer;