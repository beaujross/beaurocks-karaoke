import React from 'react';

const StageNowPlayingPanel = ({
    room,
    current,
    hasLyrics,
    lobbyCount,
    queueCount,
    waitTimeSec,
    formatWaitTime,
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
    styles,
    emoji
}) => (
    <>
        <div className="flex justify-end items-center mb-2">
            <div className="flex items-center gap-2">
                {room?.activeMode === 'applause' && (<div className="text-[#00C4D9] animate-pulse font-bold">{emoji.mic} APPLAUSE!</div>)}
                {room?.bouncerMode && (<div className="text-red-400 font-bold">{emoji.lock} LOCKED</div>)}
            </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            <div className="bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500">
                    <i className="fa-solid fa-users text-cyan-300"></i> Lobby
                </div>
                <div className="text-lg font-bold text-white">{lobbyCount}</div>
            </div>
            <div className="bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500">
                    <i className="fa-solid fa-list-ol text-emerald-300"></i> Queue
                </div>
                <div className="text-lg font-bold text-white">{queueCount}</div>
            </div>
            <div className="bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500">
                    <i className="fa-solid fa-clock text-amber-300"></i> Est. Wait
                </div>
                <div className="text-lg font-bold text-white">{formatWaitTime(waitTimeSec)}</div>
            </div>
        </div>
        {current ? (
            <div className="text-center relative">
                {current.backingAudioOnly && (
                    <div className="text-[12px] text-orange-400 font-bold mb-2 bg-orange-900/30 p-1 rounded border border-orange-500/30 flex items-center justify-center gap-1">
                        <i className="fa-solid fa-window-restore"></i> BACKING AUDIO (Opens in popup)
                    </div>
                )}
                <div className="text-xl font-bold">{current.songTitle}</div>
                <div className="text-fuchsia-400 mb-3">{current.singerName}</div>
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
                            onClick={() => hasLyrics && updateRoom({ showLyricsTv: true, showVisualizerTv: false, lyricsMode: room?.lyricsMode || 'auto' })}
                            disabled={!hasLyrics}
                            className={`${styles.btnStd} ${room?.showLyricsTv ? styles.btnHighlight : styles.btnNeutral} ${!hasLyrics ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={hasLyrics ? 'Show lyrics on TV' : 'No lyrics available for this song'}
                        >
                            <i className="fa-solid fa-closed-captioning mr-2"></i>Lyrics
                        </button>
                        <button
                            onClick={() => updateRoom({ showLyricsTv: false, showVisualizerTv: true })}
                            className={`${styles.btnStd} ${room?.showVisualizerTv ? styles.btnHighlight : styles.btnNeutral}`}
                        >
                            <i className="fa-solid fa-wave-square mr-2"></i>Visualizer
                        </button>
                    </div>
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
                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">TV Visualizer Style</div>
                    <select
                        value={room?.visualizerMode || 'ribbon'}
                        onChange={(e) => updateRoom({ visualizerMode: e.target.value })}
                        className={`${styles.input} w-full`}
                    >
                        <option value="ribbon">Liquid ribbon</option>
                        <option value="rings">Neon rings</option>
                        <option value="spark">Pulse sparkline</option>
                        <option value="waveform">Waveform</option>
                    </select>
                </div>
                {(current?.mediaUrl || current?.appleMusicId) && (
                    <div className="bg-black/30 border border-white/10 rounded-lg p-2 mb-3">
                        <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">Now Playing</div>
                        <div className="text-xs text-zinc-100 uppercase tracking-widest">
                            <span className={currentSourceToneClass}>
                                {currentSourceLabel}
                            </span>
                            <span className="text-zinc-400 mx-2">-</span>
                            <span className="text-white/90">{current?.songTitle}</span>
                            <span className="text-zinc-400 ml-2">({currentSourcePlaying ? 'Playing' : 'Paused'})</span>
                        </div>
                    </div>
                )}
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
                <div className="grid grid-cols-1 gap-2 mt-3">
                    <button onClick={() => updateRoom({ activeMode: room?.activeMode === 'applause' ? 'karaoke' : 'applause_countdown', applausePeak: 0 })} className={`${styles.btnStd} ${styles.btnPrimary}`}>
                        <i className="fa-solid fa-microphone-lines mr-2"></i>Measure applause
                    </button>
                    <button onClick={() => updateStatus(current.id, 'performed')} className={`${styles.btnStd} ${styles.btnSecondary}`}>
                        <i className="fa-solid fa-flag-checkered mr-2"></i>End performance
                    </button>
                </div>
            </div>
        ) : (
            <div className="text-center py-4 text-zinc-500">Stage Empty</div>
        )}
    </>
);

export default StageNowPlayingPanel;
