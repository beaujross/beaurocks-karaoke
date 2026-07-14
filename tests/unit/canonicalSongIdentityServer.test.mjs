import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const { followCanonicalSongRedirect } = require('../../functions/lib/canonicalSongIdentity.js');

test('canonical identity follows bounded merge redirects', async () => {
  const songs = new Map([
    ['remaster', { mergedIntoSongId: 'canonical' }],
    ['canonical', { title: 'Song' }],
  ]);
  const result = await followCanonicalSongRedirect({
    initialSongId: 'remaster',
    loadSongData: async (songId) => songs.get(songId) || null,
  });
  assert.equal(result.songId, 'canonical');
  assert.equal(result.redirected, true);
});

test('canonical identity rejects redirect cycles', async () => {
  const songs = new Map([
    ['a', { mergedIntoSongId: 'b' }],
    ['b', { mergedIntoSongId: 'a' }],
  ]);
  const result = await followCanonicalSongRedirect({
    initialSongId: 'a',
    loadSongData: async (songId) => songs.get(songId) || null,
  });
  assert.equal(result, null);
});
