import {
    normalizeRunOfShowDirector,
    resequenceRunOfShowItems,
} from '../../../lib/runOfShowDirector.js';

const ACTIVE_ITEM_STATUSES = new Set(['draft', 'ready', 'staged', 'live', 'blocked']);

const isActiveItem = (item = {}) => ACTIVE_ITEM_STATUSES.has(
    String(item?.status || 'draft').trim().toLowerCase()
);

export const getHostNightFlowBuckets = (director = {}) => {
    const normalizedDirector = normalizeRunOfShowDirector(director || {});
    const preparedItems = normalizedDirector.items.filter((item) => (
        item?.destination === 'planner' && isActiveItem(item)
    ));
    const liveQueueItems = normalizedDirector.items.filter((item) => (
        item?.destination !== 'planner' && isActiveItem(item)
    ));
    const completedItems = normalizedDirector.items.filter((item) => (
        ['complete', 'skipped'].includes(String(item?.status || '').trim().toLowerCase())
    ));

    return {
        preparedItems,
        preparedMomentItems: preparedItems.filter((item) => item?.type !== 'performance'),
        preparedPerformanceItems: preparedItems.filter((item) => item?.type === 'performance'),
        liveQueueItems,
        completedItems,
    };
};

export const promotePreparedItemsToLiveQueue = (director = {}, itemIds = []) => {
    const normalizedDirector = normalizeRunOfShowDirector(director || {});
    const selectedIds = new Set(
        (Array.isArray(itemIds) ? itemIds : [itemIds])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    );
    if (!selectedIds.size) {
        return {
            director: normalizedDirector,
            promotedCount: 0,
            promotedIds: [],
        };
    }

    const promotedIds = [];
    const items = normalizedDirector.items.map((item) => {
        if (item?.destination !== 'planner' || !selectedIds.has(String(item?.id || '').trim())) {
            return item;
        }
        promotedIds.push(item.id);
        return {
            ...item,
            destination: 'run_of_show',
            beltPhase: item.status === 'ready' ? 'warming' : 'planned',
            onDeckAtMs: 0,
            flightedAtMs: 0,
            stagedAtMs: 0,
        };
    });

    return {
        director: normalizeRunOfShowDirector({
            ...normalizedDirector,
            items: resequenceRunOfShowItems(items),
        }),
        promotedCount: promotedIds.length,
        promotedIds,
    };
};

export const schedulePreparedMomentsByPerformanceCadence = (
    director = {},
    itemIds = [],
    everyPerformances = 3
) => {
    const normalizedDirector = normalizeRunOfShowDirector(director || {});
    const cadence = Math.max(1, Math.min(12, Math.round(Number(everyPerformances || 3) || 3)));
    const selectedIds = new Set(
        (Array.isArray(itemIds) ? itemIds : [itemIds])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
    );
    const selectedMoments = normalizedDirector.items.filter((item) => (
        item?.destination === 'planner'
        && item?.type !== 'performance'
        && selectedIds.has(String(item?.id || '').trim())
    ));
    if (!selectedMoments.length) {
        return {
            director: normalizedDirector,
            promotedCount: 0,
            promotedIds: [],
            cadence,
        };
    }

    const promotedMoments = selectedMoments.map((item) => ({
        ...item,
        destination: 'run_of_show',
        beltPhase: item.status === 'ready' ? 'warming' : 'planned',
        onDeckAtMs: 0,
        flightedAtMs: 0,
        stagedAtMs: 0,
    }));
    const activeFlowItems = normalizedDirector.items.filter((item) => item?.destination !== 'planner');
    const remainingPreparedItems = normalizedDirector.items.filter((item) => (
        item?.destination === 'planner'
        && !selectedIds.has(String(item?.id || '').trim())
    ));
    const scheduledItems = [];
    let performanceCount = 0;
    let momentCursor = 0;

    activeFlowItems.forEach((item) => {
        scheduledItems.push(item);
        if (item?.type !== 'performance' || !isActiveItem(item)) return;
        performanceCount += 1;
        if (performanceCount % cadence !== 0 || momentCursor >= promotedMoments.length) return;
        scheduledItems.push(promotedMoments[momentCursor]);
        momentCursor += 1;
    });

    while (momentCursor < promotedMoments.length) {
        scheduledItems.push(promotedMoments[momentCursor]);
        momentCursor += 1;
    }

    return {
        director: normalizeRunOfShowDirector({
            ...normalizedDirector,
            items: resequenceRunOfShowItems([...scheduledItems, ...remainingPreparedItems]),
        }),
        promotedCount: promotedMoments.length,
        promotedIds: promotedMoments.map((item) => item.id),
        cadence,
    };
};

const getMovableFlowBucket = (item = {}) => {
    const status = String(item?.status || 'draft').trim().toLowerCase();
    if (item?.destination === 'planner' && isActiveItem(item)) return 'planner';
    if (item?.destination !== 'planner' && ['draft', 'ready', 'staged', 'blocked'].includes(status)) return 'live_queue';
    if (['complete', 'skipped'].includes(status)) return 'history';
    return '';
};

export const moveHostNightFlowItem = (director = {}, itemId = '', delta = 0) => {
    const normalizedDirector = normalizeRunOfShowDirector(director || {});
    const safeItemId = String(itemId || '').trim();
    const requestedDelta = Math.trunc(Number(delta || 0));
    const targetItem = normalizedDirector.items.find((item) => String(item?.id || '').trim() === safeItemId);
    const bucket = getMovableFlowBucket(targetItem);
    if (!safeItemId || !requestedDelta || !bucket) return normalizedDirector;

    const bucketItems = normalizedDirector.items.filter((item) => getMovableFlowBucket(item) === bucket);
    const currentIndex = bucketItems.findIndex((item) => item.id === safeItemId);
    const nextIndex = Math.max(0, Math.min(bucketItems.length - 1, currentIndex + requestedDelta));
    if (currentIndex < 0 || currentIndex === nextIndex) return normalizedDirector;

    const reorderedBucket = [...bucketItems];
    const [movedItem] = reorderedBucket.splice(currentIndex, 1);
    reorderedBucket.splice(nextIndex, 0, movedItem);
    let bucketCursor = 0;
    const items = normalizedDirector.items.map((item) => (
        getMovableFlowBucket(item) === bucket
            ? reorderedBucket[bucketCursor++]
            : item
    ));

    return normalizeRunOfShowDirector({
        ...normalizedDirector,
        items: resequenceRunOfShowItems(items),
    });
};

export default getHostNightFlowBuckets;
