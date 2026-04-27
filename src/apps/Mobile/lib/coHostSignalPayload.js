export const getAudienceSongArtworkUrl = (song = {}) =>
    String(
        song?.albumArtUrl
        || song?.artworkUrl100
        || song?.artworkUrl60
        || song?.artworkUrl
        || song?.art
        || ''
    ).trim();

export const formatElapsedClock = (valueSec = 0) => {
    const totalSec = Math.max(0, Math.round(Number(valueSec || 0) || 0));
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const timestampToMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') {
        const nanos = typeof value?.nanoseconds === 'number' ? value.nanoseconds : 0;
        return (value.seconds * 1000) + Math.floor(nanos / 1000000);
    }
    return 0;
};

export const buildPerformanceReactionMeta = (currentSinger = {}) => {
    const payload = {};
    const performanceId = String(currentSinger?.id || '').trim();
    const performanceSongId = String(currentSinger?.songId || '').trim();
    const performanceSingerUid = String(currentSinger?.singerUid || '').trim();
    const performanceSingerName = String(currentSinger?.singerName || '').trim();
    const performanceStartedAtMs = timestampToMs(currentSinger?.performingStartedAt) || timestampToMs(currentSinger?.timestamp) || 0;
    if (performanceId) payload.performanceId = performanceId;
    if (performanceSongId) payload.performanceSongId = performanceSongId;
    if (performanceSingerUid) payload.performanceSingerUid = performanceSingerUid;
    if (performanceSingerName) payload.performanceSingerName = performanceSingerName;
    if (performanceStartedAtMs > 0) payload.performanceStartedAtMs = performanceStartedAtMs;
    return payload;
};

export const buildCurrentPerformanceSignalContext = (currentSinger = {}, nowMs = Date.now()) => {
    const artworkUrl = getAudienceSongArtworkUrl(currentSinger);
    const startedAtMs = timestampToMs(currentSinger?.performingStartedAt) || timestampToMs(currentSinger?.timestamp) || 0;
    const elapsedSec = startedAtMs > 0
        ? Math.max(0, Math.round((Number(nowMs || 0) - startedAtMs) / 1000))
        : 0;
    return {
        artworkUrl,
        singerName: String(currentSinger?.singerName || '').trim(),
        songTitle: String(currentSinger?.songTitle || '').trim(),
        artistName: String(currentSinger?.artist || currentSinger?.artistName || '').trim(),
        elapsedSec,
        elapsedLabel: startedAtMs > 0 ? `${formatElapsedClock(elapsedSec)} in` : '',
        isLive: !!String(currentSinger?.id || '').trim()
    };
};

export const buildCoHostSignalActivityPayload = ({
    meta = null,
    roomCode = '',
    actorUid = '',
    actorName = '',
    currentSinger = {},
    nowMs = Date.now(),
    iconFallback = '',
} = {}) => {
    if (!meta || !roomCode) return null;
    const performanceMeta = buildPerformanceReactionMeta(currentSinger);
    const performanceSongTitle = String(currentSinger?.songTitle || '').trim();
    const performanceArtistName = String(currentSinger?.artist || currentSinger?.artistName || '').trim();
    const performanceAlbumArtUrl = String(getAudienceSongArtworkUrl(currentSinger) || '').trim();
    const performanceStartedAtMs = Number(performanceMeta.performanceStartedAtMs || 0);
    const performanceElapsedSec = performanceStartedAtMs > 0
        ? Math.max(0, Math.round((Number(nowMs || 0) - performanceStartedAtMs) / 1000))
        : 0;

    return {
        roomCode,
        uid: String(actorUid || '').trim() || null,
        user: String(actorName || '').trim() || 'Co-Host',
        text: meta.activityText,
        icon: meta.emoji || iconFallback || null,
        type: 'cohost_signal',
        signalId: meta.id,
        signalLabel: meta.label,
        signalScope: performanceMeta.performanceId ? 'performance' : 'room',
        ...performanceMeta,
        performanceSongTitle: performanceSongTitle || null,
        performanceArtistName: performanceArtistName || null,
        performanceAlbumArtUrl: performanceAlbumArtUrl || null,
        performanceElapsedSec: performanceElapsedSec || 0,
    };
};
