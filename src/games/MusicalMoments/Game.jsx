import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db, doc, updateDoc, arrayUnion, increment, serverTimestamp } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';
import { playVoiceGameCue, buildDynamicAudioScapePlan } from '../../lib/voiceGameSoundSystem';
import CrowdControlStartOverlay from '../shared/CrowdControlStartOverlay';
import CrowdMicInputVisualizer from '../shared/CrowdMicInputVisualizer';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const getTimestampMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
};

const parseYoutubeId = (value = '') => {
    const text = String(value || '').trim();
    if (!text) return '';
    const direct = text.match(/^[a-zA-Z0-9_-]{11}$/);
    if (direct) return text;
    const match = text.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1] || '';
};

const buildMomentCue = (gameState = {}) => ({
    title: String(gameState.title || 'Musical Moment').trim(),
    artist: String(gameState.artist || '').trim(),
    prompt: String(gameState.prompt || 'Hit the re-entry, sing the lift, and tap the crash.').trim(),
    targetLabel: String(gameState.targetLabel || 'Beat Drop').trim(),
    youtubeId: parseYoutubeId(gameState.youtubeId || gameState.mediaUrl),
    mediaUrl: String(gameState.mediaUrl || '').trim(),
    startSec: clamp(Number(gameState.startSec || 0), 0, 7200),
    loopSec: clamp(Number(gameState.loopSec || 12), 4, 45),
    mysteryStartSec: clamp(Number(gameState.mysteryStartSec ?? Math.max(0, Number(gameState.targetBeatSec || 8) - 4)), 0, 44),
    targetBeatSec: clamp(Number(gameState.targetBeatSec || 8), 0.5, 44),
    hitWindowMs: clamp(Number(gameState.hitWindowMs || 700), 180, 1800),
    tapLatencyOffsetMs: clamp(Number(gameState.tapLatencyOffsetMs || gameState.latencyOffsetMs || 0), -1200, 1200),
    vocalWindowMs: clamp(Number(gameState.vocalWindowMs || 2200), 600, 5000)
});

const MUSICAL_MOMENTS_NAILED_SCORE = 86;
const MUSICAL_MOMENTS_CLOSE_SCORE = 70;
const MUSICAL_MOMENTS_NAILED_REWARD_POINTS = 120;
const MUSICAL_MOMENTS_CLOSE_REWARD_POINTS = 40;

const getMomentReward = (scored) => {
    const score = Number(scored?.score || 0);
    if (score >= MUSICAL_MOMENTS_NAILED_SCORE) {
        return { points: MUSICAL_MOMENTS_NAILED_REWARD_POINTS, label: 'Beat Hit', tier: 'nailed' };
    }
    if (score >= MUSICAL_MOMENTS_CLOSE_SCORE) {
        return { points: MUSICAL_MOMENTS_CLOSE_REWARD_POINTS, label: 'Close Hit', tier: 'close' };
    }
    return { points: 0, label: '', tier: '' };
};

const getParticipantKey = (tap = {}) => String(tap.uid || tap.userName || tap.at || '').trim();

const buildMomentSpotlight = (scoredTaps = [], currentLoopIndex = 0) => {
    const currentLoopTaps = scoredTaps.filter((tap) => Number(tap.loopIndex || 0) === currentLoopIndex);
    const winners = currentLoopTaps
        .filter((tap) => Number(tap.score || 0) >= MUSICAL_MOMENTS_NAILED_SCORE)
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(a.errorMs || 0) - Number(b.errorMs || 0))
        .slice(0, 3);
    const winnerKeys = new Set(winners.map(getParticipantKey).filter(Boolean));
    const nextUp = [];
    for (const tap of scoredTaps) {
        const key = getParticipantKey(tap);
        if (!key || winnerKeys.has(key) || nextUp.some((entry) => getParticipantKey(entry) === key)) continue;
        nextUp.push(tap);
        if (nextUp.length >= 3) break;
    }
    return { winners, nextUp, hasMultiplePlayers: new Set(scoredTaps.map(getParticipantKey).filter(Boolean)).size > 1 };
};
const buildBeatPhase = ({ phaseMs = 0, targetMs = 0, mysteryStartMs = Math.max(0, targetMs - 4000), loopMs = 1, hitWindowMs = 700 }) => {
    let signedDistanceMs = targetMs - phaseMs;
    if (signedDistanceMs > loopMs / 2) signedDistanceMs -= loopMs;
    if (signedDistanceMs < -loopMs / 2) signedDistanceMs += loopMs;
    const absDistanceMs = Math.abs(signedDistanceMs);
    const hitWindowActive = absDistanceMs <= hitWindowMs;
    const energyPct = Math.round(clamp(1 - (absDistanceMs / 2600), 0, 1) * 100);
    if (hitWindowActive) {
        return { stage: 'tap_now', callout: 'LISTEN', helper: 'Trust the music, not the screen.', signedDistanceMs, absDistanceMs, timeToHitMs: 0, energyPct };
    }
    if (signedDistanceMs > 0 && phaseMs >= mysteryStartMs && phaseMs < targetMs) {
        return { stage: 'mystery', callout: 'SILENCE IS LIVE', helper: 'No countdown. Tap from the music.', signedDistanceMs, absDistanceMs, timeToHitMs: signedDistanceMs, energyPct };
    }
    if (signedDistanceMs > 0 && signedDistanceMs <= 2600) {
        return { stage: 'get_ready', callout: 'LISTEN CLOSE', helper: 'The screen will not count it down.', signedDistanceMs, absDistanceMs, timeToHitMs: signedDistanceMs, energyPct };
    }
    if (signedDistanceMs < 0 && absDistanceMs <= 2400) {
        return { stage: 'reveal', callout: 'REVEAL', helper: 'Now read the timing and replay it cleaner.', signedDistanceMs, absDistanceMs, timeToHitMs: loopMs - phaseMs + targetMs, energyPct };
    }
    const timeToHitMs = signedDistanceMs > 0 ? signedDistanceMs : loopMs - phaseMs + targetMs;
    return { stage: 'rehearse', callout: 'LISTEN CLOSE', helper: 'Sing the lift, then trust the audio.', signedDistanceMs, absDistanceMs, timeToHitMs, energyPct };
};

const buildMomentLoopHistory = (scoredTaps = [], currentLoopIndex = 0, cue = {}) => {
    const firstLoop = Math.max(0, currentLoopIndex - 5);
    return Array.from({ length: currentLoopIndex - firstLoop + 1 }, (_, idx) => firstLoop + idx).map((loopIndex) => {
        const taps = scoredTaps.filter((tap) => Number(tap.loopIndex || 0) === loopIndex);
        const stats = buildTimingStats(taps, cue);
        const best = taps.reduce((winner, tap) => (Number(tap.score || 0) > Number(winner?.score || 0) ? tap : winner), taps[0] || null);
        const grade = stats.bestScore >= MUSICAL_MOMENTS_NAILED_SCORE ? 'S' : stats.bestScore >= MUSICAL_MOMENTS_CLOSE_SCORE ? 'A' : stats.bestScore >= 44 ? 'C' : '-';
        return {
            loopIndex,
            total: taps.length,
            bestScore: stats.bestScore,
            averageOffsetMs: stats.averageOffsetMs,
            bestName: best?.userName || '',
            grade
        };
    });
};
const buildMomentAudioScapeSamples = (cue = {}, sampleCount = 640) => {
    const loopSec = Math.max(1, Number(cue.loopSec || 12));
    const targetRatio = clamp(Number(cue.targetBeatSec || 0) / loopSec, 0.04, 0.96);
    return Array.from({ length: sampleCount }, (_, index) => {
        const ratio = index / Math.max(1, sampleCount - 1);
        const distance = Math.abs(ratio - targetRatio);
        const wrappedDistance = Math.min(distance, 1 - distance);
        const lift = Math.max(0, 1 - (wrappedDistance / 0.105));
        const pulse = Math.sin(ratio * Math.PI * 8) * 0.18;
        const bed = Math.sin(ratio * Math.PI * 2) * 0.1;
        return clamp((bed + pulse + (lift * 0.88)) * (lift > 0.58 ? 1 : 0.72), -1, 1);
    });
};
const scoreTap = (tapAtMs, startedAtMs, cue) => {
    if (!tapAtMs || !startedAtMs) return null;
    const loopMs = cue.loopSec * 1000;
    const targetMs = cue.targetBeatSec * 1000;
    const adjustedTapAtMs = tapAtMs - Number(cue.tapLatencyOffsetMs || 0);
    const phaseMs = ((adjustedTapAtMs - startedAtMs) % loopMs + loopMs) % loopMs;
    let signedErrorMs = phaseMs - targetMs;
    if (signedErrorMs > loopMs / 2) signedErrorMs -= loopMs;
    if (signedErrorMs < -loopMs / 2) signedErrorMs += loopMs;
    const errorMs = Math.abs(signedErrorMs);
    const score = Math.round(clamp(1 - (errorMs / cue.hitWindowMs), 0, 1) * 100);
    const rating = errorMs <= cue.hitWindowMs * 0.28
        ? 'Nailed'
        : errorMs <= cue.hitWindowMs * 0.62
            ? 'Close'
            : signedErrorMs < 0
                ? 'Early'
                : 'Late';
    const loopIndex = Math.floor((adjustedTapAtMs - startedAtMs) / loopMs);
    return { phaseMs, adjustedTapAtMs, rawTapAtMs: tapAtMs, signedErrorMs, errorMs, score, rating, loopIndex };
};

const buildMomentLeaderboard = (scoredTaps = [], limit = 8) => {
    const bestByPlayer = new Map();
    scoredTaps.forEach((tap) => {
        const key = getParticipantKey(tap);
        if (!key) return;
        const existing = bestByPlayer.get(key);
        if (!existing || Number(tap.errorMs || 999999) < Number(existing.errorMs || 999999) || Number(tap.score || 0) > Number(existing.score || 0)) {
            bestByPlayer.set(key, tap);
        }
    });
    return Array.from(bestByPlayer.values())
        .sort((a, b) => Number(a.errorMs || 999999) - Number(b.errorMs || 999999) || Number(b.score || 0) - Number(a.score || 0))
        .slice(0, limit);
};
const buildTimingStats = (scoredTaps = [], cue) => {
    const taps = scoredTaps.filter((tap) => Number.isFinite(tap?.signedErrorMs));
    if (!taps.length) {
        return { early: 0, onTime: 0, late: 0, averageOffsetMs: 0, bestScore: 0, bestName: '', total: 0 };
    }
    const closeWindowMs = cue.hitWindowMs * 0.62;
    const early = taps.filter((tap) => Number(tap.signedErrorMs) < -closeWindowMs).length;
    const late = taps.filter((tap) => Number(tap.signedErrorMs) > closeWindowMs).length;
    const onTime = taps.length - early - late;
    const averageOffsetMs = Math.round(taps.reduce((sum, tap) => sum + Number(tap.signedErrorMs || 0), 0) / taps.length);
    const best = taps.reduce((winner, tap) => (Number(tap.score || 0) > Number(winner?.score || 0) ? tap : winner), taps[0]);
    return {
        early,
        onTime,
        late,
        averageOffsetMs,
        bestScore: Number(best?.score || 0),
        bestName: String(best?.userName || 'The room'),
        total: taps.length
    };
};

const buildMomentReveal = ({ timingStats, vocalLift }) => {
    const bestScore = Number(timingStats?.bestScore || 0);
    const averageOffsetMs = Number(timingStats?.averageOffsetMs || 0);
    const direction = Math.abs(averageOffsetMs) <= 65 ? 'centered' : averageOffsetMs < 0 ? 'early' : 'late';
    if (bestScore >= 86 && vocalLift >= 62) {
        return { headline: 'ROOM NAILED IT', subline: 'Timing landed and the vocal lift hit.', cue: 'nailed', grade: 'S' };
    }
    if (bestScore >= 76) {
        return { headline: 'HIT LANDED', subline: `${timingStats.bestName} caught the moment. Add more lift.`, cue: 'nailed', grade: 'A' };
    }
    if (vocalLift >= 70) {
        return { headline: 'VOCAL LIFT', subline: 'The room voice carried the moment. Tighten the tap.', cue: 'lift', grade: 'B' };
    }
    if (bestScore >= 44) {
        return { headline: 'CLOSE MOMENT', subline: `The room is ${direction}. Replay and tighten it.`, cue: 'close', grade: 'C' };
    }
    return {
        headline: direction === 'early' ? 'TOO EARLY' : direction === 'late' ? 'TOO LATE' : 'FIND THE HIT',
        subline: 'Watch the line, breathe, and punch the re-entry together.',
        cue: direction === 'early' ? 'early' : 'late',
        grade: '-'
    };
};

const playMusicalMomentCue = (cue = 'close', { intensity = 1, soundOptions = {} } = {}) => {
    playVoiceGameCue('musical_moments', cue, { ...soundOptions, intensity });
};

const MusicalMomentsGame = ({ isPlayer, roomCode, gameState, playerData, user, view = 'tv' }) => {
    const data = useMemo(() => playerData || gameState || {}, [playerData, gameState]);
    const cue = useMemo(() => buildMomentCue(data), [data]);
    const soundOptions = useMemo(() => ({
        soundPack: data.soundPack || null,
        basePath: data.soundPackBasePath || data.soundPack?.basePath || undefined,
        voiceRoomTuning: data.voiceRoomTuning || 'forgiving_room'
    }), [data.soundPack, data.soundPackBasePath, data.voiceRoomTuning]);
    const startedAtMs = getTimestampMs(data.startedAt) || Number(data.timestamp || Date.now());
    const [nowMs, setNowMs] = useState(Date.now());
    const [lastTap, setLastTap] = useState(null);
    const [tapPending, setTapPending] = useState(false);
    const tapCooldownRef = useRef(0);
    const revealCueRef = useRef('');
    const countdownCueRef = useRef('');
    const rewardedTapKeysRef = useRef(new Set());
    const lastLiveStatsWriteRef = useRef(0);

    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 80);
        return () => clearInterval(timer);
    }, []);

    const loopMs = cue.loopSec * 1000;
    const targetMs = cue.targetBeatSec * 1000;
    const phaseMs = ((nowMs - startedAtMs) % loopMs + loopMs) % loopMs;
    const voiceTelemetry = data.voiceTelemetry || {};
    const voiceCapturedAtMs = Number(voiceTelemetry?.capturedAtMs || voiceTelemetry?.timestampMs || 0);
    const voiceAgeMs = voiceCapturedAtMs > 0 ? Math.max(0, nowMs - voiceCapturedAtMs) : Number.POSITIVE_INFINITY;
    const voiceFresh = !!voiceTelemetry.active && voiceCapturedAtMs > 0 && voiceAgeMs <= 2200;
    const voiceLive = voiceFresh;
    const launchWarmupMs = Math.max(0, Number(data.voiceLaunchWarmupMs || 6200));
    const voiceVolume = clamp(Number(voiceTelemetry.volumeNormalized || 0), 0, 1);
    const voiceConfidence = clamp(Number(voiceTelemetry.confidence || 0), 0, 1);
    const vocalDistanceMs = Math.min(Math.abs(phaseMs - targetMs), loopMs - Math.abs(phaseMs - targetMs));
    const vocalInWindow = voiceLive && vocalDistanceMs <= cue.vocalWindowMs;
    const vocalLift = vocalInWindow ? Math.round(clamp((voiceVolume * 0.72) + (voiceConfidence * 0.38), 0, 1) * 100) : 0;
    const currentLoopIndex = Math.max(0, Math.floor((nowMs - startedAtMs) / loopMs));
    const turnParticipantUids = Array.isArray(cue.turnParticipantUids) ? cue.turnParticipantUids : [];
    const turnParticipants = Array.isArray(cue.turnParticipants) ? cue.turnParticipants : [];
    const currentTurnUid = cue.playMode === 'turns' && turnParticipantUids.length ? turnParticipantUids[currentLoopIndex % turnParticipantUids.length] : '';
    const currentTurnParticipant = currentTurnUid ? (turnParticipants.find((entry) => String(entry?.uid || '').trim() === currentTurnUid) || { uid: currentTurnUid, name: 'Player' }) : null;
    const nextTurnParticipant = cue.playMode === 'turns' && turnParticipantUids.length ? (turnParticipants.find((entry) => String(entry?.uid || '').trim() === turnParticipantUids[(currentLoopIndex + 1) % turnParticipantUids.length]) || null) : null;
    const activeUserUid = String(user?.uid || '').trim();
    const userCanTapThisTurn = cue.playMode !== 'turns' || !currentTurnUid || activeUserUid === currentTurnUid;
    const tapEvents = Array.isArray(data.tapEvents) ? data.tapEvents.slice(-80) : [];
    const scoredTaps = tapEvents
        .map((event) => ({ ...event, ...(scoreTap(Number(event?.at || 0), startedAtMs, cue) || {}) }))
        .filter((event) => Number.isFinite(event.score))
        .sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
    const closestBeatLeaderboard = buildMomentLeaderboard(scoredTaps, 8);
    const bestTap = scoredTaps.reduce((best, entry) => (entry.score > (best?.score || 0) ? entry : best), scoredTaps[0] || null);
    const averageTapScore = scoredTaps.length
        ? Math.round(scoredTaps.reduce((sum, entry) => sum + Number(entry.score || 0), 0) / scoredTaps.length)
        : 0;
    const roomScore = Math.round((averageTapScore * 0.52) + (vocalLift * 0.48));
    const currentLoopTaps = scoredTaps
        .filter((entry) => Number(entry.loopIndex || 0) === currentLoopIndex)
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const revealTaps = currentLoopTaps.length ? currentLoopTaps : scoredTaps.slice(0, 24);
    const timingStats = buildTimingStats(revealTaps, cue);
    const allTimingStats = buildTimingStats(scoredTaps, cue);
    const momentReveal = buildMomentReveal({ timingStats, vocalLift });
    const momentSpotlight = buildMomentSpotlight(scoredTaps, currentLoopIndex);
    const averageOffsetLabel = timingStats.total
        ? `${timingStats.averageOffsetMs > 0 ? '+' : ''}${timingStats.averageOffsetMs}ms`
        : '--';
    const latencyOffsetLabel = cue.tapLatencyOffsetMs
        ? `${cue.tapLatencyOffsetMs > 0 ? '+' : ''}${Math.round(cue.tapLatencyOffsetMs)}ms`
        : '0ms';
    const beatPhase = buildBeatPhase({ phaseMs, targetMs, mysteryStartMs: cue.mysteryStartSec * 1000, loopMs, hitWindowMs: cue.hitWindowMs });
    const revealFeedbackActive = beatPhase.stage === 'reveal' || (phaseMs > targetMs + cue.hitWindowMs && phaseMs < loopMs - 320);
    const blindListenCallout = revealFeedbackActive
        ? 'HOW DID IT LAND?'
        : beatPhase.stage === 'mystery' || beatPhase.stage === 'tap_now'
            ? 'SILENCE IS LIVE'
            : 'FOLLOW THE MUSIC';
    const blindListenHelper = revealFeedbackActive
        ? 'Timing is revealed after the hit. Replay it cleaner next loop.'
        : 'No countdown, no target marker. Tap when the music tells you.';
    const loopHistory = buildMomentLoopHistory(scoredTaps, currentLoopIndex, cue);
    const audioScapeSamples = Array.isArray(data.audioScapeSamples) && data.audioScapeSamples.length
        ? data.audioScapeSamples
        : buildMomentAudioScapeSamples(cue);
    const audioScapePlan = useMemo(() => buildDynamicAudioScapePlan({
        mode: 'musical_moments',
        cue: momentReveal.cue,
        samples: audioScapeSamples,
        durationSec: cue.loopSec,
        segmentCount: 44
    }), [audioScapeSamples, cue.loopSec, momentReveal.cue]);
    const currentLoopBest = currentLoopTaps[0] || null;
    useEffect(() => {
        if (view !== 'tv' || !roomCode || !startedAtMs) return;
        if (nowMs - Number(lastLiveStatsWriteRef.current || 0) < 1400) return;
        lastLiveStatsWriteRef.current = nowMs;
        updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
            'gameData.liveStats': {
                title: cue.title,
                artist: cue.artist,
                roomScore,
                grade: momentReveal.grade,
                bestTapScore: bestTap ? Math.round(Number(bestTap.score || 0)) : 0,
                bestTapName: bestTap?.userName || '',
                tapCount: scoredTaps.length,
                vocalLift,
                currentLoopIndex,
                averageOffsetLabel,
                updatedAtMs: nowMs
            }
        }).catch(() => {});
    }, [view, roomCode, startedAtMs, nowMs, cue.title, cue.artist, roomScore, momentReveal.grade, bestTap, scoredTaps.length, vocalLift, currentLoopIndex, averageOffsetLabel]);

    useEffect(() => {
        if (isPlayer || view !== 'tv' || !startedAtMs) return;
        const afterHitWindow = phaseMs >= targetMs && phaseMs <= targetMs + 440;
        if (!afterHitWindow) return;
        const revealKey = `${String(data.sessionId || startedAtMs)}_${currentLoopIndex}`;
        if (revealCueRef.current === revealKey) return;
        revealCueRef.current = revealKey;
        const intensity = clamp(((timingStats.bestScore || 0) / 100) + (vocalLift / 140), 0.68, 1.55);
        playMusicalMomentCue(momentReveal.cue, { intensity, soundOptions });
    }, [currentLoopIndex, data.sessionId, isPlayer, momentReveal.cue, phaseMs, soundOptions, startedAtMs, targetMs, timingStats.bestScore, view, vocalLift]);

    useEffect(() => {
        if (isPlayer || view !== 'tv' || !startedAtMs) return;
        if (beatPhase.stage !== 'get_ready' || beatPhase.timeToHitMs > 1250) return;
        const countdownKey = `${String(data.sessionId || startedAtMs)}_${currentLoopIndex}_countdown`;
        if (countdownCueRef.current === countdownKey) return;
        countdownCueRef.current = countdownKey;
        playMusicalMomentCue('countdown', { intensity: 0.92, soundOptions });
    }, [beatPhase.stage, beatPhase.timeToHitMs, currentLoopIndex, data.sessionId, isPlayer, soundOptions, startedAtMs, view]);

    const submitTap = async () => {
        if (!isPlayer || !roomCode || tapPending || !userCanTapThisTurn) return;
        const at = Date.now();
        if (at - tapCooldownRef.current < 260) return;
        tapCooldownRef.current = at;
        const scored = scoreTap(at, startedAtMs, cue);
        const reward = getMomentReward(scored);
        const activeUid = String(user?.uid || '').trim();
        const rewardKey = `${String(data.sessionId || startedAtMs)}_${activeUid}_${scored?.loopIndex ?? currentLoopIndex}_${reward.tier}`;
        const shouldAwardReward = !!activeUid && reward.points > 0 && !rewardedTapKeysRef.current.has(rewardKey);
        setLastTap({ ...scored, rewardPoints: reward.points, rewardLabel: reward.label });
        setTapPending(true);
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
                'gameData.tapEvents': arrayUnion({
                    at,
                    uid: activeUid,
                    userName: String(user?.name || 'Player').trim() || 'Player',
                    avatar: String(user?.avatar || '').trim(),
                    loopPhaseMs: scored?.phaseMs || 0,
                    targetErrorMs: scored?.errorMs || 0,
                    signedErrorMs: scored?.signedErrorMs || 0,
                    adjustedAt: scored?.adjustedTapAtMs || at,
                    tapLatencyOffsetMs: cue.tapLatencyOffsetMs,
                    score: scored?.score || 0,
                    rating: scored?.rating || 'Late',
                    loopIndex: scored?.loopIndex || 0,
                    rewardPoints: reward.points,
                    rewardLabel: reward.label
                })
            });
            if (shouldAwardReward) {
                await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${activeUid}`), {
                    points: increment(reward.points),
                    lastActiveAt: serverTimestamp()
                });
                rewardedTapKeysRef.current.add(rewardKey);
            }
        } catch (error) {
            console.error('Musical moment tap failed', error);
        } finally {
            setTapPending(false);
        }
    };

    const youtubeSrc = cue.youtubeId
        ? `https://www.youtube.com/embed/${cue.youtubeId}?autoplay=1&mute=0&controls=0&disablekb=1&fs=0&playsinline=1&start=${Math.floor(cue.startSec)}&end=${Math.floor(cue.startSec + cue.loopSec)}&loop=1&playlist=${cue.youtubeId}`
        : '';
    const isVideoUrl = /\.(mp4|webm|ogg)(?:\?|$)/i.test(cue.mediaUrl);

    if (isPlayer && view !== 'tv') {
        return (
            <div className="h-full min-h-0 overflow-y-auto bg-[linear-gradient(160deg,#05070d,#151025_48%,#06161b)] p-4 text-white">
                <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 text-center">
                    <div className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-200">Musical Moment</div>
                    <div className="text-3xl font-black">{cue.title}</div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-zinc-200">{cue.prompt}</div>
                    {cue.playMode === 'turns' && (
                        <div className={`rounded-2xl border px-4 py-3 text-sm font-black uppercase tracking-[0.18em] ${userCanTapThisTurn ? 'border-emerald-200/45 bg-emerald-400/12 text-emerald-100' : 'border-cyan-200/30 bg-cyan-400/10 text-cyan-100'}`}>
                            {userCanTapThisTurn ? 'You are up now' : `${currentTurnParticipant?.name || 'Player'} is up now`}
                        </div>
                    )}
                    <div className="rounded-[28px] border border-cyan-200/20 bg-black/45 px-4 py-5 text-white shadow-[0_18px_50px_rgba(34,211,238,0.12)]">
                        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/75">Listen-First Challenge</div>
                        <div className="mt-2 text-3xl font-black leading-tight">Tap by ear</div>
                        <div className="mt-2 text-sm font-bold uppercase tracking-[0.16em] text-zinc-300">No countdown on your phone. Follow the song and hit the crash.</div>
                    </div>                    <button
                        type="button"
                        onClick={submitTap}
                        disabled={tapPending || !userCanTapThisTurn}
                        className="min-h-[132px] rounded-[28px] border-4 border-cyan-100/70 bg-cyan-300 text-3xl font-black uppercase tracking-[0.14em] text-black shadow-[0_20px_60px_rgba(34,211,238,0.32)] active:scale-[0.98] disabled:opacity-70"
                    >
                        {userCanTapThisTurn ? 'Tap When It Hits' : 'Watch This Turn'}
                    </button>
                    {lastTap?.rewardPoints > 0 && (
                        <div className={`rounded-[28px] border px-4 py-4 text-center shadow-[0_18px_48px_rgba(16,185,129,0.18)] ${lastTap.rewardLabel === 'Beat Hit' ? 'border-emerald-200/60 bg-emerald-300 text-black' : 'border-amber-200/50 bg-amber-300 text-black'}`}>
                            <div className="text-[10px] font-black uppercase tracking-[0.28em]">{lastTap.rewardLabel}</div>
                            <div className="mt-1 text-4xl font-black">+{lastTap.rewardPoints} PTS</div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-left">
                        <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Your Tap</div>
                            <div className="mt-1 text-2xl font-black text-white">{lastTap ? lastTap.rating : '--'}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3">
                            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Room Mic</div>
                            <div className="mt-1 text-2xl font-black text-white">{voiceLive ? 'Live' : 'Waiting'}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(145deg,#05070d,#111827_44%,#06151b)] text-white">
            <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.24),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(244,114,182,0.22),transparent_32%)]" />
            {youtubeSrc ? (
                <iframe
                    title="Musical moment media"
                    src={youtubeSrc}
                    allow="autoplay; encrypted-media"
                    className="absolute inset-0 h-full w-full opacity-45"
                />
            ) : isVideoUrl ? (
                <video src={cue.mediaUrl} autoPlay loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-45" />
            ) : null}
            <div className="absolute inset-0 bg-black/45" />
            <CrowdControlStartOverlay
                enabled={view === 'tv'}
                modeTitle="Musical Moments"
                nowMs={nowMs}
                launchAtMs={startedAtMs}
                warmupMs={launchWarmupMs}
                micReady={voiceLive}
                requireMic
                live={nowMs >= startedAtMs}
                controlLabel="Phones and the room mic are live now."
                instruction="Watch the loop, tap the hit, and sing the lift together."
                accent="pink"
            />
            <CrowdMicInputVisualizer
                enabled={view === 'tv'}
                telemetry={voiceTelemetry}
                nowMs={nowMs}
                label="Crowd Mic"
                helper="Vocal lift"
                accent="pink"
                className="absolute bottom-5 left-5 w-[min(30vw,360px)]"
            />
            <div className="pointer-events-none absolute inset-x-[6%] top-[23%] bottom-[34%] z-[5] overflow-hidden rounded-[36px] border border-white/10 bg-black/18">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(34,211,238,0.12)_1px,transparent_1px),linear-gradient(180deg,rgba(244,114,182,0.1)_1px,transparent_1px)] bg-[size:9%_18%]" />
                <div className="absolute left-1/2 top-1/2 h-[78vmin] w-[78vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/12" />
                <div className="absolute left-1/2 top-1/2 h-[54vmin] w-[54vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-pink-200/16" />
                <div className="absolute left-1/2 top-1/2 h-[30vmin] w-[30vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/18" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <div className={`text-[clamp(3.4rem,10vw,10rem)] font-black leading-none ${revealFeedbackActive ? 'text-pink-100' : 'text-white'}`}>{blindListenCallout}</div>
                    <div className="mt-3 max-w-[58rem] text-[clamp(1.1rem,2.4vw,2.5rem)] font-black uppercase tracking-[0.2em] text-white/78">{blindListenHelper}</div>
                    {beatPhase.stage === 'mystery' && (
                        <div className="mt-4 rounded-full border border-white/20 bg-white/10 px-6 py-2 text-[clamp(0.9rem,1.6vw,1.5rem)] font-black uppercase tracking-[0.22em] text-white shadow-[0_0_42px_rgba(255,255,255,0.18)]">Phones are live. Listen for the crash.</div>
                    )}
                    {cue.playMode === 'turns' && currentTurnParticipant && (
                        <div className="mt-3 rounded-full border border-cyan-200/30 bg-cyan-400/10 px-6 py-2 text-[clamp(0.9rem,1.6vw,1.5rem)] font-black uppercase tracking-[0.18em] text-cyan-100">Up now: {currentTurnParticipant.avatar || ''} {currentTurnParticipant.name || 'Player'}{nextTurnParticipant?.name ? ` / next ${nextTurnParticipant.name}` : ''}</div>
                    )}
                    <div className="mt-4 flex items-center gap-3 text-[clamp(0.9rem,1.5vw,1.4rem)] font-black uppercase tracking-[0.18em] text-cyan-100/85">
                        <span>{revealFeedbackActive ? cue.targetLabel : 'Phones live'}</span>
                        <span className="text-white/30">/</span>
                        <span>{revealFeedbackActive && currentLoopBest ? `${currentLoopBest.userName || 'Player'} ${currentLoopBest.score}` : 'Follow the music'}</span>
                    </div>
                </div>
            </div>
            <div className="relative z-10 flex h-full flex-col p-8">
                <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-[0.36em] text-cyan-200">Musical Moment Challenge</div>
                        <div className="mt-2 text-[clamp(2.6rem,6vw,6.8rem)] font-black leading-none">{cue.title}</div>
                        {cue.artist && <div className="mt-2 text-2xl font-bold text-zinc-300">{cue.artist}</div>}
                    </div>
                    <div className="flex shrink-0 flex-col gap-3 text-right">
                        <div className="rounded-[28px] border border-cyan-200/30 bg-black/62 px-6 py-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100">Room Score</div>
                            <div className="text-6xl font-black text-white">{roomScore}</div>
                        </div>
                        <div className="rounded-[28px] border border-pink-200/30 bg-pink-500/12 px-6 py-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-pink-100">Moment Grade</div>
                            <div className="text-5xl font-black text-white">{momentReveal.grade}</div>
                        </div>
                    </div>
                </div>
                <div className="mt-auto grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-[32px] border border-white/10 bg-black/62 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                        <div className="flex items-center justify-between text-sm font-black uppercase tracking-[0.22em] text-zinc-300">
                            <span>{cue.prompt}</span>
                            <span>{cue.targetLabel}</span>
                        </div>
                        <div className="mt-4 rounded-[28px] border border-cyan-200/18 bg-cyan-400/8 px-5 py-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-100/80">Blind Listen</div>
                            <div className="mt-2 text-2xl font-black text-white">The screen will not show the hit.</div>
                            <div className="mt-1 text-sm font-semibold text-cyan-100/75">Follow the silence, the breath, and the crash in the track. Timing feedback unlocks after the moment passes.</div>
                            <div className="mt-4 grid grid-cols-12 gap-1.5" aria-hidden="true">
                                {Array.from({ length: 12 }, (_, idx) => (
                                    <div key={`blind_listen_${idx}`} className="h-12 rounded-full border border-white/10 bg-white/[0.06]" style={{ opacity: 0.34 + ((idx % 4) * 0.12), transform: `scaleY(${0.55 + ((idx % 5) * 0.1)})` }} />
                                ))}
                            </div>
                        </div>
                        {revealFeedbackActive && (
                            <div className="mt-4 rounded-[28px] border border-cyan-200/18 bg-cyan-400/8 px-4 py-3">
                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/80">
                                    <span>Replay Geometry</span>
                                    <span>{audioScapePlan.peaks.length} hits / {audioScapePlan.breathWindows.length} rests</span>
                                </div>
                                <div className="relative mt-3 flex h-24 items-center gap-[3px] overflow-hidden rounded-2xl border border-white/10 bg-black/35 px-2">
                                    {audioScapePlan.segments.map((segment) => (
                                        <div
                                            key={`audioscape_${segment.index}`}
                                            className={`relative z-10 flex-1 rounded-full ${segment.command === 'HIT' ? 'bg-pink-300 shadow-[0_0_18px_rgba(244,114,182,0.42)]' : segment.command === 'RIDE' ? 'bg-cyan-300/80' : 'bg-white/24'}`}
                                            style={{ height: `${Math.max(8, segment.gateHeight)}%` }}
                                            title={`${segment.command} ${segment.atSec}s`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
                            {loopHistory.map((loop) => (
                                <div key={`loop_${loop.loopIndex}`} className={`rounded-2xl border px-3 py-2 ${loop.loopIndex === currentLoopIndex ? 'border-pink-200/45 bg-pink-400/12' : loop.bestScore >= MUSICAL_MOMENTS_NAILED_SCORE ? 'border-emerald-200/35 bg-emerald-400/10' : 'border-white/10 bg-white/[0.04]'}`}>
                                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">Try {loop.loopIndex + 1}</div>
                                    <div className="mt-1 flex items-end justify-between gap-2">
                                        <span className="text-2xl font-black text-white">{loop.grade}</span>
                                        <span className="text-sm font-black text-cyan-100">{loop.bestScore || '--'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {momentSpotlight.winners.length > 0 ? (
                            <div className="mt-4 rounded-[28px] border border-emerald-200/35 bg-emerald-400/12 px-5 py-4 shadow-[0_0_42px_rgba(52,211,153,0.16)]">
                                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-100">Beat Hit Celebration</div>
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                    {momentSpotlight.winners.map((tap, idx) => (
                                        <div key={`${tap.at}_winner_${idx}`} className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3">
                                            <div className="text-xl font-black text-white">{tap.avatar || ''} {tap.userName || 'Player'}</div>
                                            <div className="mt-1 text-sm font-black uppercase tracking-[0.16em] text-emerald-100">{tap.score} timing / +{MUSICAL_MOMENTS_NAILED_REWARD_POINTS} PTS</div>
                                        </div>
                                    ))}
                                </div>
                                {momentSpotlight.hasMultiplePlayers && momentSpotlight.nextUp.length > 0 && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-cyan-100">
                                        <span>Who's Up Next</span>
                                        {momentSpotlight.nextUp.map((tap, idx) => <span key={`${tap.at}_next_${idx}`} className="rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1">{tap.avatar || ''} {tap.userName || 'Player'}</span>)}
                                    </div>
                                )}
                            </div>
                        ) : momentSpotlight.hasMultiplePlayers && momentSpotlight.nextUp.length > 0 ? (
                            <div className="mt-4 rounded-[28px] border border-cyan-200/25 bg-cyan-400/10 px-5 py-4">
                                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100">Who's Up Next</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {momentSpotlight.nextUp.map((tap, idx) => <span key={`${tap.at}_queued_${idx}`} className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-lg font-black">{tap.avatar || ''} {tap.userName || 'Player'}</span>)}
                                </div>
                            </div>
                        ) : null}
                        <div className="mt-4 rounded-[28px] border border-pink-200/20 bg-pink-500/10 px-5 py-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.26em] text-pink-100">Loop Reveal</div>
                                    <div className="mt-1 text-3xl font-black text-white">{momentReveal.headline}</div>
                                    <div className="mt-1 text-sm font-semibold text-pink-100/85">{momentReveal.subline}</div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/38 px-4 py-3 text-right">
                                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Avg Offset</div>
                                    <div className="text-2xl font-black text-white">{averageOffsetLabel}</div>
                                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-pink-100/70">Cal {latencyOffsetLabel}</div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Best Tap</div>
                                <div className="text-3xl font-black">{revealFeedbackActive && bestTap ? bestTap.score : '--'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Vocal Lift</div>
                                <div className="text-3xl font-black">{vocalLift}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Taps</div>
                                <div className="text-3xl font-black">{scoredTaps.length}</div>
                                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">{revealFeedbackActive ? `All avg ${allTimingStats.total ? `${allTimingStats.averageOffsetMs > 0 ? '+' : ''}${allTimingStats.averageOffsetMs}ms` : '--'} / cal ${latencyOffsetLabel}` : 'Hidden until reveal'}</div>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-[32px] border border-white/10 bg-black/62 p-5">
                        <div className="text-sm font-black uppercase tracking-[0.22em] text-zinc-300">Crowd Timing</div>
                        {revealFeedbackActive ? (
                            <>
                                <div className="mt-4 rounded-[28px] border border-pink-200/25 bg-pink-500/10 px-4 py-3">
                                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-100">Closest To The Crash</div>
                                    <div className="mt-3 space-y-2">
                                        {closestBeatLeaderboard.slice(0, 5).map((tap, idx) => (
                                            <div key={`${tap.at}_closest_${idx}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                                                <span className="truncate text-lg font-black text-white">#{idx + 1} {tap.avatar || ''} {tap.userName || 'Player'}</span>
                                                <span className="shrink-0 text-sm font-black uppercase tracking-[0.12em] text-pink-100">{Math.round(tap.errorMs || 0)}ms off</span>
                                            </div>
                                        ))}
                                        {!closestBeatLeaderboard.length && <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-4 text-center text-sm text-zinc-400">Leaderboard appears after the first tap.</div>}
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-3 gap-2">
                                    <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 px-3 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-100">Early</div>
                                        <div className="mt-1 text-xl font-black">{timingStats.early}</div>
                                    </div>
                                    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-100">On Time</div>
                                        <div className="mt-1 text-xl font-black">{timingStats.onTime}</div>
                                    </div>
                                    <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-3 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-100">Late</div>
                                        <div className="mt-1 text-xl font-black">{timingStats.late}</div>
                                    </div>
                                </div>
                                <div className="mt-4 space-y-2">
                                    {scoredTaps.slice(0, 6).map((tap, idx) => (
                                        <div key={`${tap.at}_${idx}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
                                            <span className="truncate text-lg font-bold">{tap.avatar || ''} {tap.userName || 'Player'}</span>
                                            <span className={tap.rating === 'Nailed' ? 'text-emerald-200 font-black' : tap.rating === 'Close' ? 'text-amber-200 font-black' : tap.rating === 'Early' ? 'text-amber-200 font-black' : 'text-fuchsia-200 font-black'}>
                                                {tap.rating} {tap.score} <span className="text-xs opacity-70">{tap.signedErrorMs > 0 ? '+' : ''}{Math.round(tap.signedErrorMs || 0)}ms</span>
                                            </span>
                                        </div>
                                    ))}
                                    {!scoredTaps.length && (
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-5 text-center text-zinc-300">
                                            Audience phones can tap the hit. Host room mic feeds the vocal lift.
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="mt-4 rounded-[28px] border border-cyan-200/20 bg-cyan-400/10 px-5 py-6 text-center">
                                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/75">Timing Hidden</div>
                                <div className="mt-2 text-2xl font-black text-white">Listen first</div>
                                <div className="mt-2 text-sm font-semibold text-zinc-300">Leaderboard and early/late feedback unlock after the hit so the music stays in charge.</div>
                            </div>
                        )}
                        <div className={`mt-4 rounded-2xl border px-4 py-3 ${voiceLive ? 'border-emerald-300/35 bg-emerald-400/10 text-emerald-100' : 'border-amber-300/35 bg-amber-400/10 text-amber-100'}`}>
                            <div className="text-[10px] font-black uppercase tracking-[0.24em] opacity-80">Host Room Mic</div>
                            <div className="mt-1 text-2xl font-black">{voiceLive ? `${String(voiceTelemetry.stableNote || voiceTelemetry.note || '--')} / ${Math.round(voiceVolume * 100)}%` : 'Waiting for setup'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MusicalMomentsGame;


