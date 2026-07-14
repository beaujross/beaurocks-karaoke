import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  APPLE_MUSIC_AUTOMATIC_RETRY_COOLDOWN_MS,
  buildAppleMusicPlaylistQueueAttempts,
  buildAppleMusicPlaylistStartKey,
  isAppleMusicAutomaticRetryCoolingDown,
  parseAppleMusicPlaylistId,
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

  test('prefers a library playlist catalog/global playback id when Apple supplies one', () => {
    assert.deepEqual(
      buildAppleMusicPlaylistQueueAttempts('p.personal123', {
        sourceType: 'library_playlist',
        playbackId: 'pl.global123',
        catalogId: 'pl.global123',
        playParamsId: 'p.personal123',
      }),
      [
        { playlist: 'pl.global123' },
        { playlist: 'p.personal123' },
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
});
