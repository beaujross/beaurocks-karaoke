import assert from "node:assert/strict";
import { test } from "vitest";

import {
  CROWD_MODE_PRESETS,
  buildCrowdModePatch,
  getCrowdModeSummary,
  normalizeCrowdModeState,
  resolveCrowdModePresetId,
} from "../../src/lib/hostCrowdModes.js";

test("hostCrowdModes exposes the expected preset set", () => {
  assert.deepEqual(
    CROWD_MODE_PRESETS.map((preset) => preset.id),
    ["quiet", "balanced", "hype"],
  );
});

test("hostCrowdModes resolves canonical preset ids from effective room state", () => {
  assert.equal(resolveCrowdModePresetId({
    chatShowOnTv: false,
    showScoring: false,
    marqueeEnabled: false,
    popTriviaEnabled: false,
  }), "quiet");

  assert.equal(resolveCrowdModePresetId({
    chatShowOnTv: false,
    showScoring: true,
    marqueeEnabled: true,
    popTriviaEnabled: false,
  }), "balanced");

  assert.equal(resolveCrowdModePresetId({
    chatShowOnTv: true,
    showScoring: true,
    marqueeEnabled: true,
    popTriviaEnabled: true,
    chatTvMode: "fullscreen",
  }), "hype");

  assert.equal(resolveCrowdModePresetId({
    chatShowOnTv: true,
    showScoring: false,
    marqueeEnabled: true,
    popTriviaEnabled: false,
  }), "custom");
});

test("hostCrowdModes builds room patches that normalize chat mode correctly", () => {
  assert.deepEqual(
    buildCrowdModePatch("quiet", { chatTvMode: "fullscreen" }),
    {
      chatShowOnTv: false,
      chatTvMode: "auto",
      showScoring: false,
      marqueeEnabled: false,
      popTriviaEnabled: false,
    },
  );

  assert.deepEqual(
    buildCrowdModePatch("hype", { chatTvMode: "fullscreen" }),
    {
      chatShowOnTv: true,
      chatTvMode: "fullscreen",
      showScoring: true,
      marqueeEnabled: true,
      popTriviaEnabled: true,
    },
  );
});

test("hostCrowdModes exposes readable summaries for presets and custom mixes", () => {
  assert.deepEqual(
    getCrowdModeSummary({
      chatShowOnTv: false,
      showScoring: true,
      marqueeEnabled: true,
      popTriviaEnabled: false,
    }),
    {
      presetId: "balanced",
      label: "Balanced Crowd",
      shortLabel: "Balanced",
      description: "Keep scoring and marquee visible without pushing chat or trivia.",
    },
  );

  assert.deepEqual(
    getCrowdModeSummary({
      chatShowOnTv: true,
      chatTvMode: "fullscreen",
      showScoring: false,
      marqueeEnabled: false,
      popTriviaEnabled: true,
    }),
    {
      presetId: "custom",
      label: "Custom Crowd Mix",
      shortLabel: "Custom",
      description: "fullscreen chat and pop trivia are active.",
    },
  );
});

test("hostCrowdModes normalizes state defaults safely", () => {
  assert.deepEqual(
    normalizeCrowdModeState({}),
    {
      chatShowOnTv: false,
      chatTvMode: "auto",
      showScoring: true,
      marqueeEnabled: false,
      popTriviaEnabled: false,
    },
  );
});
