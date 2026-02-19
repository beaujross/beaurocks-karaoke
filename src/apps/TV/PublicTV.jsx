import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { db, collection, doc, onSnapshot, query, where, limit, orderBy, updateDoc, addDoc, serverTimestamp, trackEvent, callFunction } from '../../lib/firebase';
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
import { createLogger } from '../../lib/logger';
import groupChatMessages from '../../lib/chatGrouping';
import useTvVisualizerSettings from './hooks/useTvVisualizerSettings';
import {
    DEFAULT_POP_TRIVIA_ROUND_SEC,
    POP_TRIVIA_VOTE_TYPE,
    dedupeQuestionVotes,
    getActivePopTriviaQuestion
} from '../../lib/popTrivia';

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

const LOBBY_PLAYGROUND_PROMPTS = [
    'Tap HYPE on your phone and watch the TV react.',
    'Drop CLAP reactions together to fill the hype meter.',
    'Send a chat message and see it land on the room feed.',
    'Update your emoji/avatar and spot your card instantly.',
    'Try LOVE or CHEERS to paint the screen with energy.'
];

const LOBBY_REACTION_LABELS = {
    fire: 'Hype',
    heart: 'Love',
    clap: 'Clap',
    drink: 'Cheers',
    rocket: 'Boost',
    diamond: 'Gem',
    money: 'Rich',
    crown: 'Royal',
    strum: 'Strum'
};

const getLobbyReactionLabel = (type = '') => {
    const key = String(type || '').trim().toLowerCase();
    if (LOBBY_REACTION_LABELS[key]) return LOBBY_REACTION_LABELS[key];
    if (!key) return 'Reaction';
    return key
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const STORM_CROWD_LAYERS = [
    { id: 'snap', label: 'Snap', icon: emoji(0x1F90F), accent: 'from-cyan-300 to-sky-200' },
    { id: 'tap', label: 'Thigh Tap', icon: emoji(0x1F941), accent: 'from-blue-300 to-cyan-200' },
    { id: 'stomp', label: 'Stomp', icon: emoji(0x1F463), accent: 'from-indigo-300 to-blue-200' },
    { id: 'clap', label: 'Clap', icon: emoji(0x1F44F), accent: 'from-fuchsia-300 to-pink-200' }
];
const STORM_CROWD_LAYER_IDS = new Set(STORM_CROWD_LAYERS.map((layer) => layer.id));
const makeStormLayerMeters = () => ({ snap: 0, tap: 0, stomp: 0, clap: 0 });

const normalizeStormLayer = (layer = '') => {
    const key = String(layer || '').trim().toLowerCase();
    if (STORM_CROWD_LAYER_IDS.has(key)) return key;
    if (key === 'thigh_tap' || key === 'thightap') return 'tap';
    return 'clap';
};

const LOBBY_PLAY_EFFECTS = {
    lobby_play_wave: { label: 'Wave Tunnel', icon: emoji(0x1F44B), accent: 'from-cyan-300/70 to-blue-400/70' },
    lobby_play_laser: { label: 'Laser Pop', icon: emoji(0x2728), accent: 'from-fuchsia-300/70 to-cyan-300/70' },
    lobby_play_echo: { label: 'Echo Ring', icon: emoji(0x1F30A), accent: 'from-blue-300/70 to-indigo-400/70' },
    lobby_play_confetti: { label: 'Confetti', icon: emoji(0x1F389), accent: 'from-pink-300/70 to-yellow-300/70' }
};

const getLobbyPlayEffect = (type = '') => {
    const key = String(type || '').trim().toLowerCase();
    return LOBBY_PLAY_EFFECTS[key] || null;
};

const normalizeTight15Entry = (entry = {}) => {
    const songTitle = String(entry.songTitle || entry.song || '').trim();
    const artist = String(entry.artist || entry.singerName || '').trim();
    if (!songTitle) return null;
    return { songTitle, artist };
};

const extractTopTight15 = ({ spotlightPayload = null, roomUser = null } = {}) => {
    const fromPayload = Array.isArray(spotlightPayload?.tight15) ? spotlightPayload.tight15 : [];
    const fromRoom = Array.isArray(roomUser?.tight15) ? roomUser.tight15 : (
        Array.isArray(roomUser?.tight15Temp) ? roomUser.tight15Temp : []
    );
    const source = fromPayload.length ? fromPayload : fromRoom;
    return source
        .map((entry) => normalizeTight15Entry(entry))
        .filter(Boolean)
        .slice(0, 3);
};
const nowMs = () => Date.now();
const clampPct = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const ACTIVE_SCREEN_AUTO_CLOSE_MS = 90000;
const HOW_TO_PLAY_AUTO_CLOSE_MS = 60000;
const tvLogger = createLogger('PublicTV');
const seededUnit = (seed) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

// --- SUB-COMPONENTS ---
const LocalQrImage = ({ value, size = 220, className = '', alt = 'QR' }) => {
    const [src, setSrc] = useState('');

    useEffect(() => {
        let active = true;
        if (!value) {
            return undefined;
        }
        QRCode.toDataURL(value, {
            width: size,
            margin: 1,
            errorCorrectionLevel: 'M'
        }).then((dataUrl) => {
            if (active) setSrc(dataUrl);
        }).catch((err) => {
            tvLogger.debug('QR generation failed', err);
            if (active) setSrc('');
        });
        return () => {
            active = false;
        };
    }, [value, size]);

    if (!value || !src) {
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
    }, [display, value]);
    
    return (
        <div className={`relative bg-black/60 backdrop-blur-sm px-3 py-2 md:px-5 md:py-3 rounded-full border border-yellow-500/30 flex items-center gap-2 md:gap-3 shadow-lg transition-transform duration-200 ${showPulse ? 'scale-110' : 'scale-100'}`}>
            {showPulse && (
                <div className="absolute inset-0 pointer-events-none">
                    <span className="points-burst points-burst-a"></span>
                    <span className="points-burst points-burst-b"></span>
                    <span className="points-burst points-burst-c"></span>
                </div>
            )}
            <span className="text-yellow-300 font-black text-xl md:text-3xl font-mono">{display}</span>
            <span className="text-xs md:text-sm text-yellow-500 font-bold tracking-widest">PTS</span>
        </div>
    );
};

const LeaderboardOverlay = ({ users, songs }) => {
    const leaderboardModes = useMemo(() => ([
        { key: 'performances', label: 'Most Performances', unit: 'PERF', getValue: (u) => u.performances },
        { key: 'totalEmojis', label: 'Most Emojis Sent', unit: 'EMOJIS', getValue: (u) => u.totalEmojis },
        { key: 'loudest', label: 'Loudest Performance', unit: 'dB', getValue: (u) => u.loudest },
        { key: 'totalPoints', label: 'Most Points', unit: 'PTS', getValue: (u) => u.totalPoints },
    ]), []);
    const [modeIndex, setModeIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setModeIndex(prev => (prev + 1) % leaderboardModes.length);
        }, 8000);
        return () => clearInterval(timer);
    }, [leaderboardModes.length]);

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
        <div className="public-tv fixed inset-0 z-[200] bg-zinc-900 flex flex-col items-center justify-center p-4 md:p-8 2xl:p-12 text-center animate-in zoom-in">
            <div className="text-center mb-6 md:mb-10 2xl:mb-12">
                <h1 className="text-[clamp(2.5rem,10vw,6rem)] 2xl:text-9xl font-bebas text-yellow-400 tracking-[0.12em] md:tracking-widest drop-shadow-[0_0_50px_rgba(234,179,8,0.5)]">LEADERBOARD</h1>
                <div className="text-sm md:text-2xl 2xl:text-3xl text-zinc-300 uppercase tracking-[0.24em] md:tracking-[0.4em] mt-2 md:mt-3">{activeMode.label}</div>
            </div>
            <div className="space-y-2 md:space-y-4 2xl:space-y-6 w-full max-w-5xl">
                {leaderboard.map((u, i) => (
                    <div key={u.uid || u.name || i} className="flex items-center justify-between bg-zinc-800 p-3 md:p-5 2xl:p-8 rounded-2xl 2xl:rounded-3xl border-2 2xl:border-4 border-zinc-700 shadow-2xl relative overflow-hidden gap-3">
                        <div className="flex items-center gap-2 md:gap-4 2xl:gap-8 relative z-10 min-w-0">
                            <div className={`text-2xl md:text-4xl 2xl:text-7xl font-mono w-10 md:w-16 2xl:w-32 text-left ${i===0?'text-yellow-400':i===1?'text-gray-300':i===2?'text-amber-700':'text-zinc-600'}`}>#{i+1}</div>
                            <div className="text-3xl md:text-5xl 2xl:text-8xl">{u.avatar}</div>
                            <div className="text-lg md:text-3xl 2xl:text-6xl font-bold text-white truncate max-w-[48vw] 2xl:max-w-lg flex items-center gap-2 md:gap-4">
                                <span className="truncate">{u.name}</span>
                                {u.isVip && (
                                    <span className="px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs md:text-sm font-black tracking-widest bg-yellow-400 text-black shadow-[0_0_18px_rgba(253,224,71,0.6)]">VIP</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right relative z-10 flex-shrink-0">
                            <div className="text-2xl md:text-4xl 2xl:text-7xl font-black text-yellow-400">{activeMode.getValue(u)} <span className="text-sm md:text-xl 2xl:text-3xl text-yellow-600">{activeMode.unit}</span></div>
                            <div className="text-xs md:text-sm 2xl:text-xl text-zinc-300 mt-1 md:mt-2">{u.performances} perf | {u.totalEmojis} emojis | {u.loudest} dB</div>
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
        <div className="public-tv fixed inset-0 z-[200] bg-gradient-to-br from-green-900 to-emerald-950 flex flex-col items-center justify-center p-4 md:p-8 2xl:p-12 text-center animate-in zoom-in">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/money.png')] opacity-10"></div>
            <h1 className="text-[clamp(2.25rem,10vw,7.5rem)] 2xl:text-[10rem] font-bebas text-white mb-4 md:mb-8 drop-shadow-lg leading-none">SHOW SOME LOVE!</h1>
            <div className="bg-white p-4 md:p-6 2xl:p-8 rounded-3xl shadow-[0_0_100px_rgba(255,255,255,0.2)] mb-4 md:mb-8 transform hover:scale-105 transition-transform duration-500">
                <img src={room.tipQrUrl || ASSETS.venmoQr} className="w-[68vw] h-[68vw] max-w-[500px] max-h-[500px] object-cover rounded-lg" alt="Tip QR" />
            </div>
            <div className="text-lg md:text-3xl 2xl:text-5xl text-green-200 font-bold bg-black/40 px-5 py-3 md:px-8 md:py-4 2xl:px-12 2xl:py-6 rounded-full border border-green-500/30 backdrop-blur-md">SCAN TO TIP THE HOST {EMOJI.tip}</div>
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
        <div className="public-tv fixed inset-0 z-[200] bg-zinc-900/95 flex flex-col items-center justify-center text-white font-saira p-3 md:p-6">
            <div className="w-[96%] md:w-[92%] max-w-6xl bg-black/55 border border-cyan-500/30 rounded-[2rem] 2xl:rounded-[2.5rem] p-4 md:p-6 2xl:p-10 shadow-[0_0_90px_rgba(34,211,238,0.25)]">
                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
                    <div>
                        <div className="text-xs md:text-sm uppercase tracking-[0.3em] md:tracking-[0.5em] text-zinc-400">BROSS Entertainment</div>
                        <div className="text-3xl md:text-5xl 2xl:text-7xl font-bebas text-cyan-300 tracking-[0.12em] md:tracking-widest mt-2">{HOW_TO_PLAY.title}</div>
                        <div className="text-sm md:text-lg 2xl:text-2xl text-zinc-400 mb-4 md:mb-8">{HOW_TO_PLAY.subtitle}</div>

                        <div className="bg-black/50 border border-white/10 rounded-3xl p-4 md:p-6 2xl:p-10">
                            <div className="text-2xl md:text-4xl 2xl:text-5xl font-bold text-pink-300 uppercase tracking-[0.08em] md:tracking-widest mb-4 md:mb-6">{active.title}</div>
                            <ul className="text-lg md:text-2xl 2xl:text-4xl text-zinc-100 space-y-2 md:space-y-3 2xl:space-y-5 leading-snug">
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
                        <img src={logoUrl || ASSETS.logo} className="h-16 md:h-20 2xl:h-24 object-contain" alt="BROSS" />
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-2 md:gap-3 text-xs md:text-sm uppercase tracking-[0.15em] md:tracking-widest text-zinc-300">
                                {queueRules.map(rule => (
                                    <div key={rule.label} className="flex items-center gap-2 bg-black/50 border border-white/10 px-3 py-2 rounded-full">
                                        <i className={`fa-solid ${rule.icon} text-cyan-300`}></i>
                                        {rule.label}
                                    </div>
                                ))}
                            </div>
                            <div className="bg-white p-2 md:p-3 rounded-2xl shadow-xl">
                                <LocalQrImage value={qrValue} size={192} alt="Join QR" className="w-36 h-36 md:w-44 md:h-44 2xl:w-56 2xl:h-56 object-cover" />
                            </div>
                        </div>
                        <div className="text-xs md:text-sm text-zinc-300 uppercase tracking-[0.2em] md:tracking-[0.4em]">Room {roomCode}</div>
                    </div>
                </div>

                <div className="mt-5 md:mt-8 flex items-center justify-between text-xs md:text-sm text-zinc-400">
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
        const start = room?.videoStartTimestamp ? (nowMs() - room.videoStartTimestamp) / 1000 : 0;
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
    const [lobbyPlayBursts, setLobbyPlayBursts] = useState([]);
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
    const [doodleNow, setDoodleNow] = useState(nowMs());
    const [doodleSubmissions, setDoodleSubmissions] = useState([]);
    const [doodleVotes, setDoodleVotes] = useState([]);
    const [roomUsers, setRoomUsers] = useState([]);
    const [stormPhase, setStormPhase] = useState('off');
    const [stormLayerMeters, setStormLayerMeters] = useState(() => makeStormLayerMeters());
    const [stormLayerEvents, setStormLayerEvents] = useState([]);
    const [showMarquee, setShowMarquee] = useState(false);
    const [marqueeIndex, setMarqueeIndex] = useState(-1);
    const [readyTimer, setReadyTimer] = useState(0);
    const [chatMessages, setChatMessages] = useState([]);
    const [showChatFeed, setShowChatFeed] = useState(false);
    const [lobbyPromptIndex, setLobbyPromptIndex] = useState(0);
    const [lobbyLiveEvents, setLobbyLiveEvents] = useState([]);
    const [bingoRngNow, setBingoRngNow] = useState(nowMs());
    const [bonusDropBurst, setBonusDropBurst] = useState(null);
    const [popTriviaVotes, setPopTriviaVotes] = useState([]);
    const [popTriviaNow, setPopTriviaNow] = useState(nowMs());
    const [viewportSize, setViewportSize] = useState(() => ({
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080
    }));
    
    const stormAudioRef = useRef(null);
    const stormAnalyserRef = useRef(null);
    const stormSourceRef = useRef(null);
    const stormRafRef = useRef(null);
    const stormFlashCooldownRef = useRef(0);
    const stormThunderRefs = useRef([]);
    const stormAnalyserUnavailableRef = useRef(false);
    const playStormLayerPulseRef = useRef(() => {});
    const triggerStormLightningRef = useRef(() => {});
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
    const bgVisualizerAudioRef = useRef(null);
    const multiplierRef = useRef(1);
    const chatFullscreenScrollRef = useRef(null);
    const chatSidebarScrollRef = useRef(null);
    const selfieVoteCounts = useMemo(() => {
        return selfieVotes.reduce((acc, v) => {
            acc[v.targetUid] = (acc[v.targetUid] || 0) + 1;
            return acc;
        }, {});
    }, [selfieVotes]);
    const groupedChatMessages = useMemo(
        () => groupChatMessages(chatMessages, { mergeWindowMs: 12 * 60 * 1000 }),
        [chatMessages]
    );
    const pushLobbyLiveEvent = useCallback((event) => {
        if (!event) return;
        const eventTs = Number(event.timestampMs || nowMs());
        setLobbyLiveEvents((prev) => {
            const next = [{ ...event, timestampMs: eventTs }, ...(prev || [])];
            return next
                .filter((entry) => (eventTs - Number(entry.timestampMs || 0)) < 90000)
                .slice(0, 12);
        });
    }, []);
    const doodleRequireReview = !!room?.doodleOke?.requireReview;
    const approvedDoodleUids = Array.isArray(room?.doodleOke?.approvedUids) ? room.doodleOke.approvedUids : [];
    const doodleApprovedUidSet = new Set(approvedDoodleUids.filter(Boolean));
    const doodleVisibleSubmissions = useMemo(() => {
        if (!doodleRequireReview) return doodleSubmissions;
        return doodleSubmissions.filter((submission) => doodleApprovedUidSet.has(submission.uid));
    }, [doodleRequireReview, doodleApprovedUidSet, doodleSubmissions]);
    const doodlePendingReviewCount = Math.max(0, doodleSubmissions.length - doodleVisibleSubmissions.length);
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
        rocket: 'animate-rocket-fly text-[clamp(2.75rem,9vw,8rem)]', 
        diamond: 'animate-diamond-shine text-[clamp(3rem,9.5vw,9rem)]', 
        crown: 'animate-crown-bounce text-[clamp(3.25rem,10vw,10rem)]', 
        money: 'animate-money-wobble text-[clamp(3rem,9.5vw,9rem)]', 
        drink: 'animate-drink-sway text-[clamp(2.5rem,8vw,6rem)]',
        fire: 'animate-fire-flicker text-[clamp(2.5rem,8vw,6rem)] drop-shadow-[0_0_15px_orange]',
        heart: 'animate-heart-beat text-[clamp(2.5rem,8vw,6rem)] drop-shadow-[0_0_15px_red]',
        clap: 'animate-clap-shake text-[clamp(2.5rem,8vw,6rem)]'
    }[t] || 'animate-float text-[clamp(2rem,6vw,4rem)]');

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const updateViewport = () => {
            setViewportSize({
                width: window.innerWidth || 1920,
                height: window.innerHeight || 1080
            });
        };
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    useEffect(() => {
        multiplierRef.current = Math.max(1, room?.multiplier || 1);
    }, [room?.multiplier]);

    const awardRoomPointsOnce = useCallback(async ({ awardKey, awards = [], source = 'tv_mode' }) => {
        if (!roomCode || !awardKey || !Array.isArray(awards) || !awards.length) return;
        try {
            await callFunction('awardRoomPoints', {
                roomCode,
                awardKey,
                source,
                awards
            });
        } catch (err) {
            tvLogger.debug('awardRoomPoints callable failed', awardKey, err?.message || err);
        }
    }, [roomCode]);

    const startAudio = async () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            await ctx.resume();
            setAudioCtx(ctx);
            setStarted(true);
        } catch(e) { tvLogger.error("Audio Context Failed", e); }
    };

    const getStormPhase = () => {
        if (room?.lightMode !== 'storm') return 'off';
        if (!room?.stormStartedAt) return room?.stormPhase || 'approach';
        const cfg = room?.stormConfig || { approachMs: 15000, peakMs: 20000, passMs: 12000, clearMs: 6000 };
        const elapsed = nowMs() - room.stormStartedAt;
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
        const tick = () => setDoodleNow(nowMs());
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
        if (!doodleVisibleSubmissions.length) return;
        const voteCounts = doodleVotes.reduce((acc, v) => {
            acc[v.targetUid] = (acc[v.targetUid] || 0) + 1;
            return acc;
        }, {});
        const sorted = [...doodleVisibleSubmissions].sort((a, b) => (voteCounts[b.uid] || 0) - (voteCounts[a.uid] || 0));
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
        updateDoc(roomRef, { doodleOke: { ...room.doodleOke, winner: winnerPayload, winnerAwardedAt: nowMs() } })
            .catch((e) => tvLogger.error('Doodle winner update failed', e));
        awardRoomPointsOnce({
            awardKey: `doodle_${roomCode}_${promptId}`,
            source: 'doodle_oke',
            awards: [{ uid: winner.uid, points }]
        });
        doodleWinnerAwardRef.current = promptId;
    }, [room?.activeMode, room?.doodleOke, doodleVisibleSubmissions, doodleVotes, roomCode, awardRoomPointsOnce]);

    const getStormAmbientUrl = useCallback(() => {
        if (stormPhase === 'approach') return STORM_SFX.lightRain;
        if (stormPhase === 'peak') return STORM_SFX.stormLoop;
        if (stormPhase === 'pass') return STORM_SFX.bigDrops;
        if (stormPhase === 'clear') return STORM_SFX.lightRain;
        return STORM_SFX.lightRain;
    }, [stormPhase]);

    const [stormFlash, setStormFlash] = useState(false);
    const triggerStormLightning = useCallback(() => {
        const now = nowMs();
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
    }, [stormPhase]);

    const playStormLayerPulse = useCallback((layerId, intensity = 1) => {
        if (!audioCtx) return;
        const ctx = audioCtx;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const safeIntensity = Math.max(0.65, Math.min(1.8, Number(intensity) || 1));
        const scheduleTone = (freq, type, volume, decay, offset = 0) => {
            const startAt = now + offset;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(Math.max(40, Number(freq) || 180), startAt);
            gain.gain.setValueAtTime(0.0001, startAt);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0008, volume * safeIntensity), startAt + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, startAt + Math.max(0.03, decay));
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startAt);
            osc.stop(startAt + Math.max(0.05, decay + 0.04));
        };
        switch (layerId) {
            case 'snap':
                scheduleTone(1950, 'square', 0.045, 0.03);
                break;
            case 'tap':
                scheduleTone(210, 'triangle', 0.06, 0.11);
                break;
            case 'stomp':
                scheduleTone(90, 'sine', 0.1, 0.24);
                scheduleTone(165, 'triangle', 0.055, 0.18, 0.03);
                break;
            case 'clap':
            default:
                scheduleTone(880, 'square', 0.055, 0.045, 0);
                scheduleTone(1120, 'square', 0.04, 0.04, 0.025);
                scheduleTone(780, 'triangle', 0.035, 0.05, 0.06);
                break;
        }
    }, [audioCtx]);

    useEffect(() => {
        playStormLayerPulseRef.current = playStormLayerPulse;
    }, [playStormLayerPulse]);

    useEffect(() => {
        triggerStormLightningRef.current = triggerStormLightning;
    }, [triggerStormLightning]);

    const startStormAnalyser = useCallback(() => {
        if (!audioCtx || !stormAudioRef.current) return;
        if (stormAnalyserUnavailableRef.current) return;
        if (stormAnalyserRef.current) return;
        const sourceUrl = stormAudioRef.current.currentSrc || stormAudioRef.current.src || '';
        if (typeof window !== 'undefined' && sourceUrl) {
            try {
                const mediaUrl = new URL(sourceUrl, window.location.origin);
                if (mediaUrl.origin !== window.location.origin) {
                    // Cross-origin media without CORS cannot feed WebAudio analyser safely.
                    stormAnalyserUnavailableRef.current = true;
                    tvLogger.debug('Skipping storm analyser for cross-origin media', mediaUrl.href);
                    return;
                }
            } catch {
                // If URL parsing fails, continue and let browser handle it.
            }
        }
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
    }, [audioCtx, stormPhase, triggerStormLightning]);

    const stopStormAnalyser = useCallback(() => {
        if (stormRafRef.current) cancelAnimationFrame(stormRafRef.current);
        stormRafRef.current = null;
    }, []);

    const stopStormAudio = useCallback(() => {
        const storm = stormAudioRef.current;
        if (storm) {
            storm.pause();
            storm.currentTime = 0;
        }
        stormThunderRefs.current.forEach((fx) => {
            if (!fx) return;
            fx.pause();
            fx.currentTime = 0;
        });
        stopStormAnalyser();
    }, [stopStormAnalyser]);

    // --- EFFECT: Storm Sound ---
    useEffect(() => {
        if (!started) {
            stopStormAudio();
            return;
        }
        if (!stormAudioRef.current) {
            stormAudioRef.current = new Audio(getStormAmbientUrl());
            stormAudioRef.current.crossOrigin = 'anonymous';
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
                stormAnalyserUnavailableRef.current = false;
            }
            const phaseVolume = {
                approach: 0.35,
                peak: 0.75,
                pass: 0.45,
                clear: 0.2
            }[stormPhase] || 0.5;
            storm.volume = phaseVolume;
            storm.play().catch(e => tvLogger.debug('Storm audio blocked', e));
            startStormAnalyser();
        } else {
            stopStormAudio();
        }
    }, [room?.lightMode, stormPhase, started, getStormAmbientUrl, startStormAnalyser, stopStormAudio]);

    useEffect(() => () => {
        stopStormAudio();
    }, [stopStormAudio]);

    useEffect(() => {
        if (!started || room?.lightMode !== 'storm') return;
        if (stormAnalyserRef.current) return;
        const id = setInterval(() => {
            triggerStormLightning();
        }, 2500);
        return () => clearInterval(id);
    }, [started, room?.lightMode, triggerStormLightning]);

    useEffect(() => {
        if (room?.lightMode !== 'storm') {
            setStormLayerMeters(makeStormLayerMeters());
            setStormLayerEvents([]);
            return () => {};
        }
        const decayTimer = setInterval(() => {
            setStormLayerMeters((prev) => ({
                snap: Math.max(0, Number(prev?.snap || 0) - 3),
                tap: Math.max(0, Number(prev?.tap || 0) - 3),
                stomp: Math.max(0, Number(prev?.stomp || 0) - 4),
                clap: Math.max(0, Number(prev?.clap || 0) - 3)
            }));
            setStormLayerEvents((prev) => prev.filter((event) => (nowMs() - Number(event?.timestampMs || 0)) < 15000));
        }, 280);
        return () => clearInterval(decayTimer);
    }, [room?.lightMode]);

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
                    if(nowMs() - (d.timestamp?.seconds * 1000 || nowMs()) < 5000) {
                        if (typeof d.type === 'string' && d.type.startsWith('vote_')) {
                            return;
                        }
                        if (d.type === 'photo') {
                            setPhotoOverlay(d); 
                            setTimeout(() => setPhotoOverlay(null), 8000); // Show photo for 8s
                            pushLobbyLiveEvent({
                                id: `photo-${c.doc.id}`,
                                avatar: d.avatar || EMOJI.camera,
                                user: d.userName || d.user || 'Guest',
                                text: 'shared a selfie',
                                timestampMs: nowMs()
                            });
                        } else if (getLobbyPlayEffect(d.type)) {
                            const effect = getLobbyPlayEffect(d.type);
                            const burstTime = nowMs();
                            const count = Math.max(1, Number(d.count || 1));
                            setLobbyPlayBursts((prev) => {
                                const additions = Array.from({ length: Math.min(3, count) }, (_, idx) => ({
                                    id: `lobby-play-${c.doc.id}-${idx}`,
                                    label: effect.label,
                                    icon: effect.icon,
                                    accent: effect.accent,
                                    user: d.userName || d.user || 'Guest',
                                    createdAt: burstTime + idx,
                                    left: Math.random() * 70 + 15,
                                    top: Math.random() * 45 + 24
                                }));
                                return [...additions, ...(prev || [])].slice(0, 20);
                            });
                            pushLobbyLiveEvent({
                                id: `lobby-play-live-${c.doc.id}`,
                                avatar: d.avatar || effect.icon,
                                user: d.userName || d.user || 'Guest',
                                text: `triggered ${effect.label.toLowerCase()}`,
                                timestampMs: burstTime
                            });
                        } else if (d.type === 'storm_layer') {
                            const layerId = normalizeStormLayer(d.layer || d.stormLayer || d.reactionLayer);
                            const layerMeta = STORM_CROWD_LAYERS.find((layer) => layer.id === layerId) || STORM_CROWD_LAYERS[3];
                            const totalCount = Math.max(1, Number(d.count || 1));
                            const eventTimestamp = nowMs();
                            const eventEntry = {
                                id: `storm-${c.doc.id}`,
                                layer: layerId,
                                layerLabel: layerMeta.label,
                                count: totalCount,
                                user: d.userName || d.user || 'Guest',
                                avatar: d.avatar || layerMeta.icon,
                                timestampMs: eventTimestamp
                            };
                            setStormLayerMeters((prev) => {
                                const next = { ...makeStormLayerMeters(), ...(prev || {}) };
                                next[layerId] = Math.min(100, Number(next[layerId] || 0) + (totalCount * (layerId === 'stomp' ? 13 : 10)));
                                return next;
                            });
                            setStormLayerEvents((prev) => [eventEntry, ...(prev || [])].slice(0, 28));
                            const playCount = Math.min(totalCount, 3);
                            for (let i = 0; i < playCount; i += 1) {
                                playStormLayerPulseRef.current(layerId, 0.85 + (totalCount * 0.16) + (i * 0.08));
                            }
                            if ((layerId === 'stomp' || layerId === 'clap') && Math.random() < (layerId === 'stomp' ? 0.55 : 0.28)) {
                                triggerStormLightningRef.current();
                            }
                            pushLobbyLiveEvent({
                                id: `storm-live-${c.doc.id}`,
                                avatar: d.avatar || layerMeta.icon,
                                user: d.userName || d.user || 'Guest',
                                text: `added ${layerMeta.label.toLowerCase()}${totalCount > 1 ? ` x${totalCount}` : ''}`,
                                timestampMs: eventTimestamp
                            });
                        } else if (d.type === 'strum') {
                            pushLobbyLiveEvent({
                                id: `strum-${c.doc.id}`,
                                avatar: d.avatar || EMOJI.guitar,
                                user: d.userName || d.user || 'Guest',
                                text: `sent ${Math.max(1, Number(d.count || 1))} ${getLobbyReactionLabel('strum').toLowerCase()}${Number(d.count || 1) > 1 ? 's' : ''}`,
                                timestampMs: nowMs()
                            });
                            // Guitar strums are reflected in the live guitar leaderboard instead.
                        } else {
                              const count = Math.min(d.count || 1, 6);
                              const totalCount = d.count || 1;
                              const val = REACTION_COSTS[d.type] || 5;
                              const totalVal = val * totalCount;
                              const multiplier = multiplierRef.current;
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
                              lastHypeAtRef.current = nowMs();
                              setShowHypeMeter(true);
                              pushLobbyLiveEvent({
                                  id: `reaction-${c.doc.id}`,
                                  avatar: d.avatar || EMOJI.sparkle,
                                  user: d.userName || d.user || 'Guest',
                                  text: `sent ${getLobbyReactionLabel(d.type).toLowerCase()}${Number(totalCount || 1) > 1 ? ` x${totalCount}` : ''}`,
                                  timestampMs: nowMs()
                              });
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
                    if(nowMs() - (d.timestamp?.seconds * 1000 || nowMs()) < 10000) {
                        lastRealMessageAt.current = nowMs();
                        setMessages(prev => [...prev, d]);
                        const timeoutId = setTimeout(() => setMessages(p => p.filter(m => m !== d)), 15000);
                        messageTimeoutsRef.current.push(timeoutId);
                    }
                }
            });
        });

        return () => {
            unsubRoom();
            unsubSongs();
            unsubReact();
            unsubMsg();
            unsubActivity();
            unsubVibe();
            messageTimeoutsRef.current.forEach(t => clearTimeout(t));
            messageTimeoutsRef.current = [];
        };
    }, [roomCode, pushLobbyLiveEvent]);

    useEffect(() => {
        if (!roomCode || !room?.chatShowOnTv) {
            setChatMessages([]);
            return () => {};
        }
        const unsubChat = onSnapshot(query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'),
            where('roomCode', '==', roomCode),
            orderBy('timestamp', 'desc'),
            limit(20)
        ), s => {
            const visibleMessages = s.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .reverse()
                .filter(isTvVisibleChatMessage);
            setChatMessages(visibleMessages);
        });
        return () => unsubChat();
    }, [roomCode, room?.chatShowOnTv]);

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
        if (tvMode === 'fullscreen') {
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
        const fullNode = chatFullscreenScrollRef.current;
        if (fullNode) fullNode.scrollTop = fullNode.scrollHeight;
        if (showChatFeed) {
            const sidebarNode = chatSidebarScrollRef.current;
            if (sidebarNode) sidebarNode.scrollTop = sidebarNode.scrollHeight;
        }
    }, [groupedChatMessages, showChatFeed]);

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
                timestamp: nowMs(),
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
                    requestedAt: nowMs()
                }
            }).catch(() => {});
            awardRoomPointsOnce({
                awardKey: `guitar_${roomCode}_${sessionId}`,
                source: 'guitar_mode',
                awards: [{ uid: winner.uid, points: payload.rewardPoints || 200 }]
            });
            addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), {
                roomCode,
                user: winner.name,
                text: `shredded the hardest (${winner.guitarHits} hits)`,
                icon: EMOJI.guitar,
                timestamp: serverTimestamp()
            }).catch(() => {});
        }
    }, [room, roomCode, vibeUsers, room?.guitarWinner?.sessionId, awardRoomPointsOnce]);

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
            timestamp: nowMs(),
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
                requestedAt: nowMs()
            }
        }).catch(() => {});
        awardRoomPointsOnce({
            awardKey: `guitar_${roomCode}_${sessionId}`,
            source: 'guitar_mode',
            awards: [{ uid: winner.uid, points: payload.rewardPoints || 200 }]
        });
    }, [room?.lightMode, room?.guitarSessionId, room?.guitarVictory?.status, room?.guitarWinner?.sessionId, roomCode, vibeUsers, awardRoomPointsOnce]);

    useEffect(() => {
        if (room?.lightMode === 'strobe') return;
        const sessionId = room?.strobeSessionId;
        if (!sessionId || !room?.strobeEndsAt) return;
        if (nowMs() < room.strobeEndsAt) return;
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
        const strobeAwards = winners.map((entry, idx) => ({
            uid: entry.uid,
            points: rewards[idx] || 0
        })).filter((entry) => entry.uid && entry.points > 0);

        updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
            strobeWinner: { ...winner, sessionId },
            strobeResults: { sessionId, winners, rewards, awardedAt: nowMs() },
            strobeVictory: { ...winner, sessionId, status: 'pending', id: `${sessionId}` }
        }).catch(() => {});
        awardRoomPointsOnce({
            awardKey: `strobe_${roomCode}_${sessionId}`,
            source: 'strobe_mode',
            awards: strobeAwards
        });
    }, [room?.lightMode, room?.strobeSessionId, room?.strobeEndsAt, room?.strobeResults?.sessionId, roomCode, roomUsers, awardRoomPointsOnce]);

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
            const now = nowMs();
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
        const start = room.readyCheck.startTime || nowMs();
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((durationMs - (nowMs() - start)) / 1000));
            setReadyTimer(remaining);
        };
        tick();
        const interval = setInterval(tick, 200);
        return () => clearInterval(interval);
    }, [room?.readyCheck?.active, room?.readyCheck?.startTime, room?.readyCheck?.durationSec]);

    useEffect(() => {
        const activeScreen = room?.activeScreen;
        if (!activeScreen || activeScreen === 'stage') return undefined;
        if (!['leaderboard', 'tipping'].includes(activeScreen)) return undefined;
        const timer = setTimeout(() => {
            updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { activeScreen: 'stage' })
                .catch((err) => tvLogger.debug('[TV] auto close activeScreen failed', err));
        }, ACTIVE_SCREEN_AUTO_CLOSE_MS);
        return () => clearTimeout(timer);
    }, [room?.activeScreen, roomCode]);

    useEffect(() => {
        if (!room?.howToPlay?.active) return undefined;
        const startedAt = Number(room?.howToPlay?.id || nowMs());
        const remainingMs = Math.max(3000, HOW_TO_PLAY_AUTO_CLOSE_MS - (nowMs() - startedAt));
        const timer = setTimeout(() => {
            updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
                howToPlay: { active: false, id: nowMs() }
            }).catch((err) => tvLogger.debug('[TV] auto close howToPlay failed', err));
        }, remainingMs);
        return () => clearTimeout(timer);
    }, [room?.howToPlay?.active, room?.howToPlay?.id, roomCode]);

    useEffect(() => {
        if (!room?.bingoMysteryRng?.active && !room?.bingoMysteryRng?.finalized) return;
        const timer = setInterval(() => setBingoRngNow(nowMs()), 250);
        return () => clearInterval(timer);
    }, [room?.bingoMysteryRng?.active, room?.bingoMysteryRng?.finalized]);

    // Allow host-triggered photo overlays from the room document
    useEffect(() => {
        if (!room?.photoOverlay?.url) return;
        setPhotoOverlay(room.photoOverlay);
        const t = setTimeout(() => setPhotoOverlay(null), 8000);
        return () => clearTimeout(t);
    }, [room?.photoOverlay?.url, room?.photoOverlay?.timestamp, room?.photoOverlay]);
    useEffect(() => {
        const drop = room?.bonusDrop;
        if (!drop?.id) return;
        if (lastBonusDropRef.current === drop.id) return;
        lastBonusDropRef.current = drop.id;
        setBonusDropBurst({ ...drop });
        const t = setTimeout(() => setBonusDropBurst(null), 6000);
        return () => clearTimeout(t);
    }, [room?.bonusDrop?.id, room?.bonusDrop]);

    // --- EFFECT: Loop & Logic ---
    useEffect(() => { comboRef.current = combo; }, [combo]);
    useEffect(() => {
        const i = setInterval(() => {
            setReactions(prev => prev.filter(r => nowMs() - (r.timestamp?.seconds * 1000 || nowMs()) < 4000));
            setLobbyPlayBursts((prev) => prev.filter((burst) => (nowMs() - Number(burst?.createdAt || 0)) < 2800));
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
                const idleMs = nowMs() - (lastHypeAtRef.current || 0);
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
            karaoke_bracket: 'Sweet 16 Bracket',
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
            const timeSinceEnd = nowMs() - lastTs;
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
    }, [room?.lastPerformance, room?.activeMode, room?.activeScreen, recap]);

    useEffect(() => {
        if (!room?.recapPreview?.timestamp) return;
        const previewTs = getTimestampMs(room.recapPreview.timestamp);
        if (!previewTs) return;
        if (recapPreviewRef.current === previewTs) return;
        recapPreviewRef.current = previewTs;
        setRecap(room.recapPreview);
        const t = setTimeout(() => setRecap(null), 10000);
        return () => clearTimeout(t);
    }, [room?.recapPreview?.timestamp, room?.recapPreview]);

    const triggerTipPulse = useCallback((key) => {
        if (!room?.tipUrl && !room?.tipQrUrl) return;
        if (lastTipKey.current === key) return;
        lastTipKey.current = key;
        setTipPulse(true);
        if (tipPulseTimer.current) clearTimeout(tipPulseTimer.current);
        tipPulseTimer.current = setTimeout(() => setTipPulse(false), 9000);
    }, [room?.tipUrl, room?.tipQrUrl]);
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
            tvLogger.error('[TV] closeExperience failed', err);
        }
    };

    // Applause Sequence
    useEffect(() => {
        if (room?.activeMode === 'applause_countdown' && applauseStep === 'idle') { 
            setApplauseStep('countdown'); setCountdown(3); setApplauseMax(0); 
        } 
    }, [room?.activeMode, applauseStep]);
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
                triggerTipPulse(`applause-${nowMs()}`);
                updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { applausePeak: applauseMax, activeMode: 'applause_result' }); 
                if (applauseResetRef.current) clearTimeout(applauseResetRef.current);
                applauseResetRef.current = setTimeout(() => { 
                    setApplauseStep('idle'); 
                    updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { activeMode: 'karaoke' }); 
                }, 5000); 
            } 
        } 
        return () => clearTimeout(timer); 
    }, [applauseStep, countdown, measure, applauseMax, roomCode, triggerTipPulse]);

    const current = songs.find(s => s.status === 'performing');
    const popTriviaRoundSec = Math.max(8, Number(room?.popTriviaRoundSec || DEFAULT_POP_TRIVIA_ROUND_SEC));
    const popTriviaState = useMemo(() => {
        if (room?.activeMode !== 'karaoke') return null;
        if (room?.popTriviaEnabled === false) return null;
        if (!current) return null;
        return getActivePopTriviaQuestion({
            song: current,
            now: popTriviaNow,
            roundSec: popTriviaRoundSec
        });
    }, [current, popTriviaNow, popTriviaRoundSec, room?.activeMode, room?.popTriviaEnabled]);
    const popTriviaQuestion = popTriviaState?.question || null;
    const popTriviaQuestionId = popTriviaQuestion?.id || '';
    const popTriviaVoteCounts = useMemo(() => {
        const count = Array.from({ length: popTriviaQuestion?.options?.length || 0 }, () => 0);
        popTriviaVotes.forEach((vote) => {
            const idx = Number(vote?.val);
            if (!Number.isInteger(idx)) return;
            if (idx < 0 || idx >= count.length) return;
            count[idx] += 1;
        });
        return count;
    }, [popTriviaVotes, popTriviaQuestion?.options?.length]);
    const popTriviaTotalVotes = popTriviaVoteCounts.reduce((sum, val) => sum + val, 0);
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
    }, [room?.marqueeEnabled, room?.marqueeDurationMs, room?.marqueeIntervalMs, room?.marqueeShowMode, room?.activeMode, messages.length, marqueeItems.length, current?.id, current]);
    useEffect(() => {
        if (room?.activeMode !== 'karaoke') return;
        if (room?.popTriviaEnabled === false) return;
        if (!current?.id || !Array.isArray(current?.popTrivia) || current.popTrivia.length === 0) return;
        setPopTriviaNow(nowMs());
        const timer = setInterval(() => setPopTriviaNow(nowMs()), 1000);
        return () => clearInterval(timer);
    }, [current?.id, current?.popTrivia, room?.activeMode, room?.popTriviaEnabled]);
    useEffect(() => {
        if (!roomCode || !popTriviaQuestionId) {
            setPopTriviaVotes([]);
            return () => {};
        }
        const voteQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'),
            where('roomCode', '==', roomCode),
            where('questionId', '==', popTriviaQuestionId)
        );
        const unsub = onSnapshot(voteQuery, (snap) => {
            const entries = dedupeQuestionVotes(
                snap.docs.map((docSnap) => docSnap.data()),
                POP_TRIVIA_VOTE_TYPE
            );
            setPopTriviaVotes(entries);
        });
        return () => unsub();
    }, [roomCode, popTriviaQuestionId]);

    const handleVolume = (vol) => {
        const level = Math.min(100, Math.round(vol / 1.5));
        setMicVolume(level);
        if (applauseStep === 'measuring') {
            if (level > applauseMax) setApplauseMax(level);
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
    const spotlightTopTight15 = extractTopTight15({
        spotlightPayload: room?.spotlightUser || null,
        roomUser: spotlightUser || null
    });
    const lobbyWarmupMode = !current
        && allQueue.length === 0
        && (!room?.activeMode || room.activeMode === 'karaoke');
    const lobbyPrompt = LOBBY_PLAYGROUND_PROMPTS[lobbyPromptIndex % LOBBY_PLAYGROUND_PROMPTS.length];
    const lobbyMembers = [...roomUsers]
        .sort((a, b) => getTimestampMs(b?.lastActiveAt) - getTimestampMs(a?.lastActiveAt))
        .slice(0, 10);
    const lobbyJoinEvents = activities
        .filter((entry) => /joined the party/i.test(String(entry?.text || '')))
        .map((entry, idx) => ({
            id: `join-${idx}-${getTimestampMs(entry?.timestamp)}`,
            avatar: entry?.icon || EMOJI.wave,
            user: entry?.user || 'Guest',
            text: 'joined the lobby',
            timestampMs: getTimestampMs(entry?.timestamp)
        }));
    const lobbyEventFeed = [...lobbyLiveEvents, ...lobbyJoinEvents]
        .filter((entry) => (nowMs() - Number(entry?.timestampMs || 0)) < 90000)
        .sort((a, b) => Number(b?.timestampMs || 0) - Number(a?.timestampMs || 0))
        .slice(0, 8);
    useEffect(() => {
        if (!lobbyWarmupMode) {
            setLobbyPromptIndex(0);
            return;
        }
        const interval = setInterval(() => {
            setLobbyPromptIndex((prev) => (prev + 1) % LOBBY_PLAYGROUND_PROMPTS.length);
        }, 9000);
        return () => clearInterval(interval);
    }, [lobbyWarmupMode]);

    const bgClass = multiplier >= 4 ? 'bg-gradient-to-br from-pink-900 via-purple-900 to-indigo-900 animate-pulse' : 
                    multiplier >= 2 ? 'bg-gradient-to-br from-blue-900 to-black' : 
                    'bg-black';
    const waveformOpacity = current ? 'opacity-50' : 'opacity-95';
    const {
        bgVisualizerSimulatedLevel,
        shouldUseBgMediaElement,
        visualizerEnabled,
        visualizerInputMode,
        visualizerResolvedPreset,
        visualizerSensitivity,
        visualizerSmoothing
    } = useTvVisualizerSettings({
        room,
        started,
        bgVisualizerAudioRef,
        logger: tvLogger
    });
    // eslint-disable-next-line react-hooks/refs
    const visualizerSourceElement = shouldUseBgMediaElement ? bgVisualizerAudioRef.current : null;
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
        ? (nowMs() < strobeCountdownUntil ? 'countdown' : nowMs() < strobeEndsAt ? 'active' : 'ended')
        : 'off';
    const strobeCountdown = Math.max(0, Math.ceil((strobeCountdownUntil - nowMs()) / 1000));
    const strobeRemaining = Math.max(0, Math.ceil((strobeEndsAt - nowMs()) / 1000));
    const strobeMeter = Math.min(100, Math.round(strobeTotalTaps * 2));
    const reactionBurstScore = clampPct(reactions.length * 12);
    const strobeEngagementScore = clampPct((strobeMeter * 0.75) + (strobeLeaders.length * 8));
    const guitarPeakHits = guitarLeaders.length
        ? Math.max(...guitarLeaders.map((user) => Number(user.guitarHits || 0)))
        : 0;
    const guitarEngagementScore = clampPct((guitarPeakHits * 4) + (guitarLeaders.length * 10));
    const bangerHeatScore = clampPct((combo * 0.72) + (reactionBurstScore * 0.6));
    const balladGlowScore = clampPct((combo * 0.55) + ((groupedChatMessages?.length || 0) * 12));
    const stormLayerTotal = STORM_CROWD_LAYERS.reduce((sum, layer) => sum + Number(stormLayerMeters?.[layer.id] || 0), 0);
    const stormLayerIntensity = clampPct(stormLayerTotal / Math.max(1, STORM_CROWD_LAYERS.length));
    const stormRecentLayerEvents = stormLayerEvents
        .filter((event) => (nowMs() - Number(event?.timestampMs || 0)) < 16000)
        .slice(0, 6);
    const stormLayerLeaders = useMemo(() => {
        const totals = new Map();
        stormRecentLayerEvents.forEach((event) => {
            const key = event.user || 'Guest';
            if (!totals.has(key)) {
                totals.set(key, {
                    user: key,
                    avatar: event.avatar || EMOJI.sparkle,
                    total: 0
                });
            }
            const item = totals.get(key);
            item.total += Math.max(1, Number(event.count || 1));
        });
        return [...totals.values()]
            .sort((a, b) => b.total - a.total)
            .slice(0, 3);
    }, [stormRecentLayerEvents]);
    const stormBase = stormPhase === 'peak'
        ? 78
        : stormPhase === 'pass'
            ? 58
            : stormPhase === 'approach'
                ? 42
                : stormPhase === 'clear'
                    ? 24
                    : 0;
    const stormChargeScore = clampPct((stormBase * 0.52) + (combo * 0.2) + (stormLayerIntensity * 0.28));
    const motionSafeFx = !!room?.reduceMotionFx;
    const bangerParticleCount = motionSafeFx ? 8 : 15;
    const balladParticleCount = motionSafeFx ? 4 : 6;
    const particleSeedBase = useMemo(
        () => String(roomCode || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) || 1,
        [roomCode]
    );
    const bangerParticlePool = useMemo(
        () => [EMOJI.fire, emoji(0x1F692), emoji(0x1F9D1, 0x200D, 0x1F692), emoji(0x1F9EF), emoji(0x1F9E8)],
        []
    );
    const bangerParticles = useMemo(
        () => Array.from({ length: bangerParticleCount }, (_, idx) => ({
            id: `banger-fire-${idx}`,
            left: `${Math.round(seededUnit(particleSeedBase + idx * 17) * 1000) / 10}%`,
            animationDelay: `${(seededUnit(particleSeedBase + idx * 29) * 2).toFixed(2)}s`,
            icon: bangerParticlePool[Math.floor(seededUnit(particleSeedBase + idx * 41) * bangerParticlePool.length)] || EMOJI.fire
        })),
        [bangerParticleCount, bangerParticlePool, particleSeedBase]
    );
    const balladParticles = useMemo(
        () => Array.from({ length: balladParticleCount }, (_, idx) => ({
            id: `ballad-fire-${idx}`,
            left: `${Math.round(seededUnit(particleSeedBase + idx * 13) * 1000) / 10}%`,
            animationDelay: `${(seededUnit(particleSeedBase + idx * 23) * 2.5).toFixed(2)}s`,
            animationDuration: `${(1.8 + seededUnit(particleSeedBase + idx * 31) * 1.6).toFixed(2)}s`
        })),
        [balladParticleCount, particleSeedBase]
    );
    const appBase = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
    const joinUrl = `${appBase}?room=${roomCode}`;
    const joinUrlDisplay = joinUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const joinUrlPieces = joinUrlDisplay.split('?');
    const joinUrlBaseDisplay = joinUrlPieces[0];
    const joinUrlQueryDisplay = joinUrlPieces[1] ? `?${joinUrlPieces[1]}` : `?room=${roomCode}`;
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
        flappy_bird: 'Flappy Bird',
        karaoke_bracket: 'Sweet 16 Bracket'
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
                        : `Soft limit: ${queueLimitCount}/night`,
            shortLabel: queueLimitMode === 'none' || queueLimitCount <= 0
                ? 'No Limits'
                : queueLimitMode === 'per_hour'
                    ? `${queueLimitCount}/Hour`
                    : `${queueLimitCount}/Night`
        },
        {
            icon: queueRotation === 'round_robin' ? 'fa-rotate-right' : 'fa-list',
            label: queueRotation === 'round_robin' ? 'Round robin' : 'First come',
            shortLabel: queueRotation === 'round_robin' ? 'Round Robin' : 'First Come'
        },
        {
            icon: queueFirstTimeBoost ? 'fa-star' : 'fa-user',
            label: queueFirstTimeBoost ? 'First-time boost' : 'No boost',
            shortLabel: queueFirstTimeBoost ? 'Boost On' : 'Boost Off'
        }
    ];

    const recapTs = recap ? getTimestampMs(recap.timestamp) : 0;
    const recapPulseKey = recap ? `recap-${recapTs || recap.songTitle || 'recap'}` : '';

    useEffect(() => {
        if (!recapPulseKey) return;
        triggerTipPulse(recapPulseKey);
    }, [recapPulseKey, triggerTipPulse]);
    const hasMarqueeContent = (marqueeItems.length > 0) || messages.length > 0;
    const isShortViewport = viewportSize.height <= 820;
    const isVeryShortViewport = viewportSize.height <= 700;
    const tvOverflowClass = isShortViewport
        ? 'overflow-x-hidden overflow-y-auto'
        : 'overflow-x-hidden overflow-y-auto lg:overflow-hidden';
    const logoSizeClass = isVeryShortViewport
        ? 'w-24 sm:w-32 md:w-40 lg:w-44 2xl:w-64'
        : isShortViewport
            ? 'w-24 sm:w-36 md:w-44 lg:w-52 2xl:w-72'
            : 'w-28 sm:w-40 md:w-48 lg:w-56 2xl:w-80';
    const reserveMarqueeSpace = showMarquee && hasMarqueeContent;
    const gridSpacingClass = isShortViewport
        ? 'gap-2 md:gap-3 2xl:gap-4 p-2 md:p-3 2xl:p-4'
        : 'gap-3 md:gap-4 2xl:gap-6 p-3 md:p-4 2xl:p-6';
    const gridTopPaddingClass = isVeryShortViewport
        ? 'pt-10'
        : isShortViewport
            ? 'pt-12 md:pt-14'
            : 'pt-14 md:pt-16 2xl:pt-24';
    const gridBottomPaddingClass = reserveMarqueeSpace
        ? (isVeryShortViewport ? 'pb-12' : isShortViewport ? 'pb-14 md:pb-16' : 'pb-16 md:pb-20 2xl:pb-24')
        : (isVeryShortViewport ? 'pb-2' : isShortViewport ? 'pb-3 md:pb-4' : 'pb-4 md:pb-5 2xl:pb-6');
    const stageMinHeightClass = isVeryShortViewport
        ? 'min-h-[34vh] md:min-h-[40vh]'
        : isShortViewport
            ? 'min-h-[38vh] md:min-h-[44vh]'
            : 'min-h-[42vh] md:min-h-[50vh]';
    const sidebarGapClass = isShortViewport ? 'gap-1.5 pb-1' : 'gap-2 pb-2';
    const joinQrSize = isVeryShortViewport ? 132 : isShortViewport ? 152 : 176;
    const joinQrClass = isVeryShortViewport
        ? 'w-[108px] h-[108px] md:w-[124px] md:h-[124px] 2xl:w-[168px] 2xl:h-[168px]'
        : isShortViewport
            ? 'w-[120px] h-[120px] md:w-[140px] md:h-[140px] 2xl:w-[196px] 2xl:h-[196px]'
            : 'w-[132px] h-[132px] md:w-[160px] md:h-[160px] 2xl:w-[220px] 2xl:h-[220px]';
    const marqueeHeightClass = isVeryShortViewport ? 'h-14 md:h-16' : isShortViewport ? 'h-16 md:h-20' : 'h-20 md:h-28 2xl:h-36';
    const marqueeTextSize = isVeryShortViewport
        ? 'clamp(1.5rem, 2.8vw, 2.4rem)'
        : isShortViewport
            ? 'clamp(1.8rem, 3.2vw, 3.2rem)'
            : 'clamp(2.5rem, 4vw, 5rem)';
    const marqueeUserSize = isVeryShortViewport
        ? 'clamp(0.95rem, 1.8vw, 1.9rem)'
        : isShortViewport
            ? 'clamp(1.05rem, 2vw, 2.3rem)'
            : 'clamp(1.2rem, 2.4vw, 3rem)';
    const isDistanceConstrained = viewportSize.width <= 1680 || viewportSize.height <= 900;
    const showVerboseJoinUrl = viewportSize.width >= 1900 && !isShortViewport;
    const showExtendedSpotlightMeta = viewportSize.width >= 1760 && !isShortViewport;
    const chatTvFullscreenActive = !!room?.chatShowOnTv && room?.chatTvMode === 'fullscreen';

    // --- RENDER ---
    
    if (!started) {
        return (
            <div className="public-tv h-screen min-h-screen w-screen bg-[#0b0e12] text-white font-saira flex items-center justify-center relative overflow-hidden" style={{ height: '100dvh' }}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1a1f2b,transparent_55%),radial-gradient(circle_at_bottom,#1b0f22,transparent_45%)] opacity-90"></div>
                <div className="absolute -top-32 -left-24 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl"></div>
                <div className="absolute -bottom-40 -right-24 w-80 h-80 rounded-full bg-pink-500/20 blur-3xl"></div>
                <div className="relative z-10 flex flex-col items-center gap-4 md:gap-6 px-4 text-center">
                    <img src={room?.logoUrl || ASSETS.logo} alt="Beaurocks Karaoke" className="h-16 md:h-20 2xl:h-24 rounded-2xl drop-shadow-[0_0_30px_rgba(0,196,217,0.45)]" />
                    <div className="text-sm md:text-base uppercase tracking-[0.2em] md:tracking-[0.45em] text-zinc-300">TV Dashboard</div>
                    <div className="text-3xl md:text-5xl 2xl:text-6xl font-bebas text-transparent bg-clip-text bg-gradient-to-r from-[#00C4D9] to-[#EC4899]">
                        Start the Show
                    </div>
                    <div className="text-sm md:text-lg text-zinc-300">Tap to enable audio + visuals.</div>
                    <button
                        onClick={startAudio}
                        className="bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black font-bebas text-2xl md:text-4xl 2xl:text-5xl px-8 py-4 md:px-12 md:py-6 2xl:px-16 2xl:py-7 rounded-[22px] md:rounded-[28px] shadow-[0_0_45px_rgba(0,196,217,0.35)] border border-white/10 hover:scale-[1.02] transition-transform overflow-hidden bg-clip-padding"
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
        const readyPct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
        return (
            <div className="public-tv fixed inset-0 z-[200] bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.16),transparent_55%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.18),transparent_48%),#09090b] flex flex-col items-center justify-center p-4 md:p-8 2xl:p-12 text-center">
                <div className="text-sm md:text-base uppercase tracking-[0.2em] md:tracking-[0.4em] text-zinc-200 mb-3 md:mb-4">Ready Check</div>
                <div className="text-[clamp(5rem,24vw,18rem)] font-black text-white leading-none">{readyTimer || 0}</div>
                <div className="text-2xl md:text-4xl 2xl:text-5xl font-bebas text-cyan-300 mt-3 md:mt-6">ARE YOU READY?</div>
                <div className="text-base md:text-2xl text-zinc-200 mt-2 md:mt-4">{readyCount} / {totalCount} ready ({readyPct}%)</div>
                <div className="mt-4 md:mt-6 w-[86vw] max-w-[640px] h-3 md:h-4 rounded-full border border-white/20 bg-black/35 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-pink-400 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, readyPct))}%` }}></div>
                </div>
                <div className="text-sm md:text-lg text-zinc-300 mt-3">Grab your phone and tap READY before the clock hits zero.</div>
            </div>
        );
    }
    if (chatTvFullscreenActive) {
        return (
            <div className="public-tv fixed inset-0 z-[190] bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.18),transparent_55%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.2),transparent_45%),#07080a] text-white font-saira flex flex-col" style={{ height: '100dvh' }}>
                <div className="px-5 md:px-8 py-4 border-b border-white/10 bg-black/35 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">Public TV</div>
                            <div className="text-3xl md:text-5xl font-bebas text-cyan-300">Full Screen Chat</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs uppercase tracking-[0.2em] text-zinc-300">Room</div>
                            <div className="text-xl md:text-2xl font-mono text-white">{roomCode || '--'}</div>
                        </div>
                    </div>
                </div>
                <div ref={chatFullscreenScrollRef} className="flex-1 min-h-0 p-4 md:p-6 2xl:p-8 overflow-y-auto custom-scrollbar space-y-3">
                    {chatMessages.length === 0 && (
                        <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-5 text-zinc-200 text-lg md:text-2xl">
                            {room?.chatEnabled === false
                                ? 'Chat is paused by the host.'
                                : room?.chatAudienceMode === 'vip'
                                    ? 'Chat is VIP-only right now.'
                                    : 'No chat yet.'}
                        </div>
                    )}
                    {groupedChatMessages.map((group) => (
                        <div key={group.id} className="rounded-2xl border border-white/10 bg-black/45 px-4 md:px-5 py-3 md:py-4">
                            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                <span className="text-2xl md:text-3xl">{group.avatar || EMOJI.sparkle}</span>
                                <span className="font-bold text-white text-lg md:text-2xl truncate">{group.user || 'Guest'}</span>
                                {group.isVip && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] md:text-xs font-black tracking-[0.12em] bg-yellow-400 text-black">VIP</span>
                                )}
                                {group.isHost && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] md:text-xs font-black tracking-[0.12em] bg-cyan-500 text-black">HOST</span>
                                )}
                                {group.messages.length > 1 && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] md:text-xs border border-white/20 bg-white/5 text-zinc-200">
                                        {group.messages.length} msgs
                                    </span>
                                )}
                            </div>
                            <div className="mt-2 md:mt-3 pl-9 md:pl-12 space-y-1.5">
                                {group.messages.map((message, idx) => (
                                    <div key={message.id || `${group.id}-${idx}`} className="text-base md:text-2xl leading-snug text-zinc-100 break-words">
                                        {message.text}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
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
        const submissionsSorted = [...doodleVisibleSubmissions].sort((a, b) => (voteCounts[b.uid] || 0) - (voteCounts[a.uid] || 0));
        const winner = submissionsSorted[0];
        const galleryCols = submissionsSorted.length > 4 ? 'grid-cols-3' : 'grid-cols-2';

        return (
            <div className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-4 md:p-6 2xl:p-10 text-white">
                <div className="w-full max-w-6xl">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 md:mb-6">
                        <div>
                            <div className="text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.45em] text-zinc-400">Doodle-oke</div>
                            <div className="text-3xl md:text-5xl 2xl:text-7xl font-bebas text-cyan-300">Sketch the lyric. Guess the hit.</div>
                            <div className="text-base md:text-xl text-zinc-300 mt-1 md:mt-2">
                                Live sketches: <span className="text-white font-bold">{submissionsSorted.length}</span>
                                {doodleRequireReview && doodlePendingReviewCount > 0 && (
                                    <span className="text-amber-300"> ({doodlePendingReviewCount} pending host review)</span>
                                )}
                            </div>
                        </div>
                        <div className="text-left md:text-right text-base md:text-2xl font-bold uppercase tracking-[0.08em] md:tracking-[0.2em] text-zinc-200">
                            {phase === 'drawing' && `Drawing ${drawRemaining}s`}
                            {phase === 'voting' && `Voting ${guessRemaining}s`}
                            {phase === 'reveal' && 'Reveal'}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 2xl:grid-cols-12 gap-4 md:gap-6">
                        <div className="2xl:col-span-8 bg-black/60 border border-white/10 rounded-2xl md:rounded-3xl p-3 md:p-4">
                            {submissionsSorted.length ? (
                                <div className={`grid ${galleryCols} gap-4 w-full`}>
                                    {submissionsSorted.slice(0, 6).map(s => (
                                        <div key={s.id} className="bg-black/70 border border-white/10 rounded-2xl p-3 relative overflow-hidden">
                                            <div className="text-base md:text-lg text-zinc-300 mb-2">{s.avatar ? `${s.avatar} ` : ''}{s.name || 'Guest'}</div>
                                            <div className="aspect-square bg-zinc-950 rounded-xl overflow-hidden relative">
                                                <img src={s.image} alt={s.name} className="w-full h-full object-contain" />
                                                <img src={room?.logoUrl || ASSETS.logo} className="absolute top-2 right-2 md:top-3 md:right-3 w-10 md:w-16 opacity-70" alt="BROSS" />
                                            </div>
                                            <div className="mt-2 text-base md:text-lg font-semibold text-cyan-200">{voteCounts[s.uid] || 0} votes</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-zinc-400 text-xl md:text-4xl text-center py-10 md:py-20 font-bebas tracking-wide">
                                    {doodleRequireReview && doodlePendingReviewCount > 0
                                        ? 'Waiting for host-approved sketches...'
                                        : 'Waiting for sketches...'}
                                </div>
                            )}
                        </div>
                        <div className="2xl:col-span-4 flex flex-col gap-3 md:gap-4">
                            <div className="bg-zinc-900/70 border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-5">
                                <div className="text-base md:text-lg uppercase tracking-[0.3em] text-zinc-500 mb-3">Prompt</div>
                                <div className="text-3xl md:text-5xl 2xl:text-6xl font-bold text-white leading-tight">
                                    {promptVisible ? doodle.prompt : 'Prompt hidden - vote with your eyes.'}
                                </div>
                                <div className="text-base md:text-lg text-zinc-300 mt-3">Sing or hum the line while you draw.</div>
                            </div>
                            <div className="bg-zinc-900/70 border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-5 flex-1 overflow-hidden">
                                <div className="text-base md:text-lg uppercase tracking-[0.3em] text-zinc-500 mb-3">Votes</div>
                                <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {submissionsSorted.length === 0 && (
                                        <div className="text-zinc-400 text-base md:text-xl">
                                            {doodleRequireReview && doodlePendingReviewCount > 0
                                                ? `Waiting for host-approved sketches (${doodlePendingReviewCount} pending)...`
                                                : 'Waiting for sketches...'}
                                        </div>
                                    )}
                                    {submissionsSorted.map(s => (
                                        <div key={s.id} className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
                                            <div className="text-lg md:text-2xl text-white font-bold truncate">{s.avatar ? `${s.avatar} ` : ''}{s.name || 'Guest'}</div>
                                            <div className="text-xl md:text-3xl text-cyan-200">{voteCounts[s.uid] || 0}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {phase === 'reveal' && winner && (
                                <div className="bg-black/60 border border-cyan-400/40 rounded-2xl md:rounded-3xl p-4 md:p-5 text-center">
                                    <div className="text-sm md:text-base uppercase tracking-[0.28em] text-zinc-500 mb-2">Winner</div>
                                    <div className="text-2xl md:text-3xl font-bebas text-cyan-300">{winner.name || 'Guest'}</div>
                                    <div className="text-base md:text-lg text-zinc-400">{voteCounts[winner.uid] || 0} votes</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const pickerUser = roomUsers.find(u => u.uid === room?.bingoPickerUid) || null;

    // 2. Game Cartridges
    if (room?.activeMode && !['karaoke','applause','selfie_cam','selfie_challenge','applause_countdown','applause_result','doodle_oke'].includes(room.activeMode)) {
        // Map correct payload based on mode
        const isTrivia = room.activeMode.includes('trivia');
        const isWyr = room.activeMode.includes('wyr');
        const isBingo = room.activeMode === 'bingo';
        const isBracket = room.activeMode === 'karaoke_bracket';

        let gamePayload = room.gameData; 
        if (isTrivia) gamePayload = room.triviaQuestion;
        if (isWyr) gamePayload = room.wyrData;
        if (isBracket) gamePayload = room.karaokeBracket || room.gameData;
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

        const isAmbientVoiceGame = (room.activeMode === 'flappy_bird' || room.activeMode === 'vocal_challenge') && room.gameData?.inputSource === 'ambient';
        const isScaleCrowd = room.activeMode === 'riding_scales' && room.gameData?.playerId === 'GROUP';
        const tvIsPlayer = isAmbientVoiceGame || isScaleCrowd;
        const inputSource = room.gameData?.inputSource || (tvIsPlayer ? 'local' : 'remote');

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

        return (
            <GameContainer
                activeMode={room.activeMode}
                roomCode={roomCode}
                gameState={gamePayload}
                playerData={room.gameData}
                isPlayer={tvIsPlayer}
                users={roomUsers}
                inputSource={inputSource}
                rulesToken={room?.gameRulesId}
                view="tv"
            />
        );
    }

    // 3. Recap Overlay
    if (recap) {
        const topFan = recap.topFan;
        const vibeStats = recap.vibeStats;
        return (
            <div className="fixed inset-0 z-[200] bg-zinc-900 flex flex-col items-center justify-center p-4 md:p-8 2xl:p-12 text-center animate-in zoom-in duration-500">
                <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-4 md:p-8 2xl:p-12 rounded-2xl md:rounded-3xl border-2 md:border-4 border-yellow-400 shadow-[0_0_100px_rgba(250,204,21,0.3)] max-w-5xl w-full relative overflow-hidden">
                    <h2 className="text-2xl md:text-3xl 2xl:text-4xl font-bebas text-yellow-400 mb-2 tracking-[0.16em] md:tracking-widest relative z-10">PERFORMANCE SUMMARY</h2>
                    {recap.hallOfFame?.newAllTime && (
                        <div className="inline-flex items-center gap-2 md:gap-3 px-3 py-1.5 md:px-6 md:py-2 rounded-full bg-yellow-400/20 border border-yellow-300 text-yellow-200 uppercase tracking-[0.12em] md:tracking-widest font-bold text-xs md:text-xl mb-4 md:mb-6 relative z-10">
                            <i className="fa-solid fa-trophy"></i> New Global High Score
                        </div>
                    )}
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 mb-5 md:mb-8 relative z-10">
                        {recap.albumArtUrl && (
                            <img src={recap.albumArtUrl} alt={recap.songTitle} className="w-24 h-24 md:w-36 md:h-36 rounded-2xl object-cover border-2 border-white/10 shadow-xl" />
                        )}
                        <div>
                            <div className="text-2xl md:text-4xl 2xl:text-6xl font-black text-white">{recap.songTitle}</div>
                            <div className="text-lg md:text-2xl 2xl:text-3xl text-zinc-300 font-bold mt-1 md:mt-2">{recap.singerName}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-8 mb-6 md:mb-12 relative z-10">
                        <div className="bg-black/30 p-4 rounded-xl border border-pink-500/30">
                            <div className="text-sm md:text-xl text-pink-400 uppercase font-bold">Vibe</div>
                            <div className="text-3xl md:text-6xl font-mono text-white">{recap.hypeScore || 0}</div>
                        </div>
                        <div className="bg-black/30 p-4 rounded-xl border border-yellow-500/30">
                            <div className="text-sm md:text-xl text-yellow-400 uppercase font-bold">Applause</div>
                            <div className="text-3xl md:text-6xl font-mono text-white">{Math.round(recap.applauseScore || 0)}</div>
                        </div>
                        <div className="bg-black/30 p-4 rounded-xl border border-green-500/30">
                            <div className="text-sm md:text-xl text-green-400 uppercase font-bold">Bonus</div>
                            <div className="text-3xl md:text-6xl font-mono text-white">{recap.hostBonus || 0}</div>
                        </div>
                    </div>
                    <div className="text-4xl md:text-6xl 2xl:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-yellow-300 relative z-10">{(recap.hypeScore||0)+(Math.round(recap.applauseScore||0))+(recap.hostBonus||0)} PTS</div>
                    {(topFan || vibeStats) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-5 md:mt-10 relative z-10">
                            {topFan && (
                                <div className="bg-black/30 border border-cyan-400/30 rounded-2xl p-4">
                                    <div className="text-xs uppercase tracking-[0.4em] text-cyan-200 mb-2">Top Fan</div>
                                    <div className="text-2xl md:text-4xl font-black text-white flex items-center justify-center gap-3">
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
    const visualizerBaseMode = room?.visualizerMode || 'ribbon';
    const visualizerDynamicModeEnabled = room?.visualizerDynamicMode !== false;
    const visualizerMode = visualizerDynamicModeEnabled
        ? (() => {
            if (room?.lightMode === 'strobe') return strobePhase === 'countdown' ? 'kaleido' : 'sonar';
            if (room?.lightMode === 'storm') return 'orbit';
            if (room?.lightMode === 'banger') return 'hex';
            if (room?.lightMode === 'ballad') return 'ribbon';
            if (room?.lightMode === 'guitar') return 'comet';
            if (combo >= 88) return 'halo';
            if (combo >= 65) return 'orb';
            return visualizerBaseMode;
        })()
        : visualizerBaseMode;
    const visualizerActive = (started || applauseStep !== 'idle') && visualizerEnabled;
    const bingoRng = room?.bingoMysteryRng;
    const showBingoRngOverlay = room?.bingoMode === 'mystery' && (
        bingoRng?.active ||
        (bingoRng?.finalized && (bingoRngNow - (bingoRng.finishedAt || 0) < 15000))
    );

    return (
        <div
            className={`public-tv h-screen min-h-screen w-screen relative ${tvOverflowClass} font-saira text-white transition-colors duration-1000 ${bgClass} ${motionSafeFx ? 'motion-safe-fx' : ''}`}
            style={{ height: '100dvh' }}
        >
            <audio
                ref={bgVisualizerAudioRef}
                className="hidden"
                preload="auto"
                playsInline
                aria-hidden="true"
                crossOrigin="anonymous"
            />
            {!showVisualizerTv && (
                <div className={`absolute inset-0 z-0 mix-blend-screen pointer-events-none ${waveformOpacity} ${room?.hideWaveform ? 'hidden' : ''}`}>
                    <AudioVisualizer
                        isActive={visualizerActive}
                        externalCtx={audioCtx}
                        onVolume={handleVolume}
                        mode={visualizerMode}
                        inputMode={visualizerInputMode}
                        mediaElement={visualizerSourceElement}
                        simulatedLevel={bgVisualizerSimulatedLevel}
                        preset={visualizerResolvedPreset}
                        sensitivity={visualizerSensitivity}
                        smoothing={visualizerSmoothing}
                    />
                </div>
            )}

            {!room?.hideLogo && (
                <img src={room?.logoUrl || ASSETS.logo} className={`tv-logo absolute top-3 left-3 md:top-5 md:left-5 2xl:top-8 2xl:left-8 ${logoSizeClass} z-50 drop-shadow-xl opacity-90`} alt="Logo" />
            )}
            {isExperienceActive && (
                <div data-tv-live-pill={experienceLabel} className="absolute top-3 right-3 md:top-5 md:right-5 2xl:top-8 2xl:right-8 z-[240] flex items-center gap-2 md:gap-3 bg-red-600/90 border border-red-200/40 px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                    <div className="text-xs md:text-base font-black tracking-[0.12em] md:tracking-widest uppercase">
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
                <div className="absolute inset-0 z-[230] bg-black/80 flex items-center justify-center p-4 md:p-8 2xl:p-10">
                    <div className="w-full max-w-4xl bg-zinc-900/90 border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] p-4 md:p-6 2xl:p-8 text-center shadow-2xl">
                        <div className="text-xs uppercase tracking-[0.4em] text-zinc-500">Mystery Bingo</div>
                        <div className="text-3xl md:text-5xl 2xl:text-6xl font-bebas text-cyan-300 mt-2 md:mt-3">Spin Results</div>
                        <div className="text-xs md:text-sm text-zinc-400 uppercase tracking-[0.15em] md:tracking-widest mt-2">
                            {bingoRng?.active ? 'Spinning now' : 'Order locked'}
                        </div>
                        <div className="mt-4 md:mt-6 grid grid-cols-1 gap-2 md:gap-3">
                            {bingoRngResults.length === 0 && (
                                <div className="text-zinc-500 text-sm md:text-lg">Waiting for spins...</div>
                            )}
                            {bingoRngResults.slice(0, 8).map((entry, idx) => (
                                <div key={entry.uid} className="flex items-center justify-between bg-black/50 border border-white/10 rounded-2xl px-3 py-2 md:px-6 md:py-3">
                                    <div className="flex items-center gap-2 md:gap-4 min-w-0">
                                        <div className="text-xl md:text-3xl">{entry.avatar}</div>
                                        <div className="text-base md:text-2xl font-bold text-white truncate">{entry.name}</div>
                                    </div>
                                    <div className="text-xl md:text-3xl font-black text-yellow-300">#{idx + 1}</div>
                                    <div className="text-xl md:text-3xl font-black text-cyan-200 tabular-nums">{entry.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {tipPulse && (room?.tipUrl || room?.tipQrUrl) && (
                <div className="absolute bottom-3 right-3 md:bottom-6 md:right-6 z-[120] bg-emerald-500/90 text-black px-3 py-2 md:px-6 md:py-4 rounded-2xl border-2 border-white shadow-[0_0_30px_rgba(16,185,129,0.6)] animate-pulse backdrop-blur">
                    <div className="text-xs md:text-sm font-bold uppercase tracking-[0.12em] md:tracking-widest">Show some love</div>
                    <div className="text-sm md:text-2xl font-black">Tip the host {EMOJI.tip}</div>
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
                <div className="absolute top-20 md:top-24 2xl:top-28 left-1/2 -translate-x-1/2 z-[140] bg-black/70 border border-yellow-400/60 px-3 py-2 md:px-6 md:py-3 2xl:px-8 2xl:py-4 rounded-full shadow-[0_0_30px_rgba(250,204,21,0.4)] backdrop-blur max-w-[94vw]">
                    <div className="flex items-center gap-2 md:gap-4 whitespace-nowrap">
                        <div className="text-xl md:text-3xl 2xl:text-4xl">{guitarWinner.avatar}</div>
                        <div className="text-xs md:text-base 2xl:text-xl font-bold text-yellow-300">Guitar Solo MVP</div>
                        <div className="text-white font-black text-xs md:text-base truncate max-w-[30vw]">{guitarWinner.name}</div>
                        <div className="text-yellow-400 font-mono text-xs md:text-base">{guitarWinner.hits} hits</div>
                    </div>
                </div>
            )}

            {/* --- VIBE MODE OVERLAYS --- */}
            
            {room?.lightMode === 'strobe' && (
                <div className="absolute inset-0 z-[160] pointer-events-none">
                    <div className={`absolute inset-0 ${motionSafeFx ? '' : 'vibe-strobe'} ${motionSafeFx ? 'opacity-30' : 'opacity-45'} mix-blend-screen bg-white`}></div>
                    <div className={`absolute inset-0 ${motionSafeFx ? 'bg-gradient-to-b from-pink-500/10 via-transparent to-cyan-400/5' : 'bg-gradient-to-b from-pink-500/15 via-transparent to-cyan-400/10'}`}></div>
                    <div className="absolute top-3 right-3 md:top-6 md:right-6 2xl:top-8 2xl:right-8 px-2 py-1 md:px-3 rounded-full bg-black/65 border border-yellow-300/40 text-xs md:text-sm uppercase tracking-[0.16em] md:tracking-[0.25em] text-yellow-200">
                        Sensitivity Warning
                    </div>
                    <div className="absolute top-3 md:top-6 2xl:top-8 left-1/2 -translate-x-1/2 text-center max-w-[92vw] md:max-w-[80vw]">
                        <div className="text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.45em] text-white/80">Beat Drop</div>
                        {strobePhase === 'countdown' && (
                            <>
                                <div className={`${motionSafeFx ? 'text-6xl md:text-8xl' : 'text-[clamp(3.5rem,16vw,9rem)]'} font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.6)]`}>{strobeCountdown || 0}</div>
                                <div className="text-sm md:text-xl font-bold text-white/90">Get ready to tap</div>
                            </>
                        )}
                        {strobePhase === 'active' && (
                            <>
                                <div className="text-3xl md:text-5xl 2xl:text-6xl font-bebas text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]">TAP THE BEAT</div>
                                <div className="text-sm md:text-lg text-white/90">Tap on your phone to keep the meter alive</div>
                                <div className="mt-2 md:mt-3 text-sm md:text-base text-white/80">Time Left: {strobeRemaining}s</div>
                                <div className="mt-3 md:mt-4 h-4 md:h-5 w-[85vw] max-w-[560px] bg-white/20 rounded-full overflow-hidden border border-white/30 mx-auto">
                                    <div className="h-full bg-white/90" style={{ width: `${strobeMeter}%` }}></div>
                                </div>
                                <div className="mt-2 text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.3em] text-white/70">Total taps {strobeTotalTaps}</div>
                            </>
                        )}
                    </div>
                    <div className="absolute top-3 left-3 md:top-6 md:left-6 2xl:top-8 2xl:left-8 bg-black/65 border border-cyan-300/35 rounded-2xl px-3 py-2 md:px-4 md:py-3 min-w-[190px]">
                        <div className="text-xs md:text-sm uppercase tracking-[0.2em] text-cyan-200">Crowd Sync</div>
                        <div className="mt-1 text-2xl md:text-3xl font-black text-white">{strobeEngagementScore}%</div>
                        <div className="mt-2 h-2 md:h-2.5 w-full bg-white/20 rounded-full overflow-hidden border border-white/20">
                            <div className="h-full bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-white transition-all duration-300" style={{ width: `${strobeEngagementScore}%` }}></div>
                        </div>
                        <div className="mt-2 text-[11px] md:text-xs uppercase tracking-[0.14em] text-zinc-200">
                            {strobeLeaders.length} players in rhythm
                        </div>
                    </div>
                    {strobePhase === 'active' && (
                        <div className="absolute bottom-3 md:bottom-8 left-1/2 -translate-x-1/2 flex gap-2 md:gap-3 max-w-[92vw] md:max-w-[85vw] overflow-x-auto px-2 md:px-4">
                            {strobeLeaders.map((u, idx) => (
                                <div key={u.uid || idx} className="bg-black/60 border border-white/20 rounded-full px-3 py-1.5 md:px-4 md:py-2 text-white text-xs md:text-sm font-bold flex items-center gap-1.5 md:gap-2 whitespace-nowrap flex-shrink-0">
                                    <span className="text-base md:text-xl">{u.avatar || EMOJI.sparkle}</span>
                                    <span className="truncate max-w-[100px] md:max-w-[120px]">{u.name || 'Guest'}</span>
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
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/65 border border-cyan-300/35 rounded-full px-4 py-2 md:px-5 md:py-2.5 text-center min-w-[220px]">
                        <div className="text-[11px] md:text-xs uppercase tracking-[0.2em] text-cyan-200">Storm Charge</div>
                        <div className="mt-1 text-xl md:text-2xl font-black text-white">{stormChargeScore}%</div>
                        <div className="mt-1.5 h-2 w-full bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-300 to-indigo-300 transition-all duration-500" style={{ width: `${stormChargeScore}%` }}></div>
                        </div>
                    </div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(92vw,760px)] bg-black/65 border border-white/15 rounded-2xl px-3 py-3 md:px-4 md:py-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-cyan-200">Crowd Storm Orchestra</div>
                                <div className="text-xs md:text-sm text-zinc-100">Phones layer snap, tap, stomp, and clap into one soundscape.</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] md:text-xs uppercase tracking-[0.16em] text-zinc-300">Intensity</div>
                                <div className="text-xl md:text-2xl font-black text-white">{stormLayerIntensity}%</div>
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                            {STORM_CROWD_LAYERS.map((layer) => {
                                const meter = clampPct(stormLayerMeters?.[layer.id] || 0);
                                return (
                                    <div key={layer.id} className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2">
                                        <div className="flex items-center justify-between gap-1 text-[11px] md:text-xs uppercase tracking-[0.08em] text-zinc-100">
                                            <span className="flex items-center gap-1.5">
                                                <span>{layer.icon}</span>
                                                <span>{layer.label}</span>
                                            </span>
                                            <span className="font-black text-white">{meter}%</span>
                                        </div>
                                        <div className="mt-1.5 h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                                            <div className={`h-full bg-gradient-to-r ${layer.accent} transition-all duration-200`} style={{ width: `${meter}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {stormLayerLeaders.length > 0 && (
                            <div className="mt-2.5 text-[11px] md:text-xs text-zinc-100 uppercase tracking-[0.1em]">
                                Leaders: {stormLayerLeaders.map((leader) => `${leader.avatar} ${leader.user} (${leader.total})`).join(' • ')}
                            </div>
                        )}
                        {stormRecentLayerEvents.length > 0 && (
                            <div className="mt-1.5 text-[11px] md:text-xs text-zinc-200 truncate">
                                Latest: {stormRecentLayerEvents.map((event) => `${event.avatar || EMOJI.sparkle} ${event.user} ${event.layerLabel.toLowerCase()}${event.count > 1 ? ` x${event.count}` : ''}`).join(' • ')}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {room?.lightMode === 'banger' && (
                <>
                    <div
                        className="absolute inset-0 z-[140] pointer-events-none vibe-banger mix-blend-overlay bg-red-500/20"
                        style={{ opacity: 0.25 + ((bangerHeatScore / 100) * 0.6) }}
                    ></div>
                    <div className="fire-overlay">
                        {bangerParticles.map((particle) => (
                            <div key={particle.id} className="fire-particle" style={{ left: particle.left, animationDelay: particle.animationDelay }}>
                                {particle.icon}
                            </div>
                        ))}
                    </div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[145] bg-black/70 border border-orange-300/45 rounded-2xl px-4 py-3 md:px-6 md:py-4 text-center min-w-[260px]">
                        <div className="text-xs md:text-sm uppercase tracking-[0.2em] text-orange-200">Crowd Heat</div>
                        <div className="mt-1 text-3xl md:text-4xl font-black text-white">{bangerHeatScore}%</div>
                        <div className="mt-2 h-2.5 md:h-3 w-full bg-white/20 rounded-full overflow-hidden border border-white/20">
                            <div className="h-full bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 transition-all duration-300" style={{ width: `${bangerHeatScore}%` }}></div>
                        </div>
                        <div className="mt-2 text-xs md:text-sm text-zinc-100 uppercase tracking-[0.12em]">
                            Drop reactions to fuel the fire
                        </div>
                    </div>
                </>
            )}

            {room?.lightMode === 'ballad' && (
                <div className="absolute inset-0 z-[140] pointer-events-none overflow-hidden">
                    <div className="absolute inset-0 ballad-haze opacity-30"></div>
                    <div className="absolute inset-x-0 bottom-0 h-[40%] ballad-glow opacity-60"></div>
                    <div className="absolute inset-0 fire-overlay opacity-40"></div>
                    <div className="absolute inset-0 pointer-events-none">
                        {balladParticles.map((particle) => (
                            <div
                                key={particle.id}
                                className="fire-particle"
                                style={{
                                    left: particle.left,
                                    animationDelay: particle.animationDelay,
                                    animationDuration: particle.animationDuration,
                                    fontSize: '2rem',
                                    opacity: 0.6
                                }}
                            >
                                {EMOJI.fire}
                            </div>
                        ))}
                    </div>
                    <div className="absolute top-8 md:top-10 2xl:top-12 left-1/2 -translate-x-1/2 text-xs md:text-sm font-bold tracking-[0.25em] md:tracking-[0.6em] text-white/70 uppercase">Lights Up - Sway</div>
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 bg-black/65 border border-pink-300/40 rounded-2xl px-3 py-2 md:px-4 md:py-3 text-right min-w-[190px]">
                        <div className="text-xs md:text-sm uppercase tracking-[0.2em] text-pink-100">Singalong Glow</div>
                        <div className="mt-1 text-2xl md:text-3xl font-black text-white">{balladGlowScore}%</div>
                        <div className="mt-2 h-2 w-full bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-pink-300 to-cyan-300 transition-all duration-500" style={{ width: `${balladGlowScore}%` }}></div>
                        </div>
                    </div>
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
                <div className="absolute inset-0 z-[85] pointer-events-none flex flex-col items-center justify-between py-4 md:py-6 2xl:py-8">
                        <div className="flex flex-col items-center gap-2">
                            <div className={`${motionSafeFx ? 'text-4xl md:text-6xl' : 'text-[clamp(2.5rem,9vw,6rem)] 2xl:text-8xl'} font-bebas text-transparent bg-clip-text bg-gradient-to-t from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_30px_rgba(255,100,0,0.8)] ${motionSafeFx ? '' : 'animate-pulse'}`}>GUITAR SOLO!</div>
                            <div className="bg-black/60 border border-yellow-300/35 rounded-full px-4 py-1.5 md:px-5 md:py-2 text-center min-w-[220px]">
                                <div className="text-[11px] md:text-xs uppercase tracking-[0.18em] text-yellow-100">Strum Power</div>
                                <div className="mt-1 text-xl md:text-2xl font-black text-white">{guitarEngagementScore}%</div>
                                <div className="mt-1.5 h-2 w-full bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-400 transition-all duration-300" style={{ width: `${guitarEngagementScore}%` }}></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-center pointer-events-none w-full px-3 md:px-6">
                            <div className="bg-black/60 border border-white/10 rounded-2xl md:rounded-3xl px-4 py-3 md:px-6 md:py-5 2xl:px-8 2xl:py-6 backdrop-blur-md min-w-0 w-full max-w-[90vw] 2xl:min-w-[60%] 2xl:max-w-[80vw]">
                                <div className="text-sm text-zinc-300 mb-4 text-center tracking-[0.3em] uppercase">Top Strummers</div>
                                <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 2xl:gap-5">
                                    {guitarLeaders.length === 0 && (
                                        <div className="text-zinc-400 text-sm">Start strumming to appear here.</div>
                                    )}
                                    {guitarLeaders.map(p => {
                                        const max = Math.max(1, ...guitarLeaders.map(v=>v.guitarHits || 0));
                                        const scale = 1 + Math.min(0.9, (p.guitarHits || 0) / max * 0.9);
                                        return (
                                            <div key={p.uid} className="flex items-center gap-2 md:gap-3 bg-black/70 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/15 shadow-lg transition-transform duration-200 max-w-full" style={{ transform: `scale(${scale})` }}>
                                                <div className="text-2xl md:text-4xl">{p.avatar}</div>
                                                <div className="text-white font-bold text-sm md:text-lg truncate max-w-[26vw] md:max-w-[32vw]">{p.name}</div>
                                                <div className="text-yellow-400 font-mono text-sm md:text-lg ml-1 md:ml-2">{p.guitarHits || 0}</div>
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

            <div className={`relative z-10 h-full grid grid-cols-1 lg:grid-cols-12 ${gridSpacingClass} ${isCinema ? 'pt-0 pb-0' : `${gridTopPaddingClass} ${gridBottomPaddingClass}`}`}>
                {/* STAGE AREA */}
                <div className={`${isCinema ? 'col-span-12' : 'col-span-12 lg:col-span-8'} flex flex-col transition-all duration-500`}>
                    <div className={`flex-1 ${isMinimal || isCinema ? 'bg-black' : 'bg-black/30 backdrop-blur-md border border-white/10'} rounded-2xl md:rounded-3xl relative shadow-2xl overflow-hidden ${stageMinHeightClass}`}>
                        <div className="absolute inset-0 pointer-events-none tv-light-sweep"></div>
                          {current && showScoring && (
                              <div className="absolute top-8 right-3 md:top-10 md:right-4 2xl:top-12 2xl:right-6 z-[80] text-right">
                                  <AnimatedPoints value={Math.max(0, currentPerformancePoints)} />
                                  <div className="flex items-center justify-end gap-1 md:gap-2 mt-1 md:mt-2">
                                    <div className="text-sm md:text-base text-zinc-200 tracking-[0.1em] md:tracking-[0.15em]">PERFORMANCE TOTAL</div>
                                    {currentSingerIsVip && (
                                        <div className="px-2 py-0.5 rounded-full text-sm md:text-base font-bold tracking-[0.1em] md:tracking-[0.14em] bg-yellow-400 text-black shadow-[0_0_10px_rgba(253,224,71,0.6)]">
                                            VIP
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className={`absolute top-0 left-0 w-full h-12 md:h-14 z-[70] bg-black/60 border-b border-white/15 flex items-center shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition-all duration-500 ${showHypeMeter ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6 pointer-events-none'}`}>
                            <div className="absolute inset-0 border-y border-white/10 pointer-events-none"></div>
                            <div className="absolute left-2 md:left-4 z-10 font-bold text-sm md:text-xl uppercase tracking-[0.08em] md:tracking-[0.12em] flex gap-1 md:gap-2 items-center">
                                <span className="text-base md:text-2xl">{EMOJI.fire}</span>
                                <span>HYPE METER</span>
                                {room?.multiplier > 1 && <span className="bg-red-600 text-white px-1.5 py-0.5 md:px-2 rounded animate-pulse text-sm md:text-lg">x{room.multiplier} ACTIVE</span>}
                            </div>
                            <div 
                                className={`h-full transition-all duration-200 ${combo > 90 ? 'bg-gradient-to-r from-red-500 via-yellow-400 to-red-500 animate-pulse' : combo > 50 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-gradient-to-r from-cyan-600 to-blue-600'}`} 
                                style={{width: `${Math.min(100, Math.max(5, combo))}%`, boxShadow: `0 0 20px ${combo > 50 ? 'orange' : 'cyan'}`}}
                            ></div>
                            <div className="absolute left-1/2 top-0 h-full w-1 bg-cyan-400/60 -translate-x-1/2"></div>
                            <div className="absolute left-1/2 top-1.5 -translate-x-1/2 text-sm md:text-lg font-bold text-cyan-200 bg-black/70 px-2 md:px-3 py-1 rounded">2x</div>
                            <div className="absolute left-[90%] top-0 h-full w-1 bg-purple-400/60 -translate-x-1/2"></div>
                            <div className="absolute left-[90%] top-1.5 -translate-x-1/2 text-sm md:text-lg font-bold text-purple-200 bg-black/70 px-2 md:px-3 py-1 rounded">4x</div>
                        </div>
                        {room?.activeMode === 'selfie_cam' ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50">
                                <i className="fa-solid fa-camera text-5xl md:text-7xl 2xl:text-9xl text-white animate-bounce mb-3 md:mb-4"></i>
                                <h1 className="text-3xl md:text-5xl 2xl:text-6xl font-bebas text-pink-500 text-center">SELFIE CAM ACTIVE!</h1>
                            </div>
                        ) : (
                            <>
                                {room?.bingoMode === 'mystery' && room?.activeMode === 'bingo' && pickerUser && (
                                    <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[90] bg-black/70 border border-cyan-400/40 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-sm md:text-lg uppercase tracking-[0.1em] md:tracking-[0.12em] text-cyan-200 max-w-[90%] truncate">
                                        Next Pick: <span className="text-white font-bold">{pickerUser.name}</span>
                                    </div>
                                )}
                                {showVisualizerTv && (
                                    <div className="absolute inset-0 z-30 bg-black">
                                        <AudioVisualizer
                                            isActive={visualizerActive}
                                            externalCtx={audioCtx}
                                            onVolume={handleVolume}
                                            mode={visualizerMode}
                                            className="w-full h-full opacity-95"
                                            inputMode={visualizerInputMode}
                                            mediaElement={visualizerSourceElement}
                                            simulatedLevel={bgVisualizerSimulatedLevel}
                                            preset={visualizerResolvedPreset}
                                            sensitivity={visualizerSensitivity}
                                            smoothing={visualizerSmoothing}
                                        />
                                    </div>
                                )}
                                <Stage room={room} current={current} started={started} combo={combo} minimalUI={isMinimal} showVideo={!isMinimal} />
                                {popTriviaQuestion && (
                                    <div className="absolute left-2 right-2 md:left-4 md:right-4 2xl:left-6 2xl:right-6 bottom-2 md:bottom-4 2xl:bottom-5 z-[92] pointer-events-none">
                                        <div className="bg-black/75 border border-cyan-400/35 rounded-2xl px-3 py-3 md:px-4 md:py-4 2xl:px-5 shadow-[0_0_28px_rgba(34,211,238,0.18)] backdrop-blur">
                                            <div className="flex items-center justify-between gap-2 md:gap-4 text-sm md:text-base uppercase tracking-[0.12em] md:tracking-[0.2em] text-cyan-200 mb-2">
                                                <span>Pop-up Trivia</span>
                                                <span>
                                                    {popTriviaState?.index + 1}/{popTriviaState?.total} | {popTriviaState?.timeLeftSec}s
                                                </span>
                                            </div>
                                            <div className="text-base md:text-xl 2xl:text-2xl font-bold text-white leading-tight mb-2 md:mb-3">
                                                {popTriviaQuestion.q}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {popTriviaQuestion.options?.map((option, idx) => (
                                                    <div key={`${popTriviaQuestion.id}_${idx}`} className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 md:px-3 text-white text-base md:text-lg font-semibold flex items-center justify-between gap-2 md:gap-3">
                                                        <span className="text-cyan-300 font-black text-sm md:text-base tracking-[0.16em] md:tracking-[0.2em]">{String.fromCharCode(65 + idx)}</span>
                                                        <span className="min-w-0 flex-1 truncate">{option}</span>
                                                        <span className="text-zinc-300 font-mono text-sm md:text-base">{popTriviaVoteCounts[idx] || 0}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-2 text-sm md:text-base uppercase tracking-[0.1em] md:tracking-[0.14em] text-zinc-200">
                                                {popTriviaTotalVotes} answers locked
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
                
                {/* SIDEBAR: Hidden in Cinema Mode */}
                {!isCinema && (
                    <div className={`col-span-12 lg:col-span-4 flex flex-col ${sidebarGapClass} h-full min-h-0 overflow-hidden`}>
                         <div className="p-3 md:p-4 rounded-2xl md:rounded-3xl text-center shadow-lg bg-gradient-to-br from-indigo-900 to-purple-900 border border-white/20">
                            <div className="text-xl md:text-2xl 2xl:text-3xl font-black text-cyan-100 mb-1 uppercase tracking-[0.14em] md:tracking-[0.18em]">JOIN</div>
                            <div className="bg-white p-2 md:p-3 rounded-2xl md:rounded-3xl inline-block shadow-[0_0_45px_rgba(255,255,255,0.2)]">
                                <LocalQrImage
                                    value={`${appBase}?room=${roomCode}`}
                                    size={joinQrSize}
                                    alt="QR"
                                    className={joinQrClass}
                                />
                            </div>
                            <div className="text-2xl md:text-3xl 2xl:text-4xl font-bebas text-white mt-2 tracking-[0.1em] md:tracking-[0.14em]">{roomCode}</div>
                            <div className="mt-1">
                                {showVerboseJoinUrl ? (
                                    <>
                                        <div className="text-sm md:text-base text-zinc-100 font-semibold uppercase tracking-[0.08em] md:tracking-[0.1em] break-all leading-tight">Go to {joinUrlBaseDisplay}</div>
                                        <div className="text-base md:text-xl font-black text-cyan-100 tracking-[0.02em] md:tracking-[0.04em] break-all leading-tight">{joinUrlQueryDisplay}</div>
                                    </>
                                ) : (
                                    <div className="text-sm md:text-base text-zinc-100 font-semibold uppercase tracking-[0.08em] md:tracking-[0.1em] leading-tight">
                                        Scan QR to join this room
                                    </div>
                                )}
                            </div>
                            {isMinimal && <div className="mt-4"><MiniVideoPane room={room} current={current} /></div>}
                         </div>
                         <div className="h-[2px] mx-4 rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-40"></div>
                         {room?.bouncerMode && (
                            <div className="px-3 py-2 rounded-2xl bg-black/70 border border-red-400/45 text-red-200 text-sm md:text-base font-bold tracking-[0.14em] uppercase flex items-center justify-center gap-2">
                                <i className="fa-solid fa-lock"></i>
                                Requests Need Approval
                            </div>
                         )}

                         {(spotlightUser || room?.spotlightUser?.id) && (
                            <div className="p-3 md:p-5 rounded-2xl md:rounded-3xl bg-black/70 border border-yellow-400/30 shadow-[0_0_25px_rgba(234,179,8,0.2)] text-center">
                                <div className="text-xs md:text-sm uppercase tracking-[0.24em] md:tracking-[0.3em] text-yellow-300">Spotlight</div>
                                <div className="text-3xl md:text-5xl mt-2">{room?.spotlightUser?.avatar || spotlightUser?.avatar || EMOJI.star}</div>
                                <div className="text-xl md:text-3xl font-bold text-white mt-2 truncate">{room?.spotlightUser?.name || spotlightUser?.name || 'Guest'}</div>
                                {room?.spotlightUser?.msg && (
                                    <div className="text-sm md:text-base text-yellow-200 mt-1">{room.spotlightUser.msg}</div>
                                )}
                                {showExtendedSpotlightMeta && room?.spotlightUser?.challengeSong?.songTitle && (
                                    <div className="mt-2 text-left bg-cyan-500/10 border border-cyan-300/30 rounded-xl px-3 py-2">
                                        <div className="text-xs md:text-sm uppercase tracking-[0.24em] text-cyan-200 mb-1">Challenge Pick</div>
                                        <div className="text-sm md:text-base text-cyan-50 truncate">
                                            {room.spotlightUser.challengeSong.songTitle}
                                            {room?.spotlightUser?.challengeSong?.artist ? ` - ${room.spotlightUser.challengeSong.artist}` : ''}
                                        </div>
                                    </div>
                                )}
                                {showExtendedSpotlightMeta && (
                                    <div className="mt-3 text-left bg-yellow-500/10 border border-yellow-400/20 rounded-xl px-3 py-2">
                                        <div className="text-xs md:text-sm uppercase tracking-[0.24em] text-yellow-200 mb-2">Top Tight 15</div>
                                        {spotlightTopTight15.length ? (
                                            <div className="space-y-1">
                                                {spotlightTopTight15.map((entry, idx) => (
                                                    <div key={`${entry.songTitle}_${entry.artist}_${idx}`} className="text-sm md:text-base text-yellow-50 truncate">
                                                        {idx + 1}. {entry.songTitle}{entry.artist ? ` - ${entry.artist}` : ''}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-yellow-100/70">No Tight 15 songs set yet.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                         )}
                         
                         {room?.showFullQueue ? (
                            <div className="flex-1 min-h-0 bg-black/90 backdrop-blur rounded-2xl md:rounded-3xl p-3 md:p-6 border border-pink-500/50 overflow-hidden flex flex-col animate-in zoom-in">
                                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                                    <h3 className="text-xl md:text-2xl 2xl:text-3xl font-bebas text-pink-400">FULL QUEUE ({allQueue.length})</h3>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                                    {allQueue.map((s, i) => {
                                        const vip = isVipSong(s);
                                        return (
                                        <div key={s.id} className="bg-zinc-800/50 p-3 rounded-xl flex items-center gap-3 border border-white/5">
                                            <div className="font-bebas text-xl md:text-2xl text-zinc-500 w-7 md:w-8 text-center">#{i+1}</div>
                                            <div className="min-w-0">
                                                <div className="font-bold truncate text-base md:text-lg text-white">{s.songTitle}</div>
                                                <div className="text-sm md:text-base text-zinc-400 truncate flex items-center gap-2">
                                                    <span>{s.singerName}</span>
                                                    {vip && (
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-black tracking-[0.08em] bg-yellow-400 text-black">VIP</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                         ) : (
                             <div className="flex-1 min-h-0 bg-zinc-800/80 backdrop-blur rounded-2xl md:rounded-3xl p-3 md:p-5 border border-white/10 flex flex-col overflow-hidden">
                                {lobbyWarmupMode ? (
                                    <>
                                        <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                                            <h3 className="text-xl md:text-2xl 2xl:text-3xl font-bebas text-cyan-300">LOBBY PLAYGROUND</h3>
                                        </div>
                                        <div className="text-sm md:text-base text-zinc-100 mb-3">
                                            As guests join, use phones to trigger live reactions, chat, and identity updates on this TV.
                                        </div>
                                        <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-3 mb-3">
                                            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-200 mb-1">Try This Now</div>
                                            <div className="text-lg md:text-2xl font-bebas text-white leading-tight">{lobbyPrompt}</div>
                                        </div>
                                        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-300 mb-1">In Room ({roomUsers.length})</div>
                                        <div className="grid grid-cols-2 gap-2 mb-3 max-h-[20vh] overflow-y-auto custom-scrollbar pr-1">
                                            {lobbyMembers.length === 0 && (
                                                <div className="col-span-2 rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-zinc-200 text-sm md:text-base">
                                                    Scan the QR to join. First person in unlocks live interaction.
                                                </div>
                                            )}
                                            {lobbyMembers.map((member, idx) => (
                                                <div key={`${member.uid || member.name || 'guest'}-${idx}`} className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 flex items-center gap-2">
                                                    <span className="text-lg md:text-xl">{member.avatar || EMOJI.sparkle}</span>
                                                    <span className="truncate text-sm md:text-base font-semibold text-zinc-100">{member.name || 'Guest'}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-300 mb-1">Live Signals</div>
                                        <div className="flex-1 min-h-[120px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                            {lobbyEventFeed.length === 0 && (
                                                <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-zinc-200 text-sm md:text-base">
                                                    Waiting for joins, reactions, or chat...
                                                </div>
                                            )}
                                            {lobbyEventFeed.map((entry) => (
                                                <div key={entry.id} className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 flex items-center gap-2">
                                                    <span className="text-lg md:text-xl">{entry.avatar || EMOJI.sparkle}</span>
                                                    <span className="truncate text-sm md:text-base text-zinc-100">
                                                        <span className="font-bold text-white">{entry.user || 'Guest'}</span> {entry.text}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                                            <h3 className="text-xl md:text-2xl 2xl:text-3xl font-bebas text-cyan-400">UP NEXT</h3>
                                        </div>
                                        {!isDistanceConstrained && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {queueRules.map(rule => (
                                                    <div key={rule.label} className="flex items-center gap-2 bg-black/45 border border-white/10 px-3 py-1.5 rounded-full text-sm md:text-base font-semibold uppercase tracking-[0.12em] text-zinc-100">
                                                        <i className={`fa-solid ${rule.icon} text-cyan-300`}></i>
                                                        <span>{rule.shortLabel || rule.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="mb-2 text-base md:text-lg uppercase tracking-[0.08em] md:tracking-[0.12em] text-zinc-100 font-semibold">
                                            Queue: <span className="text-white font-bold">{allQueue.length}</span> songs
                                            {' '}
                                            | Est wait <span className="text-white font-bold">{formatWaitTime(queueWaitSec)}</span>
                                        </div>
                                        <div className="space-y-2 mb-3 max-h-[22vh] md:max-h-[18vh] overflow-y-auto custom-scrollbar pr-1">
                                            {nextUp.length === 0 && (
                                                <div className="bg-black/35 border border-white/10 rounded-2xl px-4 py-3 text-zinc-100 text-base md:text-xl font-bebas tracking-wide">
                                                    No singers yet - scan to join
                                                </div>
                                            )}
                                            {nextUp.map((s, i) => {
                                                const vip = isVipSong(s);
                                                return (
                                                    <div key={s.id} className="bg-zinc-700/50 p-2 rounded-xl flex items-center gap-3 border-l-4 border-pink-500">
                                                        <div className="font-bebas text-2xl md:text-3xl text-zinc-400">#{i+1}</div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold truncate text-base md:text-xl leading-none">{s.songTitle}</div>
                                                            <div className="text-base md:text-lg text-zinc-400 truncate flex items-center gap-2">
                                                                <span>{s.singerName}</span>
                                                                {vip && (
                                                                    <span className="px-2 py-0.5 rounded-full text-xs font-black tracking-[0.08em] bg-yellow-400 text-black">VIP</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <h3 className="text-xl md:text-2xl 2xl:text-3xl font-bebas text-green-400 mb-2 border-b border-white/10 pb-2">
                                            {showChatFeed ? 'CHAT' : 'ACTIVITY'}
                                        </h3>
                                        <div ref={chatSidebarScrollRef} className="flex-1 min-h-[120px] overflow-y-auto space-y-2 custom-scrollbar">
                                            {showChatFeed ? (
                                                <>
                                                    {chatMessages.length === 0 && (
                                                        <div className="text-zinc-500 text-base md:text-lg">
                                                            {room?.chatEnabled === false
                                                                ? 'Chat is paused by the host.'
                                                                : room?.chatAudienceMode === 'vip'
                                                                    ? 'Chat is VIP-only right now.'
                                                                    : 'No chat yet.'}
                                                        </div>
                                                    )}
                                                    {groupedChatMessages.map((group) => (
                                                        <div key={group.id} className="flex gap-2 items-start text-zinc-200 text-lg">
                                                            <span>{group.avatar || EMOJI.sparkle}</span>
                                                            <div className="min-w-0">
                                                                <div className="truncate">
                                                                    <span className="font-bold text-white">{group.user || 'Guest'}</span>
                                                                    {group.isVip && (
                                                                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-black tracking-widest bg-yellow-400 text-black">VIP</span>
                                                                    )}
                                                                    {group.isHost && (
                                                                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-black tracking-widest bg-cyan-500 text-black">HOST</span>
                                                                    )}
                                                                </div>
                                                                <div className="space-y-0.5">
                                                                    {group.messages.map((message, idx) => (
                                                                        <div key={message.id || `${group.id}-${idx}`} className="break-words">{message.text}</div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </>
                                            ) : (
                                                <>
                                                    {activities.length === 0 && (
                                                        <div className="text-zinc-200 text-lg md:text-2xl font-bebas tracking-wide">
                                                            Activity starts when first singer joins.
                                                        </div>
                                                    )}
                                                    {activities.map((a, i) => (
                                                        <div key={i} className="flex gap-2 items-center text-zinc-200 text-base md:text-xl">
                                                            <span>{a.icon}</span>
                                                            <span className="truncate"><span className="font-bold text-white">{a.user}</span> {a.text}</span>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                             </div>
                         )}
                    </div>
                )}
            </div>

            {room?.activeMode === 'selfie_challenge' && (
                <div className="absolute inset-0 z-[120] bg-black/70 backdrop-blur-sm flex flex-col p-4 md:p-6 2xl:p-10">
                    <div className="text-center mb-4 md:mb-6">
                        <div className="text-xs md:text-sm uppercase tracking-[0.2em] md:tracking-[0.4em] text-zinc-300">Selfie Challenge</div>
                        <div className="text-2xl md:text-4xl font-bebas text-white">{room?.selfieChallenge?.prompt || 'Get ready'}</div>
                        {room?.selfieChallenge?.status && (
                            <div className="text-xs md:text-sm text-cyan-300 mt-2">Status: {room.selfieChallenge.status}</div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 md:gap-6 flex-1">
                        {(room?.selfieChallenge?.requireApproval ? selfieSubmissions.filter(s => s.approved) : selfieSubmissions).map(s => (
                            <div key={s.id} className="bg-zinc-900/80 border border-zinc-700 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                                <div className="relative">
                                    <img src={s.url} alt={s.userName} className="w-full h-40 md:h-52 object-cover" />
                                    <div className="absolute top-2 right-2 md:top-3 md:right-3 bg-black/70 px-2 py-1 md:px-3 rounded-full text-xs md:text-sm font-bold text-cyan-300">
                                        {selfieVoteCounts[s.uid] || 0} votes
                                    </div>
                                </div>
                                <div className="p-3 md:p-4 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                        <span className="text-2xl md:text-3xl">{s.avatar || 'O'}</span>
                                        <div className="text-sm md:text-lg font-bold text-white truncate max-w-[220px]">{s.userName}</div>
                                    </div>
                                    <div className="h-2 w-24 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, ((selfieVoteCounts[s.uid] || 0) / Math.max(1, ...Object.values(selfieVoteCounts), 1)) * 100)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(room?.selfieChallenge?.requireApproval ? selfieSubmissions.filter(s => s.approved) : selfieSubmissions).length === 0 && (
                            <div className="2xl:col-span-3 md:col-span-2 col-span-1 flex items-center justify-center text-zinc-400 text-base md:text-xl">Waiting for selfies...</div>
                        )}
                    </div>
                    {room?.selfieChallenge?.status === 'ended' && room?.selfieChallenge?.winner && (!room?.selfieChallenge?.winnerExpiresAt || nowMs() < room.selfieChallenge.winnerExpiresAt) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                            <div className="bg-zinc-900 border border-[#00C4D9]/40 rounded-3xl p-4 md:p-8 text-center shadow-2xl">
                                <div className="text-xs uppercase tracking-[0.4em] text-zinc-500">Winner</div>
                                <div className="text-2xl md:text-5xl font-bebas text-white mb-3 md:mb-4">{room.selfieChallenge.winner.name}</div>
                                <img src={room.selfieChallenge.winner.url} alt={room.selfieChallenge.winner.name} className="w-[74vw] h-[74vw] max-w-[360px] max-h-[360px] object-cover rounded-2xl border border-white/10 mx-auto" />
                                <div className="text-cyan-300 font-bold mt-3 md:mt-4 text-sm md:text-base">{room.selfieChallenge.winner.votes || 0} votes</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Marquee */}
            {hasMarqueeContent && (
                <div className={`marquee-shell absolute bottom-0 left-0 w-full ${marqueeHeightClass} bg-pink-600 overflow-hidden flex items-center z-40 border-t-4 border-white shadow-[0_-10px_30px_rgba(219,39,119,0.5)] ${showMarquee ? 'marquee-on' : 'marquee-off'}`}>
                    <div className="whitespace-nowrap animate-marquee flex gap-16 px-6">
                        {marqueeText ? (
                            <span className="font-bebas text-white flex items-center gap-3 leading-none" style={{ fontSize: marqueeTextSize }}>
                                {marqueeText}
                            </span>
                        ) : (
                            messages.map((m, i) => (
                                <span key={i} className="font-bebas text-white flex items-center gap-3 leading-none" style={{ fontSize: marqueeTextSize }}>
                                    <span className="bg-black/20 px-3 rounded" style={{ fontSize: marqueeUserSize }}>{m.user}:</span> {m.text}
                                </span>
                            ))
                        )}
                    </div>
                </div>
            )}
            
            {/* Selfie Overlay */}
            {photoOverlay && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 animate-in zoom-in">
                    <div className="relative transform rotate-[-5deg] bg-white p-3 md:p-4 pb-12 md:pb-16 shadow-2xl max-w-[94vw]">
                        <img src={photoOverlay.url} className="max-h-[68vh] max-w-[90vw] border-2 border-zinc-200" />
                        <img src={ASSETS.logo} className="absolute top-2 right-2 md:top-4 md:right-4 w-14 md:w-24 opacity-90" alt="BROSS" />
                        {photoOverlay.mode === 'guitar_victory' ? (
                            <div className="absolute bottom-4 left-0 w-full text-center">
                                <div className="text-sm md:text-xl text-pink-600 font-black uppercase tracking-[0.18em] md:tracking-[0.4em]">Guitar Solo MVP</div>
                                <div className="text-xl md:text-3xl text-black font-bold font-mono mt-1">{photoOverlay.userName}</div>
                                <div className="text-xs md:text-sm text-zinc-600 font-semibold mt-1">{photoOverlay.copy || 'Shredded the hardest.'}</div>
                            </div>
                        ) : photoOverlay.mode === 'strobe_victory' ? (
                            <div className="absolute bottom-4 left-0 w-full text-center">
                                <div className="text-sm md:text-xl text-cyan-600 font-black uppercase tracking-[0.18em] md:tracking-[0.4em]">Beat Drop MVP</div>
                                <div className="text-xl md:text-3xl text-black font-bold font-mono mt-1">{photoOverlay.userName}</div>
                                <div className="text-xs md:text-sm text-zinc-600 font-semibold mt-1">{photoOverlay.copy || 'Kept the beat alive.'}</div>
                            </div>
                        ) : (
                            <div className="absolute bottom-4 left-0 w-full text-center text-xl md:text-3xl text-black font-bold font-mono">{EMOJI.camera} {photoOverlay.userName}</div>
                        )}
                    </div>
                </div>
            )}

            {/* Applause Meter Overlay */}
            {applauseStep !== 'idle' && (
                <div className="absolute inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
                    <h1 className="text-3xl md:text-6xl font-bebas text-white mb-4 md:mb-8 tracking-[0.14em] md:tracking-widest animate-pulse">NOISE LEVEL</h1>
                    <div className="relative w-[76vw] h-[76vw] max-w-[500px] max-h-[500px] flex items-center justify-center">
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
                            <div className="text-[clamp(3.25rem,16vw,10rem)] font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00C4D9] to-[#EC4899] font-mono leading-none drop-shadow-[0_0_20px_rgba(236,72,153,0.35)]">
                                {Math.round(applauseStep === 'result' ? applauseMax : micVolume)}
                            </div>
                            <div className="text-lg md:text-2xl text-zinc-500 font-bold">dB</div>
                        </div>
                    </div>
                    <div className="mt-4 md:mt-8 text-xl md:text-4xl text-cyan-300 font-bebas tracking-[0.1em] md:tracking-widest animate-bounce text-center px-4">
                        {applauseStep === 'countdown'
                            ? `GET READY... ${countdown}`
                            : applauseStep === 'measuring'
                                ? `MEASURING... ${measure}`
                                : "PEAK LEVEL REACHED"}
                    </div>
                </div>
            )}

            {/* Lobby Playground Bursts */}
            <div className="absolute inset-0 z-[198] pointer-events-none overflow-hidden">
                {lobbyPlayBursts.map((burst) => {
                    const ageMs = nowMs() - Number(burst.createdAt || 0);
                    const opacity = Math.max(0, 1 - (ageMs / 2800));
                    return (
                        <div
                            key={burst.id}
                            className="absolute -translate-x-1/2 -translate-y-1/2"
                            style={{
                                left: `${burst.left}%`,
                                top: `${burst.top}%`,
                                opacity
                            }}
                        >
                            <div className={`rounded-2xl border border-white/35 bg-gradient-to-r ${burst.accent} px-3 py-2 shadow-[0_0_26px_rgba(34,211,238,0.35)] backdrop-blur-sm`}>
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl md:text-3xl">{burst.icon}</span>
                                    <div className="min-w-0">
                                        <div className="text-[11px] md:text-xs uppercase tracking-[0.14em] font-black text-black/80">{burst.label}</div>
                                        <div className="text-xs md:text-sm text-black/75 truncate max-w-[180px]">{burst.user}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

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
                                    <span className="absolute -top-3 -right-3 md:-top-4 md:-right-4 text-xl md:text-3xl animate-vip-spin">{'\u2728'}</span>
                                )}
                            </div>
                            <div className="mt-3 flex flex-col items-center gap-1 reaction-label">
                                <div className={`px-3 py-1 md:px-4 rounded-full text-base md:text-2xl font-black tracking-widest ${r.isVip ? 'text-yellow-300 border-2 border-yellow-300 bg-black/70 shadow-[0_0_18px_rgba(253,224,71,0.6)]' : 'text-yellow-200 border-2 border-yellow-500/40 bg-black/60'}`}>
                                    +{r.points || 0}
                                </div>
                                <div className={`px-3 py-1 md:px-4 rounded-full text-sm md:text-xl font-bold flex items-center gap-2 ${r.isVip ? 'text-yellow-300 border-2 border-yellow-400 bg-black/70 shadow-[0_0_20px_rgba(253,224,71,0.5)]' : 'text-white border-2 border-white/20 bg-black/60'}`}>
                                    <span className="truncate max-w-[9rem] md:max-w-[12rem]">{r.userName || 'Guest'}</span>
                                    {r.isVip && <span className="text-xs font-black tracking-widest">VIP</span>}
                                </div>
                                <div className="px-3 py-1 rounded-full text-xs md:text-base font-semibold text-cyan-200 border border-cyan-400/40 bg-black/60">
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



