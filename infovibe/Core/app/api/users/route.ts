import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { hashPassword, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["hr", "super_admin"]);
    void session;
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        departmentId: true,
        department: { select: { name: true } },
        defaultRoomId: true,
        hireDate: true,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const mapped = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      designation: u.designation,
      department: u.department?.name ?? null,
      departmentId: u.departmentId,
      defaultRoomId: u.defaultRoomId,
      hireDate: u.hireDate ? u.hireDate.toISOString() : null,
      isActive: u.isActive,
    }));
    return NextResponse.json({ users: mapped });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["hr", "super_admin"]);
    const body = await request.json();
    const { name, email, password, role, designation, departmentId, salary, workStartTime, workEndTime, defaultRoomId, hireDate } = body;

    if (role === "super_admin" && session.role !== "super_admin") {
      throw new Error("Forbidden");
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      throw new Error("Conflict");
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashed,
        role: role as UserRole,
        designation: designation || null,
        departmentId: departmentId || null,
        salary: salary ? parseFloat(salary) : null,
        workStartTime: workStartTime || null,
        workEndTime: workEndTime || null,
        defaultRoomId: defaultRoomId || null,
        hireDate: hireDate ? new Date(hireDate) : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        departmentId: true,
        isActive: true,
      },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
