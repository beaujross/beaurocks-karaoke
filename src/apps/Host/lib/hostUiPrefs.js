const isPlainObject = (value) => !!value && Object.prototype.toString.call(value) === '[object Object]';

export const HOST_RUNTIME_SHELL_MODES = Object.freeze({
    classic: 'classic',
    socialGameNightExperiment: 'social_game_night_experiment',
});

export const HOST_RUNTIME_MODE_EMPHASES = Object.freeze({
    hostLed: 'hostLed',
    collaborative: 'collaborative',
    audienceLed: 'audienceLed',
    curatedShowcase: 'curatedShowcase',
});

export const getHostUiPrefs = (room = null) => (
    isPlainObject(room?.hostUiPrefs) ? room.hostUiPrefs : {}
);

export const getHostRuntimeShellMode = (room = null) => {
    const groupedValue = String(getHostUiPrefs(room).runtimeShellMode || '').trim().toLowerCase();
    return groupedValue === HOST_RUNTIME_SHELL_MODES.socialGameNightExperiment
        ? HOST_RUNTIME_SHELL_MODES.socialGameNightExperiment
        : HOST_RUNTIME_SHELL_MODES.classic;
};

export const getHostRuntimeModeEmphasis = (room = null) => {
    const groupedValue = String(getHostUiPrefs(room).runtimeModeEmphasis || '').trim();
    const validValues = new Set(Object.values(HOST_RUNTIME_MODE_EMPHASES));
    return validValues.has(groupedValue)
        ? groupedValue
        : HOST_RUNTIME_MODE_EMPHASES.hostLed;
};

export const isPostPerformanceBackingPromptEnabled = (room = null) => {
    const groupedValue = getHostUiPrefs(room).postPerformanceBackingPromptEnabled;
    if (typeof groupedValue === 'boolean') return groupedValue;
    return room?.postPerformanceBackingPromptEnabled === true;
};

export const buildHostUiPrefsPatch = (room = null, patch = {}) => ({
    ...getHostUiPrefs(room),
    ...(isPlainObject(patch) ? patch : {}),
});
