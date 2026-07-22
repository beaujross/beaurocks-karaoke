const assert = require("node:assert/strict");
const {
  AUDIENCE_SAMPLE_MODULUS,
  getUtcDateKey,
  normalizeRoomCostCounts,
  normalizeRoomCostSurface,
  shouldSampleRoomCostObservation,
} = require("../../functions/lib/roomCostObservation");

test("Room cost observations have deterministic bounded sampling", () => {
  assert.equal(AUDIENCE_SAMPLE_MODULUS, 16);
  assert.equal(getUtcDateKey(Date.UTC(2026, 6, 21)), "20260721");
  assert.equal(normalizeRoomCostSurface("HOST"), "host");
  assert.equal(normalizeRoomCostSurface("unknown"), "");
  assert.equal(shouldSampleRoomCostObservation({ surface: "host" }), true);
  const args = { surface: "audience", roomCode: "ROOM1", uid: "guest-1", dateKey: "20260721" };
  assert.equal(shouldSampleRoomCostObservation(args), shouldSampleRoomCostObservation(args));
});

test("Room cost observation counts cannot exceed listener envelopes", () => {
  assert.deepEqual(normalizeRoomCostCounts({
    participantsObserved: 999,
    activeSongsObserved: 999,
    performedSongsObserved: 999,
    activitiesObserved: 999,
    mediaAssetsObserved: 999,
    scenePresetsObserved: 999,
  }), {
    participantsObserved: 250,
    activeSongsObserved: 250,
    performedSongsObserved: 250,
    activitiesObserved: 80,
    mediaAssetsObserved: 100,
    scenePresetsObserved: 50,
  });
});
