const normalizeChatTvMode = (value = "") => (
  String(value || "").trim().toLowerCase() === "fullscreen" ? "fullscreen" : "auto"
);

export const CROWD_MODE_PRESETS = Object.freeze([
  Object.freeze({
    id: "quiet",
    label: "Quiet Room",
    shortLabel: "Quiet",
    description: "Minimal overlays with no TV chat or trivia distractions.",
    settings: Object.freeze({
      chatShowOnTv: false,
      showScoring: false,
      marqueeEnabled: false,
      popTriviaEnabled: false,
      chatTvMode: "auto",
    }),
  }),
  Object.freeze({
    id: "balanced",
    label: "Balanced Crowd",
    shortLabel: "Balanced",
    description: "Keep scoring and marquee visible without pushing chat or trivia.",
    settings: Object.freeze({
      chatShowOnTv: false,
      showScoring: true,
      marqueeEnabled: true,
      popTriviaEnabled: false,
      chatTvMode: "auto",
    }),
  }),
  Object.freeze({
    id: "hype",
    label: "High Energy Crowd",
    shortLabel: "Hype",
    description: "Turn on the full crowd layer with scoring, chat, marquee, and trivia.",
    settings: Object.freeze({
      chatShowOnTv: true,
      showScoring: true,
      marqueeEnabled: true,
      popTriviaEnabled: true,
      chatTvMode: "auto",
    }),
  }),
]);

export const normalizeCrowdModeState = (value = {}) => ({
  chatShowOnTv: value?.chatShowOnTv === true,
  chatTvMode: normalizeChatTvMode(value?.chatTvMode),
  showScoring: value?.showScoring !== false,
  marqueeEnabled: value?.marqueeEnabled === true,
  popTriviaEnabled: value?.popTriviaEnabled === true,
});

export const getCrowdModePreset = (presetId = "") => (
  CROWD_MODE_PRESETS.find((preset) => preset.id === String(presetId || "").trim().toLowerCase()) || null
);

export const resolveCrowdModePresetId = (value = {}) => {
  const normalized = normalizeCrowdModeState(value);
  const matched = CROWD_MODE_PRESETS.find((preset) => (
    preset.settings.chatShowOnTv === normalized.chatShowOnTv
    && preset.settings.showScoring === normalized.showScoring
    && preset.settings.marqueeEnabled === normalized.marqueeEnabled
    && preset.settings.popTriviaEnabled === normalized.popTriviaEnabled
  ));
  return matched?.id || "custom";
};

export const buildCrowdModePatch = (presetId = "balanced", value = {}) => {
  const preset = getCrowdModePreset(presetId) || getCrowdModePreset("balanced");
  const normalized = normalizeCrowdModeState(value);
  return {
    chatShowOnTv: preset.settings.chatShowOnTv,
    chatTvMode: preset.settings.chatShowOnTv
      ? normalizeChatTvMode(normalized.chatTvMode || preset.settings.chatTvMode)
      : "auto",
    showScoring: preset.settings.showScoring,
    marqueeEnabled: preset.settings.marqueeEnabled,
    popTriviaEnabled: preset.settings.popTriviaEnabled,
  };
};

const buildCustomSummaryDescription = (normalized = {}) => {
  const enabledBits = [];
  if (normalized.showScoring) enabledBits.push("scoring");
  if (normalized.chatShowOnTv) enabledBits.push(normalized.chatTvMode === "fullscreen" ? "fullscreen chat" : "TV chat");
  if (normalized.marqueeEnabled) enabledBits.push("marquee");
  if (normalized.popTriviaEnabled) enabledBits.push("pop trivia");
  if (enabledBits.length === 0) return "All crowd overlays are quiet right now.";
  if (enabledBits.length === 1) return `${enabledBits[0]} is active.`;
  return `${enabledBits.slice(0, -1).join(", ")} and ${enabledBits[enabledBits.length - 1]} are active.`;
};

export const getCrowdModeSummary = (value = {}) => {
  const normalized = normalizeCrowdModeState(value);
  const presetId = resolveCrowdModePresetId(normalized);
  if (presetId !== "custom") {
    const preset = getCrowdModePreset(presetId);
    return {
      presetId,
      label: preset?.label || "Balanced Crowd",
      shortLabel: preset?.shortLabel || "Balanced",
      description: preset?.description || "",
    };
  }
  return {
    presetId: "custom",
    label: "Custom Crowd Mix",
    shortLabel: "Custom",
    description: buildCustomSummaryDescription(normalized),
  };
};
