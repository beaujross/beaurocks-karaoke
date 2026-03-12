import assert from "node:assert/strict";
import { test } from "vitest";
import {
  LIVE_LOOKBACK_MS,
  calculateDistanceMiles,
  computeTimePriority,
  formatDistanceLabel,
  rankDiscoverListings,
  scoreSearchRelevance,
  sortDiscoverListings,
} from "../../src/apps/Marketing/pages/discoverRanking.js";

test("discoverRanking.test helper coverage", () => {
  const nowMs = 40 * 60 * 60 * 1000;
  assert.equal(computeTimePriority(0, 1_000), 0);
  assert.equal(computeTimePriority(1_000 + 1_000, 1_000), 44);
  assert.equal(computeTimePriority(1_000 + (10 * 60 * 60 * 1000), 1_000), 28);
  assert.equal(computeTimePriority(1_000 + (36 * 60 * 60 * 1000), 1_000), 16);
  assert.equal(computeTimePriority(nowMs - (LIVE_LOOKBACK_MS + 1_000), nowMs), 12);
  assert.equal(computeTimePriority(nowMs - (30 * 60 * 60 * 1000), nowMs), 6);

  assert.equal(scoreSearchRelevance({ title: "Alpha Night" }, " alpha "), 26);
  assert.equal(scoreSearchRelevance({ title: "Late Alpha Night" }, "alpha"), 18);
  assert.equal(scoreSearchRelevance({ subtitle: "Alpha host" }, "alpha"), 12);
  assert.equal(scoreSearchRelevance({ detailLine: "Alpha detail" }, "alpha"), 8);
  assert.equal(scoreSearchRelevance({ title: "Bravo" }, "alpha"), 0);
  assert.equal(scoreSearchRelevance({}, ""), 0);

  assert.equal(sortDiscoverListings({ title: "B", startsAtMs: 100 }, { title: "A", startsAtMs: 200 }), -100);
  assert.equal(sortDiscoverListings({ title: "A", startsAtMs: 100 }, { title: "B", startsAtMs: 0 }), -1);
  assert.equal(sortDiscoverListings({ title: "A", startsAtMs: 0 }, { title: "B", startsAtMs: 100 }), 1);
  assert.equal(sortDiscoverListings({ title: "Alpha", startsAtMs: 0 }, { title: "Zulu", startsAtMs: 0 }), -1);

  assert.equal(formatDistanceLabel(-1), "");
  assert.equal(formatDistanceLabel(0.01), "100 ft away");
  assert.equal(formatDistanceLabel(1.25), "1.3 mi away");

  assert.equal(calculateDistanceMiles(null, { lat: 0, lng: 0 }), null);
  assert.equal(calculateDistanceMiles({ lat: "bad", lng: 0 }, { lat: 0, lng: 0 }), null);
  const miles = calculateDistanceMiles({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  assert.ok(miles > 69 && miles < 70);
});

test("discoverRanking.test ranks listings by composite score by default", () => {
  const ranked = rankDiscoverListings({
    listings: [
      {
        id: "official",
        title: "Official Night",
        listingType: "event",
        startsAtMs: 10_000,
        location: { lat: 0, lng: 0 },
        isOfficialBeauRocksListing: true,
      },
      {
        id: "boosted-room",
        title: "Interactive Room",
        listingType: "room_session",
        startsAtMs: 12_000,
        location: { lat: 0, lng: 0 },
      },
      {
        id: "venue",
        title: "Neighborhood Venue",
        listingType: "venue",
        startsAtMs: 0,
        location: { lat: 0, lng: 0 },
      },
    ],
    userLocation: { lat: 0, lng: 0 },
    rankingNowMs: 9_000,
    search: "official",
    deriveExperience: (entry) => ({ discoveryBoost: entry.id === "boosted-room" ? 18 : 0 }),
    calculateDistance: () => 1.5,
    formatDistance: (distanceMiles) => `${distanceMiles} mi away`,
  });

  assert.deepEqual(ranked.map((entry) => entry.id), ["official", "boosted-room", "venue"]);
  assert.equal(ranked[0].distanceMiles, 1.5);
  assert.equal(ranked[0].distanceLabel, "1.5 mi away");
  assert.equal(ranked[1].experience.discoveryBoost, 18);
});

test("discoverRanking.test supports soonest and nearest sorting without changing decoration", () => {
  const baseListings = [
    {
      id: "no-distance",
      title: "Zulu",
      listingType: "venue",
      startsAtMs: 0,
      location: null,
    },
    {
      id: "farther",
      title: "Bravo",
      listingType: "event",
      startsAtMs: 2_000,
      location: { lat: 1, lng: 1 },
    },
    {
      id: "nearer",
      title: "Alpha",
      listingType: "event",
      startsAtMs: 5_000,
      location: { lat: 2, lng: 2 },
    },
  ];
  const distanceById = {
    farther: 5,
    nearer: 1,
  };
  const calculateDistance = (_userLocation, location) => {
    if (!location) return null;
    return location.lat === 1 ? distanceById.farther : distanceById.nearer;
  };

  const soonest = rankDiscoverListings({
    listings: baseListings,
    sortMode: "soonest",
    calculateDistance,
    deriveExperience: () => ({ discoveryBoost: 0 }),
  });
  assert.deepEqual(soonest.map((entry) => entry.id), ["farther", "nearer", "no-distance"]);

  const nearest = rankDiscoverListings({
    listings: baseListings,
    sortMode: "nearest",
    calculateDistance,
    deriveExperience: () => ({ discoveryBoost: 0 }),
  });
  assert.deepEqual(nearest.map((entry) => entry.id), ["no-distance", "nearer", "farther"]);
});

test("discoverRanking.test supports host-first ordering and defensive defaults", () => {
  const ranked = rankDiscoverListings({
    listings: [
      {
        id: "host-a-1",
        title: "Alpha First",
        listingType: "event",
        hostToken: "host:a",
        hostName: "Alpha",
        startsAtMs: 11_000,
        isOfficialBeauRocksListing: true,
      },
      {
        id: "host-a-2",
        title: "Alpha Second",
        listingType: "venue",
        hostToken: "host:a",
        hostName: "Alpha",
        startsAtMs: 11_000,
      },
      {
        id: "host-b-1",
        title: "Bravo First",
        listingType: "event",
        hostToken: "host:b",
        hostName: "Bravo",
        startsAtMs: 14_000,
        isBeauRocksElevated: true,
      },
      {
        id: "unhosted",
        title: "Zulu Solo",
        listingType: "event",
        startsAtMs: 9_000,
      },
    ],
    rankingNowMs: 10_000,
    sortMode: "host_first",
    deriveExperience: () => ({ discoveryBoost: 0 }),
    calculateDistance: () => null,
  });

  assert.deepEqual(ranked.map((entry) => entry.id), ["host-a-1", "host-a-2", "host-b-1", "unhosted"]);

  const fallback = rankDiscoverListings({
    listings: "not-an-array",
  });
  assert.deepEqual(fallback, []);
});

test("discoverRanking.test preserves same-host and no-host tie behavior", () => {
  const sameHostScoreTieBreak = rankDiscoverListings({
    listings: [
      {
        id: "host-score-high",
        title: "Same Slot",
        listingType: "event",
        hostToken: "host:a",
        hostName: "Alpha",
        startsAtMs: 10_000,
        isOfficialBeauRocksListing: true,
      },
      {
        id: "host-score-low",
        title: "Same Slot",
        listingType: "event",
        hostToken: "host:a",
        hostName: "Alpha",
        startsAtMs: 10_000,
      },
      {
        id: "host-title-alpha",
        title: "Alpha Slot",
        listingType: "event",
        hostToken: "host:b",
        hostName: "Bravo",
        startsAtMs: 10_000,
      },
      {
        id: "host-title-zulu",
        title: "Zulu Slot",
        listingType: "event",
        hostToken: "host:b",
        hostName: "Bravo",
        startsAtMs: 10_000,
      },
      {
        id: "solo-alpha",
        title: "Alpha Solo",
        listingType: "event",
        startsAtMs: 20_000,
      },
      {
        id: "solo-zulu",
        title: "Zulu Solo",
        listingType: "event",
        startsAtMs: 20_000,
      },
    ],
    rankingNowMs: 9_000,
    sortMode: "host_first",
    calculateDistance: () => null,
  });

  assert.deepEqual(sameHostScoreTieBreak.map((entry) => entry.id), [
    "host-score-high",
    "host-score-low",
    "host-title-alpha",
    "host-title-zulu",
    "solo-alpha",
    "solo-zulu",
  ]);

  const defaultTieBreak = rankDiscoverListings({
    listings: [
      { id: "alpha", title: "Alpha", listingType: "venue", startsAtMs: 0 },
      { id: "zulu", title: "Zulu", listingType: "venue", startsAtMs: 0 },
    ],
    calculateDistance: () => null,
  });
  assert.deepEqual(defaultTieBreak.map((entry) => entry.id), ["alpha", "zulu"]);
});
