const assert = require("node:assert/strict");
const { buildLyricsAiAccessState } = require("../../functions/lib/lyrics/aiAccess");

test("lyricsAiAccess.test", () => {
  const secretOnly = buildLyricsAiAccessState({
    timedOnly: false,
    aiCapabilityEnabled: false,
    demoBypassEnabled: false,
    aiFallbackConfigured: true,
  });
  assert.equal(secretOnly.allowAiFallback, false);
  assert.equal(secretOnly.aiCapabilityBlocked, true);
  assert.equal(secretOnly.canCallAiProvider, false);

  const entitled = buildLyricsAiAccessState({
    timedOnly: false,
    aiCapabilityEnabled: true,
    demoBypassEnabled: false,
    aiFallbackConfigured: true,
  });
  assert.equal(entitled.allowAiFallback, true);
  assert.equal(entitled.aiCapabilityBlocked, false);
  assert.equal(entitled.canCallAiProvider, true);

  const entitledWithoutSecret = buildLyricsAiAccessState({
    timedOnly: false,
    aiCapabilityEnabled: true,
    demoBypassEnabled: false,
    aiFallbackConfigured: false,
  });
  assert.equal(entitledWithoutSecret.allowAiFallback, true);
  assert.equal(entitledWithoutSecret.aiCapabilityBlocked, false);
  assert.equal(entitledWithoutSecret.canCallAiProvider, false);

  const demoBypass = buildLyricsAiAccessState({
    timedOnly: false,
    aiCapabilityEnabled: false,
    demoBypassEnabled: true,
    aiFallbackConfigured: true,
  });
  assert.equal(demoBypass.allowAiFallback, true);
  assert.equal(demoBypass.aiCapabilityBlocked, false);
  assert.equal(demoBypass.canCallAiProvider, true);

  const timedOnly = buildLyricsAiAccessState({
    timedOnly: true,
    aiCapabilityEnabled: true,
    demoBypassEnabled: true,
    aiFallbackConfigured: true,
  });
  assert.equal(timedOnly.allowAiFallback, false);
  assert.equal(timedOnly.aiCapabilityBlocked, false);
  assert.equal(timedOnly.canCallAiProvider, false);
});
