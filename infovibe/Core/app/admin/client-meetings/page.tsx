import { redirect } from "next/navigation";
import ClientMeetingManager from "@/components/ClientMeetingManager";
import PlatformShell from "@/components/PlatformShell";
import { getCurrentUser } from "@/lib/auth";
import { listClientMeetings } from "@/lib/client-meetings";
import { canManageClientMeetings } from "@/lib/roles";

export default async function AdminClientMeetingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!canManageClientMeetings(user.role)) {
    redirect("/admin");
  }

  const meetings = await listClientMeetings();

  return (
    <PlatformShell
      description="Create secure client meeting links, copy the generated join page, and control when each meeting opens and ends."
      title="Client Meetings"
      user={user}
    >
      <ClientMeetingManager initialMeetings={meetings} />
    </PlatformShell>
  );
}
