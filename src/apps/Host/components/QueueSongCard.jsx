import React from 'react';
import { normalizeBackingChoice, isQueueEntryPlayable } from '../../../lib/playbackSource';
import { isAudienceSelectedUnverifiedResolution, requiresBackingHostReview } from '../../../lib/requestModes';

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
    expandSelectedInline = true,
    inspectorMode = false,
    runOfShowAssignableSlots = [],
    runOfShowOpenSlots = [],
    onAssignQueueSongToRunOfShowItem,
    onAssignQueueSongToNextOpenRunOfShowSlot,
    onApprovePending,
    onDeletePending,
    lockedInLineup = false,
    lineupSlotLabel = '',
    queuePositionLabel = '',
    selfServeState = null,
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
    const selectedExpanded = selected && expandSelectedInline;
    const showCompactActionRail = !touchReorderMode;
    const canFastAssignToOpenSlot = !isHeld && !needsTrackReview && !isPendingApproval && !isAssignedToRunOfShow
        && typeof onAssignQueueSongToNextOpenRunOfShowSlot === 'function'
        && !!nextOpenSlot?.id;
    const canReorderQueueItem = touchReorderMode && !touchReorderEnabled && !isHeld && !lockedInLineup;
    const canPromoteToNext = !lockedInLineup && !isHeld && !needsTrackReview && !isPendingApproval && !isAssignedToRunOfShow && typeof onMoveNext === 'function';
    const canShowSelectedExtras = selectedExpanded && showCompactActionRail;
    const canShowRunOfShowAssignment = selectedExpanded
        && !isHeld
        && !needsTrackReview
        && !isPendingApproval
        && (((typeof onAssignQueueSongToRunOfShowItem === 'function') && runOfShowAssignableSlots.length) || canFastAssignToOpenSlot);
    const selfServeTone = React.useMemo(() => {
        const toneKey = String(selfServeState?.toneKey || '').trim().toLowerCase();
        if (toneKey === 'amber') {
            return {
                panelClass: 'border-amber-300/24 bg-amber-500/[0.06] shadow-[0_0_0_1px_rgba(251,191,36,0.08)]',
                badgeClass: ' border-amber-300/35 text-amber-100 bg-amber-500/10',
                detailClass: 'text-amber-100/85',
            };
        }
        if (toneKey === 'emerald') {
            return {
                panelClass: 'border-emerald-300/24 bg-emerald-500/[0.06] shadow-[0_0_0_1px_rgba(52,211,153,0.08)]',
                badgeClass: ' border-emerald-300/35 text-emerald-100 bg-emerald-500/10',
                detailClass: 'text-emerald-100/85',
            };
        }
        if (toneKey === 'fuchsia') {
            return {
                panelClass: 'border-fuchsia-300/24 bg-fuchsia-500/[0.06] shadow-[0_0_0_1px_rgba(232,121,249,0.08)]',
                badgeClass: ' border-fuchsia-300/35 text-fuchsia-100 bg-fuchsia-500/10',
                detailClass: 'text-fuchsia-100/85',
            };
        }
        return {
            panelClass: 'border-cyan-300/24 bg-cyan-500/[0.06] shadow-[0_0_0_1px_rgba(34,211,238,0.08)]',
            badgeClass: ' border-cyan-300/35 text-cyan-100 bg-cyan-500/10',
            detailClass: 'text-cyan-100/85',
        };
    }, [selfServeState?.toneKey]);
    const displayPositionLabel = String(queuePositionLabel || '').trim() || String(index + 1);
    const isImmediateReady = ['start', 'next'].includes(displayPositionLabel.toLowerCase())
        && !isHeld
        && !needsTrackReview
        && !isPendingApproval
        && !isAssignedToRunOfShow;
    const positionLabelCompact = displayPositionLabel.length <= 2;
    const actionRailContainerClass = selectedExpanded && compactViewport
        ? 'w-full'
        : selectedExpanded
            ? 'shrink-0 min-w-[192px]'
            : 'shrink-0';
    const actionRailLayoutClass = selectedExpanded
        ? (compactViewport ? 'grid grid-cols-3 gap-1' : 'grid grid-cols-2 gap-1')
        : 'flex items-center gap-1';
    const overviewStatus = selfServeState?.badgeLabel
        ? {
            label: selfServeState.badgeLabel,
            icon: selfServeState?.icon || 'fa-sparkles',
            className: selfServeTone.badgeClass,
        }
        : needsTrackReview
            ? { label: 'Track Check', icon: 'fa-wand-magic-sparkles', className: ' border-amber-300/45 text-amber-100 bg-amber-500/10' }
            : isPendingApproval
                ? { label: 'Approve', icon: 'fa-circle-check', className: ' border-orange-300/45 text-orange-100 bg-orange-500/10' }
                : isAssignedToRunOfShow
                    ? { label: 'Planner', icon: 'fa-link', className: ' border-violet-300/40 text-violet-100 bg-violet-500/10' }
                    : isHeld
                        ? { label: 'Held', icon: 'fa-pause', className: ' border-zinc-300/35 text-zinc-100 bg-zinc-500/10' }
                        : lockedInLineup
                            ? { label: lineupSlotLabel || 'Locked', icon: 'fa-lock', className: ' border-emerald-300/40 text-emerald-100 bg-emerald-500/10' }
                            : !queuePlaybackReady
                                ? { label: 'Needs Backing', icon: 'fa-triangle-exclamation', className: ' border-amber-300/45 text-amber-100 bg-amber-500/10' }
                                : ['needs_user_token', 'capability_blocked', 'error'].includes(lyricsStatus)
                                    ? { label: lyricsChipLabel, icon: 'fa-triangle-exclamation', className: lyricsChipTone }
                                    : { label: 'Ready', icon: 'fa-circle-check', className: ' border-cyan-300/35 text-cyan-100 bg-cyan-500/10' };

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
            data-queue-id={inspectorMode ? undefined : song.id}
            data-queue-selected={selected ? 'true' : 'false'}
            data-feature-id={inspectorMode ? 'queue-song-inspector-card' : undefined}
            draggable={!inspectorMode && canReorderQueueItem}
            onDragStart={() => setDragQueueId(song.id)}
            onDragEnd={() => { setDragQueueId(null); setDragOverId(null); }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(song.id); }}
            onDrop={() => { reorderQueue(dragQueueId, song.id); setDragQueueId(null); setDragOverId(null); }}
            onTouchStart={(event) => handleTouchStart(song.id, event)}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className={`bg-zinc-900/50 p-1 ${compactViewport ? 'rounded-lg' : 'rounded-xl'} border ${
                lockedInLineup
                    ? 'border-emerald-300/28 bg-emerald-500/[0.06]'
                    : selected
                        ? 'border-cyan-300/40 bg-cyan-500/[0.08]'
                        : dragOverId === song.id
                            ? 'border-[#00C4D9]'
                            : selfServeState
                                ? selfServeTone.panelClass
                                : 'border-white/5'
            }`}
        >
            <div className={`flex ${compactViewport && selectedExpanded ? 'flex-col gap-2' : 'items-center justify-between gap-2'}`}>
                <button
                    type="button"
                    onClick={() => onSelect?.(song)}
                    className={`min-h-[44px] min-w-0 flex flex-1 items-center text-left ${compactViewport ? 'gap-1.5' : 'gap-2'}`}
                >
                    <span className={`shrink-0 rounded-md border border-white/10 bg-black/20 px-1.5 py-1 text-center font-black uppercase leading-none text-zinc-300 ${positionLabelCompact ? 'min-w-[26px] text-[10px] tracking-[0.12em]' : 'min-w-[42px] text-[9px] tracking-[0.1em]'} ${compactViewport ? 'mt-0.5' : 'mt-0.5'}`}>{displayPositionLabel}</span>
                    {touchReorderMode ? (
                        <span
                            data-queue-drag-handle="true"
                            className={`inline-flex items-center justify-center rounded-md border transition hover:text-zinc-300 ${
                            lockedInLineup
                                ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100'
                                : touchReorderMode
                                ? 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]'
                                : 'border-white/10 bg-black/20 text-zinc-500'
                        } ${compactViewport ? 'min-h-[24px] min-w-[24px]' : 'min-h-[26px] min-w-[26px]'}`}
                        title={lockedInLineup ? `${lineupSlotLabel || 'Locked lineup'} is protected during live operation` : (touchReorderEnabled ? 'Press and drag to reorder the queue' : 'Drag to reorder the queue')}
                        aria-label={lockedInLineup ? 'Locked lineup slot' : 'Reorder queue item'}
                        style={touchReorderEnabled ? { touchAction: 'none' } : undefined}
                    >
                        <i className={`fa-solid ${lockedInLineup ? 'fa-lock' : 'fa-grip-lines'} text-xs`}></i>
                    </span>
                    ) : null}
                    {song.albumArtUrl && (!compactViewport || selectedExpanded) ? <img src={song.albumArtUrl} className="h-7 w-7 rounded-lg shadow-sm"/> : null}
                    <div className="min-w-0">
                        <div className={`font-bold text-white truncate ${compactViewport ? 'text-[13px] leading-tight' : 'text-[13px] leading-tight'}`}>{song.songTitle}</div>
                        <div className={`text-zinc-400 truncate ${compactViewport ? 'text-[11px] leading-tight' : 'text-[11px] leading-tight'}`}>{song.singerName}</div>
                        {selectedExpanded ? (
                        <div className={`mt-1 flex flex-wrap gap-1 text-[10px] uppercase ${compactViewport ? 'tracking-[0.12em]' : 'tracking-[0.14em]'}`}>
                            {selfServeState?.badgeLabel ? (
                                <span className={`${statusPill}${selfServeTone.badgeClass}`}>
                                    <i className={`fa-solid ${selfServeState?.icon || 'fa-sparkles'} mr-1`}></i>
                                    {selfServeState.badgeLabel}
                                </span>
                            ) : null}
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
                            {lockedInLineup ? (
                                <span className={`${statusPill} border-emerald-300/40 text-emerald-100 bg-emerald-500/10`}>
                                    <i className="fa-solid fa-lock mr-1"></i>
                                    {lineupSlotLabel || 'Locked'}
                                </span>
                            ) : null}
                        </div>
                        ) : null}
                        {selfServeState?.detail && selectedExpanded ? (
                            <div className={`mt-1 ${compactViewport ? 'text-[10px] leading-tight' : 'text-[10px] leading-tight'} ${selfServeTone.detailClass}`}>
                                {selfServeState.detail}
                            </div>
                        ) : null}
                        {showSupportText && selectedExpanded ? (
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
                        {lockedInLineup && selectedExpanded ? (
                            <div className={`mt-1 text-zinc-400 ${compactViewport ? 'text-[10px] leading-tight' : 'text-[10px] leading-tight'}`}>
                                Protected next-up slot.
                            </div>
                        ) : null}
                        {selectedExpanded && isAudienceSelectedUnverified && (typeof onApproveAudienceBacking === 'function' || typeof onAvoidAudienceBacking === 'function') ? (
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
                    {!selectedExpanded ? (
                        <span className={`${statusPill}${overviewStatus.className} shrink-0 whitespace-nowrap`}>
                            <i className={`fa-solid ${overviewStatus.icon} mr-1`}></i>
                            {overviewStatus.label}
                        </span>
                    ) : null}
                </button>
                {showCompactActionRail ? (
                    <div className={actionRailContainerClass}>
                        <div className={actionRailLayoutClass}>
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
                            ) : (selectedExpanded || isImmediateReady) ? (
                                <button
                                    type="button"
                                    title="Start performance"
                                    onClick={() => {
                                        updateStatus(song.id, 'performing');
                                    }}
                                    className={`${styles.btnStd} ${styles.btnPrimary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-play mr-1.5"></i>{isImmediateReady ? 'Start Next' : 'Start'}
                                </button>
                            ) : null}
                            {selectedExpanded && canPromoteToNext ? (
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
                                title={selected ? 'Close performance details' : 'Open performance details'}
                                onClick={() => onSelect?.(song)}
                                className={`${styles.btnStd} ${styles.btnSecondary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                            >
                                <i className={`fa-solid ${selected ? 'fa-xmark' : 'fa-sliders'} mr-1.5`}></i>{selected ? 'Close' : 'Details'}
                            </button>
                            {canShowSelectedExtras && typeof startEdit === 'function' ? (
                                <button
                                    type="button"
                                    title="Edit queue item details"
                                    onClick={() => startEdit?.(song)}
                                    className={`${styles.btnStd} ${styles.btnSecondary} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-pen-to-square mr-1.5"></i>Edit
                                </button>
                            ) : null}
                            {canShowSelectedExtras && !isHeld && !needsTrackReview && !isPendingApproval && !isAssignedToRunOfShow ? (
                                <button
                                    type="button"
                                    title="Temporarily hold this singer"
                                    onClick={() => onHoldSinger?.(song.id, 'not_here')}
                                    className={`${styles.btnStd} ${styles.btnNeutral} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-pause mr-1.5"></i>Hold
                                </button>
                            ) : null}
                            {canShowSelectedExtras && canFastAssignToOpenSlot ? (
                                <button
                                    type="button"
                                    title={runOfShowOpenSlots.length === 1
                                        ? `Assign to ${nextOpenSlot.label}`
                                        : 'Assign to the next open run-of-show slot'}
                                    onClick={() => onAssignQueueSongToNextOpenRunOfShowSlot(song.id)}
                                    className={`${styles.btnStd} ${styles.btnNeutral} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-link mr-1.5"></i>Assign
                                </button>
                            ) : null}
                            {canShowSelectedExtras ? (
                                <button
                                    type="button"
                                    title={isPendingApproval ? 'Remove this pending request' : 'Remove this singer from the queue'}
                                    onClick={() => onRemove?.(song.id)}
                                    className={`${styles.btnStd} ${styles.btnDanger} ${compactViewport ? 'px-2 py-1 text-[10px] min-h-[24px] justify-center' : 'px-2 py-1 text-[10px] min-h-[24px] justify-start'}`}
                                >
                                    <i className="fa-solid fa-trash mr-1.5"></i>Remove
                                </button>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
            {canShowRunOfShowAssignment ? (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2.5" data-feature-id="queue-song-slot-assignment">
                    {canFastAssignToOpenSlot ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onAssignQueueSongToNextOpenRunOfShowSlot(song.id)}
                                className={`${styles.btnStd} ${styles.btnPrimary} min-h-[34px] px-3 py-1.5 text-[10px]`}
                            >
                                {runOfShowOpenSlots.length === 1
                                    ? `Assign To ${nextOpenSlot.label}`
                                    : 'Assign To Next Open Slot'}
                            </button>
                            {runOfShowOpenSlots.length > 1 ? (
                                <div className="text-[10px] text-zinc-400">
                                    Next open: {nextOpenSlot.label}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {typeof onAssignQueueSongToRunOfShowItem === 'function' && runOfShowAssignableSlots.length ? (
                        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                            <select
                                value={selectedSlotId}
                                onChange={(event) => setSelectedSlotId(event.target.value)}
                                className="min-w-[180px] max-w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none"
                            >
                                {runOfShowAssignableSlots.map((slot) => (
                                    <option key={slot.id} value={slot.id}>{slot.label}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                disabled={!selectedSlotId}
                                onClick={() => onAssignQueueSongToRunOfShowItem(song.id, selectedSlotId)}
                                className={`${styles.btnStd} ${styles.btnNeutral} min-h-[34px] px-3 py-1.5 text-[10px] disabled:opacity-45`}
                            >
                                {song?.runOfShowItemId ? 'Reassign Selected Slot' : 'Assign Selected Slot'}
                            </button>
                        </div>
                    ) : null}
                    {assignedRunOfShowSlot ? (
                        <div className="mt-2 text-[10px] text-zinc-400">Selected slot: {assignedRunOfShowSlot.label}</div>
                    ) : selectedSlotId ? (
                        <div className="mt-2 text-[10px] text-zinc-400">
                            Selected slot: {runOfShowAssignableSlots.find((slot) => slot.id === selectedSlotId)?.label || selectedSlotId}
                        </div>
                    ) : canFastAssignToOpenSlot ? (
                        <div className="mt-2 text-[10px] text-zinc-400">Open slot: {nextOpenSlot.label}</div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

export default QueueSongCard;
