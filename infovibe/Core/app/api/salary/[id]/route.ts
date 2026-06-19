import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSalary } from "@/lib/roles";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiUser(request);
    if (!canManageSalary(session.role)) throw new Error("Forbidden");

    const { id } = await params;
    const body = await request.json();
    const { monthlySalary, absentDays, deductions, status } = body;

    const existing = await prisma.salaryRecord.findUnique({ where: { id } });
    if (!existing) throw new Error("NotFound");

    const oldSalary = existing.monthlySalary;
    const newSalary = monthlySalary !== undefined ? parseFloat(monthlySalary) : existing.monthlySalary;
    const newDeductions = deductions !== undefined ? parseFloat(deductions) : existing.deductions;
    const newAbsentDays = absentDays !== undefined ? parseInt(String(absentDays), 10) : existing.absentDays;
    const netSalary = newSalary - newDeductions;

    const data: Record<string, unknown> = {
      monthlySalary: newSalary,
      absentDays: newAbsentDays,
      deductions: newDeductions,
      netSalary,
    };
    if (status !== undefined) data.status = status;

    const updated = await prisma.salaryRecord.update({ where: { id }, data });

    if (oldSalary !== newSalary) {
      await prisma.salaryChange.create({
        data: {
          userId: existing.userId,
          oldSalary,
          newSalary,
          reason: body.reason || "Salary updated",
          changedById: session.id,
          effectiveFrom: new Date(),
        },
      });
    }

    return NextResponse.json({ record: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiUser(request);
    if (!canManageSalary(session.role)) throw new Error("Forbidden");

    const { id } = await params;
    const existing = await prisma.salaryRecord.findUnique({ where: { id } });
    if (!existing) throw new Error("NotFound");

    await prisma.salaryRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}