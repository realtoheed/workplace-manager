import CoreMeetBridgeClient from "@/components/CoreMeetBridgeClient";
import { getCurrentUser } from "@/lib/auth";
import { listMeetings } from "@/lib/queries";

type MeetingPageProps = {
  searchParams?: Promise<{
    closeOnLeave?: string;
    desktopShell?: string;
    meetingId?: string;
    roomId?: string;
  }>;
};

export default async function MeetingDirectoryPage({ searchParams }: MeetingPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="max-w-md w-full mx-4">
          <div className="panel p-6 text-center">
            <div className="mb-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <h3 className="font-display text-xl font-bold text-ink dark:text-white mb-2">Access Denied</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              You must be logged in to access MIU Internal meetings. This is a restricted area for authorized personnel only.
            </p>
            <div className="space-y-2">
              <a href="/login" className="button-primary block w-full">
                Login to Continue
              </a>
              <a href="/" className="button-secondary block w-full">
                Back to Home
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const meetings = await listMeetings();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (!meetings.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="panel p-6">
          <h3 className="font-display text-xl font-bold text-ink dark:text-white">MIU Internal meeting is not ready yet</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">The permanent MIU Internal meeting has not been initialized for this workspace yet. Please ask an admin to check meeting setup.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-slate-950">
      <CoreMeetBridgeClient
        closeOnLeave={resolvedSearchParams?.closeOnLeave === "1"}
        desktopShell={resolvedSearchParams?.desktopShell === "1"}
        initialMeetingId={resolvedSearchParams?.meetingId}
        initialRoomId={resolvedSearchParams?.roomId || user.defaultRoomId || undefined}
        meetings={meetings}
        user={user}
      />
    </div>
  );
}