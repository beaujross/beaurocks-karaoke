import assert from "node:assert/strict";
import { test } from "vitest";
import {
  TIGHT15_MAX,
  normalizeTight15Entry,
  sanitizeTight15List,
  moveTight15Entry,
  collectFollowedHostIds,
} from "../../src/apps/Marketing/dashboardUtils.js";

test("marketingDashboardUtils.test", () => {
  const normalized = normalizeTight15Entry({
    songTitle: "  Bohemian   Rhapsody ",
    artist: " Queen ",
  });
  assert.equal(normalized.songTitle, "Bohemian   Rhapsody".trim());
  assert.equal(normalized.artist, "Queen");

  const sanitized = sanitizeTight15List([
    { songTitle: "Africa", artist: "Toto" },
    { songTitle: " africa ", artist: "  toto " },
    { songTitle: "Rosanna", artist: "Toto" },
  ]);
  assert.equal(sanitized.length, 2);

  const maxList = Array.from({ length: TIGHT15_MAX + 4 }, (_, i) => ({
    songTitle: `Song ${i + 1}`,
    artist: "Artist",
  }));
  assert.equal(sanitizeTight15List(maxList).length, TIGHT15_MAX);

  const reordered = moveTight15Entry(
    [
      { id: "a", songTitle: "A", artist: "X" },
      { id: "b", songTitle: "B", artist: "X" },
      { id: "c", songTitle: "C", artist: "X" },
    ],
    2,
    0
  );
  assert.deepEqual(reordered.map((entry) => entry.id), ["c", "a", "b"]);

  const hostIds = collectFollowedHostIds([
    { targetType: "host", targetId: "h_1" },
    { targetType: "performer", targetId: "p_1" },
    { targetType: "host", targetId: "h_1" },
    { targetType: "host", targetId: "h_2" },
  ]);
  assert.deepEqual(hostIds, ["h_1", "h_2"]);});
