import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const session = await requireApiUser(request);
    const { meetingId } = await params;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new Error("NotFound");
    }

    const participant = await prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId: meetingId, userId: session.id } },
    });

    if (!participant) {
      throw new Error("NotFound");
    }

    const now = new Date();
    let durationSeconds = 0;
    if (participant.joinedAt) {
      durationSeconds = Math.floor((now.getTime() - participant.joinedAt.getTime()) / 1000);
    }

    await prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: {
        leftAt: now,
        durationSeconds,
      },
    });

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const attendance = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId: session.id, date: todayStart } },
    });

    if (attendance) {
      const workDelta = Math.floor(durationSeconds / 60);
      await prisma.attendanceRecord.update({
        where: { id: attendance.id },
        data: {
          lastLeaveAt: now,
          totalWorkMinutes: { increment: workDelta },
          status: "present",
        },
      });
    } else {
      await prisma.attendanceRecord.create({
        data: {
          userId: session.id,
          date: todayStart,
          firstJoinAt: participant.joinedAt || now,
          lastLeaveAt: now,
          totalWorkMinutes: Math.floor(durationSeconds / 60),
          status: "present",
        },
      });
    }

    return NextResponse.json({ success: true, durationSeconds });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
