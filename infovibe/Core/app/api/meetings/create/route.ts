import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request, ["super_admin", "team_lead"]);
    void session;
    throw new Error("The General meeting is managed automatically and cannot be created manually.");
  } catch (error) {
    return apiErrorResponse(error);
  }
}