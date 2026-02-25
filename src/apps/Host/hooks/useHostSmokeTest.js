import { useCallback, useState } from 'react';
import {
    db,
    doc,
    getDoc,
    getDocs,
    query,
    collection,
    where,
    limit,
    setDoc,
    serverTimestamp,
    deleteDoc
} from '../../../lib/firebase';
import { APP_ID } from '../../../lib/assets';

const normalizeResult = (label, status, detail) => ({ label, status, detail });

const safeWriteClipboard = async (text) => {
    if (!navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
};

const useHostSmokeTest = ({
    roomCode,
    room,
    users,
    queuedSongs,
    currentSong,
    uid,
    toast
}) => {
    const [smokeRunning, setSmokeRunning] = useState(false);
    const [smokeResults, setSmokeResults] = useState([]);
    const [smokeIncludeWrite, setSmokeIncludeWrite] = useState(false);

    const copySnapshot = useCallback(async () => {
        const payload = {
            roomCode,
            room: room || null,
            users: users?.length || 0,
            queuedSongs: queuedSongs?.length || 0,
            currentSong: currentSong
                ? { title: currentSong.songTitle, singer: currentSong.singerName }
                : null
        };
        try {
            await safeWriteClipboard(JSON.stringify(payload, null, 2));
            toast('QA snapshot copied');
        } catch {
            toast('Copy failed');
        }
    }, [roomCode, room, users?.length, queuedSongs?.length, currentSong, toast]);

    const runSmokeTest = useCallback(async () => {
        if (!roomCode) {
            setSmokeResults([normalizeResult('Room code', 'fail', 'No room code set')]);
            return;
        }
        setSmokeRunning(true);
        setSmokeResults([]);
        const runCheck = async (label, fn) => {
            try {
                const detail = await fn();
                return normalizeResult(label, 'ok', detail);
            } catch (error) {
                return normalizeResult(label, 'fail', error?.message || String(error));
            }
        };
        const checks = [
            runCheck('Auth (uid)', async () => {
                if (!uid) throw new Error('No auth uid');
                return uid;
            }),
            runCheck('User profile read (/users/{uid})', async () => {
                const userRef = doc(db, 'users', uid);
                const snap = await getDoc(userRef);
                if (!snap.exists()) return 'Missing profile doc';
                return 'OK';
            }),
            runCheck('Room doc read', async () => {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode));
                if (!snap.exists()) return 'Room doc missing';
                return 'OK';
            }),
            runCheck('Songs query read', async () => {
                await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), where('roomCode', '==', roomCode), limit(1)));
                return 'OK';
            }),
            runCheck('Room users query read', async () => {
                await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_users'), where('roomCode', '==', roomCode), limit(1)));
                return 'OK';
            }),
            runCheck('Activities query read', async () => {
                await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), where('roomCode', '==', roomCode), limit(1)));
                return 'OK';
            }),
            runCheck('Chat messages query read', async () => {
                await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'), where('roomCode', '==', roomCode), limit(1)));
                return 'OK';
            }),
            runCheck('Host library read', async () => {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode));
                if (!snap.exists()) return 'No host library yet';
                return 'OK';
            })
        ];

        if (smokeIncludeWrite) {
            checks.push(
                runCheck('User profile write (/users/{uid})', async () => {
                    const userRef = doc(db, 'users', uid);
                    await setDoc(userRef, { smokeUpdatedAt: serverTimestamp() }, { merge: true });
                    return 'OK';
                })
            );
            checks.push(
                runCheck('Write/delete smoke doc', async () => {
                    const smokeRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'smoke_tests', `${roomCode}_${uid}`);
                    await setDoc(smokeRef, { roomCode, uid, createdAt: serverTimestamp() }, { merge: true });
                    await deleteDoc(smokeRef);
                    return 'OK';
                })
            );
        }

        const results = await Promise.all(checks);
        const normalized = results.map((result) => {
            if (result.status === 'ok' && result.detail && String(result.detail).toLowerCase().includes('missing')) {
                return normalizeResult(result.label, 'warn', result.detail);
            }
            return result;
        });
        setSmokeResults(normalized);
        setSmokeRunning(false);
    }, [roomCode, smokeIncludeWrite, uid]);

    return {
        smokeRunning,
        smokeResults,
        smokeIncludeWrite,
        setSmokeIncludeWrite,
        copySnapshot,
        runSmokeTest
    };
};

export default useHostSmokeTest;
