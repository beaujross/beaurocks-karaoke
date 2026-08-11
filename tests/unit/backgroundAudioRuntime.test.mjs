import { describe, expect, test, vi } from 'vitest';
import {
  buildLocalBackgroundPlayback,
  getBackgroundStageTransition,
  getPersistableBackgroundAudioUrl,
  startBackgroundAudioElement,
} from '../../src/lib/backgroundAudioRuntime.js';

describe('backgroundAudioRuntime', () => {
  test('reports playing only after the media element confirms playback', async () => {
    const audio = { src: '', paused: false, play: vi.fn().mockResolvedValue(undefined) };
    await expect(startBackgroundAudioElement(audio, { url: 'https://cdn.test/mix.mp3' })).resolves.toEqual({
      ok: true,
      status: 'playing',
      reason: '',
    });
    expect(audio.src).toBe('https://cdn.test/mix.mp3');
  });

  test('turns autoplay rejection into an actionable blocked state', async () => {
    const error = Object.assign(new Error('play() failed because the user did not interact'), { name: 'NotAllowedError' });
    const audio = { src: '', paused: true, play: vi.fn().mockRejectedValue(error) };
    await expect(startBackgroundAudioElement(audio)).resolves.toMatchObject({
      ok: false,
      status: 'blocked',
      reason: expect.stringMatching(/Start Background/),
    });
  });

  test('does not accept a resolved play promise when the element remains paused', async () => {
    const audio = { src: '', paused: true, play: vi.fn().mockResolvedValue(undefined) };
    await expect(startBackgroundAudioElement(audio)).resolves.toMatchObject({ ok: false, status: 'blocked' });
  });

  test('builds a safe persisted local playback observation', () => {
    expect(buildLocalBackgroundPlayback({
      track: { id: 'upload_1', name: 'House Mix', mediaUrl: 'https://cdn.test/house.mp3' },
      status: 'playing',
      nowMs: 1234,
    })).toEqual({
      type: 'local_upload',
      id: 'upload_1',
      title: 'House Mix',
      url: 'https://cdn.test/house.mp3',
      status: 'playing',
      reason: '',
      lastReportedAt: 1234,
    });
  });

  test('keeps browser-session blob URLs out of shared room state', () => {
    expect(getPersistableBackgroundAudioUrl('blob:https://host.beaurocks.app/session-id')).toBe('');
    expect(getPersistableBackgroundAudioUrl('https://cdn.test/house.mp3')).toBe('https://cdn.test/house.mp3');
    expect(buildLocalBackgroundPlayback({
      track: { id: 'upload_2', name: 'Local-only Mix', url: 'blob:https://host.beaurocks.app/session-id' },
      status: 'paused',
      nowMs: 2000,
    })).toMatchObject({
      id: 'upload_2',
      url: '',
      status: 'paused',
    });
  });

  test('defines the existing auto-background performance pause and recovery policy', () => {
    expect(getBackgroundStageTransition({ performanceActive: true, backgroundActive: true, autoBackgroundEnabled: true })).toEqual({
      action: 'pause',
      restoreAfterPerformance: true,
    });
    expect(getBackgroundStageTransition({ performanceActive: false, backgroundActive: false, autoBackgroundEnabled: true }).action).toBe('restore');
    expect(getBackgroundStageTransition({ performanceActive: true, backgroundActive: true, autoBackgroundEnabled: false }).action).toBe('none');
  });
});
