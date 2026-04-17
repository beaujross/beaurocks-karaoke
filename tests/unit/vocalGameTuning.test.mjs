import assert from "node:assert/strict";
import { test } from "vitest";

import {
  FLAPPY_BIRD_TUNING,
  VOICE_GAME_FUN_DEFAULTS,
  buildRidingScalesStepMsList,
  getRidingScalesHoldMs,
  getRidingScalesLengthIncrement,
  getRidingScalesStepMs,
  getVocalChallengeDifficultyConfig,
  getVocalChallengeSequenceLength,
} from "../../src/games/vocalGameTuning.js";

test("voice game defaults bias toward easier audience-friendly sessions", () => {
  assert.equal(VOICE_GAME_FUN_DEFAULTS.vocalChallenge.durationSec, 45);
  assert.equal(VOICE_GAME_FUN_DEFAULTS.vocalChallenge.difficulty, "easy");
  assert.equal(VOICE_GAME_FUN_DEFAULTS.ridingScales.durationSec, 45);
  assert.equal(VOICE_GAME_FUN_DEFAULTS.ridingScales.maxStrikes, 5);
  assert.equal(VOICE_GAME_FUN_DEFAULTS.ridingScales.rewardPerRound, 50);
  assert.equal(VOICE_GAME_FUN_DEFAULTS.flappyBird.lives, 4);
  assert.equal(VOICE_GAME_FUN_DEFAULTS.flappyBird.difficulty, "normal");
  assert.ok(FLAPPY_BIRD_TUNING.firstObstacleDelayMs > FLAPPY_BIRD_TUNING.startGraceMs);
  assert.equal(FLAPPY_BIRD_TUNING.hostAssistDefaultMs, 4800);
  assert.ok(FLAPPY_BIRD_TUNING.crowdGapForgiveness > FLAPPY_BIRD_TUNING.soloGapForgiveness);
});

test("vocal challenge tuning gets stricter as difficulty rises", () => {
  const easyCrowd = getVocalChallengeDifficultyConfig("easy", { crowdMode: true });
  const hardSolo = getVocalChallengeDifficultyConfig("hard", { crowdMode: false });

  assert.ok(easyCrowd.intervalMs > hardSolo.intervalMs);
  assert.ok(easyCrowd.holdMs < hardSolo.holdMs);
  assert.ok(easyCrowd.minConfidence < hardSolo.minConfidence);
  assert.ok(easyCrowd.minStability < hardSolo.minStability);
  assert.ok(getVocalChallengeSequenceLength("easy") < getVocalChallengeSequenceLength("hard"));
});

test("riding scales tuning gives easier modes more room and slower growth", () => {
  const easyStep = getRidingScalesStepMs(1, "easy");
  const hardStep = getRidingScalesStepMs(1, "hard");

  assert.ok(easyStep > hardStep);
  assert.ok(getRidingScalesHoldMs("easy") < getRidingScalesHoldMs("hard"));
  assert.equal(getRidingScalesLengthIncrement(6, "easy"), 1);
  assert.ok(getRidingScalesLengthIncrement(6, "hard") >= 1);

  const steps = buildRidingScalesStepMsList(4, 2, "standard");
  assert.equal(steps.length, 4);
  steps.forEach((value) => {
    assert.ok(value >= 760);
    assert.ok(value <= 1900);
  });
});
