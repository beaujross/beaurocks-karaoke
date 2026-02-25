const normalize = (value = '') => String(value || '').trim().toLowerCase();

const MODE_LIST = Object.freeze([
    Object.freeze({
        id: 'volley_orb',
        lightMode: 'volley',
        label: 'Volley Orb',
        shortLabel: 'Volley',
        icon: 'fa-bullseye',
        tvGoal: 'Keep the Volley Orb in the air. Do not let it touch the ground line at the bottom.',
        tvBannerGoal: 'Keep Orb Above Ground',
        mobileGoal: 'Keep the orb airborne',
        prompts: [
            'Goal: keep the Volley Orb above the ground line.',
            'Trade turns on your phones to keep the orb airborne.',
            'Pass the orb: different teammate + next target effect inside the relay window.',
            'Mix wave + laser + echo + confetti for combo links.',
            'Send a chat message and see it land on the room feed.',
            'Update your emoji/avatar and spot your card instantly.'
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
