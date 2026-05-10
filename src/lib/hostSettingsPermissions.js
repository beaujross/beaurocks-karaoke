export const HOST_SETTINGS_RUNTIME_ROLES = Object.freeze({
  host: "host",
  coHost: "co_host",
  stageManager: "stage_manager",
  mediaCurator: "media_curator",
  viewer: "viewer",
});

export const HOST_SETTINGS_WORKSPACE_ROLES = Object.freeze({
  owner: "owner",
  admin: "admin",
  member: "member",
  none: "none",
});

export const HOST_SETTINGS_ACTIONS = Object.freeze({
  liveFlow: "live.flow",
  liveCrowd: "live.crowd",
  liveLook: "live.look",
  liveRecover: "live.recover",
  roomPolicyQuick: "room.policy.quick",
  runOfShowEditFlow: "run_of_show.edit_flow",
  runOfShowManageTemplates: "run_of_show.manage_templates",
  runOfShowManageRoles: "run_of_show.manage_roles",
  runOfShowPauseAutomation: "run_of_show.pause_automation",
  saveHostDefault: "save.host_default",
  saveWorkspaceTemplate: "save.workspace_template",
  workspaceManageBrandingKits: "workspace.manage_branding_kits",
  workspaceManageSponsorKits: "workspace.manage_sponsor_kits",
  workspaceManageRoomTemplates: "workspace.manage_room_templates",
  workspaceManageMembers: "workspace.manage_members",
});

const normalizeRuntimeRole = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (Object.values(HOST_SETTINGS_RUNTIME_ROLES).includes(token)) return token;
  return HOST_SETTINGS_RUNTIME_ROLES.viewer;
};

const normalizeWorkspaceRole = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === HOST_SETTINGS_WORKSPACE_ROLES.owner || token === HOST_SETTINGS_WORKSPACE_ROLES.admin || token === HOST_SETTINGS_WORKSPACE_ROLES.member) {
    return token;
  }
  return HOST_SETTINGS_WORKSPACE_ROLES.none;
};

const RUNTIME_ROLE_ACTIONS = Object.freeze({
  [HOST_SETTINGS_RUNTIME_ROLES.host]: new Set([
    HOST_SETTINGS_ACTIONS.liveFlow,
    HOST_SETTINGS_ACTIONS.liveCrowd,
    HOST_SETTINGS_ACTIONS.liveLook,
    HOST_SETTINGS_ACTIONS.liveRecover,
    HOST_SETTINGS_ACTIONS.roomPolicyQuick,
    HOST_SETTINGS_ACTIONS.runOfShowEditFlow,
    HOST_SETTINGS_ACTIONS.runOfShowManageTemplates,
    HOST_SETTINGS_ACTIONS.runOfShowManageRoles,
    HOST_SETTINGS_ACTIONS.runOfShowPauseAutomation,
    HOST_SETTINGS_ACTIONS.saveHostDefault,
  ]),
  [HOST_SETTINGS_RUNTIME_ROLES.coHost]: new Set([
    HOST_SETTINGS_ACTIONS.liveFlow,
    HOST_SETTINGS_ACTIONS.liveCrowd,
    HOST_SETTINGS_ACTIONS.liveLook,
    HOST_SETTINGS_ACTIONS.liveRecover,
    HOST_SETTINGS_ACTIONS.roomPolicyQuick,
    HOST_SETTINGS_ACTIONS.runOfShowEditFlow,
    HOST_SETTINGS_ACTIONS.runOfShowManageTemplates,
  ]),
  [HOST_SETTINGS_RUNTIME_ROLES.stageManager]: new Set([
    HOST_SETTINGS_ACTIONS.liveFlow,
    HOST_SETTINGS_ACTIONS.liveCrowd,
    HOST_SETTINGS_ACTIONS.liveLook,
    HOST_SETTINGS_ACTIONS.liveRecover,
    HOST_SETTINGS_ACTIONS.roomPolicyQuick,
    HOST_SETTINGS_ACTIONS.runOfShowEditFlow,
    HOST_SETTINGS_ACTIONS.runOfShowManageTemplates,
  ]),
  [HOST_SETTINGS_RUNTIME_ROLES.mediaCurator]: new Set([
    HOST_SETTINGS_ACTIONS.liveLook,
    HOST_SETTINGS_ACTIONS.liveRecover,
    HOST_SETTINGS_ACTIONS.runOfShowEditFlow,
    HOST_SETTINGS_ACTIONS.runOfShowManageTemplates,
  ]),
  [HOST_SETTINGS_RUNTIME_ROLES.viewer]: new Set(),
});

const WORKSPACE_ROLE_ACTIONS = Object.freeze({
  [HOST_SETTINGS_WORKSPACE_ROLES.owner]: new Set([
    HOST_SETTINGS_ACTIONS.saveWorkspaceTemplate,
    HOST_SETTINGS_ACTIONS.workspaceManageBrandingKits,
    HOST_SETTINGS_ACTIONS.workspaceManageSponsorKits,
    HOST_SETTINGS_ACTIONS.workspaceManageRoomTemplates,
    HOST_SETTINGS_ACTIONS.workspaceManageMembers,
  ]),
  [HOST_SETTINGS_WORKSPACE_ROLES.admin]: new Set([
    HOST_SETTINGS_ACTIONS.saveWorkspaceTemplate,
    HOST_SETTINGS_ACTIONS.workspaceManageBrandingKits,
    HOST_SETTINGS_ACTIONS.workspaceManageSponsorKits,
    HOST_SETTINGS_ACTIONS.workspaceManageRoomTemplates,
  ]),
  [HOST_SETTINGS_WORKSPACE_ROLES.member]: new Set(),
  [HOST_SETTINGS_WORKSPACE_ROLES.none]: new Set(),
});

export const getHostSettingsPermissionSnapshot = ({
  runtimeRole = HOST_SETTINGS_RUNTIME_ROLES.viewer,
  workspaceRole = HOST_SETTINGS_WORKSPACE_ROLES.none,
} = {}) => {
  const safeRuntimeRole = normalizeRuntimeRole(runtimeRole);
  const safeWorkspaceRole = normalizeWorkspaceRole(workspaceRole);
  return {
    runtimeRole: safeRuntimeRole,
    workspaceRole: safeWorkspaceRole,
    runtimeActions: new Set(RUNTIME_ROLE_ACTIONS[safeRuntimeRole] || []),
    workspaceActions: new Set(WORKSPACE_ROLE_ACTIONS[safeWorkspaceRole] || []),
  };
};

export const canAccessHostSettingsAction = ({
  action = "",
  runtimeRole = HOST_SETTINGS_RUNTIME_ROLES.viewer,
  workspaceRole = HOST_SETTINGS_WORKSPACE_ROLES.none,
} = {}) => {
  const safeAction = String(action || "").trim().toLowerCase();
  if (!safeAction) return false;
  const snapshot = getHostSettingsPermissionSnapshot({ runtimeRole, workspaceRole });
  return snapshot.runtimeActions.has(safeAction) || snapshot.workspaceActions.has(safeAction);
};

export const getDeniedHostSettingsActionReason = ({
  action = "",
  runtimeRole = HOST_SETTINGS_RUNTIME_ROLES.viewer,
  workspaceRole = HOST_SETTINGS_WORKSPACE_ROLES.none,
} = {}) => {
  const safeAction = String(action || "").trim().toLowerCase();
  if (canAccessHostSettingsAction({ action: safeAction, runtimeRole, workspaceRole })) return "";
  if (safeAction === HOST_SETTINGS_ACTIONS.saveHostDefault) return "Only the host can save room defaults.";
  if (
    safeAction === HOST_SETTINGS_ACTIONS.saveWorkspaceTemplate
    || safeAction === HOST_SETTINGS_ACTIONS.workspaceManageBrandingKits
    || safeAction === HOST_SETTINGS_ACTIONS.workspaceManageSponsorKits
    || safeAction === HOST_SETTINGS_ACTIONS.workspaceManageRoomTemplates
  ) {
    return "Workspace admin or owner required.";
  }
  if (safeAction === HOST_SETTINGS_ACTIONS.workspaceManageMembers) return "Only the workspace owner can manage members.";
  if (safeAction === HOST_SETTINGS_ACTIONS.runOfShowPauseAutomation || safeAction === HOST_SETTINGS_ACTIONS.runOfShowManageRoles) {
    return "Only the host can change show authority controls.";
  }
  return "You do not have permission for this action.";
};
