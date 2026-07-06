import assert from 'node:assert/strict';
import { test } from "vitest";
import {
    normalizeBackingChoice,
    resolveStageMediaUrl,
    resolveQueuePlayback,
    isQueueEntryPlayable,
    isBackingPlaying,
    getBackingSourceLabel,
    getAppleMusicPlaybackDisplay
} from '../../src/lib/playbackSource.js';

test("playbackSource.test", () => {
    const explicitMedia = normalizeBackingChoice({
        mediaUrl: ' https://www.youtube.com/watch?v=abc12345 ',
        appleMusicId: '12345'
    });
    assert.equal(explicitMedia.mediaUrl, 'https://www.youtube.com/watch?v=abc12345');
    assert.equal(explicitMedia.appleMusicId, '');
    assert.equal(explicitMedia.usesAppleBacking, false);
    assert.equal(explicitMedia.youtubeId, 'abc12345');
    assert.equal(explicitMedia.isYouTube, true);

    const appleOnly = normalizeBackingChoice({
        mediaUrl: '',
        appleMusicId: '12345'
    });
    assert.equal(appleOnly.mediaUrl, '');
    assert.equal(appleOnly.appleMusicId, '12345');
    assert.equal(appleOnly.usesAppleBacking, true);
    assert.equal(appleOnly.isYouTube, false);

    assert.equal(
        resolveStageMediaUrl({ mediaUrl: '  https://example.com/a.mp4  ' }, { mediaUrl: 'https://fallback.example.com/b.mp4' }),
        'https://example.com/a.mp4'
    );
    assert.equal(
        resolveStageMediaUrl(null, { mediaUrl: '  https://fallback.example.com/b.mp4  ' }),
        'https://fallback.example.com/b.mp4'
    );

    const queueApple = resolveQueuePlayback({ mediaUrl: '', appleMusicId: '777' }, true);
    assert.equal(queueApple.usesAppleBacking, true);
    assert.equal(queueApple.autoStartMedia, true);

    const queueMediaNoAuto = resolveQueuePlayback({ mediaUrl: 'https://example.com/a.mp4', appleMusicId: '' }, false);
    assert.equal(queueMediaNoAuto.hasMedia, true);
    assert.equal(queueMediaNoAuto.autoStartMedia, false);

    const queueYoutubeWins = resolveQueuePlayback({
        mediaUrl: 'https://youtu.be/abc12345',
        appleMusicId: 'should_be_ignored'
    }, true);
    assert.equal(queueYoutubeWins.usesAppleBacking, false);
    assert.equal(queueYoutubeWins.appleMusicId, '');
    assert.equal(queueYoutubeWins.isYouTube, true);
    assert.equal(queueYoutubeWins.hasMedia, true);
    assert.equal(queueYoutubeWins.autoStartMedia, true);
    const queueYoutubeIdOnly = resolveQueuePlayback({
        youtubeId: 'abc12345',
        playbackReady: true
    }, true);
    assert.equal(queueYoutubeIdOnly.mediaUrl, 'https://www.youtube.com/watch?v=abc12345');
    assert.equal(queueYoutubeIdOnly.isYouTube, true);
    assert.equal(isQueueEntryPlayable({ youtubeId: 'abc12345', playbackReady: true }), true);
    assert.equal(
        resolveStageMediaUrl({ youtubeId: 'abc12345' }, { mediaUrl: 'https://fallback.example.com/b.mp4' }),
        'https://www.youtube.com/watch?v=abc12345'
    );
    assert.equal(isQueueEntryPlayable({ mediaUrl: 'https://youtu.be/abc12345', playbackReady: true }), true);
    assert.equal(isQueueEntryPlayable({ appleMusicId: '777', playbackReady: true }, { appleMusicEnabled: true }), true);
    assert.equal(isQueueEntryPlayable({ appleMusicId: '777', playbackReady: true }, { appleMusicEnabled: false }), false);
    assert.equal(isQueueEntryPlayable({ mediaResolutionStatus: 'needs_backing', playbackReady: false }), false);
    assert.equal(isQueueEntryPlayable({ appleMusicId: '777', mediaResolutionStatus: 'pending_youtube_match' }, { appleMusicEnabled: true }), false);

    assert.equal(
        isBackingPlaying({
            usesAppleBacking: true,
            room: { appleMusicPlayback: { status: 'playing' } },
            appleMusicPlaying: false
        }),
        true
    );
    assert.equal(
        isBackingPlaying({
            usesAppleBacking: false,
            room: { videoPlaying: true }
        }),
        true
    );
    assert.equal(
        isBackingPlaying({
            usesAppleBacking: false,
            room: {
                videoPlaying: false,
                appleMusicPlayback: { status: 'playing' }
            },
            appleMusicPlaying: true
        }),
        false
    );
    assert.equal(
        isBackingPlaying({
            usesAppleBacking: true,
            room: {
                videoPlaying: true,
                appleMusicPlayback: { status: 'paused' }
            },
            appleMusicPlaying: false
        }),
        false
    );

    assert.equal(getBackingSourceLabel({ usesAppleBacking: true, mediaUrl: '' }), 'Apple Music full song');
    assert.equal(getBackingSourceLabel({ usesAppleBacking: false, mediaUrl: 'https://youtu.be/abc12345' }), 'YouTube karaoke backing');
    assert.equal(getBackingSourceLabel({ usesAppleBacking: false, mediaUrl: 'https://example.com/a.mp4' }), 'Known backing');
    assert.equal(getBackingSourceLabel({ usesAppleBacking: false, mediaUrl: '' }), 'No backing');
    assert.equal(getBackingSourceLabel({ source: 'itunes', variant: 'compact' }), 'Apple full song');
    assert.equal(getBackingSourceLabel({ source: 'youtube', variant: 'compact' }), 'YouTube backing');
    assert.equal(getBackingSourceLabel({ source: 'local', variant: 'compact' }), 'Known backing');
});

test("playbackSource Apple Music display model", () => {
    const performanceDisplay = getAppleMusicPlaybackDisplay({
        currentSong: {
            songTitle: 'Purple Rain',
            artist: 'Prince',
            appleMusicId: 'apple_song_1',
            duration: 240
        },
        room: {
            appleMusicPlayback: {
                type: 'song',
                id: 'apple_song_1',
                title: 'Purple Rain',
                artist: 'Prince',
                status: 'playing',
                startedAt: 1_000,
                durationSec: 240
            }
        },
        nowMs: 61_000
    });
    assert.equal(performanceDisplay.active, true);
    assert.equal(performanceDisplay.eyebrow, 'Apple Music Backing');
    assert.equal(performanceDisplay.title, 'Purple Rain');
    assert.equal(performanceDisplay.subtitle, 'Prince');
    assert.equal(performanceDisplay.statusLabel, 'Playing');
    assert.equal(performanceDisplay.progressPct, 25);

    const playlistDisplay = getAppleMusicPlaybackDisplay({
        room: {
            appleMusicAutoPlaylistTitle: 'Party Background',
            appleMusicPlayback: {
                type: 'playlist',
                id: 'pl.abc',
                status: 'paused',
                startedAt: 10_000,
                pausedAt: 70_000
            }
        },
        nowMs: 120_000
    });
    assert.equal(playlistDisplay.active, true);
    assert.equal(playlistDisplay.eyebrow, 'Apple Music Background');
    assert.equal(playlistDisplay.title, 'Party Background');
    assert.equal(playlistDisplay.subtitle, 'Background music');
    assert.equal(playlistDisplay.statusLabel, 'Paused');
    assert.equal(playlistDisplay.elapsedSec, 60);

    assert.equal(getAppleMusicPlaybackDisplay({ room: {} }).active, false);
});
