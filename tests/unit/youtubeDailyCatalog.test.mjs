import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildNightlyYouTubeSearchBudget,
  buildPacificDateKey,
  buildYouTubeDailyCatalogPolicy,
  isFreshYouTubeCandidate,
  selectNightlyKaraokeCandidate,
} = require("../../functions/lib/youtubeDailyCatalog.js");

test("nightly YouTube catalog keeps a live-event reserve", () => {
  const policy = buildYouTubeDailyCatalogPolicy({
    YOUTUBE_DAILY_SEARCH_LIST_CALL_LIMIT: "100",
    YOUTUBE_NIGHTLY_LIVE_SEARCH_RESERVE: "20",
    YOUTUBE_NIGHTLY_CATALOG_SEARCH_CAP: "25",
    YOUTUBE_NIGHTLY_CATALOG_ENABLED: "true",
  });
  assert.equal(buildNightlyYouTubeSearchBudget({ usedSearchCalls: 0, policy }), 25);
  assert.equal(buildNightlyYouTubeSearchBudget({ usedSearchCalls: 70, policy }), 10);
  assert.equal(buildNightlyYouTubeSearchBudget({ usedSearchCalls: 80, policy }), 0);
});

test("nightly YouTube catalog policy scales reserve and caps public-launch harvesting", () => {
  const policy = buildYouTubeDailyCatalogPolicy({
    YOUTUBE_DAILY_SEARCH_LIST_CALL_LIMIT: "5000",
  });
  assert.equal(policy.liveSearchReserve, 1250);
  assert.equal(policy.nightlySearchCap, 100);
  assert.equal(policy.nightlySearchCeiling, 3750);
});

test("Pacific quota date key follows the YouTube reset timezone", () => {
  assert.equal(buildPacificDateKey(Date.parse("2026-07-19T06:30:00Z")), "20260718");
  assert.equal(buildPacificDateKey(Date.parse("2026-07-19T07:30:00Z")), "20260719");
});

test("nightly YouTube catalog selects only strong playable karaoke matches", () => {
  const selected = selectNightlyKaraokeCandidate({
    song: { title: "Flowers", artist: "Miley Cyrus" },
    items: [
      {
        id: "bad",
        title: "Flowers reaction video",
        channelTitle: "Fan Channel",
        playable: true,
        embeddable: true,
      },
      {
        id: "winner",
        title: "Flowers - Miley Cyrus (Karaoke Version)",
        channelTitle: "Sing King Karaoke",
        playable: true,
        embeddable: true,
        durationSec: 204,
        viewCount: 1000000,
      },
    ],
  });
  assert.equal(selected.item.id, "winner");
  assert.ok(selected.score >= 90);
});

test("canonical YouTube freshness uses explicit expiry or a bounded verification lease", () => {
  const atMs = Date.parse("2026-07-19T12:00:00Z");
  assert.equal(isFreshYouTubeCandidate({
    candidate: { provider: "youtube", playable: true, embeddable: true, expiresAtMs: atMs + 1000 },
    atMs,
  }), true);
  assert.equal(isFreshYouTubeCandidate({
    candidate: { provider: "youtube", playable: true, embeddable: true, lastVerifiedAtMs: atMs - (31 * 86400000) },
    atMs,
  }), false);
});

test("nightly YouTube enrichment is wired to live-reserve, active-room, and deletion guardrails", () => {
  const source = readFileSync(new URL("../../functions/index.js", import.meta.url), "utf8");
  const indexes = JSON.parse(readFileSync(new URL("../../firestore.indexes.json", import.meta.url), "utf8"));
  assert.match(source, /exports\.nightlyYouTubeCatalogEnrichment = onSchedule/);
  assert.match(source, /schedule: "35 23 \* \* \*"/);
  assert.match(source, /hasActiveRoomForNightlyYouTubeCatalog\(atMs\)/);
  assert.match(source, /maxMethodCalls: policy\.nightlySearchCeiling/);
  assert.match(source, /sourceDiscovery: "nightly_demand_catalog"/);
  assert.match(source, /deleteExpiredCanonicalYouTubeCandidates\(maintenanceAtMs\)/);
  assert.ok(indexes.indexes.some((index) => (
    index.collectionGroup === "backing_candidates"
    && index.queryScope === "COLLECTION_GROUP"
    && index.fields.some((field) => field.fieldPath === "expiresAtMs")
  )));
});
