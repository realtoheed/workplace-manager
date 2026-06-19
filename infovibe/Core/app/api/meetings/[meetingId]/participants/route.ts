import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const session = await requireApiUser(request);
    void session;
    const { meetingId } = await params;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new Error("NotFound");
    }

    const participants = await prisma.meetingParticipant.findMany({
      where: { meetingId: meetingId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { joinedAt: "asc" },
    });

    const mapped = participants.map((p) => ({
      id: p.id,
      user: p.user,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
      durationSeconds: p.durationSeconds,
    }));
    return NextResponse.json({ participants: mapped });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
