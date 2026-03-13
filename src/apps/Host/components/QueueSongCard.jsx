import React from 'react';
import { doc, deleteDoc, db } from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { normalizeBackingChoice, isQueueEntryPlayable } from '../../../lib/playbackSource';

const QueueSongCard = ({
    song,
    index,
    dragQueueId,
    dragOverId,
    setDragQueueId,
    setDragOverId,
    reorderQueue,
    touchReorderEnabled = false,
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
    const queueBacking = normalizeBackingChoice({
        mediaUrl: song.mediaUrl,
        appleMusicId: song.appleMusicId
    });
    const queueMediaUrl = queueBacking.mediaUrl;
    const queueUsesAppleBacking = queueBacking.usesAppleBacking;
    const queueIsYouTube = queueBacking.isYouTube;
    const queuePlaybackReady = isQueueEntryPlayable(song);
    const hasTimedLyrics = Array.isArray(song?.lyricsTimed) && song.lyricsTimed.length > 0;
    const hasLyrics = !!String(song?.lyrics || '').trim();
    const lyricsStatus = String(song?.lyricsGenerationStatus || '').trim().toLowerCase();
    const lyricsResolution = String(song?.lyricsGenerationResolution || '').trim();
    let lyricsChipLabel = 'No Lyrics';
    let lyricsChipTone = '';
    if (lyricsStatus === 'pending') {
        lyricsChipLabel = 'Lyrics: Pending';
        lyricsChipTone = ' border-cyan-300/40 text-cyan-100 bg-cyan-500/10';
    } else if (lyricsStatus === 'resolved') {
        lyricsChipLabel = hasTimedLyrics ? 'Timed' : 'Lyrics';
        lyricsChipTone = hasTimedLyrics
            ? ' border-emerald-300/40 text-emerald-100 bg-emerald-500/10'
            : ' border-sky-300/40 text-sky-100 bg-sky-500/10';
    } else if (lyricsStatus === 'needs_user_token') {
        lyricsChipLabel = 'Needs Apple Auth';
        lyricsChipTone = ' border-amber-300/45 text-amber-100 bg-amber-500/10';
    } else if (lyricsStatus === 'capability_blocked') {
        lyricsChipLabel = 'Capability Blocked';
        lyricsChipTone = ' border-rose-300/45 text-rose-100 bg-rose-500/10';
    } else if (lyricsStatus === 'error') {
        lyricsChipLabel = 'Error';
        lyricsChipTone = ' border-rose-300/45 text-rose-100 bg-rose-500/10';
    } else if (lyricsStatus === 'no_match') {
        lyricsChipLabel = 'No Match';
        lyricsChipTone = ' border-zinc-500/45 text-zinc-300 bg-zinc-800/40';
    } else if (lyricsStatus === 'disabled') {
        lyricsChipLabel = 'Disabled';
        lyricsChipTone = ' border-zinc-500/45 text-zinc-300 bg-zinc-800/40';
    } else if (hasTimedLyrics) {
        lyricsChipLabel = 'Timed';
        lyricsChipTone = ' border-emerald-300/40 text-emerald-100 bg-emerald-500/10';
    } else if (hasLyrics) {
        lyricsChipLabel = 'Lyrics';
        lyricsChipTone = ' border-sky-300/40 text-sky-100 bg-sky-500/10';
    }

    return (
        <div
            data-queue-id={song.id}
            draggable={!touchReorderEnabled}
            onDragStart={() => setDragQueueId(song.id)}
            onDragEnd={() => { setDragQueueId(null); setDragOverId(null); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(song.id); }}
            onDrop={() => { reorderQueue(dragQueueId, song.id); setDragQueueId(null); setDragOverId(null); }}
            onTouchStart={(event) => handleTouchStart(song.id, event)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className={`bg-zinc-900/50 ${compactViewport ? 'p-1.5 rounded-md' : 'p-2 rounded-lg'} border ${dragOverId === song.id ? 'border-[#00C4D9]' : 'border-white/5'}`}
        >
            <div className={`flex items-start justify-between ${compactViewport ? 'gap-1.5' : 'gap-2'}`}>
                <div className={`min-w-0 flex items-start ${compactViewport ? 'gap-1.5' : 'gap-2'}`}>
                    <span className={`font-mono text-zinc-500 text-center text-xs ${compactViewport ? 'w-4 mt-0.5' : 'w-5 mt-1'}`}>{index + 1}</span>
                    <button
                        type="button"
                        data-queue-drag-handle="true"
                        className={`inline-flex items-center justify-center rounded-md border border-white/10 bg-black/20 text-zinc-500 transition hover:text-zinc-300 ${compactViewport ? 'min-h-[24px] min-w-[24px]' : 'min-h-[28px] min-w-[28px]'}`}
                        title={touchReorderEnabled ? 'Press and drag to reorder the queue' : 'Drag to reorder the queue'}
                        aria-label="Reorder queue item"
                        style={touchReorderEnabled ? { touchAction: 'none' } : undefined}
                    >
                        <i className="fa-solid fa-grip-lines text-xs"></i>
                    </button>
                    {song.albumArtUrl && <img src={song.albumArtUrl} className={`${compactViewport ? 'w-7 h-7' : 'w-8 h-8'} rounded shadow-sm mt-0.5`}/>}
                    <div className="min-w-0">
                        <div className={`font-bold text-white truncate ${compactViewport ? 'text-[13px] leading-tight' : 'text-sm'}`}>{song.songTitle}</div>
                        <div className={`text-zinc-400 truncate ${compactViewport ? 'text-[11px] leading-tight' : 'text-xs'}`}>{song.singerName}</div>
                        <div className={`mt-1 flex flex-wrap gap-1 text-[10px] uppercase ${compactViewport ? 'tracking-[0.12em]' : 'tracking-widest'}`}>
                            {queueUsesAppleBacking ? (
                                <span className={statusPill}><i className="fa-brands fa-apple mr-1"></i>Apple</span>
                            ) : queueMediaUrl ? (
                                <span className={statusPill}>
                                    <i className={`fa-solid ${queueIsYouTube ? 'fa-video' : 'fa-file-audio'} mr-1`}></i>
                                    {queueIsYouTube ? 'YouTube' : 'Custom'}
                                </span>
                            ) : (
                                <span className={`${statusPill}${queuePlaybackReady ? '' : ' border-amber-300/45 text-amber-100 bg-amber-500/10'}`}>
                                    <i className={`fa-solid ${queuePlaybackReady ? 'fa-file-audio' : 'fa-triangle-exclamation'} mr-1`}></i>
                                    {queuePlaybackReady ? 'No Track' : 'Needs Backing'}
                                </span>
                            )}
                            <span className={`${statusPill}${lyricsChipTone}`} title={lyricsResolution || 'lyrics status'}>
                                <i className={`fa-solid ${
                                    hasTimedLyrics
                                        ? 'fa-clock'
                                        : (hasLyrics ? 'fa-closed-captioning' : 'fa-comment-slash')
                                } mr-1`}></i>
                                {lyricsChipLabel}
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`shrink-0 ${compactViewport ? 'flex items-center gap-1' : 'flex flex-col items-end gap-1'}`}>
                    <div className="flex items-center gap-1">
                        <button onClick={() => updateStatus(song.id, 'performing')} className={`${styles.btnStd} ${styles.btnPrimary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2 py-1 text-[10px] min-h-[28px]'}`}>
                            <i className="fa-solid fa-play mr-1"></i>Play
                        </button>
                        <button onClick={() => startEdit(song)} className={`${styles.btnStd} ${styles.btnSecondary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2 py-1 text-[10px] min-h-[28px]'}`}>
                            <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', song.id))} className={`${styles.btnStd} ${styles.btnDanger} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2 py-1 text-[10px] min-h-[28px]'}`}>
                            <i className="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    {!compactViewport && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onRetryLyrics?.(song)}
                                className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1 text-[10px] min-h-[26px]`}
                                title="Retry lyrics resolution"
                            >
                                Retry Lyrics
                            </button>
                            <button
                                onClick={() => onFetchTimedLyrics?.(song)}
                                className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1 text-[10px] min-h-[26px]`}
                                title="Fetch timed lyrics only"
                            >
                                Fetch Timed
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {compactViewport && (
                <div className="mt-1 flex items-center gap-1">
                    <button
                        onClick={() => onRetryLyrics?.(song)}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1 text-[10px] min-h-[22px]`}
                        title="Retry lyrics resolution"
                    >
                        Retry Lyrics
                    </button>
                    <button
                        onClick={() => onFetchTimedLyrics?.(song)}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1 text-[10px] min-h-[22px]`}
                        title="Fetch timed lyrics only"
                    >
                        Fetch Timed
                    </button>
                </div>
            )}
        </div>
    );
};

export default QueueSongCard;
