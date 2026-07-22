const assert = require("node:assert/strict");

const {
  buildRoomCostObservationReport,
  resolveGuestBand,
} = require("../../functions/lib/roomCostObservationReport");

test("Room cost report groups observations by Room-day without overstating sampled Audience sessions", () => {
  const report = buildRoomCostObservationReport([
    {
      schemaVersion: 1,
      observationId: "host-1",
      roomCode: "party",
      surface: "host",
      dateKey: "20260721",
      counts: { participantsObserved: 22, activeSongsObserved: 8, performedSongsObserved: 4 },
    },
    {
      schemaVersion: 1,
      observationId: "audience-1",
      roomCode: "PARTY",
      surface: "audience",
      dateKey: "20260721",
      counts: { participantsObserved: 24, activeSongsObserved: 9, performedSongsObserved: 5 },
    },
    {
      schemaVersion: 1,
      observationId: "host-2",
      roomCode: "LARGE",
      surface: "host",
      dateKey: "20260722",
      counts: { participantsObserved: 120, activeSongsObserved: 30 },
    },
  ]);

  assert.equal(report.observationCount, 3);
  assert.equal(report.roomDayCount, 2);
  assert.equal(report.roomCount, 2);
  assert.deepEqual(report.bySurface, { host: 2, audience: 1, public_tv: 0 });
  assert.equal(report.estimatedAudienceSessionEquivalent, 16);
  assert.equal(report.peaks.participantsObserved, 120);
  assert.equal(report.guestBandCoverage.home_party, 1);
  assert.equal(report.guestBandCoverage.large_event, 1);
  assert.equal(report.percentileEvidenceReady, false);
});

test("Room cost report flags raw identity fields and malformed observations", () => {
  const report = buildRoomCostObservationReport([
    { schemaVersion: 1, roomCode: "ROOM", surface: "host", dateKey: "20260721", uid: "raw" },
    { schemaVersion: 9, roomCode: "ROOM", surface: "host", dateKey: "20260721" },
  ]);
  assert.equal(report.privacy.rawIdentityFieldCount, 1);
  assert.ok(report.violations.some((entry) => entry.startsWith("raw_identity_field:")));
  assert.ok(report.violations.some((entry) => entry.startsWith("invalid_observation:")));
});

test("guest bands follow the contract thresholds", () => {
  assert.equal(resolveGuestBand(25), "home_party");
  assert.equal(resolveGuestBand(26), "private_event");
  assert.equal(resolveGuestBand(180), "large_event");
  assert.equal(resolveGuestBand(181), "above_supported_band");
});
