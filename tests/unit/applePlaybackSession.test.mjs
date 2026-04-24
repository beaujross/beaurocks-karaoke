import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
    buildApplePlaybackSyncPatch,
    getApplePlaybackSnapshot
} from '../../src/apps/Host/applePlaybackSession.js';

test('applePlaybackSession reads authoritative position and duration from MusicKit instance', () => {
    const snapshot = getApplePlaybackSnapshot({
        isPlaying: true,
        playbackState: 'playing',
        currentPlaybackTime: 42.5,
        nowPlayingItem: {
            id: 'apple_track_1',
            attributes: {
                durationInMillis: 215000
            }
        }
    });

    assert.equal(snapshot.trackId, 'apple_track_1');
    assert.equal(snapshot.status, 'playing');
    assert.equal(snapshot.durationSec, 215);
    assert.equal(snapshot.currentTimeSec, 42.5);
});

test('applePlaybackSession updates the active performance session while Apple playback is live', () => {
    const patch = buildApplePlaybackSyncPatch({
        session: {
            sourceType: 'apple_music',
            appleMusicId: 'apple_track_2',
            playbackState: 'starting',
            expectedDurationSec: 180
        },
        applePlayback: {
            id: 'apple_track_2',
            status: 'playing',
            durationSec: 180
        },
        snapshot: {
            trackId: 'apple_track_2',
            status: 'playing',
            currentTimeSec: 18,
            durationSec: 180,
            rawPlaybackState: 'playing'
        },
        now: 25000
    });

    assert.equal(patch['appleMusicPlayback.status'], 'playing');
    assert.equal(patch['appleMusicPlayback.positionSec'], 18);
    assert.equal(patch['currentPerformanceSession.playbackState'], 'playing');
    assert.equal(patch['currentPerformanceSession.lastHeartbeatAtMs'], 25000);
    assert.equal(patch['currentPerformanceSession.playerPositionSec'], 18);
});

test('applePlaybackSession marks the session ended when playback stops at the real end of track', () => {
    const patch = buildApplePlaybackSyncPatch({
        session: {
            sourceType: 'apple_music',
            appleMusicId: 'apple_track_3',
            playbackState: 'playing',
            expectedDurationSec: 200
        },
        applePlayback: {
            id: 'apple_track_3',
            status: 'playing',
            durationSec: 200
        },
        snapshot: {
            trackId: 'apple_track_3',
            status: 'stopped',
            currentTimeSec: 198.8,
            durationSec: 200,
            rawPlaybackState: 'stopped'
        },
        now: 210000
    });

    assert.equal(patch['appleMusicPlayback.status'], 'ended');
    assert.equal(patch['currentPerformanceSession.playbackState'], 'ended');
    assert.equal(patch['currentPerformanceSession.completionReason'], 'player_ended');
    assert.equal(patch['currentPerformanceSession.endedAtMs'], 210000);
});

test('applePlaybackSession does not mutate a mismatched non-apple session', () => {
    const patch = buildApplePlaybackSyncPatch({
        session: {
            sourceType: 'youtube',
            playbackState: 'playing'
        },
        applePlayback: {
            id: 'apple_track_4',
            status: 'playing'
        },
        snapshot: {
            trackId: 'apple_track_4',
            status: 'playing',
            currentTimeSec: 12,
            durationSec: 190,
            rawPlaybackState: 'playing'
        },
        now: 32000
    });

    assert.equal(patch['appleMusicPlayback.status'], 'playing');
    assert.equal('currentPerformanceSession.playbackState' in patch, false);
});
