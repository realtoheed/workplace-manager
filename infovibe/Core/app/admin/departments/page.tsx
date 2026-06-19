"use client";

import { useEffect, useState, useCallback } from "react";
import PlatformShell from "@/components/PlatformShell";

type Department = {
  id: string; name: string; headId: string | null;
  head: { id: string; name: string; email: string } | null;
  memberCount: number;
};

type Employee = { id: string; name: string; email: string; role: string; designation: string | null };

type HeadOption = { id: string; name: string; email: string };

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [heads, setHeads] = useState<HeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; editing: Department | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ name: "", headId: "" });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Employee[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, usersRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users"),
      ]);
      if (deptRes.ok) {
        const d = await deptRes.json();
        setDepartments(d.departments || []);
      }
      if (usersRes.ok) {
        const d = await usersRes.json();
        setHeads((d.users || []).map((u: { id: string; name: string; email: string }) => ({ id: u.id, name: u.name, email: u.email })));
      }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/departments/${id}/members`);
      if (res.ok) {
        const d = await res.json();
        setMembers(d.members || []);
      }
    } catch {} finally { setMembersLoading(false); }
  }

  function openAdd() {
    setForm({ name: "", headId: "" });
    setModal({ open: true, editing: null });
  }

  function openEdit(dept: Department) {
    setForm({ name: dept.name, headId: dept.headId || "" });
    setModal({ open: true, editing: dept });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (modal.editing) {
        await fetch(`/api/departments/${modal.editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name.trim(), headId: form.headId || null }),
        });
      } else {
        await fetch("/api/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name.trim(), headId: form.headId || null }),
        });
      }
      setModal({ open: false, editing: null });
      fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete department "${name}"?`)) return;
    try {
      const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Cannot delete");
        return;
      }
      fetchData();
    } catch { alert("Failed to delete"); }
  }

  if (loading) return <PlatformShell title="Departments" description="Loading..." user={{ id: "", name: "", email: "", role: "super_admin" as const }}><div className="p-6 text-slate-400">Loading...</div></PlatformShell>;

  return (
    <PlatformShell title="Department Management" description="Create, edit, and manage departments." user={{ id: "", name: "", email: "", role: "super_admin" as const }}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Departments ({departments.length})</h2>
        <button onClick={openAdd} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 transition">+ Add Department</button>
      </div>

      <div className="space-y-3">
        {departments.map((dept) => (
          <div key={dept.id} className="rounded-2xl border border-slate-700 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-800/30" onClick={() => toggleExpand(dept.id)}>
              <svg className={`h-4 w-4 text-slate-400 transition-transform ${expandedId === dept.id ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white">{dept.name}</h3>
                <p className="text-xs text-slate-400">
                  {dept.head ? `HOD: ${dept.head.name} (${dept.head.email})` : "No head assigned"} · {dept.memberCount} member{dept.memberCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(dept)} className="rounded-lg bg-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-600">Edit</button>
                <button onClick={() => handleDelete(dept.id, dept.name)} className="rounded-lg bg-red-500/10 px-2.5 py-1 text-xs text-red-400 hover:bg-red-500/20">Delete</button>
              </div>
            </div>

            {expandedId === dept.id && (
              <div className="border-t border-slate-700 px-4 pb-4 pt-2">
                {membersLoading ? (
                  <p className="text-sm text-slate-400 py-2">Loading members...</p>
                ) : members.length === 0 ? (
                  <p className="text-sm text-slate-500 py-2">No active members in this department.</p>
                ) : (
                  <div className="grid gap-2">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2 text-sm">
                        <span className="font-medium text-white flex-1">{m.name} <span className="text-slate-400 font-normal">({m.email})</span></span>
                        <span className="text-xs text-slate-400 capitalize">{m.role.replace("_", " ")}</span>
                        {m.designation ? <span className="text-xs text-slate-500">{m.designation}</span> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {!departments.length && <p className="p-6 text-center text-slate-500">No departments yet. Create one above.</p>}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setModal({ open: false, editing: null })}>
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">{modal.editing ? "Edit Department" : "Add Department"}</h3>
            <form onSubmit={handleSave} className="grid gap-3">
              <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Department name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" value={form.headId} onChange={(e) => setForm({ ...form, headId: e.target.value })}>
                <option value="">No head (HOD)</option>
                {heads.map((h) => <option key={h.id} value={h.id}>{h.name} ({h.email})</option>)}
              </select>
              <div className="flex gap-2 mt-2">
                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition disabled:opacity-50">{saving ? "Saving..." : modal.editing ? "Update" : "Create"}</button>
                <button type="button" onClick={() => setModal({ open: false, editing: null })} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PlatformShell>
  );
}