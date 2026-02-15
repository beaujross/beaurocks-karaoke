import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { usePitch } from '../../hooks/usePitch';
import { db, doc, updateDoc, collection, query, where, getDocs, writeBatch, increment } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';
import VoiceHud from '../../components/VoiceHud';

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

const difficultyConfig = (difficulty) => {
    if (difficulty === 'easy') {
        return { intervalMs: 1400, holdMs: 260, minConfidence: 0.5, minStability: 0.5 };
    }
    if (difficulty === 'hard') {
        return { intervalMs: 850, holdMs: 160, minConfidence: 0.7, minStability: 0.7 };
    }
    return { intervalMs: 1100, holdMs: 210, minConfidence: 0.6, minStability: 0.6 };
};

const buildMelody = (length, difficulty) => {
    const seq = [];
    let idx = Math.floor(Math.random() * SCALE_NOTES.length);
    seq.push(SCALE_NOTES[idx]);
    const stepPools = {
        easy: [-1, -1, 1, 1, 0],
        standard: [-2, -1, 1, 2, 0],
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

const VocalChallengeGame = ({ isPlayer, roomCode, playerData, gameState, inputSource, view = 'tv', user }) => {
    const isLocalInput = isPlayer && inputSource !== 'remote';
    const { pitch, note, confidence, volumeNormalized, stableNote, stability, calibrating, isSinging } = usePitch(isLocalInput);

    const [localState, setLocalState] = useState(null);
    const [remoteVoice, setRemoteVoice] = useState({ note: '-', confidence: 0, volumeNormalized: 0, stableNote: '-', stability: 0 });

    const stateRef = useRef(null);
    const matchRef = useRef({ note: '-', since: 0 });
    const rewardRef = useRef(false);
    const endRef = useRef(false);
    const advanceRef = useRef(false);
    const audioRef = useRef(null);
    const gainRef = useRef(null);
    const oscRef = useRef(null);
    const lastToneIndexRef = useRef(null);

    const data = useMemo(() => (playerData || gameState || {}), [playerData, gameState]);
    const difficulty = data.difficulty || 'standard';
    const guideTone = data.guideTone !== false;
    const turnDurationMs = Math.max(10, Number(data.turnDurationMs || 30000));
    const mode = data.mode || (data.inputSource === 'ambient' ? 'crowd' : 'turns');
    const isTurnsMode = mode === 'turns';
    const summaryDurationMs = 2500;
    const { intervalMs, holdMs, minConfidence, minStability } = useMemo(() => difficultyConfig(difficulty), [difficulty]);

    const writeState = useCallback(async (payload) => {
        await updateDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode),
            { gameData: payload }
        );
    }, [roomCode]);

    const ensureInit = useCallback(() => {
        if (!isPlayer) return;
        if (stateRef.current) return;
        const length = difficulty === 'easy' ? 6 : difficulty === 'hard' ? 10 : 8;
        const sequence = buildMelody(length, difficulty);
        const init = {
            ...data,
            phase: 'playing',
            score: 0,
            streak: 0,
            sequence,
            targetIndex: 0,
            nextNoteAt: Date.now() + intervalMs,
            detectedNote: '-',
            targetNote: sequence[0],
            turnEndsAt: Date.now() + turnDurationMs,
            summaryUntil: null,
            lastUpdated: Date.now()
        };
        stateRef.current = init;
        setLocalState(init);
        writeState(init);
    }, [isPlayer, difficulty, data, intervalMs, turnDurationMs, writeState]);

    useEffect(() => {
        const t = setTimeout(() => ensureInit(), 0);
        return () => clearTimeout(t);
    }, [ensureInit]);

    useEffect(() => {
        if (isPlayer) return;
        if (!data?.phase) return;
        stateRef.current = data;
        const t = setTimeout(() => {
            setLocalState(data);
            if (data.voice) setRemoteVoice(data.voice);
        }, 0);
        return () => clearTimeout(t);
    }, [isPlayer, data]);

    useEffect(() => {
        if (!isPlayer) {
            stateRef.current = null;
            return;
        }
        if (!stateRef.current) return;

        const loop = setInterval(async () => {
            const state = { ...stateRef.current };
            const now = Date.now();
            const displayNote = stableNote !== '-' ? stableNote : note;
            state.detectedNote = displayNote;

            if (state.phase === 'summary') {
                if (state.summaryUntil && now >= state.summaryUntil) {
                    state.phase = 'over';
                }
            } else if (state.phase === 'playing') {
                if (now >= state.turnEndsAt) {
                    state.phase = 'summary';
                    state.summaryUntil = now + summaryDurationMs;
                } else if (now >= state.nextNoteAt) {
                    const nextIndex = (state.targetIndex + 1) % state.sequence.length;
                    state.targetIndex = nextIndex;
                    state.targetNote = state.sequence[nextIndex];
                    state.nextNoteAt = now + intervalMs + Math.floor((Math.random() * 140) - 70);
                }

                const targetNote = state.sequence[state.targetIndex];
                const isMatch = isSinging &&
                    displayNote === targetNote &&
                    confidence >= minConfidence &&
                    stability >= minStability;

                if (isMatch) {
                    if (matchRef.current.note !== targetNote) {
                        matchRef.current = { note: targetNote, since: now };
                    } else if (now - matchRef.current.since >= holdMs) {
                        state.streak = (state.streak || 0) + 1;
                        const bonus = Math.min(50, state.streak * 6);
                        state.score = (state.score || 0) + 25 + bonus;
                        matchRef.current = { note: '-', since: 0 };
                    }
                } else {
                    matchRef.current = { note: '-', since: 0 };
                }
            }

            state.voice = {
                note: displayNote,
                confidence,
                volumeNormalized,
                stableNote,
                stability
            };
            state.lastUpdated = now;
            stateRef.current = state;
            setLocalState(state);
            await writeState(state);
        }, 200);

        return () => clearInterval(loop);
    }, [isPlayer, stableNote, note, confidence, stability, isSinging, intervalMs, holdMs, minConfidence, minStability, volumeNormalized, writeState]);

    useEffect(() => {
        if (!localState || !guideTone) return;
        if (!(view === 'tv' || isPlayer)) return;
        if (localState.phase !== 'playing') return;
        if (lastToneIndexRef.current === localState.targetIndex) return;
        lastToneIndexRef.current = localState.targetIndex;
        const toneNote = localState.sequence?.[localState.targetIndex];
        if (!toneNote) return;
        const freq = NOTE_FREQ[toneNote] || 440;
        if (!audioRef.current) {
            audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        if (!gainRef.current) {
            gainRef.current = ctx.createGain();
            gainRef.current.gain.value = 0.06;
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
        osc.stop(ctx.currentTime + 0.18);
        oscRef.current = osc;
    }, [localState, guideTone, view, isPlayer]);

    useEffect(() => {
        if (!isPlayer || !localState || localState.phase !== 'over') return;
        if (mode === 'crowd') {
            if (rewardRef.current) return;
            rewardRef.current = true;
            (async () => {
                try {
                    const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_users'), where('roomCode', '==', roomCode));
                    const snap = await getDocs(q);
                    const batch = writeBatch(db);
                    snap.docs.forEach((docSnap) => {
                        batch.update(docSnap.ref, { points: increment(localState.score || 0) });
                    });
                    await batch.commit();
                } catch (e) {
                    console.error(e);
                }
            })();
        } else if (user?.uid && data.playerId === user.uid) {
            updateDoc(
                doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${user.uid}`),
                { points: increment(localState.score || 0) }
            ).catch(() => {});
        }
    }, [isPlayer, localState, roomCode, user?.uid, data.playerId, mode]);

    useEffect(() => {
        if (!localState || localState.phase !== 'over') return;
        if (mode === 'turns' && isPlayer) {
            if (advanceRef.current) return;
            const participants = data.participants || [];
            const nextIndex = (data.turnIndex || 0) + 1;
            if (nextIndex < participants.length) {
                const metaList = data.participantMeta || [];
                const meta = metaList.find((p) => p.id === participants[nextIndex]);
                advanceRef.current = true;
                updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
                    activeMode: 'vocal_challenge',
                    gameData: {
                        ...data,
                        playerId: participants[nextIndex],
                        playerName: meta?.name || '',
                        playerAvatar: meta?.avatar || 'O',
                        turnIndex: nextIndex,
                        phase: null,
                        score: 0,
                        streak: 0,
                        targetIndex: 0,
                        targetNote: null,
                        sequence: [],
                        summaryUntil: null,
                        startedAt: Date.now(),
                        turnEndsAt: Date.now() + turnDurationMs
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
    }, [localState, view, roomCode, data, isPlayer, mode, turnDurationMs]);

    if (!localState) {
        return (
            <div className="w-full h-full bg-black text-white flex items-center justify-center">
                <div className="text-zinc-400">Loading Vocal Challenge...</div>
            </div>
        );
    }

    const targetNote = localState.targetNote || localState.sequence?.[localState.targetIndex];
    const detected = localState.detectedNote || '-';
    const waitingForTurn = !isPlayer && view !== 'tv' && data.playerId !== 'AMBIENT';
    const metaList = data.participantMeta || [];
    const currentTurnMeta = metaList.find((p) => p.id === data.playerId);
    const nextTurnMeta = isTurnsMode
        ? metaList.find((p) => p.id === (data.participants || [])[Math.min((data.turnIndex || 0) + 1, (data.participants || []).length - 1)])
        : null;
    const showSummary = localState.phase === 'summary';

    return (
        <div className="relative w-full h-full bg-indigo-950 overflow-hidden font-saira text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_65%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(0,196,217,0.15),_transparent_65%)]"></div>

            <div className="absolute top-6 left-8 right-8 flex items-center justify-between z-20">
                <div>
                    <div className="text-xs md:text-sm uppercase tracking-[0.24em] md:tracking-[0.3em] text-zinc-400">Vocal Challenge</div>
                    <div className="text-3xl font-bebas text-pink-300">{data.playerId === 'AMBIENT' ? 'THE CROWD' : (data.playerName || 'SINGER')}</div>
                    <div className="text-base md:text-lg text-zinc-400">Match the melody notes as they change.</div>
                    {isTurnsMode && (
                        <div className="mt-2 text-sm uppercase tracking-[0.2em] text-zinc-500">
                            {isPlayer ? "You're up" : `Up now: ${currentTurnMeta?.name || data.playerName || 'Singer'}`}
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <div className="text-sm uppercase tracking-[0.2em] text-zinc-400">Score</div>
                    <div className="text-3xl font-black text-white">{localState.score}</div>
                    <div className="text-sm text-zinc-500">Streak: {localState.streak || 0}</div>
                    <div className="mt-2 flex items-center justify-end gap-2 text-xs uppercase tracking-[0.2em] text-zinc-400">
                        <span className="px-2 py-1 rounded-full border border-white/10 bg-black/40">{difficulty}</span>
                        <span className={`px-2 py-1 rounded-full border ${guideTone ? 'border-emerald-400/40 text-emerald-200 bg-emerald-500/10' : 'border-zinc-600 text-zinc-400 bg-black/40'}`}>
                            Guide tone {guideTone ? 'on' : 'off'}
                        </span>
                    </div>
                    {isTurnsMode && nextTurnMeta?.name && (
                        <div className="text-xs text-zinc-500 mt-2">Next up: {nextTurnMeta.name}</div>
                    )}
                </div>
            </div>

            <div className="absolute inset-x-10 top-28 bottom-24 flex flex-col gap-6">
                <div className="bg-black/50 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-zinc-500 mb-3">
                        <span>Melody</span>
                        <span>Match the note</span>
                    </div>
                    <div className="relative h-52 bg-zinc-950/70 border border-white/5 rounded-2xl overflow-hidden">
                        {[0,1,2,3,4].map((i) => (
                            <div key={i} className="absolute left-0 right-0 h-px bg-white/10" style={{ top: `${18 + i * 16}%` }}></div>
                        ))}
                        <div className="absolute left-6 right-6 top-0 bottom-0">
                            {SCALE_NOTES.map((n) => (
                                <div key={n} className="absolute left-0 text-sm text-zinc-400" style={{ top: `${NOTE_Y[n]}%` }}>{n}</div>
                            ))}
                            {targetNote && (
                                <div className="absolute left-1/2 w-6 h-6 rounded-full bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.7)]" style={{ top: `${NOTE_Y[targetNote]}%`, transform: 'translate(-50%, -50%)' }}></div>
                            )}
                            {detected && detected !== '-' && (
                                <div className="absolute left-[60%] w-5 h-5 rounded-full bg-pink-400 shadow-[0_0_16px_rgba(236,72,153,0.6)]" style={{ top: `${NOTE_Y[detected] || 50}%`, transform: 'translate(-50%, -50%)' }}></div>
                            )}
                        </div>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-sm md:text-base text-zinc-300">
                            Target: <span className="text-white font-bold">{targetNote || '-'}</span>
                            <span className="mx-2 text-zinc-600">|</span>
                            Detected: <span className="text-white font-bold">{detected}</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(localState.sequence || []).map((n, idx) => (
                        <div key={`${n}-${idx}`} className={`px-3 py-1 rounded-full text-sm md:text-base font-bold border ${idx === localState.targetIndex ? 'border-pink-300 text-pink-200 bg-pink-500/10' : 'border-white/10 text-zinc-500 bg-black/20'}`}>
                            {n}
                        </div>
                    ))}
                </div>
            </div>

            {showSummary && (
                <div className="absolute inset-0 bg-black/75 z-30 flex items-center justify-center text-center">
                    <div className="bg-zinc-900/90 border border-white/10 rounded-3xl px-8 py-6 max-w-lg">
                        <div className="text-sm uppercase tracking-[0.24em] text-zinc-400">Round Summary</div>
                        <div className="text-4xl font-bebas text-pink-300 mt-2">Score {localState.score}</div>
                        <div className="text-base md:text-lg text-zinc-400 mt-1">Best streak {localState.streak || 0}</div>
                        {isTurnsMode && nextTurnMeta?.name && (
                            <div className="text-sm uppercase tracking-[0.2em] text-zinc-500 mt-4">Next up: {nextTurnMeta.name}</div>
                        )}
                    </div>
                </div>
            )}

            {waitingForTurn && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30 text-center">
                    <div className="bg-zinc-900/80 border border-white/10 rounded-2xl px-6 py-4">
                        <div className="text-sm uppercase tracking-[0.24em] text-zinc-400">Vocal Challenge</div>
                        <div className="text-2xl font-bebas text-pink-300 mt-2">Waiting for your turn</div>
                    </div>
                </div>
            )}

            <VoiceHud
                note={(isPlayer ? note : remoteVoice.note) || '-'}
                pitch={isPlayer ? pitch : 0}
                confidence={isPlayer ? confidence : remoteVoice.confidence}
                volumeNormalized={isPlayer ? volumeNormalized : remoteVoice.volumeNormalized}
                stableNote={isPlayer ? stableNote : remoteVoice.stableNote}
                stability={isPlayer ? stability : remoteVoice.stability}
                calibrating={isPlayer ? calibrating : remoteVoice.calibrating}
            />
        </div>
    );
};

export default VocalChallengeGame;
