export const HOST_SETTINGS_ASSET_LIFECYCLE_STATES = Object.freeze({
  draft: "draft",
  active: "active",
  archived: "archived",
  deprecated: "deprecated",
  deleted: "deleted",
});

export const HOST_SETTINGS_ASSET_TYPES = Object.freeze({
  sponsorKit: "sponsor_kit",
  brandingKit: "branding_kit",
  roomTemplate: "room_template",
  sceneTemplate: "scene_template",
  audioPack: "audio_pack",
  runOfShowTemplate: "run_of_show_template",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [HOST_SETTINGS_ASSET_LIFECYCLE_STATES.draft]: new Set(["active", "archived", "deleted"]),
  [HOST_SETTINGS_ASSET_LIFECYCLE_STATES.active]: new Set(["archived", "deprecated"]),
  [HOST_SETTINGS_ASSET_LIFECYCLE_STATES.archived]: new Set(["active", "deleted"]),
  [HOST_SETTINGS_ASSET_LIFECYCLE_STATES.deprecated]: new Set(["archived", "deleted"]),
  [HOST_SETTINGS_ASSET_LIFECYCLE_STATES.deleted]: new Set(),
});

const MUTATION_POLICIES = Object.freeze({
  [HOST_SETTINGS_ASSET_TYPES.sponsorKit]: {
    activationMode: "reference_then_room_override",
    sourceEditableInRoom: false,
    supportsVersioning: true,
  },
  [HOST_SETTINGS_ASSET_TYPES.brandingKit]: {
    activationMode: "reference_then_room_override",
    sourceEditableInRoom: false,
    supportsVersioning: true,
  },
  [HOST_SETTINGS_ASSET_TYPES.roomTemplate]: {
    activationMode: "clone_into_room",
    sourceEditableInRoom: false,
    supportsVersioning: true,
  },
  [HOST_SETTINGS_ASSET_TYPES.sceneTemplate]: {
    activationMode: "clone_into_room",
    sourceEditableInRoom: false,
    supportsVersioning: true,
  },
  [HOST_SETTINGS_ASSET_TYPES.audioPack]: {
    activationMode: "reference_then_room_override",
    sourceEditableInRoom: false,
    supportsVersioning: true,
  },
  [HOST_SETTINGS_ASSET_TYPES.runOfShowTemplate]: {
    activationMode: "clone_into_room",
    sourceEditableInRoom: false,
    supportsVersioning: true,
  },
});

const normalizeState = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  return Object.values(HOST_SETTINGS_ASSET_LIFECYCLE_STATES).includes(token)
    ? token
    : HOST_SETTINGS_ASSET_LIFECYCLE_STATES.draft;
};

const normalizeType = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  return Object.values(HOST_SETTINGS_ASSET_TYPES).includes(token)
    ? token
    : HOST_SETTINGS_ASSET_TYPES.sceneTemplate;
};

export const canTransitionHostSettingsAssetLifecycle = ({
  from = HOST_SETTINGS_ASSET_LIFECYCLE_STATES.draft,
  to = HOST_SETTINGS_ASSET_LIFECYCLE_STATES.active,
} = {}) => {
  const safeFrom = normalizeState(from);
  const safeTo = normalizeState(to);
  return (ALLOWED_TRANSITIONS[safeFrom] || new Set()).has(safeTo);
};

export const getHostSettingsAssetMutationPolicy = (assetType = "") => (
  MUTATION_POLICIES[normalizeType(assetType)] || MUTATION_POLICIES[HOST_SETTINGS_ASSET_TYPES.sceneTemplate]
);
