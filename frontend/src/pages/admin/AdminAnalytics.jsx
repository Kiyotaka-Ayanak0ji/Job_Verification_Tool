import { useEffect, useState } from "react";
import PageHead from "../../components/PageHead.jsx";
import { api } from "../../api/client.js";

// Spec §6: only three tiles — Accuracy, Precision, Accurate Report count.
export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { data } = await api.get("/admin/ml/analytics");
        if (alive) setData(data);
      } finally { if (alive) setLoading(false); }
    }
    load();
    const t = setInterval(load, 15000); // live refresh
    return () => { alive = false; clearInterval(t); };
  }, []);

  const pct = (v) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—");

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <PageHead title="Model analytics — TrustHire" noindex />
      <div>
        <h1 className="text-2xl font-bold">Model analytics</h1>
        <p className="text-sm text-muted mt-1">
          Live snapshot of the currently promoted model. New models must clear the 95% accuracy gate to become active.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Model accuracy" value={loading ? "…" : pct(data?.accuracy)} sub={data?.activeVersion ? `Latest run • ${data.activeVersion}` : "No promoted run yet"} />
        <Stat label="Model precision" value={loading ? "…" : pct(data?.precision)} sub="Latest successful retrain" />
        <Stat label="Accurate reports" value={loading ? "…" : (data?.accurateReports ?? 0)} sub="Admin-labeled `accurate`" />
      </div>
      {data?.lastRunPromoted === false && (
        <div className="card p-4 border border-amber-500/40 bg-amber-500/5 text-sm">
          Latest auto-retrain was <strong>blocked</strong> — accuracy under 95%. Previous model remains active.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="card p-6">
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      <div className="text-4xl font-bold mt-3">{value ?? "—"}</div>
      {sub && <div className="text-xs text-muted mt-2">{sub}</div>}
    </div>
  );
}