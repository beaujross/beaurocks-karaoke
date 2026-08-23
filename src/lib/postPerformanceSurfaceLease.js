const APPLAUSE_MODES = new Set(['applause_countdown', 'applause', 'applause_result']);

const clampNumber = (value, min, max, fallback) => {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.max(min, Math.min(max, Math.round(parsed)));
};

export const getSurfaceTimestampMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return Math.max(0, value);
    if (typeof value?.toMillis === 'function') return Math.max(0, value.toMillis());
    if (typeof value?.seconds === 'number') return Math.max(0, value.seconds * 1000);
    return 0;
};

export const getPerformanceRecapDurationMs = (room = {}) => {
    if (room?.showPerformanceRecap === false) return 0;
    const breakdownMs = clampNumber(room?.performanceRecapBreakdownMs, 3000, 12000, 7000);
    const scoreStepMs = clampNumber(room?.performanceRecapScoreStepMs, 1800, 4200, 2600);
    const leaderboardMs = clampNumber(room?.performanceRecapLeaderboardMs, 3000, 12000, 7000);
    const nextUpMs = clampNumber(room?.performanceRecapNextUpMs, 3000, 12000, 6000);
    const scoreCardCount = Math.max(2, Math.min(3, 2 + (Math.max(0, Number(room?.lastPerformance?.hostBonus || 0)) > 0 ? 1 : 0)));
    const scoreFinalHoldMs = Math.max(5200, Math.min(9000, Math.round(scoreStepMs * 2.25)));
    const effectiveBreakdownMs = Math.max(
        breakdownMs,
        540 + (scoreCardCount * scoreStepMs) + 700 + scoreFinalHoldMs,
    );
    return effectiveBreakdownMs + leaderboardMs + nextUpMs;
};

export const getPostPerformanceSurfaceLease = (room = {}, options = {}) => {
    const now = Math.max(0, Number(options?.now ?? Date.now()) || Date.now());
    const activeMode = String(room?.activeMode || '').trim().toLowerCase();
    if (APPLAUSE_MODES.has(activeMode)) {
        const deadlineMs = Math.max(0, Number(room?.applauseSubject?.autoFinalizeDeadlineMs || 0) || 0);
        return {
            active: true,
            phase: 'applause',
            remainingMs: deadlineMs > now ? deadlineMs - now : 1000,
            expiresAtMs: deadlineMs,
        };
    }

    const configuredRecapDurationMs = Number(options?.recapDurationMs);
    const recapDurationMs = Number.isFinite(configuredRecapDurationMs)
        ? Math.max(0, configuredRecapDurationMs)
        : getPerformanceRecapDurationMs(room);
    const lastPerformanceTs = room?.lastPerformance?.recapScoreFinalized === true && room?.showPerformanceRecap !== false
        ? getSurfaceTimestampMs(room?.lastPerformance?.timestamp)
        : 0;
    const recapPreviewTs = getSurfaceTimestampMs(room?.recapPreview?.timestamp);
    const recapStartedAtMs = Math.max(lastPerformanceTs, recapPreviewTs);
    const expiresAtMs = recapStartedAtMs > 0 ? recapStartedAtMs + recapDurationMs : 0;
    const remainingMs = Math.max(0, expiresAtMs - now);
    return {
        active: remainingMs > 0,
        phase: remainingMs > 0 ? 'recap' : '',
        remainingMs,
        expiresAtMs,
    };
};
