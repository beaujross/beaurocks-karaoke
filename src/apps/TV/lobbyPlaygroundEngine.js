import {
    VOLLEY_ORB_ULTIMATE_COOLDOWN_MS,
    getVolleyOrbUltimate,
    isVolleyOrbUltimateType
} from '../../lib/volleyOrbUiState';

const DEFAULT_INTERACTION_TYPES = ['wave', 'laser', 'echo', 'confetti'];
const INTERACTION_PREFIX = 'lobby_play_';
const STREAK_TIMEOUT_MS = 6200;
const CONTRIBUTION_WINDOW_MS = 28000;
const TEAMWORK_WINDOW_MS = 9000;
const INTERACTION_HISTORY_LIMIT = 48;
const COMBO_WINDOW_MS = 2200;
const MAX_PARTICIPANTS_PER_PAYOUT = 6;
const PAYOUT_COOLDOWN_MS = 22000;
const SPAM_WINDOW_MS = 700;
const RAPID_FIRE_WINDOW_MS = 280;
const SPAM_WEIGHT_MIN = 0.34;
const GROUND_HIT_GRACE_MS = 360;
const RELAY_WINDOW_MS = 2400;
const ENERGY_DECAY_PER_SEC = 0.28;
const ENERGY_GAIN_BASE = 1.8;
const ENERGY_GAIN_PER_COUNT = 0.78;
const AIR_MULTIPLIER_STEP_MS = 7000;
const AIR_MULTIPLIER_TEAM_BONUS_PER_USER = 0.25;
const AIR_MULTIPLIER_HANDOFF_BONUS_PER_CHAIN = 0.08;
const AIR_MULTIPLIER_RELAY_BONUS_PER_CHAIN = 0.05;
const AIR_MULTIPLIER_CAP = 5;
const MAX_POINTS_BUDGET_SCALE = 5;
const MAX_POINTS_PER_USER_SCALE = 3;
const RELAY_SEQUENCE = ['wave', 'laser', 'echo', 'confetti'];
const ACTIVE_ULTIMATE_LIMIT = 4;
const INTERACTION_PROFILES = Object.freeze({
    wave: Object.freeze({
        id: 'wave',
        roleLabel: 'Stability',
        description: 'Slows orb decay between taps.',
        energyGainMultiplier: 1,
        decayMultiplier: 0.62,
        relayWindowBonusMs: 0,
        streakStep: 1
    }),
    laser: Object.freeze({
        id: 'laser',
        roleLabel: 'Power',
        description: 'Delivers a stronger energy burst.',
        energyGainMultiplier: 1.34,
        decayMultiplier: 1,
        relayWindowBonusMs: 0,
        streakStep: 1
    }),
    echo: Object.freeze({
        id: 'echo',
        roleLabel: 'Relay',
        description: 'Extends the relay handoff window.',
        energyGainMultiplier: 1,
        decayMultiplier: 1,
        relayWindowBonusMs: 700,
        streakStep: 1
    }),
    confetti: Object.freeze({
        id: 'confetti',
        roleLabel: 'Momentum',
        description: 'Counts as a double streak step.',
        energyGainMultiplier: 1.08,
        decayMultiplier: 1,
        relayWindowBonusMs: 0,
        streakStep: 2
    })
});

const TIER_DEFINITIONS = [
    { tier: 1, name: 'Warm Up', threshold: 4, visualOnly: false, pointsBudget: 14, maxPointsPerUser: 6 },
    { tier: 2, name: 'Lift Off', threshold: 9, visualOnly: false, pointsBudget: 24, maxPointsPerUser: 10 },
    { tier: 3, name: 'Skyline Pulse', threshold: 16, visualOnly: false, pointsBudget: 36, maxPointsPerUser: 16 },
    { tier: 4, name: 'Neon Nova', threshold: 26, visualOnly: false, pointsBudget: 60, maxPointsPerUser: 24 }
];
const LEVEL_DEFINITIONS = Object.freeze([
    Object.freeze({ level: 0, tier: 0, label: 'Launch', gravityMultiplier: 0.92, relayBaseMs: 2600, speedMultiplier: 0.94, targetActivePlayers: 1 }),
    Object.freeze({ level: 1, tier: 1, label: 'Warm Up', gravityMultiplier: 1, relayBaseMs: 2400, speedMultiplier: 1, targetActivePlayers: 2 }),
    Object.freeze({ level: 2, tier: 2, label: 'Lift Off', gravityMultiplier: 1.14, relayBaseMs: 2200, speedMultiplier: 1.08, targetActivePlayers: 3 }),
    Object.freeze({ level: 3, tier: 3, label: 'Skyline Pulse', gravityMultiplier: 1.28, relayBaseMs: 1980, speedMultiplier: 1.18, targetActivePlayers: 4 }),
    Object.freeze({ level: 4, tier: 4, label: 'Neon Nova', gravityMultiplier: 1.42, relayBaseMs: 1760, speedMultiplier: 1.3, targetActivePlayers: 5 })
]);

const COMBO_DEFINITIONS = {
    wave_laser: { key: 'wave_laser', label: 'Prism Sweep Link', effect: 'prism_sweep_link' },
    wave_echo: { key: 'wave_echo', label: 'Ripple Tunnel', effect: 'ripple_tunnel' },
    laser_confetti: { key: 'laser_confetti', label: 'Spark Shower Bridge', effect: 'spark_shower_bridge' },
    echo_confetti: { key: 'echo_confetti', label: 'Pulse Bloom', effect: 'pulse_bloom' }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeInteractionType = (rawType = '') => {
    const value = String(rawType || '').trim().toLowerCase();
    if (!value) return '';
    if (value.startsWith(INTERACTION_PREFIX)) return value.slice(INTERACTION_PREFIX.length);
    return value;
};

const isSupportedInteractionType = (type = '') => (
    DEFAULT_INTERACTION_TYPES.includes(type)
    || isVolleyOrbUltimateType(type)
);

const normalizeCount = (rawCount) => clamp(Math.round(Number(rawCount) || 1), 1, 4);
const getInteractionProfile = (type = '') => INTERACTION_PROFILES[normalizeInteractionType(type)] || INTERACTION_PROFILES.wave;
export const getLobbyInteractionProfile = (interactionType = '') => getInteractionProfile(interactionType);

const pruneActiveUltimates = (state = null, nowMs = 0) => (
    Array.isArray(state?.activeUltimates)
        ? state.activeUltimates.filter((entry) => Number(entry?.expiresAtMs || 0) > nowMs)
        : []
);

const hasActiveUltimate = (entries = [], type = '') => entries.some((entry) => entry?.type === type);

const getNextRelayTargetType = (type = '') => {
    const normalized = normalizeInteractionType(type);
    const index = RELAY_SEQUENCE.indexOf(normalized);
    if (index < 0) return RELAY_SEQUENCE[0];
    return RELAY_SEQUENCE[(index + 1) % RELAY_SEQUENCE.length];
};

const getTierForStreak = (streakCount = 0) => {
    let tier = {
        tier: 0,
        name: '',
        threshold: 0,
        visualOnly: true,
        pointsBudget: 0,
        maxPointsPerUser: 0
    };
    TIER_DEFINITIONS.forEach((candidate) => {
        if (streakCount >= candidate.threshold) tier = candidate;
    });
    return tier;
};

const makeDefaultEventMeta = (event = {}) => ({
    uid: String(event.uid || event.userUid || '').trim(),
    userName: String(event.userName || event.user || event.name || '').trim() || 'Guest',
    avatar: String(event.avatar || '').trim(),
    type: normalizeInteractionType(event.type || event.interaction || event.id || ''),
    count: normalizeCount(event.count)
});

const getSpamWeight = (participant = null, interactionType = '', nowMs = 0) => {
    if (!participant) return 1;
    const lastEventAtMs = Number(participant.lastEventAtMs || 0);
    const lastEventType = String(participant.lastEventType || '');
    if (!lastEventAtMs || !nowMs) return 1;
    const elapsedMs = Math.max(0, nowMs - lastEventAtMs);
    if (elapsedMs <= RAPID_FIRE_WINDOW_MS) return SPAM_WEIGHT_MIN;
    if (lastEventType === interactionType && elapsedMs <= SPAM_WINDOW_MS) {
        const ratio = elapsedMs / SPAM_WINDOW_MS;
        return clamp(SPAM_WEIGHT_MIN + (ratio * (1 - SPAM_WEIGHT_MIN)), SPAM_WEIGHT_MIN, 1);
    }
    return 1;
};

const buildContributionScore = ({ count, spamWeight }) => {
    const base = ENERGY_GAIN_BASE + ((count - 1) * ENERGY_GAIN_PER_COUNT);
    return base * spamWeight;
};

const roundToTenths = (value = 1) => Math.round((Number(value) || 0) * 10) / 10;

const getActiveContributionCount = (state = createLobbyVolleyState(), nowMs = Date.now()) => {
    const safeNow = Number(nowMs || Date.now());
    return Object.values(state?.participants || {})
        .filter((entry) => (safeNow - Number(entry?.lastAtMs || 0)) <= CONTRIBUTION_WINDOW_MS)
        .length;
};

export const getLobbyLevelDefinition = (level = 0) => (
    LEVEL_DEFINITIONS.find((entry) => Number(entry.level || 0) === Number(level || 0)) || LEVEL_DEFINITIONS[0]
);

export const getLobbyVolleyLevelMeta = (state = createLobbyVolleyState(), nowMs = Date.now()) => {
    const currentTier = clamp(Math.round(Number(state?.currentTier || 0)), 0, LEVEL_DEFINITIONS.length - 1);
    const base = getLobbyLevelDefinition(currentTier);
    const activeParticipants = getActiveContributionCount(state, nowMs);
    const supportShortfall = Math.max(0, Number(base.targetActivePlayers || 1) - activeParticipants);
    return {
        ...base,
        currentTier,
        activeParticipants,
        supportShortfall
    };
};

export const getLobbyVolleyDynamicTimeoutMs = (state = createLobbyVolleyState(), nowMs = Date.now()) => {
    const levelMeta = getLobbyVolleyLevelMeta(state, nowMs);
    const pressureMultiplier = Number(levelMeta.gravityMultiplier || 1) * (1 + (levelMeta.supportShortfall * 0.08));
    return clamp(Math.round(STREAK_TIMEOUT_MS / pressureMultiplier), 3200, 7600);
};

export const getLobbyVolleyDynamicRelayWindowMs = (state = createLobbyVolleyState(), nowMs = Date.now()) => {
    const levelMeta = getLobbyVolleyLevelMeta(state, nowMs);
    return clamp(
        Math.round(Number(levelMeta.relayBaseMs || RELAY_WINDOW_MS) - (levelMeta.supportShortfall * 120)),
        1200,
        5000
    );
};

export const getLobbyVolleyDecayPerSec = (state = createLobbyVolleyState(), nowMs = Date.now()) => {
    const levelMeta = getLobbyVolleyLevelMeta(state, nowMs);
    return clamp(
        ENERGY_DECAY_PER_SEC * Number(levelMeta.gravityMultiplier || 1) * (1 + (levelMeta.supportShortfall * 0.06)),
        0.16,
        0.72
    );
};

export const getLobbyVolleyAudienceRatePlan = (
    state = createLobbyVolleyState(),
    {
        strictMode = false,
        roomMaxPerMinute = null,
        roomPerUserCooldownMs = null,
        nowMs = Date.now()
    } = {}
) => {
    const levelMeta = getLobbyVolleyLevelMeta(state, nowMs);
    const activePlayers = Number(levelMeta.activeParticipants || 0);
    const dynamicMaxPerMinute = strictMode
        ? (6 + (levelMeta.level * 2) + Math.max(0, activePlayers - 1))
        : (10 + (levelMeta.level * 3) + (Math.max(0, activePlayers - 1) * 2));
    const maxPerMinute = Number.isFinite(Number(roomMaxPerMinute))
        && Number(roomMaxPerMinute) > 0
        ? clamp(Math.round(Number(roomMaxPerMinute)), 1, 120)
        : clamp(Math.round(dynamicMaxPerMinute), strictMode ? 6 : 10, strictMode ? 24 : 40);
    const dynamicCooldownMs = strictMode
        ? (500 - (levelMeta.level * 35) - (Math.min(5, activePlayers) * 10))
        : (260 - (levelMeta.level * 20) - (Math.min(6, activePlayers) * 8));
    const perUserCooldownMs = Number.isFinite(Number(roomPerUserCooldownMs))
        && Number(roomPerUserCooldownMs) > 0
        ? clamp(Math.round(Number(roomPerUserCooldownMs)), 120, 1200)
        : clamp(Math.round(dynamicCooldownMs), strictMode ? 160 : 120, 1200);
    return {
        ...levelMeta,
        maxPerMinute,
        perUserCooldownMs
    };
};

const decayEnergy = (energy = 0, elapsedMs = 0, decayPerSec = ENERGY_DECAY_PER_SEC) => {
    if (!elapsedMs) return Math.max(0, Number(energy) || 0);
    const decayed = (Number(energy) || 0) - ((elapsedMs / 1000) * Math.max(0, Number(decayPerSec) || ENERGY_DECAY_PER_SEC));
    return Math.max(0, decayed);
};

const createParticipant = (meta, nowMs) => ({
    uid: meta.uid,
    userName: meta.userName,
    avatar: meta.avatar,
    score: 0,
    events: 0,
    weightedEvents: 0,
    lastAtMs: Number(nowMs || 0),
    lastEventAtMs: 0,
    lastEventType: '',
    lastUltimateAtMs: 0,
    ultimateUses: 0,
    byType: {
        wave: 0,
        laser: 0,
        echo: 0,
        confetti: 0
    }
});

const getEventId = (meta, nowMs, nextCount) => {
    const uidPart = meta.uid || 'guest';
    const typePart = meta.type || 'unknown';
    return `${typePart}_${uidPart}_${Number(nowMs || 0)}_${Number(nextCount || 0)}`;
};

const mapPairKey = (a = '', b = '') => {
    const direct = `${a}_${b}`;
    if (COMBO_DEFINITIONS[direct]) return direct;
    const reverse = `${b}_${a}`;
    if (COMBO_DEFINITIONS[reverse]) return reverse;
    return direct;
};

export const createLobbyVolleyState = () => ({
    streakId: 0,
    streakCount: 0,
    energy: 0,
    airborneStartedAtMs: 0,
    airborneMs: 0,
    teamworkMultiplier: 1,
    handoffCount: 0,
    relayChainCount: 0,
    relaySuccessCount: 0,
    relayTargetType: 'wave',
    relayWindowMs: RELAY_WINDOW_MS,
    relayExpiryAtMs: 0,
    lastRelayAtMs: 0,
    lastRelayPasserUid: '',
    lastRelayPasserName: '',
    lastRelayReceiverUid: '',
    lastRelayReceiverName: '',
    currentTier: 0,
    tierName: '',
    startedAtMs: 0,
    lastInteractionAtMs: 0,
    lastInteractionType: '',
    lastInteractionUid: '',
    interactions: [],
    participants: {},
    paidTierKeys: {},
    pendingTierTransitions: [],
    lastPayoutAtMs: 0,
    lastPayoutTier: 0,
    authFailureLocked: false,
    activeUltimates: []
});

export const deriveAirborneMs = (state = createLobbyVolleyState(), nowMs = Date.now()) => {
    const safeNow = Number(nowMs || Date.now());
    const streakCount = Number(state?.streakCount || 0);
    if (streakCount <= 0) return 0;
    const startedAtMs = Number(state?.airborneStartedAtMs || state?.startedAtMs || 0);
    if (!startedAtMs) return 0;
    return Math.max(0, safeNow - startedAtMs);
};

export const deriveTeamworkMultiplier = (state = createLobbyVolleyState(), nowMs = Date.now()) => {
    const safeNow = Number(nowMs || Date.now());
    const airborneMs = deriveAirborneMs(state, safeNow);
    if (airborneMs <= 0) return 1;
    const participants = Object.values(state?.participants || {});
    const activeTeamCount = participants
        .filter((entry) => (safeNow - Number(entry?.lastAtMs || 0)) <= TEAMWORK_WINDOW_MS)
        .length;
    const airSteps = Math.floor(airborneMs / AIR_MULTIPLIER_STEP_MS);
    const baseMultiplier = 1 + Math.min(2, airSteps * 0.5);
    const teamBonus = Math.min(1.5, Math.max(0, activeTeamCount - 1) * AIR_MULTIPLIER_TEAM_BONUS_PER_USER);
    const handoffBonus = Math.min(1.5, Math.max(0, Number(state?.handoffCount || 0)) * AIR_MULTIPLIER_HANDOFF_BONUS_PER_CHAIN);
    const relayBonus = Math.min(0.8, Math.max(0, Number(state?.relayChainCount || 0)) * AIR_MULTIPLIER_RELAY_BONUS_PER_CHAIN);
    return clamp(roundToTenths(baseMultiplier + teamBonus + handoffBonus + relayBonus), 1, AIR_MULTIPLIER_CAP);
};

export const deriveRelayObjective = (state = createLobbyVolleyState(), nowMs = Date.now()) => {
    const safeNow = Number(nowMs || Date.now());
    const activeUltimates = pruneActiveUltimates(state, safeNow);
    const catchAllActive = hasActiveUltimate(activeUltimates, 'ultimate_magnet');
    const streakCount = Number(state?.streakCount || 0);
    const lastInteractionAtMs = Number(state?.lastInteractionAtMs || 0);
    const relayWindowMs = clamp(Number(state?.relayWindowMs || getLobbyVolleyDynamicRelayWindowMs(state, safeNow)), 1200, 5000);
    const fallbackExpiry = lastInteractionAtMs > 0 ? (lastInteractionAtMs + relayWindowMs) : 0;
    const expiresAtMs = Number(state?.relayExpiryAtMs || fallbackExpiry || 0);
    const remainingMs = Math.max(0, expiresAtMs - safeNow);
    const active = streakCount > 0 && remainingMs > 0;
    const progressPct = active ? clamp((remainingMs / relayWindowMs) * 100, 0, 100) : 0;
    const urgency = progressPct > 66 ? 'stable' : (progressPct > 33 ? 'warning' : 'danger');
    return {
        active,
        targetType: catchAllActive
            ? 'any'
            : String(state?.relayTargetType || getNextRelayTargetType(state?.lastInteractionType || 'wave')),
        relayWindowMs,
        expiresAtMs,
        remainingMs,
        progressPct: Math.round(progressPct),
        urgency,
        chainCount: Number(state?.relayChainCount || 0),
        successCount: Number(state?.relaySuccessCount || 0),
        requiresDifferentUser: true,
        lastPasserUid: String(state?.lastRelayPasserUid || ''),
        lastPasserName: String(state?.lastRelayPasserName || ''),
        lastReceiverUid: String(state?.lastRelayReceiverUid || ''),
        lastReceiverName: String(state?.lastRelayReceiverName || '')
    };
};

export const deriveComboMoment = (state = createLobbyVolleyState(), event = {}) => {
    const eventMeta = makeDefaultEventMeta(event);
    if (!isSupportedInteractionType(eventMeta.type)) return null;
    const now = Number(event.timestampMs || event.nowMs || event.createdAt || state.lastInteractionAtMs || 0);
    if (!now) return null;
    const previous = (Array.isArray(state.interactions) ? state.interactions : [])
        .find((entry) => entry && entry.type && entry.type !== eventMeta.type && (now - Number(entry.atMs || 0)) <= COMBO_WINDOW_MS);
    if (!previous) return null;
    const pairKey = mapPairKey(previous.type, eventMeta.type);
    const comboDef = COMBO_DEFINITIONS[pairKey];
    if (!comboDef) return null;
    return {
        id: `${comboDef.key}_${now}_${String(previous.uid || 'guest')}_${String(eventMeta.uid || 'guest')}`,
        key: comboDef.key,
        effect: comboDef.effect,
        label: comboDef.label,
        createdAtMs: now,
        expiresAtMs: now + 3600,
        fromType: previous.type,
        toType: eventMeta.type,
        fromUid: previous.uid || '',
        toUid: eventMeta.uid || '',
        streakCount: Number(state.streakCount || 0)
    };
};

export const getTierTransitions = (prevState = createLobbyVolleyState(), nextState = createLobbyVolleyState()) => {
    const prevTier = Number(prevState.currentTier || 0);
    const nextTier = Number(nextState.currentTier || 0);
    if (nextTier <= prevTier) return [];
    return TIER_DEFINITIONS
        .filter((tier) => tier.tier > prevTier && tier.tier <= nextTier)
        .map((tier) => ({
            tier: tier.tier,
            name: tier.name,
            threshold: tier.threshold,
            visualOnly: tier.visualOnly
        }));
};

export const applyLobbyInteraction = (state = createLobbyVolleyState(), event = {}, nowMs = Date.now()) => {
    const baseState = state && typeof state === 'object' ? state : createLobbyVolleyState();
    const safeNow = Number(nowMs || Date.now());
    const eventMeta = makeDefaultEventMeta(event);
    const activeUltimates = pruneActiveUltimates(baseState, safeNow);
    const isUltimate = isVolleyOrbUltimateType(eventMeta.type);
    const ultimateMeta = isUltimate ? getVolleyOrbUltimate(eventMeta.type) : null;
    const currentDecayPerSec = getLobbyVolleyDecayPerSec(baseState, safeNow);

    if (!isSupportedInteractionType(eventMeta.type)) {
        return {
            ...baseState,
            energy: decayEnergy(baseState.energy, safeNow - Number(baseState.lastInteractionAtMs || safeNow), currentDecayPerSec),
            activeUltimates
        };
    }

    const activeTimeoutMs = getLobbyVolleyDynamicTimeoutMs(baseState, safeNow);
    const shouldReset = Number(baseState.lastInteractionAtMs || 0) > 0
        && (safeNow - Number(baseState.lastInteractionAtMs || 0)) > activeTimeoutMs;
    const streakSeed = shouldReset ? (Number(baseState.streakId || 0) + 1) : Number(baseState.streakId || 0);
    const activeState = shouldReset
        ? {
            ...createLobbyVolleyState(),
            streakId: streakSeed,
            startedAtMs: safeNow,
            airborneStartedAtMs: safeNow,
            lastPayoutAtMs: Number(baseState.lastPayoutAtMs || 0),
            authFailureLocked: !!baseState.authFailureLocked,
            activeUltimates
        }
        : { ...baseState, activeUltimates };

    const elapsedMs = Math.max(0, safeNow - Number(activeState.lastInteractionAtMs || safeNow));
    const interactionProfile = getInteractionProfile(eventMeta.type);
    const levelMeta = getLobbyVolleyLevelMeta(activeState, safeNow);
    const featherSlowActive = hasActiveUltimate(activeUltimates, 'ultimate_feather');
    const magnetCatchAllActive = hasActiveUltimate(activeUltimates, 'ultimate_magnet');
    const decayMultiplier = clamp(Number(interactionProfile?.decayMultiplier || 1) * (featherSlowActive ? 0.34 : 1), 0.18, 1.2);
    const energyGainMultiplier = clamp(Number(interactionProfile?.energyGainMultiplier || 1), 0.5, 2);
    const streakStep = clamp(Math.round(Number(interactionProfile?.streakStep || 1)), 1, 2);
    const relayWindowMs = clamp(
        Number(levelMeta.relayBaseMs || getLobbyVolleyDynamicRelayWindowMs(activeState, safeNow))
            + Number(interactionProfile?.relayWindowBonusMs || 0)
            + (magnetCatchAllActive ? 800 : 0),
        1200,
        6200
    );
    const isHandoff = !!eventMeta.uid
        && !!activeState.lastInteractionUid
        && activeState.lastInteractionUid !== eventMeta.uid;
    const nextHandoffCount = isHandoff ? Number(activeState.handoffCount || 0) + 1 : Number(activeState.handoffCount || 0);
    const previousInteractionType = String(activeState.lastInteractionType || '');
    const expectedRelayType = getNextRelayTargetType(previousInteractionType || eventMeta.type);
    const activeRelayWindowMs = clamp(Number(activeState.relayWindowMs || getLobbyVolleyDynamicRelayWindowMs(activeState, safeNow)), 1200, 6200);
    const relayWindowOpen = Number(activeState.lastInteractionAtMs || 0) > 0
        && (safeNow - Number(activeState.lastInteractionAtMs || 0)) <= activeRelayWindowMs;
    const relayHit = !isUltimate
        && relayWindowOpen
        && isHandoff
        && (eventMeta.type === expectedRelayType || magnetCatchAllActive);
    const nextRelayChainCount = relayHit ? (Number(activeState.relayChainCount || 0) + 1) : 0;
    const nextRelaySuccessCount = relayHit ? (Number(activeState.relaySuccessCount || 0) + 1) : Number(activeState.relaySuccessCount || 0);
    const participants = { ...(activeState.participants || {}) };
    const participant = eventMeta.uid
        ? (participants[eventMeta.uid] || createParticipant(eventMeta, safeNow))
        : null;
    if (participant && isUltimate && (safeNow - Number(participant.lastUltimateAtMs || 0)) < VOLLEY_ORB_ULTIMATE_COOLDOWN_MS) {
        return {
            ...activeState,
            energy: decayEnergy(activeState.energy, elapsedMs, currentDecayPerSec),
            activeUltimates
        };
    }
    const spamWeight = getSpamWeight(participant, eventMeta.type, safeNow);
    const contribution = isUltimate
        ? Math.max(8, Number(
            ultimateMeta?.id === 'ultimate_rocket'
                ? 18
                : ultimateMeta?.id === 'ultimate_lens'
                    ? 12
                    : 9
        ))
        : (buildContributionScore({ count: eventMeta.count, spamWeight }) * energyGainMultiplier);

    if (participant) {
        participant.userName = eventMeta.userName;
        participant.avatar = eventMeta.avatar || participant.avatar;
        participant.lastAtMs = safeNow;
        participant.lastEventAtMs = safeNow;
        participant.lastEventType = eventMeta.type;
        if (isUltimate) {
            participant.lastUltimateAtMs = safeNow;
            participant.ultimateUses = Number(participant.ultimateUses || 0) + 1;
        }
        participant.events += 1;
        participant.weightedEvents += spamWeight;
        participant.score = Number(participant.score || 0) + contribution;
        participant.byType = {
            wave: Number(participant.byType?.wave || 0),
            laser: Number(participant.byType?.laser || 0),
            echo: Number(participant.byType?.echo || 0),
            confetti: Number(participant.byType?.confetti || 0),
            [eventMeta.type]: Number(participant.byType?.[eventMeta.type] || 0) + eventMeta.count
        };
        participants[eventMeta.uid] = participant;
    }

    const nextStreakCount = Number(activeState.streakCount || 0) + (isUltimate ? 1 : streakStep);
    const nextEnergy = clamp(
        decayEnergy(activeState.energy, elapsedMs * decayMultiplier, currentDecayPerSec) + contribution,
        0,
        100
    );
    const nextTier = getTierForStreak(nextStreakCount);
    const prevTier = getTierForStreak(Number(activeState.streakCount || 0));
    const eventAtMs = safeNow;
    const nextEvent = {
        id: getEventId(eventMeta, eventAtMs, nextStreakCount),
        uid: eventMeta.uid,
        userName: eventMeta.userName,
        avatar: eventMeta.avatar,
        type: eventMeta.type,
        count: eventMeta.count,
        weight: spamWeight,
        contribution,
        atMs: eventAtMs
    };
    const interactionHistory = [nextEvent, ...(Array.isArray(activeState.interactions) ? activeState.interactions : [])]
        .slice(0, INTERACTION_HISTORY_LIMIT);
    const pendingTierTransitions = getTierTransitions(
        { ...activeState, currentTier: prevTier.tier },
        { ...activeState, currentTier: nextTier.tier }
    );
    const airborneStartedAtMs = Number(activeState.airborneStartedAtMs || activeState.startedAtMs || safeNow);
    const relayTargetType = isUltimate
        ? String(activeState.relayTargetType || getNextRelayTargetType(previousInteractionType || 'wave'))
        : getNextRelayTargetType(eventMeta.type);
    const nextUltimateEntries = isUltimate && ultimateMeta && Number(ultimateMeta.durationMs || 0) > 0
        ? [{
            id: `${ultimateMeta.id}_${eventMeta.uid || 'guest'}_${safeNow}`,
            type: ultimateMeta.id,
            uid: eventMeta.uid || '',
            userName: eventMeta.userName,
            avatar: eventMeta.avatar,
            createdAtMs: safeNow,
            expiresAtMs: safeNow + Number(ultimateMeta.durationMs || 0)
        }, ...activeUltimates].slice(0, ACTIVE_ULTIMATE_LIMIT)
        : activeUltimates;
    const relayPasser = relayHit ? (participants[activeState.lastInteractionUid] || null) : null;
    const nextStateWithoutMultiplier = {
        ...activeState,
        streakId: streakSeed,
        streakCount: nextStreakCount,
        energy: nextEnergy,
        currentTier: nextTier.tier,
        tierName: nextTier.name,
        startedAtMs: Number(activeState.startedAtMs || safeNow),
        airborneStartedAtMs,
        airborneMs: Math.max(0, safeNow - airborneStartedAtMs),
        handoffCount: nextHandoffCount,
        relayChainCount: nextRelayChainCount,
        relaySuccessCount: nextRelaySuccessCount,
        relayTargetType,
        relayWindowMs,
        relayExpiryAtMs: safeNow + relayWindowMs,
        lastRelayAtMs: relayHit ? safeNow : Number(activeState.lastRelayAtMs || 0),
        lastRelayPasserUid: relayHit ? String(activeState.lastInteractionUid || '') : '',
        lastRelayPasserName: relayHit ? String(relayPasser?.userName || 'Guest') : '',
        lastRelayReceiverUid: relayHit ? String(eventMeta.uid || '') : '',
        lastRelayReceiverName: relayHit ? String(eventMeta.userName || 'Guest') : '',
        lastInteractionAtMs: safeNow,
        lastInteractionType: isUltimate ? String(activeState.lastInteractionType || 'wave') : eventMeta.type,
        lastInteractionUid: eventMeta.uid,
        interactions: interactionHistory,
        participants,
        pendingTierTransitions,
        activeUltimates: nextUltimateEntries
    };
    const teamworkMultiplier = deriveTeamworkMultiplier(nextStateWithoutMultiplier, safeNow);

    return {
        ...nextStateWithoutMultiplier,
        teamworkMultiplier
    };
};

export const getActiveParticipants = (state = createLobbyVolleyState(), nowMs = Date.now()) => {
    const safeNow = Number(nowMs || Date.now());
    const participants = Object.values(state.participants || {});
    return participants
        .filter((entry) => (safeNow - Number(entry?.lastAtMs || 0)) <= CONTRIBUTION_WINDOW_MS)
        .sort((a, b) => {
            const scoreGap = Number(b?.score || 0) - Number(a?.score || 0);
            if (scoreGap !== 0) return scoreGap;
            return Number(b?.lastAtMs || 0) - Number(a?.lastAtMs || 0);
        });
};

export const buildAwardPayload = (state = createLobbyVolleyState(), nowMs = Date.now()) => {
    const safeNow = Number(nowMs || Date.now());
    const streakId = Number(state.streakId || 0);
    const tier = TIER_DEFINITIONS.find((entry) => entry.tier === Number(state.currentTier || 0)) || TIER_DEFINITIONS[0];
    if (!tier || tier.tier <= 0) {
        return { shouldProcess: false, reason: 'no_tier', nextState: state };
    }

    const awardKey = `lobby_playground_${streakId}_tier_${tier.tier}`;
    if (state.paidTierKeys?.[awardKey]) {
        return { shouldProcess: false, reason: 'already_paid', nextState: state };
    }
    const currentTier = Number(tier.tier || 0);
    const lastPayoutTier = Math.max(0, Number(state.lastPayoutTier || 0));
    const effectiveLastPayoutTier = lastPayoutTier > 0 ? lastPayoutTier : currentTier;
    if (
        Number(state.lastPayoutAtMs || 0) > 0
        && (safeNow - Number(state.lastPayoutAtMs || 0)) < PAYOUT_COOLDOWN_MS
        && currentTier <= effectiveLastPayoutTier
    ) {
        return { shouldProcess: false, reason: 'cooldown', nextState: state };
    }

    const activeParticipants = getActiveParticipants(state, safeNow)
        .filter((participant) => !!participant.uid)
        .slice(0, MAX_PARTICIPANTS_PER_PAYOUT);

    const teamworkMultiplier = clamp(Number(state.teamworkMultiplier || 1), 1, AIR_MULTIPLIER_CAP);
    // Point payouts should match the orb's displayed multiplier directly.
    const rewardMultiplier = teamworkMultiplier;
    const basePointsBudget = Math.max(0, Number(tier.pointsBudget || 0));
    const baseMaxPointsPerUser = Math.max(0, Number(tier.maxPointsPerUser || 0));
    const pointsBudget = clamp(
        Math.round(basePointsBudget * rewardMultiplier),
        0,
        Math.max(120, Math.round(basePointsBudget * MAX_POINTS_BUDGET_SCALE))
    );
    const maxPointsPerUser = clamp(
        Math.round(baseMaxPointsPerUser * rewardMultiplier),
        0,
        Math.max(baseMaxPointsPerUser, Math.round(baseMaxPointsPerUser * MAX_POINTS_PER_USER_SCALE))
    );
    const pointsEligible = !tier.visualOnly && pointsBudget > 0 && activeParticipants.length > 0;
    const awards = [];

    if (pointsEligible) {
        const count = activeParticipants.length;
        let remainingBudget = pointsBudget;
        activeParticipants.forEach((participant, idx) => {
            const slotsLeft = Math.max(1, count - idx);
            let points = Math.max(1, Math.floor(remainingBudget / slotsLeft));
            points = Math.min(points, maxPointsPerUser || points);
            if (points > 0) {
                awards.push({
                    uid: participant.uid,
                    points
                });
                remainingBudget = Math.max(0, remainingBudget - points);
            }
        });
    }

    const nextState = {
        ...state,
        paidTierKeys: {
            ...(state.paidTierKeys || {}),
            [awardKey]: true
        },
        lastPayoutAtMs: safeNow,
        lastPayoutTier: currentTier
    };

    return {
        shouldProcess: true,
        visualOnly: !awards.length,
        tier: tier.tier,
        tierName: tier.name,
        teamworkMultiplier: roundToTenths(teamworkMultiplier),
        rewardMultiplier: roundToTenths(rewardMultiplier),
        pointsBudget,
        maxPointsPerUser,
        awardKey,
        awards,
        nextState
    };
};

export const quantizeToBeat = (nowMs, beatMs, windowMs) => {
    const safeNow = Number(nowMs);
    const safeBeat = Number(beatMs);
    const safeWindow = Math.max(0, Number(windowMs) || 0);
    if (!Number.isFinite(safeNow) || !Number.isFinite(safeBeat) || safeBeat <= 0) return safeNow;
    const beatIndex = Math.round(safeNow / safeBeat);
    const quantized = beatIndex * safeBeat;
    if (Math.abs(quantized - safeNow) <= safeWindow) return Math.round(quantized);
    return Math.round(safeNow);
};

export const LOBBY_PLAYGROUND_ENGINE_CONSTANTS = {
    STREAK_TIMEOUT_MS,
    GROUND_HIT_GRACE_MS,
    RELAY_WINDOW_MS,
    CONTRIBUTION_WINDOW_MS,
    TEAMWORK_WINDOW_MS,
    COMBO_WINDOW_MS,
    MAX_PARTICIPANTS_PER_PAYOUT,
    PAYOUT_COOLDOWN_MS,
    AIR_MULTIPLIER_STEP_MS,
    AIR_MULTIPLIER_CAP,
    RELAY_SEQUENCE,
    INTERACTION_PROFILES,
    TIER_DEFINITIONS,
    LEVEL_DEFINITIONS,
    COMBO_DEFINITIONS
};
