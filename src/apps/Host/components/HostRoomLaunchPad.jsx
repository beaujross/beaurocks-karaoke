import React from 'react';
import {
    EVENT_CREDITS_PRESET_OPTIONS,
    applyEventCreditsPreset,
    createEventCreditsDraft
} from '../hostLaunchHelpers';

const formatRecentRoomTime = (value) => {
    const ms = Number(value || 0);
    if (!Number.isFinite(ms) || ms <= 0) return '';
    try {
        return new Date(ms).toLocaleString();
    } catch {
        return '';
    }
};

const checklistItems = [
    'Audience join link ready',
    'TV launch opens with one click',
    'Refine Discover listing later',
    'Invite or adjust co-hosts after launch',
];

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
    quickLaunchDiscovery,
    setQuickLaunchDiscovery,
    eventCreditsConfig,
    setEventCreditsConfig,
    handleLaunchVenueInputChange,
    hasSelectedVenue,
    discoverVenueSummary,
    venueSearchLoading,
    venueSearchError,
    venueSearchResults,
    selectLaunchVenueMatch,
    landingListingDetailsOpen,
    setShowLandingListingOptions,
    showLaunchCoHosts,
    setShowLaunchCoHosts,
    launchCoHostUids,
    launchCoHostSearch,
    setLaunchCoHostSearch,
    workspaceOperatorLoading,
    workspaceOperatorError,
    filteredLaunchCoHosts,
    toggleLaunchCoHost,
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
    roomManagerBusyCode,
    joiningRoom,
    openExistingRoomWorkspace,
    roomCodeInput,
    setRoomCodeInput,
    launchRoomCodeCandidate,
    hasLaunchRoomCode,
    joinRoom,
    renderRecentRoomList,
}) => {
    const launchDisabled = creatingRoom || !canStartLauncherRoom;
    const selectedPresetDescription = String(selectedLaunchPreset?.description || selectedLaunchPreset?.detail || '').trim();
    const showFreeformVenueHint = discoveryListingEnabled
        && !!String(quickLaunchDiscovery?.venueName || '').trim()
        && !hasSelectedVenue
        && !venueSearchLoading;

    const updateDiscovery = (patch) => {
        setQuickLaunchDiscovery((prev) => ({ ...prev, ...patch }));
    };
    const updateEventCredits = (patch) => {
        setEventCreditsConfig((prev) => ({
            ...prev,
            ...patch,
            promoCampaigns: Array.isArray(patch?.promoCampaigns)
                ? patch.promoCampaigns
                : (Array.isArray(prev?.promoCampaigns) ? prev.promoCampaigns : []),
            claimCodes: {
                ...(prev?.claimCodes || {}),
                ...(patch?.claimCodes || {}),
            },
        }));
    };
    const eventCreditsDraft = createEventCreditsDraft(eventCreditsConfig);
    const selectedCreditsPreset = EVENT_CREDITS_PRESET_OPTIONS.find((preset) => preset.id === eventCreditsDraft.presetId)
        || EVENT_CREDITS_PRESET_OPTIONS[1];
    const isSimpleTicketedPreset = ['ticketed_event', 'aahf_kickoff'].includes(selectedCreditsPreset.id);
    const advancedEventCreditCount = (
        Number(eventCreditsDraft.vipBonusPoints || 0)
        + Number(eventCreditsDraft.skipLineBonusPoints || 0)
        + Number(eventCreditsDraft.websiteCheckInPoints || 0)
        + Number(eventCreditsDraft.socialPromoPoints || 0)
        + (Array.isArray(eventCreditsDraft.promoCampaigns) ? eventCreditsDraft.promoCampaigns.length : 0)
        + Object.values(eventCreditsDraft.claimCodes || {}).filter(Boolean).length
    );
    const applyCreditsPreset = (presetId) => {
        setEventCreditsConfig((prev) => applyEventCreditsPreset(presetId, prev));
    };
    const upsertPromoCampaign = (campaignId, patch = {}) => {
        updateEventCredits({
            promoCampaigns: eventCreditsDraft.promoCampaigns.map((campaign) => (
                campaign.id === campaignId
                    ? { ...campaign, ...patch }
                    : campaign
            )),
        });
    };
    const removePromoCampaign = (campaignId) => {
        updateEventCredits({
            promoCampaigns: eventCreditsDraft.promoCampaigns.filter((campaign) => campaign.id !== campaignId),
        });
    };
    const addPromoCampaign = () => {
        const nextIndex = eventCreditsDraft.promoCampaigns.length + 1;
        updateEventCredits({
            promoCampaigns: [
                ...eventCreditsDraft.promoCampaigns,
                {
                    id: `promo_${nextIndex}`,
                    label: `Promo ${nextIndex}`,
                    type: 'multi_use_capped',
                    codeMode: 'vanity',
                    code: '',
                    pointsReward: 100,
                    safePerk: '',
                    maxRedemptions: 250,
                    perUserLimit: 1,
                    requiresRoomJoin: true,
                    enabled: true,
                    validFromMs: 0,
                    validUntilMs: 0,
                },
            ],
        });
    };

    const renderRecentRoomCard = (roomItem) => {
        const roomBusy = roomManagerBusyCode === roomItem.code;
        const timestamp = formatRecentRoomTime(roomItem.updatedAtMs || roomItem.createdAtMs);
        return (
            <div
                key={`launchpad-${roomItem.code}`}
                className="rounded-[1.15rem] border border-white/10 bg-[linear-gradient(145deg,rgba(9,18,30,0.86),rgba(24,11,34,0.72))] px-3 py-3"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-black tracking-[0.08em] text-white">
                                {roomItem.roomName || roomItem.code}
                            </div>
                            {roomItem.archived && (
                                <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-amber-100">
                                    Archived
                                </span>
                            )}
                        </div>
                        <div className="mt-1 text-[11px] text-cyan-100/65">
                            {roomItem.code}
                            {roomItem.orgName ? ` | ${roomItem.orgName}` : ''}
                        </div>
                        {timestamp && (
                            <div className="mt-1 text-[11px] text-cyan-100/48">{timestamp}</div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => openExistingRoomWorkspace(roomItem.code, 'queue.live_run')}
                        disabled={joiningRoom || roomBusy}
                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-[10px] ${joiningRoom || roomBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        Open
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="relative z-10 w-full max-w-6xl">
            <div className="rounded-[2rem] border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,rgba(255,194,104,0.12),transparent_22%),radial-gradient(circle_at_85%_14%,rgba(236,72,153,0.12),transparent_28%),linear-gradient(145deg,rgba(13,18,34,0.94),rgba(8,14,24,0.96))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.48)] backdrop-blur-xl md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border border-white/10 bg-black/15 px-4 py-3 text-left">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-100/68">Host Launch</div>
                        <div className="mt-1 text-2xl font-black text-white md:text-3xl">Start tonight in seconds.</div>
                        <div className="mt-1 text-sm text-cyan-100/74">{launchStateHelp}</div>
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

                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
                    <div className="rounded-[1.6rem] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(9,19,31,0.92),rgba(18,11,31,0.78))] p-4 text-left md:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/68">Start New Room</div>
                                <div className="mt-1 text-2xl font-black text-white">One card. One decision path.</div>
                                <div className="mt-2 max-w-2xl text-sm text-cyan-100/76">
                                    Name the room, choose a preset, decide whether to list it in Discover, then launch.
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLandingLaunchMode(landingLaunchMode === 'advanced' ? 'start' : 'advanced')}
                                className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-2 text-[10px] uppercase tracking-[0.18em] border-cyan-300/28 bg-cyan-500/10 text-cyan-100`}
                            >
                                {landingLaunchMode === 'advanced' ? 'Hide tools' : 'View tools'}
                            </button>
                        </div>

                        {shouldShowSetupCard && (
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
                        )}

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <label className="block md:col-span-2">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Room name</div>
                                <input
                                    value={launchRoomName}
                                    onChange={(e) => setLaunchRoomName(e.target.value)}
                                    placeholder="Jordan's Friday Room"
                                    className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                />
                            </label>

                            <label className="block">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Room preset</div>
                                <select
                                    value={resolvedLaunchPresetId}
                                    onChange={(e) => setHostNightPreset(e.target.value)}
                                    className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                >
                                    {presets.map((preset) => (
                                        <option key={preset.id} value={preset.id}>
                                            {preset.label}
                                        </option>
                                    ))}
                                </select>
                                {selectedPresetDescription && (
                                    <div className="mt-2 text-xs text-cyan-100/66">{selectedPresetDescription}</div>
                                )}
                            </label>

                            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Discover listing</div>
                                <div className="mt-1 text-xs text-cyan-100/66">
                                    Leave off for private rooms. Turn on only when guests should find tonight's room in Discover.
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
                                        Show in discover
                                    </button>
                                </div>
                            </div>
                        </div>

                        {discoveryListingEnabled && (
                            <div className="mt-4 rounded-[1.25rem] border border-cyan-300/18 bg-cyan-500/6 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Venue + location</div>
                                        <div className="mt-1 text-sm text-cyan-50/86">Search your venue database first, or keep typing to use a freeform venue name.</div>
                                    </div>
                                    {hasSelectedVenue && (
                                        <span className="rounded-full border border-emerald-300/35 bg-emerald-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
                                            Matched venue
                                        </span>
                                    )}
                                </div>

                                <label className="mt-3 block">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Venue</div>
                                    <input
                                        value={quickLaunchDiscovery.venueName}
                                        onChange={(e) => handleLaunchVenueInputChange(e.target.value)}
                                        placeholder="Start typing a venue name"
                                        className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                    />
                                </label>

                                {venueSearchError && (
                                    <div className="mt-2 text-xs text-rose-200">{venueSearchError}</div>
                                )}
                                {venueSearchLoading && (
                                    <div className="mt-2 text-xs text-cyan-100/70">Searching venue library...</div>
                                )}
                                {!venueSearchLoading && venueSearchResults.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {venueSearchResults.map((venue) => (
                                            <button
                                                key={venue.venueId || `${venue.title}-${venue.city}-${venue.state}`}
                                                type="button"
                                                onClick={() => selectLaunchVenueMatch(venue)}
                                                className="w-full rounded-xl border border-cyan-400/18 bg-black/25 px-3 py-3 text-left transition hover:border-cyan-300/40 hover:bg-cyan-500/8"
                                            >
                                                <div className="text-sm font-semibold text-white">{venue.title}</div>
                                                <div className="mt-1 text-xs text-cyan-100/70">
                                                    {[venue.city, venue.state].filter(Boolean).join(', ') || venue.address1 || 'Venue match'}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showFreeformVenueHint && (
                                    <div className="mt-2 text-xs text-cyan-100/68">
                                        No exact match selected. You can keep this as a freeform venue and refine details later.
                                    </div>
                                )}

                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <label className="block">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">City</div>
                                        <input
                                            value={quickLaunchDiscovery.city}
                                            onChange={(e) => updateDiscovery({ city: e.target.value })}
                                            placeholder="Los Angeles"
                                            className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                        />
                                    </label>
                                    <label className="block">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">State</div>
                                        <input
                                            value={quickLaunchDiscovery.state}
                                            onChange={(e) => updateDiscovery({ state: e.target.value })}
                                            placeholder="CA"
                                            className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                        />
                                    </label>
                                </div>

                                <details className="mt-3 rounded-xl border border-white/10 bg-black/18 px-3 py-3" open={landingListingDetailsOpen}>
                                    <summary
                                        className="cursor-pointer list-none text-[11px] uppercase tracking-[0.18em] text-cyan-100/70"
                                        onClick={() => setShowLandingListingOptions((prev) => !prev)}
                                    >
                                        Refine exact map placement
                                    </summary>
                                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                                        <label className="block md:col-span-2">
                                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Street address</div>
                                            <input value={quickLaunchDiscovery.address1} onChange={(e) => updateDiscovery({ address1: e.target.value })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" placeholder="Street address (optional)" />
                                        </label>
                                        <label className="block">
                                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Latitude</div>
                                            <input value={quickLaunchDiscovery.lat} onChange={(e) => updateDiscovery({ lat: e.target.value })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" placeholder="Optional" />
                                        </label>
                                        <label className="block">
                                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Longitude</div>
                                            <input value={quickLaunchDiscovery.lng} onChange={(e) => updateDiscovery({ lng: e.target.value })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" placeholder="Optional" />
                                        </label>
                                    </div>
                                </details>
                            </div>
                        )}

                        <details className="mt-4 rounded-[1.25rem] border border-amber-300/18 bg-amber-500/6 px-4 py-3">
                            <summary className="cursor-pointer list-none text-left">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-amber-100/76">Credits &amp; Funds</div>
                                        <div className="mt-1 text-xs text-cyan-100/66">
                                            For ticketed events, the safe default is one Givebutter campaign plus one flat credit amount for every matched attendee.
                                        </div>
                                    </div>
                                    <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${eventCreditsConfig?.enabled ? 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100' : 'border-white/10 bg-white/5 text-cyan-100/72'}`}>
                                        {eventCreditsConfig?.enabled ? 'Enabled' : 'Off'}
                                    </span>
                                </div>
                            </summary>
                            <div className="mt-3 space-y-3">
                                <div className="grid gap-2 md:grid-cols-4">
                                    {EVENT_CREDITS_PRESET_OPTIONS.map((preset) => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => applyCreditsPreset(preset.id)}
                                            className={`rounded-2xl border p-3 text-left transition ${selectedCreditsPreset.id === preset.id ? 'border-amber-300/40 bg-amber-500/12 text-amber-50' : 'border-white/10 bg-black/18 text-zinc-100 hover:border-amber-300/22'}`}
                                        >
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/66">{preset.label}</div>
                                            <div className="mt-2 text-xs text-current/80">{preset.description}</div>
                                        </button>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/18 px-3 py-3">
                                    <div>
                                        <div className="text-sm font-semibold text-white">Enable ticket-linked event credits</div>
                                        <div className="mt-1 text-xs text-cyan-100/66">
                                            Keep this on only if you want Givebutter ticket matching or event-specific room credits. You can leave the advanced reward paths off.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => updateEventCredits({ enabled: !eventCreditsConfig?.enabled })}
                                        className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.16em] ${eventCreditsConfig?.enabled ? 'bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black' : 'border border-white/10 bg-white/5 text-cyan-100/72'}`}
                                    >
                                        {eventCreditsConfig?.enabled ? 'On' : 'Off'}
                                    </button>
                                </div>

                                {eventCreditsConfig?.enabled && (
                                    <div className={`rounded-xl border px-3 py-3 ${isSimpleTicketedPreset ? 'border-emerald-300/22 bg-emerald-500/7' : 'border-cyan-300/18 bg-cyan-500/6'}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">
                                                    {isSimpleTicketedPreset ? 'Recommended live setup' : 'Ticket-linked room credits'}
                                                </div>
                                                <div className="mt-1 text-xs text-cyan-100/72">
                                                    Use one Givebutter campaign, one email match, and one standard credit amount. Leave bonus paths off unless you truly need them.
                                                </div>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/72">
                                                {advancedEventCreditCount > 0 ? `${advancedEventCreditCount} advanced values set` : 'Flat credits only'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-3 md:grid-cols-2">
                                    <label className="block">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Event label</div>
                                        <input
                                            value={eventCreditsConfig?.eventLabel || ''}
                                            onChange={(e) => updateEventCredits({ eventLabel: e.target.value })}
                                            className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                            placeholder="AAHF Karaoke Kick-Off"
                                        />
                                    </label>
                                    <label className="block">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Event id</div>
                                        <input
                                            value={eventCreditsConfig?.eventId || ''}
                                            onChange={(e) => updateEventCredits({ eventId: e.target.value })}
                                            className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                            placeholder="aahf_kickoff"
                                        />
                                    </label>
                                    <label className="block">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Funding source</div>
                                        <select
                                            value={eventCreditsDraft.sourceProvider || ''}
                                            onChange={(e) => updateEventCredits({ sourceProvider: e.target.value })}
                                            className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                        >
                                            <option value="">No source automation</option>
                                            <option value="givebutter">Givebutter webhook</option>
                                        </select>
                                    </label>
                                    <label className="block">
                                        <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">
                                            <span>Givebutter campaign code</span>
                                            <span className="text-[10px] normal-case tracking-normal text-cyan-100/48">Recommended</span>
                                        </div>
                                        <input
                                            value={eventCreditsDraft.sourceCampaignCode || ''}
                                            onChange={(e) => updateEventCredits({ sourceCampaignCode: e.target.value })}
                                            className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                            placeholder="festival-kick-off-karaoke-party-y1ogra"
                                        />
                                        <div className="mt-1 text-[11px] text-cyan-100/50">
                                            Using the campaign code is safer than relying on raw event ID matching alone.
                                        </div>
                                    </label>
                                </div>

                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
                                    <label className="block">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Ticket credits for each matched attendee</div>
                                        <input
                                            type="number"
                                            min="0"
                                            value={eventCreditsConfig?.generalAdmissionPoints ?? 0}
                                            onChange={(e) => updateEventCredits({ generalAdmissionPoints: e.target.value })}
                                            className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                        />
                                        <div className="mt-1 text-[11px] text-cyan-100/50">
                                            This is the only credit amount most ticketed events need.
                                        </div>
                                    </label>
                                    <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-xs text-cyan-100/66">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Night-of-show path</div>
                                        <div className="mt-2 space-y-1">
                                            <div>1. Ticket sold in Givebutter</div>
                                            <div>2. Webhook creates entitlement</div>
                                            <div>3. Guest signs in with matching email</div>
                                            <div>4. Room grants this credit amount</div>
                                        </div>
                                    </div>
                                </div>

                                <details className="rounded-xl border border-white/10 bg-black/18 px-3 py-3">
                                    <summary className="cursor-pointer list-none text-left">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Advanced rewards and promos</div>
                                                <div className="mt-1 text-xs text-cyan-100/66">
                                                    Optional. Keep this collapsed unless you intentionally want bonus ticket tiers, QR drops, promo codes, or fallback claim paths.
                                                </div>
                                            </div>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/72">
                                                {advancedEventCreditCount > 0 ? `${advancedEventCreditCount} active` : 'Off'}
                                            </span>
                                        </div>
                                    </summary>
                                    <div className="mt-3 space-y-3">
                                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                            <label className="block">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">VIP bonus points</div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={eventCreditsConfig?.vipBonusPoints ?? 0}
                                                    onChange={(e) => updateEventCredits({ vipBonusPoints: e.target.value })}
                                                    className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                                />
                                            </label>
                                            <label className="block">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Skip-line bonus points</div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={eventCreditsConfig?.skipLineBonusPoints ?? 0}
                                                    onChange={(e) => updateEventCredits({ skipLineBonusPoints: e.target.value })}
                                                    className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                                />
                                            </label>
                                            <label className="block">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Website check-in points</div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={eventCreditsConfig?.websiteCheckInPoints ?? 0}
                                                    onChange={(e) => updateEventCredits({ websiteCheckInPoints: e.target.value })}
                                                    className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                                />
                                            </label>
                                            <label className="block">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Social promo points</div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={eventCreditsConfig?.socialPromoPoints ?? 0}
                                                    onChange={(e) => updateEventCredits({ socialPromoPoints: e.target.value })}
                                                    className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                                />
                                            </label>
                                        </div>

                                        <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Promo campaigns</div>
                                            <div className="mt-1 text-xs text-cyan-100/66">
                                                Use QR links or capped promo codes for points and safe perks. Paid access should come from ticket-linked entitlements instead of shared codes.
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addPromoCampaign}
                                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1.5 text-[10px] uppercase tracking-[0.16em]`}
                                        >
                                            Add promo
                                        </button>
                                    </div>
                                    <div className="mt-3 space-y-3">
                                        {eventCreditsDraft.promoCampaigns.length ? eventCreditsDraft.promoCampaigns.map((campaign) => (
                                            <div key={campaign.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="text-sm font-semibold text-white">{campaign.label}</div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removePromoCampaign(campaign.id)}
                                                        className={`${STYLES.btnStd} ${STYLES.btnDanger} px-3 py-1.5 text-[10px] uppercase tracking-[0.16em]`}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                    <label className="block">
                                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Name</div>
                                                        <input value={campaign.label} onChange={(e) => upsertPromoCampaign(campaign.id, { label: e.target.value })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" />
                                                    </label>
                                                    <label className="block">
                                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Type</div>
                                                        <select value={campaign.type} onChange={(e) => upsertPromoCampaign(campaign.id, { type: e.target.value })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45">
                                                            <option value="single_use">Single-use</option>
                                                            <option value="multi_use_capped">Multi-use capped</option>
                                                            <option value="timed_drop">Timed drop</option>
                                                            <option value="staff_issued">Staff-issued</option>
                                                        </select>
                                                    </label>
                                                    <label className="block">
                                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Code style</div>
                                                        <select value={campaign.codeMode} onChange={(e) => upsertPromoCampaign(campaign.id, { codeMode: e.target.value })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45">
                                                            <option value="vanity">Vanity code</option>
                                                            <option value="random">Random code</option>
                                                            <option value="qr_link">QR / link claim</option>
                                                        </select>
                                                    </label>
                                                    <label className="block">
                                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Reward points</div>
                                                        <input type="number" min="0" value={campaign.pointsReward ?? 0} onChange={(e) => upsertPromoCampaign(campaign.id, { pointsReward: e.target.value })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" />
                                                    </label>
                                                    <label className="block md:col-span-2">
                                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Claim code / token</div>
                                                        <input value={campaign.code || ''} onChange={(e) => upsertPromoCampaign(campaign.id, { code: e.target.value })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" placeholder="Optional if using auto-generated or QR-only campaigns" />
                                                    </label>
                                                    <label className="block">
                                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Max uses</div>
                                                        <input type="number" min="1" value={campaign.maxRedemptions ?? 1} onChange={(e) => upsertPromoCampaign(campaign.id, { maxRedemptions: e.target.value })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" />
                                                    </label>
                                                    <label className="block">
                                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Per-user limit</div>
                                                        <input type="number" min="1" value={campaign.perUserLimit ?? 1} onChange={(e) => upsertPromoCampaign(campaign.id, { perUserLimit: e.target.value })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" />
                                                    </label>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-3 py-3 text-xs text-cyan-100/66">
                                                No promo campaigns yet. Add QR/link or capped promo drops here.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                        <details className="rounded-xl border border-white/10 bg-black/18 px-3 py-3">
                                    <summary className="cursor-pointer list-none text-left">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Legacy manual fallback</div>
                                        <div className="mt-1 text-xs text-cyan-100/66">
                                            Keep shared claim codes only as an emergency backup for low-risk bonus paths.
                                        </div>
                                    </summary>
                                    <div className="mt-3">
                                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Legacy claim codes</div>
                                    <div className="mt-1 text-xs text-cyan-100/66">
                                        These stay server-side and should stay blank unless you need a temporary fallback.
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <label className="block">
                                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">VIP</div>
                                            <input value={eventCreditsConfig?.claimCodes?.vip || ''} onChange={(e) => updateEventCredits({ claimCodes: { vip: e.target.value } })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" placeholder="VIP2026" />
                                        </label>
                                        <label className="block">
                                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Skip line</div>
                                            <input value={eventCreditsConfig?.claimCodes?.skipLine || ''} onChange={(e) => updateEventCredits({ claimCodes: { skipLine: e.target.value } })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" placeholder="SKIPAAHF" />
                                        </label>
                                        <label className="block">
                                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Website check-in</div>
                                            <input value={eventCreditsConfig?.claimCodes?.websiteCheckIn || ''} onChange={(e) => updateEventCredits({ claimCodes: { websiteCheckIn: e.target.value } })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" placeholder="CHECKINAAHF" />
                                        </label>
                                        <label className="block">
                                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Social promo</div>
                                            <input value={eventCreditsConfig?.claimCodes?.socialPromo || ''} onChange={(e) => updateEventCredits({ claimCodes: { socialPromo: e.target.value } })} className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45" placeholder="POSTLOUD" />
                                        </label>
                                    </div>
                                    </div>
                                </details>
                                    </div>
                                </details>
                            </div>
                        </details>

                        <details className="mt-4 rounded-[1.25rem] border border-white/10 bg-black/18 px-4 py-3" open={showLaunchCoHosts}>
                            <summary
                                className="cursor-pointer list-none text-left"
                                onClick={() => setShowLaunchCoHosts((prev) => !prev)}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/70">Add co-hosts</div>
                                        <div className="mt-1 text-xs text-cyan-100/66">Optional. Give known operators access at launch without making it part of the main decision path.</div>
                                    </div>
                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100/72">
                                        {launchCoHostUids.length} selected
                                    </span>
                                </div>
                            </summary>
                            <div className="mt-3">
                                <input
                                    value={launchCoHostSearch}
                                    onChange={(e) => setLaunchCoHostSearch(e.target.value)}
                                    placeholder="Search known operators"
                                    className="w-full rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/45"
                                />
                                {workspaceOperatorLoading && <div className="mt-2 text-xs text-cyan-100/70">Loading known operators...</div>}
                                {workspaceOperatorError && <div className="mt-2 text-xs text-rose-200">{workspaceOperatorError}</div>}
                                {!workspaceOperatorLoading && !workspaceOperatorError && (
                                    <div className="mt-3 space-y-2">
                                        {filteredLaunchCoHosts.length > 0 ? filteredLaunchCoHosts.map((candidate) => {
                                            const active = launchCoHostUids.includes(candidate.uid);
                                            return (
                                                <button
                                                    key={candidate.uid}
                                                    type="button"
                                                    onClick={() => toggleLaunchCoHost(candidate.uid)}
                                                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${active ? 'border-cyan-300/45 bg-cyan-500/10' : 'border-white/10 bg-black/18 hover:border-cyan-300/30'}`}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold text-white">{candidate.name || candidate.email || candidate.uid}</div>
                                                        <div className="truncate text-[11px] text-cyan-100/66">{candidate.email || candidate.role || candidate.uid}</div>
                                                    </div>
                                                    <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${active ? 'bg-white text-black' : 'border border-white/10 bg-white/5 text-cyan-100/68'}`}>
                                                        {active ? 'Added' : 'Add'}
                                                    </span>
                                                </button>
                                            );
                                        }) : (
                                            <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-xs text-cyan-100/68">
                                                No matching operators found. You can still add co-hosts after the room is live.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </details>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs text-cyan-100/68">
                                {discoveryListingEnabled
                                    ? `Discover listing will use ${hasSelectedVenue ? 'the selected venue' : 'your typed venue'}${discoverVenueSummary ? ` in ${discoverVenueSummary}` : ''}.`
                                    : 'Room starts private by default. You can publish later.'}
                            </div>
                            <button
                                type="button"
                                onClick={() => handleStartLauncherRoom({ openNightSetup: false })}
                                disabled={launchDisabled}
                                className={`${STYLES.btnStd} ${STYLES.btnHighlight} min-w-[180px] px-5 py-3 text-sm uppercase tracking-[0.22em] ${launchDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                {creatingRoom ? 'Starting room...' : 'Start room'}
                            </button>
                        </div>

                        {entryError && (
                            <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-left text-xs text-rose-200">
                                <div>{entryError}</div>
                                <button type="button" onClick={retryLastHostAction} className="mt-2 inline-flex items-center rounded-full border border-rose-300/40 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-rose-100">
                                    Retry last action
                                </button>
                            </div>
                        )}
                        {hostUpdateDeploymentBanner && <div className="mt-3">{hostUpdateDeploymentBanner}</div>}
                    </div>
                    <div className="space-y-4">
                        <div className="rounded-[1.6rem] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(8,17,30,0.92),rgba(20,11,31,0.78))] p-4 text-left">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/68">Reopen Recent</div>
                                    <div className="mt-1 text-xl font-black text-white">Jump back into the last room fast.</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setLandingLaunchMode('advanced')}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1.5 text-[10px] uppercase tracking-[0.18em]`}
                                >
                                    View all / manage
                                </button>
                            </div>
                            <div className="mt-3 space-y-2.5">
                                {recentHostRoomsLoading ? (
                                    <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-xs text-cyan-100/72">
                                        Syncing recent rooms...
                                    </div>
                                ) : recentRoomSnapshot.length > 0 ? recentRoomSnapshot.map(renderRecentRoomCard) : (
                                    <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-3 text-xs text-cyan-100/68">
                                        No recent rooms yet. Your next launch will populate this shelf.
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 rounded-[1.15rem] border border-white/10 bg-black/18 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/70">Open by room code</div>
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                    <input
                                        value={roomCodeInput}
                                        onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && hasLaunchRoomCode) {
                                                joinRoom(launchRoomCodeCandidate);
                                            }
                                        }}
                                        placeholder="Enter room code"
                                        className="flex-1 rounded-xl border border-cyan-400/20 bg-black/25 px-3 py-2.5 text-sm uppercase tracking-[0.18em] text-white outline-none transition focus:border-cyan-300/45"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => joinRoom(launchRoomCodeCandidate)}
                                        disabled={!hasLaunchRoomCode || joiningRoom}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-[10px] uppercase tracking-[0.18em] ${!hasLaunchRoomCode || joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        Open
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,11,31,0.78),rgba(8,17,30,0.92))] p-4 text-left">
                            <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/68">After launch</div>
                            <div className="mt-1 text-xl font-black text-white">The rest can wait until the room is live.</div>
                            <div className="mt-3 space-y-2">
                                {checklistItems.map((item) => (
                                    <div key={item} className="flex items-start gap-2 text-sm text-cyan-50/84">
                                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {landingLaunchMode === 'advanced' && (
                    <div className="mt-4 rounded-[1.6rem] border border-fuchsia-300/14 bg-[linear-gradient(180deg,rgba(14,12,28,0.92),rgba(8,16,28,0.9))] p-4 text-left">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.24em] text-amber-100/72">Advanced Tools</div>
                                <div className="mt-1 text-xl font-black text-white">Room management, cleanup, and diagnostics.</div>
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
                            These controls stay available, but they live below the primary launch path so new-room creation stays fast.
                        </div>
                        {renderRecentRoomList({ managementMode: true })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HostRoomLaunchPad;
