import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireApiUser(request, ["team_lead"]);
    const { id } = await params;
    const body = await request.json();
    const { action, comment } = body;

    if (!action || !["recommend", "reject"].includes(action)) {
      throw new Error("Action must be 'recommend' or 'reject'.");
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, departmentId: true, department: { select: { headId: true } } } },
      },
    });
    if (!leave) {
      throw new Error("NotFound");
    }

    if (leave.user.department?.headId !== session.id) {
      throw new Error("Forbidden");
    }

    if (leave.finalStatus !== "pending") {
      throw new Error("Leave request has already been finalized.");
    }

    const updateData: Record<string, unknown> = {
      tlComment: comment || null,
      tlActedAt: new Date(),
    };

    if (action === "reject") {
      updateData.tlStatus = "rejected";
      updateData.finalStatus = "rejected";
    } else {
      updateData.tlStatus = "approved";
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: updateData as any,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return NextResponse.json({ leave: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
