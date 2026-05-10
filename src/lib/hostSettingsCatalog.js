export const HOST_SETTING_SCOPE_TYPES = Object.freeze({
  organization: "organization",
  host: "host",
  room: "room",
  runtimeOverride: "runtime_override",
});

export const HOST_SETTING_JOB_TYPES = Object.freeze({
  setUpTonight: "set_up_tonight",
  runLive: "run_live",
  saveOrShare: "save_or_share",
});

export const HOST_SETTING_SURFACES = Object.freeze({
  tonight: "Tonight",
  liveCrowd: "Live > Crowd",
  liveFlow: "Live > Flow",
  brandAndMoney: "Brand + Money",
  libraryWorkspace: "Library / Workspace",
});

const SETTINGS = Object.freeze({
  chatShowOnTv: {
    key: "chatShowOnTv",
    domain: "tvPresentation.crowdChat",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.runLive,
    ownerSurface: HOST_SETTING_SURFACES.liveCrowd,
    shortcutSurface: HOST_SETTING_SURFACES.tonight,
    saveScopes: ["tonight", "host", "organization"],
    bundleId: "crowd_mode",
    duplicateCount: 4,
  },
  chatTvMode: {
    key: "chatTvMode",
    domain: "tvPresentation.crowdChatMode",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.runLive,
    ownerSurface: HOST_SETTING_SURFACES.liveCrowd,
    shortcutSurface: HOST_SETTING_SURFACES.tonight,
    saveScopes: ["tonight", "host", "organization"],
    bundleId: "crowd_mode",
    duplicateCount: 2,
  },
  showScoring: {
    key: "showScoring",
    domain: "tvPresentation.scoring",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.runLive,
    ownerSurface: HOST_SETTING_SURFACES.liveCrowd,
    shortcutSurface: HOST_SETTING_SURFACES.tonight,
    saveScopes: ["tonight", "host", "organization"],
    bundleId: "crowd_mode",
    duplicateCount: 4,
  },
  marqueeEnabled: {
    key: "marqueeEnabled",
    domain: "tvPresentation.marquee",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.runLive,
    ownerSurface: HOST_SETTING_SURFACES.liveCrowd,
    shortcutSurface: HOST_SETTING_SURFACES.tonight,
    saveScopes: ["tonight", "host", "organization"],
    bundleId: "crowd_mode",
    duplicateCount: 3,
  },
  marqueeShowMode: {
    key: "marqueeShowMode",
    domain: "tvPresentation.marqueeMode",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.setUpTonight,
    ownerSurface: HOST_SETTING_SURFACES.tonight,
    shortcutSurface: HOST_SETTING_SURFACES.liveCrowd,
    saveScopes: ["tonight", "host", "organization"],
    bundleId: "crowd_mode",
    duplicateCount: 2,
  },
  popTriviaEnabled: {
    key: "popTriviaEnabled",
    domain: "runtimeAutomation.crowdMoments",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.runLive,
    ownerSurface: HOST_SETTING_SURFACES.liveCrowd,
    shortcutSurface: HOST_SETTING_SURFACES.tonight,
    saveScopes: ["tonight", "host", "organization"],
    bundleId: "crowd_mode",
    duplicateCount: 5,
  },
  autoPlayMedia: {
    key: "autoPlayMedia",
    domain: "runtimeAutomation.stageStart",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.runLive,
    ownerSurface: HOST_SETTING_SURFACES.liveFlow,
    shortcutSurface: HOST_SETTING_SURFACES.tonight,
    saveScopes: ["tonight", "host", "organization"],
    bundleId: "operating_style",
    duplicateCount: 3,
  },
  readyCheckDurationSec: {
    key: "readyCheckDurationSec",
    domain: "roomPolicy.readyCheck",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.runLive,
    ownerSurface: HOST_SETTING_SURFACES.liveFlow,
    shortcutSurface: HOST_SETTING_SURFACES.tonight,
    saveScopes: ["tonight"],
    bundleId: "operating_style",
    duplicateCount: 3,
  },
  queueSettings: {
    key: "queueSettings",
    domain: "roomPolicy.queue",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.setUpTonight,
    ownerSurface: HOST_SETTING_SURFACES.tonight,
    shortcutSurface: HOST_SETTING_SURFACES.liveFlow,
    saveScopes: ["tonight", "host", "organization"],
    bundleId: "operating_style",
    duplicateCount: 3,
  },
  "hostUiPrefs.runtimeModeEmphasis": {
    key: "hostUiPrefs.runtimeModeEmphasis",
    domain: "hostPreferences.runtimeShell",
    ownerScope: HOST_SETTING_SCOPE_TYPES.host,
    hostJob: HOST_SETTING_JOB_TYPES.saveOrShare,
    ownerSurface: HOST_SETTING_SURFACES.libraryWorkspace,
    shortcutSurface: "",
    saveScopes: ["host"],
    bundleId: "host_defaults",
    duplicateCount: 1,
  },
  eventCredits: {
    key: "eventCredits",
    domain: "supportEconomy.eventCredits",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.setUpTonight,
    ownerSurface: HOST_SETTING_SURFACES.brandAndMoney,
    shortcutSurface: "",
    saveScopes: ["tonight", "organization"],
    bundleId: "brand_support",
    duplicateCount: 2,
  },
  audienceFeatureAccess: {
    key: "audienceFeatureAccess",
    domain: "audienceAccess.engagementPolicy",
    ownerScope: HOST_SETTING_SCOPE_TYPES.room,
    hostJob: HOST_SETTING_JOB_TYPES.setUpTonight,
    ownerSurface: HOST_SETTING_SURFACES.tonight,
    shortcutSurface: "",
    saveScopes: ["tonight", "host", "organization"],
    bundleId: "crowd_access",
    duplicateCount: 2,
  },
});

const SETTING_ORDER = Object.freeze([
  "chatShowOnTv",
  "chatTvMode",
  "showScoring",
  "marqueeEnabled",
  "marqueeShowMode",
  "popTriviaEnabled",
  "autoPlayMedia",
  "readyCheckDurationSec",
  "queueSettings",
  "hostUiPrefs.runtimeModeEmphasis",
  "eventCredits",
  "audienceFeatureAccess",
]);

const BUNDLE_ORDER = Object.freeze([
  "crowd_mode",
  "operating_style",
  "brand_support",
  "crowd_access",
  "host_defaults",
]);

const cloneSetting = (setting = null) => (setting ? { ...setting, saveScopes: [...(setting.saveScopes || [])] } : null);

export const getHostSettingCatalog = () => SETTING_ORDER.map((key) => cloneSetting(SETTINGS[key]));

export const getHostSettingDefinition = (key = "") => cloneSetting(SETTINGS[String(key || "").trim()] || null);

export const getHostSettingsByBundle = () => {
  const grouped = {};
  BUNDLE_ORDER.forEach((bundleId) => {
    grouped[bundleId] = [];
  });
  SETTING_ORDER.forEach((key) => {
    const setting = SETTINGS[key];
    const bundleId = setting?.bundleId || "unbundled";
    if (!Array.isArray(grouped[bundleId])) grouped[bundleId] = [];
    grouped[bundleId].push(cloneSetting(setting));
  });
  return grouped;
};

export const getHostSettingsDecisionInventory = () => {
  const catalog = getHostSettingCatalog();
  return {
    requiredSetup: catalog.filter((setting) => setting.hostJob === HOST_SETTING_JOB_TYPES.setUpTonight),
    liveControls: catalog.filter((setting) => setting.hostJob === HOST_SETTING_JOB_TYPES.runLive),
    savedDefaults: catalog.filter((setting) => setting.ownerScope === HOST_SETTING_SCOPE_TYPES.host),
  };
};
