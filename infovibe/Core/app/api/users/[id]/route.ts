import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiUser(request, ["hr", "super_admin"]);
    const { id } = await params;
    const body = await request.json();
    const { designation, departmentId, salary, workStartTime, workEndTime, isActive, role, defaultRoomId, hireDate } = body;

    if (role && role === "super_admin" && session.role !== "super_admin") {
      throw new Error("Forbidden");
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("NotFound");
    }

    const data: Record<string, unknown> = {};
    if (designation !== undefined) data.designation = designation || null;
    if (departmentId !== undefined) data.departmentId = departmentId || null;
    if (salary !== undefined) data.salary = salary ? parseFloat(salary) : null;
    if (workStartTime !== undefined) data.workStartTime = workStartTime || null;
    if (workEndTime !== undefined) data.workEndTime = workEndTime || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (role !== undefined) data.role = role;
    if (defaultRoomId !== undefined) data.defaultRoomId = defaultRoomId || null;
    if (hireDate !== undefined) data.hireDate = hireDate ? new Date(hireDate) : null;

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        departmentId: true,
        isActive: true,
        workStartTime: true,
        workEndTime: true,
      },
    });
    return NextResponse.json({ user });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiUser(request, ["hr", "super_admin"]);
    const { id } = await params;

    if (session.id === id) {
      throw new Error("You cannot deactivate your own account.");
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("NotFound");
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
