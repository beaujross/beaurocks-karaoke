import React from 'react';
import ModerationInboxChip from './ModerationInboxChip';

const StatusPill = ({ label, value, active = false, toneClass = '' }) => (
    <div className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] ${toneClass}`}>
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]' : 'bg-rose-300 shadow-[0_0_10px_rgba(252,165,165,0.6)]'}`}></span>
        <span className="text-zinc-400">{label}</span>
        <span className="font-bold text-zinc-100">{value}</span>
    </div>
);

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
    autoPlayMedia,
    setAutoPlayMedia,
    setBgMusicState,
    toggleBgMute,
    currentTrackName,
    mixFader,
    handleMixFaderChange,
    startReadyCheck,
    startBeatDrop,
    startStormSequence,
    stopStormSequence,
    appleMusicConnected = false,
    aiToolsConnected = false,
    permissionLevel = 'unknown',
    authSessionReady = false,
    lyricsVisualizerModeActive = false,
    onToggleLyricsVisualizerMode,
    currentSongHasLyrics = false,
    aiGenerationAvailable = false,
    onOpenCommandPalette,
    sfxMuted = false,
    setSfxMuted,
    sfxVolume = 0.5,
    setSfxVolume,
    playSfxSafe,
    sounds = [],
    silenceAll,
    missionControlEnabled = false,
    missionRecommendation = null,
    missionStatusDetail = '',
    onRunMissionAction,
    moderationPendingCount = 0,
    moderationSeverity = 'idle',
    moderationNeedsAttention = false,
    onOpenModerationInbox
}) => {
    const SmallWaveform = smallWaveform;
    const [showLiveEffectsMenu, setShowLiveEffectsMenu] = React.useState(false);
    const [showMissionMenu, setShowMissionMenu] = React.useState(true);
    const [showTvQuickMenu, setShowTvQuickMenu] = React.useState(false);
    const [showSfxQuickMenu, setShowSfxQuickMenu] = React.useState(false);
    const [showVibeQuickMenu, setShowVibeQuickMenu] = React.useState(false);
    const liveEffectsMenuRef = React.useRef(null);
    const tvQuickMenuRef = React.useRef(null);
    const sfxQuickMenuRef = React.useRef(null);
    const vibeQuickMenuRef = React.useRef(null);
    const stormActive = room?.lightMode === 'storm';
    const strobeActive = room?.lightMode === 'strobe';
    const guitarActive = room?.lightMode === 'guitar';
    const bangerActive = room?.lightMode === 'banger';
    const balladActive = room?.lightMode === 'ballad';
    const selfieCamActive = room?.activeMode === 'selfie_cam';
    const normalizedPermission = String(permissionLevel || 'unknown').toLowerCase();
    const tvDisplayMode = room?.showLyricsTv && room?.showVisualizerTv
        ? 'lyrics_viz'
        : room?.showLyricsTv
            ? 'lyrics'
            : room?.showVisualizerTv
                ? 'visualizer'
                : 'video';
    const permissionTone = normalizedPermission === 'owner'
        ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
        : normalizedPermission === 'admin'
            ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100'
            : normalizedPermission === 'member'
                ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
                : 'border-zinc-600 bg-zinc-900/70 text-zinc-300';
    const missionStatus = missionRecommendation?.status || 'ready';
    const missionToneClass = missionStatus === 'needs_attention'
        ? 'border-amber-400/45 bg-amber-500/10 text-amber-100'
        : missionStatus === 'live'
            ? 'border-cyan-400/45 bg-cyan-500/10 text-cyan-100'
            : 'border-emerald-400/45 bg-emerald-500/10 text-emerald-100';
    const tvDisplayLabel = tvDisplayMode === 'lyrics_viz'
        ? 'Lyrics + Viz'
        : tvDisplayMode === 'lyrics'
            ? 'Lyrics'
            : tvDisplayMode === 'visualizer'
                ? 'Visualizer'
                : 'Video';
    const activeVibeLabel = selfieCamActive
        ? 'Selfie Cam'
        : stormActive
            ? 'Storm'
            : strobeActive
                ? 'Beat'
                : guitarActive
                    ? 'Guitar'
                    : bangerActive
                        ? 'Banger'
                        : balladActive
                            ? 'Ballad'
                            : 'Off';
    const closeAllDeckMenus = () => {
        setShowLiveEffectsMenu(false);
        setShowTvQuickMenu(false);
        setShowSfxQuickMenu(false);
        setShowVibeQuickMenu(false);
    };

    React.useEffect(() => {
        if (!showLiveEffectsMenu && !showTvQuickMenu && !showSfxQuickMenu && !showVibeQuickMenu) return undefined;
        const handleWindowClick = (event) => {
            if (
                liveEffectsMenuRef.current?.contains(event.target)
                || tvQuickMenuRef.current?.contains(event.target)
                || sfxQuickMenuRef.current?.contains(event.target)
                || vibeQuickMenuRef.current?.contains(event.target)
            ) return;
            closeAllDeckMenus();
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') closeAllDeckMenus();
        };
        window.addEventListener('mousedown', handleWindowClick);
        window.addEventListener('keydown', handleEscape);
        return () => {
            window.removeEventListener('mousedown', handleWindowClick);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [showLiveEffectsMenu, showTvQuickMenu, showSfxQuickMenu, showVibeQuickMenu]);

    const runLiveEffect = async (effectId) => {
        if (effectId === 'beat_drop') {
            if (strobeActive) {
                await updateRoom({ lightMode: 'off' });
            } else {
                await startBeatDrop?.();
            }
        } else if (effectId === 'storm') {
            if (stormActive) {
                await stopStormSequence?.();
            } else {
                await startStormSequence?.();
            }
        } else if (effectId === 'guitar') {
            await updateRoom({
                lightMode: guitarActive ? 'off' : 'guitar',
                guitarSessionId: Date.now(),
                guitarWinner: null,
                guitarVictory: null
            });
        } else if (effectId === 'banger') {
            await updateRoom({ lightMode: bangerActive ? 'off' : 'banger' });
        } else if (effectId === 'ballad') {
            await updateRoom({ lightMode: balladActive ? 'off' : 'ballad' });
        } else if (effectId === 'selfie_cam') {
            await updateRoom({ activeMode: selfieCamActive ? 'karaoke' : 'selfie_cam' });
        } else if (effectId === 'clear') {
            if (stormActive) {
                await stopStormSequence?.();
            } else {
                await updateRoom({
                    lightMode: 'off',
                    stormPhase: 'off',
                    activeMode: selfieCamActive ? 'karaoke' : room?.activeMode
                });
            }
        }
        closeAllDeckMenus();
    };
    const applyTvDisplayMode = async (mode) => {
        if (mode === 'lyrics') {
            await updateRoom({ showLyricsTv: true, showVisualizerTv: false, lyricsMode: room?.lyricsMode || 'auto' });
        } else if (mode === 'visualizer') {
            await updateRoom({ showLyricsTv: false, showVisualizerTv: true });
        } else if (mode === 'lyrics_viz') {
            await updateRoom({ showLyricsTv: true, showVisualizerTv: true, lyricsMode: room?.lyricsMode || 'auto' });
        } else {
            await updateRoom({ showLyricsTv: false, showVisualizerTv: false });
        }
        closeAllDeckMenus();
    };
    const runMissionDeckAction = async (actionId) => {
        await onRunMissionAction?.(actionId);
        closeAllDeckMenus();
    };
    const toggleMissionSection = () => setShowMissionMenu((prev) => !prev);

    return (
    <div data-host-top-chrome="true" className="bg-zinc-900 px-4 py-2 flex flex-col gap-1.5 shadow-2xl shrink-0 relative z-20 border-b border-zinc-800">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between w-full">
            <div className="flex items-center gap-2 md:gap-3">
                <img
                    src={room?.logoUrl || logoFallback}
                    className="h-11 md:h-14 object-contain rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.4)] ring-1 ring-white/10 bg-black/40 p-0.5"
                    alt="Beaurocks Karaoke"
                />
                <div data-host-room-code className="text-[14px] md:text-[18px] font-mono font-bold text-[#00C4D9] bg-black/40 px-2 py-0.5 rounded-lg border border-[#00C4D9]/30">{roomCode}</div>
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
                    <div data-host-live-mode={room.activeMode} className="bg-red-600 px-2.5 py-0.5 rounded text-xs md:text-sm font-bold animate-pulse">LIVE: {room.activeMode.toUpperCase()}</div>
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
                            data-host-tab={t.key}
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
                                    data-host-tab={t.key}
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
        <div className="w-full flex flex-wrap items-center gap-2">
            <StatusPill
                label="Apple"
                value={appleMusicConnected ? 'Connected' : 'Not Linked'}
                active={appleMusicConnected}
                toneClass={appleMusicConnected ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border-rose-400/35 bg-rose-500/10 text-rose-100'}
            />
            <StatusPill
                label="AI"
                value={aiToolsConnected ? 'Enabled' : 'Locked'}
                active={aiToolsConnected}
                toneClass={aiToolsConnected ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100' : 'border-amber-400/35 bg-amber-500/10 text-amber-100'}
            />
            <StatusPill
                label="Access"
                value={`${String(permissionLevel || 'unknown').toUpperCase()}${authSessionReady ? '' : ' / No Auth'}`}
                active={authSessionReady}
                toneClass={permissionTone}
            />
        </div>
        <div className="w-full rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-zinc-950/70 to-emerald-500/10 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs uppercase tracking-[0.24em] text-zinc-300 pr-2">Live Deck</div>
                <button
                    onClick={() => startReadyCheck?.()}
                    className={`${styles.btnStd} ${room?.readyCheck?.active ? styles.btnHighlight : styles.btnSecondary} px-3 py-1.5 text-xs min-w-[140px]`}
                    title="Run a short room reset countdown"
                >
                    <i className="fa-solid fa-hourglass-half mr-1"></i>
                    Ready Check
                </button>
                <button
                    onClick={async () => {
                        const next = !autoBgMusic;
                        setAutoBgMusic(next);
                        await updateRoom({ autoBgMusic: next });
                        if (next && !playingBg) setBgMusicState(true);
                    }}
                    className={`${styles.btnStd} ${autoBgMusic ? styles.btnHighlight : styles.btnNeutral} px-3 py-1.5 text-xs min-w-[130px]`}
                    title="Automatically fill dead air with background music"
                >
                    <i className="fa-solid fa-wave-square mr-1"></i>
                    {autoBgMusic ? 'BG Auto ON' : 'BG Auto'}
                </button>
                <button
                    onClick={async () => {
                        const next = !autoPlayMedia;
                        setAutoPlayMedia(next);
                        await updateRoom({ autoPlayMedia: next });
                    }}
                    className={`${styles.btnStd} ${autoPlayMedia ? styles.btnHighlight : styles.btnNeutral} px-3 py-1.5 text-xs min-w-[140px]`}
                    title="Automatically start stage media when songs begin"
                >
                    <i className="fa-solid fa-forward-step mr-1"></i>
                    {autoPlayMedia ? 'Auto-Play ON' : 'Auto-Play'}
                </button>
                <button
                    onClick={async () => {
                        if (typeof onToggleLyricsVisualizerMode === 'function') {
                            await onToggleLyricsVisualizerMode();
                            return;
                        }
                        const next = !lyricsVisualizerModeActive;
                        await updateRoom({
                            showVisualizerTv: next,
                            showLyricsTv: next,
                            lyricsMode: room?.lyricsMode || 'auto'
                        });
                    }}
                    className={`${styles.btnStd} ${lyricsVisualizerModeActive ? styles.btnHighlight : styles.btnNeutral} px-3 py-1.5 text-xs min-w-[170px]`}
                    title={!currentSongHasLyrics
                        ? (aiGenerationAvailable ? 'Will try to generate AI lyrics for the current song, then overlay over visualizer.' : 'Current song has no lyrics yet. Enable auto-lyrics on queue or edit lyrics.')
                        : 'Overlay lyrics on top of visualizer mode'}
                >
                    <i className="fa-solid fa-closed-captioning mr-1"></i>
                    {lyricsVisualizerModeActive ? 'Lyrics + Viz ON' : 'Lyrics + Viz'}
                </button>
                <div className="relative" ref={tvQuickMenuRef}>
                    <button
                        data-feature-id="deck-tv-menu-toggle"
                        onClick={() => {
                            const next = !showTvQuickMenu;
                            closeAllDeckMenus();
                            setShowTvQuickMenu(next);
                        }}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-3 py-1.5 text-[12px] normal-case tracking-[0.04em] min-w-[156px]`}
                        title="TV display modes"
                    >
                        <i className="fa-solid fa-tv mr-1"></i>
                        TV: {tvDisplayLabel}
                        <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showTvQuickMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                    {showTvQuickMenu && (
                        <div className="absolute right-0 top-full mt-2 w-[min(330px,92vw)] rounded-2xl border border-cyan-300/30 bg-zinc-900/98 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.55)] z-50">
                            <div className="text-xs uppercase tracking-[0.22em] text-zinc-300 mb-2">TV Display Modes</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    data-feature-id="deck-tv-video"
                                    onClick={() => applyTvDisplayMode('video')}
                                    className={`${styles.btnStd} ${tvDisplayMode === 'video' ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <i className="fa-solid fa-video"></i>
                                    Video
                                </button>
                                <button
                                    data-feature-id="deck-tv-lyrics"
                                    onClick={() => applyTvDisplayMode('lyrics')}
                                    className={`${styles.btnStd} ${tvDisplayMode === 'lyrics' ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <i className="fa-solid fa-closed-captioning"></i>
                                    Lyrics
                                </button>
                                <button
                                    data-feature-id="deck-tv-visualizer"
                                    onClick={() => applyTvDisplayMode('visualizer')}
                                    className={`${styles.btnStd} ${tvDisplayMode === 'visualizer' ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <i className="fa-solid fa-wave-square"></i>
                                    Visualizer
                                </button>
                                <button
                                    data-feature-id="deck-tv-lyrics-viz"
                                    onClick={() => applyTvDisplayMode('lyrics_viz')}
                                    className={`${styles.btnStd} ${tvDisplayMode === 'lyrics_viz' ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <i className="fa-solid fa-layer-group"></i>
                                    Lyrics + Viz
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="relative" ref={sfxQuickMenuRef}>
                    <button
                        data-feature-id="deck-sfx-menu-toggle"
                        onClick={() => {
                            const next = !showSfxQuickMenu;
                            closeAllDeckMenus();
                            setShowSfxQuickMenu(next);
                        }}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-3 py-1.5 text-[12px] normal-case tracking-[0.04em] min-w-[160px]`}
                        title="Sound effects controls"
                    >
                        <i className="fa-solid fa-wave-square mr-1"></i>
                        SFX: {sfxMuted ? 'Muted' : `${Math.round((sfxVolume || 0) * 100)}%`}
                        <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showSfxQuickMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                    {showSfxQuickMenu && (
                        <div className="absolute right-0 top-full mt-2 w-[min(340px,92vw)] rounded-2xl border border-cyan-300/30 bg-zinc-900/98 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.55)] z-50">
                            <div className="text-xs uppercase tracking-[0.22em] text-zinc-300 mb-2">Sound Effects</div>
                            <div className="rounded-xl border border-white/10 bg-black/30 p-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        data-feature-id="deck-sfx-mute"
                                        onClick={() => setSfxMuted?.((prev) => {
                                            const next = !prev;
                                            if (next) silenceAll?.();
                                            return next;
                                        })}
                                        className={`${styles.btnStd} ${sfxMuted ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em] min-w-[76px]`}
                                        title={sfxMuted ? 'Unmute FX' : 'Mute FX'}
                                    >
                                        <i className={`fa-solid ${sfxMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                                        {sfxMuted ? 'Muted' : 'On'}
                                    </button>
                                    <input
                                        data-feature-id="deck-sfx-volume"
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={Math.round((sfxVolume || 0) * 100)}
                                        onChange={(event) => setSfxVolume?.(parseInt(event.target.value, 10) / 100)}
                                        className="flex-1 h-2.5 bg-zinc-800 accent-[#00C4D9] rounded-lg appearance-none cursor-pointer"
                                        style={{ background: `linear-gradient(90deg, #00E5FF ${Math.round((sfxVolume || 0) * 100)}%, #27272a ${Math.round((sfxVolume || 0) * 100)}%)` }}
                                    />
                                </div>
                                <div className="mt-2 space-y-1 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                                    {(sounds || []).map((sound) => (
                                        <button
                                            data-feature-id="deck-sfx-button"
                                            key={`deck-sfx-quick-${sound.name}`}
                                            onClick={() => playSfxSafe?.(sound.url)}
                                            className={`${styles.btnStd} ${styles.btnNeutral} w-full justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <i className={`fa-solid ${sound.icon}`}></i>
                                                {sound.name}
                                            </span>
                                            <i className="fa-solid fa-play text-[11px]"></i>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="relative" ref={vibeQuickMenuRef}>
                    <button
                        data-feature-id="deck-vibe-menu-toggle"
                        onClick={() => {
                            const next = !showVibeQuickMenu;
                            closeAllDeckMenus();
                            setShowVibeQuickMenu(next);
                        }}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-3 py-1.5 text-[12px] normal-case tracking-[0.04em] min-w-[164px]`}
                        title="Vibe sync modes"
                    >
                        <i className="fa-solid fa-bolt mr-1"></i>
                        Vibe: {activeVibeLabel}
                        <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showVibeQuickMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                    {showVibeQuickMenu && (
                        <div className="absolute right-0 top-full mt-2 w-[min(360px,92vw)] rounded-2xl border border-cyan-300/30 bg-zinc-900/98 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.55)] z-50">
                            <div className="text-xs uppercase tracking-[0.22em] text-zinc-300 mb-2">Vibe Sync Modes</div>
                            <div className="rounded-xl border border-white/10 bg-black/30 p-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => runLiveEffect('beat_drop')} className={`${styles.btnStd} ${strobeActive ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-bolt"></i>
                                        {strobeActive ? 'Beat ON' : 'Beat Drop'}
                                    </button>
                                    <button onClick={() => runLiveEffect('storm')} className={`${styles.btnStd} ${stormActive ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-cloud-bolt"></i>
                                        {stormActive ? 'Storm ON' : 'Storm'}
                                    </button>
                                    <button onClick={() => runLiveEffect('guitar')} className={`${styles.btnStd} ${guitarActive ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-guitar"></i>
                                        {guitarActive ? 'Guitar ON' : 'Guitar'}
                                    </button>
                                    <button onClick={() => runLiveEffect('banger')} className={`${styles.btnStd} ${bangerActive ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-fire"></i>
                                        {bangerActive ? 'Banger ON' : 'Banger'}
                                    </button>
                                    <button onClick={() => runLiveEffect('ballad')} className={`${styles.btnStd} ${balladActive ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-music"></i>
                                        {balladActive ? 'Ballad ON' : 'Ballad'}
                                    </button>
                                    <button onClick={() => runLiveEffect('selfie_cam')} className={`${styles.btnStd} ${selfieCamActive ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-camera"></i>
                                        {selfieCamActive ? 'Selfie Cam ON' : 'Selfie Cam'}
                                    </button>
                                </div>
                                <button onClick={() => runLiveEffect('clear')} className={`${styles.btnStd} ${styles.btnSecondary} w-full mt-2 py-2 text-sm normal-case tracking-[0.03em]`}>
                                    <i className="fa-solid fa-power-off"></i>
                                    Clear Effects
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="relative" ref={liveEffectsMenuRef}>
                    <button
                        data-feature-id="deck-menu-toggle"
                        onClick={() => {
                            const next = !showLiveEffectsMenu;
                            closeAllDeckMenus();
                            setShowLiveEffectsMenu(next);
                        }}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-3 py-1.5 text-[12px] normal-case tracking-[0.04em] min-w-[150px]`}
                        title="Open live deck menu"
                    >
                        <i className="fa-solid fa-sliders mr-1"></i>
                        Deck Menu
                        <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showLiveEffectsMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                    {showLiveEffectsMenu && (
                        <div className="absolute right-0 top-full mt-2 w-[min(420px,94vw)] max-h-[70vh] overflow-y-auto custom-scrollbar rounded-2xl border border-cyan-300/30 bg-zinc-900/98 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.55)] z-50">
                            <button
                                data-feature-id="deck-command-palette"
                                onClick={() => {
                                    onOpenCommandPalette?.();
                                    setShowLiveEffectsMenu(false);
                                }}
                                className={`${styles.btnStd} ${styles.btnPrimary} w-full py-2 text-sm normal-case tracking-[0.03em]`}
                            >
                                <i className="fa-solid fa-terminal"></i>
                                Command Palette
                            </button>
                            {missionControlEnabled && (
                                <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-2">
                                    <button
                                        onClick={toggleMissionSection}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <span className="text-xs uppercase tracking-[0.2em] text-zinc-300">Mission Control</span>
                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${missionToneClass}`}>
                                            {missionStatus.replace('_', ' ')}
                                        </span>
                                    </button>
                                    {showMissionMenu && (
                                        <div className="mt-2 space-y-2">
                                            <div className={`rounded-lg border px-2 py-2 ${missionToneClass}`}>
                                                <div className="text-sm font-semibold text-white">{missionRecommendation?.label || 'No recommendation yet'}</div>
                                                <div className="text-xs text-zinc-200/90 mt-1">{missionStatusDetail || missionRecommendation?.reason || 'Room flow is stable.'}</div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button onClick={() => runMissionDeckAction('start_next')} className={`${styles.btnStd} ${styles.btnHighlight} py-2 text-sm normal-case tracking-[0.03em]`}>
                                                    <i className="fa-solid fa-forward-step"></i>
                                                    Start Next
                                                </button>
                                                <button onClick={() => runMissionDeckAction('hype_moment')} className={`${styles.btnStd} ${styles.btnSecondary} py-2 text-sm normal-case tracking-[0.03em]`}>
                                                    <i className="fa-solid fa-bolt"></i>
                                                    Hype Moment
                                                </button>
                                                <button onClick={() => runMissionDeckAction('crowd_check')} className={`${styles.btnStd} ${styles.btnInfo} py-2 text-sm normal-case tracking-[0.03em]`}>
                                                    <i className="fa-solid fa-users"></i>
                                                    Crowd Check
                                                </button>
                                                <button onClick={() => runMissionDeckAction('review_moderation')} className={`${styles.btnStd} ${styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em]`}>
                                                    <i className="fa-solid fa-inbox"></i>
                                                    Moderation
                                                </button>
                                            </div>
                                            {missionRecommendation?.id && (
                                                <button
                                                    onClick={() => runMissionDeckAction(missionRecommendation.id)}
                                                    className={`${styles.btnStd} ${styles.btnPrimary} w-full py-2 text-sm normal-case tracking-[0.03em]`}
                                                >
                                                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                                                    Smart Assist: {missionRecommendation.label}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-zinc-300">
                                TV, Sound FX, and Vibe Sync now have dedicated Live Deck dropdowns for faster access.
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {missionControlEnabled && missionStatus === 'needs_attention' && (
                <div className="mt-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                    {missionStatusDetail || missionRecommendation?.reason || 'Action needed in room flow.'}
                </div>
            )}
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
