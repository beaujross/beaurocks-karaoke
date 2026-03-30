import { BROWSE_BACKING_INDEX } from './browseBackingIndex';

const normalizeBrowseText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

export const buildBrowseSongKey = (title = '', artist = '') => {
  const safeTitle = normalizeBrowseText(title);
  const safeArtist = normalizeBrowseText(artist || 'unknown') || 'unknown';
  return `${safeTitle}__${safeArtist}`;
};

export const getBrowseBacking = (song = {}) => {
  const key = buildBrowseSongKey(song?.title || song?.songTitle || '', song?.artist || song?.artistName || '');
  return BROWSE_BACKING_INDEX[key] || null;
};

export const isApprovedPlayableBrowseSong = (song = {}) => {
  const backing = song?.backing || getBrowseBacking(song);
  return !!(
    backing
    && backing.approved === true
    && backing.playable === true
    && String(backing.mediaUrl || '').trim()
  );
};

export const decorateBrowseSong = (song = {}) => {
  const backing = getBrowseBacking(song);
  return {
    ...song,
    browseSongKey: buildBrowseSongKey(song?.title || song?.songTitle || '', song?.artist || song?.artistName || ''),
    backing,
    hasApprovedBacking: isApprovedPlayableBrowseSong({ ...song, backing }),
  };
};

export const decorateBrowseSongs = (songs = [], { playableOnly = false } = {}) => {
  const safeSongs = Array.isArray(songs) ? songs : [];
  const decorated = safeSongs.map((song) => decorateBrowseSong(song));
  return playableOnly ? decorated.filter((song) => song.hasApprovedBacking) : decorated;
};

