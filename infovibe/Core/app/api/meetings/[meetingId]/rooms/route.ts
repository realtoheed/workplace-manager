import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ meetingId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireApiUser(request);
    const { meetingId } = await context.params;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        breakoutRooms: {
          where: { isActive: true },
        },
      },
    });

    if (!meeting) {
      throw new Error("Meeting not found");
    }

    const rooms = [
      {
        roomId: meeting.roomName,
        roomName: meeting.title,
        occupants: [],
      },
      ...meeting.breakoutRooms.map((room) => ({
        roomId: room.id,
        roomName: room.name,
        occupants: [] as { userId: string; name: string; email: string; joinedAt: string }[],
      })),
    ];

    return NextResponse.json({ rooms });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
