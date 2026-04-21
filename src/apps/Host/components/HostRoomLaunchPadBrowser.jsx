import React, { useState } from 'react';
import { ASSETS } from '../../../lib/assets';
import { REQUEST_MODES } from '../../../lib/requestModes';
import { AUDIENCE_FEATURE_ACCESS_LEVELS } from '../../../lib/audienceFeatureAccess.js';
import {
    createHostNightPresetDraft,
    normalizeHostNightPresetRecord,
} from '../hostNightPresets';
import EventCreditsConfigPanel from './EventCreditsConfigPanel';

const inputClass = 'mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/45';
const REQUEST_POLICY_OPTIONS = [
    { id: REQUEST_MODES.canonicalOpen, label: 'Host Review First' },
    { id: REQUEST_MODES.guestBackingOptional, label: 'Guest Picks Backing' },
    { id: REQUEST_MODES.playableOnly, label: 'Playable Library Only' },
];
const QUEUE_LIMIT_OPTIONS = [
    { id: 'none', label: 'Open Queue' },
    { id: 'per_night', label: 'Per Night Cap' },
    { id: 'per_rotation', label: 'Per Rotation Cap' },
];
const QUEUE_ROTATION_OPTIONS = [
    { id: 'round_robin', label: 'Round Robin' },
    { id: 'fifo', label: 'First In / First Out' },
    { id: 'weighted_first_time', label: 'Weighted First-Time' },
];
const AUDIENCE_SHELL_OPTIONS = [
    { id: 'classic', label: 'Standard Audience App' },
    { id: 'streamlined', label: 'Streamlined Audience App' },
];

const HostRoomLaunchPadBrowser = ({
    STYLES,
    launchState,
    launchStateTone,
    launchAccessPending,
    launchOverviewStats,
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
    setRoomArchivedState,
    setRoomDiscoverability,
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
    saveCustomHostPreset,
    deleteCustomHostPreset,
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
    const [presetEditorOpen, setPresetEditorOpen] = useState(false);
    const [presetEditorMode, setPresetEditorMode] = useState('copy');
    const [presetDraft, setPresetDraft] = useState(() => createHostNightPresetDraft(selectedLaunchPreset));
    const selectedPresetIsCustom = !!selectedLaunchPreset && !selectedLaunchPreset.isBuiltIn;
    const selectedPresetBaseId = selectedLaunchPreset?.basePresetId || selectedLaunchPreset?.id || 'casual';
    const selectedPresetRequestMode = String(presetDraft?.settings?.requestMode || REQUEST_MODES.canonicalOpen);
    const selectedPresetShellVariant = String(presetDraft?.settings?.audienceShellVariant || '').trim() || 'classic';
    const selectedPresetCustomEmojiAccess = presetDraft?.settings?.audienceFeatureAccess?.features?.customEmoji === AUDIENCE_FEATURE_ACCESS_LEVELS.accountRequired
        ? AUDIENCE_FEATURE_ACCESS_LEVELS.accountRequired
        : AUDIENCE_FEATURE_ACCESS_LEVELS.open;
    const editorTitle = presetEditorMode === 'edit'
        ? 'Edit Preset'
        : selectedPresetIsCustom
            ? 'Duplicate Preset'
            : 'Customize Preset';
    const openPresetEditor = (mode = 'copy') => {
        setPresetEditorMode(mode);
        setPresetDraft(createHostNightPresetDraft(selectedLaunchPreset));
        setPresetEditorOpen(true);
    };
    const handlePresetDraftChange = (field, value) => {
        setPresetDraft((prev) => ({
            ...prev,
            [field]: value,
        }));
    };
    const handlePresetDraftSettingChange = (field, value) => {
        setPresetDraft((prev) => ({
            ...prev,
            settings: {
                ...(prev?.settings || {}),
                [field]: value,
            },
        }));
    };
    const handlePresetDraftQueueChange = (field, value) => {
        setPresetDraft((prev) => ({
            ...prev,
            settings: {
                ...(prev?.settings || {}),
                queueSettings: {
                    ...(prev?.settings?.queueSettings || {}),
                    [field]: value,
                },
            },
        }));
    };
    const handleSavePreset = () => {
        const nextId = presetEditorMode === 'edit' && selectedPresetIsCustom
            ? selectedLaunchPreset?.id
            : `preset_${Date.now().toString(36)}`;
        const normalized = normalizeHostNightPresetRecord({
            ...presetDraft,
            id: nextId,
            isBuiltIn: false,
            basePresetId: selectedPresetBaseId,
            updatedAtMs: Date.now(),
        }, selectedLaunchPreset);
        const saved = saveCustomHostPreset?.(normalized);
        if (saved?.id) {
            setHostNightPreset(saved.id);
            setPresetEditorOpen(false);
        }
    };
    const handleDeletePreset = () => {
        if (!selectedPresetIsCustom) return;
        deleteCustomHostPreset?.(selectedLaunchPreset?.id, selectedPresetBaseId);
        setPresetEditorOpen(false);
    };

    return (
    <div className="relative z-10 w-full max-w-[1600px]">
        <div className="rounded-[2rem] border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(255,194,104,0.12),transparent_22%),radial-gradient(circle_at_85%_14%,rgba(236,72,153,0.12),transparent_28%),linear-gradient(145deg,rgba(13,18,34,0.94),rgba(8,14,24,0.98))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl md:p-5">
            <div className="rounded-[1.3rem] border border-white/10 bg-black/20 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1rem] border border-cyan-300/18 bg-[radial-gradient(circle_at_30%_30%,rgba(0,196,217,0.18),transparent_55%),linear-gradient(180deg,rgba(7,14,28,0.96),rgba(18,12,28,0.9))] p-2 shadow-[0_0_40px_rgba(0,196,217,0.12)]">
                            <img src={ASSETS.logo} alt="BeauRocks Karaoke" className="h-full w-full object-contain drop-shadow-[0_0_14px_rgba(255,255,255,0.4)]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/68">BeauRocks Host Rooms</div>
                            <div className="mt-1 text-2xl font-black text-white md:text-[2rem]">Create a new room or reopen an existing one.</div>
                            <div className="mt-1 max-w-4xl text-sm text-cyan-100/74">
                                New rooms stay on the right with one primary create action. Existing rooms stay in the browser below so reopening and cleanup are separate from creation.
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <a
                            href="#launchpad-create-room"
                            className="inline-flex items-center rounded-full border border-cyan-300/35 bg-cyan-500/14 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100"
                        >
                            Create New Room
                        </a>
                        <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${launchStateTone}`}>
                            {launchState}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${launchAccessPending ? 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100' : 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100'}`}>
                            {launchAccessPending ? 'Syncing access' : 'Ready to host'}
                        </span>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    {launchOverviewStats.map((item) => (
                        <div key={item.label} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-cyan-100/76">
                            <span className="uppercase tracking-[0.16em] text-cyan-100/48">{item.label}</span>
                            <span className="font-semibold text-white">{item.value}</span>
                        </div>
                    ))}
                    <div className="ml-auto text-sm text-cyan-100/66">
                        Use <span className="font-semibold text-white">Existing room</span> to reopen by code or manage older rooms.
                    </div>
                </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
                <aside className="rounded-[1.4rem] border border-white/10 bg-black/22 p-3 xl:row-span-2">
                    <div className="px-2">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/58">Folders</div>
                        <div className="mt-1 text-lg font-black text-white">Room browser</div>
                        <div className="mt-1 text-sm text-cyan-100/68">Ready and upcoming rooms stay separate. Closed and archived rooms live together under Past.</div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                        {roomBrowserBuckets.map((bucket) => {
                            const selected = activeRoomBucket?.id === bucket.id;
                            return (
                                <button
                                    key={bucket.id}
                                    type="button"
                                    onClick={() => setRoomBrowserFilter(bucket.id)}
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

                <section className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/22 xl:col-start-2 xl:row-start-2">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/58">{activeRoomBucket?.label || 'Rooms'}</div>
                            <div className="mt-1 text-xl font-black text-white">
                                {recentHostRoomsLoading ? 'Syncing rooms...' : `${roomBrowserResults.length} room${roomBrowserResults.length === 1 ? '' : 's'}`}
                            </div>
                        </div>
                        <div className="flex min-w-full flex-col gap-2 sm:min-w-[320px] sm:flex-row">
                            <input
                                value={roomBrowserSearch}
                                onChange={(e) => setRoomBrowserSearch(e.target.value)}
                                placeholder="Search by room name, code, preset, or status"
                                className="min-w-0 flex-1 rounded-xl border border-cyan-400/20 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                            />
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

                    <div className="hidden grid-cols-[minmax(0,1.5fr)_120px_120px_180px_minmax(170px,1fr)] gap-3 border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-cyan-100/48 md:grid">
                        <div>Room</div>
                        <div>Status</div>
                        <div>Visibility</div>
                        <div>When</div>
                        <div className="text-right">Actions</div>
                    </div>

                    <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
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
                            return (
                                <div
                                    key={roomItem.code}
                                    onClick={() => setSelectedRoomCode(roomItem.code)}
                                    className={`grid cursor-pointer gap-3 border-b border-white/6 px-4 py-3 transition md:grid-cols-[minmax(0,1.5fr)_120px_120px_180px_minmax(170px,1fr)] ${selected ? 'bg-cyan-500/10' : 'hover:bg-white/[0.04]'}`}
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="truncate text-sm font-semibold text-white">{roomItem.roomName || roomItem.code}</div>
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
                                No rooms match this filter yet. Use Create New Room or switch folders.
                            </div>
                        )}
                    </div>
                </section>

                <aside className="space-y-4 xl:col-start-2 xl:row-start-1">
                    <div className="rounded-[1.4rem] border border-white/10 bg-black/22 p-4">
                        <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/58">Existing room</div>
                        <div className="mt-3 rounded-xl border border-cyan-300/18 bg-cyan-500/8 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Open by room code</div>
                            <div className="mt-1 text-sm text-cyan-100/72">Use this when you already know the room code and want the live host panel immediately.</div>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
                        </div>
                        {selectedRoom ? (
                            <>
                                <div className="mt-1 text-xl font-black text-white">{selectedRoom.roomName || selectedRoom.code}</div>
                                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-100/58">{selectedRoom.code}</div>
                                <div className="mt-2 text-sm text-cyan-100/68">Open it, update it, or remove it from the active list here.</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${selectedRoomLifecycle?.chipClass || 'border-white/10 bg-white/5 text-cyan-100/70'}`}>
                                        {selectedRoomLifecycle?.label || 'Room'}
                                    </span>
                                    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${selectedRoomVisibility?.chipClass || 'border-white/10 bg-white/5 text-cyan-100/70'}`}>
                                        {selectedRoomVisibility?.label || 'Private'}
                                    </span>
                                    {formatRoomSchedule(selectedRoom) ? (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/70">
                                            {formatRoomSchedule(selectedRoom)}
                                        </span>
                                    ) : null}
                                </div>

                                <div className="mt-4 rounded-xl border border-cyan-300/18 bg-cyan-500/8 px-3 py-3">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Recommended next</div>
                                    <div className="mt-1 text-base font-semibold text-white">{selectedRoomAction?.label || 'Open Host Panel'}</div>
                                    <div className="mt-1 text-sm text-cyan-100/72">
                                        {selectedRoomAction?.detail || 'Jump back into the room.'}
                                    </div>
                                </div>

                                {selectedRoomCleanupMeta ? (
                                    <div className={`mt-3 rounded-xl border px-3 py-3 text-sm ${selectedRoomCleanupMeta.toneClass}`}>
                                        {selectedRoomCleanupMeta.label}
                                    </div>
                                ) : null}

                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => runFeaturedAction(selectedRoomAction?.action || 'live', selectedRoom)}
                                        disabled={joiningRoom}
                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        {selectedRoomAction?.label || 'Open Host Panel'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openExistingRoomWorkspace(selectedRoom.code, 'ops.room_setup')}
                                        disabled={joiningRoom}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        Room Settings
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openExistingRoomWorkspace(selectedRoom.code, 'queue.live_run')}
                                        disabled={joiningRoom}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        Host Panel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openExistingRoomWorkspace(selectedRoom.code, 'show.timeline')}
                                        disabled={joiningRoom}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        Show Plan
                                    </button>
                                </div>

                                <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-500/8 px-3 py-3">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-rose-100/70">Room lifecycle</div>
                                    <div className="mt-1 text-sm text-rose-50/88">Archive rooms you want to keep, reset closed rooms you want to reuse, or permanently delete archived rooms you no longer need.</div>
                                    <div className="mt-3 flex flex-wrap gap-2">
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
                                            <button
                                                type="button"
                                                onClick={() => runFeaturedAction('recap', selectedRoom)}
                                                className="rounded-full border border-fuchsia-300/28 bg-fuchsia-500/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-fuchsia-100"
                                            >
                                                Open Recap
                                            </button>
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
                                </div>
                            </>
                        ) : (
                            <div className="mt-3 text-sm text-cyan-100/68">Select a room from the browser below to open it, archive it, restore it, or clean it up.</div>
                        )}
                    </div>

                    <div id="launchpad-create-room" className="rounded-[1.4rem] border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(10,18,28,0.94),rgba(24,11,31,0.9))] p-4 shadow-[0_20px_48px_rgba(0,0,0,0.24)]">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/58">Primary action</div>
                                <div className="mt-1 text-xl font-black text-white">Create New Room</div>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${launchDisabled ? 'border-amber-300/30 bg-amber-500/10 text-amber-100' : 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100'}`}>
                                {launchDisabled ? 'Needs input' : 'Ready'}
                            </span>
                        </div>
                        <div className="mt-2 text-sm text-cyan-100/68">Pick the night preset here, then open the host panel with the room already preconfigured.</div>

                        {shouldShowSetupCard ? (
                            <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-3">
                                <div className="text-sm font-semibold text-amber-50">Finish host setup first.</div>
                                <div className="mt-1 text-sm text-amber-100/78">
                                    Your workspace and host identity need one quick setup pass before you can create rooms.
                                </div>
                                <button
                                    type="button"
                                    onClick={openOnboardingWizard}
                                    disabled={!canUseWorkspaceOnboarding}
                                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} mt-3 px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${!canUseWorkspaceOnboarding ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    Finish Setup
                                </button>
                            </div>
                        ) : null}

                        <div className="mt-4 space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Room name</div>
                                    <input
                                        value={launchRoomName}
                                        onChange={(e) => setLaunchRoomName(e.target.value)}
                                        placeholder="Friday Karaoke"
                                        className={inputClass}
                                    />
                                </label>
                                <label className="block">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Requested room code</div>
                                    <input
                                        value={launchRequestedRoomCode}
                                        onChange={(e) => setLaunchRequestedRoomCode(e.target.value.toUpperCase())}
                                        placeholder="Optional"
                                        maxLength={10}
                                        className={`${inputClass} uppercase tracking-[0.18em]`}
                                    />
                                    <div className="mt-2 text-xs text-cyan-100/58">
                                        {hasRequestedLaunchRoomCode
                                            ? `We'll try to reserve ${requestedLaunchRoomCodeCandidate}. If another active room already has it, creation will stop so you can retry.`
                                            : 'Leave blank to auto-assign a room code.'}
                                    </div>
                                </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Start time</div>
                                    <input
                                        type="datetime-local"
                                        value={String(quickLaunchDiscovery?.roomStartsAtLocal || '')}
                                        onChange={(e) => setQuickLaunchDiscovery((prev) => ({
                                            ...prev,
                                            roomStartsAtLocal: e.target.value,
                                        }))}
                                        className={inputClass}
                                    />
                                </label>
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Visibility</div>
                                    <div className="mt-2 inline-flex w-full rounded-xl border border-white/10 bg-black/20 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setDiscoveryListingMode(false)}
                                            className={`flex-1 rounded-lg px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition ${!discoveryListingEnabled ? 'bg-white text-black' : 'text-cyan-100/72'}`}
                                        >
                                            Private
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDiscoveryListingMode(true)}
                                            className={`flex-1 rounded-lg px-3 py-2 text-[11px] uppercase tracking-[0.16em] transition ${discoveryListingEnabled ? 'bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black' : 'text-cyan-100/72'}`}
                                        >
                                            Discover
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Night preset</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {presets.map((preset) => {
                                        const selected = resolvedLaunchPresetId === preset.id;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => setHostNightPreset(preset.id)}
                                                className={`rounded-xl border px-3 py-2 text-left transition ${selected
                                                    ? 'border-cyan-300/35 bg-cyan-500/12 text-white'
                                                    : 'border-white/10 bg-white/[0.04] text-cyan-100/74 hover:border-cyan-300/24 hover:bg-white/[0.06]'}`}
                                            >
                                                <div className="text-xs font-semibold">{preset.label}</div>
                                                <div className="mt-0.5 text-[11px] text-cyan-100/56">{(PRESET_UI_META[preset.id] || PRESET_UI_META.casual).eyebrow}</div>
                                                {!preset.isBuiltIn ? (
                                                    <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-amber-100/72">Custom</div>
                                                ) : null}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openPresetEditor(selectedPresetIsCustom ? 'edit' : 'copy')}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-2 text-[10px] uppercase tracking-[0.18em]`}
                                    >
                                        {selectedPresetIsCustom ? 'Edit Selected Preset' : 'Customize Selected Preset'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPresetDraft(createHostNightPresetDraft(selectedLaunchPreset));
                                            setPresetEditorMode('copy');
                                            setPresetEditorOpen(true);
                                        }}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px] uppercase tracking-[0.18em]`}
                                    >
                                        New From This Preset
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-xl border border-cyan-300/18 bg-cyan-500/8 px-3 py-3 text-sm text-cyan-100/74">
                                <div className="font-semibold text-white">{String(launchRoomName || '').trim() || 'Untitled room'}</div>
                                <div className="mt-1">{hasRequestedLaunchRoomCode ? `Requested code ${requestedLaunchRoomCodeCandidate}` : 'Auto-assign room code'}</div>
                                <div className="mt-1">Starts {launchStartSummary}</div>
                                <div className="mt-1">{discoveryListingEnabled ? 'Listed in Discover' : 'Private join only'}</div>
                                <div className="mt-1">{selectedLaunchPreset?.label || 'No preset selected'}: {selectedPresetMeta.summary}</div>
                            </div>

                            {presetEditorOpen ? (
                                <div className="rounded-xl border border-fuchsia-300/22 bg-fuchsia-500/8 px-3 py-3 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-fuchsia-100/64">Preset editor</div>
                                            <div className="mt-1 text-base font-semibold text-white">{editorTitle}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setPresetEditorOpen(false)}
                                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1.5 text-[10px] uppercase tracking-[0.16em]`}
                                        >
                                            Close
                                        </button>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Preset name</div>
                                            <input
                                                value={presetDraft.label || ''}
                                                onChange={(e) => handlePresetDraftChange('label', e.target.value)}
                                                className={inputClass}
                                                placeholder="My festival preset"
                                            />
                                        </label>
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Description</div>
                                            <input
                                                value={presetDraft.description || ''}
                                                onChange={(e) => handlePresetDraftChange('description', e.target.value)}
                                                className={inputClass}
                                                placeholder="What this preset is for"
                                            />
                                        </label>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-3">
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Request policy</div>
                                            <select
                                                value={selectedPresetRequestMode}
                                                onChange={(e) => {
                                                    handlePresetDraftSettingChange('requestMode', e.target.value);
                                                    handlePresetDraftSettingChange('allowSingerTrackSelect', e.target.value === REQUEST_MODES.guestBackingOptional);
                                                }}
                                                className={inputClass}
                                            >
                                                {REQUEST_POLICY_OPTIONS.map((option) => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Audience shell</div>
                                            <select
                                                value={selectedPresetShellVariant}
                                                onChange={(e) => handlePresetDraftSettingChange('audienceShellVariant', e.target.value)}
                                                className={inputClass}
                                            >
                                                {AUDIENCE_SHELL_OPTIONS.map((option) => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Primary mode</div>
                                            <select
                                                value={String(presetDraft?.settings?.gamePreviewId || 'karaoke')}
                                                onChange={(e) => handlePresetDraftSettingChange('gamePreviewId', e.target.value === 'karaoke' ? '' : e.target.value)}
                                                className={inputClass}
                                            >
                                                <option value="karaoke">Karaoke</option>
                                                <option value="bingo">Bingo</option>
                                                <option value="trivia_pop">Trivia</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div className="grid gap-3 md:grid-cols-4">
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Queue cap</div>
                                            <select
                                                value={String(presetDraft?.settings?.queueSettings?.limitMode || 'none')}
                                                onChange={(e) => handlePresetDraftQueueChange('limitMode', e.target.value)}
                                                className={inputClass}
                                            >
                                                {QUEUE_LIMIT_OPTIONS.map((option) => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Queue count</div>
                                            <input
                                                type="number"
                                                min="0"
                                                max="10"
                                                value={String(presetDraft?.settings?.queueSettings?.limitCount ?? 0)}
                                                onChange={(e) => handlePresetDraftQueueChange('limitCount', e.target.value)}
                                                className={inputClass}
                                            />
                                        </label>
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Queue rotation</div>
                                            <select
                                                value={String(presetDraft?.settings?.queueSettings?.rotation || 'round_robin')}
                                                onChange={(e) => handlePresetDraftQueueChange('rotation', e.target.value)}
                                                className={inputClass}
                                            >
                                                {QUEUE_ROTATION_OPTIONS.map((option) => (
                                                    <option key={option.id} value={option.id}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="block">
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Custom emoji</div>
                                            <select
                                                value={selectedPresetCustomEmojiAccess}
                                                onChange={(e) => handlePresetDraftSettingChange('audienceFeatureAccess', {
                                                    features: {
                                                        customEmoji: e.target.value,
                                                    },
                                                })}
                                                className={inputClass}
                                            >
                                                <option value={AUDIENCE_FEATURE_ACCESS_LEVELS.open}>Guest Open</option>
                                                <option value={AUDIENCE_FEATURE_ACCESS_LEVELS.accountRequired}>BeauRocks Account Required</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                        {[
                                            ['autoDj', 'Auto DJ'],
                                            ['autoPlayMedia', 'Auto playback'],
                                            ['showScoring', 'Scoring'],
                                            ['marqueeEnabled', 'Marquee'],
                                            ['chatShowOnTv', 'TV chat'],
                                            ['popTriviaEnabled', 'Pop trivia'],
                                            ['autoLyricsOnQueue', 'Auto lyrics'],
                                            ['bouncerMode', 'Host approval'],
                                        ].map(([field, label]) => {
                                            const enabled = !!presetDraft?.settings?.[field];
                                            return (
                                                <button
                                                    key={field}
                                                    type="button"
                                                    onClick={() => handlePresetDraftSettingChange(field, !enabled)}
                                                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                                                        enabled
                                                            ? 'border-cyan-300/35 bg-cyan-500/12 text-white'
                                                            : 'border-white/10 bg-black/20 text-cyan-100/72'
                                                    }`}
                                                >
                                                    <div className="font-semibold">{label}</div>
                                                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em]">{enabled ? 'On' : 'Off'}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handlePresetDraftQueueChange('firstTimeBoost', !(presetDraft?.settings?.queueSettings?.firstTimeBoost !== false))}
                                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                                            presetDraft?.settings?.queueSettings?.firstTimeBoost !== false
                                                ? 'border-amber-300/35 bg-amber-500/12 text-amber-50'
                                                : 'border-white/10 bg-black/20 text-cyan-100/72'
                                        }`}
                                    >
                                        <div className="font-semibold">First-time singer boost</div>
                                        <div className="mt-1 text-[11px] uppercase tracking-[0.16em]">
                                            {presetDraft?.settings?.queueSettings?.firstTimeBoost !== false ? 'On' : 'Off'}
                                        </div>
                                    </button>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSavePreset}
                                            className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}
                                        >
                                            {presetEditorMode === 'edit' && selectedPresetIsCustom ? 'Save Preset' : 'Save as My Preset'}
                                        </button>
                                        {selectedPresetIsCustom ? (
                                            <button
                                                type="button"
                                                onClick={handleDeletePreset}
                                                className={`${STYLES.btnStd} ${STYLES.btnDanger} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}
                                            >
                                                Delete Preset
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}

                            <details className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                                <summary className="cursor-pointer list-none text-sm font-semibold text-white">Credits and promos</summary>
                                <div className="mt-3">
                                    <EventCreditsConfigPanel
                                        eventCreditsConfig={eventCreditsConfig}
                                        setEventCreditsConfig={setEventCreditsConfig}
                                        compact
                                    />
                                </div>
                            </details>

                            <div className="grid gap-2">
                                <button
                                    type="button"
                                    data-host-create-room-primary="true"
                                    onClick={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'stage' })}
                                    disabled={launchDisabled}
                                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} w-full justify-center px-4 py-3 text-[11px] uppercase tracking-[0.18em] ${launchDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                                >
                                    {creatingRoom ? 'Creating room...' : 'Create + Open Host Panel'}
                                </button>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <button
                                        type="button"
                                        onClick={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'show' })}
                                        disabled={launchDisabled}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-[10px] uppercase tracking-[0.18em] ${launchDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                                    >
                                        Create + Open Show Plan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'settings' })}
                                        disabled={launchDisabled}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-4 py-2 text-[10px] uppercase tracking-[0.18em] ${launchDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                                    >
                                        Create + Open Room Settings
                                    </button>
                                </div>
                                <div className="text-xs text-cyan-100/58">
                                    Use the host panel path for most nights. Show Plan and Room Settings are there when you need to prep before guests arrive.
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
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
    </div>
    );
};

export default HostRoomLaunchPadBrowser;
