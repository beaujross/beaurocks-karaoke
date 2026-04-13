import { useCallback, useEffect, useState } from 'react';
import { APP_ID } from '../../../lib/assets';
import {
    db,
    collection,
    limit,
    onSnapshot,
    query,
    where,
} from '../../../lib/firebase';

const getTimestampMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value?.toMillis === 'function') {
        try {
            return Number(value.toMillis()) || 0;
        } catch {
            return 0;
        }
    }
    const seconds = Number(value?.seconds || 0);
    const nanos = Number(value?.nanoseconds || value?.nanos || 0);
    if (seconds > 0) {
        return (seconds * 1000) + Math.floor(nanos / 1000000);
    }
    return 0;
};

const useHostRoomManager = ({
    hostUid = '',
    hostLogger,
}) => {
    const activeUid = String(hostUid || '').trim();
    const [roomManagerBusyCode, setRoomManagerBusyCode] = useState('');
    const [roomManagerBusyAction, setRoomManagerBusyAction] = useState('');
    const [roomManagerError, setRoomManagerError] = useState('');
    const [recentHostRoomsState, setRecentHostRoomsState] = useState({
        hostUid: '',
        items: [],
        error: '',
    });

    const setRoomManagerBusy = useCallback((roomCode = '', action = '') => {
        setRoomManagerBusyCode(String(roomCode || '').trim().toUpperCase());
        setRoomManagerBusyAction(String(action || '').trim());
    }, []);

    const clearRoomManagerBusy = useCallback(() => {
        setRoomManagerBusyCode('');
        setRoomManagerBusyAction('');
    }, []);

    useEffect(() => {
        let unsub = () => {};
        let disposed = false;
        if (!activeUid) return () => unsub();
        try {
            const recentRoomsQuery = query(
                collection(db, 'artifacts', APP_ID, 'public', 'data', 'rooms'),
                where('hostUids', 'array-contains', activeUid),
                limit(20)
            );
            unsub = onSnapshot(
                recentRoomsQuery,
                (snapshot) => {
                    const nextRooms = snapshot.docs
                        .map((docSnap) => {
                            const data = docSnap.data() || {};
                            const createdAtMs = getTimestampMs(data.createdAt);
                            const updatedAtMs = getTimestampMs(
                                data.updatedAt
                                || data.closedAt
                                || data.createdAt
                            );
                            const archivedAtMs = getTimestampMs(data.archivedAt);
                            const closedAtMs = getTimestampMs(data.closedAt);
                            const recap = data.recap && typeof data.recap === 'object' ? data.recap : null;
                            const discover = data.discover && typeof data.discover === 'object' ? data.discover : {};
                            const roomPlan = data.roomPlan && typeof data.roomPlan === 'object' ? data.roomPlan : {};
                            const templateMeta = data.runOfShowTemplateMeta && typeof data.runOfShowTemplateMeta === 'object'
                                ? data.runOfShowTemplateMeta
                                : {};
                            return {
                                code: docSnap.id,
                                roomName: String(data.roomName || '').trim() || '',
                                hostName: String(data.hostName || '').trim() || 'Host',
                                orgName: String(data.orgName || '').trim() || '',
                                activeMode: String(data.activeMode || 'karaoke').trim() || 'karaoke',
                                createdAtMs,
                                updatedAtMs,
                                archivedAtMs,
                                closedAtMs,
                                recapAtMs: getTimestampMs(recap?.generatedAtMs || recap?.generatedAt || recap?.timestamp),
                                hasRecap: !!recap && Object.keys(recap).length > 0,
                                archived: !!archivedAtMs || String(data.archivedStatus || '').toLowerCase() === 'archived',
                                publicRoom: discover.publicRoom === true || String(discover.visibility || '').toLowerCase() === 'public',
                                discoverVisibility: String(discover.visibility || '').trim().toLowerCase() || 'private',
                                discoverTitle: String(discover.title || '').trim() || '',
                                roomStartsAtMs: getTimestampMs(roomPlan.startsAtMs || roomPlan.startsAt),
                                roomStartsAtLocal: String(roomPlan.startsAtLocal || '').trim(),
                                currentTemplateId: String(templateMeta.currentTemplateId || '').trim(),
                                currentTemplateName: String(templateMeta.currentTemplateName || '').trim(),
                                discoverStartsAtMs: getTimestampMs(discover.startsAtMs),
                                virtualOnly: discover.virtualOnly === true,
                            };
                        })
                        .sort((a, b) => (b.updatedAtMs || b.createdAtMs || 0) - (a.updatedAtMs || a.createdAtMs || 0))
                        .slice(0, 8);
                    setRecentHostRoomsState({
                        hostUid: activeUid,
                        items: nextRooms,
                        error: '',
                    });
                },
                (error) => {
                    hostLogger?.warn?.('Failed to load recent host rooms', error);
                    setRecentHostRoomsState({
                        hostUid: activeUid,
                        items: [],
                        error: 'Could not load room history.',
                    });
                }
            );
        } catch (error) {
            hostLogger?.warn?.('Recent room query failed', error);
            Promise.resolve().then(() => {
                if (disposed) return;
                setRecentHostRoomsState({
                    hostUid: activeUid,
                    items: [],
                    error: 'Could not load room history.',
                });
            });
        }
        return () => {
            disposed = true;
            unsub();
        };
    }, [activeUid, hostLogger]);

    const recentHostRoomsLoading = activeUid ? recentHostRoomsState.hostUid !== activeUid : false;
    const recentHostRooms = activeUid && recentHostRoomsState.hostUid === activeUid
        ? recentHostRoomsState.items
        : [];
    const roomHistoryError = activeUid && recentHostRoomsState.hostUid === activeUid
        ? recentHostRoomsState.error
        : '';

    return {
        roomManagerBusyCode,
        roomManagerBusyAction,
        roomManagerError: activeUid ? (roomManagerError || roomHistoryError) : '',
        recentHostRoomsLoading,
        recentHostRooms,
        setRoomManagerBusy,
        clearRoomManagerBusy,
        setRoomManagerError,
    };
};

export default useHostRoomManager;
