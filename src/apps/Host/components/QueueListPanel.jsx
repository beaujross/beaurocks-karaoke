import React from 'react';
import { deleteDoc, doc, db } from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import {
    buildSelfServeModePresentation,
    buildSelfServeTransitionMoment,
    SELF_SERVE_FORMATS,
} from '../../../lib/selfServeKaraoke';
import QueueSongCard from './QueueSongCard';

const QueueSectionHeader = ({ label, count, toneClass, detail = '' }) => (
    <div className={`mb-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 ${toneClass}`}>
        <div className="flex min-h-[28px] items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em]">{label}</span>
            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                {count}
            </span>
        </div>
        {detail ? <div className="mt-1 text-[11px] leading-4 text-zinc-400">{detail}</div> : null}
    </div>
);

export const QueueSummaryBar = ({
    showQueueSummaryBar = true,
    onToggleQueueSummaryBar,
    reviewRequiredCount = 0,
    pending = [],
    queue = [],
    assigned = [],
    held = [],
    queueSurfaceCounts = null,
    runOfShowOpenSlots = [],
    onFillRunOfShowOpenSlotsFromQueue,
    onAddQuickRunOfShowMoment,
    protectedReadyQueueCount = 0,
    protectedReadyQueueTarget = 0,
    lineupHasCurrentPerformer = false,
    styles,
    compactViewport = false,
    embedded = false,
}) => {
    const counts = queueSurfaceCounts || {};
    const needsAttentionCount = Number.isFinite(Number(counts.needsAttention))
        ? Number(counts.needsAttention)
        : (Number(reviewRequiredCount || 0) + Number(pending.length || 0));
    const readyCount = Number.isFinite(Number(counts.ready)) ? Number(counts.ready) : queue.length;
    const assignedCount = Number.isFinite(Number(counts.assigned)) ? Number(counts.assigned) : assigned.length;
    const heldCount = Number.isFinite(Number(counts.held)) ? Number(counts.held) : held.length;
    const safeProtectedReadyQueueCount = Math.max(0, Math.min(queue.length, Number(protectedReadyQueueCount || 0)));
    const safeProtectedReadyQueueTarget = Math.max(safeProtectedReadyQueueCount, Number(protectedReadyQueueTarget || 0));
    const lockedLineupCount = Number(lineupHasCurrentPerformer ? 1 : 0) + safeProtectedReadyQueueCount;
    const lockedLineupTarget = Number(lineupHasCurrentPerformer ? 1 : 0) + safeProtectedReadyQueueTarget;
    const laterReadyQueueCount = Math.max(0, readyCount - safeProtectedReadyQueueCount);
    const queueSummaryChips = [
        needsAttentionCount
            ? {
                key: 'needsAttention',
                className: 'rounded-full border border-orange-300/30 bg-orange-500/10 px-2 py-1 text-orange-100',
                label: `Needs Attention ${needsAttentionCount}`
            }
            : null,
        reviewRequiredCount
            ? {
                key: 'reviewRequired',
                className: 'rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-amber-100',
                label: `Track Check ${reviewRequiredCount}`
            }
            : null,
        pending.length
            ? {
                key: 'pending',
                className: 'rounded-full border border-orange-300/30 bg-orange-500/10 px-2 py-1 text-orange-100',
                label: `Pending ${pending.length}`
            }
            : null,
        {
            key: 'ready',
            className: 'rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100',
            label: `Ready ${readyCount}`
        },
        assignedCount
            ? {
                key: 'assigned',
                className: 'rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-violet-100',
                label: `Assigned ${assignedCount}`
            }
            : null,
        heldCount
            ? {
                key: 'held',
                className: 'rounded-full border border-zinc-300/25 bg-zinc-500/10 px-2 py-1 text-zinc-200',
                label: `Held ${heldCount}`
            }
            : null,
        runOfShowOpenSlots.length
            ? {
                key: 'openSlots',
                className: 'rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100',
                label: `Open Slots ${runOfShowOpenSlots.length}`
            }
            : null
    ].filter(Boolean);
    const showQueueSummaryChips = (queueSummaryChips.length > 1 || queueSummaryChips.some((chip) => chip.key !== 'ready')) && !embedded;

    const queueSummary = lockedLineupCount < lockedLineupTarget
        ? {
            eyebrow: 'Lock the lineup',
            title: `${lockedLineupCount}/${lockedLineupTarget} live spots protected`,
            detail: lineupHasCurrentPerformer
                ? 'Keep the current singer, next singer, and one more ready performer protected before doing anything else.'
                : 'Lock the next three performers first so the host can stop reshuffling and run the room.',
            toneClass: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
            accentClass: 'text-amber-100'
        }
        : needsAttentionCount > 0
            ? {
                eyebrow: 'Queue needs attention',
                title: `${needsAttentionCount} request${needsAttentionCount === 1 ? '' : 's'} waiting on host action`,
                detail: reviewRequiredCount > 0 && pending.length > 0
                    ? `${reviewRequiredCount} track pick${reviewRequiredCount === 1 ? '' : 's'} and ${pending.length} approval${pending.length === 1 ? '' : 's'} are holding the room.`
                    : reviewRequiredCount > 0
                        ? `${reviewRequiredCount} request${reviewRequiredCount === 1 ? '' : 's'} still need a host track pick.`
                    : 'Clear these first so the live lane reflects what can actually go on stage.',
                toneClass: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
                accentClass: 'text-amber-100'
            }
            : readyCount === 0 && assignedCount === 0 && heldCount === 0
                ? {
                    eyebrow: 'Queue status',
                    title: 'Queue is empty',
                    detail: 'Add songs or approve requests to keep the room moving.',
                    toneClass: 'border-white/10 bg-black/25 text-zinc-300',
                    accentClass: 'text-zinc-100'
                }
                : runOfShowOpenSlots.length > 0 && readyCount > 0
                    ? {
                        eyebrow: 'Run of show ready',
                        title: `${runOfShowOpenSlots.length} open slot${runOfShowOpenSlots.length === 1 ? '' : 's'} can pull from queue`,
                        detail: runOfShowOpenSlots.length === 1
                            ? 'One tap can drop the next ready song straight into the open performance slot.'
                            : 'Use Fill Next Slot or Fill All Suggested to absorb queued singers into open performance slots.',
                        toneClass: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
                        accentClass: 'text-cyan-100'
                    }
                    : readyCount > 0
                        ? {
                            eyebrow: 'Lineup protected',
                            title: `${lockedLineupCount}/${lockedLineupTarget} live spots locked`,
                            detail: laterReadyQueueCount > 0
                                ? `${laterReadyQueueCount} more ready performance${laterReadyQueueCount === 1 ? '' : 's'} are waiting behind the protected lineup.`
                                : 'Stage can advance without touching review or slot assignment.',
                            toneClass: 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100',
                            accentClass: 'text-emerald-100'
                        }
                        : {
                            eyebrow: heldCount > 0 ? 'Singers held' : 'Run of show linked',
                            title: heldCount > 0
                                ? `${heldCount} singer${heldCount === 1 ? '' : 's'} temporarily held`
                                : `${assignedCount} song${assignedCount === 1 ? '' : 's'} already assigned`,
                            detail: heldCount > 0
                                ? 'Held singers stay recoverable but will not be picked by Start Next or Auto-DJ.'
                                : 'These songs are tied to show slots and will move through the run-of-show lane.',
                            toneClass: heldCount > 0 ? 'border-zinc-300/20 bg-zinc-500/10 text-zinc-200' : 'border-violet-300/25 bg-violet-500/10 text-violet-100',
                            accentClass: heldCount > 0 ? 'text-zinc-100' : 'text-violet-100'
                        };

    const canFillRunOfShowFromQueue = runOfShowOpenSlots.length > 0 && readyCount > 0 && typeof onFillRunOfShowOpenSlotsFromQueue === 'function';
    const compactEmbedded = embedded;
    const showExpandedSummaryDetail = !compactEmbedded;
    const showExpandedRunOfShowActions = !compactEmbedded && canFillRunOfShowFromQueue;
    const showExpandedQuickMoments = !compactEmbedded && typeof onAddQuickRunOfShowMoment === 'function';

    return showQueueSummaryBar ? (
        <div className={`${embedded ? '' : 'mb-3 '}rounded-2xl border px-3 shadow-[0_10px_26px_rgba(0,0,0,0.18)] ${queueSummary.toneClass} ${compactEmbedded ? 'py-2' : compactViewport ? 'py-2.5' : 'py-3'}`}>
            <div className={`flex justify-between gap-3 ${compactEmbedded ? 'items-center' : 'items-start'}`}>
                <div className="min-w-0 flex-1">
                    <div className={`text-[10px] uppercase tracking-[0.22em] ${queueSummary.accentClass}`}>{queueSummary.eyebrow}</div>
                    <div className="mt-1 text-sm font-semibold text-white">{queueSummary.title}</div>
                    {showExpandedSummaryDetail ? (
                        <div className="mt-1 text-xs text-zinc-300">{queueSummary.detail}</div>
                    ) : null}
                </div>
                {typeof onToggleQueueSummaryBar === 'function' ? (
                    <button
                        type="button"
                        onClick={onToggleQueueSummaryBar}
                        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-cyan-300/35 hover:text-white ${compactEmbedded ? 'min-h-[30px] px-2.5' : 'min-h-[34px] px-3'}`}
                    >
                        Hide Bar
                    </button>
                ) : null}
            </div>
            {showQueueSummaryChips ? (
                <div className={`flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] ${compactEmbedded ? 'mt-1.5' : 'mt-2'}`}>
                    {queueSummaryChips.map((chip) => (
                        <span key={chip.key} className={chip.className}>{chip.label}</span>
                    ))}
                </div>
            ) : null}
            {showExpandedRunOfShowActions ? (
                <div className="mt-3 flex flex-wrap items-center gap-2" data-feature-id="queue-open-slot-actions">
                    <button
                        type="button"
                        onClick={() => onFillRunOfShowOpenSlotsFromQueue?.({ limit: 1 })}
                        className={`${styles.btnStd} ${styles.btnPrimary} min-h-[38px] px-3 text-[11px]`}
                    >
                        Fill Next Slot
                    </button>
                    {Math.min(runOfShowOpenSlots.length, readyCount) > 1 ? (
                        <button
                            type="button"
                            onClick={() => onFillRunOfShowOpenSlotsFromQueue?.()}
                            className={`${styles.btnStd} ${styles.btnNeutral} min-h-[38px] px-3 text-[11px]`}
                        >
                            Fill All Suggested
                        </button>
                    ) : null}
                </div>
            ) : null}
            {showExpandedQuickMoments ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onAddQuickRunOfShowMoment?.('trivia_break', { placement: 'next' })}
                        className={`${styles.btnStd} ${styles.btnNeutral} min-h-[38px] px-3 text-[11px]`}
                    >
                        Trivia Next
                    </button>
                    <button
                        type="button"
                        onClick={() => onAddQuickRunOfShowMoment?.('winner_declaration', { placement: 'next' })}
                        className={`${styles.btnStd} ${styles.btnNeutral} min-h-[38px] px-3 text-[11px]`}
                    >
                        Winner Next
                    </button>
                    <button
                        type="button"
                        onClick={() => onAddQuickRunOfShowMoment?.('would_you_rather', { placement: 'next' })}
                        className={`${styles.btnStd} ${styles.btnNeutral} min-h-[38px] px-3 text-[11px]`}
                    >
                        Vote Next
                    </button>
                </div>
            ) : null}
        </div>
    ) : (
        typeof onToggleQueueSummaryBar === 'function' ? (
            <div className={`${embedded ? '' : 'mb-3 '}flex ${embedded ? '' : 'justify-end'}`}>
                <button
                    type="button"
                    onClick={onToggleQueueSummaryBar}
                    className="inline-flex min-h-[34px] items-center justify-center rounded-full border border-white/10 bg-black/20 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-cyan-300/35 hover:text-white"
                >
                    Show Queue Bar
                </button>
            </div>
        ) : null
    );
};

const QueueListPanel = ({
    showQueueList,
    showQueueSummaryBar = true,
    onToggleQueueSummaryBar,
    reviewRequiredCount = 0,
    pending,
    queue,
    assigned = [],
    held = [],
    reviewRequired = [],
    onApprovePending,
    onDeletePending,
    onMoveNext,
    onHoldSinger,
    onRestoreSinger,
    dragQueueId,
    dragOverId,
    setDragQueueId,
    setDragOverId,
    reorderQueue,
    touchReorderAvailable = false,
    touchReorderEnabled,
    touchReorderMode = false,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    updateStatus,
    startEdit,
    onRetryLyrics,
    onFetchTimedLyrics,
    onApproveAudienceBacking,
    onAvoidAudienceBacking,
    backingDecisionBusyKey = '',
    statusPill,
    styles,
    compactViewport = false,
    runOfShowAssignableSlots = [],
    runOfShowOpenSlots = [],
    queueSurfaceCounts = null,
    onAssignQueueSongToRunOfShowItem,
    onAssignQueueSongToNextOpenRunOfShowSlot,
    onFillRunOfShowOpenSlotsFromQueue,
    onAddQuickRunOfShowMoment,
    renderSummaryBarInline = true,
    protectedReadyQueueCount = 0,
    protectedReadyQueueTarget = 0,
    lineupHasCurrentPerformer = false,
    selfServeMode = null,
    selfServeAuctionLeaderboard = [],
    nextQueueReasonLabel = '',
    nextQueueReasonDetail = '',
}) => {
    const [selectedSongId, setSelectedSongId] = React.useState('');
    const allSongs = React.useMemo(
        () => [...reviewRequired, ...pending, ...queue, ...assigned, ...held],
        [assigned, held, pending, queue, reviewRequired]
    );
    const selectedSong = React.useMemo(
        () => allSongs.find((song) => song.id === selectedSongId) || queue[0] || pending[0] || assigned[0] || held[0] || null,
        [allSongs, assigned, held, pending, queue, selectedSongId]
    );
    const selfServePresentation = React.useMemo(
        () => (selfServeMode?.enabled ? buildSelfServeModePresentation(selfServeMode) : null),
        [selfServeMode]
    );
    const selfServeTransitionMoment = React.useMemo(
        () => buildSelfServeTransitionMoment(selfServeMode, { songs: allSongs }),
        [allSongs, selfServeMode]
    );
    const selfServeFormat = String(selfServePresentation?.formatId || '').trim().toLowerCase();
    const spotlightAuctionLive = selfServePresentation?.stateKey === 'auction_live';
    const spotlightAuctionComplete = selfServeFormat === SELF_SERVE_FORMATS.spotlightAuction && selfServePresentation?.stateKey === 'auction_complete';
    const crowdLockedSongId = String(selfServeTransitionMoment?.songId || '').trim();
    const auctionRankBySongId = React.useMemo(() => {
        const nextMap = new Map();
        (Array.isArray(selfServeAuctionLeaderboard) ? selfServeAuctionLeaderboard : []).forEach((entry, index) => {
            const songId = String(entry?.songId || '').trim();
            if (!songId) return;
            nextMap.set(songId, {
                rank: index + 1,
                amountCents: Math.max(0, Number(entry?.amountCents || 0) || 0),
            });
        });
        return nextMap;
    }, [selfServeAuctionLeaderboard]);

    React.useEffect(() => {
        if (!selectedSong?.id && selectedSongId) {
            setSelectedSongId('');
            return;
        }
        if (!selectedSongId && selectedSong?.id) {
            setSelectedSongId(selectedSong.id);
        }
    }, [selectedSong?.id, selectedSongId]);
    const buildSelfServeRowState = React.useCallback((song, { lockedIndex = -1 } = {}) => {
        if (!song?.id || !selfServeMode?.enabled) return null;
        const songId = String(song.id || '').trim();
        if (!songId) return null;
        if (crowdLockedSongId && songId === crowdLockedSongId && selfServeTransitionMoment) {
            return {
                toneKey: selfServeTransitionMoment.toneKey || selfServePresentation?.toneKey || 'cyan',
                badgeLabel: selfServeTransitionMoment.badgeLabel || 'Locked',
                detail: selfServeTransitionMoment.detail || 'This next moment is locked and ready.',
                icon: selfServeFormat === SELF_SERVE_FORMATS.spotlightAuction ? 'fa-bolt' : 'fa-stars',
            };
        }
        if (spotlightAuctionLive) {
            const auctionRank = auctionRankBySongId.get(songId);
            if (auctionRank) {
                return {
                    toneKey: 'amber',
                    badgeLabel: auctionRank.rank === 1 ? 'Auction Lead' : `Priority #${auctionRank.rank}`,
                    detail: auctionRank.rank === 1
                        ? `${(auctionRank.amountCents / 100).toFixed(2)} in verified support is leading the opening block.`
                        : `${(auctionRank.amountCents / 100).toFixed(2)} in verified support keeps this singer in the opening block race.`,
                    icon: auctionRank.rank === 1 ? 'fa-trophy' : 'fa-arrow-trend-up',
                };
            }
        }
        if (lockedIndex === 0 && nextQueueReasonLabel) {
            return {
                toneKey: selfServePresentation?.toneKey || 'cyan',
                badgeLabel: nextQueueReasonLabel,
                detail: nextQueueReasonDetail || 'This singer is currently holding the next safe slot.',
                icon: selfServeFormat === SELF_SERVE_FORMATS.spotlightAuction ? 'fa-circle-play' : 'fa-microphone-lines',
            };
        }
        return null;
    }, [
        auctionRankBySongId,
        crowdLockedSongId,
        nextQueueReasonDetail,
        nextQueueReasonLabel,
        selfServeFormat,
        selfServeMode?.enabled,
        selfServePresentation?.toneKey,
        selfServeTransitionMoment,
        spotlightAuctionLive,
    ]);
    if (!showQueueList) return null;
    const safeProtectedReadyQueueCount = Math.max(0, Math.min(queue.length, Number(protectedReadyQueueCount || 0)));
    const lockedLineupCount = Number(lineupHasCurrentPerformer ? 1 : 0) + safeProtectedReadyQueueCount;
    const lockedLineupTarget = Number(lineupHasCurrentPerformer ? 1 : 0) + Math.max(safeProtectedReadyQueueCount, Number(protectedReadyQueueTarget || 0));
    const lockedLineupComplete = lockedLineupTarget > 0 && lockedLineupCount >= lockedLineupTarget;
    const readyQueueHeaderLabel = spotlightAuctionLive
        ? 'Live Showcase Queue'
        : spotlightAuctionComplete
            ? 'Fair Queue'
            : selfServeFormat === SELF_SERVE_FORMATS.openStage
                ? 'Open Stage Queue'
                : 'Live Queue Order';
    const readyQueueHeaderDetail = lineupHasCurrentPerformer
        ? 'On Stage is separate. The first row here is Next, followed by Then and the rest of the queue.'
        : 'No one is on stage. The first row is the next performance to start.';
    const getReadyQueuePositionLabel = (index = 0) => {
        const safeIndex = Math.max(0, Number(index || 0));
        if (lineupHasCurrentPerformer) {
            if (safeIndex === 0) return 'Next';
            if (safeIndex === 1) return 'Then';
            return `Q${safeIndex + 1}`;
        }
        if (safeIndex === 0) return 'Start';
        if (safeIndex === 1) return 'Next';
        if (safeIndex === 2) return 'Then';
        return `Q${safeIndex + 1}`;
    };

    return (
        <>
            {renderSummaryBarInline ? (
                <QueueSummaryBar
                    showQueueSummaryBar={showQueueSummaryBar}
                    onToggleQueueSummaryBar={onToggleQueueSummaryBar}
                    reviewRequiredCount={reviewRequiredCount}
                    pending={pending}
                    queue={queue}
                    assigned={assigned}
                    held={held}
                    queueSurfaceCounts={queueSurfaceCounts}
                    runOfShowOpenSlots={runOfShowOpenSlots}
                    onFillRunOfShowOpenSlotsFromQueue={onFillRunOfShowOpenSlotsFromQueue}
                    onAddQuickRunOfShowMoment={onAddQuickRunOfShowMoment}
                    protectedReadyQueueCount={protectedReadyQueueCount}
                    protectedReadyQueueTarget={protectedReadyQueueTarget}
                    lineupHasCurrentPerformer={lineupHasCurrentPerformer}
                    styles={styles}
                    compactViewport={compactViewport}
                />
            ) : null}
            <div className="mb-3">
                {touchReorderAvailable && touchReorderMode ? (
                    <div className="mb-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                        Reorder mode is live. Drag a song by its handle, then tap Done Reordering.
                    </div>
                ) : null}
                <QueueSectionHeader
                    label={readyQueueHeaderLabel}
                    count={queue.length}
                    toneClass={spotlightAuctionLive ? 'text-amber-200' : 'text-cyan-200'}
                    detail={readyQueueHeaderDetail}
                />
                {queue.map((s, i) => {
                    const lockedInLiveLineup = i < safeProtectedReadyQueueCount;
                    return (
                        <QueueSongCard
                            key={s.id}
                            song={s}
                            index={i}
                            queuePositionLabel={getReadyQueuePositionLabel(i)}
                            dragQueueId={dragQueueId}
                            dragOverId={dragOverId}
                            setDragQueueId={setDragQueueId}
                            setDragOverId={setDragOverId}
                            reorderQueue={reorderQueue}
                            touchReorderEnabled={touchReorderEnabled}
                            touchReorderMode={touchReorderMode}
                            handleTouchStart={handleTouchStart}
                            handleTouchMove={handleTouchMove}
                            handleTouchEnd={handleTouchEnd}
                            updateStatus={updateStatus}
                            startEdit={startEdit}
                            onRetryLyrics={onRetryLyrics}
                            onFetchTimedLyrics={onFetchTimedLyrics}
                            onApproveAudienceBacking={onApproveAudienceBacking}
                            onAvoidAudienceBacking={onAvoidAudienceBacking}
                            onMoveNext={lockedLineupComplete ? null : onMoveNext}
                            onHoldSinger={onHoldSinger}
                            onRestoreSinger={onRestoreSinger}
                            onRemove={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                            backingDecisionBusyKey={backingDecisionBusyKey}
                            statusPill={statusPill}
                            styles={styles}
                            compactViewport={compactViewport}
                            selected={selectedSong?.id === s.id}
                            onSelect={(song) => setSelectedSongId((prev) => prev === song?.id ? '' : (song?.id || ''))}
                            runOfShowAssignableSlots={runOfShowAssignableSlots}
                            runOfShowOpenSlots={runOfShowOpenSlots}
                            onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                            onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
                            onApprovePending={onApprovePending}
                            onDeletePending={onDeletePending}
                            lockedInLineup={lockedInLiveLineup}
                            lineupSlotLabel={lockedInLiveLineup ? getReadyQueuePositionLabel(i) : ''}
                            selfServeState={buildSelfServeRowState(s, { lockedIndex: lockedInLiveLineup ? i : -1 })}
                        />
                    );
                })}
            </div>
            {pending.length > 0 ? (
                <div className={`mb-3 border-t border-white/10 ${compactViewport ? 'pt-2' : 'pt-3'}`}>
                    <QueueSectionHeader
                        label="Awaiting Approval"
                        count={pending.length}
                        toneClass="text-orange-300"
                        detail="Approve or review these before they enter the live queue."
                    />
                    {pending.map((s, i) => (
                            <QueueSongCard
                                key={s.id}
                                song={s}
                                index={i}
                                queuePositionLabel="Check"
                                dragQueueId={dragQueueId}
                                dragOverId={dragOverId}
                                setDragQueueId={setDragQueueId}
                                setDragOverId={setDragOverId}
                                reorderQueue={reorderQueue}
                                touchReorderEnabled={false}
                                touchReorderMode={false}
                                handleTouchStart={handleTouchStart}
                                handleTouchMove={handleTouchMove}
                                handleTouchEnd={handleTouchEnd}
                                updateStatus={updateStatus}
                                onApproveAudienceBacking={onApproveAudienceBacking}
                                onAvoidAudienceBacking={onAvoidAudienceBacking}
                                onMoveNext={onMoveNext}
                                onRestoreSinger={onRestoreSinger}
                                onRemove={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                                backingDecisionBusyKey={backingDecisionBusyKey}
                                statusPill={statusPill}
                                styles={styles}
                                compactViewport={compactViewport}
                                selected={selectedSong?.id === s.id}
                                onSelect={(song) => setSelectedSongId((prev) => prev === song?.id ? '' : (song?.id || ''))}
                                runOfShowAssignableSlots={runOfShowAssignableSlots}
                                runOfShowOpenSlots={runOfShowOpenSlots}
                                onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                                onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
                                onApprovePending={onApprovePending}
                                onDeletePending={onDeletePending}
                            />
                        ))}
                </div>
            ) : null}
            {assigned.length > 0 ? (
                <div className={`mt-3 border-t border-white/10 ${compactViewport ? 'pt-2' : 'pt-3'}`}>
                    <QueueSectionHeader
                        label="Tied To Show"
                        count={assigned.length}
                        toneClass="text-violet-200"
                        detail="Linked songs are controlled by run-of-show slots, not the live queue order."
                    />
                    {assigned.map((s, i) => (
                            <QueueSongCard
                                key={s.id}
                                song={s}
                                index={queue.length + i}
                                queuePositionLabel="Linked"
                                dragQueueId={dragQueueId}
                                dragOverId={dragOverId}
                                setDragQueueId={setDragQueueId}
                                setDragOverId={setDragOverId}
                                reorderQueue={reorderQueue}
                                touchReorderEnabled={touchReorderEnabled}
                                touchReorderMode={touchReorderMode}
                                handleTouchStart={handleTouchStart}
                                handleTouchMove={handleTouchMove}
                                handleTouchEnd={handleTouchEnd}
                                updateStatus={updateStatus}
                                startEdit={startEdit}
                                onRetryLyrics={onRetryLyrics}
                                onFetchTimedLyrics={onFetchTimedLyrics}
                                onApproveAudienceBacking={onApproveAudienceBacking}
                                onAvoidAudienceBacking={onAvoidAudienceBacking}
                                onMoveNext={onMoveNext}
                                onHoldSinger={onHoldSinger}
                                onRestoreSinger={onRestoreSinger}
                                onRemove={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                                backingDecisionBusyKey={backingDecisionBusyKey}
                                statusPill={statusPill}
                                styles={styles}
                                compactViewport={compactViewport}
                                selected={selectedSong?.id === s.id}
                                onSelect={(song) => setSelectedSongId((prev) => prev === song?.id ? '' : (song?.id || ''))}
                                runOfShowAssignableSlots={runOfShowAssignableSlots}
                                runOfShowOpenSlots={runOfShowOpenSlots}
                                onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                                onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
                                onApprovePending={onApprovePending}
                                onDeletePending={onDeletePending}
                            />
                        ))}
                </div>
            ) : null}
            {held.length > 0 ? (
                <div className={`mt-3 border-t border-white/10 ${compactViewport ? 'pt-2' : 'pt-3'}`}>
                    <QueueSectionHeader
                        label="Held"
                        count={held.length}
                        toneClass="text-zinc-200"
                        detail="Held singers are parked until they are restored."
                    />
                    {held.map((s, i) => (
                        <QueueSongCard
                            key={s.id}
                            song={s}
                            index={i}
                            queuePositionLabel="Held"
                            dragQueueId={dragQueueId}
                            dragOverId={dragOverId}
                            setDragQueueId={setDragQueueId}
                            setDragOverId={setDragOverId}
                            reorderQueue={reorderQueue}
                            touchReorderEnabled={false}
                            touchReorderMode={false}
                            handleTouchStart={handleTouchStart}
                            handleTouchMove={handleTouchMove}
                            handleTouchEnd={handleTouchEnd}
                            updateStatus={updateStatus}
                            startEdit={startEdit}
                            onRetryLyrics={onRetryLyrics}
                            onFetchTimedLyrics={onFetchTimedLyrics}
                            onApproveAudienceBacking={onApproveAudienceBacking}
                            onAvoidAudienceBacking={onAvoidAudienceBacking}
                            onMoveNext={onMoveNext}
                            onHoldSinger={onHoldSinger}
                            onRestoreSinger={onRestoreSinger}
                            onRemove={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                            backingDecisionBusyKey={backingDecisionBusyKey}
                            statusPill={statusPill}
                            styles={styles}
                            compactViewport={compactViewport}
                            selected={selectedSong?.id === s.id}
                            onSelect={(song) => setSelectedSongId((prev) => prev === song?.id ? '' : (song?.id || ''))}
                            runOfShowAssignableSlots={runOfShowAssignableSlots}
                            runOfShowOpenSlots={runOfShowOpenSlots}
                            onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                            onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
                            onApprovePending={onApprovePending}
                            onDeletePending={onDeletePending}
                        />
                    ))}
                </div>
            ) : null}
        </>
    );
};

export default QueueListPanel;
