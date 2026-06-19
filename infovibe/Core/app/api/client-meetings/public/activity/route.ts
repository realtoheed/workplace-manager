import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api";
import { upsertAttendanceOnJoin, finalizeAttendanceOnLeave } from "@/lib/attendance";
import { requireApiUser } from "@/lib/auth";
import { getClientMeetingPublicState } from "@/lib/client-meetings";
import { buildClientGuestEmail, getMeetBaseUrl } from "@/lib/meet";
import { prisma } from "@/lib/prisma";

const clientMeetingActivitySchema = z.object({
  action: z.enum(["join", "leave", "screen-share-start", "screen-share-stop"]),
  displayName: z.string().trim().max(120).optional().default(""),
  participantId: z.string().trim().min(1).max(160),
  room: z.string().trim().max(160).optional().default(""),
  tenantId: z.string().trim().min(1).max(120),
  timestamp: z.string().datetime().optional(),
  token: z.string().trim().min(16).max(120),
});

function buildCorsHeaders(request: NextRequest) {
  const origin = String(request.headers.get("origin") || "");
  const allowedOrigins = new Set<string>([request.nextUrl.origin]);
  try { allowedOrigins.add(new URL(getMeetBaseUrl()).origin); } catch {}
  const allowOrigin = allowedOrigins.has(origin) ? origin : request.nextUrl.origin;
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
  };
}

function jsonWithCors(request: NextRequest, body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...buildCorsHeaders(request), ...(init?.headers || {}) },
  });
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { headers: buildCorsHeaders(request), status: 204 });
}

export async function POST(request: NextRequest) {
  try {
    const payload = clientMeetingActivitySchema.parse(await request.json());
    let session = null;
    try { session = await requireApiUser(request); } catch { session = null; }

    const state = await getClientMeetingPublicState(payload.token);
    if (state.status === "missing") {
      return jsonWithCors(request, { error: "Client meeting link not found." }, { status: 404 });
    }
    if (state.status === "expired") {
      return jsonWithCors(request, { error: "This client meeting link has expired." }, { status: 410 });
    }

    const meetingId = String(state.meeting.roomId || "").trim();
    const room = String(payload.room || meetingId).trim() || meetingId;
    const displayName = session ? session.name : String(payload.displayName || "").trim();
    const userId = session ? session.id : payload.participantId;
    const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

    if (!meetingId) {
      return jsonWithCors(request, { error: "This client meeting is missing its room configuration." }, { status: 500 });
    }
    if (!displayName) {
      return jsonWithCors(request, { error: "Display name is required." }, { status: 400 });
    }

    if (payload.action === "join") {
      const record = await upsertAttendanceOnJoin({
        meetingId,
        userId,
        name: displayName,
        email: session?.email,
        room,
        timestamp,
      });
      return jsonWithCors(request, { action: payload.action, id: record?.id || null, success: true });
    }

    if (payload.action === "leave") {
      const record = await finalizeAttendanceOnLeave({
        meetingId,
        userId,
        email: session?.email,
        room,
        timestamp,
      });
      return jsonWithCors(request, { action: payload.action, id: record?.id || null, success: true });
    }

    if (payload.action === "screen-share-start") {
      return jsonWithCors(request, { action: payload.action, success: true });
    }

    return jsonWithCors(request, { action: payload.action, success: true });
  } catch (error) {
    const response = apiErrorResponse(error);
    const headers = buildCorsHeaders(request);
    Object.entries(headers).forEach(([key, value]) => { response.headers.set(key, value); });
    return response;
  }
}