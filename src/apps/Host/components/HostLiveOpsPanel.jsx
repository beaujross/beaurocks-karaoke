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

const SnapshotCard = ({
    label,
    title,
    detail,
    meta = '',
    toneClass = 'border-white/10 bg-black/20 text-zinc-100',
    metaToneClass = 'border-white/10 bg-black/20 text-zinc-200',
    compact = false,
}) => (
    <div className={`${compact ? 'rounded-xl px-2.5 py-2.5' : 'rounded-2xl px-3 py-3'} border ${toneClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
            <div className={`min-w-0 flex-1 ${compact ? 'basis-[164px]' : 'basis-[188px]'}`}>
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
                <div className={`mt-1 break-words font-black leading-tight text-white ${compact ? 'text-[13px]' : 'text-sm'}`}>{title}</div>
                <div className="mt-1 break-words text-[11px] leading-snug text-zinc-400">{detail}</div>
            </div>
            {meta ? (
                <span className={`inline-flex w-fit shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${metaToneClass}`}>
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
    onOpenRunOfShow,
    styles,
    showTitle = true,
    compact = false,
}) {
    const hasCurrentPerformance = !!current?.id;
    const currentMoment = runOfShowLiveItem?.id ? runOfShowLiveItem : null;
    const queuedMoment = runOfShowFlightedItem?.id
        ? runOfShowFlightedItem
        : runOfShowOnDeckItem?.id
            ? runOfShowOnDeckItem
            : null;
    const nextSingerLabel = String(nextQueueText || '').trim() || (nextQueueSong ? buildQueueSongLabel(nextQueueSong) : 'No singer ready');
    const plannedMomentCount = Number(!!runOfShowLiveItem?.id) + Number(!!runOfShowFlightedItem?.id) + Number(!!runOfShowOnDeckItem?.id);

    return (
        <section
            data-feature-id="host-live-ops-panel"
            className={compact ? 'px-3 py-2.5' : 'px-4 py-3'}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                {showTitle ? (
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Live Snapshot</div>
                    </div>
                ) : <div className="min-w-0 flex-1" />}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-zinc-200">{queueCount} queued</span>
                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-cyan-100">{readyQueueCount} ready</span>
                    {assignedQueueCount > 0 ? <span className="rounded-full border border-violet-300/25 bg-violet-500/10 px-2 py-1 text-violet-100">{assignedQueueCount} linked</span> : null}
                    {needsAttentionCount > 0 ? <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-amber-100">{needsAttentionCount} issues</span> : null}
                    {compact && typeof onOpenRunOfShow === 'function' ? (
                        <button
                            type="button"
                            onClick={() => onOpenRunOfShow?.()}
                            className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} min-h-[30px] px-2.5 py-1 text-[10px]`}
                        >
                            Planner
                        </button>
                    ) : null}
                </div>
            </div>

            <div className={`grid gap-2 ${compact ? 'mt-2 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]' : 'mt-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]'}`}>
                <SnapshotCard
                    label="On Stage"
                    title={hasCurrentPerformance ? buildQueueSongLabel(current) : 'No one on stage'}
                    detail={hasCurrentPerformance
                        ? (currentSourcePlaying ? 'Backing live' : 'Ready on stage')
                        : currentMoment
                            ? `${getRunOfShowSceneTitle(currentMoment)} live`
                            : 'Room idle'}
                    meta={hasCurrentPerformance ? (currentSourcePlaying ? 'Playing' : 'Ready') : currentMoment ? 'Moment Live' : 'Idle'}
                    toneClass={hasCurrentPerformance
                        ? 'border-emerald-300/22 bg-emerald-500/8'
                        : currentMoment
                            ? 'border-fuchsia-300/20 bg-fuchsia-500/8'
                            : 'border-white/10 bg-black/20'}
                    metaToneClass={hasCurrentPerformance
                        ? (currentSourcePlaying ? 'border-emerald-300/30 bg-emerald-500/12 text-emerald-100' : 'border-amber-300/30 bg-amber-500/12 text-amber-100')
                        : currentMoment
                            ? 'border-fuchsia-300/30 bg-fuchsia-500/12 text-fuchsia-100'
                            : 'border-white/10 bg-black/20 text-zinc-200'}
                    compact={compact}
                />
                <SnapshotCard
                    label="Next Singer"
                    title={nextSingerLabel}
                    detail={nextQueueSong
                        ? 'Queue-first move'
                        : 'No singer ready'}
                    meta={nextQueueSong ? 'Ready' : 'Open'}
                    toneClass={nextQueueSong ? 'border-cyan-300/22 bg-cyan-500/8' : 'border-white/10 bg-black/20'}
                    metaToneClass={nextQueueSong
                        ? 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100'
                        : 'border-white/10 bg-black/20 text-zinc-200'}
                    compact={compact}
                />
                <SnapshotCard
                    label="Planned"
                    title={queuedMoment ? getRunOfShowSceneTitle(queuedMoment) : (runOfShowEnabled ? 'Next planned slot is open' : 'Planner is optional')}
                    detail={queuedMoment
                        ? getRunOfShowSceneSummary(queuedMoment)
                        : runOfShowEnabled
                            ? 'Open slot'
                            : 'Planner off'}
                    meta={queuedMoment ? (runOfShowFlightedItem?.id ? 'Armed' : 'On Deck') : (runOfShowEnabled ? 'Plan' : 'Planner Off')}
                    toneClass={queuedMoment ? 'border-violet-300/22 bg-violet-500/8' : 'border-white/10 bg-black/20'}
                    metaToneClass={queuedMoment
                        ? (runOfShowFlightedItem?.id
                            ? 'border-violet-300/30 bg-violet-500/12 text-violet-100'
                            : 'border-fuchsia-300/30 bg-fuchsia-500/12 text-fuchsia-100')
                        : (runOfShowEnabled
                            ? 'border-amber-300/25 bg-amber-500/10 text-amber-100'
                            : 'border-white/10 bg-black/20 text-zinc-200')}
                    compact={compact}
                />
            </div>

            {!compact ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[11px] text-zinc-400">
                        {runOfShowEnabled
                            ? `${plannedMomentCount} in horizon`
                            : 'Queue-first'}
                    </div>
                    {typeof onOpenRunOfShow === 'function' ? (
                        <button
                            type="button"
                            onClick={() => onOpenRunOfShow?.()}
                            className={`${styles?.btnStd || ''} ${styles?.btnNeutral || ''} min-h-[36px] px-3 py-1.5 text-[11px]`}
                        >
                            Planner
                        </button>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
