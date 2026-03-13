import React from 'react';
import QueueSongCard from './QueueSongCard';

const QueueListPanel = ({
    showQueueList,
    pending,
    queue,
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
    statusPill,
    styles,
    compactViewport = false
}) => {
    if (!showQueueList) return null;

    return (
        <>
            <div className={`sticky top-0 z-10 mb-2 rounded-xl border border-white/10 bg-zinc-950/92 backdrop-blur px-3 ${compactViewport ? 'py-2' : 'py-2.5'}`}>
                <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-200">Queue Monitor</div>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em]">
                        <span className="rounded-full border border-orange-300/30 bg-orange-500/10 px-2 py-1 text-orange-100">Pending {pending.length}</span>
                        <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">Ready {queue.length}</span>
                    </div>
                </div>
            </div>
            {pending.length > 0 && (
                <div className={`mb-3 border-b border-white/10 ${compactViewport ? 'pb-1.5' : 'pb-2'}`}>
                    <div className="text-sm text-orange-400 font-bold mb-2 uppercase">Pending ({pending.length})</div>
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
                </div>
            )}
            {pending.length === 0 && (
                <div className="host-search-helper text-center py-2 text-zinc-500 text-xs uppercase tracking-widest">
                    No pending songs
                </div>
            )}
            {queue.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 mb-2">
                    <div className="text-sm font-semibold text-white">Queue is empty</div>
                    <div className="text-xs text-zinc-400 mt-1">Add songs in Add to Queue to keep karaoke moving.</div>
                </div>
            )}
            {queue.map((s, i) => (
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
                    statusPill={statusPill}
                    styles={styles}
                    compactViewport={compactViewport}
                />
            ))}
        </>
    );
};

export default QueueListPanel;
