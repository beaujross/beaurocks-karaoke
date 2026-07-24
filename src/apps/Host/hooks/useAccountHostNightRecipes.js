import { useEffect, useMemo, useRef, useState } from 'react';
import {
    auth,
    db,
    doc,
    onSnapshot,
    serverTimestamp,
    setDoc,
} from '../../../lib/firebase';
import {
    claimLegacyHostNightRecipeState,
    createHostNightRecipeSyncState,
    getHostNightRecipeStorageKey,
    getHostNightRecipeSyncFingerprint,
    isHostNightRecipeStorageScopeActive,
    loadHostNightRecipeSyncState,
    mergeHostNightRecipeSyncStates,
    persistHostNightRecipeSyncState,
    serializeHostNightRecipeSyncState,
} from '../hostNightRecipeSync';

const getSignedInAccountUid = (uid = '') => {
    const activeUser = auth.currentUser;
    const safeUid = String(activeUser?.uid || uid || '').trim();
    if (!safeUid || activeUser?.isAnonymous) return '';
    return safeUid;
};

const useAccountHostNightRecipes = ({
    uid = '',
    recipeState = createHostNightRecipeSyncState(),
    setRecipeState = () => {},
    logger = console,
} = {}) => {
    const [syncStatus, setSyncStatus] = useState('browser');
    const [remoteLoadedAccountUid, setRemoteLoadedAccountUid] = useState('');
    const recipeStateRef = useRef(recipeState);
    const activeAccountUidRef = useRef('');
    const remoteFingerprintRef = useRef('');
    const remoteLoadedRef = useRef(false);
    const signedInAccountUid = getSignedInAccountUid(uid);

    useEffect(() => {
        recipeStateRef.current = recipeState;
    }, [recipeState]);

    useEffect(() => {
        if (!isHostNightRecipeStorageScopeActive({
            activeAccountUid: activeAccountUidRef.current,
            signedInAccountUid,
        })) return;
        const storageKey = getHostNightRecipeStorageKey(signedInAccountUid);
        persistHostNightRecipeSyncState({
            state: recipeState,
            storageKey,
        });
    }, [recipeState, signedInAccountUid]);

    useEffect(() => {
        let unsubscribe = () => {};
        remoteLoadedRef.current = false;
        remoteFingerprintRef.current = '';

        if (!signedInAccountUid) {
            const browserState = loadHostNightRecipeSyncState();
            activeAccountUidRef.current = '';
            recipeStateRef.current = browserState;
            const browserFingerprint = getHostNightRecipeSyncFingerprint(browserState);
            setRecipeState((current) => (
                getHostNightRecipeSyncFingerprint(current) === browserFingerprint
                    ? current
                    : browserState
            ));
            return () => unsubscribe();
        }

        const storageKey = getHostNightRecipeStorageKey(signedInAccountUid);
        const scopedLocalState = loadHostNightRecipeSyncState({ storageKey });
        const legacyState = claimLegacyHostNightRecipeState({ accountUid: signedInAccountUid });
        const accountChanged = activeAccountUidRef.current !== signedInAccountUid;
        const localState = mergeHostNightRecipeSyncStates(
            scopedLocalState,
            legacyState,
            accountChanged ? createHostNightRecipeSyncState() : recipeStateRef.current
        );
        activeAccountUidRef.current = signedInAccountUid;
        recipeStateRef.current = localState;
        setRecipeState((current) => (
            getHostNightRecipeSyncFingerprint(current) === getHostNightRecipeSyncFingerprint(localState)
                ? current
                : localState
        ));

        try {
            unsubscribe = onSnapshot(
                doc(db, 'private_user_settings', signedInAccountUid),
                (snapshot) => {
                    if (activeAccountUidRef.current !== signedInAccountUid) return;
                    const remoteState = createHostNightRecipeSyncState(
                        snapshot.data()?.hostNightRecipes || {}
                    );
                    const mergedState = mergeHostNightRecipeSyncStates(
                        recipeStateRef.current,
                        remoteState
                    );
                    remoteFingerprintRef.current = getHostNightRecipeSyncFingerprint(remoteState);
                    remoteLoadedRef.current = true;
                    setRemoteLoadedAccountUid(signedInAccountUid);
                    recipeStateRef.current = mergedState;
                    const mergedFingerprint = getHostNightRecipeSyncFingerprint(mergedState);
                    setRecipeState((current) => (
                        getHostNightRecipeSyncFingerprint(current) === mergedFingerprint
                            ? current
                            : mergedState
                    ));
                    setSyncStatus(
                        mergedFingerprint === remoteFingerprintRef.current ? 'synced' : 'ready'
                    );
                },
                (error) => {
                    if (activeAccountUidRef.current !== signedInAccountUid) return;
                    logger?.debug?.('Could not load account Night Setup recipes', error);
                    setSyncStatus('error');
                }
            );
        } catch (error) {
            logger?.debug?.('Could not subscribe to account Night Setup recipes', error);
            queueMicrotask(() => setSyncStatus('error'));
        }

        return () => unsubscribe();
    }, [logger, setRecipeState, signedInAccountUid]);

    useEffect(() => {
        if (!signedInAccountUid || !remoteLoadedRef.current) return undefined;
        const localFingerprint = getHostNightRecipeSyncFingerprint(recipeState);
        if (localFingerprint === remoteFingerprintRef.current) {
            return undefined;
        }

        const timer = setTimeout(() => {
            setSyncStatus('syncing');
            setDoc(doc(db, 'private_user_settings', signedInAccountUid), {
                uid: signedInAccountUid,
                hostNightRecipes: serializeHostNightRecipeSyncState(recipeState),
                hostNightRecipesUpdatedAt: serverTimestamp(),
            }, { merge: true })
                .then(() => {
                    remoteFingerprintRef.current = localFingerprint;
                    setSyncStatus('synced');
                })
                .catch((error) => {
                    logger?.debug?.('Could not save account Night Setup recipes', error);
                    setSyncStatus('error');
                });
        }, 500);
        return () => clearTimeout(timer);
    }, [logger, recipeState, signedInAccountUid]);

    const storageLabel = useMemo(() => {
        if (!signedInAccountUid) return 'this Host browser';
        return 'your Host account';
    }, [signedInAccountUid]);

    const effectiveSyncStatus = !signedInAccountUid
        ? 'browser'
        : syncStatus === 'error'
            ? 'error'
            : remoteLoadedAccountUid === signedInAccountUid
                ? syncStatus
                : 'loading';

    return {
        accountUid: signedInAccountUid,
        isAccountBacked: !!signedInAccountUid,
        storageLabel,
        syncStatus: effectiveSyncStatus,
    };
};

export default useAccountHostNightRecipes;
