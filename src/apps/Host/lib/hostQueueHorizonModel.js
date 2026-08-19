import { buildCanonicalTonightLineup } from './tonightsLineupProjection.js';

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
    const projectionId = normalizeText(item?.id);
    if (!projectionId) return null;
    const type = normalizeText(item?.type).toLowerCase();
    const queueSong = [
        item?.queueSongId,
        item?.preparedQueueSongId,
        item?.songId,
    ].map(normalizeText).filter(Boolean).map((key) => queueLookup.get(key)).find(Boolean) || null;
    const id = item?.projectionSource === 'queue_song'
        ? normalizeText(queueSong?.id || item?.queueSongId || item?.preparedQueueSongId) || projectionId
        : projectionId;
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
        sourceLabel: item?.projectionSource === 'queue_song' ? 'Queue' : 'Show',
        reason: item?.projectionSource === 'queue_song' ? 'Performance queue' : 'Tonight\'s Flow',
        raw: {
            ...item,
            ...(item?.projectionSource === 'queue_song' ? {
                id,
                projectionId,
            } : {}),
            queueSongId: normalizeText(queueSong?.id || item?.preparedQueueSongId),
        },
    };
};

const buildCommittedFlow = (director = null, queueSongs = []) => {
    const queueLookup = buildQueueSongLookup(queueSongs);
    return buildCanonicalTonightLineup({
        queueSongs,
        directorItems: Array.isArray(director?.items) ? director.items : [],
    })
        .filter((item) => !isFinishedFlowItem(item))
        .map((item) => buildFlowDisplayItem(item, queueLookup))
        .filter(Boolean);
};

export const deriveTonightLineupAutomationState = ({
    director = null,
    committedFlow = [],
    runOfShowEnabled = false,
    automationMode = 'auto',
    currentPerformanceSession = null,
    hasCurrentPerformance = false,
    legacyAutoDj = false,
} = {}) => {
    const configuredForAuto = normalizeText(automationMode).toLowerCase() !== 'manual'
        && normalizeText(director?.automationIntent || 'auto').toLowerCase() !== 'manual';
    const paused = director?.automationPaused === true || !configuredForAuto;
    const liveItems = (Array.isArray(director?.items) ? director.items : [])
        .filter((item) => normalizeText(item?.status).toLowerCase() === 'live');
    const stagedItem = (Array.isArray(director?.items) ? director.items : [])
        .find((item) => normalizeText(item?.status).toLowerCase() === 'staged') || null;
    const nextItem = (Array.isArray(committedFlow) ? committedFlow : [])
        .find((item) => !['live', 'complete', 'skipped'].includes(normalizeText(item?.status).toLowerCase())) || null;
    const sessionState = normalizeText(currentPerformanceSession?.playbackState || currentPerformanceSession?.state).toLowerCase();
    const activeSession = ['starting', 'playing', 'paused', 'ending'].includes(sessionState);
    const liveItem = liveItems[0] || null;
    const liveQueueSongId = normalizeText(liveItem?.queueSongId || liveItem?.preparedQueueSongId);
    const sessionQueueSongId = normalizeText(currentPerformanceSession?.songId);
    const sessionId = normalizeText(currentPerformanceSession?.sessionId);
    const claimedSessionId = normalizeText(liveItem?.activePerformanceSessionId || director?.activePerformanceSessionId);
    const needsRepair = liveItems.length > 1
        || (!!director?.currentItemId && !liveItems.some((item) => item.id === director.currentItemId))
        || (activeSession && !!liveItem && liveItem.type === 'performance' && !!sessionQueueSongId && !!liveQueueSongId && sessionQueueSongId !== liveQueueSongId)
        || (activeSession && !!sessionId && !!claimedSessionId && sessionId !== claimedSessionId);
    const missingPerformanceReference = (Array.isArray(committedFlow) ? committedFlow : [])
        .some((item) => item?.objectType === 'performance' && item?.raw?.referenceState === 'missing');
    const base = {
        active: runOfShowEnabled === true,
        enabled: runOfShowEnabled === true && configuredForAuto && !paused,
        paused: runOfShowEnabled === true && paused,
        limited: runOfShowEnabled !== true && legacyAutoDj === true,
        state: 'off',
        label: 'Auto-Advance Off',
        detail: 'Turn on Auto-Advance to play scenes and performances in Tonight\'s Lineup order.',
    };
    if (!runOfShowEnabled) {
        return legacyAutoDj ? {
            ...base,
            state: 'limited',
            label: 'Songs Only',
            detail: 'Performances are auto-playing, but scenes are being bypassed. Turn on Auto-Advance to use the full lineup.',
        } : base;
    }
    if (needsRepair || missingPerformanceReference) return {
        ...base,
        enabled: false,
        state: 'repair',
        label: 'Needs Repair',
        detail: 'The live stage and Tonight\'s Lineup disagree. Pause and repair the active item before advancing.',
    };
    if (['waiting_for_performer', 'blocked'].includes(normalizeText(director?.automationStatus).toLowerCase())) return {
        ...base,
        enabled: false,
        state: 'blocked',
        label: 'Blocked',
        detail: 'The next lineup item needs host attention before Auto-Advance can continue.',
    };
    if (paused) return {
        ...base,
        state: 'paused',
        label: 'Auto-Advance Paused',
        detail: 'Tonight\'s Lineup order is preserved. Resume when you are ready to continue.',
    };
    if (director?.holdCurrent === true || director?.holdAfterCurrent === true) return {
        ...base,
        state: 'blocked',
        label: 'Advance Held',
        detail: director?.holdCurrent === true
            ? 'The current lineup item is held by the host.'
            : 'Auto-Advance will stop after the current item.',
    };
    if (sessionState === 'starting') return {
        ...base,
        state: 'starting',
        label: 'Starting',
        detail: 'The next performance is starting. Auto-Advance remains armed.',
    };
    if (sessionState === 'paused') return {
        ...base,
        state: 'paused_playback',
        label: 'Playback Paused',
        detail: 'The active performance is paused. Resume playback before the lineup can advance.',
    };
    if (liveItem || activeSession || hasCurrentPerformance) return {
        ...base,
        state: 'running',
        label: 'Auto-Advance Running',
        detail: 'The current item is live; the next eligible item will follow in lineup order.',
    };
    if (stagedItem) return {
        ...base,
        state: 'armed',
        label: 'Auto-Advance Armed',
        detail: 'The next item is staged and ready to start.',
    };
    const nextRaw = nextItem?.raw || nextItem;
    if (normalizeText(nextRaw?.status).toLowerCase() === 'blocked') return {
        ...base,
        state: 'blocked',
        label: 'Blocked',
        detail: 'The next lineup item needs host attention before Auto-Advance can continue.',
    };
    if (nextRaw && (
        normalizeText(nextRaw?.automationMode).toLowerCase() === 'manual'
        || ['host', 'host_after_min'].includes(normalizeText(nextRaw?.advanceMode).toLowerCase())
        || nextRaw?.requireHostAdvance === true
    )) return {
        ...base,
        state: 'manual',
        label: 'Manual Step Next',
        detail: 'The next item requires the host to start or advance it.',
    };
    if (nextItem) return {
        ...base,
        state: 'ready',
        label: 'Auto-Advance Ready',
        detail: 'The next eligible scene or performance will start in lineup order.',
    };
    return {
        ...base,
        state: 'finished',
        label: 'Lineup Finished',
        detail: 'There are no remaining scenes or performances to advance.',
    };
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
    runOfShowEnabled = false,
    runOfShowAutomationMode = 'auto',
    currentPerformanceSession = null,
    progressionPending = false,
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
    const automation = deriveTonightLineupAutomationState({
        director: runOfShowDirector,
        committedFlow,
        runOfShowEnabled,
        automationMode: runOfShowAutomationMode,
        currentPerformanceSession,
        hasCurrentPerformance: !!current?.id,
        legacyAutoDj: runtimeModel?.roomControlsSummary?.autoDj === true,
    });

    return {
        segments,
        remainingCount,
        queueTotalCount: normalizeCount(queueTotalCount),
        liveQueueItemCount: totalUpcomingCount,
        liveQueueMomentCount: committedFlow.filter((item) => !isPerformance(item)).length,
        attentionCount: normalizeCount(attentionCount),
        automation: {
            ...automation,
            pending: progressionPending === true,
        },
        empty: !segments.length,
    };
};

export default buildHostQueueHorizonModel;
