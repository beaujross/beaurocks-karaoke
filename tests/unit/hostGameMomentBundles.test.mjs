import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  HOST_GAME_MOMENT_BUNDLE_IDS,
  filterGamesForHostMomentBundle,
  getHostGameMomentBundle,
  getHostGameMomentBundleId,
  summarizeHostGameMomentBundles,
} from '../../src/lib/hostGameMomentBundles.js';

const games = [
  { id: 'trivia_pop' },
  { id: 'bingo' },
  { id: 'vocal_challenge' },
  { id: 'selfie_challenge' },
  { id: 'applause_countdown' },
];

test('host game bundles classify modes by lifecycle instead of UI category', () => {
  assert.equal(getHostGameMomentBundleId('trivia_pop'), HOST_GAME_MOMENT_BUNDLE_IDS.betweenSongs);
  assert.equal(getHostGameMomentBundleId('selfie_challenge'), HOST_GAME_MOMENT_BUNDLE_IDS.betweenSongs);
  assert.equal(getHostGameMomentBundleId('bingo'), HOST_GAME_MOMENT_BUNDLE_IDS.alongsideKaraoke);
  assert.equal(getHostGameMomentBundleId('vocal_challenge'), HOST_GAME_MOMENT_BUNDLE_IDS.fullScreenRounds);
  assert.equal(getHostGameMomentBundleId('unknown'), '');
  assert.equal(getHostGameMomentBundleId('applause_countdown'), HOST_GAME_MOMENT_BUNDLE_IDS.betweenSongs);
});

test('host game bundle filters keep every established payload unchanged', () => {
  assert.deepEqual(
    filterGamesForHostMomentBundle(games, HOST_GAME_MOMENT_BUNDLE_IDS.betweenSongs),
    [games[0], games[3], games[4]],
  );
  assert.deepEqual(
    filterGamesForHostMomentBundle(games, HOST_GAME_MOMENT_BUNDLE_IDS.alongsideKaraoke),
    [games[1]],
  );
  assert.deepEqual(
    filterGamesForHostMomentBundle(games, HOST_GAME_MOMENT_BUNDLE_IDS.fullScreenRounds),
    [games[2]],
  );
});

test('bundle summaries expose stable Host labels and mode counts', () => {
  const summaries = summarizeHostGameMomentBundles(games);
  assert.deepEqual(summaries.map(({ id, modeCount }) => ({ id, modeCount })), [
    { id: HOST_GAME_MOMENT_BUNDLE_IDS.betweenSongs, modeCount: 3 },
    { id: HOST_GAME_MOMENT_BUNDLE_IDS.alongsideKaraoke, modeCount: 1 },
    { id: HOST_GAME_MOMENT_BUNDLE_IDS.fullScreenRounds, modeCount: 1 },
  ]);
  assert.equal(getHostGameMomentBundle('missing').id, HOST_GAME_MOMENT_BUNDLE_IDS.betweenSongs);
});
