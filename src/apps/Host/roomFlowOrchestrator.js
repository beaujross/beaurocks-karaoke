import { getAutoDjQueueAdvanceIntent } from './autoDjStateMachine.js';
import {
    getDeadAirAutoFillIntent,
    isDeadAirAutoFillQueueItem
} from './deadAirAutopilot.js';
import {
    recommendAutoCrowdMoment
} from './partyOrchestrator.js';
import {
    RUN_OF_SHOW_PROGRAM_MODES,
    normalizeRunOfShowProgramMode
} from '../../lib/runOfShowDirector.js';

const APPLAUSE_PHASES = new Set(['applause_countdown', 'applause', 'applause_result']);

const normalizeText = (value = '') => String(value || '').trim();
const normalizeKey = (value = '') => normalizeText(value).toLowerCase();

const defaultIsQueueEntryPlayable = (song = {}, { appleMusicEnabled = true } = {}) => {
    const mediaResolutionStatus = normalizeKey(song?.mediaResolutionStatus);
    if (mediaResolutionStatus === 'needs_backing') return false;
    if (song?.playbackReady === false) return false;
    const appleMusicId = normalizeText(song?.appleMusicId);
    if (appleMusicId) return !!appleMusicEnabled;
    return !!normalizeText(song?.mediaUrl || song?.youtubeId);
};

export const ROOM_FLOW_OWNERS = Object.freeze({
    missingRoom: 'missing_room',
    runOfShow: 'run_of_show',
    performance: 'performance_live',
    applause: 'applause_flow',
    readyCheck: 'ready_check_live',
    autoMoment: 'auto_moment_live',
    otherMode: 'other_mode_live',
    betweenSingers: 'between_singers_bridge_armed',
    deadAirRecovery: 'dead_air_recovery_armed',
    queueReady: 'queue_ready',
    idle: 'idle_waiting'
});

export const getRoomFlowSnapshot = ({
    roomCode = '',
    room = {},
    songs = [],
    autoDjEnabled = false,
    appleMusicEnabled = true,
    party = {},
    assistLevel = '',
    lastPerformanceTs = 0,
    queuedCount = 0,
    performingCount = 0,
    fallbackDeadAirSongs = [],
    runOfShowLiveItem = null,
    runOfShowStagedItem = null,
    runOfShowNextItem = null,
    autoDjDelaySec = 10,
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
    const queuedPlayableSongs = list
        .filter((song) => (
            song?.status === 'requested'
            && isQueueEntryPlayable(song, { appleMusicEnabled })
        ))
        .sort((a, b) => (a.priorityScore || 0) - (b.priorityScore || 0));
    const nextQueuedSong = queuedPlayableSongs[0] || null;
    const nextQueuedSongIsDeadAir = isDeadAirAutoFillQueueItem(nextQueuedSong);

    const autoDjIntent = getAutoDjQueueAdvanceIntent({
        autoDjEnabled,
        activeMode: room?.activeMode,
        readyCheckActive,
        autoMomentLive,
        runOfShowEnabled: runOfShowActive,
        programMode: normalizedProgramMode,
        songs: list,
        appleMusicEnabled,
        lastPerformanceTs,
        autoDjDelaySec,
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
        runOfShowEnabled: runOfShowActive,
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
    } else if (runOfShowActive && (runOfShowLiveItem || runOfShowStagedItem || runOfShowNextItem)) {
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
    } else if (autoPartyIntent.shouldStart) {
        owner = ROOM_FLOW_OWNERS.betweenSingers;
    } else if (deadAirIntent.shouldQueue) {
        owner = ROOM_FLOW_OWNERS.deadAirRecovery;
    } else if (nextQueuedSong?.id) {
        owner = ROOM_FLOW_OWNERS.queueReady;
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
        queuedCount: effectiveQueuedCount,
        performingCount: effectivePerformingCount,
        autoDjIntent,
        autoPartyIntent,
        deadAirIntent
    };
};
