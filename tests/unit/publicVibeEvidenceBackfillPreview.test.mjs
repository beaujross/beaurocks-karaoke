import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "vitest";

const require = createRequire(import.meta.url);
const { buildPublicVibeActorKey, buildPublicVibeSourceKey } = require(
  "../../functions/lib/publicVibeEvidenceLedger.js"
);
const { buildPublicVibeEvidenceBackfillPreview } = require(
  "../../functions/lib/publicVibeEvidenceBackfillPreview.js"
);

const DAY_MS = 24 * 60 * 60 * 1000;
const nowMs = Date.UTC(2026, 6, 18, 12, 0, 0);
const evidence = ({
  type,
  targetType = "venue",
  targetId = "venue_private_id",
  sessionId,
  actorUid = "",
  daysAgo = 1,
  sourceId = "",
  ...overrides
}) => ({
  evidenceType: type,
  targetType,
  targetId,
  sessionId,
  actorKey: actorUid ? buildPublicVibeActorKey(actorUid) : null,
  sourceCollection: "protected_evidence",
  sourceKey: buildPublicVibeSourceKey("protected_evidence", sourceId || `${type}_${sessionId}_${actorUid}`),
  occurredAtMs: nowMs - (daysAgo * DAY_MS),
  expiresAtMs: nowMs + (60 * DAY_MS),
  status: "active",
  serverVerified: true,
  authenticated: type !== "room_recap",
  ...overrides,
});

test("backfill preview returns aggregate readiness without identifiers or records", () => {
  const inputs = [
    evidence({ type: "room_recap", sessionId: "night_1", daysAgo: 3 }),
    evidence({ type: "room_recap", sessionId: "night_2", daysAgo: 1 }),
    ...["guest_1", "guest_2", "guest_3"].map((actorUid) =>
      evidence({ type: "authenticated_checkin", actorUid, sessionId: "night_1", daysAgo: 3 })
    ),
    ...["guest_4", "guest_5"].map((actorUid) =>
      evidence({ type: "authenticated_checkin", actorUid, sessionId: "night_2", daysAgo: 1 })
    ),
  ];
  const preview = buildPublicVibeEvidenceBackfillPreview({
    evidence: inputs,
    nowMs,
    sampleLimit: 500,
  });

  assert.equal(preview.dryRun, true);
  assert.equal(preview.targetCount, 1);
  assert.equal(preview.eligibleTargetCount, 1);
  assert.equal(preview.qualifiedEvidenceCount, 7);
  assert.equal(preview.privacy.identifiersReturned, false);
  assert.equal(preview.privacy.individualEvidenceReturned, false);
  const serialized = JSON.stringify(preview);
  assert.equal(serialized.includes("venue_private_id"), false);
  assert.equal(serialized.includes("guest_1"), false);
  assert.equal(serialized.includes("night_1"), false);
  assert.equal(serialized.includes("source_"), false);
});

test("backfill preview aggregates collisions and integrity rejections", () => {
  const valid = evidence({
    type: "authenticated_checkin",
    actorUid: "guest_1",
    sessionId: "night_1",
  });
  const preview = buildPublicVibeEvidenceBackfillPreview({
    evidence: [
      valid,
      { ...valid, sourceKey: buildPublicVibeSourceKey("protected_evidence", "replay") },
      evidence({
        type: "authenticated_checkin",
        actorUid: "venue_owner",
        sessionId: "night_1",
      }),
      evidence({
        type: "verified_review",
        actorUid: "guest_2",
        sessionId: "night_1",
        status: "revoked",
      }),
    ],
    ownerUidsByTarget: new Map([["venue:venue_private_id", ["venue_owner"]]]),
    nowMs,
    truncated: true,
    sampleLimit: 25,
  });

  assert.equal(preview.truncated, true);
  assert.equal(preview.collisionCount, 1);
  assert.deepEqual(preview.droppedReasonCounts, {
    duplicate: 1,
    self_attributed: 1,
    revoked: 1,
  });
  assert.equal(preview.qualifiedEvidenceCount, 1);
  assert.equal(preview.droppedEvidenceCount, 3);
});

test("backfill preview honors target filters without leaking excluded entities", () => {
  const preview = buildPublicVibeEvidenceBackfillPreview({
    evidence: [
      evidence({ type: "room_recap", sessionId: "venue_night" }),
      evidence({
        type: "room_recap",
        targetType: "host",
        targetId: "host_private_id",
        sessionId: "host_night",
      }),
      { evidenceType: "room_recap", targetType: "unknown", targetId: "bad" },
    ],
    targetTypes: ["venue"],
    nowMs,
  });

  assert.deepEqual(preview.selectedTargetTypes, ["venue"]);
  assert.equal(preview.consideredEvidenceCount, 1);
  assert.equal(preview.excludedByRequestedTypeCount, 1);
  assert.equal(preview.unsupportedTargetEvidenceCount, 1);
  assert.equal(preview.targetTypeSummaries.length, 1);
});
