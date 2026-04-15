import { useCallback } from 'react';

const useHostLaunchSession = ({
    fallbackLogoUrl = '',
    hostNightPreset = 'custom',
    nightSetupApplying = false,
    onboardingHostName = '',
    onboardingLogoUrl = '',
    onboardingWorkspaceName = '',
    openNightSetupWizard,
    provisionRoom,
    roomCode = '',
    setEntryError,
    setLandingLaunchMode,
    setOnboardingError,
    setOnboardingStep,
    setQuickStartChecklistProgress,
    setQuickStartChecklistRoomCode,
    setRoomCodeInput,
    setShowNightSetupWizard,
    setShowSettings,
    setNightSetupStep,
    setView,
}) => {
    const createRoom = useCallback(async (options = {}) => {
        const result = await provisionRoom({ ...options, openNightSetup: false });
        const shouldOpenNightSetup = options?.openNightSetup !== false;
        if (!result?.roomCode || !shouldOpenNightSetup) return result;
        openNightSetupWizard(
            String(options?.nightPresetId || '').trim()
            || String(result?.presetId || '').trim()
            || 'casual'
        );
        return result;
    }, [openNightSetupWizard, provisionRoom]);

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
            openNightSetup: true,
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

    const closeNightSetupWizard = useCallback(() => {
        if (nightSetupApplying) return;
        setShowNightSetupWizard(false);
        setNightSetupStep(0);
    }, [nightSetupApplying, setNightSetupStep, setShowNightSetupWizard]);

    const openHostRoomDashboard = useCallback(() => {
        setShowNightSetupWizard(false);
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
        setShowNightSetupWizard,
        setShowSettings,
        setView,
    ]);

    return {
        closeNightSetupWizard,
        createRoom,
        launchOnboardingRoom,
        openHostRoomDashboard,
    };
};

export default useHostLaunchSession;
