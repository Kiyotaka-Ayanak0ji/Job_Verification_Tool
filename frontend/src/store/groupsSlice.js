import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../api/client.js";

export const fetchGroups = createAsyncThunk("groups/list", async () => {
  const { data } = await api.get("/groups"); return data;
});
export const createGroup = createAsyncThunk("groups/create", async (payload) => {
  const { data } = await api.post("/groups", payload); return data.group;
});
export const renameGroup = createAsyncThunk("groups/rename", async ({ id, name }) => {
  const { data } = await api.patch(`/groups/${id}`, { name }); return data.group;
});
export const deleteGroup = createAsyncThunk("groups/delete", async (id) => {
  await api.delete(`/groups/${id}`); return id;
});

const slice = createSlice({
  name: "groups",
  initialState: { items: [], ungroupedCount: 0, loading: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchGroups.pending, (s) => { s.loading = true; });
    b.addCase(fetchGroups.fulfilled, (s, { payload }) => {
      s.loading = false;
      s.items = payload.groups || [];
      s.ungroupedCount = payload.ungroupedCount || 0;
    });
    b.addCase(fetchGroups.rejected, (s, action) => {
      s.loading = false;
      s.error = action.error.message;
    });
    b.addCase(createGroup.pending, (s) => { s.loading = true; });
    b.addCase(createGroup.fulfilled, (s, { payload }) => {
      s.loading = false;
      s.items.push({ ...payload, count: 0 });
    });
    b.addCase(createGroup.rejected, (s, action) => {
      s.loading = false;
      s.error = action.error.message;
    });
    b.addCase(renameGroup.pending, (s) => { s.loading = true; });
    b.addCase(renameGroup.fulfilled, (s, { payload }) => {
      s.loading = false;
      s.items = s.items.map((g) => (g._id === payload._id ? { ...g, ...payload } : g));
    });
    b.addCase(renameGroup.rejected, (s, action) => {
      s.loading = false;
      s.error = action.error.message;
    });
    b.addCase(deleteGroup.pending, (s) => { s.loading = true; });
    b.addCase(deleteGroup.fulfilled, (s, { payload }) => {
      s.loading = false;
      s.items = s.items.filter((g) => g._id !== payload);
    });
    b.addCase(deleteGroup.rejected, (s, action) => {
      s.loading = false;
      s.error = action.error.message;
    });
  },
});
export default slice.reducer;