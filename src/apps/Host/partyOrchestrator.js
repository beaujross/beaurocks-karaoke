const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const PARTY_POLICY_DEFAULTS = Object.freeze({
    karaokeFirst: true,
    minSingingSharePct: 70,
    maxBreakDurationSec: 20,
    maxConsecutiveNonKaraokeModes: 1,
    queueDepthGuardThreshold: 8
});

export const PARTY_AUTO_MOMENT_DEFAULTS = Object.freeze({
    autoCrowdMomentsEnabled: false,
    autoCrowdMomentDelayMs: 400,
    autoCrowdMomentReadyCheckSec: 6,
    autoCrowdMomentVolleySec: 12,
    autoCrowdMomentPreferredTypes: ['volley', 'ready_check']
});

export const HEAVY_GROUP_MODES = new Set([
    'bingo',
    'doodle_oke',
    'selfie_challenge',
    'karaoke_bracket',
    'flappy_bird',
    'vocal_challenge',
    'riding_scales',
    'guitar',
    'strobe',
    'storm',
    'banger',
    'ballad'
]);

const AUTO_CROWD_MOMENT_TYPES = new Set(['ready_check', 'volley']);

const normalizePositiveInt = (value, fallback, min, max) => {
    const parsed = Math.floor(toNumber(value, fallback));
    return clamp(parsed, min, max);
};

const normalizeMomentType = (value = '') => {
    const normalized = String(value || '').trim().toLowerCase();
    return AUTO_CROWD_MOMENT_TYPES.has(normalized) ? normalized : '';
};

export const normalizePartyPolicy = (party = {}) => ({
    karaokeFirst: party?.karaokeFirst !== false,
    minSingingSharePct: normalizePositiveInt(
        party?.minSingingSharePct,
        PARTY_POLICY_DEFAULTS.minSingingSharePct,
        50,
        95
    ),
    maxBreakDurationSec: normalizePositiveInt(
        party?.maxBreakDurationSec,
        PARTY_POLICY_DEFAULTS.maxBreakDurationSec,
        3,
        120
    ),
    maxConsecutiveNonKaraokeModes: normalizePositiveInt(
        party?.maxConsecutiveNonKaraokeModes,
        PARTY_POLICY_DEFAULTS.maxConsecutiveNonKaraokeModes,
        1,
        4
    ),
    queueDepthGuardThreshold: normalizePositiveInt(
        party?.queueDepthGuardThreshold,
        PARTY_POLICY_DEFAULTS.queueDepthGuardThreshold,
        1,
        30
    )
});

export const normalizeAutoCrowdMomentConfig = (party = {}) => {
    const preferredTypes = Array.isArray(party?.autoCrowdMomentPreferredTypes)
        ? party.autoCrowdMomentPreferredTypes
            .map((value) => normalizeMomentType(value))
            .filter(Boolean)
        : PARTY_AUTO_MOMENT_DEFAULTS.autoCrowdMomentPreferredTypes;
    return {
        autoCrowdMomentsEnabled: party?.autoCrowdMomentsEnabled === true,
        autoCrowdMomentDelayMs: normalizePositiveInt(
            party?.autoCrowdMomentDelayMs,
            PARTY_AUTO_MOMENT_DEFAULTS.autoCrowdMomentDelayMs,
            0,
            10000
        ),
        autoCrowdMomentReadyCheckSec: normalizePositiveInt(
            party?.autoCrowdMomentReadyCheckSec,
            PARTY_AUTO_MOMENT_DEFAULTS.autoCrowdMomentReadyCheckSec,
            3,
            20
        ),
        autoCrowdMomentVolleySec: normalizePositiveInt(
            party?.autoCrowdMomentVolleySec,
            PARTY_AUTO_MOMENT_DEFAULTS.autoCrowdMomentVolleySec,
            4,
            30
        ),
        autoCrowdMomentPreferredTypes: preferredTypes.length
            ? preferredTypes
            : PARTY_AUTO_MOMENT_DEFAULTS.autoCrowdMomentPreferredTypes
    };
};

export const normalizePartyFlowState = (state = {}) => ({
    singingMs: Math.max(0, Math.floor(toNumber(state?.singingMs, 0))),
    groupMs: Math.max(0, Math.floor(toNumber(state?.groupMs, 0))),
    songsSinceLastGroupMoment: Math.max(0, Math.floor(toNumber(state?.songsSinceLastGroupMoment, 0))),
    consecutiveNonKaraokeModes: Math.max(0, Math.floor(toNumber(state?.consecutiveNonKaraokeModes, 0))),
    lastGroupMode: String(state?.lastGroupMode || '').trim().toLowerCase()
});

export const normalizeMissionParty = (party = {}) => {
    const policy = normalizePartyPolicy(party);
    const autoCrowdConfig = normalizeAutoCrowdMomentConfig(party);
    return {
        ...policy,
        ...autoCrowdConfig,
        state: normalizePartyFlowState(party?.state || {})
    };
};

export const getSingingSharePct = (state = {}) => {
    const flow = normalizePartyFlowState(state);
    const total = flow.singingMs + flow.groupMs;
    if (total <= 0) return 100;
    return Math.round((flow.singingMs / total) * 100);
};

export const isHeavyGroupMode = (mode = '') =>
    HEAVY_GROUP_MODES.has(String(mode || '').trim().toLowerCase());

export const shouldAllowGroupMoment = ({
    policy = PARTY_POLICY_DEFAULTS,
    flowState = {},
    queueDepth = 0,
    requestedMode = 'hype',
    requestedDurationSec = PARTY_POLICY_DEFAULTS.maxBreakDurationSec
} = {}) => {
    const resolvedPolicy = normalizePartyPolicy(policy);
    const flow = normalizePartyFlowState(flowState);
    const mode = String(requestedMode || 'hype').trim().toLowerCase();
    const normalizedRequestedDurationSec = normalizePositiveInt(
        requestedDurationSec,
        resolvedPolicy.maxBreakDurationSec,
        1,
        600
    );
    if (normalizedRequestedDurationSec > resolvedPolicy.maxBreakDurationSec) {
        return {
            allowed: false,
            reason: 'duration_limit',
            breakDurationSec: resolvedPolicy.maxBreakDurationSec,
            singingSharePct: getSingingSharePct(flow)
        };
    }
    const breakDurationSec = normalizedRequestedDurationSec;

    if (queueDepth >= resolvedPolicy.queueDepthGuardThreshold) {
        return {
            allowed: false,
            reason: 'queue_guard',
            breakDurationSec,
            singingSharePct: getSingingSharePct(flow)
        };
    }

    if (isHeavyGroupMode(mode) && flow.songsSinceLastGroupMoment < 1) {
        return {
            allowed: false,
            reason: 'song_gap_required',
            breakDurationSec,
            singingSharePct: getSingingSharePct(flow)
        };
    }

    if (flow.consecutiveNonKaraokeModes >= resolvedPolicy.maxConsecutiveNonKaraokeModes) {
        return {
            allowed: false,
            reason: 'consecutive_limit',
            breakDurationSec,
            singingSharePct: getSingingSharePct(flow)
        };
    }

    if (resolvedPolicy.karaokeFirst) {
        const projectedGroupMs = flow.groupMs + (breakDurationSec * 1000);
        const projectedTotalMs = flow.singingMs + projectedGroupMs;
        const projectedSingingSharePct = projectedTotalMs > 0
            ? Math.round((flow.singingMs / projectedTotalMs) * 100)
            : 100;
        if (projectedSingingSharePct < resolvedPolicy.minSingingSharePct) {
            return {
                allowed: false,
                reason: 'karaoke_share_guard',
                breakDurationSec,
                singingSharePct: projectedSingingSharePct
            };
        }
    }

    return {
        allowed: true,
        reason: 'ok',
        breakDurationSec,
        singingSharePct: getSingingSharePct(flow)
    };
};

export const recordCompletedPerformance = (flowState = {}, { durationSec = 180 } = {}) => {
    const flow = normalizePartyFlowState(flowState);
    const safeDurationMs = clamp(
        Math.floor(toNumber(durationSec, 180) * 1000),
        30 * 1000,
        12 * 60 * 1000
    );
    return {
        ...flow,
        singingMs: flow.singingMs + safeDurationMs,
        songsSinceLastGroupMoment: flow.songsSinceLastGroupMoment + 1,
        consecutiveNonKaraokeModes: 0
    };
};

export const recordGroupMoment = (flowState = {}, { mode = 'hype', durationSec = 10 } = {}) => {
    const flow = normalizePartyFlowState(flowState);
    const safeDurationMs = clamp(
        Math.floor(toNumber(durationSec, 10) * 1000),
        1 * 1000,
        10 * 60 * 1000
    );
    return {
        ...flow,
        groupMs: flow.groupMs + safeDurationMs,
        consecutiveNonKaraokeModes: flow.consecutiveNonKaraokeModes + 1,
        songsSinceLastGroupMoment: 0,
        lastGroupMode: String(mode || 'hype').trim().toLowerCase()
    };
};

const buildAutoMomentDescriptor = (type = '', durationSec = 0) => {
    if (type === 'volley') {
        return {
            type,
            durationSec,
            title: 'Auto Party: Volley Orb',
            detail: 'Audience relay is live between singers.',
            activityLog: 'launched Auto Party Volley Orb between singers'
        };
    }
    return {
        type: 'ready_check',
        durationSec,
        title: 'Auto Party: Ready Check',
        detail: 'Audience check-in is live before the next singer.',
        activityLog: 'triggered an Auto Party ready check between singers'
    };
};

export const recommendAutoCrowdMoment = ({
    party = {},
    flowState = {},
    queueDepth = 0,
    hasCurrentSinger = false,
    activeMode = 'karaoke',
    currentLightMode = ''
} = {}) => {
    const normalizedParty = normalizeMissionParty(party);
    if (!normalizedParty.autoCrowdMomentsEnabled) {
        return { allowed: false, reason: 'disabled' };
    }
    if (hasCurrentSinger) {
        return { allowed: false, reason: 'singer_live' };
    }
    const normalizedActiveMode = String(activeMode || 'karaoke').trim().toLowerCase();
    if (normalizedActiveMode && normalizedActiveMode !== 'karaoke') {
        return { allowed: false, reason: 'mode_live' };
    }
    if (String(currentLightMode || '').trim().toLowerCase() === 'volley') {
        return { allowed: false, reason: 'already_live' };
    }

    const preferredTypes = normalizedParty.autoCrowdMomentPreferredTypes;
    let lastGuard = null;
    for (const type of preferredTypes) {
        if (type === 'volley') {
            const volleyQueueCap = Math.max(2, Math.min(
                normalizedParty.queueDepthGuardThreshold - 2,
                Math.floor(normalizedParty.queueDepthGuardThreshold / 2) || 0
            ));
            if (queueDepth > volleyQueueCap) {
                lastGuard = { allowed: false, reason: 'queue_guard' };
                continue;
            }
        }

        const durationSec = type === 'volley'
            ? normalizedParty.autoCrowdMomentVolleySec
            : normalizedParty.autoCrowdMomentReadyCheckSec;
        const guard = shouldAllowGroupMoment({
            policy: normalizedParty,
            flowState,
            queueDepth,
            requestedMode: type,
            requestedDurationSec: durationSec
        });
        if (!guard.allowed) {
            lastGuard = guard;
            continue;
        }
        return {
            allowed: true,
            reason: guard.reason,
            delayMs: normalizedParty.autoCrowdMomentDelayMs,
            breakDurationSec: guard.breakDurationSec,
            ...buildAutoMomentDescriptor(type, guard.breakDurationSec)
        };
    }

    return {
        allowed: false,
        reason: lastGuard?.reason || 'no_candidate'
    };
};
