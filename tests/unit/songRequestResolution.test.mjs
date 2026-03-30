import { describe, expect, it } from 'vitest';

import {
  buildCollaborationSuggestionMap,
  buildTrustedCatalogEntry,
  rankSongRequestCandidates
} from '../../src/lib/songRequestResolution.js';

describe('songRequestResolution', () => {
it('prefers host favorite over room recent and yt index', () => {
  const ranked = rankSongRequestCandidates({
    request: {
      songId: 'shallow__lady gaga',
      songTitle: 'Shallow',
      artist: 'Lady Gaga'
    },
    trustedCatalogEntry: {
      songId: 'shallow__lady gaga',
      title: 'Shallow',
      artist: 'Lady Gaga',
      hostFavoriteTrackId: 'track_host',
      hostFavoriteMediaUrl: 'https://youtube.com/watch?v=hostfav',
      hostFavoriteSource: 'youtube',
      hostFavoriteLabel: 'Host favorite',
      hostFavoriteApprovalState: 'approved',
      roomRecentTrackId: 'track_room',
      roomRecentMediaUrl: 'https://youtube.com/watch?v=roomrecent',
      roomRecentSource: 'youtube',
      roomRecentLabel: 'Room recent'
    },
    ytIndex: [
      {
        videoId: 'yt123',
        trackName: 'Shallow Karaoke',
        artistName: 'Lady Gaga',
        url: 'https://youtube.com/watch?v=yt123',
        playable: true
      }
    ]
  });

  expect(ranked[0]?.trackId).toBe('track_host');
  expect(ranked[0]?.layer).toBe('host_favorite');
  expect(ranked.some((entry) => entry.trackId === 'track_room')).toBe(true);
});

it('increments room recent usage and success', () => {
  const next = buildTrustedCatalogEntry({
    existing: {
      songId: 'flowers__miley cyrus',
      roomRecentUsageCount: 2,
      roomRecentSuccessCount: 1
    },
    songId: 'flowers__miley cyrus',
    title: 'Flowers',
    artist: 'Miley Cyrus',
    trackId: 'track_123',
    mediaUrl: 'https://youtube.com/watch?v=flowers',
    source: 'youtube',
    layer: 'room_recent',
    nowMs: 1234
  });

  expect(next.roomRecentTrackId).toBe('track_123');
  expect(next.roomRecentUsageCount).toBe(3);
  expect(next.roomRecentSuccessCount).toBe(2);
  expect(next.updatedAtMs).toBe(1234);
});

it('only pairs opted-in singers on the same canonical song', () => {
  const suggestions = buildCollaborationSuggestionMap({
    songs: [
      {
        id: 'request_a',
        songId: 'shallow__lady gaga',
        songTitle: 'Shallow',
        artist: 'Lady Gaga',
        singerUid: 'u_a',
        singerName: 'Alex',
        collabOpen: true,
        status: 'requested',
        resolutionStatus: 'review_required'
      },
      {
        id: 'request_b',
        songId: 'shallow__lady gaga',
        songTitle: 'Shallow',
        artist: 'Lady Gaga',
        singerUid: 'u_b',
        singerName: 'Blair',
        collabOpen: true,
        status: 'requested',
        resolutionStatus: 'review_required'
      },
      {
        id: 'request_c',
        songId: 'flowers__miley cyrus',
        songTitle: 'Flowers',
        artist: 'Miley Cyrus',
        singerUid: 'u_c',
        singerName: 'Casey',
        collabOpen: true,
        status: 'requested',
        resolutionStatus: 'review_required'
      }
    ],
    users: [
      {
        uid: 'u_a',
        tight15Temp: [{ songTitle: 'Shallow', artist: 'Lady Gaga' }]
      },
      {
        uid: 'u_b',
        tight15Temp: [{ songTitle: 'Shallow', artist: 'Lady Gaga' }]
      }
    ]
  });

  expect(Array.isArray(suggestions.request_a)).toBe(true);
  expect(suggestions.request_a.length).toBe(1);
  expect(suggestions.request_a[0].requestId).toBe('request_b');
  expect(suggestions.request_a[0].tight15Overlap).toBe(true);
  expect(Boolean(suggestions.request_c)).toBe(false);
});
});
