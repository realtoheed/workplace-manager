import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiUser(request, ["hr", "super_admin"]);
    void session;
    const { id } = await params;
    const body = await request.json();
    const { name, headId } = body;

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("NotFound");
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      if (!name.trim()) throw new Error("Department name cannot be empty.");
      const duplicate = await prisma.department.findUnique({ where: { name: name.trim() } });
      if (duplicate && duplicate.id !== id) {
        throw new Error("Conflict");
      }
      data.name = name.trim();
    }
    if (headId !== undefined) {
      data.headId = headId || null;
    }

    const department = await prisma.department.update({
      where: { id },
      data,
      include: {
        head: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ department });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiUser(request, ["hr", "super_admin"]);
    void session;
    const { id } = await params;

    const existing = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!existing) {
      throw new Error("NotFound");
    }
    if (existing._count.members > 0) {
      throw new Error("Cannot delete department with active members.");
    }

    await prisma.department.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
