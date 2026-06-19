import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type BadgeProgress = {
  badge: string;
  currentProgress: number;
  requiredProgress: number;
  description: string;
  earned: boolean;
  earnedAt?: string;
};

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request);

    const badgeProgress: BadgeProgress[] = [];

    const attendanceCount = await prisma.attendanceRecord.count({
      where: { userId: session.id, status: "present" },
    });

    const requirements = {
      description: "Show up consistently to meetings",
      minThreshold: 5,
      requiredPercentage: 50,
    };

    const pct = Math.min(100, Math.round((attendanceCount / Math.max(requirements.minThreshold, 1)) * 100));
    const meetsThreshold = attendanceCount >= requirements.minThreshold;
    const meetsPercentage = pct >= requirements.requiredPercentage;

    badgeProgress.push({
      badge: "attendance",
      currentProgress: pct,
      requiredProgress: requirements.requiredPercentage,
      description: `${requirements.description} (${requirements.minThreshold}+ days, ${requirements.requiredPercentage}%+ attendance)`,
      earned: meetsThreshold && meetsPercentage,
    });

    return NextResponse.json({
      badges: badgeProgress,
      earnedBadges: badgeProgress.filter((b) => b.earned).map((b) => b.badge),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}