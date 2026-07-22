"use strict";

const contract = require("./roomCostEnvelopeContract.json");

const roundUsd = (value) => Math.round((Number(value) || 0) * 10000) / 10000;
const sumValues = (value) => Object.values(value).reduce((sum, item) => sum + Number(item || 0), 0);

const calculateExpectedComponents = ({ scenario, pricingInputs }) => ({
  firestoreReads: Number(scenario.firestore_reads_est || 0) * Number(pricingInputs.firestore_read_per_100k_usd || 0) / 100000,
  firestoreWrites: Number(scenario.firestore_writes_est || 0) * Number(pricingInputs.firestore_write_per_100k_usd || 0) / 100000,
  firestoreDeletes: Number(scenario.delete_docs || 0) * Number(pricingInputs.firestore_delete_per_100k_usd || 0) / 100000,
  functionInvocations: Number(scenario.function_invocations || 0) * Number(pricingInputs.functions_invocation_per_1m_usd || 0) / 1000000,
  hostingEgress: Number(scenario.hosting_egress_gb || 0) * Number(pricingInputs.hosting_egress_per_gb_usd || 0),
  storageAtRest: Number(scenario.storage_new_gb || 0) * Number(pricingInputs.storage_per_gb_month_usd || 0),
  storageEgress: Number(scenario.storage_egress_gb || 0) * Number(pricingInputs.storage_egress_per_gb_usd || 0),
  aiProviderSensitivity: Number(scenario.ai_requests || 0) * Number(pricingInputs.gemini_provider_sensitivity_per_request_usd || 0),
});

const calculateReserve = ({ scenario, pricingInputs }) => (
  Number(scenario.ai_requests || 0) * Number(pricingInputs.ai_generate_content_meter_per_request_usd || 0)
  + Number(scenario.youtube_requests || 0) * Number(pricingInputs.youtube_data_meter_per_request_usd || 0)
  + Number(scenario.apple_requests || 0) * Number(pricingInputs.apple_music_meter_per_request_usd || 0)
);

const buildRoomCostEnvelope = ({ scenarioId, scenario, pricingInputs, envelopeContract = contract }) => {
  if (!scenarioId || !scenario || !pricingInputs) {
    throw new Error("scenarioId, scenario, and pricingInputs are required");
  }
  const components = calculateExpectedComponents({ scenario, pricingInputs });
  const expectedDirect = sumValues(components);
  const expectedReserveProtected = expectedDirect - components.aiProviderSensitivity
    + calculateReserve({ scenario, pricingInputs });
  const targetMargin = Math.max(0, Math.min(0.99, Number(envelopeContract.targetGrossMarginBps || 0) / 10000));
  const percentiles = Object.fromEntries(
    Object.entries(envelopeContract.percentileMultipliers || {}).map(([name, multiplier]) => {
      const directProviderCostUsd = expectedDirect * Number(multiplier || 0);
      const reserveProtectedCostUsd = expectedReserveProtected * Number(multiplier || 0);
      return [name, {
        stressMultiplier: Number(multiplier || 0),
        directProviderCostUsd: roundUsd(directProviderCostUsd),
        reserveProtectedCostUsd: roundUsd(reserveProtectedCostUsd),
        minimumCollectedRevenueUsd: targetMargin < 1
          ? roundUsd(directProviderCostUsd / (1 - targetMargin))
          : null,
      }];
    })
  );
  const topDrivers = Object.entries(components)
    .map(([meter, costUsd]) => ({ meter, costUsd: roundUsd(costUsd) }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 5);

  return {
    scenarioId,
    hours: Number(scenario.hours || 0),
    avgActiveGuests: Number(scenario.avg_active_users || 0),
    percentileMethod: envelopeContract.percentileMethod,
    targetGrossMarginBps: Number(envelopeContract.targetGrossMarginBps || 0),
    percentiles,
    topDrivers,
  };
};

const validateRoomCostEnvelopeContract = (envelopeContract = contract) => {
  const errors = [];
  const planning = envelopeContract.capacityPlanning || {};
  const planningMeterIds = Array.isArray(planning.meterIds) ? planning.meterIds : [];
  if (planning.publicPricing !== false) errors.push("Capacity planning must remain separate from public pricing");
  if (Number(planning.highUseMultiplier || 0) < 1) errors.push("Capacity planning high-use multiplier must be at least 1");
  if (Number(planning.minimumDurationHours || 0) <= 0
    || Number(planning.maximumDurationHours || 0) < Number(planning.minimumDurationHours || 0)) {
    errors.push("Capacity planning duration bounds are invalid");
  }
  for (const band of envelopeContract.guestBands || []) {
    if (!band?.id || Number(band?.maxActiveGuests || 0) <= 0 || Number(band?.defaultHours || 0) <= 0) {
      errors.push(`Guest band is incomplete: ${band?.id || "missing"}`);
    }
    for (const meterId of planningMeterIds) {
      if (Number(band?.baselineMeterDemand?.[meterId] || 0) <= 0) {
        errors.push(`${band?.id || "guest band"} is missing positive baseline demand for ${meterId}`);
      }
    }
  }
  const ids = new Set();
  for (const entry of envelopeContract.listenerInventory || []) {
    if (!entry.id || ids.has(entry.id)) errors.push(`Listener id must be present and unique: ${entry.id || "missing"}`);
    ids.add(entry.id);
    if (!entry.file || !entry.anchor) errors.push(`${entry.id || "listener"} must identify a file and source anchor`);
    if (String(entry.shape || "").includes("unbounded") && entry.disposition !== "contain") {
      errors.push(`${entry.id} is unbounded but is not marked for containment`);
    }
    if (entry.disposition === "contain" && (!entry.targetSlice || !entry.containment)) {
      errors.push(`${entry.id} containment requires a target slice and action`);
    }
    if (entry.disposition === "retain_with_justification" && !entry.justification) {
      errors.push(`${entry.id} retention requires a justification`);
    }
  }
  return errors;
};

module.exports = {
  buildRoomCostEnvelope,
  calculateExpectedComponents,
  validateRoomCostEnvelopeContract,
};
