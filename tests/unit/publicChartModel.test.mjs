import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildOpeningSongScores,
  mergePublicSongChart,
  PUBLIC_CHART_VISIBLE_LIMIT,
} from "../../src/apps/Marketing/pages/publicChartModel.js";

test("opening scores are deterministic, low, and limited to popular catalog songs", () => {
  const first = buildOpeningSongScores();
  const second = buildOpeningSongScores();
  assert.deepEqual(first, second);
  assert.equal(first.length, PUBLIC_CHART_VISIBLE_LIMIT);
  assert.ok(first.every((song) => song.isOpeningScore === true));
  assert.ok(first.every((song) => song.bestScore >= 9 && song.bestScore <= 24));
});

test("a real score replaces the matching opening score instead of creating a duplicate song", () => {
  const opening = buildOpeningSongScores()[0];
  const merged = mergePublicSongChart([{
    id: "real-result",
    songId: opening.songId,
    songTitle: opening.songTitle,
    artist: opening.artist,
    bestScore: 120,
    displayName: "Mic Hero",
  }]);
  const matches = merged.filter((song) => song.songTitle === opening.songTitle && song.artist === opening.artist);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, "real-result");
  assert.equal(matches[0].isOpeningScore, false);
});
