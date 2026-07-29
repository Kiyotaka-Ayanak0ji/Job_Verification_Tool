import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Folder, Trash2, ExternalLink, ChevronRight, ChevronLeft } from "lucide-react";
import PageHead from "../components/PageHead.jsx";
import { fetchReports, removeReport, patchReport } from "../store/reportsSlice.js";
import { fetchGroups, createGroup, deleteGroup } from "../store/groupsSlice.js";
import { BAND_COLOR, BAND_LABEL } from "../lib/bands.js";
import { SkeletonText } from "../components/Skeleton.jsx";
import { SkeletonInput } from "../components/Skeleton.jsx";
import { SkeletonButton } from "../components/Skeleton.jsx";

export default function Dashboard() {
  const dispatch = useDispatch();
  const { items: reports, loading: reportsLoading } = useSelector((s) => s.reports);
  const { items: groups, ungroupedCount, loading: groupsLoading } = useSelector((s) => {
    const groupsState = s.groups;
    return {
      items: groupsState.items,
      ungroupedCount: groupsState.ungroupedCount,
      loading: groupsState.loading || false
    };
  });
  const [active, setActive] = useState("all");
  const [newGroup, setNewGroup] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [reportsPerPage] = useState(10);

  useEffect(() => {
    dispatch(fetchReports());
    dispatch(fetchGroups());
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [dispatch, active]);

  const isLoading = reportsLoading || groupsLoading;

  const filtered = reports.filter((r) => {
    if (active === "all") return true;
    if (active === "ungrouped") return !r.groupId;
    return r.groupId === active;
  });

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filtered.length / reportsPerPage));
  const paginatedReports = filtered.slice(
    (currentPage - 1) * reportsPerPage,
    currentPage * reportsPerPage
  );

  async function addGroup(e) {
    e.preventDefault();
    if (!newGroup.trim()) return;
    try {
      await dispatch(createGroup({ name: newGroup.trim() })).unwrap();
      setNewGroup("");
      toast.success("Group created");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed");
    }
  }

  async function onDelete(id) {
    if (!confirm("Delete this report?")) return;
    await dispatch(removeReport(id));
    toast.success("Report deleted");
  }

  async function move(reportId, groupId) {
    await dispatch(patchReport({ id: reportId, patch: { groupId: groupId || null } }));
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-[240px_1fr] gap-6">
      {isLoading && (
        <div className="col-span-2">
          <div className="space-y-6">
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-1">
                  <SkeletonText className="w-20 h-4" />
                  <SkeletonText className="w-24 h-4" />
                </div>
              ))}
            </div>
            <div>
              <h2 className="text-xs uppercase tracking-widest text-muted">Groups</h2>
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="group flex items-center gap-1">
                    <SkeletonText className="w-24 h-4" />
                    <SkeletonText className="w-16 h-4" />
                    <SkeletonText className="w-8 h-4" />
                  </div>
                ))}
                <div className="flex gap-1 pt-2">
                  <SkeletonInput className="w-full" />
                  <SkeletonButton className="h-10 w-10 p-2" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mt-6">Your verifications</h2>
              <div className="space-y-4">
                <div className="table-responsive">
                  <table className="w-full text-sm">
                    <thead className="bg-border/20 text-left text-xs uppercase text-muted">
                      <tr><th className="p-3">Company</th><th className="p-3">Score</th><th className="p-3">Group</th><th className="p-3">Date</th><th /></tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={i} className="border-t border-border hover:bg-border/10">
                          <td className="p-3"><SkeletonText className="w-32 h-4" /></td>
                          <td className="p-3"><SkeletonText className="w-20 h-4" /></td>
                          <td className="p-3"><SkeletonText className="w-20 h-4" /></td>
                          <td className="p-3"><SkeletonText className="w-20 h-4" /></td>
                          <td className="p-3 text-right"><SkeletonButton className="h-8 w-8" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {!isLoading && (
        <>
          <PageHead title="Dashboard — TrustHire" noindex />
          <aside className="space-y-2">
            <h2 className="text-xs uppercase tracking-widest text-muted px-2">Groups</h2>
            <SidebarBtn active={active === "all"} onClick={() => setActive("all")} label="All reports" count={reports.length} />
            <SidebarBtn active={active === "ungrouped"} onClick={() => setActive("ungrouped")} label="Ungrouped" count={ungroupedCount} />
            {groups.map((g) => (
              <div key={g._id} className="group flex items-center gap-1">
                <SidebarBtn active={active === g._id} onClick={() => setActive(g._id)} label={g.name} count={g.count} icon={Folder} />
                <button onClick={() => dispatch(deleteGroup(g._id))} className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            <form onSubmit={addGroup} className="flex gap-1 pt-2">
              <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="New group…" className="input text-sm py-1.5" />
              <button className="btn-outline p-2"><Plus className="size-4" /></button>
            </form>
          </aside>

          <section>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Your verifications</h1>
              <div className="flex items-center gap-4">
                <Link to="/" className="btn-primary">New verification</Link>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="btn-outline px-3 py-1"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <span>Page {currentPage} of {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="btn-outline px-3 py-1"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="card p-10 text-center text-muted">
                No reports yet. <Link to="/" className="text-accent">Run your first verification.</Link>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-border/20 text-left text-xs uppercase text-muted">
                    <tr><th className="p-3">Company</th><th className="p-3">Score</th><th className="p-3">Group</th><th className="p-3">Date</th><th /></tr>
                  </thead>
                  <tbody>
                    {paginatedReports.map((r) => (
                      <tr key={r._id} className="border-t border-border hover:bg-border/10">
                        <td className="p-3 font-medium">{r.company}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md border text-xs ${BAND_COLOR[r.band]}`}>
                            {r.trustScore} · {BAND_LABEL[r.band]}
                          </span>
                        </td>
                        <td className="p-3">
                          <select value={r.groupId || ""} onChange={(e) => move(r._id, e.target.value)} className="bg-transparent text-sm border border-border rounded-md px-2 py-1">
                            <option value="">Ungrouped</option>
                            {groups.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
                          </select>
                        </td>
                        <td className="p-3 text-muted text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="p-3 text-right">
                          <Link to={`/jobs/${r._id}`} className="inline-flex items-center gap-1 text-accent"><ExternalLink className="size-3.5" /></Link>
                          <button onClick={() => onDelete(r._id)} className="ml-3 text-muted hover:text-red-400"><Trash2 className="size-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SidebarBtn({ active, onClick, label, count, icon: Icon }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors ${active ? "bg-accent/10 text-accent" : "text-muted hover:text-fg hover:bg-border/20"}`}>
      <span className="flex items-center gap-2 truncate">{Icon && <Icon className="size-3.5" />}{label}</span>
      <span className="text-xs">{count}</span>
    </button>
  );
}