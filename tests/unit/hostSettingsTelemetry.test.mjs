import assert from "node:assert/strict";
import { test } from "vitest";

import {
  HOST_SETTINGS_TELEMETRY_EVENTS,
  buildHostSettingsTelemetryPayload,
  countHostSettingsChangedKeys,
} from "../../src/lib/hostSettingsTelemetry.js";

test("hostSettingsTelemetry counts changed keys across nested settings", () => {
  assert.equal(
    countHostSettingsChangedKeys(
      {
        autoPlayMedia: false,
        queueSettings: { limitMode: "none", limitCount: 0, firstTimeBoost: false },
      },
      {
        autoPlayMedia: true,
        queueSettings: { limitMode: "per_hour", limitCount: 2, firstTimeBoost: false },
      },
    ),
    3,
  );
});

test("hostSettingsTelemetry builds normalized payloads", () => {
  assert.deepEqual(
    buildHostSettingsTelemetryPayload({
      eventName: HOST_SETTINGS_TELEMETRY_EVENTS.bundleApplied,
      bundleId: " crowd_mode ",
      presetId: " hype ",
      saveTarget: " tonight ",
      surface: " Top_Chrome ",
      runtimeRole: " HOST ",
      workspaceRole: " ADMIN ",
      roomCode: "br123",
      roomMode: "Karaoke",
      sourceType: "preset",
      sourceId: "crowd_hype",
      before: { chatShowOnTv: false, showScoring: true },
      after: { chatShowOnTv: true, showScoring: false },
      nowMs: 44,
    }),
    {
      eventName: "host_settings_bundle_applied",
      bundleId: "crowd_mode",
      presetId: "hype",
      saveTarget: "tonight",
      surface: "top_chrome",
      runtimeRole: "host",
      workspaceRole: "admin",
      roomCode: "BR123",
      roomMode: "karaoke",
      sourceType: "preset",
      sourceId: "crowd_hype",
      deniedReason: "",
      changedKeyCount: 2,
      changedKeys: ["chatShowOnTv", "showScoring"],
      changedAtMs: 44,
    },
  );
});
