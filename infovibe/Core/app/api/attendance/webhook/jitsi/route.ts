import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  isJoinEvent,
  isLeaveEvent,
  normalizeMeetWebhookEvent,
} from "@/lib/attendance";

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.MEET_WEBHOOK_SECRET || process.env.JITSI_WEBHOOK_SECRET;
    const providedSecret =
      request.headers.get("x-meet-webhook-secret") ||
      request.headers.get("x-jitsi-webhook-secret") ||
      request.nextUrl.searchParams.get("secret") ||
      "";

    if (!expectedSecret || providedSecret !== expectedSecret) {
      throw new Error("Unauthorized");
    }

    const payload = await request.json();
    const event = normalizeMeetWebhookEvent(payload);

    if (!event.meetingId || !event.participantId) {
      throw new Error("Invalid request payload.");
    }

    if (isJoinEvent(event.eventName)) {
      let user = await prisma.user.findFirst({
        where: { email: event.email },
        select: { id: true, role: true },
      });

      if (!user) {
        return NextResponse.json({ success: true, action: "ignored", reason: "unknown_user" });
      }

      if (user.role === "super_admin") {
        return NextResponse.json({ success: true, action: "ignored", reason: "admin" });
      }

      const todayStart = new Date(
        event.timestamp.getFullYear(),
        event.timestamp.getMonth(),
        event.timestamp.getDate()
      );

      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: { userId_date: { userId: user.id, date: todayStart } },
      });

      if (existingRecord) {
        if (!existingRecord.lastLeaveAt) {
          return NextResponse.json({ success: true, action: "join", attendanceId: existingRecord.id });
        }
        const gapMinutes = (event.timestamp.getTime() - existingRecord.lastLeaveAt.getTime()) / 60000;
        const breakMinutes = gapMinutes > 0 ? Math.round(gapMinutes) : 0;

        await prisma.attendanceRecord.update({
          where: { id: existingRecord.id },
          data: {
            lastLeaveAt: null,
            breakMinutes: { increment: breakMinutes },
            status: "present",
          },
        });

        return NextResponse.json({ success: true, action: "join", attendanceId: existingRecord.id });
      }

      const record = await prisma.attendanceRecord.create({
        data: {
          userId: user.id,
          date: todayStart,
          firstJoinAt: event.timestamp,
          lastLeaveAt: null,
          totalWorkMinutes: 0,
          breakMinutes: 0,
          screenshareMinutes: 0,
          lateMinutes: 0,
          status: "present",
        },
      });

      return NextResponse.json({ success: true, action: "join", attendanceId: record.id });
    }

    if (isLeaveEvent(event.eventName)) {
      let user = await prisma.user.findFirst({
        where: { email: event.email },
        select: { id: true, role: true },
      });

      if (!user && event.participantId) {
        user = await prisma.user.findUnique({ where: { id: event.participantId }, select: { id: true, role: true } });
      }

      if (!user) {
        return NextResponse.json({ success: true, action: "ignored", reason: "unknown_user" });
      }

      if (user.role === "super_admin") {
        return NextResponse.json({ success: true, action: "ignored", reason: "admin" });
      }

      const todayStart = new Date(
        event.timestamp.getFullYear(),
        event.timestamp.getMonth(),
        event.timestamp.getDate()
      );

      const record = await prisma.attendanceRecord.findUnique({
        where: { userId_date: { userId: user.id, date: todayStart } },
      });

      if (!record || !record.firstJoinAt) {
        return NextResponse.json({ success: true, action: "leave", attendanceId: record?.id || null });
      }

      const durationMinutes = Math.round(
        (event.timestamp.getTime() - record.firstJoinAt.getTime()) / 60000
      );

      await prisma.attendanceRecord.update({
        where: { id: record.id },
        data: {
          lastLeaveAt: event.timestamp,
          totalWorkMinutes: { increment: Math.max(0, durationMinutes) },
          status: "present",
        },
      });

      return NextResponse.json({ success: true, action: "leave", attendanceId: record.id });
    }

    return NextResponse.json({ success: true, action: "ignored" });
  } catch (error) {
    return apiErrorResponse(error);
  }
}