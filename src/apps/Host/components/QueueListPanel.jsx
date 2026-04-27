import React from 'react';
import { deleteDoc, doc, db } from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import QueueSongCard from './QueueSongCard';
import { requiresBackingHostReview } from '../../../lib/requestModes';

const QueueSectionToggle = ({ label, count, toneClass, open, onToggle }) => (
    <button
        type="button"
        onClick={onToggle}
        aria-expanded={!!open}
        className={`mb-2 flex min-h-[40px] w-full touch-manipulation items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-3 py-1.5 text-left transition hover:border-cyan-300/25 ${toneClass}`}
    >
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em]">{label}</span>
            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                {count}
            </span>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 text-zinc-200">
            <i className={`fa-solid fa-chevron-down text-xs transition-transform ${open ? 'rotate-180' : ''}`}></i>
        </span>
    </button>
);

const buildQueueSongLabel = (song = {}) => {
    const singerName = String(song?.singerName || '').trim();
    const songTitle = String(song?.songTitle || '').trim();
    if (singerName && songTitle) return `${singerName} - ${songTitle}`;
    return singerName || songTitle || 'Queue item';
};

const QueueQuickAccessPanel = ({
    styles,
    quickControls = null,
}) => {
    if (!quickControls) return null;

    const queueRuleSummary = String(quickControls.queueRuleSummary || '').trim() || 'Queue rules stay live here.';
    const autoSummary = String(quickControls.automationSummary || '').trim() || 'Automation stays close to the queue.';

    const queueButtons = [
        {
            key: 'rotation',
            label: 'Rotation',
            value: quickControls.rotationLabel || 'Round Robin',
            onClick: quickControls.onCycleQueueRotation,
        },
        {
            key: 'limitMode',
            label: 'Request Cap',
            value: quickControls.limitLabel || 'No Limits',
            onClick: quickControls.onCycleQueueLimitMode,
        },
        {
            key: 'boost',
            label: 'First-Time Boost',
            value: quickControls.firstTimeBoost ? 'On' : 'Off',
            onClick: quickControls.onToggleFirstTimeBoost,
        },
        quickControls.showReadyCheck
            ? {
                key: 'readyCheck',
                label: 'Room Reset',
                value: 'Ready Check',
                onClick: quickControls.onTriggerReadyCheck,
            }
            : null,
    ].filter(Boolean);

    const automationButtons = [
        {
            key: 'autoDj',
            label: 'Auto DJ',
            value: quickControls.autoDj ? 'On' : 'Off',
            onClick: quickControls.onToggleAutoDj,
            tone: quickControls.autoDj ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100' : '',
        },
        {
            key: 'autoEnd',
            label: 'Auto End',
            value: quickControls.autoEndOnTrackFinish ? 'On' : 'Off',
            onClick: quickControls.onToggleAutoEnd,
            tone: quickControls.autoEndOnTrackFinish ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100' : '',
        },
        {
            key: 'autoParty',
            label: 'Auto Party',
            value: quickControls.autoPartyEnabled ? 'On' : 'Off',
            onClick: quickControls.onToggleAutoParty,
            tone: quickControls.autoPartyEnabled ? 'border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100' : '',
        },
        {
            key: 'popTrivia',
            label: 'Pop Trivia',
            value: quickControls.popTriviaEnabled ? 'On' : 'Off',
            onClick: quickControls.onTogglePopTrivia,
            tone: quickControls.popTriviaEnabled ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : '',
        },
    ].filter((item) => typeof item.onClick === 'function');

    return (
        <div
            data-feature-id="queue-live-controls"
            className="mb-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">Queue Controls</div>
                    <div className="mt-1 text-sm font-semibold text-white">Live-use settings stay in the queue tab.</div>
                    <div className="mt-1 text-xs text-zinc-400">Use these quick controls for pacing and automation without leaving live operations.</div>
                </div>
                {typeof quickControls.onOpenRunOfShow === 'function' ? (
                    <button
                        type="button"
                        onClick={quickControls.onOpenRunOfShow}
                        className={`${styles.btnStd} ${styles.btnSecondary} min-h-[38px] px-3 text-[11px]`}
                    >
                        Open Conveyor
                    </button>
                ) : null}
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Queue Rules</div>
                    <div className="mt-1 text-xs text-zinc-400">{queueRuleSummary}</div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {queueButtons.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={item.onClick}
                                className={`${styles.btnStd} ${styles.btnNeutral} min-h-[42px] justify-between px-3 text-[11px]`}
                            >
                                <span>{item.label}</span>
                                <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-100">
                                    {item.value}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Automation</div>
                    <div className="mt-1 text-xs text-zinc-400">{autoSummary}</div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {automationButtons.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={item.onClick}
                                className={`${styles.btnStd} ${item.tone || styles.btnNeutral} min-h-[42px] justify-between px-3 text-[11px]`}
                            >
                                <span>{item.label}</span>
                                <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-zinc-100">
                                    {item.value}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const QueueInspector = ({
    song = null,
    styles,
    onStart,
    onApprovePending,
    onMoveNext,
    onHoldSinger,
    onRestoreSinger,
    onOpenEdit,
    onRemove,
    onAssignQueueSongToRunOfShowItem,
    runOfShowAssignableSlots = [],
    runOfShowOpenSlots = [],
    onAssignQueueSongToNextOpenRunOfShowSlot,
}) => {
    const [selectedSlotId, setSelectedSlotId] = React.useState('');

    React.useEffect(() => {
        if (!song?.id) {
            setSelectedSlotId('');
            return;
        }
        const fallbackSlotId = String(song?.runOfShowItemId || runOfShowOpenSlots?.[0]?.id || runOfShowAssignableSlots?.[0]?.id || '').trim();
        setSelectedSlotId(fallbackSlotId);
    }, [runOfShowAssignableSlots, runOfShowOpenSlots, song?.id, song?.runOfShowItemId]);

    if (!song?.id) return null;
    const songStatus = String(song?.status || '').trim().toLowerCase();
    const isHeld = songStatus === 'held';
    const needsTrackReview = ['requested', 'pending'].includes(songStatus) && requiresBackingHostReview(song?.resolutionStatus);
    const isPendingApproval = songStatus === 'pending' && !needsTrackReview;
    const isAssigned = songStatus === 'assigned';
    const selectedSlot = runOfShowAssignableSlots.find((slot) => slot.id === selectedSlotId) || null;
    const nextOpenSlot = runOfShowOpenSlots[0] || null;
    const canFastAssignToOpenSlot = !isHeld && !needsTrackReview && !isPendingApproval && !isAssigned
        && typeof onAssignQueueSongToNextOpenRunOfShowSlot === 'function'
        && !!nextOpenSlot?.id;

    return (
        <div
            data-feature-id="queue-song-inspector"
            className="mb-3 rounded-2xl border border-cyan-300/18 bg-gradient-to-r from-cyan-500/[0.08] via-zinc-950 to-violet-500/[0.08] px-3 py-3"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">Queue Inspector</div>
                    <div className="mt-1 text-sm font-semibold text-white">{buildQueueSongLabel(song)}</div>
                    <div className="mt-1 text-xs text-zinc-400">
                        {String(song?.artist || '').trim() || 'Artist not set'}{song?.duration ? ` | ${song.duration}s` : ''}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-zinc-200">{songStatus || 'queued'}</span>
                    {song?.runOfShowItemId ? (
                        <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-violet-100">Linked To Show</span>
                    ) : null}
                </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {isHeld ? (
                    <button
                        type="button"
                        onClick={() => onRestoreSinger?.(song.id)}
                        className={`${styles.btnStd} ${styles.btnPrimary} min-h-[40px] text-[11px]`}
                    >
                        Restore Singer
                    </button>
                ) : needsTrackReview ? (
                    <button
                        type="button"
                        onClick={() => onOpenEdit?.(song)}
                        className={`${styles.btnStd} ${styles.btnPrimary} min-h-[40px] text-[11px]`}
                    >
                        Pick Backing
                    </button>
                ) : isPendingApproval ? (
                    <button
                        type="button"
                        onClick={() => onApprovePending?.(song.id)}
                        className={`${styles.btnStd} ${styles.btnPrimary} min-h-[40px] text-[11px]`}
                    >
                        Approve Request
                    </button>
                ) : isAssigned ? (
                    <button
                        type="button"
                        onClick={() => onOpenEdit?.(song)}
                        className={`${styles.btnStd} ${styles.btnPrimary} min-h-[40px] text-[11px]`}
                    >
                        Edit Linked Song
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => onStart?.(song.id)}
                        className={`${styles.btnStd} ${styles.btnPrimary} min-h-[40px] text-[11px]`}
                    >
                        Start Singer
                    </button>
                )}
                {!isHeld && !needsTrackReview && !isPendingApproval && !isAssigned ? (
                    <button
                        type="button"
                        onClick={() => onMoveNext?.(song.id)}
                        className={`${styles.btnStd} ${styles.btnNeutral} min-h-[40px] text-[11px]`}
                    >
                        Move To Next
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => onOpenEdit?.(song)}
                    className={`${styles.btnStd} ${styles.btnSecondary} min-h-[40px] text-[11px]`}
                >
                    Edit Details
                </button>
                {!isHeld && !needsTrackReview && !isPendingApproval && !isAssigned ? (
                    <button
                        type="button"
                        onClick={() => onHoldSinger?.(song.id, 'not_here')}
                        className={`${styles.btnStd} ${styles.btnNeutral} min-h-[40px] text-[11px]`}
                    >
                        Hold Singer
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => onRemove?.(song.id)}
                    className={`${styles.btnStd} ${styles.btnDanger} min-h-[40px] text-[11px]`}
                >
                    Remove From Queue
                </button>
            </div>

            {(typeof onAssignQueueSongToRunOfShowItem === 'function' && runOfShowAssignableSlots.length) || canFastAssignToOpenSlot ? (
                !isHeld && !needsTrackReview && !isPendingApproval ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Run Of Show Slot</div>
                    {canFastAssignToOpenSlot ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onAssignQueueSongToNextOpenRunOfShowSlot(song.id)}
                                className={`${styles.btnStd} ${styles.btnPrimary} min-h-[40px] px-3 text-[11px]`}
                            >
                                {runOfShowOpenSlots.length === 1
                                    ? `Assign To ${nextOpenSlot.label}`
                                    : `Assign To Next Open Slot`}
                            </button>
                            {runOfShowOpenSlots.length > 1 ? (
                                <div className="text-xs text-zinc-400">
                                    Next open: {nextOpenSlot.label}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {typeof onAssignQueueSongToRunOfShowItem === 'function' && runOfShowAssignableSlots.length ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <select
                                value={selectedSlotId}
                                onChange={(event) => setSelectedSlotId(event.target.value)}
                                className="min-w-[180px] rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none"
                            >
                                {runOfShowAssignableSlots.map((slot) => (
                                    <option key={slot.id} value={slot.id}>{slot.label}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                disabled={!selectedSlotId}
                                onClick={() => onAssignQueueSongToRunOfShowItem(song.id, selectedSlotId)}
                                className={`${styles.btnStd} ${styles.btnNeutral} min-h-[40px] px-3 text-[11px] disabled:opacity-45`}
                            >
                                {song?.runOfShowItemId ? 'Reassign Selected Slot' : 'Assign Selected Slot'}
                            </button>
                        </div>
                    ) : null}
                    {selectedSlot ? (
                        <div className="mt-2 text-xs text-zinc-400">Selected slot: {selectedSlot.label}</div>
                    ) : canFastAssignToOpenSlot ? (
                        <div className="mt-2 text-xs text-zinc-400">Open slot: {nextOpenSlot.label}</div>
                    ) : null}
                </div>
                ) : null
            ) : null}
        </div>
    );
};

const QueueListPanel = ({
    showQueueList,
    showQueueSummaryBar = true,
    onToggleQueueSummaryBar,
    reviewRequiredCount = 0,
    pending,
    pendingQueueOpen = true,
    onTogglePendingQueue,
    queue,
    readyQueueOpen = true,
    onToggleReadyQueue,
    assigned = [],
    assignedQueueOpen = true,
    onToggleAssignedQueue,
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
    quickControls = null,
}) => {
    const [selectedSongId, setSelectedSongId] = React.useState('');
    const counts = queueSurfaceCounts || {};
    const allSongs = React.useMemo(
        () => [...reviewRequired, ...pending, ...queue, ...assigned, ...held],
        [assigned, held, pending, queue, reviewRequired]
    );
    const selectedSong = React.useMemo(
        () => allSongs.find((song) => song.id === selectedSongId) || queue[0] || pending[0] || assigned[0] || held[0] || null,
        [allSongs, assigned, held, pending, queue, selectedSongId]
    );

    React.useEffect(() => {
        if (!selectedSong?.id && selectedSongId) {
            setSelectedSongId('');
            return;
        }
        if (!selectedSongId && selectedSong?.id) {
            setSelectedSongId(selectedSong.id);
        }
    }, [selectedSong?.id, selectedSongId]);
    if (!showQueueList) return null;
    const needsAttentionCount = Number.isFinite(Number(counts.needsAttention))
        ? Number(counts.needsAttention)
        : (Number(reviewRequiredCount || 0) + Number(pending.length || 0));
    const readyCount = Number.isFinite(Number(counts.ready)) ? Number(counts.ready) : queue.length;
    const assignedCount = Number.isFinite(Number(counts.assigned)) ? Number(counts.assigned) : assigned.length;
    const heldCount = Number.isFinite(Number(counts.held)) ? Number(counts.held) : held.length;
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
    const showQueueSummaryChips = queueSummaryChips.length > 1 || queueSummaryChips.some((chip) => chip.key !== 'ready');

    const queueSummary = needsAttentionCount > 0
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
                        eyebrow: 'Queue ready',
                        title: `${readyCount} song${readyCount === 1 ? '' : 's'} ready to run`,
                        detail: 'Stage can advance without touching review or slot assignment.',
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

    return (
        <>
            {showQueueSummaryBar ? (
                <div className={`mb-3 rounded-2xl border px-3 shadow-[0_10px_26px_rgba(0,0,0,0.18)] ${queueSummary.toneClass} ${compactViewport ? 'py-2.5' : 'py-3'}`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className={`text-[10px] uppercase tracking-[0.22em] ${queueSummary.accentClass}`}>{queueSummary.eyebrow}</div>
                            <div className="mt-1 text-sm font-semibold text-white">{queueSummary.title}</div>
                            <div className="mt-1 text-xs text-zinc-300">{queueSummary.detail}</div>
                        </div>
                        {typeof onToggleQueueSummaryBar === 'function' ? (
                            <button
                                type="button"
                                onClick={onToggleQueueSummaryBar}
                                className="inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200 transition hover:border-cyan-300/35 hover:text-white"
                            >
                                Hide Bar
                            </button>
                        ) : null}
                    </div>
                    {showQueueSummaryChips ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.15em]">
                            {queueSummaryChips.map((chip) => (
                                <span key={chip.key} className={chip.className}>{chip.label}</span>
                            ))}
                        </div>
                    ) : null}
                    {canFillRunOfShowFromQueue ? (
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
                </div>
            ) : (
                typeof onToggleQueueSummaryBar === 'function' ? (
                    <div className="mb-3 flex justify-end">
                        <button
                            type="button"
                            onClick={onToggleQueueSummaryBar}
                            className="inline-flex min-h-[34px] items-center justify-center rounded-full border border-white/10 bg-black/20 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 transition hover:border-cyan-300/35 hover:text-white"
                        >
                            Show Queue Bar
                        </button>
                    </div>
            ) : null
            )}
            <QueueQuickAccessPanel
                styles={styles}
                quickControls={quickControls}
            />
            <QueueInspector
                song={selectedSong}
                styles={styles}
                onStart={(songId) => updateStatus(songId, 'performing')}
                onApprovePending={onApprovePending}
                onMoveNext={onMoveNext}
                onHoldSinger={onHoldSinger}
                onRestoreSinger={onRestoreSinger}
                onOpenEdit={startEdit}
                onRemove={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                runOfShowAssignableSlots={runOfShowAssignableSlots}
                runOfShowOpenSlots={runOfShowOpenSlots}
                onAssignQueueSongToNextOpenRunOfShowSlot={onAssignQueueSongToNextOpenRunOfShowSlot}
            />
            {pending.length > 0 ? (
                <div className={`mb-3 border-b border-white/10 ${compactViewport ? 'pb-1.5' : 'pb-2'}`}>
                    <QueueSectionToggle
                        label="Awaiting Approval"
                        count={pending.length}
                        toneClass="text-orange-300"
                        open={pendingQueueOpen}
                        onToggle={onTogglePendingQueue}
                    />
                    {pendingQueueOpen ? (
                        <>
                        {pending.map((s, i) => (
                            <QueueSongCard
                                key={s.id}
                                song={s}
                                index={i}
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
                                backingDecisionBusyKey={backingDecisionBusyKey}
                                statusPill={statusPill}
                                styles={styles}
                                compactViewport={compactViewport}
                                selected={selectedSong?.id === s.id}
                                onSelect={(song) => setSelectedSongId(song?.id || '')}
                                runOfShowAssignableSlots={runOfShowAssignableSlots}
                                onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                                onApprovePending={onApprovePending}
                                onDeletePending={onDeletePending}
                            />
                        ))}
                        </>
                    ) : null}
                </div>
            ) : null}
            <div className="mb-3">
                {touchReorderAvailable && touchReorderMode ? (
                    <div className="mb-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                        Reorder mode is live. Drag a song by its handle, then tap Done Reordering.
                    </div>
                ) : null}
                <QueueSectionToggle
                    label="Ready To Run"
                    count={queue.length}
                    toneClass="text-cyan-200"
                    open={readyQueueOpen}
                    onToggle={onToggleReadyQueue}
                />
                {readyQueueOpen ? queue.map((s, i) => (
                    <QueueSongCard
                        key={s.id}
                        song={s}
                        index={i}
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
                        backingDecisionBusyKey={backingDecisionBusyKey}
                        statusPill={statusPill}
                        styles={styles}
                        compactViewport={compactViewport}
                        selected={selectedSong?.id === s.id}
                        onSelect={(song) => setSelectedSongId(song?.id || '')}
                        runOfShowAssignableSlots={runOfShowAssignableSlots}
                        onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                        onApprovePending={onApprovePending}
                        onDeletePending={onDeletePending}
                    />
                )) : null}
            </div>
            {assigned.length > 0 ? (
                <div className={`mt-3 border-t border-white/10 ${compactViewport ? 'pt-2' : 'pt-3'}`}>
                    <QueueSectionToggle
                        label="Tied To Show"
                        count={assigned.length}
                        toneClass="text-violet-200"
                        open={assignedQueueOpen}
                        onToggle={onToggleAssignedQueue}
                    />
                    {assignedQueueOpen ? (
                        <>
                        {assigned.map((s, i) => (
                            <QueueSongCard
                                key={s.id}
                                song={s}
                                index={queue.length + i}
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
                                backingDecisionBusyKey={backingDecisionBusyKey}
                                statusPill={statusPill}
                                styles={styles}
                                compactViewport={compactViewport}
                                selected={selectedSong?.id === s.id}
                                onSelect={(song) => setSelectedSongId(song?.id || '')}
                                runOfShowAssignableSlots={runOfShowAssignableSlots}
                                onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                                onApprovePending={onApprovePending}
                                onDeletePending={onDeletePending}
                            />
                        ))}
                        </>
                    ) : null}
                </div>
            ) : null}
            {held.length > 0 ? (
                <div className={`mt-3 border-t border-white/10 ${compactViewport ? 'pt-2' : 'pt-3'}`}>
                    <QueueSectionToggle
                        label="Held"
                        count={held.length}
                        toneClass="text-zinc-200"
                        open
                        onToggle={() => {}}
                    />
                    {held.map((s, i) => (
                        <QueueSongCard
                            key={s.id}
                            song={s}
                            index={i}
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
                            backingDecisionBusyKey={backingDecisionBusyKey}
                            statusPill={statusPill}
                            styles={styles}
                            compactViewport={compactViewport}
                            selected={selectedSong?.id === s.id}
                            onSelect={(song) => setSelectedSongId(song?.id || '')}
                            runOfShowAssignableSlots={runOfShowAssignableSlots}
                            onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
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
