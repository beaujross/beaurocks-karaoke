import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    where
} from './firebase';
import {
    ACTIVE_ROOM_SONG_LIMIT,
    ACTIVE_ROOM_SONG_STATUSES,
    RECENT_PERFORMED_SONG_LIMIT,
    ROOM_SONG_FALLBACK_LIMIT,
    mergeRoomSongSnapshots
} from './roomSongSubscriptionModel';

export {
    ACTIVE_ROOM_SONG_LIMIT,
    ACTIVE_ROOM_SONG_STATUSES,
    RECENT_PERFORMED_SONG_LIMIT,
    ROOM_SONG_FALLBACK_LIMIT,
    mergeRoomSongSnapshots
};

const mapSongSnapshot = (snapshot) => (
    snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
);

export const subscribeToBoundedRoomSongs = ({
    db,
    appId,
    roomCode,
    onSongs,
    onError
}) => {
    if (!db || !appId || !roomCode || typeof onSongs !== 'function') return () => {};
    const songsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'karaoke_songs');
    let activeSongs = [];
    let performedSongs = [];
    let primaryFailed = false;
    let fallbackUnsubscribe = () => {};
    let activeUnsubscribe = () => {};
    let performedUnsubscribe = () => {};

    const publish = () => {
        if (!primaryFailed) onSongs(mergeRoomSongSnapshots(activeSongs, performedSongs));
    };
    const startBoundedFallback = (error) => {
        if (primaryFailed) return;
        primaryFailed = true;
        activeUnsubscribe();
        performedUnsubscribe();
        fallbackUnsubscribe = onSnapshot(
            query(
                songsCollection,
                where('roomCode', '==', roomCode),
                limit(ROOM_SONG_FALLBACK_LIMIT)
            ),
            (snapshot) => onSongs(mapSongSnapshot(snapshot)),
            (fallbackError) => {
                if (typeof onError === 'function') onError(fallbackError || error);
            }
        );
    };

    activeUnsubscribe = onSnapshot(
        query(
            songsCollection,
            where('roomCode', '==', roomCode),
            where('status', 'in', ACTIVE_ROOM_SONG_STATUSES),
            limit(ACTIVE_ROOM_SONG_LIMIT)
        ),
        (snapshot) => {
            activeSongs = mapSongSnapshot(snapshot);
            publish();
        },
        startBoundedFallback
    );
    performedUnsubscribe = onSnapshot(
        query(
            songsCollection,
            where('roomCode', '==', roomCode),
            where('status', '==', 'performed'),
            orderBy('timestamp', 'desc'),
            limit(RECENT_PERFORMED_SONG_LIMIT)
        ),
        (snapshot) => {
            performedSongs = mapSongSnapshot(snapshot);
            publish();
        },
        startBoundedFallback
    );

    return () => {
        activeUnsubscribe();
        performedUnsubscribe();
        fallbackUnsubscribe();
    };
};
