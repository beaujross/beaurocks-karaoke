import { describe, expect, test } from 'vitest';
import {
  BACKGROUND_AUDIO_SOURCES,
  buildBackgroundAudioSourcePatch,
  resolveBackgroundAudioSource,
} from '../../src/lib/backgroundAudioSource.js';

describe('background audio source selection', () => {
  test('uses the explicit source even when an Apple playlist is remembered', () => {
    expect(resolveBackgroundAudioSource({
      room: {
        backgroundAudioSource: BACKGROUND_AUDIO_SOURCES.beaurocks,
        appleMusicAutoPlaylistId: 'pl.remembered',
      },
    })).toBe(BACKGROUND_AUDIO_SOURCES.beaurocks);
  });

  test('preserves legacy Apple rooms until a host explicitly switches', () => {
    expect(resolveBackgroundAudioSource({
      room: { appleMusicAutoPlaylistId: 'pl.legacy' },
    })).toBe(BACKGROUND_AUDIO_SOURCES.appleMusic);
  });

  test('defaults rooms without Apple configuration to the BeauRocks loop', () => {
    expect(resolveBackgroundAudioSource({ room: {} })).toBe(BACKGROUND_AUDIO_SOURCES.beaurocks);
  });

  test('builds mutually exclusive runtime evidence patches', () => {
    expect(buildBackgroundAudioSourcePatch(BACKGROUND_AUDIO_SOURCES.appleMusic)).toEqual({
      backgroundAudioSource: BACKGROUND_AUDIO_SOURCES.appleMusic,
      bgMusicPlaying: false,
      bgMusicUrl: '',
      backgroundAudioPlayback: null,
    });
    expect(buildBackgroundAudioSourcePatch(BACKGROUND_AUDIO_SOURCES.beaurocks)).toEqual({
      backgroundAudioSource: BACKGROUND_AUDIO_SOURCES.beaurocks,
      appleMusicPlayback: null,
    });
  });
});
