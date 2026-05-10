import assert from "node:assert/strict";
import { test } from "vitest";

import {
  HOST_SETTINGS_ACTIONS,
  HOST_SETTINGS_RUNTIME_ROLES,
  HOST_SETTINGS_WORKSPACE_ROLES,
  canAccessHostSettingsAction,
  getDeniedHostSettingsActionReason,
  getHostSettingsPermissionSnapshot,
} from "../../src/lib/hostSettingsPermissions.js";

test("hostSettingsPermissions gives the host full live control and host-default save rights", () => {
  const snapshot = getHostSettingsPermissionSnapshot({
    runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.host,
    workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.member,
  });

  assert.equal(snapshot.runtimeActions.has(HOST_SETTINGS_ACTIONS.liveCrowd), true);
  assert.equal(snapshot.runtimeActions.has(HOST_SETTINGS_ACTIONS.roomPolicyQuick), true);
  assert.equal(snapshot.runtimeActions.has(HOST_SETTINGS_ACTIONS.runOfShowPauseAutomation), true);
  assert.equal(snapshot.runtimeActions.has(HOST_SETTINGS_ACTIONS.saveHostDefault), true);
  assert.equal(snapshot.workspaceActions.has(HOST_SETTINGS_ACTIONS.saveWorkspaceTemplate), false);
});

test("hostSettingsPermissions lets helpers operate live without giving them save rights", () => {
  assert.equal(
    canAccessHostSettingsAction({
      action: HOST_SETTINGS_ACTIONS.liveCrowd,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.coHost,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.none,
    }),
    true,
  );

  assert.equal(
    canAccessHostSettingsAction({
      action: HOST_SETTINGS_ACTIONS.saveHostDefault,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.coHost,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.none,
    }),
    false,
  );

  assert.equal(
    canAccessHostSettingsAction({
      action: HOST_SETTINGS_ACTIONS.saveWorkspaceTemplate,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.coHost,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.admin,
    }),
    true,
  );
});

test("hostSettingsPermissions narrows stage and media roles appropriately", () => {
  assert.equal(
    canAccessHostSettingsAction({
      action: HOST_SETTINGS_ACTIONS.liveFlow,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.stageManager,
    }),
    true,
  );

  assert.equal(
    canAccessHostSettingsAction({
      action: HOST_SETTINGS_ACTIONS.liveCrowd,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.mediaCurator,
    }),
    false,
  );

  assert.equal(
    canAccessHostSettingsAction({
      action: HOST_SETTINGS_ACTIONS.liveLook,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.mediaCurator,
    }),
    true,
  );
});

test("hostSettingsPermissions enforces workspace authority separately from runtime authority", () => {
  assert.equal(
    canAccessHostSettingsAction({
      action: HOST_SETTINGS_ACTIONS.workspaceManageMembers,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.host,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.owner,
    }),
    true,
  );

  assert.equal(
    canAccessHostSettingsAction({
      action: HOST_SETTINGS_ACTIONS.workspaceManageMembers,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.host,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.admin,
    }),
    false,
  );

  assert.equal(
    canAccessHostSettingsAction({
      action: HOST_SETTINGS_ACTIONS.saveWorkspaceTemplate,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.viewer,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.admin,
    }),
    true,
  );
});

test("hostSettingsPermissions returns clear denial reasons for sensitive actions", () => {
  assert.equal(
    getDeniedHostSettingsActionReason({
      action: HOST_SETTINGS_ACTIONS.saveHostDefault,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.coHost,
    }),
    "Only the host can save room defaults.",
  );

  assert.equal(
    getDeniedHostSettingsActionReason({
      action: HOST_SETTINGS_ACTIONS.saveWorkspaceTemplate,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.host,
      workspaceRole: HOST_SETTINGS_WORKSPACE_ROLES.member,
    }),
    "Workspace admin or owner required.",
  );

  assert.equal(
    getDeniedHostSettingsActionReason({
      action: HOST_SETTINGS_ACTIONS.runOfShowPauseAutomation,
      runtimeRole: HOST_SETTINGS_RUNTIME_ROLES.stageManager,
    }),
    "Only the host can change show authority controls.",
  );
});
