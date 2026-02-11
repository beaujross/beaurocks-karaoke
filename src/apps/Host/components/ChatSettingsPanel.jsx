import React from 'react';

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
    const visibleMessages = chatViewMode === 'room'
        ? chatMessages.filter(m => !m.toHost)
        : chatMessages.filter(m => m.toHost);

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
                    <div className="text-xs uppercase tracking-widest text-zinc-400">Room status</div>
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
                        <button
                            onClick={async () => {
                                const next = !chatShowOnTv;
                                setChatShowOnTv(next);
                                await updateRoom({ chatShowOnTv: next });
                            }}
                            className={`${styles.btnStd} ${chatShowOnTv ? styles.btnHighlight : styles.btnNeutral}`}
                        >
                            <i className="fa-solid fa-tv mr-2"></i>
                            {chatShowOnTv ? 'TV Feed On' : 'TV Feed Off'}
                        </button>
                    </div>
                </div>
            </div>
            <div className="space-y-2">
                <div className="text-xs uppercase tracking-widest text-zinc-400">TV feed mode</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button
                        onClick={async () => {
                            setChatTvMode('auto');
                            await updateRoom({ chatTvMode: 'auto' });
                        }}
                        className={`${styles.btnStd} ${chatTvMode === 'auto' ? styles.btnHighlight : styles.btnNeutral}`}
                    >
                        Auto Rotate
                    </button>
                    <button
                        onClick={async () => {
                            setChatTvMode('chat');
                            await updateRoom({ chatTvMode: 'chat' });
                        }}
                        className={`${styles.btnStd} ${chatTvMode === 'chat' ? styles.btnHighlight : styles.btnNeutral}`}
                    >
                        Chat Only
                    </button>
                    <button
                        onClick={async () => {
                            setChatTvMode('activity');
                            await updateRoom({ chatTvMode: 'activity' });
                        }}
                        className={`${styles.btnStd} ${chatTvMode === 'activity' ? styles.btnHighlight : styles.btnNeutral}`}
                    >
                        Activity Only
                    </button>
                </div>
                <div className="host-form-helper">Auto rotates between chat and activity every few seconds when TV feed is on.</div>
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
            <div className="max-h-56 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                {visibleMessages.length === 0 && (
                    <div className="text-zinc-500 text-xs italic">No chat yet.</div>
                )}
                {visibleMessages.map(m => (
                    <div key={m.id} className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-zinc-200">
                        <span className="text-lg">{m.avatar || emoji.sparkle}</span>
                        <span className="font-bold text-white">{m.user || 'Guest'}</span>
                        <span className="text-zinc-400 truncate">{m.text}</span>
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
