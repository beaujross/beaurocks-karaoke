import { BROWSE_CATEGORIES, TOPIC_HITS } from './browseLists';
import { decorateBrowseSongs } from './browseCatalog';

const extractYouTubeVideoId = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = raw.match(/^[a-zA-Z0-9_-]{11}$/);
  if (direct) return raw;
  const match = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] || '';
};

const buildArtworkUrl = (videoId = '') => (
  videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : ''
);

const normalizeCuratedSearchText = (value = '') => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

export const matchesCuratedKaraokeQuery = (entry = {}, query = '') => {
  const normalizedQuery = normalizeCuratedSearchText(query);
  if (!normalizedQuery) return true;
  const haystack = [
    entry?.trackName,
    entry?.artistName,
    entry?.browseSongKey,
    entry?.browseCategoryTitle,
    ...(Array.isArray(entry?.browseCategoryIds) ? entry.browseCategoryIds : []),
  ]
    .map((part) => normalizeCuratedSearchText(part))
    .filter(Boolean)
    .join(' ');
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
};

export const flattenBrowseDemandSongs = (groups = [BROWSE_CATEGORIES, TOPIC_HITS]) => {
  const flat = [];
  (Array.isArray(groups) ? groups : []).forEach((collection) => {
    (Array.isArray(collection) ? collection : []).forEach((category) => {
      (Array.isArray(category?.songs) ? category.songs : []).forEach((song, songIndex) => {
        flat.push({
          ...song,
          demandSource: 'browse_catalogue',
          browseCategoryId: category?.id || '',
          browseCategoryTitle: category?.title || '',
          browseCategoryRank: songIndex + 1,
        });
      });
    });
  });
  return flat;
};

export const buildBrowseCuratedYouTubeIndex = ({ playableOnly = true } = {}) => {
  const decorated = decorateBrowseSongs(flattenBrowseDemandSongs(), { playableOnly });
  const byKey = new Map();

  decorated.forEach((song) => {
    const backing = song?.backing || {};
    const videoId = String(backing.videoId || extractYouTubeVideoId(backing.mediaUrl)).trim();
    const mediaUrl = String(backing.mediaUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '')).trim();
    if (!mediaUrl || !videoId) return;

    const key = videoId || song?.browseSongKey || `${song?.title || ''}__${song?.artist || ''}`;
    const existing = byKey.get(key);
    const appearances = Number(existing?.curatedDemandScore || 0) + 1;
    const categoryIds = [
      ...(Array.isArray(existing?.browseCategoryIds) ? existing.browseCategoryIds : []),
      song?.browseCategoryId || '',
    ].filter(Boolean);

    byKey.set(key, {
      source: 'youtube',
      sourceReason: 'curated_browse',
      sourceDetail: 'Known playable Browse catalogue backing. No live YouTube search needed.',
      resolutionLayer: 'global_browse_index',
      videoId,
      trackName: String(song?.title || backing.label || backing.title || 'Karaoke Track').trim() || 'Karaoke Track',
      artistName: String(song?.artist || backing.channelTitle || 'Karaoke').trim() || 'Karaoke',
      artworkUrl100: buildArtworkUrl(videoId),
      url: mediaUrl,
      durationSec: Math.max(0, Math.round(Number(backing.durationSec || 0))),
      playable: backing.playable === true,
      embeddable: backing.embeddable !== false,
      uploadStatus: backing.uploadStatus || '',
      privacyStatus: backing.privacyStatus || '',
      youtubePlaybackStatus: backing.youtubePlaybackStatus || (backing.embeddable === false ? 'not_embeddable' : 'embeddable'),
      backingAudioOnly: backing.backingAudioOnly === true,
      curatedDemandScore: appearances,
      browseSongKey: song?.browseSongKey || '',
      browseCategoryIds: [...new Set(categoryIds)],
      browseCategoryTitle: existing?.browseCategoryTitle || song?.browseCategoryTitle || '',
    });
  });

  return [...byKey.values()].sort((left, right) => {
    const demandDelta = Number(right.curatedDemandScore || 0) - Number(left.curatedDemandScore || 0);
    if (demandDelta) return demandDelta;
    return `${left.trackName} ${left.artistName}`.localeCompare(`${right.trackName} ${right.artistName}`);
  });
};
export const searchCuratedYouTubeEntries = (entries = [], query = '') => (
  (Array.isArray(entries) ? entries : []).filter((entry) => matchesCuratedKaraokeQuery(entry, query))
);

export const searchBrowseCuratedYouTubeIndex = (query = '', options = {}) => (
  searchCuratedYouTubeEntries(buildBrowseCuratedYouTubeIndex(options), query)
);