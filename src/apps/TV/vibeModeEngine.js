const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));

const toTypeKey = (value = '') => String(value || '').trim().toLowerCase();

export const VIBE_MODE_ENGINE_CONSTANTS = {
    WINDOW_MS: 18000,
    USER_EVENT_CAP: 9,
    STROBE_TAP_CAP_PER_USER: 220,
    BANGER_TIER_THRESHOLDS: [24, 48, 72, 88],
    BALLAD_TIER_THRESHOLDS: [22, 46, 70, 86],
    STROBE_TIER_THRESHOLDS: [26, 50, 74, 90]
};

const BANGER_WEIGHTS = {
    fire: 1.7,
    rocket: 2.2,
    clap: 1.1,
    money: 2.8,
    crown: 3.1,
    diamond: 2.6,
    heart: 0.8,
    drink: 1.0
};

const BALLAD_WEIGHTS = {
    heart: 1.8,
    drink: 1.4,
    clap: 1.2,
    fire: 0.6,
    rocket: 0.8,
    diamond: 1.1,
    money: 1.0,
    crown: 0.9
};

const STROBE_WEIGHTS = {
    strobe_tap: 1.0,
    clap: 0.35,
    fire: 0.22
};

const modeThresholds = (mode = '') => {
    const key = toTypeKey(mode);
    if (key === 'ballad') return VIBE_MODE_ENGINE_CONSTANTS.BALLAD_TIER_THRESHOLDS;
    if (key === 'strobe') return VIBE_MODE_ENGINE_CONSTANTS.STROBE_TIER_THRESHOLDS;
    return VIBE_MODE_ENGINE_CONSTANTS.BANGER_TIER_THRESHOLDS;
};

const resolveTier = (mode = '', score = 0) => {
    const thresholds = modeThresholds(mode);
    let tier = 0;
    thresholds.forEach((threshold, idx) => {
        if (score >= threshold) tier = idx + 1;
    });
    return tier;
};

const getRecentEvents = (events = [], now = Date.now(), windowMs = VIBE_MODE_ENGINE_CONSTANTS.WINDOW_MS) => (
    (Array.isArray(events) ? events : []).filter((event) => {
        const ts = Number(event?.timestampMs || 0);
        return ts > 0 && (now - ts) <= windowMs;
    })
);

const aggregateWeightedEnergy = ({
    events = [],
    nowMs = Date.now(),
    weights = {},
    userCap = VIBE_MODE_ENGINE_CONSTANTS.USER_EVENT_CAP
}) => {
    const recent = getRecentEvents(events, nowMs);
    const userTotals = new Map();
    let totalWeighted = 0;
    let totalRaw = 0;

    recent.forEach((event) => {
        const type = toTypeKey(event?.type || '');
        const weight = Number(weights[type] || 0);
        if (!weight) return;
        const userKey = String(event?.uid || event?.userName || event?.user || 'guest').trim().toLowerCase() || 'guest';
        if (!userTotals.has(userKey)) userTotals.set(userKey, 0);
        const currentCount = Number(userTotals.get(userKey) || 0);
        const requestedCount = Math.max(1, Number(event?.count || 1));
        const remaining = Math.max(0, userCap - currentCount);
        const accepted = Math.min(requestedCount, remaining);
        if (accepted <= 0) return;
        userTotals.set(userKey, currentCount + accepted);
        totalRaw += accepted;
        totalWeighted += accepted * weight;
    });

    return {
        recent,
        uniqueParticipants: userTotals.size,
        weightedEnergy: totalWeighted,
        rawCount: totalRaw
    };
};

const buildModeState = ({ mode = '', score = 0, uniqueParticipants = 0, rawCount = 0, weightedEnergy = 0, nowMs = Date.now() }) => {
    const safeScore = clamp(score, 0, 100);
    return {
        mode: toTypeKey(mode),
        score: safeScore,
        tier: resolveTier(mode, safeScore),
        uniqueParticipants: Math.max(0, Number(uniqueParticipants || 0)),
        rawCount: Math.max(0, Number(rawCount || 0)),
        weightedEnergy: Math.max(0, Number(weightedEnergy || 0)),
        timestampMs: Number(nowMs || Date.now())
    };
};

export const deriveBangerModeState = ({
    combo = 0,
    events = [],
    nowMs = Date.now()
} = {}) => {
    const aggregate = aggregateWeightedEnergy({ events, nowMs, weights: BANGER_WEIGHTS });
    const eventScore = clamp((aggregate.weightedEnergy / 22) * 100, 0, 100);
    const participantLift = clamp(aggregate.uniqueParticipants * 7.5, 0, 28);
    const comboLift = clamp(Number(combo || 0) * 0.42, 0, 44);
    const score = clamp((eventScore * 0.58) + comboLift + participantLift, 0, 100);
    return buildModeState({
        mode: 'banger',
        score,
        uniqueParticipants: aggregate.uniqueParticipants,
        rawCount: aggregate.rawCount,
        weightedEnergy: aggregate.weightedEnergy,
        nowMs
    });
};

export const deriveBalladModeState = ({
    combo = 0,
    chatCount = 0,
    events = [],
    nowMs = Date.now()
} = {}) => {
    const aggregate = aggregateWeightedEnergy({ events, nowMs, weights: BALLAD_WEIGHTS });
    const eventScore = clamp((aggregate.weightedEnergy / 18) * 100, 0, 100);
    const chatLift = clamp(Number(chatCount || 0) * 6.8, 0, 32);
    const comboLift = clamp(Number(combo || 0) * 0.34, 0, 38);
    const participantLift = clamp(aggregate.uniqueParticipants * 6.2, 0, 24);
    const score = clamp((eventScore * 0.52) + chatLift + comboLift + participantLift, 0, 100);
    return buildModeState({
        mode: 'ballad',
        score,
        uniqueParticipants: aggregate.uniqueParticipants,
        rawCount: aggregate.rawCount,
        weightedEnergy: aggregate.weightedEnergy,
        nowMs
    });
};

export const deriveStrobeModeState = ({
    totalTaps = 0,
    leaderCount = 0,
    phase = 'off',
    events = [],
    nowMs = Date.now()
} = {}) => {
    const aggregate = aggregateWeightedEnergy({
        events,
        nowMs,
        weights: STROBE_WEIGHTS,
        userCap: VIBE_MODE_ENGINE_CONSTANTS.STROBE_TAP_CAP_PER_USER
    });
    const phaseBoost = phase === 'active' ? 12 : phase === 'countdown' ? 6 : 0;
    const tapsEffective = clamp(Number(totalTaps || 0), 0, (Number(leaderCount || 0) * 260) + 220);
    const tapsScore = clamp((tapsEffective / 180) * 100, 0, 100);
    const eventScore = clamp((aggregate.weightedEnergy / 120) * 100, 0, 100);
    const participantLift = clamp(Number(leaderCount || 0) * 8, 0, 34);
    const score = clamp((tapsScore * 0.56) + (eventScore * 0.22) + participantLift + phaseBoost, 0, 100);
    return buildModeState({
        mode: 'strobe',
        score,
        uniqueParticipants: Math.max(aggregate.uniqueParticipants, Number(leaderCount || 0)),
        rawCount: Math.max(aggregate.rawCount, Number(totalTaps || 0)),
        weightedEnergy: Math.max(aggregate.weightedEnergy, tapsEffective),
        nowMs
    });
};

export const getVibeModeTierTransitions = (prevState = null, nextState = null) => {
    const prevTier = Number(prevState?.tier || 0);
    const nextTier = Number(nextState?.tier || 0);
    if (!nextTier || nextTier <= prevTier) return [];
    const mode = toTypeKey(nextState?.mode || prevState?.mode || 'mode');
    const thresholds = modeThresholds(mode);
    return thresholds
        .map((threshold, idx) => ({ tier: idx + 1, threshold }))
        .filter((entry) => entry.tier > prevTier && entry.tier <= nextTier)
        .map((entry) => ({
            mode,
            tier: entry.tier,
            threshold: entry.threshold
        }));
};

export const buildVibeModeRewardPayload = (
    state = {},
    nowMs = Date.now(),
    {
        visualOnly = false,
        payoutCooldownMs = 45000,
        lastPayoutAt = 0
    } = {}
) => {
    const tier = Number(state?.tier || 0);
    const mode = toTypeKey(state?.mode || 'mode');
    if (tier < 1) return { shouldProcess: false, reason: 'no_tier', state };
    const safeNow = Number(nowMs || Date.now());
    const safeLast = Number(lastPayoutAt || 0);
    if ((safeNow - safeLast) < payoutCooldownMs) {
        return { shouldProcess: false, reason: 'cooldown', state };
    }
    const key = `${mode}_tier_${tier}_${Math.floor(safeNow / payoutCooldownMs)}`;
    if (visualOnly || tier < 3) {
        return {
            shouldProcess: true,
            visualOnly: true,
            rewardKey: key,
            pointsBudget: 0,
            tier
        };
    }
    const pointsBudget = tier >= 4 ? 42 : 24;
    return {
        shouldProcess: true,
        visualOnly: false,
        rewardKey: key,
        pointsBudget,
        tier
    };
};
