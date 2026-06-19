const path = require('path');
const fs = require('fs');
const http = require('http');
const { randomUUID } = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const { createMeetingStore } = require('./mongo-meeting-store');

let AccessToken = null;
try {
  ({ AccessToken } = require('livekit-server-sdk'));
} catch {}

function loadEnvFile(filePath, override = false) {
  try {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (override || !(key in process.env)) process.env[key] = value;
    }
  } catch {}
}

loadEnvFile(path.join(__dirname, '.env.example'));
loadEnvFile(path.join(__dirname, '.env'), true);

const PORT = Number(process.env.PORT || 3100);
const publicPath = path.join(__dirname, 'public');
const indexPath = path.join(publicPath, 'index.html');
const livekitClientDistPath = path.join(__dirname, 'node_modules', 'livekit-client', 'dist');
const chatUploadPath = path.join(__dirname, 'data', 'chat-temp');
const recordingUploadPath = path.join(__dirname, 'data', 'recordings');
const chatFileTtlMs = 5 * 24 * 60 * 60 * 1000;
const MAX_RECORDING_UPLOAD_MB = 500;

const MONGODB_URL = String(process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017').trim();
const MONGODB_DB_NAME = String(process.env.MONGODB_DB_NAME || 'infovibex_meet').trim();
const LIVEKIT_URL = String(process.env.LIVEKIT_URL || '').trim();
const LIVEKIT_SIGNAL_PORT = Number(process.env.LIVEKIT_SIGNAL_PORT || 7880);
const LIVEKIT_API_KEY = String(process.env.LIVEKIT_API_KEY || '').trim();
const LIVEKIT_API_SECRET = String(process.env.LIVEKIT_API_SECRET || '').trim();

const MIN_BREAKOUT_ROOM_COUNT = 1;
const MAX_BREAKOUT_ROOM_COUNT = 50;
const maxChatMessageLength = 600;
const maxChatFilesPerMessage = 5;
const maxChatFileBytes = 5 * 1024 * 1024 * 1024;
const maxChatFilesTotalBytes = 10 * 1024 * 1024 * 1024;
const maxRecordingBytes = MAX_RECORDING_UPLOAD_MB * 1024 * 1024;
const temporaryChatFiles = new Map();
const roomAttachmentIndex = new Map();
const meetingStore = createMeetingStore({ mongoUrl: MONGODB_URL, dbName: MONGODB_DB_NAME });
const ALWAYS_AVAILABLE_MEETING_IDS = new Set(['miu-internal', 'company-office', 'tm-company-office']);
const pendingMeetingEndTimers = new Map();
const ROOM_SWITCH_GRACE_PERIOD_MS = 5000;
const pendingClientJoinApprovals = new Map();
const approvedClientJoinParticipants = new Map();
const CLIENT_JOIN_APPROVAL_TTL_MS = 30 * 1000;
const CLIENT_JOIN_APPROVAL_GRANT_TTL_MS = 2 * 60 * 1000;

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 8 * 1024 * 1024
});

const rooms = new Map();
const meetingConfigs = new Map();
const recordingGrants = new Map();

fs.mkdirSync(chatUploadPath, { recursive: true });
fs.mkdirSync(recordingUploadPath, { recursive: true });

function sanitizeRoomId(value) {
  const roomId = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40);

  return roomId || 'main-room';
}

function getBaseRoomId(roomId) {
  return String(roomId || '').replace(/-room-\d+$/, '') || 'main-room';
}

function sanitizeBreakoutRoomCount(value, fallback = 50) {
  const count = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(count)) {
    return fallback;
  }
  return Math.min(MAX_BREAKOUT_ROOM_COUNT, Math.max(0, count));
}

function sanitizeName(value) {
  const name = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);

  return name || 'Guest';
}

function sanitizeProfileId(value, fallback = '') {
  const profileId = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);

  return profileId || fallback;
}

function ensureProfileId(value) {
  return sanitizeProfileId(value, `u-${randomUUID().replace(/-/g, '').slice(0, 16)}`);
}

function sanitizeClientMeetingTenantId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 120);
}

function sanitizeClientMeetingToken(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 120);
}

function sanitizeClientMeetingRole(value) {
  const role = String(value || '').toLowerCase().trim();
  return ['guest', 'host', 'internal'].includes(role) ? role : '';
}

function sanitizeMeetingType(value) {
  const type = String(value || '').toLowerCase().trim();
  return ['instant', 'scheduled', 'personal'].includes(type) ? type : 'instant';
}

function sanitizeMeetingTitle(value, fallback = 'New meeting') {
  const title = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);

  return title || fallback;
}

function sanitizeMeetingDescription(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function sanitizeIsoDate(value, fallback = '') {
  const parsedDate = new Date(value || '');
  return Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString() : fallback;
}

function createMeetingId(prefix = 'meet') {
  return sanitizeRoomId(`${prefix}-${randomUUID().replace(/-/g, '').slice(0, 24)}`);
}

function resolveMeetingTitle(type, roomId, title, hostName) {
  if (String(title || '').trim()) {
    return sanitizeMeetingTitle(title);
  }

  if (type === 'personal') {
    return sanitizeMeetingTitle(hostName ? `${hostName}'s personal room` : 'Personal room');
  }

  if (type === 'scheduled') {
    return sanitizeMeetingTitle(`Scheduled meeting ${roomId}`);
  }

  return sanitizeMeetingTitle(`Meeting ${roomId}`);
}

function createRecordingDownloadUrl(recording) {
  if (!recording?.id || !recording?.downloadToken) {
    return '';
  }

  return `/api/recordings/${encodeURIComponent(recording.id)}?token=${encodeURIComponent(recording.downloadToken)}`;
}

function formatDurationLabel(durationMs) {
  const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function serializeMeeting(meeting, profileId = '') {
  if (!meeting) {
    return null;
  }

  const safeProfileId = sanitizeProfileId(profileId);
  return {
    id: meeting.id,
    roomId: meeting.roomId,
    title: meeting.title,
    description: meeting.description || '',
    type: meeting.type || 'instant',
    status: meeting.status || 'active',
    startsAt: meeting.startsAt || '',
    endedAt: meeting.endedAt || '',
    createdAt: meeting.createdAt || '',
    updatedAt: meeting.updatedAt || '',
    lastStartedAt: meeting.lastStartedAt || '',
    breakoutRoomCount: sanitizeBreakoutRoomCount(meeting.breakoutRoomCount),
    hostName: String(meeting.hostName || ''),
    hostParticipantId: String(meeting.hostParticipantId || ''),
    hostProfileId: String(meeting.hostProfileId || ''),
    activeSessionId: String(meeting.activeSessionId || ''),
    isHost: Boolean(safeProfileId && safeProfileId === String(meeting.hostProfileId || '')),
    joinPath: `/meeting/${meeting.id}`
  };
}

function serializeSession(session) {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    meetingId: session.meetingId,
    roomId: session.roomId,
    title: session.title,
    type: session.type,
    startedAt: session.startedAt || '',
    endedAt: session.endedAt || '',
    hostName: String(session.hostName || ''),
    joinPath: `/meeting/${session.meetingId}`
  };
}

function serializeRecording(recording) {
  if (!recording) {
    return null;
  }

  return {
    id: recording.id,
    meetingId: recording.meetingId,
    title: recording.title,
    createdAt: recording.createdAt || '',
    url: String(recording.url || createRecordingDownloadUrl(recording) || ''),
    hostName: String(recording.hostName || ''),
    durationLabel: String(recording.durationLabel || '')
  };
}

function sendServerError(response, error, fallback = 'Request failed') {
  response.status(500).json({
    error: error?.message || fallback
  });
}

function getMeetingJoinBlock(meeting, profileId) {
  if (!meeting) {
    return null;
  }

  const safeProfileId = sanitizeProfileId(profileId);
  const isHost = Boolean(safeProfileId && safeProfileId === String(meeting.hostProfileId || ''));

  const isAlwaysAvailableMeeting = isAlwaysAvailableMeetingId(meeting.id) || isAlwaysAvailableMeetingId(meeting.roomId);

  if (meeting.status === 'ended' && meeting.type !== 'personal' && !isAlwaysAvailableMeeting) {
    return {
      code: 'meeting-ended',
      message: 'The meeting has been ended by the host'
    };
  }

  if (meeting.type === 'scheduled' && meeting.startsAt && new Date(meeting.startsAt).getTime() > Date.now() && !isHost) {
    return {
      code: 'meeting-not-started',
      message: 'The meeting has not started yet',
      startsAt: meeting.startsAt
    };
  }

  return null;
}

function sanitizeFileName(value) {
  const name = String(value || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  return name || 'file';
}

function sanitizeMimeType(value) {
  const mimeType = String(value || '')
    .toLowerCase()
    .trim()
    .slice(0, 100);

  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mimeType) ? mimeType : 'application/octet-stream';
}

function decodeHeaderValue(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return '';
  }
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

function sanitizeDurationMs(value) {
  const durationMs = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
}

function resolveRecordingExtension(mimeType, fileName = '') {
  const normalizedExt = path.extname(String(fileName || '')).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
  if (normalizedExt && normalizedExt !== '.') {
    return normalizedExt;
  }

  if (mimeType === 'video/mp4') {
    return '.mp4';
  }

  if (mimeType === 'audio/webm' || mimeType === 'video/webm') {
    return '.webm';
  }

  return '.bin';
}

function createTemporaryAttachmentId() {
  return `chat-${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

function serializeChatAttachment(file) {
  if (!file) {
    return null;
  }

  return {
    id: file.id,
    name: file.name,
    type: file.type,
    size: file.size,
    downloadUrl: `/api/chat-files/${encodeURIComponent(file.id)}?token=${encodeURIComponent(file.token)}`
  };
}

function indexTemporaryChatFile(file) {
  if (!roomAttachmentIndex.has(file.roomId)) {
    roomAttachmentIndex.set(file.roomId, new Set());
  }
  roomAttachmentIndex.get(file.roomId).add(file.id);
  temporaryChatFiles.set(file.id, file);
}

async function removeTemporaryChatFile(fileId) {
  const existingFile = temporaryChatFiles.get(String(fileId || ''));
  if (!existingFile) {
    return;
  }

  temporaryChatFiles.delete(existingFile.id);
  const roomFiles = roomAttachmentIndex.get(existingFile.roomId);
  if (roomFiles) {
    roomFiles.delete(existingFile.id);
    if (roomFiles.size === 0) {
      roomAttachmentIndex.delete(existingFile.roomId);
    }
  }

  await fs.promises.unlink(existingFile.path).catch(() => {});
}

async function removeRoomChatFiles(roomId) {
  const fileIds = Array.from(roomAttachmentIndex.get(roomId) || []);
  for (const fileId of fileIds) {
    await removeTemporaryChatFile(fileId);
  }
}

async function pruneExpiredChatFiles() {
  const now = Date.now();
  const expiredIds = Array.from(temporaryChatFiles.values())
    .filter((file) => Number(file.expiresAt || 0) <= now)
    .map((file) => file.id);

  for (const fileId of expiredIds) {
    await removeTemporaryChatFile(fileId);
  }
}

async function createTemporaryChatFile({ roomId, participantId, profileId, name, type, buffer }) {
  const fileId = createTemporaryAttachmentId();
  const fileToken = randomUUID().replace(/-/g, '');
  const filePath = path.join(chatUploadPath, fileId);
  const createdAt = Date.now();
  const nextFile = {
    id: fileId,
    roomId,
    ownerParticipantId: participantId,
    ownerProfileId: profileId,
    name: sanitizeFileName(name),
    type: sanitizeMimeType(type),
    size: buffer.length,
    path: filePath,
    token: fileToken,
    createdAt,
    expiresAt: createdAt + chatFileTtlMs
  };

  await fs.promises.writeFile(filePath, buffer);
  indexTemporaryChatFile(nextFile);
  return nextFile;
}

function resolveChatAttachments(value, roomId, participantId) {
  if (!Array.isArray(value)) {
    return [];
  }

  const attachments = [];
  let totalBytes = 0;
  const now = Date.now();

  for (const item of value.slice(0, maxChatFilesPerMessage)) {
    const attachmentId = String(item?.id || '').trim();
    const existingFile = temporaryChatFiles.get(attachmentId);

    if (!existingFile || existingFile.roomId !== roomId || existingFile.ownerParticipantId !== participantId || Number(existingFile.expiresAt || 0) <= now) {
      continue;
    }

    if (!Number.isFinite(existingFile.size) || existingFile.size <= 0 || existingFile.size > maxChatFileBytes) {
      continue;
    }

    if (totalBytes + existingFile.size > maxChatFilesTotalBytes) {
      break;
    }

    attachments.push(serializeChatAttachment(existingFile));
    totalBytes += existingFile.size;
  }

  return attachments;
}

const chatCleanupTimer = setInterval(() => {
  void pruneExpiredChatFiles();
}, 60 * 1000);
chatCleanupTimer.unref?.();
const clientApprovalCleanupTimer = setInterval(() => {
  for (const baseRoomId of Array.from(pendingClientJoinApprovals.keys())) {
    if (prunePendingClientJoinApprovals(baseRoomId)) {
      emitPendingClientJoinApprovals(baseRoomId);
    }
  }
  for (const baseRoomId of Array.from(approvedClientJoinParticipants.keys())) {
    pruneApprovedClientJoinParticipants(baseRoomId);
  }
}, 5 * 1000);
clientApprovalCleanupTimer.unref?.();

function sanitizeParticipantId(value) {
  const participantId = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);

  return participantId || `p-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function sanitizeScreenStatus(value) {
  const status = String(value || '').toLowerCase().trim();
  return ['off', 'ready', 'live'].includes(status) ? status : 'off';
}

function getRoomState(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      participants: new Map(),
      screenSelections: new Map()
    });
  }

  return rooms.get(roomId);
}

function sanitizePendingParticipantId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
}

function clearPendingClientJoinSocketState(socket) {
  if (!socket?.data) {
    return;
  }

  delete socket.data.pendingClientJoinBaseRoomId;
  delete socket.data.pendingClientJoinParticipantId;
  delete socket.data.pendingClientJoinProfileId;
}

function removePendingClientJoinApproval(baseRoomId, participantId) {
  const safeBaseRoomId = getBaseRoomId(baseRoomId);
  const safeParticipantId = sanitizePendingParticipantId(participantId);
  const requests = pendingClientJoinApprovals.get(safeBaseRoomId);

  if (!requests || !safeParticipantId) {
    return null;
  }

  const request = requests.get(safeParticipantId) || null;

  if (request) {
    requests.delete(safeParticipantId);
    if (requests.size === 0) {
      pendingClientJoinApprovals.delete(safeBaseRoomId);
    }
  }

  return request;
}

function serializePendingClientJoinApproval(request) {
  if (!request) {
    return null;
  }

  return {
    expiresAt: Number(request.expiresAt || 0),
    name: sanitizeName(request.name),
    participantId: sanitizePendingParticipantId(request.participantId),
    profileId: sanitizeProfileId(request.profileId),
    requestedAt: Number(request.requestedAt || 0),
    roomId: sanitizeRoomId(request.roomId)
  };
}

function pruneApprovedClientJoinParticipants(baseRoomId) {
  const safeBaseRoomId = getBaseRoomId(baseRoomId);
  const approvals = approvedClientJoinParticipants.get(safeBaseRoomId);

  if (!approvals) {
    return false;
  }

  const now = Date.now();
  let changed = false;

  for (const [participantId, approval] of Array.from(approvals.entries())) {
    if (Number(approval?.expiresAt || 0) > now) {
      continue;
    }

    approvals.delete(participantId);
    changed = true;
  }

  if (approvals.size === 0) {
    approvedClientJoinParticipants.delete(safeBaseRoomId);
  }

  return changed;
}

function isClientJoinApproved(baseRoomId, participantId, profileId = '') {
  const safeBaseRoomId = getBaseRoomId(baseRoomId);
  const safeParticipantId = sanitizePendingParticipantId(participantId);
  const safeProfileId = sanitizeProfileId(profileId);

  if (!safeParticipantId) {
    return false;
  }

  pruneApprovedClientJoinParticipants(safeBaseRoomId);

  const approvals = approvedClientJoinParticipants.get(safeBaseRoomId);
  const approval = approvals?.get(safeParticipantId);

  if (!approval) {
    return false;
  }

  if (safeProfileId && approval.profileId && approval.profileId !== safeProfileId) {
    return false;
  }

  return Number(approval.expiresAt || 0) > Date.now();
}

function markClientJoinApproved(baseRoomId, participantId, profileId = '') {
  const safeBaseRoomId = getBaseRoomId(baseRoomId);
  const safeParticipantId = sanitizePendingParticipantId(participantId);

  if (!safeParticipantId) {
    return;
  }

  const now = Date.now();
  const approvals = approvedClientJoinParticipants.get(safeBaseRoomId) || new Map();
  approvals.set(safeParticipantId, {
    expiresAt: now + CLIENT_JOIN_APPROVAL_GRANT_TTL_MS,
    profileId: sanitizeProfileId(profileId)
  });
  approvedClientJoinParticipants.set(safeBaseRoomId, approvals);
}

function queuePendingClientJoinApproval(baseRoomId, request = {}) {
  const safeBaseRoomId = getBaseRoomId(baseRoomId);
  const safeParticipantId = sanitizePendingParticipantId(request.participantId);

  if (!safeParticipantId) {
    return null;
  }

  const now = Date.now();
  const requests = pendingClientJoinApprovals.get(safeBaseRoomId) || new Map();
  const nextRequest = {
    expiresAt: now + CLIENT_JOIN_APPROVAL_TTL_MS,
    name: sanitizeName(request.name),
    participantId: safeParticipantId,
    payload: request.payload || {},
    profileId: sanitizeProfileId(request.profileId),
    requestedAt: now,
    roomId: sanitizeRoomId(request.roomId),
    socketId: String(request.socketId || '')
  };
  requests.set(safeParticipantId, nextRequest);
  pendingClientJoinApprovals.set(safeBaseRoomId, requests);
  return nextRequest;
}

function listPendingClientJoinApprovals(baseRoomId) {
  const safeBaseRoomId = getBaseRoomId(baseRoomId);
  return Array.from(pendingClientJoinApprovals.get(safeBaseRoomId)?.values() || [])
    .map((request) => serializePendingClientJoinApproval(request))
    .filter(Boolean)
    .sort((left, right) => left.requestedAt - right.requestedAt);
}

function isClientMeetingHostParticipant(baseRoomId, participant) {
  if (!participant) {
    return false;
  }

  const meetingConfig = meetingConfigs.get(getBaseRoomId(baseRoomId));
  const hostParticipantId = String(meetingConfig?.hostParticipantId || '');
  const hostProfileId = String(meetingConfig?.hostProfileId || '');
  const participantRole = sanitizeClientMeetingRole(participant.clientMeetingRole);

  return Boolean(
    participantRole === 'host'
    || (hostParticipantId && participant.id === hostParticipantId)
    || (hostProfileId && participant.profileId === hostProfileId)
  );
}

function emitPendingClientJoinApprovals(baseRoomId) {
  const safeBaseRoomId = getBaseRoomId(baseRoomId);

  if (!safeBaseRoomId) {
    return;
  }

  const items = listPendingClientJoinApprovals(safeBaseRoomId);
  const deliveredSocketIds = new Set();

  for (const roomId of getRelatedRoomIds(safeBaseRoomId)) {
    const room = rooms.get(roomId);

    if (!room) {
      continue;
    }

    for (const participant of room.participants.values()) {
      if (!participant?.socketId || deliveredSocketIds.has(participant.socketId) || !isClientMeetingHostParticipant(safeBaseRoomId, participant)) {
        continue;
      }

      deliveredSocketIds.add(participant.socketId);
      io.to(participant.socketId).emit('pending-join-requests', {
        items,
        meetingId: safeBaseRoomId
      });
    }
  }
}

function prunePendingClientJoinApprovals(baseRoomId) {
  const safeBaseRoomId = getBaseRoomId(baseRoomId);
  const requests = pendingClientJoinApprovals.get(safeBaseRoomId);

  if (!requests) {
    return false;
  }

  const now = Date.now();
  let changed = false;

  for (const [participantId, request] of Array.from(requests.entries())) {
    const waitingSocket = request.socketId ? io.sockets.sockets.get(request.socketId) : null;
    const isDisconnected = Boolean(request.socketId && !waitingSocket);
    const isExpired = Number(request.expiresAt || 0) <= now;

    if (!isDisconnected && !isExpired) {
      continue;
    }

    requests.delete(participantId);
    changed = true;

    if (waitingSocket) {
      clearPendingClientJoinSocketState(waitingSocket);
      if (isExpired) {
        waitingSocket.emit('join-room-error', {
          code: 'approval-expired',
          message: 'No host approved your request in time. Please try joining again.'
        });
      }
    }
  }

  if (requests.size === 0) {
    pendingClientJoinApprovals.delete(safeBaseRoomId);
  }

  return changed;
}

function clearClientJoinApprovalState(baseRoomId, reason = null) {
  const safeBaseRoomId = getBaseRoomId(baseRoomId);
  const requests = pendingClientJoinApprovals.get(safeBaseRoomId);

  if (requests) {
    for (const request of requests.values()) {
      const waitingSocket = request.socketId ? io.sockets.sockets.get(request.socketId) : null;

      if (!waitingSocket) {
        continue;
      }

      clearPendingClientJoinSocketState(waitingSocket);
      if (reason) {
        waitingSocket.emit('join-room-error', reason);
      }
    }

    pendingClientJoinApprovals.delete(safeBaseRoomId);
  }

  approvedClientJoinParticipants.delete(safeBaseRoomId);
}

async function ensureMeetingRecord({ roomId, breakoutRoomCount, participantId, profileId, name, meetingId, type, title, description, startsAt, forcedHostProfileId = '', preferBlankHostParticipant = false }) {
  const baseRoomId = getBaseRoomId(meetingId || roomId);
  const existingMeeting = await meetingStore.getMeeting(baseRoomId);
  const resolvedType = existingMeeting?.type || sanitizeMeetingType(type);
  const resolvedStartsAt = existingMeeting?.startsAt || sanitizeIsoDate(startsAt, resolvedType === 'instant' ? new Date().toISOString() : '');

  return meetingStore.ensureMeeting({
    id: baseRoomId,
    roomId: baseRoomId,
    type: resolvedType,
    title: resolveMeetingTitle(resolvedType, baseRoomId, title || existingMeeting?.title, name || existingMeeting?.hostName),
    description: sanitizeMeetingDescription(description ?? existingMeeting?.description),
    startsAt: resolvedStartsAt,
    endedAt: existingMeeting?.endedAt || '',
    createdAt: existingMeeting?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastStartedAt: existingMeeting?.lastStartedAt || '',
    activeSessionId: existingMeeting?.activeSessionId || '',
    hostProfileId: existingMeeting?.hostProfileId || sanitizeProfileId(forcedHostProfileId),
    hostParticipantId: existingMeeting?.hostParticipantId || (preferBlankHostParticipant ? '' : participantId),
    hostName: existingMeeting?.hostName || (preferBlankHostParticipant ? '' : sanitizeName(name || existingMeeting?.hostName)),
    breakoutRoomCount: sanitizeBreakoutRoomCount(breakoutRoomCount, existingMeeting?.breakoutRoomCount),
    status: existingMeeting?.status || (resolvedType === 'scheduled' && resolvedStartsAt && new Date(resolvedStartsAt).getTime() > Date.now() ? 'scheduled' : resolvedType === 'personal' ? 'available' : 'active')
  });
}

async function getMeetingConfig(roomId, breakoutRoomCount, participantId, profileId, name, details = {}) {
  const baseRoomId = getBaseRoomId(roomId);
  cancelPendingMeetingEnd(baseRoomId);
  const existingMeetingConfig = meetingConfigs.get(baseRoomId);
  const clientMeetingTenantId = sanitizeClientMeetingTenantId(details.clientMeetingTenantId || existingMeetingConfig?.clientMeetingTenantId);
  const clientMeetingToken = sanitizeClientMeetingToken(details.clientMeetingToken || existingMeetingConfig?.clientMeetingToken);
  const clientMeetingRole = sanitizeClientMeetingRole(details.clientMeetingRole);
  const clientMeetingHostProfileId = sanitizeProfileId(details.clientMeetingHostProfileId || existingMeetingConfig?.clientMeetingHostProfileId || existingMeetingConfig?.hostProfileId);
  const clientMeetingEnabled = Boolean(clientMeetingTenantId && clientMeetingToken);
  const initialMeeting = await ensureMeetingRecord({
    roomId: baseRoomId,
    breakoutRoomCount,
    participantId,
    profileId,
    name,
    meetingId: details.meetingId || baseRoomId,
    type: details.type,
    title: details.title,
    description: details.description,
    startsAt: details.startsAt,
    forcedHostProfileId: clientMeetingEnabled ? clientMeetingHostProfileId : '',
    preferBlankHostParticipant: clientMeetingEnabled && clientMeetingRole !== 'host'
  });
  const joinBlock = getMeetingJoinBlock(initialMeeting, profileId);

  if (joinBlock) {
    return {
      error: joinBlock,
      meeting: initialMeeting
    };
  }

  const safeProfileId = sanitizeProfileId(profileId);
  const approvedClientJoin = Boolean(
    clientMeetingEnabled
    && clientMeetingRole === 'guest'
    && isClientJoinApproved(baseRoomId, participantId, safeProfileId)
  );
  const isHost = clientMeetingEnabled
    ? Boolean(clientMeetingRole === 'host' || (String(initialMeeting.hostProfileId || '') && String(initialMeeting.hostProfileId || '') === safeProfileId))
    : Boolean(String(initialMeeting.hostProfileId || '') && String(initialMeeting.hostProfileId || '') === safeProfileId);
  const requiresApproval = Boolean(clientMeetingEnabled && clientMeetingRole === 'guest' && !isHost && !approvedClientJoin);
  const activeMeeting = isHost
    ? await meetingStore.upsertMeeting({
        ...initialMeeting,
        hostParticipantId: participantId,
        hostName: sanitizeName(name || initialMeeting.hostName),
        breakoutRoomCount: sanitizeBreakoutRoomCount(breakoutRoomCount, initialMeeting.breakoutRoomCount)
      })
    : initialMeeting;

  if (!requiresApproval) {
    await meetingStore.ensureActiveSession({
      meetingId: baseRoomId,
      roomId: baseRoomId,
      title: activeMeeting.title,
      type: activeMeeting.type,
      hostProfileId: activeMeeting.hostProfileId,
      hostParticipantId: activeMeeting.hostParticipantId,
      hostName: activeMeeting.hostName
    });
  }

  const meeting = !requiresApproval
    ? (await meetingStore.getMeeting(baseRoomId)) || activeMeeting
    : activeMeeting;
  const meetingConfig = {
    baseRoomId,
    meetingId: meeting.id,
    title: meeting.title,
    type: meeting.type,
    status: meeting.status,
    startsAt: meeting.startsAt || '',
    endedAt: meeting.endedAt || '',
    hostParticipantId: String(meeting.hostParticipantId || ''),
    hostProfileId: String(meeting.hostProfileId || ''),
    breakoutRoomCount: sanitizeBreakoutRoomCount(meeting.breakoutRoomCount),
    isHost,
    requiresApproval,
    clientMeetingEnabled,
    clientMeetingHostProfileId: clientMeetingHostProfileId || String(meeting.hostProfileId || ''),
    clientMeetingRole,
    clientMeetingTenantId,
    clientMeetingToken,
    meeting
  };

  meetingConfigs.set(baseRoomId, {
    ...meetingConfig,
    meeting: undefined
  });

  return meetingConfig;
}

function getRelatedRoomIds(baseRoomId) {
  return Array.from(rooms.keys()).filter((roomId) => getBaseRoomId(roomId) === baseRoomId);
}

async function endMeetingForAll(baseRoomId, endedByParticipantId, endedByProfileId) {
  cancelPendingMeetingEnd(baseRoomId);
  clearClientJoinApprovalState(baseRoomId, {
    code: 'meeting-ended',
    message: 'The meeting has been ended by the host'
  });

  if (isAlwaysAvailableMeetingId(baseRoomId)) {
    return meetingStore.getMeeting(baseRoomId);
  }

  const endedAt = new Date().toISOString();
  await meetingStore.endActiveSession(baseRoomId, {
    endedAt,
    endedByParticipantId: endedByParticipantId || '',
    endedByProfileId: endedByProfileId || ''
  });
  meetingConfigs.delete(baseRoomId);

  for (const roomId of getRelatedRoomIds(baseRoomId)) {
    const room = rooms.get(roomId);
    io.to(roomId).emit('meeting-ended', {
      meetingId: baseRoomId,
      endedAt,
      endedByParticipantId: endedByParticipantId || ''
    });

    if (room) {
      room.participants.clear();
      room.screenSelections.clear();
    }

    rooms.delete(roomId);
    await removeRoomChatFiles(roomId);
  }

  return meetingStore.getMeeting(baseRoomId);
}

function hasActiveRooms(baseRoomId) {
  for (const roomId of rooms.keys()) {
    if (getBaseRoomId(roomId) === baseRoomId) {
      return true;
    }
  }
  return false;
}

function getParticipants(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return [];
  }

  return Array.from(room.participants.values()).sort((left, right) => left.joinedAt - right.joinedAt);
}

function recomputeScreenWatcherCounts(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  const watcherCounts = new Map();

  for (const targetParticipantId of room.screenSelections.values()) {
    if (!room.participants.has(targetParticipantId)) {
      continue;
    }

    watcherCounts.set(targetParticipantId, (watcherCounts.get(targetParticipantId) || 0) + 1);
  }

  for (const participant of room.participants.values()) {
    participant.screenWatcherCount = watcherCounts.get(participant.id) || 0;
    participant.isScreenSharing = participant.screenStatus === 'live';
  }
}

function emitParticipantsSnapshot(roomId) {
  if (!rooms.has(roomId)) {
    return;
  }

  recomputeScreenWatcherCounts(roomId);
  io.to(roomId).emit('participants-snapshot', getParticipants(roomId));
}

function serializeCrossRoomParticipants(baseRoomId) {
  if (!baseRoomId) {
    return {};
  }

  const meetingConfig = meetingConfigs.get(baseRoomId);
  const hostParticipantId = String(meetingConfig?.hostParticipantId || '');
  const hostProfileId = String(meetingConfig?.hostProfileId || '');
  const snapshot = {};

  for (const roomId of getRelatedRoomIds(baseRoomId)) {
    snapshot[roomId] = getParticipants(roomId).map((participant) => ({
      ...participant,
      isHost: Boolean((hostParticipantId && participant.id === hostParticipantId) || (hostProfileId && participant.profileId === hostProfileId))
    }));
  }

  return snapshot;
}

function emitCrossRoomParticipantsSnapshot(baseRoomId) {
  if (!baseRoomId) {
    return;
  }

  const snapshot = serializeCrossRoomParticipants(baseRoomId);

  for (const roomId of getRelatedRoomIds(baseRoomId)) {
    io.to(roomId).emit('cross-room-participants-snapshot', snapshot);
  }
}

function buildParticipant(payload = {}, existingParticipant = {}) {
  const screenStatus = sanitizeScreenStatus(payload.screenStatus ?? existingParticipant.screenStatus);

  return {
    id: sanitizeParticipantId(payload.participantId || existingParticipant.id),
    profileId: sanitizeProfileId(payload.profileId || existingParticipant.profileId),
    socketId: String(payload.socketId || existingParticipant.socketId || ''),
    name: typeof payload.name === 'string' ? sanitizeName(payload.name) : sanitizeName(existingParticipant.name),
    isAudioEnabled: typeof payload.isAudioEnabled === 'boolean' ? payload.isAudioEnabled : existingParticipant.isAudioEnabled !== false,
    isVideoEnabled: typeof payload.isVideoEnabled === 'boolean' ? payload.isVideoEnabled : existingParticipant.isVideoEnabled !== false,
    isHandRaised: typeof payload.isHandRaised === 'boolean' ? payload.isHandRaised : Boolean(existingParticipant.isHandRaised),
    clientMeetingRole: sanitizeClientMeetingRole(payload.clientMeetingRole || existingParticipant.clientMeetingRole),
    screenStatus,
    screenWatcherCount: Number(existingParticipant.screenWatcherCount || 0),
    isScreenSharing: screenStatus === 'live',
    joinedAt: Number(existingParticipant.joinedAt || Date.now())
  };
}

function clearScreenSelectionsForParticipant(room, participantId) {
  if (!room || !participantId) {
    return;
  }

  room.screenSelections.delete(participantId);

  for (const [viewerId, targetParticipantId] of Array.from(room.screenSelections.entries())) {
    if (targetParticipantId === participantId) {
      room.screenSelections.delete(viewerId);
    }
  }
}

async function leaveCurrentRoom(socket) {
  const roomId = socket.data.roomId;
  const participantId = socket.data.participantId;
  const profileId = socket.data.profileId;
  const baseRoomId = getBaseRoomId(roomId);
  const pendingClientJoinBaseRoomId = socket.data.pendingClientJoinBaseRoomId ? getBaseRoomId(socket.data.pendingClientJoinBaseRoomId) : '';
  const pendingClientJoinParticipantId = sanitizePendingParticipantId(socket.data.pendingClientJoinParticipantId);

  if (!roomId) {
    if (pendingClientJoinBaseRoomId && pendingClientJoinParticipantId) {
      const removedRequest = removePendingClientJoinApproval(pendingClientJoinBaseRoomId, pendingClientJoinParticipantId);
      clearPendingClientJoinSocketState(socket);
      if (removedRequest) {
        emitPendingClientJoinApprovals(pendingClientJoinBaseRoomId);
      }
    }
    return;
  }

  const room = rooms.get(roomId);
  const participant = room?.participants.get(participantId);

  socket.leave(roomId);

  if (room && participantId && participant?.socketId === socket.id) {
    room.participants.delete(participantId);
    clearScreenSelectionsForParticipant(room, participantId);
    socket.to(roomId).emit('participant-left', { participantId });

    if (room.participants.size === 0) {
      rooms.delete(roomId);
      await removeRoomChatFiles(roomId);
    } else {
      emitParticipantsSnapshot(roomId);
    }

    emitCrossRoomParticipantsSnapshot(baseRoomId);
  }

  if (!hasActiveRooms(baseRoomId)) {
    scheduleMeetingAutoEnd(baseRoomId, participantId, participant?.profileId || profileId);
  } else {
    cancelPendingMeetingEnd(baseRoomId);
  }

  delete socket.data.roomId;
  delete socket.data.participantId;
  delete socket.data.profileId;
  clearPendingClientJoinSocketState(socket);
}

function isAlwaysAvailableMeetingId(roomId) {
  const baseRoomId = getBaseRoomId(roomId);

  if (!baseRoomId) {
    return false;
  }

  if (ALWAYS_AVAILABLE_MEETING_IDS.has(baseRoomId)) {
    return true;
  }

  return Array.from(ALWAYS_AVAILABLE_MEETING_IDS).some((meetingId) => baseRoomId.endsWith(`-${meetingId}`));
}

function cancelPendingMeetingEnd(baseRoomId) {
  const timer = pendingMeetingEndTimers.get(baseRoomId);
  if (!timer) {
    return;
  }
  clearTimeout(timer);
  pendingMeetingEndTimers.delete(baseRoomId);
}

function scheduleMeetingAutoEnd(baseRoomId, participantId, profileId) {
  if (!baseRoomId || isAlwaysAvailableMeetingId(baseRoomId) || meetingConfigs.get(baseRoomId)?.clientMeetingEnabled) {
    return;
  }

  cancelPendingMeetingEnd(baseRoomId);

  const timer = setTimeout(() => {
    void (async () => {
      pendingMeetingEndTimers.delete(baseRoomId);

      if (hasActiveRooms(baseRoomId)) {
        return;
      }

      meetingConfigs.delete(baseRoomId);
      await meetingStore.endActiveSession(baseRoomId, {
        endedAt: new Date().toISOString(),
        endedByParticipantId: participantId || '',
        endedByProfileId: sanitizeProfileId(profileId)
      });
    })();
  }, ROOM_SWITCH_GRACE_PERIOD_MS);

  timer.unref?.();
  pendingMeetingEndTimers.set(baseRoomId, timer);
}

function serializeMeetingConfigPayload(meetingConfig) {
  if (!meetingConfig) {
    return null;
  }

  return {
    baseRoomId: meetingConfig.baseRoomId,
    breakoutRoomCount: meetingConfig.breakoutRoomCount,
    clientMeetingEnabled: Boolean(meetingConfig.clientMeetingEnabled),
    clientMeetingRole: sanitizeClientMeetingRole(meetingConfig.clientMeetingRole),
    endedAt: meetingConfig.endedAt,
    hostParticipantId: meetingConfig.hostParticipantId,
    hostProfileId: meetingConfig.hostProfileId,
    isHost: Boolean(meetingConfig.isHost),
    meetingId: meetingConfig.meetingId,
    startsAt: meetingConfig.startsAt,
    status: meetingConfig.status,
    title: meetingConfig.title,
    type: meetingConfig.type
  };
}

function normalizeJoinPayload(payload = {}) {
  const roomId = sanitizeRoomId(payload.roomId);

  return {
    breakoutRoomCount: sanitizeBreakoutRoomCount(payload.breakoutRoomCount),
    clientMeetingHostProfileId: sanitizeProfileId(payload.clientMeetingHostProfileId),
    clientMeetingRole: sanitizeClientMeetingRole(payload.clientMeetingRole),
    clientMeetingTenantId: sanitizeClientMeetingTenantId(payload.clientMeetingTenantId),
    clientMeetingToken: sanitizeClientMeetingToken(payload.clientMeetingToken),
    isAudioEnabled: typeof payload.isAudioEnabled === 'boolean' ? payload.isAudioEnabled : true,
    isHandRaised: typeof payload.isHandRaised === 'boolean' ? payload.isHandRaised : false,
    isVideoEnabled: typeof payload.isVideoEnabled === 'boolean' ? payload.isVideoEnabled : true,
    meetingDescription: sanitizeMeetingDescription(payload.meetingDescription),
    meetingId: sanitizeRoomId(payload.meetingId || roomId),
    meetingStartsAt: sanitizeIsoDate(payload.meetingStartsAt),
    meetingTitle: sanitizeMeetingTitle(payload.meetingTitle, ''),
    meetingType: sanitizeMeetingType(payload.meetingType),
    name: sanitizeName(payload.name),
    participantId: sanitizeParticipantId(payload.participantId),
    profileId: ensureProfileId(payload.profileId),
    roomId,
    screenStatus: sanitizeScreenStatus(payload.screenStatus)
  };
}

async function completeRoomJoin(socket, payload = {}) {
  const joinDetails = normalizeJoinPayload(payload);
  const meetingConfig = await getMeetingConfig(joinDetails.roomId, joinDetails.breakoutRoomCount, joinDetails.participantId, joinDetails.profileId, joinDetails.name, {
    meetingId: joinDetails.meetingId,
    type: joinDetails.meetingType,
    title: joinDetails.meetingTitle,
    description: joinDetails.meetingDescription,
    startsAt: joinDetails.meetingStartsAt,
    clientMeetingTenantId: joinDetails.clientMeetingTenantId,
    clientMeetingToken: joinDetails.clientMeetingToken,
    clientMeetingRole: joinDetails.clientMeetingRole,
    clientMeetingHostProfileId: joinDetails.clientMeetingHostProfileId
  });

  if (meetingConfig.error) {
    socket.emit('join-room-error', {
      ...meetingConfig.error,
      meeting: serializeMeeting(meetingConfig.meeting, joinDetails.profileId)
    });
    return { status: 'error' };
  }

  if (meetingConfig.requiresApproval) {
    const pendingRequest = queuePendingClientJoinApproval(meetingConfig.baseRoomId, {
      participantId: joinDetails.participantId,
      profileId: joinDetails.profileId,
      roomId: joinDetails.roomId,
      name: joinDetails.name,
      payload: joinDetails,
      socketId: socket.id
    });

    if (!pendingRequest) {
      socket.emit('join-room-error', {
        code: 'join-failed',
        message: 'Could not queue your approval request'
      });
      return { status: 'error' };
    }

    socket.data.pendingClientJoinBaseRoomId = meetingConfig.baseRoomId;
    socket.data.pendingClientJoinParticipantId = joinDetails.participantId;
    socket.data.pendingClientJoinProfileId = joinDetails.profileId;
    socket.emit('client-join-pending', {
      code: 'waiting-for-approval',
      message: 'Waiting for a host to let you into the meeting',
      meeting: serializeMeeting(meetingConfig.meeting, joinDetails.profileId),
      requestedAt: pendingRequest.requestedAt
    });
    emitPendingClientJoinApprovals(meetingConfig.baseRoomId);
    return { status: 'pending', meetingConfig };
  }

  removePendingClientJoinApproval(meetingConfig.baseRoomId, joinDetails.participantId);
  clearPendingClientJoinSocketState(socket);

  const room = getRoomState(joinDetails.roomId);
  const existingParticipant = room.participants.get(joinDetails.participantId);
  const existingParticipants = getParticipants(joinDetails.roomId).filter((participant) => participant.id !== joinDetails.participantId);
  const participant = buildParticipant({ ...joinDetails, socketId: socket.id }, existingParticipant);

  room.participants.set(joinDetails.participantId, participant);
  socket.data.roomId = joinDetails.roomId;
  socket.data.participantId = joinDetails.participantId;
  socket.data.profileId = joinDetails.profileId;
  socket.join(joinDetails.roomId);

  socket.emit('joined-room', {
    roomId: joinDetails.roomId,
    participantId: joinDetails.participantId,
    profileId: joinDetails.profileId,
    participant,
    existingParticipants,
    crossRoomParticipants: serializeCrossRoomParticipants(meetingConfig.baseRoomId),
    meeting: serializeMeeting(meetingConfig.meeting, joinDetails.profileId),
    meetingConfig: serializeMeetingConfigPayload(meetingConfig)
  });

  socket.to(joinDetails.roomId).emit('participant-joined', participant);
  emitParticipantsSnapshot(joinDetails.roomId);
  emitCrossRoomParticipantsSnapshot(meetingConfig.baseRoomId);
  emitPendingClientJoinApprovals(meetingConfig.baseRoomId);
  return { status: 'joined', meetingConfig, participant };
}

io.on('connection', (socket) => {
  socket.on('join-room', async (payload = {}) => {
    try {
      const incomingProfileId = sanitizeProfileId(payload.profileId);
      if (incomingProfileId) {
        for (const [id, otherSocket] of io.sockets.sockets) {
          if (id !== socket.id && sanitizeProfileId(otherSocket.data.profileId) === incomingProfileId) {
            otherSocket.emit('session-ended', { reason: 'duplicate-login' });
            otherSocket.disconnect(true);
          }
        }
      }
      await leaveCurrentRoom(socket);
      await completeRoomJoin(socket, payload);
    } catch (error) {
      socket.emit('join-room-error', {
        code: 'join-failed',
        message: error?.message || 'Could not join room'
      });
    }
  });

  socket.on('participant-update', (payload = {}) => {
    const roomId = socket.data.roomId;
    const participantId = socket.data.participantId;
    const room = rooms.get(roomId);

    if (!room || !participantId || !room.participants.has(participantId)) {
      return;
    }

    const currentParticipant = room.participants.get(participantId);
    const nextParticipant = buildParticipant({ ...currentParticipant, ...payload, participantId, socketId: socket.id }, currentParticipant);

    room.participants.set(participantId, nextParticipant);
    io.to(roomId).emit('participant-updated', nextParticipant);
    emitParticipantsSnapshot(roomId);
    emitCrossRoomParticipantsSnapshot(getBaseRoomId(roomId));
  });

  socket.on('approve-pending-join', async (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      const participantId = socket.data.participantId;
      const room = rooms.get(roomId);
      const participant = room?.participants.get(participantId);
      const baseRoomId = getBaseRoomId(roomId);
      const pendingParticipantId = sanitizePendingParticipantId(payload.participantId);

      if (!roomId || !participant || !pendingParticipantId || !isClientMeetingHostParticipant(baseRoomId, participant)) {
        return;
      }

      const pendingRequest = removePendingClientJoinApproval(baseRoomId, pendingParticipantId);

      if (!pendingRequest) {
        emitPendingClientJoinApprovals(baseRoomId);
        return;
      }

      markClientJoinApproved(baseRoomId, pendingRequest.participantId, pendingRequest.profileId);
      emitPendingClientJoinApprovals(baseRoomId);

      const waitingSocket = pendingRequest.socketId ? io.sockets.sockets.get(pendingRequest.socketId) : null;

      if (!waitingSocket) {
        return;
      }

      clearPendingClientJoinSocketState(waitingSocket);

      try {
        await completeRoomJoin(waitingSocket, pendingRequest.payload || {});
      } catch (error) {
        waitingSocket.emit('join-room-error', {
          code: 'join-failed',
          message: error?.message || 'Could not join room'
        });
      }
    } catch {}
  });

  socket.on('deny-pending-join', async (payload = {}) => {
    try {
      const roomId = socket.data.roomId;
      const participantId = socket.data.participantId;
      const room = rooms.get(roomId);
      const participant = room?.participants.get(participantId);
      const baseRoomId = getBaseRoomId(roomId);
      const pendingParticipantId = sanitizePendingParticipantId(payload.participantId);

      if (!roomId || !participant || !pendingParticipantId || !isClientMeetingHostParticipant(baseRoomId, participant)) {
        return;
      }

      const pendingRequest = removePendingClientJoinApproval(baseRoomId, pendingParticipantId);
      emitPendingClientJoinApprovals(baseRoomId);

      if (!pendingRequest) {
        return;
      }

      const waitingSocket = pendingRequest.socketId ? io.sockets.sockets.get(pendingRequest.socketId) : null;

      if (!waitingSocket) {
        return;
      }

      clearPendingClientJoinSocketState(waitingSocket);
      waitingSocket.emit('join-room-error', {
        code: 'approval-denied',
        message: 'The host declined your request to join this meeting.'
      });
    } catch {}
  });

  socket.on('screen-selection', (payload = {}) => {
    const roomId = socket.data.roomId;
    const participantId = socket.data.participantId;
    const room = rooms.get(roomId);

    if (!room || !participantId) {
      return;
    }

    const targetParticipantId = payload.targetParticipantId ? sanitizeParticipantId(payload.targetParticipantId) : '';

    if (!targetParticipantId || targetParticipantId === participantId || !room.participants.has(targetParticipantId)) {
      room.screenSelections.delete(participantId);
    } else {
      room.screenSelections.set(participantId, targetParticipantId);
    }

    emitParticipantsSnapshot(roomId);
  });

  socket.on('chat-message', (payload = {}) => {
    const roomId = socket.data.roomId;
    const participantId = socket.data.participantId;
    const room = rooms.get(roomId);
    const participant = room?.participants.get(participantId);
    const body = String(payload.body || '').trim().slice(0, maxChatMessageLength);
    const attachments = resolveChatAttachments(payload.attachments, roomId, participantId);

    if (!roomId || !room || !participant || (!body && attachments.length === 0)) {
      return;
    }

    io.to(roomId).emit('chat-message', {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      body,
      attachments,
      senderId: participant.id,
      senderName: participant.name,
      createdAt: Date.now()
    });
  });

  socket.on('end-meeting', async () => {
    try {
      const roomId = socket.data.roomId;
      const participantId = socket.data.participantId;
      const profileId = sanitizeProfileId(socket.data.profileId);
      const baseRoomId = getBaseRoomId(roomId);
      const meeting = await meetingStore.getMeeting(baseRoomId);

      if (!roomId || !meeting || !profileId || profileId !== String(meeting.hostProfileId || '')) {
        return;
      }

      await endMeetingForAll(baseRoomId, participantId, profileId);
    } catch {}
  });

  socket.on('leave-room', async () => {
    await leaveCurrentRoom(socket);
  });

  socket.on('disconnect', async () => {
    await leaveCurrentRoom(socket);
  });

  socket.on('request-recording', (payload = {}) => {
    const roomId = socket.data.roomId;
    const participantId = socket.data.participantId;
    const profileId = sanitizeProfileId(socket.data.profileId);
    const baseRoomId = getBaseRoomId(roomId);
    const room = rooms.get(roomId);
    const participant = room?.participants.get(participantId);
    const meeting = meetingConfigs.get(baseRoomId);

    if (!roomId || !participant || !meeting) return;

    const hostProfileId = String(meeting.hostProfileId || '');
    if (!hostProfileId) {
      socket.emit('recording-granted', { granted: true, reason: 'No host required' });
      return;
    }

    const hostParticipant = [...room.participants.values()].find(
      (p) => sanitizeProfileId(p.profileId) === hostProfileId
    );

    if (profileId === hostProfileId) {
      socket.emit('recording-granted', { granted: true });
      return;
    }

    io.to(roomId).emit('recording-requested', {
      participantId,
      participantName: participant.name,
      profileId,
    });
  });

  socket.on('grant-recording', (payload = {}) => {
    const roomId = socket.data.roomId;
    const profileId = sanitizeProfileId(socket.data.profileId);
    const baseRoomId = getBaseRoomId(roomId);
    const meeting = meetingConfigs.get(baseRoomId);

    if (!meeting) return;
    if (profileId !== String(meeting.hostProfileId || '')) return;

    const targetParticipantId = sanitizeParticipantId(payload.participantId);
    const allowed = Boolean(payload.allowed);

    if (targetParticipantId) {
      const key = `${baseRoomId}:${targetParticipantId}`;
      if (allowed) {
        recordingGrants.set(key, Date.now() + 8 * 60 * 60 * 1000);
      } else {
        recordingGrants.delete(key);
      }
      io.to(roomId).emit('recording-response', {
        participantId: targetParticipantId,
        allowed,
        expiresIn: allowed ? '8 hours' : null,
      });
    }
  });

  socket.on('remote-control-event', (payload = {}) => {
    const targetParticipantId = sanitizeParticipantId(payload.targetParticipantId);
    console.log('[RC] event from:', socket.data.participantId, 'room:', socket.data.roomId, 'target:', targetParticipantId);
    if (!targetParticipantId) { console.log('[RC] invalid target id'); return; }

    // Search all rooms for the target participant
    let targetSocketId = '';
    for (const [, room] of rooms) {
      const target = room.participants.get(targetParticipantId);
      if (target && target.socketId) {
        targetSocketId = target.socketId;
        break;
      }
    }
    
    if (!targetSocketId) { console.log('[RC] target not found in any room'); return; }
    console.log('[RC] relaying to socket:', targetSocketId);
    io.to(targetSocketId).emit('remote-control-event', {
      event: payload.event,
      fromParticipantId: socket.data.participantId,
    });
  });
});

function getMissingLiveKitConfig() {
  const missing = [];

  if (!LIVEKIT_API_KEY) {
    missing.push('LIVEKIT_API_KEY');
  }

  if (!LIVEKIT_API_SECRET) {
    missing.push('LIVEKIT_API_SECRET');
  }

  if (!AccessToken) {
    missing.push('livekit-server-sdk dependency');
  }

  return missing;
}

function resolveLiveKitUrl(request) {
  if (LIVEKIT_URL) {
    return LIVEKIT_URL;
  }

  const forwardedHost = String(request.headers['x-forwarded-host'] || request.headers.host || '')
    .split(',')[0]
    .trim();
  const hostname = forwardedHost.replace(/:\d+$/, '');

  if (!hostname) {
    return '';
  }

  const forwardedProto = String(request.headers['x-forwarded-proto'] || request.protocol || 'http')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const secure = forwardedProto === 'https' || forwardedProto === 'wss';
  const protocol = secure ? 'wss' : 'ws';
  const defaultPort = secure ? 443 : 80;
  const signalPort = Number.isFinite(LIVEKIT_SIGNAL_PORT) && LIVEKIT_SIGNAL_PORT > 0 ? LIVEKIT_SIGNAL_PORT : 7880;
  const portSegment = signalPort === defaultPort ? '' : `:${signalPort}`;

  return `${protocol}://${hostname}${portSegment}`;
}

app.post('/api/livekit/token', async (request, response) => {
  const missing = getMissingLiveKitConfig();
  const livekitUrl = resolveLiveKitUrl(request);

  if (!livekitUrl) {
    missing.unshift('LIVEKIT_URL or resolvable request host');
  }

  if (missing.length > 0) {
    response.status(500).json({
      error: 'LiveKit is not configured',
      missing
    });
    return;
  }

  const roomId = sanitizeRoomId(request.body.roomId);
  const participantId = sanitizeParticipantId(request.body.participantId);
  const name = sanitizeName(request.body.name);

  try {
    const accessToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantId,
      ttl: '10h'
    });

    accessToken.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true
    });

    response.json({
      url: livekitUrl,
      token: await accessToken.toJwt(),
      identity: participantId,
      name
    });
  } catch {
    response.status(500).json({
      error: 'Could not create LiveKit token'
    });
  }
});

app.post('/api/chat-files', express.raw({ type: () => true, limit: '2048mb' }), async (request, response) => {
  const roomId = sanitizeRoomId(request.query.roomId || request.headers['x-room-id']);
  const participantId = sanitizeParticipantId(request.query.participantId || request.headers['x-participant-id']);
  const profileId = sanitizeProfileId(request.query.profileId || request.headers['x-profile-id']);
  const room = rooms.get(roomId);
  const participant = room?.participants.get(participantId);
  const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from(request.body || '');
  const providedSize = Number.parseInt(String(request.headers['x-file-size'] || body.length || 0), 10);

  if (!roomId || !room || !participant || participant.profileId !== profileId) {
    response.status(403).json({
      error: 'You must be connected to the room before sharing files'
    });
    return;
  }

  if (!body.length || body.length > maxChatFileBytes || (Number.isFinite(providedSize) && providedSize > 0 && body.length !== providedSize)) {
    response.status(400).json({
      error: 'File exceeds the 25 MB limit or could not be read'
    });
    return;
  }

  try {
    const attachment = await createTemporaryChatFile({
      roomId,
      participantId,
      profileId,
      name: decodeHeaderValue(request.headers['x-file-name']),
      type: request.headers['x-file-type'] || request.headers['content-type'],
      buffer: body
    });
    response.status(201).json({
      attachment: serializeChatAttachment(attachment)
    });
  } catch (error) {
    sendServerError(response, error, 'Could not store chat attachment');
  }
});

app.get('/api/chat-files/:attachmentId', async (request, response) => {
  const attachmentId = String(request.params.attachmentId || '').trim();
  const token = String(request.query.token || '').trim();
  const attachment = temporaryChatFiles.get(attachmentId);

  if (!attachment || attachment.token !== token || Number(attachment.expiresAt || 0) <= Date.now()) {
    if (attachment && Number(attachment.expiresAt || 0) <= Date.now()) {
      await removeTemporaryChatFile(attachmentId);
    }
    response.status(404).json({
      error: 'File not found'
    });
    return;
  }

  try {
    await fs.promises.access(attachment.path, fs.constants.F_OK);
  } catch {
    await removeTemporaryChatFile(attachmentId);
    response.status(404).json({
      error: 'File not found'
    });
    return;
  }

  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', attachment.type);
  response.setHeader('Content-Disposition', `attachment; filename="${attachment.name.replace(/"/g, '')}"`);
  response.sendFile(path.resolve(attachment.path));
});

app.post('/api/recordings', (request, response, next) => {
  recordingUploadMiddleware(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    response.status(error.type === 'entity.too.large' ? 413 : 400).json({
      error: error.type === 'entity.too.large'
        ? `Recording exceeds the ${MAX_RECORDING_UPLOAD_MB} MB limit`
        : 'Could not read recording upload'
    });
  });
}, async (request, response) => {
  const meetingId = sanitizeRoomId(request.query.meetingId || request.headers['x-meeting-id']);
  const roomId = sanitizeRoomId(request.query.roomId || request.headers['x-room-id'] || meetingId);
  const participantId = sanitizeParticipantId(request.query.participantId || request.headers['x-participant-id']);
  const profileId = sanitizeProfileId(request.query.profileId || request.headers['x-profile-id']);
  const room = rooms.get(roomId);
  const participant = room?.participants.get(participantId);
  const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from(request.body || '');
  const providedSize = Number.parseInt(String(request.headers['x-recording-size'] || body.length || 0), 10);
  const baseMeetingId = getBaseRoomId(meetingId || roomId);

  if (!roomId || !room || !participant || participant.profileId !== profileId) {
    response.status(403).json({
      error: 'You must be connected to the room before saving recordings'
    });
    return;
  }

  if (!body.length || body.length > maxRecordingBytes || (Number.isFinite(providedSize) && providedSize > 0 && body.length !== providedSize)) {
    response.status(body.length > maxRecordingBytes ? 413 : 400).json({
      error: body.length > maxRecordingBytes
        ? `Recording exceeds the ${MAX_RECORDING_UPLOAD_MB} MB limit`
        : 'Recording could not be read'
    });
    return;
  }

  let filePath = '';
  try {
    const meeting = await meetingStore.getMeeting(baseMeetingId);

    if (!meeting) {
      response.status(404).json({
        error: 'Meeting not found'
      });
      return;
    }

    const hostId = String(meeting.hostProfileId || '');
    if (hostId) {
      if (profileId !== hostId) {
        const grantKey = `${baseMeetingId}:${participantId}`;
        const grantExpiry = recordingGrants.get(grantKey);
        if (!grantExpiry || grantExpiry < Date.now()) {
          if (grantExpiry) recordingGrants.delete(grantKey);
          response.status(403).json({
            error: 'Recording permission not granted. Request permission from the host.',
          });
          return;
        }
      }
    }

    const recordingId = `recording-${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const requestedType = sanitizeMimeType(request.headers['x-recording-type'] || request.headers['content-type']);
    const requestedName = sanitizeFileName(decodeHeaderValue(request.headers['x-recording-name']));
    const titleFallback = `${meeting.title || 'Meeting'} recording`;
    const title = sanitizeMeetingTitle(decodeHeaderValue(request.headers['x-recording-title']), titleFallback);
    const extension = resolveRecordingExtension(requestedType, requestedName);
    const fileName = requestedName || `${sanitizeFileName(title)}${extension}`;
    const downloadToken = randomUUID().replace(/-/g, '');
    const createdAt = new Date().toISOString();
    const durationMs = sanitizeDurationMs(request.headers['x-recording-duration-ms']);
    const hostName = sanitizeName(decodeHeaderValue(request.headers['x-host-name']) || meeting.hostName || participant.name);
    filePath = path.join(recordingUploadPath, `${recordingId}${extension}`);

    await fs.promises.writeFile(filePath, body);

    const recording = await meetingStore.addRecording({
      id: recordingId,
      meetingId: baseMeetingId,
      roomId,
      title,
      createdAt,
      url: createRecordingDownloadUrl({ id: recordingId, downloadToken }),
      hostName,
      durationLabel: formatDurationLabel(durationMs),
      durationMs,
      hostProfileId: profileId,
      hostParticipantId: participantId,
      downloadToken,
      fileName,
      type: requestedType,
      size: body.length,
      path: filePath
    });

    response.status(201).json({
      recording: serializeRecording(recording)
    });
  } catch (error) {
    if (filePath) {
      await fs.promises.unlink(filePath).catch(() => {});
    }
    sendServerError(response, error, 'Could not store recording');
  }
});

app.get('/api/recordings/:recordingId', async (request, response) => {
  const recordingId = String(request.params.recordingId || '').trim();
  const token = String(request.query.token || '').trim();

  if (!recordingId || !token) {
    response.status(404).json({
      error: 'Recording not found'
    });
    return;
  }

  try {
    const recording = await meetingStore.getRecording(recordingId);

    if (!recording || token !== String(recording.downloadToken || '')) {
      response.status(404).json({
        error: 'Recording not found'
      });
      return;
    }

    try {
      await fs.promises.access(recording.path, fs.constants.F_OK);
    } catch {
      response.status(404).json({
        error: 'Recording file not found'
      });
      return;
    }

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', sanitizeMimeType(recording.type));
    response.setHeader('Content-Disposition', `inline; filename="${sanitizeFileName(recording.fileName).replace(/"/g, '')}"`);
    if (recording.size) {
      response.setHeader('Content-Length', String(recording.size));
    }
    response.sendFile(path.resolve(recording.path));
  } catch (error) {
    sendServerError(response, error, 'Could not load recording');
  }
});

app.get('/api/meetings', async (request, response) => {
  const filter = String(request.query.filter || 'owned').toLowerCase().trim();
  const profileId = sanitizeProfileId(request.query.profileId);

  try {
    if (filter === 'upcoming') {
      response.json({ items: (await meetingStore.listUpcomingMeetings(profileId)).map((meeting) => serializeMeeting(meeting, profileId)) });
      return;
    }

    if (filter === 'previous') {
      response.json({ items: (await meetingStore.listPreviousSessions(profileId)).map(serializeSession) });
      return;
    }

    if (filter === 'recordings') {
      response.json({ items: (await meetingStore.listRecordings(profileId)).map(serializeRecording) });
      return;
    }

    if (filter === 'personal') {
      const personalRoom = await meetingStore.getPersonalRoom(profileId);
      response.json({ items: personalRoom ? [serializeMeeting(personalRoom, profileId)] : [] });
      return;
    }

    response.json({ items: (await meetingStore.listOwnedMeetings(profileId)).map((meeting) => serializeMeeting(meeting, profileId)) });
  } catch (error) {
    sendServerError(response, error, 'Could not load meetings');
  }
});

app.get('/api/meetings/:meetingId', async (request, response) => {
  const meetingId = sanitizeRoomId(request.params.meetingId);
  const profileId = sanitizeProfileId(request.query.profileId);

  try {
    const meeting = await meetingStore.getMeeting(getBaseRoomId(meetingId));

    if (!meeting) {
      response.status(404).json({
        error: 'Meeting not found'
      });
      return;
    }

    response.json({
      meeting: serializeMeeting(meeting, profileId),
      joinBlock: getMeetingJoinBlock(meeting, profileId)
    });
  } catch (error) {
    sendServerError(response, error, 'Could not load meeting');
  }
});

app.post('/api/meetings', async (request, response) => {
  const type = sanitizeMeetingType(request.body.type);
  const participantId = sanitizeParticipantId(request.body.participantId);
  const profileId = ensureProfileId(request.body.profileId);
  const hostName = sanitizeName(request.body.hostName);
  const roomId = sanitizeRoomId(request.body.roomId || createMeetingId(type === 'scheduled' ? 'sched' : 'meet'));
  const defaultStartsAt = type === 'scheduled'
    ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
    : type === 'instant'
      ? new Date().toISOString()
      : '';
  const startsAt = sanitizeIsoDate(request.body.startsAt, defaultStartsAt);

  try {
    const meeting = await meetingStore.upsertMeeting({
      id: roomId,
      roomId,
      type,
      title: resolveMeetingTitle(type, roomId, request.body.title, hostName),
      description: sanitizeMeetingDescription(request.body.description),
      startsAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      endedAt: '',
      activeSessionId: '',
      lastStartedAt: '',
      hostProfileId: profileId,
      hostParticipantId: participantId,
      hostName,
      breakoutRoomCount: sanitizeBreakoutRoomCount(request.body.breakoutRoomCount),
      status: type === 'scheduled' && startsAt && new Date(startsAt).getTime() > Date.now() ? 'scheduled' : type === 'personal' ? 'available' : 'active'
    });

    response.status(201).json({
      meeting: serializeMeeting(meeting, profileId)
    });
  } catch (error) {
    sendServerError(response, error, 'Could not create meeting');
  }
});

app.get('/api/personal-room', async (request, response) => {
  const profileId = sanitizeProfileId(request.query.profileId);

  try {
    const meeting = await meetingStore.getPersonalRoom(profileId);

    if (!meeting) {
      response.status(404).json({
        error: 'Personal room not found'
      });
      return;
    }

    response.json({
      meeting: serializeMeeting(meeting, profileId)
    });
  } catch (error) {
    sendServerError(response, error, 'Could not load personal room');
  }
});

app.post('/api/personal-room', async (request, response) => {
  const profileId = ensureProfileId(request.body.profileId);
  const participantId = sanitizeParticipantId(request.body.participantId);
  const hostName = sanitizeName(request.body.hostName);
  const roomId = sanitizeRoomId(request.body.roomId || `personal-${profileId.slice(-12)}`);

  try {
    const meeting = await meetingStore.ensurePersonalRoom({
      hostProfileId: profileId,
      hostParticipantId: participantId,
      hostName,
      roomId,
      title: resolveMeetingTitle('personal', roomId, request.body.title, hostName),
      description: sanitizeMeetingDescription(request.body.description),
      breakoutRoomCount: sanitizeBreakoutRoomCount(request.body.breakoutRoomCount)
    });

    response.json({
      meeting: serializeMeeting(meeting, profileId)
    });
  } catch (error) {
    sendServerError(response, error, 'Could not create personal room');
  }
});

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    rooms: rooms.size,
    livekitConfigured: getMissingLiveKitConfig().length === 0,
    mongoConnected: meetingStore.isConnected()
  });
});

app.use('/vendor', express.static(livekitClientDistPath));
app.use(express.static(publicPath));
app.get('/room/:roomId', (_request, response) => response.sendFile(indexPath));
app.get('/meeting/:meetingId', (_request, response) => response.sendFile(indexPath));
app.get('*', (_request, response) => response.sendFile(indexPath));

async function shutdown(exitCode = 0) {
  clearInterval(chatCleanupTimer);

  for (const fileId of Array.from(temporaryChatFiles.keys())) {
    await removeTemporaryChatFile(fileId);
  }

  await meetingStore.close().catch(() => {});
  server.close(() => {
    process.exit(exitCode);
  });
  setTimeout(() => {
    process.exit(exitCode);
  }, 2000).unref?.();
}

process.on('SIGINT', () => {
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});

async function start() {
  try {
    await meetingStore.connect();
    server.listen(PORT, () => {
      console.log(`InfoVibeX Meet local server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(`Could not connect to MongoDB at ${MONGODB_URL}`);
    console.error(error);
    process.exit(1);
  }
}

void start();