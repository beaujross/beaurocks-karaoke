const STEP_IDS = ['stage', 'applause', 'scoring', 'transition'];
const APPLAUSE_PHASES = new Set(['applause_countdown', 'applause', 'applause_result']);

const clampDelaySec = (value = 10) => Math.max(2, Math.min(45, Number(value || 10) || 10));

const defaultIsQueueEntryPlayable = (song = {}, { appleMusicEnabled = true } = {}) => {
    const mediaResolutionStatus = String(song?.mediaResolutionStatus || '').trim().toLowerCase();
    if (mediaResolutionStatus === 'needs_backing') return false;
    if (song?.playbackReady === false) return false;
    const appleMusicId = String(song?.appleMusicId || '').trim();
    if (appleMusicId) return !!appleMusicEnabled;
    return !!String(song?.mediaUrl || song?.youtubeId || '').trim();
};

export const AUTO_DJ_EVENTS = {
    START: 'start',
    STAGE_READY: 'stage_ready',
    APPLAUSE_STARTED: 'applause_started',
    APPLAUSE_RESULT: 'applause_result',
    SCORING_COMPLETE: 'scoring_complete',
    TRANSITION_COMPLETE: 'transition_complete',
    FAIL: 'fail',
    RETRY: 'retry',
    RESET: 'reset'
};

export const AUTO_DJ_STEP_META = {
    stage: { id: 'stage', label: 'Stage Next', short: 'Stage' },
    applause: { id: 'applause', label: 'Measure Applause', short: 'Applause' },
    scoring: { id: 'scoring', label: 'Finalize Scoring', short: 'Scoring' },
    transition: { id: 'transition', label: 'Transition Queue', short: 'Transition' }
};

export const createAutoDjSequenceState = (now = Date.now()) => ({
    songId: '',
    phase: 'idle',
    status: 'idle',
    retriesByStep: {},
    retryLimit: 2,
    lastEvent: '',
    error: '',
    updatedAtMs: Number(now || Date.now()),
    completedSongId: ''
});

export const getAutoDjQueueAdvanceIntent = ({
    autoDjEnabled = false,
    activeMode = '',
    readyCheckActive = false,
    autoMomentLive = false,
    runOfShowEnabled = false,
    programMode = '',
    songs = [],
    appleMusicEnabled = true,
    lastPerformanceTs = 0,
    autoDjDelaySec = 10,
    now = Date.now(),
    isQueueEntryPlayable = defaultIsQueueEntryPlayable
} = {}) => {
    if (!autoDjEnabled) {
        return { shouldStart: false, reason: 'disabled' };
    }
    const normalizedProgramMode = String(programMode || '').trim().toLowerCase();
    if (runOfShowEnabled === true && normalizedProgramMode === 'run_of_show') {
        return { shouldStart: false, reason: 'run_of_show_active' };
    }
    const normalizedActiveMode = String(activeMode || '').trim().toLowerCase();
    if (APPLAUSE_PHASES.has(normalizedActiveMode)) {
        return { shouldStart: false, reason: 'applause_active' };
    }
    if (readyCheckActive) {
        return { shouldStart: false, reason: 'ready_check_active' };
    }
    if (autoMomentLive) {
        return { shouldStart: false, reason: 'auto_moment_live' };
    }
    if (normalizedActiveMode && normalizedActiveMode !== 'karaoke') {
        return { shouldStart: false, reason: 'mode_active' };
    }

    const list = Array.isArray(songs) ? songs : [];
    if (list.some((song) => song?.status === 'performing')) {
        return { shouldStart: false, reason: 'performer_on_stage' };
    }

    const queued = list
        .filter((song) => (
            song?.status === 'requested'
            && isQueueEntryPlayable(song, { appleMusicEnabled })
        ))
        .sort((a, b) => (a.priorityScore || 0) - (b.priorityScore || 0));
    const next = queued[0] || null;
    if (!next?.id) {
        return { shouldStart: false, reason: 'no_playable_queue' };
    }

    const configuredDelaySec = clampDelaySec(autoDjDelaySec);
    const configuredDelayMs = configuredDelaySec * 1000;
    const safeLastPerformanceTs = Math.max(0, Number(lastPerformanceTs || 0) || 0);
    const safeNow = Number(now || Date.now()) || Date.now();
    const delayMs = safeLastPerformanceTs
        ? Math.max(0, Math.round((safeLastPerformanceTs + configuredDelayMs) - safeNow))
        : 0;
    if (delayMs > 0) {
        return {
            shouldStart: false,
            reason: 'waiting_delay',
            delayMs,
            startAfterMs: safeLastPerformanceTs + configuredDelayMs,
            songId: next.id,
            queueCount: queued.length
        };
    }

    const startKey = [
        next.id,
        queued.length,
        safeLastPerformanceTs,
        configuredDelayMs,
        next.mediaUrl || '',
        next.youtubeId || '',
        next.appleMusicId || '',
        next.playbackReady === false ? 'blocked' : 'ready',
        next.resolutionStatus || '',
        next.mediaResolutionStatus || ''
    ].join(':');

    return {
        shouldStart: true,
        reason: 'ready',
        songId: next.id,
        song: next,
        queueCount: queued.length,
        delayMs: 0,
        startKey
    };
};

const clampRetries = (value, limit = 2) => {
    const safe = Math.max(0, Math.round(Number(value || 0)));
    return Math.min(limit, safe);
};

const withBase = (prev, patch = {}, now = Date.now()) => ({
    ...prev,
    ...patch,
    updatedAtMs: Number(now || Date.now())
});

const nextPhaseFromEvent = (event = '') => {
    if (event === AUTO_DJ_EVENTS.START) return 'stage';
    if (event === AUTO_DJ_EVENTS.STAGE_READY) return 'applause';
    if (event === AUTO_DJ_EVENTS.APPLAUSE_STARTED) return 'applause';
    if (event === AUTO_DJ_EVENTS.APPLAUSE_RESULT) return 'scoring';
    if (event === AUTO_DJ_EVENTS.SCORING_COMPLETE) return 'transition';
    if (event === AUTO_DJ_EVENTS.TRANSITION_COMPLETE) return 'completed';
    return '';
};

const ALLOWED_EVENTS_BY_PHASE = Object.freeze({
    idle: new Set([AUTO_DJ_EVENTS.START, AUTO_DJ_EVENTS.RESET]),
    stage: new Set([AUTO_DJ_EVENTS.STAGE_READY, AUTO_DJ_EVENTS.APPLAUSE_STARTED, AUTO_DJ_EVENTS.APPLAUSE_RESULT, AUTO_DJ_EVENTS.START, AUTO_DJ_EVENTS.FAIL, AUTO_DJ_EVENTS.RETRY, AUTO_DJ_EVENTS.RESET]),
    applause: new Set([AUTO_DJ_EVENTS.APPLAUSE_STARTED, AUTO_DJ_EVENTS.APPLAUSE_RESULT, AUTO_DJ_EVENTS.FAIL, AUTO_DJ_EVENTS.RETRY, AUTO_DJ_EVENTS.RESET]),
    scoring: new Set([AUTO_DJ_EVENTS.SCORING_COMPLETE, AUTO_DJ_EVENTS.FAIL, AUTO_DJ_EVENTS.RETRY, AUTO_DJ_EVENTS.RESET]),
    transition: new Set([AUTO_DJ_EVENTS.TRANSITION_COMPLETE, AUTO_DJ_EVENTS.FAIL, AUTO_DJ_EVENTS.RETRY, AUTO_DJ_EVENTS.RESET]),
    completed: new Set([AUTO_DJ_EVENTS.START, AUTO_DJ_EVENTS.RESET])
});

const shouldAcceptEvent = (phase = 'idle', event = '', prevSongId = '', incomingSongId = '') => {
    const allowed = ALLOWED_EVENTS_BY_PHASE[phase] || ALLOWED_EVENTS_BY_PHASE.idle;
    if (!allowed.has(event)) return false;
    if (!incomingSongId || !prevSongId) return true;
    if (incomingSongId === prevSongId) return true;
    return event === AUTO_DJ_EVENTS.START || phase === 'completed' || phase === 'idle';
};

export const transitionAutoDjSequenceState = (prevState = createAutoDjSequenceState(), event = '', payload = {}, now = Date.now()) => {
    const prev = prevState || createAutoDjSequenceState(now);
    const songId = String(payload?.songId || prev.songId || '').trim();
    const phase = String(prev?.phase || 'idle');

    if (event === AUTO_DJ_EVENTS.RESET) {
        return createAutoDjSequenceState(now);
    }

    if (!shouldAcceptEvent(phase, event, String(prev?.songId || ''), songId)) {
        return withBase(prev, {
            lastEvent: `${event}_ignored`
        }, now);
    }

    if (event === AUTO_DJ_EVENTS.RETRY) {
        const stepId = STEP_IDS.includes(prev.phase) ? prev.phase : 'stage';
        const retriesByStep = {
            ...(prev.retriesByStep || {}),
            [stepId]: clampRetries((prev.retriesByStep || {})[stepId] + 1, Number(prev.retryLimit || 2))
        };
        return withBase(prev, {
            songId,
            status: 'retrying',
            retriesByStep,
            error: String(payload?.error || '').trim(),
            lastEvent: event
        }, now);
    }

    if (event === AUTO_DJ_EVENTS.FAIL) {
        const stepId = STEP_IDS.includes(prev.phase) ? prev.phase : 'stage';
        const retryLimit = Number(prev.retryLimit || 2);
        const rawAttempt = Math.max(0, Math.round(Number((prev.retriesByStep || {})[stepId] || 0))) + 1;
        const attempted = clampRetries(rawAttempt, retryLimit);
        const shouldRetry = rawAttempt <= retryLimit;
        const retriesByStep = {
            ...(prev.retriesByStep || {}),
            [stepId]: attempted
        };
        return withBase(prev, {
            songId,
            status: shouldRetry ? 'retrying' : 'error',
            retriesByStep,
            error: String(payload?.error || '').trim() || 'step_failed',
            lastEvent: event
        }, now);
    }

    if (event === AUTO_DJ_EVENTS.START && prev.phase !== 'idle' && prev.phase !== 'completed' && songId === String(prev.songId || '')) {
        return withBase(prev, {
            status: 'running',
            error: '',
            lastEvent: event
        }, now);
    }

    const nextPhase = nextPhaseFromEvent(event);
    if (!nextPhase) return prev;
    return withBase(prev, {
        songId,
        phase: nextPhase,
        status: nextPhase === 'completed' ? 'complete' : 'running',
        completedSongId: nextPhase === 'completed' ? songId || prev.songId || prev.completedSongId || '' : prev.completedSongId,
        error: '',
        lastEvent: event
    }, now);
};

export const deriveAutoDjStepItems = (state = createAutoDjSequenceState()) => {
    const phase = String(state?.phase || 'idle');
    const status = String(state?.status || 'idle');
    const phaseIdx = STEP_IDS.indexOf(phase);
    const completeAll = phase === 'completed';

    return STEP_IDS.map((id, idx) => {
        let stepStatus = 'pending';
        if (completeAll) {
            stepStatus = 'complete';
        } else if (phaseIdx >= 0 && idx < phaseIdx) {
            stepStatus = 'complete';
        } else if (phaseIdx === idx) {
            if (status === 'error') stepStatus = 'error';
            else if (status === 'retrying') stepStatus = 'retrying';
            else stepStatus = 'active';
        }
        return {
            ...(AUTO_DJ_STEP_META[id] || { id, label: id }),
            status: stepStatus,
            retries: Number(state?.retriesByStep?.[id] || 0)
        };
    });
};

export const describeAutoDjSequenceState = (state = createAutoDjSequenceState()) => {
    const phase = String(state?.phase || 'idle');
    if (phase === 'idle') {
        return {
            title: 'Auto DJ Idle',
            detail: 'Waiting for stage activity',
            tone: 'neutral'
        };
    }
    if (phase === 'completed') {
        return {
            title: 'Auto DJ Completed',
            detail: state?.completedSongId ? `Finished ${state.completedSongId}` : 'Sequence complete',
            tone: 'success'
        };
    }
    if (state?.status === 'error') {
        return {
            title: 'Auto DJ Attention',
            detail: state?.error || 'Step failed',
            tone: 'danger'
        };
    }
    if (state?.status === 'retrying') {
        return {
            title: 'Auto DJ Retrying',
            detail: state?.error || 'Attempting fallback',
            tone: 'warning'
        };
    }
    return {
        title: `Auto DJ ${AUTO_DJ_STEP_META[phase]?.short || 'Active'}`,
        detail: state?.songId ? `Song ${state.songId}` : 'Processing sequence',
        tone: 'info'
    };
};
