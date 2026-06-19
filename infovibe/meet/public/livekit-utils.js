export function normalizeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Guest';
}

export function normalizeRoomId(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'main-room';
}

export const DEFAULT_BREAKOUT_ROOM_COUNT = 50;
export const MIN_BREAKOUT_ROOM_COUNT = 0;
export const MAX_BREAKOUT_ROOM_COUNT = 50;

export function normalizeBreakoutRoomCount(value, fallback = DEFAULT_BREAKOUT_ROOM_COUNT) {
  const numericValue = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(MAX_BREAKOUT_ROOM_COUNT, Math.max(MIN_BREAKOUT_ROOM_COUNT, numericValue));
}

export function breakoutRoomCountLabel(value) {
  const count = normalizeBreakoutRoomCount(value);
  if (count === 0) return 'No breakout rooms';
  return `${count} breakout room${count === 1 ? '' : 's'}`;
}

function randomId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getParticipantId(storageKey) {
  let id = sessionStorage.getItem(storageKey);
  if (!id) {
    id = `p-${randomId().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)}`;
    sessionStorage.setItem(storageKey, id);
  }
  return id;
}

export function getInitials(name) {
  return normalizeName(name).split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'G';
}

export function getBaseRoomId(roomId) {
  return String(roomId || '').replace(/-room-\d+$/, '') || 'main-room';
}

export function statusText(value) {
  const text = String(value || 'offline');
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : 'Offline';
}

export function compactConnectionStatus(connectionStatus = 'Offline') {
  const text = String(connectionStatus || 'Offline');
  if (/invite copied/i.test(text)) return 'Copied';
  if (/preparing devices/i.test(text)) return 'Preparing';
  if (/not configured/i.test(text)) return 'Setup';
  if (/screen share cancelled/i.test(text)) return 'Ready';
  if (/connection failed|could not|get livekit token/i.test(text)) return 'Offline';
  return text.length > 16 ? text.split(' ')[0] : text;
}

export function fileSizeLabel(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function stopTrack(track) {
  try {
    track?.stop();
  } catch {}
}
