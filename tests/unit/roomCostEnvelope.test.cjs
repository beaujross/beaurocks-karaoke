const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const contract = require("../../functions/lib/roomCostEnvelopeContract.json");
const inputs = require("../../docs/costs/nightly_cost_model_inputs.json");
const {
  buildRoomCostEnvelope,
  validateRoomCostEnvelopeContract,
} = require("../../functions/lib/roomCostEnvelope");

test("room cost contract is internally complete and source-anchored", () => {
  assert.deepEqual(validateRoomCostEnvelopeContract(contract), []);
  assert.equal(contract.publicBillingContract, false);
  assert.equal(contract.percentileMethod, "stress_multiplier_until_room_telemetry_is_available");
  assert.equal(contract.observationPolicy.audienceSampleModulus, 16);
  assert.equal(contract.observationPolicy.rawAudienceUidStored, false);
  const scenarioMeterFields = {
    ai_generate_content: "ai_requests",
    youtube_data_request: "youtube_requests",
    apple_music_request: "apple_requests",
  };
  for (const band of contract.guestBands) {
    const scenario = inputs.scenarios[band.scenarioId];
    assert.ok(scenario, `${band.id} scenario is missing`);
    for (const [meterId, scenarioField] of Object.entries(scenarioMeterFields)) {
      assert.equal(
        band.baselineMeterDemand[meterId],
        scenario[scenarioField],
        `${band.id} ${meterId} baseline drifted from ${band.scenarioId}`,
      );
    }
  }
  assert.ok(contract.listenerInventory.some((entry) => entry.id === "audience_room_users" && entry.limit === 250));
  assert.ok(contract.listenerInventory.some((entry) => entry.id === "audience_room_songs" && entry.limits?.fallback === 500));
  assert.ok(contract.listenerInventory.some((entry) => entry.id === "tv_reactions" && entry.shape === "bounded_query_with_bounded_fallback"));
  const tvSource = readFileSync("src/apps/TV/PublicTV.jsx", "utf8");
  assert.match(tvSource, /const reactionsFallbackQuery = query\([\s\S]*?where\('roomCode', '==', roomCode\),\s*limit\(250\)\s*\);/);
  assert.match(tvSource, /const unsubVibe = onSnapshot\(query\([\s\S]*?where\('roomCode', '==', roomCode\), limit\(250\)\)/);
  assert.match(readFileSync("src/apps/Host/HostApp.jsx", "utf8"), /const unsubUsers = onSnapshot\(query\([\s\S]*?where\('roomCode', '==', roomCode\), limit\(250\)\)/);
  const hostSource = readFileSync("src/apps/Host/HostApp.jsx", "utf8");
  assert.match(hostSource, /const hostMediaSubscriptionsActive = \([\s\S]*?'stage', 'browse', 'run_of_show', 'admin'/);
  assert.match(hostSource, /!hostMediaSubscriptionsActive\) return;/);
  assert.match(hostSource, /limit\(80\)/);
  assert.match(hostSource, /LEGACY_ROOM_UPLOADS_COLLECTION\), where\('roomCode', '==', roomCode\), limit\(100\)/);
  assert.match(hostSource, /HOST_MEDIA_ASSETS_COLLECTION\), where\('ownerUid', '==', activeHostUid\), limit\(100\)/);
  assert.match(hostSource, /LEGACY_ROOM_SCENE_PRESETS_COLLECTION\), where\('roomCode', '==', roomCode\), limit\(50\)/);
  assert.match(hostSource, /HOST_MEDIA_SCENE_PRESETS_COLLECTION\), where\('ownerUid', '==', activeHostUid\), limit\(50\)/);
  assert.match(hostSource, /return \(\) => \{ unsubRoom\(\);[\s\S]*?\n    \}, \[roomCode, isMarketingDemoFixture, qaHostFixtureId, uid\]\);/);
  assert.match(hostSource, /tab !== 'lobby' \|\| lobbyTab !== 'vip'/);
  assert.match(readFileSync("src/apps/Mobile/SingerApp.jsx", "utf8"), /const unsubAllUsers = onSnapshot\(query\([\s\S]*?where\('roomCode', '==', roomCode\), limit\(250\)\)/);
  assert.match(readFileSync("src/apps/Mobile/SingerApp.jsx", "utf8"), /isAudienceFixtureMode \|\| tab !== 'request'\) return;/);
  for (const listener of contract.listenerInventory) {
    assert.ok(readFileSync(listener.file, "utf8").includes(listener.anchor), `${listener.id} source anchor is missing`);
  }
});

test("room cost model preserves expected planning scale and creates stress envelopes", () => {
  const casual = buildRoomCostEnvelope({
    scenarioId: "casual",
    scenario: inputs.scenarios.casual,
    pricingInputs: inputs.pricing_inputs,
  });
  const busy = buildRoomCostEnvelope({
    scenarioId: "busy",
    scenario: inputs.scenarios.busy,
    pricingInputs: inputs.pricing_inputs,
  });
  assert.ok(casual.percentiles.expected.directProviderCostUsd >= 0.49);
  assert.ok(casual.percentiles.expected.directProviderCostUsd <= 0.52);
  assert.equal(busy.percentiles.p95.stressMultiplier, 1.5);
  assert.equal(busy.percentiles.p99.stressMultiplier, 2);
  assert.ok(busy.percentiles.p99.minimumCollectedRevenueUsd > busy.percentiles.p99.directProviderCostUsd);
  assert.equal(busy.topDrivers[0].meter, "hostingEgress");
});
