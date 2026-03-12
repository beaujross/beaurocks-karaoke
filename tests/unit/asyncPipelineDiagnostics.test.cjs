const assert = require("node:assert/strict");
const {
  classifyLyricsPipeline,
  classifyPopTriviaPipeline,
} = require("../../functions/lib/asyncPipelineDiagnostics");

test("asyncPipelineDiagnostics.test", async () => {
  const now = Date.now();

  const staleLyrics = classifyLyricsPipeline({
    lyricsGenerationStatus: "pending",
    lyricsGenerationResolution: "pending",
    lyricsGenerationUpdatedAt: { toMillis: () => now - (5 * 60 * 1000) },
  }, { now });
  assert.equal(staleLyrics.issueCode, "stale_pending");
  assert.equal(staleLyrics.recoveryEligible, true);

  const blockedLyrics = classifyLyricsPipeline({
    lyricsGenerationStatus: "capability_blocked",
    lyricsGenerationResolution: "capability_blocked",
  }, { now });
  assert.equal(blockedLyrics.issueCode, "capability_blocked");
  assert.equal(blockedLyrics.recoveryEligible, false);

  const brokenResolvedLyrics = classifyLyricsPipeline({
    lyricsGenerationStatus: "resolved",
    lyricsGenerationResolution: "catalog_text",
    lyrics: "",
    lyricsTimed: null,
  }, { now });
  assert.equal(brokenResolvedLyrics.issueCode, "resolved_without_payload");

  const stalePopTrivia = classifyPopTriviaPipeline({
    popTriviaStatus: "pending",
    popTriviaRequestedAtMs: now - (4 * 60 * 1000),
  }, { now });
  assert.equal(stalePopTrivia.issueCode, "stale_pending");
  assert.equal(stalePopTrivia.recoveryEligible, true);

  const failedPopTrivia = classifyPopTriviaPipeline({
    popTriviaStatus: "failed",
    popTriviaError: "provider quota exhausted",
    popTriviaUpdatedAt: { toMillis: () => now - (10 * 60 * 1000) },
  }, { now });
  assert.equal(failedPopTrivia.issueCode, "failed");
  assert.equal(failedPopTrivia.recoveryEligible, true);

  const brokenReadyPopTrivia = classifyPopTriviaPipeline({
    popTriviaStatus: "ready",
    popTrivia: [],
  }, { now });
  assert.equal(brokenReadyPopTrivia.issueCode, "ready_without_payload");
});
