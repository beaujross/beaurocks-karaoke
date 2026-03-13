import { isCrowdObjectiveLightMode } from './crowdObjectiveModes.js';

const clampNumber = (value = 0, min = 0, max = 0) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return min;
    return Math.max(min, Math.min(max, numeric));
};

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
    if (paused) return 'Paused by host';
    if (timedOut) return 'Orb dropping. Tap now';
    if (relayActive) return 'Different player tap TARGET';
    return 'Tap any button to start the orb';
};

export const getVolleyOrbTvInstructionCopy = ({
    warningState = false,
    hasActiveVolley = false,
    volleyExpired = false
} = {}) => {
    if (warningState) {
        return {
            headline: 'Orb dropping',
            secondary: 'Tap now to save it'
        };
    }
    if (hasActiveVolley) {
        return {
            headline: 'Pass the orb',
            secondary: 'Different player taps the glowing target'
        };
    }
    if (volleyExpired) {
        return {
            headline: 'Chain reset',
            secondary: 'Any player taps to restart'
        };
    }
    return {
        headline: 'Scan to join',
        secondary: 'Any player taps any button to launch'
    };
};

export const isVolleyOrbTargetInteraction = ({
    relayActive = false,
    targetType = '',
    interactionId = ''
} = {}) => relayActive && String(targetType || '') === String(interactionId || '');

export const getVolleyOrbResponsiveMetrics = ({
    sceneWidth = 0,
    sceneHeight = 0
} = {}) => {
    const width = Math.max(0, Number(sceneWidth || 0));
    const height = Math.max(0, Number(sceneHeight || 0));
    if (width <= 0 || height <= 0) {
        return {
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
        orbSizePx,
        orbScale: Number(orbScale.toFixed(4)),
        orbContentScale: Number(clampNumber(orbSizePx / 320, 0.52, 1).toFixed(4)),
        participantSizePx: Math.round(clampNumber(18 + (orbScale * 12), 18, 30))
    };
};
