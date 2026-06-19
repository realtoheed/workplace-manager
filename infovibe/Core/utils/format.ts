import { buildMeetRoomId } from "@/lib/meet";

export function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatMinutes(minutes?: number) {
  if (!minutes || minutes <= 0) {
    return "0 min";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function buildMeetingUrl(room: string) {
  const baseUrl = (process.env.NEXT_PUBLIC_MEET_BASE_URL || process.env.NEXT_PUBLIC_JITSI_BASE_URL || "https://meet.infovibex.com").replace(/\/$/, "");
  return `${baseUrl}/meeting/${encodeURIComponent(buildMeetRoomId(room))}`;
}

export function buildClientMeetingJoinPageUrl(token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://taskmanager.infovibex.com";
  const normalizedAppUrl = appUrl.replace(/\/$/, "");
  return `${normalizedAppUrl}/client-meeting/core/${encodeURIComponent(token)}`;
}

export function toCsv(rows: Record<string, string | number | null | undefined>[]) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const body = rows.map((row) =>
    headers
      .map((header) => {
        const value = row[header] ?? "";
        return `"${String(value).replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  return [headers.join(","), ...body].join("\n");
}