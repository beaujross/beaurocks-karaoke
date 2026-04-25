import { TRIVIA_BANK, WYR_BANK } from './gameDataConstants';

export const RUN_OF_SHOW_PROGRAM_MODES = Object.freeze({
    standard: 'standard_karaoke',
    runOfShow: 'run_of_show'
});
export const RUN_OF_SHOW_OPERATOR_ROLES = Object.freeze({
    host: 'host',
    coHost: 'co_host',
    stageManager: 'stage_manager',
    mediaCurator: 'media_curator',
    viewer: 'viewer'
});
export const RUN_OF_SHOW_LATE_BLOCK_POLICIES = Object.freeze(['hold', 'compress', 'skip_optional']);
export const RUN_OF_SHOW_NO_SHOW_POLICIES = Object.freeze(['hold_for_host', 'skip_to_next', 'pull_from_queue']);
export const RUN_OF_SHOW_QUEUE_DIVERGENCE_POLICIES = Object.freeze(['host_override_only', 'allow_stage_manager', 'queue_can_fill_gaps']);
export const RUN_OF_SHOW_BLOCKED_ACTION_POLICIES = Object.freeze(['focus_next_fix', 'manual_override_allowed', 'skip_blocked_after_review']);
export const RUN_OF_SHOW_DEFAULT_AUTOMATION_POLICIES = Object.freeze(['auto', 'manual']);
export const RUN_OF_SHOW_MOMENT_CUE_IDS = Object.freeze(['', 'hype', 'celebrate', 'reveal', 'next_up', 'reset']);
export const RUN_OF_SHOW_MOMENT_CUE_TIMINGS = Object.freeze(['start', 'end']);
export const RUN_OF_SHOW_TAKEOVER_SOUNDTRACK_SOURCES = Object.freeze(['', 'youtube', 'apple_music', 'bg_track', 'manual_external']);

export const RUN_OF_SHOW_ITEM_TYPES = Object.freeze([
    'intro',
    'performance',
    'trivia_break',
    'game_break',
    'would_you_rather_break',
    'announcement',
    'winner_declaration',
    'intermission',
    'buffer',
    'closing'
]);

export const RUN_OF_SHOW_ITEM_STATUSES = Object.freeze([
    'draft',
    'ready',
    'staged',
    'live',
    'complete',
    'skipped',
    'blocked'
]);
export const RUN_OF_SHOW_CONVEYOR_PHASES = Object.freeze([
    'planned',
    'warming',
    'on_deck',
    'flighted',
    'live',
    'blocked',
    'completed',
    'skipped'
]);
export const RUN_OF_SHOW_GOVERNANCE_MODES = Object.freeze([
    'host_only',
    'crowd_signal',
    'crowd_vote',
    'cohost_vote'
]);
export const RUN_OF_SHOW_RELEASE_POLICIES = Object.freeze([
    'manual_release',
    'suggest_then_host_confirm',
    'auto_flight_winner',
    'locked'
]);
export const RUN_OF_SHOW_RELEASE_WINDOW_CHOICES = Object.freeze([
    'slot_scene',
    'keep_queue_moving'
]);

export const RUN_OF_SHOW_AUTOMATION_MODES = Object.freeze({
    auto: 'auto',
    manual: 'manual'
});
export const RUN_OF_SHOW_ADVANCE_MODES = Object.freeze({
    auto: 'auto',
    host: 'host',
    hostAfterMin: 'host_after_min'
});

export const RUN_OF_SHOW_PERFORMER_MODES = Object.freeze({
    assigned: 'assigned',
    placeholder: 'placeholder',
    openSubmission: 'open_submission'
});

export const RUN_OF_SHOW_BACKING_SOURCES = Object.freeze([
    'canonical_default',
    'youtube',
    'apple_music',
    'user_submitted',
    'local_file',
    'manual_external'
]);

const ALLOWED_ITEM_TYPES = new Set(RUN_OF_SHOW_ITEM_TYPES);
const ALLOWED_STATUSES = new Set(RUN_OF_SHOW_ITEM_STATUSES);
const ALLOWED_BACKING_SOURCES = new Set(RUN_OF_SHOW_BACKING_SOURCES);
const ALLOWED_AUTOMATION_MODES = new Set(Object.values(RUN_OF_SHOW_AUTOMATION_MODES));
const ALLOWED_ADVANCE_MODES = new Set(Object.values(RUN_OF_SHOW_ADVANCE_MODES));
const ALLOWED_PERFORMER_MODES = new Set(Object.values(RUN_OF_SHOW_PERFORMER_MODES));
const ALLOWED_OPERATOR_ROLES = new Set(Object.values(RUN_OF_SHOW_OPERATOR_ROLES));
const ALLOWED_CONVEYOR_PHASES = new Set(RUN_OF_SHOW_CONVEYOR_PHASES);
const ALLOWED_GOVERNANCE_MODES = new Set(RUN_OF_SHOW_GOVERNANCE_MODES);
const ALLOWED_RELEASE_POLICIES = new Set(RUN_OF_SHOW_RELEASE_POLICIES);
const ALLOWED_RELEASE_WINDOW_CHOICES = new Set(RUN_OF_SHOW_RELEASE_WINDOW_CHOICES);
const ALLOWED_LATE_POLICIES = new Set(RUN_OF_SHOW_LATE_BLOCK_POLICIES);
const ALLOWED_NO_SHOW_POLICIES = new Set(RUN_OF_SHOW_NO_SHOW_POLICIES);
const ALLOWED_QUEUE_DIVERGENCE_POLICIES = new Set(RUN_OF_SHOW_QUEUE_DIVERGENCE_POLICIES);
const ALLOWED_BLOCKED_ACTION_POLICIES = new Set(RUN_OF_SHOW_BLOCKED_ACTION_POLICIES);
const ALLOWED_DEFAULT_AUTOMATION_POLICIES = new Set(RUN_OF_SHOW_DEFAULT_AUTOMATION_POLICIES);
const ALLOWED_MOMENT_CUE_IDS = new Set(RUN_OF_SHOW_MOMENT_CUE_IDS);
const ALLOWED_MOMENT_CUE_TIMINGS = new Set(RUN_OF_SHOW_MOMENT_CUE_TIMINGS);
const ALLOWED_TAKEOVER_SOUNDTRACK_SOURCES = new Set(RUN_OF_SHOW_TAKEOVER_SOUNDTRACK_SOURCES);

const clampInt = (value, min, max, fallback) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
};

const cleanText = (value = '') => String(value || '').trim();
const hasOwnField = (source = {}, key = '') => Object.prototype.hasOwnProperty.call(source || {}, key);
const readEditableTextField = (source = {}, key = '', fallback = '') => (
    hasOwnField(source, key)
        ? String(source?.[key] ?? '')
        : fallback
);
const normalizeUidList = (value = []) => [...new Set((Array.isArray(value) ? value : [])
    .map((entry) => cleanText(entry))
    .filter(Boolean)
    .slice(0, 40))];

const asTimestampMs = (value, fallback = 0) => {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
};

const createId = (prefix = 'ros', now = Date.now()) =>
    `${prefix}_${Math.floor(Number(now || Date.now()))}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeInteractiveOptions = (launchConfig = {}) => {
    if (Array.isArray(launchConfig?.options)) {
        return launchConfig.options.map((entry) => cleanText(entry)).filter(Boolean);
    }
    return cleanText(launchConfig?.optionsCsv)
        .split(',')
        .map((entry) => cleanText(entry))
        .filter(Boolean);
};

const normalizeTriviaBankEntry = (entry = {}, index = 0) => ({
    id: cleanText(entry.id) || `builtin_trivia_${index}`,
    q: cleanText(entry.q),
    correct: cleanText(entry.correct),
    w1: cleanText(entry.w1),
    w2: cleanText(entry.w2),
    w3: cleanText(entry.w3),
    points: clampInt(entry.points, 0, 10000, 100)
});

const normalizeWyrBankEntry = (entry = {}, index = 0) => ({
    id: cleanText(entry.id) || `builtin_wyr_${index}`,
    q: cleanText(entry.q),
    a: cleanText(entry.a),
    b: cleanText(entry.b),
    points: clampInt(entry.points, 0, 10000, 50)
});

const INTERACTIVE_PROMPT_PLACEHOLDERS = Object.freeze({
    trivia_break: new Set(['quick room trivia check-in', 'trivia time', 'crowd interaction moment']),
    would_you_rather_break: new Set(['crowd interaction moment', 'would you rather', 'audience vote'])
});

const isPlaceholderInteractiveOption = (value = '') => /^option(?:\s+[a-z0-9]+)?$/i.test(cleanText(value));

const hasMeaningfulInteractiveQuestion = (type = '', question = '') => {
    const safeQuestion = cleanText(question);
    if (!safeQuestion) return false;
    const placeholderSet = INTERACTIVE_PROMPT_PLACEHOLDERS[type] || null;
    return !(placeholderSet && placeholderSet.has(safeQuestion.toLowerCase()));
};

const getInteractiveOptionMinimum = (type = '') => (type === 'trivia_break' ? 4 : 2);

const hasMeaningfulInteractiveOptions = (type = '', options = []) => {
    const normalizedOptions = (Array.isArray(options) ? options : [])
        .map((entry) => cleanText(entry))
        .filter((entry) => entry && !isPlaceholderInteractiveOption(entry));
    return normalizedOptions.length >= getInteractiveOptionMinimum(type);
};

const hashSeedToIndex = (seed = '', length = 0) => {
    if (!Number.isInteger(length) || length <= 0) return -1;
    const safeSeed = cleanText(seed) || 'run_of_show';
    let hash = 0;
    for (let index = 0; index < safeSeed.length; index += 1) {
        hash = ((hash * 31) + safeSeed.charCodeAt(index)) >>> 0;
    }
    return hash % length;
};

const getInteractiveBankEntries = (type = '') => {
    if (type === 'trivia_break') {
        return (Array.isArray(TRIVIA_BANK) ? TRIVIA_BANK : [])
            .map((entry, index) => normalizeTriviaBankEntry(entry, index))
            .filter((entry) => entry.q && entry.correct && entry.w1 && entry.w2 && entry.w3);
    }
    if (type === 'would_you_rather_break') {
        return (Array.isArray(WYR_BANK) ? WYR_BANK : [])
            .map((entry, index) => normalizeWyrBankEntry(entry, index))
            .filter((entry) => entry.q && entry.a && entry.b);
    }
    return [];
};

const getInteractiveBankEntryBySeed = (type = '', seed = '') => {
    const bank = getInteractiveBankEntries(type);
    if (!bank.length) return null;
    const index = hashSeedToIndex(seed || type, bank.length);
    return index >= 0 ? bank[index] : bank[0];
};

const buildDefaultInteractiveLaunchConfig = (type = '', { seed = '', plannedDurationSec = 0 } = {}) => {
    const bankEntry = getInteractiveBankEntryBySeed(type, seed);
    if (!bankEntry) return {};
    const durationSec = clampInt(plannedDurationSec, 5, 3600, 45);
    if (type === 'trivia_break') {
        const options = [bankEntry.correct, bankEntry.w1, bankEntry.w2, bankEntry.w3].filter(Boolean).slice(0, 4);
        return {
            question: bankEntry.q,
            options,
            optionsCsv: options.join(', '),
            correctIndex: 0,
            points: clampInt(bankEntry.points, 0, 10000, 100),
            durationSec,
            autoReveal: true,
            bankEntryId: bankEntry.id,
            contentSource: 'builtin_bank'
        };
    }
    if (type === 'would_you_rather_break') {
        const options = [bankEntry.a, bankEntry.b].filter(Boolean).slice(0, 2);
        return {
            question: bankEntry.q,
            options,
            optionsCsv: options.join(', '),
            points: clampInt(bankEntry.points, 0, 10000, 50),
            durationSec,
            autoReveal: true,
            bankEntryId: bankEntry.id,
            contentSource: 'builtin_bank'
        };
    }
    return {};
};

const normalizeInteractiveLaunchConfig = (type = '', launchConfig = {}, context = {}) => {
    const rawConfig = launchConfig && typeof launchConfig === 'object' ? launchConfig : {};
    const rawOptions = normalizeInteractiveOptions(rawConfig);
    const shouldSeedFromBank = !hasMeaningfulInteractiveQuestion(type, rawConfig.question)
        && !hasMeaningfulInteractiveOptions(type, rawOptions);
    if (shouldSeedFromBank) {
        const seededConfig = buildDefaultInteractiveLaunchConfig(type, context);
        if (Object.keys(seededConfig).length) {
            return {
                ...seededConfig,
                durationSec: clampInt(rawConfig.durationSec, 5, 3600, seededConfig.durationSec || 45),
                points: clampInt(rawConfig.points, 0, 10000, seededConfig.points || (type === 'trivia_break' ? 100 : 50)),
                autoReveal: rawConfig.autoReveal !== false
            };
        }
    }
    const normalizedConfig = { ...rawConfig };
    if (rawOptions.length) {
        normalizedConfig.options = rawOptions;
        normalizedConfig.optionsCsv = rawOptions.join(', ');
    }
    return normalizedConfig;
};

export const normalizeRunOfShowProgramMode = (value = '') => (
    cleanText(value).toLowerCase() === RUN_OF_SHOW_PROGRAM_MODES.runOfShow
        ? RUN_OF_SHOW_PROGRAM_MODES.runOfShow
        : RUN_OF_SHOW_PROGRAM_MODES.standard
);

export const getRunOfShowAdvanceMode = (item = {}) => {
    const safeMode = cleanText(item?.advanceMode).toLowerCase();
    if (ALLOWED_ADVANCE_MODES.has(safeMode)) return safeMode;
    return item?.requireHostAdvance === true
        ? RUN_OF_SHOW_ADVANCE_MODES.host
        : RUN_OF_SHOW_ADVANCE_MODES.auto;
};

export const getRunOfShowHostAdvanceMinSec = (item = {}) => {
    if (getRunOfShowAdvanceMode(item) !== RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin) return 0;
    return clampInt(item?.hostAdvanceMinSec, 0, 3600, clampInt(item?.plannedDurationSec, 0, 3600, 0));
};

export const isRunOfShowOptionalScene = (item = {}) => {
    const safeType = cleanText(item?.type).toLowerCase();
    return ['trivia_break', 'game_break', 'would_you_rather_break', 'announcement', 'intermission', 'buffer'].includes(safeType);
};

const getDefaultGovernanceMode = (type = '') => (
    ['trivia_break', 'game_break', 'would_you_rather_break'].includes(cleanText(type).toLowerCase())
        ? 'crowd_signal'
        : isRunOfShowOptionalScene({ type })
            ? 'crowd_signal'
            : 'host_only'
);

const getDefaultReleasePolicy = (type = '') => (
    isRunOfShowOptionalScene({ type })
        ? 'suggest_then_host_confirm'
        : 'manual_release'
);

const createDefaultRunOfShowReleaseWindow = (overrides = {}) => {
    const votesByUid = overrides?.votesByUid && typeof overrides.votesByUid === 'object' && !Array.isArray(overrides.votesByUid)
        ? Object.fromEntries(Object.entries(overrides.votesByUid)
            .map(([uid, choice]) => [cleanText(uid), cleanText(choice).toLowerCase()])
            .filter(([uid, choice]) => uid && ALLOWED_RELEASE_WINDOW_CHOICES.has(choice)))
        : {};
    return {
        active: overrides?.active === true,
        itemId: cleanText(overrides?.itemId),
        itemTitle: cleanText(overrides?.itemTitle),
        governanceMode: ALLOWED_GOVERNANCE_MODES.has(cleanText(overrides?.governanceMode).toLowerCase())
            ? cleanText(overrides?.governanceMode).toLowerCase()
            : 'host_only',
        releasePolicy: ALLOWED_RELEASE_POLICIES.has(cleanText(overrides?.releasePolicy).toLowerCase())
            ? cleanText(overrides?.releasePolicy).toLowerCase()
            : 'manual_release',
        prompt: cleanText(overrides?.prompt),
        openedAtMs: asTimestampMs(overrides?.openedAtMs, 0),
        closesAtMs: asTimestampMs(overrides?.closesAtMs, 0),
        votesByUid,
        resultChoice: ALLOWED_RELEASE_WINDOW_CHOICES.has(cleanText(overrides?.resultChoice).toLowerCase())
            ? cleanText(overrides?.resultChoice).toLowerCase()
            : '',
        resolvedAtMs: asTimestampMs(overrides?.resolvedAtMs, 0)
    };
};

export const createDefaultRunOfShowPolicy = (overrides = {}) => ({
    defaultAutomationMode: ALLOWED_DEFAULT_AUTOMATION_POLICIES.has(cleanText(overrides.defaultAutomationMode).toLowerCase())
        ? cleanText(overrides.defaultAutomationMode).toLowerCase()
        : 'auto',
    lateBlockPolicy: ALLOWED_LATE_POLICIES.has(cleanText(overrides.lateBlockPolicy).toLowerCase())
        ? cleanText(overrides.lateBlockPolicy).toLowerCase()
        : 'hold',
    noShowPolicy: ALLOWED_NO_SHOW_POLICIES.has(cleanText(overrides.noShowPolicy).toLowerCase())
        ? cleanText(overrides.noShowPolicy).toLowerCase()
        : 'hold_for_host',
    queueDivergencePolicy: ALLOWED_QUEUE_DIVERGENCE_POLICIES.has(cleanText(overrides.queueDivergencePolicy).toLowerCase())
        ? cleanText(overrides.queueDivergencePolicy).toLowerCase()
        : 'host_override_only',
    blockedActionPolicy: ALLOWED_BLOCKED_ACTION_POLICIES.has(cleanText(overrides.blockedActionPolicy).toLowerCase())
        ? cleanText(overrides.blockedActionPolicy).toLowerCase()
        : 'focus_next_fix'
});

export const normalizeRunOfShowPolicy = (value = {}) => createDefaultRunOfShowPolicy(value || {});

export const createDefaultRunOfShowRoles = (overrides = {}) => ({
    coHosts: normalizeUidList([
        ...(Array.isArray(overrides.coHosts || overrides.cohosts) ? (overrides.coHosts || overrides.cohosts) : []),
        ...(Array.isArray(overrides.stageManagers || overrides.stage_managers) ? (overrides.stageManagers || overrides.stage_managers) : []),
        ...(Array.isArray(overrides.mediaCurators || overrides.media_curators) ? (overrides.mediaCurators || overrides.media_curators) : []),
    ])
});

export const normalizeRunOfShowRoles = (value = {}) => createDefaultRunOfShowRoles(value || {});

export const createDefaultRunOfShowTemplateMeta = (overrides = {}) => ({
    currentTemplateId: cleanText(overrides.currentTemplateId),
    currentTemplateName: cleanText(overrides.currentTemplateName),
    lastArchiveId: cleanText(overrides.lastArchiveId),
    archivedAtMs: asTimestampMs(overrides.archivedAtMs, 0)
});

export const normalizeRunOfShowTemplateMeta = (value = {}) => createDefaultRunOfShowTemplateMeta(value || {});

export const getRunOfShowOperatorRole = ({
    uid = '',
    hostUid = '',
    hostUids = [],
    roles = {},
} = {}) => {
    const safeUid = cleanText(uid);
    if (!safeUid) return RUN_OF_SHOW_OPERATOR_ROLES.viewer;
    if (safeUid === cleanText(hostUid) || normalizeUidList(hostUids).includes(safeUid)) {
        return RUN_OF_SHOW_OPERATOR_ROLES.host;
    }
    const normalizedRoles = normalizeRunOfShowRoles(roles || {});
    if (normalizedRoles.coHosts.includes(safeUid)) return RUN_OF_SHOW_OPERATOR_ROLES.coHost;
    return RUN_OF_SHOW_OPERATOR_ROLES.viewer;
};

export const getRunOfShowRoleCapabilities = (role = '') => {
    const safeRole = ALLOWED_OPERATOR_ROLES.has(cleanText(role).toLowerCase())
        ? cleanText(role).toLowerCase()
        : RUN_OF_SHOW_OPERATOR_ROLES.viewer;
    if (safeRole === RUN_OF_SHOW_OPERATOR_ROLES.host) {
        return { canOperate: true, canPauseAutomation: true, canReviewSubmissions: true, canCurateMedia: true, canEditFlow: true, canManageTemplates: true, canManageRoles: true };
    }
    if (safeRole === RUN_OF_SHOW_OPERATOR_ROLES.coHost) {
        return { canOperate: true, canPauseAutomation: false, canReviewSubmissions: true, canCurateMedia: true, canEditFlow: true, canManageTemplates: true, canManageRoles: false };
    }
    if (safeRole === RUN_OF_SHOW_OPERATOR_ROLES.stageManager || safeRole === RUN_OF_SHOW_OPERATOR_ROLES.mediaCurator) {
        return { canOperate: true, canPauseAutomation: false, canReviewSubmissions: true, canCurateMedia: true, canEditFlow: true, canManageTemplates: true, canManageRoles: false };
    }
    return { canOperate: false, canPauseAutomation: false, canReviewSubmissions: false, canCurateMedia: false, canEditFlow: false, canManageTemplates: false, canManageRoles: false };
};

export const getRunOfShowBlockedActionLabel = (readiness = null, item = {}, policy = {}) => {
    const normalizedPolicy = normalizeRunOfShowPolicy(policy || {});
    if (!readiness?.blockers?.length) return 'Ready to stage.';
    if (item?.type === 'performance') {
        if (normalizedPolicy.noShowPolicy === 'skip_to_next') return 'Performer missing: skip this slot and advance to the next ready block.';
        if (normalizedPolicy.noShowPolicy === 'pull_from_queue') return 'Performer missing: pull a queue-ready replacement or assign a new singer.';
    }
    if (normalizedPolicy.blockedActionPolicy === 'manual_override_allowed') return 'Host may override manually after reviewing the blocker.';
    if (normalizedPolicy.blockedActionPolicy === 'skip_blocked_after_review') return 'Review the blocker, then skip this block if it still cannot run.';
    return 'Fix the next blocker before automation can continue.';
};

export const getRunOfShowOperatingHint = ({ item = {}, readiness = null, policy = {} } = {}) => {
    const normalizedPolicy = normalizeRunOfShowPolicy(policy || {});
    if (item?.status === 'blocked') return getRunOfShowBlockedActionLabel(readiness, item, normalizedPolicy);
    const advanceMode = getRunOfShowAdvanceMode(item);
    if (item?.status === 'live' && advanceMode === RUN_OF_SHOW_ADVANCE_MODES.host) {
        return 'This scene stays live until the host explicitly advances it.';
    }
    if (item?.status === 'live' && advanceMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin) {
        const minimumSec = getRunOfShowHostAdvanceMinSec(item);
        return minimumSec > 0
            ? `This scene needs host advance after at least ${minimumSec}s live.`
            : 'This scene needs host advance after its minimum live window.';
    }
    if (item?.status === 'live' && normalizedPolicy.lateBlockPolicy === 'compress') return 'If the room is running late, compress this block before moving on.';
    if (item?.type === 'performance' && normalizedPolicy.queueDivergencePolicy === 'queue_can_fill_gaps') return 'The live queue may fill gaps if this planned slot changes.';
    return normalizedPolicy.defaultAutomationMode === 'manual'
        ? 'This room defaults to manual advancement unless the host arms a block.'
        : 'This room defaults to auto-when-ready progression with host override.';
};

export const getRunOfShowAutomationPauseState = ({
    item = null,
    policy = {},
    pendingSubmissionCount = 0
} = {}) => {
    const safeItem = item && typeof item === 'object'
        ? createRunOfShowItem(item?.type || 'buffer', item)
        : null;
    if (!safeItem || cleanText(safeItem?.type).toLowerCase() !== 'performance') return null;

    const readiness = getRunOfShowItemReadiness(safeItem, { pendingSubmissionCount });
    const blockerKeys = new Set(
        (Array.isArray(readiness?.blockers) ? readiness.blockers : [])
            .map((entry) => cleanText(entry?.key).toLowerCase())
            .filter(Boolean)
    );
    const waitingOnSinger = blockerKeys.has('performer_missing')
        || blockerKeys.has('performer_open_slot')
        || blockerKeys.has('performer_submission_pending');
    if (!waitingOnSinger) return null;

    const detail = blockerKeys.has('performer_submission_pending')
        ? (cleanText(readiness?.summary) || 'The next block still needs singer approval.')
        : (cleanText(getRunOfShowBlockedActionLabel(readiness, safeItem, policy)) || 'The next performance is waiting on a singer.');

    return {
        status: 'waiting_for_performer',
        detail
    };
};

export const createDefaultBackingPlan = (overrides = {}) => ({
    sourceType: ALLOWED_BACKING_SOURCES.has(cleanText(overrides.sourceType).toLowerCase())
        ? cleanText(overrides.sourceType).toLowerCase()
        : 'canonical_default',
    label: readEditableTextField(overrides, 'label'),
    durationSec: clampInt(overrides.durationSec, 0, 7200, 0),
    songId: cleanText(overrides.songId),
    trackId: cleanText(overrides.trackId),
    mediaUrl: cleanText(overrides.mediaUrl),
    youtubeId: cleanText(overrides.youtubeId),
    appleMusicId: cleanText(overrides.appleMusicId),
    localAssetId: cleanText(overrides.localAssetId),
    submittedBackingId: cleanText(overrides.submittedBackingId),
    approvalStatus: cleanText(overrides.approvalStatus).toLowerCase() || 'approved',
    playbackReady: overrides.playbackReady !== false,
    resolutionStatus: cleanText(overrides.resolutionStatus) || 'ready'
});

const createDefaultPresentationPlan = (type = '', overrides = {}) => ({
    publicTvTakeoverEnabled: overrides.publicTvTakeoverEnabled === true || type === 'announcement' || type === 'intro',
    takeoverScene: cleanText(overrides.takeoverScene) || (type === 'announcement' ? 'announcement' : type),
    headline: readEditableTextField(overrides, 'headline'),
    subhead: readEditableTextField(overrides, 'subhead'),
    backgroundMedia: cleanText(overrides.backgroundMedia),
    accentTheme: cleanText(overrides.accentTheme) || 'cyan',
    soundtrackSourceType: ALLOWED_TAKEOVER_SOUNDTRACK_SOURCES.has(cleanText(overrides.soundtrackSourceType).toLowerCase())
        ? cleanText(overrides.soundtrackSourceType).toLowerCase()
        : '',
    soundtrackLabel: readEditableTextField(overrides, 'soundtrackLabel'),
    soundtrackMediaUrl: cleanText(overrides.soundtrackMediaUrl),
    soundtrackYoutubeId: cleanText(overrides.soundtrackYoutubeId),
    soundtrackAppleMusicId: cleanText(overrides.soundtrackAppleMusicId),
    soundtrackBgTrackId: cleanText(overrides.soundtrackBgTrackId).toLowerCase(),
    soundtrackAutoPlay: overrides.soundtrackAutoPlay === true
});

const createDefaultAudioPlan = (type = '', overrides = {}) => ({
    duckBackingEnabled: overrides.duckBackingEnabled === true || type === 'announcement',
    duckLevelPct: clampInt(overrides.duckLevelPct, 0, 100, type === 'announcement' ? 35 : 100),
    resumeAfterBlock: overrides.resumeAfterBlock !== false,
    voiceoverPriority: cleanText(overrides.voiceoverPriority) || (type === 'announcement' ? 'host' : ''),
    momentCueId: ALLOWED_MOMENT_CUE_IDS.has(cleanText(overrides.momentCueId).toLowerCase())
        ? cleanText(overrides.momentCueId).toLowerCase()
        : '',
    momentCueAutoFire: overrides.momentCueAutoFire === true,
    momentCueTiming: ALLOWED_MOMENT_CUE_TIMINGS.has(cleanText(overrides.momentCueTiming).toLowerCase())
        ? cleanText(overrides.momentCueTiming).toLowerCase()
        : 'start'
});

const createDefaultModeLaunchPlan = (type = '', overrides = {}, context = {}) => {
    const baseModeKey = type === 'trivia_break'
        ? 'trivia_pop'
        : type === 'would_you_rather_break'
            ? 'wyr'
            : cleanText(overrides.modeKey);
    const isBankBackedInteractiveType = type === 'trivia_break' || type === 'would_you_rather_break';
    return {
        modeKey: cleanText(overrides.modeKey) || baseModeKey,
        launchConfig: isBankBackedInteractiveType
            ? normalizeInteractiveLaunchConfig(type, overrides.launchConfig || {}, context)
            : (overrides.launchConfig && typeof overrides.launchConfig === 'object'
                ? overrides.launchConfig
                : {}),
        requiresAudienceTakeover: overrides.requiresAudienceTakeover !== false
            && (type === 'trivia_break' || type === 'would_you_rather_break' || type === 'game_break')
    };
};

export const createRunOfShowItem = (type = 'buffer', overrides = {}, now = Date.now()) => {
    const safeType = ALLOWED_ITEM_TYPES.has(cleanText(type).toLowerCase())
        ? cleanText(type).toLowerCase()
        : 'buffer';
    const performerMode = ALLOWED_PERFORMER_MODES.has(cleanText(overrides.performerMode).toLowerCase())
        ? cleanText(overrides.performerMode).toLowerCase()
        : (safeType === 'performance' ? RUN_OF_SHOW_PERFORMER_MODES.placeholder : '');
    const plannedDurationSource = safeType === 'performance'
        ? (cleanText(overrides.plannedDurationSource).toLowerCase() === 'manual'
            ? 'manual'
            : cleanText(overrides.plannedDurationSource).toLowerCase() === 'backing'
                ? 'backing'
                : '')
        : '';
    const plannedDurationSec = clampInt(
        overrides.plannedDurationSec,
        0,
        3600,
        safeType === 'performance'
            ? 180
            : safeType === 'winner_declaration'
                ? 75
                : 45
    );
    const itemId = cleanText(overrides.id) || createId(safeType, now);
    const inferredAdvanceOverrides = (
        safeType === 'winner_declaration'
        && !cleanText(overrides.advanceMode)
        && overrides.requireHostAdvance !== false
    )
        ? { ...overrides, advanceMode: RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin }
        : overrides;
    const advanceMode = getRunOfShowAdvanceMode(inferredAdvanceOverrides);
    const hostAdvanceMinSec = advanceMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin
        ? clampInt(
            inferredAdvanceOverrides.hostAdvanceMinSec,
            0,
            3600,
            safeType === 'winner_declaration'
                ? Math.min(plannedDurationSec, 20)
                : plannedDurationSec
        )
        : 0;
    const normalizedStatus = ALLOWED_STATUSES.has(cleanText(overrides.status).toLowerCase())
        ? cleanText(overrides.status).toLowerCase()
        : 'draft';
    const defaultBeltPhase = normalizedStatus === 'live'
        ? 'live'
        : normalizedStatus === 'staged'
            ? 'flighted'
            : normalizedStatus === 'blocked'
                ? 'blocked'
                : normalizedStatus === 'complete'
                    ? 'completed'
                    : normalizedStatus === 'skipped'
                        ? 'skipped'
                        : normalizedStatus === 'ready'
                            ? 'warming'
                            : 'planned';
    const governanceMode = ALLOWED_GOVERNANCE_MODES.has(cleanText(overrides.governanceMode).toLowerCase())
        ? cleanText(overrides.governanceMode).toLowerCase()
        : getDefaultGovernanceMode(safeType);
    const releasePolicy = ALLOWED_RELEASE_POLICIES.has(cleanText(overrides.releasePolicy).toLowerCase())
        ? cleanText(overrides.releasePolicy).toLowerCase()
        : getDefaultReleasePolicy(safeType);
    return {
        id: itemId,
        type: safeType,
        title: readEditableTextField(overrides, 'title', safeType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())),
        sequence: clampInt(overrides.sequence, 1, 999, 1),
        startsAtMs: asTimestampMs(overrides.startsAtMs, 0),
        plannedDurationSec,
        plannedDurationSource,
        status: normalizedStatus,
        beltPhase: ALLOWED_CONVEYOR_PHASES.has(cleanText(overrides.beltPhase).toLowerCase())
            ? cleanText(overrides.beltPhase).toLowerCase()
            : defaultBeltPhase,
        optionalScene: overrides.optionalScene === true || (overrides.optionalScene !== false && isRunOfShowOptionalScene({ type: safeType })),
        governanceMode,
        releasePolicy,
        visibility: cleanText(overrides.visibility).toLowerCase() === 'private' ? 'private' : 'public',
        notes: readEditableTextField(overrides, 'notes'),
        automationMode: ALLOWED_AUTOMATION_MODES.has(cleanText(overrides.automationMode).toLowerCase())
            ? cleanText(overrides.automationMode).toLowerCase()
            : RUN_OF_SHOW_AUTOMATION_MODES.auto,
        advanceMode,
        hostAdvanceMinSec,
        requireHostAdvance: advanceMode !== RUN_OF_SHOW_ADVANCE_MODES.auto,
        performerMode,
        assignedPerformerUid: cleanText(overrides.assignedPerformerUid),
        assignedPerformerName: readEditableTextField(overrides, 'assignedPerformerName'),
        approvedSubmissionId: cleanText(overrides.approvedSubmissionId),
        songId: cleanText(overrides.songId),
        songTitle: readEditableTextField(overrides, 'songTitle'),
        artistName: readEditableTextField(overrides, 'artistName'),
        slotCriteria: overrides.slotCriteria && typeof overrides.slotCriteria === 'object'
            ? {
                requiresAccount: overrides.slotCriteria.requiresAccount !== false,
                minTight15Count: clampInt(overrides.slotCriteria.minTight15Count, 0, 15, 0),
                hostApprovalRequired: overrides.slotCriteria.hostApprovalRequired !== false
            }
            : {
                requiresAccount: true,
                minTight15Count: 0,
                hostApprovalRequired: true
            },
        submissionWindow: overrides.submissionWindow && typeof overrides.submissionWindow === 'object'
            ? overrides.submissionWindow
            : {},
        queueLinkState: cleanText(overrides.queueLinkState).toLowerCase() || 'unlinked',
        preparedQueueSongId: cleanText(overrides.preparedQueueSongId),
        onDeckAtMs: asTimestampMs(overrides.onDeckAtMs, 0),
        flightedAtMs: asTimestampMs(overrides.flightedAtMs, 0),
        stagedAtMs: asTimestampMs(overrides.stagedAtMs, 0),
        liveStartedAtMs: asTimestampMs(overrides.liveStartedAtMs, 0),
        completedAtMs: asTimestampMs(overrides.completedAtMs, 0),
        blockedReason: cleanText(overrides.blockedReason),
        backingPlan: createDefaultBackingPlan(overrides.backingPlan || {}),
        presentationPlan: createDefaultPresentationPlan(safeType, overrides.presentationPlan || {}),
        audioPlan: createDefaultAudioPlan(safeType, overrides.audioPlan || {}),
        modeLaunchPlan: createDefaultModeLaunchPlan(safeType, overrides.modeLaunchPlan || {}, {
            seed: itemId,
            plannedDurationSec
        }),
        roomMomentPlan: overrides.roomMomentPlan && typeof overrides.roomMomentPlan === 'object'
            ? {
                activeScreen: cleanText(overrides.roomMomentPlan.activeScreen),
                activeMode: cleanText(overrides.roomMomentPlan.activeMode),
                showHowToPlay: overrides.roomMomentPlan.showHowToPlay === true,
                lightMode: cleanText(overrides.roomMomentPlan.lightMode).toLowerCase() || 'off'
            }
            : {
                activeScreen: '',
                activeMode: '',
                showHowToPlay: false,
                lightMode: 'off'
            }
    };
};

export const resequenceRunOfShowItems = (items = []) => (
    (Array.isArray(items) ? items : [])
        .map((item, index) => createRunOfShowItem(item?.type || 'buffer', {
            ...(item || {}),
            sequence: index + 1
        }))
);

const buildRunOfShowConveyorSnapshotFromItems = (items = []) => {
    const activeItems = (Array.isArray(items) ? items : []).filter((item) => !['complete', 'skipped'].includes(item.status));
    const liveItem = activeItems.find((item) => item.status === 'live') || null;
    const flightedItem = activeItems.find((item) => item.status === 'staged') || null;
    const queuedItems = activeItems.filter((item) => item.id !== liveItem?.id && item.id !== flightedItem?.id);
    const onDeckItem = queuedItems[0] || null;
    const laterItems = queuedItems.filter((item) => item.id !== onDeckItem?.id);
    return {
        liveItem,
        flightedItem,
        onDeckItem,
        laterItems
    };
};

export const syncRunOfShowBeltPhases = (director = {}) => {
    const baseDirector = director && typeof director === 'object' ? director : {};
    const items = resequenceRunOfShowItems(Array.isArray(baseDirector.items) ? baseDirector.items : []);
    const snapshot = buildRunOfShowConveyorSnapshotFromItems(items);
    const nextItems = items.map((item) => {
        const status = cleanText(item.status).toLowerCase();
        let beltPhase = 'planned';
        if (status === 'live') {
            beltPhase = 'live';
        } else if (status === 'staged') {
            beltPhase = 'flighted';
        } else if (status === 'blocked') {
            beltPhase = 'blocked';
        } else if (status === 'complete') {
            beltPhase = 'completed';
        } else if (status === 'skipped') {
            beltPhase = 'skipped';
        } else if (item.id === snapshot.onDeckItem?.id) {
            beltPhase = 'on_deck';
        } else if (status === 'ready') {
            beltPhase = 'warming';
        }
        return createRunOfShowItem(item.type || 'buffer', {
            ...item,
            beltPhase,
            onDeckAtMs: beltPhase === 'on_deck'
                ? asTimestampMs(item.onDeckAtMs, Date.now())
                : 0,
            flightedAtMs: beltPhase === 'flighted'
                ? asTimestampMs(item.flightedAtMs || item.stagedAtMs, Date.now())
                : 0
        });
    });
    return {
        ...baseDirector,
        items: nextItems
    };
};

export const createDefaultRunOfShowDirector = (overrides = {}) => ({
    version: 1,
    enabled: overrides.enabled === true,
    automationPaused: overrides.automationPaused === true,
    holdCurrent: overrides.holdCurrent === true,
    holdAfterCurrent: overrides.holdAfterCurrent === true,
    automationStatus: cleanText(overrides.automationStatus) || 'idle',
    currentItemId: cleanText(overrides.currentItemId),
    lastCompletedItemId: cleanText(overrides.lastCompletedItemId),
    lastPreparedItemId: cleanText(overrides.lastPreparedItemId),
    lastAutomationAtMs: asTimestampMs(overrides.lastAutomationAtMs, 0),
    audioSnapshot: overrides.audioSnapshot && typeof overrides.audioSnapshot === 'object'
        ? overrides.audioSnapshot
        : null,
    releaseWindow: createDefaultRunOfShowReleaseWindow(overrides.releaseWindow || {}),
    items: resequenceRunOfShowItems(Array.isArray(overrides.items) ? overrides.items : [])
});

export const normalizeRunOfShowDirector = (raw = {}, now = Date.now()) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    const director = createDefaultRunOfShowDirector(source, now);
    director.items = resequenceRunOfShowItems(director.items);
    director.releaseWindow = createDefaultRunOfShowReleaseWindow(director.releaseWindow || {});
    return syncRunOfShowBeltPhases(director);
};

export const getRunOfShowProgressionDecision = ({
    director = {},
    item = null,
    phase = 'prepare',
} = {}) => {
    const normalizedDirector = normalizeRunOfShowDirector(director);
    const safePhase = cleanText(phase).toLowerCase();
    const targetItem = item && typeof item === 'object'
        ? createRunOfShowItem(item?.type || 'buffer', item)
        : null;
    const safeItem = targetItem
        || normalizedDirector.items.find((entry) => entry.id === cleanText(item?.id || ''))
        || null;

    if (!safeItem) {
        return { allowed: false, reason: 'missing_item' };
    }
    if (normalizedDirector.automationPaused) {
        return { allowed: false, reason: 'automation_paused' };
    }
    if (safePhase === 'prepare') {
        if (safeItem.automationMode !== RUN_OF_SHOW_AUTOMATION_MODES.auto) {
            return { allowed: false, reason: 'item_manual_start' };
        }
        const status = cleanText(safeItem.status).toLowerCase();
        if (['complete', 'skipped', 'live', 'staged'].includes(status)) {
            return { allowed: false, reason: 'prepare_not_needed' };
        }
        return { allowed: true, reason: 'ready' };
    }
    if (safePhase === 'start') {
        if (normalizedDirector.holdAfterCurrent) {
            return { allowed: false, reason: 'hold_after_current' };
        }
        if (safeItem.automationMode !== RUN_OF_SHOW_AUTOMATION_MODES.auto) {
            return { allowed: false, reason: 'item_manual_start' };
        }
        if (cleanText(safeItem.status).toLowerCase() !== 'staged') {
            return { allowed: false, reason: 'not_staged' };
        }
        return { allowed: true, reason: 'ready' };
    }
    if (safePhase === 'complete') {
        if (normalizedDirector.holdCurrent) {
            return { allowed: false, reason: 'hold_current' };
        }
        if (cleanText(safeItem.type).toLowerCase() === 'performance') {
            return { allowed: false, reason: 'performance_managed_elsewhere' };
        }
        if (cleanText(safeItem.status).toLowerCase() !== 'live') {
            return { allowed: false, reason: 'not_live' };
        }
        const advanceMode = getRunOfShowAdvanceMode(safeItem);
        if (advanceMode === RUN_OF_SHOW_ADVANCE_MODES.host) {
            return { allowed: false, reason: 'require_host_advance' };
        }
        if (advanceMode === RUN_OF_SHOW_ADVANCE_MODES.hostAfterMin) {
            const minDurationMs = getRunOfShowHostAdvanceMinSec(safeItem) * 1000;
            const liveStartedAtMs = asTimestampMs(safeItem.liveStartedAtMs, 0);
            const elapsedMs = liveStartedAtMs > 0 ? Math.max(0, Date.now() - liveStartedAtMs) : 0;
            if (!liveStartedAtMs || elapsedMs < minDurationMs) {
                return { allowed: false, reason: 'host_advance_min_not_reached' };
            }
            return { allowed: false, reason: 'ready_for_host_advance' };
        }
        return { allowed: true, reason: 'ready' };
    }
    return { allowed: false, reason: 'unknown_phase' };
};

export const updateRunOfShowItem = (director = {}, itemId = '', updater = null) => {
    const normalized = normalizeRunOfShowDirector(director);
    const safeItemId = cleanText(itemId);
    if (!safeItemId || typeof updater !== 'function') return normalized;
    const nextItems = normalized.items.map((item) => {
        if (item.id !== safeItemId) return item;
        const nextValue = updater(item);
        return createRunOfShowItem(item.type, {
            ...item,
            ...(nextValue && typeof nextValue === 'object' ? nextValue : {})
        });
    });
    return {
        ...normalized,
        items: resequenceRunOfShowItems(nextItems)
    };
};

export const getRunOfShowLiveItem = (director = {}) =>
    normalizeRunOfShowDirector(director).items.find((item) => item.status === 'live') || null;

export const getRunOfShowStagedItem = (director = {}) =>
    normalizeRunOfShowDirector(director).items.find((item) => item.status === 'staged') || null;

export const getNextRunOfShowItem = (director = {}) =>
    normalizeRunOfShowDirector(director).items.find((item) => !['complete', 'skipped', 'live'].includes(item.status)) || null;

export const getRunOfShowConveyorSnapshot = (director = {}) => {
    const normalizedDirector = normalizeRunOfShowDirector(director);
    return buildRunOfShowConveyorSnapshotFromItems(normalizedDirector.items);
};

export const getRunOfShowConveyorPhase = (director = {}, item = null) => {
    const safeItem = item && typeof item === 'object'
        ? createRunOfShowItem(item?.type || 'buffer', item)
        : null;
    if (!safeItem?.id) return RUN_OF_SHOW_CONVEYOR_PHASES[0];
    const conveyor = getRunOfShowConveyorSnapshot(director);
    const status = cleanText(safeItem.status).toLowerCase();
    if (status === 'live') return 'live';
    if (status === 'staged') return 'flighted';
    if (status === 'blocked') return 'blocked';
    if (status === 'complete') return 'completed';
    if (status === 'skipped') return 'skipped';
    if (safeItem.id === conveyor.onDeckItem?.id) return 'on_deck';
    if (status === 'ready') return 'warming';
    return 'planned';
};

export const getRunOfShowReleaseWindowTally = (releaseWindow = {}, roles = {}) => {
    const safeWindow = createDefaultRunOfShowReleaseWindow(releaseWindow || {});
    const normalizedRoles = normalizeRunOfShowRoles(roles || {});
    const votes = Object.entries(safeWindow.votesByUid || {});
    const coHostSet = new Set(normalizedRoles.coHosts || []);
    const filteredVotes = votes.filter(([uid]) => {
        if (!safeWindow.active) return false;
        if (safeWindow.governanceMode === 'cohost_vote') return coHostSet.has(uid);
        return true;
    });
    const slotSceneCount = filteredVotes.filter(([, choice]) => choice === 'slot_scene').length;
    const keepQueueMovingCount = filteredVotes.filter(([, choice]) => choice === 'keep_queue_moving').length;
    const totalVotes = slotSceneCount + keepQueueMovingCount;
    const leadingChoice = slotSceneCount === keepQueueMovingCount
        ? ''
        : (slotSceneCount > keepQueueMovingCount ? 'slot_scene' : 'keep_queue_moving');
    return {
        slotSceneCount,
        keepQueueMovingCount,
        totalVotes,
        leadingChoice,
        summary: !totalVotes
            ? 'No votes yet'
            : leadingChoice === 'slot_scene'
                ? `${slotSceneCount}-${keepQueueMovingCount} favor slotting the scene`
                : leadingChoice === 'keep_queue_moving'
                    ? `${keepQueueMovingCount}-${slotSceneCount} favor keeping the queue moving`
                    : `${slotSceneCount}-${keepQueueMovingCount} split room`
    };
};

export const getRunOfShowReleaseWindowPrompt = (item = null) => {
    const safeItem = item && typeof item === 'object' ? item : null;
    const label = cleanText(safeItem?.title) || getRunOfShowItemLabel(safeItem?.type || '');
    return label ? `Should "${label}" slot in next?` : 'Should this scene slot in next?';
};

export const hasRunOfShowBackingIdentity = (backingPlan = {}) => {
    const safeSource = cleanText(backingPlan?.sourceType).toLowerCase();
    const hasMediaUrl = !!cleanText(backingPlan?.mediaUrl);
    if (!ALLOWED_BACKING_SOURCES.has(safeSource)) return false;
    if (safeSource === 'canonical_default') {
        return !!cleanText(backingPlan?.trackId) || !!cleanText(backingPlan?.appleMusicId) || hasMediaUrl;
    }
    if (safeSource === 'youtube') {
        return !!cleanText(backingPlan?.youtubeId) || hasMediaUrl;
    }
    if (safeSource === 'apple_music') {
        return !!cleanText(backingPlan?.appleMusicId) || !!cleanText(backingPlan?.trackId) || hasMediaUrl;
    }
    if (safeSource === 'user_submitted') {
        return !!cleanText(backingPlan?.submittedBackingId) || !!cleanText(backingPlan?.youtubeId) || hasMediaUrl;
    }
    if (safeSource === 'local_file') {
        return !!cleanText(backingPlan?.localAssetId) || hasMediaUrl;
    }
    return false;
};

export const isApprovedAutomationSource = (backingPlan = {}) => {
    const safeSource = cleanText(backingPlan?.sourceType).toLowerCase();
    if (!ALLOWED_BACKING_SOURCES.has(safeSource)) return false;
    if (safeSource === 'manual_external') return false;
    if (!hasRunOfShowBackingIdentity(backingPlan)) return false;
    const approvalStatus = cleanText(backingPlan?.approvalStatus).toLowerCase();
    if (approvalStatus === 'rejected') return false;
    if (safeSource === 'user_submitted') {
        return approvalStatus === 'approved' && backingPlan?.playbackReady === true;
    }
    return backingPlan?.playbackReady === true;
};

export const isRunOfShowItemReady = (item = {}) => {
    const safeType = cleanText(item?.type).toLowerCase();
    if (safeType === 'performance') {
        const performerReady = !!cleanText(item?.assignedPerformerName)
            || !!cleanText(item?.assignedPerformerUid)
            || !!cleanText(item?.approvedSubmissionId);
        const songReady = !!cleanText(item?.songTitle);
        return performerReady && songReady && isApprovedAutomationSource(item?.backingPlan);
    }
    if (safeType === 'trivia_break' || safeType === 'would_you_rather_break' || safeType === 'game_break') {
        const launchConfig = item?.modeLaunchPlan?.launchConfig || {};
        const options = normalizeInteractiveOptions(launchConfig);
        if (!cleanText(item?.modeLaunchPlan?.modeKey)) return false;
        if (safeType === 'game_break') return true;
        return hasMeaningfulInteractiveQuestion(safeType, launchConfig.question)
            && hasMeaningfulInteractiveOptions(safeType, options);
    }
    if (safeType === 'announcement' || safeType === 'intro' || safeType === 'closing' || safeType === 'winner_declaration') {
        return !!cleanText(item?.title) || !!cleanText(item?.presentationPlan?.headline);
    }
    if (safeType === 'intermission' || safeType === 'buffer') {
        return !!cleanText(item?.title) && clampInt(item?.plannedDurationSec, 0, 3600, 0) > 0;
    }
    return !!cleanText(item?.title);
};

export const hasRunOfShowTakeoverSoundtrackIdentity = (presentationPlan = {}) => {
    const sourceType = cleanText(presentationPlan?.soundtrackSourceType).toLowerCase();
    if (!ALLOWED_TAKEOVER_SOUNDTRACK_SOURCES.has(sourceType) || !sourceType) return false;
    if (sourceType === 'youtube') {
        return !!cleanText(presentationPlan?.soundtrackYoutubeId) || !!cleanText(presentationPlan?.soundtrackMediaUrl);
    }
    if (sourceType === 'apple_music') {
        return !!cleanText(presentationPlan?.soundtrackAppleMusicId);
    }
    if (sourceType === 'bg_track') {
        return !!cleanText(presentationPlan?.soundtrackBgTrackId) || !!cleanText(presentationPlan?.soundtrackMediaUrl);
    }
    if (sourceType === 'manual_external') {
        return !!cleanText(presentationPlan?.soundtrackMediaUrl);
    }
    return false;
};

export const getRunOfShowItemReadiness = (item = {}, options = {}) => {
    const safeType = cleanText(item?.type).toLowerCase();
    const performerMode = cleanText(item?.performerMode).toLowerCase();
    const pendingSubmissionCount = clampInt(options?.pendingSubmissionCount, 0, 999, 0);
    const blockers = [];
    const advisories = [];
    const pushBlocker = (key, label) => blockers.push({ key, label });
    const pushAdvisory = (key, label) => advisories.push({ key, label });

    if (safeType === 'performance') {
        const performerReady = !!cleanText(item?.assignedPerformerName)
            || !!cleanText(item?.assignedPerformerUid)
            || !!cleanText(item?.approvedSubmissionId);
        const songReady = !!cleanText(item?.songTitle);
        const backingPlan = item?.backingPlan || {};
        const sourceType = cleanText(backingPlan?.sourceType).toLowerCase() || 'canonical_default';
        const approvalStatus = cleanText(backingPlan?.approvalStatus).toLowerCase();

        if (!performerReady) {
            if (performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission && pendingSubmissionCount > 0) {
                pushBlocker('performer_submission_pending', `Approve one of the ${pendingSubmissionCount} pending submissions or assign a performer manually.`);
            } else if (performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission) {
                pushBlocker('performer_open_slot', 'This slot is still waiting for an approved singer submission or manual assignment.');
            } else {
                pushBlocker('performer_missing', 'Assign a performer before this block can auto-run.');
            }
        }

        if (!songReady) {
            pushBlocker('song_missing', 'Pick the song title for this performance block.');
        }

        if (sourceType === 'manual_external') {
            pushBlocker('backing_manual_external', 'Manual external backing cannot auto-run. Choose a playback-backed source or switch this block to manual.');
        } else {
            if (!hasRunOfShowBackingIdentity(backingPlan)) {
                if (sourceType === 'youtube') pushBlocker('backing_reference_missing', 'Add a YouTube URL or video ID for the backing track.');
                else if (sourceType === 'apple_music') pushBlocker('backing_reference_missing', 'Add an Apple track reference for the backing track.');
                else if (sourceType === 'local_file') pushBlocker('backing_reference_missing', 'Attach a local asset id or fallback media URL for the backing track.');
                else if (sourceType === 'user_submitted') pushBlocker('backing_reference_missing', 'Link the approved submitted backing before this performance can run.');
                else pushBlocker('backing_reference_missing', 'Choose a real backing reference before this block can auto-run.');
            }
            if (approvalStatus === 'rejected') {
                pushBlocker('backing_rejected', 'This backing was marked as a bad fit. Pick a different result or clear the rejection.');
            } else if (sourceType === 'user_submitted' && approvalStatus !== 'approved') {
                pushBlocker('backing_not_approved', 'Approve the submitted backing before this performance can run.');
            }
            if (backingPlan?.playbackReady !== true) {
                pushBlocker('backing_not_playback_ready', 'Mark the backing source as playback-ready before staging this performance.');
            }
        }

        if (performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission && pendingSubmissionCount > 0 && performerReady) {
            pushAdvisory('submission_pool_available', `${pendingSubmissionCount} pending submissions are still waiting in this slot's queue.`);
        }
    } else if (safeType === 'trivia_break' || safeType === 'would_you_rather_break' || safeType === 'game_break') {
        if (!cleanText(item?.modeLaunchPlan?.modeKey)) {
            pushBlocker('mode_key_missing', 'Choose which interactive mode should launch for this break.');
        }
        const launchConfig = item?.modeLaunchPlan?.launchConfig || {};
        if ((safeType === 'trivia_break' || safeType === 'would_you_rather_break')
            && !hasMeaningfulInteractiveQuestion(safeType, launchConfig.question)) {
            pushBlocker(
                'prompt_missing',
                safeType === 'trivia_break'
                    ? 'Pick a trivia question from the bank or write a full custom prompt before this break can run.'
                    : 'Pick a WYR prompt from the bank or write a full custom prompt before this break can run.'
            );
        }
        const options = normalizeInteractiveOptions(launchConfig);
        if (safeType === 'trivia_break' && !hasMeaningfulInteractiveOptions(safeType, options)) {
            pushBlocker('options_missing', 'Trivia breaks need four real answer choices so Public TV and phones can launch cleanly.');
        } else if (safeType === 'would_you_rather_break' && !hasMeaningfulInteractiveOptions(safeType, options)) {
            pushBlocker('options_missing', 'WYR breaks need two real answer choices so the room vote is usable on TV and phone.');
        }
    } else if (safeType === 'announcement' || safeType === 'intro' || safeType === 'closing' || safeType === 'winner_declaration') {
        if (!cleanText(item?.title) && !cleanText(item?.presentationPlan?.headline)) {
            pushBlocker('headline_missing', 'Add a title or headline so this presentation block has a clear message.');
        } else if (item?.presentationPlan?.publicTvTakeoverEnabled === true && !cleanText(item?.presentationPlan?.headline)) {
            pushAdvisory('headline_missing', 'Add a headline so the Public TV takeover has a clear anchor.');
        }
        const soundtrackSourceType = cleanText(item?.presentationPlan?.soundtrackSourceType).toLowerCase();
        if (soundtrackSourceType && !hasRunOfShowTakeoverSoundtrackIdentity(item?.presentationPlan || {})) {
            if (soundtrackSourceType === 'youtube') {
                pushBlocker('takeover_soundtrack_missing', 'Add a YouTube ID or media URL for the takeover soundtrack.');
            } else if (soundtrackSourceType === 'apple_music') {
                pushBlocker('takeover_soundtrack_missing', 'Add an Apple Music track id for the takeover soundtrack.');
            } else if (soundtrackSourceType === 'bg_track') {
                pushBlocker('takeover_soundtrack_missing', 'Pick one of the built-in background tracks for the takeover soundtrack.');
            } else {
                pushBlocker('takeover_soundtrack_missing', 'Add a direct media URL for the takeover soundtrack.');
            }
        }
    } else if (safeType === 'intermission' || safeType === 'buffer') {
        if (!cleanText(item?.title)) {
            pushBlocker('title_missing', 'Name this block so operators know why it is in the rundown.');
        }
        if (clampInt(item?.plannedDurationSec, 0, 3600, 0) <= 0) {
            pushBlocker('duration_missing', 'Set a planned duration before staging this block.');
        }
    } else if (!cleanText(item?.title)) {
        pushBlocker('title_missing', 'Add a title before staging this block.');
    }

    return {
        ready: blockers.length === 0 && isRunOfShowItemReady(item),
        blockers,
        advisories,
        summary: blockers.length
            ? blockers[0]?.label || 'This block is not ready yet.'
            : advisories[0]?.label || 'Ready to stage.',
    };
};

export const getRunOfShowPreflightReport = (director = {}, options = {}) => {
    const normalized = normalizeRunOfShowDirector(director);
    const pendingCountsById = options?.pendingCountsById && typeof options.pendingCountsById === 'object'
        ? options.pendingCountsById
        : {};
    const activeItems = normalized.items.filter((item) => !['complete', 'skipped', 'live'].includes(cleanText(item?.status).toLowerCase()));
    const itemReports = activeItems.map((item) => {
        const pendingSubmissionCount = clampInt(pendingCountsById[item.id], 0, 999, 0);
        const readiness = getRunOfShowItemReadiness(item, { pendingSubmissionCount });
        const sourceType = cleanText(item?.backingPlan?.sourceType).toLowerCase();
        const riskyReasons = [];
        if (item?.type === 'performance' && sourceType === 'user_submitted') {
            riskyReasons.push('Uses an approved user-submitted track. Double-check it before relying on automation.');
        }
        if (item?.type === 'performance' && readiness?.advisories?.length) {
            riskyReasons.push(...readiness.advisories.map((entry) => entry?.label).filter(Boolean));
        }
        return {
            item,
            readiness,
            pendingSubmissionCount,
            riskyReasons: [...new Set(riskyReasons)]
        };
    });
    const criticalItems = itemReports
        .filter((entry) => Array.isArray(entry.readiness?.blockers) && entry.readiness.blockers.length > 0)
        .map((entry) => ({
            itemId: entry.item.id,
            sequence: Number(entry.item?.sequence || 0),
            type: entry.item?.type || 'buffer',
            title: entry.item?.title || getRunOfShowItemLabel(entry.item?.type || ''),
            summary: entry.readiness?.summary || 'Needs setup.',
            blockers: entry.readiness?.blockers || []
        }));
    const riskyItems = itemReports
        .filter((entry) => !entry.readiness?.blockers?.length)
        .filter((entry) => entry.riskyReasons.length > 0)
        .map((entry) => ({
            itemId: entry.item.id,
            sequence: Number(entry.item?.sequence || 0),
            type: entry.item?.type || 'buffer',
            title: entry.item?.title || getRunOfShowItemLabel(entry.item?.type || ''),
            summary: entry.riskyReasons[0] || entry.readiness?.summary || 'Review this block before launch.',
            reasons: entry.riskyReasons
        }));
    const readyCount = itemReports.filter((entry) => entry.readiness?.ready === true).length;
    const pendingApprovalCount = itemReports.reduce((sum, entry) => sum + Number(entry.pendingSubmissionCount || 0), 0);
    const readyToStart = activeItems.length > 0 && criticalItems.length === 0;
    return {
        itemCount: activeItems.length,
        readyCount,
        criticalCount: criticalItems.length,
        riskyCount: riskyItems.length,
        pendingApprovalCount,
        readyToStart,
        criticalItems,
        riskyItems,
        summary: !activeItems.length
            ? 'Add at least one run-of-show block before launch.'
            : criticalItems.length
                ? `${criticalItems.length} critical blocker${criticalItems.length === 1 ? '' : 's'} must be cleared before a safe start.`
                : riskyItems.length
                    ? `${riskyItems.length} risky block${riskyItems.length === 1 ? '' : 's'} should be reviewed before launch.`
                    : 'All upcoming blocks are ready for launch.'
    };
};

export const getRunOfShowHudState = ({
    hasPlan = false,
    runEnabled = false,
    automationPaused = false,
    preflightReport = null,
    issueDetail = '',
    liveItemId = '',
    stagedItemId = '',
    nextItemId = ''
} = {}) => {
    const safeReport = preflightReport && typeof preflightReport === 'object'
        ? preflightReport
        : {
            readyToStart: !!hasPlan,
            criticalCount: 0,
            riskyCount: 0,
            summary: hasPlan ? 'Show plan is loaded.' : 'Add at least one run-of-show block before launch.'
        };
    if (!hasPlan) {
        return {
            title: 'Ready to start',
            detail: 'Build at least one show block before going live.',
            tone: 'neutral'
        };
    }
    if (!runEnabled) {
        if (!safeReport.readyToStart || safeReport.criticalCount > 0) {
            return {
                title: 'Needs attention',
                detail: safeReport.summary || 'Fix launch blockers before the show starts.',
                tone: 'warning'
            };
        }
        if (safeReport.riskyCount > 0) {
            return {
                title: 'Ready to start',
                detail: safeReport.summary || 'The show can start, but a few blocks still need a host eye.',
                tone: 'info'
            };
        }
        return {
            title: 'Ready to start',
            detail: 'The show is set up and clear to launch.',
            tone: 'success'
        };
    }
    if (automationPaused) {
        return {
            title: 'Needs attention',
            detail: cleanText(issueDetail) || 'Automation is paused. Resume when the room is ready.',
            tone: 'warning'
        };
    }
    if (cleanText(issueDetail)) {
        return {
            title: 'Needs attention',
            detail: cleanText(issueDetail),
            tone: 'warning'
        };
    }
    return {
        title: 'Running smoothly',
        detail: stagedItemId
            ? 'The next block is staged and ready to go live.'
            : nextItemId
                ? 'The next block is queued and ready to prep.'
                : liveItemId
                    ? 'The current block is live and the show is on track.'
                    : 'The show is armed and ready for the next move.',
        tone: 'success'
    };
};

export const getRunOfShowHudToneClass = (tone = '') => {
    const safeTone = cleanText(tone).toLowerCase();
    if (safeTone === 'warning') return 'border-amber-300/28 bg-amber-500/12 text-amber-100';
    if (safeTone === 'info') return 'border-cyan-300/22 bg-cyan-500/10 text-cyan-100';
    if (safeTone === 'success') return 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100';
    return 'border-white/10 bg-black/25 text-zinc-300';
};

export const getRunOfShowHudActionKey = ({
    hasPlan = false,
    runEnabled = false,
    automationPaused = false,
    preflightReport = null,
    hasIssue = false
} = {}) => {
    const safeReport = preflightReport && typeof preflightReport === 'object'
        ? preflightReport
        : {
            readyToStart: !!hasPlan,
            criticalCount: 0,
            riskyCount: 0
        };
    if (!hasPlan) return 'open_show';
    if (!runEnabled) {
        if (!safeReport.readyToStart || safeReport.criticalCount > 0 || safeReport.riskyCount > 0) return 'go_live_check';
        return 'start_show';
    }
    if (automationPaused) return 'resume';
    if (hasIssue) return 'fix_issue';
    return 'advance';
};

export const getRunOfShowPublicItems = (director = {}) =>
    normalizeRunOfShowDirector(director).items.filter((item) => item.visibility === 'public');

export const getRunOfShowOpenSubmissionItems = (director = {}) =>
    normalizeRunOfShowDirector(director).items.filter((item) => (
        item.type === 'performance' && item.performerMode === RUN_OF_SHOW_PERFORMER_MODES.openSubmission
    ));

export const buildRunOfShowQueueDocId = (roomCode = '', itemId = '') => {
    const room = cleanText(roomCode).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
    const item = cleanText(itemId).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
    if (!room || !item) return '';
    return `ros_${room}_${item}`;
};

export const getRunOfShowItemLabel = (type = '') => {
    const safeType = cleanText(type).toLowerCase();
    if (!safeType) return 'Run Of Show';
    if (safeType === 'winner_declaration') return 'Declare Winner';
    return safeType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};
