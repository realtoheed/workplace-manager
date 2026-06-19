import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import RemoteControlRequest from "@/models/RemoteControlRequest";
import type { SessionUser } from "@/lib/types";

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
    if (!doc.requestedUser || (doc.requestedUser.id !== session.id && doc.requestedUser.id !== myMeetId)) {
      throw new Error("Forbidden");
    }

    const now = new Date();
    if (doc.expiresAt && new Date(doc.expiresAt) < now) {
      throw new Error("Request has expired. Please request again.");
    }

    if (doc.status === "accepted") {
      return NextResponse.json({ success: true, session: serialize(doc.toObject(), session), alreadyAccepted: true });
    }

    if (doc.status !== "pending") {
      throw new Error("Request is no longer pending");
    }

    doc.status = "accepted";
    doc.acceptedAt = new Date();
    doc.expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    await doc.save();

    return NextResponse.json({
      success: true,
      session: serialize(doc.toObject(), session),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

function serialize(doc: Record<string, unknown>, session: SessionUser) {
  const by = doc.requestedBy as { id: string; name: string; email: string } | null;
  const isController = by?.id === session.id;
  return {
    _id: doc._id,
    meetingId: doc.meetingId,
    roomId: doc.roomId,
    requestedBy: doc.requestedBy,
    requestedUser: doc.requestedUser,
    status: doc.status,
    role: isController ? "controller" : "controlled",
    acceptedAt: doc.acceptedAt,
    expiresAt: doc.expiresAt,
  };
}
