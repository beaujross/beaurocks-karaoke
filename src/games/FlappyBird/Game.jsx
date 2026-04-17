import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePitch } from '../../hooks/usePitch';
import { db, doc, onSnapshot, updateDoc } from '../../lib/firebase';
import { APP_ID, GAME_ASSETS, NOTE_NAMES } from '../../lib/assets';
import { playSfx } from '../../lib/utils';
import { VOICE_GAME_FUN_DEFAULTS } from '../vocalGameTuning';

const MAX_LIVES = VOICE_GAME_FUN_DEFAULTS.flappyBird.lives;
const DEFAULT_DIFFICULTY = VOICE_GAME_FUN_DEFAULTS.flappyBird.difficulty || 'normal';
const ORB_X = 18;
const TOP_PCT = 6;
const FLOOR_TOP_PCT = 84;
const FLOOR_FAIL_PCT = 88;
const TRAIL_LIMIT = 28;
const OBSTACLE_WIDTH = 11;
const CALIBRATION_MIN_SPAN = 8;
const RANGE_PADDING = 3;
const RECOVERY_SHIELD_MS = 1500;
const HOST_ASSIST_DEFAULT_MS = 4000;
const HOST_ASSIST_BANNER_MS = 2300;

const DIFFICULTY_CONFIG = Object.freeze({
    easy: {
        gapSemitones: 12,
        speedPerFrame: 0.38,
        spawnMs: 2300,
        stepChoices: [-4, -3, -2, -1, 1, 2, 3, 4]
    },
    normal: {
        gapSemitones: 9,
        speedPerFrame: 0.48,
        spawnMs: 1850,
        stepChoices: [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]
    },
    hard: {
        gapSemitones: 7,
        speedPerFrame: 0.58,
        spawnMs: 1500,
        stepChoices: [-7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7]
    }
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (from, to, amount) => from + ((to - from) * amount);

const normalizeDifficulty = (value = '') => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'easy' || normalized === 'hard') return normalized;
    return 'normal';
};

const midiFromPitch = (pitch) => {
    if (!pitch || pitch <= 0) return 0;
    return Math.round((12 * Math.log2(pitch / 440)) + 69);
};

const labelFromMidi = (midi) => {
    const safeMidi = Math.round(Number(midi || 0));
    if (!safeMidi) return '--';
    const noteIndex = ((safeMidi % 12) + 12) % 12;
    const octave = Math.floor(safeMidi / 12) - 1;
    return `${NOTE_NAMES[noteIndex]}${octave}`;
};

const sanitizeRange = (lowestMidi, highestMidi) => {
    const low = clamp(Math.round(Number(lowestMidi || 46)), 30, 86);
    const high = clamp(Math.round(Number(highestMidi || 71)), low + 6, 92);
    if ((high - low) >= CALIBRATION_MIN_SPAN) return { low, high };
    const midpoint = Math.round((low + high) / 2);
    return {
        low: clamp(midpoint - Math.ceil(CALIBRATION_MIN_SPAN / 2), 30, 84),
        high: clamp(midpoint + Math.floor(CALIBRATION_MIN_SPAN / 2), 38, 92)
    };
};

const yForMidi = (midi, lowestMidi, highestMidi) => {
    const safeRange = Math.max(1, highestMidi - lowestMidi);
    const normalized = clamp((highestMidi - midi) / safeRange, 0, 1);
    return TOP_PCT + (normalized * (FLOOR_TOP_PCT - TOP_PCT));
};

const buildDisplayMidiList = (lowestMidi, highestMidi) => {
    const list = [];
    const top = clamp(Math.round(highestMidi + RANGE_PADDING), 36, 96);
    const bottom = clamp(Math.round(lowestMidi - RANGE_PADDING), 24, top - 6);
    for (let value = top; value >= bottom; value -= 1) {
        list.push(value);
    }
    return list;
};

const buildTrailPath = (points = []) => {
    if (!Array.isArray(points) || points.length < 2) return '';
    return points.reduce((path, point, index) => {
        const prefix = index === 0 ? 'M' : 'L';
        return `${path}${prefix}${point.x},${point.y}`;
    }, '');
};

const buildObstacle = ({ targetMidi, difficulty, seed }) => ({
    id: seed,
    x: 104,
    targetMidi,
    label: labelFromMidi(targetMidi),
    gapSemitones: DIFFICULTY_CONFIG[difficulty].gapSemitones,
    scored: false
});

const obstacleGapBounds = (obstacle, lowestMidi, highestMidi) => {
    const halfGap = obstacle.gapSemitones / 2;
    const topY = yForMidi(obstacle.targetMidi + halfGap, lowestMidi, highestMidi);
    const bottomY = yForMidi(obstacle.targetMidi - halfGap, lowestMidi, highestMidi);
    return {
        topY: clamp(topY, TOP_PCT, FLOOR_TOP_PCT - 6),
        bottomY: clamp(bottomY, TOP_PCT + 6, FLOOR_TOP_PCT)
    };
};

const pickNextTargetMidi = ({ lowestMidi, highestMidi, previousMidi, difficulty }) => {
    const config = DIFFICULTY_CONFIG[difficulty];
    const paddedLow = clamp(lowestMidi + 1, 30, 90);
    const paddedHigh = clamp(highestMidi - 1, paddedLow + 1, 92);
    if (!previousMidi) {
        return Math.round((paddedLow + paddedHigh) / 2);
    }
    const nextMidi = previousMidi + config.stepChoices[Math.floor(Math.random() * config.stepChoices.length)];
    return clamp(nextMidi, paddedLow, paddedHigh);
};

const createBaseState = (data = {}) => {
    const difficulty = normalizeDifficulty(data.difficulty || DEFAULT_DIFFICULTY);
    const range = sanitizeRange(data.lowestMidi, data.highestMidi);
    const midpoint = Math.round((range.low + range.high) / 2);
    return {
        status: String(data.status || 'waiting'),
        difficulty,
        score: Math.max(0, Number(data.score || 0)),
        lives: clamp(Number(data.lives || MAX_LIVES), 0, MAX_LIVES),
        lowestMidi: range.low,
        highestMidi: range.high,
        orbY: clamp(Number(data.orbY || yForMidi(midpoint, range.low, range.high)), TOP_PCT, FLOOR_FAIL_PCT),
        currentMidi: Number(data.currentMidi || 0),
        currentLabel: String(data.currentLabel || '--'),
        targetMidi: Number(data.targetMidi || midpoint),
        paused: Boolean(data.paused),
        shieldUntil: Math.max(0, Number(data.shieldUntil || 0)),
        obstacles: Array.isArray(data.obstacles) ? data.obstacles.map((item) => ({ ...item })) : [],
        trail: Array.isArray(data.trail) ? data.trail.map((item) => ({ ...item })) : [],
        timestamp: Math.max(0, Number(data.timestamp || Date.now()))
    };
};

const defaultVoiceState = Object.freeze({
    pitch: 0,
    midi: 0,
    label: '--',
    confidence: 0,
    volumeNormalized: 0,
    stableNote: '-',
    stability: 0,
    calibrating: false
});

const PitchRunnerGame = ({ isPlayer, roomCode, playerData, onGameOver, inputSource, gameState, view = 'tv' }) => {
    const data = useMemo(() => playerData || gameState || {}, [playerData, gameState]);
    const controlSource = data.inputSource || inputSource || 'remote';
    const isRoomControlled = controlSource === 'ambient' || controlSource === 'crowd' || controlSource === 'local';
    const isController = isPlayer && (isRoomControlled ? view === 'tv' : view !== 'tv');
    const isLocalInput = isController && inputSource !== 'remote';
    const { pitch, confidence, volumeNormalized, stableNote, stability, calibrating, isSinging } = usePitch(isLocalInput, {
        smoothingFactor: 0.36,
        confidenceThreshold: 0.3,
        singingThreshold: 0.03,
        stableNoteMs: 170,
        noiseGateMultiplier: 1.22
    });

    const initialState = useMemo(() => createBaseState(data), [data]);
    const [gameStateLocal, setGameStateLocal] = useState(initialState);
    const [remoteVoice, setRemoteVoice] = useState(defaultVoiceState);
    const [rangeSetup, setRangeSetup] = useState(() => ({
        low: null,
        high: null,
        sampleCount: 0
    }));
    const [hostAssistBanner, setHostAssistBanner] = useState(null);

    const stateRef = useRef(initialState);
    const voiceRef = useRef(defaultVoiceState);
    const lastSpawnAtRef = useRef(0);
    const lastTargetMidiRef = useRef(initialState.targetMidi || 0);
    const gameOverCalledRef = useRef(false);
    const rangeSetupRef = useRef(rangeSetup);
    const lastHostAssistIdRef = useRef('');
    const hostAssistBannerTimeoutRef = useRef(null);

    useEffect(() => {
        stateRef.current = gameStateLocal;
    }, [gameStateLocal]);

    useEffect(() => {
        rangeSetupRef.current = rangeSetup;
    }, [rangeSetup]);

    useEffect(() => {
        const nextMidi = isSinging && confidence >= 0.24 ? clamp(midiFromPitch(pitch), 24, 96) : 0;
        voiceRef.current = {
            pitch,
            midi: nextMidi,
            label: nextMidi ? labelFromMidi(nextMidi) : '--',
            confidence,
            volumeNormalized,
            stableNote,
            stability,
            calibrating
        };
    }, [pitch, confidence, volumeNormalized, stableNote, stability, calibrating, isSinging]);

    useEffect(() => {
        if (isController) return;
        const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), (snapshot) => {
            const nextData = snapshot.data()?.gameData;
            if (!nextData) return;
            setGameStateLocal(createBaseState(nextData));
            if (nextData.voice) {
                setRemoteVoice({
                    ...defaultVoiceState,
                    ...nextData.voice
                });
            }
        });
        return () => unsub();
    }, [isController, roomCode]);

    useEffect(() => {
        if (!isController || stateRef.current.status !== 'waiting') return;
        const midi = voiceRef.current.midi;
        if (!midi) return;
        setRangeSetup((previous) => {
            const low = previous.low === null ? midi : Math.min(previous.low, midi);
            const high = previous.high === null ? midi : Math.max(previous.high, midi);
            return {
                low,
                high,
                sampleCount: previous.sampleCount + 1
            };
        });
    }, [isController, gameStateLocal.status, pitch, confidence, isSinging, stableNote]);

    const syncToRoom = useCallback(async () => {
        if (!isController) return;
        const nextState = stateRef.current;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
            gameData: {
                ...nextState,
                voice: {
                    ...voiceRef.current
                },
                timestamp: Date.now()
            }
        }).catch((error) => {
            console.error('Pitch Runner sync error:', error);
        });
    }, [isController, roomCode]);

    useEffect(() => {
        if (!isController) return undefined;
        const interval = setInterval(() => {
            syncToRoom();
        }, 180);
        return () => clearInterval(interval);
    }, [isController, syncToRoom]);

    useEffect(() => {
        const hostAssist = data?.hostAssist;
        const assistId = String(hostAssist?.id || '').trim();
        if (!assistId || assistId === lastHostAssistIdRef.current) return;

        lastHostAssistIdRef.current = assistId;
        const durationMs = Math.max(1200, Number(hostAssist?.durationMs || HOST_ASSIST_DEFAULT_MS));
        const triggeredAt = Number(hostAssist?.triggeredAt || Date.now());
        if (Date.now() - triggeredAt > durationMs + HOST_ASSIST_BANNER_MS + 1200) return;

        const bannerTimer = setTimeout(() => {
            setHostAssistBanner({
                label: hostAssist?.label || 'Pitch Lock',
                by: hostAssist?.by || 'Host'
            });
            if (hostAssistBannerTimeoutRef.current) {
                clearTimeout(hostAssistBannerTimeoutRef.current);
            }
            hostAssistBannerTimeoutRef.current = setTimeout(() => setHostAssistBanner(null), HOST_ASSIST_BANNER_MS);

            setGameStateLocal((previous) => {
                const next = { ...previous };
                next.shieldUntil = Date.now() + durationMs;
                const activeObstacle = next.obstacles.find((item) => item.x > ORB_X - 2) || next.obstacles[0];
                const targetMidi = activeObstacle?.targetMidi || next.targetMidi || Math.round((next.lowestMidi + next.highestMidi) / 2);
                next.orbY = yForMidi(targetMidi, next.lowestMidi, next.highestMidi);
                return next;
            });
        }, 0);
        return () => clearTimeout(bannerTimer);
    }, [data]);

    useEffect(() => () => {
        if (hostAssistBannerTimeoutRef.current) {
            clearTimeout(hostAssistBannerTimeoutRef.current);
        }
    }, []);

    const lockRange = useCallback(() => {
        const liveMidi = voiceRef.current.midi || 57;
        const lowCandidate = rangeSetupRef.current.low ?? (liveMidi - 5);
        const highCandidate = rangeSetupRef.current.high ?? (liveMidi + 5);
        const range = sanitizeRange(lowCandidate, highCandidate);
        const midpoint = Math.round((range.low + range.high) / 2);
        lastTargetMidiRef.current = midpoint;
        setGameStateLocal((previous) => ({
            ...previous,
            status: 'ready',
            paused: false,
            score: 0,
            lives: MAX_LIVES,
            lowestMidi: range.low,
            highestMidi: range.high,
            orbY: yForMidi(midpoint, range.low, range.high),
            currentMidi: 0,
            currentLabel: '--',
            targetMidi: midpoint,
            obstacles: [],
            trail: []
        }));
    }, []);

    const startRun = useCallback(() => {
        setGameStateLocal((previous) => {
            const midpoint = Math.round((previous.lowestMidi + previous.highestMidi) / 2);
            lastSpawnAtRef.current = 0;
            lastTargetMidiRef.current = midpoint;
            gameOverCalledRef.current = false;
            return {
                ...previous,
                status: 'playing',
                paused: false,
                score: 0,
                lives: MAX_LIVES,
                orbY: yForMidi(midpoint, previous.lowestMidi, previous.highestMidi),
                currentMidi: 0,
                currentLabel: '--',
                targetMidi: midpoint,
                shieldUntil: 0,
                obstacles: [],
                trail: []
            };
        });
    }, []);

    const resetRun = useCallback(() => {
        setRangeSetup({ low: null, high: null, sampleCount: 0 });
        setGameStateLocal((previous) => ({
            ...previous,
            status: 'waiting',
            paused: false,
            score: 0,
            lives: MAX_LIVES,
            obstacles: [],
            trail: []
        }));
    }, []);

    const togglePause = useCallback(() => {
        setGameStateLocal((previous) => ({
            ...previous,
            paused: !previous.paused
        }));
    }, []);

    useEffect(() => {
        if (!isController || stateRef.current.status !== 'playing') return undefined;
        let frameId = 0;

        const loop = () => {
            const state = stateRef.current;
            if (state.status !== 'playing') return;
            if (state.paused) {
                frameId = requestAnimationFrame(loop);
                return;
            }

            const difficulty = normalizeDifficulty(state.difficulty);
            const config = DIFFICULTY_CONFIG[difficulty];
            const lowestMidi = state.lowestMidi;
            const highestMidi = state.highestMidi;
            const detectedMidi = voiceRef.current.midi
                ? clamp(voiceRef.current.midi, lowestMidi - 2, highestMidi + 2)
                : 0;

            let orbY = state.orbY;
            if (detectedMidi) {
                const targetY = yForMidi(detectedMidi, lowestMidi, highestMidi);
                orbY = lerp(orbY, targetY, 0.26);
            } else {
                orbY = clamp(orbY + 0.78, TOP_PCT, 94);
            }

            let obstacles = state.obstacles
                .map((item) => ({ ...item, x: item.x - config.speedPerFrame }))
                .filter((item) => item.x > -18);

            if (!lastSpawnAtRef.current) {
                lastSpawnAtRef.current = performance.now();
            }
            if (performance.now() - lastSpawnAtRef.current >= config.spawnMs) {
                const targetMidi = pickNextTargetMidi({
                    lowestMidi,
                    highestMidi,
                    previousMidi: lastTargetMidiRef.current,
                    difficulty
                });
                lastTargetMidiRef.current = targetMidi;
                obstacles = [
                    ...obstacles,
                    buildObstacle({
                        targetMidi,
                        difficulty,
                        seed: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
                    })
                ];
                lastSpawnAtRef.current = performance.now();
            }

            let trail = state.trail
                .map((point) => ({ ...point, x: point.x - config.speedPerFrame }))
                .filter((point) => point.x > -5);
            trail.push({ x: ORB_X, y: orbY });
            if (trail.length > TRAIL_LIMIT) {
                trail = trail.slice(trail.length - TRAIL_LIMIT);
            }

            let score = state.score;
            let lives = state.lives;
            let status = state.status;
            let shieldUntil = state.shieldUntil;
            const shieldActive = Number(shieldUntil || 0) > Date.now();

            const loseLife = (safeTargetMidi) => {
                playSfx(GAME_ASSETS.fail);
                lives -= 1;
                if (lives <= 0) {
                    status = 'gameover';
                    return;
                }
                shieldUntil = Date.now() + RECOVERY_SHIELD_MS;
                orbY = yForMidi(safeTargetMidi, lowestMidi, highestMidi);
                obstacles = obstacles.filter((item) => item.x > ORB_X + 4);
                trail = [{ x: ORB_X, y: orbY }];
            };

            for (const obstacle of obstacles) {
                const bounds = obstacleGapBounds(obstacle, lowestMidi, highestMidi);
                if (!obstacle.scored && (obstacle.x + OBSTACLE_WIDTH) < ORB_X) {
                    obstacle.scored = true;
                    score += 35;
                    playSfx(GAME_ASSETS.coin);
                }
                const inCollisionX = obstacle.x < (ORB_X + 2.4) && (obstacle.x + OBSTACLE_WIDTH) > (ORB_X - 2.4);
                const outsideGap = orbY < bounds.topY || orbY > bounds.bottomY;
                if (status === 'playing' && inCollisionX && outsideGap && !shieldActive) {
                    loseLife(obstacle.targetMidi);
                    break;
                }
            }

            const currentObstacle = obstacles.find((item) => item.x > ORB_X - 2) || obstacles[0];
            const currentTargetMidi = currentObstacle?.targetMidi || lastTargetMidiRef.current || Math.round((lowestMidi + highestMidi) / 2);

            if (status === 'playing' && orbY >= FLOOR_FAIL_PCT && !shieldActive) {
                loseLife(currentTargetMidi);
            }

            const nextState = {
                ...state,
                score,
                lives,
                status,
                shieldUntil,
                orbY,
                currentMidi: detectedMidi,
                currentLabel: detectedMidi ? labelFromMidi(detectedMidi) : '--',
                targetMidi: currentTargetMidi,
                obstacles,
                trail,
                timestamp: Date.now()
            };
            stateRef.current = nextState;
            setGameStateLocal(nextState);

            if (status === 'gameover' && !gameOverCalledRef.current) {
                gameOverCalledRef.current = true;
                if (typeof onGameOver === 'function') {
                    onGameOver(score);
                }
            }

            frameId = requestAnimationFrame(loop);
        };

        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, [gameStateLocal.status, isController, onGameOver]);

    const setDifficulty = (difficultyKey) => {
        if (!isController) return;
        const nextDifficulty = normalizeDifficulty(difficultyKey);
        setGameStateLocal((previous) => ({
            ...previous,
            difficulty: nextDifficulty
        }));
    };

    const visibleVoice = isController
        ? {
            pitch,
            midi: isSinging && confidence >= 0.24 ? clamp(midiFromPitch(pitch), 24, 96) : 0,
            label: isSinging && confidence >= 0.24 ? labelFromMidi(clamp(midiFromPitch(pitch), 24, 96)) : '--',
            confidence,
            volumeNormalized,
            stableNote,
            stability,
            calibrating
        }
        : remoteVoice;
    const visibleState = gameStateLocal;
    const visibleRange = sanitizeRange(visibleState.lowestMidi, visibleState.highestMidi);
    const displayMidi = buildDisplayMidiList(visibleRange.low, visibleRange.high);
    const activeTargetMidi = visibleState.targetMidi || Math.round((visibleRange.low + visibleRange.high) / 2);
    const activeTargetY = yForMidi(activeTargetMidi, visibleRange.low, visibleRange.high);
    const trailPath = buildTrailPath(visibleState.trail);
    const renderNowMs = Number(visibleState.timestamp || 0);
    const shieldActive = Number(visibleState.shieldUntil || 0) > renderNowMs;
    const spectatorMessage = view === 'mobile' && isRoomControlled
        ? 'Crowd mic mode is active on the TV. Watch the run there or ask the host for solo mode.'
        : `Watching ${data.playerName || 'the current singer'} play.`;
    const hasLockedRange = visibleState.status !== 'waiting';
    const previewRange = hasLockedRange
        ? visibleRange
        : sanitizeRange(rangeSetup.low ?? 46, rangeSetup.high ?? 71);
    const previewLowLabel = hasLockedRange ? labelFromMidi(visibleRange.low) : labelFromMidi(previewRange.low);
    const previewHighLabel = hasLockedRange ? labelFromMidi(visibleRange.high) : labelFromMidi(previewRange.high);
    const previewLowY = yForMidi(previewRange.low, previewRange.low, previewRange.high);
    const previewHighY = yForMidi(previewRange.high, previewRange.low, previewRange.high);
    const currentLiveMidi = visibleVoice.midi || visibleState.currentMidi || 0;
    const currentLiveY = currentLiveMidi
        ? yForMidi(currentLiveMidi, previewRange.low, previewRange.high)
        : null;

    return (
        <div className="relative h-full w-full overflow-hidden bg-[#0a0f1f] text-white">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.08)_1px,transparent_1px)] bg-[size:14%_6.4%]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.16),transparent_38%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.16),transparent_46%)]" />
            <div className="absolute inset-x-0 bottom-0 h-[16%] border-t border-pink-400/60 bg-gradient-to-t from-pink-500/20 via-pink-500/10 to-transparent" />

            <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-xs uppercase tracking-[0.28em] text-zinc-300">
                    <span>Pitch Runner</span>
                    <span className="text-white">{visibleState.score}</span>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2">
                    {['easy', 'normal', 'hard'].map((difficultyKey) => {
                        const active = normalizeDifficulty(visibleState.difficulty) === difficultyKey;
                        return (
                            <button
                                key={difficultyKey}
                                type="button"
                                onClick={() => setDifficulty(difficultyKey)}
                                disabled={!isController}
                                className={`min-w-[84px] rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.22em] transition ${
                                    active
                                        ? difficultyKey === 'easy'
                                            ? 'bg-emerald-500 text-black'
                                            : difficultyKey === 'hard'
                                                ? 'bg-pink-500 text-white'
                                                : 'bg-cyan-400 text-black'
                                        : 'bg-white/10 text-zinc-300'
                                } ${isController ? '' : 'cursor-default'}`}
                            >
                                {difficultyKey}
                            </button>
                        );
                    })}
                </div>
                <div className="rounded-full border border-white/10 bg-black/45 px-4 py-2 text-right">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-400">Lives</div>
                    <div className="text-lg font-black text-white">{visibleState.lives}/{MAX_LIVES}</div>
                </div>
            </div>

            <div className="absolute inset-y-0 right-5 z-10 w-12">
                {displayMidi.map((midi) => {
                    const y = yForMidi(midi, visibleRange.low, visibleRange.high);
                    return (
                        <div
                            key={midi}
                            className={`absolute right-0 -translate-y-1/2 text-xs font-semibold ${midi === activeTargetMidi ? 'text-pink-300' : 'text-zinc-400'}`}
                            style={{ top: `${y}%` }}
                        >
                            {labelFromMidi(midi)}
                        </div>
                    );
                })}
            </div>

            <div
                className="absolute inset-x-0 z-10 border-t border-b border-emerald-400/30 bg-emerald-400/10"
                style={{ top: `${previewHighY}%`, height: `${Math.max(3, previewLowY - previewHighY)}%` }}
            />
            <div className="absolute inset-x-0 z-10 border-t border-dashed border-emerald-300/70" style={{ top: `${previewHighY}%` }} />
            <div className="absolute inset-x-0 z-10 border-t border-dashed border-cyan-300/70" style={{ top: `${previewLowY}%` }} />
            <div className="absolute left-6 z-20 -translate-y-1/2 rounded-xl border border-emerald-400/30 bg-black/60 px-3 py-1 text-sm font-black text-emerald-300" style={{ top: `${previewHighY}%` }}>
                Highest: {previewHighLabel}
            </div>
            <div className="absolute left-6 z-20 -translate-y-1/2 rounded-xl border border-cyan-400/30 bg-black/60 px-3 py-1 text-sm font-black text-cyan-300" style={{ top: `${previewLowY}%` }}>
                Lowest: {previewLowLabel}
            </div>

            {visibleState.status === 'playing' && (
                <div className="absolute inset-x-0 z-10 border-t border-dashed border-lime-300/80" style={{ top: `${activeTargetY}%` }} />
            )}

            {visibleState.status === 'playing' && (
                <div className="absolute right-20 z-20 -translate-y-1/2 rounded-xl border border-lime-300/30 bg-black/65 px-3 py-1 text-sm font-black text-lime-200" style={{ top: `${activeTargetY}%` }}>
                    Target {labelFromMidi(activeTargetMidi)}
                </div>
            )}

            {visibleState.obstacles.map((obstacle) => {
                const bounds = obstacleGapBounds(obstacle, visibleRange.low, visibleRange.high);
                return (
                    <div
                        key={obstacle.id}
                        className={`absolute top-0 bottom-0 z-20 w-[11%] ${shieldActive ? 'opacity-70' : ''}`}
                        style={{ left: `${obstacle.x}%` }}
                    >
                        <div className="absolute inset-x-0 top-0 rounded-b-[20px] border border-emerald-400/50 bg-emerald-400/10 shadow-[0_0_20px_rgba(74,222,128,0.35)]" style={{ height: `${bounds.topY}%` }} />
                        <div className="absolute inset-x-0 bottom-0 rounded-t-[20px] border border-emerald-400/50 bg-emerald-400/10 shadow-[0_0_20px_rgba(74,222,128,0.35)]" style={{ top: `${bounds.bottomY}%` }} />
                    </div>
                );
            })}

            <svg className="absolute inset-0 z-20 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {trailPath ? (
                    <>
                        <path d={trailPath} fill="none" stroke="rgba(34,211,238,0.25)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={trailPath} fill="none" stroke="rgba(34,211,238,0.9)" strokeWidth="0.75" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                ) : null}
            </svg>

            <div
                className={`absolute z-30 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_28px_rgba(103,232,249,0.95)] transition-transform ${shieldActive ? 'ring-4 ring-emerald-300/45 scale-110' : ''}`}
                style={{ left: `${ORB_X}%`, top: `${visibleState.orbY}%` }}
            >
                <div className="absolute inset-[18%] rounded-full bg-cyan-100/80" />
            </div>

            {currentLiveY && visibleState.status !== 'playing' && (
                <div
                    className="absolute z-20 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200/70 shadow-[0_0_18px_rgba(103,232,249,0.55)]"
                    style={{ left: '20%', top: `${currentLiveY}%` }}
                />
            )}

            <div className="absolute bottom-5 left-5 z-30 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-sm uppercase tracking-[0.18em] text-zinc-200">
                <div className="text-[10px] text-zinc-500">Voice</div>
                <div className="mt-1 flex items-center gap-3">
                    <span className="text-white">{visibleVoice.label || visibleState.currentLabel || '--'}</span>
                    <span className="text-zinc-400">{Math.round((visibleVoice.confidence || 0) * 100)}%</span>
                    <span className="text-zinc-400">{Math.round((visibleVoice.volumeNormalized || 0) * 100)}%</span>
                </div>
            </div>

            {hostAssistBanner && (
                <div className="absolute left-1/2 top-24 z-40 -translate-x-1/2">
                    <div className="rounded-2xl border border-cyan-200/40 bg-gradient-to-r from-cyan-300/95 via-emerald-300/92 to-sky-300/92 px-6 py-3 text-center text-black shadow-[0_0_34px_rgba(34,211,238,0.35)]">
                        <div className="text-[10px] font-black uppercase tracking-[0.34em] text-black/70">Host Assist</div>
                        <div className="mt-1 text-2xl font-black">{hostAssistBanner.label}</div>
                        <div className="text-sm font-bold text-black/75">Safe lane lock from {hostAssistBanner.by}</div>
                    </div>
                </div>
            )}

            {isController && visibleState.status === 'playing' && (
                <button
                    type="button"
                    onClick={togglePause}
                    className="absolute bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-5 py-2 text-sm font-black uppercase tracking-[0.18em] text-white"
                >
                    {visibleState.paused ? 'Resume' : 'Breath'}
                </button>
            )}

            {!isController && view !== 'tv' && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-6 text-center">
                    <div className="max-w-xl rounded-3xl border border-white/10 bg-black/65 px-6 py-5 text-base text-zinc-200">
                        {spectatorMessage}
                    </div>
                </div>
            )}

            {isController && visibleState.status === 'waiting' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 px-6">
                    <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-[#0d1326]/92 px-8 py-7 text-center shadow-[0_0_60px_rgba(0,0,0,0.4)]">
                        <div className="text-xs uppercase tracking-[0.4em] text-zinc-400">Range Setup</div>
                        <div className="mt-3 text-5xl font-black text-cyan-200">Find Your Lane</div>
                        <div className="mt-3 text-lg text-zinc-300">
                            Sing your lowest comfortable note, then your highest. When the lines look right, lock the range and start.
                        </div>
                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="rounded-3xl border border-white/10 bg-black/35 px-5 py-4">
                                <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Detected Lowest</div>
                                <div className="mt-2 text-4xl font-black text-cyan-300">{rangeSetup.low ? labelFromMidi(rangeSetup.low) : '--'}</div>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-black/35 px-5 py-4">
                                <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Detected Highest</div>
                                <div className="mt-2 text-4xl font-black text-emerald-300">{rangeSetup.high ? labelFromMidi(rangeSetup.high) : '--'}</div>
                            </div>
                        </div>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={lockRange}
                                className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-black uppercase tracking-[0.22em] text-black"
                            >
                                Lock Range
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const range = sanitizeRange(46, 71);
                                    const midpoint = Math.round((range.low + range.high) / 2);
                                    setRangeSetup({ low: range.low, high: range.high, sampleCount: 0 });
                                    lastTargetMidiRef.current = midpoint;
                                    setGameStateLocal((previous) => ({
                                        ...previous,
                                        status: 'ready',
                                        paused: false,
                                        score: 0,
                                        lives: MAX_LIVES,
                                        lowestMidi: range.low,
                                        highestMidi: range.high,
                                        orbY: yForMidi(midpoint, range.low, range.high),
                                        currentMidi: 0,
                                        currentLabel: '--',
                                        targetMidi: midpoint,
                                        obstacles: [],
                                        trail: []
                                    }));
                                }}
                                className="rounded-full border border-white/10 bg-white/10 px-6 py-3 text-sm font-black uppercase tracking-[0.22em] text-white"
                            >
                                Use Demo Range
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isController && visibleState.status === 'ready' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/58 px-6">
                    <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-[#0d1326]/92 px-8 py-7 text-center shadow-[0_0_60px_rgba(0,0,0,0.4)]">
                        <div className="text-xs uppercase tracking-[0.4em] text-zinc-400">Pitch Runner</div>
                        <div className="mt-3 text-5xl font-black text-cyan-200">Ride The Note Gap</div>
                        <div className="mt-3 text-lg text-zinc-300">
                            Match the target note line and keep the orb inside the opening. Your range is locked to {previewLowLabel} through {previewHighLabel}.
                        </div>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={startRun}
                                className="rounded-full bg-cyan-400 px-8 py-3 text-sm font-black uppercase tracking-[0.22em] text-black"
                            >
                                Start Run
                            </button>
                            <button
                                type="button"
                                onClick={resetRun}
                                className="rounded-full border border-white/10 bg-white/10 px-8 py-3 text-sm font-black uppercase tracking-[0.22em] text-white"
                            >
                                Recalibrate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {visibleState.paused && visibleState.status === 'playing' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 px-6">
                    <div className="rounded-[28px] border border-white/10 bg-black/75 px-8 py-6 text-center">
                        <div className="text-xs uppercase tracking-[0.36em] text-zinc-400">Breath Pause</div>
                        <div className="mt-3 text-4xl font-black text-white">Catch your breath</div>
                    </div>
                </div>
            )}

            {visibleState.status === 'gameover' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
                    <div className="w-full max-w-2xl rounded-[28px] border border-pink-400/25 bg-[#111729]/94 px-8 py-7 text-center">
                        <div className="text-xs uppercase tracking-[0.36em] text-zinc-400">Run Over</div>
                        <div className="mt-3 text-5xl font-black text-pink-300">Score {visibleState.score}</div>
                        <div className="mt-2 text-lg text-zinc-300">Locked range {previewLowLabel} to {previewHighLabel}</div>
                        {isController && (
                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={startRun}
                                    className="rounded-full bg-cyan-400 px-8 py-3 text-sm font-black uppercase tracking-[0.22em] text-black"
                                >
                                    Run Again
                                </button>
                                <button
                                    type="button"
                                    onClick={resetRun}
                                    className="rounded-full border border-white/10 bg-white/10 px-8 py-3 text-sm font-black uppercase tracking-[0.22em] text-white"
                                >
                                    New Range
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PitchRunnerGame;
