const clean = (value = '') => String(value || '').trim();

const clampDurationSec = (value = 0) =>
    Math.max(0, Math.round(Number(value || 0) || 0));

const resolveAppleMusicArtwork = (artwork = null, size = 320) => {
    const template = clean(artwork?.url);
    if (!template) return '';
    return template.replace('{w}', String(size)).replace('{h}', String(size));
};

const normalizeLocalDeadAirSong = (item = {}, index = 0) => {
    const mediaUrl = clean(item.mediaUrl || item.url);
    const title = clean(item.trackName || item.title || item.name);
    const mediaType = clean(item.mediaType).toLowerCase();
    if (!mediaUrl || !title || mediaType === 'image' || item.playable === false) return null;
    const durationSec = clampDurationSec(item.durationSec || item.duration);
    const offlineReady = item.offlineReady === true || item._local === true;
    const score = 10_000
        + (offlineReady ? 2_000 : 0)
        - index;
    return {
        id: clean(item.id) || `local_dead_air_${index}`,
        title,
        artist: clean(item.artistName || item.artist || (offlineReady ? 'Offline media' : 'Host media')),
        artworkUrl: clean(item.artworkUrl100 || item.artworkUrl || item.thumbnail),
        sourceLabel: offlineReady ? 'Offline local library' : 'Connected local library',
        mediaUrl,
        trackSource: 'local',
        durationSec,
        approved: true,
        playable: true,
        offlineReady,
        score,
        backing: {
            mediaUrl,
            trackSource: 'local',
            label: title,
            durationSec,
            approved: true,
            playable: true,
            score,
        },
    };
};

const normalizeAppleMusicDeadAirSong = (item = {}, index = 0) => {
    const attributes = item?.attributes || {};
    const playParams = attributes?.playParams || {};
    const appleMusicId = clean(
        playParams.catalogId
        || playParams.globalId
        || playParams.id
        || item.catalogId
        || item.appleMusicId
        || item.id
    );
    const title = clean(attributes.name || attributes.title || item.trackName || item.title);
    const artist = clean(attributes.artistName || item.artistName || item.artist);
    const isPlayable = attributes.isPlayable !== false && playParams.isPlayable !== false && item.playable !== false;
    if (!appleMusicId || !title || !isPlayable) return null;
    const mediaUrl = clean(attributes.url || item.url || item.mediaUrl)
        || `https://music.apple.com/song/${encodeURIComponent(appleMusicId)}`;
    const durationSec = clampDurationSec(
        Number(attributes.durationInMillis || 0) > 0
            ? Number(attributes.durationInMillis) / 1000
            : item.durationSec || item.duration
    );
    const score = 8_000 - index;
    return {
        id: `apple_${appleMusicId}`,
        title,
        artist,
        artworkUrl: resolveAppleMusicArtwork(attributes.artwork) || clean(item.artworkUrl100 || item.artworkUrl),
        sourceLabel: 'Connected Apple Music playlist',
        mediaUrl,
        appleMusicId,
        trackSource: 'apple',
        durationSec,
        approved: true,
        playable: true,
        score,
        backing: {
            mediaUrl,
            appleMusicId,
            trackSource: 'apple',
            label: title,
            durationSec,
            approved: true,
            playable: true,
            score,
        },
    };
};

const getCandidateKey = (song = {}) => {
    const source = clean(song.trackSource || song.backing?.trackSource).toLowerCase();
    const sourceId = clean(song.videoId || song.appleMusicId || song.id || song.mediaUrl || song.backing?.mediaUrl);
    return sourceId ? `${source}:${sourceId}` : '';
};

export const buildConnectedDeadAirSongs = ({
    localItems = [],
    appleMusicTracks = [],
    cachedYouTubeSongs = [],
    includeLocal = true,
    includeAppleMusic = true,
    includeYouTube = true,
    limit = 36,
} = {}) => {
    const candidates = [
        ...(includeLocal ? (Array.isArray(localItems) ? localItems : []).map(normalizeLocalDeadAirSong) : []),
        ...(includeAppleMusic ? (Array.isArray(appleMusicTracks) ? appleMusicTracks : []).map(normalizeAppleMusicDeadAirSong) : []),
        ...(includeYouTube ? (Array.isArray(cachedYouTubeSongs) ? cachedYouTubeSongs : []) : []),
    ].filter(Boolean);
    const bySourceId = new Map();
    candidates.forEach((song) => {
        const key = getCandidateKey(song);
        if (!key) return;
        const current = bySourceId.get(key);
        if (!current || Number(song.score || 0) > Number(current.score || 0)) {
            bySourceId.set(key, song);
        }
    });
    return [...bySourceId.values()]
        .sort((left, right) => (
            Number(right.score || 0) - Number(left.score || 0)
            || `${left.title} ${left.artist}`.localeCompare(`${right.title} ${right.artist}`)
        ))
        .slice(0, Math.max(0, Number(limit || 0)));
};

export const normalizeAppleMusicPlaylistTracks = (items = []) =>
    (Array.isArray(items) ? items : [])
        .map(normalizeAppleMusicDeadAirSong)
        .filter(Boolean);
