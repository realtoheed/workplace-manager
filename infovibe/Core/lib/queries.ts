import { prisma } from "@/lib/prisma";
import type { MeetingView, MeetRecordingView, SessionUser } from "@/lib/types";

function serializeMeeting(meeting: {
  id: string;
  title: string;
  roomName: string;
  type: string;
  isActive: boolean;
  createdAt: Date;
  host?: { id: string; name: string } | null;
  breakoutRooms?: { id: string; name: string; isActive: boolean }[];
  _count?: { participants: number };
}): MeetingView {
  const rooms = meeting.breakoutRooms || [];
  return {
    id: meeting.id,
    title: meeting.title || "Meeting",
    meetingName: meeting.title,
    meetingId: meeting.roomName,
    roomName: meeting.roomName,
    type: meeting.type === "persistent" ? "persistent" : "temporary",
    isActive: meeting.isActive,
    breakoutRooms: rooms.map((r) => r.id),
    breakoutRoomNames: rooms.map((r) => r.name),
    createdAt: new Date(meeting.createdAt).toISOString(),
    createdByName: meeting.host?.name,
    isPermanent: meeting.type === "persistent",
    participantCount: meeting._count?.participants ?? 0,
  };
}

export async function listMeetings() {
  const meetings = await prisma.meeting.findMany({
    where: { type: "persistent", isActive: true },
    include: {
      host: { select: { id: true, name: true } },
      breakoutRooms: { select: { id: true, name: true, isActive: true } },
      _count: { select: { participants: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return meetings.map(serializeMeeting);
}

export async function listMeetRecordingsForUser(_user: Pick<SessionUser, "id">) {
  return [] as MeetRecordingView[];
}