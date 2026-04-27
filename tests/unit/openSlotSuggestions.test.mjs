import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  computeOpenSlotAssignments,
  isOpenRunOfShowPerformanceSlot,
} from '../../src/apps/Host/lib/openSlotSuggestions.js';

test('open slot helper distinguishes truly open performance slots', () => {
  assert.equal(isOpenRunOfShowPerformanceSlot({
    id: 'slot-1',
    type: 'performance',
    status: 'ready',
  }), true);

  assert.equal(isOpenRunOfShowPerformanceSlot({
    id: 'slot-2',
    type: 'performance',
    status: 'ready',
    queueLinkState: 'linked',
  }), false);

  assert.equal(isOpenRunOfShowPerformanceSlot({
    id: 'slot-3',
    type: 'performance',
    status: 'ready',
    assignedPerformerName: 'Jordan',
  }), false);

  assert.equal(isOpenRunOfShowPerformanceSlot({
    id: 'slot-4',
    type: 'performance',
    status: 'ready',
    backingPlan: { playbackReady: true },
  }), false);
});

test('open slot helper clamps assignments by open slots, ready queue, and optional limit', () => {
  const openSlots = [
    { id: 'slot-1' },
    { id: 'slot-2' },
    { id: 'slot-3' },
  ];
  const readyQueueSongs = [
    { id: 'song-1' },
    { id: 'song-2' },
  ];

  const unconstrained = computeOpenSlotAssignments({ openSlots, readyQueueSongs });
  assert.equal(unconstrained.length, 2);
  assert.deepEqual(unconstrained[0], { slot: { id: 'slot-1' }, queueSong: { id: 'song-1' } });
  assert.deepEqual(unconstrained[1], { slot: { id: 'slot-2' }, queueSong: { id: 'song-2' } });

  const limited = computeOpenSlotAssignments({ openSlots, readyQueueSongs, limit: 1 });
  assert.equal(limited.length, 1);
  assert.deepEqual(limited[0], { slot: { id: 'slot-1' }, queueSong: { id: 'song-1' } });
});
