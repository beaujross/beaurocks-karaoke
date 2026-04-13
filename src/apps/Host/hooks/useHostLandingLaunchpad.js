import { useCallback, useEffect, useMemo, useState } from 'react';
import { CAPABILITY_KEYS, getMissingCapabilityLabel } from '../../../billing/capabilities';
import { searchHostVenueAutocomplete } from '../../../lib/firebase';
import { createQuickLaunchDiscoveryDraft } from '../hostLaunchHelpers';
import { canQuickStartForRole } from '../launchAccess';

const useHostLandingLaunchpad = ({
    entryError = '',
    authError = '',
    billingActionLoading = false,
    canUseWorkspaceOnboarding = false,
    createRoom,
    creatingRoom = false,
    hostName = '',
    hostNightPreset = 'custom',
    hostPermissionLevel = 'viewer',
    hostLogger,
    joiningRoom = false,
    joinRoom,
    launchCoHostUids = [],
    launchRoomName = '',
    openOnboardingWizard,
    orgContext,
    presetsById = {},
    quickLaunchDiscovery = {},
    recentHostRooms = [],
    room = {},
    roomCode = '',
    roomCodeInput = '',
    roomManagerBusyCode = '',
    routeToWorkspaceSection,
    setEntryError,
    setQuickLaunchDiscovery,
    subscriptionActionLoading = false,
    toast,
    uid = '',
}) => {
    const [showLandingListingOptions, setShowLandingListingOptions] = useState(false);
    const [venueSearchResults, setVenueSearchResults] = useState([]);
    const [venueSearchLoading, setVenueSearchLoading] = useState(false);
    const [venueSearchError, setVenueSearchError] = useState('');

    useEffect(() => {
        if (!quickLaunchDiscovery.publicRoom) {
            setVenueSearchResults([]);
            setVenueSearchLoading(false);
            setVenueSearchError('');
            return undefined;
        }
        const queryText = String(quickLaunchDiscovery.venueName || '').trim();
        if (queryText.length < 2) {
            setVenueSearchResults([]);
            setVenueSearchLoading(false);
            setVenueSearchError('');
            return undefined;
        }
        let cancelled = false;
        const timeoutId = window.setTimeout(async () => {
            setVenueSearchLoading(true);
            setVenueSearchError('');
            try {
                const result = await searchHostVenueAutocomplete({ query: queryText, limit: 6 });
                if (cancelled) return;
                setVenueSearchResults(Array.isArray(result?.items) ? result.items : []);
            } catch (error) {
                if (cancelled) return;
                hostLogger?.warn?.('Venue autocomplete search failed', error);
                setVenueSearchResults([]);
                setVenueSearchError('Could not load venue matches right now.');
            } finally {
                if (!cancelled) setVenueSearchLoading(false);
            }
        }, 220);
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [hostLogger, quickLaunchDiscovery.publicRoom, quickLaunchDiscovery.venueName]);

    const shouldShowSetupCard = useMemo(() => {
        const hasWorkspaceIdentity = Boolean(String(orgContext?.orgId || '').trim());
        return canUseWorkspaceOnboarding && !hasWorkspaceIdentity;
    }, [canUseWorkspaceOnboarding, orgContext?.orgId]);

    const canQuickStartRoom = useMemo(() => {
        const hasWorkspaceIdentity = Boolean(String(orgContext?.orgId || '').trim());
        const hasHostIdentity = Boolean(String(hostName || '').trim());
        return hasWorkspaceIdentity && hasHostIdentity && canQuickStartForRole(hostPermissionLevel);
    }, [hostName, hostPermissionLevel, orgContext?.orgId]);

    const launchRoomCodeCandidate = useMemo(() => (
        String(roomCodeInput || roomCode || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
    ), [roomCode, roomCodeInput]);

    const hasLaunchRoomCode = launchRoomCodeCandidate.length >= 4 && launchRoomCodeCandidate.length <= 10;
    const authPending = !uid && !authError;
    const launchAccessPending = (authPending || (!!uid && orgContext?.loading) || billingActionLoading || !!subscriptionActionLoading) && !authError;
    const primaryLaunchDisabled = creatingRoom || joiningRoom || !!roomManagerBusyCode || launchAccessPending;

    const launchState = useMemo(() => {
        const roomClosed = Boolean(room?.closedAt);
        const roomPaused = Boolean(room?.paused || room?.isPaused || String(room?.activeMode || '').toLowerCase() === 'paused');
        if (entryError) return 'Error';
        if (launchAccessPending) return 'Syncing';
        if (creatingRoom || joiningRoom) return 'Starting';
        if (roomClosed) return 'Ended';
        if (roomPaused) return 'Paused';
        if (roomCode && hasLaunchRoomCode && String(roomCode).toUpperCase() === launchRoomCodeCandidate) return 'Live';
        if (hasLaunchRoomCode) return 'Ready';
        return 'Idle';
    }, [creatingRoom, entryError, hasLaunchRoomCode, joiningRoom, launchAccessPending, launchRoomCodeCandidate, room, roomCode]);

    const launchStateTone = useMemo(() => {
        switch (launchState) {
        case 'Syncing':
            return 'border-cyan-300/40 bg-cyan-500/12 text-cyan-100';
        case 'Starting':
            return 'border-cyan-300/40 bg-cyan-500/15 text-cyan-100';
        case 'Live':
            return 'border-emerald-300/45 bg-emerald-500/15 text-emerald-100';
        case 'Paused':
            return 'border-amber-300/45 bg-amber-500/15 text-amber-100';
        case 'Ended':
            return 'border-zinc-300/40 bg-zinc-500/12 text-zinc-100';
        case 'Error':
            return 'border-rose-300/45 bg-rose-500/15 text-rose-100';
        case 'Ready':
            return 'border-indigo-300/45 bg-indigo-500/15 text-indigo-100';
        default:
            return 'border-zinc-500/35 bg-zinc-500/10 text-zinc-200';
        }
    }, [launchState]);

    const launchStateHelp = useMemo(() => {
        switch (launchState) {
        case 'Syncing':
            return 'Checking auth, workspace access, and room tools.';
        case 'Starting':
            return 'Provisioning room and host controls.';
        case 'Live':
            return `Room ${launchRoomCodeCandidate} is active.`;
        case 'Paused':
            return 'Room is paused. Resume or reopen controls.';
        case 'Ended':
            return 'Room session ended. Create or reopen a room.';
        case 'Error':
            return 'Last launch action failed. Retry or use troubleshooting.';
        case 'Ready':
            return `Room ${launchRoomCodeCandidate} is ready to open.`;
        default:
            return 'Create a room or enter a room code to begin.';
        }
    }, [launchRoomCodeCandidate, launchState]);

    const discoveryListingEnabled = !!quickLaunchDiscovery.publicRoom;
    const landingListingDetailsOpen = showLandingListingOptions || Boolean(
        String(quickLaunchDiscovery.address1 || '').trim()
        || String(quickLaunchDiscovery.lat || '').trim()
        || String(quickLaunchDiscovery.lng || '').trim()
    );
    const recentRoomSnapshot = useMemo(() => recentHostRooms.slice(0, 3), [recentHostRooms]);
    const launchRoomNameValue = String(launchRoomName || '').trim();
    const resolvedLaunchPresetId = presetsById[hostNightPreset] ? hostNightPreset : 'casual';
    const selectedLaunchPreset = presetsById[resolvedLaunchPresetId] || presetsById.casual || null;
    const canStartLauncherRoom = !!launchRoomNameValue && canQuickStartRoom && !primaryLaunchDisabled;
    const discoverVenueSummary = [
        String(quickLaunchDiscovery.city || '').trim(),
        String(quickLaunchDiscovery.state || '').trim(),
    ].filter(Boolean).join(', ');
    const selectedVenueSource = String(quickLaunchDiscovery.venueSource || '').trim().toLowerCase();
    const hasSelectedVenue = !!String(quickLaunchDiscovery.venueId || '').trim() && selectedVenueSource === 'selected';

    const setDiscoveryListingMode = useCallback((enabled) => {
        if (enabled) {
            setQuickLaunchDiscovery((prev) => createQuickLaunchDiscoveryDraft({
                ...prev,
                publicRoom: true,
            }));
            return;
        }
        setQuickLaunchDiscovery(createQuickLaunchDiscoveryDraft());
    }, [setQuickLaunchDiscovery]);

    const handleLaunchVenueInputChange = useCallback((value = '') => {
        const nextValue = String(value || '');
        setQuickLaunchDiscovery((prev) => createQuickLaunchDiscoveryDraft({
            ...prev,
            venueName: nextValue,
            venueId: '',
            venueSource: nextValue.trim() ? 'freeform' : '',
        }));
    }, [setQuickLaunchDiscovery]);

    const selectLaunchVenueMatch = useCallback((venue = {}) => {
        const venueId = String(venue?.venueId || '').trim();
        const title = String(venue?.title || '').trim();
        const city = String(venue?.city || '').trim();
        const state = String(venue?.state || '').trim();
        const address1 = String(venue?.address1 || '').trim();
        const lat = Number(venue?.location?.lat);
        const lng = Number(venue?.location?.lng);
        setQuickLaunchDiscovery((prev) => createQuickLaunchDiscoveryDraft({
            ...prev,
            venueName: title,
            venueId,
            venueSource: venueId ? 'selected' : 'freeform',
            city: city || prev.city || '',
            state: state || prev.state || '',
            address1: address1 || prev.address1 || '',
            lat: Number.isFinite(lat) ? String(lat) : (prev.lat || ''),
            lng: Number.isFinite(lng) ? String(lng) : (prev.lng || ''),
        }));
        setVenueSearchResults([]);
        setVenueSearchError('');
    }, [setQuickLaunchDiscovery]);

    const handleStartLauncherRoom = useCallback(async ({ openNightSetup = false, launchTarget = 'stage' } = {}) => {
        if (primaryLaunchDisabled) return;
        if (!launchRoomNameValue) {
            toast('Add a room name before starting.');
            setEntryError('Add a room name before starting.');
            return;
        }
        if (!canQuickStartRoom) {
            if (canUseWorkspaceOnboarding) {
                toast('Finish host setup first, then start the room.');
                openOnboardingWizard();
                return;
            }
            toast(`${getMissingCapabilityLabel(CAPABILITY_KEYS.WORKSPACE_ONBOARDING)} is not enabled for this workspace.`);
            return;
        }
        setEntryError('');
        const result = await createRoom({
            roomName: launchRoomNameValue,
            coHostUids: launchCoHostUids,
            nightPresetId: resolvedLaunchPresetId,
            preferredRoomCode: hasLaunchRoomCode ? launchRoomCodeCandidate : '',
            openNightSetup,
        });
        if (!result?.roomCode || openNightSetup) return;
        if (launchTarget === 'show') {
            routeToWorkspaceSection('show.timeline');
            return;
        }
        if (launchTarget === 'settings') {
            routeToWorkspaceSection('ops.room_setup', { forceAdmin: true });
            return;
        }
        routeToWorkspaceSection('queue.live_run');
    }, [
        canQuickStartRoom,
        canUseWorkspaceOnboarding,
        createRoom,
        hasLaunchRoomCode,
        launchCoHostUids,
        launchRoomCodeCandidate,
        launchRoomNameValue,
        openOnboardingWizard,
        primaryLaunchDisabled,
        resolvedLaunchPresetId,
        routeToWorkspaceSection,
        setEntryError,
        toast,
    ]);

    const retryLastHostAction = useCallback(async () => {
        if (creatingRoom || joiningRoom || roomManagerBusyCode) return;
        if (hasLaunchRoomCode) {
            await joinRoom(launchRoomCodeCandidate);
            return;
        }
        if (canQuickStartRoom) {
            await createRoom({ openNightSetup: false });
            return;
        }
        if (canUseWorkspaceOnboarding) {
            openOnboardingWizard();
            return;
        }
        toast(`${getMissingCapabilityLabel(CAPABILITY_KEYS.WORKSPACE_ONBOARDING)} is not enabled for this workspace.`);
    }, [
        canQuickStartRoom,
        canUseWorkspaceOnboarding,
        createRoom,
        creatingRoom,
        hasLaunchRoomCode,
        joinRoom,
        joiningRoom,
        launchRoomCodeCandidate,
        openOnboardingWizard,
        roomManagerBusyCode,
        toast,
    ]);

    return {
        canStartLauncherRoom,
        discoveryListingEnabled,
        discoverVenueSummary,
        handleLaunchVenueInputChange,
        handleStartLauncherRoom,
        hasLaunchRoomCode,
        hasSelectedVenue,
        landingListingDetailsOpen,
        launchAccessPending,
        launchRoomCodeCandidate,
        launchState,
        launchStateHelp,
        launchStateTone,
        recentRoomSnapshot,
        resolvedLaunchPresetId,
        retryLastHostAction,
        selectLaunchVenueMatch,
        selectedLaunchPreset,
        setDiscoveryListingMode,
        setShowLandingListingOptions,
        shouldShowSetupCard,
        venueSearchError,
        venueSearchLoading,
        venueSearchResults,
    };
};

export default useHostLandingLaunchpad;
