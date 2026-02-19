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
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    updateStatus,
    startEdit,
    statusPill,
    styles
}) => {
    if (!showQueueList) return null;

    return (
        <>
            {pending.length > 0 && (
                <div className="mb-4 border-b border-white/10 pb-2">
                    <div className="text-sm text-orange-400 font-bold mb-2 uppercase">PENDING ({pending.length})</div>
                    {pending.map(s => (
                        <div key={s.id} className="bg-orange-950/30 p-2 rounded flex justify-between items-center border border-orange-500/30 mb-2">
                            <div><div className="text-sm font-bold">{s.songTitle}</div><div className="text-sm text-zinc-400">{s.singerName}</div></div>
                            <div className="flex gap-2">
                                <button onClick={() => onApprovePending(s.id)} className={`${styles.btnStd} ${styles.btnSuccess} px-2`}>OK</button>
                                <button onClick={() => onDeletePending(s.id)} className={`${styles.btnStd} ${styles.btnDanger} px-2`}>X</button>
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
                    handleTouchStart={handleTouchStart}
                    handleTouchMove={handleTouchMove}
                    handleTouchEnd={handleTouchEnd}
                    updateStatus={updateStatus}
                    startEdit={startEdit}
                    statusPill={statusPill}
                    styles={styles}
                />
            ))}
        </>
    );
};

export default QueueListPanel;
