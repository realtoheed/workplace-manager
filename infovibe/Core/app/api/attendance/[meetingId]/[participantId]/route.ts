import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ meetingId: string; participantId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireApiUser(request, ["super_admin", "team_lead", "hr"]);
    const { meetingId, participantId } = await context.params;

    const participants = await prisma.meetingParticipant.findMany({
      where: { meetingId, userId: participantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: "desc" },
    });

    const totalDurationSeconds = participants.reduce(
      (sum, p) => sum + p.durationSeconds,
      0
    );

    const records = participants.map((p) => ({
      id: p.id,
      name: p.user?.name || "",
      email: p.user?.email || "",
      meetingId,
      joinedAt: p.joinedAt?.toISOString() || null,
      leftAt: p.leftAt?.toISOString() || null,
      durationSeconds: p.durationSeconds,
    }));

    return NextResponse.json({
      meetingId,
      participantId,
      totalDuration: totalDurationSeconds,
      records,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}