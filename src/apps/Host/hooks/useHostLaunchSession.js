import { useCallback } from 'react';

const useHostLaunchSession = ({
    fallbackLogoUrl = '',
    hostNightPreset = 'custom',
    onboardingHostName = '',
    onboardingLogoUrl = '',
    onboardingWorkspaceName = '',
    provisionRoom,
    roomCode = '',
    setEntryError,
    setLandingLaunchMode,
    setOnboardingError,
    setOnboardingStep,
    setQuickStartChecklistProgress,
    setQuickStartChecklistRoomCode,
    setRoomCodeInput,
    setShowSettings,
    setView,
}) => {
    const createRoom = useCallback(async (options = {}) => {
        // Room creation is fully configured by the consolidated launch screen.
        // Never fall through to the retired post-create Night Setup wizard.
        return provisionRoom({ ...options, openNightSetup: false });
    }, [provisionRoom]);

    const launchOnboardingRoom = useCallback(async () => {
        const trimmedHost = onboardingHostName.trim();
        const trimmedWorkspace = onboardingWorkspaceName.trim();
        const trimmedLogo = onboardingLogoUrl.trim();
        if (!trimmedHost || !trimmedWorkspace) {
            setOnboardingError('Identity and workspace details are required before launch.');
            setOnboardingStep(0);
            return;
        }
        setOnboardingError('');
        await createRoom({
            hostName: trimmedHost,
            orgName: trimmedWorkspace,
            logoUrl: trimmedLogo || fallbackLogoUrl,
            nightPresetId: hostNightPreset && hostNightPreset !== 'custom' ? hostNightPreset : 'casual',
            openNightSetup: false,
        });
    }, [
        createRoom,
        fallbackLogoUrl,
        hostNightPreset,
        onboardingHostName,
        onboardingLogoUrl,
        onboardingWorkspaceName,
        setOnboardingError,
        setOnboardingStep,
    ]);

    const openHostRoomDashboard = useCallback(() => {
        setShowSettings(false);
        setQuickStartChecklistRoomCode('');
        setQuickStartChecklistProgress({
            roomCode: '',
            tvOpened: false,
            joinLinkCopied: false,
            roomSetupOpened: false,
        });
        setLandingLaunchMode('start');
        setEntryError('');
        if (roomCode) {
            setRoomCodeInput(roomCode);
        }
        setView('landing');
    }, [
        roomCode,
        setEntryError,
        setLandingLaunchMode,
        setQuickStartChecklistProgress,
        setQuickStartChecklistRoomCode,
        setRoomCodeInput,
        setShowSettings,
        setView,
    ]);

    return {
        createRoom,
        launchOnboardingRoom,
        openHostRoomDashboard,
    };
};

export default useHostLaunchSession;
