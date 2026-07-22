import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
    isAppleLyricsPerformance,
    resolveLyricsPlaybackClock
} from '../../src/lib/lyricsPlaybackClock.js';

test('lyricsPlaybackClock anchors Apple timed lyrics to the reported MusicKit position', () => {
    const clock = resolveLyricsPlaybackClock({
        room: {
            currentPerformanceSession: {
                sourceType: 'apple_music',
                playerPositionSec: 42.5,
                lastReportedAtMs: 150000
            },
            appleMusicPlayback: {
                type: 'song',
                id: 'apple_1',
                status: 'playing',
                positionSec: 42.5,
                lastReportedAt: 150000
            },
            videoPlaying: false,
            videoStartTimestamp: null
        },
        current: { appleMusicId: 'apple_1' }
    });

    assert.equal(clock.source, 'apple_music');
    assert.equal(clock.startTime, 107500);
    assert.equal(clock.isPlaying, true);
    assert.equal(clock.pausedAt, 0);
});

test('lyricsPlaybackClock preserves the exact Apple position while paused', () => {
    const clock = resolveLyricsPlaybackClock({
        room: {
            currentPerformanceSession: {
                sourceType: 'apple_music',
                playerPositionSec: 31,
                lastReportedAtMs: 90000
            },
            appleMusicPlayback: {
                type: 'song',
                id: 'apple_2',
                status: 'paused',
                positionSec: 31,
                lastReportedAt: 90000
            }
        },
        current: { appleMusicId: 'apple_2' }
    });

    assert.equal(clock.startTime, 59000);
    assert.equal(clock.pausedAt, 90000);
    assert.equal(clock.isPlaying, false);
});

test('lyricsPlaybackClock never treats an Apple background playlist as the performance clock', () => {
    const room = {
        appleMusicPlayback: {
            type: 'playlist',
            id: 'playlist_1',
            status: 'playing',
            positionSec: 25,
            lastReportedAt: 80000
        },
        videoStartTimestamp: 50000,
        videoPlaying: true
    };

    assert.equal(isAppleLyricsPerformance({ room, current: {} }), false);
    assert.deepEqual(resolveLyricsPlaybackClock({ room, current: {} }), {
        startTime: 50000,
        pausedAt: 0,
        isPlaying: true,
        source: 'stage_media'
    });
});

test('lyricsPlaybackClock anchors YouTube timed lyrics to the TV player heartbeat', () => {
    const clock = resolveLyricsPlaybackClock({
        room: {
            currentPerformanceSession: {
                sessionId: 'session_1',
                songId: 'song_1',
                sourceType: 'youtube',
                playbackState: 'playing',
                playerPositionSec: 18.25,
                lastReportedAtMs: 75000,
                playbackStartedAtMs: 50000
            },
            videoPlaying: true,
            videoStartTimestamp: 49000
        },
        current: { id: 'song_1' }
    });

    assert.equal(clock.source, 'youtube');
    assert.equal(clock.startTime, 56750);
    assert.equal(clock.positionSec, 18.25);
    assert.equal(clock.isPlaying, true);
    assert.equal(clock.pausedAt, 0);
});

test('lyricsPlaybackClock holds YouTube timed lyrics at the reported paused position', () => {
    const clock = resolveLyricsPlaybackClock({
        room: {
            currentPerformanceSession: {
                sessionId: 'session_2',
                songId: 'song_2',
                sourceType: 'youtube',
                playbackState: 'paused',
                playerPositionSec: 27,
                lastReportedAtMs: 120000,
                pausedAtMs: 120000
            },
            videoPlaying: false
        },
        current: { id: 'song_2' }
    });

    assert.equal(clock.source, 'youtube');
    assert.equal(clock.startTime, 93000);
    assert.equal(clock.positionSec, 27);
    assert.equal(clock.isPlaying, false);
    assert.equal(clock.pausedAt, 120000);
});
