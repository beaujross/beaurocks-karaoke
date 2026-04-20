import React from 'react';
import QueueSongCard from './QueueSongCard';

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
    onApprovePending,
    onDeletePending,
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
    queueSurfaceCounts = null,
    onAssignQueueSongToRunOfShowItem
}) => {
    if (!showQueueList) return null;
    const counts = queueSurfaceCounts || {};
    const needsAttentionCount = Number.isFinite(Number(counts.needsAttention))
        ? Number(counts.needsAttention)
        : (Number(reviewRequiredCount || 0) + Number(pending.length || 0));
    const readyCount = Number.isFinite(Number(counts.ready)) ? Number(counts.ready) : queue.length;
    const assignedCount = Number.isFinite(Number(counts.assigned)) ? Number(counts.assigned) : assigned.length;

    const queueSummary = needsAttentionCount > 0
        ? {
            eyebrow: 'Queue needs attention',
            title: `${needsAttentionCount} request${needsAttentionCount === 1 ? '' : 's'} waiting on host action`,
            detail: reviewRequiredCount > 0 && pending.length > 0
                ? `${reviewRequiredCount} track pick${reviewRequiredCount === 1 ? '' : 's'} and ${pending.length} approval${pending.length === 1 ? '' : 's'} are holding the queue.`
                : reviewRequiredCount > 0
                    ? `${reviewRequiredCount} request${reviewRequiredCount === 1 ? '' : 's'} still need a host track pick.`
                    : 'Clear the approval stack so the live queue reflects what can actually go on stage.',
            toneClass: 'border-amber-300/25 bg-amber-500/10 text-amber-100',
            accentClass: 'text-amber-100'
        }
        : readyCount === 0 && assignedCount === 0
            ? {
                eyebrow: 'Queue status',
                title: 'Queue is empty',
                detail: 'Add songs or approve requests to keep the room moving.',
                toneClass: 'border-white/10 bg-black/25 text-zinc-300',
                accentClass: 'text-zinc-100'
            }
            : runOfShowAssignableSlots.length > 0 && readyCount > 0
                ? {
                    eyebrow: 'Run of show ready',
                    title: `${runOfShowAssignableSlots.length} slot${runOfShowAssignableSlots.length === 1 ? '' : 's'} can pull from queue`,
                    detail: 'Use slot assignment on any ready song when you want the show plan to absorb it.',
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
                        eyebrow: 'Run of show linked',
                        title: `${assignedCount} song${assignedCount === 1 ? '' : 's'} already assigned`,
                        detail: 'These songs are tied to show slots and will move through the run-of-show lane.',
                        toneClass: 'border-violet-300/25 bg-violet-500/10 text-violet-100',
                        accentClass: 'text-violet-100'
                    };

    return (
        <>
            {showQueueSummaryBar ? (
                <div className={`sticky top-0 z-10 mb-3 rounded-2xl border px-3 backdrop-blur shadow-[0_10px_26px_rgba(0,0,0,0.22)] ${queueSummary.toneClass} ${compactViewport ? 'py-2.5' : 'py-3'}`}>
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
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.15em]">
                        {needsAttentionCount ? (
                            <span className="rounded-full border border-orange-300/30 bg-orange-500/10 px-2 py-1 text-orange-100">Needs Attention {needsAttentionCount}</span>
                        ) : null}
                        {reviewRequiredCount ? (
                            <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-amber-100">Track Check {reviewRequiredCount}</span>
                        ) : null}
                        {pending.length ? (
                            <span className="rounded-full border border-orange-300/30 bg-orange-500/10 px-2 py-1 text-orange-100">Pending {pending.length}</span>
                        ) : null}
                        <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">Ready {readyCount}</span>
                        {assignedCount ? (
                            <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-violet-100">Assigned {assignedCount}</span>
                        ) : null}
                        {runOfShowAssignableSlots.length ? (
                            <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">
                                Open Slots {runOfShowAssignableSlots.length}
                            </span>
                        ) : null}
                    </div>
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
            {pending.length > 0 ? (
                <div className={`mb-3 border-b border-white/10 ${compactViewport ? 'pb-1.5' : 'pb-2'}`}>
                    <QueueSectionToggle
                        label="Needs Review"
                        count={pending.length}
                        toneClass="text-orange-300"
                        open={pendingQueueOpen}
                        onToggle={onTogglePendingQueue}
                    />
                    {pendingQueueOpen ? (
                        <>
                        {pending.map(s => (
                            <div key={s.id} className={`bg-orange-950/30 rounded border border-orange-500/30 mb-2 ${compactViewport ? 'p-1.5' : 'p-2'} flex justify-between items-center gap-2`}>
                                <div className="min-w-0">
                                    <div className={`${compactViewport ? 'text-[13px]' : 'text-sm'} font-bold truncate`}>{s.songTitle}</div>
                                    <div className={`${compactViewport ? 'text-[11px]' : 'text-sm'} text-zinc-400 truncate`}>{s.singerName}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => onApprovePending(s.id)} className={`${styles.btnStd} ${styles.btnSuccess} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2'}`}>OK</button>
                                    <button onClick={() => onDeletePending(s.id)} className={`${styles.btnStd} ${styles.btnDanger} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2'}`}>X</button>
                                </div>
                            </div>
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
                        backingDecisionBusyKey={backingDecisionBusyKey}
                        statusPill={statusPill}
                        styles={styles}
                        compactViewport={compactViewport}
                        runOfShowAssignableSlots={runOfShowAssignableSlots}
                        onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
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
                                backingDecisionBusyKey={backingDecisionBusyKey}
                                statusPill={statusPill}
                                styles={styles}
                                compactViewport={compactViewport}
                                runOfShowAssignableSlots={runOfShowAssignableSlots}
                                onAssignQueueSongToRunOfShowItem={onAssignQueueSongToRunOfShowItem}
                            />
                        ))}
                        </>
                    ) : null}
                </div>
            ) : null}
        </>
    );
};

export default QueueListPanel;
