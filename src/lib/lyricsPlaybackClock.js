const normalizeToken = (value = '') => String(value || '').trim().toLowerCase();

const toPositiveMs = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
};

const readPositionSec = (...values) => {
    for (const value of values) {
        if (value === null || value === undefined || value === '') continue;
        const number = Number(value);
        if (Number.isFinite(number) && number >= 0) return number;
    }
    return null;
};

const PLAYING_STATES = new Set(['playing', 'starting', 'buffering']);

const isCurrentPerformanceSession = ({ session = {}, current = {} } = {}) => {
    const sessionSongId = String(session?.songId || '').trim();
    const currentSongId = String(current?.id || '').trim();
    return !sessionSongId || !currentSongId || sessionSongId === currentSongId;
};

const resolveAnchoredClock = ({
    positionSec = null,
    startedAt = 0,
    reportedAt = 0,
    explicitPausedAt = 0,
    isPlaying = false,
    source = 'stage_media'
} = {}) => {
    const anchorAt = reportedAt || startedAt;
    const anchoredStartTime = positionSec !== null && anchorAt
        ? Math.max(1, anchorAt - (positionSec * 1000))
        : startedAt;
    const pausedAt = isPlaying
        ? 0
        : (positionSec !== null && anchoredStartTime
            ? anchoredStartTime + (positionSec * 1000)
            : (explicitPausedAt || anchorAt));

    return {
        startTime: anchoredStartTime,
        pausedAt,
        isPlaying,
        source,
        positionSec: positionSec ?? 0
    };
};

export const isAppleLyricsPerformance = ({ room = {}, current = {} } = {}) => {
    const session = room?.currentPerformanceSession || {};
    const meta = room?.currentPerformanceMeta || {};
    const playback = room?.appleMusicPlayback || {};
    const sourceIsApple = normalizeToken(session?.sourceType) === 'apple_music'
        || normalizeToken(meta?.source) === 'apple_music';
    if (sourceIsApple) return true;

    if (normalizeToken(playback?.type) !== 'song') return false;
    const currentAppleId = String(current?.appleMusicId || '').trim();
    const playbackAppleId = String(playback?.id || playback?.trackId || '').trim();
    return !!currentAppleId && !!playbackAppleId && currentAppleId === playbackAppleId;
};

export const resolveLyricsPlaybackClock = ({ room = {}, current = {} } = {}) => {
    if (!isAppleLyricsPerformance({ room, current })) {
        const session = room?.currentPerformanceSession || {};
        const sourceType = normalizeToken(session?.sourceType);
        const positionSec = readPositionSec(session?.playerPositionSec);
        const reportedAt = toPositiveMs(
            session?.lastReportedAtMs
            || session?.lastHeartbeatAtMs
        );
        const startedAt = toPositiveMs(
            session?.playbackStartedAtMs
            || session?.startedAtMs
            || room?.currentPerformanceMeta?.startedAtMs
            || room?.videoStartTimestamp
        );
        if (
            sourceType
            && sourceType !== 'none'
            && isCurrentPerformanceSession({ session, current })
            && positionSec !== null
            && (reportedAt || startedAt)
        ) {
            const status = normalizeToken(session?.playbackState);
            const isPlaying = status
                ? PLAYING_STATES.has(status)
                : room?.videoPlaying === true;
            return resolveAnchoredClock({
                positionSec,
                startedAt,
                reportedAt,
                explicitPausedAt: toPositiveMs(session?.pausedAtMs || room?.pausedAt),
                isPlaying,
                source: sourceType
            });
        }
        return {
            startTime: toPositiveMs(room?.videoStartTimestamp),
            pausedAt: toPositiveMs(room?.pausedAt),
            isPlaying: room?.videoPlaying === true,
            source: 'stage_media'
        };
    }

    const session = room?.currentPerformanceSession || {};
    const playback = room?.appleMusicPlayback || {};
    const status = normalizeToken(playback?.status || session?.playbackState);
    const positionSec = readPositionSec(
        session?.playerPositionSec,
        playback?.positionSec
    );
    const startedAt = toPositiveMs(
        playback?.startedAt
        || session?.playbackStartedAtMs
        || session?.startedAtMs
        || room?.currentPerformanceMeta?.startedAtMs
    );
    const reportedAt = toPositiveMs(
        playback?.lastReportedAt
        || session?.lastReportedAtMs
        || playback?.pausedAt
        || session?.pausedAtMs
    );
    return resolveAnchoredClock({
        positionSec,
        startedAt,
        reportedAt,
        explicitPausedAt: toPositiveMs(playback?.pausedAt || session?.pausedAtMs),
        isPlaying: PLAYING_STATES.has(status),
        source: 'apple_music'
    });
};
