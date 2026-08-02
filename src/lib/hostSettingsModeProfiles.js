import { HOST_SETTINGS_SAVE_TARGETS } from "./hostSettingsSavePolicy.js";

export const HOST_SETTINGS_MODE_PROFILE_IDS = Object.freeze({
  standard: "standard",
  competition: "competition",
  selfServe: "self_serve",
  sponsorFestival: "sponsor_festival",
  runOfShowShowcase: "run_of_show_showcase",
  socialGameNight: "social_game_night",
});

const MODE_PROFILES = Object.freeze({
  [HOST_SETTINGS_MODE_PROFILE_IDS.standard]: {
    id: "standard",
    label: "Standard Karaoke",
    requiredSetupQuestions: ["crowd_energy", "request_policy", "room_branding"],
    allowedLiveBundles: ["crowd_mode", "operating_style"],
    hiddenDefaults: ["runOfShowPolicy", "sponsorKitActivation"],
    forbiddenSimplifications: [],
    allowedSaveTargets: ["tonight", "host_default", "workspace_template"],
  },
  [HOST_SETTINGS_MODE_PROFILE_IDS.competition]: {
    id: "competition",
    label: "Competition",
    requiredSetupQuestions: ["scoring_rules", "judge_visibility", "queue_governance"],
    allowedLiveBundles: ["crowd_mode", "operating_style"],
    hiddenDefaults: ["guest_search_relaxation"],
    forbiddenSimplifications: ["hide_scoring_controls", "collapse_judge_logic"],
    allowedSaveTargets: ["tonight", "host_default", "workspace_template"],
  },
  [HOST_SETTINGS_MODE_PROFILE_IDS.selfServe]: {
    id: "self_serve",
    label: "Self-Serve",
    requiredSetupQuestions: ["auction_policy", "guest_access", "support_surge_rules"],
    allowedLiveBundles: ["crowd_mode"],
    hiddenDefaults: ["manual_ready_check_prompts"],
    forbiddenSimplifications: ["cohost_only_recovery", "manual_only_stage_start"],
    allowedSaveTargets: ["tonight", "workspace_template"],
  },
  [HOST_SETTINGS_MODE_PROFILE_IDS.sponsorFestival]: {
    id: "sponsor_festival",
    label: "Sponsor Festival",
    requiredSetupQuestions: ["sponsor_kit", "scene_pack", "brand_palette"],
    allowedLiveBundles: ["crowd_mode", "operating_style"],
    hiddenDefaults: ["default_brand_theme"],
    forbiddenSimplifications: ["ad_hoc_sponsor_asset_edits"],
    allowedSaveTargets: ["tonight", "workspace_template"],
  },
  [HOST_SETTINGS_MODE_PROFILE_IDS.runOfShowShowcase]: {
    id: "run_of_show_showcase",
    label: "Show Plan Showcase",
    requiredSetupQuestions: ["run_of_show_template", "operator_roles", "automation_policy"],
    allowedLiveBundles: ["crowd_mode"],
    hiddenDefaults: ["queue_rotation_shortcuts"],
    forbiddenSimplifications: ["hide_automation_state", "collapse_operator_authority"],
    allowedSaveTargets: ["tonight", "workspace_template"],
  },
  [HOST_SETTINGS_MODE_PROFILE_IDS.socialGameNight]: {
    id: "social_game_night",
    label: "Social Game Night",
    requiredSetupQuestions: ["game_mix", "crowd_activity", "runtime_shell"],
    allowedLiveBundles: ["crowd_mode", "operating_style"],
    hiddenDefaults: ["formal_scoring_panels"],
    forbiddenSimplifications: ["force_classic_runtime_only"],
    allowedSaveTargets: ["tonight", "host_default", "workspace_template"],
  },
});

const normalizeModeId = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === "karaoke" || token === "standard") return HOST_SETTINGS_MODE_PROFILE_IDS.standard;
  if (token === "competition") return HOST_SETTINGS_MODE_PROFILE_IDS.competition;
  if (token === "self_serve" || token === "self-serve") return HOST_SETTINGS_MODE_PROFILE_IDS.selfServe;
  if (token === "sponsor_festival" || token === "sponsor" || token === "festival") return HOST_SETTINGS_MODE_PROFILE_IDS.sponsorFestival;
  if (token === "run_of_show" || token === "run_of_show_showcase" || token === "showcase") return HOST_SETTINGS_MODE_PROFILE_IDS.runOfShowShowcase;
  if (token === "social_game_night" || token === "social") return HOST_SETTINGS_MODE_PROFILE_IDS.socialGameNight;
  return HOST_SETTINGS_MODE_PROFILE_IDS.standard;
};

export const getHostSettingsModeProfile = (value = "") => MODE_PROFILES[normalizeModeId(value)] || MODE_PROFILES.standard;

export const modeAllowsHostSettingsSaveTarget = ({
  modeId = "",
  target = HOST_SETTINGS_SAVE_TARGETS.tonight,
} = {}) => {
  const profile = getHostSettingsModeProfile(modeId);
  return profile.allowedSaveTargets.includes(String(target || "").trim().toLowerCase());
};
