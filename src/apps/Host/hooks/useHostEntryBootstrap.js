import { useEffect } from 'react';

const useHostEntryBootstrap = ({
    createQuickLaunchDiscoveryDraft,
    getViewDefaultSection,
    hostOnboardingPlanOptions = [],
    legacyTabRedirects = {},
    normalizeGameParam,
    normalizeLaunchRoomCode,
    openModerationInbox,
    openOnboardingWizard,
    parseLaunchBoolParam,
    sectionToSettingsTab = {},
    setActiveWorkspaceSection,
    setActiveWorkspaceView,
    setAutoOpenGameId,
    setCatalogueOnly,
    setLandingLaunchMode,
    setLobbyTab,
    setOnboardingPlanId,
    setOnboardingStep,
    setQuickLaunchDiscovery,
    setRoomCodeInput,
    setSettingsTab,
    setTab,
}) => {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        const c = params.get('catalogue');
        const chat = params.get('chat');
        const onboarding = String(params.get('onboarding') || '').toLowerCase();
        const plan = String(params.get('plan') || '').trim();
        const launchRoomCode = normalizeLaunchRoomCode(params.get('launch_room_code'));
        const launchPublicRoom = parseLaunchBoolParam(params.get('launch_public_room'));
        const launchVirtualOnly = parseLaunchBoolParam(params.get('launch_virtual_only'));
        const launchTitle = String(params.get('launch_title') || '').trim();
        const launchDescription = String(params.get('launch_description') || '').trim();
        const launchStartsAt = String(params.get('launch_starts_at') || '').trim();
        const launchCity = String(params.get('launch_city') || '').trim();
        const launchState = String(params.get('launch_state') || '').trim();
        const view = (params.get('view') || '').trim().toLowerCase();
        const section = (params.get('section') || '').trim().toLowerCase();
        const g = normalizeGameParam(params.get('game'));
        let consumedMarketingOnboardingParams = false;
        if (view) {
            const chosenSection = section || getViewDefaultSection(view);
            setActiveWorkspaceView(view);
            setActiveWorkspaceSection(chosenSection);
            if (view === 'queue') {
                setTab('stage');
                if (chosenSection === 'queue.catalog') setTab('browse');
            } else if (view === 'show') {
                setTab('run_of_show');
            } else if (view === 'games') {
                setTab('games');
            } else if (view === 'audience') {
                setTab('lobby');
            } else {
                setTab('admin');
                const mappedTab = sectionToSettingsTab[chosenSection] || 'general';
                setSettingsTab(mappedTab);
            }
        } else if (t === 'photos') {
            setTab('lobby');
            setLobbyTab('users');
            openModerationInbox();
        } else if (t === 'qa') {
            setTab('admin');
            setSettingsTab('qa');
            setActiveWorkspaceView('advanced');
            setActiveWorkspaceSection('advanced.diagnostics');
        } else if (g) {
            setTab('games');
            setAutoOpenGameId(g);
        } else if (t && ['stage', 'run_of_show', 'games', 'lobby', 'browse', 'admin'].includes(t)) {
            setTab(t);
            const redirect = legacyTabRedirects[t];
            if (redirect) {
                setActiveWorkspaceView(redirect.view);
                setActiveWorkspaceSection(redirect.section);
            }
            if (t === 'admin') {
                setActiveWorkspaceView('ops');
                setActiveWorkspaceSection('ops.room_setup');
                setSettingsTab('general');
            }
        }
        if (c === '1') setCatalogueOnly(true);
        if (chat === '1') setTab('stage');
        if (onboarding === '1' || onboarding === 'true') {
            const allowedPlanIds = new Set(hostOnboardingPlanOptions.map((option) => option.id));
            const chosenPlan = allowedPlanIds.has(plan) ? plan : 'host_monthly';
            openOnboardingWizard();
            setOnboardingPlanId(chosenPlan);
            setOnboardingStep(0);
            consumedMarketingOnboardingParams = true;
        }
        if (
            launchRoomCode
            || launchPublicRoom
            || launchVirtualOnly
            || launchTitle
            || launchDescription
            || launchStartsAt
            || launchCity
            || launchState
        ) {
            if (launchRoomCode) {
                setRoomCodeInput(launchRoomCode);
            }
            setLandingLaunchMode(
                launchRoomCode && !launchPublicRoom && !launchVirtualOnly && !launchTitle && !launchDescription && !launchStartsAt && !launchCity && !launchState
                    ? 'resume'
                    : 'advanced'
            );
            setQuickLaunchDiscovery(createQuickLaunchDiscoveryDraft({
                ...(launchTitle ? { title: launchTitle } : {}),
                ...(launchDescription ? { description: launchDescription } : {}),
                ...(launchStartsAt ? { startsAtLocal: launchStartsAt } : {}),
                ...(launchCity ? { city: launchCity } : {}),
                ...(launchState ? { state: launchState } : {}),
                ...(launchPublicRoom ? { publicRoom: true } : {}),
                ...(launchVirtualOnly ? { virtualOnly: true } : {}),
            }));
            consumedMarketingOnboardingParams = true;
        }
        if (consumedMarketingOnboardingParams) {
            params.delete('onboarding');
            params.delete('plan');
            params.delete('source');
            params.delete('launch_room_code');
            params.delete('launch_public_room');
            params.delete('launch_virtual_only');
            params.delete('launch_title');
            params.delete('launch_description');
            params.delete('launch_starts_at');
            params.delete('launch_city');
            params.delete('launch_state');
            const nextQuery = params.toString();
            const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
            window.history.replaceState({}, '', nextUrl);
        }
    }, [
        createQuickLaunchDiscoveryDraft,
        getViewDefaultSection,
        hostOnboardingPlanOptions,
        legacyTabRedirects,
        normalizeGameParam,
        normalizeLaunchRoomCode,
        openModerationInbox,
        openOnboardingWizard,
        parseLaunchBoolParam,
        sectionToSettingsTab,
        setActiveWorkspaceSection,
        setActiveWorkspaceView,
        setAutoOpenGameId,
        setCatalogueOnly,
        setLandingLaunchMode,
        setLobbyTab,
        setOnboardingPlanId,
        setOnboardingStep,
        setQuickLaunchDiscovery,
        setRoomCodeInput,
        setSettingsTab,
        setTab,
    ]);
};

export default useHostEntryBootstrap;
