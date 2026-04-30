import assert from 'node:assert/strict';
import { test } from 'vitest';

import { prepareRunOfShowQueueAssignment } from '../../src/apps/Host/lib/runOfShowQueueAssignment.js';

const baseDirector = () => ({
  items: [
    {
      id: 'slot-1',
      type: 'performance',
      title: 'Performance Slot',
      sequence: 2,
      status: 'blocked',
      performerMode: 'placeholder',
      queueLinkState: '',
      preparedQueueSongId: '',
      assignedPerformerUid: '',
      assignedPerformerName: '',
      approvedSubmissionId: '',
      songId: '',
      songTitle: '',
      artistName: '',
      backingPlan: {
        playbackReady: false,
        approvalStatus: '',
        resolutionStatus: '',
      },
    },
  ],
});

const baseSong = () => ({
  id: 'song-1',
  songTitle: 'Valerie',
  artist: 'Amy Winehouse',
  singerName: 'Taylor',
  runOfShowItemId: '',
});

const buildAssignmentPatch = (song, item) => ({
  performerMode: 'assigned',
  assignedPerformerName: song.singerName,
  songTitle: song.songTitle,
  artistName: song.artist,
  preparedQueueSongId: song.id,
  queueLinkState: 'linked',
  backingPlan: {
    ...(item?.backingPlan || {}),
    label: `${song.songTitle} - ${song.artist}`,
    playbackReady: true,
  },
});

const deriveStatus = (item = {}) => (
  String(item?.preparedQueueSongId || '').trim() ? 'ready' : 'blocked'
);

test('prepareRunOfShowQueueAssignment rejects already-linked songs targeting a different slot', () => {
  assert.throws(() => prepareRunOfShowQueueAssignment({
    director: baseDirector(),
    queueSong: {
      ...baseSong(),
      runOfShowItemId: 'slot-99',
    },
    itemId: 'slot-1',
    buildAssignmentPatch,
    deriveStatus,
  }), /assignment_song_already_linked/);
});

test('prepareRunOfShowQueueAssignment rejects slots that are no longer open', () => {
  const director = baseDirector();
  director.items[0].queueLinkState = 'linked';
  director.items[0].preparedQueueSongId = 'song-2';

  assert.throws(() => prepareRunOfShowQueueAssignment({
    director,
    queueSong: baseSong(),
    itemId: 'slot-1',
    buildAssignmentPatch,
    deriveStatus,
  }), /assignment_slot_unavailable/);
});

test('prepareRunOfShowQueueAssignment returns a ready director update for open slots', () => {
  const result = prepareRunOfShowQueueAssignment({
    director: baseDirector(),
    queueSong: baseSong(),
    itemId: 'slot-1',
    buildAssignmentPatch,
    deriveStatus,
  });

  const updatedItem = result.nextDirector.items.find((item) => item.id === 'slot-1');
  assert.ok(updatedItem);
  assert.equal(updatedItem.status, 'ready');
  assert.equal(updatedItem.preparedQueueSongId, 'song-1');
  assert.equal(updatedItem.queueLinkState, 'linked');
  assert.equal(updatedItem.assignedPerformerName, 'Taylor');
});
