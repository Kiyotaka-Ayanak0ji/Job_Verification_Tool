import { Link, NavLink, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { ShieldCheck, ChevronDown, LogOut, User as UserIcon, LayoutDashboard, BarChart3, Users } from "lucide-react";
import { logout } from "../store/authSlice.js";

const NavItem = ({ to, children }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? "text-accent bg-accent/10" : "text-muted hover:text-fg"}`
    }
  >
    {children}
  </NavLink>
);

export default function AppShell({ children }) {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-bg/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-accent" />
            <span>TrustHire</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <NavItem to="/pricing">Pricing</NavItem>
            <NavItem to="/how-to-use">Usage</NavItem>
            {user && <NavItem to="/dashboard">Dashboard</NavItem>}
            {user?.role === "admin" && <NavItem to="/admin/users">Admin</NavItem>}
          </nav>
          <div className="flex items-center gap-2">
            {!user ? (
              <>
                <Link to="/auth/login" className="btn-ghost">Sign in</Link>
                <Link to="/auth/signup" className="btn-primary">Get started</Link>
              </>
            ) : (
              <div className="relative" ref={ref}>
                <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 btn-ghost">
                  <div className="size-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-sm font-semibold">
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <ChevronDown className="size-4" />
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute right-0 mt-2 w-56 card p-2 shadow-xl"
                    >
                      <div className="px-3 py-2 border-b border-border mb-2">
                        <div className="text-sm font-medium truncate">{user.name}</div>
                        <div className="text-xs text-muted truncate">{user.email}</div>
                      </div>
                      <MenuItem icon={UserIcon} to="/profile" onClick={() => setOpen(false)}>Profile</MenuItem>
                      <MenuItem icon={LayoutDashboard} to="/dashboard" onClick={() => setOpen(false)}>Dashboard</MenuItem>
                      {user.role === "admin" && <>
                        <MenuItem icon={Users} to="/admin/users" onClick={() => setOpen(false)}>Manage users</MenuItem>
                        <MenuItem icon={BarChart3} to="/admin/analytics" onClick={() => setOpen(false)}>Analytics</MenuItem>
                        <MenuItem icon={BarChart3} to="/admin/reports" onClick={() => setOpen(false)}>Reports</MenuItem>
                      </>}
                      <button
                        onClick={() => { dispatch(logout()); navigate("/"); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-border/30 text-red-300"
                      >
                        <LogOut className="size-4" /> Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-8 text-center text-xs text-muted">
        © {new Date().getFullYear()} TrustHire. Verify before you apply.
      </footer>
    </div>
  );
}

function MenuItem({ icon: Icon, to, children, onClick }) {
  return (
    <Link to={to} onClick={onClick} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-border/30">
      <Icon className="size-4 text-muted" /> {children}
    </Link>
  );
}