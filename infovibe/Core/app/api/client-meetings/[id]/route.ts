import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import ClientMeetingModel from "@/models/ClientMeeting";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireApiUser(request, ["super_admin"]);
    const { id } = await context.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new Error("NotFound");
    }

    const meeting = await ClientMeetingModel.findOneAndDelete({
      _id: id
    });

    if (!meeting) {
      throw new Error("NotFound");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
