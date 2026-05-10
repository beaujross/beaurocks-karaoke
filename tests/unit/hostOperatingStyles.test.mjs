import assert from "node:assert/strict";
import { test } from "vitest";

import {
  OPERATING_STYLE_PRESETS,
  buildOperatingStylePatch,
  getOperatingStyleSummary,
  normalizeOperatingStyleState,
  resolveOperatingStylePresetId,
} from "../../src/lib/hostOperatingStyles.js";

test("hostOperatingStyles exposes the expected preset ids", () => {
  assert.deepEqual(
    OPERATING_STYLE_PRESETS.map((preset) => preset.id),
    ["low_touch", "balanced", "tight_control"],
  );
});

test("hostOperatingStyles resolves canonical preset ids from effective room state", () => {
  assert.equal(resolveOperatingStylePresetId({
    autoPlayMedia: true,
    readyCheckDurationSec: 8,
    queueSettings: {
      limitMode: "none",
      limitCount: 0,
      rotation: "round_robin",
      firstTimeBoost: true,
    },
  }), "low_touch");

  assert.equal(resolveOperatingStylePresetId({
    autoPlayMedia: true,
    readyCheckDurationSec: 10,
    queueSettings: {
      limitMode: "per_night",
      limitCount: 2,
      rotation: "round_robin",
      firstTimeBoost: true,
    },
  }), "balanced");

  assert.equal(resolveOperatingStylePresetId({
    autoPlayMedia: false,
    readyCheckDurationSec: 12,
    queueSettings: {
      limitMode: "per_hour",
      limitCount: 1,
      rotation: "first_come",
      firstTimeBoost: false,
    },
  }), "tight_control");

  assert.equal(resolveOperatingStylePresetId({
    autoPlayMedia: true,
    readyCheckDurationSec: 15,
    queueSettings: {
      limitMode: "none",
      limitCount: 0,
      rotation: "round_robin",
      firstTimeBoost: true,
    },
  }), "custom");
});

test("hostOperatingStyles builds normalized room patches from presets", () => {
  assert.deepEqual(
    buildOperatingStylePatch("tight_control"),
    {
      autoPlayMedia: false,
      readyCheckDurationSec: 12,
      queueSettings: {
        limitMode: "per_hour",
        limitCount: 1,
        rotation: "first_come",
        firstTimeBoost: false,
      },
    },
  );
});

test("hostOperatingStyles exposes readable preset and custom summaries", () => {
  assert.deepEqual(
    getOperatingStyleSummary({
      autoPlayMedia: true,
      readyCheckDurationSec: 10,
      queueSettings: {
        limitMode: "per_night",
        limitCount: 2,
        rotation: "round_robin",
        firstTimeBoost: true,
      },
    }),
    {
      presetId: "balanced",
      label: "Balanced Host Assist",
      shortLabel: "Balanced",
      description: "Add light guardrails while keeping the night moving smoothly.",
    },
  );

  assert.deepEqual(
    getOperatingStyleSummary({
      autoPlayMedia: false,
      readyCheckDurationSec: 15,
      queueSettings: {
        limitMode: "per_night",
        limitCount: 3,
        rotation: "round_robin",
        firstTimeBoost: false,
      },
    }),
    {
      presetId: "custom",
      label: "Custom Operating Style",
      shortLabel: "Custom",
      description: "auto-play off, ready check 15s, 3 per night, round-robin order, first-timer boost off.",
    },
  );
});

test("hostOperatingStyles normalizes state defaults safely", () => {
  assert.deepEqual(
    normalizeOperatingStyleState({}),
    {
      autoPlayMedia: true,
      readyCheckDurationSec: 10,
      queueSettings: {
        limitMode: "none",
        limitCount: 0,
        rotation: "round_robin",
        firstTimeBoost: true,
      },
    },
  );
});
