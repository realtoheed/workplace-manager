import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");
    if (secret !== "infovibex-auto-salary-2026") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    let targetMonth = now.getMonth();
    let targetYear = now.getFullYear();
    if (targetMonth === 0) {
      targetMonth = 12;
      targetYear -= 1;
    }

    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { not: "super_admin" },
        salary: { gt: 0 },
      },
      select: { id: true, name: true, salary: true },
    });

    let created = 0;
    const results: string[] = [];

    for (const emp of employees) {
      const existing = await prisma.salaryRecord.findUnique({
        where: {
          userId_month_year: {
            userId: emp.id,
            month: targetMonth,
            year: targetYear,
          },
        },
      });

      if (existing) {
        results.push(`${emp.name}: already exists`);
        continue;
      }

      const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
      const endOfMonth = new Date(targetYear, targetMonth, 1);

      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          userId: emp.id,
          date: { gte: startOfMonth, lt: endOfMonth },
        },
      });

      const absentDays = attendanceRecords.filter(
        (r) => r.status !== "present"
      ).length;

      const monthlySalary = emp.salary || 0;
      const dayRate = monthlySalary / 30;
      const deductions = dayRate * absentDays;
      const netSalary = monthlySalary - deductions;

      await prisma.salaryRecord.create({
        data: {
          userId: emp.id,
          month: targetMonth,
          year: targetYear,
          monthlySalary,
          absentDays,
          deductions: Math.round(deductions * 100) / 100,
          netSalary: Math.round(netSalary * 100) / 100,
          status: "auto-calculated",
        },
      });

      created++;
      results.push(`${emp.name}: absent ${absentDays} days, net ${Math.round(netSalary)}`);
    }

    return NextResponse.json({
      success: true,
      period: `${targetYear}-${String(targetMonth).padStart(2, "0")}`,
      daysInMonth,
      created,
      total: employees.length,
      results,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}