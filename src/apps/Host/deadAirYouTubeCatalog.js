const normalizeText = (value = '') => String(value || '').trim();

const getVideoId = (entry = {}) => {
    const direct = normalizeText(entry.videoId || entry.id);
    if (direct) return direct;
    const url = normalizeText(entry.url || entry.mediaUrl);
    return url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1] || '';
};

const getRank = (entry = {}) => (
    (Math.max(0, Number(entry.successCount || 0)) * 100)
    + (Math.max(0, Number(entry.usageCount || 0)) * 20)
    + (Math.max(0, Number(entry.curatedDemandScore || 0)) * 10)
    + Math.max(0, Number(entry.rankingScore || 0))
    + Math.max(0, Number(entry.qualityScore || 0))
);

const normalizeCachedYouTubeSong = (entry = {}) => {
    const videoId = getVideoId(entry);
    if (!videoId || entry.playable === false || entry.embeddable === false) return null;
    const mediaUrl = normalizeText(entry.url || entry.mediaUrl) || `https://www.youtube.com/watch?v=${videoId}`;
    const title = normalizeText(entry.trackName || entry.title || entry.songTitle);
    if (!title || !mediaUrl) return null;
    return {
        videoId,
        title,
        artist: normalizeText(entry.artistName || entry.artist || entry.channelTitle || entry.channel),
        artworkUrl: normalizeText(entry.artworkUrl100 || entry.thumbnail),
        sourceLabel: 'Cached YouTube catalog',
        mediaUrl,
        trackSource: 'youtube',
        durationSec: Math.max(0, Math.round(Number(entry.durationSec || entry.duration || 0) || 0)),
        approved: true,
        playable: true,
        embeddable: true,
        score: getRank(entry),
        backing: {
            mediaUrl,
            trackSource: 'youtube',
            label: title,
            durationSec: Math.max(0, Math.round(Number(entry.durationSec || entry.duration || 0) || 0)),
            approved: true,
            playable: true,
            score: getRank(entry),
        },
    };
};

export const buildCachedYouTubeDeadAirSongs = ({
    roomIndex = [],
    accountIndex = [],
    globalIndex = [],
    curatedIndex = [],
    limit = 24,
} = {}) => {
    const byVideoId = new Map();
    [roomIndex, accountIndex, globalIndex, curatedIndex]
        .flatMap((entries) => Array.isArray(entries) ? entries : [])
        .map(normalizeCachedYouTubeSong)
        .filter(Boolean)
        .forEach((song) => {
            const existing = byVideoId.get(song.videoId);
            if (!existing || song.score > existing.score) byVideoId.set(song.videoId, song);
        });
    return [...byVideoId.values()]
        .sort((left, right) => right.score - left.score || `${left.title} ${left.artist}`.localeCompare(`${right.title} ${right.artist}`))
        .slice(0, Math.max(0, Number(limit || 0)));
};
