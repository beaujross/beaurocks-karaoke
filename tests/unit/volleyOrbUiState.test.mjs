import assert from "node:assert/strict";
import { test } from "vitest";
import {
  getVolleyOrbResponsiveMetrics,
  getVolleyOrbMobileMainLine,
  getVolleyOrbTvInstructionCopy,
  isVolleyOrbSceneActive,
  isVolleyOrbTargetInteraction,
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
});
