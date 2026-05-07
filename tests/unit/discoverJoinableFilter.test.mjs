import assert from "node:assert/strict";
import { test } from "vitest";
import {
  countJoinableRoomListings,
  isJoinableRoomListing,
} from "../../src/apps/Marketing/pages/discoverFilters.js";

test("discoverJoinableFilter.test", () => {
  const joinableRoom = { listingType: "room_session", roomCode: "VIP123" };
  const nonJoinableRoom = { listingType: "room_session", roomCode: "" };
  const venueWithCode = { listingType: "venue", roomCode: "VIP999" };
  const recapRoom = {
    listingType: "room_session",
    roomCode: "AAHF",
    endsAtMs: Date.now() - 1000,
    currentTimeMs: Date.now(),
    latestRecapAtMs: Date.now() - 500,
  };

  assert.equal(isJoinableRoomListing(joinableRoom), true);
  assert.equal(isJoinableRoomListing(nonJoinableRoom), false);
  assert.equal(isJoinableRoomListing(venueWithCode), false);
  assert.equal(isJoinableRoomListing(recapRoom), false);
  assert.equal(isJoinableRoomListing(null), false);

  const count = countJoinableRoomListings([
    joinableRoom,
    nonJoinableRoom,
    venueWithCode,
    recapRoom,
    { listingType: "room_session", roomCode: "abc" },
  ]);
  assert.equal(count, 2);
  assert.equal(countJoinableRoomListings(null), 0);
});
