import {
    PARTY_POLICY_DEFAULTS,
    normalizeMissionParty
} from './partyOrchestrator.js';

const DEFAULT_FLOW_RULES = Object.freeze({
    balanced: {
        id: 'balanced',
        label: 'Balanced Flow',
        description: 'Round-robin with first-time singer boost.',
        queueSettings: {
            limitMode: 'none',
            limitCount: 0,
            rotation: 'round_robin',
            firstTimeBoost: true
        }
    },
    fair_turns: {
        id: 'fair_turns',
        label: 'Fair Turns',
        description: 'Consistent fairness with a per-night cap.',
        queueSettings: {
            limitMode: 'per_night',
            limitCount: 2,
            rotation: 'round_robin',
            firstTimeBoost: false
        }
    },
    rapid_fire: {
        id: 'rapid_fire',
        label: 'Rapid Fire',
        description: 'Faster pace with tighter queue pressure.',
        queueSettings: {
            limitMode: 'per_hour',
            limitCount: 1,
            rotation: 'first_come',
            firstTimeBoost: false
        }
    }
});

const DEFAULT_ASSIST_LEVEL = 'smart_assist';
const DEFAULT_ARCHETYPE = 'casual';
const AI_CAPABILITY_KEY = 'ai.generate_content';

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const cloneObject = (value) => {
    if (!isObject(value)) return {};
    return JSON.parse(JSON.stringify(value));
};

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const deepSet = (target, path, value) => {
    if (!isObject(target) || typeof path !== 'string' || !path.trim()) return target;
    const segments = path.split('.').map((part) => String(part || '').trim()).filter(Boolean);
    if (!segments.length) return target;
    let cursor = target;
    for (let index = 0; index < segments.length - 1; index += 1) {
        const key = segments[index];
        if (!isObject(cursor[key])) cursor[key] = {};
        cursor = cursor[key];
    }
    cursor[segments[segments.length - 1]] = value;
    return target;
};

const normalizeQueueSettings = (queueSettings = {}) => ({
    limitMode: queueSettings.limitMode || 'none',
    limitCount: Math.max(0, toNumber(queueSettings.limitCount, 0)),
    rotation: queueSettings.rotation || 'round_robin',
    firstTimeBoost: queueSettings.firstTimeBoost !== false
});

const inferFlowRuleFromQueue = (queueSettings = {}, flowRules = DEFAULT_FLOW_RULES) => {
    const normalized = normalizeQueueSettings(queueSettings);
    if (normalized.rotation === 'first_come' || normalized.limitMode === 'per_hour') return 'rapid_fire';
    if (normalized.limitMode === 'per_night') return 'fair_turns';
    if (normalized.limitMode === 'none' && normalized.firstTimeBoost) return 'balanced';
    const knownRuleId = Object.keys(flowRules).find((id) => {
        const ruleQueue = normalizeQueueSettings(flowRules[id]?.queueSettings || {});
        return JSON.stringify(ruleQueue) === JSON.stringify(normalized);
    });
    return knownRuleId || 'balanced';
};

const resolveSpotlightMode = (room = {}, primaryModes = []) => {
    const fallback = 'karaoke';
    const preview = String(room?.gamePreviewId || '').trim();
    if (!preview) return fallback;
    if (!Array.isArray(primaryModes) || primaryModes.length === 0) return preview;
    return primaryModes.some((mode) => mode?.id === preview) ? preview : fallback;
};

export const MISSION_FLOW_RULES = DEFAULT_FLOW_RULES;
export const MISSION_PARTY_DEFAULTS = PARTY_POLICY_DEFAULTS;
export const MISSION_ASSIST_LEVELS = Object.freeze([
    { id: 'manual_first', label: 'Manual First' },
    { id: 'smart_assist', label: 'Smart Assist' },
    { id: 'autopilot_first', label: 'Autopilot First' }
]);

export const buildMissionDraftFromRoom = (room = {}, options = {}) => {
    const flowRules = options?.flowRules || DEFAULT_FLOW_RULES;
    const setupDraft = room?.missionControl?.setupDraft;
    if (isObject(setupDraft)) {
        const archetype = String(setupDraft.archetype || DEFAULT_ARCHETYPE).trim() || DEFAULT_ARCHETYPE;
        const flowRule = String(setupDraft.flowRule || inferFlowRuleFromQueue(room?.queueSettings, flowRules)).trim() || 'balanced';
        const spotlightMode = String(setupDraft.spotlightMode || resolveSpotlightMode(room, options?.primaryModes)).trim() || 'karaoke';
        const assistLevel = String(setupDraft.assistLevel || DEFAULT_ASSIST_LEVEL).trim() || DEFAULT_ASSIST_LEVEL;
        return { archetype, flowRule, spotlightMode, assistLevel };
    }

    const preset = String(room?.hostNightPreset || DEFAULT_ARCHETYPE).trim() || DEFAULT_ARCHETYPE;
    return {
        archetype: preset,
        flowRule: inferFlowRuleFromQueue(room?.queueSettings, flowRules),
        spotlightMode: resolveSpotlightMode(room, options?.primaryModes),
        assistLevel: DEFAULT_ASSIST_LEVEL
    };
};

export const compileMissionDraftToRoomPayload = (draft = {}, capabilities = {}, options = {}) => {
    const presets = options?.presets || {};
    const flowRules = options?.flowRules || DEFAULT_FLOW_RULES;
    const archetype = String(draft?.archetype || DEFAULT_ARCHETYPE).trim() || DEFAULT_ARCHETYPE;
    const preset = presets[archetype] || presets[DEFAULT_ARCHETYPE] || { id: archetype, settings: {} };
    const presetSettings = cloneObject(preset?.settings || {});
    const queueRule = flowRules[draft?.flowRule] || flowRules.balanced || DEFAULT_FLOW_RULES.balanced;
    const queueSettings = normalizeQueueSettings(queueRule?.queueSettings || presetSettings?.queueSettings || {});
    const gameDefaults = presetSettings.gameDefaults || {};
    const canUseAi = !!capabilities?.[AI_CAPABILITY_KEY];
    const requestedSpotlight = String(draft?.spotlightMode || '').trim() || (presetSettings.gamePreviewId || 'karaoke');
    const spotlightMode = requestedSpotlight || 'karaoke';

    return {
        hostNightPreset: preset?.id || archetype || DEFAULT_ARCHETYPE,
        autoDj: !!presetSettings.autoDj,
        autoBgMusic: !!presetSettings.autoBgMusic,
        autoPlayMedia: presetSettings.autoPlayMedia !== false,
        showVisualizerTv: !!presetSettings.showVisualizerTv,
        showLyricsTv: !!presetSettings.showLyricsTv,
        showScoring: presetSettings.showScoring !== false,
        showFameLevel: presetSettings.showFameLevel !== false,
        allowSingerTrackSelect: !!presetSettings.allowSingerTrackSelect,
        marqueeEnabled: !!presetSettings.marqueeEnabled,
        marqueeShowMode: presetSettings.marqueeShowMode || 'always',
        chatShowOnTv: !!presetSettings.chatShowOnTv,
        chatTvMode: presetSettings.chatTvMode || 'auto',
        bouncerMode: !!presetSettings.bouncerMode,
        bingoShowTv: presetSettings.bingoShowTv !== false,
        bingoVotingMode: presetSettings.bingoVotingMode || 'host+votes',
        bingoAutoApprovePct: Math.max(10, Math.min(100, toNumber(presetSettings.bingoAutoApprovePct, 50))),
        bingoAudienceReopenEnabled: presetSettings.bingoAudienceReopenEnabled !== false,
        autoLyricsOnQueue: !!presetSettings.autoLyricsOnQueue && canUseAi,
        popTriviaEnabled: presetSettings.popTriviaEnabled !== false,
        gamePreviewId: spotlightMode === 'karaoke' ? null : spotlightMode,
        gameDefaults: {
            triviaRoundSec: Math.max(5, toNumber(gameDefaults.triviaRoundSec, 20)),
            triviaAutoReveal: gameDefaults.triviaAutoReveal !== false,
            bingoVotingMode: gameDefaults.bingoVotingMode || 'host+votes',
            bingoAutoApprovePct: Math.max(10, Math.min(100, toNumber(gameDefaults.bingoAutoApprovePct, 50)))
        },
        queueSettings
    };
};

export const mergePayloadWithOverrides = (payload = {}, overrides = {}) => {
    const next = cloneObject(payload);
    if (!isObject(overrides)) return next;
    Object.entries(overrides).forEach(([path, value]) => {
        deepSet(next, path, value);
    });
    return next;
};

export const getRecommendedHostAction = ({
    room = {},
    queue = [],
    current = null,
    pendingModerationCount = 0
} = {}) => {
    const activeMode = String(room?.activeMode || 'karaoke').trim() || 'karaoke';
    const queueCount = Array.isArray(queue) ? queue.length : 0;
    const readyCheckActive = !!room?.readyCheck?.active;

    if (pendingModerationCount > 0) {
        return {
            id: 'review_moderation',
            label: 'Review Queue',
            reason: `${pendingModerationCount} moderation item${pendingModerationCount === 1 ? '' : 's'} waiting for approval`,
            status: 'needs_attention'
        };
    }

    if (readyCheckActive) {
        return {
            id: 'ready_check_live',
            label: 'Monitor Crowd Check',
            reason: 'Ready check is active',
            status: 'live'
        };
    }

    if (activeMode !== 'karaoke') {
        return {
            id: 'hype_moment',
            label: 'Trigger Hype Moment',
            reason: `Mode live: ${activeMode}`,
            status: 'live'
        };
    }

    if (!current && queueCount > 0) {
        return {
            id: 'start_next',
            label: 'Start Next Singer',
            reason: `${queueCount} song${queueCount === 1 ? '' : 's'} queued, but no one is on stage`,
            status: 'ready'
        };
    }

    if (queueCount === 0) {
        return {
            id: 'crowd_check',
            label: 'Run Crowd Check',
            reason: 'No songs are queued yet',
            status: 'needs_attention'
        };
    }

    return {
        id: 'hype_moment',
        label: 'Trigger Hype Moment',
        reason: 'Keep energy up between actions',
        status: 'ready'
    };
};

export const buildMissionPartyFromRoom = (room = {}) =>
    normalizeMissionParty(room?.missionControl?.party || {});

export const buildMissionPartyPayload = (party = {}) =>
    normalizeMissionParty(party || {});
