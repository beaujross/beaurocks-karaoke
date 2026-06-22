import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { isAudienceSelectedUnverifiedResolution } from '../../../lib/requestModes';
import {
    buildSelfServeModePresentation,
    buildSelfServeTransitionMoment,
} from '../../../lib/selfServeKaraoke';

const StageNowPlayingPanel = ({
    room,
    current,
    lobbyCount,
    queueCount,
    needsAttentionCount = 0,
    readyQueueCount = 0,
    assignedQueueCount = 0,
    waitTimeSec,
    formatWaitTime,
    nextQueueSong,
    nextQueueText = '',
    nextQueueReasonDetail = '',
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
    onRestartPlayback,
    onJumpPlayback,
    onSeekPlayback,
    playAppleMusicTrack,
    stopAppleMusic,
    updateRoom,
    startEdit,
    onRateBacking,
    onResolveAudienceBacking,
    backingDecisionBusyKey = '',
    updateStatus,
    onMeasureApplause,
    onEndPerformance,
    onReturnCurrentToQueue,
    progressStageToNext,
    lastTrackCheckItem = null,
    onTrackCheckAction,
    onOpenBackingWindow = null,
    showStageSummaryHeader = true,
    styles,
    emoji
}) => {
    const currentBackingUrl = String(currentMediaUrl || current?.mediaUrl || '').trim();
    const currentHasYoutubeBacking = /youtu\.?be|youtube\.com/i.test(currentBackingUrl);
    const currentAudienceSelectedUnverified = isAudienceSelectedUnverifiedResolution(current?.resolutionStatus);
    const currentBackingDecisionBusy = currentAudienceSelectedUnverified && String(backingDecisionBusyKey || '').startsWith(`${current?.id}:`);
    const [selfServeNowMs, setSelfServeNowMs] = useState(() => Date.now());
    useEffect(() => {
        if (!room?.selfServeMode?.enabled) return undefined;
        const timer = setInterval(() => setSelfServeNowMs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [room?.selfServeMode?.enabled]);
    const selfServeMode = room?.selfServeMode?.enabled ? room.selfServeMode : null;
    const selfServePresentation = useMemo(
        () => (selfServeMode ? buildSelfServeModePresentation(selfServeMode) : null),
        [selfServeMode]
    );
    const selfServeTransitionMoment = useMemo(
        () => (selfServeMode
            ? buildSelfServeTransitionMoment(selfServeMode, {
                songs: [nextQueueSong, current].filter(Boolean),
                nowMs: selfServeNowMs,
            })
            : null),
        [current, nextQueueSong, selfServeMode, selfServeNowMs]
    );
    const actionButtonBaseClass = 'min-h-[42px] rounded-md border px-2.5 py-2 text-white transition disabled:cursor-not-allowed disabled:opacity-45';
    const playbackButtonClass = `${actionButtonBaseClass} border-white/10 bg-white/[0.045] hover:border-sky-200/35 hover:bg-white/[0.08]`;
    const feedbackChipClass = 'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-45';
    const stageActionHeading = 'Performance Flow';
    const trackCheckHeading = lastTrackCheckItem?.pendingNow ? 'Track Check' : 'Last Track Check';
    const trackCheckSupportCopy = lastTrackCheckItem?.pendingNow
        ? 'Decide now or let it fall into Inbox for later.'
        : 'Review this saved backing note when you have a beat.';
    const openBackingWindow = () => {
        if (typeof onOpenBackingWindow === 'function') {
            onOpenBackingWindow();
            return;
        }
        if (!currentBackingUrl || typeof window === 'undefined') return;
        window.open(currentBackingUrl, '_blank', 'noopener,noreferrer');
    };
    const playbackSession = room?.currentPerformanceSession || {};
    const playbackDurationSec = Math.max(
        0,
        Number(playbackSession?.playerReportedDurationSec || 0),
        Number(room?.currentPerformanceMeta?.durationSec || 0),
        Number(room?.currentPerformanceMeta?.backingDurationSec || 0),
        Number(current?.performanceStartedDurationSec || 0),
        Number(current?.backingDurationSec || 0),
        Number(current?.duration || 0)
    );
    const playbackPositionSec = Math.min(
        playbackDurationSec || Number.MAX_SAFE_INTEGER,
        Math.max(0, Number(playbackSession?.playerPositionSec || 0))
    );
    const [timelineDraftSec, setTimelineDraftSec] = useState(null);
    useEffect(() => {
        setTimelineDraftSec(null);
    }, [current?.id, playbackSession?.sessionId]);
    const timelineValueSec = timelineDraftSec !== null ? timelineDraftSec : playbackPositionSec;
    const timelineEnabled = !currentUsesAppleBacking && playbackDurationSec >= 20 && typeof onSeekPlayback === 'function';
    const formatPlaybackClock = (valueSec = 0) => {
        const total = Math.max(0, Math.round(Number(valueSec || 0) || 0));
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };
    const applyTimelineSeek = () => {
        if (!timelineEnabled) return;
        const next = Math.max(0, Math.min(playbackDurationSec, Number(timelineValueSec || 0)));
        setTimelineDraftSec(null);
        onSeekPlayback(next);
    };
    return (
        <>
        {showStageSummaryHeader ? (
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
                        {needsAttentionCount > 0 ? (
                            <div className="flex items-center gap-1 text-xs font-bold text-amber-100 bg-amber-500/10 border border-amber-300/25 px-2.5 py-1 rounded-full">
                                <i className="fa-solid fa-triangle-exclamation text-amber-200"></i>
                                {needsAttentionCount}
                            </div>
                        ) : null}
                        {readyQueueCount > 0 ? (
                            <div className="flex items-center gap-1 text-xs font-bold text-cyan-100 bg-cyan-500/10 border border-cyan-300/25 px-2.5 py-1 rounded-full">
                                <i className="fa-solid fa-wave-square text-cyan-200"></i>
                                {readyQueueCount}
                            </div>
                        ) : null}
                        {assignedQueueCount > 0 ? (
                            <div className="flex items-center gap-1 text-xs font-bold text-violet-100 bg-violet-500/10 border border-violet-300/25 px-2.5 py-1 rounded-full">
                                <i className="fa-solid fa-link text-violet-200"></i>
                                {assignedQueueCount}
                            </div>
                        ) : null}
                        <div className="flex items-center gap-1 text-xs font-bold text-white/85 bg-black/40 border border-white/10 px-2.5 py-1 rounded-full">
                            <i className="fa-solid fa-clock text-white/70"></i>
                            {formatWaitTime(waitTimeSec)}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {room?.activeMode === 'applause' && (<div className="text-[#00C4D9] animate-pulse font-bold text-xs">{emoji.mic} APPLAUSE!</div>)}
                        {room?.bouncerMode && (<div className="text-red-400 font-bold text-xs">{emoji.lock} LOCKED</div>)}
                        {selfServePresentation ? (
                            <div className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                                selfServePresentation.toneKey === 'amber'
                                    ? 'border-amber-300/30 bg-amber-500/12 text-amber-100'
                                    : 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100'
                            }`}>
                                {selfServePresentation.shortLabel} | {selfServeTransitionMoment?.badgeLabel || selfServePresentation.badgeLabel}
                            </div>
                        ) : null}
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
        ) : null}
        {current ? (
            <div className="space-y-3">
                {current.backingAudioOnly && (
                    <div className="text-[12px] text-orange-400 font-bold mb-2 bg-orange-900/30 p-1 rounded border border-orange-500/30 flex items-center justify-center gap-1">
                        <i className="fa-solid fa-window-restore"></i> EXTERNAL BACKING WINDOW
                    </div>
                )}
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Current Performance</div>
                        <div className="flex flex-wrap items-center gap-2">
                            {(room?.activeMode === 'applause') ? (
                                <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
                                    {emoji.mic} Applause
                                </span>
                            ) : null}
                            {room?.bouncerMode ? (
                                <span className="rounded-full border border-rose-300/25 bg-rose-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-100">
                                    {emoji.lock} Locked
                                </span>
                            ) : null}
                            {selfServePresentation ? (
                                <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                    selfServePresentation.toneKey === 'amber'
                                        ? 'border-amber-300/30 bg-amber-500/12 text-amber-100'
                                        : 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100'
                                }`}>
                                    {selfServePresentation.shortLabel}
                                </span>
                            ) : null}
                        </div>
                    </div>
                    <div className="mt-3 space-y-3">
                        <div className="flex items-start gap-3">
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
                        {(currentHasYoutubeBacking && currentAudienceSelectedUnverified && typeof onResolveAudienceBacking === 'function') ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-2">
                                <span className="text-[10px] uppercase tracking-[0.14em] text-cyan-100">Guest track</span>
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
                            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
                                <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">Track note</span>
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
                                    Skip
                                </button>
                            </div>
                        ) : null}
                        <div data-feature-id="host-unified-stage-transport" className="mt-3 border-t border-white/10 pt-3 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200">Media Playback</div>
                                <div className="min-w-0 text-[11px] text-zinc-300">
                                    <span className="font-semibold text-white">{currentSourceLabel || 'Backing Track'}</span>
                                    <span className="mx-2 text-white/25">|</span>
                                    <span>{currentSourcePlaying ? 'Playing now' : 'Ready to start'}</span>
                                </div>
                            </div>
                            {timelineEnabled ? (
                                <div data-feature-id="host-playback-command-timeline" className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                                        <span>Timeline</span>
                                        <span className="text-zinc-200">{formatPlaybackClock(timelineValueSec)} / {formatPlaybackClock(playbackDurationSec)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onJumpPlayback?.(-10)}
                                            className="h-8 w-9 rounded-md border border-white/10 bg-white/[0.045] text-zinc-100 hover:bg-white/[0.08]"
                                            title="Jump back 10 seconds"
                                        >
                                            <i className="fa-solid fa-backward-step"></i>
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max={Math.max(20, Math.round(playbackDurationSec))}
                                            step="1"
                                            value={Math.round(timelineValueSec)}
                                            onChange={(event) => setTimelineDraftSec(Number(event.target.value || 0))}
                                            className="min-w-0 flex-1 accent-cyan-300"
                                            aria-label="Playback timeline"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => onJumpPlayback?.(10)}
                                            className="h-8 w-9 rounded-md border border-white/10 bg-white/[0.045] text-zinc-100 hover:bg-white/[0.08]"
                                            title="Jump forward 10 seconds"
                                        >
                                            <i className="fa-solid fa-forward-step"></i>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={applyTimelineSeek}
                                            disabled={timelineDraftSec === null}
                                            className="h-8 rounded-md border border-cyan-300/30 bg-cyan-500/12 px-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            Go
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                            <div className="grid grid-cols-3 gap-1.5">
                                <button
                                    onClick={togglePlay}
                                    className={playbackButtonClass}
                                    title={currentSourcePlaying ? 'Pause playback' : 'Start playback'}
                                >
                                    <div className="flex items-center justify-center gap-2 text-center">
                                        <i className={`fa-solid ${currentSourcePlaying ? 'fa-pause text-amber-200' : 'fa-play text-emerald-200'} text-sm`}></i>
                                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-100">
                                            {currentSourcePlaying ? 'Pause' : 'Play'}
                                        </span>
                                    </div>
                                </button>
                                <button
                                    onClick={() => {
                                        if (typeof onRestartPlayback === 'function') {
                                            onRestartPlayback();
                                            return;
                                        }
                                        if (currentUsesAppleBacking) {
                                            playAppleMusicTrack(current.appleMusicId, { title: current.songTitle, artist: current.artist });
                                            updateRoom({ mediaUrl: '', videoPlaying: false, videoStartTimestamp: null, pausedAt: null });
                                            return;
                                        }
                                        stopAppleMusic?.();
                                        updateRoom({ videoPlaying: true, videoStartTimestamp: Date.now(), pausedAt: null, appleMusicPlayback: null });
                                    }}
                                    className={playbackButtonClass}
                                    title="Restart from the beginning"
                                >
                                    <div className="flex items-center justify-center gap-2 text-center">
                                        <i className="fa-solid fa-rotate-left text-sm text-cyan-100"></i>
                                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-100">Restart</span>
                                    </div>
                                </button>
                                <button
                                    onClick={openBackingWindow}
                                    disabled={!currentMediaUrl}
                                    className={`${playbackButtonClass} ${!currentMediaUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title="Open backing in a separate window"
                                >
                                    <div className="flex items-center justify-center gap-2 text-center">
                                        <i className="fa-solid fa-up-right-from-square text-sm text-zinc-100"></i>
                                        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-100">Pop Out</span>
                                    </div>
                                </button>
                            </div>
                            <div className="border-t border-white/10 pt-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200">{stageActionHeading}</div>
                                    <div className="min-w-0 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                                        <span className="text-zinc-400">Up Next:</span>{' '}
                                        <span className="truncate text-zinc-200">{nextQueueText || (nextQueueSong ? `${nextQueueSong.singerName || 'Guest'} - ${nextQueueSong.songTitle || 'Song'}` : 'No one queued')}</span>
                                    </div>
                                </div>
                                {selfServeTransitionMoment?.title ? (
                                    <div className={`text-[11px] leading-snug ${
                                        selfServeTransitionMoment.toneKey === 'amber'
                                            ? 'text-amber-100/88'
                                            : 'text-cyan-100/88'
                                    }`}>
                                        <span className="font-black uppercase tracking-[0.14em]">{selfServeTransitionMoment.title}</span>
                                        <span className="text-white/55"> | </span>
                                        <span>{selfServeTransitionMoment.detail}</span>
                                    </div>
                                ) : null}
                                {nextQueueReasonDetail ? (
                                    <div className={`text-[11px] leading-snug ${
                                        selfServePresentation?.toneKey === 'amber'
                                            ? 'text-amber-100/80'
                                            : 'text-cyan-100/80'
                                    }`}>
                                        {nextQueueReasonDetail}
                                    </div>
                                ) : null}
                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                                    <button
                                        onClick={() => {
                                            if (typeof onEndPerformance === 'function') {
                                                onEndPerformance(current.id);
                                                return;
                                            }
                                            updateStatus(current.id, 'performed');
                                        }}
                                        className={`${actionButtonBaseClass} border-rose-300/35 bg-rose-500/12 hover:border-rose-200/55 hover:bg-rose-500/18`}
                                        title={Number(current?.hostBonus || 0) > 0 ? 'End performance' : 'End performance'}
                                    >
                                        <div className="flex items-center justify-center gap-2 text-center">
                                            <i className="fa-solid fa-flag-checkered text-sm text-rose-100"></i>
                                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-50">End</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (typeof onMeasureApplause === 'function') {
                                                onMeasureApplause();
                                                return;
                                            }
                                            updateRoom({ activeMode: room?.activeMode === 'applause' ? 'karaoke' : 'applause_countdown', applausePeak: 0 });
                                        }}
                                        className={`${actionButtonBaseClass} border-amber-300/35 bg-amber-500/12 hover:border-amber-200/55 hover:bg-amber-500/18`}
                                    >
                                        <div className="flex items-center justify-center gap-2 text-center">
                                            <i className="fa-solid fa-microphone-lines text-sm text-amber-100"></i>
                                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-50">Applause</span>
                                        </div>
                                    </button>
                                    <button
                                        onClick={progressStageToNext}
                                        disabled={!nextQueueSong}
                                        className={`${actionButtonBaseClass} border-cyan-300/35 bg-cyan-500/12 hover:border-cyan-200/55 hover:bg-cyan-500/18 ${!nextQueueSong ? 'opacity-55 cursor-not-allowed' : ''}`}
                                        title="End this performance and stage the next ready song"
                                    >
                                        <div className="flex items-center justify-center gap-2 text-center">
                                            <i className="fa-solid fa-forward-step text-sm text-cyan-100"></i>
                                            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-cyan-50">Next</span>
                                        </div>
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        onClick={() => onReturnCurrentToQueue?.(current.id)}
                                        className={`${styles.btnStd} ${styles.btnNeutral} flex-1 px-2 py-1.5 text-[11px]`}
                                    >
                                        <i className="fa-solid fa-rotate-left mr-2"></i>Stop & Re-Queue
                                    </button>
                                    <button onClick={() => startEdit(current)} className={`${styles.btnStd} ${styles.btnSecondary} flex-1 px-2 py-1.5 text-[11px]`}>
                                        <i className="fa-solid fa-pen-to-square mr-2"></i>Edit Current Song
                                    </button>
                                </div>
                            </div>
                        </div>
                {currentUsesAppleBacking && appleMusicStatus ? (
                    <div className="mt-1 text-sm text-zinc-400">{appleMusicStatus}</div>
                ) : null}
            </div>
            </div>
            </div>
        ) : (
            <div className="space-y-3">
                <div className="text-center py-4 text-zinc-500">Stage Empty</div>
                {(lastTrackCheckItem && typeof onTrackCheckAction === 'function') ? (
                    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{trackCheckHeading}</div>
                                <div className="mt-1 text-sm font-bold text-white truncate">{lastTrackCheckItem.songTitle || 'Recent performance'}</div>
                                <div className="text-xs text-zinc-400 truncate">{lastTrackCheckItem.artist || 'YouTube track'}</div>
                                <div className="mt-1 text-[11px] text-zinc-500">{trackCheckSupportCopy}</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => onTrackCheckAction(lastTrackCheckItem, 'prefer')}
                                    className={`${feedbackChipClass} border-emerald-300/35 bg-emerald-500/12 text-emerald-100`}
                                >
                                    <i className="fa-solid fa-thumbs-up"></i>
                                    Use Again
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onTrackCheckAction(lastTrackCheckItem, 'avoid')}
                                    className={`${feedbackChipClass} border-rose-300/35 bg-rose-500/12 text-rose-100`}
                                >
                                    <i className="fa-solid fa-thumbs-down"></i>
                                    Bad Track
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onTrackCheckAction(lastTrackCheckItem, 'inbox')}
                                    className={`${feedbackChipClass} border-cyan-300/35 bg-cyan-500/12 text-cyan-100`}
                                >
                                    <i className="fa-solid fa-inbox"></i>
                                    Inbox
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onTrackCheckAction(lastTrackCheckItem, 'skip')}
                                    className={`${feedbackChipClass} border-white/10 bg-black/20 text-zinc-200`}
                                >
                                    <i className="fa-solid fa-forward"></i>
                                    Skip
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        )}
    </>
    );
};

export default StageNowPlayingPanel;
