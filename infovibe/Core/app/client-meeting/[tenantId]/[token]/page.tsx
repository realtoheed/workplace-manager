import Link from "next/link";
import ClientMeetingPrejoinClient from "@/components/ClientMeetingPrejoinClient";
import { getCurrentUser } from "@/lib/auth";
import { getClientMeetingPublicState } from "@/lib/client-meetings";

type ClientMeetingPageProps = {
  params: Promise<{
    tenantId: string;
    token: string;
  }>;
};

export default async function ClientMeetingJoinPage({ params }: ClientMeetingPageProps) {
  const { tenantId, token } = await params;
  const user = await getCurrentUser();
  const state = await getClientMeetingPublicState(token);

  if (state.status !== "active" || !state.meeting) {
    const title = state.status === "expired" ? "This meeting link has expired" : "Client meeting link not found";
    const body =
      state.status === "expired"
        ? "Ask your host to create a new client meeting link. Expired links are removed automatically after the scheduled meeting window ends."
        : "The link may be invalid or it may already have been deleted by the host.";

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
        <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-300">InfoVibeX Client Meeting</p>
          <h1 className="mt-4 font-display text-3xl font-bold text-white">{title}</h1>
          <p className="mt-3 text-sm text-slate-300">{body}</p>
          <Link className="mt-6 inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500" href="/login">
            Back to TaskManager
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ClientMeetingPrejoinClient
      endsAt={state.meeting.expiresAt ? new Date(state.meeting.expiresAt).toISOString() : new Date().toISOString()}
      initialDisplayName={user?.name || ""}
      meetingName={String(state.meeting.meetingName || "Client Meeting")}
      startsAt={state.meeting.startsAt ? new Date(state.meeting.startsAt).toISOString() : state.meeting.createdAt ? new Date(state.meeting.createdAt).toISOString() : new Date().toISOString()}
      tenantId={tenantId}
      token={token}
    />
  );
}
