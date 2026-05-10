export const HOST_SETTINGS_TELEMETRY_EVENTS = Object.freeze({
  bundleApplied: "host_settings_bundle_applied",
  undoApplied: "host_settings_undo_applied",
  restoreApplied: "host_settings_restore_applied",
  saveRequested: "host_settings_save_requested",
  saveDenied: "host_settings_save_denied",
});

const normalizeText = (value = "", max = 120) => String(value || "").trim().slice(0, max);

const normalizeObject = (value = {}) => (value && typeof value === "object" ? value : {});

const flattenValue = (value = {}, prefix = "") => {
  const source = normalizeObject(value);
  return Object.entries(source).reduce((acc, [key, nextValue]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (nextValue && typeof nextValue === "object" && !Array.isArray(nextValue)) {
      return {
        ...acc,
        ...flattenValue(nextValue, path),
      };
    }
    acc[path] = nextValue;
    return acc;
  }, {});
};

export const countHostSettingsChangedKeys = (before = {}, after = {}) => {
  const left = flattenValue(before);
  const right = flattenValue(after);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let total = 0;
  keys.forEach((key) => {
    if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) total += 1;
  });
  return total;
};

export const buildHostSettingsTelemetryPayload = ({
  eventName = HOST_SETTINGS_TELEMETRY_EVENTS.bundleApplied,
  bundleId = "",
  presetId = "",
  saveTarget = "",
  surface = "",
  runtimeRole = "",
  workspaceRole = "",
  roomCode = "",
  roomMode = "",
  sourceType = "",
  sourceId = "",
  deniedReason = "",
  before = {},
  after = {},
  nowMs = Date.now(),
} = {}) => ({
  eventName: normalizeText(eventName, 80).toLowerCase(),
  bundleId: normalizeText(bundleId, 60).toLowerCase(),
  presetId: normalizeText(presetId, 60).toLowerCase(),
  saveTarget: normalizeText(saveTarget, 60).toLowerCase(),
  surface: normalizeText(surface, 80).toLowerCase(),
  runtimeRole: normalizeText(runtimeRole, 40).toLowerCase(),
  workspaceRole: normalizeText(workspaceRole, 40).toLowerCase(),
  roomCode: normalizeText(roomCode, 24).toUpperCase(),
  roomMode: normalizeText(roomMode, 40).toLowerCase(),
  sourceType: normalizeText(sourceType, 60).toLowerCase(),
  sourceId: normalizeText(sourceId, 120),
  deniedReason: normalizeText(deniedReason, 200),
  changedKeyCount: countHostSettingsChangedKeys(before, after),
  changedKeys: Object.keys(flattenValue(after)).filter((key) => {
    const left = flattenValue(before)[key];
    const right = flattenValue(after)[key];
    return JSON.stringify(left) !== JSON.stringify(right);
  }).slice(0, 12),
  changedAtMs: Math.max(0, Math.floor(Number(nowMs || 0) || 0)),
});
