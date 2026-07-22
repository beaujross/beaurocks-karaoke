const assert = require("node:assert/strict");
const { buildAdditionalUsagePackReadiness } = require("../../functions/lib/additionalUsagePackReadiness");

const readyObservationReport = {
  percentileEvidenceReady: true,
  readinessBlockers: [],
  roomDayCount: 30,
  roomCount: 12,
  bySurface: { host: 30, audience: 10, public_tv: 10 },
  guestBandCoverage: { home_party: 10, private_event: 10, large_event: 10 },
};

const approvedInputs = {
  schemaVersion: 1,
  status: "owner_approved_checkout_disabled",
  publicPricing: false,
  reconciliation: {
    approvedToleranceBps: 1000,
    requiredSources: ["google_cloud_billing_export", "provider_invoices"],
    rows: [
      { sourceId: "google_cloud_billing_export", periodStart: "2026-07-01", periodEnd: "2026-07-31", actualCostCents: 1000, attributedCostCents: 950, verified: true, evidenceRef: "billing-export-july" },
      { sourceId: "provider_invoices", periodStart: "2026-07-01", periodEnd: "2026-07-31", actualCostCents: 200, attributedCostCents: 210, verified: true, evidenceRef: "provider-invoices-july" },
    ],
  },
  economics: { approvalStatus: "approved", grossMarginFloorBps: 7000, maxSubsidizedRoomCostCents: 300, decisionRef: "decision-economics-1" },
  firstPack: {
    approvalStatus: "approved",
    packId: "extra_home_party",
    publicLabel: "Extra home karaoke night",
    guestBandId: "home_party",
    durationHours: 3,
    amountCents: 1200,
    costBasisCents: 300,
    costBasisRef: "reconciled-home-party-p99-1",
    currency: "usd",
    capacityByMeter: { ai_generate_content: 38, youtube_data_request: 180, apple_music_request: 120 },
    expiration: { mode: "utc_period_end" },
    decisionRef: "decision-pack-1",
  },
  autoRefill: { launchDecision: "disabled_for_launch", decisionRef: "decision-refill-1" },
  cohort: { approved: true, maxWorkspaces: 10, decisionRef: "decision-cohort-1" },
  activation: { approved: true, decisionRef: "decision-activation-1" },
};

test("blank decision inputs keep checkout blocked and do not publish pricing", () => {
  const packet = buildAdditionalUsagePackReadiness({
    observationReport: { percentileEvidenceReady: false, readinessBlockers: ["Need 29 more Room-days."] },
    decisionInputs: {},
  });
  assert.equal(packet.status, "blocked_checkout_disabled");
  assert.equal(packet.publicPricing, false);
  assert.equal(packet.readyForPricingDecision, false);
  assert.equal(packet.readyForControlledActivation, false);
  assert.equal(packet.checkoutMustRemainDisabled, true);
  assert.ok(packet.blockers.some((blocker) => blocker.includes("Need 29 more Room-days")));
  assert.ok(packet.blockers.some((blocker) => blocker.includes("maximum BeauRocks-funded Room exposure")));
  assert.ok(packet.gates.find((gate) => gate.id === "prelaunch_safety").passed);
  assert.equal(packet.gates.find((gate) => gate.id === "decision_record").passed, false);
});

test("representative evidence and reconciled billing can unlock pricing review without activation", () => {
  const packet = buildAdditionalUsagePackReadiness({
    observationReport: readyObservationReport,
    decisionInputs: {
      schemaVersion: 1,
      status: "evidence_collection_checkout_disabled",
      publicPricing: false,
      reconciliation: approvedInputs.reconciliation,
    },
  });
  assert.equal(packet.readyForPricingDecision, true);
  assert.equal(packet.readyForControlledActivation, false);
  assert.equal(packet.checkoutMustRemainDisabled, true);
});

test("every explicit approval can make the packet ready while leaving runtime mutation separate", () => {
  const packet = buildAdditionalUsagePackReadiness({
    observationReport: readyObservationReport,
    decisionInputs: approvedInputs,
  });
  assert.equal(packet.status, "ready_for_controlled_activation");
  assert.equal(packet.readyForControlledActivation, true);
  assert.equal(packet.checkoutMustRemainDisabled, false);
  assert.ok(packet.gates.every((gate) => gate.passed));
  assert.match(packet.recommendedNextAction, /separately reviewed activation change/);
});

test("reconciliation variance and malformed evidence fail closed", () => {
  const packet = buildAdditionalUsagePackReadiness({
    observationReport: readyObservationReport,
    decisionInputs: {
      ...approvedInputs,
      reconciliation: {
        approvedToleranceBps: 500,
        requiredSources: ["google_cloud_billing_export"],
        rows: [{ sourceId: "google_cloud_billing_export", periodStart: "bad", periodEnd: "2026-07-31", actualCostCents: 1000, attributedCostCents: 1500, verified: false, evidenceRef: "" }],
      },
    },
  });
  const gate = packet.gates.find((candidate) => candidate.id === "billing_reconciliation");
  assert.equal(gate.passed, false);
  assert.equal(gate.details.bySource.google_cloud_billing_export.varianceBps, 5000);
  assert.ok(gate.blockers.some((blocker) => blocker.includes("exceeds")));
  assert.equal(packet.readyForControlledActivation, false);
});

test("auto-refill requires either an explicit disabled launch or a complete capped policy", () => {
  const incomplete = buildAdditionalUsagePackReadiness({
    observationReport: readyObservationReport,
    decisionInputs: { ...approvedInputs, autoRefill: { launchDecision: "approved_capped" } },
  });
  assert.equal(incomplete.gates.find((gate) => gate.id === "auto_refill_posture").passed, false);

  const capped = buildAdditionalUsagePackReadiness({
    observationReport: readyObservationReport,
    decisionInputs: {
      ...approvedInputs,
      autoRefill: {
        launchDecision: "approved_capped",
        refillPackId: "extra_home_party",
        monthlyMaximumCents: 3600,
        warningThresholdBps: 8000,
        immediateDisableControl: true,
        decisionRef: "decision-refill-2",
      },
    },
  });
  assert.equal(capped.gates.find((gate) => gate.id === "auto_refill_posture").passed, true);
});

test("a pack cannot underfund the modeled Room or miss the approved margin floor", () => {
  const packet = buildAdditionalUsagePackReadiness({
    observationReport: readyObservationReport,
    decisionInputs: {
      ...approvedInputs,
      firstPack: {
        ...approvedInputs.firstPack,
        amountCents: 1000,
        costBasisCents: 400,
        capacityByMeter: { ai_generate_content: 10, youtube_data_request: 100, apple_music_request: 60 },
      },
    },
  });
  const gate = packet.gates.find((candidate) => candidate.id === "first_pack");
  assert.equal(gate.passed, false);
  assert.equal(gate.details.grossMarginBps, 6000);
  assert.deepEqual(gate.details.requiredCapacityByMeter, {
    ai_generate_content: 38,
    youtube_data_request: 180,
    apple_music_request: 120,
  });
  assert.ok(gate.blockers.some((blocker) => blocker.includes("below the approved")));
  assert.ok(gate.blockers.some((blocker) => blocker.includes("modeled high-use requirement")));
});

test("a decision record cannot mark pricing public before activation", () => {
  const packet = buildAdditionalUsagePackReadiness({
    observationReport: readyObservationReport,
    decisionInputs: { ...approvedInputs, publicPricing: true },
  });
  assert.equal(packet.gates.find((gate) => gate.id === "decision_record").passed, false);
  assert.equal(packet.readyForPricingDecision, false);
  assert.equal(packet.readyForControlledActivation, false);
  assert.equal(packet.publicPricing, false);
});
