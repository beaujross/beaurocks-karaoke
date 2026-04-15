import { isCrowdObjectiveLightMode } from './crowdObjectiveModes.js';

const clampNumber = (value = 0, min = 0, max = 0) => Math.max(min, Math.min(max, Number(value || 0)));

export const VOLLEY_ORB_BASE_ACTIONS = Object.freeze([
    Object.freeze({
        id: 'wave',
        label: 'Save',
        emoji: '🛟',
        cue: 'slow fall',
        shortCue: 'save'
    }),
    Object.freeze({
        id: 'laser',
        label: 'Lift',
        emoji: '🚀',
        cue: 'boost up',
        shortCue: 'lift'
    }),
    Object.freeze({
        id: 'echo',
        label: 'Pass',
        emoji: '🔁',
        cue: 'longer pass',
        shortCue: 'pass'
    }),
    Object.freeze({
        id: 'confetti',
        label: 'Burst',
        emoji: '💥',
        cue: 'build streak',
        shortCue: 'burst'
    })
]);

export const VOLLEY_ORB_ULTIMATE_COOLDOWN_MS = 45000;
export const VOLLEY_ORB_ULTIMATES = Object.freeze([
    Object.freeze({
        id: 'ultimate_feather',
        label: 'Float',
        emoji: '🪶',
        cue: 'slow fall',
        durationMs: 5000
    }),
    Object.freeze({
        id: 'ultimate_lens',
        label: 'Shrink',
        emoji: '🔍',
        cue: 'more clearance',
        durationMs: 5500
    }),
    Object.freeze({
        id: 'ultimate_magnet',
        label: 'Catch-All',
        emoji: '🧲',
        cue: 'any tap catches',
        durationMs: 4500
    }),
    Object.freeze({
        id: 'ultimate_rocket',
        label: 'Bounce',
        emoji: '🚀',
        cue: 'instant lift',
        durationMs: 0
    })
]);

const VOLLEY_ORB_BASE_ACTION_MAP = Object.freeze(
    VOLLEY_ORB_BASE_ACTIONS.reduce((acc, item) => ({ ...acc, [item.id]: item }), {})
);
const VOLLEY_ORB_ULTIMATE_MAP = Object.freeze(
    VOLLEY_ORB_ULTIMATES.reduce((acc, item) => ({ ...acc, [item.id]: item }), {})
);

export const normalizeVolleyOrbInteractionType = (rawType = '') => {
    const value = String(rawType || '').trim().toLowerCase();
    if (!value) return '';
    if (value.startsWith('lobby_play_')) return value.slice('lobby_play_'.length);
    return value;
};

export const getVolleyOrbBaseAction = (interactionType = '') => (
    VOLLEY_ORB_BASE_ACTION_MAP[normalizeVolleyOrbInteractionType(interactionType)] || null
);

export const getVolleyOrbUltimate = (interactionType = '') => (
    VOLLEY_ORB_ULTIMATE_MAP[normalizeVolleyOrbInteractionType(interactionType)] || null
);

export const isVolleyOrbUltimateType = (interactionType = '') => !!getVolleyOrbUltimate(interactionType);

export const isVolleyOrbSceneActive = ({
    hasCurrentSinger = false,
    activeMode = '',
    lightMode = ''
} = {}) => (
    !hasCurrentSinger
    && (!activeMode || activeMode === 'karaoke')
    && isCrowdObjectiveLightMode(lightMode)
);

export const getVolleyOrbMobileMainLine = ({
    paused = false,
    timedOut = false,
    relayActive = false
} = {}) => {
    if (paused) return 'Paused';
    if (timedOut) return 'Save it';
    if (relayActive) return 'Hit target';
    return 'Tap to launch';
};

export const getVolleyOrbTvInstructionCopy = ({
    warningState = false,
    hasActiveVolley = false,
    volleyExpired = false
} = {}) => {
    if (warningState) {
        return {
            headline: 'Save It',
            secondary: 'Any tap now'
        };
    }
    if (hasActiveVolley) {
        return {
            headline: 'Pass It',
            secondary: 'New player hits target'
        };
    }
    if (volleyExpired) {
        return {
            headline: 'Restart',
            secondary: 'Any tap relaunches'
        };
    }
    return {
        headline: 'Join In',
        secondary: 'Any tap launches'
    };
};

export const isVolleyOrbTargetInteraction = ({
    relayActive = false,
    targetType = '',
    interactionId = ''
} = {}) => (
    relayActive
    && (
        String(targetType || '') === 'any'
        || String(targetType || '') === String(interactionId || '')
    )
);

export const getVolleyOrbResponsiveMetrics = ({
    sceneWidth = 0,
    sceneHeight = 0
} = {}) => {
    const width = Math.max(0, Number(sceneWidth || 0));
    const height = Math.max(0, Number(sceneHeight || 0));
    if (width <= 0 || height <= 0) {
        return {
            sceneWidthPx: width,
            sceneHeightPx: height,
            orbSizePx: 280,
            orbScale: 0.78,
            orbContentScale: 0.84,
            participantSizePx: 27
        };
    }

    const widthCap = width * 0.34;
    const heightCap = height * 0.46;
    const minDimensionCap = Math.min(width, height) * 0.78;
    const orbSizePx = Math.round(clampNumber(
        Math.min(360, widthCap, heightCap, minDimensionCap),
        120,
        360
    ));
    const orbScale = clampNumber(orbSizePx / 360, 0.34, 1);

    return {
        sceneWidthPx: width,
        sceneHeightPx: height,
        orbSizePx,
        orbScale: Number(orbScale.toFixed(4)),
        orbContentScale: Number(clampNumber(orbSizePx / 320, 0.52, 1).toFixed(4)),
        participantSizePx: Math.round(clampNumber(18 + (orbScale * 12), 18, 30))
    };
};
