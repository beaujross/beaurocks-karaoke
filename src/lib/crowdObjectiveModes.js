const normalize = (value = '') => String(value || '').trim().toLowerCase();

const MODE_LIST = Object.freeze([
    Object.freeze({
        id: 'volley_orb',
        lightMode: 'volley',
        label: 'Volley Orb',
        shortLabel: 'Volley',
        icon: 'fa-bullseye',
        tvGoal: 'Keep the orb in play. Build a volley and hit the next highlighted builder in sequence.',
        tvBannerGoal: 'Keep The Volley Alive',
        mobileGoal: 'Keep the volley alive',
        prompts: [
            'Build a volley first: any builder gets the orb moving.',
            'Follow the sequence: wave -> laser -> echo -> confetti.',
            'Relay rule: a different teammate must hit the highlighted next builder.',
            'Miss the relay timer and the chain resets. Keep it moving.'
        ]
    })
]);

const MODE_BY_ID = Object.freeze(
    MODE_LIST.reduce((acc, mode) => {
        acc[normalize(mode.id)] = mode;
        return acc;
    }, {})
);

const MODE_BY_LIGHT_MODE = Object.freeze(
    MODE_LIST.reduce((acc, mode) => {
        acc[normalize(mode.lightMode)] = mode;
        return acc;
    }, {})
);

export const CROWD_OBJECTIVE_DEFAULT_MODE_ID = 'volley_orb';
export const CROWD_OBJECTIVE_MODES = MODE_LIST;

export const getCrowdObjectiveModeById = (modeId = CROWD_OBJECTIVE_DEFAULT_MODE_ID) => (
    MODE_BY_ID[normalize(modeId)] || MODE_BY_ID[CROWD_OBJECTIVE_DEFAULT_MODE_ID]
);

export const getCrowdObjectiveModeFromLightMode = (lightMode = '') => (
    MODE_BY_LIGHT_MODE[normalize(lightMode)] || null
);

export const isCrowdObjectiveLightMode = (lightMode = '') => (
    !!getCrowdObjectiveModeFromLightMode(lightMode)
);

export const resolveCrowdObjectiveMode = ({
    lightMode = '',
    fallbackModeId = CROWD_OBJECTIVE_DEFAULT_MODE_ID
} = {}) => {
    const fromLightMode = getCrowdObjectiveModeFromLightMode(lightMode);
    if (fromLightMode) return fromLightMode;
    return getCrowdObjectiveModeById(fallbackModeId);
};
