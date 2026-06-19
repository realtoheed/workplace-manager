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

    const requestedUserId = String(body.requestedUserId || "").trim();
    const requestedUserName = String(body.requestedUserName || "").trim();
    const requestedUserEmail = String(body.requestedUserEmail || "").trim();
    const roomId = String(body.roomId || "").trim();

    if (!requestedUserId) {
      throw new Error("requestedUserId is required");
    }

    const myMeetId = buildMeetParticipantId(session.id);
    if (requestedUserId === session.id || requestedUserId === myMeetId) {
      throw new Error("You cannot request remote control of yourself");
    }

    await connectToDatabase();

    // Cancel any existing pending request from the same requester in the same meeting
    await RemoteControlRequest.updateMany(
      {
        meetingId,
        "requestedBy.id": session.id,
        status: "pending",
      },
      { $set: { status: "expired" } }
    );

    const doc = await RemoteControlRequest.create({
      meetingId,
      roomId,
      requestedBy: {
        id: session.id,
        name: session.name,
        email: session.email,
      },
      requestedUser: {
        id: requestedUserId,
        name: requestedUserName || "Unknown",
        email: requestedUserEmail,
      },
      status: "pending",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    return NextResponse.json({
      success: true,
      request: {
        _id: doc._id,
        meetingId: doc.meetingId,
        status: doc.status,
        expiresAt: doc.expiresAt,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
