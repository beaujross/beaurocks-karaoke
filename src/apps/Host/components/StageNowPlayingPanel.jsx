import React from 'react';
import { isAudienceSelectedUnverifiedResolution } from '../../../lib/requestModes';

const StageNowPlayingPanel = ({
    room,
    current,
    lastPerformance,
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
    autoDj,
    autoDjSequenceSummary,
    autoDjStepItems = [],
    togglePlay,
    playAppleMusicTrack,
    stopAppleMusic,
    updateRoom,
    startEdit,
    customBonus,
    setCustomBonus,
    addBonusToCurrent,
    onRateBacking,
    onResolveAudienceBacking,
    backingDecisionBusyKey = '',
    updateStatus,
    onMeasureApplause,
    onEndPerformance,
    onReturnCurrentToQueue,
    progressStageToNext,
    runOfShowEnabled = false,
    runOfShowAutomationPaused = false,
    onOpenRunOfShow,
    onToggleRunOfShowPause,
    onStopRunOfShow,
    styles,
    emoji
}) => {
    const [showStageDetails, setShowStageDetails] = React.useState(false);
    const currentBackingUrl = String(currentMediaUrl || current?.mediaUrl || '').trim();
    const lastBackingUrl = String(lastPerformance?.mediaUrl || '').trim();
    const currentHasYoutubeBacking = /youtu\.?be|youtube\.com/i.test(currentBackingUrl);
    const lastHasYoutubeBacking = /youtu\.?be|youtube\.com/i.test(lastBackingUrl);
    const currentAudienceSelectedUnverified = isAudienceSelectedUnverifiedResolution(current?.resolutionStatus);
    const currentBackingDecisionBusy = currentAudienceSelectedUnverified && String(backingDecisionBusyKey || '').startsWith(`${current?.id}:`);
    const transportButtonClass = 'min-h-[72px] rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-white transition hover:border-cyan-300/35 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-45';
    const feedbackChipClass = 'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45';
    const applauseWarmupSec = Math.max(0, Math.min(8, Math.round(Number(room?.applauseWarmupSec ?? 5) || 5)));
    const applauseCountdownSec = Math.max(1, Math.min(8, Math.round(Number(room?.applauseCountdownSec ?? 5) || 5)));
    const applauseMeasureSec = Math.max(2, Math.min(10, Math.round(Number(room?.applauseMeasureSec ?? 5) || 5)));
    const recapBreakdownMs = Math.max(3000, Math.min(12000, Math.round(Number(room?.performanceRecapBreakdownMs ?? 7000) || 7000)));
    const recapLeaderboardMs = Math.max(3000, Math.min(12000, Math.round(Number(room?.performanceRecapLeaderboardMs ?? 7000) || 7000)));

    const postPerformanceTimingCard = (
        <div className="mt-3 bg-black/30 border border-white/10 rounded-lg p-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-400">Post-Performance Timing</div>
                    <div className="mt-1 text-[11px] text-zinc-500">Applause, recap, and leaderboard timing for Public TV.</div>
                </div>
                <button
                    onClick={() => updateRoom({ showPerformanceRecap: room?.showPerformanceRecap === false })}
                    className={`${styles.btnStd} ${room?.showPerformanceRecap === false ? styles.btnNeutral : styles.btnHighlight} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em] whitespace-nowrap`}
                    title="Toggle the post-performance recap sequence on Public TV"
                >
                    {room?.showPerformanceRecap === false ? 'Recap Off' : 'Recap On'}
                </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                    Warm-up
                    <select
                        value={applauseWarmupSec}
                        onChange={(event) => updateRoom({ applauseWarmupSec: Number(event.target.value) })}
                        className={`${styles.input} mt-1`}
                    >
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                            <option key={`applause-warmup-${value}`} value={value}>{value}s</option>
                        ))}
                    </select>
                </label>
                <label className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                    Meter countdown
                    <select
                        value={applauseCountdownSec}
                        onChange={(event) => updateRoom({ applauseCountdownSec: Number(event.target.value) })}
                        className={`${styles.input} mt-1`}
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                            <option key={`applause-countdown-${value}`} value={value}>{value}s</option>
                        ))}
                    </select>
                </label>
                <label className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                    Meter live
                    <select
                        value={applauseMeasureSec}
                        onChange={(event) => updateRoom({ applauseMeasureSec: Number(event.target.value) })}
                        className={`${styles.input} mt-1`}
                    >
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                            <option key={`applause-measure-${value}`} value={value}>{value}s</option>
                        ))}
                    </select>
                </label>
                <label className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
                    Recap beat
                    <select
                        value={recapBreakdownMs}
                        onChange={(event) => updateRoom({ performanceRecapBreakdownMs: Number(event.target.value) })}
                        className={`${styles.input} mt-1`}
                    >
                        {[3000, 4000, 5000, 7000, 9000, 12000].map((value) => (
                            <option key={`recap-breakdown-${value}`} value={value}>{Math.round(value / 1000)}s</option>
                        ))}
                    </select>
                </label>
                <label className="text-[11px] uppercase tracking-[0.16em] text-zinc-400 sm:col-span-2">
                    Leaderboard beat
                    <select
                        value={recapLeaderboardMs}
                        onChange={(event) => updateRoom({ performanceRecapLeaderboardMs: Number(event.target.value) })}
                        className={`${styles.input} mt-1`}
                    >
                        {[3000, 4000, 5000, 7000, 9000, 12000].map((value) => (
                            <option key={`recap-leaderboard-${value}`} value={value}>{Math.round(value / 1000)}s</option>
                        ))}
                    </select>
                </label>
            </div>
        </div>
    );

    const runOfShowQuickControls = runOfShowEnabled ? (
        <div className="mt-3 bg-black/30 border border-white/10 rounded-lg p-3">
            <div className="text-sm uppercase tracking-[0.3em] text-zinc-400">Run Of Show</div>
            <div className="mt-1 text-[11px] text-zinc-500">Live show controls without leaving the stage view.</div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                    onClick={() => onOpenRunOfShow?.()}
                    className={`${styles.btnStd} ${styles.btnNeutral}`}
                >
                    <i className="fa-solid fa-table-cells-large mr-2"></i>Open Show
                </button>
                <button
                    onClick={() => onToggleRunOfShowPause?.(!runOfShowAutomationPaused)}
                    className={`${styles.btnStd} ${runOfShowAutomationPaused ? styles.btnHighlight : styles.btnSecondary}`}
                >
                    <i className={`fa-solid ${runOfShowAutomationPaused ? 'fa-play' : 'fa-pause'} mr-2`}></i>
                    {runOfShowAutomationPaused ? 'Resume Show' : 'Pause Show'}
                </button>
                <button
                    onClick={() => onStopRunOfShow?.()}
                    className={`${styles.btnStd} ${styles.btnDanger}`}
                >
                    <i className="fa-solid fa-stop mr-2"></i>Stop Show
                </button>
            </div>
        </div>
    ) : null;

    return (
        <>
        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 mb-3">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-200">Live Stage</div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border ${current ? 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100' : 'border-zinc-600 bg-zinc-900/70 text-zinc-300'}`}>
                    {current ? 'Live' : 'Idle'}
                </span>
            </div>
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
            {autoDj && (
                <div className="mt-3 rounded-lg border border-cyan-400/25 bg-black/35 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className={`text-[10px] uppercase tracking-[0.18em] ${autoDjSequenceSummary?.tone === 'danger' ? 'text-rose-200' : autoDjSequenceSummary?.tone === 'warning' ? 'text-amber-200' : autoDjSequenceSummary?.tone === 'success' ? 'text-emerald-200' : 'text-cyan-200'}`}>
                            {autoDjSequenceSummary?.title || 'Auto DJ'}
                        </div>
                        <div className="text-[10px] text-zinc-300 truncate max-w-[50%]">{autoDjSequenceSummary?.detail || 'Queue runner active'}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1">
                        {autoDjStepItems.map((step) => (
                            <div
                                key={step.id}
                                className={`rounded px-1.5 py-1 text-[9px] uppercase tracking-[0.12em] text-center border ${
                                    step.status === 'complete'
                                        ? 'border-emerald-300/35 bg-emerald-500/15 text-emerald-100'
                                        : step.status === 'active'
                                            ? 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100'
                                            : step.status === 'retrying'
                                                ? 'border-amber-300/45 bg-amber-500/15 text-amber-100'
                                                : step.status === 'error'
                                                    ? 'border-rose-300/45 bg-rose-500/15 text-rose-100'
                                                    : 'border-white/15 bg-black/25 text-zinc-300'
                                }`}
                                title={step.retries > 0 ? `${step.label} retries: ${step.retries}` : step.label}
                            >
                                {step.short}
                            </div>
                        ))}
                    </div>
                </div>
            )}
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
                <div className="bg-black/30 border border-white/10 rounded-lg p-3 mb-3">
                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">Transport</div>
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={togglePlay}
                            className={transportButtonClass}
                            title={currentSourcePlaying ? 'Pause playback' : 'Start playback'}
                        >
                            <div className="flex flex-col items-center justify-center gap-2 text-center">
                                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full border ${currentSourcePlaying ? 'border-amber-300/35 bg-amber-500/12 text-amber-100' : 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'}`}>
                                    <i className={`fa-solid ${currentSourcePlaying ? 'fa-pause' : 'fa-play'} text-lg`}></i>
                                </span>
                                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-100">
                                    {currentSourcePlaying ? 'Pause' : 'Play'}
                                </span>
                            </div>
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
                            className={transportButtonClass}
                            title="Restart from the beginning"
                        >
                            <div className="flex flex-col items-center justify-center gap-2 text-center">
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-500/12 text-cyan-100">
                                    <i className="fa-solid fa-rotate-left text-lg"></i>
                                </span>
                                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-100">Restart</span>
                            </div>
                        </button>
                        <button
                            onClick={() => window.open(current.mediaUrl, '_blank')}
                            disabled={!currentMediaUrl}
                            className={`${transportButtonClass} ${!currentMediaUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Open backing in a separate window"
                        >
                            <div className="flex flex-col items-center justify-center gap-2 text-center">
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-zinc-100">
                                    <i className="fa-solid fa-up-right-from-square text-lg"></i>
                                </span>
                                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-100">Pop Out</span>
                            </div>
                        </button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(currentHasYoutubeBacking && currentAudienceSelectedUnverified && typeof onResolveAudienceBacking === 'function') ? (
                            <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2">
                                <span className="text-[10px] uppercase tracking-[0.18em] text-cyan-100">Guest-picked track</span>
                                <button
                                    type="button"
                                    disabled={currentBackingDecisionBusy}
                                    onClick={() => onResolveAudienceBacking(current, 'approve')}
                                    className={`${feedbackChipClass} border-emerald-300/35 bg-emerald-500/12 text-emerald-100`}
                                    title="Mark this track as a good fit for this song"
                                >
                                    <i className="fa-solid fa-thumbs-up"></i>
                                    Works
                                </button>
                                <button
                                    type="button"
                                    disabled={currentBackingDecisionBusy}
                                    onClick={() => onResolveAudienceBacking(current, 'avoid')}
                                    className={`${feedbackChipClass} border-rose-300/35 bg-rose-500/12 text-rose-100`}
                                    title="Mark this track as a bad fit so it sinks in future picks"
                                >
                                    <i className="fa-solid fa-thumbs-down"></i>
                                    Bad Track
                                </button>
                            </div>
                        ) : (currentHasYoutubeBacking && typeof onRateBacking === 'function') ? (
                            <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 sm:col-span-2">
                                <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Save a note</span>
                                <button
                                    type="button"
                                    onClick={() => onRateBacking(current, 'up')}
                                    className={`${feedbackChipClass} border-emerald-300/35 bg-emerald-500/12 text-emerald-100`}
                                    title="Mark this as a backing you would use again"
                                >
                                    <i className="fa-solid fa-thumbs-up"></i>
                                    Use Again
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onRateBacking(current, 'down')}
                                    className={`${feedbackChipClass} border-rose-300/35 bg-rose-500/12 text-rose-100`}
                                    title="Mark this as a backing you would avoid next time"
                                >
                                    <i className="fa-solid fa-thumbs-down"></i>
                                    Skip Next Time
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="bg-black/30 border border-white/10 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="text-sm uppercase tracking-[0.3em] text-zinc-400">Performance Controls</div>
                        <button
                            type="button"
                            onClick={() => setShowStageDetails((prev) => !prev)}
                            className={`${styles.btnStd} ${styles.btnNeutral} px-3 py-1.5 text-[11px] normal-case tracking-[0.04em]`}
                        >
                            {showStageDetails ? 'Less Controls' : 'More Controls'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                if (typeof onEndPerformance === 'function') {
                                    onEndPerformance(current.id);
                                    return;
                                }
                                updateStatus(current.id, 'performed');
                            }}
                            className={`${styles.btnStd} ${styles.btnSecondary}`}
                            title={Number(current?.hostBonus || 0) > 0 ? 'End performance' : 'End performance'}
                        >
                            <i className="fa-solid fa-flag-checkered mr-2"></i>End
                        </button>
                        <button
                            onClick={progressStageToNext}
                            disabled={!nextQueueSong}
                            className={`${styles.btnStd} ${styles.btnHighlight} ${!nextQueueSong ? 'opacity-55 cursor-not-allowed' : ''}`}
                        >
                            <i className="fa-solid fa-forward-step mr-2"></i>Next
                        </button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                            onClick={() => onReturnCurrentToQueue?.(current.id)}
                            className={`${styles.btnStd} ${styles.btnNeutral}`}
                        >
                            <i className="fa-solid fa-rotate-left mr-2"></i>Stop & Re-Queue
                        </button>
                        <button onClick={() => startEdit(current)} className={`${styles.btnStd} ${styles.btnSecondary}`}>
                            <i className="fa-solid fa-pen-to-square mr-2"></i>Edit Current Song
                        </button>
                    </div>
                    {room?.applausePeak !== undefined && room?.applausePeak !== null && (
                        <div className="mt-3 text-xs text-zinc-300 bg-zinc-900/60 border border-zinc-700 rounded-lg px-3 py-2 flex items-center justify-between">
                            <span className="uppercase tracking-widest text-zinc-400">Last Applause</span>
                            <span className="text-[#00C4D9] font-bold">{Math.round(room.applausePeak)} dB</span>
                        </div>
                    )}
                    {showStageDetails ? (
                        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <button
                                    onClick={() => updateRoom({ audienceVideoMode: room?.audienceVideoMode === 'force' ? 'off' : 'force' })}
                                    className={`${styles.btnStd} ${room?.audienceVideoMode === 'force' ? styles.btnHighlight : styles.btnSecondary} ${currentUsesAppleBacking ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    title="Push the stage video to phones"
                                    disabled={currentUsesAppleBacking}
                                >
                                    <i className="fa-solid fa-tv mr-2"></i>Audience sync
                                </button>
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
                                    <i className="fa-solid fa-microphone-lines mr-2"></i>Applause
                                </button>
                                <div className="flex gap-2 sm:col-span-2">
                                    <input type="number" value={customBonus} onChange={e => setCustomBonus(e.target.value)} className={`${styles.input} w-20`} placeholder="Pts"/>
                                    <button onClick={() => addBonusToCurrent(parseInt(customBonus, 10) || 0)} className={`${styles.btnStd} ${styles.btnSecondary} flex-1`}>
                                        <i className="fa-solid fa-gift mr-2"></i>Bonus
                                    </button>
                                </div>
                            </div>
                            <div className="bg-black/30 border border-white/10 rounded-lg p-2">
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
                            {current?.lyrics ? (
                                <div className="bg-black/30 border border-white/10 rounded-lg p-2">
                                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">Lyrics View</div>
                                    <div className="flex gap-2">
                                        <button onClick={() => updateRoom({ lyricsMode: 'auto' })} className={`${styles.btnStd} ${room?.lyricsMode !== 'full' ? styles.btnHighlight : styles.btnNeutral} flex-1`}>Auto scroll</button>
                                        <button onClick={() => updateRoom({ lyricsMode: 'full' })} className={`${styles.btnStd} ${room?.lyricsMode === 'full' ? styles.btnHighlight : styles.btnNeutral} flex-1`}>Full view</button>
                                    </div>
                                </div>
                            ) : null}
                            <div className="bg-black/30 border border-white/10 rounded-lg p-2">
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
                        </div>
                    ) : null}
                </div>
                {currentUsesAppleBacking && appleMusicStatus ? (
                    <div className="mt-1 mb-3 text-sm text-zinc-400">{appleMusicStatus}</div>
                ) : null}
                {runOfShowQuickControls}
                {postPerformanceTimingCard}
            </div>
        ) : (
            <div className="space-y-3">
                <div className="text-center py-4 text-zinc-500">Stage Empty</div>
                {(lastHasYoutubeBacking && typeof onRateBacking === 'function') ? (
                    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Last Track Check</div>
                                <div className="mt-1 text-sm font-bold text-white truncate">{lastPerformance?.songTitle || 'Recent performance'}</div>
                                <div className="text-xs text-zinc-400 truncate">{lastPerformance?.artist || 'YouTube track'}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => onRateBacking(lastPerformance, 'up')}
                                    className={`${feedbackChipClass} border-emerald-300/35 bg-emerald-500/12 text-emerald-100`}
                                >
                                    <i className="fa-solid fa-thumbs-up"></i>
                                    Use Again
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onRateBacking(lastPerformance, 'down')}
                                    className={`${feedbackChipClass} border-rose-300/35 bg-rose-500/12 text-rose-100`}
                                >
                                    <i className="fa-solid fa-thumbs-down"></i>
                                    Bad Track
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
                {runOfShowQuickControls}
                {postPerformanceTimingCard}
            </div>
        )}
    </>
    );
};

export default StageNowPlayingPanel;
