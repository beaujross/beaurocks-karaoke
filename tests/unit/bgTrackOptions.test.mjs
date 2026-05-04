import assert from "node:assert/strict";
import { test } from "vitest";

import { BG_TRACKS } from "../../src/lib/gameDataConstants.js";
import { BG_TRACK_OPTIONS, getBgTrackById, getNextBgTrackIndex } from "../../src/lib/bgTrackOptions.js";

test("Lantern Circuit is the default host background music track", () => {
  assert.equal(BG_TRACKS[0]?.name, "Lantern Circuit");
  assert.equal(BG_TRACKS[0]?.url, "/audio/Lantern%20Circuit.mp3");
  assert.equal(BG_TRACK_OPTIONS[0]?.id, "lantern_circuit");
  assert.equal(BG_TRACK_OPTIONS[0]?.index, 0);
  assert.equal(getBgTrackById("lantern_circuit")?.url, "/audio/Lantern%20Circuit.mp3");
});

test("getNextBgTrackIndex advances and wraps around the configured background playlist", () => {
  assert.equal(getNextBgTrackIndex(0, BG_TRACK_OPTIONS.length), 1);
  assert.equal(getNextBgTrackIndex(BG_TRACK_OPTIONS.length - 1, BG_TRACK_OPTIONS.length), 0);
  assert.equal(getNextBgTrackIndex(-1, BG_TRACK_OPTIONS.length), 0);
  assert.equal(getNextBgTrackIndex(5, 0), 0);
});
