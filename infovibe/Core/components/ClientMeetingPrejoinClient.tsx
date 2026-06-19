"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/utils/format";

type ClientMeetingPrejoinClientProps = {
  endsAt: string;
  initialDisplayName?: string;
  meetingName: string;
  startsAt: string;
  tenantId: string;
  token: string;
};

function getTimestamp(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default function ClientMeetingPrejoinClient({ endsAt, initialDisplayName = "", meetingName, startsAt, tenantId, token }: ClientMeetingPrejoinClientProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const startsAtTimestamp = useMemo(() => getTimestamp(startsAt), [startsAt]);
  const endsAtTimestamp = useMemo(() => getTimestamp(endsAt), [endsAt]);
  const meetingHasStarted = startsAtTimestamp <= 0 || startsAtTimestamp <= now;
  const meetingHasEnded = endsAtTimestamp > 0 && endsAtTimestamp <= now;
  const canJoin = !loading && meetingHasStarted && !meetingHasEnded;
  const statusMessage = meetingHasEnded
    ? "This meeting window has ended. Ask your host for a new link if you still need to join."
    : !meetingHasStarted
      ? `This meeting opens at ${formatDateTime(startsAt)}.`
      : "Continue to open the meeting. Clients join directly after this step, while signed-in teammates may see the meeting prejoin page first.";

  async function handleJoin() {
    if (!canJoin) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/client-meetings/public/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName,
          tenantId,
          token
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to join this client meeting.");
      }

      if (!data.joinUrl) {
        throw new Error("The meeting link could not be prepared.");
      }

      window.location.assign(data.joinUrl);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Unable to join this client meeting.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-300">InfoVibeX Client Meeting</p>
          <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">{meetingName}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Use this page to confirm your details before entering the meeting room. Clients continue straight in, while signed-in teammates can be sent to the meeting prejoin page.</p>

          <div className="mt-6 space-y-3 rounded-3xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-slate-200 sm:px-5">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
              <span className="text-slate-400">Project</span>
              <span className="text-right font-medium text-white">{meetingName}</span>
            </div>
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3">
              <span className="text-slate-400">Starts</span>
              <span className="text-right font-medium text-white">{formatDateTime(startsAt)}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-slate-400">Ends</span>
              <span className="text-right font-medium text-white">{formatDateTime(endsAt)}</span>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-300">{statusMessage}</p>

          <div className="mt-6 space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-white">Your name</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400"
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Leave blank if you are already signed in"
                value={displayName}
              />
            </label>

            <button
              className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              disabled={!canJoin}
              onClick={handleJoin}
              type="button"
            >
              {loading ? "Redirecting..." : meetingHasEnded ? "Meeting Ended" : !meetingHasStarted ? "Meeting Not Started Yet" : "Continue to Meeting"}
            </button>
          </div>

          {error ? <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
