"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: string;
  name: string;
  email: string;
};

type AttendanceRecord = {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  date: string;
  firstJoinAt: string | null;
  lastLeaveAt: string | null;
  totalWorkMinutes: number;
  breakMinutes: number;
  screenshareMinutes: number;
  lateMinutes: number;
  status: string;
};

type AttendanceHistoryManagerProps = {
  employees: Employee[];
  currentUserId?: string;
  showEmployeeSelector?: boolean;
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    present: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Present" },
    absent: { bg: "bg-red-500/10", text: "text-red-400", label: "Absent" },
    late: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Late" },
    half_day: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Half Day" },
    active: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Active" },
  };
  const config = map[status] || { bg: "bg-slate-500/10", text: "text-slate-400", label: status };
  return (
    <span className={`inline-flex items-center rounded-full ${config.bg} px-3 py-1 text-xs font-semibold ${config.text}`}>
      {config.label}
    </span>
  );
}

export default function AttendanceHistoryManager({
  employees,
  currentUserId,
  showEmployeeSelector = true,
}: AttendanceHistoryManagerProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentUserId || "");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  async function handleLoadHistory(explicitEmployeeId?: string) {
    const userId = explicitEmployeeId || selectedEmployeeId;
    if (!userId) {
      setError("Please select an employee.");
      setRecords([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isManager = showEmployeeSelector;
      const endpoint = isManager
        ? `/api/attendance/report?userId=${encodeURIComponent(userId)}`
        : `/api/attendance/my`;

      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load attendance history.");
      }

      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load attendance history.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!showEmployeeSelector && currentUserId) {
      void handleLoadHistory(currentUserId);
    }
  }, []);

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6 backdrop-blur-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {showEmployeeSelector ? (
          <label className="w-full max-w-md space-y-2">
            <span className="text-sm font-semibold text-slate-300">Select team member</span>
            <select
              className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              value={selectedEmployeeId}
            >
              <option value="">Choose employee...</option>
              {sortedEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.email})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showEmployeeSelector ? (
          <button
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 active:scale-95 disabled:opacity-50"
            disabled={loading}
            onClick={() => handleLoadHistory()}
            type="button"
          >
            {loading ? "Loading..." : "View History"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-widest text-slate-400">
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">First Join</th>
              <th className="px-3 py-3">Last Leave</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Work Time</th>
              <th className="px-3 py-3">Breaks</th>
              <th className="px-3 py-3">Screen Share</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr className="border-b border-slate-800 text-sm text-slate-300" key={record.id}>
                <td className="px-3 py-3">{formatDate(record.date)}</td>
                <td className="px-3 py-3">{formatDateTime(record.firstJoinAt)}</td>
                <td className="px-3 py-3">{formatDateTime(record.lastLeaveAt)}</td>
                <td className="px-3 py-3">{statusBadge(record.status)}</td>
                <td className="px-3 py-3 font-semibold text-white">{formatMinutes(record.totalWorkMinutes)}</td>
                <td className="px-3 py-3 text-slate-400">{formatMinutes(record.breakMinutes)}</td>
                <td className="px-3 py-3 text-slate-400">{formatMinutes(record.screenshareMinutes)}</td>
              </tr>
            ))}
            {!records.length && !loading ? (
              <tr>
                <td className="px-3 py-6 text-sm text-slate-500" colSpan={7}>
                  No attendance records to display.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}