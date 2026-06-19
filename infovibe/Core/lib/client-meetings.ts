import { randomBytes } from "crypto";
import type { ClientMeetingView } from "@/lib/types";
import ClientMeetingModel from "@/models/ClientMeeting";
import { buildClientMeetingJoinPageUrl } from "@/utils/format";

export const CLIENT_MEETING_LIFETIME_MS = 4 * 60 * 60 * 1000;

type ClientMeetingPublicRecord = {
  _id: unknown;
  meetingName?: string;
  clientName?: string;
  clientEmail?: string;
  clientToken?: string;
  createdBy?: unknown;
  roomId?: string;
  startsAt?: Date | string | null;
  expiresAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export type ClientMeetingPublicState =
  | {
      status: "missing";
      meeting: null;
    }
  | {
      status: "expired";
      meeting: null;
    }
  | {
      status: "active";
      meeting: ClientMeetingPublicRecord;
    };

export function buildClientMeetingExpiresAt(from = new Date()) {
  return new Date(from.getTime() + CLIENT_MEETING_LIFETIME_MS);
}

export function generateClientMeetingToken() {
  return randomBytes(24).toString("hex");
}

function slugifySegment(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export function buildClientMeetingRoomId(meetingName: string) {
  const base = slugifySegment(meetingName) || "client-meeting";
  const suffix = randomBytes(4).toString("hex");
  return `client-${base}-${suffix}`.slice(0, 90).replace(/-+$/g, "");
}

function toIsoDateString(value: Date | string | number | null | undefined, fallback: Date | string | number = Date.now()) {
  const parsed = value ? new Date(value) : new Date(fallback);

  if (Number.isFinite(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date(fallback).toISOString();
}

export function serializeClientMeeting(meeting: any): ClientMeetingView {
  const createdAt = toIsoDateString(meeting.createdAt);
  const startsAt = toIsoDateString(meeting.startsAt || meeting.createdAt, meeting.createdAt || Date.now());
  const endsAt = toIsoDateString(meeting.expiresAt, meeting.startsAt || meeting.createdAt || Date.now());

  return {
    id: String(meeting._id),
    meetingName: String(meeting.meetingName || ""),
    clientName: String(meeting.clientName || ""),
    clientEmail: String(meeting.clientEmail || ""),
    roomId: String(meeting.roomId || ""),
    joinUrl: buildClientMeetingJoinPageUrl(String(meeting.clientToken || "")),
    createdAt,
    startsAt,
    endsAt,
    expiresAt: endsAt,
    createdByName: meeting.createdBy?.name ? String(meeting.createdBy.name) : undefined
  };
}

export async function listClientMeetings() {
  const meetings = await ClientMeetingModel.find({
    expiresAt: { $gt: new Date() }
  })
    .populate({ path: "createdBy", model: "User", select: "name" })
    .sort({ createdAt: -1 })
    .lean();

  return meetings.map((meeting: any) => serializeClientMeeting(meeting));
}

export async function getClientMeetingPublicState(token: string): Promise<ClientMeetingPublicState> {
  const meeting = (await ClientMeetingModel.findOne({
    clientToken: token
  }).lean()) as ClientMeetingPublicRecord | null;

  if (!meeting) {
    return {
      status: "missing" as const,
      meeting: null
    };
  }

  if (!meeting.expiresAt || new Date(meeting.expiresAt).getTime() <= Date.now()) {
    await ClientMeetingModel.deleteOne({ _id: meeting._id }).catch(() => undefined);

    return {
      status: "expired" as const,
      meeting: null
    };
  }

  return {
    status: "active" as const,
    meeting
  };
}
