"use client";

import { useEffect, useState, useCallback } from "react";

type Employee = {
  id: string;
  name: string;
  email: string;
  role: string;
  designation: string | null;
  department: string | null;
  departmentId: string | null;
  defaultRoomId: string | null;
  hireDate: string | null;
  isActive: boolean;
};

type Department = {
  id: string;
  name: string;
};

type BreakoutRoom = {
  id: string;
  name: string;
};

const ROLES = ["employee", "team_lead", "hr", "super_admin"];

function roleLabel(r: string) {
  return r.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EmployeeTable({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [breakoutRooms, setBreakoutRooms] = useState<BreakoutRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ open: boolean; editing: Employee | null }>({ open: false, editing: null });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee", designation: "", departmentId: "", salary: "", defaultRoomId: "", hireDate: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, deptRes, meetRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/departments"),
        fetch("/api/meetings/persistent"),
      ]);
      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.users || []);
      }
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data.departments || []);
      }
      if (meetRes.ok) {
        const data = await meetRes.json();
        setBreakoutRooms(data.meeting?.breakoutRooms || []);
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openAdd() {
    setForm({ name: "", email: "", password: "", role: "employee", designation: "", departmentId: "", salary: "", defaultRoomId: "", hireDate: "" });
    setModal({ open: true, editing: null });
  }

  function openEdit(emp: Employee) {
    setForm({
      name: emp.name,
      email: emp.email,
      password: "",
      role: emp.role,
      designation: emp.designation || "",
      departmentId: emp.departmentId || "",
      salary: "",
      defaultRoomId: emp.defaultRoomId || "",
      hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : "",
    });
    setModal({ open: true, editing: emp });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.hireDate) { alert("Name, email, and joining date are required."); return; }
    setSaving(true);
    try {
      if (modal.editing) {
        const res = await fetch(`/api/users/${modal.editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designation: form.designation,
            departmentId: form.departmentId || null,
            defaultRoomId: form.defaultRoomId || null,
            hireDate: form.hireDate ? new Date(form.hireDate).toISOString() : null,
            isActive: true,
            role: form.role,
          }),
        });
        if (!res.ok) throw new Error();
      } else {
        if (!form.password || form.password.length < 6) { alert("Password must be at least 6 characters"); setSaving(false); return; }
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
            designation: form.designation,
            departmentId: form.departmentId || null,
            salary: parseFloat(form.salary) || null,
            defaultRoomId: form.defaultRoomId || null,
            hireDate: new Date(form.hireDate).toISOString(),
          }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Failed"); }
      }
      setModal({ open: false, editing: null });
      fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string, name: string) {
    if (!confirm(`Deactivate ${name}?`)) return;
    try {
      await fetch(`/api/users/${id}`, { method: "DELETE" });
      fetchData();
    } catch {
      alert("Failed to deactivate");
    }
  }

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;

  return (
    <>
      {children}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Employees ({employees.length})</h2>
        <button onClick={openAdd} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 transition">
          + Add Employee
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-900/60 backdrop-blur-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-widest text-slate-400">
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Email</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Department</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-slate-800 text-slate-300 hover:bg-slate-800/30">
                <td className="px-3 py-2.5 font-medium text-white">{emp.name}</td>
                <td className="px-3 py-2.5">{emp.email}</td>
                <td className="px-3 py-2.5 capitalize text-xs">{roleLabel(emp.role)}</td>
                <td className="px-3 py-2.5">{emp.department || emp.designation || "-"}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${emp.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {emp.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(emp)} className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 transition">Edit</button>
                    <button onClick={() => handleDeactivate(emp.id, emp.name)} className="rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20 transition">Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setModal({ open: false, editing: null })}>
          <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-white">{modal.editing ? "Edit Employee" : "Add Employee"}</h3>
            <form onSubmit={handleSave} className="grid gap-3">
              <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              {!modal.editing && (
                <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Password (min 6 chars)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              )}
              <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" value={form.defaultRoomId} onChange={(e) => setForm({ ...form, defaultRoomId: e.target.value })}>
                <option value="">Default (Main Room)</option>
                {breakoutRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">No department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required />
              <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Joining Date" type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} required />
              {!modal.editing && (
                <input className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" placeholder="Salary" type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} required />
              )}
              <div className="flex gap-2 mt-2">
                <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 transition disabled:opacity-50">{saving ? "Saving..." : modal.editing ? "Update" : "Create"}</button>
                <button type="button" onClick={() => setModal({ open: false, editing: null })} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-800 transition">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}