import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { usePitch } from '../../hooks/usePitch';
import { db, doc, updateDoc, collection, query, where, getDocs, writeBatch, increment } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';

const NOTE_FREQ = {
    C: 261.63,
    D: 293.66,
    E: 329.63,
    F: 349.23,
    G: 392.0,
    A: 440.0,
    B: 493.88
};

const SCALE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTE_Y = {
    B: 6,
    A: 18,
    G: 30,
    F: 42,
    E: 54,
    D: 66,
    C: 78
};

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const pickStepMs = (round, difficulty) => {
    const baseByDifficulty = {
        easy: 1550,
        standard: 1400,
        hard: 1200
    };
    const base = clamp((baseByDifficulty[difficulty] || 1400) - round * 60, 650, 1600);
    const jitter = Math.floor((Math.random() * 220) - 110);
    return clamp(base + jitter, 520, 1600);
};

const nextLengthIncrement = (round, difficulty) => {
    if (difficulty === 'easy') {
        if (round < 4) return 1;
        return round % 3 === 0 ? 2 : 1;
    }
    if (difficulty === 'hard') {
        if (round < 2) return 1;
        return round % 2 === 0 ? 2 : 1;
    }
    if (round < 3) return 1;
    if (round % 2 === 0) return 2;
    return 1;
};

const buildSequence = (length, difficulty) => {
    const seq = [];
    let idx = Math.floor(Math.random() * SCALE_NOTES.length);
    seq.push(SCALE_NOTES[idx]);
    const stepPools = {
        easy: [-1, -1, 1, 1, 0, 0],
        standard: [-2, -1, -1, 1, 1, 2],
        hard: [-3, -2, -1, 1, 2, 3]
    };
    const stepOptions = stepPools[difficulty] || stepPools.standard;
    while (seq.length < length) {
        const step = stepOptions[Math.floor(Math.random() * stepOptions.length)];
        idx = clamp(idx + step, 0, SCALE_NOTES.length - 1);
        seq.push(SCALE_NOTES[idx]);
    }
    return seq;
};

const buildStepMsList = (length, round, difficulty) =>
    Array.from({ length }, () => pickStepMs(round, difficulty));

const RidingScalesGame = ({ isPlayer, roomCode, playerData, gameState, view = 'tv', user }) => {
    const isLocalInput = isPlayer && view !== 'tv';
    const { stableNote, note, confidence, isSinging } = usePitch(isLocalInput);

    const [localState, setLocalState] = useState(null);
    const [rewarded, setRewarded] = useState(false);

    const stateRef = useRef(null);
    const matchRef = useRef({ note: '-', since: 0 });
    const audioRef = useRef(null);
    const oscRef = useRef(null);
    const gainRef = useRef(null);
    const lastToneIndexRef = useRef(null);
    const rewardRef = useRef(false);
    const endRef = useRef(false);
    const advanceRef = useRef(false);

    const gameData = useMemo(() => (playerData || gameState || {}), [playerData, gameState]);
    const maxStrikes = Number(gameData.maxStrikes || 3);
    const rewardPerRound = Number(gameData.rewardPerRound || 50);
    const difficulty = gameData.difficulty || 'standard';
    const guideTone = gameData.guideTone !== false;
    const holdMs = difficulty === 'hard' ? 160 : difficulty === 'easy' ? 300 : 220;
    const isTurnsMode = gameData.mode === 'turns';
    const summaryDurationMs = 2500;

    const syncState = useCallback((next) => {
        stateRef.current = next;
        setLocalState(next);
    }, []);

    const writeState = useCallback(async (payload) => {
        await updateDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode),
            { gameData: payload }
        );
    }, [roomCode]);

    const ensureInit = useCallback(() => {
        if (!isPlayer) return;
        if (stateRef.current) return;
        const round = 1;
        const length = 3;
        const sequence = buildSequence(length, difficulty);
        const stepMsList = buildStepMsList(length, round, difficulty);
        const init = {
            ...gameData,
            phase: 'playback',
            round,
            bestRound: 1,
            strikes: 0,
            sequence,
            stepMsList,
            playbackIndex: 0,
            inputIndex: 0,
            nextAt: Date.now() + stepMsList[0],
            detectedNote: '-',
            summaryUntil: null,
            lastUpdated: Date.now()
        };
        syncState(init);
        writeState(init);
    }, [isPlayer, difficulty, gameData, syncState, writeState]);

    useEffect(() => {
        const t = setTimeout(() => ensureInit(), 0);
        return () => clearTimeout(t);
    }, [ensureInit]);

    useEffect(() => {
        if (isPlayer) return;
        if (!gameData?.phase) return;
        const t = setTimeout(() => syncState(gameData), 0);
        return () => clearTimeout(t);
    }, [isPlayer, gameData, syncState]);

    useEffect(() => {
        if (!isPlayer) return;
        if (!stateRef.current) return;

        const loop = setInterval(async () => {
            const state = { ...stateRef.current };
            const current = Date.now();
            const displayNote = stableNote !== '-' ? stableNote : note;
            state.detectedNote = displayNote;

            if (state.phase === 'summary') {
                if (state.summaryUntil && current >= state.summaryUntil) {
                    state.phase = 'over';
                }
            } else if (state.phase === 'playback') {
                if (current >= state.nextAt) {
                    const nextIndex = state.playbackIndex + 1;
                    if (nextIndex >= state.sequence.length) {
                        state.phase = 'input';
                        state.inputIndex = 0;
                        state.nextAt = current + clamp(state.stepMsList[0] + 400, 900, 2200);
                        matchRef.current = { note: '-', since: 0 };
                    } else {
                        state.playbackIndex = nextIndex;
                        state.nextAt = current + (state.stepMsList[nextIndex] || pickStepMs(state.round));
                    }
                }
            } else if (state.phase === 'input') {
                const targetNote = state.sequence[state.inputIndex];
                const isMatch = isSinging && confidence >= 0.6 && displayNote === targetNote;
                if (isMatch) {
                    if (matchRef.current.note !== targetNote) {
                        matchRef.current = { note: targetNote, since: current };
                    } else if (current - matchRef.current.since >= holdMs) {
                        const nextInput = state.inputIndex + 1;
                        if (nextInput >= state.sequence.length) {
                            const nextRound = state.round + 1;
                            const nextLen = state.sequence.length + nextLengthIncrement(state.round, difficulty);
                            const nextSeq = buildSequence(nextLen, difficulty);
                        const nextSteps = buildStepMsList(nextLen, nextRound, difficulty);
                        state.round = nextRound;
                        state.bestRound = Math.max(state.bestRound || 1, state.round);
                        state.sequence = nextSeq;
                        state.stepMsList = nextSteps;
                        state.playbackIndex = 0;
                        state.inputIndex = 0;
                        state.phase = 'playback';
                        state.nextAt = current + nextSteps[0];
                        } else {
                            state.inputIndex = nextInput;
                            state.nextAt = current + clamp(state.stepMsList[nextInput] + 400, 900, 2200);
                        }
                        matchRef.current = { note: '-', since: 0 };
                    }
                } else if (current >= state.nextAt) {
                    state.strikes = (state.strikes || 0) + 1;
                    if (state.strikes >= maxStrikes) {
                        state.phase = 'summary';
                        state.summaryUntil = current + summaryDurationMs;
                    } else {
                        const resetLen = 3;
                        const resetSeq = buildSequence(resetLen, difficulty);
                        const resetSteps = buildStepMsList(resetLen, 1, difficulty);
                        state.round = 1;
                        state.sequence = resetSeq;
                        state.stepMsList = resetSteps;
                        state.playbackIndex = 0;
                        state.inputIndex = 0;
                        state.phase = 'playback';
                        state.nextAt = current + resetSteps[0];
                        matchRef.current = { note: '-', since: 0 };
                    }
                }
            }

            state.lastUpdated = current;
            syncState(state);
            await writeState(state);
        }, 200);

        return () => clearInterval(loop);
    }, [isPlayer, stableNote, note, confidence, isSinging, maxStrikes, difficulty, holdMs, writeState, syncState]);

    useEffect(() => {
        if (!localState || !guideTone) return;
        if (!(view === 'tv' || isPlayer)) return;
        if (localState.phase !== 'playback') return;
        if (localState.playbackIndex === null) return;
        if (lastToneIndexRef.current === localState.playbackIndex) return;
        lastToneIndexRef.current = localState.playbackIndex;
        const toneNote = localState.sequence?.[localState.playbackIndex];
        if (!toneNote) return;
        const freq = NOTE_FREQ[toneNote] || 440;
        if (!audioRef.current) {
            audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        if (!gainRef.current) {
            gainRef.current = ctx.createGain();
            gainRef.current.gain.value = 0.08;
            gainRef.current.connect(ctx.destination);
        }
        if (oscRef.current) {
            oscRef.current.stop();
        }
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gainRef.current);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
        oscRef.current = osc;
    }, [localState, guideTone, view, isPlayer]);

    useEffect(() => {
        if (!isPlayer || rewarded || !localState || localState.phase !== 'over') return;
        if (!roomCode) return;
        if (gameData.playerId === 'GROUP') {
            if (rewardRef.current) return;
            rewardRef.current = true;
            (async () => {
                try {
                    const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_users'), where('roomCode', '==', roomCode));
                    const snap = await getDocs(q);
                    const batch = writeBatch(db);
                    snap.docs.forEach((docSnap) => {
                        batch.update(docSnap.ref, { points: increment((localState.bestRound || 1) * rewardPerRound) });
                    });
                    await batch.commit();
                } catch (e) {
                    console.error(e);
                }
            })();
        } else if (user?.uid && gameData.playerId === user.uid) {
            updateDoc(
                doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${user.uid}`),
                { points: increment((localState.bestRound || 1) * rewardPerRound) }
            ).catch(() => {});
        }
        const rewardTimer = setTimeout(() => setRewarded(true), 0);
        return () => clearTimeout(rewardTimer);
    }, [isPlayer, localState, rewarded, roomCode, user?.uid, rewardPerRound, gameData.playerId]);

    useEffect(() => {
        if (!localState || localState.phase !== 'over') return;
        if (gameData.mode === 'turns' && isPlayer) {
            if (advanceRef.current) return;
            const participants = gameData.participants || [];
            const nextIndex = (gameData.turnIndex || 0) + 1;
            if (nextIndex < participants.length) {
                const metaList = gameData.participantMeta || [];
                const meta = metaList.find((p) => p.id === participants[nextIndex]);
                advanceRef.current = true;
                updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
                    activeMode: 'riding_scales',
                    gameData: {
                        ...gameData,
                        playerId: participants[nextIndex],
                        playerName: meta?.name || '',
                        playerAvatar: meta?.avatar || '🎤',
                        turnIndex: nextIndex,
                        phase: null,
                        sequence: [],
                        stepMsList: [],
                        strikes: 0,
                        round: 1,
                        bestRound: 1,
                        startedAt: Date.now()
                    }
                }).catch(() => {});
                return;
            }
        }
        if (view !== 'tv') return;
        if (endRef.current) return;
        endRef.current = true;
        updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
            activeMode: 'karaoke',
            gameData: null
        }).catch(() => {});
    }, [localState, view, roomCode, gameData, isPlayer]);

    if (!localState) {
        return (
            <div className="w-full h-full bg-black text-white flex items-center justify-center">
                <div className="text-zinc-400">Loading Riding Scales...</div>
            </div>
        );
    }

    const targetNote = localState.phase === 'input'
        ? localState.sequence?.[localState.inputIndex]
        : localState.sequence?.[localState.playbackIndex];
    const detected = localState.detectedNote || '-';
    const waitingForTurn = !isPlayer && view !== 'tv' && gameData.playerId !== 'GROUP';
    const metaList = gameData.participantMeta || [];
    const currentTurnMeta = metaList.find((p) => p.id === gameData.playerId);
    const nextTurnMeta = isTurnsMode
        ? metaList.find((p) => p.id === (gameData.participants || [])[Math.min((gameData.turnIndex || 0) + 1, (gameData.participants || []).length - 1)])
        : null;
    const showSummary = localState.phase === 'summary';
    const earnedPoints = (localState.bestRound || 1) * rewardPerRound;

    return (
        <div className="relative w-full h-full bg-black text-white font-saira overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,196,217,0.15),_transparent_60%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(236,72,153,0.18),_transparent_60%)]"></div>

            <div className="absolute top-6 left-8 right-8 flex items-center justify-between z-20">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-400">Riding Scales</div>
                    <div className="text-3xl font-bebas text-cyan-300">{gameData.playerId === 'GROUP' ? 'THE CROWD' : (gameData.playerName || 'SINGER')}</div>
                    <div className="text-sm text-zinc-400">Repeat the scale pattern as it grows.</div>
                    {isTurnsMode && (
                        <div className="mt-2 text-xs uppercase tracking-[0.3em] text-zinc-500">
                            {isPlayer ? "You're up" : `Up now: ${currentTurnMeta?.name || gameData.playerName || 'Singer'}`}
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">Round</div>
                    <div className="text-3xl font-black text-white">{localState.round}</div>
                    <div className="text-xs text-zinc-500">Strikes: {localState.strikes}/{maxStrikes}</div>
                    <div className="mt-2 flex items-center justify-end gap-2 text-[10px] uppercase tracking-[0.3em] text-zinc-400">
                        <span className="px-2 py-1 rounded-full border border-white/10 bg-black/40">
                            {difficulty}
                        </span>
                        <span className={`px-2 py-1 rounded-full border ${guideTone ? 'border-emerald-400/40 text-emerald-200 bg-emerald-500/10' : 'border-zinc-600 text-zinc-400 bg-black/40'}`}>
                            Guide tone {guideTone ? 'on' : 'off'}
                        </span>
                    </div>
                    {isTurnsMode && nextTurnMeta?.name && (
                        <div className="text-[10px] text-zinc-500 mt-2">Next up: {nextTurnMeta.name}</div>
                    )}
                </div>
            </div>

            <div className="absolute inset-x-10 top-28 bottom-24 flex flex-col gap-6">
                <div className="bg-black/50 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-zinc-500 mb-3">
                        <span>{localState.phase === 'playback' ? 'Listen' : 'Repeat'}</span>
                        <span>{localState.phase === 'playback' ? 'Simon says' : 'Your turn'}</span>
                    </div>
                    <div className="relative h-52 bg-zinc-950/70 border border-white/5 rounded-2xl overflow-hidden">
                        {[0,1,2,3,4].map((i) => (
                            <div key={i} className="absolute left-0 right-0 h-px bg-white/10" style={{ top: `${18 + i * 16}%` }}></div>
                        ))}
                        <div className="absolute left-6 right-6 top-0 bottom-0">
                            {SCALE_NOTES.map((n) => (
                                <div key={n} className="absolute left-0 text-xs text-zinc-500" style={{ top: `${NOTE_Y[n]}%` }}>{n}</div>
                            ))}
                            {targetNote && (
                                <div className="absolute left-1/2 w-5 h-5 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.6)]" style={{ top: `${NOTE_Y[targetNote]}%`, transform: 'translate(-50%, -50%)' }}></div>
                            )}
                            {detected && detected !== '-' && (
                                <div className="absolute left-[60%] w-4 h-4 rounded-full bg-pink-400 shadow-[0_0_16px_rgba(236,72,153,0.5)]" style={{ top: `${NOTE_Y[detected] || 50}%`, transform: 'translate(-50%, -50%)' }}></div>
                            )}
                        </div>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-zinc-400">Detected: <span className="text-white font-bold">{detected}</span></div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {localState.sequence.map((n, idx) => (
                        <div key={`${n}-${idx}`} className={`px-3 py-1 rounded-full text-xs font-bold border ${localState.phase === 'playback' && idx === localState.playbackIndex ? 'border-cyan-300 text-cyan-200 bg-cyan-500/10' : localState.phase === 'input' && idx === localState.inputIndex ? 'border-pink-300 text-pink-200 bg-pink-500/10' : 'border-white/10 text-zinc-500 bg-black/20'}`}>
                            {n}
                        </div>
                    ))}
                </div>
            </div>

            {showSummary && (
                <div className="absolute inset-0 bg-black/75 z-30 flex items-center justify-center text-center">
                    <div className="bg-zinc-900/90 border border-white/10 rounded-3xl px-8 py-6 max-w-lg">
                        <div className="text-xs uppercase tracking-[0.4em] text-zinc-400">Round Summary</div>
                        <div className="text-4xl font-bebas text-cyan-300 mt-2">Round {localState.bestRound}</div>
                        <div className="text-sm text-zinc-400 mt-1">Strikes {localState.strikes}/{maxStrikes}</div>
                        <div className="text-2xl font-bold text-white mt-4">+{earnedPoints} pts</div>
                        {isTurnsMode && nextTurnMeta?.name && (
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mt-4">Next up: {nextTurnMeta.name}</div>
                        )}
                    </div>
                </div>
            )}

            {waitingForTurn && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30 text-center">
                    <div className="bg-zinc-900/80 border border-white/10 rounded-2xl px-6 py-4">
                        <div className="text-xs uppercase tracking-[0.4em] text-zinc-400">Riding Scales</div>
                        <div className="text-2xl font-bebas text-cyan-300 mt-2">Waiting for your turn</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RidingScalesGame;
