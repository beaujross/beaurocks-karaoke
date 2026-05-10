import assert from "node:assert/strict";
import { test } from "vitest";

import {
  HOST_SETTINGS_SAVE_TARGETS,
  HOST_SETTINGS_SOURCE_TYPES,
  buildHostSettingsProvenanceStamp,
  buildHostSettingsSaveRequest,
  canSaveHostSettingsTarget,
  getAvailableHostSettingsSaveTargets,
  getHostSettingsSaveActionForTarget,
  getHostSettingsSaveTargetLabel,
} from "../../src/lib/hostSettingsSavePolicy.js";
import {
  HOST_SETTINGS_ACTIONS,
  HOST_SETTINGS_RUNTIME_ROLES,
  HOST_SETTINGS_WORKSPACE_ROLES,
} from "../../src/lib/hostSettingsPermissions.js";

test("hostSettingsSavePolicy exposes save targets from permissions", () => {
  assert.deepEqual(
    getAvailableHostSettingsSaveTargets({
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.host,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.member,
    }),
    ["tonight", "host_default"],
  );

  assert.deepEqual(
    getAvailableHostSettingsSaveTargets({
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.host,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.admin,
    }),
    ["tonight", "host_default", "workspace_template"],
  );

  assert.deepEqual(
    getAvailableHostSettingsSaveTargets({
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.coHost,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.none,
    }),
    ["tonight"],
  );
});

test("hostSettingsSavePolicy maps save targets to the correct permission actions", () => {
  assert.equal(getHostSettingsSaveActionForTarget(HOST_SETTINGS_SAVE_TARGETS.tonight), "");
  assert.equal(getHostSettingsSaveActionForTarget(HOST_SETTINGS_SAVE_TARGETS.hostDefault), HOST_SETTINGS_ACTIONS.saveHostDefault);
  assert.equal(getHostSettingsSaveActionForTarget(HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate), HOST_SETTINGS_ACTIONS.saveWorkspaceTemplate);
  assert.equal(getHostSettingsSaveTargetLabel(HOST_SETTINGS_SAVE_TARGETS.tonight), "Tonight only");
  assert.equal(getHostSettingsSaveTargetLabel(HOST_SETTINGS_SAVE_TARGETS.hostDefault), "My default");
  assert.equal(getHostSettingsSaveTargetLabel(HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate), "Workspace template");
});

test("hostSettingsSavePolicy enforces target access correctly", () => {
  assert.equal(
    canSaveHostSettingsTarget({
      target: HOST_SETTINGS_SAVE_TARGETS.hostDefault,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.host,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.none,
    }),
    true,
  );

  assert.equal(
    canSaveHostSettingsTarget({
      target: HOST_SETTINGS_SAVE_TARGETS.hostDefault,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.coHost,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.owner,
    }),
    false,
  );

  assert.equal(
    canSaveHostSettingsTarget({
      target: HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.host,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.admin,
    }),
    true,
  );
});

test("hostSettingsSavePolicy builds normalized provenance stamps", () => {
  assert.deepEqual(
    buildHostSettingsProvenanceStamp({
      sourceType: HOST_SETTINGS_SOURCE_TYPES.preset,
      sourceId: " preset_balanced ",
      savedTo: HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate,
      actorUid: " host_123 ",
      actorRole: " HOST ",
      nowMs: 12345,
    }),
    {
      sourceType: "preset",
      sourceId: "preset_balanced",
      savedTo: "workspace_template",
      actorUid: "host_123",
      actorRole: "host",
      lastChangedAtMs: 12345,
    },
  );
});

test("hostSettingsSavePolicy builds save requests with provenance and allowed state", () => {
  assert.deepEqual(
    buildHostSettingsSaveRequest({
      target: HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate,
      sourceType: HOST_SETTINGS_SOURCE_TYPES.runtimeOverride,
      sourceId: "room_abc",
      actorUid: "host_123",
      actorRole: "host",
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.host,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.admin,
      nowMs: 99,
      settings: { chatShowOnTv: true, marqueeEnabled: true },
    }),
    {
      target: "workspace_template",
      allowed: true,
      settings: { chatShowOnTv: true, marqueeEnabled: true },
      provenance: {
        sourceType: "runtime_override",
        sourceId: "room_abc",
        savedTo: "workspace_template",
        actorUid: "host_123",
        actorRole: "host",
        lastChangedAtMs: 99,
      },
    },
  );
});
