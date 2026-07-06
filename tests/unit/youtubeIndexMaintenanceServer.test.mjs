import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const {
  YOUTUBE_INDEX_RETENTION_MS,
  applyYouTubeIndexRefreshResults,
  planYouTubeIndexRefresh,
} = require('../../functions/lib/youtubeIndexMaintenance.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_NOW = Date.UTC(2026, 6, 6, 12, 0, 0);

const entry = (overrides = {}) => ({
  videoId: overrides.videoId || 'video123',
  trackName: overrides.trackName || 'Known Song',
  artistName: overrides.artistName || 'Known Channel',
  url: `https://www.youtube.com/watch?v=${overrides.videoId || 'video123'}`,
  lastValidatedAtMs: BASE_NOW - (29 * DAY_MS),
  expiresAtMs: BASE_NOW + DAY_MS,
  playable: true,
  embeddable: true,
  ...overrides,
});

test('functions YouTube index maintenance plans stale high-value refresh ids', () => {
  const plan = planYouTubeIndexRefresh({
    atMs: BASE_NOW,
    maxIds: 2,
    entries: [
      entry({ videoId: 'low', usageCount: 0 }),
      entry({ videoId: 'favorite', usageCount: 5, successCount: 4, rankingScore: 140 }),
      entry({ videoId: 'fresh', lastValidatedAtMs: BASE_NOW - DAY_MS, expiresAtMs: BASE_NOW + (20 * DAY_MS) }),
    ],
  });

  assert.deepEqual(plan.ids, ['favorite', 'low']);
  assert.equal(plan.reason, 'selected');
});

test('functions YouTube index maintenance applies playable refreshes and drops unplayable ids', () => {
  const result = applyYouTubeIndexRefreshResults({
    atMs: BASE_NOW,
    refreshIds: ['keep123', 'drop123'],
    entries: [
      entry({ videoId: 'keep123', trackName: 'Old Title' }),
      entry({ videoId: 'drop123', trackName: 'Gone' }),
      entry({ videoId: 'untouched', expiresAtMs: BASE_NOW + (10 * DAY_MS) }),
    ],
    refreshedItems: [
      {
        id: 'keep123',
        snippet: {
          title: 'Fresh Title',
          channelTitle: 'Fresh Channel',
          thumbnails: { default: { url: 'https://img.example/default.jpg' } },
        },
        status: { embeddable: true, uploadStatus: 'processed', privacyStatus: 'public' },
      },
      {
        id: 'drop123',
        snippet: { title: 'Blocked Title', channelTitle: 'Blocked Channel' },
        status: { embeddable: false, uploadStatus: 'processed', privacyStatus: 'public' },
      },
    ],
  });

  assert.equal(result.refreshedCount, 1);
  assert.equal(result.removedCount, 1);
  assert.deepEqual(result.entries.map((item) => item.videoId), ['keep123', 'untouched']);
  assert.equal(result.entries[0].trackName, 'Fresh Title');
  assert.equal(result.entries[0].artistName, 'Fresh Channel');
  assert.equal(result.entries[0].youtubePlaybackStatus, 'embeddable');
  assert.equal(result.entries[0].expiresAtMs, BASE_NOW + YOUTUBE_INDEX_RETENTION_MS);
});

test('nightly YouTube index cleanup is wired to bounded backend refresh planning', () => {
  const source = readFileSync(new URL('../../functions/index.js', import.meta.url), 'utf8');

  assert.match(source, /planYouTubeIndexRefreshForAdmin\(\{/);
  assert.match(source, /applyYouTubeIndexRefreshResults\(\{/);
  assert.match(source, /NIGHTLY_YOUTUBE_INDEX_REFRESH_MAX_LIBRARIES = 10/);
  assert.match(source, /NIGHTLY_YOUTUBE_INDEX_REFRESH_IDS_PER_LIBRARY = 12/);
  assert.match(source, /secrets: \[YOUTUBE_API_KEY\]/);
});

test('nightly YouTube index cleanup backfills canonical candidates without live search', () => {
  const source = readFileSync(new URL('../../functions/index.js', import.meta.url), 'utf8');

  assert.match(source, /buildCanonicalBackingCandidatePatchFromYouTubeIndexEntry\(\{/);
  assert.match(source, /NIGHTLY_YOUTUBE_INDEX_BACKFILL_MAX_LIBRARIES = 10/);
  assert.match(source, /NIGHTLY_YOUTUBE_INDEX_BACKFILL_CANDIDATES_PER_LIBRARY = 20/);
  assert.match(source, /sourceDiscovery: entry\.sourceDiscovery \|\| "idle_refresh"/);
  assert.match(source, /sourceRoomCodes: admin\.firestore\.FieldValue\.arrayUnion\(docSnap\.id\)/);
  assert.match(source, /backfilledCandidates/);
});

