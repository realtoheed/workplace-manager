import { icon } from '/livekit-icons.js';
import { renderDashboardView, renderPrejoinView } from '/livekit-dashboard.js';
import { renderShellView } from '/livekit-shell.js';
import { breakoutRoomCountLabel, compactConnectionStatus, fileSizeLabel, getBaseRoomId, getInitials, getParticipantId, normalizeBreakoutRoomCount, normalizeName, normalizeRoomId, statusText, stopTrack } from '/livekit-utils.js';

/* --- Inlined RemoteControl classes (no external import) --- */
class RemoteControlMouseTracker {
  constructor(onEvent){this.onEvent=onEvent;this.lastX=0;this.lastY=0;this.lastClickTime=0;this.clickCount=0;this.clickCountTimeout=null;this._boundMove=null;this._boundClick=null;this._boundScroll=null;this._boundContext=null;}
  start(){if(this._boundMove)return;this._boundMove=this.handleMouseMove.bind(this);this._boundClick=this.handleMouseClick.bind(this);this._boundScroll=this.handleScroll.bind(this);this._boundContext=(e)=>e.preventDefault();window.addEventListener("mousemove",this._boundMove);window.addEventListener("mousedown",this._boundClick);window.addEventListener("wheel",this._boundScroll,{passive:true});window.addEventListener("contextmenu",this._boundContext);}
  stop(){if(this._boundMove){window.removeEventListener("mousemove",this._boundMove);window.removeEventListener("mousedown",this._boundClick);window.removeEventListener("wheel",this._boundScroll);window.removeEventListener("contextmenu",this._boundContext);this._boundMove=null;this._boundClick=null;this._boundScroll=null;this._boundContext=null;}}
  handleMouseMove(e){this.lastX=e.clientX;this.lastY=e.clientY;this.onEvent({type:"mouse:move",x:e.clientX,y:e.clientY,timestamp:Date.now()});}
  handleMouseClick(e){const n=Date.now();const d=n-this.lastClickTime<300;if(d){this.clickCount++;}else{this.clickCount=1;}this.lastClickTime=n;if(this.clickCountTimeout)clearTimeout(this.clickCountTimeout);this.clickCountTimeout=setTimeout(()=>{this.clickCount=0;},300);const m={0:"left",1:"middle",2:"right"};this.onEvent({type:"mouse:click",x:e.clientX,y:e.clientY,button:m[e.button]||"left",clickCount:this.clickCount,timestamp:n});}
  handleScroll(e){this.onEvent({type:"scroll",x:e.clientX,y:e.clientY,deltaY:e.deltaY,deltaX:e.deltaX,timestamp:Date.now()});}
  destroy(){this.stop();if(this.clickCountTimeout)clearTimeout(this.clickCountTimeout);}
}

class RemoteControlKeyboardTracker {
  constructor(onEvent){this.onEvent=onEvent;this._boundKey=null;}
  start(){if(this._boundKey)return;this._boundKey=this.handleKeyDown.bind(this);window.addEventListener("keydown",this._boundKey);}
  stop(){if(this._boundKey){window.removeEventListener("keydown",this._boundKey);this._boundKey=null;}}
  handleKeyDown(e){if(["Control","Shift","Alt","Meta"].includes(e.key))return;this.onEvent({type:"key:press",code:e.code,key:e.key,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,altKey:e.altKey,timestamp:Date.now()});}
  destroy(){this.stop();}
}

class RemoteControlEventSimulator {
  constructor(){this.lastMouseX=0;this.lastMouseY=0;this.cursorElement=null;this.createRemoteCursor();}
  createRemoteCursor(){this.cursorElement=document.createElement("div");this.cursorElement.id="remote-control-cursor";this.cursorElement.style.cssText="position:fixed;width:20px;height:20px;border:2px solid #4f46e5;border-radius:50%;pointer-events:none;z-index:10000;display:none;background:rgba(79,70,229,0.1);box-shadow:0 0 6px rgba(79,70,229,0.5);transition:transform 0.05s linear;";document.body.appendChild(this.cursorElement);}
  showRemoteCursor(){if(this.cursorElement)this.cursorElement.style.display="block";}
  hideRemoteCursor(){if(this.cursorElement)this.cursorElement.style.display="none";}
  simulateMouseMove(x,y){this.lastMouseX=x;this.lastMouseY=y;if(this.cursorElement)this.cursorElement.style.transform=`translate(${x-10}px,${y-10}px)`;}
  simulateMouseClick(x,y,button){const e=document.elementFromPoint(x,y);if(!e)return;const b=button==="left"?0:button==="middle"?1:2;e.dispatchEvent(new MouseEvent("mousedown",{bubbles:true,cancelable:true,clientX:x,clientY:y,button:b}));e.dispatchEvent(new MouseEvent("mouseup",{bubbles:true,cancelable:true,clientX:x,clientY:y,button:b}));e.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,clientX:x,clientY:y,button:b}));}
  simulateKeyPress(code,key,ctrlKey,shiftKey,altKey){const e=document.activeElement||document.body;const o={bubbles:true,cancelable:true,code,key,ctrlKey,shiftKey,altKey};e.dispatchEvent(new KeyboardEvent("keydown",o));e.dispatchEvent(new KeyboardEvent("keyup",o));}
  simulateScroll(x,y,deltaY,deltaX){const e=document.elementFromPoint(x,y);if(!e)return;e.dispatchEvent(new WheelEvent("wheel",{bubbles:true,cancelable:true,clientX:x,clientY:y,deltaY,deltaX,deltaZ:0}));}
  simulateEvent(event){switch(event.type){case"mouse:move":this.simulateMouseMove(event.x,event.y);break;case"mouse:click":this.simulateMouseClick(event.x,event.y,event.button);break;case"key:press":this.simulateKeyPress(event.code,event.key,event.ctrlKey,event.shiftKey,event.altKey);break;case"scroll":this.simulateScroll(event.x,event.y,event.deltaY,event.deltaX);break;}}
  destroy(){if(this.cursorElement)this.cursorElement.remove();this.cursorElement=null;}
}
/* --- End inlined RemoteControl --- */


const root = document.getElementById('app');
const PAGE_KEY = 'infovibex-meet-dashboard-page';
const NAME_KEY = 'infovibex-meet-display-name';
const PID_KEY = 'infovibex-meet-participant-id';
const PROFILE_KEY = 'infovibex-meet-profile-id';
const SCREEN_QUALITY_KEY = 'infovibex-meet-screen-quality';
const MAX_FILES = 5;
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024 * 1024;
const SCREEN_UNPUBLISH_DELAY_MS = 12000;
const DASHBOARD_PAGES = ['home', 'upcoming', 'previous', 'recordings', 'personal'];
const SCREEN_SHARE_QUALITIES = {
  '4k': {
    label: '4K 2160p',
    width: 3840,
    height: 2160,
    frameRate: { ideal: 30, max: 30 }
  },
  '1440p': {
    label: '2K 1440p',
    width: 2560,
    height: 1440,
    frameRate: { ideal: 30, max: 30 }
  },
  hd: {
    label: 'HD 1080p',
    width: 1920,
    height: 1080,
    frameRate: { ideal: 30, max: 30 }
  },
  '720p': {
    label: '720p',
    width: 1280,
    height: 720,
    frameRate: { ideal: 30, max: 30 }
  }
};
const SCREEN_SHARE_ENCODINGS = {
  '4k': {
    maxBitrate: 25_000_000,
    maxFramerate: 30
  },
  '1440p': {
    maxBitrate: 15_000_000,
    maxFramerate: 30
  },
  hd: {
    maxBitrate: 10_000_000,
    maxFramerate: 30
  },
  '720p': {
    maxBitrate: 5_000_000,
    maxFramerate: 30
  }
};
const CAMERA_CAPTURE_CONSTRAINTS = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30, max: 30 }
};
const CAMERA_PUBLISH_ENCODING = {
  maxBitrate: 3_000_000,
  maxFramerate: 30
};
const RECORDING_MIME_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const RECORDING_CANVAS_WIDTH = 1280;
const RECORDING_CANVAS_HEIGHT = 720;
const RECORDING_FRAME_RATE = 12;

function randomId(prefix = 'u') {
  const value = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${String(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)}`;
}

function getProfileId() {
  let profileId = localStorage.getItem(PROFILE_KEY);
  if (!profileId) {
    profileId = randomId('u');
    localStorage.setItem(PROFILE_KEY, profileId);
  }
  return profileId;
}

function normalizeDashboardPage(value) {
  return DASHBOARD_PAGES.includes(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'home';
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function toDateTimeLocalValue(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function dateTimeLocalToIso(value, fallback = '') {
  const parsed = new Date(value || '');
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

function defaultScheduleDate() {
  return toDateTimeLocalValue(addMinutes(new Date(), 30).toISOString());
}

function currentMeeting() {
  return state.meeting || state.prejoinMeeting || null;
}

function normalizeScreenShareQuality(value) {
  const v = String(value || '').toLowerCase();
  if (v === '4k') return '4k';
  if (v === '1440p') return '1440p';
  if (v === '720p') return '720p';
  return 'hd';
}

function currentScreenSharePreset() {
  return SCREEN_SHARE_QUALITIES[normalizeScreenShareQuality(state.screenShareQuality)] || SCREEN_SHARE_QUALITIES.hd;
}

function currentScreenShareEncoding() {
  return SCREEN_SHARE_ENCODINGS[normalizeScreenShareQuality(state.screenShareQuality)] || SCREEN_SHARE_ENCODINGS.hd;
}

function cloneCameraVideoConstraints() {
  return {
    width: { ...CAMERA_CAPTURE_CONSTRAINTS.width },
    height: { ...CAMERA_CAPTURE_CONSTRAINTS.height },
    frameRate: { ...CAMERA_CAPTURE_CONSTRAINTS.frameRate }
  };
}

function applyTrackContentHint(track, hint) {
  if (!track || !hint) {
    return;
  }

  try {
    track.contentHint = hint;
  } catch {}
}

function screenShareVideoConstraints() {
  const preset = currentScreenSharePreset();
  return {
    width: { ideal: preset.width, max: preset.width },
    height: { ideal: preset.height, max: preset.height },
    frameRate: { ...preset.frameRate }
  };
}

function chooseRecordingMimeType() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }
  return RECORDING_MIME_TYPES.find((value) => window.MediaRecorder.isTypeSupported?.(value)) || '';
}

function formatDurationLabel(durationMs) {
  const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function recordingStatusLabel() {
  if (state.recordingStatus === 'starting') {
    return 'Preparing recording';
  }
  if (state.recordingStatus === 'recording') {
    return 'Recording live';
  }
  if (state.recordingStatus === 'saving') {
    return 'Saving recording';
  }
  if (state.recordingStatus === 'uploading') {
    return 'Uploading recording';
  }
  return '';
}

function recordingButtonLabel() {
  if (state.recordingStatus === 'starting') {
    return 'Preparing';
  }
  if (state.recordingStatus === 'recording') {
    return formatDurationLabel(recordingDurationMs());
  }
  if (state.recordingStatus === 'saving') {
    return 'Saving';
  }
  if (state.recordingStatus === 'requesting') {
    return 'Asking host...';
  }
  if (state.recordingStatus === 'uploading') {
    return 'Uploading';
  }
  return 'Record';
}

function recordingButtonDisabled() {
  if (state.recordingStatus === 'requesting') return true;
  return !['idle', 'recording'].includes(state.recordingStatus);
}

function recordingDurationMs() {
  return state.recordingStartedAt ? Math.max(0, Date.now() - state.recordingStartedAt) : 0;
}

function formatPrejoinConnectionError(error, livekitUrl = '') {
  const rawMessage = String(error?.message || error || '').trim();
  const safeUrl = String(livekitUrl || '').trim();

  if (/could not establish signal connection|failed to fetch/i.test(rawMessage)) {
    return safeUrl
      ? `Could not establish LiveKit signal server connection to ${safeUrl}.`
      : 'Could not establish the LiveKit signal server connection.';
  }

  if (/livekit is not configured/i.test(rawMessage)) {
    return 'LiveKit is not configured on the server.';
  }

  return rawMessage || 'Connection failed';
}

function inviteUrl(meetingId = state.meetingId || getBaseRoomId(state.roomId), roomId = '') {
  if (state.clientMeetingJoinUrl) {
    return state.clientMeetingJoinUrl;
  }

  const baseMeetingId = normalizeRoomId(meetingId || 'main-room');
  const targetRoomId = normalizeRoomId(roomId || baseMeetingId);
  const query = targetRoomId !== baseMeetingId ? `?room=${encodeURIComponent(targetRoomId)}` : '';
  return `${window.location.origin}/meeting/${baseMeetingId}${query}`;
}

function parseEmbeddedRoomsParam(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((room, index) => {
        const id = normalizeRoomId(room?.physicalRoomId || room?.roomId || room?.id || '');

        if (!id) {
          return null;
        }

        const label = String(room?.roomName || room?.label || (index === 0 ? 'Main room' : `Room ${index + 1}`)).trim() || (index === 0 ? 'Main room' : `Room ${index + 1}`);
        const isMainRoom = Boolean(room?.isMainRoom || index === 0);

        return {
          id,
          label,
          description: isMainRoom ? 'Return here for the full group conversation' : `Open ${label}`,
          badge: isMainRoom ? 'Main session' : 'Breakout room'
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeParentOrigin(value) {
  try {
    return value ? new URL(value).origin : '';
  } catch {
    return '';
  }
}

function parseRouteConfig(url) {
  const customRooms = parseEmbeddedRoomsParam(url.searchParams.get('rooms'));
  const requestedBreakoutCount = Number(url.searchParams.get('breakoutCount') || 50);
  return {
    autoJoin: url.searchParams.get('autoJoin') === '1',
    breakoutCount: customRooms.length ? Math.max(customRooms.length - 1, 0) : normalizeBreakoutRoomCount(requestedBreakoutCount, 50),
    clientActivityUrl: String(url.searchParams.get('clientActivityUrl') || '').trim(),
    clientMeetingHostProfileId: String(url.searchParams.get('clientMeetingHostProfileId') || '').trim(),
    clientMeetingJoinUrl: String(url.searchParams.get('clientMeetingJoinUrl') || '').trim(),
    clientMeetingRole: String(url.searchParams.get('clientMeetingRole') || '').trim(),
    clientMeetingTenantId: String(url.searchParams.get('clientMeetingTenantId') || '').trim(),
    clientMeetingToken: String(url.searchParams.get('clientMeetingToken') || '').trim(),
    closeOnLeave: url.searchParams.get('closeOnLeave') === '1',
    customRooms,
    disableEndMeeting: url.searchParams.get('disableEndMeeting') === '1',
    desktopShell: url.searchParams.get('desktopShell') === '1',
    displayName: normalizeName(url.searchParams.get('name') || ''),
    embed: url.searchParams.get('embed') === '1',
    meetingStartsAt: String(url.searchParams.get('meetingStartsAt') || '').trim(),
    meetingTitle: String(url.searchParams.get('meetingTitle') || '').trim(),
    meetingType: String(url.searchParams.get('meetingType') || '').trim(),
    parentOrigin: normalizeParentOrigin(url.searchParams.get('parentOrigin') || ''),
    participantId: String(url.searchParams.get('participantId') || '').trim(),
    profileId: String(url.searchParams.get('profileId') || '').trim(),
    rawUserId: String(url.searchParams.get('rawUserId') || '').trim()
  };
}

function parseLocationRoute() {
  const url = new URL(window.location.href);
  const pathname = url.pathname || '/';

  if (pathname.startsWith('/meeting/')) {
    const meetingId = normalizeRoomId(pathname.slice('/meeting/'.length));
    const roomParam = url.searchParams.get('room');
    const roomId = roomParam ? normalizeRoomId(roomParam) : meetingId;
    return {
      config: parseRouteConfig(url),
      kind: 'prejoin',
      meetingId,
      roomId
    };
  }

  if (pathname.startsWith('/room/')) {
    const roomId = normalizeRoomId(pathname.slice('/room/'.length));
    return {
      config: parseRouteConfig(url),
      kind: 'prejoin',
      meetingId: getBaseRoomId(roomId),
      roomId
    };
  }

  return {
    kind: 'dashboard',
    page: normalizeDashboardPage(localStorage.getItem(PAGE_KEY) || 'home')
  };
}

function parseJoinTarget(input) {
  const value = String(input || '').trim();
  if (!value) {
    return null;
  }

  try {
    const parsedUrl = new URL(value, window.location.origin);
    if (parsedUrl.pathname.startsWith('/meeting/')) {
      const meetingId = normalizeRoomId(parsedUrl.pathname.slice('/meeting/'.length));
      const roomId = parsedUrl.searchParams.get('room') ? normalizeRoomId(parsedUrl.searchParams.get('room')) : meetingId;
      return { meetingId, roomId };
    }
    if (parsedUrl.pathname.startsWith('/room/')) {
      const roomId = normalizeRoomId(parsedUrl.pathname.slice('/room/'.length));
      return { meetingId: getBaseRoomId(roomId), roomId };
    }
  } catch {}

  const normalized = normalizeRoomId(value.split(/[/?#]/)[0]);
  return {
    meetingId: getBaseRoomId(normalized),
    roomId: normalized
  };
}

const state = {
  view: 'dashboard',
  dashboardPage: normalizeDashboardPage(localStorage.getItem(PAGE_KEY) || 'home'),
  roomId: '',
  meetingId: '',
  displayName: normalizeName(localStorage.getItem(NAME_KEY) || ''),
  profileId: getProfileId(),
  breakoutRoomCount: 50,
  participantId: getParticipantId(PID_KEY),
  rawUserId: '',
  participants: new Map(),
  messages: [],
  pendingFiles: [],
  attachmentUrls: new Map(),
  chatSending: false,
  sidebarMode: null,
  connectionStatus: 'Offline',
  isAudioEnabled: false,
  isVideoEnabled: false,
  isHandRaised: false,
  screenStatus: 'off',
  screenShareQuality: normalizeScreenShareQuality(localStorage.getItem(SCREEN_QUALITY_KEY) || 'hd'),
  selectedScreenParticipantId: null,
  socket: null,
  sdk: null,
  room: null,
  micTrack: null,
  cameraTrack: null,
  screenTrack: null,
  micPublication: null,
  cameraPublication: null,
  screenPublication: null,
  screenSyncing: false,
  screenSyncQueued: false,
  screenTimer: null,
  settingsOpen: false,
  recordingStatus: 'idle',
  recordingRequestId: '',
  recordingGranted: false,
  recordingRequestFrom: null,
  recordingStartedAt: 0,
  recordingMimeType: '',
  recordingChunks: [],
  recordingCaptureStream: null,
  recordingStream: null,
  recordingMediaRecorder: null,
  recordingAudioContext: null,
  recordingAudioDestination: null,
  recordingAudioNodes: [],
  recordingCanvas: null,
  recordingCanvasContext: null,
  recordingRenderTimer: null,
  recordingVideoElements: new Map(),
  ui: {},
  dashboardLoading: false,
  dashboardError: '',
  dashboardData: {
    owned: [],
    upcoming: [],
    previous: [],
    recordings: [],
    personal: []
  },
  personalRoom: null,
  scheduleDraft: {
    title: '',
    description: '',
    startsAt: defaultScheduleDate(),
    breakoutRoomCount: 50
  },
  joinCode: '',
  prejoinMeeting: null,
  prejoinRoomId: '',
  prejoinJoinBlock: null,
  prejoinError: '',
  prejoinBusy: false,
  lastLiveKitUrl: '',
  clientActivityUrl: '',
  clientMeetingTenantId: '',
  clientMeetingToken: '',
  clientMeetingRole: '',
  clientMeetingHostProfileId: '',
  clientMeetingJoinUrl: '',
  clientMeetingAttendanceActive: false,
  clientMeetingScreenShareActive: false,
  meeting: null,
  meetingConfig: null,
  meetingLayout: 'spotlight',
  isHost: false,
  parentOrigin: '',
  customRooms: [],
  routeMeetingStartsAt: '',
  routeMeetingTitle: '',
  routeMeetingType: '',
  isEmbedded: false,
  bypassPrejoin: false,
  routeAutoJoin: false,
  desktopShell: false,
  closeOnLeave: false,
  disableEndMeeting: false,
  crossRoomParticipants: new Map(),
  pendingJoinRequests: [],
  expandedBreakoutRooms: new Set(),
  breakoutExpansionInitialized: false,
  remoteControl: {
    session: null,
    dataTrack: null,
    tracker: null,
    simulator: null
  }
};

function applyRouteConfig(config = {}) {
  if (config.displayName) {
    state.displayName = normalizeName(config.displayName || state.displayName || 'Guest');
    localStorage.setItem(NAME_KEY, state.displayName);
  }

  if (config.participantId) {
    state.participantId = String(config.participantId).trim();
    localStorage.setItem(PID_KEY, state.participantId);
  }

  if (config.profileId) {
    state.profileId = String(config.profileId).trim();
    localStorage.setItem(PROFILE_KEY, state.profileId);
  }

  if (config.rawUserId) {
    state.rawUserId = String(config.rawUserId).trim();
  }

  state.parentOrigin = String(config.parentOrigin || '');
  state.clientActivityUrl = String(config.clientActivityUrl || '');
  state.clientMeetingTenantId = String(config.clientMeetingTenantId || '');
  state.clientMeetingToken = String(config.clientMeetingToken || '');
  state.clientMeetingRole = String(config.clientMeetingRole || '');
  state.clientMeetingHostProfileId = String(config.clientMeetingHostProfileId || '');
  state.clientMeetingJoinUrl = String(config.clientMeetingJoinUrl || '');
  state.clientMeetingAttendanceActive = false;
  state.clientMeetingScreenShareActive = false;
  state.routeMeetingStartsAt = String(config.meetingStartsAt || '');
  state.routeMeetingTitle = String(config.meetingTitle || '');
  state.routeMeetingType = String(config.meetingType || '');
  state.isEmbedded = Boolean(config.embed);
  state.routeAutoJoin = Boolean(config.autoJoin);
  state.bypassPrejoin = state.routeAutoJoin;
  state.customRooms = Array.isArray(config.customRooms) ? config.customRooms : [];
  state.breakoutRoomCount = normalizeBreakoutRoomCount(config.breakoutCount, state.breakoutRoomCount);
  state.closeOnLeave = Boolean(config.closeOnLeave);
  state.disableEndMeeting = Boolean(config.disableEndMeeting);
  state.desktopShell = Boolean(config.desktopShell);
}

function postParentEvent(type, payload = {}) {
  if (typeof window === 'undefined' || window.parent === window) {
    return;
  }

  try {
    window.parent.postMessage({
      source: 'infovibe-meet',
      type,
      roomId: state.roomId,
      ...payload
    }, state.parentOrigin || '*');
  } catch {}
}

function postRecordingState() {
  if (!state.desktopShell) {
    return;
  }

  postParentEvent('recording-state', {
    isHost: state.isHost
  });
}

function hasClientMeetingActivityConfig() {
  return Boolean(state.clientActivityUrl && state.clientMeetingTenantId && state.clientMeetingToken);
}

async function postClientMeetingActivity(action, options = {}) {
  if (!hasClientMeetingActivityConfig()) {
    return;
  }

  const keepalive = Boolean(options.keepalive);
  const roomId = normalizeRoomId(options.roomId || state.roomId || state.prejoinRoomId || state.meetingId || 'main-room');

  try {
    await fetch(state.clientActivityUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      keepalive,
      body: JSON.stringify({
        action,
        displayName: state.displayName,
        participantId: state.participantId,
        room: roomId,
        tenantId: state.clientMeetingTenantId,
        timestamp: new Date().toISOString(),
        token: state.clientMeetingToken
      })
    });
  } catch {}
}

function markClientMeetingJoined(roomId = state.roomId) {
  if (!hasClientMeetingActivityConfig() || state.clientMeetingAttendanceActive) {
    return;
  }

  state.clientMeetingAttendanceActive = true;
  void postClientMeetingActivity('join', { roomId });
}

function markClientMeetingScreenShareStarted(roomId = state.roomId) {
  if (!hasClientMeetingActivityConfig() || state.clientMeetingScreenShareActive) {
    return;
  }

  state.clientMeetingScreenShareActive = true;
  void postClientMeetingActivity('screen-share-start', { roomId });
}

function closeClientMeetingActivity(keepalive = false, roomId = state.roomId) {
  if (!hasClientMeetingActivityConfig()) {
    return;
  }

  if (state.clientMeetingScreenShareActive) {
    state.clientMeetingScreenShareActive = false;
    void postClientMeetingActivity('screen-share-stop', { keepalive, roomId });
  }

  if (state.clientMeetingAttendanceActive) {
    state.clientMeetingAttendanceActive = false;
    void postClientMeetingActivity('leave', { keepalive, roomId });
  }
}

function releaseAttachmentUrls() {
  for (const url of state.attachmentUrls.values()) {
    URL.revokeObjectURL(url);
  }
  state.attachmentUrls = new Map();
}

function resetEphemeralChatState() {
  releaseAttachmentUrls();
  state.messages = [];
  state.pendingFiles = [];
  state.chatSending = false;
}

function sortedParticipants() {
  return Array.from(state.participants.values()).sort((left, right) => left.joinedAt - right.joinedAt);
}

function screenParticipants() {
  return sortedParticipants().filter((participant) => participant.screenStatus && participant.screenStatus !== 'off');
}

function localParticipant() {
  return state.participants.get(state.participantId) || {
    id: state.participantId,
    profileId: state.profileId,
    name: state.displayName,
    joinedAt: Date.now(),
    screenWatcherCount: 0,
    screenStatus: state.screenStatus
  };
}

function participantLabel(participant) {
  return participant.id === state.participantId ? `${participant.name} (You)` : participant.name;
}

function participantPayload() {
  return {
    roomId: state.roomId,
    participantId: state.participantId,
    profileId: state.profileId,
    name: state.displayName,
    isAudioEnabled: state.isAudioEnabled,
    isVideoEnabled: state.isVideoEnabled,
    isHandRaised: state.isHandRaised,
    screenStatus: state.screenStatus
  };
}

function joinPayload() {
  const meeting = currentMeeting();
  return {
    ...participantPayload(),
    clientMeetingHostProfileId: state.clientMeetingHostProfileId,
    clientMeetingRole: state.clientMeetingRole,
    clientMeetingTenantId: state.clientMeetingTenantId,
    clientMeetingToken: state.clientMeetingToken,
    meetingId: state.meetingId || meeting?.id || getBaseRoomId(state.roomId),
    meetingType: meeting?.type || state.routeMeetingType || 'instant',
    meetingTitle: meeting?.title || state.routeMeetingTitle || '',
    meetingDescription: meeting?.description || '',
    meetingStartsAt: meeting?.startsAt || state.routeMeetingStartsAt || '',
    breakoutRoomCount: state.customRooms.length
      ? Math.max(state.customRooms.length - 1, 0)
      : normalizeBreakoutRoomCount(meeting?.breakoutRoomCount || state.breakoutRoomCount, 50)
  };
}

function setScreenShareQuality(value) {
  state.screenShareQuality = normalizeScreenShareQuality(value);
  localStorage.setItem(SCREEN_QUALITY_KEY, state.screenShareQuality);
  if (state.ui.screenQualitySelect) {
    state.ui.screenQualitySelect.value = state.screenShareQuality;
  }
  if (state.view === 'meeting') {
    renderMeeting();
  }
}

function openSettings() {
  state.settingsOpen = true;
  renderMeeting();
}

function closeSettings() {
  state.settingsOpen = false;
  renderMeeting();
}

function disconnectRecordingAudioNodes() {
  for (const entry of state.recordingAudioNodes) {
    try {
      entry.source.disconnect();
    } catch {}
    try {
      entry.gain.disconnect();
    } catch {}
  }
  state.recordingAudioNodes = [];
}

function recordingAudioTracks() {
  const tracks = [];
  if (state.micTrack && state.isAudioEnabled && state.micTrack.readyState === 'live') {
    tracks.push(state.micTrack);
  }
  const source = state.sdk?.Track?.Source;
  if (!source || !state.room) {
    return tracks;
  }
  for (const participant of state.room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      const isMeetingAudio = publication.source === source.Microphone || publication.source === source.ScreenShareAudio;
      const mediaStreamTrack = isMeetingAudio && !publication.isMuted
        ? publication.track?.mediaStreamTrack
        : null;
      if (mediaStreamTrack && mediaStreamTrack.readyState === 'live') {
        tracks.push(mediaStreamTrack);
      }
    }
  }
  return tracks;
}

function refreshRecordingAudioGraph() {
  if (!state.recordingAudioContext || !state.recordingAudioDestination) {
    return;
  }
  disconnectRecordingAudioNodes();
  for (const track of recordingAudioTracks()) {
    try {
      const sourceNode = state.recordingAudioContext.createMediaStreamSource(new MediaStream([track]));
      const gainNode = state.recordingAudioContext.createGain();
      gainNode.gain.value = 1;
      sourceNode.connect(gainNode);
      gainNode.connect(state.recordingAudioDestination);
      state.recordingAudioNodes.push({
        gain: gainNode,
        source: sourceNode
      });
    } catch {}
  }
}

async function disposeRecordingResources() {
  disconnectRecordingAudioNodes();
  clearInterval(state.recordingRenderTimer);
  state.recordingRenderTimer = null;
  for (const element of state.recordingVideoElements.values()) {
    try {
      element.pause();
    } catch {}
    element.srcObject = null;
  }
  state.recordingVideoElements = new Map();
  for (const track of state.recordingStream?.getTracks() || []) {
    stopTrack(track);
  }
  for (const track of state.recordingCaptureStream?.getTracks() || []) {
    stopTrack(track);
  }
  if (state.recordingAudioContext) {
    await state.recordingAudioContext.close().catch(() => {});
  }
  state.recordingCaptureStream = null;
  state.recordingStream = null;
  state.recordingMediaRecorder = null;
  state.recordingAudioContext = null;
  state.recordingAudioDestination = null;
  state.recordingCanvas = null;
  state.recordingCanvasContext = null;
}

function findRemoteParticipant(participantId) {
  if (!state.room || !participantId) {
    return null;
  }

  return Array.from(state.room.remoteParticipants.values()).find((participant) => participant.identity === participantId) || null;
}

function findRemoteMediaTrack(participantId, sourceType) {
  const remoteParticipant = findRemoteParticipant(participantId);

  if (!remoteParticipant) {
    return null;
  }

  for (const publication of remoteParticipant.trackPublications.values()) {
    if (publication.source !== sourceType) {
      continue;
    }

    const track = publication.track?.mediaStreamTrack || null;

    if (track && track.readyState === 'live') {
      return track;
    }
  }

  return null;
}

function participantCameraTrack(participantId) {
  const source = state.sdk?.Track?.Source;

  if (!source) {
    return null;
  }

  if (participantId === state.participantId) {
    return state.cameraTrack && state.isVideoEnabled && state.cameraTrack.readyState === 'live'
      ? state.cameraTrack
      : null;
  }

  return findRemoteMediaTrack(participantId, source.Camera);
}

function participantScreenTrack(participantId) {
  const source = state.sdk?.Track?.Source;

  if (!source) {
    return null;
  }

  if (participantId === state.participantId) {
    return state.screenTrack && state.screenStatus === 'live' && state.screenTrack.readyState === 'live'
      ? state.screenTrack
      : null;
  }

  return findRemoteMediaTrack(participantId, source.ScreenShare);
}

function recordingFocusParticipantId() {
  const selectedParticipant = state.selectedScreenParticipantId ? state.participants.get(state.selectedScreenParticipantId) : null;

  if (selectedParticipant?.screenStatus === 'live') {
    return selectedParticipant.id;
  }

  return screenParticipants().find((participant) => participant.screenStatus === 'live')?.id || '';
}

function ensureRecordingVideoElement(key, track) {
  if (!track) {
    return null;
  }

  if (!(state.recordingVideoElements instanceof Map)) {
    state.recordingVideoElements = new Map();
  }

  const entryKey = `${key}:${track.id}`;
  const existing = state.recordingVideoElements.get(entryKey);

  if (existing) {
    return existing;
  }

  for (const [currentKey, element] of Array.from(state.recordingVideoElements.entries())) {
    if (!currentKey.startsWith(`${key}:`) || currentKey === entryKey) {
      continue;
    }

    try {
      element.pause();
    } catch {}
    element.srcObject = null;
    state.recordingVideoElements.delete(currentKey);
  }

  const element = document.createElement('video');
  element.autoplay = true;
  element.playsInline = true;
  element.muted = true;
  element.srcObject = new MediaStream([track]);
  void element.play().catch(() => {});
  state.recordingVideoElements.set(entryKey, element);
  return element;
}

function drawRecordingVideo(context, element, x, y, width, height, fit = 'cover') {
  if (!(element instanceof HTMLVideoElement) || element.readyState < 2) {
    return false;
  }

  const sourceWidth = Math.max(1, element.videoWidth || width);
  const sourceHeight = Math.max(1, element.videoHeight || height);

  if (fit === 'contain') {
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const offsetX = x + ((width - drawWidth) / 2);
    const offsetY = y + ((height - drawHeight) / 2);
    context.drawImage(element, offsetX, offsetY, drawWidth, drawHeight);
    return true;
  }

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const sourceX = Math.max(0, (sourceWidth - cropWidth) / 2);
  const sourceY = Math.max(0, (sourceHeight - cropHeight) / 2);
  context.drawImage(element, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height);
  return true;
}

function recordingCanvasLabel(value, fallback = 'Guest') {
  return String(value || fallback).trim() || fallback;
}

function drawRecordingPlaceholder(context, x, y, width, height, title, subtitle) {
  const displayTitle = recordingCanvasLabel(title);
  const displaySubtitle = String(subtitle || '');
  const avatarSize = Math.max(72, Math.min(width, height) * 0.18);
  const centerX = x + (width / 2);
  const centerY = y + (height / 2);

  context.fillStyle = '#0b1020';
  context.fillRect(x, y, width, height);
  context.fillStyle = 'rgba(79, 124, 255, 0.28)';
  context.beginPath();
  context.arc(centerX, centerY - 40, avatarSize / 2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = `700 ${Math.max(28, avatarSize * 0.34)}px Inter, Arial, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(getInitials(displayTitle), centerX, centerY - 40);
  context.font = '600 30px Inter, Arial, sans-serif';
  context.fillText(displayTitle, centerX, centerY + 34);
  context.fillStyle = 'rgba(222, 232, 255, 0.72)';
  context.font = '400 18px Inter, Arial, sans-serif';
  context.fillText(displaySubtitle, centerX, centerY + 68);
}

function drawRecordingTile(context, participant, x, y, width, height) {
  const label = recordingCanvasLabel(participantLabel(participant), participant.name || 'Guest');
  const cameraTrack = participantCameraTrack(participant.id);
  const element = cameraTrack ? ensureRecordingVideoElement(`camera:${participant.id}`, cameraTrack) : null;

  context.fillStyle = '#050608';
  context.fillRect(x, y, width, height);

  if (!drawRecordingVideo(context, element, x, y, width, height, 'cover')) {
    drawRecordingPlaceholder(context, x, y, width, height, label, participant.isVideoEnabled ? 'Camera starting' : 'Camera is off');
  }

  context.fillStyle = 'rgba(8, 10, 14, 0.72)';
  context.fillRect(x, y + height - 52, width, 52);
  context.fillStyle = '#ffffff';
  context.font = '600 18px Inter, Arial, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(label, x + 16, y + height - 26);
 }

 function recordingShellSidebarMode() {
  if (state.settingsOpen) {
    return 'settings';
  }

  return state.sidebarMode || '';
 }

 function recordingTruncate(value, maxLength = 48) {
  const text = String(value || '').trim();

  if (!text) {
    return '';
  }

  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
 }

 function drawRecordingScreenArea(context, participant, x, y, width, height) {
  const label = recordingCanvasLabel(participant?.name, 'Participant');
  const screenTrack = participant ? participantScreenTrack(participant.id) : null;
  const element = screenTrack ? ensureRecordingVideoElement(`screen:${participant.id}`, screenTrack) : null;
  const title = participant ? `${label}'s screen` : 'Meeting screen';

  context.fillStyle = '#050608';
  context.fillRect(x, y, width, height);

  if (!drawRecordingVideo(context, element, x, y, width, height, 'contain')) {
    drawRecordingPlaceholder(context, x, y, width, height, title, 'Waiting for screen share');
  }

  const badgeWidth = Math.min(340, Math.max(170, (Math.min(34, title.length) * 8) + 44));
  context.fillStyle = 'rgba(8, 10, 14, 0.72)';
  context.fillRect(x + 16, y + 16, badgeWidth, 42);
  context.fillStyle = '#ffffff';
  context.font = '600 18px Inter, Arial, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(recordingTruncate(title, 34), x + 30, y + 37);
 }

 function drawRecordingScreen(context, participant) {
  drawRecordingScreenArea(context, participant, 0, 0, RECORDING_CANVAS_WIDTH, RECORDING_CANVAS_HEIGHT);
 }

 function recordingParticipantChips(participant) {
  const chips = [];

  if (participant?.isAudioEnabled) {
    chips.push('Mic');
  }
  if (participant?.isVideoEnabled) {
    chips.push('Cam');
  }
  if (participant?.screenStatus === 'live') {
    chips.push('Sharing');
  }
  if (participant?.isHandRaised) {
    chips.push('Hand');
  }

  return chips.join(' | ') || 'Listening';
 }

 function drawRecordingShellHeader(context) {
  const meeting = currentMeeting();
  const title = recordingTruncate(meeting?.title || state.roomId || 'Meeting', 42);
  const roomText = recordingTruncate(state.roomId || meeting?.roomId || 'main-room', 28);
  const participantCount = `${Math.max(1, state.participants.size)} participant${Math.max(1, state.participants.size) === 1 ? '' : 's'}`;

  context.fillStyle = '#0d1320';
  context.fillRect(0, 0, RECORDING_CANVAS_WIDTH, 72);

  context.fillStyle = 'rgba(255, 255, 255, 0.08)';
  context.fillRect(20, 18, 132, 36);
  context.fillStyle = '#f8fbff';
  context.font = '700 14px Inter, Arial, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText('INFOVIBEX MEET', 32, 36);

  context.font = '700 20px Inter, Arial, sans-serif';
  context.fillText(title, 172, 30);
  context.fillStyle = 'rgba(222, 232, 255, 0.72)';
  context.font = '400 13px Inter, Arial, sans-serif';
  context.fillText(roomText, 172, 50);

  const connectionText = recordingTruncate(compactConnectionStatus(state.connectionStatus || 'Offline'), 20);
  const rightInfo = [`${participantCount}`, connectionText].filter(Boolean);
  let pillX = RECORDING_CANVAS_WIDTH - 20;

  for (const value of rightInfo.reverse()) {
    const width = Math.max(104, Math.min(200, 20 + (value.length * 7)));
    pillX -= width;
    context.fillStyle = 'rgba(255, 255, 255, 0.08)';
    context.fillRect(pillX, 18, width, 36);
    context.fillStyle = '#f8fbff';
    context.font = '600 13px Inter, Arial, sans-serif';
    context.fillText(value, pillX + 14, 36);
    pillX -= 10;
  }
 }

 function drawRecordingSidebarRow(context, x, y, width, title, subtitle) {
  const avatarTitle = recordingCanvasLabel(title, 'Info');

  context.fillStyle = 'rgba(255, 255, 255, 0.05)';
  context.fillRect(x, y, width, 60);

  context.fillStyle = 'rgba(79, 124, 255, 0.24)';
  context.beginPath();
  context.arc(x + 22, y + 30, 16, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#ffffff';
  context.font = '700 13px Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(getInitials(avatarTitle), x + 22, y + 31);

  context.textAlign = 'left';
  context.fillStyle = '#f8fbff';
  context.font = '600 14px Inter, Arial, sans-serif';
  context.fillText(recordingTruncate(title, 28), x + 48, y + 22);

  context.fillStyle = 'rgba(222, 232, 255, 0.72)';
  context.font = '400 12px Inter, Arial, sans-serif';
  context.fillText(recordingTruncate(subtitle, 42), x + 48, y + 40);
 }

 function drawRecordingSidebar(context, x, y, width, height) {
  const mode = recordingShellSidebarMode();

  if (!mode) {
    return;
  }

  context.fillStyle = '#111827';
  context.fillRect(x, y, width, height);

  let title = 'Panel';
  let subtitle = '';
  let rows = [];

  if (mode === 'participants') {
    title = `Participants (${Math.max(1, state.participants.size)})`;
    subtitle = 'People in this room';
    rows = sortedParticipants().map((participant) => ({
      title: participantLabel(participant),
      subtitle: recordingParticipantChips(participant)
    }));
  } else if (mode === 'stats') {
    title = 'Call stats';
    subtitle = 'Connection and layout overview';
    rows = callStatsItems().map((item) => ({
      title: item.label,
      subtitle: item.value
    }));
  } else if (mode === 'settings') {
    title = 'Meeting settings';
    subtitle = 'Current meeting preferences';
    rows = [
      { title: 'Screen share quality', subtitle: currentScreenSharePreset().label },
      { title: 'Layout', subtitle: state.meetingLayout === 'grid' ? 'Gallery view' : 'Speaker view' },
      { title: 'Recording', subtitle: ['starting', 'recording'].includes(state.recordingStatus) ? 'Recording in progress' : 'Ready to record' },
      { title: 'Breakout rooms', subtitle: breakoutRoomCountLabel(state.breakoutRoomCount) }
    ];
  } else {
    title = 'Room chat';
    subtitle = `Messages in ${state.roomId}`;
    rows = state.messages.map((message) => ({
      title: `${message.senderName || 'Guest'} ${new Date(message.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      subtitle: message.body || (Array.isArray(message.attachments) && message.attachments.length ? `${message.attachments.length} attachment${message.attachments.length === 1 ? '' : 's'}` : 'Message')
    }));
  }

  context.fillStyle = '#f8fbff';
  context.font = '700 18px Inter, Arial, sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(recordingTruncate(title, 26), x + 18, y + 24);

  context.fillStyle = 'rgba(222, 232, 255, 0.72)';
  context.font = '400 12px Inter, Arial, sans-serif';
  context.fillText(recordingTruncate(subtitle, 42), x + 18, y + 46);

  if (rows.length === 0) {
    drawRecordingPlaceholder(context, x + 18, y + 72, width - 36, height - 90, title, mode === 'chat' ? 'Chat is empty' : 'Nothing to show');
    return;
  }

  const rowHeight = 60;
  const rowGap = 10;
  const maxRows = Math.max(1, Math.floor((height - 92) / (rowHeight + rowGap)));
  const visibleRows = mode === 'chat' ? rows.slice(-maxRows) : rows.slice(0, maxRows);

  visibleRows.forEach((row, index) => {
    drawRecordingSidebarRow(context, x + 14, y + 70 + (index * (rowHeight + rowGap)), width - 28, row.title, row.subtitle);
  });
 }

 function drawRecordingStageArea(context, x, y, width, height) {
  const focusedParticipantId = recordingFocusParticipantId();
  const focusedParticipant = focusedParticipantId ? state.participants.get(focusedParticipantId) : null;

  context.fillStyle = '#050608';
  context.fillRect(x, y, width, height);

  if (focusedParticipant) {
    drawRecordingScreenArea(context, focusedParticipant, x, y, width, height);
    return;
  }

  const participants = sortedParticipants().slice(0, 4);

  if (participants.length === 0) {
    drawRecordingPlaceholder(context, x, y, width, height, state.displayName || 'Guest', 'Waiting for participants');
    return;
  }

  const columns = participants.length === 1 ? 1 : 2;
  const rows = Math.ceil(participants.length / columns);
  const gap = 12;
  const padding = 12;
  const tileWidth = (width - (padding * 2) - (gap * (columns - 1))) / columns;
  const tileHeight = (height - (padding * 2) - (gap * (rows - 1))) / rows;

  participants.forEach((participant, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawRecordingTile(
      context,
      participant,
      x + padding + (column * (tileWidth + gap)),
      y + padding + (row * (tileHeight + gap)),
      tileWidth,
      tileHeight
    );
  });
 }

 function drawRecordingToolbar(context) {
  const breakoutOpen = Boolean(state.ui.breakoutModal?.classList.contains('is-open'));
  const buttons = [
    { label: state.isAudioEnabled ? 'Mute' : 'Unmute', active: state.isAudioEnabled },
    { label: state.isVideoEnabled ? 'Stop Video' : 'Start Video', active: state.isVideoEnabled },
    { label: state.screenStatus === 'off' ? 'Share Screen' : 'Stop Share', active: state.screenStatus !== 'off' },
    { label: 'Participants', active: state.sidebarMode === 'participants' },
    { label: 'Chat', active: state.sidebarMode === 'chat' },
    { label: 'Stats', active: state.sidebarMode === 'stats' },
    { label: 'Settings', active: state.settingsOpen },
    { label: 'Breakouts', active: breakoutOpen },
    { label: 'Leave', active: false, danger: true }
  ];

  const barWidth = Math.min(RECORDING_CANVAS_WIDTH - 120, Math.max(780, buttons.length * 100));
  const barHeight = 60;
  const barX = (RECORDING_CANVAS_WIDTH - barWidth) / 2;
  const barY = RECORDING_CANVAS_HEIGHT - 78;
  const gap = 8;
  const padding = 12;
  const buttonWidth = (barWidth - (padding * 2) - (gap * (buttons.length - 1))) / buttons.length;

  context.fillStyle = 'rgba(5, 8, 14, 0.92)';
  context.fillRect(barX, barY, barWidth, barHeight);

  buttons.forEach((button, index) => {
    const x = barX + padding + (index * (buttonWidth + gap));
    context.fillStyle = button.danger
      ? 'rgba(139, 25, 41, 0.88)'
      : button.active
        ? 'rgba(79, 124, 255, 0.88)'
        : 'rgba(255, 255, 255, 0.08)';
    context.fillRect(x, barY + 10, buttonWidth, 40);
    context.fillStyle = '#ffffff';
    context.font = `600 ${button.label.length > 10 ? 11 : 12}px Inter, Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(recordingTruncate(button.label, 14), x + (buttonWidth / 2), barY + 30);
  });
 }

 function renderRecordingFrame() {
  const context = state.recordingCanvasContext;

  if (!context) {
    return;
  }

  context.clearRect(0, 0, RECORDING_CANVAS_WIDTH, RECORDING_CANVAS_HEIGHT);
  context.fillStyle = '#05070b';
  context.fillRect(0, 0, RECORDING_CANVAS_WIDTH, RECORDING_CANVAS_HEIGHT);

  drawRecordingShellHeader(context);

  const sidebarMode = recordingShellSidebarMode();
  const contentX = 20;
  const contentY = 88;
  const contentHeight = RECORDING_CANVAS_HEIGHT - 184;
  const sidebarWidth = sidebarMode ? 320 : 0;
  const gutter = sidebarMode ? 18 : 0;
  const stageWidth = RECORDING_CANVAS_WIDTH - (contentX * 2) - sidebarWidth - gutter;

  drawRecordingStageArea(context, contentX, contentY, stageWidth, contentHeight);

  if (sidebarMode) {
    drawRecordingSidebar(context, contentX + stageWidth + gutter, contentY, sidebarWidth, contentHeight);
  }

  drawRecordingToolbar(context);
 }

 function startRecordingVideoStream() {
  if (typeof HTMLCanvasElement === 'undefined') {
    throw new Error('Recording video is not supported in this browser');
  }

  const canvas = document.createElement('canvas');
  canvas.width = RECORDING_CANVAS_WIDTH;
  canvas.height = RECORDING_CANVAS_HEIGHT;
  const context = canvas.getContext('2d', { alpha: false });

  if (!context || typeof canvas.captureStream !== 'function') {
    throw new Error('Recording video is not supported in this browser');
  }

  state.recordingCanvas = canvas;
  state.recordingCanvasContext = context;
  renderRecordingFrame();
  state.recordingRenderTimer = setInterval(renderRecordingFrame, Math.max(80, Math.round(1000 / RECORDING_FRAME_RATE)));
  state.recordingCaptureStream = canvas.captureStream(RECORDING_FRAME_RATE);

  const videoTrack = state.recordingCaptureStream.getVideoTracks()[0] || null;

  if (!videoTrack) {
    throw new Error('Recording video track unavailable');
  }

  return videoTrack;
}
function syncLocalParticipantEntry() {
  const current = localParticipant();
  mergeParticipant({
    ...current,
    ...participantPayload(),
    id: state.participantId,
    joinedAt: current.joinedAt || Date.now(),
    screenWatcherCount: current.screenWatcherCount || 0,
    isScreenSharing: state.screenStatus === 'live'
  });
  if (state.roomId) {
    state.crossRoomParticipants = new Map(state.crossRoomParticipants);
    state.crossRoomParticipants.set(state.roomId, Array.from(state.participants.values()));
  }
}

function stageVideo(track, muted = true, className = 'zoom-video-surface') {
  const element = document.createElement('video');
  element.autoplay = true;
  element.playsInline = true;
  element.muted = muted;
  element.disablePictureInPicture = true;
  element.className = className;
  element.srcObject = new MediaStream([track]);
  queueMicrotask(() => {
    const playPromise = element.play?.();
    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  });
  return element;
}

function seedLocalParticipant() {
  state.participants = new Map([[state.participantId, {
    ...participantPayload(),
    id: state.participantId,
    joinedAt: Date.now(),
    screenWatcherCount: 0,
    isScreenSharing: state.screenStatus === 'live'
  }]]);
}

function setDisplayName(value) {
  state.displayName = normalizeName(value || state.displayName || 'Guest');
  localStorage.setItem(NAME_KEY, state.displayName);
  if (state.view === 'dashboard') {
    renderDashboard();
  }
  if (state.view === 'meeting') {
    emitParticipantUpdate();
    renderMeeting();
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Request failed');
  }
  return payload;
}

async function loadDashboardData() {
  state.dashboardLoading = true;
  state.dashboardError = '';
  if (state.view === 'dashboard') {
    renderDashboard();
  }

  const query = `profileId=${encodeURIComponent(state.profileId)}`;

  try {
    const [owned, upcoming, previous, recordings, personal] = await Promise.all([
      requestJson(`/api/meetings?filter=owned&${query}`),
      requestJson(`/api/meetings?filter=upcoming&${query}`),
      requestJson(`/api/meetings?filter=previous&${query}`),
      requestJson(`/api/meetings?filter=recordings&${query}`),
      fetch(`/api/meetings?filter=personal&${query}`).then(async (response) => {
        const payload = await response.json().catch(() => ({ items: [] }));
        return response.ok ? payload : { items: [] };
      })
    ]);

    state.dashboardData = {
      owned: Array.isArray(owned.items) ? owned.items : [],
      upcoming: Array.isArray(upcoming.items) ? upcoming.items : [],
      previous: Array.isArray(previous.items) ? previous.items : [],
      recordings: Array.isArray(recordings.items) ? recordings.items : [],
      personal: Array.isArray(personal.items) ? personal.items : []
    };
    state.personalRoom = state.dashboardData.personal[0] || null;
  } catch (error) {
    state.dashboardError = error?.message || 'Could not load meetings';
  } finally {
    state.dashboardLoading = false;
    if (state.view === 'dashboard') {
      renderDashboard();
    }
  }
}

async function fetchMeeting(meetingId) {
  return requestJson(`/api/meetings/${encodeURIComponent(normalizeRoomId(meetingId))}?profileId=${encodeURIComponent(state.profileId)}`);
}

function fallbackMeeting(meetingId, roomId = meetingId) {
  const baseMeetingId = normalizeRoomId(meetingId || roomId || 'main-room');
  const resolvedRoomId = normalizeRoomId(roomId || baseMeetingId);
  return {
    id: baseMeetingId,
    roomId: resolvedRoomId,
    title: state.routeMeetingTitle || `Meeting ${baseMeetingId}`,
    description: '',
    type: state.routeMeetingType || 'instant',
    status: 'active',
    startsAt: state.routeMeetingStartsAt || '',
    breakoutRoomCount: state.customRooms.length ? Math.max(state.customRooms.length - 1, 0) : state.breakoutRoomCount,
    hostName: state.displayName,
    isHost: true,
    joinPath: `/meeting/${baseMeetingId}`
  };
}

async function createMeeting(type, fields = {}) {
  const payload = await requestJson('/api/meetings', {
    method: 'POST',
    body: JSON.stringify({
      type,
      roomId: fields.roomId,
      title: fields.title,
      description: fields.description,
      startsAt: fields.startsAt,
      breakoutRoomCount: normalizeBreakoutRoomCount(fields.breakoutRoomCount || state.breakoutRoomCount, state.breakoutRoomCount),
      hostName: state.displayName,
      participantId: state.participantId,
      profileId: state.profileId
    })
  });
  return payload.meeting;
}

async function ensurePersonalRoom(fields = {}) {
  const payload = await requestJson('/api/personal-room', {
    method: 'POST',
    body: JSON.stringify({
      title: fields.title,
      description: fields.description,
      breakoutRoomCount: normalizeBreakoutRoomCount(fields.breakoutRoomCount || state.breakoutRoomCount, state.breakoutRoomCount),
      hostName: state.displayName,
      participantId: state.participantId,
      profileId: state.profileId
    })
  });
  state.personalRoom = payload.meeting || null;
  return payload.meeting;
}

function setDashboardRoute(page = state.dashboardPage) {
  state.dashboardPage = normalizeDashboardPage(page);
  localStorage.setItem(PAGE_KEY, state.dashboardPage);
  window.history.replaceState({}, '', '/');
}

function serializeRouteRoomsParam() {
  if (!Array.isArray(state.customRooms) || !state.customRooms.length) {
    return '';
  }

  const rooms = state.customRooms
    .map((room, index) => {
      const id = normalizeRoomId(room?.id || '');

      if (!id) {
        return null;
      }

      return {
        id,
        isMainRoom: index === 0,
        label: String(room?.label || (index === 0 ? 'Main room' : `Room ${index + 1}`)).trim() || (index === 0 ? 'Main room' : `Room ${index + 1}`)
      };
    })
    .filter(Boolean);

  return rooms.length ? JSON.stringify(rooms) : '';
}

function buildMeetingRouteUrl(meetingId, roomId = meetingId) {
  const baseMeetingId = normalizeRoomId(meetingId || roomId || 'main-room');
  const targetRoomId = normalizeRoomId(roomId || baseMeetingId);
  const nextUrl = new URL(`/meeting/${encodeURIComponent(baseMeetingId)}`, window.location.origin);

  if (targetRoomId !== baseMeetingId) {
    nextUrl.searchParams.set('room', targetRoomId);
  }

  if (state.displayName) {
    nextUrl.searchParams.set('name', state.displayName);
  }

  if (state.participantId) {
    nextUrl.searchParams.set('participantId', state.participantId);
  }

  if (state.profileId) {
    nextUrl.searchParams.set('profileId', state.profileId);
  }

  if (state.routeMeetingTitle) {
    nextUrl.searchParams.set('meetingTitle', state.routeMeetingTitle);
  }

  if (state.routeMeetingType) {
    nextUrl.searchParams.set('meetingType', state.routeMeetingType);
  }

  if (state.routeMeetingStartsAt) {
    nextUrl.searchParams.set('meetingStartsAt', state.routeMeetingStartsAt);
  }

  if (state.customRooms.length) {
    const roomsParam = serializeRouteRoomsParam();

    if (roomsParam) {
      nextUrl.searchParams.set('rooms', roomsParam);
    }
  } else if (state.breakoutRoomCount !== 50) {
    nextUrl.searchParams.set('breakoutCount', String(state.breakoutRoomCount));
  }

  if (state.clientActivityUrl) {
    nextUrl.searchParams.set('clientActivityUrl', state.clientActivityUrl);
  }

  if (state.clientMeetingJoinUrl) {
    nextUrl.searchParams.set('clientMeetingJoinUrl', state.clientMeetingJoinUrl);
  }

  if (state.clientMeetingTenantId) {
    nextUrl.searchParams.set('clientMeetingTenantId', state.clientMeetingTenantId);
  }

  if (state.clientMeetingToken) {
    nextUrl.searchParams.set('clientMeetingToken', state.clientMeetingToken);
  }

  if (state.clientMeetingRole) {
    nextUrl.searchParams.set('clientMeetingRole', state.clientMeetingRole);
  }

  if (state.clientMeetingHostProfileId) {
    nextUrl.searchParams.set('clientMeetingHostProfileId', state.clientMeetingHostProfileId);
  }

  if (state.parentOrigin) {
    nextUrl.searchParams.set('parentOrigin', state.parentOrigin);
  }

  if (state.isEmbedded) {
    nextUrl.searchParams.set('embed', '1');
  }

  if (state.desktopShell) {
    nextUrl.searchParams.set('desktopShell', '1');
  }

  if (state.disableEndMeeting) {
    nextUrl.searchParams.set('disableEndMeeting', '1');
  }

  if (state.routeAutoJoin) {
    nextUrl.searchParams.set('autoJoin', '1');
  }

  if (state.closeOnLeave) {
    nextUrl.searchParams.set('closeOnLeave', '1');
  }

  return `${nextUrl.pathname}${nextUrl.search}`;
}

function setMeetingRoute(meetingId, roomId = meetingId) {
  const nextUrl = buildMeetingRouteUrl(meetingId, roomId);
  window.history.replaceState({}, '', nextUrl);
}

function setPrejoinRoomId(roomId) {
  const baseMeetingId = normalizeRoomId(state.meetingId || getBaseRoomId(roomId) || 'main-room');
  const nextRoomId = normalizeRoomId(roomId || baseMeetingId);

  state.prejoinRoomId = nextRoomId;
  state.roomId = nextRoomId;

  if (state.prejoinMeeting) {
    state.prejoinMeeting = {
      ...state.prejoinMeeting,
      roomId: nextRoomId
    };
  }

  setMeetingRoute(baseMeetingId, nextRoomId);
}

function renderDashboard() {
  state.view = 'dashboard';
  state.ui = {};
  renderDashboardView({
    root,
    state,
    onNavigate: async (page) => {
      setDashboardRoute(page);
      renderDashboard();
      if (page === 'personal' && !state.personalRoom) {
        await loadDashboardData();
      }
    },
    onDisplayNameChange: (value) => setDisplayName(value),
    onCreateInstantMeeting: async () => {
      try {
        const meeting = await createMeeting('instant', { breakoutRoomCount: state.breakoutRoomCount });
        await openMeetingForPrejoin(meeting.id, meeting.roomId, meeting);
        void loadDashboardData();
      } catch (error) {
        state.dashboardError = error?.message || 'Could not create meeting';
        renderDashboard();
      }
    },
    onScheduleMeeting: async (draft) => {
      state.scheduleDraft = {
        title: String(draft.title || '').slice(0, 90),
        description: String(draft.description || '').slice(0, 240),
        startsAt: draft.startsAt || defaultScheduleDate(),
        breakoutRoomCount: normalizeBreakoutRoomCount(draft.breakoutRoomCount, state.breakoutRoomCount)
      };
      try {
        await createMeeting('scheduled', {
          title: state.scheduleDraft.title,
          description: state.scheduleDraft.description,
          startsAt: dateTimeLocalToIso(state.scheduleDraft.startsAt, new Date().toISOString()),
          breakoutRoomCount: state.scheduleDraft.breakoutRoomCount
        });
        state.dashboardPage = 'upcoming';
        setDashboardRoute('upcoming');
        state.scheduleDraft = {
          title: '',
          description: '',
          startsAt: defaultScheduleDate(),
          breakoutRoomCount: state.breakoutRoomCount
        };
        await loadDashboardData();
      } catch (error) {
        state.dashboardError = error?.message || 'Could not schedule meeting';
        renderDashboard();
      }
    },
    onJoinCode: async (value) => {
      state.joinCode = String(value || '').trim();
      const target = parseJoinTarget(state.joinCode);
      if (!target) {
        state.dashboardError = 'Enter a meeting code or link';
        renderDashboard();
        return;
      }
      await openMeetingForPrejoin(target.meetingId, target.roomId);
    },
    onEnsurePersonalRoom: async (fields) => {
      try {
        const meeting = await ensurePersonalRoom(fields);
        state.breakoutRoomCount = normalizeBreakoutRoomCount(meeting?.breakoutRoomCount, state.breakoutRoomCount);
        await loadDashboardData();
        if (state.dashboardPage === 'personal' && meeting) {
          renderDashboard();
        }
      } catch (error) {
        state.dashboardError = error?.message || 'Could not save personal room';
        renderDashboard();
      }
    },
    onOpenMeeting: async (meetingId) => {
      await openMeetingForPrejoin(meetingId);
    },
    onCopyMeetingLink: async (meetingId) => {
      try {
        await navigator.clipboard.writeText(inviteUrl(meetingId));
        state.dashboardError = '';
      } catch {
        state.dashboardError = 'Copy failed';
      }
      renderDashboard();
    }
  });
}

function renderPrejoinPreview() {
  state.ui.previewSurface?.replaceChildren();
  if (!state.ui.previewSurface) {
    return;
  }
  if (state.cameraTrack && state.isVideoEnabled) {
    state.ui.previewSurface.appendChild(stageVideo(state.cameraTrack, true, 'prejoin-preview-video'));
    return;
  }
  const placeholder = document.createElement('div');
  placeholder.className = 'prejoin-preview-placeholder';
  placeholder.innerHTML = `<div class="prejoin-preview-placeholder__avatar">${getInitials(state.displayName || 'Guest')}</div><div class="prejoin-preview-placeholder__meta"><strong>${state.displayName || 'Guest'}</strong><span>${state.isVideoEnabled ? 'Camera starting' : 'Camera is off'}</span></div>`;
  state.ui.previewSurface.appendChild(placeholder);
}

function releasePreviewDevices() {
  stopTrack(state.cameraTrack);
  stopTrack(state.micTrack);
  state.cameraTrack = null;
  state.micTrack = null;
  state.cameraPublication = null;
  state.micPublication = null;
  state.isAudioEnabled = false;
  state.isVideoEnabled = false;
}

function renderPrejoin() {
  state.view = 'prejoin';
  state.ui = renderPrejoinView({
    root,
    state,
    onBack: async () => {
      releasePreviewDevices();
      setDashboardRoute(state.dashboardPage || 'home');
      renderDashboard();
      await loadDashboardData();
    },
    onJoin: () => void mountMeeting(),
    onToggleMic: () => void toggleMic(),
    onToggleCamera: () => void toggleCamera(),
    onCopyMeetingLink: async () => {
      try {
        await navigator.clipboard.writeText(inviteUrl(state.meetingId || state.prejoinMeeting?.id || state.prejoinRoomId, state.prejoinRoomId));
        state.connectionStatus = 'Invite copied';
      } catch {
        state.connectionStatus = 'Copy failed';
      }
      renderPrejoin();
    },
    onRoomChange: (roomId) => {
      setPrejoinRoomId(roomId);
      renderPrejoin();
    }
  });
  renderPrejoinPreview();
}

async function openMeetingForPrejoin(meetingId, roomId = '', knownMeeting = null, routeConfig = null) {
  const baseMeetingId = normalizeRoomId(meetingId || roomId || 'main-room');
  const resolvedRoomId = normalizeRoomId(roomId || baseMeetingId);
  const fallback = fallbackMeeting(baseMeetingId, resolvedRoomId);
  applyRouteConfig(routeConfig || {});
  state.connectionStatus = 'Preparing meeting';
  state.meetingId = baseMeetingId;
  state.prejoinRoomId = resolvedRoomId;
  state.prejoinJoinBlock = null;
  state.prejoinError = '';
  state.prejoinBusy = false;
  state.lastLiveKitUrl = '';
  state.pendingJoinRequests = [];
  state.prejoinMeeting = fallback;
  renderPrejoin();

  try {
    const payload = knownMeeting ? { meeting: knownMeeting, joinBlock: null } : await fetchMeeting(baseMeetingId);
    state.prejoinMeeting = {
      ...fallback,
      ...(payload.meeting || {}),
      breakoutRoomCount: state.customRooms.length
        ? Math.max(state.customRooms.length - 1, 0)
        : normalizeBreakoutRoomCount(payload?.meeting?.breakoutRoomCount || fallback.breakoutRoomCount, state.breakoutRoomCount),
      title: payload?.meeting?.title || state.routeMeetingTitle || fallback.title,
      type: payload?.meeting?.type || state.routeMeetingType || fallback.type,
      roomId: resolvedRoomId
    };
    state.prejoinJoinBlock = payload.joinBlock || null;
    state.breakoutRoomCount = normalizeBreakoutRoomCount(state.prejoinMeeting.breakoutRoomCount, state.breakoutRoomCount);
    state.isHost = Boolean(state.prejoinMeeting.isHost);
  } catch {
    state.prejoinMeeting = fallbackMeeting(baseMeetingId, resolvedRoomId);
    state.prejoinJoinBlock = null;
    state.isHost = true;
  }

  setPrejoinRoomId(resolvedRoomId);
  state.connectionStatus = 'Ready to join';
  if (state.bypassPrejoin) {
    await mountMeeting();
    return;
  }
  renderPrejoin();
}

function paintToolbar(button, name, label, active) {
  if (!button) {
    return;
  }
  button.classList.toggle('is-active', Boolean(active));
  button.innerHTML = `${icon(name)}<span>${label}</span>`;
}

function renderShell() {
  state.ui = renderShellView({
    root,
    onCopyInvite: async () => {
      try {
        await navigator.clipboard.writeText(inviteUrl(state.meetingId || state.roomId));
        state.connectionStatus = 'Invite copied';
        renderMeeting();
        setTimeout(() => {
          if (state.connectionStatus === 'Invite copied') {
            state.connectionStatus = state.room ? 'Connected' : 'Offline';
            renderMeeting();
          }
        }, 1800);
      } catch {
        state.connectionStatus = 'Copy failed';
        renderMeeting();
      }
    },
    onToggleMic: () => void toggleMic(),
    onToggleCamera: () => void toggleCamera(),
    onToggleScreen: () => void toggleScreen(),
    onToggleHand: () => {
      state.isHandRaised = !state.isHandRaised;
      emitParticipantUpdate();
      renderMeeting();
    },
    onToggleLayout: () => {
      state.meetingLayout = state.meetingLayout === 'grid' ? 'spotlight' : 'grid';
      applySubscriptions();
      renderMeeting();
    },
    onToggleStats: () => toggleSidebar('stats'),
    onToggleSidebar: (mode) => toggleSidebar(mode),
    onOpenSettings: openSettings,
    onCloseSettings: closeSettings,
    onChangeScreenShareQuality: setScreenShareQuality,
    onToggleRecording: () => {
      if (state.recordingStatus === 'requesting') return;

      if (state.isHost || !state.meetingConfig?.hostProfileId) {
        postParentEvent('recording-state', { action: 'toggle' });
      } else {
        state.recordingStatus = 'requesting';
        renderMeeting();
        state.socket?.emit('request-recording', {});
      }
    },
    onOpenBreakoutModal: openBreakoutModal,
    onExpandAllBreakouts: expandAllBreakouts,
    onCollapseAllBreakouts: collapseAllBreakouts,
    onLeave: () => void leaveMeeting(),
    onEndMeeting: () => void endMeetingForAll(),
    onCloseBreakoutModal: closeBreakoutModal,
    onSendChat: sendChat,
    onChatFilesChange: addPendingFiles
  });
  renderMeeting();
}

function openBreakoutModal() {
  if (!state.breakoutExpansionInitialized) {
    state.breakoutExpansionInitialized = true;
    state.expandedBreakoutRooms = state.roomId ? new Set([state.roomId]) : new Set();
  }
  renderBreakouts();
  state.ui.breakoutModal?.classList.add('is-open');
}

function closeBreakoutModal() {
  state.ui.breakoutModal?.classList.remove('is-open');
}

function expandAllBreakouts() {
  const rooms = breakoutRooms();
  state.breakoutExpansionInitialized = true;
  state.expandedBreakoutRooms = new Set(rooms.map((room) => room.id));
  renderBreakouts();
}

function collapseAllBreakouts() {
  state.breakoutExpansionInitialized = true;
  state.expandedBreakoutRooms = new Set();
  renderBreakouts();
}

function toggleBreakoutExpansion(roomId) {
  state.breakoutExpansionInitialized = true;
  const nextExpanded = new Set(state.expandedBreakoutRooms);
  if (nextExpanded.has(roomId)) {
    nextExpanded.delete(roomId);
  } else {
    nextExpanded.add(roomId);
  }
  state.expandedBreakoutRooms = nextExpanded;
  renderBreakouts();
}

function renderMeeting() {
  if (!state.ui.stageSurface) {
    return;
  }
  const activeMeeting = currentMeeting();
  state.ui.headerName.textContent = activeMeeting?.title || state.displayName;
  state.ui.headerRoom.textContent = state.roomId;
  state.ui.connectionPill.textContent = compactConnectionStatus(state.connectionStatus);
  state.ui.connectionPill.title = state.connectionStatus;
  state.ui.participantCountPill.textContent = `${Math.max(1, state.participants.size)}`;
  state.ui.participantCountPill.title = `${Math.max(1, state.participants.size)} participants`;
  state.ui.endMeetingButton.classList.toggle('is-hidden', !state.isHost || state.disableEndMeeting);
  state.ui.headerLayoutButton.classList.toggle('is-active', state.meetingLayout === 'grid');
  state.ui.layoutButton.classList.toggle('is-active', state.meetingLayout === 'grid');
  state.ui.headerStatsButton.classList.toggle('is-active', state.sidebarMode === 'stats');
  state.ui.statsButton.classList.toggle('is-active', state.sidebarMode === 'stats');
  state.ui.headerSettingsButton.classList.toggle('is-active', state.settingsOpen);
  state.ui.settingsButton.classList.toggle('is-active', state.settingsOpen);
  state.ui.settingsModal.classList.toggle('is-open', state.settingsOpen);
  state.ui.screenQualitySelect.value = state.screenShareQuality;
  state.ui.recordingPill.classList.toggle('is-hidden', !state.recordingRequestFrom);
  if (state.recordingRequestFrom) {
    state.ui.recordingPill.textContent = state.recordingRequestFrom.participantName + ' wants to record';
    state.ui.recordingPill.title = 'Click to allow or deny';
    state.ui.recordingPill.onclick = function() {
      if (!state.recordingRequestFrom) return;
      var allow = confirm(state.recordingRequestFrom.participantName + ' wants to record this meeting. Allow?');
      if (state.socket) {
        state.socket.emit('grant-recording', { participantId: state.recordingRequestFrom.participantId, allowed: allow });
      }
      state.recordingRequestFrom = null;
      renderMeeting();
    };
    state.ui.recordingPill.style.cursor = 'pointer';
  } else {
    state.ui.recordingPill.textContent = '';
    state.ui.recordingPill.title = '';
    state.ui.recordingPill.onclick = null;
    state.ui.recordingPill.style.cursor = '';
  }
  renderTabs();
  renderStage();
  renderToolbar();
  renderSidebar();
  renderBreakouts();
  renderPendingJoinRequests();
}

function ensureJoinRequestsUi() {
  const main = document.querySelector('.zoom-main');

  if (!main) {
    return;
  }

  if (state.ui.joinRequestsPanel && main.contains(state.ui.joinRequestsPanel)) {
    return;
  }

  const panel = document.createElement('section');
  panel.className = 'join-requests-panel is-hidden';
  panel.innerHTML = `
    <div class="join-requests-panel__header">
      <div class="join-requests-panel__copy">
        <strong>Join requests</strong>
        <span data-join-request-subtitle></span>
      </div>
      <span class="zoom-pill zoom-pill--accent" data-join-request-count></span>
    </div>
    <div class="join-requests-panel__body" data-join-request-body></div>
  `;
  main.appendChild(panel);
  state.ui.joinRequestsPanel = panel;
  state.ui.joinRequestsCount = panel.querySelector('[data-join-request-count]');
  state.ui.joinRequestsSubtitle = panel.querySelector('[data-join-request-subtitle]');
  state.ui.joinRequestsBody = panel.querySelector('[data-join-request-body]');
}

function approvePendingJoin(participantId) {
  const safeParticipantId = String(participantId || '').trim();

  if (!safeParticipantId) {
    return;
  }

  state.pendingJoinRequests = state.pendingJoinRequests.filter((request) => request?.participantId !== safeParticipantId);
  renderPendingJoinRequests();
  state.socket?.emit('approve-pending-join', { participantId: safeParticipantId });
}

function denyPendingJoin(participantId) {
  const safeParticipantId = String(participantId || '').trim();

  if (!safeParticipantId) {
    return;
  }

  state.pendingJoinRequests = state.pendingJoinRequests.filter((request) => request?.participantId !== safeParticipantId);
  renderPendingJoinRequests();
  state.socket?.emit('deny-pending-join', { participantId: safeParticipantId });
}

function renderPendingJoinRequests() {
  ensureJoinRequestsUi();

  const panel = state.ui.joinRequestsPanel;
  const subtitle = state.ui.joinRequestsSubtitle;
  const count = state.ui.joinRequestsCount;
  const body = state.ui.joinRequestsBody;

  if (!panel || !subtitle || !count || !body) {
    return;
  }

  const items = Array.isArray(state.pendingJoinRequests)
    ? state.pendingJoinRequests.filter((request) => request?.participantId)
    : [];
  const visible = Boolean(state.view === 'meeting' && state.isHost && items.length > 0);

  panel.classList.toggle('is-hidden', !visible);
  subtitle.textContent = items.length === 1 ? '1 person is waiting in the lobby' : `${items.length} people are waiting in the lobby`;
  count.textContent = items.length ? String(items.length) : '';
  body.replaceChildren();

  if (!visible) {
    return;
  }

  for (const request of items) {
    const card = document.createElement('article');
    card.className = 'join-request-card';

    const meta = document.createElement('div');
    meta.className = 'join-request-card__meta';

    const title = document.createElement('strong');
    title.textContent = String(request.name || 'Guest').trim() || 'Guest';

    const details = document.createElement('span');
    const requestedAt = Number(request.requestedAt || 0);
    const waitingLabel = request.roomId && request.roomId !== state.meetingId
      ? `Waiting to enter ${request.roomId}`
      : 'Waiting to enter the meeting';
    details.textContent = requestedAt > 0
      ? `${waitingLabel} • ${new Date(requestedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : waitingLabel;

    meta.append(title, details);

    const actions = document.createElement('div');
    actions.className = 'join-request-card__actions';

    const denyButton = document.createElement('button');
    denyButton.type = 'button';
    denyButton.className = 'join-request-card__action join-request-card__action--deny';
    denyButton.textContent = 'Deny';
    denyButton.addEventListener('click', () => denyPendingJoin(request.participantId));

    const approveButton = document.createElement('button');
    approveButton.type = 'button';
    approveButton.className = 'join-request-card__action join-request-card__action--approve';
    approveButton.textContent = 'Admit';
    approveButton.addEventListener('click', () => approvePendingJoin(request.participantId));

    actions.append(denyButton, approveButton);
    card.append(meta, actions);
    body.appendChild(card);
  }
}

function renderTabs() {
  state.ui.screenTabs.replaceChildren();
  const meetingTab = document.createElement('button');
  meetingTab.type = 'button';
  meetingTab.className = `screen-tab${state.selectedScreenParticipantId ? '' : ' is-active'}`;
  meetingTab.innerHTML = `${icon('screen')}<span>${state.meetingLayout === 'grid' ? 'Gallery' : 'Meeting'}</span>`;
  meetingTab.addEventListener('click', () => selectScreen(null));
  state.ui.screenTabs.appendChild(meetingTab);
  const shares = screenParticipants();
  if (shares.length === 0) {
    return;
  }
  for (const participant of shares) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `screen-tab${participant.id === state.selectedScreenParticipantId ? ' is-active' : ''}${participant.screenStatus === 'live' ? ' is-live' : ''}`;
    button.innerHTML = `${icon('screen')}<span>${participant.name}</span>`;
    button.addEventListener('click', () => selectScreen(participant.id));

    // Add three dots menu inside the button
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'screen-tab-menu';
    menuButton.innerHTML = '⋮';
    menuButton.title = 'Options';
    button.appendChild(menuButton);

    // Create dropdown and append to body to avoid container constraints
    const dropdown = document.createElement('div');
    dropdown.className = 'screen-tab-dropdown';
    dropdown.id = `remote-control-dropdown-${participant.id}`;
    dropdown.innerHTML = `
      <button type="button" class="screen-tab-dropdown-item" data-action="request-remote-control">
        ${icon('screen')} Request Remote Control
      </button>
    `;
    document.body.appendChild(dropdown);

    menuButton.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close other dropdowns
      document.querySelectorAll('.screen-tab-dropdown.is-visible').forEach(d => {
        if (d !== dropdown) d.classList.remove('is-visible');
      });
      
      // Calculate dropdown position
      const rect = menuButton.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.right = `${window.innerWidth - rect.right}px`;
      dropdown.style.left = 'auto';
      
      dropdown.classList.toggle('is-visible');
    });

    // Handle remote control request
    dropdown.querySelector('[data-action="request-remote-control"]')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      dropdown.classList.remove('is-visible');
      await requestRemoteControl(participant);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!button.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('is-visible');
      }
    });

    // Clean up dropdown when button is removed
    button.addEventListener('click', () => {
      dropdown.remove();
    });

    state.ui.screenTabs.appendChild(button);
  }
}

function avatarStage(title, subtitle, className = 'zoom-avatar-stage') {
  const wrapper = document.createElement('div');
  wrapper.className = className;
  wrapper.innerHTML = `<div class="zoom-avatar-stage__avatar">${getInitials(title)}</div><div class="zoom-avatar-stage__meta"><strong>${title}</strong><span>${subtitle}</span></div>`;
  return wrapper;
}

function getRemoteTrackElement(participantId, sourceType, className = 'zoom-video-surface') {
  const source = state.sdk?.Track?.Source;
  if (!source || !state.room) {
    return null;
  }
  const remote = Array.from(state.room.remoteParticipants.values()).find((item) => item.identity === participantId);
  if (!remote) {
    return null;
  }
  for (const publication of remote.trackPublications.values()) {
    if (publication.source === sourceType && publication.track) {
      if (publication.isMuted || publication.track?.isMuted) {
        continue;
      }
      const mediaTrack = publication.track?.mediaStreamTrack;
      if (mediaTrack?.readyState && mediaTrack.readyState !== 'live') {
        continue;
      }
      const detached = publication.track.detach?.();
      if (Array.isArray(detached)) {
        detached.forEach((node) => node.remove());
      }
      const element = publication.track.attach();
      element.className = className;
      element.muted = true;
      element.playsInline = true;
      element.autoplay = true;
      element.disablePictureInPicture = true;
      queueMicrotask(() => {
        const playPromise = element.play?.();
        if (playPromise?.catch) {
          playPromise.catch(() => {});
        }
      });
      return element;
    }
  }
  return null;
}

function stageScreenElement(participantId) {
  const source = state.sdk?.Track?.Source;
  if (participantId === state.participantId && state.screenTrack) {
    return stageVideo(state.screenTrack, true);
  }
  return source ? getRemoteTrackElement(participantId, source.ScreenShare) : null;
}

function stageCameraElement(participantId, tile = false) {
  const source = state.sdk?.Track?.Source;
  const className = tile ? 'zoom-video-surface zoom-video-surface--tile' : 'zoom-video-surface';
  if (participantId === state.participantId && state.cameraTrack && state.isVideoEnabled) {
    return stageVideo(state.cameraTrack, true, className);
  }
  const participant = state.participants.get(participantId);
  if (participant && !participant.isVideoEnabled) {
    return null;
  }
  return source ? getRemoteTrackElement(participantId, source.Camera, className) : null;
}

function participantTile(participant) {
  const tile = document.createElement('article');
  tile.className = 'zoom-grid-tile';
  const media = stageCameraElement(participant.id, true);
  if (media) {
    tile.appendChild(media);
  } else {
    tile.appendChild(avatarStage(participantLabel(participant), participant.isVideoEnabled ? 'Camera starting' : 'Camera is off', 'zoom-avatar-stage zoom-avatar-stage--tile'));
  }
  const footer = document.createElement('div');
  footer.className = 'zoom-grid-tile__footer';
  const chips = [];
  if (participant.isAudioEnabled) {
    chips.push('Mic');
  }
  if (participant.isVideoEnabled) {
    chips.push('Cam');
  }
  if (participant.screenStatus === 'live') {
    chips.push('Sharing');
  }
  if (participant.isHandRaised) {
    chips.push('Hand');
  }
  footer.innerHTML = `<strong>${participantLabel(participant)}</strong><span>${chips.join(' â€¢ ') || 'Listening'}</span>`;
  tile.appendChild(footer);
  return tile;
}

function renderStage() {
  state.ui.stageSurface.replaceChildren();
  let title = '';
  let subtitle = '';
  let badge = '';

  const focusedParticipant = state.selectedScreenParticipantId ? state.participants.get(state.selectedScreenParticipantId) : null;
  const showGrid = state.meetingLayout === 'grid' && !focusedParticipant;

  if (showGrid) {
    const grid = document.createElement('div');
    grid.className = `zoom-stage__grid zoom-stage__grid--${Math.min(4, Math.max(1, sortedParticipants().length))}`;
    for (const participant of sortedParticipants()) {
      grid.appendChild(participantTile(participant));
    }
    state.ui.stageSurface.appendChild(grid);
    title = 'Gallery view';
    subtitle = `${Math.max(1, state.participants.size)} participants in the room`;
    badge = 'Grid layout';
  } else if (focusedParticipant) {
    const isLocalFocusedShare = focusedParticipant.id === state.participantId;
    title = isLocalFocusedShare ? '' : `${focusedParticipant.name || 'Unknown'}'s screen`;
    subtitle = isLocalFocusedShare ? '' : focusedParticipant.screenStatus === 'live' ? 'Viewing live screen share' : 'Waiting for stream';
    badge = !isLocalFocusedShare && focusedParticipant.screenStatus === 'live' ? 'Screen live' : '';
    const media = stageScreenElement(focusedParticipant.id);
    state.ui.stageSurface.appendChild(media || avatarStage(isLocalFocusedShare ? state.displayName : (title || `${focusedParticipant.name || 'Unknown'}'s screen`), subtitle || 'Waiting for stream'));
  } else {
    state.ui.stageSurface.appendChild(state.cameraTrack && state.isVideoEnabled ? stageVideo(state.cameraTrack, true) : avatarStage(state.displayName, state.isVideoEnabled ? 'Camera starting' : 'Camera is off'));
  }

  state.ui.stage.classList.toggle('is-share-view', Boolean(focusedParticipant));
  state.ui.stage.classList.toggle('is-grid-view', showGrid);
  state.ui.stageMeta.classList.toggle('is-hidden', (!focusedParticipant && !showGrid) || (focusedParticipant?.id === state.participantId));
  state.ui.stageBadge.classList.toggle('is-hidden', !badge);
  state.ui.stageTitle.textContent = focusedParticipant && focusedParticipant.id === state.participantId ? '' : title;
  state.ui.stageSubtitle.textContent = focusedParticipant && focusedParticipant.id === state.participantId ? '' : subtitle;
  state.ui.stageBadge.textContent = badge;
}

function renderToolbar() {
  paintToolbar(state.ui.micButton, state.isAudioEnabled ? 'mic' : 'micOff', state.isAudioEnabled ? 'Mute' : 'Unmute', state.isAudioEnabled);
  paintToolbar(state.ui.cameraButton, state.isVideoEnabled ? 'camera' : 'cameraOff', state.isVideoEnabled ? 'Stop Video' : 'Start Video', state.isVideoEnabled);
  paintToolbar(state.ui.screenButton, 'screen', state.screenStatus === 'off' ? 'Share Screen' : 'Stop Share', state.screenStatus !== 'off');
  paintToolbar(state.ui.handButton, 'hand', state.isHandRaised ? 'Lower Hand' : 'Raise Hand', state.isHandRaised);
  paintToolbar(state.ui.layoutButton, 'layout', state.meetingLayout === 'grid' ? 'Speaker View' : 'Gallery View', state.meetingLayout === 'grid');
  paintToolbar(state.ui.participantsButton, 'users', 'Participants', state.sidebarMode === 'participants');
  paintToolbar(state.ui.chatButton, 'chat', 'Chat', state.sidebarMode === 'chat');
  paintToolbar(state.ui.statsButton, 'stats', 'Stats', state.sidebarMode === 'stats');
  paintToolbar(state.ui.settingsButton, 'settings', 'Settings', state.settingsOpen);
  paintToolbar(state.ui.recordButton, 'recording', recordingButtonLabel(), state.recordingStatus === 'starting' || state.recordingStatus === 'recording');
  state.ui.recordButton.classList.add('is-hidden');
  state.ui.recordButton.disabled = recordingButtonDisabled();
  paintToolbar(state.ui.roomsButton, 'rooms', 'Breakouts', false);
  paintToolbar(state.ui.endMeetingButton, 'end', 'End for All', false);
  paintToolbar(state.ui.leaveButton, 'leave', 'Leave', false);
  postRecordingState();
}

function toggleSidebar(mode) {
  state.sidebarMode = mode ? (state.sidebarMode === mode ? null : mode) : null;
  renderMeeting();
}

function countRemoteTrackPublications(sourceType) {
  if (!state.room) {
    return 0;
  }
  let count = 0;
  for (const participant of state.room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.source === sourceType) {
        count += 1;
      }
    }
  }
  return count;
}

function callStatsItems() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const source = state.sdk?.Track?.Source;
  const remoteParticipants = state.room ? state.room.remoteParticipants.size : Math.max(0, state.participants.size - 1);
  const audioTracks = source ? countRemoteTrackPublications(source.Microphone) : 0;
  const cameraTracks = source ? countRemoteTrackPublications(source.Camera) : 0;
  return [
    { label: 'Layout', value: state.meetingLayout === 'grid' ? 'Gallery' : 'Speaker' },
    { label: 'Connection', value: compactConnectionStatus(state.connectionStatus) },
    { label: 'Participants', value: `${Math.max(1, state.participants.size)}` },
    { label: 'Remote peers', value: `${remoteParticipants}` },
    { label: 'Audio tracks', value: `${audioTracks}` },
    { label: 'Camera tracks', value: `${cameraTracks}` },
    { label: 'Screen shares', value: `${screenParticipants().length}` },
    { label: 'Network RTT', value: connection?.rtt ? `${connection.rtt} ms` : 'Unavailable' },
    { label: 'Downlink', value: connection?.downlink ? `${Number(connection.downlink).toFixed(1)} Mbps` : 'Unavailable' }
  ];
}

function appendSidebarEmpty(text) {
  const empty = document.createElement('div');
  empty.className = 'sidebar-empty';
  empty.textContent = text;
  state.ui.sidebarBody.appendChild(empty);
}

function participantRow(participant) {
  const row = document.createElement('div');
  const chips = [];
  if (participant.isAudioEnabled) {
    chips.push('Mic');
  }
  if (participant.isVideoEnabled) {
    chips.push('Cam');
  }
  if (participant.isHandRaised) {
    chips.push('Hand');
  }
  if (participant.screenStatus === 'live') {
    chips.push('Sharing');
  }
  row.className = 'participant-row';
  row.innerHTML = `<div class="participant-row__avatar">${getInitials(participant.name)}</div><div class="participant-row__meta"><strong>${participantLabel(participant)}</strong><span>${chips.join(' â€¢ ') || 'Listening'}</span></div>`;
  return row;
}

function statsRow(item) {
  const row = document.createElement('div');
  row.className = 'participant-row participant-row--stats';
  row.innerHTML = `<div class="participant-row__avatar">${getInitials(item.label)}</div><div class="participant-row__meta"><strong>${item.label}</strong><span>${item.value}</span></div>`;
  return row;
}

function chatRow(message) {
  var row = document.createElement('div');
  var isSelf = message.senderId === state.participantId;
  row.className = 'message-row' + (isSelf ? ' is-self' : '') + (message._uploading ? ' is-uploading' : '');
  row.innerHTML = '<div class="message-row__name">' + message.senderName + '</div>' + (message.body ? '<div class="message-row__body"></div>' : '') + '<div class="message-row__time">' + new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>';
  if (message.body) {
    row.querySelector('.message-row__body').textContent = message.body;
  }
  if (Array.isArray(message.attachments) && message.attachments.length) {
    var wrap = document.createElement('div');
    wrap.className = 'message-row__attachments';
    for (var i = 0; i < message.attachments.length; i++) {
      var file = message.attachments[i];
      var item = document.createElement('div');
      item.className = 'message-attachment';
      if (file._uploading) item.classList.add('is-uploading');
      if (file._error) item.classList.add('is-error');

      var name = document.createElement('span');
      name.className = 'message-attachment__name';
      name.textContent = (file._error ? file._error : truncateFileName(file.name || file.name)) + (file.size && !file._error ? ' \u00B7 ' + fileSizeLabel(file.size) : '');
      name.title = (file.name || '') + (file.size ? ' \u00B7 ' + fileSizeLabel(file.size) : '');
      item.appendChild(name);

      if (file._uploading) {
        var bar = document.createElement('div');
        bar.className = 'message-attachment__progress';
        bar.innerHTML = '<span style="width:' + (file._progress || 0) + '%"></span>';
        item.appendChild(bar);
      }

      if (file.localUrl || file.downloadUrl) {
        var link = document.createElement('a');
        link.href = file.localUrl || file.downloadUrl || '#';
        link.download = file.name;
        link.className = 'message-attachment__link';
        link.textContent = 'Download';
        item.appendChild(link);
      }

      wrap.appendChild(item);
    }
    row.appendChild(wrap);
  }
  return row;
}

function cacheAttachmentUrl(attachmentId, blob) {
  if (!attachmentId || !(blob instanceof Blob)) {
    return '';
  }

  const existingUrl = state.attachmentUrls.get(attachmentId);
  if (existingUrl) {
    return existingUrl;
  }

  const localUrl = URL.createObjectURL(blob);
  state.attachmentUrls.set(attachmentId, localUrl);
  return localUrl;
}

async function hydrateMessageAttachments(message) {
  if (!message || !Array.isArray(message.attachments) || message.attachments.length === 0) {
    return;
  }

  let changed = false;
  const nextAttachments = [];

  for (const attachment of message.attachments) {
    if (!attachment?.id) {
      nextAttachments.push(attachment);
      continue;
    }

    const localUrl = attachment.localUrl || state.attachmentUrls.get(attachment.id);
    if (localUrl) {
      if (!attachment.localUrl) {
        changed = true;
      }
      nextAttachments.push({
        ...attachment,
        localUrl
      });
      continue;
    }

    try {
      const response = await fetch(String(attachment.downloadUrl || ''), {
        cache: 'no-store'
      });
      if (!response.ok) {
        nextAttachments.push(attachment);
        continue;
      }

      const blob = await response.blob();
      if (!state.messages.includes(message)) {
        return;
      }
      const fetchedLocalUrl = cacheAttachmentUrl(attachment.id, blob);
      if (fetchedLocalUrl) {
        changed = true;
        nextAttachments.push({
          ...attachment,
          localUrl: fetchedLocalUrl
        });
        continue;
      }
    } catch {}

    nextAttachments.push(attachment);
  }

  if (!state.messages.includes(message)) {
    return;
  }

  if (changed) {
    message.attachments = nextAttachments;
    renderSidebar();
  }
}

function receiveChatMessage(message) {
  for (var i = state.messages.length - 1; i >= 0; i--) {
    var m = state.messages[i];
    if (m.id && m.id.startsWith('local-') && m.senderId === state.participantId && m.body === message.body) {
      state.messages.splice(i, 1);
      break;
    }
  }

  const nextMessage = {
    ...message,
    attachments: Array.isArray(message?.attachments)
      ? message.attachments.map((attachment) => ({
        ...attachment,
        localUrl: attachment?.id ? state.attachmentUrls.get(attachment.id) : ''
      }))
      : []
  };

  state.messages.push(nextMessage);
  renderSidebar();
  if (nextMessage.attachments.length) {
    void hydrateMessageAttachments(nextMessage);
  }
}

function truncateFileName(name) {
  var dot = name.lastIndexOf('.');
  var ext = dot > 0 ? name.slice(dot) : '';
  var base = dot > 0 ? name.slice(0, dot) : name;
  if (base.length > 10) base = base.slice(0, 10) + '...';
  return base + ext;
}

function renderPendingFiles() {
  state.ui.pendingFiles.replaceChildren();
  for (const [index, file] of state.pendingFiles.entries()) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `pending-file-chip${file._uploading ? ' uploading' : ''}${file._error ? ' error' : ''}`;
    chip.textContent = file._error ? file._error : (truncateFileName(file.name) + ' \u00B7 ' + fileSizeLabel(file.size));
    chip.title = file.name + ' \u00B7 ' + fileSizeLabel(file.size);
    if (file._uploading) {
      chip.style.opacity = '0.6';
      const bar = document.createElement('div');
      bar.style.background = 'rgba(45, 140, 255, 0.45)';
      bar.style.borderRadius = '2px';
      bar.style.height = '3px';
      bar.style.marginTop = '4px';
      bar.style.width = (file._progress || 0) + '%';
      chip.appendChild(bar);
    }
    if (!file._uploading) {
      chip.addEventListener('click', () => {
        state.pendingFiles.splice(index, 1);
        renderPendingFiles();
      });
    }
    state.ui.pendingFiles.appendChild(chip);
  }
}

function uploadChatAttachment(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/chat-files?roomId=' + encodeURIComponent(state.roomId) + '&participantId=' + encodeURIComponent(state.participantId) + '&profileId=' + encodeURIComponent(state.profileId));
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name || 'file'));
    xhr.setRequestHeader('X-File-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-File-Size', String(file.size || 0));
    xhr.upload.onprogress = function(event) {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = function() {
      try {
        var payload = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && payload && payload.attachment) {
          resolve(payload.attachment);
        } else {
          reject(new Error((payload && payload.error) || 'Could not upload chat attachment'));
        }
      } catch(e) {
        reject(new Error('Could not upload chat attachment'));
      }
    };
    xhr.onerror = function() { reject(new Error('Upload failed')); };
    xhr.send(file);
  });
}

function addPendingFiles(fileList) {
  const files = Array.from(fileList || []).slice(0, Math.max(0, MAX_FILES - state.pendingFiles.length));
  for (const file of files) {
    const total = state.pendingFiles.reduce((sum, item) => sum + item.size, 0);
    if (file.size <= 0 || file.size > MAX_FILE_BYTES || total + file.size > MAX_TOTAL_BYTES) {
      continue;
    }
    file._uploading = false;
    file._progress = 0;
    file._error = '';
    state.pendingFiles.push(file);
  }
  renderPendingFiles();
}

function renderSidebar() {
  const visible = Boolean(state.sidebarMode);
  document.querySelector('.zoom-main')?.classList.toggle('has-sidebar', visible);
  state.ui.sidebar.classList.toggle('is-hidden', !visible);
  state.ui.chatForm.classList.toggle('is-hidden', state.sidebarMode !== 'chat');
  renderPendingFiles();
  state.ui.sidebarBody.replaceChildren();
  if (!visible) {
    return;
  }

  if (state.sidebarMode === 'participants') {
    state.ui.sidebarTitle.textContent = `Participants (${Math.max(1, state.participants.size)})`;
    state.ui.sidebarSubtitle.textContent = 'People in this room';
    const people = sortedParticipants();
    if (people.length === 0) {
      appendSidebarEmpty('Nobody is here yet.');
      return;
    }
    for (const participant of people) {
      state.ui.sidebarBody.appendChild(participantRow(participant));
    }
    return;
  }

  if (state.sidebarMode === 'stats') {
    state.ui.sidebarTitle.textContent = 'Call stats';
    state.ui.sidebarSubtitle.textContent = 'Connection and layout overview';
    for (const item of callStatsItems()) {
      state.ui.sidebarBody.appendChild(statsRow(item));
    }
    return;
  }

  state.ui.sidebarTitle.textContent = 'Room chat';
  state.ui.sidebarSubtitle.textContent = `Messages in ${state.roomId}`;
  if (state.messages.length === 0) {
    appendSidebarEmpty('Chat is empty.');
    return;
  }
  for (const message of state.messages) {
    state.ui.sidebarBody.appendChild(chatRow(message));
  }
  state.ui.sidebarBody.scrollTop = state.ui.sidebarBody.scrollHeight;
}

function breakoutRooms() {
  if (state.customRooms.length) {
    return state.customRooms;
  }

  const baseRoomId = getBaseRoomId(state.meetingId || state.roomId);
  const breakoutCount = normalizeBreakoutRoomCount(state.breakoutRoomCount, 50);
  return [
    { id: baseRoomId, label: 'Main room', description: 'Return here for the full group conversation', badge: 'Main session' },
    ...Array.from({ length: breakoutCount }, (_, index) => ({
      id: `${baseRoomId}-room-${index + 1}`,
      label: `Room ${index + 1}`,
      description: `Open breakout space ${index + 1}`,
      badge: 'Breakout room'
    }))
  ];
}

function breakoutToggleIcon() {
  return '<span class="zoom-breakout-item__chevron-icon" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7 5 5 5-5 5"/></svg></span>';
}

function breakoutParticipantCountLabel(participantCount) {
  return `${participantCount} participant${participantCount !== 1 ? 's' : ''}`;
}

function breakoutParticipantRow(participant) {
  const item = document.createElement('div');
  item.className = 'zoom-breakout-item__member';

  const avatar = document.createElement('div');
  avatar.className = 'zoom-breakout-item__member-avatar';
  avatar.textContent = getInitials(participant.name || 'Unknown');

  const info = document.createElement('div');
  info.className = 'zoom-breakout-item__member-info';

  const name = document.createElement('strong');
  name.textContent = participant.name || 'Unknown participant';

  const meta = document.createElement('div');
  meta.className = 'zoom-breakout-item__member-meta';

  if (participant.isHost) {
    const hostBadge = document.createElement('span');
    hostBadge.className = 'zoom-breakout-item__member-pill';
    hostBadge.textContent = 'Host';
    meta.appendChild(hostBadge);
  }

  if (participant.isSpeaking) {
    const speakingBadge = document.createElement('span');
    speakingBadge.className = 'zoom-breakout-item__member-pill is-speaking';
    speakingBadge.textContent = 'Speaking';
    meta.appendChild(speakingBadge);
  }

  if (!meta.childElementCount) {
    const quietLabel = document.createElement('span');
    quietLabel.textContent = 'In room';
    meta.appendChild(quietLabel);
  }

  info.append(name, meta);
  item.append(avatar, info);
  return item;
}

function breakoutRow(room) {
  const isCurrent = room.id === state.roomId;
  const roomParticipants = state.crossRoomParticipants.get(room.id) || [];
  const participantCount = roomParticipants.length;
  const isExpanded = state.expandedBreakoutRooms.has(room.id);

  const row = document.createElement('section');
  row.className = `zoom-breakout-item${isCurrent ? ' is-current' : ''}${isExpanded ? ' is-expanded' : ''}`;

  const summary = document.createElement('div');
  summary.className = 'zoom-breakout-item__summary';

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.className = 'zoom-breakout-item__toggle';
  toggleButton.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  toggleButton.setAttribute('aria-label', `${isExpanded ? 'Collapse' : 'Expand'} ${room.label}`);
  toggleButton.innerHTML = breakoutToggleIcon();
  toggleButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleBreakoutExpansion(room.id);
  });

  const meta = document.createElement('div');
  meta.className = 'zoom-breakout-item__meta';

  const heading = document.createElement('div');
  heading.className = 'zoom-breakout-item__heading';

  const indicator = document.createElement('span');
  indicator.className = 'zoom-breakout-item__indicator';

  const copy = document.createElement('div');
  copy.className = 'zoom-breakout-item__copy';

  const title = document.createElement('strong');
  title.textContent = room.label;

  const description = document.createElement('span');
  description.textContent = isCurrent ? 'You are currently in this room' : room.description;

  copy.append(title, description);
  heading.append(indicator, copy);

  const details = document.createElement('div');
  details.className = 'zoom-breakout-item__details';

  const badge = document.createElement('span');
  badge.className = 'zoom-breakout-item__badge';
  badge.textContent = room.badge;

  const status = document.createElement('span');
  status.className = `zoom-breakout-item__status${isCurrent ? ' is-current' : ''}`;
  status.textContent = isCurrent ? 'Current room' : breakoutParticipantCountLabel(participantCount);

  details.append(status, badge);
  meta.append(heading, details);

  const actions = document.createElement('div');
  actions.className = 'zoom-breakout-item__actions';

  const count = document.createElement('span');
  count.className = 'zoom-breakout-item__count';
  count.innerHTML = `${icon('users')}<span>${participantCount}</span>`;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-action zoom-breakout-item__action';
  button.textContent = isCurrent ? 'Current' : 'Join';
  button.disabled = isCurrent;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    void switchRoom(room.id);
  });

  actions.append(count, button);
  summary.append(toggleButton, meta, actions);
  summary.addEventListener('click', (event) => {
    if (event.target.closest('.zoom-breakout-item__action')) {
      return;
    }
    toggleBreakoutExpansion(room.id);
  });

  const members = document.createElement('div');
  members.className = 'zoom-breakout-item__members';
  members.hidden = !isExpanded;

  if (roomParticipants.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'zoom-breakout-item__empty';
    empty.textContent = 'Nobody is in this room yet.';
    members.appendChild(empty);
  } else {
    roomParticipants.forEach((participant) => {
      members.appendChild(breakoutParticipantRow(participant));
    });
  }

  row.append(summary, members);
  return row;
}

function renderBreakouts() {
  state.ui.breakoutList.replaceChildren();
  const rooms = breakoutRooms();
  const currentRoom = rooms.find((room) => room.id === state.roomId) || rooms[0];
  const validRoomIds = new Set(rooms.map((room) => room.id));
  state.expandedBreakoutRooms = new Set(
    [...state.expandedBreakoutRooms].filter((roomId) => validRoomIds.has(roomId))
  );
  state.ui.breakoutRoomCount.textContent = breakoutRoomCountLabel(state.breakoutRoomCount);
  state.ui.breakoutCurrentRoom.textContent = currentRoom ? `Current: ${currentRoom.label}` : '';
  for (const room of rooms) {
    state.ui.breakoutList.appendChild(breakoutRow(room));
  }
  if (state.ui.expandBreakoutRoomsButton) {
    state.ui.expandBreakoutRoomsButton.disabled = rooms.length === 0 || state.expandedBreakoutRooms.size === rooms.length;
  }
  if (state.ui.collapseBreakoutRoomsButton) {
    state.ui.collapseBreakoutRoomsButton.disabled = state.expandedBreakoutRooms.size === 0;
  }
}

function renderAudio() {
  if (!state.ui.audioSinks) {
    return;
  }
  state.ui.audioSinks.replaceChildren();
  const source = state.sdk?.Track?.Source;
  if (!source || !state.room) {
    return;
  }
  for (const participant of state.room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if ((publication.source === source.Microphone || publication.source === source.ScreenShareAudio) && publication.track) {
        const detached = publication.track.detach?.();
        if (Array.isArray(detached)) {
          detached.forEach((node) => node.remove());
        }
        const element = publication.track.attach();
        element.autoplay = true;
        element.muted = false;
        state.ui.audioSinks.appendChild(element);
      }
    }
  }
  refreshRecordingAudioGraph();
}

async function sendChat() {
  const body = String(state.ui.chatInput.value || '').trim();
  const pendingFiles = state.pendingFiles.slice();
  if (state.chatSending || !state.socket || (!body && pendingFiles.length === 0)) {
    return;
  }

  state.chatSending = true;

  var placeholderMsg = null;
  if (pendingFiles.length) {
    placeholderMsg = {
      id: 'local-' + Date.now(),
      body: body,
      senderId: state.participantId,
      senderName: state.displayName || 'You',
      createdAt: Date.now(),
      attachments: pendingFiles.map(function(f) {
        return { name: truncateFileName(f.name), size: f.size, localUrl: '', _progress: 0, _uploading: true };
      })
    };
    state.messages.push(placeholderMsg);
    renderSidebar();
  }

  var attachments = [];
  var failed = [];
  for (var i = 0; i < pendingFiles.length; i++) {
    var file = pendingFiles[i];
    file._uploading = true;
    file._progress = 0;
    try {
      var attachment = await uploadChatAttachment(file, function(pct) {
        file._progress = pct;
        if (placeholderMsg && placeholderMsg.attachments[i]) {
          placeholderMsg.attachments[i]._progress = pct;
          renderSidebar();
        }
      });
      var localUrl = cacheAttachmentUrl(attachment.id, file);
      attachments.push(localUrl ? { name: attachment.name, size: attachment.size, id: attachment.id, localUrl: localUrl } : attachment);
      if (placeholderMsg && placeholderMsg.attachments[i]) {
        placeholderMsg.attachments[i]._uploading = false;
        placeholderMsg.attachments[i].localUrl = localUrl || '';
      }
    } catch (uploadError) {
      file._error = uploadError?.message || 'Upload failed';
      failed.push(file);
      if (placeholderMsg && placeholderMsg.attachments[i]) {
        placeholderMsg.attachments[i]._uploading = false;
        placeholderMsg.attachments[i]._error = file._error;
      }
    }
    file._uploading = false;
    file._progress = 100;
    renderPendingFiles();
    if (placeholderMsg) renderSidebar();
  }

  if (placeholderMsg) {
    var idx = state.messages.indexOf(placeholderMsg);
    if (idx >= 0) {
      if (attachments.length) {
        placeholderMsg.attachments = attachments;
        placeholderMsg._replaced = true;
      } else if (body) {
        state.messages.splice(idx, 1);
      }
    }
  }

  if (attachments.length || body) {
    state.socket.emit('chat-message', {
      body: body,
      attachments: attachments.map(function(a) { return { id: a.id }; })
    });
  }

  state.ui.chatInput.value = '';
  state.pendingFiles = failed;
  renderPendingFiles();
  renderSidebar();

  if (failed.length) {
    setTimeout(function() {
      state.pendingFiles.forEach(function(f) { f._error = ''; });
      renderPendingFiles();
    }, 4000);
  }
  state.chatSending = false;
}

function mergeParticipant(participant) {
  if (participant?.id) {
    state.participants.set(participant.id, participant);
  }
}

function ensureSelectedScreenValid() {
  const selected = state.selectedScreenParticipantId ? state.participants.get(state.selectedScreenParticipantId) : null;
  if (state.selectedScreenParticipantId && (!selected || selected.screenStatus === 'off')) {
    state.selectedScreenParticipantId = null;
    emitScreenSelection();
    applySubscriptions();
  }
}

function applyParticipants(participants) {
  state.participants = new Map();
  for (const participant of participants || []) {
    mergeParticipant(participant);
  }
  if (!state.participants.has(state.participantId)) {
    mergeParticipant({
      ...participantPayload(),
      id: state.participantId,
      joinedAt: Date.now(),
      screenWatcherCount: 0,
      isScreenSharing: state.screenStatus === 'live'
    });
  }
  ensureSelectedScreenValid();
  if (state.roomId) {
    state.crossRoomParticipants = new Map(state.crossRoomParticipants);
    state.crossRoomParticipants.set(state.roomId, Array.from(state.participants.values()));
  }
  void syncScreen();
  renderMeeting();
}

function applyCrossRoomParticipants(snapshot) {
  const nextParticipants = new Map();

  if (snapshot && typeof snapshot === 'object') {
    for (const [roomId, participants] of Object.entries(snapshot)) {
      nextParticipants.set(
        normalizeRoomId(roomId),
        Array.isArray(participants)
          ? participants.filter((participant) => participant?.id)
          : []
      );
    }
  }

  if (state.roomId && !nextParticipants.has(state.roomId)) {
    nextParticipants.set(state.roomId, Array.from(state.participants.values()));
  }

  state.crossRoomParticipants = nextParticipants;

  if (state.ui.breakoutList) {
    renderBreakouts();
  }
}

function emitParticipantUpdate() {
  syncLocalParticipantEntry();
  state.socket?.emit('participant-update', participantPayload());
}

function emitScreenSelection() {
  state.socket?.emit('screen-selection', {
    targetParticipantId: state.selectedScreenParticipantId && state.selectedScreenParticipantId !== state.participantId ? state.selectedScreenParticipantId : null
  });
}

function selectScreen(participantId) {
  state.selectedScreenParticipantId = participantId;
  ensureSelectedScreenValid();
  emitScreenSelection();
  applySubscriptions();
  renderMeeting();
}

async function requestRemoteControl(participant) {
  try {
    const meetingId = state.roomId || window.location.pathname.split('/').pop();
    
    const response = await fetch(`/api/meetings/${meetingId}/remote-control/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        requestedUserId: participant.id,
        requestedUserName: participant.name,
        requestedUserEmail: participant.email || '',
        roomId: state.roomId
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to request remote control');
    }

    const data = await response.json();
    console.log('Remote control request sent:', data);
    showNotification(`Remote control request sent to ${participant.name}`);

    // Start controller tracking immediately - events flow via data channel
    // The recipient will receive them once they accept
    startRemoteControlController({
      _id: data.request._id,
      role: "controller",
      requestedUser: { name: participant.name, id: participant.id },
      meetingId,
    });
    
  } catch (error) {
    console.error('Failed to request remote control:', error);
    showNotification(`Failed to request remote control: ${error.message}`);
  }
}

function showNotification(message) {
  // Simple notification display
  const notification = document.createElement('div');
  notification.className = 'remote-control-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: rgba(45, 140, 255, 0.95);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    z-index: 1000;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Remote control request notification system
let remoteControlNotification = null;
let remoteControlPollingInterval = null;

async function checkRemoteControlRequests() {
  try {
    const meetingId = state.roomId || window.location.pathname.split('/').pop();
    if (!state._rcPollLogged) {
      state._rcPollLogged = true;
      console.log('[RC-POLL] checking with meetingId:', meetingId, 'socket:', !!state.socket);
    }
    
    const response = await fetch(`/api/meetings/${meetingId}/remote-control/status`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    console.log('[RC-POLL] result:', 'pending=', data.pendingRequests?.length, 'active=', data.activeSessions?.length);
    
    // Only auto-stop remote control if all sessions ended
    if ((!data.activeSessions || data.activeSessions.length === 0) && state.remoteControl.session) {
      stopRemoteControl();
    }

    // Show pending request notifications
    if (data.pendingRequests && data.pendingRequests.length > 0) {
      showRemoteControlRequestNotification(data.pendingRequests[0]);
    } else {
      hideRemoteControlRequestNotification();
    }
  } catch (error) {
    console.error('Failed to check remote control requests:', error);
  }
}

function showRemoteControlRequestNotification(request) {
  // Don't show if already showing
  if (remoteControlNotification) {
    return;
  }

  const notification = document.createElement('div');
  notification.className = 'remote-control-request-notification';
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: rgba(15, 23, 42, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 16px 20px;
    min-width: 320px;
    z-index: 10000;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    animation: slideIn 0.3s ease-out;
  `;

  notification.innerHTML = `
    <div style="color: white; margin-bottom: 12px;">
      <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;">Remote Control Request</div>
      <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7);">
        ${request.requestedBy?.name || 'A participant'} wants to control your screen
      </div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button type="button" class="remote-control-accept-btn" style="
        flex: 1;
        background: rgba(30, 208, 155, 0.9);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      ">Accept</button>
      <button type="button" class="remote-control-decline-btn" style="
        flex: 1;
        background: rgba(239, 68, 68, 0.9);
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      ">Decline</button>
    </div>
  `;

  // Add hover effects
  const acceptBtn = notification.querySelector('.remote-control-accept-btn');
  const declineBtn = notification.querySelector('.remote-control-decline-btn');
  
  acceptBtn.addEventListener('mouseenter', () => acceptBtn.style.background = 'rgba(30, 208, 155, 1)');
  acceptBtn.addEventListener('mouseleave', () => acceptBtn.style.background = 'rgba(30, 208, 155, 0.9)');
  declineBtn.addEventListener('mouseenter', () => declineBtn.style.background = 'rgba(239, 68, 68, 1)');
  declineBtn.addEventListener('mouseleave', () => declineBtn.style.background = 'rgba(239, 68, 68, 0.9)');

  // Handle accept
  acceptBtn.addEventListener('click', async () => {
    await respondToRemoteControlRequest(request._id, true);
  });

  // Handle decline
  declineBtn.addEventListener('click', async () => {
    await respondToRemoteControlRequest(request._id, false);
  });

  document.body.appendChild(notification);
  remoteControlNotification = notification;
}

function hideRemoteControlRequestNotification() {
  if (remoteControlNotification) {
    remoteControlNotification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      if (remoteControlNotification) {
        remoteControlNotification.remove();
        remoteControlNotification = null;
      }
    }, 300);
  }
}

async function respondToRemoteControlRequest(requestId, accepted) {
  try {
    const meetingId = state.roomId || window.location.pathname.split('/').pop();
    const endpoint = accepted ? 'allow' : 'decline';
    
    const response = await fetch(`/api/meetings/${meetingId}/remote-control/${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requestId })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to respond to request');
    }

    hideRemoteControlRequestNotification();
    
    if (accepted) {
      const data = await response.json();
      showNotification('Remote control request accepted');
      if (data.session && data.session.role === "controlled") {
        startRemoteControlControlled(data.session);
      }
    } else {
      showNotification('Remote control request declined');
    }
  } catch (error) {
    console.error('Failed to respond to remote control request:', error);
    showNotification(`Failed to respond: ${error.message}`);
  }
}

function startRemoteControlPolling() {
  remoteControlPollingInterval = setInterval(checkRemoteControlRequests, 2000);
  checkRemoteControlRequests();
}

function stopRemoteControlPolling() {
  if (remoteControlPollingInterval) {
    clearInterval(remoteControlPollingInterval);
    remoteControlPollingInterval = null;
  }
  hideRemoteControlRequestNotification();
}

function isDesktopShell() {
  return typeof window !== "undefined" && window.infovibeDesktop?.remoteControl;
}

function sendRemoteControlEvent(targetParticipantId, event) {
  // Always use Socket.IO for cross-machine event transport
  state.socket?.emit("remote-control-event", { targetParticipantId, event });
}

function listenRemoteControlEvent(handler) {
  // Always use Socket.IO - this is the cross-machine transport
  // The server relays events to the correct participant
  state.socket?.on("remote-control-event", handler);
}

function unlistenRemoteControlEvent(handler) {
  state.socket?.off("remote-control-event", handler);
}

async function startRemoteControlController(session) {
  if (!state.room) return;
  stopRemoteControl();
  state.remoteControl.session = session;

  try {
    const tracker = new RemoteControlMouseTracker((event) => {
      try {
        sendRemoteControlEvent(session.requestedUser?.id, event);
      } catch {}
    });
    const keyTracker = new RemoteControlKeyboardTracker((event) => {
      try {
        sendRemoteControlEvent(session.requestedUser?.id, event);
      } catch {}
    });
    tracker.start();
    keyTracker.start();
    state.remoteControl.tracker = { mouse: tracker, keyboard: keyTracker };

    window.parent.postMessage({
      source: "infovibe-meet",
      type: "remote-control-session",
      status: "started",
      role: "controller",
      controller: state.displayName,
      controlled: session.requestedUser.name,
      meetingId: state.meetingId,
    }, state.parentOrigin || "*");

    showNotification(`You are now controlling ${session.requestedUser.name}'s screen`);
  } catch (err) {
    console.error("Failed to start remote control controller:", err);
    stopRemoteControl();
  }
}

async function startRemoteControlControlled(session) {
  if (!state.room) return;
  stopRemoteControl();

  state.remoteControl.session = session;
  showNotification('Remote control activated - listening for events');

  if (isDesktopShell()) {
    // OS-level injection via Electron IPC
    let firstEventReceived = false;
    const handleEvent = (payload) => {
      const eventData = payload?.event || payload;
      if (!eventData || !eventData.type) return;
      if (!firstEventReceived) {
        firstEventReceived = true;
        showNotification('Receiving remote control events...');
      }
      try {
        window.infovibeDesktop.remoteControl.injectEvent(eventData).catch(() => {});
      } catch {}
    };
    listenRemoteControlEvent(handleEvent);
    state.remoteControl._dataHandler = handleEvent;
  } else {
    // Browser fallback: DOM-level simulation
    const simulator = new RemoteControlEventSimulator();
    simulator.showRemoteCursor();
    state.remoteControl.simulator = simulator;

    let firstBrowserEvent = false;
    const handleEvent = (payload) => {
      const eventData = payload?.event || payload;
      if (!eventData || !eventData.type) return;
      if (!firstBrowserEvent) {
        firstBrowserEvent = true;
        showNotification('Receiving remote control events...');
      }
      try {
        simulator.simulateEvent(eventData);
      } catch {}
    };

    listenRemoteControlEvent(handleEvent);
    state.remoteControl._dataHandler = handleEvent;
  }

  window.parent.postMessage({
    source: "infovibe-meet",
    type: "remote-control-session",
    status: "started",
    role: "controlled",
    controller: session.requestedBy.name,
    controlled: state.displayName,
    meetingId: state.meetingId,
  }, state.parentOrigin || "*");

  showNotification(`${session.requestedBy.name} is controlling your screen`);
}

function stopRemoteControl() {
  if (state.remoteControl.tracker) {
    if (state.remoteControl.tracker.mouse) state.remoteControl.tracker.mouse.destroy();
    if (state.remoteControl.tracker.keyboard) state.remoteControl.tracker.keyboard.destroy();
    state.remoteControl.tracker = null;
  }
  if (state.remoteControl.simulator) {
    state.remoteControl.simulator.destroy();
    state.remoteControl.simulator = null;
  }
  if (state.remoteControl._dataHandler) {
    unlistenRemoteControlEvent(state.remoteControl._dataHandler);
    state.remoteControl._dataHandler = null;
  }

  if (state.remoteControl.session) {
    // Expire the session via API
    const sid = state.remoteControl.session._id;
    if (sid) {
      fetch(`/api/meetings/${state.meetingId}/remote-control/decline`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: sid }),
      }).catch(() => {});
    }

    window.parent.postMessage({
      source: "infovibe-meet",
      type: "remote-control-session",
      status: "ended",
      role: state.remoteControl.session.role,
      meetingId: state.meetingId,
    }, state.parentOrigin || "*");
    state.remoteControl.session = null;
  }
}

async function ensureDevices() {
  const hasMic = Boolean(state.micTrack);
  const hasCamera = Boolean(state.cameraTrack);
  if (hasMic && hasCamera) {
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: hasMic ? false : true,
      video: hasCamera ? false : cloneCameraVideoConstraints()
    });
    if (!hasMic && !state.micTrack) {
      state.micTrack = stream.getAudioTracks()[0] || null;
      state.isAudioEnabled = state.isAudioEnabled && Boolean(state.micTrack);
    }
    if (!hasCamera && !state.cameraTrack) {
      state.cameraTrack = stream.getVideoTracks()[0] || null;
      applyTrackContentHint(state.cameraTrack, 'motion');
      state.isVideoEnabled = state.isVideoEnabled && Boolean(state.cameraTrack);
    }
    if (state.micTrack || state.cameraTrack) {
      return;
    }
  } catch {}
  if (!state.micTrack) try {
    const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.micTrack = audio.getAudioTracks()[0] || state.micTrack;
    state.isAudioEnabled = state.isAudioEnabled && Boolean(state.micTrack);
  } catch {}
  if (!state.cameraTrack) try {
    const video = await navigator.mediaDevices.getUserMedia({
      video: cloneCameraVideoConstraints()
    });
    state.cameraTrack = video.getVideoTracks()[0] || state.cameraTrack;
    applyTrackContentHint(state.cameraTrack, 'motion');
    state.isVideoEnabled = state.isVideoEnabled && Boolean(state.cameraTrack);
  } catch {}
}

async function ensureMicTrack() {
  if (state.micTrack?.readyState === 'live') {
    return state.micTrack;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.micTrack = stream.getAudioTracks()[0] || null;
  } catch {
    state.micTrack = null;
  }

  return state.micTrack;
}

async function ensureCameraTrack() {
  if (state.cameraTrack?.readyState === 'live') {
    applyTrackContentHint(state.cameraTrack, 'motion');
    return state.cameraTrack;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: cloneCameraVideoConstraints()
    });
    state.cameraTrack = stream.getVideoTracks()[0] || null;
    applyTrackContentHint(state.cameraTrack, 'motion');
  } catch {
    state.cameraTrack = null;
  }

  return state.cameraTrack;
}

function connectSocket() {
  if (typeof window === 'undefined' || typeof window.io !== 'function') {
    return Promise.reject(new Error('Realtime connection is not available'));
  }

  return new Promise((resolve, reject) => {
    const socket = window.io();
    state.socket = socket;
    let settled = false;

    function resolveOnce() {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    }

    function rejectOnce(error) {
      if (settled) {
        return;
      }
      settled = true;
      reject(error instanceof Error ? error : new Error(error?.message || 'Could not join room'));
    }

    socket.once('connect', () => {
      socket.emit('join-room', joinPayload());
    });

    socket.once('connect_error', (error) => {
      rejectOnce(new Error(error?.message || 'Could not connect to meeting'));
    });

    socket.once('disconnect', () => {
      if (!settled) {
        rejectOnce(new Error('Connection lost while joining meeting'));
      }
    });

    socket.on('join-room-error', (payload = {}) => {
      state.prejoinJoinBlock = payload;
      state.prejoinMeeting = payload.meeting || state.prejoinMeeting;
      rejectOnce(new Error(payload.message || 'Could not join room'));
    });

    socket.on('client-join-pending', (payload = {}) => {
      state.prejoinBusy = false;
      state.prejoinError = '';
      state.prejoinJoinBlock = {
        ...payload,
        code: payload.code || 'waiting-for-approval'
      };
      state.prejoinMeeting = payload.meeting || state.prejoinMeeting;
      state.connectionStatus = payload.message || 'Waiting for host approval';
      renderPrejoin();
    });

    socket.on('joined-room', (payload = {}) => {
      state.roomId = normalizeRoomId(payload.roomId || state.roomId);
      state.prejoinRoomId = state.roomId;
      state.participantId = payload.participantId || state.participantId;
      state.profileId = payload.profileId || state.profileId;
      state.meeting = payload.meeting || state.meeting || state.prejoinMeeting;
      state.prejoinMeeting = state.meeting || state.prejoinMeeting;
      state.prejoinJoinBlock = null;
      state.meetingId = payload.meeting?.id || payload.meetingConfig?.meetingId || state.meetingId || getBaseRoomId(state.roomId);
      state.meetingConfig = payload.meetingConfig || state.meetingConfig;
      state.breakoutRoomCount = normalizeBreakoutRoomCount(payload.meetingConfig?.breakoutRoomCount, state.breakoutRoomCount);
      state.isHost = Boolean(payload.meetingConfig?.isHost ?? payload.meeting?.isHost ?? state.isHost);
      state.clientMeetingRole = String(payload.meetingConfig?.clientMeetingRole || state.clientMeetingRole || '');
      state.prejoinBusy = true;
      state.connectionStatus = 'Joining meeting';

      if (!state.isHost) {
        state.pendingJoinRequests = [];
      }

      if (state.view === 'prejoin') {
        renderPrejoin();
      }

      applyParticipants([
        payload.participant,
        ...(Array.isArray(payload.existingParticipants) ? payload.existingParticipants : [])
      ].filter(Boolean));

      applyCrossRoomParticipants(payload.crossRoomParticipants || {});
      postParentEvent('room-joined', { roomId: state.roomId });
      markClientMeetingJoined(state.roomId);
      resolveOnce();
    });

    socket.on('pending-join-requests', (payload = {}) => {
      state.pendingJoinRequests = Array.isArray(payload.items)
        ? payload.items.filter((item) => item?.participantId)
        : [];

      if (state.view === 'meeting') {
        renderPendingJoinRequests();
      }
    });

    socket.on('participants-snapshot', (participants) => {
      applyParticipants(participants);
    });

    socket.on('cross-room-participants-snapshot', (snapshot) => {
      applyCrossRoomParticipants(snapshot);
    });

    socket.on('chat-message', (message) => {
      receiveChatMessage(message);
    });

    socket.on('recording-requested', (payload = {}) => {
      if (!state.isHost) return;
      state.recordingRequestFrom = payload;
      renderMeeting();
    });

    socket.on('recording-response', (payload = {}) => {
      if (payload.allowed) {
        state.recordingGranted = true;
        state.recordingStatus = 'idle';
        state.recordingRequestFrom = null;
        renderMeeting();
        postParentEvent('recording-state', { action: 'toggle' });
      } else {
        state.recordingStatus = 'idle';
        state.recordingRequestFrom = null;
        state.connectionStatus = 'Host denied recording';
        renderMeeting();
      }
    });

    socket.on('recording-granted', (payload = {}) => {
      state.recordingStatus = 'idle';
      state.recordingGranted = Boolean(payload.granted);
      state.recordingRequestFrom = null;
      renderMeeting();
      if (payload.granted) {
        postParentEvent('recording-state', { action: 'toggle' });
      }
    });

    socket.on('meeting-ended', async () => {
      state.connectionStatus = 'The meeting has been ended by the host';
      await teardown(true);
      setDashboardRoute('home');
      state.dashboardError = 'The meeting has been ended by the host';
      renderDashboard();
      void loadDashboardData();
    });
  });
}
async function ensureSdk() {
  if (!state.sdk) {
    state.sdk = await import('/vendor/livekit-client.esm.mjs');
  }
  return state.sdk;
}

async function fetchToken() {
  const response = await requestJson('/api/livekit/token', {
    method: 'POST',
    body: JSON.stringify({
      roomId: state.roomId,
      name: state.displayName,
      participantId: state.participantId
    })
  });
  return response;
}

async function connectLiveKit() {
  const sdk = await ensureSdk();
  const { Room, RoomEvent } = sdk;
  const { url, token } = await fetchToken();
  state.lastLiveKitUrl = url;
  const room = new Room({ adaptiveStream: true, dynacast: true });
  state.room = room;
  room.on(RoomEvent.ConnectionStateChanged, (value) => {
    state.connectionStatus = statusText(value);
    renderMeeting();
  });
  room.on(RoomEvent.ParticipantConnected, () => {
    applySubscriptions();
    renderMeeting();
  });
  room.on(RoomEvent.ParticipantDisconnected, () => {
    applySubscriptions();
    renderMeeting();
  });
  room.on(RoomEvent.TrackPublished, () => {
    applySubscriptions();
    renderMeeting();
  });
  room.on(RoomEvent.TrackUnpublished, () => {
    applySubscriptions();
    renderMeeting();
  });
  room.on(RoomEvent.TrackSubscribed, () => {
    renderAudio();
    renderMeeting();
  });
  room.on(RoomEvent.TrackUnsubscribed, () => {
    renderAudio();
    renderMeeting();
  });
  room.on(RoomEvent.TrackMuted, () => {
    renderAudio();
    renderMeeting();
  });
  room.on(RoomEvent.TrackUnmuted, () => {
    renderAudio();
    renderMeeting();
  });
  await room.connect(url, token, { autoSubscribe: false });
  state.connectionStatus = 'Connected';
  await Promise.allSettled([syncMic(), syncCamera()]);
  applySubscriptions();
  renderMeeting();
  
  // Start polling for remote control requests
  startRemoteControlPolling();
}

function applySubscriptions() {
  const source = state.sdk?.Track?.Source;
  if (!source || !state.room) {
    return;
  }
  const recordingActive = state.recordingStatus === 'starting' || state.recordingStatus === 'recording';
  const recordingScreenParticipants = recordingActive ? new Set(screenParticipants().map((participant) => participant.id)) : new Set();
  for (const participant of state.room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      const shouldSubscribe = publication.source === source.Microphone
        || publication.source === source.ScreenShareAudio
        || (publication.source === source.ScreenShare && (participant.identity === state.selectedScreenParticipantId || recordingScreenParticipants.has(participant.identity)))
        || publication.source === source.Camera;
      Promise.resolve(publication.setSubscribed(shouldSubscribe)).catch(() => {});
    }
  }
  renderAudio();
}

async function syncMic() {
  const source = state.sdk?.Track?.Source;
  if (!source || !state.room) {
    return;
  }
  if (!state.micTrack) {
    if (state.micPublication) {
      const publishedTrack = state.micPublication.track || null;
      if (publishedTrack) {
        await state.room.localParticipant.unpublishTrack(publishedTrack, false);
      }
    }
    state.micPublication = null;
    refreshRecordingAudioGraph();
    return;
  }
  if (!state.micPublication) {
    state.micPublication = await state.room.localParticipant.publishTrack(state.micTrack, {
      source: source.Microphone,
      name: `${state.participantId}-mic`
    });
  }
  await (state.isAudioEnabled ? state.micPublication.unmute() : state.micPublication.mute());
  refreshRecordingAudioGraph();
}

async function syncCamera() {
  const source = state.sdk?.Track?.Source;
  if (!source || !state.room) {
    return;
  }
  if (!state.cameraTrack) {
    if (state.cameraPublication) {
      const publishedTrack = state.cameraPublication.track || null;
      if (publishedTrack) {
        await state.room.localParticipant.unpublishTrack(publishedTrack, false);
      }
    }
    state.cameraPublication = null;
    return;
  }
  applyTrackContentHint(state.cameraTrack, 'motion');
  if (!state.cameraPublication) {
    state.cameraPublication = await state.room.localParticipant.publishTrack(state.cameraTrack, {
      source: source.Camera,
      name: `${state.participantId}-camera`,
      simulcast: true,
      videoEncoding: { ...CAMERA_PUBLISH_ENCODING }
    });
  }
  await (state.isVideoEnabled ? state.cameraPublication.unmute() : state.cameraPublication.mute());
}

async function syncScreen() {
  if (state.screenSyncing) {
    state.screenSyncQueued = true;
    return;
  }
  state.screenSyncing = true;
  try {
    if (!state.room) {
      return;
    }
    if (state.screenTrack && state.screenStatus !== 'off') {
      await publishScreen();
      return;
    }
    if (state.screenPublication) {
      await unpublishScreen(state.screenTrack ? 'ready' : 'off');
    }
  } finally {
    state.screenSyncing = false;
    if (state.screenSyncQueued) {
      state.screenSyncQueued = false;
      await syncScreen();
    }
  }
}

async function publishScreen() {
  const source = state.sdk?.Track?.Source;
  if (!source || !state.room || !state.screenTrack || state.screenPublication) {
    return;
  }
  applyTrackContentHint(state.screenTrack, 'detail');
  state.screenPublication = await state.room.localParticipant.publishTrack(state.screenTrack, {
    source: source.ScreenShare,
    name: `${state.participantId}-screen`,
    simulcast: false,
    degradationPreference: 'maintain-resolution',
    videoEncoding: { ...currentScreenShareEncoding() }
  });
  state.screenStatus = 'live';
  emitParticipantUpdate();
  renderMeeting();
}

async function unpublishScreen(nextStatus) {
  if (state.room && state.screenTrack && state.screenPublication) {
    await state.room.localParticipant.unpublishTrack(state.screenTrack, false);
  }
  state.screenPublication = null;
  state.screenStatus = nextStatus;
  emitParticipantUpdate();
  renderMeeting();
}

async function toggleMic() {
  if (!state.isAudioEnabled) {
    state.micTrack = await ensureMicTrack();
    state.isAudioEnabled = Boolean(state.micTrack);
  } else {
    state.isAudioEnabled = false;
    stopTrack(state.micTrack);
    state.micTrack = null;
  }
  await syncMic().catch(() => {});
  emitParticipantUpdate();
  if (state.view === 'prejoin') {
    renderPrejoin();
    return;
  }
  renderMeeting();
}

async function toggleCamera() {
  if (!state.isVideoEnabled) {
    state.cameraTrack = await ensureCameraTrack();
    state.isVideoEnabled = Boolean(state.cameraTrack);
  } else {
    state.isVideoEnabled = false;
    stopTrack(state.cameraTrack);
    state.cameraTrack = null;
  }
  await syncCamera().catch(() => {});
  if (state.view === 'prejoin') {
    renderPrejoin();
  }
  emitParticipantUpdate();
  if (state.view === 'meeting') {
    renderMeeting();
  }
}

async function toggleScreen() {
  console.log('toggleScreen called, screenStatus:', state.screenStatus);
  if (state.screenStatus !== 'off') {
    console.log('toggleScreen: stopping active share');
    await stopScreen();
    return;
  }
  try {
    console.log('toggleScreen: calling getDisplayMedia...');
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: screenShareVideoConstraints(),
      audio: false
    });
    console.log('toggleScreen: stream obtained, tracks:', stream.getVideoTracks().length);
    state.screenTrack = stream.getVideoTracks()[0] || null;
    if (!state.screenTrack) {
      return;
    }
    applyTrackContentHint(state.screenTrack, 'detail');
    await state.screenTrack.applyConstraints?.(screenShareVideoConstraints()).catch(() => {});
    state.screenTrack.addEventListener('ended', () => {
      void stopScreen();
    }, { once: true });
    state.screenStatus = 'ready';
    postParentEvent('screen-share', { screenStatus: 'ready' });
    markClientMeetingScreenShareStarted(state.roomId);
    emitParticipantUpdate();
    renderMeeting();
    await syncScreen();
  } catch (err) {
    console.error('toggleScreen error:', err);
    state.connectionStatus = 'Screen share cancelled';
    renderMeeting();
  }
}

async function stopScreen() {
  clearTimeout(state.screenTimer);
  if (state.screenPublication) {
    await unpublishScreen('ready');
  }
  stopTrack(state.screenTrack);
  state.screenTrack = null;
  state.screenPublication = null;
  state.screenStatus = 'off';
  postParentEvent('screen-share', { screenStatus: 'off' });
  if (state.clientMeetingScreenShareActive) {
    state.clientMeetingScreenShareActive = false;
    void postClientMeetingActivity('screen-share-stop', { roomId: state.roomId });
  }
  if (state.selectedScreenParticipantId === state.participantId) {
    state.selectedScreenParticipantId = null;
  }
  emitScreenSelection();
  emitParticipantUpdate();
  renderMeeting();
}

async function startRecording() {
  state.recordingRequestId = '';
  state.recordingStatus = 'idle';
  state.recordingStartedAt = 0;
  state.recordingMimeType = '';
  state.recordingChunks = [];
  postRecordingState();
  return null;
}

async function stopRecording() {
  state.recordingRequestId = '';
  state.recordingStartedAt = 0;
  state.recordingMimeType = '';
  state.recordingChunks = [];
  state.recordingStatus = 'idle';
  postRecordingState();
  return null;
}

async function toggleRecording() {
  return null;
}

async function switchRoom(roomId) {
  if (roomId === state.roomId) {
    return;
  }
  await teardown(false, { preservePreviewDevices: true });
  state.roomId = roomId;
  state.prejoinRoomId = roomId;
  state.bypassPrejoin = true;
  setMeetingRoute(state.meetingId || getBaseRoomId(roomId), roomId);
  await mountMeeting();
  closeBreakoutModal();
}

function closeStandaloneMeetingWindow() {
  if (typeof window === 'undefined' || window.parent !== window) {
    return false;
  }

  let fallbackUrl = state.clientMeetingJoinUrl || '/';

  try {
    if (!state.clientMeetingJoinUrl && document.referrer) {
      fallbackUrl = document.referrer;
    }
  } catch {}

  window.close();
  window.setTimeout(() => {
    if (!window.closed) {
      window.location.replace(fallbackUrl);
    }
  }, 150);

  return true;
}

async function leaveMeeting() {
  const lastPage = state.dashboardPage || 'home';
  await teardown(true, { notifyMeetingLeft: true });

  if (state.closeOnLeave && !state.isEmbedded && closeStandaloneMeetingWindow()) {
    return;
  }

  setDashboardRoute(lastPage);
  renderDashboard();
  void loadDashboardData();
}

async function endMeetingForAll() {
  if (!state.isHost) {
    return;
  }
  const shouldEnd = window.confirm('End this meeting for everyone?');
  if (!shouldEnd) {
    return;
  }
  try {
    state.socket?.emit('end-meeting');
    state.connectionStatus = 'Ending meeting';
    renderMeeting();
  } catch {}
}

async function teardown(clearParticipants, options = {}) {
  const preservePreviewDevices = Boolean(options.preservePreviewDevices);
  const notifyMeetingLeft = Boolean(options.notifyMeetingLeft);
  const previousRoomId = state.roomId;
  closeClientMeetingActivity(false, previousRoomId);
  clearTimeout(state.screenTimer);
  if (state.recordingStatus !== 'idle') {
    await stopRecording();
  }
  state.recordingRequestId = '';
  try {
    state.socket?.emit('leave-room');
  } catch {}
  state.socket?.disconnect();
  state.socket = null;
  state.room?.disconnect();
  state.room = null;
  stopTrack(state.screenTrack);
  state.screenTrack = null;
  state.screenPublication = null;
  state.cameraPublication = null;
  state.micPublication = null;
  if (!preservePreviewDevices) {
    releasePreviewDevices();
  }
  resetEphemeralChatState();
  state.sidebarMode = null;
  state.settingsOpen = false;
  state.selectedScreenParticipantId = null;
  state.screenStatus = 'off';
  state.connectionStatus = clearParticipants ? 'Offline' : 'Switching rooms';
  state.meeting = clearParticipants ? null : state.meeting;
  state.meetingConfig = clearParticipants ? null : state.meetingConfig;
  state.isHost = clearParticipants ? Boolean(state.prejoinMeeting?.isHost) : state.isHost;
  state.pendingJoinRequests = [];
  if (clearParticipants) {
    state.participants = new Map();
    state.crossRoomParticipants = new Map();
  }
  postParentEvent('room-left', { roomId: previousRoomId });
  if (notifyMeetingLeft) {
    postParentEvent('meeting-left', { roomId: previousRoomId });
  }
}

async function mountMeeting() {
  state.prejoinBusy = true;
  state.prejoinError = '';
  resetEphemeralChatState();
  state.sidebarMode = null;
  state.connectionStatus = 'Joining meeting';
  state.roomId = normalizeRoomId(state.prejoinRoomId || state.roomId || state.meetingId || 'main-room');
  renderPrejoin();
  try {
    await connectSocket();
    state.prejoinJoinBlock = null;
    state.prejoinError = '';
    setMeetingRoute(state.meetingId || getBaseRoomId(state.roomId), state.roomId);
    await connectLiveKit();
    state.prejoinBusy = false;
    state.bypassPrejoin = false;
    state.view = 'meeting';
    renderShell();
    renderMeeting();
    void loadDashboardData();
  } catch (error) {
    const message = error?.message || 'Connection failed';
    await teardown(true, { preservePreviewDevices: true });
    state.prejoinBusy = false;
    state.bypassPrejoin = false;
    state.connectionStatus = message;
    const isJoinBlockError = Boolean(state.prejoinJoinBlock && state.prejoinJoinBlock.message === message);
    if (isJoinBlockError) {
      state.prejoinError = '';
    } else {
      state.prejoinJoinBlock = null;
      state.prejoinError = formatPrejoinConnectionError(error, state.lastLiveKitUrl);
    }
    renderPrejoin();
  }
}

async function bootFromRoute() {
  const route = parseLocationRoute();
  state.displayName = normalizeName(localStorage.getItem(NAME_KEY) || state.displayName || 'Guest');
  if (route.kind === 'dashboard') {
    setDashboardRoute(route.page);
    renderDashboard();
    void loadDashboardData();
    return;
  }
  await openMeetingForPrejoin(route.meetingId, route.roomId, null, route.config || null);
}

function handleDesktopShellMessage(event) {
  if (!state.desktopShell) {
    return;
  }

  if (state.parentOrigin && event.origin !== state.parentOrigin) {
    return;
  }

  if (event.data?.source !== 'infovibe-desktop-shell') {
    return;
  }

  if (event.data.type === 'request-recording-state') {
    postRecordingState();
  }
}

window.addEventListener('message', handleDesktopShellMessage);
window.addEventListener('beforeunload', () => {
  stopRemoteControlPolling();
  stopRemoteControl();
  closeClientMeetingActivity(true, state.roomId);
});
window.addEventListener('popstate', () => {
  void bootFromRoute();
});

void bootFromRoute();
