import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Download, ArrowLeft, ThumbsUp, ThumbsDown, ExternalLink } from "lucide-react";
import PageHead from "../../components/PageHead.jsx";
import { getReport } from "../../store/reportsSlice.js";
import { BAND_COLOR, BAND_LABEL } from "../../lib/bands.js";
import { exportReportPdf } from "../../lib/pdf.js";
import { api } from "../../api/client.js";

export default function JobDetails() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { current, loading } = useSelector((s) => s.reports);
  const [feedbackSent, setFeedbackSent] = useState(null);
  const [comment, setComment] = useState("");
  useEffect(() => { dispatch(getReport(id)); }, [dispatch, id]);

  if (!current) return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-muted animate-pulse">
      Loading verification…
    </div>
  );
  const { report, verification, job } = current;
  if (!report) return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-4">
      <Link to="/dashboard" className="text-sm text-muted inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> Back</Link>
      <div className="card p-8 text-center text-muted">Report not found or you don&apos;t have access.</div>
    </div>
  );

  async function onExport() {
    try {
      await api.post(`/reports/${report._id}/pdf-export`);
      exportReportPdf(report, verification);
      toast.success("PDF exported");
    } catch (err) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || "PDF quota exceeded";
      toast.error(msg);
    }
  }

  async function sendFeedback(accurate) {
    try {
      await api.post("/feedback", {
        verificationId: verification?._id,
        accurate,
        comment: comment.trim() || undefined,
      });
      setFeedbackSent(accurate ? "accurate" : "inaccurate");
      toast.success("Thanks — feedback recorded");
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || "Could not submit feedback");
    }
  }

  const parameters = Array.isArray(verification?.parameters)
    ? verification.parameters
    : Object.entries(verification?.parameters || {}).map(([k, v]) => ({
        key: k, label: k,
        score: typeof v === "object" ? (v.score ?? v.value ?? 0) : Number(v) || 0,
        status: typeof v === "object" ? v.status : undefined,
        evidence: typeof v === "object" ? v.evidence : undefined,
      }));
  const bandClass = BAND_COLOR[report.band] || "text-muted bg-white/5 border-white/10";
  const bandLabel = BAND_LABEL[report.band] || "Unrated";

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <PageHead title={`${report.company} — TrustHire`} noindex />
      <Link to="/dashboard" className="text-sm text-muted inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> Back</Link>
      <div className="card p-6 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted">Verification</div>
          <h1 className="text-3xl font-bold mt-1">{report.company}</h1>
          {job?.title && <div className="text-muted text-sm mt-1">{job.title}</div>}
          {job?.sourceUrl && (
            <a href={job.sourceUrl} target="_blank" rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
              <ExternalLink className="size-3" /> Source
            </a>
          )}
        </div>
        <div className="text-right">
          <div className={`inline-block px-3 py-1 rounded-lg border text-sm ${bandClass}`}>{bandLabel}</div>
          <div className="text-4xl font-bold mt-2">{report.trustScore}<span className="text-sm text-muted">/100</span></div>
          {report.deepThink && (
            <div className="mt-1 text-[10px] uppercase tracking-widest text-accent">Deep Think</div>
          )}
        </div>
      </div>

      {parameters.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Parameter breakdown</h2>
          <div className="space-y-4">
            {parameters.map((p) => {
              const score = Number(p.score) || 0;
              return (
                <div key={p.key || p.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{p.label || p.key}</span>
                    <span className="text-muted">{score}/100</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${Math.min(100, score)}%` }} />
                  </div>
                  {p.evidence && <p className="mt-1 text-xs text-muted">{p.evidence}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {verification?.reason && (
        <div className="card p-6">
          <h2 className="font-semibold mb-2">Reasoning</h2>
          <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{verification.reason}</p>
        </div>
      )}

      {verification?.citations?.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold mb-2">Citations</h2>
          <ul className="space-y-1 text-sm">
            {verification.citations.map((c, i) => (
              <li key={i}><a href={c.url || c} target="_blank" rel="noreferrer" className="text-accent underline">{c.title || c.url || c}</a></li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={onExport} className="btn-primary"><Download className="size-4" /> Export PDF</button>
      </div>

      <div className="card p-6 space-y-3">
        <div>
          <h2 className="font-semibold">Was this verification accurate?</h2>
          <p className="text-xs text-muted">Feedback trains the next model release.</p>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional — what did we get right or wrong?"
          className="input min-h-[70px] text-sm"
          disabled={!!feedbackSent}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!!feedbackSent || !verification?._id}
            onClick={() => sendFeedback(true)}
            className={`btn-outline ${feedbackSent === "accurate" ? "border-accent text-accent" : ""}`}
          >
            <ThumbsUp className="size-4" /> Accurate
          </button>
          <button
            type="button"
            disabled={!!feedbackSent || !verification?._id}
            onClick={() => sendFeedback(false)}
            className={`btn-outline ${feedbackSent === "inaccurate" ? "border-red-400 text-red-400" : ""}`}
          >
            <ThumbsDown className="size-4" /> Inaccurate
          </button>
        </div>
      </div>
    </div>
  );
}