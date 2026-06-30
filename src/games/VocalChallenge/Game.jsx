import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { usePitch } from '../../hooks/usePitch';
import { db, doc, updateDoc, collection, query, where, getDocs, writeBatch, increment } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';
import { playVoiceGameGuideTone } from '../../lib/voiceGameSoundSystem';
import VoiceHud from '../../components/VoiceHud';
import CrowdControlStartOverlay from '../shared/CrowdControlStartOverlay';
import CrowdMicInputVisualizer from '../shared/CrowdMicInputVisualizer';
import {
    VOICE_GAME_FUN_DEFAULTS,
    getVocalChallengeDifficultyConfig,
    getVocalChallengeSequenceLength
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
const VOCAL_ASSIST_DEFAULT_MS = 6000;
const VOCAL_ASSIST_BANNER_MS = 2400;

const buildGameDataPatch = (payload = {}) => Object.entries(payload).reduce((patch, [key, value]) => {
    if (key === 'voiceTelemetry') return patch;
    patch[`gameData.${key}`] = value;
    return patch;
}, {});

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

const buildVocalChallengeRecap = (state = {}, data = {}) => {
    const now = Date.now();
    const history = Array.isArray(state.resultHistory) ? state.resultHistory : [];
    const lockedCount = history.filter((entry) => entry?.quality === 'perfect').length;
    const nearCount = history.filter((entry) => entry?.quality === 'near').length;
    return {
        active: true,
        mode: 'vocal_challenge',
        title: 'Vocal Challenge',
        playerName: String(data.playerName || state.playerName || (data.mode === 'crowd' ? 'The Crowd' : 'Singer')),
        headline: `${Math.max(0, Number(state.score || 0))} ribbon points`,
        summary: lockedCount > 0 ? 'Locked notes led the round. Near matches kept it forgiving.' : 'The room found the ribbon and logged a quick vocal run.',
        createdAtMs: now,
        tvUntilMs: now + 22000,
        stats: [
            { label: 'Score', value: Math.max(0, Number(state.score || 0)) },
            { label: 'Best streak', value: Math.max(0, Number(state.bestStreak || state.streak || 0)) },
            { label: 'Locks', value: lockedCount },
            { label: 'Near saves', value: nearCount }
        ],
        highlights: [
            data.mode === 'crowd' ? 'Crowd ribbon' : 'Spotlight turn',
            `${Math.max(0, Number(state.targetIndex || 0))} notes chased`,
            data.guideTone === false ? 'No guide tone' : 'Guide tone on'
        ]
    };
};
const VocalChallengeGame = ({ isPlayer, roomCode, playerData, gameState, inputSource, view = 'tv', user }) => {
    const data = useMemo(() => (playerData || gameState || {}), [playerData, gameState]);
    const soundOptions = useMemo(() => ({
        soundPack: data.soundPack || null,
        basePath: data.soundPackBasePath || data.soundPack?.basePath || undefined,
        voiceRoomTuning: data.voiceRoomTuning || 'forgiving_room'
    }), [data.soundPack, data.soundPackBasePath, data.voiceRoomTuning]);
    const controlSource = data.inputSource || inputSource || 'remote';
    const isRoomControlled = controlSource === 'ambient' || controlSource === 'crowd' || controlSource === 'local';
    const usesHostRoomMic = isRoomControlled && String(data.voiceInput || '').trim().toLowerCase() === 'host';
    const hostVoiceTelemetry = useMemo(() => data.voiceTelemetry || {}, [data.voiceTelemetry]);
    const hostVoiceCapturedAtMs = Number(hostVoiceTelemetry?.capturedAtMs || hostVoiceTelemetry?.timestampMs || 0);
    const hostVoiceAgeMs = hostVoiceCapturedAtMs > 0 ? Math.max(0, Date.now() - hostVoiceCapturedAtMs) : Number.POSITIVE_INFINITY;
    const hostVoiceFresh = usesHostRoomMic && !!hostVoiceTelemetry?.active && hostVoiceCapturedAtMs > 0 && hostVoiceAgeMs <= 2200;
    const isController = isPlayer && (isRoomControlled ? view === 'tv' : view !== 'tv');
    const isLocalInput = isController && inputSource !== 'remote' && !usesHostRoomMic;
    const {
        pitch: localPitch,
        note: localNote,
        confidence: localConfidence,
        volumeNormalized: localVolumeNormalized,
        stableNote: localStableNote,
        stability: localStability,
        calibrating: localCalibrating,
        isSinging: localIsSinging
    } = usePitch(isLocalInput, {
        smoothingFactor: 0.44,
        confidenceThreshold: isRoomControlled ? 0.36 : 0.42,
        singingThreshold: 0.034,
        stableNoteMs: 180,
        noiseGateMultiplier: 1.32
    });
    const pitch = hostVoiceFresh ? Number(hostVoiceTelemetry.pitch || 0) : localPitch;
    const note = hostVoiceFresh ? String(hostVoiceTelemetry.note || '-') : localNote;
    const confidence = hostVoiceFresh ? Number(hostVoiceTelemetry.confidence || 0) : localConfidence;
    const volumeNormalized = hostVoiceFresh ? Number(hostVoiceTelemetry.volumeNormalized || 0) : localVolumeNormalized;
    const stableNote = hostVoiceFresh ? String(hostVoiceTelemetry.stableNote || hostVoiceTelemetry.note || '-') : localStableNote;
    const stability = hostVoiceFresh ? Number(hostVoiceTelemetry.stability || 0) : localStability;
    const calibrating = usesHostRoomMic ? !!hostVoiceTelemetry.calibrating : localCalibrating;
    const isSinging = hostVoiceFresh ? !!hostVoiceTelemetry.isSinging || volumeNormalized >= 0.032 || confidence >= 0.2 : localIsSinging;

    const [localState, setLocalState] = useState(null);
    const [remoteVoice, setRemoteVoice] = useState({ note: '-', confidence: 0, volumeNormalized: 0, stableNote: '-', stability: 0 });
    const [hostAssistBanner, setHostAssistBanner] = useState(null);
    const [launchClockMs, setLaunchClockMs] = useState(() => Date.now());

    const stateRef = useRef(null);
    const matchRef = useRef({ note: '-', quality: 'none', since: 0 });
    const rewardRef = useRef(false);
    const endRef = useRef(false);
    const advanceRef = useRef(false);

    const lastToneIndexRef = useRef(null);
    const pitchRef = useRef(pitch);
    const lastHostAssistIdRef = useRef('');
    const hostAssistBannerTimeoutRef = useRef(null);

    useEffect(() => {
        if (view !== 'tv') return undefined;
        const timer = setInterval(() => setLaunchClockMs(Date.now()), 180);
        return () => clearInterval(timer);
    }, [view]);

    const difficulty = data.difficulty || VOICE_GAME_FUN_DEFAULTS.vocalChallenge.difficulty;
    const guideTone = data.guideTone !== false;
    const turnDurationMs = Math.max(10, Number(data.turnDurationMs || (VOICE_GAME_FUN_DEFAULTS.vocalChallenge.durationSec * 1000)));
    const mode = data.mode || (data.inputSource === 'ambient' ? 'crowd' : 'turns');
    const isTurnsMode = mode === 'turns';
    const summaryDurationMs = 2500;
    const crowdMode = isRoomControlled && mode === 'crowd';
    const introDurationMs = crowdMode ? 3200 : 2400;
    const { intervalMs, holdMs, minConfidence, minStability } = useMemo(
        () => getVocalChallengeDifficultyConfig(difficulty, { crowdMode }),
        [difficulty, crowdMode]
    );

    const writeState = useCallback(async (payload) => {
        await updateDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode),
            buildGameDataPatch(payload)
        );
    }, [roomCode]);

    const ensureInit = useCallback(() => {
        if (!isController) return;
        if (stateRef.current) return;
        const length = getVocalChallengeSequenceLength(difficulty);
        const sequence = buildMelody(length, difficulty);
        const now = Date.now();
        const requestedLaunchAt = Math.max(0, Number(data.voiceLaunchAtMs || 0));
        const launchAt = usesHostRoomMic ? Math.max(now + introDurationMs, requestedLaunchAt) : now + introDurationMs;
        const init = {
            ...data,
            phase: 'playing',
            score: 0,
            streak: 0,
            lastAward: null,
            resultHistory: [],
            sequence,
            targetIndex: 0,
            nextNoteAt: launchAt + Math.max(intervalMs + 900, crowdMode ? 3200 : 2500),
            detectedNote: '-',
            targetNote: sequence[0],
            turnEndsAt: launchAt + turnDurationMs,
            summaryUntil: null,
            assistUntil: null,
            introEndsAt: launchAt,
            voiceLaunchAtMs: launchAt,
            voiceLaunchWarmupMs: Math.max(0, Number(data.voiceLaunchWarmupMs || introDurationMs)),
            launchCueId: Math.max(0, Number(data.launchCueId || 0)),
            lastTargetChangeAt: launchAt,
            lastUpdated: now
        };
        stateRef.current = init;
        setLocalState(init);
        writeState(init);
    }, [isController, difficulty, data, intervalMs, turnDurationMs, writeState, crowdMode, introDurationMs, usesHostRoomMic]);

    useEffect(() => {
        const t = setTimeout(() => ensureInit(), 0);
        return () => clearTimeout(t);
    }, [ensureInit]);

    useEffect(() => {
        if (isController) return;
        if (!data?.phase) return;
        stateRef.current = data;
        const t = setTimeout(() => {
            setLocalState(data);
            if (data.voice) setRemoteVoice(data.voice);
        }, 0);
        return () => clearTimeout(t);
    }, [isController, data]);

    useEffect(() => {
        pitchRef.current = pitch;
    }, [pitch]);

    useEffect(() => {
        const hostAssist = data?.hostAssist;
        const assistId = String(hostAssist?.id || '').trim();
        if (!assistId || assistId === lastHostAssistIdRef.current) return;
        const nextState = stateRef.current ? { ...stateRef.current } : null;
        if (!nextState) {
            lastHostAssistIdRef.current = assistId;
            return;
        }
        const durationMs = Math.max(1200, Number(hostAssist?.durationMs || VOCAL_ASSIST_DEFAULT_MS));
        const triggeredAt = Number(hostAssist?.triggeredAt || Date.now());
        if (Date.now() - triggeredAt > durationMs + VOCAL_ASSIST_BANNER_MS + 1500) {
            lastHostAssistIdRef.current = assistId;
            return;
        }
        lastHostAssistIdRef.current = assistId;
        nextState.hostAssist = hostAssist;
        nextState.assistUntil = triggeredAt + durationMs;
        nextState.nextNoteAt = Math.max(Number(nextState.nextNoteAt || 0), Date.now() + 900);
        nextState.lastUpdated = Date.now();
        stateRef.current = nextState;
        const commitTimer = setTimeout(() => {
            setLocalState(nextState);
            setHostAssistBanner({
                label: hostAssist?.label || 'HARMONY BOOST',
                by: hostAssist?.by || 'Host'
            });
            if (hostAssistBannerTimeoutRef.current) clearTimeout(hostAssistBannerTimeoutRef.current);
            hostAssistBannerTimeoutRef.current = setTimeout(() => setHostAssistBanner(null), VOCAL_ASSIST_BANNER_MS);
        }, 0);
        return () => clearTimeout(commitTimer);
    }, [data]);

    useEffect(() => () => {
        if (hostAssistBannerTimeoutRef.current) clearTimeout(hostAssistBannerTimeoutRef.current);
    }, []);

    useEffect(() => {
        if (!isController) {
            stateRef.current = null;
            return;
        }
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
                    console.error('VocalChallenge state sync error:', e);
                }
                payload = queuedState;
                queuedState = null;
            }
            writeInFlight = false;
        };

        const loop = setInterval(() => {
            const state = { ...stateRef.current };
            const now = Date.now();
            const energyPulse = crowdMode && usesHostRoomMic && volumeNormalized >= 0.075;
            const displayNote = stableNote !== '-' ? stableNote : (energyPulse ? 'POWER' : note);
            state.detectedNote = displayNote;
            const launchAtMs = Math.max(0, Number(state.introEndsAt || state.voiceLaunchAtMs || 0));
            const waitingForLaunch = state.phase === 'playing' && launchAtMs > now;
            if (waitingForLaunch) {
                if (usesHostRoomMic) {
                    state.inputSource = controlSource;
                    state.voiceInput = 'host';
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
                flushStateWrite(state);
                return;
            }

            if (state.phase === 'summary') {
                if (state.summaryUntil && now >= state.summaryUntil) {
                    state.phase = 'over';
                }
            } else if (state.phase === 'playing') {
                const assistActive = Number(state.assistUntil || 0) > now;
                if (now >= state.turnEndsAt) {
                    state.phase = 'summary';
                    state.summaryUntil = now + summaryDurationMs;
                } else if (now >= state.nextNoteAt) {
                    const nextIndex = (state.targetIndex + 1) % state.sequence.length;
                    state.targetIndex = nextIndex;
                    state.targetNote = state.sequence[nextIndex];
                    state.nextNoteAt = now + intervalMs + Math.floor((Math.random() * 120) - 40) + (assistActive ? 320 : 120);
                    state.lastTargetChangeAt = now;
                }

                const targetNote = state.sequence[state.targetIndex];
                const targetFreq = NOTE_FREQ[targetNote] || 0;
                const centsOff = targetFreq ? centsBetween(pitchRef.current || 0, targetFreq) : 9999;
                const inTune = Math.abs(centsOff) <= (assistActive ? 220 : crowdMode ? 200 : 175);
                const nearTune = Math.abs(centsOff) <= (assistActive ? 320 : crowdMode ? 300 : 255);
                const exactNote = (displayNote === targetNote) || (stableNote === targetNote);
                const energyLaneMatch = crowdMode && usesHostRoomMic && volumeNormalized >= (assistActive ? 0.065 : 0.095);
                const relaxedConfidence = Math.max(crowdMode ? 0.16 : 0.2, minConfidence - (assistActive ? 0.22 : crowdMode ? 0.1 : 0.06));
                const relaxedStability = Math.max(crowdMode ? 0.05 : 0.08, minStability - (assistActive ? 0.18 : crowdMode ? 0.06 : 0.04));
                const nearConfidence = Math.max(crowdMode ? 0.12 : 0.16, relaxedConfidence - 0.06);
                const nearStability = Math.max(crowdMode ? 0.04 : 0.06, relaxedStability - 0.06);
                const fullMatch = isSinging
                    && (confidence >= relaxedConfidence || energyLaneMatch)
                    && (stability >= relaxedStability || energyLaneMatch)
                    && (exactNote || inTune || energyLaneMatch);
                const nearMatch = !fullMatch
                    && isSinging
                    && (confidence >= nearConfidence || energyLaneMatch)
                    && (stability >= nearStability || energyLaneMatch)
                    && (nearTune || energyLaneMatch);
                const matchQuality = fullMatch ? 'full' : (nearMatch ? 'near' : 'none');
                const requiredHoldMs = Math.max(70, matchQuality === 'full'
                    ? Math.round(holdMs * (assistActive ? 0.5 : crowdMode ? 0.62 : 0.78))
                    : Math.round(holdMs * (assistActive ? 0.64 : crowdMode ? 0.8 : 0.92)));

                if (matchQuality !== 'none') {
                    if (matchRef.current.note !== targetNote || matchRef.current.quality !== matchQuality) {
                        matchRef.current = { note: targetNote, quality: matchQuality, since: now };
                    } else if (now - matchRef.current.since >= requiredHoldMs) {
                        let awardPoints = 0;
                        if (matchQuality === 'full') {
                            state.streak = (state.streak || 0) + 1;
                            const bonus = Math.min(50, state.streak * 6);
                            awardPoints = 28 + bonus;
                            state.score = (state.score || 0) + awardPoints;
                        } else {
                            // Partial credit keeps beginners engaged even if pitch is slightly off.
                            state.streak = Math.max(0, state.streak || 0);
                            awardPoints = 16;
                            state.score = (state.score || 0) + awardPoints;
                        }
                        const nextAward = {
                            at: now,
                            points: awardPoints,
                            quality: matchQuality === 'full' ? 'perfect' : 'near',
                            note: targetNote,
                            label: matchQuality === 'full' ? 'Locked' : 'Close'
                        };
                        state.lastAward = nextAward;
                        state.resultHistory = [
                            nextAward,
                            ...(Array.isArray(state.resultHistory) ? state.resultHistory : [])
                        ].slice(0, 6);
                        matchRef.current = { note: '-', quality: 'none', since: 0 };
                    }
                } else {
                    matchRef.current = { note: '-', quality: 'none', since: 0 };
                }
            }

            if (usesHostRoomMic) {
                state.inputSource = controlSource;
                state.voiceInput = 'host';
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
            flushStateWrite(state);
        }, 200);

        return () => {
            cancelled = true;
            clearInterval(loop);
        };
    }, [isController, stableNote, note, confidence, stability, isSinging, intervalMs, holdMs, minConfidence, minStability, volumeNormalized, writeState, crowdMode, usesHostRoomMic, hostVoiceFresh, controlSource]);

    useEffect(() => {
        if (!localState || !guideTone) return;
        if (!(view === 'tv' || isController)) return;
        if (localState.phase !== 'playing') return;
        if (lastToneIndexRef.current === localState.targetIndex) return;
        lastToneIndexRef.current = localState.targetIndex;
        const toneNote = localState.sequence?.[localState.targetIndex];
        if (!toneNote) return;
        const freq = NOTE_FREQ[toneNote] || 440;
        const toneDurationSec = clamp((intervalMs / 1000) * 0.54, 0.38, 1.15);
        playVoiceGameGuideTone({
            mode: 'vocal_challenge',
            cue: 'guide',
            frequency: freq,
            durationSec: toneDurationSec,
            intensity: 1.05
        });
    }, [localState, guideTone, view, isController, intervalMs, soundOptions]);

    useEffect(() => {
        if (!isController || !localState || localState.phase !== 'over') return;
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
    }, [isController, localState, roomCode, user?.uid, data.playerId, mode]);

    useEffect(() => {
        if (!localState || localState.phase !== 'over') return;
        if (mode === 'turns' && isController) {
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
                        resultHistory: [],
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
            gameData: { recap: buildVocalChallengeRecap(localState, data) }
        }).catch(() => {});
    }, [localState, view, roomCode, data, isController, mode, turnDurationMs]);

    if (!localState) {
        return (
            <div className="w-full h-full bg-black text-white flex items-center justify-center">
                <div className="text-zinc-400">Loading Vocal Challenge...</div>
            </div>
        );
    }

    const targetNote = localState.targetNote || localState.sequence?.[localState.targetIndex];
    const detected = localState.detectedNote || '-';
    const waitingForTurn = !isController && view !== 'tv' && data.playerId !== 'AMBIENT';
    const metaList = data.participantMeta || [];
    const currentTurnMeta = metaList.find((p) => p.id === data.playerId);
    const nextTurnMeta = isTurnsMode
        ? metaList.find((p) => p.id === (data.participants || [])[Math.min((data.turnIndex || 0) + 1, (data.participants || []).length - 1)])
        : null;
    const showSummary = localState.phase === 'summary';
    const lastAward = localState.lastAward || null;
    const resultHistory = Array.isArray(localState.resultHistory) ? localState.resultHistory.slice(0, 6) : [];
    const renderNowMs = Math.max(Number(localState.lastUpdated || localState.turnEndsAt || 0), launchClockMs);
    const lastAwardAgeMs = lastAward?.at ? Math.max(0, renderNowMs - Number(lastAward.at || 0)) : Number.POSITIVE_INFINITY;
    const showAwardBanner = lastAward && lastAwardAgeMs < 1700;
    const assistActive = Number(localState.assistUntil || 0) > renderNowMs;
    const introActive = Number(localState.introEndsAt || localState.voiceLaunchAtMs || 0) > renderNowMs;
    const launchCountdownSec = Math.max(0, Math.ceil((Number(localState.introEndsAt || localState.voiceLaunchAtMs || 0) - renderNowMs) / 1000));
    const preGameActive = introActive;
    const noteCycleMs = Math.max(1, Number(localState.nextNoteAt || 0) - Number(localState.lastTargetChangeAt || renderNowMs));
    const noteProgressPct = localState.phase === 'playing'
        ? clamp(((Number(localState.nextNoteAt || renderNowMs) - renderNowMs) / noteCycleMs) * 100, 0, 100)
        : 0;
    const roundProgressPct = localState.phase === 'playing'
        ? clamp(((Number(localState.turnEndsAt || renderNowMs) - renderNowMs) / Math.max(1, turnDurationMs)) * 100, 0, 100)
        : 0;
    const showNoteShiftPulse = localState.phase === 'playing' && renderNowMs - Number(localState.lastTargetChangeAt || 0) < 800;
    const battleRoleLabel = crowdMode
        ? 'Crowd vs Target Ribbon'
        : (isTurnsMode ? 'Spotlight Battle' : 'Singer vs Target Ribbon');
    const resultLabel = lastAward?.quality === 'perfect'
        ? 'Locked'
        : (lastAward?.quality === 'near' ? 'Close' : (assistActive ? 'Crowd Save' : 'Find The Lane'));
    const ribbonTopPct = NOTE_Y[targetNote] || 50;
    const detectedTopPct = NOTE_Y[detected] || 50;
    const ribbonDistance = detected && detected !== '-' ? Math.abs(detectedTopPct - ribbonTopPct) : 999;
    const ribbonMatched = ribbonDistance <= 4;
    const battleCommand = preGameActive
        ? { label: introActive ? `STARTS IN ${launchCountdownSec}` : 'MIC CHECK', helper: hostVoiceFresh ? 'Host mic is live. Hold the room together until GO.' : 'Host mic is not feeding this round yet. Arm it and sing into the room mic.', toneClass: hostVoiceFresh ? 'border-cyan-200/45 bg-cyan-400/14 text-cyan-100' : 'border-amber-200/45 bg-amber-400/14 text-amber-100' }
        : showNoteShiftPulse
        ? { label: 'SLIDE NOW', helper: `Target moved to ${targetNote || '-'}. Follow the ribbon.`, toneClass: 'border-yellow-200/45 bg-yellow-300/14 text-yellow-100' }
        : assistActive
            ? { label: 'CROWD SAVE', helper: 'Harmony boost widened the lane. Keep singing.', toneClass: 'border-emerald-200/45 bg-emerald-400/14 text-emerald-100' }
            : ribbonMatched
                ? { label: 'LOCK IT', helper: `${detected} is in the ribbon. Sustain for points.`, toneClass: 'border-emerald-200/45 bg-emerald-400/14 text-emerald-100' }
                : { label: 'FIND THE LANE', helper: `Aim for ${targetNote || '-'}. Close notes still recover.`, toneClass: 'border-pink-200/40 bg-pink-400/12 text-pink-100' };

    return (
        <div className="relative w-full h-full bg-indigo-950 overflow-hidden font-saira text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_65%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(0,196,217,0.15),_transparent_65%)]"></div>

            <div className="absolute top-6 left-8 right-8 flex items-center justify-between z-20">
                <div>
                    <div className="text-sm md:text-base uppercase tracking-[0.24em] md:tracking-[0.3em] text-zinc-300">Vocal Battle</div>
                    <div className="text-4xl md:text-5xl font-bebas text-pink-300">{data.playerId === 'AMBIENT' ? 'THE CROWD' : (data.playerName || 'SINGER')}</div>
                    <div className="text-lg md:text-xl text-zinc-300">{crowdMode ? 'The room sings against the target ribbon.' : 'Hold the ribbon, stack streaks, and let near matches recover.'}</div>
                    {isTurnsMode && (
                        <div className="mt-2 text-base uppercase tracking-[0.2em] text-zinc-400">
                            {isController ? "You're up" : `Up now: ${currentTurnMeta?.name || data.playerName || 'Singer'}`}
                        </div>
                    )}
                </div>
                <div className="text-right">
                    <div className="text-base uppercase tracking-[0.2em] text-zinc-300">Battle Score</div>
                    <div className="text-5xl md:text-6xl font-black text-white leading-none">{localState.score}</div>
                    <div className="text-base text-zinc-300 mt-1">Streak: {localState.streak || 0}</div>
                    <div className="mt-3 flex items-center justify-end gap-2 text-sm uppercase tracking-[0.18em] text-zinc-300">
                        <span className="px-2 py-1 rounded-full border border-white/10 bg-black/40">{difficulty}</span>
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
                enabled={view === 'tv' && crowdMode}
                modeTitle="Vocal Challenge"
                nowMs={renderNowMs}
                launchAtMs={Number(localState.introEndsAt || localState.voiceLaunchAtMs || 0)}
                warmupMs={Number(localState.voiceLaunchWarmupMs || data.voiceLaunchWarmupMs || introDurationMs)}
                micReady={!usesHostRoomMic || hostVoiceFresh}
                requireMic={usesHostRoomMic}
                live={localState.phase === 'playing' && !introActive}
                controlLabel="The crowd is scoring the target ribbon now."
                instruction="Sing into the room mic and lock the target ribbon together."
                accent="pink"
            />
            <CrowdMicInputVisualizer
                enabled={view === 'tv' && crowdMode}
                telemetry={hostVoiceTelemetry}
                nowMs={renderNowMs}
                label="Crowd Mic"
                helper="Ribbon input"
                accent="pink"
                className="absolute bottom-6 left-8 w-[min(30vw,360px)]"
            />
            {hostAssistBanner && (
                <div className="absolute top-[104px] left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                    <div className="rounded-2xl border border-emerald-200/50 bg-gradient-to-r from-emerald-400/95 via-cyan-300/95 to-sky-400/90 px-6 py-3 text-center shadow-[0_0_32px_rgba(52,211,153,0.35)] animate-pulse">
                        <div className="text-xs uppercase tracking-[0.35em] text-black/70">Host Assist</div>
                        <div className="text-2xl md:text-3xl font-black text-black">{hostAssistBanner.label}</div>
                        <div className="text-sm md:text-base font-bold text-black/80">Wider match window from {hostAssistBanner.by}</div>
                    </div>
                </div>
            )}
            {preGameActive && !crowdMode && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-6 text-center pointer-events-none">
                    <div className="max-w-3xl rounded-[2rem] border border-white/10 bg-black/70 px-8 py-6 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
                        <div className="text-xs uppercase tracking-[0.34em] text-zinc-400">{crowdMode ? 'Crowd Launch' : 'Warmup'}</div>
                        <div className="mt-3 text-4xl md:text-5xl font-black text-pink-200">
                            {introActive ? `Starts in ${launchCountdownSec}` : 'Waiting for host mic'}
                        </div>
                        <div className="mt-3 text-lg text-zinc-300">
                            {hostVoiceFresh
                                ? 'Host mic is live. Keep singing through GO, then lock the ribbon for points.'
                                : 'Arm the Host mic and sing into the room mic before scoring begins.'}
                        </div>
                    </div>
                </div>
            )}
            <div className="pointer-events-none absolute inset-x-[10%] top-[178px] z-20 flex justify-center">
                <div className={`max-w-[980px] rounded-[30px] border px-7 py-4 text-center shadow-[0_0_44px_rgba(0,0,0,0.36)] ${battleCommand.toneClass}`}>
                    <div className="text-[10px] font-black uppercase tracking-[0.32em] opacity-75">Battle Command</div>
                    <div className="mt-1 text-[clamp(2.5rem,7.2vw,6.8rem)] font-black leading-none text-white">{battleCommand.label}</div>
                    <div className="mt-2 text-[clamp(0.9rem,1.6vw,1.4rem)] font-black uppercase tracking-[0.16em] opacity-85">{battleCommand.helper}</div>
                </div>
            </div>

            {showAwardBanner && (
                <div className="absolute top-[168px] left-1/2 -translate-x-1/2 z-30">
                    <div
                        className={`rounded-2xl border px-5 py-2.5 text-center shadow-[0_0_30px_rgba(0,0,0,0.35)] ${
                            lastAward.quality === 'perfect'
                                ? 'border-emerald-300/60 bg-emerald-500/18 text-emerald-100'
                                : 'border-amber-300/60 bg-amber-500/16 text-amber-100'
                        }`}
                    >
                        <div className="text-sm uppercase tracking-[0.2em]">
                            {lastAward.quality === 'perfect' ? 'Perfect Match' : 'Near Match'}
                        </div>
                        <div className="text-[34px] md:text-[44px] leading-none font-black mt-1">+{lastAward.points}</div>
                    </div>
                </div>
            )}

            <div className="absolute inset-x-10 top-28 bottom-24 flex flex-col gap-6">
                <div className="grid grid-cols-1 xl:grid-cols-[1.35fr,0.65fr] gap-4">
                    <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
                        <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-zinc-300 mb-2">
                            <span>Target Ribbon</span>
                            <span>{Math.max(0, Math.ceil((Number(localState.nextNoteAt || renderNowMs) - renderNowMs) / 1000))}s</span>
                        </div>
                        <div className="h-4 rounded-full border border-white/10 bg-white/10 overflow-hidden">
                            <div className={`h-full transition-all duration-150 ${assistActive ? 'bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300' : 'bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-pink-300'}`} style={{ width: `${noteProgressPct}%` }} />
                        </div>
                        <div className="mt-2 text-sm text-zinc-300 uppercase tracking-[0.16em]">
                            {showNoteShiftPulse ? 'Ribbon moved. Slide into the lane.' : assistActive ? 'Harmony boost active.' : (resultLabel + ': close notes still score, so keep singing.')}
                        </div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
                        <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-zinc-300 mb-2">
                            <span>{battleRoleLabel}</span>
                            <span>{Math.max(0, Math.ceil((Number(localState.turnEndsAt || renderNowMs) - renderNowMs) / 1000))}s</span>
                        </div>
                        <div className="h-4 rounded-full border border-white/10 bg-white/10 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-fuchsia-300 via-pink-300 to-orange-300 transition-all duration-150" style={{ width: `${roundProgressPct}%` }} />
                        </div>
                        <div className="mt-2 text-sm text-zinc-300 uppercase tracking-[0.16em]">{resultLabel} result lane</div>
                    </div>
                </div>
                <div className="bg-black/50 border border-white/10 rounded-3xl p-6">
                    <div className="flex items-center justify-between text-base md:text-lg uppercase tracking-[0.16em] text-zinc-300 mb-3">
                        <span>Target Ribbon</span>
                        <span>{resultLabel}</span>
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
                                <>
                                    <div className={`absolute left-[18%] right-[18%] h-9 rounded-full border ${ribbonMatched ? 'border-emerald-200/70 bg-emerald-300/20 shadow-[0_0_32px_rgba(52,211,153,0.38)]' : 'border-cyan-200/45 bg-cyan-300/14 shadow-[0_0_24px_rgba(34,211,238,0.28)]'} ${showNoteShiftPulse ? 'scale-y-125' : ''} ${assistActive ? 'ring-4 ring-emerald-300/30' : ''}`} style={{ top: `${ribbonTopPct}%`, transform: 'translateY(-50%)' }}></div>
                                    <div className={`absolute left-1/2 w-8 h-8 rounded-full shadow-[0_0_24px_rgba(34,211,238,0.78)] ${showNoteShiftPulse ? 'bg-yellow-300 scale-125' : 'bg-cyan-400'} ${assistActive ? 'ring-4 ring-emerald-300/40' : ''}`} style={{ top: `${ribbonTopPct}%`, transform: 'translate(-50%, -50%)' }}></div>
                                </>
                            )}
                            {detected && detected !== '-' && (
                                <div className={`absolute left-[60%] w-7 h-7 rounded-full ${ribbonMatched ? 'bg-emerald-300 shadow-[0_0_22px_rgba(52,211,153,0.78)]' : 'bg-pink-400 shadow-[0_0_18px_rgba(236,72,153,0.68)]'}`} style={{ top: `${detectedTopPct}%`, transform: 'translate(-50%, -50%)' }}></div>
                            )}
                        </div>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-lg md:text-2xl text-zinc-200">
                            Target: <span className="text-white font-bold">{targetNote || '-'}</span>
                            <span className="mx-2 text-zinc-600">|</span>
                            Detected: <span className="text-white font-bold">{detected}</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(localState.sequence || []).map((n, idx) => (
                        <div key={`${n}-${idx}`} className={`px-3 py-1.5 rounded-full text-base md:text-xl font-bold border ${idx === localState.targetIndex ? 'border-pink-300 text-pink-200 bg-pink-500/10' : 'border-white/10 text-zinc-400 bg-black/20'}`}>
                            {n}
                        </div>
                    ))}
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
                    <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-zinc-300 mb-3">
                        <span>Phrase Results</span>
                        <span>{resultHistory.length ? `${resultHistory.length}/6` : 'No locks yet'}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                        {resultHistory.length ? resultHistory.map((entry, idx) => (
                            <div
                                key={entry.at || (String(entry.note || 'phrase') + '-' + idx)}
                                className={`rounded-2xl border px-3 py-2 ${entry.quality === 'perfect' ? 'border-emerald-300/45 bg-emerald-500/14 text-emerald-100' : 'border-amber-300/45 bg-amber-500/14 text-amber-100'}`}
                            >
                                <div className="text-[10px] uppercase tracking-[0.16em] opacity-80">{entry.label || (entry.quality === 'perfect' ? 'Locked' : 'Close')}</div>
                                <div className="mt-1 flex items-end justify-between gap-2">
                                    <span className="text-2xl font-black leading-none">{entry.note || '-'}</span>
                                    <span className="text-lg font-black leading-none">+{entry.points || 0}</span>
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm uppercase tracking-[0.16em] text-zinc-400">
                                Phrase results appear as notes lock into the ribbon.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showSummary && (
                <div className="absolute inset-0 bg-black/75 z-30 flex items-center justify-center text-center">
                    <div className="bg-zinc-900/90 border border-white/10 rounded-3xl px-8 py-6 max-w-lg">
                        <div className="text-base uppercase tracking-[0.24em] text-zinc-300">Battle Summary</div>
                        <div className="text-5xl md:text-6xl font-bebas text-pink-300 mt-2">Score {localState.score}</div>
                        <div className="text-lg md:text-xl text-zinc-300 mt-1">Best streak {localState.streak || 0}</div>
                        {isTurnsMode && nextTurnMeta?.name && (
                            <div className="text-base uppercase tracking-[0.2em] text-zinc-400 mt-4">Next up: {nextTurnMeta.name}</div>
                        )}
                    </div>
                </div>
            )}

            {waitingForTurn && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30 text-center">
                    <div className="bg-zinc-900/80 border border-white/10 rounded-2xl px-6 py-4">
                        <div className="text-base uppercase tracking-[0.24em] text-zinc-300">Vocal Challenge</div>
                        <div className="text-4xl md:text-5xl font-bebas text-pink-300 mt-2">Waiting for your turn</div>
                    </div>
                </div>
            )}

            <VoiceHud
                note={(isController ? note : remoteVoice.note) || '-'}
                pitch={isController ? pitch : 0}
                confidence={isController ? confidence : remoteVoice.confidence}
                volumeNormalized={isController ? volumeNormalized : remoteVoice.volumeNormalized}
                stableNote={isController ? stableNote : remoteVoice.stableNote}
                stability={isController ? stability : remoteVoice.stability}
                calibrating={isController ? calibrating : remoteVoice.calibrating}
                view={view}
            />
        </div>
    );
};

export default VocalChallengeGame;
