import { useCallback, useRef, useState } from 'react';
import { ASSETS } from '../../../lib/assets';
import { CAPABILITY_KEYS, getMissingCapabilityLabel } from '../../../billing/capabilities';
import { HOST_ONBOARDING_PLAN_OPTIONS } from '../hostAppData';
import {
    buildHostProvisionRequestId,
    buildProvisionDiscoveryPayload,
    normalizeProvisionLaunchUrls,
    isProvisionHostRoomCallableUnavailableError,
} from '../hostLaunchHelpers';

const nowMs = () => Date.now();

const useHostLaunchFlow = ({
    hostName,
    setHostName,
    logoUrl,
    setLogoUrl,
    hostNightPreset,
    orgContext,
    ensureActiveUid,
    syncOrgContextFromEntitlements,
    getMyEntitlements,
    provisionHostRoom,
    bootstrapOnboardingWorkspace,
    canUseWorkspaceOnboarding,
    subscriptionActionLoading,
    uid,
    authUid,
    hostLogger,
    setRoomCode,
    setRoomCodeInput,
    setTab,
    setShowSettings,
    setView,
    setLastProvisionedLaunchUrls,
    setQuickStartChecklistRoomCode,
    setQuickStartChecklistProgress,
    setEntryError,
    toast,
    trackEvent,
    hostRoomProvisionDeploymentWarning,
}) => {
    const roomProvisionRequestIdRef = useRef('');
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [quickLaunchDiscovery, setQuickLaunchDiscovery] = useState({
        publicRoom: false,
        virtualOnly: false,
        title: '',
        description: '',
        startsAtLocal: '',
        address1: '',
        city: '',
        state: '',
        lat: '',
        lng: ''
    });
    const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [onboardingBusy, setOnboardingBusy] = useState(false);
    const [onboardingError, setOnboardingError] = useState('');
    const [onboardingHostName, setOnboardingHostName] = useState(localStorage.getItem('bross_host_name') || 'Host');
    const [onboardingWorkspaceName, setOnboardingWorkspaceName] = useState('');
    const [onboardingPlanId, setOnboardingPlanId] = useState('host_monthly');
    const [onboardingLogoUrl, setOnboardingLogoUrl] = useState(ASSETS.logo);

    const createRoom = useCallback(async (options = {}) => {
        if (creatingRoom) return;
        const hostNameOverride = typeof options?.hostName === 'string' ? options.hostName.trim() : '';
        const orgNameOverride = typeof options?.orgName === 'string' ? options.orgName.trim() : '';
        const logoUrlOverride = typeof options?.logoUrl === 'string' ? options.logoUrl.trim() : '';
        const initialNightPresetId = typeof options?.nightPresetId === 'string' ? options.nightPresetId.trim() : '';
        const requestIdOverride = typeof options?.requestId === 'string' ? options.requestId.trim() : '';
        const discoveryDraft = { ...(quickLaunchDiscovery || {}) };
        const nextHostName = hostNameOverride || (hostName || '').trim() || 'Host';
        const nextOrgName = orgNameOverride || `${nextHostName} Workspace`;
        const nextLogoUrl = logoUrlOverride || (logoUrl || '').trim() || ASSETS.logo;
        const requestId = requestIdOverride
            || roomProvisionRequestIdRef.current
            || buildHostProvisionRequestId('host_launch');
        roomProvisionRequestIdRef.current = requestId;
        setCreatingRoom(true);
        setEntryError('');
        try {
            const activeUid = await ensureActiveUid();
            if (!activeUid) {
                toast('Could not establish auth. Please retry.');
                setEntryError('Could not establish auth. Retry and create room again.');
                roomProvisionRequestIdRef.current = '';
                return;
            }
            setHostName(nextHostName);
            setLogoUrl(nextLogoUrl);
            localStorage.setItem('bross_host_name', nextHostName);

            const result = await provisionHostRoom({
                requestId,
                hostName: nextHostName,
                orgName: nextOrgName,
                logoUrl: nextLogoUrl,
                nightPresetId: initialNightPresetId || (hostNightPreset && hostNightPreset !== 'custom' ? hostNightPreset : 'casual'),
                discoveryListing: buildProvisionDiscoveryPayload(discoveryDraft),
            });
            const nextRoomCode = String(result?.roomCode || '').trim().toUpperCase();
            if (!nextRoomCode) {
                throw new Error('Room provisioning did not return a room code.');
            }
            const normalizedLaunchUrls = normalizeProvisionLaunchUrls(result?.launchUrls || {});
            setLastProvisionedLaunchUrls({
                roomCode: nextRoomCode,
                hostUrl: normalizedLaunchUrls.hostUrl,
                tvUrl: normalizedLaunchUrls.tvUrl,
                audienceUrl: normalizedLaunchUrls.audienceUrl,
                updatedAtMs: nowMs(),
            });
            trackEvent('host_room_created', {
                room_code: nextRoomCode,
                provisioned: true,
                created: !!result?.created,
                idempotent: !!result?.idempotent,
            });
            try {
                const entitlements = await getMyEntitlements();
                syncOrgContextFromEntitlements(entitlements);
            } catch (orgSyncError) {
                hostLogger.debug('Entitlements refresh after room provision failed', orgSyncError);
            }
            setRoomCode(nextRoomCode);
            setRoomCodeInput(nextRoomCode);
            setQuickStartChecklistRoomCode(nextRoomCode);
            setQuickStartChecklistProgress({
                roomCode: nextRoomCode,
                tvOpened: false,
                joinLinkCopied: false,
                roomSetupOpened: false,
            });
            setShowSettings(false);
            setTab('stage');
            setView('panel');
            setShowOnboardingWizard(false);
            roomProvisionRequestIdRef.current = '';
            if (Array.isArray(result?.warnings) && result.warnings.includes('discovery_sync_failed')) {
                toast(`Room ${nextRoomCode} created. Discovery listing sync needs retry.`);
            } else if (result?.discovery?.isPublicRoom) {
                toast('Room created and public discovery listing is live.');
            } else if (result?.discovery) {
                toast('Room created and private discovery listing saved.');
            } else {
                toast(`Room ${nextRoomCode} created`);
            }
            return result;
        } catch (error) {
            hostLogger.error('Failed to create room', {
                error,
                propUid: uid || null,
                authUid: authUid || null
            });
            const code = String(error?.code || '');
            const codeLower = code.toLowerCase();
            const shouldReuseRequestId = (
                codeLower.includes('unavailable')
                || codeLower.includes('network')
                || codeLower.includes('deadline-exceeded')
                || codeLower.includes('aborted')
                || codeLower.includes('internal')
            );
            if (!shouldReuseRequestId) {
                roomProvisionRequestIdRef.current = '';
            }
            if (isProvisionHostRoomCallableUnavailableError(error)) {
                toast(hostRoomProvisionDeploymentWarning);
                setEntryError(hostRoomProvisionDeploymentWarning);
                return null;
            }
            if (code.includes('permission-denied')) {
                toast('Host access requires admin approval or an active host subscription.');
                setEntryError('Host access requires admin approval or an active host subscription.');
            } else if (code.includes('unauthenticated')) {
                toast('You are signed out. Please retry auth, then create room again.');
                setEntryError('You are signed out. Retry auth, then create room again.');
            } else if (code.includes('already-exists')) {
                toast('Requested room code already exists. Please retry.');
                setEntryError('Requested room code already exists. Please retry.');
            } else if (code.includes('unavailable') || code.includes('network')) {
                toast('Network issue while creating room. Please retry.');
                setEntryError('Network issue while creating room. Please retry.');
            } else {
                toast(`Failed to create room${code ? ` (${code})` : ''}`);
                setEntryError(`Failed to create room${code ? ` (${code})` : ''}.`);
            }
            return null;
        } finally {
            setCreatingRoom(false);
        }
    }, [
        creatingRoom,
        ensureActiveUid,
        getMyEntitlements,
        hostLogger,
        hostName,
        hostNightPreset,
        hostRoomProvisionDeploymentWarning,
        logoUrl,
        provisionHostRoom,
        quickLaunchDiscovery,
        setEntryError,
        setHostName,
        setLastProvisionedLaunchUrls,
        setLogoUrl,
        setRoomCode,
        setRoomCodeInput,
        setQuickStartChecklistRoomCode,
        setQuickStartChecklistProgress,
        setShowSettings,
        setView,
        setTab,
        syncOrgContextFromEntitlements,
        toast,
        trackEvent,
        uid,
        authUid,
    ]);

    const openOnboardingWizard = useCallback(() => {
        const seededHost = (hostName || '').trim() || 'Host';
        const seededLogo = (logoUrl || ASSETS.logo || '').trim() || ASSETS.logo;
        const allowedPlanIds = new Set(HOST_ONBOARDING_PLAN_OPTIONS.map((option) => option.id));
        const seededPlan = allowedPlanIds.has(orgContext?.planId) ? orgContext.planId : 'host_monthly';
        setOnboardingHostName(seededHost);
        setOnboardingWorkspaceName((onboardingWorkspaceName || '').trim() || `${seededHost} Workspace`);
        setOnboardingPlanId(seededPlan);
        setOnboardingLogoUrl(seededLogo);
        setOnboardingError('');
        setOnboardingStep(0);
        setShowOnboardingWizard(true);
    }, [hostName, logoUrl, onboardingWorkspaceName, orgContext?.planId]);

    const closeOnboardingWizard = useCallback(() => {
        if (onboardingBusy || creatingRoom || subscriptionActionLoading) return;
        setShowOnboardingWizard(false);
        setOnboardingStep(0);
        setOnboardingError('');
    }, [creatingRoom, onboardingBusy, subscriptionActionLoading]);

    const provisionOnboardingWorkspace = useCallback(async () => {
        if (!canUseWorkspaceOnboarding) {
            setOnboardingError(`${getMissingCapabilityLabel(CAPABILITY_KEYS.WORKSPACE_ONBOARDING)} is not available on this plan.`);
            return;
        }
        const trimmedHost = onboardingHostName.trim();
        const trimmedWorkspace = onboardingWorkspaceName.trim();
        if (!trimmedHost) {
            setOnboardingError('Host name is required.');
            return;
        }
        if (!trimmedWorkspace) {
            setOnboardingError('Workspace name is required.');
            return;
        }
        setOnboardingBusy(true);
        setOnboardingError('');
        try {
            const activeUid = await ensureActiveUid();
            if (!activeUid) {
                throw new Error('Auth unavailable');
            }
            const payload = await bootstrapOnboardingWorkspace({
                orgName: trimmedWorkspace,
                hostName: trimmedHost,
                logoUrl: onboardingLogoUrl
            });
            const entitlements = payload?.entitlements || await getMyEntitlements();
            syncOrgContextFromEntitlements(entitlements);
            setHostName(trimmedHost);
            localStorage.setItem('bross_host_name', trimmedHost);
            setOnboardingStep(1);
        } catch (error) {
            hostLogger.error('Onboarding workspace provision failed', error);
            const code = String(error?.code || '').toLowerCase();
            if (code.includes('permission-denied')) {
                setOnboardingError('Host access requires admin approval or an active host subscription.');
            } else {
                setOnboardingError('Could not initialize workspace. Please retry.');
            }
        } finally {
            setOnboardingBusy(false);
        }
    }, [
        bootstrapOnboardingWorkspace,
        canUseWorkspaceOnboarding,
        ensureActiveUid,
        getMyEntitlements,
        hostLogger,
        onboardingHostName,
        onboardingLogoUrl,
        onboardingWorkspaceName,
        setHostName,
        syncOrgContextFromEntitlements,
    ]);

    return {
        creatingRoom,
        createRoom,
        quickLaunchDiscovery,
        setQuickLaunchDiscovery,
        showOnboardingWizard,
        onboardingStep,
        onboardingBusy,
        onboardingError,
        onboardingHostName,
        onboardingWorkspaceName,
        onboardingPlanId,
        onboardingLogoUrl,
        setOnboardingHostName,
        setOnboardingWorkspaceName,
        setOnboardingPlanId,
        setOnboardingLogoUrl,
        setOnboardingStep,
        setOnboardingError,
        openOnboardingWizard,
        closeOnboardingWizard,
        provisionOnboardingWorkspace,
        syncOnboardingWorkspaceName(defaultHostName = 'Host') {
            setOnboardingWorkspaceName((current) => current.trim() || `${String(defaultHostName || 'Host').trim() || 'Host'} Workspace`);
        },
        syncOnboardingLogoUrl(defaultLogoUrl = ASSETS.logo) {
            setOnboardingLogoUrl((current) => {
                if (showOnboardingWizard) return current;
                return (defaultLogoUrl || ASSETS.logo || '').trim() || ASSETS.logo;
            });
        }
    };
};

export default useHostLaunchFlow;
