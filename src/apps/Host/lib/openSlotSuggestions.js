export const isOpenRunOfShowPerformanceSlot = (item = {}) => {
    if (String(item?.type || '').trim().toLowerCase() !== 'performance') return false;
    const status = String(item?.status || '').trim().toLowerCase();
    if (['complete', 'skipped', 'live'].includes(status)) return false;
    const queueLinkState = String(item?.queueLinkState || '').trim().toLowerCase();
    if (queueLinkState === 'linked') return false;
    const hasPerformerIdentity = !!String(item?.assignedPerformerUid || item?.assignedPerformerName || '').trim();
    const hasSongIdentity = !!String(item?.songId || item?.songTitle || item?.artistName || '').trim();
    const hasSubmission = !!String(item?.approvedSubmissionId || '').trim();
    const backingPlan = item?.backingPlan && typeof item.backingPlan === 'object' ? item.backingPlan : {};
    const hasBackingPlan = [
        backingPlan?.label,
        backingPlan?.mediaUrl,
        backingPlan?.youtubeId,
        backingPlan?.appleMusicId,
        backingPlan?.trackId,
        backingPlan?.submittedBackingId
    ].some((value) => String(value || '').trim().length > 0) || backingPlan?.playbackReady === true;
    return !String(item?.preparedQueueSongId || '').trim()
        && !hasPerformerIdentity
        && !hasSongIdentity
        && !hasSubmission
        && !hasBackingPlan;
};

export const computeOpenSlotAssignments = ({
    openSlots = [],
    readyQueueSongs = [],
    limit = null,
} = {}) => {
    const safeOpenSlots = Array.isArray(openSlots) ? openSlots.filter(Boolean) : [];
    const safeReadyQueueSongs = Array.isArray(readyQueueSongs) ? readyQueueSongs.filter(Boolean) : [];
    if (!safeOpenSlots.length || !safeReadyQueueSongs.length) {
        return [];
    }
    const numericLimit = Number(limit);
    const maxAssignments = Number.isFinite(numericLimit) && numericLimit > 0
        ? Math.min(safeOpenSlots.length, safeReadyQueueSongs.length, Math.floor(numericLimit))
        : Math.min(safeOpenSlots.length, safeReadyQueueSongs.length);
    if (maxAssignments <= 0) return [];
    return Array.from({ length: maxAssignments }, (_, index) => ({
        slot: safeOpenSlots[index] || null,
        queueSong: safeReadyQueueSongs[index] || null,
    })).filter((entry) => entry?.slot?.id && entry?.queueSong?.id);
};
