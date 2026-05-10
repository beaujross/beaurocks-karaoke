import { HOST_SETTINGS_SAVE_TARGETS, HOST_SETTINGS_SOURCE_TYPES } from "./hostSettingsSavePolicy.js";

export const HOST_SETTINGS_AUDIT_ACTIONS = Object.freeze({
  bundleSaved: "bundle_saved",
  bundleLoaded: "bundle_loaded",
});

export const HOST_SETTINGS_AUDIT_VISIBILITY = Object.freeze({
  workspaceVisible: "workspace_visible",
  hostPrivate: "host_private",
});

const normalizeText = (value = "", max = 180) => String(value || "").trim().slice(0, max);

const normalizeTarget = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === HOST_SETTINGS_SAVE_TARGETS.hostDefault) return HOST_SETTINGS_SAVE_TARGETS.hostDefault;
  if (token === HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate) return HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate;
  return HOST_SETTINGS_SAVE_TARGETS.tonight;
};

const normalizeSourceType = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (Object.values(HOST_SETTINGS_SOURCE_TYPES).includes(token)) return token;
  return HOST_SETTINGS_SOURCE_TYPES.roomOverride;
};

const collectChangedKeys = (value = {}, prefix = "") => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return collectChangedKeys(nested, nextPrefix);
    }
    return [nextPrefix];
  });
};

export const buildHostSettingsAuditEntry = ({
  action = HOST_SETTINGS_AUDIT_ACTIONS.bundleSaved,
  target = HOST_SETTINGS_SAVE_TARGETS.hostDefault,
  bundleKey = "",
  actorUid = "",
  actorRole = "",
  workspaceRole = "",
  roomCode = "",
  sourceType = HOST_SETTINGS_SOURCE_TYPES.roomOverride,
  sourceId = "",
  settings = {},
  nowMs = Date.now(),
} = {}) => {
  const safeTarget = normalizeTarget(target);
  const changedKeys = collectChangedKeys(settings);
  return {
    action: normalizeText(action, 60).toLowerCase(),
    target: safeTarget,
    bundleKey: normalizeText(bundleKey, 80).toLowerCase(),
    actorUid: normalizeText(actorUid, 180),
    actorRole: normalizeText(actorRole, 80).toLowerCase(),
    workspaceRole: normalizeText(workspaceRole, 80).toLowerCase(),
    roomCode: normalizeText(roomCode, 24).toUpperCase(),
    sourceType: normalizeSourceType(sourceType),
    sourceId: normalizeText(sourceId, 180),
    changedKeys,
    changedKeyCount: changedKeys.length,
    visibility: safeTarget === HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate
      ? HOST_SETTINGS_AUDIT_VISIBILITY.workspaceVisible
      : HOST_SETTINGS_AUDIT_VISIBILITY.hostPrivate,
    changedAtMs: Math.max(0, Math.floor(Number(nowMs || 0) || 0)),
  };
};

export const canViewHostSettingsAuditEntry = ({
  entry = {},
  actorUid = "",
  workspaceRole = "",
} = {}) => {
  const safeActorUid = normalizeText(actorUid, 180);
  const safeWorkspaceRole = normalizeText(workspaceRole, 80).toLowerCase();
  const visibility = normalizeText(entry?.visibility || "", 40).toLowerCase();
  if (visibility === HOST_SETTINGS_AUDIT_VISIBILITY.workspaceVisible) return true;
  if (safeWorkspaceRole === "owner" || safeWorkspaceRole === "admin") return true;
  return normalizeText(entry?.actorUid || "", 180) === safeActorUid;
};
