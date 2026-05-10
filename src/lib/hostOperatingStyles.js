const normalizeQueueSettings = (queueSettings = {}) => ({
  limitMode: String(queueSettings?.limitMode || "none").trim().toLowerCase() || "none",
  limitCount: Math.max(0, Number(queueSettings?.limitCount || 0) || 0),
  rotation: String(queueSettings?.rotation || "round_robin").trim().toLowerCase() || "round_robin",
  firstTimeBoost: queueSettings?.firstTimeBoost !== false,
});

export const OPERATING_STYLE_PRESETS = Object.freeze([
  Object.freeze({
    id: "low_touch",
    label: "Low-Touch Autopilot",
    shortLabel: "Autopilot",
    description: "Keep the queue open, auto-start media, and use a short ready check.",
    settings: Object.freeze({
      autoPlayMedia: true,
      readyCheckDurationSec: 8,
      queueSettings: Object.freeze({
        limitMode: "none",
        limitCount: 0,
        rotation: "round_robin",
        firstTimeBoost: true,
      }),
    }),
  }),
  Object.freeze({
    id: "balanced",
    label: "Balanced Host Assist",
    shortLabel: "Balanced",
    description: "Add light guardrails while keeping the night moving smoothly.",
    settings: Object.freeze({
      autoPlayMedia: true,
      readyCheckDurationSec: 10,
      queueSettings: Object.freeze({
        limitMode: "per_night",
        limitCount: 2,
        rotation: "round_robin",
        firstTimeBoost: true,
      }),
    }),
  }),
  Object.freeze({
    id: "tight_control",
    label: "Tight Stage Control",
    shortLabel: "Tight",
    description: "Use stronger queue pressure and manual stage starts for close host control.",
    settings: Object.freeze({
      autoPlayMedia: false,
      readyCheckDurationSec: 12,
      queueSettings: Object.freeze({
        limitMode: "per_hour",
        limitCount: 1,
        rotation: "first_come",
        firstTimeBoost: false,
      }),
    }),
  }),
]);

export const getOperatingStylePreset = (presetId = "") => (
  OPERATING_STYLE_PRESETS.find((preset) => preset.id === String(presetId || "").trim().toLowerCase()) || null
);

export const normalizeOperatingStyleState = (value = {}) => ({
  autoPlayMedia: value?.autoPlayMedia !== false,
  readyCheckDurationSec: Math.max(3, Number(value?.readyCheckDurationSec || 10) || 10),
  queueSettings: normalizeQueueSettings(value?.queueSettings || {}),
});

export const resolveOperatingStylePresetId = (value = {}) => {
  const normalized = normalizeOperatingStyleState(value);
  const matched = OPERATING_STYLE_PRESETS.find((preset) => {
    const presetQueue = normalizeQueueSettings(preset.settings.queueSettings);
    return (
      preset.settings.autoPlayMedia === normalized.autoPlayMedia
      && preset.settings.readyCheckDurationSec === normalized.readyCheckDurationSec
      && presetQueue.limitMode === normalized.queueSettings.limitMode
      && presetQueue.limitCount === normalized.queueSettings.limitCount
      && presetQueue.rotation === normalized.queueSettings.rotation
      && presetQueue.firstTimeBoost === normalized.queueSettings.firstTimeBoost
    );
  });
  return matched?.id || "custom";
};

export const buildOperatingStylePatch = (presetId = "balanced") => {
  const preset = getOperatingStylePreset(presetId) || getOperatingStylePreset("balanced");
  return {
    autoPlayMedia: preset.settings.autoPlayMedia,
    readyCheckDurationSec: preset.settings.readyCheckDurationSec,
    queueSettings: {
      ...preset.settings.queueSettings,
    },
  };
};

const buildQueueSummary = (queueSettings = {}) => {
  const normalized = normalizeQueueSettings(queueSettings);
  const limitLabel = normalized.limitMode === "none"
    ? "open queue"
    : normalized.limitMode === "per_night"
      ? `${normalized.limitCount} per night`
      : normalized.limitMode === "per_hour"
        ? `${normalized.limitCount} per hour`
        : `${normalized.limitCount} capped`;
  const rotationLabel = normalized.rotation === "first_come" ? "first-come order" : "round-robin order";
  const boostLabel = normalized.firstTimeBoost ? "first-timer boost on" : "first-timer boost off";
  return `${limitLabel}, ${rotationLabel}, ${boostLabel}`;
};

export const getOperatingStyleSummary = (value = {}) => {
  const normalized = normalizeOperatingStyleState(value);
  const presetId = resolveOperatingStylePresetId(normalized);
  if (presetId !== "custom") {
    const preset = getOperatingStylePreset(presetId);
    return {
      presetId,
      label: preset?.label || "Balanced Host Assist",
      shortLabel: preset?.shortLabel || "Balanced",
      description: preset?.description || "",
    };
  }
  return {
    presetId: "custom",
    label: "Custom Operating Style",
    shortLabel: "Custom",
    description: `${normalized.autoPlayMedia ? "auto-play on" : "auto-play off"}, ready check ${normalized.readyCheckDurationSec}s, ${buildQueueSummary(normalized.queueSettings)}.`,
  };
};
