export const ROOM_COST_AUDIENCE_SAMPLE_MODULUS = 16;

export const stableRoomCostHash = (value = '') => {
    let hash = 2166136261;
    for (const char of String(value || '')) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

export const getRoomCostUtcDateKey = (nowValue = Date.now()) => (
    new Date(nowValue).toISOString().slice(0, 10).replace(/-/g, '')
);

export const shouldRecordRoomCostObservation = ({
    surface = '',
    roomCode = '',
    uid = '',
    dateKey = getRoomCostUtcDateKey()
} = {}) => {
    const safeSurface = String(surface || '').trim().toLowerCase();
    if (safeSurface === 'host' || safeSurface === 'public_tv') return true;
    if (safeSurface !== 'audience') return false;
    return stableRoomCostHash(`${roomCode}:${uid}:${dateKey}`) % ROOM_COST_AUDIENCE_SAMPLE_MODULUS === 0;
};

export const buildRoomCostObservationCounts = ({
    participants = [],
    songs = [],
    activities = [],
    mediaAssets = [],
    scenePresets = []
} = {}) => ({
    participantsObserved: Math.min(250, Array.isArray(participants) ? participants.length : 0),
    activeSongsObserved: Math.min(250, (Array.isArray(songs) ? songs : []).filter((song) => (
        ['assigned', 'pending', 'requested', 'performing'].includes(String(song?.status || '').trim().toLowerCase())
    )).length),
    performedSongsObserved: Math.min(250, (Array.isArray(songs) ? songs : []).filter((song) => (
        String(song?.status || '').trim().toLowerCase() === 'performed'
    )).length),
    activitiesObserved: Math.min(80, Array.isArray(activities) ? activities.length : 0),
    mediaAssetsObserved: Math.min(100, Array.isArray(mediaAssets) ? mediaAssets.length : 0),
    scenePresetsObserved: Math.min(50, Array.isArray(scenePresets) ? scenePresets.length : 0)
});
