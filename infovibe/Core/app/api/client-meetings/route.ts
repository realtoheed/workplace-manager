import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import {
  buildClientMeetingExpiresAt,
  buildClientMeetingRoomId,
  generateClientMeetingToken,
  listClientMeetings,
  serializeClientMeeting
} from "@/lib/client-meetings";
import ClientMeetingModel from "@/models/ClientMeeting";
import { createClientMeetingSchema } from "@/lib/validations";

async function getUniqueClientMeetingIdentifiers(ClientMeeting: any, meetingName: string, clientName: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const roomId = buildClientMeetingRoomId(meetingName);
    const clientToken = generateClientMeetingToken();
    const existingMeeting = await ClientMeetingModel.findOne({
      $or: [{ roomId }, { clientToken }]
    })
      .select("_id")
      .lean();

    if (!existingMeeting) {
      return { roomId, clientToken };
    }
  }

  throw new Error("Unable to generate a unique client meeting link.");
}

function resolveClientMeetingSchedule(payload: { startsAt?: string; endsAt?: string }) {
  const startsAt = payload.startsAt ? new Date(payload.startsAt) : new Date();
  const endsAt = payload.endsAt ? new Date(payload.endsAt) : buildClientMeetingExpiresAt(startsAt);

  return {
    endsAt,
    startsAt
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["super_admin"]);
    const meetings = await listClientMeetings();
    return NextResponse.json({ meetings });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["super_admin"]);
    const payload = createClientMeetingSchema.parse(await request.json());
    const { startsAt, endsAt } = resolveClientMeetingSchedule(payload);

    if (endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    }

    const { roomId, clientToken } = await getUniqueClientMeetingIdentifiers(ClientMeetingModel, payload.projectName, "");
    const meeting = await ClientMeetingModel.create({
      meetingName: payload.projectName,
      clientName: "",
      clientEmail: "",
      roomId,
      clientToken,
      createdBy: session.id,
      startsAt,
      expiresAt: endsAt
    });

    return NextResponse.json(
      {
        meeting: serializeClientMeeting({
          ...meeting.toObject(),
          createdBy: {
            name: session.name
          }
        })
      },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
