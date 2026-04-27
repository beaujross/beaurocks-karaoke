import assert from 'node:assert/strict';
import { test } from 'vitest';

import { getCoHostSignalMeta } from '../../src/lib/coHostSignals.js';
import {
  buildCoHostSignalActivityPayload,
  buildCurrentPerformanceSignalContext,
  buildPerformanceReactionMeta,
} from '../../src/apps/Mobile/lib/coHostSignalPayload.js';

test('co-host signal helpers build live performance context with elapsed time and artwork', () => {
  const nowMs = 120_000;
  const currentSinger = {
    id: 'perf-1',
    songId: 'song-1',
    singerUid: 'user-1',
    singerName: 'Taylor',
    songTitle: 'Dreams',
    artist: 'Fleetwood Mac',
    albumArtUrl: 'https://img.example.com/dreams.jpg',
    performingStartedAt: nowMs - 42_000,
  };

  const context = buildCurrentPerformanceSignalContext(currentSinger, nowMs);
  const performanceMeta = buildPerformanceReactionMeta(currentSinger);

  assert.equal(context.artworkUrl, 'https://img.example.com/dreams.jpg');
  assert.equal(context.elapsedSec, 42);
  assert.equal(context.elapsedLabel, '0:42 in');
  assert.equal(context.isLive, true);
  assert.deepEqual(performanceMeta, {
    performanceId: 'perf-1',
    performanceSongId: 'song-1',
    performanceSingerUid: 'user-1',
    performanceSingerName: 'Taylor',
    performanceStartedAtMs: nowMs - 42_000,
  });
});

test('co-host signal payload attaches performance data when a song is live and falls back to room scope otherwise', () => {
  const liveMeta = getCoHostSignalMeta('track_up');
  const livePayload = buildCoHostSignalActivityPayload({
    meta: liveMeta,
    roomCode: 'AAHF',
    actorUid: 'cohost-1',
    actorName: 'Jordan',
    currentSinger: {
      id: 'perf-2',
      singerName: 'Alex',
      songTitle: 'Valerie',
      artistName: 'Amy Winehouse',
      artworkUrl100: 'https://img.example.com/valerie.jpg',
      timestamp: 100_000,
    },
    nowMs: 125_000,
    iconFallback: '✨',
  });

  assert.equal(livePayload.signalScope, 'performance');
  assert.equal(livePayload.performanceId, 'perf-2');
  assert.equal(livePayload.performanceSongTitle, 'Valerie');
  assert.equal(livePayload.performanceArtistName, 'Amy Winehouse');
  assert.equal(livePayload.performanceAlbumArtUrl, 'https://img.example.com/valerie.jpg');
  assert.equal(livePayload.performanceElapsedSec, 25);

  const roomPayload = buildCoHostSignalActivityPayload({
    meta: getCoHostSignalMeta('mix_issue'),
    roomCode: 'AAHF',
    actorUid: 'cohost-2',
    actorName: 'Casey',
    currentSinger: {},
    nowMs: 125_000,
    iconFallback: '✨',
  });

  assert.equal(roomPayload.signalScope, 'room');
  assert.equal(roomPayload.performanceId, undefined);
  assert.equal(roomPayload.performanceSongTitle, null);
  assert.equal(roomPayload.performanceElapsedSec, 0);
});
