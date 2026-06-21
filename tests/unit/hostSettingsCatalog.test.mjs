import assert from "node:assert/strict";
import { test } from "vitest";

import {
  HOST_SETTING_JOB_TYPES,
  HOST_SETTING_SCOPE_TYPES,
  HOST_SETTING_SURFACES,
  getHostSettingCatalog,
  getHostSettingDefinition,
  getHostSettingsByBundle,
  getHostSettingsDecisionInventory,
} from "../../src/lib/hostSettingsCatalog.js";

test("hostSettingsCatalog exposes canonical ownership for the first migration slice", () => {
  const chatSetting = getHostSettingDefinition("chatShowOnTv");
  assert.equal(chatSetting.domain, "tvPresentation.crowdChat");
  assert.equal(chatSetting.ownerScope, HOST_SETTING_SCOPE_TYPES.room);
  assert.equal(chatSetting.hostJob, HOST_SETTING_JOB_TYPES.runLive);
  assert.equal(chatSetting.ownerSurface, HOST_SETTING_SURFACES.liveCrowd);
  assert.deepEqual(chatSetting.saveScopes, ["tonight", "host", "organization"]);

  const hostPref = getHostSettingDefinition("hostUiPrefs.runtimeModeEmphasis");
  assert.equal(hostPref.ownerScope, HOST_SETTING_SCOPE_TYPES.host);
  assert.equal(hostPref.hostJob, HOST_SETTING_JOB_TYPES.saveOrShare);
  assert.deepEqual(hostPref.saveScopes, ["host"]);
});

test("hostSettingsCatalog groups crowd and operating-style fields into host-facing bundles", () => {
  const bundles = getHostSettingsByBundle();

  assert.deepEqual(
    bundles.crowd_mode.map((setting) => setting.key),
    ["chatShowOnTv", "chatTvMode", "showScoring", "hypeMeterDisplayMode", "marqueeEnabled", "marqueeShowMode", "popTriviaEnabled"],
  );

  assert.deepEqual(
    bundles.operating_style.map((setting) => setting.key),
    ["autoPlayMedia", "readyCheckDurationSec", "queueSettings"],
  );
});

test("hostSettingsCatalog decision inventory separates setup, live, and saved-default concerns", () => {
  const inventory = getHostSettingsDecisionInventory();

  assert.ok(inventory.requiredSetup.some((setting) => setting.key === "queueSettings"));
  assert.ok(inventory.requiredSetup.some((setting) => setting.key === "eventCredits"));
  assert.ok(inventory.liveControls.some((setting) => setting.key === "chatShowOnTv"));
  assert.ok(inventory.liveControls.some((setting) => setting.key === "autoPlayMedia"));
  assert.deepEqual(
    inventory.savedDefaults.map((setting) => setting.key),
    ["hostUiPrefs.runtimeModeEmphasis"],
  );
});

test("hostSettingsCatalog returns defensive copies so callers cannot mutate the contract", () => {
  const catalog = getHostSettingCatalog();
  catalog[0].saveScopes.push("unexpected");

  const fresh = getHostSettingDefinition("chatShowOnTv");
  assert.deepEqual(fresh.saveScopes, ["tonight", "host", "organization"]);
});
