import assert from "node:assert/strict";
import {
  getVolleyOrbMobileMainLine,
  getVolleyOrbTvInstructionCopy,
  isVolleyOrbSceneActive,
  isVolleyOrbTargetInteraction,
} from "../../src/lib/volleyOrbUiState.js";

const run = () => {
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
    "Tap any button to start the orb",
  );
  assert.equal(
    getVolleyOrbMobileMainLine({
      paused: false,
      timedOut: false,
      relayActive: true,
    }),
    "Different player tap TARGET",
  );
  assert.equal(
    getVolleyOrbMobileMainLine({
      paused: false,
      timedOut: true,
      relayActive: true,
    }),
    "Orb dropping. Tap now",
  );
  assert.equal(
    getVolleyOrbMobileMainLine({
      paused: true,
      timedOut: true,
      relayActive: true,
    }),
    "Paused by host",
  );

  assert.deepEqual(
    getVolleyOrbTvInstructionCopy({
      warningState: false,
      hasActiveVolley: false,
      volleyExpired: false,
    }),
    {
      headline: "Scan to join",
      secondary: "Any player taps any button to launch",
    },
  );
  assert.deepEqual(
    getVolleyOrbTvInstructionCopy({
      warningState: false,
      hasActiveVolley: true,
      volleyExpired: false,
    }),
    {
      headline: "Pass the orb",
      secondary: "Different player taps the glowing target",
    },
  );
  assert.deepEqual(
    getVolleyOrbTvInstructionCopy({
      warningState: true,
      hasActiveVolley: true,
      volleyExpired: false,
    }),
    {
      headline: "Orb dropping",
      secondary: "Tap now to save it",
    },
  );
  assert.deepEqual(
    getVolleyOrbTvInstructionCopy({
      warningState: false,
      hasActiveVolley: false,
      volleyExpired: true,
    }),
    {
      headline: "Chain reset",
      secondary: "Any player taps to restart",
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

  console.log("PASS volleyOrbUiState");
};

run();
