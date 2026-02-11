import React from 'react';

const OverlaysGuidesPanel = ({
    overlaysOpen,
    room,
    updateRoom,
    toggleHowToPlay,
    startReadyCheck,
    marqueeEnabled,
    setMarqueeEnabled,
    chatShowOnTv,
    setChatShowOnTv,
    chatUnread,
    vibeSyncOpen,
    setVibeSyncOpen,
    startBeatDrop,
    startStormSequence,
    stopStormSequence,
    styles,
    sectionHeader: SectionHeader
}) => (
    <>
        <div className={overlaysOpen ? 'grid grid-cols-2 gap-2' : 'hidden'}>
            <button onClick={() => updateRoom({ activeScreen: room?.activeScreen === 'leaderboard' ? 'stage' : 'leaderboard' })} className={`${styles.btnStd} ${room?.activeScreen === 'leaderboard' ? styles.btnHighlight : styles.btnNeutral} flex-1`}><i className="fa-solid fa-trophy mr-2"></i>Leaderboard</button>
            <button onClick={() => updateRoom({ activeScreen: room?.activeScreen === 'tipping' ? 'stage' : 'tipping' })} className={`${styles.btnStd} ${room?.activeScreen === 'tipping' ? styles.btnHighlight : styles.btnNeutral} flex-1`}><i className="fa-solid fa-money-bill-wave mr-2"></i>Tip CTA</button>
            <button onClick={toggleHowToPlay} className={`${styles.btnStd} ${room?.howToPlay?.active ? styles.btnHighlight : styles.btnNeutral} flex-1`}><i className="fa-solid fa-circle-question mr-2"></i>How to Play</button>
            <button onClick={startReadyCheck} className={`${styles.btnStd} ${room?.readyCheck?.active ? styles.btnHighlight : styles.btnPrimary} flex-1`}><i className="fa-solid fa-check mr-2"></i>Ready Check</button>
            <button
                onClick={async () => {
                    const next = !marqueeEnabled;
                    setMarqueeEnabled(next);
                    await updateRoom({ marqueeEnabled: next });
                }}
                className={`${styles.btnStd} ${marqueeEnabled ? styles.btnHighlight : styles.btnNeutral} flex-1`}
            >
                <i className="fa-solid fa-scroll mr-2"></i>Marquee
            </button>
            <button
                onClick={async () => {
                    const next = !chatShowOnTv;
                    setChatShowOnTv(next);
                    await updateRoom({ chatShowOnTv: next });
                }}
                className={`${styles.btnStd} ${chatShowOnTv ? styles.btnHighlight : styles.btnNeutral} flex-1 relative`}
                title="Rotate chat onto the TV feed"
            >
                <i className="fa-solid fa-comments mr-2"></i>Chat TV
                {chatUnread && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-pink-400"></span>
                )}
            </button>
        </div>
        <div className="mt-3">
            <SectionHeader
                label="Vibe Sync"
                open={vibeSyncOpen}
                onToggle={() => setVibeSyncOpen(v => !v)}
            />
        </div>
        <div className={vibeSyncOpen ? 'rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/10 via-zinc-900/60 to-zinc-900/80 p-3 shadow-[0_0_24px_rgba(236,72,153,0.15)]' : 'hidden'}>
            <div className="flex items-center gap-2 text-sm uppercase tracking-widest text-pink-200 mb-3">
                <i className="fa-solid fa-wand-magic-sparkles"></i> Vibe Sync
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                <button
                    onClick={() => (room?.lightMode === 'strobe' ? updateRoom({ lightMode: 'off' }) : startBeatDrop())}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.lightMode === 'strobe' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`}
                    title="5s countdown, then 15s tap battle"
                >
                    <i className="fa-solid fa-bolt"></i> Beat Drop
                </button>
                <button onClick={() => {
                    if (room?.lightMode === 'guitar') {
                        updateRoom({ lightMode: 'off' });
                    } else {
                        updateRoom({ lightMode: 'guitar', guitarSessionId: Date.now(), guitarWinner: null, guitarVictory: null });
                    }
                }} className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.lightMode === 'guitar' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`} title="Guitar vibe sync takeover"><i className="fa-solid fa-guitar"></i> Guitar</button>
                <button onClick={() => updateRoom({ lightMode: room?.lightMode === 'banger' ? 'off' : 'banger' })} className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.lightMode === 'banger' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`} title="High-energy fire visuals"><i className="fa-solid fa-fire"></i> Banger</button>
                <button onClick={() => updateRoom({ lightMode: room?.lightMode === 'ballad' ? 'off' : 'ballad' })} className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.lightMode === 'ballad' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`} title="Lighter sway mode"><i className="fa-solid fa-music"></i> Ballad</button>
                <button
                    onClick={() => (room?.lightMode === 'storm' ? stopStormSequence() : startStormSequence())}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.lightMode === 'storm' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`}
                    title="Run the storm sequence"
                >
                    <i className="fa-solid fa-cloud-bolt"></i>
                    {room?.lightMode === 'storm' ? `Storm (${room?.stormPhase || 'live'})` : 'Storm'}
                </button>
                <button onClick={() => updateRoom({ activeMode: room?.activeMode === 'selfie_cam' ? 'karaoke' : 'selfie_cam' })} className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.activeMode === 'selfie_cam' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`} title="Audience selfie camera"><i className="fa-solid fa-camera"></i> Cam</button>
            </div>
        </div>
    </>
);

export default OverlaysGuidesPanel;
