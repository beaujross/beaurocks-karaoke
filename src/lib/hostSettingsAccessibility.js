export const HOST_SETTINGS_ACCESSIBILITY_SURFACES = Object.freeze({
  tonightBundles: "tonight_bundles",
  liveBundles: "live_bundles",
  promotedSaves: "promoted_saves",
  reviewSummary: "review_summary",
});

export const HOST_SETTINGS_COPY_LIMITS = Object.freeze({
  maxLabelChars: 36,
  maxDescriptionChars: 160,
  maxDescriptionSentences: 2,
  maxActionLabelChars: 30,
});

export const HOST_SETTINGS_INTERNAL_COPY_TERMS = Object.freeze([
  "organization",
  "inheritance",
  "precedence",
  "runtime override",
  "room override",
  "migration adapter",
  "sourcetype",
  "sourceid",
  "host_default",
  "workspace_template",
  "room_override",
]);

const SURFACE_CHECKLISTS = Object.freeze({
  [HOST_SETTINGS_ACCESSIBILITY_SURFACES.tonightBundles]: Object.freeze({
    id: HOST_SETTINGS_ACCESSIBILITY_SURFACES.tonightBundles,
    label: "Tonight bundles",
    requiredCriteria: Object.freeze([
      "keyboard_path",
      "pressed_state",
      "plain_language_summary",
      "advanced_controls_secondary",
      "restore_path",
    ]),
  }),
  [HOST_SETTINGS_ACCESSIBILITY_SURFACES.liveBundles]: Object.freeze({
    id: HOST_SETTINGS_ACCESSIBILITY_SURFACES.liveBundles,
    label: "Live bundles",
    requiredCriteria: Object.freeze([
      "keyboard_path",
      "menu_expanded_state",
      "live_status_summary",
      "undo_path",
      "non_color_state",
    ]),
  }),
  [HOST_SETTINGS_ACCESSIBILITY_SURFACES.promotedSaves]: Object.freeze({
    id: HOST_SETTINGS_ACCESSIBILITY_SURFACES.promotedSaves,
    label: "Promoted saves",
    requiredCriteria: Object.freeze([
      "plain_scope_labels",
      "role_gated_visibility",
      "action_labels_under_limit",
      "source_cue_near_action",
    ]),
  }),
  [HOST_SETTINGS_ACCESSIBILITY_SURFACES.reviewSummary]: Object.freeze({
    id: HOST_SETTINGS_ACCESSIBILITY_SURFACES.reviewSummary,
    label: "Review summary",
    requiredCriteria: Object.freeze([
      "one_screen_scan",
      "plain_language_summary",
      "now_vs_next_time_clarity",
      "non_color_state",
    ]),
  }),
});

const normalizeSurfaceId = (value = "") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === "tonight" || token === "tonight_bundle" || token === "tonight_bundles") {
    return HOST_SETTINGS_ACCESSIBILITY_SURFACES.tonightBundles;
  }
  if (token === "live" || token === "live_bundle" || token === "live_bundles") {
    return HOST_SETTINGS_ACCESSIBILITY_SURFACES.liveBundles;
  }
  if (token === "save" || token === "promoted_save" || token === "promoted_saves") {
    return HOST_SETTINGS_ACCESSIBILITY_SURFACES.promotedSaves;
  }
  if (token === "review" || token === "review_summary") {
    return HOST_SETTINGS_ACCESSIBILITY_SURFACES.reviewSummary;
  }
  return HOST_SETTINGS_ACCESSIBILITY_SURFACES.tonightBundles;
};

const normalizeText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const countSentences = (value = "") => {
  const normalized = normalizeText(value);
  if (!normalized) return 0;
  const matches = normalized.match(/[.!?]+/g);
  return matches?.length || 1;
};

const findBlockedTerms = (text = "") => {
  const normalized = normalizeText(text).toLowerCase();
  return HOST_SETTINGS_INTERNAL_COPY_TERMS.filter((term) => normalized.includes(term));
};

export const getHostSettingsAccessibilityChecklist = (surfaceId = "") => (
  SURFACE_CHECKLISTS[normalizeSurfaceId(surfaceId)] || SURFACE_CHECKLISTS[HOST_SETTINGS_ACCESSIBILITY_SURFACES.tonightBundles]
);

export const evaluateHostSettingsPlainLanguage = ({
  label = "",
  description = "",
  helperText = "",
  actionLabels = [],
} = {}) => {
  const normalizedLabel = normalizeText(label);
  const normalizedDescription = normalizeText(description);
  const normalizedHelperText = normalizeText(helperText);
  const normalizedActionLabels = Array.isArray(actionLabels)
    ? actionLabels.map((value) => normalizeText(value)).filter(Boolean)
    : [];
  const combinedText = [
    normalizedLabel,
    normalizedDescription,
    normalizedHelperText,
    ...normalizedActionLabels,
  ].filter(Boolean).join(" ");
  const blockedTerms = findBlockedTerms(combinedText);
  const issues = [];

  if (normalizedLabel.length > HOST_SETTINGS_COPY_LIMITS.maxLabelChars) {
    issues.push(`label_exceeds_${HOST_SETTINGS_COPY_LIMITS.maxLabelChars}`);
  }
  if (normalizedDescription.length > HOST_SETTINGS_COPY_LIMITS.maxDescriptionChars) {
    issues.push(`description_exceeds_${HOST_SETTINGS_COPY_LIMITS.maxDescriptionChars}`);
  }
  if (countSentences(normalizedDescription) > HOST_SETTINGS_COPY_LIMITS.maxDescriptionSentences) {
    issues.push(`description_exceeds_${HOST_SETTINGS_COPY_LIMITS.maxDescriptionSentences}_sentences`);
  }
  if (normalizedActionLabels.some((value) => value.length > HOST_SETTINGS_COPY_LIMITS.maxActionLabelChars)) {
    issues.push(`action_label_exceeds_${HOST_SETTINGS_COPY_LIMITS.maxActionLabelChars}`);
  }
  blockedTerms.forEach((term) => issues.push(`contains_internal_term:${term}`));

  return {
    passes: issues.length === 0,
    issues,
    blockedTerms,
    normalized: {
      label: normalizedLabel,
      description: normalizedDescription,
      helperText: normalizedHelperText,
      actionLabels: normalizedActionLabels,
    },
  };
};

export const buildHostSettingsAccessibilityGate = ({
  surfaceIds = [],
  summarySamples = [],
} = {}) => {
  const normalizedSurfaces = Array.isArray(surfaceIds)
    ? surfaceIds.map((value) => normalizeSurfaceId(value))
    : [];
  const requiredSurfaceIds = Object.values(HOST_SETTINGS_ACCESSIBILITY_SURFACES);
  const missingSurfaceIds = requiredSurfaceIds.filter((id) => !normalizedSurfaces.includes(id));
  const summaryFindings = Array.isArray(summarySamples)
    ? summarySamples.map((sample = {}) => ({
      id: normalizeText(sample.id || sample.label || "sample"),
      result: evaluateHostSettingsPlainLanguage(sample),
    }))
    : [];
  const failingSummaryIds = summaryFindings
    .filter((entry) => entry.result.passes === false)
    .map((entry) => entry.id);

  return {
    passes: missingSurfaceIds.length === 0 && failingSummaryIds.length === 0,
    missingSurfaceIds,
    failingSummaryIds,
    coveredSurfaceCount: requiredSurfaceIds.length - missingSurfaceIds.length,
    summaryFindings,
  };
};
