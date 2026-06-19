import type { MeetingView } from "@/lib/types";

export type MeetRoomBinding = {
  logicalRoomId: string;
  physicalRoomId: string;
  roomName: string;
  isMainRoom?: boolean;
};

function normalizeMeetSegment(value: string, fallback: string) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function compactSegment(value: string, head: number, tail: number) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}-${value.slice(-tail)}`;
}

export function getMeetBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_MEET_BASE_URL || process.env.NEXT_PUBLIC_JITSI_BASE_URL;
  if (envUrl && envUrl.trim()) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:3100`;
  }
  return "http://localhost:3100";
}

export function buildMeetScopedId(value: string, prefix = "tm") {
  const valueSegment = compactSegment(normalizeMeetSegment(value, "room"), 10, 10);
  return `${prefix}-${valueSegment}`.slice(0, 40).replace(/-+$/g, "");
}

export function buildMeetRoomId(value: string) {
  return buildMeetScopedId(value, "tm").slice(0, 32).replace(/-+$/g, "");
}

export function buildMeetParticipantId(userId: string) {
  return buildMeetScopedId(userId, "pt");
}

export function buildMeetProfileId(userId: string) {
  return buildMeetScopedId(userId, "pf");
}

export function buildClientGuestEmail(token: string, participantId: string) {
  const tokenSegment = compactSegment(normalizeMeetSegment(token, "guest"), 6, 6);
  const participantSegment = compactSegment(normalizeMeetSegment(participantId, "guest"), 4, 8);
  return `${tokenSegment}-${participantSegment}@client.local`;
}

export function buildMeetingRoomBindings(meeting: Pick<MeetingView, "meetingId" | "meetingName" | "breakoutRooms" | "breakoutRoomNames">): MeetRoomBinding[] {
  const physicalMeetingId = buildMeetRoomId(meeting.meetingId);

  return [
    {
      logicalRoomId: meeting.meetingId,
      physicalRoomId: physicalMeetingId,
      roomName: meeting.meetingName,
      isMainRoom: true
    },
    ...meeting.breakoutRooms.map((roomId, index) => ({
      logicalRoomId: roomId,
      physicalRoomId: `${physicalMeetingId}-room-${index + 1}`,
      roomName: meeting.breakoutRoomNames[index] || `Breakout ${index + 1}`
    }))
  ];
}

export function buildClientMeetingRoomBindings(roomId: string, meetingName: string): MeetRoomBinding[] {
  return [
    {
      logicalRoomId: roomId,
      physicalRoomId: buildMeetRoomId(roomId),
      roomName: meetingName,
      isMainRoom: true
    }
  ];
}

export function findMeetRoomBinding(bindings: MeetRoomBinding[], logicalRoomId: string) {
  return bindings.find((binding) => binding.logicalRoomId === logicalRoomId) || bindings[0] || null;
}

export function findMeetRoomBindingByPhysicalRoomId(bindings: MeetRoomBinding[], physicalRoomId: string) {
  return bindings.find((binding) => binding.physicalRoomId === physicalRoomId) || bindings[0] || null;
}

export function buildMeetEmbedUrl(params: {
  autoJoin?: boolean;
  breakoutRoomCount?: number;
  clientActivityUrl?: string;
  clientMeetingJoinUrl?: string;
  clientMeetingHostProfileId?: string;
  clientMeetingRole?: string;
  clientMeetingToken?: string;
  closeOnLeave?: boolean;
  desktopShell?: boolean;
  disableEndMeeting?: boolean;
  displayName: string;
  embed?: boolean;
  meetBaseUrl?: string;
  meetingId: string;
  meetingStartsAt?: string;
  meetingTitle?: string;
  meetingType?: string;
  parentOrigin?: string;
  participantId?: string;
  profileId?: string;
  roomId?: string;
  rooms?: MeetRoomBinding[];
}) {
  const baseUrl = String(params.meetBaseUrl || getMeetBaseUrl()).replace(/\/$/, "");
  const url = new URL(`/meeting/${encodeURIComponent(params.meetingId)}`, `${baseUrl}/`);

  if (params.roomId && params.roomId !== params.meetingId) {
    url.searchParams.set("room", params.roomId);
  }
  if (params.displayName) url.searchParams.set("name", params.displayName);
  if (params.participantId) url.searchParams.set("participantId", params.participantId);
  if (params.profileId) url.searchParams.set("profileId", params.profileId);
  if (params.meetingTitle) url.searchParams.set("meetingTitle", params.meetingTitle);
  if (params.meetingType) url.searchParams.set("meetingType", params.meetingType);
  if (params.meetingStartsAt) url.searchParams.set("meetingStartsAt", params.meetingStartsAt);
  if (typeof params.breakoutRoomCount === "number") url.searchParams.set("breakoutCount", String(params.breakoutRoomCount));
  if (params.rooms?.length) {
    url.searchParams.set("rooms", JSON.stringify(params.rooms.map((room) => ({
      id: room.physicalRoomId,
      label: room.roomName,
      isMainRoom: Boolean(room.isMainRoom)
    }))));
  }
  if (params.clientActivityUrl) url.searchParams.set("clientActivityUrl", params.clientActivityUrl);
  if (params.clientMeetingJoinUrl) url.searchParams.set("clientMeetingJoinUrl", params.clientMeetingJoinUrl);
  if (params.clientMeetingToken) url.searchParams.set("clientMeetingToken", params.clientMeetingToken);
  if (params.clientMeetingRole) url.searchParams.set("clientMeetingRole", params.clientMeetingRole);
  if (params.clientMeetingHostProfileId) url.searchParams.set("clientMeetingHostProfileId", params.clientMeetingHostProfileId);
  if (params.closeOnLeave) url.searchParams.set("closeOnLeave", "1");
  if (params.disableEndMeeting) url.searchParams.set("disableEndMeeting", "1");
  if (params.parentOrigin) url.searchParams.set("parentOrigin", params.parentOrigin);
  if (params.desktopShell) url.searchParams.set("desktopShell", "1");
  if (params.embed) url.searchParams.set("embed", "1");
  if (params.autoJoin) url.searchParams.set("autoJoin", "1");

  return url.toString();
}
