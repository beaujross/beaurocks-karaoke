"use strict";

const ROOM_COST_OBSERVATION_SCHEMA_VERSION = 1;
const ROOM_COST_OBSERVATION_RETENTION_DAYS = 90;
const AUDIENCE_SAMPLE_MODULUS = 16;
const ALLOWED_SURFACES = new Set(["host", "audience", "public_tv"]);

const stableHash = (value = "") => {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const getUtcDateKey = (nowValue = Date.now()) => new Date(nowValue).toISOString().slice(0, 10).replace(/-/g, "");

const normalizeRoomCostSurface = (value = "") => {
  const surface = String(value || "").trim().toLowerCase();
  return ALLOWED_SURFACES.has(surface) ? surface : "";
};

const shouldSampleRoomCostObservation = ({ surface = "", roomCode = "", uid = "", dateKey = "" } = {}) => {
  const safeSurface = normalizeRoomCostSurface(surface);
  if (safeSurface === "host" || safeSurface === "public_tv") return true;
  if (safeSurface !== "audience") return false;
  return stableHash(`${roomCode}:${uid}:${dateKey}`) % AUDIENCE_SAMPLE_MODULUS === 0;
};

const clampCount = (value, max) => Math.max(0, Math.min(max, Math.floor(Number(value || 0) || 0)));

const normalizeRoomCostCounts = (value = {}) => ({
  participantsObserved: clampCount(value.participantsObserved, 250),
  activeSongsObserved: clampCount(value.activeSongsObserved, 250),
  performedSongsObserved: clampCount(value.performedSongsObserved, 250),
  activitiesObserved: clampCount(value.activitiesObserved, 80),
  mediaAssetsObserved: clampCount(value.mediaAssetsObserved, 100),
  scenePresetsObserved: clampCount(value.scenePresetsObserved, 50),
});

module.exports = {
  AUDIENCE_SAMPLE_MODULUS,
  ROOM_COST_OBSERVATION_RETENTION_DAYS,
  ROOM_COST_OBSERVATION_SCHEMA_VERSION,
  getUtcDateKey,
  normalizeRoomCostCounts,
  normalizeRoomCostSurface,
  shouldSampleRoomCostObservation,
  stableHash,
};
