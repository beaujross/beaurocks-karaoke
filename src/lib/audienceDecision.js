export const AUDIENCE_DECISION_TYPES = Object.freeze({
    queueFaceoff: 'queue_faceoff',
    skipOrWait: 'skip_or_wait',
    fillEmptySlot: 'fill_empty_slot',
    keepKaraokeOrGame: 'keep_karaoke_or_game',
    continueOrRotate: 'continue_or_rotate',
    encoreOrNext: 'encore_or_next',
    extendSegment: 'extend_segment',
    applauseRating: 'applause_rating',
    spotlightBoost: 'spotlight_boost',
    battleWinner: 'battle_winner',
    reportIssue: 'report_issue',
    pauseRoom: 'pause_room',
    skipPerformance: 'skip_performance',
    friendlyRoast: 'friendly_roast',
    challengeVote: 'challenge_vote',
    themePick: 'theme_pick'
});

export const AUDIENCE_DECISION_DISPLAY_MODES = Object.freeze({
    takeover: 'takeover',
    glassOverlay: 'glass_overlay',
    phoneOnly: 'phone_only',
    hidden: 'hidden'
});

export const AUDIENCE_DECISION_STATUS = Object.freeze({
    open: 'open',
    resolved: 'resolved',
    cancelled: 'cancelled',
    expired: 'expired'
});

const cleanText = (value = '') => String(value || '').trim();
const asTimestampMs = (value, fallback = 0) => {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
};
const clampNumber = (value, min, max, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
};

const DECISION_TYPE_POLICIES = Object.freeze({
    [AUDIENCE_DECISION_TYPES.queueFaceoff]: {
        category: 'queue_direction',
        prompt: 'Who should sing next?',
        durationSec: 18,
        minimumVotes: 1,
        thresholdMode: 'plurality',
        thresholdPct: 50,
        displayMode: AUDIENCE_DECISION_DISPLAY_MODES.takeover,
        autoResolve: true,
        sensitive: false,
        choices: [
            { id: 'slot_scene', label: 'Choice A', resultAction: 'choose_slot_scene', tone: 'cyan' },
            { id: 'keep_queue_moving', label: 'Choice B', resultAction: 'choose_keep_queue_moving', tone: 'pink' }
        ]
    },
    [AUDIENCE_DECISION_TYPES.skipOrWait]: {
        category: 'queue_recovery',
        prompt: 'Singer is not ready. What should happen?',
        durationSec: 15,
        minimumVotes: 3,
        thresholdMode: 'majority',
        thresholdPct: 60,
        fallbackChoiceId: 'wait',
        displayMode: AUDIENCE_DECISION_DISPLAY_MODES.glassOverlay,
        autoResolve: true,
        sensitive: false,
        choices: [
            { id: 'wait', label: 'Wait a moment', resultAction: 'wait_for_singer', tone: 'cyan' },
            { id: 'skip', label: 'Next singer', resultAction: 'skip_to_next_singer', tone: 'pink' }
        ]
    },
    [AUDIENCE_DECISION_TYPES.continueOrRotate]: {
        category: 'performance_progression',
        prompt: 'Keep it going?',
        durationSec: 12,
        minimumVotes: 3,
        thresholdMode: 'choice_threshold',
        thresholdChoiceId: 'keep_singing',
        thresholdPct: 55,
        fallbackChoiceId: 'next_singer',
        openingWindowSec: 60,
        maxExtensions: 1,
        displayMode: AUDIENCE_DECISION_DISPLAY_MODES.glassOverlay,
        autoResolve: true,
        sensitive: false,
        hostOverrideEnabled: true,
        choices: [
            { id: 'keep_singing', label: 'Keep Singing', resultAction: 'continue_song', tone: 'cyan' },
            { id: 'next_singer', label: 'Next Singer', resultAction: 'wrap_and_rotate', tone: 'pink' }
        ]
    },
    [AUDIENCE_DECISION_TYPES.skipPerformance]: {
        category: 'safety_recovery',
        prompt: 'Keep going or move to the next singer?',
        durationSec: 15,
        minimumVotes: 8,
        thresholdMode: 'choice_threshold',
        thresholdChoiceId: 'next_singer',
        thresholdPct: 70,
        fallbackChoiceId: 'keep_singing',
        minElapsedSec: 90,
        displayMode: AUDIENCE_DECISION_DISPLAY_MODES.glassOverlay,
        autoResolve: true,
        sensitive: true,
        hostOverrideEnabled: true,
        choices: [
            { id: 'keep_singing', label: 'Keep Going', resultAction: 'continue_song', tone: 'cyan' },
            { id: 'next_singer', label: 'Move To Next', resultAction: 'graceful_early_wrap', tone: 'pink' }
        ]
    },
    [AUDIENCE_DECISION_TYPES.reportIssue]: {
        category: 'safety_recovery',
        prompt: 'What needs attention?',
        durationSec: 20,
        minimumVotes: 1,
        thresholdMode: 'plurality',
        thresholdPct: 50,
        displayMode: AUDIENCE_DECISION_DISPLAY_MODES.phoneOnly,
        autoResolve: false,
        sensitive: true,
        hostOverrideEnabled: true,
        choices: [
            { id: 'wrong_song', label: 'Wrong Song', resultAction: 'flag_wrong_song', tone: 'amber' },
            { id: 'tech_issue', label: 'Tech Issue', resultAction: 'flag_tech_issue', tone: 'cyan' },
            { id: 'safety', label: 'Safety Concern', resultAction: 'flag_safety_review', tone: 'pink' }
        ]
    }
});

const FALLBACK_POLICY = Object.freeze({
    category: 'room_governance',
    prompt: 'What should happen next?',
    durationSec: 15,
    minimumVotes: 1,
    thresholdMode: 'plurality',
    thresholdPct: 50,
    displayMode: AUDIENCE_DECISION_DISPLAY_MODES.takeover,
    autoResolve: true,
    sensitive: false,
    choices: [
        { id: 'option_a', label: 'Option A', resultAction: 'choose_option_a', tone: 'cyan' },
        { id: 'option_b', label: 'Option B', resultAction: 'choose_option_b', tone: 'pink' }
    ]
});

export const getAudienceDecisionTypePolicy = (type = '') => {
    const safeType = cleanText(type).toLowerCase();
    return DECISION_TYPE_POLICIES[safeType] || FALLBACK_POLICY;
};

const normalizeChoice = (choice = {}, index = 0) => {
    const fallback = index === 0 ? FALLBACK_POLICY.choices[0] : FALLBACK_POLICY.choices[1];
    const id = cleanText(choice?.id || choice?.key || fallback.id).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    return {
        id,
        label: cleanText(choice?.label) || fallback.label,
        detail: cleanText(choice?.detail),
        subline: cleanText(choice?.subline),
        artworkUrl: cleanText(choice?.artworkUrl),
        resultAction: cleanText(choice?.resultAction) || fallback.resultAction,
        tone: cleanText(choice?.tone).toLowerCase() || fallback.tone
    };
};

export const normalizeAudienceDecision = (decision = {}, options = {}) => {
    const nowMs = asTimestampMs(options.nowMs, Date.now());
    const type = cleanText(decision?.type).toLowerCase() || AUDIENCE_DECISION_TYPES.queueFaceoff;
    const policy = getAudienceDecisionTypePolicy(type);
    const rawChoices = Array.isArray(decision?.choices) && decision.choices.length >= 2
        ? decision.choices
        : policy.choices;
    const choices = rawChoices
        .map((choice, index) => normalizeChoice(choice, index))
        .filter((choice) => choice.id)
        .slice(0, 6);
    const choiceIds = new Set(choices.map((choice) => choice.id));
    const votesByUid = decision?.votesByUid && typeof decision.votesByUid === 'object' && !Array.isArray(decision.votesByUid)
        ? Object.fromEntries(Object.entries(decision.votesByUid)
            .map(([uid, choiceId]) => [cleanText(uid), cleanText(choiceId).toLowerCase()])
            .filter(([uid, choiceId]) => uid && choiceIds.has(choiceId)))
        : {};
    const durationSec = clampNumber(decision?.durationSec, 5, 120, policy.durationSec);
    const openedAtMs = asTimestampMs(decision?.openedAtMs, nowMs);
    const closesAtMs = asTimestampMs(decision?.closesAtMs, openedAtMs + (durationSec * 1000));
    const rawStatus = cleanText(decision?.status).toLowerCase();
    const status = Object.values(AUDIENCE_DECISION_STATUS).includes(rawStatus)
        ? rawStatus
        : (asTimestampMs(decision?.resolvedAtMs, 0) > 0 ? AUDIENCE_DECISION_STATUS.resolved : AUDIENCE_DECISION_STATUS.open);
    const displayMode = Object.values(AUDIENCE_DECISION_DISPLAY_MODES).includes(cleanText(decision?.displayMode).toLowerCase())
        ? cleanText(decision.displayMode).toLowerCase()
        : policy.displayMode;

    return {
        id: cleanText(decision?.id) || `audience_decision:${type}:${openedAtMs}`,
        type,
        category: cleanText(decision?.category).toLowerCase() || policy.category,
        status,
        prompt: cleanText(decision?.prompt) || policy.prompt,
        promptDetail: cleanText(decision?.promptDetail),
        subjectSongId: cleanText(decision?.subjectSongId || decision?.songId),
        subjectSessionId: cleanText(decision?.subjectSessionId || decision?.performanceSessionId),
        displayMode,
        openedBy: cleanText(decision?.openedBy).toLowerCase() || 'system',
        eligibleVoters: Array.isArray(decision?.eligibleVoters) ? decision.eligibleVoters.map(cleanText).filter(Boolean) : [],
        durationSec,
        openedAtMs,
        closesAtMs,
        minimumVotes: Math.max(0, Math.round(clampNumber(decision?.minimumVotes, 0, 10000, policy.minimumVotes))),
        thresholdMode: cleanText(decision?.thresholdMode).toLowerCase() || policy.thresholdMode,
        thresholdPct: clampNumber(decision?.thresholdPct, 0, 100, policy.thresholdPct),
        thresholdChoiceId: cleanText(decision?.thresholdChoiceId).toLowerCase() || policy.thresholdChoiceId || '',
        fallbackChoiceId: cleanText(decision?.fallbackChoiceId).toLowerCase() || policy.fallbackChoiceId || '',
        minElapsedSec: Math.max(0, Math.round(clampNumber(decision?.minElapsedSec, 0, 3600, policy.minElapsedSec || 0))),
        openingWindowSec: Math.max(0, Math.round(clampNumber(decision?.openingWindowSec, 0, 3600, policy.openingWindowSec || 0))),
        maxExtensions: Math.max(0, Math.round(clampNumber(decision?.maxExtensions, 0, 20, policy.maxExtensions || 0))),
        autoResolve: decision?.autoResolve === undefined ? policy.autoResolve !== false : decision.autoResolve === true,
        sensitive: decision?.sensitive === undefined ? policy.sensitive === true : decision.sensitive === true,
        hostOverrideEnabled: decision?.hostOverrideEnabled === undefined ? policy.hostOverrideEnabled !== false : decision.hostOverrideEnabled === true,
        choices,
        votesByUid,
        resultChoice: choiceIds.has(cleanText(decision?.resultChoice).toLowerCase()) ? cleanText(decision.resultChoice).toLowerCase() : '',
        resolutionAction: cleanText(decision?.resolutionAction),
        resolvedAtMs: asTimestampMs(decision?.resolvedAtMs, 0)
    };
};

export const getAudienceDecisionTally = (decision = {}) => {
    const normalized = normalizeAudienceDecision(decision);
    const countsByChoice = Object.fromEntries(normalized.choices.map((choice) => [choice.id, 0]));
    Object.values(normalized.votesByUid || {}).forEach((choiceId) => {
        if (countsByChoice[choiceId] !== undefined) countsByChoice[choiceId] += 1;
    });
    const totalVotes = Object.values(countsByChoice).reduce((sum, count) => sum + count, 0);
    const sortedChoices = normalized.choices
        .map((choice) => ({
            ...choice,
            count: countsByChoice[choice.id] || 0,
            pct: totalVotes > 0 ? ((countsByChoice[choice.id] || 0) / totalVotes) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count);
    const leader = sortedChoices[0] || null;
    const runnerUp = sortedChoices[1] || null;
    const tied = !!(leader && runnerUp && leader.count === runnerUp.count);
    return {
        countsByChoice,
        totalVotes,
        leadingChoice: tied ? '' : (leader?.id || ''),
        leadingCount: tied ? 0 : (leader?.count || 0),
        leadingPct: tied ? 0 : (leader?.pct || 0),
        tied,
        choices: sortedChoices
    };
};

export const resolveAudienceDecision = (decision = {}, options = {}) => {
    const nowMs = asTimestampMs(options.nowMs, Date.now());
    const normalized = normalizeAudienceDecision(decision, { nowMs });
    const tally = getAudienceDecisionTally(normalized);
    const closed = options.force === true || normalized.status === AUDIENCE_DECISION_STATUS.resolved || (normalized.closesAtMs > 0 && nowMs >= normalized.closesAtMs);
    if (!closed && !normalized.resultChoice) {
        return { decision: normalized, tally, resolved: false, resultChoice: '', resolutionAction: '' };
    }
    const choiceById = Object.fromEntries(normalized.choices.map((choice) => [choice.id, choice]));
    const thresholdChoiceId = normalized.thresholdChoiceId || tally.leadingChoice;
    const thresholdChoiceCount = tally.countsByChoice[thresholdChoiceId] || 0;
    const thresholdChoicePct = tally.totalVotes > 0 ? (thresholdChoiceCount / tally.totalVotes) * 100 : 0;
    let resultChoice = normalized.resultChoice;

    if (!resultChoice && tally.totalVotes >= normalized.minimumVotes) {
        if (normalized.thresholdMode === 'choice_threshold') {
            resultChoice = thresholdChoicePct >= normalized.thresholdPct
                ? thresholdChoiceId
                : normalized.fallbackChoiceId;
        } else if (normalized.thresholdMode === 'majority' || normalized.thresholdMode === 'supermajority') {
            resultChoice = !tally.tied && tally.leadingPct >= normalized.thresholdPct
                ? tally.leadingChoice
                : normalized.fallbackChoiceId;
        } else {
            resultChoice = !tally.tied ? tally.leadingChoice : normalized.fallbackChoiceId;
        }
    }

    if (!resultChoice && normalized.fallbackChoiceId) resultChoice = normalized.fallbackChoiceId;
    if (!choiceById[resultChoice]) resultChoice = '';
    const resultChoiceModel = choiceById[resultChoice] || null;
    const resolutionAction = resultChoiceModel?.resultAction || normalized.resolutionAction || '';
    return {
        decision: {
            ...normalized,
            status: resultChoice ? AUDIENCE_DECISION_STATUS.resolved : AUDIENCE_DECISION_STATUS.expired,
            resultChoice,
            resolutionAction,
            resolvedAtMs: normalized.resolvedAtMs || nowMs
        },
        tally,
        resolved: !!resultChoice,
        resultChoice,
        resolutionAction
    };
};

export const buildAudienceDecisionFromReleaseWindow = (releaseWindow = {}, options = {}) => {
    const subjectType = cleanText(releaseWindow?.subjectType).toLowerCase();
    const type = subjectType === AUDIENCE_DECISION_TYPES.queueFaceoff
        ? AUDIENCE_DECISION_TYPES.queueFaceoff
        : subjectType === 'slot_fill_choice'
            ? AUDIENCE_DECISION_TYPES.fillEmptySlot
            : AUDIENCE_DECISION_TYPES.keepKaraokeOrGame;
    return normalizeAudienceDecision({
        id: cleanText(releaseWindow?.itemId) || '',
        type,
        status: releaseWindow?.active === true ? AUDIENCE_DECISION_STATUS.open : '',
        prompt: cleanText(releaseWindow?.prompt),
        promptDetail: cleanText(releaseWindow?.promptDetail),
        displayMode: options.displayMode,
        durationSec: releaseWindow?.durationSec,
        openedAtMs: releaseWindow?.openedAtMs,
        closesAtMs: releaseWindow?.closesAtMs,
        votesByUid: releaseWindow?.votesByUid || {},
        resultChoice: releaseWindow?.resultChoice,
        resolvedAtMs: releaseWindow?.resolvedAtMs,
        choices: [
            {
                id: 'slot_scene',
                label: cleanText(releaseWindow?.choiceLabels?.slot_scene) || 'Choice A',
                detail: cleanText(releaseWindow?.choiceDetails?.slot_scene),
                resultAction: 'choose_slot_scene',
                tone: 'cyan'
            },
            {
                id: 'keep_queue_moving',
                label: cleanText(releaseWindow?.choiceLabels?.keep_queue_moving) || 'Choice B',
                detail: cleanText(releaseWindow?.choiceDetails?.keep_queue_moving),
                resultAction: 'choose_keep_queue_moving',
                tone: 'pink'
            }
        ]
    }, {
        nowMs: options.nowMs
    });
};
export const buildReleaseWindowFromAudienceDecision = (decision = {}, options = {}) => {
    const normalized = normalizeAudienceDecision(decision, { nowMs: options.nowMs });
    const firstChoice = normalized.choices[0] || null;
    const secondChoice = normalized.choices[1] || null;
    if (!firstChoice || !secondChoice) return null;
    return {
        active: normalized.status === AUDIENCE_DECISION_STATUS.open,
        itemId: normalized.id,
        itemTitle: cleanText(decision?.itemTitle) || normalized.prompt,
        subjectType: normalized.type,
        governanceMode: 'crowd_vote',
        releasePolicy: normalized.autoResolve ? 'auto_flight_winner' : 'suggest_then_host_confirm',
        origin: cleanText(decision?.origin) || 'audience_decision',
        prompt: normalized.prompt,
        promptDetail: normalized.promptDetail,
        durationSec: normalized.durationSec,
        openedAtMs: normalized.openedAtMs,
        closesAtMs: normalized.closesAtMs,
        choiceLabels: {
            slot_scene: firstChoice.label,
            keep_queue_moving: secondChoice.label,
        },
        choiceDetails: {
            slot_scene: firstChoice.detail,
            keep_queue_moving: secondChoice.detail,
        },
        choiceArtworkUrls: {
            slot_scene: firstChoice.artworkUrl,
            keep_queue_moving: secondChoice.artworkUrl,
        },
        choiceAudienceDecisionIds: {
            slot_scene: firstChoice.id,
            keep_queue_moving: secondChoice.id,
        },
        votesByUid: Object.fromEntries(Object.entries(normalized.votesByUid || {})
            .map(([uid, choiceId]) => {
                if (choiceId === firstChoice.id) return [uid, 'slot_scene'];
                if (choiceId === secondChoice.id) return [uid, 'keep_queue_moving'];
                return [uid, ''];
            })
            .filter(([, releaseChoice]) => releaseChoice)),
        resultChoice: normalized.resultChoice === firstChoice.id
            ? 'slot_scene'
            : normalized.resultChoice === secondChoice.id
                ? 'keep_queue_moving'
                : '',
        resolvedAtMs: normalized.resolvedAtMs,
        audienceDecisionId: normalized.id,
        audienceDecisionType: normalized.type,
        displayMode: normalized.displayMode,
    };
};
export const buildContinueOrRotateDecision = ({
    songId = '',
    songTitle = '',
    singerName = '',
    artistName = '',
    performanceSessionId = '',
    openedAtMs = Date.now(),
    voteWindowSec = 12,
    openingWindowSec = 60,
} = {}) => {
    const safeOpenedAtMs = asTimestampMs(openedAtMs, Date.now());
    const safeSongId = cleanText(songId);
    const safeSessionId = cleanText(performanceSessionId);
    const safeSingerName = cleanText(singerName) || 'Singer';
    const safeSongTitle = cleanText(songTitle) || 'Current song';
    const safeArtistName = cleanText(artistName);
    const safeVoteWindowSec = clampNumber(voteWindowSec, 5, 45, 12);
    return normalizeAudienceDecision({
        id: `continue_or_rotate:${safeSongId || 'song'}:${safeSessionId || safeOpenedAtMs}`,
        type: AUDIENCE_DECISION_TYPES.continueOrRotate,
        status: AUDIENCE_DECISION_STATUS.open,
        prompt: 'Keep it going?',
        promptDetail: `${safeSingerName} is one minute in. Unlock more time or rotate to the next mic.`,
        displayMode: AUDIENCE_DECISION_DISPLAY_MODES.glassOverlay,
        openedBy: 'system',
        durationSec: safeVoteWindowSec,
        openedAtMs: safeOpenedAtMs,
        closesAtMs: safeOpenedAtMs + (safeVoteWindowSec * 1000),
        openingWindowSec,
        subjectSongId: safeSongId,
        subjectSessionId: safeSessionId,
        choices: [
            {
                id: 'keep_singing',
                label: 'Keep Singing',
                detail: safeSingerName,
                subline: safeArtistName || safeSongTitle,
                resultAction: 'continue_song',
                tone: 'cyan'
            },
            {
                id: 'next_singer',
                label: 'Next Singer',
                detail: 'Rotate the mic',
                subline: 'Keep the queue moving',
                resultAction: 'wrap_and_rotate',
                tone: 'pink'
            }
        ]
    }, {
        nowMs: safeOpenedAtMs
    });
};

export const buildSkipPerformanceDecision = ({
    songId = '',
    songTitle = '',
    singerName = '',
    artistName = '',
    performanceSessionId = '',
    openedAtMs = Date.now(),
    voteWindowSec = 15,
    minElapsedSec = 90,
} = {}) => {
    const safeOpenedAtMs = asTimestampMs(openedAtMs, Date.now());
    const safeSongId = cleanText(songId);
    const safeSessionId = cleanText(performanceSessionId);
    const safeSingerName = cleanText(singerName) || 'Singer';
    const safeSongTitle = cleanText(songTitle) || 'Current song';
    const safeArtistName = cleanText(artistName);
    const safeVoteWindowSec = clampNumber(voteWindowSec, 8, 45, 15);
    const safeMinElapsedSec = Math.max(0, Math.round(clampNumber(minElapsedSec, 0, 3600, 90)));
    return normalizeAudienceDecision({
        id: `skip_performance:${safeSongId || 'song'}:${safeSessionId || safeOpenedAtMs}`,
        type: AUDIENCE_DECISION_TYPES.skipPerformance,
        status: AUDIENCE_DECISION_STATUS.open,
        prompt: 'Keep going or move on?',
        promptDetail: `${safeSingerName} is on the mic. The room can only move on with a strong crowd signal.`,
        displayMode: AUDIENCE_DECISION_DISPLAY_MODES.glassOverlay,
        openedBy: 'system',
        durationSec: safeVoteWindowSec,
        openedAtMs: safeOpenedAtMs,
        closesAtMs: safeOpenedAtMs + (safeVoteWindowSec * 1000),
        minElapsedSec: safeMinElapsedSec,
        minimumVotes: 8,
        thresholdMode: 'choice_threshold',
        thresholdChoiceId: 'next_singer',
        thresholdPct: 70,
        fallbackChoiceId: 'keep_singing',
        sensitive: true,
        hostOverrideEnabled: true,
        subjectSongId: safeSongId,
        subjectSessionId: safeSessionId,
        choices: [
            {
                id: 'keep_singing',
                label: 'Keep Going',
                detail: safeSingerName,
                subline: safeArtistName || safeSongTitle,
                resultAction: 'continue_song',
                tone: 'cyan'
            },
            {
                id: 'next_singer',
                label: 'Move To Next',
                detail: 'Rotate kindly',
                subline: 'Requires a strong majority',
                resultAction: 'graceful_early_wrap',
                tone: 'pink'
            }
        ]
    }, {
        nowMs: safeOpenedAtMs
    });
};