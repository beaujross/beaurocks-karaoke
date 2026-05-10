import assert from "node:assert/strict";
import { test } from "vitest";

import {
  HOST_SETTINGS_ASSET_LIFECYCLE_STATES,
  HOST_SETTINGS_ASSET_TYPES,
  canTransitionHostSettingsAssetLifecycle,
  getHostSettingsAssetMutationPolicy,
} from "../../src/lib/hostSettingsAssetLifecycle.js";

test("hostSettingsAssetLifecycle enforces allowed state transitions", () => {
  assert.equal(
    canTransitionHostSettingsAssetLifecycle({
      from: HOST_SETTINGS_ASSET_LIFECYCLE_STATES.draft,
      to: HOST_SETTINGS_ASSET_LIFECYCLE_STATES.active,
    }),
    true,
  );
  assert.equal(
    canTransitionHostSettingsAssetLifecycle({
      from: HOST_SETTINGS_ASSET_LIFECYCLE_STATES.active,
      to: HOST_SETTINGS_ASSET_LIFECYCLE_STATES.deleted,
    }),
    false,
  );
});

test("hostSettingsAssetLifecycle exposes mutation policies by asset type", () => {
  assert.deepEqual(
    getHostSettingsAssetMutationPolicy(HOST_SETTINGS_ASSET_TYPES.roomTemplate),
    {
      activationMode: "clone_into_room",
      sourceEditableInRoom: false,
      supportsVersioning: true,
    },
  );
  assert.deepEqual(
    getHostSettingsAssetMutationPolicy(HOST_SETTINGS_ASSET_TYPES.sponsorKit),
    {
      activationMode: "reference_then_room_override",
      sourceEditableInRoom: false,
      supportsVersioning: true,
    },
  );
});
