import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "vitest";

const require = createRequire(import.meta.url);
const {
  PUBLIC_VIBE_EVIDENCE_RETENTION_DAYS,
  buildPublicVibeActorKey,
  buildPublicVibeSourceKey,
  buildPublicVibeEvidenceId,
  buildPublicVibeEvidenceRecord,
  buildSessionEvidenceTargets,
  buildSessionRecapEvidenceRecords,
  isPublicVibeEvidenceTimeEligible,
  sessionMatchesEvidenceTarget,
} = require("../../functions/lib/publicVibeEvidenceLedger.js");

const base = {
  targetType: "venue",
  targetId: "venue_demo",
  sessionId: "session_demo",
  actorUid: "guest_demo",
};

test("evidence IDs are deterministic and ignore replay source IDs", () => {
  const first = buildPublicVibeEvidenceId({ ...base, evidenceType: "authenticated_checkin", sourceId: "checkin_1" });
  const replay = buildPublicVibeEvidenceId({ ...base, evidenceType: "authenticated_checkin", sourceId: "checkin_2" });
  const otherActor = buildPublicVibeEvidenceId({ ...base, evidenceType: "authenticated_checkin", actorUid: "guest_other" });
  assert.match(first, /^v2_[a-f0-9]{40}$/);
  assert.equal(replay, first);
  assert.notEqual(otherActor, first);
});

test("participant identities are one-way pseudonymous keys", () => {
  const actorKey = buildPublicVibeActorKey("guest_demo");
  assert.match(actorKey, /^actor_[a-f0-9]{40}$/);
  assert.equal(buildPublicVibeActorKey("guest_demo"), actorKey);
  assert.notEqual(buildPublicVibeActorKey("guest_other"), actorKey);
  assert.equal(buildPublicVibeActorKey(actorKey), actorKey);
});

test("recap evidence deduplicates by target and session without an actor", () => {
  const evidenceId = buildPublicVibeEvidenceId({
    evidenceType: "room_recap",
    targetType: "session",
    targetId: "session_demo",
    sessionId: "session_demo",
  });
  assert.match(evidenceId, /^v2_[a-f0-9]{40}$/);
});

test("ledger records require complete server provenance", () => {
  assert.equal(buildPublicVibeEvidenceRecord({ ...base, evidenceType: "authenticated_checkin" }), null);
  const record = buildPublicVibeEvidenceRecord({
    ...base,
    evidenceType: "authenticated_checkin",
    sourceCollection: "checkins",
    sourceId: "checkin_1",
    verificationMethod: "authenticated_room_member",
    occurredAtMs: 1000,
    verifiedAtMs: 2000,
  });
  assert.equal(record.scoreVersion, "vibe_v2");
  assert.equal(record.serverVerified, true);
  assert.equal(record.targetType, "venue");
  assert.equal(record.actorKey, buildPublicVibeActorKey("guest_demo"));
  assert.equal(Object.hasOwn(record, "actorUid"), false);
  assert.equal(record.sourceKey, buildPublicVibeSourceKey("checkins", "checkin_1"));
  assert.equal(Object.hasOwn(record, "sourceId"), false);
  assert.equal(record.authenticated, true);
  assert.equal(
    record.expiresAtMs,
    record.verifiedAtMs + (PUBLIC_VIBE_EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  );
  assert.equal(record.status, "active");
});

test("session relationships produce canonical, unique evidence targets", () => {
  const session = {
    venueId: "venue_demo",
    eventId: "event_demo",
    hostUid: "host_one",
    hostUids: ["host_one", "host_two"],
    identityLinks: { hostUids: ["host_two"] },
  };
  assert.deepEqual(buildSessionEvidenceTargets({ sessionId: "session_demo", session }), [
    { targetType: "room_session", targetId: "session_demo" },
    { targetType: "venue", targetId: "venue_demo" },
    { targetType: "event", targetId: "event_demo" },
    { targetType: "host", targetId: "host_one" },
    { targetType: "host", targetId: "host_two" },
  ]);
  assert.equal(sessionMatchesEvidenceTarget({ sessionId: "session_demo", session, targetType: "session", targetId: "session_demo" }), true);
  assert.equal(sessionMatchesEvidenceTarget({ sessionId: "session_demo", session, targetType: "venue", targetId: "other" }), false);
});

test("participant evidence requires the verified session time window", () => {
  const nowMs = Date.UTC(2026, 6, 17, 20, 0, 0);
  const session = {
    startsAtMs: nowMs - (2 * 60 * 60 * 1000),
    endsAtMs: nowMs + (2 * 60 * 60 * 1000),
  };
  assert.equal(isPublicVibeEvidenceTimeEligible({ evidenceType: "authenticated_checkin", session, nowMs }), true);
  assert.equal(isPublicVibeEvidenceTimeEligible({ evidenceType: "authenticated_checkin", session: {}, nowMs }), false);
  assert.equal(isPublicVibeEvidenceTimeEligible({
    evidenceType: "authenticated_checkin",
    session: { startsAtMs: nowMs - (3 * 24 * 60 * 60 * 1000), endsAtMs: nowMs - (2 * 24 * 60 * 60 * 1000) },
    nowMs,
  }), false);
  assert.equal(isPublicVibeEvidenceTimeEligible({
    evidenceType: "verified_review",
    session: { startsAtMs: nowMs - (3 * 24 * 60 * 60 * 1000), endsAtMs: nowMs - (2 * 24 * 60 * 60 * 1000) },
    nowMs,
  }), true);
});

test("recap fan-out creates one actor-free record per canonical session relationship", () => {
  const records = buildSessionRecapEvidenceRecords({
    sessionId: "session_demo",
    evidenceSessionId: "occurrence_demo",
    session: { venueId: "venue_demo", hostUid: "host_demo" },
    sourceCollection: "artifacts_rooms",
    sourceId: "ROOM1",
    verificationMethod: "host_authorized_public_recap",
    occurredAtMs: 1000,
    verifiedAtMs: 1000,
  });
  assert.equal(records.length, 3);
  assert.deepEqual(records.map((record) => record.targetType), ["room_session", "venue", "host"]);
  assert.equal(records.every((record) => record.actorKey === null), true);
  assert.equal(records.every((record) => !Object.hasOwn(record, "actorUid")), true);
  assert.equal(records.every((record) => /^source_[a-f0-9]{40}$/.test(record.sourceKey)), true);
  assert.equal(records.every((record) => !Object.hasOwn(record, "sourceId")), true);
  assert.equal(records.every((record) => record.authenticated === false), true);
  assert.equal(records.every((record) => record.sessionId === "occurrence_demo"), true);
});
