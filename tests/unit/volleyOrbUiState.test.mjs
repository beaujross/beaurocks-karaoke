import assert from "node:assert/strict";
import { test } from "vitest";
import {
  getVolleyOrbBaseAction,
  getVolleyOrbResponsiveMetrics,
  getVolleyOrbUltimate,
  getVolleyOrbMobileMainLine,
  getVolleyOrbTvInstructionCopy,
  isVolleyOrbUltimateType,
  isVolleyOrbSceneActive,
  isVolleyOrbTargetInteraction,
  normalizeVolleyOrbInteractionType,
} from "../../src/lib/volleyOrbUiState.js";

test("volleyOrbUiState.test", () => {
  assert.equal(
    isVolleyOrbSceneActive({
      hasCurrentSinger: false,
      activeMode: "karaoke",
      lightMode: "",
    }),
    false,
  );
  assert.equal(
    isVolleyOrbSceneActive({
      hasCurrentSinger: false,
      activeMode: "karaoke",
      lightMode: "volley",
    }),
    true,
  );
  assert.equal(
    isVolleyOrbSceneActive({
      hasCurrentSinger: true,
      activeMode: "karaoke",
      lightMode: "volley",
    }),
    false,
  );
  assert.equal(
    isVolleyOrbSceneActive({
      hasCurrentSinger: false,
      activeMode: "bingo",
      lightMode: "volley",
    }),
    false,
  );

  assert.equal(
    getVolleyOrbMobileMainLine({
      paused: false,
      timedOut: false,
      relayActive: false,
    }),
    "Tap to launch",
  );
  assert.equal(
    getVolleyOrbMobileMainLine({
      paused: false,
      timedOut: false,
      relayActive: true,
    }),
    "Hit target",
  );
  assert.equal(
    getVolleyOrbMobileMainLine({
      paused: false,
      timedOut: true,
      relayActive: true,
    }),
    "Save it",
  );
  assert.equal(
    getVolleyOrbMobileMainLine({
      paused: true,
      timedOut: true,
      relayActive: true,
    }),
    "Paused",
  );

  assert.deepEqual(
    getVolleyOrbTvInstructionCopy({
      warningState: false,
      hasActiveVolley: false,
      volleyExpired: false,
    }),
    {
      headline: "Join In",
      secondary: "Any tap launches",
    },
  );
  assert.deepEqual(
    getVolleyOrbTvInstructionCopy({
      warningState: false,
      hasActiveVolley: true,
      volleyExpired: false,
    }),
    {
      headline: "Pass It",
      secondary: "New player hits target",
    },
  );
  assert.deepEqual(
    getVolleyOrbTvInstructionCopy({
      warningState: true,
      hasActiveVolley: true,
      volleyExpired: false,
    }),
    {
      headline: "Save It",
      secondary: "Any tap now",
    },
  );
  assert.deepEqual(
    getVolleyOrbTvInstructionCopy({
      warningState: false,
      hasActiveVolley: false,
      volleyExpired: true,
    }),
    {
      headline: "Restart",
      secondary: "Any tap relaunches",
    },
  );

  assert.equal(
    isVolleyOrbTargetInteraction({
      relayActive: true,
      targetType: "lobby_play_echo",
      interactionId: "lobby_play_echo",
    }),
    true,
  );
  assert.equal(
    isVolleyOrbTargetInteraction({
      relayActive: true,
      targetType: "lobby_play_echo",
      interactionId: "lobby_play_wave",
    }),
    false,
  );
  assert.equal(
    isVolleyOrbTargetInteraction({
      relayActive: false,
      targetType: "lobby_play_echo",
      interactionId: "lobby_play_echo",
    }),
    false,
  );
  assert.equal(
    isVolleyOrbTargetInteraction({
      relayActive: true,
      targetType: "any",
      interactionId: "lobby_play_wave",
    }),
    true,
  );

  assert.equal(normalizeVolleyOrbInteractionType(""), "");
  assert.equal(normalizeVolleyOrbInteractionType("  lobby_play_wave "), "wave");
  assert.equal(getVolleyOrbBaseAction("lobby_play_confetti")?.label, "Burst");
  assert.equal(getVolleyOrbBaseAction("unknown"), null);
  assert.equal(getVolleyOrbUltimate("ultimate_magnet")?.label, "Catch-All");
  assert.equal(getVolleyOrbUltimate("lobby_play_ultimate_rocket")?.durationMs, 0);
  assert.equal(isVolleyOrbUltimateType("ultimate_feather"), true);
  assert.equal(isVolleyOrbUltimateType("wave"), false);

  assert.deepEqual(
    getVolleyOrbResponsiveMetrics({
      sceneWidth: 1280,
      sceneHeight: 720,
    }),
    {
      sceneWidthPx: 1280,
      sceneHeightPx: 720,
      orbSizePx: 331,
      orbScale: 0.9194,
      orbContentScale: 1,
      participantSizePx: 29,
    },
  );

  assert.deepEqual(
    getVolleyOrbResponsiveMetrics({
      sceneWidth: 1280,
      sceneHeight: 260,
    }),
    {
      sceneWidthPx: 1280,
      sceneHeightPx: 260,
      orbSizePx: 120,
      orbScale: 0.34,
      orbContentScale: 0.52,
      participantSizePx: 22,
    },
  );

  const invalidMetrics = getVolleyOrbResponsiveMetrics({
    sceneWidth: 0,
    sceneHeight: "bad-data",
  });
  assert.equal(invalidMetrics.sceneWidthPx, 0);
  assert.equal(Number.isNaN(invalidMetrics.sceneHeightPx), true);
  assert.equal(invalidMetrics.orbSizePx, 280);
  assert.equal(invalidMetrics.orbScale, 0.78);
  assert.equal(invalidMetrics.orbContentScale, 0.84);
  assert.equal(invalidMetrics.participantSizePx, 27);
});
