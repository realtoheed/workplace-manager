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

export default function LeaveRequestList({ leaves }: { leaves: LeaveRequest[] }) {
  if (!leaves || leaves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-800/30 p-8 text-center">
        <p className="text-sm text-slate-400">No leave requests yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leaves.map((leave) => (
        <div
          className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition hover:border-slate-600"
          key={leave.id}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-white">
                {leave.leaveType.charAt(0).toUpperCase() + leave.leaveType.slice(1)} Leave
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {formatDate(leave.startDate)} — {formatDate(leave.endDate)}
              </p>
              {leave.reason && (
                <p className="mt-1 text-sm text-slate-500">{leave.reason}</p>
              )}
              <p className="mt-1 text-xs text-slate-600">
                Requested {formatDate(leave.createdAt)}
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusBadge(leave.finalStatus || leave.tlStatus || "pending")}`}
            >
              {leave.finalStatus || leave.tlStatus || "Pending"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
