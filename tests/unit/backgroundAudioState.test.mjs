import { describe, expect, test } from 'vitest';
import { buildBackgroundAudioQaSnapshot, deriveBackgroundAudioState, getBackgroundAudioCapability } from '../../src/lib/backgroundAudioState.js';

describe('backgroundAudioState', () => {
  test('reports audible Apple playback ahead of stale status messages', () => {
    expect(deriveBackgroundAudioState({
      room: { appleMusicPlayback: { type: 'playlist', status: 'playing', title: 'Party Mix' } },
      statusMessage: 'Previous playlist could not start.',
    })).toMatchObject({ key: 'playing', sourceType: 'apple', sourceLabel: 'Party Mix', actionKey: 'pause_apple' });
  });

  test('distinguishes starting, deferred, connection, and local playback states', () => {
    expect(deriveBackgroundAudioState({ applePendingId: 'p1', applePlaylistTitle: 'Mix' }).key).toBe('starting');
    expect(deriveBackgroundAudioState({ room: { autoBgMusic: true }, performanceActive: true, appleAuthorized: true, applePlaylistId: 'p1' }).key).toBe('deferred');
    expect(deriveBackgroundAudioState({ applePlaylistId: 'p1', appleAuthorized: false })).toMatchObject({ key: 'needs_connection', actionKey: 'connect_apple' });
    expect(deriveBackgroundAudioState({ room: { bgMusicPlaying: true }, localTrackId: 'u1', localTrackTitle: 'House Mix' })).toMatchObject({ key: 'playing', sourceType: 'local' });
  });

  test('uses confirmed local runtime evidence instead of an optimistic room flag', () => {
    expect(deriveBackgroundAudioState({
      room: { backgroundAudioPlayback: { type: 'local_upload', status: 'playing', id: 'u1', title: 'House Mix' } },
    })).toMatchObject({ key: 'playing', sourceType: 'local', sourceLabel: 'House Mix', actionKey: 'pause_local', actionLabel: 'Pause Background' });
    expect(deriveBackgroundAudioState({
      room: { bgMusicPlaying: true, backgroundAudioPlayback: { type: 'local_upload', status: 'blocked', id: 'u1', title: 'House Mix', reason: 'Browser playback is blocked.' } },
    })).toMatchObject({ key: 'blocked', actionKey: 'start_local', detail: 'Browser playback is blocked.' });
  });

  test('shows local recovery as deferred while a performance is active', () => {
    expect(deriveBackgroundAudioState({
      room: { autoBgMusic: true, backgroundAudioPlayback: { type: 'local_upload', status: 'paused', id: 'u1', title: 'House Mix' } },
      performanceActive: true,
    })).toMatchObject({ key: 'deferred', sourceLabel: 'House Mix', actionKey: '' });
  });

  test('offers recovery only when host action can change the state', () => {
    expect(deriveBackgroundAudioState({ applePlaylistId: 'p1', appleAuthorized: true })).toMatchObject({ key: 'ready', actionKey: 'retry_apple' });
    expect(deriveBackgroundAudioState({ localTrackId: 'u1' })).toMatchObject({ key: 'ready', actionKey: 'start_local' });
    expect(deriveBackgroundAudioState({ room: { autoBgMusic: true }, performanceActive: true, localTrackId: 'u1' }).actionKey).toBe('');
  });

  test('flags stale Apple playing claims only when heartbeat evidence exists', () => {
    expect(deriveBackgroundAudioState({
      room: { appleMusicPlayback: { type: 'playlist', status: 'playing', title: 'Mix', lastHeartbeatAt: 1000 } },
      nowMs: 60000,
    })).toMatchObject({ key: 'stale', actionKey: 'retry_apple', heartbeatAgeMs: 59000 });
    expect(deriveBackgroundAudioState({
      room: { appleMusicPlayback: { type: 'playlist', status: 'playing', title: 'Legacy Mix' } },
      nowMs: 60000,
    }).key).toBe('playing');
  });

  test('keeps provider capabilities explicit and licensing-safe', () => {
    expect(getBackgroundAudioCapability({ sourceType: 'local' })).toMatchObject({ key: 'host_playback', label: 'Plays on Host device' });
    expect(getBackgroundAudioCapability({ sourceType: 'apple', appleAuthorized: false })).toMatchObject({ key: 'connection_required' });
    expect(getBackgroundAudioCapability({ sourceType: 'youtube' })).toMatchObject({ key: 'embeddable_stage_media' });
    expect(getBackgroundAudioCapability({ sourceType: 'spotify' })).toMatchObject({ key: 'external_only' });
  });

  test('builds a safe QA snapshot without room or authorization data', () => {
    expect(buildBackgroundAudioQaSnapshot({ key: 'stale', sourceType: 'apple', sourceLabel: 'Mix', actionKey: 'retry_apple', heartbeatAgeMs: 59000 })).toEqual({
      key: 'stale', label: '', sourceType: 'apple', sourceLabel: 'Mix', tone: 'idle', actionKey: 'retry_apple', heartbeatAgeMs: 59000,
      capabilityKey: 'connected_host_playback', capabilityLabel: 'Connected Host playback',
    });
  });
});
