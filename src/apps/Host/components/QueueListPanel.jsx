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
    touchReorderEnabled,
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
    onAssignQueueSongToRunOfShowItem
}) => {
    if (!showQueueList) return null;

    const queueSummary = pending.length > 0
        ? {
            title: 'Next action: review incoming requests.',
            detail: `${pending.length} request${pending.length === 1 ? '' : 's'} still need host review before they enter the live queue.`,
            toneClass: 'border-amber-300/25 bg-amber-500/10 text-amber-100'
        }
        : queue.length === 0 && assigned.length === 0
            ? {
                title: 'Queue is empty.',
                detail: 'Add songs to keep the room moving.',
                toneClass: 'border-white/10 bg-black/25 text-zinc-300'
            }
            : runOfShowAssignableSlots.length > 0 && queue.length > 0
                ? {
                    title: 'Queue can feed the show right now.',
                    detail: `${runOfShowAssignableSlots.length} show slot${runOfShowAssignableSlots.length === 1 ? '' : 's'} can pull from the live queue.`,
                    toneClass: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100'
                }
                : queue.length > 0
                    ? {
                        title: 'Songs are ready to run.',
                        detail: `${queue.length} song${queue.length === 1 ? '' : 's'} are ready in the live queue.`,
                        toneClass: 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100'
                    }
                    : {
                        title: 'Queue is supporting the show.',
                        detail: `${assigned.length} song${assigned.length === 1 ? '' : 's'} already tied to show slots.`,
                        toneClass: 'border-violet-300/25 bg-violet-500/10 text-violet-100'
                    };

    return (
        <>
            <div className={`sticky top-0 z-10 mb-3 rounded-2xl border border-white/10 bg-zinc-950/92 backdrop-blur px-3 ${compactViewport ? 'py-2' : 'py-2.5'}`}>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-200">Live Queue</div>
                        <div className="mt-0.5 text-xs font-semibold text-zinc-300 truncate">{queueSummary.title}</div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5 text-[10px] uppercase tracking-[0.15em]">
                        <span className="rounded-full border border-orange-300/30 bg-orange-500/10 px-2 py-1 text-orange-100">Pending {pending.length}</span>
                        <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">Ready {queue.length}</span>
                        {assigned.length ? (
                            <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-violet-100">Assigned {assigned.length}</span>
                        ) : null}
                    </div>
                </div>
            </div>
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
