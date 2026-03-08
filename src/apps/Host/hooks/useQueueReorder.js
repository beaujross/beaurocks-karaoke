import { useCallback, useRef, useState } from 'react';

const useQueueReorder = ({ queue, onPersist, toast }) => {
    const [dragQueueId, setDragQueueId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const touchDragStateRef = useRef(null);
    const [touchReorderEnabled] = useState(() => {
        if (typeof window === 'undefined') return false;
        try {
            const coarsePointer = typeof window.matchMedia === 'function'
                ? window.matchMedia('(pointer: coarse)').matches
                : false;
            return coarsePointer || Number(window.navigator?.maxTouchPoints || 0) > 0;
        } catch {
            return false;
        }
    });

    const reorderQueue = useCallback(async (fromId, toId) => {
        if (!fromId || !toId || fromId === toId) return;
        const list = [...queue];
        const fromIdx = list.findIndex(s => s.id === fromId);
        const toIdx = list.findIndex(s => s.id === toId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        await onPersist(list);
        toast?.('Queue reordered');
    }, [queue, onPersist, toast]);

    const handleTouchStart = useCallback((id, event) => {
        if (!touchReorderEnabled) return;
        const target = event?.target || null;
        const handle = target?.closest?.('[data-queue-drag-handle="true"]');
        if (!handle) {
            touchDragStateRef.current = null;
            return;
        }
        const touch = event?.touches?.[0];
        if (!touch) return;
        touchDragStateRef.current = {
            id,
            startX: touch.clientX,
            startY: touch.clientY,
            moved: false
        };
        setDragOverId(null);
    }, [touchReorderEnabled]);

    const handleTouchMove = useCallback((e) => {
        const touchDragState = touchDragStateRef.current;
        if (!touchDragState) return;
        const touch = e.touches[0];
        if (!touch || typeof document === 'undefined') return;
        const deltaX = Math.abs(touch.clientX - touchDragState.startX);
        const deltaY = Math.abs(touch.clientY - touchDragState.startY);
        if (!touchDragState.moved && Math.max(deltaX, deltaY) < 12) return;
        touchDragStateRef.current = {
            ...touchDragState,
            moved: true
        };
        e.preventDefault();
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const row = el?.closest('[data-queue-id]');
        if (row) {
            setDragOverId(row.getAttribute('data-queue-id'));
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        const touchDragState = touchDragStateRef.current;
        if (touchDragState?.moved && touchDragState.id && dragOverId) {
            reorderQueue(touchDragState.id, dragOverId);
        }
        touchDragStateRef.current = null;
        setDragOverId(null);
    }, [dragOverId, reorderQueue]);

    return {
        dragQueueId,
        setDragQueueId,
        dragOverId,
        setDragOverId,
        reorderQueue,
        touchReorderEnabled,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd
    };
};

export default useQueueReorder;
