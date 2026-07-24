import { describe, expect, it } from 'vitest';
import {
  buildConnectedDeadAirSongs,
  normalizeAppleMusicPlaylistTracks,
} from '../../src/apps/Host/deadAirMediaCatalog.js';

describe('connected dead-air media catalog', () => {
  it('combines playable local, Apple Music, and cached YouTube candidates', () => {
    const songs = buildConnectedDeadAirSongs({
      localItems: [{
        id: 'local-1',
        title: 'Offline Singalong',
        artist: 'Host Library',
        mediaUrl: 'blob:offline-singalong',
        mediaType: 'video',
        offlineReady: true,
      }],
      appleMusicTracks: [{
        id: 'apple-1',
        type: 'songs',
        attributes: {
          name: 'Apple Party Track',
          artistName: 'Apple Artist',
          durationInMillis: 201000,
          url: 'https://music.apple.com/us/song/apple-1',
          playParams: { id: 'apple-1', isPlayable: true },
        },
      }],
      cachedYouTubeSongs: [{
        videoId: 'abcdefghijk',
        title: 'Cached Karaoke',
        artist: 'Karaoke Channel',
        mediaUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
        trackSource: 'youtube',
        score: 500,
      }],
    });

    expect(songs.map((song) => song.trackSource)).toEqual(['local', 'apple', 'youtube']);
    expect(songs[0].sourceLabel).toBe('Offline local library');
    expect(songs[1].backing.appleMusicId).toBe('apple-1');
    expect(songs[1].durationSec).toBe(201);
  });

  it('excludes images, unavailable Apple tracks, and disabled providers', () => {
    const songs = buildConnectedDeadAirSongs({
      localItems: [{
        id: 'image-1',
        title: 'Poster',
        mediaUrl: 'https://example.com/poster.png',
        mediaType: 'image',
      }],
      appleMusicTracks: [{
        id: 'apple-blocked',
        attributes: {
          name: 'Unavailable',
          playParams: { id: 'apple-blocked', isPlayable: false },
        },
      }],
      cachedYouTubeSongs: [{
        videoId: 'abcdefghijk',
        title: 'Cached Karaoke',
        mediaUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
        trackSource: 'youtube',
        score: 500,
      }],
      includeYouTube: false,
    });

    expect(songs).toEqual([]);
  });

  it('normalizes Apple playlist relationship records into approved backings', () => {
    const tracks = normalizeAppleMusicPlaylistTracks([{
      id: 'library-song-id',
      type: 'library-songs',
      attributes: {
        name: 'Library Song',
        artistName: 'Library Artist',
        playParams: {
          id: 'library-song-id',
          catalogId: 'catalog-song-id',
        },
      },
    }]);

    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      title: 'Library Song',
      artist: 'Library Artist',
      appleMusicId: 'catalog-song-id',
      trackSource: 'apple',
      approved: true,
      playable: true,
    });
  });
});
