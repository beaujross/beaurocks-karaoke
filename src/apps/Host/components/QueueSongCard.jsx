import React from 'react';
import { normalizeBackingChoice, isQueueEntryPlayable } from '../../../lib/playbackSource';
import { isAudienceSelectedUnverifiedResolution, requiresBackingHostReview } from '../../../lib/requestModes';

const buildQueueSongLabel = (song = {}) => {
    const singerName = String(song?.singerName || '').trim();
    const songTitle = String(song?.songTitle || '').trim();
    if (singerName && songTitle) return `${singerName} - ${songTitle}`;
    return singerName || songTitle || 'Queue item';
};

const QueueSongCard = ({
    song,
    index,
    dragQueueId,
    dragOverId,
    setDragQueueId,
    setDragOverId,
    reorderQueue,
    touchReorderEnabled = false,
    touchReorderMode = false,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    updateStatus,
    startEdit,
    onApproveAudienceBacking,
    onAvoidAudienceBacking,
    onMoveNext,
    onHoldSinger,
    onRestoreSinger,
    onRemove,
    backingDecisionBusyKey = '',
    statusPill,
    styles,
    compactViewport = false,
    selected = false,
    onSelect,
    runOfShowAssignableSlots = [],
    runOfShowOpenSlots = [],
    onAssignQueueSongToRunOfShowItem,
    onAssignQueueSongToNextOpenRunOfShowSlot,
    onApprovePending,
    onDeletePending
}) => {
    const [selectedSlotId, setSelectedSlotId] = React.useState('');
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
    const isHeld = songStatus === 'held';
    const needsTrackReview = ['requested', 'pending'].includes(songStatus) && requiresBackingHostReview(song?.resolutionStatus);
    const isPendingApproval = songStatus === 'pending' && !needsTrackReview;
    const isAudienceSelectedUnverified = isAudienceSelectedUnverifiedResolution(song?.resolutionStatus);
    const backingDecisionBusy = String(backingDecisionBusyKey || '').startsWith(`${song.id}:`);
    const isAssignedToRunOfShow = songStatus === 'assigned';
    const assignedRunOfShowSlot = runOfShowAssignableSlots.find((slot) => slot.id === String(song?.runOfShowItemId || '').trim()) || null;
    const nextOpenSlot = runOfShowOpenSlots[0] || null;
    const hasTimedLyrics = Array.isArray(song?.lyricsTimed) && song.lyricsTimed.length > 0;
    const hasLyrics = !!String(song?.lyrics || '').trim();
    const lyricsStatus = String(song?.lyricsGenerationStatus || '').trim().toLowerCase();
    const lyricsResolution = String(song?.lyricsGenerationResolution || '').trim();
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
        || isHeld
        || queueUsesExternalWindow
        || isAudienceSelectedUnverified
        || ['needs_user_token', 'capability_blocked', 'error'].includes(lyricsStatus);
    const showCompactActionRail = !compactViewport || !touchReorderMode;
    const canFastAssignToOpenSlot = !isHeld && !needsTrackReview && !isPendingApproval && !isAssignedToRunOfShow
        && typeof onAssignQueueSongToNextOpenRunOfShowSlot === 'function'
        && !!nextOpenSlot?.id;

    React.useEffect(() => {
        if (!song?.id) {
            setSelectedSlotId('');
            return;
        }
        const fallbackSlotId = String(song?.runOfShowItemId || runOfShowOpenSlots?.[0]?.id || runOfShowAssignableSlots?.[0]?.id || '').trim();
        setSelectedSlotId(fallbackSlotId);
    }, [runOfShowAssignableSlots, runOfShowOpenSlots, song?.id, song?.runOfShowItemId]);

    return (
        <div
            data-queue-id={song.id}
            draggable={!touchReorderEnabled && !isHeld}
            onDragStart={() => setDragQueueId(song.id)}
            onDragEnd={() => { setDragQueueId(null); setDragOverId(null); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(song.id); }}
            onDrop={() => { reorderQueue(dragQueueId, song.id); setDragQueueId(null); setDragOverId(null); }}
            onTouchStart={(event) => handleTouchStart(song.id, event)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className={`bg-zinc-900/50 ${compactViewport ? 'p-1.5 rounded-lg' : 'p-1.5 rounded-xl'} border ${selected ? 'border-cyan-300/40 bg-cyan-500/[0.08]' : dragOverId === song.id ? 'border-[#00C4D9]' : 'border-white/5'}`}
        >
            <div className={`flex ${compactViewport ? 'flex-col gap-2' : 'items-start justify-between gap-2'}`}>
                <button
                    type="button"
                    onClick={() => onSelect?.(song)}
                    className={`min-w-0 flex flex-1 items-start text-left ${compactViewport ? 'gap-1.5' : 'gap-2'}`}
                >
                    <span className={`font-mono text-zinc-500 text-center text-[11px] ${compactViewport ? 'w-4 mt-0.5' : 'w-5 mt-0.5'}`}>{index + 1}</span>
                    <span
                        data-queue-drag-handle="true"
                        className={`inline-flex items-center justify-center rounded-md border transition hover:text-zinc-300 ${
                            touchReorderMode
                                ? 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
                                : 'border-white/10 bg-black/20 text-zinc-500'
                        } ${compactViewport ? 'min-h-[24px] min-w-[24px]' : 'min-h-[26px] min-w-[26px]'}`}
                        title={touchReorderEnabled ? 'Press and drag to reorder the queue' : 'Drag to reorder the queue'}
                        aria-label="Reorder queue item"
                        style={touchReorderEnabled ? { touchAction: 'none' } : undefined}
                    >
                        <i className="fa-solid fa-grip-lines text-xs"></i>
                    </span>
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
                                    Not Embeddable
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
                            {isHeld ? (
                                <span className={`${statusPill} border-zinc-300/35 text-zinc-100 bg-zinc-500/10`}>
                                    <i className="fa-solid fa-pause mr-1"></i>
                                    Held
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
                                    : isHeld
                                        ? `Held: ${String(song?.holdReason || 'not_here').replace(/_/g, ' ')}. Restore when the singer is ready.`
                                    : queueUsesExternalWindow
                                        ? 'YouTube does not allow this backing to run inside the TV embed, so it opens in a separate host window.'
                                        : isAudienceSelectedUnverified
                                            ? 'Guest-picked backing is ready, with optional host review.'
                                            : lyricsSupportText}
                            </div>
                        ) : null}
                        {isAudienceSelectedUnverified && (typeof onApproveAudienceBacking === 'function' || typeof onAvoidAudienceBacking === 'function') ? (
                            <div className="mt-1.5 inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-cyan-300/20 bg-black/25 px-1.5 py-1">
                                <span className="px-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-100">
                                    Track check
                                </span>
                                {typeof onApproveAudienceBacking === 'function' ? (
                                    <button
                                        type="button"
                                        disabled={backingDecisionBusy}
                                        onClick={() => onApproveAudienceBacking(song)}
                                        className={`inline-flex min-h-[24px] items-center gap-1 rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:border-emerald-200/60 ${backingDecisionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        <i className="fa-solid fa-check"></i>Keep
                                    </button>
                                ) : null}
                                {typeof onAvoidAudienceBacking === 'function' ? (
                                    <button
                                        type="button"
                                        disabled={backingDecisionBusy}
                                        onClick={() => onAvoidAudienceBacking(song)}
                                        className={`inline-flex min-h-[24px] items-center gap-1 rounded-lg border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-200/60 ${backingDecisionBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        <i className="fa-solid fa-rotate-left"></i>Review
                                    </button>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </button>
                {showCompactActionRail ? (
                    <div className={`${compactViewport ? 'w-full' : 'shrink-0 min-w-[88px]'}`}>
                        <div className={`${compactViewport ? 'grid grid-cols-3 gap-1' : 'flex flex-col gap-1'}`}>
                            {isHeld ? (
                                <button
                                    type="button"
                                    title="Restore singer to the lineup"
                                    onClick={() => {
                                        onRestoreSinger?.(song.id);
                                    }}
                                    className={`${styles.btnStd} ${styles.btnPrimary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-rotate-left mr-1.5"></i>Restore
                                </button>
                            ) : needsTrackReview ? (
                                <button
                                    type="button"
                                    title="Pick or review the backing for this request"
                                    onClick={() => onSelect?.(song)}
                                    className={`${styles.btnStd} ${styles.btnPrimary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-wand-magic-sparkles mr-1.5"></i>Review
                                </button>
                            ) : isPendingApproval ? (
                                <button
                                    type="button"
                                    title="Approve this request into the ready queue"
                                    onClick={() => onApprovePending?.(song.id)}
                                    className={`${styles.btnStd} ${styles.btnPrimary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-check mr-1.5"></i>Approve
                                </button>
                            ) : isAssignedToRunOfShow ? (
                                <button
                                    type="button"
                                    title="Inspect this run-of-show-linked song"
                                    onClick={() => onSelect?.(song)}
                                    className={`${styles.btnStd} ${styles.btnPrimary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-link mr-1.5"></i>Linked
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    title="Start performance"
                                    onClick={() => {
                                        updateStatus(song.id, 'performing');
                                    }}
                                    className={`${styles.btnStd} ${styles.btnPrimary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-play mr-1.5"></i>Start
                                </button>
                            )}
                            {!isHeld && !needsTrackReview && !isPendingApproval && !isAssignedToRunOfShow && typeof onMoveNext === 'function' ? (
                                <button
                                    type="button"
                                    title="Move this singer next"
                                    onClick={() => {
                                        onMoveNext(song.id);
                                    }}
                                    className={`${styles.btnStd} ${styles.btnNeutral} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-arrow-up mr-1.5"></i>Next
                                </button>
                            ) : isPendingApproval ? (
                                <button
                                    type="button"
                                    title="Remove this pending request"
                                    onClick={() => onDeletePending?.(song.id)}
                                    className={`${styles.btnStd} ${styles.btnNeutral} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-xmark mr-1.5"></i>Remove
                                </button>
                            ) : null}
                            <button
                                type="button"
                                title={selected ? 'Hide queue item actions' : 'Show queue item actions'}
                                onClick={() => onSelect?.(song)}
                                className={`${styles.btnStd} ${styles.btnSecondary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                            >
                                <i className={`fa-solid ${selected ? 'fa-chevron-up' : 'fa-sliders'} mr-1.5`}></i>{selected ? 'Less' : 'More'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="w-full rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                        Drag this card with the handle to reorder the live queue.
                    </div>
                )}
            </div>
            {selected ? (
                <div className="mt-2 rounded-xl border border-cyan-300/18 bg-black/25 px-3 py-3" data-feature-id="queue-song-inline-actions">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">Queue Actions</div>
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
                                onClick={() => startEdit?.(song)}
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
                        ) : isAssignedToRunOfShow ? (
                            <button
                                type="button"
                                onClick={() => startEdit?.(song)}
                                className={`${styles.btnStd} ${styles.btnPrimary} min-h-[40px] text-[11px]`}
                            >
                                Edit Linked Song
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => updateStatus(song.id, 'performing')}
                                className={`${styles.btnStd} ${styles.btnPrimary} min-h-[40px] text-[11px]`}
                            >
                                Start Singer
                            </button>
                        )}
                        {!isHeld && !needsTrackReview && !isPendingApproval && !isAssignedToRunOfShow ? (
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
                            onClick={() => startEdit?.(song)}
                            className={`${styles.btnStd} ${styles.btnSecondary} min-h-[40px] text-[11px]`}
                        >
                            Edit Details
                        </button>
                        {!isHeld && !needsTrackReview && !isPendingApproval && !isAssignedToRunOfShow ? (
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

                    {((typeof onAssignQueueSongToRunOfShowItem === 'function' && runOfShowAssignableSlots.length) || canFastAssignToOpenSlot) && !isHeld && !needsTrackReview && !isPendingApproval ? (
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
                                            : 'Assign To Next Open Slot'}
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
                            {assignedRunOfShowSlot ? (
                                <div className="mt-2 text-xs text-zinc-400">Selected slot: {assignedRunOfShowSlot.label}</div>
                            ) : selectedSlotId ? (
                                <div className="mt-2 text-xs text-zinc-400">
                                    Selected slot: {runOfShowAssignableSlots.find((slot) => slot.id === selectedSlotId)?.label || selectedSlotId}
                                </div>
                            ) : canFastAssignToOpenSlot ? (
                                <div className="mt-2 text-xs text-zinc-400">Open slot: {nextOpenSlot.label}</div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

export default QueueSongCard;
