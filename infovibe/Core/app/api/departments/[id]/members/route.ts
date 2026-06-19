import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiUser(_request, ["hr", "super_admin"]);
    const { id } = await params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        members: {
          where: { isActive: true },
          select: { id: true, name: true, email: true, role: true, designation: true },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!department) throw new Error("NotFound");

    return NextResponse.json({
      department: { id: department.id, name: department.name },
      members: department.members,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}