const assert = require("node:assert/strict");
const {
  BASE_CAPABILITIES,
  buildCapabilitiesForPlan,
  canCreateRoomForSubscription,
  isPublicHostPlan,
  resolveUsageMeterQuota,
  buildUsageMeterSummary,
  USAGE_CONTROL_POLICY,
} = require("../../functions/lib/entitlementsUsage");

test("entitlementsUsage.test", () => {
  const inactiveFree = buildCapabilitiesForPlan("free", "inactive");
  assert.deepEqual(inactiveFree, BASE_CAPABILITIES);

  const activeHost = buildCapabilitiesForPlan("host_monthly", "active");
  assert.equal(activeHost["ai.generate_content"], true);
  assert.equal(activeHost["rooms.create"], true);
  assert.equal(activeHost["api.youtube_data"], true);
  assert.equal(activeHost["api.apple_music"], true);
  assert.equal(activeHost["billing.invoice_drafts"], true);
  assert.equal(activeHost["workspace.onboarding"], true);

  assert.equal(buildCapabilitiesForPlan("host_monthly", "trialing")["rooms.create"], false);
  assert.equal(buildCapabilitiesForPlan("host_monthly", "past_due")["rooms.create"], false);
  assert.equal(buildCapabilitiesForPlan("host_monthly", "canceled")["rooms.create"], false);
  assert.equal(buildCapabilitiesForPlan("host_monthly", "inactive")["rooms.create"], false);
  assert.equal(
    buildCapabilitiesForPlan("host_monthly", "active", { cancelAtPeriodEnd: true })["rooms.create"],
    true,
  );
  assert.equal(canCreateRoomForSubscription({ planId: "host_annual", status: "active" }), true);
  assert.equal(canCreateRoomForSubscription({ planId: "host_annual", status: "trialing" }), false);
  assert.equal(canCreateRoomForSubscription({ planId: "host_annual", status: "past_due" }), false);
  assert.equal(isPublicHostPlan("host_monthly"), true);
  assert.equal(isPublicHostPlan("host_annual"), true);
  assert.equal(isPublicHostPlan("vip_monthly"), false);

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
    reserved: 600,
    released: 10,
    billable: 50,
    invoiced: 20,
    quota: aiQuota,
    periodKey: "202602",
    sources: {
      host_queue_media_search: { used: 32, source: "host_queue_media_search", label: "Host Queue Media Search" },
      host_run_of_show: { used: 18, source: "host_run_of_show", label: "Host Run Of Show" },
    },
    actors: {
      host_123456: { used: 41, uid: "host_123456", label: "host_123456" },
    },
    rooms: {
      ABC123: { used: 50, roomCode: "ABC123", label: "ABC123" },
    },
    surfaces: {
      host: { used: 44, surface: "host", label: "Host" },
      workspace: { used: 6, surface: "workspace", label: "Workspace" },
    },
  });
  assert.equal(meterSummary.used, 800);
  assert.equal(meterSummary.exposureUnits, 1400);
  assert.deepEqual(meterSummary.lifecycle, {
    reserved: 600,
    settled: 800,
    released: 10,
    billable: 50,
    invoiced: 20,
  });
  assert.equal(meterSummary.warningLevelBps, 5000);
  assert.equal(meterSummary.remainingToHardLimit, 1100);
  assert.equal(meterSummary.overageUnits, 50);
  assert.equal(meterSummary.estimatedOverageCents, 150);
  assert.equal(meterSummary.hardLimitReached, false);
  assert.equal(meterSummary.breakdowns.topSources[0].key, "host_queue_media_search");
  assert.equal(meterSummary.breakdowns.topActors[0].key, "host_123456");
  assert.equal(meterSummary.breakdowns.topRooms[0].key, "ABC123");
  assert.equal(meterSummary.breakdowns.topSurfaces[0].key, "host");

  const hardLimitSummary = buildUsageMeterSummary({
    meterId: "ai_generate_content",
    used: 2500,
    quota: aiQuota,
    periodKey: "202602",
  });
  assert.equal(hardLimitSummary.hardLimitReached, true);
  assert.equal(hardLimitSummary.remainingToHardLimit, 0);
  assert.deepEqual(USAGE_CONTROL_POLICY.lifecycleStates, [
    "reserved",
    "settled",
    "released",
    "billable",
    "invoiced",
  ]);
  assert.deepEqual(USAGE_CONTROL_POLICY.warningThresholdBps, [5000, 8000, 10000]);
  assert.equal(USAGE_CONTROL_POLICY.cloudBudgetAlertsAreEnforcement, false);
});
