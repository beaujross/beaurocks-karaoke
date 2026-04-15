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
    setActiveWorkspaceSection,
    setActiveWorkspaceView,
    setSettingsNavOpen,
    setSettingsTab,
    setShowSettings,
    setTab,
    tab = '',
}) => {
    const routeToWorkspaceSection = useCallback((sectionId = 'ops.room_setup', { forceAdmin = false } = {}) => {
        const targetSection = sectionId || 'ops.room_setup';
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
        const defaultSectionId = getViewDefaultSection(nextView);
        const sectionId = sectionToSettingsTab[defaultSectionId]
            ? defaultSectionId
            : (
                hostWorkspaceSections.find((section) =>
                    section.view === nextView && !!sectionToSettingsTab[section.id]
                )?.id || 'ops.room_setup'
            );
        const mappedTab = sectionToSettingsTab[sectionId] || 'general';
        setActiveWorkspaceView(nextView);
        setActiveWorkspaceSection(sectionId);
        setTab('admin');
        setSettingsTab(mappedTab);
        setShowSettings(true);
    }, [
        adminWorkspaceViews,
        getViewDefaultSection,
        hostWorkspaceSections,
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
        setTab(normalizeHostWorkspaceTab(nextTab));
    }, [normalizeHostWorkspaceTab, setTab]);

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
