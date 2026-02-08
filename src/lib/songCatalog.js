import { callFunction } from './firebase';

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
  const res = await callFunction('ensureSong', payload);
  return { songId: res?.songId || buildSongKey(safeTitle, safeArtist) };
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
  return { trackId: res?.trackId || null };
};

const isSongVerified = (songDoc) => {
  const meta = songDoc?.verifiedMeta || {};
  return !!(meta.title && meta.artist && meta.artworkUrl);
};

export { buildSongKey, ensureSong, ensureTrack, extractYouTubeId, isSongVerified };
