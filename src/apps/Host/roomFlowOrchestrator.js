import { getAutoDjQueueAdvanceIntent } from './autoDjStateMachine.js';
import {
    getQueueEntryPerformanceReadiness,
    isQueueEntryPlayable as baseIsQueueEntryPlayable,
    normalizePerformanceMode,
    performanceModeRequiresOriginalRecording,
} from '../../lib/playbackSource.js';
import {
    getDeadAirAutoFillIntent,
    isDeadAirAutoFillQueueItem
} from './deadAirAutopilot.js';
import {
    recommendAutoCrowdMoment
} from './partyOrchestrator.js';
import {
    RUN_OF_SHOW_PROGRAM_MODES,
    normalizeRunOfShowProgramMode,
    normalizeRunOfShowPolicy,
    getRunOfShowItemReadiness,
    getRunOfShowBlockedActionLabel
} from '../../lib/runOfShowDirector.js';

const APPLAUSE_PHASES = new Set(['applause_countdown', 'applause', 'applause_result']);

const normalizeText = (value = '') => String(value || '').trim();
const normalizeKey = (value = '') => normalizeText(value).toLowerCase();

const defaultIsQueueEntryPlayable = (song = {}, options = {}) => {
    const mediaResolutionStatus = normalizeKey(song?.mediaResolutionStatus);
    if (mediaResolutionStatus === 'needs_backing' || mediaResolutionStatus === 'pending_youtube_match') return false;
    return baseIsQueueEntryPlayable(song, options);
};

export const ROOM_FLOW_OWNERS = Object.freeze({
    missingRoom: 'missing_room',
    runOfShow: 'run_of_show',
    runOfShowBlocked: 'run_of_show_blocked',
    performance: 'performance_live',
    applause: 'applause_flow',
    readyCheck: 'ready_check_live',
    autoMoment: 'auto_moment_live',
    otherMode: 'other_mode_live',
    betweenSingers: 'between_singers_bridge_armed',
    deadAirRecovery: 'dead_air_recovery_armed',
    queueReady: 'queue_ready',
    formatReview: 'format_review',
    idle: 'idle_waiting'
});

const getRunOfShowCoverageState = ({
    runOfShowActive = false,
    runOfShowLiveItem = null,
    runOfShowStagedItem = null,
    runOfShowNextItem = null,
    runOfShowPolicy = {},
    runOfShowPendingCountsById = {},
} = {}) => {
    const normalizedPolicy = normalizeRunOfShowPolicy(runOfShowPolicy || {});
    if (!runOfShowActive) {
        return {
            active: false,
            shouldHoldRoom: false,
            blocked: false,
            allowQueueFill: false,
            detail: '',
            candidateItem: null,
        };
    }
    if (runOfShowLiveItem?.id) {
        return {
            active: true,
            shouldHoldRoom: true,
            blocked: false,
            allowQueueFill: false,
            detail: '',
            candidateItem: runOfShowLiveItem,
        };
    }

    const candidateItem = runOfShowStagedItem || runOfShowNextItem || null;
    if (!candidateItem?.id) {
        return {
            active: true,
            shouldHoldRoom: false,
            blocked: true,
            allowQueueFill: false,
            detail: 'Auto-Advance is on, but there is no next lineup item ready to start.',
            candidateItem: null,
        };
    }

    const pendingSubmissionCount = Math.max(
        0,
        Number(runOfShowPendingCountsById?.[candidateItem.id] || 0) || 0
    );
    const readiness = getRunOfShowItemReadiness(candidateItem, { pendingSubmissionCount });
    const status = normalizeKey(candidateItem?.status || '');
    const blocked = status === 'blocked' || readiness?.ready !== true;

    if (!blocked) {
        return {
            active: true,
            shouldHoldRoom: true,
            blocked: false,
            allowQueueFill: false,
            detail: '',
            candidateItem,
        };
    }

    return {
        active: true,
        shouldHoldRoom: false,
        blocked: true,
        allowQueueFill: normalizedPolicy.queueDivergencePolicy === 'queue_can_fill_gaps',
        detail: getRunOfShowBlockedActionLabel(readiness, candidateItem, normalizedPolicy),
        candidateItem,
        readiness,
    };
};

export const getRoomFlowSnapshot = ({
    roomCode = '',
    room = {},
    songs = [],
    autoDjEnabled = false,
    appleMusicEnabled = true,
    performanceMode = '',
    party = {},
    assistLevel = '',
    lastPerformanceTs = 0,
    autoPartyEligiblePerformanceTs = null,
    queuedCount = 0,
    performingCount = 0,
    fallbackDeadAirSongs = [],
    runOfShowLiveItem = null,
    runOfShowStagedItem = null,
    runOfShowNextItem = null,
    runOfShowPolicy = {},
    runOfShowPendingCountsById = {},
    autoDjDelaySec = 10,
    postPerformanceHoldMs = 0,
    now = Date.now(),
    isQueueEntryPlayable = defaultIsQueueEntryPlayable
} = {}) => {
    const safeRoomCode = normalizeText(roomCode);
    const list = Array.isArray(songs) ? songs : [];
    const normalizedActiveMode = normalizeKey(room?.activeMode || 'karaoke') || 'karaoke';
    const normalizedProgramMode = normalizeRunOfShowProgramMode(room?.programMode);
    const runOfShowActive = room?.runOfShowEnabled === true
        || normalizedProgramMode === RUN_OF_SHOW_PROGRAM_MODES.runOfShow;
    const readyCheckActive = room?.readyCheck?.active === true;
    const autoMomentLive = normalizeKey(room?.missionControl?.autoMoment?.status) === 'live';
    const applauseFlowActive = APPLAUSE_PHASES.has(normalizedActiveMode);
    const effectiveQueuedCount = Math.max(
        0,
        Number(queuedCount || 0) || 0,
        list.filter((song) => song?.status === 'requested').length
    );
    const effectivePerformingCount = Math.max(
        0,
        Number(performingCount || 0) || 0,
        list.filter((song) => song?.status === 'performing').length
    );
    const effectivePerformanceMode = normalizePerformanceMode(
        performanceMode
        || room?.performanceMode
        || room?.missionControl?.setupDraft?.performanceMode
    );
    const originalRecordingRequired = performanceModeRequiresOriginalRecording(effectivePerformanceMode);
    const orderedRequestedSongs = list
        .filter((song) => song?.status === 'requested')
        .sort((a, b) => (a.priorityScore || 0) - (b.priorityScore || 0));
    const getFormatReadiness = (song = {}) => getQueueEntryPerformanceReadiness(song, {
        performanceMode: effectivePerformanceMode,
        appleMusicEnabled,
        basePlayable: isQueueEntryPlayable(song, { appleMusicEnabled }),
    });
    const firstRequestedSong = orderedRequestedSongs[0] || null;
    const firstRequestedFormatReadiness = firstRequestedSong
        ? getFormatReadiness(firstRequestedSong)
        : null;
    const queuedPlayableSongs = originalRecordingRequired
        ? (firstRequestedFormatReadiness?.autopilotReady ? [firstRequestedSong] : [])
        : orderedRequestedSongs.filter((song) => getFormatReadiness(song).autopilotReady);
    const formatReview = originalRecordingRequired
        && firstRequestedFormatReadiness?.manuallyPlayable
        && !firstRequestedFormatReadiness?.autopilotReady
        ? { song: firstRequestedSong, readiness: firstRequestedFormatReadiness }
        : null;
    const nextQueuedSong = queuedPlayableSongs[0] || null;
    const nextQueuedSongIsDeadAir = isDeadAirAutoFillQueueItem(nextQueuedSong);
    const runOfShowCoverage = getRunOfShowCoverageState({
        runOfShowActive,
        runOfShowLiveItem,
        runOfShowStagedItem,
        runOfShowNextItem,
        runOfShowPolicy,
        runOfShowPendingCountsById,
    });

    const autoDjIntent = getAutoDjQueueAdvanceIntent({
        autoDjEnabled,
        activeMode: room?.activeMode,
        readyCheckActive,
        autoMomentLive,
        runOfShowEnabled: runOfShowCoverage.shouldHoldRoom || (runOfShowActive && !runOfShowCoverage.blocked),
        programMode: normalizedProgramMode,
        songs: list,
        appleMusicEnabled,
        performanceMode: effectivePerformanceMode,
        lastPerformanceTs,
        autoDjDelaySec,
        postPerformanceHoldMs,
        now,
        isQueueEntryPlayable
    });

    let autoPartyIntent = {
        shouldStart: false,
        reason: 'disabled',
        moment: null
    };
    const explicitAutoPartyEnabled = party?.autoCrowdMomentsEnabled === true;
    const normalizedAssistLevel = normalizeKey(assistLevel);
    const effectiveAutoPartyEligiblePerformanceTs = autoPartyEligiblePerformanceTs == null
        ? Number(lastPerformanceTs || 0)
        : Number(autoPartyEligiblePerformanceTs || 0);
    if (!safeRoomCode) {
        autoPartyIntent = { shouldStart: false, reason: 'missing_room', moment: null };
    } else if (!autoDjEnabled) {
        autoPartyIntent = { shouldStart: false, reason: 'auto_dj_off', moment: null };
    } else if (runOfShowActive) {
        autoPartyIntent = { shouldStart: false, reason: 'run_of_show_active', moment: null };
    } else if (readyCheckActive) {
        autoPartyIntent = { shouldStart: false, reason: 'ready_check_live', moment: null };
    } else if (autoMomentLive) {
        autoPartyIntent = { shouldStart: false, reason: 'auto_moment_live', moment: null };
    } else if (normalizedAssistLevel !== 'autopilot_first' && !explicitAutoPartyEnabled) {
        autoPartyIntent = { shouldStart: false, reason: 'disabled', moment: null };
    } else if (!Number(lastPerformanceTs || 0)) {
        autoPartyIntent = { shouldStart: false, reason: 'no_last_performance', moment: null };
    } else if (effectiveAutoPartyEligiblePerformanceTs !== Number(lastPerformanceTs || 0)) {
        autoPartyIntent = { shouldStart: false, reason: 'performance_not_eligible', moment: null };
    } else if (effectiveQueuedCount <= 0) {
        autoPartyIntent = { shouldStart: false, reason: 'empty_queue', moment: null };
    } else if (!nextQueuedSong?.id) {
        autoPartyIntent = { shouldStart: false, reason: 'no_playable_queue', moment: null };
    } else if (nextQueuedSongIsDeadAir) {
        autoPartyIntent = { shouldStart: false, reason: 'dead_air_autofill_next', moment: null };
    } else {
        const recommendedMoment = recommendAutoCrowdMoment({
            party,
            flowState: party?.state || {},
            queueDepth: effectiveQueuedCount,
            hasCurrentSinger: effectivePerformingCount > 0,
            activeMode: room?.activeMode,
            currentLightMode: room?.lightMode
        });
        autoPartyIntent = recommendedMoment.allowed
            ? {
                shouldStart: true,
                reason: 'ready',
                moment: recommendedMoment
            }
            : {
                shouldStart: false,
                reason: recommendedMoment.reason || 'not_allowed',
                moment: null
            };
    }

    const deadAirIntent = getDeadAirAutoFillIntent({
        roomCode: safeRoomCode,
        deadAirFiller: room?.missionControl?.deadAirFiller || {},
        autoDjEnabled,
        queuedCount: effectiveQueuedCount,
        performingCount: effectivePerformingCount,
        runOfShowEnabled: runOfShowCoverage.shouldHoldRoom || (runOfShowActive && !runOfShowCoverage.blocked),
        programMode: normalizedProgramMode,
        activeMode: room?.activeMode,
        sourceSongs: room?.missionControl?.deadAirFiller?.songs,
        fallbackSongs: fallbackDeadAirSongs,
        songs: list,
        lastPerformanceTs,
        previousFillKey: '',
        autoDjDelaySec
    });

    let owner = ROOM_FLOW_OWNERS.idle;
    if (!safeRoomCode) {
        owner = ROOM_FLOW_OWNERS.missingRoom;
    } else if (runOfShowCoverage.shouldHoldRoom) {
        owner = ROOM_FLOW_OWNERS.runOfShow;
    } else if (effectivePerformingCount > 0) {
        owner = ROOM_FLOW_OWNERS.performance;
    } else if (applauseFlowActive) {
        owner = ROOM_FLOW_OWNERS.applause;
    } else if (readyCheckActive) {
        owner = ROOM_FLOW_OWNERS.readyCheck;
    } else if (autoMomentLive) {
        owner = ROOM_FLOW_OWNERS.autoMoment;
    } else if (normalizedActiveMode && normalizedActiveMode !== 'karaoke') {
        owner = ROOM_FLOW_OWNERS.otherMode;
    } else if (formatReview) {
        owner = ROOM_FLOW_OWNERS.formatReview;
    } else if (autoPartyIntent.shouldStart) {
        owner = ROOM_FLOW_OWNERS.betweenSingers;
    } else if (deadAirIntent.shouldQueue) {
        owner = ROOM_FLOW_OWNERS.deadAirRecovery;
    } else if (nextQueuedSong?.id && (autoDjIntent.shouldStart || autoDjIntent.reason === 'waiting_delay')) {
        owner = ROOM_FLOW_OWNERS.queueReady;
    } else if (runOfShowCoverage.blocked) {
        owner = ROOM_FLOW_OWNERS.runOfShowBlocked;
    }

    return {
        owner,
        roomCode: safeRoomCode,
        runOfShowActive,
        normalizedProgramMode,
        readyCheckActive,
        autoMomentLive,
        applauseFlowActive,
        nextQueuedSong,
        nextQueuedSongIsDeadAir,
        queuedPlayableSongs,
        performanceMode: effectivePerformanceMode,
        formatReview,
        queuedCount: effectiveQueuedCount,
        performingCount: effectivePerformingCount,
        runOfShowCoverage,
        autoDjIntent,
        autoPartyIntent,
        deadAirIntent
    };
};
