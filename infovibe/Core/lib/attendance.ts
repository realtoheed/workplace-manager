import { prisma } from "@/lib/prisma";

const STALE_OPEN_SESSION_MS = 18 * 60 * 60 * 1000;
const ROOM_SWITCH_GRACE_MS = 45 * 1000;

export type AttendanceJoinParams = {
  meetingId: string;
  userId: string;
  name?: string;
  email?: string;
  room?: string;
  timestamp?: Date;
};

export type AttendanceLeaveParams = {
  meetingId: string;
  userId: string;
  email?: string;
  room?: string;
  timestamp?: Date;
};

export async function upsertAttendanceOnJoin(params: AttendanceJoinParams) {
  const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { role: true } });
  if (!user || user.role === "super_admin") return null;

  const joinedAt = params.timestamp || new Date();
  const todayStart = new Date(joinedAt.getFullYear(), joinedAt.getMonth(), joinedAt.getDate());

  const existingRecord = await prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId: params.userId, date: todayStart } },
  });

  if (existingRecord) {
    const totalWorkSoFar = existingRecord.totalWorkMinutes;
    const hasRecentLeave = existingRecord.lastLeaveAt !== null;
    const isStale = existingRecord.lastLeaveAt
      ? joinedAt.getTime() - existingRecord.lastLeaveAt.getTime() > STALE_OPEN_SESSION_MS
      : false;

    let breakMinutes = existingRecord.breakMinutes;
    let lateMinutes = existingRecord.lateMinutes;

    if (hasRecentLeave && !isStale && existingRecord.lastLeaveAt) {
      const gapMinutes = Math.round(
        (joinedAt.getTime() - existingRecord.lastLeaveAt.getTime()) / 60000
      );
      if (gapMinutes > 15) {
        breakMinutes += gapMinutes;
      } else {
        breakMinutes += gapMinutes;
      }
    }

    return prisma.attendanceRecord.update({
      where: { id: existingRecord.id },
      data: {
        lastLeaveAt: null,
        totalWorkMinutes: totalWorkSoFar,
        breakMinutes,
        lateMinutes,
        status: "present",
      },
    });
  }

  return prisma.attendanceRecord.create({
    data: {
      userId: params.userId,
      date: todayStart,
      firstJoinAt: joinedAt,
      lastLeaveAt: null,
      totalWorkMinutes: 0,
      breakMinutes: 0,
      screenshareMinutes: 0,
      lateMinutes: 0,
      status: "present",
    },
  });
}

export async function finalizeAttendanceOnLeave(params: AttendanceLeaveParams) {
  const user = await prisma.user.findUnique({ where: { id: params.userId }, select: { role: true } });
  if (!user || user.role === "super_admin") return null;

  const leftAt = params.timestamp || new Date();
  const todayStart = new Date(leftAt.getFullYear(), leftAt.getMonth(), leftAt.getDate());

  const existingRecord = await prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId: params.userId, date: todayStart } },
  });

  if (!existingRecord) {
    return prisma.attendanceRecord.create({
      data: {
        userId: params.userId,
        date: todayStart,
        firstJoinAt: leftAt,
        lastLeaveAt: leftAt,
        totalWorkMinutes: 0,
        breakMinutes: 0,
        screenshareMinutes: 0,
        lateMinutes: 0,
        status: "present",
      },
    });
  }

  const joinedAt = existingRecord.firstJoinAt || leftAt;
  const totalSessionMinutes = Math.round((leftAt.getTime() - joinedAt.getTime()) / 60000);
  const previousWork = existingRecord.totalWorkMinutes || 0;
  const newWork = previousWork + totalSessionMinutes;

  let breakMinutes = existingRecord.breakMinutes || 0;

  return prisma.attendanceRecord.update({
    where: { id: existingRecord.id },
    data: {
      lastLeaveAt: leftAt,
      totalWorkMinutes: newWork,
      breakMinutes,
      status: "present",
    },
  });
}

export async function markAbsentUsersToday() {
  const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const activeUsers = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const existingRecords = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: todayStart, lt: todayEnd },
    },
    select: { userId: true },
  });

  const presentUserIds = new Set(existingRecords.map((r) => r.userId));
  const absentUsers = activeUsers.filter((u) => !presentUserIds.has(u.id));

  if (absentUsers.length === 0) return [];

  await prisma.attendanceRecord.createMany({
    data: absentUsers.map((u) => ({
      userId: u.id,
      date: todayStart,
      status: "absent",
      totalWorkMinutes: 0,
      breakMinutes: 0,
      screenshareMinutes: 0,
      lateMinutes: 0,
    })),
    skipDuplicates: true,
  });

  return absentUsers;
}

export function normalizeMeetWebhookEvent(payload: any) {
  const eventName = String(
    payload?.event_name || payload?.event || payload?.eventName || payload?.type || payload?.topic || payload?.name || ""
  ).trim();

  const data = payload?.data || payload;
  const occupant = data?.occupant || data?.participant || {};

  const meetingId =
    data?.meetingId || data?.room || data?.room_name || data?.roomName ||
    data?.conference?.name || data?.conference_name || "";

  const participantId =
    data?.participantId || data?.id || occupant?.id || occupant?.occupant_jid ||
    data?.occupant_jid || data?.participant?.id || data?.participant_id || "";

  const displayName =
    data?.name || data?.displayName || occupant?.name || occupant?.displayName ||
    data?.participant?.name || data?.participant?.displayName || "";

  const email = data?.email || occupant?.email || data?.participant?.email || "";
  const room =
    data?.breakoutRoom || data?.breakout_room_id || data?.room || data?.room_name ||
    data?.roomName || data?.conference?.name || data?.conference_name || meetingId;

  const timestampRaw = occupant?.joined_at || occupant?.left_at || data?.timestamp || payload?.timestamp || null;
  let timestamp = new Date();

  if (timestampRaw !== null && timestampRaw !== undefined && timestampRaw !== "") {
    if (typeof timestampRaw === "number") {
      timestamp = new Date(timestampRaw < 1000000000000 ? timestampRaw * 1000 : timestampRaw);
    } else if (typeof timestampRaw === "string" && /^\d+$/.test(timestampRaw)) {
      const numericValue = Number(timestampRaw);
      timestamp = new Date(numericValue < 1000000000000 ? numericValue * 1000 : numericValue);
    } else {
      timestamp = new Date(timestampRaw);
    }
  }

  return {
    eventName,
    meetingId: String(meetingId || "").trim(),
    participantId: String(participantId || "").trim(),
    name: String(displayName || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    room: String(room || "").trim(),
    timestamp,
  };
}

export function isJoinEvent(eventName: string) {
  const normalized = eventName.toLowerCase();
  return (
    normalized.includes("muc-occupant-joined") ||
    normalized.includes("participantjoined") ||
    normalized.includes("participant.joined") ||
    normalized.includes("participant-joined") ||
    normalized.includes("participant_joined") ||
    normalized.includes("videoconferencejoined")
  );
}

export function isLeaveEvent(eventName: string) {
  const normalized = eventName.toLowerCase();
  return (
    normalized.includes("muc-occupant-left") ||
    normalized.includes("participantleft") ||
    normalized.includes("participant.left") ||
    normalized.includes("participant-left") ||
    normalized.includes("participant_left") ||
    normalized.includes("videoconferenceleft")
  );
}