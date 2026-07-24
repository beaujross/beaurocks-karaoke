import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ASSETS } from '../../../lib/assets';
import { REQUEST_MODES } from '../../../lib/requestModes';
import {
    AUDIENCE_JOIN_ACCESS_MODES,
    AUDIENCE_JOIN_ACCESS_OPTIONS,
    normalizeAudienceJoinPolicy,
} from '../../../lib/audienceJoinPolicy.js';
import { buildHostNightPresetConfig } from '../hostNightPresets';
import { resolveRoomSetupEffectiveBehavior } from '../roomSetupEffectiveBehavior';
import { applyEventCreditsPreset } from '../hostLaunchHelpers';
import { getRoomEconomySummary } from '../../../lib/roomEconomySummary';
import RoomJoinPosterModal from './RoomJoinPosterModal';
import { AAHF_FESTIVAL_LOGO_URL } from '../hostAppData';
import {
    HOST_LAUNCH_EXPERIENCE_DRAFT_KEY,
    buildHostLaunchDraftKey,
    clearHostLaunchDraftPart,
    hasRecoverableHostLaunchDraft,
    loadHostLaunchDraftPart,
    persistHostLaunchDraftPart,
} from '../hostLaunchDraftStorage';

const inputClass = 'mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/45';
const launchInputClass = 'mt-2 min-h-[50px] w-full rounded-[0.95rem] border border-white/10 bg-slate-950/60 px-4 py-3 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] outline-none transition placeholder:text-cyan-100/28 hover:border-cyan-300/20 focus:border-cyan-300/55 focus:bg-slate-950/78 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]';
const REQUEST_POLICY_OPTIONS = [
    { id: REQUEST_MODES.canonicalOpen, label: 'Host Review First' },
    { id: REQUEST_MODES.guestBackingOptional, label: 'Guest Picks Backing' },
    { id: REQUEST_MODES.playableOnly, label: 'Playable Library Only' },
];
const QUEUE_ROTATION_OPTIONS = [
    { id: 'round_robin', label: 'Round Robin' },
    { id: 'fifo', label: 'First In / First Out' },
    { id: 'weighted_first_time', label: 'Weighted First-Time' },
];
const ROOM_BROWSER_SORT_OPTIONS = Object.freeze([
    { id: 'newest', label: 'Newest Rooms First' },
    { id: 'recent', label: 'Recently Active' },
    { id: 'upcoming', label: 'Upcoming First' },
    { id: 'name', label: 'Room Name' },
]);
const ROOM_SETUP_TABS = Object.freeze([
    {
        id: 'manage',
        label: 'Existing Rooms',
        icon: 'fa-rectangle-history-circle-plus',
        helper: 'Reopen, pin, archive, or clean up rooms you already created.',
        activeToneClass: 'border-cyan-300/30 bg-[linear-gradient(180deg,rgba(13,35,46,0.98),rgba(8,18,28,0.98))] text-cyan-100 shadow-[0_-10px_30px_rgba(6,182,212,0.14)]',
        badgeToneClass: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
    },
    {
        id: 'create',
        label: 'Create Room',
        icon: 'fa-sparkles',
        helper: 'Name it, choose access, and start.',
        activeToneClass: 'border-fuchsia-300/30 bg-[linear-gradient(180deg,rgba(43,16,39,0.98),rgba(23,10,24,0.98))] text-fuchsia-100 shadow-[0_-10px_30px_rgba(217,70,239,0.14)]',
        badgeToneClass: 'border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100',
    },
]);
const LAUNCH_MEDIA_SOURCE_OPTIONS = Object.freeze([
    { id: 'local', label: 'Local Library', icon: 'fa-hard-drive', helper: 'Host uploads and local room media.' },
    { id: 'youtube', label: 'YouTube', icon: 'fa-brands fa-youtube', helper: 'Search embeddable karaoke videos.' },
    { id: 'itunes', label: 'Apple Music', icon: 'fa-brands fa-apple', helper: 'Match songs now; connect playback after creation.' },
    { id: 'spotify', label: 'Spotify', icon: 'fa-brands fa-spotify', helper: 'Planned source — not available yet.', disabled: true },
]);
const normalizeLaunchMediaSources = (value = {}) => ({
    local: value?.local !== false,
    youtube: value?.youtube !== false,
    itunes: value?.itunes !== false,
});
const getLaunchMediaSourceLabels = (sources = {}) => LAUNCH_MEDIA_SOURCE_OPTIONS
    .filter((option) => !option.disabled && sources?.[option.id] !== false)
    .map((option) => option.label);

const LAUNCH_ECONOMY_OPTIONS = Object.freeze([
    {
        id: 'standard',
        label: 'Just for Fun',
        eyebrow: 'Playful',
        summary: 'Participation points are plentiful, non-cash, and earned through games, reactions, and host rewards.',
    },
    {
        id: 'beaubucks',
        label: 'Points + BeauBucks',
        eyebrow: 'Premium',
        summary: 'Keep live play on Points and open permanent BeauBucks cosmetics for signed-in guests.',
    },
    {
        id: 'event',
        label: 'Ticket Value',
        eyebrow: 'Ticketed',
        summary: 'Turn admission into a clear Points grant for participation during this event.',
    },
    {
        id: 'fundraiser',
        label: 'Fundraiser',
        eyebrow: 'Support',
        summary: 'Keep support actions clear and separate from Points and BeauBucks cosmetics.',
    },
    {
        id: 'custom',
        label: 'Custom Rules',
        eyebrow: 'Flexible',
        summary: 'Tune grants, refills, bonuses, and support behavior manually in Advanced Setup.',
    },
]);
const LAUNCH_OPERATING_MODEL_OPTIONS = Object.freeze([
    {
        id: 'host_led',
        label: 'Host-Led',
        eyebrow: 'Classic',
        summary: 'You control the queue, pacing, and every handoff.',
        details: ['Full songs', 'Host runs pacing', 'No crowd continuation votes'],
        icon: 'fa-headset',
    },
    {
        id: 'assisted_host',
        label: 'Assisted Host',
        eyebrow: 'Assisted',
        summary: 'BeauRocks keeps things moving while you can step in anytime.',
        details: ['Full songs', 'Auto-DJ assist', 'Host can step in anytime'],
        icon: 'fa-wand-magic-sparkles',
    },
    {
        id: 'crowd_driven',
        label: 'Crowd-Driven',
        eyebrow: 'Self-service',
        summary: 'The crowd drives a faster self-service room with Auto-DJ.',
        details: ['One-Minute Mic', 'Crowd continuation votes', 'Auto-DJ on'],
        icon: 'fa-people-group',
    },
]);
const LAUNCH_NIGHT_TYPE_OPTIONS = Object.freeze([
    {
        id: 'party_karaoke',
        label: 'Party Karaoke',
        eyebrow: 'Easygoing',
        summary: 'Open song search, a relaxed queue, and help filling quiet moments.',
        presetId: 'casual',
        operatingModel: 'assisted_host',
        economyMode: 'standard',
        flowRule: 'balanced',
        assistLevel: 'smart_assist',
        spotlightMode: 'karaoke',
        party: { autoCrowdMomentsEnabled: false },
        icon: 'fa-microphone-lines',
        effects: ['Balanced turns', 'Scoring off', 'Auto-DJ assist'],
    },
    {
        id: 'crowd_singalong',
        label: 'Crowd Sing-Along',
        eyebrow: 'Lyrics first',
        summary: 'Apple Music and generated lyrics for full-song group energy.',
        presetId: 'competition',
        operatingModel: 'assisted_host',
        economyMode: 'standard',
        flowRule: 'balanced',
        assistLevel: 'smart_assist',
        spotlightMode: 'karaoke',
        party: { autoCrowdMomentsEnabled: false },
        icon: 'fa-people-group',
        settingsOverrides: { showScoring: false },
        effects: ['Apple Music', 'Lyrics on TV', 'Full songs'],
    },
    {
        id: 'score_challenge',
        label: 'Score Challenge',
        eyebrow: 'Competitive',
        summary: 'Fair turns, visible scoring, and tighter host control.',
        presetId: 'competition',
        operatingModel: 'host_led',
        economyMode: 'standard',
        flowRule: 'fair_turns',
        assistLevel: 'manual_first',
        spotlightMode: 'karaoke',
        party: { autoCrowdMomentsEnabled: false },
        icon: 'fa-trophy',
        settingsOverrides: { showScoring: true },
        effects: ['Fair-turn cap', 'Scoring on', 'Fame on'],
    },
    {
        id: 'karaoke_trivia',
        label: 'Karaoke + Trivia',
        eyebrow: 'Variety',
        summary: 'A karaoke-first party with short trivia breaks ready to add.',
        presetId: 'casual',
        operatingModel: 'assisted_host',
        economyMode: 'standard',
        flowRule: 'balanced',
        assistLevel: 'smart_assist',
        spotlightMode: 'karaoke',
        party: {
            autoCrowdMomentsEnabled: true,
            autoCrowdMomentEverySongs: 3,
            autoCrowdMomentPreferredTypes: ['trivia', 'would_you_rather'],
        },
        icon: 'fa-lightbulb',
        settingsOverrides: { popTriviaEnabled: true },
        effects: ['Balanced turns', 'Trivia ready', 'Auto-DJ assist'],
    },
]);

const getOptionLabel = (options = [], id = '', fallback = 'Default') => (
    options.find((option) => option.id === id)?.label || fallback
);

const buildLaunchOperatingModelSettings = (modelId = 'host_led') => {
    const safeModel = ['host_led', 'assisted_host', 'crowd_driven'].includes(String(modelId || '').trim().toLowerCase())
        ? String(modelId || '').trim().toLowerCase()
        : 'host_led';
    const oneMinuteMicEnabled = safeModel === 'crowd_driven';
    return {
        autoDj: safeModel !== 'host_led',
        oneMinuteMicEnabled,
        performanceProgressionMode: oneMinuteMicEnabled ? 'one_minute_mic' : 'full_song',
        oneMinuteMicOpeningWindowSec: 60,
        oneMinuteMicVoteWindowSec: 12,
    };
};

const formatPresetQueueSummary = (queueSettings = {}) => {
    const limitMode = String(queueSettings?.limitMode || 'none');
    const rotation = String(queueSettings?.rotation || 'round_robin');
    const limitCount = Math.max(0, Number(queueSettings?.limitCount || 0));
    const limit = limitMode === 'none'
        ? 'Open queue'
        : `${limitCount || 'Set'} ${limitMode === 'per_rotation' ? 'per rotation' : 'per night'}`;
    const rotationLabel = getOptionLabel(QUEUE_ROTATION_OPTIONS, rotation, 'Round Robin');
    return `${limit}; ${rotationLabel.toLowerCase()}`;
};

const formatPresetSearchSummary = (searchSources = {}, settings = {}) => {
    const enabled = Object.entries(searchSources || {})
        .filter(([, value]) => value === true)
        .map(([key]) => key === 'itunes' ? 'Apple/iTunes' : key === 'youtube' ? 'YouTube' : 'Library');
    const sourceLabel = enabled.length ? enabled.join(', ') : 'Curated library only';
    return `${sourceLabel}${settings?.hideNonEmbeddableYouTube !== false ? '; embeddable-safe' : ''}`;
};

const buildPresetImpactRows = (preset = {}, joinAccessMode = AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed) => {
    const settings = preset?.settings || {};
    const requestMode = String(settings.requestMode || REQUEST_MODES.canonicalOpen);
    const requestLabel = getOptionLabel(REQUEST_POLICY_OPTIONS, requestMode, 'Host Review First');
    const joinLabel = getOptionLabel(AUDIENCE_JOIN_ACCESS_OPTIONS, joinAccessMode, 'Open join');
    const tvBits = [
        settings.showScoring !== false ? 'Score on' : 'Score off',
        settings.chatShowOnTv ? 'TV chat' : 'Chat off TV',
        settings.marqueeEnabled ? 'Marquee on' : 'Marquee off',
    ];
    const automationBits = [
        settings.autoDj ? 'Auto-DJ' : 'Manual DJ',
        settings.autoPlayMedia !== false ? 'Auto playback' : 'Manual playback',
        settings.autoEndOnTrackFinish !== false ? 'auto-end safe' : 'manual end',
    ];
    return [
        { label: 'Requests', value: `${requestLabel}${settings.bouncerMode ? '; host approval' : ''}` },
        { label: 'Queue', value: formatPresetQueueSummary(settings.queueSettings || {}) },
        { label: 'Search', value: formatPresetSearchSummary(preset.searchSources || {}, settings) },
        { label: 'TV & Crowd', value: tvBits.join('; ') },
        { label: 'Automation', value: automationBits.join('; ') },
        { label: 'Audience', value: `${joinLabel}; ${String(settings.audienceShellVariant || 'streamlined') === 'classic' ? 'standard app' : 'streamlined app'}` },
    ];
};

const HostRoomLaunchPadBrowser = ({
    STYLES,
    launchState,
    launchStateTone,
    launchAccessPending,
    launchDraftOwnerKey,
    roomCodeInput,
    setRoomCodeInput,
    hasLaunchRoomCode,
    launchRoomCodeCandidate,
    hasRequestedLaunchRoomCode,
    requestedLaunchRoomCodeCandidate,
    openExistingRoomWorkspace,
    joiningRoom,
    activeRoomBucket,
    roomBrowserBuckets,
    setRoomBrowserFilter,
    roomBrowserSort,
    setRoomBrowserSort,
    setSelectedRoomCode,
    roomBrowserSearch,
    setRoomBrowserSearch,
    roomBrowserResults,
    recentHostRoomsLoading,
    getRoomLifecycle,
    getRoomVisibilityMeta,
    formatRoomSchedule,
    formatRecentRoomTime,
    isAahfRoom,
    selectedRoom,
    selectedRoomLifecycle,
    selectedRoomVisibility,
    selectedRoomAction,
    selectedRoomCleanupMeta,
    runFeaturedAction,
    roomManagerBusyCode,
    roomManagerBusyAction,
    pinnedRoomCodeSet,
    togglePinnedRoom,
    setRoomArchivedState,
    setRoomDiscoverability,
    setRoomOccurrenceStatus,
    runLandingRoomCleanup,
    resetRoomToCurrentTemplate,
    seedAahfKickoffRoom,
    runLandingRoomPermanentDelete,
    canPermanentlyDeleteRooms,
    audienceBase,
    shouldShowSetupCard,
    openOnboardingWizard,
    canUseWorkspaceOnboarding,
    launchDisabled,
    launchRoomName,
    setLaunchRoomName,
    launchRequestedRoomCode,
    setLaunchRequestedRoomCode,
    quickLaunchDiscovery,
    setQuickLaunchDiscovery,
    setDiscoveryListingMode,
    discoveryListingEnabled,
    presets,
    resolvedLaunchPresetId,
    setHostNightPreset,
    selectedLaunchPreset,
    selectedPresetMeta,
    launchStartSummary,
    eventCreditsConfig,
    setEventCreditsConfig,
    handleStartLauncherRoom,
    PRESET_UI_META,
    creatingRoom,
    entryError,
    retryLastHostAction,
    hostUpdateDeploymentBanner,
}) => {
    const launchExperienceDraftKey = buildHostLaunchDraftKey(
        HOST_LAUNCH_EXPERIENCE_DRAFT_KEY,
        launchDraftOwnerKey,
    );
    const [recoveredExperienceDraft] = useState(() => {
        const recovered = loadHostLaunchDraftPart(
            launchExperienceDraftKey,
            {},
        );
        return recovered.restored ? recovered.value : {};
    });
    const [launchDraftRecovered] = useState(() => hasRecoverableHostLaunchDraft({
        ownerKey: launchDraftOwnerKey,
    }));
    const [joinPosterRoom, setJoinPosterRoom] = useState(null);
    const [roomSetupMode, setRoomSetupMode] = useState('manage');
    const roomBrowserResultsRef = useRef(null);
    const selectedPresetBaseId = selectedLaunchPreset?.basePresetId || selectedLaunchPreset?.id || 'casual';
    const selectedPresetJoinPolicy = normalizeAudienceJoinPolicy(selectedLaunchPreset?.settings?.audienceJoinPolicy || {});
    const recoveredJoinAccessMode = AUDIENCE_JOIN_ACCESS_OPTIONS.some(
        (option) => option.id === recoveredExperienceDraft?.joinAccessMode,
    ) ? recoveredExperienceDraft.joinAccessMode : '';
    const [launchJoinAccessMode, setLaunchJoinAccessMode] = useState(
        recoveredJoinAccessMode
        || selectedPresetJoinPolicy.accessMode
        || AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed,
    );
    const [launchJoinPasscode, setLaunchJoinPasscode] = useState('');
    const normalizedLaunchJoinPasscode = String(launchJoinPasscode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
    const launchNeedsPasscode = launchJoinAccessMode === AUDIENCE_JOIN_ACCESS_MODES.passcodeRequired;
    const launchPasscodeValid = !launchNeedsPasscode || normalizedLaunchJoinPasscode.length >= 4;
    const roomLaunchDisabled = launchDisabled || !launchPasscodeValid;
    const selectedPresetImpactRows = useMemo(
        () => buildPresetImpactRows(selectedLaunchPreset || {}, launchJoinAccessMode),
        [launchJoinAccessMode, selectedLaunchPreset]
    );
    const selectedPresetUi = PRESET_UI_META?.[selectedPresetBaseId] || PRESET_UI_META?.[selectedLaunchPreset?.id] || null;
    const hasLaunchStartTime = !!String(quickLaunchDiscovery?.roomStartsAtLocal || '').trim();
    const launchRoomSummaryName = String(launchRoomName || '').trim() || 'Untitled room';
    const eventCreditsEventId = String(eventCreditsConfig?.eventId || '').trim().toLowerCase();
    const eventCreditsPresetId = String(eventCreditsConfig?.presetId || '').trim();
    const eventCreditsEnabled = eventCreditsConfig?.enabled === true;
    const eventCreditsHasSupport = Boolean(String(eventCreditsConfig?.supportLabel || eventCreditsConfig?.supportProvider || eventCreditsConfig?.supportUrl || '').trim())
        || Number(eventCreditsConfig?.supportPoints || 0) > 0
        || (Array.isArray(eventCreditsConfig?.supportOffers) && eventCreditsConfig.supportOffers.length > 0);
    const launchEconomyMode = !eventCreditsEnabled
        ? 'standard'
        : eventCreditsHasSupport
            ? 'fundraiser'
            : eventCreditsPresetId === 'ticketed_event'
                ? 'event'
                : eventCreditsEventId === 'beaubucks'
                    ? 'beaubucks'
                    : 'custom';
    const selectedEconomyOption = LAUNCH_ECONOMY_OPTIONS.find((option) => option.id === launchEconomyMode) || LAUNCH_ECONOMY_OPTIONS[0];
    const launchEconomySummary = getRoomEconomySummary(eventCreditsConfig);
    const selectedJoinOption = AUDIENCE_JOIN_ACCESS_OPTIONS.find((option) => option.id === launchJoinAccessMode) || AUDIENCE_JOIN_ACCESS_OPTIONS[0];
    const recoveredOperatingModel = LAUNCH_OPERATING_MODEL_OPTIONS.some(
        (option) => option.id === recoveredExperienceDraft?.operatingModel,
    ) ? recoveredExperienceDraft.operatingModel : 'assisted_host';
    const recoveredNightType = LAUNCH_NIGHT_TYPE_OPTIONS.some(
        (option) => option.id === recoveredExperienceDraft?.nightType,
    ) ? recoveredExperienceDraft.nightType : 'party_karaoke';
    const [launchOperatingModel, setLaunchOperatingModel] = useState(recoveredOperatingModel);
    const [launchNightType, setLaunchNightType] = useState(recoveredNightType);
    const [launchMediaSources, setLaunchMediaSources] = useState(() => normalizeLaunchMediaSources(
        recoveredExperienceDraft?.mediaSources
        || selectedLaunchPreset?.searchSources
    ));
    const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
    useEffect(() => {
        const experienceIsDefault = launchJoinAccessMode === AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed
            && launchOperatingModel === 'assisted_host'
            && launchNightType === 'party_karaoke'
            && launchMediaSources.local
            && launchMediaSources.youtube
            && launchMediaSources.itunes;
        if (experienceIsDefault) {
            clearHostLaunchDraftPart(launchExperienceDraftKey);
            return;
        }
        persistHostLaunchDraftPart(launchExperienceDraftKey, {
            joinAccessMode: launchJoinAccessMode,
            operatingModel: launchOperatingModel,
            nightType: launchNightType,
            mediaSources: launchMediaSources,
        });
    }, [launchExperienceDraftKey, launchJoinAccessMode, launchMediaSources, launchNightType, launchOperatingModel]);
    const toggleLaunchMediaSource = (sourceId = '') => {
        if (!['local', 'youtube', 'itunes'].includes(sourceId)) return;
        setLaunchMediaSources((current) => {
            const next = normalizeLaunchMediaSources({
                ...current,
                [sourceId]: current?.[sourceId] === false,
            });
            if (!next.local && !next.youtube && !next.itunes) return current;
            return next;
        });
    };
    const selectedOperatingModelOption = LAUNCH_OPERATING_MODEL_OPTIONS.find((option) => option.id === launchOperatingModel) || LAUNCH_OPERATING_MODEL_OPTIONS[0];
    const selectedNightType = LAUNCH_NIGHT_TYPE_OPTIONS.find((option) => option.id === launchNightType) || LAUNCH_NIGHT_TYPE_OPTIONS[0];
    const buildLaunchPresetPayload = () => buildHostNightPresetConfig({
        ...(selectedLaunchPreset || {}),
        searchSources: launchMediaSources,
        recipe: {
            flowRule: selectedNightType?.flowRule || 'balanced',
            assistLevel: selectedNightType?.assistLevel || 'smart_assist',
            spotlightMode: selectedNightType?.spotlightMode || 'karaoke',
            overrides: { ...(selectedNightType?.settingsOverrides || {}) },
            party: { ...(selectedNightType?.party || {}) },
        },
        settings: {
            ...(selectedLaunchPreset?.settings || {}),
            ...buildLaunchOperatingModelSettings(launchOperatingModel),
            ...(selectedNightType?.settingsOverrides || {}),
            audienceJoinPolicy: {
                ...normalizeAudienceJoinPolicy(selectedLaunchPreset?.settings?.audienceJoinPolicy || {}),
                accessMode: launchJoinAccessMode,
            },
        },
    });
    const launchPresetPayloadPreview = buildLaunchPresetPayload();
    const launchEffectiveBehavior = resolveRoomSetupEffectiveBehavior({
        layers: [
            {
                id: 'launch_plan',
                label: `${selectedLaunchPreset?.label || 'Starting plan'} + ${selectedOperatingModelOption.label}`,
                type: 'provisioning',
                values: {
                    ...(launchPresetPayloadPreview?.settings || {}),
                    hostNightPresetConfig: launchPresetPayloadPreview,
                    eventProfileId: '',
                    runOfShowEnabled: false,
                },
            },
            {
                id: 'launch_economy',
                label: selectedEconomyOption?.label || 'Points plan',
                type: 'provisioning',
                values: { eventCredits: eventCreditsConfig || {} },
            },
        ],
        context: {
            spotlightMode: launchPresetPayloadPreview?.settings?.gamePreviewId || 'karaoke',
        },
    });
    const launchSummaryItems = [
        launchRoomSummaryName,
        selectedOperatingModelOption?.label,
        `${getLaunchMediaSourceLabels(launchMediaSources).join(' + ')} search`,
        hasRequestedLaunchRoomCode ? `Code ${requestedLaunchRoomCodeCandidate}` : 'Auto room code',
        discoveryListingEnabled ? 'Discoverable' : 'Private link',
        hasLaunchStartTime ? `Starts ${launchStartSummary}` : 'Starts now',
        selectedJoinOption?.label,
        launchNeedsPasscode ? 'Separate guest passcode' : '',
        selectedEconomyOption?.label,
    ].filter(Boolean);
    const applyLaunchEconomy = (mode = 'standard') => {
        setEventCreditsConfig((prev) => {
            if (mode === 'standard') return applyEventCreditsPreset('off', prev);
            if (mode === 'event') return applyEventCreditsPreset('ticketed_event', prev);
            if (mode === 'beaubucks') {
                const next = applyEventCreditsPreset('custom_event_credits', prev);
                return {
                    ...next,
                    presetId: 'beaubucks',
                    eventId: 'beaubucks',
                    eventLabel: 'Points + BeauBucks',
                    generalAdmissionPoints: 100,
                    vipBonusPoints: 0,
                    skipLineBonusPoints: 0,
                    websiteCheckInPoints: 0,
                    socialPromoPoints: 0,
                    timedLobbyEnabled: false,
                    supportPoints: 0,
                    beauBucksEnabledTonight: true,
                };
            }
            if (mode === 'fundraiser') {
                const next = applyEventCreditsPreset('custom_event_credits', prev);
                return {
                    ...next,
                    eventLabel: next.eventLabel || launchRoomSummaryName || 'Fundraiser Room',
                    supportLabel: next.supportLabel || 'Support This Room',
                    supportPoints: Math.max(Number(next.supportPoints || 0), 25),
                };
            }
            return applyEventCreditsPreset('custom_event_credits', prev);
        });
    };
    const applyLaunchNightType = (nightTypeId = 'party_karaoke') => {
        const option = LAUNCH_NIGHT_TYPE_OPTIONS.find((entry) => entry.id === nightTypeId) || LAUNCH_NIGHT_TYPE_OPTIONS[0];
        setLaunchNightType(option.id);
        setLaunchOperatingModel(option.operatingModel);
        applyLaunchEconomy(option.economyMode);
        if (presets.some((preset) => preset.id === option.presetId)) setHostNightPreset(option.presetId);
    };
    useEffect(() => {
        if (resolvedLaunchPresetId !== 'aahf') return;
        setLaunchRequestedRoomCode((current) => String(current || '').trim() ? current : 'AAHF');
    }, [resolvedLaunchPresetId, setLaunchRequestedRoomCode]);
    const activeJoinPosterRoom = useMemo(() => {
        if (!joinPosterRoom || typeof joinPosterRoom !== 'object') return null;
        const code = String(joinPosterRoom.code || '').trim().toUpperCase();
        if (!code) return null;
        return {
            ...joinPosterRoom,
            code,
            logoUrl: String(joinPosterRoom.logoUrl || '').trim() || (
                String(joinPosterRoom.hostNightPreset || '').trim().toLowerCase() === 'aahf'
                    ? AAHF_FESTIVAL_LOGO_URL
                    : ''
            ),
            audienceBrandTheme: joinPosterRoom.audienceBrandTheme || null,
            audienceUrl: audienceBase
                ? `${audienceBase}?room=${encodeURIComponent(code)}`
                : '',
        };
    }, [audienceBase, joinPosterRoom]);
    const handleRoomBrowserBucketClick = (bucketId) => {
        setRoomBrowserFilter(bucketId);
        if (typeof window === 'undefined' || window.innerWidth >= 1280) return;
        window.setTimeout(() => {
            roomBrowserResultsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }, 0);
    };
    useEffect(() => {
        if (selectedRoom?.code) return;
        if (!roomBrowserResults.length) {
            const timer = setTimeout(() => setRoomSetupMode('create'), 0);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [roomBrowserResults.length, selectedRoom?.code]);
    const handleSelectRoom = (roomCode = '') => {
        setSelectedRoomCode(roomCode);
        setRoomSetupMode('manage');
    };
    const selectedRoomPinned = pinnedRoomCodeSet?.has?.(String(selectedRoom?.code || '').trim().toUpperCase());
    const selectedRoomSchedule = selectedRoom ? formatRoomSchedule(selectedRoom) : '';
    const manageModeActive = roomSetupMode === 'manage';
    const createModeActive = roomSetupMode === 'create';
    const existingRoomCount = roomBrowserBuckets.find((bucket) => bucket.id === 'all')?.rooms.length || 0;
    const activeRoomSetupTab = ROOM_SETUP_TABS.find((tab) => tab.id === roomSetupMode) || ROOM_SETUP_TABS[0];
    const getRoomSetupTabButtonClass = (active = false, activeToneClass = '') => (
        `inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition ${
            active
                ? activeToneClass
                : 'border-white/8 bg-white/[0.025] text-zinc-300 hover:border-white/15 hover:bg-white/[0.05] hover:text-white'
        }`
    );

    return (
    <div className="relative z-10 w-full max-w-[1600px] scroll-mt-4">
        <div className="rounded-[1.35rem] border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(255,194,104,0.08),transparent_22%),radial-gradient(circle_at_85%_14%,rgba(236,72,153,0.08),transparent_28%),linear-gradient(145deg,rgba(13,18,34,0.94),rgba(8,14,24,0.98))] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.44)] backdrop-blur-xl md:p-3">
            <header className="flex flex-wrap items-center gap-2 rounded-[1rem] border border-white/10 bg-black/20 p-2.5">
                <div className="mr-auto flex min-w-[220px] items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/18 bg-black/25 p-1.5">
                        <img src={ASSETS.logo} alt="BeauRocks Karaoke" className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-black text-white">Room setup</div>
                        <div className="truncate text-[11px] text-cyan-100/58">{activeRoomSetupTab.helper}</div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Room setup workspace">
                    {ROOM_SETUP_TABS.map((tab) => {
                        const active = roomSetupMode === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setRoomSetupMode(tab.id)}
                                className={getRoomSetupTabButtonClass(active, tab.activeToneClass)}
                            >
                                <i className={`fa-solid ${tab.icon} text-[10px]`} />
                                <span>{tab.label}</span>
                                {tab.id === 'manage' ? (
                                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${tab.badgeToneClass}`}>
                                        {recentHostRoomsLoading ? '...' : existingRoomCount}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
                <span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.14em] ${launchStateTone}`}>{launchState}</span>
                <span className={`rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.14em] ${launchAccessPending ? 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100' : 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100'}`}>
                    {launchAccessPending ? 'Syncing' : 'Ready'}
                </span>
            </header>
            <div className="mt-2 space-y-3">

                {manageModeActive ? (
                    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_380px]">
                        <aside className="order-2 rounded-[1.4rem] border border-white/10 bg-black/22 p-3 xl:order-none xl:col-start-1 xl:row-start-1">
                            <div className="px-2">
                                <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/58">Folders</div>
                                <div className="mt-1 text-lg font-black text-white">Existing rooms</div>
                                <div className="mt-1 text-sm text-cyan-100/68">Ready and upcoming rooms stay separate. Closed and archived rooms live together under Past.</div>
                            </div>
                            <div className="mt-3 space-y-1.5">
                                {roomBrowserBuckets.map((bucket) => {
                                    const selected = activeRoomBucket?.id === bucket.id;
                                    return (
                                        <button
                                            key={bucket.id}
                                            type="button"
                                            onClick={() => handleRoomBrowserBucketClick(bucket.id)}
                                            data-room-browser-bucket={bucket.id}
                                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${selected
                                                ? 'border-cyan-300/35 bg-cyan-500/12 text-white'
                                                : 'border-transparent bg-white/[0.03] text-cyan-100/76 hover:border-white/10 hover:bg-white/[0.05]'}`}
                                        >
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold">{bucket.label}</div>
                                                <div className="mt-0.5 text-xs text-cyan-100/52">{bucket.detail}</div>
                                            </div>
                                            <span className={`ml-3 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${selected ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-black/20 text-cyan-100/58'}`}>
                                                {bucket.rooms.length}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </aside>

                        <section ref={roomBrowserResultsRef} className="order-3 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/22 xl:order-none xl:col-start-2 xl:row-start-1">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/58">{activeRoomBucket?.label || 'Rooms'}</div>
                                    <div className="mt-1 text-xl font-black text-white">
                                        {recentHostRoomsLoading ? 'Syncing rooms...' : `${roomBrowserResults.length} room${roomBrowserResults.length === 1 ? '' : 's'}`}
                                    </div>
                                </div>
                                <div className="flex min-w-full flex-col gap-2 sm:min-w-[520px] sm:flex-row">
                                    <input
                                        value={roomBrowserSearch}
                                        onChange={(e) => setRoomBrowserSearch(e.target.value)}
                                        placeholder="Search by room name, code, preset, or status"
                                        className="min-w-0 flex-1 rounded-xl border border-cyan-400/20 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                    />
                                    <details className="group relative min-w-[170px]" data-branded-room-sort="true">
                                        <summary className="flex min-h-[42px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-cyan-400/20 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white outline-none transition hover:border-cyan-300/40">
                                            <span>{ROOM_BROWSER_SORT_OPTIONS.find((option) => option.id === roomBrowserSort)?.label || 'Sort rooms'}</span>
                                            <i className="fa-solid fa-chevron-down text-[9px] text-cyan-200/60 transition group-open:rotate-180" />
                                        </summary>
                                        <div className="absolute right-0 z-30 mt-1 min-w-full overflow-hidden rounded-xl border border-cyan-300/25 bg-zinc-950 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
                                            {ROOM_BROWSER_SORT_OPTIONS.map((option) => {
                                                const selected = option.id === roomBrowserSort;
                                                return (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={(event) => {
                                                            setRoomBrowserSort(option.id);
                                                            event.currentTarget.closest('details')?.removeAttribute('open');
                                                        }}
                                                        className={`flex min-h-[38px] w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${selected ? 'bg-cyan-500/16 text-cyan-50' : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'}`}
                                                    >
                                                        {option.label}
                                                        {selected ? <i className="fa-solid fa-check text-[10px] text-cyan-300" /> : null}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </details>
                                    {roomBrowserSearch ? (
                                        <button
                                            type="button"
                                            onClick={() => setRoomBrowserSearch('')}
                                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}
                                        >
                                            Clear
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            <div className="hidden grid-cols-[minmax(210px,2fr)_104px_104px_150px_minmax(180px,0.8fr)] gap-3 border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-cyan-100/48 md:grid">
                                <div>Room</div>
                                <div>Status</div>
                                <div>Visibility</div>
                                <div>When</div>
                                <div className="text-right">Actions</div>
                            </div>

                            <div className="max-h-[min(720px,calc(100vh-260px))] overflow-y-auto">
                                {recentHostRoomsLoading ? (
                                    <div className="px-4 py-12 text-center text-sm text-cyan-100/72">
                                        Syncing your room browser...
                                    </div>
                                ) : roomBrowserResults.length > 0 ? roomBrowserResults.map((roomItem) => {
                                    const lifecycle = getRoomLifecycle(roomItem);
                                    const visibility = getRoomVisibilityMeta(roomItem);
                                    const roomSchedule = formatRoomSchedule(roomItem) || formatRecentRoomTime(roomItem.updatedAtMs || roomItem.createdAtMs) || 'No recent activity';
                                    const selected = selectedRoom?.code === roomItem.code;
                                    const roomBusy = roomManagerBusyCode === roomItem.code;
                                    const roomPinned = pinnedRoomCodeSet?.has?.(String(roomItem.code || '').trim().toUpperCase());
                                    return (
                                        <div
                                            key={roomItem.code}
                                            onClick={() => handleSelectRoom(roomItem.code)}
                                            className={`grid cursor-pointer gap-3 border-b border-white/6 px-4 py-3 transition md:grid-cols-[minmax(210px,2fr)_104px_104px_150px_minmax(180px,0.8fr)] ${selected ? 'bg-cyan-500/10' : 'hover:bg-white/[0.04]'}`}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-start gap-2">
                                                    <div
                                                        className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-white"
                                                        title={roomItem.roomName || roomItem.code}
                                                    >
                                                        {roomItem.roomName || roomItem.code}
                                                    </div>
                                                    {roomPinned ? (
                                                        <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-100">
                                                            Pinned
                                                        </span>
                                                    ) : null}
                                                    {isAahfRoom(roomItem) ? (
                                                        <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-fuchsia-100">
                                                            AAHF
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-1 truncate text-xs text-cyan-100/58">
                                                    {roomItem.code}
                                                    {roomItem.currentTemplateName ? ` | ${roomItem.currentTemplateName}` : ''}
                                                </div>
                                            </div>
                                            <div className="md:self-center">
                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${lifecycle.chipClass}`}>
                                                    {lifecycle.label}
                                                </span>
                                            </div>
                                            <div className="md:self-center">
                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${visibility.chipClass}`}>
                                                    {visibility.label}
                                                </span>
                                            </div>
                                            <div className="text-xs text-cyan-100/68 md:self-center">{roomSchedule}</div>
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openExistingRoomWorkspace(roomItem.code, 'queue.live_run');
                                                    }}
                                                    disabled={joiningRoom}
                                                    className={`${STYLES.btnStd} ${selected ? STYLES.btnHighlight : STYLES.btnSecondary} px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    Open
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openExistingRoomWorkspace(roomItem.code, 'ops.room_setup');
                                                    }}
                                                    disabled={joiningRoom}
                                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    Settings
                                                </button>
                                                {roomItem.hasRecap && audienceBase ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            runFeaturedAction('recap', roomItem);
                                                        }}
                                                        className="rounded-full border border-fuchsia-300/28 bg-fuchsia-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-fuchsia-100"
                                                    >
                                                        Recap
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        togglePinnedRoom?.(roomItem.code);
                                                    }}
                                                    className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${roomPinned ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-white/5 text-cyan-100/76'}`}
                                                >
                                                    {roomPinned ? 'Pinned' : 'Pin'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRoomArchivedState?.(roomItem.code, !roomItem.archived);
                                                    }}
                                                    disabled={joiningRoom || roomBusy}
                                                    className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${(joiningRoom || roomBusy) ? 'cursor-not-allowed opacity-60' : ''} ${roomItem.archived ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-white/5 text-cyan-100/76'}`}
                                                >
                                                    {roomItem.archived ? 'Restore' : 'Archive'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="px-4 py-12 text-center text-sm text-cyan-100/68">
                                        No rooms match this filter yet. Use Create Room or switch folders.
                                    </div>
                                )}
                            </div>
                        </section>
                        <aside className="order-1 self-start xl:order-none xl:col-start-3 xl:row-start-1 xl:sticky xl:top-4">
                            <div className="rounded-[1.4rem] border border-cyan-300/22 bg-[linear-gradient(145deg,rgba(10,18,28,0.94),rgba(12,21,34,0.92))] p-4 shadow-[0_20px_48px_rgba(0,0,0,0.24)]">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/58">Selected room</div>
                                        <div className="mt-1 text-xl font-black text-white">Room controls</div>
                                    </div>
                                </div>
                                {selectedRoom ? (
                                    <>
                                        <div className="mt-3 rounded-xl border border-cyan-300/18 bg-cyan-500/8 px-3 py-3">
                                            <div className="text-lg font-black text-white">{selectedRoom.roomName || selectedRoom.code}</div>
                                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-100/58">{selectedRoom.code}</div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${selectedRoomLifecycle?.chipClass || 'border-white/10 bg-white/5 text-cyan-100/70'}`}>
                                                    {selectedRoomLifecycle?.label || 'Room'}
                                                </span>
                                                {selectedRoomPinned ? (
                                                    <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-100">Pinned</span>
                                                ) : null}
                                                <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${selectedRoomVisibility?.chipClass || 'border-white/10 bg-white/5 text-cyan-100/70'}`}>
                                                    {selectedRoomVisibility?.label || 'Private'}
                                                </span>
                                                {selectedRoomSchedule ? (
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/70">{selectedRoomSchedule}</span>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="mt-3 grid gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openExistingRoomWorkspace(selectedRoom.code, 'ops.room_setup')}
                                                disabled={joiningRoom}
                                                className={`${STYLES.btnStd} ${STYLES.btnHighlight} w-full px-4 py-2.5 text-[11px] uppercase tracking-[0.18em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                Room Settings
                                            </button>
                                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                                                <button
                                                    type="button"
                                                    onClick={() => runFeaturedAction(selectedRoomAction?.action || 'live', selectedRoom)}
                                                    disabled={joiningRoom}
                                                    className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    {selectedRoomAction?.label || 'Open Host Panel'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openExistingRoomWorkspace(selectedRoom.code, 'show.timeline')}
                                                    disabled={joiningRoom}
                                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    Show Plan
                                                </button>
                                                {selectedRoom.hasRecap && audienceBase ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => runFeaturedAction('recap', selectedRoom)}
                                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-fuchsia-100`}
                                                    >
                                                        View Recap
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Recommended next</div>
                                            <div className="mt-1 text-sm font-semibold text-white">{selectedRoomAction?.label || 'Open Host Panel'}</div>
                                            <div className="mt-1 text-xs text-cyan-100/62">{selectedRoomAction?.detail || 'Jump back into the room.'}</div>
                                        </div>

                                        {selectedRoomCleanupMeta ? (
                                            <div className={`mt-3 rounded-xl border px-3 py-3 text-sm ${selectedRoomCleanupMeta.toneClass}`}>
                                                {selectedRoomCleanupMeta.label}
                                            </div>
                                        ) : null}

                                        {selectedRoom.recurringRule === 'weekly' && selectedRoom.occurrenceId ? (
                                            <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/8 px-3 py-3">
                                                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/66">Weekly night</div>
                                                <div className="mt-1 text-sm text-cyan-50">
                                                    Next occurrence: {formatRoomSchedule(selectedRoom) || 'Schedule pending'}
                                                </div>
                                                <div className="mt-1 text-xs text-cyan-100/58">Skip only this date; the following week stays scheduled.</div>
                                                <button
                                                    type="button"
                                                    onClick={() => setRoomOccurrenceStatus?.(selectedRoom, 'cancel')}
                                                    disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code || selectedRoom.archived}
                                                    className={'mt-3 rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-amber-100 ' + ((joiningRoom || roomManagerBusyCode === selectedRoom.code || selectedRoom.archived) ? 'cursor-not-allowed opacity-60' : '')}
                                                >
                                                    {roomManagerBusyCode === selectedRoom.code && roomManagerBusyAction === 'skip_occurrence'
                                                        ? 'Skipping'
                                                        : 'Skip This Week'}
                                                </button>
                                            </div>
                                        ) : null}

                                        <details className="mt-3 rounded-xl border border-rose-300/20 bg-rose-500/8 px-3 py-3">
                                            <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.18em] text-rose-100/70">More room actions</summary>
                                            <div className="mt-3 text-sm text-rose-50/88">Archive rooms you want to keep, reset closed rooms you want to reuse, or permanently delete archived rooms you no longer need.</div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => togglePinnedRoom?.(selectedRoom.code)}
                                                    className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${selectedRoomPinned ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-white/5 text-cyan-100/76'}`}
                                                >
                                                    {selectedRoomPinned ? 'Pinned Room' : 'Pin Room'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => (selectedRoom.archived ? setRoomArchivedState?.(selectedRoom.code, false) : setRoomArchivedState?.(selectedRoom.code, true))}
                                                    disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code}
                                                    className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${(joiningRoom || roomManagerBusyCode === selectedRoom.code) ? 'cursor-not-allowed opacity-60' : ''} ${selectedRoom.archived ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-white/5 text-cyan-100/76'}`}
                                                >
                                                    {selectedRoom.archived ? 'Restore Room' : 'Archive Room'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRoomDiscoverability?.(selectedRoom, !selectedRoom.publicRoom)}
                                                    disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code || selectedRoom.archived}
                                                    className={`rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100 ${(joiningRoom || roomManagerBusyCode === selectedRoom.code || selectedRoom.archived) ? 'cursor-not-allowed opacity-60' : ''}`}
                                                >
                                                    {selectedRoom.publicRoom ? 'Make Private' : 'Make Discoverable'}
                                                </button>
                                                {Number(selectedRoom.closedAtMs || 0) > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => runLandingRoomCleanup?.(selectedRoom.code)}
                                                        disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code}
                                                        className={`rounded-full border border-rose-300/28 bg-rose-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-rose-100 ${(joiningRoom || roomManagerBusyCode === selectedRoom.code) ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        Reset Room
                                                    </button>
                                                ) : null}
                                                {selectedRoom.hasRecap && audienceBase ? (
                                                    <button type="button" onClick={() => runFeaturedAction('recap', selectedRoom)} className="rounded-full border border-fuchsia-300/28 bg-fuchsia-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-fuchsia-100">Open Recap</button>
                                                ) : null}
                                                {!selectedRoom.archived ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => resetRoomToCurrentTemplate?.(selectedRoom)}
                                                        disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code}
                                                        className={`rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100/76 ${(joiningRoom || roomManagerBusyCode === selectedRoom.code) ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        Reset to Template
                                                    </button>
                                                ) : null}
                                                {isAahfRoom(selectedRoom) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => seedAahfKickoffRoom?.(selectedRoom)}
                                                        disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code}
                                                        className={`rounded-full border border-fuchsia-300/28 bg-fuchsia-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-fuchsia-100 ${(joiningRoom || roomManagerBusyCode === selectedRoom.code) ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        Seed Kickoff
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    onClick={() => setJoinPosterRoom(selectedRoom)}
                                                    disabled={!audienceBase}
                                                    className={`rounded-full border border-cyan-300/28 bg-cyan-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100 ${!audienceBase ? 'cursor-not-allowed opacity-60' : ''}`}
                                                >
                                                    Join Poster
                                                </button>
                                                {selectedRoom.archived && canPermanentlyDeleteRooms ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => runLandingRoomPermanentDelete?.(selectedRoom.code)}
                                                        disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code}
                                                        className={`rounded-full border border-rose-300/28 bg-rose-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-rose-100 ${(joiningRoom || roomManagerBusyCode === selectedRoom.code) ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        Delete Forever
                                                    </button>
                                                ) : null}
                                            </div>
                                            {roomManagerBusyCode === selectedRoom.code ? (
                                                <div className="mt-3 text-xs text-cyan-100/62">Working on {roomManagerBusyAction || 'room update'}...</div>
                                            ) : null}
                                        </details>
                                    </>
                                ) : (
                                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-cyan-100/68">
                                        Select a room from the browser to manage settings, open the host panel, archive it, or clean it up.
                                    </div>
                                )}

                                <details className="mt-3 rounded-xl border border-cyan-300/18 bg-cyan-500/8 px-3 py-3" {...(!selectedRoom ? { open: true } : {})}>
                                    <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Open by room code</summary>
                                    <div className="mt-1 text-sm text-cyan-100/72">Use this when you already know the room code and want the live host panel immediately.</div>
                                    <div className="mt-3 flex flex-col gap-2">
                                        <input
                                            value={roomCodeInput}
                                            onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && hasLaunchRoomCode) {
                                                    openExistingRoomWorkspace(launchRoomCodeCandidate, 'queue.live_run');
                                                }
                                            }}
                                            placeholder="Open by room code"
                                            className="min-w-0 flex-1 rounded-xl border border-cyan-400/20 bg-black/30 px-3 py-2.5 text-sm uppercase tracking-[0.18em] text-white outline-none transition focus:border-cyan-300/45"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => openExistingRoomWorkspace(launchRoomCodeCandidate, 'queue.live_run')}
                                            disabled={!hasLaunchRoomCode || joiningRoom}
                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-[10px] uppercase tracking-[0.18em] ${!hasLaunchRoomCode || joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            Open Room
                                        </button>
                                    </div>
                                </details>
                            </div>
                        </aside>
                    </div>
                ) : null}
                {createModeActive ? (
                    <div
                        id="launchpad-create-room"
                        data-room-create-premium="true"
                        className="relative isolate overflow-hidden rounded-[1.75rem] border border-fuchsia-300/20 bg-[radial-gradient(circle_at_12%_12%,rgba(236,72,153,0.18),transparent_31%),radial-gradient(circle_at_88%_18%,rgba(34,211,238,0.16),transparent_32%),linear-gradient(145deg,rgba(12,15,29,0.98),rgba(8,19,29,0.98)_52%,rgba(24,10,29,0.98))] p-3 shadow-[0_28px_80px_rgba(0,0,0,0.42),0_0_48px_rgba(34,211,238,0.055)] sm:p-5 lg:p-6"
                    >
                        <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-24 h-52 w-52 rounded-full bg-fuchsia-500/10 blur-3xl" />
                        <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />

                        {shouldShowSetupCard ? (
                            <div className="relative mb-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3.5 backdrop-blur-sm">
                                <div className="text-sm font-semibold text-amber-50">Finish host setup first.</div>
                                <div className="mt-1 text-sm text-amber-100/78">
                                    Your workspace and host identity need one quick setup pass before you can create rooms.
                                </div>
                                <button type="button" onClick={openOnboardingWizard} disabled={!canUseWorkspaceOnboarding} className={`${STYLES.btnStd} ${STYLES.btnHighlight} mt-3 px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${!canUseWorkspaceOnboarding ? 'opacity-60 cursor-not-allowed' : ''}`}>Finish Setup</button>
                            </div>
                        ) : null}

                        <div className="relative grid overflow-hidden rounded-[1.45rem] border border-white/10 bg-black/24 shadow-[0_18px_50px_rgba(0,0,0,0.28)] lg:grid-cols-[minmax(250px,0.76fr)_minmax(0,1.35fr)]" data-launch-core-setup="true">
                            <div className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(160deg,rgba(236,72,153,0.13),rgba(9,20,31,0.18)_48%,rgba(34,211,238,0.10))] p-5 sm:p-6 lg:border-b-0 lg:border-r lg:p-7">
                                <div aria-hidden="true" className="absolute -right-14 -top-14 h-40 w-40 rounded-full border border-cyan-200/10 shadow-[0_0_60px_rgba(34,211,238,0.16)]" />
                                <div className="relative flex h-full min-h-[170px] flex-col">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-100/72">
                                            <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_14px_rgba(244,114,182,0.95)]" />
                                            New room
                                        </span>
                                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${launchDisabled ? 'border-amber-300/25 bg-amber-500/10 text-amber-100' : 'border-cyan-300/30 bg-cyan-400/10 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.1)]'}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${launchDisabled ? 'bg-amber-300' : 'bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]'}`} />
                                            {launchDisabled ? 'Needs input' : 'Ready'}
                                        </span>
                                    </div>
                                    <div className="mt-4 grid h-11 w-11 place-items-center rounded-xl border border-cyan-200/20 bg-[linear-gradient(145deg,rgba(34,211,238,0.19),rgba(236,72,153,0.16))] text-base text-white shadow-[0_12px_26px_rgba(0,0,0,0.22)]">
                                        <i className="fa-solid fa-microphone-lines" />
                                    </div>
                                    <h2 className="mt-3 max-w-xs text-2xl font-black leading-[1.04] tracking-[-0.03em] text-white">Create your room</h2>
                                    <p className="mt-2 max-w-xs text-sm leading-5 text-cyan-50/62">Name it, choose a recipe, and decide who can join.</p>
                                    <div className="mt-auto pt-4">
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 backdrop-blur-sm">
                                            <div className="flex items-center gap-3">
                                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-fuchsia-200/15 bg-fuchsia-500/10 text-fuchsia-100">
                                                    <i className={`fa-solid ${selectedOperatingModelOption.icon}`} />
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-cyan-100/44">Night recipe</span>
                                                    <span className="mt-1 block truncate text-sm font-bold text-white">{selectedNightType.label}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[linear-gradient(150deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] p-4 sm:p-6 lg:p-7">
                                {launchDraftRecovered ? (
                                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-50" role="status">
                                        <i className="fa-solid fa-rotate-left"></i>
                                        Saved choices restored
                                    </div>
                                ) : null}
                                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                                    <label className="block md:col-span-2 lg:col-span-3">
                                        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/60"><i className="fa-solid fa-signature text-cyan-300/72" /> Room name</span>
                                        <input value={launchRoomName} onChange={(e) => setLaunchRoomName(e.target.value)} placeholder="Friday Karaoke" autoFocus className={launchInputClass} />
                                    </label>
                                    <div className="md:col-span-2 lg:col-span-3" data-launch-room-control="true">
                                        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/60"><i className="fa-solid fa-layer-group text-fuchsia-300/78" /> Night recipe</span>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                            {LAUNCH_NIGHT_TYPE_OPTIONS.map((option) => {
                                                const selected = option.id === launchNightType;
                                                return (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        data-launch-room-recipe={option.id}
                                                        aria-pressed={selected}
                                                        onClick={() => applyLaunchNightType(option.id)}
                                                        className={`min-h-[126px] rounded-xl border p-3 text-left transition ${selected ? 'border-fuchsia-300/48 bg-fuchsia-500/14 text-white shadow-[0_14px_30px_rgba(217,70,239,0.1)]' : 'border-white/10 bg-black/18 text-cyan-100/72 hover:border-cyan-300/25 hover:bg-white/[0.04]'}`}
                                                    >
                                                        <span className="flex items-start justify-between gap-2">
                                                            <span className="inline-flex items-center gap-2 text-sm font-black"><i className={`fa-solid ${option.icon}`} />{option.label}</span>
                                                            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[8px] uppercase tracking-[0.13em]">{option.eyebrow}</span>
                                                        </span>
                                                        <span className="mt-1.5 block text-[11px] leading-4 opacity-75">{option.summary}</span>
                                                        <span className="mt-2 flex flex-wrap gap-1">
                                                            {option.effects.map((effect) => <span key={effect} className="rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[9px]">{effect}</span>)}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2" data-launch-guest-access="true">
                                        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/60"><i className="fa-solid fa-user-group text-cyan-300/72" /> Guest access</span>
                                        <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                                            {AUDIENCE_JOIN_ACCESS_OPTIONS.map((option) => {
                                                const selected = launchJoinAccessMode === option.id;
                                                const label = option.id === AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed ? 'Open to guests' : option.id === AUDIENCE_JOIN_ACCESS_MODES.accountRequired ? 'Accounts only' : 'Private passcode';
                                                const helper = option.id === AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed ? 'Name + emoji' : option.id === AUDIENCE_JOIN_ACCESS_MODES.accountRequired ? 'Sign-in required' : 'Code + passcode';
                                                return (
                                                    <button key={option.id} type="button" aria-pressed={selected} onClick={() => setLaunchJoinAccessMode(option.id)} className={`min-h-[58px] rounded-xl border px-3 py-2 text-left transition ${selected ? 'border-cyan-300/42 bg-cyan-500/14 text-white' : 'border-white/10 bg-black/18 text-cyan-100/68 hover:border-cyan-300/24'}`}>
                                                        <span className="block text-xs font-black">{label}</span>
                                                        <span className="mt-0.5 block text-[10px] opacity-60">{helper}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="block" data-launch-room-privacy="true">
                                        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/60"><i className="fa-solid fa-eye text-cyan-300/72" /> Room privacy</span>
                                        <div className="mt-2 inline-flex min-h-[50px] w-full rounded-[0.95rem] border border-white/10 bg-slate-950/60 p-1">
                                            <button type="button" onClick={() => setDiscoveryListingMode(false)} aria-pressed={!discoveryListingEnabled} className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${!discoveryListingEnabled ? 'bg-white text-slate-950' : 'text-cyan-100/62 hover:text-white'}`}>Private</button>
                                            <button type="button" onClick={() => setDiscoveryListingMode(true)} aria-pressed={discoveryListingEnabled} className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${discoveryListingEnabled ? 'bg-gradient-to-r from-cyan-300 to-fuchsia-300 text-slate-950' : 'text-cyan-100/62 hover:text-white'}`}>Discover</button>
                                        </div>
                                        <div className="mt-2 text-xs leading-5 text-cyan-100/52">{discoveryListingEnabled ? 'List this Room in Discover. You can add venue and schedule details later.' : 'Only people with the Room code or Audience App link can find it.'}</div>
                                    </div>
                                </div>
                                {launchNeedsPasscode ? (
                                    <label className="mt-5 block max-w-md">
                                        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/60"><i className="fa-solid fa-lock text-fuchsia-300/78" /> Guest passcode</span>
                                        <input type="password" value={launchJoinPasscode} onChange={(e) => setLaunchJoinPasscode(String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24))} placeholder="4-24 letters or numbers" minLength={4} maxLength={24} autoComplete="new-password" className={launchInputClass} />
                                        {!launchPasscodeValid ? <div className="mt-2 text-xs text-amber-200">Use at least 4 letters or numbers.</div> : null}
                                    </label>
                                ) : null}
                                <details className="group mt-5 rounded-2xl border border-white/[0.08] bg-black/18 px-4 py-3 transition open:border-cyan-300/15 open:bg-cyan-500/[0.035]">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-cyan-50/68 transition hover:text-white">
                                        <span className="inline-flex items-center gap-2"><i className="fa-solid fa-hashtag text-cyan-300/58" /> Custom room code <span className="font-normal text-cyan-100/34">Optional</span></span>
                                        <i className="fa-solid fa-chevron-down text-[9px] text-cyan-100/42 transition group-open:rotate-180" />
                                    </summary>
                                    <label className="mt-4 block max-w-md">
                                        <input value={launchRequestedRoomCode} onChange={(e) => setLaunchRequestedRoomCode(e.target.value.toUpperCase())} placeholder="Choose a memorable code" maxLength={10} className={`${launchInputClass} mt-0 uppercase tracking-[0.18em]`} />
                                        <div className="mt-2 text-xs text-cyan-100/48">Leave blank and we&apos;ll create one.</div>
                                    </label>
                                </details>
                                <div className="mt-5 rounded-2xl border border-cyan-300/18 bg-cyan-500/[0.07] px-4 py-3" data-launch-media-readiness="true">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/74"><i className="fa-solid fa-music" /> Searchable media</span>
                                        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-cyan-50">{getLaunchMediaSourceLabels(launchMediaSources).length} enabled</span>
                                    </div>
                                    <div className="mt-2 text-xs leading-5 text-cyan-50/66">Choose where Host and Audience searches may look. This sets guardrails, not a catalog lock; every performance still needs playable backing.</div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {LAUNCH_MEDIA_SOURCE_OPTIONS.map((option) => {
                                            const selected = !option.disabled && launchMediaSources?.[option.id] !== false;
                                            return (
                                                <button key={option.id} type="button" disabled={option.disabled} aria-pressed={selected} onClick={() => toggleLaunchMediaSource(option.id)} className={`min-h-[58px] rounded-xl border px-3 py-2 text-left transition ${option.disabled ? 'cursor-not-allowed border-white/6 bg-black/15 text-zinc-500' : selected ? 'border-cyan-300/40 bg-cyan-400/12 text-white' : 'border-white/10 bg-black/20 text-zinc-300 hover:border-cyan-300/25'}`}>
                                                    <span className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-sm font-black"><i className={`${option.icon.startsWith('fa-brands') ? '' : 'fa-solid '}${option.icon}`} />{option.label}</span><span className="text-[9px] font-black uppercase tracking-[0.14em]">{option.disabled ? 'Coming soon' : selected ? 'Included' : 'Off'}</span></span>
                                                    <span className="mt-1 block text-[11px] leading-4 opacity-65">{option.helper}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button type="button" data-host-create-room-primary="true" aria-busy={creatingRoom} onClick={() => handleStartLauncherRoom({ openNightSetup: true, launchTarget: 'stage', nightPresetPayload: launchPresetPayloadPreview, audienceJoinPasscode: normalizedLaunchJoinPasscode })} disabled={roomLaunchDisabled} className={`group/launch mt-5 flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(100deg,#db2777_0%,#ec4899_35%,#14b8a6_78%,#22d3ee_100%)] px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_14px_34px_rgba(236,72,153,0.18),0_0_28px_rgba(34,211,238,0.1)] transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_18px_42px_rgba(236,72,153,0.24),0_0_34px_rgba(34,211,238,0.16)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:brightness-100 ${roomLaunchDisabled ? 'cursor-not-allowed opacity-45' : ''}`}>
                                    {creatingRoom ? <i className="fa-solid fa-circle-notch animate-spin" /> : <i className="fa-solid fa-wand-magic-sparkles" />}
                                    <span>{creatingRoom ? 'Creating room...' : 'Continue to Room Readiness'}</span>
                                    {!creatingRoom ? <i className="fa-solid fa-arrow-right text-[10px] transition-transform group-hover/launch:translate-x-1" /> : null}
                                </button>
                                <div className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] text-cyan-100/42"><i className="fa-solid fa-shield-check text-[9px]" /> Review Tonight Setup, then Launch Room to open Public TV and copy the Audience App link.</div>
                            </div>
                        </div>

                        <div className="hidden" aria-hidden="true" data-launch-configuration-contract="true">
                            <div className="space-y-3">
                                <section className="rounded-xl border border-cyan-300/22 bg-cyan-500/8 px-3 py-3" data-launch-night-type>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Quick setup</div>
                                            <div className="mt-1 text-lg font-black text-white">What kind of night is this?</div>
                                            <div className="mt-1 text-sm text-cyan-100/68">One choice sets the recommended queue, host style, automation, and economy defaults.</div>
                                        </div>
                                        <span className="rounded-full border border-cyan-300/25 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/72">{selectedNightType.eyebrow}</span>
                                    </div>
                                    {launchDraftRecovered ? (
                                        <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-50" role="status">
                                            Draft restored from this browser. Guest and promo codes are never saved.
                                        </div>
                                    ) : null}
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        {LAUNCH_NIGHT_TYPE_OPTIONS.map((option) => {
                                            const selected = option.id === launchNightType;
                                            return (
                                                <button key={option.id} type="button" data-launch-night-type-card={option.id} aria-pressed={selected} onClick={() => applyLaunchNightType(option.id)} className={`rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-cyan-300/50 bg-cyan-500/18 text-white shadow-[0_14px_32px_rgba(34,211,238,0.12)]' : 'border-white/10 bg-black/18 text-cyan-100/74 hover:border-cyan-300/28 hover:bg-cyan-500/8'}`}>
                                                    <span className="flex items-start gap-3">
                                                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${selected ? 'border-cyan-200/40 bg-cyan-300 text-slate-950' : 'border-white/10 bg-white/[0.05] text-cyan-100'}`}><i className={`fa-solid ${option.icon}`}></i></span>
                                                        <span className="min-w-0">
                                                            <span className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-inherit">{option.label}</span><span className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] opacity-72">{option.eyebrow}</span></span>
                                                            <span className="mt-1 block text-xs leading-5 opacity-82">{option.summary}</span>
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button type="button" onClick={() => setShowAdvancedSetup((current) => !current)} aria-expanded={showAdvancedSetup} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-cyan-100/72 hover:text-white">
                                        <i className={`fa-solid fa-chevron-${showAdvancedSetup ? 'up' : 'down'} text-[10px]`}></i>
                                        {showAdvancedSetup ? 'Hide advanced setup' : 'Customize advanced setup'}
                                    </button>
                                </section>

                                <section className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Step 1 - Room identity</div>
                                    <div className="mt-1 text-sm text-cyan-100/66">Give guests a recognizable room and optionally reserve a memorable code.</div>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Room name</div>
                                            <input value={launchRoomName} onChange={(e) => setLaunchRoomName(e.target.value)} placeholder="Friday Karaoke" className={inputClass} />
                                        </label>
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Room code</div>
                                            <input value={launchRequestedRoomCode} onChange={(e) => setLaunchRequestedRoomCode(e.target.value.toUpperCase())} placeholder={resolvedLaunchPresetId === 'aahf' ? 'AAHF' : 'Optional'} maxLength={10} className={`${inputClass} uppercase tracking-[0.18em]`} />
                                            <div className="mt-2 text-xs text-cyan-100/58">
                                                {hasRequestedLaunchRoomCode
                                                    ? `We'll try to reserve ${requestedLaunchRoomCodeCandidate}. If another active room already has it, creation will stop so you can retry.`
                                                    : resolvedLaunchPresetId === 'aahf'
                                                        ? 'AAHF rooms default to room code AAHF so posters and QR signage stay stable.'
                                                        : 'Leave blank to auto-assign a room code.'}
                                            </div>
                                        </label>
                                    </div>
                                </section>

                                <section className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Step 2 - Guest entry</div>
                                    <div className="mt-1 text-sm text-cyan-100/66">Decide when the room appears and how easily guests can get in.</div>
                                    <div className="mt-3 grid gap-3 lg:grid-cols-4">
                                        <label className="block lg:col-span-1">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Start</div>
                                            <input type="datetime-local" value={String(quickLaunchDiscovery?.roomStartsAtLocal || '')} onChange={(e) => setQuickLaunchDiscovery((prev) => ({ ...prev, roomStartsAtLocal: e.target.value }))} className={inputClass} />
                                            <div className="mt-2 text-xs text-cyan-100/58">{hasLaunchStartTime ? launchStartSummary : 'Start now'}</div>
                                        </label>
                                        <div className="lg:col-span-1">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Visibility</div>
                                            <div className="mt-2 inline-flex w-full rounded-xl border border-white/10 bg-black/20 p-1">
                                                <button type="button" onClick={() => setDiscoveryListingMode(false)} className={`flex-1 rounded-lg px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition ${!discoveryListingEnabled ? 'bg-white text-black' : 'text-cyan-100/72'}`}>Private</button>
                                                <button type="button" onClick={() => setDiscoveryListingMode(true)} className={`flex-1 rounded-lg px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition ${discoveryListingEnabled ? 'bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black' : 'text-cyan-100/72'}`}>Discoverable</button>
                                            </div>
                                        </div>
                                        <label className="block lg:col-span-1">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Who can join?</div>
                                            <select value={launchJoinAccessMode} onChange={(e) => setLaunchJoinAccessMode(e.target.value)} className={inputClass}>
                                                {AUDIENCE_JOIN_ACCESS_OPTIONS.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}
                                            </select>
                                            <div className="mt-2 text-xs text-cyan-100/58">{selectedJoinOption?.description}</div>
                                        </label>
                                        <label className="block lg:col-span-1">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Repeats</div>
                                            <select value={String(quickLaunchDiscovery?.recurringRule || 'one_time')} onChange={(e) => setQuickLaunchDiscovery((prev) => ({ ...prev, recurringRule: e.target.value }))} className={inputClass}>
                                                <option value="one_time">One-time room</option>
                                                <option value="weekly">Weekly night</option>
                                            </select>
                                            <div className="mt-2 text-xs text-cyan-100/58">Weekly nights keep one identity across future room sessions.</div>
                                        </label>
                                    </div>
                                    {launchNeedsPasscode ? (
                                        <label className="mt-3 block max-w-md">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Guest passcode</div>
                                            <input type="password" value={launchJoinPasscode} onChange={(e) => setLaunchJoinPasscode(String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24))} placeholder="4-24 letters or numbers" minLength={4} maxLength={24} autoComplete="new-password" className={inputClass} />
                                            <div className={`mt-2 text-xs ${launchPasscodeValid ? 'text-cyan-100/58' : 'text-amber-200'}`}>The room code locates the room. This separate passcode admits a new guest and is stored only as a server-side hash.</div>
                                        </label>
                                    ) : null}
                                </section>

                                <section className={`${showAdvancedSetup ? '' : 'hidden'} rounded-xl border border-fuchsia-300/18 bg-fuchsia-500/8 px-3 py-3`} data-launch-operating-model>
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-100/62">Advanced host style</div>
                                            <div className="mt-1 text-lg font-black text-white">Who drives the night?</div>
                                            <div className="mt-1 text-sm text-fuchsia-100/68">Choose this when the room is created because it changes pacing, automation, and crowd prompts from the start.</div>
                                        </div>
                                        <span className="rounded-full border border-fuchsia-300/25 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-fuchsia-100/72">{selectedOperatingModelOption.eyebrow}</span>
                                    </div>
                                    <div className="mt-3 grid gap-2 lg:grid-cols-3">
                                        {LAUNCH_OPERATING_MODEL_OPTIONS.map((option) => {
                                            const selected = option.id === launchOperatingModel;
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    data-launch-operating-model-card={option.id}
                                                    aria-pressed={selected}
                                                    onClick={() => setLaunchOperatingModel(option.id)}
                                                    className={`min-h-[136px] rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-fuchsia-300/45 bg-fuchsia-500/18 text-white shadow-[0_16px_34px_rgba(217,70,239,0.12)]' : 'border-white/10 bg-black/18 text-fuchsia-100/74 hover:border-fuchsia-300/28 hover:bg-fuchsia-500/8'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="inline-flex items-center gap-2 text-sm font-black leading-tight"><i className={`fa-solid ${option.icon} text-[12px]`}></i>{option.label}</div>
                                                            <div className="mt-1 text-xs leading-5 opacity-82">{option.summary}</div>
                                                        </div>
                                                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${selected ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-black/18 text-fuchsia-100/58'}`}>{option.eyebrow}</span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                        {option.details.map((detail) => (<span key={detail} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] text-fuchsia-50/76">{detail}</span>))}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                                <section className={`${showAdvancedSetup ? '' : 'hidden'} rounded-xl border border-cyan-300/18 bg-cyan-500/8 px-3 py-3`} data-launch-template-options>
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Optional template</div>
                                            <div className="mt-1 text-sm text-cyan-100/66">Choose the starting behavior for queue, requests, search, TV/crowd layers, automation, and guest access. You can refine these after the room exists.</div>
                                        </div>
                                        {selectedPresetUi?.eyebrow ? (<span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/62">{selectedPresetUi.eyebrow}</span>) : null}
                                    </div>
                                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                        {presets.map((preset) => {
                                            const selected = preset.id === resolvedLaunchPresetId;
                                            const presetBaseId = preset.basePresetId || preset.id || 'casual';
                                            const presetUi = PRESET_UI_META?.[presetBaseId] || PRESET_UI_META?.[preset.id] || null;
                                            const chips = Array.isArray(presetUi?.chips) && presetUi.chips.length ? presetUi.chips : [preset.isBuiltIn ? 'Built-in' : 'Custom'];
                                            return (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    data-launch-preset-card={preset.id}
                                                    aria-pressed={selected}
                                                    onClick={() => setHostNightPreset(preset.id)}
                                                    className={`min-h-[124px] rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-cyan-300/45 bg-cyan-500/16 text-white shadow-[0_16px_34px_rgba(34,211,238,0.12)]' : 'border-white/10 bg-black/18 text-cyan-100/74 hover:border-cyan-300/28 hover:bg-cyan-500/8'}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-black leading-tight">{preset.label}</div>
                                                            <div className="mt-1 text-xs leading-5 opacity-82">{presetUi?.summary || preset.description || 'A reusable room package for queue, request, search, and TV defaults.'}</div>
                                                        </div>
                                                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${selected ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-black/18 text-cyan-100/58'}`}>{preset.isBuiltIn ? 'Built-in' : 'Custom'}</span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                        {chips.slice(0, 3).map((chip) => (<span key={chip} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] text-cyan-50/76">{chip}</span>))}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 rounded-xl border border-white/10 bg-black/22 px-3 py-3">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <div className="text-base font-semibold text-white">{selectedLaunchPreset?.label || 'Starting point'}</div>
                                                <div className="mt-1 text-sm text-cyan-100/66">{selectedPresetMeta.summary}</div>
                                            </div>
                                            {selectedLaunchPreset?.isBuiltIn ? (<span className="rounded-full border border-cyan-300/24 bg-cyan-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/72">Built-in</span>) : (<span className="rounded-full border border-fuchsia-300/24 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-fuchsia-100/72">Custom</span>)}
                                        </div>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                            {selectedPresetImpactRows.map((row) => (<div key={row.label} className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2"><div className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/48">{row.label}</div><div className="mt-1 text-sm text-cyan-50/86">{row.value}</div></div>))}
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="space-y-3">
                                <section className="rounded-xl border border-fuchsia-300/18 bg-fuchsia-500/8 px-3 py-3">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-100/62">Step 3 - Points & rewards</div>
                                    <div className="mt-1 text-lg font-black text-white">Choose tonight&apos;s rewards</div>
                                    <div className="mt-1 text-sm text-fuchsia-100/68">Points run live participation. You can also open account-owned BeauBucks cosmetics, ticket perks, or fundraiser support without changing performance scores.</div>
                                    <div className="mt-3 grid gap-2">
                                        {LAUNCH_ECONOMY_OPTIONS.filter((option) => option.id !== 'beaubucks' && (showAdvancedSetup || option.id !== 'custom')).map((option) => {
                                            const selected = option.id === launchEconomyMode;
                                            return (<button key={option.id} type="button" onClick={() => applyLaunchEconomy(option.id)} className={`rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-fuchsia-300/45 bg-fuchsia-500/16 text-white' : 'border-white/10 bg-black/18 text-fuchsia-100/72 hover:border-fuchsia-300/24 hover:bg-fuchsia-500/8'}`}><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold">{option.label}</div><span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${selected ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-black/18 text-fuchsia-100/58'}`}>{option.eyebrow}</span></div><div className="mt-1 text-xs leading-5 opacity-82">{option.summary}</div></button>);
                                        })}
                                    </div>
                                    <div className="mt-3 rounded-xl border border-fuchsia-300/15 bg-fuchsia-500/[0.06] px-3 py-2 text-xs leading-5 text-fuchsia-100/72">
                                        Eligible Rooms get one separate <strong className="text-fuchsia-50">BeauBucks cosmetics</strong> switch after creation. It never changes Points or performance scoring.
                                    </div>
                                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3" data-launch-economy-preview="true">
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-100/58">What guests experience</div>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                            {launchEconomySummary.cards.map((card) => (
                                                <div key={card.id} className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
                                                    <div className="text-[9px] uppercase tracking-[0.15em] text-fuchsia-100/48">{card.eyebrow}</div>
                                                    <div className="mt-1 text-xs font-semibold text-white">{card.value}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {launchEconomySummary.warnings.length ? <div className="mt-2 text-xs text-amber-200">Review: {launchEconomySummary.warnings.join(' ')}</div> : null}
                                    </div>
                                </section>

                                <section className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Launch summary</div>
                                    <div className="mt-1 text-sm text-cyan-100/66">Confirm the room guests will enter first. Everything below can still be adjusted from the host panel.</div>
                                    <div className="mt-3 flex flex-wrap gap-2">{launchSummaryItems.map((item) => (<span key={item} className="rounded-full border border-white/10 bg-black/24 px-3 py-1.5 text-xs text-cyan-50/82">{item}</span>))}</div>
                                    <div className="mt-3 grid gap-2" data-launch-effective-behavior="true">
                                        {launchEffectiveBehavior.domains.map((domain) => (
                                            <div key={domain.key} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5" data-launch-effective-domain={domain.key}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/58">{domain.label}</div>
                                                    <div className="max-w-[46%] truncate text-[9px] uppercase tracking-[0.12em] text-zinc-500" title={domain.provenance?.sourceLabel || 'Launch plan'}>From {domain.provenance?.sourceLabel || 'launch plan'}</div>
                                                </div>
                                                <div className="mt-1 text-xs leading-5 text-cyan-50/82">{domain.summary}</div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="grid gap-2">
                                    <button type="button" data-host-create-room-primary="true" onClick={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'stage', nightPresetPayload: launchPresetPayloadPreview, audienceJoinPasscode: normalizedLaunchJoinPasscode })} disabled={roomLaunchDisabled} className={`${STYLES.btnStd} ${STYLES.btnHighlight} w-full justify-center px-4 py-3 text-[11px] uppercase tracking-[0.18em] ${roomLaunchDisabled ? 'cursor-not-allowed opacity-60' : ''}`}>{creatingRoom ? 'Creating room...' : 'Create + Open Host Panel'}</button>
                                    <details className="rounded-xl border border-white/10 bg-black/18 px-3 py-2">
                                        <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.16em] text-cyan-100/62">Planning ahead?</summary>
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                            <div className="text-sm text-cyan-100/66">Create the room and open the Show Plan when you want to sequence moments before guests arrive.</div>
                                            <button type="button" onClick={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'show', nightPresetPayload: launchPresetPayloadPreview, audienceJoinPasscode: normalizedLaunchJoinPasscode })} disabled={roomLaunchDisabled} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-[10px] uppercase tracking-[0.18em] ${roomLaunchDisabled ? 'cursor-not-allowed opacity-60' : ''}`}>Create + Prepare Room</button>
                                        </div>
                                    </details>
                                    <div className="text-xs text-cyan-100/58">Room creation stays focused on launch decisions. Use the host panel for detailed room settings, rewards tuning, and show planning.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="mt-4 space-y-3">
                {entryError ? (
                    <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-left text-xs text-rose-200">
                        <div>{entryError}</div>
                        <button type="button" onClick={retryLastHostAction} className="mt-2 inline-flex items-center rounded-full border border-rose-300/40 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-rose-100">
                            Retry last action
                        </button>
                    </div>
                ) : null}
                {hostUpdateDeploymentBanner ? <div>{hostUpdateDeploymentBanner}</div> : null}
            </div>
        </div>
        {activeJoinPosterRoom?.audienceUrl ? (
            <RoomJoinPosterModal
                roomCode={activeJoinPosterRoom.code}
                roomName={activeJoinPosterRoom.roomName || activeJoinPosterRoom.discoverTitle || activeJoinPosterRoom.code}
                audienceUrl={activeJoinPosterRoom.audienceUrl}
                logoUrl={activeJoinPosterRoom.logoUrl}
                audienceBrandTheme={activeJoinPosterRoom.audienceBrandTheme}
                onClose={() => setJoinPosterRoom(null)}
            />
        ) : null}
    </div>
    );
};

export default HostRoomLaunchPadBrowser;
