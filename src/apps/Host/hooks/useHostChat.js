import { useCallback, useEffect, useRef, useState } from 'react';
import {
    db,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    limit
} from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { EMOJI } from '../../../lib/emoji';

const getTimestampMs = (message) => (
    message?.timestamp?.seconds ? message.timestamp.seconds * 1000 : 0
);

const isDirectChatMessage = (message = {}) => (
    !!message?.toHost
    || !!message?.toUid
    || message?.channel === 'host'
    || message?.channel === 'dm'
);
const isLoungeChatMessage = (message = {}) => !isDirectChatMessage(message);
const getNewestRoomTs = (messages) => getTimestampMs(messages.find(msg => isLoungeChatMessage(msg)));
const getNewestDmTs = (messages) => getTimestampMs(messages.find(msg => isDirectChatMessage(msg)));

const useHostChat = ({ roomCode, room, settingsTab, hostName, toast }) => {
    const [chatEnabled, setChatEnabled] = useState(true);
    const [chatShowOnTv, setChatShowOnTv] = useState(false);
    const [chatTvMode, setChatTvMode] = useState('auto');
    const [chatSlowModeSec, setChatSlowModeSec] = useState(0);
    const [chatAudienceMode, setChatAudienceMode] = useState('all');
    const [chatDraft, setChatDraft] = useState('');
    const [dmTargetUid, setDmTargetUid] = useState('');
    const [dmDraft, setDmDraft] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [pinnedChatIds, setPinnedChatIds] = useState([]);
    const [chatUnread, setChatUnread] = useState(false);
    const [dmUnread, setDmUnread] = useState(false);
    const [chatViewMode, setChatViewMode] = useState('room');

    const chatLastSeenRef = useRef(0);
    const dmLastSeenRef = useRef(0);

    const handleChatViewMode = useCallback((nextMode) => {
        setChatViewMode(nextMode);
        if (nextMode === 'room') {
            const newestTs = getNewestRoomTs(chatMessages);
            if (newestTs) chatLastSeenRef.current = newestTs;
            setChatUnread(false);
        }
        if (nextMode === 'host') {
            const newestTs = getNewestDmTs(chatMessages);
            if (newestTs) dmLastSeenRef.current = newestTs;
            setDmUnread(false);
        }
    }, [chatMessages]);

    const markChatTabSeen = useCallback(() => {
        const newestTs = getTimestampMs(chatMessages[0]);
        if (newestTs) chatLastSeenRef.current = newestTs;
        setChatUnread(false);
    }, [chatMessages]);

    useEffect(() => {
        const syncTimer = setTimeout(() => {
            if (room?.chatEnabled !== undefined) setChatEnabled(!!room.chatEnabled);
            if (room?.chatShowOnTv !== undefined) setChatShowOnTv(!!room.chatShowOnTv);
            if (room?.chatTvMode) setChatTvMode(room.chatTvMode);
            if (room?.chatSlowModeSec !== undefined && room?.chatSlowModeSec !== null) {
                setChatSlowModeSec(room.chatSlowModeSec);
            }
            if (room?.chatAudienceMode) setChatAudienceMode(room.chatAudienceMode);
        }, 0);
        return () => clearTimeout(syncTimer);
    }, [room?.chatEnabled, room?.chatShowOnTv, room?.chatTvMode, room?.chatSlowModeSec, room?.chatAudienceMode]);

    useEffect(() => {
        if (!roomCode) return;
        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'),
            where('roomCode', '==', roomCode),
            orderBy('timestamp', 'desc'),
            limit(40)
        );
        const unsub = onSnapshot(q, snap => {
            const next = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setChatMessages(next);
            const roomTs = getNewestRoomTs(next);
            const dmTs = getNewestDmTs(next);

            if (chatViewMode === 'room' && roomTs) {
                chatLastSeenRef.current = Math.max(chatLastSeenRef.current, roomTs);
                setChatUnread(false);
            } else if (roomTs && roomTs > chatLastSeenRef.current && settingsTab !== 'chat') {
                setChatUnread(true);
            }

            if (chatViewMode === 'host' && dmTs) {
                dmLastSeenRef.current = Math.max(dmLastSeenRef.current, dmTs);
                setDmUnread(false);
            } else if (dmTs && dmTs > dmLastSeenRef.current && settingsTab !== 'chat') {
                setDmUnread(true);
            }
        });
        return () => unsub();
    }, [roomCode, settingsTab, chatViewMode]);

    const sendHostChatMessage = useCallback(async (text) => {
        const message = (text ?? chatDraft).trim();
        if (!message || !roomCode) return;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'), {
                roomCode,
                text: message,
                user: hostName || 'Host',
                avatar: EMOJI.mic,
                isHost: true,
                timestamp: serverTimestamp()
            });
            if (!text || message === chatDraft.trim()) {
                setChatDraft('');
            }
        } catch (e) {
            console.error(e);
            toast('Chat send failed');
        }
    }, [chatDraft, roomCode, hostName, toast]);

    const sendHostChat = useCallback(async () => sendHostChatMessage(), [sendHostChatMessage]);

    const sendHostDmMessage = useCallback(async (targetUid, text) => {
        const message = (text ?? '').trim();
        if (!message || !roomCode || !targetUid) return;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'), {
                roomCode,
                text: message,
                user: hostName || 'Host',
                avatar: EMOJI.mic,
                isHost: true,
                toUid: targetUid,
                channel: 'dm',
                timestamp: serverTimestamp()
            });
        } catch (e) {
            console.error(e);
            toast('DM send failed');
        }
    }, [roomCode, hostName, toast]);

    return {
        chatEnabled,
        setChatEnabled,
        chatShowOnTv,
        setChatShowOnTv,
        chatTvMode,
        setChatTvMode,
        chatSlowModeSec,
        setChatSlowModeSec,
        chatAudienceMode,
        setChatAudienceMode,
        chatDraft,
        setChatDraft,
        dmTargetUid,
        setDmTargetUid,
        dmDraft,
        setDmDraft,
        chatMessages,
        pinnedChatIds,
        setPinnedChatIds,
        chatUnread,
        dmUnread,
        chatViewMode,
        handleChatViewMode,
        sendHostChat,
        sendHostDmMessage,
        markChatTabSeen
    };
};

export default useHostChat;
