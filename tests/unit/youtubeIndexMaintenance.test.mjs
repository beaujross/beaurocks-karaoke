import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  YOUTUBE_INDEX_RETENTION_MS,
  isYtIndexEntryExpired,
  planYouTubeIndexRefresh,
  shouldHoldYouTubeIndexMaintenanceForReserve,
  shouldRefreshYtIndexEntry,
} from '../../src/lib/youtubeIndexMaintenance.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_NOW = Date.UTC(2026, 6, 6, 12, 0, 0);

const entry = (overrides = {}) => ({
  videoId: overrides.videoId || 'video123',
  lastValidatedAtMs: BASE_NOW - (10 * DAY_MS),
  expiresAtMs: BASE_NOW + (20 * DAY_MS),
  usageCount: 0,
  successCount: 0,
  failureCount: 0,
  playable: true,
  ...overrides,
});

test('YouTube index maintenance refreshes entries near expiry, not fresh entries', () => {
  const fresh = entry({ videoId: 'fresh', lastValidatedAtMs: BASE_NOW - DAY_MS, expiresAtMs: BASE_NOW + (20 * DAY_MS) });
  const stale = entry({ videoId: 'stale', lastValidatedAtMs: BASE_NOW - (29 * DAY_MS), expiresAtMs: BASE_NOW + DAY_MS });

  assert.equal(shouldRefreshYtIndexEntry(fresh, BASE_NOW), false);
  assert.equal(shouldRefreshYtIndexEntry(stale, BASE_NOW), true);
  assert.equal(isYtIndexEntryExpired(entry({ expiresAtMs: BASE_NOW - 1 }), BASE_NOW), true);
});

test('YouTube index maintenance prioritizes high-value backing tracks and caps batches', () => {
  const plan = planYouTubeIndexRefresh({
    atMs: BASE_NOW,
    maxIds: 2,
    entries: [
      entry({ videoId: 'low', expiresAtMs: BASE_NOW + DAY_MS, usageCount: 0, successCount: 0 }),
      entry({ videoId: 'favorite', expiresAtMs: BASE_NOW + DAY_MS, usageCount: 6, successCount: 4, rankingScore: 130 }),
      entry({ videoId: 'failed', expiresAtMs: BASE_NOW + DAY_MS, usageCount: 5, failureCount: 6 }),
    ],
  });

  assert.deepEqual(plan.ids, ['favorite', 'low']);
  assert.equal(plan.candidates.length, 3);
  assert.equal(plan.heldForReserve, false);
});

test('YouTube index maintenance preserves event-day search reserve', () => {
  assert.equal(shouldHoldYouTubeIndexMaintenanceForReserve({
    telemetry: { todayEstimatedFreshSearchesLeft: 25 },
    eventReserveSearches: 25,
  }), true);

  const plan = planYouTubeIndexRefresh({
    atMs: BASE_NOW,
    entries: [entry({ videoId: 'stale', expiresAtMs: BASE_NOW + DAY_MS })],
    telemetry: { todayEstimatedFreshSearchesLeft: 12 },
    eventReserveSearches: 25,
  });

  assert.deepEqual(plan.ids, []);
  assert.equal(plan.heldForReserve, true);
  assert.equal(plan.reason, 'event_reserve');
});

test('YouTube index maintenance can derive expiry from validation time', () => {
  const lastValidatedAtMs = BASE_NOW - (29 * DAY_MS);
  const candidate = entry({ videoId: 'derived', lastValidatedAtMs, expiresAtMs: 0 });

  assert.equal(shouldRefreshYtIndexEntry(candidate, BASE_NOW), true);
  assert.equal(lastValidatedAtMs + YOUTUBE_INDEX_RETENTION_MS, BASE_NOW + DAY_MS);
});