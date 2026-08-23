import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  APPLE_MUSIC_AUTOMATIC_RETRY_COOLDOWN_MS,
  buildAppleMusicPlaylistQueueAttempts,
  buildAppleMusicPlaylistStartKey,
  isAppleMusicAutomaticRetryCoolingDown,
  parseAppleMusicPlaylistId,
  quiesceAppleMusicTransport,
} from '../../src/lib/appleMusicPlaylistPlayback.js';

describe('Apple Music playlist playback planning', () => {
  test('extracts catalog and personal-library playlist ids from URLs', () => {
    assert.equal(
      parseAppleMusicPlaylistId('https://music.apple.com/us/playlist/example/pl.abc-123'),
      'pl.abc-123',
    );
    assert.equal(
      parseAppleMusicPlaylistId('https://music.apple.com/library/playlist/p.XyZ_987'),
      'p.XyZ_987',
    );
    assert.equal(
      parseAppleMusicPlaylistId('https://music.apple.com/us/station/apple-music-1/ra.978194965'),
      'ra.978194965',
    );
  });

  test('queues a personal-library id with the MusicKit playlist option', () => {
    assert.deepEqual(
      buildAppleMusicPlaylistQueueAttempts('p.personal123', { sourceType: 'library_playlist' }),
      [{ playlist: 'p.personal123' }],
    );
  });

  test('queues a catalog id with the same MusicKit playlist option', () => {
    assert.deepEqual(
      buildAppleMusicPlaylistQueueAttempts('pl.catalog123', { sourceType: 'catalog_playlist' }),
      [{ playlist: 'pl.catalog123' }],
    );
  });

  test('queues a station only through the Apple-provided content URL', () => {
    assert.deepEqual(
      buildAppleMusicPlaylistQueueAttempts('ra.978194965', {
        sourceType: 'catalog_station',
        playbackUrl: 'https://music.apple.com/us/station/apple-music-1/ra.978194965',
      }),
      [{ url: 'https://music.apple.com/us/station/apple-music-1/ra.978194965' }],
    );
    assert.deepEqual(
      buildAppleMusicPlaylistQueueAttempts('ra.978194965', { sourceType: 'catalog_station' }),
      [],
    );
  });

  test('prefers a personal-library playlist id before catalog fallbacks', () => {
    assert.deepEqual(
      buildAppleMusicPlaylistQueueAttempts('p.personal123', {
        sourceType: 'library_playlist',
        playbackId: 'pl.global123',
        catalogId: 'pl.global123',
        playParamsId: 'p.personal123',
      }),
      [
        { playlist: 'p.personal123' },
        { playlist: 'pl.global123' },
      ],
    );
  });

  test('does not invent an unsupported libraryPlaylist option for opaque ids', () => {
    assert.deepEqual(
      buildAppleMusicPlaylistQueueAttempts('legacy-id', { sourceType: 'library_playlist' }),
      [{ playlist: 'legacy-id' }],
    );
  });

  test('recognizes an automatic retry cooldown for the same playback plan only', () => {
    const key = buildAppleMusicPlaylistStartKey('p.personal123', { sourceType: 'library_playlist' });
    const failedAtMs = 50_000;
    assert.equal(isAppleMusicAutomaticRetryCoolingDown(
      { key, failedAtMs },
      key,
      failedAtMs + APPLE_MUSIC_AUTOMATIC_RETRY_COOLDOWN_MS - 1,
    ), true);
    assert.equal(isAppleMusicAutomaticRetryCoolingDown(
      { key, failedAtMs },
      key,
      failedAtMs + APPLE_MUSIC_AUTOMATIC_RETRY_COOLDOWN_MS,
    ), false);
    assert.equal(isAppleMusicAutomaticRetryCoolingDown(
      { key: 'another-playlist', failedAtMs },
      key,
      failedAtMs + 1,
    ), false);
  });

  test('quiesces an existing MusicKit transport before replacing its queue', async () => {
    const calls = [];
    const method = await quiesceAppleMusicTransport({
      stop: async () => calls.push('stop'),
      pause: async () => calls.push('pause'),
    });
    assert.equal(method, 'stop');
    assert.deepEqual(calls, ['stop']);
  });

  test('falls back to pause when MusicKit rejects stop', async () => {
    const calls = [];
    const method = await quiesceAppleMusicTransport({
      stop: async () => {
        calls.push('stop');
        throw new Error('not stoppable');
      },
      pause: async () => calls.push('pause'),
    });
    assert.equal(method, 'pause');
    assert.deepEqual(calls, ['stop', 'pause']);
  });
});
