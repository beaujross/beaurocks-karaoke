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
        delayMs: 31500
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
        delayMs: 0
    });
});
