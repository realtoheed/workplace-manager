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
    if (!userId) throw new Error("userId is required");

    const changes = await prisma.salaryChange.findMany({
      where: { userId },
      include: {
        changedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { effectiveFrom: "desc" },
    });

    const mapped = changes.map((c) => ({
      id: c.id,
      userId: c.userId,
      oldSalary: c.oldSalary,
      newSalary: c.newSalary,
      reason: c.reason,
      changedBy: c.changedBy,
      effectiveFrom: c.effectiveFrom.toISOString(),
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({ changes: mapped });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    if (!canManageSalary(session.role)) throw new Error("Forbidden");

    const body = await request.json();
    const { userId, oldSalary, newSalary, effectiveFrom, reason } = body;

    if (!userId || oldSalary === undefined || newSalary === undefined) {
      throw new Error("userId, oldSalary, and newSalary are required");
    }

    const change = await prisma.salaryChange.create({
      data: {
        userId,
        oldSalary: parseFloat(oldSalary),
        newSalary: parseFloat(newSalary),
        reason: reason || "Manual increment",
        changedById: session.id,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      },
      include: {
        changedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ change }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}