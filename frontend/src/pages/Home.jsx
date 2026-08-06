import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Loader2, ChevronDown, ShieldCheck, Scale, Globe2 } from "lucide-react";
import PageHead from "../components/PageHead.jsx";
import { verifyCompany } from "../store/reportsSlice.js";
import { api } from "../api/client.js";

export default function Home() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("normal");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/models").then(({ data }) => {
      const list = (data.models || []).slice(0, 2).map((m, i) => ({ ...m, is_latest: i === 0 }));
      setModels(list);
      if (list[0]) setModel(list[0].version);
    }).catch(() => {});
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    setBusy(true);

    // Show skeleton loader instead of toast loading
    const skeletonContainer = document.createElement('div');
    skeletonContainer.className = 'animate-pulse';
    document.body.appendChild(skeletonContainer);

    try {
      const res = await dispatch(verifyCompany({ input: text, deepThink: mode === "deep", model: model })).unwrap();
      skeletonContainer.remove();
      toast.success("Verification complete");
      navigate(`/jobs/${res.report._id}`);
    } catch (err) {
      skeletonContainer.remove();
      // RTK serialises thunk rejections: err.message is the top-level string,
      // err.data may carry the API payload when the thunk uses rejectWithValue.
      const msg = err?.data?.error || err?.message || "Live scan failed";
      if (msg.includes("Unauthorized") || msg.includes("401")) {
        toast.error("Please sign in first");
        navigate("/auth/login");
      } else {
        toast.error(msg);
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
      <PageHead title="TrustHire — Verify any job before you apply"
        description="Paste a job URL or company name and get a Trust Score with legal, reputation, and JD red-flag breakdown." />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Verify your next career move.</h1>
        <p className="text-muted max-w-2xl mx-auto">
          Instant authenticity audit for any job posting or company — one Trust Score, full breakdown.
        </p>
        <form onSubmit={onSubmit} className="max-w-2xl mx-auto space-y-4 pt-6">
          <div className="flex gap-2 p-2 card">
            <input value={q} onChange={(e) => setQ(e.target.value)} disabled={busy}
              placeholder="Paste a job URL or type a company name…"
              className="flex-1 bg-transparent outline-none px-3" />
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? <><Loader2 className="size-4 animate-spin" /> Scanning</> : <>Verify <ArrowRight className="size-4" /></>}
            </button>
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs uppercase tracking-widest text-muted">Analysis engine</span>
            <div className="bg-card border border-border p-1 rounded-full flex">
              {["normal", "deep"].map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${mode === m ? "bg-accent text-bg" : "text-muted"}`}>
                  {m === "normal" ? "NORMAL" : "DEEP THINK"}
                </button>
              ))}
            </div>
            {models.length > 0 && (
              <>
                <span className="text-xs uppercase tracking-widest text-muted">Model</span>
                <select value={model} onChange={(e) => setModel(e.target.value)}
                  className="bg-card border border-border rounded-full px-3 py-1.5 text-xs font-semibold">
                  {models.map((m) => (
                    <option key={m.version} value={m.version}>
                      {m.version}{m.is_latest ? " (latest)" : ""}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </form>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-4 mt-20">
        {[
          { icon: Scale, title: "Registry-first", body: "MCA + GSTIN cross-checks flag shell companies before you apply." },
          { icon: Globe2, title: "Reputation aggregation", body: "Glassdoor, Reddit and open-web sentiment folded into one score." },
          { icon: ShieldCheck, title: "Per-parameter breakdown", body: "Every score shows the eight sub-signals that drove the verdict." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="card p-6">
            <Icon className="size-5 text-accent mb-3" />
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>

      <section className="mt-24">
        <h2 className="text-3xl font-bold text-center mb-8">Common questions</h2>
        <div className="space-y-3 max-w-3xl mx-auto">
          {FAQS.map((f) => (
            <details key={f.q} className="group card p-5">
              <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-sm">
                {f.q}
                <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="text-sm text-muted mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

const FAQS = [
  { q: "What's the difference between Free and Pro?", a: "Free: 10 verifications, 1 Deep Think, 2 PDF exports per month. Pro: 50 verifications, 10 Deep Think runs, 10 PDF exports." },
  { q: "What does Deep Think mode do?", a: "It layers cross-checks (recruiter LinkedIn footprint, WHOIS drill-down, multi-source complaint aggregation) on top of the eight core signals." },
  { q: "Can I export a PDF report?", a: "Yes — every verification page has an Export button; PDFs count against your monthly export quota." },
];