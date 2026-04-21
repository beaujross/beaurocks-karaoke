import React from 'react';
import ModerationInboxChip from './ModerationInboxChip';
import { CROWD_OBJECTIVE_MODES, getCrowdObjectiveModeFromLightMode } from '../../../lib/crowdObjectiveModes';
import {
    getRunOfShowHudActionKey,
    getRunOfShowHudState,
    getRunOfShowHudToneClass,
    getRunOfShowItemLabel,
    normalizeRunOfShowDirector
} from '../../../lib/runOfShowDirector';

const NavStatusLight = ({ label, iconClass, active = false, toneClass = '', onClick, title = '' }) => {
    const Comp = typeof onClick === 'function' ? 'button' : 'div';
    return (
        <Comp
            onClick={onClick}
            title={title}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${toneClass} ${typeof onClick === 'function' ? 'cursor-pointer hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50' : ''}`}
        >
            <span className={`inline-flex h-2 w-2 rounded-full ${active ? 'bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.85)]' : 'bg-rose-300 shadow-[0_0_8px_rgba(252,165,165,0.55)]'}`}></span>
            {!!iconClass && <i className={`${iconClass} text-[10px] text-zinc-200`}></i>}
            <span className="text-zinc-100 hidden lg:inline">{label}</span>
        </Comp>
    );
};

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

const formatRunOfShowTotalDuration = (value = 0) => {
    const totalSec = Math.max(0, Math.round(Number(value || 0) || 0));
    if (!totalSec) return '0m';
    const mins = Math.ceil(totalSec / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
    return `${mins}m`;
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
    gamesMeta,
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
    autoBgMusic,
    setAutoBgMusic,
    autoPlayMedia,
    setAutoPlayMedia,
    autoDj = false,
    setAutoDj,
    autoEndOnTrackFinish = true,
    setAutoEndOnTrackFinish,
    autoBonusEnabled = true,
    setAutoBonusEnabled,
    autoLyricsOnQueue = false,
    setAutoLyricsOnQueue,
    autoPartyEnabled = false,
    onToggleAutoParty,
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
    aiToolsConnected = false,
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
    onOpenModerationInbox,
    onOpenAppleMusicSettings,
    onOpenAiSettings,
    onOpenAccessSettings,
    onOpenHostDashboard,
    showStageQuickStart = false,
    stageQuickStartCompletedCount = 0,
    stageQuickStartSummary = '',
    stageQuickStartItems = [],
    onDismissStageQuickStart,
    audiencePreviewVisible = false,
    setAudiencePreviewVisible,
    audiencePreviewMode = 'thumbnail',
    setAudiencePreviewMode,
    tabletTouchViewport = false,
    runOfShowEnabled = false,
    runOfShowDirector = null,
    runOfShowLiveItem = null,
    runOfShowStagedItem = null,
    runOfShowNextItem = null,
    runOfShowPreflightReport = null,
    onOpenShowWorkspace,
    onOpenRunOfShowIssue,
    onStartRunOfShow,
    onStopRunOfShow,
    onAdvanceRunOfShow,
    onRewindRunOfShow,
    onFocusRunOfShowItem,
    onTriggerRunOfShowItem,
    onToggleRunOfShowAutomationPause,
    runOfShowQaStatusDetail = '',
    runOfShowFocusMode = false,
    activeMomentFeedback = null
}) => {
    const resolvedHostBase = hostBase || appBase;
    const resolvedAudienceBase = audienceBase || appBase;
    const resolvedTvBase = tvBase || appBase;
    const launchTvHref = String(launchUrls?.tvUrl || '').trim() || `${resolvedTvBase}?room=${roomCode}&mode=tv`;
    const launchAudienceHref = String(launchUrls?.audienceUrl || '').trim() || `${resolvedAudienceBase}?room=${roomCode}`;
    const clampNumber = (value, min, max, fallback = min) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return Math.max(min, Math.min(max, numeric));
    };
    const SmallWaveform = smallWaveform;
    const [showAutomationMenu, setShowAutomationMenu] = React.useState(false);
    const [showQuickStartMenu, setShowQuickStartMenu] = React.useState(false);
    const [showTvQuickMenu, setShowTvQuickMenu] = React.useState(false);
    const [showOverlaysMenu, setShowOverlaysMenu] = React.useState(false);
    const [showSfxQuickMenu, setShowSfxQuickMenu] = React.useState(false);
    const [showVibeQuickMenu, setShowVibeQuickMenu] = React.useState(false);
    const [compactRunOfShowCollapsed, setCompactRunOfShowCollapsed] = React.useState(() => {
        try {
            if (typeof window === 'undefined') return false;
            return window.localStorage.getItem('bross_host_compact_run_of_show_collapsed') === '1';
        } catch {
            return false;
        }
    });
    const [compactRunOfShowToolsOpen, setCompactRunOfShowToolsOpen] = React.useState(false);
    const launchMenuRef = React.useRef(null);
    const navMenuRef = React.useRef(null);
    const quickStartMenuRef = React.useRef(null);
    const automationMenuRef = React.useRef(null);
    const audioMenuRef = React.useRef(null);
    const tvQuickMenuRef = React.useRef(null);
    const overlaysMenuRef = React.useRef(null);
    const sfxQuickMenuRef = React.useRef(null);
    const vibeQuickMenuRef = React.useRef(null);
    const stormActive = room?.lightMode === 'storm';
    const strobeActive = room?.lightMode === 'strobe';
    const guitarActive = room?.lightMode === 'guitar';
    const bangerActive = room?.lightMode === 'banger';
    const balladActive = room?.lightMode === 'ballad';
    const activeCrowdObjectiveMode = getCrowdObjectiveModeFromLightMode(room?.lightMode);
    const volleyActive = !!activeCrowdObjectiveMode;
    const selfieCamActive = room?.activeMode === 'selfie_cam';
    const normalizedPermission = String(permissionLevel || 'unknown').toLowerCase();
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
    const permissionTone = normalizedPermission === 'owner'
        ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
        : normalizedPermission === 'admin'
            ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100'
            : normalizedPermission === 'member'
                ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
                : 'border-zinc-600 bg-zinc-900/70 text-zinc-300';
    const queueWorkspaceMode = tab === 'stage';
    const compactRunOfShowDense = queueWorkspaceMode && !runOfShowFocusMode;
    const missionStatus = missionRecommendation?.status || 'ready';
    const tvDisplayLabel = tvDisplayMode === 'lyrics_viz'
        ? 'Lyrics + Viz'
        : tvDisplayMode === 'lyrics'
            ? 'Lyrics'
            : tvDisplayMode === 'visualizer'
                ? 'Visualizer'
                : 'Video';
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
    const tipCtaActive = room?.activeScreen === 'tipping';
    const howToPlayActive = !!room?.howToPlay?.active;
    const activeAutomationCount = Number(!!autoPlayMedia)
        + Number(!!autoBgMusic)
        + Number(!!autoDj)
        + Number(!!autoEndOnTrackFinish)
        + Number(!!autoBonusEnabled)
        + Number(!!autoLyricsOnQueue)
        + Number(!!autoPartyEnabled)
        + Number(!!room?.bouncerMode);
    const overlaysActiveCount = Number(leaderboardActive) + Number(tipCtaActive) + Number(howToPlayActive) + Number(marqueeActive) + Number(chatTvActive) + Number(popTriviaActive);
    const quickStartTotalCount = Math.max(stageQuickStartItems?.length || 0, stageQuickStartCompletedCount || 0, 4);
    const quickStartPendingCount = Math.max(quickStartTotalCount - (stageQuickStartCompletedCount || 0), 0);
    const quickStartToneClass = quickStartPendingCount === 0 ? styles.btnSuccess : styles.btnInfo;
    const shouldShowQuickStartButton = (stageQuickStartItems?.length || 0) > 0 && (showStageQuickStart || quickStartPendingCount > 0);
    const compactTopQuickStrip = !!tabletTouchViewport && !runOfShowFocusMode;
    const quickMenuPanelClass = 'host-top-menu-panel absolute top-full mt-2 rounded-2xl border border-cyan-300/40 bg-zinc-950/98 backdrop-blur-md ring-1 ring-cyan-400/20 shadow-[0_24px_50px_rgba(0,0,0,0.68)] z-[320]';
    const quickMenuScrollClass = 'host-touch-scroll-panel overflow-y-auto custom-scrollbar overscroll-contain';
    const quickMenuSectionTitleClass = 'text-xs uppercase tracking-[0.22em] text-zinc-100';
    const quickMenuSectionHintClass = 'mt-1 text-[11px] leading-relaxed text-zinc-400';
    const quickMenuCardClass = 'rounded-xl border border-cyan-400/20 bg-black/45 p-2.5';
    const quickMenuSelectClass = `${styles.input} mt-1 h-10 text-sm bg-zinc-950/95 border border-cyan-300/35`;
    const quickMenuToggleClass = `${styles.btnStd} ${styles.btnNeutral} ${runOfShowFocusMode ? 'h-9 px-3 py-1.5 text-[12px]' : tabletTouchViewport ? 'h-11 px-3.5 py-2 text-[13px]' : 'h-9 px-3 py-1.5 text-[12px]'} ${compactTopQuickStrip ? 'w-full min-w-0' : 'shrink-0 whitespace-nowrap'} normal-case tracking-[0.04em]`;
    const quickAudioControlClass = 'flex min-w-[170px] shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2';
    const quickStripItemClass = compactTopQuickStrip ? 'relative min-w-0 flex-[1_1_calc(50%-0.25rem)]' : 'relative shrink-0';
    const showInlineAudioQuickControls = !compactTopQuickStrip;
    const anyTopMenuOpen = showQuickStartMenu
        || showAutomationMenu
        || audioPanelOpen
        || showTvQuickMenu
        || showOverlaysMenu
        || showSfxQuickMenu
        || showVibeQuickMenu
        || showLaunchMenu
        || showNavMenu;
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
    const compactRunOfShowItems = normalizedRunOfShowItems.map((item, index) => {
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
                    ? [item?.assignedPerformerName || '', item?.songTitle || '', item?.artistName || ''].filter(Boolean).join(' · ')
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
    const compactRunOfShowTotalDurationSec = compactRunOfShowItems.reduce((sum, item) => sum + Math.max(0, Number(item?.durationSec || 0) || 0), 0);
    const compactRunOfShowCurrentIndex = compactRunOfShowItems.findIndex((item) => item.isLive || item.isStaged || item.isNext);
    const runOfShowTransportStatus = runOfShowLiveItem?.id
        ? 'live'
        : runOfShowStagedItem?.id
            ? 'staged'
            : runOfShowNextItem?.id
                ? 'ready'
                : 'idle';
    const topCriticalRunOfShowItem = safeRunOfShowPreflightReport?.criticalItems?.[0] || null;
    const topRiskyRunOfShowItem = safeRunOfShowPreflightReport?.riskyItems?.[0] || null;
    const runOfShowHudState = getRunOfShowHudState({
        hasPlan: hasRunOfShowPlan,
        runEnabled: runOfShowEnabled,
        automationPaused: runOfShowAutomationPaused,
        preflightReport: safeRunOfShowPreflightReport,
        issueDetail: topCriticalRunOfShowItem?.summary || topRiskyRunOfShowItem?.summary || '',
        liveItemId: runOfShowLiveItem?.id,
        stagedItemId: runOfShowStagedItem?.id,
        nextItemId: runOfShowNextItem?.id
    });
    const runOfShowHudToneClass = getRunOfShowHudToneClass(runOfShowHudState.tone);
    const runOfShowHudActionKey = getRunOfShowHudActionKey({
        hasPlan: hasRunOfShowPlan,
        runEnabled: runOfShowEnabled,
        automationPaused: runOfShowAutomationPaused,
        preflightReport: safeRunOfShowPreflightReport,
        hasIssue: !!(topCriticalRunOfShowItem || topRiskyRunOfShowItem)
    });
    const runOfShowPrimaryAction = (() => {
        if (runOfShowHudActionKey === 'open_show') {
            return {
                label: 'Open Show',
                onClick: onOpenShowWorkspace,
                className: styles.btnNeutral,
                disabled: typeof onOpenShowWorkspace !== 'function'
            };
        }
        if (runOfShowHudActionKey === 'go_live_check') {
            return {
                label: 'Go Live Check',
                onClick: onOpenRunOfShowIssue || onOpenShowWorkspace,
                className: styles.btnHighlight,
                disabled: typeof (onOpenRunOfShowIssue || onOpenShowWorkspace) !== 'function'
            };
        }
        if (runOfShowHudActionKey === 'start_show') {
            return {
                label: 'Start Show',
                onClick: onStartRunOfShow,
                className: styles.btnHighlight,
                disabled: typeof onStartRunOfShow !== 'function'
            };
        }
        if (runOfShowHudActionKey === 'resume') {
            return {
                label: 'Resume',
                onClick: typeof onToggleRunOfShowAutomationPause === 'function'
                    ? () => onToggleRunOfShowAutomationPause(false)
                    : onOpenRunOfShowIssue || onOpenShowWorkspace,
                className: styles.btnHighlight,
                disabled: typeof (onToggleRunOfShowAutomationPause || onOpenRunOfShowIssue || onOpenShowWorkspace) !== 'function'
            };
        }
        if (runOfShowHudActionKey === 'fix_issue') {
            return {
                label: 'Fix Issue',
                onClick: () => (onOpenRunOfShowIssue || onOpenShowWorkspace)?.({ itemId: topCriticalRunOfShowItem?.itemId || topRiskyRunOfShowItem?.itemId || '' }),
                className: styles.btnHighlight,
                disabled: typeof (onOpenRunOfShowIssue || onOpenShowWorkspace) !== 'function'
            };
        }
        return {
            label: 'Advance',
            onClick: onAdvanceRunOfShow,
            className: styles.btnHighlight,
            disabled: typeof onAdvanceRunOfShow !== 'function' || runOfShowTransportStatus === 'idle'
        };
    })();
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
            setCompactRunOfShowToolsOpen(false);
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
        setShowQuickStartMenu(false);
        setShowAutomationMenu(false);
        setAudioPanelOpen?.(false);
        setShowTvQuickMenu(false);
        setShowOverlaysMenu(false);
        setShowSfxQuickMenu(false);
        setShowVibeQuickMenu(false);
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
        const handlePointerDown = (event) => {
            const target = event.target;
            const menuRefs = [
                quickStartMenuRef,
                automationMenuRef,
                audioMenuRef,
                tvQuickMenuRef,
                overlaysMenuRef,
                sfxQuickMenuRef,
                vibeQuickMenuRef,
                launchMenuRef,
                navMenuRef
            ];
            const clickedInsideMenu = menuRefs.some((menuRef) => menuRef.current?.contains(target));
            if (!clickedInsideMenu) {
                closeAllTopMenus();
            }
        };
        const handleEscape = (event) => {
            if (event.key === 'Escape') closeAllTopMenus();
        };
        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleEscape);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [anyTopMenuOpen, closeAllTopMenus]);

    React.useEffect(() => {
        if (quickStartPendingCount === 0) {
            setShowQuickStartMenu(false);
        }
    }, [quickStartPendingCount]);

    React.useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' || document.visibilityState === 'visible') {
                closeAllTopMenus();
            }
        };
        const handleBlur = () => {
            closeAllTopMenus();
        };
        const handleFocus = () => {
            closeAllTopMenus();
        };
        const handlePageHide = () => {
            closeAllTopMenus();
        };
        const handlePageShow = () => {
            closeAllTopMenus();
        };
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('pagehide', handlePageHide);
        window.addEventListener('pageshow', handlePageShow);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('pagehide', handlePageHide);
            window.removeEventListener('pageshow', handlePageShow);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [closeAllTopMenus]);

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
                    activeMode: selfieCamActive ? 'karaoke' : room?.activeMode
                });
            }
        }
        closeAllTopMenus();
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
        closeAllTopMenus();
    };
    const toggleCrowdObjectiveMode = async (modeLightMode) => {
        if (!modeLightMode) return;
        await updateRoom(buildCrowdObjectiveRoomPatch(modeLightMode));
        closeAllTopMenus();
    };
    const applyTvPresentationProfile = async (profile) => {
        const nextProfile = profile === 'simple' || profile === 'cinema' ? profile : 'room';
        await updateRoom({ tvPresentationProfile: nextProfile });
        closeAllTopMenus();
    };
    const toggleAutoBg = async () => {
        const next = !autoBgMusic;
        setAutoBgMusic(next);
        await updateRoom({ autoBgMusic: next });
        if (next && !playingBg) setBgMusicState(true);
    };
    const toggleAutoPlay = async () => {
        const next = !autoPlayMedia;
        setAutoPlayMedia(next);
        await updateRoom({ autoPlayMedia: next });
    };
    const toggleAutoDjMode = async () => {
        const next = !autoDj;
        setAutoDj?.(next);
        await updateRoom({ autoDj: next });
    };
    const toggleAutoEnd = async () => {
        const next = !autoEndOnTrackFinish;
        setAutoEndOnTrackFinish?.(next);
        await updateRoom({ autoEndOnTrackFinish: next });
    };
    const toggleAutoBonus = async () => {
        const next = !autoBonusEnabled;
        setAutoBonusEnabled?.(next);
        await updateRoom({ autoBonusEnabled: next });
    };
    const toggleAutoLyricsQueue = async () => {
        const next = !autoLyricsOnQueue;
        setAutoLyricsOnQueue?.(next);
        await updateRoom({ autoLyricsOnQueue: next });
    };
    const toggleAutoParty = async () => {
        if (typeof onToggleAutoParty === 'function') {
            await onToggleAutoParty();
        }
    };
    const toggleOverlayScreen = async (screenId) => {
        const nextScreen = room?.activeScreen === screenId ? 'stage' : screenId;
        await updateRoom({ activeScreen: nextScreen });
        closeAllTopMenus();
    };
    const toggleHowToPlayOverlay = async () => {
        await toggleHowToPlay?.();
        closeAllTopMenus();
    };
    const toggleMarqueeOverlay = async () => {
        const next = !marqueeActive;
        setMarqueeEnabled?.(next);
        await updateRoom({ marqueeEnabled: next });
        closeAllTopMenus();
    };
    const toggleChatTvOverlay = async () => {
        const next = !chatTvActive;
        setChatShowOnTv?.(next);
        const nextMode = next ? (chatTvMode || 'auto') : 'auto';
        setChatTvMode?.(nextMode);
        await updateRoom({ chatShowOnTv: next, chatTvMode: nextMode });
        closeAllTopMenus();
    };
    const toggleChatTvFullscreen = async () => {
        const nextFullscreen = !chatFullscreenActive;
        setChatShowOnTv?.(true);
        setChatTvMode?.(nextFullscreen ? 'fullscreen' : 'auto');
        await updateRoom({
            chatShowOnTv: true,
            chatTvMode: nextFullscreen ? 'fullscreen' : 'auto'
        });
        closeAllTopMenus();
    };
    const togglePopTriviaOverlay = async () => {
        const next = !popTriviaActive;
        setPopTriviaEnabled?.(next);
        await updateRoom({ popTriviaEnabled: next });
        closeAllTopMenus();
    };
    return (
    <div data-host-top-chrome="true" className={`bg-zinc-900 ${runOfShowFocusMode ? 'px-3.5 py-2' : 'px-4 py-2.5'} flex flex-col gap-2 shadow-2xl shrink-0 relative isolate z-[160] overflow-visible border-b border-zinc-800`}>
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between w-full">
            <div className="flex items-center gap-2 lg:gap-3">
                <img
                    src={room?.logoUrl || logoFallback}
                    className={`${runOfShowFocusMode ? 'h-10 lg:h-11' : 'h-11 lg:h-14'} object-contain rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.4)] ring-1 ring-white/10 bg-black/40 p-0.5`}
                    alt="Beaurocks Karaoke"
                />
                <div data-host-room-code className="text-[14px] sm:text-[16px] lg:text-[18px] font-mono font-bold text-[#00C4D9] bg-black/40 px-2 py-0.5 rounded-lg border border-[#00C4D9]/30">{roomCode}</div>
                {typeof onOpenHostDashboard === 'function' && (
                    <button
                        onClick={() => {
                            closeAllTopMenus();
                            onOpenHostDashboard();
                        }}
                        className={`${styles.btnStd} ${styles.btnNeutral} px-2.5 text-xs`}
                        title="Back to room manager and room creation"
                        style={{ touchAction: 'manipulation' }}
                    >
                        <i className="fa-solid fa-layer-group"></i>
                        <span className="hidden sm:inline">Room Manager</span>
                    </button>
                )}
                <div className="relative" ref={launchMenuRef}>
                    <button
                        onClick={() => {
                            const next = !showLaunchMenu;
                            closeAllTopMenus();
                            setShowLaunchMenu(next);
                        }}
                        className={`${styles.btnStd} ${styles.btnSecondary} px-2.5 text-xs`}
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
                                onClick={() => openLaunchTarget(`${resolvedHostBase}?room=${encodeURIComponent(roomCode || '')}&mode=host&view=queue&section=queue.catalog`)}
                                className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                            >
                                <i className="fa-solid fa-book-open mr-2 text-yellow-300"></i> Launch Catalogue
                            </button>
                            <div className="px-4 py-2 text-sm uppercase tracking-[0.3em] text-zinc-500 border-t border-zinc-800">
                                Game Displays
                            </div>
                            {gamesMeta.map((game, idx, arr) => (
                                <button
                                    key={game.id}
                                    type="button"
                                    onClick={() => openLaunchTarget(`${resolvedHostBase}?room=${roomCode}&mode=host&game=${game.id}`)}
                                    className={`block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900 ${idx === arr.length - 1 ? 'rounded-b-xl' : ''}`}
                                >
                                    <i className="fa-solid fa-gamepad mr-2 text-cyan-300"></i>
                                    {game.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {showTimeClockEnabled && (
                    <div className={`ml-1 flex min-w-[168px] items-center gap-2 rounded-2xl border border-cyan-300/20 bg-black/35 shadow-[0_12px_28px_rgba(0,0,0,0.24)] ${runOfShowFocusMode ? 'px-3 py-1.5' : 'px-3 py-1.5'}`}>
                        <div className={`inline-flex items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-500/10 text-cyan-100 ${runOfShowFocusMode ? 'h-9 w-9' : 'h-9 w-9'}`}>
                            <i className="fa-solid fa-clock"></i>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/80">Show Time</div>
                                <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-300">
                                    {showTimeModeLabel}
                                </div>
                            </div>
                            <div className={`${runOfShowFocusMode ? 'mt-0 text-lg' : 'mt-0.5 text-lg'} truncate whitespace-nowrap font-black leading-none text-white tabular-nums`}>
                                {showTimePrimaryLabel}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 lg:gap-3 justify-between lg:justify-end">
                {room?.activeMode && room.activeMode !== 'karaoke' && (
                    <div data-host-live-mode={room.activeMode} className="bg-red-600 px-2.5 py-0.5 rounded text-xs lg:text-sm font-bold animate-pulse">LIVE: {room.activeMode.toUpperCase()}</div>
                )}
                <ModerationInboxChip
                    pendingCount={moderationPendingCount}
                    severity={moderationSeverity}
                    needsAttention={moderationNeedsAttention}
                    onClick={onOpenModerationInbox}
                    className="xl:hidden"
                />
                <div className="hidden xl:flex items-center gap-2">
                    <ModerationInboxChip
                        pendingCount={moderationPendingCount}
                        severity={moderationSeverity}
                        needsAttention={moderationNeedsAttention}
                        onClick={onOpenModerationInbox}
                    />
                    {[
                        { key: 'stage', label: 'Queue' },
                        { key: 'run_of_show', label: 'Show' },
                        { key: 'games', label: 'Games' },
                        { key: 'lobby', label: 'Audience' },
                        { key: 'admin', label: 'Admin' }
                    ].map(t => (
                        <button
                            key={t.key}
                            data-host-tab={t.key}
                            onClick={() => {
                                if (t.key === 'admin' && typeof openAdminWorkspace === 'function') {
                                    openAdminWorkspace('ops.room_setup');
                                    return;
                                }
                                setTab(t.key);
                            }}
                            className={`px-3 py-1.5 text-sm font-black uppercase tracking-[0.22em] rounded-xl border-b-2 transition-all ${tab === t.key ? 'text-[#00C4D9] border-[#00C4D9] bg-black/40' : 'text-zinc-400 border-transparent bg-zinc-900/40 hover:text-white'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5">
                    <NavStatusLight
                        label="Apple"
                        iconClass="fa-brands fa-apple"
                        active={appleMusicConnected}
                        toneClass={appleMusicConnected ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border-rose-400/35 bg-rose-500/10 text-rose-100'}
                        onClick={onOpenAppleMusicSettings}
                        title={appleMusicConnected ? 'Apple Music connected. Open music settings.' : 'Apple Music not linked. Open music settings.'}
                    />
                    <NavStatusLight
                        label="AI"
                        iconClass="fa-solid fa-robot"
                        active={aiToolsConnected}
                        toneClass={aiToolsConnected ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100' : 'border-amber-400/35 bg-amber-500/10 text-amber-100'}
                        onClick={onOpenAiSettings}
                        title={aiToolsConnected ? 'AI tools enabled. Open AI settings.' : 'AI tools locked. Open AI settings.'}
                    />
                    <NavStatusLight
                        label={String(permissionLevel || 'unknown').toUpperCase()}
                        iconClass="fa-solid fa-user-shield"
                        active={authSessionReady}
                        toneClass={permissionTone}
                        onClick={onOpenAccessSettings}
                        title={authSessionReady ? 'Session active. Open access settings.' : 'Session not ready. Open access settings.'}
                    />
                </div>
                <button
                    onClick={() => {
                        if (typeof openAdminWorkspace === 'function') {
                            openAdminWorkspace('ops.room_setup');
                            return;
                        }
                        setShowSettings(true);
                        setSettingsTab('general');
                    }}
                    className="text-zinc-500 hover:text-white"
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
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
        <div data-host-quick-strip-wrap="true" className={`w-full overflow-visible rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 via-zinc-950/70 to-emerald-500/10 ${runOfShowFocusMode ? 'px-3 py-2' : 'px-3 py-2.5'}`}>
            <div className={`host-top-quick-strip flex min-w-0 gap-2 custom-scrollbar ${compactTopQuickStrip ? 'flex-wrap items-stretch overflow-visible pb-0' : anyTopMenuOpen ? 'flex-nowrap items-center overflow-visible pb-1 pr-0.5' : 'flex-nowrap items-center overflow-x-auto pb-1 pr-0.5'}`}>
                {shouldShowQuickStartButton && (
                    <div className={quickStripItemClass} ref={quickStartMenuRef}>
                        <button
                            data-feature-id="deck-quick-start-menu-toggle"
                            onClick={() => {
                                const next = !showQuickStartMenu;
                                closeAllTopMenus();
                                setShowQuickStartMenu(next);
                            }}
                            className={`${quickMenuToggleClass} ${quickStartToneClass} ${compactTopQuickStrip ? '' : 'min-w-[168px] sm:min-w-[192px]'} justify-between`}
                            title="Quick start checklist"
                            style={{ touchAction: 'manipulation' }}
                        >
                            <span className="inline-flex items-center gap-2">
                                <i className="fa-solid fa-list-check"></i>
                                Quick Start
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]">
                                    {stageQuickStartCompletedCount}/{quickStartTotalCount}
                                </span>
                                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${showQuickStartMenu ? 'rotate-180' : ''}`}></i>
                            </span>
                        </button>
                        {showQuickStartMenu && (
                            <div className={`${quickMenuPanelClass} left-0 w-[min(430px,94vw)] p-3.5`}>
                                <div className={`${quickMenuSectionTitleClass} flex items-center justify-between gap-3`}>
                                    <span>Quick Start Checklist</span>
                                    <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-200">
                                        {quickStartPendingCount === 0 ? 'Ready' : `${quickStartPendingCount} left`}
                                    </span>
                                </div>
                                <div className={quickMenuSectionHintClass}>
                                    {stageQuickStartSummary || 'Complete the key room-launch steps from here.'}
                                </div>
                                <div className={`${quickMenuCardClass} mt-2 space-y-2`}>
                                    {(stageQuickStartItems || []).length > 0 ? (
                                        (stageQuickStartItems || []).map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => {
                                                    closeAllTopMenus();
                                                    item.onClick?.();
                                                }}
                                                disabled={!!item.disabled}
                                                className={`${styles.btnStd} ${
                                                    item.completed
                                                        ? styles.btnSuccess
                                                        : item.ready
                                                            ? styles.btnInfo
                                                            : styles.btnNeutral
                                                } w-full justify-between px-3 py-2 text-sm normal-case tracking-[0.03em] ${item.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <i className={`fa-solid ${item.completed ? 'fa-circle-check' : item.ready ? 'fa-arrow-right' : 'fa-clock'}`}></i>
                                                    {item.label}
                                                </span>
                                                <span className="text-[10px] uppercase tracking-[0.16em] text-white/75">
                                                    {item.completed ? 'Done' : item.ready ? 'Open' : 'Pending'}
                                                </span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-zinc-300">
                                            Quick start steps will appear here when the room needs setup guidance.
                                        </div>
                                    )}
                                </div>
                                {showStageQuickStart && typeof onDismissStageQuickStart === 'function' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeAllTopMenus();
                                            onDismissStageQuickStart();
                                        }}
                                        className={`${styles.btnStd} ${styles.btnNeutral} mt-2 w-full px-3 py-2 text-sm normal-case tracking-[0.03em]`}
                                    >
                                        Hide Quick Start
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
                <div className={quickStripItemClass} ref={automationMenuRef}>
                    <button
                        data-feature-id="deck-automation-menu-toggle"
                        onClick={() => {
                            const next = !showAutomationMenu;
                            closeAllTopMenus();
                            setShowAutomationMenu(next);
                        }}
                        className={`${quickMenuToggleClass} ${compactTopQuickStrip ? '' : 'min-w-[176px] sm:min-w-[220px]'} justify-between`}
                        title="Automation controls"
                        style={{ touchAction: 'manipulation' }}
                    >
                        <span className="inline-flex items-center gap-2">
                            <i className="fa-solid fa-wand-magic-sparkles"></i>
                            Auto
                        </span>
                        <span className="inline-flex items-center gap-2">
                            <span className="rounded-full border border-cyan-300/35 bg-cyan-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
                                {activeAutomationCount} on
                            </span>
                            <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${showAutomationMenu ? 'rotate-180' : ''}`}></i>
                        </span>
                    </button>
                    {showAutomationMenu && (
                        <div className={`${quickMenuPanelClass} left-0 w-[min(430px,94vw)] p-3.5`}>
                            <div className={quickMenuSectionTitleClass}>Automation</div>
                            <div className={quickMenuSectionHintClass}>
                                Queue handoff, media continuity, and room guardrails.
                            </div>
                            <div className="mt-2.5 grid grid-cols-1 gap-2.5">
                                <button
                                    onClick={toggleAutoPlay}
                                    className={`${styles.btnStd} ${autoPlayMedia ? styles.btnHighlight : styles.btnNeutral} mt-0 w-full min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <i className="fa-solid fa-forward-step"></i>
                                        Auto-Play Media
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{autoPlayMedia ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={toggleAutoBg}
                                    data-feature-id="deck-auto-bg-music-toggle"
                                    className={`${styles.btnStd} ${autoBgMusic ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <i className="fa-solid fa-compact-disc"></i>
                                        Auto BG Music
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{autoBgMusic ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={toggleAutoDjMode}
                                    data-feature-id="deck-auto-dj-queue-toggle"
                                    className={`${styles.btnStd} ${autoDj ? styles.btnHighlight : styles.btnNeutral} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                    title="Automatically starts the next queued singer after each performance."
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <i className="fa-solid fa-forward-fast"></i>
                                        Auto DJ Queue
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{autoDj ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={toggleAutoEnd}
                                    data-feature-id="deck-auto-end-toggle"
                                    className={`${styles.btnStd} ${autoEndOnTrackFinish ? styles.btnHighlight : styles.btnNeutral} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                    title="Automatically close out a finished performance and advance the room flow."
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <i className="fa-solid fa-stopwatch"></i>
                                        Auto End on Finish
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{autoEndOnTrackFinish ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={toggleAutoBonus}
                                    data-feature-id="deck-auto-bonus-toggle"
                                    className={`${styles.btnStd} ${autoBonusEnabled ? styles.btnHighlight : styles.btnNeutral} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                    title="Automatically apply the default host bonus after a performance when no manual bonus was given."
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <i className="fa-solid fa-gift"></i>
                                        Auto Bonus
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{autoBonusEnabled ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={toggleAutoLyricsQueue}
                                    data-feature-id="deck-auto-lyrics-queue-toggle"
                                    className={`${styles.btnStd} ${autoLyricsOnQueue ? styles.btnHighlight : styles.btnNeutral} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                    title="Automatically try cached, Apple Music, and AI lyric fallback for queued tracks when lyrics are missing."
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <i className="fa-solid fa-file-lines"></i>
                                        Auto Lyrics
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">
                                        {autoLyricsOnQueue ? 'On' : 'Off'}
                                    </span>
                                </button>
                                <button
                                    onClick={toggleAutoParty}
                                    data-feature-id="deck-auto-party-toggle"
                                    className={`${styles.btnStd} ${autoPartyEnabled ? styles.btnHighlight : styles.btnNeutral} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                    title="Automatically drop short crowd moments like Ready Check or Volley between singers."
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <i className="fa-solid fa-users-rays"></i>
                                        Auto Party
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{autoPartyEnabled ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={async () => {
                                        await updateRoom({ bouncerMode: !room?.bouncerMode });
                                    }}
                                    className={`${styles.btnStd} ${room?.bouncerMode ? styles.btnHighlight : styles.btnNeutral} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <i className="fa-solid fa-lock"></i>
                                        Bouncer Mode
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{room?.bouncerMode ? 'On' : 'Off'}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
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
                            {showInlineAudioQuickControls ? (
                            <div className={quickAudioControlClass}>
                                <button
                                    type="button"
                                    onClick={toggleSongMute}
                                    className={`${styles.btnStd} ${stageVolumeDraft === 0 ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}
                                    title="Mute stage audio"
                                >
                                    <i className={`fa-solid ${stageVolumeDraft === 0 ? 'fa-volume-xmark' : 'fa-volume-high'} w-4 text-center`}></i>
                                </button>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">Stage</div>
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
                                        className="mt-1 h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 stage-volume-slider"
                                        style={{ background: `linear-gradient(90deg, #00C4D9 ${stageVolumeDraft}%, #27272a ${stageVolumeDraft}%)` }}
                                    />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{stageVolumeDraft}%</span>
                            </div>
                            ) : null}
                            {showInlineAudioQuickControls ? (
                            <div className={quickAudioControlClass}>
                                <button
                                    type="button"
                                    onClick={toggleBgMute}
                                    className={`${styles.btnStd} ${bgVolume === 0 ? styles.btnHighlight : styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}
                                    title="Mute background music"
                                >
                                    <i className={`fa-solid ${bgVolume === 0 ? 'fa-volume-xmark' : 'fa-volume-high'} w-4 text-center`}></i>
                                </button>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                                        <span>BG</span>
                                        <span className="truncate text-zinc-500">{currentTrackName || 'Track'}</span>
                                    </div>
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
                                        className="mt-1 h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 bg-volume-slider"
                                        style={{ background: `linear-gradient(90deg, #EC4899 ${bgVolumeDraftPct}%, #27272a ${bgVolumeDraftPct}%)` }}
                                    />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300">{bgVolumeDraftPct}%</span>
                            </div>
                            ) : null}
                        </div>
                        {audioPanelOpen ? (
                            <div className={`${quickMenuPanelClass} left-0 w-[min(560px,96vw)] p-3.5`}>
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
                                            <button onClick={skipBg} className={`${styles.btnStd} ${styles.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`} title="Skip BG track">
                                                <i className="fa-solid fa-forward-step w-4 text-center"></i>
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const next = !autoBgMusic;
                                                    setAutoBgMusic(next);
                                                    await updateRoom({ autoBgMusic: next });
                                                    if (next && !playingBg) setBgMusicState(true);
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
                                        onClick={() => updateRoom({ showPerformanceRecap: room?.showPerformanceRecap === false })}
                                        className={`${styles.btnStd} ${room?.showPerformanceRecap === false ? styles.btnNeutral : styles.btnHighlight} min-h-[42px] justify-between py-2 text-sm normal-case tracking-[0.03em]`}
                                        title="Show or hide the post-performance recap sequence on Public TV"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <i className="fa-solid fa-trophy-star"></i>
                                            Post Recap
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest">{room?.showPerformanceRecap === false ? 'Off' : 'On'}</span>
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
                                        closeAllTopMenus();
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
                                            <span>Public TV Preview</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Host-side view of the live TV output</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{audiencePreviewVisible ? 'On' : 'Off'}</span>
                                </button>
                                <button
                                    onClick={() => setAudiencePreviewMode?.((prev) => prev === 'live_tv' ? 'thumbnail' : 'live_tv')}
                                    disabled={!audiencePreviewVisible || !showTimeClockEnabled}
                                    className={`${styles.btnStd} ${audiencePreviewMode === 'live_tv' ? styles.btnHighlight : styles.btnNeutral} w-full min-h-[52px] justify-between py-2 text-sm normal-case tracking-[0.03em] ${(!audiencePreviewVisible || !showTimeClockEnabled) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    title="Switch between the light thumbnail and a muted live TV viewport"
                                >
                                    <span className="inline-flex items-center gap-2 text-left">
                                        <i className="fa-solid fa-tv"></i>
                                        <span className="flex flex-col">
                                            <span>Viewport Mode</span>
                                            <span className="text-[10px] text-zinc-400 normal-case tracking-normal">Thumbnail stays light. Live TV mounts a muted TV client.</span>
                                        </span>
                                    </span>
                                    <span className="text-[11px] uppercase tracking-widest">{audiencePreviewMode === 'live_tv' ? 'Live TV' : 'Thumb'}</span>
                                </button>
                            </div>
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
            {missionControlEnabled && missionStatus === 'needs_attention' && (
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
                        <div className="mt-1 text-sm font-semibold text-white">{activeMomentFeedback.detail || 'Cue live'}</div>
                    </div>
                </div>
            ) : null}
        </div>
        {(runOfShowEnabled || hasRunOfShowPlan) && compactRunOfShowItems.length > 0 && !runOfShowFocusMode && (
            <div className="w-full">
                <div className={`rounded-2xl border border-cyan-300/18 bg-gradient-to-r from-cyan-500/[0.08] via-zinc-950 to-fuchsia-500/[0.08] ${compactRunOfShowDense ? 'px-3 py-2' : 'px-3 py-3'}`}>
                    <div className={`flex flex-wrap justify-between gap-2.5 ${compactRunOfShowDense ? 'items-center' : 'items-start'}`}>
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.26em] text-cyan-200/80">Run Of Show</div>
                            <div className={`flex flex-wrap items-center gap-2 ${compactRunOfShowDense ? 'mt-0.5' : 'mt-1'}`}>
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${runOfShowHudToneClass}`}>
                                    {runOfShowHudState.title}
                                </span>
                                {compactRunOfShowCurrentIndex >= 0 ? (
                                    <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200">
                                        {compactRunOfShowCurrentIndex + 1} of {compactRunOfShowItems.length}
                                    </span>
                                ) : null}
                            </div>
                            {!compactRunOfShowDense ? (
                                <>
                                    <div className="mt-2 text-[13px] text-zinc-300">
                                        {runOfShowHudState.detail}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                                        <span>Total show {formatRunOfShowTotalDuration(compactRunOfShowTotalDurationSec)}</span>
                                        <span>{compactRunOfShowItems.length} sequence{compactRunOfShowItems.length === 1 ? '' : 's'}</span>
                                        {runOfShowEnabled ? <span>Live mode</span> : <span>Not live yet</span>}
                                    </div>
                                </>
                            ) : (
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                                    <span>{formatRunOfShowTotalDuration(compactRunOfShowTotalDurationSec)}</span>
                                    <span>{compactRunOfShowItems.length} slots</span>
                                    {runOfShowEnabled ? <span>Live</span> : <span>Draft</span>}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {runOfShowPrimaryAction?.label ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCompactRunOfShowToolsOpen(false);
                                        runOfShowPrimaryAction.onClick();
                                    }}
                                    disabled={runOfShowPrimaryAction.disabled}
                                    className={`${styles.btnStd} ${runOfShowPrimaryAction.className} shrink-0 ${compactRunOfShowDense ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'} normal-case tracking-[0.04em] disabled:opacity-40`}
                                >
                                    {runOfShowPrimaryAction.label}
                                </button>
                            ) : null}
                            {typeof onOpenShowWorkspace === 'function' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCompactRunOfShowToolsOpen(false);
                                        onOpenShowWorkspace();
                                    }}
                                    className={`${styles.btnStd} ${styles.btnNeutral} shrink-0 ${compactRunOfShowDense ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'} normal-case tracking-[0.04em]`}
                                >
                                    {compactRunOfShowDense ? 'Open Show' : 'Show Workspace'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setCompactRunOfShowToolsOpen((prev) => !prev)}
                                className={`${styles.btnStd} ${styles.btnNeutral} shrink-0 ${compactRunOfShowDense ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'} normal-case tracking-[0.04em]`}
                            >
                                {compactRunOfShowToolsOpen ? (compactRunOfShowDense ? 'Hide' : 'Less') : 'More'}
                            </button>
                        </div>
                    </div>
                    {compactRunOfShowToolsOpen ? (
                        <div className={`mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/10 ${compactRunOfShowDense ? 'pt-1.5' : 'pt-2'}`}>
                            <button
                                type="button"
                                onClick={() => setCompactRunOfShowCollapsed((prev) => !prev)}
                                className={`${styles.btnStd} ${styles.btnNeutral} shrink-0 ${compactRunOfShowDense ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'} normal-case tracking-[0.04em]`}
                            >
                                {compactRunOfShowCollapsed
                                    ? (compactRunOfShowDense ? 'Expand Bar' : 'Expand Timeline')
                                    : (compactRunOfShowDense ? 'Collapse Bar' : 'Collapse Timeline')}
                            </button>
                            {runOfShowEnabled && typeof onRewindRunOfShow === 'function' ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCompactRunOfShowToolsOpen(false);
                                        onRewindRunOfShow();
                                    }}
                                    disabled={compactRunOfShowItems.length < 2}
                                    className={`${styles.btnStd} ${styles.btnNeutral} shrink-0 ${compactRunOfShowDense ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'} normal-case tracking-[0.04em]`}
                                >
                                    Previous
                                </button>
                            ) : null}
                            {runOfShowEnabled && typeof onStopRunOfShow === 'function' ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCompactRunOfShowToolsOpen(false);
                                        onStopRunOfShow();
                                    }}
                                    className={`${styles.btnStd} ${styles.btnNeutral} shrink-0 ${compactRunOfShowDense ? 'px-2.5 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]'} normal-case tracking-[0.04em] disabled:opacity-40`}
                                >
                                    Stop Show
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    {!compactRunOfShowCollapsed && compactRunOfShowDense ? (
                        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
                            {compactRunOfShowItems.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        if (typeof onTriggerRunOfShowItem === 'function') {
                                            onTriggerRunOfShowItem(item.id);
                                            return;
                                        }
                                        if (typeof onFocusRunOfShowItem === 'function') {
                                            onFocusRunOfShowItem(item.id);
                                            return;
                                        }
                                        onOpenShowWorkspace?.();
                                    }}
                                    className={`min-w-[138px] max-w-[170px] shrink-0 rounded-xl border px-2.5 py-2 text-left transition hover:border-cyan-300/35 ${item.cardToneClass} ${item.isLive ? 'shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_20px_rgba(16,185,129,0.14)]' : item.isStaged ? 'shadow-[0_0_0_1px_rgba(56,189,248,0.3),0_0_16px_rgba(14,165,233,0.1)]' : item.isNext ? 'shadow-[0_0_0_1px_rgba(251,191,36,0.24)]' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        {item.artworkUrl ? (
                                            <div className={`h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/35 ${item.isComplete ? 'grayscale' : ''}`}>
                                                <img src={item.artworkUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                                            </div>
                                        ) : (
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 ${item.isComplete ? 'text-zinc-500' : 'text-zinc-200'}`}>
                                                <i className={`fa-solid ${item.iconClass} text-xs`}></i>
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-1.5">
                                                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] ${item.statusToneClass}`}>
                                                    {item.badgeLabel}
                                                </span>
                                                <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-300">{item.durationLabel}</span>
                                            </div>
                                            <div className={`mt-1 truncate text-[12px] font-black leading-tight ${item.isComplete ? 'text-zinc-400' : 'text-white'}`}>{item.title}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : !compactRunOfShowCollapsed ? (
                        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1.5 custom-scrollbar">
                            {compactRunOfShowItems.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        if (typeof onTriggerRunOfShowItem === 'function') {
                                            onTriggerRunOfShowItem(item.id);
                                            return;
                                        }
                                        if (typeof onFocusRunOfShowItem === 'function') {
                                            onFocusRunOfShowItem(item.id);
                                            return;
                                        }
                                        onOpenShowWorkspace?.();
                                    }}
                                    className={`min-w-[196px] max-w-[244px] shrink-0 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/35 ${item.cardToneClass} ${item.isLive ? 'shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_0_24px_rgba(16,185,129,0.16)]' : item.isStaged ? 'shadow-[0_0_0_1px_rgba(56,189,248,0.32),0_0_20px_rgba(14,165,233,0.12)]' : item.isNext ? 'shadow-[0_0_0_1px_rgba(251,191,36,0.28)]' : ''}`}
                                >
                                    <div className="flex items-start gap-2.5">
                                        {item.artworkUrl ? (
                                            <div className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/35 ${item.isComplete ? 'grayscale' : ''}`}>
                                                <img src={item.artworkUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                                            </div>
                                        ) : (
                                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 ${item.isComplete ? 'text-zinc-500' : 'text-zinc-200'}`}>
                                                <i className={`fa-solid ${item.iconClass}`}></i>
                                            </div>
    )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] ${item.statusToneClass}`}>
                                                    {item.badgeLabel}
                                                </span>
                                                <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-200">
                                                    {item.durationLabel}
                                                </span>
                                            </div>
                                            <div className={`mt-1.5 line-clamp-2 text-[13px] font-black leading-snug ${item.isComplete ? 'text-zinc-400' : 'text-white'}`}>{item.title}</div>
                                            {item.summary ? <div className={`mt-1 line-clamp-2 text-[12px] ${item.isComplete ? 'text-zinc-500' : 'text-zinc-300'}`}>{item.summary}</div> : null}
                                            <div className={`mt-1.5 text-[10px] uppercase tracking-[0.16em] ${item.isComplete ? 'text-zinc-600' : 'text-zinc-400'}`}>{item.detail}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-cyan-300/22 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                                {compactRunOfShowItems.length} slots
                            </span>
                            <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200">
                                {formatRunOfShowTotalDuration(compactRunOfShowTotalDurationSec)}
                            </span>
                            <span className="text-xs text-zinc-400">
                                {runOfShowEnabled
                                    ? (compactRunOfShowItems[compactRunOfShowCurrentIndex]?.title
                                        ? `Focused on ${compactRunOfShowItems[compactRunOfShowCurrentIndex].title}`
                                        : 'Live show ready')
                                    : (compactRunOfShowItems[0]?.title ? `Starts with ${compactRunOfShowItems[0].title}` : 'Timeline ready')}
                            </span>
                            {runOfShowQaStatusDetail ? <span className="text-xs text-zinc-500">{runOfShowQaStatusDetail}</span> : null}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
    );
};

export default HostTopChrome;
