export type UserRole = "employee" | "team_lead" | "hr" | "super_admin";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profileImageUrl?: string;
  defaultRoomId?: string | null;
};

export type MeetingView = {
  id: string;
  title: string;
  meetingName: string;
  meetingId: string;
  roomName: string;
  type: string;
  isActive: boolean;
  isPermanent?: boolean;
  breakoutRooms: string[];
  breakoutRoomNames: string[];
  createdByName?: string;
  createdAt: string;
  participantCount?: number;
};

export type MeetRecordingView = {
  id: string;
  meetingId: string;
  title: string;
  createdAt: string;
  url: string;
  hostName: string;
  durationLabel: string;
};

export type ClientMeetingView = {
  id: string;
  meetingName: string;
  clientName?: string;
  clientEmail?: string;
  roomId: string;
  joinUrl: string;
  createdAt: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  createdByName?: string;
};