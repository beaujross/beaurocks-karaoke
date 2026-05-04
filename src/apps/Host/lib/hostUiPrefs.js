const isPlainObject = (value) => !!value && Object.prototype.toString.call(value) === '[object Object]';

export const getHostUiPrefs = (room = null) => (
    isPlainObject(room?.hostUiPrefs) ? room.hostUiPrefs : {}
);

export const isPostPerformanceBackingPromptEnabled = (room = null) => {
    const groupedValue = getHostUiPrefs(room).postPerformanceBackingPromptEnabled;
    if (typeof groupedValue === 'boolean') return groupedValue;
    return room?.postPerformanceBackingPromptEnabled !== false;
};

export const buildHostUiPrefsPatch = (room = null, patch = {}) => ({
    ...getHostUiPrefs(room),
    ...(isPlainObject(patch) ? patch : {}),
});
