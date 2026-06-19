import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import RemoteControlRequest from "@/models/RemoteControlRequest";

function buildMeetParticipantId(userId: string) {
  const normalized = userId.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (normalized.length <= 21) return `pt-${normalized}`;
  return `pt-${normalized.slice(0, 10)}-${normalized.slice(-10)}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const session = await requireApiUser(request);
    const { meetingId } = await params;

    await connectToDatabase();

    const myMeetId = buildMeetParticipantId(session.id);
    const userIdOr = [{ "requestedUser.id": session.id }, { "requestedUser.id": myMeetId }];
    const byIdOr = [{ "requestedBy.id": session.id }, { "requestedBy.id": myMeetId }];

    // Find pending requests where current user is the target
    const pendingRequests = await RemoteControlRequest.find({
      meetingId,
      $or: userIdOr,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).lean();

    // Find accepted sessions where current user is involved
    const activeSessions = await RemoteControlRequest.find({
      meetingId,
      $or: [
        ...byIdOr,
        ...userIdOr,
      ],
      status: "accepted",
    }).lean();

    // Find pending requests the user sent
    const sentRequests = await RemoteControlRequest.find({
      meetingId,
      $or: byIdOr,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).lean();

    return NextResponse.json({
      pendingRequests: pendingRequests.map((d) => serialize(d, session)),
      activeSessions: activeSessions.map((d) => serialize(d, session)),
      sentRequests: sentRequests.map((d) => serialize(d, session)),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function serialize(doc: Record<string, unknown>, session: { id: string }) {
  const myMeetId = buildMeetParticipantId(session.id);
  const by = doc.requestedBy as { id: string } | null;
  const user = doc.requestedUser as { id: string } | null;
  const isController = by?.id === session.id || by?.id === myMeetId;
  const isControlled = user?.id === session.id || user?.id === myMeetId;
  return {
    _id: doc._id,
    meetingId: doc.meetingId,
    roomId: doc.roomId,
    requestedBy: doc.requestedBy,
    requestedUser: doc.requestedUser,
    status: doc.status,
    role: isController ? "controller" : isControlled ? "controlled" : undefined,
    acceptedAt: doc.acceptedAt,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
  };
}
