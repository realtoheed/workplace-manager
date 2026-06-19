import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PERSISTENT_ROOM = "company-office";

export async function GET(_request: NextRequest) {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { roomName: PERSISTENT_ROOM },
      include: {
        _count: { select: { participants: true } },
        breakoutRooms: { select: { id: true, name: true, isActive: true } },
      },
    });

    if (!meeting) {
      return NextResponse.json({ meeting: null });
    }

    return NextResponse.json({
      meeting: {
        id: meeting.id,
        title: meeting.title,
        roomName: meeting.roomName,
        type: meeting.type,
        isActive: meeting.isActive,
        participantCount: meeting._count.participants,
        breakoutRooms: meeting.breakoutRooms.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive })),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["hr", "super_admin"]);
    void session;
    const body = await request.json();
    const { title, breakoutRoomNames } = body;

    const existing = await prisma.meeting.findUnique({
      where: { roomName: PERSISTENT_ROOM },
      include: { breakoutRooms: true },
    });

    if (existing) {
      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;

      const meeting = await prisma.meeting.update({
        where: { roomName: PERSISTENT_ROOM },
        data: updateData,
      });

      if (Array.isArray(breakoutRoomNames)) {
        await prisma.breakoutRoom.deleteMany({ where: { meetingId: meeting.id } });
        for (const name of breakoutRoomNames) {
          await prisma.breakoutRoom.create({
            data: { meetingId: meeting.id, name, isActive: true },
          });
        }
      }

      const updated = await prisma.meeting.findUnique({
        where: { roomName: PERSISTENT_ROOM },
        include: {
          _count: { select: { participants: true } },
          breakoutRooms: { select: { id: true, name: true, isActive: true } },
        },
      });
      return NextResponse.json({ meeting: updated });
    }

    const meeting = await prisma.meeting.create({
      data: {
        title: title || "Company Office",
        type: "persistent",
        roomName: PERSISTENT_ROOM,
        isActive: true,
        status: "active",
      },
    });

    if (Array.isArray(breakoutRoomNames)) {
      for (const name of breakoutRoomNames) {
        await prisma.breakoutRoom.create({
          data: { meetingId: meeting.id, name, isActive: true },
        });
      }
    }

    const created = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: {
        _count: { select: { participants: true } },
        breakoutRooms: { select: { id: true, name: true, isActive: true } },
      },
    });
    return NextResponse.json({ meeting: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
