import React, { useEffect, useRef } from 'react';
import groupChatMessages from '../../../lib/chatGrouping';

const ChatSettingsPanel = ({
    styles,
    chatAudienceMode,
    setChatAudienceMode,
    updateRoom,
    chatEnabled,
    setChatEnabled,
    chatShowOnTv,
    setChatShowOnTv,
    chatTvMode,
    setChatTvMode,
    chatSlowModeSec,
    setChatSlowModeSec,
    handleChatViewMode,
    chatViewMode,
    chatMessages,
    emoji,
    chatDraft,
    setChatDraft,
    sendHostChat
}) => {
    const isDirectChatMessage = (message = {}) => (
        !!message?.toHost
        || !!message?.toUid
        || message?.channel === 'host'
        || message?.channel === 'dm'
    );
    const visibleMessages = chatViewMode === 'room'
        ? chatMessages.filter(m => !isDirectChatMessage(m))
        : chatMessages.filter(m => isDirectChatMessage(m));
    const groupedVisibleMessages = groupChatMessages(visibleMessages.slice(-24), { mergeWindowMs: 12 * 60 * 1000 });
    const recentChatScrollRef = useRef(null);
    useEffect(() => {
        const node = recentChatScrollRef.current;
        if (!node) return;
        node.scrollTop = node.scrollHeight;
    }, [groupedVisibleMessages, chatViewMode]);

    return (
        <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 space-y-4">
            <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Chat Settings</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <div className="text-xs uppercase tracking-widest text-zinc-400">Audience access</div>
                    <div className="flex gap-2">
                        <button
                            onClick={async () => {
                                setChatAudienceMode('all');
                                await updateRoom({ chatAudienceMode: 'all' });
                            }}
                            className={`${styles.btnStd} ${chatAudienceMode === 'all' ? styles.btnHighlight : styles.btnNeutral}`}
                            title="Everyone can chat"
                        >
                            All Users
                        </button>
                        <button
                            onClick={async () => {
                                setChatAudienceMode('vip');
                                await updateRoom({ chatAudienceMode: 'vip' });
                            }}
                            className={`${styles.btnStd} ${chatAudienceMode === 'vip' ? styles.btnHighlight : styles.btnNeutral}`}
                            title="Only VIPs can chat"
                        >
                            VIP Only
                        </button>
                    </div>
                    <div className="host-form-helper">Use VIP-only chat for premium nights.</div>
                </div>
                <div className="space-y-2">
                    <div className="text-xs uppercase tracking-widest text-zinc-400">Room chat status</div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={async () => {
                                const next = !chatEnabled;
                                setChatEnabled(next);
                                await updateRoom({ chatEnabled: next });
                            }}
                            className={`${styles.btnStd} ${chatEnabled ? styles.btnHighlight : styles.btnNeutral}`}
                        >
                            <i className="fa-solid fa-comments mr-2"></i>
                            {chatEnabled ? 'Chat On' : 'Chat Off'}
                        </button>
                    </div>
                    <div className="host-form-helper">Chat on/off policy is configured here. Live TV routing is controlled from Live Deck.</div>
                </div>
            </div>
            <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-zinc-400">TV feed routing</div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
                    <div className="text-sm text-zinc-200">
                        Current TV Chat: <span className="font-semibold text-white">{chatShowOnTv ? 'On' : 'Off'}</span>
                    </div>
                    <div className="text-sm text-zinc-200">
                        Current TV Mode: <span className="font-semibold text-white uppercase">{chatTvMode || 'auto'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={async () => {
                                const next = !chatShowOnTv;
                                setChatShowOnTv(next);
                                const nextMode = next ? (chatTvMode || 'auto') : 'auto';
                                if (!next) setChatTvMode('auto');
                                await updateRoom({ chatShowOnTv: next, chatTvMode: nextMode });
                            }}
                            className={`${styles.btnStd} ${chatShowOnTv ? styles.btnHighlight : styles.btnNeutral}`}
                        >
                            <i className="fa-solid fa-tv mr-2"></i>
                            {chatShowOnTv ? 'TV Chat On' : 'TV Chat Off'}
                        </button>
                        <button
                            onClick={async () => {
                                const nextMode = chatTvMode === 'fullscreen' ? 'auto' : 'fullscreen';
                                setChatShowOnTv(true);
                                setChatTvMode(nextMode);
                                await updateRoom({ chatShowOnTv: true, chatTvMode: nextMode });
                            }}
                            className={`${styles.btnStd} ${chatTvMode === 'fullscreen' ? styles.btnHighlight : styles.btnNeutral}`}
                        >
                            <i className="fa-solid fa-expand mr-2"></i>
                            {chatTvMode === 'fullscreen' ? 'Fullscreen' : 'Sidebar / Auto'}
                        </button>
                    </div>
                </div>
                <div className="host-form-helper">Handle TV chat routing here. The live deck still mirrors these controls for quick during-show access.</div>
            </div>
            <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-zinc-400">Slow mode (seconds)</div>
                <input
                    type="number"
                    min="0"
                    max="120"
                    value={chatSlowModeSec}
                    onChange={e => setChatSlowModeSec(e.target.value)}
                    onBlur={async () => {
                        const value = Math.max(0, Number(chatSlowModeSec || 0));
                        await updateRoom({ chatSlowModeSec: value });
                    }}
                    className={styles.input}
                />
                <div className="host-form-helper">0 disables slow mode. Applies to all chat senders.</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={() => handleChatViewMode('room')}
                    className={`${styles.btnStd} ${chatViewMode === 'room' ? styles.btnHighlight : styles.btnNeutral}`}
                >
                    <i className="fa-solid fa-comments mr-2"></i>
                    Room Chat
                </button>
                <button
                    onClick={() => handleChatViewMode('host')}
                    className={`${styles.btnStd} ${chatViewMode === 'host' ? styles.btnHighlight : styles.btnNeutral}`}
                >
                    <i className="fa-solid fa-inbox mr-2"></i>
                    Host DMs
                </button>
            </div>
            <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Recent chat</div>
            <div ref={recentChatScrollRef} className="max-h-56 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                {groupedVisibleMessages.length === 0 && (
                    <div className="text-zinc-500 text-xs italic">No chat yet.</div>
                )}
                {groupedVisibleMessages.map((group) => (
                    <div key={group.id} className="bg-zinc-900/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-zinc-200">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{group.avatar || emoji.sparkle}</span>
                            <span className="font-bold text-white">{group.user || 'Guest'}</span>
                            {group.isVip && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-400 text-black font-black tracking-widest">VIP</span>}
                            {group.isHost && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500 text-black font-black tracking-widest">HOST</span>}
                        </div>
                        <div className="mt-1.5 pl-7 space-y-1">
                            {group.messages.map((message, idx) => (
                                <div key={message.id || `${group.id}-${idx}`} className="text-zinc-300 break-words">{message.text}</div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Send a host message</div>
            <div className="flex gap-2">
                <input
                    value={chatDraft}
                    onChange={e => setChatDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendHostChat();
                        }
                    }}
                    className={`${styles.input} flex-1`}
                    placeholder="Type a hype message..."
                />
                <button onClick={sendHostChat} className={`${styles.btnStd} ${styles.btnHighlight} px-4`}>
                    Send
                </button>
            </div>
        </div>
    );
};

export default ChatSettingsPanel;
