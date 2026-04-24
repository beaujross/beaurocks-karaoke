import { test, expect } from 'vitest';

import {
    getAutoEndSchedule,
    getTrackDurationSecFromSearchResult
} from '../../src/apps/Host/hostPlaybackAutomation.js';

test('getTrackDurationSecFromSearchResult prefers search-result millis over fallback', () => {
    expect(getTrackDurationSecFromSearchResult({ trackTimeMillis: 298000 }, 180)).toBe(298);
});

test('getTrackDurationSecFromSearchResult falls back when result has no duration', () => {
    expect(getTrackDurationSecFromSearchResult({}, 215)).toBe(215);
});

test('getAutoEndSchedule schedules karaoke auto-end for Apple playback without Auto DJ gating', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'song_123',
        activeMode: 'karaoke',
        appleMusicId: '1547316384',
        appleStatus: 'playing',
        appleStartedAt: 1000,
        appleDurationSec: 30,
        now: 1000
    });

    expect(schedule).toEqual({
        autoEndKey: 'song_123:1000:30',
        delayMs: 36000
    });
});

test('getAutoEndSchedule returns immediate trigger once track should already be finished', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'song_456',
        activeMode: 'karaoke',
        videoPlaying: true,
        videoStartTimestamp: 1000,
        currentDurationSec: 45,
        now: 48000
    });

    expect(schedule).toEqual({
        autoEndKey: 'song_456:1000:45',
        delayMs: 4000
    });
});

test('getAutoEndSchedule prefers captured performance duration over stale request duration', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'song_789',
        activeMode: 'karaoke',
        videoPlaying: true,
        videoStartTimestamp: 1000,
        capturedDurationSec: 220,
        currentDurationSec: 150,
        now: 1000
    });

    expect(schedule).toEqual({
        autoEndKey: 'song_789:1000:220',
        delayMs: 226000
    });
});

test('getAutoEndSchedule prefers longer resolved media duration for video playback', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'song_resolved',
        activeMode: 'karaoke',
        videoPlaying: true,
        videoStartTimestamp: 1000,
        capturedDurationSec: 150,
        currentDurationSec: 220,
        now: 1000
    });

    expect(schedule).toEqual({
        autoEndKey: 'song_resolved:1000:220',
        delayMs: 226000
    });
});

test('getAutoEndSchedule uses persisted media clock when YouTube playing flag is stale', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'rollout_ludacris',
        activeMode: 'karaoke',
        mediaUrl: 'https://www.youtube.com/watch?v=t21DFnu00Dc',
        videoPlaying: false,
        videoStartTimestamp: 1000,
        currentDurationSec: 240,
        now: 1000
    });

    expect(schedule).toEqual({
        autoEndKey: 'rollout_ludacris:1000:240',
        delayMs: 246000
    });
});

test('getAutoEndSchedule ignores stale room playback metadata from a previous performer', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'new_audience_request',
        activeMode: 'karaoke',
        performanceMetaSongId: 'previous_song',
        mediaUrl: 'https://www.youtube.com/watch?v=t21DFnu00Dc',
        videoPlaying: true,
        videoStartTimestamp: 1000,
        currentDurationSec: 240,
        now: 300000
    });

    expect(schedule).toBeNull();
});

test('getAutoEndSchedule defers auto-end when authoritative player heartbeat is still fresh past the estimate', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'live_youtube_song',
        activeMode: 'karaoke',
        mediaUrl: 'https://www.youtube.com/watch?v=t21DFnu00Dc',
        videoPlaying: true,
        videoStartTimestamp: 1000,
        currentDurationSec: 180,
        performanceSessionSourceType: 'youtube',
        performanceSessionState: 'playing',
        performanceSessionLastHeartbeatAtMs: 186000,
        now: 187000
    });

    expect(schedule).toEqual({
        autoEndKey: 'live_youtube_song:1000:heartbeat_watch:186',
        delayMs: 14000
    });
});

test('getAutoEndSchedule also defers auto-end for authoritative Apple playback heartbeats', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'live_apple_song',
        activeMode: 'karaoke',
        appleMusicId: 'apple_track_55',
        appleStatus: 'playing',
        appleStartedAt: 1000,
        appleDurationSec: 180,
        performanceSessionSourceType: 'apple_music',
        performanceSessionState: 'playing',
        performanceSessionLastHeartbeatAtMs: 186000,
        now: 187000
    });

    expect(schedule).toEqual({
        autoEndKey: 'live_apple_song:1000:heartbeat_watch:186',
        delayMs: 14000
    });
});

test('getAutoEndSchedule does not auto-end paused media from the persisted clock', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'paused_song',
        activeMode: 'karaoke',
        mediaUrl: 'https://www.youtube.com/watch?v=t21DFnu00Dc',
        videoPlaying: false,
        videoStartTimestamp: 1000,
        pausedAt: 5000,
        currentDurationSec: 240,
        now: 250000
    });

    expect(schedule).toBeNull();
});

test('getAutoEndSchedule yields once the active performance session already ended', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'ended_song',
        activeMode: 'karaoke',
        mediaUrl: 'https://www.youtube.com/watch?v=t21DFnu00Dc',
        videoPlaying: true,
        videoStartTimestamp: 1000,
        currentDurationSec: 180,
        performanceSessionState: 'ended',
        performanceSessionEndedAtMs: 90000,
        now: 91000
    });

    expect(schedule).toBeNull();
});

test('getAutoEndSchedule does not auto-end unsafe non-Apple backing durations', () => {
    const schedule = getAutoEndSchedule({
        autoEndEnabled: true,
        currentId: 'unsafe_youtube',
        activeMode: 'karaoke',
        mediaUrl: 'https://www.youtube.com/watch?v=t21DFnu00Dc',
        videoPlaying: true,
        videoStartTimestamp: 1000,
        currentDurationSec: 180,
        autoEndSafe: false,
        now: 1000
    });

    expect(schedule).toBeNull();
});
