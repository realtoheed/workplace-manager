import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["hr", "super_admin", "team_lead"]);
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get("userId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!userId) {
      throw new Error("userId is required");
    }

    if (session.role === "team_lead") {
      const department = await prisma.department.findFirst({
        where: { headId: session.id },
      });
      if (department) {
        const member = await prisma.user.findFirst({
          where: { id: userId, departmentId: department.id },
        });
        if (!member) {
          throw new Error("Forbidden");
        }
      }
    }

    const where: Record<string, unknown> = { userId };
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.date = dateFilter;
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { date: "desc" },
    });

    const mapped = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user?.name || "",
      userEmail: r.user?.email || "",
      date: r.date.toISOString(),
      firstJoinAt: r.firstJoinAt?.toISOString() || null,
      lastLeaveAt: r.lastLeaveAt?.toISOString() || null,
      totalWorkMinutes: r.totalWorkMinutes,
      breakMinutes: r.breakMinutes,
      screenshareMinutes: r.screenshareMinutes,
      lateMinutes: r.lateMinutes,
      status: r.lastLeaveAt ? r.status : (r.firstJoinAt ? "active" : r.status),
    }));

    return NextResponse.json({ records: mapped });
  } catch (error) {
    return apiErrorResponse(error);
  }
}