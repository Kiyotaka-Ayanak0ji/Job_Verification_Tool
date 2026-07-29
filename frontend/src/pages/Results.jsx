import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import PageHead from "../components/PageHead.jsx";
import { fetchReports } from "../store/reportsSlice.js";
import { BAND_COLOR, BAND_LABEL } from "../lib/bands.js";
import { SkeletonText, SkeletonAvatar } from "../components/Skeleton.jsx";

export default function Results() {
  const [sp] = useSearchParams();
  const q = sp.get("q") || "";
  const dispatch = useDispatch();
  const { items, loading } = useSelector((s) => s.reports);
  useEffect(() => { dispatch(fetchReports()); }, [dispatch]);
  const filtered = items.filter((r) => !q || r.company.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <PageHead title={`Results${q ? ` — ${q}` : ""} — TrustHire`} noindex />
      <h1 className="text-2xl font-bold mb-6">Matching reports</h1>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="card p-4 flex items-center justify-between hover:border-accent/50 transition-colors">
              <div>
                <SkeletonText className="w-32" />
                <SkeletonText className="w-24 text-xs text-muted mt-1" />
              </div>
              <span className="px-2 py-0.5 rounded-md border text-xs">
                <SkeletonText className="w-16 h-4" /> · <SkeletonText className="w-16 h-4" />
              </span>
            </li>
          ))}
        </div>
      )}

      {!loading && (
        <>
          {filtered.length === 0 ? (
            <div className="card p-8 text-center text-muted">No matching reports.</div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((r) => (
                <li key={r._id}>
                  <Link to={`/jobs/${r._id}`} className="card p-4 flex items-center justify-between hover:border-accent/50 transition-colors">
                    <div>
                      <div className="font-medium">{r.company}</div>
                      <div className="text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md border text-xs ${BAND_COLOR[r.band]}`}>{r.trustScore} · {BAND_LABEL[r.band]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}