import assert from "node:assert/strict";
import {
  countJoinableRoomListings,
  isJoinableRoomListing,
} from "../../src/apps/Marketing/pages/discoverFilters.js";

const run = () => {
  const joinableRoom = { listingType: "room_session", roomCode: "VIP123" };
  const nonJoinableRoom = { listingType: "room_session", roomCode: "" };
  const venueWithCode = { listingType: "venue", roomCode: "VIP999" };

  assert.equal(isJoinableRoomListing(joinableRoom), true);
  assert.equal(isJoinableRoomListing(nonJoinableRoom), false);
  assert.equal(isJoinableRoomListing(venueWithCode), false);
  assert.equal(isJoinableRoomListing(null), false);

  const count = countJoinableRoomListings([
    joinableRoom,
    nonJoinableRoom,
    venueWithCode,
    { listingType: "room_session", roomCode: "abc" },
  ]);
  assert.equal(count, 2);
  assert.equal(countJoinableRoomListings(null), 0);

  console.log("PASS discoverJoinableFilter");
};

run();
