import axios from "axios";

// Default to the same-origin `/api` prefix so the Vite dev proxy (see
// vite.config.js) or a reverse proxy in production can forward requests to the
// Express backend without extra env config. Override with VITE_API_URL when
// the frontend must talk to a differently-hosted backend.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

// The Redux store wires itself in via setupApiInterceptors() from store/index.js
// to avoid a circular import at module init.
let _store = null;

export function setupApiInterceptors(store) {
  _store = store;
}

// Intercept requests to attach auth token
api.interceptors.request.use((cfg) => {
  const token = _store?.getState().auth.token;
  
  //Testing 
  console.log("Token: ", token);
  console.log("Request: ", cfg.url);

  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Handle token refresh on 401
let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const { config, response } = err;
    if (!_store || !config || response?.status !== 401 || config._retry) throw err;

    const { setTokens, logout } = await import("../store/authSlice.js");
    const rt = _store.getState().auth.refreshToken;
    if (!rt) { _store.dispatch(logout()); throw err; }

    config._retry = true;
    try {
      refreshing = refreshing || api.post("/auth/refresh", { refreshToken: rt });
      const { data } = await refreshing;
      refreshing = null;
      _store.dispatch(setTokens({ token: data.token, refreshToken: data.refreshToken }));
      config.headers.Authorization = `Bearer ${data.token}`;
      return api(config);
    } catch (e) {
      refreshing = null;
      _store.dispatch(logout());
      throw e;
    }
  },
);

// API methods
export const apiMethods = {
  // Authentication
  login: (credentials) => api.post("/auth/login", credentials),
  logout: () => api.post("/auth/logout"),
  refreshToken: (refreshToken) => api.post("/auth/refresh", { refreshToken }),

  // Reports
  getReports: (params) => api.get("/admin/reports", { params }),
  labelReport: (id, label) => api.post(`/admin/reports/${id}/label`, { label }),
  uploadCsv: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/admin/ml/bulk/csv", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
  },

  // Analytics
  getAnalytics: () => api.get("/admin/ml/analytics"),

  // ML Admin
  getMLSettings: () => api.get("/admin/ml/settings"),
  updateMLSettings: (settings) => api.put("/admin/ml/settings", settings),
  triggerRetrain: (params) => api.post("/admin/ml/retrain", params),
  rescoreSample: (verificationIds) => api.post("/admin/ml/rescore-sample", { verificationIds }),
  startBulkJob: (urls) => api.post("/admin/ml/bulk", { urls }),
  getBulkJobs: () => api.get("/admin/ml/bulk"),
  getBulkJob: (id) => api.get(`/admin/ml/bulk/${id}`),

  // Feedback management
  toggleFeedbackInclude: (id, include) => api.post(`/admin/feedback/${id}/include`, { include }),
  fetchFeedbackByVerificationIds: (verificationIds) =>
    api.post("/admin/feedback/by-ids", { verificationIds }),

  // Notifications
  getNotifications: () => api.get("/admin/notifications"),
  markNotificationsRead: () => api.post("/admin/notifications/read"),
};

// For backward compatibility, also export the api object directly
export default api;