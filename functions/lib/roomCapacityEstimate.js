"use strict";

const contract = require("./roomCostEnvelopeContract.json");

const ROOM_CAPACITY_ESTIMATE_REASON_CODES = Object.freeze({
  invalidGuestBand: "room_capacity_invalid_guest_band",
  invalidDuration: "room_capacity_invalid_duration",
});

const toWholeNumber = (value = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(parsed)));
};

const listRoomCapacityGuestBands = (envelopeContract = contract) => (
  (Array.isArray(envelopeContract?.guestBands) ? envelopeContract.guestBands : [])
    .map((band) => ({
      id: String(band?.id || "").trim(),
      label: String(band?.label || "").trim(),
      maxActiveGuests: toWholeNumber(band?.maxActiveGuests),
      defaultHours: Number(band?.defaultHours || 0),
    }))
    .filter((band) => band.id && band.label && band.maxActiveGuests > 0 && band.defaultHours > 0)
);

const buildRoomCapacityEstimate = ({
  guestBandId = "",
  durationHours = 0,
  usageSummary = {},
  meterDefinitions = {},
  envelopeContract = contract,
} = {}) => {
  const planning = envelopeContract?.capacityPlanning || {};
  const bands = Array.isArray(envelopeContract?.guestBands) ? envelopeContract.guestBands : [];
  const safeBandId = String(guestBandId || "").trim().toLowerCase();
  const band = bands.find((candidate) => String(candidate?.id || "").trim().toLowerCase() === safeBandId);
  if (!band) {
    return { ok: false, reasonCode: ROOM_CAPACITY_ESTIMATE_REASON_CODES.invalidGuestBand };
  }
  const minimumDurationHours = Math.max(0.25, Number(planning.minimumDurationHours || 1));
  const maximumDurationHours = Math.max(minimumDurationHours, Number(planning.maximumDurationHours || 12));
  const parsedDurationHours = Number(durationHours);
  if (!Number.isFinite(parsedDurationHours)
    || parsedDurationHours < minimumDurationHours
    || parsedDurationHours > maximumDurationHours) {
    return { ok: false, reasonCode: ROOM_CAPACITY_ESTIMATE_REASON_CODES.invalidDuration };
  }
  const safeDurationHours = Math.round(parsedDurationHours * 4) / 4;
  const defaultHours = Math.max(minimumDurationHours, Number(band.defaultHours || minimumDurationHours));
  const durationScale = safeDurationHours / defaultHours;
  const highUseMultiplier = Math.max(1, Number(planning.highUseMultiplier || 1.5));
  const planningMeterIds = (Array.isArray(planning.meterIds) ? planning.meterIds : [])
    .map((meterId) => String(meterId || "").trim())
    .filter(Boolean);
  const meters = {};

  planningMeterIds.forEach((meterId) => {
    const baselineUnits = toWholeNumber(band?.baselineMeterDemand?.[meterId]);
    const expectedUnits = Math.ceil(baselineUnits * durationScale);
    const highUseUnits = Math.ceil(expectedUnits * highUseMultiplier);
    const current = usageSummary?.meters?.[meterId] || {};
    const currentExposure = toWholeNumber(current.exposureUnits ?? current.used);
    const workspaceCeiling = toWholeNumber(current.hardLimit);
    const remainingCapacity = workspaceCeiling > 0
      ? Math.max(0, workspaceCeiling - currentExposure)
      : 0;
    const fitsHighUse = workspaceCeiling > 0 && highUseUnits <= remainingCapacity;
    meters[meterId] = {
      meterId,
      label: String(meterDefinitions?.[meterId]?.label || current.label || meterId),
      unit: String(meterDefinitions?.[meterId]?.unit || current.unit || "request"),
      expectedUnits,
      highUseUnits,
      currentExposure,
      workspaceCeiling,
      remainingCapacity,
      fitsHighUse,
      additionalCapacityNeeded: Math.max(0, highUseUnits - remainingCapacity),
    };
  });

  const meterRows = Object.values(meters);
  const hasEntitledCapacity = meterRows.length > 0 && meterRows.every((meter) => meter.workspaceCeiling > 0);
  const fitsCurrentCapacity = hasEntitledCapacity && meterRows.every((meter) => meter.fitsHighUse);
  const status = !hasEntitledCapacity
    ? "host_plan_required"
    : fitsCurrentCapacity
      ? "fits_current_workspace_capacity"
      : "capacity_attention_needed";

  return {
    ok: true,
    schemaVersion: 1,
    status,
    period: String(usageSummary?.period || ""),
    modelStatus: String(planning.status || "provisional_modeled_range"),
    modelAsOfDate: String(envelopeContract?.asOfDate || ""),
    generatedAtMs: toWholeNumber(usageSummary?.generatedAtMs),
    confidence: "early_modeled_range",
    guestBand: {
      id: String(band.id || ""),
      label: String(band.label || ""),
      maxActiveGuests: toWholeNumber(band.maxActiveGuests),
      defaultHours,
    },
    availableGuestBands: listRoomCapacityGuestBands(envelopeContract),
    durationHours: safeDurationHours,
    highUseMultiplier,
    fitsCurrentCapacity,
    capacityAttentionMeters: meterRows.filter((meter) => !meter.fitsHighUse).map((meter) => meter.meterId),
    meters,
    pricing: {
      publicPricing: planning.publicPricing === true,
      quoteAvailable: false,
      estimatedChargeCents: null,
      checkoutEnabled: usageSummary?.additionalUsage?.checkoutEnabled === true,
    },
    guidance: fitsCurrentCapacity
      ? "This modeled Room fits inside the selected period's current metered Workspace request ceilings at the high-use planning range."
      : status === "host_plan_required"
        ? "An active Host plan with finite Workspace ceilings is required before this Room can be evaluated."
        : "This modeled Room may need more headroom. Reduce fresh provider use, use cached/indexed or local media, lower the Room plan, or add prepaid capacity after purchases open.",
    caveats: [
      "This is an early planning range based on provisional load scenarios, not measured percentile evidence.",
      "It is not a price quote, bill, reservation, or guarantee of provider availability.",
      "It checks enforced provider-request meters, not every database read/write or media transfer.",
      "The Workspace ceiling and live usage transaction remain authoritative.",
    ],
  };
};

module.exports = {
  ROOM_CAPACITY_ESTIMATE_REASON_CODES,
  buildRoomCapacityEstimate,
  listRoomCapacityGuestBands,
};
