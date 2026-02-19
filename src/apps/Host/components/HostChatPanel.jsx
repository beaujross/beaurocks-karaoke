import React, { useEffect, useMemo, useRef } from 'react';
import groupChatMessages from '../../../lib/chatGrouping';

const HostChatPanel = ({
    chatOpen,
    chatUnread,
    openChatSettings,
    styles,
    appBase,
    roomCode,
    chatEnabled,
    setChatEnabled,
    updateRoom,
    chatShowOnTv,
    setChatShowOnTv,
    chatAudienceMode,
    setChatAudienceMode,
    handleChatViewMode,
    chatViewMode,
    dmUnread,
    dmTargetUid,
    setDmTargetUid,
    users,
    dmDraft,
    setDmDraft,
    sendHostDmMessage,
    roomChatMessages,
    hostDmMessages,
    pinnedChatIds,
    setPinnedChatIds,
    emoji,
    chatDraft,
    setChatDraft,
    sendHostChat,
    showSettingsButton = true,
    showPopoutButton = true
}) => {
    const displayedMessages = chatViewMode === 'room' ? roomChatMessages : hostDmMessages;
    const groupedMessages = groupChatMessages(displayedMessages.slice(-6), { mergeWindowMs: 12 * 60 * 1000 });
    const dmInputRef = useRef(null);
    const messagesScrollRef = useRef(null);
    const userNameByUid = useMemo(() => {
        const next = {};
        users.forEach((entry) => {
            const uid = String(entry?.uid || entry?.id?.split('_')[1] || '').trim();
            if (!uid) return;
            next[uid] = entry?.name || 'Guest';
        });
        return next;
    }, [users]);
    const dmSendDisabled = !dmTargetUid || !dmDraft.trim();
    useEffect(() => {
        const node = messagesScrollRef.current;
        if (!node) return;
        node.scrollTop = node.scrollHeight;
    }, [groupedMessages, chatViewMode]);

    return (
    <div className={chatOpen ? 'block' : 'hidden'}>
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                {chatUnread && <span className="text-sm uppercase tracking-widest text-pink-300">New</span>}
                {showSettingsButton && (
                    <button
                        onClick={() => openChatSettings?.()}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1`}
                        title="Open chat settings"
                    >
                        <i className="fa-solid fa-gear"></i>
                    </button>
                )}
                {showPopoutButton && (
                    <button
                        onClick={() => {
                            const target = `${appBase}?room=${roomCode}&mode=host&tab=stage&chat=1`;
                            window.open(target, '_blank');
                        }}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1`}
                        title="Pop out chat"
                    >
                        <i className="fa-solid fa-up-right-from-square"></i>
                    </button>
                )}
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <button
                onClick={async () => {
                    const next = !chatEnabled;
                    setChatEnabled(next);
                    await updateRoom({ chatEnabled: next });
                }}
                className={`${styles.btnStd} ${chatEnabled ? styles.btnHighlight : styles.btnNeutral}`}
                title="Enable or disable chat for the room"
            >
                <i className="fa-solid fa-comment mr-2"></i>{chatEnabled ? 'On' : 'Off'}
            </button>
            <button
                onClick={async () => {
                    const next = !chatShowOnTv;
                    setChatShowOnTv(next);
                    await updateRoom({ chatShowOnTv: next });
                }}
                className={`${styles.btnStd} ${chatShowOnTv ? styles.btnHighlight : styles.btnNeutral}`}
                title="Show chat in the TV rotation"
            >
                <i className="fa-solid fa-tv mr-2"></i>{chatShowOnTv ? 'TV' : 'TV Off'}
            </button>
            <button
                onClick={async () => {
                    const next = chatAudienceMode === 'vip' ? 'all' : 'vip';
                    setChatAudienceMode(next);
                    await updateRoom({ chatAudienceMode: next });
                }}
                className={`${styles.btnStd} ${chatAudienceMode === 'vip' ? styles.btnHighlight : styles.btnNeutral}`}
                title="Toggle VIP-only chat"
            >
                <i className="fa-solid fa-crown mr-2"></i>{chatAudienceMode === 'vip' ? 'VIP' : 'All'}
            </button>
        </div>
        <div className="mb-3">
            <div className="flex w-full bg-zinc-950/60 border border-white/10 rounded-t-xl overflow-hidden border-b-0">
                <button
                    onClick={() => handleChatViewMode('room')}
                    className={`flex-1 px-4 py-2 text-sm font-bold uppercase tracking-widest transition-all ${chatViewMode === 'room' ? 'bg-[#00C4D9] text-black shadow-inner' : 'text-zinc-300 hover:text-white'}`}
                    title="VIP lounge messages"
                >
                    <i className="fa-solid fa-comments mr-2"></i>VIP Lounge
                    {chatUnread && <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-pink-400"></span>}
                </button>
                <button
                    onClick={() => handleChatViewMode('host')}
                    className={`flex-1 px-4 py-2 text-sm font-bold uppercase tracking-widest transition-all ${chatViewMode === 'host' ? 'bg-[#00C4D9] text-black shadow-inner' : 'text-zinc-300 hover:text-white'}`}
                    title="Direct messages to the host"
                >
                    <i className="fa-solid fa-inbox mr-2"></i>DMs
                    {dmUnread && <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-pink-400"></span>}
                </button>
            </div>
            <div className="bg-zinc-900/60 border border-white/10 border-t-0 rounded-b-xl p-3 space-y-3">
                {chatViewMode === 'host' && (
                    <div className="space-y-2">
                        <div className={styles.header}>Direct Message</div>
                        <div className="text-xs text-zinc-400">
                            Reply target: <span className="text-white font-semibold">{userNameByUid[dmTargetUid] || (dmTargetUid ? 'Selected guest' : 'Pick a guest from DMs')}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <select
                                value={dmTargetUid}
                                onChange={(e) => setDmTargetUid(e.target.value)}
                                className={`${styles.input} min-w-[160px] flex-1`}
                            >
                                <option value="">Select guest</option>
                                {users.map((u) => {
                                    const id = u.uid || u.id?.split('_')[1] || '';
                                    return (
                                        <option key={u.id || id} value={id}>
                                            {u.name || 'Guest'}
                                        </option>
                                    );
                                })}
                            </select>
                            <input
                                ref={dmInputRef}
                                value={dmDraft}
                                onChange={(e) => setDmDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        const message = dmDraft.trim();
                                        if (!dmTargetUid || !message) return;
                                        sendHostDmMessage(dmTargetUid, message);
                                        setDmDraft('');
                                    }
                                }}
                                className={`${styles.input} flex-[2] min-w-[200px]`}
                                placeholder="Write a quick DM..."
                            />
                            <button
                                onClick={() => {
                                    const message = dmDraft.trim();
                                    if (!dmTargetUid || !message) return;
                                    sendHostDmMessage(dmTargetUid, message);
                                    setDmDraft('');
                                }}
                                disabled={dmSendDisabled}
                                className={`${styles.btnStd} ${styles.btnSecondary} px-4 ${dmSendDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Send
                            </button>
                        </div>
                    </div>
                )}
                <div ref={messagesScrollRef} className="bg-zinc-950/60 border border-white/10 rounded-xl p-3 h-40 overflow-y-auto custom-scrollbar space-y-2">
                    {groupedMessages.length === 0 && (
                        <div className="text-sm text-zinc-500 h-full flex items-center justify-center">No messages yet.</div>
                    )}
                    {groupedMessages.map((group, groupIdx) => {
                        const groupPinned = group.messages.some((message) => pinnedChatIds.includes(message.id));
                        return (
                            <div key={group.id} className={`text-sm rounded-lg px-2 py-2 border ${groupPinned ? 'bg-yellow-500/10 border-yellow-400/40' : group.isHost ? 'bg-cyan-500/10 border-cyan-400/30' : 'bg-zinc-900/60 border-white/5'}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span>{group.avatar || emoji.sparkle}</span>
                                        <span className={`font-bold truncate ${group.isHost ? 'text-cyan-300' : 'text-white'}`}>{group.user || 'Guest'}</span>
                                        {group.isVip && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400 text-black font-black tracking-widest">VIP</span>}
                                        {group.isHost && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500 text-black font-black tracking-widest">HOST</span>}
                                        {groupPinned && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500 text-black font-black tracking-widest">PIN</span>}
                                        {group.messages.length > 1 && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/35 text-zinc-300 border border-white/10">
                                                {group.messages.length} msgs
                                            </span>
                                        )}
                                        {chatViewMode === 'host' && group.senderUid && (
                                            <button
                                                onClick={() => {
                                                    setDmTargetUid(group.senderUid);
                                                    dmInputRef.current?.focus();
                                                }}
                                                className={`${styles.btnStd} ${styles.btnInfo} px-2 py-1 text-[10px]`}
                                                title="Reply to this thread"
                                            >
                                                Reply
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-1.5 space-y-1.5">
                                    {group.messages.map((msg, msgIdx) => {
                                        const isPinned = pinnedChatIds.includes(msg.id);
                                        const isLatest = groupIdx === groupedMessages.length - 1 && msgIdx === group.messages.length - 1;
                                        return (
                                            <div key={msg.id || `${group.id}-${msgIdx}`} className={`flex items-start justify-between gap-2 rounded-md px-1.5 py-1 ${isLatest ? 'ring-1 ring-pink-400/40 bg-pink-500/5' : ''}`}>
                                                <div className="text-zinc-200 text-sm break-words leading-snug">{msg.text}</div>
                                                <button
                                                    onClick={() => {
                                                        setPinnedChatIds(prev => isPinned ? prev.filter(id => id !== msg.id) : [msg.id, ...prev].slice(0, 3));
                                                    }}
                                                    className={`${styles.btnStd} ${isPinned ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-[10px] shrink-0`}
                                                    title={isPinned ? 'Unpin message' : 'Pin message'}
                                                >
                                                    <i className="fa-solid fa-thumbtack"></i>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        {chatViewMode === 'room' && (
            <div className="mt-3 flex gap-2">
                <input
                    value={chatDraft}
                    onChange={e => setChatDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendHostChat();
                        }
                    }}
                    className={`${styles.input} text-xs flex-1`}
                    placeholder="Message the room..."
                    title="Send a message to the audience"
                />
                <button onClick={sendHostChat} className={`${styles.btnStd} ${styles.btnHighlight} px-3`} title="Send chat message">
                    <i className="fa-solid fa-paper-plane mr-2"></i>Send
                </button>
            </div>
        )}
    </div>
    );
};

export default HostChatPanel;
