import { describe, expect, test } from 'vitest';

import {
  buildDesiredBetweenSongOccurrences,
  buildUnifiedTonightLineup,
  getCompletedPerformanceHistory,
  reconcileBetweenSongMomentOccurrences,
  suppressBetweenSongOccurrence,
} from '../../src/apps/Host/lib/betweenSongMomentAutomation.js';

const party = {
  autoCrowdMomentsEnabled: true,
  autoCrowdMomentEverySongs: 3,
  autoCrowdMomentPreferredTypes: ['trivia', 'would_you_rather'],
};

const queueSongs = Array.from({ length: 7 }, (_, index) => ({
  id: `song-${index + 1}`,
  songTitle: `Song ${index + 1}`,
  artist: `Artist ${index + 1}`,
  singerName: `Singer ${index + 1}`,
}));

describe('between-song moment automation', () => {
  test('alternates Trivia and WYR at deterministic performance boundaries', () => {
    const rows = buildDesiredBetweenSongOccurrences({ roomCode: 'ABCD', party, queueSongs });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => [row.kind, row.anchorQueueSongId])).toEqual([
      ['trivia', 'song-3'],
      ['would_you_rather', 'song-6'],
    ]);
  });

  test('completed performances advance the next visible boundary', () => {
    const completedSongs = [{
      id: 'done-1',
      status: 'performed',
      songTitle: 'Already Heard',
      artist: 'Earlier Artist',
      singerName: 'Private Singer Name',
      performanceEndedAtMs: 10,
    }];
    const rows = buildDesiredBetweenSongOccurrences({ roomCode: 'ABCD', party, queueSongs, completedSongs });
    expect(rows[0].anchorQueueSongId).toBe('song-2');
    expect(getCompletedPerformanceHistory(completedSongs)[0]).not.toHaveProperty('singerName');
  });

  test('reconciliation is idempotent and creates normal Run-of-Show moment rows', () => {
    const first = reconcileBetweenSongMomentOccurrences({ director: {}, roomCode: 'ABCD', party, queueSongs });
    const second = reconcileBetweenSongMomentOccurrences({ director: first.director, roomCode: 'ABCD', party, queueSongs });
    expect(second.changed).toBe(false);
    expect(second.director.items).toHaveLength(2);
    expect(second.director.items.map((item) => item.type)).toEqual(['trivia_break', 'would_you_rather_break']);
    expect(new Set(second.director.items.map((item) => item.automationOccurrence.occurrenceKey)).size).toBe(2);
  });

  test('removed occurrences retain a tombstone and do not reappear', () => {
    const first = reconcileBetweenSongMomentOccurrences({ director: {}, roomCode: 'ABCD', party, queueSongs });
    const removedId = first.director.items[0].id;
    const suppressed = suppressBetweenSongOccurrence(first.director, removedId);
    const reconciled = reconcileBetweenSongMomentOccurrences({ director: suppressed, roomCode: 'ABCD', party, queueSongs });
    expect(reconciled.director.items.some((item) => item.id === removedId)).toBe(false);
    expect(reconciled.director.items).toHaveLength(1);
  });

  test('unified projection anchors automated moments directly after ordinary queue songs', () => {
    const reconciled = reconcileBetweenSongMomentOccurrences({ director: {}, roomCode: 'ABCD', party, queueSongs });
    const projected = buildUnifiedTonightLineup({ queueSongs, directorItems: reconciled.director.items });
    expect(projected.map((item) => item.type)).toEqual([
      'performance', 'performance', 'performance', 'trivia_break',
      'performance', 'performance', 'performance', 'would_you_rather_break',
      'performance',
    ]);
    expect(projected.filter((item) => item.projectionSource === 'queue_song')).toHaveLength(7);
  });

  test('committed scene order stays ahead of newly queued performances', () => {
    const projected = buildUnifiedTonightLineup({
      queueSongs: [queueSongs[0]],
      directorItems: [
        { id: 'scene-1', type: 'announcement', title: 'Welcome', destination: 'queue', status: 'ready', sequence: 1 },
        { id: 'scene-2', type: 'game_break', title: 'Warm-up', destination: 'queue', status: 'ready', sequence: 2 },
      ],
    });

    expect(projected.map((item) => item.id)).toEqual(['scene-1', 'scene-2', 'queue_song-1']);
  });

  test('materializes automatic Trivia and WYR rows after their performance anchors', () => {
    const directorItems = queueSongs.map((song, index) => ({
      id: `performance-${index + 1}`,
      type: 'performance',
      destination: 'queue',
      status: 'ready',
      sequence: index + 1,
      queueSongId: song.id,
      preparedQueueSongId: song.id,
    }));
    const reconciled = reconcileBetweenSongMomentOccurrences({
      director: { items: directorItems },
      roomCode: 'ABCD',
      party,
      queueSongs,
    });
    expect(reconciled.director.items.map((item) => item.id)).toEqual([
      'performance-1',
      'performance-2',
      'performance-3',
      expect.stringContaining('auto_'),
      'performance-4',
      'performance-5',
      'performance-6',
      expect.stringContaining('auto_'),
      'performance-7',
    ]);
    expect(reconciled.director.items[3].type).toBe('trivia_break');
    expect(reconciled.director.items[7].type).toBe('would_you_rather_break');
  });

  test('marks a missing performance reference blocked instead of trusting its stale snapshot', () => {
    const projected = buildUnifiedTonightLineup({
      queueSongs: [],
      directorItems: [{
        id: 'missing-performance',
        type: 'performance',
        destination: 'queue',
        status: 'ready',
        queueSongId: 'deleted-song',
        assignedPerformerName: 'Stale Singer',
        songTitle: 'Stale Song',
      }],
    });
    expect(projected[0]).toMatchObject({
      status: 'blocked',
      blockedReason: 'missing_queue_performance',
      referenceState: 'missing',
    });
  });

  test('director performance placement joins the latest queue-song content without duplicating it', () => {
    const projected = buildUnifiedTonightLineup({
      queueSongs: [{
        ...queueSongs[0],
        singerName: 'Updated Singer',
        songTitle: 'Updated Song',
        artist: 'Updated Artist',
      }],
      directorItems: [{
        id: 'performance-1',
        type: 'performance',
        destination: 'queue',
        status: 'ready',
        sequence: 1,
        preparedQueueSongId: 'song-1',
        assignedPerformerName: 'Stale Singer',
        songTitle: 'Stale Song',
      }],
    });

    expect(projected).toHaveLength(1);
    expect(projected[0]).toMatchObject({
      id: 'performance-1',
      queueSongId: 'song-1',
      assignedPerformerName: 'Updated Singer',
      songTitle: 'Updated Song',
      artistName: 'Updated Artist',
      projectionSource: 'director',
    });
  });

  test('keeps a due occurrence after its anchor performance leaves the ordinary queue', () => {
    const initial = reconcileBetweenSongMomentOccurrences({ director: {}, roomCode: 'ABCD', party, queueSongs });
    const completedSongs = queueSongs.slice(0, 3).map((song, index) => ({
      ...song,
      status: 'performed',
      performanceEndedAtMs: index + 1,
    }));
    const afterCompletion = reconcileBetweenSongMomentOccurrences({
      director: initial.director,
      roomCode: 'ABCD',
      party,
      queueSongs: queueSongs.slice(3),
      completedSongs,
    });
    const dueMoment = afterCompletion.director.items.find(
      (item) => item.automationOccurrence?.boundaryOrdinal === 3
    );
    expect(dueMoment).toBeTruthy();
    const projected = buildUnifiedTonightLineup({
      queueSongs: queueSongs.slice(3),
      directorItems: afterCompletion.director.items,
    });
    expect(projected[0].id).toBe(dueMoment.id);
    expect(projected[1].queueSongId).toBe('song-4');
  });

  test('cadence changes replace untouched future occurrences without duplicate keys', () => {
    const initial = reconcileBetweenSongMomentOccurrences({ director: {}, roomCode: 'ABCD', party, queueSongs });
    const changed = reconcileBetweenSongMomentOccurrences({
      director: initial.director,
      roomCode: 'ABCD',
      party: { ...party, autoCrowdMomentEverySongs: 2 },
      queueSongs,
    });
    expect(changed.director.items).toHaveLength(3);
    expect(changed.director.items.map((item) => item.automationOccurrence?.anchorQueueSongId)).toEqual([
      'song-2', 'song-4', 'song-6',
    ]);
    expect(changed.director.items.every((item) => item.automationOccurrence?.cadence === 2)).toBe(true);
    expect(new Set(changed.director.items.map((item) => item.automationOccurrence?.occurrenceKey)).size).toBe(3);
  });

  test('host-pinned occurrences survive a later rule reconciliation', () => {
    const initial = reconcileBetweenSongMomentOccurrences({ director: {}, roomCode: 'ABCD', party, queueSongs });
    const pinned = {
      ...initial.director,
      items: initial.director.items.map((item, index) => index === 0
        ? {
          ...item,
          automationOccurrence: {
            ...item.automationOccurrence,
            anchorQueueSongId: 'song-4',
            placementMode: 'host_pinned',
          },
        }
        : item),
    };
    const reconciled = reconcileBetweenSongMomentOccurrences({
      director: pinned,
      roomCode: 'ABCD',
      party: { ...party, autoCrowdMomentEverySongs: 2 },
      queueSongs,
    });
    expect(reconciled.director.items.some((item) => (
      item.automationOccurrence?.placementMode === 'host_pinned'
      && item.automationOccurrence?.anchorQueueSongId === 'song-4'
    ))).toBe(true);
  });
});
