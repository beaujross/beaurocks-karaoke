import assert from "node:assert/strict";
import { test } from "vitest";

import { CROWD_MODE_PRESETS } from "../../src/lib/hostCrowdModes.js";
import {
  HOST_SETTINGS_ACCESSIBILITY_SURFACES,
  buildHostSettingsAccessibilityGate,
  evaluateHostSettingsPlainLanguage,
  getHostSettingsAccessibilityChecklist,
} from "../../src/lib/hostSettingsAccessibility.js";
import { OPERATING_STYLE_PRESETS } from "../../src/lib/hostOperatingStyles.js";

test("hostSettingsAccessibility exposes live bundle checklist criteria", () => {
  assert.deepEqual(
    getHostSettingsAccessibilityChecklist("LIVE_BUNDLES"),
    {
      id: "live_bundles",
      label: "Live bundles",
      requiredCriteria: [
        "keyboard_path",
        "menu_expanded_state",
        "live_status_summary",
        "undo_path",
        "non_color_state",
      ],
    },
  );
});

test("hostSettingsAccessibility flags internal jargon and long summaries", () => {
  const result = evaluateHostSettingsPlainLanguage({
    label: "Run of show inheritance status",
    description: "This runtime override follows the organization precedence chain. It is visible here. It is still too dense.",
    actionLabels: ["Save to workspace template"],
  });

  assert.equal(result.passes, false);
  assert.deepEqual(
    result.issues,
    [
      "description_exceeds_2_sentences",
      "contains_internal_term:organization",
      "contains_internal_term:inheritance",
      "contains_internal_term:precedence",
      "contains_internal_term:runtime override",
    ],
  );
});

test("hostSettingsAccessibility gate passes for current bundle summaries and save labels", () => {
  const summaries = [
    ...CROWD_MODE_PRESETS.map((preset) => ({
      id: `crowd_${preset.id}`,
      label: preset.label,
      description: preset.description,
      helperText: "Use the detailed controls below only when tonight needs exceptions.",
      actionLabels: ["Save as my default", "Save to workspace template", "Undo"],
    })),
    ...OPERATING_STYLE_PRESETS.map((preset) => ({
      id: `ops_${preset.id}`,
      label: preset.label,
      description: preset.description,
      helperText: "Use the detailed controls below only when tonight needs exceptions.",
      actionLabels: ["Use my default", "Use workspace template", "Restore saved room value"],
    })),
  ];

  const result = buildHostSettingsAccessibilityGate({
    surfaceIds: Object.values(HOST_SETTINGS_ACCESSIBILITY_SURFACES),
    summarySamples: summaries,
  });

  assert.equal(result.passes, true);
  assert.deepEqual(result.missingSurfaceIds, []);
  assert.deepEqual(result.failingSummaryIds, []);
});
