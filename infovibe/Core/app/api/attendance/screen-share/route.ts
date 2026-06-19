import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const screenShareEventSchema = z.object({
  action: z.enum(["start", "stop"]),
  meetingId: z.string().trim().optional().default(""),
  room: z.string().trim().optional().default(""),
  timestamp: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    const payload = screenShareEventSchema.parse(await request.json());
    const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

    const meetingId = payload.meetingId.trim();
    const room = (payload.room || meetingId).trim();

    if (payload.action === "start") {
      if (!meetingId) {
        throw new Error("Invalid request payload.");
      }

      const participant = await prisma.meetingParticipant.findFirst({
        where: {
          userId: session.id,
          meetingId,
          leftAt: null,
        },
        orderBy: { joinedAt: "desc" },
      });

      if (participant) {
        await prisma.meetingParticipant.update({
          where: { id: participant.id },
          data: { screenshareSeconds: { increment: 0 } },
        });
      }

      return NextResponse.json({ success: true, action: "start" });
    }

    return NextResponse.json({ success: true, action: "stop" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}