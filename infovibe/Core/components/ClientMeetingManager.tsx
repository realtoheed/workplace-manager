"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ClientMeetingView } from "@/lib/types";
import { formatDateTime } from "@/utils/format";

type ClientMeetingManagerProps = {
  initialMeetings: ClientMeetingView[];
};

function toIsoOrEmpty(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function parseClientMeetingJoinRef(joinUrl: string) {
  try {
    const url = new URL(joinUrl, window.location.origin);
    const segments = url.pathname.split("/").filter(Boolean);
    const routeIndex = segments.findIndex((segment) => segment === "client-meeting");

    if (routeIndex < 0) {
      return null;
    }

    const tenantId = decodeURIComponent(segments[routeIndex + 1] || "").trim();
    const token = decodeURIComponent(segments[routeIndex + 2] || "").trim();

    return tenantId && token ? { tenantId, token } : null;
  } catch {
    return null;
  }
}

export default function ClientMeetingManager({ initialMeetings }: ClientMeetingManagerProps) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [form, setForm] = useState({
    endsAt: "",
    projectName: "",
    startsAt: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const orderedMeetings = useMemo(
    () => [...meetings].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [meetings]
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/client-meetings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          endsAt: toIsoOrEmpty(form.endsAt),
          projectName: form.projectName,
          startsAt: toIsoOrEmpty(form.startsAt)
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create client meeting link.");
      }

      setMeetings((current) => [data.meeting, ...current.filter((entry) => entry.id !== data.meeting.id)]);
      setForm({ endsAt: "", projectName: "", startsAt: "" });
      setNotice(`Client meeting link created for ${data.meeting.meetingName}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create client meeting link.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, meetingName: string) {
    setDeletingId(id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/client-meetings/${id}`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete client meeting link.");
      }

      setMeetings((current) => current.filter((entry) => entry.id !== id));
      setNotice(`Deleted client meeting link for ${meetingName}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete client meeting link.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCopyLink(joinUrl: string) {
    setError(null);
    setNotice(null);

    try {
      await navigator.clipboard.writeText(joinUrl);
      setNotice("Client join link copied.");
    } catch {
      setError("Unable to copy client join link.");
    }
  }

  async function handleOpenPrejoin(meeting: ClientMeetingView) {
    setOpeningId(meeting.id);
    setError(null);
    setNotice(null);
    const openedWindow = typeof window === "undefined" ? null : window.open("", "_blank");

    try {
      if (!openedWindow) {
        throw new Error("Please allow pop-ups to open the meeting in a new tab.");
      }

      openedWindow.opener = null;
      openedWindow.document.title = "Opening meeting…";

      const joinRef = parseClientMeetingJoinRef(meeting.joinUrl);

      if (!joinRef) {
        throw new Error("Unable to prepare the internal prejoin link.");
      }

      const response = await fetch("/api/client-meetings/public/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(joinRef)
      });
      const data = await response.json();

      if (!response.ok || !data.joinUrl) {
        throw new Error(data.error || "Unable to open the meeting prejoin page.");
      }

      const nextUrl = new URL(data.joinUrl, window.location.origin);
      nextUrl.searchParams.delete("autoJoin");
      openedWindow.location.replace(nextUrl.toString());

      setNotice(`Opened the internal prejoin for ${meeting.meetingName}.`);
    } catch (requestError) {
      openedWindow?.close();
      setError(requestError instanceof Error ? requestError.message : "Unable to open the meeting prejoin page.");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form className="panel space-y-5 p-5 sm:p-6" onSubmit={handleCreate}>
        <div>
          <h3 className="font-display text-xl font-bold text-ink dark:text-white sm:text-2xl">Create Client Meeting Link</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Generate a dedicated project join page and choose when the meeting should open and end. If you leave the schedule empty, it starts immediately and ends after 3 hours.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-white">Project Name</span>
            <input
              className="input"
              onChange={(event) => setForm((current) => ({ ...current, projectName: event.target.value }))}
              placeholder="Acme Website Redesign"
              required
              value={form.projectName}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-white">Start Time</span>
            <input
              className="input"
              onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
              type="datetime-local"
              value={form.startsAt}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-white">End Time</span>
            <input
              className="input"
              onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
              type="datetime-local"
              value={form.endsAt}
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">Every new project link gets its own private room, direct join page, and auto-cleanup at the selected end time.</p>
          <button className="button-primary w-full sm:w-auto" disabled={submitting} type="submit">
            {submitting ? "Creating..." : "Create Client Link"}
          </button>
        </div>
      </form>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300">{error}</p> : null}
      {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{notice}</p> : null}

      <div className="grid gap-4">
        {orderedMeetings.length ? (
          orderedMeetings.map((meeting) => (
            <div className="panel space-y-4 p-5 sm:p-6" key={meeting.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink dark:text-white sm:text-xl">{meeting.meetingName}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Copy the public client link below, or open the internal prejoin as a signed-in team member.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button className="button-secondary" disabled={openingId === meeting.id} onClick={() => handleOpenPrejoin(meeting)} type="button">
                    {openingId === meeting.id ? "Opening..." : "Open Prejoin"}
                  </button>
                  <button className="button-secondary" onClick={() => handleCopyLink(meeting.joinUrl)} type="button">
                    Copy Link
                  </button>
                  <button className="button-secondary" disabled={deletingId === meeting.id} onClick={() => handleDelete(meeting.id, meeting.meetingName)} type="button">
                    {deletingId === meeting.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Created</p>
                  <p className="mt-2 font-medium text-ink dark:text-white">{formatDateTime(meeting.createdAt)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Starts</p>
                  <p className="mt-2 font-medium text-ink dark:text-white">{formatDateTime(meeting.startsAt)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Ends</p>
                  <p className="mt-2 font-medium text-ink dark:text-white">{formatDateTime(meeting.endsAt)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Created By</p>
                  <p className="mt-2 font-medium text-ink dark:text-white">{meeting.createdByName || "Admin"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Room ID</p>
                  <p className="mt-2 break-all font-medium text-ink dark:text-white">{meeting.roomId}</p>
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Client Join Link</span>
                <input className="input" readOnly value={meeting.joinUrl} />
              </label>
            </div>
          ))
        ) : (
          <div className="panel flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <h3 className="font-display text-xl font-bold text-ink dark:text-white">No client meeting links yet</h3>
            <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">
              Create your first client meeting link above. It will generate a dedicated join page, redirect guests straight into the meeting, and use your custom schedule or the default 3-hour window.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
