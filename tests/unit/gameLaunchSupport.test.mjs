import assert from "node:assert/strict";
import { test } from "vitest";
import {
  findRoomUserByUid,
  getResolvedRoomUserUids,
  resolveRoomUserUid,
  selectQuickLaunchBingoBoard
} from "../../src/lib/gameLaunchSupport.js";

test("gameLaunchSupport.test", () => {
  assert.equal(resolveRoomUserUid({ uid: "uid-123", id: "room_old" }), "uid-123");
  assert.equal(resolveRoomUserUid({ id: "room_uid-456" }), "uid-456");
  assert.equal(resolveRoomUserUid({}), "");

  assert.deepEqual(
    getResolvedRoomUserUids([
      { uid: "alpha" },
      { id: "room_bravo" },
      { id: "invalid" },
      null
    ]),
    ["alpha", "bravo"]
  );

  const roomUsers = [
    { uid: "host-1", name: "Host" },
    { id: "room_guest-2", name: "Guest" }
  ];
  assert.equal(findRoomUserByUid(roomUsers, "guest-2")?.name, "Guest");
  assert.equal(findRoomUserByUid(roomUsers, "missing"), null);

  const presetBoard = { id: "preset", tiles: [{ id: 1 }] };
  const customBoard = { id: "custom", tiles: [{ id: 2 }] };
  assert.equal(
    selectQuickLaunchBingoBoard({
      bingoBoards: [customBoard],
      presetBoards: [presetBoard]
    })?.id,
    "custom"
  );
  assert.equal(
    selectQuickLaunchBingoBoard({
      bingoBoards: [],
      presetBoards: [presetBoard]
    })?.id,
    "preset"
  );
  assert.equal(selectQuickLaunchBingoBoard({ bingoBoards: [], presetBoards: [] }), null);
});
