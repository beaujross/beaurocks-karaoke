import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "vitest";

const require = createRequire(import.meta.url);
const {
  PUBLIC_VIBE_INDEX_ROLLUP_TARGET_TYPES,
  authorizePublicVibeIndexApply,
  buildPublicVibeIndexRollupProjection,
  buildPublicVibeIndexRolloutConfig,
  normalizePublicVibeIndexRollupTargetType,
  publicVibeIndexProjectionsEqual,
} = require("../../functions/lib/publicVibeIndexRollup.js");

test("public Vibe rollup normalizes supported entity types", () => {
  assert.deepEqual(PUBLIC_VIBE_INDEX_ROLLUP_TARGET_TYPES, ["venue", "host", "event", "room_session"]);
  assert.equal(normalizePublicVibeIndexRollupTargetType("session"), "room_session");
  assert.equal(normalizePublicVibeIndexRollupTargetType("unknown"), "");
});

test("public Vibe rollout defaults off and requires a non-empty exact canary allowlist", () => {
  const disabled = buildPublicVibeIndexRolloutConfig({});
  assert.equal(disabled.mode, "off");
  assert.equal(disabled.canRun, false);

  const emptyCanary = buildPublicVibeIndexRolloutConfig({ PUBLIC_VIBE_INDEX_ROLL_MODE: "canary" });
  assert.equal(emptyCanary.canRun, false);
  assert.equal(emptyCanary.reason, "missing_canary_targets");

  const canary = buildPublicVibeIndexRolloutConfig({
    PUBLIC_VIBE_INDEX_ROLL_MODE: "canary",
    PUBLIC_VIBE_INDEX_CANARY_TARGETS: "venue:venue_demo, venue:venue_demo, bad/value,host:host_demo",
  });
  assert.deepEqual(canary.canaryTargetKeys, ["venue:venue_demo", "host:host_demo"]);
  assert.equal(authorizePublicVibeIndexApply({
    rollout: canary,
    targetTypes: ["venue"],
    targetId: "venue_demo",
  }).allowed, true);
  assert.equal(authorizePublicVibeIndexApply({
    rollout: canary,
    targetTypes: ["venue"],
    targetId: "other",
  }).allowed, false);
  assert.equal(authorizePublicVibeIndexApply({
    rollout: canary,
    targetTypes: ["venue", "host"],
    targetId: "venue_demo",
  }).reason, "canary_requires_exact_target");
});

test("public Vibe rollup publishes a venue only after aggregate evidence qualifies", () => {
  const projection = buildPublicVibeIndexRollupProjection({
    targetType: "venue",
    entity: {
      karaokeNightsLabel: "Every Friday",
      experienceTags: ["friendly", "high energy"],
      beauRocksCapabilities: ["audience_voting"],
    },
    engagement: { reviewCount: 2, checkinCount: 3 },
    upcomingPublicEvents30d: 4,
    nowMs: 1_800_000_000_000,
  });

  assert.equal(projection.status, "published");
  assert.equal(projection.minimumThresholdMet, true);
  assert.ok(projection.score > 0 && projection.score <= 100);
  assert.deepEqual(projection.publicTags, ["friendly", "high_energy"]);
  assert.equal("reviewCount" in projection, false);
  assert.equal("checkinCount" in projection, false);
});

test("public Vibe rollup combines event host craft and venue aggregate signals", () => {
  const projection = buildPublicVibeIndexRollupProjection({
    targetType: "event",
    entity: {
      roomCode: "NEON1",
      experienceProfile: {
        format: "competitive",
        mechanics: { fairRotation: true },
        audienceFeatures: { voting: true },
        games: { trivia: true },
      },
    },
    hostInsights: { recapCount: 3, hostedRooms: 5 },
    hostAccount: { hasAccount: true, hasHostRole: true },
    engagement: { reviewCount: 1, checkinCount: 1 },
    venueEngagement: { reviewCount: 2, checkinCount: 4 },
    upcomingPublicEvents30d: 1,
  });

  assert.equal(projection.status, "published");
  assert.ok(projection.components.hostCraft > 0);
  assert.equal(projection.upcomingPublicEvents30d, 1);
});

test("public Vibe rollup comparison ignores fields outside the public contract", () => {
  const projection = buildPublicVibeIndexRollupProjection({
    targetType: "host",
    hostInsights: { recapCount: 3, hostedRooms: 4 },
  });
  assert.equal(publicVibeIndexProjectionsEqual(
    { ...projection, calculatedAtMs: 100, internalEvidenceCount: 99 },
    { ...projection, calculatedAtMs: 200 }
  ), true);
  assert.equal(publicVibeIndexProjectionsEqual(projection, { ...projection, score: projection.score - 1 }), false);
});
