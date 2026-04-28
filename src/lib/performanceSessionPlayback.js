const normalizeKey = (value = '') => String(value || '').trim();

const normalizeStartedAtMs = (...values) => {
    for (const value of values) {
        const numeric = Number(value || 0);
        if (Number.isFinite(numeric) && numeric > 0) return numeric;
    }
    return 0;
};

export const attachPerformancePlaybackContext = (event = {}, { room = {}, current = {} } = {}) => {
    const sessionId = normalizeKey(room?.currentPerformanceSession?.sessionId);
    const songId = normalizeKey(room?.currentPerformanceSession?.songId || current?.id);
    const startedAtMs = normalizeStartedAtMs(
        room?.currentPerformanceSession?.startedAtMs,
        room?.currentPerformanceMeta?.startedAtMs,
        room?.videoStartTimestamp
    );
    const mediaUrl = normalizeKey(
        current?.mediaUrl
        || room?.currentPerformanceSession?.mediaUrl
        || room?.currentPerformanceMeta?.mediaUrl
        || room?.mediaUrl
    );

    return {
        ...event,
        ...(sessionId ? { performanceSessionId: sessionId } : {}),
        ...(songId ? { performanceSongId: songId } : {}),
        ...(startedAtMs > 0 ? { performanceStartedAtMs: startedAtMs } : {}),
        ...(mediaUrl ? { performanceMediaUrl: mediaUrl } : {})
    };
};

export const matchesActivePerformanceSession = ({
    event = {},
    session = {},
    currentPerformanceMeta = {},
    mediaUrl = ''
} = {}) => {
    const eventSessionId = normalizeKey(event?.performanceSessionId);
    const activeSessionId = normalizeKey(session?.sessionId);
    if (eventSessionId && activeSessionId && eventSessionId !== activeSessionId) return false;

    const eventSongId = normalizeKey(event?.performanceSongId);
    const activeSongId = normalizeKey(session?.songId);
    if (eventSongId && activeSongId && eventSongId !== activeSongId) return false;

    const eventStartedAtMs = normalizeStartedAtMs(event?.performanceStartedAtMs);
    const activeStartedAtMs = normalizeStartedAtMs(
        session?.startedAtMs,
        currentPerformanceMeta?.startedAtMs
    );
    if (eventStartedAtMs > 0 && activeStartedAtMs > 0 && eventStartedAtMs !== activeStartedAtMs) return false;

    const eventMediaUrl = normalizeKey(event?.performanceMediaUrl);
    const activeMediaUrl = normalizeKey(
        session?.mediaUrl
        || currentPerformanceMeta?.mediaUrl
        || mediaUrl
    );
    if (eventMediaUrl && activeMediaUrl && eventMediaUrl !== activeMediaUrl) return false;

    return true;
};

export const buildPerformanceSessionPlaybackWrite = ({
    event = {},
    session = {},
    currentPerformanceMeta = {},
    mediaUrl = '',
    now = Date.now()
} = {}) => {
    const sessionId = normalizeKey(session?.sessionId);
    if (!sessionId) return null;
    if (!matchesActivePerformanceSession({ event, session, currentPerformanceMeta, mediaUrl })) return null;

    const eventType = normalizeKey(event?.type).toLowerCase();
    if (!eventType) return null;

    const playbackState = eventType === 'heartbeat'
        ? (normalizeKey(session?.playbackState).toLowerCase() || 'playing')
        : eventType;
    const nowValue = Number(now || Date.now()) || Date.now();
    const currentTimeSec = Math.max(0, Number(event?.currentTimeSec || 0));
    const durationSec = Math.max(0, Number(event?.durationSec || 0));
    const dedupeSuffix = eventType === 'heartbeat'
        ? `heartbeat:${Math.floor(currentTimeSec / 5)}`
        : `${playbackState}:${Math.floor(currentTimeSec)}:${Math.floor(durationSec)}:${normalizeKey(event?.completionReason).toLowerCase()}`;
    const dedupeKey = `${sessionId}:${dedupeSuffix}`;

    const patch = {
        'currentPerformanceSession.lastReportedAtMs': nowValue,
        ...(durationSec > 0 ? { 'currentPerformanceSession.playerReportedDurationSec': durationSec } : {}),
        ...(currentTimeSec > 0 ? { 'currentPerformanceSession.playerPositionSec': currentTimeSec } : {})
    };
    if (playbackState) {
        patch['currentPerformanceSession.playbackState'] = playbackState;
    }
    if (eventType === 'playing' || eventType === 'heartbeat') {
        patch['currentPerformanceSession.lastHeartbeatAtMs'] = nowValue;
        if (!Number(session?.playbackStartedAtMs || 0)) {
            patch['currentPerformanceSession.playbackStartedAtMs'] = nowValue;
        }
    }
    if (eventType === 'paused') {
        patch['currentPerformanceSession.pausedAtMs'] = nowValue;
    }
    if (eventType === 'ended') {
        patch['currentPerformanceSession.lastHeartbeatAtMs'] = nowValue;
        patch['currentPerformanceSession.endedAtMs'] = nowValue;
        patch['currentPerformanceSession.completionReason'] = normalizeKey(event?.completionReason || 'player_ended').toLowerCase();
    }
    if (eventType === 'error') {
        patch['currentPerformanceSession.completionReason'] = normalizeKey(event?.completionReason || 'player_error').toLowerCase();
        patch['currentPerformanceSession.error'] = normalizeKey(event?.error || 'player_error').toLowerCase();
    }
    if (
        durationSec > 0
        && normalizeKey(currentPerformanceMeta?.songId) === normalizeKey(session?.songId)
    ) {
        patch['currentPerformanceMeta.durationSec'] = Math.max(
            durationSec,
            Number(currentPerformanceMeta?.durationSec || 0)
        );
        patch['currentPerformanceMeta.backingDurationSec'] = Math.max(
            durationSec,
            Number(currentPerformanceMeta?.backingDurationSec || 0)
        );
        patch['currentPerformanceMeta.durationSource'] = 'player_reported';
        patch['currentPerformanceMeta.durationConfidence'] = 'high';
        patch['currentPerformanceMeta.autoEndSafe'] = true;
    }

    return {
        dedupeKey,
        patch
    };
};
