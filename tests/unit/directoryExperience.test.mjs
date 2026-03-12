import assert from "node:assert/strict";
import { test } from "vitest";
import {
  deriveDirectoryExperience,
  matchesDirectoryExperienceFilter,
  summarizeGeoExperience,
} from "../../src/apps/Marketing/lib/directoryExperience.js";

test("directoryExperience.test", () => {
  const beauRocksRoom = deriveDirectoryExperience({
    listingType: "room_session",
    roomCode: "BR123",
    isOfficialBeauRocksRoom: true,
    hasBeauRocksHostAccount: true,
    hostRecapCount: 4,
    karaokeNightsLabel: "Thu nights",
    rotationEstimate: "fast",
    beginnerFriendly: "high",
  });
  assert.equal(beauRocksRoom.isBeauRocksPowered, true);
  assert.equal(beauRocksRoom.capabilityBadges.includes("Live Join"), true);
  assert.equal(beauRocksRoom.capabilityBadges.includes("Audience App"), true);
  assert.equal(beauRocksRoom.capabilityBadges.includes("Recap Ready"), true);
  assert.equal(beauRocksRoom.funBadges.includes("Fast Rotation"), true);
  assert.equal(beauRocksRoom.funBadges.includes("Beginner Friendly"), true);
  assert.equal(matchesDirectoryExperienceFilter(beauRocksRoom, "modern"), true);
  assert.equal(matchesDirectoryExperienceFilter(beauRocksRoom, "live_join"), true);
  assert.equal(matchesDirectoryExperienceFilter(beauRocksRoom, "recap"), true);

  const standardNight = deriveDirectoryExperience({
    listingType: "venue",
    venueReviewCount: 12,
    venueCheckinCount: 7,
    rotationEstimate: "slow",
    tags: ["crowd_energy", "welcoming"],
  });
  assert.equal(standardNight.isBeauRocksPowered, false);
  assert.equal(standardNight.trustBadges.includes("Crowd Reviewed"), true);
  assert.equal(standardNight.trustBadges.includes("Repeat Crowd"), true);
  assert.equal(standardNight.funBadges.includes("Welcoming Crowd"), true);
  assert.equal(matchesDirectoryExperienceFilter(standardNight, "modern"), false);

  const summary = summarizeGeoExperience([
    {
      roomCode: "BR123",
      isOfficialBeauRocksRoom: true,
      hasBeauRocksHostAccount: true,
      hostRecapCount: 4,
      rotationEstimate: "fast",
      beginnerFriendly: "high",
    },
    {
      listingType: "venue",
      rotationEstimate: "slow",
    },
  ]);
  assert.deepEqual(summary, {
    beauRocksPowered: 1,
    liveJoin: 1,
    recapReady: 1,
    beginnerFriendly: 1,
    fastRotation: 1,
  });
});
