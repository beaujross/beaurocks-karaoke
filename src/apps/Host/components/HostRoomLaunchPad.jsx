import React from 'react';
import { ASSETS } from '../../../lib/assets';

const formatRecentRoomTime = (value) => {
    const ms = Number(value || 0);
    if (!Number.isFinite(ms) || ms <= 0) return '';
    try {
        return new Date(ms).toLocaleString();
    } catch {
        return '';
    }
};

const inputClass = 'mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/45';

const LaunchShelfButton = ({ title, detail, actionLabel, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-left transition hover:border-cyan-300/35 hover:bg-cyan-500/8"
    >
        <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            <div className="mt-1 text-[11px] text-cyan-100/62">{detail}</div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/72">
            {actionLabel}
        </span>
    </button>
);

const LaunchModeCard = ({
    eyebrow,
    title,
    description,
    badge,
    badgeTone = 'border-cyan-300/25 bg-cyan-500/10 text-cyan-100',
    primaryLabel,
    primaryDisabled = false,
    primaryBusyLabel = '',
    primaryBusy = false,
    primaryToneClass = '',
    onPrimary,
    children,
}) => (
    <div className="rounded-[1.45rem] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(8,17,30,0.9),rgba(16,12,29,0.82))] p-4 text-left shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
        <div className="flex items-start justify-between gap-3">
            <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/68">{eyebrow}</div>
                <div className="mt-1 text-lg font-black text-white xl:text-[1.35rem]">{title}</div>
                <div className="mt-2 text-sm text-cyan-100/74">{description}</div>
            </div>
            {badge ? (
                <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${badgeTone}`}>
                    {badge}
                </span>
            ) : null}
        </div>

        <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-black/20 px-3 py-3">
            <button
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled}
                className={`${primaryToneClass} w-full ${primaryDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
                {primaryBusy ? primaryBusyLabel : primaryLabel}
            </button>
        </div>

        <div className="mt-4">{children}</div>
    </div>
);

const HostRoomLaunchPad = ({
    STYLES,
    launchState,
    launchStateTone,
    launchStateHelp,
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
    handleStartLauncherRoom,
    canStartLauncherRoom,
    creatingRoom,
    selectedLaunchPreset,
    landingLaunchMode,
    setLandingLaunchMode,
    entryError,
    retryLastHostAction,
    hostUpdateDeploymentBanner,
    recentHostRoomsLoading,
    recentRoomSnapshot,
    joiningRoom,
    openExistingRoomWorkspace,
    roomCodeInput,
    setRoomCodeInput,
    launchRoomCodeCandidate,
    hasLaunchRoomCode,
    renderRecentRoomList,
}) => {
    const launchDisabled = creatingRoom || !canStartLauncherRoom;
    const selectedPresetDescription = String(selectedLaunchPreset?.description || selectedLaunchPreset?.detail || '').trim();
    const recentRoomPreview = Array.isArray(recentRoomSnapshot) ? recentRoomSnapshot.slice(0, 3) : [];
    const latestRecentRoom = recentRoomPreview[0] || null;
    const launchVisibilityLabel = discoveryListingEnabled ? 'Discover listed' : 'Private launch';

    return (
        <div className="relative z-10 w-full max-w-6xl">
            <div className="rounded-[2rem] border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(255,194,104,0.12),transparent_22%),radial-gradient(circle_at_85%_14%,rgba(236,72,153,0.12),transparent_28%),linear-gradient(145deg,rgba(13,18,34,0.94),rgba(8,14,24,0.96))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3 text-left">
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.15rem] border border-cyan-300/18 bg-[radial-gradient(circle_at_30%_30%,rgba(0,196,217,0.18),transparent_55%),linear-gradient(180deg,rgba(7,14,28,0.96),rgba(18,12,28,0.9))] p-2 shadow-[0_0_40px_rgba(0,196,217,0.12)]">
                            <img src={ASSETS.logo} alt="BeauRocks Karaoke" className="h-full w-full object-contain drop-shadow-[0_0_14px_rgba(255,255,255,0.4)]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/68">BeauRocks Host Launch</div>
                            <div className="mt-1 text-2xl font-black text-white md:text-3xl">Open tonight&apos;s room from the right starting surface.</div>
                            <div className="mt-1 max-w-3xl text-sm text-cyan-100/74">
                                Every path below opens the same room. You are only choosing whether to land in the live host panel, the show planner, or room settings first.
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${launchStateTone}`}>
                            {launchState}
                        </span>
                        <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${launchAccessPending ? 'border-cyan-300/35 bg-cyan-500/10 text-cyan-100' : 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100'}`}>
                            {launchAccessPending ? 'Syncing access' : 'Ready to host'}
                        </span>
                    </div>
                </div>

                <div className="mt-5 space-y-4">
                    <div className="rounded-[1.7rem] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(9,19,31,0.94),rgba(26,12,34,0.82))] p-4 text-left shadow-[0_24px_70px_rgba(0,0,0,0.32)] md:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/68">Tonight&apos;s setup</div>
                                <div className="mt-1 text-2xl font-black text-white">What kind of night are you running?</div>
                                <div className="mt-2 max-w-3xl text-sm text-cyan-100/76">{launchStateHelp}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLandingLaunchMode(landingLaunchMode === 'advanced' ? 'start' : 'advanced')}
                                className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px] uppercase tracking-[0.18em] border-cyan-300/28 bg-cyan-500/10 text-cyan-100`}
                            >
                                {landingLaunchMode === 'advanced' ? 'Hide advanced tools' : 'Open advanced tools'}
                            </button>
                        </div>

                        {shouldShowSetupCard ? (
                            <div className="mt-4 rounded-[1.1rem] border border-amber-300/25 bg-amber-500/10 px-4 py-3">
                                <div className="text-sm font-semibold text-amber-50">Finish host setup before your first launch.</div>
                                <div className="mt-1 text-xs text-amber-100/78">
                                    Your workspace and host identity need one quick setup pass before rooms can be provisioned.
                                </div>
                                <button
                                    type="button"
                                    onClick={openOnboardingWizard}
                                    disabled={!canUseWorkspaceOnboarding}
                                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} mt-3 px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${!canUseWorkspaceOnboarding ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    Finish setup
                                </button>
                            </div>
                        ) : null}

                        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(250px,0.9fr)_minmax(250px,0.95fr)]">
                            <label className="block">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Room name</div>
                                <input
                                    value={launchRoomName}
                                    onChange={(e) => setLaunchRoomName(e.target.value)}
                                    placeholder="Jordan's Friday Room"
                                    className={inputClass}
                                />
                            </label>

                            <label className="block">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Night type</div>
                                <select
                                    value={resolvedLaunchPresetId}
                                    onChange={(e) => setHostNightPreset(e.target.value)}
                                    className={inputClass}
                                >
                                    {presets.map((preset) => (
                                        <option key={preset.id} value={preset.id}>
                                            {preset.label}
                                        </option>
                                    ))}
                                </select>
                                {selectedPresetDescription ? (
                                    <div className="mt-2 text-xs text-cyan-100/66">{selectedPresetDescription}</div>
                                ) : null}
                            </label>

                            <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Visibility</div>
                                <div className="mt-1 text-xs text-cyan-100/66">
                                    Keep it private by default. Only list it in Discover if guests should find it there tonight.
                                </div>
                                <div className="mt-3 inline-flex rounded-full border border-white/10 bg-black/20 p-1">
                                    <button
                                        type="button"
                                        onClick={() => setDiscoveryListingMode(false)}
                                        className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] transition ${!discoveryListingEnabled ? 'bg-white text-black' : 'text-cyan-100/72'}`}
                                    >
                                        Private
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDiscoveryListingMode(true)}
                                        className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] transition ${discoveryListingEnabled ? 'bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black' : 'text-cyan-100/72'}`}
                                    >
                                        Discover
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-xl border border-cyan-300/18 bg-black/18 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Selected night</div>
                                <div className="mt-1 text-sm font-semibold text-white">{selectedLaunchPreset?.label || 'Casual Night'}</div>
                            </div>
                            <div className="rounded-xl border border-cyan-300/18 bg-black/18 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Launch posture</div>
                                <div className="mt-1 text-sm font-semibold text-white">{launchVisibilityLabel}</div>
                            </div>
                            <div className="rounded-xl border border-cyan-300/18 bg-black/18 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/58">Configure later in settings</div>
                                <div className="mt-1 text-sm font-semibold text-white">Ticketing, co-hosts, venue, automation</div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[1.55rem] border border-fuchsia-300/14 bg-[linear-gradient(135deg,rgba(10,17,32,0.9),rgba(23,12,30,0.86))] px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.24em] text-fuchsia-100/68">Starting Surface</div>
                                <div className="mt-1 text-sm text-cyan-100/78">All three routes create or reopen the same room. Use the one that matches where you want to land first.</div>
                            </div>
                            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/72">
                                Same room, different first screen
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <LaunchModeCard
                            eyebrow="Live Surface"
                            title="Open Host Panel"
                            description="Land in the live host deck for queue, TV, stage, and audience control."
                            badge="Live first"
                            primaryLabel="Start In Host Panel"
                            primaryBusyLabel="Starting room..."
                            primaryBusy={creatingRoom}
                            primaryDisabled={launchDisabled}
                            primaryToneClass={`${STYLES.btnStd} ${STYLES.btnHighlight} px-5 py-3 text-sm uppercase tracking-[0.22em]`}
                            onPrimary={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'stage' })}
                        >
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Reopen existing room live</div>
                            <div className="mt-2 space-y-2">
                                {recentHostRoomsLoading ? (
                                    <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-xs text-cyan-100/72">
                                        Syncing recent rooms...
                                    </div>
                                ) : recentRoomPreview.length > 0 ? recentRoomPreview.slice(0, 2).map((roomItem) => (
                                    <LaunchShelfButton
                                        key={`host-live-${roomItem.code}`}
                                        title={roomItem.roomName || roomItem.code}
                                        detail={`${roomItem.code}${formatRecentRoomTime(roomItem.updatedAtMs || roomItem.createdAtMs) ? ` • ${formatRecentRoomTime(roomItem.updatedAtMs || roomItem.createdAtMs)}` : ''}`}
                                        actionLabel="Open live"
                                        onClick={() => openExistingRoomWorkspace(roomItem.code, 'queue.live_run')}
                                    />
                                )) : (
                                    <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-xs text-cyan-100/68">
                                        No recent rooms yet. Your next launch will populate this shelf.
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 rounded-[1.1rem] border border-white/10 bg-black/18 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/68">Open by room code</div>
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                    <input
                                        value={roomCodeInput}
                                        onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && hasLaunchRoomCode) {
                                                openExistingRoomWorkspace(launchRoomCodeCandidate, 'queue.live_run');
                                            }
                                        }}
                                        placeholder="Enter room code"
                                        className="flex-1 rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm uppercase tracking-[0.18em] text-white outline-none transition focus:border-cyan-300/45"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openExistingRoomWorkspace(launchRoomCodeCandidate, 'queue.live_run')}
                                        disabled={!hasLaunchRoomCode || joiningRoom}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-[10px] uppercase tracking-[0.18em] ${!hasLaunchRoomCode || joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        Open
                                    </button>
                                </div>
                            </div>
                        </LaunchModeCard>

                        <LaunchModeCard
                            eyebrow="Planning Surface"
                            title="Open Show Plan"
                            description="Land in intros, performance slots, breaks, and TV takeover planning."
                            badge="Show-first"
                            badgeTone="border-fuchsia-300/25 bg-fuchsia-500/10 text-fuchsia-100"
                            primaryLabel="Start And Open Show"
                            primaryBusyLabel="Starting room..."
                            primaryBusy={creatingRoom}
                            primaryDisabled={launchDisabled}
                            primaryToneClass={`${STYLES.btnStd} border-fuchsia-300/32 bg-gradient-to-r from-[#1b1732] via-[#102338] to-[#1a1733] px-5 py-3 text-sm uppercase tracking-[0.22em] text-white hover:border-fuchsia-300/48`}
                            onPrimary={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'show' })}
                        >
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Continue an existing show plan</div>
                            {latestRecentRoom ? (
                                <div className="mt-2 space-y-2">
                                    <LaunchShelfButton
                                        title={latestRecentRoom.roomName || latestRecentRoom.code}
                                        detail={`${latestRecentRoom.code} • last room`}
                                        actionLabel="Open show"
                                        onClick={() => openExistingRoomWorkspace(latestRecentRoom.code, 'show.timeline')}
                                    />
                                </div>
                            ) : (
                                <div className="mt-2 rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-xs text-cyan-100/68">
                                    Start a room first, then the show builder becomes your planning surface.
                                </div>
                            )}
                            <div className="mt-3 rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-xs text-cyan-100/68">
                                Use this lane when the sequence matters before the queue starts moving.
                            </div>
                        </LaunchModeCard>

                        <LaunchModeCard
                            eyebrow="Settings Surface"
                            title="Open Room Settings"
                            description="Land in settings when tonight is ticketed, branded, staff-heavy, or needs room tweaks before guests arrive."
                            badge="Configure first"
                            badgeTone="border-amber-300/25 bg-amber-500/10 text-amber-100"
                            primaryLabel="Start And Open Settings"
                            primaryBusyLabel="Starting room..."
                            primaryBusy={creatingRoom}
                            primaryDisabled={launchDisabled}
                            primaryToneClass={`${STYLES.btnStd} border-amber-300/32 bg-gradient-to-r from-[#2a1d14] via-[#102338] to-[#1b1732] px-5 py-3 text-sm uppercase tracking-[0.22em] text-white hover:border-amber-300/45`}
                            onPrimary={() => handleStartLauncherRoom({ openNightSetup: false, launchTarget: 'settings' })}
                        >
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Manage an existing room</div>
                            {latestRecentRoom ? (
                                <div className="mt-2 space-y-2">
                                    <LaunchShelfButton
                                        title={latestRecentRoom.roomName || latestRecentRoom.code}
                                        detail={`${latestRecentRoom.code} • room settings`}
                                        actionLabel="Open settings"
                                        onClick={() => openExistingRoomWorkspace(latestRecentRoom.code, 'ops.room_setup')}
                                    />
                                </div>
                            ) : (
                                <div className="mt-2 rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-xs text-cyan-100/68">
                                    Launch one room and this becomes the place for ticketing, credits, co-hosts, and discover refinement.
                                </div>
                            )}
                            <div className="mt-3 rounded-xl border border-amber-300/14 bg-amber-500/6 px-3 py-3 text-xs text-amber-100/84">
                                Ticketed credits, Givebutter, co-hosts, venue details, and advanced room tweaks all live inside the room, not on this launch page.
                            </div>
                        </LaunchModeCard>
                    </div>

                    {entryError ? (
                        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-left text-xs text-rose-200">
                            <div>{entryError}</div>
                            <button type="button" onClick={retryLastHostAction} className="mt-2 inline-flex items-center rounded-full border border-rose-300/40 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-rose-100">
                                Retry last action
                            </button>
                        </div>
                    ) : null}
                    {hostUpdateDeploymentBanner ? <div>{hostUpdateDeploymentBanner}</div> : null}

                    {landingLaunchMode === 'advanced' ? (
                        <div className="rounded-[1.6rem] border border-fuchsia-300/14 bg-[linear-gradient(180deg,rgba(14,12,28,0.92),rgba(8,16,28,0.9))] p-4 text-left">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.24em] text-amber-100/72">Advanced Tools</div>
                                    <div className="mt-1 text-xl font-black text-white">Cleanup, archives, recovery, and diagnostics.</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setLandingLaunchMode('start')}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1.5 text-[10px] uppercase tracking-[0.18em]`}
                                >
                                    Back to launch
                                </button>
                            </div>
                            <div className="mt-3 text-xs text-cyan-100/70">
                                These tools still exist, but they stay below the launch decision so the first screen stays focused.
                            </div>
                            {renderRecentRoomList({ managementMode: true })}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default HostRoomLaunchPad;
