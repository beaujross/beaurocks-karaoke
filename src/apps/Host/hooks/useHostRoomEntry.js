import { useCallback, useState } from 'react';
import { isRecoverableAppCheckError } from '../../../lib/appCheckErrors';

const EMPTY_QUICK_START_PROGRESS = {
    roomCode: '',
    tvOpened: false,
    joinLinkCopied: false,
    roomSetupOpened: false,
};

const useHostRoomEntry = ({
    roomCodeInput,
    ensureActiveUid,
    runWithAppCheckWarmup,
    assertRoomHostAccess,
    isMarketingDemoEmbed,
    callFunction,
    hostLogger,
    setRoomCode,
    setRoomCodeInput,
    setQuickStartChecklistRoomCode,
    setQuickStartChecklistProgress,
    setView,
    setEntryError,
    toast,
}) => {
    const [joiningRoom, setJoiningRoom] = useState(false);

    const applyJoinedRoomState = useCallback((code) => {
        setRoomCode(code);
        setRoomCodeInput(code);
        setQuickStartChecklistRoomCode('');
        setQuickStartChecklistProgress(EMPTY_QUICK_START_PROGRESS);
        setView('panel');
    }, [
        setQuickStartChecklistProgress,
        setQuickStartChecklistRoomCode,
        setRoomCode,
        setRoomCodeInput,
        setView,
    ]);

    const joinRoom = useCallback(async (candidateCode, options = {}) => {
        const silent = !!options?.silent;
        if (joiningRoom) return false;
        const code = String(candidateCode || roomCodeInput || '').trim().toUpperCase();
        if (!code) {
            if (!silent) {
                toast('Enter a room code first');
                setEntryError('Enter a room code first.');
            }
            return false;
        }

        setJoiningRoom(true);
        setEntryError('');
        try {
            const activeUid = await ensureActiveUid();
            if (!activeUid) {
                if (!silent) {
                    toast('Could not establish auth. Please retry.');
                    setEntryError('Could not establish auth. Retry and join again.');
                }
                return false;
            }

            await runWithAppCheckWarmup(
                () => assertRoomHostAccess(code),
                { scope: 'assertRoomHostAccess' }
            );

            applyJoinedRoomState(code);
            return true;
        } catch (error) {
            const errorCode = String(error?.code || '');
            if (silent && isMarketingDemoEmbed && errorCode.includes('not-found')) {
                try {
                    const sequence = Date.now();
                    await callFunction('runDemoDirectorAction', {
                        roomCode: code,
                        action: 'bootstrap',
                        actionId: `host_embed_bootstrap_${sequence}`,
                        sequence,
                        sceneId: 'karaoke_kickoff',
                        timelineMs: 0,
                        progress: 0,
                        playing: true,
                        crowdSize: 12,
                    });
                    await runWithAppCheckWarmup(
                        () => assertRoomHostAccess(code),
                        { scope: 'assertRoomHostAccess' }
                    );
                    applyJoinedRoomState(code);
                    return true;
                } catch (seedError) {
                    hostLogger.debug('Marketing demo embed room bootstrap failed', { roomCode: code, error: seedError });
                    applyJoinedRoomState(code);
                    return false;
                }
            }

            if (!silent) {
                if (errorCode.includes('not-found')) {
                    toast(`Room ${code} not found`);
                    setEntryError(`Room ${code} not found.`);
                } else if (errorCode.includes('permission-denied')) {
                    toast('Only room hosts can open host controls for this room.');
                    setEntryError('Only room hosts can open host controls for this room.');
                } else if (errorCode.includes('unauthenticated')) {
                    toast('You are signed out. Please retry auth, then open room again.');
                    setEntryError('You are signed out. Retry auth, then open room again.');
                } else if (isRecoverableAppCheckError(error)) {
                    toast('Security check is warming up. Please retry in a moment.');
                    setEntryError('Security check is warming up. Please retry in a moment.');
                } else if (errorCode.includes('unavailable') || errorCode.includes('network')) {
                    toast('Network issue while opening room. Please retry.');
                    setEntryError('Network issue while opening room. Please retry.');
                } else {
                    toast(`Failed to open room${errorCode ? ` (${errorCode})` : ''}`);
                    setEntryError(`Failed to open room${errorCode ? ` (${errorCode})` : ''}.`);
                }
            }
            return false;
        } finally {
            setJoiningRoom(false);
        }
    }, [
        applyJoinedRoomState,
        assertRoomHostAccess,
        callFunction,
        ensureActiveUid,
        hostLogger,
        isMarketingDemoEmbed,
        joiningRoom,
        roomCodeInput,
        runWithAppCheckWarmup,
        setEntryError,
        toast,
    ]);

    return {
        joiningRoom,
        joinRoom,
    };
};

export default useHostRoomEntry;
