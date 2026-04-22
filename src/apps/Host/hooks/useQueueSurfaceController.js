import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import deriveQueuePanelAutoExpandState from '../queuePanelVisibility';
import { buildQueueStageSummary, buildQueueSurfaceCounts } from '../queueSurfaceModel';

const useQueueSurfaceController = ({
    layoutMode = 'desktop',
    reviewRequired = [],
    pending = [],
    queue = [],
    assigned = [],
    held = [],
    showAddForm,
    setShowAddForm,
    showQueueList,
    setShowQueueList,
    reviewQueueOpen,
    setReviewQueueOpen,
    pendingQueueOpen,
    setPendingQueueOpen,
    readyQueueOpen,
    setReadyQueueOpen,
    assignedQueueOpen,
    setAssignedQueueOpen
} = {}) => {
    const isCompactQueueSurface = layoutMode === 'mobile' || layoutMode === 'laptop-tight';
    const [activeCompactTab, setActiveCompactTab] = useState('queue');
    const [touchReorderMode, setTouchReorderMode] = useState(false);
    const queueVisibilityCountsRef = useRef(null);
    const counts = useMemo(
        () => buildQueueSurfaceCounts({ reviewRequired, pending, queue, assigned, held }),
        [reviewRequired, pending, queue, assigned, held]
    );
    const stageSummary = useMemo(
        () => buildQueueStageSummary({ counts, nextQueueSong: queue[0] || null }),
        [counts, queue]
    );

    const activateCompactTab = useCallback((tab) => {
        const nextTab = tab === 'add' ? 'add' : 'queue';
        setActiveCompactTab(nextTab);
        if (nextTab === 'add') {
            setShowAddForm(true);
            setShowQueueList(false);
            setTouchReorderMode(false);
            return;
        }
        setShowAddForm(false);
        setShowQueueList(true);
    }, [setShowAddForm, setShowQueueList]);

    const toggleTouchReorderMode = useCallback(() => {
        setTouchReorderMode((previous) => !previous);
        setShowQueueList(true);
        setActiveCompactTab('queue');
    }, [setShowQueueList]);

    useEffect(() => {
        if (!isCompactQueueSurface) {
            setActiveCompactTab('queue');
            setTouchReorderMode(false);
            return;
        }
        if (!showAddForm && !showQueueList) {
            setShowQueueList(true);
            setActiveCompactTab('queue');
            return;
        }
        if (showAddForm && !showQueueList) {
            setActiveCompactTab('add');
            return;
        }
        if (showQueueList && !showAddForm) {
            setActiveCompactTab('queue');
            return;
        }
        setActiveCompactTab((previous) => (previous === 'add' ? 'add' : 'queue'));
    }, [isCompactQueueSurface, setShowQueueList, showAddForm, showQueueList]);

    useEffect(() => {
        const nextCounts = {
            review: counts.review,
            pending: counts.pending,
            ready: counts.ready,
            assigned: counts.assigned,
            held: counts.held
        };
        const previousCounts = queueVisibilityCountsRef.current;
        queueVisibilityCountsRef.current = nextCounts;
        if (!previousCounts) return;
        const { shouldExpand, nextVisibility } = deriveQueuePanelAutoExpandState({
            previousCounts,
            nextCounts,
            currentVisibility: {
                showQueueList,
                reviewQueueOpen,
                pendingQueueOpen,
                readyQueueOpen,
                assignedQueueOpen
            }
        });
        if (!shouldExpand) return;
        if (!showQueueList && nextVisibility.showQueueList) setShowQueueList(true);
        if (isCompactQueueSurface && showAddForm) setShowAddForm(false);
        if (!reviewQueueOpen && nextVisibility.reviewQueueOpen) setReviewQueueOpen(true);
        if (!pendingQueueOpen && nextVisibility.pendingQueueOpen) setPendingQueueOpen(true);
        if (!readyQueueOpen && nextVisibility.readyQueueOpen) setReadyQueueOpen(true);
        if (!assignedQueueOpen && nextVisibility.assignedQueueOpen) setAssignedQueueOpen(true);
        if (isCompactQueueSurface) {
            setActiveCompactTab('queue');
            setTouchReorderMode(false);
        }
    }, [
        assignedQueueOpen,
        counts.assigned,
        counts.held,
        counts.pending,
        counts.ready,
        counts.review,
        isCompactQueueSurface,
        pendingQueueOpen,
        readyQueueOpen,
        reviewQueueOpen,
        setShowAddForm,
        setAssignedQueueOpen,
        setPendingQueueOpen,
        setReadyQueueOpen,
        setReviewQueueOpen,
        setShowQueueList,
        showAddForm,
        showQueueList
    ]);

    return {
        counts,
        stageSummary,
        isCompactQueueSurface,
        activeCompactTab,
        activateCompactTab,
        touchReorderMode,
        touchReorderActive: !isCompactQueueSurface || touchReorderMode,
        toggleTouchReorderMode
    };
};

export default useQueueSurfaceController;
