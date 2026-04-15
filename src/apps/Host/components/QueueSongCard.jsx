import React, { useState } from 'react';
import { doc, deleteDoc, db } from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { normalizeBackingChoice, isQueueEntryPlayable } from '../../../lib/playbackSource';
import { isAudienceSelectedUnverifiedResolution } from '../../../lib/requestModes';

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
    onApproveAudienceBacking,
    onAvoidAudienceBacking,
    backingDecisionBusyKey = '',
    statusPill,
    styles,
    compactViewport = false,
    runOfShowAssignableSlots = [],
    onAssignQueueSongToRunOfShowItem
}) => {
    const [selectedRunOfShowSlotId, setSelectedRunOfShowSlotId] = useState('');
    const queueBacking = normalizeBackingChoice({
        mediaUrl: song.mediaUrl,
        appleMusicId: song.appleMusicId
    });
    const queueMediaUrl = queueBacking.mediaUrl;
    const queueUsesAppleBacking = queueBacking.usesAppleBacking;
    const queueIsYouTube = queueBacking.isYouTube;
    const queuePlaybackReady = isQueueEntryPlayable(song);
    const queueUsesExternalWindow = !!song?.backingAudioOnly && !!queueMediaUrl;
    const songStatus = String(song?.status || '').trim().toLowerCase();
    const isAudienceSelectedUnverified = isAudienceSelectedUnverifiedResolution(song?.resolutionStatus);
    const backingDecisionBusy = String(backingDecisionBusyKey || '').startsWith(`${song.id}:`);
    const isAssignedToRunOfShow = songStatus === 'assigned';
    const assignedRunOfShowSlot = runOfShowAssignableSlots.find((slot) => slot.id === String(song?.runOfShowItemId || '').trim()) || null;
    const hasTimedLyrics = Array.isArray(song?.lyricsTimed) && song.lyricsTimed.length > 0;
    const hasLyrics = !!String(song?.lyrics || '').trim();
    const lyricsStatus = String(song?.lyricsGenerationStatus || '').trim().toLowerCase();
    const lyricsResolution = String(song?.lyricsGenerationResolution || '').trim();
    const nextRunOfShowSlotId = runOfShowAssignableSlots.some((slot) => slot.id === selectedRunOfShowSlotId)
        ? selectedRunOfShowSlotId
        : String(song?.runOfShowItemId || runOfShowAssignableSlots?.[0]?.id || '').trim();
    let lyricsChipLabel = 'No Lyrics';
    let lyricsChipTone = '';
    let lyricsSupportText = '';
    if (lyricsStatus === 'pending') {
        lyricsChipLabel = 'Lyrics Pending';
        lyricsChipTone = ' border-cyan-300/40 text-cyan-100 bg-cyan-500/10';
    } else if (lyricsStatus === 'resolved') {
        lyricsChipLabel = hasTimedLyrics ? 'Timed' : 'Lyrics';
        lyricsChipTone = hasTimedLyrics
            ? ' border-emerald-300/40 text-emerald-100 bg-emerald-500/10'
            : ' border-sky-300/40 text-sky-100 bg-sky-500/10';
    } else if (lyricsStatus === 'needs_user_token') {
        lyricsChipLabel = 'Apple Auth';
        lyricsChipTone = ' border-amber-300/45 text-amber-100 bg-amber-500/10';
        lyricsSupportText = 'Authorize Apple Music to pull synced lyrics.';
    } else if (lyricsStatus === 'capability_blocked') {
        lyricsChipLabel = 'Blocked';
        lyricsChipTone = ' border-rose-300/45 text-rose-100 bg-rose-500/10';
        lyricsSupportText = 'Lyrics fallback is currently blocked.';
    } else if (lyricsStatus === 'error') {
        lyricsChipLabel = 'Error';
        lyricsChipTone = ' border-rose-300/45 text-rose-100 bg-rose-500/10';
        lyricsSupportText = 'Open edit to retry or fetch timed lyrics.';
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
    const showSupportText = isAssignedToRunOfShow
        || queueUsesExternalWindow
        || isAudienceSelectedUnverified
        || ['needs_user_token', 'capability_blocked', 'error'].includes(lyricsStatus);

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
            className={`bg-zinc-900/50 ${compactViewport ? 'p-1.5 rounded-lg' : 'p-1.5 rounded-xl'} border ${dragOverId === song.id ? 'border-[#00C4D9]' : 'border-white/5'}`}
        >
            <div className={`flex items-start justify-between ${compactViewport ? 'gap-1.5' : 'gap-2'}`}>
                <div className={`min-w-0 flex items-start ${compactViewport ? 'gap-1.5' : 'gap-2'}`}>
                    <span className={`font-mono text-zinc-500 text-center text-[11px] ${compactViewport ? 'w-4 mt-0.5' : 'w-5 mt-0.5'}`}>{index + 1}</span>
                    <button
                        type="button"
                        data-queue-drag-handle="true"
                        className={`inline-flex items-center justify-center rounded-md border border-white/10 bg-black/20 text-zinc-500 transition hover:text-zinc-300 ${compactViewport ? 'min-h-[24px] min-w-[24px]' : 'min-h-[26px] min-w-[26px]'}`}
                        title={touchReorderEnabled ? 'Press and drag to reorder the queue' : 'Drag to reorder the queue'}
                        aria-label="Reorder queue item"
                        style={touchReorderEnabled ? { touchAction: 'none' } : undefined}
                    >
                        <i className="fa-solid fa-grip-lines text-xs"></i>
                    </button>
                    {song.albumArtUrl && <img src={song.albumArtUrl} className={`${compactViewport ? 'w-7 h-7' : 'w-7 h-7'} rounded-lg shadow-sm mt-0.5`}/>}
                    <div className="min-w-0">
                        <div className={`font-bold text-white truncate ${compactViewport ? 'text-[13px] leading-tight' : 'text-[13px] leading-tight'}`}>{song.songTitle}</div>
                        <div className={`text-zinc-400 truncate ${compactViewport ? 'text-[11px] leading-tight' : 'text-[11px] leading-tight'}`}>{song.singerName}</div>
                        <div className={`mt-1 flex flex-wrap gap-1 text-[10px] uppercase ${compactViewport ? 'tracking-[0.12em]' : 'tracking-[0.14em]'}`}>
                            {queueUsesAppleBacking ? (
                                <span className={statusPill}><i className="fa-brands fa-apple mr-1"></i>Apple</span>
                            ) : queueMediaUrl ? (
                                <span className={statusPill}>
                                    <i className={`fa-solid ${queueUsesExternalWindow ? 'fa-up-right-from-square' : (queueIsYouTube ? 'fa-video' : 'fa-file-audio')} mr-1`}></i>
                                    {queueIsYouTube ? 'YouTube' : 'Custom'}
                                </span>
                            ) : (
                                <span className={`${statusPill}${queuePlaybackReady ? '' : ' border-amber-300/45 text-amber-100 bg-amber-500/10'}`}>
                                    <i className={`fa-solid ${queuePlaybackReady ? 'fa-file-audio' : 'fa-triangle-exclamation'} mr-1`}></i>
                                    {queuePlaybackReady ? 'No Track' : 'Backing'}
                                </span>
                            )}
                            {queueUsesExternalWindow ? (
                                <span className={`${statusPill} border-orange-300/40 text-orange-100 bg-orange-500/10`}>
                                    <i className="fa-solid fa-window-restore mr-1"></i>
                                    Popup
                                </span>
                            ) : null}
                            <span className={`${statusPill}${lyricsChipTone}`} title={lyricsResolution || 'lyrics status'}>
                                <i className={`fa-solid ${
                                    hasTimedLyrics
                                        ? 'fa-clock'
                                        : (hasLyrics ? 'fa-closed-captioning' : 'fa-comment-slash')
                                } mr-1`}></i>
                                {lyricsChipLabel}
                            </span>
                            {isAssignedToRunOfShow ? (
                                <span className={`${statusPill} border-violet-300/40 text-violet-100 bg-violet-500/10`}>
                                    <i className="fa-solid fa-link mr-1"></i>
                                    Assigned
                                </span>
                            ) : null}
                            {isAudienceSelectedUnverified ? (
                                <span className={`${statusPill} border-cyan-300/40 text-cyan-100 bg-cyan-500/10`}>
                                    <i className="fa-solid fa-circle-question mr-1"></i>
                                    Host Check
                                </span>
                            ) : null}
                        </div>
                        {showSupportText ? (
                            <div className={`mt-1 text-zinc-500 ${compactViewport ? 'text-[10px] leading-tight' : 'text-[10px] leading-tight'}`}>
                                {isAssignedToRunOfShow
                                    ? `Reserved for ${assignedRunOfShowSlot?.label || 'a run of show slot'}.`
                                    : queueUsesExternalWindow
                                        ? 'This backing opens in a separate window instead of the TV embed.'
                                    : isAudienceSelectedUnverified
                                        ? 'Guest-picked backing. Keep it or send it back to review.'
                                        : lyricsSupportText}
                            </div>
                        ) : null}
                        {isAudienceSelectedUnverified && (typeof onApproveAudienceBacking === 'function' || typeof onAvoidAudienceBacking === 'function') ? (
                            <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 ${compactViewport ? 'text-[10px]' : 'text-[11px]'}`}>
                                {typeof onApproveAudienceBacking === 'function' ? (
                                    <button
                                        type="button"
                                        disabled={backingDecisionBusy}
                                        onClick={() => onApproveAudienceBacking(song)}
                                        className={`${styles.btnStd} ${styles.btnHighlight} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2.5 py-1 text-[10px] min-h-[28px]'} ${backingDecisionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        <i className="fa-solid fa-thumbs-up mr-1"></i>Use This
                                    </button>
                                ) : null}
                                {typeof onAvoidAudienceBacking === 'function' ? (
                                    <button
                                        type="button"
                                        disabled={backingDecisionBusy}
                                        onClick={() => onAvoidAudienceBacking(song)}
                                        className={`${styles.btnStd} ${styles.btnSecondary} border-rose-300/40 bg-rose-500/10 text-rose-100 hover:border-rose-200/60 ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2.5 py-1 text-[10px] min-h-[28px]'} ${backingDecisionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        <i className="fa-solid fa-thumbs-down mr-1"></i>Avoid This
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                        {typeof onAssignQueueSongToRunOfShowItem === 'function' && runOfShowAssignableSlots.length ? (
                            <div className={`mt-1.5 flex flex-wrap items-center gap-1.5 ${compactViewport ? 'text-[10px]' : 'text-[11px]'}`}>
                                <select
                                    value={nextRunOfShowSlotId}
                                    onChange={(event) => setSelectedRunOfShowSlotId(event.target.value)}
                                    className={`min-w-[150px] rounded-lg border border-white/10 bg-black/35 text-white outline-none ${compactViewport ? 'px-2 py-1 text-[10px]' : 'px-2 py-1 text-[10px]'}`}
                                >
                                    {runOfShowAssignableSlots.map((slot) => (
                                        <option key={slot.id} value={slot.id}>
                                            {slot.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    disabled={!nextRunOfShowSlotId}
                                    onClick={() => onAssignQueueSongToRunOfShowItem(song.id, nextRunOfShowSlotId)}
                                    className={`${styles.btnStd} ${styles.btnNeutral} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2 py-1 text-[10px] min-h-[24px]'}`}
                                >
                                    <i className="fa-solid fa-link mr-1"></i>{isAssignedToRunOfShow ? 'Reassign Slot' : 'Assign Slot'}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="shrink-0 min-w-[88px]">
                    <div className="flex flex-col gap-1">
                        <button
                            title="Start performance"
                            onClick={() => updateStatus(song.id, 'performing')}
                            className={`${styles.btnStd} ${styles.btnPrimary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2 py-1 text-[10px] min-h-[24px]'} justify-start`}
                        >
                            <i className="fa-solid fa-play mr-1.5"></i>Start
                        </button>
                        <button
                            title="Edit queue item"
                            onClick={() => startEdit(song)}
                            className={`${styles.btnStd} ${styles.btnSecondary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2 py-1 text-[10px] min-h-[24px]'} justify-start`}
                        >
                            <i className="fa-solid fa-pen-to-square mr-1.5"></i>Edit
                        </button>
                        <button
                            title="Delete queue item"
                            onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', song.id))}
                            className={`${styles.btnStd} ${styles.btnDanger} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px]' : 'px-2 py-1 text-[10px] min-h-[24px]'} justify-start`}
                        >
                            <i className="fa-solid fa-trash mr-1.5"></i>Remove
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QueueSongCard;
