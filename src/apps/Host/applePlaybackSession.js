const APPLE_COMPLETION_GRACE_SEC = 3;
const APPLE_PLAYBACK_SYNC_POSITION_BUCKET_SEC = 10;
const APPLE_PLAYBACK_SYNC_MIN_INTERVAL_MS = 10000;

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
    const rawPlaybackValue = instance?.playbackState
        ?? instance?.playerState
        ?? instance?.player?.playbackState
        ?? instance?.player?.playerState
        ?? '';
    const rawPlaybackState = normalizeKey(rawPlaybackValue);
    const numericPlaybackState = Number(rawPlaybackValue);
    if (Number.isFinite(numericPlaybackState)) {
        if (numericPlaybackState === 2) return 'playing';
        if (numericPlaybackState === 3) return 'paused';
        if (numericPlaybackState === 4) return 'stopped';
        if (numericPlaybackState === 5 || numericPlaybackState === 10) return 'ended';
    }
    if (rawPlaybackState.includes('play')) return 'playing';
    if (rawPlaybackState.includes('pause')) return 'paused';
    if (rawPlaybackState.includes('stop')) return 'stopped';
    if (rawPlaybackState.includes('end') || rawPlaybackState.includes('complete')) return 'ended';
    if (instance?.isPlaying === true || instance?.player?.isPlaying === true) return 'playing';
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
    const player = instance?.player || null;
    const nowPlayingItem = instance?.nowPlayingItem
        || instance?.queue?.currentItem
        || player?.nowPlayingItem
        || player?.queue?.currentItem
        || null;
    const durationSec = normalizeDurationSec(
        toFiniteNumber(instance?.currentPlaybackDuration, 0),
        toFiniteNumber(instance?.nowPlayingItem?.attributes?.durationInMillis, 0) / 1000,
        toFiniteNumber(instance?.nowPlayingItem?.durationInMillis, 0) / 1000,
        toFiniteNumber(player?.currentPlaybackDuration, 0),
        toFiniteNumber(player?.nowPlayingItem?.attributes?.durationInMillis, 0) / 1000,
        toFiniteNumber(player?.nowPlayingItem?.durationInMillis, 0) / 1000,
        fallbackDurationSec
    );
    const currentTimeSec = Math.max(
        0,
        toFiniteNumber(instance?.currentPlaybackTime, -1),
        toFiniteNumber(instance?.playbackTime, -1),
        toFiniteNumber(player?.currentPlaybackTime, -1),
        toFiniteNumber(player?.playbackTime, -1),
        0
    );
    return {
        trackId: resolveAppleTrackId(nowPlayingItem) || normalizeText(fallbackTrackId),
        currentTimeSec: Number.isFinite(currentTimeSec) ? currentTimeSec : 0,
        durationSec,
        status: normalizeApplePlaybackStatus({ instance, fallbackStatus }),
        rawPlaybackState: normalizeKey(
            instance?.playbackState
            || instance?.playerState
            || player?.playbackState
            || player?.playerState
            || ''
        )
    };
};

export const shouldPauseApplePlaybackTransport = (instance = null) => {
    if (!instance) return false;
    const snapshot = getApplePlaybackSnapshot(instance, { fallbackStatus: '' });
    if (snapshot?.status !== 'playing') return false;
    const hasCurrentEntry = !!(
        instance?.nowPlayingItem
        || instance?.queue?.currentItem
        || instance?.player?.nowPlayingItem
        || instance?.player?.queue?.currentItem
    );
    return hasCurrentEntry
        || instance?.isPlaying === true
        || instance?.player?.isPlaying === true;
};


export const buildApplePlaybackSyncFingerprint = (patch = {}) => {
    if (!patch || typeof patch !== 'object') return '';
    const stable = {};
    Object.keys(patch).sort().forEach((key) => {
        if (key.includes('lastHeartbeat') || key.includes('lastReported')) return;
        if (key === 'appleMusicPlayback.positionSec' || key === 'currentPerformanceSession.playerPositionSec') return;
        if (key.endsWith('At') || key.endsWith('AtMs')) return;
        stable[key] = patch[key];
    });
    const positionSec = Math.max(
        0,
        toFiniteNumber(patch['appleMusicPlayback.positionSec'], toFiniteNumber(patch['currentPerformanceSession.playerPositionSec'], 0))
    );
    stable.positionBucket = Math.floor(positionSec / APPLE_PLAYBACK_SYNC_POSITION_BUCKET_SEC);
    return JSON.stringify(stable);
};

export const shouldWriteApplePlaybackSyncPatch = ({
    patch = null,
    previousSync = null,
    now = Date.now(),
    minIntervalMs = APPLE_PLAYBACK_SYNC_MIN_INTERVAL_MS
} = {}) => {
    if (!patch || typeof patch !== 'object' || Object.keys(patch).length === 0) {
        return { shouldWrite: false, fingerprint: '' };
    }
    const fingerprint = buildApplePlaybackSyncFingerprint(patch);
    const previousFingerprint = normalizeText(previousSync?.fingerprint);
    const previousWrittenAtMs = toFiniteNumber(previousSync?.writtenAtMs, 0);
    const nowMs = Math.max(0, Math.floor(Number(now || Date.now()) || Date.now()));
    if (!previousWrittenAtMs || fingerprint !== previousFingerprint) {
        return { shouldWrite: true, fingerprint };
    }
    return {
        shouldWrite: nowMs - previousWrittenAtMs >= Math.max(1000, Number(minIntervalMs) || APPLE_PLAYBACK_SYNC_MIN_INTERVAL_MS),
        fingerprint
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
    const playbackType = normalizeKey(applePlayback?.type);
    const playbackIsPlaylist = playbackType === 'playlist';
    const playbackTrackId = normalizeText(
        playbackIsPlaylist ? applePlayback?.trackId : applePlayback?.id
    );
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
        patch[playbackIsPlaylist ? 'appleMusicPlayback.trackId' : 'appleMusicPlayback.id'] = effectiveTrackId;
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
