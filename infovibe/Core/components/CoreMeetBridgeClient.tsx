"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildMeetEmbedUrl, buildMeetParticipantId, buildMeetProfileId, buildMeetingRoomBindings, findMeetRoomBinding, findMeetRoomBindingByPhysicalRoomId, getMeetBaseUrl } from "@/lib/meet";
import type { MeetingView, SessionUser } from "@/lib/types";

type CoreMeetBridgeClientProps = {
  closeOnLeave?: boolean;
  desktopShell?: boolean;
  meetings: MeetingView[];
  initialMeetingId?: string;
  initialRoomId?: string;
  user: Pick<SessionUser, "id" | "name">;
};

type DesktopRecordingState = {
  available: boolean;
  isHost: boolean;
  label: string;
  status: string;
};

type DesktopRecordingApiState = {
  available?: boolean;
  error?: string;
  label?: string;
  status?: string;
};

type DesktopRecordingOptions = {
  hostName: string;
  title: string;
  uploadUrl: string;
};

type DesktopRecordingController = {
  getState: () => DesktopRecordingApiState;
  isAvailable: () => boolean;
  start: (options: DesktopRecordingOptions) => Promise<DesktopRecordingApiState>;
  stop: () => Promise<DesktopRecordingApiState>;
};

type RoomOccupant = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
};

type RoomPresence = {
  roomId: string;
  roomName: string;
  occupants: RoomOccupant[];
};

type MeetBridgeEvent = {
  isHost?: boolean;
  recordingDisabled?: boolean;
  recordingLabel?: string;
  recordingStatus?: string;
  roomId?: string;
  screenStatus?: string;
  source?: string;
  type?: "meeting-left" | "recording-state" | "room-joined" | "room-left" | "screen-share" | "remote-control-session" | "remote-control-event";
};

const PHONE_DEVICE_PATTERN = /iphone|ipod|android.*mobile|windows phone|iemobile|opera mini/i;

const INTERNAL_MEETING_ID = "miu-internal";
const DEFAULT_DESKTOP_RECORDING_STATE: DesktopRecordingState = {
  available: false,
  isHost: false,
  label: "Start recording",
  status: "idle"
};

function getDesktopRecordingController() {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as Window & {
    infovibeDesktop?: {
      recording?: DesktopRecordingController;
    };
  }).infovibeDesktop?.recording || null;
}

function isInternalMeetingId(value: string) {
  return String(value || "").trim().toLowerCase() === INTERNAL_MEETING_ID;
}

async function postAttendanceEvent(action: "join" | "leave", meetingId: string, room: string, keepalive = false) {
  await fetch(`/api/attendance/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      meetingId,
      room,
      timestamp: new Date().toISOString()
    }),
    keepalive
  });
}

async function postScreenShareEvent(action: "start" | "stop", meetingId: string, room: string, keepalive = false) {
  await fetch("/api/attendance/screen-share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action,
      meetingId,
      room,
      timestamp: new Date().toISOString()
    }),
    keepalive
  });
}

export default function CoreMeetBridgeClient({ closeOnLeave = false, desktopShell = false, meetings, initialMeetingId, initialRoomId, user }: CoreMeetBridgeClientProps) {
  const [selectedMeetingId] = useState(initialMeetingId || meetings[0]?.id || "");
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId || "");
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomPresence[]>([]);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPhoneDevice, setIsPhoneDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBreakoutDialog, setShowBreakoutDialog] = useState(false);
  const [desktopRecordingState, setDesktopRecordingState] = useState<DesktopRecordingState>(DEFAULT_DESKTOP_RECORDING_STATE);
  const [desktopRecordingError, setDesktopRecordingError] = useState<string | null>(null);
  const [remoteControlSession, setRemoteControlSession] = useState<{ controller: string; controlled: string; role: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const activeAttendanceSessionRef = useRef<{ meetingId: string; room: string } | null>(null);
  const activeScreenShareRoomRef = useRef<string | null>(null);
  const autoOpenRoomKeyRef = useRef<string>("");

  const selectedMeeting = useMemo(() => {
    return meetings.find((meeting) => meeting.id === selectedMeetingId) || meetings[0] || null;
  }, [meetings, selectedMeetingId]);

  const roomBindings = useMemo(() => {
    return selectedMeeting ? buildMeetingRoomBindings(selectedMeeting) : [];
  }, [selectedMeeting]);

  const participantId = useMemo(() => buildMeetParticipantId(user.id), [user.id]);

  const profileId = useMemo(() => buildMeetProfileId(user.id), [user.id]);
  const mainRoomId = selectedMeeting?.meetingId || "";
  const activeRoomId = selectedRoomId || mainRoomId;
  const activeRoomBinding = useMemo(() => findMeetRoomBinding(roomBindings, activeRoomId), [activeRoomId, roomBindings]);
  const meetOrigin = useMemo(() => {
    try {
      return new URL(getMeetBaseUrl()).origin;
    } catch {
      return "https://meet.infovibex.com";
    }
  }, []);
  const activeRoomLabel = useMemo(() => {
    if (!selectedMeeting) {
      return "General";
    }

    if (!activeRoomId || activeRoomId === mainRoomId) {
      return selectedMeeting.meetingName || "General";
    }

    const breakoutIndex = selectedMeeting.breakoutRooms.findIndex((room) => room === activeRoomId);

    if (breakoutIndex >= 0) {
      return selectedMeeting.breakoutRoomNames[breakoutIndex] || `Breakout ${breakoutIndex + 1}`;
    }

    const liveRoom = rooms.find((room) => room.roomId === activeRoomId);
    return liveRoom?.roomName || activeRoomId;
  }, [activeRoomId, mainRoomId, rooms, selectedMeeting]);
  const shouldCloseOnLeave = closeOnLeave || desktopShell;
  const desktopRecordingTitle = useMemo(() => {
    const title = activeRoomLabel || selectedMeeting?.meetingName || "Meeting";
    return `${title} recording`;
  }, [activeRoomLabel, selectedMeeting?.meetingName]);
  const desktopRecordingUploadUrl = useMemo(() => {
    const meetingBinding = roomBindings[0];

    if (!meetingBinding || !activeRoomBinding) {
      return "";
    }

    const url = new URL("/api/recordings", `${getMeetBaseUrl()}/`);
    url.searchParams.set("meetingId", meetingBinding.physicalRoomId);
    url.searchParams.set("participantId", participantId);
    url.searchParams.set("profileId", profileId);
    url.searchParams.set("roomId", activeRoomBinding.physicalRoomId);
    return url.toString();
  }, [activeRoomBinding, participantId, profileId, roomBindings]);

  function resolveLogicalRoomId(physicalRoomId?: string) {
    const normalizedRoomId = String(physicalRoomId || "").trim();

    if (!normalizedRoomId) {
      return activeAttendanceSessionRef.current?.room || activeRoomBinding?.logicalRoomId || selectedMeeting?.meetingId || "";
    }

    return findMeetRoomBindingByPhysicalRoomId(roomBindings, normalizedRoomId)?.logicalRoomId || activeRoomBinding?.logicalRoomId || selectedMeeting?.meetingId || "";
  }

  function closeActiveAttendanceAndScreenShare(keepalive = false) {
    if (activeScreenShareRoomRef.current && selectedMeeting?.id) {
      const activeScreenShareRoom = activeScreenShareRoomRef.current;
      activeScreenShareRoomRef.current = null;
      void postScreenShareEvent("stop", selectedMeeting.id, activeScreenShareRoom, keepalive).catch(() => undefined);
    }

    if (activeAttendanceSessionRef.current) {
      const activeAttendanceSession = activeAttendanceSessionRef.current;
      activeAttendanceSessionRef.current = null;
      void postAttendanceEvent("leave", activeAttendanceSession.meetingId, activeAttendanceSession.room, keepalive).catch(() => undefined);
    }
  }

  const closeStandaloneMeetingWindow = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    let fallbackUrl = "/";

    try {
      if (document.referrer) {
        const referrerUrl = new URL(document.referrer);

        if (referrerUrl.origin === window.location.origin) {
          fallbackUrl = `${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`;
        }
      }
    } catch {
      fallbackUrl = "/";
    }

    window.close();
    window.setTimeout(() => {
      if (!window.closed) {
        window.location.replace(fallbackUrl);
      }
    }, 150);
  }, []);

  const applyDesktopRecordingApiState = useCallback((nextState?: DesktopRecordingApiState) => {
    const controller = getDesktopRecordingController();
    const available = Boolean(controller?.isAvailable?.() || nextState?.available);

    setDesktopRecordingState((current) => ({
      available,
      isHost: current.isHost,
      label: String(nextState?.label || current.label || DEFAULT_DESKTOP_RECORDING_STATE.label),
      status: String(nextState?.status || current.status || DEFAULT_DESKTOP_RECORDING_STATE.status)
    }));

    if (typeof nextState?.error === "string") {
      setDesktopRecordingError(nextState.error ? nextState.error : null);
    }
  }, []);

  const resetDesktopRecordingUiState = useCallback(() => {
    const controller = getDesktopRecordingController();
    const nextState = controller?.getState();

    setDesktopRecordingState({
      available: Boolean(controller?.isAvailable?.() || nextState?.available),
      isHost: false,
      label: String(nextState?.label || DEFAULT_DESKTOP_RECORDING_STATE.label),
      status: String(nextState?.status || DEFAULT_DESKTOP_RECORDING_STATE.status)
    });

    if (typeof nextState?.error === "string") {
      setDesktopRecordingError(nextState.error ? nextState.error : null);
    }
  }, []);

  const postDesktopShellMessage = useCallback((type: "request-recording-state") => {
    iframeRef.current?.contentWindow?.postMessage({
      source: "infovibe-desktop-shell",
      type
    }, meetOrigin);
  }, [meetOrigin]);

  async function handleToggleDesktopRecording() {
    if (loading || !desktopRecordingState.available || !desktopRecordingState.isHost) {
      return;
    }

    const controller = getDesktopRecordingController();

    if (!controller) {
      setDesktopRecordingError("Desktop recording is not available in this meeting window.");
      return;
    }

    try {
      setDesktopRecordingError(null);

      const nextState = desktopRecordingState.status === "recording" || desktopRecordingState.status === "starting"
        ? await controller.stop()
        : await controller.start({
            hostName: user.name,
            title: desktopRecordingTitle,
            uploadUrl: desktopRecordingUploadUrl
          });

      applyDesktopRecordingApiState(nextState);
    } catch (recordingError) {
      setDesktopRecordingError(recordingError instanceof Error ? recordingError.message : "Could not update desktop recording.");
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsPhoneDevice(PHONE_DEVICE_PATTERN.test(window.navigator.userAgent));
  }, []);

  async function loadRoomPresence(meetingId: string) {
    const response = await fetch(`/api/meetings/${meetingId}/rooms`, { cache: "no-store" });
    const data = await response.json();

    if (response.ok && Array.isArray(data.rooms)) {
      setRooms(data.rooms);

      if (!expandedRoomId && data.rooms.length) {
        setExpandedRoomId(data.rooms[0].roomId);
      }

      return;
    }

    throw new Error(data.error || "Unable to load breakout rooms.");
  }

  useEffect(() => {
    if (!selectedMeeting?.id || !showBreakoutDialog) {
      return;
    }

    loadRoomPresence(selectedMeeting.id).catch(() => {
      setRooms([]);
    });

    const interval = window.setInterval(() => {
      loadRoomPresence(selectedMeeting.id).catch(() => {
        setRooms([]);
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [expandedRoomId, selectedMeeting?.id, showBreakoutDialog]);

  useEffect(() => {
    if (!selectedMeeting?.id) {
      return;
    }

    loadRoomPresence(selectedMeeting.id).catch(() => {
      setRooms([]);
    });
  }, [selectedMeeting?.id]);

  useEffect(() => {
    if (!selectedMeeting) {
      return;
    }

    const allowedRooms = new Set([selectedMeeting.meetingId, ...selectedMeeting.breakoutRooms]);
    const defaultRoomId = selectedRoomId && allowedRooms.has(selectedRoomId) ? selectedRoomId : selectedMeeting.meetingId;

    if (selectedRoomId !== defaultRoomId) {
      setSelectedRoomId(defaultRoomId);
    }

    setError(null);
  }, [selectedMeeting, selectedRoomId]);

  useEffect(() => {
    setJoinUrl(null);
    setDesktopRecordingError(null);
    resetDesktopRecordingUiState();
    autoOpenRoomKeyRef.current = "";
  }, [resetDesktopRecordingUiState, selectedMeeting?.id]);

  useEffect(() => {
    if (!desktopShell || typeof window === "undefined") {
      return;
    }

    applyDesktopRecordingApiState(getDesktopRecordingController()?.getState());

    const handleDesktopRecordingState = ((event: Event) => {
      applyDesktopRecordingApiState((event as CustomEvent<DesktopRecordingApiState>).detail);
    }) as EventListener;

    window.addEventListener("infovibe-desktop-recording-state", handleDesktopRecordingState);

    return () => {
      window.removeEventListener("infovibe-desktop-recording-state", handleDesktopRecordingState);
    };
  }, [applyDesktopRecordingApiState, desktopShell]);

  useEffect(() => {
    if (!selectedMeeting || isPhoneDevice || joinUrl) {
      return;
    }

    const targetRoomId = activeRoomId || selectedMeeting.meetingId;
    const targetRoomBinding = findMeetRoomBinding(roomBindings, targetRoomId);

    if (!targetRoomBinding) {
      return;
    }

    const nextAutoOpenKey = `${selectedMeeting.id}:${targetRoomBinding.physicalRoomId}`;

    if (autoOpenRoomKeyRef.current === nextAutoOpenKey) {
      return;
    }

    autoOpenRoomKeyRef.current = nextAutoOpenKey;
    void handleOpenMeeting(targetRoomId);
  }, [activeRoomId, isPhoneDevice, joinUrl, roomBindings, selectedMeeting]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeUnload = () => {
      closeActiveAttendanceAndScreenShare(true);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      closeActiveAttendanceAndScreenShare(true);
    };
  }, [selectedMeeting?.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedMeeting) {
      return;
    }

    const handleMessage = (event: MessageEvent<MeetBridgeEvent>) => {
      if (event.origin !== meetOrigin) {
        return;
      }

      if (event.data?.source !== "infovibe-meet") {
        return;
      }

      if (event.data.type === "meeting-left") {
        closeActiveAttendanceAndScreenShare();

        if (shouldCloseOnLeave) {
          closeStandaloneMeetingWindow();
        }

        return;
      }

      if (event.data.type === "recording-state") {
        const controller = getDesktopRecordingController();
        setDesktopRecordingState((current) => ({
          ...current,
          available: Boolean(controller?.isAvailable?.() || current.available),
          isHost: Boolean(event.data.isHost)
        }));
        return;
      }

      const logicalRoomId = resolveLogicalRoomId(event.data.roomId);

      if (!logicalRoomId) {
        return;
      }

      if (event.data.type === "room-joined") {
        const currentAttendance = activeAttendanceSessionRef.current;

        if (currentAttendance && currentAttendance.meetingId === selectedMeeting.meetingId && currentAttendance.room === logicalRoomId) {
          setSelectedRoomId(logicalRoomId);
          return;
        }

        if (currentAttendance) {
          void postAttendanceEvent("leave", currentAttendance.meetingId, currentAttendance.room).catch(() => undefined);
        }

        activeAttendanceSessionRef.current = {
          meetingId: selectedMeeting.meetingId,
          room: logicalRoomId
        };
        setSelectedRoomId(logicalRoomId);
        void postAttendanceEvent("join", selectedMeeting.meetingId, logicalRoomId).catch(() => undefined);
        return;
      }

      if (event.data.type === "room-left") {
        closeActiveAttendanceAndScreenShare();
        return;
      }

      if (event.data.type === "screen-share") {
        const screenStatus = String(event.data.screenStatus || "off");
        const currentRoom = logicalRoomId || activeAttendanceSessionRef.current?.room || selectedMeeting.meetingId;

        if (screenStatus !== "off") {
          if (activeScreenShareRoomRef.current === currentRoom) {
            return;
          }

          if (activeScreenShareRoomRef.current && selectedMeeting.id) {
            const previousRoom = activeScreenShareRoomRef.current;
            activeScreenShareRoomRef.current = null;
            void postScreenShareEvent("stop", selectedMeeting.id, previousRoom).catch(() => undefined);
          }

          activeScreenShareRoomRef.current = currentRoom;
          void postScreenShareEvent("start", selectedMeeting.id, currentRoom).catch(() => undefined);
          return;
        }

        if (activeScreenShareRoomRef.current && selectedMeeting.id) {
          const previousRoom = activeScreenShareRoomRef.current;
          activeScreenShareRoomRef.current = null;
          void postScreenShareEvent("stop", selectedMeeting.id, previousRoom).catch(() => undefined);
        }
      }

      if (event.data.type === "remote-control-session") {
        const session = event.data as MeetBridgeEvent & {
          type: "remote-control-session";
          status: string;
          role: string;
          controller: string;
          controlled: string;
          meetingId: string;
        };

        if (session.status === "started") {
          setRemoteControlSession({
            controller: session.controller,
            controlled: session.controlled,
            role: session.role,
          });
        } else {
          setRemoteControlSession(null);
        }
        return;
      }

      if (event.data.type === "remote-control-event") {
        iframeRef.current?.contentWindow?.postMessage({
          source: "infovibe-desktop-shell",
          type: "remote-control-event",
          event: (event.data as Record<string, unknown>).event,
        }, meetOrigin);
        return;
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [activeRoomBinding?.logicalRoomId, closeStandaloneMeetingWindow, meetOrigin, roomBindings, selectedMeeting, shouldCloseOnLeave]);

  // Initialize desktop remote control when running in Electron shell
  useEffect(() => {
    if (!desktopShell) return;

    const win = window as Window & {
      infovibeDesktop?: {
        remoteControl?: {
          onEvent?: (cb: (data: unknown) => void) => void;
          onRequest?: (cb: (data: unknown) => void) => void;
          onResponse?: (cb: (data: unknown) => void) => void;
          onTerminated?: (cb: (data: unknown) => void) => void;
        };
      };
    };

    if (!win.infovibeDesktop?.remoteControl) return;

    // Forward incoming desktop remote control events to the meet iframe
    const handleDesktopEvent = (eventData: unknown) => {
      iframeRef.current?.contentWindow?.postMessage({
        source: "infovibe-desktop-shell",
        type: "remote-control-event",
        event: eventData,
      }, meetOrigin);
    };

    const handleDesktopRequest = (data: unknown) => {
      iframeRef.current?.contentWindow?.postMessage({
        source: "infovibe-desktop-shell",
        type: "remote-control-request",
        data,
      }, meetOrigin);
    };

    const handleDesktopResponse = (data: unknown) => {
      iframeRef.current?.contentWindow?.postMessage({
        source: "infovibe-desktop-shell",
        type: "remote-control-response",
        data,
      }, meetOrigin);
    };

    win.infovibeDesktop.remoteControl.onEvent?.(handleDesktopEvent);
    win.infovibeDesktop.remoteControl.onRequest?.(handleDesktopRequest);
    win.infovibeDesktop.remoteControl.onResponse?.(handleDesktopResponse);

    return () => {
      // Listeners persist for the window lifetime in preload
    };
  }, [desktopShell, meetOrigin]);

  async function handleOpenMeeting(roomIdOverride?: string) {
    const targetRoomId = roomIdOverride || selectedMeeting?.meetingId || activeRoomId;

    if (!selectedMeeting || !targetRoomId) {
      return;
    }

    if (isPhoneDevice) {
      setError("Meeting join is not available on phone. Please use desktop or laptop.");
      return;
    }

    const meetingBinding = roomBindings[0];
    const targetRoomBinding = findMeetRoomBinding(roomBindings, targetRoomId);

    if (!meetingBinding || !targetRoomBinding) {
      setError("Unable to prepare the meeting room.");
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedRoomId(targetRoomId);
    resetDesktopRecordingUiState();

    try {
      const parentOrigin = typeof window === "undefined" ? "" : window.location.origin;
      const nextJoinUrl = buildMeetEmbedUrl({
        breakoutRoomCount: Math.max(roomBindings.length - 1, 0),
        desktopShell,
        disableEndMeeting: isInternalMeetingId(selectedMeeting.meetingId) || selectedMeeting.isPermanent,
        displayName: user.name,
        embed: true,
        meetingId: meetingBinding.physicalRoomId,
        meetingTitle: selectedMeeting.meetingName,
        meetingType: "instant",
        parentOrigin,
        participantId,
        profileId,
        roomId: targetRoomBinding.physicalRoomId,
        rooms: roomBindings
      });

      const url = new URL(nextJoinUrl);
      url.searchParams.set("rawUserId", user.id);
      setJoinUrl(url.toString());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to open secure meeting room.");
      setJoinUrl(null);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenBreakoutDialog() {
    if (!selectedMeeting) {
      return;
    }

    setShowBreakoutDialog(true);
    loadRoomPresence(selectedMeeting.id).catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : "Unable to load breakout rooms.");
    });
  }

  async function handleJoinBreakout(roomId: string) {
    setSelectedRoomId(roomId);
    setShowBreakoutDialog(false);
    await handleOpenMeeting(roomId);
  }

  const desktopRecordingDisabled = loading
    || !desktopRecordingState.available
    || !desktopRecordingState.isHost
    || desktopRecordingState.status === "saving"
    || desktopRecordingState.status === "uploading";
  const desktopRecordingActive = desktopRecordingState.status === "recording" || desktopRecordingState.status === "starting";
  const activeError = desktopRecordingError || error;

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-slate-950">

      {joinUrl ? (
        <>
          <iframe
            allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-read; clipboard-write"
            allowFullScreen
            className="h-full w-full border-0"
            key={joinUrl}
            onLoad={() => {
              if (desktopShell) {
                postDesktopShellMessage("request-recording-state");
              }
            }}
            ref={iframeRef}
            referrerPolicy="strict-origin-when-cross-origin"
            src={joinUrl}
            title={`Meeting room ${activeRoomLabel}`}
          />

        </>
      ) : (
        <div className="flex h-full min-h-0 flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
          <p className="font-display text-3xl font-bold sm:text-4xl">InfoVibe Meet</p>
          <p className="mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
            {isPhoneDevice
              ? "Meeting join is not available on phone. Please use a desktop or laptop to open this room."
              : loading
                ? `Opening ${activeRoomLabel}...`
                : "Preparing the meeting workspace..."}
          </p>
        </div>
      )}

      {desktopShell && joinUrl && desktopRecordingState.isHost ? (
        <div className="pointer-events-none absolute right-4 top-4 z-10 flex justify-end">
          <button
            className={`pointer-events-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur ${desktopRecordingActive ? "border-red-400/50 bg-red-500/20 text-red-50" : "border-white/15 bg-black/55 text-white"}`}
            disabled={desktopRecordingDisabled}
            onClick={handleToggleDesktopRecording}
            type="button"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${desktopRecordingActive ? "bg-red-300" : "bg-white/70"}`} />
            {desktopRecordingState.label}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
          <div className="rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs font-medium text-white/90 shadow-lg backdrop-blur">
            Opening meeting...
          </div>
        </div>
      ) : null}

      {activeError ? (
        <div className="absolute inset-x-0 top-4 flex justify-center px-4">
          <div className="max-w-xl rounded-2xl border border-rose-500/30 bg-rose-950/85 px-4 py-3 text-sm text-rose-100 shadow-lg backdrop-blur">
            {activeError}
          </div>
        </div>
      ) : null}

      {remoteControlSession ? (
        <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-blue-400/30 bg-blue-950/90 px-5 py-2.5 text-sm text-blue-100 shadow-lg backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            {remoteControlSession.role === "controller"
              ? `You are controlling ${remoteControlSession.controlled}'s screen`
              : `${remoteControlSession.controller} is controlling your screen`}
            <button
              className="ml-2 rounded-full border border-blue-400/40 px-3 py-1 text-xs font-medium text-blue-200 hover:bg-blue-800/50 transition-colors"
              onClick={() => setRemoteControlSession(null)}
              type="button"
            >
              End
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
