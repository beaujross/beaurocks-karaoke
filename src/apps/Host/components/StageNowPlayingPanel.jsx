import React from 'react';

const StageNowPlayingPanel = ({
    room,
    current,
    hasLyrics,
    lobbyCount,
    queueCount,
    waitTimeSec,
    formatWaitTime,
    nextQueueSong,
    roomCode,
    currentSourcePlaying,
    currentUsesAppleBacking,
    currentMediaUrl,
    currentSourceLabel,
    currentSourceToneClass,
    appleMusicStatus,
    togglePlay,
    playAppleMusicTrack,
    stopAppleMusic,
    updateRoom,
    startEdit,
    customBonus,
    setCustomBonus,
    addBonusToCurrent,
    updateStatus,
    onMeasureApplause,
    onEndPerformance,
    styles,
    emoji
}) => (
    <>
        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 mb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    {!!roomCode && (
                        <div className="flex items-center gap-2 bg-black/40 border border-cyan-400/35 px-2 py-1 rounded-full">
                            <span className="text-[10px] uppercase tracking-[0.25em] text-cyan-200">Room</span>
                            <span className="text-sm font-bebas text-cyan-200 tracking-[0.24em]">{roomCode}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1 text-xs font-bold text-white/85 bg-black/40 border border-white/10 px-2.5 py-1 rounded-full">
                        <i className="fa-solid fa-users text-white/70"></i>
                        {lobbyCount}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-white/85 bg-black/40 border border-white/10 px-2.5 py-1 rounded-full">
                        <i className="fa-solid fa-list text-white/70"></i>
                        {queueCount}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-white/85 bg-black/40 border border-white/10 px-2.5 py-1 rounded-full">
                        <i className="fa-solid fa-clock text-white/70"></i>
                        {formatWaitTime(waitTimeSec)}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {room?.activeMode === 'applause' && (<div className="text-[#00C4D9] animate-pulse font-bold text-xs">{emoji.mic} APPLAUSE!</div>)}
                    {room?.bouncerMode && (<div className="text-red-400 font-bold text-xs">{emoji.lock} LOCKED</div>)}
                </div>
            </div>
        </div>
        {current ? (
            <div className="relative">
                {current.backingAudioOnly && (
                    <div className="text-[12px] text-orange-400 font-bold mb-2 bg-orange-900/30 p-1 rounded border border-orange-500/30 flex items-center justify-center gap-1">
                        <i className="fa-solid fa-window-restore"></i> BACKING AUDIO (Opens in popup)
                    </div>
                )}
                <div className="flex items-start gap-3 mb-3">
                    <div className="min-w-0 flex-1 text-left">
                        <div className="text-[11px] text-indigo-300 uppercase tracking-widest font-bold">Now Performing</div>
                        <div className="font-bold text-xl leading-none truncate text-white">{current.singerName || 'Singer'}</div>
                        <div className="text-sm text-indigo-200 italic truncate">{current.songTitle || 'Song'}</div>
                        {(current?.mediaUrl || current?.appleMusicId) && (
                            <div className="mt-1 inline-flex items-center gap-2 text-[11px] uppercase tracking-widest bg-black/40 border border-white/10 rounded-full px-3 py-1 text-zinc-200">
                                <span className={currentSourceToneClass}>{currentSourceLabel}</span>
                                <span className="text-white/70">|</span>
                                <span className="text-white/90 truncate max-w-[150px]">{current?.songTitle}</span>
                                <span className="text-white/50">({currentSourcePlaying ? 'Playing' : 'Paused'})</span>
                            </div>
                        )}
                    </div>
                    {current.albumArtUrl ? (
                        <img src={current.albumArtUrl} alt="Now playing art" className="w-14 h-14 rounded-lg shadow-md object-cover flex-shrink-0 border border-white/10" />
                    ) : (
                        <div className="w-14 h-14 rounded-lg bg-indigo-700/50 border border-white/10 flex items-center justify-center text-3xl shadow-md flex-shrink-0">
                            {current.emoji || emoji.mic}
                        </div>
                    )}
                </div>
                <div className="text-[11px] text-zinc-300 mb-3 truncate">
                    Up Next: <span className="text-white font-semibold">{nextQueueSong ? `${nextQueueSong.singerName || 'Guest'} - ${nextQueueSong.songTitle || 'Song'}` : 'No one queued'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <button onClick={togglePlay} className={`${styles.btnStd} ${currentSourcePlaying ? styles.btnNeutral : styles.btnPrimary}`}>
                        <i className={`fa-solid ${currentSourcePlaying ? 'fa-pause' : 'fa-play'} mr-2`}></i>
                        {currentSourcePlaying ? 'Pause' : 'Play'}
                    </button>
                    <button
                        onClick={async () => {
                            if (currentUsesAppleBacking) {
                                await playAppleMusicTrack(current.appleMusicId, { title: current.songTitle, artist: current.artist });
                                await updateRoom({ mediaUrl: '', videoPlaying: false, videoStartTimestamp: null, pausedAt: null });
                                return;
                            }
                            await stopAppleMusic?.();
                            await updateRoom({ videoPlaying: true, videoStartTimestamp: Date.now(), pausedAt: null, appleMusicPlayback: null });
                        }}
                        className={`${styles.btnStd} ${styles.btnSecondary}`}
                    >
                        <i className="fa-solid fa-rotate-left mr-2"></i>Restart
                    </button>
                    <button
                        onClick={() => window.open(current.mediaUrl, '_blank')}
                        disabled={!currentMediaUrl}
                        className={`${styles.btnStd} ${styles.btnSecondary} ${!currentMediaUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <i className="fa-solid fa-up-right-from-square mr-2"></i>Pop out
                    </button>
                    <button
                        onClick={() => updateRoom({ audienceVideoMode: room?.audienceVideoMode === 'force' ? 'off' : 'force' })}
                        className={`${styles.btnStd} ${room?.audienceVideoMode === 'force' ? styles.btnHighlight : styles.btnSecondary} ${currentUsesAppleBacking ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title="Push the stage video to phones"
                        disabled={currentUsesAppleBacking}
                    >
                        <i className="fa-solid fa-tv mr-2"></i>Audience sync
                    </button>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-2 mb-3">
                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">TV Display Mode</div>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => updateRoom({ showLyricsTv: false, showVisualizerTv: false })}
                            className={`${styles.btnStd} ${!room?.showLyricsTv && !room?.showVisualizerTv ? styles.btnHighlight : styles.btnNeutral}`}
                        >
                            <i className="fa-solid fa-video mr-2"></i>Video
                        </button>
                        <button
                            onClick={() => hasLyrics && updateRoom({
                                showLyricsTv: !room?.showLyricsTv,
                                lyricsMode: room?.lyricsMode || 'auto'
                            })}
                            disabled={!hasLyrics}
                            className={`${styles.btnStd} ${room?.showLyricsTv ? styles.btnHighlight : styles.btnNeutral} ${!hasLyrics ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={hasLyrics ? 'Toggle lyrics on TV' : 'No lyrics available for this song'}
                        >
                            <i className="fa-solid fa-closed-captioning mr-2"></i>Lyrics
                        </button>
                        <button
                            onClick={() => updateRoom({ showVisualizerTv: !room?.showVisualizerTv })}
                            className={`${styles.btnStd} ${room?.showVisualizerTv ? styles.btnHighlight : styles.btnNeutral}`}
                            title="Toggle visualizer on TV"
                        >
                            <i className="fa-solid fa-wave-square mr-2"></i>Visualizer
                        </button>
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-2 uppercase tracking-[0.2em]">Tip: Lyrics and visualizer can be enabled together.</div>
                    {!hasLyrics && (
                        <div className="text-[10px] text-zinc-500 mt-2 uppercase tracking-[0.2em]">Lyrics unavailable for this track</div>
                    )}
                </div>
                {current?.lyrics && (
                    <div className="bg-black/30 border border-white/10 rounded-lg p-2 mb-3">
                        <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">Lyrics View</div>
                        <div className="flex gap-2">
                            <button onClick={() => updateRoom({ lyricsMode: 'auto' })} className={`${styles.btnStd} ${room?.lyricsMode !== 'full' ? styles.btnHighlight : styles.btnNeutral} flex-1`}>Auto scroll</button>
                            <button onClick={() => updateRoom({ lyricsMode: 'full' })} className={`${styles.btnStd} ${room?.lyricsMode === 'full' ? styles.btnHighlight : styles.btnNeutral} flex-1`}>Full view</button>
                        </div>
                    </div>
                )}
                <div className="bg-black/30 border border-white/10 rounded-lg p-2 mb-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-sm uppercase tracking-[0.3em] text-zinc-400">Auto Lyrics</div>
                            <div className="text-[11px] text-zinc-500 mt-1">Generate lyrics when a queued song has none.</div>
                        </div>
                        <button
                            onClick={() => updateRoom({ autoLyricsOnQueue: !room?.autoLyricsOnQueue })}
                            className={`${styles.btnStd} ${room?.autoLyricsOnQueue ? styles.btnHighlight : styles.btnNeutral} whitespace-nowrap`}
                            title="Toggle auto lyric generation for queue adds"
                        >
                            {room?.autoLyricsOnQueue ? 'On' : 'Off'}
                        </button>
                    </div>
                </div>
                {currentUsesAppleBacking && appleMusicStatus ? (
                    <div className="mt-1 mb-3 text-sm text-zinc-400">{appleMusicStatus}</div>
                ) : null}
                <button onClick={() => startEdit(current)} className={`${styles.btnStd} ${styles.btnNeutral} w-full mt-3`}>
                    <i className="fa-solid fa-pen-to-square mr-2"></i>Edit current song
                </button>
                {room?.applausePeak !== undefined && room?.applausePeak !== null && (
                    <div className="mt-3 text-xs text-zinc-300 bg-zinc-900/60 border border-zinc-700 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="uppercase tracking-widest text-zinc-400">Last Applause</span>
                        <span className="text-[#00C4D9] font-bold">{Math.round(room.applausePeak)} dB</span>
                    </div>
                )}
                <div className="mt-3 pt-3 border-t border-white/10 flex gap-2 items-center">
                    <input type="number" value={customBonus} onChange={e => setCustomBonus(e.target.value)} className={`${styles.input} w-20`} placeholder="Pts"/>
                    <button onClick={() => addBonusToCurrent(parseInt(customBonus, 10) || 0)} className={`${styles.btnStd} ${styles.btnSecondary} w-1/2`}>
                        <i className="fa-solid fa-gift mr-2"></i>Bonus
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                        onClick={() => {
                            if (typeof onMeasureApplause === 'function') {
                                onMeasureApplause();
                                return;
                            }
                            updateRoom({ activeMode: room?.activeMode === 'applause' ? 'karaoke' : 'applause_countdown', applausePeak: 0 });
                        }}
                        className={`${styles.btnStd} ${styles.btnPrimary}`}
                    >
                        <i className="fa-solid fa-microphone-lines mr-2"></i>Measure applause
                    </button>
                    <button
                        onClick={() => {
                            if (typeof onEndPerformance === 'function') {
                                onEndPerformance(current.id);
                                return;
                            }
                            updateStatus(current.id, 'performed');
                        }}
                        className={`${styles.btnStd} ${styles.btnSecondary}`}
                        title={Number(current?.hostBonus || 0) > 0 ? 'End performance' : 'No host bonus added yet'}
                    >
                        <i className="fa-solid fa-flag-checkered mr-2"></i>{Number(current?.hostBonus || 0) > 0 ? 'End performance' : 'End (bonus?)'}
                    </button>
                </div>
            </div>
        ) : (
            <div className="text-center py-4 text-zinc-500">Stage Empty</div>
        )}
    </>
);

export default StageNowPlayingPanel;
