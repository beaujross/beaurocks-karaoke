import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  auditGameLifecycleCoverage,
  GAME_LIFECYCLE_KINDS,
  getGameCollisionRisks,
  getGameLifecycleContract,
} from '../../src/lib/gameLifecycle.js';

test('separates Trivia breaks from the Pop Trivia performance companion', () => {
  assert.equal(getGameLifecycleContract('trivia_pop').kind, GAME_LIFECYCLE_KINDS.betweenSong);
  assert.equal(getGameLifecycleContract('pop_trivia_companion').kind, GAME_LIFECYCLE_KINDS.performanceCompanion);
  assert.equal(getGameLifecycleContract('pop_trivia_companion').requiresPerformance, true);
});

test('classifies established games by operational lifecycle', () => {
  assert.equal(getGameLifecycleContract('bingo').kind, GAME_LIFECYCLE_KINDS.allNightCompanion);
  assert.equal(getGameLifecycleContract('karaoke_bracket').kind, GAME_LIFECYCLE_KINDS.standalone);
  assert.equal(getGameLifecycleContract('wyr').kind, GAME_LIFECYCLE_KINDS.betweenSong);
  assert.equal(getGameLifecycleContract('doodle_oke').moderation, true);
});

test('reports lifecycle coverage without creating alternate game identity', () => {
  assert.deepEqual(auditGameLifecycleCoverage(['trivia_pop', 'wyr', 'unknown_mode']), {
    covered: ['trivia_pop', 'wyr'],
    missing: ['unknown_mode'],
  });
});

test('detects takeover, shared-state, and orphaned-companion collisions', () => {
  assert.deepEqual(getGameCollisionRisks({ activeModes: ['trivia_pop', 'wyr'] }).map((risk) => risk.code), ['multiple_takeovers', 'shared_prompt_vote_collision']);
  assert.deepEqual(getGameCollisionRisks({ activeModes: ['pop_trivia_companion'], performanceActive: false }).map((risk) => risk.code), ['companion_without_performance']);
  assert.deepEqual(getGameCollisionRisks({ activeModes: ['bingo', 'pop_trivia_companion'], performanceActive: true }), []);
});
