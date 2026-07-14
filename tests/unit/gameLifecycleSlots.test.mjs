import assert from 'node:assert/strict';
import { test } from 'vitest';

import { resolveGameLifecycleSlots } from '../../src/lib/gameLifecycleSlots.js';

test('separates an exclusive takeover from a persisted all-night Bingo board', () => {
  const slots = resolveGameLifecycleSlots({
    activeMode: 'trivia_pop',
    bingoData: ['Sing a duet'],
  });

  assert.equal(slots.takeoverMode, 'trivia_pop');
  assert.deepEqual(slots.allNightCompanionModes, ['bingo']);
  assert.equal(slots.primaryMode, 'trivia_pop');
});

test('activates Pop Trivia only when a performance subject exists', () => {
  const live = resolveGameLifecycleSlots({
    activeMode: 'karaoke',
    popTriviaEnabled: true,
    currentPerformanceSession: { sessionId: 'session-1', songId: 'song-1' },
  });
  assert.deepEqual(live.performanceCompanionModes, ['pop_trivia_companion']);
  assert.deepEqual(live.dormantPerformanceCompanionModes, []);
  assert.equal(live.primaryMode, 'pop_trivia_companion');

  const waiting = resolveGameLifecycleSlots({ activeMode: 'karaoke', popTriviaEnabled: true });
  assert.deepEqual(waiting.performanceCompanionModes, []);
  assert.deepEqual(waiting.dormantPerformanceCompanionModes, ['pop_trivia_companion']);
  assert.equal(waiting.primaryMode, '');
});

test('normalizes reveal aliases without changing the stored room payload', () => {
  const room = { activeMode: 'wyr_reveal', wyrData: { status: 'reveal' } };
  const slots = resolveGameLifecycleSlots(room);
  assert.equal(slots.takeoverMode, 'wyr');
  assert.equal(room.activeMode, 'wyr_reveal');
});

test('keeps Bingo primary when it is the only live room game', () => {
  const slots = resolveGameLifecycleSlots({ activeMode: 'bingo', bingoData: ['One'] });
  assert.equal(slots.takeoverMode, '');
  assert.equal(slots.primaryMode, 'bingo');
  assert.deepEqual(slots.allNightCompanionModes, ['bingo']);
});
