import { useCallback } from 'react';

const useHostWorkspaceNavigation = ({
    adminWorkspaceViews = [],
    getSectionMeta,
    getViewDefaultSection,
    handleSettingsNavSelect,
    hostWorkspaceSections = [],
    joinRoom,
    normalizeHostWorkspaceTab,
    roomCodeInput = '',
    sectionToSettingsTab = {},
    settingsTabToSection = {},
    setActiveWorkspaceSection,
    setActiveWorkspaceView,
    setSettingsNavOpen,
    setSettingsTab,
    setShowSettings,
    setTab,
    tab = '',
}) => {
    const resolveWorkspaceSection = useCallback((sectionId = 'ops.room_setup', { forceAdmin = false } = {}) => {
        const requested = String(sectionId || 'ops.room_setup').trim() || 'ops.room_setup';
        const directSectionMeta = getSectionMeta(requested);
        if (directSectionMeta) {
            if (forceAdmin && directSectionMeta.hostTab && !sectionToSettingsTab[requested]) {
                return hostWorkspaceSections.find((section) => section.view === directSectionMeta.view && !!sectionToSettingsTab[section.id])?.id || requested;
            }
            return requested;
        }
        if (settingsTabToSection[requested]) return settingsTabToSection[requested];
        const defaultSectionId = getViewDefaultSection(requested);
        if (defaultSectionId) {
            if (forceAdmin && !sectionToSettingsTab[defaultSectionId]) {
                return hostWorkspaceSections.find((section) => section.view === requested && !!sectionToSettingsTab[section.id])?.id || defaultSectionId;
            }
            return defaultSectionId;
        }
        return 'ops.room_setup';
    }, [getSectionMeta, getViewDefaultSection, hostWorkspaceSections, sectionToSettingsTab, settingsTabToSection]);

    const routeToWorkspaceSection = useCallback((sectionId = 'ops.room_setup', { forceAdmin = false } = {}) => {
        const targetSection = resolveWorkspaceSection(sectionId, { forceAdmin });
        const sectionMeta = getSectionMeta(targetSection);
        const viewId = sectionMeta?.view || 'ops';
        const mappedTab = sectionToSettingsTab[targetSection] || 'general';
        setActiveWorkspaceView(viewId);
        setActiveWorkspaceSection(targetSection);
        if (!forceAdmin && sectionMeta?.hostTab) {
            setSettingsNavOpen(false);
            setShowSettings(false);
            setTab(sectionMeta.hostTab);
            return;
        }
        setSettingsTab(mappedTab);
        setTab('admin');
        setShowSettings(true);
    }, [
        getSectionMeta,
        resolveWorkspaceSection,
        sectionToSettingsTab,
        setActiveWorkspaceSection,
        setActiveWorkspaceView,
        setSettingsNavOpen,
        setSettingsTab,
        setShowSettings,
        setTab,
    ]);

    const openAdminWorkspace = useCallback((sectionId = 'ops.room_setup') => {
        routeToWorkspaceSection(sectionId, { forceAdmin: true });
    }, [routeToWorkspaceSection]);

    const openExistingRoomWorkspace = useCallback(async (targetRoomCode = '', sectionId = 'queue.live_run') => {
        const normalizedCode = String(targetRoomCode || '').trim().toUpperCase();
        const joined = await joinRoom(normalizedCode || roomCodeInput);
        if (!joined) return false;
        if (sectionId) routeToWorkspaceSection(sectionId);
        return true;
    }, [joinRoom, roomCodeInput, routeToWorkspaceSection]);

    const leaveAdminWithTarget = useCallback((targetTab = 'stage') => {
        setSettingsNavOpen(false);
        setShowSettings(false);
        if (targetTab) setTab(targetTab);
        return true;
    }, [setSettingsNavOpen, setShowSettings, setTab]);

    const selectWorkspaceView = useCallback((viewId) => {
        const requestedView = String(viewId || 'ops').trim() || 'ops';
        const hasSettingsForView = adminWorkspaceViews.some((view) => view.id === requestedView);
        const nextView = hasSettingsForView ? requestedView : 'ops';
        const sectionId = resolveWorkspaceSection(nextView, { forceAdmin: true });
        const mappedTab = sectionToSettingsTab[sectionId] || 'general';
        setActiveWorkspaceView(nextView);
        setActiveWorkspaceSection(sectionId);
        setTab('admin');
        setSettingsTab(mappedTab);
        setShowSettings(true);
    }, [
        adminWorkspaceViews,
        resolveWorkspaceSection,
        sectionToSettingsTab,
        setActiveWorkspaceSection,
        setActiveWorkspaceView,
        setSettingsTab,
        setShowSettings,
        setTab,
    ]);

    const closeSettingsSurface = useCallback(() => {
        if (tab === 'admin') {
            leaveAdminWithTarget('stage');
            return;
        }
        setShowSettings(false);
        setSettingsNavOpen(false);
    }, [leaveAdminWithTarget, setSettingsNavOpen, setShowSettings, tab]);

    const handleTopChromeTabChange = useCallback((nextTab) => {
        const normalizedTab = normalizeHostWorkspaceTab(nextTab);
        if (normalizedTab !== 'admin') {
            setSettingsNavOpen(false);
            setShowSettings(false);
            const targetSection = hostWorkspaceSections.find((section) => section.hostTab === normalizedTab) || null;
            if (targetSection) {
                setActiveWorkspaceView(targetSection.view);
                setActiveWorkspaceSection(targetSection.id);
            }
        }
        setTab(normalizedTab);
    }, [
        hostWorkspaceSections,
        normalizeHostWorkspaceTab,
        setActiveWorkspaceSection,
        setActiveWorkspaceView,
        setSettingsNavOpen,
        setShowSettings,
        setTab,
    ]);

    const openChatSettings = useCallback(() => {
        setTab('admin');
        setActiveWorkspaceView('audience');
        setActiveWorkspaceSection('audience.chat');
        handleSettingsNavSelect('chat');
    }, [handleSettingsNavSelect, setActiveWorkspaceSection, setActiveWorkspaceView, setTab]);

    return {
        closeSettingsSurface,
        handleTopChromeTabChange,
        leaveAdminWithTarget,
        openAdminWorkspace,
        openChatSettings,
        openExistingRoomWorkspace,
        routeToWorkspaceSection,
        selectWorkspaceView,
    };
};

export default useHostWorkspaceNavigation;
