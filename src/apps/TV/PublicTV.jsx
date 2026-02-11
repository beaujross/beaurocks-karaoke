import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, collection, doc, onSnapshot, query, where, limit, orderBy, updateDoc, addDoc, serverTimestamp, trackEvent } from '../../lib/firebase';
import { APP_ID } from '../../lib/assets';
import { ASSETS, STORM_SFX } from '../../lib/assets';
import QRCode from 'qrcode';
import { averageBand } from '../../lib/utils';
import AudioVisualizer from '../../components/AudioVisualizer';
import Stage from '../../components/Stage';
import GameContainer from '../../components/GameContainer';
import { emoji, EMOJI } from '../../lib/emoji';
import { HOW_TO_PLAY } from '../../lib/howToPlay';
import { REACTION_COSTS } from '../../lib/reactionConstants';
import { normalizeBackingChoice, resolveStageMediaUrl } from '../../lib/playbackSource';

const isTvVisibleChatMessage = (message) => {
    if (!message) return false;
    if (message.toHost || message.toUid) return false;
    if (message.channel === 'dm') return false;
    return true;
};

const formatWaitTime = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const mins = Math.floor(safe / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    return `${mins}m`;
};

// --- SUB-COMPONENTS ---
const LocalQrImage = ({ value, size = 220, className = '', alt = 'QR' }) => {
    const [src, setSrc] = useState('');

    useEffect(() => {
        let active = true;
        if (!value) {
            setSrc('');
            return undefined;
        }
        QRCode.toDataURL(value, {
            width: size,
            margin: 1,
            errorCorrectionLevel: 'M'
        }).then((dataUrl) => {
            if (active) setSrc(dataUrl);
        }).catch((err) => {
            console.warn('QR generation failed', err);
            if (active) setSrc('');
        });
        return () => {
            active = false;
        };
    }, [value, size]);

    if (!src) {
        return (
            <div
                className={`${className} bg-zinc-200/60 text-zinc-700 flex items-center justify-center text-xs font-bold`}
                style={{ width: `${size}px`, height: `${size}px` }}
            >
                QR
            </div>
        );
    }

    return <img src={src} alt={alt} className={className} />;
};

const AnimatedPoints = ({ value }) => {
    const [display, setDisplay] = useState(value);
    const showPulse = value !== display;

    useEffect(() => {
        if (display === value) return;
        const interval = setInterval(() => {
            setDisplay(prev => {
                const diff = value - prev;
                if (diff === 0) { clearInterval(interval); return value; }
                return prev + Math.ceil(diff / 6);
            });
        }, 30);
        return () => clearInterval(interval);
    }, [value]);
    
    return (
        <div className={`relative bg-black/60 backdrop-blur-sm px-5 py-3 rounded-full border border-yellow-500/30 flex items-center gap-3 shadow-lg transition-transform duration-200 ${showPulse ? 'scale-110' : 'scale-100'}`}>
            {showPulse && (
                <div className="absolute inset-0 pointer-events-none">
                    <span className="points-burst points-burst-a"></span>
                    <span className="points-burst points-burst-b"></span>
                    <span className="points-burst points-burst-c"></span>
                </div>
            )}
            <span className="text-yellow-300 font-black text-3xl font-mono">{display}</span>
            <span className="text-sm text-yellow-500 font-bold tracking-widest">PTS</span>
        </div>
    );
};

const LeaderboardOverlay = ({ users, songs }) => {
    const leaderboardModes = [
        { key: 'performances', label: 'Most Performances', unit: 'PERF', getValue: (u) => u.performances },
        { key: 'totalEmojis', label: 'Most Emojis Sent', unit: 'EMOJIS', getValue: (u) => u.totalEmojis },
        { key: 'loudest', label: 'Loudest Performance', unit: 'dB', getValue: (u) => u.loudest },
        { key: 'totalPoints', label: 'Most Points', unit: 'PTS', getValue: (u) => u.totalPoints },
    ];
    const [modeIndex, setModeIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setModeIndex(prev => (prev + 1) % leaderboardModes.length);
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    const leaderboardStats = useMemo(() => {
        const stats = new Map();
        users.forEach(u => {
            const key = u.uid || u.name;
            stats.set(key, {
                uid: u.uid || key,
                name: u.name,
                avatar: u.avatar,
                isVip: !!u.isVip || (u.vipLevel || 0) > 0,
                totalEmojis: u.totalEmojis || 0,
                performances: 0,
                loudest: 0,
                totalPoints: 0
            });
        });
        songs.filter(s => s.status === 'performed').forEach(s => {
            const matched = users.find(u => u.uid === s.singerUid || u.name === s.singerName);
            const key = matched?.uid || s.singerUid || s.singerName;
            if (!stats.has(key)) {
                stats.set(key, {
                    uid: key,
                    name: s.singerName,
                    avatar: s.emoji || 'O',
                    isVip: false,
                    totalEmojis: 0,
                    performances: 0,
                    loudest: 0,
                    totalPoints: 0
                });
            }
            const entry = stats.get(key);
            entry.performances += 1;
            entry.loudest = Math.max(entry.loudest, s.applauseScore || 0);
            entry.totalPoints += (s.hypeScore || 0) + (s.applauseScore || 0) + (s.hostBonus || 0);
        });
        return Array.from(stats.values());
    }, [users, songs]);

    const leaderboard = (() => {
        const mode = leaderboardModes[modeIndex];
        return [...leaderboardStats].sort((a, b) =>
            (mode.getValue(b) - mode.getValue(a)) ||
            (b.performances - a.performances) ||
            (b.totalEmojis - a.totalEmojis)
        ).slice(0, 5);
    })();
    const activeMode = leaderboardModes[modeIndex];

    return (
        <div className="fixed inset-0 z-[200] bg-zinc-900 flex flex-col items-center justify-center p-12 text-center animate-in zoom-in">
            <div className="text-center mb-12">
                <h1 className="text-9xl font-bebas text-yellow-400 tracking-widest drop-shadow-[0_0_50px_rgba(234,179,8,0.5)]">LEADERBOARD</h1>
                <div className="text-3xl text-zinc-300 uppercase tracking-[0.4em] mt-3">{activeMode.label}</div>
            </div>
            <div className="space-y-6 w-full max-w-5xl">
                {leaderboard.map((u, i) => (
                    <div key={u.uid || u.name || i} className="flex items-center justify-between bg-zinc-800 p-8 rounded-3xl border-4 border-zinc-700 shadow-2xl relative overflow-hidden">
                        <div className="flex items-center gap-8 relative z-10">
                            <div className={`text-7xl font-mono w-32 text-left ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-amber-700':'text-zinc-600'}`}>#{i+1}</div>
                            <div className="text-8xl">{u.avatar}</div>
                            <div className="text-6xl font-bold text-white truncate max-w-lg flex items-center gap-4">
                                <span className="truncate">{u.name}</span>
                                {u.isVip && (
                                    <span className="px-3 py-1 rounded-full text-sm font-black tracking-widest bg-yellow-400 text-black shadow-[0_0_18px_rgba(253,224,71,0.6)]">VIP</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right relative z-10">
                            <div className="text-7xl font-black text-yellow-400">{activeMode.getValue(u)} <span className="text-3xl text-yellow-600">{activeMode.unit}</span></div>
                            <div className="text-xl text-zinc-300 mt-2">{u.performances} perf | {u.totalEmojis} emojis | {u.loudest} dB</div>
                        </div>
                        {i === 0 && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent animate-shimmer"></div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const TipOverlay = ({ room }) => {
    return (
        <div className="fixed inset-0 z-[200] bg-gradient-to-br from-green-900 to-emerald-950 flex flex-col items-center justify-center p-12 text-center animate-in zoom-in">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/money.png')] opacity-10"></div>
            <h1 className="text-[10rem] font-bebas text-white mb-8 drop-shadow-lg leading-none">SHOW SOME LOVE!</h1>
            <div className="bg-white p-8 rounded-3xl shadow-[0_0_100px_rgba(255,255,255,0.2)] mb-8 transform hover:scale-105 transition-transform duration-500">
                <img src={room.tipQrUrl || ASSETS.venmoQr} className="w-[500px] h-[500px] object-cover rounded-lg" alt="Tip QR" />
            </div>
            <div className="text-5xl text-green-200 font-bold bg-black/40 px-12 py-6 rounded-full border border-green-500/30 backdrop-blur-md">SCAN TO TIP THE HOST {EMOJI.tip}</div>
        </div>
    );
};

const HowToPlayOverlay = ({ roomCode, logoUrl, queueRules = [] }) => {
    const slides = HOW_TO_PLAY.sections || [];
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!slides.length) return undefined;
        const timer = setInterval(() => {
            setIndex(prev => (prev + 1) % slides.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [slides.length]);

    const active = slides[index] || { title: '', items: [] };
    const appBase = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
    const qrValue = `${appBase}?room=${roomCode}`;

    return (
        <div className="fixed inset-0 z-[200] bg-zinc-900/95 flex flex-col items-center justify-center text-white font-saira">
            <div className="w-[92%] max-w-6xl bg-black/55 border border-cyan-500/30 rounded-[2.5rem] p-10 shadow-[0_0_90px_rgba(34,211,238,0.25)]">
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
                    <div>
                        <div className="text-sm uppercase tracking-[0.5em] text-zinc-500">BROSS Entertainment</div>
                        <div className="text-7xl font-bebas text-cyan-300 tracking-widest mt-2">{HOW_TO_PLAY.title}</div>
                        <div className="text-2xl text-zinc-400 mb-8">{HOW_TO_PLAY.subtitle}</div>

                        <div className="bg-black/50 border border-white/10 rounded-3xl p-10">
                            <div className="text-5xl font-bold text-pink-300 uppercase tracking-widest mb-6">{active.title}</div>
                            <ul className="text-4xl text-zinc-100 space-y-5 leading-snug">
                                {active.items.map(item => (
                                    <li key={item} className="flex gap-4">
                                        <span className="text-cyan-300">&gt;</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-4">
                        <img src={logoUrl || ASSETS.logo} className="h-24 object-contain" alt="BROSS" />
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-3 text-sm uppercase tracking-widest text-zinc-400">
                                {queueRules.map(rule => (
                                    <div key={rule.label} className="flex items-center gap-2 bg-black/50 border border-white/10 px-3 py-2 rounded-full">
                                        <i className={`fa-solid ${rule.icon} text-cyan-300`}></i>
                                        {rule.label}
                                    </div>
                                ))}
                            </div>
                            <div className="bg-white p-3 rounded-2xl shadow-xl">
                                <LocalQrImage value={qrValue} size={224} alt="Join QR" className="w-56 h-56 object-cover" />
                            </div>
                        </div>
                        <div className="text-sm text-zinc-400 uppercase tracking-[0.4em]">Room {roomCode}</div>
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-between text-sm text-zinc-500">
                    <div>Slide {index + 1} of {slides.length}</div>
                    <div className="flex gap-2">
                        {slides.map((_, i) => (
                            <span key={i} className={`h-2 w-8 rounded-full ${i === index ? 'bg-cyan-400' : 'bg-zinc-700'}`}></span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MiniVideoPane = ({ room, current }) => {
    const mediaUrl = resolveStageMediaUrl(current, room);
    const isBackingAudioOnly = current?.backingAudioOnly || false;
    const stageBacking = normalizeBackingChoice({ mediaUrl });
    const isNativeVideo = /\.(mp4|webm|ogg)$/i.test(stageBacking.mediaUrl || '');
    const youtubeId = stageBacking.youtubeId;
    const isYoutube = stageBacking.isYouTube;

    const iframeRef = useRef(null);
    const nativeVideoRef = useRef(null);
    const iframeSrc = useMemo(() => {
        const start = room?.videoStartTimestamp ? (Date.now() - room.videoStartTimestamp) / 1000 : 0;
        return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&controls=0&start=${Math.floor(Math.max(0, start))}&enablejsapi=1`;
    }, [youtubeId, room?.videoStartTimestamp]);

    useEffect(() => {
        if (iframeRef.current && room?.videoVolume !== undefined) {
            iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [room.videoVolume] }), '*');
        }
    }, [room?.videoVolume]);

    useEffect(() => {
        if (nativeVideoRef.current && room?.videoVolume !== undefined) {
            nativeVideoRef.current.volume = room.videoVolume / 100;
        }
    }, [room?.videoVolume]);

    if (!mediaUrl || isBackingAudioOnly) return null;

    return (
        <div className="w-full aspect-video bg-black/70 rounded-2xl overflow-hidden border border-white/10 shadow-lg relative">
            {isNativeVideo ? (
                <video
                    ref={nativeVideoRef}
                    src={stageBacking.mediaUrl}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    preload="auto"
                />
            ) : (isYoutube && youtubeId ? (
                room?.videoPlaying ? (
                    <iframe ref={iframeRef} className="absolute inset-0 w-full h-full pointer-events-none" src={iframeSrc} allow="autoplay" title="YT" frameBorder="0"></iframe>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-zinc-400">VIDEO PAUSED</div>
                )
            ) : null)}
        </div>
    );
};

// --- MAIN TV COMPONENT ---

const PublicTV = ({ roomCode }) => {
    const [room, setRoom] = useState(null);
    const [songs, setSongs] = useState([]);
    const [reactions, setReactions] = useState([]);
    const [messages, setMessages] = useState([]); 
    const [activities, setActivities] = useState([]);
    const [photoOverlay, setPhotoOverlay] = useState(null);
    const [recap, setRecap] = useState(null);
    const [started, setStarted] = useState(false);
    const [audioCtx, setAudioCtx] = useState(null);
    const balladLights = useMemo(() => ([
        { left: '4%', bottom: '6%', size: '260px', sway: '8s', delay: '0s', opacity: '0.7' },
        { left: '16%', bottom: '10%', size: '300px', sway: '9s', delay: '0.7s', opacity: '0.8' },
        { left: '30%', bottom: '8%', size: '270px', sway: '7s', delay: '0.3s', opacity: '0.75' },
        { left: '46%', bottom: '12%', size: '320px', sway: '8.5s', delay: '1.1s', opacity: '0.82' },
        { left: '62%', bottom: '7%', size: '280px', sway: '7.5s', delay: '0.8s', opacity: '0.76' },
        { left: '76%', bottom: '11%', size: '260px', sway: '8s', delay: '0.6s', opacity: '0.74' },
        { left: '90%', bottom: '6%', size: '240px', sway: '7.8s', delay: '1s', opacity: '0.7' }
    ]), []);
    
    // Vibe State
    const [combo, setCombo] = useState(0);
    const [showHypeMeter, setShowHypeMeter] = useState(true);
    const [multiplier, setMultiplier] = useState(1);
    const [applauseStep, setApplauseStep] = useState('idle');
    const [countdown, setCountdown] = useState(3);
    const [measure, setMeasure] = useState(5);
    const [applauseMax, setApplauseMax] = useState(0);
    const [tipPulse, setTipPulse] = useState(false);
    const [micVolume, setMicVolume] = useState(0);
    const [vibeUsers, setVibeUsers] = useState([]);
    const [guitarWinner, setGuitarWinner] = useState(null);
    const [selfieSubmissions, setSelfieSubmissions] = useState([]);
    const [selfieVotes, setSelfieVotes] = useState([]);
    const [doodleNow, setDoodleNow] = useState(Date.now());
    const [doodleSubmissions, setDoodleSubmissions] = useState([]);
    const [doodleVotes, setDoodleVotes] = useState([]);
    const [roomUsers, setRoomUsers] = useState([]);
    const [stormPhase, setStormPhase] = useState('off');
    const [showMarquee, setShowMarquee] = useState(false);
    const [marqueeIndex, setMarqueeIndex] = useState(-1);
    const [readyTimer, setReadyTimer] = useState(0);
    const [chatMessages, setChatMessages] = useState([]);
    const [showChatFeed, setShowChatFeed] = useState(false);
    const [bingoRngNow, setBingoRngNow] = useState(Date.now());
    const [bonusDropBurst, setBonusDropBurst] = useState(null);
    
    const stormAudioRef = useRef(null);
    const stormAnalyserRef = useRef(null);
    const stormSourceRef = useRef(null);
    const stormRafRef = useRef(null);
    const stormFlashCooldownRef = useRef(0);
    const stormThunderRefs = useRef([]);
    const lastPromptAt = useRef(0);
    const lastRealMessageAt = useRef(0);
    const promptIndexRef = useRef(0);
    const promptTimeoutsRef = useRef([]);
    const comboRef = useRef(0);
    const lastHypeAtRef = useRef(0);
    const applauseResetRef = useRef(null);
    const tipPulseTimer = useRef(null);
    const lastTipKey = useRef('');
    const recapPreviewRef = useRef(null);
    const lastBonusDropRef = useRef(null);
    const lastGuitarModeRef = useRef(null);
    const activeGuitarSessionRef = useRef(null);
    const lastStrobeSessionRef = useRef(null);
    const doodleWinnerAwardRef = useRef(null);
    const chatRotateRef = useRef(null);
    const messageTimeoutsRef = useRef([]);
    const selfieVoteCounts = useMemo(() => {
        return selfieVotes.reduce((acc, v) => {
            acc[v.targetUid] = (acc[v.targetUid] || 0) + 1;
            return acc;
        }, {});
    }, [selfieVotes]);
    const bingoRngResults = useMemo(() => {
        const results = room?.bingoMysteryRng?.results || {};
        const list = Object.values(results).map(r => {
            const match = roomUsers.find(u => u.uid === r.uid);
            return {
                uid: r.uid,
                name: r.name || match?.name || 'Guest',
                avatar: r.avatar || match?.avatar || EMOJI.star,
                value: r.value || 0
            };
        });
        return list.sort((a, b) => (b.value || 0) - (a.value || 0));
    }, [room?.bingoMysteryRng?.results, roomUsers]);

    // Helpers
    const getEmojiChar = (t) => (EMOJI[t] || (t.includes('spotlight') ? EMOJI.sparkle : EMOJI.heart));
    const getReactionClass = (t) => ({
        rocket: 'animate-rocket-fly text-[8rem]', 
        diamond: 'animate-diamond-shine text-[9rem]', 
        crown: 'animate-crown-bounce text-[10rem]', 
        money: 'animate-money-wobble text-[9rem]', 
        drink: 'animate-drink-sway text-8xl',
        fire: 'animate-fire-flicker text-8xl drop-shadow-[0_0_15px_orange]',
        heart: 'animate-heart-beat text-8xl drop-shadow-[0_0_15px_red]',
        clap: 'animate-clap-shake text-8xl'
    }[t] || 'animate-float text-6xl');

    const startAudio = async () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            await ctx.resume();
            setAudioCtx(ctx);
            setStarted(true);
        } catch(e) { console.error("Audio Context Failed", e); }
    };

    const getStormPhase = () => {
        if (room?.lightMode !== 'storm') return 'off';
        if (!room?.stormStartedAt) return room?.stormPhase || 'approach';
        const cfg = room?.stormConfig || { approachMs: 15000, peakMs: 20000, passMs: 12000, clearMs: 6000 };
        const elapsed = Date.now() - room.stormStartedAt;
        if (elapsed < cfg.approachMs) return 'approach';
        if (elapsed < cfg.approachMs + cfg.peakMs) return 'peak';
        if (elapsed < cfg.approachMs + cfg.peakMs + cfg.passMs) return 'pass';
        if (elapsed < cfg.approachMs + cfg.peakMs + cfg.passMs + cfg.clearMs) return 'clear';
        return 'clear';
    };

    useEffect(() => {
        if (room?.lightMode !== 'storm') {
            setStormPhase('off');
            return;
        }
        const updatePhase = () => setStormPhase(getStormPhase());
        updatePhase();
        const timer = setInterval(updatePhase, 500);
        return () => clearInterval(timer);
    }, [room?.lightMode, room?.stormStartedAt, room?.stormConfig, room?.stormPhase]);

    useEffect(() => {
        if (room?.activeMode !== 'doodle_oke') return;
        const tick = () => setDoodleNow(Date.now());
        tick();
        const timer = setInterval(tick, 200);
        return () => clearInterval(timer);
    }, [room?.activeMode, room?.doodleOke?.endsAt, room?.doodleOke?.guessEndsAt]);

    useEffect(() => {
        if (room?.activeMode !== 'doodle_oke' || !room?.doodleOke?.promptId) {
            setDoodleSubmissions([]);
            setDoodleVotes([]);
            return;
        }
        const subsQ = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'doodle_submissions'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', room.doodleOke.promptId),
            orderBy('timestamp', 'desc'),
            limit(20)
        );
        const votesQ = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'doodle_votes'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', room.doodleOke.promptId),
            orderBy('timestamp', 'desc'),
            limit(120)
        );
        const unsubSubs = onSnapshot(subsQ, snap => {
            setDoodleSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubVotes = onSnapshot(votesQ, snap => {
            setDoodleVotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => {
            unsubSubs();
            unsubVotes();
        };
    }, [room?.activeMode, room?.doodleOke?.promptId, roomCode]);

    useEffect(() => {
        if (room?.activeMode !== 'doodle_oke' || !room?.doodleOke?.promptId) return;
        const promptId = room.doodleOke.promptId;
        if (doodleWinnerAwardRef.current === promptId) return;
        if (room?.doodleOke?.winnerAwardedAt) {
            doodleWinnerAwardRef.current = promptId;
            return;
        }
        const phase = room?.doodleOke?.status;
        if (phase !== 'reveal') return;
        if (!doodleSubmissions.length) return;
        const voteCounts = doodleVotes.reduce((acc, v) => {
            acc[v.targetUid] = (acc[v.targetUid] || 0) + 1;
            return acc;
        }, {});
        const sorted = [...doodleSubmissions].sort((a, b) => (voteCounts[b.uid] || 0) - (voteCounts[a.uid] || 0));
        const winner = sorted[0];
        if (!winner?.uid) return;
        const points = 150;
        const winnerPayload = {
            uid: winner.uid,
            name: winner.name || 'Guest',
            avatar: winner.avatar || '',
            votes: voteCounts[winner.uid] || 0,
            points
        };
        const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
        updateDoc(roomRef, { doodleOke: { ...room.doodleOke, winner: winnerPayload, winnerAwardedAt: Date.now() } })
            .catch((e) => console.error('Doodle winner update failed', e));
        doodleWinnerAwardRef.current = promptId;
    }, [room?.activeMode, room?.doodleOke, doodleSubmissions, doodleVotes, roomCode]);

    const getStormAmbientUrl = () => {
        if (stormPhase === 'approach') return STORM_SFX.lightRain;
        if (stormPhase === 'peak') return STORM_SFX.stormLoop;
        if (stormPhase === 'pass') return STORM_SFX.bigDrops;
        if (stormPhase === 'clear') return STORM_SFX.lightRain;
        return STORM_SFX.lightRain;
    };

    const [stormFlash, setStormFlash] = useState(false);
    const triggerStormLightning = () => {
        const now = Date.now();
        const minGap = {
            approach: 9000,
            peak: 3500,
            pass: 10000,
            clear: 14000
        }[stormPhase] || 6000;
        if (now - stormFlashCooldownRef.current < minGap) return;
        stormFlashCooldownRef.current = now;
        setStormFlash(true);
        setTimeout(() => setStormFlash(false), 260);
        const choices = stormThunderRefs.current;
        if (choices.length) {
            const idx = Math.floor(Math.random() * choices.length);
            const fx = choices[idx];
            fx.currentTime = 0;
            fx.volume = stormPhase === 'peak' ? 0.8 : 0.55;
            fx.play().catch(() => {});
        }
    };

    const startStormAnalyser = () => {
        if (!audioCtx || !stormAudioRef.current) return;
        if (stormAnalyserRef.current) return;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        const src = audioCtx.createMediaElementSource(stormAudioRef.current);
        src.connect(analyser);
        analyser.connect(audioCtx.destination);
        stormAnalyserRef.current = analyser;
        stormSourceRef.current = src;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
            analyser.getByteFrequencyData(data);
            const low = averageBand(data, 20, 140, analyser.context.sampleRate);
            const mid = averageBand(data, 500, 2000, analyser.context.sampleRate);
            const threshold = stormPhase === 'peak' ? 160 : 175;
            if (low > threshold && low > (mid * 1.4)) triggerStormLightning();
            stormRafRef.current = requestAnimationFrame(loop);
        };
        stormRafRef.current = requestAnimationFrame(loop);
    };

    const stopStormAnalyser = () => {
        if (stormRafRef.current) cancelAnimationFrame(stormRafRef.current);
        stormRafRef.current = null;
    };

    // --- EFFECT: Storm Sound ---
    useEffect(() => {
        if (!started) return;
        if (!stormAudioRef.current) {
            stormAudioRef.current = new Audio(getStormAmbientUrl());
            stormAudioRef.current.loop = true;
            stormAudioRef.current.volume = 0.6;
        }
        if (!stormThunderRefs.current.length) {
            stormThunderRefs.current = [
                new Audio(STORM_SFX.thunder),
                new Audio(STORM_SFX.rollingThunder)
            ];
        }
        const storm = stormAudioRef.current;
        if (room?.lightMode === 'storm') {
            const nextUrl = getStormAmbientUrl();
            if (storm.src !== nextUrl) {
                storm.src = nextUrl;
                storm.load();
            }
            const phaseVolume = {
                approach: 0.35,
                peak: 0.75,
                pass: 0.45,
                clear: 0.2
            }[stormPhase] || 0.5;
            storm.volume = phaseVolume;
            storm.play().catch(e => console.warn("Storm Audio Blocked", e));
            startStormAnalyser();
        } else {
            storm.pause();
            storm.currentTime = 0;
            stopStormAnalyser();
        }
    }, [room?.lightMode, stormPhase, started]);

    // --- EFFECT: Data Sync ---
    useEffect(() => {
        if(!roomCode) return;
        trackEvent('tv_view', { room_code: roomCode });
        const unsubRoom = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), s => setRoom(s.data()));
        const unsubSongs = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), where('roomCode', '==', roomCode)), s => setSongs(s.docs.map(d => ({id:d.id, ...d.data()}))));
        
        const unsubActivity = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), where('roomCode', '==', roomCode), limit(8)), s => {
             const sorted = s.docs.map(d => d.data()).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
             setActivities(sorted);
        });

        const unsubReact = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), where('roomCode', '==', roomCode), limit(50)), s => {
            s.docChanges().forEach(c => {
                if(c.type === 'added') {
                    const d = c.doc.data();
                    // Filter old reactions (prevent flood on reload)
                    if(Date.now() - (d.timestamp?.seconds * 1000 || Date.now()) < 5000) {
                        if (d.type === 'photo') {
                            setPhotoOverlay(d); 
                            setTimeout(() => setPhotoOverlay(null), 8000); // Show photo for 8s
                      } else if (d.type === 'strum') {
                              // Guitar strums are reflected in the live guitar leaderboard instead.
                          } else {
                              const count = Math.min(d.count || 1, 6);
                              const totalCount = d.count || 1;
                              const val = REACTION_COSTS[d.type] || 5;
                              const totalVal = val * totalCount;
                              const multiplier = Math.max(1, room?.multiplier || 1);
                              const basePoints = val;
                              const points = basePoints * multiplier;
                              const isVip = !!d.isVip || (d.vipLevel || 0) > 0;
                              for (let i = 0; i < count; i += 1) {
                                  const left = Math.random() * 80 + 10;
                                  setTimeout(() => {
                                      setReactions(prev => [...prev, {id: `${c.doc.id}_${i}`, ...d, left, points, basePoints, multiplier, isVip}]);
                                  }, i * 80);
                              }
                              setCombo(prev => Math.min(100, prev + totalVal));
                              lastHypeAtRef.current = Date.now();
                              setShowHypeMeter(true);
                          }
                    }
                }
            });
        });

        // Live listener to room_users so we can show vibe racers during guitar mode
        const unsubVibe = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_users'), where('roomCode', '==', roomCode)), s => {
            const raw = s.docs.map(d => d.data());
            setRoomUsers(raw);
            const list = raw.map(u => ({
                uid: u.uid,
                name: u.name,
                avatar: u.avatar,
                guitarHits: u.guitarHits || 0,
                guitarSessionId: u.guitarSessionId || null,
                strobeTaps: u.strobeTaps || 0,
                strobeSessionId: u.strobeSessionId || null
            }));
            const sorted = list.sort((a,b) => (b.guitarHits || 0) - (a.guitarHits || 0));
            setVibeUsers(sorted.slice(0, 8));
        });

        const unsubMsg = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'messages'), where('roomCode', '==', roomCode), limit(10)), s => {
            s.docChanges().forEach(c => {
                if(c.type === 'added') {
                    const d = c.doc.data();
                    if(Date.now() - (d.timestamp?.seconds * 1000 || Date.now()) < 10000) {
                        lastRealMessageAt.current = Date.now();
                        setMessages(prev => [...prev, d]);
                        const timeoutId = setTimeout(() => setMessages(p => p.filter(m => m !== d)), 15000);
                        messageTimeoutsRef.current.push(timeoutId);
                    }
                }
            });
        });

        const unsubChat = onSnapshot(query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'),
            where('roomCode', '==', roomCode),
            orderBy('timestamp', 'desc'),
            limit(20)
        ), s => {
            const visibleMessages = s.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(isTvVisibleChatMessage);
            setChatMessages(visibleMessages);
        });

        return () => {
            unsubRoom();
            unsubSongs();
            unsubReact();
            unsubMsg();
            unsubActivity();
            unsubVibe();
            unsubChat();
            messageTimeoutsRef.current.forEach(t => clearTimeout(t));
            messageTimeoutsRef.current = [];
        };
    }, [roomCode]);

    useEffect(() => {
        const tvMode = room?.chatTvMode || 'auto';
        if (chatRotateRef.current) {
            clearInterval(chatRotateRef.current);
            chatRotateRef.current = null;
        }
        if (!room?.chatShowOnTv) {
            setShowChatFeed(false);
            return;
        }
        if (tvMode === 'chat') {
            setShowChatFeed(true);
            return;
        }
        if (tvMode === 'activity') {
            setShowChatFeed(false);
            return;
        }
        if (chatMessages.length === 0) {
            setShowChatFeed(false);
            return;
        }
        setShowChatFeed(false);
        chatRotateRef.current = setInterval(() => {
            setShowChatFeed(prev => !prev);
        }, 12000);
        return () => {
            if (chatRotateRef.current) clearInterval(chatRotateRef.current);
        };
    }, [room?.chatShowOnTv, room?.chatTvMode, chatMessages.length]);

    useEffect(() => {
        if (room?.activeMode !== 'selfie_challenge' || !room?.selfieChallenge?.promptId) {
            setSelfieSubmissions([]);
            setSelfieVotes([]);
            return;
        }
        const promptId = room.selfieChallenge.promptId;
        const submissionsQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_submissions'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', promptId)
        );
        const votesQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_votes'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', promptId)
        );
        const unsubSubs = onSnapshot(submissionsQuery, s => {
            setSelfieSubmissions(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubVotes = onSnapshot(votesQuery, s => {
            setSelfieVotes(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { unsubSubs(); unsubVotes(); };
    }, [room?.activeMode, room?.selfieChallenge?.promptId, roomCode]);

    useEffect(() => {
        if (!room) return;
        const prevMode = lastGuitarModeRef.current;
        if (room.lightMode === 'guitar' && room.guitarSessionId) {
            activeGuitarSessionRef.current = room.guitarSessionId;
        }
        lastGuitarModeRef.current = room.lightMode;

        if (prevMode === 'guitar' && room.lightMode !== 'guitar') {
            const sessionId = room.guitarSessionId || activeGuitarSessionRef.current;
            if (!sessionId) return;
            if (room?.guitarWinner?.sessionId === sessionId) return;

            const candidates = vibeUsers.filter(u => u.guitarSessionId === sessionId);
            const winner = candidates.sort((a,b) => (b.guitarHits || 0) - (a.guitarHits || 0))[0];
            if (!winner || !winner.guitarHits) return;

            const payload = {
                uid: winner.uid,
                name: winner.name,
                avatar: winner.avatar,
                hits: winner.guitarHits,
                sessionId,
                timestamp: Date.now(),
                rewardPoints: 200
            };

            setGuitarWinner(payload);
            setTimeout(() => setGuitarWinner(null), 12000);
            updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { 
                guitarWinner: payload,
                guitarVictory: { 
                    id: `${sessionId}_${winner.uid}`,
                    uid: winner.uid,
                    name: winner.name,
                    avatar: winner.avatar,
                    hits: winner.guitarHits,
                    sessionId,
                    status: 'pending',
                    rewardPoints: 200,
                    requestedAt: Date.now()
                }
            }).catch(() => {});
            addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), {
                roomCode,
                user: winner.name,
                text: `shredded the hardest (${winner.guitarHits} hits)`,
                icon: EMOJI.guitar,
                timestamp: serverTimestamp()
            }).catch(() => {});
        }
    }, [room, roomCode, vibeUsers, room?.guitarWinner?.sessionId]);

    useEffect(() => {
        if (room?.guitarVictory?.status === 'pending') return;
        if (room?.guitarWinner?.sessionId === room?.guitarSessionId) return;
        if (room?.lightMode === 'guitar') return;
        const sessionId = room?.guitarSessionId;
        if (!sessionId) return;
        const candidates = vibeUsers.filter(u => u.guitarSessionId === sessionId);
        const winner = candidates.sort((a,b) => (b.guitarHits || 0) - (a.guitarHits || 0))[0];
        if (!winner || !winner.guitarHits) return;
        const payload = {
            uid: winner.uid,
            name: winner.name,
            avatar: winner.avatar,
            hits: winner.guitarHits,
            sessionId,
            timestamp: Date.now(),
            rewardPoints: 200
        };
        updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
            guitarWinner: payload,
            guitarVictory: {
                id: `${sessionId}_${winner.uid}`,
                uid: winner.uid,
                name: winner.name,
                avatar: winner.avatar,
                hits: winner.guitarHits,
                sessionId,
                status: 'pending',
                rewardPoints: 200,
                requestedAt: Date.now()
            }
        }).catch(() => {});
    }, [room?.lightMode, room?.guitarSessionId, room?.guitarVictory?.status, roomCode, vibeUsers]);

    useEffect(() => {
        if (room?.lightMode === 'strobe') return;
        const sessionId = room?.strobeSessionId;
        if (!sessionId || !room?.strobeEndsAt) return;
        if (Date.now() < room.strobeEndsAt) return;
        if (room?.strobeResults?.sessionId === sessionId) return;
        if (lastStrobeSessionRef.current === sessionId) return;
        lastStrobeSessionRef.current = sessionId;

        const candidates = roomUsers
            .filter(u => u.strobeSessionId === sessionId)
            .map(u => ({
                uid: u.uid,
                name: u.name,
                avatar: u.avatar,
                taps: u.strobeTaps || 0
            }))
            .filter(u => u.taps > 0)
            .sort((a, b) => (b.taps || 0) - (a.taps || 0));

        if (!candidates.length) return;
        const winners = candidates.slice(0, 3);
        const winner = winners[0];
        const rewards = [150, 90, 50];

        updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
            strobeWinner: { ...winner, sessionId },
            strobeResults: { sessionId, winners, rewards, awardedAt: Date.now() },
            strobeVictory: { ...winner, sessionId, status: 'pending', id: `${sessionId}` }
        }).catch(() => {});
    }, [room?.lightMode, room?.strobeSessionId, room?.strobeEndsAt, room?.strobeResults?.sessionId, roomCode, roomUsers]);

    useEffect(() => {
        const prompts = [
            "Cheer the singer with a reaction",
            "Send a drunk text to the big screen",
            "Tap a reaction to boost the hype meter",
            "Shout the chorus and hype the crowd",
            "Scan the code and request a song",
            "Drop a clap for the next performer"
        ];
        const interval = setInterval(() => {
            const now = Date.now();
            const isOverlayActive = !!room?.activeScreen || recap || (room?.activeMode && room.activeMode !== 'karaoke');
            if (isOverlayActive) return;
            if (now - lastPromptAt.current < 20000) return;
            if (now - lastRealMessageAt.current < 15000) return;

            const prompt = prompts[promptIndexRef.current % prompts.length];
            promptIndexRef.current += 1;
            lastPromptAt.current = now;

            const msg = { text: prompt, user: 'HOST', timestamp: { seconds: Math.floor(now / 1000) }, __prompt: true };
            setMessages(prev => [...prev, msg]);
            const timeoutId = setTimeout(() => setMessages(p => p.filter(m => m !== msg)), 12000);
            promptTimeoutsRef.current.push(timeoutId);
        }, 25000);
        return () => {
            clearInterval(interval);
            promptTimeoutsRef.current.forEach(t => clearTimeout(t));
            promptTimeoutsRef.current = [];
        };
    }, [room?.activeScreen, room?.activeMode, recap]);

    useEffect(() => {
        if (!room?.readyCheck?.active) {
            setReadyTimer(0);
            return;
        }
        const durationMs = Math.max(3000, Math.floor((room.readyCheck.durationSec || 10) * 1000));
        const start = room.readyCheck.startTime || Date.now();
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((durationMs - (Date.now() - start)) / 1000));
            setReadyTimer(remaining);
        };
        tick();
        const interval = setInterval(tick, 200);
        return () => clearInterval(interval);
    }, [room?.readyCheck?.active, room?.readyCheck?.startTime, room?.readyCheck?.durationSec]);

    useEffect(() => {
        if (!room?.bingoMysteryRng?.active && !room?.bingoMysteryRng?.finalized) return;
        const timer = setInterval(() => setBingoRngNow(Date.now()), 250);
        return () => clearInterval(timer);
    }, [room?.bingoMysteryRng?.active, room?.bingoMysteryRng?.finalized]);

    // Allow host-triggered photo overlays from the room document
    useEffect(() => {
        if (!room?.photoOverlay?.url) return;
        setPhotoOverlay(room.photoOverlay);
        const t = setTimeout(() => setPhotoOverlay(null), 8000);
        return () => clearTimeout(t);
    }, [room?.photoOverlay?.url, room?.photoOverlay?.timestamp]);
    useEffect(() => {
        const drop = room?.bonusDrop;
        if (!drop?.id) return;
        if (lastBonusDropRef.current === drop.id) return;
        lastBonusDropRef.current = drop.id;
        setBonusDropBurst({ ...drop });
        const t = setTimeout(() => setBonusDropBurst(null), 6000);
        return () => clearTimeout(t);
    }, [room?.bonusDrop?.id]);

    // --- EFFECT: Loop & Logic ---
    useEffect(() => { comboRef.current = combo; }, [combo]);
    useEffect(() => {
        const i = setInterval(() => {
            setReactions(prev => prev.filter(r => Date.now() - (r.timestamp?.seconds * 1000 || Date.now()) < 4000));
            setCombo(prev => {
                const next = Math.max(0, prev - 0.2);
                comboRef.current = next;
                setMultiplier(() => {
                   if (next > 90) return 4;
                   if (next > 50) return 2;
                   return 1;
                });
                return next;
            });
            if (comboRef.current <= 0) {
                const idleMs = Date.now() - (lastHypeAtRef.current || 0);
                if (idleMs > 10000) setShowHypeMeter(false);
            } else if (!showHypeMeter) {
                setShowHypeMeter(true);
            }
        }, 100);
        return () => clearInterval(i);
    }, [showHypeMeter]);
    
    const getTimestampMs = (value) => {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (typeof value?.toMillis === 'function') return value.toMillis();
        if (typeof value?.seconds === 'number') return value.seconds * 1000;
        return 0;
    };
    const formatExperienceLabel = (value) => {
        if (!value) return '';
        const labelMap = {
            leaderboard: 'Leaderboard',
            tipping: 'Tip CTA',
            selfie_cam: 'Selfie Cam',
            selfie_challenge: 'Selfie Challenge',
            doodle_oke: 'Doodle Oke',
            applause: 'Applause Meter',
            applause_countdown: 'Applause Countdown',
            applause_result: 'Applause Results',
            trivia_pop: 'Trivia',
            trivia_reveal: 'Trivia',
            wyr: 'Would You Rather',
            wyr_reveal: 'Would You Rather',
            bingo: 'Bingo',
            flappy_bird: 'Flappy Bird',
            vocal_challenge: 'Vocal Challenge',
            riding_scales: 'Scale Ladder'
        };
        if (labelMap[value]) return labelMap[value];
        return value
            .split('_')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    };

    // Auto Recap
    useEffect(() => {
        if (room?.activeMode && room.activeMode !== 'karaoke') return;
        if (room?.activeScreen && room.activeScreen !== 'stage') return;
        if(room?.lastPerformance) {
            const lastTs = getTimestampMs(room.lastPerformance.timestamp);
            if (!lastTs) return undefined;
            const timeSinceEnd = Date.now() - lastTs;
            if (timeSinceEnd < 10000) {
                if (!recap || room.lastPerformance.timestamp !== recap.timestamp) {
                    setRecap(room.lastPerformance);
                }
                const remaining = 10000 - timeSinceEnd;
                const t = setTimeout(() => setRecap(null), remaining);
                return () => clearTimeout(t);
            } else {
                if(recap) setRecap(null);
            }
        }
    }, [room?.lastPerformance]);

    useEffect(() => {
        if (!room?.recapPreview?.timestamp) return;
        const previewTs = getTimestampMs(room.recapPreview.timestamp);
        if (!previewTs) return;
        if (recapPreviewRef.current === previewTs) return;
        recapPreviewRef.current = previewTs;
        setRecap(room.recapPreview);
        const t = setTimeout(() => setRecap(null), 10000);
        return () => clearTimeout(t);
    }, [room?.recapPreview?.timestamp]);

    const triggerTipPulse = (key) => {
        if (!room?.tipUrl && !room?.tipQrUrl) return;
        if (lastTipKey.current === key) return;
        lastTipKey.current = key;
        setTipPulse(true);
        if (tipPulseTimer.current) clearTimeout(tipPulseTimer.current);
        tipPulseTimer.current = setTimeout(() => setTipPulse(false), 9000);
    };
    const experienceLabel = (() => {
        if (room?.activeScreen && room.activeScreen !== 'stage') {
            return formatExperienceLabel(room.activeScreen);
        }
        if (room?.activeMode && room.activeMode !== 'karaoke') {
            return formatExperienceLabel(room.activeMode);
        }
        return '';
    })();
    const isExperienceActive = !!experienceLabel;
    const closeExperience = async () => {
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
                activeScreen: 'stage',
                activeMode: 'karaoke'
            });
        } catch (err) {
            console.error('[TV] closeExperience failed', err);
        }
    };

    // Applause Sequence
    useEffect(() => {
        if (room?.activeMode === 'applause_countdown' && applauseStep === 'idle') { 
            setApplauseStep('countdown'); setCountdown(3); setApplauseMax(0); 
        } 
    }, [room?.activeMode]);
    useEffect(() => () => {
        if (applauseResetRef.current) clearTimeout(applauseResetRef.current);
    }, []);

    useEffect(() => { 
        let timer; 
        if (applauseStep === 'countdown') { 
            if (countdown > 0) timer = setTimeout(() => setCountdown(c => c - 1), 1000); 
            else { setApplauseStep('measuring'); setMeasure(5); updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { activeMode: 'applause' }); } 
        } else if (applauseStep === 'measuring') { 
            if (measure > 0) timer = setTimeout(() => setMeasure(m => m - 1), 1000); 
            else { 
                setApplauseStep('result'); 
                triggerTipPulse(`applause-${Date.now()}`);
                updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { applausePeak: applauseMax, activeMode: 'applause_result' }); 
                if (applauseResetRef.current) clearTimeout(applauseResetRef.current);
                applauseResetRef.current = setTimeout(() => { 
                    setApplauseStep('idle'); 
                    updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { activeMode: 'karaoke' }); 
                }, 5000); 
            } 
        } 
        return () => clearTimeout(timer); 
    }, [applauseStep, countdown, measure, applauseMax, roomCode]);

    const current = songs.find(s => s.status === 'performing');
    const marqueeItems = (room?.marqueeItems || []).filter(i => i.enabled !== false);

    useEffect(() => {
        const enabled = room?.marqueeEnabled !== false;
        const mode = room?.marqueeShowMode || 'always';
        const hasItems = marqueeItems.length > 0;
        const hasMessages = messages.length > 0;
        const modeOk = mode === 'always'
            ? true
            : mode === 'karaoke'
                ? room?.activeMode === 'karaoke'
                : !current;
        if (!enabled || (!hasItems && !hasMessages) || !modeOk) {
            setShowMarquee(false);
            return;
        }
        const durationMs = Math.max(2000, room?.marqueeDurationMs || 12000);
        const intervalMs = Math.max(2000, room?.marqueeIntervalMs || 20000);
        let hideTimer;
        const runCycle = () => {
            if (hasItems) {
                setMarqueeIndex(prev => (prev + 1) % marqueeItems.length);
            }
            setShowMarquee(true);
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => setShowMarquee(false), durationMs);
        };
        runCycle();
        const cycleTimer = setInterval(runCycle, durationMs + intervalMs);
        return () => {
            clearInterval(cycleTimer);
            if (hideTimer) clearTimeout(hideTimer);
        };
    }, [room?.marqueeEnabled, room?.marqueeDurationMs, room?.marqueeIntervalMs, room?.marqueeShowMode, room?.activeMode, messages.length, marqueeItems.length, current?.id]);

    const handleVolume = (vol) => {
        const level = Math.min(100, Math.round(vol / 1.5));
        setMicVolume(level);
        if (applauseStep === 'measuring') {
            if (level > applauseMax) setApplauseMax(level);
            if (Math.random() < 0.1) updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { currentApplauseLevel: level });
        }
    };

    const allQueue = songs.filter(s => s.status === 'requested').sort((a,b) => (a.priorityScore || 0) - (b.priorityScore || 0));
    const nextUp = allQueue.slice(0,5);
    const queueWaitSec = allQueue.reduce((sum, song) => {
        const duration = Number(song?.duration);
        return sum + (Number.isFinite(duration) && duration > 0 ? duration : 300);
    }, 0);
    const currentMarqueeItem = marqueeItems.length ? marqueeItems[(marqueeIndex + marqueeItems.length) % marqueeItems.length] : null;
    const marqueeText = currentMarqueeItem
        ? (typeof currentMarqueeItem === 'string' ? currentMarqueeItem : currentMarqueeItem.text)
        : null;
    const currentSinger = current
        ? roomUsers.find(u => u.uid === current.singerUid || u.name === current.singerName)
        : null;
    const currentSingerIsVip = !!currentSinger?.isVip || (currentSinger?.vipLevel || 0) > 0;
    const currentPerformancePoints = current
        ? (current.hypeScore || 0) + (current.applauseScore || 0) + (current.hostBonus || 0)
        : 0;
    const showScoring = room?.showScoring !== false;
    const isVipSong = (song) => {
        if (!song) return false;
        const match = roomUsers.find(u =>
            (song.singerUid && u.uid === song.singerUid) ||
            (song.singerName && u.name === song.singerName) ||
            (song.name && u.name === song.name)
        );
        return !!match?.isVip || (match?.vipLevel || 0) > 0;
    };
    const spotlightUser = room?.spotlightUser?.id
        ? roomUsers.find(u => u.uid === room.spotlightUser.id || u.id?.split('_')[1] === room.spotlightUser.id)
        : null;

    const bgClass = multiplier >= 4 ? 'bg-gradient-to-br from-pink-900 via-purple-900 to-indigo-900 animate-pulse' : 
                    multiplier >= 2 ? 'bg-gradient-to-br from-blue-900 to-black' : 
                    'bg-black';
    const waveformOpacity = current ? 'opacity-50' : 'opacity-95';
    const guitarLeaders = room?.guitarSessionId
        ? vibeUsers.filter(u => u.guitarSessionId === room.guitarSessionId)
        : vibeUsers;
    const strobeSessionId = room?.strobeSessionId;
    const strobeUsers = strobeSessionId
        ? roomUsers.filter(u => u.strobeSessionId === strobeSessionId)
        : [];
    const strobeLeaders = [...strobeUsers]
        .sort((a, b) => (b.strobeTaps || 0) - (a.strobeTaps || 0))
        .slice(0, 3);
    const strobeTotalTaps = strobeUsers.reduce((sum, u) => sum + (u.strobeTaps || 0), 0);
    const strobeCountdownUntil = room?.strobeCountdownUntil || 0;
    const strobeEndsAt = room?.strobeEndsAt || 0;
    const strobePhase = room?.lightMode === 'strobe'
        ? (Date.now() < strobeCountdownUntil ? 'countdown' : Date.now() < strobeEndsAt ? 'active' : 'ended')
        : 'off';
    const strobeCountdown = Math.max(0, Math.ceil((strobeCountdownUntil - Date.now()) / 1000));
    const strobeRemaining = Math.max(0, Math.ceil((strobeEndsAt - Date.now()) / 1000));
    const strobeMeter = Math.min(100, Math.round(strobeTotalTaps * 2));
    const appBase = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
    const joinUrl = `${appBase}?room=${roomCode}`;
    const joinUrlDisplay = joinUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const previewGameId = room?.gamePreviewId || '';
    const previewActive = previewGameId && room?.activeMode === 'karaoke';
    const previewTitleMap = {
        bingo: 'Bingo',
        trivia_pop: 'Trivia',
        wyr: 'Would You Rather',
        doodle_oke: 'Doodle-oke',
        selfie_challenge: 'Selfie Challenge',
        vocal_challenge: 'Vocal Challenge',
        riding_scales: 'Riding Scales',
        flappy_bird: 'Flappy Bird'
    };
    const queueSettings = room?.queueSettings || {};
    const queueLimitMode = queueSettings.limitMode || 'none';
    const queueLimitCount = Math.max(0, Number(queueSettings.limitCount || 0));
    const queueRotation = queueSettings.rotation || 'round_robin';
    const queueFirstTimeBoost = queueSettings.firstTimeBoost !== false;
    const queueRules = [
        {
            icon: queueLimitMode === 'none' || queueLimitCount <= 0 ? 'fa-infinity' : 'fa-hourglass-half',
            label: queueLimitMode === 'none' || queueLimitCount <= 0
                ? 'No request limits'
                : queueLimitMode === 'per_hour'
                    ? `Limit: ${queueLimitCount}/hour`
                    : queueLimitMode === 'per_night'
                        ? `Limit: ${queueLimitCount}/night`
                        : `Soft limit: ${queueLimitCount}/night`
        },
        {
            icon: queueRotation === 'round_robin' ? 'fa-rotate-right' : 'fa-list',
            label: queueRotation === 'round_robin' ? 'Round robin' : 'First come'
        },
        {
            icon: queueFirstTimeBoost ? 'fa-star' : 'fa-user',
            label: queueFirstTimeBoost ? 'First-time boost' : 'No boost'
        },
        ...(room?.bouncerMode ? [{
            icon: 'fa-lock',
            label: 'Requests need approval'
        }] : [])
    ];
    // --- RENDER ---
    
    if (!started) {
        return (
            <div className="h-screen w-screen bg-[#0b0e12] text-white font-saira flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1a1f2b,transparent_55%),radial-gradient(circle_at_bottom,#1b0f22,transparent_45%)] opacity-90"></div>
                <div className="absolute -top-32 -left-24 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl"></div>
                <div className="absolute -bottom-40 -right-24 w-80 h-80 rounded-full bg-pink-500/20 blur-3xl"></div>
                <div className="relative z-10 flex flex-col items-center gap-6">
                    <img src={room?.logoUrl || ASSETS.logo} alt="Beaurocks Karaoke" className="h-24 rounded-2xl drop-shadow-[0_0_30px_rgba(0,196,217,0.45)]" />
                    <div className="text-xs uppercase tracking-[0.45em] text-zinc-500">TV Dashboard</div>
                    <div className="text-6xl font-bebas text-transparent bg-clip-text bg-gradient-to-r from-[#00C4D9] to-[#EC4899]">
                        Start the Show
                    </div>
                    <div className="text-lg text-zinc-300">Tap to enable audio + visuals.</div>
                    <button
                        onClick={startAudio}
                        className="bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black font-bebas text-5xl px-16 py-7 rounded-[28px] shadow-[0_0_45px_rgba(0,196,217,0.35)] border border-white/10 hover:scale-[1.02] transition-transform overflow-hidden bg-clip-padding"
                    >
                        START SHOW
                    </button>
                </div>
            </div>
        );
    }

    // 1. Full Screen Overlays (Top Priority)
    if (room?.activeScreen === 'leaderboard') return <LeaderboardOverlay users={roomUsers} songs={songs} />;
    if (room?.activeScreen === 'tipping') return <TipOverlay room={room} />;
            if (room?.howToPlay?.active) return <HowToPlayOverlay roomCode={roomCode} logoUrl={room?.logoUrl} queueRules={queueRules} />;
    if (room?.readyCheck?.active) {
        const readyCount = roomUsers.filter(u => u.isReady).length;
        const totalCount = roomUsers.length || 0;
        return (
            <div className="fixed inset-0 z-[200] bg-zinc-900 flex flex-col items-center justify-center p-12 text-center">
                <div className="text-xs uppercase tracking-[0.4em] text-zinc-500 mb-4">Ready Check</div>
                <div className="text-[16rem] font-black text-white leading-none">{readyTimer || 0}</div>
                <div className="text-4xl font-bebas text-cyan-300 mt-6">ARE YOU READY?</div>
                <div className="text-xl text-zinc-400 mt-4">{readyCount} / {totalCount} ready</div>
            </div>
        );
    }
    
    if (room?.activeMode === 'doodle_oke' && room?.doodleOke) {
        const doodle = room.doodleOke;
        let phase = doodle.status || 'drawing';
        if (phase === 'drawing' && doodle.endsAt && doodleNow >= doodle.endsAt) phase = 'voting';
        if (phase === 'voting' && doodle.guessEndsAt && doodleNow >= doodle.guessEndsAt) phase = 'reveal';
        const drawRemaining = Math.max(0, Math.ceil((doodle.endsAt - doodleNow) / 1000));
        const guessRemaining = Math.max(0, Math.ceil((doodle.guessEndsAt - doodleNow) / 1000));
        const promptVisible = phase === 'reveal';

        const voteCounts = doodleVotes.reduce((acc, v) => {
            acc[v.targetUid] = (acc[v.targetUid] || 0) + 1;
            return acc;
        }, {});
        const submissionsSorted = [...doodleSubmissions].sort((a, b) => (voteCounts[b.uid] || 0) - (voteCounts[a.uid] || 0));
        const winner = submissionsSorted[0];
        const galleryCols = submissionsSorted.length > 4 ? 'grid-cols-3' : 'grid-cols-2';

        return (
            <div className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-10 text-white">
                <div className="w-full max-w-6xl">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="text-xs uppercase tracking-[0.45em] text-zinc-500">Doodle-oke</div>
                            <div className="text-6xl font-bebas text-cyan-300">Sketch the lyric. Guess the hit.</div>
                            <div className="text-sm text-zinc-400 mt-2">Live sketches: <span className="text-white font-bold">{submissionsSorted.length}</span></div>
                        </div>
                        <div className="text-right text-sm uppercase tracking-[0.3em] text-zinc-400">
                            {phase === 'drawing' && `Drawing ${drawRemaining}s`}
                            {phase === 'voting' && `Voting ${guessRemaining}s`}
                            {phase === 'reveal' && 'Reveal'}
                        </div>
                    </div>
                    <div className="grid grid-cols-12 gap-6">
                        <div className="col-span-8 bg-black/60 border border-white/10 rounded-3xl p-4">
                            {submissionsSorted.length ? (
                                <div className={`grid ${galleryCols} gap-4 w-full`}>
                                    {submissionsSorted.slice(0, 6).map(s => (
                                        <div key={s.id} className="bg-black/70 border border-white/10 rounded-2xl p-3 relative overflow-hidden">
                                            <div className="text-xs text-zinc-300 mb-2">{s.avatar ? `${s.avatar} ` : ''}{s.name || 'Guest'}</div>
                                            <div className="aspect-square bg-zinc-950 rounded-xl overflow-hidden relative">
                                                <img src={s.image} alt={s.name} className="w-full h-full object-contain" />
                                                <img src={room?.logoUrl || ASSETS.logo} className="absolute top-3 right-3 w-16 opacity-70" alt="BROSS" />
                                            </div>
                                            <div className="mt-2 text-xs text-cyan-200">{voteCounts[s.uid] || 0} votes</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-zinc-500 text-2xl text-center py-20">Waiting for sketches...</div>
                            )}
                        </div>
                        <div className="col-span-4 flex flex-col gap-4">
                            <div className="bg-zinc-900/70 border border-white/10 rounded-3xl p-5">
                                <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-3">Prompt</div>
                                <div className="text-4xl font-bold text-white leading-tight">
                                    {promptVisible ? doodle.prompt : 'Prompt hidden - vote with your eyes.'}
                                </div>
                                <div className="text-xs text-zinc-400 mt-3">Sing or hum the line while you draw.</div>
                            </div>
                            <div className="bg-zinc-900/70 border border-white/10 rounded-3xl p-5 flex-1 overflow-hidden">
                                <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-3">Votes</div>
                                <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {submissionsSorted.length === 0 && (
                                        <div className="text-zinc-500 text-sm">Waiting for sketches...</div>
                                    )}
                                    {submissionsSorted.map(s => (
                                        <div key={s.id} className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
                                            <div className="text-sm text-white font-bold truncate">{s.avatar ? `${s.avatar} ` : ''}{s.name || 'Guest'}</div>
                                            <div className="text-lg text-cyan-200">{voteCounts[s.uid] || 0}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {phase === 'reveal' && winner && (
                                <div className="bg-black/60 border border-cyan-400/40 rounded-3xl p-5 text-center">
                                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-2">Winner</div>
                                    <div className="text-3xl font-bebas text-cyan-300">{winner.name || 'Guest'}</div>
                                    <div className="text-sm text-zinc-400">{voteCounts[winner.uid] || 0} votes</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 2. Game Cartridges
    if (room?.activeMode && !['karaoke','applause','selfie_cam','selfie_challenge','applause_countdown','applause_result','doodle_oke'].includes(room.activeMode)) {
        // Map correct payload based on mode
        const isTrivia = room.activeMode.includes('trivia');
        const isWyr = room.activeMode.includes('wyr');
        const isBingo = room.activeMode === 'bingo';

        let gamePayload = room.gameData; 
        if (isTrivia) gamePayload = room.triviaQuestion;
        if (isWyr) gamePayload = room.wyrData;
        if (isBingo) gamePayload = {
            tiles: room.bingoData,
            size: room.bingoSize,
            highlightedTile: room.highlightedTile,
            bingoMode: room.bingoMode,
            bingoWin: room.bingoWin,
            bingoVictory: room.bingoVictory,
            suggestions: room.bingoSuggestions,
            revealed: room.bingoRevealed,
            sponsor: { name: room.bingoSponsorName, logo: room.bingoSponsorLogo },
            focus: room.bingoFocus || null,
            pickerUid: room.bingoPickerUid || null,
            pickerName: pickerUser?.name || room.bingoPickerName || null
        };

        const isVoiceGame = ['flappy_bird', 'vocal_challenge', 'riding_scales'].includes(room.activeMode);
        const isAmbientVoiceGame = (room.activeMode === 'flappy_bird' || room.activeMode === 'vocal_challenge') && room.gameData?.inputSource === 'ambient';
        const isScaleCrowd = room.activeMode === 'riding_scales' && room.gameData?.playerId === 'GROUP';
        const tvIsPlayer = isAmbientVoiceGame || isScaleCrowd;
        const inputSource = tvIsPlayer ? 'local' : 'remote';
        const showRemoteVoiceFeed = isVoiceGame && !tvIsPlayer;

        if (isBingo && room?.bingoShowTv === false) {
            return (
                <div className="absolute inset-0 bg-black flex items-center justify-center">
                    <div className="text-center">
                        <img src={room?.logoUrl || ASSETS.logo} className="w-40 mx-auto mb-4 opacity-80" alt="BROSS" />
                        <div className="text-3xl font-bebas text-cyan-300 mb-2">Bingo Live</div>
                        <div className="text-sm uppercase tracking-[0.4em] text-zinc-400">Check your phone to play</div>
                    </div>
                </div>
            );
        }

        if (showRemoteVoiceFeed) {
            const voiceNote = room.gameData?.voice?.note || room.gameData?.detectedNote || '-';
            const score = Number(room.gameData?.score || 0);
            const lives = room.gameData?.lives;
            const strikes = room.gameData?.strikes;
            const round = room.gameData?.round;
            const playerName = room.gameData?.playerName || 'Singer';
            const badge = room.activeMode === 'riding_scales' ? 'Scale Ladder' : room.activeMode === 'vocal_challenge' ? 'Vocal Challenge' : 'Flappy Bird';

            return (
                <div className="absolute inset-0 bg-black flex items-center justify-center p-8">
                    <div className="w-full max-w-4xl bg-zinc-900/90 border border-white/10 rounded-[2.5rem] p-10 text-center shadow-[0_0_80px_rgba(34,211,238,0.2)]">
                        <div className="text-xs uppercase tracking-[0.4em] text-zinc-400 mb-3">{badge}</div>
                        <div className="text-5xl font-bebas text-cyan-300 mb-4">{playerName}</div>
                        <div className="text-sm uppercase tracking-[0.3em] text-zinc-500 mb-6">Phone mic in control</div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Score</div>
                                <div className="text-5xl font-black text-white">{score}</div>
                                <div className="mt-4 h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-cyan-400 to-pink-500"
                                        style={{ width: `${Math.min(100, Math.max(6, (score / 500) * 100))}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Detected note</div>
                                <div className="text-5xl font-black text-white">{voiceNote}</div>
                            </div>
                            {typeof lives === 'number' && (
                                <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Lives</div>
                                    <div className="text-5xl font-black text-white">{lives}</div>
                                </div>
                            )}
                            {typeof strikes === 'number' && (
                                <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
                                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">Strikes</div>
                                    <div className="text-5xl font-black text-white">{strikes}</div>
                                    {typeof round === 'number' && (
                                        <div className="text-sm text-zinc-400 mt-2">Round {round}</div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="text-xs text-zinc-400 mt-8">Live results update on the phones. TV shows the score feed.</div>
                    </div>
                </div>
            );
        }

        return (
            <GameContainer
                activeMode={room.activeMode}
                roomCode={roomCode}
                gameState={gamePayload}
                playerData={room.gameData}
                isPlayer={tvIsPlayer}
                inputSource={inputSource}
                rulesToken={room?.gameRulesId}
                view="tv"
            />
        );
    }

    // 3. Recap Overlay
    if (recap) {
        triggerTipPulse(`recap-${recap.timestamp || recap.songTitle || 'recap'}`);
        const topFan = recap.topFan;
        const vibeStats = recap.vibeStats;
        return (
            <div className="fixed inset-0 z-[200] bg-zinc-900 flex flex-col items-center justify-center p-12 text-center animate-in zoom-in duration-500">
                <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-12 rounded-3xl border-4 border-yellow-400 shadow-[0_0_100px_rgba(250,204,21,0.3)] max-w-5xl w-full relative overflow-hidden">
                    <h2 className="text-4xl font-bebas text-yellow-400 mb-2 tracking-widest relative z-10">PERFORMANCE SUMMARY</h2>
                    {recap.hallOfFame?.newAllTime && (
                        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-yellow-400/20 border border-yellow-300 text-yellow-200 uppercase tracking-widest font-bold text-xl mb-6 relative z-10">
                            <i className="fa-solid fa-trophy"></i> New Global High Score
                        </div>
                    )}
                    <div className="flex items-center justify-center gap-6 mb-8 relative z-10">
                        {recap.albumArtUrl && (
                            <img src={recap.albumArtUrl} alt={recap.songTitle} className="w-36 h-36 rounded-2xl object-cover border-2 border-white/10 shadow-xl" />
                        )}
                        <div>
                            <div className="text-6xl font-black text-white">{recap.songTitle}</div>
                            <div className="text-3xl text-zinc-300 font-bold mt-2">{recap.singerName}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-8 mb-12 relative z-10">
                        <div className="bg-black/30 p-4 rounded-xl border border-pink-500/30">
                            <div className="text-xl text-pink-400 uppercase font-bold">Vibe</div>
                            <div className="text-6xl font-mono text-white">{recap.hypeScore || 0}</div>
                        </div>
                        <div className="bg-black/30 p-4 rounded-xl border border-yellow-500/30">
                            <div className="text-xl text-yellow-400 uppercase font-bold">Applause</div>
                            <div className="text-6xl font-mono text-white">{Math.round(recap.applauseScore || 0)}</div>
                        </div>
                        <div className="bg-black/30 p-4 rounded-xl border border-green-500/30">
                            <div className="text-xl text-green-400 uppercase font-bold">Bonus</div>
                            <div className="text-6xl font-mono text-white">{recap.hostBonus || 0}</div>
                        </div>
                    </div>
                    <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-yellow-300 relative z-10">{(recap.hypeScore||0)+(Math.round(recap.applauseScore||0))+(recap.hostBonus||0)} PTS</div>
                    {(topFan || vibeStats) && (
                        <div className="grid grid-cols-2 gap-6 mt-10 relative z-10">
                            {topFan && (
                                <div className="bg-black/30 border border-cyan-400/30 rounded-2xl p-4">
                                    <div className="text-xs uppercase tracking-[0.4em] text-cyan-200 mb-2">Top Fan</div>
                                    <div className="text-4xl font-black text-white flex items-center justify-center gap-3">
                                        <span>{topFan.avatar || EMOJI.sparkle}</span>
                                        <span className="truncate max-w-[240px]">{topFan.name}</span>
                                    </div>
                                    <div className="text-sm text-cyan-200 mt-2">{topFan.pointsGifted || 0} pts gifted</div>
                                </div>
                            )}
                            {vibeStats && (
                                <div className="bg-black/30 border border-pink-400/30 rounded-2xl p-4">
                                    <div className="text-xs uppercase tracking-[0.4em] text-pink-200 mb-2">Vibe Sync</div>
                                    <div className="text-sm text-zinc-200 space-y-2">
                                        {vibeStats.guitar && (
                                            <div className="flex items-center justify-between">
                                                <span>Guitar hits</span>
                                                <span className="text-white font-bold">{vibeStats.guitar.totalHits}</span>
                                            </div>
                                        )}
                                        {vibeStats.strobe && (
                                            <div className="flex items-center justify-between">
                                                <span>Beat taps</span>
                                                <span className="text-white font-bold">{vibeStats.strobe.totalTaps}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }
    
    // 4. Main Stage Layout
    const isCinema = room?.layoutMode === 'cinema';
    const isMinimal = room?.layoutMode === 'minimal';
    const showVisualizerTv = !!room?.showVisualizerTv;
    const visualizerMode = room?.visualizerMode || 'ribbon';
    const pickerUser = roomUsers.find(u => u.uid === room?.bingoPickerUid) || null;
    const bingoRng = room?.bingoMysteryRng;
    const showBingoRngOverlay = room?.bingoMode === 'mystery' && (
        bingoRng?.active ||
        (bingoRng?.finalized && (bingoRngNow - (bingoRng.finishedAt || 0) < 15000))
    );

    return (
        <div className={`public-tv h-screen w-screen relative overflow-hidden font-saira text-white transition-colors duration-1000 ${bgClass}`}>
            {!showVisualizerTv && (
                <div className={`absolute inset-0 z-0 mix-blend-screen pointer-events-none ${waveformOpacity} ${room?.hideWaveform ? 'hidden' : ''}`}>
                    <AudioVisualizer isActive={started} externalCtx={audioCtx} onVolume={handleVolume} />
                </div>
            )}

            {!room?.hideLogo && (
                <img src={room?.logoUrl || ASSETS.logo} className="tv-logo absolute top-8 left-8 w-96 z-50 drop-shadow-xl opacity-90" alt="Logo" />
            )}
            {isExperienceActive && (
                <div className="absolute top-8 right-8 z-[240] flex items-center gap-3 bg-red-600/90 border border-red-200/40 px-4 py-2 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                    <div className="text-sm md:text-base font-black tracking-widest uppercase">
                        LIVE: {experienceLabel}
                    </div>
                    <button
                        type="button"
                        onClick={closeExperience}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50"
                        title="Close experience"
                        aria-label="Close experience"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            )}
            {showBingoRngOverlay && (
                <div className="absolute inset-0 z-[230] bg-black/80 flex items-center justify-center p-10">
                    <div className="w-full max-w-4xl bg-zinc-900/90 border border-white/10 rounded-[2.5rem] p-8 text-center shadow-2xl">
                        <div className="text-xs uppercase tracking-[0.4em] text-zinc-500">Mystery Bingo</div>
                        <div className="text-6xl font-bebas text-cyan-300 mt-3">Spin Results</div>
                        <div className="text-sm text-zinc-400 uppercase tracking-widest mt-2">
                            {bingoRng?.active ? 'Spinning now' : 'Order locked'}
                        </div>
                        <div className="mt-6 grid grid-cols-1 gap-3">
                            {bingoRngResults.length === 0 && (
                                <div className="text-zinc-500 text-lg">Waiting for spins...</div>
                            )}
                            {bingoRngResults.slice(0, 8).map((entry, idx) => (
                                <div key={entry.uid} className="flex items-center justify-between bg-black/50 border border-white/10 rounded-2xl px-6 py-3">
                                    <div className="flex items-center gap-4">
                                        <div className="text-3xl">{entry.avatar}</div>
                                        <div className="text-2xl font-bold text-white">{entry.name}</div>
                                    </div>
                                    <div className="text-3xl font-black text-yellow-300">#{idx + 1}</div>
                                    <div className="text-3xl font-black text-cyan-200 tabular-nums">{entry.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {tipPulse && (room?.tipUrl || room?.tipQrUrl) && (
                <div className="absolute bottom-6 right-6 z-[120] bg-emerald-500/90 text-black px-6 py-4 rounded-2xl border-2 border-white shadow-[0_0_30px_rgba(16,185,129,0.6)] animate-pulse backdrop-blur">
                    <div className="text-xs font-bold uppercase tracking-widest">Show some love</div>
                    <div className="text-2xl font-black">Tip the host {EMOJI.tip}</div>
                </div>
            )}
            {bonusDropBurst && (
                <div className="absolute inset-0 z-[210] pointer-events-none flex items-center justify-center">
                    <div className="bonus-drop-burst">
                        <div className="bonus-drop-title">{bonusDropBurst.by || 'Host'} made it rain</div>
                        <div className="bonus-drop-points">+{bonusDropBurst.points || 0} PTS</div>
                        <div className="bonus-drop-sub">for all lobby members</div>
                    </div>
                </div>
            )}
            

            {guitarWinner && (
                <div className="absolute top-28 left-1/2 -translate-x-1/2 z-[140] bg-black/70 border border-yellow-400/60 px-8 py-4 rounded-full shadow-[0_0_30px_rgba(250,204,21,0.4)] backdrop-blur">
                    <div className="flex items-center gap-4">
                        <div className="text-4xl">{guitarWinner.avatar}</div>
                        <div className="text-xl font-bold text-yellow-300">Guitar Solo MVP</div>
                        <div className="text-white font-black">{guitarWinner.name}</div>
                        <div className="text-yellow-400 font-mono">{guitarWinner.hits} hits</div>
                    </div>
                </div>
            )}

            {/* --- VIBE MODE OVERLAYS --- */}
            
            {room?.lightMode === 'strobe' && (
                <div className="absolute inset-0 z-[160] pointer-events-none">
                    <div className="absolute inset-0 vibe-strobe opacity-55 mix-blend-screen bg-white"></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-pink-500/25 via-transparent to-cyan-400/20"></div>
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center">
                        <div className="text-sm uppercase tracking-[0.45em] text-white/80">Beat Drop</div>
                        {strobePhase === 'countdown' && (
                            <>
                                <div className="text-[10rem] font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]">{strobeCountdown || 0}</div>
                                <div className="text-xl font-bold text-white/90">Get ready to tap</div>
                            </>
                        )}
                        {strobePhase === 'active' && (
                            <>
                                <div className="text-6xl font-bebas text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]">TAP THE BEAT</div>
                                <div className="text-lg text-white/90">Tap on your phone to keep the meter alive</div>
                                <div className="mt-3 text-base text-white/80">Time Left: {strobeRemaining}s</div>
                                <div className="mt-4 h-5 w-[560px] max-w-[75vw] bg-white/20 rounded-full overflow-hidden border border-white/30 mx-auto">
                                    <div className="h-full bg-white/90" style={{ width: `${strobeMeter}%` }}></div>
                                </div>
                                <div className="mt-2 text-xs uppercase tracking-[0.3em] text-white/70">Total taps {strobeTotalTaps}</div>
                            </>
                        )}
                    </div>
                    {strobePhase === 'active' && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 max-w-[85vw] overflow-x-auto px-4">
                            {strobeLeaders.map((u, idx) => (
                                <div key={u.uid || idx} className="bg-black/60 border border-white/20 rounded-full px-4 py-2 text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap flex-shrink-0">
                                    <span className="text-xl">{u.avatar || EMOJI.sparkle}</span>
                                    <span className="truncate max-w-[120px]">{u.name || 'Guest'}</span>
                                    <span className="text-cyan-300 font-mono">{u.strobeTaps || 0}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {room?.lightMode === 'storm' && (
                <div className={`absolute inset-0 z-[140] pointer-events-none storm-overlay storm-phase-${stormPhase}`}>
                    <div className="absolute inset-0 storm-clouds mix-blend-multiply"></div>
                    <div className="absolute inset-0 vibe-lightning mix-blend-screen"></div>
                    <div className="rain"></div>
                    <div className={`absolute inset-0 storm-flash ${stormFlash ? 'storm-flash-active' : ''}`}></div>
                    <div className="absolute inset-0 storm-glow mix-blend-screen"></div>
                </div>
            )}
            
            {room?.lightMode === 'banger' && (
                <>
                    <div className="absolute inset-0 z-[140] pointer-events-none vibe-banger mix-blend-overlay bg-red-500/20"></div>
                    <div className="fire-overlay">
                        {[...Array(15)].map((_, i) => (
                            <div key={i} className="fire-particle" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s` }}>
                                {[EMOJI.fire, emoji(0x1F692), emoji(0x1F9D1, 0x200D, 0x1F692), emoji(0x1F9EF), emoji(0x1F9E8)][Math.floor(Math.random() * 5)]}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {room?.lightMode === 'ballad' && (
                <div className="absolute inset-0 z-[140] pointer-events-none overflow-hidden">
                    <div className="absolute inset-0 ballad-haze opacity-30"></div>
                    <div className="absolute inset-x-0 bottom-0 h-[40%] ballad-glow opacity-60"></div>
                    <div className="absolute inset-0 fire-overlay opacity-40"></div>
                    <div className="absolute inset-0 pointer-events-none">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={`ballad-fire-${i}`}
                                className="fire-particle"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 2.5}s`,
                                    animationDuration: `${1.8 + Math.random() * 1.6}s`,
                                    fontSize: '2rem',
                                    opacity: 0.6
                                }}
                            >
                                {EMOJI.fire}
                            </div>
                        ))}
                    </div>
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 text-sm font-bold tracking-[0.6em] text-white/70 uppercase">Lights Up - Sway</div>
                    {balladLights.slice(0, 4).map((light, idx) => (
                        <div
                            key={idx}
                            className="absolute ballad-orb"
                            style={{
                                left: light.left,
                                bottom: light.bottom,
                                '--orb-size': light.size,
                                '--sway-duration': light.sway,
                                '--float-delay': light.delay,
                                '--orb-alpha': Math.min(light.opacity, 0.5)
                            }}
                        ></div>
                    ))}
                </div>
            )}

            {room?.lightMode === 'guitar' && (
                <>
                    <div className="absolute inset-0 z-[80] pointer-events-none bg-gradient-to-b from-black/60 via-black/70 to-red-900/50"></div>
                    <div className="absolute inset-0 z-[81] pointer-events-none">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,59,120,0.15),transparent_55%)]"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(255,140,0,0.1),transparent_60%)]"></div>
                    </div>
                <div className="absolute inset-0 z-[85] pointer-events-none flex flex-col items-center justify-between py-8">
                        <div className="text-8xl font-bebas text-transparent bg-clip-text bg-gradient-to-t from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_30px_rgba(255,100,0,0.8)] animate-pulse">GUITAR SOLO!</div>
                        <div className="flex justify-center pointer-events-none">
                            <div className="bg-black/60 border border-white/10 rounded-3xl px-8 py-6 backdrop-blur-md min-w-[60%] max-w-[80vw]">
                                <div className="text-sm text-zinc-300 mb-4 text-center tracking-[0.3em] uppercase">Top Strummers</div>
                                <div className="flex flex-wrap items-center justify-center gap-5">
                                    {guitarLeaders.length === 0 && (
                                        <div className="text-zinc-400 text-sm">Start strumming to appear here.</div>
                                    )}
                                    {guitarLeaders.map(p => {
                                        const max = Math.max(1, ...guitarLeaders.map(v=>v.guitarHits || 0));
                                        const scale = 1 + Math.min(0.9, (p.guitarHits || 0) / max * 0.9);
                                        return (
                                            <div key={p.uid} className="flex items-center gap-3 bg-black/70 px-4 py-2 rounded-full border border-white/15 shadow-lg transition-transform duration-200" style={{ transform: `scale(${scale})` }}>
                                                <div className="text-4xl">{p.avatar}</div>
                                                <div className="text-white font-bold text-lg">{p.name}</div>
                                                <div className="text-yellow-400 font-mono text-lg ml-2">{p.guitarHits || 0}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                </div>
                </>
            )}
            
            {multiplier >= 4 && <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_20%,#000_120%)] opacity-50 mix-blend-overlay pointer-events-none"></div>}

            <div className={`relative z-10 h-full grid grid-cols-12 gap-6 p-4 md:p-6 ${isCinema ? 'pt-0 pb-0' : 'pt-32 pb-24'}`}>
                {/* STAGE AREA */}
                <div className={`${isCinema ? 'col-span-12' : 'col-span-8'} flex flex-col transition-all duration-500`}>
                    <div className={`flex-1 ${isMinimal || isCinema ? 'bg-black' : 'bg-black/30 backdrop-blur-md border border-white/10'} rounded-3xl relative shadow-2xl overflow-hidden min-h-[50vh]`}>
                        <div className="absolute inset-0 pointer-events-none tv-light-sweep"></div>
                          {current && showScoring && (
                              <div className="absolute top-12 right-6 z-[80] text-right">
                                  <AnimatedPoints value={Math.max(0, currentPerformancePoints)} />
                                  <div className="flex items-center justify-end gap-2 mt-2">
                                    <div className="text-[10px] text-zinc-400 tracking-widest">PERFORMANCE TOTAL</div>
                                    {currentSingerIsVip && (
                                        <div className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest bg-yellow-400 text-black shadow-[0_0_10px_rgba(253,224,71,0.6)]">
                                            VIP
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className={`absolute top-0 left-0 w-full h-14 z-[70] bg-black/60 border-b border-white/15 flex items-center shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition-all duration-500 ${showHypeMeter ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6 pointer-events-none'}`}>
                            <div className="absolute inset-0 border-y border-white/10 pointer-events-none"></div>
                            <div className="absolute left-4 z-10 font-bold text-base uppercase tracking-widest flex gap-2 items-center">
                                <span className="text-2xl">{EMOJI.fire}</span>
                                <span>HYPE METER</span>
                                {room?.multiplier > 1 && <span className="bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">x{room.multiplier} ACTIVE</span>}
                            </div>
                            <div 
                                className={`h-full transition-all duration-200 ${combo > 90 ? 'bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 animate-pulse' : combo > 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-cyan-600 to-blue-600'}`} 
                                style={{width: `${Math.min(100, Math.max(5, combo))}%`, boxShadow: `0 0 20px ${combo > 50 ? 'orange' : 'cyan'}`}}
                            ></div>
                            <div className="absolute left-1/2 top-0 h-full w-1 bg-cyan-400/60 -translate-x-1/2"></div>
                            <div className="absolute left-1/2 top-1.5 -translate-x-1/2 text-base font-bold text-cyan-200 bg-black/70 px-3 py-1 rounded">2x</div>
                            <div className="absolute left-[90%] top-0 h-full w-1 bg-purple-400/60 -translate-x-1/2"></div>
                            <div className="absolute left-[90%] top-1.5 -translate-x-1/2 text-base font-bold text-purple-200 bg-black/70 px-3 py-1 rounded">4x</div>
                        </div>
                        {room?.activeMode === 'selfie_cam' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
                                <i className="fa-solid fa-camera text-9xl text-white animate-bounce mb-4"></i>
                                <h1 className="text-6xl font-bebas text-pink-500">SELFIE CAM ACTIVE!</h1>
                            </div>
                        ) : (
                            <>
                                {room?.bingoMode === 'mystery' && room?.activeMode === 'bingo' && pickerUser && (
                                    <div className="absolute top-6 left-6 z-[90] bg-black/70 border border-cyan-400/40 px-4 py-2 rounded-full text-sm uppercase tracking-widest text-cyan-200">
                                        Next Pick: <span className="text-white font-bold">{pickerUser.name}</span>
                                    </div>
                                )}
                                {showVisualizerTv && (
                                    <div className="absolute inset-0 z-30 bg-black">
                                        <AudioVisualizer
                                            isActive={started}
                                            externalCtx={audioCtx}
                                            onVolume={handleVolume}
                                            mode={visualizerMode}
                                            className="w-full h-full opacity-95"
                                        />
                                    </div>
                                )}
                                <Stage room={room} current={current} started={started} combo={combo} minimalUI={isMinimal} showVideo={!isMinimal} />
                            </>
                        )}
                    </div>
                </div>
                
                {/* SIDEBAR: Hidden in Cinema Mode */}
                {!isCinema && (
                    <div className="col-span-4 flex flex-col gap-4 h-full min-h-0 pb-4">
                         <div className="p-5 rounded-3xl text-center shadow-lg bg-gradient-to-br from-indigo-900 to-purple-900 border border-white/20">
                            <div className="text-4xl font-black text-cyan-200 mb-3 uppercase tracking-[0.3em]">JOIN</div>
                            <div className="bg-white p-2 rounded-2xl inline-block">
                                <LocalQrImage
                                    value={`${appBase}?room=${roomCode}`}
                                    size={220}
                                    alt="QR"
                                    className="w-[220px] h-[220px]"
                                />
                            </div>
                            <div className="text-5xl font-bebas text-white mt-2 tracking-[0.2em]">{roomCode}</div>
                            <div className="text-base text-zinc-100 mt-2 font-semibold tracking-widest uppercase">Go to {joinUrlDisplay}</div>
                            {isMinimal && <div className="mt-4"><MiniVideoPane room={room} current={current} /></div>}
                         </div>

                         {spotlightUser && (
                            <div className="p-5 rounded-3xl bg-black/70 border border-yellow-400/30 shadow-[0_0_25px_rgba(234,179,8,0.2)] text-center">
                                <div className="text-[10px] uppercase tracking-[0.4em] text-yellow-300">Spotlight</div>
                                <div className="text-5xl mt-2">{spotlightUser.avatar || EMOJI.star}</div>
                                <div className="text-2xl font-bold text-white mt-2 truncate">{spotlightUser.name || 'Guest'}</div>
                                {room?.spotlightUser?.msg && (
                                    <div className="text-xs text-yellow-200 mt-1">{room.spotlightUser.msg}</div>
                                )}
                            </div>
                         )}
                         
                         {room?.showFullQueue ? (
                            <div className="flex-1 min-h-0 bg-black/90 backdrop-blur rounded-3xl p-6 border border-pink-500/50 overflow-hidden flex flex-col animate-in zoom-in">
                                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                                    <h3 className="text-3xl font-bebas text-pink-400">FULL QUEUE ({allQueue.length})</h3>
                                    {room?.bouncerMode && (
                                        <div className="px-3 py-1 rounded-full bg-black/70 border border-red-400/40 text-red-300 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                                            <i className="fa-solid fa-lock"></i>
                                            Requests Need Approval
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                                    {allQueue.map((s, i) => {
                                        const vip = isVipSong(s);
                                        return (
                                        <div key={s.id} className="bg-zinc-800/50 p-3 rounded-xl flex items-center gap-3 border border-white/5">
                                            <div className="font-bebas text-2xl text-zinc-500 w-8 text-center">#{i+1}</div>
                                            <div className="min-w-0">
                                                <div className="font-bold truncate text-white">{s.songTitle}</div>
                                                <div className="text-xs text-zinc-400 truncate flex items-center gap-2">
                                                    <span>{s.singerName}</span>
                                                    {vip && (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest bg-yellow-400 text-black">VIP</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                         ) : (
                             <div className="flex-1 min-h-0 bg-zinc-800/80 backdrop-blur rounded-3xl p-6 border border-white/10 flex flex-col">
                                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                                    <h3 className="text-5xl font-bebas text-cyan-400">UP NEXT</h3>
                                    {room?.bouncerMode && (
                                        <div className="px-3 py-1 rounded-full bg-black/70 border border-red-400/40 text-red-300 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                                            <i className="fa-solid fa-lock"></i>
                                            Requests Need Approval
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {queueRules.map(rule => (
                                        <div key={rule.label} className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1 rounded-full text-xs uppercase tracking-widest text-zinc-200">
                                            <i className={`fa-solid ${rule.icon} text-cyan-300`}></i>
                                            <span>{rule.label}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mb-4 text-xs uppercase tracking-[0.3em] text-zinc-400">
                                    Queue: <span className="text-white font-bold">{allQueue.length}</span> songs
                                    {' '}
                                    | Est wait <span className="text-white font-bold">{formatWaitTime(queueWaitSec)}</span>
                                </div>
                                <div className="space-y-2 mb-6">
                                    {nextUp.map((s, i) => {
                                        const vip = isVipSong(s);
                                        return (
                                            <div key={s.id} className="bg-zinc-700/50 p-2 rounded-xl flex items-center gap-3 border-l-4 border-pink-500">
                                                <div className="font-bebas text-3xl text-zinc-400">#{i+1}</div>
                                                <div className="min-w-0">
                                                    <div className="font-bold truncate text-xl leading-none">{s.songTitle}</div>
                                                    <div className="text-base text-zinc-400 truncate flex items-center gap-2">
                                                        <span>{s.singerName}</span>
                                                        {vip && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest bg-yellow-400 text-black">VIP</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <h3 className="text-5xl font-bebas text-green-400 mb-2 border-b border-white/10 pb-2">
                                    {showChatFeed ? 'CHAT' : 'ACTIVITY'}
                                </h3>
                                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                                    {showChatFeed ? (
                                        <>
                                            {chatMessages.length === 0 && (
                                                <div className="text-zinc-500 text-lg">
                                                    {room?.chatEnabled === false
                                                        ? 'Chat is paused by the host.'
                                                        : room?.chatAudienceMode === 'vip'
                                                            ? 'Chat is VIP-only right now.'
                                                            : 'No chat yet.'}
                                                </div>
                                            )}
                                            {[...chatMessages].reverse().map(m => (
                                                <div key={m.id} className="flex gap-2 items-center text-zinc-200 text-lg">
                                                    <span>{m.avatar || EMOJI.sparkle}</span>
                                                    <span className="truncate">
                                                        <span className="font-bold text-white">{m.user || 'Guest'}</span>
                                                        {m.isVip && (
                                                            <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest bg-yellow-400 text-black">VIP</span>
                                                        )}{' '}
                                                        {m.text}
                                                    </span>
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        <>
                                            {activities.map((a, i) => (
                                                <div key={i} className="flex gap-2 items-center text-zinc-200 text-lg">
                                                    <span>{a.icon}</span>
                                                    <span className="truncate"><span className="font-bold text-white">{a.user}</span> {a.text}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                             </div>
                         )}
                    </div>
                )}
            </div>

            {room?.activeMode === 'selfie_challenge' && (
                <div className="absolute inset-0 z-[120] bg-black/70 backdrop-blur-sm flex flex-col p-10">
                    <div className="text-center mb-6">
                        <div className="text-xs uppercase tracking-[0.4em] text-zinc-400">Selfie Challenge</div>
                        <div className="text-4xl font-bebas text-white">{room?.selfieChallenge?.prompt || 'Get ready'}</div>
                        {room?.selfieChallenge?.status && (
                            <div className="text-sm text-cyan-300 mt-2">Status: {room.selfieChallenge.status}</div>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-6 flex-1">
                        {(room?.selfieChallenge?.requireApproval ? selfieSubmissions.filter(s => s.approved) : selfieSubmissions).map(s => (
                            <div key={s.id} className="bg-zinc-900/80 border border-zinc-700 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                                <div className="relative">
                                    <img src={s.url} alt={s.userName} className="w-full h-52 object-cover" />
                                    <div className="absolute top-3 right-3 bg-black/70 px-3 py-1 rounded-full text-sm font-bold text-cyan-300">
                                        {selfieVoteCounts[s.uid] || 0} votes
                                    </div>
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{s.avatar || 'O'}</span>
                                        <div className="text-lg font-bold text-white truncate max-w-[220px]">{s.userName}</div>
                                    </div>
                                    <div className="h-2 w-24 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, ((selfieVoteCounts[s.uid] || 0) / Math.max(1, ...Object.values(selfieVoteCounts), 1)) * 100)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(room?.selfieChallenge?.requireApproval ? selfieSubmissions.filter(s => s.approved) : selfieSubmissions).length === 0 && (
                            <div className="col-span-3 flex items-center justify-center text-zinc-400 text-xl">Waiting for selfies...</div>
                        )}
                    </div>
                    {room?.selfieChallenge?.status === 'ended' && room?.selfieChallenge?.winner && (!room?.selfieChallenge?.winnerExpiresAt || Date.now() < room.selfieChallenge.winnerExpiresAt) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <div className="bg-zinc-900 border border-[#00C4D9]/40 rounded-3xl p-8 text-center shadow-2xl">
                                <div className="text-xs uppercase tracking-[0.4em] text-zinc-500">Winner</div>
                                <div className="text-5xl font-bebas text-white mb-4">{room.selfieChallenge.winner.name}</div>
                                <img src={room.selfieChallenge.winner.url} alt={room.selfieChallenge.winner.name} className="w-[360px] h-[360px] object-cover rounded-2xl border border-white/10 mx-auto" />
                                <div className="text-cyan-300 font-bold mt-4">{room.selfieChallenge.winner.votes || 0} votes</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Marquee */}
            {((marqueeItems.length > 0) || messages.length > 0) && (
                <div className={`marquee-shell absolute bottom-0 left-0 w-full h-40 bg-pink-600 overflow-hidden flex items-center z-40 border-t-4 border-white shadow-[0_-10px_30px_rgba(219,39,119,0.5)] ${showMarquee ? 'marquee-on' : 'marquee-off'}`}>
                    <div className="whitespace-nowrap animate-marquee flex gap-16 px-6">
                        {marqueeText ? (
                            <span className="font-bebas text-white flex items-center gap-3 leading-none" style={{ fontSize: 'clamp(2.5rem, 4vw, 5rem)' }}>
                                {marqueeText}
                            </span>
                        ) : (
                            messages.map((m, i) => (
                                <span key={i} className="font-bebas text-white flex items-center gap-3 leading-none" style={{ fontSize: 'clamp(2.5rem, 4vw, 5rem)' }}>
                                    <span className="bg-black/20 px-3 rounded" style={{ fontSize: 'clamp(1.2rem, 2.4vw, 3rem)' }}>{m.user}:</span> {m.text}
                                </span>
                            ))
                        )}
                    </div>
                </div>
            )}
            
            {/* Selfie Overlay */}
            {photoOverlay && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 animate-in zoom-in">
                    <div className="relative transform rotate-[-5deg] bg-white p-4 pb-16 shadow-2xl">
                        <img src={photoOverlay.url} className="max-h-[70vh] border-2 border-zinc-200" />
                        <img src={ASSETS.logo} className="absolute top-4 right-4 w-24 opacity-90" alt="BROSS" />
                        {photoOverlay.mode === 'guitar_victory' ? (
                            <div className="absolute bottom-4 left-0 w-full text-center">
                                <div className="text-xl text-pink-600 font-black uppercase tracking-[0.4em]">Guitar Solo MVP</div>
                                <div className="text-3xl text-black font-bold font-mono mt-1">{photoOverlay.userName}</div>
                                <div className="text-sm text-zinc-600 font-semibold mt-1">{photoOverlay.copy || 'Shredded the hardest.'}</div>
                            </div>
                        ) : photoOverlay.mode === 'strobe_victory' ? (
                            <div className="absolute bottom-4 left-0 w-full text-center">
                                <div className="text-xl text-cyan-600 font-black uppercase tracking-[0.4em]">Beat Drop MVP</div>
                                <div className="text-3xl text-black font-bold font-mono mt-1">{photoOverlay.userName}</div>
                                <div className="text-sm text-zinc-600 font-semibold mt-1">{photoOverlay.copy || 'Kept the beat alive.'}</div>
                            </div>
                        ) : (
                            <div className="absolute bottom-4 left-0 w-full text-center text-3xl text-black font-bold font-mono">{EMOJI.camera} {photoOverlay.userName}</div>
                        )}
                    </div>
                </div>
            )}

            {/* Applause Meter Overlay */}
            {applauseStep !== 'idle' && (
                <div className="absolute inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
                    <h1 className="text-6xl font-bebas text-white mb-8 tracking-widest animate-pulse">NOISE LEVEL</h1>
                    <div className="relative w-[500px] h-[500px] flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-[20px] border-zinc-800"></div>
                        <svg className="absolute inset-0 w-full h-full -rotate-90 transform drop-shadow-[0_0_30px_rgba(0,196,217,0.5)]" viewBox="0 0 100 100">
                            <defs>
                                <linearGradient id="applauseGradient" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#00C4D9" />
                                    <stop offset="100%" stopColor="#EC4899" />
                                </linearGradient>
                            </defs>
                            <circle cx="50" cy="50" r="40" stroke="url(#applauseGradient)" strokeWidth="8" fill="none" strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - ((applauseStep === 'result' ? applauseMax : micVolume) / 100))} strokeLinecap="round" className="transition-all duration-75 ease-linear" />
                        </svg>
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="text-[10rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00C4D9] to-[#EC4899] font-mono leading-none drop-shadow-[0_0_20px_rgba(236,72,153,0.35)]">
                                {Math.round(applauseStep === 'result' ? applauseMax : micVolume)}
                            </div>
                            <div className="text-2xl text-zinc-500 font-bold">dB</div>
                        </div>
                    </div>
                    <div className="mt-8 text-4xl text-cyan-300 font-bebas tracking-widest animate-bounce">
                        {applauseStep === 'countdown'
                            ? `GET READY... ${countdown}`
                            : applauseStep === 'measuring'
                                ? `MEASURING... ${measure}`
                                : "PEAK LEVEL REACHED"}
                    </div>
                </div>
            )}

            {/* Reactions */}
            <div className="absolute inset-0 z-[200] pointer-events-none overflow-hidden">
                {reactions.map(r => (
                    <div key={r.id} className="absolute bottom-0 flex flex-col items-center reaction-stack" style={{left: `${r.left}%`}}>
                        {r.isVip && (
                            <div className="absolute -inset-10 rounded-full bg-gradient-to-tr from-yellow-400/30 via-pink-400/30 to-cyan-400/30 blur-xl animate-vip-glow"></div>
                        )}
                        <div className="relative flex flex-col items-center">
                            <div className={`relative ${getReactionClass(r.type)} ${r.isVip ? 'vip-reaction-emoji' : ''}`}>
                                {getEmojiChar(r.type)}
                                {r.isVip && (
                                    <span className="absolute -top-4 -right-4 text-3xl animate-vip-spin">✨</span>
                                )}
                            </div>
                            <div className="mt-3 flex flex-col items-center gap-1 reaction-label">
                                <div className={`px-4 py-1 rounded-full text-2xl font-black tracking-widest ${r.isVip ? 'text-yellow-300 border-2 border-yellow-300 bg-black/70 shadow-[0_0_18px_rgba(253,224,71,0.6)]' : 'text-yellow-200 border-2 border-yellow-500/40 bg-black/60'}`}>
                                    +{r.points || 0}
                                </div>
                                <div className={`px-4 py-1 rounded-full text-xl font-bold flex items-center gap-2 ${r.isVip ? 'text-yellow-300 border-2 border-yellow-400 bg-black/70 shadow-[0_0_20px_rgba(253,224,71,0.5)]' : 'text-white border-2 border-white/20 bg-black/60'}`}>
                                    <span className="truncate max-w-[12rem]">{r.userName || 'Guest'}</span>
                                    {r.isVip && <span className="text-xs font-black tracking-widest">VIP</span>}
                                </div>
                                <div className="px-3 py-1 rounded-full text-base font-semibold text-cyan-200 border border-cyan-400/40 bg-black/60">
                                    +{r.basePoints || 0} x{r.multiplier || 1} = {r.points || 0}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {previewActive && (
                <div className="absolute inset-0 z-[120] flex items-center justify-center pointer-events-none">
                    <div className="bg-black/70 border border-cyan-400/30 rounded-3xl p-6 shadow-[0_0_40px_rgba(0,196,217,0.25)] w-[70vw] max-w-3xl">
                        <div className="text-xs uppercase tracking-[0.4em] text-cyan-300 mb-2">TV Preview</div>
                        <div className="text-3xl font-bebas text-white mb-4">
                            {previewTitleMap[previewGameId] || 'Game'} Layout
                        </div>
                        {previewGameId === 'bingo' ? (
                            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${room?.bingoSize || 5}, minmax(0, 1fr))` }}>
                                {Array.from({ length: (room?.bingoSize || 5) ** 2 }).map((_, idx) => (
                                    <div key={idx} className="h-10 rounded-lg bg-zinc-900/70 border border-white/10 flex items-center justify-center text-xs text-zinc-400">
                                        {idx === Math.floor(((room?.bingoSize || 5) ** 2) / 2) ? 'FREE' : ''}
                                    </div>
                                ))}
                            </div>
                        ) : previewGameId === 'trivia_pop' ? (
                            <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4">
                                <div className="text-sm uppercase tracking-widest text-zinc-400 mb-2">Trivia Question</div>
                                <div className="text-xl text-white">What is the chorus after the first verse?</div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-300">
                                    <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2">Option A</div>
                                    <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2">Option B</div>
                                    <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2">Option C</div>
                                    <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2">Option D</div>
                                </div>
                            </div>
                        ) : previewGameId === 'wyr' ? (
                            <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4">
                                <div className="text-sm uppercase tracking-widest text-zinc-400 mb-2">Would You Rather</div>
                                <div className="grid grid-cols-2 gap-3 text-lg text-white">
                                    <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-6 text-center">Sing every duet</div>
                                    <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-6 text-center">Run the DJ booth</div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 text-zinc-300">
                                Preview enabled. Launch to start the full game.
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
              @keyframes marquee { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } } 
              @keyframes marqueeFade { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
              @keyframes float-up { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-120px); } }
              @keyframes points-burst { 0% { opacity: 0; transform: translateY(10px) scale(0.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-18px) scale(1.2); } }
              @keyframes vip-glow { 0% { opacity: 0.6; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.08); } 100% { opacity: 0.6; transform: scale(0.95); } }
              @keyframes vip-jolt { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-2deg) scale(1.05); } 50% { transform: rotate(2deg) scale(1.08); } 75% { transform: rotate(-1deg) scale(1.04); } }
              @keyframes vip-spin { 0% { transform: rotate(0deg) scale(1); } 100% { transform: rotate(360deg) scale(1.2); } }
              @keyframes reaction-label-in { 0% { opacity: 0; transform: translateY(10px) scale(0.95); } 40% { opacity: 1; } 100% { opacity: 1; transform: translateY(0) scale(1); } }
              @keyframes tv-sweep { 0% { transform: translateX(-120%); opacity: 0; } 20% { opacity: 0.45; } 50% { opacity: 0.12; } 100% { transform: translateX(120%); opacity: 0; } }
              @keyframes bonus-pop { 0% { opacity: 0; transform: scale(0.7); } 20% { opacity: 1; transform: scale(1.02); } 100% { opacity: 0; transform: scale(1.08); } }
              @keyframes bonus-sheen { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
              .bonus-drop-burst { 
                min-width: min(80vw, 980px);
                background: radial-gradient(circle at top, rgba(34,211,238,0.35), rgba(236,72,153,0.35) 45%, rgba(0,0,0,0.9) 70%);
                border: 2px solid rgba(255,255,255,0.25);
                border-radius: 32px;
                padding: 40px 50px;
                text-align: center;
                box-shadow: 0 0 60px rgba(34,211,238,0.25), 0 0 90px rgba(236,72,153,0.25);
                animation: bonus-pop 6s ease forwards;
              }
              .bonus-drop-title { font-size: clamp(1.2rem, 2vw, 2rem); letter-spacing: 0.4em; text-transform: uppercase; color: #e2e8f0; }
              .bonus-drop-points { font-size: clamp(3rem, 6vw, 7rem); font-weight: 900; text-transform: uppercase; background: linear-gradient(90deg, #22d3ee, #f472b6, #fde047); background-size: 200% 200%; -webkit-background-clip: text; color: transparent; animation: bonus-sheen 2s linear infinite; }
              .bonus-drop-sub { font-size: clamp(0.9rem, 1.8vw, 1.4rem); text-transform: uppercase; letter-spacing: 0.3em; color: #cbd5f5; }
              .animate-marquee { animation: marquee 15s linear infinite; }
              .marquee-shell { transition: opacity 350ms ease, transform 350ms ease; }
              .marquee-on { opacity: 1; transform: translateY(0); animation: marqueeFade 350ms ease; }
              .marquee-off { opacity: 0; transform: translateY(12px); pointer-events: none; }
              .points-burst { position: absolute; width: 8px; height: 8px; border-radius: 9999px; background: #facc15; box-shadow: 0 0 12px rgba(250, 204, 21, 0.7); animation: points-burst 0.6s ease-out forwards; }
              .points-burst-a { top: -6px; left: 18px; }
              .points-burst-b { top: 6px; right: 10px; background: #22d3ee; box-shadow: 0 0 12px rgba(34, 211, 238, 0.7); }
              .points-burst-c { bottom: -4px; left: 40px; background: #f472b6; box-shadow: 0 0 12px rgba(244, 114, 182, 0.7); }
              .reaction-stack { animation: float-up 2.6s ease-out forwards; will-change: transform, opacity; }
              .reaction-label { animation: reaction-label-in 0.35s ease-out forwards; }
              .animate-vip-glow { animation: vip-glow 1.2s ease-in-out infinite; }
              .vip-reaction-emoji { animation: vip-jolt 0.6s ease-in-out infinite; filter: drop-shadow(0 0 18px rgba(250, 204, 21, 0.75)); }
              .animate-vip-spin { animation: vip-spin 1.2s linear infinite; }
              .tv-light-sweep { background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.12) 45%, transparent 80%); animation: tv-sweep 10s ease-in-out infinite; mix-blend-mode: screen; }
            `}</style>
        </div>
    );
};

export default PublicTV;
