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

export const getAutoEndSchedule = ({
    autoEndEnabled = true,
    currentId = '',
    applausePendingSongId = '',
    activeMode = '',
    appleMusicId = '',
    appleStatus = '',
    appleStartedAt = 0,
    appleDurationSec = 0,
    videoPlaying = false,
    videoStartTimestamp = 0,
    currentDurationSec = 0,
    now = Date.now()
} = {}) => {
    const AUTO_END_POST_TRACK_BUFFER_SEC = 6;
    if (!autoEndEnabled) return null;
    const normalizedCurrentId = String(currentId || '').trim();
    if (!normalizedCurrentId) return null;
    if (String(applausePendingSongId || '').trim()) return null;
    if (String(activeMode || '').trim().toLowerCase() !== 'karaoke') return null;

    const normalizedAppleStatus = String(appleStatus || '').trim().toLowerCase();
    const applePlaying = !!String(appleMusicId || '').trim() && normalizedAppleStatus === 'playing';
    const mediaRunning = applePlaying || !!videoPlaying;
    if (!mediaRunning) return null;

    const startedAt = applePlaying
        ? Number(appleStartedAt || 0)
        : Number(videoStartTimestamp || 0);
    const durationSec = applePlaying
        ? Number(appleDurationSec || currentDurationSec || 0)
        : Number(currentDurationSec || 0);

    if (!Number.isFinite(startedAt) || startedAt <= 0) return null;
    if (!Number.isFinite(durationSec) || durationSec < 20) return null;

    const endAtMs = startedAt + ((durationSec + AUTO_END_POST_TRACK_BUFFER_SEC) * 1000);
    const delayMs = Math.max(0, Math.round(endAtMs - Number(now || Date.now())));
    return {
        autoEndKey: `${normalizedCurrentId}:${startedAt}:${Math.round(durationSec)}`,
        delayMs
    };
};
