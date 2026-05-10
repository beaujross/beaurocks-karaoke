import assert from "node:assert/strict";
import { test } from "vitest";

import {
  HOST_SETTINGS_MODE_PROFILE_IDS,
  getHostSettingsModeProfile,
  modeAllowsHostSettingsSaveTarget,
} from "../../src/lib/hostSettingsModeProfiles.js";

test("hostSettingsModeProfiles normalizes aliases", () => {
  assert.equal(getHostSettingsModeProfile("karaoke").id, HOST_SETTINGS_MODE_PROFILE_IDS.standard);
  assert.equal(getHostSettingsModeProfile("run_of_show").id, HOST_SETTINGS_MODE_PROFILE_IDS.runOfShowShowcase);
  assert.equal(getHostSettingsModeProfile("self-serve").id, HOST_SETTINGS_MODE_PROFILE_IDS.selfServe);
});

test("hostSettingsModeProfiles expose required questions and save restrictions", () => {
  const selfServe = getHostSettingsModeProfile("self_serve");
  assert.deepEqual(selfServe.requiredSetupQuestions, ["auction_policy", "guest_access", "support_surge_rules"]);
  assert.equal(modeAllowsHostSettingsSaveTarget({ modeId: "self_serve", target: "host_default" }), false);
  assert.equal(modeAllowsHostSettingsSaveTarget({ modeId: "social_game_night", target: "host_default" }), true);
});
