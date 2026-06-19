import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = { userId: session.id };
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.date = dateFilter;
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: "desc" },
    });

    const mapped = records.map((r) => ({
      id: r.id,
      userId: r.userId,
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