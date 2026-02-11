import React, { useState, useEffect, useRef, useMemo } from 'react';
import UnifiedGameLauncher from '../../components/UnifiedGameLauncher';
import { GAMES_META } from '../../lib/gameRegistry';
import StageNowPlayingPanel from './components/StageNowPlayingPanel';
import AddToQueueFormBody from './components/AddToQueueFormBody';
import TvDashboardControls from './components/TvDashboardControls';
import AutomationControls from './components/AutomationControls';
import SoundboardControls from './components/SoundboardControls';
import HostChatPanel from './components/HostChatPanel';
import OverlaysGuidesPanel from './components/OverlaysGuidesPanel';
import RewardPointsPanel from './components/RewardPointsPanel';
import QueueListPanel from './components/QueueListPanel';
import QueueYouTubeSearchModal from './components/QueueYouTubeSearchModal';
import QueueEditSongModal from './components/QueueEditSongModal';
import HostLogoManager from './components/HostLogoManager';
import ChatSettingsPanel from './components/ChatSettingsPanel';
import HostTopChrome from './components/HostTopChrome';
import useHostChat from './hooks/useHostChat';
import useQueueDerivedState from './hooks/useQueueDerivedState';
import useQueueMediaTools from './hooks/useQueueMediaTools';
import useQueueReorder from './hooks/useQueueReorder';
import useQueueSongActions from './hooks/useQueueSongActions';
import useQueueTabState from './hooks/useQueueTabState';
import HOST_UI_FEATURE_CHECKLIST from './hostUiFeatureChecklist';
import { 
    db, doc, collection, query, where, onSnapshot, updateDoc, 
    addDoc, deleteDoc, serverTimestamp, limit, getDocs, getDoc, setDoc, writeBatch,
    storage, storageRef, uploadBytesResumable, getDownloadURL, deleteObject,
    arrayUnion,
    auth,
    initAuth,
    trackEvent,
    callFunction,
    ensureOrganization,
    getMyEntitlements,
    getMyUsageSummary
} from '../../lib/firebase';
import { ASSETS, AVATARS, APP_ID } from '../../lib/assets';
import { playSfx, setSfxMasterVolume, stopAllSfx } from '../../lib/utils';
import { EMOJI } from '../../lib/emoji';
import { BROWSE_CATEGORIES, TOPIC_HITS } from '../../lib/browseLists';
import { useToast } from '../../context/ToastContext';
import { BG_TRACKS, SOUNDS } from '../../lib/gameDataConstants';
import { HOST_APP_CONFIG } from '../../lib/uiConstants';
import { buildSongKey, ensureSong, ensureTrack, extractYouTubeId } from '../../lib/songCatalog';
import {
    normalizeBackingChoice,
    resolveStageMediaUrl,
    resolveQueuePlayback,
} from '../../lib/playbackSource';

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
        const code = String(e?.code || e?.message || '').toLowerCase();
        if (code.includes('permission-denied')) {
            alert("AI tools require an active Host subscription.");
        } else {
            alert("Gemini is not configured yet. Add server keys and try again.");
        }
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

const DEFAULT_LOGO_PRESETS = [
    { id: 'default-bross', label: 'BROSS Default', url: ASSETS.logo },
    { id: 'bross-entertainment', label: 'Bross Entertainment', url: '/images/logo-library/bross-entertainment.png' },
    { id: 'bross-entertainment-chrome', label: 'Bross Chrome', url: '/images/logo-library/bross-entertainment-chrome.png' },
    { id: 'beaurocks-karaoke-logo-2', label: 'Beaurocks Logo 2', url: '/images/logo-library/beaurocks-karaoke-logo-2.png' },
    { id: 'icon-reversed-gradient', label: 'Icon Reversed Gradient', url: '/images/logo-library/icon-reversed-gradient.png' },
    { id: 'bross-ent-favicon-1', label: 'Bross Favicon 1', url: '/images/logo-library/bross-ent-favicon-1.png' },
    { id: 'chatgpt-2026-02-08-032254pm', label: 'ChatGPT Concept 03:22 PM', url: '/images/logo-library/chatgpt-2026-02-08-032254pm.png' },
    { id: 'chatgpt-2026-02-08-103037pm', label: 'ChatGPT Concept 10:30 PM', url: '/images/logo-library/chatgpt-2026-02-08-103037pm.png' },
    { id: 'chatgpt-2026-02-08-115558pm', label: 'ChatGPT Concept 11:55 PM', url: '/images/logo-library/chatgpt-2026-02-08-115558pm.png' }
];

const HOST_ONBOARDING_STEPS = [
    { key: 'identity', label: 'Identity' },
    { key: 'plan', label: 'Plan' },
    { key: 'branding', label: 'Branding' },
    { key: 'launch', label: 'Launch' }
];

const HOST_ONBOARDING_PLAN_OPTIONS = [
    { id: 'free', label: 'Free', price: '$0', note: 'Test the workspace before upgrading.' },
    { id: 'host_monthly', label: 'Host Monthly', price: '$19/mo', note: 'Recurring monthly host subscription.' },
    { id: 'host_annual', label: 'Host Annual', price: '$190/yr', note: 'Lower yearly effective rate for active hosts.' }
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

const formatUsdFromCents = (cents = 0) => {
    const amount = Number(cents || 0) / 100;
    return `$${amount.toFixed(2)}`;
};

const toMs = (t) => {
    if (!t) return 0;
    if (typeof t === 'number') return t;
    if (t?.toMillis) return t.toMillis();
    if (t?.seconds) return t.seconds * 1000;
    return 0;
};

const getTimestampMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
};

const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ123456789";
const DEFAULT_QA_YT_PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PL_3exKsBlHnEbbmolJlfODkelxx_1UMAP';
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
    const toggleSubmissionApproval = async (submission) => {
        if (!roomCode || !submission?.id) return;
        try {
            await callFunction('setSelfieSubmissionApproval', {
                roomCode,
                submissionId: submission.id,
                approved: !submission.approved
            });
        } catch (e) {
            console.error('Selfie moderation failed', e);
            toast('Failed to update approval');
        }
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
                                        onClick={() => toggleSubmissionApproval(s)}
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
    const toast = useToast() || console.log;
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
    
    const deletePhoto = async (id) => {
        if (!roomCode || !id) return;
        try {
            await callFunction('deleteRoomReaction', { roomCode, reactionId: id });
        } catch (e) {
            console.error('Delete photo failed', e);
            toast('Delete failed');
        }
    };

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

const QueueTab = ({ songs, room, roomCode, appBase, updateRoom, logActivity, localLibrary, playSfxSafe, toggleHowToPlay, startStormSequence, stopStormSequence, startBeatDrop, users, dropBonus, giftPointsToUser, tipPointRate, setTipPointRate, marqueeEnabled, setMarqueeEnabled, sfxMuted, setSfxMuted, sfxLevel, sfxVolume, setSfxVolume, searchSources, setSearchSources, ytIndex, setYtIndex, persistYtIndex, autoDj, setAutoDj, autoBgMusic, setAutoBgMusic, playingBg, setBgMusicState, startReadyCheck, chatShowOnTv, setChatShowOnTv, chatUnread, dmUnread, chatEnabled, setChatEnabled, chatAudienceMode, setChatAudienceMode, chatDraft, setChatDraft, chatMessages, sendHostChat, sendHostDmMessage, itunesBackoffRemaining, pinnedChatIds, setPinnedChatIds, chatViewMode, handleChatViewMode, appleMusicPlaying, appleMusicStatus, playAppleMusicTrack, pauseAppleMusic, resumeAppleMusic, stopAppleMusic, autoDjCountdown, hostName, fetchTop100Art, openChatSettings, dmTargetUid, setDmTargetUid, dmDraft, setDmDraft, getAppleMusicUserToken, silenceAll }) => {
    const {
        stagePanelOpen,
        setStagePanelOpen,
        tvControlsOpen,
        setTvControlsOpen,
        soundboardOpen,
        setSoundboardOpen,
        chatOpen,
        setChatOpen,
        overlaysOpen,
        setOverlaysOpen,
        vibeSyncOpen,
        setVibeSyncOpen,
        automationOpen,
        setAutomationOpen,
        crowdPointsOpen,
        setCrowdPointsOpen,
        panelLayout,
        activeWorkspace,
        workspaceOptions,
        applyWorkspacePreset,
        expandAllPanels,
        collapseAllPanels,
        resetPanelLayout,
        searchQ,
        setSearchQ,
        showAddForm,
        setShowAddForm,
        results,
        setResults,
        manual,
        setManual,
        quickAddOnResultClick,
        setQuickAddOnResultClick,
        quickAddLoadingKey,
        setQuickAddLoadingKey,
        quickAddNotice,
        setQuickAddNotice,
        giftTargetUid,
        setGiftTargetUid,
        giftAmount,
        setGiftAmount,
        lyricsOpen,
        setLyricsOpen,
        manualSingerMode,
        setManualSingerMode,
        editingSongId,
        setEditingSongId,
        editForm,
        setEditForm,
        customBonus,
        setCustomBonus,
        showQueueList,
        setShowQueueList,
        ytSearchOpen,
        setYtSearchOpen,
        ytSearchTarget,
        setYtSearchTarget,
        ytSearchQ,
        setYtSearchQ,
        ytEditingQuery,
        setYtEditingQuery,
        ytResults,
        setYtResults,
        ytLoading,
        setYtLoading,
        ytSearchError,
        setYtSearchError,
        embedCache,
        setEmbedCache,
        _testingVideoId,
        setTestingVideoId,
        _previewIframe,
        _setPreviewIframe
    } = useQueueTabState({ hostName, roomCode });

    const SectionHeader = ({ label, open, onToggle, toneClass = '', featureId = '' }) => (
        <button
            onClick={onToggle}
            data-feature-id={featureId || undefined}
            className={`w-full flex items-center justify-between ${STYLES.header} ${toneClass}`}
        >
            <span>{label}</span>
            <i className={`fa-solid fa-chevron-down transition-transform ${open ? 'rotate-180' : ''}`}></i>
        </button>
    );
    const toast = useToast() || console.log;
    const hallOfFameTimerRef = useRef(null);
    const mediaOverrideStopRef = useRef('');
    const commandInputRef = useRef(null);
    const [commandOpen, setCommandOpen] = useState(false);
    const [commandQuery, setCommandQuery] = useState('');
    const roomChatMessages = chatMessages.filter(msg => !msg.toHost);
    const hostDmMessages = chatMessages.filter(msg => msg.toHost || msg.toUid);
    const {
        current,
        hasLyrics,
        queue,
        pending,
        lobbyCount,
        queueCount,
        waitTimeSec,
        formatWaitTime,
        currentMediaUrl,
        currentUsesAppleBacking,
        currentSourcePlaying,
        currentSourceLabel,
        currentSourceToneClass
    } = useQueueDerivedState({ songs, room, users, appleMusicPlaying });
    const openPanelCount = useMemo(
        () => Object.values(panelLayout || {}).filter(Boolean).length,
        [panelLayout]
    );
    const runUiFeatureCheck = () => {
        if (typeof document === 'undefined') return;
        const missing = HOST_UI_FEATURE_CHECKLIST.filter((item) => !document.querySelector(item.selector));
        if (missing.length) {
            console.warn('[Host UI Feature Check] Missing controls:', missing);
            toast(`UI feature check: ${missing.length} missing control(s).`);
            return;
        }
        toast(`UI feature check passed (${HOST_UI_FEATURE_CHECKLIST.length} controls).`);
    };
    const commandPaletteItems = useMemo(() => {
        const nextQueueSong = queue[0];
        return [
            {
                id: 'start-next',
                label: 'Start Next Performer',
                enabled: !!nextQueueSong,
                hint: nextQueueSong ? `${nextQueueSong.singerName || 'Guest'} - ${nextQueueSong.songTitle || 'Song'}` : 'Queue is empty',
                keywords: 'queue start next performer',
                run: async () => {
                    if (!nextQueueSong) return;
                    await updateStatus(nextQueueSong.id, 'performing');
                }
            },
            {
                id: 'toggle-source',
                label: currentSourcePlaying ? 'Pause Current Source' : 'Play Current Source',
                enabled: !!current,
                hint: current ? (current.songTitle || 'Current performance') : 'No current song',
                keywords: 'play pause toggle source backing',
                run: async () => { await togglePlay(); }
            },
            {
                id: 'open-tv',
                label: 'Open Public TV Display',
                enabled: !!roomCode,
                hint: roomCode ? `Room ${roomCode}` : 'No room code',
                keywords: 'tv display public open',
                run: async () => { window.open(`${appBase}?room=${roomCode}&mode=tv`, '_blank', 'noopener,noreferrer'); }
            },
            {
                id: 'chat-settings',
                label: 'Open Chat Settings',
                enabled: true,
                hint: 'Moderation and TV chat mode',
                keywords: 'chat settings moderation tv mode',
                run: async () => { openChatSettings(); }
            },
            {
                id: 'workspace-performance',
                label: 'Workspace: Performance Mode',
                enabled: true,
                hint: 'Stage + queue focus',
                keywords: 'workspace performance layout stage',
                run: async () => { applyWorkspacePreset('performance'); }
            },
            {
                id: 'workspace-crowd',
                label: 'Workspace: Crowd Mode',
                enabled: true,
                hint: 'Chat + rewards focus',
                keywords: 'workspace crowd audience layout',
                run: async () => { applyWorkspacePreset('crowd'); }
            },
            {
                id: 'workspace-broadcast',
                label: 'Workspace: Broadcast Mode',
                enabled: true,
                hint: 'TV + overlays focus',
                keywords: 'workspace broadcast layout tv overlay',
                run: async () => { applyWorkspacePreset('broadcast'); }
            },
            {
                id: 'expand-all',
                label: 'Expand All Panels',
                enabled: true,
                hint: 'Open every section',
                keywords: 'expand all panels layout',
                run: async () => { expandAllPanels(); }
            },
            {
                id: 'collapse-all',
                label: 'Collapse All Panels',
                enabled: true,
                hint: 'Collapse every section',
                keywords: 'collapse all panels layout',
                run: async () => { collapseAllPanels(); }
            },
            {
                id: 'reset-layout',
                label: 'Reset Panel Layout',
                enabled: true,
                hint: 'Restore default layout',
                keywords: 'reset default layout',
                run: async () => { resetPanelLayout(); }
            },
            {
                id: 'ui-feature-check',
                label: 'Run UI Feature Check',
                enabled: true,
                hint: 'Verify critical host controls are present',
                keywords: 'check verify ui features buttons controls',
                run: async () => { runUiFeatureCheck(); }
            }
        ];
    }, [
        queue,
        updateStatus,
        currentSourcePlaying,
        current,
        togglePlay,
        roomCode,
        appBase,
        openChatSettings,
        applyWorkspacePreset,
        expandAllPanels,
        collapseAllPanels,
        resetPanelLayout,
        runUiFeatureCheck
    ]);
    const filteredCommands = useMemo(() => {
        const q = (commandQuery || '').trim().toLowerCase();
        if (!q) return commandPaletteItems;
        return commandPaletteItems.filter((item) => {
            const haystack = `${item.label} ${item.hint || ''} ${item.keywords || ''}`.toLowerCase();
            return haystack.includes(q);
        });
    }, [commandPaletteItems, commandQuery]);

    useEffect(() => {
        try {
            localStorage.setItem('bross_quick_add_on_result_click', quickAddOnResultClick ? '1' : '0');
        } catch {
            // Ignore storage failures.
        }
    }, [quickAddOnResultClick]);
    useEffect(() => {
        if (!quickAddNotice) return;
        const timeout = setTimeout(() => setQuickAddNotice(null), 8000);
        return () => clearTimeout(timeout);
    }, [quickAddNotice]);
    useEffect(() => {
        if (!current) {
            mediaOverrideStopRef.current = '';
            return;
        }
        const stageMediaUrl = resolveStageMediaUrl(current, room);
        const effectiveBacking = normalizeBackingChoice({
            mediaUrl: stageMediaUrl,
            appleMusicId: current?.appleMusicId
        });
        const appleStatus = (room?.appleMusicPlayback?.status || '').toLowerCase();
        const shouldStopApple = !!effectiveBacking.mediaUrl && (appleStatus === 'playing' || appleStatus === 'paused' || appleMusicPlaying);
        if (!shouldStopApple) {
            mediaOverrideStopRef.current = '';
            return;
        }
        const key = `${current.id || 'current'}|${effectiveBacking.mediaUrl}|${appleStatus}|${appleMusicPlaying ? '1' : '0'}`;
        if (mediaOverrideStopRef.current === key) return;
        mediaOverrideStopRef.current = key;
        let cancelled = false;
        (async () => {
            try {
                await stopAppleMusic?.();
                if (!cancelled) {
                    await updateRoom({ appleMusicPlayback: null });
                }
            } catch (err) {
                console.warn('Failed to stop Apple Music during media override', err);
            }
        })();
        return () => { cancelled = true; };
    }, [current?.id, current?.mediaUrl, current?.appleMusicId, room?.mediaUrl, room?.appleMusicPlayback?.status, appleMusicPlaying, stopAppleMusic, updateRoom]);
    useEffect(() => () => {
        if (hallOfFameTimerRef.current) clearTimeout(hallOfFameTimerRef.current);
    }, []);
    useEffect(() => {
        const onKeyDown = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setCommandOpen(prev => !prev);
                setCommandQuery('');
                return;
            }
            if (event.key === 'Escape' && commandOpen) {
                setCommandOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [commandOpen]);
    useEffect(() => {
        if (!commandOpen) return;
        const timer = setTimeout(() => commandInputRef.current?.focus(), 0);
        return () => clearTimeout(timer);
    }, [commandOpen]);

    const runPaletteCommand = async (command) => {
        if (!command?.enabled || typeof command?.run !== 'function') return;
        try {
            await command.run();
            setCommandOpen(false);
            setCommandQuery('');
        } catch (error) {
            console.error('Command failed', error);
            toast('Command failed');
        }
    };
    const undoQuickAdd = async () => {
        if (!quickAddNotice?.id) return;
        try {
            await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', quickAddNotice.id));
            toast(`Removed ${quickAddNotice.songTitle}`);
            setQuickAddNotice(null);
        } catch {
            toast('Undo failed');
        }
    };
    const changeQuickAddBacking = () => {
        if (!quickAddNotice) return;
        startEdit({
            id: quickAddNotice.id,
            songTitle: quickAddNotice.songTitle,
            artist: quickAddNotice.artist,
            singerName: quickAddNotice.singerName,
            mediaUrl: quickAddNotice.mediaUrl || '',
            albumArtUrl: quickAddNotice.albumArtUrl || '',
            lyrics: quickAddNotice.lyrics || '',
            lyricsTimed: quickAddNotice.lyricsTimed || null,
            appleMusicId: quickAddNotice.appleMusicId || '',
            duration: quickAddNotice.duration || 180
        });
        setQuickAddNotice(null);
    };
    const generateManualLyrics = async () => {
        if (!manual.song || !manual.artist) return toast('Need Song & Artist');
        toast('Generating Lyrics...');
        const res = await generateAIContent('lyrics', { title: manual.song, artist: manual.artist });
        if (res && res.lyrics) {
            setManual(prev => ({ ...prev, lyrics: res.lyrics, lyricsTimed: null, appleMusicId: '' }));
            setLyricsOpen(true);
            toast('Lyrics Generated!');
        } else {
            toast('Gen Failed');
        }
    };

    const {
        dragQueueId,
        setDragQueueId,
        dragOverId,
        setDragOverId,
        reorderQueue,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd
    } = useQueueReorder({
        queue,
        toast,
        onPersist: async (list) => {
            const base = Date.now();
            await Promise.all(list.map((item, idx) =>
                updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', item.id), { priorityScore: base + idx })
            ));
        }
    });
    const isAudioUrl = (url) => /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(url || '');
    const {
        parseYouTubeId,
        resolveDurationForUrl,
        searchYouTube,
        openYtSearch
    } = useQueueMediaTools({
        ytIndex,
        setYtIndex,
        persistYtIndex,
        ytSearchQ,
        setYtSearchQ,
        setYtSearchOpen,
        setYtSearchTarget,
        setYtEditingQuery,
        setYtResults,
        setYtLoading,
        setYtSearchError,
        setEmbedCache
    });
    const {
        addSong,
        addSongFromResult,
        startEdit,
        saveEdit,
        generateLyrics,
        syncEditDuration,
        addBonusToCurrent
    } = useQueueSongActions({
        roomCode,
        room,
        hostName,
        manual,
        setManual,
        setSearchQ,
        current,
        editingSongId,
        setEditingSongId,
        editForm,
        setEditForm,
        isAudioUrl,
        resolveDurationForUrl,
        generateAIContent,
        getAppleMusicUserToken,
        toast
    });

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

    const getResultRowKey = (r, idx = 0) => {
        return `${r?.source || 'song'}_${r?.trackId || r?.videoId || r?.url || r?.trackName || idx}`;
    };

    const handleResultClick = async (r, idx = 0) => {
        const rowKey = getResultRowKey(r, idx);
        if (quickAddOnResultClick) {
            if (quickAddLoadingKey) return;
            setQuickAddLoadingKey(rowKey);
            const queued = await addSongFromResult(r);
            setQuickAddLoadingKey('');
            if (queued?.id) {
                setQuickAddNotice({
                    id: queued.id,
                    songTitle: queued.songTitle,
                    artist: queued.artist,
                    singerName: queued.singerName,
                    mediaUrl: queued.mediaUrl || '',
                    albumArtUrl: queued.albumArtUrl || '',
                    lyrics: queued.lyrics || '',
                    lyricsTimed: queued.lyricsTimed || null,
                    appleMusicId: queued.appleMusicId || '',
                    duration: queued.duration || 180,
                    statusText: queued.statusText || 'Queued'
                });
            }
            setResults([]);
            setSearchQ('');
            return;
        }
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
            const stageMediaUrl = resolveStageMediaUrl(s, room);
            const effectiveBacking = normalizeBackingChoice({
                mediaUrl: stageMediaUrl,
                appleMusicId: s?.appleMusicId
            });
            const songMediaUrl = effectiveBacking.mediaUrl;
            const useAppleBacking = effectiveBacking.usesAppleBacking;
            const autoStartMedia = !!(room?.autoPlayMedia !== false) && !!(songMediaUrl || useAppleBacking);
            if (useAppleBacking && autoStartMedia) {
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
                await stopAppleMusic?.();
                await updateRoom({
                    activeMode: 'karaoke',
                    'announcement.active': false,
                    mediaUrl: songMediaUrl,
                    singAlongMode: false,
                    videoPlaying: autoStartMedia && !!songMediaUrl,
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
                await stopAppleMusic?.();
                await updateRoom({ lastPerformance: { ...s, applauseScore: room?.applausePeak||0, timestamp: Date.now(), albumArtUrl: s.albumArtUrl || '', topFan, vibeStats }, activeMode: 'karaoke', mediaUrl: '', singAlongMode: false, videoPlaying: false, showLyricsTv: false, showVisualizerTv: false, showLyricsSinger: false, appleMusicPlayback: null }); 
                await logPerformance({ ...s, applauseScore: room?.applausePeak || 0 });
                logActivity(roomCode, s.singerName, `crushed ${s.songTitle}!`, EMOJI.star);
                toast("Performance Finished"); 
            } 
        } 
    };

    // Unified play/pause for the current backing source (Apple or media URL).
    const togglePlay = async () => {
        if (!current) return;
        const stageMediaUrl = resolveStageMediaUrl(current, room);
        const currentPlayback = normalizeBackingChoice({
            mediaUrl: stageMediaUrl,
            appleMusicId: current?.appleMusicId
        });
        const sourceMediaUrl = currentPlayback.mediaUrl;
        const usingApple = currentPlayback.usesAppleBacking;
        if (usingApple) {
            const appleStatus = (room?.appleMusicPlayback?.status || '').toLowerCase();
            if (appleStatus === 'playing' || appleMusicPlaying) {
                await pauseAppleMusic();
            } else if (appleStatus === 'paused') {
                await resumeAppleMusic();
            } else {
                await playAppleMusicTrack(current.appleMusicId, { title: current.songTitle, artist: current.artist });
            }
            await updateRoom({ mediaUrl: '', videoPlaying: false, videoStartTimestamp: null, pausedAt: null });
            return;
        }
        await stopAppleMusic?.();
        const now = Date.now();
        if (room?.videoPlaying) {
            await updateRoom({ videoPlaying: false, pausedAt: now, appleMusicPlayback: null });
        } else {
            let newStart = room?.videoStartTimestamp || now;
            if (room?.pausedAt && room?.videoStartTimestamp) {
                const elapsedBeforePause = room.pausedAt - room.videoStartTimestamp;
                newStart = now - elapsedBeforePause;
            } else if (!room?.videoStartTimestamp) {
                newStart = now;
            }
            await updateRoom({ videoPlaying: true, videoStartTimestamp: newStart, pausedAt: null, appleMusicPlayback: null });
        }
    };
    
    // Helper to open youtube search
    const _openYT = (query) => {
        if (!query) return;
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' karaoke')}`, '_blank');
    };

    return (
        <div className="h-full flex flex-col gap-3 overflow-hidden relative">
            <QueueYouTubeSearchModal
                open={ytSearchOpen}
                styles={STYLES}
                ytSearchQ={ytSearchQ}
                setYtSearchQ={setYtSearchQ}
                ytEditingQuery={ytEditingQuery}
                setYtEditingQuery={setYtEditingQuery}
                ytLoading={ytLoading}
                ytSearchError={ytSearchError}
                ytResults={ytResults}
                embedCache={embedCache}
                searchYouTube={searchYouTube}
                testEmbedVideo={testEmbedVideo}
                selectYouTubeVideo={selectYouTubeVideo}
                onClose={() => setYtSearchOpen(false)}
                emoji={EMOJI}
            />

            <QueueEditSongModal
                open={!!editingSongId}
                styles={STYLES}
                editForm={editForm}
                setEditForm={setEditForm}
                openYtSearch={openYtSearch}
                syncEditDuration={syncEditDuration}
                generateLyrics={generateLyrics}
                onCancel={() => setEditingSongId(null)}
                onSave={saveEdit}
                emoji={EMOJI}
            />
            {commandOpen && (
                <div
                    className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm p-4 flex items-start justify-center"
                    onClick={() => setCommandOpen(false)}
                >
                    <div
                        className={`${STYLES.panel} mt-20 w-full max-w-2xl border-white/20`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                            <div className="text-xs uppercase tracking-[0.35em] text-[#00C4D9]">Command Palette</div>
                            <div className="text-[11px] text-zinc-500">Ctrl/Cmd + K</div>
                        </div>
                        <div className="p-3 border-b border-white/10">
                            <input
                                ref={commandInputRef}
                                value={commandQuery}
                                onChange={(event) => setCommandQuery(event.target.value)}
                                className={STYLES.input}
                                placeholder="Type a command..."
                            />
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {filteredCommands.length > 0 ? filteredCommands.map((command) => (
                                <button
                                    key={command.id}
                                    onClick={() => runPaletteCommand(command)}
                                    disabled={!command.enabled}
                                    className={`w-full text-left rounded-xl border px-3 py-2 transition-colors ${
                                        command.enabled
                                            ? 'border-zinc-700 bg-zinc-900/80 hover:border-[#00C4D9]/60'
                                            : 'border-zinc-800 bg-zinc-900/40 opacity-55 cursor-not-allowed'
                                    }`}
                                >
                                    <div className="text-sm font-bold text-white">{command.label}</div>
                                    <div className="text-xs text-zinc-500 mt-1">{command.hint}</div>
                                </button>
                            )) : (
                                <div className="text-sm text-zinc-500 px-2 py-3">No commands match your search.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className={`${STYLES.panel} px-3 py-2 border border-white/10 bg-black/25`}>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-400 mr-2">Quick Actions</div>
                    <button
                        onClick={() => setCommandOpen(true)}
                        data-feature-id="quick-command-palette"
                        className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-3 text-[10px]`}
                    >
                        Command Palette
                    </button>
                    <button
                        onClick={() => queue[0] && updateStatus(queue[0].id, 'performing')}
                        disabled={!queue[0]}
                        data-feature-id="quick-start-next"
                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 text-[10px] ${!queue[0] ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        Start Next
                    </button>
                    <button
                        onClick={togglePlay}
                        disabled={!current}
                        data-feature-id="quick-toggle-source"
                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 text-[10px] ${!current ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {currentSourcePlaying ? 'Pause Source' : 'Play Source'}
                    </button>
                    <button
                        onClick={() => window.open(`${appBase}?room=${roomCode}&mode=tv`, '_blank', 'noopener,noreferrer')}
                        data-feature-id="quick-open-tv"
                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-[10px]`}
                    >
                        Open TV
                    </button>
                    <button
                        onClick={openChatSettings}
                        data-feature-id="quick-chat-settings"
                        className={`${STYLES.btnStd} ${STYLES.btnInfo} px-3 text-[10px]`}
                    >
                        Chat Settings
                    </button>
                    <button
                        onClick={runUiFeatureCheck}
                        data-feature-id="quick-ui-feature-check"
                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-[10px]`}
                    >
                        UI Feature Check
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 overflow-hidden">
            {/* LEFT CONTROLS */}
            <div className="w-full md:w-96 flex-shrink-0 overflow-y-auto pr-2 custom-scrollbar">
                <div className={`${STYLES.panel} overflow-hidden`}>
                    <section className="px-4 py-4 border-b border-white/10 bg-black/30">
                        <div className={STYLES.header}>Panel Layout</div>
                        <div className="space-y-2">
                            <select
                                value={activeWorkspace}
                                onChange={(e) => applyWorkspacePreset(e.target.value)}
                                data-feature-id="layout-workspace-select"
                                className={`${STYLES.input} text-xs py-2`}
                            >
                                {workspaceOptions.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={expandAllPanels}
                                    data-feature-id="layout-expand-all"
                                    className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-2 text-[10px]`}
                                >
                                    Expand All
                                </button>
                                <button
                                    onClick={collapseAllPanels}
                                    data-feature-id="layout-collapse-all"
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 text-[10px]`}
                                >
                                    Collapse All
                                </button>
                                <button
                                    onClick={resetPanelLayout}
                                    data-feature-id="layout-reset"
                                    className={`${STYLES.btnStd} ${STYLES.btnInfo} px-2 text-[10px]`}
                                >
                                    Reset
                                </button>
                            </div>
                            <div className="text-[11px] text-zinc-500">
                                {openPanelCount}/{Object.keys(panelLayout || {}).length} panels open
                            </div>
                        </div>
                    </section>

                    <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.25em] text-[#00C4D9]/80">
                        Stage Operations
                    </div>
                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Now Playing"
                            open={stagePanelOpen}
                            onToggle={() => setStagePanelOpen(v => !v)}
                            featureId="panel-now-playing"
                        />
                        {stagePanelOpen && (
                            <StageNowPlayingPanel
                                room={room}
                                current={current}
                                hasLyrics={hasLyrics}
                                lobbyCount={lobbyCount}
                                queueCount={queueCount}
                                waitTimeSec={waitTimeSec}
                                formatWaitTime={formatWaitTime}
                                currentSourcePlaying={currentSourcePlaying}
                                currentUsesAppleBacking={currentUsesAppleBacking}
                                currentMediaUrl={currentMediaUrl}
                                currentSourceLabel={currentSourceLabel}
                                currentSourceToneClass={currentSourceToneClass}
                                appleMusicStatus={appleMusicStatus}
                                togglePlay={togglePlay}
                                playAppleMusicTrack={playAppleMusicTrack}
                                stopAppleMusic={stopAppleMusic}
                                updateRoom={updateRoom}
                                startEdit={startEdit}
                                customBonus={customBonus}
                                setCustomBonus={setCustomBonus}
                                addBonusToCurrent={addBonusToCurrent}
                                updateStatus={updateStatus}
                                styles={STYLES}
                                emoji={EMOJI}
                            />
                        )}
                    </section>
                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Automation"
                            open={automationOpen}
                            onToggle={() => setAutomationOpen(v => !v)}
                            featureId="panel-automation"
                        />
                        <AutomationControls
                            automationOpen={automationOpen}
                            autoDj={autoDj}
                            setAutoDj={setAutoDj}
                            room={room}
                            updateRoom={updateRoom}
                            autoBgMusic={autoBgMusic}
                            setAutoBgMusic={setAutoBgMusic}
                            playingBg={playingBg}
                            setBgMusicState={setBgMusicState}
                            toggleSwitch={ToggleSwitch}
                            styles={STYLES}
                        />
                    </section>

                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Soundboard"
                            open={soundboardOpen}
                            onToggle={() => setSoundboardOpen(v => !v)}
                            featureId="panel-soundboard"
                        />
                        <SoundboardControls
                            soundboardOpen={soundboardOpen}
                            sfxMuted={sfxMuted}
                            setSfxMuted={setSfxMuted}
                            silenceAll={silenceAll}
                            styles={STYLES}
                            sfxLevel={sfxLevel}
                            sfxVolume={sfxVolume}
                            setSfxVolume={setSfxVolume}
                            sounds={SOUNDS}
                            playSfxSafe={playSfxSafe}
                            smallWaveform={SmallWaveform}
                        />
                    </section>

                    <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.25em] text-[#00C4D9]/80">
                        Broadcast Controls
                    </div>
                    <section className="px-4 py-4 border-b border-white/10 space-y-3">
                        <SectionHeader
                            label="TV Dashboard Controls"
                            open={tvControlsOpen}
                            onToggle={() => setTvControlsOpen(v => !v)}
                            featureId="panel-tv-dashboard"
                        />
                        <TvDashboardControls
                            tvControlsOpen={tvControlsOpen}
                            room={room}
                            updateRoom={updateRoom}
                            toggleSwitch={ToggleSwitch}
                            styles={STYLES}
                        />
                    </section>
                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Overlays & Guides"
                            open={overlaysOpen}
                            onToggle={() => setOverlaysOpen(v => !v)}
                            featureId="panel-overlays-guides"
                        />
                        <OverlaysGuidesPanel
                            overlaysOpen={overlaysOpen}
                            room={room}
                            updateRoom={updateRoom}
                            toggleHowToPlay={toggleHowToPlay}
                            startReadyCheck={startReadyCheck}
                            marqueeEnabled={marqueeEnabled}
                            setMarqueeEnabled={setMarqueeEnabled}
                            chatShowOnTv={chatShowOnTv}
                            setChatShowOnTv={setChatShowOnTv}
                            chatUnread={chatUnread}
                            vibeSyncOpen={vibeSyncOpen}
                            setVibeSyncOpen={setVibeSyncOpen}
                            startBeatDrop={startBeatDrop}
                            startStormSequence={startStormSequence}
                            stopStormSequence={stopStormSequence}
                            styles={STYLES}
                            sectionHeader={SectionHeader}
                        />
                    </section>

                    <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.25em] text-[#00C4D9]/80">
                        Audience Controls
                    </div>
                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Chat"
                            open={chatOpen}
                            onToggle={() => setChatOpen(v => !v)}
                            featureId="panel-chat"
                        />
                        <HostChatPanel
                            chatOpen={chatOpen}
                            chatUnread={chatUnread}
                            openChatSettings={openChatSettings}
                            styles={STYLES}
                            appBase={appBase}
                            roomCode={roomCode}
                            chatEnabled={chatEnabled}
                            setChatEnabled={setChatEnabled}
                            updateRoom={updateRoom}
                            chatShowOnTv={chatShowOnTv}
                            setChatShowOnTv={setChatShowOnTv}
                            chatAudienceMode={chatAudienceMode}
                            setChatAudienceMode={setChatAudienceMode}
                            handleChatViewMode={handleChatViewMode}
                            chatViewMode={chatViewMode}
                            dmUnread={dmUnread}
                            dmTargetUid={dmTargetUid}
                            setDmTargetUid={setDmTargetUid}
                            users={users}
                            dmDraft={dmDraft}
                            setDmDraft={setDmDraft}
                            sendHostDmMessage={sendHostDmMessage}
                            roomChatMessages={roomChatMessages}
                            hostDmMessages={hostDmMessages}
                            pinnedChatIds={pinnedChatIds}
                            setPinnedChatIds={setPinnedChatIds}
                            emoji={EMOJI}
                            chatDraft={chatDraft}
                            setChatDraft={setChatDraft}
                            sendHostChat={sendHostChat}
                        />
                    </section>

                    <section className="px-4 py-4 border-b border-white/10">
                        <SectionHeader
                            label="Reward Points"
                            open={crowdPointsOpen}
                            onToggle={() => setCrowdPointsOpen(v => !v)}
                            featureId="panel-reward-points"
                        />
                        <RewardPointsPanel
                            crowdPointsOpen={crowdPointsOpen}
                            tipPointRate={tipPointRate}
                            setTipPointRate={setTipPointRate}
                            styles={STYLES}
                            giftTargetUid={giftTargetUid}
                            setGiftTargetUid={setGiftTargetUid}
                            users={users}
                            giftAmount={giftAmount}
                            setGiftAmount={setGiftAmount}
                            giftPointsToUser={giftPointsToUser}
                            dropBonus={dropBonus}
                        />
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
                        featureId="panel-add-to-queue"
                    />
                    {showAddForm && (
                        <AddToQueueFormBody
                            searchQ={searchQ}
                            setSearchQ={setSearchQ}
                            styles={STYLES}
                            quickAddOnResultClick={quickAddOnResultClick}
                            setQuickAddOnResultClick={setQuickAddOnResultClick}
                            results={results}
                            getResultRowKey={getResultRowKey}
                            quickAddLoadingKey={quickAddLoadingKey}
                            handleResultClick={handleResultClick}
                            searchSources={searchSources}
                            itunesBackoffRemaining={itunesBackoffRemaining}
                            quickAddNotice={quickAddNotice}
                            onUndoQuickAdd={undoQuickAdd}
                            onChangeQuickAddBacking={changeQuickAddBacking}
                            manual={manual}
                            setManual={setManual}
                            manualSingerMode={manualSingerMode}
                            setManualSingerMode={setManualSingerMode}
                            hostName={hostName}
                            users={users}
                            statusPill={statusPill}
                            lyricsOpen={lyricsOpen}
                            setLyricsOpen={setLyricsOpen}
                            onGenerateManualLyrics={generateManualLyrics}
                            manualBackingChip={manualBackingChip}
                            openYtSearch={openYtSearch}
                            addSong={addSong}
                        />
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    <SectionHeader
                        label="Queue"
                        open={showQueueList}
                        onToggle={() => setShowQueueList(v => !v)}
                        toneClass="text-base font-black text-[#00C4D9] px-1"
                        featureId="panel-queue-list"
                    />
                    <QueueListPanel
                        showQueueList={showQueueList}
                        pending={pending}
                        queue={queue}
                        onApprovePending={(songId) => updateStatus(songId, 'requested')}
                        onDeletePending={(songId) => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', songId))}
                        dragQueueId={dragQueueId}
                        dragOverId={dragOverId}
                        setDragQueueId={setDragQueueId}
                        setDragOverId={setDragOverId}
                        reorderQueue={reorderQueue}
                        handleTouchStart={handleTouchStart}
                        handleTouchMove={handleTouchMove}
                        handleTouchEnd={handleTouchEnd}
                        updateStatus={updateStatus}
                        startEdit={startEdit}
                        statusPill={statusPill}
                        styles={STYLES}
                    />
                </div>
            </div>
            </div>
        </div>
    );
};

// --- MAIN HOST APP COMPONENT ---
const HostApp = ({ roomCode: initialCode, uid, authError, retryAuth }) => {
    // 1. Manage roomCode locally to fix shadowing issue
    const normalizedInitialCode = (initialCode || '').trim().toUpperCase();
    const [roomCode, setRoomCode] = useState('');
    const [roomCodeInput, setRoomCodeInput] = useState(normalizedInitialCode);
    const appBase = typeof window !== 'undefined' ? `${window.location.origin}${import.meta.env.BASE_URL || '/'}` : '';
    const isChatPopout = typeof window !== 'undefined'
        && new URLSearchParams(window.location.search).get('chat') === '1';

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
        const tokenPayload = await callFunction('createAppleMusicToken', { roomCode });
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
    const stopAppleMusic = async () => {
        const instance = appleMusicRef.current;
        if (!instance) return;
        try {
            if (typeof instance.stop === 'function') {
                await instance.stop();
            } else {
                await instance.pause();
            }
        } catch (e) {
            console.warn('Apple Music stop failed', e);
        }
        setAppleMusicPlaying(false);
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
    const [view, setView] = useState('landing');
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
    const getAppleMusicUserToken = () => appleMusicRef.current?.musicUserToken || '';
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
    const [qaYtPlaylistUrl, setQaYtPlaylistUrl] = useState(() => {
        try {
            if (typeof window === 'undefined') return DEFAULT_QA_YT_PLAYLIST_URL;
            return localStorage.getItem('bross_qa_yt_playlist_url') || DEFAULT_QA_YT_PLAYLIST_URL;
        } catch {
            return DEFAULT_QA_YT_PLAYLIST_URL;
        }
    });
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
    const hallOfFameTimerRef = useRef(null);
    const [smokeRunning, setSmokeRunning] = useState(false);
    const [smokeResults, setSmokeResults] = useState([]);
    const [smokeIncludeWrite, setSmokeIncludeWrite] = useState(false);
    const layoutDefaultedRef = useRef(false);
    const [clearingRoom, setClearingRoom] = useState(false);
    const [exportingRoom, setExportingRoom] = useState(false);
    const [closingRoom, setClosingRoom] = useState(false);
    const [catalogueOnly, setCatalogueOnly] = useState(false);
    const [marqueeDraft, setMarqueeDraft] = useState('');
    const [marqueeDraftItems, setMarqueeDraftItems] = useState([]);
    const [hostName, setHostName] = useState(localStorage.getItem('bross_host_name') || 'Host');
    const [logoUrl, setLogoUrl] = useState('');
    const [logoLibrary, setLogoLibrary] = useState([]);
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoUploadProgress, setLogoUploadProgress] = useState(0);
    const logoInputRef = useRef(null);
    const autoJoinAttemptedRef = useRef(false);
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
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [joiningRoom, setJoiningRoom] = useState(false);
    const [orgContext, setOrgContext] = useState({
        orgId: '',
        role: 'owner',
        planId: 'free',
        status: 'inactive',
        provider: 'internal',
        renewalAtMs: 0,
        cancelAtPeriodEnd: false,
        capabilities: {},
        loading: false,
        error: ''
    });
    const [billingActionLoading, setBillingActionLoading] = useState(false);
    const [subscriptionActionLoading, setSubscriptionActionLoading] = useState('');
    const [usageSummary, setUsageSummary] = useState({
        orgId: '',
        period: '',
        meters: {},
        totals: { estimatedOverageCents: 0 },
        loading: false,
        error: ''
    });
    const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [onboardingBusy, setOnboardingBusy] = useState(false);
    const [onboardingError, setOnboardingError] = useState('');
    const [onboardingHostName, setOnboardingHostName] = useState(localStorage.getItem('bross_host_name') || 'Host');
    const [onboardingWorkspaceName, setOnboardingWorkspaceName] = useState('');
    const [onboardingPlanId, setOnboardingPlanId] = useState('host_monthly');
    const [onboardingLogoUrl, setOnboardingLogoUrl] = useState(ASSETS.logo);
    const planLabel = useMemo(() => {
        const labels = {
            free: 'Free',
            vip_monthly: 'VIP Monthly',
            host_monthly: 'Host Monthly',
            host_annual: 'Host Annual'
        };
        return labels[orgContext?.planId] || (orgContext?.planId || 'free');
    }, [orgContext?.planId]);
    const renewalLabel = useMemo(() => {
        const ms = Number(orgContext?.renewalAtMs || 0);
        if (!ms) return 'Not scheduled';
        return new Date(ms).toLocaleDateString();
    }, [orgContext?.renewalAtMs]);
    const onboardingPlanLabel = useMemo(() => {
        const found = HOST_ONBOARDING_PLAN_OPTIONS.find(p => p.id === onboardingPlanId);
        return found?.label || onboardingPlanId || 'Free';
    }, [onboardingPlanId]);
    const onboardingHasActiveSubscription = useMemo(() => {
        const status = String(orgContext?.status || '').toLowerCase();
        return ['active', 'trialing', 'past_due'].includes(status);
    }, [orgContext?.status]);
    const usageMeters = useMemo(() => {
        const meters = Object.values(usageSummary?.meters || {});
        return meters.sort((a, b) => String(a?.label || '').localeCompare(String(b?.label || '')));
    }, [usageSummary?.meters]);
    const aiUsageMeter = useMemo(() => usageSummary?.meters?.ai_generate_content || null, [usageSummary?.meters]);
    const usageHardLimitHits = useMemo(() => {
        return usageMeters.filter(meter => !!meter?.hardLimitReached);
    }, [usageMeters]);
    const usagePeriodLabel = useMemo(() => {
        const key = String(usageSummary?.period || '');
        if (!/^\d{6}$/.test(key)) return '--';
        const year = Number(key.slice(0, 4));
        const monthIndex = Number(key.slice(4, 6)) - 1;
        return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }, [usageSummary?.period]);
    const logoChoices = useMemo(() => {
        const merged = [...DEFAULT_LOGO_PRESETS];
        (logoLibrary || []).forEach((url, idx) => {
            if (typeof url !== 'string') return;
            const cleaned = url.trim();
            if (!cleaned) return;
            merged.push({
                id: `custom-${idx}-${cleaned.slice(-24)}`,
                label: `Custom ${idx + 1}`,
                url: cleaned
            });
        });
        const seen = new Set();
        return merged.filter(item => {
            if (!item?.url || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        });
    }, [logoLibrary]);

    useEffect(() => {
        let cancelled = false;
        if (!uid) {
            setOrgContext(prev => ({
                ...prev,
                loading: false,
                error: '',
                orgId: '',
                planId: 'free',
                status: 'inactive',
                provider: 'internal',
                renewalAtMs: 0,
                cancelAtPeriodEnd: false,
                capabilities: {}
            }));
            setUsageSummary({
                orgId: '',
                period: '',
                meters: {},
                totals: { estimatedOverageCents: 0 },
                loading: false,
                error: ''
            });
            return () => { cancelled = true; };
        }
        (async () => {
            setOrgContext(prev => ({ ...prev, loading: true, error: '' }));
            setUsageSummary(prev => ({ ...prev, loading: true, error: '' }));
            try {
                await ensureOrganization('');
                const entitlements = await getMyEntitlements();
                const usage = await getMyUsageSummary();
                if (cancelled) return;
                setOrgContext({
                    orgId: entitlements?.orgId || '',
                    role: entitlements?.role || 'owner',
                    planId: entitlements?.planId || 'free',
                    status: entitlements?.status || 'inactive',
                    provider: entitlements?.provider || 'internal',
                    renewalAtMs: Number(entitlements?.renewalAtMs || 0),
                    cancelAtPeriodEnd: !!entitlements?.cancelAtPeriodEnd,
                    capabilities: entitlements?.capabilities || {},
                    loading: false,
                    error: ''
                });
                setUsageSummary({
                    orgId: usage?.orgId || entitlements?.orgId || '',
                    period: usage?.period || '',
                    meters: usage?.meters || {},
                    totals: usage?.totals || { estimatedOverageCents: 0 },
                    loading: false,
                    error: ''
                });
            } catch (e) {
                console.error('Failed to sync org entitlements', e);
                if (cancelled) return;
                setOrgContext(prev => ({ ...prev, loading: false, error: 'Could not load subscription entitlements.' }));
                setUsageSummary(prev => ({ ...prev, loading: false, error: 'Could not load usage summary.' }));
            }
        })();
        return () => { cancelled = true; };
    }, [uid]);

    useEffect(() => {
        if (!onboardingWorkspaceName.trim()) {
            const baseHost = onboardingHostName.trim() || hostName.trim() || 'Host';
            setOnboardingWorkspaceName(`${baseHost} Workspace`);
        }
    }, [hostName, onboardingHostName, onboardingWorkspaceName]);

    useEffect(() => {
        if (!showOnboardingWizard) {
            setOnboardingLogoUrl((logoUrl || ASSETS.logo || '').trim() || ASSETS.logo);
        }
    }, [logoUrl, showOnboardingWizard]);

    useEffect(() => {
        try {
            localStorage.setItem('bross_qa_yt_playlist_url', qaYtPlaylistUrl || DEFAULT_QA_YT_PLAYLIST_URL);
        } catch {
            // Ignore storage failures (private mode / quota).
        }
    }, [qaYtPlaylistUrl]);

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
    const {
        chatEnabled,
        setChatEnabled,
        chatShowOnTv,
        setChatShowOnTv,
        chatTvMode,
        setChatTvMode,
        chatSlowModeSec,
        setChatSlowModeSec,
        chatAudienceMode,
        setChatAudienceMode,
        chatDraft,
        setChatDraft,
        dmTargetUid,
        setDmTargetUid,
        dmDraft,
        setDmDraft,
        chatMessages,
        pinnedChatIds,
        setPinnedChatIds,
        chatUnread,
        dmUnread,
        chatViewMode,
        handleChatViewMode,
        sendHostChat,
        sendHostDmMessage,
        markChatTabSeen
    } = useHostChat({
        roomCode,
        room,
        settingsTab,
        hostName,
        toast
    });
    const roomChatMessages = chatMessages.filter(msg => !msg.toHost);
    const hostDmMessages = chatMessages.filter(msg => msg.toHost || msg.toUid);

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
            runCheck('User profile read (/users/{uid})', async () => {
                const userRef = doc(db, 'users', uid);
                const snap = await getDoc(userRef);
                if (!snap.exists()) return 'Missing profile doc';
                return 'OK';
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
            checks.push(runCheck('User profile write (/users/{uid})', async () => {
                const userRef = doc(db, 'users', uid);
                await setDoc(userRef, { smokeUpdatedAt: serverTimestamp() }, { merge: true });
                return 'OK';
            }));
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
        setLogoUrl(room.logoUrl || '');
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
        if (!room || layoutDefaultedRef.current) return;
        if (!room.layoutMode) {
            layoutDefaultedRef.current = true;
            updateRoom({ layoutMode: 'standard' }).catch(() => {});
            return;
        }
        layoutDefaultedRef.current = true;
    }, [room?.layoutMode, roomCode]);
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

    const ensureActiveUid = async () => {
        let activeUid = auth.currentUser?.uid || uid || null;
        if (!activeUid && typeof retryAuth === 'function') {
            await retryAuth();
            activeUid = auth.currentUser?.uid || null;
        }
        if (!activeUid) {
            const authResult = await initAuth();
            if (!authResult?.ok) {
                throw authResult?.error || new Error('Auth initialization failed');
            }
            activeUid = auth.currentUser?.uid || null;
        }
        return activeUid;
    };

    const syncOrgContextFromEntitlements = (entitlements = {}) => {
        setOrgContext(prev => ({
            ...prev,
            orgId: entitlements?.orgId || prev.orgId || '',
            role: entitlements?.role || prev.role || 'owner',
            planId: entitlements?.planId || prev.planId || 'free',
            status: entitlements?.status || prev.status || 'inactive',
            provider: entitlements?.provider || prev.provider || 'internal',
            renewalAtMs: Number(entitlements?.renewalAtMs || prev.renewalAtMs || 0),
            cancelAtPeriodEnd: typeof entitlements?.cancelAtPeriodEnd === 'boolean'
                ? entitlements.cancelAtPeriodEnd
                : !!prev.cancelAtPeriodEnd,
            capabilities: entitlements?.capabilities || prev.capabilities || {},
            loading: false,
            error: ''
        }));
    };

    const openOnboardingWizard = () => {
        const seededHost = (hostName || '').trim() || 'Host';
        const seededLogo = (logoUrl || ASSETS.logo || '').trim() || ASSETS.logo;
        const allowedPlanIds = new Set(['free', 'host_monthly', 'host_annual']);
        const seededPlan = allowedPlanIds.has(orgContext?.planId) ? orgContext.planId : 'host_monthly';
        setOnboardingHostName(seededHost);
        setOnboardingWorkspaceName((onboardingWorkspaceName || '').trim() || `${seededHost} Workspace`);
        setOnboardingPlanId(seededPlan);
        setOnboardingLogoUrl(seededLogo);
        setOnboardingError('');
        setOnboardingStep(0);
        setShowOnboardingWizard(true);
    };

    const closeOnboardingWizard = () => {
        if (onboardingBusy || creatingRoom || subscriptionActionLoading) return;
        setShowOnboardingWizard(false);
        setOnboardingStep(0);
        setOnboardingError('');
    };

    const provisionOnboardingWorkspace = async () => {
        const trimmedHost = onboardingHostName.trim();
        const trimmedWorkspace = onboardingWorkspaceName.trim();
        if (!trimmedHost) {
            setOnboardingError('Host name is required.');
            return;
        }
        if (!trimmedWorkspace) {
            setOnboardingError('Workspace name is required.');
            return;
        }
        setOnboardingBusy(true);
        setOnboardingError('');
        try {
            const activeUid = await ensureActiveUid();
            if (!activeUid) {
                throw new Error('Auth unavailable');
            }
            await ensureOrganization(trimmedWorkspace);
            const entitlements = await getMyEntitlements();
            syncOrgContextFromEntitlements(entitlements);
            setHostName(trimmedHost);
            localStorage.setItem('bross_host_name', trimmedHost);
            setOnboardingStep(1);
        } catch (e) {
            console.error('Onboarding workspace provision failed', e);
            setOnboardingError('Could not initialize workspace. Please retry.');
        } finally {
            setOnboardingBusy(false);
        }
    };

    const launchOnboardingRoom = async () => {
        const trimmedHost = onboardingHostName.trim();
        const trimmedWorkspace = onboardingWorkspaceName.trim();
        const trimmedLogo = onboardingLogoUrl.trim();
        if (!trimmedHost || !trimmedWorkspace) {
            setOnboardingError('Identity and workspace details are required before launch.');
            setOnboardingStep(0);
            return;
        }
        setOnboardingError('');
        await createRoom({
            hostName: trimmedHost,
            orgName: trimmedWorkspace,
            logoUrl: trimmedLogo || ASSETS.logo
        });
    };

    const joinRoom = async (candidateCode) => {
        if (joiningRoom) return;
        const code = (candidateCode || roomCodeInput || '').trim().toUpperCase();
        if (!code) {
            toast('Enter a room code first');
            return;
        }

        setJoiningRoom(true);
        try {
            const activeUid = await ensureActiveUid();
            if (!activeUid) {
                toast('Could not establish auth. Please retry.');
                return;
            }
            const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', code);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) {
                toast(`Room ${code} not found`);
                return;
            }

            setRoomCode(code);
            setRoomCodeInput(code);
            setView('panel');
        } catch (e) {
            const code = e?.code || '';
            if (code.includes('permission-denied')) {
                toast('Permission denied while opening room. Re-authenticate and try again.');
            } else if (code.includes('unauthenticated')) {
                toast('You are signed out. Please retry auth, then open room again.');
            } else {
                toast(`Failed to open room${code ? ` (${code})` : ''}`);
            }
        } finally {
            setJoiningRoom(false);
        }
    };

    const createRoom = async (options = {}) => {
        if (creatingRoom) return;
        const hostNameOverride = typeof options?.hostName === 'string' ? options.hostName.trim() : '';
        const orgNameOverride = typeof options?.orgName === 'string' ? options.orgName.trim() : '';
        const logoUrlOverride = typeof options?.logoUrl === 'string' ? options.logoUrl.trim() : '';
        const nextHostName = hostNameOverride || (hostName || '').trim() || 'Host';
        const nextOrgName = orgNameOverride || `${nextHostName} Workspace`;
        const nextLogoUrl = logoUrlOverride || (logoUrl || '').trim() || ASSETS.logo;
        setCreatingRoom(true);
        try {
            const activeUid = await ensureActiveUid();
            if (!activeUid) {
                toast('Could not establish auth. Please retry.');
                return;
            }
            setHostName(nextHostName);
            setLogoUrl(nextLogoUrl);
            localStorage.setItem('bross_host_name', nextHostName);

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

            let activeOrgId = orgContext?.orgId || '';
            if (!activeOrgId) {
                try {
                    await ensureOrganization(nextOrgName || 'BROSS Workspace');
                    const entitlements = await getMyEntitlements();
                    activeOrgId = entitlements?.orgId || '';
                    syncOrgContextFromEntitlements(entitlements);
                } catch (orgErr) {
                    console.warn('Organization bootstrap failed during room create', orgErr);
                }
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
                hostName: nextHostName,
                hostUid: activeUid,
                hostUids: [activeUid],
                orgId: activeOrgId || null,
                orgName: nextOrgName,
                logoUrl: nextLogoUrl,
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
                chatTvMode: 'auto',
                chatSlowModeSec: 0,
                chatAudienceMode: 'all'
            });
            trackEvent('host_room_created', { room_code: c });
            setRoomCode(c);
            setRoomCodeInput(c);
            setView('panel');
            setShowOnboardingWizard(false);
            toast(`Room ${c} created`);
            setDoc(
                doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', c),
                { ytIndex: [], logoLibrary: [], updatedAt: serverTimestamp() },
                { merge: true }
            ).catch((seedErr) => {
                console.warn('Room created but host library seed failed', seedErr);
            });
        } catch (e) {
            console.error('Failed to create room', {
                error: e,
                propUid: uid || null,
                authUid: auth.currentUser?.uid || null
            });
            const code = e?.code || '';
            if (code.includes('permission-denied')) {
                toast('Permission denied while creating room. Re-authenticate and try again.');
            } else if (code.includes('unauthenticated')) {
                toast('You are signed out. Please retry auth, then create room again.');
            } else {
                toast(`Failed to create room${code ? ` (${code})` : ''}`);
            }
        } finally {
            setCreatingRoom(false);
        }
    };

    useEffect(() => {
        if (!normalizedInitialCode || autoJoinAttemptedRef.current) return;
        autoJoinAttemptedRef.current = true;
        setRoomCodeInput(normalizedInitialCode);
        joinRoom(normalizedInitialCode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [normalizedInitialCode]);

    const updateRoom = async (d) => updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), d);
    const toggleHowToPlay = async () => {
        const active = !room?.howToPlay?.active;
        await updateRoom({ howToPlay: { active, id: Date.now() } });
    };
    const saveLogoUrl = async (nextLogoUrl = logoUrl) => {
        const trimmed = (nextLogoUrl || '').trim();
        setLogoUrl(trimmed);
        if (!roomCode) {
            toast('Create or open a room first');
            return;
        }
        await updateRoom({ logoUrl: trimmed || null });
        toast('Logo updated');
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
            await callFunction('awardRoomPoints', { roomCode, awards: [{ uid: targetUid, points: amount }] });
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
            await callFunction('awardRoomPoints', { roomCode, awards: [{ uid: tipUserId, points }] });
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
                logoUrl: logoUrl?.trim() || null,
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

    const persistLogoLibrary = async (next) => {
        const cleaned = Array.from(new Set((next || [])
            .filter(url => typeof url === 'string')
            .map(url => url.trim())
            .filter(Boolean)))
            .slice(0, 24);
        setLogoLibrary(cleaned);
        if (!roomCode) return;
        await setDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode),
            { logoLibrary: cleaned, updatedAt: serverTimestamp() },
            { merge: true }
        );
    };

    const uploadLogoFile = async (file) => {
        if (!roomCode) {
            toast('Create or open a room first');
            return;
        }
        if (!file) return;
        if (!file.type?.startsWith('image/')) {
            toast('Please select an image file');
            return;
        }
        const maxBytes = 12 * 1024 * 1024;
        if (file.size > maxBytes) {
            toast('Logo is too large (max 12 MB)');
            return;
        }
        setLogoUploading(true);
        setLogoUploadProgress(0);
        try {
            const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
            const stem = (file.name.replace(/\.[^/.]+$/, '') || 'logo')
                .toLowerCase()
                .replace(/[^a-z0-9_-]+/g, '-')
                .replace(/-+/g, '-')
                .slice(0, 60);
            const storagePath = `room_branding/${roomCode}/${Date.now()}-${stem}.${ext}`;
            const fileRef = storageRef(storage, storagePath);
            const task = uploadBytesResumable(fileRef, file, {
                contentType: file.type,
                cacheControl: 'public,max-age=604800'
            });
            await new Promise((resolve, reject) => {
                task.on('state_changed', (snap) => {
                    const progress = snap.totalBytes
                        ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
                        : 0;
                    setLogoUploadProgress(progress);
                }, reject, resolve);
            });
            const url = await getDownloadURL(fileRef);
            setLogoUrl(url);
            await persistLogoLibrary([url, ...logoLibrary]);
            await updateRoom({ logoUrl: url });
            toast('Logo uploaded and applied');
        } catch (e) {
            console.error('Logo upload failed', e);
            toast('Logo upload failed');
        } finally {
            setLogoUploading(false);
            setLogoUploadProgress(0);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const removeCustomLogo = async (url) => {
        if (!url) return;
        const next = logoLibrary.filter(item => item !== url);
        await persistLogoLibrary(next);
        if ((logoUrl || '').trim() === url) {
            setLogoUrl('');
            await updateRoom({ logoUrl: null });
        }
        toast('Custom logo removed');
    };

    useEffect(() => {
        if (!roomCode) return;
        const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), s => {
            const data = s.data() || {};
            if (Array.isArray(data.ytIndex)) setYtIndex(data.ytIndex);
            if (Array.isArray(data.logoLibrary)) {
                setLogoLibrary(data.logoLibrary
                    .filter(url => typeof url === 'string')
                    .map(url => url.trim())
                    .filter(Boolean));
            } else {
                setLogoLibrary([]);
            }
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
        const queuePlayback = resolveQueuePlayback(next, activeRoom?.autoPlayMedia !== false);
        const nextMediaUrl = queuePlayback.mediaUrl;
        const useAppleBacking = queuePlayback.usesAppleBacking;
        const autoStartMedia = queuePlayback.autoStartMedia;
        if (useAppleBacking && autoStartMedia) {
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
            await stopAppleMusic();
            await updateRoom({
                activeMode: 'karaoke',
                'announcement.active': false,
                mediaUrl: nextMediaUrl,
                singAlongMode: false,
                videoPlaying: autoStartMedia && !!nextMediaUrl,
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
    const openChatSettings = () => {
        setShowSettings(true);
        setSettingsTab('chat');
    };
    const refreshBillingEntitlements = async (showToast = false) => {
        setOrgContext(prev => ({ ...prev, loading: true, error: '' }));
        try {
            await ensureOrganization('');
            const entitlements = await getMyEntitlements();
            syncOrgContextFromEntitlements(entitlements);
            await refreshUsageSummary(false);
            if (showToast) toast('Billing status refreshed');
            return entitlements;
        } catch (e) {
            console.error('Billing entitlement refresh failed', e);
            setOrgContext(prev => ({ ...prev, loading: false, error: 'Could not refresh billing status.' }));
            if (showToast) toast('Could not refresh billing status');
            return null;
        }
    };
    const refreshUsageSummary = async (showToast = false) => {
        setUsageSummary(prev => ({ ...prev, loading: true, error: '' }));
        try {
            const usage = await getMyUsageSummary();
            setUsageSummary({
                orgId: usage?.orgId || orgContext?.orgId || '',
                period: usage?.period || '',
                meters: usage?.meters || {},
                totals: usage?.totals || { estimatedOverageCents: 0 },
                loading: false,
                error: ''
            });
            if (showToast) toast('Usage summary refreshed');
            return usage;
        } catch (e) {
            console.error('Usage summary refresh failed', e);
            setUsageSummary(prev => ({ ...prev, loading: false, error: 'Could not refresh usage summary.' }));
            if (showToast) toast('Could not refresh usage summary');
            return null;
        }
    };
    const openSubscriptionCheckout = async (planId, orgNameOverride = '') => {
        if (subscriptionActionLoading) return;
        setSubscriptionActionLoading(planId);
        try {
            const safeOrgName = String(orgNameOverride || onboardingWorkspaceName || hostName || 'BROSS Workspace').trim() || 'BROSS Workspace';
            const payload = await callFunction('createSubscriptionCheckout', {
                planId,
                origin: window.location.origin,
                orgName: safeOrgName
            });
            if (payload?.url) {
                window.location.href = payload.url;
                return;
            }
            toast('Subscription checkout is unavailable right now.');
        } catch (e) {
            console.error('Subscription checkout failed', e);
            toast('Could not open subscription checkout');
        } finally {
            setSubscriptionActionLoading('');
        }
    };
    const openBillingPortal = async () => {
        if (billingActionLoading) return;
        setBillingActionLoading(true);
        try {
            const payload = await callFunction('createSubscriptionPortalSession', {
                origin: window.location.origin
            });
            if (payload?.url) {
                window.location.href = payload.url;
                return;
            }
            toast('Billing portal is unavailable right now.');
        } catch (e) {
            console.error('Billing portal launch failed', e);
            const code = String(e?.code || '').toLowerCase();
            if (code.includes('failed-precondition')) {
                toast('No billing profile yet. Start a subscription first.');
            } else if (code.includes('permission-denied')) {
                toast('Only workspace owners/admins can manage billing.');
            } else {
                toast('Could not open billing portal');
            }
        } finally {
            setBillingActionLoading(false);
        }
    };
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const subscriptionStatus = String(params.get('subscription') || '').toLowerCase();
        const billingStatus = String(params.get('billing') || '').toLowerCase();
        if (!subscriptionStatus && !billingStatus) return;

        if (subscriptionStatus === 'success') {
            toast('Subscription checkout completed. Refreshing billing status...');
            setShowOnboardingWizard(true);
            setOnboardingStep(1);
        } else if (subscriptionStatus === 'cancel') {
            toast('Subscription checkout canceled.');
        } else if (billingStatus === 'return') {
            toast('Returned from billing portal. Refreshing billing status...');
        }

        getMyEntitlements()
            .then((entitlements) => {
                syncOrgContextFromEntitlements(entitlements);
                return getMyUsageSummary();
            })
            .then((usage) => {
                if (!usage) return;
                setUsageSummary({
                    orgId: usage?.orgId || orgContext?.orgId || '',
                    period: usage?.period || '',
                    meters: usage?.meters || {},
                    totals: usage?.totals || { estimatedOverageCents: 0 },
                    loading: false,
                    error: ''
                });
            })
            .catch((e) => {
                console.warn('Post-billing refresh failed', e);
            });

        params.delete('subscription');
        params.delete('billing');
        params.delete('org');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
        window.history.replaceState({}, '', nextUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
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
                    onClick={openOnboardingWizard}
                    className={`${STYLES.btnStd} ${STYLES.btnPrimary} w-full py-4 text-lg mb-3`}
                >
                    SET UP WORKSPACE (WIZARD)
                </button>
                <button
                    onClick={() => createRoom()}
                    disabled={creatingRoom}
                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} w-full py-3 text-base mb-4 ${creatingRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {creatingRoom ? 'CREATING ROOM...' : 'QUICK START NEW ROOM'}
                </button> 
                {!uid && authError && (
                    <div className="mb-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                        Auth failed: {authError.code || authError.message || 'Unknown error'}
                        {retryAuth && (
                            <button onClick={retryAuth} className="ml-2 underline text-red-200">Retry</button>
                        )}
                    </div>
                )}
                <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Join Existing Room</div>
                <div className="flex gap-2 justify-center"> 
                    <input
                        value={roomCodeInput}
                        onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') joinRoom();
                        }}
                        placeholder="CODE"
                        className={`${STYLES.input} text-center text-lg font-mono w-full`}
                    /> 
                    <button
                        onClick={() => joinRoom()}
                        disabled={joiningRoom}
                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-6 ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {joiningRoom ? 'Joining...' : 'Join'}
                    </button> 
                </div>
                <div className="mt-3 text-xs text-zinc-500">
                    Workspace: <span className="font-mono text-zinc-300">{orgContext?.orgId || 'not-initialized'}</span>
                    {' '}| Plan: <span className="text-zinc-300">{planLabel}</span>
                </div>
                <div className="mt-6 text-xs text-zinc-500 font-mono tracking-widest">{VERSION}</div> 
            </div>
            {showOnboardingWizard && (
                <div className="fixed inset-0 z-[95] bg-black/80 flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden text-left">
                        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm uppercase tracking-widest text-zinc-500">Turnkey Setup</div>
                                <div className="text-xl font-bold text-white">Workspace Onboarding</div>
                            </div>
                            <button
                                onClick={closeOnboardingWizard}
                                disabled={onboardingBusy || creatingRoom}
                                className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}
                            >
                                Close
                            </button>
                        </div>
                        <div className="px-5 py-4 border-b border-zinc-800 flex flex-wrap gap-2">
                            {HOST_ONBOARDING_STEPS.map((step, idx) => (
                                <button
                                    key={step.key}
                                    onClick={() => {
                                        if (onboardingBusy || creatingRoom) return;
                                        if (idx > onboardingStep) return;
                                        setOnboardingStep(idx);
                                        setOnboardingError('');
                                    }}
                                    className={`px-3 py-1 rounded-full border text-xs uppercase tracking-widest ${
                                        idx === onboardingStep
                                            ? 'bg-[#00C4D9]/20 text-[#00C4D9] border-[#00C4D9]/40'
                                            : idx < onboardingStep
                                                ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30'
                                                : 'bg-zinc-900 text-zinc-500 border-zinc-700'
                                    }`}
                                >
                                    {idx + 1}. {step.label}
                                </button>
                            ))}
                        </div>
                        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                            {onboardingError && (
                                <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
                                    {onboardingError}
                                </div>
                            )}
                            {onboardingStep === 0 && (
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Host Name</div>
                                        <input
                                            value={onboardingHostName}
                                            onChange={e => setOnboardingHostName(e.target.value)}
                                            className={STYLES.input}
                                            placeholder="Host name"
                                        />
                                    </div>
                                    <div>
                                        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-1">Workspace Name</div>
                                        <input
                                            value={onboardingWorkspaceName}
                                            onChange={e => setOnboardingWorkspaceName(e.target.value)}
                                            className={STYLES.input}
                                            placeholder="Workspace name"
                                        />
                                    </div>
                                    <div className="host-form-helper">This creates/updates your organization record used for billing and entitlements.</div>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={provisionOnboardingWorkspace}
                                            disabled={onboardingBusy}
                                            className={`${STYLES.btnStd} ${STYLES.btnPrimary} ${onboardingBusy ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        >
                                            {onboardingBusy ? 'Initializing...' : 'Continue to Plan'}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {onboardingStep === 1 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {HOST_ONBOARDING_PLAN_OPTIONS.map((option) => (
                                            <button
                                                key={option.id}
                                                onClick={() => setOnboardingPlanId(option.id)}
                                                className={`text-left rounded-xl border p-3 transition-colors ${
                                                    onboardingPlanId === option.id
                                                        ? 'border-[#00C4D9]/60 bg-[#00C4D9]/10'
                                                        : 'border-zinc-700 bg-zinc-950/70 hover:border-zinc-500'
                                                }`}
                                            >
                                                <div className="text-white font-semibold">{option.label}</div>
                                                <div className="text-zinc-300 text-sm">{option.price}</div>
                                                <div className="text-zinc-500 text-xs mt-2">{option.note}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="text-sm text-zinc-300">
                                        Current plan: <span className="text-white font-semibold">{planLabel}</span>
                                        {' '}({orgContext?.status || 'inactive'})
                                    </div>
                                    {onboardingPlanId !== 'free' && (
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => openSubscriptionCheckout(onboardingPlanId, onboardingWorkspaceName)}
                                                disabled={!!subscriptionActionLoading}
                                                className={`${STYLES.btnStd} ${STYLES.btnPrimary} ${subscriptionActionLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                {subscriptionActionLoading === onboardingPlanId ? 'Opening checkout...' : 'Open Checkout'}
                                            </button>
                                            <button
                                                onClick={() => refreshBillingEntitlements(true)}
                                                disabled={orgContext.loading}
                                                className={`${STYLES.btnStd} ${STYLES.btnNeutral} ${orgContext.loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                {orgContext.loading ? 'Refreshing...' : 'I already paid - Refresh'}
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex justify-between gap-2">
                                        <button
                                            onClick={() => setOnboardingStep(0)}
                                            className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={() => {
                                                setOnboardingError('');
                                                setOnboardingStep(2);
                                            }}
                                            className={`${STYLES.btnStd} ${STYLES.btnPrimary}`}
                                        >
                                            Continue to Branding
                                        </button>
                                    </div>
                                    {!onboardingHasActiveSubscription && onboardingPlanId !== 'free' && (
                                        <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2">
                                            Subscription is not active yet. You can continue setup now and activate billing later.
                                        </div>
                                    )}
                                </div>
                            )}
                            {onboardingStep === 2 && (
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Default Logo</div>
                                        <div className="flex items-center gap-3 mb-3">
                                            <img src={onboardingLogoUrl || ASSETS.logo} alt="Onboarding logo preview" className="w-20 h-20 object-contain rounded-lg border border-zinc-700 bg-zinc-950 p-2" />
                                            <div className="text-sm text-zinc-400">This logo becomes your initial room branding and can be changed later in settings.</div>
                                        </div>
                                        <input
                                            value={onboardingLogoUrl}
                                            onChange={e => setOnboardingLogoUrl(e.target.value)}
                                            className={STYLES.input}
                                            placeholder="Custom logo URL (optional)"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {logoChoices.slice(0, 9).map(choice => (
                                            <button
                                                key={`wizard-logo-${choice.id}`}
                                                onClick={() => setOnboardingLogoUrl(choice.url)}
                                                className={`rounded-lg border p-2 flex flex-col items-center gap-2 ${
                                                    onboardingLogoUrl === choice.url
                                                        ? 'border-[#00C4D9]/60 bg-[#00C4D9]/10'
                                                        : 'border-zinc-700 bg-zinc-950/70'
                                                }`}
                                            >
                                                <img src={choice.url} alt={choice.label} className="w-16 h-16 object-contain bg-zinc-950 rounded-md p-1" />
                                                <div className="text-[10px] text-zinc-400 text-center">{choice.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex justify-between gap-2">
                                        <button
                                            onClick={() => setOnboardingStep(1)}
                                            className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={() => setOnboardingStep(3)}
                                            className={`${STYLES.btnStd} ${STYLES.btnPrimary}`}
                                        >
                                            Continue to Launch
                                        </button>
                                    </div>
                                </div>
                            )}
                            {onboardingStep === 3 && (
                                <div className="space-y-4">
                                    <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 space-y-2 text-sm">
                                        <div className="flex justify-between gap-2">
                                            <span className="text-zinc-500">Host</span>
                                            <span className="text-white font-semibold">{onboardingHostName || 'Host'}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-zinc-500">Workspace</span>
                                            <span className="text-white font-semibold">{onboardingWorkspaceName || '--'}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-zinc-500">Plan</span>
                                            <span className="text-white font-semibold">{onboardingPlanLabel}</span>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <span className="text-zinc-500">Billing Status</span>
                                            <span className="text-white font-semibold">{orgContext?.status || 'inactive'}</span>
                                        </div>
                                    </div>
                                    <div className="text-sm text-zinc-400">Launch creates your first room with these defaults and opens the Host control panel.</div>
                                    <div className="flex justify-between gap-2">
                                        <button
                                            onClick={() => setOnboardingStep(2)}
                                            className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={launchOnboardingRoom}
                                            disabled={creatingRoom}
                                            className={`${STYLES.btnStd} ${STYLES.btnHighlight} ${creatingRoom ? 'opacity-70 cursor-not-allowed' : ''}`}
                                        >
                                            {creatingRoom ? 'Launching...' : 'Launch First Room'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
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
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
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

    const queueTabProps = {
        songs,
        room,
        roomCode,
        appBase,
        updateRoom,
        logActivity,
        localLibrary,
        playSfxSafe,
        toggleHowToPlay,
        startStormSequence,
        stopStormSequence,
        startBeatDrop,
        users,
        dropBonus,
        giftPointsToUser,
        tipPointRate,
        setTipPointRate,
        marqueeEnabled,
        setMarqueeEnabled,
        sfxMuted,
        setSfxMuted,
        sfxLevel,
        sfxVolume,
        setSfxVolume,
        searchSources,
        setSearchSources,
        ytIndex,
        setYtIndex,
        persistYtIndex,
        autoDj,
        setAutoDj,
        autoBgMusic,
        setAutoBgMusic,
        playingBg,
        setBgMusicState,
        startReadyCheck,
        chatShowOnTv,
        setChatShowOnTv,
        chatUnread,
        dmUnread,
        chatEnabled,
        setChatEnabled,
        chatAudienceMode,
        setChatAudienceMode,
        chatDraft,
        setChatDraft,
        chatMessages,
        sendHostChat,
        sendHostDmMessage,
        itunesBackoffRemaining,
        pinnedChatIds,
        setPinnedChatIds,
        chatViewMode,
        handleChatViewMode,
        appleMusicPlaying,
        appleMusicStatus,
        playAppleMusicTrack,
        pauseAppleMusic,
        resumeAppleMusic,
        stopAppleMusic,
        autoDjCountdown,
        hostName,
        fetchTop100Art,
        openChatSettings,
        dmTargetUid,
        setDmTargetUid,
        dmDraft,
        setDmDraft,
        getAppleMusicUserToken,
        silenceAll
    };

    if (isChatPopout) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-saira p-4 md:p-6">
                <div className={`${STYLES.panel} p-4 md:p-6 max-w-5xl mx-auto`}>
                    <HostChatPanel
                        chatOpen={true}
                        chatUnread={chatUnread}
                        openChatSettings={openChatSettings}
                        styles={STYLES}
                        appBase={appBase}
                        roomCode={roomCode}
                        chatEnabled={chatEnabled}
                        setChatEnabled={setChatEnabled}
                        updateRoom={updateRoom}
                        chatShowOnTv={chatShowOnTv}
                        setChatShowOnTv={setChatShowOnTv}
                        chatAudienceMode={chatAudienceMode}
                        setChatAudienceMode={setChatAudienceMode}
                        handleChatViewMode={handleChatViewMode}
                        chatViewMode={chatViewMode}
                        dmUnread={dmUnread}
                        dmTargetUid={dmTargetUid}
                        setDmTargetUid={setDmTargetUid}
                        users={users}
                        dmDraft={dmDraft}
                        setDmDraft={setDmDraft}
                        sendHostDmMessage={sendHostDmMessage}
                        roomChatMessages={roomChatMessages}
                        hostDmMessages={hostDmMessages}
                        pinnedChatIds={pinnedChatIds}
                        setPinnedChatIds={setPinnedChatIds}
                        emoji={EMOJI}
                        chatDraft={chatDraft}
                        setChatDraft={setChatDraft}
                        sendHostChat={sendHostChat}
                        showSettingsButton={false}
                        showPopoutButton={false}
                    />
                </div>
            </div>
        );
    }

    return (
            <div className="host-app min-h-screen md:h-screen flex flex-col relative bg-zinc-950 text-white font-saira overflow-y-auto md:overflow-hidden">
                {/* Header */}
                <HostTopChrome
                    room={room}
                    appBase={appBase}
                    roomCode={roomCode}
                    gamesMeta={GAMES_META}
                    tab={tab}
                    setTab={setTab}
                    showLaunchMenu={showLaunchMenu}
                    setShowLaunchMenu={setShowLaunchMenu}
                    showNavMenu={showNavMenu}
                    setShowNavMenu={setShowNavMenu}
                    setShowSettings={setShowSettings}
                    setSettingsTab={setSettingsTab}
                    styles={STYLES}
                    logoFallback={ASSETS.logo}
                    audioPanelOpen={audioPanelOpen}
                    setAudioPanelOpen={setAudioPanelOpen}
                    stageMeterLevel={stageMeterLevel}
                    stageMicReady={stageMicReady}
                    stageMicError={stageMicError}
                    requestStageMic={requestStageMic}
                    toggleSongMute={toggleSongMute}
                    updateRoom={updateRoom}
                    smallWaveform={SmallWaveform}
                    bgAnalyserActive={!!bgAnalyserRef.current}
                    bgMeterLevel={bgMeterLevel}
                    bgVolume={bgVolume}
                    setBgVolume={setBgVolume}
                    toggleBgMusic={toggleBgMusic}
                    playingBg={playingBg}
                    skipBg={skipBg}
                    autoBgMusic={autoBgMusic}
                    setAutoBgMusic={setAutoBgMusic}
                    setBgMusicState={setBgMusicState}
                    toggleBgMute={toggleBgMute}
                    currentTrackName={BG_TRACKS[currentTrackIdx]?.name || 'BG Track'}
                    mixFader={mixFader}
                    handleMixFaderChange={handleMixFaderChange}
                />

            <div className="flex-1 min-h-0 p-6 overflow-y-auto md:overflow-hidden">
                {tab === 'stage' && (
                    <QueueTab {...queueTabProps} />
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
                        capabilities={orgContext?.capabilities || {}}
                        entitlementStatus={{
                            loading: orgContext.loading,
                            error: orgContext.error,
                            planId: orgContext.planId,
                            status: orgContext.status
                        }}
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
                                { key: 'billing', label: 'Billing' },
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
                                        markChatTabSeen();
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
                                <HostLogoManager
                                    styles={STYLES}
                                    logoUrl={logoUrl}
                                    setLogoUrl={setLogoUrl}
                                    logoUploading={logoUploading}
                                    logoUploadProgress={logoUploadProgress}
                                    logoInputRef={logoInputRef}
                                    uploadLogoFile={uploadLogoFile}
                                    saveLogoUrl={saveLogoUrl}
                                    logoChoices={logoChoices}
                                    removeCustomLogo={removeCustomLogo}
                                    assets={ASSETS}
                                />
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

                        {settingsTab === 'billing' && (
                        <div className="space-y-4">
                            <div className={STYLES.header}>Subscription & Billing</div>
                            <div className="bg-zinc-950/60 border border-white/10 rounded-xl p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                                        <div className="text-xs uppercase tracking-widest text-zinc-500">Plan</div>
                                        <div className="text-white font-semibold mt-1">{planLabel}</div>
                                    </div>
                                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                                        <div className="text-xs uppercase tracking-widest text-zinc-500">Status</div>
                                        <div className="mt-1">
                                            <span className={`inline-flex px-2 py-1 rounded-full border text-xs uppercase tracking-widest ${
                                                ['active', 'trialing', 'past_due'].includes((orgContext?.status || '').toLowerCase())
                                                    ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/30'
                                                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                            }`}>
                                                {orgContext?.status || 'inactive'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                                        <div className="text-xs uppercase tracking-widest text-zinc-500">Next Renewal</div>
                                        <div className="text-white font-semibold mt-1">{renewalLabel}</div>
                                    </div>
                                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                                        <div className="text-xs uppercase tracking-widest text-zinc-500">Workspace</div>
                                        <div className="text-zinc-200 font-mono text-xs mt-1 break-all">{orgContext?.orgId || 'Not set'}</div>
                                    </div>
                                </div>
                                {orgContext?.cancelAtPeriodEnd && (
                                    <div className="text-sm text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2">
                                        Subscription is set to cancel at period end.
                                    </div>
                                )}
                                {orgContext?.error && (
                                    <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
                                        {orgContext.error}
                                    </div>
                                )}
                                <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs uppercase tracking-widest text-zinc-500">Usage ({usagePeriodLabel})</div>
                                        {usageSummary?.loading && <div className="text-[10px] uppercase tracking-widest text-zinc-500">Refreshing...</div>}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3">
                                            <div className="text-xs uppercase tracking-widest text-zinc-500">Overage Estimate</div>
                                            <div className="text-white font-semibold mt-1">
                                                {formatUsdFromCents(usageSummary?.totals?.estimatedOverageCents || 0)}
                                            </div>
                                            <div className="text-xs text-zinc-400 mt-1">
                                                Meters tracked: {usageMeters.length}
                                            </div>
                                        </div>
                                        <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3">
                                            <div className="text-xs uppercase tracking-widest text-zinc-500">AI Generations (Quick View)</div>
                                            <div className="text-white font-semibold mt-1">
                                                {Number(aiUsageMeter?.used || 0).toLocaleString()} / {Number(aiUsageMeter?.included || 0).toLocaleString()} included
                                            </div>
                                            <div className="text-xs text-zinc-400 mt-1">
                                                Hard limit: {Number(aiUsageMeter?.hardLimit || 0).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs text-left border border-zinc-800 rounded-lg overflow-hidden">
                                            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-widest">
                                                <tr>
                                                    <th className="px-3 py-2">Meter</th>
                                                    <th className="px-3 py-2">Used</th>
                                                    <th className="px-3 py-2">Included</th>
                                                    <th className="px-3 py-2">Overage Units</th>
                                                    <th className="px-3 py-2">Overage Rate</th>
                                                    <th className="px-3 py-2">Est. Overage</th>
                                                    <th className="px-3 py-2">Hard Limit</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usageMeters.length === 0 && (
                                                    <tr className="bg-zinc-900/40 text-zinc-500">
                                                        <td className="px-3 py-3" colSpan={7}>No usage data yet for this period.</td>
                                                    </tr>
                                                )}
                                                {usageMeters.map((meter) => (
                                                    <tr key={`usage-meter-${meter.meterId}`} className="border-t border-zinc-800 bg-zinc-900/30">
                                                        <td className="px-3 py-2 text-zinc-200">{meter.label}</td>
                                                        <td className="px-3 py-2 text-white">{Number(meter.used || 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{Number(meter.included || 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{Number(meter.overageUnits || 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{formatUsdFromCents(meter.overageRateCents || 0)}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{formatUsdFromCents(meter.estimatedOverageCents || 0)}</td>
                                                        <td className={`px-3 py-2 ${meter.hardLimitReached ? 'text-amber-200' : 'text-zinc-300'}`}>
                                                            {Number(meter.hardLimit || 0).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {usageHardLimitHits.length > 0 && (
                                        <div className="text-sm text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2">
                                            Hard limit reached: {usageHardLimitHits.map(m => m.label).join(', ')}. Upgrade plan or wait for next monthly period.
                                        </div>
                                    )}
                                    {usageSummary?.error && (
                                        <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
                                            {usageSummary.error}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => refreshBillingEntitlements(true)}
                                        disabled={orgContext.loading}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} ${orgContext.loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {orgContext.loading ? 'Refreshing...' : 'Refresh Status'}
                                    </button>
                                    <button
                                        onClick={() => refreshUsageSummary(true)}
                                        disabled={usageSummary.loading}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} ${usageSummary.loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {usageSummary.loading ? 'Refreshing usage...' : 'Refresh Usage'}
                                    </button>
                                    <button
                                        onClick={() => openSubscriptionCheckout('host_monthly')}
                                        disabled={!!subscriptionActionLoading}
                                        className={`${STYLES.btnStd} ${STYLES.btnPrimary} ${subscriptionActionLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {subscriptionActionLoading === 'host_monthly' ? 'Opening checkout...' : 'Host Monthly'}
                                    </button>
                                    <button
                                        onClick={() => openSubscriptionCheckout('host_annual')}
                                        disabled={!!subscriptionActionLoading}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} ${subscriptionActionLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {subscriptionActionLoading === 'host_annual' ? 'Opening checkout...' : 'Host Annual'}
                                    </button>
                                    <button
                                        onClick={openBillingPortal}
                                        disabled={billingActionLoading}
                                        className={`${STYLES.btnStd} ${STYLES.btnInfo} ${billingActionLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {billingActionLoading ? 'Opening portal...' : 'Manage Billing'}
                                    </button>
                                </div>
                                <div className="host-form-helper">Use checkout to start/change plans. Use Manage Billing for payment methods, invoices, and cancellations.</div>
                            </div>
                        </div>
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
                                    className={`${STYLES.input} py-1.5 text-xs`}
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
                            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">QA Shortcut</div>
                                <div className="text-xs text-zinc-300 break-all mb-2">{qaYtPlaylistUrl}</div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => {
                                            setYtPlaylistUrl(qaYtPlaylistUrl);
                                            toast('QA playlist URL loaded');
                                        }}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-xs`}
                                    >
                                        Use QA URL
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await navigator.clipboard.writeText(qaYtPlaylistUrl);
                                                toast('QA playlist URL copied');
                                            } catch {
                                                toast('Copy failed');
                                            }
                                        }}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-xs`}
                                    >
                                        Copy QA URL
                                    </button>
                                    <button
                                        onClick={() => {
                                            const next = (ytPlaylistUrl || '').trim();
                                            if (!next) {
                                                toast('Paste a URL first');
                                                return;
                                            }
                                            setQaYtPlaylistUrl(next);
                                            toast('Saved current URL as QA shortcut');
                                        }}
                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-xs`}
                                    >
                                        Save Current as QA
                                    </button>
                                </div>
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
                                    className={`${STYLES.input} py-1.5 text-xs`}
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
                                    className={`${STYLES.input} py-1.5 text-xs`}
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
                                className={`${STYLES.input} py-1.5 text-xs`}
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
                                    className={`${STYLES.input} py-1.5 text-xs`}
                                    placeholder="Song title"
                                    title="Title used for search and display"
                                />
                                <input
                                    value={ytAddArtist}
                                    onChange={e => setYtAddArtist(e.target.value)}
                                    className={`${STYLES.input} py-1.5 text-xs`}
                                    placeholder="Artist (optional)"
                                    title="Optional artist name"
                                />
                            </div>
                            <div className="host-form-helper">Title is required. Artist helps matching.</div>
                            <input
                                value={ytAddUrl}
                                onChange={e => setYtAddUrl(e.target.value)}
                                className={`${STYLES.input} py-1.5 text-xs`}
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
                            <ChatSettingsPanel
                                styles={STYLES}
                                chatAudienceMode={chatAudienceMode}
                                setChatAudienceMode={setChatAudienceMode}
                                updateRoom={updateRoom}
                                chatEnabled={chatEnabled}
                                setChatEnabled={setChatEnabled}
                                chatShowOnTv={chatShowOnTv}
                                setChatShowOnTv={setChatShowOnTv}
                                chatTvMode={chatTvMode}
                                setChatTvMode={setChatTvMode}
                                chatSlowModeSec={chatSlowModeSec}
                                setChatSlowModeSec={setChatSlowModeSec}
                                handleChatViewMode={handleChatViewMode}
                                chatViewMode={chatViewMode}
                                chatMessages={chatMessages}
                                emoji={EMOJI}
                                chatDraft={chatDraft}
                                setChatDraft={setChatDraft}
                                sendHostChat={sendHostChat}
                            />
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
                                        <div className="text-sm text-zinc-500">Checks auth, room reads, user profile read/write, and optional write/delete.</div>
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


