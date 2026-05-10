const normalizeText = (value = "", max = 120) => String(value || "").trim().slice(0, max);

const cloneValue = (value) => {
  if (!value || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
};

export const HOST_SETTINGS_HISTORY_ACTIONS = Object.freeze({
  bundleApplied: "bundle_applied",
  saveRequested: "save_requested",
  undoApplied: "undo_applied",
  restoreApplied: "restore_applied",
});

export const buildHostSettingsHistoryId = ({
  action = HOST_SETTINGS_HISTORY_ACTIONS.bundleApplied,
  bundleId = "",
  nowMs = Date.now(),
} = {}) => {
  const safeAction = normalizeText(action, 40).toLowerCase() || HOST_SETTINGS_HISTORY_ACTIONS.bundleApplied;
  const safeBundleId = normalizeText(bundleId, 40).toLowerCase() || "settings";
  const safeNow = Math.max(0, Math.floor(Number(nowMs || 0) || 0));
  return `${safeAction}_${safeBundleId}_${safeNow}`;
};

export const buildHostSettingsHistoryEntry = ({
  action = HOST_SETTINGS_HISTORY_ACTIONS.bundleApplied,
  bundleId = "",
  label = "",
  before = {},
  after = {},
  provenance = null,
  actorUid = "",
  actorRole = "",
  nowMs = Date.now(),
} = {}) => ({
  id: buildHostSettingsHistoryId({ action, bundleId, nowMs }),
  action: normalizeText(action, 40).toLowerCase() || HOST_SETTINGS_HISTORY_ACTIONS.bundleApplied,
  bundleId: normalizeText(bundleId, 60).toLowerCase(),
  label: normalizeText(label, 160),
  before: cloneValue(before && typeof before === "object" ? before : {}),
  after: cloneValue(after && typeof after === "object" ? after : {}),
  provenance: cloneValue(provenance && typeof provenance === "object" ? provenance : null),
  actorUid: normalizeText(actorUid, 180),
  actorRole: normalizeText(actorRole, 80).toLowerCase(),
  changedAtMs: Math.max(0, Math.floor(Number(nowMs || 0) || 0)),
});

export const hasMeaningfulHostSettingsDelta = (entry = {}) => {
  const before = entry?.before && typeof entry.before === "object" ? entry.before : {};
  const after = entry?.after && typeof entry.after === "object" ? entry.after : {};
  return JSON.stringify(before) !== JSON.stringify(after);
};

export const appendHostSettingsHistoryEntry = (history = [], entry = null, limit = 25) => {
  const safeHistory = Array.isArray(history) ? history.map((item) => cloneValue(item)) : [];
  if (!entry || typeof entry !== "object") return safeHistory;
  const next = [...safeHistory, cloneValue(entry)];
  const safeLimit = Math.max(1, Math.floor(Number(limit || 25) || 25));
  return next.slice(-safeLimit);
};

export const buildHostSettingsUndoOperation = (entry = {}) => {
  const label = normalizeText(entry?.label || "settings change", 160) || "settings change";
  return {
    action: HOST_SETTINGS_HISTORY_ACTIONS.undoApplied,
    bundleId: normalizeText(entry?.bundleId || "", 60).toLowerCase(),
    undoPatch: cloneValue(entry?.before && typeof entry.before === "object" ? entry.before : {}),
    summary: `Undo ${label}`,
  };
};

export const buildHostSettingsRestoreOperation = ({
  sourceLabel = "",
  restorePatch = {},
} = {}) => ({
  action: HOST_SETTINGS_HISTORY_ACTIONS.restoreApplied,
  bundleId: "",
  undoPatch: cloneValue(restorePatch && typeof restorePatch === "object" ? restorePatch : {}),
  summary: `Restore from ${normalizeText(sourceLabel || "saved source", 120) || "saved source"}`,
});
