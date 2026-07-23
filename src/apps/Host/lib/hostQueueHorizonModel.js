const normalizeCount = (value = 0) => Math.max(0, Math.round(Number(value || 0) || 0));

const isPerformance = (item = null) => item?.objectType === 'performance';

const pushUniqueSegment = (segments, seenIds, segment) => {
    const itemId = String(segment?.item?.id || '').trim();
    if (!itemId || seenIds.has(itemId)) return;
    seenIds.add(itemId);
    segments.push(segment);
};

export const buildHostQueueHorizonModel = ({
    runtimeModel = null,
    queueTotalCount = 0,
    attentionCount = 0,
} = {}) => {
    const current = runtimeModel?.currentPerformance || null;
    const committedNext = runtimeModel?.nextPerformance || null;
    const rotationFlow = Array.isArray(runtimeModel?.rotationFlow)
        ? runtimeModel.rotationFlow.filter(Boolean)
        : [];
    const segments = [];
    const seenIds = new Set();

    if (current?.id) {
        pushUniqueSegment(segments, seenIds, {
            key: 'on-stage',
            label: 'On Stage',
            item: current,
            tone: 'live',
        });
    }

    if (committedNext?.id) {
        const nextIsPerformance = isPerformance(committedNext);
        pushUniqueSegment(segments, seenIds, {
            key: nextIsPerformance ? 'next' : 'on-deck',
            label: nextIsPerformance
                ? (current?.id ? 'Next' : 'Start')
                : 'On Deck',
            item: committedNext,
            tone: nextIsPerformance ? 'next' : 'moment',
        });
    }

    const committedNextIsMoment = committedNext?.id && !isPerformance(committedNext);
    const singerCandidates = rotationFlow.filter(isPerformance);
    const desiredSegmentCount = current?.id ? 3 : 2;

    for (const singer of singerCandidates) {
        if (segments.length >= desiredSegmentCount) break;
        const hasQueuedSinger = segments.some((segment) => isPerformance(segment.item) && segment.key !== 'on-stage');
        pushUniqueSegment(segments, seenIds, {
            key: hasQueuedSinger ? 'then' : (committedNextIsMoment ? 'next-singer' : (current?.id ? 'next' : 'start')),
            label: hasQueuedSinger ? 'Then' : (committedNextIsMoment ? 'Next Singer' : (current?.id ? 'Next' : 'Start')),
            item: singer,
            tone: hasQueuedSinger ? 'then' : 'next',
        });
    }

    const visibleQueuedPerformanceIds = new Set(
        segments
            .filter((segment) => segment.key !== 'on-stage' && isPerformance(segment.item))
            .map((segment) => String(segment.item.id || '').trim())
            .filter(Boolean)
    );
    const remainingCount = Math.max(0, normalizeCount(queueTotalCount) - visibleQueuedPerformanceIds.size);
    const autoDjEnabled = runtimeModel?.roomControlsSummary?.autoDj === true;

    return {
        segments,
        remainingCount,
        queueTotalCount: normalizeCount(queueTotalCount),
        attentionCount: normalizeCount(attentionCount),
        automation: {
            enabled: autoDjEnabled,
            label: autoDjEnabled ? 'Auto-DJ' : 'Manual',
        },
        empty: !segments.length,
    };
};

export default buildHostQueueHorizonModel;
