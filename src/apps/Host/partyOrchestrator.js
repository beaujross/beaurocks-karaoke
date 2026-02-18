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

const normalizePositiveInt = (value, fallback, min, max) => {
    const parsed = Math.floor(toNumber(value, fallback));
    return clamp(parsed, min, max);
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

export const normalizePartyFlowState = (state = {}) => ({
    singingMs: Math.max(0, Math.floor(toNumber(state?.singingMs, 0))),
    groupMs: Math.max(0, Math.floor(toNumber(state?.groupMs, 0))),
    songsSinceLastGroupMoment: Math.max(0, Math.floor(toNumber(state?.songsSinceLastGroupMoment, 0))),
    consecutiveNonKaraokeModes: Math.max(0, Math.floor(toNumber(state?.consecutiveNonKaraokeModes, 0))),
    lastGroupMode: String(state?.lastGroupMode || '').trim().toLowerCase()
});

export const normalizeMissionParty = (party = {}) => {
    const policy = normalizePartyPolicy(party);
    return {
        ...policy,
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
