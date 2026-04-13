import { useCallback, useMemo, useState } from 'react';
import { listHostWorkspaceOperators } from '../../../lib/firebase';

const useHostWorkspaceState = ({
    audienceBase,
    currentUid = '',
    hostBase,
    hostLogger,
    hostName = '',
    orgId = '',
    tvBase,
    uid = '',
}) => {
    const activeUid = String(currentUid || uid || '').trim();
    const [lastProvisionedLaunchUrls, setLastProvisionedLaunchUrls] = useState({
        roomCode: '',
        hostUrl: '',
        tvUrl: '',
        audienceUrl: '',
        updatedAtMs: 0,
    });
    const [entryError, setEntryError] = useState('');
    const [landingLaunchMode, setLandingLaunchMode] = useState('start');
    const [rawLaunchRoomName, setLaunchRoomName] = useState('');
    const [launchCoHostUids, setLaunchCoHostUids] = useState([]);
    const [showLaunchCoHosts, setShowLaunchCoHostsState] = useState(false);
    const [launchCoHostSearch, setLaunchCoHostSearch] = useState('');
    const [workspaceOperatorCandidates, setWorkspaceOperatorCandidates] = useState([]);
    const [workspaceOperatorLoading, setWorkspaceOperatorLoading] = useState(false);
    const [workspaceOperatorError, setWorkspaceOperatorError] = useState('');

    const launchRoomName = useMemo(() => {
        if (String(rawLaunchRoomName || '').trim()) return rawLaunchRoomName;
        const seededHost = String(hostName || '').trim();
        if (!seededHost) return '';
        return `${seededHost} Room`;
    }, [hostName, rawLaunchRoomName]);

    const refreshWorkspaceOperators = useCallback(async () => {
        if (!orgId || !activeUid) {
            setWorkspaceOperatorCandidates([]);
            setWorkspaceOperatorLoading(false);
            setWorkspaceOperatorError('');
            return;
        }
        setWorkspaceOperatorLoading(true);
        setWorkspaceOperatorError('');
        try {
            const result = await listHostWorkspaceOperators({ limit: 24 });
            const items = Array.isArray(result?.items) ? result.items : [];
            setWorkspaceOperatorCandidates(items);
        } catch (error) {
            hostLogger?.warn?.('Failed to load workspace operators', error);
            setWorkspaceOperatorCandidates([]);
            setWorkspaceOperatorError('Could not load co-host suggestions right now.');
        } finally {
            setWorkspaceOperatorLoading(false);
        }
    }, [activeUid, hostLogger, orgId]);

    const setShowLaunchCoHosts = useCallback((value) => {
        setShowLaunchCoHostsState((prev) => {
            const nextValue = typeof value === 'function' ? value(prev) : !!value;
            if (nextValue && !prev) {
                Promise.resolve().then(() => {
                    refreshWorkspaceOperators();
                });
            }
            return nextValue;
        });
    }, [refreshWorkspaceOperators]);

    const resolveLaunchUrlsForRoomCode = useCallback((candidateCode = '') => {
        const normalizedCode = String(candidateCode || '').trim().toUpperCase();
        if (!normalizedCode) {
            return {
                roomCode: '',
                hostUrl: '',
                tvUrl: '',
                audienceUrl: '',
                provisioned: false,
            };
        }
        const fallbackUrls = {
            roomCode: normalizedCode,
            hostUrl: `${hostBase}?mode=host&room=${encodeURIComponent(normalizedCode)}`,
            tvUrl: `${tvBase}?room=${encodeURIComponent(normalizedCode)}&mode=tv`,
            audienceUrl: `${audienceBase}?room=${encodeURIComponent(normalizedCode)}`,
            provisioned: false,
        };
        const provisionedRoomCode = String(lastProvisionedLaunchUrls?.roomCode || '').trim().toUpperCase();
        if (provisionedRoomCode !== normalizedCode) return fallbackUrls;
        return {
            roomCode: normalizedCode,
            hostUrl: lastProvisionedLaunchUrls.hostUrl || fallbackUrls.hostUrl,
            tvUrl: lastProvisionedLaunchUrls.tvUrl || fallbackUrls.tvUrl,
            audienceUrl: lastProvisionedLaunchUrls.audienceUrl || fallbackUrls.audienceUrl,
            provisioned: true,
        };
    }, [audienceBase, hostBase, lastProvisionedLaunchUrls, tvBase]);

    const toggleLaunchCoHost = useCallback((targetUid = '') => {
        const safeUid = String(targetUid || '').trim();
        if (!safeUid) return;
        setLaunchCoHostUids((prev) => (
            prev.includes(safeUid)
                ? prev.filter((entry) => entry !== safeUid)
                : [...prev, safeUid]
        ));
    }, []);

    const filteredLaunchCoHosts = useMemo(() => (
        workspaceOperatorCandidates
            .filter((candidate) => {
                const candidateUid = String(candidate?.uid || '').trim();
                return candidateUid && candidateUid !== String(currentUid || '').trim();
            })
            .filter((candidate) => {
                const query = String(launchCoHostSearch || '').trim().toLowerCase();
                if (!query) return true;
                const haystack = [
                    candidate?.name,
                    candidate?.email,
                    candidate?.uid,
                    candidate?.role,
                ].map((entry) => String(entry || '').toLowerCase()).join(' ');
                return haystack.includes(query);
            })
    ), [currentUid, launchCoHostSearch, workspaceOperatorCandidates]);

    return {
        lastProvisionedLaunchUrls,
        setLastProvisionedLaunchUrls,
        entryError,
        setEntryError,
        landingLaunchMode,
        setLandingLaunchMode,
        launchRoomName,
        setLaunchRoomName,
        launchCoHostUids,
        showLaunchCoHosts,
        setShowLaunchCoHosts,
        launchCoHostSearch,
        setLaunchCoHostSearch,
        workspaceOperatorLoading,
        workspaceOperatorError,
        resolveLaunchUrlsForRoomCode,
        toggleLaunchCoHost,
        filteredLaunchCoHosts,
    };
};

export default useHostWorkspaceState;
