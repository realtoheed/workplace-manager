"use client";

import type { MeetingView } from "@/lib/types";
import { formatDateTime } from "@/utils/format";

type MeetingCardProps = {
  meeting: MeetingView;
  busy?: boolean;
  onJoin: (meeting: MeetingView, roomId: string) => void;
};

export default function MeetingCard({ meeting, busy, onJoin }: MeetingCardProps) {
  return (
    <article className="panel flex flex-col gap-3 p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:bg-slate-800 dark:text-slate-100 dark:hover:border-tide">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-bold text-ink dark:text-white">{meeting.meetingName}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Room ID: {meeting.meetingId}</p>
        </div>
        <span className="badge bg-tide/10 text-tide">{meeting.breakoutRooms.length} breakout rooms</span>
      </div>

      <dl className="grid gap-2 text-sm text-slate-600 dark:text-slate-200 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-900/80">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Created</dt>
          <dd className="mt-1 text-sm">{formatDateTime(meeting.createdAt)}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-1.5 dark:bg-slate-900/80">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Host</dt>
          <dd className="mt-1 text-sm">{meeting.createdByName || "Admin"}</dd>
        </div>
      </dl>

      <div className="mt-auto space-y-3">
        <button
          aria-busy={busy}
          aria-label={`Open breakout rooms for ${meeting.meetingName}`}
          className="button-primary w-full"
          disabled={busy}
          onClick={() => onJoin(meeting, meeting.meetingId)}
          type="button"
        >
          {busy ? "Opening..." : "Open Breakout Rooms"}
        </button>
      </div>
    </article>
  );
}