import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ meetingId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireApiUser(request, ["super_admin", "team_lead", "hr"]);
    const { meetingId } = await context.params;

    const participants = await prisma.meetingParticipant.findMany({
      where: { meetingId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { joinedAt: "desc" },
    });

    const records = participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user?.name || "",
      email: p.user?.email || "",
      meetingId,
      joinedAt: p.joinedAt?.toISOString() || null,
      leftAt: p.leftAt?.toISOString() || null,
      durationSeconds: p.durationSeconds,
      screenshareSeconds: p.screenshareSeconds,
    }));

    return NextResponse.json({ meetingId, records });
  } catch (error) {
    return apiErrorResponse(error);
  }
}