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

it('persists canonical backing ranking metadata on trusted catalog entries', () => {
  const next = buildTrustedCatalogEntry({
    songId: 'flowers__miley cyrus',
    title: 'Flowers',
    artist: 'Miley Cyrus',
    trackId: 'track_123',
    mediaUrl: 'https://youtube.com/watch?v=flowers',
    source: 'youtube',
    layer: 'host_favorite',
    rankingScore: 118,
    backingCandidateId: 'flowers__youtube__flowers',
    canonicalSongId: 'apple:144000',
    backingTelemetry: { hostUpvotes: 2, hostDownvotes: 0 },
    nowMs: 1234
  });

  expect(next.hostFavoriteRankingScore).toBe(118);
  expect(next.hostFavoriteBackingCandidateId).toBe('flowers__youtube__flowers');
  expect(next.hostFavoriteCanonicalSongId).toBe('apple:144000');
  expect(next.hostFavoriteBackingTelemetry).toEqual({ hostUpvotes: 2, hostDownvotes: 0 });
});

it('uses backing ranking score as a resolver signal for equivalent catalog candidates', () => {
  const ranked = rankSongRequestCandidates({
    request: {
      songId: 'flowers__miley cyrus',
      songTitle: 'Flowers',
      artist: 'Miley Cyrus'
    },
    catalogCandidates: [
      {
        trackId: 'generic_pick',
        mediaUrl: 'https://youtube.com/watch?v=generic_pick',
        source: 'youtube',
        title: 'Flowers Karaoke',
        artist: 'Miley Cyrus',
        layer: 'global_catalog',
        qualityScore: 30,
        rankingScore: 55
      },
      {
        trackId: 'host_ranked_pick',
        mediaUrl: 'https://youtube.com/watch?v=host_ranked_pick',
        source: 'youtube',
        title: 'Flowers Karaoke',
        artist: 'Miley Cyrus',
        layer: 'global_catalog',
        qualityScore: 30,
        rankingScore: 125,
        backingCandidateId: 'flowers__youtube__host_ranked_pick'
      }
    ]
  });

  expect(ranked[0]?.trackId).toBe('host_ranked_pick');
  expect(ranked[0]?.backingCandidateId).toBe('flowers__youtube__host_ranked_pick');
});

it('prefers canonical backing candidates over generic catalog matches before live search', () => {
  const ranked = rankSongRequestCandidates({
    request: {
      songId: 'flowers__miley cyrus',
      songTitle: 'Flowers',
      artist: 'Miley Cyrus'
    },
    catalogCandidates: [
      {
        trackId: 'generic_catalog_pick',
        mediaUrl: 'https://youtube.com/watch?v=generic_catalog_pick',
        source: 'youtube',
        title: 'Flowers Karaoke',
        artist: 'Miley Cyrus',
        layer: 'global_catalog',
        qualityScore: 45,
        rankingScore: 70,
        approvalState: 'approved'
      },
      {
        trackId: 'canonical_liked_pick',
        mediaUrl: 'https://youtube.com/watch?v=canonical_liked_pick',
        source: 'youtube',
        title: 'Flowers Karaoke',
        artist: 'Miley Cyrus',
        layer: 'canonical_backing',
        qualityScore: 12,
        rankingScore: 132,
        backingCandidateId: 'flowers__youtube__canonical_liked_pick',
        canonicalSongId: 'flowers__miley cyrus',
        backingTelemetry: { hostUpvotes: 2, completionCount: 3, usageCount: 3 },
        successCount: 3,
        usageCount: 3,
        approvalState: 'approved'
      }
    ]
  });

  expect(ranked[0]?.trackId).toBe('canonical_liked_pick');
  expect(ranked[0]?.layer).toBe('canonical_backing');
  expect(ranked[0]?.backingCandidateId).toBe('flowers__youtube__canonical_liked_pick');
});

it('penalizes failure-heavy candidates in ranking', () => {
  const ranked = rankSongRequestCandidates({
    request: {
      songId: 'flowers__miley cyrus',
      songTitle: 'Flowers',
      artist: 'Miley Cyrus'
    },
    catalogCandidates: [
      {
        trackId: 'clean_pick',
        mediaUrl: 'https://youtube.com/watch?v=clean_pick',
        source: 'youtube',
        title: 'Flowers Karaoke',
        artist: 'Miley Cyrus',
        layer: 'global_catalog',
        qualityScore: 30,
        successCount: 2,
        usageCount: 2,
        failureCount: 0
      },
      {
        trackId: 'avoided_pick',
        mediaUrl: 'https://youtube.com/watch?v=avoided_pick',
        source: 'youtube',
        title: 'Flowers Karaoke',
        artist: 'Miley Cyrus',
        layer: 'global_catalog',
        qualityScore: 30,
        successCount: 0,
        usageCount: 1,
        failureCount: 3
      }
    ]
  });

  expect(ranked[0]?.trackId).toBe('clean_pick');
  expect(ranked.find((entry) => entry.trackId === 'avoided_pick')?.score).toBeLessThan(
    ranked.find((entry) => entry.trackId === 'clean_pick')?.score || 0
  );
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

it('excludes rejected backing aliases from collaboration pairing', () => {
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
        resolutionStatus: 'rejected'
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
        resolutionStatus: 'rejected_backing'
      }
    ],
    users: []
  });

  expect(Boolean(suggestions.request_a)).toBe(false);
  expect(Boolean(suggestions.request_b)).toBe(false);
});
});
