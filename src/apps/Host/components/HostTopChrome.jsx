import React from 'react';
import { CROWD_OBJECTIVE_MODES, getCrowdObjectiveModeFromLightMode } from '../../../lib/crowdObjectiveModes';
import {
    CROWD_MODE_PRESETS,
    buildCrowdModePatch,
    getCrowdModeSummary,
} from '../../../lib/hostCrowdModes';
import {
    OPERATING_STYLE_PRESETS,
    buildOperatingStylePatch,
    getOperatingStyleSummary,
} from '../../../lib/hostOperatingStyles';
import {
    getRunOfShowHudActionKey,
    getRunOfShowHudState,
    getRunOfShowItemLabel,
    normalizeRunOfShowDirector
} from '../../../lib/runOfShowDirector';

import {
    buildProvisionEventCreditsPayload,
    createEventCreditsDraft,
} from '../hostLaunchHelpers';

const TOP_SCENE_TEMPLATE_QUICK_PADS = Object.freeze([
    { id: 'host_update', label: 'Host Update', icon: 'fa-bullhorn', group: 'announce' },
    { id: 'how_to_join', label: 'How To Join', icon: 'fa-qrcode', group: 'audience' },
    { id: 'sponsor_spotlight', label: 'Sponsor', icon: 'fa-hand-holding-heart', group: 'support' },
    { id: 'trivia_break', label: 'Trivia', icon: 'fa-circle-question', group: 'game' },
]);
const QUICK_REWARD_REFILL_PRESETS = Object.freeze([
    { id: 'off', label: 'Off', timedLobbyEnabled: false, timedLobbyPoints: 0, timedLobbyIntervalMin: 10, timedLobbyMaxPerGuest: 0 },
    { id: 'lean', label: 'Lean', timedLobbyEnabled: true, timedLobbyPoints: 12, timedLobbyIntervalMin: 10, timedLobbyMaxPerGuest: 72 },
    { id: 'friendly', label: 'Friendly', timedLobbyEnabled: true, timedLobbyPoints: 25, timedLobbyIntervalMin: 10, timedLobbyMaxPerGuest: 150 },
    { id: 'party', label: 'Party', timedLobbyEnabled: true, timedLobbyPoints: 50, timedLobbyIntervalMin: 10, timedLobbyMaxPerGuest: 300 },
]);
const ONE_MINUTE_MIC_OPENING_PRESETS = Object.freeze([45, 60, 90]);
const ONE_MINUTE_MIC_VOTE_WINDOW_PRESETS = Object.freeze([8, 12, 15, 20]);
const ROOM_CONTROL_MODEL_OPTIONS = Object.freeze([
    {
        id: 'host_led',
        label: 'Host-Led',
        icon: 'fa-headset',
        summary: 'Full songs and host-paced queue decisions.',
    },
    {
        id: 'assisted_host',
        label: 'Assisted Host',
        icon: 'fa-wand-magic-sparkles',
        summary: 'Full songs with Auto-DJ support between performances.',
    },
    {
        id: 'crowd_driven',
        label: 'Crowd-Driven',
        icon: 'fa-people-group',
        summary: 'One-Minute Mic plus Auto-DJ for self-service parties.',
    },
]);
const getRunOfShowDurationSec = (item = {}) => Math.max(
    0,
    Math.round(Number(
        String(item?.plannedDurationSource || '').trim().toLowerCase() === 'backing'
            ? (item?.backingPlan?.durationSec || item?.plannedDurationSec || 0)
            : (item?.plannedDurationSec || item?.backingPlan?.durationSec || 0)
    ) || 0)
);

const formatRunOfShowDuration = (value = 0) => {
    const totalSec = Math.max(0, Math.round(Number(value || 0) || 0));
    if (!totalSec) return 'TBD';
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins >= 60) {
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
    }
    if (mins > 0) return `${mins}:${String(secs).padStart(2, '0')}`;
    return `${secs}s`;
};

const formatRemainingShowTime = (value = 0) => {
    const totalSec = Math.max(0, Math.ceil(Number(value || 0) || 0));
    if (!totalSec) return '0m';
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    if (mins > 0) return mins < 10 && secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    return `${secs}s`;
};

const HostTopChrome = ({
    room,
    appBase,
    hostBase,
    audienceBase,
    tvBase,
    launchUrls = null,
    roomCode,
    queuePreviewSongs = [],
    tab,
    setTab,
    showLaunchMenu,
    setShowLaunchMenu,
    showNavMenu,
    setShowNavMenu,
    setShowSettings,
    setSettingsTab,
    openAdminWorkspace,
    styles,
    logoFallback,
    audioPanelOpen,
    setAudioPanelOpen,
    stageMeterLevel,
    stageMicReady,
    stageMicError,
    requestStageMic,
    toggleSongMute,
    updateRoom,
    smallWaveform,
    bgAnalyserActive,
    bgMeterLevel,
    bgVolume,
    setBgVolume,
    toggleBgMusic,
    playingBg,
    skipBg,
    canSkipBg = true,
    autoBgMusic,
    setAutoBgMusic,
    toggleHowToPlay,
    marqueeEnabled = false,
    setMarqueeEnabled,
    chatShowOnTv = false,
    setChatShowOnTv,
    popTriviaEnabled = true,
    setPopTriviaEnabled,
    chatTvMode = 'auto',
    setChatTvMode,
    chatUnread = 0,
    setBgMusicState,
    toggleBgMute,
    currentTrackName,
    mixFader,
    handleMixFaderChange,
    startReadyCheck,
    startBeatDrop,
    startStormSequence,
    stopStormSequence,
    appleMusicConnected = false,
    appleMusicPickerModes = [],
    appleMusicPickerMode = 'library',
    setAppleMusicPickerMode,
    appleMusicPickerQuery = '',
    setAppleMusicPickerQuery,
    appleMusicPickerItems = [],
    appleMusicPickerLoading = false,
    appleMusicPickerError = '',
    loadAppleMusicPicker,
    applyAppleMusicPlaylistForBg,
    appleMusicAutoPlaylistId = '',
    appleMusicAutoPlaylistTitle = '',
    aiToolsConnected = false,
    youtubeBudgetStatus = null,
    permissionLevel = 'unknown',
    authSessionReady = false,
    sfxMuted = false,
    setSfxMuted,
    sfxVolume = 0.5,
    setSfxVolume,
    playSfxSafe,
    sounds = [],
    silenceAll,
    missionControlEnabled = false,
    missionRecommendation = null,
    missionStatusDetail = '',
    moderationPendingCount = 0,
    moderationSeverity = 'idle',
    moderationNeedsAttention = false,
    queueAttentionCount = 0,
    queueAttentionNeedsHost = false,
    onOpenCatalogueHelper,
    users = [],
    onDropBonus,
    onGiftPointsToUser,
    quickAutomationControls = null,
    quickRoomControls = null,
    onOpenHostDashboard,
    audiencePreviewVisible = false,
    setAudiencePreviewVisible,
    audiencePreviewMode = 'thumbnail',
    setAudiencePreviewMode,
    publicTvPreviewVisible = false,
    setPublicTvPreviewVisible,
    tabletTouchViewport = false,
    mediumViewport = false,
    runOfShowEnabled = false,
    runOfShowDirector = null,
    runOfShowLiveItem = null,
    runOfShowStagedItem = null,
    runOfShowNextItem = null,
    runOfShowPreflightReport = null,
    onToggleRunOfShowAutomationPause,
    runOfShowFocusMode = false,
    crowdPulse = null,
    activeMomentFeedback = null,
    scenePresets = [],
    onLaunchScenePreset,
    onQueueScenePreset,
    onAddQuickRunOfShowMoment,
    onOpenSceneLibrary,
    onClearScenePreset,
    onReplayPurchaseCelebration,
    onApplyCrowdModePreset,
    onUndoCrowdModePreset,
    onApplyOperatingStylePreset,
    onUndoOperatingStylePreset,
    liveCrowdModeHistoryLabel = '',
    liveOperatingStyleHistoryLabel = '',
}) => {
    const resolvedHostBase = hostBase || appBase;
    const resolvedAudienceBase = audienceBase || appBase;
    const resolvedTvBase = tvBase || appBase;
    const launchTvHref = String(launchUrls?.tvUrl || '').trim() || `${resolvedTvBase}?room=${roomCode}&mode=tv`;
    const launchAudienceHref = String(launchUrls?.audienceUrl || '').trim() || `${resolvedAudienceBase}?room=${roomCode}`;
    const helperCatalogHref = `${resolvedHostBase}?room=${encodeURIComponent(roomCode || '')}&mode=host&view=queue&section=queue.catalog&catalogue=1`;
    const buildPrintHref = (pathname = '') => {
        const safePath = String(pathname || '').trim();
        if (!safePath) return '';
        const fallbackBase = typeof window !== 'undefined'
            ? window.location.origin
            : 'https://app.beaurocks.app';
        try {
            return new URL(safePath, resolvedHostBase || resolvedAudienceBase || resolvedTvBase || fallbackBase).toString();
        } catch {
            return safePath;
        }
    };
    const audienceHelpHref = buildPrintHref(`/help/audience${roomCode ? `?room=${encodeURIComponent(roomCode)}` : ''}`);
    const coHostHelpHref = buildPrintHref(`/help/cohost${roomCode ? `?room=${encodeURIComponent(roomCode)}` : ''}`);
    const hostHelpHref = buildPrintHref(`/help/host${roomCode ? `?room=${encodeURIComponent(roomCode)}` : ''}`);
    const clampNumber = (value, min, max, fallback = min) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.max(min, Math.min(max, numeric));
    };
    const SmallWaveform = smallWaveform;
    const [showTvQuickMenu, setShowTvQuickMenu] = React.useState(false);
    const [showOverlaysMenu, setShowOverlaysMenu] = React.useState(false);
    const [showScenesQuickMenu, setShowScenesQuickMenu] = React.useState(false);
    const [showSfxQuickMenu, setShowSfxQuickMenu] = React.useState(false);
    const [showVibeQuickMenu, setShowVibeQuickMenu] = React.useState(false);
    const [showAutomationQuickMenu, setShowAutomationQuickMenu] = React.useState(false);
    const [showQueueQuickMenu, setShowQueueQuickMenu] = React.useState(false);
    const [showRewardsQuickMenu, setShowRewardsQuickMenu] = React.useState(false);
    const [showStatusQuickMenu, setShowStatusQuickMenu] = React.useState(false);
    const [quickRewardTargetUid, setQuickRewardTargetUid] = React.useState('');
    const [quickRewardCustomPoints, setQuickRewardCustomPoints] = React.useState('100');
    const quickEventCredits = createEventCreditsDraft(room?.eventCredits || {});
    const quickTimedLobbyEnabled = quickEventCredits.enabled === true && quickEventCredits.timedLobbyEnabled === true && Number(quickEventCredits.timedLobbyPoints || 0) > 0;
    const quickRefillSummary = quickTimedLobbyEnabled
        ? `+${Math.max(0, Number(quickEventCredits.timedLobbyPoints || 0) || 0)} every ${Math.max(1, Number(quickEventCredits.timedLobbyIntervalMin || 10) || 10)} min${Number(quickEventCredits.timedLobbyMaxPerGuest || 0) > 0 ? `, ${Math.max(0, Number(quickEventCredits.timedLobbyMaxPerGuest || 0) || 0)} max` : ''}`
        : 'No timed refill';
    const [compactRunOfShowCollapsed, setCompactRunOfShowCollapsed] = React.useState(() => {
        try {
            if (typeof window === 'undefined') return false;
            return window.localStorage.getItem('bross_host_compact_run_of_show_collapsed') === '1';
        } catch {
            return false;
        }
    });
    const launchMenuRef = React.useRef(null);
    const navMenuRef = React.useRef(null);
    const audioMenuRef = React.useRef(null);
    const tvQuickMenuRef = React.useRef(null);
    const overlaysMenuRef = React.useRef(null);
    const scenesQuickMenuRef = React.useRef(null);
    const sfxQuickMenuRef = React.useRef(null);
    const vibeQuickMenuRef = React.useRef(null);
    const automationQuickMenuRef = React.useRef(null);
    const queueQuickMenuRef = React.useRef(null);
    const rewardsQuickMenuRef = React.useRef(null);
    const statusQuickMenuRef = React.useRef(null);
    const stormActive = room?.lightMode === 'storm';
    const strobeActive = room?.lightMode === 'strobe';
    const guitarActive = room?.lightMode === 'guitar';
    const bangerActive = room?.lightMode === 'banger';
    const balladActive = room?.lightMode === 'ballad';
    const activeCrowdObjectiveMode = getCrowdObjectiveModeFromLightMode(room?.lightMode);
    const volleyActive = !!activeCrowdObjectiveMode;
    const selfieCamActive = room?.activeMode === 'selfie_cam';
    const tvDisplayMode = room?.showLyricsTv && room?.showVisualizerTv
        ? 'lyrics_viz'
        : room?.showLyricsTv
            ? 'lyrics'
            : room?.showVisualizerTv
                ? 'visualizer'
                : 'video';
    const tvPresentationProfile = (() => {
        const key = String(room?.tvPresentationProfile || '').trim().toLowerCase();
        if (key === 'simple') return 'simple';
        if (key === 'cinema') return 'cinema';
        return 'room';
    })();
    const missionStatus = missionRecommendation?.status || 'ready';
    const tvDisplayLabel = tvDisplayMode === 'lyrics_viz'
        ? 'Lyrics + Viz'
        : tvDisplayMode === 'lyrics'
            ? 'Lyrics'
            : tvDisplayMode === 'visualizer'
                ? 'Visualizer'
                : 'Video';
    const audienceDisplayMode = String(quickRoomControls?.audienceDisplay?.mode || 'off').trim().toLowerCase() || 'off';
    const audienceDisplaySelectedCount = Math.max(0, Number(quickRoomControls?.audienceDisplaySelectedCount || 0) || 0);
    const audienceDisplayLabel = audienceDisplayMode === 'commentator_row'
        ? `Commentator Row${audienceDisplaySelectedCount ? ` (${audienceDisplaySelectedCount})` : ''}`
        : audienceDisplayMode === 'lobby_wall'
            ? 'Lobby Wall'
            : audienceDisplayMode === 'featured_guest'
                ? 'Featured Guest'
                : audienceDisplayMode === 'judges_panel'
                    ? 'Judges Panel'
                    : 'Off';
    const visualizerSource = room?.visualizerSource || 'auto';
    const visualizerMode = room?.visualizerMode || 'ribbon';
    const visualizerPreset = room?.visualizerPreset || 'neon';
    const visualizerSyncLightMode = !!room?.visualizerSyncLightMode;
    const roomVisualizerSensitivity = clampNumber(room?.visualizerSensitivity, 0.5, 2.5, 1);
    const roomVisualizerSmoothing = clampNumber(room?.visualizerSmoothing, 0, 0.95, 0.35);
    const roomVideoVolume = Math.round(clampNumber(room?.videoVolume, 0, 100, 100));
    const roomBgVolumePct = Math.round(clampNumber((Number(bgVolume) || 0.3) * 100, 0, 100, 30));
    const roomMixFader = Math.round(clampNumber(mixFader, 0, 100, 50));
    const roomSfxVolumePct = Math.round(clampNumber((Number(sfxVolume) || 0.5) * 100, 0, 100, 50));
    const [visualizerSensitivityDraft, setVisualizerSensitivityDraft] = React.useState(roomVisualizerSensitivity);
    const [visualizerSmoothingDraft, setVisualizerSmoothingDraft] = React.useState(roomVisualizerSmoothing);
    const [stageVolumeDraft, setStageVolumeDraft] = React.useState(roomVideoVolume);
    const [bgVolumeDraftPct, setBgVolumeDraftPct] = React.useState(roomBgVolumePct);
    const [mixFaderDraft, setMixFaderDraft] = React.useState(roomMixFader);
    const [sfxVolumeDraftPct, setSfxVolumeDraftPct] = React.useState(roomSfxVolumePct);
    const visualizerSliderDraggingRef = React.useRef({ sensitivity: false, smoothing: false });
    const sliderDraggingRef = React.useRef({ stage: false, bg: false, mix: false, sfx: false });
    const activeVibeLabel = selfieCamActive
        ? 'Selfie Cam'
        : stormActive
            ? 'Storm'
            : strobeActive
                ? 'Beat'
                : guitarActive
                    ? 'Guitar'
                    : bangerActive
                        ? 'Banger'
                        : balladActive
                            ? 'Ballad'
                            : activeCrowdObjectiveMode?.label || 'Off';
    const marqueeActive = !!marqueeEnabled;
    const chatTvActive = !!chatShowOnTv;
    const popTriviaActive = !!popTriviaEnabled;
    const chatFullscreenActive = chatTvActive && chatTvMode === 'fullscreen';
    const leaderboardActive = room?.activeScreen === 'leaderboard';
    const leaderboardStackActive = room?.activeScreen === 'leaderboard_stack';
    const tipCtaActive = room?.activeScreen === 'tipping';
    const howToPlayActive = !!room?.howToPlay?.active;
    const overlaysActiveCount = Number(leaderboardActive) + Number(leaderboardStackActive) + Number(tipCtaActive) + Number(howToPlayActive) + Number(marqueeActive) + Number(chatTvActive) + Number(popTriviaActive);
    const scenePresetCount = Array.isArray(scenePresets) ? scenePresets.length : 0;
    const activeMediaScene = room?.announcement?.active && String(room?.announcement?.type || '').trim().toLowerCase() === 'media_scene'
        ? room.announcement
        : null;
    const recentScenePresets = React.useMemo(
        () => (Array.isArray(scenePresets) ? scenePresets : [])
            .slice()
            .sort((left, right) => {
                const leftScore = Math.max(
                    Number(left?.lastPresentedAtMs || 0) || 0,
                    Number(left?.updatedAtMs || 0) || 0,
                    Number(left?.createdAtMs || 0) || 0
                );
                const rightScore = Math.max(
                    Number(right?.lastPresentedAtMs || 0) || 0,
                    Number(right?.updatedAtMs || 0) || 0,
                    Number(right?.createdAtMs || 0) || 0
                );
                return rightScore - leftScore;
            })
            .slice(0, 6),
        [scenePresets]
    );
    const experimentalRuntimeShellActive = quickRoomControls?.runtimeShellMode === 'social_game_night_experiment';
    const minimalRuntimeChrome = experimentalRuntimeShellActive && tab === 'stage';
    const adminWorkspaceChrome = tab === 'admin';
    const denseChrome = minimalRuntimeChrome || adminWorkspaceChrome || !!tabletTouchViewport || !!mediumViewport;
    const compactTopQuickStrip = !!tabletTouchViewport && !runOfShowFocusMode;
    const quickMenuPanelClass = 'host-top-menu-panel absolute top-full mt-2 rounded-2xl border border-cyan-300/40 bg-zinc-950/98 backdrop-blur-md ring-1 ring-cyan-400/20 shadow-[0_24px_50px_rgba(0,0,0,0.68)] z-[320]';
    const quickMenuScrollClass = 'host-touch-scroll-panel overflow-y-auto custom-scrollbar overscroll-contain';
    const quickMenuSectionTitleClass = 'text-[11px] font-black uppercase tracking-[0.22em] text-zinc-100';
    const quickMenuSectionHintClass = 'mt-1 text-xs leading-5 text-zinc-400';
    const quickMenuCardClass = 'rounded-xl border border-cyan-400/20 bg-black/45 p-2.5';
    const quickMenuSelectClass = `${styles.input} mt-1 min-h-[44px] px-3 text-sm bg-zinc-950/95 border border-cyan-300/35 focus:border-cyan-200`;
    const quickMenuFieldClass = 'block text-sm text-zinc-200';
    const quickMenuLabelClass = 'block text-[11px] font-black uppercase tracking-[0.16em] text-zinc-300';
    const quickMenuHelperClass = 'mt-1.5 block text-xs leading-5 text-zinc-500';
    const quickMenuEyebrowClass = 'text-[11px] font-black uppercase tracking-[0.18em]';
    const quickMenuTitleClass = 'mt-1 text-[13px] font-semibold leading-tight text-white';
    const quickMenuBodyClass = 'mt-1 text-xs leading-5 text-zinc-300';
    const quickMenuBadgeClass = 'rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em]';
    const quickMenuToggleClass = `${styles.btnStd} ${styles.btnNeutral} ${minimalRuntimeChrome ? 'h-8 px-2.5 py-1 text-[11px]' : runOfShowFocusMode ? 'h-9 px-3 py-1.5 text-[12px]' : denseChrome ? 'h-10 px-3 py-1.5 text-[12px]' : 'h-9 px-3 py-1.5 text-[12px]'} ${compactTopQuickStrip ? 'w-full min-w-0' : 'shrink-0 whitespace-nowrap'} normal-case tracking-[0.04em]`;
    const quickStripItemClass = compactTopQuickStrip ? 'relative min-w-0 flex-[1_1_calc(50%-0.25rem)]' : 'relative shrink-0';
    const automationActiveCount = [
        !!quickAutomationControls?.autoDj,
        !!quickAutomationControls?.autoBgMusic,
        !!quickAutomationControls?.autoEndOnTrackFinish,
        !!quickAutomationControls?.autoBonusEnabled,
        !!quickAutomationControls?.autoLyricsOnQueue,
        !!quickAutomationControls?.autoPartyEnabled,
        !!quickAutomationControls?.popTriviaEnabled,
    ].filter(Boolean).length;
    const queueLimitLabel = React.useMemo(
        () => quickRoomControls?.queueLimitOptions?.find((option) => option.id === quickRoomControls?.queueLimitMode)?.label || 'No Limits',
        [quickRoomControls]
    );
    const queueRotationLabel = React.useMemo(
        () => quickRoomControls?.queueRotationOptions?.find((option) => option.id === quickRoomControls?.queueRotation)?.label || 'Round Robin',
        [quickRoomControls]
    );
    const requestModeShortLabel = React.useMemo(
        () => quickRoomControls?.requestModeOptions?.find((option) => option.id === quickRoomControls?.requestMode)?.shortLabel || 'Host picks track',
        [quickRoomControls]
    );
    const quickRewardUsers = React.useMemo(() => {
        return (Array.isArray(users) ? users : [])
            .map((entry) => {
                const uid = String(entry?.uid || entry?.id || '').trim();
                if (!uid) return null;
                return {
                    uid,
                    name: String(entry?.name || entry?.displayName || 'Guest').trim() || 'Guest',
                    points: Math.max(0, Number(entry?.points || 0) || 0)
                };
            })
            .filter(Boolean)
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [users]);
    const quickRewardTarget = React.useMemo(
        () => quickRewardUsers.find((entry) => entry.uid === quickRewardTargetUid) || null,
        [quickRewardTargetUid, quickRewardUsers]
    );
    const quickRewardCustomAmount = clampNumber(Math.round(Number(quickRewardCustomPoints || 0) || 0), 1, 5000, 100);
    const normalizedQueueAttentionCount = Math.max(0, Number(queueAttentionCount || 0));
    const normalizedQueueAttentionNeedsHost = !!queueAttentionNeedsHost
        || !!moderationNeedsAttention
        || Number(moderationPendingCount || 0) > 0
        || moderationSeverity === 'stale'
        || moderationSeverity === 'critical';
    const queueAttentionVisible = normalizedQueueAttentionCount > 0 && tab !== 'stage';
    const nextQueuePreview = React.useMemo(() => (
        (Array.isArray(queuePreviewSongs) ? queuePreviewSongs : [])
            .filter(Boolean)
            .slice(0, 3)
            .map((song, index) => ({
                id: String(song?.id || `${index}`).trim() || `${index}`,
                singerName: String(song?.singerName || song?.name || 'Guest').trim() || 'Guest',
                songTitle: String(song?.songTitle || song?.title || 'Song').trim() || 'Song',
                artist: String(song?.artist || song?.artistName || '').trim(),
                avatar: String(song?.emoji || song?.avatar || '').trim(),
                artworkUrl: String(song?.albumArtUrl || song?.artworkUrl100 || song?.artworkUrl || song?.art || '').trim()
            }))
    ), [queuePreviewSongs]);
    const queuePreviewCount = nextQueuePreview.length;
    const queueAttentionBadgeClass = normalizedQueueAttentionNeedsHost
        ? 'border-pink-100/70 bg-[linear-gradient(135deg,rgba(236,72,153,0.96),rgba(190,24,93,0.92))] text-white shadow-[0_0_18px_rgba(236,72,153,0.42)]'
        : 'border-pink-300/35 bg-[linear-gradient(135deg,rgba(236,72,153,0.18),rgba(190,24,93,0.24))] text-pink-50 shadow-[0_0_14px_rgba(236,72,153,0.24)]';
    const anyTopMenuOpen = audioPanelOpen
        || showTvQuickMenu
        || showOverlaysMenu
        || showScenesQuickMenu
        || showSfxQuickMenu
        || showVibeQuickMenu
        || showAutomationQuickMenu
        || showQueueQuickMenu
        || showRewardsQuickMenu
        || showStatusQuickMenu
        || showLaunchMenu
        || showNavMenu;
    const showMissionStatusBanner = missionControlEnabled
        && missionStatus === 'needs_attention'
        && missionRecommendation?.id !== 'crowd_check';
    const crowdPulseMeta = crowdPulse && typeof crowdPulse === 'object' ? crowdPulse : null;
    const crowdPulseLabel = crowdPulseMeta?.alignmentLabel || crowdPulseMeta?.label || 'Waiting On Phones';
    const crowdPulseSummary = crowdPulseMeta?.alignmentSummary || crowdPulseMeta?.summary || 'No audience signal yet.';
    const crowdPulsePct = crowdPulseMeta?.metrics?.alignmentPct || 0;
    const normalizedRunOfShowDirector = React.useMemo(
        () => normalizeRunOfShowDirector(runOfShowDirector || {}),
        [runOfShowDirector]
    );
    const normalizedRunOfShowItems = React.useMemo(
        () => (Array.isArray(normalizedRunOfShowDirector.items) ? normalizedRunOfShowDirector.items.slice() : []),
        [normalizedRunOfShowDirector]
    );
    const safeRunOfShowPreflightReport = runOfShowPreflightReport && typeof runOfShowPreflightReport === 'object'
        ? runOfShowPreflightReport
        : {
            itemCount: normalizedRunOfShowItems.length,
            readyCount: 0,
            criticalCount: 0,
            riskyCount: 0,
            pendingApprovalCount: 0,
            readyToStart: normalizedRunOfShowItems.length > 0,
            criticalItems: [],
            riskyItems: [],
            summary: normalizedRunOfShowItems.length ? 'Show plan is loaded.' : 'Add at least one block before the show starts.'
        };
    const runOfShowAutomationPaused = !!normalizedRunOfShowDirector?.automationPaused;
    const hasRunOfShowPlan = normalizedRunOfShowItems.length > 0;
    const _compactRunOfShowItems = normalizedRunOfShowItems.map((item, index) => {
            const status = String(item?.status || '').trim().toLowerCase();
            const type = String(item?.type || '').trim().toLowerCase();
            const isLive = item?.id && item.id === runOfShowLiveItem?.id;
            const isStaged = item?.id && item.id === runOfShowStagedItem?.id;
            const isNext = item?.id && item.id === runOfShowNextItem?.id;
            const isComplete = ['complete', 'skipped'].includes(status);
            const durationSec = getRunOfShowDurationSec(item);
            const badgeLabel = isLive
                ? 'Live'
                : isStaged
                    ? 'Staged'
                    : isNext
                        ? 'Next'
                        : status === 'complete'
                            ? 'Done'
                            : status === 'skipped'
                                ? 'Skipped'
                                : `#${Number(item?.sequence || index + 1)}`;
            const cardToneClass = isComplete
                ? 'border-zinc-700/80 bg-zinc-900/88 text-zinc-400 opacity-60 saturate-0'
                : type === 'performance'
                    ? 'border-fuchsia-300/30 bg-fuchsia-500/12 text-fuchsia-100'
                    : type.includes('trivia') || type.includes('game') || type.includes('would_you_rather')
                        ? 'border-amber-300/30 bg-amber-500/12 text-amber-100'
                        : type === 'announcement' || type === 'intro' || type === 'closing'
                            ? 'border-cyan-300/30 bg-cyan-500/12 text-cyan-100'
                            : 'border-white/10 bg-white/5 text-zinc-100';
            const statusToneClass = isLive
                ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-100'
                : isStaged
                    ? 'border-sky-300/35 bg-sky-500/14 text-sky-100'
                    : status === 'blocked'
                        ? 'border-rose-300/35 bg-rose-500/12 text-rose-100'
                        : isNext
                            ? 'border-amber-300/35 bg-amber-500/12 text-amber-100'
                            : 'border-white/10 bg-black/25 text-zinc-300';
        return {
                id: item?.id || `run-of-show-${index}`,
                title: String(item?.title || '').trim() || getRunOfShowItemLabel(item?.type),
                detail: type.replace(/_/g, ' '),
                summary: type === 'performance'
                    ? [item?.assignedPerformerName || '', item?.songTitle || '', item?.artistName || ''].filter(Boolean).join(' - ')
                    : String(item?.presentationPlan?.headline || item?.modeLaunchPlan?.modeKey || '').trim(),
                status,
                badgeLabel,
                cardToneClass,
                statusToneClass,
                durationSec,
                durationLabel: formatRunOfShowDuration(durationSec),
                isComplete,
                isLive,
                isStaged,
                isNext,
                artworkUrl: String(
                    item?.albumArtUrl
                    || item?.artworkUrl
                    || item?.backingPlan?.artworkUrl
                    || item?.presentationPlan?.backgroundMedia
                    || ''
                ).trim(),
                iconClass: type === 'performance'
                    ? 'fa-microphone-lines'
                    : type.includes('trivia') || type.includes('game') || type.includes('would_you_rather')
                        ? 'fa-lightbulb'
                        : type === 'announcement' || type === 'intro' || type === 'closing'
                            ? 'fa-bullhorn'
                            : 'fa-wave-square'
        };
    });
    const _runOfShowTransportStatus = runOfShowLiveItem?.id
        ? 'live'
        : runOfShowStagedItem?.id
            ? 'staged'
            : runOfShowNextItem?.id
                ? 'ready'
                : 'idle';
    const topCriticalRunOfShowItem = safeRunOfShowPreflightReport?.criticalItems?.[0] || null;
    const topRiskyRunOfShowItem = safeRunOfShowPreflightReport?.riskyItems?.[0] || null;
    const _runOfShowHudState = getRunOfShowHudState({
        hasPlan: hasRunOfShowPlan,
        runEnabled: runOfShowEnabled,
        automationPaused: runOfShowAutomationPaused,
        preflightReport: safeRunOfShowPreflightReport,
        issueDetail: topCriticalRunOfShowItem?.summary || topRiskyRunOfShowItem?.summary || '',
        liveItemId: runOfShowLiveItem?.id,
        stagedItemId: runOfShowStagedItem?.id,
        nextItemId: runOfShowNextItem?.id
    });
    const _runOfShowHudActionKey = getRunOfShowHudActionKey({
        hasPlan: hasRunOfShowPlan,
        runEnabled: runOfShowEnabled,
        automationPaused: runOfShowAutomationPaused,
        preflightReport: safeRunOfShowPreflightReport,
        hasIssue: !!(topCriticalRunOfShowItem || topRiskyRunOfShowItem)
    });
    const showTimeClockEnabled = runOfShowEnabled || tab === 'run_of_show' || tab === 'show';
    const [showTimeNow, setShowTimeNow] = React.useState(() => Date.now());
    const [showTimeDisplayMode, setShowTimeDisplayMode] = React.useState('time');
    const showTimeLabel = React.useMemo(() => (
        new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
        }).format(showTimeNow)
    ), [showTimeNow]);
    const showTimeRemainingSec = React.useMemo(() => {
        if (!runOfShowEnabled || !normalizedRunOfShowItems.length) return 0;
        const activeIndex = normalizedRunOfShowItems.findIndex((item) => (
            item?.id
            && (
                item.id === runOfShowLiveItem?.id
                || item.id === runOfShowStagedItem?.id
                || item.id === runOfShowNextItem?.id
            )
        ));
        const fallbackIndex = normalizedRunOfShowItems.findIndex((item) => {
            const status = String(item?.status || '').trim().toLowerCase();
            return !['complete', 'skipped'].includes(status);
        });
        const startIndex = activeIndex >= 0 ? activeIndex : fallbackIndex;
        if (startIndex < 0) return 0;
        let remainingSec = 0;
        normalizedRunOfShowItems.forEach((item, index) => {
            const status = String(item?.status || '').trim().toLowerCase();
            if (index < startIndex || ['complete', 'skipped'].includes(status)) return;
            const isLive = item?.id && item.id === runOfShowLiveItem?.id;
            const isPerformance = String(item?.type || '').trim().toLowerCase() === 'performance';
            const performanceIntroActive = isLive
                && isPerformance
                && room?.announcement?.active
                && String(room?.announcement?.runOfShowItemId || '').trim() === String(item?.id || '').trim()
                && String(room?.announcement?.takeoverScene || room?.announcement?.type || '').trim().toLowerCase() === 'performance_intro';
            const baseDurationSec = Math.max(0, Number(getRunOfShowDurationSec(item) || 0));
            if (!isLive) {
                remainingSec += baseDurationSec;
                return;
            }
            const liveDurationSec = Math.max(
                0,
                Number(
                    isPerformance
                        ? (
                            performanceIntroActive
                                ? (room?.announcement?.durationSec || baseDurationSec)
                                : (room?.currentPerformanceMeta?.durationSec || baseDurationSec)
                        )
                        : baseDurationSec
                ) || 0
            );
            const liveStartedAtMs = Math.max(
                0,
                Number(
                    isPerformance
                        ? (
                            performanceIntroActive
                                ? (room?.announcement?.startedAtMs || item?.liveStartedAtMs || 0)
                                : (room?.currentPerformanceMeta?.startedAtMs || item?.liveStartedAtMs || 0)
                        )
                        : (item?.liveStartedAtMs || 0)
                ) || 0
            );
            if (liveDurationSec > 0 && liveStartedAtMs > 0) {
                remainingSec += Math.max(0, liveDurationSec - ((showTimeNow - liveStartedAtMs) / 1000));
            } else {
                remainingSec += liveDurationSec;
            }
        });
        return Math.max(0, Math.ceil(remainingSec));
    }, [
        normalizedRunOfShowItems,
        room?.announcement?.active,
        room?.announcement?.durationSec,
        room?.announcement?.runOfShowItemId,
        room?.announcement?.startedAtMs,
        room?.announcement?.takeoverScene,
        room?.announcement?.type,
        room?.currentPerformanceMeta?.durationSec,
        room?.currentPerformanceMeta?.startedAtMs,
        runOfShowEnabled,
        runOfShowLiveItem?.id,
        runOfShowNextItem?.id,
        runOfShowStagedItem?.id,
        showTimeNow
    ]);
    const showTimeHasPlannedEnd = showTimeRemainingSec > 0;
    const showTimeRemainingLabel = React.useMemo(
        () => formatRemainingShowTime(showTimeRemainingSec),
        [showTimeRemainingSec]
    );
    const showTimePrimaryLabel = showTimeDisplayMode === 'remaining' && showTimeHasPlannedEnd
        ? showTimeRemainingLabel
        : showTimeLabel;
    const showTimeModeLabel = showTimeDisplayMode === 'remaining' && showTimeHasPlannedEnd
        ? 'Show Left'
        : 'Now';
    React.useEffect(() => {
        try {
            window.localStorage.setItem('bross_host_compact_run_of_show_collapsed', compactRunOfShowCollapsed ? '1' : '0');
        } catch {
            // Ignore storage failures for host chrome preferences.
        }
    }, [compactRunOfShowCollapsed]);
    React.useEffect(() => {
        if (runOfShowFocusMode || !(runOfShowEnabled || hasRunOfShowPlan)) {
            setCompactRunOfShowCollapsed(false);
        }
    }, [hasRunOfShowPlan, runOfShowEnabled, runOfShowFocusMode]);
    React.useEffect(() => {
        if (!showTimeClockEnabled || !showTimeHasPlannedEnd) {
            setShowTimeDisplayMode('time');
            return undefined;
        }
        setShowTimeDisplayMode('time');
        const timer = window.setInterval(() => {
            setShowTimeDisplayMode((prev) => (prev === 'time' ? 'remaining' : 'time'));
        }, 5000);
        return () => window.clearInterval(timer);
    }, [showTimeClockEnabled, showTimeHasPlannedEnd]);
    const liveModeHostGuide = bangerActive
        ? {
            toneClass: 'border-orange-400/45 bg-orange-500/12 text-orange-100',
            title: 'Banger Host Playbook',
            summary: 'Keep momentum high with fast singer handoffs and frequent crowd prompts.',
            actions: 'Host actions: call for Hype/Clap bursts every 20-30s, drop short SFX accents, and switch out when energy plateaus.'
        }
        : balladActive
            ? {
                toneClass: 'border-pink-300/45 bg-pink-500/12 text-pink-100',
                title: 'Ballad Host Playbook',
                summary: 'Slow the room down and focus attention on the singer and lyrics.',
                actions: 'Host actions: keep Lyrics + Viz on TV, reduce noisy overlays/SFX, and prompt hearts + singalong chat.'
            }
            : null;
    const closeAllDeckMenus = React.useCallback(() => {
        setAudioPanelOpen?.(false);
        setShowTvQuickMenu(false);
        setShowOverlaysMenu(false);
        setShowScenesQuickMenu(false);
        setShowSfxQuickMenu(false);
        setShowVibeQuickMenu(false);
        setShowAutomationQuickMenu(false);
        setShowQueueQuickMenu(false);
        setShowRewardsQuickMenu(false);
        setShowStatusQuickMenu(false);
    }, [setAudioPanelOpen]);
    const closeAllTopMenus = React.useCallback(() => {
        closeAllDeckMenus();
        setShowLaunchMenu(false);
        setShowNavMenu(false);
    }, [closeAllDeckMenus, setShowLaunchMenu, setShowNavMenu]);
    const openLaunchTarget = React.useCallback((targetUrl = '') => {
        const nextUrl = String(targetUrl || '').trim();
        if (!nextUrl || typeof window === 'undefined') return;
        closeAllTopMenus();
        window.open(nextUrl, '_blank', 'noopener,noreferrer');
    }, [closeAllTopMenus]);
    const commitRoomPatch = React.useCallback((patch) => {
        Promise.resolve(updateRoom?.(patch)).catch(() => {});
    }, [updateRoom]);
    const fireRoomReward = React.useCallback((points) => {
        const amount = clampNumber(Math.round(Number(points || 0) || 0), 1, 5000, 100);
        if (typeof onDropBonus !== 'function') return;
        onDropBonus(amount);
        closeAllTopMenus();
    }, [closeAllTopMenus, onDropBonus]);
    const fireUserReward = React.useCallback((points, uid = quickRewardTargetUid) => {
        const targetUid = String(uid || '').trim();
        const amount = clampNumber(Math.round(Number(points || 0) || 0), 1, 5000, 100);
        if (!targetUid || typeof onGiftPointsToUser !== 'function') return;
        onGiftPointsToUser(targetUid, amount);
        closeAllTopMenus();
    }, [closeAllTopMenus, onGiftPointsToUser, quickRewardTargetUid]);
    const updateQuickTimedRefill = React.useCallback((patch = {}) => {
        const current = createEventCreditsDraft(room?.eventCredits || {});
        const turnsRefillOn = patch.timedLobbyEnabled === true || Number(patch.timedLobbyPoints || 0) > 0;
        const nextCredits = createEventCreditsDraft({
            ...current,
            ...patch,
            enabled: current.enabled === true || turnsRefillOn,
            creditEarningMode: 'custom',
        });
        commitRoomPatch({ eventCredits: buildProvisionEventCreditsPayload(nextCredits) });
    }, [commitRoomPatch, room?.eventCredits]);
    const blockRangeWheelDefault = React.useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.currentTarget === document.activeElement) {
            event.currentTarget.blur();
        }
    }, []);

    React.useEffect(() => {
        if (!visualizerSliderDraggingRef.current.sensitivity) {
            setVisualizerSensitivityDraft(roomVisualizerSensitivity);
        }
    }, [roomVisualizerSensitivity]);

    React.useEffect(() => {
        if (!visualizerSliderDraggingRef.current.smoothing) {
            setVisualizerSmoothingDraft(roomVisualizerSmoothing);
        }
    }, [roomVisualizerSmoothing]);

    React.useEffect(() => {
        if (!sliderDraggingRef.current.stage) {
            setStageVolumeDraft(roomVideoVolume);
        }
    }, [roomVideoVolume]);

    React.useEffect(() => {
        if (!sliderDraggingRef.current.bg) {
            setBgVolumeDraftPct(roomBgVolumePct);
        }
    }, [roomBgVolumePct]);

    React.useEffect(() => {
        if (!sliderDraggingRef.current.mix) {
            setMixFaderDraft(roomMixFader);
        }
    }, [roomMixFader]);

    React.useEffect(() => {
        if (!sliderDraggingRef.current.sfx) {
            setSfxVolumeDraftPct(roomSfxVolumePct);
        }
    }, [roomSfxVolumePct]);

    const handleVisualizerSliderDraftChange = React.useCallback((field, rawValue) => {
        if (field === 'visualizerSensitivity') {
            const next = clampNumber(rawValue, 0.5, 2.5, visualizerSensitivityDraft);
            setVisualizerSensitivityDraft(next);
            if (!visualizerSliderDraggingRef.current.sensitivity) {
                commitRoomPatch({ visualizerSensitivity: next });
            }
            return;
        }
        const next = clampNumber(rawValue, 0, 0.95, visualizerSmoothingDraft);
        setVisualizerSmoothingDraft(next);
        if (!visualizerSliderDraggingRef.current.smoothing) {
            commitRoomPatch({ visualizerSmoothing: next });
        }
    }, [visualizerSensitivityDraft, visualizerSmoothingDraft, commitRoomPatch]);

    const commitVisualizerSliderChange = React.useCallback((field, rawValue) => {
        if (field === 'visualizerSensitivity') {
            visualizerSliderDraggingRef.current.sensitivity = false;
            const next = clampNumber(rawValue, 0.5, 2.5, visualizerSensitivityDraft);
            setVisualizerSensitivityDraft(next);
            commitRoomPatch({ visualizerSensitivity: next });
            return;
        }
        visualizerSliderDraggingRef.current.smoothing = false;
        const next = clampNumber(rawValue, 0, 0.95, visualizerSmoothingDraft);
        setVisualizerSmoothingDraft(next);
        commitRoomPatch({ visualizerSmoothing: next });
    }, [visualizerSensitivityDraft, visualizerSmoothingDraft, commitRoomPatch]);

    const handleStageVolumeDraftChange = React.useCallback((rawValue) => {
        const next = Math.round(clampNumber(rawValue, 0, 100, stageVolumeDraft));
        setStageVolumeDraft(next);
        if (!sliderDraggingRef.current.stage) {
            commitRoomPatch({ videoVolume: next });
        }
    }, [stageVolumeDraft, commitRoomPatch]);

    const commitStageVolumeChange = React.useCallback((rawValue) => {
        sliderDraggingRef.current.stage = false;
        const next = Math.round(clampNumber(rawValue, 0, 100, stageVolumeDraft));
        setStageVolumeDraft(next);
        commitRoomPatch({ videoVolume: next });
    }, [stageVolumeDraft, commitRoomPatch]);

    const handleBgVolumeDraftChange = React.useCallback((rawValue) => {
        const nextPct = Math.round(clampNumber(rawValue, 0, 100, bgVolumeDraftPct));
        const nextValue = nextPct / 100;
        setBgVolumeDraftPct(nextPct);
        setBgVolume(nextValue);
        if (!sliderDraggingRef.current.bg) {
            commitRoomPatch({ bgMusicVolume: nextValue });
        }
    }, [bgVolumeDraftPct, setBgVolume, commitRoomPatch]);

    const commitBgVolumeChange = React.useCallback((rawValue) => {
        sliderDraggingRef.current.bg = false;
        const nextPct = Math.round(clampNumber(rawValue, 0, 100, bgVolumeDraftPct));
        const nextValue = nextPct / 100;
        setBgVolumeDraftPct(nextPct);
        setBgVolume(nextValue);
        commitRoomPatch({ bgMusicVolume: nextValue });
    }, [bgVolumeDraftPct, setBgVolume, commitRoomPatch]);

    const handleMixFaderDraftChange = React.useCallback((rawValue) => {
        const next = Math.round(clampNumber(rawValue, 0, 100, mixFaderDraft));
        setMixFaderDraft(next);
        handleMixFaderChange(next, { commit: !sliderDraggingRef.current.mix });
    }, [mixFaderDraft, handleMixFaderChange]);

    const commitMixFaderChange = React.useCallback((rawValue) => {
        sliderDraggingRef.current.mix = false;
        const next = Math.round(clampNumber(rawValue, 0, 100, mixFaderDraft));
        setMixFaderDraft(next);
        handleMixFaderChange(next, { commit: true });
    }, [mixFaderDraft, handleMixFaderChange]);

    const handleSfxVolumeDraftChange = React.useCallback((rawValue) => {
        const nextPct = Math.round(clampNumber(rawValue, 0, 100, sfxVolumeDraftPct));
        setSfxVolumeDraftPct(nextPct);
        setSfxVolume?.(nextPct / 100);
    }, [sfxVolumeDraftPct, setSfxVolume]);

    const commitSfxVolumeChange = React.useCallback((rawValue) => {
        sliderDraggingRef.current.sfx = false;
        const nextPct = Math.round(clampNumber(rawValue, 0, 100, sfxVolumeDraftPct));
        setSfxVolumeDraftPct(nextPct);
        setSfxVolume?.(nextPct / 100);
    }, [sfxVolumeDraftPct, setSfxVolume]);

    React.useEffect(() => {
        const flushSliderDrafts = () => {
            if (visualizerSliderDraggingRef.current.sensitivity) {
                commitVisualizerSliderChange('visualizerSensitivity', visualizerSensitivityDraft);
            }
            if (visualizerSliderDraggingRef.current.smoothing) {
                commitVisualizerSliderChange('visualizerSmoothing', visualizerSmoothingDraft);
            }
            if (sliderDraggingRef.current.stage) {
                commitStageVolumeChange(stageVolumeDraft);
            }
            if (sliderDraggingRef.current.bg) {
                commitBgVolumeChange(bgVolumeDraftPct);
            }
            if (sliderDraggingRef.current.mix) {
                commitMixFaderChange(mixFaderDraft);
            }
            if (sliderDraggingRef.current.sfx) {
                commitSfxVolumeChange(sfxVolumeDraftPct);
            }
        };

        window.addEventListener('pointerup', flushSliderDrafts, { passive: true });
        window.addEventListener('pointercancel', flushSliderDrafts, { passive: true });
        window.addEventListener('mouseup', flushSliderDrafts, { passive: true });
        window.addEventListener('touchend', flushSliderDrafts, { passive: true });
        return () => {
            window.removeEventListener('pointerup', flushSliderDrafts);
            window.removeEventListener('pointercancel', flushSliderDrafts);
            window.removeEventListener('mouseup', flushSliderDrafts);
            window.removeEventListener('touchend', flushSliderDrafts);
        };
    }, [
        bgVolumeDraftPct,
        commitBgVolumeChange,
        commitMixFaderChange,
        commitSfxVolumeChange,
        commitStageVolumeChange,
        commitVisualizerSliderChange,
        mixFaderDraft,
        sfxVolumeDraftPct,
        stageVolumeDraft,
        visualizerSensitivityDraft,
        visualizerSmoothingDraft,
    ]);

    React.useEffect(() => {
        if (!showTimeClockEnabled) return undefined;
        const timer = window.setInterval(() => setShowTimeNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [showTimeClockEnabled]);

    React.useEffect(() => {
        if (!anyTopMenuOpen) return undefined;
        const handleEscape = (event) => {
            if (event.key === 'Escape') closeAllTopMenus();
        };
        window.addEventListener('keydown', handleEscape);
        return () => {
            window.removeEventListener('keydown', handleEscape);
        };
    }, [anyTopMenuOpen, closeAllTopMenus]);
    const buildCrowdObjectiveRoomPatch = React.useCallback((modeLightMode) => {
        if (!modeLightMode) return {};
        const turningOff = room?.lightMode === modeLightMode;
        return {
            lightMode: turningOff ? 'off' : modeLightMode,
            lobbyVolleyEnabled: true,
            ...(turningOff ? {} : { activeMode: 'karaoke' })
        };
    }, [room?.lightMode]);

    const runLiveEffect = async (effectId) => {
        if (effectId === 'beat_drop') {
            if (strobeActive) {
                await updateRoom({ lightMode: 'off' });
            } else {
                await startBeatDrop?.();
            }
        } else if (effectId === 'storm') {
            if (stormActive) {
                await stopStormSequence?.();
            } else {
                await startStormSequence?.();
            }
        } else if (effectId === 'guitar') {
            await updateRoom({
                lightMode: guitarActive ? 'off' : 'guitar',
                guitarSessionId: Date.now(),
                guitarWinner: null,
                guitarVictory: null
            });
        } else if (effectId === 'banger') {
            await updateRoom({ lightMode: bangerActive ? 'off' : 'banger' });
        } else if (effectId === 'ballad') {
            await updateRoom({ lightMode: balladActive ? 'off' : 'ballad' });
        } else if (effectId === 'volley') {
            await updateRoom(buildCrowdObjectiveRoomPatch('volley'));
        } else if (effectId === 'selfie_cam') {
            await updateRoom({ activeMode: selfieCamActive ? 'karaoke' : 'selfie_cam' });
        } else if (effectId === 'clear') {
            if (stormActive) {
                await stopStormSequence?.();
            } else {
                await updateRoom({
                    lightMode: 'off',
                    stormPhase: 'off',
                    activeMode: ['selfie_cam', 'selfie_challenge'].includes(String(room?.activeMode || '')) ? 'karaoke' : room?.activeMode,
                    bonusDrop: null,
                    selfieMoment: null,
                    selfieMomentExpiresAt: null,
                    selfieChallenge: null,
                    photoOverlay: null
                });
            }
        }
    };
    const applyTvDisplayMode = async (mode) => {
        if (mode === 'lyrics') {
            await updateRoom({ showLyricsTv: true, showVisualizerTv: false, lyricsMode: room?.lyricsMode || 'auto' });
        } else if (mode === 'visualizer') {
            await updateRoom({ showLyricsTv: false, showVisualizerTv: true });
        } else if (mode === 'lyrics_viz') {
            await updateRoom({ showLyricsTv: true, showVisualizerTv: true, lyricsMode: room?.lyricsMode || 'auto' });
        } else {
            await updateRoom({ showLyricsTv: false, showVisualizerTv: false });
        }
    };
    const applyLyricsScrollMode = async (mode) => {
        const nextMode = mode === 'manual' ? 'manual' : 'auto';
        await updateRoom({ lyricsScrollMode: nextMode, showLyricsTv: true, lyricsMode: room?.lyricsMode || 'auto' });
    };
    const applyAudienceDisplayMode = async (mode) => {
        if (typeof quickRoomControls?.onSetAudienceDisplayMode === 'function') {
            await quickRoomControls.onSetAudienceDisplayMode(mode);
        }
    };
    const toggleCrowdObjectiveMode = async (modeLightMode) => {
        if (!modeLightMode) return;
        await updateRoom(buildCrowdObjectiveRoomPatch(modeLightMode));
    };
    const applyTvPresentationProfile = async (profile) => {
        const nextProfile = profile === 'simple' || profile === 'cinema' ? profile : 'room';
        await updateRoom({ tvPresentationProfile: nextProfile });
    };
    const toggleOverlayScreen = async (screenId) => {
        const nextScreen = room?.activeScreen === screenId ? 'stage' : screenId;
        await updateRoom({ activeScreen: nextScreen });
    };
    const toggleHowToPlayOverlay = async () => {
        await toggleHowToPlay?.();
    };
    const toggleMarqueeOverlay = async () => {
        const next = !marqueeActive;
        setMarqueeEnabled?.(next);
        await updateRoom({ marqueeEnabled: next });
    };
    const toggleChatTvOverlay = async () => {
        const next = !chatTvActive;
        setChatShowOnTv?.(next);
        const nextMode = next ? (chatTvMode || 'auto') : 'auto';
        setChatTvMode?.(nextMode);
        await updateRoom({ chatShowOnTv: next, chatTvMode: nextMode });
    };
    const toggleChatTvFullscreen = async () => {
        const nextFullscreen = !chatFullscreenActive;
        setChatShowOnTv?.(true);
        setChatTvMode?.(nextFullscreen ? 'fullscreen' : 'auto');
        await updateRoom({
            chatShowOnTv: true,
            chatTvMode: nextFullscreen ? 'fullscreen' : 'auto'
        });
    };
    const togglePopTriviaOverlay = async () => {
        const next = !popTriviaActive;
        setPopTriviaEnabled?.(next);
        await updateRoom({ popTriviaEnabled: next });
    };
    const crowdModeSummary = getCrowdModeSummary({
        chatShowOnTv,
        chatTvMode,
        showScoring: room?.showScoring !== false,
        marqueeEnabled,
        popTriviaEnabled,
    });
    const applyCrowdModePreset = async (presetId) => {
        if (typeof onApplyCrowdModePreset === 'function') {
            await onApplyCrowdModePreset(presetId, { surface: 'top_chrome' });
            return;
        }
        const patch = buildCrowdModePatch(presetId, {
            chatShowOnTv,
            chatTvMode,
            showScoring: room?.showScoring !== false,
            marqueeEnabled,
            popTriviaEnabled,
        });
        setChatShowOnTv?.(patch.chatShowOnTv);
        setChatTvMode?.(patch.chatTvMode);
        setMarqueeEnabled?.(patch.marqueeEnabled);
        setPopTriviaEnabled?.(patch.popTriviaEnabled);
        await updateRoom(patch);
    };
    const operatingStyleSummary = getOperatingStyleSummary({
        autoPlayMedia: quickRoomControls?.autoPlayMedia !== false,
        readyCheckDurationSec: quickRoomControls?.readyCheckDurationSec,
        queueSettings: {
            limitMode: quickRoomControls?.queueLimitMode,
            limitCount: quickRoomControls?.queueLimitCount,
            rotation: quickRoomControls?.queueRotation,
            firstTimeBoost: quickRoomControls?.queueFirstTimeBoost,
        },
    });
    const activeRoomControlModel = quickRoomControls?.oneMinuteMicEnabled
        ? 'crowd_driven'
        : quickAutomationControls?.autoDj
            ? 'assisted_host'
            : 'host_led';
    const activeRoomControlModelOption = ROOM_CONTROL_MODEL_OPTIONS.find((option) => option.id === activeRoomControlModel) || ROOM_CONTROL_MODEL_OPTIONS[0];
    const oneMinuteMicLiveStatus = quickRoomControls?.oneMinuteMicLiveStatus || null;
    const oneMinuteMicStatusToneClass = oneMinuteMicLiveStatus?.tone === 'live'
        ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'
        : oneMinuteMicLiveStatus?.tone === 'armed'
            ? 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100'
            : oneMinuteMicLiveStatus?.tone === 'resolved'
                ? 'border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100'
                : 'border-white/10 bg-white/5 text-zinc-200';
    const applyOperatingStylePreset = async (presetId) => {
        if (typeof onApplyOperatingStylePreset === 'function') {
            await onApplyOperatingStylePreset(presetId, { surface: 'top_chrome' });
            return;
        }
        const patch = buildOperatingStylePatch(presetId);
        await quickRoomControls?.onUpdateQueueSettings?.(patch.queueSettings);
        await quickRoomControls?.onSetReadyCheckDuration?.(patch.readyCheckDurationSec);
        await quickRoomControls?.onToggleAutoPlayMedia?.(patch.autoPlayMedia);
    };
    const openOpsSection = React.useCallback((sectionId = 'ops.room_setup') => {
        closeAllTopMenus();
        if (typeof openAdminWorkspace === 'function') {
            openAdminWorkspace(sectionId);
            return;
        }
        setShowSettings?.(true);
        const directSettingsTabs = new Set(['media', 'general', 'gamepad', 'automations', 'audience_setup']);
        setSettingsTab?.(directSettingsTabs.has(sectionId) ? sectionId : (sectionId === 'ops.automation' ? 'automations' : 'general'));
    }, [closeAllTopMenus, openAdminWorkspace, setSettingsTab, setShowSettings]);
    const topStatusItems = [
        {
            key: 'apple',
            label: 'Apple Music',
            iconClass: 'fa-brands fa-apple',
            active: appleMusicConnected,
            detail: appleMusicConnected ? 'Connected for playback and catalog lookup.' : 'Open Media Setup to connect Apple Music.',
            actionLabel: appleMusicConnected ? 'Media Setup' : 'Connect',
            action: () => openOpsSection('media'),
        },
        {
            key: 'ai',
            label: 'AI Tools',
            iconClass: 'fa-solid fa-robot',
            active: aiToolsConnected,
            detail: aiToolsConnected ? 'AI tools are available.' : 'Review host access and workspace setup.',
            actionLabel: aiToolsConnected ? 'Review' : 'Fix Access',
            action: () => openOpsSection('ops.room_setup'),
        },
        ...(youtubeBudgetStatus ? [{
            key: 'youtube',
            label: youtubeBudgetStatus.label || 'YouTube Search',
            iconClass: 'fa-brands fa-youtube',
            active: youtubeBudgetStatus.active !== false,
            detail: youtubeBudgetStatus.detail || youtubeBudgetStatus.title || 'Search budget status.',
            value: Number(youtubeBudgetStatus.value || 0).toLocaleString(),
            actionLabel: 'Open Search',
            action: () => { closeAllTopMenus(); setTab?.('stage'); },
        }] : []),
        {
            key: 'session',
            label: 'Host Session',
            iconClass: 'fa-solid fa-user-shield',
            active: authSessionReady,
            detail: authSessionReady ? `${String(permissionLevel || 'unknown').toUpperCase()} session active.` : 'Reload or sign in before hosting.',
            actionLabel: authSessionReady ? 'Room Setup' : 'Open Setup',
            action: () => openOpsSection('ops.room_setup'),
        },
        ...(crowdPulseMeta ? [{
            key: 'vibe',
            label: 'Vibe',
            iconClass: 'fa-solid fa-bolt',
            active: crowdPulsePct > 0,
            detail: `${crowdPulseLabel}: ${crowdPulseSummary}`,
            value: `${crowdPulsePct}%`,
            actionLabel: 'Audience',
            action: () => { closeAllTopMenus(); setTab?.('lobby'); },
        }] : []),
    ];
    const topStatusIssueCount = topStatusItems.filter((item) => item.active === false).length;
    const topStatusAllGreen = topStatusIssueCount === 0;
    const topStatusToneClass = topStatusAllGreen
        ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
        : topStatusIssueCount >= 2
            ? 'border-rose-400/35 bg-rose-500/10 text-rose-100'
            : 'border-amber-400/35 bg-amber-500/10 text-amber-100';
    const topStatusLabel = topStatusAllGreen ? 'Systems Ready' : `${topStatusIssueCount} Attention`;
    return (
    <div data-host-top-chrome="true" className={`bg-zinc-900 ${runOfShowFocusMode ? 'px-3.5 py-2' : minimalRuntimeChrome ? 'px-3 py-1.5' : adminWorkspaceChrome ? 'px-3 py-1.5' : denseChrome ? 'px-3 py-2' : 'px-4 py-2.5'} flex flex-col ${minimalRuntimeChrome ? 'gap-1' : adminWorkspaceChrome ? 'gap-1.5' : 'gap-2'} shadow-2xl shrink-0 relative isolate z-[160] overflow-visible border-b border-zinc-800`}>
        <div className={`flex flex-col ${minimalRuntimeChrome ? 'gap-1.5' : 'gap-2.5'} lg:flex-row lg:items-center lg:justify-between w-full`}>
            <div className="flex items-center gap-2 lg:gap-3">
                <img
                    src={room?.logoUrl || logoFallback}
                    className={`${minimalRuntimeChrome ? 'h-9 lg:h-10' : adminWorkspaceChrome ? 'h-9 lg:h-11' : runOfShowFocusMode ? 'h-10 lg:h-11' : 'h-11 lg:h-14'} object-contain rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.4)] ring-1 ring-white/10 bg-black/40 p-0.5`}
                    alt="Beaurocks Karaoke"
                />
                <div data-host-room-code className={`${minimalRuntimeChrome ? 'text-[12px] sm:text-[13px] lg:text-[14px] px-1.5 py-0.5' : adminWorkspaceChrome ? 'text-[12px] sm:text-[13px] lg:text-[14px] px-1.5 py-0.5' : denseChrome ? 'text-[13px] sm:text-[14px] lg:text-[16px] px-2 py-0.5' : 'text-[14px] sm:text-[16px] lg:text-[18px] px-2 py-0.5'} font-mono font-bold text-[#00C4D9] bg-black/40 rounded-lg border border-[#00C4D9]/30`}>{roomCode}</div>
                {typeof onOpenHostDashboard === 'function' && (
                    <button
                        onClick={() => {
                            closeAllTopMenus();
                            onOpenHostDashboard();
                        }}
                        className={`${styles.btnStd} ${styles.btnNeutral} ${minimalRuntimeChrome || adminWorkspaceChrome ? 'px-2 text-[11px]' : 'px-2.5 text-xs'}`}
                        title="Back to room manager and room creation"
                        style={{ touchAction: 'manipulation' }}
                    >
                        <i className="fa-solid fa-layer-group"></i>
                        {!minimalRuntimeChrome && !adminWorkspaceChrome ? <span className="hidden sm:inline">Room Manager</span> : null}
                    </button>
                )}
                <div className="relative" ref={launchMenuRef}>
                    <button
                        onClick={() => {
                            const next = !showLaunchMenu;
                            closeAllTopMenus();
                            setShowLaunchMenu(next);
                        }}
                        className={`${styles.btnStd} ${styles.btnSecondary} ${minimalRuntimeChrome || adminWorkspaceChrome ? 'px-2 text-[11px]' : 'px-2.5 text-xs'}`}
                        style={{ touchAction: 'manipulation' }}
                    >
                        <i className="fa-solid fa-rocket"></i>
                    </button>
                    {showLaunchMenu && (
                        <div className="absolute left-0 top-full mt-2 w-56 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-[100]">
                            <button
                                type="button"
                                onClick={() => openLaunchTarget(launchTvHref)}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900 rounded-t-xl"
                            >
                                <i className="fa-solid fa-tv mr-2 text-cyan-300"></i> Launch TV
                            </button>
                            <button
                                type="button"
                                onClick={() => openLaunchTarget(launchAudienceHref)}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                            >
                                <i className="fa-solid fa-mobile-screen-button mr-2 text-pink-300"></i> Launch Mobile
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (typeof onOpenCatalogueHelper === 'function') {
                                        closeAllTopMenus();
                                        onOpenCatalogueHelper();
                                        return;
                                    }
                                    openLaunchTarget(helperCatalogHref);
                                }}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                            >
                                <i className="fa-solid fa-book-open mr-2 text-yellow-300"></i> Open Helper Catalog
                            </button>
                            <button
                                type="button"
                                onClick={() => openLaunchTarget(helperCatalogHref)}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                            >
                                <i className="fa-solid fa-up-right-from-square mr-2 text-yellow-300"></i> Open Helper Window
                            </button>
                            <div className="px-4 py-2 text-sm uppercase tracking-[0.3em] text-zinc-500 border-t border-zinc-800">
                                Help
                            </div>
                            <button
                                type="button"
                                data-feature-id="launch-audience-help"
                                onClick={() => openLaunchTarget(audienceHelpHref)}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                            >
                                <i className="fa-solid fa-signs-post mr-2 text-amber-300"></i> Audience Help
                            </button>
                            <button
                                type="button"
                                data-feature-id="launch-cohost-help"
                                onClick={() => openLaunchTarget(coHostHelpHref)}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                            >
                                <i className="fa-solid fa-user-group mr-2 text-amber-300"></i> Co-Host Help
                            </button>
                            <button
                                type="button"
                                data-feature-id="launch-host-help"
                                onClick={() => openLaunchTarget(hostHelpHref)}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                            >
                                <i className="fa-solid fa-clipboard-list mr-2 text-amber-300"></i> Host Help
                            </button>
                        </div>
                    )}
                </div>
                {showTimeClockEnabled && !minimalRuntimeChrome && (
                    <div className={`ml-1 flex ${denseChrome ? 'min-w-[136px]' : 'min-w-[152px]'} items-center gap-1.5 rounded-2xl border border-cyan-300/20 bg-black/35 shadow-[0_12px_28px_rgba(0,0,0,0.24)] px-2.5 py-1`}>
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                            <i className="fa-solid fa-clock"></i>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-200/80">Show Time</div>
                                <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-300">
                                    {showTimeModeLabel}
                                </div>
                            </div>
                            <div className={`${runOfShowFocusMode ? 'mt-0 text-base' : 'mt-0.5 text-base'} truncate whitespace-nowrap font-black leading-none text-white tabular-nums`}>
                                {showTimePrimaryLabel}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className={`flex items-center ${minimalRuntimeChrome ? 'gap-1.5' : 'gap-2 lg:gap-3'} justify-between lg:justify-end`}>
                {room?.activeMode && room.activeMode !== 'karaoke' && (
                    <div data-host-live-mode={room.activeMode} className="bg-red-600 px-2.5 py-0.5 rounded text-xs lg:text-sm font-bold animate-pulse">LIVE: {room.activeMode.toUpperCase()}</div>
                )}
                <div className="hidden xl:flex items-center gap-2">
                    <div data-host-top-tabs="primary" className="relative z-10 shrink-0 flex items-center gap-2">
                        {[
                            { key: 'stage', label: 'Queue' },
                            { key: 'run_of_show', label: 'Show' },
                            { key: 'games', label: 'Games' },
                            { key: 'lobby', label: 'Audience' }
                        ].map(t => (
                            <button
                                key={t.key}
                                type="button"
                                data-host-tab={t.key}
                                onClick={() => {
                                    if (t.key === 'admin' && typeof openAdminWorkspace === 'function') {
                                        openAdminWorkspace('ops.room_setup');
                                        return;
                                    }
                                    setTab(t.key);
                                }}
                                className={`${minimalRuntimeChrome ? 'h-8 px-2 text-[11px]' : denseChrome ? 'h-9 px-2.5 text-[12px]' : 'h-9 px-2.5 text-sm'} relative z-10 inline-flex shrink-0 items-center font-black uppercase tracking-[0.2em] rounded-xl border-b-2 transition-all ${tab === t.key ? 'text-[#00C4D9] border-[#00C4D9] bg-black/40' : 'text-zinc-400 border-transparent bg-zinc-900/40 hover:text-white'}`}
                            >
                                <span>{t.label}</span>
                                {t.key === 'stage' && queueAttentionVisible ? (
                                    <span className={`ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-black tracking-normal ${queueAttentionBadgeClass}`}>
                                        {normalizedQueueAttentionCount}
                                    </span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                </div>
                {!minimalRuntimeChrome ? (
                    <div className="relative" ref={statusQuickMenuRef}>
                        <button
                            type="button"
                            data-feature-id="top-chrome-system-status"
                            aria-expanded={showStatusQuickMenu}
                            onClick={() => {
                                const next = !showStatusQuickMenu;
                                closeAllTopMenus();
                                setShowStatusQuickMenu(next);
                            }}
                            className={`inline-flex min-h-[34px] items-center gap-2 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition ${topStatusToneClass}`}
                            title="Open host system status"
                        >
                            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${topStatusAllGreen ? 'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.95)]' : topStatusIssueCount >= 2 ? 'bg-rose-300 shadow-[0_0_10px_rgba(252,165,165,0.8)]' : 'bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.8)]'}`}></span>
                            <i className="fa-solid fa-signal text-[10px]"></i>
                            <span className="hidden lg:inline">{topStatusLabel}</span>
                            <span className="lg:hidden">Status</span>
                            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${showStatusQuickMenu ? 'rotate-180' : ''}`}></i>
                        </button>
                        {showStatusQuickMenu ? (
                            <div className={`${quickMenuPanelClass} right-0 w-[min(420px,95vw)] p-3.5`}>
                                <div className={quickMenuSectionTitleClass}>System Status</div>
                                <div className={quickMenuSectionHintClass}>One place for host readiness, service access, and live audience signal.</div>
                                <div className="mt-3 space-y-2">
                                    {topStatusItems.map((item) => (
                                        <div key={item.key} className={`${quickMenuCardClass} flex items-start gap-3`}>
                                            <span className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${item.active ? 'bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.85)]' : 'bg-rose-300 shadow-[0_0_10px_rgba(252,165,165,0.65)]'}`}></span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <i className={`${item.iconClass} text-[11px] text-zinc-300`}></i>
                                                    <span className="text-sm font-black text-white">{item.label}</span>
                                                    {item.value ? <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">{item.value}</span> : null}
                                                </div>
                                                <div className="mt-1 text-xs leading-5 text-zinc-400">{item.detail}</div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={item.action}
                                                className={`${styles.btnStd} ${item.active ? styles.btnNeutral : styles.btnHighlight} shrink-0 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em]`}
                                            >
                                                {item.actionLabel}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}                <button
                    type="button"
                    data-host-tab="admin"
                    onClick={() => {
                        if (typeof openAdminWorkspace === 'function') {
                            openAdminWorkspace('ops.room_setup');
                            return;
                        }
                        setShowSettings(true);
                        setSettingsTab('general');
                    }}
                    className={`${minimalRuntimeChrome ? 'text-zinc-400' : 'text-zinc-500'} hover:text-white`}
                    title="Open Admin"
                >
                    <i className="fa-solid fa-gear text-base lg:text-lg"></i>
                </button>
                <div className="relative" ref={navMenuRef}>
                    <button
                        onClick={() => {
                            const next = !showNavMenu;
                            closeAllTopMenus();
                            setShowNavMenu(next);
                        }}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-3 text-sm xl:hidden`}
                        style={{ touchAction: 'manipulation' }}
                    >
                        <i className="fa-solid fa-bars"></i>
                    </button>
                    {showNavMenu && (
                        <div className="absolute right-0 top-full mt-2 w-44 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-[100]">
                            {typeof onOpenHostDashboard === 'function' && (
                                <button
                                    onClick={() => {
                                        closeAllTopMenus();
                                        onOpenHostDashboard();
                                    }}
                                    type="button"
                                    className="w-full text-left px-4 py-2 text-sm font-bold uppercase tracking-widest text-zinc-300 hover:bg-zinc-900 rounded-t-xl"
                                >
                                    Room Manager
                                </button>
                            )}
                            {[
                                { key: 'stage', label: 'Queue' },
                                { key: 'run_of_show', label: 'Show' },
                                { key: 'games', label: 'Games' },
                                { key: 'lobby', label: 'Audience' },
                                { key: 'admin', label: 'Admin' }
                            ].map(t => (
                                <button
                                    key={t.key}
                                    type="button"
                                    data-host-tab={t.key}
                                    onClick={() => {
                                        if (t.key === 'admin' && typeof openAdminWorkspace === 'function') {
                                            openAdminWorkspace('ops.room_setup');
                                            setShowNavMenu(false);
                                            return;
                                        }
                                        setTab(t.key);
                                        setShowNavMenu(false);
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm font-bold uppercase tracking-widest ${tab === t.key ? 'text-[#00C4D9]' : 'text-zinc-300'} hover:bg-zinc-900 ${
                                        t.key === 'stage' && typeof onOpenHostDashboard !== 'function' ? 'rounded-t-xl' : ''
                                    } ${t.key === 'admin' ? 'rounded-b-xl' : ''}`}
                                >
                                    <span>{t.label}</span>
                                    {t.key === 'stage' && queueAttentionVisible ? (
                                        <span className={`ml-2 inline-flex min-w-[20px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-black tracking-normal ${queueAttentionBadgeClass}`}>
                                            {normalizedQueueAttentionCount}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
        <button
            type="button"
            data-feature-id="host-next-queue-strip"
            onClick={() => setTab?.('stage')}
            className={`${runOfShowFocusMode ? 'hidden' : 'flex'} w-full min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-2.5 py-2 text-left shadow-[0_10px_26px_rgba(0,0,0,0.22)] transition hover:border-cyan-300/30 hover:bg-black/45`}
            title="Open queue"
        >
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                <i className="fa-solid fa-list-ol text-[10px]"></i>
                Next
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                {queuePreviewCount ? nextQueuePreview.map((song, index) => (
                    <span key={`host-next-${song.id}-${index}`} className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5">
                        {song.artworkUrl ? (
                            <img src={song.artworkUrl} alt="" className="h-7 w-7 flex-none rounded-md border border-white/10 object-cover" />
                        ) : (
                            <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-md border border-white/10 bg-black/30 text-xs text-cyan-100">
                                {song.avatar || index + 1}
                            </span>
                        )}
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-black text-white">{song.singerName}</span>
                            <span className="block truncate text-[11px] text-zinc-400">{song.songTitle}{song.artist ? ` - ${song.artist}` : ''}</span>
                        </span>
                    </span>
                )) : (
                    <span className="min-w-0 truncate rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-400">No one queued yet</span>
                )}
            </span>
            <i className="fa-solid fa-chevron-right shrink-0 text-xs text-zinc-500"></i>
        </button>
        <div data-host-quick-strip-wrap="true" className={`${runOfShowFocusMode || minimalRuntimeChrome ? 'hidden' : 'w-full'} overflow-visible rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-zinc-950/70 to-emerald-500/10 ${runOfShowFocusMode ? 'px-3 py-2' : minimalRuntimeChrome ? 'px-2 py-1.5' : adminWorkspaceChrome ? 'px-2.5 py-1.5' : denseChrome ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}>
                <div className={`host-top-quick-strip flex min-w-0 ${minimalRuntimeChrome ? 'gap-1' : denseChrome ? 'gap-1.5' : 'gap-2'} custom-scrollbar ${compactTopQuickStrip ? 'flex-wrap items-stretch overflow-visible pb-0' : anyTopMenuOpen ? 'flex-nowrap items-center overflow-visible pb-1 pr-0.5' : 'flex-nowrap items-center overflow-x-auto pb-1 pr-0.5'}`}>
                {!runOfShowFocusMode ? (
                    <div className={quickStripItemClass} ref={audioMenuRef}>
                        <div className="flex flex-nowrap items-center gap-2">
                            <button
                                type="button"
                                data-feature-id="deck-audio-menu-toggle"
                                onClick={() => {
                                    const next = !audioPanelOpen;
                                    closeAllTopMenus();
                                    setAudioPanelOpen(next);
                                }}
                                className={`${quickMenuToggleClass} ${compactTopQuickStrip ? '' : 'min-w-[132px]'} justify-between`}
                                title="Audio and mix controls"
                                style={{ touchAction: 'manipulation' }}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <i className="fa-solid fa-sliders"></i>
                                    Audio
                                </span>
                                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${audioPanelOpen ? 'rotate-180' : ''}`}></i>
                            </button>
                        </div>
                        {audioPanelOpen ? (
                            <div className={`${quickMenuPanelClass} ${quickMenuScrollClass} left-0 w-[min(560px,96vw)] max-h-[78vh] p-3.5`}>
                                <div className={quickMenuSectionTitleClass}>Audio + Mix</div>
                                <div className={quickMenuSectionHintClass}>
                                    Keep stage backing, room music, and the blend in one place.
                                </div>
                                <div className="mt-2.5 space-y-2.5">
                                    <div className={`${quickMenuCardClass} flex items-center gap-3`}>
                                        <div className="min-w-[72px] text-[11px] font-black uppercase tracking-[0.16em] text-zinc-300">Stage</div>
                                        <SmallWaveform level={stageMeterLevel} className="h-10 w-20" color="rgba(236,72,153,0.9)" />
                                        {!stageMicReady ? (
                                            <button
                                                onClick={requestStageMic}
                                                className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1 text-xs min-w-[30px]`}
                                                title={stageMicError ? 'Enable mic for stage meter' : 'Enable stage meter'}
                                            >
                                                <i className={`fa-solid ${stageMicError ? 'fa-microphone-slash' : 'fa-microphone'} w-4 text-center`}></i>
                                            </button>
                                        ) : null}
                                        <button onClick={toggleSongMute} className={`${styles.btnStd} ${stageVolumeDraft === 0 ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}>
                                            <i className={`fa-solid ${stageVolumeDraft === 0 ? 'fa-volume-xmark' : 'fa-volume-high'} w-4 text-center`}></i>
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={stageVolumeDraft}
                                                onPointerDown={() => { sliderDraggingRef.current.stage = true; }}
                                                onChange={(e) => handleStageVolumeDraftChange(e.target.value)}
                                                onPointerUp={(e) => commitStageVolumeChange(e.target.value)}
                                                onPointerCancel={(e) => commitStageVolumeChange(e.target.value)}
                                                onBlur={(e) => commitStageVolumeChange(e.target.value)}
                                                onWheelCapture={blockRangeWheelDefault}
                                                className="h-3 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 stage-volume-slider"
                                                style={{ background: `linear-gradient(90deg, #00C4D9 ${stageVolumeDraft}%, #27272a ${stageVolumeDraft}%)` }}
                                            />
                                        </div>
                                    </div>
                                    <div className={`${quickMenuCardClass} space-y-2`}>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="min-w-[72px] text-[11px] font-black uppercase tracking-[0.16em] text-zinc-300">BG</div>
                                            <SmallWaveform level={bgAnalyserActive ? bgMeterLevel : Math.round(bgVolume * 100)} className="h-10 w-20" color="rgba(0,196,217,0.95)" />
                                            <button onClick={toggleBgMusic} className={`${styles.btnStd} ${playingBg ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`} title="Toggle BG music">
                                                <i className={`fa-solid ${playingBg ? 'fa-pause' : 'fa-play'} w-4 text-center`}></i>
                                            </button>
                                            <button onClick={skipBg} disabled={!canSkipBg} className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100 ${canSkipBg ? '' : 'opacity-45 cursor-not-allowed'}`} title={canSkipBg ? "Skip BG track" : "Apple Music playlist skipping stays in Apple Music"}>
                                                <i className="fa-solid fa-forward-step w-4 text-center"></i>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const next = !autoBgMusic;
                                                    setAutoBgMusic(next);
                                                    await updateRoom({ autoBgMusic: next });
                                                    if (next && !playingBg) await setBgMusicState(true);
                                                    if (!next && playingBg) await setBgMusicState(false);
                                                }}
                                                className={`${styles.btnStd} ${autoBgMusic ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}
                                                title="Keep BG music rolling between songs"
                                            >
                                                <i className="fa-solid fa-compact-disc w-4 text-center"></i>
                                            </button>
                                            <button onClick={toggleBgMute} className={`${styles.btnStd} ${bgVolume === 0 ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}>
                                                <i className={`fa-solid ${bgVolume === 0 ? 'fa-volume-xmark' : 'fa-volume-high'} w-4 text-center`}></i>
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="1"
                                                    value={bgVolumeDraftPct}
                                                    onPointerDown={() => { sliderDraggingRef.current.bg = true; }}
                                                    onChange={(e) => handleBgVolumeDraftChange(e.target.value)}
                                                    onPointerUp={(e) => commitBgVolumeChange(e.target.value)}
                                                    onPointerCancel={(e) => commitBgVolumeChange(e.target.value)}
                                                    onBlur={(e) => commitBgVolumeChange(e.target.value)}
                                                    onWheelCapture={blockRangeWheelDefault}
                                                    className="h-3 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 bg-volume-slider"
                                                    style={{ background: `linear-gradient(90deg, #EC4899 ${bgVolumeDraftPct}%, #27272a ${bgVolumeDraftPct}%)` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="truncate text-xs text-zinc-400">
                                            <i className="fa-solid fa-music mr-1"></i>
                                            {currentTrackName || 'BG Track'}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onOpenSceneLibrary?.('bg');
                                                closeAllTopMenus();
                                            }}
                                            className={`${styles.btnStd} ${styles.btnNeutral} w-full justify-center py-2 text-sm normal-case tracking-[0.03em]`}
                                        >
                                            <i className="fa-solid fa-folder-music"></i>
                                            Manage BG Library
                                        </button>
                                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-300">Apple Music</div>
                                                    <div className="truncate text-sm font-semibold text-white">{appleMusicAutoPlaylistTitle || appleMusicAutoPlaylistId || 'Browse playlists for BG'}</div>
                                                </div>
                                                {!appleMusicConnected ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => openOpsSection('media')}
                                                        className={`${styles.btnStd} ${styles.btnHighlight} px-3 py-1.5 text-xs`}
                                                    >
                                                        Connect
                                                    </button>
                                                ) : null}
                                            </div>
                                            {appleMusicConnected ? (
                                                <div className="mt-2 space-y-2">
                                                    <div className="grid grid-cols-3 gap-1.5">
                                                        {appleMusicPickerModes.map((option) => (
                                                            <button
                                                                key={`top-apple-picker-${option.id}`}
                                                                type="button"
                                                                onClick={() => {
                                                                    setAppleMusicPickerMode?.(option.id);
                                                                    if (option.id !== 'search') void loadAppleMusicPicker?.(option.id);
                                                                }}
                                                                className={`${styles.btnStd} ${appleMusicPickerMode === option.id ? styles.btnHighlight : styles.btnNeutral} min-w-0 px-2 py-1.5 text-xs normal-case tracking-[0.02em]`}
                                                                title={option.label}
                                                            >
                                                                <span className="truncate">{option.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                    {appleMusicPickerMode === 'search' ? (
                                                        <div className="flex min-w-0 gap-1.5">
                                                            <input
                                                                value={appleMusicPickerQuery}
                                                                onChange={(event) => setAppleMusicPickerQuery?.(event.target.value)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === 'Enter') void loadAppleMusicPicker?.('search');
                                                                }}
                                                                className="min-h-[34px] min-w-0 flex-1 rounded-lg border border-cyan-300/25 bg-black/45 px-2.5 py-1.5 text-sm font-semibold text-white outline-none placeholder:text-zinc-500 focus:border-cyan-300"
                                                                placeholder="Search playlists"
                                                                title="Search Apple Music playlists"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => { void loadAppleMusicPicker?.('search'); }}
                                                                disabled={appleMusicPickerLoading}
                                                                className={`${styles.btnStd} ${styles.btnNeutral} px-2.5 py-1.5 text-xs`}
                                                            >
                                                                {appleMusicPickerLoading ? '...' : 'Go'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => { void loadAppleMusicPicker?.(appleMusicPickerMode); }}
                                                            disabled={appleMusicPickerLoading}
                                                            className={`${styles.btnStd} ${styles.btnNeutral} w-full justify-center px-2.5 py-1.5 text-xs normal-case tracking-[0.02em]`}
                                                        >
                                                            {appleMusicPickerLoading ? 'Loading...' : 'Refresh playlists'}
                                                        </button>
                                                    )}
                                                    {appleMusicPickerError ? (
                                                        <div className="rounded-lg border border-amber-300/20 bg-amber-500/10 px-2.5 py-2 text-xs font-semibold leading-4 text-amber-100">{appleMusicPickerError}</div>
                                                    ) : null}
                                                    {appleMusicPickerItems.length ? (
                                                        <div className="max-h-56 overflow-y-auto rounded-lg border border-cyan-300/15 bg-black/25 custom-scrollbar">
                                                            {appleMusicPickerItems.map((choice) => (
                                                                <div key={`top-${choice.sourceType}-${choice.id}`} className="flex items-center gap-2 border-b border-white/10 px-2.5 py-2 last:border-b-0">
                                                                    {choice.artworkUrl ? (
                                                                        <img src={choice.artworkUrl} alt="" className="h-10 w-10 flex-none rounded-md border border-white/10 object-cover" />
                                                                    ) : (
                                                                        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                                                                            <i className="fa-solid fa-music"></i>
                                                                        </div>
                                                                    )}
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="truncate text-sm font-semibold text-white">{choice.title}</div>
                                                                        <div className="truncate text-xs text-cyan-100/65">{choice.subtitle}</div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { void applyAppleMusicPlaylistForBg?.(choice); }}
                                                                        className={`${styles.btnStd} ${styles.btnHighlight} flex-none px-2.5 py-1.5 text-xs`}
                                                                    >
                                                                        Use BG
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className={`${quickMenuCardClass} flex items-center gap-3`}>
                                        <div className="min-w-[72px] text-[11px] font-black uppercase tracking-[0.16em] text-zinc-300">Mix</div>
                                        <div className="flex-1">
                                            <div className="relative">
                                                <span className="absolute left-1/2 top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40"></span>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    step="1"
                                                    value={mixFaderDraft}
                                                    onPointerDown={() => { sliderDraggingRef.current.mix = true; }}
                                                    onChange={(e) => handleMixFaderDraftChange(e.target.value)}
                                                    onPointerUp={(e) => commitMixFaderChange(e.target.value)}
                                                    onPointerCancel={(e) => commitMixFaderChange(e.target.value)}
                                                    onBlur={(e) => commitMixFaderChange(e.target.value)}
                                                    onWheelCapture={blockRangeWheelDefault}
                                                    className="mix-slider relative z-10 w-full"
                                                    style={{ '--mix-split': `${mixFaderDraft}%` }}
                                                />
                                            </div>
                                            <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                                                <span className="text-[#00C4D9]">BG Music {mixFaderDraft}%</span>
                                                <span className="text-pink-300">Stage Audio {100 - mixFaderDraft}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
                {quickAutomationControls ? (
                    <div className={quickStripItemClass} ref={automationQuickMenuRef}>
                        <button
                            type="button"
                            data-feature-id="deck-automation-menu-toggle"
                            onClick={() => {
                                const next = !showAutomationQuickMenu;
                                closeAllTopMenus();
                                setShowAutomationQuickMenu(next);
                            }}
                            className={`${quickMenuToggleClass} ${compactTopQuickStrip ? '' : 'min-w-[158px] sm:min-w-[176px]'}`}
                            title="Flow and automation controls"
                            style={{ touchAction: 'manipulation' }}
                        >
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                                <i className="fa-solid fa-route text-[11px]"></i>
                                <span className="text-[12px] font-black leading-none text-zinc-100">Flow</span>
                                <span className="max-w-[7rem] truncate text-[12px] font-semibold leading-none text-cyan-100/90">{activeRoomControlModelOption.label}</span>
                            </span>
                            <span className="ml-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">Auto {automationActiveCount}</span>
                            <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showAutomationQuickMenu ? 'rotate-180' : ''}`}></i>
                        </button>
                        {showAutomationQuickMenu && (
                            <div className={`${quickMenuPanelClass} ${quickMenuScrollClass} left-0 w-[min(500px,95vw)] max-h-[74vh] p-3.5`}>
                                <div className={quickMenuSectionTitleClass}>Flow & Automation</div>
                                <div className={quickMenuSectionHintClass}>
                                    Choose the room pacing model, then tune lightweight automation without leaving the host panel.
                                </div>
                                {quickRoomControls ? (
                                    <>
                                <div className={`${quickMenuCardClass} mt-2 space-y-3`} data-host-room-control-model>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className={`${quickMenuEyebrowClass} text-fuchsia-200`}>Room control model</div>
                                            <div className={quickMenuTitleClass}>{activeRoomControlModelOption.label}</div>
                                            <div className={quickMenuBodyClass}>Decide whether tonight is host-driven, host-assisted, or crowd-driven before tuning the detailed controls.</div>
                                        </div>
                                        <span className={`${quickMenuBadgeClass} border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100`}>
                                            Production mode
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        {ROOM_CONTROL_MODEL_OPTIONS.map((option) => {
                                            const selected = activeRoomControlModel === option.id;
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => { void quickRoomControls.onApplyRoomControlModel?.(option.id); }}
                                                    aria-pressed={selected}
                                                    className={`${styles.btnStd} ${selected ? styles.btnHighlight : styles.btnNeutral} min-h-[76px] min-w-0 items-start justify-start whitespace-normal px-3 py-2.5 text-left normal-case tracking-[0.02em]`}
                                                >
                                                    <span className="flex min-w-0 flex-col items-start text-left">
                                                        <span className="inline-flex items-center gap-2 text-sm font-semibold leading-tight"><i className={`fa-solid ${option.icon}`}></i>{option.label}</span>
                                                        <span className="mt-1 text-xs leading-4 text-zinc-400 normal-case tracking-normal whitespace-normal break-words">{option.summary}</span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className={`${quickMenuCardClass} mt-2 space-y-3`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className={`${quickMenuEyebrowClass} text-emerald-200`}>Host assist style</div>
                                            <div role="status" aria-live="polite" aria-atomic="true">
                                                <div className={quickMenuTitleClass}>{operatingStyleSummary.label}</div>
                                                <div className={quickMenuBodyClass}>{operatingStyleSummary.description}</div>
                                            </div>
                                        </div>
                                        <span className={`${quickMenuBadgeClass} border-emerald-300/20 bg-emerald-500/10 text-emerald-100`}>
                                            {operatingStyleSummary.shortLabel}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        {OPERATING_STYLE_PRESETS.map((preset) => {
                                            const selected = operatingStyleSummary.presetId === preset.id;
                                            return (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => { void applyOperatingStylePreset(preset.id); }}
                                                    aria-pressed={selected}
                                                    aria-label={`Use ${preset.label} operating style`}
                                                    className={`${styles.btnStd} ${selected ? styles.btnHighlight : styles.btnNeutral} min-h-[72px] min-w-0 items-start justify-start whitespace-normal px-3 py-2.5 text-left normal-case tracking-[0.02em]`}
                                                >
                                                    <span className="flex min-w-0 flex-col items-start text-left">
                                                        <span className="text-sm font-semibold leading-tight">{preset.shortLabel}</span>
                                                        <span className="mt-1 text-xs leading-4 text-zinc-400 normal-case tracking-normal whitespace-normal break-words">{preset.description}</span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="text-zinc-500">{liveOperatingStyleHistoryLabel || 'Live changes affect tonight only.'}</div>
                                        {typeof onUndoOperatingStylePreset === 'function' ? (
                                            <button
                                                type="button"
                                                onClick={() => { void onUndoOperatingStylePreset('operating_style', { surface: 'top_chrome' }); }}
                                                className={`${styles.btnStd} ${styles.btnNeutral} min-h-[36px] px-3 py-1.5 text-xs normal-case tracking-[0.02em]`}
                                            >
                                                Undo last live style
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                                <div className={`${quickMenuCardClass} mt-2 space-y-3`} data-host-one-minute-mic-controls>
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className={`${quickMenuEyebrowClass} text-cyan-200`}>Song length</div>
                                            <div className={quickMenuTitleClass}>{quickRoomControls.oneMinuteMicEnabled ? 'One-Minute Mic' : 'Full songs'}</div>
                                            <div className={quickMenuBodyClass}>
                                                Let the crowd decide whether a singer earns the rest of the track after the opening minute.
                                            </div>
                                        </div>
                                        <span className={`${quickMenuBadgeClass} ${quickRoomControls.oneMinuteMicEnabled ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-100' : 'border-white/10 bg-white/5 text-zinc-300'}`}>
                                            {quickRoomControls.oneMinuteMicEnabled ? 'Crowd decides' : 'Host paced'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => { void quickRoomControls.onSetOneMinuteMic?.(false); }}
                                            aria-pressed={!quickRoomControls.oneMinuteMicEnabled}
                                            className={`${styles.btnStd} ${!quickRoomControls.oneMinuteMicEnabled ? styles.btnHighlight : styles.btnNeutral} min-h-[58px] justify-between py-2 text-sm normal-case tracking-[0.02em]`}
                                        >
                                            <span className="inline-flex items-center gap-2"><i className="fa-solid fa-music"></i>Full Songs</span>
                                            <span className="text-xs uppercase tracking-widest">Default</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { void quickRoomControls.onSetOneMinuteMic?.(true); }}
                                            aria-pressed={quickRoomControls.oneMinuteMicEnabled === true}
                                            className={`${styles.btnStd} ${quickRoomControls.oneMinuteMicEnabled ? styles.btnHighlight : styles.btnNeutral} min-h-[58px] justify-between py-2 text-sm normal-case tracking-[0.02em]`}
                                        >
                                            <span className="inline-flex items-center gap-2"><i className="fa-solid fa-stopwatch"></i>One-Minute Mic</span>
                                            <span className="text-xs uppercase tracking-widest">Vote</span>
                                        </button>
                                    </div>
                                    {oneMinuteMicLiveStatus ? (
                                        <div data-host-one-minute-mic-live-status className={`rounded-xl border px-3 py-2.5 ${oneMinuteMicStatusToneClass}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className={`${quickMenuEyebrowClass} opacity-80`}>Live crowd status</div>
                                                    <div className={quickMenuTitleClass}>{oneMinuteMicLiveStatus.label}</div>
                                                    <div className={quickMenuBodyClass}>{oneMinuteMicLiveStatus.detail}</div>
                                                </div>
                                                <span className={`${quickMenuBadgeClass} shrink-0 border-white/10 bg-black/25 text-white/90`}>
                                                    {oneMinuteMicLiveStatus.badge}
                                                </span>
                                            </div>
                                            {oneMinuteMicLiveStatus.subject || oneMinuteMicLiveStatus.subtext ? (
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
                                                    {oneMinuteMicLiveStatus.subject ? (
                                                        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2 py-1">
                                                            <i className="fa-solid fa-music text-cyan-200"></i>
                                                            <span className="truncate">{oneMinuteMicLiveStatus.subject}</span>
                                                        </span>
                                                    ) : null}
                                                    {oneMinuteMicLiveStatus.subtext ? (
                                                        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2 py-1">
                                                            <i className="fa-solid fa-user text-fuchsia-200"></i>
                                                            <span className="truncate">{oneMinuteMicLiveStatus.subtext}</span>
                                                        </span>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <label className={quickMenuFieldClass}>
                                            <span className={quickMenuLabelClass}>Open vote after</span>
                                            <select
                                                value={Math.max(15, Number(quickRoomControls.oneMinuteMicOpeningWindowSec || 60) || 60)}
                                                onChange={(event) => { void quickRoomControls.onSetOneMinuteMicTiming?.({ openingWindowSec: event.target.value }); }}
                                                className={quickMenuSelectClass}
                                            >
                                                {ONE_MINUTE_MIC_OPENING_PRESETS.map((value) => (
                                                    <option key={`one-minute-opening-${value}`} value={value}>{value} sec</option>
                                                ))}
                                            </select>
                                            <span className={quickMenuHelperClass}>When the continue-or-rotate prompt appears.</span>
                                        </label>
                                        <label className={quickMenuFieldClass}>
                                            <span className={quickMenuLabelClass}>Voting window</span>
                                            <select
                                                value={Math.max(5, Number(quickRoomControls.oneMinuteMicVoteWindowSec || 12) || 12)}
                                                onChange={(event) => { void quickRoomControls.onSetOneMinuteMicTiming?.({ voteWindowSec: event.target.value }); }}
                                                className={quickMenuSelectClass}
                                            >
                                                {ONE_MINUTE_MIC_VOTE_WINDOW_PRESETS.map((value) => (
                                                    <option key={`one-minute-vote-window-${value}`} value={value}>{value} sec</option>
                                                ))}
                                            </select>
                                            <span className={quickMenuHelperClass}>Short windows keep the TV prompt decisive.</span>
                                        </label>
                                    </div>
                                </div>
                                    </>
                                ) : null}
                                <div className={`${quickMenuCardClass} mt-2`}>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {[
                                            {
                                                key: 'autoDj',
                                                label: 'Auto DJ',
                                                active: !!quickAutomationControls.autoDj,
                                                icon: 'fa-forward-fast',
                                                onClick: quickAutomationControls.onToggleAutoDj,
                                            },
                                            {
                                                key: 'autoBg',
                                                label: 'Auto BG Music',
                                                active: !!quickAutomationControls.autoBgMusic,
                                                icon: 'fa-compact-disc',
                                                onClick: quickAutomationControls.onToggleAutoBgMusic,
                                            },
                                            {
                                                key: 'autoEnd',
                                                label: 'Auto End',
                                                active: !!quickAutomationControls.autoEndOnTrackFinish,
                                                icon: 'fa-stopwatch',
                                                onClick: quickAutomationControls.onToggleAutoEnd,
                                            },
                                            {
                                                key: 'autoBonus',
                                                label: 'Auto Bonus',
                                                active: !!quickAutomationControls.autoBonusEnabled,
                                                icon: 'fa-gift',
                                                onClick: quickAutomationControls.onToggleAutoBonus,
                                            },
                                            {
                                                key: 'autoLyrics',
                                                label: 'Auto Lyrics',
                                                active: !!quickAutomationControls.autoLyricsOnQueue,
                                                icon: 'fa-closed-captioning',
                                                onClick: quickAutomationControls.onToggleAutoLyricsOnQueue,
                                            },
                                            {
                                                key: 'autoParty',
                                                label: 'Auto Party',
                                                active: !!quickAutomationControls.autoPartyEnabled,
                                                icon: 'fa-wand-magic-sparkles',
                                                onClick: quickAutomationControls.onToggleAutoParty,
                                            },
                                            {
                                                key: 'popTrivia',
                                                label: 'Pop Trivia',
                                                active: !!quickAutomationControls.popTriviaEnabled,
                                                icon: 'fa-bolt',
                                                onClick: quickAutomationControls.onTogglePopTrivia,
                                            },
                                        ].map((item) => (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={() => { item.onClick?.(); }}
                                                className={`${styles.btnStd} ${item.active ? styles.btnHighlight : styles.btnNeutral} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <i className={`fa-solid ${item.icon}`}></i>
                                                    {item.label}
                                                </span>
                                                <span className="text-[11px] uppercase tracking-widest">{item.active ? 'On' : 'Off'}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {runOfShowEnabled && typeof onToggleRunOfShowAutomationPause === 'function' ? (
                                    <div className={`${quickMenuCardClass} mt-3`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-100">Run Of Show</div>
                                                <div className="mt-1 text-[11px] text-zinc-400">
                                                    Conveyor automation can be paused here without opening the show workspace.
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onToggleRunOfShowAutomationPause?.(!runOfShowAutomationPaused)}
                                                className={`${styles.btnStd} ${runOfShowAutomationPaused ? styles.btnSecondary : styles.btnHighlight} px-3 py-1.5 text-[11px]`}
                                            >
                                                {runOfShowAutomationPaused ? 'Resume Show Auto' : 'Pause Show Auto'}
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => openOpsSection('ops.automation')}
                                    className={`${styles.btnStd} ${styles.btnNeutral} mt-3 w-full justify-center py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    Open Full Flow & Automation Defaults
                                </button>
                            </div>
                        )}
                    </div>
                ) : null}
                {quickRoomControls ? (
                    <div className={quickStripItemClass} ref={queueQuickMenuRef}>
                        <button
                            type="button"
                            data-feature-id="deck-queue-menu-toggle"
                            aria-expanded={showQueueQuickMenu}
                            onClick={() => {
                                const next = !showQueueQuickMenu;
                                closeAllTopMenus();
                                setShowQueueQuickMenu(next);
                            }}
                            className={`${quickMenuToggleClass} ${compactTopQuickStrip ? '' : 'min-w-[158px] sm:min-w-[176px]'}`}
                            title="Queue management"
                            style={{ touchAction: 'manipulation' }}
                        >
                            <i className="fa-solid fa-list-check mr-1"></i>
                            Queue: {queueLimitLabel}
                            <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showQueueQuickMenu ? 'rotate-180' : ''}`}></i>
                        </button>
                        {showQueueQuickMenu && (
                            <div className={`${quickMenuPanelClass} ${quickMenuScrollClass} left-0 w-[min(560px,95vw)] max-h-[74vh] p-3.5`}>
                                <div className={quickMenuSectionTitleClass}>Queue Management</div>
                                <div className={quickMenuSectionHintClass}>Live queue rules, guest requests, and ready checks for tonight.</div>
                                <div className={`${quickMenuCardClass} mt-2 space-y-3`}>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <label className={quickMenuFieldClass}>
                                            <span className={quickMenuLabelClass}>Audience request mode</span>
                                            <select
                                                value={quickRoomControls.requestMode || 'canonical_open'}
                                                onChange={(event) => { void quickRoomControls.onSetRequestMode?.(event.target.value); }}
                                                className={quickMenuSelectClass}
                                            >
                                                {(quickRoomControls.requestModeOptions || []).map((option) => (
                                                    <option key={`queue-request-mode-${option.id}`} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                            <span className={quickMenuHelperClass}>{requestModeShortLabel}</span>
                                        </label>
                                        <label className={quickMenuFieldClass}>
                                            <span className={quickMenuLabelClass}>Queue cap</span>
                                            <select
                                                value={quickRoomControls.queueLimitMode || 'none'}
                                                onChange={(event) => {
                                                    const nextMode = event.target.value;
                                                    void quickRoomControls.onUpdateQueueSettings?.({
                                                        limitMode: nextMode,
                                                        limitCount: nextMode === 'none' ? 0 : Math.max(1, Number(quickRoomControls.queueLimitCount || 2) || 2),
                                                    });
                                                }}
                                                className={quickMenuSelectClass}
                                            >
                                                {(quickRoomControls.queueLimitOptions || []).map((option) => (
                                                    <option key={`queue-limit-mode-${option.id}`} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                            <span className={quickMenuHelperClass}>{queueLimitLabel}</span>
                                        </label>
                                        {quickRoomControls.queueLimitMode && quickRoomControls.queueLimitMode !== 'none' ? (
                                            <label className={quickMenuFieldClass}>
                                                <span className={quickMenuLabelClass}>Request cap count</span>
                                                <select
                                                    value={Math.max(1, Number(quickRoomControls.queueLimitCount || 2) || 2)}
                                                    onChange={(event) => {
                                                        void quickRoomControls.onUpdateQueueSettings?.({
                                                            limitCount: Math.max(1, Number(event.target.value || 2) || 2),
                                                        });
                                                    }}
                                                    className={quickMenuSelectClass}
                                                >
                                                    {Array.from({ length: 8 }).map((_, index) => (
                                                        <option key={`queue-limit-count-${index + 1}`} value={index + 1}>{index + 1} request{index === 0 ? '' : 's'}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        ) : null}
                                        <label className={quickMenuFieldClass}>
                                            <span className={quickMenuLabelClass}>Queue rotation</span>
                                            <select
                                                value={quickRoomControls.queueRotation || 'round_robin'}
                                                onChange={(event) => { void quickRoomControls.onUpdateQueueSettings?.({ rotation: event.target.value }); }}
                                                className={quickMenuSelectClass}
                                            >
                                                {(quickRoomControls.queueRotationOptions || []).map((option) => (
                                                    <option key={`queue-rotation-${option.id}`} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                            <span className={quickMenuHelperClass}>{queueRotationLabel}</span>
                                        </label>
                                        <label className={quickMenuFieldClass}>
                                            <span className={quickMenuLabelClass}>Ready check duration</span>
                                            <select
                                                value={Math.max(3, Number(quickRoomControls.readyCheckDurationSec || 10) || 10)}
                                                onChange={(event) => { void quickRoomControls.onSetReadyCheckDuration?.(event.target.value); }}
                                                className={quickMenuSelectClass}
                                            >
                                                {[5, 8, 10, 12, 15, 20, 30].map((value) => (
                                                    <option key={`ready-check-duration-${value}`} value={value}>{value} sec</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                    <div className="text-xs text-zinc-300">
                                        <div className={quickMenuLabelClass}>When guests pick a new track</div>
                                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                            {(quickRoomControls.guestTrackPolicyOptions || []).map((option) => {
                                                const active = quickRoomControls.guestTrackPolicy === option.id;
                                                return (
                                                    <button
                                                        key={`queue-guest-track-policy-${option.id}`}
                                                        type="button"
                                                        onClick={() => { void quickRoomControls.onSetGuestTrackPolicy?.(option.id); }}
                                                        aria-pressed={active}
                                                        className={`${styles.btnStd} ${active ? styles.btnHighlight : styles.btnNeutral} min-h-[44px] justify-center px-3 py-2 text-center text-sm normal-case tracking-[0.02em]`}
                                                    >
                                                        {option.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <span className={quickMenuHelperClass}>
                                            {quickRoomControls.guestTrackPolicy === 'auto_queue_unverified'
                                                ? 'Guests can drop a new YouTube track straight into the queue.'
                                                : quickRoomControls.guestTrackPolicy === 'block_unknown'
                                                    ? 'Guests only see tracks that are already known or approved for the room.'
                                                    : 'New guest-picked tracks stop with you before they enter the queue.'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-zinc-300">
                                        <div className={quickMenuLabelClass}>Allowed search sources</div>
                                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                            {[
                                                { id: 'local', label: 'Library', iconClass: 'fa-solid fa-folder-music' },
                                                { id: 'youtube', label: 'YouTube', iconClass: 'fa-brands fa-youtube' },
                                                { id: 'itunes', label: 'Apple', iconClass: 'fa-brands fa-apple' },
                                            ].map((source) => {
                                                const active = quickRoomControls.searchSources?.[source.id] !== false;
                                                return (
                                                    <button
                                                        key={`queue-search-source-${source.id}`}
                                                        type="button"
                                                        onClick={() => { void quickRoomControls.onSetSearchSource?.(source.id, !active); }}
                                                        aria-pressed={active}
                                                        className={`${styles.btnStd} ${active ? styles.btnHighlight : styles.btnNeutral} min-h-[44px] justify-between px-3 py-2 text-sm normal-case tracking-[0.02em]`}
                                                    >
                                                        <span className="inline-flex items-center gap-2"><i className={source.iconClass}></i>{source.label}</span>
                                                        <span className="text-xs uppercase tracking-widest">{active ? 'On' : 'Off'}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <span className={quickMenuHelperClass}>Controls which catalogs power host autocomplete and guest browsing.</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                        <button
                                            type="button"
                                            onClick={() => { void quickRoomControls.onToggleAutoPlayMedia?.(); }}
                                            aria-pressed={quickRoomControls.autoPlayMedia !== false}
                                            title="Choose whether staged songs start immediately or wait for a host-started track."
                                            className={`${styles.btnStd} ${quickRoomControls.autoPlayMedia !== false ? styles.btnHighlight : styles.btnNeutral} min-h-[44px] justify-between py-2 text-sm normal-case tracking-[0.02em]`}
                                        >
                                            <span className="inline-flex items-center gap-2"><i className="fa-solid fa-circle-play"></i>Stage Start</span>
                                            <span className="text-xs uppercase tracking-widest">{quickRoomControls.autoPlayMedia !== false ? 'Auto' : 'Manual'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { void quickRoomControls.onTogglePostPerformanceBackingPrompt?.(); }}
                                            aria-pressed={quickRoomControls.postPerformanceBackingPromptEnabled === true}
                                            title="Ask after each YouTube-backed performance whether the backing was good."
                                            className={`${styles.btnStd} ${quickRoomControls.postPerformanceBackingPromptEnabled ? styles.btnHighlight : styles.btnNeutral} min-h-[44px] justify-between py-2 text-sm normal-case tracking-[0.02em]`}
                                        >
                                            <span className="inline-flex items-center gap-2"><i className="fa-solid fa-circle-question"></i>Post-Song Track Check</span>
                                            <span className="text-xs uppercase tracking-widest">{quickRoomControls.postPerformanceBackingPromptEnabled ? 'On' : 'Off'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { void quickRoomControls.onToggleRuntimeShellMode?.(); }}
                                            aria-pressed={quickRoomControls.runtimeShellMode === 'social_game_night_experiment'}
                                            title="Switch between the classic host runtime and the Social Game Night experiment."
                                            className={`${styles.btnStd} ${quickRoomControls.runtimeShellMode === 'social_game_night_experiment' ? styles.btnHighlight : styles.btnNeutral} min-h-[44px] justify-between py-2 text-sm normal-case tracking-[0.02em]`}
                                        >
                                            <span className="inline-flex items-center gap-2"><i className="fa-solid fa-record-vinyl"></i>Runtime Shell</span>
                                            <span className="text-xs uppercase tracking-widest">{quickRoomControls.runtimeShellMode === 'social_game_night_experiment' ? 'Social' : 'Classic'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { void quickRoomControls.onToggleBouncerMode?.(); }}
                                            className={`${styles.btnStd} ${quickRoomControls.bouncerMode ? styles.btnHighlight : styles.btnNeutral} min-h-[44px] justify-between py-2 text-sm normal-case tracking-[0.02em]`}
                                        >
                                            <span className="inline-flex items-center gap-2"><i className="fa-solid fa-user-lock"></i>Host Approval</span>
                                            <span className="text-xs uppercase tracking-widest">{quickRoomControls.bouncerMode ? 'On' : 'Off'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void quickRoomControls.onUpdateQueueSettings?.({ firstTimeBoost: !quickRoomControls.queueFirstTimeBoost });
                                            }}
                                            className={`${styles.btnStd} ${quickRoomControls.queueFirstTimeBoost ? styles.btnHighlight : styles.btnNeutral} min-h-[44px] justify-between py-2 text-sm normal-case tracking-[0.02em]`}
                                        >
                                            <span className="inline-flex items-center gap-2"><i className="fa-solid fa-sparkles"></i>First-Time Boost</span>
                                            <span className="text-xs uppercase tracking-widest">{quickRoomControls.queueFirstTimeBoost ? 'On' : 'Off'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { quickRoomControls.onTriggerReadyCheck?.(); }}
                                            className={`${styles.btnStd} ${styles.btnSecondary} min-h-[44px] justify-between py-2 text-sm normal-case tracking-[0.02em]`}
                                        >
                                            <span className="inline-flex items-center gap-2"><i className="fa-solid fa-people-arrows"></i>Ready Check</span>
                                            <span className="text-xs uppercase tracking-widest">Run</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => { setTab?.('stage'); closeAllTopMenus(); }}
                                        className={`${styles.btnStd} ${styles.btnNeutral} justify-center py-2 text-sm normal-case tracking-[0.02em]`}
                                    >
                                        Open Queue Workspace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openOpsSection('ops.room_setup')}
                                        className={`${styles.btnStd} ${styles.btnNeutral} justify-center py-2 text-sm normal-case tracking-[0.02em]`}
                                    >
                                        Open Full Room Setup
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
                <div className={quickStripItemClass} ref={rewardsQuickMenuRef}>
                    <button
                        type="button"
                        data-feature-id="deck-rewards-menu-toggle"
                        aria-expanded={showRewardsQuickMenu}
                        onClick={() => {
                            const next = !showRewardsQuickMenu;
                            closeAllTopMenus();
                            setShowRewardsQuickMenu(next);
                        }}
                        className={`${quickMenuToggleClass} ${compactTopQuickStrip ? '' : 'min-w-[148px] sm:min-w-[168px]'}`}
                        title="Quick point rewards"
                        style={{ touchAction: 'manipulation' }}
                    >
                        <i className="fa-solid fa-gift mr-1"></i>
                        Rewards
                        <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showRewardsQuickMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                    {showRewardsQuickMenu && (
                        <div className={`${quickMenuPanelClass} ${quickMenuScrollClass} left-0 w-[min(430px,94vw)] max-h-[74vh] p-3.5`}>
                            <div className={quickMenuSectionTitleClass}>Quick Rewards</div>
                            <div className={quickMenuSectionHintClass}>Gift one guest or drop points to every phone without leaving the live deck.</div>
                            <div className={`${quickMenuCardClass} mt-2 space-y-3`}>
                                <div>
                                    <div className={quickMenuLabelClass}>Reward room</div>
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                        {[50, 100, 250].map((points) => (
                                            <button
                                                key={`top-room-reward-${points}`}
                                                type="button"
                                                onClick={() => fireRoomReward(points)}
                                                disabled={typeof onDropBonus !== 'function'}
                                                className={`${styles.btnStd} ${styles.btnSecondary} justify-center py-2 text-xs normal-case tracking-[0.03em] ${typeof onDropBonus !== 'function' ? 'cursor-not-allowed opacity-55' : ''}`}
                                            >
                                                All +{points}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="border-t border-white/10 pt-3">
                                    <label className={quickMenuFieldClass}>
                                        <span className={quickMenuLabelClass}>Gift individual</span>
                                        <select
                                            value={quickRewardTargetUid}
                                            onChange={(event) => setQuickRewardTargetUid(event.target.value)}
                                            className={quickMenuSelectClass}
                                        >
                                            <option value="">Select guest...</option>
                                            {quickRewardUsers.map((entry) => (
                                                <option key={`top-reward-user-${entry.uid}`} value={entry.uid}>{entry.name} - {entry.points} pts</option>
                                            ))}
                                        </select>
                                    </label>
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                        {[50, 100, 250].map((points) => (
                                            <button
                                                key={`top-user-reward-${points}`}
                                                type="button"
                                                onClick={() => fireUserReward(points)}
                                                disabled={!quickRewardTargetUid || typeof onGiftPointsToUser !== 'function'}
                                                className={`${styles.btnStd} ${styles.btnNeutral} justify-center py-2 text-xs normal-case tracking-[0.03em] ${(!quickRewardTargetUid || typeof onGiftPointsToUser !== 'function') ? 'cursor-not-allowed opacity-55' : ''}`}
                                            >
                                                +{points}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            max="5000"
                                            value={quickRewardCustomPoints}
                                            onChange={(event) => setQuickRewardCustomPoints(event.target.value)}
                                            className={`${styles.input} min-h-[44px] bg-zinc-950/95 border border-cyan-300/35 px-3 text-sm`}
                                            placeholder="Custom pts"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fireUserReward(quickRewardCustomAmount)}
                                            disabled={!quickRewardTargetUid || typeof onGiftPointsToUser !== 'function'}
                                            className={`${styles.btnStd} ${styles.btnHighlight} justify-center px-3 py-2 text-xs normal-case tracking-[0.03em] ${(!quickRewardTargetUid || typeof onGiftPointsToUser !== 'function') ? 'cursor-not-allowed opacity-55' : ''}`}
                                        >
                                            Gift +{quickRewardCustomAmount}
                                        </button>
                                    </div>
                                    <span className={quickMenuHelperClass}>{quickRewardTarget ? `Selected: ${quickRewardTarget.name}` : 'Pick a guest before firing individual points.'}</span>
                                </div>
                                <div className="border-t border-white/10 pt-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <div className={quickMenuLabelClass}>Auto refill</div>
                                            <div className="mt-1 text-xs text-zinc-400">Controls how room credits accumulate over time after guests have joined.</div>
                                        </div>
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${quickTimedLobbyEnabled ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-zinc-300'}`}>
                                            {quickRefillSummary}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-4 gap-2">
                                        {QUICK_REWARD_REFILL_PRESETS.map((preset) => {
                                            const active = quickTimedLobbyEnabled === preset.timedLobbyEnabled
                                                && Math.max(0, Number(quickEventCredits.timedLobbyPoints || 0) || 0) === preset.timedLobbyPoints
                                                && Math.max(1, Number(quickEventCredits.timedLobbyIntervalMin || 10) || 10) === preset.timedLobbyIntervalMin
                                                && Math.max(0, Number(quickEventCredits.timedLobbyMaxPerGuest || 0) || 0) === preset.timedLobbyMaxPerGuest;
                                            return (
                                                <button
                                                    key={`top-refill-preset-${preset.id}`}
                                                    type="button"
                                                    onClick={() => updateQuickTimedRefill({
                                                        timedLobbyEnabled: preset.timedLobbyEnabled,
                                                        timedLobbyPoints: preset.timedLobbyPoints,
                                                        timedLobbyIntervalMin: preset.timedLobbyIntervalMin,
                                                        timedLobbyMaxPerGuest: preset.timedLobbyMaxPerGuest,
                                                    })}
                                                    disabled={!roomCode}
                                                    className={`${styles.btnStd} ${active ? styles.btnHighlight : styles.btnNeutral} justify-center py-2 text-xs normal-case tracking-[0.03em] ${!roomCode ? 'cursor-not-allowed opacity-55' : ''}`}
                                                >
                                                    {preset.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        <label className={quickMenuFieldClass}>
                                            <span className={quickMenuLabelClass}>Amount</span>
                                            <select
                                                value={quickTimedLobbyEnabled ? Math.max(0, Number(quickEventCredits.timedLobbyPoints || 0) || 0) : 0}
                                                onChange={(event) => {
                                                    const amount = Math.max(0, Number(event.target.value || 0) || 0);
                                                    updateQuickTimedRefill({ timedLobbyPoints: amount, timedLobbyEnabled: amount > 0 });
                                                }}
                                                className={quickMenuSelectClass}
                                            >
                                                {[0, 12, 25, 50, 100].map((points) => (
                                                    <option key={`top-refill-amount-${points}`} value={points}>{points ? `+${points}` : 'Off'}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className={quickMenuFieldClass}>
                                            <span className={quickMenuLabelClass}>Every</span>
                                            <select
                                                value={Math.max(1, Number(quickEventCredits.timedLobbyIntervalMin || 10) || 10)}
                                                onChange={(event) => updateQuickTimedRefill({ timedLobbyIntervalMin: Math.max(1, Number(event.target.value || 10) || 10) })}
                                                className={quickMenuSelectClass}
                                            >
                                                {[5, 8, 10, 15, 20].map((minutes) => (
                                                    <option key={`top-refill-interval-${minutes}`} value={minutes}>{minutes} min</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className={quickMenuFieldClass}>
                                            <span className={quickMenuLabelClass}>Cap</span>
                                            <select
                                                value={Math.max(0, Number(quickEventCredits.timedLobbyMaxPerGuest || 0) || 0)}
                                                onChange={(event) => updateQuickTimedRefill({ timedLobbyMaxPerGuest: Math.max(0, Number(event.target.value || 0) || 0) })}
                                                className={quickMenuSelectClass}
                                            >
                                                {[0, 72, 150, 300, 500].map((points) => (
                                                    <option key={`top-refill-cap-${points}`} value={points}>{points ? `${points} max` : 'No cap'}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                        <span className={quickMenuHelperClass}>Quick changes affect future timed claims; use full settings for event campaigns and support offers.</span>
                                        <button
                                            type="button"
                                            onClick={() => openOpsSection('audience.monetization')}
                                            className={`${styles.btnStd} ${styles.btnNeutral} justify-center px-3 py-2 text-xs normal-case tracking-[0.03em]`}
                                        >
                                            Full Credits Settings
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className={quickStripItemClass} ref={tvQuickMenuRef}>
                    <button
                        data-feature-id="deck-tv-menu-toggle"
                        onClick={() => {
                            const next = !showTvQuickMenu;
                            closeAllTopMenus();
                            setShowTvQuickMenu(next);
                        }}
                        className={`${quickMenuToggleClass} ${compactTopQuickStrip ? '' : 'min-w-[136px] sm:min-w-[156px]'}`}
                        title="TV display modes"
                        style={{ touchAction: 'manipulation' }}
                    >
                        <i className="fa-solid fa-tv mr-1"></i>
                        TV: {tvDisplayLabel}
                        <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showTvQuickMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                    {showTvQuickMenu && (
                        <div className={`${quickMenuPanelClass} ${quickMenuScrollClass} left-0 w-[min(540px,95vw)] max-h-[74vh] p-3.5`}>
                            <div className={quickMenuSectionTitleClass}>TV Display Modes</div>
                            <div className={quickMenuSectionHintClass}>
                                Choose the audience TV layer, then tune the visualizer behavior.
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    data-feature-id="deck-tv-video"
                                    onClick={() => applyTvDisplayMode('video')}
                                    className={`${styles.btnStd} ${tvDisplayMode === 'video' ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <i className="fa-solid fa-video"></i>
                                    Video
                                </button>
                                <button
                                    data-feature-id="deck-tv-lyrics"
                                    onClick={() => applyTvDisplayMode('lyrics')}
                                    className={`${styles.btnStd} ${tvDisplayMode === 'lyrics' ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <i className="fa-solid fa-closed-captioning"></i>
                                    Lyrics
                                </button>
                                <button
                                    data-feature-id="deck-tv-visualizer"
                                    onClick={() => applyTvDisplayMode('visualizer')}
                                    className={`${styles.btnStd} ${tvDisplayMode === 'visualizer' ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <i className="fa-solid fa-wave-square"></i>
                                    Visualizer
                                </button>
                                <button
                                    data-feature-id="deck-tv-lyrics-viz"
                                    onClick={() => applyTvDisplayMode('lyrics_viz')}
                                    className={`${styles.btnStd} ${tvDisplayMode === 'lyrics_viz' ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <i className="fa-solid fa-layer-group"></i>
                                    Lyrics + Viz
                                </button>
                            </div>
                            <div className="mt-2.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                                Tip: Lyrics and visualizer can run together.
                            </div>
                            <div className="mt-2.5 rounded-lg border border-white/10 bg-black/25 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-300">Lyrics Scroll</div>
                                        <div className="truncate text-xs text-zinc-500">Auto follows playback. Manual lets the host scroll.</div>
                                    </div>
                                    <div className="grid min-w-[9.5rem] grid-cols-2 gap-1">
                                        {[
                                            ['auto', 'Auto'],
                                            ['manual', 'Manual']
                                        ].map(([mode, label]) => (
                                            <button
                                                key={`lyrics-scroll-${mode}`}
                                                type="button"
                                                onClick={() => applyLyricsScrollMode(mode)}
                                                className={`${styles.btnStd} ${(room?.lyricsScrollMode || 'auto') === mode ? styles.btnHighlight : styles.btnNeutral} h-9 px-2 text-xs normal-case tracking-[0.03em]`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-3 text-xs uppercase tracking-[0.22em] text-zinc-200">Audience Layer</div>
                            <div className={`${quickMenuCardClass} mt-2`} data-feature-id="deck-tv-audience-layer">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-white">{audienceDisplayLabel}</div>
                                        <div className="mt-1 text-[11px] text-zinc-400">Fast TV shortcuts. Use Audience &gt; On TV to cast specific guests.</div>
                                    </div>
                                    <span className={`${quickMenuBadgeClass} ${audienceDisplayMode === 'off' ? 'border-white/10 bg-white/5 text-zinc-300' : 'border-cyan-300/30 bg-cyan-500/10 text-cyan-100'}`}>
                                        {audienceDisplayMode === 'off' ? 'Off' : 'On'}
                                    </span>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        data-feature-id="deck-tv-audience-off"
                                        onClick={() => applyAudienceDisplayMode('off')}
                                        className={`${styles.btnStd} ${audienceDisplayMode === 'off' ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-xs normal-case tracking-[0.03em]`}
                                    >
                                        Off
                                    </button>
                                    <button
                                        type="button"
                                        data-feature-id="deck-tv-audience-commentator-row"
                                        onClick={() => applyAudienceDisplayMode('commentator_row')}
                                        className={`${styles.btnStd} ${audienceDisplayMode === 'commentator_row' ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-xs normal-case tracking-[0.03em]`}
                                    >
                                        Row
                                    </button>
                                    <button
                                        type="button"
                                        data-feature-id="deck-tv-audience-lobby-wall"
                                        onClick={() => applyAudienceDisplayMode('lobby_wall')}
                                        className={`${styles.btnStd} ${audienceDisplayMode === 'lobby_wall' ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-xs normal-case tracking-[0.03em]`}
                                    >
                                        Wall
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 text-xs uppercase tracking-[0.22em] text-zinc-200">TV Presentation</div>
                            <div className={`${quickMenuCardClass} mt-2`}>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => applyTvPresentationProfile('room')}
                                        className={`${styles.btnStd} ${tvPresentationProfile === 'room' ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Use room-defined TV behavior"
                                    >
                                        Room
                                    </button>
                                    <button
                                        onClick={() => applyTvPresentationProfile('simple')}
                                        className={`${styles.btnStd} ${tvPresentationProfile === 'simple' ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Cleaner shared-screen style with fewer ambient effects"
                                    >
                                        Simple
                                    </button>
                                    <button
                                        onClick={() => applyTvPresentationProfile('cinema')}
                                        className={`${styles.btnStd} ${tvPresentationProfile === 'cinema' ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Stage-forward cinematic framing"
                                    >
                                        Cinema
                                    </button>
                                </div>
                                <div className="mt-2 text-[10px] text-zinc-400">
                                    Active profile: <span className="text-zinc-100 uppercase font-semibold">{tvPresentationProfile}</span>
                                </div>
                            </div>
                            <div className="mt-3 text-xs uppercase tracking-[0.22em] text-zinc-200">Screen Elements</div>
                            <div className={`${quickMenuCardClass} mt-2`}>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => updateRoom({ hideWaveform: !room?.hideWaveform })}
                                        className={`${styles.btnStd} ${room?.hideWaveform ? styles.btnNeutral : styles.btnHighlight} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Show or hide the waveform strip on Public TV"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <i className="fa-solid fa-wave-square"></i>
                                            Waveform
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest">{room?.hideWaveform ? 'Off' : 'On'}</span>
                                    </button>
                                    <button
                                        onClick={() => updateRoom({ hideOverlay: !room?.hideOverlay })}
                                        className={`${styles.btnStd} ${room?.hideOverlay ? styles.btnNeutral : styles.btnHighlight} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Show or hide the main TV overlay layer"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <i className="fa-solid fa-layer-group"></i>
                                            Overlay
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest">{room?.hideOverlay ? 'Off' : 'On'}</span>
                                    </button>
                                    <button
                                        onClick={() => updateRoom({ hideLogo: !room?.hideLogo })}
                                        className={`${styles.btnStd} ${room?.hideLogo ? styles.btnNeutral : styles.btnHighlight} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Show or hide the BeauRocks or room logo on TV"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <i className="fa-solid fa-star"></i>
                                            Logo
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest">{room?.hideLogo ? 'Off' : 'On'}</span>
                                    </button>
                                    <button
                                        onClick={() => updateRoom({ hideCornerOverlay: !room?.hideCornerOverlay })}
                                        className={`${styles.btnStd} ${room?.hideCornerOverlay ? styles.btnNeutral : styles.btnHighlight} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Show or hide the on-stage corner callout"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <i className="fa-solid fa-user"></i>
                                            On Stage
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest">{room?.hideCornerOverlay ? 'Off' : 'On'}</span>
                                    </button>
                                    <button
                                        onClick={() => updateRoom({ hideJoinOverlay: !room?.hideJoinOverlay })}
                                        className={`${styles.btnStd} ${room?.hideJoinOverlay ? styles.btnNeutral : styles.btnHighlight} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Show or hide the audience join QR and URL module on Public TV"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <i className="fa-solid fa-qrcode"></i>
                                            Join QR
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest">{room?.hideJoinOverlay ? 'Off' : 'On'}</span>
                                    </button>
                                    <button
                                        onClick={() => updateRoom({ showScoring: room?.showScoring === false })}
                                        className={`${styles.btnStd} ${room?.showScoring === false ? styles.btnNeutral : styles.btnHighlight} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Show or hide the score HUD and room scoring surfaces"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <i className="fa-solid fa-chart-line"></i>
                                            Score HUD
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest">{room?.showScoring === false ? 'Off' : 'On'}</span>
                                    </button>
                                    <button
                                        onClick={() => updateRoom({ reduceMotionFx: !room?.reduceMotionFx })}
                                        className={`${styles.btnStd} ${room?.reduceMotionFx ? styles.btnHighlight : styles.btnNeutral} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Reduce TV motion for readability and comfort"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <i className="fa-solid fa-universal-access"></i>
                                            Motion Safe
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest">{room?.reduceMotionFx ? 'On' : 'Off'}</span>
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 text-xs uppercase tracking-[0.22em] text-zinc-200">Visualizer Engine</div>
                            <div className={`${quickMenuCardClass} mt-2 space-y-2.5`}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <label className="text-xs text-zinc-300">
                                        Source
                                        <select
                                            value={visualizerSource}
                                            onChange={(e) => updateRoom({ visualizerSource: e.target.value })}
                                            className={quickMenuSelectClass}
                                        >
                                            <option value="auto">Auto (Recommended)</option>
                                            <option value="host_bg">Host BG Music</option>
                                            <option value="stage_mic">Stage Mic</option>
                                            <option value="off">Off</option>
                                        </select>
                                    </label>
                                    <label className="text-xs text-zinc-300">
                                        Style
                                        <select
                                            value={visualizerMode}
                                            onChange={(e) => updateRoom({ visualizerMode: e.target.value })}
                                            className={quickMenuSelectClass}
                                        >
                                            <option value="ribbon">Liquid ribbon</option>
                                            <option value="rings">Neon rings</option>
                                            <option value="spark">Pulse sparkline</option>
                                            <option value="orb">Striped orb</option>
                                            <option value="halo">Halo pulse</option>
                                            <option value="sonar">Sonar spikes</option>
                                            <option value="kaleido">Kaleido burst</option>
                                            <option value="hex">Hex tunnel</option>
                                            <option value="orbit">Orbit arcs</option>
                                            <option value="comet">Comet sweep</option>
                                            <option value="laserline">Laser line</option>
                                            <option value="sidelines">Side rails</option>
                                            <option value="lightning">Lightning strike</option>
                                            <option value="arcdrive">Arc drive</option>
                                            <option value="disco">Disco sphere</option>
                                            <option value="tilestorm">Tile storm</option>
                                            <option value="waveform">Waveform</option>
                                        </select>
                                    </label>
                                    <label className="text-xs text-zinc-300">
                                        Preset
                                        <select
                                            value={visualizerPreset}
                                            onChange={(e) => updateRoom({ visualizerPreset: e.target.value })}
                                            className={quickMenuSelectClass}
                                        >
                                            <option value="calm">Calm</option>
                                            <option value="club">Club</option>
                                            <option value="neon">Neon</option>
                                            <option value="retro">Retro</option>
                                            <option value="acid">Acid</option>
                                            <option value="mono">Mono</option>
                                            <option value="cyan_magenta">Cyan/Magenta</option>
                                            <option value="solar">Solar</option>
                                        </select>
                                    </label>
                                    <button
                                        onClick={() => updateRoom({ visualizerSyncLightMode: !visualizerSyncLightMode })}
                                        className={`${styles.btnStd} ${visualizerSyncLightMode ? styles.btnHighlight : styles.btnNeutral} mt-5 h-10`}
                                        title="Sync visualizer preset with live light modes"
                                    >
                                        <i className="fa-solid fa-link mr-2"></i>{visualizerSyncLightMode ? 'Light Sync On' : 'Light Sync Off'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <label className="text-xs text-zinc-300">
                                        Sensitivity: <span className="text-white">{visualizerSensitivityDraft.toFixed(2)}x</span>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="2.5"
                                            step="0.05"
                                            value={visualizerSensitivityDraft}
                                            onPointerDown={() => { visualizerSliderDraggingRef.current.sensitivity = true; }}
                                            onChange={(e) => handleVisualizerSliderDraftChange('visualizerSensitivity', e.target.value)}
                                            onPointerUp={(e) => commitVisualizerSliderChange('visualizerSensitivity', e.target.value)}
                                            onPointerCancel={(e) => commitVisualizerSliderChange('visualizerSensitivity', e.target.value)}
                                            onBlur={(e) => commitVisualizerSliderChange('visualizerSensitivity', e.target.value)}
                                            onWheelCapture={blockRangeWheelDefault}
                                            className="w-full accent-[#00C4D9] mt-1 h-2.5"
                                        />
                                    </label>
                                    <label className="text-xs text-zinc-300">
                                        Smoothing: <span className="text-white">{visualizerSmoothingDraft.toFixed(2)}</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="0.95"
                                            step="0.05"
                                            value={visualizerSmoothingDraft}
                                            onPointerDown={() => { visualizerSliderDraggingRef.current.smoothing = true; }}
                                            onChange={(e) => handleVisualizerSliderDraftChange('visualizerSmoothing', e.target.value)}
                                            onPointerUp={(e) => commitVisualizerSliderChange('visualizerSmoothing', e.target.value)}
                                            onPointerCancel={(e) => commitVisualizerSliderChange('visualizerSmoothing', e.target.value)}
                                            onBlur={(e) => commitVisualizerSliderChange('visualizerSmoothing', e.target.value)}
                                            onWheelCapture={blockRangeWheelDefault}
                                            className="w-full accent-[#00C4D9] mt-1 h-2.5"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className={quickStripItemClass} ref={overlaysMenuRef}>
                    <button
                        data-feature-id="deck-overlays-menu-toggle"
                        aria-expanded={showOverlaysMenu}
                        onClick={() => {
                            const next = !showOverlaysMenu;
                            closeAllTopMenus();
                            setShowOverlaysMenu(next);
                        }}
                        className={`${quickMenuToggleClass} ${compactTopQuickStrip ? '' : 'min-w-[146px] sm:min-w-[164px]'}`}
                        title="Overlays and guides"
                        style={{ touchAction: 'manipulation' }}
                    >
                        <i className="fa-solid fa-layer-group mr-1"></i>
                        Overlays
                        <span className="ml-1 text-[10px] text-zinc-300">{overlaysActiveCount} on</span>
                        <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showOverlaysMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                    {showOverlaysMenu && (
                        <div className={`${quickMenuPanelClass} ${quickMenuScrollClass} right-0 w-[min(430px,94vw)] max-h-[74vh] p-3.5`}>
                            <div className={quickMenuSectionTitleClass}>Overlays + Guides</div>
                            <div className={`${quickMenuSectionHintClass} mb-2`}>
                                TV assist layers and quick audience prompts.
                            </div>
                            <div className={`${quickMenuCardClass} mb-3 space-y-3`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-xs uppercase tracking-[0.22em] text-cyan-200">Crowd mode</div>
                                        <div role="status" aria-live="polite" aria-atomic="true">
                                            <div className="mt-1 text-sm font-semibold text-white">{crowdModeSummary.label}</div>
                                            <div className="mt-1 text-[11px] text-zinc-300">{crowdModeSummary.description}</div>
                                        </div>
                                    </div>
                                    <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                                        {crowdModeSummary.shortLabel}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {CROWD_MODE_PRESETS.map((preset) => {
                                        const selected = crowdModeSummary.presetId === preset.id;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => { void applyCrowdModePreset(preset.id); }}
                                                aria-pressed={selected}
                                                aria-label={`Use ${preset.label} crowd mode`}
                                                className={`${styles.btnStd} ${selected ? styles.btnHighlight : styles.btnNeutral} min-h-[74px] min-w-0 items-start justify-start whitespace-normal px-3 py-2.5 text-left normal-case tracking-[0.03em]`}
                                            >
                                                <span className="flex min-w-0 flex-col items-start text-left">
                                                    <span className="text-sm font-semibold leading-tight">{preset.shortLabel}</span>
                                                    <span className="mt-1 text-[10px] leading-4 text-zinc-400 normal-case tracking-normal whitespace-normal break-words">{preset.description}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="text-[11px] text-zinc-400">
                                    Crowd modes update Score HUD, TV chat, marquee, and trivia together. Use the individual controls below only when you need a one-off exception.
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                    <div className="text-zinc-500">
                                        {liveCrowdModeHistoryLabel || 'Live changes affect tonight only.'}
                                    </div>
                                    {typeof onUndoCrowdModePreset === 'function' ? (
                                        <button
                                            type="button"
                                            onClick={() => { void onUndoCrowdModePreset('crowd_mode', { surface: 'top_chrome' }); }}
                                            className={`${styles.btnStd} ${styles.btnNeutral} min-h-[34px] px-3 py-1.5 text-[11px] normal-case tracking-[0.03em]`}
                                        >
                                            Undo last live crowd mode
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    onClick={() => toggleOverlayScreen('leaderboard')}
                                    className={`${styles.btnStd} ${leaderboardActive ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-trophy"></i>
                                        <span className="flex flex-col">
                                            <span>Leaderboard</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Show top scores on TV</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{leaderboardActive ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={() => toggleOverlayScreen('leaderboard_stack')}
                                    className={`${styles.btnStd} ${leaderboardStackActive ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-layer-group"></i>
                                        <span className="flex flex-col">
                                            <span>Leaderboard Stack</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Show the stacked standings board</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{leaderboardStackActive ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={() => toggleOverlayScreen('tipping')}
                                    className={`${styles.btnStd} ${tipCtaActive ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-money-bill-wave"></i>
                                        <span className="flex flex-col">
                                            <span>Tip CTA</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Promote tipping and support</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{tipCtaActive ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={toggleHowToPlayOverlay}
                                    className={`${styles.btnStd} ${howToPlayActive ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-circle-question"></i>
                                        <span className="flex flex-col">
                                            <span>How To Play</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Audience instruction panel</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{howToPlayActive ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={async () => {
                                        await startReadyCheck?.();
                                    }}
                                    className={`${styles.btnStd} ${room?.readyCheck?.active ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-hourglass-half"></i>
                                        <span className="flex flex-col">
                                            <span>Ready Check</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Countdown and attendance ping</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{room?.readyCheck?.active ? 'Live' : 'Start'}</span>
                                </button>
                                <button
                                    onClick={toggleMarqueeOverlay}
                                    className={`${styles.btnStd} ${marqueeActive ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-scroll"></i>
                                        <span className="flex flex-col">
                                            <span>Marquee</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Ticker text across screen</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{marqueeActive ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={togglePopTriviaOverlay}
                                    className={`${styles.btnStd} ${popTriviaActive ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-brain"></i>
                                        <span className="flex flex-col">
                                            <span>Pop Trivia (AI)</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Song trivia for audience phones + TV</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{popTriviaActive ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={toggleChatTvOverlay}
                                    className={`${styles.btnStd} ${chatTvActive ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-comments"></i>
                                        <span className="flex flex-col">
                                            <span>
                                                Chat TV
                                                {chatUnread > 0 && <span className="inline-flex h-2.5 w-2.5 rounded-full bg-pink-400 ml-1.5"></span>}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Audience chat on TV</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{chatTvActive ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={toggleChatTvFullscreen}
                                    className={`${styles.btnStd} ${chatFullscreenActive ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-expand"></i>
                                        <span className="flex flex-col">
                                            <span>Full Screen Chat</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Prioritize chat as main layer</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{chatFullscreenActive ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={() => setAudiencePreviewVisible?.((prev) => !prev)}
                                    className={`${styles.btnStd} ${audiencePreviewVisible ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-mobile-screen-button"></i>
                                        <span className="flex flex-col">
                                            <span>Audience App Preview</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Persistent host-side phone view</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{audiencePreviewVisible ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={() => setAudiencePreviewMode?.((prev) => prev === 'live_audience' ? 'thumbnail' : 'live_audience')}
                                    disabled={!audiencePreviewVisible}
                                    className={`${styles.btnStd} ${audiencePreviewMode === 'live_audience' ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em] ${!audiencePreviewVisible ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    title="Switch between the light summary and the live audience app"
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-mobile-screen"></i>
                                        <span className="flex flex-col">
                                            <span>Audience Viewport</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Summary or interactive live app</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{audiencePreviewMode === 'live_audience' ? 'Live App' : 'Thumb'}</span>
                                </button>
                                <button
                                    onClick={() => setPublicTvPreviewVisible?.((prev) => !prev)}
                                    className={`${styles.btnStd} ${publicTvPreviewVisible ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-display"></i>
                                        <span className="flex flex-col">
                                            <span>Public TV Preview</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Host-side view of live TV output</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{publicTvPreviewVisible ? 'On' : 'Off'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className={quickStripItemClass} ref={scenesQuickMenuRef}>
                    <button
                        data-feature-id="deck-scenes-menu-toggle"
                        onClick={() => {
                            const next = !showScenesQuickMenu;
                            closeAllTopMenus();
                            setShowScenesQuickMenu(next);
                        }}
                        className={`${quickMenuToggleClass} ${compactTopQuickStrip ? '' : 'min-w-[148px] sm:min-w-[168px]'}`}
                        title="TV moments and campaign scenes"
                        style={{ touchAction: 'manipulation' }}
                    >
                        <i className="fa-solid fa-photo-film mr-1"></i>
                        Scenes
                        <span className="ml-1 text-[10px] text-zinc-300">{activeMediaScene ? 'Live' : scenePresetCount}</span>
                        <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showScenesQuickMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                    {showScenesQuickMenu && (
                        <div className={`${quickMenuPanelClass} ${quickMenuScrollClass} right-0 w-[min(560px,95vw)] max-h-[78vh] p-3.5`}>
                            <div className={quickMenuSectionTitleClass}>Scenes + Moments</div>
                            <div className={quickMenuSectionHintClass}>
                                Launch campaign visuals now, line them up next, or drop them into the run of show without leaving the deck.
                            </div>
                            <div className={`${quickMenuCardClass} mt-2 space-y-2`}>
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em]">
                                    <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-cyan-100">{scenePresetCount} saved scenes</span>
                                    {activeMediaScene ? (
                                        <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">Live on TV</span>
                                    ) : (
                                        <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-zinc-300">Standby</span>
                                    )}
                                </div>
                                {activeMediaScene ? (
                                    <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-100">Current Scene</div>
                                        <div className="mt-1 text-sm font-bold text-white">{activeMediaScene.title || activeMediaScene.headline || 'Media scene'}</div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClearScenePreset?.();
                                            }}
                                            className={`${styles.btnStd} ${styles.btnNeutral} mt-2 px-3 py-1 text-[10px]`}
                                        >
                                            End Scene
                                        </button>
                                    </div>
                                ) : null}
                                {room?.purchaseCelebration?.id ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onReplayPurchaseCelebration?.();
                                        }}
                                        className={`${styles.btnStd} ${styles.btnSecondary} w-full justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <i className="fa-solid fa-sack-dollar"></i>
                                            Replay Last Support Burst
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest">TV</span>
                                    </button>
                                ) : null}
                            </div>                            <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="text-xs uppercase tracking-[0.22em] text-zinc-200">Quick Launch</div>
                                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Tap preview to run</div>
                            </div>
                            <div data-feature-id="deck-scenes-thumbnail-quick-launch" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {recentScenePresets.length > 0 ? recentScenePresets.map((preset) => {
                                    const mediaType = String(preset?.mediaType || '').trim().toLowerCase() === 'video' ? 'video' : 'image';
                                    const durationSec = Math.max(5, Math.min(600, Number(preset?.durationSec || 20) || 20));
                                    return (
                                        <div key={preset.id || preset.mediaUrl} className="min-w-0 rounded-xl border border-white/10 bg-black/35 p-2">
                                            <button
                                                type="button"
                                                data-feature-id="deck-scene-thumbnail-launch"
                                                onClick={() => {
                                                    onLaunchScenePreset?.(preset);
                                                }}
                                                className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-950 text-left transition hover:border-cyan-300/45 active:scale-[0.98]"
                                                aria-label={`Run scene ${preset.title || 'Scene'} live`}
                                            >
                                                {preset.mediaUrl ? (
                                                    mediaType === 'video'
                                                        ? <video src={preset.mediaUrl} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]" muted playsInline />
                                                        : <img src={preset.mediaUrl} alt="" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]" />
                                                ) : (
                                                    <span className="flex h-full w-full items-center justify-center text-zinc-500"><i className="fa-solid fa-photo-film"></i></span>
                                                )}
                                                <span className="absolute inset-x-1.5 bottom-1.5 rounded-full border border-cyan-200/35 bg-black/75 px-2 py-1 text-center text-[9px] font-black uppercase tracking-[0.12em] text-cyan-50 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                                                    Run Live
                                                </span>
                                            </button>
                                            <div className="mt-2 min-h-[38px]">
                                                <div className="truncate text-xs font-black text-white">{preset.title || 'Scene'}</div>
                                                <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-zinc-500">{mediaType === 'video' ? 'Video' : 'Still'} / {durationSec}s</div>
                                            </div>
                                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onQueueScenePreset?.(preset);
                                                    }}
                                                    className={`${styles.btnStd} ${styles.btnPrimary} justify-center px-2 py-1 text-[9px]`}
                                                >
                                                    Queue
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onOpenSceneLibrary?.('scenes');
                                                    }}
                                                    className={`${styles.btnStd} ${styles.btnNeutral} justify-center px-2 py-1 text-[9px]`}
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="col-span-full rounded-xl border border-dashed border-white/12 bg-black/25 px-3 py-4 text-sm text-zinc-400">
                                        Save visuals in the TV library to launch them from here.
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                                <div className="text-xs uppercase tracking-[0.22em] text-zinc-200">Templates</div>
                                <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Add to show</div>
                            </div>
                            <div data-feature-id="deck-scenes-template-quick-pads" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {TOP_SCENE_TEMPLATE_QUICK_PADS.map((template) => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        disabled={typeof onAddQuickRunOfShowMoment !== 'function'}
                                        onClick={() => onAddQuickRunOfShowMoment?.(template.id)}
                                        className={`min-h-[74px] rounded-xl border border-white/10 bg-zinc-950/70 px-2.5 py-2 text-left transition hover:border-cyan-300/35 hover:bg-cyan-500/10 ${typeof onAddQuickRunOfShowMoment !== 'function' ? 'cursor-not-allowed opacity-55' : 'active:scale-[0.98]'}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                                                <i className={`fa-solid ${template.icon}`}></i>
                                            </span>
                                            <span className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-500">{template.group}</span>
                                        </div>
                                        <div className="mt-1.5 text-[11px] font-black leading-tight text-white">{template.label}</div>
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    onOpenSceneLibrary?.('scenes');
                                    closeAllTopMenus();
                                }}
                                className={`${styles.btnStd} ${styles.btnNeutral} mt-3 w-full justify-center py-2 text-sm normal-case tracking-[0.03em]`}
                            >
                                Open Media Library
                            </button>
                        </div>
                    )}
                </div>
                <div className={quickStripItemClass} ref={sfxQuickMenuRef}>
                    <button
                        data-feature-id="deck-sfx-menu-toggle"
                        onClick={() => {
                            const next = !showSfxQuickMenu;
                            closeAllTopMenus();
                            setShowSfxQuickMenu(next);
                        }}
                        className={`${quickMenuToggleClass} ${compactTopQuickStrip ? '' : 'min-w-[142px] sm:min-w-[160px]'}`}
                        title="Sound effects controls"
                        style={{ touchAction: 'manipulation' }}
                    >
                        <i className="fa-solid fa-wave-square mr-1"></i>
                        SFX: {sfxMuted ? 'Muted' : `${Math.round((sfxVolume || 0) * 100)}%`}
                        <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showSfxQuickMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                    {showSfxQuickMenu && (
                        <div className={`${quickMenuPanelClass} right-0 w-[min(360px,92vw)] p-3.5`}>
                            <div className={`${quickMenuSectionTitleClass} mb-2`}>Sound Effects</div>
                            <div className={quickMenuCardClass}>
                                <div className="flex items-center gap-2">
                                    <button
                                        data-feature-id="deck-sfx-mute"
                                        onClick={() => setSfxMuted?.((prev) => {
                                            const next = !prev;
                                            if (next) silenceAll?.();
                                            return next;
                                        })}
                                        className={`${styles.btnStd} ${sfxMuted ? styles.btnHighlight : styles.btnNeutral} py-2 text-sm normal-case tracking-[0.03em] min-w-[76px]`}
                                        title={sfxMuted ? 'Unmute FX' : 'Mute FX'}
                                    >
                                        <i className={`fa-solid ${sfxMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                                        {sfxMuted ? 'Muted' : 'On'}
                                    </button>
                                    <input
                                        data-feature-id="deck-sfx-volume"
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={sfxVolumeDraftPct}
                                        onPointerDown={() => { sliderDraggingRef.current.sfx = true; }}
                                        onChange={(event) => handleSfxVolumeDraftChange(event.target.value)}
                                        onPointerUp={(event) => commitSfxVolumeChange(event.target.value)}
                                        onPointerCancel={(event) => commitSfxVolumeChange(event.target.value)}
                                        onBlur={(event) => commitSfxVolumeChange(event.target.value)}
                                        onWheelCapture={blockRangeWheelDefault}
                                        className="flex-1 h-2.5 bg-zinc-800 accent-[#00C4D9] rounded-lg appearance-none cursor-pointer"
                                        style={{ background: `linear-gradient(90deg, #00E5FF ${sfxVolumeDraftPct}%, #27272a ${sfxVolumeDraftPct}%)` }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onOpenSceneLibrary?.('sfx');
                                        closeAllTopMenus();
                                    }}
                                    className={`${styles.btnStd} ${styles.btnSecondary} mt-2.5 w-full justify-center py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <i className="fa-solid fa-folder-plus"></i>
                                    Upload / Organize SFX
                                </button>
                                <div className="mt-2.5 space-y-1.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                                    {(sounds || []).map((sound) => (
                                        <button
                                            data-feature-id="deck-sfx-button"
                                            key={`deck-sfx-quick-${sound.name}`}
                                            onClick={() => playSfxSafe?.(sound.url)}
                                            className={`${styles.btnStd} ${styles.btnNeutral} w-full min-h-[40px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <i className={`fa-solid ${sound.icon}`}></i>
                                                {sound.name}
                                            </span>
                                            <i className="fa-solid fa-play text-[11px]"></i>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className={quickStripItemClass} ref={vibeQuickMenuRef}>
                    <button
                        data-feature-id="deck-vibe-menu-toggle"
                        onClick={() => {
                            const next = !showVibeQuickMenu;
                            closeAllTopMenus();
                            setShowVibeQuickMenu(next);
                        }}
                        className={`${quickMenuToggleClass} ${compactTopQuickStrip ? '' : 'min-w-[146px] sm:min-w-[164px]'}`}
                        title="Vibe sync modes"
                        style={{ touchAction: 'manipulation' }}
                    >
                        <i className="fa-solid fa-bolt mr-1"></i>
                        Vibe: {activeVibeLabel}
                        <i className={`fa-solid fa-chevron-down ml-1 text-[10px] transition-transform ${showVibeQuickMenu ? 'rotate-180' : ''}`}></i>
                    </button>
                    {showVibeQuickMenu && (
                        <div className={`${quickMenuPanelClass} right-0 w-[min(380px,92vw)] p-3.5`}>
                            <div className={`${quickMenuSectionTitleClass} mb-2`}>Vibe Sync Modes</div>
                            <div className={quickMenuCardClass}>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => runLiveEffect('beat_drop')} className={`${styles.btnStd} ${strobeActive ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-bolt"></i>
                                        {strobeActive ? 'Beat ON' : 'Beat Drop'}
                                    </button>
                                    <button onClick={() => runLiveEffect('storm')} className={`${styles.btnStd} ${stormActive ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-cloud-bolt"></i>
                                        {stormActive ? 'Storm ON' : 'Storm'}
                                    </button>
                                    <button onClick={() => runLiveEffect('guitar')} className={`${styles.btnStd} ${guitarActive ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-guitar"></i>
                                        {guitarActive ? 'Guitar ON' : 'Guitar'}
                                    </button>
                                    <button onClick={() => runLiveEffect('banger')} className={`${styles.btnStd} ${bangerActive ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-fire"></i>
                                        {bangerActive ? 'Banger ON' : 'Banger'}
                                    </button>
                                    <button onClick={() => runLiveEffect('ballad')} className={`${styles.btnStd} ${balladActive ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-music"></i>
                                        {balladActive ? 'Ballad ON' : 'Ballad'}
                                    </button>
                                    {CROWD_OBJECTIVE_MODES.map((mode) => {
                                        const isActive = room?.lightMode === mode.lightMode;
                                        return (
                                            <button key={`vibe-objective-${mode.id}`} onClick={() => toggleCrowdObjectiveMode(mode.lightMode)} className={`${styles.btnStd} ${isActive ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}>
                                                <i className={`fa-solid ${mode.icon}`}></i>
                                                {isActive ? `${mode.shortLabel} ON` : mode.label}
                                            </button>
                                        );
                                    })}
                                    {volleyActive && (
                                        <button onClick={() => runLiveEffect('volley')} className={`${styles.btnStd} ${styles.btnDanger} h-10 py-2 text-sm normal-case tracking-[0.03em]`}>
                                            <i className="fa-solid fa-circle-stop"></i>
                                            End Orb Mode
                                        </button>
                                    )}
                                    <button onClick={() => runLiveEffect('selfie_cam')} className={`${styles.btnStd} ${selfieCamActive ? styles.btnHighlight : styles.btnNeutral} h-10 py-2 text-sm normal-case tracking-[0.03em]`}>
                                        <i className="fa-solid fa-camera"></i>
                                        {selfieCamActive ? 'Selfie Cam ON' : 'Selfie Cam'}
                                    </button>
                                </div>
                                <button onClick={() => runLiveEffect('clear')} className={`${styles.btnStd} ${styles.btnSecondary} w-full mt-2 h-10 py-2 text-sm normal-case tracking-[0.03em]`}>
                                    <i className="fa-solid fa-power-off"></i>
                                    Clear Effects
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showMissionStatusBanner && (
                <div className="mt-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                    {missionStatusDetail || missionRecommendation?.reason || 'Action needed in room flow.'}
                </div>
            )}
            {liveModeHostGuide && !runOfShowFocusMode && !(runOfShowEnabled || hasRunOfShowPlan) && (
                <div className={`mt-2 rounded-xl border px-3 py-2 ${liveModeHostGuide.toneClass}`}>
                    <div className="text-[11px] uppercase tracking-[0.22em] font-bold">{liveModeHostGuide.title}</div>
                    <div className="text-xs mt-1">{liveModeHostGuide.summary}</div>
                    <div className="text-[11px] mt-1.5 text-white/90">{liveModeHostGuide.actions}</div>
                </div>
            )}
            {activeMomentFeedback?.id ? (
                <div
                    role="status"
                    aria-live="polite"
                    className={`mt-2 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] ${activeMomentFeedback.toneClass || 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100'}`}
                >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-black/20 text-base text-white">
                        <i className={`fa-solid ${activeMomentFeedback.icon || 'fa-bolt'}`}></i>
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                                {activeMomentFeedback.sourceTag || 'Live moment'}
                            </span>
                            <span className="rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/90">
                                {activeMomentFeedback.label}
                            </span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">{activeMomentFeedback.detail || 'Sting live'}</div>
                    </div>
                </div>
            ) : null}
        </div>
    </div>
    );
};

export default HostTopChrome;




