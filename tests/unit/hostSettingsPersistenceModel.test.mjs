import assert from "node:assert/strict";
import { test } from "vitest";

import {
  HOST_SETTINGS_PERSISTENCE_BUNDLES,
  HOST_SETTINGS_PERSISTENCE_LOCATOR_KINDS,
  buildHostSettingsPersistenceWritePlan,
  getHostSettingsPersistenceLocator,
} from "../../src/lib/hostSettingsPersistenceModel.js";

test("hostSettingsPersistenceModel resolves locators by save target", () => {
  assert.deepEqual(
    getHostSettingsPersistenceLocator({
      target: "tonight",
      roomCode: "br123",
    }),
    {
      kind: "room",
      roomCode: "BR123",
      recommendedPath: "room runtime state via updateRoomAsHost",
    },
  );

  assert.deepEqual(
    getHostSettingsPersistenceLocator({
      target: "host_default",
      actorUid: "host_1",
    }),
    {
      kind: "host_defaults",
      uid: "host_1",
      recommendedPath: "users/{uid}/hostDefaults",
    },
  );
});

test("hostSettingsPersistenceModel builds implementation-facing write plans", () => {
  assert.deepEqual(
    buildHostSettingsPersistenceWritePlan({
      target: "workspace_template",
      actorUid: "host_1",
      orgId: "org_7",
      bundleKey: HOST_SETTINGS_PERSISTENCE_BUNDLES.crowdMode,
      settings: { chatShowOnTv: true },
      provenance: { sourceType: "preset", sourceId: "hype" },
      nowMs: 77,
    }),
    {
      target: "workspace_template",
      bundleKey: "crowd_mode",
      locator: {
        kind: HOST_SETTINGS_PERSISTENCE_LOCATOR_KINDS.organizationDefaults,
        orgId: "org_7",
        recommendedPath: "organizations/{orgId}/settings/defaults",
      },
      merge: true,
      record: {
        settings: { chatShowOnTv: true },
        provenance: { sourceType: "preset", sourceId: "hype" },
        actorUid: "host_1",
        updatedAtMs: 77,
      },
    },
  );
});
