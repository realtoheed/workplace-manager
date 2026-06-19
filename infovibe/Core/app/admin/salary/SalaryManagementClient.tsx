"use client";

import { useEffect, useState, useCallback } from "react";

type Employee = { id: string; name: string; email: string; designation?: string | null };
type SalaryRecord = {
  id: string; userId: string; employeeName: string; employeeEmail: string; designation: string;
  month: number; year: number; monthlySalary: number; absentDays: number; deductions: number; netSalary: number; status: string;
};
type SalaryChange = {
  id: string; userId: string; oldSalary: number; newSalary: number; reason: string;
  changedBy: { id: string; name: string; email: string } | null;
  effectiveFrom: string; createdAt: string;
};

function monthName(m: number) { return new Date(2020, m - 1).toLocaleString("en", { month: "short" }); }
function fmt(n: number) { return n.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function statusBadge(s: string) {
  const map: Record<string, string> = { draft: "bg-amber-500/10 text-amber-400", pending: "bg-blue-500/10 text-blue-400", approved: "bg-emerald-500/10 text-emerald-400", paid: "bg-violet-500/10 text-violet-400" };
  return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${map[s] || "bg-slate-500/10 text-slate-400"}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
}

export default function SalaryManagementClient() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [changes, setChanges] = useState<SalaryChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<Employee | null>(null);
  const [modal, setModal] = useState<{ open: boolean; editing: SalaryRecord | null }>({ open: false, editing: null });
  const [incrementModal, setIncrementModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ userId: "", month: new Date().getMonth() + 1, year: new Date().getFullYear(), monthlySalary: "", absentDays: "0", deductions: "0", reason: "" });

  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) { const d = await res.json(); setEmployees(d.users || []); }
    } catch {}
  }, []);

  const loadRecords = useCallback(async (userId: string) => {
    try {
      const [recRes, chRes] = await Promise.all([
        fetch(`/api/salary?userId=${userId}`),
        fetch(`/api/salary/changes?userId=${userId}`),
      ]);
      if (recRes.ok) { const d = await recRes.json(); setRecords(d.records || []); }
      if (chRes.ok) { const d = await chRes.json(); setChanges(d.changes || []); }
    } catch {}
  }, []);

  useEffect(() => { loadEmployees().finally(() => setLoading(false)); }, [loadEmployees]);

  function selectEmployee(emp: Employee) {
    setSelectedUser(emp);
    setRecords([]);
    setChanges([]);
    loadRecords(emp.id);
  }

  function openAdd() {
    setForm({ userId: selectedUser?.id || "", month: new Date().getMonth() + 1, year: new Date().getFullYear(), monthlySalary: "", absentDays: "0", deductions: "0", reason: "" });
    setModal({ open: true, editing: null });
  }

  function openEdit(rec: SalaryRecord) {
    setForm({ userId: rec.userId, month: rec.month, year: rec.year, monthlySalary: String(rec.monthlySalary), absentDays: String(rec.absentDays), deductions: String(rec.deductions), reason: "" });
    setModal({ open: true, editing: rec });
  }

  function openIncrement() {
    const last = records[0];
    setForm({ userId: selectedUser?.id || "", month: new Date().getMonth() + 1, year: new Date().getFullYear(), monthlySalary: last ? String(last.monthlySalary + 5000) : "50000", absentDays: "0", deductions: "0", reason: "Annual increment" });
    setIncrementModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (incrementModal) {
        const last = records[0];
        if (!last || !selectedUser) return;
        const newSal = parseFloat(form.monthlySalary);
        await fetch("/api/salary/changes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedUser.id, oldSalary: last.monthlySalary, newSalary: newSal, reason: form.reason || "Increment", effectiveFrom: new Date().toISOString() }),
        });
      } else if (modal.editing) {
        await fetch(`/api/salary/${modal.editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monthlySalary: parseFloat(form.monthlySalary), absentDays: parseInt(form.absentDays), deductions: parseFloat(form.deductions), reason: "Updated" }),
        });
      } else {
        if (!form.userId) return;
        await fetch("/api/salary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: form.userId, month: form.month, year: form.year, monthlySalary: parseFloat(form.monthlySalary), absentDays: parseInt(form.absentDays), deductions: parseFloat(form.deductions) }),
        });
      }
      setModal({ open: false, editing: null });
      setIncrementModal(false);
      if (selectedUser) loadRecords(selectedUser.id);
    } catch { alert("Failed to save"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this salary record?")) return;
    try { await fetch(`/api/salary/${id}`, { method: "DELETE" }); if (selectedUser) loadRecords(selectedUser.id); }
    catch { alert("Failed to delete"); }
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Employee list */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 backdrop-blur-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Employees</h2>
        <div className="space-y-1 max-h-[70vh] overflow-y-auto">
          {employees.map((emp) => (
            <button
              key={emp.id}
              onClick={() => selectEmployee(emp)}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${selectedUser?.id === emp.id ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "text-slate-300 hover:bg-slate-800/50"}`}
            >
              <div className="font-medium truncate">{emp.name}</div>
              <div className="text-xs text-slate-500 truncate">{emp.email}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Salary details */}
      <div className="space-y-4">
        {selectedUser ? (
          <>
            <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/60 p-4 backdrop-blur-sm">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedUser.name}</h2>
                <p className="text-sm text-slate-400">{selectedUser.email} {selectedUser.designation ? `· ${selectedUser.designation}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={openAdd} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition">+ Add Salary</button>
                <button onClick={openIncrement} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition">+ Increment</button>
              </div>
            </div>

            {/* Salary records table */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 backdrop-blur-sm">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Monthly Records ({records.length})</h3>
              {records.length === 0 ? (
                <p className="text-sm text-slate-500">No salary records yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-widest text-slate-400">
                        <th className="px-3 py-2">Period</th>
                        <th className="px-3 py-2 text-right">Base</th>
                        <th className="px-3 py-2 text-right">Absent</th>
                        <th className="px-3 py-2 text-right">Deductions</th>
                        <th className="px-3 py-2 text-right">Net</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 w-20">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id} className="border-b border-slate-800 text-slate-300">
                          <td className="px-3 py-2 font-medium text-white">{monthName(r.month)} {r.year}</td>
                          <td className="px-3 py-2 text-right">{fmt(r.monthlySalary)}</td>
                          <td className="px-3 py-2 text-right">{r.absentDays}d</td>
                          <td className="px-3 py-2 text-right text-red-400">-{fmt(r.deductions)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-400">{fmt(r.netSalary)}</td>
                          <td className="px-3 py-2" dangerouslySetInnerHTML={{ __html: statusBadge(r.status) }} />
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => openEdit(r)} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-600">E</button>
                              <button onClick={() => handleDelete(r.id)} className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400 hover:bg-red-500/20">D</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Increment history */}
            {changes.length > 0 && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 backdrop-blur-sm">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-400">Increment History ({changes.length})</h3>
                <div className="space-y-2">
                  {changes.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
                      <div>
                        <div className="text-sm text-white">
                          <span className="text-red-400">{fmt(c.oldSalary)}</span>
                          <span className="mx-2 text-slate-500">→</span>
                          <span className="text-emerald-400">{fmt(c.newSalary)}</span>
                          <span className="ml-2 text-xs text-slate-400">(+{fmt(c.newSalary - c.oldSalary)})</span>
                        </div>
                        <div className="text-xs text-slate-500">{c.reason} · {new Date(c.effectiveFrom).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        by {c.changedBy?.name || "System"}<br/>{new Date(c.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/30">
            <p className="text-sm text-slate-500">Select an employee to view salary records</p>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {(modal.open || incrementModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setModal({ open: false, editing: null }); setIncrementModal(false); }}>
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">{incrementModal ? "Add Increment" : modal.editing ? "Edit Salary" : "Add Salary"}</h3>
            <form onSubmit={handleSave} className="grid gap-3">
              {!selectedUser && !modal.editing && (
                <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
                  <option value="">Select employee</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              )}
              {!incrementModal && !modal.editing && (
                <div className="grid grid-cols-2 gap-2">
                  <select className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" value={form.month} onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })}>
                    {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>)}
                  </select>
                  <input className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} />
                </div>
              )}
              <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Monthly Salary" type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} required />
              {!incrementModal && (
                <>
                  <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Absent Days" type="number" value={form.absentDays} onChange={(e) => setForm({ ...form, absentDays: e.target.value })} />
                  <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Deductions" type="number" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} />
                </>
              )}
              {incrementModal && (
                <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              )}
              <div className="flex gap-2 mt-2">
                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                <button type="button" onClick={() => { setModal({ open: false, editing: null }); setIncrementModal(false); }} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}