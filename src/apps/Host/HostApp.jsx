import React, { useState, useEffect, useRef, useMemo } from 'react';
import UnifiedGameLauncher from '../../components/UnifiedGameLauncher';
import { GAMES_META } from '../../lib/gameRegistry';
import { 
    db, doc, collection, query, where, orderBy, onSnapshot, updateDoc, 
    addDoc, deleteDoc, serverTimestamp, limit, getDocs, getDoc, increment, setDoc, writeBatch,
    storage, storageRef, uploadBytesResumable, getDownloadURL, deleteObject,
    arrayUnion,
    trackEvent,
    callFunction
} from '../../lib/firebase';
import { ASSETS, AVATARS, APP_ID } from '../../lib/assets';
import { playSfx, setSfxMasterVolume, stopAllSfx } from '../../lib/utils';
import { EMOJI } from '../../lib/emoji';
import { BROWSE_CATEGORIES, TOPIC_HITS } from '../../lib/browseLists';
import { useToast } from '../../context/ToastContext';
import { BG_TRACKS, SOUNDS } from '../../lib/gameDataConstants';
import { HOST_APP_CONFIG } from '../../lib/uiConstants';
import { buildSongKey, ensureSong, ensureTrack, extractYouTubeId } from '../../lib/songCatalog';

// --- CONSTANTS & CONFIG ---
const VERSION = HOST_APP_CONFIG.VERSION;
const STORM_SEQUENCE = HOST_APP_CONFIG.STORM_SEQUENCE;
const STROBE_COUNTDOWN_MS = HOST_APP_CONFIG.STROBE_COUNTDOWN_MS;
const STROBE_ACTIVE_MS = HOST_APP_CONFIG.STROBE_ACTIVE_MS;
let itunesBackoffUntil = 0;

// Background tracks and sounds imported from gameDataConstants.js
// (BG_TRACKS, SOUNDS)

const LOCAL_LIBRARY = [ 
    { title: "Big Buck Bunny (Test)", artist: "Blender", url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" }, 
    { title: "Sintel (Test)", artist: "Blender", url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" }, 
    { title: "Tears of Steel (Test)", artist: "Blender", url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4" }, 
    { title: "Archive.org Sample", artist: "Internet Archive", url: "https://archive.org/download/Popeye_forPresident/Popeye_forPresident_512kb.mp4" } 
];

const parseYouTubeVideoId = (input = '') => {
    if (!input) return '';
    try {
        const url = new URL(input.trim());
        if (url.hostname.includes('youtu.be')) return url.pathname.replace('/', '');
        const v = url.searchParams.get('v');
        if (v) return v;
} catch (_err) {
        // noop
    }
    return input.trim().length >= 6 ? input.trim() : '';
};

const SELFIE_PROMPTS = [
    'Give us your best "Blue Steel" face',
    'Recreate a famous movie scene',
    'Show your most dramatic slow clap',
    'Sing into the mic like a rockstar',
    'Freeze mid-laugh like a sitcom still',
    'Strike a superhero landing pose',
    'Pretend you just won the karaoke trophy',
    'Give us your best album cover stare',
    'Look shocked like you forgot the lyrics',
    'Give a confident mic drop pose'
];
const DOODLE_PROMPTS_DEFAULT = [
    "Draw the chorus of 'Sweet Caroline'",
    "Sketch a power ballad moment",
    "Draw a karaoke stage in action",
    "Illustrate a mic drop",
    "Draw the sound of applause",
    "Sketch a wild guitar solo",
    "Draw a disco dance move",
    "Illustrate 'Don't Stop Believin''",
    "Draw your favorite 90s pop icon",
    "Sketch a neon synthwave vibe"
];

// --- AI HELPER ---
const generateAIContent = async (type, context) => {
    try {
        const data = await callFunction('geminiGenerate', { type, context });
        return data?.result || null;
    } catch (e) {
        console.error("AI Error", e);
        alert("Gemini is not configured yet. Add server keys and try again.");
        return null;
    }
};

const LOCAL_DB_NAME = 'bross_local_media';
const LOCAL_STORE = 'videos';

const openLocalDb = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(LOCAL_DB_NAME, 1);
    req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(LOCAL_STORE)) {
            db.createObjectStore(LOCAL_STORE, { keyPath: 'id' });
        }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

const getLocalVideos = async () => {
    const db = await openLocalDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(LOCAL_STORE, 'readonly');
        const store = tx.objectStore(LOCAL_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
};

// --- STYLES ---
const STYLES = {
    btnStd: "rounded-xl font-bold transition-all active:scale-95 shadow-md uppercase tracking-wider flex items-center justify-center border text-[11px] sm:text-xs py-2 px-3 cursor-pointer whitespace-nowrap backdrop-blur-sm gap-2 min-h-[34px] focus:outline-none focus-visible:outline-none focus-visible:ring-0 overflow-hidden bg-clip-padding relative",
    btnPrimary: "bg-gradient-to-r from-[#0bb3c5] to-[#1f2937] text-white border-transparent bg-clip-padding overflow-hidden shadow-[0_0_18px_rgba(11,179,197,0.25)] hover:brightness-110",
    btnHighlight: "bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-white border-transparent bg-clip-padding overflow-hidden shadow-[0_0_14px_rgba(236,72,153,0.35)] hover:brightness-110",
    btnNeutral: "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-[#00C4D9]/60 hover:text-white hover:bg-zinc-800 transition-all",
    btnDanger: "bg-[#EC4899]/20 text-[#FBCFE8] border-[#EC4899]/40 hover:bg-[#EC4899]/30 hover:text-white",
    btnInfo: "bg-[#00C4D9]/15 text-[#00C4D9] border-[#00C4D9]/40 hover:bg-[#00C4D9]/25 hover:text-white",
    btnSuccess: "bg-[#00C4D9]/15 text-[#00C4D9] border-[#00C4D9]/40 hover:bg-[#00C4D9]/25 hover:text-white",
    btnBrand: "bg-gradient-to-r from-[#EC4899] to-[#F472B6] text-white border-transparent bg-clip-padding overflow-hidden shadow-[0_0_16px_rgba(236,72,153,0.35)] hover:brightness-110",
    btnSecondary: "bg-gradient-to-r from-[#0b3b44] to-[#111827] border border-zinc-700 text-zinc-200 bg-clip-padding overflow-hidden hover:brightness-110",
    btnStandardBrandHover: "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-[#EC4899]/60 hover:text-white hover:bg-zinc-800 transition-all",
    panel: "bg-zinc-900/95 border border-white/10 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden",
    input: "bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:border-[#00C4D9] outline-none transition-colors w-full placeholder-zinc-500",
    header: "text-xs font-bold text-[#00C4D9] mb-2 tracking-widest uppercase border-b border-white/5 pb-1 flex justify-between items-center"
};

const DEFAULT_MARQUEE_ITEMS = [
    "Welcome to BROSS Karaoke — scan the QR to join!",
    "Send reactions to hype the singer and light up the stage.",
    "Request a song anytime — the host will pull you up next.",
    "Tip the host to unlock bonus points and VIP perks.",
    "Ready Check incoming — tap READY to earn points.",
    "Share the room code with friends and fill the queue."
];

const DEFAULT_TIP_CRATES = [
    { id: 'crate_small', label: 'Quick Boost', amount: 5, points: 1000, rewardScope: 'buyer', awardBadge: false },
    { id: 'crate_mid', label: 'Crowd Energy', amount: 10, points: 2500, rewardScope: 'room', awardBadge: false },
    { id: 'crate_big', label: 'Room Rager', amount: 20, points: 6000, rewardScope: 'room', awardBadge: true }
];

const loadMusicKitScript = () => new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.MusicKit) return resolve(window.MusicKit);
    const existing = document.querySelector('script[data-musickit]');
    if (existing) {
        existing.addEventListener('load', () => resolve(window.MusicKit));
        existing.addEventListener('error', reject);
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://js-cdn.music.apple.com/musickit/v1/musickit.js';
    script.async = true;
    script.dataset.musickit = '1';
    script.onload = () => resolve(window.MusicKit);
    script.onerror = reject;
    document.head.appendChild(script);
});

const parseAppleMusicPlaylistId = (value = '') => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const match = trimmed.match(/pl\.[A-Za-z0-9._-]+/);
    if (match) return match[0];
    return trimmed;
};

const formatBytes = (bytes = 0) => {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
};

const estimateStorageMonthly = (bytes = 0) => {
    const gb = bytes / (1024 * 1024 * 1024);
    const monthly = gb * 0.026;
    return monthly;
};
const toMs = (t) => {
    if (!t) return 0;
    if (typeof t === 'number') return t;
    if (t?.toMillis) return t.toMillis();
    if (t?.seconds) return t.seconds * 1000;
    return 0;
};

const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ123456789";
const generateRoomCode = (length = 4) => {
    let code = "";
    for (let i = 0; i < length; i += 1) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return code;
};

const SmallWaveform = ({ level = 0, className = "h-6 w-28", color = 'rgba(0,196,217,0.9)' }) => {
    const gradient = Array.isArray(color) ? color : null;
    const canvasRef = useRef(null);
    const levelRef = useRef(level);
    const smoothRef = useRef(level);
    const timeRef = useRef(0);

    useEffect(() => { levelRef.current = level; }, [level]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let raf;

        const render = () => {
            const width = canvas.clientWidth || 1;
            const height = canvas.clientHeight || 1;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);

            const bars = Math.max(6, Math.floor(width / 6));
            const gap = Math.max(1, Math.floor(width / 30));
            const barWidth = Math.max(1, (width - gap * (bars - 1)) / bars);
            const target = Math.min(100, Math.max(0, levelRef.current || 0));
            const lerp = 0.08;
            smoothRef.current = smoothRef.current + (target - smoothRef.current) * lerp;
            const base = Math.min(1, smoothRef.current / 100);
            timeRef.current += 0.06;
            if (gradient) {
                const grad = ctx.createLinearGradient(0, 0, width, 0);
                grad.addColorStop(0, gradient[0]);
                grad.addColorStop(1, gradient[1] || gradient[0]);
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = color;
            }

            for (let i = 0; i < bars; i++) {
                const wave = (Math.sin(timeRef.current + i * 0.6) + 1) / 2;
                const shimmer = (Math.sin(timeRef.current * 0.7 + i * 0.3) + 1) / 2;
                const jitter = 0.55 + (wave * 0.35) + (shimmer * 0.1);
                const minAmp = base > 0 ? 0.07 : 0.02;
                const amp = Math.max(minAmp, base * jitter);
                const barHeight = amp * height;
                const x = i * (barWidth + gap);
                const y = height - barHeight;
                ctx.fillRect(x, y, barWidth, barHeight);
            }

            raf = requestAnimationFrame(render);
        };

        render();
        return () => { if (raf) cancelAnimationFrame(raf); };
    }, []);

    return (
        <div className={className}>
            <canvas ref={canvasRef} className="w-full h-full rounded bg-black/40 border border-white/10" />
        </div>
    );
};

// Button-style toggle (matches Tip/Leaderboard buttons)
const ToggleSwitch = ({ checked, onChange, icon, label }) => {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`${STYLES.btnStd} ${checked ? STYLES.btnPrimary : STYLES.btnNeutral} justify-center px-2 shadow-none overflow-hidden`}
        >
            <span className="text-sm">{icon}</span>
            {label}
        </button>
    );
};

// --- SUB-COMPONENTS ---

// 1. Edit Modal
const EditSongModal = ({ song, onClose, onSave, onGenerateLyrics }) => {
    const [form, setForm] = useState({ 
        title: song.songTitle || '', artist: song.artist || '', singer: song.singerName || '', 
        url: song.mediaUrl || '', art: song.albumArtUrl || '', lyrics: song.lyrics || '', duration: song.duration || 180 
    });

    const openYT = () => {
        const q = `${form.title} ${form.artist} karaoke`;
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, '_blank');
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm">
            <div className={`${STYLES.panel} p-6 w-full max-w-lg border-white/20 space-y-3`}>
                <div className={STYLES.header}>EDIT SONG METADATA</div>
                <div className="grid grid-cols-2 gap-2">
                    <input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} className={STYLES.input} placeholder="Title"/>
                    <input value={form.artist} onChange={e=>setForm({...form, artist:e.target.value})} className={STYLES.input} placeholder="Artist"/>
                </div>
                <div className="flex gap-2 items-center">
                    <input value={form.url} onChange={e=>setForm({...form, url:e.target.value})} className={`${STYLES.input} flex-1`} placeholder="Media URL (YouTube/MP4)"/>
                    <button onClick={openYT} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-[#00C4D9]`} title="Search YouTube"><i className="fa-brands fa-youtube"></i></button>
                </div>
                
                <div className={STYLES.header}>LYRICS & TIMING</div>
                <div className="flex gap-2 items-center bg-black/20 p-2 rounded">
                    <span className="text-xs text-zinc-400">Duration:</span>
                    <input type="range" min="60" max="600" value={form.duration} onChange={e=>setForm({...form, duration:e.target.value})} className="flex-1 accent-pink-500"/>
                    <span className="text-xs font-mono w-10 text-right">{form.duration}s</span>
                </div>
                <div className="host-form-helper">Used only when lyrics have no sync data (AI or manual). Sets scroll speed.</div>
                <textarea value={form.lyrics} onChange={e=>setForm({...form, lyrics:e.target.value})} className={`${STYLES.input} h-32 font-mono host-lyrics-input`} placeholder="Paste lyrics here..."></textarea>
                
                <button onClick={() => onGenerateLyrics(form, (l) => setForm(p => ({...p, lyrics:l})))} className={`${STYLES.btnStd} ${STYLES.btnInfo} w-full`}><i className="fa-solid fa-robot mr-2"></i> Auto-generate lyrics (AI)</button>
                
                <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-white/10">
                    <button onClick={onClose} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>Cancel</button>
                    <button onClick={() => onSave(song.id, form)} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-8`}><i className="fa-solid fa-floppy-disk mr-2"></i> Save changes</button>
                </div>
            </div>
        </div>
    );
};

// 2. Games
const HostFlappyGame = ({ onStop }) => {
    return ( <div className="p-8 text-center h-full flex flex-col items-center justify-center"><h2 className="text-4xl font-bebas mb-4">GAME IN PROGRESS</h2><button onClick={onStop} className={`${STYLES.btnStd} ${STYLES.btnDanger} py-4 px-8 text-xl`}><i className="fa-solid fa-stop mr-2"></i> Stop game</button></div> );
};


// Note: VoiceGameTab has been removed. Games functionality moved to UnifiedGameLauncher component
// See src/components/UnifiedGameLauncher.jsx

// --- SELFIE CHALLENGE (Games Tab) ---
const SelfieChallengePanel = ({ roomCode, room, updateRoom, users, seedParticipants, seedToken }) => {
    const [selectedParticipants, setSelectedParticipants] = useState([]);
    const [promptText, setPromptText] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [selfieSubmissions, setSelfieSubmissions] = useState([]);
    const [selfieVotes, setSelfieVotes] = useState([]);
    const [requireApproval, setRequireApproval] = useState(true);
    const [autoStartVoting, setAutoStartVoting] = useState(true);
    const autoStartRef = useRef(null);
    const toast = useToast() || console.log;

    const sortedUsers = [...users].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const challenge = room?.selfieChallenge || null;
    
    const eligibleSubmissions = challenge?.requireApproval
        ? selfieSubmissions.filter(s => s.approved)
        : selfieSubmissions;
    useEffect(() => {
        if (!seedToken || !seedParticipants || seedParticipants.length === 0) return;
        const t = setTimeout(() => {
            setSelectedParticipants(prev => {
                const merged = new Set([...(prev || []), ...seedParticipants]);
                return Array.from(merged);
            });
        }, 0);
        return () => clearTimeout(t);
    }, [seedToken, seedParticipants]);
    const toggleParticipant = (uid) => {
        setSelectedParticipants(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
    };
    const selectRandom = (count) => {
        if (!sortedUsers.length) return;
        const shuffled = [...sortedUsers].sort(() => Math.random() - 0.5);
        setSelectedParticipants(shuffled.slice(0, count).map(u => u.id.split('_')[1]));
    };
    const startChallenge = async () => {
        if (!promptText.trim()) return toast('Add a prompt');
        if (!selectedParticipants.length) return toast('Select at least one participant');
        const promptId = `${Date.now()}`;
        await updateRoom({
            activeMode: 'selfie_challenge',
            selfieChallenge: {
                prompt: promptText.trim(),
                promptId,
                participants: selectedParticipants,
                status: 'collecting',
                requireApproval,
                autoStartVoting,
                createdAt: Date.now()
            }
        });
        toast('Selfie Challenge started');
    };
    const startVoting = async () => {
        if (!challenge) return;
        await updateRoom({ selfieChallenge: { ...challenge, status: 'voting' } });
        toast('Voting started');
    };
    const endChallenge = async () => {
        if (!challenge) return;
        const voteCounts = selfieVotes.reduce((acc, v) => {
            acc[v.targetUid] = (acc[v.targetUid] || 0) + 1;
            return acc;
        }, {});
        const sorted = [...eligibleSubmissions].sort((a, b) => (voteCounts[b.uid] || 0) - (voteCounts[a.uid] || 0));
        const winner = sorted[0] ? {
            uid: sorted[0].uid,
            name: sorted[0].userName,
            avatar: sorted[0].avatar,
            url: sorted[0].url,
            votes: voteCounts[sorted[0].uid] || 0
        } : null;
        await updateRoom({ selfieChallenge: { ...challenge, status: 'ended', winner, winnerExpiresAt: Date.now() + 12000 } });
        if (winner) {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), {
                roomCode,
                user: 'SELFIE CHALLENGE',
                text: `${winner.name} won the selfie challenge!`,
                icon: 'WIN',
                timestamp: serverTimestamp()
            });
        }
        toast('Winner selected');
    };
    const closeChallenge = async () => {
        await updateRoom({ activeMode: 'karaoke', selfieChallenge: null });
        toast('Selfie Challenge closed');
    };
    const generatePrompt = async () => {
        setAiLoading(true);
        const res = await generateAIContent('selfie_prompt', []);
        if (Array.isArray(res) && res.length) {
            setAiPrompt(res[0]);
            setPromptText(res[0]);
        }
        setAiLoading(false);
    };

    useEffect(() => {
        if (!challenge?.promptId) return;
        const t = setTimeout(() => {
            setRequireApproval(!!challenge.requireApproval);
            setAutoStartVoting(!!challenge.autoStartVoting);
        }, 0);
        return () => clearTimeout(t);
    }, [challenge?.promptId, challenge?.requireApproval, challenge?.autoStartVoting]);

    useEffect(() => {
        if (!challenge?.promptId) {
            const t = setTimeout(() => {
                setSelfieSubmissions([]);
                setSelfieVotes([]);
            }, 0);
            return () => clearTimeout(t);
        }
        const submissionsQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_submissions'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', challenge.promptId)
        );
        const votesQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_votes'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', challenge.promptId)
        );
        const unsubSubs = onSnapshot(submissionsQuery, s => {
            setSelfieSubmissions(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubVotes = onSnapshot(votesQuery, s => {
            setSelfieVotes(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { unsubSubs(); unsubVotes(); };
    }, [challenge?.promptId, roomCode]);

    useEffect(() => {
        if (!challenge?.promptId || challenge.status !== 'collecting') return;
        if (!autoStartVoting) return;
        if (!challenge.participants?.length) return;
        const eligible = challenge.requireApproval
            ? selfieSubmissions.filter(s => s.approved)
            : selfieSubmissions;
        if (eligible.length < challenge.participants.length) return;
        if (autoStartRef.current === challenge.promptId) return;
        autoStartRef.current = challenge.promptId;
        updateRoom({ selfieChallenge: { ...challenge, status: 'voting' } });
    }, [autoStartVoting, challenge, selfieSubmissions, updateRoom]);

    return (
        <div className={`${STYLES.panel} p-4 border border-pink-500/20`}>
            <div className="flex items-center justify-between mb-3">
                <div>
                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Selfie Challenge</div>
                    <div className="text-xl font-bold text-white">Pick participants + prompt</div>
                </div>
                {challenge && (
                    <div className="text-xs text-cyan-400">Status: {challenge.status || 'collecting'}</div>
                )}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                    <div className="text-sm uppercase tracking-widest text-zinc-500">Prompt</div>
                    <textarea value={promptText} onChange={e=>setPromptText(e.target.value)} className={`${STYLES.input} h-20`} placeholder="Give us your best Blue Steel face..." />
                    <div className="flex gap-2">
                        <button onClick={() => { const p = SELFIE_PROMPTS[Math.floor(Math.random() * SELFIE_PROMPTS.length)]; setPromptText(p); }} className={`${STYLES.btnStd} ${STYLES.btnInfo} flex-1`}>
                            RANDOM PRESET
                        </button>
                        <button onClick={generatePrompt} className={`${STYLES.btnStd} ${STYLES.btnHighlight} flex-1`}>
                            {aiLoading ? 'GENERATING' : 'AI PROMPT'}
                        </button>
                    </div>
                    {aiPrompt && <div className="text-xs text-zinc-400">AI: {aiPrompt}</div>}
                </div>
                <div className="space-y-3">
                    <div className="text-sm uppercase tracking-widest text-zinc-500">Participants</div>
                    <div className="flex gap-2">
                        <button onClick={() => setSelectedParticipants(sortedUsers.map(u => u.id.split('_')[1]))} className={`${STYLES.btnStd} ${STYLES.btnNeutral} flex-1`}>Select all</button>
                        <button onClick={() => selectRandom(3)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} flex-1`}>Random 3</button>
                        <button onClick={() => selectRandom(5)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} flex-1`}>Random 5</button>
                    </div>
                    <div className="flex gap-2">
                        <label className="flex items-center gap-2 text-xs text-zinc-400">
                            <input type="checkbox" checked={requireApproval} onChange={e => setRequireApproval(e.target.checked)} />
                            Require approval
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-400">
                            <input type="checkbox" checked={autoStartVoting} onChange={e => setAutoStartVoting(e.target.checked)} />
                            Auto-start voting
                        </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {sortedUsers.map(u => {
                            const uid = u.id.split('_')[1];
                            const selected = selectedParticipants.includes(uid);
                            return (
                                <button key={u.id} onClick={() => toggleParticipant(uid)} className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-left ${selected ? 'border-[#00C4D9] bg-[#00C4D9]/10' : 'border-zinc-700 bg-zinc-900/60'}`}>
                                    <span className="text-xl">{u.avatar || 'O'}</span>
                                    <span className="text-xs text-zinc-200 truncate">{u.name || 'Singer'}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-500 mt-2">
                <div>
                    {autoStartVoting && (
                        <span>Auto-start when all selected submit.</span>
                    )}
                </div>
                {challenge?.status === 'collecting' && autoStartVoting && (
                    <span>{eligibleSubmissions.length}/{challenge.participants?.length || 0} submitted</span>
                )}
            </div>
            <div className="flex gap-2 mt-4">
                <button onClick={startChallenge} className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1`}>Start challenge</button>
                <button onClick={startVoting} className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1`}>Start voting</button>
                <button onClick={endChallenge} className={`${STYLES.btnStd} ${STYLES.btnDanger} flex-1`}>End + winner</button>
                <button onClick={closeChallenge} className={`${STYLES.btnStd} ${STYLES.btnNeutral} flex-1`}>Close</button>
            </div>
            {challenge && (
                <div className="mt-4 border-t border-white/10 pt-4">
                    <div className="text-sm uppercase tracking-widest text-zinc-500 mb-2">Submissions ({selfieSubmissions.length})</div>
                    <div className="grid grid-cols-5 gap-3 max-h-56 overflow-y-auto custom-scrollbar pr-2">
                        {selfieSubmissions.map(s => (
                            <div key={s.id} className="bg-zinc-900/70 border border-zinc-700 rounded-xl overflow-hidden">
                                <img src={s.url} className="w-full h-24 object-cover" />
                                <div className="p-2 text-sm text-zinc-300 flex items-center justify-between">
                                    <span className="truncate">{s.userName}</span>
                                    <span className="text-cyan-400 font-bold">{selfieVotes.filter(v => v.targetUid === s.uid).length}</span>
                                </div>
                                {requireApproval && (
                                    <button
                                        onClick={() => updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_submissions', s.id), { approved: !s.approved })}
                                        className={`${STYLES.btnStd} ${s.approved ? STYLES.btnHighlight : STYLES.btnNeutral} w-full rounded-none`}
                                    >
                                        {s.approved ? 'APPROVED' : 'APPROVE'}
                                    </button>
                                )}
                            </div>
                        ))}
                        {selfieSubmissions.length === 0 && (
                            <div className="col-span-5 text-center text-zinc-500 text-sm">No submissions yet.</div>
                        )}
                    </div>
                </div>
            )}
      </div> 
    );
};

// --- GALLERY TAB ---
const GalleryTab = ({ roomCode, room, updateRoom }) => {
    const [photos, setPhotos] = useState([]);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    useEffect(() => {
        const q = query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), where('roomCode', '==', roomCode), where('type', '==', 'photo'));
        const unsub = onSnapshot(q, s => setPhotos(s.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => b.timestamp - a.timestamp)));
        return () => unsub();
    }, [roomCode]);

    const pushToTV = async (photo) => {
        await updateRoom({ photoOverlay: { url: photo.url, userName: photo.userName, timestamp: serverTimestamp() } });
        setSelectedPhoto(photo.id);
        setTimeout(() => setSelectedPhoto(null), 5000);
    };
    
    const pushToQueue = async (photo) => {
        await updateRoom({ photoOverlay: { url: photo.url, userName: photo.userName, timestamp: serverTimestamp() }, featuredPhotoId: photo.id });
    };
    
    const deletePhoto = (id) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'reactions', id));

    const featured = room?.featuredPhotoId ? photos.find(p => p.id === room.featuredPhotoId) : null;

    return (
        <div className="h-full flex flex-col p-4 overflow-hidden gap-4">
            {featured && (
                <div className={`${STYLES.panel} p-4 border-2 border-yellow-500 bg-yellow-900/20`}>
                    <div className="text-xs text-yellow-400 font-bold mb-2 flex items-center gap-2">
                        <i className="fa-solid fa-star"></i> Currently displayed
                    </div>
                    <div className="flex gap-4 items-end">
                        <img src={featured.url} className="h-32 w-auto rounded-lg object-cover border-2 border-yellow-500/30" />
                        <div className="flex-1">
                            <div className="text-sm font-bold text-yellow-300 mb-2">{featured.userName}</div>
                            <button onClick={() => updateRoom({featuredPhotoId: null})} className={`${STYLES.btnStd} ${STYLES.btnDanger} w-full`}>
                                <i className="fa-solid fa-trash mr-2"></i> Remove from display
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className={STYLES.header}>INCOMING PHOTOS ({photos.length})</div>
                <div className="grid grid-cols-5 gap-3 overflow-y-auto custom-scrollbar flex-1">
                    {photos.map(p => (
                        <div key={p.id} className={`relative group bg-zinc-800 rounded-xl overflow-hidden shadow-lg transition-all ${selectedPhoto === p.id ? 'ring-2 ring-cyan-400' : ''}`}>
                            <img src={p.url} className="w-full h-32 object-cover" />
                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                                <button 
                                    onClick={() => pushToTV(p)} 
                                    title="Show on TV for 5 seconds"
                                    className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-2 py-1 text-sm w-full`}
                                >
                                    <i className="fa-solid fa-tv mr-1"></i> TV PREVIEW
                                </button>
                                <button 
                                    onClick={() => pushToQueue(p)} 
                                    title="Keep displayed on TV"
                                    className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-2 py-1 text-sm w-full`}
                                >
                                    <i className="fa-solid fa-thumbtack mr-1"></i> PIN
                                </button>
                                <button 
                                    onClick={() => deletePhoto(p.id)} 
                                    className={`${STYLES.btnStd} ${STYLES.btnDanger} px-2 py-1 text-sm w-full`}
                                >
                                    <i className="fa-solid fa-trash mr-1"></i> DEL
                                </button>
                            </div>
                            <div className="absolute bottom-1 left-1 bg-black/80 px-2 py-1 rounded text-sm font-bold text-white truncate max-w-[90%]">
                                {p.userName}
                            </div>
                        </div>
                    ))}
                    {photos.length === 0 && (
                        <div className="col-span-5 flex flex-col items-center justify-center text-zinc-500 py-12">
                            <i className="fa-solid fa-camera text-4xl mb-2 opacity-50"></i>
                            <div className="text-sm">Turn on Selfie Cam to receive photos</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const QueueTab = ({ songs, room, roomCode, appBase, updateRoom, logActivity, localLibrary, playSfxSafe, toggleHowToPlay, startStormSequence, stopStormSequence, startBeatDrop, users, dropBonus, giftPointsToUser, tipPointRate, setTipPointRate, marqueeEnabled, setMarqueeEnabled, sfxMuted, setSfxMuted, sfxLevel, sfxVolume, setSfxVolume, searchSources, setSearchSources, ytIndex, setYtIndex, persistYtIndex, autoDj, setAutoDj, autoBgMusic, setAutoBgMusic, startReadyCheck, chatShowOnTv, setChatShowOnTv, chatUnread, dmUnread, chatEnabled, setChatEnabled, chatAudienceMode, setChatAudienceMode, chatDraft, setChatDraft, chatMessages, sendHostChat, sendHostDmMessage, itunesBackoffRemaining, pinnedChatIds, setPinnedChatIds, chatViewMode, handleChatViewMode, appleMusicAuthorized, appleMusicPlaying, appleMusicStatus, playAppleMusicTrack, pauseAppleMusic, resumeAppleMusic, autoDjCountdown, hostName, fetchTop100Art, connectAppleMusic, openChatSettings, dmTargetUid, setDmTargetUid, dmDraft, setDmDraft, silenceAll }) => {
    const [stagePanelOpen, setStagePanelOpen] = useState(true);
    const [tvControlsOpen, setTvControlsOpen] = useState(true);
    const [soundboardOpen, setSoundboardOpen] = useState(true);
    const [chatOpen, setChatOpen] = useState(true);
    const [overlaysOpen, setOverlaysOpen] = useState(true);
    const [vibeSyncOpen, setVibeSyncOpen] = useState(true);
    const [automationOpen, setAutomationOpen] = useState(true);
    const [crowdPointsOpen, setCrowdPointsOpen] = useState(true);

    const SectionHeader = ({ label, open, onToggle, toneClass = '' }) => (
        <button
            onClick={onToggle}
            className={`w-full flex items-center justify-between ${STYLES.header} ${toneClass}`}
        >
            <span>{label}</span>
            <i className={`fa-solid fa-chevron-down transition-transform ${open ? 'rotate-180' : ''}`}></i>
        </button>
    );
    const [searchQ, setSearchQ] = useState('');
    const [showAddForm, setShowAddForm] = useState(true);
    const [results, setResults] = useState([]); 
    const [manual, setManual] = useState({ song:'', artist:'', singer: hostName || 'Host', url:'', art: '', lyrics: '', lyricsTimed: null, appleMusicId: '', duration: 180, backingAudioOnly: false, audioOnly: false }); 
    const [giftTargetUid, setGiftTargetUid] = useState('');
    const [giftAmount, setGiftAmount] = useState('');
    const [lyricsOpen, setLyricsOpen] = useState(false);
    const [manualSingerMode, setManualSingerMode] = useState('select');
    const [editingSongId, setEditingSongId] = useState(null); 
    const [editForm, setEditForm] = useState({ title: '', artist: '', singer: '', url: '', art: '', lyrics: '', lyricsTimed: null, appleMusicId: '', duration: 180 }); 
    const [customBonus, setCustomBonus] = useState('');
    const [showQueueList, setShowQueueList] = useState(true);
      const [ytSearchOpen, setYtSearchOpen] = useState(false);
      const [ytSearchTarget, setYtSearchTarget] = useState('manual');
    const [ytSearchQ, setYtSearchQ] = useState('');
    const [ytEditingQuery, setYtEditingQuery] = useState(false);
    const [ytResults, setYtResults] = useState([]);
    const [ytLoading, setYtLoading] = useState(false);
    const [ytSearchError, setYtSearchError] = useState('');
    const [embedCache, setEmbedCache] = useState({}); // { videoId: 'ok'|'fail'|'testing' }
    const [_testingVideoId, setTestingVideoId] = useState(null);
    const [_previewIframe, _setPreviewIframe] = useState(null);
    const [dragQueueId, setDragQueueId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);
    const touchDragIdRef = useRef(null);
    const toast = useToast() || console.log;
    const roomChatMessages = chatMessages.filter(msg => !msg.toHost);
    const hostDmMessages = chatMessages.filter(msg => msg.toHost || msg.toUid);
    const isChatPopout = typeof window !== 'undefined'
        && new URLSearchParams(window.location.search).get('chat') === '1';
    const chatSectionOpen = isChatPopout ? true : chatOpen;
    const renderChatSection = (containerClass = 'px-4 py-4 border-b border-white/10') => (
        <section className={containerClass}>
            <SectionHeader
                label="Chat"
                open={chatSectionOpen}
                onToggle={() => {
                    if (isChatPopout) return;
                    setChatOpen(v => !v);
                }}
            />
            <div className={chatSectionOpen ? 'block' : 'hidden'}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        {chatUnread && <span className="text-sm uppercase tracking-widest text-pink-300">New</span>}
                        <button
                            onClick={() => openChatSettings?.()}
                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 py-1`}
                            title="Open chat settings"
                        >
                            <i className="fa-solid fa-gear"></i>
                        </button>
                        {!isChatPopout && (
                            <button
                                onClick={() => {
                                    const target = `${appBase}?room=${roomCode}&mode=host&tab=stage&chat=1`;
                                    window.open(target, '_blank');
                                }}
                                className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 py-1`}
                                title="Pop out chat"
                            >
                                <i className="fa-solid fa-up-right-from-square"></i>
                            </button>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    <button
                        onClick={async () => {
                            const next = !chatEnabled;
                            setChatEnabled(next);
                            await updateRoom({ chatEnabled: next });
                        }}
                        className={`${STYLES.btnStd} ${chatEnabled ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                        title="Enable or disable chat for the room"
                    >
                        <i className="fa-solid fa-comment mr-2"></i>{chatEnabled ? 'On' : 'Off'}
                    </button>
                    <button
                        onClick={async () => {
                            const next = !chatShowOnTv;
                            setChatShowOnTv(next);
                            await updateRoom({ chatShowOnTv: next });
                        }}
                        className={`${STYLES.btnStd} ${chatShowOnTv ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                        title="Show chat in the TV rotation"
                    >
                        <i className="fa-solid fa-tv mr-2"></i>{chatShowOnTv ? 'TV' : 'TV Off'}
                    </button>
                    <button
                        onClick={async () => {
                            const next = chatAudienceMode === 'vip' ? 'all' : 'vip';
                            setChatAudienceMode(next);
                            await updateRoom({ chatAudienceMode: next });
                        }}
                        className={`${STYLES.btnStd} ${chatAudienceMode === 'vip' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                        title="Toggle VIP-only chat"
                    >
                        <i className="fa-solid fa-crown mr-2"></i>{chatAudienceMode === 'vip' ? 'VIP' : 'All'}
                    </button>
                </div>
                <div className="mb-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Room Chat</div>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {roomChatMessages.length === 0 && (
                            <div className="text-xs text-zinc-500">No chat messages yet.</div>
                        )}
                        {roomChatMessages.map((msg, idx) => (
                            <div key={`${msg.timestamp?.seconds || idx}`} className="text-xs text-zinc-200">
                                <span className="text-zinc-500">{msg.name || 'Guest'}:</span> {msg.text}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="mb-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">DMs</div>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {hostDmMessages.length === 0 && (
                            <div className="text-xs text-zinc-500">No DMs yet.</div>
                        )}
                        {hostDmMessages.map((msg, idx) => (
                            <div key={`${msg.timestamp?.seconds || idx}`} className="text-xs text-zinc-200">
                                <span className="text-zinc-500">{msg.name || 'Guest'}:</span> {msg.text}
                            </div>
                        ))}
                    </div>
                </div>
                {chatViewMode === 'room' && (
                    <div className="mt-3 flex gap-2">
                        <input
                            value={chatDraft}
                            onChange={e => setChatDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendHostChat();
                                }
                            }}
                            className={`${STYLES.input} text-xs flex-1`}
                            placeholder="Message the room..."
                            title="Send a message to the audience"
                        />
                        <button onClick={sendHostChat} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3`} title="Send chat message">
                            <i className="fa-solid fa-paper-plane mr-2"></i>Send
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
    
    const current = songs.find(s => s.status === 'performing'); 
    const hasLyrics = !!current?.lyrics || (Array.isArray(current?.lyricsTimed) && current.lyricsTimed.length > 0);
    const queue = songs.filter(s => s.status === 'requested').sort((a,b) => (a.priorityScore || 0) - (b.priorityScore || 0));
    const nextQueued = queue[0];
    const lobbyCount = users?.length || 0;
    const queueCount = queue.length;
    const waitTimeSec = queue.reduce((sum, s) => {
        const duration = Number(s.duration);
        return sum + (Number.isFinite(duration) && duration > 0 ? duration : 300);
    }, 0);
    const formatWaitTime = (seconds) => {
        if (!seconds) return '0m';
        const mins = Math.floor(seconds / 60);
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        if (hrs > 0) return `${hrs}h ${remMins}m`;
        return `${mins}m`;
    };
    const pending = songs.filter(s => s.status === 'pending');

    if (isChatPopout) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-saira p-4">
                <div className={`${STYLES.panel} p-4`}>
                    {renderChatSection('')}
                </div>
            </div>
        );
    }

    const reorderQueue = async (fromId, toId) => {
        if (!fromId || !toId || fromId === toId) return;
        const list = [...queue];
        const fromIdx = list.findIndex(s => s.id === fromId);
        const toIdx = list.findIndex(s => s.id === toId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        const base = Date.now();
        await Promise.all(list.map((item, idx) =>
            updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', item.id), { priorityScore: base + idx })
        ));
        toast('Queue reordered');
    };
    const handleTouchStart = (id) => {
        touchDragIdRef.current = id;
    };
    const handleTouchMove = (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const row = el?.closest('[data-queue-id]');
        if (row) {
            setDragOverId(row.getAttribute('data-queue-id'));
        }
    };
    const handleTouchEnd = () => {
        if (touchDragIdRef.current && dragOverId) {
            reorderQueue(touchDragIdRef.current, dragOverId);
        }
        touchDragIdRef.current = null;
        setDragOverId(null);
    };
    const isAudioUrl = (url) => /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(url || '');

    // Hybrid Search Logic
    useEffect(() => { 
        if(searchQ.length < 3) { setResults([]); return; } 
        let controller;
        const t = setTimeout(async () => { 
            controller = new AbortController();
            // 1. Local Search
            const localMatches = searchSources.local
                ? localLibrary.filter(s =>
                    s.title.toLowerCase().includes(searchQ.toLowerCase()) ||
                    s.artist.toLowerCase().includes(searchQ.toLowerCase()) ||
                    (s.fileName || '').toLowerCase().includes(searchQ.toLowerCase())
                ).map(s => ({ ...s, source: 'local', trackName: s.title, artistName: s.artist, artworkUrl100: '' }))
                : [];
            const ytMatches = searchSources.youtube
                ? ytIndex.filter(s =>
                    s.trackName.toLowerCase().includes(searchQ.toLowerCase()) ||
                    s.artistName.toLowerCase().includes(searchQ.toLowerCase())
                )
                : [];

            try { 
                // 2. iTunes Search
                if (!searchSources.itunes) {
                    setResults([...localMatches, ...ytMatches]);
                    return;
                }
                const data = await callFunction('itunesSearch', { term: searchQ, limit: 5 });
                const itunesMatches = (data?.results || []).map(r => ({ ...r, source: 'itunes' }));
                setResults([...localMatches, ...ytMatches, ...itunesMatches]); 
            } catch(e) { 
                if (e.name === 'AbortError') return;
                setResults([...localMatches, ...ytMatches]);
            } 
        }, 500); 
        return () => {
            clearTimeout(t);
            if (controller) controller.abort();
        }; 
    }, [searchQ, localLibrary, ytIndex, searchSources]);

    const handleResultClick = async (r) => {
        const audioOnly = r.mediaType === 'audio' || isAudioUrl(r.url);
        if (r.source === 'local') {
            setManual({ ...manual, song: r.trackName, artist: r.artistName, url: r.url, art: '', audioOnly, appleMusicId: '', duration: manual.duration || 180 });
        } else if (r.source === 'youtube') {
            setManual({ ...manual, song: r.trackName, artist: r.artistName, url: r.url, art: r.artworkUrl100, audioOnly: false, appleMusicId: '', duration: manual.duration || 180 });
        } else {
            const appleId = r.trackId ? String(r.trackId) : '';
            setManual({ ...manual, song: r.trackName, artist: r.artistName, url: '', art: r.artworkUrl100.replace('100x100','600x600'), audioOnly: true, appleMusicId: appleId, duration: manual.duration || 180 });
        }

        if (r.source === 'local' && r.url) {
            const duration = await resolveDurationForUrl(r.url, audioOnly);
            if (duration) setManual(prev => ({ ...prev, duration }));
        }
        if (r.source === 'youtube' && r.url) {
            const duration = await resolveDurationForUrl(r.url, false);
            if (duration) setManual(prev => ({ ...prev, duration }));
        }
        setResults([]); setSearchQ('');
    };

    const fetchEmbedStatuses = async (videoIds = []) => {
        const ids = videoIds.filter(Boolean);
        if (!ids.length) return;
        try {
            const data = await callFunction('youtubeStatus', { ids });
            const statusMap = new Map();
            (data?.items || []).forEach(item => {
                statusMap.set(item.id, item.embeddable ? 'ok' : 'fail');
            });
            setEmbedCache(prev => {
                const next = { ...prev };
                ids.forEach(id => {
                    if (statusMap.has(id)) next[id] = statusMap.get(id);
                });
                return next;
            });
        } catch (e) {
            console.error('Embed status fetch failed', e);
        }
    };
    const searchYouTubeIndex = (query) => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return ytIndex
            .filter(item => {
                const title = (item.trackName || '').toLowerCase();
                const artist = (item.artistName || '').toLowerCase();
                return title.includes(q) || artist.includes(q);
            })
            .slice(0, 10)
            .map(item => ({
                id: item.videoId,
                title: item.trackName,
                channel: item.artistName || 'YouTube',
                thumbnail: item.artworkUrl100,
                url: item.url
            }));
    };
    const searchYouTube = async (queryOverride) => {
        const query = (queryOverride ?? ytSearchQ).trim();
        if (!query) return;
        setYtLoading(true);
        setYtSearchError('');
        try {
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Search timed out.')), 8000));
            const data = await Promise.race([
                callFunction('youtubeSearch', { query: `${query} karaoke`, maxResults: 10 }),
                timeout
            ]);
            const results = (data?.items || []).map(item => ({
                id: item.id,
                title: item.title,
                channel: item.channelTitle,
                thumbnail: item.thumbnails?.medium?.url || item.thumbnails?.default?.url || '',
                url: `https://www.youtube.com/watch?v=${item.id}`
            }));
            setYtResults(results);
            const updated = (() => {
                const existing = new Map(ytIndex.map(item => [item.videoId, item]));
                results.forEach(item => {
                    existing.set(item.id, {
                        videoId: item.id,
                        source: 'youtube',
                        trackName: item.title,
                        artistName: item.channel,
                        artworkUrl100: item.thumbnail,
                        url: item.url
                    });
                });
                return Array.from(existing.values());
            })();
            if (persistYtIndex) {
                persistYtIndex(updated);
            } else {
                setYtIndex(updated);
            }
            fetchEmbedStatuses(results.map(item => item.id));
        } catch (e) {
            console.error("YouTube search error:", e);
            const fallbackResults = searchYouTubeIndex(query);
            if (fallbackResults.length) {
                setYtResults(fallbackResults);
                setYtSearchError('Live YouTube search failed. Showing indexed playlist results.');
            } else {
                setYtSearchError(e?.message || 'YouTube search failed. Check server configuration.');
            }
        } finally {
            setYtLoading(false);
        }
    };


    const parseYouTubeId = (url = '') => {
        const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
        return match ? match[1] : '';
    };
    const getMediaDurationFromUrl = (url, audioOnly = false) => new Promise((resolve) => {
        if (!url) return resolve(null);
        const media = document.createElement(audioOnly ? 'audio' : 'video');
        media.preload = 'metadata';
        media.crossOrigin = 'anonymous';
        const cleanup = () => {
            media.removeAttribute('src');
            media.load();
        };
        const timeout = setTimeout(() => {
            cleanup();
            resolve(null);
        }, 4000);
        media.onloadedmetadata = () => {
            clearTimeout(timeout);
            const duration = Number.isFinite(media.duration) ? Math.round(media.duration) : null;
            cleanup();
            resolve(duration);
        };
        media.onerror = () => {
            clearTimeout(timeout);
            cleanup();
            resolve(null);
        };
        media.src = url;
    });
    const fetchYouTubeDuration = async (url) => {
        const id = parseYouTubeId(url);
        if (!id) return null;
        try {
            const data = await callFunction('youtubeDetails', { ids: [id] });
            return data?.items?.[0]?.durationSec || null;
        } catch {
            return null;
        }
    };
    const resolveDurationForUrl = async (url, audioOnly = false) => {
        if (!url) return null;
        const ytId = parseYouTubeId(url);
        if (ytId) return await fetchYouTubeDuration(url);
        return await getMediaDurationFromUrl(url, audioOnly);
    };

    const openYtSearch = (target, query) => {
        const nextQuery = (query || '').trim();
        setYtSearchTarget(target);
        setYtSearchQ(nextQuery);
        setYtSearchOpen(true);
        setYtEditingQuery(false);
        if (nextQuery) {
            setTimeout(() => searchYouTube(nextQuery), 0);
        }
    };

    const manualBackingChip = (() => {
        const ytId = manual.url ? parseYouTubeId(manual.url) : null;
        if (manual.appleMusicId || !manual.url) {
            return { label: 'Apple Music', tone: 'cyan' };
        }
        if (ytId) {
            return { label: 'YouTube', tone: 'red' };
        }
        return { label: 'Custom', tone: 'cyan' };
    })();
    const statusPill = "px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest border bg-black/40 text-zinc-200 border-white/10";


      const applyDurationToEdit = async (url) => {
          const duration = await resolveDurationForUrl(url, false);
          if (duration) setEditForm(prev => ({ ...prev, duration }));
      };
      const applyDurationToManual = async (url) => {
          const duration = await resolveDurationForUrl(url, false);
          if (duration) setManual(prev => ({ ...prev, duration }));
      };

      const selectYouTubeVideo = (video) => {
          const isFailed = embedCache[video.id] === 'fail';
          const displayTitle = video.title.replace(' (Karaoke)', '').replace(' Karaoke', '');
          
          if (ytSearchTarget === 'edit') {
              setEditForm(prev => ({
                  ...prev,
                  title: prev.title || displayTitle || '',
                  artist: prev.artist || video.channel || '',
                  url: video.url || prev.url
              }));
              applyDurationToEdit(video.url || editForm.url);
          } else {
              setManual(prev => ({
                  ...prev,
                  song: prev.song || displayTitle || '',
                  artist: prev.artist || video.channel || '',
                  url: video.url,
                  duration: prev.duration || 180,
                  // Mark if this is a backing audio only (failed embed)
                  backingAudioOnly: isFailed ? true : false
              }));
              applyDurationToManual(video.url);
          }
          setYtSearchOpen(false);
          setYtSearchQ('');
          setYtResults([]);
          toast(isFailed ? `${EMOJI.radio} Will open as backing audio` : `${EMOJI.check} Video selected!`);
      };

      const syncEditDuration = async () => {
          if (!editForm.url) {
              toast('Add a media URL first');
              return;
          }
          const duration = await resolveDurationForUrl(editForm.url, isAudioUrl(editForm.url));
          if (duration) {
              setEditForm(prev => ({ ...prev, duration }));
              toast(`Duration set to ${duration}s`);
          } else {
              toast('Could not read duration');
          }
      };

    const testEmbedVideo = (video) => {
        if (embedCache[video.id]) return; // Already tested
        
        setTestingVideoId(video.id);
        setEmbedCache(prev => ({ ...prev, [video.id]: 'testing' }));
        
        // Try to load iframe
        // Use onload/onerror to detect embeddability
        const img = new Image();
        img.onload = () => {
            setEmbedCache(prev => ({ ...prev, [video.id]: 'ok' }));
            setTestingVideoId(null);
            toast(`${EMOJI.check} Video can be embedded!`);
        };
        img.onerror = () => {
            setEmbedCache(prev => ({ ...prev, [video.id]: 'fail' }));
            setTestingVideoId(null);
            toast(`${EMOJI.cross} Video cannot be embedded - try another`);
        };
        // Set a timeout for the test
        setTimeout(() => {
            if (embedCache[video.id] === 'testing') {
                setEmbedCache(prev => ({ ...prev, [video.id]: 'ok' }));
                setTestingVideoId(null);
                toast(`${EMOJI.check} Video should work!`);
            }
        }, 2000);
        
        // Attempt to load a pixel from the iframe (hacky but works)
        img.src = `https://www.youtube.com/embed/${video.id}?start=0`;
    };

    const addSong = async () => {
        if(!manual.song) return;
        const manualTitle = manual.song;
        const manualArtist = manual.artist || 'Unknown';
        const songRecord = await ensureSong({
            title: manualTitle,
            artist: manualArtist,
            artworkUrl: manual.art || '',
            appleMusicId: manual.appleMusicId || '',
            verifyMeta: manual.art ? {} : false,
            verifiedBy: hostName || 'host'
        });
        const songId = songRecord?.songId || buildSongKey(manualTitle, manualArtist);
        const youtubeId = extractYouTubeId(manual.url || '');
        const trackSource = manual.appleMusicId
            ? 'apple'
            : youtubeId
                ? 'youtube'
                : manual.url
                    ? 'custom'
                    : '';
        const trackRecord = trackSource
            ? await ensureTrack({
                songId,
                source: trackSource,
                mediaUrl: manual.url || '',
                appleMusicId: manual.appleMusicId || '',
                duration: manual.duration ? Math.round(manual.duration) : null,
                audioOnly: manual.audioOnly || isAudioUrl(manual.url),
                backingOnly: !!manual.backingAudioOnly,
                addedBy: hostName || 'Host'
            })
            : null;
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
             roomCode,
             songId,
             trackId: trackRecord?.trackId || null,
             trackSource: trackSource || null,
             songTitle: manualTitle,
             artist: manualArtist,
             singerName: manual.singer,
             mediaUrl: manual.url,
             albumArtUrl: manual.art || '',
             lyrics: manual.lyrics || '',
             lyricsTimed: manual.lyricsTimed || null,
             appleMusicId: manual.appleMusicId || '',
             musicSource: manual.appleMusicId ? 'apple' : '',
             lyricsSource: manual.lyricsTimed ? 'apple' : (manual.lyrics ? 'manual' : ''),
             duration: manual.duration ? Math.round(manual.duration) : 180,
             status: 'requested', timestamp: serverTimestamp(), priorityScore: Date.now(), emoji: EMOJI.mic,
             backingAudioOnly: manual.backingAudioOnly || false, // Mark if video can only play as audio
             audioOnly: manual.audioOnly || isAudioUrl(manual.url)
        });
        setManual({ song:'', artist:'', singer:'Host', url:'', art:'', lyrics: '', lyricsTimed: null, appleMusicId: '', duration: 180, backingAudioOnly: false, audioOnly: false }); setSearchQ(''); toast("Song Added!");
    };

    const addSongFromResult = async (r) => {
        if (!r?.trackName) return;
        const isApple = r.source === 'itunes';
        const appleId = isApple ? String(r.trackId || '') : '';
        let songId = buildSongKey(r.trackName, r.artistName || 'Unknown');
        try {
            const songRecord = await ensureSong({
                title: r.trackName,
                artist: r.artistName || 'Unknown',
                artworkUrl: r.source === 'itunes' ? r.artworkUrl100?.replace('100x100','600x600') : r.artworkUrl100 || '',
                itunesId: isApple ? r.trackId : '',
                appleMusicId: appleId,
                verifyMeta: { lyricsSource: null, lyricsTimed: false },
                verifiedBy: hostName || 'host'
            });
            songId = songRecord?.songId || songId;
        } catch (err) {
            console.warn('ensureSong failed', err);
        }
        const trackSource = isApple ? 'apple' : (r.source === 'youtube' ? 'youtube' : r.source === 'local' ? 'custom' : '');
        let trackRecord = null;
        if (trackSource) {
            try {
                trackRecord = await ensureTrack({
                    songId,
                    source: trackSource,
                    mediaUrl: r.source === 'youtube' || r.source === 'local' ? r.url : '',
                    appleMusicId: appleId,
                    duration: manual.duration || null,
                    audioOnly: isApple ? true : r.mediaType === 'audio' || isAudioUrl(r.url),
                    backingOnly: false,
                    addedBy: hostName || 'Host'
                });
            } catch (err) {
                console.warn('ensureTrack failed', err);
            }
        }
        const nextSong = {
            song: r.trackName,
            artist: r.artistName || '',
            singer: manual.singer || room?.hostName || hostName || 'Host',
            url: r.source === 'youtube' ? r.url : r.source === 'local' ? r.url : '',
            art: r.source === 'itunes' ? r.artworkUrl100.replace('100x100','600x600') : r.artworkUrl100 || '',
            lyrics: '',
            lyricsTimed: null,
            appleMusicId: appleId,
            duration: manual.duration || 180,
            backingAudioOnly: false,
            audioOnly: isApple ? true : r.mediaType === 'audio' || isAudioUrl(r.url)
        };
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
                roomCode,
                songId,
                trackId: trackRecord?.trackId || null,
                trackSource: trackSource || null,
                songTitle: nextSong.song,
                artist: nextSong.artist,
                singerName: nextSong.singer,
                mediaUrl: nextSong.url,
                albumArtUrl: nextSong.art || '',
                lyrics: '',
                lyricsTimed: null,
                appleMusicId: nextSong.appleMusicId,
                musicSource: nextSong.appleMusicId ? 'apple' : '',
                lyricsSource: '',
                duration: nextSong.duration ? Math.round(nextSong.duration) : 180,
                status: 'requested',
                timestamp: serverTimestamp(),
                priorityScore: Date.now(),
                emoji: EMOJI.mic,
                backingAudioOnly: nextSong.backingAudioOnly || false,
                audioOnly: nextSong.audioOnly || isAudioUrl(nextSong.url)
            });
        } catch (err) {
            console.warn('Failed to queue song', err);
            toast('Could not add song (permissions)');
            return;
        }
        toast('Song added to queue');
        if (nextSong.appleMusicId) {
            await playAppleMusicTrack(nextSong.appleMusicId, { title: nextSong.song, artist: nextSong.artist });
        } else if (nextSong.url) {
            await updateRoom({
                activeMode: 'karaoke',
                'announcement.active': false,
                mediaUrl: nextSong.url,
                singAlongMode: false,
                videoPlaying: true,
                videoStartTimestamp: Date.now(),
                videoVolume: 100,
                showLyricsTv: false,
                showVisualizerTv: false,
                showLyricsSinger: false
            });
        }
        setSearchQ('');
        setResults([]);
    };

    const _queueBrowseSong = async (song, singerOverride) => {
        if (!song?.title) return;
        const art = await fetchTop100Art(song);
        const songRecord = await ensureSong({
            title: song.title,
            artist: song.artist || 'Unknown',
            artworkUrl: art || song.art || '',
            verifyMeta: art || song.art ? {} : false,
            verifiedBy: hostName || 'host'
        });
        const songId = songRecord?.songId || buildSongKey(song.title, song.artist || 'Unknown');
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
            roomCode,
            songId,
            songTitle: song.title,
            artist: song.artist,
            singerName: singerOverride || room?.hostName || hostName || 'Host',
            mediaUrl: '',
            albumArtUrl: art || song.art || '',
            status: 'requested',
            timestamp: serverTimestamp(),
            priorityScore: Date.now(),
            emoji: EMOJI.mic,
            backingAudioOnly: false,
            audioOnly: false
        });
        toast('Added to queue');
    };

    const triggerHallOfFameMoment = async ({ songId, singerName, songTitle } = {}) => {
        if (!roomCode) return;
        if (hallOfFameTimerRef.current) {
            clearTimeout(hallOfFameTimerRef.current);
        }
        await updateRoom({
            activeMode: 'selfie_cam',
            selfieMoment: {
                type: 'hall_of_fame',
                songId,
                singerName,
                songTitle,
                timestamp: Date.now()
            },
            selfieMomentExpiresAt: Date.now() + 12000
        });
        hallOfFameTimerRef.current = setTimeout(() => {
            updateRoom({ activeMode: 'karaoke', selfieMoment: null });
        }, 12000);
    };
    const getTimestampMs = (value) => {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (typeof value?.toMillis === 'function') return value.toMillis();
        if (typeof value?.seconds === 'number') return value.seconds * 1000;
        return 0;
    };
    const logPerformance = async (songEntry) => {
        if (!songEntry?.songTitle) return;
        try {
            const safeTitle = songEntry.songTitle;
            const safeArtist = songEntry.artist || 'Unknown';
            const fallbackSongId = buildSongKey(safeTitle, safeArtist);
            const applauseScore = Math.round(songEntry.applauseScore || 0);
            const hypeScore = Math.round(songEntry.hypeScore || 0);
            const hostBonus = Math.round(songEntry.hostBonus || 0);

            const res = await callFunction('logPerformance', {
                roomCode,
                songId: songEntry.songId || null,
                songTitle: safeTitle,
                artist: safeArtist,
                singerName: songEntry.singerName || '',
                singerUid: songEntry.singerUid || null,
                albumArtUrl: songEntry.albumArtUrl || '',
                mediaUrl: songEntry.mediaUrl || '',
                appleMusicId: songEntry.appleMusicId || '',
                duration: songEntry.duration || null,
                audioOnly: !!songEntry.audioOnly,
                backingAudioOnly: !!songEntry.backingAudioOnly,
                trackId: songEntry.trackId || null,
                trackSource: songEntry.trackSource || null,
                applauseScore,
                hypeScore,
                hostBonus,
                hostName: hostName || 'Host'
            });

            const songId = res?.songId || songEntry.songId || fallbackSongId;
            const trackId = res?.trackId || songEntry.trackId || null;
            if (songId && (songId !== songEntry.songId || trackId !== songEntry.trackId)) {
                await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songEntry.id), {
                    songId,
                    trackId: trackId || null
                });
            }

            const totalScore = Number(res?.totalScore ?? (hypeScore + applauseScore + hostBonus));
            if (res?.isNewAllTime) {
                await logActivity(roomCode, songEntry.singerName || '', `set a new global high score for ${songId}`, EMOJI.star);
                await updateRoom({
                    lastPerformance: {
                        ...songEntry,
                        songId,
                        albumArtUrl: songEntry.albumArtUrl || '',
                        hallOfFame: {
                            newAllTime: true,
                            songId,
                            bestScore: totalScore,
                            applauseScore: Number(res?.applauseScore ?? applauseScore)
                        },
                        timestamp: Date.now()
                    }
                });
                await triggerHallOfFameMoment({
                    songId,
                    singerName: songEntry.singerName || '',
                    songTitle: safeTitle
                });
            }
        } catch (err) {
            console.error('Failed to log performance', err);
        }
    };

    const updateStatus = async (id, status) => { 
        if(status==='performing') { 
            const current = songs.find(x => x.status === 'performing');
            if (current && current.id !== id) {
                toast('Another singer is already on stage');
                return;
            }
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', id), { status }); 
            const s = songs.find(x=>x.id===id);
            const hasMedia = !!(s?.mediaUrl || s?.youtubeId || s?.appleMusicId);
            const autoStartMedia = hasMedia && (room?.autoPlayMedia !== false);
            if (s?.appleMusicId && autoStartMedia) {
                await playAppleMusicTrack(s.appleMusicId, { title: s.songTitle, artist: s.artist });
                await updateRoom({
                    activeMode: 'karaoke',
                    'announcement.active': false,
                    mediaUrl: '',
                    singAlongMode: false,
                    videoPlaying: false,
                    videoStartTimestamp: null,
                    videoVolume: 100,
                    showLyricsTv: false,
                    showVisualizerTv: false,
                    showLyricsSinger: false
                });
            } else {
                await updateRoom({
                    activeMode: 'karaoke',
                    'announcement.active': false,
                    mediaUrl: s?.mediaUrl || '',
                    singAlongMode: false,
                    videoPlaying: autoStartMedia,
                    videoStartTimestamp: autoStartMedia ? Date.now() : null,
                    videoVolume: 100,
                    showLyricsTv: false,
                    showVisualizerTv: false,
                    showLyricsSinger: false,
                    appleMusicPlayback: null
                });
            }
            logActivity(roomCode, s.singerName, `took the stage!`, EMOJI.mic);
            return;
        }
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', id), { status }); 
        if(status==='performed') { 
            const s = songs.find(x=>x.id===id); 
            if(s) { 
                const topFan = (() => {
                    if (!users?.length) return null;
                    const performanceId = s.id || null;
                    const ranked = users
                        .filter((u) => !performanceId || u.lastPerformanceId === performanceId)
                        .map((u) => ({
                            name: u.name || 'Guest',
                            avatar: u.avatar || EMOJI.sparkle,
                            pointsGifted: u.performancePointsGifted || 0
                        }))
                        .sort((a, b) => (b.pointsGifted || 0) - (a.pointsGifted || 0));
                    const best = ranked[0];
                    if (!best || best.pointsGifted <= 0) return null;
                    return best;
                })();
                const vibeStats = (() => {
                    const guitarSessionId = room?.guitarSessionId;
                    const strobeSessionId = room?.strobeSessionId;
                    const stats = { guitar: null, strobe: null };
                    if (guitarSessionId) {
                        let totalHits = 0;
                        let top = null;
                        users.forEach((u) => {
                            if (u.guitarSessionId !== guitarSessionId) return;
                            const hits = u.guitarHits || 0;
                            totalHits += hits;
                            if (!top || hits > top.hits) top = { name: u.name || 'Guest', avatar: u.avatar || EMOJI.guitar, hits };
                        });
                        if (totalHits > 0) stats.guitar = { totalHits, top };
                    }
                    if (strobeSessionId) {
                        let totalTaps = 0;
                        let top = null;
                        users.forEach((u) => {
                            if (u.strobeSessionId !== strobeSessionId) return;
                            const taps = u.strobeTaps || 0;
                            totalTaps += taps;
                            if (!top || taps > top.taps) top = { name: u.name || 'Guest', avatar: u.avatar || EMOJI.rocket, taps };
                        });
                        if (totalTaps > 0) stats.strobe = { totalTaps, top };
                    }
                    return (stats.guitar || stats.strobe) ? stats : null;
                })();
                await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', id), { applauseScore: room?.applausePeak||0 }); 
                await updateRoom({ lastPerformance: { ...s, applauseScore: room?.applausePeak||0, timestamp: Date.now(), albumArtUrl: s.albumArtUrl || '', topFan, vibeStats }, activeMode: 'karaoke', mediaUrl: '', singAlongMode: false, videoPlaying: false, showLyricsTv: false, showVisualizerTv: false, showLyricsSinger: false, appleMusicPlayback: null }); 
                await logPerformance({ ...s, applauseScore: room?.applausePeak || 0 });
                logActivity(roomCode, s.singerName, `crushed ${s.songTitle}!`, EMOJI.star);
                toast("Performance Finished"); 
            } 
        } 
    };

    const startEdit = (s) => { setEditingSongId(s.id); setEditForm({ title: s.songTitle, artist: s.artist, singer: s.singerName, url: s.mediaUrl || '', art: s.albumArtUrl || '', lyrics: s.lyrics || '', lyricsTimed: s.lyricsTimed || null, appleMusicId: s.appleMusicId || '', duration: s.duration || 180 }); }; 
    const saveEdit = async () => {
        const durationNum = Number(editForm.duration);
        const safeDuration = Number.isFinite(durationNum) && durationNum > 0 ? Math.round(durationNum) : 180;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', editingSongId), {
            songTitle: editForm.title,
            artist: editForm.artist,
            singerName: editForm.singer,
            mediaUrl: editForm.url,
            albumArtUrl: editForm.art,
            lyrics: editForm.lyrics,
            lyricsTimed: editForm.lyricsTimed || null,
            appleMusicId: editForm.appleMusicId || '',
            musicSource: editForm.appleMusicId ? 'apple' : '',
            lyricsSource: editForm.lyricsTimed ? 'apple' : (editForm.lyrics ? 'manual' : ''),
            duration: safeDuration,
            audioOnly: isAudioUrl(editForm.url)
        });
        setEditingSongId(null); toast("Song Updated");
    };
    const generateLyrics = async () => {
        if(!editForm.title || !editForm.artist) return toast("Needs Title & Artist");
        toast("Generating Lyrics...");
        const res = await generateAIContent('lyrics', { title: editForm.title, artist: editForm.artist });
        if(res && res.lyrics) { setEditForm(prev => ({ ...prev, lyrics: res.lyrics })); toast("Lyrics Generated!"); } else { toast("Gen Failed"); }
    };

    const addBonusToCurrent = async (amt) => { if (!current) return; await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', current.id), { hostBonus: increment(amt) }); toast(`Added ${amt} Bonus Pts!`); };

    // Improved Toggle Logic
    const togglePlay = () => {
        const now = Date.now();
        if (room?.videoPlaying) {
            updateRoom({ videoPlaying: false, pausedAt: now });
        } else {
            let newStart = room?.videoStartTimestamp || now;
            if (room?.pausedAt && room?.videoStartTimestamp) {
                const elapsedBeforePause = room.pausedAt - room.videoStartTimestamp;
                newStart = now - elapsedBeforePause;
            } else if (!room?.videoStartTimestamp) {
                 newStart = now;
            }
            updateRoom({ videoPlaying: true, videoStartTimestamp: newStart, pausedAt: null });
        }
    };
    
    // Helper to open youtube search
    const _openYT = (query) => {
        if (!query) return;
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' karaoke')}`, '_blank');
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden relative">
            {/* YOUTUBE SEARCH MODAL */}
            {ytSearchOpen && (
                <div className="absolute inset-0 z-[70] bg-black/70 flex items-center justify-center p-6 backdrop-blur-sm pointer-events-none">
                    <div className={`${STYLES.panel} p-6 w-full max-w-2xl border-white/20 max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto`}>
                        <div className="flex justify-between items-center mb-4">
                        <div className={STYLES.header}>Search YouTube</div>
                            <button onClick={() => setYtSearchOpen(false)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3`}>X</button>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="text-xs text-zinc-400">
                                Searching for: <span className="text-white font-bold">{ytSearchQ || '...'}</span>
                            </div>
                            <button
                                onClick={() => setYtEditingQuery(prev => !prev)}
                                className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3`}
                            >
                                {ytEditingQuery ? 'Done' : 'Edit'}
                            </button>
                        </div>
                        {ytEditingQuery && (
                            <div className="flex gap-2 mb-4">
                                <input 
                                    value={ytSearchQ} 
                                    onChange={e => setYtSearchQ(e.target.value)} 
                                    onKeyPress={e => e.key === 'Enter' && searchYouTube()}
                                    className={STYLES.input} 
                                    placeholder="Refine search..."
                                />
                                <button 
                                    onClick={() => searchYouTube()} 
                                    disabled={ytLoading}
                                    className={`${STYLES.btnStd} ${ytLoading ? STYLES.btnNeutral : STYLES.btnHighlight} px-6 flex-shrink-0`}
                                >
                                    {ytLoading ? EMOJI.refresh : EMOJI.magnifier}
                                </button>
                            </div>
                        )}
                        {ytSearchError && (
                            <div className="bg-red-900/30 border border-red-500/40 text-red-200 text-xs rounded-lg px-3 py-2 mb-3">
                                {ytSearchError}
                            </div>
                        )}
                        <div className="flex-1 min-h-0">
                            {ytResults.length > 0 && (
                                <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1 pb-2">
                                    {ytResults.map(video => {
                                        const embedStatus = embedCache[video.id];
                                        const isOk = embedStatus === 'ok';
                                        const isFail = embedStatus === 'fail';
                                        const isTesting = embedStatus === 'testing';
                                        
                                        return (
                                            <div key={video.id} className={`bg-zinc-800/50 hover:bg-zinc-700 p-3 rounded-lg border transition-all flex gap-3 items-start ${isFail ? 'border-red-500/50 opacity-60' : isOk ? 'border-green-500/50' : 'border-white/10 hover:border-cyan-400'}`}>
                                                <img src={video.thumbnail} className="w-24 h-16 rounded object-cover flex-shrink-0"/>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-white truncate">{video.title}</div>
                                                    <div className="text-sm text-zinc-400 truncate">{video.channel}</div>
                                                    
                                                    {/* Embed Status & Actions */}
                                                    <div className="flex gap-2 mt-2 items-center">
                                                        {isTesting && <span className="text-sm text-yellow-400 animate-pulse">{EMOJI.refresh} Testing...</span>}
                                                        {isOk && <span className="text-sm text-green-400 font-bold">{EMOJI.check} Embeddable</span>}
                                                        {isFail && <span className="text-sm text-red-400 font-bold">{EMOJI.cross} Can't Embed</span>}
                                                        
                                                        {!isFail && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); testEmbedVideo(video); }}
                                                                disabled={isTesting}
                                                                className={`text-sm px-2 py-0.5 rounded ${isTesting ? 'bg-zinc-600 text-zinc-400' : isOk ? 'bg-green-900/50 text-green-300' : 'bg-yellow-900/50 text-yellow-300 hover:bg-yellow-800/50'}`}
                                                            >
                                                                {EMOJI.test} {isOk ? 'Verified' : 'Test'}
                                                            </button>
                                                        )}
                                                        
                                                        <button 
                                                            onClick={() => selectYouTubeVideo(video)}
                                                            className={`ml-auto text-sm px-3 py-0.5 rounded font-bold flex items-center gap-1 ${isFail ? 'bg-orange-900/50 text-orange-300 hover:bg-orange-800/50' : 'bg-cyan-600 text-white hover:bg-cyan-500'}`}
                                                        >
                                                            {isFail ? (
                                                                <>{EMOJI.radio} USE</>
                                                            ) : (
                                                                <>USE</>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        
                        {ytSearchQ && ytResults.length === 0 && !ytLoading && (
                            <div className="host-search-helper text-center py-8">No results found</div>
                        )}
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {editingSongId && (
               <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
                   <div className={`${STYLES.panel} p-6 w-full max-w-lg border-white/20 space-y-3`}>
                       <div className={STYLES.header}>EDIT SONG METADATA</div>
                       <div className="grid grid-cols-2 gap-2">
                           <input value={editForm.title} onChange={e=>setEditForm({...editForm, title:e.target.value})} className={STYLES.input} placeholder="Title"/>
                           <input value={editForm.artist} onChange={e=>setEditForm({...editForm, artist:e.target.value})} className={STYLES.input} placeholder="Artist"/>
                       </div>
                       <div className="flex gap-2 items-center">
                           <input value={editForm.url} onChange={e=>setEditForm({...editForm, url:e.target.value})} className={`${STYLES.input} flex-1`} placeholder="Media URL (YouTube/MP4)"/>
                           <button onClick={() => openYtSearch('edit', `${editForm.title} ${editForm.artist}`.trim())} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-[#00C4D9] border-[#00C4D9]`} title="Search YouTube"><i className="fa-brands fa-youtube"></i> Find</button>
                       </div>
                       
                       <div className={STYLES.header}>LYRICS & TIMING</div>
                       <div className="flex gap-2 items-center bg-black/20 p-2 rounded">
                           <span className="text-sm text-zinc-400">Duration:</span>
                           <input type="range" min="60" max="600" value={editForm.duration} onChange={e=>setEditForm({...editForm, duration:e.target.value})} className="flex-1 accent-pink-500"/>
                           <span className="text-sm font-mono w-10 text-right">{editForm.duration}s</span>
                           <button onClick={syncEditDuration} className="text-sm px-2 py-1 rounded border border-cyan-400/40 text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20" title="Sync duration from URL">Sync</button>
                       </div>
                       <div className="text-sm text-zinc-500">Used only when lyrics have no sync data (AI or manual). Sets scroll speed.</div>
                       <textarea value={editForm.lyrics} onChange={e=>setEditForm({...editForm, lyrics:e.target.value})} className={`${STYLES.input} h-32 font-mono host-lyrics-input`} placeholder="Paste lyrics here..."></textarea>
                       
                       <div className="flex gap-2">
                            <button onClick={generateLyrics} className={`${STYLES.btnStd} ${STYLES.btnInfo} flex-1`}>{EMOJI.robot} Auto-generate (AI)</button>
                       </div>
                       
                       <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-white/10">
                           <button onClick={()=>setEditingSongId(null)} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>Cancel</button>
                           <button onClick={saveEdit} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-8`}>Save changes</button>
                       </div>
                   </div>
               </div>
            )}

            {/* LEFT CONTROLS */}
            <div className="w-full md:w-96 flex-shrink-0 overflow-y-auto pr-2 custom-scrollbar">
                <div className={`${STYLES.panel} overflow-hidden`}>
                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Now Playing"
                            open={stagePanelOpen}
                            onToggle={() => setStagePanelOpen(v => !v)}
                        />
                        {stagePanelOpen && (
                        <>
                        <div className="flex justify-end items-center mb-2">
                            <div className="flex items-center gap-2">
                                {room?.activeMode === 'applause' && (<div className="text-[#00C4D9] animate-pulse font-bold">{EMOJI.mic} APPLAUSE!</div>)}
                                {room?.bouncerMode && (<div className="text-red-400 font-bold">{EMOJI.lock} LOCKED</div>)}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                            <div className="bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500">
                                    <i className="fa-solid fa-users text-cyan-300"></i> Lobby
                                </div>
                                <div className="text-lg font-bold text-white">{lobbyCount}</div>
                            </div>
                            <div className="bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500">
                                    <i className="fa-solid fa-list-ol text-emerald-300"></i> Queue
                                </div>
                                <div className="text-lg font-bold text-white">{queueCount}</div>
                            </div>
                            <div className="bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-500">
                                    <i className="fa-solid fa-clock text-amber-300"></i> Est. Wait
                                </div>
                                <div className="text-lg font-bold text-white">{formatWaitTime(waitTimeSec)}</div>
                            </div>
                        </div>
                        {current ? ( <div className="text-center relative"> 
                            {current.backingAudioOnly && (
                                <div className="text-[12px] text-orange-400 font-bold mb-2 bg-orange-900/30 p-1 rounded border border-orange-500/30 flex items-center justify-center gap-1">
                                    <i className="fa-solid fa-window-restore"></i> BACKING AUDIO (Opens in popup)
                                </div>
                            )}
                            <div className="text-xl font-bold">{current.songTitle}</div> 
                            <div className="text-fuchsia-400 mb-3">{current.singerName}</div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <button onClick={togglePlay} className={`${STYLES.btnStd} ${room?.videoPlaying ? STYLES.btnNeutral : STYLES.btnPrimary}`}>
                                    <i className={`fa-solid ${room?.videoPlaying ? 'fa-pause' : 'fa-play'} mr-2`}></i>
                                    {room?.videoPlaying ? 'Pause' : 'Play'}
                                </button>
                                <button onClick={()=>updateRoom({videoPlaying: true, videoStartTimestamp: Date.now()})} className={`${STYLES.btnStd} ${STYLES.btnSecondary}`}>
                                    <i className="fa-solid fa-rotate-left mr-2"></i>Restart
                                </button>
                                <button onClick={()=>window.open(current.mediaUrl, '_blank')} className={`${STYLES.btnStd} ${STYLES.btnSecondary}`}>
                                    <i className="fa-solid fa-up-right-from-square mr-2"></i>Pop out
                                </button>
                                <button
                                    onClick={()=>updateRoom({audienceVideoMode: room?.audienceVideoMode === 'force' ? 'off' : 'force'})}
                                    className={`${STYLES.btnStd} ${room?.audienceVideoMode === 'force' ? STYLES.btnHighlight : STYLES.btnSecondary}`}
                                    title="Push the stage video to phones"
                                >
                                    <i className="fa-solid fa-tv mr-2"></i>Audience sync
                                </button>
                            </div>
                            {hasLyrics && (
                                <div className="bg-black/30 border border-white/10 rounded-lg p-2 mb-3">
                                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">TV Display Mode</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={() => updateRoom({ showLyricsTv: false, showVisualizerTv: false })}
                                            className={`${STYLES.btnStd} ${!room?.showLyricsTv && !room?.showVisualizerTv ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                        >
                                            <i className="fa-solid fa-video mr-2"></i>Video
                                        </button>
                                        <button
                                            onClick={() => updateRoom({ showLyricsTv: true, showVisualizerTv: false, lyricsMode: room?.lyricsMode || 'auto' })}
                                            className={`${STYLES.btnStd} ${room?.showLyricsTv ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                        >
                                            <i className="fa-solid fa-closed-captioning mr-2"></i>Lyrics
                                        </button>
                                        <button
                                            onClick={() => updateRoom({ showLyricsTv: false, showVisualizerTv: true })}
                                            className={`${STYLES.btnStd} ${room?.showVisualizerTv ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                        >
                                            <i className="fa-solid fa-wave-square mr-2"></i>Visualizer
                                        </button>
                                    </div>
                                </div>
                            )}
                            {current?.lyrics && (
                                <div className="bg-black/30 border border-white/10 rounded-lg p-2 mb-3">
                                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">Lyrics View</div>
                                    <div className="flex gap-2">
                                        <button onClick={()=>updateRoom({lyricsMode: 'auto'})} className={`${STYLES.btnStd} ${room?.lyricsMode !== 'full' ? STYLES.btnHighlight : STYLES.btnNeutral} flex-1`}>Auto scroll</button>
                                        <button onClick={()=>updateRoom({lyricsMode: 'full'})} className={`${STYLES.btnStd} ${room?.lyricsMode === 'full' ? STYLES.btnHighlight : STYLES.btnNeutral} flex-1`}>Full view</button>
                                    </div>
                                </div>
                            )}
                            <div className="bg-black/30 border border-white/10 rounded-lg p-2 mb-3">
                                <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">TV Visualizer Style</div>
                                <select
                                    value={room?.visualizerMode || 'ribbon'}
                                    onChange={(e) => updateRoom({ visualizerMode: e.target.value })}
                                    className={`${STYLES.input} w-full`}
                                >
                                    <option value="ribbon">Liquid ribbon</option>
                                    <option value="rings">Neon rings</option>
                                    <option value="spark">Pulse sparkline</option>
                                    <option value="waveform">Waveform</option>
                                </select>
                            </div>
                            {(current?.mediaUrl || current?.appleMusicId) && (
                                <div className="bg-black/30 border border-white/10 rounded-lg p-2 mb-3">
                                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">Now Playing</div>
                                    <div className="text-xs text-zinc-100 uppercase tracking-widest">
                                        <span className={`${current?.appleMusicId ? 'text-emerald-300' : (current?.mediaUrl || '').includes('youtube') ? 'text-red-300' : 'text-cyan-200'}`}>
                                            {current?.appleMusicId ? 'Apple Music' : (current?.mediaUrl || '').includes('youtube') ? 'YouTube' : 'Local'}
                                        </span>
                                        <span className="text-zinc-400 mx-2">•</span>
                                        <span className="text-white/90">{current?.songTitle}</span>
                                        <span className="text-zinc-400 ml-2">({current?.appleMusicId ? (room?.appleMusicPlayback?.status === 'paused' ? 'Paused' : 'Live') : (room?.videoPlaying ? 'Playing' : 'Paused')})</span>
                                    </div>
                                </div>
                            )}
                            {current?.appleMusicId && (
                                <div className="bg-black/30 border border-white/10 rounded-lg p-2 mb-3">
                                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-400 mb-2">Apple Music Playback</div>
                                    <div className="flex flex-wrap gap-2">
                                        {!appleMusicAuthorized ? (
                                            <button onClick={connectAppleMusic} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1`}>
                                                <i className="fa-brands fa-apple mr-2"></i>Connect
                                            </button>
                                        ) : (
                                            <>
                                                <button onClick={() => playAppleMusicTrack(current.appleMusicId, { title: current.songTitle, artist: current.artist })} className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1`}>
                                                    <i className="fa-solid fa-play mr-2"></i>Play
                                                </button>
                                                <button onClick={() => (appleMusicPlaying ? pauseAppleMusic() : resumeAppleMusic())} className={`${STYLES.btnStd} ${appleMusicPlaying ? STYLES.btnSecondary : STYLES.btnPrimary} flex-1`}>
                                                    <i className={`fa-solid ${appleMusicPlaying ? 'fa-pause' : 'fa-play'} mr-2`}></i>
                                                    {appleMusicPlaying ? 'Pause' : 'Resume'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    {appleMusicStatus ? (
                                        <div className="mt-2 text-sm text-zinc-400">{appleMusicStatus}</div>
                                    ) : null}
                                </div>
                            )}
                            <button onClick={() => startEdit(current)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} w-full mt-3`}>
                                <i className="fa-solid fa-pen-to-square mr-2"></i>Edit current song
                            </button>
                            {room?.applausePeak !== undefined && room?.applausePeak !== null && (
                                <div className="mt-3 text-xs text-zinc-300 bg-zinc-900/60 border border-zinc-700 rounded-lg px-3 py-2 flex items-center justify-between">
                                    <span className="uppercase tracking-widest text-zinc-400">Last Applause</span>
                                    <span className="text-[#00C4D9] font-bold">{Math.round(room.applausePeak)} dB</span>
                                </div>
                            )}
                            <div className="mt-3 pt-3 border-t border-white/10 flex gap-2 items-center">
                                <input type="number" value={customBonus} onChange={e=>setCustomBonus(e.target.value)} className={`${STYLES.input} w-20`} placeholder="Pts"/>
                                <button onClick={()=>addBonusToCurrent(parseInt(customBonus)||0)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} w-1/2`}>
                                    <i className="fa-solid fa-gift mr-2"></i>Bonus
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-2 mt-3">
                                <button onClick={()=>updateRoom({activeMode: room?.activeMode === 'applause' ? 'karaoke' : 'applause_countdown', applausePeak: 0})} className={`${STYLES.btnStd} ${STYLES.btnPrimary}`}>
                                    <i className="fa-solid fa-microphone-lines mr-2"></i>Measure applause
                                </button>
                                <button onClick={()=>updateStatus(current.id, 'performed')} className={`${STYLES.btnStd} ${STYLES.btnSecondary}`}>
                                    <i className="fa-solid fa-flag-checkered mr-2"></i>End performance
                                </button>
                            </div>
                        </div> ) : ( <div className="text-center py-4 text-zinc-500">Stage Empty</div> )} 
                        </>
                        )}
                    </section>

                    <section className="px-4 py-4 border-b border-white/10 space-y-3">
                        <SectionHeader
                            label="TV Dashboard Controls"
                            open={tvControlsOpen}
                            onToggle={() => setTvControlsOpen(v => !v)}
                        />
                        <div className={tvControlsOpen ? 'block' : 'hidden'}>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">PUBLIC TV LAYOUT</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-zinc-900/60 p-2 rounded-xl border border-white/10">
                            <button
                                onClick={()=>updateRoom({layoutMode: 'standard'})}
                                className={`${STYLES.btnStd} ${room?.layoutMode==='standard' ? STYLES.btnHighlight : STYLES.btnNeutral} justify-center px-2`}
                                title="Full layout with overlays and stats"
                            >
                                <i className="fa-solid fa-desktop mr-2"></i> Standard
                            </button>
                            <button
                                onClick={()=>updateRoom({layoutMode: 'minimal'})}
                                className={`${STYLES.btnStd} ${room?.layoutMode==='minimal' ? STYLES.btnHighlight : STYLES.btnNeutral} justify-center px-2`}
                                title="Compact layout for small screens"
                            >
                                <i className="fa-solid fa-window-minimize mr-2"></i> Minimal
                            </button>
                            <button
                                onClick={()=>updateRoom({layoutMode: 'cinema'})}
                                className={`${STYLES.btnStd} ${room?.layoutMode==='cinema' ? STYLES.btnHighlight : STYLES.btnNeutral} justify-center px-2`}
                                title="Video-first layout with minimal UI"
                            >
                                <i className="fa-solid fa-film mr-2"></i> Cinema
                            </button>
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Screen elements</div>
                        <div className="grid grid-cols-2 gap-2">
                            <ToggleSwitch checked={!room?.hideWaveform} onChange={(v)=>updateRoom({hideWaveform: !v})} icon={<i className="fa-solid fa-wave-square"></i>} label="Waveform" />
                            <ToggleSwitch checked={!room?.hideOverlay} onChange={(v)=>updateRoom({hideOverlay: !v})} icon={<i className="fa-solid fa-layer-group"></i>} label="Overlay" />
                            <ToggleSwitch checked={!room?.hideLogo} onChange={(v)=>updateRoom({hideLogo: !v})} icon={<i className="fa-solid fa-star"></i>} label="Logo" />
                            <button onClick={()=>updateRoom({hideCornerOverlay: !room?.hideCornerOverlay})} className={`${STYLES.btnStd} ${room?.hideCornerOverlay ? STYLES.btnNeutral : STYLES.btnPrimary} flex-1`}><i className="fa-solid fa-user mr-2"></i>On Stage</button>
                            <ToggleSwitch checked={room?.showScoring !== false} onChange={(v)=>updateRoom({showScoring: v})} icon={<i className="fa-solid fa-chart-line"></i>} label="Score HUD" />
                        </div>

                        </div>
                    </section>

                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Automation"
                            open={automationOpen}
                            onToggle={() => setAutomationOpen(v => !v)}
                        />
                        <div className={automationOpen ? 'grid grid-cols-2 gap-2' : 'hidden'}>
                            <button
                                onClick={async () => {
                                    const next = !autoDj;
                                    setAutoDj(next);
                                    await updateRoom({ autoDj: next });
                                }}
                                className={`${STYLES.btnStd} ${autoDj ? STYLES.btnPrimary : STYLES.btnNeutral} flex-1`}
                                title="Auto-advance the queue after each performance"
                            >
                                <i className="fa-solid fa-forward-fast mr-2"></i>Auto-Progress Queue
                            </button>
                            <ToggleSwitch checked={!!room?.bouncerMode} onChange={(v)=>updateRoom({bouncerMode: v})} icon={<i className="fa-solid fa-lock"></i>} label="Bouncer" />
                            <button
                                onClick={async () => {
                                    const next = !(room?.autoPlayMedia !== false);
                                    await updateRoom({ autoPlayMedia: !next });
                                }}
                                className={`${STYLES.btnStd} ${(room?.autoPlayMedia !== false) ? STYLES.btnPrimary : STYLES.btnNeutral}`}
                                title="Auto-play media when a singer starts"
                            >
                                <i className="fa-solid fa-play mr-2"></i>Auto-play media
                            </button>
                            <button
                                onClick={async () => {
                                    const next = !autoBgMusic;
                                    setAutoBgMusic(next);
                                    await updateRoom({ autoBgMusic: next });
                                    if (next && !playingBg) setBgMusicState(true);
                                }}
                                className={`${STYLES.btnStd} ${autoBgMusic ? STYLES.btnPrimary : STYLES.btnNeutral}`}
                                title="Keep BG music rolling between songs"
                            >
                                <i className="fa-solid fa-compact-disc mr-2"></i>Auto BG music
                            </button>
                        </div>
                    </section>

                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Overlays & Guides"
                            open={overlaysOpen}
                            onToggle={() => setOverlaysOpen(v => !v)}
                        />
                        <div className={overlaysOpen ? 'grid grid-cols-2 gap-2' : 'hidden'}>
                            <button onClick={()=>updateRoom({activeScreen: room?.activeScreen==='leaderboard'?'stage':'leaderboard'})} className={`${STYLES.btnStd} ${room?.activeScreen==='leaderboard'?STYLES.btnHighlight:STYLES.btnNeutral} flex-1`}><i className="fa-solid fa-trophy mr-2"></i>Leaderboard</button>
                            <button onClick={()=>updateRoom({activeScreen: room?.activeScreen==='tipping'?'stage':'tipping'})} className={`${STYLES.btnStd} ${room?.activeScreen==='tipping'?STYLES.btnHighlight:STYLES.btnNeutral} flex-1`}><i className="fa-solid fa-money-bill-wave mr-2"></i>Tip CTA</button>
                            <button onClick={toggleHowToPlay} className={`${STYLES.btnStd} ${room?.howToPlay?.active ? STYLES.btnHighlight : STYLES.btnNeutral} flex-1`}><i className="fa-solid fa-circle-question mr-2"></i>How to Play</button>
                            <button onClick={startReadyCheck} className={`${STYLES.btnStd} ${room?.readyCheck?.active ? STYLES.btnHighlight : STYLES.btnPrimary} flex-1`}><i className="fa-solid fa-check mr-2"></i>Ready Check</button>
                            <button
                                onClick={async () => {
                                    const next = !marqueeEnabled;
                                    setMarqueeEnabled(next);
                                    await updateRoom({ marqueeEnabled: next });
                                }}
                                className={`${STYLES.btnStd} ${marqueeEnabled ? STYLES.btnHighlight : STYLES.btnNeutral} flex-1`}
                            >
                                <i className="fa-solid fa-scroll mr-2"></i>Marquee
                            </button>
                            <button
                                onClick={async () => {
                                    const next = !chatShowOnTv;
                                    setChatShowOnTv(next);
                                    await updateRoom({ chatShowOnTv: next });
                                }}
                                className={`${STYLES.btnStd} ${chatShowOnTv ? STYLES.btnHighlight : STYLES.btnNeutral} flex-1 relative`}
                                title="Rotate chat onto the TV feed"
                            >
                                <i className="fa-solid fa-comments mr-2"></i>Chat TV
                                {chatUnread && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-pink-400"></span>
                                )}
                            </button>
                        </div>
                        <div className="mt-3">
                            <SectionHeader
                                label="Vibe Sync"
                                open={vibeSyncOpen}
                                onToggle={() => setVibeSyncOpen(v => !v)}
                            />
                        </div>
                        <div className={vibeSyncOpen ? 'rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/10 via-zinc-900/60 to-zinc-900/80 p-3 shadow-[0_0_24px_rgba(236,72,153,0.15)]' : 'hidden'}>
                            <div className="flex items-center gap-2 text-sm uppercase tracking-widest text-pink-200 mb-3">
                                <i className="fa-solid fa-wand-magic-sparkles"></i> Vibe Sync
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                <button
                                    onClick={() => (room?.lightMode === 'strobe' ? updateRoom({ lightMode: 'off' }) : startBeatDrop())}
                                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.lightMode==='strobe' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`}
                                    title="5s countdown, then 15s tap battle"
                                >
                                    <i className="fa-solid fa-bolt"></i> Beat Drop
                                </button>
                                <button onClick={() => {
                                    if (room?.lightMode === 'guitar') {
                                        updateRoom({ lightMode: 'off' });
                                    } else {
                                        updateRoom({ lightMode: 'guitar', guitarSessionId: Date.now(), guitarWinner: null, guitarVictory: null });
                                    }
                                }} className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.lightMode==='guitar' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`} title="Guitar vibe sync takeover"><i className="fa-solid fa-guitar"></i> Guitar</button>
                                <button onClick={()=>updateRoom({lightMode: room?.lightMode === 'banger' ? 'off' : 'banger'})} className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.lightMode==='banger' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`} title="High-energy fire visuals"><i className="fa-solid fa-fire"></i> Banger</button>
                                <button onClick={()=>updateRoom({lightMode: room?.lightMode === 'ballad' ? 'off' : 'ballad'})} className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.lightMode==='ballad' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`} title="Lighter sway mode"><i className="fa-solid fa-music"></i> Ballad</button>
                                <button
                                    onClick={() => (room?.lightMode === 'storm' ? stopStormSequence() : startStormSequence())}
                                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.lightMode==='storm' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`}
                                    title="Run the storm sequence"
                                >
                                    <i className="fa-solid fa-cloud-bolt"></i>
                                    {room?.lightMode === 'storm' ? `Storm (${room?.stormPhase || 'live'})` : 'Storm'}
                                </button>
                                <button onClick={() => updateRoom({ activeMode: room?.activeMode === 'selfie_cam' ? 'karaoke' : 'selfie_cam' })} className={`flex items-center justify-center gap-2 py-2 rounded-lg border ${room?.activeMode==='selfie_cam' ? 'bg-pink-500 text-black border-pink-300' : 'bg-zinc-900/80 text-zinc-200 border-white/10 hover:border-pink-400/40'}`} title="Audience selfie camera"><i className="fa-solid fa-camera"></i> Cam</button>
                            </div>
                        </div>
                    </section>

                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Soundboard"
                            open={soundboardOpen}
                            onToggle={() => setSoundboardOpen(v => !v)}
                        />
                        <div className={soundboardOpen ? 'block' : 'hidden'}>
                        <div className="flex items-center gap-3 bg-zinc-950/40 border border-white/10 rounded-xl p-2 mb-3">
                            <div className="text-sm uppercase tracking-widest text-zinc-400">FX Volume</div>
                            <SmallWaveform level={sfxMuted ? 0 : sfxLevel} className="h-6 w-16" color={['#00C4D9', '#EC4899']} />
                            <button
                                onClick={() => setSfxMuted(v => {
                                    const next = !v;
                                    if (next) silenceAll?.();
                                    return next;
                                })}
                                className={`${STYLES.btnStd} ${sfxMuted ? STYLES.btnHighlight : STYLES.btnNeutral} px-2 py-1 text-xs`}
                            >
                                <i className={`fa-solid ${sfxMuted ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                            </button>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={Math.round(sfxVolume * 100)}
                                onChange={e=>setSfxVolume(parseInt(e.target.value, 10) / 100)}
                                className="flex-1 h-2.5 bg-zinc-800 accent-[#00C4D9] rounded-lg appearance-none cursor-pointer"
                                style={{ background: `linear-gradient(90deg, #00E5FF ${Math.round(sfxVolume * 100)}%, #27272a ${Math.round(sfxVolume * 100)}%)` }}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {SOUNDS.map(s => (
                                <button key={s.name} onClick={()=>playSfxSafe(s.url)} className={`${STYLES.btnStd} ${STYLES.btnNeutral} truncate`}>
                                    <i className={`fa-solid ${s.icon} mr-2`}></i>
                                    {s.name}
                                </button>
                            ))}
                        </div>
                        </div>
                    </section>

                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Chat"
                            open={chatOpen}
                            onToggle={() => setChatOpen(v => !v)}
                        />
                        <div className={chatOpen ? 'block' : 'hidden'}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                {chatUnread && <span className="text-sm uppercase tracking-widest text-pink-300">New</span>}
                                <button
                                    onClick={() => openChatSettings?.()}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 py-1`}
                                    title="Open chat settings"
                                >
                                    <i className="fa-solid fa-gear"></i>
                                </button>
                                <button
                                    onClick={() => {
                                        const target = `${appBase}?room=${roomCode}&mode=host&tab=stage&chat=1`;
                                        window.open(target, '_blank');
                                    }}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 py-1`}
                                    title="Pop out chat"
                                >
                                    <i className="fa-solid fa-up-right-from-square"></i>
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                            <button
                                onClick={async () => {
                                    const next = !chatEnabled;
                                    setChatEnabled(next);
                                    await updateRoom({ chatEnabled: next });
                                }}
                                className={`${STYLES.btnStd} ${chatEnabled ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                title="Enable or disable chat for the room"
                            >
                                <i className="fa-solid fa-comment mr-2"></i>{chatEnabled ? 'On' : 'Off'}
                            </button>
                            <button
                                onClick={async () => {
                                    const next = !chatShowOnTv;
                                    setChatShowOnTv(next);
                                    await updateRoom({ chatShowOnTv: next });
                                }}
                                className={`${STYLES.btnStd} ${chatShowOnTv ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                title="Show chat in the TV rotation"
                            >
                                <i className="fa-solid fa-tv mr-2"></i>{chatShowOnTv ? 'TV' : 'TV Off'}
                            </button>
                            <button
                                onClick={async () => {
                                    const next = chatAudienceMode === 'vip' ? 'all' : 'vip';
                                    setChatAudienceMode(next);
                                    await updateRoom({ chatAudienceMode: next });
                                }}
                                className={`${STYLES.btnStd} ${chatAudienceMode === 'vip' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                title="Toggle VIP-only chat"
                            >
                                <i className="fa-solid fa-crown mr-2"></i>{chatAudienceMode === 'vip' ? 'VIP' : 'All'}
                            </button>
                        </div>
                        <div className="mb-3">
                            <div className="flex w-full bg-zinc-950/60 border border-white/10 rounded-t-xl overflow-hidden border-b-0">
                                <button
                                    onClick={() => handleChatViewMode('room')}
                                    className={`flex-1 px-4 py-2 text-sm font-bold uppercase tracking-widest transition-all ${chatViewMode === 'room' ? 'bg-[#00C4D9] text-black shadow-inner' : 'text-zinc-300 hover:text-white'}`}
                                    title="VIP lounge messages"
                                >
                                    <i className="fa-solid fa-comments mr-2"></i>VIP Lounge
                                    {chatUnread && <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-pink-400"></span>}
                                </button>
                                <button
                                    onClick={() => handleChatViewMode('host')}
                                    className={`flex-1 px-4 py-2 text-sm font-bold uppercase tracking-widest transition-all ${chatViewMode === 'host' ? 'bg-[#00C4D9] text-black shadow-inner' : 'text-zinc-300 hover:text-white'}`}
                                    title="Direct messages to the host"
                                >
                                    <i className="fa-solid fa-inbox mr-2"></i>DMs
                                    {dmUnread && <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-pink-400"></span>}
                                </button>
                            </div>
                            <div className="bg-zinc-900/60 border border-white/10 border-t-0 rounded-b-xl p-3 space-y-3">
                                {chatViewMode === 'host' && (
                                <div className="space-y-2">
                                    <div className={STYLES.header}>Direct Message</div>
                                    <div className="flex flex-wrap gap-2">
                                        <select
                                            value={dmTargetUid}
                                            onChange={(e) => setDmTargetUid(e.target.value)}
                                            className={`${STYLES.input} min-w-[160px] flex-1`}
                                        >
                                            <option value="">Select guest</option>
                                            {users.map((u) => {
                                                const id = u.uid || u.id?.split('_')[1] || '';
                                                return (
                                                    <option key={u.id || id} value={id}>
                                                        {u.name || 'Guest'}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    <input
                                        value={dmDraft}
                                        onChange={(e) => setDmDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                const message = dmDraft.trim();
                                                if (!dmTargetUid || !message) return;
                                                sendHostDmMessage(dmTargetUid, message);
                                                setDmDraft('');
                                            }
                                        }}
                                        className={`${STYLES.input} flex-[2] min-w-[200px]`}
                                        placeholder="Write a quick DM..."
                                    />
                                        <button
                                            onClick={() => {
                                                const message = dmDraft.trim();
                                                if (!dmTargetUid || !message) return;
                                                sendHostDmMessage(dmTargetUid, message);
                                                setDmDraft('');
                                            }}
                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4`}
                                        >
                                            Send
                                        </button>
                                    </div>
                                </div>
                                )}
                                <div className="bg-zinc-950/60 border border-white/10 rounded-xl p-3 h-40 overflow-y-auto custom-scrollbar space-y-2">
                                    {(chatViewMode === 'room' ? roomChatMessages : hostDmMessages).length === 0 && (
                                        <div className="text-sm text-zinc-500 h-full flex items-center justify-center">No messages yet.</div>
                                    )}
                                    {(chatViewMode === 'room' ? roomChatMessages : hostDmMessages).slice(0, 6).map((msg, idx) => {
                                        const isPinned = pinnedChatIds.includes(msg.id);
                                        const isLatest = idx === 0;
                                        return (
                                            <div key={msg.id} className={`text-sm rounded-lg px-2 py-2 border ${isPinned ? 'bg-yellow-500/10 border-yellow-400/40' : msg.isHost ? 'bg-cyan-500/10 border-cyan-400/30' : 'bg-zinc-900/60 border-white/5'} ${isLatest ? 'ring-1 ring-pink-400/40' : ''}`}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span>{msg.avatar || EMOJI.sparkle}</span>
                                                        <span className={`font-bold truncate ${msg.isHost ? 'text-cyan-300' : 'text-white'}`}>{msg.user || 'Guest'}</span>
                                                        {msg.isVip && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400 text-black font-black tracking-widest">VIP</span>}
                                                        {msg.isHost && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500 text-black font-black tracking-widest">HOST</span>}
                                                        {isPinned && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500 text-black font-black tracking-widest">PIN</span>}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setPinnedChatIds(prev => isPinned ? prev.filter(id => id !== msg.id) : [msg.id, ...prev].slice(0, 3));
                                                        }}
                                                        className={`${STYLES.btnStd} ${isPinned ? STYLES.btnHighlight : STYLES.btnNeutral} px-2 py-1 text-xs`}
                                                        title={isPinned ? 'Unpin message' : 'Pin message'}
                                                    >
                                                        <i className="fa-solid fa-thumbtack"></i>
                                                    </button>
                                                </div>
                                                <div className="text-zinc-200 mt-1 text-sm break-words">{msg.text}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        {chatViewMode === 'room' && (
                            <div className="mt-3 flex gap-2">
                                <input
                                    value={chatDraft}
                                    onChange={e => setChatDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendHostChat();
                                        }
                                    }}
                                    className={`${STYLES.input} text-xs flex-1`}
                                    placeholder="Message the room..."
                                    title="Send a message to the audience"
                                />
                                <button onClick={sendHostChat} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3`} title="Send chat message">
                                    <i className="fa-solid fa-paper-plane mr-2"></i>Send
                                </button>
                            </div>
                        )}
                        </div>
                    </section>

                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Reward Points"
                            open={crowdPointsOpen}
                            onToggle={() => setCrowdPointsOpen(v => !v)}
                        />
                        <div className={crowdPointsOpen ? 'space-y-3' : 'hidden'}>
                            <div>
                                <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Tip points rate</div>
                                <input
                                    value={tipPointRate}
                                    onChange={e=>setTipPointRate(e.target.value)}
                                    className={STYLES.input}
                                    placeholder="Points per $1 tip"
                                    title="How many points per $1 tip"
                                />
                                <div className="host-form-helper">Used when awarding points by dollar amount.</div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-xs uppercase tracking-widest text-zinc-400">Gift individual</div>
                                <div className="grid grid-cols-3 gap-2">
                                    <select
                                        value={giftTargetUid}
                                        onChange={(e) => setGiftTargetUid(e.target.value)}
                                        className={`${STYLES.input} text-xs w-full`}
                                        title="Choose a lobby member"
                                    >
                                        <option value="">Select member...</option>
                                        {users.map(u => (
                                            <option key={u.uid || u.id} value={u.uid || u.id?.split('_')[1]}>
                                                {u.name || 'Guest'}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        value={giftAmount}
                                        onChange={(e) => setGiftAmount(e.target.value)}
                                        className={`${STYLES.input} text-xs w-full`}
                                        placeholder="Pts"
                                        title="Points to gift"
                                    />
                                    <button
                                        onClick={() => {
                                            const amount = Math.max(1, Number(giftAmount || 0));
                                            if (!giftTargetUid || !amount) return;
                                            giftPointsToUser?.(giftTargetUid, amount);
                                            setGiftAmount('');
                                        }}
                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight}`}
                                    >
                                        Gift
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-xs uppercase tracking-widest text-zinc-400">Gift all</div>
                            <div className="grid grid-cols-3 gap-2">
                                {[50, 100, 250].map(val => (
                                    <button key={val} onClick={() => dropBonus(val)} className={`${STYLES.btnStd} ${STYLES.btnSecondary}`}>+{val} pts</button>
                                ))}
                            </div>
                            </div>
                        </div>
                    </section>

                </div>
            </div>

            {/* RIGHT QUEUE */}
            <div className={`flex-1 ${STYLES.panel} flex flex-col overflow-hidden min-w-0`}>
                <div className="p-4 border-b border-white/10 bg-black/20 relative">
                    <SectionHeader
                        label="Add to Queue"
                        open={showAddForm}
                        onToggle={() => setShowAddForm(v => !v)}
                        toneClass="text-base font-black text-[#00C4D9]"
                    />
                    {showAddForm && (
                        <>
                            <div className="relative mb-2">
                                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} className={STYLES.input} placeholder="Search Local + YouTube + Apple Music..."/>
                            </div>
                            {searchSources.itunes && itunesBackoffRemaining > 0 && (
                                <div className="host-form-helper mb-2 text-yellow-300 text-xs">
                                    Apple Music art is rate-limited. Retrying in {itunesBackoffRemaining}s.
                                </div>
                            )}
                            {(results.length > 0 || searchQ.length >= 3) && (
                                <div className="absolute top-full left-0 right-0 bg-zinc-900 border border-zinc-600 z-50 shadow-2xl">
                                    <div className="max-h-64 overflow-y-auto">
                                        {results.length > 0 ? results.map((r, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => handleResultClick(r)}
                                                className="p-2 hover:bg-zinc-800 text-xs flex gap-3 items-center border-b border-white/5 cursor-pointer"
                                            >
                                                <div className="w-8 h-8 flex items-center justify-center bg-zinc-800 rounded">
                                                    {r.source === 'local' ? (
                                                        <i className="fa-solid fa-hard-drive text-[#00C4D9] text-lg"></i>
                                                    ) : r.source === 'youtube' ? (
                                                        <div className="relative">
                                                            <img src={r.artworkUrl100} className="w-12 h-12 rounded" />
                                                            <i className="fa-brands fa-youtube text-red-500 absolute -bottom-1 -right-1 text-[10px] bg-black/70 rounded-full p-[2px]"></i>
                                                        </div>
                                                    ) : (
                                                        <img src={r.artworkUrl100} className="w-12 h-12 rounded"/>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-white text-base">{r.trackName}</div>
                                                    <div className="text-zinc-400 text-sm">{r.artistName}</div>
                                                </div>
                                                <div className="ml-auto flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-400">
                                                <span className="px-2 py-1 rounded-full border border-white/10 bg-black/40">Select Track</span>
                                                    <i className="fa-solid fa-chevron-right text-zinc-500"></i>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="host-search-helper text-center py-3 text-zinc-500 text-xs uppercase tracking-widest">No results yet</div>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="mb-2 rounded-xl border border-white/10 bg-black/30 p-3">
                                <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Song Details</div>
                                <div className="grid grid-cols-1 md:grid-cols-[2fr_1.4fr_1.4fr_1.1fr] gap-2">
                                    <input value={manual.song} onChange={e=>setManual({...manual, song:e.target.value})} className={STYLES.input} placeholder="Song"/>
                                    <input value={manual.artist} onChange={e=>setManual({...manual, artist:e.target.value})} className={STYLES.input} placeholder="Artist"/>
                                    <select
                                        value={manualSingerMode === 'custom' ? '__custom' : manual.singer}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '__custom') {
                                                setManualSingerMode('custom');
                                                setManual(prev => ({ ...prev, singer: '' }));
                                                return;
                                            }
                                            setManualSingerMode('select');
                                            setManual(prev => ({ ...prev, singer: value }));
                                        }}
                                        className={`${STYLES.input} text-sm`}
                                    >
                                        <option value="">Select Performer</option>
                                        {hostName && (
                                            <option value={hostName}>{hostName} (Host)</option>
                                        )}
                                        {users.map(u => (
                                            <option key={u.uid || u.name} value={u.name}>
                                                {u.avatar ? `${u.avatar} ` : ''}{u.name}
                                            </option>
                                        ))}
                                        <option value="__custom">Custom performer...</option>
                                    </select>
                                    {manualSingerMode === 'custom' && (
                                        <input
                                            value={manual.singer}
                                            onChange={e=>setManual({...manual, singer:e.target.value})}
                                            className={STYLES.input}
                                            placeholder="Custom performer"
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="mb-2 rounded-xl border border-white/10 bg-black/30 p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-zinc-400">
                                        <span>Lyrics</span>
                                        <span className={statusPill}>
                                            {manual.lyrics ? 'Added' : 'None'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setLyricsOpen(v => !v)}
                                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-xs min-h-[30px]`}
                                        >
                                            {lyricsOpen ? 'Hide lyrics' : 'Edit Lyrics'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!manual.song || !manual.artist) return toast("Need Song & Artist");
                                                toast("Generating Lyrics...");
                                                const res = await generateAIContent('lyrics', { title: manual.song, artist: manual.artist });
                                                if (res && res.lyrics) { 
                                                    setManual(prev => ({ ...prev, lyrics: res.lyrics, lyricsTimed: null, appleMusicId: '' })); 
                                                    setLyricsOpen(true);
                                                    toast("Lyrics Generated!"); 
                                                } else { 
                                                    toast("Gen Failed"); 
                                                }
                                            }}
                                            className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 text-xs min-h-[30px]`}
                                            title="Add AI Lyrics"
                                        >
                                            <i className="fa-solid fa-wand-magic-sparkles"></i>
                                            Add AI Lyrics
                                        </button>
                                    </div>
                                </div>
                                {lyricsOpen && (
                                    <textarea
                                        value={manual.lyrics}
                                        onChange={e=>setManual({...manual, lyrics:e.target.value})}
                                        className={`${STYLES.input} w-full h-20 font-mono resize-none host-lyrics-input`}
                                        placeholder="Paste lyrics here (optional)..."
                                    />
                                )}
                            </div>
                            <div className="mb-2 rounded-xl border border-white/10 bg-black/30 p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <div className="text-xs uppercase tracking-widest text-zinc-400">Backing Track</div>
                                    <span
                                        className={statusPill}
                                        title={manualBackingChip.label === 'Apple Music'
                                            ? 'Default backing: Apple Music'
                                            : `Selected backing: ${manualBackingChip.label}`
                                        }
                                    >
                                        {manualBackingChip.label === 'Apple Music'
                                            ? 'Default: Apple Music'
                                            : manualBackingChip.label
                                        }
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <button
                                        onClick={() => setManual(prev => ({ ...prev, url: '', backingAudioOnly: false }))}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-[#00C4D9] border-[#00C4D9]`}
                                        title="Use the default Apple Music track"
                                    >
                                        <i className="fa-brands fa-apple mr-1"></i>
                                        Apple Default
                                    </button>
                                    <button
                                        onClick={() => openYtSearch('manual', `${manual.song} ${manual.artist}`.trim() || searchQ)}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-[#00C4D9] border-[#00C4D9]`}
                                        title="Search YouTube and pick a backing track"
                                    >
                                        <i className="fa-brands fa-youtube mr-1"></i>
                                        Search YouTube
                                    </button>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input value={manual.url} onChange={e=>setManual({...manual, url:e.target.value})} className={STYLES.input} placeholder="Paste a YouTube or local URL"/>
                                    <button onClick={addSong} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-4`}>
                                        Add to Queue
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    <SectionHeader
                        label="Queue"
                        open={showQueueList}
                        onToggle={() => setShowQueueList(v => !v)}
                        toneClass="text-base font-black text-[#00C4D9] px-1"
                    />
                    {showQueueList && (
                    <>
                    {/* Pending */}
                    {pending.length > 0 && (
                        <div className="mb-4 border-b border-white/10 pb-2">
                            <div className="text-sm text-orange-400 font-bold mb-2 uppercase">PENDING ({pending.length})</div>
                            {pending.map(s => (
                                <div key={s.id} className="bg-orange-950/30 p-2 rounded flex justify-between items-center border border-orange-500/30 mb-2">
                                    <div><div className="text-sm font-bold">{s.songTitle}</div><div className="text-sm text-zinc-400">{s.singerName}</div></div>
                                    <div className="flex gap-2">
                                        <button onClick={()=>updateStatus(s.id, 'requested')} className={`${STYLES.btnStd} ${STYLES.btnSuccess} px-2`}>✓</button>
                                        <button onClick={()=>deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', s.id))} className={`${STYLES.btnStd} ${STYLES.btnDanger} px-2`}>X</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {pending.length === 0 && (
                        <div className="host-search-helper text-center py-2 text-zinc-500 text-xs uppercase tracking-widest">
                            No pending songs
                        </div>
                    )}
                    {/* Queue */}
                    {queue.map((s,i) => (<div
                        key={s.id}
                        data-queue-id={s.id}
                        draggable
                        onDragStart={() => setDragQueueId(s.id)}
                        onDragEnd={() => { setDragQueueId(null); setDragOverId(null); }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverId(s.id); }}
                        onDrop={() => { reorderQueue(dragQueueId, s.id); setDragQueueId(null); setDragOverId(null); }}
                        onTouchStart={() => handleTouchStart(s.id)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className={`bg-zinc-900/50 p-3 rounded-lg flex flex-col gap-2 border ${dragOverId === s.id ? 'border-[#00C4D9]' : 'border-white/5'}`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-zinc-500 w-6 text-center">{i+1}</span>
                                <i className="fa-solid fa-grip-lines text-zinc-600"></i>
                                {s.albumArtUrl && <img src={s.albumArtUrl} className="w-10 h-10 rounded shadow-sm"/>}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold text-white">{s.songTitle}</div>
                                        <div className="flex items-center gap-1 text-sm">
                                            {s.lyricsTimed?.length ? (
                                                <i className="fa-solid fa-clock text-purple-300" title="Timed lyrics"></i>
                                            ) : s.lyrics ? (
                                                <i className="fa-solid fa-closed-captioning text-fuchsia-300" title="Manual lyrics"></i>
                                            ) : (
                                                <i className="fa-solid fa-comment-slash text-zinc-500" title="No lyrics"></i>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-sm text-zinc-400">{s.singerName}</div>
                                    <div className="mt-1 flex flex-wrap gap-1.5 text-sm uppercase tracking-widest">
                                        {s.appleMusicId ? (
                                            <span className={statusPill}><i className="fa-brands fa-apple mr-1"></i>Apple Music</span>
                                        ) : s.mediaUrl ? (
                                            <span className={statusPill}><i className="fa-brands fa-youtube mr-1"></i>YouTube</span>
                                        ) : (
                                            <span className={statusPill}><i className="fa-solid fa-file-audio mr-1"></i>Local File</span>
                                        )}
                                        {s.lyricsTimed?.length ? (
                                            <span className={statusPill}><i className="fa-solid fa-clock mr-1"></i>Timed Lyrics</span>
                                        ) : s.lyrics ? (
                                            <span className={statusPill}><i className="fa-solid fa-closed-captioning mr-1"></i>Manual Lyrics</span>
                                        ) : (
                                            <span className={statusPill}><i className="fa-solid fa-comment-slash mr-1"></i>No Lyrics</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button onClick={()=>updateStatus(s.id, 'performing')} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-3 text-white`}>
                                    <i className="fa-solid fa-play mr-1"></i>Play
                                </button>
                                <button onClick={()=>startEdit(s)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-2`}>
                                    <i className="fa-solid fa-pen-to-square mr-1"></i>Edit
                                </button>
                                <button onClick={()=>deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', s.id))} className={`${STYLES.btnStd} ${STYLES.btnDanger} px-2`}>
                                    <i className="fa-solid fa-trash mr-1"></i>Remove
                                </button>
                                {s.lyricsTimed?.length ? (
                                    <span className="ml-auto flex items-center gap-1 text-xs text-purple-300" title="Timed lyrics">
                                        <i className="fa-solid fa-clock"></i>
                                    </span>
                                ) : s.lyrics ? (
                                    <span className="ml-auto flex items-center gap-1 text-xs text-fuchsia-300" title="Manual lyrics">
                                        <i className="fa-solid fa-closed-captioning"></i>
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN HOST APP COMPONENT ---
const HostApp = ({ roomCode: initialCode, uid, authError, retryAuth }) => {
    // 1. Manage roomCode locally to fix shadowing issue
    const [roomCode, setRoomCode] = useState(initialCode || '');
    const appBase = typeof window !== 'undefined' ? `${window.location.origin}${import.meta.env.BASE_URL || '/'}` : '';

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'auto';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, []);

    useEffect(() => {
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((itunesBackoffUntil - Date.now()) / 1000));
            setItunesBackoffRemaining(remaining);
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);

    const ensureAppleMusic = async () => {
        if (appleMusicRef.current) return appleMusicRef.current;
        setAppleMusicStatus('Loading Apple Music...');
        const MusicKit = await loadMusicKitScript();
        if (!MusicKit) throw new Error('MusicKit unavailable');
        const tokenPayload = await callFunction('createAppleMusicToken');
        if (!tokenPayload?.token) throw new Error('Missing Apple Music token');
        MusicKit.configure({
            developerToken: tokenPayload.token,
            app: { name: 'Bross Karaoke Host', build: '1.0.0' }
        });
        const instance = MusicKit.getInstance();
        appleMusicRef.current = instance;
        setAppleMusicReady(true);
        setAppleMusicAuthorized(!!instance.isAuthorized);
        instance.addEventListener('playbackStateDidChange', () => {
            setAppleMusicPlaying(instance.isPlaying);
        });
        setAppleMusicStatus('');
        return instance;
    };

    const connectAppleMusic = async () => {
        try {
            const instance = await ensureAppleMusic();
            await instance.authorize();
            setAppleMusicAuthorized(true);
            setAppleMusicStatus('Connected');
        } catch (e) {
            console.error(e);
            setAppleMusicStatus('Apple Music login failed.');
        }
    };

    const disconnectAppleMusic = async () => {
        try {
            const instance = appleMusicRef.current;
            if (instance?.unauthorize) await instance.unauthorize();
        } catch (e) {
            console.warn('Apple Music sign-out failed', e);
        }
        setAppleMusicAuthorized(false);
        setAppleMusicPlaying(false);
        setAppleMusicStatus('Disconnected');
    };

    const playAppleMusicTrack = async (trackId, meta = {}) => {
        if (!trackId) return;
        const instance = await ensureAppleMusic();
        if (!instance.isAuthorized) {
            await instance.authorize();
            setAppleMusicAuthorized(true);
        }
        await instance.setQueue({ song: String(trackId) });
        await instance.play();
        setAppleMusicPlaying(true);
        if (roomCode) {
            await updateRoom({
                appleMusicPlayback: {
                    type: 'song',
                    id: String(trackId),
                    title: meta.title || '',
                    artist: meta.artist || '',
                    startedAt: Date.now(),
                    status: 'playing'
                }
            });
        }
    };

    const pauseAppleMusic = async () => {
        const instance = appleMusicRef.current;
        if (!instance) return;
        await instance.pause();
        setAppleMusicPlaying(false);
        if (roomCode) {
            await updateRoom({
                appleMusicPlayback: {
                    ...(room?.appleMusicPlayback || {}),
                    status: 'paused',
                    pausedAt: Date.now()
                }
            });
        }
    };

    const resumeAppleMusic = async () => {
        const instance = appleMusicRef.current;
        if (!instance) return;
        await instance.play();
        setAppleMusicPlaying(true);
        if (roomCode) {
            await updateRoom({
                appleMusicPlayback: {
                    ...(room?.appleMusicPlayback || {}),
                    status: 'playing',
                    resumedAt: Date.now()
                }
            });
        }
    };

    const playAppleMusicPlaylist = async (playlistId, meta = {}) => {
        if (!playlistId) return;
        const instance = await ensureAppleMusic();
        if (!instance.isAuthorized) {
            await instance.authorize();
            setAppleMusicAuthorized(true);
        }
        let resolvedTitle = meta.title || '';
        try {
            const storefront = instance.storefrontId || 'us';
            const res = await instance.api.music(`v1/catalog/${storefront}/playlists/${playlistId}`);
            const name = res?.data?.data?.[0]?.attributes?.name;
            if (name) resolvedTitle = name;
        } catch (e) {
            console.warn('Apple Music playlist lookup failed', e);
        }
        await instance.setQueue({ playlist: String(playlistId) });
        await instance.play();
        setAppleMusicPlaying(true);
        if (roomCode) {
            await updateRoom({
                appleMusicPlayback: {
                    type: 'playlist',
                    id: String(playlistId),
                    title: resolvedTitle || meta.title || '',
                    startedAt: Date.now(),
                    status: 'playing'
                }
            });
        }
    };

    const fetchAppleMusicPlaylistTitle = async (playlistId) => {
        if (!playlistId) return '';
        try {
            const instance = await ensureAppleMusic();
            const storefront = instance.storefrontId || 'us';
            const res = await instance.api.music(`v1/catalog/${storefront}/playlists/${playlistId}`);
            return res?.data?.data?.[0]?.attributes?.name || '';
        } catch (e) {
            console.warn('Apple Music playlist title lookup failed', e);
            return '';
        }
    };
    
    // 2. Local State
    const [view, setView] = useState(initialCode ? 'panel' : 'landing');
    const [room, setRoom] = useState(null);
    const [songs, setSongs] = useState([]);
    const [users, setUsers] = useState([]);
    const [contacts, setContacts] = useState([]);
    const [activities, setActivities] = useState([]);
    const [tab, setTab] = useState('stage');
    const [autoBgMusic, setAutoBgMusic] = useState(false);
    const [autoDj, setAutoDj] = useState(false);
    const [autoPlayMedia, setAutoPlayMedia] = useState(true);
    const [autoDjCountdown, setAutoDjCountdown] = useState(0);
    const [bgVolume, setBgVolume] = useState(0.3);
    const [mixFader, setMixFader] = useState(50);
    const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
    const [playingBg, setPlayingBg] = useState(false);
    const [bgMeterLevel, setBgMeterLevel] = useState(0);
    const [stageMeterLevel, setStageMeterLevel] = useState(0);
    const [stageMicReady, setStageMicReady] = useState(false);
    const [stageMicError, setStageMicError] = useState('');
    const [audioPanelOpen, setAudioPanelOpen] = useState(true);
    const [showLaunchMenu, setShowLaunchMenu] = useState(false);
    const [showNavMenu, setShowNavMenu] = useState(false);
    const [autoOpenGameId, setAutoOpenGameId] = useState('');
    const [appleMusicReady, setAppleMusicReady] = useState(false);
    const [appleMusicAuthorized, setAppleMusicAuthorized] = useState(false);
    const [appleMusicPlaying, setAppleMusicPlaying] = useState(false);
    const [appleMusicStatus, setAppleMusicStatus] = useState('');
    const [appleMusicAutoPlaylistId, setAppleMusicAutoPlaylistId] = useState('');
    const [appleMusicAutoPlaylistTitle, setAppleMusicAutoPlaylistTitle] = useState('');
    const appleMusicRef = useRef(null);
    const mixFadeRef = useRef(null);
    const mixFadeTargetRef = useRef(mixFader);
    const mixBeforeSongRef = useRef(mixFader);
    const prevSongStateRef = useRef(null);
    const lobbyVipCount = users.filter(u => u.isVip || (u.vipLevel || 0) > 0).length;
    const lobbyActiveCount = users.filter(u => {
        const ts = u.lastSeen?.seconds ? u.lastSeen.seconds * 1000 : (u.lastSeen || 0);
        return ts >= Date.now() - 5 * 60 * 1000;
    }).length;
    const lobbyTotalPoints = users.reduce((sum, u) => sum + (u.points || 0), 0);
    const lobbyTotalEmojis = users.reduce((sum, u) => sum + (u.totalEmojis || 0), 0);
    const queuedCount = useMemo(() => songs.filter(s => s.status === 'requested').length, [songs]);
    const performingCount = useMemo(() => songs.filter(s => s.status === 'performing').length, [songs]);
    const [tipSettings, setTipSettings] = useState({ link: '', qr: '' });
    const [tipCrates, setTipCrates] = useState(DEFAULT_TIP_CRATES);
    const [catalogueName, setCatalogueName] = useState('');
    const [catalogueUserId, setCatalogueUserId] = useState('');
    const [showCataloguePrompt, setShowCataloguePrompt] = useState(false);
    const [cataloguePendingSong, setCataloguePendingSong] = useState(null);
    const [catalogueSearchQ, setCatalogueSearchQ] = useState('');
    const [catalogueResults, setCatalogueResults] = useState([]);
    const [activeBrowseList, setActiveBrowseList] = useState(null);
    const [showTop100, setShowTop100] = useState(false);
    const [showYtIndex, setShowYtIndex] = useState(false);
    const [ytIndexFilter, setYtIndexFilter] = useState('');
    const [top100Art, setTop100Art] = useState({});
    const [top100ArtLoading, setTop100ArtLoading] = useState({});
    const [localLibrary, setLocalLibrary] = useState(() => LOCAL_LIBRARY);
    const [ytIndex, setYtIndex] = useState([]);
    const [searchSources, setSearchSources] = useState({ local: true, youtube: true, itunes: true });
    const [ytPlaylistUrl, setYtPlaylistUrl] = useState('');
    const [ytPlaylistLoading, setYtPlaylistLoading] = useState(false);
    const [appleMusicPlaylistUrl, setAppleMusicPlaylistUrl] = useState('');
    const [appleMusicPlaylistStatus, setAppleMusicPlaylistStatus] = useState('');
    const [ytPlaylistStatus, setYtPlaylistStatus] = useState('');
    const [ytAddTitle, setYtAddTitle] = useState('');
    const [ytAddArtist, setYtAddArtist] = useState('');
    const [ytAddUrl, setYtAddUrl] = useState('');
    const [ytAddLoading, setYtAddLoading] = useState(false);
    const [ytAddStatus, setYtAddStatus] = useState('');
    const [itunesBackoffRemaining, setItunesBackoffRemaining] = useState(0);
    const [pendingLocalFile, setPendingLocalFile] = useState(null);
    const [uploadingLocal, setUploadingLocal] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [localFilter, setLocalFilter] = useState('');
    const [roomUploadBytes, setRoomUploadBytes] = useState(0);
    const localUploadsRef = useRef([]);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsTab, setSettingsTab] = useState('general');
    const [chatEnabled, setChatEnabled] = useState(true);
    const [chatShowOnTv, setChatShowOnTv] = useState(false);
    const [chatSlowModeSec, setChatSlowModeSec] = useState(0);
    const [chatAudienceMode, setChatAudienceMode] = useState('all');
    const [chatDraft, setChatDraft] = useState('');
    const hallOfFameTimerRef = useRef(null);
    const [dmTargetUid, setDmTargetUid] = useState('');
    const [dmDraft, setDmDraft] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [smokeRunning, setSmokeRunning] = useState(false);
    const [smokeResults, setSmokeResults] = useState([]);
    const [smokeIncludeWrite, setSmokeIncludeWrite] = useState(false);
    const [pinnedChatIds, setPinnedChatIds] = useState([]);
    const [chatUnread, setChatUnread] = useState(false);
    const [dmUnread, setDmUnread] = useState(false);
    const [chatViewMode, setChatViewMode] = useState('room');
    const chatLastSeenRef = useRef(0);
    const dmLastSeenRef = useRef(0);
    const layoutDefaultedRef = useRef(false);
    const handleChatViewMode = (nextMode) => {
        setChatViewMode(nextMode);
        if (nextMode === 'room') {
            const newest = chatMessages.find(msg => !msg.toHost);
            const newestTs = newest?.timestamp?.seconds ? newest.timestamp.seconds * 1000 : 0;
            if (newestTs) chatLastSeenRef.current = newestTs;
            setChatUnread(false);
        }
        if (nextMode === 'host') {
            const newest = chatMessages.find(msg => msg.toHost || msg.toUid);
            const newestTs = newest?.timestamp?.seconds ? newest.timestamp.seconds * 1000 : 0;
            if (newestTs) dmLastSeenRef.current = newestTs;
            setDmUnread(false);
        }
    };
    const [clearingRoom, setClearingRoom] = useState(false);
    const [exportingRoom, setExportingRoom] = useState(false);
    const [closingRoom, setClosingRoom] = useState(false);
    const [catalogueOnly, setCatalogueOnly] = useState(false);
    const [marqueeDraft, setMarqueeDraft] = useState('');
    const [marqueeDraftItems, setMarqueeDraftItems] = useState([]);
    const [hostName, setHostName] = useState(localStorage.getItem('bross_host_name') || 'Host');
    const [logoUrl, setLogoUrl] = useState('');
    const [marqueeEnabled, setMarqueeEnabled] = useState(false);
    const [marqueeDurationSec, setMarqueeDurationSec] = useState(12);
    const [marqueeIntervalSec, setMarqueeIntervalSec] = useState(20);
    const [marqueeItems, setMarqueeItems] = useState([]);
    const [marqueeShowMode, setMarqueeShowMode] = useState('always');
    const [tipPointRate, setTipPointRate] = useState(100);
    const [queueLimitMode, setQueueLimitMode] = useState('none');
    const [queueLimitCount, setQueueLimitCount] = useState(0);
    const [queueRotation, setQueueRotation] = useState('round_robin');
    const [queueFirstTimeBoost, setQueueFirstTimeBoost] = useState(true);
    const [showScoring, setShowScoring] = useState(true);
    const [showFameLevel, setShowFameLevel] = useState(true);
    const [allowSingerTrackSelect, setAllowSingerTrackSelect] = useState(false);
    const [autoBgFadeOutMs, setAutoBgFadeOutMs] = useState(900);
    const [autoBgFadeInMs, setAutoBgFadeInMs] = useState(900);
    const [autoBgMixDuringSong, setAutoBgMixDuringSong] = useState(0);
    const [lobbyTab, setLobbyTab] = useState('users');
    const [readyCheckDurationSec, setReadyCheckDurationSec] = useState(10);
    const [readyCheckRewardPoints, setReadyCheckRewardPoints] = useState(100);
    // Announce state
    const [_announceText, _setAnnounceText] = useState(''); 
    const [_showAnnounceModal, _setShowAnnounceModal] = useState(false);
    // Score editing state
    const [modifyingScoreId, setModifyingScoreId] = useState(null); 
    const [scoreForm, setScoreForm] = useState({ hype:0, applause:0, bonus:0 });
    const [sfxMuted, setSfxMuted] = useState(false);
    const [sfxLevel, setSfxLevel] = useState(0);
    const [sfxVolume, setSfxVolume] = useState(0.5);
    const [songMuteBackup, setSongMuteBackup] = useState(100);
    const [bgMuteBackup, setBgMuteBackup] = useState(0.3);
    const [tipUserId, setTipUserId] = useState('');
    const [tipAmount, setTipAmount] = useState('');

    useEffect(() => {
        if (catalogueSearchQ.length < 3) { setCatalogueResults([]); return; }
        let controller;
        const t = setTimeout(async () => {
            controller = new AbortController();
            const localMatches = searchSources.local
                ? localLibrary.filter(s =>
                    s.title.toLowerCase().includes(catalogueSearchQ.toLowerCase()) ||
                    s.artist.toLowerCase().includes(catalogueSearchQ.toLowerCase()) ||
                    (s.fileName || '').toLowerCase().includes(catalogueSearchQ.toLowerCase())
                ).map(s => ({ ...s, source: 'local', trackName: s.title, artistName: s.artist, artworkUrl100: '' }))
                : [];
            const ytMatches = searchSources.youtube
                ? ytIndex.filter(s =>
                    s.trackName.toLowerCase().includes(catalogueSearchQ.toLowerCase()) ||
                    s.artistName.toLowerCase().includes(catalogueSearchQ.toLowerCase())
                )
                : [];
            try {
                if (!searchSources.itunes) {
                    setCatalogueResults([...localMatches, ...ytMatches]);
                    return;
                }
                const data = await callFunction('itunesSearch', { term: catalogueSearchQ, limit: 5 });
                const itunesMatches = (data?.results || []).map(r => ({ ...r, source: 'itunes' }));
                setCatalogueResults([...localMatches, ...ytMatches, ...itunesMatches]);
            } catch (e) {
                if (e.name === 'AbortError') return;
                setCatalogueResults([...localMatches, ...ytMatches]);
            }
        }, 500);
        return () => {
            clearTimeout(t);
            if (controller) controller.abort();
        };
    }, [catalogueSearchQ, localLibrary, ytIndex, searchSources]);

    const bgAudio = useRef(null);
    const bgCtxRef = useRef(null);
    const bgAnalyserRef = useRef(null);
    const bgSourceRef = useRef(null);
    const bgMeterRafRef = useRef(null);
    const bgMeterPhaseRef = useRef(0);
    const stageMeterRafRef = useRef(null);
    const stageMeterTimeRef = useRef(0);
    const stageMicCtxRef = useRef(null);
    const stageMicAnalyserRef = useRef(null);
    const stageMicStreamRef = useRef(null);
    const stageMicRafRef = useRef(null);
    const autoDjTimerRef = useRef(null);
    const doodleTimerRef = useRef(null);
    const lastAutoDjTsRef = useRef(null);
    const readyCheckTimerRef = useRef(null);
    const bingoTurnAdvanceRef = useRef(null);
    const roomRef = useRef(room);
    const songsRef = useRef(songs);
    const stormTimersRef = useRef([]);
    const sfxPulseRef = useRef(null);
    const seededMarqueeRef = useRef(false);
    const toast = useToast();

    const currentSong = songs.find(s => s.status === 'performing');
    const queuedSongs = songs.filter(s => s.status === 'requested' || s.status === 'pending');
    const recentActivities = (activities || []).filter(a => toMs(a.timestamp) > Date.now() - 5 * 60 * 1000);
    const lastActivity = activities?.[0];
    const copySnapshot = async () => {
        const payload = {
            roomCode,
            room: room || null,
            users: users?.length || 0,
            queuedSongs: queuedSongs.length,
            currentSong: currentSong ? { title: currentSong.songTitle, singer: currentSong.singerName } : null
        };
        try {
            await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            toast("QA snapshot copied");
        } catch {
            toast("Copy failed");
        }
    };

    const runSmokeTest = async () => {
        if (!roomCode) {
            setSmokeResults([{ label: 'Room code', status: 'fail', detail: 'No room code set' }]);
            return;
        }
        setSmokeRunning(true);
        setSmokeResults([]);
        const addResult = (label, status, detail) => ({ label, status, detail });
        const runCheck = async (label, fn) => {
            try {
                const detail = await fn();
                return addResult(label, 'ok', detail);
            } catch (err) {
                return addResult(label, 'fail', err?.message || String(err));
            }
        };
        const checks = [
            runCheck('Auth (uid)', async () => {
                if (!uid) throw new Error('No auth uid');
                return uid;
            }),
            runCheck('Room doc read', async () => {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode));
                if (!snap.exists()) return 'Room doc missing';
                return 'OK';
            }),
            runCheck('Songs query read', async () => {
                await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), where('roomCode', '==', roomCode), limit(1)));
                return 'OK';
            }),
            runCheck('Room users query read', async () => {
                await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_users'), where('roomCode', '==', roomCode), limit(1)));
                return 'OK';
            }),
            runCheck('Activities query read', async () => {
                await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), where('roomCode', '==', roomCode), limit(1)));
                return 'OK';
            }),
            runCheck('Chat messages query read', async () => {
                await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'), where('roomCode', '==', roomCode), limit(1)));
                return 'OK';
            }),
            runCheck('Host library read', async () => {
                const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode));
                if (!snap.exists()) return 'No host library yet';
                return 'OK';
            })
        ];
        if (smokeIncludeWrite) {
            checks.push(runCheck('Write/delete smoke doc', async () => {
                const smokeRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'smoke_tests', `${roomCode}_${uid}`);
                await setDoc(smokeRef, { roomCode, uid, createdAt: serverTimestamp() }, { merge: true });
                await deleteDoc(smokeRef);
                return 'OK';
            }));
        }
        const results = await Promise.all(checks);
        const normalized = results.map((res) => {
            if (res.status === 'ok' && res.detail && String(res.detail).includes('missing')) {
                return addResult(res.label, 'warn', res.detail);
            }
            return res;
        });
        setSmokeResults(normalized);
        setSmokeRunning(false);
    };


    // Audio Init
    useEffect(() => {
        const audio = new Audio(BG_TRACKS[0].url);
        audio.loop = true;
        audio.volume = 0.3;
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous';
        bgAudio.current = audio;
    }, []);
    useEffect(() => {
        const resume = () => {
            if (bgCtxRef.current && bgCtxRef.current.state === 'suspended') {
                bgCtxRef.current.resume().catch(() => {});
            }
        };
        window.addEventListener('pointerdown', resume);
        return () => window.removeEventListener('pointerdown', resume);
    }, []);
    useEffect(() => {
        setSfxMasterVolume(sfxVolume);
    }, [sfxVolume]);
    useEffect(() => {
        if (!bgAudio.current || bgCtxRef.current) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        try {
            const ctx = new AudioCtx();
            const source = ctx.createMediaElementSource(bgAudio.current);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.4;
            source.connect(analyser);
            analyser.connect(ctx.destination);
            bgCtxRef.current = ctx;
            bgSourceRef.current = source;
            bgAnalyserRef.current = analyser;

            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                if (!bgAnalyserRef.current) return;
                bgAnalyserRef.current.getByteFrequencyData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i += 1) sum += data[i];
                const avg = sum / data.length;
                let level = Math.min(100, Math.round((avg / 255) * 140));
                const audioEl = bgAudio.current;
                if (audioEl && !audioEl.paused && avg < 1) {
                    bgMeterPhaseRef.current += 0.08;
                    const pulse = (Math.sin(bgMeterPhaseRef.current) + 1) / 2;
                    const fallback = Math.round((0.3 + 0.7 * pulse) * (audioEl.volume * 100));
                    level = Math.max(level, fallback);
                }
                setBgMeterLevel(level);
                bgMeterRafRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) {
            console.error('BG analyser init failed', e);
        }
        return () => {
            if (bgMeterRafRef.current) cancelAnimationFrame(bgMeterRafRef.current);
            if (bgSourceRef.current) bgSourceRef.current.disconnect();
            if (bgAnalyserRef.current) bgAnalyserRef.current.disconnect();
            if (bgCtxRef.current) bgCtxRef.current.close();
            bgCtxRef.current = null;
        };
    }, []);
    const requestStageMic = async () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (stageMicStreamRef.current) return;
            const existing = stageMicCtxRef.current;
            const ctx = !existing || existing.state === 'closed' ? new AudioCtx() : existing;
            stageMicCtxRef.current = ctx;
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stageMicStreamRef.current = stream;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            const source = ctx.createMediaStreamSource(stream);
            source.connect(analyser);
            stageMicAnalyserRef.current = analyser;
            setStageMicReady(true);
            setStageMicError('');
            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                if (!stageMicAnalyserRef.current) return;
                stageMicAnalyserRef.current.getByteFrequencyData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i += 1) sum += data[i];
                const avg = sum / data.length;
                let level = Math.min(100, Math.round((avg / 255) * 140));
                if (avg < 1 && room?.videoPlaying) {
                    stageMeterTimeRef.current += 0.08;
                    const wave = (Math.sin(stageMeterTimeRef.current) + 1) / 2;
                    level = Math.max(level, (room?.videoVolume || 50) * (0.25 + 0.75 * wave));
                }
                setStageMeterLevel(level);
                stageMicRafRef.current = requestAnimationFrame(tick);
            };
            tick();
        } catch (e) {
            console.warn('Stage mic analyser init failed', e);
            setStageMicReady(false);
            setStageMicError('Mic blocked');
        }
    };
    useEffect(() => () => {
        if (stageMicRafRef.current) cancelAnimationFrame(stageMicRafRef.current);
        if (stageMicStreamRef.current) stageMicStreamRef.current.getTracks().forEach(t => t.stop());
        if (stageMicCtxRef.current) stageMicCtxRef.current.close();
        stageMicCtxRef.current = null;
        stageMicStreamRef.current = null;
        stageMicAnalyserRef.current = null;
    }, []);
    useEffect(() => {
        roomRef.current = room;
    }, [room]);
    useEffect(() => {
        if (doodleTimerRef.current) {
            clearTimeout(doodleTimerRef.current);
            doodleTimerRef.current = null;
        }
        if (room?.activeMode !== 'doodle_oke') return;
        const doodle = room?.doodleOke;
        if (!doodle?.status) return;
        const now = Date.now();
        if (doodle.status === 'drawing' && doodle.endsAt) {
            const waitMs = Math.max(0, doodle.endsAt - now);
            doodleTimerRef.current = setTimeout(async () => {
                const current = roomRef.current?.doodleOke;
                if (!current || current.status !== 'drawing') return;
                await updateRoom({ doodleOke: { ...current, status: 'voting' } });
            }, waitMs);
        } else if (doodle.status === 'voting' && doodle.guessEndsAt) {
            const waitMs = Math.max(0, doodle.guessEndsAt - now);
            doodleTimerRef.current = setTimeout(async () => {
                const current = roomRef.current?.doodleOke;
                if (!current || current.status !== 'voting') return;
                await updateRoom({ doodleOke: { ...current, status: 'reveal' } });
            }, waitMs);
        }
        return () => {
            if (doodleTimerRef.current) {
                clearTimeout(doodleTimerRef.current);
                doodleTimerRef.current = null;
            }
        };
    }, [room?.activeMode, room?.doodleOke?.status, room?.doodleOke?.endsAt, room?.doodleOke?.guessEndsAt]);
    useEffect(() => {
        songsRef.current = songs;
    }, [songs]);
    useEffect(() => {
        const ctx = bgCtxRef.current;
        if (ctx && ctx.state === 'suspended' && playingBg) {
            ctx.resume().catch(() => {});
        }
    }, [playingBg]);
    useEffect(() => { if(bgAudio.current) bgAudio.current.volume = bgVolume; }, [bgVolume]);
    useEffect(() => {
        if (room?.bgMusicVolume !== undefined && room?.bgMusicVolume !== null) {
            setBgVolume(room.bgMusicVolume);
        }
        if (room?.mixFader !== undefined && room?.mixFader !== null) {
            setMixFader(room.mixFader);
        }
    }, [room?.bgMusicVolume, room?.mixFader]);
    useEffect(() => {
        if (room?.autoBgMusic !== undefined && room?.autoBgMusic !== null) {
            setAutoBgMusic(!!room.autoBgMusic);
        }
    }, [room?.autoBgMusic]);
    useEffect(() => {
        if (stageMicReady) return;
        const tick = () => {
            const vol = (room?.videoVolume ?? 0) / 100;
            const active = !!room?.videoPlaying || songsRef.current?.some(s => s.status === 'performing');
            let level = 0;
            if (active) {
                stageMeterTimeRef.current += 0.08;
                const wave = (Math.sin(stageMeterTimeRef.current) + 1) / 2;
                level = Math.max(18, vol * (0.35 + 0.65 * wave) * 100);
            }
            setStageMeterLevel(Math.round(level));
            stageMeterRafRef.current = requestAnimationFrame(tick);
        };
        tick();
        return () => {
            if (stageMeterRafRef.current) cancelAnimationFrame(stageMeterRafRef.current);
        };
    }, [room?.videoPlaying, room?.videoVolume, stageMicReady]);
    const normalizeGameParam = (gameParam) => {
        if (!gameParam) return '';
        const normalized = gameParam.toLowerCase().replace(/\s+/g, '_');
        if (normalized === 'trivia') return 'trivia_pop';
        if (normalized === 'wyr' || normalized === 'would_you_rather') return 'wyr';
        if (normalized === 'doodle_oke' || normalized === 'doodle-oke') return 'doodle_oke';
        return normalized;
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        const c = params.get('catalogue');
        const chat = params.get('chat');
        const g = normalizeGameParam(params.get('game'));
        if (t === 'photos') {
            setTab('lobby');
            setLobbyTab('photos');
        } else if (t === 'qa') {
            setTab('games');
        } else if (g) {
            setTab('games');
            setAutoOpenGameId(g);
        } else if (t && ['stage', 'games', 'lobby', 'browse'].includes(t)) {
            setTab(t);
        }
        if (c === '1') setCatalogueOnly(true);
        if (chat === '1') setTab('stage');
    }, []);
    useEffect(() => () => clearStormTimers(), []);
    useEffect(() => () => {
        if (hallOfFameTimerRef.current) {
            clearTimeout(hallOfFameTimerRef.current);
        }
    }, []);
    useEffect(() => {
        if (!room) return;
        setTipSettings({
            link: room.tipUrl || '',
            qr: room.tipQrUrl || ''
        });
        if (Array.isArray(room.tipCrates)) {
            setTipCrates(room.tipCrates);
        }
        if (room.hostName) setHostName(room.hostName);
        if (room.logoUrl) setLogoUrl(room.logoUrl);
        if (room.tipPointRate) setTipPointRate(room.tipPointRate);
        if (room.autoBgFadeOutMs !== undefined && room.autoBgFadeOutMs !== null) {
            setAutoBgFadeOutMs(room.autoBgFadeOutMs);
        }
        if (room.autoBgFadeInMs !== undefined && room.autoBgFadeInMs !== null) {
            setAutoBgFadeInMs(room.autoBgFadeInMs);
        }
        if (room.autoBgMixDuringSong !== undefined && room.autoBgMixDuringSong !== null) {
            setAutoBgMixDuringSong(room.autoBgMixDuringSong);
        }
        if (room.autoDj !== undefined && room.autoDj !== null) setAutoDj(!!room.autoDj);
        if (room.autoPlayMedia !== undefined && room.autoPlayMedia !== null) setAutoPlayMedia(!!room.autoPlayMedia);
        if (room.appleMusicAutoPlaylistId !== undefined && room.appleMusicAutoPlaylistId !== null) {
            setAppleMusicAutoPlaylistId(room.appleMusicAutoPlaylistId || '');
        }
        if (room.appleMusicAutoPlaylistTitle !== undefined && room.appleMusicAutoPlaylistTitle !== null) {
            setAppleMusicAutoPlaylistTitle(room.appleMusicAutoPlaylistTitle || '');
        }
        if (room.readyCheckDurationSec !== undefined && room.readyCheckDurationSec !== null) {
            setReadyCheckDurationSec(room.readyCheckDurationSec);
        }
        if (room.readyCheckRewardPoints !== undefined && room.readyCheckRewardPoints !== null) {
            setReadyCheckRewardPoints(room.readyCheckRewardPoints);
        }
        if (room.queueSettings) {
            setQueueLimitMode(room.queueSettings.limitMode || 'none');
            setQueueLimitCount(room.queueSettings.limitCount ?? 0);
            setQueueRotation(room.queueSettings.rotation || 'round_robin');
            setQueueFirstTimeBoost(room.queueSettings.firstTimeBoost !== false);
        }
        if (room?.showScoring !== undefined && room?.showScoring !== null) {
            setShowScoring(!!room.showScoring);
        }
        if (room?.showFameLevel !== undefined && room?.showFameLevel !== null) {
            setShowFameLevel(!!room.showFameLevel);
        }
        if (room?.allowSingerTrackSelect !== undefined && room?.allowSingerTrackSelect !== null) {
            setAllowSingerTrackSelect(!!room.allowSingerTrackSelect);
        }
    }, [room?.tipUrl, room?.tipQrUrl, room?.tipCrates, room?.hostName, room?.logoUrl, room?.autoDj, room?.autoPlayMedia, room?.readyCheckDurationSec, room?.readyCheckRewardPoints, room?.autoBgFadeOutMs, room?.autoBgFadeInMs, room?.autoBgMixDuringSong, room?.queueSettings, room?.showScoring, room?.showFameLevel, room?.allowSingerTrackSelect]);
    useEffect(() => {
        if (!room) return;
        setMarqueeEnabled(!!room?.marqueeEnabled);
        if (room?.marqueeDurationMs) setMarqueeDurationSec(Math.round(room.marqueeDurationMs / 1000));
        if (room?.marqueeIntervalMs) setMarqueeIntervalSec(Math.round(room.marqueeIntervalMs / 1000));
        if (room?.marqueeItems) setMarqueeItems(room.marqueeItems);
        if (room?.marqueeShowMode) setMarqueeShowMode(room.marqueeShowMode);
    }, [room?.marqueeEnabled, room?.marqueeDurationMs, room?.marqueeIntervalMs, room?.marqueeItems, room?.marqueeShowMode]);
    useEffect(() => {
        if (room?.chatEnabled !== undefined) setChatEnabled(!!room.chatEnabled);
        if (room?.chatShowOnTv !== undefined) setChatShowOnTv(!!room.chatShowOnTv);
        if (room?.chatSlowModeSec !== undefined && room?.chatSlowModeSec !== null) {
            setChatSlowModeSec(room.chatSlowModeSec);
        }
        if (room?.chatAudienceMode) setChatAudienceMode(room.chatAudienceMode);
    }, [room?.chatEnabled, room?.chatShowOnTv, room?.chatSlowModeSec, room?.chatAudienceMode]);
    useEffect(() => {
        if (!room || layoutDefaultedRef.current) return;
        if (!room.layoutMode) {
            layoutDefaultedRef.current = true;
            updateRoom({ layoutMode: 'standard' }).catch(() => {});
            return;
        }
        layoutDefaultedRef.current = true;
    }, [room?.layoutMode, roomCode]);
    useEffect(() => {
        if (!roomCode) return;
        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'),
            where('roomCode', '==', roomCode),
            orderBy('timestamp', 'desc'),
            limit(40)
        );
        const unsub = onSnapshot(q, snap => {
            const next = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setChatMessages(next);
            const newestRoom = next.find(msg => !msg.toHost);
            const newestDm = next.find(msg => msg.toHost || msg.toUid);
            const roomTs = newestRoom?.timestamp?.seconds ? newestRoom.timestamp.seconds * 1000 : 0;
            const dmTs = newestDm?.timestamp?.seconds ? newestDm.timestamp.seconds * 1000 : 0;
            if (chatViewMode === 'room' && roomTs) {
                chatLastSeenRef.current = Math.max(chatLastSeenRef.current, roomTs);
                setChatUnread(false);
            } else if (roomTs && roomTs > chatLastSeenRef.current && settingsTab !== 'chat') {
                setChatUnread(true);
            }
            if (chatViewMode === 'host' && dmTs) {
                dmLastSeenRef.current = Math.max(dmLastSeenRef.current, dmTs);
                setDmUnread(false);
            } else if (dmTs && dmTs > dmLastSeenRef.current && settingsTab !== 'chat') {
                setDmUnread(true);
            }
        });
        return () => unsub();
    }, [roomCode, settingsTab, chatViewMode]);
    useEffect(() => {
        if (!room || !roomCode || seededMarqueeRef.current) return;
        if (!room?.marqueeItems || room.marqueeItems.length === 0) {
            seededMarqueeRef.current = true;
            setMarqueeItems(DEFAULT_MARQUEE_ITEMS);
            updateRoom({ marqueeItems: DEFAULT_MARQUEE_ITEMS }).catch((e) => {
                console.warn('Failed to seed marquee items', e);
            });
        }
    }, [room?.marqueeItems, roomCode]);
    useEffect(() => {
        if (!showSettings || settingsTab !== 'marquee') return;
        const items = marqueeItems && marqueeItems.length ? marqueeItems : DEFAULT_MARQUEE_ITEMS;
        setMarqueeDraftItems(items);
    }, [showSettings, settingsTab, marqueeItems]);
    useEffect(() => {
        if (!room || !roomCode || !uid) return;
        const hostUids = room.hostUids || [];
        const needsHostUid = !room.hostUid;
        const needsAdd = !hostUids.includes(uid);
        if (!needsHostUid && !needsAdd) return;
        const updates = {};
        if (needsHostUid) updates.hostUid = uid;
        if (needsAdd) updates.hostUids = arrayUnion(uid);
        updateRoom(updates).catch((e) => {
            console.warn('Failed to sync host ownership', e);
        });
    }, [room?.hostUid, room?.hostUids, roomCode, uid]);
    useEffect(() => {
        if (room?.lightMode === 'storm' && room?.stormEndsAt && Date.now() > room.stormEndsAt) {
            updateRoom({ lightMode: 'off', stormPhase: 'off' });
        }
    }, [room?.lightMode, room?.stormEndsAt]);
    useEffect(() => {
        if (room?.lightMode === 'strobe' && room?.strobeEndsAt && Date.now() > room.strobeEndsAt) {
            updateRoom({ lightMode: 'off' });
        }
    }, [room?.lightMode, room?.strobeEndsAt]);
    useEffect(() => {
        if (autoDjTimerRef.current) {
            clearTimeout(autoDjTimerRef.current);
            autoDjTimerRef.current = null;
        }
        if (!room?.autoDj || !room?.lastPerformance?.timestamp) return;
        const lastTs = getTimestampMs(room.lastPerformance.timestamp);
        if (lastAutoDjTsRef.current === lastTs) return;
        lastAutoDjTsRef.current = lastTs;
        const elapsed = Date.now() - lastTs;
        const delay = Math.max(0, 10500 - elapsed);
        setAutoDjCountdown(Math.ceil(delay / 1000));
        const tick = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((lastTs + 10500 - Date.now()) / 1000));
            setAutoDjCountdown(remaining);
            if (remaining <= 0) clearInterval(tick);
        }, 500);
        autoDjTimerRef.current = setTimeout(() => {
            startNextFromQueue().catch((e) => {
                console.warn('Auto DJ failed to start next song', e);
            });
        }, delay);
        return () => {
            if (autoDjTimerRef.current) {
                clearTimeout(autoDjTimerRef.current);
                autoDjTimerRef.current = null;
            }
            clearInterval(tick);
        };
    }, [room?.autoDj, room?.lastPerformance?.timestamp]);
    useEffect(() => {
        if (room?.bingoMode !== 'mystery') return;
        const pickerUid = room?.bingoPickerUid || (Array.isArray(room?.bingoTurnOrder) ? room.bingoTurnOrder[room?.bingoTurnIndex || 0] : null);
        const pickerUser = users.find(u => u.uid === pickerUid);
        if (pickerUid && pickerUser && room?.bingoPickerName !== pickerUser.name) {
            updateRoom({ bingoPickerName: pickerUser.name });
        }
    }, [room?.bingoMode, room?.bingoPickerUid, room?.bingoTurnIndex, room?.bingoTurnOrder, room?.bingoPickerName, users]);
    useEffect(() => {
        if (room?.bingoMode !== 'mystery') return;
        if (!room?.lastPerformance?.timestamp || !room?.bingoPickerUid) return;
        const order = Array.isArray(room?.bingoTurnOrder) ? room.bingoTurnOrder : [];
        if (!order.length) return;
        const lastTs = getTimestampMs(room.lastPerformance.timestamp);
        const advanceKey = `${lastTs}-${room?.lastPerformance?.singerUid || room?.lastPerformance?.singerName || ''}`;
        if (bingoTurnAdvanceRef.current === advanceKey) return;
        const singerUid = room?.lastPerformance?.singerUid;
        if (!singerUid || singerUid !== room.bingoPickerUid) return;
        const currentIndex = Math.max(0, Number(room?.bingoTurnIndex || 0));
        const nextIndex = (currentIndex + 1) % order.length;
        bingoTurnAdvanceRef.current = advanceKey;
        updateRoom({
            bingoTurnIndex: nextIndex,
            bingoPickerUid: order[nextIndex] || null
        });
    }, [room?.bingoMode, room?.lastPerformance?.timestamp, room?.lastPerformance?.singerUid, room?.lastPerformance?.singerName, room?.bingoTurnOrder, room?.bingoTurnIndex, room?.bingoPickerUid]);
    useEffect(() => {
        if (!room?.autoDj) return;
        if (queuedCount > 0 || performingCount > 0) return;
        const playlistId = room?.appleMusicAutoPlaylistId || '';
        if (!playlistId) return;
        const playback = room?.appleMusicPlayback || {};
        if (playback.type === 'playlist' && playback.id === playlistId && playback.status === 'playing') return;
        playAppleMusicPlaylist(playlistId, { title: room?.appleMusicAutoPlaylistTitle || '' });
    }, [room?.autoDj, queuedCount, performingCount, room?.appleMusicAutoPlaylistId, room?.appleMusicAutoPlaylistTitle, room?.appleMusicPlayback?.status]);
    useEffect(() => {
        return () => {
            if (readyCheckTimerRef.current) clearTimeout(readyCheckTimerRef.current);
        };
    }, []);

    // Data Sync
    useEffect(() => {
        if(!roomCode) return;
        const unsubRoom = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), s => {
            if(s.exists()) setRoom(s.data());
        });
        const unsubSongs = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), where('roomCode', '==', roomCode)), s => setSongs(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubUsers = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_users'), where('roomCode', '==', roomCode)), s => setUsers(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubActivity = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), where('roomCode', '==', roomCode), limit(50)), s => {
             const sorted = s.docs.map(d => d.data()).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
             setActivities(sorted);
        });
        const unsubUploads = onSnapshot(
            query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_uploads'), where('roomCode', '==', roomCode)),
            snap => {
                const items = snap.docs.map(d => ({ id: d.id, _cloud: true, ...d.data() }));
                const total = items.reduce((sum, item) => sum + (item.size || 0), 0);
                setRoomUploadBytes(total);
                setLocalLibrary(prev => {
                    const localOnly = prev.filter(item => item._local);
                    return [...LOCAL_LIBRARY, ...items, ...localOnly];
                });
            }
        );
        
        // VIP Contacts if tab is active
        if (tab === 'lobby' && lobbyTab === 'vip') {
            getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'contacts'), where('roomCode', '==', roomCode))).then(snap => setContacts(snap.docs.map(d => d.data())));
        }

        return () => { unsubRoom(); unsubSongs(); unsubUsers(); unsubActivity(); unsubUploads(); };
    }, [roomCode, tab, lobbyTab]);
    useEffect(() => () => {
        localUploadsRef.current.forEach(url => URL.revokeObjectURL(url));
        localUploadsRef.current = [];
    }, []);
    useEffect(() => {
        let isMounted = true;
        getLocalVideos().then(items => {
            if (!isMounted) return;
            if (!items.length) return;
            const hydrated = items.map(item => {
                const url = URL.createObjectURL(item.blob);
                localUploadsRef.current.push(url);
                return { title: item.title, artist: item.artist || 'Local Upload', url, _local: true, id: item.id, mediaType: item.mediaType || 'video', fileName: item.fileName || '' };
            });
            setLocalLibrary(prev => [...prev, ...hydrated]);
        }).catch((e) => {
            console.warn('Failed to load local media library', e);
        });
        return () => { isMounted = false; };
    }, []);

    const createRoom = async () => { 
        if (!uid) {
            toast('Auth not ready yet. Try again in a second.');
            return;
        }
        let c = '';
        let attempts = 0;
        while (attempts < 12) {
            const candidate = generateRoomCode(4);
            const snap = await getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', candidate));
            if (!snap.exists()) {
                c = candidate;
                break;
            }
            attempts += 1;
        }
        if (!c) {
            toast('Room code collision. Please try again.');
            return;
        }
            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', c), { 
            createdAt: serverTimestamp(),
            activeMode: 'karaoke',
            hideWaveform: false,
            hideOverlay: true,
            videoVolume: 100,
            bgMusicVolume: 0.3,
            bgMusicPlaying: false,
            mixFader: 50,
            autoBgFadeOutMs: 900,
            autoBgFadeInMs: 900,
            autoBgMixDuringSong: 0,
            autoPlayMedia: true,
            hostName: hostName || 'Host',
            hostUid: uid,
            hostUids: [uid],
            logoUrl: ASSETS.logo,
            autoDj: false,
            marqueeEnabled: false,
            marqueeDurationMs: 12000,
            marqueeIntervalMs: 20000,
            marqueeItems: DEFAULT_MARQUEE_ITEMS,
            marqueeShowMode: 'idle',
            tipPointRate: 100,
            tipCrates: DEFAULT_TIP_CRATES,
            audienceVideoMode: 'off',
            showLyricsTv: false,
            showVisualizerTv: false,
            visualizerMode: 'ribbon',
            showLyricsSinger: false,
            hideCornerOverlay: false,
            howToPlay: { active: false, id: Date.now() },
            gameRulesId: 0,
            showScoring: true,
            showFameLevel: true,
            allowSingerTrackSelect: false,
            queueSettings: {
                limitMode: 'none',
                limitCount: 0,
                rotation: 'round_robin',
                firstTimeBoost: true
            },
            chatEnabled: true,
            chatShowOnTv: false,
            chatSlowModeSec: 0,
            chatAudienceMode: 'all'
        }); 
        trackEvent('host_room_created', { room_code: c });
        setRoomCode(c); 
        setView('panel'); 
    };

    const updateRoom = async (d) => updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), d);
    const toggleHowToPlay = async () => {
        const active = !room?.howToPlay?.active;
        await updateRoom({ howToPlay: { active, id: Date.now() } });
    };
    const _saveLogoUrl = async () => {
        await updateRoom({ logoUrl: logoUrl?.trim() || null });
        toast("Logo updated");
    };
    const clearStormTimers = () => {
        stormTimersRef.current.forEach(t => clearTimeout(t));
        stormTimersRef.current = [];
    };
    const startStormSequence = async () => {
        clearStormTimers();
        const seqId = Date.now();
        const totalMs = STORM_SEQUENCE.approachMs + STORM_SEQUENCE.peakMs + STORM_SEQUENCE.passMs + STORM_SEQUENCE.clearMs;
        await updateRoom({
            lightMode: 'storm',
            stormSequenceId: seqId,
            stormStartedAt: seqId,
            stormPhase: 'approach',
            stormConfig: STORM_SEQUENCE,
            stormEndsAt: seqId + totalMs
        });

        stormTimersRef.current.push(setTimeout(() => updateRoom({ stormPhase: 'peak' }), STORM_SEQUENCE.approachMs));
        stormTimersRef.current.push(setTimeout(() => updateRoom({ stormPhase: 'pass' }), STORM_SEQUENCE.approachMs + STORM_SEQUENCE.peakMs));
        stormTimersRef.current.push(setTimeout(() => updateRoom({ stormPhase: 'clear' }), STORM_SEQUENCE.approachMs + STORM_SEQUENCE.peakMs + STORM_SEQUENCE.passMs));
        stormTimersRef.current.push(setTimeout(() => updateRoom({ lightMode: 'off', stormPhase: 'off' }), totalMs));
    };
    const stopStormSequence = async () => {
        clearStormTimers();
        await updateRoom({ lightMode: 'off', stormPhase: 'off' });
    };
    const startBeatDrop = async () => {
        const now = Date.now();
        await updateRoom({
            lightMode: 'strobe',
            strobeSessionId: now,
            strobeCountdownUntil: now + STROBE_COUNTDOWN_MS,
            strobeEndsAt: now + STROBE_COUNTDOWN_MS + STROBE_ACTIVE_MS,
            strobeWinner: null,
            strobeResults: null,
            strobeVictory: null
        });
    };
    const setBgMusicState = (next) => {
        setPlayingBg(next);
        if (next) {
            if (bgCtxRef.current && bgCtxRef.current.state === 'suspended') {
                bgCtxRef.current.resume().catch(() => {});
            }
            bgAudio.current.play().catch(() => {});
        } else {
            bgAudio.current.pause();
        }
        updateRoom({ bgMusicPlaying: next, bgMusicUrl: BG_TRACKS[currentTrackIdx].url });
    };
    const toggleBgMusic = async () => {
        if (playingBg && autoBgMusic) {
            setAutoBgMusic(false);
            await updateRoom({ autoBgMusic: false });
        }
        setBgMusicState(!playingBg);
    };
    const skipBg = () => { const next = (currentTrackIdx + 1) % BG_TRACKS.length; setCurrentTrackIdx(next); bgAudio.current.src = BG_TRACKS[next].url; if(playingBg) { bgAudio.current.play(); updateRoom({ bgMusicUrl: BG_TRACKS[next].url }); }};
    useEffect(() => {
        if (!autoBgMusic) return;
        if (!currentSong && !playingBg) {
            setBgMusicState(true);
        }
    }, [autoBgMusic, currentSong, playingBg]);

    const fadeMixFader = (targetPercent, durationMs = 800) => {
        if (mixFadeRef.current) {
            clearInterval(mixFadeRef.current);
        }
        const start = mixFader;
        const diff = targetPercent - start;
        const steps = Math.max(1, Math.round(durationMs / 120));
        let tick = 0;
        mixFadeTargetRef.current = targetPercent;
        mixFadeRef.current = setInterval(() => {
            tick += 1;
            const t = Math.min(1, tick / steps);
            const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            const next = Math.round(start + diff * eased);
            const clamped = Math.max(0, Math.min(100, next));
            const bg = clamped / 100;
            const song = 1 - bg;
            setMixFader(clamped);
            setBgVolume(bg);
            updateRoom({ mixFader: clamped, bgMusicVolume: bg, videoVolume: Math.round(song * 100) });
            if (t >= 1) {
                clearInterval(mixFadeRef.current);
                mixFadeRef.current = null;
            }
        }, 120);
    };

    useEffect(() => () => {
        if (mixFadeRef.current) clearInterval(mixFadeRef.current);
    }, []);

    useEffect(() => {
        if (!autoBgMusic) return;
        const isPlayingSong = !!currentSong;
        if (prevSongStateRef.current === isPlayingSong) return;
        prevSongStateRef.current = isPlayingSong;
        const fadeOutMs = Math.max(200, Number(autoBgFadeOutMs || 900));
        const fadeInMs = Math.max(200, Number(autoBgFadeInMs || 900));
        const targetMix = Math.max(0, Math.min(100, Number(autoBgMixDuringSong ?? 0)));
        if (isPlayingSong) {
            mixBeforeSongRef.current = mixFader;
            fadeMixFader(targetMix, fadeOutMs);
        } else {
            const restore = Math.max(0, Math.min(100, mixBeforeSongRef.current ?? mixFadeTargetRef.current ?? 50));
            fadeMixFader(restore, fadeInMs);
        }
    }, [autoBgMusic, currentSong, autoBgFadeOutMs, autoBgFadeInMs, autoBgMixDuringSong]);
    const handleMixFaderChange = (val) => {
        let clamped = Math.max(0, Math.min(100, val));
        if (Math.abs(clamped - 50) <= 3) {
            clamped = 50;
        }
        const bg = clamped / 100;
        const song = 1 - bg;
        setMixFader(clamped);
        setBgVolume(bg);
        updateRoom({ mixFader: clamped, bgMusicVolume: bg, videoVolume: Math.round(song * 100) });
    };
    const toggleSongMute = () => {
        const currentVol = room?.videoVolume ?? 100;
        if (currentVol > 0) {
            setSongMuteBackup(currentVol);
            updateRoom({ videoVolume: 0 });
        } else {
            updateRoom({ videoVolume: songMuteBackup || 100 });
        }
    };
    const toggleBgMute = () => {
        if (bgVolume > 0) {
            setBgMuteBackup(bgVolume);
            setBgVolume(0);
            updateRoom({ bgMusicVolume: 0 });
        } else {
            const restore = bgMuteBackup || 0.3;
            setBgVolume(restore);
            updateRoom({ bgMusicVolume: restore });
        }
    };
    const playSfxSafe = (url) => {
        if (sfxMuted) return;
        playSfx(url, sfxVolume);
        setSfxLevel(100);
        if (sfxPulseRef.current) clearTimeout(sfxPulseRef.current);
        sfxPulseRef.current = setTimeout(() => setSfxLevel(0), 600);
    };
    const dropBonus = async (points) => {
        if (!roomCode) return;
        await updateRoom({ bonusDrop: { id: Date.now(), points, by: hostName || 'Host' } });
        logActivity(roomCode, hostName || 'Host', `dropped +${points} pts to the room`, EMOJI.sparkle);
        toast(`Bonus drop: +${points} PTS`);
    };
    const giftPointsToUser = async (targetUid, points) => {
        if (!roomCode || !targetUid || !points) return;
        const amount = Math.max(1, Math.round(points));
        try {
            const target = users.find(u => (u.uid || u.id?.split('_')[1]) === targetUid);
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${targetUid}`), { points: increment(amount) });
            await logActivity(roomCode, target?.name || 'Guest', `received ${amount} pts from ${hostName || 'Host'}`, EMOJI.sparkle);
            toast(`Gifted ${amount} pts`);
        } catch (e) {
            console.error(e);
            toast('Gift failed');
        }
    };
    const startReadyCheck = async () => {
        const durationSec = Math.max(3, Number(readyCheckDurationSec || 10));
        const rewardPoints = Math.max(0, Number(readyCheckRewardPoints || 0));
        await updateRoom({ readyCheck: { active: true, startTime: Date.now(), durationSec, rewardPoints } });
        if (readyCheckTimerRef.current) clearTimeout(readyCheckTimerRef.current);
        readyCheckTimerRef.current = setTimeout(() => {
            updateRoom({ 'readyCheck.active': false });
        }, durationSec * 1000);
    };
    const awardTipPoints = async () => {
        const amount = parseFloat(tipAmount);
        if (!tipUserId || !amount || amount <= 0) return;
        const points = Math.round(amount * (tipPointRate || 100));
        try {
            const target = users.find(u => (u.uid || u.id?.split('_')[1]) === tipUserId);
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${tipUserId}`), { points: increment(points) });
            await logActivity(roomCode, target?.name || 'Guest', `received ${points} pts for a $${amount.toFixed(2)} tip`, EMOJI.tip);
            toast(`Awarded ${points} pts`);
            setTipAmount('');
        } catch (e) {
            console.error(e);
            toast('Tip award failed');
        }
    };
    const saveApiKeys = async () => { 
        localStorage.setItem('bross_host_name', hostName || 'Host');
        if (roomCode) {
            await updateRoom({ 
                tipUrl: tipSettings.link.trim() || null, 
                tipQrUrl: tipSettings.qr.trim() || null,
                hostName: hostName || 'Host',
                logoUrl: logoUrl || null,
                tipPointRate: tipPointRate || 100,
                tipCrates: tipCrates.map((crate, idx) => ({
                    id: crate.id || `crate_${idx}`,
                    label: crate.label || `Crate ${idx + 1}`,
                    amount: Number(crate.amount || 0),
                    points: Number(crate.points || 0),
                    rewardScope: crate.rewardScope || 'room',
                    awardBadge: !!crate.awardBadge
                })),
                appleMusicAutoPlaylistId: parseAppleMusicPlaylistId(appleMusicAutoPlaylistId),
                appleMusicAutoPlaylistTitle: (appleMusicAutoPlaylistTitle || '').trim(),
                autoBgFadeOutMs: Math.max(200, Number(autoBgFadeOutMs || 900)),
                autoBgFadeInMs: Math.max(200, Number(autoBgFadeInMs || 900)),
                autoBgMixDuringSong: Math.max(0, Math.min(100, Number(autoBgMixDuringSong ?? 0))),
                readyCheckDurationSec: Math.max(3, Number(readyCheckDurationSec || 10)),
                readyCheckRewardPoints: Math.max(0, Number(readyCheckRewardPoints || 0)),
                showScoring: !!showScoring,
                showFameLevel: !!showFameLevel,
                allowSingerTrackSelect: !!allowSingerTrackSelect,
                queueSettings: {
                    limitMode: queueLimitMode || 'none',
                    limitCount: Math.max(0, Number(queueLimitCount || 0)),
                    rotation: queueRotation || 'round_robin',
                    firstTimeBoost: !!queueFirstTimeBoost
                }
            });
        }
        setShowSettings(false); 
        toast("Settings Saved"); 
    };

    const persistYtIndex = async (next) => {
        setYtIndex(next);
        if (!roomCode) return;
        await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), { ytIndex: next }, { merge: true });
    };

    useEffect(() => {
        if (!roomCode) return;
        const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), s => {
            const data = s.data() || {};
            if (Array.isArray(data.ytIndex)) setYtIndex(data.ytIndex);
        });
        return () => unsub();
    }, [roomCode]);

    const deleteRoomCollection = async (collectionName) => {
        const snap = await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', collectionName), where('roomCode', '==', roomCode)));
        if (snap.empty) return 0;
        let deleted = 0;
        for (let i = 0; i < snap.docs.length; i += 400) {
            const batch = writeBatch(db);
            snap.docs.slice(i, i + 400).forEach(docSnap => batch.delete(docSnap.ref));
            await batch.commit();
            deleted += Math.min(400, snap.docs.length - i);
        }
        return deleted;
    };

    const deleteRoomUploads = async () => {
        if (!roomCode) return 0;
        const snap = await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_uploads'), where('roomCode', '==', roomCode)));
        if (snap.empty) return 0;
        let deleted = 0;
        for (const docSnap of snap.docs) {
            const data = docSnap.data() || {};
            const path = data.storagePath;
            if (path) {
                try { await deleteObject(storageRef(storage, path)); } catch { /* ignore delete failures */ }
            }
            try { await deleteDoc(docSnap.ref); } catch { /* ignore delete failures */ }
            deleted += 1;
        }
        return deleted;
    };

    const clearRoomData = async () => {
        if (!roomCode) return;
        if (!window.confirm('Clear room data and uploads? This removes queue, reactions, users, activity, and stored uploads.')) return;
        setClearingRoom(true);
        try {
            const collections = [
                'karaoke_songs',
                'reactions',
                'activities',
                'messages',
                'room_users',
                'contacts',
                'selfie_submissions',
                'selfie_votes'
            ];
            await deleteRoomUploads();
            for (const name of collections) {
                await deleteRoomCollection(name);
            }
            await updateRoom({
                activeMode: 'karaoke',
                activeScreen: 'stage',
                spotlightUser: null,
                bonusDrop: null,
                guitarWinner: null,
                bingoWin: null,
                bingoBoardId: null,
                bingoData: null,
                selfieChallenge: null,
                photoOverlay: null,
                highlightedTile: null,
                applausePeak: null,
                currentApplauseLevel: 0,
                howToPlay: { active: false, id: Date.now() },
                gameRulesId: Date.now()
            });
            toast('Room cleared.');
        } catch (e) {
            console.error(e);
            toast('Clear room failed.');
        } finally {
            setClearingRoom(false);
        }
    };
    const parsePlaylistId = (input = '') => {
        if (!input) return '';
        try {
            const url = new URL(input.trim());
            const listParam = url.searchParams.get('list');
            if (listParam) return listParam;
        } catch {
            // not a URL
        }
        const match = input.match(/[?&]list=([^&]+)/);
        if (match) return match[1];
        return input.trim();
    };
    const loadYouTubePlaylist = async () => {
        const playlistId = parsePlaylistId(ytPlaylistUrl);
        if (!playlistId) {
            toast('Paste a valid YouTube playlist URL or ID');
            return;
        }
        setYtPlaylistLoading(true);
        setYtPlaylistStatus('Loading playlist...');
        try {
            const data = await callFunction('youtubePlaylist', { playlistId, maxTotal: 150 });
            const items = (data?.items || []).map(item => ({
                id: item.id,
                title: item.title || 'Untitled',
                channel: item.channelTitle || 'YouTube',
                thumbnail: item.thumbnails?.medium?.url || item.thumbnails?.default?.url || '',
                url: item.id ? `https://www.youtube.com/watch?v=${item.id}` : ''
            })).filter(item => item.id);
            const updated = (() => {
                const existing = new Map(ytIndex.map(item => [item.videoId, item]));
                items.forEach(item => {
                    existing.set(item.id, {
                        videoId: item.id,
                        source: 'youtube',
                        trackName: item.title,
                        artistName: item.channel,
                        artworkUrl100: item.thumbnail,
                        url: item.url
                    });
                });
                return Array.from(existing.values());
            })();
            await persistYtIndex(updated);
            setYtPlaylistStatus(`Indexed ${items.length} videos from playlist`);
        } catch (e) {
            console.error('Playlist load error', e);
            setYtPlaylistStatus('Failed to load playlist. Check server keys or playlist privacy.');
            toast('Playlist load failed.');
        } finally {
            setYtPlaylistLoading(false);
        }
    };

    const addYouTubeIndexEntry = async () => {
        if (!roomCode) return;
        const title = ytAddTitle.trim();
        const artist = ytAddArtist.trim();
        const url = ytAddUrl.trim();
        if (!title && !url) {
                                    setYtAddStatus('Add a title or YouTube URL.');
            return;
        }
        setYtAddLoading(true);
        setYtAddStatus('');
        try {
            let item = null;
            if (url) {
                const videoId = parseYouTubeVideoId(url);
                if (!videoId) throw new Error('Invalid YouTube URL');
                item = {
                    id: videoId,
                    title: title || 'YouTube Track',
                    channel: artist || 'YouTube',
                    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    url: `https://www.youtube.com/watch?v=${videoId}`
                };
            } else {
                const query = `${title} ${artist}`.trim();
                const data = await callFunction('youtubeSearch', { query: `${query} karaoke`, maxResults: 1 });
                const first = (data?.items || [])[0];
                if (!first) throw new Error('No results found');
                item = {
                    id: first.id,
                    title: first.title,
                    channel: first.channelTitle || artist || 'YouTube',
                    thumbnail: first.thumbnails?.medium?.url || first.thumbnails?.default?.url || '',
                    url: `https://www.youtube.com/watch?v=${first.id}`
                };
            }
            const updated = (() => {
                const existing = new Map(ytIndex.map(entry => [entry.videoId, entry]));
                existing.set(item.id, {
                    videoId: item.id,
                    source: 'youtube',
                    trackName: item.title,
                    artistName: item.channel,
                    artworkUrl100: item.thumbnail,
                    url: item.url
                });
                return Array.from(existing.values());
            })();
            await persistYtIndex(updated);
            setYtAddStatus(`Added "${item.title}"`);
            setYtAddTitle('');
            setYtAddArtist('');
            setYtAddUrl('');
        } catch (e) {
            console.error(e);
            setYtAddStatus(e.message || 'Failed to add track');
        } finally {
            setYtAddLoading(false);
        }
    };
    const isAudioUrl = (url) => /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(url || '');
    const handleLocalUpload = async (file, addToQueue = false) => {
        if (!file) return null;
        if (!roomCode) {
            toast('Create a room first');
            return null;
        }
        if (!uid) {
            toast('Host auth not ready yet');
            return null;
        }
        if (file.size && file.size > 150 * 1024 * 1024) {
            toast('Upload too large. Keep files under 150MB.');
            return null;
        }
        const projected = roomUploadBytes + (file.size || 0);
        if (projected > 2 * 1024 * 1024 * 1024) {
            const proceed = window.confirm('Room storage is over 2GB. Upload anyway?');
            if (!proceed) return null;
        }
        const hostUids = room?.hostUids || (room?.hostUid ? [room.hostUid] : []);
        if (hostUids.length && !hostUids.includes(uid)) {
            toast('Only hosts can upload to the room library');
            return null;
        }
        const maxBytes = 150 * 1024 * 1024;
        if (file.size && file.size > maxBytes) {
            toast('File too large. Max 150MB.');
            return null;
        }
        try {
            setUploadingLocal(true);
            setUploadProgress(0);
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `room_uploads/${roomCode}/${Date.now()}_${safeName}`;
            const fileRef = storageRef(storage, storagePath);
            const uploadTask = uploadBytesResumable(fileRef, file, file.type ? { contentType: file.type } : undefined);

            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snap) => {
                        const progress = snap.totalBytes ? (snap.bytesTransferred / snap.totalBytes) * 100 : 0;
                        setUploadProgress(progress);
                    },
                    (err) => reject(err),
                    () => resolve(true)
                );
            });

            const url = await getDownloadURL(fileRef);
            const title = file.name.replace(/\.[^/.]+$/, '');
            const mediaType = file.type && file.type.startsWith('audio/') ? 'audio' : 'video';
            const payload = {
                roomCode,
                title,
                artist: 'Local Upload',
                url,
                fileName: file.name,
                mediaType,
                storagePath,
                size: file.size || 0,
                createdAt: serverTimestamp(),
                createdBy: room?.hostName || 'Host'
            };
            const docRef = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_uploads'), payload);
            const newItem = { id: docRef.id, _cloud: true, ...payload };
            setLocalLibrary(prev => [...prev, newItem]);
            toast(mediaType === 'audio' ? 'Uploaded audio to room library' : 'Uploaded video to room library');
            if (addToQueue) await addLocalItemToQueue(newItem);
            return newItem;
        } catch (e) {
            console.error(e);
            toast('Upload failed. Check network or file size.');
            return null;
        } finally {
            setUploadingLocal(false);
            setUploadProgress(0);
        }
    };
    const addLocalItemToQueue = async (item) => {
        if (!item?.title || !item?.url) return;
        try {
            const songRecord = await ensureSong({
                title: item.title,
                artist: item.artist || 'Local Upload',
                artworkUrl: '',
                verifyMeta: false,
                verifiedBy: hostName || 'host'
            });
            const songId = songRecord?.songId || buildSongKey(item.title, item.artist || 'Local Upload');
            const trackRecord = await ensureTrack({
                songId,
                source: 'custom',
                mediaUrl: item.url,
                duration: null,
                audioOnly: item.mediaType === 'audio' || isAudioUrl(item.url),
                backingOnly: item.mediaType === 'audio' || isAudioUrl(item.url),
                addedBy: hostName || 'Host'
            });
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
                roomCode,
                songId,
                trackId: trackRecord?.trackId || null,
                trackSource: 'custom',
                songTitle: item.title,
                artist: item.artist || 'Local Upload',
                singerName: room?.hostName || hostName || 'Host',
                mediaUrl: item.url,
                albumArtUrl: '',
                lyrics: '',
                status: 'requested',
                timestamp: serverTimestamp(),
                priorityScore: Date.now(),
                emoji: EMOJI.mic,
                backingAudioOnly: item.mediaType === 'audio' || isAudioUrl(item.url),
                audioOnly: item.mediaType === 'audio' || isAudioUrl(item.url)
            });
            toast('Added local upload to queue');
        } catch (e) {
            console.error(e);
            toast('Failed to add local upload to queue');
        }
    };
    const deleteCloudUpload = async (item) => {
        if (!item?.id || !item?.storagePath) return;
        const confirmed = window.confirm(`Delete "${item.title}" from the room library?`);
        if (!confirmed) return;
        try {
            await deleteObject(storageRef(storage, item.storagePath));
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_uploads', item.id));
            toast('Removed upload');
        } catch (e) {
            console.error(e);
            toast('Failed to delete upload');
        }
    };
    const saveMarqueeSettings = async () => {
        const durationMs = Math.max(4000, Math.floor(Number(marqueeDurationSec || 0) * 1000));
        const intervalMs = Math.max(4000, Math.floor(Number(marqueeIntervalSec || 0) * 1000));
        await updateRoom({
            marqueeEnabled,
            marqueeDurationMs: durationMs,
            marqueeIntervalMs: intervalMs,
            marqueeShowMode
        });
        toast("Marquee settings saved");
    };
    const updateMarqueeItems = async (items) => {
        setMarqueeItems(items);
        await updateRoom({ marqueeItems: items });
    };
    const downloadJson = (filename, payload) => {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };
    const downloadRoomData = async () => {
        if (!roomCode) return;
        setExportingRoom(true);
        try {
            const [roomSnap, songsSnap, usersSnap, activitiesSnap, reactionsSnap, uploadsSnap] = await Promise.all([
                getDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode)),
                getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), where('roomCode', '==', roomCode))),
                getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_users'), where('roomCode', '==', roomCode))),
                getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), where('roomCode', '==', roomCode))),
                getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), where('roomCode', '==', roomCode))),
                getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_uploads'), where('roomCode', '==', roomCode)))
            ]);
            const payload = {
                roomCode,
                exportedAt: new Date().toISOString(),
                room: roomSnap.exists() ? roomSnap.data() : null,
                songs: songsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                activities: activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                reactions: reactionsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                uploads: uploadsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            };
            downloadJson(`bross-room-${roomCode}-export.json`, payload);
            toast('Room data exported');
        } catch (e) {
            console.error(e);
            toast('Export failed');
        } finally {
            setExportingRoom(false);
        }
    };
    const closeRoomWithRecap = async () => {
        if (!roomCode) return;
        const ok = window.confirm('Close this room and generate a recap?');
        if (!ok) return;
        setClosingRoom(true);
        try {
            const performed = songs.filter(s => s.status === 'performed');
            const topPerformers = [...userStats.values()]
                .sort((a, b) => b.performances - a.performances)
                .slice(0, 5)
                .map(u => ({ name: u.name, avatar: u.avatar, performances: u.performances, loudest: u.loudest }));
            const topEmojis = [...userStats.values()]
                .sort((a, b) => (b.totalEmojis || 0) - (a.totalEmojis || 0))
                .slice(0, 5)
                .map(u => ({ name: u.name, avatar: u.avatar, totalEmojis: u.totalEmojis || 0 }));
            const loudestPerformance = performed.reduce((acc, s) => {
                const score = s.applauseScore || 0;
                if (!acc || score > acc.applauseScore) {
                    return { singer: s.singerName, song: s.songTitle, applauseScore: score };
                }
                return acc;
            }, null);
            const photoSnap = await getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), where('roomCode', '==', roomCode), where('type', '==', 'photo')));
            const photos = photoSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const recap = {
                roomCode,
                generatedAt: Date.now(),
                totalSongs: performed.length,
                totalUsers: users.length,
                topPerformers,
                topEmojis,
                loudestPerformance,
                photos: photos.slice(0, 24),
                highlights: (activities || []).slice(0, 20)
            };
            await updateRoom({ closedAt: Date.now(), recap });
            const recapUrl = `${window.location.origin}/?room=${roomCode}&mode=recap`;
            await navigator.clipboard.writeText(recapUrl);
            toast('Room closed. Recap link copied.');
        } catch (e) {
            console.error(e);
            toast('Recap failed');
        } finally {
            setClosingRoom(false);
        }
    };
    const previewRecap = async () => {
        if (!roomCode) return;
        const baseSong = currentSong || songs.find(s => s.status === 'performed') || songs[0] || {};
        const topFan = (() => {
            if (!users?.length) return null;
            const performanceId = baseSong?.id || null;
            const ranked = users
                .filter((u) => !performanceId || u.lastPerformanceId === performanceId)
                .map((u) => ({
                    name: u.name || 'Guest',
                    avatar: u.avatar || EMOJI.sparkle,
                    pointsGifted: u.performancePointsGifted || 0
                }))
                .sort((a, b) => (b.pointsGifted || 0) - (a.pointsGifted || 0));
            const best = ranked[0];
            if (!best || best.pointsGifted <= 0) return null;
            return best;
        })();
        const vibeStats = (() => {
            const guitarSessionId = room?.guitarSessionId;
            const strobeSessionId = room?.strobeSessionId;
            const stats = { guitar: null, strobe: null };
            if (guitarSessionId) {
                let totalHits = 0;
                let top = null;
                users.forEach((u) => {
                    if (u.guitarSessionId !== guitarSessionId) return;
                    const hits = u.guitarHits || 0;
                    totalHits += hits;
                    if (!top || hits > top.hits) top = { name: u.name || 'Guest', avatar: u.avatar || EMOJI.guitar, hits };
                });
                if (totalHits > 0) stats.guitar = { totalHits, top };
            }
            if (strobeSessionId) {
                let totalTaps = 0;
                let top = null;
                users.forEach((u) => {
                    if (u.strobeSessionId !== strobeSessionId) return;
                    const taps = u.strobeTaps || 0;
                    totalTaps += taps;
                    if (!top || taps > top.taps) top = { name: u.name || 'Guest', avatar: u.avatar || EMOJI.rocket, taps };
                });
                if (totalTaps > 0) stats.strobe = { totalTaps, top };
            }
            return (stats.guitar || stats.strobe) ? stats : null;
        })();
        const recapPreview = {
            songTitle: baseSong.songTitle || 'Sample Song',
            singerName: baseSong.singerName || room?.hostName || 'Guest',
            hypeScore: baseSong.hypeScore || 120,
            applauseScore: baseSong.applauseScore || 85,
            hostBonus: baseSong.hostBonus || 25,
            albumArtUrl: baseSong.albumArtUrl || '',
            topFan,
            vibeStats,
            timestamp: Date.now(),
            preview: true
        };
        await updateRoom({ recapPreview });
        toast('Recap preview sent to TV');
    };
    const startNextFromQueue = async () => {
        const activeRoom = roomRef.current;
        if (!activeRoom?.autoDj) return;
        const list = songsRef.current || [];
        const performing = list.find(s => s.status === 'performing');
        if (performing) return;
        const queued = list.filter(s => s.status === 'requested')
            .sort((a, b) => (a.priorityScore || 0) - (b.priorityScore || 0));
        const next = queued[0];
        if (!next) return;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', next.id), { status: 'performing' });
        const autoStartMedia = !!(next?.mediaUrl || next?.appleMusicId) && (activeRoom?.autoPlayMedia !== false);
        if (next?.appleMusicId && autoStartMedia) {
            await playAppleMusicTrack(next.appleMusicId, { title: next.songTitle, artist: next.artist });
            await updateRoom({
                activeMode: 'karaoke',
                'announcement.active': false,
                mediaUrl: '',
                singAlongMode: false,
                videoPlaying: false,
                videoStartTimestamp: null,
                videoVolume: 100,
                showLyricsTv: false,
                showVisualizerTv: false,
                showLyricsSinger: false
            });
        } else {
            await updateRoom({
                activeMode: 'karaoke',
                'announcement.active': false,
                mediaUrl: next.mediaUrl || '',
                singAlongMode: false,
                videoPlaying: autoStartMedia,
                videoStartTimestamp: autoStartMedia ? Date.now() : null,
                videoVolume: 100,
                showLyricsTv: false,
                showVisualizerTv: false,
                showLyricsSinger: false,
                appleMusicPlayback: null
            });
        }
        logActivity(roomCode, next.singerName, `took the stage!`, EMOJI.mic);
    };
    // Fix: Simple reload for silence
    const silenceAll = () => stopAllSfx();
    
    // Helpers for other tabs
    const sendUserMessage = async (uid, msg) => { await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { spotlightUser: msg ? {id: uid, msg: msg} : null }); toast(msg ? "Spotlight ON" : "Spotlight OFF"); };
    const kickUser = async (uid) => { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`)); toast("User Kicked"); };
    
    // Score modification
    const openModifyScore = (s) => { setModifyingScoreId(s.id); setScoreForm({ hype: s.hypeScore||0, applause: s.applauseScore||0, bonus: s.hostBonus||0 }); }; 
    const saveModifiedScore = async () => { await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', modifyingScoreId), { hypeScore: parseInt(scoreForm.hype), applauseScore: parseInt(scoreForm.applause), hostBonus: parseInt(scoreForm.bonus) }); setModifyingScoreId(null); toast("Score Updated"); };
    
    // Helper to log activities
    const logActivity = async (roomCode, user, text, icon) => {
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), {
                roomCode, user, text, icon, timestamp: serverTimestamp()
            });
        } catch(e) { console.error("Log error", e); }
    };
    const sendHostChatMessage = async (text) => {
        const message = (text ?? chatDraft).trim();
        if (!message || !roomCode) return;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'), {
                roomCode,
                text: message,
                user: hostName || 'Host',
                avatar: EMOJI.mic,
                isHost: true,
                timestamp: serverTimestamp()
            });
            if (!text || message === chatDraft.trim()) {
                setChatDraft('');
            }
        } catch (e) {
            console.error(e);
            toast('Chat send failed');
        }
    };
    const sendHostChat = async () => sendHostChatMessage();
    const sendHostDmMessage = async (targetUid, text) => {
        const message = (text ?? '').trim();
        if (!message || !roomCode || !targetUid) return;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'), {
                roomCode,
                text: message,
                user: hostName || 'Host',
                avatar: EMOJI.mic,
                isHost: true,
                toUid: targetUid,
                channel: 'dm',
                timestamp: serverTimestamp()
            });
        } catch (e) {
            console.error(e);
            toast('DM send failed');
        }
    };
    const openChatSettings = () => {
        setShowSettings(true);
        setSettingsTab('chat');
    };
    
    // History
    const history = songs.filter(s => s.status === 'performed').sort((a,b) => b.timestamp?.seconds - a.timestamp?.seconds);
    const userStats = useMemo(() => {
        const stats = new Map();
        users.forEach(u => {
            const uid = u.uid || u.id?.split('_')[1] || u.name;
            stats.set(uid, {
                uid,
                name: u.name,
                avatar: u.avatar,
                isVip: !!u.isVip || (u.vipLevel || 0) > 0,
                totalEmojis: u.totalEmojis || 0,
                performances: 0,
                loudest: 0,
                lastSeen: u.lastSeen
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
                    lastSeen: null
                });
            }
            const entry = stats.get(key);
            entry.performances += 1;
            entry.loudest = Math.max(entry.loudest, s.applauseScore || 0);
        });
        return stats;
    }, [users, songs]);
    const sampleArt = {
        neon: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=80',
        crowd: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=200&q=80',
        mic: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=200&q=80',
        stage: 'https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=200&q=80',
        guitar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=200&q=80',
        disco: 'https://images.unsplash.com/photo-1504805572947-34fad45aed93?auto=format&fit=crop&w=200&q=80',
        vinyl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=200&q=80',
        lights: 'https://images.unsplash.com/photo-1485579149621-3123dd979885?auto=format&fit=crop&w=200&q=80'
    };
    const top100Seed = [
        { title: "Don't Stop Believin'", artist: 'Journey' },
        { title: 'Bohemian Rhapsody', artist: 'Queen' },
        { title: 'Sweet Caroline', artist: 'Neil Diamond' },
        { title: 'I Will Survive', artist: 'Gloria Gaynor' },
        { title: "Livin' on a Prayer", artist: 'Bon Jovi' },
        { title: 'Billie Jean', artist: 'Michael Jackson' },
        { title: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd' },
        { title: 'Friends in Low Places', artist: 'Garth Brooks' },
        { title: 'Uptown Funk', artist: 'Bruno Mars' },
        { title: 'Wonderwall', artist: 'Oasis' },
        { title: 'Hey Jude', artist: 'The Beatles' },
        { title: 'My Girl', artist: 'The Temptations' },
        { title: 'Dancing Queen', artist: 'ABBA' },
        { title: 'Girls Just Want to Have Fun', artist: 'Cyndi Lauper' },
        { title: 'I Wanna Dance with Somebody', artist: 'Whitney Houston' },
        { title: 'Respect', artist: 'Aretha Franklin' },
        { title: 'Rolling in the Deep', artist: 'Adele' },
        { title: 'Firework', artist: 'Katy Perry' },
        { title: 'Shake It Off', artist: 'Taylor Swift' },
        { title: "Don't Stop Me Now", artist: 'Queen' },
        { title: 'Summer of 69', artist: 'Bryan Adams' },
        { title: 'Like a Virgin', artist: 'Madonna' },
        { title: 'Total Eclipse of the Heart', artist: 'Bonnie Tyler' },
        { title: "Sweet Child O' Mine", artist: "Guns N Roses" },
        { title: 'Eye of the Tiger', artist: 'Survivor' },
        { title: 'September', artist: 'Earth Wind and Fire' },
        { title: 'Celebration', artist: 'Kool and The Gang' },
        { title: 'Brown Eyed Girl', artist: 'Van Morrison' },
        { title: 'Take On Me', artist: 'A-ha' },
        { title: 'Another One Bites the Dust', artist: 'Queen' },
        { title: 'With or Without You', artist: 'U2' },
        { title: 'I Love Rock n Roll', artist: 'Joan Jett' },
        { title: 'You Shook Me All Night Long', artist: 'AC/DC' },
        { title: 'Hotel California', artist: 'Eagles' },
        { title: 'Sweet Dreams (Are Made of This)', artist: 'Eurythmics' },
        { title: 'Stand By Me', artist: 'Ben E King' },
        { title: 'Lean on Me', artist: 'Bill Withers' },
        { title: 'Take Me Home, Country Roads', artist: 'John Denver' },
        { title: 'Shallow', artist: 'Lady Gaga' },
        { title: 'Halo', artist: 'Beyonce' },
        { title: 'Crazy in Love', artist: 'Beyonce' },
        { title: 'Since U Been Gone', artist: 'Kelly Clarkson' },
        { title: 'You Belong with Me', artist: 'Taylor Swift' },
        { title: "Stayin' Alive", artist: 'Bee Gees' },
        { title: 'Let It Be', artist: 'The Beatles' },
        { title: 'I Will Always Love You', artist: 'Whitney Houston' },
        { title: 'Torn', artist: 'Natalie Imbruglia' },
        { title: 'Hit Me with Your Best Shot', artist: 'Pat Benatar' },
        { title: "(I've Had) The Time of My Life", artist: 'Bill Medley and Jennifer Warnes' },
        { title: 'Come Together', artist: 'The Beatles' },
        { title: 'Landslide', artist: 'Fleetwood Mac' },
        { title: 'Go Your Own Way', artist: 'Fleetwood Mac' },
        { title: 'Dreams', artist: 'Fleetwood Mac' },
        { title: 'Crazy', artist: 'Gnarls Barkley' },
        { title: 'Mr. Brightside', artist: 'The Killers' },
        { title: 'Valerie', artist: 'Amy Winehouse' },
        { title: 'Rehab', artist: 'Amy Winehouse' },
        { title: 'All Star', artist: 'Smash Mouth' },
        { title: 'Livin La Vida Loca', artist: 'Ricky Martin' },
        { title: 'Bye Bye Bye', artist: 'NSYNC' },
        { title: 'Wannabe', artist: 'Spice Girls' },
        { title: 'No Scrubs', artist: 'TLC' },
        { title: 'Waterfalls', artist: 'TLC' },
        { title: 'Killing Me Softly', artist: 'Fugees' },
        { title: 'My Heart Will Go On', artist: 'Celine Dion' },
        { title: 'Genie in a Bottle', artist: 'Christina Aguilera' },
        { title: 'Believe', artist: 'Cher' },
        { title: "I'm Yours", artist: 'Jason Mraz' },
        { title: 'Say My Name', artist: "Destiny's Child" },
        { title: 'Single Ladies', artist: 'Beyonce' },
        { title: 'Poker Face', artist: 'Lady Gaga' },
        { title: 'Bad Romance', artist: 'Lady Gaga' },
        { title: 'Somebody to Love', artist: 'Queen' },
        { title: 'Beat It', artist: 'Michael Jackson' },
        { title: 'Man in the Mirror', artist: 'Michael Jackson' },
        { title: 'Smooth', artist: 'Santana' },
        { title: 'Faith', artist: 'George Michael' },
        { title: 'Under the Bridge', artist: 'Red Hot Chili Peppers' },
        { title: 'Losing My Religion', artist: 'REM' },
        { title: 'Creep', artist: 'Radiohead' },
        { title: 'The Middle', artist: 'Jimmy Eat World' },
        { title: 'Sk8er Boi', artist: 'Avril Lavigne' },
        { title: 'Complicated', artist: 'Avril Lavigne' },
        { title: 'Ironic', artist: 'Alanis Morissette' },
        { title: 'Hand in My Pocket', artist: 'Alanis Morissette' },
        { title: 'The Scientist', artist: 'Coldplay' },
        { title: 'Yellow', artist: 'Coldplay' },
        { title: 'Viva La Vida', artist: 'Coldplay' },
        { title: 'Drops of Jupiter', artist: 'Train' },
        { title: 'Hey Ya!', artist: 'OutKast' },
        { title: 'Ms. Jackson', artist: 'OutKast' },
        { title: 'I Gotta Feeling', artist: 'Black Eyed Peas' },
        { title: 'No Diggity', artist: 'Blackstreet' },
        { title: 'Yeah!', artist: 'Usher' },
        { title: 'Enter Sandman', artist: 'Metallica' },
        { title: 'Nothing Else Matters', artist: 'Metallica' },
        { title: 'Purple Rain', artist: 'Prince' },
        { title: 'Tennessee Whiskey', artist: 'Chris Stapleton' },
        { title: 'Before He Cheats', artist: 'Carrie Underwood' },
        { title: 'Take My Breath Away', artist: 'Berlin' }
    ];

    const top100Songs = useMemo(() => {
        const arts = Object.values(sampleArt);
        return top100Seed.map((s, idx) => {
            const artKey = `${s.title}__${s.artist}`;
            return { ...s, artKey, art: top100Art[artKey] || arts[idx % arts.length] };
        });
    }, [top100Art]);
    const fetchTop100Art = async (song) => {
        const artKey = song.artKey || `${song.title}__${song.artist}`;
        if (top100Art[artKey] || top100ArtLoading[artKey]) return top100Art[artKey];
        if (Date.now() < itunesBackoffUntil) return null;
        setTop100ArtLoading(prev => ({ ...prev, [artKey]: true }));
        try {
            const term = encodeURIComponent(`${song.title} ${song.artist}`);
            const data = await callFunction('itunesSearch', { term: decodeURIComponent(term), limit: 1 });
            const art = data?.results?.[0]?.artworkUrl100;
            if (art) {
                const hiRes = art.replace('100x100', '600x600');
                setTop100Art(prev => ({ ...prev, [artKey]: hiRes }));
                return hiRes;
            }
        } catch (e) {
            console.error(e);
            const msg = `${e?.message || ''}`.toLowerCase();
            if (msg.includes('rate limit') || msg.includes('resource-exhausted') || msg.includes('429')) {
                itunesBackoffUntil = Date.now() + 15000;
            }
        } finally {
            setTop100ArtLoading(prev => ({ ...prev, [artKey]: false }));
        }
        return null;
    };
    const sampleArtPool = Object.values(sampleArt);
    const hashString = (value) => {
        let hash = 0;
        for (let i = 0; i < value.length; i += 1) {
            hash = ((hash * 31) + value.charCodeAt(i)) >>> 0;
        }
        return hash;
    };
    const resolveBrowseArt = (song, idx) => {
        const artKey = `${song.title}__${song.artist}`;
        if (top100Art[artKey]) return top100Art[artKey];
        const base = hashString(artKey) + (idx * 7);
        return sampleArtPool[base % sampleArtPool.length];
    };
    const queueBrowseSong = async (song, singerOverride) => {
        if (!song?.title) return;
        const art = await fetchTop100Art(song);
        const songRecord = await ensureSong({
            title: song.title,
            artist: song.artist || 'Unknown',
            artworkUrl: art || song.art || '',
            verifyMeta: art || song.art ? {} : false,
            verifiedBy: hostName || 'host'
        });
        const songId = songRecord?.songId || buildSongKey(song.title, song.artist || 'Unknown');
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
            roomCode,
            songId,
            songTitle: song.title,
            artist: song.artist,
            singerName: singerOverride || room?.hostName || hostName || 'Host',
            mediaUrl: '',
            albumArtUrl: art || song.art || '',
            status: 'requested',
            timestamp: serverTimestamp(),
            priorityScore: Date.now(),
            emoji: EMOJI.mic,
            backingAudioOnly: false,
            audioOnly: false
        });
        toast('Added to queue');
    };
    const buildBrowseList = (list, listIdx) => {
        const songs = list.songs.map((song, idx) => ({
            ...song,
            artKey: `${song.title}__${song.artist}`,
            art: resolveBrowseArt(song, (listIdx * 20) + idx)
        }));
        return {
            ...list,
            samples: songs.slice(0, 3),
            songs
        };
    };
    const browseCategories = useMemo(
        () => BROWSE_CATEGORIES.map((list, idx) => buildBrowseList(list, idx)),
        [top100Art]
    );
    const topicHits = useMemo(
        () => TOPIC_HITS.map((list, idx) => buildBrowseList(list, idx + BROWSE_CATEGORIES.length)),
        [top100Art]
    );
    const exportToCSV = (data, filename) => { const csvContent = "data:text/csv;charset=utf-8," + [Object.keys(data[0]||{}).join(",")].concat(data.map(r => Object.values(r).join(","))).join("\n"); const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", filename); document.body.appendChild(link); link.click(); document.body.removeChild(link); };


    const queueYouTubeIndexItem = async (item, singerOverride) => {
        if (!item?.trackName) return;
        const songRecord = await ensureSong({
            title: item.trackName,
            artist: item.artistName || 'YouTube',
            artworkUrl: item.artworkUrl100 || '',
            verifyMeta: item.artworkUrl100 ? {} : false,
            verifiedBy: hostName || 'host'
        });
        const songId = songRecord?.songId || buildSongKey(item.trackName, item.artistName || 'YouTube');
        const trackRecord = await ensureTrack({
            songId,
            source: 'youtube',
            mediaUrl: item.url,
            duration: null,
            audioOnly: false,
            backingOnly: false,
            addedBy: hostName || 'Host'
        });
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
            roomCode,
            songId,
            trackId: trackRecord?.trackId || null,
            trackSource: 'youtube',
            songTitle: item.trackName,
            artist: item.artistName || 'YouTube',
            singerName: singerOverride || room?.hostName || hostName || 'Host',
            mediaUrl: item.url,
            albumArtUrl: item.artworkUrl100 || '',
            status: 'requested',
            timestamp: serverTimestamp(),
            priorityScore: Date.now(),
            emoji: EMOJI.mic,
            backingAudioOnly: false,
            audioOnly: false
        });
        toast('Added to queue');
    };

    const resolveCatalogueSinger = () => {
        if (catalogueUserId) {
            const matched = users.find(u => u.id?.split('_')[1] === catalogueUserId || u.uid === catalogueUserId);
            return matched?.name || catalogueName.trim();
        }
        return catalogueName.trim();
    };

    const queueBrowseSongFromCatalog = (song) => {
        if (!catalogueOnly) {
            queueBrowseSong(song);
            return;
        }
        setCataloguePendingSong(song);
        setCatalogueUserId('');
        setCatalogueName('');
        setShowCataloguePrompt(true);
    };

    const queueYouTubeFromCatalog = (item) => {
        if (!catalogueOnly) {
            queueYouTubeIndexItem(item);
            return;
        }
        setCataloguePendingSong({ __yt: true, item });
        setCatalogueUserId('');
        setCatalogueName('');
        setShowCataloguePrompt(true);
    };
    const handleCatalogueResultClick = (r) => {
        if (r.source === 'local') {
            addLocalItemToQueue(r);
        } else if (r.source === 'youtube') {
            queueYouTubeFromCatalog(r);
        } else {
            queueBrowseSongFromCatalog({
                title: r.trackName,
                artist: r.artistName,
                art: r.artworkUrl100 ? r.artworkUrl100.replace('100x100', '600x600') : ''
            });
        }
        setCatalogueResults([]);
        setCatalogueSearchQ('');
    };

    const browsePanel = (
                    <div className="flex flex-col h-full gap-6 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Browse</div>
                                <div className="text-2xl font-bold text-white">Karaoke Catalog</div>
                            </div>
                            <div className="text-sm text-zinc-500">Drag to queue from Stage</div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {browseCategories.map((c) => (
                                <div
                                    key={c.title}
                                    onClick={() => { setActiveBrowseList(c); }}
                                    className="relative overflow-hidden rounded-2xl border border-cyan-500/10 hover:border-cyan-500/30 transition-colors text-left cursor-pointer h-40"
                                >
                                    {c.samples?.[0]?.art && (
                                        <img src={c.samples[0].art} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black/90"></div>
                                    <div className="relative z-10 p-4 flex flex-col h-full justify-end">
                                        <div className="text-sm font-bold text-cyan-300">{c.title}</div>
                                        <div className="text-sm text-zinc-400 mt-1">{c.subtitle}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="text-xl font-bold text-white">Topic Hits</div>
                                <div className="text-sm text-zinc-500">Fast browse lists</div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {topicHits.map((hit) => (
                                    <div
                                        key={hit.title}
                                        onClick={() => { setActiveBrowseList(hit); }}
                                        className="relative overflow-hidden rounded-xl border border-zinc-800 hover:border-[#00C4D9]/40 transition-colors cursor-pointer h-32"
                                    >
                                        {hit.samples?.[0]?.art && (
                                            <img src={hit.samples[0].art} alt={hit.title} className="absolute inset-0 w-full h-full object-cover" />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black/90"></div>
                                        <div className="relative z-10 p-3 flex flex-col h-full justify-end">
                                            <div className="text-sm font-bold text-white">{hit.title}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {ytIndex.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-xl font-bold text-white">YouTube Index</div>
                                    <button onClick={() => setShowYtIndex(true)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} text-sm px-3 py-1`}>Open List</button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {ytIndex.slice(0, 6).map(item => (
                                        <div
                                            key={item.videoId}
                                            onClick={() => queueYouTubeFromCatalog(item)}
                                            className="bg-zinc-900/70 border border-zinc-800 rounded-xl px-3 py-3 text-left cursor-pointer hover:border-[#00C4D9]/40"
                                        >
                                            <div className="flex items-center gap-3">
                                                <img src={item.artworkUrl100} alt={item.trackName} className="w-12 h-12 rounded-lg object-cover" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-bold text-white truncate">{item.trackName}</div>
                                                    <div className="text-sm text-zinc-500 truncate">{item.artistName}</div>
                                                </div>
                                            </div>
                                            <div className="mt-3 text-sm uppercase tracking-widest text-zinc-500">Tap to queue</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {activeBrowseList && (
                            <div className="fixed inset-0 z-[85] bg-[#0b0b10] text-white flex flex-col">
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-zinc-800">
                                        <button onClick={() => setActiveBrowseList(null)} className="text-zinc-400 text-sm">&larr; Back</button>
                                        <div className="text-lg font-bold">{activeBrowseList.title}</div>
                                        <div className="text-sm text-zinc-500">{activeBrowseList.subtitle || 'Browse list'}</div>
                                    </div>
                                <div className="px-6 py-4">
                                </div>
                                <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {activeBrowseList.songs.map((song, idx) => (
                                                <div
                                                    key={`${song.title}-${song.artist}`}
                                                    className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 hover:border-[#00C4D9]/40"
                                                >
                                                    <div className="text-sm text-zinc-500 font-mono w-6 text-center">{idx + 1}</div>
                                                    <div className="relative">
                                                        <img src={song.art} alt={song.title} className="w-12 h-12 rounded-lg object-cover" />
                                                        {top100ArtLoading[song.artKey] && (
                                                            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center text-sm text-zinc-200">Loading</div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-white truncate">{song.title}</div>
                                                        <div className="text-sm text-zinc-400 truncate">{song.artist}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => queueBrowseSongFromCatalog(song)}
                                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-[10px]`}
                                                    >
                                                        + Add to Queue
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className={`${STYLES.panel} p-4 border border-zinc-700`}>
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Top 100</div>
                                    <div className="text-xl font-bold text-white">Karaoke Favorites</div>
                                </div>
                                <button onClick={() => setShowTop100(true)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} text-sm px-3 py-1`}>Open List</button>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                {top100Songs.slice(0, 12).map((song) => (
                                    <div key={`${song.title}-${song.artist}`} onClick={() => setShowTop100(true)} className="relative rounded-lg overflow-hidden border border-zinc-800 cursor-pointer">
                                        <img src={song.art} alt={song.title} className="w-full aspect-square object-cover" />
                                        <div className="absolute inset-0 bg-black/45"></div>
                                    </div>
                                ))}
                            </div>
                            <div className="text-sm text-zinc-500 mt-3">Open the full Top 100 to queue faster.</div>
                        </div>
                        {showTop100 && (
                            <div className="fixed inset-0 z-[85] bg-[#0b0b10] text-white flex flex-col">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                                    <button onClick={() => setShowTop100(false)} className="text-zinc-400 text-sm">&larr; Back</button>
                                    <div className="text-lg font-bold">Top 100 Karaoke</div>
                                    <div className="text-sm text-zinc-500">Full list</div>
                                </div>
                                <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {top100Songs.map((song, idx) => (
                                                <div
                                                    key={`${song.title}-${song.artist}`}
                                                    className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 rounded-xl p-3 hover:border-[#00C4D9]/40"
                                                >
                                                    <div className="text-sm text-zinc-500 font-mono w-6 text-center">{idx + 1}</div>
                                                    <div className="relative">
                                                        <img src={song.art} alt={song.title} className="w-12 h-12 rounded-lg object-cover" />
                                                        {top100ArtLoading[song.artKey] && (
                                                            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center text-sm text-zinc-200">Loading</div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-white truncate">{song.title}</div>
                                                        <div className="text-sm text-zinc-400 truncate">{song.artist}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => queueBrowseSongFromCatalog(song)}
                                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-[10px]`}
                                                    >
                                                        + Add to Queue
                                                    </button>
                                                </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
    );

    if(view === 'landing') return ( 
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center relative z-10"> 
                <div className="bg-zinc-900/80 p-8 rounded-3xl border border-zinc-700 backdrop-blur-md max-w-lg w-full shadow-2xl relative z-20"> 
                <img src="https://beauross.com/wp-content/uploads/bross-entertainment-chrome.png" className="w-3/4 mx-auto mb-4 drop-shadow-xl"/> 
                <h1 className="text-4xl font-bebas mb-6 text-white tracking-widest">HOST PORTAL</h1> 
                <button
                    onClick={createRoom}
                    disabled={!uid}
                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} w-full py-4 text-xl mb-4 ${!uid ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {uid ? 'START NEW ROOM' : 'CONNECTING...'}
                </button> 
                {!uid && authError && (
                    <div className="mb-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                        Auth failed: {authError.code || authError.message || 'Unknown error'}
                        {retryAuth && (
                            <button onClick={retryAuth} className="ml-2 underline text-red-200">Retry</button>
                        )}
                    </div>
                )}
                <div className="flex gap-2 justify-center"> 
                    <input value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())} placeholder="CODE" className={`${STYLES.input} text-center text-lg font-mono w-full`} /> 
                    <button onClick={()=>roomCode && setView('panel')} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-6`}>Join</button> 
                </div> 
                <div className="mt-6 text-xs text-zinc-500 font-mono tracking-widest">{VERSION}</div> 
            </div> 
        </div> 
    );
    if (catalogueOnly) return (
            <div className="min-h-screen bg-zinc-950 text-white font-saira p-6 flex flex-col">
            <div className="max-w-6xl mx-auto w-full flex flex-col min-h-0 flex-1">
                <div className="flex items-center justify-between gap-6 mb-6">
                    <div>
                        <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Catalogue</div>
                        <div className="text-2xl font-bold text-white">Browse songs</div>
                    </div>
                        <div className="text-xs text-zinc-500 font-mono tracking-widest">ROOM {roomCode}</div>
                </div>
                <div className="mb-6 relative">
                    <input
                        value={catalogueSearchQ}
                        onChange={e=>setCatalogueSearchQ(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white outline-none"
                        placeholder="Search Local + YouTube + Apple Music..."
                    />
                    {(catalogueResults.length > 0 || catalogueSearchQ.length >= 3) && (
                        <div className="absolute top-full left-0 w-full bg-zinc-900 border border-zinc-700 z-50 shadow-2xl">
                            <div className="max-h-72 overflow-y-auto">
                                {catalogueResults.length > 0 ? catalogueResults.map((r, idx) => (
                                    <div key={idx} onClick={()=>handleCatalogueResultClick(r)} className="p-3 hover:bg-zinc-800 text-sm cursor-pointer flex gap-3 items-center border-b border-white/5">
                                        <div className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded">
                                            {r.source === 'local' ? (
                                                <i className="fa-solid fa-hard-drive text-[#00C4D9]"></i>
                                            ) : r.source === 'youtube' ? (
                                                <div className="relative">
                                                    <img src={r.artworkUrl100} className="w-10 h-10 rounded" />
                                                    <i className="fa-brands fa-youtube text-red-500 absolute -bottom-1 -right-1 text-[10px] bg-black/70 rounded-full p-[2px]"></i>
                                                </div>
                                            ) : (
                                                <img src={r.artworkUrl100} className="w-10 h-10 rounded"/>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-white truncate">{r.trackName}</div>
                                            <div className="text-sm text-zinc-400 truncate">{r.artistName}</div>
                                        </div>
                                        <div className="text-sm font-bold text-cyan-300">+ Queue</div>
                                    </div>
                                )) : (
                                    <div className="text-center text-zinc-500 text-base py-4">No results yet.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {browsePanel}
                </div>
                {showCataloguePrompt && (
                    <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4">
                        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                            <div className="text-lg font-bold text-white mb-2">Add your name</div>
                            <div className="text-sm text-zinc-400 mb-4">We'll use it for the song you're adding.</div>
                            <input
                                value={catalogueName}
                                onChange={e => setCatalogueName(e.target.value)}
                                className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white outline-none w-full"
                                placeholder="Your name"
                            />
                            {users.length > 0 && (
                                <div className="mt-3">
                                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-500 mb-2">Or pick from lobby</div>
                                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                                        {users.map(u => (
                                            <button
                                                key={u.id}
                                                onClick={() => { setCatalogueUserId(u.id?.split('_')[1] || u.uid || u.id); setCatalogueName(u.name || ''); }}
                                                className={`px-2 py-1 rounded-lg text-sm border ${catalogueUserId && (catalogueUserId === (u.id?.split('_')[1] || u.uid || u.id)) ? 'bg-[#00C4D9]/20 text-[#00C4D9] border-[#00C4D9]/40' : 'bg-zinc-900 text-zinc-300 border-zinc-700'}`}
                                            >
                                                {u.avatar ? `${u.avatar} ` : ''}{u.name || 'Guest'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => { setShowCataloguePrompt(false); setCataloguePendingSong(null); setCatalogueUserId(''); setCatalogueName(''); }}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} flex-1`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const name = resolveCatalogueSinger();
                                        if (!name) return;
                                        if (cataloguePendingSong) {
                                            if (cataloguePendingSong.__yt) {
                                                queueYouTubeIndexItem(cataloguePendingSong.item, name);
                                            } else {
                                                queueBrowseSong(cataloguePendingSong, name);
                                            }
                                        }
                                        setCataloguePendingSong(null);
                                        setShowCataloguePrompt(false);
                                        setCatalogueUserId('');
                                        setCatalogueName('');
                                    }}
                                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} flex-1`}
                                >
                                    Add to Queue
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
            <div className="host-app min-h-screen md:h-screen flex flex-col relative bg-zinc-950 text-white font-saira overflow-y-auto md:overflow-hidden">
                {/* Header */}
            <div className="bg-zinc-900 px-5 py-3 flex flex-col gap-2 shadow-2xl shrink-0 relative z-20 border-b border-zinc-800">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between w-full">
                        <div className="flex items-center gap-3 md:gap-4">
                        <img
                            src={room?.logoUrl || ASSETS.logo}
                            className="h-16 md:h-28 object-contain rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10 bg-black/40 p-1"
                            alt="Beaurocks Karaoke"
                        />
                        <div className="text-[16px] md:text-[22px] font-mono font-bold text-[#00C4D9] bg-black/40 px-2.5 py-1 rounded-lg border border-[#00C4D9]/30">{roomCode}</div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowLaunchMenu(prev => !prev)}
                                    className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 text-sm`}
                                >
                                    <i className="fa-solid fa-rocket"></i>
                                </button>
                                {showLaunchMenu && (
                                    <div className="absolute left-0 top-full mt-2 w-56 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50">
                                        <a
                                            href={`${appBase}?room=${roomCode}&mode=tv`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => setShowLaunchMenu(false)}
                                            className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900 rounded-t-xl"
                                        >
                                            <i className="fa-solid fa-tv mr-2 text-cyan-300"></i> Launch TV
                                        </a>
                                        <a
                                            href={`${appBase}?room=${roomCode}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => setShowLaunchMenu(false)}
                                            className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                                        >
                                            <i className="fa-solid fa-mobile-screen-button mr-2 text-pink-300"></i> Launch Mobile
                                        </a>
                                        <a
                                            href={`${appBase}?room=${roomCode}&mode=host&tab=browse&catalogue=1`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={() => setShowLaunchMenu(false)}
                                            className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900"
                                        >
                                            <i className="fa-solid fa-book-open mr-2 text-yellow-300"></i> Launch Catalogue
                                        </a>
                                        <div className="px-4 py-2 text-sm uppercase tracking-[0.3em] text-zinc-500 border-t border-zinc-800">
                                            Game Displays
                                        </div>
                                        {GAMES_META.map((game, idx, arr) => (
                                            <a
                                                key={game.id}
                                                href={`${appBase}?room=${roomCode}&mode=host&game=${game.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => setShowLaunchMenu(false)}
                                                className={`block w-full text-left px-4 py-2 text-sm text-white hover:bg-zinc-900 ${idx === arr.length - 1 ? 'rounded-b-xl' : ''}`}
                                            >
                                                <i className="fa-solid fa-gamepad mr-2 text-cyan-300"></i>
                                                {game.name}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 md:gap-4 justify-between md:justify-end">
                            {/* Active Mode Indicator */}
                            {room?.activeMode && room.activeMode !== 'karaoke' && (
                                <div className="bg-red-600 px-3 py-1 rounded text-xs md:text-sm font-bold animate-pulse">LIVE: {room.activeMode.toUpperCase()}</div>
                            )}
                            <div className="hidden md:flex items-center gap-2">
                                {[
                                    { key: 'stage', label: 'Stage' },
                                    { key: 'games', label: 'Games' },
                                    { key: 'lobby', label: 'Lobby' }
                                ].map(t => (
                                    <button
                                        key={t.key}
                                        onClick={() => setTab(t.key)}
                                        className={`px-5 py-2 text-lg font-black uppercase tracking-[0.3em] rounded-2xl border-b-2 transition-all ${tab === t.key ? 'text-[#00C4D9] border-[#00C4D9] bg-black/40' : 'text-zinc-400 border-transparent bg-zinc-900/40 hover:text-white'}`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                            <button onClick={()=>{ setShowSettings(true); setSettingsTab('general'); }} className="text-zinc-500 hover:text-white"><i className="fa-solid fa-gear text-lg md:text-xl"></i></button>
                            <div className="relative">
                                <button
                                    onClick={() => setShowNavMenu(prev => !prev)}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-sm md:hidden`}
                                >
                                    <i className="fa-solid fa-bars"></i>
                                </button>
                                {showNavMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-44 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50">
                                        {[
                                            { key: 'stage', label: 'Stage' },
                                            { key: 'games', label: 'Games' },
                                            { key: 'lobby', label: 'Lobby' }
                                        ].map(t => (
                                            <button
                                                key={t.key}
                                                onClick={() => { setTab(t.key); setShowNavMenu(false); }}
                                                className={`w-full text-left px-4 py-2 text-sm font-bold uppercase tracking-widest ${tab === t.key ? 'text-[#00C4D9]' : 'text-zinc-300'} hover:bg-zinc-900 ${t.key === 'stage' ? 'rounded-t-xl' : ''} ${t.key === 'lobby' ? 'rounded-b-xl' : ''}`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                <div className="w-full">
                    <button
                        onClick={() => setAudioPanelOpen(v => !v)}
                        className={`w-full flex items-center justify-between ${STYLES.header}`}
                    >
                        <span className="flex items-center gap-2">
                            <i className="fa-solid fa-sliders"></i>
                            Audio + Mix
                        </span>
                        <i className={`fa-solid fa-chevron-down transition-transform ${audioPanelOpen ? 'rotate-180' : ''}`}></i>
                    </button>
                    <div className={audioPanelOpen ? 'block' : 'hidden'}>
                        <div className="w-full bg-gradient-to-r from-[#00E5FF]/12 via-[#2BD4C8]/10 to-[#EC4899]/12 border border-white/10 rounded-2xl p-3 overflow-hidden">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3 bg-zinc-900/80 px-3 py-3 rounded-xl border border-white/10 h-14">
                                <div className="text-xs uppercase tracking-widest text-zinc-400">Stage Audio</div>
                                <SmallWaveform level={stageMeterLevel} className="h-10 w-20" color="rgba(236,72,153,0.9)" />
                                {!stageMicReady && (
                                    <button
                                        onClick={requestStageMic}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 py-1 text-xs min-w-[30px]`}
                                        title={stageMicError ? 'Enable mic for stage meter' : 'Enable stage meter'}
                                    >
                                        <i className={`fa-solid ${stageMicError ? 'fa-microphone-slash' : 'fa-microphone'} w-4 text-center`}></i>
                                    </button>
                                )}
                                <button onClick={toggleSongMute} className={`${STYLES.btnStd} ${(room?.videoVolume ?? 100) === 0 ? STYLES.btnHighlight : STYLES.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}>
                                    <i className={`fa-solid ${(room?.videoVolume ?? 100) === 0 ? 'fa-volume-xmark' : 'fa-volume-high'} w-4 text-center`}></i>
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={room?.videoVolume ?? 100}
                                    onChange={e=>updateRoom({ videoVolume: parseInt(e.target.value, 10) })}
                                    className="w-32 h-3 bg-zinc-800 accent-pink-500 rounded-lg appearance-none cursor-pointer stage-volume-slider"
                                    style={{ background: `linear-gradient(90deg, #00C4D9 ${room?.videoVolume ?? 100}%, #27272a ${room?.videoVolume ?? 100}%)` }}
                                />
                            </div>
                            <div className="flex items-center gap-3 bg-zinc-900/80 px-3 py-3 rounded-xl border border-white/10 h-14">
                                <div className="text-xs uppercase tracking-widest text-zinc-400">BG</div>
                                <SmallWaveform level={bgAnalyserRef.current ? bgMeterLevel : Math.round(bgVolume * 100)} className="h-10 w-20" color="rgba(0,196,217,0.95)" />
                                <button onClick={toggleBgMusic} className={`${STYLES.btnStd} ${playingBg ? STYLES.btnHighlight : STYLES.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`} title="Toggle BG music">
                                    <i className={`fa-solid ${playingBg ? 'fa-pause' : 'fa-play'} w-4 text-center`}></i>
                                </button>
                                <button onClick={skipBg} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`} title="Skip BG track">
                                    <i className="fa-solid fa-forward-step w-4 text-center"></i>
                                </button>
                                <button
                                    onClick={async () => {
                                        const next = !autoBgMusic;
                                        setAutoBgMusic(next);
                                        await updateRoom({ autoBgMusic: next });
                                        if (next && !playingBg) setBgMusicState(true);
                                    }}
                                    className={`${STYLES.btnStd} ${autoBgMusic ? STYLES.btnHighlight : STYLES.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}
                                    title="Keep BG music rolling between songs"
                                >
                                    <i className="fa-solid fa-compact-disc w-4 text-center"></i>
                                </button>
                                <button onClick={toggleBgMute} className={`${STYLES.btnStd} ${bgVolume === 0 ? STYLES.btnHighlight : STYLES.btnNeutral} px-2 py-1 text-xs min-w-[30px] active:scale-100`}>
                                    <i className={`fa-solid ${bgVolume === 0 ? 'fa-volume-xmark' : 'fa-volume-high'} w-4 text-center`}></i>
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={Math.round(bgVolume * 100)}
                                    onChange={e=>{
                                        const val = parseInt(e.target.value, 10) / 100;
                                        setBgVolume(val);
                                        updateRoom({ bgMusicVolume: val });
                                    }}
                                    className="w-32 h-3 bg-zinc-800 accent-cyan-500 rounded-lg appearance-none cursor-pointer bg-volume-slider"
                                    style={{ background: `linear-gradient(90deg, #EC4899 ${Math.round(bgVolume * 100)}%, #27272a ${Math.round(bgVolume * 100)}%)` }}
                                />
                                <div className="text-sm text-zinc-400 truncate max-w-[120px]">
                                    <i className="fa-solid fa-music mr-1"></i>
                                    {BG_TRACKS[currentTrackIdx]?.name || 'BG Track'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-zinc-900/80 px-3 py-3 rounded-xl border border-white/10 h-14 mt-4">
                            <div className="text-sm uppercase tracking-widest text-zinc-400">Mix</div>
                            <div className="flex flex-col gap-3 flex-1">
                                <div className="relative">
                                    <span className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-5 bg-white/40 rounded-full"></span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="1"
                                        value={mixFader}
                                        onChange={e=>handleMixFaderChange(parseInt(e.target.value, 10))}
                                        className="mix-slider w-full relative z-10"
                                        style={{ '--mix-split': `${mixFader}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-sm text-zinc-400">
                                    <span className="text-[#00C4D9]">BG Music {mixFader}%</span>
                                    <span className="text-pink-300">Stage Audio {100 - mixFader}%</span>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-6 overflow-y-auto md:overflow-hidden">
                {tab === 'stage' && (
                        <QueueTab
                            songs={songs}
                            room={room}
                            roomCode={roomCode}
                            appBase={appBase}
                            updateRoom={updateRoom}
                        toggleBgMusic={toggleBgMusic}
                        playingBg={playingBg}
                        bgVolume={bgVolume}
                        setBgVolume={setBgVolume}
                        currentTrackIdx={currentTrackIdx}
                        skipBg={skipBg}
                        silenceAll={silenceAll}
                        logActivity={logActivity}
                        localLibrary={localLibrary}
                        playSfxSafe={playSfxSafe}
                        toggleHowToPlay={toggleHowToPlay}
                        startStormSequence={startStormSequence}
                        stopStormSequence={stopStormSequence}
                        startBeatDrop={startBeatDrop}
                        users={users}
                        tipUserId={tipUserId}
                        setTipUserId={setTipUserId}
                        tipAmount={tipAmount}
                        setTipAmount={setTipAmount}
                        tipPointRate={tipPointRate}
                        dropBonus={dropBonus}
                        giftPointsToUser={giftPointsToUser}
                        tipPointRate={tipPointRate}
                        setTipPointRate={setTipPointRate}
                        awardTipPoints={awardTipPoints}
                        marqueeEnabled={marqueeEnabled}
                        setMarqueeEnabled={setMarqueeEnabled}
                        marqueeDurationSec={marqueeDurationSec}
                        setMarqueeDurationSec={setMarqueeDurationSec}
                        marqueeIntervalSec={marqueeIntervalSec}
                        setMarqueeIntervalSec={setMarqueeIntervalSec}
                        saveMarqueeSettings={saveMarqueeSettings}
                        marqueeItems={marqueeItems}
                        updateMarqueeItems={updateMarqueeItems}
                        marqueeShowMode={marqueeShowMode}
                        setMarqueeShowMode={setMarqueeShowMode}
                        chatShowOnTv={chatShowOnTv}
                        setChatShowOnTv={setChatShowOnTv}
                        chatUnread={chatUnread}
                        dmUnread={dmUnread}
                        chatEnabled={chatEnabled}
                        setChatEnabled={setChatEnabled}
                        chatSlowModeSec={chatSlowModeSec}
                        setChatSlowModeSec={setChatSlowModeSec}
                        chatAudienceMode={chatAudienceMode}
                        setChatAudienceMode={setChatAudienceMode}
                        chatDraft={chatDraft}
                        setChatDraft={setChatDraft}
                        chatMessages={chatMessages}
                        sendHostChat={sendHostChat}
                        sendHostDmMessage={sendHostDmMessage}
                        sendHostChatMessage={sendHostChatMessage}
                        dmTargetUid={dmTargetUid}
                        setDmTargetUid={setDmTargetUid}
                        dmDraft={dmDraft}
                        setDmDraft={setDmDraft}
                        pinnedChatIds={pinnedChatIds}
                        setPinnedChatIds={setPinnedChatIds}
                        chatViewMode={chatViewMode}
                        handleChatViewMode={handleChatViewMode}
                        sfxMuted={sfxMuted}
                        setSfxMuted={setSfxMuted}
                        sfxLevel={sfxLevel}
                        sfxVolume={sfxVolume}
                        setSfxVolume={setSfxVolume}
                        uid={uid}
                            searchSources={searchSources}
                            setSearchSources={setSearchSources}
                            ytIndex={ytIndex}
                            setYtIndex={setYtIndex}
                            persistYtIndex={persistYtIndex}
                        autoDj={autoDj}
                        setAutoDj={setAutoDj}
                        autoBgMusic={autoBgMusic}
                        setAutoBgMusic={setAutoBgMusic}
                        readyCheckDurationSec={readyCheckDurationSec}
                        readyCheckRewardPoints={readyCheckRewardPoints}
                    startReadyCheck={startReadyCheck}
                        itunesBackoffRemaining={itunesBackoffRemaining}
                        appleMusicReady={appleMusicReady}
                        appleMusicAuthorized={appleMusicAuthorized}
                        appleMusicPlaying={appleMusicPlaying}
                        appleMusicStatus={appleMusicStatus}
                        playAppleMusicTrack={playAppleMusicTrack}
                        pauseAppleMusic={pauseAppleMusic}
                        resumeAppleMusic={resumeAppleMusic}
                        autoDjCountdown={autoDjCountdown}
                        hostName={hostName}
                        fetchTop100Art={fetchTop100Art}
                        connectAppleMusic={connectAppleMusic}
                        openChatSettings={openChatSettings}
                    />
                )}
                {tab === 'browse' && browsePanel}
                {tab === 'games' && (
                    <UnifiedGameLauncher
                        room={room}
                        roomCode={roomCode}
                        updateRoom={updateRoom}
                        users={users}
                        logActivity={logActivity}
                        songs={songs}
                        activities={activities}
                        generateAIContent={generateAIContent}
                        callFunction={callFunction}
                        useToast={useToast}
                        autoOpenGameId={autoOpenGameId}
                    />
                )}
                {/* Lobby Tab */}
                {tab === 'lobby' && (
                    <div className="flex flex-col h-full gap-4">
                        <div className="flex flex-wrap bg-zinc-900 p-1 rounded-xl w-full sm:w-fit gap-1">
                            {['users', 'history', 'vip', 'tips', 'photos', 'activity'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setLobbyTab(t)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-all ${lobbyTab === t ? 'bg-[#00C4D9] text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                        {lobbyTab === 'users' && (
                            <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4">
                                        <div className="text-sm uppercase tracking-widest text-zinc-500">Lobby guests</div>
                                        <div className="text-3xl font-bold text-white mt-2">{users.length}</div>
                                        <div className="text-sm text-zinc-500 mt-1">Active: {lobbyActiveCount}</div>
                                    </div>
                                    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4">
                                        <div className="text-sm uppercase tracking-widest text-zinc-500">VIPs</div>
                                        <div className="text-3xl font-bold text-yellow-300 mt-2">{lobbyVipCount}</div>
                                        <div className="text-sm text-zinc-500 mt-1">Premium guests</div>
                                    </div>
                                    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4">
                                        <div className="text-sm uppercase tracking-widest text-zinc-500">Points in play</div>
                                        <div className="text-3xl font-bold text-cyan-300 mt-2">{lobbyTotalPoints}</div>
                                        <div className="text-sm text-zinc-500 mt-1">Room total</div>
                                    </div>
                                    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4">
                                        <div className="text-sm uppercase tracking-widest text-zinc-500">Emojis sent</div>
                                        <div className="text-3xl font-bold text-pink-400 mt-2">{lobbyTotalEmojis}</div>
                                        <div className="text-sm text-zinc-500 mt-1">Session total</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {users.map(u => {
                                        const isSpotlight = room?.spotlightUser?.id === u.id.split('_')[1];
                                        const stats = userStats.get(u.uid || u.id.split('_')[1] || u.name) || {};
                                        const isVip = u.isVip || (u.vipLevel || 0) > 0;
                                        const lastActiveMs = u.lastActiveAt?.seconds ? u.lastActiveAt.seconds * 1000 : u.lastActiveAt;
                                        return (
                                            <div key={u.id} className={`relative overflow-hidden bg-zinc-900/80 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 group ${isSpotlight ? 'border-yellow-500/80 shadow-[0_0_25px_rgba(234,179,8,0.2)]' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-3xl">
                                                        {u.avatar}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-bold truncate text-lg text-white">{u.name}</div>
                                                        <div className="text-sm text-zinc-500">{u.points} PTS</div>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-zinc-500">
                                                    {stats.performances || 0} perf | {stats.totalEmojis || 0} emojis | {stats.loudest || 0} dB
                                                </div>
                                                {lastActiveMs && <div className="text-sm text-zinc-500">Last active {new Date(lastActiveMs).toLocaleTimeString()}</div>}
                                                {u.lastSeen && <div className="text-sm text-zinc-600">Last seen {new Date(u.lastSeen.seconds ? u.lastSeen.seconds * 1000 : u.lastSeen).toLocaleTimeString()}</div>}
                                                {u.phone && <div className="text-sm text-zinc-600">Phone {u.phone}</div>}
                                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={()=>sendUserMessage(u.id.split('_')[1], isSpotlight ? null : 'SPOTLIGHT')} className={`${STYLES.btnStd} ${isSpotlight ? STYLES.btnNeutral : STYLES.btnSecondary} px-3 py-1 text-xs`}>
                                                        {isSpotlight ? 'UNSPOTLIGHT' : 'SPOTLIGHT'}
                                                    </button>
                                                    <button onClick={()=>kickUser(u.id.split('_')[1])} className={`${STYLES.btnStd} ${STYLES.btnDanger} px-3 py-1 text-xs`}>Kick</button>
                                                </div>
                                                {isSpotlight && <div className="absolute top-2 right-2 text-yellow-400 text-sm animate-pulse">LIVE</div>}
                                                {isVip && (
                                                    <div className="absolute bottom-2 right-2 text-sm text-yellow-200 font-bold bg-yellow-900/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <i className="fa-solid fa-crown text-xs"></i> VIP
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {lobbyTab === 'history' && (
                            <div className="flex flex-col h-full">
                                <div className="flex justify-end mb-2">
                                    <button onClick={()=>exportToCSV(history, 'history.csv')} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-sm`}>Export CSV</button>
                                </div>
                                <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                    {history.map(s => (
                                        <div key={s.id} className="bg-zinc-900 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border border-zinc-800 hover:border-zinc-700 transition-colors">
                                            <div className="min-w-0 flex-1">
                                                <span className="font-bold text-lg">{s.songTitle}</span> <span className="text-zinc-500">-</span> <span className="text-zinc-300">{s.singerName}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-3 text-sm text-zinc-500 items-center">
                                                <span>{new Date(s.timestamp?.seconds*1000).toLocaleTimeString()}</span>
                                                <span className="text-yellow-400 font-bold">Total: {(s.hypeScore||0)+(s.applauseScore||0)+(s.hostBonus||0)}</span>
                                                <button onClick={()=>openModifyScore(s)} className="text-blue-400 hover:text-blue-300 font-bold">Edit</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {lobbyTab === 'vip' && (
                            <div className="flex flex-col h-full">
                                <div className="flex justify-end mb-2">
                                    <button onClick={()=>exportToCSV(contacts, 'vip_contacts.csv')} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-sm`}>Export CSV</button>
                                </div>
                                <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                                    {contacts.map((c,i) => {
                                        const u = users.find(user => user.name === c.name);
                                        const uid = u?.id.split('_')[1];
                                        const isSpotlight = uid && room?.spotlightUser?.id === uid;
                                        
                                        return (
                                            <div key={i} className="bg-zinc-900 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 border border-yellow-500/20 shadow-lg">
                                                <div className="font-bold text-lg min-w-0">{c.name}</div>
                                                <div className="text-sm text-zinc-400 min-w-0 break-words">{c.email}</div>
                                                {uid ? (
                                                    <button onClick={()=>sendUserMessage(uid, isSpotlight ? null : 'VIP Spotlight!')} className={`${STYLES.btnStd} ${isSpotlight ? STYLES.btnStandardBrandHover : STYLES.btnSecondary} px-3 py-1 text-sm`}>
                                                        {isSpotlight ? 'UNSPOTLIGHT' : 'SPOTLIGHT VIP'}
                                                    </button>
                                                ) : <span className="text-sm text-zinc-600 italic">Offline</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {lobbyTab === 'tips' && (
                            <div className="flex flex-col h-full">
                                <div className={`${STYLES.panel} p-4 border-white/10`}>
                                    <div className="text-sm text-zinc-400 mb-3 font-bold uppercase tracking-wider">Tip to Points</div>
                                    <div className="space-y-2">
                                        <select value={tipUserId} onChange={e=>setTipUserId(e.target.value)} className={`${STYLES.input} w-full`}>
                                            <option value="">Select guest</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id.split('_')[1] || u.uid || ''}>{u.name}</option>
                                            ))}
                                        </select>
                                        <div className="flex items-center gap-2">
                                            <input value={tipAmount} onChange={e=>setTipAmount(e.target.value)} className={`${STYLES.input} w-full`} placeholder="$ Amount" />
                                            <button onClick={awardTipPoints} className={`${STYLES.btnStd} ${STYLES.btnSecondary}`}>Award</button>
                                        </div>
                                        <div className="text-sm text-zinc-500">Rate: {tipPointRate || 100} pts per $1</div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {lobbyTab === 'photos' && (
                            <GalleryTab roomCode={roomCode} room={room} updateRoom={updateRoom} />
                        )}
                        {lobbyTab === 'activity' && (
                            <div className="flex flex-col h-full">
                                <div className="text-sm text-zinc-400 mb-2 font-bold uppercase tracking-wider border-b border-white/10 pb-2">Room Activity Log</div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                                    {activities.map((a, i) => (
                                        <div key={i} className="flex gap-3 items-center bg-zinc-900/50 p-2 rounded border border-white/5 text-base">
                                            <span className="text-xl">{a.icon}</span>
                                            <div>
                                                <span className="font-bold text-white mr-1">{a.user}</span>
                                                <span className="text-zinc-400">{a.text}</span>
                                                <div className="text-sm text-zinc-600 mt-0.5">{new Date(a.timestamp?.seconds*1000).toLocaleTimeString()}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {activities.length === 0 && <div className="text-center text-zinc-500 py-8 italic">No activity recorded yet</div>}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {modifyingScoreId && (
                <div className="fixed inset-0 z-[85] bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                        <div className="text-lg font-bold text-white mb-4">Edit Performance Score</div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm uppercase tracking-widest text-zinc-500">Hype</label>
                                <input value={scoreForm.hype} onChange={e=>setScoreForm({...scoreForm, hype:e.target.value})} className={STYLES.input} placeholder="Hype points" />
                            </div>
                            <div>
                                <label className="text-sm uppercase tracking-widest text-zinc-500">Applause</label>
                                <input value={scoreForm.applause} onChange={e=>setScoreForm({...scoreForm, applause:e.target.value})} className={STYLES.input} placeholder="Applause points" />
                            </div>
                            <div>
                                <label className="text-sm uppercase tracking-widest text-zinc-500">Bonus</label>
                                <input value={scoreForm.bonus} onChange={e=>setScoreForm({...scoreForm, bonus:e.target.value})} className={STYLES.input} placeholder="Bonus points" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={()=>setModifyingScoreId(null)} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>Cancel</button>
                            <button onClick={saveModifiedScore} className={`${STYLES.btnStd} ${STYLES.btnPrimary}`}>Save</button>
                        </div>
                    </div>
                </div>
            )}
            {showSettings && (
                <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-3xl p-6 shadow-2xl h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-lg font-bold text-white">Host Settings</div>
                            <button onClick={() => setShowSettings(false)} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>Close</button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-6">
                            {[
                                { key: 'general', label: 'General' },
                                { key: 'monetization', label: 'Monetization' },
                                { key: 'media', label: 'Media' },
                                { key: 'marquee', label: 'Marquee' },
                                { key: 'chat', label: 'Chat' },
                                { key: 'qa', label: 'Dev Tools' }
                            ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => {
                                    setSettingsTab(t.key);
                                    if (t.key === 'chat') {
                                        const newest = chatMessages[0]?.timestamp?.seconds ? chatMessages[0].timestamp.seconds * 1000 : 0;
                                        if (newest) chatLastSeenRef.current = newest;
                                        setChatUnread(false);
                                    }
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-all ${
                                    settingsTab === t.key ? 'bg-[#00C4D9] text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300 border border-zinc-700'
                                }`}
                            >
                                {t.label}
                                {t.key === 'chat' && (chatUnread || dmUnread) && <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-pink-400"></span>}
                            </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                        {settingsTab === 'general' && (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="text-sm uppercase tracking-widest text-zinc-400">Host identity</div>
                                <input value={hostName} onChange={e=>setHostName(e.target.value)} className={STYLES.input} placeholder="Host name" title="Shown on the TV and activity feed" />
                                <div className="host-form-helper">Name shown in the TV header and activity feed.</div>
                                <input value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} className={STYLES.input} placeholder="Logo URL (optional)" title="Paste a public logo URL" />
                                <div className="host-form-helper">Logo defaults to BROSS if empty. Square or wide works best.</div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-sm uppercase tracking-widest text-zinc-400">Tips</div>
                                <input value={tipSettings.link} onChange={e=>setTipSettings({...tipSettings, link:e.target.value})} className={STYLES.input} placeholder="Tip link URL" title="Venmo, Cash App, or other payment link" />
                                <div className="host-form-helper">Public link that opens when tips are shown.</div>
                                <input value={tipSettings.qr} onChange={e=>setTipSettings({...tipSettings, qr:e.target.value})} className={STYLES.input} placeholder="Tip QR image URL" title="Direct link to a QR image" />
                                <div className="host-form-helper">Shown on the TV Tip overlay.</div>
                            </div>
                        </div>
                        <div className="mt-6 space-y-2">
                            <div className="text-sm uppercase tracking-widest text-zinc-400">Queue settings</div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={queueLimitMode}
                                    onChange={e => setQueueLimitMode(e.target.value)}
                                    className={STYLES.input}
                                    title="Limit mode"
                                >
                                    <option value="none">No limits</option>
                                    <option value="per_night">Limit per night</option>
                                    <option value="per_hour">Limit per hour</option>
                                    <option value="soft">Soft limit (pending)</option>
                                </select>
                                <input
                                    value={queueLimitCount}
                                    onChange={e => setQueueLimitCount(e.target.value)}
                                    className={STYLES.input}
                                    placeholder="Limit count"
                                    title="Requests per time window"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={queueRotation}
                                    onChange={e => setQueueRotation(e.target.value)}
                                    className={STYLES.input}
                                    title="Queue rotation"
                                >
                                    <option value="round_robin">Round robin</option>
                                    <option value="first_come">First come</option>
                                </select>
                                <button
                                    onClick={() => setQueueFirstTimeBoost(prev => !prev)}
                                    className={`${STYLES.btnStd} ${queueFirstTimeBoost ? STYLES.btnInfo : STYLES.btnNeutral}`}
                                    title="Boost first-time singers in the queue"
                                >
                                    <i className="fa-solid fa-star"></i>
                                    {queueFirstTimeBoost ? 'First-time boost on' : 'First-time boost off'}
                                </button>
                            </div>
                              <div className="host-form-helper">Queue rules show in the singer app request screen.</div>
                          </div>
                          <div className="mt-6 space-y-2">
                              <div className="text-sm uppercase tracking-widest text-zinc-400">Scoring display</div>
                              <label className="flex items-center gap-2 text-sm text-zinc-300">
                                  <input
                                      type="checkbox"
                                      checked={showScoring}
                                      onChange={e => setShowScoring(e.target.checked)}
                                      className="accent-[#00C4D9]"
                                  />
                                  Show performance score on TV
                              </label>
                              <div className="host-form-helper">Turns the TV performance points counter on or off.</div>
                              <label className="flex items-center gap-2 text-sm text-zinc-300 mt-2">
                                  <input
                                      type="checkbox"
                                      checked={autoPlayMedia}
                                      onChange={async e => {
                                          const next = e.target.checked;
                                          setAutoPlayMedia(next);
                                          await updateRoom({ autoPlayMedia: next });
                                      }}
                                      className="accent-[#00C4D9]"
                                  />
                                  Auto-play media when a performance hits the stage
                              </label>
                              <div className="host-form-helper">Plays Apple Music, YouTube, and local/custom media automatically when the singer starts.</div>
                              <label className="flex items-center gap-2 text-sm text-zinc-300 mt-2">
                                  <input
                                      type="checkbox"
                                      checked={showFameLevel}
                                      onChange={e => setShowFameLevel(e.target.checked)}
                                      className="accent-[#00C4D9]"
                                  />
                                  Show Fame level on user cards
                              </label>
                              <div className="host-form-helper">Adds a level badge to lobby + leaderboard cards.</div>
                          </div>
                          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="text-sm uppercase tracking-widest text-zinc-400">Ready check</div>
                                <input value={readyCheckDurationSec} onChange={e=>setReadyCheckDurationSec(e.target.value)} className={STYLES.input} placeholder="Duration (sec)" title="How long the Ready Check runs" />
                                <div className="host-form-helper">Countdown length for Ready Check.</div>
                                <input value={readyCheckRewardPoints} onChange={e=>setReadyCheckRewardPoints(e.target.value)} className={STYLES.input} placeholder="Reward points" title="Points awarded for tapping READY" />
                                <div className="host-form-helper">Points awarded when someone taps READY.</div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-sm uppercase tracking-widest text-zinc-400">Auto BG fade</div>
                                <input value={autoBgFadeOutMs} onChange={e=>setAutoBgFadeOutMs(e.target.value)} className={STYLES.input} placeholder="Fade out (ms)" title="How fast BG fades out when a singer starts" />
                                <div className="host-form-helper">Time to fade BG down at song start.</div>
                                <input value={autoBgFadeInMs} onChange={e=>setAutoBgFadeInMs(e.target.value)} className={STYLES.input} placeholder="Fade in (ms)" title="How fast BG fades back in after a song" />
                                <div className="host-form-helper">Time to fade BG back up at song end.</div>
                                <input value={autoBgMixDuringSong} onChange={e=>setAutoBgMixDuringSong(e.target.value)} className={STYLES.input} placeholder="BG % during performance" title="How much BG remains during performances" />
                                <div className="host-form-helper">Lower = more stage audio during songs.</div>
                            </div>
                        </div>

                          <div className="mt-6 space-y-2">
                              <div className="text-sm uppercase tracking-widest text-zinc-400">Room tools</div>
                              <button
                                  onClick={clearRoomData}
                                  disabled={clearingRoom}
                                  className={`${STYLES.btnStd} ${STYLES.btnDanger} w-full`}
                              >
                                  {clearingRoom ? 'Clearing room...' : 'Clear Room Data'}
                              </button>
                              <div className="host-form-helper">Removes queue, reactions, users, and activity for this room.</div>
                              <button
                                  onClick={downloadRoomData}
                                  disabled={exportingRoom}
                                  className={`${STYLES.btnStd} ${STYLES.btnSecondary} w-full`}
                              >
                                  {exportingRoom ? 'Preparing export...' : 'Download Room Data'}
                              </button>
                              <div className="host-form-helper">Exports songs, users, reactions, uploads, and activity as JSON.</div>
                              <button
                                  onClick={previewRecap}
                                  className={`${STYLES.btnStd} ${STYLES.btnSecondary} w-full`}
                              >
                                  Preview Recap on TV
                              </button>
                              <div className="host-form-helper">Shows a 10-second recap preview without closing the room.</div>
                                <button
                                    onClick={closeRoomWithRecap}
                                    disabled={closingRoom}
                                    className={`${STYLES.btnStd} ${STYLES.btnDanger} w-full`}
                                >
                                  {closingRoom ? 'Generating recap...' : 'Close Room + Generate Recap'}
                              </button>
                              <div className="host-form-helper">Builds a shareable recap link and closes the room.</div>
                          </div>

                        <div className="mt-6 space-y-3">
                            <div className="text-sm uppercase tracking-widest text-zinc-400">Search sources</div>
                            <div className="flex flex-wrap gap-2">
                                {['local', 'youtube', 'itunes'].map(src => (
                                    <button
                                        key={src}
                                        onClick={() => setSearchSources(prev => ({ ...prev, [src]: !prev[src] }))}
                                        className={`text-sm uppercase tracking-widest px-3 py-1 rounded-full border ${
                                            searchSources[src]
                                                ? 'bg-[#00C4D9]/20 text-[#00C4D9] border-[#00C4D9]/40'
                                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                        }`}
                                    >
                                        {src === 'youtube' ? 'YouTube' : src === 'itunes' ? 'Apple Music' : 'Local'}
                                    </button>
                                ))}
                            </div>
                            <label className="flex items-center gap-2 text-sm text-zinc-300 mt-3">
                                <input
                                    type="checkbox"
                                    checked={allowSingerTrackSelect}
                                    onChange={e => setAllowSingerTrackSelect(e.target.checked)}
                                    className="accent-[#00C4D9]"
                                />
                                Singer-selected backing tracks
                            </label>
                            <div className="host-form-helper">Allows singers to attach a backing track URL to their request.</div>
                        </div>
                        </>
                        )}

                        {settingsTab === 'monetization' && (
                        <div className="space-y-4">
                            <div className={STYLES.header}>Room Tip Crates</div>
                            <div className="host-form-helper">Configure tip crates for room boosts or personal boosts. Stripe checkout is handled by the app.</div>
                            <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                                {tipCrates.map((crate, idx) => (
                                    <div key={crate.id || `crate-${idx}`} className="bg-zinc-950/60 border border-white/5 rounded-lg p-3 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                value={crate.label || ''}
                                                onChange={e => {
                                                    const next = [...tipCrates];
                                                    next[idx] = { ...next[idx], label: e.target.value };
                                                    setTipCrates(next);
                                                }}
                                                className={STYLES.input}
                                                placeholder="Label (e.g. Crowd Boost)"
                                            />
                                            <input
                                                value={crate.amount ?? ''}
                                                onChange={e => {
                                                    const next = [...tipCrates];
                                                    next[idx] = { ...next[idx], amount: e.target.value };
                                                    setTipCrates(next);
                                                }}
                                                className={STYLES.input}
                                                placeholder="$ Amount"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                value={crate.points ?? ''}
                                                onChange={e => {
                                                    const next = [...tipCrates];
                                                    next[idx] = { ...next[idx], points: e.target.value };
                                                    setTipCrates(next);
                                                }}
                                                className={STYLES.input}
                                                placeholder="Room points"
                                            />
                                            <select
                                                value={crate.rewardScope || 'room'}
                                                onChange={e => {
                                                    const next = [...tipCrates];
                                                    next[idx] = { ...next[idx], rewardScope: e.target.value };
                                                    setTipCrates(next);
                                                }}
                                                className={STYLES.input}
                                            >
                                                <option value="room">Rewards everyone</option>
                                                <option value="buyer">Rewards buyer only</option>
                                            </select>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                                            <input
                                                type="checkbox"
                                                checked={!!crate.awardBadge}
                                                onChange={e => {
                                                    const next = [...tipCrates];
                                                    next[idx] = { ...next[idx], awardBadge: e.target.checked };
                                                    setTipCrates(next);
                                                }}
                                            />
                                            Give buyer a Moneybags badge
                                        </label>
                                        <button
                                            onClick={() => setTipCrates(prev => prev.filter((_, i) => i !== idx))}
                                            className={`${STYLES.btnStd} ${STYLES.btnDanger} w-full`}
                                        >
                                            Remove crate
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setTipCrates(prev => [...prev, { id: `crate_${Date.now()}`, label: '', amount: '', points: '', url: '' }])}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} w-full`}
                            >
                                Add tip crate
                            </button>
                        </div>
                        )}

                        {settingsTab === 'media' && (
                            <>
                        <div className="mt-6 bg-zinc-950/40 border border-white/10 rounded-xl p-4 space-y-2">
                            <div className="text-xs text-zinc-400 uppercase tracking-widest">YouTube playlist index</div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <input
                                    value={ytPlaylistUrl}
                                    onChange={e => setYtPlaylistUrl(e.target.value)}
                                    className={STYLES.input}
                                    placeholder="Paste a YouTube playlist URL or ID..."
                                    title="Paste a playlist URL or ID to index"
                                />
                                <button
                                    onClick={loadYouTubePlaylist}
                                    disabled={ytPlaylistLoading}
                                    className={`${STYLES.btnStd} ${ytPlaylistLoading ? STYLES.btnNeutral : STYLES.btnSecondary} px-4 flex-shrink-0`}
                                >
                                    {ytPlaylistLoading ? EMOJI.refresh : 'INDEX'}
                                </button>
                            </div>
                            {ytPlaylistStatus && <div className="host-form-helper">{ytPlaylistStatus}</div>}
                            <div className="host-form-helper">Indexes up to 150 videos per playlist load.</div>
                        </div>

                        <div className="mt-6 bg-zinc-950/40 border border-white/10 rounded-xl p-4 space-y-2">
                            <div className="text-sm text-zinc-400 uppercase tracking-widest">Apple Music playback</div>
                            <div className="flex items-center justify-between text-sm">
                                <div className="uppercase tracking-[0.25em] text-zinc-500">Apple Music login</div>
                                {appleMusicAuthorized ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-300 font-bold">Connected</span>
                                        <button onClick={disconnectAppleMusic} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 py-1 text-sm`}>Disconnect</button>
                                    </div>
                                ) : (
                                    <button onClick={connectAppleMusic} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-2 py-1 text-sm`}>Connect</button>
                                )}
                            </div>
                            {appleMusicStatus ? (
                                <div className="text-sm text-zinc-400 mt-1">{appleMusicStatus}</div>
                            ) : null}
                            <div className="flex flex-wrap gap-2 items-center">
                                <input
                                    value={appleMusicPlaylistUrl}
                                    onChange={e => setAppleMusicPlaylistUrl(e.target.value)}
                                    className={STYLES.input}
                                    placeholder="Paste an Apple Music playlist URL or ID..."
                                    title="Paste a playlist URL or ID to play"
                                />
                                <button
                                    onClick={async () => {
                                        const playlistId = parseAppleMusicPlaylistId(appleMusicPlaylistUrl);
                                        if (!playlistId) {
                                            setAppleMusicPlaylistStatus('Paste a valid playlist ID or URL.');
                                            return;
                                        }
                                        setAppleMusicPlaylistStatus('Starting playlist...');
                                        await playAppleMusicPlaylist(playlistId, { title: 'Playlist' });
                                        setAppleMusicPlaylistStatus('Playing playlist.');
                                    }}
                                    className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-4 flex-shrink-0`}
                                >
                                    Play
                                </button>
                                <button
                                    onClick={() => (appleMusicPlaying ? pauseAppleMusic() : resumeAppleMusic())}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 flex-shrink-0`}
                                >
                                    {appleMusicPlaying ? 'Pause' : 'Resume'}
                                </button>
                            </div>
                            {appleMusicPlaylistStatus ? (
                                <div className="host-form-helper">{appleMusicPlaylistStatus}</div>
                            ) : null}
                            <div className="host-form-helper">Playlist playback is host-only and drives the room vibe.</div>
                        </div>

                        <div className="mt-4 bg-zinc-950/40 border border-white/10 rounded-xl p-4 space-y-2">
                            <div className="text-sm text-zinc-400 uppercase tracking-widest">Auto-DJ playlist fallback</div>
                            <div className="flex flex-wrap gap-2 items-center">
                                <input
                                    value={appleMusicAutoPlaylistId}
                                    onChange={e => setAppleMusicAutoPlaylistId(e.target.value)}
                                    className={STYLES.input}
                                    placeholder="Paste an Apple Music playlist URL or ID..."
                                    title="Auto-DJ uses this playlist when the queue is empty"
                                />
                                <button
                                    onClick={async () => {
                                        const pid = parseAppleMusicPlaylistId(appleMusicAutoPlaylistId);
                                        if (!pid) return;
                                        const title = await fetchAppleMusicPlaylistTitle(pid);
                                        if (title) setAppleMusicAutoPlaylistTitle(title);
                                    }}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 flex-shrink-0`}
                                >
                                    Lookup
                                </button>
                            </div>
                            <input
                                value={appleMusicAutoPlaylistTitle}
                                onChange={e => setAppleMusicAutoPlaylistTitle(e.target.value)}
                                className={STYLES.input}
                                placeholder="Playlist title (optional)"
                                title="Shown in Apple Music playback status"
                            />
                            <div className="host-form-helper">Auto-DJ will start this playlist when no requests are queued.</div>
                        </div>

                        <div className="mt-4 bg-zinc-950/40 border border-white/10 rounded-xl p-4 space-y-2">
                            <div className="text-sm text-zinc-400 uppercase tracking-widest">Make song searchable</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input
                                    value={ytAddTitle}
                                    onChange={e => setYtAddTitle(e.target.value)}
                                    className={STYLES.input}
                                    placeholder="Song title"
                                    title="Title used for search and display"
                                />
                                <input
                                    value={ytAddArtist}
                                    onChange={e => setYtAddArtist(e.target.value)}
                                    className={STYLES.input}
                                    placeholder="Artist (optional)"
                                    title="Optional artist name"
                                />
                            </div>
                            <div className="host-form-helper">Title is required. Artist helps matching.</div>
                            <input
                                value={ytAddUrl}
                                onChange={e => setYtAddUrl(e.target.value)}
                                className={STYLES.input}
                                placeholder="YouTube URL (optional)"
                                title="Optional YouTube URL for the backing track"
                            />
                            <div className="host-form-helper">Leave URL empty to auto-search YouTube later.</div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={addYouTubeIndexEntry}
                                    disabled={ytAddLoading}
                                    className={`${STYLES.btnStd} ${ytAddLoading ? STYLES.btnNeutral : STYLES.btnSecondary} px-4`}
                                >
                                    {ytAddLoading ? EMOJI.refresh : 'Add to search'}
                                </button>
                                <div className="host-form-helper">Adds a backing track to search results.</div>
                            </div>
                            {ytAddStatus && <div className="host-form-helper">{ytAddStatus}</div>}
                        </div>

                        <div className="mt-6 bg-zinc-950/40 border border-white/10 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-zinc-400 uppercase tracking-widest">
                                <i className="fa-solid fa-hard-drive text-[#00C4D9]"></i>
                                Room Uploads
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="file"
                                    accept="video/*,audio/*"
                                    onChange={e => setPendingLocalFile(e.target.files?.[0] || null)}
                                    className="host-file-input text-xs text-zinc-300"
                                    disabled={uploadingLocal}
                                    title="Upload a local audio or video file"
                                />
                                <div className="host-form-helper ml-0 sm:ml-auto">Saved to room library and searchable</div>
                            </div>
                            <div className="host-form-helper">Audio/video only. Max 150MB. Room storage target: 2GB.</div>
                            <div className="flex items-center justify-between text-sm text-zinc-500">
                                <span>Room storage used</span>
                                <span className="text-zinc-300">{formatBytes(roomUploadBytes)} (~${estimateStorageMonthly(roomUploadBytes).toFixed(2)}/mo)</span>
                            </div>
                            {pendingLocalFile && (
                                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                                    <span className="flex-1 truncate">{pendingLocalFile.name}</span>
                                    <button
                                        onClick={async () => {
                                            await handleLocalUpload(pendingLocalFile, true);
                                            setPendingLocalFile(null);
                                        }}
                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-2 py-1`}
                                        disabled={uploadingLocal}
                                    >
                                        <i className="fa-solid fa-plus mr-1"></i> Upload + Queue
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await handleLocalUpload(pendingLocalFile, false);
                                            setPendingLocalFile(null);
                                        }}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 py-1`}
                                        disabled={uploadingLocal}
                                    >
                                        Upload Only
                                    </button>
                                </div>
                            )}
                            {uploadingLocal && (
                                <div className="text-sm text-zinc-400">
                                    Uploading... {Math.round(uploadProgress)}%
                                </div>
                            )}
                            <div className="border-t border-white/10 pt-2 text-sm text-zinc-500 uppercase tracking-widest">Recent uploads</div>
                            <div className="space-y-2">
                                {localLibrary.filter(i => i._local || i._cloud).slice(-3).reverse().map(item => (
                                    <div key={item.id} className="flex items-center gap-2 text-xs">
                                        <div className="flex-1 truncate text-zinc-200">{item.title}</div>
                                        <button onClick={() => addLocalItemToQueue(item)} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-2 py-1 text-sm`}>
                                            <i className="fa-solid fa-plus mr-1"></i> Add to Queue
                                        </button>
                                        {item._cloud && (
                                            <button onClick={() => deleteCloudUpload(item)} className={`${STYLES.btnStd} ${STYLES.btnDanger} px-2 py-1 text-sm`}>
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {localLibrary.filter(i => i._local || i._cloud).length === 0 && (
                                    <div className="text-sm text-zinc-500">No uploads yet.</div>
                                )}
                            </div>
                            <div className="border-t border-white/10 pt-2 text-sm text-zinc-500 uppercase tracking-widest">Room library</div>
                            <input
                                value={localFilter}
                                onChange={(e)=>setLocalFilter(e.target.value)}
                                className={`${STYLES.input} text-sm`}
                                placeholder="Filter uploads..."
                                title="Filter your room upload library"
                            />
                            <div className="host-form-helper">Filter by song title or file name.</div>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                                {localLibrary
                                    .filter(i => i._local || i._cloud)
                                    .filter(i =>
                                        i.title.toLowerCase().includes(localFilter.toLowerCase()) ||
                                        (i.fileName || '').toLowerCase().includes(localFilter.toLowerCase())
                                    )
                                    .map(item => (
                                        <div key={item.id} className="flex items-center gap-2 text-xs">
                                            <div className="flex-1 truncate text-zinc-200">{item.title}</div>
                                            <button onClick={() => addLocalItemToQueue(item)} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-2 py-1 text-sm`}>
                                                <i className="fa-solid fa-plus mr-1"></i> Add
                                            </button>
                                            {item._cloud && (
                                                <button onClick={() => deleteCloudUpload(item)} className={`${STYLES.btnStd} ${STYLES.btnDanger} px-2 py-1 text-sm`}>
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                {localLibrary.filter(i => i._local || i._cloud).length === 0 && (
                                    <div className="text-sm text-zinc-500">No uploads yet.</div>
                                )}
                            </div>
                        </div>
                            </>
                        )}

                            {settingsTab === 'marquee' && (
                            <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 space-y-4">
                                <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Marquee Manager</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="text-xs text-zinc-400">
                                        Show when
                                        <select value={marqueeShowMode} onChange={e=>setMarqueeShowMode(e.target.value)} className={`${STYLES.input} w-full mt-1`}>
                                            <option value="always">Always</option>
                                            <option value="karaoke">During karaoke only</option>
                                            <option value="idle">Idle (no singer)</option>
                                        </select>
                                    </label>
                                    <label className="text-xs text-zinc-400">
                                        Duration (sec)
                                        <input type="number" min="4" max="60" value={marqueeDurationSec} onChange={e=>setMarqueeDurationSec(e.target.value)} className={`${STYLES.input} w-full mt-1`} />
                                    </label>
                                    <label className="text-xs text-zinc-400">
                                        Interval (sec)
                                        <input type="number" min="4" max="120" value={marqueeIntervalSec} onChange={e=>setMarqueeIntervalSec(e.target.value)} className={`${STYLES.input} w-full mt-1`} />
                                    </label>
                                </div>
                                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
                                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Rotation</div>
                                    <div className="flex gap-2">
                                        <input
                                            value={marqueeDraft}
                                            onChange={e=>setMarqueeDraft(e.target.value)}
                                            className={`${STYLES.input} flex-1`}
                                            placeholder="Add a new marquee message..."
                                        />
                                        <button
                                            onClick={() => {
                                                if (!marqueeDraft.trim()) return;
                                                setMarqueeDraftItems(prev => [...prev, marqueeDraft.trim()]);
                                                setMarqueeDraft('');
                                            }}
                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary}`}
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                        {marqueeDraftItems.length === 0 && (
                                            <div className="host-form-helper">No marquee items yet. Add a few to rotate.</div>
                                        )}
                                        {marqueeDraftItems.map((item, idx) => (
                                            <div key={`${item}-${idx}`} className="flex items-center gap-2">
                                                <input
                                                    value={item}
                                                    onChange={e => {
                                                        const next = [...marqueeDraftItems];
                                                        next[idx] = e.target.value;
                                                        setMarqueeDraftItems(next);
                                                    }}
                                                    className={`${STYLES.input} flex-1`}
                                                />
                                                <button
                                                    onClick={() => setMarqueeDraftItems(prev => prev.filter((_, i) => i !== idx))}
                                                    className={`${STYLES.btnStd} ${STYLES.btnDanger}`}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowSettings(false)} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>Close</button>
                                    <button
                                        onClick={async () => {
                                            const cleaned = marqueeDraftItems.map(item => item.trim()).filter(Boolean);
                                            await updateMarqueeItems(cleaned);
                                            await saveMarqueeSettings();
                                        }}
                                        className={`${STYLES.btnStd} ${STYLES.btnPrimary}`}
                                    >
                                        Save Marquee
                                    </button>
                                </div>
                            </div>
                        )}
                        {settingsTab === 'chat' && (
                            <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 space-y-4">
                                <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Chat Settings</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="text-xs uppercase tracking-widest text-zinc-400">Audience access</div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    setChatAudienceMode('all');
                                                    await updateRoom({ chatAudienceMode: 'all' });
                                                }}
                                                className={`${STYLES.btnStd} ${chatAudienceMode === 'all' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                                title="Everyone can chat"
                                            >
                                                All Users
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setChatAudienceMode('vip');
                                                    await updateRoom({ chatAudienceMode: 'vip' });
                                                }}
                                                className={`${STYLES.btnStd} ${chatAudienceMode === 'vip' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                                title="Only VIPs can chat"
                                            >
                                                VIP Only
                                            </button>
                                        </div>
                                        <div className="host-form-helper">Use VIP-only chat for premium nights.</div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-xs uppercase tracking-widest text-zinc-400">Room status</div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={async () => {
                                                    const next = !chatEnabled;
                                                    setChatEnabled(next);
                                                    await updateRoom({ chatEnabled: next });
                                                }}
                                                className={`${STYLES.btnStd} ${chatEnabled ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                            >
                                                <i className="fa-solid fa-comments mr-2"></i>
                                                {chatEnabled ? 'Chat On' : 'Chat Off'}
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    const next = !chatShowOnTv;
                                                    setChatShowOnTv(next);
                                                    await updateRoom({ chatShowOnTv: next });
                                                }}
                                                className={`${STYLES.btnStd} ${chatShowOnTv ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                            >
                                                <i className="fa-solid fa-tv mr-2"></i>
                                                {chatShowOnTv ? 'TV Rotation On' : 'TV Rotation Off'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-xs uppercase tracking-widest text-zinc-400">Slow mode (seconds)</div>
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={chatSlowModeSec}
                                        onChange={e => setChatSlowModeSec(e.target.value)}
                                        onBlur={async () => {
                                            const value = Math.max(0, Number(chatSlowModeSec || 0));
                                            await updateRoom({ chatSlowModeSec: value });
                                        }}
                                        className={STYLES.input}
                                    />
                                    <div className="host-form-helper">0 disables slow mode. Applies to all chat senders.</div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleChatViewMode('room')}
                                        className={`${STYLES.btnStd} ${chatViewMode === 'room' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                    >
                                        <i className="fa-solid fa-comments mr-2"></i>
                                        Room Chat
                                    </button>
                                    <button
                                        onClick={() => handleChatViewMode('host')}
                                        className={`${STYLES.btnStd} ${chatViewMode === 'host' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                    >
                                        <i className="fa-solid fa-inbox mr-2"></i>
                                        Host DMs
                                    </button>
                                </div>
                                <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Recent chat</div>
                                <div className="max-h-56 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                                    {(chatViewMode === 'room'
                                        ? chatMessages.filter(m => !m.toHost)
                                        : chatMessages.filter(m => m.toHost)
                                    ).length === 0 && (
                                        <div className="text-zinc-500 text-xs italic">No chat yet.</div>
                                    )}
                                    {(chatViewMode === 'room'
                                        ? chatMessages.filter(m => !m.toHost)
                                        : chatMessages.filter(m => m.toHost)
                                    ).map(m => (
                                        <div key={m.id} className="flex items-center gap-2 bg-zinc-900/60 border border-white/5 rounded-lg px-3 py-2 text-xs text-zinc-200">
                                            <span className="text-lg">{m.avatar || EMOJI.sparkle}</span>
                                            <span className="font-bold text-white">{m.user || 'Guest'}</span>
                                            <span className="text-zinc-400 truncate">{m.text}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Send a host message</div>
                                <div className="flex gap-2">
                                    <input
                                        value={chatDraft}
                                        onChange={e => setChatDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendHostChat();
                                            }
                                        }}
                                        className={`${STYLES.input} flex-1`}
                                        placeholder="Type a hype message..."
                                    />
                                    <button onClick={sendHostChat} className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-4`}>
                                        Send
                                    </button>
                                </div>
                            </div>
                        )}
                        {showYtIndex && (
                            <div className="fixed inset-0 z-[85] bg-[#0b0b10] text-white flex flex-col">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                                    <button onClick={() => setShowYtIndex(false)} className="text-zinc-400 text-sm">&larr; Back</button>
                                    <div className="text-lg font-bold">YouTube Index</div>
                                    <div className="text-sm text-zinc-500">Playlist imports</div>
                                </div>
                                <div className="px-6 py-4">
                                    <div className="bg-zinc-900/60 border border-zinc-700 rounded-2xl p-3 flex items-center gap-3">
                                        <i className="fa-solid fa-magnifying-glass text-zinc-500"></i>
                                        <input
                                            value={ytIndexFilter}
                                            onChange={e => setYtIndexFilter(e.target.value)}
                                            className="flex-1 bg-transparent text-sm text-white outline-none"
                                            placeholder="Filter YouTube index..."
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
                                    <div className="grid grid-cols-2 gap-3">
                                        {ytIndex
                                            .filter(item => (`${item.trackName} ${item.artistName}`).toLowerCase().includes(ytIndexFilter.toLowerCase()))
                                            .map((item, idx) => (
                                                <div key={`${item.videoId || item.trackName}-${idx}`} className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 rounded-xl p-3">
                                                    <img src={item.artworkUrl100} alt={item.trackName} className="w-12 h-12 rounded-lg object-cover" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-white truncate">{item.trackName}</div>
                                                        <div className="text-sm text-zinc-400 truncate">{item.artistName}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => queueYouTubeFromCatalog(item)}
                                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-[10px]`}
                                                    >
                                                        + Add to Queue
                                                    </button>
                                                </div>
                                            ))}
                                        {ytIndex.filter(item => (`${item.trackName} ${item.artistName}`).toLowerCase().includes(ytIndexFilter.toLowerCase())).length === 0 && (
                                            <div className="col-span-2 text-center text-zinc-500 text-sm">No matches</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {settingsTab === 'qa' && (
                            <div className={`${STYLES.panel} p-4 border-white/10`}>
                                <div className={STYLES.header}>QA DEBUG</div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3">
                                        <div className="text-sm uppercase tracking-widest text-zinc-500 mb-2">Room Snapshot</div>
                                        <div className="text-sm text-zinc-300">Room: <span className="text-white font-mono">{roomCode || '--'}</span></div>
                                        <div className="text-sm text-zinc-300">Mode: <span className="text-white">{room?.activeMode || 'karaoke'}</span></div>
                                        <div className="text-sm text-zinc-300">Screen: <span className="text-white">{room?.activeScreen || 'stage'}</span></div>
                                        <div className="text-sm text-zinc-300">On Stage: <span className="text-white">{currentSong?.singerName || 'None'}</span></div>
                                        <div className="text-sm text-zinc-300">Queue: <span className="text-white">{queuedSongs.length}</span></div>
                                        <div className="text-sm text-zinc-300">Lobby: <span className="text-white">{users?.length || 0}</span></div>
                                    </div>
                                    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3">
                                        <div className="text-sm uppercase tracking-widest text-zinc-500 mb-2">Health</div>
                                        <div className="text-sm text-zinc-300">BG Music: <span className="text-white">{room?.bgMusicPlaying ? 'On' : 'Off'}</span></div>
                                        <div className="text-sm text-zinc-300">Mix: <span className="text-white">{Math.round(room?.mixFader ?? 50)}%</span></div>
                                        <div className="text-sm text-zinc-300">Lyrics TV: <span className="text-white">{room?.showLyricsTv ? 'On' : 'Off'}</span></div>
                                        <div className="text-sm text-zinc-300">Visualizer TV: <span className="text-white">{room?.showVisualizerTv ? 'On' : 'Off'}</span></div>
                                        <div className="text-sm text-zinc-300">Lyrics Singer: <span className="text-white">{room?.showLyricsSinger ? 'On' : 'Off'}</span></div>
                                        <div className="text-sm text-zinc-300">Light Mode: <span className="text-white">{room?.lightMode || 'off'}</span></div>
                                        <div className="text-sm text-zinc-300">Audience Sync: <span className="text-white">{room?.audienceVideoMode || 'off'}</span></div>
                                    </div>
                                    <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-3">
                                        <div className="text-sm uppercase tracking-widest text-zinc-500 mb-2">Event Pulse</div>
                                        <div className="text-sm text-zinc-300">Last 5 min: <span className="text-white">{recentActivities.length}</span></div>
                                        <div className="text-sm text-zinc-300">Last Activity: <span className="text-white">{lastActivity?.text || 'None'}</span></div>
                                        <button onClick={copySnapshot} className={`${STYLES.btnStd} ${STYLES.btnNeutral} mt-3 w-full`}>
                                            <i className="fa-solid fa-copy mr-1"></i>Copy Room Snapshot
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4 border-t border-white/10 pt-3">
                                    <div className="text-sm uppercase tracking-widest text-zinc-500 mb-2">Recent Activity</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                        {(activities || []).slice(0, 10).map((a, i) => (
                                            <div key={`${a?.id || a?.timestamp?.seconds || 'activity'}-${i}`} className="text-sm text-zinc-300 bg-zinc-900/60 border border-white/5 rounded-lg px-2 py-1">
                                                <span className="text-zinc-500 mr-1">{a?.icon || EMOJI.sparkle}</span>
                                                <span className="text-white">{a?.user || 'Guest'}</span>
                                                <span className="text-zinc-500"> {a?.text || ''}</span>
                                            </div>
                                        ))}
                                        {(activities || []).length === 0 && (
                                            <div className="text-sm text-zinc-500 italic">No activity yet.</div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 border-t border-white/10 pt-3">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <div className="text-sm uppercase tracking-widest text-zinc-500">Smoke Test</div>
                                        <label className="flex items-center gap-2 text-sm text-zinc-400">
                                            <input
                                                type="checkbox"
                                                checked={smokeIncludeWrite}
                                                onChange={(e) => setSmokeIncludeWrite(e.target.checked)}
                                                className="accent-[#00C4D9]"
                                            />
                                            Include write test
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                            <button
                                                onClick={runSmokeTest}
                                                disabled={smokeRunning}
                                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 ${smokeRunning ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                {smokeRunning ? 'Running...' : 'Run Smoke Test'}
                                            </button>
                                        <div className="text-sm text-zinc-500">Checks room read access + optional write/delete.</div>
                                    </div>
                                    {smokeResults.length > 0 && (
                                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {smokeResults.map((res, idx) => (
                                                <div key={`${res.label}-${idx}`} className="text-sm text-zinc-300 bg-zinc-900/60 border border-white/5 rounded-lg px-2 py-1 flex items-center justify-between gap-2">
                                                    <div className="truncate">
                                                        <span className="text-white">{res.label}</span>
                                                        {res.detail && <span className="text-zinc-500"> — {res.detail}</span>}
                                                    </div>
                                                    <span className={`text-sm uppercase tracking-widest ${
                                                        res.status === 'ok'
                                                            ? 'text-emerald-400'
                                                            : res.status === 'warn'
                                                                ? 'text-yellow-400'
                                                                : 'text-rose-400'
                                                    }`}>
                                                        {res.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {settingsTab === 'media' && (
                            <div className="flex justify-end gap-2 mt-6">
                                <button onClick={() => setShowSettings(false)} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>Cancel</button>
                                <button onClick={saveApiKeys} className={`${STYLES.btnStd} ${STYLES.btnPrimary}`}>Save Settings</button>
                            </div>
                        )}

                        {settingsTab === 'general' && (
                            <div className="flex justify-end gap-2 mt-6">
                                <button onClick={() => setShowSettings(false)} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>Cancel</button>
                                <button onClick={saveApiKeys} className={`${STYLES.btnStd} ${STYLES.btnPrimary}`}>Save Settings</button>
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HostApp;


