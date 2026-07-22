import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildBackingCandidateDocId,
  buildCanonicalBackingCandidatePatchFromYouTubeIndexEntry,
  buildCanonicalBackingCandidateSummaries,
  defaultExtractYouTubeId,
  normalizeBackingTelemetryForAdmin,
  sanitizeBackingDocId,
} = require("../../functions/lib/backingCandidates.js");

test("backing candidate helpers normalize stable provider document ids", () => {
  assert.equal(defaultExtractYouTubeId("https://www.youtube.com/watch?v=abc123XYZ_9"), "abc123XYZ_9");
  assert.equal(sanitizeBackingDocId("flowers / youtube / bad id"), "flowers-__-youtube-__-bad-id");
  assert.equal(buildBackingCandidateDocId({
    songId: "flowers__miley cyrus",
    source: "youtube",
    mediaUrl: "https://youtu.be/abc123XYZ_9",
  }), "flowers__miley-cyrus__youtube__abc123XYZ_9");
  assert.equal(buildBackingCandidateDocId({
    songId: "flowers__miley cyrus",
    backingCandidateId: "flowers__youtube__known",
  }), "flowers__youtube__known");
});

test("backing candidate helpers sanitize telemetry snapshots", () => {
  assert.deepEqual(normalizeBackingTelemetryForAdmin({
    hostUpvotes: "2.4",
    cohostDownvotes: 1,
    usageCount: -7,
    skipCount: 2,
  }), {
    hostUpvotes: 2,
    hostDownvotes: 0,
    coHostUpvotes: 0,
    coHostDownvotes: 1,
    audienceUpvotes: 0,
    audienceDownvotes: 0,
    usageCount: 0,
    completionCount: 0,
    skipCount: 2,
  });
});

test("backing candidate helpers build canonical patches from curated YouTube index entries", () => {
  const patch = buildCanonicalBackingCandidatePatchFromYouTubeIndexEntry({
    entry: {
      canonicalSongId: "flowers__miley cyrus",
      videoId: "abc123XYZ_9",
      trackName: "Flowers Karaoke Version",
      artistName: "Miley Cyrus",
      url: "https://www.youtube.com/watch?v=abc123XYZ_9",
      artworkUrl100: "https://img.example/flowers.jpg",
      playable: true,
      embeddable: true,
      successCount: 4,
      usageCount: 5,
      failureCount: 1,
      rankingScore: 132,
      qualityScore: 18,
      backingTelemetry: { hostUpvotes: 2 },
    },
    roomCode: "ROOM1",
    actorUid: "host-uid",
    sourceDiscovery: "trusted_catalog",
    timestamp: 12345,
    atMs: 1_000_000,
  });

  assert.equal(patch.songId, "flowers__miley cyrus");
  assert.equal(patch.candidateId, "flowers__miley-cyrus__youtube__abc123XYZ_9");
  assert.equal(patch.data.provider, "youtube");
  assert.equal(patch.data.providerTrackId, "abc123XYZ_9");
  assert.equal(patch.data.mediaUrl, "https://www.youtube.com/watch?v=abc123XYZ_9");
  assert.equal(patch.data.sourceDiscovery, "trusted_catalog");
  assert.equal(patch.data.sourceRoomCode, "ROOM1");
  assert.equal(patch.data.rankingScore, 132);
  assert.equal(patch.data.lastVerifiedAtMs, 1_000_000);
  assert.equal(patch.data.expiresAtMs, 1_000_000 + (29 * 24 * 60 * 60 * 1000));
  assert.deepEqual(patch.data.telemetry, {
    hostUpvotes: 2,
    hostDownvotes: 0,
    coHostUpvotes: 0,
    coHostDownvotes: 0,
    audienceUpvotes: 0,
    audienceDownvotes: 0,
    usageCount: 5,
    completionCount: 4,
    skipCount: 1,
  });
});

test("backing candidate helpers skip unanchored, unverified, or non-embeddable index entries", () => {
  assert.equal(buildCanonicalBackingCandidatePatchFromYouTubeIndexEntry({
    entry: { videoId: "abc123", trackName: "No canonical song", playable: true, embeddable: true },
  }), null);
  assert.equal(buildCanonicalBackingCandidatePatchFromYouTubeIndexEntry({
    entry: { canonicalSongId: "song", videoId: "abc123", playable: true },
  }), null);
  assert.equal(buildCanonicalBackingCandidatePatchFromYouTubeIndexEntry({
    entry: { canonicalSongId: "song", videoId: "abc123", playable: true, embeddable: false },
  }), null);
});

test("backing candidate summaries rank reusable canonical backings", () => {
  const scoreCatalogTextMatch = (needle, haystack) => {
    if (String(haystack).toLowerCase().includes(String(needle).toLowerCase())) return 120;
    return 0;
  };
  const docs = [
    {
      id: "low",
      data: () => ({
        candidateId: "low",
        provider: "youtube",
        providerTrackId: "low111",
        title: "Flowers Karaoke",
        artist: "Miley Cyrus",
        rankingScore: 70,
        lastVerifiedAtMs: Date.now(),
        telemetry: { usageCount: 1, completionCount: 1 },
      }),
    },
    {
      id: "winner",
      data: () => ({
        candidateId: "winner",
        provider: "youtube",
        providerTrackId: "win999",
        title: "Flowers Karaoke Version",
        artist: "Miley Cyrus",
        rankingScore: 140,
        qualityScore: 12,
        lastVerifiedAtMs: Date.now(),
        telemetry: { usageCount: 5, completionCount: 4 },
      }),
    },
  ];

  const summaries = buildCanonicalBackingCandidateSummaries({
    candidateDocs: docs,
    songId: "flowers__miley cyrus",
    title: "Flowers",
    artist: "Miley Cyrus",
    scoreCatalogTextMatch,
  });

  assert.equal(summaries[0].id, "winner");
  assert.equal(summaries[0].mediaUrl, "https://www.youtube.com/watch?v=win999");
  assert.equal(summaries[0].resolutionLayer || summaries[0].layer, "canonical_backing");
  assert.equal(summaries[0].usageCount, 5);
  assert.equal(summaries[0].successCount, 4);
});

test("backing candidate summaries omit stale YouTube metadata", () => {
  const atMs = Date.parse("2026-07-19T12:00:00Z");
  const summaries = buildCanonicalBackingCandidateSummaries({
    candidateDocs: [{
      id: "expired",
      data: () => ({
        provider: "youtube",
        providerTrackId: "old111",
        title: "Old Karaoke",
        artist: "Old Artist",
        expiresAtMs: atMs - 1,
      }),
    }],
    songId: "old__old artist",
    title: "Old",
    artist: "Old Artist",
    atMs,
  });
  assert.deepEqual(summaries, []);
});
