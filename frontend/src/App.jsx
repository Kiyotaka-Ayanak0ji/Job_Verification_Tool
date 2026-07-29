import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import AppShell from "./components/AppShell.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { fetchMe } from "./store/authSlice.js";

import Home from "./pages/Home.jsx";
import Pricing from "./pages/Pricing.jsx";
import HowToUse from "./pages/HowToUse.jsx";
import Login from "./pages/auth/Login.jsx";
import Signup from "./pages/auth/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Profile from "./pages/Profile.jsx";
import Results from "./pages/Results.jsx";
import JobDetails from "./pages/jobs/JobDetails.jsx";
import AdminUsers from "./pages/admin/AdminUsers.jsx";
import AdminAnalytics from "./pages/admin/AdminAnalytics.jsx";
import AdminReports from "./pages/admin/AdminReports.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  const dispatch = useDispatch();
  const { token, user } = useSelector((s) => s.auth);
  useEffect(() => { if (token && !user) dispatch(fetchMe()); }, [token, user, dispatch]);

  return (
    <ThemeProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/how-to-use" element={<HowToUse />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/results" element={<RequireAuth><Results /></RequireAuth>} />
          <Route path="/jobs/:id" element={<RequireAuth><JobDetails /></RequireAuth>} />
          <Route path="/admin/users" element={<RequireAuth role="admin"><AdminUsers /></RequireAuth>} />
          <Route path="/admin/analytics" element={<RequireAuth role="admin"><AdminAnalytics /></RequireAuth>} />
          <Route path="/admin/reports" element={<RequireAuth role="admin"><AdminReports /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </ThemeProvider>
  );
}