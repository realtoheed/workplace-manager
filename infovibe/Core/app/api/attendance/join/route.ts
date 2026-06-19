import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { upsertAttendanceOnJoin } from "@/lib/attendance";

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    const body = await request.json();
    const meetingId = String(body.meetingId || "");
    const room = String(body.room || body.roomId || meetingId || "").trim();

    if (!meetingId) {
      throw new Error("Invalid request payload.");
    }

    const record = await upsertAttendanceOnJoin({
      meetingId,
      userId: session.id,
      name: session.name,
      email: session.email,
      room,
      timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
    });

    if (!record) {
      return NextResponse.json({ attendance: null, skipped: true });
    }

    return NextResponse.json({
      attendance: {
        id: record.id,
        userId: record.userId,
        date: record.date.toISOString(),
        status: record.status,
        firstJoinAt: record.firstJoinAt?.toISOString() || null,
        totalWorkMinutes: record.totalWorkMinutes,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}