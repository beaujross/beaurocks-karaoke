const normalizeCount = (value = 0) => Math.max(0, Math.round(Number(value || 0) || 0));
const normalizeText = (value = '') => String(value || '').trim();

const isPerformance = (item = null) => item?.objectType === 'performance';
const isFinishedFlowItem = (item = null) => ['complete', 'skipped'].includes(normalizeText(item?.status).toLowerCase());

const getQueueSongLookupKeys = (song = {}) => [
    song?.id,
    song?.songDocId,
    song?.songId,
].map(normalizeText).filter(Boolean);

const buildQueueSongLookup = (queueSongs = []) => {
    const lookup = new Map();
    (Array.isArray(queueSongs) ? queueSongs : []).forEach((song) => {
        getQueueSongLookupKeys(song).forEach((key) => {
            if (!lookup.has(key)) lookup.set(key, song);
        });
    });
    return lookup;
};

const getFlowItemEmoji = (item = {}) => {
    const type = normalizeText(item?.type).toLowerCase();
    if (type === 'performance') return normalizeText(item?.emoji) || '🎤';
    if (type.includes('trivia')) return '❓';
    if (type.includes('would_you_rather')) return '⚖️';
    if (type.includes('game')) return '🎲';
    if (type === 'announcement' || type === 'intro' || type === 'closing') return '📣';
    return '🎬';
};

const buildFlowDisplayItem = (item = {}, queueLookup = new Map()) => {
    const id = normalizeText(item?.id);
    if (!id) return null;
    const type = normalizeText(item?.type).toLowerCase();
    const queueSong = [
        item?.preparedQueueSongId,
        item?.songId,
    ].map(normalizeText).filter(Boolean).map((key) => queueLookup.get(key)).find(Boolean) || null;
    const performance = type === 'performance';
    const singerName = normalizeText(item?.assignedPerformerName || queueSong?.singerName);
    const songTitle = normalizeText(item?.songTitle || queueSong?.songTitle);
    const artistName = normalizeText(item?.artistName || queueSong?.artist);
    const momentDetail = normalizeText(
        item?.presentationPlan?.headline
        || item?.modeLaunchPlan?.prompt
        || item?.notes
    );
    return {
        id,
        objectType: performance ? 'performance' : 'moment',
        objectRole: normalizeText(item?.status).toLowerCase() === 'live' ? 'live' : 'upcoming',
        title: performance
            ? (singerName || 'Singer open')
            : (normalizeText(item?.title) || 'Planned moment'),
        subtitle: performance
            ? ([songTitle || 'Song open', artistName].filter(Boolean).join(' - '))
            : (momentDetail || normalizeText(item?.title) || 'Room moment'),
        detail: normalizeText(item?.status) || 'planned',
        status: normalizeText(item?.status).toLowerCase() || 'planned',
        artworkUrl: normalizeText(
            queueSong?.albumArtUrl
            || queueSong?.artworkUrl100
            || queueSong?.artworkUrl
            || item?.backingPlan?.artworkUrl
            || item?.presentationPlan?.backgroundMedia
        ),
        avatarEmoji: normalizeText(queueSong?.emoji || queueSong?.avatar) || getFlowItemEmoji(item),
        sourceLabel: 'Show',
        reason: 'Tonight\'s Flow',
        raw: {
            ...item,
            queueSongId: normalizeText(queueSong?.id || item?.preparedQueueSongId),
        },
    };
};

const buildCommittedFlow = (director = null, queueSongs = []) => {
    const queueLookup = buildQueueSongLookup(queueSongs);
    return (Array.isArray(director?.items) ? director.items : [])
        .filter((item) => item?.destination !== 'planner' && !isFinishedFlowItem(item))
        .sort((left, right) => Number(left?.sequence || 0) - Number(right?.sequence || 0))
        .map((item) => buildFlowDisplayItem(item, queueLookup))
        .filter(Boolean);
};

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
    runOfShowDirector = null,
    queueSongs = [],
} = {}) => {
    const current = runtimeModel?.currentPerformance || null;
    const committedNext = runtimeModel?.nextPerformance || null;
    const rotationFlow = Array.isArray(runtimeModel?.rotationFlow)
        ? runtimeModel.rotationFlow.filter(Boolean)
        : [];
    const committedFlow = buildCommittedFlow(runOfShowDirector, queueSongs);
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

    if (committedFlow.length) {
        committedFlow.forEach((item) => {
            if (segments.length >= 6) return;
            if (item.status === 'live' && current?.id) return;
            const upcomingIndex = segments.filter((segment) => segment.key !== 'on-stage').length;
            const itemIsPerformance = isPerformance(item);
            const isLiveMoment = item.status === 'live' && !current?.id;
        pushUniqueSegment(segments, seenIds, {
                key: isLiveMoment ? 'live-moment' : upcomingIndex === 0 ? 'next' : `then-${upcomingIndex}`,
                label: isLiveMoment ? 'Live' : upcomingIndex === 0 ? (current?.id ? 'Next' : 'Start') : 'Then',
                item,
                tone: isLiveMoment ? 'live' : itemIsPerformance ? (upcomingIndex === 0 ? 'next' : 'then') : 'moment',
            });
        });
    } else {
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
    }

    const linkedQueueIds = new Set(
        committedFlow
            .map((item) => normalizeText(item?.raw?.queueSongId || item?.raw?.preparedQueueSongId))
            .filter(Boolean)
    );
    const singerCandidates = rotationFlow.filter((singer) => (
        isPerformance(singer)
        && !linkedQueueIds.has(normalizeText(singer?.id))
        && !linkedQueueIds.has(normalizeText(singer?.raw?.id))
    ));
    const desiredSegmentCount = committedFlow.length ? 6 : (current?.id ? 3 : 2);

    for (const singer of singerCandidates) {
        if (segments.length >= desiredSegmentCount) break;
        const upcomingIndex = segments.filter((segment) => segment.key !== 'on-stage').length;
        const hasQueuedSinger = segments.some((segment) => isPerformance(segment.item) && segment.key !== 'on-stage');
        pushUniqueSegment(segments, seenIds, {
            key: hasQueuedSinger ? `then-singer-${upcomingIndex}` : (current?.id ? 'next-singer' : 'start-singer'),
            label: upcomingIndex === 0
                ? (current?.id ? 'Next' : 'Start')
                : hasQueuedSinger
                    ? 'Then'
                    : 'Next Singer',
            item: singer,
            tone: upcomingIndex === 0 ? 'next' : 'then',
        });
    }

    const visibleQueuePerformanceCount = segments.filter((segment) => (
        segment.key !== 'on-stage'
        && isPerformance(segment.item)
    )).length;
    const visibleUpcomingCount = segments.filter((segment) => segment.key !== 'on-stage').length;
    const unlinkedQueueCount = Math.max(0, normalizeCount(queueTotalCount) - linkedQueueIds.size);
    const totalUpcomingCount = committedFlow.length
        ? committedFlow.filter((item) => !(item.status === 'live' && current?.id)).length + unlinkedQueueCount
        : normalizeCount(queueTotalCount);
    const remainingCount = committedFlow.length
        ? Math.max(0, totalUpcomingCount - visibleUpcomingCount)
        : Math.max(0, normalizeCount(queueTotalCount) - visibleQueuePerformanceCount);
    const autoDjEnabled = runtimeModel?.roomControlsSummary?.autoDj === true;

    return {
        segments,
        remainingCount,
        queueTotalCount: normalizeCount(queueTotalCount),
        liveQueueItemCount: totalUpcomingCount,
        liveQueueMomentCount: committedFlow.filter((item) => !isPerformance(item)).length,
        attentionCount: normalizeCount(attentionCount),
        automation: {
            enabled: autoDjEnabled,
            label: autoDjEnabled ? 'Songs: Auto' : 'Songs: Manual',
            detail: 'Controls karaoke performance advancement only. Planned moments use Tonight\'s Flow controls.',
        },
        empty: !segments.length,
    };
};

export default buildHostQueueHorizonModel;
