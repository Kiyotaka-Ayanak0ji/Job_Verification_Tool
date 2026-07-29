import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import PageHead from "../../components/PageHead.jsx";
import { api, apiMethods } from "../../api/client.js";

const BANDS = ["", "high", "likely", "caution", "risk"];

export default function AdminReports() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [band, setBand] = useState("");
  const [labeled, setLabeled] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState(new Map()); // Map verificationId -> feedback info

  async function load() {
    setLoading(true);
    try {
      // Fetch reports
      const { data } = await api.get("/admin/reports", {
        params: { page, band: band || undefined, labeled: labeled || undefined }
      });
      setItems(data.items);
      setTotal(data.total);
      setHasMore(data.hasMore);

      // Fetch feedback info for these items
      const verificationIds = data.items
        .map(item => item.verificationId)
        .filter(id => id);

      if (verificationIds.length > 0) {
        const { data: feedbackData } = await apiMethods.fetchFeedbackByVerificationIds(verificationIds);

        const newMap = new Map();
        feedbackData.forEach(fb => {
          newMap.set(fb.verificationId, fb);
        });
        setFeedbackMap(newMap);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [page, band, labeled]);

  async function labelIt(id, label) {
    setBusyId(id);
    try {
      const { data } = await api.post(`/admin/reports/${id}/label`, { label });
      // Update the item optimistically
      setItems(prev => prev.map(r =>
        r._id === id ? { ...r, label } : r
      ));

      if (data.trigger?.fired) {
        toast.success("Threshold reached — auto-retrain fired");
      } else {
        toast.success(`Labeled ${label.replace("_", " ")}`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleFeedbackInclude(verificationId, currentlyIncluded) {
    try {
      await apiMethods.toggleFeedbackInclude(verificationId, !currentlyIncluded);

      // Update our feedback map
      setFeedbackMap(prev => {
        const newMap = new Map(prev);
        const updatedFeedback = {
          ...(newMap.get(verificationId) || {}),
          verificationId,
          includedForTraining: !currentlyIncluded
        };
        newMap.set(verificationId, updatedFeedback);
        return newMap;
      });

      toast.success(
        `Feedback marked as ${!currentlyIncluded ? 'included' : 'not included'} for training`
      );
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to update feedback");
    }
  }

  async function uploadCsv(file) {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/ml/bulk/csv", fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success(`Queued ${data.count} rows for bulk verification`);
    } catch (e) {
      toast.error(e?.response?.data?.error || "CSV upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      <PageHead title="Reports — TrustHire admin" noindex />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted mt-1">
            Label reports as accurate or not — every 100 labels triggers an automatic retrain (95% accuracy hard-gate).
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={band}
            onChange={(e) => { setPage(1); setBand(e.target.value); }}
            className="input"
          >
            {BANDS.map((b) => (
              <option key={b} value={b}>
                {b ? `Band: ${b}` : "All bands"}
              </option>
            ))}
          </select>
          <select
            value={labeled}
            onChange={(e) => { setPage(1); setLabeled(e.target.value); }}
            className="input"
          >
            <option value="">All</option>
            <option value="labeled">Labeled</option>
            <option value="unlabeled">Unlabeled</option>
          </select>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadCsv(e.dataTransfer.files?.[0]); }}
        className={`card p-6 flex items-center gap-4 transition-colors ${dragging ? "border-accent bg-accent/5" : ""}`}
      >
        <div className="size-11 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
          <Upload className="size-5" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">Bulk CSV upload</div>
          <div className="text-xs text-muted">Drag a CSV with `url` or `company` columns, or click to browse. Rows queue into the bulk verifier.</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          hidden
          onChange={(e) => uploadCsv(e.target.files?.[0])}
        />
        <button
          className="btn-primary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Uploading
            </>
          ) : (
            <>
              <FileText className="size-4" /> Choose CSV
            </>
          )}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-border/20 sticky top-0">
              <tr className="text-left text-xs uppercase text-muted">
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Band</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3 text-right">Action</th>
                <th className="px-4 py-3 text-center">Training</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted">
                    No reports
                  </td>
                </tr>
              )}
              {items.map((r) => {
                const feedback = feedbackMap.get(r.verificationId || "");
                const isIncluded = feedback?.includedForTraining ?? false;
                const feedbackStatus = feedback ?
                  (isIncluded ? "✓ Included" : "○ Not included") :
                  "—";

                return (
                  <motion.tr
                    key={r._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-t border-border"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.company}</div>
                      <div className="text-xs text-muted">{r.title}</div>
                    </td>
                    <td className="px-4 py-3 font-mono">{r.trustScore ?? "—"}</td>
                    <td className="px-4 py-3"><span className="text-xs uppercase">{r.band || "—"}</span></td>
                    <td className="px-4 py-3 text-xs">{r.mode || (r.deepThink ? "deep" : "normal")}</td>
                    <td className="px-4 py-3 text-xs text-muted">{r.modelVersion || "—"}</td>
                    <td className="px-4 py-3 text-xs">{r.user?.email || "—"}</td>
                    <td className="px-4 py-3">
                      {r.label
                        ? <span className={`text-xs px-2 py-1 rounded ${r.label === "accurate" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{r.label.replace("_", " ")}</span>
                        : <span className="text-xs text-muted">Unlabeled</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          disabled={busyId === r._id}
                          onClick={() => labelIt(r._id, "accurate")}
                          className="btn-ghost text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <CheckCircle2 className="size-4" /> Accurate
                        </button>
                        <button
                          disabled={busyId === r._id}
                          onClick={() => labelIt(r._id, "not_accurate")}
                          className="btn-ghost text-red-400 hover:bg-red-500/10"
                        >
                          <XCircle className="size-4" /> Not accurate
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <span className="text-xs">{feedbackStatus}</span>
                        {feedback && (
                          <button
                            onClick={() => toggleFeedbackInclude(r.verificationId, isIncluded)}
                            className={`btn-ghost text-xs ${isIncluded ? "text-green-500" : "text-amber-500"} hover:opacity-80 p-1`}
                          >
                            {isIncluded ? "✓" : "○"}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs">
          <div className="text-muted">Total {total}</div>
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className="px-2 py-1">Page {page}</span>
            <button className="btn-ghost" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}