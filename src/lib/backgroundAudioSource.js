export const BACKGROUND_AUDIO_SOURCES = Object.freeze({
  beaurocks: 'beaurocks_loop',
  appleMusic: 'apple_music',
});

const clean = (value = '') => String(value || '').trim().toLowerCase();

export const isBackgroundAudioSource = (value = '') => (
  Object.values(BACKGROUND_AUDIO_SOURCES).includes(clean(value))
);

export const resolveBackgroundAudioSource = ({
  source = '',
  room = {},
  applePlaylistId = '',
} = {}) => {
  const explicitSource = clean(source || room?.backgroundAudioSource);
  if (isBackgroundAudioSource(explicitSource)) return explicitSource;

  const configuredApplePlaylistId = clean(applePlaylistId || room?.appleMusicAutoPlaylistId);
  const playbackType = clean(room?.appleMusicPlayback?.type);
  if (configuredApplePlaylistId || ['playlist', 'station'].includes(playbackType)) {
    return BACKGROUND_AUDIO_SOURCES.appleMusic;
  }
  return BACKGROUND_AUDIO_SOURCES.beaurocks;
};

export const isAppleBackgroundAudioSource = (value = '') => (
  clean(value) === BACKGROUND_AUDIO_SOURCES.appleMusic
);

export const buildBackgroundAudioSourcePatch = (source = '') => {
  const normalizedSource = resolveBackgroundAudioSource({ source });
  return normalizedSource === BACKGROUND_AUDIO_SOURCES.appleMusic
    ? {
        backgroundAudioSource: normalizedSource,
        bgMusicPlaying: false,
        bgMusicUrl: '',
        backgroundAudioPlayback: null,
      }
    : {
        backgroundAudioSource: normalizedSource,
        appleMusicPlayback: null,
      };
};
