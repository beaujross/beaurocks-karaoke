import assert from "node:assert/strict";
import { test } from "vitest";
import { MARKETING_ROUTE_PAGES } from "../../src/apps/Marketing/routing.js";
import { buildSeoRouteRecord } from "../../src/apps/Marketing/seoModel.js";

test("marketingSeoModel builds noindex routes correctly", () => {
  const record = buildSeoRouteRecord({
    page: MARKETING_ROUTE_PAGES.join,
    id: "ABCD",
    params: { roomCode: "ABCD" },
  }, {
    baseUrl: "https://beaurocks.app",
  });

  assert.equal(record.indexable, false);
  assert.equal(record.robots, "noindex,nofollow");
  assert.equal(record.routePath, "/join/ABCD");
});

test("marketingSeoModel prefers entity-aware title and social card", () => {
  const record = buildSeoRouteRecord({
    page: MARKETING_ROUTE_PAGES.venue,
    id: "Venue_MixedCase_42",
    params: {},
  }, {
    baseUrl: "https://beaurocks.app",
    entity: {
      id: "Venue_MixedCase_42",
      title: "Fletcher Bay Winery",
      city: "Bainbridge Island",
      state: "WA",
      socialCardPath: "/images/social/venue-venue_mixedcase_42.png",
    },
  });

  assert.equal(record.title, "Fletcher Bay Winery | Karaoke Venue | BeauRocks");
  assert.equal(record.canonicalUrl, "https://beaurocks.app/venues/Venue_MixedCase_42");
  assert.equal(record.image.url, "https://beaurocks.app/images/social/venue-venue_mixedcase_42.png");
  assert.equal(record.indexable, true);
});

test("marketingSeoModel uses the updated homepage title and featured image alt text", () => {
  const record = buildSeoRouteRecord({
    page: MARKETING_ROUTE_PAGES.forFans,
    id: "",
    params: {},
  }, {
    baseUrl: "https://beaurocks.app",
    entity: {
      socialCardPath: "/images/social/for_fans.png",
    },
  });

  assert.equal(record.title, "Host Karaoke at Home or Find a Live Night | BeauRocks");
  assert.equal(record.description, "Run self-hosted karaoke at home or at a private party, or discover live karaoke nights near you with BeauRocks.");
  assert.equal(record.image.alt, "BeauRocks Karaoke neon logo with microphone over a retro stage grid.");
});
