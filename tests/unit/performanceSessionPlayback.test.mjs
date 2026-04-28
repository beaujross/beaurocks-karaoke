import { describe, expect, it } from 'vitest';

import {
    attachPerformancePlaybackContext,
    buildPerformanceSessionPlaybackWrite,
    matchesActivePerformanceSession
} from '../../src/lib/performanceSessionPlayback.js';

describe('performanceSessionPlayback', () => {
    it('attaches active performance identity to playback events', () => {
        expect(attachPerformancePlaybackContext(
            { type: 'ended' },
            {
                room: {
                    mediaUrl: 'https://youtu.be/new-song',
                    videoStartTimestamp: 456,
                    currentPerformanceMeta: { startedAtMs: 456, mediaUrl: 'https://youtu.be/new-song' },
                    currentPerformanceSession: {
                        sessionId: 'perf_song_2_456',
                        songId: 'song_2',
                        mediaUrl: 'https://youtu.be/new-song',
                        startedAtMs: 456
                    }
                },
                current: {
                    id: 'song_2',
                    mediaUrl: 'https://youtu.be/new-song'
                }
            }
        )).toEqual({
            type: 'ended',
            performanceSessionId: 'perf_song_2_456',
            performanceSongId: 'song_2',
            performanceStartedAtMs: 456,
            performanceMediaUrl: 'https://youtu.be/new-song'
        });
    });

    it('accepts playback events that still belong to the active session', () => {
        expect(matchesActivePerformanceSession({
            event: {
                performanceSessionId: 'perf_song_2_456',
                performanceSongId: 'song_2',
                performanceStartedAtMs: 456,
                performanceMediaUrl: 'https://youtu.be/new-song'
            },
            session: {
                sessionId: 'perf_song_2_456',
                songId: 'song_2',
                startedAtMs: 456,
                mediaUrl: 'https://youtu.be/new-song'
            },
            currentPerformanceMeta: {
                startedAtMs: 456,
                mediaUrl: 'https://youtu.be/new-song'
            },
            mediaUrl: 'https://youtu.be/new-song'
        })).toBe(true);
    });

    it('rejects stale playback events from a previous session', () => {
        expect(matchesActivePerformanceSession({
            event: {
                performanceSessionId: 'perf_song_1_123',
                performanceSongId: 'song_1',
                performanceStartedAtMs: 123,
                performanceMediaUrl: 'https://youtu.be/old-song'
            },
            session: {
                sessionId: 'perf_song_2_456',
                songId: 'song_2',
                startedAtMs: 456,
                mediaUrl: 'https://youtu.be/new-song'
            },
            currentPerformanceMeta: {
                startedAtMs: 456,
                mediaUrl: 'https://youtu.be/new-song'
            },
            mediaUrl: 'https://youtu.be/new-song'
        })).toBe(false);
    });

    it('drops a late ended event from song A after song B has already started', () => {
        const staleEndedEvent = attachPerformancePlaybackContext(
            {
                type: 'ended',
                currentTimeSec: 182,
                durationSec: 182,
                completionReason: 'player_ended'
            },
            {
                room: {
                    mediaUrl: 'https://youtu.be/song-a',
                    videoStartTimestamp: 1000,
                    currentPerformanceMeta: { songId: 'song_a', startedAtMs: 1000, mediaUrl: 'https://youtu.be/song-a' },
                    currentPerformanceSession: {
                        sessionId: 'perf_song_a_1000',
                        songId: 'song_a',
                        mediaUrl: 'https://youtu.be/song-a',
                        startedAtMs: 1000
                    }
                },
                current: {
                    id: 'song_a',
                    mediaUrl: 'https://youtu.be/song-a'
                }
            }
        );

        const nextWrite = buildPerformanceSessionPlaybackWrite({
            event: staleEndedEvent,
            session: {
                sessionId: 'perf_song_b_9000',
                songId: 'song_b',
                mediaUrl: 'https://youtu.be/song-b',
                startedAtMs: 9000,
                playbackState: 'starting'
            },
            currentPerformanceMeta: {
                songId: 'song_b',
                startedAtMs: 9000,
                mediaUrl: 'https://youtu.be/song-b',
                durationSec: 200,
                backingDurationSec: 200
            },
            mediaUrl: 'https://youtu.be/song-b',
            now: 9500
        });

        expect(nextWrite).toBeNull();
    });

    it('builds a patch for the active performance session event', () => {
        const nextWrite = buildPerformanceSessionPlaybackWrite({
            event: {
                type: 'heartbeat',
                currentTimeSec: 47,
                durationSec: 205,
                performanceSessionId: 'perf_song_b_9000',
                performanceSongId: 'song_b',
                performanceStartedAtMs: 9000,
                performanceMediaUrl: 'https://youtu.be/song-b'
            },
            session: {
                sessionId: 'perf_song_b_9000',
                songId: 'song_b',
                mediaUrl: 'https://youtu.be/song-b',
                startedAtMs: 9000,
                playbackState: 'playing',
                playbackStartedAtMs: 0
            },
            currentPerformanceMeta: {
                songId: 'song_b',
                startedAtMs: 9000,
                mediaUrl: 'https://youtu.be/song-b',
                durationSec: 180,
                backingDurationSec: 180
            },
            mediaUrl: 'https://youtu.be/song-b',
            now: 12000
        });

        expect(nextWrite).toEqual({
            dedupeKey: 'perf_song_b_9000:heartbeat:9',
            patch: {
                'currentPerformanceSession.lastReportedAtMs': 12000,
                'currentPerformanceSession.playerReportedDurationSec': 205,
                'currentPerformanceSession.playerPositionSec': 47,
                'currentPerformanceSession.playbackState': 'playing',
                'currentPerformanceSession.lastHeartbeatAtMs': 12000,
                'currentPerformanceSession.playbackStartedAtMs': 12000,
                'currentPerformanceMeta.durationSec': 205,
                'currentPerformanceMeta.backingDurationSec': 205,
                'currentPerformanceMeta.durationSource': 'player_reported',
                'currentPerformanceMeta.durationConfidence': 'high',
                'currentPerformanceMeta.autoEndSafe': true
            }
        });
    });
});
