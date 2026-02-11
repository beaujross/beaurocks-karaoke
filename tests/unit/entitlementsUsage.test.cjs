const assert = require("node:assert/strict");
const {
  BASE_CAPABILITIES,
  buildCapabilitiesForPlan,
  resolveUsageMeterQuota,
  buildUsageMeterSummary,
} = require("../../functions/lib/entitlementsUsage");

const run = () => {
  const inactiveFree = buildCapabilitiesForPlan("free", "inactive");
  assert.deepEqual(inactiveFree, BASE_CAPABILITIES);

  const activeHost = buildCapabilitiesForPlan("host_monthly", "active");
  assert.equal(activeHost["ai.generate_content"], true);
  assert.equal(activeHost["api.youtube_data"], true);
  assert.equal(activeHost["api.apple_music"], true);
  assert.equal(activeHost["billing.invoice_drafts"], true);
  assert.equal(activeHost["workspace.onboarding"], true);

  const aiQuota = resolveUsageMeterQuota({
    meterId: "ai_generate_content",
    planId: "host_monthly",
    status: "active",
  });
  assert.equal(aiQuota.included, 750);
  assert.equal(aiQuota.hardLimit, 2500);
  assert.equal(aiQuota.passThroughUnitCostCents, 2);
  assert.equal(aiQuota.markupMultiplier, 1.5);
  assert.equal(aiQuota.billableUnitRateCents, 3);

  const inactiveAiQuota = resolveUsageMeterQuota({
    meterId: "ai_generate_content",
    planId: "host_monthly",
    status: "inactive",
  });
  assert.equal(inactiveAiQuota.included, 0);
  assert.equal(inactiveAiQuota.hardLimit, 0);
  assert.equal(inactiveAiQuota.billableUnitRateCents, 0);

  const meterSummary = buildUsageMeterSummary({
    meterId: "ai_generate_content",
    used: 800,
    quota: aiQuota,
    periodKey: "202602",
  });
  assert.equal(meterSummary.used, 800);
  assert.equal(meterSummary.overageUnits, 50);
  assert.equal(meterSummary.estimatedOverageCents, 150);
  assert.equal(meterSummary.hardLimitReached, false);

  const hardLimitSummary = buildUsageMeterSummary({
    meterId: "ai_generate_content",
    used: 2500,
    quota: aiQuota,
    periodKey: "202602",
  });
  assert.equal(hardLimitSummary.hardLimitReached, true);
  assert.equal(hardLimitSummary.remainingToHardLimit, 0);

  console.log("entitlements usage tests passed");
};

run();
