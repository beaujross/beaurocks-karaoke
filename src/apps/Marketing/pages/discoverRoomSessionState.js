import { buildRoomRecapUrl } from "../../../lib/roomRecap";

const normalizeRoomCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase();

const toMillis = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const isEndedRoomSession = (entry = {}, nowMs = Date.now()) => {
  const endsAtMs = toMillis(entry?.endsAtMs);
  const currentTimeMs = Math.max(0, toMillis(entry?.currentTimeMs) || toMillis(nowMs));
  return endsAtMs > 0 && endsAtMs <= currentTimeMs;
};

export const hasPublishedRoomSessionRecap = (entry = {}) => {
  const roomCode = normalizeRoomCode(entry?.roomCode);
  if (!roomCode) return false;
  return (
    !!String(entry?.recapUrl || entry?.latestRecapUrl || "").trim()
    || toMillis(entry?.latestRecapAtMs) > 0
  );
};

export const getRoomSessionRecapUrl = (entry = {}) => {
  if (!hasPublishedRoomSessionRecap(entry)) return "";
  const explicitUrl = String(entry?.recapUrl || entry?.latestRecapUrl || "").trim();
  if (explicitUrl) return explicitUrl;
  const roomCode = normalizeRoomCode(entry?.roomCode);
  return roomCode ? buildRoomRecapUrl(roomCode) : "";
};

export const isEndedRoomSessionWithPublicRecap = (entry = {}, nowMs = Date.now()) =>
  hasPublishedRoomSessionRecap(entry) && isEndedRoomSession(entry, nowMs);
