export const APPLE_MUSIC_PLAYBACK_START_TIMEOUT_MS = 10_000;
export const APPLE_MUSIC_AUTOMATIC_RETRY_COOLDOWN_MS = 30_000;

const clean = (value = '') => String(value || '').trim();

export const parseAppleMusicPlaylistId = (value = '') => {
  const trimmed = clean(value);
  if (!trimmed) return '';
  const match = trimmed.match(/(?:pl|p)\.[A-Za-z0-9._-]+/);
  return match?.[0] || trimmed;
};

export const isAppleMusicLibraryPlaylistId = (playlistId = '', sourceType = '') => {
  const id = clean(playlistId);
  if (id.startsWith('p.') && !id.startsWith('pl.')) return true;
  if (id.startsWith('pl.')) return false;
  return clean(sourceType).toLowerCase().includes('library');
};

export const buildAppleMusicPlaylistQueueDescriptor = (playlistId = '') => {
  const id = parseAppleMusicPlaylistId(playlistId);
  if (!id) return null;
  // MusicKit v1 accepts `playlist` for both catalog and Cloud Library IDs.
  // Its queue resolver detects p.* and calls api.library.playlist internally.
  return { playlist: id };
};

const getPlaylistCandidates = (playlistId = '', meta = {}) => [
  meta.playbackId,
  meta.catalogId,
  playlistId,
  meta.playParamsId,
  ...(Array.isArray(meta.alternatePlaylistIds) ? meta.alternatePlaylistIds : []),
];

export const buildAppleMusicPlaylistQueueAttempts = (playlistId = '', meta = {}) => {
  const attempts = [];
  const seenIds = new Set();

  getPlaylistCandidates(playlistId, meta).forEach((rawId) => {
    const id = parseAppleMusicPlaylistId(rawId);
    if (!id || seenIds.has(id)) return;
    seenIds.add(id);

    const descriptor = buildAppleMusicPlaylistQueueDescriptor(id);
    if (descriptor) attempts.push(descriptor);
  });

  return attempts;
};

export const buildAppleMusicPlaylistStartKey = (playlistId = '', meta = {}) => (
  buildAppleMusicPlaylistQueueAttempts(playlistId, meta)
    .map((descriptor) => JSON.stringify(descriptor))
    .join('|')
);

export const isAppleMusicAutomaticRetryCoolingDown = (
  state = {},
  key = '',
  nowMs = Date.now(),
  cooldownMs = APPLE_MUSIC_AUTOMATIC_RETRY_COOLDOWN_MS,
) => {
  const failedAtMs = Number(state?.failedAtMs || 0);
  return !!key
    && state?.key === key
    && failedAtMs > 0
    && Math.max(0, Number(nowMs) - failedAtMs) < cooldownMs;
};

export const createAppleMusicAutomaticRetryError = () => {
  const error = new Error('Apple Music automatic playlist retry is cooling down');
  error.code = 'APPLE_MUSIC_PLAYLIST_RETRY_COOLDOWN';
  return error;
};

export const isAppleMusicAutomaticRetryError = (error = null) => (
  error?.code === 'APPLE_MUSIC_PLAYLIST_RETRY_COOLDOWN'
);
