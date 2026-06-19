import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import NotificationReadModel from "@/models/NotificationRead";

const markReadSchema = z.object({
  notificationId: z.string().trim().min(1)
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    const payload = markReadSchema.parse(await request.json());

    await NotificationReadModel.updateOne(
      { userId: session.id, notificationId: payload.notificationId },
      { $set: { readAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
