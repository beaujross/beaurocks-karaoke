"use strict";

const crypto = require("node:crypto");

const PUBLIC_VIBE_EVIDENCE_SCHEMA_VERSION = 1;
const PUBLIC_VIBE_EVIDENCE_SCORE_VERSION = "vibe_v2";
const PUBLIC_VIBE_EVIDENCE_TYPES = Object.freeze([
  "room_recap",
  "authenticated_checkin",
  "verified_review",
]);
const PUBLIC_VIBE_EVIDENCE_TARGET_TYPES = Object.freeze([
  "venue",
  "host",
  "event",
  "room_session",
]);
const PUBLIC_VIBE_CHECKIN_EARLY_MS = 12 * 60 * 60 * 1000;
const PUBLIC_VIBE_CHECKIN_LATE_MS = 12 * 60 * 60 * 1000;
const PUBLIC_VIBE_REVIEW_LATE_MS = 30 * 24 * 60 * 60 * 1000;
const PUBLIC_VIBE_EVIDENCE_RETENTION_DAYS = 90;
const PUBLIC_VIBE_EVIDENCE_RETENTION_MS = PUBLIC_VIBE_EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const normalizeToken = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeId = (value = "", maxLength = 220) => String(value || "").trim().slice(0, maxLength);

const buildPublicVibeActorKey = (actorUid = "") => {
  const canonicalActorUid = normalizeId(actorUid, 180);
  if (!canonicalActorUid) return "";
  if (/^actor_[a-f0-9]{40}$/.test(canonicalActorUid)) return canonicalActorUid;
  return `actor_${crypto.createHash("sha256").update(`vibe_v2_actor|${canonicalActorUid}`).digest("hex").slice(0, 40)}`;
};

const buildPublicVibeSourceKey = (sourceCollection = "", sourceId = "") => {
  const canonicalSourceCollection = normalizeToken(sourceCollection);
  const canonicalSourceId = normalizeId(sourceId);
  if (!canonicalSourceCollection || !canonicalSourceId) return "";
  return `source_${crypto.createHash("sha256")
    .update(`vibe_v2_source|${canonicalSourceCollection}|${canonicalSourceId}`)
    .digest("hex")
    .slice(0, 40)}`;
};

const asTimestampMs = (value = 0) => {
  if (value && typeof value.toMillis === "function") return Math.max(0, Number(value.toMillis()) || 0);
  if (value instanceof Date) return Math.max(0, value.getTime());
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return Math.max(0, Number(value || 0) || 0);
};

const normalizeEvidenceType = (value = "") => {
  const token = normalizeToken(value);
  return PUBLIC_VIBE_EVIDENCE_TYPES.includes(token) ? token : "";
};

const normalizeEvidenceTargetType = (value = "") => {
  const token = normalizeToken(value);
  if (token === "session") return "room_session";
  if (token === "performer") return "host";
  return PUBLIC_VIBE_EVIDENCE_TARGET_TYPES.includes(token) ? token : "";
};

const buildEvidenceIdentity = ({
  evidenceType = "",
  targetType = "",
  targetId = "",
  sessionId = "",
  actorUid = "",
  actorKey = "",
} = {}) => {
  const type = normalizeEvidenceType(evidenceType);
  const canonicalTargetType = normalizeEvidenceTargetType(targetType);
  const canonicalTargetId = normalizeId(targetId);
  const canonicalSessionId = normalizeId(sessionId);
  const canonicalActorKey = buildPublicVibeActorKey(actorKey || actorUid);
  if (!type || !canonicalTargetType || !canonicalTargetId || !canonicalSessionId) return "";
  if (type !== "room_recap" && !canonicalActorKey) return "";
  return [
    PUBLIC_VIBE_EVIDENCE_SCORE_VERSION,
    type,
    canonicalTargetType,
    canonicalTargetId,
    canonicalSessionId,
    type === "room_recap" ? "session" : canonicalActorKey,
  ].join("|");
};

const buildPublicVibeEvidenceId = (input = {}) => {
  const identity = buildEvidenceIdentity(input);
  if (!identity) return "";
  return `v2_${crypto.createHash("sha256").update(identity).digest("hex").slice(0, 40)}`;
};

const buildPublicVibeEvidenceRecord = ({
  evidenceType = "",
  targetType = "",
  targetId = "",
  sessionId = "",
  actorUid = "",
  actorKey = "",
  sourceCollection = "",
  sourceId = "",
  verificationMethod = "",
  occurredAtMs = 0,
  verifiedAtMs = Date.now(),
} = {}) => {
  const canonicalEvidenceType = normalizeEvidenceType(evidenceType);
  const canonicalTargetType = normalizeEvidenceTargetType(targetType);
  const canonicalTargetId = normalizeId(targetId);
  const canonicalSessionId = normalizeId(sessionId);
  const canonicalActorKey = buildPublicVibeActorKey(actorKey || actorUid);
  const canonicalSourceCollection = normalizeToken(sourceCollection);
  const canonicalSourceId = normalizeId(sourceId);
  const canonicalSourceKey = buildPublicVibeSourceKey(canonicalSourceCollection, canonicalSourceId);
  const canonicalVerificationMethod = normalizeToken(verificationMethod);
  const canonicalOccurredAtMs = Math.max(0, Number(occurredAtMs || 0) || 0);
  const canonicalVerifiedAtMs = Math.max(0, Number(verifiedAtMs || 0) || 0);
  const evidenceId = buildPublicVibeEvidenceId({
    evidenceType: canonicalEvidenceType,
    targetType: canonicalTargetType,
    targetId: canonicalTargetId,
    sessionId: canonicalSessionId,
    actorKey: canonicalActorKey,
  });
  if (
    !evidenceId
    || !canonicalSourceCollection
    || !canonicalSourceId
    || !canonicalVerificationMethod
    || !canonicalOccurredAtMs
    || !canonicalVerifiedAtMs
  ) return null;
  return {
    evidenceId,
    schemaVersion: PUBLIC_VIBE_EVIDENCE_SCHEMA_VERSION,
    scoreVersion: PUBLIC_VIBE_EVIDENCE_SCORE_VERSION,
    status: "active",
    evidenceType: canonicalEvidenceType,
    targetType: canonicalTargetType,
    targetId: canonicalTargetId,
    sessionId: canonicalSessionId,
    actorKey: canonicalEvidenceType === "room_recap" ? null : canonicalActorKey,
    sourceCollection: canonicalSourceCollection,
    sourceKey: canonicalSourceKey,
    verificationMethod: canonicalVerificationMethod,
    serverVerified: true,
    authenticated: canonicalEvidenceType !== "room_recap",
    occurredAtMs: canonicalOccurredAtMs,
    verifiedAtMs: canonicalVerifiedAtMs,
    expiresAtMs: canonicalVerifiedAtMs + PUBLIC_VIBE_EVIDENCE_RETENTION_MS,
    revokedAtMs: 0,
    revocationReason: "",
  };
};

const buildSessionEvidenceTargets = ({ sessionId = "", session = {} } = {}) => {
  const canonicalSessionId = normalizeId(sessionId);
  if (!canonicalSessionId) return [];
  const identityLinks = session?.identityLinks && typeof session.identityLinks === "object"
    ? session.identityLinks
    : {};
  const targets = [{ targetType: "room_session", targetId: canonicalSessionId }];
  const venueId = normalizeId(session?.venueId || identityLinks.venueId);
  if (venueId) targets.push({ targetType: "venue", targetId: venueId });
  const eventId = normalizeId(session?.eventId || identityLinks.eventId);
  if (eventId) targets.push({ targetType: "event", targetId: eventId });
  const hostUids = [
    session?.hostUid,
    ...(Array.isArray(session?.hostUids) ? session.hostUids : []),
    ...(Array.isArray(identityLinks.hostUids) ? identityLinks.hostUids : []),
  ].map((value) => normalizeId(value, 180)).filter(Boolean);
  hostUids.forEach((hostUid) => targets.push({ targetType: "host", targetId: hostUid }));
  const seen = new Set();
  return targets.filter((target) => {
    const key = `${target.targetType}:${target.targetId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isPublicVibeEvidenceTimeEligible = ({
  evidenceType = "",
  session = {},
  occurrence = {},
  nowMs = Date.now(),
} = {}) => {
  const canonicalEvidenceType = normalizeEvidenceType(evidenceType);
  if (!canonicalEvidenceType) return false;
  if (canonicalEvidenceType === "room_recap") return true;
  const startsAtMs = asTimestampMs(
    occurrence?.startsAtMs
    || occurrence?.startsAt
    || session?.startsAtMs
    || session?.startsAt
  );
  if (!startsAtMs) return false;
  const explicitEndsAtMs = asTimestampMs(
    occurrence?.endsAtMs
    || occurrence?.endsAt
    || session?.endsAtMs
    || session?.endsAt
  );
  const endsAtMs = explicitEndsAtMs > startsAtMs
    ? explicitEndsAtMs
    : startsAtMs + (8 * 60 * 60 * 1000);
  const safeNowMs = asTimestampMs(nowMs) || Date.now();
  const latestMs = canonicalEvidenceType === "verified_review"
    ? endsAtMs + PUBLIC_VIBE_REVIEW_LATE_MS
    : endsAtMs + PUBLIC_VIBE_CHECKIN_LATE_MS;
  return safeNowMs >= startsAtMs - PUBLIC_VIBE_CHECKIN_EARLY_MS && safeNowMs <= latestMs;
};

const buildSessionRecapEvidenceRecords = ({
  sessionId = "",
  evidenceSessionId = "",
  session = {},
  sourceCollection = "",
  sourceId = "",
  verificationMethod = "",
  occurredAtMs = 0,
  verifiedAtMs = Date.now(),
} = {}) => buildSessionEvidenceTargets({ sessionId, session })
  .map((target) => buildPublicVibeEvidenceRecord({
    evidenceType: "room_recap",
    targetType: target.targetType,
    targetId: target.targetId,
    sessionId: normalizeId(evidenceSessionId || sessionId),
    sourceCollection,
    sourceId,
    verificationMethod,
    occurredAtMs,
    verifiedAtMs,
  }))
  .filter(Boolean);

const sessionMatchesEvidenceTarget = ({ sessionId = "", session = {}, targetType = "", targetId = "" } = {}) => {
  const canonicalTargetType = normalizeEvidenceTargetType(targetType);
  const canonicalTargetId = normalizeId(targetId);
  if (!canonicalTargetType || !canonicalTargetId) return false;
  return buildSessionEvidenceTargets({ sessionId, session })
    .some((target) => target.targetType === canonicalTargetType && target.targetId === canonicalTargetId);
};

module.exports = {
  PUBLIC_VIBE_EVIDENCE_SCHEMA_VERSION,
  PUBLIC_VIBE_EVIDENCE_RETENTION_DAYS,
  PUBLIC_VIBE_EVIDENCE_SCORE_VERSION,
  PUBLIC_VIBE_EVIDENCE_TARGET_TYPES,
  PUBLIC_VIBE_EVIDENCE_TYPES,
  buildPublicVibeActorKey,
  buildPublicVibeSourceKey,
  buildPublicVibeEvidenceId,
  buildPublicVibeEvidenceRecord,
  buildSessionEvidenceTargets,
  buildSessionRecapEvidenceRecords,
  isPublicVibeEvidenceTimeEligible,
  normalizeEvidenceTargetType,
  normalizeEvidenceType,
  sessionMatchesEvidenceTarget,
};
