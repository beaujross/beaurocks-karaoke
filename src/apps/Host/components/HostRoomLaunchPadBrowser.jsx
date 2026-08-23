import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
    HOSTING_LEVEL_IDS,
    NIGHT_EXPERIENCE_IDS,
    ORIGINAL_TRACK_LYRICS_POLICIES,
    compileNightPlanToLegacySettings,
} from '../../../lib/nightPlan.js';
import RoomJoinPosterModal from './RoomJoinPosterModal';
import MissionSetupPrimaryPicks from './setup/MissionSetupPrimaryPicks';
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
const launchInputClass = 'mt-2 min-h-[52px] w-full rounded-[0.95rem] border border-white/10 bg-slate-950/60 px-4 py-3 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] outline-none transition placeholder:text-cyan-100/28 hover:border-cyan-300/20 focus:border-cyan-300/55 focus:bg-slate-950/78 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]';
const REQUEST_POLICY_OPTIONS = [
    { id: REQUEST_MODES.canonicalOpen, label: 'Host Review First' },
    { id: REQUEST_MODES.guestBackingOptional, label: 'Guest Picks Backing' },
    { id: REQUEST_MODES.playableOnly, label: 'Playable Library Only' },
];
const QUEUE_ROTATION_OPTIONS = [
    { id: 'round_robin', label: 'Round Robin' },
    { id: 'first_come', label: 'First Come' },
];
const QUEUE_LIMIT_OPTIONS = [
    { id: 'none', label: 'No limit' },
    { id: 'per_night', label: 'Per singer' },
    { id: 'per_hour', label: 'Per hour' },
    { id: 'soft', label: 'Soft limit' },
];
const ROOM_BROWSER_SORT_OPTIONS = Object.freeze([
    { id: 'newest', label: 'Newest Rooms First' },
    { id: 'recent', label: 'Recently Active' },
    { id: 'upcoming', label: 'Upcoming First' },
    { id: 'name', label: 'Room Name' },
]);
const ROOM_BROWSER_BUCKET_VISUALS = Object.freeze({
    ready: { icon: 'fa-bolt', tone: 'from-emerald-300 to-cyan-300', glow: 'shadow-[0_8px_22px_rgba(52,211,153,0.16)]' },
    upcoming: { icon: 'fa-clock', tone: 'from-cyan-300 to-sky-400', glow: 'shadow-[0_8px_22px_rgba(34,211,238,0.16)]' },
    past: { icon: 'fa-box-archive', tone: 'from-violet-300 to-fuchsia-400', glow: 'shadow-[0_8px_22px_rgba(192,132,252,0.16)]' },
    all: { icon: 'fa-folder-open', tone: 'from-amber-300 to-pink-400', glow: 'shadow-[0_8px_22px_rgba(251,191,36,0.16)]' },
});
const ROOM_SETUP_TABS = Object.freeze([
    {
        id: 'manage',
        label: 'Existing Rooms',
        icon: 'fa-rectangle-history-circle-plus',
        helper: 'Reopen, pin, archive, or clean up rooms you already created.',
        badgeToneClass: 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
    },
    {
        id: 'create',
        label: 'Create Room',
        icon: 'fa-sparkles',
        helper: 'Name it, choose access, and start.',
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
        label: 'Host Assist',
        eyebrow: 'Assisted',
        summary: 'BeauRocks keeps things moving while you can step in anytime.',
        details: ['Full songs', 'Auto-DJ assist', 'Host can step in anytime'],
        icon: 'fa-wand-magic-sparkles',
    },
    {
        id: 'crowd_driven',
        label: 'Self-Serve',
        eyebrow: 'Supervised',
        summary: 'Guests drive supported parts of the experience while you supervise.',
        details: ['Guest-led choices', 'Auto-DJ on', 'Host can step in'],
        icon: 'fa-people-group',
    },
]);
const LAUNCH_NIGHT_TYPE_OPTIONS = Object.freeze([
    {
        id: 'party_karaoke',
        experienceId: NIGHT_EXPERIENCE_IDS.karaoke,
        label: 'Karaoke',
        eyebrow: 'Easygoing',
        summary: 'Open song search, a relaxed queue, and help filling quiet moments.',
        presetId: 'casual',
        operatingModel: 'assisted_host',
        economyMode: 'standard',
        flowRule: 'balanced',
        assistLevel: 'smart_assist',
        spotlightMode: 'karaoke',
        performanceMode: 'karaoke',
        party: { autoCrowdMomentsEnabled: false },
        icon: 'fa-microphone-lines',
        effects: ['Balanced turns', 'Scoring off', 'Auto-DJ assist'],
    },
    {
        id: 'original_track_party',
        experienceId: NIGHT_EXPERIENCE_IDS.originalTracks,
        label: 'Original Track Party',
        eyebrow: 'Full recordings',
        summary: 'Sing along or lip sync to original recordings, with lyrics when available.',
        presetId: 'casual',
        operatingModel: 'assisted_host',
        economyMode: 'standard',
        flowRule: 'balanced',
        assistLevel: 'smart_assist',
        spotlightMode: 'karaoke',
        performanceMode: 'sing_along',
        lyricsPolicy: ORIGINAL_TRACK_LYRICS_POLICIES.whenAvailable,
        requirements: { originalRecording: true, lyrics: 'preferred' },
        party: { autoCrowdMomentsEnabled: false },
        icon: 'fa-people-group',
        settingsOverrides: { showScoring: false, showLyricsTv: true, autoLyricsOnQueue: true },
        effects: ['Original tracks', 'Lyrics when available', 'Scoring off'],
    },
    {
        id: 'trivia_night',
        experienceId: NIGHT_EXPERIENCE_IDS.trivia,
        label: 'Trivia Night',
        eyebrow: 'Question session',
        summary: 'Load an ordered question set, then control answers, reveals, and scoring.',
        presetId: 'casual',
        operatingModel: 'host_led',
        economyMode: 'standard',
        flowRule: 'host_paced',
        assistLevel: 'manual_first',
        spotlightMode: 'trivia',
        performanceMode: 'karaoke',
        party: { autoCrowdMomentsEnabled: false },
        icon: 'fa-lightbulb',
        settingsOverrides: { gamePreviewId: 'trivia', popTriviaEnabled: false },
        effects: ['Ordered questions', 'Host-paced reveals', 'Room scoring'],
    },
    {
        id: 'would_you_rather_night',
        experienceId: NIGHT_EXPERIENCE_IDS.wouldYouRather,
        label: 'Would You Rather',
        eyebrow: 'Prompt session',
        summary: 'Load an ordered prompt set, then move the room through live choices and results.',
        presetId: 'casual',
        operatingModel: 'host_led',
        economyMode: 'standard',
        flowRule: 'host_paced',
        assistLevel: 'manual_first',
        spotlightMode: 'would_you_rather',
        performanceMode: 'karaoke',
        party: { autoCrowdMomentsEnabled: false },
        icon: 'fa-code-compare',
        settingsOverrides: { gamePreviewId: 'would_you_rather', popTriviaEnabled: false },
        effects: ['Ordered prompts', 'Live voting', 'Room results'],
    },
]);
const LAUNCH_NIGHT_TYPE_RECIPE_CARDS = Object.freeze(LAUNCH_NIGHT_TYPE_OPTIONS.map((option) => Object.freeze({
    ...option,
    description: option.summary,
    accent: option.id === 'trivia_night'
        ? 'from-amber-500/26 via-yellow-500/8 to-transparent'
        : option.id === 'would_you_rather_night'
            ? 'from-emerald-500/24 via-cyan-500/8 to-transparent'
            : option.id === 'original_track_party'
                ? 'from-fuchsia-500/24 via-violet-500/8 to-transparent'
                : 'from-cyan-500/24 via-sky-500/8 to-transparent',
})));
const LAUNCH_INTERMISSION_TYPE_OPTIONS = Object.freeze([
    { id: 'trivia', label: 'Trivia', icon: 'fa-lightbulb' },
    { id: 'would_you_rather', label: 'Would You Rather', icon: 'fa-shuffle' },
    { id: 'ready_check', label: 'Ready Check', icon: 'fa-circle-check' },
    { id: 'volley', label: 'Volley Orb', icon: 'fa-circle-nodes' },
]);
const normalizeLaunchParty = (value = {}) => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const preferredTypes = Array.isArray(source.autoCrowdMomentPreferredTypes)
        ? source.autoCrowdMomentPreferredTypes.filter((type) => LAUNCH_INTERMISSION_TYPE_OPTIONS.some((option) => option.id === type))
        : [];
    return {
        karaokeFirst: source.karaokeFirst !== false,
        minSingingSharePct: Math.max(50, Math.min(95, Number(source.minSingingSharePct || 70) || 70)),
        maxBreakDurationSec: Math.max(3, Math.min(120, Number(source.maxBreakDurationSec || 20) || 20)),
        maxConsecutiveNonKaraokeModes: Math.max(1, Math.min(4, Number(source.maxConsecutiveNonKaraokeModes || 1) || 1)),
        autoCrowdMomentsEnabled: source.autoCrowdMomentsEnabled === true,
        autoCrowdMomentEverySongs: Math.max(1, Math.min(5, Number(source.autoCrowdMomentEverySongs || 3) || 3)),
        autoCrowdMomentPreferredTypes: preferredTypes.length ? preferredTypes : ['trivia', 'would_you_rather'],
    };
};
const getLaunchAssistLevel = (operatingModel = 'assisted_host') => (
    operatingModel === 'host_led'
        ? 'manual_first'
        : operatingModel === 'crowd_driven' ? 'autopilot_first' : 'smart_assist'
);

const getOptionLabel = (options = [], id = '', fallback = 'Default') => (
    options.find((option) => option.id === id)?.label || fallback
);

const countObjectLeaves = (value = {}) => Object.values(value || {}).reduce((count, entry) => (
    entry && typeof entry === 'object' && !Array.isArray(entry)
        ? count + countObjectLeaves(entry)
        : count + 1
), 0);

const countChangedKeys = (current = {}, baseline = {}, keys = []) => keys.reduce((count, key) => (
    JSON.stringify(current?.[key]) === JSON.stringify(baseline?.[key]) ? count : count + 1
), 0);

const buildLaunchOperatingModelSettings = (modelId = 'host_led') => {
    const safeModel = ['host_led', 'assisted_host', 'crowd_driven'].includes(String(modelId || '').trim().toLowerCase())
        ? String(modelId || '').trim().toLowerCase()
        : 'host_led';
    return {
        autoDj: safeModel !== 'host_led',
        oneMinuteMicEnabled: false,
        performanceProgressionMode: 'full_song',
        oneMinuteMicOpeningWindowSec: 60,
        oneMinuteMicVoteWindowSec: 12,
    };
};

const getLaunchHostingLevel = (modelId = 'host_led') => (
    modelId === 'crowd_driven'
        ? HOSTING_LEVEL_IDS.selfServe
        : modelId === 'assisted_host'
            ? HOSTING_LEVEL_IDS.assisted
            : HOSTING_LEVEL_IDS.hostLed
);

const formatPresetQueueSummary = (queueSettings = {}) => {
    const limitMode = String(queueSettings?.limitMode || 'none');
    const rotation = String(queueSettings?.rotation || 'round_robin');
    const limitCount = Math.max(0, Number(queueSettings?.limitCount || 0));
    const limit = limitMode === 'none'
        ? 'Open queue'
        : limitMode === 'soft'
            ? `${limitCount || 'Set'} suggested per singer`
            : `${limitCount || 'Set'} ${limitMode === 'per_hour' ? 'per hour' : 'per singer tonight'}`;
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
    activeRoomCode = '',
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
    roomSetupHandoffToken = 0,
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
    const createRoomSectionRef = useRef(null);
    const launchReviewRef = useRef(null);
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
    const launchReadinessMessage = creatingRoom
        ? 'Creating the room and applying this setup.'
        : !launchPasscodeValid
        ? 'Add a guest passcode with at least 4 letters or numbers.'
        : launchDisabled && !String(launchRoomName || '').trim()
            ? 'Add a room name in step 1 to continue.'
        : launchDisabled
            ? 'Review the highlighted required detail above.'
            : 'Setup is complete. Room Settings remains available for future changes.';
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
    const recoveredNightTypeToken = String(recoveredExperienceDraft?.nightType || '').trim();
    const recoveredNightTypeAliases = {
        crowd_singalong: 'original_track_party',
        lip_sync_night: 'original_track_party',
        score_challenge: 'party_karaoke',
        karaoke_trivia: 'party_karaoke',
    };
    const recoveredNightTypeCandidate = recoveredNightTypeAliases[recoveredNightTypeToken] || recoveredNightTypeToken;
    const recoveredNightType = LAUNCH_NIGHT_TYPE_OPTIONS.some(
        (option) => option.id === recoveredNightTypeCandidate,
    ) ? recoveredNightTypeCandidate : 'party_karaoke';
    const [launchOperatingModel, setLaunchOperatingModel] = useState(recoveredOperatingModel);
    const [launchNightType, setLaunchNightType] = useState(recoveredNightType);
    const recoveredNightTypeOption = LAUNCH_NIGHT_TYPE_OPTIONS.find((option) => option.id === recoveredNightType) || LAUNCH_NIGHT_TYPE_OPTIONS[0];
    const [launchLyricsPolicy, setLaunchLyricsPolicy] = useState(() => (
        Object.values(ORIGINAL_TRACK_LYRICS_POLICIES).includes(recoveredExperienceDraft?.lyricsPolicy)
            ? recoveredExperienceDraft.lyricsPolicy
            : recoveredNightTypeOption?.lyricsPolicy || ORIGINAL_TRACK_LYRICS_POLICIES.whenAvailable
    ));
    const [launchParty, setLaunchParty] = useState(() => normalizeLaunchParty(
        recoveredExperienceDraft?.party || recoveredNightTypeOption?.party || {},
    ));
    const [launchMediaSources, setLaunchMediaSources] = useState(() => normalizeLaunchMediaSources(
        recoveredExperienceDraft?.mediaSources
        || selectedLaunchPreset?.searchSources
    ));
    const [launchSettingsOverrides, setLaunchSettingsOverrides] = useState(() => (
        recoveredExperienceDraft?.settingsOverrides
        && typeof recoveredExperienceDraft.settingsOverrides === 'object'
        && !Array.isArray(recoveredExperienceDraft.settingsOverrides)
            ? recoveredExperienceDraft.settingsOverrides
            : {}
    ));
    const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
    const [advancedSetupSection, setAdvancedSetupSection] = useState('flow');
    useEffect(() => {
        const experienceIsDefault = launchJoinAccessMode === AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed
            && launchOperatingModel === 'assisted_host'
            && launchNightType === 'party_karaoke'
            && launchParty.karaokeFirst !== false
            && launchParty.minSingingSharePct === 70
            && launchParty.maxBreakDurationSec === 20
            && launchParty.maxConsecutiveNonKaraokeModes === 1
            && launchParty.autoCrowdMomentsEnabled !== true
            && launchMediaSources.local
            && launchMediaSources.youtube
            && launchMediaSources.itunes
            && Object.keys(launchSettingsOverrides || {}).length === 0;
        if (experienceIsDefault) {
            clearHostLaunchDraftPart(launchExperienceDraftKey);
            return;
        }
        persistHostLaunchDraftPart(launchExperienceDraftKey, {
            joinAccessMode: launchJoinAccessMode,
            operatingModel: launchOperatingModel,
            nightType: launchNightType,
            lyricsPolicy: launchLyricsPolicy,
            party: launchParty,
            mediaSources: launchMediaSources,
            settingsOverrides: launchSettingsOverrides,
        });
    }, [launchExperienceDraftKey, launchJoinAccessMode, launchLyricsPolicy, launchMediaSources, launchNightType, launchOperatingModel, launchParty, launchSettingsOverrides]);
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
    const selectedNightTypePreset = presets.find((preset) => preset.id === selectedNightType?.presetId) || selectedLaunchPreset || {};
    const launchNightPlanSettings = compileNightPlanToLegacySettings({
        experienceId: selectedNightType?.experienceId || NIGHT_EXPERIENCE_IDS.karaoke,
        hostingLevel: getLaunchHostingLevel(launchOperatingModel),
        experienceConfig: {
            originalTracks: {
                lyricsPolicy: launchLyricsPolicy,
            },
        },
        source: 'room_creation',
    });
    const buildLaunchPresetPayload = (settingsOverrideInput = launchSettingsOverrides) => buildHostNightPresetConfig({
        ...(selectedNightTypePreset || {}),
        searchSources: launchMediaSources,
        recipe: {
            flowRule: selectedNightType?.flowRule || 'balanced',
            assistLevel: getLaunchAssistLevel(launchOperatingModel),
            spotlightMode: selectedNightType?.spotlightMode || 'karaoke',
            performanceMode: selectedNightType?.performanceMode || 'karaoke',
            requirements: { ...(selectedNightType?.requirements || {}) },
            overrides: { ...(selectedNightType?.settingsOverrides || {}) },
            party: { ...launchParty },
        },
        settings: {
            ...(selectedNightTypePreset?.settings || {}),
            ...buildLaunchOperatingModelSettings(launchOperatingModel),
            ...launchNightPlanSettings,
            ...(selectedNightType?.settingsOverrides || {}),
            ...(settingsOverrideInput || {}),
            queueSettings: {
                ...(selectedNightTypePreset?.settings?.queueSettings || {}),
                ...(selectedNightType?.settingsOverrides?.queueSettings || {}),
                ...(settingsOverrideInput?.queueSettings || {}),
            },
            audienceJoinPolicy: {
                ...normalizeAudienceJoinPolicy(selectedNightTypePreset?.settings?.audienceJoinPolicy || {}),
                accessMode: launchJoinAccessMode,
            },
        },
    });
    const launchPresetPayloadBaseline = buildLaunchPresetPayload({});
    const launchPresetPayloadPreview = buildLaunchPresetPayload();
    const launchBaselineSettings = launchPresetPayloadBaseline?.settings || {};
    const launchBaselineQueue = launchBaselineSettings.queueSettings || {};
    const launchPreviewSettings = launchPresetPayloadPreview?.settings || {};
    const launchPreviewQueue = launchPreviewSettings.queueSettings || {};
    const launchPartyBaseline = normalizeLaunchParty(selectedNightType?.party || {});
    const launchMediaBaseline = normalizeLaunchMediaSources(selectedNightTypePreset?.searchSources || {});
    const launchCustomizationCount = (launchOperatingModel === selectedNightType?.operatingModel ? 0 : 1)
        + (launchLyricsPolicy === (selectedNightType?.lyricsPolicy || ORIGINAL_TRACK_LYRICS_POLICIES.whenAvailable) ? 0 : 1)
        + countObjectLeaves(launchSettingsOverrides)
        + countChangedKeys(launchParty, launchPartyBaseline, [
            'karaokeFirst',
            'minSingingSharePct',
            'maxBreakDurationSec',
            'maxConsecutiveNonKaraokeModes',
            'autoCrowdMomentsEnabled',
            'autoCrowdMomentEverySongs',
            'autoCrowdMomentPreferredTypes',
        ])
        + countChangedKeys(launchMediaSources, launchMediaBaseline, ['local', 'youtube', 'itunes'])
        + (launchEconomyMode === selectedNightType?.economyMode ? 0 : 1);
    const updateLaunchSetting = (key, value) => {
        setLaunchSettingsOverrides((current) => {
            const next = { ...(current || {}) };
            if (JSON.stringify(value) === JSON.stringify(launchBaselineSettings?.[key])) delete next[key];
            else next[key] = value;
            return next;
        });
    };
    const updateLaunchQueueSetting = (key, value) => {
        setLaunchSettingsOverrides((current) => {
            const nextQueue = { ...(current?.queueSettings || {}) };
            if (JSON.stringify(value) === JSON.stringify(launchBaselineQueue?.[key])) delete nextQueue[key];
            else nextQueue[key] = value;
            const next = { ...(current || {}) };
            if (Object.keys(nextQueue).length) next.queueSettings = nextQueue;
            else delete next.queueSettings;
            return next;
        });
    };
    const updateLaunchPartySetting = (key, value) => {
        setLaunchParty((current) => normalizeLaunchParty({
            ...(current || {}),
            [key]: value,
        }));
    };
    const launchEffectiveBehavior = resolveRoomSetupEffectiveBehavior({
        layers: [
            {
                id: 'launch_plan',
                label: `${selectedNightTypePreset?.label || 'Starting plan'} + ${selectedOperatingModelOption.label}`,
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
        selectedNightType?.label || 'Party Karaoke',
        selectedOperatingModelOption?.label,
        formatPresetQueueSummary(launchPreviewQueue),
        launchPreviewSettings.showScoring === false ? 'Scoring off' : 'Scoring on',
        `${getLaunchMediaSourceLabels(launchMediaSources).join(' + ')} search`,
        hasRequestedLaunchRoomCode ? `Code ${requestedLaunchRoomCodeCandidate}` : 'Auto room code',
        discoveryListingEnabled ? 'Discoverable' : 'Private link',
        hasLaunchStartTime ? `Starts ${launchStartSummary}` : 'Starts now',
        selectedJoinOption?.label,
        launchNeedsPasscode ? 'Separate guest passcode' : '',
        selectedEconomyOption?.label,
    ].filter(Boolean);
    const launchPrimarySummaryItems = [
        selectedNightType?.label || 'Party Karaoke',
        selectedOperatingModelOption?.label,
        selectedJoinOption?.label,
        discoveryListingEnabled ? 'Discoverable' : 'Private link',
        hasLaunchStartTime ? `Starts ${launchStartSummary}` : 'Starts now',
        formatPresetQueueSummary(launchPreviewQueue),
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
    const resetLaunchFineTune = () => {
        setLaunchOperatingModel(selectedNightType?.operatingModel || 'assisted_host');
        setLaunchLyricsPolicy(selectedNightType?.lyricsPolicy || ORIGINAL_TRACK_LYRICS_POLICIES.whenAvailable);
        setLaunchSettingsOverrides({});
        setLaunchParty(launchPartyBaseline);
        setLaunchMediaSources(launchMediaBaseline);
        applyLaunchEconomy(selectedNightType?.economyMode || 'standard');
    };
    const updateLaunchPointSettings = (patch = {}) => {
        setEventCreditsConfig((prev) => {
            const current = prev && typeof prev === 'object' ? prev : {};
            const hasActiveEconomy = current.enabled === true && String(current.presetId || '') !== 'off';
            return {
                ...current,
                enabled: true,
                presetId: hasActiveEconomy ? current.presetId : 'custom_event_credits',
                eventLabel: String(current.eventLabel || '').trim() || `${launchRoomSummaryName} Points`,
                generalAdmissionPoints: Math.max(0, Number(current.generalAdmissionPoints || 0)),
                timedLobbyEnabled: current.timedLobbyEnabled === true,
                timedLobbyPoints: Math.max(0, Number(current.timedLobbyPoints || 0)),
                timedLobbyIntervalMin: Math.max(1, Number(current.timedLobbyIntervalMin || 10)),
                timedLobbyMaxPerGuest: Math.max(0, Number(current.timedLobbyMaxPerGuest || 0)),
                ...patch,
            };
        });
    };
    const applyLaunchNightType = (nightTypeId = 'party_karaoke') => {
        const option = LAUNCH_NIGHT_TYPE_OPTIONS.find((entry) => entry.id === nightTypeId) || LAUNCH_NIGHT_TYPE_OPTIONS[0];
        setLaunchNightType(option.id);
        setLaunchOperatingModel(option.operatingModel);
        setLaunchLyricsPolicy(option.lyricsPolicy || ORIGINAL_TRACK_LYRICS_POLICIES.whenAvailable);
        setLaunchParty(normalizeLaunchParty(option.party || {}));
        setLaunchSettingsOverrides({});
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
        if (!roomSetupHandoffToken) return undefined;
        if (typeof window === 'undefined') return undefined;
        let focusTimer = null;
        const modeTimer = window.setTimeout(() => {
            setRoomSetupMode('create');
            focusTimer = window.setTimeout(() => {
                createRoomSectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                createRoomSectionRef.current
                    ?.querySelector('[data-launch-room-identity] input')
                    ?.focus();
            }, 0);
        }, 0);
        return () => {
            window.clearTimeout(modeTimer);
            if (focusTimer !== null) window.clearTimeout(focusTimer);
        };
    }, [roomSetupHandoffToken]);
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
    const normalizedActiveRoomCode = String(activeRoomCode || '').trim().toUpperCase();
    const timedPointsRefillEnabled = eventCreditsConfig?.timedLobbyEnabled === true;
    const getRoomSetupTabButtonClass = (active = false) => (
        `host-brand-tab px-3 py-2 text-xs font-black uppercase tracking-[0.13em] ${
            active ? 'is-active' : ''
        }`
    );

    return (
    <div className="relative z-10 mx-auto w-full max-w-[1680px] scroll-mt-4" data-host-workspace-shell="room-setup">
        <div className="rounded-[1.35rem] bg-[radial-gradient(circle_at_85%_6%,rgba(236,72,153,0.09),transparent_28%),linear-gradient(145deg,rgba(22,36,58,0.94),rgba(12,18,31,0.98))] p-1 text-left shadow-[0_24px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:p-1.5">
            <div className="relative overflow-hidden rounded-[1.1rem] border border-cyan-200/18 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.16),transparent_36%),radial-gradient(circle_at_100%_0%,rgba(236,72,153,0.14),transparent_38%),rgba(8,15,28,0.82)] p-2.5 sm:p-3" data-room-setup-compact-header="true">
                <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 lg:flex lg:items-center">
                    <div className="flex min-w-0 items-center gap-2.5 lg:w-[245px] lg:shrink-0">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] border border-cyan-200/28 bg-gradient-to-br from-cyan-300/20 to-fuchsia-400/16 text-cyan-100 shadow-[0_8px_22px_rgba(34,211,238,0.12)]">
                            <i className="fa-solid fa-door-open" />
                        </span>
                        <div className="min-w-0">
                            <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/55">Room operations</div>
                            <div className="text-lg font-black leading-tight text-white">Room Setup</div>
                            <div className="truncate text-xs text-cyan-100/58">{activeRoomSetupTab.helper}</div>
                        </div>
                    </div>
                    <div className="host-brand-tabs host-brand-tabs--fill host-brand-tabs--workspace order-3 col-span-2 min-w-0 lg:order-none lg:col-span-1 lg:flex-1" role="tablist" aria-label="Room setup workspace">
                    {ROOM_SETUP_TABS.map((tab) => {
                        const active = roomSetupMode === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setRoomSetupMode(tab.id)}
                                className={getRoomSetupTabButtonClass(active)}
                            >
                                <i className={`fa-solid ${tab.icon} text-xs`} />
                                <span>{tab.label}</span>
                                {tab.id === 'manage' ? (
                                    <span className={`rounded-full border px-1.5 py-0.5 text-xs ${tab.badgeToneClass}`}>
                                        {recentHostRoomsLoading ? '...' : existingRoomCount}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                    </div>
                    <div className="flex min-h-[40px] flex-wrap items-center justify-end gap-1.5">
                        {!normalizedActiveRoomCode ? (
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${launchStateTone}`}>
                                <i className={`fa-solid ${launchAccessPending ? 'fa-circle-notch animate-spin' : 'fa-bolt'}`} />
                                {launchAccessPending ? 'Syncing access' : launchState}
                            </span>
                        ) : null}
                        {normalizedActiveRoomCode ? (
                            <button
                                type="button"
                                onClick={() => openExistingRoomWorkspace(normalizedActiveRoomCode, 'queue.live_run')}
                                className={`${STYLES.btnStd} ${STYLES.btnHighlight} min-h-[44px] px-3 py-1.5 text-xs uppercase tracking-[0.12em]`}
                            >
                                <i className="fa-solid fa-arrow-left" />
                                Return to {normalizedActiveRoomCode}
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
            <div className="mt-2 space-y-3">

                {manageModeActive ? (
                    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
                        <aside className="relative order-1 overflow-hidden rounded-[1.25rem] border border-cyan-200/16 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(236,72,153,0.1),transparent_34%),rgba(0,0,0,0.22)] p-3 xl:col-span-2 xl:row-start-1" data-room-browser-visual-shelf="true">
                            <div className="relative flex flex-wrap items-center justify-between gap-3 px-1">
                                <div className="flex items-center gap-2.5">
                                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-200/25 bg-gradient-to-br from-cyan-300/22 to-fuchsia-400/18 text-cyan-100"><i className="fa-solid fa-music" /></span>
                                    <div><div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/52">Your room shelf</div><div className="text-lg font-black text-white">Pick up where you left off</div></div>
                                </div>
                                <div className="max-w-xl text-sm text-cyan-100/62">Ready, scheduled, and past rooms stay organized without leaving Room Setup.</div>
                            </div>
                            {existingRoomCount > 0 ? (
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {roomBrowserBuckets.map((bucket) => {
                                    const selected = activeRoomBucket?.id === bucket.id;
                                    const visual = ROOM_BROWSER_BUCKET_VISUALS[bucket.id] || ROOM_BROWSER_BUCKET_VISUALS.all;
                                    return (
                                        <button
                                            key={bucket.id}
                                            type="button"
                                            onClick={() => handleRoomBrowserBucketClick(bucket.id)}
                                            data-room-browser-bucket={bucket.id}
                                            className={`group flex min-h-[72px] w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${selected
                                                ? 'border-cyan-200/35 bg-white/[0.075] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]'
                                                : 'border-white/[0.07] bg-black/16 text-cyan-100/72 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05]'}`}
                                        >
                                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${visual.tone} text-slate-950 ${visual.glow}`}><i className={`fa-solid ${visual.icon}`} /></span>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 text-sm font-black"><span>{bucket.label}</span><span className={`rounded-full border px-1.5 py-0.5 text-xs ${selected ? 'border-white/18 bg-white/10 text-white' : 'border-white/10 bg-black/18 text-cyan-100/58'}`}>{bucket.rooms.length}</span></div>
                                                <div className="mt-0.5 line-clamp-1 text-xs text-cyan-100/48">{bucket.detail}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            ) : (
                            <button
                                type="button"
                                onClick={() => setRoomSetupMode('create')}
                                className="mt-3 flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl bg-cyan-500/10 px-4 py-3 text-left text-cyan-50 ring-1 ring-cyan-200/18 transition hover:bg-cyan-500/15"
                            >
                                <span><span className="block text-sm font-black">Your room shelf is ready</span><span className="mt-0.5 block text-xs text-cyan-100/58">Create your first room; folders appear once there is something to organize.</span></span>
                                <span className="shrink-0 text-xs font-black uppercase tracking-[0.12em]">Create room <i className="fa-solid fa-arrow-right ml-1" /></span>
                            </button>
                            )}
                        </aside>

                        {recentHostRoomsLoading || existingRoomCount > 0 ? (
                        <section ref={roomBrowserResultsRef} className="order-2 min-w-0 overflow-hidden rounded-[1.4rem] border border-cyan-200/14 bg-[radial-gradient(circle_at_0%_0%,rgba(34,211,238,0.08),transparent_30%),rgba(0,0,0,0.24)] xl:col-start-1 xl:row-start-2" data-room-browser-library="true">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                    <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-200/20 bg-cyan-500/10 text-cyan-200"><i className="fa-solid fa-music" /></span>
                                    <div><div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/52">{activeRoomBucket?.label || 'Rooms'} collection</div>
                                    <div className="text-xl font-black text-white">
                                        {recentHostRoomsLoading ? 'Syncing rooms...' : `${roomBrowserResults.length} room${roomBrowserResults.length === 1 ? '' : 's'}`}
                                    </div></div>
                                </div>
                                <div className="flex min-w-full flex-col gap-2 sm:min-w-[520px] sm:flex-row">
                                    <input
                                        value={roomBrowserSearch}
                                        onChange={(e) => setRoomBrowserSearch(e.target.value)}
                                        placeholder="Search by room name, code, preset, or status"
                                        className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-cyan-400/20 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                    />
                                    <details className="group relative min-w-[170px]" data-branded-room-sort="true">
                                        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-cyan-400/20 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white outline-none transition hover:border-cyan-300/40">
                                            <span>{ROOM_BROWSER_SORT_OPTIONS.find((option) => option.id === roomBrowserSort)?.label || 'Sort rooms'}</span>
                                            <i className="fa-solid fa-chevron-down text-xs text-cyan-200/60 transition group-open:rotate-180" />
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
                                                        className={`flex min-h-[44px] w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${selected ? 'bg-cyan-500/16 text-cyan-50' : 'text-zinc-300 hover:bg-white/[0.06] hover:text-white'}`}
                                                    >
                                                        {option.label}
                                                        {selected ? <i className="fa-solid fa-check text-xs text-cyan-300" /> : null}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </details>
                                    {roomBrowserSearch ? (
                                        <button
                                            type="button"
                                            onClick={() => setRoomBrowserSearch('')}
                                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-4 py-2 text-xs uppercase tracking-[0.18em]`}
                                        >
                                            Clear
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            <div className="hidden grid-cols-[minmax(210px,2fr)_104px_104px_150px_minmax(180px,0.8fr)] gap-3 border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-cyan-100/48 md:grid">
                                <div>Room</div>
                                <div>Status</div>
                                <div>Visibility</div>
                                <div>When</div>
                                <div className="text-right">Actions</div>
                            </div>

                            <div className="max-h-[min(720px,calc(100vh-260px))] space-y-2 overflow-y-auto p-2 md:space-y-0 md:p-0">
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
                                            className={`grid cursor-pointer gap-3 rounded-xl border px-3 py-3 transition md:rounded-none md:border-x-0 md:border-t-0 md:px-4 md:grid-cols-[minmax(210px,2fr)_104px_104px_150px_minmax(180px,0.8fr)] ${selected ? 'border-cyan-300/28 bg-[linear-gradient(100deg,rgba(34,211,238,0.12),rgba(236,72,153,0.06))] shadow-[0_10px_26px_rgba(0,0,0,0.16)]' : 'border-white/[0.07] bg-white/[0.025] hover:border-cyan-300/18 hover:bg-white/[0.05]'}`}
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
                                                        <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-xs uppercase tracking-[0.16em] text-amber-100">
                                                            Pinned
                                                        </span>
                                                    ) : null}
                                                    {isAahfRoom(roomItem) ? (
                                                        <span className="rounded-full border border-fuchsia-300/30 bg-fuchsia-500/10 px-2 py-0.5 text-xs uppercase tracking-[0.16em] text-fuchsia-100">
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
                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.16em] ${lifecycle.chipClass}`}>
                                                    {lifecycle.label}
                                                </span>
                                            </div>
                                            <div className="md:self-center">
                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.16em] ${visibility.chipClass}`}>
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
                                                    className={`${STYLES.btnStd} ${selected ? STYLES.btnHighlight : STYLES.btnSecondary} px-3 py-1.5 text-xs uppercase tracking-[0.16em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1.5 text-xs uppercase tracking-[0.16em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                                        className="rounded-full border border-fuchsia-300/28 bg-fuchsia-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-fuchsia-100"
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
                                                    className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em] ${roomPinned ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-white/5 text-cyan-100/76'}`}
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
                                                    className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em] ${(joiningRoom || roomBusy) ? 'cursor-not-allowed opacity-60' : ''} ${roomItem.archived ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-white/5 text-cyan-100/76'}`}
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
                        ) : null}
                        <aside className={`order-3 self-start ${existingRoomCount > 0 ? 'xl:col-start-2 xl:row-start-2 xl:sticky xl:top-4' : 'xl:col-span-2 xl:row-start-2'}`}>
                            <div className={`relative overflow-hidden rounded-[1.4rem] border border-fuchsia-300/20 bg-[radial-gradient(circle_at_100%_0%,rgba(236,72,153,0.16),transparent_38%),radial-gradient(circle_at_0%_100%,rgba(34,211,238,0.1),transparent_42%),linear-gradient(145deg,rgba(10,18,28,0.96),rgba(20,18,38,0.94))] p-4 shadow-[0_20px_48px_rgba(0,0,0,0.28)] ${existingRoomCount > 0 ? '' : 'mx-auto w-full max-w-2xl'}`} data-room-control-deck="true">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="relative flex items-center gap-2.5">
                                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-400 to-cyan-300 text-slate-950 shadow-[0_10px_24px_rgba(236,72,153,0.2)]"><i className="fa-solid fa-sliders" /></span>
                                        <div><div className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-100/52">{existingRoomCount > 0 ? 'Selected room' : 'Have a room code?'}</div><div className="text-xl font-black text-white">{existingRoomCount > 0 ? 'Control deck' : 'Open an existing room'}</div></div>
                                    </div>
                                </div>
                                {selectedRoom ? (
                                    <>
                                        <div className="relative mt-3 overflow-hidden rounded-xl border border-cyan-300/20 bg-[linear-gradient(115deg,rgba(34,211,238,0.12),rgba(236,72,153,0.08))] px-3 py-3">
                                            <div className="text-lg font-black text-white">{selectedRoom.roomName || selectedRoom.code}</div>
                                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-100/58">{selectedRoom.code}</div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.16em] ${selectedRoomLifecycle?.chipClass || 'border-white/10 bg-white/5 text-cyan-100/70'}`}>
                                                    {selectedRoomLifecycle?.label || 'Room'}
                                                </span>
                                                {selectedRoomPinned ? (
                                                    <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-amber-100">Pinned</span>
                                                ) : null}
                                                <span className={`rounded-full border px-2.5 py-1 text-xs uppercase tracking-[0.16em] ${selectedRoomVisibility?.chipClass || 'border-white/10 bg-white/5 text-cyan-100/70'}`}>
                                                    {selectedRoomVisibility?.label || 'Private'}
                                                </span>
                                                {selectedRoomSchedule ? (
                                                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100/70">{selectedRoomSchedule}</span>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="mt-3 grid gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openExistingRoomWorkspace(selectedRoom.code, 'ops.room_setup')}
                                                disabled={joiningRoom}
                                                className={`${STYLES.btnStd} ${STYLES.btnHighlight} w-full px-4 py-2.5 text-xs uppercase tracking-[0.18em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                Room Settings
                                            </button>
                                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                                                <button
                                                    type="button"
                                                    onClick={() => runFeaturedAction(selectedRoomAction?.action || 'live', selectedRoom)}
                                                    disabled={joiningRoom}
                                                    className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-xs uppercase tracking-[0.18em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    {selectedRoomAction?.label || 'Open Host Panel'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openExistingRoomWorkspace(selectedRoom.code, 'show.timeline')}
                                                    disabled={joiningRoom}
                                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-4 py-2 text-xs uppercase tracking-[0.18em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    Show Plan
                                                </button>
                                                {selectedRoom.hasRecap && audienceBase ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => runFeaturedAction('recap', selectedRoom)}
                                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-4 py-2 text-xs uppercase tracking-[0.18em] text-fuchsia-100`}
                                                    >
                                                        View Recap
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
                                            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Recommended next</div>
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
                                                <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/66">Weekly night</div>
                                                <div className="mt-1 text-sm text-cyan-50">
                                                    Next occurrence: {formatRoomSchedule(selectedRoom) || 'Schedule pending'}
                                                </div>
                                                <div className="mt-1 text-xs text-cyan-100/58">Skip only this date; the following week stays scheduled.</div>
                                                <button
                                                    type="button"
                                                    onClick={() => setRoomOccurrenceStatus?.(selectedRoom, 'cancel')}
                                                    disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code || selectedRoom.archived}
                                                    className={'mt-3 rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-amber-100 ' + ((joiningRoom || roomManagerBusyCode === selectedRoom.code || selectedRoom.archived) ? 'cursor-not-allowed opacity-60' : '')}
                                                >
                                                    {roomManagerBusyCode === selectedRoom.code && roomManagerBusyAction === 'skip_occurrence'
                                                        ? 'Skipping'
                                                        : 'Skip This Week'}
                                                </button>
                                            </div>
                                        ) : null}

                                        <details className="mt-3 rounded-xl border border-rose-300/20 bg-rose-500/8 px-3 py-3">
                                            <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.18em] text-rose-100/70">More room actions</summary>
                                            <div className="mt-3 text-sm text-rose-50/88">Archive rooms you want to keep, reset closed rooms you want to reuse, or permanently delete archived rooms you no longer need.</div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => togglePinnedRoom?.(selectedRoom.code)}
                                                    className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em] ${selectedRoomPinned ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-white/5 text-cyan-100/76'}`}
                                                >
                                                    {selectedRoomPinned ? 'Pinned Room' : 'Pin Room'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => (selectedRoom.archived ? setRoomArchivedState?.(selectedRoom.code, false) : setRoomArchivedState?.(selectedRoom.code, true))}
                                                    disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code}
                                                    className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.16em] ${(joiningRoom || roomManagerBusyCode === selectedRoom.code) ? 'cursor-not-allowed opacity-60' : ''} ${selectedRoom.archived ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-white/10 bg-white/5 text-cyan-100/76'}`}
                                                >
                                                    {selectedRoom.archived ? 'Restore Room' : 'Archive Room'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRoomDiscoverability?.(selectedRoom, !selectedRoom.publicRoom)}
                                                    disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code || selectedRoom.archived}
                                                    className={`rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-cyan-100 ${(joiningRoom || roomManagerBusyCode === selectedRoom.code || selectedRoom.archived) ? 'cursor-not-allowed opacity-60' : ''}`}
                                                >
                                                    {selectedRoom.publicRoom ? 'Make Private' : 'Make Discoverable'}
                                                </button>
                                                {Number(selectedRoom.closedAtMs || 0) > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => runLandingRoomCleanup?.(selectedRoom.code)}
                                                        disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code}
                                                        className={`rounded-full border border-rose-300/28 bg-rose-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-rose-100 ${(joiningRoom || roomManagerBusyCode === selectedRoom.code) ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        Reset Room
                                                    </button>
                                                ) : null}
                                                {selectedRoom.hasRecap && audienceBase ? (
                                                    <button type="button" onClick={() => runFeaturedAction('recap', selectedRoom)} className="rounded-full border border-fuchsia-300/28 bg-fuchsia-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-fuchsia-100">Open Recap</button>
                                                ) : null}
                                                {!selectedRoom.archived ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => resetRoomToCurrentTemplate?.(selectedRoom)}
                                                        disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code}
                                                        className={`rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-cyan-100/76 ${(joiningRoom || roomManagerBusyCode === selectedRoom.code) ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        Reset to Template
                                                    </button>
                                                ) : null}
                                                {isAahfRoom(selectedRoom) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => seedAahfKickoffRoom?.(selectedRoom)}
                                                        disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code}
                                                        className={`rounded-full border border-fuchsia-300/28 bg-fuchsia-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-fuchsia-100 ${(joiningRoom || roomManagerBusyCode === selectedRoom.code) ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        Seed Kickoff
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    onClick={() => setJoinPosterRoom(selectedRoom)}
                                                    disabled={!audienceBase}
                                                    className={`rounded-full border border-cyan-300/28 bg-cyan-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-cyan-100 ${!audienceBase ? 'cursor-not-allowed opacity-60' : ''}`}
                                                >
                                                    Join Poster
                                                </button>
                                                {selectedRoom.archived && canPermanentlyDeleteRooms ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => runLandingRoomPermanentDelete?.(selectedRoom.code)}
                                                        disabled={joiningRoom || roomManagerBusyCode === selectedRoom.code}
                                                        className={`rounded-full border border-rose-300/28 bg-rose-500/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-rose-100 ${(joiningRoom || roomManagerBusyCode === selectedRoom.code) ? 'cursor-not-allowed opacity-60' : ''}`}
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
                                ) : existingRoomCount > 0 ? (
                                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm text-cyan-100/68">
                                        Select a room from the browser to manage settings, open the host panel, archive it, or clean it up.
                                    </div>
                                ) : null}

                                <details className="mt-3 rounded-xl border border-cyan-300/18 bg-cyan-500/8 px-3 py-3" {...(!selectedRoom ? { open: true } : {})}>
                                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-xs uppercase tracking-[0.18em] text-cyan-100/58">Open by room code</summary>
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
                                            className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-cyan-400/20 bg-black/30 px-3 py-2.5 text-sm uppercase tracking-[0.18em] text-white outline-none transition focus:border-cyan-300/45"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => openExistingRoomWorkspace(launchRoomCodeCandidate, 'queue.live_run')}
                                            disabled={!hasLaunchRoomCode || joiningRoom}
                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} min-h-[44px] px-4 py-2 text-xs uppercase tracking-[0.18em] ${!hasLaunchRoomCode || joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                        ref={createRoomSectionRef}
                        data-room-create-premium="true"
                        className="relative isolate overflow-hidden rounded-[1.5rem] bg-[radial-gradient(circle_at_10%_4%,rgba(34,211,238,0.28),transparent_34%),radial-gradient(circle_at_92%_8%,rgba(244,114,182,0.24),transparent_38%),linear-gradient(145deg,#13243c_0%,#18233e_48%,#351d3d_100%)] p-1 shadow-[0_28px_80px_rgba(8,15,34,0.42)] sm:p-1.5"
                    >
                        <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-24 h-52 w-52 rounded-full bg-fuchsia-500/8 blur-3xl" />
                        <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-0 h-56 w-56 rounded-full bg-cyan-400/8 blur-3xl" />

                        {shouldShowSetupCard ? (
                            <div className="relative mb-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3.5 backdrop-blur-sm">
                                <div className="text-sm font-semibold text-amber-50">Finish host setup first.</div>
                                <div className="mt-1 text-sm text-amber-100/78">
                                    Your workspace and host identity need one quick setup pass before you can create rooms.
                                </div>
                                <button type="button" onClick={openOnboardingWizard} disabled={!canUseWorkspaceOnboarding} className={`${STYLES.btnStd} ${STYLES.btnHighlight} mt-3 px-4 py-2 text-xs uppercase tracking-[0.18em] ${!canUseWorkspaceOnboarding ? 'opacity-60 cursor-not-allowed' : ''}`}>Finish Setup</button>
                            </div>
                        ) : null}

                        <div className="relative overflow-hidden rounded-[1.3rem] bg-[linear-gradient(145deg,rgba(25,43,70,0.98),rgba(52,29,62,0.98))] shadow-[0_20px_54px_rgba(8,15,34,0.34)] ring-1 ring-white/[0.08]" data-launch-core-setup="true">
                            <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[linear-gradient(90deg,rgba(34,211,238,0.08),rgba(9,9,11,0.86),rgba(236,72,153,0.08))] px-3 py-2 sm:px-4" data-launch-create-header="true">
                                <div className="flex min-w-0 items-center gap-2 text-xs text-cyan-100/66">
                                    <i className="fa-solid fa-layer-group text-cyan-300/72" />
                                    <span><strong className="text-cyan-50">One-screen setup</strong><span className="hidden sm:inline"> · Name it, shape the night, choose access, and launch.</span></span>
                                </div>
                                <div className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-black uppercase tracking-[0.1em] ${creatingRoom ? 'border-cyan-300/28 bg-cyan-500/10 text-cyan-50' : roomLaunchDisabled ? 'border-amber-300/24 bg-amber-500/9 text-amber-50' : 'border-emerald-300/24 bg-emerald-500/9 text-emerald-50'}`} data-launch-readiness="true">
                                    <i className={`fa-solid ${creatingRoom ? 'fa-circle-notch animate-spin' : roomLaunchDisabled ? 'fa-pen-to-square' : 'fa-circle-check'}`} />
                                    {creatingRoom ? 'Creating room' : roomLaunchDisabled ? 'Not ready' : 'Ready to create'}
                                </div>
                            </div>
                            <div className="bg-[linear-gradient(150deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] p-3 sm:p-4">
                                {launchDraftRecovered ? (
                                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-emerald-50" role="status">
                                        <i className="fa-solid fa-rotate-left"></i>
                                        Saved choices restored
                                    </div>
                                ) : null}
                                <div className="grid gap-4 xl:grid-cols-12">
                                    <label className="relative block rounded-xl border-l-2 border-cyan-300/55 bg-cyan-500/[0.055] p-4 xl:col-span-12" data-launch-room-identity="true" data-launch-visual-section="identity">
                                        <span className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.16em] text-cyan-100/76"><span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-200/30 bg-gradient-to-br from-cyan-300 to-teal-400 text-xs font-black text-slate-950 shadow-[0_8px_18px_rgba(34,211,238,0.18)]">01</span><span><span className="block text-xs tracking-[0.16em] text-cyan-200/54">First beat</span>Name the room</span></span>
                                            <span className="text-sm text-cyan-100/52">This is what guests and hosts will recognize.</span>
                                        </span>
                                        <input value={launchRoomName} onChange={(e) => setLaunchRoomName(e.target.value)} placeholder="Friday Karaoke" autoFocus className={`${launchInputClass} max-w-3xl`} />
                                    </label>
                                    <div className="relative min-w-0 rounded-xl border-l-2 border-fuchsia-300/55 bg-fuchsia-500/[0.05] p-4 xl:col-span-12" data-launch-room-control="true" data-launch-visual-section="vibe">
                                        <div className="mb-3 flex items-center gap-2.5">
                                            <span className="grid h-9 w-9 place-items-center rounded-xl border border-fuchsia-200/30 bg-gradient-to-br from-fuchsia-400 to-violet-400 text-xs font-black text-white shadow-[0_8px_18px_rgba(236,72,153,0.2)]">02</span>
                                            <span><span className="block text-xs font-black uppercase tracking-[0.16em] text-fuchsia-200/54">Set the vibe</span><span className="text-sm font-black text-white">Shape the night</span></span>
                                        </div>
                                        <MissionSetupPrimaryPicks
                                            recipes={LAUNCH_NIGHT_TYPE_RECIPE_CARDS}
                                            selectedRecipeId={launchNightType}
                                            onApplyRecipe={(recipe) => applyLaunchNightType(recipe.id)}
                                            allowSaveRecipe={false}
                                            selectedRecipeAdjusted={launchCustomizationCount > 0}
                                            wideGrid
                                            title="Room Experience"
                                            description="Choose the main activity guests are joining tonight. Saved variations can be created later without becoming another mode."
                                            footerHint="Then choose how much help BeauRocks should provide."
                                        />
                                        <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]" data-launch-night-controls="true">
                                            <div className="rounded-xl border border-cyan-300/14 bg-black/18 p-2.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-black uppercase tracking-[0.12em] text-cyan-100/72">Hosting Level</span>
                                                    <span className="text-xs text-cyan-100/52">How the night moves forward</span>
                                                </div>
                                                <div className="mt-1.5 grid grid-cols-3 gap-1">
                                                    {LAUNCH_OPERATING_MODEL_OPTIONS.map((option) => {
                                                        const selected = option.id === launchOperatingModel;
                                                        return (
                                                            <button key={option.id} type="button" data-launch-operating-model-quick={option.id} aria-pressed={selected} onClick={() => setLaunchOperatingModel(option.id)} className={`min-h-[48px] rounded-lg border px-2 py-2 text-center text-xs font-bold transition ${selected ? 'border-cyan-300/42 bg-cyan-500/14 text-white' : 'border-white/10 bg-black/18 text-cyan-100/68 hover:border-cyan-300/22'}`}>
                                                                <i className={`fa-solid ${option.icon} mr-1`} />{option.label.replace(' Host', '')}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            {selectedNightType.experienceId === NIGHT_EXPERIENCE_IDS.originalTracks ? (
                                            <div className="rounded-xl border border-fuchsia-300/14 bg-black/18 p-2.5" data-launch-original-track-policy="true">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="text-xs font-black uppercase tracking-[0.12em] text-fuchsia-100/72">Lyrics preference</span>
                                                    <span className="text-xs text-fuchsia-100/52">Original recording is always required</span>
                                                </div>
                                                <div className="mt-1.5 grid gap-1 sm:grid-cols-3">
                                                    {[
                                                        { id: ORIGINAL_TRACK_LYRICS_POLICIES.whenAvailable, label: 'When available', helper: 'Best default' },
                                                        { id: ORIGINAL_TRACK_LYRICS_POLICIES.required, label: 'Required', helper: 'Flag unverified songs' },
                                                        { id: ORIGINAL_TRACK_LYRICS_POLICIES.off, label: 'Off', helper: 'Lip-sync friendly' },
                                                    ].map((option) => {
                                                        const selected = launchLyricsPolicy === option.id;
                                                        return (
                                                            <button key={option.id} type="button" aria-pressed={selected} onClick={() => setLaunchLyricsPolicy(option.id)} className={`min-h-[48px] rounded-lg border px-2 py-2 text-left text-xs transition ${selected ? 'border-fuchsia-300/38 bg-fuchsia-500/16 text-white' : 'border-white/10 bg-black/18 text-zinc-300'}`}>
                                                                <span className="block font-black">{option.label}</span>
                                                                <span className="mt-0.5 block text-[10px] opacity-65">{option.helper}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-2 text-xs leading-5 text-fuchsia-50/62">Apple Music is a playback capability, not the experience itself. Connection and per-song readiness are checked before showtime.</div>
                                            </div>
                                            ) : [NIGHT_EXPERIENCE_IDS.trivia, NIGHT_EXPERIENCE_IDS.wouldYouRather].includes(selectedNightType.experienceId) ? (
                                            <div className="rounded-xl border border-amber-300/18 bg-amber-500/[0.055] p-2.5" data-launch-session-readiness="true">
                                                <div className="flex items-start gap-2.5">
                                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-200/25 bg-amber-400/12 text-amber-200"><i className="fa-solid fa-list-check" /></span>
                                                    <span>
                                                        <span className="block text-xs font-black uppercase tracking-[0.12em] text-amber-100/76">Session readiness</span>
                                                        <span className="mt-1 block text-sm font-black text-white">Add and review the {selectedNightType.experienceId === NIGHT_EXPERIENCE_IDS.trivia ? 'question' : 'prompt'} set after creating the room</span>
                                                        <span className="mt-1 block text-xs leading-5 text-amber-50/64">The live panel will keep the ordered session, current prompt, reveal, and next action together.</span>
                                                    </span>
                                                </div>
                                            </div>
                                            ) : (
                                            <div className="rounded-xl border border-fuchsia-300/14 bg-black/18 p-2.5" data-launch-intermission-program="true">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="text-xs font-black uppercase tracking-[0.12em] text-fuchsia-100/72">Between performances</span>
                                                    <button type="button" aria-pressed={launchParty.autoCrowdMomentsEnabled} onClick={() => setLaunchParty((current) => ({ ...current, autoCrowdMomentsEnabled: current.autoCrowdMomentsEnabled !== true }))} className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${launchParty.autoCrowdMomentsEnabled ? 'border-fuchsia-300/38 bg-fuchsia-500/16 text-white' : 'border-white/10 bg-black/20 text-zinc-300'}`}>
                                                        {launchParty.autoCrowdMomentsEnabled ? 'Activities on' : 'No activities'}
                                                    </button>
                                                </div>
                                                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                                    {LAUNCH_INTERMISSION_TYPE_OPTIONS.map((option) => {
                                                        const selected = launchParty.autoCrowdMomentPreferredTypes.includes(option.id);
                                                        return (
                                                            <button key={option.id} type="button" disabled={!launchParty.autoCrowdMomentsEnabled} aria-pressed={selected} onClick={() => setLaunchParty((current) => {
                                                                const hasType = current.autoCrowdMomentPreferredTypes.includes(option.id);
                                                                const nextTypes = hasType ? current.autoCrowdMomentPreferredTypes.filter((type) => type !== option.id) : [...current.autoCrowdMomentPreferredTypes, option.id];
                                                                return { ...current, autoCrowdMomentPreferredTypes: nextTypes.length ? nextTypes : [option.id] };
                                                            })} className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-bold transition disabled:opacity-35 ${selected ? 'border-fuchsia-300/35 bg-fuchsia-500/13 text-white' : 'border-white/10 bg-black/18 text-zinc-300'}`}>
                                                                <i className={`fa-solid ${option.icon} mr-1`} />{option.label}
                                                            </button>
                                                        );
                                                    })}
                                                    <span className="basis-full text-xs font-bold uppercase tracking-[0.1em] text-zinc-400 sm:ml-auto sm:basis-auto">Every</span>
                                                    {[1, 2, 3, 4, 5].map((count) => (
                                                        <button key={count} type="button" disabled={!launchParty.autoCrowdMomentsEnabled} aria-pressed={launchParty.autoCrowdMomentEverySongs === count} onClick={() => setLaunchParty((current) => ({ ...current, autoCrowdMomentEverySongs: count }))} className={`h-11 w-11 rounded-lg border text-xs font-black disabled:opacity-35 ${launchParty.autoCrowdMomentEverySongs === count ? 'border-fuchsia-300/38 bg-fuchsia-500/16 text-white' : 'border-white/10 bg-black/18 text-zinc-300'}`}>{count}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="relative rounded-xl border-l-2 border-amber-300/55 bg-amber-500/[0.045] p-4 xl:col-span-8" data-launch-guest-access="true" data-launch-visual-section="access">
                                        <span className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.16em] text-cyan-100/76"><span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-200/30 bg-gradient-to-br from-amber-300 to-fuchsia-400 text-xs font-black text-slate-950 shadow-[0_8px_18px_rgba(251,191,36,0.16)]">03</span><span><span className="block text-xs tracking-[0.16em] text-amber-100/54">Open the doors</span>Choose guest access</span></span>
                                        <div className="mt-1 text-sm text-cyan-100/54">Control what guests need before they can enter and participate.</div>
                                        <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                                            {AUDIENCE_JOIN_ACCESS_OPTIONS.map((option) => {
                                                const selected = launchJoinAccessMode === option.id;
                                                const label = option.id === AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed ? 'Open to guests' : option.id === AUDIENCE_JOIN_ACCESS_MODES.accountRequired ? 'Accounts only' : 'Private passcode';
                                                const helper = option.id === AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed ? 'Name + emoji' : option.id === AUDIENCE_JOIN_ACCESS_MODES.accountRequired ? 'Sign-in required' : 'Code + passcode';
                                                const icon = option.id === AUDIENCE_JOIN_ACCESS_MODES.anonymousAllowed ? 'fa-door-open' : option.id === AUDIENCE_JOIN_ACCESS_MODES.accountRequired ? 'fa-user-lock' : 'fa-key';
                                                return (
                                                    <button key={option.id} type="button" aria-pressed={selected} onClick={() => setLaunchJoinAccessMode(option.id)} className={`min-h-[68px] rounded-xl border px-3 py-2.5 text-left transition ${selected ? 'border-cyan-300/42 bg-cyan-500/14 text-white' : 'border-white/10 bg-black/18 text-cyan-100/68 hover:border-cyan-300/24'}`}>
                                                        <span className="flex items-center gap-2.5">
                                                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${selected ? 'border-cyan-200/40 bg-cyan-300 text-slate-950' : 'border-white/10 bg-white/[0.05] text-cyan-100'}`}><i className={`fa-solid ${icon}`} /></span>
                                                            <span><span className="block text-sm font-black">{label}</span><span className="mt-0.5 block text-xs opacity-65">{helper}</span></span>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="rounded-xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07] xl:col-span-4" data-launch-room-privacy="true" data-launch-visual-section="discovery">
                                        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100/70"><i className="fa-solid fa-eye text-cyan-300/72" /> Who can find it?</span>
                                        <div className="mt-2 inline-flex min-h-[58px] w-full rounded-[0.95rem] border border-white/10 bg-slate-950/60 p-1">
                                            <button type="button" onClick={() => setDiscoveryListingMode(false)} aria-pressed={!discoveryListingEnabled} className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${!discoveryListingEnabled ? 'bg-white text-slate-950' : 'text-cyan-100/62 hover:text-white'}`}>Private</button>
                                            <button type="button" onClick={() => setDiscoveryListingMode(true)} aria-pressed={discoveryListingEnabled} className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${discoveryListingEnabled ? 'bg-gradient-to-r from-cyan-300 to-fuchsia-300 text-slate-950' : 'text-cyan-100/62 hover:text-white'}`}>Discover</button>
                                        </div>
                                        <div className="mt-2 text-xs leading-5 text-cyan-100/62">{discoveryListingEnabled ? 'List this Room in Discover. Add an optional start time below.' : 'Only people with the Room code or Audience App link can find it.'}</div>
                                    </div>
                                </div>
                                <div className={`mt-4 grid gap-3 ${launchNeedsPasscode ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`} data-launch-access-details="true">
                                {launchNeedsPasscode ? (
                                    <label className="block rounded-2xl border border-fuchsia-300/16 bg-fuchsia-500/[0.045] p-4">
                                        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100/70"><i className="fa-solid fa-lock text-fuchsia-300/78" /> Guest passcode</span>
                                        <input type="password" value={launchJoinPasscode} onChange={(e) => setLaunchJoinPasscode(String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24))} placeholder="4-24 letters or numbers" minLength={4} maxLength={24} autoComplete="new-password" className={launchInputClass} />
                                        {!launchPasscodeValid ? <div className="mt-2 text-xs text-amber-200">Use at least 4 letters or numbers.</div> : null}
                                    </label>
                                ) : null}
                                <details className="group rounded-2xl border border-white/[0.08] bg-black/18 px-4 py-3 transition open:border-cyan-300/15 open:bg-cyan-500/[0.035]">
                                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-cyan-50/72 transition hover:text-white">
                                        <span className="inline-flex items-center gap-2"><i className="fa-solid fa-hashtag text-cyan-300/58" /> Custom room code <span className="font-normal text-cyan-100/34">Optional</span></span>
                                        <i className="fa-solid fa-chevron-down text-xs text-cyan-100/42 transition group-open:rotate-180" />
                                    </summary>
                                    <label className="mt-4 block max-w-md">
                                        <input value={launchRequestedRoomCode} onChange={(e) => setLaunchRequestedRoomCode(e.target.value.toUpperCase())} placeholder="Choose a memorable code" maxLength={10} className={`${launchInputClass} mt-0 uppercase tracking-[0.18em]`} />
                                        <div className="mt-2 text-xs text-cyan-100/48">Leave blank and we&apos;ll create one.</div>
                                    </label>
                                </details>
                                <details className="group rounded-2xl border border-white/[0.08] bg-black/18 px-4 py-3 transition open:border-cyan-300/15 open:bg-cyan-500/[0.035]" data-launch-schedule="true">
                                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-cyan-50/72 transition hover:text-white">
                                        <span className="inline-flex items-center gap-2"><i className="fa-solid fa-calendar-clock text-cyan-300/58" /> Schedule <span className="font-normal text-cyan-100/34">Optional</span></span>
                                        <i className="fa-solid fa-chevron-down text-xs text-cyan-100/42 transition group-open:rotate-180" />
                                    </summary>
                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Room starts</span>
                                            <input type="datetime-local" value={String(quickLaunchDiscovery?.roomStartsAtLocal || '')} onChange={(event) => setQuickLaunchDiscovery((current) => ({ ...current, roomStartsAtLocal: event.target.value }))} className={`${launchInputClass} mt-1`} />
                                            <span className="mt-1 block text-xs text-cyan-100/48">{hasLaunchStartTime ? launchStartSummary : 'Start now'}</span>
                                        </label>
                                        <label className="block">
                                            <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Repeats</span>
                                            <select value={String(quickLaunchDiscovery?.recurringRule || 'one_time')} onChange={(event) => setQuickLaunchDiscovery((current) => ({ ...current, recurringRule: event.target.value }))} className={`${launchInputClass} mt-1`}>
                                                <option value="one_time">One-time room</option>
                                                <option value="weekly">Weekly night</option>
                                            </select>
                                        </label>
                                    </div>
                                </details>
                                </div>
                                <div className="mt-4 overflow-hidden rounded-2xl border border-violet-300/18 bg-[radial-gradient(circle_at_100%_0%,rgba(139,92,246,0.12),transparent_42%),rgba(9,9,11,0.3)]" data-launch-fine-tune="true" data-launch-visual-section="fine-tune">
                                    <button
                                        type="button"
                                        onClick={() => setShowAdvancedSetup((current) => !current)}
                                        aria-expanded={showAdvancedSetup}
                                        className="flex min-h-[68px] w-full flex-col items-stretch justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.035] sm:flex-row sm:items-center"
                                    >
                                        <span>
                                            <span className="block text-xs font-black uppercase tracking-[0.18em] text-violet-200"><i className="fa-solid fa-wand-magic-sparkles mr-2" />Fine-tune</span>
                                            <span className="mt-0.5 block text-sm font-black text-white">Queue, live controls, song sources, and Points</span>
                                            <span className="mt-0.5 block text-xs text-zinc-400">Optional controls stay on this screen without getting in the way of launch.</span>
                                        </span>
                                        <span className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                                            <span className={`rounded-full border px-2.5 py-1.5 text-xs font-black uppercase tracking-[0.1em] ${launchCustomizationCount > 0 ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-cyan-300/20 bg-cyan-500/10 text-cyan-100'}`}>
                                                {launchCustomizationCount > 0 ? `${launchCustomizationCount} customized` : `${getLaunchMediaSourceLabels(launchMediaSources).length} sources · ${eventCreditsEnabled ? 'Starting Points' : 'Earn Points'}`}
                                            </span>
                                            <i className={`fa-solid fa-chevron-${showAdvancedSetup ? 'up' : 'down'} text-zinc-500`} />
                                        </span>
                                    </button>
                                    {showAdvancedSetup ? (
                                    <div className="border-t border-white/10 px-3 pb-3">
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-black/18 px-3 py-2">
                                    <span className="text-sm text-zinc-300">Everything below is optional.</span>
                                    {launchCustomizationCount > 0 ? (
                                        <button type="button" onClick={resetLaunchFineTune} className="min-h-[44px] rounded-lg border border-amber-300/24 bg-amber-500/8 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-amber-100 transition hover:bg-amber-500/14">
                                            Reset to recipe
                                        </button>
                                    ) : null}
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-black/24 p-1 ring-1 ring-white/[0.07]" role="tablist" aria-label="Fine-tune setup sections">
                                    {[
                                        ['flow', 'Flow + live', 'fa-sliders'],
                                        ['sources', 'Song sources', 'fa-music'],
                                        ['points', 'Points', 'fa-coins'],
                                    ].map(([id, label, icon]) => {
                                        const selected = advancedSetupSection === id;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                role="tab"
                                                aria-selected={selected}
                                                onClick={() => setAdvancedSetupSection(id)}
                                                className={`min-h-[48px] rounded-lg px-2 py-2 text-xs font-black transition ${selected ? 'bg-violet-400/18 text-white shadow-sm ring-1 ring-violet-200/25' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'}`}
                                            >
                                                <i className={`fa-solid ${icon} mr-1.5`} />{label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {advancedSetupSection === 'flow' ? (
                                <>
                                <div className="mt-3 grid gap-3 xl:grid-cols-2" data-launch-queue-live-controls="true">
                                    <section className="rounded-2xl border border-white/10 bg-black/22 p-4">
                                        <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Queue rules</div>
                                        <div className="mt-1 text-xs text-zinc-400">Set the singer cap and rotation before the room opens.</div>
                                        <div className="mt-3 grid grid-cols-2 gap-1.5">
                                            {QUEUE_LIMIT_OPTIONS.map((option) => {
                                                const selected = String(launchPreviewQueue.limitMode || 'none') === option.id;
                                                return (
                                                    <button key={option.id} type="button" aria-pressed={selected} onClick={() => {
                                                        updateLaunchQueueSetting('limitMode', option.id);
                                                        if (option.id === 'none') updateLaunchQueueSetting('limitCount', 0);
                                                    }} className={`min-h-[44px] rounded-lg border px-2 py-2 text-xs font-bold transition ${selected ? 'border-cyan-300/45 bg-cyan-500/15 text-white' : 'border-white/10 bg-black/20 text-zinc-300 hover:border-cyan-300/25'}`}>
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {String(launchPreviewQueue.limitMode || 'none') !== 'none' ? (
                                            <label className="mt-3 block">
                                                <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-400">Songs allowed</span>
                                                <input type="number" min="1" max="50" value={Math.max(1, Number(launchPreviewQueue.limitCount || 1))} onChange={(event) => updateLaunchQueueSetting('limitCount', Math.max(1, Math.min(50, Number(event.target.value || 1))))} className={`${launchInputClass} mt-1`} />
                                            </label>
                                        ) : null}
                                        <div className="mt-3 grid grid-cols-2 gap-1.5">
                                            {QUEUE_ROTATION_OPTIONS.map((option) => {
                                                const selected = String(launchPreviewQueue.rotation || 'round_robin') === option.id;
                                                return (
                                                    <button key={option.id} type="button" aria-pressed={selected} onClick={() => updateLaunchQueueSetting('rotation', option.id)} className={`min-h-[44px] rounded-lg border px-2 py-2 text-xs font-bold transition ${selected ? 'border-fuchsia-300/40 bg-fuchsia-500/14 text-white' : 'border-white/10 bg-black/20 text-zinc-300 hover:border-fuchsia-300/22'}`}>
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button type="button" aria-pressed={launchPreviewQueue.firstTimeBoost !== false} onClick={() => updateLaunchQueueSetting('firstTimeBoost', launchPreviewQueue.firstTimeBoost === false)} className={`mt-2 flex min-h-[44px] w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${launchPreviewQueue.firstTimeBoost !== false ? 'border-cyan-300/36 bg-cyan-500/12 text-white' : 'border-white/10 bg-black/20 text-zinc-300'}`}>
                                            <span>Prioritize first-time singers</span>
                                            <span className="uppercase tracking-[0.14em]">{launchPreviewQueue.firstTimeBoost !== false ? 'On' : 'Off'}</span>
                                        </button>
                                    </section>
                                    <section className="rounded-2xl border border-white/10 bg-black/22 p-4">
                                        <div className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-200">Live switches</div>
                                        <div className="mt-1 text-xs text-zinc-400">The same room controls are available later, but they start here.</div>
                                        <div className="mt-3 grid grid-cols-2 gap-1.5">
                                            {[
                                                ['autoPlayMedia', 'Auto stage playback', launchPreviewSettings.autoPlayMedia !== false],
                                                ['showScoring', 'Live scoring', launchPreviewSettings.showScoring !== false],
                                                ['chatShowOnTv', 'Audience chat on TV', launchPreviewSettings.chatShowOnTv === true],
                                                ['marqueeEnabled', 'Marquee messages', launchPreviewSettings.marqueeEnabled === true],
                                                ['popTriviaEnabled', 'Pop-Up Trivia', launchPreviewSettings.popTriviaEnabled === true],
                                            ].map(([key, label, enabled]) => (
                                                <button key={key} type="button" aria-pressed={enabled} onClick={() => updateLaunchSetting(key, !enabled)} className={`min-h-[48px] rounded-lg border px-2.5 py-2 text-left text-xs font-bold transition ${enabled ? 'border-fuchsia-300/36 bg-fuchsia-500/14 text-white' : 'border-white/10 bg-black/20 text-zinc-300 hover:border-fuchsia-300/22'}`}>
                                                    <i className={`fa-solid ${enabled ? 'fa-circle-check text-fuchsia-200' : 'fa-circle text-zinc-600'} mr-1.5`} />{label}
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                                <section className="mt-3 rounded-2xl border border-white/10 bg-black/22 p-4" data-launch-karaoke-guardrails="true">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Karaoke-first guardrails</div>
                                            <div className="mt-1 text-xs text-zinc-400">Keep side activities from taking over the singing queue.</div>
                                        </div>
                                        <button type="button" aria-pressed={launchParty.karaokeFirst !== false} onClick={() => updateLaunchPartySetting('karaokeFirst', launchParty.karaokeFirst === false)} className={`min-h-[44px] rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${launchParty.karaokeFirst !== false ? 'border-amber-300/34 bg-amber-500/12 text-amber-50' : 'border-white/10 bg-black/20 text-zinc-300'}`}>
                                            Karaoke-first {launchParty.karaokeFirst !== false ? 'on' : 'off'}
                                        </button>
                                    </div>
                                    <div className={`mt-3 grid gap-2 md:grid-cols-3 ${launchParty.karaokeFirst !== false ? '' : 'opacity-45'}`} aria-disabled={launchParty.karaokeFirst === false}>
                                        <label className="block">
                                            <span className="text-xs font-bold text-zinc-300">Minimum singing share (%)</span>
                                            <input disabled={launchParty.karaokeFirst === false} type="number" min="50" max="95" value={launchParty.minSingingSharePct} onChange={(event) => updateLaunchPartySetting('minSingingSharePct', event.target.value)} className={`${launchInputClass} mt-1 disabled:cursor-not-allowed`} />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs font-bold text-zinc-300">Max break duration (sec)</span>
                                            <input disabled={launchParty.karaokeFirst === false} type="number" min="3" max="120" value={launchParty.maxBreakDurationSec} onChange={(event) => updateLaunchPartySetting('maxBreakDurationSec', event.target.value)} className={`${launchInputClass} mt-1 disabled:cursor-not-allowed`} />
                                        </label>
                                        <label className="block">
                                            <span className="text-xs font-bold text-zinc-300">Consecutive side activities</span>
                                            <input disabled={launchParty.karaokeFirst === false} type="number" min="1" max="4" value={launchParty.maxConsecutiveNonKaraokeModes} onChange={(event) => updateLaunchPartySetting('maxConsecutiveNonKaraokeModes', event.target.value)} className={`${launchInputClass} mt-1 disabled:cursor-not-allowed`} />
                                        </label>
                                    </div>
                                </section>
                                </>
                                ) : null}
                                {advancedSetupSection === 'sources' ? (
                                <div className="mt-3 rounded-2xl border border-white/10 bg-black/22 px-4 py-4" data-launch-media-readiness="true">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-100/78"><span className="grid h-8 w-8 place-items-center rounded-full border border-cyan-300/20 bg-cyan-500/10 text-xs text-cyan-100"><i className="fa-solid fa-music" /></span> Choose where song search looks</span>
                                        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-cyan-50">{getLaunchMediaSourceLabels(launchMediaSources).length} enabled</span>
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-cyan-50/66">Choose where Host and Audience searches may look. This sets guardrails, not a catalog lock; every performance still needs playable backing.</div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                        {LAUNCH_MEDIA_SOURCE_OPTIONS.map((option) => {
                                            const selected = !option.disabled && launchMediaSources?.[option.id] !== false;
                                            return (
                                                <button key={option.id} type="button" disabled={option.disabled} aria-pressed={selected} onClick={() => toggleLaunchMediaSource(option.id)} className={`min-h-[58px] rounded-xl border px-3 py-2 text-left transition ${option.disabled ? 'cursor-not-allowed border-white/6 bg-black/15 text-zinc-500' : selected ? 'border-cyan-300/40 bg-cyan-400/12 text-white' : 'border-white/10 bg-black/20 text-zinc-300 hover:border-cyan-300/25'}`}>
                                                    <span className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-sm font-black"><i className={`${option.icon.startsWith('fa-brands') ? '' : 'fa-solid '}${option.icon}`} />{option.label}</span><span className="text-xs font-black uppercase tracking-[0.08em]">{option.disabled ? 'Coming soon' : selected ? 'Included' : 'Off'}</span></span>
                                                    <span className="mt-1 block text-xs leading-5 opacity-68">{option.helper}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                ) : null}
                                {advancedSetupSection === 'points' ? (
                                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/22 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]" data-launch-points-setup="true">
                                    <div>
                                        <div className="min-w-0">
                                            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-fuchsia-100/80"><span className="grid h-8 w-8 place-items-center rounded-full border border-fuchsia-300/20 bg-fuchsia-500/10 text-xs text-fuchsia-100"><i className="fa-solid fa-coins text-fuchsia-300/82" /></span> Set how Points build</span>
                                            <div className="mt-1 max-w-3xl text-sm leading-6 text-fuchsia-50/68">Choose how guests enter the room economy, then decide whether time in the Room adds more Points automatically.</div>
                                        </div>
                                        <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="How guests enter the Points economy">
                                            <button type="button" aria-pressed={!eventCreditsEnabled} onClick={() => applyLaunchEconomy('standard')} className={`flex min-h-[96px] items-center gap-3 rounded-2xl border p-3 text-left transition ${!eventCreditsEnabled ? 'border-cyan-300/45 bg-cyan-500/14 text-white shadow-[0_12px_30px_rgba(34,211,238,0.09)]' : 'border-white/10 bg-black/18 text-fuchsia-100/68 hover:border-cyan-300/25'}`}>
                                                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-lg ${!eventCreditsEnabled ? 'border-cyan-200/40 bg-cyan-300 text-slate-950' : 'border-white/10 bg-white/[0.04]'}`}><i className="fa-solid fa-gamepad" /></span>
                                                <span className="min-w-0 flex-1"><span className="block text-xs font-black uppercase tracking-[0.1em] opacity-65">Earn as they play</span><span className="mt-0.5 block text-sm font-black">Start at zero</span><span className="mt-1 block text-xs leading-4 opacity-75">Activities and Host awards build the balance.</span></span>
                                                <i className={`fa-solid ${!eventCreditsEnabled ? 'fa-circle-check text-cyan-200' : 'fa-circle text-white/15'}`} />
                                            </button>
                                            <button type="button" aria-pressed={eventCreditsEnabled} onClick={() => !eventCreditsEnabled && updateLaunchPointSettings({ generalAdmissionPoints: 100 })} className={`flex min-h-[96px] items-center gap-3 rounded-2xl border p-3 text-left transition ${eventCreditsEnabled ? 'border-fuchsia-300/45 bg-fuchsia-500/14 text-white shadow-[0_12px_30px_rgba(244,114,182,0.09)]' : 'border-white/10 bg-black/18 text-fuchsia-100/68 hover:border-fuchsia-300/25'}`}>
                                                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-lg ${eventCreditsEnabled ? 'border-fuchsia-200/40 bg-fuchsia-300 text-slate-950' : 'border-white/10 bg-white/[0.04]'}`}><i className="fa-solid fa-wallet" /></span>
                                                <span className="min-w-0 flex-1"><span className="block text-xs font-black uppercase tracking-[0.1em] opacity-65">Welcome deposit</span><span className="mt-0.5 block text-sm font-black">Give starting Points</span><span className="mt-1 block text-xs leading-4 opacity-75">Every guest receives the same opening balance.</span></span>
                                                <i className={`fa-solid ${eventCreditsEnabled ? 'fa-circle-check text-fuchsia-200' : 'fa-circle text-white/15'}`} />
                                            </button>
                                        </div>
                                        <div className={`mt-3 rounded-2xl border p-3 transition ${eventCreditsConfig?.reactionSlot5PurchasesEnabled === true ? 'border-violet-300/38 bg-violet-500/12' : 'border-white/10 bg-black/18'}`} data-launch-reaction-slot-5-control="true">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 text-sm font-black text-white"><i className="fa-solid fa-face-laugh-beam text-violet-200" /> Sell a fifth voting-reaction slot</div>
                                                    <div className="mt-1 text-xs leading-5 text-fuchsia-50/62">Guests may spend 250 Room Points to unlock one swappable voting emoji. The purchase applies only to this room.</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    aria-pressed={eventCreditsConfig?.reactionSlot5PurchasesEnabled === true}
                                                    onClick={() => updateLaunchPointSettings({ reactionSlot5PurchasesEnabled: eventCreditsConfig?.reactionSlot5PurchasesEnabled !== true })}
                                                    className={`min-h-[44px] rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${eventCreditsConfig?.reactionSlot5PurchasesEnabled === true ? 'border-violet-200/38 bg-violet-400/18 text-violet-50' : 'border-white/10 bg-black/20 text-zinc-300'}`}
                                                >
                                                    Purchases {eventCreditsConfig?.reactionSlot5PurchasesEnabled === true ? 'on' : 'off'}
                                                </button>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-black uppercase tracking-[0.08em] text-violet-100/70">
                                                <span className="rounded-full border border-violet-300/18 bg-black/20 px-2 py-1">250 Room Points</span>
                                                <span className="rounded-full border border-violet-300/18 bg-black/20 px-2 py-1">Room-only unlock</span>
                                                <span className="rounded-full border border-violet-300/18 bg-black/20 px-2 py-1">Voting reactions—not avatars</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid items-stretch gap-3 xl:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.25fr)]">
                                        <div className={`flex flex-col rounded-xl border p-4 transition xl:min-h-[240px] ${eventCreditsEnabled ? 'border-amber-300/22 bg-amber-500/[0.07]' : 'border-white/10 bg-black/22'}`}>
                                            <span className="flex items-center gap-2 text-sm font-black text-white"><i className="fa-solid fa-ticket text-amber-200/80" /> Starting Points</span>
                                            <span className="mt-0.5 block text-xs leading-5 text-fuchsia-100/52">Given once when each guest joins.</span>
                                            <label className="mt-3 block"><span className="sr-only">Starting Points per guest</span><input disabled={!eventCreditsEnabled} type="number" min="0" max="100000" step="1" value={Math.max(0, Number(eventCreditsConfig?.generalAdmissionPoints || 0))} onChange={(event) => updateLaunchPointSettings({ generalAdmissionPoints: Math.min(100000, Math.max(0, Number(event.target.value || 0))) })} className={`${launchInputClass} mt-0 text-lg font-black disabled:cursor-not-allowed disabled:opacity-40`} aria-label="Starting Points per guest" /></label>
                                            <div className="mt-auto rounded-lg border border-white/[0.07] bg-black/18 px-3 py-2 text-xs leading-5 text-fuchsia-100/58">
                                                {!eventCreditsEnabled ? 'Guests start at zero and build Points through room activity.' : `Each guest starts with ${Math.max(0, Number(eventCreditsConfig?.generalAdmissionPoints || 0)).toLocaleString()} Points.`}
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-white/10 bg-black/22 p-4 xl:min-h-[240px]">
                                            <button
                                                type="button"
                                                aria-pressed={timedPointsRefillEnabled}
                                                aria-label="Automatic Points refill"
                                                onClick={() => {
                                                    const nextEnabled = !timedPointsRefillEnabled;
                                                    updateLaunchPointSettings({
                                                        timedLobbyEnabled: nextEnabled,
                                                        timedLobbyPoints: nextEnabled ? Math.max(25, Number(eventCreditsConfig?.timedLobbyPoints || 0)) : Math.max(0, Number(eventCreditsConfig?.timedLobbyPoints || 0)),
                                                        timedLobbyIntervalMin: Math.max(1, Number(eventCreditsConfig?.timedLobbyIntervalMin || 10)),
                                                        timedLobbyMaxPerGuest: nextEnabled ? Math.max(150, Number(eventCreditsConfig?.timedLobbyMaxPerGuest || 0)) : Math.max(0, Number(eventCreditsConfig?.timedLobbyMaxPerGuest || 0)),
                                                    });
                                                }}
                                                className={`flex min-h-[76px] w-full items-center gap-3 rounded-xl border p-3 text-left transition ${timedPointsRefillEnabled ? 'border-emerald-300/28 bg-emerald-500/10 text-white' : 'border-white/10 bg-black/18 text-fuchsia-100/68'}`}
                                            >
                                                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-base ${timedPointsRefillEnabled ? 'border-emerald-200/35 bg-emerald-300 text-slate-950' : 'border-white/10 bg-white/[0.04]'}`}><i className="fa-solid fa-clock-rotate-left" /></span>
                                                <span className="min-w-0 flex-1"><span className="block text-sm font-black">Reward time in the Room</span><span className="mt-0.5 block text-xs leading-4 opacity-60">{timedPointsRefillEnabled ? 'Automatic deposits are on.' : 'Guests earn only through activities and Host awards.'}</span></span>
                                                <span className={`rounded-full border px-2 py-1 text-xs font-black uppercase tracking-[0.08em] ${timedPointsRefillEnabled ? 'border-emerald-200/30 bg-emerald-500/12 text-emerald-50' : 'border-white/10 bg-black/20 text-zinc-300'}`}>{timedPointsRefillEnabled ? 'On' : 'Off'}</span>
                                            </button>
                                            <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${timedPointsRefillEnabled ? 'border-emerald-300/16 bg-emerald-500/8 text-emerald-100/76' : 'border-white/[0.07] bg-black/18 text-fuchsia-100/52'}`} role="status">
                                                {timedPointsRefillEnabled ? 'On · the values below control the refill cadence.' : 'Off · guests earn more through Room activities and Host awards.'}
                                            </div>
                                            <div className={`mt-3 grid gap-2 sm:grid-cols-3 transition-opacity ${timedPointsRefillEnabled ? 'opacity-100' : 'opacity-45'}`} aria-disabled={!timedPointsRefillEnabled}>
                                                <label className="flex min-w-0 flex-col"><span className="min-h-[34px] text-xs font-bold leading-4 text-fuchsia-50/72">Points each time</span><input disabled={!timedPointsRefillEnabled} type="number" min="0" max="1000" step="1" value={Math.max(0, Number(eventCreditsConfig?.timedLobbyPoints || 0))} onChange={(event) => updateLaunchPointSettings({ timedLobbyPoints: Math.min(1000, Math.max(0, Number(event.target.value || 0))) })} className={`${launchInputClass} disabled:cursor-not-allowed`} /></label>
                                                <label className="flex min-w-0 flex-col"><span className="min-h-[34px] text-xs font-bold leading-4 text-fuchsia-50/72">Every (minutes)</span><input disabled={!timedPointsRefillEnabled} type="number" min="1" max="120" step="1" value={Math.max(1, Number(eventCreditsConfig?.timedLobbyIntervalMin || 10))} onChange={(event) => updateLaunchPointSettings({ timedLobbyIntervalMin: Math.min(120, Math.max(1, Number(event.target.value || 1))) })} className={`${launchInputClass} disabled:cursor-not-allowed`} /></label>
                                                <label className="flex min-w-0 flex-col"><span className="min-h-[34px] text-xs font-bold leading-4 text-fuchsia-50/72">Refill cap per guest</span><input disabled={!timedPointsRefillEnabled} type="number" min="0" max="10000" step="1" value={Math.max(0, Number(eventCreditsConfig?.timedLobbyMaxPerGuest || 0))} onChange={(event) => updateLaunchPointSettings({ timedLobbyMaxPerGuest: Math.min(10000, Math.max(0, Number(event.target.value || 0))) })} className={`${launchInputClass} disabled:cursor-not-allowed`} /><span className="mt-1 block text-xs text-fuchsia-100/46">0 means no cap.</span></label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ) : null}
                                    </div>
                                    ) : null}
                                </div>
                                <div ref={launchReviewRef} className="mt-4 grid gap-4 rounded-2xl border border-emerald-300/22 bg-[linear-gradient(110deg,rgba(16,185,129,0.11),rgba(8,16,27,0.86)_52%,rgba(34,211,238,0.07))] p-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.55fr)] xl:items-center" data-launch-primary-bar="true">
                                    <div className="min-w-0">
                                        <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/68">Review and launch</div>
                                        <div className="mt-1 text-lg font-black text-white">{launchRoomName.trim() || 'Name your room to continue'}</div>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {launchPrimarySummaryItems.map((item) => <span key={item} className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1.5 text-xs text-cyan-50/82">{item}</span>)}
                                        </div>
                                    </div>
                                    <div>
                                        <button type="button" data-host-create-room-primary="true" aria-busy={creatingRoom} onClick={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'stage', nightPresetPayload: launchPresetPayloadPreview, audienceJoinPasscode: normalizedLaunchJoinPasscode })} disabled={roomLaunchDisabled} className={`group/launch flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(100deg,#db2777_0%,#ec4899_35%,#14b8a6_78%,#22d3ee_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_14px_34px_rgba(236,72,153,0.18),0_0_28px_rgba(34,211,238,0.1)] transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_18px_42px_rgba(236,72,153,0.24),0_0_34px_rgba(34,211,238,0.16)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:brightness-100 ${roomLaunchDisabled ? 'cursor-not-allowed opacity-45' : ''}`}>
                                            {creatingRoom ? <i className="fa-solid fa-circle-notch animate-spin" /> : <i className="fa-solid fa-wand-magic-sparkles" />}
                                            <span>{creatingRoom ? 'Creating room...' : 'Create + Open Host Panel'}</span>
                                            {!creatingRoom ? <i className="fa-solid fa-arrow-right text-xs transition-transform group-hover/launch:translate-x-1" /> : null}
                                        </button>
                                        <div className={`mt-2 flex items-center justify-center gap-2 text-center text-xs ${creatingRoom ? 'text-cyan-100/72' : roomLaunchDisabled ? 'text-amber-100/72' : 'text-cyan-100/62'}`} role="status"><i className={`fa-solid ${creatingRoom ? 'fa-circle-notch animate-spin' : roomLaunchDisabled ? 'fa-circle-exclamation' : 'fa-shield-check'} text-xs`} /> {launchReadinessMessage}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="hidden" aria-hidden="true" data-launch-configuration-contract="true">
                            <div className="space-y-3">
                                <section className="rounded-xl border border-cyan-300/22 bg-cyan-500/8 px-3 py-3" data-launch-night-type>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Quick setup</div>
                                            <div className="mt-1 text-lg font-black text-white">What kind of night is this?</div>
                                            <div className="mt-1 text-sm text-cyan-100/68">One choice sets the recommended queue, host style, automation, and economy defaults.</div>
                                        </div>
                                        <span className="rounded-full border border-cyan-300/25 bg-black/20 px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100/72">{selectedNightType.eyebrow}</span>
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
                                                            <span className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-inherit">{option.label}</span><span className="rounded-full border border-white/10 bg-black/18 px-2 py-0.5 text-xs uppercase tracking-[0.14em] opacity-72">{option.eyebrow}</span></span>
                                                            <span className="mt-1 block text-xs leading-5 opacity-82">{option.summary}</span>
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button type="button" onClick={() => setShowAdvancedSetup((current) => !current)} aria-expanded={showAdvancedSetup} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-cyan-100/72 hover:text-white">
                                        <i className={`fa-solid fa-chevron-${showAdvancedSetup ? 'up' : 'down'} text-xs`}></i>
                                        {showAdvancedSetup ? 'Hide advanced setup' : 'Customize advanced setup'}
                                    </button>
                                </section>

                                <section className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Step 1 - Room identity</div>
                                    <div className="mt-1 text-sm text-cyan-100/66">Give guests a recognizable room and optionally reserve a memorable code.</div>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <label className="block">
                                            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Room name</div>
                                            <input value={launchRoomName} onChange={(e) => setLaunchRoomName(e.target.value)} placeholder="Friday Karaoke" className={inputClass} />
                                        </label>
                                        <label className="block">
                                            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Room code</div>
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
                                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Step 2 - Guest entry</div>
                                    <div className="mt-1 text-sm text-cyan-100/66">Decide when the room appears and how easily guests can get in.</div>
                                    <div className="mt-3 grid gap-3 lg:grid-cols-4">
                                        <label className="block lg:col-span-1">
                                            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Start</div>
                                            <input type="datetime-local" value={String(quickLaunchDiscovery?.roomStartsAtLocal || '')} onChange={(e) => setQuickLaunchDiscovery((prev) => ({ ...prev, roomStartsAtLocal: e.target.value }))} className={inputClass} />
                                            <div className="mt-2 text-xs text-cyan-100/58">{hasLaunchStartTime ? launchStartSummary : 'Start now'}</div>
                                        </label>
                                        <div className="lg:col-span-1">
                                            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Visibility</div>
                                            <div className="mt-2 inline-flex w-full rounded-xl border border-white/10 bg-black/20 p-1">
                                                <button type="button" onClick={() => setDiscoveryListingMode(false)} className={`flex-1 rounded-lg px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${!discoveryListingEnabled ? 'bg-white text-black' : 'text-cyan-100/72'}`}>Private</button>
                                                <button type="button" onClick={() => setDiscoveryListingMode(true)} className={`flex-1 rounded-lg px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${discoveryListingEnabled ? 'bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black' : 'text-cyan-100/72'}`}>Discoverable</button>
                                            </div>
                                        </div>
                                        <label className="block lg:col-span-1">
                                            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Who can join?</div>
                                            <select value={launchJoinAccessMode} onChange={(e) => setLaunchJoinAccessMode(e.target.value)} className={inputClass}>
                                                {AUDIENCE_JOIN_ACCESS_OPTIONS.map((option) => (<option key={option.id} value={option.id}>{option.label}</option>))}
                                            </select>
                                            <div className="mt-2 text-xs text-cyan-100/58">{selectedJoinOption?.description}</div>
                                        </label>
                                        <label className="block lg:col-span-1">
                                            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Repeats</div>
                                            <select value={String(quickLaunchDiscovery?.recurringRule || 'one_time')} onChange={(e) => setQuickLaunchDiscovery((prev) => ({ ...prev, recurringRule: e.target.value }))} className={inputClass}>
                                                <option value="one_time">One-time room</option>
                                                <option value="weekly">Weekly night</option>
                                            </select>
                                            <div className="mt-2 text-xs text-cyan-100/58">Weekly nights keep one identity across future room sessions.</div>
                                        </label>
                                    </div>
                                    {launchNeedsPasscode ? (
                                        <label className="mt-3 block max-w-md">
                                            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Guest passcode</div>
                                            <input type="password" value={launchJoinPasscode} onChange={(e) => setLaunchJoinPasscode(String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24))} placeholder="4-24 letters or numbers" minLength={4} maxLength={24} autoComplete="new-password" className={inputClass} />
                                            <div className={`mt-2 text-xs ${launchPasscodeValid ? 'text-cyan-100/58' : 'text-amber-200'}`}>The room code locates the room. This separate passcode admits a new guest and is stored only as a server-side hash.</div>
                                        </label>
                                    ) : null}
                                </section>

                                <section className={`${showAdvancedSetup ? '' : 'hidden'} rounded-xl border border-fuchsia-300/18 bg-fuchsia-500/8 px-3 py-3`} data-launch-operating-model>
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.18em] text-fuchsia-100/62">Advanced host style</div>
                                            <div className="mt-1 text-lg font-black text-white">Who drives the night?</div>
                                            <div className="mt-1 text-sm text-fuchsia-100/68">Choose this when the room is created because it changes pacing, automation, and crowd prompts from the start.</div>
                                        </div>
                                        <span className="rounded-full border border-fuchsia-300/25 bg-black/20 px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-fuchsia-100/72">{selectedOperatingModelOption.eyebrow}</span>
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
                                                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs uppercase tracking-[0.14em] ${selected ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-black/18 text-fuchsia-100/58'}`}>{option.eyebrow}</span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                        {option.details.map((detail) => (<span key={detail} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs text-fuchsia-50/76">{detail}</span>))}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                                <section className={`${showAdvancedSetup ? '' : 'hidden'} rounded-xl border border-cyan-300/18 bg-cyan-500/8 px-3 py-3`} data-launch-template-options>
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Optional template</div>
                                            <div className="mt-1 text-sm text-cyan-100/66">Choose the starting behavior for queue, requests, search, TV/crowd layers, automation, and guest access. You can refine these after the room exists.</div>
                                        </div>
                                        {selectedPresetUi?.eyebrow ? (<span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100/62">{selectedPresetUi.eyebrow}</span>) : null}
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
                                                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs uppercase tracking-[0.14em] ${selected ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-black/18 text-cyan-100/58'}`}>{preset.isBuiltIn ? 'Built-in' : 'Custom'}</span>
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                        {chips.slice(0, 3).map((chip) => (<span key={chip} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs text-cyan-50/76">{chip}</span>))}
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
                                            {selectedLaunchPreset?.isBuiltIn ? (<span className="rounded-full border border-cyan-300/24 bg-cyan-500/10 px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100/72">Built-in</span>) : (<span className="rounded-full border border-fuchsia-300/24 bg-fuchsia-500/10 px-2.5 py-1 text-xs uppercase tracking-[0.16em] text-fuchsia-100/72">Custom</span>)}
                                        </div>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                            {selectedPresetImpactRows.map((row) => (<div key={row.label} className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2"><div className="text-xs uppercase tracking-[0.16em] text-cyan-100/48">{row.label}</div><div className="mt-1 text-sm text-cyan-50/86">{row.value}</div></div>))}
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="space-y-3">
                                <section className="rounded-xl border border-fuchsia-300/18 bg-fuchsia-500/8 px-3 py-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-fuchsia-100/62">Step 3 - Points & rewards</div>
                                    <div className="mt-1 text-lg font-black text-white">Choose tonight&apos;s rewards</div>
                                    <div className="mt-1 text-sm text-fuchsia-100/68">Points run live participation. You can also open account-owned BeauBucks cosmetics, ticket perks, or fundraiser support without changing performance scores.</div>
                                    <div className="mt-3 grid gap-2">
                                        {LAUNCH_ECONOMY_OPTIONS.filter((option) => option.id !== 'beaubucks' && (showAdvancedSetup || option.id !== 'custom')).map((option) => {
                                            const selected = option.id === launchEconomyMode;
                                            return (<button key={option.id} type="button" onClick={() => applyLaunchEconomy(option.id)} className={`rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-fuchsia-300/45 bg-fuchsia-500/16 text-white' : 'border-white/10 bg-black/18 text-fuchsia-100/72 hover:border-fuchsia-300/24 hover:bg-fuchsia-500/8'}`}><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold">{option.label}</div><span className={`rounded-full border px-2 py-0.5 text-xs uppercase tracking-[0.16em] ${selected ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 bg-black/18 text-fuchsia-100/58'}`}>{option.eyebrow}</span></div><div className="mt-1 text-xs leading-5 opacity-82">{option.summary}</div></button>);
                                        })}
                                    </div>
                                    <div className="mt-3 rounded-xl border border-fuchsia-300/15 bg-fuchsia-500/[0.06] px-3 py-2 text-xs leading-5 text-fuchsia-100/72">
                                        Eligible Rooms get one separate <strong className="text-fuchsia-50">BeauBucks cosmetics</strong> switch after creation. It never changes Points or performance scoring.
                                    </div>
                                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3" data-launch-economy-preview="true">
                                        <div className="text-xs uppercase tracking-[0.18em] text-fuchsia-100/58">What guests experience</div>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                            {launchEconomySummary.cards.map((card) => (
                                                <div key={card.id} className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
                                                    <div className="text-xs uppercase tracking-[0.15em] text-fuchsia-100/48">{card.eyebrow}</div>
                                                    <div className="mt-1 text-xs font-semibold text-white">{card.value}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {launchEconomySummary.warnings.length ? <div className="mt-2 text-xs text-amber-200">Review: {launchEconomySummary.warnings.join(' ')}</div> : null}
                                    </div>
                                </section>

                                <section className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">Launch summary</div>
                                    <div className="mt-1 text-sm text-cyan-100/66">Confirm the room guests will enter first. Everything below can still be adjusted from the host panel.</div>
                                    <div className="mt-3 flex flex-wrap gap-2">{launchSummaryItems.map((item) => (<span key={item} className="rounded-full border border-white/10 bg-black/24 px-3 py-1.5 text-xs text-cyan-50/82">{item}</span>))}</div>
                                    <div className="mt-3 grid gap-2" data-launch-effective-behavior="true">
                                        {launchEffectiveBehavior.domains.map((domain) => (
                                            <div key={domain.key} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5" data-launch-effective-domain={domain.key}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="text-xs uppercase tracking-[0.16em] text-cyan-100/58">{domain.label}</div>
                                                    <div className="max-w-[46%] truncate text-xs uppercase tracking-[0.12em] text-zinc-500" title={domain.provenance?.sourceLabel || 'Launch plan'}>From {domain.provenance?.sourceLabel || 'launch plan'}</div>
                                                </div>
                                                <div className="mt-1 text-xs leading-5 text-cyan-50/82">{domain.summary}</div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="grid gap-2">
                                    <button type="button" data-host-create-room-primary="true" onClick={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'stage', nightPresetPayload: launchPresetPayloadPreview, audienceJoinPasscode: normalizedLaunchJoinPasscode })} disabled={roomLaunchDisabled} className={`${STYLES.btnStd} ${STYLES.btnHighlight} w-full justify-center px-4 py-3 text-xs uppercase tracking-[0.18em] ${roomLaunchDisabled ? 'cursor-not-allowed opacity-60' : ''}`}>{creatingRoom ? 'Creating room...' : 'Create + Open Host Panel'}</button>
                                    <details className="rounded-xl border border-white/10 bg-black/18 px-3 py-2">
                                        <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.16em] text-cyan-100/62">Planning ahead?</summary>
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                            <div className="text-sm text-cyan-100/66">Create the room and open the Show Plan when you want to sequence moments before guests arrive.</div>
                                            <button type="button" onClick={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'show', nightPresetPayload: launchPresetPayloadPreview, audienceJoinPasscode: normalizedLaunchJoinPasscode })} disabled={roomLaunchDisabled} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-xs uppercase tracking-[0.18em] ${roomLaunchDisabled ? 'cursor-not-allowed opacity-60' : ''}`}>Create + Prepare Room</button>
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
                        <button type="button" onClick={retryLastHostAction} className="mt-2 inline-flex items-center rounded-full border border-rose-300/40 px-3 py-1 text-xs uppercase tracking-[0.16em] text-rose-100">
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
