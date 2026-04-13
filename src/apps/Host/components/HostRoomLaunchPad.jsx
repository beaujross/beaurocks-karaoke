import React, { useState } from 'react';
import { ASSETS } from '../../../lib/assets';
import EventCreditsConfigPanel from './EventCreditsConfigPanel';
import HostRoomLaunchPadBrowser from './HostRoomLaunchPadBrowser';

const PRESET_UI_META = {
    casual: {
        eyebrow: 'Open karaoke',
        summary: 'Loose, friendly karaoke with light automation and low host friction.',
        chips: ['Open queue', 'Easy crowd flow', 'Visualizer-first'],
        accentClass: 'border-cyan-300/22 bg-cyan-500/8'
    },
    competition: {
        eyebrow: 'Hosted showcase',
        summary: 'More structure, scoring, and tighter approvals for featured singers.',
        chips: ['Scoring on', 'Host approval', 'Lyrics-forward'],
        accentClass: 'border-amber-300/22 bg-amber-500/8'
    },
    bingo: {
        eyebrow: 'Crowd play',
        summary: 'Karaoke plus room-wide bingo energy running alongside the queue.',
        chips: ['Bingo layer', 'Audience TV', 'Crowd prompts'],
        accentClass: 'border-emerald-300/22 bg-emerald-500/8'
    },
    trivia: {
        eyebrow: 'Trivia-led',
        summary: 'Question-driven pacing with more host-led reveal and tighter turns.',
        chips: ['Trivia rounds', 'Short turns', 'Structured pacing'],
        accentClass: 'border-fuchsia-300/22 bg-fuchsia-500/8'
    }
};

const LAUNCH_TARGET_META = Object.freeze([
    {
        id: 'stage',
        eyebrow: 'Go live',
        title: 'Open the host panel',
        copy: 'Create the room and jump straight into the live host board.',
        chip: 'Fastest path',
        accentClass: 'border-cyan-300/28 bg-[linear-gradient(135deg,rgba(0,196,217,0.16),rgba(236,72,153,0.1))]'
    },
    {
        id: 'show',
        eyebrow: 'Plan first',
        title: 'Open the show plan',
        copy: 'Create the room and land in the show workspace before guests arrive.',
        chip: 'Best before doors',
        accentClass: 'border-fuchsia-300/24 bg-fuchsia-500/8'
    },
    {
        id: 'settings',
        eyebrow: 'Set details',
        title: 'Open room settings',
        copy: 'Create the room and go straight to setup, policies, and room details.',
        chip: 'Best for admin work',
        accentClass: 'border-white/12 bg-white/5'
    }
]);

const normalizeLaunchSearchToken = (value = '') =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const formatRecentRoomTime = (value) => {
    const ms = Number(value || 0);
    if (!Number.isFinite(ms) || ms <= 0) return '';
    try {
        return new Date(ms).toLocaleString();
    } catch {
        return '';
    }
};

const formatDateTimeLocalInput = (value) => {
    const ms = Number(value || 0);
    if (!Number.isFinite(ms) || ms <= 0) return '';
    try {
        const date = new Date(ms);
        const offset = date.getTimezoneOffset();
        const local = new Date(date.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
    } catch {
        return '';
    }
};

const formatLaunchStartDraft = (value = '') => {
    const safeValue = String(value || '').trim();
    if (!safeValue) return 'No start time set';
    try {
        const date = new Date(safeValue);
        if (Number.isNaN(date.getTime())) return safeValue;
        return date.toLocaleString();
    } catch {
        return safeValue;
    }
};

const isAahfRoom = (roomItem = {}) => {
    const haystack = [
        roomItem?.code,
        roomItem?.roomName,
        roomItem?.discoverTitle,
        roomItem?.orgName
    ].map(normalizeLaunchSearchToken).join(' ');
    return haystack.includes('aahf') || haystack.includes('asian arts heritage festival');
};

const getRoomLifecycle = (roomItem = {}) => {
    if (roomItem.archived) {
        return {
            label: 'Archived',
            detail: 'Stored for later reuse',
            chipClass: 'border-amber-300/30 bg-amber-500/10 text-amber-100',
            accentClass: 'border-amber-300/20'
        };
    }
    if (Number(roomItem.closedAtMs || 0) > 0 && roomItem.hasRecap) {
        return {
            label: 'Recap Ready',
            detail: 'Closed room with a recap ready to share',
            chipClass: 'border-fuchsia-300/30 bg-fuchsia-500/10 text-fuchsia-100',
            accentClass: 'border-fuchsia-300/20'
        };
    }
    if (Number(roomItem.closedAtMs || 0) > 0) {
        return {
            label: 'Needs Cleanup',
            detail: 'Closed room that still needs post-show cleanup',
            chipClass: 'border-rose-300/30 bg-rose-500/10 text-rose-100',
            accentClass: 'border-rose-300/20'
        };
    }
    return {
        label: 'Ready',
        detail: 'Open the room and host from the live panel',
        chipClass: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
        accentClass: 'border-cyan-300/20'
    };
};

const getRoomVisibilityMeta = (roomItem = {}) => (
    roomItem.publicRoom
        ? {
            label: 'Discover',
            detail: 'Guests can find this room in Discover',
            chipClass: 'border-cyan-300/28 bg-cyan-500/12 text-cyan-100'
        }
        : {
            label: 'Private',
            detail: 'Only direct room joins can find this room',
            chipClass: 'border-white/10 bg-white/5 text-zinc-100'
        }
);

const formatRoomSchedule = (roomItem = {}) => {
    const roomStartsAtMs = Number(roomItem?.roomStartsAtMs || 0);
    const discoverStartsAtMs = Number(roomItem?.discoverStartsAtMs || 0);
    const scheduledMs = roomStartsAtMs > 0 ? roomStartsAtMs : discoverStartsAtMs;
    if (!Number.isFinite(scheduledMs) || scheduledMs <= 0) return '';
    return formatRecentRoomTime(scheduledMs);
};

const getCleanupMeta = (roomItem = {}) => {
    if (roomItem.hasRecap) {
        return {
            label: 'Recap ready to review or share',
            toneClass: 'border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100'
        };
    }
    if (Number(roomItem.closedAtMs || 0) > 0) {
        return {
            label: 'Room ended but recap is still pending',
            toneClass: 'border-rose-300/25 bg-rose-500/10 text-rose-100'
        };
    }
    return null;
};

const getRecommendedRoomAction = (roomItem = {}) => {
    const scheduledMs = Number(roomItem?.roomStartsAtMs || roomItem?.discoverStartsAtMs || 0);
    const isUpcoming = Number.isFinite(scheduledMs) && scheduledMs > Date.now() + (90 * 60 * 1000);
    const roomIsAahf = isAahfRoom(roomItem);
    if (roomItem.archived) {
        return {
            label: 'Restore Room',
            detail: 'Bring this room back into rotation before making edits.',
            action: 'restore'
        };
    }
    if (Number(roomItem.closedAtMs || 0) > 0 && roomItem.hasRecap) {
        return {
            label: 'View Recap',
            detail: 'The room is closed and the recap is ready to review or share.',
            action: 'recap'
        };
    }
    if (Number(roomItem.closedAtMs || 0) > 0) {
        return {
            label: 'Reset Room',
            detail: 'Clear the closed room and prep it for the next event.',
            action: 'cleanup'
        };
    }
    if (isUpcoming || roomIsAahf) {
        return {
            label: 'Review Show Plan',
            detail: roomIsAahf
                ? 'AAHF should stay focused on the May 1 flow, takeover moments, and room timing.'
                : 'Tighten the show flow before guests arrive.',
            action: 'show'
        };
    }
    return {
        label: 'Open Host Panel',
        detail: 'The room looks ready to run from the live host panel.',
        action: 'live'
    };
};

const SectionShell = ({ eyebrow, title, detail, children }) => (
    <section className="rounded-[1.55rem] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(8,17,30,0.92),rgba(20,11,30,0.84))] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
        <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/68">{eyebrow}</div>
            <div className="mt-1 text-2xl font-black text-white">{title}</div>
            {detail ? (
                <div className="mt-2 text-sm text-cyan-100/74">{detail}</div>
            ) : null}
        </div>
        {children}
    </section>
);

const RoomActionButton = ({ className = '', disabled = false, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] transition ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`}
    >
        {children}
    </button>
);

const RoomBrowserCard = ({
    roomItem = {},
    STYLES,
    joiningRoom = false,
    roomManagerBusyCode = '',
    roomManagerBusyAction = '',
    openExistingRoomWorkspace,
    runLandingRoomCleanup,
    setRoomPlannedStart,
    setRoomDiscoverability,
    setRoomArchivedState,
    resetRoomToCurrentTemplate,
    seedAahfKickoffRoom,
    runLandingRoomPermanentDelete,
    canPermanentlyDeleteRooms = false,
    audienceBase = '',
}) => {
    const lifecycle = getRoomLifecycle(roomItem);
    const visibility = getRoomVisibilityMeta(roomItem);
    const cleanupMeta = getCleanupMeta(roomItem);
    const recommendedAction = getRecommendedRoomAction(roomItem);
    const scheduleLabel = formatRoomSchedule(roomItem);
    const roomBusy = roomManagerBusyCode === roomItem.code;
    const canManage = !joiningRoom && !roomBusy;
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [plannedStartDraft, setPlannedStartDraft] = useState(() => roomItem?.roomStartsAtLocal || formatDateTimeLocalInput(roomItem?.roomStartsAtMs));
    const recapUrl = audienceBase ? `${audienceBase}?room=${encodeURIComponent(roomItem.code)}&mode=recap` : '';

    React.useEffect(() => {
        setPlannedStartDraft(roomItem?.roomStartsAtLocal || formatDateTimeLocalInput(roomItem?.roomStartsAtMs));
    }, [roomItem?.roomStartsAtLocal, roomItem?.roomStartsAtMs, roomItem?.code]);

    const openRecap = () => {
        if (!recapUrl || typeof window === 'undefined') return;
        window.open(recapUrl, '_blank', 'noopener,noreferrer');
    };

    const runRecommendedAction = () => {
        switch (recommendedAction.action) {
        case 'restore':
            setRoomArchivedState?.(roomItem.code, false);
            break;
        case 'recap':
            openRecap();
            break;
        case 'cleanup':
            runLandingRoomCleanup?.(roomItem.code);
            break;
        case 'show':
            openExistingRoomWorkspace(roomItem.code, 'show.timeline');
            break;
        case 'live':
        default:
            openExistingRoomWorkspace(roomItem.code, 'queue.live_run');
            break;
        }
    };

    const recommendedBusy = (
        (recommendedAction.action === 'restore' && roomManagerBusyAction === 'restore')
        || (recommendedAction.action === 'cleanup' && roomManagerBusyAction === 'cleanup')
    );

    return (
        <article className={`rounded-[1.25rem] border ${lifecycle.accentClass} bg-black/18 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-lg font-black text-white">
                            {roomItem.roomName || roomItem.code}
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${lifecycle.chipClass}`}>
                            {lifecycle.label}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${visibility.chipClass}`}>
                            {visibility.label}
                        </span>
                    </div>
                    <div className="mt-1 text-xs text-cyan-100/64">
                        {roomItem.code}
                        {roomItem.activeMode ? ` | ${roomItem.activeMode}` : ''}
                        {formatRecentRoomTime(roomItem.updatedAtMs || roomItem.createdAtMs) ? ` | ${formatRecentRoomTime(roomItem.updatedAtMs || roomItem.createdAtMs)}` : ''}
                    </div>
                    {scheduleLabel ? (
                        <div className="mt-1 text-xs text-cyan-100/54">Scheduled: {scheduleLabel}</div>
                    ) : null}
                    <div className="mt-2 text-sm text-cyan-100/76">{lifecycle.detail}</div>
                    <div className="mt-1 text-xs text-cyan-100/54">{visibility.detail}</div>
                    {cleanupMeta ? (
                        <div className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${cleanupMeta.toneClass}`}>
                            {cleanupMeta.label}
                        </div>
                    ) : null}
                    <div className="mt-3 rounded-full border border-cyan-300/20 bg-cyan-500/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-cyan-100/82">
                        Recommended next: {recommendedAction.label}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={runRecommendedAction}
                        disabled={!canManage && recommendedAction.action !== 'recap' || (recommendedAction.action === 'recap' && !recapUrl)}
                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${((!canManage && recommendedAction.action !== 'recap') || (recommendedAction.action === 'recap' && !recapUrl)) ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {recommendedBusy ? `${recommendedAction.label}...` : recommendedAction.label}
                    </button>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <RoomActionButton
                    className="border-white/10 bg-white/5 text-cyan-100/78 hover:border-cyan-300/35 hover:bg-cyan-500/8"
                    onClick={() => setDetailsOpen((prev) => !prev)}
                >
                    {detailsOpen ? 'Hide Details' : 'Details'}
                </RoomActionButton>
                <RoomActionButton
                    className={roomItem.publicRoom
                        ? 'border-white/10 bg-white/5 text-zinc-100 hover:border-white/20 hover:bg-white/8'
                        : 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100 hover:border-cyan-300/40 hover:bg-cyan-500/18'}
                    disabled={!canManage}
                    onClick={() => setRoomDiscoverability?.(roomItem, !roomItem.publicRoom)}
                >
                    {roomBusy && (roomManagerBusyAction === 'discover' || roomManagerBusyAction === 'private')
                        ? (roomItem.publicRoom ? 'Updating' : 'Publishing')
                        : (roomItem.publicRoom ? 'Make Private' : 'Make Discoverable')}
                </RoomActionButton>
                <RoomActionButton
                    className="border-white/10 bg-white/5 text-cyan-100/78 hover:border-cyan-300/35 hover:bg-cyan-500/8"
                    disabled={!canManage}
                    onClick={() => openExistingRoomWorkspace(roomItem.code, 'show.timeline')}
                >
                    Show Plan
                </RoomActionButton>
                <RoomActionButton
                    className="border-white/10 bg-white/5 text-cyan-100/78 hover:border-cyan-300/35 hover:bg-cyan-500/8"
                    disabled={!canManage}
                    onClick={() => openExistingRoomWorkspace(roomItem.code, 'ops.room_setup')}
                >
                    Room Settings
                </RoomActionButton>
                {roomItem.hasRecap ? (
                    <RoomActionButton
                        className="border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100"
                        disabled={!recapUrl}
                        onClick={openRecap}
                    >
                        Recap
                    </RoomActionButton>
                ) : null}
                {!roomItem.archived ? (
                    <RoomActionButton
                        className="border-rose-300/25 bg-rose-500/10 text-rose-100"
                        disabled={!canManage}
                        onClick={() => runLandingRoomCleanup?.(roomItem.code)}
                    >
                        {roomBusy && roomManagerBusyAction === 'cleanup' ? 'Resetting' : 'Reset Room'}
                    </RoomActionButton>
                ) : null}
                <RoomActionButton
                    className="border-amber-300/25 bg-amber-500/10 text-amber-100"
                    disabled={!canManage}
                    onClick={() => setRoomArchivedState?.(roomItem.code, !roomItem.archived)}
                >
                    {roomBusy && (roomManagerBusyAction === 'archive' || roomManagerBusyAction === 'restore')
                        ? (roomItem.archived ? 'Restoring' : 'Archiving')
                        : (roomItem.archived ? 'Restore' : 'Archive')}
                </RoomActionButton>
                {canPermanentlyDeleteRooms ? (
                    <RoomActionButton
                        className="border-rose-300/25 bg-black/25 text-rose-100 hover:bg-rose-500/10"
                        disabled={!canManage}
                        onClick={() => runLandingRoomPermanentDelete?.(roomItem.code)}
                    >
                        {roomBusy && roomManagerBusyAction === 'delete' ? 'Deleting' : 'Delete'}
                    </RoomActionButton>
                ) : null}
            </div>
            {detailsOpen ? (
                <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 md:grid-cols-2">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Room Details</div>
                        <div className="mt-2 space-y-1.5 text-sm text-zinc-300">
                            <div><span className="text-zinc-500">Host:</span> {roomItem.hostName || 'Host'}</div>
                            {roomItem.orgName ? <div><span className="text-zinc-500">Workspace:</span> {roomItem.orgName}</div> : null}
                            <div><span className="text-zinc-500">Mode:</span> {roomItem.activeMode || 'karaoke'}</div>
                            {roomItem.discoverTitle ? <div><span className="text-zinc-500">Discover title:</span> {roomItem.discoverTitle}</div> : null}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Timing & Visibility</div>
                        <div className="mt-2 space-y-1.5 text-sm text-zinc-300">
                            {scheduleLabel ? <div><span className="text-zinc-500">Scheduled:</span> {scheduleLabel}</div> : null}
                            <div><span className="text-zinc-500">Updated:</span> {formatRecentRoomTime(roomItem.updatedAtMs || roomItem.createdAtMs) || 'Unknown'}</div>
                            {Number(roomItem.closedAtMs || 0) > 0 ? <div><span className="text-zinc-500">Closed:</span> {formatRecentRoomTime(roomItem.closedAtMs)}</div> : null}
                            <div><span className="text-zinc-500">Visibility:</span> {roomItem.publicRoom ? 'Discover' : 'Private'}</div>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Room Planning</div>
                        <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                            <div>
                                <div className="text-xs text-zinc-400">Planned room start</div>
                                <input
                                    type="datetime-local"
                                    value={plannedStartDraft}
                                    onChange={(e) => setPlannedStartDraft(e.target.value)}
                                    disabled={!canManage}
                                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/35 disabled:opacity-60"
                                />
                                <div className="mt-2 text-xs text-zinc-500">
                                    Future rooms land in Upcoming from this time even if Discover stays private.
                                </div>
                            </div>
                            <div className="flex flex-wrap content-start gap-2 lg:w-[240px]">
                                <RoomActionButton
                                    className="border-cyan-300/25 bg-cyan-500/10 text-cyan-100"
                                    disabled={!canManage}
                                    onClick={() => setRoomPlannedStart?.(roomItem.code, plannedStartDraft)}
                                >
                                    {roomBusy && roomManagerBusyAction === 'schedule' ? 'Saving' : 'Save Start'}
                                </RoomActionButton>
                                <RoomActionButton
                                    className="border-white/10 bg-white/5 text-cyan-100/78 hover:border-cyan-300/35 hover:bg-cyan-500/8"
                                    disabled={!canManage}
                                    onClick={() => {
                                        setPlannedStartDraft('');
                                        setRoomPlannedStart?.(roomItem.code, '');
                                    }}
                                >
                                    Move To Tonight
                                </RoomActionButton>
                                {roomItem.currentTemplateId ? (
                                    <RoomActionButton
                                        className="border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100"
                                        disabled={!canManage}
                                        onClick={() => resetRoomToCurrentTemplate?.(roomItem)}
                                    >
                                        {roomBusy && roomManagerBusyAction === 'template' ? 'Resetting' : 'Reset To Template'}
                                    </RoomActionButton>
                                ) : null}
                                {isAahfRoom(roomItem) ? (
                                    <RoomActionButton
                                        className="border-amber-300/25 bg-amber-500/10 text-amber-100"
                                        disabled={!canManage}
                                        onClick={() => seedAahfKickoffRoom?.(roomItem)}
                                    >
                                        {roomBusy && roomManagerBusyAction === 'seed_aahf' ? 'Applying' : 'Apply AAHF Kick-Off'}
                                    </RoomActionButton>
                                ) : null}
                            </div>
                        </div>
                        {roomItem.currentTemplateName ? (
                            <div className="mt-2 text-xs text-zinc-400">
                                Current template: <span className="text-white">{roomItem.currentTemplateName}</span>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </article>
    );
};

const HostRoomLaunchPad = ({
    STYLES,
    launchState,
    launchStateTone,
    launchAccessPending,
    shouldShowSetupCard,
    canUseWorkspaceOnboarding,
    openOnboardingWizard,
    launchRoomName,
    setLaunchRoomName,
    presets,
    resolvedLaunchPresetId,
    setHostNightPreset,
    discoveryListingEnabled,
    setDiscoveryListingMode,
    quickLaunchDiscovery,
    setQuickLaunchDiscovery,
    eventCreditsConfig,
    setEventCreditsConfig,
    handleStartLauncherRoom,
    canStartLauncherRoom,
    creatingRoom,
    selectedLaunchPreset,
    entryError,
    retryLastHostAction,
    hostUpdateDeploymentBanner,
    recentHostRoomsLoading,
    recentHostRooms = [],
    roomManagerBusyCode = '',
    roomManagerBusyAction = '',
    joiningRoom,
    openExistingRoomWorkspace,
    roomCodeInput,
    setRoomCodeInput,
    launchRoomCodeCandidate,
    hasLaunchRoomCode,
    runLandingRoomCleanup,
    setRoomDiscoverability,
    setRoomArchivedState,
    resetRoomToCurrentTemplate,
    seedAahfKickoffRoom,
    runLandingRoomPermanentDelete,
    audienceBase = '',
    canPermanentlyDeleteRooms = false,
}) => {
    const [browserNowMs] = useState(() => Date.now());
    const [roomBrowserFilter, setRoomBrowserFilter] = useState('ready');
    const [roomBrowserSearch, setRoomBrowserSearch] = useState('');
    const [selectedRoomCode, setSelectedRoomCode] = useState('');
    const activeRooms = recentHostRooms.filter((roomItem) => !roomItem.archived && Number(roomItem.closedAtMs || 0) <= 0);
    const cleanupRooms = recentHostRooms.filter((roomItem) => !roomItem.archived && Number(roomItem.closedAtMs || 0) > 0);
    const archivedRooms = recentHostRooms.filter((roomItem) => roomItem.archived);
    const upcomingRooms = activeRooms.filter((roomItem) => Number(roomItem.roomStartsAtMs || roomItem.discoverStartsAtMs || 0) > browserNowMs + (90 * 60 * 1000));
    const tonightRooms = activeRooms.filter((roomItem) => !upcomingRooms.some((entry) => entry.code === roomItem.code));
    const featuredRoom = [...tonightRooms, ...upcomingRooms, ...cleanupRooms, ...archivedRooms].find(isAahfRoom)
        || tonightRooms[0]
        || upcomingRooms[0]
        || cleanupRooms[0]
        || archivedRooms[0]
        || null;
    const launchDisabled = creatingRoom || !canStartLauncherRoom;
    const featuredRecommendedAction = featuredRoom ? getRecommendedRoomAction(featuredRoom) : null;
    const selectedPresetMeta = PRESET_UI_META[resolvedLaunchPresetId] || PRESET_UI_META.casual;
    const launchStartSummary = formatLaunchStartDraft(String(quickLaunchDiscovery?.roomStartsAtLocal || ''));
    const launchOverviewStats = [
        { label: 'Tonight', value: tonightRooms.length },
        { label: 'Upcoming', value: upcomingRooms.length },
        { label: 'Cleanup', value: cleanupRooms.length },
        { label: 'Archive', value: archivedRooms.length }
    ];
    const roomBrowserBuckets = [
        { id: 'ready', label: 'Ready', detail: 'Rooms you can run now', rooms: tonightRooms },
        { id: 'upcoming', label: 'Upcoming', detail: 'Scheduled ahead of time', rooms: upcomingRooms },
        { id: 'cleanup', label: 'Cleanup', detail: 'Closed rooms to reset', rooms: cleanupRooms },
        { id: 'archived', label: 'Archive', detail: 'Stored rooms', rooms: archivedRooms },
        { id: 'all', label: 'All rooms', detail: 'Everything in your workspace', rooms: recentHostRooms }
    ];
    const activeRoomBucket = roomBrowserBuckets.find((bucket) => bucket.id === roomBrowserFilter) || roomBrowserBuckets[0];
    const normalizedRoomBrowserSearch = normalizeLaunchSearchToken(roomBrowserSearch);
    const roomBrowserResults = [...(activeRoomBucket?.rooms || [])]
        .sort((left, right) => {
            if (activeRoomBucket?.id === 'upcoming') {
                const leftScheduled = Number(left.roomStartsAtMs || left.discoverStartsAtMs || Number.MAX_SAFE_INTEGER);
                const rightScheduled = Number(right.roomStartsAtMs || right.discoverStartsAtMs || Number.MAX_SAFE_INTEGER);
                return leftScheduled - rightScheduled;
            }
            const getRank = (roomItem) => {
                if (roomItem.archived) return 3;
                if (Number(roomItem.closedAtMs || 0) > 0) return 2;
                if (Number(roomItem.roomStartsAtMs || roomItem.discoverStartsAtMs || 0) > browserNowMs + (90 * 60 * 1000)) return 1;
                return 0;
            };
            const rankDelta = getRank(left) - getRank(right);
            if (rankDelta !== 0) return rankDelta;
            const leftRecent = Number(left.updatedAtMs || left.createdAtMs || left.roomStartsAtMs || left.discoverStartsAtMs || 0);
            const rightRecent = Number(right.updatedAtMs || right.createdAtMs || right.roomStartsAtMs || right.discoverStartsAtMs || 0);
            return rightRecent - leftRecent;
        })
        .filter((roomItem) => {
            if (!normalizedRoomBrowserSearch) return true;
            const haystack = normalizeLaunchSearchToken([
                roomItem.code,
                roomItem.roomName,
                roomItem.discoverTitle,
                roomItem.orgName,
                roomItem.currentTemplateName,
                roomItem.publicRoom ? 'discover' : 'private',
                getRoomLifecycle(roomItem).label
            ].filter(Boolean).join(' '));
            return haystack.includes(normalizedRoomBrowserSearch);
        });
    const selectedRoom = roomBrowserResults.find((roomItem) => roomItem.code === selectedRoomCode)
        || (featuredRoom ? roomBrowserResults.find((roomItem) => roomItem.code === featuredRoom.code) : null)
        || roomBrowserResults[0]
        || null;
    const selectedRoomLifecycle = selectedRoom ? getRoomLifecycle(selectedRoom) : null;
    const selectedRoomVisibility = selectedRoom ? getRoomVisibilityMeta(selectedRoom) : null;
    const selectedRoomAction = selectedRoom ? getRecommendedRoomAction(selectedRoom) : null;
    const selectedRoomCleanupMeta = selectedRoom ? getCleanupMeta(selectedRoom) : null;

    const runFeaturedAction = (actionKey, roomItem) => {
        if (!roomItem) return;
        if (actionKey === 'restore') {
            setRoomArchivedState?.(roomItem.code, false);
            return;
        }
        if (actionKey === 'recap') {
            if (!audienceBase || typeof window === 'undefined') return;
            window.open(`${audienceBase}?room=${encodeURIComponent(roomItem.code)}&mode=recap`, '_blank', 'noopener,noreferrer');
            return;
        }
        if (actionKey === 'cleanup') {
            runLandingRoomCleanup?.(roomItem.code);
            return;
        }
        if (actionKey === 'settings') {
            openExistingRoomWorkspace(roomItem.code, 'ops.room_setup');
            return;
        }
        if (actionKey === 'show') {
            openExistingRoomWorkspace(roomItem.code, 'show.timeline');
            return;
        }
        openExistingRoomWorkspace(roomItem.code, 'queue.live_run');
    };

    return (
        <HostRoomLaunchPadBrowser
            STYLES={STYLES}
            launchState={launchState}
            launchStateTone={launchStateTone}
            launchAccessPending={launchAccessPending}
            launchOverviewStats={launchOverviewStats}
            roomCodeInput={roomCodeInput}
            setRoomCodeInput={setRoomCodeInput}
            hasLaunchRoomCode={hasLaunchRoomCode}
            launchRoomCodeCandidate={launchRoomCodeCandidate}
            openExistingRoomWorkspace={openExistingRoomWorkspace}
            joiningRoom={joiningRoom}
            activeRoomBucket={activeRoomBucket}
            roomBrowserBuckets={roomBrowserBuckets}
            setRoomBrowserFilter={setRoomBrowserFilter}
            featuredRoom={featuredRoom}
            featuredRecommendedAction={featuredRecommendedAction}
            setSelectedRoomCode={setSelectedRoomCode}
            roomBrowserSearch={roomBrowserSearch}
            setRoomBrowserSearch={setRoomBrowserSearch}
            roomBrowserResults={roomBrowserResults}
            recentHostRoomsLoading={recentHostRoomsLoading}
            getRoomLifecycle={getRoomLifecycle}
            getRoomVisibilityMeta={getRoomVisibilityMeta}
            formatRoomSchedule={formatRoomSchedule}
            formatRecentRoomTime={formatRecentRoomTime}
            isAahfRoom={isAahfRoom}
            selectedRoom={selectedRoom}
            selectedRoomLifecycle={selectedRoomLifecycle}
            selectedRoomVisibility={selectedRoomVisibility}
            selectedRoomAction={selectedRoomAction}
            selectedRoomCleanupMeta={selectedRoomCleanupMeta}
            runFeaturedAction={runFeaturedAction}
            roomManagerBusyCode={roomManagerBusyCode}
            roomManagerBusyAction={roomManagerBusyAction}
            setRoomArchivedState={setRoomArchivedState}
            setRoomDiscoverability={setRoomDiscoverability}
            runLandingRoomCleanup={runLandingRoomCleanup}
            resetRoomToCurrentTemplate={resetRoomToCurrentTemplate}
            seedAahfKickoffRoom={seedAahfKickoffRoom}
            runLandingRoomPermanentDelete={runLandingRoomPermanentDelete}
            canPermanentlyDeleteRooms={canPermanentlyDeleteRooms}
            audienceBase={audienceBase}
            shouldShowSetupCard={shouldShowSetupCard}
            openOnboardingWizard={openOnboardingWizard}
            canUseWorkspaceOnboarding={canUseWorkspaceOnboarding}
            launchDisabled={launchDisabled}
            launchRoomName={launchRoomName}
            setLaunchRoomName={setLaunchRoomName}
            quickLaunchDiscovery={quickLaunchDiscovery}
            setQuickLaunchDiscovery={setQuickLaunchDiscovery}
            setDiscoveryListingMode={setDiscoveryListingMode}
            discoveryListingEnabled={discoveryListingEnabled}
            presets={presets}
            resolvedLaunchPresetId={resolvedLaunchPresetId}
            setHostNightPreset={setHostNightPreset}
            selectedLaunchPreset={selectedLaunchPreset}
            selectedPresetMeta={selectedPresetMeta}
            launchStartSummary={launchStartSummary}
            eventCreditsConfig={eventCreditsConfig}
            setEventCreditsConfig={setEventCreditsConfig}
            handleStartLauncherRoom={handleStartLauncherRoom}
            LAUNCH_TARGET_META={LAUNCH_TARGET_META}
            PRESET_UI_META={PRESET_UI_META}
            creatingRoom={creatingRoom}
            entryError={entryError}
            retryLastHostAction={retryLastHostAction}
            hostUpdateDeploymentBanner={hostUpdateDeploymentBanner}
        />
    );

};

export default HostRoomLaunchPad;
