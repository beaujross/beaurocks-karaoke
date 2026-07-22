"use strict";

const commercialContract = require("./hostCommercialContract.json");
const roomCostContract = require("./roomCostEnvelopeContract.json");

const DEFAULT_RECONCILIATION_SOURCES = Object.freeze([
  "google_cloud_billing_export",
  "provider_invoices",
]);

const finiteNumber = (value) => {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const wholeNumber = (value) => {
  const parsed = finiteNumber(value);
  return parsed === null ? null : Math.floor(parsed);
};

const nonEmpty = (value) => String(value || "").trim();
const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(nonEmpty(value));

const makeGate = (id, label, passed, blockers = [], details = {}) => ({
  id,
  label,
  passed: passed === true,
  blockers: [...new Set((Array.isArray(blockers) ? blockers : []).filter(Boolean))],
  details,
});

const buildReconciliationGate = (reconciliation = {}) => {
  const blockers = [];
  const toleranceBps = wholeNumber(reconciliation.approvedToleranceBps);
  if (toleranceBps === null || toleranceBps < 0 || toleranceBps > 10000) {
    blockers.push("Approve a reconciliation tolerance before evaluating billing variance.");
  }
  const requiredSources = (Array.isArray(reconciliation.requiredSources)
    ? reconciliation.requiredSources
    : DEFAULT_RECONCILIATION_SOURCES)
    .map(nonEmpty)
    .filter(Boolean);
  const rows = Array.isArray(reconciliation.rows) ? reconciliation.rows : [];
  const bySource = {};

  for (const sourceId of requiredSources) {
    const sourceRows = rows.filter((row) => nonEmpty(row?.sourceId) === sourceId);
    if (!sourceRows.length) {
      blockers.push(`Add verified reconciliation evidence for ${sourceId}.`);
      bySource[sourceId] = { rowCount: 0, verified: false, varianceBps: null };
      continue;
    }
    let actualCostCents = 0;
    let attributedCostCents = 0;
    let rowsValid = true;
    for (const row of sourceRows) {
      const actual = wholeNumber(row?.actualCostCents);
      const attributed = wholeNumber(row?.attributedCostCents);
      const valid = row?.verified === true
        && actual !== null && actual >= 0
        && attributed !== null && attributed >= 0
        && isDateKey(row?.periodStart)
        && isDateKey(row?.periodEnd)
        && nonEmpty(row?.evidenceRef);
      if (!valid) rowsValid = false;
      actualCostCents += Math.max(0, actual || 0);
      attributedCostCents += Math.max(0, attributed || 0);
    }
    const varianceBps = actualCostCents === 0
      ? attributedCostCents === 0 ? 0 : null
      : Math.round((Math.abs(attributedCostCents - actualCostCents) / actualCostCents) * 10000);
    const withinTolerance = toleranceBps !== null && varianceBps !== null && varianceBps <= toleranceBps;
    if (!rowsValid) blockers.push(`Complete and verify every ${sourceId} reconciliation row.`);
    if (varianceBps === null) blockers.push(`${sourceId} attribution cannot reconcile against zero actual cost.`);
    else if (toleranceBps !== null && !withinTolerance) blockers.push(`${sourceId} variance ${varianceBps} bps exceeds the approved ${toleranceBps} bps tolerance.`);
    bySource[sourceId] = {
      rowCount: sourceRows.length,
      verified: rowsValid,
      actualCostCents,
      attributedCostCents,
      varianceBps,
      withinTolerance,
    };
  }

  return makeGate(
    "billing_reconciliation",
    "Billing and provider reconciliation",
    blockers.length === 0 && requiredSources.length > 0,
    blockers,
    { approvedToleranceBps: toleranceBps, requiredSources, bySource },
  );
};

const buildOwnerEconomicsGate = (economics = {}) => {
  const blockers = [];
  const grossMarginFloorBps = wholeNumber(economics.grossMarginFloorBps);
  const maxSubsidizedRoomCostCents = wholeNumber(economics.maxSubsidizedRoomCostCents);
  if (nonEmpty(economics.approvalStatus) !== "approved") blockers.push("Owner economics approval is required.");
  if (grossMarginFloorBps === null || grossMarginFloorBps <= 0 || grossMarginFloorBps > 10000) blockers.push("Approve a gross-margin floor between 1 and 10,000 bps.");
  if (maxSubsidizedRoomCostCents === null || maxSubsidizedRoomCostCents < 0) blockers.push("Approve the maximum BeauRocks-funded Room exposure.");
  if (!nonEmpty(economics.decisionRef)) blockers.push("Record an owner decision reference for the economics approval.");
  return makeGate("owner_economics", "Owner economics", blockers.length === 0, blockers, {
    grossMarginFloorBps,
    maxSubsidizedRoomCostCents,
  });
};

const buildFirstPackGate = (firstPack = {}, envelopeContract = roomCostContract, economics = {}) => {
  const blockers = [];
  const supportedBandIds = new Set((envelopeContract.guestBands || []).map((band) => nonEmpty(band?.id)).filter(Boolean));
  const requiredMeterIds = (envelopeContract.capacityPlanning?.meterIds || []).map(nonEmpty).filter(Boolean);
  const amountCents = wholeNumber(firstPack.amountCents);
  const costBasisCents = wholeNumber(firstPack.costBasisCents);
  const durationHours = finiteNumber(firstPack.durationHours);
  if (nonEmpty(firstPack.approvalStatus) !== "approved") blockers.push("Approve the first Additional usage pack definition.");
  if (!nonEmpty(firstPack.packId) || !nonEmpty(firstPack.publicLabel)) blockers.push("Give the first pack an internal ID and plain public label.");
  if (!supportedBandIds.has(nonEmpty(firstPack.guestBandId))) blockers.push("Choose a supported Home party, Private event, or Large event band.");
  if (durationHours === null || durationHours <= 0 || durationHours > 12) blockers.push("Approve a pack duration from one to twelve hours.");
  if (amountCents === null || amountCents <= 0 || !/^[a-z]{3}$/.test(nonEmpty(firstPack.currency).toLowerCase())) blockers.push("Approve a positive price and three-letter currency.");
  if (costBasisCents === null || costBasisCents <= 0 || !nonEmpty(firstPack.costBasisRef)) blockers.push("Attach a positive reconciled cost basis and evidence reference to the first pack.");
  const selectedBand = (envelopeContract.guestBands || []).find((band) => nonEmpty(band?.id) === nonEmpty(firstPack.guestBandId));
  const durationScale = selectedBand && durationHours && durationHours > 0
    ? durationHours / Number(selectedBand.defaultHours || durationHours)
    : 0;
  const highUseMultiplier = Math.max(1, Number(envelopeContract.capacityPlanning?.highUseMultiplier || 1));
  const requiredCapacityByMeter = {};
  for (const meterId of requiredMeterIds) {
    const proposedCapacity = wholeNumber(firstPack.capacityByMeter?.[meterId]) || 0;
    const requiredCapacity = selectedBand && durationScale > 0
      ? Math.ceil(Number(selectedBand.baselineMeterDemand?.[meterId] || 0) * durationScale * highUseMultiplier)
      : 0;
    requiredCapacityByMeter[meterId] = requiredCapacity;
    if (proposedCapacity <= 0) blockers.push(`Approve positive ${meterId} capacity for the first Room pack.`);
    else if (requiredCapacity > 0 && proposedCapacity < requiredCapacity) blockers.push(`Increase ${meterId} capacity to at least the modeled high-use requirement of ${requiredCapacity}.`);
  }
  const grossMarginBps = amountCents !== null && amountCents > 0 && costBasisCents !== null
    ? Math.round(((amountCents - costBasisCents) / amountCents) * 10000)
    : null;
  const approvedGrossMarginFloorBps = wholeNumber(economics.grossMarginFloorBps);
  if (grossMarginBps !== null && approvedGrossMarginFloorBps !== null && grossMarginBps < approvedGrossMarginFloorBps) {
    blockers.push(`Proposed gross margin ${grossMarginBps} bps is below the approved ${approvedGrossMarginFloorBps} bps floor.`);
  }
  const expirationMode = nonEmpty(firstPack.expiration?.mode);
  if (!new Set(["utc_period_end", "fixed_days", "never"]).has(expirationMode)) blockers.push("Approve an expiration mode for unused capacity.");
  if (expirationMode === "fixed_days" && (wholeNumber(firstPack.expiration?.days) || 0) <= 0) blockers.push("Approve the fixed-day expiration length.");
  if (!nonEmpty(firstPack.decisionRef)) blockers.push("Record an owner decision reference for the first pack.");
  return makeGate("first_pack", "First Additional usage pack", blockers.length === 0, blockers, {
    packId: nonEmpty(firstPack.packId),
    publicLabel: nonEmpty(firstPack.publicLabel),
    guestBandId: nonEmpty(firstPack.guestBandId),
    durationHours,
    amountCents,
    costBasisCents,
    grossMarginBps,
    approvedGrossMarginFloorBps,
    currency: nonEmpty(firstPack.currency).toLowerCase(),
    expirationMode,
    requiredCapacityByMeter,
  });
};

const buildDecisionRecordGate = (decisionInputs = {}) => {
  const blockers = [];
  if (wholeNumber(decisionInputs.schemaVersion) !== 1) blockers.push("Use decision-record schema version 1.");
  if (decisionInputs.publicPricing !== false) blockers.push("The decision record must keep publicPricing false until the separate activation review.");
  if (!nonEmpty(decisionInputs.status)) blockers.push("Record the decision packet status.");
  return makeGate("decision_record", "Decision record integrity", blockers.length === 0, blockers, {
    schemaVersion: wholeNumber(decisionInputs.schemaVersion),
    publicPricing: decisionInputs.publicPricing === true,
    status: nonEmpty(decisionInputs.status),
  });
};

const buildAutoRefillGate = (autoRefill = {}) => {
  const blockers = [];
  const launchDecision = nonEmpty(autoRefill.launchDecision);
  if (launchDecision === "disabled_for_launch") {
    if (!nonEmpty(autoRefill.decisionRef)) blockers.push("Record the decision reference for launching with auto-refill disabled.");
  } else if (launchDecision === "approved_capped") {
    if (!nonEmpty(autoRefill.refillPackId)) blockers.push("Choose the approved refill pack.");
    const monthlyMaximumCents = wholeNumber(autoRefill.monthlyMaximumCents);
    const warningThresholdBps = wholeNumber(autoRefill.warningThresholdBps);
    if (monthlyMaximumCents === null || monthlyMaximumCents <= 0) blockers.push("Approve a positive Host-selected monthly auto-refill maximum.");
    if (warningThresholdBps === null || warningThresholdBps <= 0 || warningThresholdBps >= 10000) blockers.push("Approve an auto-refill warning threshold below 100%.");
    if (autoRefill.immediateDisableControl !== true) blockers.push("Require an immediate Host off switch for auto-refill.");
    if (!nonEmpty(autoRefill.decisionRef)) blockers.push("Record the capped auto-refill decision reference.");
  } else {
    blockers.push("Approve capped auto-refill or explicitly disable it for the initial launch.");
  }
  return makeGate("auto_refill_posture", "Auto-refill launch posture", blockers.length === 0, blockers, { launchDecision });
};

const buildApprovalGate = (id, label, approval = {}, maximumField = "maxWorkspaces") => {
  const blockers = [];
  if (approval.approved !== true) blockers.push(`${label} approval is required.`);
  if (!nonEmpty(approval.decisionRef)) blockers.push(`Record a decision reference for ${label.toLowerCase()}.`);
  if (maximumField) {
    const maximum = wholeNumber(approval[maximumField]);
    if (maximum === null || maximum <= 0) blockers.push(`Set a positive ${maximumField} for ${label.toLowerCase()}.`);
  }
  return makeGate(id, label, blockers.length === 0, blockers, maximumField ? { [maximumField]: wholeNumber(approval[maximumField]) } : {});
};

const buildPrelaunchSafetyGate = (contract = commercialContract) => {
  const policy = contract.usageControlPolicy || {};
  const enabledPacks = Object.values(policy.packs || {}).filter((pack) => pack?.enabled === true).length;
  const blockers = [];
  if (policy.checkoutEnabled === true) blockers.push("Checkout is already enabled before Gate C3 approval.");
  if (policy.autoRefillEnabled === true) blockers.push("Auto-refill is already enabled before Gate C3 approval.");
  if (enabledPacks > 0) blockers.push("An Additional usage pack is already enabled before Gate C3 approval.");
  if (nonEmpty(policy.liabilityModel) !== "prepaid_or_hard_capped_no_uncapped_postpaid") blockers.push("The no-uncapped-postpaid liability policy is missing.");
  return makeGate("prelaunch_safety", "Prelaunch commercial safety", blockers.length === 0, blockers, {
    checkoutEnabled: policy.checkoutEnabled === true,
    autoRefillEnabled: policy.autoRefillEnabled === true,
    enabledPacks,
  });
};

const buildAdditionalUsagePackReadiness = ({
  observationReport = {},
  decisionInputs = {},
  commercial = commercialContract,
  envelopeContract = roomCostContract,
} = {}) => {
  const observationBlockers = observationReport.percentileEvidenceReady === true
    ? []
    : (observationReport.readinessBlockers || ["Representative Room evidence is not ready."]);
  const observationGate = makeGate("room_evidence", "Representative Room evidence", observationBlockers.length === 0, observationBlockers, {
    roomDayCount: wholeNumber(observationReport.roomDayCount) || 0,
    roomCount: wholeNumber(observationReport.roomCount) || 0,
    bySurface: observationReport.bySurface || {},
    guestBandCoverage: observationReport.guestBandCoverage || {},
  });
  const gates = [
    buildPrelaunchSafetyGate(commercial),
    buildDecisionRecordGate(decisionInputs),
    observationGate,
    buildReconciliationGate(decisionInputs.reconciliation),
    buildOwnerEconomicsGate(decisionInputs.economics),
    buildFirstPackGate(decisionInputs.firstPack, envelopeContract, decisionInputs.economics),
    buildAutoRefillGate(decisionInputs.autoRefill),
    buildApprovalGate("controlled_cohort", "Controlled cohort", decisionInputs.cohort, "maxWorkspaces"),
    buildApprovalGate("activation_approval", "Controlled activation", decisionInputs.activation, null),
  ];
  const gateMap = Object.fromEntries(gates.map((gate) => [gate.id, gate]));
  const blockers = gates.flatMap((gate) => gate.blockers.map((blocker) => `${gate.label}: ${blocker}`));
  const readyForPricingDecision = gateMap.prelaunch_safety.passed
    && gateMap.decision_record.passed
    && gateMap.room_evidence.passed
    && gateMap.billing_reconciliation.passed;
  const readyForControlledActivation = gates.every((gate) => gate.passed);
  const firstBlockedGate = gates.find((gate) => !gate.passed);
  return {
    schemaVersion: 1,
    status: readyForControlledActivation ? "ready_for_controlled_activation" : "blocked_checkout_disabled",
    publicPricing: false,
    readyForPricingDecision,
    readyForControlledActivation,
    checkoutMustRemainDisabled: !readyForControlledActivation,
    gates,
    blockers,
    recommendedNextAction: firstBlockedGate
      ? `Resolve ${firstBlockedGate.label}: ${firstBlockedGate.blockers[0]}`
      : "All recorded gates passed; perform the separately reviewed activation change.",
  };
};

module.exports = {
  DEFAULT_RECONCILIATION_SOURCES,
  buildAdditionalUsagePackReadiness,
};
