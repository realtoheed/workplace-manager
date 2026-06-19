import { connectToDatabase } from "@/lib/db";
import ClientMeetingModel from "@/models/ClientMeeting";
import MeetingModel from "@/models/Meeting";
import UserModel from "@/models/User";

const GENERAL_MEETING_ID = "miu-internal";
const GENERAL_MEETING_NAME = "MIU Internal";
const GENERAL_BREAKOUT_COUNT = 50;

export type AttendanceMeetingType = "general" | "client" | "other";

type GeneralMeetingConfigInput = {
  breakoutCount?: number;
  breakoutRoomNames?: unknown;
};

type MeetingBreakoutConfigSource = {
  meetingId?: string;
  breakoutRoomCount?: unknown;
  breakoutRooms?: unknown;
  breakoutRoomNames?: unknown;
};

function normalizeGeneralBreakoutCount(value: unknown, fallback = GENERAL_BREAKOUT_COUNT) {
  const count = Number.parseInt(String(value ?? ""), 10);
  const parsedFallback = Number.parseInt(String(fallback ?? GENERAL_BREAKOUT_COUNT), 10);
  const normalizedFallback = Number.isFinite(parsedFallback)
    ? Math.min(GENERAL_BREAKOUT_COUNT, Math.max(0, parsedFallback))
    : GENERAL_BREAKOUT_COUNT;

  if (!Number.isFinite(count)) return normalizedFallback;
  return Math.min(GENERAL_BREAKOUT_COUNT, Math.max(0, count));
}

function resolveStoredGeneralBreakoutCount(meeting: MeetingBreakoutConfigSource) {
  const explicitBreakoutCount = Number.parseInt(String(meeting?.breakoutRoomCount ?? ""), 10);
  const storedBreakoutRooms = Array.isArray(meeting?.breakoutRooms)
    ? meeting.breakoutRooms.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const storedNames = Array.isArray(meeting?.breakoutRoomNames) ? meeting.breakoutRoomNames : [];

  if (Number.isFinite(explicitBreakoutCount)) return Math.min(GENERAL_BREAKOUT_COUNT, Math.max(0, explicitBreakoutCount));
  if (storedBreakoutRooms.length > 0) return normalizeGeneralBreakoutCount(storedBreakoutRooms.length);
  if (storedNames.length > 0) return normalizeGeneralBreakoutCount(storedNames.length);
  return GENERAL_BREAKOUT_COUNT;
}

function buildGeneralBreakoutRooms(count = GENERAL_BREAKOUT_COUNT) {
  const breakoutCount = normalizeGeneralBreakoutCount(count, GENERAL_BREAKOUT_COUNT);
  return Array.from({ length: breakoutCount }, (_, index) => `${GENERAL_MEETING_ID}-breakout-${index + 1}`);
}

function buildDefaultGeneralBreakoutRoomNames(count = GENERAL_BREAKOUT_COUNT) {
  const breakoutCount = normalizeGeneralBreakoutCount(count, GENERAL_BREAKOUT_COUNT);
  return Array.from({ length: breakoutCount }, (_, index) => `Breakout ${index + 1}`);
}

function isGeneralMeetingId(value: string) {
  return String(value || "").trim().toLowerCase() === GENERAL_MEETING_ID;
}

function buildGeneralMeetingBreakoutConfig(input: GeneralMeetingConfigInput = {}) {
  const breakoutCount = normalizeGeneralBreakoutCount(input.breakoutCount, GENERAL_BREAKOUT_COUNT);
  const breakoutRooms = buildGeneralBreakoutRooms(breakoutCount);
  const defaultNames = buildDefaultGeneralBreakoutRoomNames(breakoutCount);
  const configuredNames = Array.isArray(input.breakoutRoomNames) ? input.breakoutRoomNames : [];

  return {
    breakoutCount,
    breakoutRooms,
    breakoutRoomNames: breakoutRooms.map((_, index) => {
      const configuredName = String(configuredNames[index] || "").trim();
      return configuredName || defaultNames[index];
    })
  };
}

function resolveMeetingBreakoutConfig(meeting: MeetingBreakoutConfigSource) {
  const isGeneralMeeting = isGeneralMeetingId(String(meeting?.meetingId || ""));
  const storedNames = Array.isArray(meeting?.breakoutRoomNames) ? meeting.breakoutRoomNames : [];

  if (isGeneralMeeting) {
    return buildGeneralMeetingBreakoutConfig({
      breakoutCount: resolveStoredGeneralBreakoutCount(meeting),
      breakoutRoomNames: storedNames
    });
  }

  const breakoutRooms = Array.isArray(meeting?.breakoutRooms)
    ? meeting.breakoutRooms.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  return {
    breakoutRooms,
    breakoutRoomNames: breakoutRooms.map((_, index) => {
      const configuredName = String(storedNames[index] || "").trim();
      return configuredName || `Breakout ${index + 1}`;
    })
  };
}

function shouldCountAttendanceForRole(role: unknown, attendanceType?: string, meetingId?: string) {
  const normalizedAttendanceType = String(attendanceType || "").trim().toLowerCase();
  const normalizedMeetingId = String(meetingId || "").trim().toLowerCase();

  if (role === "employee") {
    return normalizedAttendanceType === "general" || (!normalizedAttendanceType && normalizedMeetingId === GENERAL_MEETING_ID);
  }

  if (role === "super_admin" || role === "hr" || role === "team_lead") {
    return (
      normalizedAttendanceType === "general" ||
      normalizedAttendanceType === "client" ||
      (!normalizedAttendanceType && normalizedMeetingId === GENERAL_MEETING_ID)
    );
  }

  return false;
}

async function resolveMeetingOwnerId(createdByUserId?: string) {
  if (createdByUserId) return createdByUserId;
  await connectToDatabase();
  const owner = (await UserModel.findOne({ role: "super_admin" }).sort({ createdAt: 1 }).select("_id").lean()) ||
    (await UserModel.findOne({}).sort({ createdAt: 1 }).select("_id").lean());
  if (!owner?._id) throw new Error("Unable to resolve a General meeting owner.");
  return String(owner._id);
}

async function ensureGeneralMeeting(createdByUserId?: string, input: GeneralMeetingConfigInput = {}) {
  await connectToDatabase();
  const existingMeeting = await MeetingModel.findOne({ meetingId: GENERAL_MEETING_ID });
  const existingConfig = existingMeeting
    ? buildGeneralMeetingBreakoutConfig({
        breakoutCount: resolveStoredGeneralBreakoutCount(existingMeeting),
        breakoutRoomNames: existingMeeting.breakoutRoomNames
      })
    : buildGeneralMeetingBreakoutConfig();
  const breakoutConfig = buildGeneralMeetingBreakoutConfig({
    breakoutCount: typeof input.breakoutCount === "number" ? input.breakoutCount : existingConfig.breakoutCount,
    breakoutRoomNames: Array.isArray(input.breakoutRoomNames) ? input.breakoutRoomNames : existingConfig.breakoutRoomNames
  });

  if (!existingMeeting) {
    const ownerId = await resolveMeetingOwnerId(createdByUserId);
    return MeetingModel.create({
      meetingName: GENERAL_MEETING_NAME,
      meetingId: GENERAL_MEETING_ID,
      breakoutRoomCount: breakoutConfig.breakoutCount,
      breakoutRooms: breakoutConfig.breakoutRooms,
      breakoutRoomNames: breakoutConfig.breakoutRoomNames,
      createdBy: ownerId
    });
  }

  let changed = false;
  if (String(existingMeeting.meetingName || "") !== GENERAL_MEETING_NAME) {
    existingMeeting.meetingName = GENERAL_MEETING_NAME;
    changed = true;
  }
  if (Number(existingMeeting.breakoutRoomCount) !== breakoutConfig.breakoutCount) {
    existingMeeting.breakoutRoomCount = breakoutConfig.breakoutCount;
    changed = true;
  }
  if (JSON.stringify(existingMeeting.breakoutRooms || []) !== JSON.stringify(breakoutConfig.breakoutRooms)) {
    existingMeeting.breakoutRooms = breakoutConfig.breakoutRooms;
    changed = true;
  }
  if (JSON.stringify(existingMeeting.breakoutRoomNames || []) !== JSON.stringify(breakoutConfig.breakoutRoomNames)) {
    existingMeeting.breakoutRoomNames = breakoutConfig.breakoutRoomNames;
    changed = true;
  }
  if (changed) await existingMeeting.save();

  return existingMeeting;
}

export async function deleteAllMeetingsAndCreateFresh(createdByUserId?: string, input: GeneralMeetingConfigInput = {}) {
  await connectToDatabase();
  const breakoutConfig = buildGeneralMeetingBreakoutConfig({
    breakoutCount: input.breakoutCount,
    breakoutRoomNames: input.breakoutRoomNames
  });

  await MeetingModel.deleteMany({ meetingId: GENERAL_MEETING_ID });

  const ownerId = await resolveMeetingOwnerId(createdByUserId);
  return MeetingModel.create({
    meetingName: GENERAL_MEETING_NAME,
    meetingId: GENERAL_MEETING_ID,
    breakoutRoomCount: breakoutConfig.breakoutCount,
    breakoutRooms: breakoutConfig.breakoutRooms,
    breakoutRoomNames: breakoutConfig.breakoutRoomNames,
    createdBy: ownerId
  });
}

async function resolveAttendanceMeetingType(meetingId: string): Promise<AttendanceMeetingType> {
  const normalizedMeetingId = String(meetingId || "").trim().toLowerCase();
  if (!normalizedMeetingId) return "other";
  if (normalizedMeetingId === GENERAL_MEETING_ID) return "general";

  await connectToDatabase();
  const clientMeeting = await ClientMeetingModel.findOne({ roomId: normalizedMeetingId }).select("_id").lean();
  if (clientMeeting) return "client";

  const internalMeeting = await MeetingModel.findOne({ meetingId: normalizedMeetingId }).select("meetingId").lean() as { meetingId?: string } | null;
  if (internalMeeting?.meetingId && isGeneralMeetingId(String(internalMeeting.meetingId))) return "general";

  return "other";
}
