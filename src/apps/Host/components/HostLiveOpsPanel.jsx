import React from 'react';
import { getRunOfShowItemLabel } from '../../../lib/runOfShowDirector';

const buildQueueSongLabel = (song = {}) => {
    const singerName = String(song?.singerName || '').trim();
    const songTitle = String(song?.songTitle || '').trim();
    if (singerName && songTitle) return `${singerName} - ${songTitle}`;
    return singerName || songTitle || 'Singer slot still open';
};

const getRunOfShowSceneTitle = (item = {}) => (
    String(item?.title || '').trim() || getRunOfShowItemLabel(item?.type || 'scene')
);

const getRunOfShowSceneSummary = (item = {}) => {
    const type = String(item?.type || '').trim().toLowerCase();
    if (type === 'performance') {
        return buildQueueSongLabel({
            singerName: item?.assignedPerformerName || '',
            songTitle: item?.songTitle || '',
        });
    }
    if (type === 'announcement' || type === 'intro' || type === 'closing') {
        return String(item?.presentationPlan?.headline || item?.notes || '').trim() || 'Presentation scene';
    }
    if (type === 'trivia_break' || type === 'would_you_rather_break' || type === 'game_break') {
        return String(item?.modeLaunchPlan?.prompt || item?.modeLaunchPlan?.modeKey || item?.notes || '').trim() || 'Audience moment';
    }
    return String(item?.notes || '').trim() || 'Show scene';
};

const cardBaseClass = 'rounded-2xl border px-3 py-3';
const actionButtonClass = 'inline-flex min-h-[38px] items-center justify-center rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition';

const getCoHostSignalToneClass = (tone = 'zinc') => {
    if (tone === 'amber') return 'border-amber-300/25 bg-amber-500/10 text-amber-100';
    if (tone === 'sky') return 'border-sky-300/25 bg-sky-500/10 text-sky-100';
    if (tone === 'emerald') return 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100';
    if (tone === 'rose') return 'border-rose-300/25 bg-rose-500/10 text-rose-100';
    if (tone === 'violet') return 'border-violet-300/25 bg-violet-500/10 text-violet-100';
    return 'border-white/10 bg-black/20 text-zinc-200';
};

const LaneCard = ({ label, title, detail, toneClass = '', meta = '', metaToneClass = '' }) => (
    <div className={`${cardBaseClass} ${toneClass || 'border-white/10 bg-black/25'}`}>
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
                <div className="mt-1 truncate text-sm font-semibold text-white">{title}</div>
                <div className="mt-1 text-xs text-zinc-400">{detail}</div>
            </div>
            {meta ? (
                <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${metaToneClass || 'border-white/10 bg-black/20 text-zinc-200'}`}>
                    {meta}
                </span>
            ) : null}
        </div>
    </div>
);

export default function HostLiveOpsPanel({
    current = null,
    nextQueueSong = null,
    nextQueueText = '',
    queueCount = 0,
    readyQueueCount = 0,
    assignedQueueCount = 0,
    needsAttentionCount = 0,
    currentSourcePlaying = false,
    runOfShowEnabled = false,
    runOfShowLiveItem = null,
    runOfShowFlightedItem = null,
    runOfShowOnDeckItem = null,
    crowdPulse = null,
    coHostSignals = [],
    onTogglePlay,
    onEndPerformance,
    onReturnCurrentToQueue,
    onEditCurrent,
    onProgressStageToNext,
    onOpenRunOfShow,
    styles,
}) {
    const hasCurrentPerformance = !!current?.id;
    const hasLiveScene = !!runOfShowLiveItem?.id;
    const flightedScene = runOfShowFlightedItem?.id ? runOfShowFlightedItem : null;
    const onDeckScene = runOfShowOnDeckItem?.id ? runOfShowOnDeckItem : null;
    const crowdPulseMetrics = crowdPulse?.metrics || {};

    const nowCard = hasCurrentPerformance
        ? {
            label: 'Now',
            title: buildQueueSongLabel(current),
            detail: currentSourcePlaying ? 'Backing is live on stage.' : 'Performance is staged and ready to roll.',
            toneClass: 'border-emerald-300/22 bg-emerald-500/8',
            meta: currentSourcePlaying ? 'Playing' : 'Paused',
            metaToneClass: currentSourcePlaying
                ? 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100'
                : 'border-amber-300/30 bg-amber-500/12 text-amber-100'
        }
        : hasLiveScene
            ? {
                label: 'Now',
                title: getRunOfShowSceneTitle(runOfShowLiveItem),
                detail: getRunOfShowSceneSummary(runOfShowLiveItem),
                toneClass: 'border-fuchsia-300/20 bg-fuchsia-500/8',
                meta: 'Live Scene',
                metaToneClass: 'border-fuchsia-300/30 bg-fuchsia-500/12 text-fuchsia-100'
            }
            : {
                label: 'Now',
                title: 'Room idle',
                detail: 'No performance or show scene currently owns the room.',
                toneClass: 'border-white/10 bg-black/25',
                meta: 'Waiting'
            };

    const nextSingerLabel = String(nextQueueText || '').trim() || (nextQueueSong ? buildQueueSongLabel(nextQueueSong) : 'No singer ready');
    const nextCard = {
        label: 'Next Singer',
        title: nextSingerLabel,
        detail: nextQueueSong
            ? 'This is the next queue-first performance if you keep the room moving.'
            : 'Queue is empty or still waiting on approvals.',
        toneClass: nextQueueSong ? 'border-cyan-300/22 bg-cyan-500/8' : 'border-white/10 bg-black/25',
        meta: nextQueueSong ? 'Ready' : 'Open',
        metaToneClass: nextQueueSong
            ? 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100'
            : 'border-white/10 bg-black/20 text-zinc-200'
    };

    const conveyorTarget = flightedScene || onDeckScene || null;
    const conveyorCard = {
        label: 'Conveyor',
        title: conveyorTarget ? getRunOfShowSceneTitle(conveyorTarget) : (runOfShowEnabled ? 'No scene armed' : 'Run of Show is off'),
        detail: conveyorTarget
            ? getRunOfShowSceneSummary(conveyorTarget)
            : runOfShowEnabled
                ? 'Prep the next scene or open the conveyor to slot one in.'
                : 'Queue is currently the only live lane.',
        toneClass: conveyorTarget ? 'border-violet-300/22 bg-violet-500/8' : 'border-white/10 bg-black/25',
        meta: flightedScene ? 'Flighted' : onDeckScene ? 'On Deck' : (runOfShowEnabled ? 'Waiting' : 'Off'),
        metaToneClass: flightedScene
            ? 'border-violet-300/30 bg-violet-500/12 text-violet-100'
            : onDeckScene
                ? 'border-fuchsia-300/30 bg-fuchsia-500/12 text-fuchsia-100'
                : 'border-white/10 bg-black/20 text-zinc-200'
    };

    const recommendationTitle = String(crowdPulse?.recommendationTitle || '').trim() || 'Host is steering the room';
    const recommendationDetail = String(crowdPulse?.recommendationDetail || '').trim()
        || (nextQueueSong
            ? 'Queue has a ready singer. Keep the room moving unless you need a deliberate reset.'
            : 'Queue is thin. Prep a quick reset or open the conveyor for a short scene.');

    return (
        <section
            data-feature-id="host-live-ops-panel"
            className="border-b border-white/10 px-4 py-4"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Live Lane</div>
                    <div className="mt-1 text-sm text-zinc-300">Run the room from one lane: now, next singer, and the next conveyor scene.</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-zinc-200">{queueCount} queued</span>
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-cyan-100">{readyQueueCount} ready</span>
                    {assignedQueueCount > 0 ? <span className="rounded-full border border-violet-300/25 bg-violet-500/10 px-2 py-1 text-violet-100">{assignedQueueCount} tied to show</span> : null}
                    {needsAttentionCount > 0 ? <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-amber-100">{needsAttentionCount} needs attention</span> : null}
                </div>
            </div>

            <div className="mt-3 grid gap-2 lg:grid-cols-3">
                <LaneCard {...nowCard} />
                <LaneCard {...nextCard} />
                <LaneCard {...conveyorCard} />
            </div>

            <div className={`mt-3 rounded-2xl border px-3 py-3 ${crowdPulse?.panelClass || 'border-white/10 bg-black/20'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Crowd Pulse</div>
                            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${crowdPulse?.chipClass || 'border-white/10 bg-black/20 text-zinc-200'}`}>
                                {crowdPulse?.label || 'No signal'}
                            </span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">{recommendationTitle}</div>
                        <div className="mt-1 text-xs text-zinc-300">{recommendationDetail}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{Number(crowdPulseMetrics.livePhonePct || 0)}% live</span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{Number(crowdPulseMetrics.engagedAudiencePct || 0)}% engaged</span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{Number(crowdPulseMetrics.recentAudienceActionCount || 0)} actions</span>
                    </div>
                </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Tell Host</div>
                        <div className="mt-1 text-sm font-semibold text-white">Context-rich audio notes from trusted co-hosts</div>
                        <div className="mt-1 text-xs text-zinc-400">Each note stays tied to the performance it came from, so the host gets one clean read without another inbox.</div>
                    </div>
                    {coHostSignals.length ? (
                        <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-100">
                            {coHostSignals.length} active
                        </span>
                    ) : null}
                </div>
                {coHostSignals.length ? (
                    <div className="mt-3 grid gap-2 lg:grid-cols-2">
                        {coHostSignals.slice(0, 4).map((signal) => (
                            <div key={signal.id} className={`rounded-2xl border px-3 py-3 ${getCoHostSignalToneClass(signal.tone)}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex flex-1 items-start gap-3">
                                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                            {signal.artworkUrl ? (
                                                <img src={signal.artworkUrl} alt={signal.contextTitle || signal.label} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
                                                    <i className={`fa-solid ${signal.icon || 'fa-bullhorn'}`}></i>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <i className={`fa-solid ${signal.icon || 'fa-bullhorn'} text-[12px]`}></i>
                                                <div className="truncate text-sm font-semibold text-white">{signal.hostLabel || signal.label}</div>
                                            </div>
                                            <div className="mt-1 truncate text-xs font-black uppercase tracking-[0.12em] text-white/90">
                                                {signal.contextTitle || 'General room note'}
                                            </div>
                                            <div className="mt-1 text-xs text-zinc-200">{signal.summary}</div>
                                            <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-zinc-300">{signal.contextMeta || signal.latestAgeLabel || 'recently'}</div>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white">
                                        {signal.uniqueCount || signal.count || 1}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-xs text-zinc-400">
                        No recent co-host audio notes.
                    </div>
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {hasCurrentPerformance ? (
                    <>
                        <button
                            type="button"
                            onClick={() => onTogglePlay?.()}
                            className={`${actionButtonClass} border-cyan-300/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/55 hover:bg-cyan-500/18`}
                        >
                            {currentSourcePlaying ? 'Pause Current' : 'Play Current'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onEndPerformance?.(current.id)}
                            className={`${actionButtonClass} border-rose-300/30 bg-rose-500/10 text-rose-100 hover:border-rose-200/55 hover:bg-rose-500/18`}
                        >
                            End Current
                        </button>
                        <button
                            type="button"
                            onClick={() => onEditCurrent?.(current)}
                            className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} min-h-[38px] px-3 py-2 text-[11px]`}
                        >
                            Edit Current
                        </button>
                        <button
                            type="button"
                            onClick={() => onReturnCurrentToQueue?.(current.id)}
                            className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} min-h-[38px] px-3 py-2 text-[11px]`}
                        >
                            Re-Queue Current
                        </button>
                    </>
                ) : nextQueueSong ? (
                    <button
                        type="button"
                        onClick={() => onProgressStageToNext?.()}
                        className={`${actionButtonClass} border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-200/55 hover:bg-emerald-500/18`}
                    >
                        Start Next Singer
                    </button>
                ) : null}

                {nextQueueSong && hasCurrentPerformance ? (
                    <button
                        type="button"
                        onClick={() => onProgressStageToNext?.()}
                        className={`${styles?.btnStd || ''} ${styles?.btnHighlight || ''} min-h-[38px] px-3 py-2 text-[11px]`}
                    >
                        Roll To Next Singer
                    </button>
                ) : null}

                {runOfShowEnabled ? (
                    <button
                        type="button"
                        onClick={() => onOpenRunOfShow?.()}
                        className={`${styles?.btnStd || ''} ${styles?.btnSecondary || ''} min-h-[38px] px-3 py-2 text-[11px]`}
                    >
                        Open Conveyor
                    </button>
                ) : null}
            </div>
        </section>
    );
}
