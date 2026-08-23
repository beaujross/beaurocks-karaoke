import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getGameLaunchCompatibility, getGameLifecycleLabel, getRoomGameLaunchPreflight, getRunOfShowGameMode } from '../../src/lib/gameLaunchCompatibility.js';

test('provides host-readable lifecycle labels', () => {
  assert.equal(getGameLifecycleLabel('trivia_pop'), 'Between songs');
  assert.equal(getGameLifecycleLabel('bingo'), 'All-night companion');
  assert.equal(getGameLifecycleLabel('pop_trivia_companion'), 'During a performance');
});

test('blocks concurrent takeovers and orphaned performance companions', () => {
  assert.equal(getGameLaunchCompatibility({ requestedMode: 'wyr', activeMode: 'trivia_pop' }).code, 'active_takeover');
  assert.equal(getGameLaunchCompatibility({ requestedMode: 'pop_trivia_companion', activeMode: 'karaoke', performanceActive: false }).code, 'performance_required');
  assert.equal(getGameLaunchCompatibility({ requestedMode: 'pop_trivia_companion', activeMode: 'karaoke', performanceActive: true }).allowed, true);
});

test('protects all-night companions from accidental takeover displacement', () => {
  assert.equal(getGameLaunchCompatibility({ requestedMode: 'wyr', activeMode: 'bingo' }).code, 'companion_displacement');
  assert.equal(getGameLaunchCompatibility({ requestedMode: 'pop_trivia_companion', activeMode: 'bingo', performanceActive: true }).allowed, true);
});

test('blocks Trivia and WYR while applause or the performance recap owns Public TV', () => {
  assert.equal(getRoomGameLaunchPreflight({
    requestedMode: 'wyr',
    room: { activeMode: 'applause_result' },
  }).code, 'post_performance_surface_lease');

  const now = Date.now();
  const recapRoom = {
    activeMode: 'karaoke',
    lastPerformance: { timestamp: now - 1000, recapScoreFinalized: true },
  };
  assert.equal(getRoomGameLaunchPreflight({
    requestedMode: 'trivia_pop',
    room: recapRoom,
  }).code, 'post_performance_surface_lease');
});

test('derives queued game identity without changing its payload', () => {
  assert.equal(getRunOfShowGameMode({ type: 'trivia_break' }), 'trivia_pop');
  assert.equal(getRunOfShowGameMode({ type: 'would_you_rather_break' }), 'wyr');
  assert.equal(getRunOfShowGameMode({ type: 'game_break', modeLaunchPlan: { modeKey: 'doodle_oke' } }), 'doodle_oke');
});
