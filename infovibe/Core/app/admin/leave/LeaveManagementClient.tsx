"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LeaveRequest = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  tlStatus: string;
  hrStatus: string;
  finalStatus: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    departmentId: string | null;
  };
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-400 border-red-500/20",
    recommended: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  return styles[status] || styles.pending;
}

export default function LeaveManagementClient({
  leaves,
  userRole,
  canFinalize,
}: {
  leaves: LeaveRequest[];
  userRole: string;
  canFinalize: boolean;
}) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleAction(leaveId: string, action: string) {
    setActionLoading(leaveId);
    try {
      const endpoint =
        userRole === "team_lead"
          ? `/api/leave/${leaveId}/tl-action`
          : `/api/leave/${leaveId}/hr-action`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Action failed");
      }
      router.refresh();
    } catch {
      alert("Something went wrong.");
    } finally {
      setActionLoading(null);
    }
  }

  function getActions(leave: LeaveRequest) {
    if (userRole === "team_lead") {
      if (leave.tlStatus !== "pending") return null;
      return (
        <div className="flex gap-2">
          <button
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            disabled={actionLoading === leave.id}
            onClick={() => handleAction(leave.id, "recommend")}
          >
            {actionLoading === leave.id ? "..." : "Recommend"}
          </button>
          <button
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
            disabled={actionLoading === leave.id}
            onClick={() => handleAction(leave.id, "reject")}
          >
            {actionLoading === leave.id ? "..." : "Reject"}
          </button>
        </div>
      );
    }

    if (canFinalize) {
      const isPending = leave.finalStatus === "pending";
      return (
        <div className="flex gap-2">
          <button
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            disabled={actionLoading === leave.id || !isPending}
            onClick={() => handleAction(leave.id, "approve")}
          >
            {actionLoading === leave.id ? "..." : "Approve"}
          </button>
          <button
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
            disabled={actionLoading === leave.id || !isPending}
            onClick={() => handleAction(leave.id, "reject")}
          >
            {actionLoading === leave.id ? "..." : "Reject"}
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-white">
        {userRole === "team_lead" ? "Department Leave Requests" : "All Leave Requests"}
      </h2>

      <div className="space-y-3">
        {leaves.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/30 p-8 text-center">
            <p className="text-sm text-slate-400">No leave requests found.</p>
          </div>
        ) : (
          leaves.map((leave) => (
            <div
              className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition hover:border-slate-600"
              key={leave.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{leave.user.name}</p>
                    <span className="text-xs text-slate-500">({leave.user.email})</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">
                    {leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)} Leave
                  </p>
                  <p className="text-sm text-slate-400">
                    {formatDate(leave.startDate)} — {formatDate(leave.endDate)}
                  </p>
                  {leave.reason && (
                    <p className="mt-1 text-sm text-slate-500">{leave.reason}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {leave.tlStatus && (
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusBadge(leave.tlStatus)}`}
                      >
                        TL: {leave.tlStatus}
                      </span>
                    )}
                    {leave.hrStatus && (
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusBadge(leave.hrStatus)}`}
                      >
                        HR: {leave.hrStatus}
                      </span>
                    )}
                    {leave.finalStatus && (
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusBadge(leave.finalStatus)}`}
                      >
                        Final: {leave.finalStatus}
                      </span>
                    )}
                  </div>
                </div>
                {getActions(leave)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
