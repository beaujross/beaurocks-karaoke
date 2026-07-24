import { describe, expect, it } from 'vitest';
import { buildCachedYouTubeDeadAirSongs } from '../../src/apps/Host/deadAirYouTubeCatalog.js';

describe('cached YouTube dead-air catalog', () => {
  it('uses playable cached YouTube entries and excludes local or blocked media', () => {
    const songs = buildCachedYouTubeDeadAirSongs({
      roomIndex: [
        {
          videoId: 'abc123def45',
          trackName: 'Room Favorite',
          artistName: 'Singer One',
          url: 'https://www.youtube.com/watch?v=abc123def45',
          playable: true,
          embeddable: true,
          successCount: 4,
        },
        {
          videoId: 'blocked12345',
          trackName: 'Blocked Track',
          url: 'https://www.youtube.com/watch?v=blocked12345',
          playable: false,
        },
      ],
      globalIndex: [
        {
          videoId: 'xyz987uvw65',
          trackName: 'Global Pick',
          artistName: 'Singer Two',
          playable: true,
          embeddable: true,
          usageCount: 2,
        },
      ],
    });

    expect(songs).toHaveLength(2);
    expect(songs[0]).toMatchObject({
      title: 'Room Favorite',
      sourceLabel: 'Cached YouTube catalog',
      trackSource: 'youtube',
      approved: true,
    });
    expect(songs.every((song) => song.mediaUrl.includes('youtube.com/watch'))).toBe(true);
    expect(songs.some((song) => song.title === 'Blocked Track')).toBe(false);
  });

  it('deduplicates a video across room, account, global, and curated caches', () => {
    const duplicate = {
      videoId: 'abc123def45',
      trackName: 'Same Song',
      playable: true,
      embeddable: true,
    };
    const songs = buildCachedYouTubeDeadAirSongs({
      roomIndex: [{ ...duplicate, successCount: 2 }],
      accountIndex: [{ ...duplicate, usageCount: 1 }],
      globalIndex: [duplicate],
      curatedIndex: [duplicate],
    });

    expect(songs).toHaveLength(1);
  });
});
