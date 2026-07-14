import { GAME_LIFECYCLE_KINDS, getGameLifecycleContract } from './gameLifecycle';
import { resolveGameLifecycleSlots } from './gameLifecycleSlots';

const MODE_ALIASES = Object.freeze({
    trivia_reveal: 'trivia_pop',
    wyr_reveal: 'wyr',
});

export const normalizeGameLifecycleMode = (modeId = '') => {
    const token = String(modeId || '').trim().toLowerCase();
    return MODE_ALIASES[token] || token;
};

export const getGameLifecycleLabel = (modeId = '') => {
    const contract = getGameLifecycleContract(normalizeGameLifecycleMode(modeId));
    return {
        [GAME_LIFECYCLE_KINDS.standalone]: 'Standalone game',
        [GAME_LIFECYCLE_KINDS.betweenSong]: 'Between songs',
        [GAME_LIFECYCLE_KINDS.performanceCompanion]: 'During a performance',
        [GAME_LIFECYCLE_KINDS.allNightCompanion]: 'All-night companion',
    }[contract?.kind] || 'Room moment';
};

export const getGameLaunchCompatibility = ({ requestedMode = '', activeMode = '', performanceActive = false } = {}) => {
    const requestedId = normalizeGameLifecycleMode(requestedMode);
    const activeId = normalizeGameLifecycleMode(activeMode);
    const requested = getGameLifecycleContract(requestedId);
    const active = getGameLifecycleContract(activeId);
    if (!requested) return { allowed: true, code: 'unclassified', requestedId, activeId };
    if (requested.kind === GAME_LIFECYCLE_KINDS.performanceCompanion && requested.requiresPerformance && !performanceActive) {
        return { allowed: false, code: 'performance_required', message: 'Start a performance before launching this companion.', requestedId, activeId };
    }
    if (active && activeId !== requestedId && active.kind === GAME_LIFECYCLE_KINDS.allNightCompanion && requested.exclusiveTakeover) {
        return { allowed: false, code: 'companion_displacement', message: 'Pause or finish the all-night companion before starting a takeover.', requestedId, activeId };
    }
    if (active && activeId !== requestedId && active.exclusiveTakeover && requested.exclusiveTakeover) {
        return { allowed: false, code: 'active_takeover', message: `End the current ${getGameLifecycleLabel(activeId).toLowerCase()} before starting another.`, requestedId, activeId };
    }
    if (active && activeId !== requestedId && active.sharedStateFamily && active.sharedStateFamily === requested.sharedStateFamily) {
        return { allowed: false, code: 'shared_state_collision', message: 'Finish the current room vote before starting another prompt vote.', requestedId, activeId };
    }
    return { allowed: true, code: 'compatible', requestedId, activeId };
};

export const getRoomGameLaunchPreflight = ({ requestedMode = '', room = {}, performanceActive } = {}) => {
    const lifecycleSlots = resolveGameLifecycleSlots(room, { performanceActive });
    const compatibilityActiveMode = lifecycleSlots.takeoverMode
        || (lifecycleSlots.allNightCompanionModes.includes(lifecycleSlots.activeMode) ? lifecycleSlots.activeMode : '');
    const compatibility = getGameLaunchCompatibility({
        requestedMode,
        activeMode: compatibilityActiveMode,
        performanceActive: lifecycleSlots.performanceActive,
    });
    if (!compatibility.allowed) return { ...compatibility, lifecycleSlots };

    const requested = getGameLifecycleContract(compatibility.requestedId);
    if (lifecycleSlots.takeoverMode && requested?.kind === GAME_LIFECYCLE_KINDS.allNightCompanion) {
        return {
            ...compatibility,
            allowed: false,
            code: 'takeover_owns_surface',
            message: 'Finish the current room takeover before starting an all-night companion.',
            lifecycleSlots,
        };
    }
    if (lifecycleSlots.takeoverMode && requested?.kind === GAME_LIFECYCLE_KINDS.performanceCompanion) {
        return {
            ...compatibility,
            allowed: false,
            code: 'takeover_owns_surface',
            message: 'Return the room to the performance before starting its companion.',
            lifecycleSlots,
        };
    }
    return { ...compatibility, lifecycleSlots };
};

export const getRunOfShowGameMode = (item = {}) => {
    if (item?.type === 'trivia_break') return 'trivia_pop';
    if (item?.type === 'would_you_rather_break') return 'wyr';
    if (item?.type === 'game_break') return normalizeGameLifecycleMode(item?.modeLaunchPlan?.modeKey || item?.roomMomentPlan?.activeMode);
    return '';
};
