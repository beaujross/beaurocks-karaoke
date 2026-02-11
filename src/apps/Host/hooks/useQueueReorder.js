import { useCallback, useRef, useState } from 'react';

const useQueueReorder = ({ queue, onPersist, toast }) => {
    const [dragQueueId, setDragQueueId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const touchDragIdRef = useRef(null);

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

    const handleTouchStart = useCallback((id) => {
        touchDragIdRef.current = id;
    }, []);

    const handleTouchMove = useCallback((e) => {
        const touch = e.touches[0];
        if (!touch || typeof document === 'undefined') return;
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const row = el?.closest('[data-queue-id]');
        if (row) {
            setDragOverId(row.getAttribute('data-queue-id'));
        }
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (touchDragIdRef.current && dragOverId) {
            reorderQueue(touchDragIdRef.current, dragOverId);
        }
        touchDragIdRef.current = null;
        setDragOverId(null);
    }, [dragOverId, reorderQueue]);

    return {
        dragQueueId,
        setDragQueueId,
        dragOverId,
        setDragOverId,
        reorderQueue,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd
    };
};

export default useQueueReorder;
