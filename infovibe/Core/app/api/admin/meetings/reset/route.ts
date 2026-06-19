import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { deleteAllMeetingsAndCreateFresh } from "@/lib/meetings";
import { updateMeetingBreakoutConfigSchema } from "@/lib/validations";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["super_admin", "team_lead"]);
    const payload = updateMeetingBreakoutConfigSchema.parse(await request.json());
    const freshMeeting = await deleteAllMeetingsAndCreateFresh(session.id, payload);

    return NextResponse.json({
      success: true,
      message: "MIU Internal meeting recreated successfully.",
      meeting: {
        id: String(freshMeeting._id),
        meetingId: freshMeeting.meetingId,
        meetingName: freshMeeting.meetingName,
        breakoutRooms: Array.isArray(freshMeeting.breakoutRooms) ? freshMeeting.breakoutRooms : [],
        breakoutRoomNames: Array.isArray(freshMeeting.breakoutRoomNames) ? freshMeeting.breakoutRoomNames : [],
        createdAt: new Date(freshMeeting.createdAt).toISOString(),
        isPermanent: true
      }
    });

  } catch (error) {
    return apiErrorResponse(error);
  }
}
