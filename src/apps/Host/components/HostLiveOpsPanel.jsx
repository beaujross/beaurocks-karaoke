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

const getSongArtworkUrl = (entry = {}) => String(
    entry?.albumArtUrl
    || entry?.artworkUrl100
    || entry?.artworkUrl
    || entry?.art
    || entry?.thumbnail
    || entry?.imageUrl
    || entry?.backingPlan?.artworkUrl
    || entry?.backingPlan?.artworkUrl100
    || entry?.presentationPlan?.imageUrl
    || ''
).trim();

const getScenePlaceholderMeta = (item = {}) => {
    const type = String(item?.type || '').trim().toLowerCase();
    if (type === 'performance') return { icon: 'fa-microphone-lines', label: 'Song', toneClass: 'from-emerald-500/40 to-cyan-500/30' };
    if (type === 'announcement' || type === 'intro' || type === 'closing') return { icon: 'fa-bullhorn', label: 'Info', toneClass: 'from-fuchsia-500/38 to-violet-500/28' };
    if (type === 'intermission' || type === 'buffer') return { icon: 'fa-mug-hot', label: 'Break', toneClass: 'from-amber-500/38 to-orange-500/28' };
    if (type === 'trivia_break' || type === 'would_you_rather_break' || type === 'game_break') return { icon: 'fa-gamepad', label: 'Play', toneClass: 'from-sky-500/38 to-cyan-500/28' };
    return { icon: 'fa-shapes', label: 'Scene', toneClass: 'from-zinc-500/30 to-slate-500/24' };
};

const cardBaseClass = 'rounded-2xl border px-3 py-2.5';
const actionButtonClass = 'inline-flex min-h-[38px] items-center justify-center rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition';

const LaneCard = ({
    label,
    title,
    detail,
    toneClass = '',
    meta = '',
    metaToneClass = '',
    artworkUrl = '',
    placeholderIcon = 'fa-microphone-lines',
    placeholderLabel = 'Live',
    placeholderToneClass = 'from-zinc-500/30 to-slate-500/24',
}) => (
    <div className={`${cardBaseClass} ${toneClass || 'border-white/10 bg-black/25'}`}>
        <div className="flex items-start gap-2.5">
            <div className="min-w-0 flex flex-1 items-start gap-2.5">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/20 sm:h-10 sm:w-10 sm:rounded-2xl">
                    {artworkUrl ? (
                        <img src={artworkUrl} alt={title} className="h-full w-full object-cover" />
                    ) : (
                        <div className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${placeholderToneClass} text-white/88`}>
                            <i className={`fa-solid ${placeholderIcon} text-[10px] sm:text-[11px]`}></i>
                            <span className="mt-0.5 text-[8px] font-black uppercase tracking-[0.14em]">{placeholderLabel}</span>
                        </div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
                        {meta ? (
                            <span className={`inline-flex shrink-0 self-start rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${metaToneClass || 'border-white/10 bg-black/20 text-zinc-200'}`}>
                                {meta}
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-1 break-words text-[12px] font-semibold leading-tight text-white sm:text-[13px]">{title}</div>
                    <div className="mt-1 break-words text-[10px] leading-snug text-zinc-400 sm:text-[11px]">{detail}</div>
                </div>
            </div>
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

    const nowCard = hasCurrentPerformance
        ? {
            label: 'Now',
            title: buildQueueSongLabel(current),
            detail: currentSourcePlaying ? 'Backing is live on stage.' : 'Performance is staged and ready to roll.',
            toneClass: 'border-emerald-300/22 bg-emerald-500/8',
            meta: currentSourcePlaying ? 'Playing' : 'Paused',
            artworkUrl: getSongArtworkUrl(current),
            placeholderIcon: 'fa-microphone-lines',
            placeholderLabel: 'Now',
            placeholderToneClass: 'from-emerald-500/42 to-cyan-500/32',
            metaToneClass: currentSourcePlaying
                ? 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100'
                : 'border-amber-300/30 bg-amber-500/12 text-amber-100'
        }
        : hasLiveScene
            ? (() => {
                const placeholder = getScenePlaceholderMeta(runOfShowLiveItem);
                return {
                    label: 'Now',
                    title: getRunOfShowSceneTitle(runOfShowLiveItem),
                    detail: getRunOfShowSceneSummary(runOfShowLiveItem),
                    toneClass: 'border-fuchsia-300/20 bg-fuchsia-500/8',
                    meta: 'Live Scene',
                    artworkUrl: getSongArtworkUrl(runOfShowLiveItem),
                    placeholderIcon: placeholder.icon,
                    placeholderLabel: placeholder.label,
                    placeholderToneClass: placeholder.toneClass,
                    metaToneClass: 'border-fuchsia-300/30 bg-fuchsia-500/12 text-fuchsia-100'
                };
            })()
            : {
                label: 'Now',
                title: 'Room idle',
                detail: 'No performance or show scene currently owns the room.',
                toneClass: 'border-white/10 bg-black/25',
                meta: 'Waiting',
                placeholderIcon: 'fa-moon',
                placeholderLabel: 'Idle',
                placeholderToneClass: 'from-zinc-500/30 to-slate-500/24'
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
        artworkUrl: getSongArtworkUrl(nextQueueSong),
        placeholderIcon: 'fa-user-music',
        placeholderLabel: 'Next',
        placeholderToneClass: 'from-cyan-500/40 to-sky-500/28',
        metaToneClass: nextQueueSong
            ? 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100'
            : 'border-white/10 bg-black/20 text-zinc-200'
    };

    const conveyorTarget = flightedScene || onDeckScene || null;
    const conveyorPlaceholder = getScenePlaceholderMeta(conveyorTarget || {});
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
        artworkUrl: getSongArtworkUrl(conveyorTarget),
        placeholderIcon: conveyorPlaceholder.icon,
        placeholderLabel: conveyorTarget ? conveyorPlaceholder.label : 'Show',
        placeholderToneClass: conveyorTarget ? conveyorPlaceholder.toneClass : 'from-zinc-500/30 to-slate-500/24',
        metaToneClass: flightedScene
            ? 'border-violet-300/30 bg-violet-500/12 text-violet-100'
            : onDeckScene
                ? 'border-fuchsia-300/30 bg-fuchsia-500/12 text-fuchsia-100'
                : 'border-white/10 bg-black/20 text-zinc-200'
    };

    return (
        <section
            data-feature-id="host-live-ops-panel"
            className="border-b border-white/10 px-4 py-3"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Live Lane</div>
                    <div className="mt-1 text-xs text-zinc-300">Now, next singer, and the next conveyor scene in one lane.</div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-zinc-200">{queueCount} queued</span>
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-cyan-100">{readyQueueCount} ready</span>
                    {assignedQueueCount > 0 ? <span className="rounded-full border border-violet-300/25 bg-violet-500/10 px-2 py-1 text-violet-100">{assignedQueueCount} tied to show</span> : null}
                    {needsAttentionCount > 0 ? <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-amber-100">{needsAttentionCount} needs attention</span> : null}
                </div>
            </div>

            <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                <LaneCard {...nowCard} />
                <LaneCard {...nextCard} />
                <LaneCard {...conveyorCard} />
            </div>
            <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(132px,1fr))]">
                {hasCurrentPerformance ? (
                    <>
                        <button
                            type="button"
                            onClick={() => onTogglePlay?.()}
                            className={`${actionButtonClass} w-full border-cyan-300/30 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/55 hover:bg-cyan-500/18`}
                        >
                            {currentSourcePlaying ? 'Pause Current' : 'Play Current'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onEndPerformance?.(current.id)}
                            className={`${actionButtonClass} w-full border-rose-300/30 bg-rose-500/10 text-rose-100 hover:border-rose-200/55 hover:bg-rose-500/18`}
                        >
                            End Current
                        </button>
                        <button
                            type="button"
                            onClick={() => onEditCurrent?.(current)}
                            className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} min-h-[38px] w-full px-3 py-2 text-[11px]`}
                        >
                            Edit Current
                        </button>
                        <button
                            type="button"
                            onClick={() => onReturnCurrentToQueue?.(current.id)}
                            className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} min-h-[38px] w-full px-3 py-2 text-[11px]`}
                        >
                            Re-Queue Current
                        </button>
                    </>
                ) : nextQueueSong ? (
                    <button
                        type="button"
                        onClick={() => onProgressStageToNext?.()}
                        className={`${actionButtonClass} w-full border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-200/55 hover:bg-emerald-500/18`}
                    >
                        Start Next Singer
                    </button>
                ) : null}

                {nextQueueSong && hasCurrentPerformance ? (
                    <button
                        type="button"
                        onClick={() => onProgressStageToNext?.()}
                        className={`${styles?.btnStd || ''} ${styles?.btnHighlight || ''} min-h-[38px] w-full px-3 py-2 text-[11px]`}
                    >
                        Roll To Next Singer
                    </button>
                ) : null}

                {runOfShowEnabled ? (
                    <button
                        type="button"
                        onClick={() => onOpenRunOfShow?.()}
                        className={`${styles?.btnStd || ''} ${styles?.btnSecondary || ''} min-h-[38px] w-full px-3 py-2 text-[11px]`}
                    >
                        Open Conveyor
                    </button>
                ) : null}
            </div>
        </section>
    );
}
