import { createRequire } from "node:module";
import { test, expect } from "vitest";

const require = createRequire(import.meta.url);
const {
  buildPublicSongLeaderEntry,
  mergePublicSongLeaders,
} = require("../../functions/lib/publicChartSongLeaders");

test("song challenger ladders keep three unique results in score and applause order", () => {
  const leaders = mergePublicSongLeaders([
    { resultId: "second", score: 90, applauseScore: 20, displayName: "Two" },
    { resultId: "first", score: 100, applauseScore: 10, displayName: "One" },
    { resultId: "fourth", score: 80, applauseScore: 40, displayName: "Four" },
  ], { resultId: "third", score: 90, applauseScore: 10, displayName: "Three" });
  expect(leaders.map((entry) => entry.resultId)).toEqual(["first", "second", "third"]);
});

test("song challenger entries remove private identity and non-public fields", () => {
  expect(buildPublicSongLeaderEntry({
    resultId: "result-1",
    memberKey: "member-key",
    displayName: "Private Name",
    identityVisibility: "anonymous",
    avatarUrl: "https://example.com/private.png",
    singerUid: "secret-user-id",
    roomCode: "SECRET",
    score: 42,
  })).toEqual({
    resultId: "result-1",
    memberKey: "member-key",
    displayName: "BeauRocks Singer",
    identityVisibility: "anonymous",
    avatarUrl: null,
    score: 42,
    applauseScore: 0,
    qualifiedNightLabel: "Approved BeauRocks night",
    performedAtMs: 0,
  });
});
