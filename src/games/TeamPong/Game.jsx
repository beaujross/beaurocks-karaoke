import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { db, collection, query, where, limit, onSnapshot, addDoc, serverTimestamp } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';
import { emoji } from '../../lib/emoji';

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
    const [submitting, setSubmitting] = useState(false);
    const [cooldownUntil, setCooldownUntil] = useState(0);
    const [showTvIntro, setShowTvIntro] = useState(false);
    const introKeyRef = useRef('');
    const sessionId = String(gameState?.sessionId || '');
    const windowMs = Math.max(6000, Number(gameState?.windowMs || 18000));
    const rallyTimeoutMs = Math.max(900, Number(gameState?.rallyTimeoutMs || 3200));
    const targetRally = Math.max(10, Number(gameState?.targetRally || 45));

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

    const stats = useMemo(() => {
        const left = { hits: 0, members: new Map() };
        const right = { hits: 0, members: new Map() };
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
            bucket.hits += Math.max(1, Number(entry?.count || 1));
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
            leftMembers: Array.from(left.members.values()).slice(0, 6),
            rightMembers: Array.from(right.members.values()).slice(0, 6),
            participantCount: left.members.size + right.members.size
        };
    }, [recentEvents, users, roomCode, sessionId]);

    const latestAt = recentEvents.length ? Number(recentEvents[recentEvents.length - 1]?.timestampMs || 0) : 0;
    const rallyCount = useMemo(() => {
        if (!recentEvents.length) return 0;
        if (!latestAt || (now - latestAt) > rallyTimeoutMs) return 0;
        let count = 0;
        for (let i = recentEvents.length - 1; i >= 0; i -= 1) {
            const current = Number(recentEvents[i]?.timestampMs || 0);
            const next = i < recentEvents.length - 1 ? Number(recentEvents[i + 1]?.timestampMs || 0) : current;
            if ((next - current) > rallyTimeoutMs) break;
            count += Math.max(1, Number(recentEvents[i]?.count || 1));
        }
        return count;
    }, [recentEvents, latestAt, now, rallyTimeoutMs]);

    const teamworkMultiplier = useMemo(() => {
        const memberLift = clamp(stats.participantCount * 0.05, 0, 1.2);
        const rallyLift = clamp(rallyCount * 0.025, 0, 1.4);
        return 1 + memberLift + rallyLift;
    }, [stats.participantCount, rallyCount]);

    const energyPct = useMemo(() => clamp((rallyCount * 3) + (stats.participantCount * 6), 0, 100), [rallyCount, stats.participantCount]);

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
        const ballLeftPct = clamp(50 + xWave, 12, 88);
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
    }, [roomCode, sessionId, now, energyPct, rallyCount]);

    const resolvedUserId = String(user?.uid || user?.id || user?.name || '');
    const myTeam = normalizeTeam(gameState?.teamAssignments?.[resolvedUserId])
        || assignTeamById(resolvedUserId || 'guest', roomCode || sessionId || 'pong');
    const leftLead = stats.leftHits >= stats.rightHits;
    const cooldownRemainingMs = Math.max(0, cooldownUntil - now);
    const canSendHit = Boolean(isPlayer) && !submitting && cooldownRemainingMs <= 0;
    const rallyTimeoutSeconds = (rallyTimeoutMs / 1000).toFixed(1);
    const tvBottomSafeStyle = { bottom: 'max(14px, env(safe-area-inset-bottom))' };

    const sendPongHit = useCallback(async () => {
        if (!roomCode || !isPlayer || submitting) return;
        const nowMs = Date.now();
        if (nowMs < cooldownUntil) return;
        setSubmitting(true);
        setCooldownUntil(nowMs + 140);
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), {
                roomCode,
                type: 'team_pong_hit',
                count: 1,
                team: myTeam,
                sessionId: sessionId || null,
                userName: user?.name || 'Guest',
                avatar: user?.avatar || emoji(0x1F3D3),
                uid: user?.uid || null,
                isFree: true,
                timestamp: serverTimestamp()
            });
            if (typeof window !== 'undefined' && window.navigator?.vibrate) {
                try { window.navigator.vibrate(18); } catch {
                    // Ignore vibration failures.
                }
            }
        } catch (error) {
            console.error('Team Pong hit failed', error);
        } finally {
            setSubmitting(false);
        }
    }, [roomCode, isPlayer, submitting, cooldownUntil, myTeam, sessionId, user?.name, user?.avatar, user?.uid]);

    useEffect(() => {
        if (view !== 'tv') {
            setShowTvIntro(false);
            return () => {};
        }
        const introKey = `${sessionId || 'team_pong'}:${Number(gameState?.startedAt || gameState?.timestamp || 0)}`;
        if (introKeyRef.current === introKey) return () => {};
        introKeyRef.current = introKey;
        setShowTvIntro(true);
        const timer = setTimeout(() => setShowTvIntro(false), 3000);
        return () => clearTimeout(timer);
    }, [view, sessionId, gameState?.startedAt, gameState?.timestamp]);

    if (view === 'mobile') {
        return (
            <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),transparent_55%),radial-gradient(circle_at_bottom,rgba(217,70,239,0.2),transparent_60%),#05070f] text-white font-saira flex flex-col">
                <div className="px-5 pt-8 pb-4 text-center">
                    <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Full Game Mode</div>
                    <div className="text-4xl font-bebas text-cyan-300 leading-none mt-1">TEAM PONG</div>
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-200 mt-2">
                        You are on the {myTeam === 'right' ? 'Right' : 'Left'} team
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
                    <div className="rounded-xl border border-white/15 bg-black/35 px-3 py-2">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-zinc-300">
                            <span>Rally</span>
                            <span>x{teamworkMultiplier.toFixed(1)}</span>
                        </div>
                        <div className="mt-1 text-xl font-black text-cyan-100">{rallyCount} / {targetRally}</div>
                        <div className="mt-2 h-2 rounded-full overflow-hidden bg-black/50 border border-white/15">
                            <div className="h-full bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 transition-all duration-150" style={{ width: `${energyPct}%` }} />
                        </div>
                    </div>
                </div>
                <div className="px-4 mt-3">
                    <div className="rounded-xl border border-white/15 bg-black/35 px-3 py-3">
                        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-300">How It Works</div>
                        <div className="mt-2 text-[12px] text-zinc-100 leading-relaxed">
                            <div>1. Every tap sends <span className="font-black text-white">+1 hit</span> for your team.</div>
                            <div>2. Keep taps flowing so the rally does not drop for {rallyTimeoutSeconds}s.</div>
                            <div>3. Bigger rally boosts teamwork multiplier and energy.</div>
                        </div>
                    </div>
                </div>
                <div className="flex-1 px-4 pt-4 pb-6 flex items-center">
                    <button
                        onClick={sendPongHit}
                        disabled={!canSendHit}
                        className={`w-full rounded-[2rem] border py-8 px-6 text-center transition-all ${
                            myTeam === 'right'
                                ? 'border-fuchsia-300/55 bg-fuchsia-500/20 text-fuchsia-100'
                                : 'border-cyan-300/55 bg-cyan-500/20 text-cyan-100'
                        } ${!canSendHit ? 'opacity-45 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                    >
                        <div className="text-[10px] uppercase tracking-[0.26em] opacity-90">
                            {!isPlayer
                                ? 'Spectator View'
                                : canSendHit
                                    ? 'Tap To Send +1 Hit'
                                    : `Cooldown ${Math.max(0.1, cooldownRemainingMs / 1000).toFixed(1)}s`}
                        </div>
                        <div className="text-6xl mt-2">{emoji(0x1F3D3)}</div>
                        <div className="text-2xl font-black mt-2">
                            {!isPlayer ? 'WATCHING' : (submitting ? 'SENDING...' : (canSendHit ? 'SEND HIT' : 'RECHARGING'))}
                        </div>
                        <div className="text-[11px] uppercase tracking-[0.15em] opacity-80 mt-2">
                            Every valid tap boosts your team and keeps the rally alive
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.2),transparent_60%),radial-gradient(circle_at_bottom,rgba(217,70,239,0.2),transparent_55%),#03050c] text-white font-saira relative overflow-hidden">
            {showTvIntro && (
                <div className="absolute inset-0 z-40 bg-black/65 backdrop-blur-[2px] flex items-center justify-center px-8">
                    <div className="w-[min(94vw,1200px)] rounded-[2.4rem] border border-cyan-200/35 bg-zinc-950/92 px-10 py-9 text-center shadow-[0_0_90px_rgba(34,211,238,0.35)]">
                        <div className="text-[clamp(1rem,1.8vw,1.6rem)] uppercase tracking-[0.35em] text-zinc-300">Team Pong Controls</div>
                        <div className="mt-3 text-[clamp(3.4rem,10.8vw,8.8rem)] font-bebas text-cyan-300 leading-none">Tap Phone = +1 Hit</div>
                        <div className="mt-5 text-[clamp(1.45rem,3.1vw,2.55rem)] text-zinc-100 leading-tight">Everyone taps on their phone to keep the rally alive.</div>
                        <div className="mt-3 text-[clamp(1.2rem,2.4vw,2rem)] text-zinc-300">If no hit lands for {rallyTimeoutSeconds}s, the rally drops to 0.</div>
                        <div className="mt-6 inline-flex rounded-full border border-white/25 bg-black/55 px-7 py-3 text-[clamp(1rem,1.9vw,1.55rem)] uppercase tracking-[0.2em] text-zinc-100">
                            Goal: reach rally {targetRally}
                        </div>
                    </div>
                </div>
            )}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-[min(86vw,760px)]">
                <div className="rounded-2xl border border-white/20 bg-black/45 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-xs md:text-sm uppercase tracking-[0.2em] text-zinc-200">
                        <span>Team Pong</span>
                        <span>x{teamworkMultiplier.toFixed(1)} teamwork</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div className={`rounded-xl border px-2 py-2 ${leftLead ? 'border-cyan-300/45 bg-cyan-500/15' : 'border-white/15 bg-black/35'}`}>
                            <div className="text-xs md:text-sm uppercase tracking-[0.15em] text-zinc-300">Left Team</div>
                            <div className="text-2xl font-black text-cyan-100">{stats.leftHits}</div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-black/35 px-2 py-2">
                            <div className="text-xs md:text-sm uppercase tracking-[0.15em] text-zinc-300">Rally</div>
                            <div className="text-2xl font-black text-white">{rallyCount}</div>
                        </div>
                        <div className={`rounded-xl border px-2 py-2 ${!leftLead ? 'border-fuchsia-300/45 bg-fuchsia-500/15' : 'border-white/15 bg-black/35'}`}>
                            <div className="text-xs md:text-sm uppercase tracking-[0.15em] text-zinc-300">Right Team</div>
                            <div className="text-2xl font-black text-fuchsia-100">{stats.rightHits}</div>
                        </div>
                    </div>
                    <div className="mt-2 h-2 rounded-full overflow-hidden bg-black/55 border border-white/20">
                        <div className="h-full bg-gradient-to-r from-cyan-300 via-indigo-300 to-fuchsia-300 transition-all duration-120" style={{ width: `${energyPct}%` }} />
                    </div>
                    <div className="mt-2 text-sm md:text-base uppercase tracking-[0.11em] text-zinc-100 text-center">
                        Tap Phone = +1 Hit | Rally resets after {rallyTimeoutSeconds}s with no hit
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
                <div className="w-[92px] h-[92px] rounded-full border border-cyan-200/45 bg-gradient-to-br from-cyan-300/35 via-blue-400/30 to-fuchsia-400/35 shadow-[0_0_34px_rgba(34,211,238,0.45)] flex flex-col items-center justify-center">
                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-100">Rally</div>
                    <div className="text-3xl font-bebas text-white leading-none">{rallyCount}</div>
                    <div className="text-xs uppercase tracking-[0.12em] text-white/75">{stats.participantCount} active</div>
                </div>
            </div>
            <div
                className="absolute left-1/2 -translate-x-1/2 rounded-2xl border border-white/25 bg-black/60 px-5 py-2.5 w-[min(92vw,980px)] text-center shadow-[0_0_24px_rgba(0,0,0,0.35)]"
                style={tvBottomSafeStyle}
            >
                <div className="text-[clamp(1.2rem,2.2vw,2rem)] font-black uppercase tracking-[0.12em] text-zinc-100 leading-tight">
                    Goal: Rally {targetRally}
                </div>
                <div className="text-[clamp(0.9rem,1.5vw,1.35rem)] uppercase tracking-[0.1em] text-zinc-200 mt-1">
                    Keep hits flowing before {rallyTimeoutSeconds}s timeout
                </div>
            </div>
        </div>
    );
};

export default TeamPongGame;

