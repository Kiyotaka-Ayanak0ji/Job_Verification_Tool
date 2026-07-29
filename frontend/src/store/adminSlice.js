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

const slice = createSlice({
  name: "admin",
  initialState: { users: [], analytics: null, loading: false },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchUsers.pending, (s) => { s.loading = true; });
    b.addCase(fetchUsers.fulfilled, (s, { payload }) => { s.loading = false; s.users = payload; });
    b.addCase(patchUser.fulfilled, (s, { payload }) => {
      s.users = s.users.map((u) => (u.id === payload.id ? payload : u));
    });
    b.addCase(deleteUser.fulfilled, (s, { payload }) => {
      s.users = s.users.filter((u) => u.id !== payload);
    });
    b.addCase(fetchAnalytics.fulfilled, (s, { payload }) => { s.analytics = payload; });
  },
});
export default slice.reducer;