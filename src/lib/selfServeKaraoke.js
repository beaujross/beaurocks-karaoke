import {
    AUDIENCE_BACKING_MODES,
    REQUEST_MODES,
    UNKNOWN_BACKING_POLICIES,
} from './requestModes.js';

export const SELF_SERVE_FORMATS = Object.freeze({
    openStage: 'open_stage',
    spotlightAuction: 'spotlight_auction',
    showcase: 'showcase',
});

const SELF_SERVE_FORMAT_ALIASES = Object.freeze({
    support_surge: SELF_SERVE_FORMATS.spotlightAuction,
    fundraiser_surge: SELF_SERVE_FORMATS.spotlightAuction,
    donor_surge: SELF_SERVE_FORMATS.spotlightAuction,
});

const SELF_SERVE_FORMAT_VALUES = new Set(Object.values(SELF_SERVE_FORMATS));
const DEFAULT_QUEUE_SETTINGS = Object.freeze({
    limitMode: 'none',
    limitCount: 0,
    rotation: 'round_robin',
    firstTimeBoost: true,
});
const DEFAULT_AUCTION_WINDOW = Object.freeze({
    scopeType: 'opening_slots',
    slotCount: 10,
    remainingSlots: 10,
    priorityAssignments: 0,
    closed: false,
    closedAtMs: 0,
    closeReason: '',
    lastAssignedSongId: '',
    lastAssignedAtMs: 0,
});

const normalizeQueueSettings = (queueSettings = {}) => ({
    limitMode: String(queueSettings?.limitMode || DEFAULT_QUEUE_SETTINGS.limitMode).trim() || DEFAULT_QUEUE_SETTINGS.limitMode,
    limitCount: Math.max(0, Number(queueSettings?.limitCount || 0)),
    rotation: String(queueSettings?.rotation || DEFAULT_QUEUE_SETTINGS.rotation).trim() || DEFAULT_QUEUE_SETTINGS.rotation,
    firstTimeBoost: queueSettings?.firstTimeBoost !== false,
});

export const normalizeSelfServeAuctionWindow = (auctionWindow = {}) => {
    const slotCount = Math.max(1, Number(auctionWindow?.slotCount || DEFAULT_AUCTION_WINDOW.slotCount) || DEFAULT_AUCTION_WINDOW.slotCount);
    const priorityAssignments = Math.max(0, Number(auctionWindow?.priorityAssignments || 0) || 0);
    const remainingSlots = Math.max(0, Math.min(
        slotCount,
        Number(auctionWindow?.remainingSlots ?? (slotCount - priorityAssignments)) || 0
    ));
    return {
        scopeType: String(auctionWindow?.scopeType || DEFAULT_AUCTION_WINDOW.scopeType).trim().toLowerCase() || DEFAULT_AUCTION_WINDOW.scopeType,
        slotCount,
        remainingSlots,
        priorityAssignments,
        closed: auctionWindow?.closed === true || remainingSlots <= 0,
        closedAtMs: Math.max(0, Number(auctionWindow?.closedAtMs || 0) || 0),
        closeReason: String(auctionWindow?.closeReason || '').trim().toLowerCase(),
        lastAssignedSongId: String(auctionWindow?.lastAssignedSongId || '').trim(),
        lastAssignedAtMs: Math.max(0, Number(auctionWindow?.lastAssignedAtMs || 0) || 0),
    };
};

export const getSelfServeAuctionWindow = (selfServeMode = null) =>
    normalizeSelfServeAuctionWindow(selfServeMode?.auctionWindow || {});

export const isSelfServeAuctionWindowLive = (selfServeMode = null) => {
    if (selfServeMode?.enabled !== true) return false;
    if (normalizeSelfServeFormat(selfServeMode?.format || '') !== SELF_SERVE_FORMATS.spotlightAuction) return false;
    if (selfServeMode?.paidPriorityEnabled === false) return false;
    const windowState = getSelfServeAuctionWindow(selfServeMode);
    return windowState.closed !== true && windowState.remainingSlots > 0;
};

export const endSelfServeAuctionWindow = (selfServeMode = null, {
    nowMs = Date.now(),
    closeReason = 'manual_end',
    phase = 'fair_queue',
} = {}) => {
    const source = selfServeMode && typeof selfServeMode === 'object' ? selfServeMode : {};
    const windowState = getSelfServeAuctionWindow(source);
    return {
        ...source,
        paidPriorityEnabled: false,
        phase: String(phase || 'fair_queue').trim().toLowerCase() || 'fair_queue',
        auctionWindow: {
            ...windowState,
            remainingSlots: 0,
            closed: true,
            closedAtMs: Math.max(0, Number(nowMs || 0) || Date.now()),
            closeReason: String(closeReason || 'manual_end').trim().toLowerCase() || 'manual_end',
        },
    };
};

export const consumeSelfServeAuctionSlot = (selfServeMode = null, {
    songId = '',
    nowMs = Date.now(),
} = {}) => {
    const source = selfServeMode && typeof selfServeMode === 'object' ? selfServeMode : {};
    const windowState = getSelfServeAuctionWindow(source);
    if (!isSelfServeAuctionWindowLive(source)) {
        return {
            ...source,
            auctionWindow: windowState,
        };
    }
    const remainingSlots = Math.max(0, windowState.remainingSlots - 1);
    const nextWindow = {
        ...windowState,
        remainingSlots,
        priorityAssignments: windowState.priorityAssignments + 1,
        lastAssignedSongId: String(songId || '').trim(),
        lastAssignedAtMs: Math.max(0, Number(nowMs || 0) || Date.now()),
        closed: remainingSlots <= 0,
        closedAtMs: remainingSlots <= 0 ? Math.max(0, Number(nowMs || 0) || Date.now()) : 0,
        closeReason: remainingSlots <= 0 ? 'window_exhausted' : '',
    };
    return {
        ...source,
        paidPriorityEnabled: remainingSlots > 0 && source?.paidPriorityEnabled !== false,
        phase: remainingSlots > 0 ? 'auction_locked' : 'fair_queue',
        auctionWindow: nextWindow,
    };
};

const buildSelfServeRestoreState = (room = {}) => ({
    requestMode: String(room?.requestMode || REQUEST_MODES.canonicalOpen).trim() || REQUEST_MODES.canonicalOpen,
    allowSingerTrackSelect: room?.allowSingerTrackSelect === true,
    audienceBackingMode: String(room?.audienceBackingMode || '').trim(),
    unknownBackingPolicy: String(room?.unknownBackingPolicy || '').trim(),
    bouncerMode: room?.bouncerMode === true,
    queueSettings: normalizeQueueSettings(room?.queueSettings || {}),
});

const FORMAT_ROOM_DEFAULTS = Object.freeze({
    [SELF_SERVE_FORMATS.openStage]: Object.freeze({
        requestMode: REQUEST_MODES.guestBackingOptional,
        allowSingerTrackSelect: true,
        audienceBackingMode: AUDIENCE_BACKING_MODES.canonicalPlusAudienceYoutube,
        unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.autoQueueUnverified,
        bouncerMode: false,
        queueSettings: DEFAULT_QUEUE_SETTINGS,
    }),
    [SELF_SERVE_FORMATS.spotlightAuction]: Object.freeze({
        requestMode: REQUEST_MODES.guestBackingOptional,
        allowSingerTrackSelect: true,
        audienceBackingMode: AUDIENCE_BACKING_MODES.canonicalPlusAudienceYoutube,
        unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.autoQueueUnverified,
        bouncerMode: false,
        queueSettings: DEFAULT_QUEUE_SETTINGS,
    }),
    [SELF_SERVE_FORMATS.showcase]: Object.freeze({
        requestMode: REQUEST_MODES.playableOnly,
        allowSingerTrackSelect: false,
        audienceBackingMode: AUDIENCE_BACKING_MODES.canonicalPlusApprovedBackings,
        unknownBackingPolicy: UNKNOWN_BACKING_POLICIES.blockUnknown,
        bouncerMode: false,
        queueSettings: {
            limitMode: 'per_night',
            limitCount: 2,
            rotation: 'round_robin',
            firstTimeBoost: false,
        },
    }),
});

const FORMAT_DEFINITIONS = Object.freeze({
    [SELF_SERVE_FORMATS.openStage]: Object.freeze({
        id: SELF_SERVE_FORMATS.openStage,
        internalPreset: 'open_mic_self_serve',
        launchLabel: 'BeauRocks Open Stage',
        shortLabel: 'Open Stage',
        tagline: 'Fair self-serve karaoke with crowd-picked song moments.',
        supportsPaidPriority: false,
        supportsAuction: false,
        rulesSummary: Object.freeze([
            'Singers rotate fairly.',
            "The crowd can pick from a singer's ready songs.",
            'Money does not change who wins the night.',
        ]),
        recoveryActions: Object.freeze([
            'Preview Before Go Live',
            'Pause New Entries',
            'Return To Normal Karaoke',
        ]),
        fallbackSummary: 'If nobody votes, the room auto-resolves safely. If only one singer is ready, they auto-lock.',
    }),
    [SELF_SERVE_FORMATS.spotlightAuction]: Object.freeze({
        id: SELF_SERVE_FORMATS.spotlightAuction,
        internalPreset: 'fundraiser_auction',
        launchLabel: 'BeauRocks Support Surge',
        shortLabel: 'Support Surge',
        tagline: 'Verified donations unlock a premium opening showcase block.',
        supportsPaidPriority: true,
        supportsAuction: true,
        rulesSummary: Object.freeze([
            'Top verified donors claim the opening showcase slots.',
            'After the auction block, the room returns to fair queueing.',
            'The crowd may vote between top candidates when this option is enabled.',
        ]),
        recoveryActions: Object.freeze([
            'Preview Before Go Live',
            'Pause New Entries',
            'Disable Paid Priority',
            'End Sponsored Block',
            'Return To Normal Karaoke',
        ]),
        fallbackSummary: 'If payment verification is pending, the bidder sees that status. When the auction window ends, the room returns to fair queueing.',
    }),
    [SELF_SERVE_FORMATS.showcase]: Object.freeze({
        id: SELF_SERVE_FORMATS.showcase,
        internalPreset: 'ranked_showcase',
        launchLabel: 'BeauRocks Showcase',
        shortLabel: 'Showcase',
        tagline: 'Prestige performance rounds with clear competitive integrity.',
        supportsPaidPriority: false,
        supportsAuction: false,
        rulesSummary: Object.freeze([
            'Performers compete in structured rounds.',
            'Audience and judges decide winners based on the selected scoring model.',
            'Money does not affect advancement.',
        ]),
        recoveryActions: Object.freeze([
            'Preview Before Go Live',
            'Pause New Entries',
            'Return To Normal Karaoke',
        ]),
        fallbackSummary: 'If participation is low, the room should fall back to safe round handling instead of stalling.',
    }),
});

export const SELF_SERVE_PRIMARY_FORMAT_ORDER = Object.freeze([
    SELF_SERVE_FORMATS.openStage,
    SELF_SERVE_FORMATS.spotlightAuction,
    SELF_SERVE_FORMATS.showcase,
]);

export const SELF_SERVE_V1_FORMAT_ORDER = Object.freeze([
    SELF_SERVE_FORMATS.openStage,
    SELF_SERVE_FORMATS.spotlightAuction,
]);

export const normalizeSelfServeFormat = (value = '') => {
    const token = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_ -]/g, '').replace(/[\s-]+/g, '_');
    if (SELF_SERVE_FORMAT_ALIASES[token]) return SELF_SERVE_FORMAT_ALIASES[token];
    return SELF_SERVE_FORMAT_VALUES.has(token) ? token : SELF_SERVE_FORMATS.openStage;
};

export const getSelfServeFormatDefinition = (value = '') =>
    FORMAT_DEFINITIONS[normalizeSelfServeFormat(value)];

export const getSelfServeLaunchOptions = ({ includeAdvanced = false } = {}) =>
    (includeAdvanced ? SELF_SERVE_PRIMARY_FORMAT_ORDER : SELF_SERVE_V1_FORMAT_ORDER).map((id) => FORMAT_DEFINITIONS[id]);

export const buildSelfServeRulesCard = (value = '') => {
    const definition = getSelfServeFormatDefinition(value);
    return {
        id: definition.id,
        launchLabel: definition.launchLabel,
        shortLabel: definition.shortLabel,
        tagline: definition.tagline,
        rulesSummary: [...definition.rulesSummary],
        recoveryActions: [...definition.recoveryActions],
        fallbackSummary: definition.fallbackSummary,
        supportsPaidPriority: definition.supportsPaidPriority,
        supportsAuction: definition.supportsAuction,
    };
};

export const buildSelfServeModePresentation = (selfServeMode = null, {
    format: formatOverride = '',
} = {}) => {
    const definition = getSelfServeFormatDefinition(selfServeMode?.format || formatOverride || '');
    const supportsAuction = definition.supportsAuction === true;
    const auctionWindow = supportsAuction ? getSelfServeAuctionWindow(selfServeMode) : null;
    const auctionLive = supportsAuction && isSelfServeAuctionWindowLive(selfServeMode);
    const entriesPaused = selfServeMode?.pauseNewEntries === true;
    const paidPriorityEnabled = supportsAuction
        ? selfServeMode?.paidPriorityEnabled !== false
        : false;

    const toneKey = supportsAuction ? 'amber' : definition.id === SELF_SERVE_FORMATS.showcase ? 'fuchsia' : 'cyan';
    const baseState = {
        formatId: definition.id,
        launchLabel: definition.launchLabel,
        shortLabel: definition.shortLabel,
        tagline: definition.tagline,
        toneKey,
        supportsAuction,
        supportsPaidPriority: definition.supportsPaidPriority === true,
        auctionLive,
        auctionWindow,
        entriesPaused,
        paidPriorityEnabled,
    };

    if (supportsAuction && auctionLive) {
        const remainingSlots = Math.max(0, Number(auctionWindow?.remainingSlots || 0) || 0);
        const slotCount = Math.max(1, Number(auctionWindow?.slotCount || 0) || 1);
        return {
            ...baseState,
            stateKey: 'auction_live',
            badgeLabel: 'Surge Live',
            heroLabel: 'Bid, Join, Sing.',
            detail: 'Verified supporters are steering the opening showcase block.',
            helper: `${remainingSlots} of ${slotCount} priority slots still available.`,
            joinPrompt: 'Scan to join, bid, and vote',
            roomFlowLabel: 'Opening showcase block',
            hostSummary: 'Verified bids are live for the opening showcase block.',
            supportCtaLabel: 'Bid For The Next Showcase Slot',
        };
    }

    if (supportsAuction && auctionWindow?.closed) {
        return {
            ...baseState,
            stateKey: 'auction_complete',
            badgeLabel: entriesPaused ? 'Entries Paused' : 'Fair Queue Live',
            heroLabel: 'Scan In. Step Up. Sing.',
            detail: entriesPaused
                ? 'The sponsored block is complete and new singers are paused for the moment.'
                : 'The sponsored block is complete. New singers now join the fair queue.',
            helper: 'Support bidding is finished for this block.',
            joinPrompt: entriesPaused ? 'Scan to watch and vote' : 'Scan to join, sing, and vote',
            roomFlowLabel: entriesPaused ? 'Holding new singers' : 'Fair self-serve queue',
            hostSummary: entriesPaused
                ? 'The sponsored block is complete and new singers are paused.'
                : 'The sponsored block is complete. Fair queue is live now.',
            supportCtaLabel: 'Support This Room',
        };
    }

    if (supportsAuction && paidPriorityEnabled === false) {
        return {
            ...baseState,
            stateKey: 'auction_disabled',
            badgeLabel: entriesPaused ? 'Entries Paused' : 'Fair Queue Live',
            heroLabel: 'Scan In. Step Up. Sing.',
            detail: entriesPaused
                ? 'Paid priority is off and new singers are paused for the moment.'
                : 'Paid priority is off. The room is currently running on fair queueing.',
            helper: 'Support bidding is currently off.',
            joinPrompt: entriesPaused ? 'Scan to watch and vote' : 'Scan to join, sing, and vote',
            roomFlowLabel: entriesPaused ? 'Holding new singers' : 'Fair self-serve queue',
            hostSummary: entriesPaused
                ? 'Paid priority is off and new singers are paused.'
                : 'Paid priority is off. Fair queue is running now.',
            supportCtaLabel: 'Support This Room',
        };
    }

    if (entriesPaused) {
        return {
            ...baseState,
            stateKey: 'entries_paused',
            badgeLabel: 'Entries Paused',
            heroLabel: 'Stage Holding',
            detail: 'New singers are paused for the moment while the room clears the current ready queue.',
            helper: supportsAuction
                ? 'The room will reopen bidding and entries when the next block starts.'
                : 'Crowd picks can still lock the next spotlight from the ready queue.',
            joinPrompt: 'Scan to watch and vote',
            roomFlowLabel: 'Holding new singers',
            hostSummary: 'New singers are paused for the moment.',
            supportCtaLabel: supportsAuction ? 'Support This Room' : 'Support This Room',
        };
    }

    return {
        ...baseState,
        stateKey: 'stage_open',
        badgeLabel: 'Stage Open',
        heroLabel: 'Scan In. Step Up. Sing.',
        detail: supportsAuction
            ? 'The room is ready for singers and supporters to shape the next showcase slot.'
            : 'The room is ready for singers and crowd-picked spotlight moments.',
        helper: supportsAuction
            ? 'Verified supporters can still shape the next opening showcase slot.'
            : 'The crowd can lock the next spotlight while the current song is live.',
        joinPrompt: supportsAuction ? 'Scan to join, sing, and vote' : 'Scan to join, sing, and vote',
        roomFlowLabel: 'Fair self-serve queue',
        hostSummary: supportsAuction
            ? 'Support Surge is live and ready for the next supporters.'
            : 'Open Stage is live and ready for the next singer.',
        supportCtaLabel: supportsAuction ? 'Support This Room' : 'Support This Room',
    };
};

const findSelfServeSongById = (songs = [], songId = '') => {
    const safeSongId = String(songId || '').trim();
    if (!safeSongId) return null;
    return (Array.isArray(songs) ? songs : []).find((song) => String(song?.id || '').trim() === safeSongId) || null;
};

const getSelfServeSongArtworkUrl = (song = null) => String(
    song?.artworkUrl
    || song?.albumArtUrl
    || song?.imageUrl
    || song?.coverUrl
    || song?.artUrl
    || ''
).trim();

export const buildSelfServeTransitionMoment = (selfServeMode = null, {
    songs = [],
    nowMs = Date.now(),
    holdMs = 18000,
} = {}) => {
    if (!selfServeMode?.enabled) return null;
    const presentation = buildSelfServeModePresentation(selfServeMode);
    const safeNowMs = Math.max(0, Number(nowMs || 0) || Date.now());
    const safeHoldMs = Math.max(5000, Number(holdMs || 18000) || 18000);
    const auctionWindow = getSelfServeAuctionWindow(selfServeMode);
    const lastWinnerSongId = String(selfServeMode?.lastCrowdWinnerSongId || auctionWindow?.lastAssignedSongId || '').trim();
    const winnerSong = findSelfServeSongById(songs, lastWinnerSongId);
    const winnerTitle = String(
        winnerSong?.songTitle
        || winnerSong?.title
        || winnerSong?.name
        || ''
    ).trim();
    const winnerSingerName = String(
        winnerSong?.singerName
        || winnerSong?.name
        || ''
    ).trim();
    const winnerArtworkUrl = getSelfServeSongArtworkUrl(winnerSong);

    if (String(selfServeMode?.phase || '').trim().toLowerCase() === 'winner_locked') {
        const resolvedAtMs = Math.max(0, Number(selfServeMode?.lastCrowdVoteResolvedAtMs || 0) || 0);
        if (resolvedAtMs > 0 && (safeNowMs - resolvedAtMs) <= safeHoldMs) {
            return {
                toneKey: presentation.toneKey,
                badgeLabel: 'Crowd Pick Locked',
                title: 'Next spotlight locked',
                detail: winnerTitle
                    ? `${winnerTitle} is on deck now.`
                    : 'The next spotlight is locked and ready to roll.',
                songId: lastWinnerSongId,
                songTitle: winnerTitle,
                singerName: winnerSingerName,
                artworkUrl: winnerArtworkUrl,
            };
        }
    }

    if (String(selfServeMode?.phase || '').trim().toLowerCase() === 'auction_locked') {
        const resolvedAtMs = Math.max(
            0,
            Number(selfServeMode?.lastCrowdVoteResolvedAtMs || 0) || 0,
            Number(auctionWindow?.lastAssignedAtMs || 0) || 0
        );
        if (resolvedAtMs > 0 && (safeNowMs - resolvedAtMs) <= safeHoldMs) {
            return {
                toneKey: 'amber',
                badgeLabel: 'Showcase Locked',
                title: 'Next showcase locked',
                detail: winnerTitle
                    ? `${winnerTitle} just won the next showcase slot.`
                    : 'Verified supporters just locked the next showcase slot.',
                songId: lastWinnerSongId,
                songTitle: winnerTitle,
                singerName: winnerSingerName,
                artworkUrl: winnerArtworkUrl,
            };
        }
    }

    if (String(selfServeMode?.phase || '').trim().toLowerCase() === 'fair_queue' && auctionWindow?.closed) {
        const closedAtMs = Math.max(
            0,
            Number(auctionWindow?.closedAtMs || 0) || 0,
            Number(selfServeMode?.lastCrowdVoteResolvedAtMs || 0) || 0
        );
        if (closedAtMs > 0 && (safeNowMs - closedAtMs) <= safeHoldMs) {
            return {
                toneKey: 'amber',
                badgeLabel: 'Fair Queue Live',
                title: 'Opening block complete',
                detail: winnerTitle
                    ? `${winnerTitle} closes the sponsored block. Fair queue takes over now.`
                    : 'The sponsored block is complete. Fair queue takes over now.',
                songId: lastWinnerSongId,
                songTitle: winnerTitle,
                singerName: winnerSingerName,
                artworkUrl: winnerArtworkUrl,
            };
        }
    }

    return null;
};

export const buildSelfServeDecisionPresentation = (releaseWindow = null, {
    timeLeftSec = 0,
    totalVotes = 0,
} = {}) => {
    const origin = String(releaseWindow?.origin || '').trim().toLowerCase();
    const safeTimeLeftSec = Math.max(0, Number(timeLeftSec || 0) || 0);
    const safeTotalVotes = Math.max(0, Number(totalVotes || 0) || 0);

    if (origin === 'self_serve_spotlight_auction_auto') {
        return {
            eyebrow: 'BeauRocks Support Surge',
            badgeLabel: 'Showcase Vote',
            helper: safeTimeLeftSec > 0
                ? `Top supporters are choosing live. Winner locks when the clock hits zero in ${safeTimeLeftSec}s.`
                : 'Top supporters are choosing live. Winner locks as soon as the vote closes.',
            liveLabel: 'Priority showcase vote',
            tallyLabel: `${safeTotalVotes} vote${safeTotalVotes === 1 ? '' : 's'} live`,
            decisionLabel: 'Pick the next showcase',
        };
    }

    if (origin === 'self_serve_open_stage_auto') {
        return {
            eyebrow: 'BeauRocks Open Stage Crowd Pick',
            badgeLabel: 'Spotlight Vote',
            helper: safeTimeLeftSec > 0
                ? `Phones are deciding live. Winner auto-locks in ${safeTimeLeftSec}s before this song ends.`
                : 'Phones are deciding live. Winner auto-locks as soon as the vote closes.',
            liveLabel: 'Crowd spotlight vote',
            tallyLabel: `${safeTotalVotes} vote${safeTotalVotes === 1 ? '' : 's'} live`,
            decisionLabel: 'Pick the next spotlight',
        };
    }

    return null;
};

export const buildSelfServeModeState = (value = '', overrides = {}) => {
    const definition = getSelfServeFormatDefinition(value);
    const source = overrides && typeof overrides === 'object' ? overrides : {};
    const enabled = source.enabled !== false;
    const phase = String(source.phase || (enabled ? 'live' : 'idle')).trim().toLowerCase() || 'live';
    const pauseNewEntries = source.pauseNewEntries === true;
    const paidPriorityEnabled = definition.supportsPaidPriority
        ? source.paidPriorityEnabled !== false
        : false;
    const modeState = {
        enabled,
        format: definition.id,
        internalPreset: definition.internalPreset,
        launchLabel: definition.launchLabel,
        shortLabel: definition.shortLabel,
        phase,
        preview: source.preview === true,
        canReturnToNormal: source.canReturnToNormal !== false,
        pauseNewEntries,
        paidPriorityEnabled,
        startedAtMs: Math.max(0, Number(source.startedAtMs || 0) || 0),
    };
    if (definition.supportsAuction) {
        modeState.auctionWindow = normalizeSelfServeAuctionWindow(source.auctionWindow || {});
    }
    if (source.restoreState && typeof source.restoreState === 'object') {
        modeState.restoreState = buildSelfServeRestoreState(source.restoreState);
    }
    return modeState;
};

export const buildSelfServeActivationPatch = (value = '', room = {}, overrides = {}) => {
    const definition = getSelfServeFormatDefinition(value);
    const defaults = FORMAT_ROOM_DEFAULTS[definition.id] || FORMAT_ROOM_DEFAULTS[SELF_SERVE_FORMATS.openStage];
    const startedAtMs = Math.max(0, Number(overrides?.startedAtMs || Date.now()) || Date.now());
    return {
        activeMode: 'karaoke',
        tvPreviewOverlay: null,
        requestMode: defaults.requestMode,
        allowSingerTrackSelect: defaults.allowSingerTrackSelect === true,
        audienceBackingMode: defaults.audienceBackingMode,
        unknownBackingPolicy: defaults.unknownBackingPolicy,
        bouncerMode: defaults.bouncerMode === true,
        queueSettings: normalizeQueueSettings(defaults.queueSettings),
        selfServeMode: buildSelfServeModeState(definition.id, {
            enabled: true,
            phase: 'live',
            startedAtMs,
            pauseNewEntries: overrides?.pauseNewEntries === true,
            paidPriorityEnabled: overrides?.paidPriorityEnabled,
            auctionWindow: overrides?.auctionWindow,
            restoreState: buildSelfServeRestoreState(room),
        }),
    };
};

export const buildSelfServeReturnPatch = (room = {}) => {
    const restoreState = room?.selfServeMode?.restoreState && typeof room.selfServeMode.restoreState === 'object'
        ? buildSelfServeRestoreState(room.selfServeMode.restoreState)
        : null;
    const patch = {
        activeMode: 'karaoke',
        tvPreviewOverlay: null,
        selfServeMode: null,
    };
    if (!restoreState) return patch;
    patch.requestMode = restoreState.requestMode;
    patch.allowSingerTrackSelect = restoreState.allowSingerTrackSelect === true;
    patch.audienceBackingMode = restoreState.audienceBackingMode || '';
    patch.unknownBackingPolicy = restoreState.unknownBackingPolicy || '';
    patch.bouncerMode = restoreState.bouncerMode === true;
    patch.queueSettings = normalizeQueueSettings(restoreState.queueSettings);
    return patch;
};

export const buildSelfServeTvPreviewOverlay = (value = '', {
    durationSec = 10,
    startedAtMs = Date.now(),
} = {}) => {
    const definition = getSelfServeFormatDefinition(value);
    const safeStartedAtMs = Math.max(1, Number(startedAtMs || 0) || Date.now());
    const safeDurationSec = Math.max(6, Math.min(20, Number(durationSec || 10) || 10));
    const accentTheme = definition.id === SELF_SERVE_FORMATS.spotlightAuction
        ? 'amber'
        : definition.id === SELF_SERVE_FORMATS.showcase
            ? 'fuchsia'
            : 'cyan';
    return {
        active: true,
        itemId: `self_serve_${definition.id}_${safeStartedAtMs}`,
        type: 'announcement',
        takeoverScene: 'announcement',
        accentTheme,
        headline: definition.launchLabel,
        subhead: definition.tagline,
        summary: definition.fallbackSummary,
        modeKey: `self_serve_${definition.id}`,
        options: [...definition.rulesSummary].slice(0, 4),
        durationSec: safeDurationSec,
        startedAtMs: safeStartedAtMs,
    };
};

const buildSelfServeQueueFaceOffSongLabel = (song = {}) =>
    String(song?.songTitle || song?.title || '').trim() || 'Song';

const buildSelfServeQueueFaceOffSongDetail = (song = {}) =>
    String(song?.singerName || song?.artist || '').trim() || 'Queued pick';

const getSelfServeQueueFaceOffSongArtist = (song = {}) =>
    String(song?.artist || song?.artistName || '').trim();

const getSelfServeQueueFaceOffSongArtworkUrl = (song = {}) =>
    String(song?.albumArtUrl || song?.artworkUrl100 || song?.artworkUrl || song?.imageUrl || song?.coverUrl || song?.artUrl || '').trim();

const getSelfServeQueueFaceOffDurationSec = (song = {}) => {
    const candidates = [
        song?.performanceStartedDurationSec,
        song?.backingPlan?.durationSec,
        song?.selectedBacking?.durationSec,
        song?.approvedBacking?.durationSec,
        song?.approvedBrowseBacking?.durationSec,
        song?.mediaDurationSec,
        song?.backingDurationSec,
        song?.trackDurationSec,
        song?.durationSec,
        song?.duration,
    ];
    for (const candidate of candidates) {
        const durationSec = Math.max(0, Math.round(Number(candidate || 0) || 0));
        if (durationSec > 0) return durationSec;
    }
    return 0;
};

const formatSelfServeQueueFaceOffDuration = (song = {}) => {
    const durationSec = getSelfServeQueueFaceOffDurationSec(song);
    if (!durationSec) return '';
    const mins = Math.floor(durationSec / 60);
    const secs = String(durationSec % 60).padStart(2, '0');
    return `${mins}:${secs}`;
};

export const buildSelfServeQueueFaceOffWindow = ({
    firstSong = null,
    secondSong = null,
    openedAtMs = Date.now(),
    durationSec = 18,
} = {}) => {
    const firstSongId = String(firstSong?.id || '').trim();
    const secondSongId = String(secondSong?.id || '').trim();
    if (!firstSongId || !secondSongId || firstSongId === secondSongId) return null;
    const safeOpenedAtMs = Math.max(1, Number(openedAtMs || 0) || Date.now());
    const safeDurationSec = Math.max(10, Math.min(30, Number(durationSec || 18) || 18));
    return {
        active: true,
        itemId: `self_serve_queue_faceoff:${firstSongId}:${secondSongId}:${safeOpenedAtMs}`,
        itemTitle: 'BeauRocks Open Stage Crowd Pick',
        subjectType: 'queue_faceoff',
        governanceMode: 'crowd_vote',
        releasePolicy: 'auto_flight_winner',
        origin: 'self_serve_open_stage_auto',
        selfServeFormat: SELF_SERVE_FORMATS.openStage,
        prompt: 'Crowd pick the next spotlight.',
        promptDetail: 'Phones vote while the current song is still live.',
        openedAtMs: safeOpenedAtMs,
        closesAtMs: safeOpenedAtMs + (safeDurationSec * 1000),
        choiceLabels: {
            slot_scene: buildSelfServeQueueFaceOffSongLabel(firstSong),
            keep_queue_moving: buildSelfServeQueueFaceOffSongLabel(secondSong),
        },
        choiceDetails: {
            slot_scene: buildSelfServeQueueFaceOffSongDetail(firstSong),
            keep_queue_moving: buildSelfServeQueueFaceOffSongDetail(secondSong),
        },
        choiceSublines: {
            slot_scene: [getSelfServeQueueFaceOffSongArtist(firstSong), formatSelfServeQueueFaceOffDuration(firstSong)].filter(Boolean).join(' - '),
            keep_queue_moving: [getSelfServeQueueFaceOffSongArtist(secondSong), formatSelfServeQueueFaceOffDuration(secondSong)].filter(Boolean).join(' - '),
        },
        choiceArtworkUrls: {
            slot_scene: getSelfServeQueueFaceOffSongArtworkUrl(firstSong),
            keep_queue_moving: getSelfServeQueueFaceOffSongArtworkUrl(secondSong),
        },
        choiceMetadata: {
            slot_scene: { durationLabel: formatSelfServeQueueFaceOffDuration(firstSong), artist: getSelfServeQueueFaceOffSongArtist(firstSong), singerName: buildSelfServeQueueFaceOffSongDetail(firstSong) },
            keep_queue_moving: { durationLabel: formatSelfServeQueueFaceOffDuration(secondSong), artist: getSelfServeQueueFaceOffSongArtist(secondSong), singerName: buildSelfServeQueueFaceOffSongDetail(secondSong) },
        },
        choiceSongIds: {
            slot_scene: firstSongId,
            keep_queue_moving: secondSongId,
        },
        votesByUid: {},
        resultChoice: '',
        resolvedAtMs: 0,
    };
};
