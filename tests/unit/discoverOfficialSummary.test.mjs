import assert from "node:assert/strict";
import { test } from "vitest";
import { buildOfficialListingSummary } from "../../src/apps/Marketing/pages/discoverOfficialSummary.js";

const sortListings = (a, b) => {
  const aStarts = Number(a?.startsAtMs || 0);
  const bStarts = Number(b?.startsAtMs || 0);
  if (aStarts > 0 && bStarts > 0 && aStarts !== bStarts) return aStarts - bStarts;
  if (aStarts > 0 && bStarts <= 0) return -1;
  if (aStarts <= 0 && bStarts > 0) return 1;
  return String(a?.title || "").localeCompare(String(b?.title || ""));
};

test("discoverOfficialSummary.test", () => {
  const nowMs = 1_000_000;
  const summary = buildOfficialListingSummary({
    listings: [
      {
        title: "Official Soon",
        startsAtMs: nowMs + 1_000,
        isOfficialBeauRocksListing: true,
        isOfficialBeauRocksRoom: true,
        isBeauRocksElevated: true,
      },
      {
        title: "Official No Start",
        startsAtMs: 0,
        isOfficialBeauRocksListing: true,
        isBeauRocksElevated: true,
      },
      {
        title: "Official Recent",
        startsAtMs: nowMs - 1_000,
        isOfficialBeauRocksListing: true,
      },
      {
        title: "Official Too Old",
        startsAtMs: nowMs - (3 * 60 * 60 * 1000),
        isOfficialBeauRocksListing: true,
      },
      {
        title: "Elevated Only",
        startsAtMs: nowMs + 5_000,
        isBeauRocksElevated: true,
      },
      {
        title: "Unofficial",
        startsAtMs: nowMs + 2_000,
      },
    ],
    nowMs,
    liveLookbackMs: 2 * 60 * 60 * 1000,
    sortListings,
    limit: 3,
  });

  assert.equal(summary.officialBeauRocksListingCount, 4);
  assert.equal(summary.officialBeauRocksRoomCount, 1);
  assert.equal(summary.beauRocksElevatedCount, 3);
  assert.deepEqual(
    summary.officialUpcomingListings.map((entry) => entry.title),
    ["Official Recent", "Official Soon", "Official No Start"]
  );
});

test("discoverOfficialSummary.test defaults and defensive inputs", () => {
  const fallbackSummary = buildOfficialListingSummary({
    listings: "not-an-array",
    limit: -5,
  });
  assert.equal(fallbackSummary.officialBeauRocksListingCount, 0);
  assert.equal(fallbackSummary.officialBeauRocksRoomCount, 0);
  assert.equal(fallbackSummary.beauRocksElevatedCount, 0);
  assert.deepEqual(fallbackSummary.officialUpcomingListings, []);

  const defaultSortSummary = buildOfficialListingSummary({
    listings: [
      { title: "Zulu", isOfficialBeauRocksListing: true, startsAtMs: 0 },
      { title: "Alpha", isOfficialBeauRocksListing: true, startsAtMs: 0 },
    ],
  });
  assert.deepEqual(
    defaultSortSummary.officialUpcomingListings.map((entry) => entry.title),
    ["Alpha", "Zulu"]
  );
});
