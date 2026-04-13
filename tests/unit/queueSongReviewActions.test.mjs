import { beforeEach, describe, expect, it, vi } from 'vitest';

const setDoc = vi.fn(async () => {});
const updateDoc = vi.fn(async () => {});
const doc = vi.fn((...segments) => ({ path: segments.join('/') }));
const serverTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');
const ensureSong = vi.fn(async () => ({ songId: 'song_catalog_id' }));
const ensureTrack = vi.fn(async () => ({ trackId: 'track_catalog_id' }));
const buildSongKey = vi.fn((title, artist) => `${title}__${artist}`);
const extractYouTubeId = vi.fn((url = '') => {
  const match = String(url || '').match(/v=([^&]+)/);
  return match?.[1] || '';
});
const recordTrackFeedback = vi.fn(async () => {});

vi.mock('../../src/lib/firebase.js', () => ({
  db: {},
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
}));

vi.mock('../../src/lib/songCatalog.js', () => ({
  buildSongKey,
  ensureSong,
  ensureTrack,
  extractYouTubeId,
  recordTrackFeedback,
}));

const {
  applyAudienceSelectedBackingDecision,
  clearTrustedCatalogBackingForRoom,
  persistTrustedCatalogChoiceForRoom,
  resolveQueueReviewSelectionForHost,
  saveHostBackingPreferenceForRoom,
} = await import('../../src/apps/Host/queueSongReviewActions.js');

describe('queueSongReviewActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverTimestamp.mockReturnValue('SERVER_TIMESTAMP');
    ensureSong.mockResolvedValue({ songId: 'song_catalog_id' });
    ensureTrack.mockResolvedValue({ trackId: 'track_catalog_id' });
    recordTrackFeedback.mockResolvedValue(undefined);
  });

  it('resolves host review selections through catalog writes and room favorite persistence', async () => {
    const persistTrustedCatalogChoice = vi.fn(async () => {});

    await resolveQueueReviewSelectionForHost({
      song: {
        id: 'queue_song_1',
        songTitle: 'Shallow',
        artist: 'Lady Gaga',
        albumArtUrl: 'https://example.com/art.jpg',
        duration: 210,
        status: 'pending',
      },
      candidate: {
        source: 'youtube',
        mediaUrl: 'https://youtube.com/watch?v=abc123',
        label: 'Host pick',
        duration: 211,
        approvalState: 'candidate',
        qualityScore: 88,
      },
      hostName: 'DJ Test',
      resolvedByUid: 'host_uid_1',
      saveFavorite: true,
      persistTrustedCatalogChoice,
    });

    expect(ensureSong).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Shallow',
      artist: 'Lady Gaga',
      artworkUrl: 'https://example.com/art.jpg',
      verifiedBy: 'DJ Test',
    }));
    expect(ensureTrack).toHaveBeenCalledWith(expect.objectContaining({
      songId: 'song_catalog_id',
      source: 'youtube',
      mediaUrl: 'https://youtube.com/watch?v=abc123',
      addedBy: 'DJ Test',
      approvalState: 'candidate',
    }));
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('karaoke_songs/queue_song_1') }),
      expect.objectContaining({
        songId: 'song_catalog_id',
        trackId: 'track_catalog_id',
        trackSource: 'youtube',
        resolutionStatus: 'resolved',
        resolutionLayer: 'host_favorite',
        status: 'requested',
        mediaResolutionStatus: 'host_reviewed',
        reviewResolvedBy: 'host_uid_1',
        reviewResolvedAt: 'SERVER_TIMESTAMP',
        reviewRequestedAt: null,
      })
    );
    expect(persistTrustedCatalogChoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'queue_song_1' }),
      expect.objectContaining({ trackId: 'track_catalog_id' }),
      'host_favorite'
    );
  });

  it('marks trusted-review submissions without saving room favorites', async () => {
    const persistTrustedCatalogChoice = vi.fn(async () => {});

    await resolveQueueReviewSelectionForHost({
      song: {
        id: 'queue_song_2',
        songTitle: 'Flowers',
        artist: 'Miley Cyrus',
        status: 'requested',
      },
      candidate: {
        mediaUrl: 'https://youtube.com/watch?v=flowers123',
        source: 'youtube',
        layer: 'room_recent',
      },
      submitTrustedReview: true,
      persistTrustedCatalogChoice,
    });

    expect(ensureTrack).toHaveBeenCalledWith(expect.objectContaining({
      approvalState: 'submitted',
    }));
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        mediaResolutionStatus: 'trusted_review_submitted',
        resolutionLayer: 'room_recent',
        status: 'requested',
      })
    );
    expect(persistTrustedCatalogChoice).not.toHaveBeenCalled();
  });

  it('persists trusted catalog choices for the room library', async () => {
    await persistTrustedCatalogChoiceForRoom({
      roomCode: 'ROOM1',
      trustedCatalog: {},
      song: {
        songId: 'song_a',
        songTitle: 'Levitating',
        artist: 'Dua Lipa',
      },
      candidate: {
        trackId: 'track_a',
        mediaUrl: 'https://youtube.com/watch?v=levitating1',
        source: 'youtube',
        label: 'Favorite pick',
        qualityScore: 140,
      },
      layer: 'host_favorite',
    });

    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('host_libraries/ROOM1') }),
      expect.objectContaining({
        trustedCatalog: expect.objectContaining({
          song_a: expect.objectContaining({
            songId: 'song_a',
            hostFavoriteTrackId: 'track_a',
            hostFavoriteMediaUrl: 'https://youtube.com/watch?v=levitating1',
          }),
        }),
        updatedAt: 'SERVER_TIMESTAMP',
      }),
      { merge: true }
    );
  });

  it('saves positive and negative host backing feedback through the room library command path', async () => {
    const onUpsertYtIndexEntries = vi.fn(async () => {});
    const onTrackFeedbackError = vi.fn();

    const upResult = await saveHostBackingPreferenceForRoom({
      roomCode: 'ROOM1',
      trustedCatalog: {},
      ytIndex: [],
      songLike: {
        songId: 'song_up',
        songTitle: 'Flowers',
        artist: 'Miley Cyrus',
        mediaUrl: 'https://youtube.com/watch?v=flowers123',
        albumArtUrl: 'https://example.com/flowers.jpg',
      },
      rating: 'up',
      onUpsertYtIndexEntries,
    });

    expect(upResult).toMatchObject({ handled: true, preference: 'up', videoId: 'flowers123' });
    expect(onUpsertYtIndexEntries).toHaveBeenCalledWith([
      expect.objectContaining({
        videoId: 'flowers123',
        playable: true,
      }),
    ]);
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('host_libraries/ROOM1') }),
      expect.objectContaining({
        trustedCatalog: expect.objectContaining({
          song_up: expect.any(Object),
        }),
      }),
      { merge: true }
    );

    setDoc.mockClear();
    onUpsertYtIndexEntries.mockClear();

    const downResult = await saveHostBackingPreferenceForRoom({
      roomCode: 'ROOM1',
      trustedCatalog: {
        song_down: {
          hostFavoriteTrackId: 'track_down',
          hostFavoriteMediaUrl: 'https://youtube.com/watch?v=down123',
          hostFavoriteAppleMusicId: '',
          roomRecentTrackId: '',
          roomRecentMediaUrl: '',
          roomRecentAppleMusicId: '',
          title: 'Bad Romance',
          artist: 'Lady Gaga',
        },
      },
      ytIndex: [],
      songLike: {
        songId: 'song_down',
        songTitle: 'Bad Romance',
        artist: 'Lady Gaga',
        mediaUrl: 'https://youtube.com/watch?v=down123',
        trackId: 'track_down',
        albumArtUrl: 'https://example.com/bad-romance.jpg',
      },
      rating: 'down',
      onUpsertYtIndexEntries,
      onTrackFeedbackError,
    });

    expect(downResult).toMatchObject({ handled: true, preference: 'down', videoId: 'down123' });
    expect(onUpsertYtIndexEntries).toHaveBeenCalledWith([
      expect.objectContaining({
        videoId: 'down123',
        playable: false,
        failureCountDelta: 1,
      }),
    ]);
    expect(recordTrackFeedback).toHaveBeenCalledWith(expect.objectContaining({
      roomCode: 'ROOM1',
      rating: 'down',
      songId: 'song_down',
    }));
    expect(onTrackFeedbackError).not.toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('host_libraries/ROOM1') }),
      expect.objectContaining({
        trustedCatalog: expect.objectContaining({
          song_down: expect.objectContaining({
            hostFavoriteTrackId: '',
            hostFavoriteMediaUrl: '',
          }),
        }),
      }),
      { merge: true }
    );
  });

  it('returns false when there is no matching trusted catalog backing to clear', async () => {
    const changed = await clearTrustedCatalogBackingForRoom({
      roomCode: 'ROOM1',
      trustedCatalog: {
        song_x: {
          hostFavoriteTrackId: 'track_x',
          hostFavoriteMediaUrl: 'https://youtube.com/watch?v=other123',
        },
      },
      song: {
        songId: 'song_x',
        songTitle: 'Song X',
        artist: 'Artist X',
      },
      candidate: {
        mediaUrl: 'https://youtube.com/watch?v=nope999',
        trackId: 'track_nope',
      },
    });

    expect(changed).toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('routes approved audience-selected tracks through preference save and resolution', async () => {
    const onRateBackingPreference = vi.fn(async () => {});

    const result = await applyAudienceSelectedBackingDecision({
      songLike: {
        id: 'queue_song_approval',
        status: 'requested',
        resolutionStatus: 'audience_selected_unverified',
      },
      action: 'approve',
      onRateBackingPreference,
    });

    expect(result).toEqual({ handled: true, outcome: 'approved_saved' });
    expect(onRateBackingPreference).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'queue_song_approval' }),
      'up'
    );
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('karaoke_songs/queue_song_approval') }),
      expect.objectContaining({
        resolutionStatus: 'resolved',
        resolutionLayer: 'host_favorite',
        status: 'requested',
      })
    );
  });

  it('returns audience-selected tracks to review when the host avoids them before performance', async () => {
    const onRateBackingPreference = vi.fn(async () => {});

    const result = await applyAudienceSelectedBackingDecision({
      songLike: {
        id: 'queue_song_review',
        status: 'requested',
        resolutionStatus: 'audience_selected_unverified',
      },
      action: 'avoid',
      onRateBackingPreference,
    });

    expect(result).toEqual({ handled: true, outcome: 'returned_to_review' });
    expect(onRateBackingPreference).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'queue_song_review' }),
      'down'
    );
    expect(updateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('karaoke_songs/queue_song_review') }),
      expect.objectContaining({
        resolutionStatus: 'review_required',
        resolutionLayer: 'manual_review',
        reviewRequestedAt: 'SERVER_TIMESTAMP',
      })
    );
  });

  it('saves preference only for already-resolved audience backing decisions', async () => {
    const onRateBackingPreference = vi.fn(async () => {});

    const result = await applyAudienceSelectedBackingDecision({
      songLike: {
        id: 'queue_song_resolved',
        status: 'requested',
        resolutionStatus: 'resolved',
      },
      action: 'avoid',
      onRateBackingPreference,
    });

    expect(result).toEqual({ handled: true, outcome: 'saved_down' });
    expect(onRateBackingPreference).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'queue_song_resolved' }),
      'down'
    );
    expect(updateDoc).not.toHaveBeenCalled();
  });
});
