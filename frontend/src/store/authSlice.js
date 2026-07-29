import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../api/client.js";

const STORAGE_KEY = "trusthire.auth";
const persisted = (() => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
})();

export const login = createAsyncThunk("auth/login", async (payload) => {
  const { data } = await api.post("/auth/login", payload);
  return data;
});
export const signup = createAsyncThunk("auth/signup", async (payload) => {
  const { data } = await api.post("/auth/signup", payload);
  return data;
});
export const fetchMe = createAsyncThunk("auth/me", async () => {
  const { data } = await api.get("/auth/me");
  return data.user;
});
export const updateProfile = createAsyncThunk("auth/updateProfile", async (patch) => {
  const { data } = await api.patch("/auth/profile", patch);
  return data.user;
});
export const changePassword = createAsyncThunk("auth/changePassword", async (payload) => {
  const { data } = await api.post("/auth/change-password", payload);
  return data;
});

const persist = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    token: state.token, refreshToken: state.refreshToken, user: state.user,
  }));
};

const slice = createSlice({
  name: "auth",
  initialState: {
    token: persisted?.token || null,
    refreshToken: persisted?.refreshToken || null,
    user: persisted?.user || null,
    status: "idle",
    error: null,
  },
  reducers: {
    setTokens(state, { payload }) {
      state.token = payload.token; state.refreshToken = payload.refreshToken; persist(state);
    },
    setUser(state, { payload }) { state.user = payload; persist(state); },
    logout(state) {
      state.token = null; state.refreshToken = null; state.user = null;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
  extraReducers: (b) => {
    const auth = (state, { payload }) => {
      state.token = payload.token; state.refreshToken = payload.refreshToken; state.user = payload.user;
      state.status = "ok"; state.error = null; persist(state);
    };
    b.addCase(login.fulfilled, auth);
    b.addCase(signup.fulfilled, auth);
    b.addCase(fetchMe.fulfilled, (s, { payload }) => { s.user = payload; persist(s); });
    b.addCase(updateProfile.fulfilled, (s, { payload }) => { s.user = payload; persist(s); });
    for (const t of [login, signup]) {
      b.addCase(t.pending, (s) => { s.status = "loading"; s.error = null; });
      b.addCase(t.rejected, (s, a) => { s.status = "error"; s.error = a.error.message; });
    }
  },
});

export const { setTokens, setUser, logout } = slice.actions;
export default slice.reducer;