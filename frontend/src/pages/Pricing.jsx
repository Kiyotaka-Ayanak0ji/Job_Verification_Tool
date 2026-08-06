import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import PageHead from "../components/PageHead.jsx";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "sonner";
import { fetchMe } from "../store/authSlice.js";
import { fetchBillingStatus } from "../store/billingSlice.js";
import { api } from "../api/client.js";

const PRO_MONTHLY = 20;
const PRO_YEARLY = 200;

const FREE_FEATURES = [
  "10 verifications / month",
  "1 Deep Think verification",
  "2 PDF exports",
  "Report history + groups",
];

const PRO_FEATURES = [
  "50 verifications / month",
  "10 Deep Think verifications",
  "10 PDF exports",
  "Priority queue",
  "Email alerts",
];

export default function Pricing() {
  const [billing, setBilling] = useState("monthly");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const isLoggedIn = !!user;
  const isAdmin = user?.role === "admin";

  const isYearly = billing === "yearly";
  const proPrice = isYearly ? PRO_YEARLY : PRO_MONTHLY;
  const proCadence = isYearly ? "per year" : "per month";

  // Check for payment return from Razorpay
  useEffect(() => {
    const razorpayPaymentId = searchParams.get("razorpay_payment_id");
    const razorpaySubscriptionId = searchParams.get("razorpay_subscription_id");
    const razorpaySignature = searchParams.get("razorpay_signature");

    // Handle return from Razorpay payment
    if (razorpayPaymentId && razorpaySubscriptionId && razorpaySignature) {
      // Verify payment on server-side before updating UI
      const verifyPayment = async () => {
        try {
          setLoading(true);
          const { data } = await api.post("/billing/verify-razorpay", {
            razorpay_payment_id: razorpayPaymentId,
            razorpay_subscription_id: razorpaySubscriptionId,
            razorpay_signature: razorpaySignature,
          });

          // Refresh user data after successful verification
          await dispatch(fetchMe());
          await dispatch(fetchBillingStatus());
          toast.success("Payment verified successfully! Your account has been upgraded.");

          // Clear URL params
          window.history.replaceState({}, "", window.location.pathname);
        } catch (err) {
          console.error("Payment verification failed:", err);
          toast.error(
            err.response?.data?.error ||
              err.message ||
              "Payment verification failed. Please contact support."
          );
        } finally {
          setLoading(false);
        }
      };

      verifyPayment();
    }
  }, [searchParams, dispatch]);

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      toast.error("Please log in to subscribe");
      return;
    }
    setLoading(true);
    try {
      const { provider, url } = await api.post("/billing/checkout", {
        provider: "razorpay",
        interval: isYearly ? "yearly" : "monthly",
      });
      // Redirect to the checkout URL
      window.location.href = url;
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.error ||
          err.message ||
          "Failed to initiate payment"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <PageHead
        title="Pricing — TrustHire"
        description="Simple pricing. Free forever tier plus a Pro plan for high-volume verification."
      />
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-3">
          Simple pricing.
        </h1>
        <p className="text-muted">
          Start free. Upgrade only when you need more headroom.
        </p>
      </div>

      <div className="flex justify-center mb-10">
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1">
          {[
            { id: "monthly", label: "Monthly" },
            { id: "yearly", label: "Yearly" },
          ].map((opt) => {
            const active = billing === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBilling(opt.id)}
                className={`relative px-5 py-1.5 text-sm rounded-full transition-colors ${
                  active ? "bg-accent text-slate-950 font-medium" : "text-muted hover:text-white"
                }`}
                aria-pressed={active}
              >
                {opt.label}
                {opt.id === "yearly" && (
                  <span className={`ml-2 text-[10px] uppercase tracking-wider ${active ? "text-slate-950/70" : "text-accent"}`}>
                    Save 17%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-8">
          <div className="text-sm uppercase tracking-widest text-muted">Free</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-muted">/ forever</span>
          </div>
          <ul className="mt-6 space-y-2 text-sm">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="size-4 text-accent" /> {f}
              </li>
            ))}
          </ul>
          <Link to="/auth/signup" className="mt-8 w-full btn-outline justify-center">
            Get started
          </Link>
        </div>

        {isAdmin ? (
          <div className="card p-8 border-accent/60 shadow-lg shadow-accent/10">
            <div className="text-sm uppercase tracking-widest text-muted">Admin</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-muted">/ forever</span>
            </div>
            <p className="mt-4 text-center text-sm text-muted">
              Admins have free access to all features.
            </p>
          </div>
        ) : (
          <div className="card p-8 border-accent/60 shadow-lg shadow-accent/10">
            <div className="text-sm uppercase tracking-widest text-muted">Pro</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-bold">${proPrice}</span>
              <span className="text-muted">/ {proCadence}</span>
            </div>
            {isYearly && (
              <div className="mt-1 text-xs text-accent">
                Equivalent to ~${(PRO_YEARLY / 12).toFixed(2)}/mo
              </div>
            )}
            <ul className="mt-6 space-y-2 text-sm">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="size-4 text-accent" /> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={handleCheckout}
              disabled={loading || !isLoggedIn}
              className={`mt-8 w-full btn-primary justify-center ${
                !isLoggedIn ? "opacity-50" : ""
              }`}
            >
              {loading ? "Processing..." : "Get started"}
            </button>
            {!isLoggedIn && (
              <p className="mt-2 text-center text-xs text-muted">
                Please log in to subscribe
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}