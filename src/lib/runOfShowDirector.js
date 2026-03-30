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

export const RUN_OF_SHOW_ITEM_TYPES = Object.freeze([
    'intro',
    'performance',
    'trivia_break',
    'game_break',
    'would_you_rather_break',
    'announcement',
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

export const RUN_OF_SHOW_AUTOMATION_MODES = Object.freeze({
    auto: 'auto',
    manual: 'manual'
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
const ALLOWED_PERFORMER_MODES = new Set(Object.values(RUN_OF_SHOW_PERFORMER_MODES));
const ALLOWED_OPERATOR_ROLES = new Set(Object.values(RUN_OF_SHOW_OPERATOR_ROLES));
const ALLOWED_LATE_POLICIES = new Set(RUN_OF_SHOW_LATE_BLOCK_POLICIES);
const ALLOWED_NO_SHOW_POLICIES = new Set(RUN_OF_SHOW_NO_SHOW_POLICIES);
const ALLOWED_QUEUE_DIVERGENCE_POLICIES = new Set(RUN_OF_SHOW_QUEUE_DIVERGENCE_POLICIES);
const ALLOWED_BLOCKED_ACTION_POLICIES = new Set(RUN_OF_SHOW_BLOCKED_ACTION_POLICIES);
const ALLOWED_DEFAULT_AUTOMATION_POLICIES = new Set(RUN_OF_SHOW_DEFAULT_AUTOMATION_POLICIES);

const clampInt = (value, min, max, fallback) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
};

const cleanText = (value = '') => String(value || '').trim();
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

export const normalizeRunOfShowProgramMode = (value = '') => (
    cleanText(value).toLowerCase() === RUN_OF_SHOW_PROGRAM_MODES.runOfShow
        ? RUN_OF_SHOW_PROGRAM_MODES.runOfShow
        : RUN_OF_SHOW_PROGRAM_MODES.standard
);

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
    if (item?.status === 'live' && normalizedPolicy.lateBlockPolicy === 'compress') return 'If the room is running late, compress this block before moving on.';
    if (item?.type === 'performance' && normalizedPolicy.queueDivergencePolicy === 'queue_can_fill_gaps') return 'The live queue may fill gaps if this planned slot changes.';
    return normalizedPolicy.defaultAutomationMode === 'manual'
        ? 'This room defaults to manual advancement unless the host arms a block.'
        : 'This room defaults to auto-when-ready progression with host override.';
};

export const createDefaultBackingPlan = (overrides = {}) => ({
    sourceType: ALLOWED_BACKING_SOURCES.has(cleanText(overrides.sourceType).toLowerCase())
        ? cleanText(overrides.sourceType).toLowerCase()
        : 'canonical_default',
    label: cleanText(overrides.label),
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
    headline: cleanText(overrides.headline),
    subhead: cleanText(overrides.subhead),
    backgroundMedia: cleanText(overrides.backgroundMedia),
    accentTheme: cleanText(overrides.accentTheme) || 'cyan'
});

const createDefaultAudioPlan = (type = '', overrides = {}) => ({
    duckBackingEnabled: overrides.duckBackingEnabled === true || type === 'announcement',
    duckLevelPct: clampInt(overrides.duckLevelPct, 0, 100, type === 'announcement' ? 35 : 100),
    resumeAfterBlock: overrides.resumeAfterBlock !== false,
    voiceoverPriority: cleanText(overrides.voiceoverPriority) || (type === 'announcement' ? 'host' : '')
});

const createDefaultModeLaunchPlan = (type = '', overrides = {}) => {
    const baseModeKey = type === 'trivia_break'
        ? 'trivia_pop'
        : type === 'would_you_rather_break'
            ? 'wyr'
            : cleanText(overrides.modeKey);
    return {
        modeKey: cleanText(overrides.modeKey) || baseModeKey,
        launchConfig: overrides.launchConfig && typeof overrides.launchConfig === 'object'
            ? overrides.launchConfig
            : {},
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
    return {
        id: cleanText(overrides.id) || createId(safeType, now),
        type: safeType,
        title: cleanText(overrides.title) || safeType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        sequence: clampInt(overrides.sequence, 1, 999, 1),
        startsAtMs: asTimestampMs(overrides.startsAtMs, 0),
        plannedDurationSec: clampInt(overrides.plannedDurationSec, 0, 3600, safeType === 'performance' ? 180 : 45),
        status: ALLOWED_STATUSES.has(cleanText(overrides.status).toLowerCase())
            ? cleanText(overrides.status).toLowerCase()
            : 'draft',
        visibility: cleanText(overrides.visibility).toLowerCase() === 'private' ? 'private' : 'public',
        notes: cleanText(overrides.notes),
        automationMode: ALLOWED_AUTOMATION_MODES.has(cleanText(overrides.automationMode).toLowerCase())
            ? cleanText(overrides.automationMode).toLowerCase()
            : RUN_OF_SHOW_AUTOMATION_MODES.auto,
        performerMode,
        assignedPerformerUid: cleanText(overrides.assignedPerformerUid),
        assignedPerformerName: cleanText(overrides.assignedPerformerName),
        approvedSubmissionId: cleanText(overrides.approvedSubmissionId),
        songId: cleanText(overrides.songId),
        songTitle: cleanText(overrides.songTitle),
        artistName: cleanText(overrides.artistName),
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
        stagedAtMs: asTimestampMs(overrides.stagedAtMs, 0),
        liveStartedAtMs: asTimestampMs(overrides.liveStartedAtMs, 0),
        completedAtMs: asTimestampMs(overrides.completedAtMs, 0),
        blockedReason: cleanText(overrides.blockedReason),
        backingPlan: createDefaultBackingPlan(overrides.backingPlan || {}),
        presentationPlan: createDefaultPresentationPlan(safeType, overrides.presentationPlan || {}),
        audioPlan: createDefaultAudioPlan(safeType, overrides.audioPlan || {}),
        modeLaunchPlan: createDefaultModeLaunchPlan(safeType, overrides.modeLaunchPlan || {}),
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

export const createDefaultRunOfShowDirector = (overrides = {}, now = Date.now()) => ({
    version: 1,
    enabled: overrides.enabled === true,
    automationPaused: overrides.automationPaused === true,
    automationStatus: cleanText(overrides.automationStatus) || 'idle',
    currentItemId: cleanText(overrides.currentItemId),
    lastCompletedItemId: cleanText(overrides.lastCompletedItemId),
    lastPreparedItemId: cleanText(overrides.lastPreparedItemId),
    lastAutomationAtMs: asTimestampMs(overrides.lastAutomationAtMs, 0),
    audioSnapshot: overrides.audioSnapshot && typeof overrides.audioSnapshot === 'object'
        ? overrides.audioSnapshot
        : null,
    items: resequenceRunOfShowItems(Array.isArray(overrides.items) ? overrides.items : [])
});

export const normalizeRunOfShowDirector = (raw = {}, now = Date.now()) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    const director = createDefaultRunOfShowDirector(source, now);
    director.items = resequenceRunOfShowItems(director.items);
    return director;
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
    if (safeSource === 'user_submitted' && cleanText(backingPlan?.approvalStatus).toLowerCase() !== 'approved') {
        return false;
    }
    if (!hasRunOfShowBackingIdentity(backingPlan)) return false;
    return cleanText(backingPlan?.approvalStatus).toLowerCase() === 'approved' && backingPlan?.playbackReady === true;
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
        return !!cleanText(item?.modeLaunchPlan?.modeKey);
    }
    if (safeType === 'announcement' || safeType === 'intro' || safeType === 'closing') {
        return !!cleanText(item?.title) || !!cleanText(item?.presentationPlan?.headline);
    }
    if (safeType === 'intermission' || safeType === 'buffer') {
        return !!cleanText(item?.title) && clampInt(item?.plannedDurationSec, 0, 3600, 0) > 0;
    }
    return !!cleanText(item?.title);
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
            if (approvalStatus !== 'approved') {
                pushBlocker('backing_not_approved', 'Backing still needs approval before automation can trust it.');
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
        if (!cleanText(item?.modeLaunchPlan?.launchConfig?.question)) {
            pushAdvisory('prompt_missing', 'Add a prompt so the audience sees clear copy when this break starts.');
        }
        const options = Array.isArray(item?.modeLaunchPlan?.launchConfig?.options)
            ? item.modeLaunchPlan.launchConfig.options.filter(Boolean)
            : String(item?.modeLaunchPlan?.launchConfig?.optionsCsv || '')
                .split(',')
                .map((entry) => cleanText(entry))
                .filter(Boolean);
        if ((safeType === 'trivia_break' || safeType === 'would_you_rather_break') && options.length < 2) {
            pushAdvisory('options_missing', 'Add at least two answer options so the TV and audience takeover feel complete.');
        }
    } else if (safeType === 'announcement' || safeType === 'intro' || safeType === 'closing') {
        if (!cleanText(item?.title) && !cleanText(item?.presentationPlan?.headline)) {
            pushBlocker('headline_missing', 'Add a title or headline so this presentation block has a clear message.');
        } else if (item?.presentationPlan?.publicTvTakeoverEnabled === true && !cleanText(item?.presentationPlan?.headline)) {
            pushAdvisory('headline_missing', 'Add a headline so the Public TV takeover has a clear anchor.');
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
    return safeType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};
