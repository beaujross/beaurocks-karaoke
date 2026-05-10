import { HOST_SETTINGS_SAVE_TARGETS } from "./hostSettingsSavePolicy.js";

export const HOST_SETTINGS_PERSISTENCE_LOCATOR_KINDS = Object.freeze({
  room: "room",
  hostDefaults: "host_defaults",
  organizationDefaults: "organization_defaults",
});

export const HOST_SETTINGS_PERSISTENCE_BUNDLES = Object.freeze({
  settingsCore: "settings_core",
  crowdMode: "crowd_mode",
  operatingStyle: "operating_style",
});

const normalizeText = (value = "", max = 120) => String(value || "").trim().slice(0, max);

const normalizeTarget = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (Object.values(HOST_SETTINGS_SAVE_TARGETS).includes(token)) return token;
  return HOST_SETTINGS_SAVE_TARGETS.tonight;
};

const normalizeBundleKey = (value = "") => {
  const token = normalizeText(value, 80).toLowerCase();
  return token || HOST_SETTINGS_PERSISTENCE_BUNDLES.settingsCore;
};

export const getHostSettingsPersistenceLocator = ({
  target = HOST_SETTINGS_SAVE_TARGETS.tonight,
  actorUid = "",
  orgId = "",
  roomCode = "",
} = {}) => {
  const safeTarget = normalizeTarget(target);
  if (safeTarget === HOST_SETTINGS_SAVE_TARGETS.hostDefault) {
    return {
      kind: HOST_SETTINGS_PERSISTENCE_LOCATOR_KINDS.hostDefaults,
      uid: normalizeText(actorUid, 180),
      recommendedPath: `users/{uid}/hostDefaults`,
    };
  }
  if (safeTarget === HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate) {
    return {
      kind: HOST_SETTINGS_PERSISTENCE_LOCATOR_KINDS.organizationDefaults,
      orgId: normalizeText(orgId, 180),
      recommendedPath: `organizations/{orgId}/settings/defaults`,
    };
  }
  return {
    kind: HOST_SETTINGS_PERSISTENCE_LOCATOR_KINDS.room,
    roomCode: normalizeText(roomCode, 24).toUpperCase(),
    recommendedPath: `room runtime state via updateRoomAsHost`,
  };
};

export const buildHostSettingsPersistenceWritePlan = ({
  target = HOST_SETTINGS_SAVE_TARGETS.tonight,
  actorUid = "",
  orgId = "",
  roomCode = "",
  bundleKey = HOST_SETTINGS_PERSISTENCE_BUNDLES.settingsCore,
  settings = {},
  provenance = {},
  nowMs = Date.now(),
} = {}) => {
  const locator = getHostSettingsPersistenceLocator({
    target,
    actorUid,
    orgId,
    roomCode,
  });
  return {
    target: normalizeTarget(target),
    bundleKey: normalizeBundleKey(bundleKey),
    locator,
    merge: true,
    record: {
      settings: settings && typeof settings === "object" ? { ...settings } : {},
      provenance: provenance && typeof provenance === "object" ? { ...provenance } : {},
      actorUid: normalizeText(actorUid, 180),
      updatedAtMs: Math.max(0, Math.floor(Number(nowMs || 0) || 0)),
    },
  };
};
