import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { db, collection, query, where, limit, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';
import { emoji } from '../../lib/emoji';
import { playVoiceGameCue } from '../../lib/voiceGameSoundSystem';
import CrowdControlStartOverlay from '../shared/CrowdControlStartOverlay';
import CrowdMicInputVisualizer from '../shared/CrowdMicInputVisualizer';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));

const toMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
};

const normalizeTeam = (team = '') => {
    const key = String(team || '').trim().toLowerCase();
    if (key === 'left' || key === 'right') return key;
    return '';
};

const hashSeed = (value = '') => (
    String(value || '')
        .split('')
        .reduce((sum, char, index) => sum + (char.charCodeAt(0) * (index + 3)), 37)
);

const seededUnit = (seed) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

const assignTeamById = (id = '', seed = '') => {
    const score = hashSeed(`${seed}:${id}`);
    return score % 2 === 0 ? 'left' : 'right';
};

const formatName = (entry = {}) => String(entry?.name || entry?.userName || 'Guest');
const TEAM_PONG_ACTIONS = Object.freeze({
    save: Object.freeze({
        id: 'save',
        label: 'Save',
        verb: 'SAVE',
        count: 1,
        cooldownMs: 260,
        icon: emoji(0x1F6E1),
        toneClass: 'border-cyan-300/55 bg-cyan-500/20 text-cyan-100'
    }),
    spike: Object.freeze({
        id: 'spike',
        label: 'Spike',
        verb: 'SPIKE',
        count: 3,
        cooldownMs: 1900,
        icon: emoji(0x26A1),
        toneClass: 'border-fuchsia-300/60 bg-fuchsia-500/20 text-fuchsia-100'
    }),
    shield: Object.freeze({
        id: 'shield',
        label: 'Shield',
        verb: 'SHIELD',
        count: 2,
        cooldownMs: 4200,
        icon: emoji(0x2728),
        toneClass: 'border-emerald-300/60 bg-emerald-500/20 text-emerald-100'
    }),
    slowmo: Object.freeze({
        id: 'slowmo',
        label: 'Slow-Mo',
        verb: 'SLOW-MO',
        count: 1,
        cooldownMs: 5600,
        icon: emoji(0x23F3),
        toneClass: 'border-violet-300/60 bg-violet-500/20 text-violet-100'
    }),
    redirect: Object.freeze({
        id: 'redirect',
        label: 'Redirect',
        verb: 'REDIRECT',
        count: 2,
        cooldownMs: 7200,
        icon: emoji(0x1F500),
        toneClass: 'border-amber-300/60 bg-amber-500/20 text-amber-100'
    })
});

const normalizeAction = (action = '') => (
    TEAM_PONG_ACTIONS[String(action || '').trim().toLowerCase()] ? String(action || '').trim().toLowerCase() : 'save'
);
const playTeamPongCue = (cue = 'save', soundOptions = {}) => {
    const intensity = cue === 'spike' ? 1.28 : cue === 'danger' ? 1.12 : 1;
    playVoiceGameCue('team_pong', cue, { ...soundOptions, intensity });
};
const TeamPongGame = ({
    roomCode,
    gameState,
    user,
    users = [],
    isPlayer = true,
    view = 'tv'
}) => {
    const [events, setEvents] = useState([]);
    const [now, setNow] = useState(Date.now());
    const [submittingAction, setSubmittingAction] = useState('');
    const [cooldowns, setCooldowns] = useState({ save: 0, spike: 0, shield: 0, slowmo: 0, redirect: 0 });
    const lastCueRef = useRef({ key: '', at: 0 });
    const lastLiveStatsWriteRef = useRef(0);
    const sessionId = String(gameState?.sessionId || '');
    const windowMs = Math.max(6000, Number(gameState?.windowMs || 18000));
    const rallyTimeoutMs = Math.max(900, Number(gameState?.rallyTimeoutMs || 3200));
    const targetRally = Math.max(10, Number(gameState?.targetRally || 45));
    const voiceTelemetry = gameState?.voiceTelemetry || gameState?.teamPongVoiceTelemetry || null;
    const soundOptions = useMemo(() => ({
        soundPack: gameState?.soundPack || null,
        basePath: gameState?.soundPackBasePath || gameState?.soundPack?.basePath || undefined,
        voiceRoomTuning: gameState?.voiceRoomTuning || 'forgiving_room'
    }), [gameState?.soundPack, gameState?.soundPackBasePath, gameState?.voiceRoomTuning]);
    const voiceCapturedAtMs = Number(voiceTelemetry?.capturedAtMs || voiceTelemetry?.timestampMs || 0);
    const voiceAgeMs = voiceCapturedAtMs ? Math.max(0, now - voiceCapturedAtMs) : Number.POSITIVE_INFINITY;
    const voiceFresh = Boolean(voiceTelemetry?.active) && voiceAgeMs <= 2200;
    const crowdChargePct = voiceFresh
        ? clamp(((Number(voiceTelemetry?.volumeNormalized || 0) * 0.72) + (Number(voiceTelemetry?.confidence || 0) * 0.18) + (Number(voiceTelemetry?.stability || 0) * 0.1)) * 125, 0, 100)
        : 0;
    const launchAtMs = Math.max(0, Number(gameState?.voiceLaunchAtMs || gameState?.startedAt || 0));
    const launchWarmupMs = Math.max(0, Number(gameState?.voiceLaunchWarmupMs || 6200));
    const launchLive = !launchAtMs || now >= launchAtMs;
    const voiceBoostedRallyTimeoutMs = Math.round(rallyTimeoutMs * (1 + ((crowdChargePct / 100) * 0.45)));

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 120);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!roomCode) {
            setEvents([]);
            return () => {};
        }
        const reactionsQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'),
            where('roomCode', '==', roomCode),
            limit(320)
        );
        const unsub = onSnapshot(reactionsQuery, (snap) => {
            const nowMs = Date.now();
            const next = snap.docs
                .map((docSnap, idx) => {
                    const data = docSnap.data() || {};
                    return {
                        ...data,
                        id: docSnap.id,
                        timestampMs: toMs(data?.timestamp) || (nowMs - (idx * 120))
                    };
                })
                .filter((entry) => entry?.type === 'team_pong_hit')
                .filter((entry) => !sessionId || String(entry?.sessionId || '') === sessionId)
                .filter((entry) => (nowMs - Number(entry.timestampMs || 0)) <= Math.max(90000, windowMs * 4))
                .sort((a, b) => Number(a.timestampMs || 0) - Number(b.timestampMs || 0))
                .slice(-260);
            setEvents(next);
        });
        return () => unsub();
    }, [roomCode, sessionId, windowMs]);

    const recentEvents = useMemo(
        () => events.filter((entry) => (now - Number(entry.timestampMs || 0)) <= windowMs),
        [events, now, windowMs]
    );
    const latestSlowMoAt = recentEvents.reduce(
        (latest, entry) => (normalizeAction(entry?.action) === 'slowmo' ? Math.max(latest, Number(entry.timestampMs || 0)) : latest),
        0
    );
    const slowMoActive = latestSlowMoAt > 0 && (now - latestSlowMoAt) <= 5200;
    const effectiveRallyTimeoutMs = Math.round(voiceBoostedRallyTimeoutMs * (slowMoActive ? 1.42 : 1));

    const stats = useMemo(() => {
        const left = { hits: 0, spikes: 0, shields: 0, slowmos: 0, redirects: 0, members: new Map() };
        const right = { hits: 0, spikes: 0, shields: 0, slowmos: 0, redirects: 0, members: new Map() };
        const rosterMap = new Map(
            (Array.isArray(users) ? users : []).map((entry) => [
                String(entry?.uid || entry?.id || ''),
                {
                    uid: String(entry?.uid || ''),
                    name: formatName(entry),
                    avatar: entry?.avatar || emoji(0x1F3D3)
                }
            ])
        );
        recentEvents.forEach((entry) => {
            const uid = String(entry?.uid || '');
            const fallbackKey = uid || `${entry?.userName || 'guest'}_${entry?.avatar || ''}`;
            const resolvedTeam = normalizeTeam(entry?.team) || assignTeamById(fallbackKey, roomCode || sessionId || 'pong');
            const bucket = resolvedTeam === 'right' ? right : left;
            const action = normalizeAction(entry?.action);
            const count = Math.max(1, Number(entry?.count || TEAM_PONG_ACTIONS[action]?.count || 1));
            bucket.hits += count;
            if (action === 'spike') bucket.spikes += 1;
            if (action === 'shield') bucket.shields += 1;
            if (action === 'slowmo') bucket.slowmos += 1;
            if (action === 'redirect') bucket.redirects += 1;
            const profile = rosterMap.get(uid) || {
                uid,
                name: formatName(entry),
                avatar: entry?.avatar || emoji(0x1F3D3)
            };
            if (!bucket.members.has(fallbackKey)) bucket.members.set(fallbackKey, profile);
        });
        return {
            leftHits: left.hits,
            rightHits: right.hits,
            leftSpikes: left.spikes,
            rightSpikes: right.spikes,
            leftShields: left.shields,
            rightShields: right.shields,
            leftSlowMos: left.slowmos,
            rightSlowMos: right.slowmos,
            leftRedirects: left.redirects,
            rightRedirects: right.redirects,
            leftMembers: Array.from(left.members.values()).slice(0, 6),
            rightMembers: Array.from(right.members.values()).slice(0, 6),
            participantCount: left.members.size + right.members.size
        };
    }, [recentEvents, users, roomCode, sessionId]);

    const latestEvent = recentEvents.length ? recentEvents[recentEvents.length - 1] : null;
    const latestAt = latestEvent ? Number(latestEvent?.timestampMs || 0) : 0;
    const latestAction = latestEvent ? normalizeAction(latestEvent?.action) : '';
    const latestTeam = normalizeTeam(latestEvent?.team)
        || (latestEvent ? assignTeamById(String(latestEvent?.uid || latestEvent?.userName || 'guest'), roomCode || sessionId || 'pong') : '');
    const rallyCount = useMemo(() => {
        if (!recentEvents.length) return 0;
        if (!latestAt || (now - latestAt) > effectiveRallyTimeoutMs) return 0;
        let count = 0;
        for (let i = recentEvents.length - 1; i >= 0; i -= 1) {
            const current = Number(recentEvents[i]?.timestampMs || 0);
            const next = i < recentEvents.length - 1 ? Number(recentEvents[i + 1]?.timestampMs || 0) : current;
            if ((next - current) > effectiveRallyTimeoutMs) break;
            count += Math.max(1, Number(recentEvents[i]?.count || 1));
        }
        return count;
    }, [recentEvents, latestAt, now, effectiveRallyTimeoutMs]);

    const teamworkMultiplier = useMemo(() => {
        const memberLift = clamp(stats.participantCount * 0.05, 0, 1.2);
        const rallyLift = clamp(rallyCount * 0.025, 0, 1.4);
        return 1 + memberLift + rallyLift;
    }, [stats.participantCount, rallyCount]);

    const energyPct = useMemo(() => clamp((rallyCount * 2.4) + (stats.participantCount * 5) + (crowdChargePct * 0.7), 0, 100), [rallyCount, stats.participantCount, crowdChargePct]);

    useEffect(() => {
        if (view !== 'tv' || !roomCode) return;
        if (now - Number(lastLiveStatsWriteRef.current || 0) < 1400) return;
        lastLiveStatsWriteRef.current = now;
        updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
            'gameData.liveStats': {
                leftHits: stats.leftHits,
                rightHits: stats.rightHits,
                leftSpikes: stats.leftSpikes,
                rightSpikes: stats.rightSpikes,
                rallyCount,
                participantCount: stats.participantCount,
                crowdChargePct: Math.round(crowdChargePct),
                energyPct: Math.round(energyPct),
                teamworkMultiplier: Number(teamworkMultiplier.toFixed(2)),
                latestAction,
                latestTeam,
                updatedAtMs: now
            }
        }).catch(() => {});
    }, [view, roomCode, now, stats.leftHits, stats.rightHits, stats.leftSpikes, stats.rightSpikes, stats.participantCount, rallyCount, crowdChargePct, energyPct, teamworkMultiplier, latestAction, latestTeam]);
    const rallyAgeMs = latestAt ? Math.max(0, now - latestAt) : effectiveRallyTimeoutMs;
    const rallyLifePct = latestAt ? clamp(100 - ((rallyAgeMs / Math.max(1, effectiveRallyTimeoutMs)) * 100), 0, 100) : 0;
    const rallyDanger = rallyCount > 0 && rallyLifePct <= 34;
    const spikeReady = energyPct >= 58;
    const redirectWindowActive = rallyCount > 0 && (rallyDanger || latestAction === 'spike' || (rallyLifePct <= 58 && energyPct >= 42));
    const latestActionLabel = latestAction ? (TEAM_PONG_ACTIONS[latestAction]?.label || latestAction) : 'No hit yet';
    const latestTeamLabel = latestTeam ? (latestTeam === 'right' ? 'Right' : 'Left') : 'No team';
    const winningTeam = stats.leftHits >= targetRally ? 'left' : stats.rightHits >= targetRally ? 'right' : '';
    const leftGoalPct = clamp((stats.leftHits / Math.max(1, targetRally)) * 100, 0, 100);
    const rightGoalPct = clamp((stats.rightHits / Math.max(1, targetRally)) * 100, 0, 100);
    const teamGoalLabel = winningTeam
        ? `${winningTeam === 'left' ? 'Left' : 'Right'} team hit the rally goal`
        : `${Math.max(0, targetRally - Math.max(stats.leftHits, stats.rightHits))} paddle hits to goal`;
    const tvCallout = latestAction === 'redirect'
        ? `${latestTeamLabel} REDIRECTED`
        : slowMoActive
        ? 'SLOW-MO ACTIVE'
        : redirectWindowActive
            ? 'REDIRECT WINDOW'
            : rallyDanger
                ? 'SAVE NOW'
                : spikeReady
                    ? 'SPIKE CHARGED'
                    : rallyCount > 0
                        ? (voiceFresh ? 'CHANT CHARGING' : 'CHANT AND TAP')
                        : 'START THE RALLY';

    const rallyCommand = rallyDanger
        ? { label: 'SAVE NOW', helper: `${(effectiveRallyTimeoutMs / 1000).toFixed(1)}s drop window. Tap Save to swing your paddle and return the ball.`, toneClass: 'border-red-200/55 bg-red-500/18 text-red-100' }
        : redirectWindowActive
            ? { label: 'REDIRECT', helper: 'Counter the attack and send the ball back across for +2.', toneClass: 'border-amber-200/50 bg-amber-400/16 text-amber-100' }
            : spikeReady
                ? { label: 'SPIKE', helper: 'Charge is high. Smash the ball toward the other side for +3.', toneClass: 'border-fuchsia-200/50 bg-fuchsia-400/16 text-fuchsia-100' }
                : voiceFresh && crowdChargePct >= 48
                    ? { label: 'CHANT', helper: `${Math.round(crowdChargePct)}% room charge is widening the paddle window.`, toneClass: 'border-cyan-200/45 bg-cyan-400/14 text-cyan-100' }
                    : { label: 'START RALLY', helper: 'Pick up your phone: Save returns the ball, Spike attacks across the table.', toneClass: 'border-white/15 bg-black/48 text-zinc-100' };

    const motion = useMemo(() => {
        const seed = hashSeed(`${roomCode || ''}:${sessionId || 'team_pong'}`);
        const tSec = now / 1000;
        const energy = energyPct / 100;
        const rallyFactor = rallyCount > 0 ? 1 : 0.72;
        const ampX = (20 + (seededUnit(seed + 11) * 16)) * rallyFactor * (0.7 + (energy * 0.55));
        const ampY = (10 + (seededUnit(seed + 17) * 11)) * rallyFactor * (0.72 + (energy * 0.45));
        const phaseA = seededUnit(seed + 23) * Math.PI * 2;
        const phaseB = seededUnit(seed + 29) * Math.PI * 2;
        const phaseC = seededUnit(seed + 31) * Math.PI * 2;
        const phaseD = seededUnit(seed + 37) * Math.PI * 2;
        const xWave = (
            Math.sin((tSec * (0.82 + (seededUnit(seed + 41) * 0.25))) + phaseA) * ampX
            + Math.sin((tSec * (1.48 + (seededUnit(seed + 43) * 0.2))) + phaseB) * (ampX * 0.4)
        );
        const yWave = (
            Math.cos((tSec * (1.04 + (seededUnit(seed + 47) * 0.22))) + phaseC) * ampY
            + Math.sin((tSec * (1.68 + (seededUnit(seed + 53) * 0.2))) + phaseD) * (ampY * 0.42)
        );
        const latestTeamDirection = latestTeam === 'left' ? 1 : latestTeam === 'right' ? -1 : 0;
        const actionBias = latestAction === 'spike'
            ? latestTeamDirection * 18
            : latestAction === 'redirect'
                ? latestTeamDirection * 14
                : (latestAction === 'save' || latestAction === 'shield')
                    ? latestTeamDirection * 8
                    : 0;
        const ballLeftPct = clamp(50 + xWave + actionBias, 12, 88);
        const ballTopPct = clamp(50 + yWave, 18, 82);
        const paddleLead = 0.62 + (energy * 0.2);
        const leftPaddleTopPct = clamp(
            50 + ((ballTopPct - 50) * paddleLead) + (Math.sin((tSec * 0.9) + phaseA) * 5),
            16,
            84
        );
        const rightPaddleTopPct = clamp(
            50 + ((ballTopPct - 50) * paddleLead) + (Math.cos((tSec * 0.86) + phaseC) * 5),
            16,
            84
        );
        return { ballLeftPct, ballTopPct, leftPaddleTopPct, rightPaddleTopPct };
    }, [roomCode, sessionId, now, energyPct, rallyCount, latestAction, latestTeam]);

    const resolvedUserId = String(user?.uid || user?.id || user?.name || '');
    const myTeam = normalizeTeam(gameState?.teamAssignments?.[resolvedUserId])
        || assignTeamById(resolvedUserId || 'guest', roomCode || sessionId || 'pong');
    const leftLead = stats.leftHits >= stats.rightHits;
    const leftChargePct = useMemo(
        () => clamp((stats.leftHits * 3.4) + (stats.leftSpikes * 12) + (stats.leftShields * 9) + (stats.leftSlowMos * 7) + (stats.leftRedirects * 11) + (stats.participantCount * 2) + (crowdChargePct * (leftLead ? 0.42 : 0.28)), 0, 100),
        [stats.leftHits, stats.leftSpikes, stats.leftShields, stats.leftSlowMos, stats.leftRedirects, stats.participantCount, crowdChargePct, leftLead]
    );
    const rightChargePct = useMemo(
        () => clamp((stats.rightHits * 3.4) + (stats.rightSpikes * 12) + (stats.rightShields * 9) + (stats.rightSlowMos * 7) + (stats.rightRedirects * 11) + (stats.participantCount * 2) + (crowdChargePct * (!leftLead ? 0.42 : 0.28)), 0, 100),
        [stats.rightHits, stats.rightSpikes, stats.rightShields, stats.rightSlowMos, stats.rightRedirects, stats.participantCount, crowdChargePct, leftLead]
    );
    const myTeamChargePct = myTeam === 'right' ? rightChargePct : leftChargePct;
    const saveCooldownRemainingMs = Math.max(0, Number(cooldowns.save || 0) - now);
    const spikeCooldownRemainingMs = Math.max(0, Number(cooldowns.spike || 0) - now);
    const shieldCooldownRemainingMs = Math.max(0, Number(cooldowns.shield || 0) - now);
    const slowMoCooldownRemainingMs = Math.max(0, Number(cooldowns.slowmo || 0) - now);
    const redirectCooldownRemainingMs = Math.max(0, Number(cooldowns.redirect || 0) - now);
    const canSendSave = Boolean(isPlayer) && !submittingAction && saveCooldownRemainingMs <= 0;
    const canSendSpike = Boolean(isPlayer) && !submittingAction && spikeCooldownRemainingMs <= 0;
    const canSendShield = Boolean(isPlayer) && !submittingAction && shieldCooldownRemainingMs <= 0;
    const canSendSlowMo = Boolean(isPlayer) && !submittingAction && slowMoCooldownRemainingMs <= 0;
    const canSendRedirect = Boolean(isPlayer) && !submittingAction && redirectCooldownRemainingMs <= 0 && redirectWindowActive;
    const tvBottomSafeStyle = { bottom: 'max(14px, env(safe-area-inset-bottom))' };

    const sendPongAction = useCallback(async (rawAction = 'save') => {
        const action = normalizeAction(rawAction);
        const actionMeta = TEAM_PONG_ACTIONS[action] || TEAM_PONG_ACTIONS.save;
        if (!roomCode || !isPlayer || submittingAction) return;
        const nowMs = Date.now();
        if (nowMs < Number(cooldowns[action] || 0)) return;
        setSubmittingAction(action);
        setCooldowns((prev) => ({
            ...prev,
            [action]: nowMs + Number(actionMeta.cooldownMs || 260)
        }));
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), {
                roomCode,
                type: 'team_pong_hit',
                action,
                count: Number(actionMeta.count || 1),
                team: myTeam,
                sessionId: sessionId || null,
                userName: user?.name || 'Guest',
                avatar: user?.avatar || emoji(0x1F3D3),
                uid: user?.uid || null,
                isFree: true,
                timestamp: serverTimestamp()
            });
            if (typeof window !== 'undefined' && window.navigator?.vibrate) {
                try { window.navigator.vibrate(action === 'spike' ? [22, 35, 28] : action === 'redirect' ? [18, 18, 42, 18] : action === 'shield' ? [18, 24, 18] : action === 'slowmo' ? [14, 24, 14, 24] : 18); } catch {
                    // Ignore vibration failures.
                }
            }
        } catch (error) {
            console.error('Team Pong action failed', error);
        } finally {
            setSubmittingAction('');
        }
    }, [roomCode, isPlayer, submittingAction, cooldowns, myTeam, sessionId, user?.name, user?.avatar, user?.uid]);

    useEffect(() => {
        const cueKey = rallyDanger
            ? `danger:${Math.floor(now / 900)}`
            : latestAt
                ? `${latestAction}:${latestAt}`
                : (voiceFresh && crowdChargePct >= 72 ? `charge:${Math.floor(now / 1400)}` : '');
        if (!cueKey) return;
        const cueAt = Date.now();
        if (lastCueRef.current.key === cueKey || (cueAt - Number(lastCueRef.current.at || 0)) < 380) return;
        lastCueRef.current = { key: cueKey, at: cueAt };
        if (rallyDanger) {
            playTeamPongCue('danger', soundOptions);
        } else if (latestAction === 'spike') {
            playTeamPongCue('spike', soundOptions);
        } else if (latestAction === 'shield') {
            playTeamPongCue('shield', soundOptions);
        } else if (latestAction === 'slowmo') {
            playTeamPongCue('slowmo', soundOptions);
        } else if (latestAction === 'redirect') {
            playTeamPongCue('redirect', soundOptions);
        } else if (latestAction === 'save') {
            playTeamPongCue('save', soundOptions);
        } else if (voiceFresh && crowdChargePct >= 72) {
            playTeamPongCue('charge', soundOptions);
        }
    }, [rallyDanger, latestAction, latestAt, voiceFresh, crowdChargePct, now, soundOptions]);
    if (view === 'mobile') {
        return (
            <div className="h-full w-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_55%),radial-gradient(circle_at_bottom,rgba(217,70,239,0.2),transparent_60%),#05070f] text-white font-saira flex flex-col">
                <div className="px-5 pt-8 pb-4 text-center">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Full Game Mode</div>
                    <div className="text-4xl font-bebas text-cyan-300 leading-none mt-1">TEAM PONG</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-200 mt-2">
                        You control the {myTeam === 'right' ? 'Right' : 'Left'} paddle
                    </div>
                </div>
                <div className="px-4 grid grid-cols-2 gap-2">
                    <div className={`rounded-xl border px-3 py-2 ${leftLead ? 'border-cyan-300/50 bg-cyan-500/15' : 'border-white/15 bg-black/35'}`}>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-300">Left</div>
                        <div className="text-2xl font-black text-white">{stats.leftHits}</div>
                    </div>
                    <div className={`rounded-xl border px-3 py-2 ${!leftLead ? 'border-fuchsia-300/50 bg-fuchsia-500/15' : 'border-white/15 bg-black/35'}`}>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-300">Right</div>
                        <div className="text-2xl font-black text-white">{stats.rightHits}</div>
                    </div>
                </div>
                <div className="px-4 mt-3">
                    <div className="rounded-xl border border-white/15 bg-black/35 px-3 py-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-300">How It Works</div>
                        <div className="mt-2 text-[12px] text-zinc-100 leading-relaxed">
                            <div>1. Your phone is your paddle: <span className="font-black text-white">Save</span> returns the ball for your side.</div>
                            <div>2. First side to <span className="font-black text-white">{targetRally}</span> paddle hits wins the rally goal.</div>
                            <div>3. Chant to widen the return window; <span className="font-black text-white">Spike</span> attacks across, <span className="font-black text-white">Redirect</span> counters.</div>
                        </div>
                    </div>
                    <div className="mt-2 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                            <span>Room Chant</span>
                            <span>{voiceFresh ? `${Math.round(crowdChargePct)}%` : 'Mic waiting'}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full overflow-hidden bg-black/55 border border-cyan-100/15">
                            <div className="h-full bg-cyan-300 transition-all duration-150" style={{ width: `${crowdChargePct}%` }} />
                        </div>
                    </div>
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-100">
                            <span>Your Team Charge</span>
                            <span>{Math.round(myTeamChargePct)}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full overflow-hidden bg-black/55 border border-white/10">
                            <div className={`h-full transition-all duration-150 ${myTeam === 'right' ? 'bg-fuchsia-300' : 'bg-cyan-300'}`} style={{ width: `${myTeamChargePct}%` }} />
                        </div>
                    </div>
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-100">
                            <span>Last TV Hit</span>
                            <span>{latestTeam ? `${latestTeamLabel} ${latestActionLabel}` : 'Waiting'}</span>
                        </div>
                    </div>
                </div>
                <div className="px-4 pt-4 pb-6 flex flex-col gap-3">
                    <button
                        onClick={() => sendPongAction('save')}
                        disabled={!canSendSave}
                        className={`w-full rounded-[2rem] border py-6 px-6 text-center transition-all ${TEAM_PONG_ACTIONS.save.toneClass} ${!canSendSave ? 'opacity-45 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                    >
                        <div className="text-[10px] uppercase tracking-[0.26em] opacity-90">
                            {!isPlayer
                                ? 'Spectator View'
                                : canSendSave
                                    ? 'Swing Your Paddle Before The Ball Drops'
                                    : `Cooldown ${Math.max(0.1, saveCooldownRemainingMs / 1000).toFixed(1)}s`}
                        </div>
                        <div className="text-5xl mt-2">{TEAM_PONG_ACTIONS.save.icon}</div>
                        <div className="text-2xl font-black mt-2">
                            {!isPlayer ? 'WATCHING' : (submittingAction === 'save' ? 'SAVING...' : (canSendSave ? 'SAVE RALLY' : 'RECHARGING'))}
                        </div>
                        <div className="text-[11px] uppercase tracking-[0.15em] opacity-80 mt-2">
                            Your team's paddle returns the ball +1
                        </div>
                    </button>
                    <button
                        onClick={() => sendPongAction('slowmo')}
                        disabled={!canSendSlowMo}
                        className={`w-full rounded-[1.6rem] border py-4 px-5 text-center transition-all ${TEAM_PONG_ACTIONS.slowmo.toneClass} ${!canSendSlowMo ? 'opacity-45 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                    >
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-3xl">{TEAM_PONG_ACTIONS.slowmo.icon}</span>
                            <span className="text-xl font-black">
                                {!isPlayer ? 'SLOW-MO LOCKED' : (submittingAction === 'slowmo' ? 'SLOWING...' : (canSendSlowMo ? 'SLOW-MO' : `SLOW-MO ${Math.max(0.1, slowMoCooldownRemainingMs / 1000).toFixed(1)}s`))}
                            </span>
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.15em] opacity-80 mt-1">
                            Stretches the rally window
                        </div>
                    </button>
                    <button
                        onClick={() => sendPongAction('shield')}
                        disabled={!canSendShield}
                        className={`w-full rounded-[1.6rem] border py-4 px-5 text-center transition-all ${TEAM_PONG_ACTIONS.shield.toneClass} ${!canSendShield ? 'opacity-45 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                    >
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-3xl">{TEAM_PONG_ACTIONS.shield.icon}</span>
                            <span className="text-xl font-black">
                                {!isPlayer ? 'SHIELD LOCKED' : (submittingAction === 'shield' ? 'SHIELDING...' : (canSendShield ? 'SHIELD +2' : `SHIELD ${Math.max(0.1, shieldCooldownRemainingMs / 1000).toFixed(1)}s`))}
                            </span>
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.15em] opacity-80 mt-1">
                            Defensive save, long recharge
                        </div>
                    </button>
                    <button
                        onClick={() => sendPongAction('redirect')}
                        disabled={!canSendRedirect}
                        className={`w-full rounded-[1.6rem] border py-4 px-5 text-center transition-all ${TEAM_PONG_ACTIONS.redirect.toneClass} ${!canSendRedirect ? 'opacity-45 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                    >
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-3xl">{TEAM_PONG_ACTIONS.redirect.icon}</span>
                            <span className="text-xl font-black">
                                {!isPlayer ? 'REDIRECT LOCKED' : (!redirectWindowActive ? 'WAIT FOR WINDOW' : (submittingAction === 'redirect' ? 'REDIRECTING...' : (canSendRedirect ? 'REDIRECT +2' : `REDIRECT ${Math.max(0.1, redirectCooldownRemainingMs / 1000).toFixed(1)}s`)))}
                            </span>
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.15em] opacity-80 mt-1">
                            Counter the attack and send it back across
                        </div>
                    </button>
                    <button
                        onClick={() => sendPongAction('spike')}
                        disabled={!canSendSpike}
                        className={`w-full rounded-[1.6rem] border py-4 px-5 text-center transition-all ${TEAM_PONG_ACTIONS.spike.toneClass} ${!canSendSpike ? 'opacity-45 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                    >
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-3xl">{TEAM_PONG_ACTIONS.spike.icon}</span>
                            <span className="text-xl font-black">
                                {!isPlayer ? 'SPIKE LOCKED' : (submittingAction === 'spike' ? 'SPIKING...' : (canSendSpike ? 'SPIKE +3' : `SPIKE ${Math.max(0.1, spikeCooldownRemainingMs / 1000).toFixed(1)}s`))}
                            </span>
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.15em] opacity-80 mt-1">
                            Attack across the table +3
                        </div>
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_60%),radial-gradient(circle_at_bottom,rgba(217,70,239,0.2),transparent_55%),#03050c] text-white font-saira relative overflow-hidden">
            <CrowdControlStartOverlay
                enabled={view === 'tv'}
                modeTitle="Team Pong"
                nowMs={now}
                launchAtMs={launchAtMs}
                warmupMs={launchWarmupMs}
                micReady={voiceFresh}
                requireMic
                live={launchLive}
                controlLabel="Audience phones are paddles now."
                instruction="Save returns the ball. Spike attacks across. First side to the rally goal wins."
                accent="cyan"
            />
            <CrowdMicInputVisualizer
                enabled={view === 'tv'}
                telemetry={voiceTelemetry || {}}
                nowMs={now}
                label="Crowd Chant"
                helper="Rally charge"
                accent="cyan"
                className="absolute bottom-5 left-5 w-[min(30vw,360px)]"
            />
            <div className="pointer-events-none absolute inset-x-[10%] top-[16%] z-30 flex justify-center">
                <div className={`max-w-[980px] rounded-[30px] border px-7 py-4 text-center shadow-[0_0_46px_rgba(0,0,0,0.38)] ${rallyCommand.toneClass}`}>
                    <div className="text-[10px] font-black uppercase tracking-[0.32em] opacity-75">Paddle Command</div>
                    <div className="mt-1 text-[clamp(2.7rem,7.4vw,7rem)] font-black leading-none text-white">{rallyCommand.label}</div>
                    <div className="mt-2 text-[clamp(0.9rem,1.6vw,1.45rem)] font-black uppercase tracking-[0.16em] opacity-85">{rallyCommand.helper}</div>
                </div>
            </div>
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-[min(86vw,760px)]">
                <div className="rounded-2xl border border-white/20 bg-black/45 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-xs md:text-sm uppercase tracking-[0.2em] text-zinc-200">
                        <span>First to {targetRally} paddle hits</span>
                        <span>x{teamworkMultiplier.toFixed(1)} teamwork</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div className={`rounded-xl border px-2 py-2 ${leftLead ? 'border-cyan-300/45 bg-cyan-500/15' : 'border-white/15 bg-black/35'}`}>
                            <div className="text-xs md:text-sm uppercase tracking-[0.15em] text-zinc-300">Left Team</div>
                            <div className="text-2xl font-black text-cyan-100">{stats.leftHits}</div>
                            <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-black/50 border border-cyan-100/15">
                                <div className="h-full bg-cyan-300 transition-all duration-120" style={{ width: `${leftChargePct}%` }} />
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-black/35 px-2 py-2">
                            <div className="text-xs md:text-sm uppercase tracking-[0.15em] text-zinc-300">Live Rally</div>
                            <div className="text-2xl font-black text-white">{rallyCount}</div>
                        </div>
                        <div className={`rounded-xl border px-2 py-2 ${!leftLead ? 'border-fuchsia-300/45 bg-fuchsia-500/15' : 'border-white/15 bg-black/35'}`}>
                            <div className="text-xs md:text-sm uppercase tracking-[0.15em] text-zinc-300">Right Team</div>
                            <div className="text-2xl font-black text-fuchsia-100">{stats.rightHits}</div>
                            <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-black/50 border border-fuchsia-100/15">
                                <div className="h-full bg-fuchsia-300 transition-all duration-120" style={{ width: `${rightChargePct}%` }} />
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                        <div className="flex items-center justify-between text-[10px] md:text-xs uppercase tracking-[0.14em] text-zinc-100">
                            <span>Goal race</span>
                            <span>{teamGoalLabel}</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="h-2 rounded-full overflow-hidden bg-black/55 border border-cyan-100/15">
                                <div className="h-full bg-cyan-300 transition-all duration-120" style={{ width: `${leftGoalPct}%` }} />
                            </div>
                            <div className="h-2 rounded-full overflow-hidden bg-black/55 border border-fuchsia-100/15">
                                <div className="h-full bg-fuchsia-300 transition-all duration-120" style={{ width: `${rightGoalPct}%` }} />
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 h-2 rounded-full overflow-hidden bg-black/55 border border-white/20">
                        <div className="h-full bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 transition-all duration-120" style={{ width: `${energyPct}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] md:text-xs uppercase tracking-[0.14em] text-cyan-100/80">
                        <span>Room chant charge</span>
                        <span>{voiceFresh ? `${Math.round(crowdChargePct)}%` : 'Host mic waiting'}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full overflow-hidden bg-cyan-950/50 border border-cyan-100/15">
                        <div className="h-full bg-cyan-300 transition-all duration-120" style={{ width: `${crowdChargePct}%` }} />
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-[10px] md:text-xs uppercase tracking-[0.14em]">
                        <div className="rounded-full border border-cyan-200/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">
                            Left charge {Math.round(leftChargePct)}%
                        </div>
                        <div className="rounded-full border border-fuchsia-200/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100 text-right">
                            Right charge {Math.round(rightChargePct)}%
                        </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-red-950/60 border border-red-200/15">
                        <div className={`h-full transition-all duration-120 ${rallyDanger ? 'bg-red-300' : 'bg-emerald-300'}`} style={{ width: `${rallyLifePct}%` }} />
                    </div>
                    <div className="mt-2 text-sm md:text-base uppercase tracking-[0.11em] text-zinc-100 text-center">
                        {tvCallout} | Objective: first side to {targetRally} paddle hits | Save returns, Spike attacks, Redirect counters
                    </div>
                </div>
            </div>
            <div className="absolute left-[7%] right-[7%] top-[19%] bottom-[12%] rounded-[32px] border border-cyan-300/35 bg-black/20 shadow-[inset_0_0_34px_rgba(34,211,238,0.12)]">
                <div className="absolute inset-y-[8%] left-1/2 -translate-x-1/2 w-[2px] bg-cyan-200/35"></div>
                <div className="absolute inset-x-[8%] top-[8%] h-[1px] bg-cyan-100/20"></div>
                <div className="absolute inset-x-[8%] bottom-[8%] h-[1px] bg-cyan-100/20"></div>
            </div>
            <div className="absolute top-[24%] left-[7.5%] rounded-xl border border-cyan-200/35 bg-black/45 px-2 py-1.5 text-xs uppercase tracking-[0.13em] text-cyan-100 min-w-[120px]">
                <div className="font-black mb-1">Left Team</div>
                <div className="flex items-center gap-1">
                    {(stats.leftMembers.length ? stats.leftMembers : [{ uid: 'left-empty', avatar: emoji(0x1F44B), name: 'Open' }]).slice(0, 5).map((entry, idx) => (
                        <span key={`${entry.uid || 'left'}-${idx}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-200/40 bg-black/45 text-xs" title={formatName(entry)}>
                            {entry.avatar || emoji(0x1F44B)}
                        </span>
                    ))}
                </div>
            </div>
            <div className="absolute top-[24%] right-[7.5%] rounded-xl border border-fuchsia-200/35 bg-black/45 px-2 py-1.5 text-xs uppercase tracking-[0.13em] text-fuchsia-100 min-w-[120px]">
                <div className="font-black mb-1">Right Team</div>
                <div className="flex items-center justify-end gap-1">
                    {(stats.rightMembers.length ? stats.rightMembers : [{ uid: 'right-empty', avatar: emoji(0x2728), name: 'Open' }]).slice(0, 5).map((entry, idx) => (
                        <span key={`${entry.uid || 'right'}-${idx}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-fuchsia-200/40 bg-black/45 text-xs" title={formatName(entry)}>
                            {entry.avatar || emoji(0x2728)}
                        </span>
                    ))}
                </div>
            </div>
            <div className="absolute left-[8.5%] w-[1.4%] min-w-[12px] h-[18%] min-h-[90px] -translate-y-1/2 rounded-full border border-cyan-200/45 bg-cyan-400/25 shadow-[0_0_22px_rgba(34,211,238,0.35)] transition-[top] duration-150" style={{ top: `${motion.leftPaddleTopPct}%` }} />
            <div className="absolute right-[8.5%] w-[1.4%] min-w-[12px] h-[18%] min-h-[90px] -translate-y-1/2 rounded-full border border-fuchsia-200/45 bg-fuchsia-400/25 shadow-[0_0_22px_rgba(217,70,239,0.35)] transition-[top] duration-150" style={{ top: `${motion.rightPaddleTopPct}%` }} />
            <div className="absolute -translate-x-1/2 -translate-y-1/2 transition-[top,left] duration-130 ease-out" style={{ top: `${motion.ballTopPct}%`, left: `${motion.ballLeftPct}%` }}>
                <div className={`w-[92px] h-[92px] rounded-full border ${latestAction === 'redirect' ? 'border-amber-200/75 bg-gradient-to-br from-amber-300/50 via-cyan-300/35 to-fuchsia-300/25 shadow-[0_0_60px_rgba(251,191,36,0.65)]' : latestAction === 'spike' ? 'border-fuchsia-200/70 bg-gradient-to-br from-fuchsia-300/45 via-purple-400/35 to-cyan-300/30 shadow-[0_0_54px_rgba(217,70,239,0.62)]' : 'border-cyan-200/45 bg-gradient-to-br from-cyan-300/35 via-blue-400/30 to-fuchsia-400/35 shadow-[0_0_34px_rgba(34,211,238,0.45)]'} flex flex-col items-center justify-center`}>
                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-100">Ball</div>
                    <div className="text-3xl font-bebas text-white leading-none">{rallyCount}</div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/75">{latestTeam ? `${latestTeamLabel} ${latestActionLabel}` : `${stats.participantCount} active`}</div>
                </div>
            </div>
            <div
                className="absolute left-1/2 -translate-x-1/2 rounded-2xl border border-white/25 bg-black/60 px-5 py-2.5 w-[min(92vw,980px)] text-center shadow-[0_0_24px_rgba(0,0,0,0.35)]"
                style={tvBottomSafeStyle}
            >
                <div className="text-[clamp(1.2rem,2.2vw,2rem)] font-black uppercase tracking-[0.12em] text-zinc-100 leading-tight">
                    Goal: first team to {targetRally} paddle hits
                </div>
                <div className="text-[clamp(0.9rem,1.5vw,1.35rem)] uppercase tracking-[0.1em] text-zinc-200 mt-1">
                    Phones are paddles: Save returns the ball, Spike attacks across, Redirect counters. Crowd chant widens the return window.
                </div>
            </div>
        </div>
    );
};

export default TeamPongGame;

