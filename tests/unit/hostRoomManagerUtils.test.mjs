import assert from "node:assert/strict";
import {
  toMillis,
  toRoomManagerEntryFromData,
} from "../../src/apps/Marketing/pages/hostRoomManagerUtils.js";

const run = () => {
  assert.equal(toMillis(1700000000000), 1700000000000);
  assert.equal(toMillis({ seconds: 100, nanoseconds: 500000000 }), 100500);
  assert.equal(toMillis({ toMillis: () => 42 }), 42);
  assert.equal(toMillis(undefined), 0);

  const closedRoom = toRoomManagerEntryFromData({
    id: "vip123",
    data: {
      title: "Friday Night",
      status: "closed",
      createdAt: { seconds: 1000, nanoseconds: 0 },
      closedAt: { seconds: 2000, nanoseconds: 0 },
    },
  });
  assert.equal(closedRoom.code, "VIP123");
  assert.equal(closedRoom.title, "Friday Night");
  assert.equal(closedRoom.isClosed, true);
  assert.equal(closedRoom.hasRecap, false);
  assert.equal(closedRoom.updatedAtMs, 2000000);

  const recapRoom = toRoomManagerEntryFromData({
    id: "vip999",
    data: {
      archivedStatus: "archived",
      recap: {
        generatedAtMs: 321,
      },
    },
  });
  assert.equal(recapRoom.isArchived, true);
  assert.equal(recapRoom.hasRecap, true);
  assert.equal(recapRoom.recapAtMs, 321);

  console.log("PASS hostRoomManagerUtils");
};

run();
