import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "vitest";

const require = createRequire(import.meta.url);
const {
  VIBE_V2_VERSION,
  VIBE_V2_WINDOW_DAYS,
  buildPublicVibeV2EvidenceSummary,
  buildVibeV2EvidenceSnapshot,
} = require("../../functions/lib/publicVibeIndexEvidenceV2.js");

const DAY_MS = 24 * 60 * 60 * 1000;
const nowMs = Date.UTC(2026, 6, 17, 20, 0, 0);
const base = {
  targetType: "venue",
  targetId: "venue_demo",
  sourceCollection: "vibe_evidence",
  serverVerified: true,
};

const recap = (sessionId, daysAgo = 1) => ({
  ...base,
  type: "room_recap",
  sessionId,
  sourceId: `recap_${sessionId}`,
  occurredAtMs: nowMs - (daysAgo * DAY_MS),
});

const checkin = (actorUid, sessionId, daysAgo = 1) => ({
  ...base,
  type: "authenticated_checkin",
  actorUid,
  authenticated: true,
  sessionId,
  sourceId: `checkin_${sessionId}_${actorUid}`,
  occurredAtMs: nowMs - (daysAgo * DAY_MS),
});

test("vibe_v2 requires verified, entity-bound, fresh, unique authenticated evidence", () => {
  const snapshot = buildVibeV2EvidenceSnapshot({
    targetType: "venue",
    targetId: "venue_demo",
    ownerUids: ["venue_owner"],
    nowMs,
    evidence: [
      recap("night_1", 3),
      recap("night_2", 1),
      checkin("guest_1", "night_1", 3),
      checkin("guest_2", "night_1", 3),
      checkin("guest_3", "night_1", 3),
      checkin("guest_4", "night_2", 1),
      checkin("guest_5", "night_2", 1),
    ],
  });

  assert.equal(snapshot.scoreVersion, VIBE_V2_VERSION);
  assert.equal(snapshot.sampleWindowDays, VIBE_V2_WINDOW_DAYS);
  assert.equal(snapshot.minimumThresholdMet, true);
  assert.equal(snapshot.status, "eligible_for_shadow_scoring");
  assert.equal(snapshot.evidenceSummary.verifiedSessionCount, 2);
  assert.equal(snapshot.evidenceSummary.uniqueParticipantCount, 5);
  assert.equal(snapshot.evidenceSummary.activeDayCount, 2);
});

test("vibe_v2 drops duplicates, self-attribution, stale, future, cross-entity, and unverified inputs", () => {
  const valid = checkin("guest_1", "night_1", 1);
  const snapshot = buildVibeV2EvidenceSnapshot({
    targetType: "venue",
    targetId: "venue_demo",
    ownerUids: ["venue_owner"],
    nowMs,
    evidence: [
      valid,
      { ...valid, sourceId: "duplicate_source" },
      checkin("venue_owner", "night_1", 1),
      checkin("stale_guest", "old_night", 31),
      { ...checkin("future_guest", "future_night", 0), occurredAtMs: nowMs + (10 * 60 * 1000) },
      { ...checkin("other_guest", "night_1", 1), targetId: "other_venue" },
      { ...checkin("unverified_guest", "night_1", 1), serverVerified: false },
      { ...checkin("anonymous_guest", "night_1", 1), authenticated: false },
      { ...checkin("missing_session_guest", "night_1", 1), sessionId: "" },
    ],
  });

  assert.equal(snapshot.evidenceSummary.qualifiedEvidenceCount, 1);
  assert.equal(snapshot.integritySummary.droppedCount, 8);
  assert.deepEqual(snapshot.integritySummary.droppedByReason, {
    duplicate: 1,
    self_attributed: 1,
    stale: 1,
    future_dated: 1,
    wrong_entity: 1,
    unverified_provenance: 1,
    anonymous_actor: 1,
    missing_session: 1,
  });
});

test("vibe_v2 rejects revoked, inactive, and expired evidence before shadow use", () => {
  const snapshot = buildVibeV2EvidenceSnapshot({
    targetType: "venue",
    targetId: "venue_demo",
    nowMs,
    evidence: [
      { ...checkin("revoked_guest", "night_1", 1), revokedAtMs: nowMs - 1 },
      { ...checkin("inactive_guest", "night_1", 1), status: "inactive" },
      { ...checkin("expired_guest", "night_1", 1), expiresAtMs: nowMs - 1 },
    ],
  });

  assert.equal(snapshot.evidenceSummary.qualifiedEvidenceCount, 0);
  assert.deepEqual(snapshot.integritySummary.droppedByReason, {
    revoked: 2,
    expired: 1,
  });
});

test("vibe_v2 ignores self-declared capabilities and paid status", () => {
  const evidence = [recap("night_1", 1), checkin("guest_1", "night_1", 1)];
  const baseline = buildVibeV2EvidenceSnapshot({ targetType: "venue", targetId: "venue_demo", nowMs, evidence });
  const attemptedBoost = buildVibeV2EvidenceSnapshot({
    targetType: "venue",
    targetId: "venue_demo",
    nowMs,
    evidence,
    beauRocksHostTier: "enterprise",
    isOfficialBeauRocksListing: true,
    beauRocksCapabilities: ["everything"],
    funSignalCount: 999,
    capabilityCount: 999,
  });

  assert.deepEqual(attemptedBoost, baseline);
});

test("public vibe_v2 evidence summary excludes counts, identifiers, and integrity diagnostics", () => {
  const snapshot = buildVibeV2EvidenceSnapshot({
    targetType: "venue",
    targetId: "venue_demo",
    nowMs,
    evidence: [recap("night_1", 1), checkin("guest_1", "night_1", 1)],
  });
  assert.deepEqual(buildPublicVibeV2EvidenceSummary(snapshot), {
    scoreVersion: "vibe_v2",
    status: "not_enough_data",
    confidence: "low",
    minimumThresholdMet: false,
    sampleWindowDays: 30,
  });
});
