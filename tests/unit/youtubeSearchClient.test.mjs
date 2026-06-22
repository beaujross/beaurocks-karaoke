import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';

const buildLocalStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
};

beforeEach(() => {
  vi.resetModules();
  global.window = {
    localStorage: buildLocalStorage(),
  };
});

afterEach(() => {
  delete global.window;
  vi.restoreAllMocks();
});

test('searchYouTubeCatalog caches successful client searches', async () => {
  const callFunction = vi.fn(async () => ({
    items: [{ id: 'abc123', title: 'Song', channelTitle: 'Channel', thumbnails: {} }],
    cached: false,
  }));
  vi.doMock('../../src/lib/firebase.js', () => ({
    callFunction,
  }));

  const {
    getYouTubeSearchTelemetrySnapshot,
    searchYouTubeCatalog,
  } = await import('../../src/lib/youtubeSearchClient.js');

  const first = await searchYouTubeCatalog({
    query: 'Flowers karaoke',
    usageSource: 'test_search',
    usageSurface: 'host',
  });
  const second = await searchYouTubeCatalog({
    query: 'Flowers karaoke',
    usageSource: 'test_search',
    usageSurface: 'host',
  });

  assert.equal(first.items.length, 1);
  assert.equal(second.items.length, 1);
  assert.equal(second.cacheLayer, 'client');
  assert.equal(callFunction.mock.calls.length, 1);
  const telemetry = getYouTubeSearchTelemetrySnapshot();
  assert.equal(telemetry.recentSearches, 2);
  assert.equal(telemetry.liveCalls, 1);
  assert.equal(telemetry.clientCacheHits, 1);
  assert.equal(telemetry.cacheHitPct, 50);
  assert.equal(telemetry.todayLiveCalls, 1);
  assert.equal(telemetry.todayClientCacheHits, 1);
  assert.equal(telemetry.dailySearchListCallLimit, 100);
  assert.equal(telemetry.dailyGeneralDataUnitLimit, 10000);
  assert.equal(telemetry.estimatedSearchListCallsPerLiveSearch, 1);
  assert.equal(telemetry.estimatedGeneralUnitsPerLiveSearch, 1);
  assert.equal(telemetry.todaySearchListCallsUsed, 1);
  assert.equal(telemetry.todaySearchListCallsRemaining, 99);
  assert.equal(telemetry.todayGeneralDataUnitsUsed, 1);
  assert.equal(telemetry.todayGeneralDataUnitsRemaining, 9999);
  assert.equal(telemetry.todayEstimatedUnitsUsed, 1);
  assert.equal(telemetry.todayEstimatedFreshSearchesLeft, 99);
});

test('searchYouTubeCatalog blocks repeated live calls after quota exhaustion', async () => {
  const quotaError = Object.assign(new Error('YouTube API quota exhausted.'), {
    code: 'resource-exhausted',
  });
  const callFunction = vi.fn(async () => {
    throw quotaError;
  });
  vi.doMock('../../src/lib/firebase.js', () => ({
    callFunction,
  }));

  const {
    getYouTubeQuotaBlockedUntilMs,
    getYouTubeSearchTelemetrySnapshot,
    isYouTubeQuotaBlockedError,
    searchYouTubeCatalog,
  } = await import('../../src/lib/youtubeSearchClient.js');

  await assert.rejects(
    () => searchYouTubeCatalog({
      query: 'Levitating karaoke',
      usageSource: 'test_search',
      usageSurface: 'host',
    }),
    (error) => {
      assert.equal(isYouTubeQuotaBlockedError(error), true);
      return true;
    }
  );

  assert.ok(getYouTubeQuotaBlockedUntilMs() > Date.now());

  await assert.rejects(
    () => searchYouTubeCatalog({
      query: 'Levitating karaoke',
      usageSource: 'test_search',
      usageSurface: 'host',
    }),
    (error) => {
      assert.equal(isYouTubeQuotaBlockedError(error), true);
      return true;
    }
  );

  assert.equal(callFunction.mock.calls.length, 1);
  const telemetry = getYouTubeSearchTelemetrySnapshot();
  assert.equal(telemetry.recentSearches, 2);
  assert.equal(telemetry.quotaErrors, 1);
  assert.equal(telemetry.quotaShortCircuits, 1);
});

test('searchYouTubeCatalog tracks durable server cache hits separately from live calls', async () => {
  const callFunction = vi.fn(async () => ({
    items: [{ id: 'srv123', title: 'Song', channelTitle: 'Channel', thumbnails: {} }],
    cached: true,
  }));
  vi.doMock('../../src/lib/firebase.js', () => ({
    callFunction,
  }));

  const {
    getYouTubeSearchTelemetrySnapshot,
    searchYouTubeCatalog,
  } = await import('../../src/lib/youtubeSearchClient.js');

  const result = await searchYouTubeCatalog({
    query: 'Espresso karaoke',
    usageSource: 'test_search',
    usageSurface: 'host',
  });

  assert.equal(result.cached, true);
  const telemetry = getYouTubeSearchTelemetrySnapshot();
  assert.equal(telemetry.recentSearches, 1);
  assert.equal(telemetry.serverCacheHits, 1);
  assert.equal(telemetry.liveCalls, 0);
});

test('searchYouTubeCatalog reuses client cache for semantically equivalent karaoke queries', async () => {
  const callFunction = vi.fn(async () => ({
    items: [{ id: 'same123', title: 'Valerie Karaoke', channelTitle: 'Channel', thumbnails: {} }],
    cached: false,
  }));
  vi.doMock('../../src/lib/firebase.js', () => ({
    callFunction,
  }));

  const {
    getYouTubeSearchTelemetrySnapshot,
    searchYouTubeCatalog,
  } = await import('../../src/lib/youtubeSearchClient.js');

  const first = await searchYouTubeCatalog({
    query: 'Valerie Amy Winehouse karaoke',
    usageSource: 'test_search',
    usageSurface: 'host',
  });
  const second = await searchYouTubeCatalog({
    query: 'Amy Winehouse - Valerie official karaoke',
    usageSource: 'test_search',
    usageSurface: 'host',
  });

  assert.equal(first.items[0]?.id, 'same123');
  assert.equal(second.items[0]?.id, 'same123');
  assert.equal(second.cacheLayer, 'client');
  assert.equal(callFunction.mock.calls.length, 1);
  const telemetry = getYouTubeSearchTelemetrySnapshot();
  assert.equal(telemetry.recentSearches, 2);
  assert.equal(telemetry.liveCalls, 1);
  assert.equal(telemetry.clientCacheHits, 1);
});
