import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getRoomGameLaunchPreflight } from '../../src/lib/gameLaunchCompatibility.js';
import { getGameLifecyclePresentation } from '../../src/lib/gameLifecyclePresentation.js';

test('dormant Pop Trivia does not claim the audience or TV surface', () => {
  const view = getGameLifecyclePresentation({ activeMode: 'karaoke', popTriviaEnabled: true });
  assert.equal(view.visible, false);
  assert.deepEqual(view.lifecycleSlots.dormantPerformanceCompanionModes, ['pop_trivia_companion']);
});

test('explicit Pop Trivia guidance identifies performance-companion ownership', () => {
  const view = getGameLifecyclePresentation({
    activeMode: 'pop_trivia_companion',
    gameData: { status: 'asking', autoReveal: true },
  });
  assert.equal(view.visible, true);
  assert.equal(view.modeId, 'pop_trivia_companion');
  assert.equal(view.slot, 'performance_companion');
});

test('a persisted Bingo board does not masquerade as the active takeover', () => {
  const preflight = getRoomGameLaunchPreflight({
    requestedMode: 'wyr',
    room: { activeMode: 'karaoke', bingoData: ['Sing a duet'] },
  });
  assert.equal(preflight.allowed, true);
  assert.equal(preflight.lifecycleSlots.takeoverMode, '');
  assert.deepEqual(preflight.lifecycleSlots.allNightCompanionModes, ['bingo']);
});

test('active surface ownership blocks unsafe cross-kind launches', () => {
  const replaceBingo = getRoomGameLaunchPreflight({
    requestedMode: 'wyr',
    room: { activeMode: 'bingo', bingoData: ['One'] },
  });
  assert.equal(replaceBingo.code, 'companion_displacement');

  const startBingoDuringTrivia = getRoomGameLaunchPreflight({
    requestedMode: 'bingo',
    room: { activeMode: 'trivia_pop', triviaQuestion: { status: 'asking' } },
  });
  assert.equal(startBingoDuringTrivia.code, 'takeover_owns_surface');

  const startCompanionDuringTrivia = getRoomGameLaunchPreflight({
    requestedMode: 'pop_trivia_companion',
    room: {
      activeMode: 'trivia_pop',
      currentPerformanceSession: { sessionId: 'session-1' },
    },
  });
  assert.equal(startCompanionDuringTrivia.code, 'takeover_owns_surface');
});
