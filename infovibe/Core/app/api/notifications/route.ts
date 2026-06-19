import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";

export async function GET(_request: NextRequest) {
  await requireApiUser(_request);
  return NextResponse.json({ unreadCount: 0, notifications: [] });
}