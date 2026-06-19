import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { listMeetings } from "@/lib/queries";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    const meetings = await listMeetings();
    return NextResponse.json({ meetings });
  } catch (error) {
    return apiErrorResponse(error);
  }
}