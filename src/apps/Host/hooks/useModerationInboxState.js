import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    db,
    collection,
    query,
    where,
    onSnapshot,
    serverTimestamp
} from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';
import { createLogger } from '../../../lib/logger';
import {
    buildModerationQueueSnapshot,
    deriveModerationSeverity,
    moderationNeedsAttention
} from '../moderationInboxLogic.js';

const moderationLogger = createLogger('HostModerationInbox');
const nowMs = () => Date.now();

const toMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
};
export { buildModerationQueueSnapshot, deriveModerationSeverity, moderationNeedsAttention };

const useModerationInboxState = ({
    roomCode = '',
    room = {},
    updateRoom,
    callFunction,
    toast
} = {}) => {
    const [doodleSubmissions, setDoodleSubmissions] = useState([]);
    const [selfieSubmissions, setSelfieSubmissions] = useState([]);
    const [busyAction, setBusyAction] = useState('');
    const [doodleLoading, setDoodleLoading] = useState(false);
    const [selfieLoading, setSelfieLoading] = useState(false);

    const doodle = room?.doodleOke || null;
    const selfie = room?.selfieChallenge || null;
    const doodlePromptId = doodle?.promptId || '';
    const selfiePromptId = selfie?.promptId || '';
    const doodleRequireReview = !!doodle?.requireReview;
    const selfieRequireApproval = !!selfie?.requireApproval;
    const approvedUids = useMemo(() => (
        Array.isArray(doodle?.approvedUids) ? doodle.approvedUids.filter(Boolean) : []
    ), [doodle?.approvedUids]);

    useEffect(() => {
        if (!roomCode || !doodlePromptId) {
            setDoodleSubmissions([]);
            setDoodleLoading(false);
            return;
        }
        setDoodleLoading(true);
        const submissionsQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'doodle_submissions'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', doodlePromptId)
        );
        const unsub = onSnapshot(
            submissionsQuery,
            (snap) => {
                const docs = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
                docs.sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp));
                setDoodleSubmissions(docs);
                setDoodleLoading(false);
            },
            (error) => {
                moderationLogger.error('Failed to watch doodle submissions', error);
                setDoodleSubmissions([]);
                setDoodleLoading(false);
            }
        );
        return () => unsub();
    }, [roomCode, doodlePromptId]);

    useEffect(() => {
        if (!roomCode || !selfiePromptId) {
            setSelfieSubmissions([]);
            setSelfieLoading(false);
            return;
        }
        setSelfieLoading(true);
        const submissionsQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_submissions'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', selfiePromptId)
        );
        const unsub = onSnapshot(
            submissionsQuery,
            (snap) => {
                const docs = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
                docs.sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp));
                setSelfieSubmissions(docs);
                setSelfieLoading(false);
            },
            (error) => {
                moderationLogger.error('Failed to watch selfie submissions', error);
                setSelfieSubmissions([]);
                setSelfieLoading(false);
            }
        );
        return () => unsub();
    }, [roomCode, selfiePromptId]);

    const snapshot = useMemo(() => buildModerationQueueSnapshot({
        doodleRequireReview,
        selfieRequireApproval,
        approvedUids,
        doodleSubmissions,
        selfieSubmissions,
        bingoSuggestions: room?.bingoSuggestions || {},
        bingoRevealed: room?.bingoRevealed || {}
    }), [
        doodleRequireReview,
        selfieRequireApproval,
        approvedUids,
        doodleSubmissions,
        selfieSubmissions,
        room?.bingoSuggestions,
        room?.bingoRevealed
    ]);

    const severity = useMemo(() => deriveModerationSeverity({
        totalPending: snapshot.counts.totalPending,
        oldestPendingAt: snapshot.oldestPendingAt
    }), [snapshot.counts.totalPending, snapshot.oldestPendingAt]);
    const needsAttention = moderationNeedsAttention(severity);
    const safeToast = useCallback((message) => {
        if (typeof toast === 'function') toast(message);
    }, [toast]);

    const approveDoodleUid = useCallback(async (uid = '') => {
        const normalizedUid = String(uid || '').trim();
        if (!normalizedUid || typeof updateRoom !== 'function') return;
        const activeDoodle = room?.doodleOke;
        if (!activeDoodle) return;
        setBusyAction('doodle-approve');
        try {
            const nextApproved = Array.from(new Set([
                ...(Array.isArray(activeDoodle.approvedUids) ? activeDoodle.approvedUids : []),
                normalizedUid
            ]));
            await updateRoom({
                doodleOke: {
                    ...activeDoodle,
                    approvedUids: nextApproved,
                    updatedAt: nowMs()
                }
            });
            safeToast('Sketch approved for TV');
        } catch (error) {
            moderationLogger.error('Could not approve doodle submission', error);
            safeToast('Could not update doodle moderation');
        } finally {
            setBusyAction('');
        }
    }, [room?.doodleOke, updateRoom, safeToast]);

    const approveSelfieSubmission = useCallback(async (submission = {}) => {
        const submissionId = String(submission?.id || '').trim();
        if (!roomCode || !submissionId || typeof callFunction !== 'function') return;
        setBusyAction(`selfie-${submissionId}`);
        try {
            await callFunction('setSelfieSubmissionApproval', {
                roomCode,
                submissionId,
                approved: true
            });
            safeToast('Selfie approved');
        } catch (error) {
            moderationLogger.error('Could not approve selfie submission', error);
            safeToast('Could not approve selfie');
        } finally {
            setBusyAction('');
        }
    }, [roomCode, callFunction, safeToast]);

    const approveBingoSuggestion = useCallback(async (idx) => {
        const tileIndex = Number(idx);
        if (!Number.isFinite(tileIndex) || typeof updateRoom !== 'function') return;
        setBusyAction(`bingo-approve-${tileIndex}`);
        try {
            await updateRoom({
                [`bingoRevealed.${tileIndex}`]: true,
                [`bingoSuggestions.${tileIndex}.approvedAt`]: serverTimestamp()
            });
            safeToast(`Bingo tile #${tileIndex + 1} approved`);
        } catch (error) {
            moderationLogger.error('Could not approve bingo suggestion', error);
            safeToast('Could not approve bingo suggestion');
        } finally {
            setBusyAction('');
        }
    }, [updateRoom, safeToast]);

    const clearBingoSuggestion = useCallback(async (idx) => {
        const tileIndex = Number(idx);
        if (!Number.isFinite(tileIndex) || typeof updateRoom !== 'function') return;
        setBusyAction(`bingo-clear-${tileIndex}`);
        try {
            await updateRoom({
                [`bingoSuggestions.${tileIndex}.count`]: 0,
                [`bingoSuggestions.${tileIndex}.lastNote`]: '',
                [`bingoSuggestions.${tileIndex}.lastAt`]: null
            });
            safeToast(`Bingo tile #${tileIndex + 1} cleared`);
        } catch (error) {
            moderationLogger.error('Could not clear bingo suggestion', error);
            safeToast('Could not clear bingo suggestion');
        } finally {
            setBusyAction('');
        }
    }, [updateRoom, safeToast]);

    return {
        queueItems: snapshot.queueItems,
        counts: snapshot.counts,
        actions: {
            approveDoodleUid,
            approveSelfieSubmission,
            approveBingoSuggestion,
            clearBingoSuggestion
        },
        meta: {
            oldestPendingAt: snapshot.oldestPendingAt,
            busyAction,
            loading: doodleLoading || selfieLoading,
            severity,
            needsAttention
        }
    };
};

export default useModerationInboxState;
