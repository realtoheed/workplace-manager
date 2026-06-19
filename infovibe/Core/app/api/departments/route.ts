import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  try {
    const departments = await prisma.department.findMany({
      include: {
        head: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });
    const mapped = departments.map((d) => ({
      id: d.id,
      name: d.name,
      headId: d.headId,
      head: d.head,
      memberCount: d._count.members,
    }));
    return NextResponse.json({ departments: mapped });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["hr", "super_admin"]);
    void session;
    const body = await request.json();
    const { name, headId } = body;

    if (!name || !name.trim()) {
      throw new Error("Department name is required.");
    }

    const existing = await prisma.department.findUnique({ where: { name: name.trim() } });
    if (existing) {
      throw new Error("Conflict");
    }

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        headId: headId || null,
      },
      include: {
        head: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
