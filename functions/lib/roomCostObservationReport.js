"use strict";

const contract = require("./roomCostEnvelopeContract.json");
const {
  AUDIENCE_SAMPLE_MODULUS,
  ROOM_COST_OBSERVATION_SCHEMA_VERSION,
  normalizeRoomCostCounts,
  normalizeRoomCostSurface,
} = require("./roomCostObservation");

const ROOM_DAY_SAMPLE_TARGET = 30;
const ROOM_DAY_BAND_TARGET = 5;
const RAW_IDENTITY_KEYS = new Set(["uid", "userId", "actorUid", "audienceUid"]);

const toDateKey = (value = "") => String(value || "").replace(/[^0-9]/g, "").slice(0, 8);

const normalizeGuestBands = (guestBands = []) => (
  Array.isArray(guestBands)
    ? guestBands.map((band) => ({
      id: String(band?.id || "").trim(),
      maxGuests: Number(band?.maxActiveGuests || band?.maxGuests || 0),
    }))
    : Object.entries(guestBands || {}).map(([id, band]) => ({
      id,
      maxGuests: Number(band?.maxActiveGuests || band?.maxGuests || 0),
    }))
).filter((band) => band.id && band.maxGuests > 0);

const resolveGuestBand = (participants = 0, guestBands = contract.guestBands || {}) => {
  const count = Math.max(0, Number(participants || 0));
  const ordered = normalizeGuestBands(guestBands).sort((a, b) => a.maxGuests - b.maxGuests);
  return ordered.find((band) => count <= band.maxGuests)?.id || "above_supported_band";
};

const buildRoomCostObservationReport = (observations = [], {
  audienceSampleModulus = AUDIENCE_SAMPLE_MODULUS,
  guestBands = contract.guestBands || {},
} = {}) => {
  const roomDays = new Map();
  const bySurface = { host: 0, audience: 0, public_tv: 0 };
  const violations = [];
  let rawIdentityFieldCount = 0;

  for (const raw of Array.isArray(observations) ? observations : []) {
    const observation = raw && typeof raw === "object" ? raw : {};
    const surface = normalizeRoomCostSurface(observation.surface);
    const roomCode = String(observation.roomCode || "").trim().toUpperCase();
    const dateKey = toDateKey(observation.dateKey);
    const schemaVersion = Number(observation.schemaVersion || 0);
    const identityKeys = Object.keys(observation).filter((key) => RAW_IDENTITY_KEYS.has(key));
    rawIdentityFieldCount += identityKeys.length;
    if (identityKeys.length) violations.push(`raw_identity_field:${identityKeys.join(",")}`);
    if (!surface || !roomCode || dateKey.length !== 8 || schemaVersion !== ROOM_COST_OBSERVATION_SCHEMA_VERSION) {
      violations.push(`invalid_observation:${String(observation.observationId || "unknown")}`);
      continue;
    }
    bySurface[surface] += 1;
    const counts = normalizeRoomCostCounts(observation.counts || {});
    const key = `${dateKey}:${roomCode}`;
    const current = roomDays.get(key) || {
      key,
      dateKey,
      roomCode,
      observations: 0,
      hostObservations: 0,
      audienceSampleObservations: 0,
      publicTvObservations: 0,
      peakParticipantsObserved: 0,
      peakActiveSongsObserved: 0,
      peakPerformedSongsObserved: 0,
      peakActivitiesObserved: 0,
      peakMediaAssetsObserved: 0,
      peakScenePresetsObserved: 0,
    };
    current.observations += 1;
    if (surface === "host") current.hostObservations += 1;
    if (surface === "audience") current.audienceSampleObservations += 1;
    if (surface === "public_tv") current.publicTvObservations += 1;
    for (const [field, reportField] of [
      ["participantsObserved", "peakParticipantsObserved"],
      ["activeSongsObserved", "peakActiveSongsObserved"],
      ["performedSongsObserved", "peakPerformedSongsObserved"],
      ["activitiesObserved", "peakActivitiesObserved"],
      ["mediaAssetsObserved", "peakMediaAssetsObserved"],
      ["scenePresetsObserved", "peakScenePresetsObserved"],
    ]) {
      current[reportField] = Math.max(current[reportField], counts[field]);
    }
    roomDays.set(key, current);
  }

  const rows = [...roomDays.values()].map((row) => ({
    ...row,
    guestBand: resolveGuestBand(row.peakParticipantsObserved, guestBands),
    estimatedAudienceSessionEquivalent: row.audienceSampleObservations * audienceSampleModulus,
  })).sort((a, b) => b.dateKey.localeCompare(a.dateKey) || a.roomCode.localeCompare(b.roomCode));
  const supportedBandIds = normalizeGuestBands(guestBands).map((band) => band.id);
  const guestBandCoverage = Object.fromEntries(
    [...supportedBandIds, "above_supported_band"].map((bandId) => [
      bandId,
      rows.filter((row) => row.guestBand === bandId).length,
    ]),
  );
  const readinessBlockers = [];
  if (rows.length < ROOM_DAY_SAMPLE_TARGET) {
    readinessBlockers.push(`Need ${ROOM_DAY_SAMPLE_TARGET - rows.length} more observed Room-days for the provisional percentile sample.`);
  }
  for (const bandId of supportedBandIds) {
    const observed = guestBandCoverage[bandId] || 0;
    if (observed < ROOM_DAY_BAND_TARGET) {
      readinessBlockers.push(`Need ${ROOM_DAY_BAND_TARGET - observed} more ${bandId} Room-days.`);
    }
  }
  if (!bySurface.host) readinessBlockers.push("No Host surface observation has been recorded.");
  if (!bySurface.audience) readinessBlockers.push("No sampled Audience surface observation has been recorded.");
  if (violations.length) readinessBlockers.push("Observation contract violations require review.");

  const peak = (field) => rows.reduce((max, row) => Math.max(max, Number(row[field] || 0)), 0);
  return {
    schemaVersion: 1,
    observationCount: bySurface.host + bySurface.audience + bySurface.public_tv,
    roomDayCount: rows.length,
    roomCount: new Set(rows.map((row) => row.roomCode)).size,
    bySurface,
    guestBandCoverage,
    audienceSampleModulus,
    estimatedAudienceSessionEquivalent: bySurface.audience * audienceSampleModulus,
    peaks: {
      participantsObserved: peak("peakParticipantsObserved"),
      activeSongsObserved: peak("peakActiveSongsObserved"),
      performedSongsObserved: peak("peakPerformedSongsObserved"),
      activitiesObserved: peak("peakActivitiesObserved"),
      mediaAssetsObserved: peak("peakMediaAssetsObserved"),
      scenePresetsObserved: peak("peakScenePresetsObserved"),
    },
    privacy: { rawIdentityFieldCount },
    violations: [...new Set(violations)],
    percentileEvidenceReady: readinessBlockers.length === 0,
    readinessBlockers,
    roomDays: rows,
  };
};

module.exports = {
  ROOM_DAY_BAND_TARGET,
  ROOM_DAY_SAMPLE_TARGET,
  buildRoomCostObservationReport,
  resolveGuestBand,
};
