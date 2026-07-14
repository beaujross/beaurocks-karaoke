import {
    GAME_LIFECYCLE_KINDS,
    getGameCollisionRisks,
    getGameLifecycleContract,
} from './gameLifecycle';

const MODE_ALIASES = Object.freeze({
    trivia_reveal: 'trivia_pop',
    wyr_reveal: 'wyr',
});

const normalizeMode = (value = '') => {
    const token = String(value || '').trim().toLowerCase();
    return MODE_ALIASES[token] || token;
};

const hasPerformanceSubject = (room = {}) => {
    const session = room?.currentPerformanceSession || {};
    const sessionStatus = String(session?.status || '').trim().toLowerCase();
    if (sessionStatus && ['ended', 'complete', 'completed', 'cancelled', 'canceled'].includes(sessionStatus)) return false;
    return Boolean(
        session?.sessionId
        || session?.songId
        || room?.currentPerformanceMeta?.songId
        || room?.currentSinger?.id
        || room?.currentSinger?.uid
    );
};

const hasBingoBoard = (room = {}) => (
    normalizeMode(room?.activeMode) === 'bingo'
    || (Array.isArray(room?.bingoData) && room.bingoData.length > 0)
    || Boolean(room?.bingoFocus)
    || Boolean(room?.bingoWin)
);

export const resolveGameLifecycleSlots = (room = {}, { performanceActive } = {}) => {
    const activeMode = normalizeMode(room?.activeMode);
    const activeContract = getGameLifecycleContract(activeMode);
    const resolvedPerformanceActive = typeof performanceActive === 'boolean'
        ? performanceActive
        : hasPerformanceSubject(room);
    const takeoverMode = activeContract?.exclusiveTakeover ? activeMode : '';
    const allNightCompanionModes = hasBingoBoard(room) ? ['bingo'] : [];
    const popTriviaConfigured = room?.popTriviaEnabled === true;
    const explicitPerformanceCompanion = activeContract?.kind === GAME_LIFECYCLE_KINDS.performanceCompanion
        ? activeMode
        : '';
    const performanceCompanionModes = explicitPerformanceCompanion
        ? [explicitPerformanceCompanion]
        : popTriviaConfigured && resolvedPerformanceActive
            ? ['pop_trivia_companion']
            : [];
    const dormantPerformanceCompanionModes = !explicitPerformanceCompanion && popTriviaConfigured && !resolvedPerformanceActive
        ? ['pop_trivia_companion']
        : [];
    const activeModes = [
        takeoverMode,
        ...allNightCompanionModes,
        ...performanceCompanionModes,
    ].filter(Boolean);
    const primaryMode = takeoverMode
        || performanceCompanionModes[0]
        || (activeContract?.kind === GAME_LIFECYCLE_KINDS.allNightCompanion ? activeMode : '')
        || allNightCompanionModes[0]
        || '';

    return {
        activeMode,
        primaryMode,
        takeoverMode,
        allNightCompanionModes,
        performanceCompanionModes,
        dormantPerformanceCompanionModes,
        performanceActive: resolvedPerformanceActive,
        risks: getGameCollisionRisks({ activeModes, performanceActive: resolvedPerformanceActive }),
    };
};
