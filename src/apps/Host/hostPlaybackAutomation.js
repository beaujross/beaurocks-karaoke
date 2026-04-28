export const getTrackDurationSecFromSearchResult = (result = {}, fallback = 180) => {
    const rawMs = Number(result?.trackTimeMillis || result?.durationMs || 0);
    if (Number.isFinite(rawMs) && rawMs > 0) {
        return Math.max(1, Math.round(rawMs / 1000));
    }

    const rawSec = Number(result?.duration || 0);
    if (Number.isFinite(rawSec) && rawSec > 0) {
        return Math.max(1, Math.round(rawSec));
    }

    const safeFallback = Number(fallback || 0);
    if (Number.isFinite(safeFallback) && safeFallback > 0) {
        return Math.max(1, Math.round(safeFallback));
    }

    return 180;
};

const PERFORMANCE_SESSION_HEARTBEAT_GRACE_MS = 15000;
const AUTHORITATIVE_PERFORMANCE_SESSION_SOURCES = new Set([
    'apple_music',
    'youtube',
    'native_video',
    'native_audio',
    'backing_media',
    'audio'
]);

export const getAutoEndSchedule = ({
    autoEndEnabled = true,
    currentId = '',
    applausePendingSongId = '',
    activeMode = '',
    appleMusicId = '',
    appleStatus = '',
    appleStartedAt = 0,
    appleDurationSec = 0,
    mediaUrl = '',
    videoPlaying = false,
    videoStartTimestamp = 0,
    pausedAt = 0,
    performanceMetaSongId = '',
    performanceSessionSongId = '',
    performanceSessionState = '',
    performanceSessionSourceType = '',
    performanceSessionLastHeartbeatAtMs = 0,
    performanceSessionEndedAtMs = 0,
    capturedDurationSec = 0,
    currentDurationSec = 0,
    autoEndSafe = true,
    now = Date.now()
} = {}) => {
    const AUTO_END_POST_TRACK_BUFFER_SEC = 6;
    if (!autoEndEnabled) return null;
    const normalizedCurrentId = String(currentId || '').trim();
    if (!normalizedCurrentId) return null;
    if (String(applausePendingSongId || '').trim()) return null;
    if (String(activeMode || '').trim().toLowerCase() !== 'karaoke') return null;
    const normalizedMetaSongId = String(performanceMetaSongId || '').trim();
    if (normalizedMetaSongId && normalizedMetaSongId !== normalizedCurrentId) return null;
    const normalizedSessionSongId = String(performanceSessionSongId || '').trim();
    if (normalizedSessionSongId && normalizedSessionSongId !== normalizedCurrentId) return null;
    const normalizedSessionState = String(performanceSessionState || '').trim().toLowerCase();
    if (normalizedSessionState === 'ended' || Number(performanceSessionEndedAtMs || 0) > 0) return null;

    const normalizedAppleStatus = String(appleStatus || '').trim().toLowerCase();
    const applePlaying = !!String(appleMusicId || '').trim() && normalizedAppleStatus === 'playing';
    const hasMediaUrl = !!String(mediaUrl || '').trim();
    const mediaPaused = !applePlaying && Number(pausedAt || 0) > 0;
    const mediaClockRunning = hasMediaUrl && Number(videoStartTimestamp || 0) > 0 && !mediaPaused;
    const mediaRunning = applePlaying || !!videoPlaying || mediaClockRunning;
    if (!mediaRunning) return null;
    if (!applePlaying && autoEndSafe === false) return null;

    const startedAt = applePlaying
        ? Number(appleStartedAt || 0)
        : Number(videoStartTimestamp || 0);
    const durationSec = applePlaying
        ? Number(Math.max(
            Number(appleDurationSec || 0),
            Number(capturedDurationSec || 0),
            Number(currentDurationSec || 0)
        ) || 0)
        : Number(Math.max(
            Number(capturedDurationSec || 0),
            Number(currentDurationSec || 0)
        ) || 0);

    if (!Number.isFinite(startedAt) || startedAt <= 0) return null;
    if (!Number.isFinite(durationSec) || durationSec < 20) return null;

    const endAtMs = startedAt + ((durationSec + AUTO_END_POST_TRACK_BUFFER_SEC) * 1000);
    const safeNow = Number(now || Date.now()) || Date.now();
    const normalizedSessionSourceType = String(performanceSessionSourceType || '').trim().toLowerCase();
    const hasAuthoritativeHeartbeat = AUTHORITATIVE_PERFORMANCE_SESSION_SOURCES.has(normalizedSessionSourceType)
        && Number(performanceSessionLastHeartbeatAtMs || 0) > 0;
    if (hasAuthoritativeHeartbeat && safeNow >= endAtMs) {
        const heartbeatAgeMs = Math.max(0, safeNow - Number(performanceSessionLastHeartbeatAtMs || 0));
        if (heartbeatAgeMs < PERFORMANCE_SESSION_HEARTBEAT_GRACE_MS) {
            return {
                autoEndKey: `${normalizedCurrentId}:${startedAt}:heartbeat_watch:${Math.floor(Number(performanceSessionLastHeartbeatAtMs || 0) / 1000)}`,
                delayMs: Math.max(2000, PERFORMANCE_SESSION_HEARTBEAT_GRACE_MS - heartbeatAgeMs)
            };
        }
    }
    const delayMs = Math.max(0, Math.round(endAtMs - safeNow));
    return {
        autoEndKey: `${normalizedCurrentId}:${startedAt}:${Math.round(durationSec)}`,
        delayMs
    };
};
