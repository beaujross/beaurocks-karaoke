import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { usePitch } from '../../hooks/usePitch';
import { db, doc, updateDoc, collection, query, where, getDocs, writeBatch, increment } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';
import { playVoiceGameGuideTone } from '../../lib/voiceGameSoundSystem';
import CrowdControlStartOverlay from '../shared/CrowdControlStartOverlay';
import CrowdMicInputVisualizer from '../shared/CrowdMicInputVisualizer';
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

const buildGameDataPatch = (payload = {}) => Object.entries(payload).reduce((patch, [key, value]) => {
    if (key === 'voiceTelemetry') return patch;
    patch[`gameData.${key}`] = value;
    return patch;
}, {});

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

const buildRidingScalesRecap = (state = {}, gameData = {}) => {
    const now = Date.now();
    const bestRound = Math.max(1, Number(state.bestRound || state.round || 1));
    const checkpointCount = Math.max(0, Number(state.checkpointCount || 0));
    const phraseLocks = Array.isArray(state.phraseLocks) ? state.phraseLocks.length : 0;
    return {
        active: true,
        mode: 'riding_scales',
        title: 'Riding Scales',
        playerName: String(gameData.playerName || (gameData.playerId === 'GROUP' ? 'The Crowd' : 'Singer')),
        headline: `Round ${bestRound} reached`,
        summary: checkpointCount > 0 ? 'The room built a longer scale and banked checkpoints.' : 'The scale run is logged. Reset quickly for another climb.',
        createdAtMs: now,
        tvUntilMs: now + 22000,
        stats: [
            { label: 'Best round', value: bestRound },
            { label: 'Checkpoints', value: checkpointCount },
            { label: 'Locks', value: phraseLocks },
            { label: 'Strikes', value: `${Math.max(0, Number(state.strikes || 0))}/${Math.max(1, Number(gameData.maxStrikes || 3))}` }
        ],
        highlights: [
            gameData.mode === 'crowd' ? 'Crowd scale' : 'Spotlight turns',
            `${Math.max(0, Number(state.sequence?.length || 0))} note phrase`,
            gameData.guideTone === false ? 'No guide tone' : 'Guide tone on'
        ]
    };
};
const RidingScalesGame = ({ isPlayer, roomCode, playerData, gameState, inputSource, view = 'tv', user }) => {
    const gameData = useMemo(() => (playerData || gameState || {}), [playerData, gameState]);
    const soundOptions = useMemo(() => ({
        soundPack: gameData.soundPack || null,
        basePath: gameData.soundPackBasePath || gameData.soundPack?.basePath || undefined,
        voiceRoomTuning: gameData.voiceRoomTuning || 'forgiving_room'
    }), [gameData.soundPack, gameData.soundPackBasePath, gameData.voiceRoomTuning]);
    const controlSource = gameData.inputSource || inputSource || 'remote';
    const isRoomControlled = controlSource === 'ambient' || controlSource === 'crowd' || controlSource === 'local';
    const usesHostRoomMic = isRoomControlled && String(gameData.voiceInput || '').trim().toLowerCase() === 'host';
    const hostVoiceTelemetry = useMemo(() => gameData.voiceTelemetry || {}, [gameData.voiceTelemetry]);
    const hostVoiceCapturedAtMs = Number(hostVoiceTelemetry?.capturedAtMs || hostVoiceTelemetry?.timestampMs || 0);
    const hostVoiceAgeMs = hostVoiceCapturedAtMs > 0 ? Math.max(0, Date.now() - hostVoiceCapturedAtMs) : Number.POSITIVE_INFINITY;
    const hostVoiceFresh = usesHostRoomMic && !!hostVoiceTelemetry?.active && hostVoiceCapturedAtMs > 0 && hostVoiceAgeMs <= 2200;
    const isController = isPlayer && (isRoomControlled ? view === 'tv' : view !== 'tv');
    const isLocalInput = isController && inputSource !== 'remote' && !usesHostRoomMic;
    const {
        pitch: localPitch,
        stableNote: localStableNote,
        note: localNote,
        confidence: localConfidence,
        isSinging: localIsSinging,
        volumeNormalized: localVolumeNormalized
    } = usePitch(isLocalInput, {
        smoothingFactor: 0.42,
        confidenceThreshold: 0.32,
        singingThreshold: 0.032,
        stableNoteMs: 180,
        noiseGateMultiplier: 1.28
    });
    const pitch = hostVoiceFresh ? Number(hostVoiceTelemetry.pitch || 0) : localPitch;
    const stableNote = hostVoiceFresh ? String(hostVoiceTelemetry.stableNote || hostVoiceTelemetry.note || '-') : localStableNote;
    const note = hostVoiceFresh ? String(hostVoiceTelemetry.note || '-') : localNote;
    const confidence = hostVoiceFresh ? Number(hostVoiceTelemetry.confidence || 0) : localConfidence;
    const volumeNormalized = hostVoiceFresh ? Number(hostVoiceTelemetry.volumeNormalized || 0) : localVolumeNormalized;
    const isSinging = hostVoiceFresh ? !!hostVoiceTelemetry.isSinging || confidence >= 0.2 : localIsSinging;

    const [localState, setLocalState] = useState(null);
    const [rewarded, setRewarded] = useState(false);
    const [hostAssistBanner, setHostAssistBanner] = useState(null);
    const [launchClockMs, setLaunchClockMs] = useState(() => Date.now());

    const stateRef = useRef(null);
    const matchRef = useRef({ note: '-', since: 0 });

    const lastToneIndexRef = useRef(null);
    const rewardRef = useRef(false);
    const endRef = useRef(false);
    const advanceRef = useRef(false);
    const pitchRef = useRef(pitch);
    const lastHostAssistIdRef = useRef('');
    const hostAssistBannerTimeoutRef = useRef(null);

    useEffect(() => {
        if (view !== 'tv') return undefined;
        const timer = setInterval(() => setLaunchClockMs(Date.now()), 180);
        return () => clearInterval(timer);
    }, [view]);

    const maxStrikes = Number(gameData.maxStrikes || VOICE_GAME_FUN_DEFAULTS.ridingScales.maxStrikes);
    const rewardPerRound = Number(gameData.rewardPerRound || VOICE_GAME_FUN_DEFAULTS.ridingScales.rewardPerRound);
    const difficulty = gameData.difficulty || VOICE_GAME_FUN_DEFAULTS.ridingScales.difficulty;
    const guideTone = gameData.guideTone !== false;
    const holdMs = getRidingScalesHoldMs(difficulty);
    const isTurnsMode = gameData.mode === 'turns';
    const summaryDurationMs = 2500;
    const introDurationMs = gameData.mode === 'crowd' ? 3200 : 2400;

    const syncState = useCallback((next) => {
        stateRef.current = next;
        setLocalState(next);
    }, []);

    const writeState = useCallback(async (payload) => {
        await updateDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode),
            buildGameDataPatch(payload)
        );
    }, [roomCode]);

    const ensureInit = useCallback(() => {
        if (!isController) return;
        if (stateRef.current) return;
        const round = 1;
        const length = 3;
        const sequence = buildSequence(length, difficulty);
        const stepMsList = buildRidingScalesStepMsList(length, round, difficulty);
        const now = Date.now();
        const requestedLaunchAt = Math.max(0, Number(gameData.voiceLaunchAtMs || 0));
        const launchAt = usesHostRoomMic ? Math.max(now + introDurationMs, requestedLaunchAt) : now + introDurationMs;
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
            nextAt: launchAt + stepMsList[0],
            detectedNote: '-',
            summaryUntil: null,
            assistUntil: null,
            assistCharges: 1,
            phraseLocks: [],
            checkpointCount: 0,
            checkpointHistory: [],
            lastCheckpoint: null,
            introEndsAt: launchAt,
            voiceLaunchAtMs: launchAt,
            voiceLaunchWarmupMs: Math.max(0, Number(gameData.voiceLaunchWarmupMs || introDurationMs)),
            launchCueId: Math.max(0, Number(gameData.launchCueId || 0)),
            lastPhaseChangeAt: launchAt,
            lastNoteAdvanceAt: launchAt,
            lastUpdated: now
        };
        syncState(init);
        writeState(init);
    }, [isController, difficulty, gameData, syncState, writeState, introDurationMs, usesHostRoomMic]);

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
            const energyPulse = usesHostRoomMic && gameData.mode === 'crowd' && volumeNormalized >= 0.075;
            const displayNote = stableNote !== '-' ? stableNote : (energyPulse ? 'POWER' : note);
            state.detectedNote = displayNote;
            const assistActive = Number(state.assistUntil || 0) > current;
            const launchAtMs = Math.max(0, Number(state.introEndsAt || state.voiceLaunchAtMs || 0));
            const waitingForLaunch = (state.phase === 'playback' || state.phase === 'input') && launchAtMs > current;
            if (waitingForLaunch) {
                if (usesHostRoomMic) {
                    state.inputSource = controlSource;
                    state.voiceInput = 'host';
                }
                state.lastUpdated = current;
                syncState(state);
                flushStateWrite(state);
                return;
            }

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
                const energyStepMatch = usesHostRoomMic && gameData.mode === 'crowd' && volumeNormalized >= (assistActive ? 0.065 : 0.095);
                const isMatch = isSinging
                    && (confidence >= relaxedConfidence || energyStepMatch)
                    && (exactNote || Math.abs(centsOff) <= tuneWindow || energyStepMatch);
                if (isMatch) {
                    if (matchRef.current.note !== targetNote) {
                        matchRef.current = { note: targetNote, since: current };
                    } else if (current - matchRef.current.since >= Math.max(80, Math.round(holdMs * (assistActive ? 0.65 : 1)))) {
                        const lockEntry = {
                            at: current,
                            round: Number(state.round || 1),
                            index: Number(state.inputIndex || 0),
                            note: targetNote
                        };
                        state.phraseLocks = [
                            ...(Array.isArray(state.phraseLocks) ? state.phraseLocks.filter((entry) => Number(entry?.index) !== Number(state.inputIndex || 0)) : []),
                            lockEntry
                        ].slice(-10);
                        const nextInput = state.inputIndex + 1;
                        if (nextInput >= state.sequence.length) {
                            const checkpoint = {
                                at: current,
                                round: Number(state.round || 1),
                                length: Number(state.sequence?.length || 0),
                                phrase: Array.isArray(state.sequence) ? state.sequence.join('-') : ''
                            };
                            const nextRound = state.round + 1;
                            const nextLen = state.sequence.length + getRidingScalesLengthIncrement(state.round, difficulty);
                            const nextSeq = buildSequence(nextLen, difficulty);
                            const nextSteps = buildRidingScalesStepMsList(nextLen, nextRound, difficulty);
                            state.checkpointCount = Math.max(0, Number(state.checkpointCount || 0)) + 1;
                            state.lastCheckpoint = checkpoint;
                            state.checkpointHistory = [
                                checkpoint,
                                ...(Array.isArray(state.checkpointHistory) ? state.checkpointHistory : [])
                            ].slice(0, 4);
                            state.round = nextRound;
                            state.bestRound = Math.max(state.bestRound || 1, state.round);
                            state.sequence = nextSeq;
                            state.stepMsList = nextSteps;
                            state.phraseLocks = [];
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
                        state.phraseLocks = [];
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
                            state.phraseLocks = [];
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

            if (usesHostRoomMic) {
                state.inputSource = controlSource;
                state.voiceInput = 'host';
            }
            state.lastUpdated = current;
            syncState(state);
            flushStateWrite(state);
        }, 200);

        return () => {
            cancelled = true;
            clearInterval(loop);
        };
    }, [isController, stableNote, note, confidence, isSinging, maxStrikes, difficulty, holdMs, writeState, syncState, usesHostRoomMic, hostVoiceFresh, controlSource, volumeNormalized, gameData.mode]);

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
        const toneDurationSec = clamp(((localState.stepMsList?.[localState.playbackIndex] || getRidingScalesStepMs(localState.round, difficulty)) / 1000) * 0.72, 0.45, 1.35);
        playVoiceGameGuideTone({
            mode: 'riding_scales',
            cue: 'guide',
            frequency: freq,
            durationSec: toneDurationSec,
            intensity: 1.08
        });
    }, [localState, guideTone, view, isController, difficulty, soundOptions]);

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
                        phraseLocks: [],
                        checkpointCount: 0,
                        checkpointHistory: [],
                        lastCheckpoint: null,
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
            gameData: { recap: buildRidingScalesRecap(localState, gameData) }
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
    const phraseLocks = Array.isArray(localState.phraseLocks) ? localState.phraseLocks : [];
    const lockedNoteIndexes = new Set(phraseLocks.map((entry) => Number(entry?.index || 0)));
    const checkpointHistory = Array.isArray(localState.checkpointHistory) ? localState.checkpointHistory.slice(0, 4) : [];
    const phraseLockPct = clamp((phraseLocks.length / Math.max(1, Number(localState.sequence?.length || 1))) * 100, 0, 100);
    const checkpointCount = Math.max(0, Number(localState.checkpointCount || 0));
    const earnedPoints = (localState.bestRound || 1) * rewardPerRound;
    const renderNowMs = Math.max(Number(localState.lastUpdated || localState.nextAt || 0), launchClockMs);
    const assistActive = Number(localState.assistUntil || 0) > renderNowMs;
    const introActive = Number(localState.introEndsAt || localState.voiceLaunchAtMs || 0) > renderNowMs;
    const launchCountdownSec = Math.max(0, Math.ceil((Number(localState.introEndsAt || localState.voiceLaunchAtMs || 0) - renderNowMs) / 1000));
    const preGameActive = introActive;
    const phaseWindowMs = Math.max(1, Number(localState.nextAt || 0) - Number(localState.lastNoteAdvanceAt || renderNowMs));
    const phaseProgressPct = (localState.phase === 'playback' || localState.phase === 'input')
        ? clamp(((Number(localState.nextAt || renderNowMs) - renderNowMs) / phaseWindowMs) * 100, 0, 100)
        : 0;
    const showCuePulse = (localState.phase === 'playback' || localState.phase === 'input')
        && renderNowMs - Number(localState.lastNoteAdvanceAt || 0) < 850;
    const breathWindowActive = localState.phase === 'input' && !showCuePulse && phaseProgressPct > 68;
    const scaleCommand = preGameActive
        ? { label: introActive ? `STARTS IN ${launchCountdownSec}` : 'MIC CHECK', helper: hostVoiceFresh ? 'Host mic is live. Keep the room singing until GO.' : 'Host mic is not feeding this scale yet. Arm it and sing into the room mic.', toneClass: hostVoiceFresh ? 'border-cyan-200/45 bg-cyan-400/14 text-cyan-100' : 'border-amber-200/45 bg-amber-400/14 text-amber-100' }
        : localState.phase === 'playback'
        ? { label: 'LISTEN', helper: `Memorize ${targetNote || 'the next note'}. No scoring yet.`, toneClass: 'border-cyan-200/45 bg-cyan-400/14 text-cyan-100' }
        : assistActive
            ? { label: 'SCALE SAVE', helper: 'Replay buffer is armed. Keep the phrase alive.', toneClass: 'border-emerald-200/45 bg-emerald-400/14 text-emerald-100' }
            : breathWindowActive
                ? { label: 'BREATHE', helper: 'Reset your voice, then lock the next note.', toneClass: 'border-amber-200/45 bg-amber-400/14 text-amber-100' }
                : showCuePulse
                    ? { label: 'LOCK NOTE', helper: `Target ${targetNote || '-'}. Close notes count.`, toneClass: 'border-pink-200/45 bg-pink-400/14 text-pink-100' }
                    : { label: 'REPEAT', helper: `Echo the pattern. ${Math.max(0, Number(localState.sequence?.length || 0))} notes in play.`, toneClass: 'border-pink-200/40 bg-pink-400/12 text-pink-100' };

    return (
        <div className="relative w-full h-full bg-black text-white font-saira overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,196,217,0.15),_transparent_60%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(236,72,153,0.18),_transparent_60%)]"></div>

            <div className="absolute top-6 left-8 right-8 flex items-center justify-between z-20">
                <div>
                    <div className="text-sm md:text-base uppercase tracking-[0.24em] md:tracking-[0.3em] text-zinc-300">Riding Scales</div>
                    <div className="text-4xl md:text-5xl font-bebas text-cyan-300">{gameData.playerId === 'GROUP' ? 'THE CROWD' : (gameData.playerName || 'SINGER')}</div>
                    <div className="text-lg md:text-xl text-zinc-300">{gameData.playerId === 'GROUP' ? 'Listen together, then echo the pattern back as a room.' : 'Repeat the scale pattern as it grows.'}</div>
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
            <CrowdControlStartOverlay
                enabled={view === 'tv' && gameData.mode === 'crowd'}
                modeTitle="Riding Scales"
                nowMs={renderNowMs}
                launchAtMs={Number(localState.introEndsAt || localState.voiceLaunchAtMs || 0)}
                warmupMs={Number(localState.voiceLaunchWarmupMs || gameData.voiceLaunchWarmupMs || introDurationMs)}
                micReady={!usesHostRoomMic || hostVoiceFresh}
                requireMic={usesHostRoomMic}
                live={(localState.phase === 'playback' || localState.phase === 'input') && !introActive}
                controlLabel="The crowd is riding the scale now."
                instruction="Listen for the guide notes, then echo the scale as a room."
                accent="emerald"
            />
            <CrowdMicInputVisualizer
                enabled={view === 'tv' && gameData.mode === 'crowd'}
                telemetry={hostVoiceTelemetry}
                nowMs={renderNowMs}
                label="Crowd Mic"
                helper="Scale input"
                accent="emerald"
                className="absolute bottom-6 left-8 w-[min(30vw,360px)]"
            />
            {hostAssistBanner && (
                <div className="absolute top-[104px] left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                    <div className="rounded-2xl border border-cyan-200/50 bg-gradient-to-r from-cyan-300/95 via-sky-300/95 to-emerald-300/90 px-6 py-3 text-center shadow-[0_0_32px_rgba(34,211,238,0.35)] animate-pulse">
                        <div className="text-xs uppercase tracking-[0.35em] text-black/70">Host Assist</div>
                        <div className="text-2xl md:text-3xl font-black text-black">{hostAssistBanner.label}</div>
                        <div className="text-sm md:text-base font-bold text-black/80">Pattern replay and save from {hostAssistBanner.by}</div>
                    </div>
                </div>
            )}
            <div className="pointer-events-none absolute inset-x-[10%] top-[112px] z-30 flex justify-center">
                <div className={`max-w-[960px] rounded-[30px] border px-7 py-4 text-center shadow-[0_0_42px_rgba(0,0,0,0.36)] ${scaleCommand.toneClass}`}>
                    <div className="text-[10px] font-black uppercase tracking-[0.32em] opacity-75">Scale Command</div>
                    <div className="mt-1 text-[clamp(2.5rem,7vw,6.5rem)] font-black leading-none text-white">{scaleCommand.label}</div>
                    <div className="mt-2 text-[clamp(0.9rem,1.6vw,1.4rem)] font-black uppercase tracking-[0.16em] opacity-85">{scaleCommand.helper}</div>
                </div>
            </div>
            {preGameActive && gameData.mode !== 'crowd' && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-6 text-center pointer-events-none">
                    <div className="max-w-3xl rounded-[2rem] border border-white/10 bg-black/72 px-8 py-6 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
                        <div className="text-xs uppercase tracking-[0.34em] text-zinc-400">{gameData.playerId === 'GROUP' ? 'Crowd Launch' : 'Warmup'}</div>
                        <div className="mt-3 text-4xl md:text-5xl font-black text-cyan-200">
                            {introActive ? `Starts in ${launchCountdownSec}` : 'Waiting for host mic'}
                        </div>
                        <div className="mt-3 text-lg text-zinc-300">
                            {hostVoiceFresh
                                ? 'Host mic is live. Listen through GO, then echo the scale together.'
                                : 'Arm the Host mic and sing into the room mic before the scale begins.'}
                        </div>
                    </div>
                </div>
            )}

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
                            {assistActive ? 'Scale save armed.' : breathWindowActive ? 'Breath window. Prepare, then lock the note.' : showCuePulse ? 'Cue changed. Stay with it.' : localState.phase === 'playback' ? 'Listen for the next note.' : 'Close notes count, so keep going.'}
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

                <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
                    <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-zinc-300 mb-3">
                        <span>Scale Locks</span>
                        <span>{checkpointCount} checkpoints</span>
                    </div>
                    <div className="h-3 rounded-full border border-white/10 bg-white/10 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 transition-all duration-150" style={{ width: `${phraseLockPct}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                        {checkpointHistory.length ? checkpointHistory.map((entry, idx) => (
                            <div key={`${entry.round}-${entry.at || idx}`} className="rounded-2xl border border-emerald-300/30 bg-emerald-500/12 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-100/75">Checkpoint</div>
                                <div className="mt-1 text-lg font-black text-white">Round {entry.round}</div>
                                <div className="text-xs uppercase tracking-[0.12em] text-emerald-100/75 truncate">{entry.phrase || `${entry.length || 0} notes`}</div>
                            </div>
                        )) : (
                            <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm uppercase tracking-[0.16em] text-zinc-400">
                                Lock every note in the phrase to bank a checkpoint.
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {localState.sequence.map((n, idx) => (
                        <div key={`${n}-${idx}`} className={`px-3 py-1.5 rounded-full text-base md:text-xl font-bold border ${lockedNoteIndexes.has(idx) ? 'border-emerald-300 text-emerald-100 bg-emerald-500/15' : localState.phase === 'playback' && idx === localState.playbackIndex ? 'border-cyan-300 text-cyan-200 bg-cyan-500/10' : localState.phase === 'input' && idx === localState.inputIndex ? 'border-pink-300 text-pink-200 bg-pink-500/10' : 'border-white/10 text-zinc-400 bg-black/20'}`}>
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
                        <div className="text-lg md:text-xl text-zinc-300 mt-1">Strikes {localState.strikes}/{maxStrikes} | {checkpointCount} checkpoints</div>
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
