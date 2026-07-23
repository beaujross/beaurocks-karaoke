import {
    HOST_RUNTIME_MODE_EMPHASES,
    getHostRuntimeModeEmphasis,
} from './hostUiPrefs';

const normalizeText = (value = '') => String(value || '').trim();

const clampNumber = (value = 0) => {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
};

const formatDurationLabel = (seconds = 0) => {
    const safeSeconds = Math.max(0, Math.round(clampNumber(seconds)));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
};

const resolvePlaybackProgress = ({
    room = null,
    current = null,
    currentSourcePlaying = false,
    nowMs = Date.now(),
} = {}) => {
    const usesAppleBacking = !!current?.appleMusicId;
    const applePlayback = room?.appleMusicPlayback || null;
    const startedAtMs = usesAppleBacking
        ? clampNumber(applePlayback?.startedAt)
        : clampNumber(room?.currentPerformanceMeta?.startedAtMs || room?.videoStartTimestamp);
    const pausedAtMs = usesAppleBacking
        ? clampNumber(applePlayback?.pausedAt)
        : clampNumber(room?.pausedAt);
    const durationSec = Math.max(
        0,
        clampNumber(current?.duration),
        clampNumber(current?.performanceStartedDurationSec),
        clampNumber(room?.currentPerformanceMeta?.durationSec),
        clampNumber(applePlayback?.durationSec),
    );
    const referenceNowMs = currentSourcePlaying ? clampNumber(nowMs) : pausedAtMs;
    const elapsedSec = startedAtMs > 0 && referenceNowMs > 0
        ? Math.max(0, Math.round((referenceNowMs - startedAtMs) / 1000))
        : 0;
    const clampedElapsedSec = durationSec > 0 ? Math.min(elapsedSec, durationSec) : elapsedSec;
    const progressPct = durationSec > 0
        ? Math.max(0, Math.min(100, Math.round((clampedElapsedSec / durationSec) * 100)))
        : 0;
    return {
        startedAtMs,
        durationSec,
        elapsedSec: clampedElapsedSec,
        remainingSec: durationSec > 0 ? Math.max(0, durationSec - clampedElapsedSec) : 0,
        progressPct,
        elapsedLabel: formatDurationLabel(clampedElapsedSec),
        durationLabel: durationSec > 0 ? formatDurationLabel(durationSec) : '',
    };
};

const isQueueSongPlayable = (song = {}) => {
    const resolutionStatus = normalizeText(song?.mediaResolutionStatus).toLowerCase();
    if (resolutionStatus === 'needs_backing') return false;
    if (song?.playbackReady === false) return false;
    return !!(
        normalizeText(song?.mediaUrl)
        || normalizeText(song?.youtubeId)
        || normalizeText(song?.appleMusicId)
    );
};

const buildPerformanceObject = (song = {}, {
    role = 'candidate',
    sourceLabel = '',
    reason = '',
} = {}) => {
    const id = normalizeText(song?.id || song?.songDocId || song?.songId);
    if (!id) return null;
    const playable = isQueueSongPlayable(song);
    return {
        id,
        objectType: 'performance',
        objectRole: role,
        title: normalizeText(song?.singerName || song?.performerName || song?.displayName) || 'Guest',
        subtitle: normalizeText(song?.songTitle || song?.title) || 'Song',
        detail: normalizeText(song?.artist) || (playable ? 'Track ready' : 'Needs track check'),
        status: normalizeText(song?.status).toLowerCase() || 'requested',
        statusLabel: playable ? 'Track ready' : 'Needs track',
        statusTone: playable ? 'success' : 'warning',
        artworkUrl: normalizeText(song?.albumArtUrl || song?.artworkUrl100 || song?.artworkUrl),
        avatarUrl: normalizeText(song?.photoUrl || song?.crowdSelfieUrl || song?.avatarUrl || song?.profileImageUrl),
        avatarEmoji: normalizeText(song?.emoji || song?.avatar),
        playable,
        sourceLabel: normalizeText(sourceLabel),
        reason: normalizeText(reason),
        raw: song,
    };
};

const buildSceneObject = (scene = {}, {
    role = 'candidate',
    reason = '',
} = {}) => {
    const id = normalizeText(scene?.id);
    if (!id) return null;
    const durationSec = Math.max(0, Math.round(clampNumber(scene?.durationSec)));
    return {
        id,
        objectType: 'scene',
        objectRole: role,
        title: normalizeText(scene?.title) || 'Scene',
        subtitle: durationSec > 0 ? `${durationSec}s TV takeover` : 'TV takeover',
        detail: normalizeText(scene?.sceneAudienceReactionMode) || 'Audience visual',
        status: 'available',
        statusLabel: 'Scene ready',
        statusTone: 'info',
        artworkUrl: normalizeText(scene?.thumbnailUrl || scene?.previewUrl || scene?.imageUrl),
        avatarUrl: '',
        avatarEmoji: '',
        playable: true,
        sourceLabel: 'Scene',
        reason: normalizeText(reason),
        raw: scene,
    };
};

const buildRunOfShowObject = (item = {}, {
    role = 'next',
    reason = '',
} = {}) => {
    const id = normalizeText(item?.id);
    if (!id) return null;
    const itemType = normalizeText(item?.type || item?.itemType).toLowerCase();
    const objectType = itemType === 'performance'
        ? 'performance'
        : itemType === 'scene' || itemType === 'announcement'
            ? 'scene'
            : 'moment';
    const performerLabel = normalizeText(
        item?.performerName
        || item?.assignedPerformerName
        || item?.assignedSingerName
        || item?.singerName
    );
    const songLabel = normalizeText(item?.songTitle || item?.trackTitle);
    const artistLabel = normalizeText(item?.artistName || item?.artist);
    const title = normalizeText(item?.title || item?.label || item?.name)
        || (objectType === 'performance' ? 'Planned performance' : 'Planned moment');
    return {
        id,
        objectType,
        objectRole: role,
        title: performerLabel || title,
        subtitle: performerLabel
            ? ([songLabel, artistLabel].filter(Boolean).join(' — ') || title)
            : (normalizeText(item?.description) || (objectType === 'performance' && songLabel ? songLabel : 'Planned next object')),
        detail: normalizeText(item?.status) || normalizeText(itemType) || 'planned',
        status: normalizeText(item?.status).toLowerCase() || 'planned',
        statusLabel: normalizeText(item?.status) || 'Planned',
        statusTone: objectType === 'moment' ? 'info' : 'success',
        artworkUrl: '',
        avatarUrl: '',
        avatarEmoji: normalizeText(item?.emoji || item?.avatar),
        playable: true,
        sourceLabel: 'Show',
        reason: normalizeText(reason),
        raw: item,
    };
};

const buildAttentionItems = ({
    queueNeedsAttention = 0,
    inboxTotalCount = 0,
    deferredTrackCheckCount = 0,
    moderationPendingCount = 0,
    runOfShowNeedsAttentionCount = 0,
    activeReleaseWindow = null,
    postPerformanceBackingPrompt = null,
} = {}) => {
    const items = [];
    if (queueNeedsAttention > 0) {
        items.push({
            id: 'attention-queue',
            objectType: 'attention',
            title: `${queueNeedsAttention} queue issue${queueNeedsAttention === 1 ? '' : 's'}`,
            subtitle: 'Queue needs host intervention',
            tone: 'warning',
        });
    }
    if (inboxTotalCount > 0) {
        items.push({
            id: 'attention-inbox',
            objectType: 'attention',
            title: `${inboxTotalCount} inbox item${inboxTotalCount === 1 ? '' : 's'}`,
            subtitle: 'DMs, co-host notes, or moderation',
            tone: 'info',
        });
    }
    if (deferredTrackCheckCount > 0 || postPerformanceBackingPrompt) {
        items.push({
            id: 'attention-track-check',
            objectType: 'attention',
            title: postPerformanceBackingPrompt ? 'Track check pending now' : `${deferredTrackCheckCount} deferred track check${deferredTrackCheckCount === 1 ? '' : 's'}`,
            subtitle: 'Backing feedback still needs review',
            tone: 'warning',
        });
    }
    if (moderationPendingCount > 0) {
        items.push({
            id: 'attention-moderation',
            objectType: 'attention',
            title: `${moderationPendingCount} moderation item${moderationPendingCount === 1 ? '' : 's'}`,
            subtitle: 'Audience review is waiting',
            tone: 'danger',
        });
    }
    if (runOfShowNeedsAttentionCount > 0) {
        items.push({
            id: 'attention-show',
            objectType: 'attention',
            title: `${runOfShowNeedsAttentionCount} show blocker${runOfShowNeedsAttentionCount === 1 ? '' : 's'}`,
            subtitle: 'Run of show needs review',
            tone: 'warning',
        });
    }
    if (activeReleaseWindow?.active) {
        items.push({
            id: 'attention-release-window',
            objectType: 'attention',
            title: normalizeText(activeReleaseWindow?.itemTitle) || 'Vote window live',
            subtitle: normalizeText(activeReleaseWindow?.prompt) || 'Audience or co-host decision is active',
            tone: 'info',
        });
    }
    return items.slice(0, 4);
};

const deriveRuntimeModeEmphasis = ({
    room = null,
    runOfShowEnabled = false,
    activeReleaseWindow = null,
} = {}) => {
    const prefValue = getHostRuntimeModeEmphasis(room);
    if (prefValue && prefValue !== HOST_RUNTIME_MODE_EMPHASES.hostLed) return prefValue;
    const governanceMode = normalizeText(activeReleaseWindow?.governanceMode).toLowerCase();
    if (governanceMode === 'crowd_vote') return HOST_RUNTIME_MODE_EMPHASES.audienceLed;
    if (governanceMode === 'cohost_vote') return HOST_RUNTIME_MODE_EMPHASES.collaborative;
    if (runOfShowEnabled) return HOST_RUNTIME_MODE_EMPHASES.curatedShowcase;
    return HOST_RUNTIME_MODE_EMPHASES.hostLed;
};

const buildCandidateGroup = (title = '', helper = '', items = []) => ({
    id: title.toLowerCase().replace(/\s+/g, '_'),
    title,
    helper,
    items: items.filter(Boolean),
});

const buildQueuePreview = ({
    nextQueueSong = null,
    queue = [],
    assigned = [],
    held = [],
    reviewRequired = [],
} = {}) => {
    const preview = [];
    const pushUnique = (item) => {
        if (!item?.id) return;
        if (preview.some((entry) => entry.id === item.id)) return;
        preview.push(item);
    };

    pushUnique(buildPerformanceObject(nextQueueSong, {
        role: 'next',
        reason: 'Next in queue',
    }));

    (Array.isArray(queue) ? queue : []).slice(0, 4).forEach((song, index) => {
        pushUnique(buildPerformanceObject(song, {
            role: index === 0 ? 'next' : 'rotation',
            reason: index === 0 ? 'Next in queue' : 'Queued and waiting',
        }));
    });

    (Array.isArray(assigned) ? assigned : []).slice(0, 2).forEach((song) => {
        pushUnique(buildPerformanceObject(song, {
            role: 'candidate',
            reason: 'Assigned to tonight',
        }));
    });

    (Array.isArray(held) ? held : []).slice(0, 2).forEach((song) => {
        pushUnique(buildPerformanceObject(song, {
            role: 'candidate',
            reason: 'Held nearby',
        }));
    });

    (Array.isArray(reviewRequired) ? reviewRequired : []).slice(0, 1).forEach((song) => {
        pushUnique(buildPerformanceObject(song, {
            role: 'candidate',
            reason: 'Needs host pick',
        }));
    });

    return preview.slice(0, 4);
};

const buildShowBeatFlow = ({
    runOfShowEnabled = false,
    runOfShowStagedItem = null,
    runOfShowNextItem = null,
    assigned = [],
    scenePresets = [],
    activeReleaseWindow = null,
} = {}) => {
    const beats = [];
    const pushUnique = (item) => {
        if (!item?.id) return;
        if (beats.some((entry) => entry.id === item.id)) return;
        beats.push(item);
    };

    if (runOfShowEnabled) {
        pushUnique(buildRunOfShowObject(runOfShowStagedItem, { role: 'next', reason: 'Staged' }));
        pushUnique(buildRunOfShowObject(runOfShowNextItem, { role: 'upcoming', reason: 'On deck' }));
    }

    (Array.isArray(assigned) ? assigned : []).slice(0, 2).forEach((song) => {
        pushUnique(buildPerformanceObject(song, {
            role: 'upcoming',
            reason: 'Assigned beat',
        }));
    });

    (Array.isArray(scenePresets) ? scenePresets : []).slice(0, 2).forEach((scene) => {
        pushUnique(buildSceneObject(scene, {
            role: 'upcoming',
            reason: 'Scene beat',
        }));
    });

    if (activeReleaseWindow?.active) {
        pushUnique({
            id: normalizeText(activeReleaseWindow?.itemId || 'release_window'),
            objectType: 'moment',
            objectRole: 'upcoming',
            title: normalizeText(activeReleaseWindow?.itemTitle) || 'Vote Window',
            subtitle: normalizeText(activeReleaseWindow?.prompt) || 'Audience decision',
            detail: normalizeText(activeReleaseWindow?.governanceMode) || 'Live vote',
            status: 'active',
            statusLabel: 'Vote',
            statusTone: 'info',
            artworkUrl: '',
            avatarUrl: '',
            avatarEmoji: '',
            playable: true,
            sourceLabel: 'Audience',
            reason: 'Live beat',
            raw: activeReleaseWindow,
        });
    }

    return beats.slice(0, 4);
};

export const buildHostRuntimeShellModel = ({
    room = null,
    current = null,
    nextQueueSong = null,
    queue = [],
    reviewRequired = [],
    assigned = [],
    held = [],
    scenePresets = [],
    deferredTrackChecks = [],
    postPerformanceBackingPrompt = null,
    queueNeedsAttention = 0,
    inboxTotalCount = 0,
    moderationPendingCount = 0,
    runOfShowEnabled = false,
    runOfShowStagedItem = null,
    runOfShowNextItem = null,
    runOfShowNeedsAttentionCount = 0,
    currentSourceLabel = '',
    currentSourcePlaying = false,
    activeReleaseWindow = null,
    autoDj = false,
    nowMs = Date.now(),
} = {}) => {
    const currentPerformance = current
        ? buildPerformanceObject(current, {
            role: 'live',
            sourceLabel: currentSourceLabel,
            reason: currentSourcePlaying ? 'Live now' : 'Paused on stage',
        })
        : null;

    const plannedNextObject = runOfShowEnabled
        ? (buildRunOfShowObject(runOfShowStagedItem, { role: 'next', reason: 'Show is staged next' })
            || buildRunOfShowObject(runOfShowNextItem, { role: 'next', reason: 'Show is on deck' }))
        : null;

    const nextPerformance = plannedNextObject
        || buildPerformanceObject(nextQueueSong, {
            role: 'next',
            reason: 'Next committed performance',
        });

    const rotationFlow = (Array.isArray(queue) ? queue : [])
        .slice(0, 4)
        .map((song, index) => buildPerformanceObject(song, {
            role: index === 0 ? 'next' : 'rotation',
            reason: index === 0 ? 'Next in queue' : 'Rotation lane',
        }))
        .filter(Boolean);
    const queuePreview = buildQueuePreview({
        nextQueueSong,
        queue,
        assigned,
        held,
        reviewRequired,
    });

    const reviewCandidates = (Array.isArray(reviewRequired) ? reviewRequired : []).slice(0, 2).map((song) => buildPerformanceObject(song, {
            role: 'candidate',
            reason: 'Needs host pick',
        }));
    const queuedCandidates = (Array.isArray(queue) ? queue : []).slice(1, 4).map((song) => buildPerformanceObject(song, {
            role: 'candidate',
            reason: 'Queued and waiting',
        }));
    const assignedCandidates = (Array.isArray(assigned) ? assigned : []).slice(0, 2).map((song) => buildPerformanceObject(song, {
            role: 'candidate',
            reason: 'Assigned to show',
        }));
    const sceneCandidates = (Array.isArray(scenePresets) ? scenePresets : []).slice(0, 3).map((scene) => buildSceneObject(scene, {
            role: 'candidate',
            reason: 'Scene candidate',
        }));
    const heldCandidates = (Array.isArray(held) ? held : []).slice(0, 2).map((song) => buildPerformanceObject(song, {
            role: 'candidate',
            reason: 'Held for later',
        }));

    const candidateGroups = [
        buildCandidateGroup('Needs Host Pick', 'Resolve these before they turn into friction.', reviewCandidates),
        buildCandidateGroup('Queued & Waiting', 'Good candidates that are already in motion.', queuedCandidates),
        buildCandidateGroup('Assigned / Planned', 'Committed or staged for the night.', assignedCandidates),
        buildCandidateGroup('Scene Candidates', 'TV moments, crowd beats, and takeover options.', sceneCandidates),
        buildCandidateGroup('Held For Later', 'Kept nearby without cluttering the live lane.', heldCandidates),
    ].filter((group) => group.items.length > 0);

    const candidatePool = candidateGroups.flatMap((group) => group.items).slice(0, 8);
    const showBeatFlow = buildShowBeatFlow({
        runOfShowEnabled,
        runOfShowStagedItem,
        runOfShowNextItem,
        assigned,
        scenePresets,
        activeReleaseWindow,
    });

    const attentionItems = buildAttentionItems({
        queueNeedsAttention,
        inboxTotalCount,
        deferredTrackCheckCount: Array.isArray(deferredTrackChecks) ? deferredTrackChecks.length : 0,
        moderationPendingCount,
        runOfShowNeedsAttentionCount,
        activeReleaseWindow,
        postPerformanceBackingPrompt,
    });

    const playbackProgress = resolvePlaybackProgress({
        room,
        current,
        currentSourcePlaying,
        nowMs,
    });

    return {
        topQuestions: {
            liveNow: currentPerformance,
            nextCommitted: nextPerformance,
            needsIntervention: attentionItems[0] || null,
        },
        runtimeModeEmphasis: deriveRuntimeModeEmphasis({
            room,
            runOfShowEnabled,
            activeReleaseWindow,
        }),
        currentPerformance,
        nextPerformance,
        rotationFlow,
        queuePreview,
        showBeatFlow,
        candidatePool,
        attentionItems,
        playback: {
            sourceLabel: normalizeText(currentSourceLabel) || 'No source',
            playing: !!currentSourcePlaying,
            singerName: normalizeText(current?.singerName || current?.performerName || current?.displayName),
            songTitle: normalizeText(current?.songTitle || current?.title),
            artistName: normalizeText(current?.artist || current?.artistName),
            mediaUrl: normalizeText(current?.mediaUrl || room?.currentPerformanceMeta?.mediaUrl || room?.mediaUrl),
            avatarUrl: normalizeText(current?.photoUrl || current?.crowdSelfieUrl || current?.avatarUrl || current?.profileImageUrl),
            avatarEmoji: normalizeText(current?.emoji || current?.avatar),
            ...playbackProgress,
        },
        trackCheckState: {
            hasPendingPrompt: !!postPerformanceBackingPrompt,
            deferredCount: Array.isArray(deferredTrackChecks) ? deferredTrackChecks.length : 0,
        },
        candidateGroups,
        roomControlsSummary: {
            autoDj: !!autoDj,
            readyCheckActive: room?.readyCheck?.active === true,
            activeMode: normalizeText(room?.activeMode).toLowerCase() || 'karaoke',
            runOfShowEnabled: !!runOfShowEnabled,
        },
    };
};

export default buildHostRuntimeShellModel;
