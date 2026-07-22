export const ACTIVE_ROOM_SONG_STATUSES = ['assigned', 'pending', 'requested', 'performing'];
export const ACTIVE_ROOM_SONG_LIMIT = 250;
export const RECENT_PERFORMED_SONG_LIMIT = 250;
export const ROOM_SONG_FALLBACK_LIMIT = 500;

export const mergeRoomSongSnapshots = (activeSongs = [], performedSongs = []) => {
    const byId = new Map();
    [...performedSongs, ...activeSongs].forEach((song) => {
        if (!song?.id) return;
        byId.set(song.id, song);
    });
    return Array.from(byId.values());
};
