import { describe, expect, test } from 'vitest';
import {
  BACKGROUND_AUDIO_SESSION_STATUSES,
  buildAppleBackgroundSession,
  interruptAppleBackgroundSession,
  isAppleBackgroundSession,
  markAppleBackgroundHostPaused,
  markAppleBackgroundRestored,
  markAppleBackgroundRestoring,
} from '../../src/lib/backgroundAudioSession.js';

const playlistSession = () => buildAppleBackgroundSession({
  playlistId: 'pl.party',
  title: 'Party Mix',
  sourceType: 'library-playlist',
  playback: { type: 'playlist', id: 'pl.party', status: 'playing' },
  snapshot: {
    trackId: 'track-3',
    trackTitle: 'Third Song',
    artist: 'The Singers',
    queueIndex: 2,
    queueLength: 12,
    currentTimeSec: 73.4,
  },
  sourceRevision: 101,
  now: 1000,
});

describe('backgroundAudioSession', () => {
  test('keeps a provider-neutral Apple playlist checkpoint', () => {
    const session = playlistSession();
    expect(isAppleBackgroundSession(session)).toBe(true);
    expect(session).toMatchObject({
      type: 'apple_playlist',
      provider: 'apple_music',
      id: 'pl.party',
      trackId: 'track-3',
      queueIndex: 2,
      queueLength: 12,
      positionSec: 73.4,
      status: 'playing',
      desiredState: 'playing',
    });
  });

  test('performance interruption preserves the original checkpoint across restart', () => {
    const interrupted = interruptAppleBackgroundSession({
      existing: playlistSession(),
      performanceSessionId: 'perf-1',
      snapshot: { trackId: 'track-3', queueIndex: 2, queueLength: 12, currentTimeSec: 73.4 },
      now: 2000,
    });
    const restarted = interruptAppleBackgroundSession({
      existing: interrupted,
      performanceSessionId: 'perf-1',
      snapshot: { trackId: 'performance-song', queueIndex: 0, queueLength: 1, currentTimeSec: 0 },
      now: 3000,
    });
    expect(restarted).toBe(interrupted);
    expect(restarted).toMatchObject({
      status: BACKGROUND_AUDIO_SESSION_STATUSES.pausedPerformance,
      performanceSessionId: 'perf-1',
      trackId: 'track-3',
      queueIndex: 2,
      positionSec: 73.4,
    });
  });

  test('host pause remains authoritative through restore planning', () => {
    const paused = markAppleBackgroundHostPaused({ session: playlistSession(), now: 2000 });
    const restoring = markAppleBackgroundRestoring({ session: paused, now: 3000 });
    const restored = markAppleBackgroundRestored({ session: restoring, now: 4000 });
    expect(paused.desiredState).toBe('paused');
    expect(restoring.desiredState).toBe('paused');
    expect(restored.status).toBe(BACKGROUND_AUDIO_SESSION_STATUSES.pausedHost);
  });
});
