const APPLE_COMPLETION_GRACE_SEC = 3;

const normalizeText = (value = '') => String(value || '').trim();
const normalizeKey = (value = '') => normalizeText(value).toLowerCase();

const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDurationSec = (...values) => {
    for (const value of values) {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric > 0) {
            return Math.max(1, Math.round(numeric));
        }
    }
    return 0;
};

const resolveAppleTrackId = (value = {}) =>
    normalizeText(
        value?.id
        || value?.playParams?.id
        || value?.attributes?.playParams?.id
        || value?.attributes?.playParams?.catalogId
        || value?.attributes?.playParams?.musicKit_databaseID
    );

const normalizeApplePlaybackStatus = ({ instance = null, fallbackStatus = '' } = {}) => {
    const rawPlaybackState = normalizeKey(instance?.playbackState || instance?.playerState || '');
    if (rawPlaybackState.includes('play')) return 'playing';
    if (rawPlaybackState.includes('pause')) return 'paused';
    if (rawPlaybackState.includes('stop')) return 'stopped';
    if (rawPlaybackState.includes('end') || rawPlaybackState.includes('complete')) return 'ended';
    if (instance?.isPlaying === true) return 'playing';
    const fallback = normalizeKey(fallbackStatus);
    if (fallback === 'playing' || fallback === 'paused' || fallback === 'ended' || fallback === 'stopped') {
        return fallback;
    }
    return 'idle';
};

export const getApplePlaybackSnapshot = (instance = null, {
    fallbackTrackId = '',
    fallbackDurationSec = 0,
    fallbackStatus = ''
} = {}) => {
    if (!instance) return null;
    const nowPlayingItem = instance?.nowPlayingItem || instance?.queue?.currentItem || null;
    const durationSec = normalizeDurationSec(
        toFiniteNumber(instance?.currentPlaybackDuration, 0),
        toFiniteNumber(instance?.nowPlayingItem?.attributes?.durationInMillis, 0) / 1000,
        toFiniteNumber(instance?.nowPlayingItem?.durationInMillis, 0) / 1000,
        fallbackDurationSec
    );
    const currentTimeSec = Math.max(
        0,
        toFiniteNumber(instance?.currentPlaybackTime, -1),
        toFiniteNumber(instance?.playbackTime, -1),
        0
    );
    return {
        trackId: resolveAppleTrackId(nowPlayingItem) || normalizeText(fallbackTrackId),
        currentTimeSec: Number.isFinite(currentTimeSec) ? currentTimeSec : 0,
        durationSec,
        status: normalizeApplePlaybackStatus({ instance, fallbackStatus }),
        rawPlaybackState: normalizeKey(instance?.playbackState || instance?.playerState || '')
    };
};

export const buildApplePlaybackSyncPatch = ({
    session = null,
    applePlayback = null,
    snapshot = null,
    now = Date.now()
} = {}) => {
    if (!snapshot) return null;
    const normalizedSessionSource = normalizeKey(session?.sourceType);
    const sessionTrackId = normalizeText(session?.appleMusicId);
    const playbackTrackId = normalizeText(applePlayback?.id);
    const snapshotTrackId = normalizeText(snapshot?.trackId);
    const effectiveTrackId = snapshotTrackId || sessionTrackId || playbackTrackId;
    const sessionOwnsPlayback = normalizedSessionSource === 'apple_music'
        && (!sessionTrackId || !effectiveTrackId || sessionTrackId === effectiveTrackId);
    const nowValue = Math.max(0, Math.floor(Number(now || Date.now()) || Date.now()));
    const durationSec = normalizeDurationSec(
        snapshot?.durationSec,
        session?.playerReportedDurationSec,
        session?.expectedDurationSec,
        applePlayback?.durationSec
    );
    const currentTimeSec = Math.max(
        0,
        Math.round(toFiniteNumber(snapshot?.currentTimeSec, 0) * 10) / 10
    );
    const previousStatus = normalizeKey(applePlayback?.status);
    const rawState = normalizeKey(snapshot?.rawPlaybackState);
    const forcedEnded = rawState.includes('ended') || rawState.includes('complete');
    const reachedEnd = durationSec > 0 && currentTimeSec >= Math.max(1, durationSec - APPLE_COMPLETION_GRACE_SEC);
    const patch = {};

    if (effectiveTrackId && effectiveTrackId !== playbackTrackId) {
        patch['appleMusicPlayback.id'] = effectiveTrackId;
    }
    if (durationSec > 0) {
        patch['appleMusicPlayback.durationSec'] = durationSec;
        if (sessionOwnsPlayback) {
            patch['currentPerformanceSession.playerReportedDurationSec'] = durationSec;
        }
    }
    patch['appleMusicPlayback.lastReportedAt'] = nowValue;
    patch['appleMusicPlayback.positionSec'] = currentTimeSec;

    if (snapshot.status === 'playing') {
        patch['appleMusicPlayback.status'] = 'playing';
        patch['appleMusicPlayback.lastHeartbeatAt'] = nowValue;
        if (sessionOwnsPlayback) {
            patch['currentPerformanceSession.playbackState'] = 'playing';
            patch['currentPerformanceSession.lastHeartbeatAtMs'] = nowValue;
            patch['currentPerformanceSession.lastReportedAtMs'] = nowValue;
            patch['currentPerformanceSession.playerPositionSec'] = currentTimeSec;
            if (!Number(session?.playbackStartedAtMs || 0)) {
                patch['currentPerformanceSession.playbackStartedAtMs'] = nowValue;
            }
        }
        return patch;
    }

    if (snapshot.status === 'paused') {
        patch['appleMusicPlayback.status'] = 'paused';
        patch['appleMusicPlayback.pausedAt'] = nowValue;
        if (sessionOwnsPlayback) {
            patch['currentPerformanceSession.playbackState'] = 'paused';
            patch['currentPerformanceSession.pausedAtMs'] = nowValue;
            patch['currentPerformanceSession.lastReportedAtMs'] = nowValue;
            patch['currentPerformanceSession.playerPositionSec'] = currentTimeSec;
        }
        return patch;
    }

    if (snapshot.status === 'ended' || forcedEnded || reachedEnd) {
        patch['appleMusicPlayback.status'] = 'ended';
        patch['appleMusicPlayback.endedAt'] = nowValue;
        patch['appleMusicPlayback.completionReason'] = 'player_ended';
        if (sessionOwnsPlayback) {
            patch['currentPerformanceSession.playbackState'] = 'ended';
            patch['currentPerformanceSession.lastHeartbeatAtMs'] = nowValue;
            patch['currentPerformanceSession.lastReportedAtMs'] = nowValue;
            patch['currentPerformanceSession.playerPositionSec'] = currentTimeSec || durationSec;
            patch['currentPerformanceSession.endedAtMs'] = nowValue;
            patch['currentPerformanceSession.completionReason'] = 'player_ended';
        }
        return patch;
    }

    if (snapshot.status === 'stopped') {
        patch['appleMusicPlayback.status'] = previousStatus === 'playing' ? 'paused' : 'stopped';
        if (sessionOwnsPlayback) {
            patch['currentPerformanceSession.playbackState'] = previousStatus === 'playing' ? 'paused' : normalizeKey(session?.playbackState || 'paused');
            patch['currentPerformanceSession.lastReportedAtMs'] = nowValue;
            patch['currentPerformanceSession.playerPositionSec'] = currentTimeSec;
        }
        return patch;
    }

    return Object.keys(patch).length ? patch : null;
};
