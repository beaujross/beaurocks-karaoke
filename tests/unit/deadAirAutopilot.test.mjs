import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  DEAD_AIR_AUTOFILL_SOURCE,
  buildDeadAirFillerPayload,
  buildDeadAirFillerSongPlan,
  buildSongIdentityKey,
  getDeadAirAutoFillIntent,
  getDeadAirFillerModeForAssist,
  isDeadAirAutoFillQueueItem,
} from '../../src/apps/Host/deadAirAutopilot.js';

test('deadAirAutopilot builds a deduped known-good song plan from selected browse categories', () => {
  const songs = buildDeadAirFillerSongPlan({
    categories: [
      {
        id: 'popular_now',
        songs: [
          {
            title: 'Mr. Brightside',
            artist: 'The Killers',
            backing: {
              mediaUrl: 'https://example.com/mr-brightside.mp4',
              trackSource: 'youtube',
              durationSec: 212,
              approved: true,
              playable: true,
              score: 94,
            },
          },
          { title: 'Mr. Brightside', artist: 'The Killers' },
          { title: 'Uptown Funk', artist: 'Bruno Mars' },
        ],
      },
      {
        id: 'ignored_category',
        songs: [{ title: 'Obscure B-Side', artist: 'Unknown' }],
      },
    ],
    categoryIds: ['popular_now'],
    limit: 4,
  });

  assert.equal(songs.length, 2);
  assert.equal(songs[0].title, 'Mr. Brightside');
  assert.equal(songs[0].artist, 'The Killers');
  assert.equal(songs[0].backing.mediaUrl, 'https://example.com/mr-brightside.mp4');
  assert.equal(songs[0].hasApprovedBacking, true);
  assert.equal(buildSongIdentityKey(songs[0]), 'mr. brightside__the killers');
  assert.equal(songs.some((song) => song.title === 'Obscure B-Side'), false);
});

test('deadAirAutopilot maps assist levels to persisted filler payload modes', () => {
  assert.equal(getDeadAirFillerModeForAssist('manual_first'), 'off');
  assert.equal(getDeadAirFillerModeForAssist('smart_assist'), 'suggest');
  assert.equal(getDeadAirFillerModeForAssist('autopilot_first'), 'auto_fill');

  const payload = buildDeadAirFillerPayload({
    assistLevel: 'autopilot_first',
    delaySec: 90,
    songs: [
      { title: 'Sweet Caroline', artist: 'Neil Diamond', browseSongKey: 'sweet caroline__neil diamond', hasApprovedBacking: true },
      { title: '', artist: 'Nobody' },
      { songTitle: 'Dont Stop Believin', artist: 'Journey' },
    ],
  });

  assert.equal(payload.enabled, true);
  assert.equal(payload.mode, 'auto_fill');
  assert.equal(payload.source, 'browse_catalog_known_good');
  assert.equal(payload.delaySec, 45);
  assert.equal(payload.songs.length, 2);
  assert.deepEqual(payload.songs[0], {
    title: 'Sweet Caroline',
    artist: 'Neil Diamond',
    browseSongKey: 'sweet caroline__neil diamond',
    hasApprovedBacking: true,
  });

  const manual = buildDeadAirFillerPayload({ assistLevel: 'manual_first', delaySec: 1 });
  assert.equal(manual.enabled, false);
  assert.equal(manual.mode, 'off');
  assert.equal(manual.delaySec, 2);
});

test('deadAirAutopilot only queues filler when the room is idle and explicitly in autopilot mode', () => {
  const base = {
    roomCode: 'ROOM42',
    deadAirFiller: {
      enabled: true,
      mode: 'auto_fill',
      delaySec: 8,
      songs: [{ title: 'Uptown Funk', artist: 'Bruno Mars' }],
    },
    autoDjEnabled: true,
    queuedCount: 0,
    performingCount: 0,
    activeMode: 'karaoke',
    songs: [],
    lastPerformanceTs: 1234,
  };

  const ready = getDeadAirAutoFillIntent(base);
  assert.equal(ready.shouldQueue, true);
  assert.equal(ready.reason, 'ready');
  assert.equal(ready.song.title, 'Uptown Funk');
  assert.equal(ready.delayMs, 8000);

  assert.equal(getDeadAirAutoFillIntent({ ...base, deadAirFiller: { enabled: true, mode: 'suggest' } }).reason, 'not_autopilot');
  assert.equal(getDeadAirAutoFillIntent({ ...base, autoDjEnabled: false }).reason, 'auto_dj_off');
  assert.equal(getDeadAirAutoFillIntent({ ...base, queuedCount: 1 }).reason, 'queue_busy');
  assert.equal(getDeadAirAutoFillIntent({ ...base, performingCount: 1 }).reason, 'queue_busy');
  assert.equal(getDeadAirAutoFillIntent({ ...base, activeMode: 'bingo' }).reason, 'mode_busy');
  assert.equal(getDeadAirAutoFillIntent({ ...base, runOfShowEnabled: true, programMode: 'run_of_show' }).reason, 'run_of_show_active');
});

test('deadAirAutopilot skips duplicate filler songs and repeated idle windows', () => {
  const base = {
    roomCode: 'ROOM42',
    deadAirFiller: {
      enabled: true,
      mode: 'auto_fill',
      songs: [
        { title: 'Uptown Funk', artist: 'Bruno Mars' },
        { title: 'Sweet Caroline', artist: 'Neil Diamond' },
      ],
    },
    autoDjEnabled: true,
    activeMode: 'karaoke',
    songs: [{ songTitle: 'Uptown Funk', artist: 'Bruno Mars' }],
    lastPerformanceTs: 5000,
  };

  const first = getDeadAirAutoFillIntent(base);
  assert.equal(first.shouldQueue, true);
  assert.equal(first.song.title, 'Sweet Caroline');

  const repeated = getDeadAirAutoFillIntent({
    ...base,
    previousFillKey: first.fillKey,
  });
  assert.equal(repeated.shouldQueue, false);
  assert.equal(repeated.reason, 'already_queued');

  const exhausted = getDeadAirAutoFillIntent({
    ...base,
    songs: [
      { songTitle: 'Uptown Funk', artist: 'Bruno Mars' },
      { songTitle: 'Sweet Caroline', artist: 'Neil Diamond' },
    ],
  });
  assert.equal(exhausted.reason, 'no_song');
});

test('deadAirAutopilot identifies autofill queue entries by automation source', () => {
  assert.equal(
    isDeadAirAutoFillQueueItem({ automationSource: DEAD_AIR_AUTOFILL_SOURCE }),
    true
  );
  assert.equal(
    isDeadAirAutoFillQueueItem({ automationSource: 'manual_queue' }),
    false
  );
  assert.equal(
    isDeadAirAutoFillQueueItem({}),
    false
  );
});
