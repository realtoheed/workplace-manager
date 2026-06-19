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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const session = await requireApiUser(request);
    const { meetingId } = await params;
    const body = await request.json();
    const requestId = String(body.requestId || "").trim();

    if (!requestId) {
      throw new Error("requestId is required");
    }

    await connectToDatabase();

    const doc = await RemoteControlRequest.findById(requestId);

    if (!doc) {
      throw new Error("NotFound");
    }

    if (doc.meetingId !== meetingId) {
      throw new Error("NotFound");
    }

    const myMeetId = buildMeetParticipantId(session.id);
    const isRequestedUser = doc.requestedUser && (doc.requestedUser.id === session.id || doc.requestedUser.id === myMeetId);
    const isRequester = doc.requestedBy && (doc.requestedBy.id === session.id || doc.requestedBy.id === myMeetId);
    if (!isRequestedUser && !isRequester) {
      throw new Error("Forbidden");
    }

    if (doc.status !== "pending" && doc.status !== "accepted") {
      throw new Error("Request is no longer active");
    }

    doc.status = "declined";
    await doc.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
