import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSalary } from "@/lib/roles";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    if (!canManageSalary(session.role)) throw new Error("Forbidden");

    const { searchParams } = request.nextUrl;
    const userId = searchParams.get("userId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (month) where.month = parseInt(month, 10);
    if (year) where.year = parseInt(year, 10);

    const records = await prisma.salaryRecord.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, designation: true } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    const mapped = records.map((r) => ({
      id: r.id,
      userId: r.userId,
      employeeName: r.user?.name || "Unknown",
      employeeEmail: r.user?.email || "",
      designation: r.user?.designation || "",
      month: r.month,
      year: r.year,
      monthlySalary: r.monthlySalary,
      absentDays: r.absentDays,
      deductions: r.deductions,
      netSalary: r.netSalary,
      status: r.status,
    }));

    return NextResponse.json({ records: mapped });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    if (!canManageSalary(session.role)) throw new Error("Forbidden");

    const body = await request.json();
    const { userId, month, year, monthlySalary, absentDays, deductions } = body;

    if (!userId || !month || !year || monthlySalary === undefined) {
      throw new Error("userId, month, year, and monthlySalary are required");
    }

    const netSalary = (monthlySalary || 0) - (deductions || 0);

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) throw new Error("User not found");

    const previousRecord = await prisma.salaryRecord.findFirst({
      where: { userId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    const record = await prisma.salaryRecord.create({
      data: {
        userId,
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        monthlySalary: parseFloat(monthlySalary),
        absentDays: parseInt(String(absentDays || 0), 10),
        deductions: parseFloat(String(deductions || 0)),
        netSalary,
        status: "pending",
      },
    });

    if (previousRecord && previousRecord.monthlySalary !== record.monthlySalary) {
      await prisma.salaryChange.create({
        data: {
          userId,
          oldSalary: previousRecord.monthlySalary,
          newSalary: record.monthlySalary,
          reason: `Updated for ${month}/${year}`,
          changedById: session.id,
          effectiveFrom: new Date(),
        },
      });
    }

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}