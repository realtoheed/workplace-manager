import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHomeRoute } from "@/lib/roles";
import PlatformShell from "@/components/PlatformShell";
import LeaveRequestForm from "./LeaveRequestForm";
import LeaveRequestList from "./LeaveRequestList";

async function fetchLeaveRequests(userId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/leave`, {
      cache: "no-store",
      headers: { cookie: "" },
    });
    if (res.ok) {
      const data = await res.json();
      return data.leaves ?? [];
    }
  } catch {}
  return [];
}

export default async function LeavePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!["employee", "team_lead"].includes(user.role)) redirect(getHomeRoute(user.role));

  const leaves = await fetchLeaveRequests(user.id);

  return (
    <PlatformShell
      description="Request and track your leave"
      title="Leave Portal"
      user={user}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-bold text-white">Request Leave</h2>
            <LeaveRequestForm />
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-bold text-white">My Leave Requests</h2>
            <LeaveRequestList leaves={leaves} />
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}
