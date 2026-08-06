import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../api/client.js";

export const fetchBillingStatus = createAsyncThunk("billing/status", async () => {
  const { data } = await api.get("/billing/status");
  return data;
});

export const startCheckout = createAsyncThunk(
  "billing/checkout",
  async ({ provider, interval }) => {
    const { data } = await api.post("/billing/checkout", { provider, interval });
    return data;
  },
);

export const manageBilling = createAsyncThunk("billing/portal", async () => {
  const { data } = await api.post("/billing/portal", {});
  return data;
});

export const verifyRazorpay = createAsyncThunk("billing/verifyRazorpay", async (payload) => {
  const { data } = await api.post("/billing/verify-razorpay", payload);
  return data;
});

const slice = createSlice({
  name: "billing",
  initialState: { data: null, loading: false, error: null },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchBillingStatus.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(fetchBillingStatus.fulfilled, (s, { payload }) => { s.loading = false; s.data = payload; });
    b.addCase(fetchBillingStatus.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(startCheckout.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(startCheckout.fulfilled, (s, { payload }) => { s.loading = false; s.data = payload; });
    b.addCase(startCheckout.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(manageBilling.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(manageBilling.fulfilled, (s, { payload }) => { s.loading = false; s.data = payload; });
    b.addCase(manageBilling.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });

    b.addCase(verifyRazorpay.pending, (s) => { s.loading = true; s.error = null; });
    b.addCase(verifyRazorpay.fulfilled, (s, { payload }) => { s.loading = false; s.data = payload; });
    b.addCase(verifyRazorpay.rejected, (s, a) => { s.loading = false; s.error = a.error.message; });
  },
});
export default slice.reducer;