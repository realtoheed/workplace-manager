import { redirect } from "next/navigation";
import PlatformShell from "@/components/PlatformShell";
import { getCurrentUser } from "@/lib/auth";
import { listMeetRecordingsForUser } from "@/lib/queries";
import type { MeetRecordingView } from "@/lib/types";
import { formatDateTime } from "@/utils/format";

export default async function RecordingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const recordings = await listMeetRecordingsForUser(user);

  return (
    <PlatformShell
      description="Open recordings captured by InfoVibeX Meet and saved for your hosted sessions."
      title="Recordings"
      user={user}
    >
      <section className="panel p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-ink dark:text-white sm:text-2xl">Meeting Recordings</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Recordings saved from Meet are listed here and open from the Meet storage server in a new tab.
            </p>
          </div>
          <span className="badge bg-tide/10 text-tide dark:bg-tide/20 dark:text-tide">
            {recordings.length} recording{recordings.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      {recordings.length ? (
        <section className="grid gap-3 xl:grid-cols-2">
          {recordings.map((recording: MeetRecordingView) => (
            <article className="panel flex flex-col gap-3 p-3 sm:p-4" key={recording.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-ink dark:text-white">{recording.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Meeting ID: {recording.meetingId || "-"}</p>
                </div>
                <span className="badge bg-signal/10 text-signal dark:bg-signal/20 dark:text-signal">
                  {recording.durationLabel || "Duration unavailable"}
                </span>
              </div>

              <dl className="grid gap-2 text-sm text-slate-600 dark:text-slate-200 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/80">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Recorded</dt>
                  <dd className="mt-1">{formatDateTime(recording.createdAt)}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/80">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Host</dt>
                  <dd className="mt-1">{recording.hostName || user.name}</dd>
                </div>
              </dl>

              <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{recording.url || "Recording link unavailable"}</p>
                {recording.url ? (
                  <a className="button-primary whitespace-nowrap" href={recording.url} rel="noreferrer" target="_blank">
                    Open Recording
                  </a>
                ) : (
                  <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">Unavailable</span>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel flex flex-col items-center justify-center p-8 text-center sm:p-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800">
            <svg className="h-8 w-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="4" y="5" width="16" height="14" rx="2" strokeWidth="1.5" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 9.5L15 12L10 14.5V9.5z" />
            </svg>
          </div>
          <h3 className="mt-4 font-display text-lg font-bold text-ink dark:text-white">No recordings yet</h3>
          <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
            Once you stop and save a meeting recording in Meet, it will appear here for quick access from Core TaskManager.
          </p>
        </section>
      )}
    </PlatformShell>
  );
}
