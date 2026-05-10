import {
  HOST_SETTINGS_ACTIONS,
  canAccessHostSettingsAction,
} from "./hostSettingsPermissions.js";

export const HOST_SETTINGS_SAVE_TARGETS = Object.freeze({
  tonight: "tonight",
  hostDefault: "host_default",
  workspaceTemplate: "workspace_template",
});

export const HOST_SETTINGS_SOURCE_TYPES = Object.freeze({
  preset: "preset",
  workspaceTemplate: "workspace_template",
  hostDefault: "host_default",
  roomOverride: "room_override",
  runtimeOverride: "runtime_override",
  migrationAdapter: "migration_adapter",
});

const HOST_SETTINGS_SAVE_TARGET_LABELS = Object.freeze({
  [HOST_SETTINGS_SAVE_TARGETS.tonight]: "Tonight only",
  [HOST_SETTINGS_SAVE_TARGETS.hostDefault]: "My default",
  [HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate]: "Workspace template",
});

const normalizeSaveTarget = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (Object.values(HOST_SETTINGS_SAVE_TARGETS).includes(token)) return token;
  return HOST_SETTINGS_SAVE_TARGETS.tonight;
};

const normalizeSourceType = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (Object.values(HOST_SETTINGS_SOURCE_TYPES).includes(token)) return token;
  return HOST_SETTINGS_SOURCE_TYPES.roomOverride;
};

const normalizeSourceId = (value = "") => String(value || "").trim().slice(0, 180);
const normalizeActorUid = (value = "") => String(value || "").trim().slice(0, 180);
const normalizeActorRole = (value = "") => String(value || "").trim().toLowerCase().slice(0, 80);

export const getAvailableHostSettingsSaveTargets = ({
  runtimeRole = "",
  workspaceRole = "",
} = {}) => {
  const targets = [HOST_SETTINGS_SAVE_TARGETS.tonight];
  if (canAccessHostSettingsAction({
    action: HOST_SETTINGS_ACTIONS.saveHostDefault,
    runtimeRole,
    workspaceRole,
  })) {
    targets.push(HOST_SETTINGS_SAVE_TARGETS.hostDefault);
  }
  if (canAccessHostSettingsAction({
    action: HOST_SETTINGS_ACTIONS.saveWorkspaceTemplate,
    runtimeRole,
    workspaceRole,
  })) {
    targets.push(HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate);
  }
  return targets;
};

export const getHostSettingsSaveActionForTarget = (target = "") => {
  const safeTarget = normalizeSaveTarget(target);
  if (safeTarget === HOST_SETTINGS_SAVE_TARGETS.hostDefault) return HOST_SETTINGS_ACTIONS.saveHostDefault;
  if (safeTarget === HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate) return HOST_SETTINGS_ACTIONS.saveWorkspaceTemplate;
  return "";
};

export const getHostSettingsSaveTargetLabel = (target = "") => {
  const safeTarget = normalizeSaveTarget(target);
  return HOST_SETTINGS_SAVE_TARGET_LABELS[safeTarget] || HOST_SETTINGS_SAVE_TARGET_LABELS[HOST_SETTINGS_SAVE_TARGETS.tonight];
};

export const canSaveHostSettingsTarget = ({
  target = HOST_SETTINGS_SAVE_TARGETS.tonight,
  runtimeRole = "",
  workspaceRole = "",
} = {}) => {
  const safeTarget = normalizeSaveTarget(target);
  if (safeTarget === HOST_SETTINGS_SAVE_TARGETS.tonight) return true;
  const action = getHostSettingsSaveActionForTarget(safeTarget);
  return canAccessHostSettingsAction({ action, runtimeRole, workspaceRole });
};

export const buildHostSettingsProvenanceStamp = ({
  sourceType = HOST_SETTINGS_SOURCE_TYPES.roomOverride,
  sourceId = "",
  savedTo = HOST_SETTINGS_SAVE_TARGETS.tonight,
  actorUid = "",
  actorRole = "",
  nowMs = Date.now(),
} = {}) => ({
  sourceType: normalizeSourceType(sourceType),
  sourceId: normalizeSourceId(sourceId),
  savedTo: normalizeSaveTarget(savedTo),
  actorUid: normalizeActorUid(actorUid),
  actorRole: normalizeActorRole(actorRole),
  lastChangedAtMs: Math.max(0, Math.floor(Number(nowMs || 0) || 0)),
});

export const buildHostSettingsSaveRequest = ({
  target = HOST_SETTINGS_SAVE_TARGETS.tonight,
  sourceType = HOST_SETTINGS_SOURCE_TYPES.roomOverride,
  sourceId = "",
  actorUid = "",
  actorRole = "",
  runtimeRole = "",
  workspaceRole = "",
  nowMs = Date.now(),
  settings = {},
} = {}) => {
  const safeTarget = normalizeSaveTarget(target);
  return {
    target: safeTarget,
    allowed: canSaveHostSettingsTarget({ target: safeTarget, runtimeRole, workspaceRole }),
    settings: settings && typeof settings === "object" ? { ...settings } : {},
    provenance: buildHostSettingsProvenanceStamp({
      sourceType,
      sourceId,
      savedTo: safeTarget,
      actorUid,
      actorRole,
      nowMs,
    }),
  };
};
