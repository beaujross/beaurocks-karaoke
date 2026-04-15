import assert from "node:assert/strict";
import { test } from "vitest";
import {
  applyLobbyInteraction,
  buildAwardPayload,
  createLobbyVolleyState,
  deriveComboMoment,
  deriveRelayObjective,
  getLobbyInteractionProfile,
  getLobbyLevelDefinition,
  getLobbyVolleyAudienceRatePlan,
  getLobbyVolleyDecayPerSec,
  getLobbyVolleyDynamicRelayWindowMs,
  getLobbyVolleyDynamicTimeoutMs,
  getLobbyVolleyLevelMeta,
} from "../../src/apps/TV/lobbyPlaygroundEngine.js";

test("lobbyPlaygroundEngineCoverage.test covers ultimates, fallbacks, and dynamic plans", () => {
  assert.equal(getLobbyInteractionProfile("lobby_play_echo").roleLabel, "Relay");
  assert.equal(getLobbyInteractionProfile("unknown").id, "wave");
  assert.equal(getLobbyLevelDefinition(99).label, "Launch");

  const baselineState = createLobbyVolleyState();

  const unsupportedState = applyLobbyInteraction(
    { ...baselineState, energy: 10, lastInteractionAtMs: 1000 },
    { type: "not_supported", uid: "u1", userName: "Ava" },
    2000,
  );
  assert.equal(unsupportedState.streakCount, 0);
  assert.ok(Number(unsupportedState.energy) < 10);
  const anonymousState = applyLobbyInteraction(
    createLobbyVolleyState(),
    { type: "wave", userName: "Anon" },
    1000,
  );
  assert.equal(anonymousState.lastInteractionUid, "");

  let state = createLobbyVolleyState();
  state = applyLobbyInteraction(state, { type: "wave", uid: "u1", userName: "Ava", count: 4 }, 1000);
  state = applyLobbyInteraction(state, { type: "laser", uid: "u2", userName: "Ben", count: 2 }, 1600);
  state = applyLobbyInteraction(state, { type: "ultimate_magnet", uid: "u3", userName: "Cam" }, 2100);

  const levelMeta = getLobbyVolleyLevelMeta(state, 2200);
  assert.equal(levelMeta.currentTier >= 0, true);
  assert.equal(levelMeta.activeParticipants >= 2, true);
  assert.equal(getLobbyVolleyDynamicTimeoutMs(state, 2200) >= 3200, true);
  assert.equal(getLobbyVolleyDynamicRelayWindowMs(state, 2200) >= 1200, true);
  assert.equal(getLobbyVolleyDecayPerSec(state, 2200) >= 0.16, true);

  const relaxedRatePlan = getLobbyVolleyAudienceRatePlan(state, { nowMs: 2200 });
  assert.equal(relaxedRatePlan.maxPerMinute >= 10, true);
  assert.equal(relaxedRatePlan.perUserCooldownMs >= 120, true);

  const strictRatePlan = getLobbyVolleyAudienceRatePlan(state, {
    strictMode: true,
    roomMaxPerMinute: 99,
    roomPerUserCooldownMs: 40,
    nowMs: 2200,
  });
  assert.equal(strictRatePlan.maxPerMinute, 99);
  assert.equal(strictRatePlan.perUserCooldownMs, 120);

  const relayObjective = deriveRelayObjective({
    ...state,
    activeUltimates: [{ type: "ultimate_magnet", expiresAtMs: 4000 }],
  }, 2201);
  assert.equal(relayObjective.active, true);
  assert.equal(relayObjective.targetType, "any");
  const warningRelay = deriveRelayObjective({ ...state, relayExpiryAtMs: 3200, relayWindowMs: 2400 }, 2200);
  assert.equal(warningRelay.urgency, "warning");
  const dangerRelay = deriveRelayObjective({ ...state, relayExpiryAtMs: 2450, relayWindowMs: 2400 }, 2200);
  assert.equal(dangerRelay.urgency, "danger");

  const noCombo = deriveComboMoment(state, { type: "unknown", timestampMs: 2200 });
  assert.equal(noCombo, null);
  const noTimestampCombo = deriveComboMoment(createLobbyVolleyState(), { type: "wave", uid: "u9" });
  assert.equal(noTimestampCombo, null);
  const noPreviousCombo = deriveComboMoment(createLobbyVolleyState(), { type: "wave", uid: "u8", timestampMs: 9000 });
  assert.equal(noPreviousCombo, null);
  const unsupportedPairCombo = deriveComboMoment({
    ...createLobbyVolleyState(),
    interactions: [{ type: "laser", uid: "u1", atMs: 9050 }],
  }, { type: "echo", uid: "u2", timestampMs: 9100 });
  assert.equal(unsupportedPairCombo, null);

  const beforeCooldownUses = Number(state.participants.u3?.ultimateUses || 0);
  const cooldownState = applyLobbyInteraction(state, { type: "ultimate_magnet", uid: "u3", userName: "Cam" }, 2300);
  assert.equal(Number(cooldownState.participants.u3?.ultimateUses || 0), beforeCooldownUses);

  const rocketState = applyLobbyInteraction(state, { type: "ultimate_rocket", uid: "u4", userName: "Dee" }, 7000);
  assert.equal(Array.isArray(rocketState.activeUltimates), true);
  assert.equal(rocketState.activeUltimates.some((entry) => entry.type === "ultimate_rocket"), false);
});
