const normalizeCatalogText = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/\b(karaoke|instrumental|backing track|lyrics?|official|version|hd|4k)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const readCatalogTitle = (item = {}) => String(item.trackName || item.title || item.songTitle || '').trim();
const readCatalogArtist = (item = {}) => String(item.artistName || item.artist || '').trim();

export const getUnifiedCatalogSongKey = (item = {}) => {
  const canonicalSongId = String(item.canonicalSongId || item.songId || '').trim();
  if (canonicalSongId) return `song:${canonicalSongId}`;
  const appleMusicId = String(item.appleMusicId || item.trackId || '').trim();
  const source = String(item.source || '').trim().toLowerCase();
  if ((source === 'apple' || source === 'itunes') && appleMusicId) return `song:apple:${appleMusicId}`;
  const title = normalizeCatalogText(readCatalogTitle(item));
  const artist = normalizeCatalogText(readCatalogArtist(item));
  return `intent:${title}__${artist || 'unknown'}`;
};

const isTvReady = (item = {}) => {
  const source = String(item.source || '').trim().toLowerCase();
  if (source === 'youtube') {
    return item.embeddable === true && item.playable !== false && item.youtubePlaybackStatus !== 'not_embeddable';
  }
  return source === 'local' || source === 'upload' || source === 'known';
};

const candidatePriority = (item = {}) => {
  const source = String(item.source || '').trim().toLowerCase();
  const sourceReason = String(item.sourceReason || '').trim().toLowerCase();
  const tvReady = isTvReady(item);
  return (tvReady ? 1000 : 0)
    + (sourceReason === 'curated_browse' ? 180 : sourceReason === 'youtube_index' ? 150 : 0)
    + Math.max(0, Number(item.rankingScore || 0))
    + Math.max(0, Number(item.qualityScore || 0))
    + Math.min(100, Math.max(0, Number(item.successCount || 0)) * 5)
    + (source === 'youtube' ? 30 : source === 'local' ? 25 : source === 'itunes' || source === 'apple' ? 10 : 0);
};

export const getCatalogRenditionCapability = (item = {}) => {
  const source = String(item.source || '').trim().toLowerCase();
  if (source === 'youtube') {
    if (isTvReady(item)) {
      return { key: 'tv_karaoke', label: 'TV Karaoke', detail: 'Plays inside BeauRocks TV', tone: 'ready' };
    }
    return { key: 'external_playback', label: 'External Playback', detail: 'Requires a separate host window', tone: 'external' };
  }
  if (source === 'apple' || source === 'itunes') {
    return { key: 'apple_sing_along', label: 'Apple Sing-Along', detail: 'Full-song sing-along from Apple Music', tone: 'apple' };
  }
  if (source === 'local' || source === 'upload') {
    return { key: 'room_upload', label: 'Room Upload', detail: 'Uses media already available to this room', tone: 'local' };
  }
  if (source === 'known' || (item.mediaUrl && item.playable !== false)) {
    return { key: 'known_backing', label: 'Known Backing', detail: 'Reusable catalog rendition', tone: 'known' };
  }
  return { key: 'review_needed', label: 'Review Needed', detail: 'Confirm playback before queueing', tone: 'review' };
};

const decorateCatalogCapability = (item = {}) => {
  const capability = getCatalogRenditionCapability(item);
  return {
    ...item,
    catalogCapabilityKey: capability.key,
    catalogCapabilityLabel: capability.label,
    catalogCapabilityDetail: capability.detail,
    catalogCapabilityTone: capability.tone,
  };
};

export const groupUnifiedCatalogResults = (items = []) => {
  const groups = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const key = getUnifiedCatalogSongKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  return [...groups.entries()].map(([catalogSongKey, candidates]) => {
    const ranked = [...candidates].sort((left, right) => candidatePriority(right) - candidatePriority(left)).map(decorateCatalogCapability);
    const recommended = ranked[0];
    const alternatives = ranked.slice(1);
    return {
      ...recommended,
      catalogSongKey,
      catalogCanonicalSongId: String(recommended.canonicalSongId || recommended.songId || '').trim(),
      catalogAlternatives: alternatives,
      catalogVersionCount: ranked.length,
      catalogRecommendedTvReady: isTvReady(recommended),
    };
  });
};

export const enrichCatalogResultsWithCanonicalIdentity = async (items = [], resolveBatch = null) => {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length || typeof resolveBatch !== 'function') return safeItems;
  const payload = safeItems.map((item) => {
    const source = String(item?.source || '').trim().toLowerCase();
    return {
      songId: String(item?.canonicalSongId || item?.songId || '').trim(),
      title: readCatalogTitle(item),
      artist: readCatalogArtist(item) || 'Unknown',
      source,
      mediaUrl: String(item?.mediaUrl || item?.url || '').trim(),
      appleMusicId: String(item?.appleMusicId || ((source === 'apple' || source === 'itunes') ? item?.trackId || '' : '')).trim(),
    };
  });
  const resolutions = await resolveBatch(payload);
  const byIndex = new Map((Array.isArray(resolutions) ? resolutions : []).map((resolution, index) => [
    Number.isInteger(Number(resolution?.index)) ? Number(resolution.index) : index,
    resolution,
  ]));
  return safeItems.map((item, index) => {
    const resolution = byIndex.get(index);
    if (!resolution?.found || !String(resolution.songId || '').trim()) return item;
    return {
      ...item,
      canonicalSongId: String(resolution.songId).trim(),
      catalogResolvedTrackId: String(resolution.trackId || '').trim(),
      catalogDisplayTitle: String(resolution.title || readCatalogTitle(item)).trim(),
      catalogDisplayArtist: String(resolution.artist || readCatalogArtist(item) || 'Unknown').trim(),
      catalogArtworkUrl: String(resolution.artworkUrl || '').trim(),
      catalogMatchedBy: String(resolution.matchedBy || '').trim(),
    };
  });
};
