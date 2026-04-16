import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { usePitch } from '../../hooks/usePitch';
import { db, doc, updateDoc, collection, query, where, getDocs, writeBatch, increment } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';
import {
    VOICE_GAME_FUN_DEFAULTS,
    buildRidingScalesStepMsList,
    getRidingScalesHoldMs,
    getRidingScalesLengthIncrement,
    getRidingScalesStepMs
} from '../vocalGameTuning';

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
const centsBetween = (freqA, freqB) => (freqA > 0 && freqB > 0 ? (1200 * Math.log2(freqA / freqB)) : 9999);
const SCALE_ASSIST_DEFAULT_MS = 6500;
const SCALE_ASSIST_BANNER_MS = 2400;

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

const RidingScalesGame = ({ isPlayer, roomCode, playerData, gameState, inputSource, view = 'tv', user }) => {
    const gameData = useMemo(() => (playerData || gameState || {}), [playerData, gameState]);
    const controlSource = gameData.inputSource || inputSource || 'remote';
    const isRoomControlled = controlSource === 'ambient' || controlSource === 'crowd' || controlSource === 'local';
    const isController = isPlayer && (isRoomControlled ? view === 'tv' : view !== 'tv');
    const isLocalInput = isController && inputSource !== 'remote';
    const { pitch, stableNote, note, confidence, isSinging } = usePitch(isLocalInput, {
        smoothingFactor: 0.42,
        confidenceThreshold: 0.3,
        singingThreshold: 0.03,
        stableNoteMs: 180,
        noiseGateMultiplier: 1.24
    });

    const [localState, setLocalState] = useState(null);
    const [rewarded, setRewarded] = useState(false);
    const [hostAssistBanner, setHostAssistBanner] = useState(null);

    const stateRef = useRef(null);
    const matchRef = useRef({ note: '-', since: 0 });
    const audioRef = useRef(null);
    const oscRef = useRef(null);
    const gainRef = useRef(null);
    const lastToneIndexRef = useRef(null);
    const rewardRef = useRef(false);
    const endRef = useRef(false);
    const advanceRef = useRef(false);
    const pitchRef = useRef(pitch);
    const lastHostAssistIdRef = useRef('');
    const hostAssistBannerTimeoutRef = useRef(null);

    const maxStrikes = Number(gameData.maxStrikes || VOICE_GAME_FUN_DEFAULTS.ridingScales.maxStrikes);
    const rewardPerRound = Number(gameData.rewardPerRound || VOICE_GAME_FUN_DEFAULTS.ridingScales.rewardPerRound);
    const difficulty = gameData.difficulty || VOICE_GAME_FUN_DEFAULTS.ridingScales.difficulty;
    const guideTone = gameData.guideTone !== false;
    const holdMs = getRidingScalesHoldMs(difficulty);
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
        if (!isController) return;
        if (stateRef.current) return;
        const round = 1;
        const length = 3;
        const sequence = buildSequence(length, difficulty);
        const stepMsList = buildRidingScalesStepMsList(length, round, difficulty);
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
            assistUntil: null,
            assistCharges: 1,
            lastPhaseChangeAt: Date.now(),
            lastNoteAdvanceAt: Date.now(),
            lastUpdated: Date.now()
        };
        syncState(init);
        writeState(init);
    }, [isController, difficulty, gameData, syncState, writeState]);

    useEffect(() => {
        const t = setTimeout(() => ensureInit(), 0);
        return () => clearTimeout(t);
    }, [ensureInit]);

    useEffect(() => {
        if (isController) return;
        stateRef.current = null;
        if (!gameData?.phase) return;
        const t = setTimeout(() => syncState(gameData), 0);
        return () => clearTimeout(t);
    }, [isController, gameData, syncState]);

    useEffect(() => {
        pitchRef.current = pitch;
    }, [pitch]);

    useEffect(() => {
        const hostAssist = gameData?.hostAssist;
        const assistId = String(hostAssist?.id || '').trim();
        if (!assistId || assistId === lastHostAssistIdRef.current) return;
        const nextState = stateRef.current ? { ...stateRef.current } : null;
        if (!nextState) {
            lastHostAssistIdRef.current = assistId;
            return;
        }
        const durationMs = Math.max(1200, Number(hostAssist?.durationMs || SCALE_ASSIST_DEFAULT_MS));
        const triggeredAt = Number(hostAssist?.triggeredAt || Date.now());
        if (Date.now() - triggeredAt > durationMs + SCALE_ASSIST_BANNER_MS + 1500) {
            lastHostAssistIdRef.current = assistId;
            return;
        }
        lastHostAssistIdRef.current = assistId;
        nextState.hostAssist = hostAssist;
        nextState.assistUntil = triggeredAt + durationMs;
        nextState.assistCharges = Math.max(0, Number(nextState.assistCharges || 0)) + 1;
        if (nextState.phase === 'input') {
            nextState.phase = 'playback';
            nextState.playbackIndex = 0;
            nextState.inputIndex = 0;
            nextState.nextAt = Date.now() + clamp((nextState.stepMsList?.[0] || 1100) + 320, 1100, 2200);
            nextState.lastPhaseChangeAt = Date.now();
            nextState.lastNoteAdvanceAt = Date.now();
        }
        nextState.lastUpdated = Date.now();
        stateRef.current = nextState;
        const commitTimer = setTimeout(() => {
            setLocalState(nextState);
            setHostAssistBanner({
                label: hostAssist?.label || 'SCALE SAVE',
                by: hostAssist?.by || 'Host'
            });
            if (hostAssistBannerTimeoutRef.current) clearTimeout(hostAssistBannerTimeoutRef.current);
            hostAssistBannerTimeoutRef.current = setTimeout(() => setHostAssistBanner(null), SCALE_ASSIST_BANNER_MS);
        }, 0);
        return () => clearTimeout(commitTimer);
    }, [gameData]);

    useEffect(() => () => {
        if (hostAssistBannerTimeoutRef.current) clearTimeout(hostAssistBannerTimeoutRef.current);
    }, []);

    useEffect(() => {
        if (!isController) return;
        if (!stateRef.current) return;
        let cancelled = false;
        let writeInFlight = false;
        let queuedState = null;

        const flushStateWrite = async (nextState) => {
            if (cancelled) return;
            if (writeInFlight) {
                queuedState = nextState;
                return;
            }
            writeInFlight = true;
            let payload = nextState;
            while (payload && !cancelled) {
                try {
                    await writeState(payload);
                } catch (e) {
                    console.error('RidingScales state sync error:', e);
                }
                payload = queuedState;
                queuedState = null;
            }
            writeInFlight = false;
        };

        const loop = setInterval(() => {
            const state = { ...stateRef.current };
            const current = Date.now();
            const displayNote = stableNote !== '-' ? stableNote : note;
            state.detectedNote = displayNote;
            const assistActive = Number(state.assistUntil || 0) > current;

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
                        state.nextAt = current + clamp(state.stepMsList[0] + (assistActive ? 920 : 760), 1200, 2800);
                        state.lastPhaseChangeAt = current;
                        state.lastNoteAdvanceAt = current;
                        matchRef.current = { note: '-', since: 0 };
                    } else {
                        state.playbackIndex = nextIndex;
                        state.nextAt = current + (state.stepMsList[nextIndex] || getRidingScalesStepMs(state.round, difficulty));
                        state.lastNoteAdvanceAt = current;
                    }
                }
            } else if (state.phase === 'input') {
                const targetNote = state.sequence[state.inputIndex];
                const targetFreq = NOTE_FREQ[targetNote] || 0;
                const centsOff = targetFreq ? centsBetween(pitchRef.current || 0, targetFreq) : 9999;
                const tuneWindow = assistActive ? 200 : 160;
                const relaxedConfidence = assistActive ? 0.18 : 0.28;
                const exactNote = displayNote === targetNote || stableNote === targetNote;
                const isMatch = isSinging
                    && confidence >= relaxedConfidence
                    && (exactNote || Math.abs(centsOff) <= tuneWindow);
                if (isMatch) {
                    if (matchRef.current.note !== targetNote) {
                        matchRef.current = { note: targetNote, since: current };
                    } else if (current - matchRef.current.since >= Math.max(80, Math.round(holdMs * (assistActive ? 0.65 : 1)))) {
                        const nextInput = state.inputIndex + 1;
                        if (nextInput >= state.sequence.length) {
                            const nextRound = state.round + 1;
                            const nextLen = state.sequence.length + getRidingScalesLengthIncrement(state.round, difficulty);
                            const nextSeq = buildSequence(nextLen, difficulty);
                            const nextSteps = buildRidingScalesStepMsList(nextLen, nextRound, difficulty);
                            state.round = nextRound;
                            state.bestRound = Math.max(state.bestRound || 1, state.round);
                            state.sequence = nextSeq;
                            state.stepMsList = nextSteps;
                            state.playbackIndex = 0;
                            state.inputIndex = 0;
                            state.phase = 'playback';
                            state.nextAt = current + nextSteps[0];
                            state.assistCharges = Math.min(2, Math.max(0, Number(state.assistCharges || 0)) + 1);
                            state.lastPhaseChangeAt = current;
                            state.lastNoteAdvanceAt = current;
                        } else {
                            state.inputIndex = nextInput;
                            state.nextAt = current + clamp(state.stepMsList[nextInput] + (assistActive ? 980 : 760), 1200, 2800);
                            state.lastNoteAdvanceAt = current;
                        }
                        matchRef.current = { note: '-', since: 0 };
                    }
                } else if (current >= state.nextAt) {
                    if ((state.assistCharges || 0) > 0) {
                        state.assistCharges = Math.max(0, Number(state.assistCharges || 0) - 1);
                        state.phase = 'playback';
                        state.playbackIndex = 0;
                        state.inputIndex = 0;
                        state.nextAt = current + clamp((state.stepMsList?.[0] || 900) + 320, 1100, 2200);
                        state.lastPhaseChangeAt = current;
                        state.lastNoteAdvanceAt = current;
                        matchRef.current = { note: '-', since: 0 };
                    } else {
                        state.strikes = (state.strikes || 0) + 1;
                        if (state.strikes >= maxStrikes) {
                            state.phase = 'summary';
                            state.summaryUntil = current + summaryDurationMs;
                        } else {
                            const shouldTrimBack = state.strikes >= Math.max(3, maxStrikes - 1);
                            const fallbackRound = shouldTrimBack ? Math.max(1, state.round - 1) : state.round;
                            const fallbackLen = shouldTrimBack ? Math.max(3, state.sequence.length - 1) : state.sequence.length;
                            const resetSeq = buildSequence(fallbackLen, difficulty);
                            const resetSteps = buildRidingScalesStepMsList(fallbackLen, fallbackRound, difficulty);
                            state.round = fallbackRound;
                            state.sequence = resetSeq;
                            state.stepMsList = resetSteps;
                            state.playbackIndex = 0;
                            state.inputIndex = 0;
                            state.phase = 'playback';
                            state.nextAt = current + resetSteps[0];
                            state.lastPhaseChangeAt = current;
                            state.lastNoteAdvanceAt = current;
                            matchRef.current = { note: '-', since: 0 };
                        }
                    }
                }
            }

            state.lastUpdated = current;
            syncState(state);
            flushStateWrite(state);
        }, 200);

        return () => {
            cancelled = true;
            clearInterval(loop);
        };
    }, [isController, stableNote, note, confidence, isSinging, maxStrikes, difficulty, holdMs, writeState, syncState]);

    useEffect(() => {
        if (!localState || !guideTone) return;
        if (!(view === 'tv' || isController)) return;
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
    }, [localState, guideTone, view, isController]);

    useEffect(() => {
        if (!isController || rewarded || !localState || localState.phase !== 'over') return;
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
    }, [isController, localState, rewarded, roomCode, user?.uid, rewardPerRound, gameData.playerId]);

    useEffect(() => {
        if (!localState || localState.phase !== 'over') return;
        if (gameData.mode === 'turns' && isController) {
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
    }, [localState, view, roomCode, gameData, isController]);

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
    const waitingForTurn = !isController && view !== 'tv' && gameData.playerId !== 'GROUP';
    const metaList = gameData.participantMeta || [];
    const currentTurnMeta = metaList.find((p) => p.id === gameData.playerId);
    const nextTurnMeta = isTurnsMode
        ? metaList.find((p) => p.id === (gameData.participants || [])[Math.min((gameData.turnIndex || 0) + 1, (gameData.participants || []).length - 1)])
        : null;
    const showSummary = localState.phase === 'summary';
    const earnedPoints = (localState.bestRound || 1) * rewardPerRound;
    const renderNowMs = Number(localState.lastUpdated || localState.nextAt || 0);
    const assistActive = Number(localState.assistUntil || 0) > renderNowMs;
    const phaseWindowMs = Math.max(1, Number(localState.nextAt || 0) - Number(localState.lastNoteAdvanceAt || renderNowMs));
    const phaseProgressPct = (localState.phase === 'playback' || localState.phase === 'input')
        ? clamp(((Number(localState.nextAt || renderNowMs) - renderNowMs) / phaseWindowMs) * 100, 0, 100)
        : 0;
    const showCuePulse = (localState.phase === 'playback' || localState.phase === 'input')
        && renderNowMs - Number(localState.lastNoteAdvanceAt || 0) < 850;

    return (
        <div className="relative w-full h-full bg-black text-white font-saira overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,196,217,0.15),_transparent_60%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(236,72,153,0.18),_transparent_60%)]"></div>

            <div className="absolute top-6 left-8 right-8 flex items-center justify-between z-20">
                <div>
                    <div className="text-sm md:text-base uppercase tracking-[0.24em] md:tracking-[0.3em] text-zinc-300">Riding Scales</div>
                    <div className="text-4xl md:text-5xl font-bebas text-cyan-300">{gameData.playerId === 'GROUP' ? 'THE CROWD' : (gameData.playerName || 'SINGER')}</div>
                    <div className="text-lg md:text-xl text-zinc-300">Repeat the scale pattern as it grows.</div>
                    {isTurnsMode && (
                        <div className="mt-2 text-base uppercase tracking-[0.2em] text-zinc-400">
                            {isController ? "You're up" : `Up now: ${currentTurnMeta?.name || gameData.playerName || 'Singer'}`}
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <div className="text-base uppercase tracking-[0.2em] text-zinc-300">Round</div>
                    <div className="text-5xl md:text-6xl font-black text-white leading-none">{localState.round}</div>
                    <div className="text-base text-zinc-300 mt-1">Strikes: {localState.strikes}/{maxStrikes}</div>
                    <div className="mt-3 flex items-center justify-end gap-2 text-sm uppercase tracking-[0.2em] text-zinc-300">
                        <span className="px-2 py-1 rounded-full border border-white/10 bg-black/40">
                            {difficulty}
                        </span>
                        <span className={`px-2 py-1 rounded-full border ${guideTone ? 'border-emerald-400/40 text-emerald-200 bg-emerald-500/10' : 'border-zinc-600 text-zinc-400 bg-black/40'}`}>
                            Guide tone {guideTone ? 'on' : 'off'}
                        </span>
                    </div>
                    {isTurnsMode && nextTurnMeta?.name && (
                        <div className="text-sm text-zinc-400 mt-2">Next up: {nextTurnMeta.name}</div>
                    )}
                </div>
            </div>
            {hostAssistBanner && (
                <div className="absolute top-[104px] left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                    <div className="rounded-2xl border border-cyan-200/50 bg-gradient-to-r from-cyan-300/95 via-sky-300/95 to-emerald-300/90 px-6 py-3 text-center shadow-[0_0_32px_rgba(34,211,238,0.35)] animate-pulse">
                        <div className="text-xs uppercase tracking-[0.35em] text-black/70">Host Assist</div>
                        <div className="text-2xl md:text-3xl font-black text-black">{hostAssistBanner.label}</div>
                        <div className="text-sm md:text-base font-bold text-black/80">Pattern replay and save from {hostAssistBanner.by}</div>
                    </div>
                </div>
            )}
            <div className="absolute top-[112px] left-1/2 -translate-x-1/2 z-30">
                <div className={`rounded-2xl border px-5 py-2.5 text-center text-sm md:text-base uppercase tracking-[0.18em] shadow-[0_0_24px_rgba(0,0,0,0.35)] ${
                    localState.phase === 'playback'
                        ? 'border-cyan-300/50 bg-cyan-500/15 text-cyan-100'
                        : 'border-pink-300/50 bg-pink-500/15 text-pink-100'
                }`}>
                    {localState.phase === 'playback' ? 'Listen To Sequence' : 'Repeat It Now'}
                </div>
            </div>

            <div className="absolute inset-x-10 top-28 bottom-24 flex flex-col gap-6">
                <div className="grid grid-cols-1 xl:grid-cols-[1.35fr,0.65fr] gap-4">
                    <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
                        <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-zinc-300 mb-2">
                            <span>{localState.phase === 'playback' ? 'Sequence Pace' : 'Response Window'}</span>
                            <span>{Math.max(0, Math.ceil((Number(localState.nextAt || renderNowMs) - renderNowMs) / 1000))}s</span>
                        </div>
                        <div className="h-4 rounded-full border border-white/10 bg-white/10 overflow-hidden">
                            <div className={`h-full transition-all duration-150 ${localState.phase === 'playback' ? 'bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300' : 'bg-gradient-to-r from-pink-300 via-fuchsia-300 to-amber-300'}`} style={{ width: `${phaseProgressPct}%` }} />
                        </div>
                        <div className="mt-2 text-sm text-zinc-300 uppercase tracking-[0.16em]">
                            {assistActive ? 'Scale save armed.' : showCuePulse ? 'Cue changed. Stay with it.' : localState.phase === 'playback' ? 'Listen for the next note.' : 'Close notes count, so keep going.'}
                        </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
                        <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-zinc-300 mb-2">
                            <span>Assist Shield</span>
                            <span>{Math.max(0, Number(localState.assistCharges || 0))}</span>
                        </div>
                        <div className="h-4 rounded-full border border-white/10 bg-white/10 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300 transition-all duration-150" style={{ width: `${Math.min(100, Number(localState.assistCharges || 0) * 100)}%` }} />
                        </div>
                        <div className="mt-2 text-sm text-zinc-300 uppercase tracking-[0.16em]">Next miss gets a replay buffer</div>
                    </div>
                </div>
                <div className="bg-black/50 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between text-base md:text-lg uppercase tracking-[0.16em] text-zinc-300 mb-3">
                        <span>{localState.phase === 'playback' ? 'Listen' : 'Repeat'}</span>
                        <span>{localState.phase === 'playback' ? 'Simon says' : 'Your turn'}</span>
                    </div>
                    <div className="relative h-52 bg-zinc-950/70 border border-white/5 rounded-2xl overflow-hidden">
                        {[0,1,2,3,4].map((i) => (
                            <div key={i} className="absolute left-0 right-0 h-px bg-white/10" style={{ top: `${18 + i * 16}%` }}></div>
                        ))}
                        <div className="absolute left-6 right-6 top-0 bottom-0">
                            {SCALE_NOTES.map((n) => (
                                <div key={n} className="absolute left-0 text-base md:text-lg font-semibold text-zinc-300" style={{ top: `${NOTE_Y[n]}%` }}>{n}</div>
                            ))}
                            {targetNote && (
                                <div className={`absolute left-1/2 w-8 h-8 rounded-full shadow-[0_0_22px_rgba(34,211,238,0.68)] ${showCuePulse ? 'bg-yellow-300 scale-125' : 'bg-cyan-400'} ${assistActive ? 'ring-4 ring-emerald-300/40' : ''}`} style={{ top: `${NOTE_Y[targetNote]}%`, transform: 'translate(-50%, -50%)' }}></div>
                            )}
                            {detected && detected !== '-' && (
                                <div className="absolute left-[60%] w-7 h-7 rounded-full bg-pink-400 shadow-[0_0_16px_rgba(236,72,153,0.6)]" style={{ top: `${NOTE_Y[detected] || 50}%`, transform: 'translate(-50%, -50%)' }}></div>
                            )}
                        </div>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-lg md:text-2xl text-zinc-200">Detected: <span className="text-white font-bold">{detected}</span></div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {localState.sequence.map((n, idx) => (
                        <div key={`${n}-${idx}`} className={`px-3 py-1.5 rounded-full text-base md:text-xl font-bold border ${localState.phase === 'playback' && idx === localState.playbackIndex ? 'border-cyan-300 text-cyan-200 bg-cyan-500/10' : localState.phase === 'input' && idx === localState.inputIndex ? 'border-pink-300 text-pink-200 bg-pink-500/10' : 'border-white/10 text-zinc-400 bg-black/20'}`}>
                            {n}
                        </div>
                    ))}
                </div>
            </div>

            {showSummary && (
                <div className="absolute inset-0 bg-black/75 z-30 flex items-center justify-center text-center">
                    <div className="bg-zinc-900/90 border border-white/10 rounded-3xl px-8 py-6 max-w-lg">
                        <div className="text-base uppercase tracking-[0.24em] text-zinc-300">Round Summary</div>
                        <div className="text-5xl md:text-6xl font-bebas text-cyan-300 mt-2">Round {localState.bestRound}</div>
                        <div className="text-lg md:text-xl text-zinc-300 mt-1">Strikes {localState.strikes}/{maxStrikes}</div>
                        <div className="text-3xl md:text-4xl font-bold text-white mt-4">+{earnedPoints} pts</div>
                        {isTurnsMode && nextTurnMeta?.name && (
                            <div className="text-base uppercase tracking-[0.2em] text-zinc-400 mt-4">Next up: {nextTurnMeta.name}</div>
                        )}
                    </div>
                </div>
            )}

            {waitingForTurn && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30 text-center">
                    <div className="bg-zinc-900/80 border border-white/10 rounded-2xl px-6 py-4">
                        <div className="text-base uppercase tracking-[0.24em] text-zinc-300">Riding Scales</div>
                        <div className="text-4xl md:text-5xl font-bebas text-cyan-300 mt-2">Waiting for your turn</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RidingScalesGame;
