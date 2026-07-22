import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  ACTIVE_ROOM_SONG_LIMIT,
  ACTIVE_ROOM_SONG_STATUSES,
  RECENT_PERFORMED_SONG_LIMIT,
  ROOM_SONG_FALLBACK_LIMIT,
  mergeRoomSongSnapshots,
} from '../../src/lib/roomSongSubscriptionModel';

test('Room song subscription limits cover active and recent history without unbounded fallback', () => {
  assert.deepEqual(ACTIVE_ROOM_SONG_STATUSES, ['assigned', 'pending', 'requested', 'performing']);
  assert.equal(ACTIVE_ROOM_SONG_LIMIT, 250);
  assert.equal(RECENT_PERFORMED_SONG_LIMIT, 250);
  assert.equal(ROOM_SONG_FALLBACK_LIMIT, 500);
});

test('active Room song state wins when snapshots briefly overlap during a status transition', () => {
  const merged = mergeRoomSongSnapshots(
    [{ id: 'song-1', status: 'performing' }, { id: 'song-2', status: 'requested' }],
    [{ id: 'song-1', status: 'performed' }, { id: 'song-3', status: 'performed' }],
  );
  assert.equal(merged.length, 3);
  assert.equal(merged.find((song) => song.id === 'song-1')?.status, 'performing');
});
