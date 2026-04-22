const normalizeCount = (value) => {
    const next = Number(value || 0);
    return Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
};

export const buildQueueSurfaceCounts = ({
    reviewRequired = [],
    pending = [],
    queue = [],
    assigned = [],
    held = []
} = {}) => {
    const review = normalizeCount(reviewRequired?.length);
    const pendingCount = normalizeCount(pending?.length);
    const ready = normalizeCount(queue?.length);
    const assignedCount = normalizeCount(assigned?.length);
    const heldCount = normalizeCount(held?.length);
    const needsAttention = review + pendingCount;
    return {
        review,
        pending: pendingCount,
        ready,
        assigned: assignedCount,
        held: heldCount,
        needsAttention,
        total: needsAttention + ready + assignedCount + heldCount
    };
};

export const buildQueueStageSummary = ({
    counts = {},
    nextQueueSong = null
} = {}) => {
    const normalizedCounts = {
        review: normalizeCount(counts.review),
        pending: normalizeCount(counts.pending),
        ready: normalizeCount(counts.ready),
        assigned: normalizeCount(counts.assigned),
        held: normalizeCount(counts.held),
        needsAttention: normalizeCount(counts.needsAttention),
        total: normalizeCount(counts.total)
    };
    const singerName = String(nextQueueSong?.singerName || '').trim();
    const songTitle = String(nextQueueSong?.songTitle || '').trim();
    const nextQueueText = singerName || songTitle
        ? `${singerName || 'Guest'} - ${songTitle || 'Song'}`
        : normalizedCounts.needsAttention > 0
            ? `${normalizedCounts.needsAttention} request${normalizedCounts.needsAttention === 1 ? '' : 's'} need host attention`
            : normalizedCounts.assigned > 0
                ? `${normalizedCounts.assigned} song${normalizedCounts.assigned === 1 ? '' : 's'} tied to the show`
                : normalizedCounts.held > 0
                    ? `${normalizedCounts.held} singer${normalizedCounts.held === 1 ? '' : 's'} held`
                    : 'No one queued';

    return {
        queueCount: normalizedCounts.total,
        nextQueueText
    };
};
