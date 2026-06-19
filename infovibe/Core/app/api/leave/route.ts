import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request);

    let where: Record<string, unknown> = {};

    if (session.role === "employee") {
      where.userId = session.id;
    } else if (session.role === "team_lead") {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { departmentId: true },
      });
      if (user?.departmentId) {
        const deptUsers = await prisma.user.findMany({
          where: { departmentId: user.departmentId },
          select: { id: true },
        });
        where.userId = { in: deptUsers.map((u) => u.id) };
      } else {
        where.userId = session.id;
      }
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, departmentId: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ leaves });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["employee", "team_lead", "hr", "super_admin"]);

    if (session.role === "hr" || session.role === "super_admin") {
      throw new Error("Forbidden");
    }

    const body = await request.json();
    const { leaveType, startDate, endDate, reason } = body;

    if (!leaveType || !startDate || !endDate || !reason) {
      throw new Error("leaveType, startDate, endDate, and reason are required.");
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: session.id,
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ leave }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
