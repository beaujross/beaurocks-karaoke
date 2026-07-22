const assert = require("node:assert/strict");
const {
  ROOM_CAPACITY_ESTIMATE_REASON_CODES,
  buildRoomCapacityEstimate,
  listRoomCapacityGuestBands,
} = require("../../functions/lib/roomCapacityEstimate");

const meterDefinitions = {
  ai_generate_content: { label: "AI generations", unit: "request" },
  youtube_data_request: { label: "Workspace YouTube request allowance", unit: "request" },
  apple_music_request: { label: "Apple Music API requests", unit: "request" },
};

const usageSummary = (hardLimit = 5000, exposureUnits = 100) => ({
  period: "202607",
  meters: Object.fromEntries(Object.keys(meterDefinitions).map((meterId) => [meterId, {
    hardLimit,
    exposureUnits,
  }])),
  additionalUsage: { checkoutEnabled: false },
});

test("Room capacity estimate uses the established Home party planning range without publishing a price", () => {
  const estimate = buildRoomCapacityEstimate({
    guestBandId: "home_party",
    durationHours: 3,
    usageSummary: usageSummary(),
    meterDefinitions,
  });
  assert.equal(estimate.ok, true);
  assert.equal(estimate.status, "fits_current_workspace_capacity");
  assert.equal(estimate.guestBand.label, "Home party");
  assert.equal(estimate.meters.youtube_data_request.expectedUnits, 120);
  assert.equal(estimate.meters.youtube_data_request.highUseUnits, 180);
  assert.equal(estimate.fitsCurrentCapacity, true);
  assert.equal(estimate.pricing.publicPricing, false);
  assert.equal(estimate.pricing.quoteAvailable, false);
  assert.equal(estimate.pricing.estimatedChargeCents, null);
  assert.equal(estimate.pricing.checkoutEnabled, false);
});

test("longer Private events surface meter-specific capacity attention", () => {
  const estimate = buildRoomCapacityEstimate({
    guestBandId: "private_event",
    durationHours: 8,
    usageSummary: usageSummary(1600, 600),
    meterDefinitions,
  });
  assert.equal(estimate.ok, true);
  assert.equal(estimate.meters.youtube_data_request.expectedUnits, 1200);
  assert.equal(estimate.meters.youtube_data_request.highUseUnits, 1800);
  assert.equal(estimate.meters.youtube_data_request.remainingCapacity, 1000);
  assert.equal(estimate.meters.youtube_data_request.additionalCapacityNeeded, 800);
  assert.equal(estimate.status, "capacity_attention_needed");
  assert.equal(estimate.fitsCurrentCapacity, false);
});

test("invalid planning inputs fail with stable reason codes", () => {
  assert.equal(buildRoomCapacityEstimate({
    guestBandId: "unknown",
    durationHours: 3,
  }).reasonCode, ROOM_CAPACITY_ESTIMATE_REASON_CODES.invalidGuestBand);
  assert.equal(buildRoomCapacityEstimate({
    guestBandId: "home_party",
    durationHours: 24,
  }).reasonCode, ROOM_CAPACITY_ESTIMATE_REASON_CODES.invalidDuration);
  assert.deepEqual(listRoomCapacityGuestBands().map((band) => band.id), [
    "home_party",
    "private_event",
    "large_event",
  ]);
});

test("a Workspace without finite Host capacity gets no false fit signal", () => {
  const estimate = buildRoomCapacityEstimate({
    guestBandId: "home_party",
    durationHours: 3,
    usageSummary: usageSummary(0, 0),
    meterDefinitions,
  });
  assert.equal(estimate.ok, true);
  assert.equal(estimate.status, "host_plan_required");
  assert.equal(estimate.fitsCurrentCapacity, false);
  assert.ok(Object.values(estimate.meters).every((meter) => meter.fitsHighUse === false));
});
