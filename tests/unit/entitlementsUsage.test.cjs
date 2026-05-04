const assert = require("node:assert/strict");
const {
  BASE_CAPABILITIES,
  buildCapabilitiesForPlan,
  resolveUsageMeterQuota,
  buildUsageMeterSummary,
} = require("../../functions/lib/entitlementsUsage");

test("entitlementsUsage.test", () => {
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
});
