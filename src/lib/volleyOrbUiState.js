import { isCrowdObjectiveLightMode } from './crowdObjectiveModes.js';

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
