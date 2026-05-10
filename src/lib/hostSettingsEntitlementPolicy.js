import { CAPABILITY_KEYS, getMissingCapabilityLabel } from "../billing/capabilities.js";
import { HOST_SETTINGS_SAVE_TARGETS, getHostSettingsSaveTargetLabel } from "./hostSettingsSavePolicy.js";

export const HOST_SETTINGS_TARGET_CAPABILITY_REQUIREMENTS = Object.freeze({
  [HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate]: CAPABILITY_KEYS.WORKSPACE_SHARED_TEMPLATES,
});

const normalizeTarget = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === HOST_SETTINGS_SAVE_TARGETS.hostDefault) return HOST_SETTINGS_SAVE_TARGETS.hostDefault;
  if (token === HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate) return HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate;
  return HOST_SETTINGS_SAVE_TARGETS.tonight;
};

export const getHostSettingsTargetEntitlementState = ({
  target = HOST_SETTINGS_SAVE_TARGETS.tonight,
  capabilities = {},
} = {}) => {
  const safeTarget = normalizeTarget(target);
  const requiredCapability = HOST_SETTINGS_TARGET_CAPABILITY_REQUIREMENTS[safeTarget] || "";
  const capabilityEnabled = requiredCapability ? !!capabilities?.[requiredCapability] : true;

  if (safeTarget === HOST_SETTINGS_SAVE_TARGETS.workspaceTemplate) {
    return {
      target: safeTarget,
      requiredCapability,
      requiredCapabilityLabel: getMissingCapabilityLabel(requiredCapability),
      canRead: true,
      canSave: capabilityEnabled,
      downgradeState: capabilityEnabled ? "active" : "read_only_after_downgrade",
      message: capabilityEnabled
        ? ""
        : `${getHostSettingsSaveTargetLabel(safeTarget)} is read-only on this plan. ${getMissingCapabilityLabel(requiredCapability)} is required to save changes.`,
    };
  }

  return {
    target: safeTarget,
    requiredCapability: "",
    requiredCapabilityLabel: "",
    canRead: true,
    canSave: true,
    downgradeState: "active",
    message: "",
  };
};
