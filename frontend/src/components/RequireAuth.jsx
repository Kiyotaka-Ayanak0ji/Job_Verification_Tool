import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

export default function RequireAuth({ children, role }) {
  const { user, token } = useSelector((s) => s.auth);
  const loc = useLocation();
  if (!token) return <Navigate to="/auth/login" state={{ from: loc.pathname }} replace />;
  if (!user) return null;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}