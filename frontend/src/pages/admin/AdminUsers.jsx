import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import PageHead from "../../components/PageHead.jsx";
import { fetchUsers, patchUser, deleteUser } from "../../store/adminSlice.js";

export default function AdminUsers() {
  const dispatch = useDispatch();
  const { users, loading } = useSelector((s) => s.admin);
  useEffect(() => { dispatch(fetchUsers()); }, [dispatch]);

  async function onPatch(id, patch) {
    try { await dispatch(patchUser({ id, patch })).unwrap(); toast.success("Updated"); }
    catch (err) { toast.error(err?.response?.data?.error || "Failed"); }
  }
  async function onDelete(id) {
    if (!confirm("Permanently delete this user and all their data?")) return;
    await dispatch(deleteUser(id));
    toast.success("User deleted");
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <PageHead title="Manage users — TrustHire" noindex />
      <h1 className="text-2xl font-bold mb-6">Manage users</h1>
      <div className="card overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted">
            <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Verifs</th><th /></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-6 text-center text-muted">Loading…</td></tr>}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-border/10">
                <td className="p-3">{u.name}</td>
                <td className="p-3 text-muted">{u.email}</td>
                <td className="p-3">
                  <select value={u.role} onChange={(e) => onPatch(u.id, { role: e.target.value })} className="bg-transparent border border-border rounded-md px-2 py-1">
                    <option value="user">user</option><option value="admin">admin</option>
                  </select>
                </td>
                <td className="p-3">
                  <select value={u.plan} onChange={(e) => onPatch(u.id, { plan: e.target.value })} className="bg-transparent border border-border rounded-md px-2 py-1">
                    <option value="free">free</option><option value="pro_yearly">pro_yearly</option>
                  </select>
                </td>
                <td className="p-3">
                  <button onClick={() => onPatch(u.id, { suspended: !u.suspended })} className={`px-2 py-0.5 rounded-md text-xs border ${u.suspended ? "border-red-500/40 text-red-300" : "border-emerald-500/40 text-emerald-300"}`}>
                    {u.suspended ? "suspended" : "active"}
                  </button>
                </td>
                <td className="p-3 text-muted">{u.searchesThisMonth ?? 0}</td>
                <td className="p-3 text-right"><button onClick={() => onDelete(u.id)} className="text-muted hover:text-red-400"><Trash2 className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}