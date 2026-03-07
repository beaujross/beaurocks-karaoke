const normalize = (value = '') => String(value || '').trim().toLowerCase();

const MODE_LIST = Object.freeze([
    Object.freeze({
        id: 'volley_orb',
        lightMode: 'volley',
        label: 'Volley Orb',
        shortLabel: 'Volley',
        icon: 'fa-bullseye',
        tvGoal: 'Scan in, launch the orb, and pass it to the next player.',
        tvBannerGoal: 'Volley Orb',
        mobileGoal: 'Tap any button to start the orb',
        prompts: [
            'Tap any button to launch.',
            'Pass to the glowing target.',
            'A different teammate must catch the next pass.',
            'Miss the timer and the chain resets.'
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
