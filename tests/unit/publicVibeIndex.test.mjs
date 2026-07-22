import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "vitest";
import { MARKETING_BRAND_NEON_URL } from "../../src/apps/Marketing/pages/shared.js";
import { buildDiscoverListing } from "../../src/apps/Marketing/pages/discoverListingViewModel.js";
import { MARKETING_ROUTE_PAGES } from "../../src/apps/Marketing/routing.js";
import { buildSeoRouteRecord } from "../../src/apps/Marketing/seoModel.js";

const require = createRequire(import.meta.url);
const {
  PUBLIC_VIBE_INDEX_VERSION,
  buildPublicVibeIndexProjection,
  derivePublicVibeIndexProjection,
} = require("../../functions/lib/publicVibeIndex.js");

test("public Vibe reader ignores raw evidence that was not persisted by trusted code", () => {
  const projection = buildPublicVibeIndexProjection({
    hostRecapCount: 100,
    venueReviewCount: 100,
    upcomingPublicEvents30d: 2,
    publicTags: ["friendly", "first timers"],
  });

  assert.equal(projection.scoreVersion, PUBLIC_VIBE_INDEX_VERSION);
  assert.equal(projection.status, "not_enough_data");
  assert.equal(projection.score, null);
  assert.equal(projection.minimumThresholdMet, false);
  assert.equal(projection.upcomingPublicEvents30d, 0);
});

test("trusted Vibe derivation withholds a score below its evidence threshold", () => {
  const projection = derivePublicVibeIndexProjection({
    hostRecapCount: 1,
    venueReviewCount: 1,
    upcomingPublicEvents30d: 2,
  });
  assert.equal(projection.status, "not_enough_data");
  assert.equal(projection.upcomingPublicEvents30d, 2);
});

test("trusted Vibe derivation publishes only the bounded aggregate contract", () => {
  const projection = derivePublicVibeIndexProjection({
    hostRecapCount: 5,
    hostHostedRooms: 8,
    venueReviewCount: 4,
    venueCheckinCount: 7,
    upcomingPublicEvents30d: 3,
    capabilityCount: 4,
    funSignalCount: 3,
    publicTags: ["Friendly", "Competitive", "friendly"],
    recurringRule: "weekly",
    lastActiveAtMs: Date.now() - 60_000,
    nowMs: Date.now(),
    isBeauRocksPowered: true,
  });

  assert.equal(projection.status, "published");
  assert.equal(projection.minimumThresholdMet, true);
  assert.ok(projection.score > 0 && projection.score <= 100);
  assert.ok(projection.components.energy > 0);
  assert.deepEqual(projection.publicTags, ["friendly", "competitive"]);
  assert.equal("totalSongs" in projection, false);
  assert.equal("totalUsers" in projection, false);
});

test("discover listing view model preserves the versioned public projection", () => {
  const listing = buildDiscoverListing({
    id: "venue-vibe",
    listingType: "venue",
    title: "Neon Room",
    publicVibeIndex: {
      scoreVersion: PUBLIC_VIBE_INDEX_VERSION,
      status: "published",
      score: 88.4,
      label: "electric",
      confidence: "high",
      activityBand: "very_active",
      upcomingPublicEvents30d: 4,
    },
  }, "venue");

  assert.deepEqual(listing.publicVibeIndex, {
    scoreVersion: PUBLIC_VIBE_INDEX_VERSION,
    status: "published",
    score: 88,
    label: "electric",
    confidence: "high",
    activityBand: "very_active",
    upcomingPublicEvents30d: 4,
  });
});

test("Organization schema uses the BeauRocks brand logo instead of a page social card", () => {
  const record = buildSeoRouteRecord({
    page: MARKETING_ROUTE_PAGES.forFans,
    id: "",
    params: {},
  }, {
    baseUrl: "https://beaurocks.app",
    entity: {
      title: "Schema Stage",
      socialCardPath: "/images/social/venue-schema.png",
    },
  });
  const organization = record.jsonLd.find((entry) => entry?.["@type"] === "Organization");

  assert.equal(organization.logo, `https://beaurocks.app${MARKETING_BRAND_NEON_URL}`);
  assert.notEqual(organization.logo, record.image.url);
});
