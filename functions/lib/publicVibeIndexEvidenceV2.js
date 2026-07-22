"use strict";

const {
  buildPublicVibeActorKey,
  buildPublicVibeSourceKey,
} = require("./publicVibeEvidenceLedger");

const VIBE_V2_VERSION = "vibe_v2";
const VIBE_V2_WINDOW_DAYS = 30;
const VIBE_V2_WINDOW_MS = VIBE_V2_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const VIBE_V2_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const TRUSTED_EVIDENCE_TYPES = Object.freeze([
  "room_recap",
  "authenticated_checkin",
  "verified_review",
]);

const normalizeToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeId = (value = "", maxLength = 220) => String(value || "").trim().slice(0, maxLength);

const asTimestampMs = (value = 0) => {
  if (value && typeof value.toMillis === "function") return Math.max(0, Number(value.toMillis()) || 0);
  if (value instanceof Date) return Math.max(0, value.getTime());
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return Math.max(0, Number(value || 0) || 0);
};

const utcDayKey = (timestampMs = 0) => {
  if (!timestampMs) return "";
  return new Date(timestampMs).toISOString().slice(0, 10);
};

const confidenceForSnapshot = ({ verifiedSessionCount = 0, uniqueParticipantCount = 0, activeDayCount = 0 } = {}) => {
  if (verifiedSessionCount >= 8 && uniqueParticipantCount >= 25 && activeDayCount >= 6) return "high";
  if (verifiedSessionCount >= 4 && uniqueParticipantCount >= 10 && activeDayCount >= 3) return "medium";
  return "low";
};

const normalizeEvidenceRecord = (record = {}, index = 0) => {
  const type = normalizeToken(record.type || record.evidenceType);
  const actorKey = normalizeId(record.actorKey, 80)
    || buildPublicVibeActorKey(record.actorUid || record.uid);
  const sessionId = normalizeId(record.sessionId || record.eventId || record.roomSessionId, 220);
  const sourceCollection = normalizeToken(record.sourceCollection);
  const sourceKey = normalizeId(record.sourceKey, 80)
    || buildPublicVibeSourceKey(sourceCollection, record.sourceId || record.id);
  const occurredAtMs = asTimestampMs(
    record.occurredAtMs
    || record.occurredAt
    || record.createdAt
    || record.publishedAtMs
  );
  const expiresAtMs = asTimestampMs(record.expiresAtMs || record.expiresAt);
  const revokedAtMs = asTimestampMs(record.revokedAtMs || record.revokedAt);
  return {
    type,
    targetType: normalizeToken(record.targetType),
    targetId: normalizeId(record.targetId),
    actorKey,
    sessionId,
    sourceKey,
    occurredAtMs,
    expiresAtMs,
    revokedAtMs,
    dayKey: utcDayKey(occurredAtMs),
    status: normalizeToken(record.status || "active"),
    serverVerified: record.serverVerified === true,
    authenticated: record.authenticated === true,
    sourceCollection,
    sourceIndex: index,
  };
};

const classifyEvidenceRecord = ({
  record,
  targetType,
  targetId,
  ownerUids,
  windowStartMs,
  windowEndMs,
} = {}) => {
  if (!TRUSTED_EVIDENCE_TYPES.includes(record.type)) return "unsupported_type";
  if (record.targetType !== targetType || record.targetId !== targetId) return "wrong_entity";
  if (record.status !== "active" || record.revokedAtMs > 0) return "revoked";
  if (record.expiresAtMs > 0 && record.expiresAtMs <= windowEndMs) return "expired";
  if (!record.occurredAtMs || record.occurredAtMs < windowStartMs) return "stale";
  if (record.occurredAtMs > windowEndMs + VIBE_V2_FUTURE_TOLERANCE_MS) return "future_dated";
  if (!record.serverVerified || !record.sourceCollection || !record.sourceKey) return "unverified_provenance";
  if (!record.sessionId) return "missing_session";
  if (record.type !== "room_recap") {
    if (!record.authenticated || !record.actorKey) return "anonymous_actor";
    if (ownerUids.has(record.actorKey)) return "self_attributed";
  }
  return "qualified";
};

const evidenceIdentityKey = (record = {}) => {
  if (record.type === "room_recap") return `${record.type}:${record.sessionId}`;
  return `${record.type}:${record.sessionId}:${record.actorKey}`;
};

const buildVibeV2EvidenceSnapshot = ({
  targetType: targetTypeInput = "",
  targetId: targetIdInput = "",
  ownerUids: ownerUidInputs = [],
  evidence: evidenceInputs = [],
  nowMs: nowMsInput = Date.now(),
} = {}) => {
  const targetType = normalizeToken(targetTypeInput);
  const targetId = normalizeId(targetIdInput);
  const nowMs = asTimestampMs(nowMsInput) || Date.now();
  const windowStartMs = nowMs - VIBE_V2_WINDOW_MS;
  const ownerUids = new Set((Array.isArray(ownerUidInputs) ? ownerUidInputs : [])
    .map((value) => buildPublicVibeActorKey(value))
    .filter(Boolean));
  const evidence = Array.isArray(evidenceInputs) ? evidenceInputs : [];
  const seenEvidence = new Set();
  const participants = new Set();
  const activeDays = new Set();
  const sessionIds = new Set();
  const countsByType = Object.fromEntries(TRUSTED_EVIDENCE_TYPES.map((type) => [type, 0]));
  const droppedByReason = {};

  evidence.forEach((input, index) => {
    const record = normalizeEvidenceRecord(input, index);
    const classification = classifyEvidenceRecord({
      record,
      targetType,
      targetId,
      ownerUids,
      windowStartMs,
      windowEndMs: nowMs,
    });
    if (classification !== "qualified") {
      droppedByReason[classification] = (droppedByReason[classification] || 0) + 1;
      return;
    }
    const identityKey = evidenceIdentityKey(record);
    if (seenEvidence.has(identityKey)) {
      droppedByReason.duplicate = (droppedByReason.duplicate || 0) + 1;
      return;
    }
    seenEvidence.add(identityKey);
    countsByType[record.type] += 1;
    sessionIds.add(record.sessionId);
    if (record.dayKey) activeDays.add(record.dayKey);
    if (record.actorKey && record.type !== "room_recap") participants.add(record.actorKey);
  });

  const verifiedSessionCount = countsByType.room_recap;
  const uniqueParticipantCount = participants.size;
  const activeDayCount = activeDays.size;
  const eligibilityReasons = [];
  if (verifiedSessionCount < 2) eligibilityReasons.push("needs_two_verified_sessions");
  if (uniqueParticipantCount < 5) eligibilityReasons.push("needs_five_unique_participants");
  if (activeDayCount < 2) eligibilityReasons.push("needs_two_active_days");
  const minimumThresholdMet = eligibilityReasons.length === 0;

  return {
    scoreVersion: VIBE_V2_VERSION,
    targetType,
    targetId,
    status: minimumThresholdMet ? "eligible_for_shadow_scoring" : "not_enough_data",
    confidence: confidenceForSnapshot({ verifiedSessionCount, uniqueParticipantCount, activeDayCount }),
    minimumThresholdMet,
    eligibilityReasons,
    sampleWindowDays: VIBE_V2_WINDOW_DAYS,
    windowStartMs,
    windowEndMs: nowMs,
    evidenceSummary: {
      verifiedSessionCount,
      uniqueParticipantCount,
      activeDayCount,
      authenticatedCheckinCount: countsByType.authenticated_checkin,
      verifiedReviewCount: countsByType.verified_review,
      qualifiedEvidenceCount: seenEvidence.size,
      sessionCountWithAnyQualifiedEvidence: sessionIds.size,
    },
    integritySummary: {
      inputCount: evidence.length,
      droppedCount: Object.values(droppedByReason).reduce((sum, count) => sum + count, 0),
      droppedByReason,
    },
  };
};

const buildPublicVibeV2EvidenceSummary = (snapshot = {}) => ({
  scoreVersion: VIBE_V2_VERSION,
  status: snapshot?.status === "eligible_for_shadow_scoring"
    ? "eligible_for_shadow_scoring"
    : "not_enough_data",
  confidence: ["low", "medium", "high"].includes(normalizeToken(snapshot?.confidence))
    ? normalizeToken(snapshot.confidence)
    : "low",
  minimumThresholdMet: snapshot?.minimumThresholdMet === true,
  sampleWindowDays: VIBE_V2_WINDOW_DAYS,
});

module.exports = {
  TRUSTED_EVIDENCE_TYPES,
  VIBE_V2_VERSION,
  VIBE_V2_WINDOW_DAYS,
  buildPublicVibeV2EvidenceSummary,
  buildVibeV2EvidenceSnapshot,
};
