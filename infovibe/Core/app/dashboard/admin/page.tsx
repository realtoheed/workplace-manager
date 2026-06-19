import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHomeRoute } from "@/lib/roles";
import PlatformShell from "@/components/PlatformShell";
import DashboardStats from "@/components/DashboardStats";

async function fetchDashboardStats() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/dashboard/stats`, {
      cache: "no-store",
      headers: { cookie: "" },
    });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "super_admin") redirect(getHomeRoute(user.role));

  let stats: { label: string; value: number; accent: string }[] = [];

  const data = await fetchDashboardStats();
  if (data?.stats) {
    stats = [
      { label: "Total Employees", value: data.stats.totalEmployees ?? 0, accent: "bg-indigo-500/10 text-indigo-400" },
      { label: "Departments", value: data.stats.totalDepartments ?? 0, accent: "bg-blue-500/10 text-blue-400" },
      { label: "Active Meetings", value: data.stats.activeMeetings ?? 0, accent: "bg-emerald-500/10 text-emerald-400" },
      { label: "Pending Leaves", value: data.stats.pendingLeaveRequests ?? 0, accent: "bg-amber-500/10 text-amber-400" },
      { label: "Attendance Today", value: data.stats.attendanceToday ?? 0, accent: "bg-violet-500/10 text-violet-400" },
    ];
  }

  return (
    <PlatformShell
      description="Full system administration dashboard"
      title={`Admin Dashboard — ${user.name}`}
      user={user}
    >
      <DashboardStats stats={stats} />

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-lg font-bold text-white">System Management</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <a
            href="/admin/employees"
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-sm font-medium text-slate-200 transition hover:border-indigo-500/50 hover:bg-slate-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </span>
            User Management
          </a>
          <a
            href="/admin/departments"
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-sm font-medium text-slate-200 transition hover:border-blue-500/50 hover:bg-slate-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </span>
            Department Management
          </a>
          <a
            href="/admin/leave"
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-sm font-medium text-slate-200 transition hover:border-amber-500/50 hover:bg-slate-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            All Leave Requests
          </a>
          <a
            href="/admin/salary"
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-sm font-medium text-slate-200 transition hover:border-emerald-500/50 hover:bg-slate-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            Salary Management
          </a>
          <a
            href="/admin/meetings"
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-sm font-medium text-slate-200 transition hover:border-violet-500/50 hover:bg-slate-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            Meeting Configuration
          </a>
          <a
            href="/admin/attendance"
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-sm font-medium text-slate-200 transition hover:border-cyan-500/50 hover:bg-slate-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </span>
            Attendance Report
          </a>
        </div>
      </section>
    </PlatformShell>
  );
}
