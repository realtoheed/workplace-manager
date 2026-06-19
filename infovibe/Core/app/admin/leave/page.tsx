import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getHomeRoute, canManageLeave, canFinalizeLeave } from "@/lib/roles";
import PlatformShell from "@/components/PlatformShell";
import LeaveManagementClient from "./LeaveManagementClient";

async function fetchAllLeaves() {
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

export default async function AdminLeavePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageLeave(user.role)) redirect(getHomeRoute(user.role));

  const leaves = await fetchAllLeaves();
  const canFinalize = canFinalizeLeave(user.role);

  return (
    <PlatformShell
      description="Manage leave requests across the organization"
      title="Leave Management"
      user={user}
    >
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-sm">
        <LeaveManagementClient leaves={leaves} userRole={user.role} canFinalize={canFinalize} />
      </div>
    </PlatformShell>
  );
}
