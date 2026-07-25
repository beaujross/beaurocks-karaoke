export const PLAYBACK_SELECTION_MODES = Object.freeze({
  songOnly: 'song_only',
  specificVersion: 'specific_version',
  customMedia: 'custom_media',
});

export const SONG_IDENTITY_STATUSES = Object.freeze({
  matched: 'matched',
  provisional: 'provisional',
  unmatched: 'unmatched',
  original: 'original',
});

const clean = (value = '') => String(value || '').trim();

const CONTENT_SOURCE_CAPABILITIES = Object.freeze({
  youtube: Object.freeze({
    integrationStatus: 'available',
    karaokeBacking: true,
    originalRecording: false,
    timedLyrics: false,
    leadVocalControl: false,
    vocalScoring: false,
    requiresHostConnection: false,
  }),
  apple_music: Object.freeze({
    integrationStatus: 'available',
    karaokeBacking: false,
    originalRecording: true,
    timedLyrics: false,
    lyricsAccess: 'metadata_only',
    leadVocalControl: false,
    vocalScoring: false,
    requiresHostConnection: true,
  }),
  local: Object.freeze({
    integrationStatus: 'available',
    karaokeBacking: true,
    originalRecording: true,
    timedLyrics: false,
    leadVocalControl: false,
    vocalScoring: false,
    requiresHostConnection: false,
  }),
  karafun: Object.freeze({
    integrationStatus: 'planned_partner',
    karaokeBacking: true,
    originalRecording: false,
    timedLyrics: true,
    lyricsAccess: 'partner_contract',
    leadVocalControl: true,
    vocalScoring: true,
    requiresHostConnection: true,
  }),
  spotify: Object.freeze({
    integrationStatus: 'planned',
    karaokeBacking: false,
    originalRecording: false,
    timedLyrics: false,
    leadVocalControl: false,
    vocalScoring: false,
    requiresHostConnection: true,
  }),
  unknown: Object.freeze({
    integrationStatus: 'unknown',
    karaokeBacking: false,
    originalRecording: false,
    timedLyrics: false,
    leadVocalControl: false,
    vocalScoring: false,
    requiresHostConnection: false,
  }),
});

export const normalizeContentSource = (value = '') => {
  const source = clean(value).toLowerCase();
  if (['apple', 'apple_music', 'itunes', 'music_kit', 'musickit'].includes(source)) return 'apple_music';
  if (['youtube', 'youtube_music', 'yt', 'yt_index', 'browse_catalog'].includes(source)) return 'youtube';
  if (['local', 'upload', 'room_upload', 'custom', 'custom_media'].includes(source)) return 'local';
  if (['karafun', 'kara_fun'].includes(source)) return 'karafun';
  if (source === 'spotify') return 'spotify';
  return source || 'unknown';
};

export const getContentSourceCapabilities = (value = '') => {
  const source = normalizeContentSource(value);
  return CONTENT_SOURCE_CAPABILITIES[source] || CONTENT_SOURCE_CAPABILITIES.unknown;
};

export const getContentSourceMeta = (value = '') => {
  const source = normalizeContentSource(value);
  const sources = {
    youtube: {
      id: 'youtube',
      label: 'YouTube',
      iconClass: 'fa-brands fa-youtube',
      className: 'border-red-300/35 bg-gradient-to-r from-red-500/20 to-fuchsia-500/10 text-red-50',
      dotClassName: 'bg-red-400',
    },
    apple_music: {
      id: 'apple_music',
      label: 'Apple Music',
      iconClass: 'fa-brands fa-apple',
      className: 'border-fuchsia-300/30 bg-gradient-to-r from-zinc-200/10 to-fuchsia-500/12 text-fuchsia-50',
      dotClassName: 'bg-fuchsia-300',
    },
    karafun: {
      id: 'karafun',
      label: 'KaraFun',
      iconClass: 'fa-solid fa-microphone-lines',
      className: 'border-violet-300/35 bg-gradient-to-r from-violet-500/18 to-amber-500/10 text-violet-50',
      dotClassName: 'bg-violet-300',
    },
    spotify: {
      id: 'spotify',
      label: 'Spotify',
      iconClass: 'fa-brands fa-spotify',
      className: 'border-emerald-300/35 bg-gradient-to-r from-emerald-500/18 to-cyan-500/10 text-emerald-50',
      dotClassName: 'bg-emerald-300',
    },
    local: {
      id: 'local',
      label: 'Room Upload',
      iconClass: 'fa-solid fa-file-audio',
      className: 'border-cyan-300/35 bg-gradient-to-r from-cyan-500/16 to-violet-500/10 text-cyan-50',
      dotClassName: 'bg-cyan-300',
    },
    unknown: {
      id: 'unknown',
      label: 'Playback Source',
      iconClass: 'fa-solid fa-wave-square',
      className: 'border-zinc-300/25 bg-gradient-to-r from-zinc-500/12 to-cyan-500/8 text-zinc-100',
      dotClassName: 'bg-zinc-300',
    },
  };
  return sources[source] || {
    ...sources.unknown,
    id: source,
    label: clean(value) || sources.unknown.label,
  };
};

export const normalizePlaybackSelectionMode = (value = '', input = {}) => {
  const explicitMode = clean(value).toLowerCase();
  if (Object.values(PLAYBACK_SELECTION_MODES).includes(explicitMode)) return explicitMode;

  const identityStatus = clean(input?.songIdentityStatus || input?.identityStatus).toLowerCase();
  const source = normalizeContentSource(input?.selectedPlaybackProvider || input?.trackSource || input?.source);
  if (
    identityStatus === SONG_IDENTITY_STATUSES.unmatched
    || source === 'local'
    || clean(input?.submittedVia).toLowerCase() === 'local_library'
  ) {
    return PLAYBACK_SELECTION_MODES.customMedia;
  }

  const resolutionLayer = clean(input?.resolutionLayer).toLowerCase();
  const audienceSelected = resolutionLayer.startsWith('audience_')
    || resolutionLayer === 'audience_selected'
    || clean(input?.mediaResolutionStatus).toLowerCase() === 'audience_selected';
  if (audienceSelected && (clean(input?.mediaUrl) || clean(input?.appleMusicId))) {
    return PLAYBACK_SELECTION_MODES.specificVersion;
  }
  return PLAYBACK_SELECTION_MODES.songOnly;
};

export const getQueuePlaybackSelection = (song = {}) => {
  const mode = normalizePlaybackSelectionMode(song?.playbackSelectionMode, song);
  const source = normalizeContentSource(
    song?.selectedPlaybackProvider
    || song?.trackSource
    || song?.source
  );
  const sourceMeta = getContentSourceMeta(source);
  const songIdentityStatus = clean(song?.songIdentityStatus || song?.identityStatus).toLowerCase()
    || (mode === PLAYBACK_SELECTION_MODES.customMedia
      ? SONG_IDENTITY_STATUSES.unmatched
      : clean(song?.songId)
        ? SONG_IDENTITY_STATUSES.matched
        : SONG_IDENTITY_STATUSES.provisional);

  if (mode === PLAYBACK_SELECTION_MODES.specificVersion) {
    return {
      mode,
      source,
      sourceMeta,
      songIdentityStatus,
      showSource: true,
      label: `${sourceMeta.label} pick`,
      detail: `The requester chose this ${sourceMeta.label} version.`,
    };
  }
  if (mode === PLAYBACK_SELECTION_MODES.customMedia) {
    return {
      mode,
      source: source === 'unknown' ? 'local' : source,
      sourceMeta: source === 'unknown' ? getContentSourceMeta('local') : sourceMeta,
      songIdentityStatus,
      showSource: true,
      label: 'Custom media',
      detail: 'This room media is playable without a public song match.',
    };
  }
  return {
    mode: PLAYBACK_SELECTION_MODES.songOnly,
    source,
    sourceMeta,
    songIdentityStatus,
    showSource: false,
    label: 'Song request',
    detail: 'The requester chose the song. The host can use the best available version.',
  };
};
