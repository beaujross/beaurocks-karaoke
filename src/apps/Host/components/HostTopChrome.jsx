import React from 'react';
import ModerationInboxChip from './ModerationInboxChip';

const HostTopChrome = ({
    room,
    appBase,
    roomCode,
    gamesMeta,
    tab,
    setTab,
    showLaunchMenu,
    setShowLaunchMenu,
    showNavMenu,
    setShowNavMenu,
    setShowSettings,
    setSettingsTab,
    openAdminWorkspace,
    styles,
    logoFallback,
    audioPanelOpen,
    setAudioPanelOpen,
    stageMeterLevel,
    stageMicReady,
    stageMicError,
    requestStageMic,
    toggleSongMute,
    updateRoom,
    smallWaveform,
    bgAnalyserActive,
    bgMeterLevel,
    bgVolume,
    setBgVolume,
    toggleBgMusic,
    playingBg,
    skipBg,
    autoBgMusic,
    setAutoBgMusic,
    setBgMusicState,
    toggleBgMute,
    currentTrackName,
    mixFader,
    handleMixFaderChange,
    moderationPendingCount = 0,
    moderationSeverity = 'idle',
    moderationNeedsAttention = false,
    onOpenModerationInbox
}) => {
    const SmallWaveform = smallWaveform;
    return (
    <div className="bg-zinc-900 px-4 py-2 flex flex-col gap-1.5 shadow-2xl shrink-0 relative z-20 border-b border-zinc-800">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between w-full">
            <div className="flex items-center gap-2 md:gap-3">
                <img
                    src={room?.logoUrl || logoFallback}
                    className="h-11 md:h-14 object-contain rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.4)] ring-1 ring-white/10 bg-black/40 p-0.5"
                    alt="Beaurocks Karaoke"
                />
                <div className="text-[14px] md:text-[18px] font-mono font-bold text-[#00C4D9] bg-black/40 px-2 py-0.5 rounded-lg border border-[#00C4D9]/30">{roomCode}</div>
                <div className="relative">
                    <button
                        onClick={() => setShowLaunchMenu(prev => !prev)}
                        className={`${styles.btnStd} ${styles.btnSecondary} px-2.5 text-xs`}
                    >
                        <i className="fa-solid fa-rocket"></i>
                    </button>
                    {showLaunchMenu && (
                        <div className="absolute left-0 top-full mt-2 w-56 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50">
                            <a
                                href={`${appBase}?room=${roomCode}&mode=tv`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setShowLaunchMenu(false)}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900 rounded-t-xl"
                            >
                                <i className="fa-solid fa-tv mr-2 text-cyan-300"></i> Launch TV
                            </a>
                            <a
                                href={`${appBase}?room=${roomCode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setShowLaunchMenu(false)}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                            >
                                <i className="fa-solid fa-mobile-screen-button mr-2 text-pink-300"></i> Launch Mobile
                            </a>
                            <a
                                href={`${appBase}?room=${roomCode}&mode=host&tab=browse&catalogue=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setShowLaunchMenu(false)}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                            >
                                <i className="fa-solid fa-book-open mr-2 text-yellow-300"></i> Launch Catalogue
                            </a>
                            <div className="px-4 py-2 text-sm uppercase tracking-[0.3em] text-zinc-500 border-t border-zinc-800">
                                Game Displays
                            </div>
                            {gamesMeta.map((game, idx, arr) => (
                                <a
                                    key={game.id}
                                    href={`${appBase}?room=${roomCode}&mode=host&game=${game.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setShowLaunchMenu(false)}
                                    className={`block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900 ${idx === arr.length - 1 ? 'rounded-b-xl' : ''}`}
                                >
                                    <i className="fa-solid fa-gamepad mr-2 text-cyan-300"></i>
                                    {game.name}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 justify-between md:justify-end">
                {room?.activeMode && room.activeMode !== 'karaoke' && (
                    <div className="bg-red-600 px-2.5 py-0.5 rounded text-[10px] md:text-xs font-bold animate-pulse">LIVE: {room.activeMode.toUpperCase()}</div>
                )}
                <ModerationInboxChip
                    pendingCount={moderationPendingCount}
                    severity={moderationSeverity}
                    needsAttention={moderationNeedsAttention}
                    onClick={onOpenModerationInbox}
                />
                <div className="hidden md:flex items-center gap-2">
                    {[
                        { key: 'stage', label: 'Queue' },
                        { key: 'games', label: 'Games' },
                        { key: 'lobby', label: 'Audience' },
                        { key: 'admin', label: 'Admin' }
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => {
                                if (t.key === 'admin' && typeof openAdminWorkspace === 'function') {
                                    openAdminWorkspace('ops.room_setup');
                                    return;
                                }
                                setTab(t.key);
                            }}
                            className={`px-3 py-1.5 text-sm font-black uppercase tracking-[0.22em] rounded-xl border-b-2 transition-all ${tab === t.key ? 'text-[#00C4D9] border-[#00C4D9] bg-black/40' : 'text-zinc-400 border-transparent bg-zinc-900/40 hover:text-white'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => {
                        if (typeof openAdminWorkspace === 'function') {
                            openAdminWorkspace('ops.room_setup');
                            return;
                        }
                        setShowSettings(true);
                        setSettingsTab('general');
                    }}
                    className="text-zinc-500 hover:text-white"
                    title="Open Admin"
                >
                    <i className="fa-solid fa-gear text-base md:text-lg"></i>
                </button>
                <div className="relative">
                    <button
                        onClick={() => setShowNavMenu(prev => !prev)}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-3 text-sm md:hidden`}
                    >
                        <i className="fa-solid fa-bars"></i>
                    </button>
                    {showNavMenu && (
                        <div className="absolute right-0 top-full mt-2 w-44 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50">
                            {[
                                { key: 'stage', label: 'Queue' },
                                { key: 'games', label: 'Games' },
                                { key: 'lobby', label: 'Audience' },
                                { key: 'admin', label: 'Admin' }
                            ].map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => {
                                        if (t.key === 'admin' && typeof openAdminWorkspace === 'function') {
                                            openAdminWorkspace('ops.room_setup');
                                            setShowNavMenu(false);
                                            return;
                                        }
                                        setTab(t.key);
                                        setShowNavMenu(false);
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm font-bold uppercase tracking-widest ${tab === t.key ? 'text-[#00C4D9]' : 'text-zinc-300'} hover:bg-zinc-900 ${t.key === 'stage' ? 'rounded-t-xl' : ''} ${t.key === 'admin' ? 'rounded-b-xl' : ''}`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
        <div className="w-full">
            <button
                onClick={() => setAudioPanelOpen(v => !v)}
                className={`w-full flex items-center justify-between ${styles.header}`}
            >
                <span className="flex items-center gap-2">
                    <i className="fa-solid fa-sliders"></i>
                    Audio + Mix
                </span>
                <i className={`fa-solid fa-chevron-down transition-transform ${audioPanelOpen ? 'rotate-180' : ''}`}></i>
            </button>
            <div className={audioPanelOpen ? 'block' : 'hidden'}>
                <div className="w-full bg-gradient-to-r from-[#00E5FF]/12 via-[#2BD4C8]/10 to-[#EC4899]/12 border border-white/10 rounded-2xl p-3 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 bg-zinc-900/80 px-3 py-3 rounded-xl border border-white/10 h-14">
                            <div className="text-xs uppercase tracking-widest text-zinc-400">Stage Audio</div>
                            <SmallWaveform level={stageMeterLevel} className="h-10 w-20" color="rgba(236,72,153,0.9)" />
                            {!stageMicReady && (
                                <button
                                    onClick={requestStageMic}
                                    className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1 text-xs min-w-[30px]`}
                                    title={stageMicError ? 'Enable mic for stage meter' : 'Enable stage meter'}
                                >
                                    <i className={`fa-solid ${stageMicError ? 'fa-microphone-slash' : 'fa-microphone'} w-4 text-center`}></i>
                                </button>
                            )}
                            <button onClick={toggleSongMute} className={`${styles.btnStd} ${(room?.videoVolume ?? 100) === 0 ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}>
                                <i className={`fa-solid ${(room?.videoVolume ?? 100) === 0 ? 'fa-volume-xmark' : 'fa-volume-high'} w-4 text-center`}></i>
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={room?.videoVolume ?? 100}
                                onChange={e => updateRoom({ videoVolume: parseInt(e.target.value, 10) })}
                                className="w-32 h-3 bg-zinc-800 accent-pink-500 rounded-lg appearance-none cursor-pointer stage-volume-slider"
                                style={{ background: `linear-gradient(90deg, #00C4D9 ${room?.videoVolume ?? 100}%, #27272a ${room?.videoVolume ?? 100}%)` }}
                            />
                        </div>
                        <div className="flex items-center gap-3 bg-zinc-900/80 px-3 py-3 rounded-xl border border-white/10 h-14">
                            <div className="text-xs uppercase tracking-widest text-zinc-400">BG</div>
                            <SmallWaveform level={bgAnalyserActive ? bgMeterLevel : Math.round(bgVolume * 100)} className="h-10 w-20" color="rgba(0,196,217,0.95)" />
                            <button onClick={toggleBgMusic} className={`${styles.btnStd} ${playingBg ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`} title="Toggle BG music">
                                <i className={`fa-solid ${playingBg ? 'fa-pause' : 'fa-play'} w-4 text-center`}></i>
                            </button>
                            <button onClick={skipBg} className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`} title="Skip BG track">
                                <i className="fa-solid fa-forward-step w-4 text-center"></i>
                            </button>
                            <button
                                onClick={async () => {
                                    const next = !autoBgMusic;
                                    setAutoBgMusic(next);
                                    await updateRoom({ autoBgMusic: next });
                                    if (next && !playingBg) setBgMusicState(true);
                                }}
                                className={`${styles.btnStd} ${autoBgMusic ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}
                                title="Keep BG music rolling between songs"
                            >
                                <i className="fa-solid fa-compact-disc w-4 text-center"></i>
                            </button>
                            <button onClick={toggleBgMute} className={`${styles.btnStd} ${bgVolume === 0 ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}>
                                <i className={`fa-solid ${bgVolume === 0 ? 'fa-volume-xmark' : 'fa-volume-high'} w-4 text-center`}></i>
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={Math.round(bgVolume * 100)}
                                onChange={e => {
                                    const val = parseInt(e.target.value, 10) / 100;
                                    setBgVolume(val);
                                    updateRoom({ bgMusicVolume: val });
                                }}
                                className="w-32 h-3 bg-zinc-800 accent-cyan-500 rounded-lg appearance-none cursor-pointer bg-volume-slider"
                                style={{ background: `linear-gradient(90deg, #EC4899 ${Math.round(bgVolume * 100)}%, #27272a ${Math.round(bgVolume * 100)}%)` }}
                            />
                            <div className="text-sm text-zinc-400 truncate max-w-[120px]">
                                <i className="fa-solid fa-music mr-1"></i>
                                {currentTrackName || 'BG Track'}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-zinc-900/80 px-3 py-3 rounded-xl border border-white/10 h-14 mt-4">
                        <div className="text-sm uppercase tracking-widest text-zinc-400">Mix</div>
                        <div className="flex flex-col gap-3 flex-1">
                            <div className="relative">
                                <span className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-5 bg-white/40 rounded-full"></span>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={mixFader}
                                    onChange={e => handleMixFaderChange(parseInt(e.target.value, 10))}
                                    className="mix-slider w-full relative z-10"
                                    style={{ '--mix-split': `${mixFader}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-sm text-zinc-400">
                                <span className="text-[#00C4D9]">BG Music {mixFader}%</span>
                                <span className="text-pink-300">Stage Audio {100 - mixFader}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
};

export default HostTopChrome;
