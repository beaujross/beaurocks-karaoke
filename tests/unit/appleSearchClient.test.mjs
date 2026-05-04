import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('searchAppleCatalog tracks successful and empty Apple searches', async () => {
  const callFunction = vi.fn()
    .mockResolvedValueOnce({
      results: [{ trackId: '1', trackName: 'Song', artistName: 'Artist' }],
    })
    .mockResolvedValueOnce({
      results: [],
    });
  vi.doMock('../../src/lib/firebase.js', () => ({
    callFunction,
  }));

  const {
    getAppleSearchTelemetrySnapshot,
    searchAppleCatalog,
  } = await import('../../src/lib/appleSearchClient.js');

  await searchAppleCatalog({ term: 'Flowers', roomCode: 'ROOM1', usageSource: 'test_apple' });
  await searchAppleCatalog({ term: 'No results', roomCode: 'ROOM1', usageSource: 'test_apple' });

  const telemetry = getAppleSearchTelemetrySnapshot();
  assert.equal(telemetry.recentSearches, 2);
  assert.equal(telemetry.successes, 2);
  assert.equal(telemetry.emptyResults, 1);
  assert.equal(telemetry.failures, 0);
});

test('searchAppleCatalog tracks failures', async () => {
  const callFunction = vi.fn(async () => {
    throw new Error('Apple lookup failed');
  });
  vi.doMock('../../src/lib/firebase.js', () => ({
    callFunction,
  }));

  const {
    getAppleSearchTelemetrySnapshot,
    searchAppleCatalog,
  } = await import('../../src/lib/appleSearchClient.js');

  await assert.rejects(() => searchAppleCatalog({ term: 'Fail me', roomCode: 'ROOM1', usageSource: 'test_apple' }));
  const telemetry = getAppleSearchTelemetrySnapshot();
  assert.equal(telemetry.recentSearches, 1);
  assert.equal(telemetry.failures, 1);
  assert.equal(telemetry.failurePct, 100);
});
