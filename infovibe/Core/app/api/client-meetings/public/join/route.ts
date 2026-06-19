import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getClientMeetingPublicState } from "@/lib/client-meetings";
import { buildClientMeetingRoomBindings, buildClientGuestEmail, buildMeetEmbedUrl, buildMeetParticipantId, buildMeetProfileId, findMeetRoomBinding } from "@/lib/meet";
import { clientMeetingJoinSchema } from "@/lib/validations";

function randomGuestId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: NextRequest) {
  try {
    const payload = clientMeetingJoinSchema.parse(await request.json());
    let session = null;

    try {
      session = await requireApiUser(request);
    } catch {
      session = null;
    }

    const state = await getClientMeetingPublicState(payload.token);

    if (state.status === "missing") {
      return NextResponse.json({ error: "Client meeting link not found." }, { status: 404 });
    }

    if (state.status === "expired") {
      return NextResponse.json({ error: "This client meeting link has expired." }, { status: 410 });
    }

    const meeting = state.meeting;
    const requestedDisplayName = String(payload.displayName || "").trim();
    const creatorUserId = String(meeting.createdBy || "").trim();

    if (!session && !requestedDisplayName) {
      return NextResponse.json({ error: "Please enter your name to join this client meeting." }, { status: 400 });
    }

    const resolvedDisplayName = session ? session.name : requestedDisplayName;
    const participantId = session ? buildMeetParticipantId(session.id) : randomGuestId("cg");
    const profileId = session ? buildMeetProfileId(session.id) : randomGuestId("gp");
    const hostProfileId = creatorUserId ? buildMeetProfileId(creatorUserId) : "";
    const isPrivilegedInternalSession = Boolean(
      session
      && (session.role === "super_admin" || (creatorUserId && session.id === creatorUserId))
    );
    const clientMeetingRole = isPrivilegedInternalSession ? "host" : session ? "internal" : "guest";
    const roomBindings = buildClientMeetingRoomBindings(String(meeting.roomId || ""), String(meeting.meetingName || "Client Meeting"));
    const primaryRoom = findMeetRoomBinding(roomBindings, String(meeting.roomId || ""));
    const clientActivityUrl = new URL("/api/client-meetings/public/activity", request.nextUrl.origin).toString();
    const clientMeetingJoinUrl = new URL(`/client-meeting/core/${encodeURIComponent(payload.token)}`, request.nextUrl.origin).toString();
    const startsAt = meeting.startsAt ? new Date(meeting.startsAt).toISOString() : "";
    const startsAtTimestamp = startsAt ? new Date(startsAt).getTime() : 0;
    const meetingType = startsAt ? "scheduled" : "instant";

    if (startsAtTimestamp > Date.now()) {
      return NextResponse.json({
        error: "This client meeting has not started yet.",
        startsAt
      }, { status: 409 });
    }

    if (!primaryRoom) {
      return NextResponse.json({ error: "This client meeting is missing its room configuration." }, { status: 500 });
    }

    const joinUrl = buildMeetEmbedUrl({
      autoJoin: clientMeetingRole === "guest",
      breakoutRoomCount: 0,
      clientActivityUrl,
      clientMeetingJoinUrl,
      clientMeetingHostProfileId: hostProfileId,
      clientMeetingRole,
      clientMeetingToken: payload.token,
      closeOnLeave: Boolean(session),
      displayName: resolvedDisplayName,
      meetingId: primaryRoom.physicalRoomId,
      meetingStartsAt: startsAt,
      meetingTitle: String(meeting.meetingName || "Client Meeting"),
      meetingType,
      participantId,
      profileId,
      roomId: primaryRoom.physicalRoomId,
      rooms: roomBindings
    });

    return NextResponse.json({
      displayName: resolvedDisplayName,
      email: session ? session.email : buildClientGuestEmail(payload.token, participantId),
      joinUrl,
      meetingId: String(meeting.roomId || ""),
      participantId,
      profileId,
      roomId: String(meeting.roomId || "")
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
