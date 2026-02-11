import React from 'react';
import { doc, deleteDoc, db } from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { normalizeBackingChoice } from '../../../lib/playbackSource';

const QueueSongCard = ({
    song,
    index,
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
    const queueBacking = normalizeBackingChoice({
        mediaUrl: song.mediaUrl,
        appleMusicId: song.appleMusicId
    });
    const queueMediaUrl = queueBacking.mediaUrl;
    const queueUsesAppleBacking = queueBacking.usesAppleBacking;
    const queueIsYouTube = queueBacking.isYouTube;

    return (
        <div
            data-queue-id={song.id}
            draggable
            onDragStart={() => setDragQueueId(song.id)}
            onDragEnd={() => { setDragQueueId(null); setDragOverId(null); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(song.id); }}
            onDrop={() => { reorderQueue(dragQueueId, song.id); setDragQueueId(null); setDragOverId(null); }}
            onTouchStart={() => handleTouchStart(song.id)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`bg-zinc-900/50 p-2 rounded-lg border ${dragOverId === song.id ? 'border-[#00C4D9]' : 'border-white/5'}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex items-start gap-2">
                    <span className="font-mono text-zinc-500 w-5 text-center text-xs mt-1">{index + 1}</span>
                    <i className="fa-solid fa-grip-lines text-zinc-600 text-xs mt-1.5"></i>
                    {song.albumArtUrl && <img src={song.albumArtUrl} className="w-8 h-8 rounded shadow-sm mt-0.5"/>}
                    <div className="min-w-0">
                        <div className="font-bold text-white text-sm truncate">{song.songTitle}</div>
                        <div className="text-xs text-zinc-400 truncate">{song.singerName}</div>
                        <div className="mt-1 flex flex-wrap gap-1 text-[10px] uppercase tracking-widest">
                            {queueUsesAppleBacking ? (
                                <span className={statusPill}><i className="fa-brands fa-apple mr-1"></i>Apple</span>
                            ) : queueMediaUrl ? (
                                <span className={statusPill}>
                                    <i className={`fa-solid ${queueIsYouTube ? 'fa-video' : 'fa-file-audio'} mr-1`}></i>
                                    {queueIsYouTube ? 'YouTube' : 'Custom'}
                                </span>
                            ) : (
                                <span className={statusPill}><i className="fa-solid fa-file-audio mr-1"></i>No Track</span>
                            )}
                            {song.lyricsTimed?.length ? (
                                <span className={statusPill}><i className="fa-solid fa-clock mr-1"></i>Timed</span>
                            ) : song.lyrics ? (
                                <span className={statusPill}><i className="fa-solid fa-closed-captioning mr-1"></i>Lyrics</span>
                            ) : (
                                <span className={statusPill}><i className="fa-solid fa-comment-slash mr-1"></i>No Lyrics</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateStatus(song.id, 'performing')} className={`${styles.btnStd} ${styles.btnPrimary} px-2 py-1 text-[10px] min-h-[28px]`}>
                        <i className="fa-solid fa-play mr-1"></i>Play
                    </button>
                    <button onClick={() => startEdit(song)} className={`${styles.btnStd} ${styles.btnSecondary} px-2 py-1 text-[10px] min-h-[28px]`}>
                        <i className="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', song.id))} className={`${styles.btnStd} ${styles.btnDanger} px-2 py-1 text-[10px] min-h-[28px]`}>
                        <i className="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QueueSongCard;
