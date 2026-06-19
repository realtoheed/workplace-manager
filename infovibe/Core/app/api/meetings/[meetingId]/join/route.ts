import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMeetBaseUrl, buildMeetRoomId } from "@/lib/meet";

export async function POST(request: NextRequest, { params }: { params: Promise<{ meetingId: string }> }) {
  try {
    const session = await requireApiUser(request);
    const { meetingId } = await params;

    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new Error("NotFound");
    }

    const existingParticipant = await prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId: meetingId, userId: session.id } },
    });

    if (!existingParticipant) {
      await prisma.meetingParticipant.create({
        data: {
          meetingId: meetingId,
          userId: session.id,
          joinedAt: new Date(),
        },
      });
    } else if (!existingParticipant.joinedAt) {
      await prisma.meetingParticipant.update({
        where: { id: existingParticipant.id },
        data: { joinedAt: new Date() },
      });
    }

    const meetBaseUrl = getMeetBaseUrl();
    const physicalRoomId = buildMeetRoomId(meeting.roomName);
    const tokenUrl = `${meetBaseUrl}/api/token?room=${physicalRoomId}&userId=${session.id}&name=${encodeURIComponent(session.name)}`;

    return NextResponse.json({
      roomName: meeting.roomName,
      tokenUrl,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        roomName: meeting.roomName,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
