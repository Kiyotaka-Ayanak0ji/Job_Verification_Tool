import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import PageHead from "../components/PageHead.jsx";
import { updateProfile, changePassword, fetchMe } from "../store/authSlice.js";
import { fetchUsage } from "../store/usageSlice.js";
import { fetchBillingStatus, startCheckout, manageBilling } from "../store/billingSlice.js";

export default function Profile() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { data: usage } = useSelector((s) => s.usage);
  const { data: billing, loading: billingLoading, error: billingError } = useSelector((s) => s.billing);
  const [name, setName] = useState(user?.name || "");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [interval, setInterval] = useState("monthly");
  const [checkoutBusy, setCheckoutBusy] = useState(null);

  useEffect(() => {
    dispatch(fetchUsage());
    dispatch(fetchBillingStatus());
  }, [dispatch]);

  useEffect(() => {
    // If the user returned from a Stripe/Razorpay checkout, refresh their plan.
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("session_id") || sp.get("provider")) {
      dispatch(fetchMe());
      dispatch(fetchBillingStatus());
      toast.success("Welcome to Pro — your plan is being activated");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [dispatch]);

  async function upgrade(provider) {
    setCheckoutBusy(provider);
    try {
      const res = await dispatch(startCheckout({ provider, interval })).unwrap();
      if (res?.url) window.location.href = res.url;
    } catch (err) {
      toast.error(err?.response?.data?.error || `Could not start ${provider} checkout`);
    } finally { setCheckoutBusy(null); }
  }

  async function manage() {
    try {
      const res = await dispatch(manageBilling()).unwrap();
      if (res?.url) window.location.href = res.url;
      else toast.success(res?.canceled ? "Subscription cancelled at period end" : "Done");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Could not open billing portal");
    }
  }

  async function saveName(e) {
    e.preventDefault();
    try { await dispatch(updateProfile({ name })).unwrap(); toast.success("Profile updated"); }
    catch (err) { toast.error(err?.response?.data?.error || "Failed"); }
  }
  async function savePw(e) {
    e.preventDefault();
    try {
      await dispatch(changePassword(pw)).unwrap();
      toast.success("Password changed"); setPw({ currentPassword: "", newPassword: "" });
    } catch (err) { toast.error(err?.response?.data?.error || "Failed"); }
  }

  const q = usage?.quotas || {}; const c = usage?.usage || {};
  const providers = billing?.data?.providers || {};
  const activePlan = billing?.data?.plan || user?.plan || "free";
  const isPro = activePlan.startsWith("pro");

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <PageHead title="Profile — TrustHire" noindex />
      <h1 className="text-2xl font-bold">Account</h1>

      <div className="grid md:grid-cols-3 gap-4">
        <QuotaCard label="Verifications" used={c.verify ?? 0} total={q.verify} />
        <QuotaCard label="Deep Think" used={c.deep ?? 0} total={q.deep} />
        <QuotaCard label="PDF exports" used={c.pdf ?? 0} total={q.pdf} />
      </div>

      <form onSubmit={saveName} className="card p-6 space-y-4">
        <h2 className="font-semibold">Profile details</h2>
        <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" value={user?.email || ""} disabled /></div>
        <div><label className="label">Plan</label><input className="input" value={user?.plan || "free"} disabled /></div>
        <button className="btn-primary">Save</button>
      </form>

      <form onSubmit={savePw} className="card p-6 space-y-4">
        <h2 className="font-semibold">Change password</h2>
        <div><label className="label">Current password</label><input type="password" className="input" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></div>
        <div><label className="label">New password</label><input type="password" className="input" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} /></div>
        <button className="btn-primary">Update password</button>
      </form>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-accent" />
          <h2 className="font-semibold">Billing &amp; subscription</h2>
        </div>
        <div className="text-sm text-muted">
          Current plan: <span className="text-white font-medium">{activePlan}</span>
          {billing?.data?.billing?.status && (
            <span className="ml-2 text-xs uppercase tracking-widest">· {billing.data.billing.status}</span>
          )}
        </div>

        {!isPro && (
          <>
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-xs">
              {[
                { id: "monthly", label: "Monthly" },
                { id: "yearly", label: "Yearly (save 17%)" },
              ].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setInterval(o.id)}
                  className={`px-3 py-1.5 rounded-full transition-colors ${interval === o.id ? "bg-accent text-slate-950 font-medium" : "text-muted"}`}
                >{o.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!providers.stripe || checkoutBusy !== null}
                onClick={() => upgrade("stripe")}
                className="btn-primary"
              >
                {checkoutBusy === "stripe" ? <Loader2 className="size-4 animate-spin" /> : null}
                Upgrade with Stripe
              </button>
              <button
                type="button"
                disabled={!providers.razorpay || checkoutBusy !== null}
                onClick={() => upgrade("razorpay")}
                className="btn-outline"
              >
                {checkoutBusy === "razorpay" ? <Loader2 className="size-4 animate-spin" /> : null}
                Upgrade with Razorpay
              </button>
            </div>
            {!providers.stripe && !providers.razorpay && (
              <p className="text-xs text-muted">
                Neither payment provider is configured on this server. Set the Stripe or Razorpay
                environment variables in <code>backend/.env</code> to enable checkout.
              </p>
            )}
          </>
        )}

        {isPro && (
          <button type="button" onClick={manage} className="btn-outline">
            Manage subscription
          </button>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-2">Google account</h2>
        <p className="text-sm text-muted mb-3">Link Google to sign in with one click. (OAuth provider must be configured.)</p>
        <button className="btn-outline" disabled>Link Google (coming soon)</button>
      </div>
    </div>
  );
}

function QuotaCard({ label, used, total }) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-2 text-2xl font-bold">{used} <span className="text-sm text-muted">/ {total ?? "∞"}</span></div>
      <div className="mt-3 h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}