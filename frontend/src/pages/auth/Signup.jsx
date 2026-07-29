import { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import PageHead from "../../components/PageHead.jsx";
import { signup } from "../../store/authSlice.js";
import { EyeOff, Eye } from "lucide-react";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const nav = useNavigate();

  async function onSubmit(e) {
    e.preventDefault(); setBusy(true);
    try {
      await dispatch(signup({ name, email, password })).unwrap();
      toast.success("Account created"); nav("/dashboard");
    } catch (err) {
      toast.error(err?.data?.error || err?.message || "Sign-up failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <PageHead title="Create account — TrustHire" noindex />
      <h1 className="text-2xl font-bold mb-6">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div><label className="label">Name</label><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="relative">
          <label className="label">Password</label>
          <div className="flex items-center space-x-2 w-full">
            <input className="input flex-1" type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button onClick={() => setShowPassword(!showPassword)} className="btn-link p-0 h-10 w-10 flex items-center justify-center">
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      </form>
      <p className="text-sm text-muted mt-4">Have an account? <Link to="/auth/login" className="text-accent">Sign in</Link></p>
    </div>
  );
}