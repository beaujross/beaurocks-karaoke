const normalizeCount = (value) => {
    const next = Number(value || 0);
    return Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
};

export const deriveQueuePanelAutoExpandState = ({
    previousCounts = {},
    nextCounts = {},
    currentVisibility = {}
} = {}) => {
    const previous = {
        review: normalizeCount(previousCounts.review),
        pending: normalizeCount(previousCounts.pending),
        ready: normalizeCount(previousCounts.ready),
        assigned: normalizeCount(previousCounts.assigned)
    };
    const next = {
        review: normalizeCount(nextCounts.review),
        pending: normalizeCount(nextCounts.pending),
        ready: normalizeCount(nextCounts.ready),
        assigned: normalizeCount(nextCounts.assigned)
    };
    const reviewIncreased = next.review > previous.review;
    const pendingIncreased = next.pending > previous.pending;
    const readyIncreased = next.ready > previous.ready;
    const assignedIncreased = next.assigned > previous.assigned;
    const shouldExpand = reviewIncreased || pendingIncreased || readyIncreased || assignedIncreased;
    const nextVisibility = {
        showQueueList: shouldExpand ? true : currentVisibility.showQueueList !== false,
        reviewQueueOpen: reviewIncreased || currentVisibility.reviewQueueOpen !== false,
        pendingQueueOpen: pendingIncreased || currentVisibility.pendingQueueOpen !== false,
        readyQueueOpen: readyIncreased || currentVisibility.readyQueueOpen !== false,
        assignedQueueOpen: assignedIncreased || currentVisibility.assignedQueueOpen !== false
    };
    return {
        shouldExpand,
        nextVisibility
    };
};

export default deriveQueuePanelAutoExpandState;
