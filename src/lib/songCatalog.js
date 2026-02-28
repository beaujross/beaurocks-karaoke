import { callFunction } from './firebase';

const CATALOG_WRITE_BLOCK_STORAGE_KEY = 'bross_catalog_write_block_until_ms_v1';
const CATALOG_WRITE_BLOCK_WINDOW_MS = 6 * 60 * 60 * 1000;

const readCatalogWriteBlockUntil = () => {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(CATALOG_WRITE_BLOCK_STORAGE_KEY);
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

let catalogWriteBlockedUntilMs = readCatalogWriteBlockUntil();

const persistCatalogWriteBlockUntil = (untilMs = 0) => {
  catalogWriteBlockedUntilMs = Math.max(0, Number(untilMs || 0));
  if (typeof window === 'undefined') return;
  try {
    if (catalogWriteBlockedUntilMs > 0) {
      window.localStorage.setItem(CATALOG_WRITE_BLOCK_STORAGE_KEY, String(catalogWriteBlockedUntilMs));
    } else {
      window.localStorage.removeItem(CATALOG_WRITE_BLOCK_STORAGE_KEY);
    }
  } catch {
    // Swallow localStorage errors in private browsing or strict environments.
  }
};

const isCatalogWriteTemporarilyBlocked = () => (
  Number(catalogWriteBlockedUntilMs || 0) > Date.now()
);

const markCatalogWriteBlocked = () => {
  persistCatalogWriteBlockUntil(Date.now() + CATALOG_WRITE_BLOCK_WINDOW_MS);
};

const clearCatalogWriteBlocked = () => {
  persistCatalogWriteBlockUntil(0);
};

const isPermissionDeniedError = (error = null) => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    code.includes('permission-denied')
    || code.includes('forbidden')
    || message.includes('permission-denied')
    || message.includes('403')
    || message.includes('host or moderator access required')
    || message.includes('catalog')
  );
};

const shouldSkipCatalogWrites = () => isCatalogWriteTemporarilyBlocked();

const setCatalogWriteAccess = (allowed = null) => {
  if (allowed === true) clearCatalogWriteBlocked();
  else if (allowed === false) markCatalogWriteBlocked();
};

const normalizeText = (value = '') => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
};

const buildSongKey = (title = '', artist = '') => {
  const cleanTitle = normalizeText(title || 'unknown');
  const cleanArtist = normalizeText(artist || 'unknown');
  return `${cleanTitle}__${cleanArtist}`;
};

const extractYouTubeId = (input = '') => {
  if (!input) return '';
  const match = input.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : '';
};

const ensureSong = async ({
  title,
  artist,
  artworkUrl,
  itunesId,
  appleMusicId,
  aliases = [],
  verifyMeta = false,
  verifiedBy = 'host'
} = {}) => {
  const safeTitle = (title || '').trim();
  if (!safeTitle) return null;
  const safeArtist = (artist || 'Unknown').trim() || 'Unknown';
  const fallbackSongId = buildSongKey(safeTitle, safeArtist);
  if (shouldSkipCatalogWrites()) {
    return { songId: fallbackSongId };
  }
  const payload = {
    title: safeTitle,
    artist: safeArtist,
    artworkUrl: artworkUrl || '',
    itunesId: itunesId || '',
    appleMusicId: appleMusicId || '',
    aliases,
    verifyMeta,
    verifiedBy
  };
  try {
    const res = await callFunction('ensureSong', payload);
    clearCatalogWriteBlocked();
    return { songId: res?.songId || fallbackSongId };
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      markCatalogWriteBlocked();
      return { songId: fallbackSongId };
    }
    throw error;
  }
};

const ensureTrack = async ({
  songId,
  source,
  mediaUrl,
  appleMusicId,
  label,
  duration,
  audioOnly,
  backingOnly,
  addedBy
} = {}) => {
  if (!songId) return null;
  if (shouldSkipCatalogWrites()) {
    return { trackId: null };
  }
  try {
    const res = await callFunction('ensureTrack', {
      songId,
      source: source || 'custom',
      mediaUrl: mediaUrl || '',
      appleMusicId: appleMusicId || '',
      label: label || null,
      duration: duration ?? null,
      audioOnly: !!audioOnly,
      backingOnly: !!backingOnly,
      addedBy: addedBy || ''
    });
    clearCatalogWriteBlocked();
    return { trackId: res?.trackId || null };
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      markCatalogWriteBlocked();
      return { trackId: null };
    }
    throw error;
  }
};

const resolveSongCatalog = async ({ songId, title, artist } = {}) => {
  const payload = {};
  if (songId) payload.songId = songId;
  if (title) payload.title = title;
  if (artist) payload.artist = artist;
  const res = await callFunction('resolveSongCatalog', payload);
  return res || null;
};

const upsertSongLyrics = async ({
  songId,
  title,
  artist,
  lyrics,
  lyricsTimed,
  lyricsSource,
  appleMusicId,
  language,
  artworkUrl,
  verifiedBy
} = {}) => {
  const payload = {
    songId: songId || '',
    title: title || '',
    artist: artist || '',
    lyrics: lyrics || '',
    lyricsTimed: Array.isArray(lyricsTimed) ? lyricsTimed : null,
    lyricsSource: lyricsSource || '',
    appleMusicId: appleMusicId || '',
    language: language || 'en',
    artworkUrl: artworkUrl || '',
    verifiedBy: verifiedBy || 'host'
  };
  const res = await callFunction('upsertSongLyrics', payload);
  return res || null;
};

const isSongVerified = (songDoc) => {
  const meta = songDoc?.verifiedMeta || {};
  return !!(meta.title && meta.artist && meta.artworkUrl);
};

export {
  buildSongKey,
  setCatalogWriteAccess,
  ensureSong,
  ensureTrack,
  resolveSongCatalog,
  upsertSongLyrics,
  extractYouTubeId,
  isSongVerified
};
