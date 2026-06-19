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

export default async function EmployeeDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "employee") redirect(getHomeRoute(user.role));

  let stats: { label: string; value: number; accent: string }[] = [];

  const data = await fetchDashboardStats();
  if (data?.stats) {
    stats = [
      {
        label: "Today's Attendance",
        value: data.stats.myAttendance?.status === "present" ? 1 : 0,
        accent: "bg-emerald-500/10 text-emerald-400",
      },
      { label: "Pending Leaves", value: data.stats.pendingLeaves ?? 0, accent: "bg-amber-500/10 text-amber-400" },
      { label: "Upcoming Meetings", value: data.stats.upcomingMeetings ?? 0, accent: "bg-blue-500/10 text-blue-400" },
    ];
  }

  return (
    <PlatformShell
      description="Your personal dashboard"
      title={`Welcome back, ${user.name}`}
      user={user}
    >
      <DashboardStats stats={stats} />

      <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-sm">
        <h2 className="mb-4 text-lg font-bold text-white">Quick Actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/attendance"
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-sm font-medium text-slate-200 transition hover:border-emerald-500/50 hover:bg-slate-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            Join Office
          </a>
          <a
            href="/leave"
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-sm font-medium text-slate-200 transition hover:border-amber-500/50 hover:bg-slate-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </span>
            Request Leave
          </a>
          <a
            href="/attendance"
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-sm font-medium text-slate-200 transition hover:border-blue-500/50 hover:bg-slate-800"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V10m0 0V14m0-4h4m-4 0H8" /></svg>
            </span>
            View Attendance
          </a>
        </div>
      </section>
    </PlatformShell>
  );
}
