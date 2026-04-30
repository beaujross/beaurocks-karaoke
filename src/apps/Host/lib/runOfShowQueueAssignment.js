import { normalizeRunOfShowDirector, updateRunOfShowItem } from '../../../lib/runOfShowDirector.js';
import { isOpenRunOfShowPerformanceSlot } from './openSlotSuggestions.js';

export const prepareRunOfShowQueueAssignment = ({
    director = {},
    queueSong = {},
    itemId = '',
    buildAssignmentPatch = () => ({}),
    deriveStatus = (item = {}) => item?.status || 'draft',
} = {}) => {
    const safeItemId = String(itemId || '').trim();
    if (!safeItemId) {
        throw new Error('assignment_target_invalid');
    }

    const currentDirector = normalizeRunOfShowDirector(director || {});
    const targetItem = (Array.isArray(currentDirector?.items) ? currentDirector.items : []).find((item) => item.id === safeItemId) || null;
    if (!targetItem || targetItem.type !== 'performance') {
        throw new Error('assignment_target_invalid');
    }
    if (!isOpenRunOfShowPerformanceSlot(targetItem)) {
        throw new Error('assignment_slot_unavailable');
    }

    const currentSongAssignment = String(queueSong?.runOfShowItemId || '').trim();
    if (currentSongAssignment && currentSongAssignment !== safeItemId) {
        throw new Error('assignment_song_already_linked');
    }

    const nextDirector = updateRunOfShowItem(currentDirector, safeItemId, (item) => {
        const nextItem = {
            ...item,
            ...buildAssignmentPatch(queueSong, item),
        };
        nextItem.status = deriveStatus(nextItem);
        nextItem.blockedReason = nextItem.status === 'blocked'
            ? (nextItem.type === 'performance' ? 'performance_not_ready' : 'item_not_ready')
            : '';
        return nextItem;
    });

    return {
        nextDirector: normalizeRunOfShowDirector(nextDirector),
        targetItem,
    };
};
