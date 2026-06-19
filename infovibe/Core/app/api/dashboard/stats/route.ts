import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    if (session.role === "employee") {
      const [myAttendance, pendingLeaves, upcomingMeetings, tasksCount] = await Promise.all([
        prisma.attendanceRecord.findFirst({
          where: { userId: session.id, date: { gte: todayStart, lt: todayEnd } },
        }),
        prisma.leaveRequest.count({
          where: { userId: session.id, finalStatus: "pending" },
        }),
        prisma.meeting.count({
          where: {
            isActive: true,
            status: "active",
            OR: [
              { scheduledAt: { gte: now } },
              { type: "persistent" },
            ],
          },
        }),
        prisma.$queryRawUnsafe<number>(`SELECT COUNT(*)::int FROM "Task" WHERE "assignedTo" = $1`, session.id)
          .catch(() => 0),
      ]);

      return NextResponse.json({
        stats: {
          myAttendance: myAttendance
            ? { status: myAttendance.status, totalWorkMinutes: myAttendance.totalWorkMinutes }
            : null,
          pendingLeaves,
          upcomingMeetings,
          tasksCount: Number(tasksCount || 0),
        },
      });
    }

    if (session.role === "team_lead") {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { departmentId: true },
      });

      let teamAttendance = 0;
      let departmentMembers = 0;

      if (user?.departmentId) {
        const deptUserIds = await prisma.user.findMany({
          where: { departmentId: user.departmentId },
          select: { id: true },
        });
        departmentMembers = deptUserIds.length;
        teamAttendance = await prisma.attendanceRecord.count({
          where: {
            userId: { in: deptUserIds.map((u) => u.id) },
            date: { gte: todayStart, lt: todayEnd },
          },
        });
      }

      const [pendingLeaveRequests, activeMeetings] = await Promise.all([
        prisma.leaveRequest.count({
          where: { finalStatus: "pending" },
        }),
        prisma.meeting.count({
          where: { isActive: true, status: "active" },
        }),
      ]);

      return NextResponse.json({
        stats: {
          teamAttendance,
          pendingLeaveRequests,
          activeMeetings,
          departmentMembers,
        },
      });
    }

    if (session.role === "hr") {
      const [totalEmployees, pendingLeaveRequests, activeEmployees, departmentsCount] = await Promise.all([
        prisma.user.count({ where: { role: "employee", isActive: true } }),
        prisma.leaveRequest.count({ where: { finalStatus: "pending" } }),
        prisma.user.count({ where: { isActive: true, role: { not: "super_admin" } } }),
        prisma.department.count(),
      ]);

      return NextResponse.json({
        stats: {
          totalEmployees,
          pendingLeaveRequests,
          activeEmployees,
          departmentsCount,
        },
      });
    }

    const [totalEmployees, totalDepartments, activeMeetings, pendingLeaveRequests, attendanceToday] =
      await Promise.all([
        prisma.user.count({ where: { isActive: true, role: { not: "super_admin" } } }),
        prisma.department.count(),
        prisma.meeting.count({ where: { isActive: true, status: "active" } }),
        prisma.leaveRequest.count({ where: { finalStatus: "pending" } }),
        prisma.attendanceRecord.count({
          where: { date: { gte: todayStart, lt: todayEnd }, user: { role: { not: "super_admin" } } },
        }),
      ]);

    return NextResponse.json({
      stats: {
        totalEmployees,
        totalDepartments,
        activeMeetings,
        pendingLeaveRequests,
        attendanceToday,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
