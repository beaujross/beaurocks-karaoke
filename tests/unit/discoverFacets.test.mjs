import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildHostFacetOptions,
  countEventCadenceListings,
  countListingTypes,
  resolveEffectiveHostFilter,
} from "../../src/apps/Marketing/pages/discoverFacets.js";

test("discoverFacets.test prefers server host facets and sanitizes them", () => {
  const hostFacetOptions = buildHostFacetOptions({
    facets: {
      host: [
        { hostUid: " host-1 ", hostName: " DJ One ", count: "3" },
        { hostUid: "", hostName: "Missing", count: 10 },
        { hostUid: "host-2", hostName: "", count: null },
      ],
    },
    listings: [
      { hostUid: "fallback", hostName: "Fallback Host" },
    ],
    limit: 5,
  });

  assert.deepEqual(hostFacetOptions, [
    { id: "host-1", hostUid: "host-1", hostName: "DJ One", count: 3 },
    { id: "host-2", hostUid: "host-2", hostName: "Host", count: 0 },
  ]);
});

test("discoverFacets.test builds fallback host facets from listings and resolves host filters", () => {
  const hostFacetOptions = buildHostFacetOptions({
    listings: [
      { hostUid: "host-b", hostName: "Bravo" },
      { hostUid: "host-a", hostName: "Alpha" },
      { hostUid: "host-b", hostName: "Bravo" },
      { hostUid: "host-c", hostName: "" },
      { hostUid: "" },
    ],
    limit: 2,
  });

  assert.deepEqual(hostFacetOptions, [
    { id: "host-b", hostUid: "host-b", hostName: "Bravo", count: 2 },
    { id: "host-a", hostUid: "host-a", hostName: "Alpha", count: 1 },
  ]);
  assert.equal(resolveEffectiveHostFilter({ hostFilter: "host-b", hostFacetOptions }), "host-b");
  assert.equal(resolveEffectiveHostFilter({ hostFilter: "missing", hostFacetOptions }), "all");
  assert.equal(resolveEffectiveHostFilter({ hostFilter: "all", hostFacetOptions }), "all");
});

test("discoverFacets.test counts listing types and event cadence", () => {
  const listings = [
    { listingType: "event", isRecurringEvent: true, isBeauRocksElevated: true },
    { listingType: "event", isRecurringEvent: false },
    { listingType: "room_session", isBeauRocksElevated: true },
    { listingType: "venue" },
    {},
  ];

  assert.deepEqual(countEventCadenceListings(listings), {
    total: 2,
    recurring: 1,
    one_time: 1,
  });
  assert.deepEqual(countListingTypes({ listings, includeElevated: true }), {
    venue: 2,
    event: 2,
    room_session: 1,
    elevated: 2,
  });
  assert.deepEqual(countListingTypes({ listings }), {
    venue: 2,
    event: 2,
    room_session: 1,
  });
});

test("discoverFacets.test handles defensive inputs", () => {
  assert.deepEqual(buildHostFacetOptions({ listings: "not-an-array", limit: -1 }), []);
  assert.deepEqual(countEventCadenceListings("not-an-array"), {
    total: 0,
    recurring: 0,
    one_time: 0,
  });
  assert.deepEqual(countListingTypes({ listings: "not-an-array", includeElevated: true }), {
    venue: 0,
    event: 0,
    room_session: 0,
    elevated: 0,
  });
});
