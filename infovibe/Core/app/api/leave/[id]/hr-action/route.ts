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
    const { action, comment } = body;

    if (!action || !["approve", "reject"].includes(action)) {
      throw new Error("Action must be 'approve' or 'reject'.");
    }

    const leave = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) {
      throw new Error("NotFound");
    }

    if (leave.finalStatus !== "pending") {
      throw new Error("Leave request has already been finalized.");
    }

    const updateData: Record<string, unknown> = {
      hrComment: comment || null,
      hrActedAt: new Date(),
      hrStatus: action === "approve" ? "approved" : "rejected",
      finalStatus: action === "approve" ? "approved" : "rejected",
    };

    if (action === "approve" && leave.tlStatus === "rejected") {
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
