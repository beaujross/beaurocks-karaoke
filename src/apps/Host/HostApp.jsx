import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import ModerationInboxDrawer from './components/ModerationInboxDrawer';
import FeatureGate from '../../components/FeatureGate';
import useHostChat from './hooks/useHostChat';
import useQueueDerivedState from './hooks/useQueueDerivedState';
import useQueueMediaTools from './hooks/useQueueMediaTools';
import useQueueReorder from './hooks/useQueueReorder';
import useQueueSongActions from './hooks/useQueueSongActions';
import useQueueTabState from './hooks/useQueueTabState';
import useModerationInboxState from './hooks/useModerationInboxState';
import HOST_UI_FEATURE_CHECKLIST from './hostUiFeatureChecklist';
import { 
    db, doc, collection, query, where, onSnapshot, updateDoc, 
    addDoc, deleteDoc, serverTimestamp, limit, getDocs, getDoc, setDoc, writeBatch,
    storage, storageRef, uploadBytesResumable, getDownloadURL, deleteObject,
    auth,
    initAuth,
    trackEvent,
    callFunction,
    ensureAppCheckToken,
    assertRoomHostAccess,
    ensureOrganization,
    bootstrapOnboardingWorkspace,
    getMyEntitlements,
    getMyUsageSummary,
    getMyUsageInvoiceDraft,
    saveMyUsageInvoiceDraft,
    listMyUsageInvoices,
    updateRoomAsHost
} from '../../lib/firebase';
import { ASSETS, AVATARS, APP_ID } from '../../lib/assets';
import { playSfx, setSfxMasterVolume, stopAllSfx } from '../../lib/utils';
import { EMOJI } from '../../lib/emoji';
import { BROWSE_CATEGORIES, TOPIC_HITS } from '../../lib/browseLists';
import { useToast } from '../../context/ToastContext';
import { BG_TRACKS, SOUNDS } from '../../lib/gameDataConstants';
import { HOST_APP_CONFIG } from '../../lib/uiConstants';
import { CAPABILITY_KEYS, getMissingCapabilityLabel } from '../../billing/capabilities';
import { getHostSubscriptionPlan, getSubscriptionPlanLabel } from '../../billing/hostPlans';
import { buildSongKey, ensureSong, ensureTrack } from '../../lib/songCatalog';
import { createLogger } from '../../lib/logger';
import { DEFAULT_POP_TRIVIA_MAX_QUESTIONS, normalizePopTriviaQuestions } from '../../lib/popTrivia';
import {
    DEFAULT_LOGO_PRESETS,
    DEFAULT_MARQUEE_ITEMS,
    DEFAULT_TIP_CRATES,
    HOST_ONBOARDING_PLAN_OPTIONS,
    HOST_ONBOARDING_STEPS,
    SAMPLE_ART,
    TOP100_SEED
} from './hostAppData';
import {
    normalizeBackingChoice,
    resolveStageMediaUrl,
    resolveQueuePlayback,
} from '../../lib/playbackSource';
import {
    HOST_WORKSPACE_VIEWS,
    HOST_WORKSPACE_SECTIONS,
    LEGACY_TAB_REDIRECTS,
    SETTINGS_TAB_TO_SECTION,
    SECTION_TO_SETTINGS_TAB,
    getSectionMeta,
    getViewDefaultSection
} from './workspace/navConfig';
import HostWorkspaceShell from './workspace/HostWorkspaceShell';
import {
    MISSION_FLOW_RULES,
    buildMissionDraftFromRoom,
    compileMissionDraftToRoomPayload,
    mergePayloadWithOverrides,
    getRecommendedHostAction
} from './missionControl';

// --- CONSTANTS & CONFIG ---
const VERSION = HOST_APP_CONFIG.VERSION;
const STORM_SEQUENCE = HOST_APP_CONFIG.STORM_SEQUENCE;
const STROBE_COUNTDOWN_MS = HOST_APP_CONFIG.STROBE_COUNTDOWN_MS;
const STROBE_ACTIVE_MS = HOST_APP_CONFIG.STROBE_ACTIVE_MS;
let itunesBackoffUntil = 0;
const nowMs = () => Date.now();
const hostLogger = createLogger('HostApp');
const HOST_UPDATE_DEPLOYMENT_WARNING = "Host control updates are unavailable because the backend callable `updateRoomAsHost` is not deployed. Deploy functions and reload Host.";
const HOST_UPDATE_OP_FIELD = '__hostOp';
const HOST_UPDATE_SERVER_TIMESTAMP = 'serverTimestamp';

const isPlainObject = (value) =>
    !!value && Object.prototype.toString.call(value) === '[object Object]';

const isServerTimestampSentinel = (value) => {
    if (!value || typeof value !== 'object') return false;
    const methodName = value?._methodName || value?._delegate?._methodName;
    return methodName === 'serverTimestamp';
};

const encodeHostRoomUpdateValue = (value) => {
    if (value === undefined) return undefined;
    if (isServerTimestampSentinel(value)) {
        return { [HOST_UPDATE_OP_FIELD]: HOST_UPDATE_SERVER_TIMESTAMP };
    }
    if (Array.isArray(value)) {
        return value.map((entry) => encodeHostRoomUpdateValue(entry));
    }
    if (!isPlainObject(value)) return value;
    const next = {};
    Object.entries(value).forEach(([key, child]) => {
        const encodedChild = encodeHostRoomUpdateValue(child);
        if (encodedChild !== undefined) {
            next[key] = encodedChild;
        }
    });
    return next;
};

const encodeHostRoomUpdates = (updates = {}) => {
    if (!isPlainObject(updates)) return {};
    const encoded = {};
    Object.entries(updates).forEach(([key, value]) => {
        const encodedValue = encodeHostRoomUpdateValue(value);
        if (encodedValue !== undefined) {
            encoded[key] = encodedValue;
        }
    });
    return encoded;
};

const isHostUpdateCallableUnavailableError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    if (code.includes('not-found') || code.includes('unimplemented')) return true;
    return (
        message.includes('updateroomashost')
        && (
            message.includes('does not exist')
            || message.includes('not found')
            || message.includes('not deployed')
            || message.includes('no function')
        )
    );
};

// Background tracks and sounds imported from gameDataConstants.js
// (BG_TRACKS, SOUNDS)

const LOCAL_LIBRARY = [ 
    { title: "Big Buck Bunny", artist: "Blender", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" }, 
    { title: "Sintel", artist: "Blender", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" }, 
    { title: "Tears of Steel", artist: "Blender", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4" }, 
    { title: "Popeye for President", artist: "Internet Archive", url: "https://archive.org/download/Popeye_forPresident/Popeye_forPresident_512kb.mp4" } 
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
        hostLogger.error('AI Error', e);
        const code = String(e?.code || e?.message || '').toLowerCase();
        if (code.includes('permission-denied')) {
            alert("AI tools require an active Host subscription.");
        } else {
            alert("AI generation is unavailable right now. Check function secrets and deployment.");
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

const HOST_NIGHT_PRESETS = {
    casual: {
        id: 'casual',
        label: 'Casual Night',
        description: 'Apple playlist vibe with visualizer-forward TV.',
        searchSources: { local: true, youtube: true, itunes: true },
        settings: {
            autoDj: true,
            autoBgMusic: true,
            autoPlayMedia: true,
            showVisualizerTv: true,
            showLyricsTv: false,
            showScoring: false,
            showFameLevel: false,
            allowSingerTrackSelect: true,
            marqueeEnabled: true,
            marqueeShowMode: 'idle',
            chatShowOnTv: false,
            chatTvMode: 'auto',
            bouncerMode: false,
            bingoShowTv: true,
            bingoVotingMode: 'host+votes',
            bingoAutoApprovePct: 45,
            bingoAudienceReopenEnabled: true,
            autoLyricsOnQueue: false,
            queueSettings: {
                limitMode: 'none',
                limitCount: 0,
                rotation: 'round_robin',
                firstTimeBoost: true
            },
            gameDefaults: {
                triviaRoundSec: 20,
                triviaAutoReveal: true,
                bingoVotingMode: 'host+votes',
                bingoAutoApprovePct: 45
            }
        },
        autoStartApplePlaylist: true
    },
    competition: {
        id: 'competition',
        label: 'Competition Night',
        description: 'Structured scoring, tighter queue, and AI lyric assist.',
        searchSources: { local: false, youtube: false, itunes: true },
        settings: {
            autoDj: false,
            autoBgMusic: false,
            autoPlayMedia: true,
            showVisualizerTv: false,
            showLyricsTv: true,
            showScoring: true,
            showFameLevel: true,
            allowSingerTrackSelect: false,
            marqueeEnabled: false,
            marqueeShowMode: 'idle',
            chatShowOnTv: false,
            chatTvMode: 'auto',
            bouncerMode: true,
            bingoShowTv: true,
            bingoVotingMode: 'host',
            bingoAutoApprovePct: 60,
            bingoAudienceReopenEnabled: true,
            autoLyricsOnQueue: true,
            queueSettings: {
                limitMode: 'per_night',
                limitCount: 2,
                rotation: 'round_robin',
                firstTimeBoost: false
            },
            gameDefaults: {
                triviaRoundSec: 15,
                triviaAutoReveal: true,
                bingoVotingMode: 'host',
                bingoAutoApprovePct: 60
            }
        },
        autoStartApplePlaylist: false
    },
    bingo: {
        id: 'bingo',
        label: 'Bingo Night',
        description: 'Crowd-observation flow with board-first interactions.',
        searchSources: { local: true, youtube: true, itunes: false },
        settings: {
            autoDj: false,
            autoBgMusic: true,
            autoPlayMedia: true,
            showVisualizerTv: false,
            showLyricsTv: false,
            showScoring: false,
            showFameLevel: false,
            allowSingerTrackSelect: true,
            marqueeEnabled: true,
            marqueeShowMode: 'always',
            chatShowOnTv: true,
            chatTvMode: 'activity',
            bouncerMode: false,
            bingoShowTv: true,
            bingoVotingMode: 'host+votes',
            bingoAutoApprovePct: 35,
            bingoAudienceReopenEnabled: true,
            autoLyricsOnQueue: false,
            gamePreviewId: 'bingo',
            queueSettings: {
                limitMode: 'none',
                limitCount: 0,
                rotation: 'round_robin',
                firstTimeBoost: true
            },
            gameDefaults: {
                triviaRoundSec: 20,
                triviaAutoReveal: true,
                bingoVotingMode: 'host+votes',
                bingoAutoApprovePct: 35
            }
        },
        autoStartApplePlaylist: false
    },
    trivia: {
        id: 'trivia',
        label: 'Trivia Night',
        description: 'Question-first pacing with timed reveal defaults.',
        searchSources: { local: false, youtube: false, itunes: false },
        settings: {
            autoDj: false,
            autoBgMusic: true,
            autoPlayMedia: false,
            showVisualizerTv: false,
            showLyricsTv: false,
            showScoring: true,
            showFameLevel: false,
            allowSingerTrackSelect: false,
            marqueeEnabled: false,
            marqueeShowMode: 'idle',
            chatShowOnTv: false,
            chatTvMode: 'auto',
            bouncerMode: false,
            bingoShowTv: true,
            bingoVotingMode: 'host+votes',
            bingoAutoApprovePct: 50,
            bingoAudienceReopenEnabled: true,
            autoLyricsOnQueue: false,
            gamePreviewId: 'trivia_pop',
            queueSettings: {
                limitMode: 'per_night',
                limitCount: 1,
                rotation: 'round_robin',
                firstTimeBoost: true
            },
            gameDefaults: {
                triviaRoundSec: 18,
                triviaAutoReveal: true,
                bingoVotingMode: 'host+votes',
                bingoAutoApprovePct: 50
            }
        },
        autoStartApplePlaylist: false
    }
};

const NIGHT_SETUP_PRIMARY_MODES = [
    {
        id: 'karaoke',
        label: 'Karaoke Flow',
        description: 'Classic queue-first night with optional side features.',
        icon: 'fa-microphone-lines',
        accent: 'from-cyan-500/25 via-cyan-500/10 to-transparent'
    },
    {
        id: 'bingo',
        label: 'Bingo Spotlight',
        description: 'Queue plus crowd bingo participation throughout the night.',
        icon: 'fa-table-cells-large',
        accent: 'from-emerald-500/25 via-emerald-500/10 to-transparent'
    },
    {
        id: 'trivia_pop',
        label: 'Trivia Bursts',
        description: 'Interleave quick trivia rounds between performances.',
        icon: 'fa-circle-question',
        accent: 'from-amber-500/25 via-amber-500/10 to-transparent'
    },
    {
        id: 'wyr',
        label: 'Would You Rather',
        description: 'Run rapid crowd-vote moments between songs.',
        icon: 'fa-scale-balanced',
        accent: 'from-orange-500/25 via-orange-500/10 to-transparent'
    },
    {
        id: 'doodle_oke',
        label: 'Doodle-oke',
        description: 'Drawing + guessing moments to break up the set.',
        icon: 'fa-pen',
        accent: 'from-fuchsia-500/25 via-fuchsia-500/10 to-transparent'
    },
    {
        id: 'selfie_challenge',
        label: 'Selfie Challenge',
        description: 'Photo prompt rounds with live voting and reveal.',
        icon: 'fa-camera-retro',
        accent: 'from-rose-500/25 via-rose-500/10 to-transparent'
    },
    {
        id: 'karaoke_bracket',
        label: 'Sweet 16 Bracket',
        description: 'Head-to-head tournament progression across singers.',
        icon: 'fa-trophy',
        accent: 'from-red-500/25 via-red-500/10 to-transparent'
    },
    {
        id: 'vocal_challenge',
        label: 'Vocal Challenge',
        description: 'Pitch-target game for focused voice rounds.',
        icon: 'fa-wave-square',
        accent: 'from-sky-500/25 via-sky-500/10 to-transparent'
    },
    {
        id: 'riding_scales',
        label: 'Riding Scales',
        description: 'Scale memory challenge for experienced singers.',
        icon: 'fa-music',
        accent: 'from-indigo-500/25 via-indigo-500/10 to-transparent'
    },
    {
        id: 'flappy_bird',
        label: 'Flappy Bird',
        description: 'Voice-volume obstacle gameplay for quick energy spikes.',
        icon: 'fa-feather-pointed',
        accent: 'from-lime-500/25 via-lime-500/10 to-transparent'
    }
];

const NIGHT_SETUP_STEPS = [
    {
        id: 0,
        label: 'Warmup',
        subtitle: 'Pick your night type',
        sections: ['Section 1: Night Type', 'Section 2: Preset Feature Bundle']
    },
    {
        id: 1,
        label: 'Rules',
        subtitle: 'Set queue behavior',
        sections: ['Section 1: Request Limits', 'Section 2: Rotation + Fairness']
    },
    {
        id: 2,
        label: 'Main Event',
        subtitle: 'Choose spotlight mode',
        sections: ['Section 1: Spotlight Mode', 'Section 2: Live Toggles']
    }
];

const NIGHT_SETUP_PRESET_META = {
    casual: {
        icon: 'fa-glass-cheers',
        accent: 'from-cyan-500/30 via-sky-500/10 to-transparent'
    },
    competition: {
        icon: 'fa-trophy',
        accent: 'from-amber-500/30 via-yellow-500/10 to-transparent'
    },
    bingo: {
        icon: 'fa-table-cells-large',
        accent: 'from-emerald-500/30 via-lime-500/10 to-transparent'
    },
    trivia: {
        icon: 'fa-bolt',
        accent: 'from-fuchsia-500/30 via-violet-500/10 to-transparent'
    }
};

const NIGHT_SETUP_QUEUE_LIMIT_OPTIONS = [
    { id: 'none', label: 'No Limits', description: 'Let guests request freely all night.', icon: 'fa-infinity' },
    { id: 'per_night', label: 'Per Night', description: 'Each singer gets a set number of requests.', icon: 'fa-moon' },
    { id: 'per_hour', label: 'Per Hour', description: 'Cap requests each hour to keep turns fair.', icon: 'fa-clock' },
    { id: 'soft', label: 'Soft Limit', description: 'Gentle cap with host discretion.', icon: 'fa-feather-pointed' }
];

const NIGHT_SETUP_QUEUE_ROTATION_OPTIONS = [
    { id: 'round_robin', label: 'Round Robin', description: 'Rotate singers in cycles.', icon: 'fa-rotate' },
    { id: 'first_come', label: 'First Come', description: 'Run strict request order.', icon: 'fa-list-ol' }
];

const MISSION_COHORT_STORAGE_KEY = 'bross_mission_control_cohort_v1';
const MISSION_DRAFT_STORAGE_KEY = 'bross_mission_control_setup_draft_v1';
const MISSION_OVERRIDE_STORAGE_KEY = 'bross_mission_control_overrides_v1';
const MISSION_QUERY_KEY = 'mission';
const MISSION_CONTROL_VERSION = 1;
const MISSION_DEFAULT_ASSIST_LEVEL = 'smart_assist';
const MISSION_FLOW_RULE_OPTIONS = Object.freeze(Object.values(MISSION_FLOW_RULES));
const MISSION_CHANGE_FIELD_SPECS = Object.freeze([
    { key: 'autoDj', label: 'Auto DJ' },
    { key: 'autoBgMusic', label: 'Background Music' },
    { key: 'autoPlayMedia', label: 'Auto Stage Playback' },
    { key: 'showScoring', label: 'Live Scoring' },
    { key: 'allowSingerTrackSelect', label: 'Singer Track Select' },
    { key: 'bouncerMode', label: 'Bouncer Mode' },
    { key: 'chatShowOnTv', label: 'Chat on TV' },
    { key: 'marqueeEnabled', label: 'Marquee' },
    { key: 'popTriviaEnabled', label: 'Pop Trivia' },
    { key: 'autoLyricsOnQueue', label: 'Auto Lyrics' },
    { key: 'queueSettings.limitMode', label: 'Queue Limit' },
    { key: 'queueSettings.limitCount', label: 'Queue Count' },
    { key: 'queueSettings.rotation', label: 'Queue Rotation' },
    { key: 'queueSettings.firstTimeBoost', label: 'First-Time Boost' },
    { key: 'gamePreviewId', label: 'Spotlight Mode' }
]);

const HOST_SETTINGS_SECTIONS = [
    {
        id: 'ops',
        label: 'Operations',
        items: [
            {
                key: 'general',
                label: 'Room Setup',
                icon: 'fa-sliders',
                description: 'Host identity, queue policy, room defaults, and operational controls.',
                keywords: 'queue room tips presets identity'
            },
            {
                key: 'automations',
                label: 'Automation',
                icon: 'fa-bolt',
                description: 'Auto-DJ, background behavior, and one-click night profiles.',
                keywords: 'auto dj automation presets profile'
            }
        ]
    },
    {
        id: 'audience',
        label: 'Audience',
        items: [
            {
                key: 'chat',
                label: 'Chat',
                icon: 'fa-comments',
                description: 'Audience chat policy, DM controls, and TV feed behavior.',
                keywords: 'chat dm social audience'
            },
            {
                key: 'moderation',
                label: 'Approvals',
                icon: 'fa-shield-halved',
                description: 'Doodle review policy, audience visibility rules, and moderation shortcuts.',
                keywords: 'moderation doodle review approve'
            },
            {
                key: 'monetization',
                label: 'Tips + Boosts',
                icon: 'fa-sack-dollar',
                description: 'Tip crates and in-room boost economics.',
                keywords: 'tips crates monetization'
            }
        ]
    },
    {
        id: 'media',
        label: 'Media & Displays',
        items: [
            {
                key: 'media',
                label: 'Playback',
                icon: 'fa-tv',
                description: 'Media pipelines, uploads, and playback source controls.',
                keywords: 'media visuals playback upload youtube apple music'
            },
            {
                key: 'marquee',
                label: 'Marquee',
                icon: 'fa-panorama',
                description: 'Marquee timing, rotation content, and idle messaging behavior.',
                keywords: 'marquee design overlay idle message'
            }
        ]
    },
    {
        id: 'games',
        label: 'Games',
        items: [
            {
                key: 'gamepad',
                label: 'Live Controls',
                icon: 'fa-gamepad',
                description: 'Mode-specific host actions while games and specials are running.',
                keywords: 'games mode gamepad launchpad doodle trivia bingo bracket'
            }
        ]
    },
    {
        id: 'billing',
        label: 'Billing & Usage',
        items: [
            {
                key: 'billing',
                label: 'Billing',
                icon: 'fa-credit-card',
                description: 'Plan, usage, invoices, and subscription controls.',
                keywords: 'billing usage plan invoice'
            }
        ]
    },
    {
        id: 'advanced',
        label: 'Advanced Tools',
        items: [
            {
                key: 'live_effects',
                label: 'Live Effects',
                icon: 'fa-wand-magic-sparkles',
                description: 'Special effects, vibe moments, and crowd-response controls.',
                keywords: 'effects vibe storm beat drop soundboard'
            },
            {
                key: 'qa',
                label: 'Diagnostics',
                icon: 'fa-screwdriver-wrench',
                description: 'Room diagnostics, smoke tests, and debug snapshots.',
                keywords: 'qa debug tools diagnostics'
            }
        ]
    }
];

const HOST_SETTINGS_META = HOST_SETTINGS_SECTIONS.reduce((acc, section) => {
    section.items.forEach((item) => {
        acc[item.key] = { ...item, sectionLabel: section.label };
    });
    return acc;
}, {});
const HOST_SETTINGS_TAB_KEYS = Object.keys(HOST_SETTINGS_META);

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

const normalizeTipCratesForSave = (tipCrates = []) => {
    const list = Array.isArray(tipCrates) ? tipCrates : [];
    return list.map((crate, idx) => ({
        id: crate?.id || `crate_${idx}`,
        label: crate?.label || `Crate ${idx + 1}`,
        amount: Number(crate?.amount || 0),
        points: Number(crate?.points || 0),
        rewardScope: crate?.rewardScope || 'room',
        awardBadge: !!crate?.awardBadge
    }));
};

const getCurrentUsagePeriodKey = () => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${y}${m}`;
};

const buildRecentUsagePeriods = (count = 6) => {
    const periods = [];
    const cursor = new Date();
    cursor.setUTCDate(1);
    for (let i = 0; i < count; i += 1) {
        const y = cursor.getUTCFullYear();
        const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
        const key = `${y}${m}`;
        const label = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        periods.push({ key, label });
        cursor.setUTCMonth(cursor.getUTCMonth() - 1);
    }
    return periods;
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

const isPermissionDeniedError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return (
        code.includes('permission-denied')
        || code.includes('forbidden')
        || message.includes('permission-denied')
        || message.includes('403')
        || message.includes('requires an active subscription')
    );
};

const isDirectChatMessage = (message = {}) => (
    !!message?.toHost
    || !!message?.toUid
    || message?.channel === 'host'
    || message?.channel === 'dm'
);

const isLoungeChatMessage = (message = {}) => !isDirectChatMessage(message);

const isAppCheckError = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    const mentionsAppCheck = (
        message.includes('app check')
        || message.includes('appcheck')
        || message.includes('app check token')
        || message.includes('token required')
    );
    return (
        (
            code.includes('failed-precondition')
            || code.includes('invalid-argument')
            || code.includes('unauthenticated')
        )
        && mentionsAppCheck
    );
};

const BILLING_WARMUP_MESSAGE = 'Billing tools are warming up. You can keep hosting and retry in a moment.';

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const deriveBracketUiState = (room) => {
    const bracket = room && room.karaokeBracket ? room.karaokeBracket : null;
    const crowdVotingEnabled = !bracket || bracket.crowdVotingEnabled !== false;
    const roundTransition = bracket && bracket.roundTransition ? bracket.roundTransition : null;
    const showAdvancePrompt = !!(
        roundTransition
        && bracket
        && bracket.status !== 'complete'
        && !bracket.activeMatchId
    );
    return {
        activeBracket: bracket,
        bracketCrowdVotingEnabled: crowdVotingEnabled,
        bracketRoundTransition: roundTransition,
        bracketShowAdvancePrompt: showAdvancePrompt
    };
};

const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ123456789";
const DEFAULT_QA_YT_PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PL_3exKsBlHnEbbmolJlfODkelxx_1UMAP';
const TIGHT15_MAX = 15;

const normalizeTight15Text = (value = '') => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeTight15Entry = (entry = {}) => {
    const songTitle = String(entry.songTitle || entry.song || '').trim();
    const artist = String(entry.artist || entry.singerName || '').trim();
    if (!songTitle || !artist) return null;
    return {
        id: entry.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        songTitle,
        artist,
        albumArtUrl: String(entry.albumArtUrl || entry.artworkUrl || '').trim(),
        addedAt: Number(entry.addedAt || Date.now())
    };
};

const getTight15Key = (entry = {}) => `${normalizeTight15Text(entry.songTitle)}__${normalizeTight15Text(entry.artist)}`;

const sanitizeTight15List = (list = []) => {
    const seen = new Set();
    const cleaned = [];
    list.forEach((entry) => {
        const normalized = normalizeTight15Entry(entry);
        if (!normalized) return;
        const key = getTight15Key(normalized);
        if (seen.has(key)) return;
        seen.add(key);
        cleaned.push(normalized);
    });
    return cleaned.slice(0, TIGHT15_MAX);
};

const shuffleList = (list = []) => {
    const next = [...list];
    for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
};

const getBracketRoundName = (size = 2) => {
    if (size >= 16) return 'Round of 16';
    if (size === 8) return 'Quarterfinals';
    if (size === 4) return 'Semifinals';
    return 'Final';
};

const pickRandomTight15Song = (contestant = {}) => {
    const list = Array.isArray(contestant?.tight15) ? contestant.tight15 : [];
    if (!list.length) return null;
    const pick = list[Math.floor(Math.random() * list.length)];
    return normalizeTight15Entry(pick);
};

const buildBracketRound = ({ contestantUids = [], contestantsByUid = {}, roundIndex = 0 }) => {
    const safeUids = contestantUids.filter(Boolean);
    const matches = [];
    for (let i = 0; i < safeUids.length; i += 2) {
        const aUid = safeUids[i] || null;
        const bUid = safeUids[i + 1] || null;
        matches.push({
            id: `m_${roundIndex + 1}_${Math.floor(i / 2) + 1}`,
            slot: Math.floor(i / 2) + 1,
            aUid,
            bUid,
            aSong: aUid ? pickRandomTight15Song(contestantsByUid[aUid]) : null,
            bSong: bUid ? pickRandomTight15Song(contestantsByUid[bUid]) : null,
            winnerUid: bUid ? null : aUid,
            queuedAt: null,
            completedAt: bUid ? null : nowMs()
        });
    }
    return {
        id: `round_${roundIndex + 1}`,
        index: roundIndex,
        name: getBracketRoundName(safeUids.length),
        matches
    };
};

const resolveBracketVoterUid = (roomUser = {}) => roomUser?.uid || roomUser?.id?.split('_')[1] || '';

const getBracketMatchCrowdVotes = ({ users = [], bracketId = '', match = null }) => {
    const summary = {
        total: 0,
        aVotes: 0,
        bVotes: 0
    };
    if (!Array.isArray(users) || !users.length || !bracketId || !match?.id) return summary;
    users.forEach((entry) => {
        const voterUid = resolveBracketVoterUid(entry);
        if (!voterUid) return;
        if (voterUid === match.aUid || voterUid === match.bUid) return;
        const vote = entry?.bracketVote || null;
        if (!vote || vote.bracketId !== bracketId || vote.matchId !== match.id) return;
        if (vote.targetUid === match.aUid) {
            summary.aVotes += 1;
            summary.total += 1;
        } else if (vote.targetUid === match.bUid) {
            summary.bVotes += 1;
            summary.total += 1;
        }
    });
    return summary;
};

const appendBracketAuditEvent = (bracket = {}, event = {}) => {
    const trail = Array.isArray(bracket?.auditTrail) ? bracket.auditTrail : [];
    const normalized = {
        id: event.id || `audit_${nowMs()}_${Math.random().toString(36).slice(2, 7)}`,
        at: Number(event.at || nowMs()),
        type: String(event.type || 'event'),
        text: String(event.text || ''),
        ...event
    };
    return {
        ...bracket,
        auditTrail: [...trail, normalized].slice(-200)
    };
};

const upsertBracketMatchHistoryEntry = (bracket = {}, entry = {}) => {
    if (!entry?.matchId) return bracket;
    const history = Array.isArray(bracket?.matchHistory) ? bracket.matchHistory : [];
    const nextEntry = {
        id: entry.id || `mh_${entry.matchId}_${nowMs()}`,
        at: Number(entry.at || nowMs()),
        ...entry
    };
    const filtered = history.filter((item) => item?.matchId !== entry.matchId);
    const next = [...filtered, nextEntry].sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
    return {
        ...bracket,
        matchHistory: next
    };
};

const buildBracketSummary = (bracket = {}) => {
    if (!bracket || (typeof bracket !== 'object')) return null;
    if (bracket?.summaryVersion && Array.isArray(bracket?.matchHistory)) return bracket;
    const rounds = Array.isArray(bracket?.rounds) ? bracket.rounds : [];
    const matchHistory = Array.isArray(bracket?.matchHistory) ? bracket.matchHistory : [];
    const auditTrail = Array.isArray(bracket?.auditTrail) ? bracket.auditTrail : [];
    const championUid = bracket?.championUid || '';
    const championName = bracket?.championName || bracket?.contestantsByUid?.[championUid]?.name || '';
    const championAvatar = bracket?.contestantsByUid?.[championUid]?.avatar || EMOJI.trophy || EMOJI.star;
    const seeds = (Array.isArray(bracket?.contestantOrder) ? bracket.contestantOrder : [])
        .map((uid, idx) => {
            const contestant = bracket?.contestantsByUid?.[uid] || {};
            return {
                seed: idx + 1,
                uid,
                name: contestant?.name || 'Singer',
                avatar: contestant?.avatar || EMOJI.mic
            };
        });
    const moments = matchHistory
        .slice(-8)
        .reverse()
        .map((item) => {
            const resolution = item?.resolutionType === 'forfeit_no_show_auto'
                ? 'won by no-show forfeit'
                : item?.resolutionType === 'forfeit_no_show_host'
                    ? 'was awarded a host forfeit'
                    : item?.resolutionType === 'crowd_vote'
                        ? 'won the crowd vote'
                        : 'advanced';
            return {
                id: item?.id || `moment_${item?.matchId || Math.random().toString(36).slice(2, 7)}`,
                text: `${item?.winnerName || 'Winner'} ${resolution} in ${item?.roundName || 'Round'} (${item?.aName || 'A'} vs ${item?.bName || 'B'})`,
                at: Number(item?.at || nowMs()),
                winnerUid: item?.winnerUid || '',
                matchId: item?.matchId || ''
            };
        });
    return {
        summaryVersion: 1,
        id: bracket?.id || '',
        style: bracket?.style || 'sweet16',
        format: bracket?.format || 'single_elimination',
        size: Number(bracket?.size || 0),
        status: bracket?.status || 'setup',
        createdAt: Number(bracket?.createdAt || 0),
        completedAt: Number(bracket?.championCelebration?.at || 0),
        championUid: championUid || null,
        championName: championName || '',
        championAvatar,
        roundsCount: rounds.length,
        seeds,
        matchHistory,
        auditTrail,
        timeCapsule: {
            posterTitle: championName ? `${championName} Takes The Crown` : 'Sweet 16 Showdown',
            tagline: championName ? `Champion of Room ${bracket?.roomCode || ''}` : 'One room. One champion.',
            moments
        }
    };
};

const advanceBracketState = (bracket = {}) => {
    const rounds = Array.isArray(bracket?.rounds) ? bracket.rounds : [];
    const activeRoundIndex = Math.max(0, Number(bracket?.activeRoundIndex || 0));
    const currentRound = rounds[activeRoundIndex];
    if (!currentRound) return bracket;
    const matches = Array.isArray(currentRound.matches) ? currentRound.matches : [];
    if (!matches.length || !matches.every((match) => !!match?.winnerUid)) return bracket;
    const winners = matches.map((match) => match.winnerUid).filter(Boolean);
    if (winners.length <= 1) {
        const completedAt = nowMs();
        const championUid = winners[0] || null;
        const champion = championUid ? bracket?.contestantsByUid?.[championUid] : null;
        return {
            ...bracket,
            status: 'complete',
            championUid,
            championName: champion?.name || '',
            activeMatchId: null,
            roundTransition: null,
            championCelebration: {
                id: `champion_${championUid || 'winner'}_${completedAt}`,
                at: completedAt,
                championUid,
                championName: champion?.name || ''
            }
        };
    }
    const completedAt = nowMs();
    const nextRound = buildBracketRound({
        contestantUids: winners,
        contestantsByUid: bracket?.contestantsByUid || {},
        roundIndex: rounds.length
    });
    return {
        ...bracket,
        status: 'in_progress',
        activeRoundIndex: rounds.length,
        activeMatchId: null,
        rounds: [...rounds, nextRound],
        roundTransition: {
            id: `transition_${currentRound.id || activeRoundIndex}_${nextRound.id}_${completedAt}`,
            at: completedAt,
            completedRoundIndex: activeRoundIndex,
            fromRoundName: currentRound?.name || `Round ${activeRoundIndex + 1}`,
            toRoundName: nextRound?.name || `Round ${rounds.length + 1}`
        }
    };
};

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
    }, [color, gradient]);

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
            hostLogger.error('Selfie moderation failed', e);
            toast('Failed to update approval');
        }
    };
    const startChallenge = async () => {
        if (!promptText.trim()) return toast('Add a prompt');
        if (!selectedParticipants.length) return toast('Select at least one participant');
        const promptId = `${nowMs()}`;
        await updateRoom({
            activeMode: 'selfie_challenge',
            selfieChallenge: {
                prompt: promptText.trim(),
                promptId,
                participants: selectedParticipants,
                status: 'collecting',
                requireApproval,
                autoStartVoting,
                createdAt: nowMs()
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
        await updateRoom({ selfieChallenge: { ...challenge, status: 'ended', winner, winnerExpiresAt: nowMs() + 12000 } });
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

const IncomingModerationQueuePanel = ({
    queueItems = [],
    counts = {},
    actions = {},
    busyAction = '',
    loading = false,
    embedded = false
}) => {
    const doodlePending = Math.max(0, Number(counts?.doodlePending || 0));
    const selfiePending = Math.max(0, Number(counts?.selfiePending || 0));
    const bingoPending = Math.max(0, Number(counts?.bingoPending || 0));
    const totalPending = Math.max(0, Number(counts?.totalPending || 0));
    const listMaxHeight = embedded ? 'max-h-72' : 'max-h-[calc(100vh-270px)]';
    const approveDoodleUid = actions?.approveDoodleUid;
    const approveSelfieSubmission = actions?.approveSelfieSubmission;
    const approveBingoSuggestion = actions?.approveBingoSuggestion;
    const clearBingoSuggestion = actions?.clearBingoSuggestion;

    return (
        <div className={`${STYLES.panel} p-4 border border-cyan-500/20`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                    <div className="text-sm uppercase tracking-[0.3em] text-zinc-500">Incoming Moderation Queue</div>
                    <div className="text-xl font-bold text-white">Review crowd submissions in one feed</div>
                </div>
                <div className="text-xs text-zinc-400 text-right">
                    Queue items: <span className="text-zinc-200 font-bold">{totalPending}</span>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-500">Doodle Pending</div>
                    <div className="text-2xl font-bold text-white mt-1">{doodlePending}</div>
                </div>
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-500">Selfie Pending</div>
                    <div className="text-2xl font-bold text-cyan-300 mt-1">{selfiePending}</div>
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-500">Bingo Suggestions</div>
                    <div className="text-2xl font-bold text-amber-300 mt-1">{bingoPending}</div>
                </div>
            </div>
            {loading && totalPending === 0 ? (
                <div className="text-center text-zinc-500 text-sm py-8 border border-white/10 rounded-xl bg-zinc-950/50">
                    Loading moderation feed...
                </div>
            ) : queueItems.length > 0 ? (
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-3 ${listMaxHeight} overflow-y-auto custom-scrollbar pr-1`}>
                    {queueItems.map((item) => (
                        <div key={item.key} className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-3 flex items-start gap-3">
                            {item.image ? (
                                <img
                                    src={item.image}
                                    alt={item.title}
                                    className="w-20 h-20 rounded-lg object-cover bg-zinc-950 border border-white/10"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-lg bg-zinc-950 border border-white/10 flex items-center justify-center text-zinc-500">
                                    <i className={`fa-solid ${item.type === 'bingo' ? 'fa-table-cells-large' : 'fa-image'}`}></i>
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                                    {item.type === 'doodle' ? 'Doodle-oke' : item.type === 'selfie' ? 'Selfie Challenge' : 'Bingo'}
                                </div>
                                <div className="text-sm font-bold text-white truncate mt-0.5">{item.title}</div>
                                <div className="text-xs text-zinc-400 mt-0.5">{item.subtitle}</div>
                                {item.type === 'bingo' && item.suggestion?.note && (
                                    <div className="text-[11px] text-zinc-500 mt-1 truncate">
                                        Last note: {item.suggestion.note}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {item.type === 'doodle' && (
                                        <button
                                            onClick={() => approveDoodleUid?.(item.submission?.uid)}
                                            disabled={!!busyAction || !item.submission?.uid || typeof approveDoodleUid !== 'function'}
                                            className={`${STYLES.btnStd} ${STYLES.btnHighlight} text-[10px] px-2 py-1 ${(!!busyAction || !item.submission?.uid || typeof approveDoodleUid !== 'function') ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            Approve
                                        </button>
                                    )}
                                    {item.type === 'selfie' && (
                                        <button
                                            onClick={() => approveSelfieSubmission?.(item.submission)}
                                            disabled={busyAction || !item.submission?.id || typeof approveSelfieSubmission !== 'function'}
                                            className={`${STYLES.btnStd} ${STYLES.btnInfo} text-[10px] px-2 py-1 ${(busyAction || !item.submission?.id || typeof approveSelfieSubmission !== 'function') ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            Approve
                                        </button>
                                    )}
                                    {item.type === 'bingo' && (
                                        <>
                                            <button
                                                onClick={() => approveBingoSuggestion?.(item.suggestion.idx)}
                                                disabled={busyAction || typeof approveBingoSuggestion !== 'function'}
                                                className={`${STYLES.btnStd} ${STYLES.btnHighlight} text-[10px] px-2 py-1 ${(busyAction || typeof approveBingoSuggestion !== 'function') ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                Reveal Tile
                                            </button>
                                            <button
                                                onClick={() => clearBingoSuggestion?.(item.suggestion.idx)}
                                                disabled={busyAction || typeof clearBingoSuggestion !== 'function'}
                                                className={`${STYLES.btnStd} ${STYLES.btnNeutral} text-[10px] px-2 py-1 ${(busyAction || typeof clearBingoSuggestion !== 'function') ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                Clear
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-zinc-500 text-sm py-10 border border-white/10 rounded-xl bg-zinc-950/50">
                    No pending crowd submissions right now.
                    <div className="text-xs mt-1 text-zinc-600">
                        New doodles, selfies, and bingo suggestions will appear here.
                    </div>
                </div>
            )}
        </div>
    );
};

const HostGameControlPad = ({ roomCode, room, updateRoom, setTab, appBase }) => {
    const toast = useToast() || console.log;
    const [doodleSubmissions, setDoodleSubmissions] = useState([]);
    const [selfieSubmissions, setSelfieSubmissions] = useState([]);
    const [busy, setBusy] = useState(false);
    const interactionTimerRef = useRef(null);
    const activeMode = room?.activeMode || 'karaoke';
    const doodle = room?.doodleOke || null;
    const selfie = room?.selfieChallenge || null;
    const doodlePromptId = doodle?.promptId || '';
    const selfiePromptId = selfie?.promptId || '';
    const doodleRequireReview = !!doodle?.requireReview;
    const doodleApprovedUids = useMemo(() => {
        const ids = Array.isArray(doodle?.approvedUids) ? doodle.approvedUids : [];
        return ids.filter(Boolean);
    }, [doodle?.approvedUids]);
    const doodleApprovedSet = useMemo(() => new Set(doodleApprovedUids), [doodleApprovedUids]);
    const modeLabel = {
        doodle_oke: 'Doodle-oke',
        selfie_challenge: 'Selfie Challenge',
        karaoke_bracket: 'Karaoke Bracket',
        bingo: 'Bingo',
        trivia_pop: 'Trivia Pop',
        wyr: 'Would You Rather',
        riding_scales: 'Riding Scales',
        flappy_bird: 'Flappy Bird',
        vocal_challenge: 'Vocal Challenge',
        applause: 'Applause Meter',
        applause_countdown: 'Applause Countdown',
        applause_result: 'Applause Result'
    }[activeMode] || activeMode;

    useEffect(() => () => {
        if (interactionTimerRef.current) {
            clearTimeout(interactionTimerRef.current);
            interactionTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (activeMode !== 'doodle_oke' || !roomCode || !doodlePromptId) {
            setDoodleSubmissions([]);
            return;
        }
        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'doodle_submissions'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', doodlePromptId)
        );
        return onSnapshot(q, (snap) => {
            const docs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            docs.sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp));
            setDoodleSubmissions(docs);
        });
    }, [activeMode, roomCode, doodlePromptId]);

    useEffect(() => {
        if (activeMode !== 'selfie_challenge' || !roomCode || !selfiePromptId) {
            setSelfieSubmissions([]);
            return;
        }
        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_submissions'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', selfiePromptId)
        );
        return onSnapshot(q, (snap) => {
            const docs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
            docs.sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp));
            setSelfieSubmissions(docs);
        });
    }, [activeMode, roomCode, selfiePromptId]);

    const doodleVisibleCount = doodleRequireReview
        ? doodleSubmissions.filter((submission) => doodleApprovedSet.has(submission.uid)).length
        : doodleSubmissions.length;
    const doodlePendingCount = doodleRequireReview
        ? doodleSubmissions.filter((submission) => !doodleApprovedSet.has(submission.uid)).length
        : 0;
    const selfieApprovedCount = selfie?.requireApproval
        ? selfieSubmissions.filter((submission) => submission.approved).length
        : selfieSubmissions.length;
    const selfiePendingCount = selfie?.requireApproval
        ? Math.max(0, selfieSubmissions.length - selfieApprovedCount)
        : 0;

    const patchDoodle = async (patch = {}, message = '') => {
        if (!doodle) return;
        setBusy(true);
        try {
            await updateRoom({
                doodleOke: {
                    ...doodle,
                    ...patch,
                    updatedAt: nowMs()
                }
            });
            if (message) toast(message);
        } catch (err) {
            hostLogger.error('Host controlpad doodle patch failed', err);
            toast('Could not update Doodle settings');
        } finally {
            setBusy(false);
        }
    };

    const patchSelfie = async (patch = {}, message = '') => {
        if (!selfie) return;
        setBusy(true);
        try {
            await updateRoom({
                selfieChallenge: {
                    ...selfie,
                    ...patch
                }
            });
            if (message) toast(message);
        } catch (err) {
            hostLogger.error('Host controlpad selfie patch failed', err);
            toast('Could not update Selfie settings');
        } finally {
            setBusy(false);
        }
    };

    const toggleDoodleReview = async () => {
        const next = !doodleRequireReview;
        const patch = { requireReview: next };
        if (!next) patch.approvedUids = [];
        await patchDoodle(patch, next ? 'Host review enabled' : 'Auto-show enabled');
    };

    const approveDoodleUid = async (uid) => {
        if (!uid) return;
        const next = Array.from(new Set([...doodleApprovedUids, uid]));
        await patchDoodle({ approvedUids: next }, 'Sketch approved for TV');
    };

    const hideDoodleUid = async (uid) => {
        if (!uid) return;
        const next = doodleApprovedUids.filter((existingUid) => existingUid !== uid);
        await patchDoodle({ approvedUids: next }, 'Sketch hidden from TV');
    };

    const approveAllDoodles = async () => {
        const next = Array.from(new Set(doodleSubmissions.map((submission) => submission.uid).filter(Boolean)));
        await patchDoodle({ approvedUids: next }, 'All sketches approved');
    };

    const clearDoodleApprovals = async () => {
        await patchDoodle({ approvedUids: [] }, 'Approvals cleared');
    };

    const openTv = () => {
        if (!roomCode) return;
        window.open(`${appBase}?room=${roomCode}&mode=tv`, '_blank', 'noopener,noreferrer');
    };

    const closeGameMode = async () => {
        try {
            await updateRoom({ activeMode: 'karaoke' });
            toast('Returned to karaoke mode');
        } catch (err) {
            hostLogger.error('Host controlpad close mode failed', err);
            toast('Could not close game mode');
        }
    };

    const logHostInteraction = async (text) => {
        if (!roomCode || !text) return;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), {
                roomCode,
                user: 'HOST',
                text,
                icon: 'GAME',
                timestamp: serverTimestamp()
            });
        } catch (err) {
            hostLogger.debug('Host controlpad activity log failed', err);
        }
    };

    const triggerTemporaryLightMode = async (mode, durationMs = 9000) => {
        const safeDuration = Math.max(3000, Number(durationMs || 9000));
        if (interactionTimerRef.current) {
            clearTimeout(interactionTimerRef.current);
            interactionTimerRef.current = null;
        }
        await updateRoom({ lightMode: mode });
        interactionTimerRef.current = setTimeout(() => {
            updateRoom({ lightMode: 'off' }).catch((err) => hostLogger.debug('Light mode reset failed', err));
            interactionTimerRef.current = null;
        }, safeDuration);
    };

    const modeInteractionConfig = {
        doodle_oke: {
            icon: 'fa-pencil',
            label: doodle?.status === 'drawing'
                ? 'Drop The Pencil'
                : doodle?.status === 'voting'
                    ? 'Reveal Prompt'
                    : 'Encore Doodle',
            description: doodle?.status === 'drawing'
                ? 'Force all sketches into voting now.'
                : doodle?.status === 'voting'
                    ? 'Reveal the lyric prompt immediately.'
                    : 'Start a fresh encore doodle round.'
        },
        selfie_challenge: {
            icon: 'fa-camera-retro',
            label: 'Photo Bomb TV',
            description: 'Throw a random selfie submission onto TV.'
        },
        bingo: {
            icon: 'fa-crosshairs',
            label: 'Mystery Spotlight',
            description: 'Highlight a random bingo tile on TV.'
        },
        trivia_pop: {
            icon: 'fa-lightbulb',
            label: 'Reveal Answer',
            description: 'Flip trivia into reveal mode.'
        },
        trivia_reveal: {
            icon: 'fa-rotate-left',
            label: 'Back To Voting',
            description: 'Return trivia to voting mode.'
        },
        wyr: {
            icon: 'fa-chart-pie',
            label: 'Reveal Crowd Split',
            description: 'Flip WYR into reveal mode.'
        },
        wyr_reveal: {
            icon: 'fa-rotate-left',
            label: 'Back To Voting',
            description: 'Return WYR to voting mode.'
        },
        karaoke_bracket: {
            icon: 'fa-bolt',
            label: 'Bracket Hype Drop',
            description: 'Trigger a bracket bonus drop + crowd vote pulse.'
        },
        flappy_bird: {
            icon: 'fa-feather-pointed',
            label: 'Bird Blitz FX',
            description: 'Hit the room with a strobe burst.'
        },
        vocal_challenge: {
            icon: 'fa-wave-square',
            label: 'Power Note Aura',
            description: 'Trigger a temporary ballad glow.'
        },
        riding_scales: {
            icon: 'fa-cloud-bolt',
            label: 'Scale Storm',
            description: 'Trigger storm lighting during the round.'
        },
        applause: {
            icon: 'fa-hands-clapping',
            label: 'Crowd Surge',
            description: 'Drop a crowd bonus and hype pulse.'
        },
        applause_countdown: {
            icon: 'fa-hands-clapping',
            label: 'Crowd Surge',
            description: 'Drop a crowd bonus and hype pulse.'
        },
        applause_result: {
            icon: 'fa-hands-clapping',
            label: 'Crowd Surge',
            description: 'Drop a crowd bonus and hype pulse.'
        }
    }[activeMode] || {
        icon: 'fa-wand-magic-sparkles',
        label: 'Host Boost',
        description: 'Trigger a quick hype burst.'
    };

    const runModeInteraction = async () => {
        if (busy) return;
        setBusy(true);
        try {
            if (activeMode === 'doodle_oke' && doodle) {
                const phase = doodle?.status || 'drawing';
                if (phase === 'drawing') {
                    await updateRoom({ doodleOke: { ...doodle, status: 'voting', endsAt: nowMs() - 1, updatedAt: nowMs() } });
                    toast('Drawing locked. Voting is now live.');
                } else if (phase === 'voting') {
                    await updateRoom({ doodleOke: { ...doodle, status: 'reveal', guessEndsAt: nowMs() - 1, updatedAt: nowMs() } });
                    toast('Prompt revealed.');
                } else {
                    const cfg = room?.doodleOkeConfig || {};
                    const prompts = Array.isArray(cfg.prompts) ? cfg.prompts.filter(Boolean) : [];
                    const durationMs = Math.max(10000, Number(cfg.durationMs || doodle?.durationMs || 45000));
                    const guessMs = Math.max(5000, Number(cfg.guessMs || doodle?.guessMs || 12000));
                    const now = nowMs();
                    const prompt = prompts.length
                        ? prompts[Math.floor(Math.random() * prompts.length)]
                        : (doodle?.prompt || 'Encore doodle');
                    const promptId = `${now}_${Math.random().toString(36).slice(2, 7)}`;
                    await updateRoom({
                        doodleOke: {
                            ...doodle,
                            status: 'drawing',
                            prompt,
                            promptId,
                            startedAt: now,
                            endsAt: now + durationMs,
                            guessEndsAt: now + durationMs + guessMs,
                            winner: null,
                            winnerAwardedAt: null,
                            approvedUids: [],
                            updatedAt: now
                        }
                    });
                    toast('Encore doodle round started.');
                }
                await logHostInteraction('triggered a Doodle-oke host move.');
                return;
            }

            if (activeMode === 'selfie_challenge' && selfie) {
                const pool = selfie?.requireApproval
                    ? selfieSubmissions.filter((submission) => submission.approved)
                    : selfieSubmissions;
                if (!pool.length) {
                    toast('No selfie submissions available yet.');
                    return;
                }
                const pick = pool[Math.floor(Math.random() * pool.length)];
                await updateRoom({
                    photoOverlay: {
                        url: pick.url,
                        userName: pick.userName || pick.name || 'Guest',
                        mode: 'selfie_challenge',
                        copy: 'Host spotlight pick',
                        timestamp: nowMs()
                    }
                });
                toast('Photo bomb sent to TV.');
                await logHostInteraction('launched a selfie photo bomb.');
                return;
            }

            if (activeMode === 'bingo') {
                const tiles = Array.isArray(room?.bingoData) ? room.bingoData : [];
                const revealed = room?.bingoRevealed || {};
                const candidates = tiles
                    .map((tile, idx) => ({ tile, idx }))
                    .filter(({ tile, idx }) => !revealed?.[idx] && !tile?.free);
                if (!candidates.length) {
                    toast('No eligible bingo tiles to spotlight.');
                    return;
                }
                const mysteryCandidates = room?.bingoMode === 'mystery'
                    ? candidates.filter(({ tile }) => tile?.type === 'mystery' || tile?.content)
                    : [];
                const source = mysteryCandidates.length ? mysteryCandidates : candidates;
                const selected = source[Math.floor(Math.random() * source.length)];
                await updateRoom({
                    highlightedTile: selected.idx,
                    bingoFocus: {
                        index: selected.idx,
                        pickerUid: 'host_controlpad',
                        pickerName: 'Host Spotlight',
                        at: serverTimestamp()
                    }
                });
                toast(`Spotlighted tile #${selected.idx + 1}.`);
                await logHostInteraction('spotlighted a bingo tile.');
                return;
            }

            if (activeMode === 'trivia_pop' || activeMode === 'trivia_reveal') {
                const toReveal = activeMode === 'trivia_pop';
                await updateRoom({
                    activeMode: toReveal ? 'trivia_reveal' : 'trivia_pop',
                    triviaQuestion: {
                        ...(room?.triviaQuestion || {}),
                        status: toReveal ? 'reveal' : 'live',
                        revealedAt: toReveal ? nowMs() : null
                    }
                });
                toast(toReveal ? 'Trivia answer revealed.' : 'Trivia voting resumed.');
                await logHostInteraction(toReveal ? 'revealed the trivia answer.' : 'reopened trivia voting.');
                return;
            }

            if (activeMode === 'wyr' || activeMode === 'wyr_reveal') {
                const toReveal = activeMode === 'wyr';
                await updateRoom({
                    activeMode: toReveal ? 'wyr_reveal' : 'wyr',
                    wyrData: {
                        ...(room?.wyrData || {}),
                        status: toReveal ? 'reveal' : 'live',
                        revealedAt: toReveal ? nowMs() : null
                    }
                });
                toast(toReveal ? 'WYR results revealed.' : 'WYR voting resumed.');
                await logHostInteraction(toReveal ? 'revealed the WYR split.' : 'reopened WYR voting.');
                return;
            }

            if (activeMode === 'karaoke_bracket') {
                await updateRoom({
                    bonusDrop: { id: nowMs(), points: 75, by: 'Bracket Hype' },
                    karaokeBracket: {
                        ...(room?.karaokeBracket || {}),
                        crowdVotingEnabled: true
                    }
                });
                toast('Bracket hype drop sent (+75).');
                await logHostInteraction('triggered a bracket hype drop.');
                return;
            }

            if (activeMode === 'flappy_bird') {
                const now = nowMs();
                await updateRoom({
                    lightMode: 'strobe',
                    strobeSessionId: `host_fx_${now}`,
                    strobeCountdownUntil: now,
                    strobeEndsAt: now + 7000,
                    strobeResults: null
                });
                toast('Bird Blitz FX triggered.');
                await logHostInteraction('triggered Bird Blitz FX.');
                return;
            }

            if (activeMode === 'vocal_challenge') {
                await triggerTemporaryLightMode('ballad', 9000);
                toast('Power Note Aura triggered.');
                await logHostInteraction('triggered Power Note Aura.');
                return;
            }

            if (activeMode === 'riding_scales') {
                const now = nowMs();
                const totalMs = STORM_SEQUENCE.approachMs + STORM_SEQUENCE.peakMs + STORM_SEQUENCE.passMs + STORM_SEQUENCE.clearMs;
                await updateRoom({
                    lightMode: 'storm',
                    stormStartedAt: now,
                    stormPhase: 'approach',
                    stormConfig: STORM_SEQUENCE,
                    stormEndsAt: now + totalMs
                });
                toast('Scale Storm triggered.');
                await logHostInteraction('triggered Scale Storm FX.');
                return;
            }

            if (['applause', 'applause_countdown', 'applause_result'].includes(activeMode)) {
                await updateRoom({ bonusDrop: { id: nowMs(), points: 50, by: 'Crowd Surge' } });
                toast('Crowd Surge drop sent.');
                await logHostInteraction('triggered a crowd surge drop.');
                return;
            }

            await updateRoom({ bonusDrop: { id: nowMs(), points: 35, by: 'Host Boost' } });
            toast('Host boost sent.');
            await logHostInteraction('triggered a host boost.');
        } catch (err) {
            hostLogger.error('Host controlpad mode interaction failed', err);
            toast('Could not trigger host interaction');
        } finally {
            setBusy(false);
        }
    };

    if (!activeMode || activeMode === 'karaoke') return null;

    const isDoodle = activeMode === 'doodle_oke';
    const isSelfie = activeMode === 'selfie_challenge';
    const controlpadHint = isDoodle
        ? (doodleRequireReview
            ? (doodlePendingCount > 0
                ? `Next action: approve sketches to show them on TV (${doodlePendingCount} pending).`
                : 'No pending sketches. Approved sketches are live on TV.')
            : 'Auto-show is ON. New sketches appear on TV immediately.')
        : isSelfie
            ? (selfie?.requireApproval
                ? `Next action: approve submissions so they appear in voting (${selfiePendingCount} pending).`
                : 'Auto-show is ON. Submissions go straight into voting.')
            : modeInteractionConfig.description;

    return (
        <div className={`${STYLES.panel} mb-4 border border-[#00C4D9]/35 bg-gradient-to-r from-zinc-950/95 via-[#0f1828]/95 to-[#211025]/95`}>
            <div className="p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Host Controlpad</div>
                        <div className="text-2xl font-bebas text-cyan-300 mt-1">{modeLabel} Live</div>
                        <div className="text-sm text-zinc-200 mt-1">{controlpadHint}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={runModeInteraction}
                            disabled={busy}
                            className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-xs ${busy ? 'opacity-60 cursor-not-allowed' : ''}`}
                            title={modeInteractionConfig.description}
                        >
                            <i className={`fa-solid ${modeInteractionConfig.icon} mr-1`}></i> {modeInteractionConfig.label}
                        </button>
                        <button onClick={() => setTab('games')} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-xs`}>
                            <i className="fa-solid fa-gamepad mr-1"></i> Games
                        </button>
                        <button onClick={() => setTab('stage')} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-xs`}>
                            <i className="fa-solid fa-sliders mr-1"></i> Crowd FX
                        </button>
                        <button onClick={openTv} className={`${STYLES.btnStd} ${STYLES.btnInfo} px-3 py-1 text-xs`}>
                            <i className="fa-solid fa-tv mr-1"></i> Open TV
                        </button>
                        <button onClick={closeGameMode} className={`${STYLES.btnStd} ${STYLES.btnDanger} px-3 py-1 text-xs`}>
                            <i className="fa-solid fa-xmark mr-1"></i> End Mode
                        </button>
                    </div>
                </div>

                {isDoodle && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Phase</div>
                                <div className="text-sm font-bold text-white mt-1">{doodle?.status || 'drawing'}</div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Submitted</div>
                                <div className="text-sm font-bold text-white mt-1">{doodleSubmissions.length}</div>
                            </div>
                            <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Visible on TV</div>
                                <div className="text-sm font-bold text-cyan-200 mt-1">{doodleVisibleCount}</div>
                            </div>
                            <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500">Pending Review</div>
                                <div className="text-sm font-bold text-amber-200 mt-1">{doodlePendingCount}</div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={toggleDoodleReview}
                                disabled={busy}
                                className={`${STYLES.btnStd} ${doodleRequireReview ? STYLES.btnSecondary : STYLES.btnHighlight} px-3 py-1 text-xs ${busy ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                {doodleRequireReview ? 'Switch to Auto-show' : 'Require Host Review'}
                            </button>
                            <button
                                onClick={approveAllDoodles}
                                disabled={busy || !doodleSubmissions.length}
                                className={`${STYLES.btnStd} ${STYLES.btnInfo} px-3 py-1 text-xs ${(busy || !doodleSubmissions.length) ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Approve All
                            </button>
                            <button
                                onClick={clearDoodleApprovals}
                                disabled={busy || !doodleApprovedUids.length}
                                className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-xs ${(busy || !doodleApprovedUids.length) ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                Hide Approved
                            </button>
                        </div>
                        {doodleSubmissions.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {doodleSubmissions.slice(0, 4).map((submission) => {
                                    const isApproved = doodleApprovedSet.has(submission.uid);
                                    return (
                                        <div key={submission.id} className="rounded-xl border border-zinc-700 bg-zinc-900/70 overflow-hidden">
                                            <img src={submission.image} alt={submission.name || 'Sketch'} className="w-full h-20 object-contain bg-zinc-950" />
                                            <div className="px-2 py-1.5 text-[11px] text-zinc-300">
                                                <div className="truncate font-bold">{submission.name || 'Guest'}</div>
                                                {doodleRequireReview ? (
                                                    <button
                                                        onClick={() => (isApproved ? hideDoodleUid(submission.uid) : approveDoodleUid(submission.uid))}
                                                        disabled={busy}
                                                        className={`${STYLES.btnStd} ${isApproved ? STYLES.btnHighlight : STYLES.btnNeutral} mt-1 w-full text-[10px] py-1 ${busy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    >
                                                        {isApproved ? 'Visible' : 'Approve'}
                                                    </button>
                                                ) : (
                                                    <div className="text-emerald-300 mt-1">Auto visible</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

                {isSelfie && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Status</div>
                            <div className="text-sm font-bold text-white mt-1">{selfie?.status || 'collecting'}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Submitted</div>
                            <div className="text-sm font-bold text-white mt-1">{selfieSubmissions.length}</div>
                        </div>
                        <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Visible</div>
                            <div className="text-sm font-bold text-cyan-200 mt-1">{selfieApprovedCount}</div>
                        </div>
                        <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Pending</div>
                            <div className="text-sm font-bold text-amber-200 mt-1">{selfiePendingCount}</div>
                        </div>
                        <div className="md:col-span-4 flex flex-wrap gap-2 mt-1">
                            <button
                                onClick={() => patchSelfie({ requireApproval: !selfie?.requireApproval }, selfie?.requireApproval ? 'Auto-show enabled' : 'Host approval enabled')}
                                disabled={busy || !selfie}
                                className={`${STYLES.btnStd} ${selfie?.requireApproval ? STYLES.btnSecondary : STYLES.btnHighlight} px-3 py-1 text-xs ${(busy || !selfie) ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                {selfie?.requireApproval ? 'Switch to Auto-show' : 'Require Host Approval'}
                            </button>
                            {selfie?.status === 'collecting' && (
                                <button
                                    onClick={() => patchSelfie({ status: 'voting' }, 'Voting started')}
                                    disabled={busy || !selfie}
                                    className={`${STYLES.btnStd} ${STYLES.btnInfo} px-3 py-1 text-xs ${(busy || !selfie) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    Start Voting
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
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
            hostLogger.error('Delete photo failed', e);
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

const AudienceMiniPreview = ({
    room,
    roomCode,
    appBase,
    currentSong,
    queueCount,
    collapsed = false,
    onToggleCollapsed,
    onHide
}) => {
    const modeLabelMap = {
        karaoke: 'Karaoke',
        bingo: `Bingo${room?.bingoMode === 'mystery' ? ' (Mystery)' : ''}`,
        trivia_pop: 'Trivia',
        trivia_reveal: 'Trivia Reveal',
        wyr: 'Would You Rather',
        wyr_reveal: 'Would You Rather',
        doodle_oke: 'Doodle-oke',
        selfie_challenge: 'Selfie Challenge',
        selfie_cam: 'Selfie Cam',
        flappy_bird: 'Flappy Bird',
        vocal_challenge: 'Vocal Challenge',
        riding_scales: 'Riding Scales',
        karaoke_bracket: 'Sweet 16 Bracket',
        applause: 'Applause Meter',
        applause_countdown: 'Applause Countdown',
        applause_result: 'Applause Result'
    };
    const modeLabel = modeLabelMap[room?.activeMode] || (room?.activeMode || 'Karaoke');
    const layoutLabel = room?.layoutMode || 'standard';
    const viewHref = `${appBase}?room=${roomCode}&mode=tv`;
    return (
        <div className="fixed right-3 bottom-3 z-[35] w-[320px] max-w-[calc(100vw-24px)]">
            <div className="bg-zinc-950/95 border border-white/15 rounded-2xl shadow-[0_20px_45px_rgba(0,0,0,0.55)] overflow-hidden backdrop-blur-sm">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/40">
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Audience View</div>
                        <div className="text-xs text-cyan-200 truncate">{modeLabel}</div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onToggleCollapsed}
                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-2 py-1 text-[10px]`}
                            title={collapsed ? 'Expand preview' : 'Collapse preview'}
                        >
                            <i className={`fa-solid ${collapsed ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                        </button>
                        <a
                            href={viewHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${STYLES.btnStd} ${STYLES.btnInfo} px-2 py-1 text-[10px]`}
                            title="Open full TV output"
                        >
                            <i className="fa-solid fa-up-right-from-square"></i>
                        </a>
                        <button
                            onClick={onHide}
                            className={`${STYLES.btnStd} ${STYLES.btnDanger} px-2 py-1 text-[10px]`}
                            title="Hide preview"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                {!collapsed && (
                    <div className="p-2">
                        <div className="relative rounded-xl border border-white/10 overflow-hidden aspect-video bg-gradient-to-br from-zinc-900 via-[#141d2b] to-[#0b1020]">
                            {room?.activeMode && room.activeMode !== 'karaoke' ? (
                                <div className="absolute inset-0 p-3 flex flex-col justify-between">
                                    <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Live Experience</div>
                                    <div className="text-lg font-bebas text-cyan-300 leading-none">{modeLabel}</div>
                                    <div className="text-[11px] text-zinc-200">
                                        {room?.activeMode === 'trivia_pop' && room?.triviaQuestion?.q ? room.triviaQuestion.q : null}
                                        {room?.activeMode === 'wyr' && room?.wyrData?.question ? room.wyrData.question : null}
                                        {room?.activeMode === 'bingo'
                                            ? `Board: ${room?.bingoSize || 5}x${room?.bingoSize || 5} • TV ${room?.bingoShowTv === false ? 'off' : 'on'}`
                                            : null}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Layout {layoutLabel}</div>
                                </div>
                            ) : currentSong ? (
                                <div className="absolute inset-0 p-3 flex flex-col justify-between">
                                    <div className="text-[10px] uppercase tracking-[0.35em] text-zinc-400">Now Performing</div>
                                    <div className="flex items-center gap-2 min-w-0">
                                        {currentSong.albumArtUrl ? (
                                            <img src={currentSong.albumArtUrl} alt="Now playing art" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center text-lg">{currentSong.emoji || EMOJI.mic}</div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-white truncate">{currentSong.songTitle || 'Song'}</div>
                                            <div className="text-[11px] text-zinc-300 truncate">{currentSong.singerName || 'Singer'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                                        <span className={`px-2 py-1 rounded-full border ${room?.showLyricsTv ? 'border-emerald-400/40 text-emerald-200 bg-emerald-500/10' : 'border-zinc-600 text-zinc-500'}`}>Lyrics</span>
                                        <span className={`px-2 py-1 rounded-full border ${room?.showVisualizerTv ? 'border-cyan-400/40 text-cyan-200 bg-cyan-500/10' : 'border-zinc-600 text-zinc-500'}`}>Visualizer</span>
                                        <span className="px-2 py-1 rounded-full border border-white/15 text-zinc-300">Queue {queueCount}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="absolute inset-0 p-3 flex flex-col items-center justify-center text-center">
                                    <div className="text-2xl">{EMOJI.mic}</div>
                                    <div className="text-sm text-zinc-200 mt-2 font-bold">Stage Open</div>
                                    <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-1">{roomCode}</div>
                                </div>
                            )}
                        </div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.24em] text-zinc-500 px-1">
                            State-synced thumbnail • Queue {queueCount} • Chat {room?.chatShowOnTv ? 'TV on' : 'TV off'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const QueueTab = ({ songs, room, roomCode, appBase, updateRoom, logActivity, localLibrary, playSfxSafe, toggleHowToPlay, startStormSequence, stopStormSequence, startBeatDrop, users, dropBonus, giftPointsToUser, tipPointRate, setTipPointRate, marqueeEnabled, setMarqueeEnabled, sfxMuted, setSfxMuted, sfxLevel, sfxVolume, setSfxVolume, searchSources, ytIndex, setYtIndex, persistYtIndex, autoDj, setAutoDj, autoBgMusic, setAutoBgMusic, playingBg, setBgMusicState, startReadyCheck, chatShowOnTv, setChatShowOnTv, chatUnread, dmUnread, chatEnabled, setChatEnabled, chatAudienceMode, setChatAudienceMode, chatDraft, setChatDraft, chatMessages, sendHostChat, sendHostDmMessage, itunesBackoffRemaining, pinnedChatIds, setPinnedChatIds, chatViewMode, handleChatViewMode, appleMusicPlaying, appleMusicStatus, playAppleMusicTrack, pauseAppleMusic, resumeAppleMusic, stopAppleMusic, hostName, fetchTop100Art, openChatSettings, dmTargetUid, setDmTargetUid, dmDraft, setDmDraft, getAppleMusicUserToken, silenceAll, compactViewport, openHostSettings, openLiveEffects, showLegacyLiveEffects = true, pendingModerationCount = 0, runMissionHypeMoment = null, missionControlEnabled = false, missionControlCohort = 'legacy', openModerationInbox = null }) => {
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
    const [essentialsMode, setEssentialsMode] = useState(() => {
        try {
            if (typeof window === 'undefined') return true;
            const saved = window.localStorage.getItem('bross_host_essentials_mode');
            if (saved === null) return true;
            return saved !== '0';
        } catch {
            return true;
        }
    });
    const [showLegacyQuickActions, setShowLegacyQuickActions] = useState(() => !missionControlEnabled);
    useEffect(() => {
        try {
            if (typeof window === 'undefined') return;
            window.localStorage.setItem('bross_host_essentials_mode', essentialsMode ? '1' : '0');
        } catch {
            // Ignore persistence failures.
        }
    }, [essentialsMode]);
    useEffect(() => {
        if (!missionControlEnabled) {
            setShowLegacyQuickActions(true);
            return;
        }
        setShowLegacyQuickActions(false);
    }, [missionControlEnabled]);
    const roomChatMessages = chatMessages.filter((msg) => isLoungeChatMessage(msg));
    const hostDmMessages = chatMessages.filter((msg) => isDirectChatMessage(msg));
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
    const missionRecommendation = useMemo(() => getRecommendedHostAction({
        room,
        queue,
        current,
        pendingModerationCount
    }), [room, queue, current, pendingModerationCount]);
    const missionRecommendationShownRef = useRef('');
    useEffect(() => {
        if (!missionControlEnabled || !missionRecommendation?.id) return;
        const key = `${missionRecommendation.id}:${roomCode || ''}:${room?.activeMode || 'karaoke'}`;
        if (missionRecommendationShownRef.current === key) return;
        missionRecommendationShownRef.current = key;
        trackEvent('host_mission_recommendation_shown', {
            room_code: roomCode || '',
            recommendation_id: missionRecommendation.id,
            feature_flag: 'mission_control_v1',
            cohort: missionControlCohort,
            timestamp: nowMs()
        });
    }, [missionControlEnabled, missionRecommendation, roomCode, room?.activeMode, missionControlCohort]);
    useEffect(() => {
        if (!missionControlEnabled || !roomCode || !missionRecommendation?.id) return;
        if (room?.missionControl?.lastSuggestedAction === missionRecommendation.id) return;
        updateRoom({
            missionControl: {
                ...(room?.missionControl || {}),
                version: MISSION_CONTROL_VERSION,
                enabled: true,
                lastSuggestedAction: missionRecommendation.id
            }
        }).catch((error) => hostLogger.debug('Mission recommendation state write skipped', error));
    }, [missionControlEnabled, roomCode, missionRecommendation?.id, room?.missionControl, updateRoom]);
    const openPanelCount = useMemo(
        () => Object.values(panelLayout || {}).filter(Boolean).length,
        [panelLayout]
    );
    const runUiFeatureCheck = () => {
        if (typeof document === 'undefined') return;
        const missing = HOST_UI_FEATURE_CHECKLIST.filter((item) => !document.querySelector(item.selector));
        if (missing.length) {
            hostLogger.debug('[Host UI Feature Check] Missing controls:', missing);
            toast(`UI feature check: ${missing.length} missing control(s).`);
            return;
        }
        toast(`UI feature check passed (${HOST_UI_FEATURE_CHECKLIST.length} controls).`);
    };
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
    }, [quickAddNotice, setQuickAddNotice]);
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
                hostLogger.debug('Failed to stop Apple Music during media override', err);
            }
        })();
        return () => { cancelled = true; };
    }, [current?.id, current?.mediaUrl, current?.appleMusicId, room?.mediaUrl, room?.appleMusicPlayback?.status, appleMusicPlaying, stopAppleMusic, updateRoom, current, room]);
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
            hostLogger.error('Command failed', error);
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
            const base = nowMs();
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
    }, [searchQ, localLibrary, ytIndex, searchSources, setResults]);

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
            priorityScore: nowMs(),
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
                timestamp: nowMs()
            },
            selfieMomentExpiresAt: nowMs() + 12000
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
                        timestamp: nowMs()
                    }
                });
                await triggerHallOfFameMoment({
                    songId,
                    singerName: songEntry.singerName || '',
                    songTitle: safeTitle
                });
            }
        } catch (err) {
            hostLogger.error('Failed to log performance', err);
        }
    };

    async function updateStatus(id, status) { 
        if(status==='performing') { 
            const current = songs.find(x => x.status === 'performing');
            if (current && current.id !== id) {
                toast('Another singer is already on stage');
                return;
            }
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', id), {
                status,
                performingStartedAt: serverTimestamp()
            });
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
                    videoStartTimestamp: autoStartMedia ? nowMs() : null,
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
                await updateRoom({ lastPerformance: { ...s, applauseScore: room?.applausePeak||0, timestamp: nowMs(), albumArtUrl: s.albumArtUrl || '', topFan, vibeStats }, activeMode: 'karaoke', mediaUrl: '', singAlongMode: false, videoPlaying: false, showLyricsTv: false, showVisualizerTv: false, showLyricsSinger: false, appleMusicPlayback: null }); 
                await logPerformance({ ...s, applauseScore: room?.applausePeak || 0 });
                logActivity(roomCode, s.singerName, `crushed ${s.songTitle}!`, EMOJI.star);
                toast("Performance Finished"); 
            } 
        } 
    }

    // Unified play/pause for the current backing source (Apple or media URL).
    async function togglePlay() {
        if (!current) return;
        const stageMediaUrl = resolveStageMediaUrl(current, room);
        const currentPlayback = normalizeBackingChoice({
            mediaUrl: stageMediaUrl,
            appleMusicId: current?.appleMusicId
        });
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
        const now = nowMs();
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
    }

    const nextQueueSong = queue[0];
    const commandPaletteItems = [
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
    const commandQueryNormalized = (commandQuery || '').trim().toLowerCase();
    /* eslint-disable react-hooks/refs */
    const filteredCommands = !commandQueryNormalized
        ? commandPaletteItems
        : commandPaletteItems.filter((item) => {
            const haystack = `${item.label} ${item.hint || ''} ${item.keywords || ''}`.toLowerCase();
            return haystack.includes(commandQueryNormalized);
        });

    const runMissionAction = useCallback(async (actionId = '') => {
        const action = String(actionId || '').trim();
        if (!action) return;
        try {
            if (action === 'start_next') {
                if (queue[0]) await updateStatus(queue[0].id, 'performing');
            } else if (action === 'hype_moment') {
                if (typeof runMissionHypeMoment === 'function') {
                    await runMissionHypeMoment();
                }
            } else if (action === 'crowd_check') {
                await startReadyCheck();
            } else if (action === 'more') {
                setCommandOpen(true);
            } else if (action === 'review_moderation') {
                if (typeof openModerationInbox === 'function') {
                    openModerationInbox();
                } else {
                    openHostSettings?.();
                }
            }
            trackEvent('host_mission_live_action_used', {
                room_code: roomCode || '',
                action_id: action,
                recommendation_id: missionRecommendation?.id || '',
                feature_flag: missionControlEnabled ? 'mission_control_v1' : 'legacy',
                cohort: missionControlCohort,
                timestamp: nowMs()
            });
            if (missionRecommendation?.id === action) {
                trackEvent('host_mission_recommendation_accepted', {
                    room_code: roomCode || '',
                    recommendation_id: missionRecommendation.id,
                    feature_flag: missionControlEnabled ? 'mission_control_v1' : 'legacy',
                    cohort: missionControlCohort,
                    timestamp: nowMs()
                });
            }
        } catch (error) {
            hostLogger.error('Mission action failed', error);
            toast('Mission action failed.');
        }
    }, [
        queue,
        updateStatus,
        runMissionHypeMoment,
        startReadyCheck,
        roomCode,
        missionRecommendation,
        missionControlEnabled,
        missionControlCohort,
        openHostSettings,
        openModerationInbox,
        toast
    ]);
    
    // Helper to open youtube search
    const _openYT = (query) => {
        if (!query) return;
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' karaoke')}`, '_blank');
    };

    useEffect(() => {
        if (!compactViewport) return;
        setShowAddForm(false);
        setShowQueueList(true);
    }, [compactViewport, setShowAddForm, setShowQueueList]);

    const addToQueueSection = (
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
    );

    const queueListSection = (
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
    );

    return (
        <div className={`h-full flex flex-col ${compactViewport ? 'gap-2' : 'gap-3'} overflow-hidden relative`}>
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
            {missionControlEnabled && (
            <div className={`${STYLES.panel} px-3 py-2 border border-cyan-400/20 bg-[#041019]/85 sticky top-0 z-20`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-200">Mission Control</div>
                        <div className="text-xs text-zinc-300">
                            Recommended: <span className="text-white font-bold">{missionRecommendation?.label || 'No recommendation yet'}</span>
                            {missionRecommendation?.reason ? <span className="text-zinc-500"> | {missionRecommendation.reason}</span> : null}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${
                            missionRecommendation?.status === 'needs_attention'
                                ? 'border-amber-400/35 bg-amber-500/15 text-amber-100'
                                : missionRecommendation?.status === 'live'
                                    ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100'
                                    : 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
                        }`}>
                            {missionRecommendation?.status || 'ready'}
                        </span>
                        <button
                            onClick={() => runMissionAction('start_next')}
                            disabled={!queue[0]}
                            className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 text-[10px] ${!queue[0] ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            Start Next
                        </button>
                        <button
                            onClick={() => runMissionAction('hype_moment')}
                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 text-[10px]`}
                        >
                            Hype Moment
                        </button>
                        <button
                            onClick={() => runMissionAction('crowd_check')}
                            className={`${STYLES.btnStd} ${STYLES.btnInfo} px-3 text-[10px]`}
                        >
                            Crowd Check
                        </button>
                        <button
                            onClick={() => runMissionAction('more')}
                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-[10px]`}
                        >
                            More
                        </button>
                    </div>
                </div>
                {missionControlEnabled && missionRecommendation?.id && (
                    <button
                        onClick={() => runMissionAction(missionRecommendation.id)}
                        className="mt-2 w-full text-left rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 hover:border-cyan-300/50 transition-colors"
                    >
                        <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200">Smart Assist</div>
                        <div className="text-sm text-white font-bold mt-1">{missionRecommendation.label}</div>
                        <div className="text-xs text-zinc-300 mt-1">{missionRecommendation.reason || 'Suggested next action for room flow.'}</div>
                    </button>
                )}
            </div>
            )}
            <div className={`${STYLES.panel} px-3 py-2 border border-white/10 bg-black/25`}>
                <div className="flex flex-wrap items-center gap-2">
                    <div className={`text-[11px] uppercase tracking-[0.25em] text-zinc-400 mr-2 ${compactViewport ? 'hidden md:block' : ''}`}>
                        {missionControlEnabled ? 'Legacy Actions' : 'Quick Actions'}
                    </div>
                    <button
                        onClick={() => setCommandOpen(true)}
                        data-feature-id="quick-command-palette"
                        className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-3 text-[10px]`}
                    >
                        Command Palette
                    </button>
                    {missionControlEnabled && (
                        <button
                            onClick={() => setShowLegacyQuickActions((prev) => !prev)}
                            className={`${STYLES.btnStd} ${showLegacyQuickActions ? STYLES.btnInfo : STYLES.btnNeutral} px-3 text-[10px]`}
                        >
                            {showLegacyQuickActions ? 'Hide Legacy Actions' : 'Show Legacy Actions'}
                        </button>
                    )}
                    <button
                        onClick={() => setEssentialsMode((prev) => !prev)}
                        data-feature-id="quick-essentials-mode"
                        className={`${STYLES.btnStd} ${essentialsMode ? STYLES.btnInfo : STYLES.btnNeutral} px-3 text-[10px]`}
                    >
                        {essentialsMode ? 'Show Advanced' : 'Essentials Only'}
                    </button>
                    {(!missionControlEnabled || showLegacyQuickActions) && (
                        <>
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
                        onClick={() => openHostSettings?.()}
                        data-feature-id="quick-open-control-center"
                        className={`${STYLES.btnStd} ${STYLES.btnInfo} px-3 text-[10px]`}
                    >
                        Admin
                    </button>
                    <button
                        onClick={() => openLiveEffects?.()}
                        data-feature-id="quick-open-live-effects"
                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-[10px]`}
                    >
                        Live Effects
                    </button>
                    <button
                        onClick={openChatSettings}
                        data-feature-id="quick-chat-settings"
                        className={`${STYLES.btnStd} ${STYLES.btnInfo} px-3 text-[10px] ${compactViewport || essentialsMode ? 'hidden' : ''}`}
                    >
                        Chat Settings
                    </button>
                    <button
                        onClick={runUiFeatureCheck}
                        data-feature-id="quick-ui-feature-check"
                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 text-[10px] ${compactViewport || essentialsMode ? 'hidden' : ''}`}
                    >
                        UI Feature Check
                    </button>
                        </>
                    )}
                </div>
                {essentialsMode && (
                    <div className="mt-2 text-xs text-zinc-400">
                        Essentials mode keeps focus on queue flow, singer handoff, and TV control.
                        {missionControlEnabled ? ' Mission strip handles primary actions; legacy actions are optional.' : ' Advanced panels are still available via Show Advanced.'}
                    </div>
                )}
            </div>

            <div className={`flex-1 min-h-0 flex ${compactViewport ? 'flex-col gap-3' : 'flex-col md:flex-row gap-6'} overflow-hidden`}>
            {/* LEFT CONTROLS */}
            <div className={`w-full ${compactViewport ? 'order-2 max-h-[40vh]' : 'md:w-96'} flex-shrink-0 overflow-y-auto pr-2 custom-scrollbar`}>
                <div className={`${STYLES.panel} overflow-hidden`}>
                    {!essentialsMode && (
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
                    )}

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

                    {!essentialsMode && showLegacyLiveEffects && (
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
                    )}

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
                    {!essentialsMode && (
                        <>
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
                                    showVibeSync={showLegacyLiveEffects}
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
                        </>
                    )}

                </div>
            </div>

            {/* RIGHT QUEUE */}
            <div className={`flex-1 ${STYLES.panel} flex flex-col overflow-hidden min-w-0 ${compactViewport ? 'order-1 min-h-[52vh]' : ''}`}>
                {compactViewport ? (
                    <>
                        {queueListSection}
                        {addToQueueSection}
                    </>
                ) : (
                    <>
                        {addToQueueSection}
                        {queueListSection}
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
    const normalizedInitialCode = (initialCode || '').trim().toUpperCase();
    const [roomCode, setRoomCode] = useState('');
    const [roomCodeInput, setRoomCodeInput] = useState(normalizedInitialCode);
    const updateRoom = useCallback(async (updates = {}) => {
        if (!roomCode) throw new Error('Room code is required to update room state.');
        const encodedUpdates = encodeHostRoomUpdates(updates || {});
        if (!Object.keys(encodedUpdates).length) return;
        try {
            await updateRoomAsHost(roomCode, encodedUpdates);
            setHostUpdateDeploymentWarning('');
            hostUpdateWarningToastedRef.current = false;
        } catch (error) {
            if (isHostUpdateCallableUnavailableError(error)) {
                setHostUpdateDeploymentWarning(HOST_UPDATE_DEPLOYMENT_WARNING);
            }
            throw error;
        }
    }, [roomCode]);
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
            const remaining = Math.max(0, Math.ceil((itunesBackoffUntil - nowMs()) / 1000));
            setItunesBackoffRemaining(remaining);
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);

    const ensureAppleMusic = useCallback(async () => {
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
    }, [roomCode]);

    const connectAppleMusic = async () => {
        try {
            const instance = await ensureAppleMusic();
            await instance.authorize();
            setAppleMusicAuthorized(true);
            setAppleMusicStatus('Connected');
        } catch (e) {
            hostLogger.error(e);
            setAppleMusicStatus('Apple Music login failed.');
        }
    };

    const disconnectAppleMusic = async () => {
        try {
            const instance = appleMusicRef.current;
            if (instance?.unauthorize) await instance.unauthorize();
        } catch (e) {
            hostLogger.warn('Apple Music sign-out failed', e);
        }
        setAppleMusicAuthorized(false);
        setAppleMusicPlaying(false);
        setAppleMusicStatus('Disconnected');
    };

    const playAppleMusicTrack = useCallback(async (trackId, meta = {}) => {
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
                    startedAt: nowMs(),
                    status: 'playing'
                }
            });
        }
    }, [ensureAppleMusic, roomCode, updateRoom]);

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
                    pausedAt: nowMs()
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
                    resumedAt: nowMs()
                }
            });
        }
    };
    const stopAppleMusic = useCallback(async () => {
        const instance = appleMusicRef.current;
        if (!instance) return;
        try {
            if (typeof instance.stop === 'function') {
                await instance.stop();
            } else {
                await instance.pause();
            }
        } catch (e) {
            hostLogger.warn('Apple Music stop failed', e);
        }
        setAppleMusicPlaying(false);
    }, []);

    const playAppleMusicPlaylist = useCallback(async (playlistId, meta = {}) => {
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
            hostLogger.warn('Apple Music playlist lookup failed', e);
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
                    startedAt: nowMs(),
                    status: 'playing'
                }
            });
        }
    }, [ensureAppleMusic, roomCode, updateRoom]);

    const fetchAppleMusicPlaylistTitle = async (playlistId) => {
        if (!playlistId) return '';
        try {
            const instance = await ensureAppleMusic();
            const storefront = instance.storefrontId || 'us';
            const res = await instance.api.music(`v1/catalog/${storefront}/playlists/${playlistId}`);
            return res?.data?.data?.[0]?.attributes?.name || '';
        } catch (e) {
            hostLogger.warn('Apple Music playlist title lookup failed', e);
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
    const [tab, setTab] = useState('admin');
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
    const [viewportHeight, setViewportHeight] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 1080));
    const compactHostViewport = viewportHeight <= 900;
    const [audioPanelOpen, setAudioPanelOpen] = useState(() => {
        if (typeof window === 'undefined') return true;
        return window.innerHeight > 900;
    });
    const [showLaunchMenu, setShowLaunchMenu] = useState(false);
    const [showNavMenu, setShowNavMenu] = useState(false);
    const [showModerationInbox, setShowModerationInbox] = useState(false);
    const [autoOpenGameId, setAutoOpenGameId] = useState('');
    const [_appleMusicReady, setAppleMusicReady] = useState(false);
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
        return ts >= nowMs() - 5 * 60 * 1000;
    }).length;
    const lobbyTotalPoints = users.reduce((sum, u) => sum + (u.points || 0), 0);
    const lobbyTotalEmojis = users.reduce((sum, u) => sum + (u.totalEmojis || 0), 0);
    const queuedCount = useMemo(() => songs.filter(s => s.status === 'requested').length, [songs]);
    const performingCount = useMemo(() => songs.filter(s => s.status === 'performing').length, [songs]);
    const {
        activeBracket,
        bracketCrowdVotingEnabled,
        bracketShowAdvancePrompt
    } = useMemo(() => deriveBracketUiState(room), [room]);
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
    const [showSettings, setShowSettings] = useState(true);
    const [settingsTab, setSettingsTab] = useState('general');
    const [activeWorkspaceView, setActiveWorkspaceView] = useState('ops');
    const [activeWorkspaceSection, setActiveWorkspaceSection] = useState('ops.room_setup');
    const [settingsNavQuery, setSettingsNavQuery] = useState('');
    const [settingsNavOpen, setSettingsNavOpen] = useState(false);
    const [settingsRecentTabs, setSettingsRecentTabs] = useState(() => {
        try {
            if (typeof window === 'undefined') return ['general', 'media', 'chat'];
            const raw = window.localStorage.getItem('bross_host_settings_recent_tabs');
            if (!raw) return ['general', 'media', 'chat'];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return ['general', 'media', 'chat'];
            const cleaned = parsed
                .map((tab) => String(tab || '').trim())
                .filter((tab) => HOST_SETTINGS_TAB_KEYS.includes(tab));
            return cleaned.length ? cleaned.slice(0, 6) : ['general', 'media', 'chat'];
        } catch {
            return ['general', 'media', 'chat'];
        }
    });
    const [showAiSetupGuide, setShowAiSetupGuide] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onResize = () => setViewportHeight(window.innerHeight || 0);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    useEffect(() => {
        if (!compactHostViewport) return;
        setAudioPanelOpen(false);
    }, [compactHostViewport]);
    useEffect(() => {
        if (!showSettings) setSettingsNavOpen(false);
    }, [showSettings]);
    useEffect(() => {
        if (!HOST_SETTINGS_TAB_KEYS.includes(settingsTab)) return;
        setSettingsRecentTabs((prev) => {
            const deduped = [settingsTab, ...(prev || []).filter((tab) => tab !== settingsTab)];
            return deduped.slice(0, 6);
        });
    }, [settingsTab]);
    useEffect(() => {
        const sectionId = SETTINGS_TAB_TO_SECTION[settingsTab];
        if (!sectionId) return;
        const sectionMeta = getSectionMeta(sectionId);
        if (sectionMeta?.view) setActiveWorkspaceView(sectionMeta.view);
        setActiveWorkspaceSection(sectionId);
    }, [settingsTab]);
    useEffect(() => {
        try {
            if (typeof window === 'undefined') return;
            window.localStorage.setItem('bross_host_settings_recent_tabs', JSON.stringify(settingsRecentTabs || []));
        } catch {
            // Ignore persistence issues
        }
    }, [settingsRecentTabs]);
    useEffect(() => {
        setShowSettings(tab === 'admin');
    }, [tab]);
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
    const autoJoinAttemptKeyRef = useRef('');
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
    const [hostNightPreset, setHostNightPreset] = useState('custom');
    const [audienceBingoReopenEnabled, setAudienceBingoReopenEnabled] = useState(true);
    const [autoLyricsOnQueue, setAutoLyricsOnQueue] = useState(false);
    const [popTriviaEnabled, setPopTriviaEnabled] = useState(true);
    const [audiencePreviewVisible, setAudiencePreviewVisible] = useState(() => {
        try {
            if (typeof window === 'undefined') return true;
            const saved = localStorage.getItem('bross_host_audience_preview_visible');
            return saved === null ? true : saved === '1';
        } catch {
            return true;
        }
    });
    const [audiencePreviewCollapsed, setAudiencePreviewCollapsed] = useState(() => {
        try {
            if (typeof window === 'undefined') return false;
            return localStorage.getItem('bross_host_audience_preview_collapsed') === '1';
        } catch {
            return false;
        }
    });
    const [autoBgFadeOutMs, setAutoBgFadeOutMs] = useState(900);
    const [autoBgFadeInMs, setAutoBgFadeInMs] = useState(900);
    const [autoBgMixDuringSong, setAutoBgMixDuringSong] = useState(0);
    const [lobbyTab, setLobbyTab] = useState('users');
    const [bracketBusy, setBracketBusy] = useState(false);
    const [bracketNoShow, setBracketNoShow] = useState(null);
    const [bracketNoShowNow, setBracketNoShowNow] = useState(nowMs());
    const bracketNoShowCountdownSec = bracketNoShow?.deadlineMs
        ? Math.max(0, Math.ceil((bracketNoShow.deadlineMs - bracketNoShowNow) / 1000))
        : 0;
    const bracketNoShowTimeoutRef = useRef(null);
    const bracketNoShowTickRef = useRef(null);
    const forfeitBracketContestantRef = useRef(null);
    const [tight15QueueBusyUid, setTight15QueueBusyUid] = useState('');
    const [tight15ProfileBusyUid, setTight15ProfileBusyUid] = useState('');
    const [tight15Profile, setTight15Profile] = useState(null);
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
    const [entryError, setEntryError] = useState('');
    const [hostUpdateDeploymentWarning, setHostUpdateDeploymentWarning] = useState('');
    const hostUpdateWarningToastedRef = useRef(false);
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
        period: getCurrentUsagePeriodKey(),
        meters: {},
        totals: { estimatedOverageCents: 0 },
        loading: false,
        error: ''
    });
    const [selectedUsagePeriod, setSelectedUsagePeriod] = useState(getCurrentUsagePeriodKey());
    const [invoiceDraft, setInvoiceDraft] = useState(null);
    const [invoiceDraftLoading, setInvoiceDraftLoading] = useState(false);
    const [invoiceSaveLoading, setInvoiceSaveLoading] = useState(false);
    const [invoiceHistoryLoading, setInvoiceHistoryLoading] = useState(false);
    const [invoiceHistory, setInvoiceHistory] = useState([]);
    const [invoiceCustomerName, setInvoiceCustomerName] = useState('');
    const [invoiceIncludeBasePlan, setInvoiceIncludeBasePlan] = useState(false);
    const [invoiceTaxRatePercent, setInvoiceTaxRatePercent] = useState('0');
    const [invoiceStatusDraft, setInvoiceStatusDraft] = useState('draft');
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [onboardingBusy, setOnboardingBusy] = useState(false);
    const [onboardingError, setOnboardingError] = useState('');
    const [onboardingHostName, setOnboardingHostName] = useState(localStorage.getItem('bross_host_name') || 'Host');
    const [onboardingWorkspaceName, setOnboardingWorkspaceName] = useState('');
    const [onboardingPlanId, setOnboardingPlanId] = useState('host_monthly');
    const [onboardingLogoUrl, setOnboardingLogoUrl] = useState(ASSETS.logo);
    const [showNightSetupWizard, setShowNightSetupWizard] = useState(false);
    const [nightSetupStep, setNightSetupStep] = useState(0);
    const [nightSetupApplying, setNightSetupApplying] = useState(false);
    const [nightSetupPresetId, setNightSetupPresetId] = useState('casual');
    const [nightSetupQueueLimitMode, setNightSetupQueueLimitMode] = useState('none');
    const [nightSetupQueueLimitCount, setNightSetupQueueLimitCount] = useState(0);
    const [nightSetupQueueRotation, setNightSetupQueueRotation] = useState('round_robin');
    const [nightSetupQueueFirstTimeBoost, setNightSetupQueueFirstTimeBoost] = useState(true);
    const [nightSetupPrimaryMode, setNightSetupPrimaryMode] = useState('karaoke');
    const [nightSetupShowScoring, setNightSetupShowScoring] = useState(true);
    const [nightSetupAutoPlayMedia, setNightSetupAutoPlayMedia] = useState(true);
    const [nightSetupChatOnTv, setNightSetupChatOnTv] = useState(false);
    const [nightSetupMarqueeEnabled, setNightSetupMarqueeEnabled] = useState(true);
    const [nightSetupRecommendation, setNightSetupRecommendation] = useState({ presetId: 'casual', reason: '' });
    const [missionControlCohort, setMissionControlCohort] = useState('legacy');
    const [missionControlEnabled, setMissionControlEnabled] = useState(false);
    const [missionDraft, setMissionDraft] = useState({
        archetype: 'casual',
        flowRule: 'balanced',
        spotlightMode: 'karaoke',
        assistLevel: MISSION_DEFAULT_ASSIST_LEVEL
    });
    const [missionAdvancedOverrides, setMissionAdvancedOverrides] = useState({});
    const [missionAdvancedQueueOpen, setMissionAdvancedQueueOpen] = useState(false);
    const [missionAdvancedTogglesOpen, setMissionAdvancedTogglesOpen] = useState(false);
    const [missionShowAllSpotlightModes, setMissionShowAllSpotlightModes] = useState(false);
    const hostUpdateDeploymentBanner = hostUpdateDeploymentWarning ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100 flex items-start justify-between gap-3">
            <div>
                <span className="font-bold uppercase tracking-[0.15em] text-amber-200 text-[11px] mr-2">Host Update Path</span>
                <span>{hostUpdateDeploymentWarning}</span>
            </div>
            <button
                type="button"
                onClick={() => {
                    setHostUpdateDeploymentWarning('');
                    hostUpdateWarningToastedRef.current = false;
                }}
                className="text-amber-200/90 hover:text-white text-xs uppercase tracking-widest"
                title="Dismiss warning"
            >
                Dismiss
            </button>
        </div>
    ) : null;
    const planLabel = useMemo(() => {
        return getSubscriptionPlanLabel(orgContext?.planId || 'free');
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
    const hostMonthlyPlan = useMemo(() => getHostSubscriptionPlan('host_monthly'), []);
    const hostAnnualPlan = useMemo(() => getHostSubscriptionPlan('host_annual'), []);
    const capabilities = useMemo(() => orgContext?.capabilities || {}, [orgContext?.capabilities]);
    const canUseWorkspaceOnboarding = !!capabilities[CAPABILITY_KEYS.WORKSPACE_ONBOARDING];
    const canUseInvoiceDrafts = !!capabilities[CAPABILITY_KEYS.BILLING_INVOICE_DRAFTS];
    const canGenerateAiContent = !!capabilities[CAPABILITY_KEYS.AI_GENERATE_CONTENT];
    const missionQueryOverride = useMemo(() => {
        if (typeof window === 'undefined') return null;
        const value = String(new URLSearchParams(window.location.search).get(MISSION_QUERY_KEY) || '').trim().toLowerCase();
        if (!value) return null;
        if (['on', '1', 'true', 'mission'].includes(value)) return true;
        if (['off', '0', 'false', 'legacy'].includes(value)) return false;
        return null;
    }, []);
    const missionFlowRuleLabel = useMemo(() => {
        const found = MISSION_FLOW_RULE_OPTIONS.find((rule) => rule.id === missionDraft.flowRule);
        return found?.label || 'Balanced Flow';
    }, [missionDraft.flowRule]);
    const missionStatusLabel = useMemo(() => {
        if (nightSetupApplying) return 'Live';
        if (!String(roomCode || '').trim()) return 'Needs Attention';
        if (nightSetupQueueLimitMode === 'none' && !nightSetupQueueFirstTimeBoost) return 'Needs Attention';
        return 'Ready';
    }, [nightSetupApplying, roomCode, nightSetupQueueLimitMode, nightSetupQueueFirstTimeBoost]);
    const usageMeters = useMemo(() => {
        const meters = Object.values(usageSummary?.meters || {});
        return meters.sort((a, b) => String(a?.label || '').localeCompare(String(b?.label || '')));
    }, [usageSummary?.meters]);
    const usagePeriodOptions = useMemo(() => buildRecentUsagePeriods(12), []);
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
                period: selectedUsagePeriod,
                meters: {},
                totals: { estimatedOverageCents: 0 },
                loading: false,
                error: ''
            });
            setInvoiceHistory([]);
            return () => { cancelled = true; };
        }
        (async () => {
            setOrgContext(prev => ({ ...prev, loading: true, error: '' }));
            setUsageSummary(prev => ({ ...prev, loading: true, error: '' }));
            try {
                const appCheckReady = await ensureAppCheckToken(false) || await ensureAppCheckToken(true);
                if (!appCheckReady) {
                    hostLogger.debug('App Check token unavailable during entitlements sync; continuing without pre-warmed token.');
                }
                await ensureOrganization('');
                const entitlements = await getMyEntitlements();
                const usage = await getMyUsageSummary(selectedUsagePeriod);
                const entitlementCapabilities = entitlements?.capabilities || {};
                const invoiceCapabilityEnabled = !!entitlementCapabilities[CAPABILITY_KEYS.BILLING_INVOICE_DRAFTS];
                let invoiceItems = [];
                if (invoiceCapabilityEnabled) {
                    try {
                        const historyPayload = await listMyUsageInvoices({ limit: 40 });
                        invoiceItems = Array.isArray(historyPayload?.invoices) ? historyPayload.invoices : [];
                    } catch (historyError) {
                        if (!isPermissionDeniedError(historyError)) {
                            hostLogger.error('Invoice history sync failed', historyError);
                        }
                    }
                }
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
                setInvoiceHistory(invoiceItems);
            } catch (e) {
                if (cancelled) return;
                if (isAppCheckError(e)) {
                    hostLogger.debug('Org entitlements waiting on App Check', e);
                    setOrgContext(prev => ({ ...prev, loading: false, error: BILLING_WARMUP_MESSAGE }));
                    setUsageSummary(prev => ({ ...prev, loading: false, error: '' }));
                    setInvoiceHistory([]);
                } else {
                    hostLogger.error('Failed to sync org entitlements', e);
                    setOrgContext(prev => ({ ...prev, loading: false, error: 'Could not load subscription entitlements.' }));
                    setUsageSummary(prev => ({ ...prev, loading: false, error: 'Could not load usage summary.' }));
                }
            }
        })();
        return () => { cancelled = true; };
    }, [uid, selectedUsagePeriod]);

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
        if ((invoiceCustomerName || '').trim()) return;
        const fallback = (hostName || '').trim() || (orgContext?.orgId || '').trim() || 'Workspace Customer';
        setInvoiceCustomerName(fallback);
    }, [hostName, orgContext?.orgId, invoiceCustomerName]);

    useEffect(() => {
        setInvoiceDraft(null);
    }, [selectedUsagePeriod, invoiceIncludeBasePlan, invoiceTaxRatePercent, invoiceCustomerName]);

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
    const popTriviaGeneratingRef = useRef(new Set());
    const stormTimersRef = useRef([]);
    const sfxPulseRef = useRef(null);
    const seededMarqueeRef = useRef(false);
    const toast = useToast();
    const moderationNudgeAtRef = useRef(0);
    const openModerationInbox = useCallback(() => setShowModerationInbox(true), []);
    const closeModerationInbox = useCallback(() => setShowModerationInbox(false), []);
    const moderationInbox = useModerationInboxState({
        roomCode,
        room,
        updateRoom,
        callFunction,
        toast
    });
    const moderationQueueState = moderationInbox.counts || {
        totalPending: 0,
        doodlePending: 0,
        selfiePending: 0,
        bingoPending: 0
    };
    useEffect(() => {
        if (!hostUpdateDeploymentWarning || !toast || hostUpdateWarningToastedRef.current) return;
        toast(hostUpdateDeploymentWarning);
        hostUpdateWarningToastedRef.current = true;
    }, [hostUpdateDeploymentWarning, toast]);
    useEffect(() => {
        if (showModerationInbox) return;
        if (!moderationInbox.meta?.needsAttention) return;
        const pending = Number(moderationInbox.counts?.totalPending || 0);
        if (!pending) return;
        const now = nowMs();
        if ((now - moderationNudgeAtRef.current) < 45000) return;
        moderationNudgeAtRef.current = now;
        if (typeof toast === 'function') {
            toast(`Moderation inbox: ${pending} pending item${pending === 1 ? '' : 's'}.`);
        }
    }, [
        showModerationInbox,
        moderationInbox.meta?.needsAttention,
        moderationInbox.counts?.totalPending,
        toast
    ]);
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
    const roomChatMessages = chatMessages.filter((msg) => isLoungeChatMessage(msg));
    const hostDmMessages = chatMessages.filter((msg) => isDirectChatMessage(msg));

    const currentSong = songs.find(s => s.status === 'performing');
    const queuedSongs = songs.filter(s => s.status === 'requested' || s.status === 'pending');
    const recentActivities = (activities || []).filter(a => toMs(a.timestamp) > nowMs() - 5 * 60 * 1000);
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
            hostLogger.error('BG analyser init failed', e);
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
            hostLogger.debug('Stage mic analyser init failed', e);
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
        const now = nowMs();
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
    }, [room?.activeMode, room?.doodleOke?.status, room?.doodleOke?.endsAt, room?.doodleOke?.guessEndsAt, room?.doodleOke, updateRoom]);
    useEffect(() => {
        songsRef.current = songs;
    }, [songs]);
    useEffect(() => {
        if (!roomCode) return;
        if (room?.popTriviaEnabled === false) return;
        if (!canGenerateAiContent) return;

        const eligibleSongs = songs
            .filter((song) => ['requested', 'pending', 'performing'].includes(song?.status))
            .filter((song) => (song?.songTitle || '').trim())
            .filter((song) => {
                if (!song?.id) return false;
                if (Array.isArray(song?.popTrivia) && song.popTrivia.length > 0) return false;
                const status = String(song?.popTriviaStatus || '').toLowerCase();
                return !['pending', 'ready', 'failed'].includes(status);
            })
            .slice(0, 4);

        eligibleSongs.forEach((song) => {
            if (!song?.id) return;
            if (popTriviaGeneratingRef.current.has(song.id)) return;
            popTriviaGeneratingRef.current.add(song.id);

            const songRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', song.id);
            (async () => {
                try {
                    await updateDoc(songRef, {
                        popTriviaStatus: 'pending',
                        popTriviaError: null
                    });
                    const context = [{
                        songTitle: song.songTitle,
                        artist: song.artist || '',
                        singerName: song.singerName || ''
                    }];
                    const result = await callFunction('geminiGenerate', { type: 'trivia', context });
                    const triviaQuestions = normalizePopTriviaQuestions(result?.result || result || [], {
                        limit: DEFAULT_POP_TRIVIA_MAX_QUESTIONS,
                        idPrefix: `${roomCode}_${song.id}`
                    });
                    if (!triviaQuestions.length) {
                        await updateDoc(songRef, {
                            popTriviaStatus: 'failed',
                            popTriviaError: 'AI returned no trivia questions.'
                        });
                        return;
                    }
                    await updateDoc(songRef, {
                        popTrivia: triviaQuestions,
                        popTriviaStatus: 'ready',
                        popTriviaSource: 'ai',
                        popTriviaGeneratedAt: serverTimestamp(),
                        popTriviaError: null
                    });
                } catch (error) {
                    hostLogger.warn('Pop trivia generation failed', { songId: song.id, error });
                    await updateDoc(songRef, {
                        popTriviaStatus: 'failed',
                        popTriviaError: String(error?.message || error?.code || 'Generation failed').slice(0, 180)
                    }).catch(() => {});
                } finally {
                    popTriviaGeneratingRef.current.delete(song.id);
                }
            })();
        });
    }, [roomCode, room?.popTriviaEnabled, songs, canGenerateAiContent]);
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
        const onboarding = String(params.get('onboarding') || '').toLowerCase();
        const plan = String(params.get('plan') || '').trim();
        const view = (params.get('view') || '').trim().toLowerCase();
        const section = (params.get('section') || '').trim().toLowerCase();
        const g = normalizeGameParam(params.get('game'));
        let consumedMarketingOnboardingParams = false;
        if (view) {
            const chosenSection = section || getViewDefaultSection(view);
            setActiveWorkspaceView(view);
            setActiveWorkspaceSection(chosenSection);
            if (view === 'queue') {
                setTab('stage');
                if (chosenSection === 'queue.catalog') setTab('browse');
            } else if (view === 'games') {
                setTab('games');
            } else if (view === 'audience') {
                setTab('lobby');
            } else {
                setTab('admin');
                const mappedTab = SECTION_TO_SETTINGS_TAB[chosenSection] || 'general';
                setSettingsTab(mappedTab);
            }
        } else if (t === 'photos') {
            setTab('lobby');
            setLobbyTab('photos');
        } else if (t === 'qa') {
            setTab('admin');
            setSettingsTab('qa');
            setActiveWorkspaceView('advanced');
            setActiveWorkspaceSection('advanced.diagnostics');
        } else if (g) {
            setTab('games');
            setAutoOpenGameId(g);
        } else if (t && ['stage', 'games', 'lobby', 'browse', 'admin'].includes(t)) {
            setTab(t);
            const redirect = LEGACY_TAB_REDIRECTS[t];
            if (redirect) {
                setActiveWorkspaceView(redirect.view);
                setActiveWorkspaceSection(redirect.section);
            }
            if (t === 'admin') {
                setActiveWorkspaceView('ops');
                setActiveWorkspaceSection('ops.room_setup');
                setSettingsTab('general');
            }
        }
        if (c === '1') setCatalogueOnly(true);
        if (chat === '1') setTab('stage');
        if (onboarding === '1' || onboarding === 'true') {
            const allowedPlanIds = new Set(HOST_ONBOARDING_PLAN_OPTIONS.map((option) => option.id));
            const chosenPlan = allowedPlanIds.has(plan) ? plan : 'host_monthly';
            setOnboardingPlanId(chosenPlan);
            setOnboardingStep(0);
            setShowOnboardingWizard(true);
            consumedMarketingOnboardingParams = true;
        }
        if (consumedMarketingOnboardingParams) {
            params.delete('onboarding');
            params.delete('plan');
            params.delete('source');
            const nextQuery = params.toString();
            const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
            window.history.replaceState({}, '', nextUrl);
        }
    }, []);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        const params = url.searchParams;
        params.set('hostUiVersion', 'v2');
        if (tab === 'admin') {
            const sectionId = SETTINGS_TAB_TO_SECTION[settingsTab] || activeWorkspaceSection || 'ops.room_setup';
            const sectionMeta = getSectionMeta(sectionId);
            const viewId = sectionMeta?.view || activeWorkspaceView || 'ops';
            params.set('view', viewId);
            params.set('section', sectionId);
            params.set('tab', 'admin');
        } else if (LEGACY_TAB_REDIRECTS[tab]) {
            const mapped = LEGACY_TAB_REDIRECTS[tab];
            params.set('view', mapped.view);
            params.set('section', mapped.section);
            params.set('tab', tab);
        }
        window.history.replaceState({}, '', `${url.pathname}?${params.toString()}`);
    }, [tab, settingsTab, activeWorkspaceSection, activeWorkspaceView]);
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
        setHostNightPreset(room?.hostNightPreset || 'custom');
        if (room?.bingoAudienceReopenEnabled !== undefined && room?.bingoAudienceReopenEnabled !== null) {
            setAudienceBingoReopenEnabled(room.bingoAudienceReopenEnabled !== false);
        }
        if (room?.autoLyricsOnQueue !== undefined && room?.autoLyricsOnQueue !== null) {
            setAutoLyricsOnQueue(!!room.autoLyricsOnQueue);
        }
        if (room?.popTriviaEnabled !== undefined && room?.popTriviaEnabled !== null) {
            setPopTriviaEnabled(room.popTriviaEnabled !== false);
        }
    }, [room?.tipUrl, room?.tipQrUrl, room?.tipCrates, room?.hostName, room?.logoUrl, room?.autoDj, room?.autoPlayMedia, room?.readyCheckDurationSec, room?.readyCheckRewardPoints, room?.autoBgFadeOutMs, room?.autoBgFadeInMs, room?.autoBgMixDuringSong, room?.queueSettings, room?.showScoring, room?.showFameLevel, room?.allowSingerTrackSelect, room?.hostNightPreset, room?.bingoAudienceReopenEnabled, room?.autoLyricsOnQueue, room?.popTriviaEnabled, room]);
    useEffect(() => {
        if (!room) return;
        setMarqueeEnabled(!!room?.marqueeEnabled);
        if (room?.marqueeDurationMs) setMarqueeDurationSec(Math.round(room.marqueeDurationMs / 1000));
        if (room?.marqueeIntervalMs) setMarqueeIntervalSec(Math.round(room.marqueeIntervalMs / 1000));
        if (room?.marqueeItems) setMarqueeItems(room.marqueeItems);
        if (room?.marqueeShowMode) setMarqueeShowMode(room.marqueeShowMode);
    }, [room?.marqueeEnabled, room?.marqueeDurationMs, room?.marqueeIntervalMs, room?.marqueeItems, room?.marqueeShowMode, room]);
    useEffect(() => {
        try {
            localStorage.setItem('bross_host_audience_preview_visible', audiencePreviewVisible ? '1' : '0');
            localStorage.setItem('bross_host_audience_preview_collapsed', audiencePreviewCollapsed ? '1' : '0');
        } catch {
            // Ignore storage failures.
        }
    }, [audiencePreviewVisible, audiencePreviewCollapsed]);
    useEffect(() => {
        if (!room || layoutDefaultedRef.current) return;
        if (!room.layoutMode) {
            layoutDefaultedRef.current = true;
            updateRoom({ layoutMode: 'standard' }).catch(() => {});
            return;
        }
        layoutDefaultedRef.current = true;
    }, [room?.layoutMode, roomCode, room, updateRoom]);
    useEffect(() => {
        if (!room || !roomCode || seededMarqueeRef.current) return;
        if (!room?.marqueeItems || room.marqueeItems.length === 0) {
            seededMarqueeRef.current = true;
            setMarqueeItems(DEFAULT_MARQUEE_ITEMS);
            updateRoom({ marqueeItems: DEFAULT_MARQUEE_ITEMS }).catch((e) => {
                hostLogger.debug('Failed to seed marquee items', e);
            });
        }
    }, [room?.marqueeItems, roomCode, room, updateRoom]);
    useEffect(() => {
        if (!showSettings || settingsTab !== 'marquee') return;
        const items = marqueeItems && marqueeItems.length ? marqueeItems : DEFAULT_MARQUEE_ITEMS;
        setMarqueeDraftItems(items);
    }, [showSettings, settingsTab, marqueeItems]);
    useEffect(() => {
        if (!room || !roomCode || !uid) return;
        const hostUids = Array.isArray(room.hostUids) ? room.hostUids : [];
        if (room.hostUid || hostUids.includes(uid)) return;
        hostLogger.warn('Room ownership metadata is missing host linkage; host updates are now callable-only.');
    }, [room?.hostUid, room?.hostUids, roomCode, uid, room]);
    useEffect(() => {
        if (room?.lightMode === 'storm' && room?.stormEndsAt && nowMs() > room.stormEndsAt) {
            updateRoom({ lightMode: 'off', stormPhase: 'off' });
        }
    }, [room?.lightMode, room?.stormEndsAt, updateRoom]);
    useEffect(() => {
        if (room?.lightMode === 'strobe' && room?.strobeEndsAt && nowMs() > room.strobeEndsAt) {
            updateRoom({ lightMode: 'off' });
        }
    }, [room?.lightMode, room?.strobeEndsAt, updateRoom]);
    const startNextFromQueue = useCallback(async () => {
        const activeRoom = roomRef.current;
        if (!activeRoom?.autoDj) return;
        const list = songsRef.current || [];
        const performing = list.find(s => s.status === 'performing');
        if (performing) return;
        const queued = list.filter(s => s.status === 'requested')
            .sort((a, b) => (a.priorityScore || 0) - (b.priorityScore || 0));
        const next = queued[0];
        if (!next) return;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', next.id), {
            status: 'performing',
            performingStartedAt: serverTimestamp()
        });
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
                videoStartTimestamp: autoStartMedia ? nowMs() : null,
                videoVolume: 100,
                showLyricsTv: false,
                showVisualizerTv: false,
                showLyricsSinger: false,
                appleMusicPlayback: null
            });
        }
        logActivity(roomCode, next.singerName, `took the stage!`, EMOJI.mic);
    }, [playAppleMusicTrack, roomCode, stopAppleMusic, updateRoom]);
    useEffect(() => {
        if (autoDjTimerRef.current) {
            clearTimeout(autoDjTimerRef.current);
            autoDjTimerRef.current = null;
        }
        if (!room?.autoDj || !room?.lastPerformance?.timestamp) return;
        const lastTs = getTimestampMs(room.lastPerformance.timestamp);
        if (lastAutoDjTsRef.current === lastTs) return;
        lastAutoDjTsRef.current = lastTs;
        const elapsed = nowMs() - lastTs;
        const delay = Math.max(0, 10500 - elapsed);
        setAutoDjCountdown(Math.ceil(delay / 1000));
        const tick = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((lastTs + 10500 - nowMs()) / 1000));
            setAutoDjCountdown(remaining);
            if (remaining <= 0) clearInterval(tick);
        }, 500);
        autoDjTimerRef.current = setTimeout(() => {
            startNextFromQueue().catch((e) => {
                hostLogger.warn('Auto DJ failed to start next song', e);
            });
        }, delay);
        return () => {
            if (autoDjTimerRef.current) {
                clearTimeout(autoDjTimerRef.current);
                autoDjTimerRef.current = null;
            }
            clearInterval(tick);
        };
    }, [room?.autoDj, room?.lastPerformance?.timestamp, startNextFromQueue]);
    useEffect(() => {
        if (room?.bingoMode !== 'mystery') return;
        const pickerUid = room?.bingoPickerUid || (Array.isArray(room?.bingoTurnOrder) ? room.bingoTurnOrder[room?.bingoTurnIndex || 0] : null);
        const pickerUser = users.find(u => u.uid === pickerUid);
        if (pickerUid && pickerUser && room?.bingoPickerName !== pickerUser.name) {
            updateRoom({ bingoPickerName: pickerUser.name });
        }
    }, [room?.bingoMode, room?.bingoPickerUid, room?.bingoTurnIndex, room?.bingoTurnOrder, room?.bingoPickerName, users, updateRoom]);
    useEffect(() => {
        if (room?.bingoMode !== 'mystery') return;
        if (!room?.lastPerformance?.timestamp || !room?.bingoPickerUid) return;
        const order = Array.isArray(room?.bingoTurnOrder) ? room.bingoTurnOrder : [];
        if (!order.length) return;
        const currentIndex = Math.max(0, Number(room?.bingoTurnIndex || 0));
        const turnPick = room?.bingoTurnPick || null;
        const isTurnLockedByPicker = !!turnPick
            && turnPick?.pickerUid === room?.bingoPickerUid
            && Number(turnPick?.turnIndex ?? -1) === currentIndex;
        if (!isTurnLockedByPicker) return;
        const lastTs = getTimestampMs(room.lastPerformance.timestamp);
        const advanceKey = `${lastTs}-${room?.lastPerformance?.singerUid || room?.lastPerformance?.singerName || ''}`;
        if (bingoTurnAdvanceRef.current === advanceKey) return;
        const singerUid = room?.lastPerformance?.singerUid;
        const singerName = (room?.lastPerformance?.singerName || '').trim();
        const pickerName = (room?.bingoPickerName || '').trim();
        const singerMatchesPicker = singerUid
            ? singerUid === room.bingoPickerUid
            : (!!singerName && !!pickerName && singerName === pickerName);
        if (!singerMatchesPicker) return;
        const nextIndex = (currentIndex + 1) % order.length;
        bingoTurnAdvanceRef.current = advanceKey;
        updateRoom({
            bingoTurnIndex: nextIndex,
            bingoPickerUid: order[nextIndex] || null,
            bingoTurnPick: null
        });
    }, [room?.bingoMode, room?.lastPerformance?.timestamp, room?.lastPerformance?.singerUid, room?.lastPerformance?.singerName, room?.bingoTurnOrder, room?.bingoTurnIndex, room?.bingoPickerUid, room?.bingoPickerName, room?.bingoTurnPick, updateRoom]);
    useEffect(() => {
        if (!room?.autoDj) return;
        if (queuedCount > 0 || performingCount > 0) return;
        const playlistId = room?.appleMusicAutoPlaylistId || '';
        if (!playlistId) return;
        const playback = room?.appleMusicPlayback || {};
        if (playback.type === 'playlist' && playback.id === playlistId && playback.status === 'playing') return;
        playAppleMusicPlaylist(playlistId, { title: room?.appleMusicAutoPlaylistTitle || '' })
            .catch((error) => {
                hostLogger.warn('Auto DJ failed to start Apple Music playlist', error);
            });
    }, [room?.autoDj, queuedCount, performingCount, room?.appleMusicAutoPlaylistId, room?.appleMusicAutoPlaylistTitle, room?.appleMusicPlayback?.status, room?.appleMusicPlayback, playAppleMusicPlaylist]);
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
            hostLogger.debug('Failed to load local media library', e);
        });
        return () => { isMounted = false; };
    }, []);

    const ensureActiveUid = async () => {
        let activeUid = auth.currentUser?.uid || uid || null;

        if (activeUid) return activeUid;

        let lastError = null;

        if (!activeUid && typeof retryAuth === 'function') {
            try {
                await retryAuth();
                activeUid = auth.currentUser?.uid || null;
            } catch (error) {
                lastError = error;
            }
        }

        if (activeUid) return activeUid;

        // Retry auth bootstrap a couple times to survive transient network/startup races.
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const authResult = await initAuth();
            if (authResult?.ok) {
                activeUid = auth.currentUser?.uid || null;
                if (activeUid) return activeUid;
            } else {
                lastError = authResult?.error || lastError;
            }
            if (attempt < 1) await sleep(300);
        }

        if (lastError) throw lastError;
        return null;
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

    useEffect(() => {
        let nextCohort = 'legacy';
        if (missionQueryOverride === true) {
            nextCohort = 'mission';
        } else if (missionQueryOverride === false) {
            nextCohort = 'legacy';
        } else {
            try {
                const stored = String(localStorage.getItem(MISSION_COHORT_STORAGE_KEY) || '').trim();
                if (stored === 'mission' || stored === 'legacy') {
                    nextCohort = stored;
                } else {
                    nextCohort = Math.random() < 0.5 ? 'mission' : 'legacy';
                    localStorage.setItem(MISSION_COHORT_STORAGE_KEY, nextCohort);
                }
            } catch (_err) {
                nextCohort = 'legacy';
            }
        }
        setMissionControlCohort(nextCohort);
        setMissionControlEnabled(nextCohort === 'mission');
    }, [missionQueryOverride]);

    const applyMissionDraftToNightSetupState = useCallback((draftInput = missionDraft, overridesInput = missionAdvancedOverrides) => {
        const compiled = compileMissionDraftToRoomPayload(draftInput, capabilities, {
            presets: HOST_NIGHT_PRESETS,
            flowRules: MISSION_FLOW_RULES
        });
        const merged = mergePayloadWithOverrides(compiled, overridesInput);
        setNightSetupPresetId(merged.hostNightPreset || 'casual');
        setNightSetupQueueLimitMode(merged.queueSettings?.limitMode || 'none');
        setNightSetupQueueLimitCount(Math.max(0, Number(merged.queueSettings?.limitCount || 0)));
        setNightSetupQueueRotation(merged.queueSettings?.rotation || 'round_robin');
        setNightSetupQueueFirstTimeBoost(merged.queueSettings?.firstTimeBoost !== false);
        setNightSetupPrimaryMode(merged.gamePreviewId || 'karaoke');
        setNightSetupShowScoring(merged.showScoring !== false);
        setNightSetupAutoPlayMedia(merged.autoPlayMedia !== false);
        setNightSetupChatOnTv(!!merged.chatShowOnTv);
        setNightSetupMarqueeEnabled(!!merged.marqueeEnabled);
        return merged;
    }, [capabilities, missionDraft, missionAdvancedOverrides]);

    const setMissionOverrideValue = useCallback((path, value) => {
        setMissionAdvancedOverrides((prev) => {
            const next = { ...(prev || {}), [path]: value };
            trackEvent('host_mission_advanced_toggled', {
                room_code: roomCode || '',
                path,
                feature_flag: missionControlEnabled ? 'mission_control_v1' : 'legacy',
                cohort: missionControlCohort,
                timestamp: nowMs()
            });
            return next;
        });
    }, [roomCode, missionControlEnabled, missionControlCohort]);

    const resetMissionAdvancedOverrides = useCallback(() => {
        setMissionAdvancedOverrides({});
        applyMissionDraftToNightSetupState(missionDraft, {});
    }, [applyMissionDraftToNightSetupState, missionDraft]);

    useEffect(() => {
        if (!missionControlEnabled) return;
        try {
            localStorage.setItem(MISSION_DRAFT_STORAGE_KEY, JSON.stringify(missionDraft || {}));
        } catch (_err) {
            // ignore local storage errors
        }
    }, [missionControlEnabled, missionDraft]);

    useEffect(() => {
        if (!missionControlEnabled) return;
        try {
            localStorage.setItem(MISSION_OVERRIDE_STORAGE_KEY, JSON.stringify(missionAdvancedOverrides || {}));
        } catch (_err) {
            // ignore local storage errors
        }
    }, [missionControlEnabled, missionAdvancedOverrides]);

    const resolveNightSetupRecommendation = useCallback(() => {
        const knownPresetIds = new Set(Object.keys(HOST_NIGHT_PRESETS));
        const lastPreset = (() => {
            try {
                return String(localStorage.getItem('bross_last_night_setup_preset') || '').trim();
            } catch {
                return '';
            }
        })();
        if (knownPresetIds.has(lastPreset)) {
            return {
                presetId: lastPreset,
                reason: 'Based on your most recent host setup.'
            };
        }

        const guestCount = Array.isArray(users) ? users.length : 0;
        const activeQueueCount = Number(queuedCount || 0);
        if (guestCount >= 18 || activeQueueCount >= 16) {
            return {
                presetId: 'competition',
                reason: 'High turnout detected. Competition keeps queue pressure under control.'
            };
        }
        if (activeQueueCount >= 8 && guestCount >= 10) {
            return {
                presetId: 'bingo',
                reason: 'Balanced crowd + queue size suggests Bingo Spotlight engagement.'
            };
        }

        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            return {
                presetId: 'casual',
                reason: 'Weekend default: high-energy casual flow.'
            };
        }
        return {
            presetId: 'trivia',
            reason: 'Weeknight default: trivia bursts keep non-singers active.'
        };
    }, [users, queuedCount]);

    const seedNightSetupFromPreset = useCallback((presetId = 'casual', options = {}) => {
        const preset = HOST_NIGHT_PRESETS[presetId] || HOST_NIGHT_PRESETS.casual;
        const presetSettings = preset?.settings || {};
        const queueSettings = presetSettings.queueSettings || {};
        const keepQueueDraft = !!options.keepQueueDraft;
        setNightSetupPresetId(preset.id);
        if (!keepQueueDraft) {
            setNightSetupQueueLimitMode(queueSettings.limitMode || 'none');
            setNightSetupQueueLimitCount(Math.max(0, Number(queueSettings.limitCount || 0)));
            setNightSetupQueueRotation(queueSettings.rotation || 'round_robin');
            setNightSetupQueueFirstTimeBoost(queueSettings.firstTimeBoost !== false);
        }
        setNightSetupShowScoring(presetSettings.showScoring !== false);
        setNightSetupAutoPlayMedia(presetSettings.autoPlayMedia !== false);
        setNightSetupChatOnTv(!!presetSettings.chatShowOnTv);
        setNightSetupMarqueeEnabled(!!presetSettings.marqueeEnabled);
        setNightSetupPrimaryMode(presetSettings.gamePreviewId || (preset.id === 'bingo' ? 'bingo' : preset.id === 'trivia' ? 'trivia_pop' : 'karaoke'));
        return preset;
    }, []);

    const updateMissionDraftPick = useCallback((patch = {}, reason = 'manual') => {
        setMissionDraft((prev) => {
            const next = {
                ...(prev || {}),
                ...patch,
                assistLevel: patch.assistLevel || prev?.assistLevel || MISSION_DEFAULT_ASSIST_LEVEL
            };
            applyMissionDraftToNightSetupState(next, missionAdvancedOverrides);
            trackEvent('host_mission_pick_changed', {
                room_code: roomCode || '',
                reason,
                archetype: next.archetype,
                flow_rule: next.flowRule,
                spotlight_mode: next.spotlightMode,
                feature_flag: missionControlEnabled ? 'mission_control_v1' : 'legacy',
                cohort: missionControlCohort,
                timestamp: nowMs()
            });
            return next;
        });
    }, [applyMissionDraftToNightSetupState, missionAdvancedOverrides, roomCode, missionControlEnabled, missionControlCohort]);

    const openNightSetupWizard = useCallback((presetId = '') => {
        const recommendation = resolveNightSetupRecommendation();
        const resolvedPresetId = (presetId && HOST_NIGHT_PRESETS[presetId]) ? presetId : recommendation.presetId;
        setNightSetupRecommendation(recommendation);
        if (missionControlEnabled) {
            const roomDraft = buildMissionDraftFromRoom(room || {}, {
                flowRules: MISSION_FLOW_RULES,
                primaryModes: NIGHT_SETUP_PRIMARY_MODES
            });
            const seedDraft = {
                ...roomDraft,
                archetype: resolvedPresetId || roomDraft.archetype || 'casual',
                assistLevel: roomDraft.assistLevel || MISSION_DEFAULT_ASSIST_LEVEL
            };
            let persistedDraft = null;
            let persistedOverrides = null;
            try {
                const savedDraftRaw = localStorage.getItem(MISSION_DRAFT_STORAGE_KEY);
                const savedOverrideRaw = localStorage.getItem(MISSION_OVERRIDE_STORAGE_KEY);
                persistedDraft = savedDraftRaw ? JSON.parse(savedDraftRaw) : null;
                persistedOverrides = savedOverrideRaw ? JSON.parse(savedOverrideRaw) : null;
            } catch (_err) {
                persistedDraft = null;
                persistedOverrides = null;
            }
            const nextDraft = (persistedDraft && typeof persistedDraft === 'object' && !Array.isArray(persistedDraft))
                ? { ...seedDraft, ...persistedDraft }
                : seedDraft;
            const nextOverrides = (room?.missionControl?.advancedOverrides && typeof room.missionControl.advancedOverrides === 'object')
                ? room.missionControl.advancedOverrides
                : ((persistedOverrides && typeof persistedOverrides === 'object' && !Array.isArray(persistedOverrides)) ? persistedOverrides : {});
            setMissionDraft(nextDraft);
            setMissionAdvancedOverrides(nextOverrides);
            setMissionAdvancedQueueOpen(false);
            setMissionAdvancedTogglesOpen(false);
            setMissionShowAllSpotlightModes(false);
            applyMissionDraftToNightSetupState(nextDraft, nextOverrides);
            trackEvent('host_mission_setup_opened', {
                room_code: roomCode || '',
                archetype: nextDraft.archetype,
                spotlight_mode: nextDraft.spotlightMode,
                feature_flag: 'mission_control_v1',
                cohort: missionControlCohort,
                timestamp: nowMs()
            });
        } else {
            seedNightSetupFromPreset(resolvedPresetId, { keepQueueDraft: false });
        }
        setNightSetupStep(0);
        setShowNightSetupWizard(true);
    }, [
        resolveNightSetupRecommendation,
        missionControlEnabled,
        room,
        roomCode,
        missionControlCohort,
        applyMissionDraftToNightSetupState,
        seedNightSetupFromPreset
    ]);

    const closeNightSetupWizard = useCallback(() => {
        if (nightSetupApplying) return;
        setShowNightSetupWizard(false);
        setNightSetupStep(0);
    }, [nightSetupApplying]);

    useEffect(() => {
        if (!showNightSetupWizard) return;
        setShowLaunchMenu(false);
        setShowNavMenu(false);
        trackEvent('host_night_setup_step_view', {
            step_index: nightSetupStep,
            preset_id: nightSetupPresetId,
            primary_mode: nightSetupPrimaryMode
        });
    }, [showNightSetupWizard, nightSetupStep, nightSetupPresetId, nightSetupPrimaryMode]);

    const setBgMusicState = useCallback((next) => {
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
    }, [currentTrackIdx, updateRoom]);

    const nightSetupAutoOpenGameTimerRef = useRef(null);
    useEffect(() => () => {
        if (nightSetupAutoOpenGameTimerRef.current) {
            clearTimeout(nightSetupAutoOpenGameTimerRef.current);
            nightSetupAutoOpenGameTimerRef.current = null;
        }
    }, []);

    const openSpotlightFlowFromSetup = useCallback((modeId = 'karaoke') => {
        const targetMode = String(modeId || '').trim().toLowerCase();
        if (!targetMode || targetMode === 'karaoke') {
            setTab('stage');
            return;
        }
        setTab('games');
        setAutoOpenGameId('');
        if (nightSetupAutoOpenGameTimerRef.current) {
            clearTimeout(nightSetupAutoOpenGameTimerRef.current);
        }
        nightSetupAutoOpenGameTimerRef.current = setTimeout(() => {
            setAutoOpenGameId(targetMode);
            nightSetupAutoOpenGameTimerRef.current = null;
        }, 0);
    }, [setTab]);

    const applyNightSetupWizard = useCallback(async (options = {}) => {
        const intent = String(options?.intent || 'save').trim().toLowerCase();
        if (!roomCode) {
            toast('Open a room first.');
            return false;
        }
        const canUseAi = !!capabilities?.[CAPABILITY_KEYS.AI_GENERATE_CONTENT];
        const legacyPreset = HOST_NIGHT_PRESETS[nightSetupPresetId] || HOST_NIGHT_PRESETS.casual;
        const legacyPresetSettings = legacyPreset.settings || {};
        const legacyGameDefaults = legacyPresetSettings.gameDefaults || {};
        const legacyAutoLyricsEnabled = !!legacyPresetSettings.autoLyricsOnQueue && canUseAi;
        const legacyQueueLimitModeValue = nightSetupQueueLimitMode || 'none';
        const legacyQueueLimitCountValue = legacyQueueLimitModeValue === 'none'
            ? 0
            : Math.max(0, Number(nightSetupQueueLimitCount || 0));
        const legacyPayload = {
            hostNightPreset: legacyPreset.id,
            autoDj: !!legacyPresetSettings.autoDj,
            autoBgMusic: !!legacyPresetSettings.autoBgMusic,
            autoPlayMedia: !!nightSetupAutoPlayMedia,
            showVisualizerTv: !!legacyPresetSettings.showVisualizerTv,
            showLyricsTv: !!legacyPresetSettings.showLyricsTv,
            showScoring: !!nightSetupShowScoring,
            showFameLevel: !!legacyPresetSettings.showFameLevel,
            allowSingerTrackSelect: !!legacyPresetSettings.allowSingerTrackSelect,
            marqueeEnabled: !!nightSetupMarqueeEnabled,
            marqueeShowMode: legacyPresetSettings.marqueeShowMode || 'always',
            chatShowOnTv: !!nightSetupChatOnTv,
            chatTvMode: legacyPresetSettings.chatTvMode || 'auto',
            bouncerMode: !!legacyPresetSettings.bouncerMode,
            bingoShowTv: legacyPresetSettings.bingoShowTv !== false,
            bingoVotingMode: legacyPresetSettings.bingoVotingMode || 'host+votes',
            bingoAutoApprovePct: Math.max(10, Math.min(100, Number(legacyPresetSettings.bingoAutoApprovePct ?? 50))),
            bingoAudienceReopenEnabled: legacyPresetSettings.bingoAudienceReopenEnabled !== false,
            autoLyricsOnQueue: legacyAutoLyricsEnabled,
            popTriviaEnabled: legacyPresetSettings.popTriviaEnabled !== false,
            gamePreviewId: nightSetupPrimaryMode === 'karaoke' ? null : nightSetupPrimaryMode,
            gameDefaults: {
                triviaRoundSec: Math.max(5, Number(legacyGameDefaults.triviaRoundSec || 20)),
                triviaAutoReveal: legacyGameDefaults.triviaAutoReveal !== false,
                bingoVotingMode: legacyGameDefaults.bingoVotingMode || 'host+votes',
                bingoAutoApprovePct: Math.max(10, Math.min(100, Number(legacyGameDefaults.bingoAutoApprovePct ?? 50)))
            },
            queueSettings: {
                limitMode: legacyQueueLimitModeValue,
                limitCount: legacyQueueLimitCountValue,
                rotation: nightSetupQueueRotation || 'round_robin',
                firstTimeBoost: nightSetupQueueFirstTimeBoost !== false
            }
        };
        const missionPayload = mergePayloadWithOverrides(
            compileMissionDraftToRoomPayload(missionDraft, capabilities, {
                presets: HOST_NIGHT_PRESETS,
                flowRules: MISSION_FLOW_RULES
            }),
            missionAdvancedOverrides
        );
        const payload = missionControlEnabled ? missionPayload : legacyPayload;
        const payloadPreset = HOST_NIGHT_PRESETS[payload.hostNightPreset] || HOST_NIGHT_PRESETS.casual;
        const payloadPresetSettings = payloadPreset?.settings || {};
        const resolvedSpotlightMode = String(
            missionControlEnabled
                ? (missionDraft?.spotlightMode || payload.gamePreviewId || nightSetupPrimaryMode || 'karaoke')
                : (nightSetupPrimaryMode || payload.gamePreviewId || 'karaoke')
        ).trim().toLowerCase();
        setNightSetupApplying(true);
        try {
            await updateRoom({
                ...payload,
                missionControl: {
                    version: MISSION_CONTROL_VERSION,
                    enabled: !!missionControlEnabled,
                    setupDraft: {
                        archetype: missionDraft?.archetype || payload.hostNightPreset || 'casual',
                        flowRule: missionDraft?.flowRule || 'balanced',
                        spotlightMode: missionDraft?.spotlightMode || (payload.gamePreviewId || 'karaoke'),
                        assistLevel: missionDraft?.assistLevel || MISSION_DEFAULT_ASSIST_LEVEL
                    },
                    advancedOverrides: missionAdvancedOverrides || {},
                    lastAppliedAt: serverTimestamp(),
                    lastSuggestedAction: room?.missionControl?.lastSuggestedAction || ''
                }
            });
            setHostNightPreset(payload.hostNightPreset);
            setAutoDj(!!payload.autoDj);
            setAutoBgMusic(!!payload.autoBgMusic);
            setAutoPlayMedia(!!payload.autoPlayMedia);
            setQueueLimitMode(payload.queueSettings.limitMode);
            setQueueLimitCount(payload.queueSettings.limitCount);
            setQueueRotation(payload.queueSettings.rotation);
            setQueueFirstTimeBoost(!!payload.queueSettings.firstTimeBoost);
            setShowScoring(!!payload.showScoring);
            setShowFameLevel(!!payload.showFameLevel);
            setAllowSingerTrackSelect(!!payload.allowSingerTrackSelect);
            setMarqueeEnabled(!!payload.marqueeEnabled);
            setMarqueeShowMode(payload.marqueeShowMode || 'always');
            setChatShowOnTv(!!payload.chatShowOnTv);
            setAudienceBingoReopenEnabled(payload.bingoAudienceReopenEnabled !== false);
            setAutoLyricsOnQueue(!!payload.autoLyricsOnQueue);
            setPopTriviaEnabled(payload.popTriviaEnabled !== false);
            setSearchSources(payloadPreset.searchSources || { local: true, youtube: true, itunes: true });
            if (payload.autoBgMusic && !playingBg) setBgMusicState(true);
            if (!payload.autoBgMusic && playingBg) setBgMusicState(false);
            if (intent === 'start_match') {
                openSpotlightFlowFromSetup(resolvedSpotlightMode);
            }
            trackEvent('host_night_setup_applied', {
                preset_id: payload.hostNightPreset,
                primary_mode: resolvedSpotlightMode,
                queue_limit_mode: payload.queueSettings.limitMode
            });
            if (missionControlEnabled) {
                trackEvent('host_mission_applied', {
                    room_code: roomCode,
                    archetype: missionDraft?.archetype || payload.hostNightPreset,
                    flow_rule: missionDraft?.flowRule || 'balanced',
                    spotlight_mode: missionDraft?.spotlightMode || (payload.gamePreviewId || 'karaoke'),
                    feature_flag: 'mission_control_v1',
                    cohort: missionControlCohort,
                    timestamp: nowMs()
                });
            }
            try {
                localStorage.setItem('bross_last_night_setup_preset', payload.hostNightPreset);
            } catch (_err) {
                // ignore local storage errors
            }
            if (!!payloadPresetSettings.autoLyricsOnQueue && !canUseAi) {
                toast(`${payloadPreset.label} applied. AI lyric auto-generation needs a Host subscription.`);
            } else {
                toast(intent === 'start_match'
                    ? 'Setup saved. Match flow ready.'
                    : (missionControlEnabled ? 'Mission control setup applied.' : 'Night setup applied.'));
            }
            setShowNightSetupWizard(false);
            setNightSetupStep(0);
            return true;
        } catch (error) {
            hostLogger.error('Apply night setup wizard failed', error);
            toast('Could not apply night setup.');
            return false;
        } finally {
            setNightSetupApplying(false);
        }
    }, [
        roomCode,
        nightSetupPresetId,
        nightSetupAutoPlayMedia,
        nightSetupShowScoring,
        nightSetupQueueLimitMode,
        nightSetupQueueLimitCount,
        nightSetupQueueRotation,
        nightSetupQueueFirstTimeBoost,
        nightSetupPrimaryMode,
        nightSetupChatOnTv,
        nightSetupMarqueeEnabled,
        missionControlEnabled,
        missionDraft,
        missionAdvancedOverrides,
        room?.missionControl?.lastSuggestedAction,
        missionControlCohort,
        capabilities,
        updateRoom,
        playingBg,
        setBgMusicState,
        openSpotlightFlowFromSetup,
        toast,
        setSearchSources,
        setChatShowOnTv
    ]);

    const launchNightSetupPackage = useCallback(async () => {
        if (!roomCode) {
            toast('Open a room first.');
            return;
        }
        const tvUrl = `${appBase}?room=${encodeURIComponent(roomCode)}&mode=tv`;
        try {
            window.open(tvUrl, '_blank', 'noopener,noreferrer');
        } catch (_err) {
            // ignore popup-block issues
        }
        const applied = await applyNightSetupWizard({ intent: 'start_match' });
        if (!applied) return;

        const joinUrl = `${appBase}?room=${encodeURIComponent(roomCode)}`;
        try {
            await navigator.clipboard.writeText(joinUrl);
            toast('Launch package complete: TV opened and join link copied.');
        } catch (_err) {
            toast(`Launch package complete. Join link: ${joinUrl}`);
        }

        trackEvent('host_night_setup_launch_package', {
            room_code: roomCode,
            preset_id: nightSetupPresetId,
            primary_mode: nightSetupPrimaryMode
        });
    }, [
        roomCode,
        appBase,
        applyNightSetupWizard,
        toast,
        nightSetupPresetId,
        nightSetupPrimaryMode
    ]);

    const openOnboardingWizard = () => {
        const seededHost = (hostName || '').trim() || 'Host';
        const seededLogo = (logoUrl || ASSETS.logo || '').trim() || ASSETS.logo;
        const allowedPlanIds = new Set(HOST_ONBOARDING_PLAN_OPTIONS.map((option) => option.id));
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
        if (!canUseWorkspaceOnboarding) {
            setOnboardingError(`${getMissingCapabilityLabel(CAPABILITY_KEYS.WORKSPACE_ONBOARDING)} is not available on this plan.`);
            return;
        }
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
            const payload = await bootstrapOnboardingWorkspace({
                orgName: trimmedWorkspace,
                hostName: trimmedHost,
                logoUrl: onboardingLogoUrl
            });
            const entitlements = payload?.entitlements || await getMyEntitlements();
            syncOrgContextFromEntitlements(entitlements);
            setHostName(trimmedHost);
            localStorage.setItem('bross_host_name', trimmedHost);
            setOnboardingStep(1);
        } catch (e) {
            hostLogger.error('Onboarding workspace provision failed', e);
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
            logoUrl: trimmedLogo || ASSETS.logo,
            nightPresetId: hostNightPreset && hostNightPreset !== 'custom' ? hostNightPreset : 'casual',
            openNightSetup: true
        });
    };

    const joinRoom = async (candidateCode, options = {}) => {
        const silent = !!options?.silent;
        if (joiningRoom) return;
        const code = (candidateCode || roomCodeInput || '').trim().toUpperCase();
        if (!code) {
            if (!silent) {
                toast('Enter a room code first');
                setEntryError('Enter a room code first.');
            }
            return false;
        }

        setJoiningRoom(true);
        setEntryError('');
        try {
            const activeUid = await ensureActiveUid();
            if (!activeUid) {
                if (!silent) {
                    toast('Could not establish auth. Please retry.');
                    setEntryError('Could not establish auth. Retry and join again.');
                }
                return false;
            }
            await assertRoomHostAccess(code);

            setRoomCode(code);
            setRoomCodeInput(code);
            setView('panel');
            return true;
        } catch (e) {
            const code = e?.code || '';
            if (!silent) {
                if (code.includes('not-found')) {
                    toast(`Room ${(candidateCode || roomCodeInput || '').trim().toUpperCase()} not found`);
                    setEntryError(`Room ${(candidateCode || roomCodeInput || '').trim().toUpperCase()} not found.`);
                } else if (code.includes('permission-denied')) {
                    toast('Only room hosts can open host controls for this room.');
                    setEntryError('Only room hosts can open host controls for this room.');
                } else if (code.includes('unauthenticated')) {
                    toast('You are signed out. Please retry auth, then open room again.');
                    setEntryError('You are signed out. Retry auth, then open room again.');
                } else if (code.includes('unavailable') || code.includes('network')) {
                    toast('Network issue while opening room. Please retry.');
                    setEntryError('Network issue while opening room. Please retry.');
                } else {
                    toast(`Failed to open room${code ? ` (${code})` : ''}`);
                    setEntryError(`Failed to open room${code ? ` (${code})` : ''}.`);
                }
            }
            return false;
        } finally {
            setJoiningRoom(false);
        }
    };

    const createRoom = async (options = {}) => {
        if (creatingRoom) return;
        const hostNameOverride = typeof options?.hostName === 'string' ? options.hostName.trim() : '';
        const orgNameOverride = typeof options?.orgName === 'string' ? options.orgName.trim() : '';
        const logoUrlOverride = typeof options?.logoUrl === 'string' ? options.logoUrl.trim() : '';
        const initialNightPresetId = typeof options?.nightPresetId === 'string' ? options.nightPresetId.trim() : '';
        const shouldOpenNightSetup = options?.openNightSetup !== false;
        const nextHostName = hostNameOverride || (hostName || '').trim() || 'Host';
        const nextOrgName = orgNameOverride || `${nextHostName} Workspace`;
        const nextLogoUrl = logoUrlOverride || (logoUrl || '').trim() || ASSETS.logo;
        setCreatingRoom(true);
        setEntryError('');
        try {
            const activeUid = await ensureActiveUid();
            if (!activeUid) {
                toast('Could not establish auth. Please retry.');
                setEntryError('Could not establish auth. Retry and create room again.');
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
                setEntryError('Room code collision. Please try again.');
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
                    hostLogger.debug('Organization bootstrap failed during room create', orgErr);
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
                visualizerSource: 'auto',
                visualizerPreset: 'neon',
                visualizerSensitivity: 1,
                visualizerSmoothing: 0.35,
                visualizerSyncLightMode: false,
                reduceMotionFx: false,
                showLyricsSinger: false,
                hideCornerOverlay: false,
                howToPlay: { active: false, id: nowMs() },
                gameRulesId: 0,
                showScoring: true,
                showFameLevel: true,
                allowSingerTrackSelect: false,
                hostNightPreset: 'custom',
                bingoAudienceReopenEnabled: true,
                autoLyricsOnQueue: false,
                popTriviaEnabled: true,
                gameDefaults: {
                    triviaRoundSec: 20,
                    triviaAutoReveal: true,
                    bingoVotingMode: 'host+votes',
                    bingoAutoApprovePct: 50
                },
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
                chatAudienceMode: 'all',
                missionControl: {
                    version: MISSION_CONTROL_VERSION,
                    enabled: false,
                    setupDraft: {
                        archetype: 'casual',
                        flowRule: 'balanced',
                        spotlightMode: 'karaoke',
                        assistLevel: MISSION_DEFAULT_ASSIST_LEVEL
                    },
                    advancedOverrides: {},
                    lastAppliedAt: serverTimestamp(),
                    lastSuggestedAction: ''
                }
            });
            trackEvent('host_room_created', { room_code: c });
            setRoomCode(c);
            setRoomCodeInput(c);
            setView('panel');
            setShowOnboardingWizard(false);
            if (shouldOpenNightSetup) {
                openNightSetupWizard(initialNightPresetId || 'casual');
            }
            toast(`Room ${c} created`);
            setDoc(
                doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', c),
                { ytIndex: [], logoLibrary: [], updatedAt: serverTimestamp() },
                { merge: true }
            ).catch((seedErr) => {
                hostLogger.warn('Room created but host library seed failed', seedErr);
            });
        } catch (e) {
            hostLogger.error('Failed to create room', {
                error: e,
                propUid: uid || null,
                authUid: auth.currentUser?.uid || null
            });
            const code = e?.code || '';
            if (code.includes('permission-denied')) {
                toast('Permission denied while creating room. Re-authenticate and try again.');
                setEntryError('Permission denied while creating room. Re-authenticate and try again.');
            } else if (code.includes('unauthenticated')) {
                toast('You are signed out. Please retry auth, then create room again.');
                setEntryError('You are signed out. Retry auth, then create room again.');
            } else if (code.includes('unavailable') || code.includes('network')) {
                toast('Network issue while creating room. Please retry.');
                setEntryError('Network issue while creating room. Please retry.');
            } else {
                toast(`Failed to create room${code ? ` (${code})` : ''}`);
                setEntryError(`Failed to create room${code ? ` (${code})` : ''}.`);
            }
        } finally {
            setCreatingRoom(false);
        }
    };

    useEffect(() => {
        if (!normalizedInitialCode) return;
        const authMarker = uid || authError?.code || authError?.message || 'boot';
        const attemptKey = `${normalizedInitialCode}:${authMarker}`;
        if (autoJoinAttemptKeyRef.current === attemptKey) return;
        autoJoinAttemptKeyRef.current = attemptKey;
        setRoomCodeInput(normalizedInitialCode);
        joinRoom(normalizedInitialCode, { silent: !uid && !authError });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [normalizedInitialCode, uid, authError]);

    const toggleHowToPlay = async () => {
        const active = !room?.howToPlay?.active;
        await updateRoom({ howToPlay: { active, id: nowMs() } });
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
        const seqId = nowMs();
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
        const now = nowMs();
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
    }, [autoBgMusic, currentSong, playingBg, setBgMusicState]);

    const fadeMixFader = useCallback((targetPercent, durationMs = 800) => {
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
    }, [mixFader, updateRoom]);

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
    }, [autoBgMusic, currentSong, autoBgFadeOutMs, autoBgFadeInMs, autoBgMixDuringSong, fadeMixFader, mixFader]);
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
        await updateRoom({ bonusDrop: { id: nowMs(), points, by: hostName || 'Host' } });
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
            hostLogger.error(e);
            toast('Gift failed');
        }
    };
    const startReadyCheck = async () => {
        const durationSec = Math.max(3, Number(readyCheckDurationSec || 10));
        const rewardPoints = Math.max(0, Number(readyCheckRewardPoints || 0));
        await updateRoom({ readyCheck: { active: true, startTime: nowMs(), durationSec, rewardPoints } });
        if (readyCheckTimerRef.current) clearTimeout(readyCheckTimerRef.current);
        readyCheckTimerRef.current = setTimeout(() => {
            updateRoom({ 'readyCheck.active': false });
        }, durationSec * 1000);
    };
    const runMissionHypeMoment = async () => {
        if (!roomCode) {
            toast('Create or open a room first');
            return;
        }
        const activeMode = String(room?.activeMode || 'karaoke').trim() || 'karaoke';
        if (activeMode === 'trivia_pop') {
            await updateRoom({
                activeMode: 'trivia_reveal',
                triviaQuestion: {
                    ...(room?.triviaQuestion || {}),
                    status: 'reveal',
                    revealedAt: nowMs()
                },
                missionControl: {
                    ...(room?.missionControl || {}),
                    lastSuggestedAction: 'hype_moment'
                }
            });
            toast('Trivia reveal pushed live.');
            return;
        }
        if (activeMode === 'wyr') {
            await updateRoom({
                activeMode: 'wyr_reveal',
                wyrData: {
                    ...(room?.wyrData || {}),
                    status: 'reveal',
                    revealedAt: nowMs()
                },
                missionControl: {
                    ...(room?.missionControl || {}),
                    lastSuggestedAction: 'hype_moment'
                }
            });
            toast('Crowd split reveal triggered.');
            return;
        }
        await startBeatDrop();
        await dropBonus(activeMode === 'karaoke' ? 100 : 150);
        await updateRoom({
            missionControl: {
                ...(room?.missionControl || {}),
                lastSuggestedAction: 'hype_moment'
            }
        });
        toast('Hype moment triggered.');
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
            hostLogger.error(e);
            toast('Tip award failed');
        }
    };
    const applyHostPreset = async (presetId) => {
        const preset = HOST_NIGHT_PRESETS[presetId];
        if (!preset || !roomCode) return;
        const presetSettings = preset.settings || {};
        const queueSettings = presetSettings.queueSettings || {};
        const gameDefaults = presetSettings.gameDefaults || {};
        const canUseAi = !!capabilities?.[CAPABILITY_KEYS.AI_GENERATE_CONTENT];
        const autoLyricsEnabled = !!presetSettings.autoLyricsOnQueue && canUseAi;
        const payload = {
            hostNightPreset: preset.id,
            autoDj: !!presetSettings.autoDj,
            autoBgMusic: !!presetSettings.autoBgMusic,
            autoPlayMedia: !!presetSettings.autoPlayMedia,
            showVisualizerTv: !!presetSettings.showVisualizerTv,
            showLyricsTv: !!presetSettings.showLyricsTv,
            showScoring: !!presetSettings.showScoring,
            showFameLevel: !!presetSettings.showFameLevel,
            allowSingerTrackSelect: !!presetSettings.allowSingerTrackSelect,
            marqueeEnabled: !!presetSettings.marqueeEnabled,
            marqueeShowMode: presetSettings.marqueeShowMode || 'always',
            chatShowOnTv: !!presetSettings.chatShowOnTv,
            chatTvMode: presetSettings.chatTvMode || 'auto',
            bouncerMode: !!presetSettings.bouncerMode,
            bingoShowTv: presetSettings.bingoShowTv !== false,
            bingoVotingMode: presetSettings.bingoVotingMode || 'host+votes',
            bingoAutoApprovePct: Math.max(10, Math.min(100, Number(presetSettings.bingoAutoApprovePct ?? 50))),
            bingoAudienceReopenEnabled: presetSettings.bingoAudienceReopenEnabled !== false,
            autoLyricsOnQueue: autoLyricsEnabled,
            popTriviaEnabled: presetSettings.popTriviaEnabled !== false,
            gamePreviewId: presetSettings.gamePreviewId || null,
            gameDefaults: {
                triviaRoundSec: Math.max(5, Number(gameDefaults.triviaRoundSec || 20)),
                triviaAutoReveal: gameDefaults.triviaAutoReveal !== false,
                bingoVotingMode: gameDefaults.bingoVotingMode || 'host+votes',
                bingoAutoApprovePct: Math.max(10, Math.min(100, Number(gameDefaults.bingoAutoApprovePct ?? 50)))
            },
            queueSettings: {
                limitMode: queueSettings.limitMode || 'none',
                limitCount: Math.max(0, Number(queueSettings.limitCount || 0)),
                rotation: queueSettings.rotation || 'round_robin',
                firstTimeBoost: queueSettings.firstTimeBoost !== false
            }
        };
        try {
            await updateRoom(payload);
            setHostNightPreset(preset.id);
            setAutoDj(!!payload.autoDj);
            setAutoBgMusic(!!payload.autoBgMusic);
            setAutoPlayMedia(!!payload.autoPlayMedia);
            setQueueLimitMode(payload.queueSettings.limitMode);
            setQueueLimitCount(payload.queueSettings.limitCount);
            setQueueRotation(payload.queueSettings.rotation);
            setQueueFirstTimeBoost(!!payload.queueSettings.firstTimeBoost);
            setShowScoring(!!payload.showScoring);
            setShowFameLevel(!!payload.showFameLevel);
            setAllowSingerTrackSelect(!!payload.allowSingerTrackSelect);
            setMarqueeEnabled(!!payload.marqueeEnabled);
            setMarqueeShowMode(payload.marqueeShowMode || 'always');
            setAudienceBingoReopenEnabled(payload.bingoAudienceReopenEnabled !== false);
            setAutoLyricsOnQueue(!!payload.autoLyricsOnQueue);
            setPopTriviaEnabled(payload.popTriviaEnabled !== false);
            setSearchSources(preset.searchSources || { local: true, youtube: true, itunes: true });

            if (payload.autoBgMusic && !playingBg) {
                setBgMusicState(true);
            }
            if (!payload.autoBgMusic && playingBg) {
                setBgMusicState(false);
            }

            if (preset.autoStartApplePlaylist) {
                const playlistId = parseAppleMusicPlaylistId(appleMusicAutoPlaylistId || room?.appleMusicAutoPlaylistId || '');
                if (playlistId) {
                    try {
                        await playAppleMusicPlaylist(playlistId, { title: appleMusicAutoPlaylistTitle || room?.appleMusicAutoPlaylistTitle || '' });
                    } catch (playlistError) {
                        hostLogger.debug('Preset applied but auto playlist start failed', playlistError);
                    }
                } else {
                    toast('Preset applied. Add an Apple playlist ID to auto-start background music.');
                }
            }

            if (preset.id === 'bingo') {
                openSpotlightFlowFromSetup('bingo');
            } else if (preset.id === 'trivia') {
                openSpotlightFlowFromSetup('trivia_pop');
            }

            if (!!presetSettings.autoLyricsOnQueue && !canUseAi) {
                toast(`${preset.label} applied. AI lyric auto-generation needs a Host subscription.`);
                return;
            }
            toast(`${preset.label} applied.`);
        } catch (error) {
            hostLogger.error('Apply host preset failed', error);
            toast('Could not apply host preset.');
        }
    };
    const copyAiSetupCommands = async () => {
        const commands = [
            'firebase functions:secrets:set GEMINI_API_KEY',
            'firebase deploy --only functions:geminiGenerate'
        ].join('\n');
        try {
            await navigator.clipboard.writeText(commands);
            toast('AI setup commands copied.');
        } catch {
            toast(commands);
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
                tipCrates: normalizeTipCratesForSave(tipCrates),
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
                hostNightPreset: hostNightPreset || 'custom',
                bingoAudienceReopenEnabled: audienceBingoReopenEnabled !== false,
                autoLyricsOnQueue: !!autoLyricsOnQueue && !!capabilities?.[CAPABILITY_KEYS.AI_GENERATE_CONTENT],
                popTriviaEnabled: popTriviaEnabled !== false,
                queueSettings: {
                    limitMode: queueLimitMode || 'none',
                    limitCount: Math.max(0, Number(queueLimitCount || 0)),
                    rotation: queueRotation || 'round_robin',
                    firstTimeBoost: !!queueFirstTimeBoost
                }
            });
        }
        setSettingsNavOpen(false);
        setShowSettings(false);
        setTab('stage');
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
            const storagePath = `room_branding/${roomCode}/${nowMs()}-${stem}.${ext}`;
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
            hostLogger.error('Logo upload failed', e);
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
        const [uploadsSnap, reactionsSnap, selfieSnap] = await Promise.all([
            getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_uploads'), where('roomCode', '==', roomCode))),
            getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), where('roomCode', '==', roomCode))),
            getDocs(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_submissions'), where('roomCode', '==', roomCode)))
        ]);
        const storagePaths = new Set();
        uploadsSnap.docs.forEach((docSnap) => {
            const data = docSnap.data() || {};
            if (typeof data.storagePath === 'string' && data.storagePath) {
                storagePaths.add(data.storagePath);
            }
        });
        reactionsSnap.docs.forEach((docSnap) => {
            const data = docSnap.data() || {};
            if (typeof data.storagePath === 'string' && data.storagePath) {
                storagePaths.add(data.storagePath);
            }
        });
        selfieSnap.docs.forEach((docSnap) => {
            const data = docSnap.data() || {};
            if (typeof data.storagePath === 'string' && data.storagePath) {
                storagePaths.add(data.storagePath);
            }
        });

        let deleted = 0;
        for (const path of storagePaths) {
            if (path) {
                try { await deleteObject(storageRef(storage, path)); } catch { /* ignore delete failures */ }
            }
            deleted += 1;
        }
        for (const docSnap of uploadsSnap.docs) {
            try { await deleteDoc(docSnap.ref); } catch { /* ignore delete failures */ }
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
                howToPlay: { active: false, id: nowMs() },
                gameRulesId: nowMs()
            });
            toast('Room cleared.');
        } catch (e) {
            hostLogger.error(e);
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
    const normalizeYouTubePlaylistItems = (rawItems = []) => (
        (rawItems || [])
            .map(item => ({
                id: item.id,
                title: item.title || 'Untitled',
                channel: item.channelTitle || 'YouTube',
                thumbnail: item.thumbnails?.medium?.url || item.thumbnails?.default?.url || '',
                url: item.id ? `https://www.youtube.com/watch?v=${item.id}` : ''
            }))
            .filter(item => item.id)
    );

    const indexYouTubePlaylist = async (playlistId) => {
        const data = await callFunction('youtubePlaylist', { playlistId, maxTotal: 150 });
        const items = normalizeYouTubePlaylistItems(data?.items || []);
        const updated = (() => {
            const existing = new Map((ytIndex || []).map(item => [item.videoId, item]));
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
        return items;
    };

    const queueYouTubePlaylistItems = async (items, singerOverride) => {
        if (!roomCode) return { queuedCount: 0, firstQueuedSong: null };
        const songsCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs');
        const queueItems = (items || []).filter(item => item?.id && item?.url);
        if (!queueItems.length) return { queuedCount: 0, firstQueuedSong: null };
        const basePriority = nowMs();
        const singerName = singerOverride || room?.hostName || hostName || 'Host';
        let queuedCount = 0;
        let firstQueuedSong = null;
        for (let start = 0; start < queueItems.length; start += 400) {
            const chunk = queueItems.slice(start, start + 400);
            const batch = writeBatch(db);
            chunk.forEach((item, idx) => {
                const globalIdx = start + idx;
                const songRef = doc(songsCol);
                const payload = {
                    roomCode,
                    songId: buildSongKey(item.title, item.channel || 'YouTube'),
                    trackId: null,
                    trackSource: 'youtube',
                    songTitle: item.title,
                    artist: item.channel || 'YouTube',
                    singerName,
                    mediaUrl: item.url,
                    albumArtUrl: item.thumbnail || '',
                    status: 'requested',
                    timestamp: serverTimestamp(),
                    priorityScore: basePriority + globalIdx,
                    emoji: EMOJI.mic,
                    backingAudioOnly: false,
                    audioOnly: false
                };
                if (!firstQueuedSong) {
                    firstQueuedSong = { id: songRef.id, ...payload };
                }
                batch.set(songRef, payload);
                queuedCount += 1;
            });
            await batch.commit();
        }
        return { queuedCount, firstQueuedSong };
    };

    const activateQueueSong = async (song, roomSnapshot = roomRef.current) => {
        if (!song?.id) return;
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', song.id), {
            status: 'performing',
            performingStartedAt: serverTimestamp()
        });
        const queuePlayback = resolveQueuePlayback(song, roomSnapshot?.autoPlayMedia !== false);
        const nextMediaUrl = queuePlayback.mediaUrl;
        const useAppleBacking = queuePlayback.usesAppleBacking;
        const autoStartMedia = queuePlayback.autoStartMedia;
        if (useAppleBacking && autoStartMedia) {
            await playAppleMusicTrack(song.appleMusicId, { title: song.songTitle, artist: song.artist });
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
                videoStartTimestamp: autoStartMedia ? nowMs() : null,
                videoVolume: 100,
                showLyricsTv: false,
                showVisualizerTv: false,
                showLyricsSinger: false,
                appleMusicPlayback: null
            });
        }
        logActivity(roomCode, song.singerName, 'took the stage!', EMOJI.mic);
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
            const items = await indexYouTubePlaylist(playlistId);
            setYtPlaylistStatus(`Indexed ${items.length} videos from playlist`);
        } catch (e) {
            hostLogger.error('Playlist load error', e);
            setYtPlaylistStatus('Failed to load playlist. Check server keys or playlist privacy.');
            toast('Playlist load failed.');
        } finally {
            setYtPlaylistLoading(false);
        }
    };

    const loadAndQueueYouTubePlaylist = async () => {
        const playlistId = parsePlaylistId(ytPlaylistUrl);
        if (!playlistId) {
            toast('Paste a valid YouTube playlist URL or ID');
            return;
        }
        if (!roomCode) {
            toast('Create or open a room first');
            return;
        }
        const hadPerformer = (songsRef.current || []).some(song => song.status === 'performing');
        const hadQueued = (songsRef.current || []).some(song => song.status === 'requested');
        setYtPlaylistLoading(true);
        setYtPlaylistStatus('Loading playlist and queueing...');
        try {
            const items = await indexYouTubePlaylist(playlistId);
            const { queuedCount, firstQueuedSong } = await queueYouTubePlaylistItems(items);
            if (!roomRef.current?.autoDj) {
                await updateRoom({ autoDj: true });
                setAutoDj(true);
                roomRef.current = { ...(roomRef.current || {}), autoDj: true };
            }
            let autoStarted = false;
            if (!hadPerformer && !hadQueued && firstQueuedSong) {
                await activateQueueSong(firstQueuedSong, roomRef.current);
                autoStarted = true;
            } else if (!hadPerformer) {
                setTimeout(() => {
                    startNextFromQueue().catch((error) => {
                        hostLogger.warn('Playlist queue kickoff failed', error);
                    });
                }, 650);
            }
            const kickoffMessage = autoStarted
                ? ' First track started.'
                : ' Auto-DJ is enabled for back-to-back playback.';
            setYtPlaylistStatus(`Indexed ${items.length} videos and queued ${queuedCount}.${kickoffMessage}`);
            toast(`Queued ${queuedCount} songs from playlist`);
        } catch (e) {
            hostLogger.error('Playlist queue error', e);
            setYtPlaylistStatus('Failed to queue playlist. Check server keys, playlist privacy, and room state.');
            toast('Playlist queue failed.');
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
            hostLogger.error(e);
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
            const storagePath = `room_uploads/${roomCode}/${nowMs()}_${safeName}`;
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
            hostLogger.error(e);
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
                priorityScore: nowMs(),
                emoji: EMOJI.mic,
                backingAudioOnly: item.mediaType === 'audio' || isAudioUrl(item.url),
                audioOnly: item.mediaType === 'audio' || isAudioUrl(item.url)
            });
            toast('Added local upload to queue');
        } catch (e) {
            hostLogger.error(e);
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
            hostLogger.error(e);
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
    const downloadTextFile = (filename, payload, mimeType = 'text/plain') => {
        const blob = new Blob([String(payload || '')], { type: mimeType });
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
            hostLogger.error(e);
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
            const tournament = (() => {
                const roomSummary = room?.bracketLastSummary || null;
                if (roomSummary?.summaryVersion) {
                    const hasMoments = (roomSummary?.matchHistory || []).length > 0 || !!roomSummary?.championName;
                    return hasMoments ? roomSummary : null;
                }
                const liveBracket = room?.karaokeBracket || null;
                if (!liveBracket?.rounds?.length) return null;
                const built = buildBracketSummary({ ...liveBracket, roomCode });
                const hasMoments = (built?.matchHistory || []).length > 0 || !!built?.championName;
                return hasMoments ? built : null;
            })();
            const tournamentMoments = (tournament?.timeCapsule?.moments || []).slice(0, 8).map((moment) => ({
                id: moment.id || `tournament_moment_${Math.random().toString(36).slice(2, 7)}`,
                icon: EMOJI.trophy || EMOJI.star,
                text: moment.text || 'Tournament moment',
                user: tournament?.championName || 'Tournament',
                timestamp: moment?.at || nowMs()
            }));
            const recap = {
                roomCode,
                generatedAt: nowMs(),
                totalSongs: performed.length,
                totalUsers: users.length,
                topPerformers,
                topEmojis,
                loudestPerformance,
                photos: photos.slice(0, 24),
                tournament,
                highlights: [...tournamentMoments, ...(activities || []).slice(0, 20)].slice(0, 30)
            };
            await updateRoom({ closedAt: nowMs(), recap });
            const recapUrl = `${window.location.origin}/?room=${roomCode}&mode=recap`;
            await navigator.clipboard.writeText(recapUrl);
            toast('Room closed. Recap link copied.');
        } catch (e) {
            hostLogger.error(e);
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
            songTitle: baseSong.songTitle || 'Featured Performance',
            singerName: baseSong.singerName || room?.hostName || 'Guest',
            hypeScore: baseSong.hypeScore || 120,
            applauseScore: baseSong.applauseScore || 85,
            hostBonus: baseSong.hostBonus || 25,
            albumArtUrl: baseSong.albumArtUrl || '',
            topFan,
            vibeStats,
            timestamp: nowMs(),
            preview: true
        };
        await updateRoom({ recapPreview });
        toast('Recap preview sent to TV');
    };
    // Fix: Simple reload for silence
    const silenceAll = () => stopAllSfx();
    
    // Helpers for other tabs
    const sendUserMessage = async (uid, msg, options = {}) => {
        if (!uid) return;
        if (!msg) {
            await updateRoom({ spotlightUser: null });
            toast("Spotlight OFF");
            return;
        }
        const providedTight15 = sanitizeTight15List(Array.isArray(options?.tight15List) ? options.tight15List : []);
        const challengeSong = normalizeTight15Entry(options?.challengeEntry || null);
        const roomUser = users.find((u) => {
            const userUid = u.uid || u.id?.split('_')[1];
            return userUid === uid;
        });
        let spotlightTight15 = providedTight15.slice(0, 3);
        if (!spotlightTight15.length && roomUser) {
            try {
                const fullList = await getRoomUserTight15(roomUser);
                spotlightTight15 = fullList
                    .slice(0, 3)
                    .map((entry) => normalizeTight15Entry(entry))
                    .filter(Boolean);
            } catch (error) {
                hostLogger.debug('Could not load spotlight Tight 15', error);
            }
        }
        await updateRoom({
            spotlightUser: {
                id: uid,
                msg,
                name: roomUser?.name || '',
                avatar: roomUser?.avatar || '',
                tight15: spotlightTight15,
                challengeSong: challengeSong || null
            }
        });
        toast("Spotlight ON");
    };
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
        } catch(e) { hostLogger.error("Log error", e); }
    };
    const selectSettingsTab = useCallback((nextTab) => {
        setSettingsTab(nextTab);
        if (nextTab === 'chat') markChatTabSeen();
        const sectionId = SETTINGS_TAB_TO_SECTION[nextTab];
        if (sectionId) {
            const sectionMeta = getSectionMeta(sectionId);
            if (sectionMeta?.view) setActiveWorkspaceView(sectionMeta.view);
            setActiveWorkspaceSection(sectionId);
        }
    }, [markChatTabSeen]);
    const handleSettingsNavSelect = useCallback((nextTab) => {
        selectSettingsTab(nextTab);
        setSettingsNavOpen(false);
    }, [selectSettingsTab]);
    const openChatSettings = () => {
        setTab('admin');
        setActiveWorkspaceView('audience');
        setActiveWorkspaceSection('audience.chat');
        handleSettingsNavSelect('chat');
    };
    const openAdminWorkspace = (sectionId = 'ops.room_setup') => {
        const targetSection = sectionId || 'ops.room_setup';
        const sectionMeta = getSectionMeta(targetSection);
        const viewId = sectionMeta?.view || 'ops';
        const mappedTab = SECTION_TO_SETTINGS_TAB[targetSection] || 'general';
        setActiveWorkspaceView(viewId);
        setActiveWorkspaceSection(targetSection);
        setSettingsTab(mappedTab);
        setTab('admin');
        setShowSettings(true);
    };
    const leaveAdminWithTarget = (targetTab = 'stage') => {
        if (hasPendingRoomSettings) {
            toast('Save Room Settings before leaving Admin.');
            return false;
        }
        setSettingsNavOpen(false);
        setShowSettings(false);
        if (targetTab) setTab(targetTab);
        return true;
    };
    const selectWorkspaceView = (viewId) => {
        const nextView = String(viewId || 'ops').trim() || 'ops';
        const sectionId = getViewDefaultSection(nextView);
        const mappedTab = SECTION_TO_SETTINGS_TAB[sectionId] || 'general';
        if (nextView === 'queue') {
            leaveAdminWithTarget('stage');
            return;
        }
        if (nextView === 'games') {
            leaveAdminWithTarget('games');
            return;
        }
        if (nextView === 'audience' && sectionId === 'audience.roster') {
            leaveAdminWithTarget('lobby');
            return;
        }
        setActiveWorkspaceView(nextView);
        setActiveWorkspaceSection(sectionId);
        setTab('admin');
        setSettingsTab(mappedTab);
        setShowSettings(true);
    };
    const closeSettingsSurface = () => {
        if (tab === 'admin') {
            leaveAdminWithTarget('stage');
            return;
        }
        setShowSettings(false);
        setSettingsNavOpen(false);
    };
    const handleTopChromeTabChange = (nextTab) => {
        if (tab === 'admin' && nextTab !== 'admin' && hasPendingRoomSettings) {
            toast('Save Room Settings before leaving Admin.');
            return;
        }
        setTab(nextTab);
    };
    const refreshBillingEntitlements = async (showToast = false) => {
        setOrgContext(prev => ({ ...prev, loading: true, error: '' }));
        try {
            await ensureOrganization('');
            const entitlements = await getMyEntitlements();
            syncOrgContextFromEntitlements(entitlements);
            await refreshUsageSummary(false);
            if (entitlements?.capabilities?.[CAPABILITY_KEYS.BILLING_INVOICE_DRAFTS]) {
                await refreshInvoiceHistory(false);
            } else {
                setInvoiceHistory([]);
                setInvoiceDraft(null);
            }
            if (showToast) toast('Billing status refreshed');
            return entitlements;
        } catch (e) {
            if (isAppCheckError(e)) {
                hostLogger.debug('Billing entitlement refresh waiting on App Check', e);
                setOrgContext(prev => ({ ...prev, loading: false, error: BILLING_WARMUP_MESSAGE }));
                if (showToast) toast('Billing tools are still warming up');
                return null;
            }
            hostLogger.error('Billing entitlement refresh failed', e);
            setOrgContext(prev => ({ ...prev, loading: false, error: 'Could not refresh billing status.' }));
            if (showToast) toast('Could not refresh billing status');
            return null;
        }
    };
    const refreshUsageSummary = async (showToast = false, periodOverride = '') => {
        setUsageSummary(prev => ({ ...prev, loading: true, error: '' }));
        try {
            const targetPeriod = String(periodOverride || selectedUsagePeriod || '').trim();
            const usage = await getMyUsageSummary(targetPeriod);
            setUsageSummary({
                orgId: usage?.orgId || orgContext?.orgId || '',
                period: usage?.period || targetPeriod || '',
                meters: usage?.meters || {},
                totals: usage?.totals || { estimatedOverageCents: 0 },
                loading: false,
                error: ''
            });
            if (showToast) toast('Usage summary refreshed');
            return usage;
        } catch (e) {
            if (isAppCheckError(e)) {
                hostLogger.debug('Usage summary waiting on App Check', e);
                setUsageSummary(prev => ({ ...prev, loading: false, error: BILLING_WARMUP_MESSAGE }));
                if (showToast) toast('Billing tools are still warming up');
                return null;
            }
            hostLogger.error('Usage summary refresh failed', e);
            setUsageSummary(prev => ({ ...prev, loading: false, error: 'Could not refresh usage summary.' }));
            if (showToast) toast('Could not refresh usage summary');
            return null;
        }
    };
    const generateUsageInvoiceDraft = async (showToast = false) => {
        if (!canUseInvoiceDrafts) {
            if (showToast) toast(`${getMissingCapabilityLabel(CAPABILITY_KEYS.BILLING_INVOICE_DRAFTS)} is not available on this plan.`);
            return null;
        }
        setInvoiceDraftLoading(true);
        try {
            const targetPeriod = String(selectedUsagePeriod || usageSummary?.period || '').trim();
            const taxRatePercent = Math.max(0, Math.min(100, Number(invoiceTaxRatePercent || 0)));
            const draft = await getMyUsageInvoiceDraft({
                period: targetPeriod,
                includeBasePlan: !!invoiceIncludeBasePlan,
                taxRatePercent,
                customerName: (invoiceCustomerName || '').trim()
            });
            setInvoiceDraft(draft || null);
            if (showToast) toast('Invoice draft generated');
            return draft;
        } catch (e) {
            hostLogger.error('Invoice draft generation failed', e);
            toast('Could not generate invoice draft');
            return null;
        } finally {
            setInvoiceDraftLoading(false);
        }
    };
    const refreshInvoiceHistory = async (showToast = false) => {
        if (!canUseInvoiceDrafts) {
            setInvoiceHistory([]);
            return [];
        }
        setInvoiceHistoryLoading(true);
        try {
            const payload = await listMyUsageInvoices({ limit: 40 });
            const items = Array.isArray(payload?.invoices) ? payload.invoices : [];
            setInvoiceHistory(items);
            if (showToast) toast('Invoice history refreshed');
            return items;
        } catch (e) {
            if (!isPermissionDeniedError(e)) {
                hostLogger.error('Invoice history refresh failed', e);
                if (showToast) toast('Could not load invoice history');
            } else if (showToast) {
                toast(`${getMissingCapabilityLabel(CAPABILITY_KEYS.BILLING_INVOICE_DRAFTS)} is not available on this plan.`);
            }
            return [];
        } finally {
            setInvoiceHistoryLoading(false);
        }
    };
    const saveInvoiceDraftSnapshot = async () => {
        if (!canUseInvoiceDrafts) {
            toast(`${getMissingCapabilityLabel(CAPABILITY_KEYS.BILLING_INVOICE_DRAFTS)} is not available on this plan.`);
            return null;
        }
        if (invoiceSaveLoading) return;
        setInvoiceSaveLoading(true);
        try {
            const targetPeriod = String(selectedUsagePeriod || usageSummary?.period || '').trim();
            const taxRatePercent = Math.max(0, Math.min(100, Number(invoiceTaxRatePercent || 0)));
            const payload = await saveMyUsageInvoiceDraft({
                period: targetPeriod,
                includeBasePlan: !!invoiceIncludeBasePlan,
                taxRatePercent,
                customerName: (invoiceCustomerName || '').trim(),
                status: invoiceStatusDraft || 'draft',
                notes: invoiceNotes || ''
            });
            if (payload?.invoiceDraft) {
                setInvoiceDraft(payload.invoiceDraft);
            }
            await refreshInvoiceHistory(false);
            toast(`Invoice snapshot saved (${payload?.recordId || 'ok'})`);
            return payload;
        } catch (e) {
            hostLogger.error('Save invoice snapshot failed', e);
            toast('Could not save invoice snapshot');
            return null;
        } finally {
            setInvoiceSaveLoading(false);
        }
    };
    const downloadQbseCsv = (kind = 'line_items') => {
        if (!invoiceDraft?.quickbooks?.selfEmployed) {
            toast('Generate invoice draft first');
            return;
        }
        const qb = invoiceDraft.quickbooks.selfEmployed;
        const period = String(invoiceDraft?.period || selectedUsagePeriod || getCurrentUsagePeriodKey());
        if (kind === 'transactions') {
            downloadTextFile(
                `bross-qbse-transactions-${period}.csv`,
                qb.qbseTransactionCsv || '',
                'text/csv;charset=utf-8'
            );
            return;
        }
        downloadTextFile(
            `bross-invoice-lines-${period}.csv`,
            qb.lineItemCsv || '',
            'text/csv;charset=utf-8'
        );
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
            hostLogger.error('Subscription checkout failed', e);
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
            hostLogger.error('Billing portal launch failed', e);
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

        let latestEntitlements = null;
        getMyEntitlements()
            .then((entitlements) => {
                latestEntitlements = entitlements;
                syncOrgContextFromEntitlements(entitlements);
                return getMyUsageSummary(selectedUsagePeriod);
            })
            .then((usage) => {
                if (!usage) return;
                setUsageSummary({
                    orgId: usage?.orgId || orgContext?.orgId || '',
                    period: usage?.period || selectedUsagePeriod || '',
                    meters: usage?.meters || {},
                    totals: usage?.totals || { estimatedOverageCents: 0 },
                    loading: false,
                    error: ''
                });
                const invoiceCapabilityEnabled = !!latestEntitlements?.capabilities?.[CAPABILITY_KEYS.BILLING_INVOICE_DRAFTS];
                if (!invoiceCapabilityEnabled) return null;
                return listMyUsageInvoices({ limit: 40 });
            })
            .then((historyPayload) => {
                if (!historyPayload) return;
                setInvoiceHistory(Array.isArray(historyPayload?.invoices) ? historyPayload.invoices : []);
            })
            .catch((e) => {
                if (!isPermissionDeniedError(e)) {
                    hostLogger.debug('Post-billing refresh failed', e);
                }
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
    const sampleArt = SAMPLE_ART;
    const top100Seed = TOP100_SEED;

    const top100Songs = useMemo(() => {
        const arts = Object.values(sampleArt);
        return top100Seed.map((s, idx) => {
            const artKey = `${s.title}__${s.artist}`;
            return { ...s, artKey, art: top100Art[artKey] || arts[idx % arts.length] };
        });
    }, [top100Art, sampleArt, top100Seed]);
    const fetchTop100Art = async (song) => {
        const artKey = song.artKey || `${song.title}__${song.artist}`;
        if (top100Art[artKey] || top100ArtLoading[artKey]) return top100Art[artKey];
        if (nowMs() < itunesBackoffUntil) return null;
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
            hostLogger.error(e);
            const msg = `${e?.message || ''}`.toLowerCase();
            if (msg.includes('rate limit') || msg.includes('resource-exhausted') || msg.includes('429')) {
                itunesBackoffUntil = nowMs() + 15000;
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
        const singerName = singerOverride || room?.hostName || hostName || 'Host';
        let fetchedApple = null;
        try {
            fetchedApple = await callFunction('appleMusicLyrics', {
                title: song.title,
                artist: song.artist || '',
                storefront: 'us',
                musicUserToken: getAppleMusicUserToken?.() || ''
            });
        } catch (err) {
            hostLogger.debug('Browse Apple lyrics fetch failed', err);
        }
        const hasTimedLyrics = Array.isArray(fetchedApple?.timedLyrics) && fetchedApple.timedLyrics.length > 0;
        const hasPlainLyrics = !!String(fetchedApple?.lyrics || '').trim();
        const appleMusicId = fetchedApple?.songId ? String(fetchedApple.songId) : '';
        let aiLyricsText = '';
        if (!hasTimedLyrics && !hasPlainLyrics && room?.autoLyricsOnQueue && typeof generateAIContent === 'function') {
            try {
                const generated = await generateAIContent('lyrics', {
                    title: song.title,
                    artist: song.artist || ''
                });
                aiLyricsText = String(generated?.lyrics || '').trim();
            } catch (err) {
                hostLogger.debug('Browse AI lyrics fallback failed', err);
            }
        }
        const lyricsSource = hasTimedLyrics || hasPlainLyrics ? 'apple' : (aiLyricsText ? 'ai' : '');
        const lyricsText = hasPlainLyrics ? fetchedApple.lyrics : aiLyricsText;

        const songRecord = await ensureSong({
            title: song.title,
            artist: song.artist || 'Unknown',
            artworkUrl: art || song.art || '',
            appleMusicId,
            verifyMeta: art || song.art ? {} : false,
            verifiedBy: hostName || 'host'
        });
        const songId = songRecord?.songId || buildSongKey(song.title, song.artist || 'Unknown');
        let trackRecord = null;
        if (appleMusicId) {
            try {
                trackRecord = await ensureTrack({
                    songId,
                    source: 'apple',
                    mediaUrl: '',
                    appleMusicId,
                    duration: null,
                    audioOnly: true,
                    backingOnly: true,
                    addedBy: hostName || 'Host'
                });
            } catch (err) {
                hostLogger.debug('Browse Apple track ensure failed', err);
            }
        }
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
            roomCode,
            songId,
            trackId: trackRecord?.trackId || null,
            trackSource: trackRecord?.trackId ? 'apple' : null,
            songTitle: song.title,
            artist: song.artist,
            singerName,
            mediaUrl: '',
            albumArtUrl: art || song.art || '',
            lyrics: lyricsText,
            lyricsTimed: hasTimedLyrics ? fetchedApple.timedLyrics : null,
            appleMusicId,
            musicSource: appleMusicId ? 'apple' : '',
            lyricsSource,
            status: 'requested',
            timestamp: serverTimestamp(),
            priorityScore: nowMs(),
            emoji: EMOJI.mic,
            backingAudioOnly: false,
            audioOnly: false
        });
        if (hasTimedLyrics) {
            toast('Queued with Apple timed lyrics');
            return;
        }
        if (hasPlainLyrics) {
            toast('Queued with Apple lyrics');
            return;
        }
        if (aiLyricsText) {
            toast(appleMusicId ? 'Queued with Apple backing + AI lyrics fallback' : 'Queued with AI lyrics fallback');
            return;
        }
        if (fetchedApple?.needsUserToken) {
            toast('Queued with Apple backing. Lyrics need Apple Music host authorization (connect Apple Music).');
            return;
        }
        if (fetchedApple && fetchedApple.found === false) {
            toast(appleMusicId ? 'Queued with Apple backing. Apple lyrics not found for this track.' : 'Queued. Apple lyrics not found for this track.');
            return;
        }
        toast(appleMusicId ? 'Queued with Apple backing (no lyrics found)' : 'Added to queue');
    };

    const resolveRoomUserUid = (roomUser = {}) => roomUser?.uid || roomUser?.id?.split('_')[1] || '';

    const getRoomUserTight15 = async (roomUser = {}) => {
        const fallback = sanitizeTight15List(roomUser?.tight15 || roomUser?.tight15Temp || []);
        const uid = resolveRoomUserUid(roomUser);
        if (!uid) return fallback;
        try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (!snap.exists()) return fallback;
            const profileList = sanitizeTight15List(snap.data()?.tight15 || []);
            return profileList.length ? profileList : fallback;
        } catch (error) {
            hostLogger.debug('Failed to load singer Tight 15', error);
            return fallback;
        }
    };

    const queueTight15EntryForSinger = async ({ roomUser, entry, sourceLabel = 'Tight 15' }) => {
        const normalized = normalizeTight15Entry(entry);
        if (!normalized) return null;
        const singerUid = resolveRoomUserUid(roomUser);
        const singerName = roomUser?.name || 'Singer';
        const singerAvatar = roomUser?.avatar || EMOJI.mic;
        const songRecord = await ensureSong({
            title: normalized.songTitle,
            artist: normalized.artist,
            artworkUrl: normalized.albumArtUrl || '',
            verifyMeta: normalized.albumArtUrl ? {} : false,
            verifiedBy: hostName || 'host'
        });
        const songId = songRecord?.songId || buildSongKey(normalized.songTitle, normalized.artist);
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
            roomCode,
            songId,
            songTitle: normalized.songTitle,
            artist: normalized.artist,
            singerName,
            singerUid: singerUid || null,
            emoji: singerAvatar,
            mediaUrl: '',
            albumArtUrl: normalized.albumArtUrl || '',
            status: 'requested',
            timestamp: serverTimestamp(),
            priorityScore: nowMs(),
            source: sourceLabel
        });
        return normalized;
    };

    const queueRandomTight15ForUser = async (roomUser = {}) => {
        const singerUid = resolveRoomUserUid(roomUser) || roomUser?.id || '';
        if (!singerUid) return;
        if (tight15QueueBusyUid === singerUid) return;
        setTight15QueueBusyUid(singerUid);
        try {
            const tight15 = await getRoomUserTight15(roomUser);
            if (!tight15.length) {
                toast(`${roomUser?.name || 'Singer'} has no Tight 15 songs yet.`);
                return;
            }
            const pick = tight15[Math.floor(Math.random() * tight15.length)];
            await queueTight15EntryForSinger({ roomUser, entry: pick, sourceLabel: 'tight15_random' });
            toast(`Queued random Tight 15 song for ${roomUser?.name || 'Singer'}.`);
        } catch (error) {
            hostLogger.error('Queue random Tight 15 failed', error);
            toast('Could not queue Tight 15 song.');
        } finally {
            setTight15QueueBusyUid('');
        }
    };

    const queueSelectedTight15ForUser = async (roomUser = {}, entry = null, sourceLabel = 'tight15_profile') => {
        const singerUid = resolveRoomUserUid(roomUser) || roomUser?.id || '';
        if (!singerUid || !entry) return;
        if (tight15QueueBusyUid === singerUid) return;
        setTight15QueueBusyUid(singerUid);
        try {
            const normalized = normalizeTight15Entry(entry);
            if (!normalized) {
                toast('That Tight 15 entry is invalid.');
                return;
            }
            await queueTight15EntryForSinger({ roomUser, entry: normalized, sourceLabel });
            toast(`Queued ${normalized.songTitle} for ${roomUser?.name || 'Singer'}.`);
        } catch (error) {
            hostLogger.error('Queue Tight 15 entry failed', error);
            toast('Could not queue selected Tight 15 song.');
        } finally {
            setTight15QueueBusyUid('');
        }
    };

    const openTight15ProfileCard = async (roomUser = {}) => {
        const singerUid = resolveRoomUserUid(roomUser) || roomUser?.id || '';
        if (!singerUid) return;
        if (tight15ProfileBusyUid === singerUid) return;
        setTight15ProfileBusyUid(singerUid);
        try {
            const tight15 = await getRoomUserTight15(roomUser);
            setTight15Profile({
                uid: singerUid,
                name: roomUser?.name || 'Singer',
                avatar: roomUser?.avatar || EMOJI.mic,
                roomUser,
                tight15
            });
            if (!tight15.length) {
                toast(`${roomUser?.name || 'Singer'} has no Tight 15 songs yet.`);
            }
        } catch (error) {
            hostLogger.error('Open Tight 15 profile failed', error);
            toast('Could not load Tight 15 profile.');
        } finally {
            setTight15ProfileBusyUid('');
        }
    };

    const launchSpotlightTight15Challenge = async (roomUser = {}) => {
        const singerUid = resolveRoomUserUid(roomUser) || roomUser?.id || '';
        if (!singerUid) return;
        if (tight15QueueBusyUid === singerUid) return;
        setTight15QueueBusyUid(singerUid);
        try {
            const tight15 = await getRoomUserTight15(roomUser);
            if (!tight15.length) {
                toast(`${roomUser?.name || 'Singer'} has no Tight 15 songs yet.`);
                return;
            }
            const pick = tight15[Math.floor(Math.random() * tight15.length)];
            await queueTight15EntryForSinger({
                roomUser,
                entry: pick,
                sourceLabel: 'tight15_spotlight_challenge'
            });
            await sendUserMessage(
                singerUid,
                `Tight 15 Challenge: ${pick.songTitle}`,
                { tight15List: tight15.slice(0, 3), challengeEntry: pick }
            );
            toast(`Spotlight challenge launched for ${roomUser?.name || 'Singer'}.`);
        } catch (error) {
            hostLogger.error('Launch Tight 15 spotlight challenge failed', error);
            toast('Could not start spotlight challenge.');
        } finally {
            setTight15QueueBusyUid('');
        }
    };

    const createSweet16Bracket = async (options = {}) => {
        if (bracketBusy) return;
        setBracketBusy(true);
        try {
            const seedUids = Array.isArray(options?.seedUids) ? options.seedUids.filter(Boolean) : [];
            const seedMode = seedUids.length ? 'manual' : 'auto';
            const shouldRandomize = seedMode === 'manual' ? !!options?.randomize : true;
            const candidateUsers = users.filter((u) => {
                const uid = resolveRoomUserUid(u);
                if (!uid) return false;
                if (room?.hostUid && uid === room.hostUid) return false;
                if (room?.hostName && String(u?.name || '').trim() === String(room.hostName).trim()) return false;
                return true;
            });
            const hydrated = await Promise.all(candidateUsers.map(async (u) => ({
                roomUser: u,
                uid: resolveRoomUserUid(u),
                tight15: await getRoomUserTight15(u)
            })));
            const eligible = hydrated.filter((entry) => entry.uid && entry.tight15.length > 0);
            if (eligible.length < 2) {
                toast('Need at least 2 singers with Tight 15 songs for a bracket.');
                return;
            }
            const eligibleByUid = new Map(eligible.map((entry) => [entry.uid, entry]));
            let seededPool = eligible;
            if (seedMode === 'manual') {
                const seen = new Set();
                const ordered = [];
                seedUids.forEach((uid) => {
                    if (seen.has(uid)) return;
                    seen.add(uid);
                    const entry = eligibleByUid.get(uid);
                    if (entry) ordered.push(entry);
                });
                if (ordered.length < 2) {
                    toast('Need at least 2 selected singers with Tight 15 songs.');
                    return;
                }
                seededPool = ordered;
            }
            const maxSupported = Math.min(16, seededPool.length);
            const bracketSize = Math.pow(2, Math.floor(Math.log2(maxSupported)));
            if (bracketSize < 2) {
                toast('Not enough bracket-ready singers.');
                return;
            }
            const seeded = (shouldRandomize ? shuffleList(seededPool) : [...seededPool]).slice(0, bracketSize);
            const contestantsByUid = {};
            const contestantOrder = [];
            seeded.forEach((entry) => {
                contestantsByUid[entry.uid] = {
                    uid: entry.uid,
                    name: entry.roomUser?.name || 'Singer',
                    avatar: entry.roomUser?.avatar || EMOJI.mic,
                    tight15: sanitizeTight15List(entry.tight15)
                };
                contestantOrder.push(entry.uid);
            });
            const firstRound = buildBracketRound({
                contestantUids: contestantOrder,
                contestantsByUid,
                roundIndex: 0
            });
            const bracketPayload = {
                id: `sweet16_${nowMs()}`,
                style: 'sweet16',
                format: 'single_elimination',
                roomCode,
                size: bracketSize,
                status: 'setup',
                createdAt: nowMs(),
                contestantOrder,
                contestantsByUid,
                rounds: [firstRound],
                activeRoundIndex: 0,
                activeMatchId: null,
                crowdVotingEnabled: true,
                roundTransition: null,
                championCelebration: null,
                seedMode,
                matchHistory: [],
                auditTrail: [],
                championUid: null,
                championName: ''
            };
            const seededNames = contestantOrder
                .map((uid, idx) => `${idx + 1}. ${contestantsByUid?.[uid]?.name || 'Singer'}`)
                .join(', ');
            const withAudit = appendBracketAuditEvent(bracketPayload, {
                type: 'bracket_created',
                text: `Bracket created (${seedMode}${shouldRandomize ? '/random' : '/ordered'}).`,
                bracketSize,
                seedMode,
                randomize: !!shouldRandomize,
                seededUids: contestantOrder,
                seededNames
            });
            await updateRoom({
                activeMode: 'karaoke_bracket',
                karaokeBracket: withAudit,
                gameData: withAudit,
                gameParticipantMode: 'all',
                gameParticipants: null
            });
            await logActivity(roomCode, hostName || 'Host', `created a Sweet ${bracketSize} bracket (${seedMode}).`, EMOJI.star);
            toast(`Sweet ${bracketSize} bracket ready.`);
        } catch (error) {
            hostLogger.error('Create Sweet 16 bracket failed', error);
            toast('Could not create bracket.');
        } finally {
            setBracketBusy(false);
        }
    };

    const toggleBracketCrowdVoting = async (enabled) => {
        const bracket = room?.karaokeBracket;
        if (!bracket?.rounds?.length || bracketBusy) return;
        setBracketBusy(true);
        try {
            let nextBracket = {
                ...bracket,
                crowdVotingEnabled: !!enabled
            };
            nextBracket = appendBracketAuditEvent(nextBracket, {
                type: 'crowd_voting_toggled',
                text: enabled ? 'Crowd voting enabled.' : 'Crowd voting paused.',
                enabled: !!enabled
            });
            await updateRoom({
                activeMode: 'karaoke_bracket',
                karaokeBracket: nextBracket,
                gameData: nextBracket
            });
            toast(enabled ? 'Crowd voting enabled.' : 'Crowd voting paused.');
        } catch (error) {
            hostLogger.error('Toggle bracket crowd voting failed', error);
            toast('Could not update crowd voting.');
        } finally {
            setBracketBusy(false);
        }
    };

    const queueNextBracketMatch = async () => {
        const bracket = room?.karaokeBracket;
        if (!bracket?.rounds?.length) {
            toast('Create a bracket first.');
            return;
        }
        if (bracketBusy) return;
        setBracketBusy(true);
        try {
            const roundIndex = Math.max(0, Number(bracket.activeRoundIndex || 0));
            const rounds = Array.isArray(bracket.rounds) ? [...bracket.rounds] : [];
            const round = rounds[roundIndex];
            if (!round) {
                toast('No active bracket round.');
                return;
            }
            const matchIndex = round.matches.findIndex((match) => !match?.queuedAt && !match?.winnerUid);
            if (matchIndex < 0) {
                toast('All matches in this round are already queued.');
                return;
            }
            const matches = [...round.matches];
            const target = { ...matches[matchIndex], queuedAt: nowMs() };
            const aContestant = target.aUid ? bracket?.contestantsByUid?.[target.aUid] : null;
            const bContestant = target.bUid ? bracket?.contestantsByUid?.[target.bUid] : null;
            const presentUids = new Set(users.map((entry) => resolveRoomUserUid(entry)).filter(Boolean));
            const aMissing = !!target?.aUid && !presentUids.has(target.aUid);
            const bMissing = !!target?.bUid && !presentUids.has(target.bUid);
            if (aMissing && bMissing) {
                toast('Both singers are offline. Wait for one to return or reseed.');
                return;
            }
            if (aMissing !== bMissing) {
                const winnerUid = aMissing ? target.bUid : target.aUid;
                const loserUid = aMissing ? target.aUid : target.bUid;
                const winnerName = bracket?.contestantsByUid?.[winnerUid]?.name || 'Singer';
                await setBracketMatchWinner(target.id, winnerUid, {
                    reason: 'forfeit_no_show_auto',
                    source: 'queue_next_auto',
                    loserUid,
                    allowWhileBusy: true
                });
                toast(`${winnerName} advances by no-show.`);
                return;
            }
            if (aContestant && target.aSong) {
                await queueTight15EntryForSinger({
                    roomUser: { uid: aContestant.uid, name: aContestant.name, avatar: aContestant.avatar },
                    entry: target.aSong,
                    sourceLabel: 'sweet16_match'
                });
            }
            if (bContestant && target.bSong) {
                await queueTight15EntryForSinger({
                    roomUser: { uid: bContestant.uid, name: bContestant.name, avatar: bContestant.avatar },
                    entry: target.bSong,
                    sourceLabel: 'sweet16_match'
                });
            }
            matches[matchIndex] = target;
            rounds[roundIndex] = { ...round, matches };
            const nextBracketState = {
                ...bracket,
                status: 'in_progress',
                rounds,
                activeRoundIndex: roundIndex,
                activeMatchId: target.id,
                roundTransition: null
            };
            const nextWithAudit = appendBracketAuditEvent(nextBracketState, {
                type: 'match_queued',
                text: `Queued ${aContestant?.name || 'Singer A'} vs ${bContestant?.name || 'Singer B'} in ${round?.name || 'Round'}.`,
                matchId: target.id,
                roundIndex,
                roundName: round?.name || '',
                slot: Number(target?.slot || 0),
                aUid: target?.aUid || null,
                bUid: target?.bUid || null
            });
            await updateRoom({
                activeMode: 'karaoke_bracket',
                karaokeBracket: nextWithAudit,
                gameData: nextWithAudit
            });
            toast(`Queued ${aContestant?.name || 'Singer'} vs ${bContestant?.name || 'Singer'}.`);
        } catch (error) {
            hostLogger.error('Queue next bracket match failed', error);
            toast('Could not queue next match.');
        } finally {
            setBracketBusy(false);
        }
    };

    const setBracketWinnerFromCrowdVotes = async (matchId) => {
        const bracket = room?.karaokeBracket;
        if (!bracket?.rounds?.length || !matchId) return;
        let targetMatch = null;
        (bracket.rounds || []).some((round) => {
            const found = (round.matches || []).find((match) => match.id === matchId);
            if (found) {
                targetMatch = found;
                return true;
            }
            return false;
        });
        if (!targetMatch) {
            toast('Match not found.');
            return;
        }
        const votes = getBracketMatchCrowdVotes({
            users,
            bracketId: bracket?.id || '',
            match: targetMatch
        });
        if (!votes.total) {
            toast('No crowd votes yet for this match.');
            return;
        }
        if (votes.aVotes === votes.bVotes) {
            toast('Crowd vote is tied. Mark winner manually.');
            return;
        }
        const winnerUid = votes.aVotes > votes.bVotes ? targetMatch.aUid : targetMatch.bUid;
        if (!winnerUid) {
            toast('Crowd vote winner is unavailable.');
            return;
        }
        await setBracketMatchWinner(matchId, winnerUid, {
            reason: 'crowd_vote',
            source: 'crowd',
            votes
        });
    };

    const forfeitBracketContestant = async (matchId, loserUid, source = 'host') => {
        const bracket = room?.karaokeBracket;
        if (!bracket?.rounds?.length || !matchId || !loserUid) return;
        let targetMatch = null;
        (bracket.rounds || []).some((round) => {
            const found = (round.matches || []).find((match) => match.id === matchId);
            if (found) {
                targetMatch = found;
                return true;
            }
            return false;
        });
        if (!targetMatch) {
            toast('Match not found.');
            return;
        }
        const winnerUid = targetMatch?.aUid === loserUid ? targetMatch?.bUid : targetMatch?.aUid;
        if (!winnerUid) {
            toast('Cannot forfeit this match yet.');
            return;
        }
        await setBracketMatchWinner(matchId, winnerUid, {
            reason: source === 'auto' ? 'forfeit_no_show_auto' : 'forfeit_no_show_host',
            source,
            loserUid
        });
    };

    const setBracketMatchWinner = async (matchId, winnerUid, options = {}) => {
        const bracket = room?.karaokeBracket;
        if (!bracket?.rounds?.length || !matchId || !winnerUid) return;
        if (bracketBusy && !options?.allowWhileBusy) return;
        setBracketBusy(true);
        try {
            const resolutionType = String(options?.reason || 'host_manual');
            const resolutionSource = String(options?.source || 'host');
            const rounds = Array.isArray(bracket.rounds) ? [...bracket.rounds] : [];
            let foundRoundIndex = -1;
            let foundMatchIndex = -1;
            rounds.some((round, rIdx) => {
                const idx = (round.matches || []).findIndex((match) => match.id === matchId);
                if (idx >= 0) {
                    foundRoundIndex = rIdx;
                    foundMatchIndex = idx;
                    return true;
                }
                return false;
            });
            if (foundRoundIndex < 0 || foundMatchIndex < 0) {
                toast('Match not found.');
                return;
            }
            const round = rounds[foundRoundIndex];
            const match = round.matches[foundMatchIndex];
            if (![match.aUid, match.bUid].includes(winnerUid)) {
                toast('Winner must be one of the two singers in this match.');
                return;
            }
            const resolvedAt = nowMs();
            const loserUid = options?.loserUid || (winnerUid === match?.aUid ? match?.bUid : match?.aUid);
            const aContestant = bracket?.contestantsByUid?.[match?.aUid] || null;
            const bContestant = bracket?.contestantsByUid?.[match?.bUid] || null;
            const winnerName = bracket?.contestantsByUid?.[winnerUid]?.name || 'Winner';
            const loserName = bracket?.contestantsByUid?.[loserUid]?.name || 'Singer';
            const voteSummary = options?.votes || getBracketMatchCrowdVotes({
                users,
                bracketId: bracket?.id || '',
                match
            });
            const matches = [...round.matches];
            matches[foundMatchIndex] = {
                ...match,
                winnerUid,
                completedAt: resolvedAt,
                resolutionType
            };
            rounds[foundRoundIndex] = { ...round, matches };
            let nextBracket = advanceBracketState({
                ...bracket,
                rounds,
                activeRoundIndex: foundRoundIndex
            });
            nextBracket = upsertBracketMatchHistoryEntry(nextBracket, {
                matchId: match.id,
                roundIndex: foundRoundIndex,
                roundName: round?.name || `Round ${foundRoundIndex + 1}`,
                slot: Number(match?.slot || foundMatchIndex + 1),
                aUid: match?.aUid || null,
                aName: aContestant?.name || 'Singer A',
                aSong: match?.aSong || null,
                bUid: match?.bUid || null,
                bName: bContestant?.name || 'Singer B',
                bSong: match?.bSong || null,
                winnerUid,
                winnerName,
                loserUid: loserUid || null,
                loserName: loserName || '',
                resolutionType,
                resolutionSource,
                votes: {
                    total: Number(voteSummary?.total || 0),
                    aVotes: Number(voteSummary?.aVotes || 0),
                    bVotes: Number(voteSummary?.bVotes || 0)
                },
                queuedAt: Number(match?.queuedAt || 0),
                at: resolvedAt
            });
            const resolutionText = resolutionType === 'crowd_vote'
                ? `${winnerName} won the crowd vote over ${loserName}.`
                : resolutionType === 'forfeit_no_show_auto'
                    ? `${winnerName} advanced by automatic no-show forfeit.`
                    : resolutionType === 'forfeit_no_show_host'
                        ? `${winnerName} advanced by host no-show ruling.`
                        : `${winnerName} advanced over ${loserName}.`;
            nextBracket = appendBracketAuditEvent(nextBracket, {
                type: 'match_resolved',
                text: `${resolutionText} (${round?.name || 'Round'} - Match ${match?.slot || foundMatchIndex + 1})`,
                matchId: match.id,
                roundIndex: foundRoundIndex,
                roundName: round?.name || '',
                winnerUid,
                loserUid: loserUid || null,
                resolutionType,
                source: resolutionSource,
                votes: {
                    total: Number(voteSummary?.total || 0),
                    aVotes: Number(voteSummary?.aVotes || 0),
                    bVotes: Number(voteSummary?.bVotes || 0)
                }
            });
            const bracketSummary = buildBracketSummary(nextBracket);
            await updateRoom({
                activeMode: 'karaoke_bracket',
                karaokeBracket: nextBracket,
                gameData: nextBracket,
                bracketLastSummary: bracketSummary
            });
            await logActivity(roomCode, hostName || 'Host', `advanced ${winnerName} in the bracket.`, EMOJI.sparkle);
            if (nextBracket?.status === 'complete') {
                await logActivity(roomCode, hostName || 'Host', `crowned ${nextBracket?.championName || 'the champion'} in Sweet 16.`, EMOJI.trophy || EMOJI.star);
                toast(`${nextBracket?.championName || 'Champion'} wins the tournament.`);
            } else if (nextBracket?.roundTransition?.id) {
                const fromName = nextBracket?.roundTransition?.fromRoundName || 'Round';
                const toName = nextBracket?.roundTransition?.toRoundName || 'Next round';
                await logActivity(roomCode, hostName || 'Host', `${fromName} complete. ${toName} is ready.`, EMOJI.sparkle);
                toast(`${fromName} complete. Queue ${toName}.`);
            } else {
                if (resolutionType === 'crowd_vote') toast(`${winnerName} advances by crowd vote.`);
                else if (resolutionType.includes('forfeit')) toast(`${winnerName} advances by forfeit.`);
                else toast(`${winnerName} advances.`);
            }
        } catch (error) {
            hostLogger.error('Set bracket winner failed', error);
            toast('Could not record bracket winner.');
        } finally {
            setBracketBusy(false);
        }
    };

    forfeitBracketContestantRef.current = forfeitBracketContestant;

    useEffect(() => {
        if (bracketNoShowTimeoutRef.current) {
            clearTimeout(bracketNoShowTimeoutRef.current);
            bracketNoShowTimeoutRef.current = null;
        }
        if (bracketNoShowTickRef.current) {
            clearInterval(bracketNoShowTickRef.current);
            bracketNoShowTickRef.current = null;
        }
        setBracketNoShow(null);
        const bracket = room?.karaokeBracket;
        if (!bracket?.rounds?.length || !bracket?.activeMatchId || bracket?.status === 'complete') return undefined;
        const rounds = Array.isArray(bracket.rounds) ? bracket.rounds : [];
        const activeRoundIndex = Math.max(0, Number(bracket?.activeRoundIndex || 0));
        const activeRound = rounds[activeRoundIndex] || null;
        const fallbackMatch = rounds
            .flatMap((round) => Array.isArray(round?.matches) ? round.matches : [])
            .find((match) => match?.id === bracket.activeMatchId) || null;
        const activeMatch = (activeRound?.matches || []).find((match) => match?.id === bracket.activeMatchId) || fallbackMatch;
        if (!activeMatch || activeMatch?.winnerUid) return undefined;
        const aUid = activeMatch?.aUid || '';
        const bUid = activeMatch?.bUid || '';
        if (!aUid || !bUid) return undefined;
        const presentUids = new Set(users.map((entry) => resolveRoomUserUid(entry)).filter(Boolean));
        const missing = [aUid, bUid].filter((uid) => !presentUids.has(uid));
        if (missing.length !== 1) return undefined;
        const missingUid = missing[0];
        const winnerUid = missingUid === aUid ? bUid : aUid;
        if (!winnerUid) return undefined;
        const missingName = bracket?.contestantsByUid?.[missingUid]?.name || 'Singer';
        const winnerName = bracket?.contestantsByUid?.[winnerUid]?.name || 'Singer';
        const deadlineMs = nowMs() + 30000;
        setBracketNoShow({
            matchId: activeMatch.id,
            missingUid,
            missingName,
            winnerUid,
            winnerName,
            deadlineMs
        });
        setBracketNoShowNow(nowMs());
        bracketNoShowTickRef.current = setInterval(() => {
            setBracketNoShowNow(nowMs());
        }, 1000);
        bracketNoShowTimeoutRef.current = setTimeout(() => {
            const pending = forfeitBracketContestantRef.current?.(activeMatch.id, missingUid, 'auto');
            if (pending?.catch) pending.catch(() => {});
        }, 30000);
        return () => {
            if (bracketNoShowTimeoutRef.current) {
                clearTimeout(bracketNoShowTimeoutRef.current);
                bracketNoShowTimeoutRef.current = null;
            }
            if (bracketNoShowTickRef.current) {
                clearInterval(bracketNoShowTickRef.current);
                bracketNoShowTickRef.current = null;
            }
        };
    }, [room?.karaokeBracket, users]);

    const clearSweet16Bracket = async () => {
        if (bracketBusy) return;
        setBracketBusy(true);
        try {
            const payload = {
                karaokeBracket: null,
                gameData: null
            };
            if (room?.activeMode === 'karaoke_bracket') {
                payload.activeMode = 'karaoke';
            }
            await updateRoom(payload);
            toast('Bracket cleared.');
        } catch (error) {
            hostLogger.error('Clear bracket failed', error);
            toast('Could not clear bracket.');
        } finally {
            setBracketBusy(false);
        }
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
    const browseCategories = BROWSE_CATEGORIES.map((list, idx) => buildBrowseList(list, idx));
    const topicHits = TOPIC_HITS.map((list, idx) => buildBrowseList(list, idx + BROWSE_CATEGORIES.length));
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
            priorityScore: nowMs(),
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
                    <div className="flex flex-col h-full min-h-0 gap-6 pr-2 custom-scrollbar touch-scroll-y">
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
                                    <button onClick={() => { setYtIndexFilter(''); setShowYtIndex(true); }} className={`${STYLES.btnStd} ${STYLES.btnSecondary} text-sm px-3 py-1`}>Open List</button>
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
                            <div className="fixed inset-0 z-[85] bg-[#0b0b10] text-white flex flex-col min-h-0">
                                    <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-zinc-800">
                                        <button onClick={() => setActiveBrowseList(null)} className="text-zinc-400 text-sm">&larr; Back</button>
                                        <div className="text-lg font-bold">{activeBrowseList.title}</div>
                                        <div className="text-sm text-zinc-500">{activeBrowseList.subtitle || 'Browse list'}</div>
                                    </div>
                                <div className="px-6 py-4">
                                </div>
                                <div className="flex-1 min-h-0 px-6 pb-6 custom-scrollbar touch-scroll-y">
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
                            <div className="fixed inset-0 z-[85] bg-[#0b0b10] text-white flex flex-col min-h-0">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                                    <button onClick={() => setShowTop100(false)} className="text-zinc-400 text-sm">&larr; Back</button>
                                    <div className="text-lg font-bold">Top 100 Karaoke</div>
                                    <div className="text-sm text-zinc-500">Full list</div>
                                </div>
                                <div className="flex-1 min-h-0 px-6 pb-6 custom-scrollbar touch-scroll-y">
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

    const renderNightSetupWizard = () => {
        const selectedPreset = HOST_NIGHT_PRESETS[nightSetupPresetId] || HOST_NIGHT_PRESETS.casual;
        const selectedMode = NIGHT_SETUP_PRIMARY_MODES.find((mode) => mode.id === nightSetupPrimaryMode) || NIGHT_SETUP_PRIMARY_MODES[0];
        const limitOption = NIGHT_SETUP_QUEUE_LIMIT_OPTIONS.find((option) => option.id === nightSetupQueueLimitMode) || NIGHT_SETUP_QUEUE_LIMIT_OPTIONS[0];
        const rotationOption = NIGHT_SETUP_QUEUE_ROTATION_OPTIONS.find((option) => option.id === nightSetupQueueRotation) || NIGHT_SETUP_QUEUE_ROTATION_OPTIONS[0];
        const activeStep = NIGHT_SETUP_STEPS[nightSetupStep] || NIGHT_SETUP_STEPS[0];
        const sectionLabels = Array.isArray(activeStep?.sections) ? activeStep.sections : [];
        const presetFeaturePills = [
            { label: 'Auto DJ', enabled: !!selectedPreset?.settings?.autoDj },
            { label: 'Background Music', enabled: !!selectedPreset?.settings?.autoBgMusic },
            { label: 'Singer Track Select', enabled: !!selectedPreset?.settings?.allowSingerTrackSelect },
            { label: 'Bouncer Mode', enabled: !!selectedPreset?.settings?.bouncerMode },
            { label: 'Auto Lyrics', enabled: !!selectedPreset?.settings?.autoLyricsOnQueue },
            { label: 'Pop Trivia', enabled: selectedPreset?.settings?.popTriviaEnabled !== false }
        ];
        const enabledPresetFeatureCount = presetFeaturePills.filter((item) => item.enabled).length;
        const recommendation = (() => {
            const recommendedId = nightSetupRecommendation?.presetId;
            if (recommendedId && HOST_NIGHT_PRESETS[recommendedId]) return nightSetupRecommendation;
            return resolveNightSetupRecommendation();
        })();
        const readinessChecks = [
            { label: 'Host identity', ok: !!String(hostName || '').trim() },
            { label: 'Room code assigned', ok: !!String(roomCode || '').trim() },
            { label: 'Night type selected', ok: !!String(selectedPreset?.id || '').trim() },
            { label: 'Spotlight mode selected', ok: !!String(selectedMode?.id || '').trim() },
            { label: 'Queue policy set', ok: !!String(nightSetupQueueLimitMode || '').trim() && !!String(nightSetupQueueRotation || '').trim() },
            { label: 'Branding logo', ok: !!String(logoUrl || '').trim() },
            {
                label: 'At least one live toggle',
                ok: !!nightSetupAutoPlayMedia || !!nightSetupShowScoring || !!nightSetupQueueFirstTimeBoost || !!nightSetupChatOnTv || !!nightSetupMarqueeEnabled
            }
        ];
        const readinessComplete = readinessChecks.filter((item) => item.ok).length;
        const readinessScore = Math.round((readinessComplete / readinessChecks.length) * 100);
        const readinessMissing = readinessChecks.filter((item) => !item.ok).map((item) => item.label).slice(0, 2);
        const getQueueLimitLabel = (modeId = 'none') =>
            NIGHT_SETUP_QUEUE_LIMIT_OPTIONS.find((option) => option.id === modeId)?.label || 'No Limits';
        const getQueueRotationLabel = (rotationId = 'round_robin') =>
            NIGHT_SETUP_QUEUE_ROTATION_OPTIONS.find((option) => option.id === rotationId)?.label || 'Round Robin';
        const formatBoolean = (value) => (value ? 'On' : 'Off');
        const formatQueueSummary = (modeId = 'none', limitCount = 0, rotationId = 'round_robin', firstTimeBoost = false) => {
            const limitLabel = getQueueLimitLabel(modeId);
            const rotationLabel = getQueueRotationLabel(rotationId);
            const countPart = modeId !== 'none' ? ` (${Math.max(0, Number(limitCount || 0))})` : '';
            const boostPart = firstTimeBoost ? ' + First-Time Boost' : '';
            return `${limitLabel}${countPart} | ${rotationLabel}${boostPart}`;
        };
        const currentSetupSnapshot = {
            showScoring: !!nightSetupShowScoring,
            autoPlayMedia: !!nightSetupAutoPlayMedia,
            chatShowOnTv: !!nightSetupChatOnTv,
            marqueeEnabled: !!nightSetupMarqueeEnabled,
            queueLimitMode: String(nightSetupQueueLimitMode || 'none'),
            queueLimitCount: Math.max(0, Number(nightSetupQueueLimitCount || 0)),
            queueRotation: String(nightSetupQueueRotation || 'round_robin'),
            queueFirstTimeBoost: !!nightSetupQueueFirstTimeBoost
        };
        const getPresetSnapshot = (presetInput = selectedPreset) => {
            const presetSettings = presetInput?.settings || {};
            const queue = presetSettings?.queueSettings || {};
            const limitMode = String(queue?.limitMode || 'none');
            const limitCount = Math.max(0, Number(queue?.limitCount || 0));
            const queueRotation = String(queue?.rotation || 'round_robin');
            const firstTimeBoost = queue?.firstTimeBoost !== false;
            return {
                showScoring: presetSettings.showScoring !== false,
                autoPlayMedia: presetSettings.autoPlayMedia !== false,
                chatShowOnTv: !!presetSettings.chatShowOnTv,
                marqueeEnabled: !!presetSettings.marqueeEnabled,
                queueLimitMode: limitMode,
                queueLimitCount: limitCount,
                queueRotation,
                queueFirstTimeBoost: firstTimeBoost,
                queueSummary: formatQueueSummary(limitMode, limitCount, queueRotation, firstTimeBoost)
            };
        };
        const getPresetChangeSummary = (presetInput = selectedPreset) => {
            const presetSnapshot = getPresetSnapshot(presetInput);
            const chips = [];
            const pushChip = (label, value) => chips.push({ label, value });
            if (presetSnapshot.queueSummary !== formatQueueSummary(
                currentSetupSnapshot.queueLimitMode,
                currentSetupSnapshot.queueLimitCount,
                currentSetupSnapshot.queueRotation,
                currentSetupSnapshot.queueFirstTimeBoost
            )) {
                pushChip('Queue', presetSnapshot.queueSummary);
            }
            if (presetSnapshot.showScoring !== currentSetupSnapshot.showScoring) {
                pushChip('Scoring', formatBoolean(presetSnapshot.showScoring));
            }
            if (presetSnapshot.autoPlayMedia !== currentSetupSnapshot.autoPlayMedia) {
                pushChip('Auto-Play', formatBoolean(presetSnapshot.autoPlayMedia));
            }
            if (presetSnapshot.chatShowOnTv !== currentSetupSnapshot.chatShowOnTv) {
                pushChip('TV Chat', formatBoolean(presetSnapshot.chatShowOnTv));
            }
            if (presetSnapshot.marqueeEnabled !== currentSetupSnapshot.marqueeEnabled) {
                pushChip('Marquee', formatBoolean(presetSnapshot.marqueeEnabled));
            }
            return {
                count: chips.length,
                chips: chips.slice(0, 3),
                hiddenCount: Math.max(0, chips.length - 3),
                queueSummary: presetSnapshot.queueSummary
            };
        };
        const selectedPresetSnapshot = getPresetSnapshot(selectedPreset);
        const selectedPresetChangeSummary = getPresetChangeSummary(selectedPreset);

        if (missionControlEnabled) {
            const missionPreset = HOST_NIGHT_PRESETS[missionDraft?.archetype] || HOST_NIGHT_PRESETS.casual;
            const missionMode = NIGHT_SETUP_PRIMARY_MODES.find((mode) => mode.id === missionDraft?.spotlightMode) || NIGHT_SETUP_PRIMARY_MODES[0];
            const flowRule = MISSION_FLOW_RULE_OPTIONS.find((rule) => rule.id === missionDraft?.flowRule) || MISSION_FLOW_RULE_OPTIONS[0];
            const statusClass = missionStatusLabel === 'Ready'
                ? 'text-emerald-200 border-emerald-400/35 bg-emerald-500/15'
                : missionStatusLabel === 'Live'
                    ? 'text-cyan-100 border-cyan-400/35 bg-cyan-500/15'
                    : 'text-amber-100 border-amber-400/35 bg-amber-500/15';
            const missionPickCount = [missionDraft?.archetype, missionDraft?.flowRule, missionDraft?.spotlightMode].filter(Boolean).length;
            const missionOverrideCount = Object.keys(missionAdvancedOverrides || {}).length;
            const featuredSpotlightModeIds = ['karaoke', 'bingo', 'trivia_pop', 'karaoke_bracket'];
            const missionVisibleSpotlightModes = missionShowAllSpotlightModes
                ? NIGHT_SETUP_PRIMARY_MODES
                : NIGHT_SETUP_PRIMARY_MODES.filter((mode) => featuredSpotlightModeIds.includes(mode.id) || mode.id === missionDraft?.spotlightMode);
            const canToggleSpotlightList = NIGHT_SETUP_PRIMARY_MODES.length > missionVisibleSpotlightModes.length || missionShowAllSpotlightModes;
            const readMissionPath = (input, path) => path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), input);
            const formatMissionDiffValue = (key, value) => {
                if (typeof value === 'boolean') return value ? 'On' : 'Off';
                if (key === 'queueSettings.limitMode') {
                    const found = NIGHT_SETUP_QUEUE_LIMIT_OPTIONS.find((option) => option.id === value);
                    return found?.label || String(value || 'None');
                }
                if (key === 'queueSettings.rotation') {
                    const found = NIGHT_SETUP_QUEUE_ROTATION_OPTIONS.find((option) => option.id === value);
                    return found?.label || String(value || 'Round Robin');
                }
                if (key === 'gamePreviewId') {
                    const resolved = value || 'karaoke';
                    const found = NIGHT_SETUP_PRIMARY_MODES.find((mode) => mode.id === resolved);
                    return found?.label || 'Karaoke Flow';
                }
                if (value == null || value === '') return 'Off';
                return String(value);
            };
            const compileMissionPayload = (draftInput) => mergePayloadWithOverrides(
                compileMissionDraftToRoomPayload(draftInput, capabilities, {
                    presets: HOST_NIGHT_PRESETS,
                    flowRules: MISSION_FLOW_RULES
                }),
                missionAdvancedOverrides
            );
            const currentMissionPayload = compileMissionPayload(missionDraft || {});
            const getArchetypeDeltaSummary = (archetypeId) => {
                const candidatePayload = compileMissionPayload({
                    ...(missionDraft || {}),
                    archetype: archetypeId
                });
                const changed = MISSION_CHANGE_FIELD_SPECS
                    .map((spec) => {
                        const baseValue = readMissionPath(currentMissionPayload, spec.key);
                        const candidateValue = readMissionPath(candidatePayload, spec.key);
                        const sameValue = JSON.stringify(baseValue) === JSON.stringify(candidateValue);
                        if (sameValue) return null;
                        return {
                            key: spec.key,
                            label: spec.label,
                            value: formatMissionDiffValue(spec.key, candidateValue)
                        };
                    })
                    .filter(Boolean);
                return {
                    count: changed.length,
                    chips: changed.slice(0, 3),
                    hiddenCount: Math.max(0, changed.length - 3)
                };
            };

            return (
                <div
                    className="fixed inset-0 z-[92] p-3 md:p-6 overflow-y-auto"
                    style={{
                        background:
                            'radial-gradient(circle at 12% 6%, rgba(0,196,217,0.26), transparent 32%), radial-gradient(circle at 90% 10%, rgba(236,72,153,0.22), transparent 34%), linear-gradient(180deg, #06070d 0%, #090b14 45%, #05060c 100%)',
                    }}
                >
                    <div className="mx-auto w-full max-w-6xl pb-28">
                        <div className="w-full bg-zinc-950/94 border border-white/15 rounded-3xl shadow-[0_28px_80px_rgba(0,0,0,0.55)] overflow-hidden">
                            <div className="px-4 py-4 md:px-6 md:py-5 border-b border-white/10">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Mission Control</div>
                                        <div className="text-2xl md:text-3xl font-black text-white mt-1">Compose Tonight&apos;s Mission</div>
                                        <div className="text-sm text-zinc-400 mt-1">Three picks to configure the room. Advanced controls are optional.</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] uppercase tracking-[0.24em] px-2 py-1 rounded-full border ${statusClass}`}>
                                            {missionStatusLabel}
                                        </span>
                                        <button
                                            onClick={closeNightSetupWizard}
                                            disabled={nightSetupApplying}
                                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} ${nightSetupApplying ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            Skip Intro
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                                <div className="px-4 py-4 md:px-6 md:py-5 max-h-[68vh] overflow-y-auto custom-scrollbar space-y-4">
                                    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/8 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Quick Mission Path</div>
                                                <div className="text-sm text-zinc-200 mt-1">Lock three picks, then launch. Advanced controls stay available.</div>
                                            </div>
                                            <span className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${missionPickCount === 3 ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100' : 'border-zinc-600 bg-zinc-900/60 text-zinc-300'}`}>
                                                {missionPickCount}/3 Picks Ready
                                            </span>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Pick 1</div>
                                        <div className="text-xl font-bold text-white mt-1">Night Archetype</div>
                                        <div className="text-sm text-zinc-400 mt-1">Defines the baseline experience and automation defaults. Each card shows the exact settings delta.</div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                            {Object.values(HOST_NIGHT_PRESETS).map((preset) => {
                                                const active = missionDraft?.archetype === preset.id;
                                                const meta = NIGHT_SETUP_PRESET_META[preset.id] || NIGHT_SETUP_PRESET_META.casual;
                                                const delta = getArchetypeDeltaSummary(preset.id);
                                                return (
                                                    <button
                                                        key={`mission-archetype-${preset.id}`}
                                                        onClick={() => updateMissionDraftPick({ archetype: preset.id }, 'archetype')}
                                                        className={`relative overflow-hidden text-left rounded-2xl border transition-all ${active ? 'border-[#00C4D9]/70 shadow-[0_0_0_1px_rgba(0,196,217,0.55)]' : 'border-zinc-700 hover:border-zinc-500'}`}
                                                    >
                                                        <div className={`absolute inset-0 bg-gradient-to-br ${meta.accent}`}></div>
                                                        <div className="relative px-4 py-4">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="text-lg text-cyan-100"><i className={`fa-solid ${meta.icon}`}></i></div>
                                                                {active && <span className="text-[10px] uppercase tracking-[0.25em] px-2 py-1 rounded-full border border-cyan-300/40 bg-cyan-500/20 text-cyan-100">Selected</span>}
                                                            </div>
                                                            <div className="text-lg font-bold text-white mt-2">{preset.label}</div>
                                                            <div className="text-sm text-zinc-300 mt-1">{preset.description}</div>
                                                            <div className="mt-3">
                                                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                                                                    {delta.count > 0 ? `${delta.count} setting change${delta.count === 1 ? '' : 's'}` : (active ? 'Current selection' : 'No net change')}
                                                                </div>
                                                                {delta.count > 0 ? (
                                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                                        {delta.chips.map((chip) => (
                                                                            <span
                                                                                key={`mission-delta-${preset.id}-${chip.key}`}
                                                                                className="text-[10px] px-2 py-1 rounded-full border border-cyan-300/30 bg-black/35 text-zinc-100"
                                                                            >
                                                                                {chip.label}: {chip.value}
                                                                            </span>
                                                                        ))}
                                                                        {delta.hiddenCount > 0 && (
                                                                            <span className="text-[10px] px-2 py-1 rounded-full border border-zinc-600 bg-black/30 text-zinc-400">
                                                                                +{delta.hiddenCount} more
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-xs text-zinc-500 mt-1">
                                                                        {active
                                                                            ? 'This archetype is currently active.'
                                                                            : 'Flow, spotlight, and overrides currently neutralize differences.'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Pick 2</div>
                                        <div className="text-xl font-bold text-white mt-1">Flow Rule</div>
                                        <div className="text-sm text-zinc-400 mt-1">High-level queue policy. Advanced details remain editable below.</div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                            {MISSION_FLOW_RULE_OPTIONS.map((rule) => {
                                                const active = missionDraft?.flowRule === rule.id;
                                                return (
                                                    <button
                                                        key={`mission-flow-${rule.id}`}
                                                        onClick={() => updateMissionDraftPick({ flowRule: rule.id }, 'flow_rule')}
                                                        className={`text-left rounded-2xl border px-3 py-3 transition-all ${active ? 'border-cyan-400/60 bg-cyan-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                                                    >
                                                        <div className="font-bold text-white">{rule.label}</div>
                                                        <div className="text-xs text-zinc-400 mt-2">{rule.description}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Pick 3</div>
                                                <div className="text-xl font-bold text-white mt-1">Spotlight Focus</div>
                                                <div className="text-sm text-zinc-400 mt-1">Choose what your room leads with once live.</div>
                                            </div>
                                            {canToggleSpotlightList && (
                                                <button
                                                    onClick={() => setMissionShowAllSpotlightModes((prev) => !prev)}
                                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} text-[10px]`}
                                                >
                                                    {missionShowAllSpotlightModes ? 'Show Featured' : 'Show All Modes'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
                                            {missionVisibleSpotlightModes.map((mode) => (
                                                <button
                                                    key={`mission-mode-${mode.id}`}
                                                    onClick={() => updateMissionDraftPick({ spotlightMode: mode.id }, 'spotlight_mode')}
                                                    className={`relative overflow-hidden text-left rounded-2xl border px-3 py-3 transition-all ${missionDraft?.spotlightMode === mode.id ? 'border-fuchsia-400/60' : 'border-zinc-700 hover:border-zinc-500'}`}
                                                >
                                                    <div className={`absolute inset-0 bg-gradient-to-br ${mode.accent}`}></div>
                                                    <div className="relative flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <i className={`fa-solid ${mode.icon} text-fuchsia-200`}></i>
                                                            <div className="text-sm font-bold text-white">{mode.label}</div>
                                                        </div>
                                                        {missionDraft?.spotlightMode === mode.id && <span className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-100">Primary</span>}
                                                    </div>
                                                    <div className="relative text-xs text-zinc-300 mt-2">{mode.description}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Advanced</div>
                                                <div className="text-base font-bold text-white mt-1">Optional Fine Tuning</div>
                                            </div>
                                            <button
                                                onClick={resetMissionAdvancedOverrides}
                                                className={`${STYLES.btnStd} ${STYLES.btnNeutral} text-[10px]`}
                                            >
                                                Reset Advanced
                                            </button>
                                        </div>
                                        <div className="mt-3 space-y-3">
                                            <div className="rounded-xl border border-zinc-700 bg-zinc-950/60">
                                                <button
                                                    onClick={() => setMissionAdvancedQueueOpen((prev) => !prev)}
                                                    className="w-full px-3 py-2 flex items-center justify-between text-left"
                                                >
                                                    <span className="text-sm font-bold text-white">Queue Overrides</span>
                                                    <i className={`fa-solid fa-chevron-${missionAdvancedQueueOpen ? 'up' : 'down'} text-zinc-500`}></i>
                                                </button>
                                                {missionAdvancedQueueOpen && (
                                                    <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Limit Mode</div>
                                                            <select
                                                                value={nightSetupQueueLimitMode}
                                                                onChange={(event) => {
                                                                    const nextValue = event.target.value;
                                                                    setNightSetupQueueLimitMode(nextValue);
                                                                    setMissionOverrideValue('queueSettings.limitMode', nextValue);
                                                                    if (nextValue === 'none') {
                                                                        setNightSetupQueueLimitCount(0);
                                                                        setMissionOverrideValue('queueSettings.limitCount', 0);
                                                                    }
                                                                }}
                                                                className={`${STYLES.input}`}
                                                            >
                                                                {NIGHT_SETUP_QUEUE_LIMIT_OPTIONS.map((option) => (
                                                                    <option key={`mission-queue-limit-${option.id}`} value={option.id}>{option.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Limit Count</div>
                                                            <input
                                                                value={nightSetupQueueLimitCount}
                                                                onChange={(event) => {
                                                                    const nextValue = Math.max(0, Number(event.target.value || 0));
                                                                    setNightSetupQueueLimitCount(nextValue);
                                                                    setMissionOverrideValue('queueSettings.limitCount', nextValue);
                                                                }}
                                                                className={STYLES.input}
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">Rotation</div>
                                                            <select
                                                                value={nightSetupQueueRotation}
                                                                onChange={(event) => {
                                                                    const nextValue = event.target.value;
                                                                    setNightSetupQueueRotation(nextValue);
                                                                    setMissionOverrideValue('queueSettings.rotation', nextValue);
                                                                }}
                                                                className={`${STYLES.input}`}
                                                            >
                                                                {NIGHT_SETUP_QUEUE_ROTATION_OPTIONS.map((option) => (
                                                                    <option key={`mission-queue-rotation-${option.id}`} value={option.id}>{option.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1">First-Time Boost</div>
                                                            <button
                                                                onClick={() => {
                                                                    const nextValue = !nightSetupQueueFirstTimeBoost;
                                                                    setNightSetupQueueFirstTimeBoost(nextValue);
                                                                    setMissionOverrideValue('queueSettings.firstTimeBoost', nextValue);
                                                                }}
                                                                className={`${STYLES.btnStd} ${nightSetupQueueFirstTimeBoost ? STYLES.btnInfo : STYLES.btnNeutral} w-full`}
                                                            >
                                                                {nightSetupQueueFirstTimeBoost ? 'Enabled' : 'Disabled'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="rounded-xl border border-zinc-700 bg-zinc-950/60">
                                                <button
                                                    onClick={() => setMissionAdvancedTogglesOpen((prev) => !prev)}
                                                    className="w-full px-3 py-2 flex items-center justify-between text-left"
                                                >
                                                    <span className="text-sm font-bold text-white">Live Toggle Overrides</span>
                                                    <i className={`fa-solid fa-chevron-${missionAdvancedTogglesOpen ? 'up' : 'down'} text-zinc-500`}></i>
                                                </button>
                                                {missionAdvancedTogglesOpen && (
                                                    <div className="px-3 pb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {[
                                                            { key: 'autoPlayMedia', label: 'Auto Stage Playback', value: nightSetupAutoPlayMedia, setter: setNightSetupAutoPlayMedia },
                                                            { key: 'showScoring', label: 'Live Scoring', value: nightSetupShowScoring, setter: setNightSetupShowScoring },
                                                            { key: 'chatShowOnTv', label: 'Audience Chat on TV', value: nightSetupChatOnTv, setter: setNightSetupChatOnTv },
                                                            { key: 'marqueeEnabled', label: 'Marquee Messages', value: nightSetupMarqueeEnabled, setter: setNightSetupMarqueeEnabled }
                                                        ].map((toggle) => (
                                                            <button
                                                                key={`mission-toggle-${toggle.key}`}
                                                                onClick={() => {
                                                                    const nextValue = !toggle.value;
                                                                    toggle.setter(nextValue);
                                                                    setMissionOverrideValue(toggle.key, nextValue);
                                                                }}
                                                                className={`${STYLES.btnStd} ${toggle.value ? STYLES.btnInfo : STYLES.btnNeutral} justify-start`}
                                                            >
                                                                {toggle.label}: {toggle.value ? 'ON' : 'OFF'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <aside className="border-t lg:border-t-0 lg:border-l border-white/10 bg-zinc-950/75 px-4 py-4 md:px-5 md:py-5">
                                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Tonight&apos;s Plan</div>
                                    <div className="mt-2 rounded-2xl border border-cyan-500/30 bg-zinc-900/80 p-3">
                                        <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">Canonical Summary</div>
                                        <div className="text-sm text-zinc-200 mt-2"><span className="text-zinc-500">Archetype:</span> {missionPreset.label}</div>
                                        <div className="text-sm text-zinc-200 mt-1"><span className="text-zinc-500">Flow:</span> {flowRule.label}</div>
                                        <div className="text-sm text-zinc-200 mt-1"><span className="text-zinc-500">Spotlight:</span> {missionMode.label}</div>
                                        <div className="text-sm text-zinc-200 mt-1"><span className="text-zinc-500">Assist:</span> Smart Assist</div>
                                        <div className="text-xs text-zinc-400 mt-2">Setup progress: {missionPickCount}/3 picks locked</div>
                                        {missionOverrideCount > 0 && (
                                            <div className="text-xs text-amber-200 mt-1">
                                                {missionOverrideCount} advanced override{missionOverrideCount === 1 ? '' : 's'} active (can flatten archetype differences)
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                                        <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Readiness</div>
                                        <div className="text-white font-bold mt-1">{readinessScore}%</div>
                                        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mt-2">
                                            <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all" style={{ width: `${readinessScore}%` }}></div>
                                        </div>
                                        {readinessMissing.length > 0 && (
                                            <div className="text-[11px] text-zinc-400 mt-2">Missing: {readinessMissing.join(', ')}</div>
                                        )}
                                    </div>
                                </aside>
                            </div>

                            <div className="fixed bottom-0 left-0 right-0 z-[95] border-t border-white/10 bg-zinc-950/95 backdrop-blur-md">
                                <div className="mx-auto w-full max-w-6xl px-4 py-3 md:px-6 flex flex-wrap items-center justify-between gap-2">
                                    <button
                                        onClick={() => {
                                            setShowNightSetupWizard(false);
                                            setShowSettings(true);
                                            setSettingsTab('general');
                                        }}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary}`}
                                    >
                                        Open Full Admin
                                    </button>
                                    <div className="text-xs text-zinc-400">
                                        Mission: <span className="text-zinc-100 font-semibold">{missionPreset.label}</span> | <span className="text-zinc-100 font-semibold">{missionFlowRuleLabel}</span> | <span className="text-zinc-100 font-semibold">{missionMode.label}</span> | <span className="text-emerald-200 font-semibold">{missionPickCount}/3 ready</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => applyNightSetupWizard({ intent: 'save' })}
                                            disabled={nightSetupApplying}
                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} ${nightSetupApplying ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            {nightSetupApplying ? 'Saving...' : 'Save + Close'}
                                        </button>
                                        <button
                                            onClick={() => applyNightSetupWizard({ intent: 'start_match' })}
                                            disabled={nightSetupApplying}
                                            className={`${STYLES.btnStd} ${STYLES.btnHighlight} ${nightSetupApplying ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            {nightSetupApplying ? 'Starting...' : 'Save + Start Match'}
                                        </button>
                                        <button
                                            onClick={launchNightSetupPackage}
                                            disabled={nightSetupApplying}
                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} ${nightSetupApplying ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            {nightSetupApplying ? 'Launching...' : 'Launch Package'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div
                className="fixed inset-0 z-[92] p-3 md:p-6 overflow-y-auto"
                style={{
                    background:
                        'radial-gradient(circle at 12% 6%, rgba(0,196,217,0.26), transparent 32%), radial-gradient(circle at 90% 10%, rgba(236,72,153,0.22), transparent 34%), linear-gradient(180deg, #06070d 0%, #090b14 45%, #05060c 100%)',
                }}
            >
                <div className="mx-auto w-full max-w-6xl">
                    <div className="w-full bg-zinc-950/94 border border-white/15 rounded-3xl shadow-[0_28px_80px_rgba(0,0,0,0.55)] overflow-hidden">
                        <div className="px-4 py-4 md:px-6 md:py-5 border-b border-white/10">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Pre-Show Setup</div>
                                    <div className="text-2xl md:text-3xl font-black text-white mt-1">Set The Night Physics</div>
                                    <div className="text-sm text-zinc-400 mt-1">Pick the vibe, pacing, and spotlight so the room can run smoothly with less host micromanagement.</div>
                                </div>
                                <button
                                    onClick={closeNightSetupWizard}
                                    disabled={nightSetupApplying}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} ${nightSetupApplying ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    Skip Intro
                                </button>
                            </div>
                        </div>

                        <div className="px-4 py-3 md:px-6 border-b border-white/10">
                            <div className="flex flex-wrap items-center gap-2">
                                {NIGHT_SETUP_STEPS.map((step, idx) => (
                                    <button
                                        key={`night-setup-step-${step.id}`}
                                        onClick={() => setNightSetupStep(step.id)}
                                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-all ${
                                            nightSetupStep === step.id
                                                ? 'border-cyan-400/60 bg-cyan-500/12 text-cyan-100'
                                                : nightSetupStep > step.id
                                                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                                                    : 'border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:border-zinc-500'
                                        }`}
                                    >
                                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                            nightSetupStep === step.id
                                                ? 'bg-cyan-400/20 text-cyan-100'
                                                : nightSetupStep > step.id
                                                    ? 'bg-emerald-500/20 text-emerald-100'
                                                    : 'bg-zinc-800 text-zinc-400'
                                        }`}>
                                            {idx + 1}
                                        </span>
                                        <span className="font-bold uppercase tracking-[0.2em]">{step.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="text-xs text-zinc-500 mt-2">
                                {activeStep.subtitle}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                            <div className="px-4 py-4 md:px-6 md:py-5 max-h-[64vh] overflow-y-auto custom-scrollbar space-y-4">
                                <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-200">Orchestrator Hint</div>
                                            <div className="text-sm text-zinc-100 mt-1">
                                                Step {activeStep.id + 1}: <span className="font-bold">{activeStep.label}</span>
                                            </div>
                                            <div className="text-xs text-zinc-300 mt-1">{recommendation.reason || activeStep.subtitle}</div>
                                        </div>
                                        {recommendation.presetId && recommendation.presetId !== nightSetupPresetId && (
                                            <button
                                                onClick={() => seedNightSetupFromPreset(recommendation.presetId, { keepQueueDraft: false })}
                                                className={`${STYLES.btnStd} ${STYLES.btnInfo}`}
                                            >
                                                Use {HOST_NIGHT_PRESETS[recommendation.presetId]?.label || 'Recommended'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {sectionLabels.map((label) => (
                                            <span key={`night-setup-section-${label}`} className="text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-cyan-300/30 text-cyan-100 bg-black/25">
                                                {label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {nightSetupStep === 0 && (
                                    <div className="space-y-3">
                                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Section 1: Night Type</div>
                                            <div className="text-xl font-bold text-white mt-1">Choose your night type</div>
                                            <div className="text-sm text-zinc-400 mt-1">This sets your default controls, mode focus, and automation stack.</div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {Object.values(HOST_NIGHT_PRESETS).map((preset) => {
                                                const active = nightSetupPresetId === preset.id;
                                                const meta = NIGHT_SETUP_PRESET_META[preset.id] || NIGHT_SETUP_PRESET_META.casual;
                                                const changeSummary = getPresetChangeSummary(preset);
                                                return (
                                                    <button
                                                        key={`night-setup-preset-${preset.id}`}
                                                        onClick={() => seedNightSetupFromPreset(preset.id, { keepQueueDraft: false })}
                                                        className={`relative overflow-hidden text-left rounded-2xl border transition-all ${active ? 'border-[#00C4D9]/65 shadow-[0_0_0_1px_rgba(0,196,217,0.45)]' : 'border-zinc-700 hover:border-zinc-500'}`}
                                                    >
                                                        <div className={`absolute inset-0 bg-gradient-to-br ${meta.accent}`}></div>
                                                        <div className="relative px-4 py-4">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="text-lg text-cyan-100"><i className={`fa-solid ${meta.icon}`}></i></div>
                                                                {active && <span className="text-[10px] uppercase tracking-[0.25em] px-2 py-1 rounded-full border border-cyan-300/40 bg-cyan-500/20 text-cyan-100">Locked In</span>}
                                                            </div>
                                                            <div className="text-lg font-bold text-white mt-2">{preset.label}</div>
                                                            <div className="text-sm text-zinc-300 mt-1">{preset.description}</div>
                                                            <div className="mt-3">
                                                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
                                                                    {changeSummary.count > 0 ? `${changeSummary.count} live setting change${changeSummary.count === 1 ? '' : 's'}` : 'No immediate change'}
                                                                </div>
                                                                {changeSummary.count > 0 ? (
                                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                                        {changeSummary.chips.map((chip) => (
                                                                            <span
                                                                                key={`legacy-preset-change-${preset.id}-${chip.label}`}
                                                                                className="text-[10px] px-2 py-1 rounded-full border border-cyan-300/30 bg-black/35 text-zinc-100"
                                                                            >
                                                                                {chip.label}: {chip.value}
                                                                            </span>
                                                                        ))}
                                                                        {changeSummary.hiddenCount > 0 && (
                                                                            <span className="text-[10px] px-2 py-1 rounded-full border border-zinc-600 bg-black/30 text-zinc-400">
                                                                                +{changeSummary.hiddenCount} more
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-xs text-zinc-500 mt-1">
                                                                        {active ? 'Already active.' : 'Matches current setup values.'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Section 2: Night Physics Applied</div>
                                            <div className="text-sm text-zinc-400 mt-1">This is exactly what the selected night type sets right now.</div>
                                            <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
                                                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Queue Baseline</div>
                                                <div className="text-sm text-zinc-200 mt-1">{selectedPresetSnapshot.queueSummary}</div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {presetFeaturePills.map((item) => (
                                                    <span
                                                        key={`night-preset-feature-${item.label}`}
                                                        className={`text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${item.enabled ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-zinc-700 text-zinc-500'}`}
                                                    >
                                                        {item.label}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="text-xs text-zinc-400 mt-3">
                                                {enabledPresetFeatureCount} of {presetFeaturePills.length} preset systems active.
                                                {selectedPresetChangeSummary.count > 0 ? ` ${selectedPresetChangeSummary.count} immediate change${selectedPresetChangeSummary.count === 1 ? '' : 's'} from current setup.` : ' No differences from current setup.'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {nightSetupStep === 1 && (
                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Section 1: Request Limits</div>
                                            <div className="text-xl font-bold text-white mt-1">Set queue behavior</div>
                                            <div className="text-sm text-zinc-400 mt-1">Make queue expectations clear before singers start requesting songs.</div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {NIGHT_SETUP_QUEUE_LIMIT_OPTIONS.map((option) => (
                                                <button
                                                    key={`queue-limit-${option.id}`}
                                                    onClick={() => setNightSetupQueueLimitMode(option.id)}
                                                    className={`text-left rounded-2xl border px-3 py-3 transition-all ${nightSetupQueueLimitMode === option.id ? 'border-cyan-400/60 bg-cyan-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <i className={`fa-solid ${option.icon} text-cyan-200`}></i>
                                                        <span className="font-bold text-white">{option.label}</span>
                                                    </div>
                                                    <div className="text-xs text-zinc-400 mt-2">{option.description}</div>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Section 2: Rotation + Fairness</div>
                                            <div className="text-sm text-zinc-400 mt-1">Choose how turns rotate and whether new singers get a priority lift.</div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {NIGHT_SETUP_QUEUE_ROTATION_OPTIONS.map((option) => (
                                                <button
                                                    key={`queue-rotation-${option.id}`}
                                                    onClick={() => setNightSetupQueueRotation(option.id)}
                                                    className={`text-left rounded-2xl border px-3 py-3 transition-all ${nightSetupQueueRotation === option.id ? 'border-cyan-400/60 bg-cyan-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <i className={`fa-solid ${option.icon} text-cyan-200`}></i>
                                                        <span className="font-bold text-white">{option.label}</span>
                                                    </div>
                                                    <div className="text-xs text-zinc-400 mt-2">{option.description}</div>
                                                </button>
                                            ))}
                                        </div>
                                        {nightSetupQueueLimitMode !== 'none' && (
                                            <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-3">
                                                <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Limit Count</div>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <button
                                                        onClick={() => setNightSetupQueueLimitCount((prev) => Math.max(0, Number(prev || 0) - 1))}
                                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3`}
                                                    >
                                                        <i className="fa-solid fa-minus"></i>
                                                    </button>
                                                    <input
                                                        value={nightSetupQueueLimitCount}
                                                        onChange={(event) => setNightSetupQueueLimitCount(event.target.value)}
                                                        className={`${STYLES.input} text-center`}
                                                        placeholder="0"
                                                    />
                                                    <button
                                                        onClick={() => setNightSetupQueueLimitCount((prev) => Math.max(0, Number(prev || 0) + 1))}
                                                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3`}
                                                    >
                                                        <i className="fa-solid fa-plus"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => setNightSetupQueueFirstTimeBoost((prev) => !prev)}
                                            className={`w-full text-left rounded-2xl border px-3 py-3 transition-all ${nightSetupQueueFirstTimeBoost ? 'border-amber-400/60 bg-amber-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                                        >
                                            <div className="flex items-center gap-2 text-white font-bold">
                                                <i className="fa-solid fa-star text-amber-200"></i>
                                                First-Time Singer Boost
                                            </div>
                                            <div className="text-xs text-zinc-400 mt-2">
                                                {nightSetupQueueFirstTimeBoost ? 'ON: New singers get priority uplift.' : 'OFF: Queue order runs without boost.'}
                                            </div>
                                        </button>
                                    </div>
                                )}

                                {nightSetupStep === 2 && (
                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Section 1: Spotlight Mode</div>
                                            <div className="text-xl font-bold text-white mt-1">Pick the spotlight mode</div>
                                            <div className="text-sm text-zinc-400 mt-1">Choose what this room leads with when you go live. Additional mode controls live in the Games tab.</div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                            {NIGHT_SETUP_PRIMARY_MODES.map((mode) => (
                                                <button
                                                    key={`night-setup-mode-${mode.id}`}
                                                    onClick={() => setNightSetupPrimaryMode(mode.id)}
                                                    className={`relative overflow-hidden text-left rounded-2xl border px-3 py-3 transition-all ${nightSetupPrimaryMode === mode.id ? 'border-fuchsia-400/60' : 'border-zinc-700 hover:border-zinc-500'}`}
                                                >
                                                    <div className={`absolute inset-0 bg-gradient-to-br ${mode.accent}`}></div>
                                                    <div className="relative flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <i className={`fa-solid ${mode.icon} text-fuchsia-200`}></i>
                                                            <div className="text-sm font-bold text-white">{mode.label}</div>
                                                        </div>
                                                        {nightSetupPrimaryMode === mode.id && <span className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-100">Primary</span>}
                                                    </div>
                                                    <div className="relative text-xs text-zinc-300 mt-2">{mode.description}</div>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                                            <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Section 2: Live Toggles</div>
                                            <div className="text-sm text-zinc-400 mt-1">Enable the runtime overlays and audience layers you want active by default.</div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setNightSetupAutoPlayMedia((prev) => !prev)}
                                                className={`text-left rounded-2xl border px-3 py-3 transition-all ${nightSetupAutoPlayMedia ? 'border-cyan-400/60 bg-cyan-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                                            >
                                                <div className="flex items-center gap-2 text-white font-bold">
                                                    <i className="fa-solid fa-forward-step text-cyan-200"></i>
                                                    Auto Stage Playback
                                                </div>
                                                <div className="text-xs text-zinc-400 mt-2">Start stage media cues automatically when performers begin.</div>
                                            </button>
                                            <button
                                                onClick={() => setNightSetupShowScoring((prev) => !prev)}
                                                className={`text-left rounded-2xl border px-3 py-3 transition-all ${nightSetupShowScoring ? 'border-cyan-400/60 bg-cyan-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                                            >
                                                <div className="flex items-center gap-2 text-white font-bold">
                                                    <i className="fa-solid fa-ranking-star text-cyan-200"></i>
                                                    Live Scoring
                                                </div>
                                                <div className="text-xs text-zinc-400 mt-2">Display score and performance momentum in real time.</div>
                                            </button>
                                            <button
                                                onClick={() => setNightSetupChatOnTv((prev) => !prev)}
                                                className={`text-left rounded-2xl border px-3 py-3 transition-all ${nightSetupChatOnTv ? 'border-cyan-400/60 bg-cyan-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                                            >
                                                <div className="flex items-center gap-2 text-white font-bold">
                                                    <i className="fa-solid fa-comments text-cyan-200"></i>
                                                    Audience Chat on TV
                                                </div>
                                                <div className="text-xs text-zinc-400 mt-2">Show room chat in the public display feed.</div>
                                            </button>
                                            <button
                                                onClick={() => setNightSetupMarqueeEnabled((prev) => !prev)}
                                                className={`text-left rounded-2xl border px-3 py-3 transition-all ${nightSetupMarqueeEnabled ? 'border-cyan-400/60 bg-cyan-500/12' : 'border-zinc-700 bg-zinc-900/60 hover:border-zinc-500'}`}
                                            >
                                                <div className="flex items-center gap-2 text-white font-bold">
                                                    <i className="fa-solid fa-panorama text-cyan-200"></i>
                                                    Marquee Messages
                                                </div>
                                                <div className="text-xs text-zinc-400 mt-2">Run scheduled banners for promos, reminders, and calls to action.</div>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <aside className="border-t lg:border-t-0 lg:border-l border-white/10 bg-zinc-950/75 px-4 py-4 md:px-5 md:py-5">
                                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Tonight&apos;s Plan</div>
                                <div className="mt-2 rounded-2xl border border-cyan-500/30 bg-zinc-900/80 p-3">
                                    <div className="text-[11px] uppercase tracking-[0.24em] text-cyan-200">TV Preview</div>
                                    <div className="mt-2 rounded-xl border border-zinc-700 bg-black/40 overflow-hidden">
                                        <div className="px-2 py-1 border-b border-zinc-700/80 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                                            <span>Room {roomCode || '----'}</span>
                                            <span>{selectedMode.label}</span>
                                        </div>
                                        <div className="p-2 space-y-2">
                                            <div className="text-[11px] text-zinc-300">Now Performing: <span className="text-white font-semibold">Singer Queue</span></div>
                                            <div className="flex flex-wrap gap-1">
                                                <span className={`text-[10px] px-2 py-1 rounded-full border ${nightSetupShowScoring ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-zinc-700 text-zinc-500'}`}>Scoring</span>
                                                <span className={`text-[10px] px-2 py-1 rounded-full border ${nightSetupAutoPlayMedia ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-zinc-700 text-zinc-500'}`}>Auto-Play</span>
                                                <span className={`text-[10px] px-2 py-1 rounded-full border ${nightSetupQueueFirstTimeBoost ? 'border-amber-400/40 bg-amber-500/15 text-amber-100' : 'border-zinc-700 text-zinc-500'}`}>First-Time</span>
                                                <span className={`text-[10px] px-2 py-1 rounded-full border ${nightSetupChatOnTv ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-zinc-700 text-zinc-500'}`}>Chat</span>
                                                <span className={`text-[10px] px-2 py-1 rounded-full border ${nightSetupMarqueeEnabled ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-zinc-700 text-zinc-500'}`}>Marquee</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all"
                                                    style={{ width: `${Math.max(20, readinessScore)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                                    <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Night Type</div>
                                    <div className="text-white font-bold mt-1">{selectedPreset.label}</div>
                                    <div className="text-xs text-zinc-400 mt-1">{selectedPreset.description}</div>
                                </div>
                                <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                                    <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Pacing Rules</div>
                                    <div className="text-sm text-zinc-200 mt-1">
                                        {limitOption.label}
                                        {nightSetupQueueLimitMode !== 'none' ? ` (${Math.max(0, Number(nightSetupQueueLimitCount || 0))})` : ''}
                                        {' '}| {rotationOption.label}
                                        {nightSetupQueueFirstTimeBoost ? ' | First-time Boost' : ''}
                                    </div>
                                </div>
                                <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                                    <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Spotlight Mode</div>
                                    <div className="flex items-center gap-2 text-sm text-zinc-100 mt-1">
                                        <i className={`fa-solid ${selectedMode.icon}`}></i>
                                        {selectedMode.label}
                                    </div>
                                </div>
                                <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3">
                                    <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Show Readiness</div>
                                    <div className="text-white font-bold mt-1">{readinessScore}%</div>
                                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden mt-2">
                                        <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all" style={{ width: `${readinessScore}%` }}></div>
                                    </div>
                                    {readinessMissing.length > 0 && (
                                        <div className="text-[11px] text-zinc-400 mt-2">
                                            Missing: {readinessMissing.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </aside>
                        </div>

                        <div className="px-4 py-3 md:px-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                            <button
                                onClick={() => {
                                    setShowNightSetupWizard(false);
                                    setShowSettings(true);
                                    setSettingsTab('general');
                                }}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary}`}
                            >
                                Open Full Admin
                            </button>
                            <div className="flex items-center gap-2">
                                {nightSetupStep > 0 && (
                                    <button onClick={() => setNightSetupStep((prev) => Math.max(0, prev - 1))} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>
                                        Back
                                    </button>
                                )}
                                {nightSetupStep < 2 ? (
                                    <button onClick={() => setNightSetupStep((prev) => Math.min(2, prev + 1))} className={`${STYLES.btnStd} ${STYLES.btnPrimary}`}>
                                        Continue
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 flex-wrap justify-end">
                                        <button
                                            onClick={() => applyNightSetupWizard({ intent: 'save' })}
                                            disabled={nightSetupApplying}
                                            className={`${STYLES.btnStd} ${STYLES.btnNeutral} ${nightSetupApplying ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            {nightSetupApplying ? 'Saving...' : 'Save + Close'}
                                        </button>
                                        <button
                                            onClick={() => applyNightSetupWizard({ intent: 'start_match' })}
                                            disabled={nightSetupApplying}
                                            className={`${STYLES.btnStd} ${STYLES.btnHighlight} ${nightSetupApplying ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            {nightSetupApplying ? 'Starting...' : 'Save + Start Match'}
                                        </button>
                                        <button
                                            onClick={launchNightSetupPackage}
                                            disabled={nightSetupApplying}
                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} ${nightSetupApplying ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            {nightSetupApplying ? 'Launching...' : 'Launch Package'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if(view === 'landing') return ( 
        <div
            className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center p-4 md:p-8 text-center"
            style={{
                background:
                    'radial-gradient(circle at 14% 12%, rgba(0,196,217,0.22), transparent 34%), radial-gradient(circle at 88% 5%, rgba(236,72,153,0.18), transparent 32%), linear-gradient(160deg, #04060e 0%, #090d19 52%, #04060c 100%)'
            }}
        >
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-16 top-20 h-56 w-56 rounded-full bg-cyan-500/15 blur-3xl"></div>
                <div className="absolute -right-10 top-10 h-64 w-64 rounded-full bg-pink-500/12 blur-3xl"></div>
                <div className="absolute bottom-[-5rem] left-1/3 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"></div>
            </div>
            <div className="relative z-10 w-full max-w-2xl">
                <div className="bg-zinc-950/78 p-6 md:p-8 rounded-[2rem] border border-cyan-400/20 backdrop-blur-xl w-full shadow-[0_30px_90px_rgba(0,0,0,0.5)] relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-cyan-100">
                        <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse"></span>
                        Host Control Surface
                    </div>
                    <div className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-zinc-300">
                        {planLabel}
                    </div>
                </div>
                <img src="https://beauross.com/wp-content/uploads/bross-entertainment-chrome.png" className="w-56 mx-auto mb-5 drop-shadow-[0_0_30px_rgba(0,196,217,0.28)]"/> 
                <h1 className="text-[2.1rem] md:text-5xl font-black mb-3 text-white leading-tight">Launch Your Next Room Like a Headliner</h1>
                <div className="text-sm text-zinc-300 mb-6 max-w-xl mx-auto">Use guided setup for workspace onboarding, or quick-start a fresh room in one click.</div>
                <button
                    onClick={() => {
                        if (!canUseWorkspaceOnboarding) {
                            toast(`${getMissingCapabilityLabel(CAPABILITY_KEYS.WORKSPACE_ONBOARDING)} is not enabled for this workspace.`);
                            return;
                        }
                        openOnboardingWizard();
                    }}
                    disabled={!canUseWorkspaceOnboarding}
                    className={`${STYLES.btnStd} ${STYLES.btnPrimary} w-full py-4 text-sm uppercase tracking-[0.24em] mb-3 ${!canUseWorkspaceOnboarding ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    Guided Setup Wizard
                </button>
                <button
                    onClick={() => createRoom()}
                    disabled={creatingRoom}
                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} w-full py-3 text-sm uppercase tracking-[0.24em] mb-5 ${creatingRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {creatingRoom ? 'Creating Room...' : 'Quick Start New Room'}
                </button> 
                {!uid && authError && (
                    <div className="mb-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-left">
                        Auth failed: {authError.code || authError.message || 'Unknown error'}
                        {retryAuth && (
                            <button onClick={retryAuth} className="ml-2 underline text-red-200">Retry</button>
                        )}
                    </div>
                )}
                <div className="text-xs text-zinc-500 uppercase tracking-[0.28em] mb-2 text-left">Join Existing Room</div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center"> 
                    <input
                        value={roomCodeInput}
                        onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') joinRoom();
                        }}
                        placeholder="ROOM CODE"
                        className={`${STYLES.input} text-center text-xl font-mono w-full tracking-[0.3em]`}
                    /> 
                    <button
                        onClick={() => joinRoom()}
                        disabled={joiningRoom}
                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-6 py-3 text-sm uppercase tracking-[0.2em] sm:min-w-[120px] ${joiningRoom ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {joiningRoom ? 'Joining...' : 'Join'}
                    </button> 
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-left">
                    <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Workspace</div>
                        <div className="mt-1 text-xs text-zinc-300 font-mono truncate">{orgContext?.orgId || 'not-initialized'}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Plan</div>
                        <div className="mt-1 text-xs text-zinc-300">{planLabel}</div>
                    </div>
                    <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Version</div>
                        <div className="mt-1 text-xs text-zinc-300 font-mono">{VERSION}</div>
                    </div>
                </div>
                {entryError && (
                    <div className="mt-3 text-xs text-rose-200 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2 text-left">
                        {entryError}
                    </div>
                )}
                {hostUpdateDeploymentBanner && (
                    <div className="mt-3">
                        {hostUpdateDeploymentBanner}
                    </div>
                )}
                <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left text-xs text-zinc-400">
                    <div className="font-semibold text-zinc-200 mb-1">Two Launch Paths</div>
                    <div className="mb-1"><span className="text-cyan-200"><i className="fa-solid fa-wand-magic-sparkles mr-2"></i></span>Wizard: identity, billing, branding, then launch.</div>
                    <div><span className="text-pink-200"><i className="fa-solid fa-bolt mr-2"></i></span>Quick Start: create room now, fine-tune in Night Setup.</div>
                </div> 
            </div>
            {showOnboardingWizard && (
                <div className="fixed inset-0 z-[95] bg-black/85 backdrop-blur-sm overflow-y-auto p-3 md:p-6">
                    <div className="w-full max-w-5xl mx-auto bg-zinc-950/95 border border-cyan-400/20 rounded-[2rem] shadow-[0_34px_100px_rgba(0,0,0,0.62)] overflow-hidden text-left">
                        <div className="px-5 py-4 md:px-6 border-b border-zinc-800 flex items-center justify-between gap-3">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Turnkey Setup</div>
                                <div className="text-2xl font-black text-white mt-1">Workspace Onboarding</div>
                                <div className="text-sm text-zinc-400 mt-1">Configure identity, billing, branding, then launch your first room.</div>
                            </div>
                            <button
                                onClick={closeOnboardingWizard}
                                disabled={onboardingBusy || creatingRoom}
                                className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}
                            >
                                Close
                            </button>
                        </div>
                        <div className="px-5 pt-4 pb-3 border-b border-zinc-800">
                            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-pink-400 transition-all duration-300"
                                    style={{ width: `${Math.round(((onboardingStep + 1) / Math.max(1, HOST_ONBOARDING_STEPS.length)) * 100)}%` }}
                                ></div>
                            </div>
                            <div className="mt-2 text-[11px] uppercase tracking-[0.24em] text-zinc-500">Step {onboardingStep + 1} of {HOST_ONBOARDING_STEPS.length}</div>
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                            {HOST_ONBOARDING_STEPS.map((step, idx) => (
                                <button
                                    key={step.key}
                                    onClick={() => {
                                        if (onboardingBusy || creatingRoom) return;
                                        if (idx > onboardingStep) return;
                                        setOnboardingStep(idx);
                                        setOnboardingError('');
                                    }}
                                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                                        idx === onboardingStep
                                            ? 'border-cyan-400/60 bg-cyan-500/12 text-cyan-100'
                                            : idx < onboardingStep
                                                ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200'
                                                : 'border-zinc-700 bg-zinc-900/75 text-zinc-400'
                                    }`}
                                >
                                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Step {idx + 1}</div>
                                    <div className="text-sm font-bold mt-1">{step.label}</div>
                                </button>
                            ))}
                            </div>
                        </div>
                        <div className="px-5 py-4 md:px-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {onboardingError && (
                                <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-400/30 rounded-lg px-3 py-2">
                                    {onboardingError}
                                </div>
                            )}
                            {onboardingStep === 0 && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-4">
                                        <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Identity</div>
                                        <div className="text-lg font-bold text-white mt-1">Define your host profile</div>
                                        <div className="text-sm text-zinc-400 mt-1">These values become your default organization and room identity.</div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.22em] text-zinc-500 mb-1">Host Name</div>
                                            <input
                                                value={onboardingHostName}
                                                onChange={e => setOnboardingHostName(e.target.value)}
                                                className={STYLES.input}
                                                placeholder="Host name"
                                            />
                                        </div>
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.22em] text-zinc-500 mb-1">Workspace Name</div>
                                            <input
                                                value={onboardingWorkspaceName}
                                                onChange={e => setOnboardingWorkspaceName(e.target.value)}
                                                className={STYLES.input}
                                                placeholder="Workspace name"
                                            />
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/45 px-3 py-2 text-xs text-zinc-400">
                                        This creates or updates the organization record used for capabilities, billing, and room ownership.
                                    </div>
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
                                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-4">
                                        <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Billing</div>
                                        <div className="text-lg font-bold text-white mt-1">Choose your workspace plan</div>
                                        <div className="text-sm text-zinc-400 mt-1">Pick a tier now and keep momentum; you can change it later.</div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {HOST_ONBOARDING_PLAN_OPTIONS.map((option) => (
                                            <button
                                                key={option.id}
                                                onClick={() => setOnboardingPlanId(option.id)}
                                                className={`text-left rounded-xl border p-3 transition-colors ${
                                                    onboardingPlanId === option.id
                                                        ? 'border-[#00C4D9]/60 bg-[#00C4D9]/12'
                                                        : 'border-zinc-700 bg-zinc-950/70 hover:border-zinc-500'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-white font-semibold">{option.label}</div>
                                                    {onboardingPlanId === option.id && (
                                                        <span className="text-[10px] uppercase tracking-[0.2em] rounded-full border border-cyan-300/35 bg-cyan-500/20 text-cyan-100 px-2 py-0.5">Selected</span>
                                                    )}
                                                </div>
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
                                        <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-400/35 rounded-lg px-3 py-2">
                                            Subscription is not active yet. You can continue setup now and activate billing later.
                                        </div>
                                    )}
                                </div>
                            )}
                            {onboardingStep === 2 && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-4">
                                        <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Branding</div>
                                        <div className="text-lg font-bold text-white mt-1">Set your room identity</div>
                                        <div className="text-sm text-zinc-400 mt-1">Choose a default logo now. You can always override this per room later.</div>
                                    </div>
                                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/45 p-3">
                                        <div className="text-xs uppercase tracking-[0.22em] text-zinc-500 mb-2">Default Logo</div>
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
                                                className={`rounded-xl border p-2 flex flex-col items-center gap-2 transition-colors ${
                                                    onboardingLogoUrl === choice.url
                                                        ? 'border-[#00C4D9]/60 bg-[#00C4D9]/10'
                                                        : 'border-zinc-700 bg-zinc-950/70 hover:border-zinc-500'
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
                                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/65 p-4">
                                        <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Launch</div>
                                        <div className="text-lg font-bold text-white mt-1">Review and create your first room</div>
                                        <div className="text-sm text-zinc-400 mt-1">Launch creates the room and opens Night Setup for queue and mode planning.</div>
                                    </div>
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
                            <div className="max-h-72 touch-scroll-y custom-scrollbar">
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
                <div className="flex-1 min-h-0">
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
                                    <div className="grid grid-cols-2 gap-2 max-h-32 custom-scrollbar touch-scroll-y pr-1">
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

    const settingsNavigationSections = (() => {
        const q = settingsNavQuery.trim().toLowerCase();
        return HOST_SETTINGS_SECTIONS
            .map((section) => ({
                ...section,
                items: section.items.filter((item) => {
                    if (!q) return true;
                    const haystack = `${item.label} ${item.description || ''} ${item.keywords || ''}`.toLowerCase();
                    return haystack.includes(q);
                })
            }))
            .filter((section) => section.items.length > 0);
    })();
    const settingsResultCount = settingsNavigationSections.reduce((sum, section) => sum + section.items.length, 0);
    const totalSocialUnread = (chatUnread ? 1 : 0) + (dmUnread ? 1 : 0);
    const settingsNavBadges = {
        gamepad: room?.activeMode && room.activeMode !== 'karaoke' ? 'LIVE' : '',
        chat: totalSocialUnread > 0 ? String(totalSocialUnread) : '',
        moderation: moderationQueueState.totalPending > 0 ? String(moderationQueueState.totalPending) : '',
        general: queuedSongs.length > 0 ? `${queuedSongs.length}Q` : ''
    };
    const activeSettingsMeta = HOST_SETTINGS_META[settingsTab] || HOST_SETTINGS_META.general;
    const recentSettingsNavItems = settingsRecentTabs
        .filter((tab) => tab !== settingsTab)
        .map((tab) => ({ key: tab, ...(HOST_SETTINGS_META[tab] || { label: tab, icon: 'fa-gear' }) }))
        .slice(0, 4);
    const canSaveRoomSettings = !['billing', 'qa', 'live_effects'].includes(settingsTab);
    const draftRoomSettingsPayload = {
        tipUrl: (tipSettings.link || '').trim() || null,
        tipQrUrl: (tipSettings.qr || '').trim() || null,
        hostName: hostName || 'Host',
        logoUrl: (logoUrl || '').trim() || null,
        tipPointRate: Number(tipPointRate || 100),
        tipCrates: normalizeTipCratesForSave(tipCrates),
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
        hostNightPreset: hostNightPreset || 'custom',
        bingoAudienceReopenEnabled: audienceBingoReopenEnabled !== false,
        autoLyricsOnQueue: !!autoLyricsOnQueue && !!capabilities?.[CAPABILITY_KEYS.AI_GENERATE_CONTENT],
        popTriviaEnabled: popTriviaEnabled !== false,
        queueSettings: {
            limitMode: queueLimitMode || 'none',
            limitCount: Math.max(0, Number(queueLimitCount || 0)),
            rotation: queueRotation || 'round_robin',
            firstTimeBoost: !!queueFirstTimeBoost
        }
    };
    const persistedRoomSettingsPayload = (() => {
        if (!roomCode || !room) return null;
        const persistedTipCrates = Array.isArray(room.tipCrates) ? room.tipCrates : DEFAULT_TIP_CRATES;
        return {
            tipUrl: (room.tipUrl || '').trim() || null,
            tipQrUrl: (room.tipQrUrl || '').trim() || null,
            hostName: room.hostName || 'Host',
            logoUrl: (room.logoUrl || '').trim() || null,
            tipPointRate: Number(room.tipPointRate || 100),
            tipCrates: normalizeTipCratesForSave(persistedTipCrates),
            appleMusicAutoPlaylistId: parseAppleMusicPlaylistId(room.appleMusicAutoPlaylistId || ''),
            appleMusicAutoPlaylistTitle: (room.appleMusicAutoPlaylistTitle || '').trim(),
            autoBgFadeOutMs: Math.max(200, Number(room.autoBgFadeOutMs || 900)),
            autoBgFadeInMs: Math.max(200, Number(room.autoBgFadeInMs || 900)),
            autoBgMixDuringSong: Math.max(0, Math.min(100, Number(room.autoBgMixDuringSong ?? 0))),
            readyCheckDurationSec: Math.max(3, Number(room.readyCheckDurationSec || 10)),
            readyCheckRewardPoints: Math.max(0, Number(room.readyCheckRewardPoints || 0)),
            showScoring: room.showScoring !== false,
            showFameLevel: room.showFameLevel !== false,
            allowSingerTrackSelect: !!room.allowSingerTrackSelect,
            hostNightPreset: room.hostNightPreset || 'custom',
            bingoAudienceReopenEnabled: room.bingoAudienceReopenEnabled !== false,
            autoLyricsOnQueue: !!room.autoLyricsOnQueue && !!capabilities?.[CAPABILITY_KEYS.AI_GENERATE_CONTENT],
            popTriviaEnabled: room.popTriviaEnabled !== false,
            queueSettings: {
                limitMode: room.queueSettings?.limitMode || 'none',
                limitCount: Math.max(0, Number(room.queueSettings?.limitCount || 0)),
                rotation: room.queueSettings?.rotation || 'round_robin',
                firstTimeBoost: room.queueSettings?.firstTimeBoost !== false
            }
        };
    })();
    const hasPendingRoomSettings = !!persistedRoomSettingsPayload
        && JSON.stringify(draftRoomSettingsPayload) !== JSON.stringify(persistedRoomSettingsPayload);
    const showSaveAction = canSaveRoomSettings || hasPendingRoomSettings;
    const viewScopedSettingsItems = HOST_WORKSPACE_SECTIONS
        .filter((section) => section.view === activeWorkspaceView)
        .map((section) => {
            const tabKey = SECTION_TO_SETTINGS_TAB[section.id];
            const meta = HOST_SETTINGS_META[tabKey];
            if (!tabKey || !meta) return null;
            return {
                key: tabKey,
                label: meta.label,
                icon: meta.icon || 'fa-gear',
                description: meta.description || '',
                sectionLabel: meta.sectionLabel || ''
            };
        })
        .filter(Boolean);
    const flatSettingsItems = HOST_SETTINGS_SECTIONS.flatMap((section) =>
        section.items.map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon || 'fa-gear',
            description: item.description || '',
            sectionLabel: section.label
        }))
    );
    const navigationItemsForRail = settingsNavQuery.trim()
        ? flatSettingsItems.filter((item) => {
            const haystack = `${item.label} ${item.description} ${item.sectionLabel}`.toLowerCase();
            return haystack.includes(settingsNavQuery.trim().toLowerCase());
        })
        : (viewScopedSettingsItems.length ? viewScopedSettingsItems : flatSettingsItems);
    const settingsNavigationContent = (
        <div className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">Sections</div>
                <div className="mt-2 space-y-1.5">
                    {navigationItemsForRail.map((item) => {
                        const isActive = settingsTab === item.key;
                        const badge = settingsNavBadges[item.key];
                        return (
                            <button
                                key={`settings-item-${item.key}`}
                                onClick={() => handleSettingsNavSelect(item.key)}
                                className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                                    isActive
                                        ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100'
                                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-white'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <i className={`fa-solid ${item.icon} text-[11px] ${isActive ? 'text-cyan-300' : 'text-zinc-500'}`}></i>
                                        <span className="truncate text-xs font-semibold tracking-wide">{item.label}</span>
                                    </div>
                                    {badge ? (
                                        <span className="rounded border border-zinc-600 px-1.5 py-0.5 text-[9px] text-zinc-200">{badge}</span>
                                    ) : null}
                                </div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{item.sectionLabel}</div>
                            </button>
                        );
                    })}
                    {navigationItemsForRail.length === 0 && (
                        <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
                            No section matches "{settingsNavQuery}".
                        </div>
                    )}
                </div>
            </div>
            {recentSettingsNavItems.length > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">Recent</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {recentSettingsNavItems.map((item) => (
                            <button
                                key={`recent-${item.key}`}
                                onClick={() => handleSettingsNavSelect(item.key)}
                                className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-500 hover:text-white"
                            >
                                <i className={`fa-solid ${item.icon || 'fa-gear'} text-[9px]`}></i>
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
    const workspaceContextPanel = (
        <div className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">Room Status</div>
                <div className="mt-2 space-y-1 text-xs text-zinc-300">
                    <div className="flex items-center justify-between"><span>Queue</span><span className="font-semibold text-white">{queuedSongs.length}</span></div>
                    <div className="flex items-center justify-between"><span>Audience</span><span className="font-semibold text-white">{users.length}</span></div>
                    <div className="flex items-center justify-between"><span>Mode</span><span className="font-semibold text-white uppercase">{room?.activeMode || 'karaoke'}</span></div>
                    <div className="flex items-center justify-between"><span>Pending Moderation</span><span className="font-semibold text-white">{moderationQueueState.totalPending}</span></div>
                </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">Quick Actions</div>
                <div className="mt-2 grid grid-cols-1 gap-2">
                    <button
                        data-feature-id="quick-open-tv"
                        onClick={() => window.open(`${appBase}?room=${roomCode}&mode=tv`, '_blank', 'noopener,noreferrer')}
                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} justify-start`}
                    >
                        <i className="fa-solid fa-tv"></i>
                        Open Public TV
                    </button>
                    <button
                        onClick={async () => {
                            const audienceUrl = `${appBase}?room=${roomCode}`;
                            try {
                                await navigator.clipboard.writeText(audienceUrl);
                                toast('Audience join link copied.');
                            } catch {
                                toast(audienceUrl);
                            }
                        }}
                        className={`${STYLES.btnStd} ${STYLES.btnNeutral} justify-start`}
                    >
                        <i className="fa-solid fa-link"></i>
                        Copy Join Link
                    </button>
                    <button
                        onClick={() => leaveAdminWithTarget('stage')}
                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} justify-start`}
                    >
                        <i className="fa-solid fa-list-check"></i>
                        Open Queue
                    </button>
                    <button
                        data-feature-id="quick-open-live-effects"
                        onClick={() => handleSettingsNavSelect('live_effects')}
                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} justify-start`}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                        Live Effects
                    </button>
                </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
                Settings matches: <span className="text-white font-semibold">{settingsResultCount}</span>
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
        silenceAll,
        pendingModerationCount: moderationQueueState.totalPending,
        runMissionHypeMoment,
        missionControlEnabled,
        missionControlCohort,
        openHostSettings: () => {
            openAdminWorkspace('ops.room_setup');
        },
        openLiveEffects: () => openAdminWorkspace('advanced.live_effects'),
        openModerationInbox,
        showLegacyLiveEffects: false,
        compactViewport: compactHostViewport
    };
    const inAdminWorkspace = tab === 'admin';

    if (isChatPopout) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-saira p-4 md:p-6">
                {hostUpdateDeploymentBanner && (
                    <div className="max-w-5xl mx-auto mb-3">
                        {hostUpdateDeploymentBanner}
                    </div>
                )}
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
                    setTab={handleTopChromeTabChange}
                    showLaunchMenu={showLaunchMenu}
                    setShowLaunchMenu={setShowLaunchMenu}
                    showNavMenu={showNavMenu}
                    setShowNavMenu={setShowNavMenu}
                    setShowSettings={setShowSettings}
                    setSettingsTab={setSettingsTab}
                    openAdminWorkspace={openAdminWorkspace}
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
                    moderationPendingCount={moderationQueueState.totalPending}
                    moderationSeverity={moderationInbox.meta?.severity || 'idle'}
                    moderationNeedsAttention={!!moderationInbox.meta?.needsAttention}
                    onOpenModerationInbox={openModerationInbox}
                />
                <ModerationInboxDrawer
                    open={showModerationInbox}
                    onClose={closeModerationInbox}
                    pendingCount={moderationQueueState.totalPending}
                    severity={moderationInbox.meta?.severity || 'idle'}
                    needsAttention={!!moderationInbox.meta?.needsAttention}
                >
                    <IncomingModerationQueuePanel
                        queueItems={moderationInbox.queueItems}
                        counts={moderationInbox.counts}
                        actions={moderationInbox.actions}
                        busyAction={moderationInbox.meta?.busyAction}
                        loading={moderationInbox.meta?.loading}
                    />
                </ModerationInboxDrawer>

            {hostUpdateDeploymentBanner && (
                <div className="px-3 sm:px-4 md:px-5 lg:px-6 pt-3">
                    {hostUpdateDeploymentBanner}
                </div>
            )}

            <div className="flex-1 min-h-0 p-3 sm:p-4 md:p-5 lg:p-6 overflow-y-auto md:overflow-hidden">
                {room?.activeMode && room.activeMode !== 'karaoke' && (
                    <HostGameControlPad
                        roomCode={roomCode}
                        room={room}
                        updateRoom={updateRoom}
                        setTab={setTab}
                        appBase={appBase}
                    />
                )}
                {tab === 'stage' && (
                    <QueueTab {...queueTabProps} />
                )}
                {tab === 'browse' && browsePanel}
                {tab === 'games' && (
                    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
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
                                bracketBusy={bracketBusy}
                                onCreateSweet16Bracket={createSweet16Bracket}
                                onQueueNextBracketMatch={queueNextBracketMatch}
                                onClearSweet16Bracket={clearSweet16Bracket}
                                onSetBracketMatchWinner={setBracketMatchWinner}
                                onSetBracketWinnerFromCrowdVotes={setBracketWinnerFromCrowdVotes}
                                onToggleBracketCrowdVoting={toggleBracketCrowdVoting}
                                onForfeitBracketContestant={forfeitBracketContestant}
                            />
                        </div>
                        <div className="shrink-0">
                            <IncomingModerationQueuePanel
                                queueItems={moderationInbox.queueItems}
                                counts={moderationInbox.counts}
                                actions={moderationInbox.actions}
                                busyAction={moderationInbox.meta?.busyAction}
                                loading={moderationInbox.meta?.loading}
                                embedded
                            />
                        </div>
                    </div>
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
                                <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <div className="text-sm uppercase tracking-widest text-zinc-500">Tournament</div>
                                            <div className="text-xl font-bold text-rose-300">Sweet 16 Bracket</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={createSweet16Bracket}
                                                disabled={bracketBusy}
                                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-xs ${bracketBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                {bracketBusy ? 'Working...' : 'Create / Reseed'}
                                            </button>
                                            <button
                                                onClick={queueNextBracketMatch}
                                                disabled={bracketBusy || !activeBracket?.rounds?.length || activeBracket?.status === 'complete'}
                                                className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-xs ${(bracketBusy || !activeBracket?.rounds?.length || activeBracket?.status === 'complete') ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                Queue Next Match
                                            </button>
                                            <button
                                                onClick={clearSweet16Bracket}
                                                disabled={bracketBusy || !activeBracket}
                                                className={`${STYLES.btnStd} ${STYLES.btnDanger} px-3 py-1 text-xs ${(bracketBusy || !activeBracket) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                Clear
                                            </button>
                                            <button
                                                onClick={() => toggleBracketCrowdVoting(!bracketCrowdVotingEnabled)}
                                                disabled={bracketBusy || !activeBracket}
                                                className={`${STYLES.btnStd} ${bracketCrowdVotingEnabled ? STYLES.btnSecondary : STYLES.btnHighlight} px-3 py-1 text-xs ${(bracketBusy || !activeBracket) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                {bracketCrowdVotingEnabled ? 'Pause Crowd Vote' : 'Enable Crowd Vote'}
                                            </button>
                                        </div>
                                    </div>
                                    {!activeBracket?.rounds?.length ? (
                                        <div className="text-sm text-zinc-400">
                                            Creates single-elimination 1v1 matches. Each match auto-picks random songs from each singer's Tight 15.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="text-sm text-zinc-400">
                                                Round: <span className="text-zinc-200 font-bold">{activeBracket?.rounds?.[activeBracket?.activeRoundIndex || 0]?.name || 'Round'}</span>
                                                {' '}| Bracket size: <span className="text-zinc-200 font-bold">{activeBracket?.size || 0}</span>
                                                {' '}| Status: <span className="text-zinc-200 font-bold">{activeBracket?.status || 'setup'}</span>
                                                {' '}| Crowd voting: <span className={`font-bold ${bracketCrowdVotingEnabled ? 'text-cyan-200' : 'text-zinc-500'}`}>{bracketCrowdVotingEnabled ? 'ON' : 'OFF'}</span>
                                            </div>
                                            {bracketShowAdvancePrompt && (
                                                <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-3 flex flex-wrap items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">Round Complete</div>
                                                        <div className="text-sm text-zinc-100 mt-1">
                                                            {activeBracket?.roundTransition?.fromRoundName || 'Round'} done. Next up: <span className="font-bold text-cyan-200">{activeBracket?.roundTransition?.toRoundName || 'Next round'}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={queueNextBracketMatch}
                                                        disabled={bracketBusy || activeBracket?.status === 'complete'}
                                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-xs ${(bracketBusy || activeBracket?.status === 'complete') ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    >
                                                        Start Next Round
                                                    </button>
                                                </div>
                                            )}
                                            {bracketNoShow && (
                                                <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-3 flex flex-wrap items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200">No-Show Watch</div>
                                                        <div className="text-sm text-zinc-100 mt-1">
                                                            {bracketNoShow.missingName} left the room. Auto-forfeit in <span className="font-bold text-amber-200">{bracketNoShowCountdownSec}s</span>.
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => forfeitBracketContestant(bracketNoShow.matchId, bracketNoShow.missingUid, 'host')}
                                                        disabled={bracketBusy}
                                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-xs ${bracketBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    >
                                                        Forfeit Now
                                                    </button>
                                                </div>
                                            )}
                                            {activeBracket?.status === 'complete' && (
                                                <div className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-400/30 rounded-xl px-3 py-2">
                                                    Champion: {activeBracket?.championName || 'Winner'}
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                {(activeBracket?.rounds?.[activeBracket?.activeRoundIndex || 0]?.matches || []).map((match) => {
                                                    const a = activeBracket?.contestantsByUid?.[match.aUid] || null;
                                                    const b = activeBracket?.contestantsByUid?.[match.bUid] || null;
                                                    const winnerUid = match?.winnerUid || '';
                                                    const voteSummary = getBracketMatchCrowdVotes({
                                                        users,
                                                        bracketId: activeBracket?.id || '',
                                                        match
                                                    });
                                                    return (
                                                        <div key={match.id} className={`rounded-xl border p-3 ${activeBracket?.activeMatchId === match.id ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-zinc-700 bg-zinc-950/50'}`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="text-xs uppercase tracking-widest text-zinc-500">Match {match.slot}</div>
                                                                {match.queuedAt && <div className="text-[10px] uppercase tracking-widest text-cyan-200">Queued</div>}
                                                            </div>
                                                            <div className="space-y-2 text-sm">
                                                                <div className={`rounded-lg border px-2 py-2 ${winnerUid && winnerUid === a?.uid ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-zinc-700 bg-black/30'}`}>
                                                                    <div className="font-bold text-white">{a?.name || 'Open Slot'}</div>
                                                                    <div className="text-zinc-400 truncate">{match?.aSong?.songTitle || '-'} {match?.aSong?.artist ? `- ${match.aSong.artist}` : ''}</div>
                                                                    <div className="text-[11px] text-cyan-200 mt-1">{voteSummary.aVotes || 0} crowd votes</div>
                                                                    {a?.uid && (
                                                                        <button
                                                                            onClick={() => setBracketMatchWinner(match.id, a.uid)}
                                                                            disabled={bracketBusy}
                                                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} mt-2 px-2 py-1 text-[10px] ${bracketBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                                        >
                                                                            Mark Winner
                                                                        </button>
                                                                    )}
                                                                    {a?.uid && b?.uid && (
                                                                        <button
                                                                            onClick={() => forfeitBracketContestant(match.id, b.uid, 'host')}
                                                                            disabled={bracketBusy || !!winnerUid}
                                                                            className={`${STYLES.btnStd} ${STYLES.btnDanger} mt-1 px-2 py-1 text-[10px] ${(bracketBusy || !!winnerUid) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                                        >
                                                                            Opponent No-Show
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div className={`rounded-lg border px-2 py-2 ${winnerUid && winnerUid === b?.uid ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-zinc-700 bg-black/30'}`}>
                                                                    <div className="font-bold text-white">{b?.name || 'Open Slot'}</div>
                                                                    <div className="text-zinc-400 truncate">{match?.bSong?.songTitle || '-'} {match?.bSong?.artist ? `- ${match.bSong.artist}` : ''}</div>
                                                                    <div className="text-[11px] text-cyan-200 mt-1">{voteSummary.bVotes || 0} crowd votes</div>
                                                                    {b?.uid && (
                                                                        <button
                                                                            onClick={() => setBracketMatchWinner(match.id, b.uid)}
                                                                            disabled={bracketBusy}
                                                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} mt-2 px-2 py-1 text-[10px] ${bracketBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                                        >
                                                                            Mark Winner
                                                                        </button>
                                                                    )}
                                                                    {a?.uid && b?.uid && (
                                                                        <button
                                                                            onClick={() => forfeitBracketContestant(match.id, a.uid, 'host')}
                                                                            disabled={bracketBusy || !!winnerUid}
                                                                            className={`${STYLES.btnStd} ${STYLES.btnDanger} mt-1 px-2 py-1 text-[10px] ${(bracketBusy || !!winnerUid) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                                        >
                                                                            Opponent No-Show
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => setBracketWinnerFromCrowdVotes(match.id)}
                                                                    disabled={bracketBusy || !bracketCrowdVotingEnabled}
                                                                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} mt-1 px-2 py-1 text-[10px] ${(bracketBusy || !bracketCrowdVotingEnabled) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                                >
                                                                    Use Crowd Winner
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                                <div className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-3">
                                                    <div className="text-xs uppercase tracking-[0.28em] text-zinc-500 mb-2">Bracket Match History</div>
                                                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                                                        {(activeBracket?.matchHistory || []).slice().reverse().slice(0, 10).map((entry) => (
                                                            <div key={entry.id} className="rounded-lg border border-zinc-700 bg-black/30 px-2 py-2">
                                                                <div className="text-[11px] text-zinc-300">
                                                                    <span className="font-bold text-white">{entry.winnerName || 'Winner'}</span> beat {entry.aName || 'A'} vs {entry.bName || 'B'}
                                                                </div>
                                                                <div className="text-[10px] text-zinc-500 mt-1">
                                                                    {entry.roundName || 'Round'} • Match {entry.slot || '-'} • {entry.resolutionType || 'manual'}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {!(activeBracket?.matchHistory || []).length && (
                                                            <div className="text-[11px] text-zinc-500">No resolved matches yet.</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-3">
                                                    <div className="text-xs uppercase tracking-[0.28em] text-zinc-500 mb-2">Bracket Audit Trail</div>
                                                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                                                        {(activeBracket?.auditTrail || []).slice().reverse().slice(0, 12).map((entry) => (
                                                            <div key={entry.id} className="rounded-lg border border-zinc-700 bg-black/30 px-2 py-2">
                                                                <div className="text-[11px] text-zinc-200">{entry.text || entry.type || 'Event'}</div>
                                                                <div className="text-[10px] text-zinc-500 mt-1">{new Date(Number(entry.at || nowMs())).toLocaleTimeString()}</div>
                                                            </div>
                                                        ))}
                                                        {!(activeBracket?.auditTrail || []).length && (
                                                            <div className="text-[11px] text-zinc-500">No audit events yet.</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {users.map(u => {
                                        const userUid = u.uid || u.id.split('_')[1] || '';
                                        const isSpotlight = room?.spotlightUser?.id === userUid;
                                        const stats = userStats.get(userUid || u.name) || {};
                                        const isVip = u.isVip || (u.vipLevel || 0) > 0;
                                        const lastActiveMs = u.lastActiveAt?.seconds ? u.lastActiveAt.seconds * 1000 : u.lastActiveAt;
                                        const userTight15Preview = sanitizeTight15List(u.tight15 || u.tight15Temp || []).slice(0, 3);
                                        const queueBusy = tight15QueueBusyUid === userUid;
                                        const profileBusy = tight15ProfileBusyUid === userUid;
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
                                                <div className="rounded-xl border border-white/10 bg-black/30 p-2 min-h-[72px]">
                                                    <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">Top Tight 15</div>
                                                    {userTight15Preview.length ? (
                                                        <div className="space-y-1">
                                                            {userTight15Preview.map((entry) => (
                                                                <div key={entry.id} className="text-[11px] text-zinc-300 truncate">{entry.songTitle} - {entry.artist}</div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[11px] text-zinc-500">Load full profile to view songs.</div>
                                                    )}
                                                </div>
                                                {lastActiveMs && <div className="text-sm text-zinc-500">Last active {new Date(lastActiveMs).toLocaleTimeString()}</div>}
                                                {u.lastSeen && <div className="text-sm text-zinc-600">Last seen {new Date(u.lastSeen.seconds ? u.lastSeen.seconds * 1000 : u.lastSeen).toLocaleTimeString()}</div>}
                                                {u.phone && <div className="text-sm text-zinc-600">Phone {u.phone}</div>}
                                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={()=>sendUserMessage(userUid, isSpotlight ? null : 'SPOTLIGHT')} className={`${STYLES.btnStd} ${isSpotlight ? STYLES.btnNeutral : STYLES.btnSecondary} px-3 py-1 text-xs`}>
                                                        {isSpotlight ? 'UNSPOTLIGHT' : 'SPOTLIGHT'}
                                                    </button>
                                                    <button
                                                        onClick={() => queueRandomTight15ForUser(u)}
                                                        disabled={queueBusy}
                                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-xs ${queueBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    >
                                                        {queueBusy ? 'QUEUE...' : 'RANDOM TIGHT15'}
                                                    </button>
                                                    <button
                                                        onClick={() => launchSpotlightTight15Challenge(u)}
                                                        disabled={queueBusy}
                                                        className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-xs ${queueBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    >
                                                        SPOTLIGHT CHALLENGE
                                                    </button>
                                                    <button
                                                        onClick={() => openTight15ProfileCard(u)}
                                                        disabled={profileBusy}
                                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-xs ${profileBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    >
                                                        {profileBusy ? 'LOADING...' : 'TIGHT15 CARD'}
                                                    </button>
                                                    <button onClick={()=>kickUser(userUid)} className={`${STYLES.btnStd} ${STYLES.btnDanger} px-3 py-1 text-xs`}>Kick</button>
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
            {roomCode && (
                audiencePreviewVisible ? (
                    <AudienceMiniPreview
                        room={room}
                        roomCode={roomCode}
                        appBase={appBase}
                        currentSong={currentSong}
                        queueCount={queuedSongs.length}
                        collapsed={audiencePreviewCollapsed}
                        onToggleCollapsed={() => setAudiencePreviewCollapsed(prev => !prev)}
                        onHide={() => setAudiencePreviewVisible(false)}
                    />
                ) : (
                    <button
                        onClick={() => setAudiencePreviewVisible(true)}
                        className={`${STYLES.btnStd} ${STYLES.btnInfo} fixed right-3 bottom-3 z-[35] px-3 py-2`}
                    >
                        <i className="fa-solid fa-tv"></i>
                        Audience View
                    </button>
                )
            )}
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
            {(showSettings || inAdminWorkspace) && (
                <div className={inAdminWorkspace ? 'fixed inset-x-0 bottom-0 top-[94px] z-[40] px-3 sm:px-4 md:px-5 lg:px-6 pb-3 sm:pb-4 md:pb-5 lg:pb-6' : 'fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4'}>
                    <div className={`bg-zinc-950/95 border border-zinc-700/80 w-full overflow-hidden flex flex-col ${inAdminWorkspace ? 'h-full rounded-2xl shadow-none' : 'rounded-none sm:rounded-2xl max-w-[1400px] shadow-[0_22px_80px_rgba(0,0,0,0.55)] h-[100dvh] sm:h-[90vh]'}`}>
                        <div className="border-b border-white/10 px-4 py-3 md:px-5 md:py-4 bg-zinc-950">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.32em] text-zinc-500">Host Admin</div>
                                    <div className="text-xl md:text-2xl font-bold text-white">Admin Workspace</div>
                                    <div className="text-xs text-zinc-400 mt-1">Operational settings for queue, audience, media, games, billing, and diagnostics.</div>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-500 flex-wrap">
                                    <span className="px-2 py-1 rounded-full border border-zinc-600 bg-zinc-900 text-zinc-300">
                                        Status Live
                                    </span>
                                    <span className="px-2 py-1 rounded-full border border-white/10">Room {roomCode || '--'}</span>
                                    <span className="px-2 py-1 rounded-full border border-white/10">Mode {room?.activeMode || 'karaoke'}</span>
                                    {!!totalSocialUnread && (
                                        <span className="px-2 py-1 rounded-full border border-pink-400/30 text-pink-200 bg-pink-500/10">
                                            Social alerts {totalSocialUnread}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => setSettingsNavOpen((prev) => !prev)}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} md:hidden`}
                                    >
                                        <i className="fa-solid fa-bars"></i>
                                        Sections
                                    </button>
                                    <button onClick={closeSettingsSurface} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>{inAdminWorkspace ? 'Exit Admin' : 'Close'}</button>
                                </div>
                            </div>
                            {inAdminWorkspace && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {HOST_WORKSPACE_VIEWS.map((view) => (
                                        <button
                                            key={`workspace-view-chip-${view.id}`}
                                            onClick={() => selectWorkspaceView(view.id)}
                                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] ${
                                                activeWorkspaceView === view.id
                                                    ? 'border-cyan-400/40 bg-cyan-500/12 text-cyan-100'
                                                    : 'border-zinc-700 bg-zinc-900/80 text-zinc-300 hover:border-cyan-500/35'
                                            }`}
                                        >
                                            <i className={`fa-solid ${view.icon} text-[10px]`}></i>
                                            {view.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="mt-3 max-w-xl md:max-w-2xl">
                                <label className="relative block">
                                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs"></i>
                                    <input
                                        value={settingsNavQuery}
                                        onChange={(e) => setSettingsNavQuery(e.target.value)}
                                        className={`${STYLES.input} pl-9`}
                                        placeholder="Search host controls, settings, or tools..."
                                    />
                                </label>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    {recentSettingsNavItems.slice(0, compactHostViewport ? 3 : 4).map((item) => (
                                        <button
                                            key={`header-recent-${item.key}`}
                                            onClick={() => handleSettingsNavSelect(item.key)}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-zinc-900/70 px-2.5 py-1 text-[10px] text-zinc-300 hover:border-cyan-400/40 hover:text-white"
                                        >
                                            <i className={`fa-solid ${item.icon || 'fa-gear'} text-[9px]`}></i>
                                            {item.label}
                                        </button>
                                    ))}
                                    {!!settingsNavQuery && (
                                        <button
                                            onClick={() => setSettingsNavQuery('')}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[10px] text-zinc-400 hover:text-white"
                                        >
                                            <i className="fa-solid fa-xmark text-[9px]"></i>
                                            Clear Search
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <HostWorkspaceShell
                            views={HOST_WORKSPACE_VIEWS}
                            activeView={activeWorkspaceView}
                            onSelectView={selectWorkspaceView}
                            context={workspaceContextPanel}
                        >
                            <div className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-[290px_minmax(0,1fr)]">
                                <aside className={`${settingsNavOpen ? 'block' : 'hidden md:block'} xl:block border-b xl:border-b-0 xl:border-r border-white/10 bg-zinc-950 overflow-y-auto custom-scrollbar p-3 md:p-4`}>
                                    <div className="mb-2 flex items-center justify-between md:hidden">
                                        <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">Sections</div>
                                        <button onClick={() => setSettingsNavOpen(false)} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>Close</button>
                                    </div>
                                    {settingsNavigationContent}
                                </aside>
                                <div className="min-h-0 flex flex-col">
                                <div className="border-b border-white/10 px-4 py-3 md:px-5 bg-zinc-950/70">
                                    <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">{activeSettingsMeta.sectionLabel || 'Host Settings'}</div>
                                    <div className="text-xl font-bold text-white mt-1">{activeSettingsMeta.label || 'Host Settings'}</div>
                                    <div className="text-sm text-zinc-400 mt-1">{activeSettingsMeta.description || 'Configure room behavior and host controls.'}</div>
                                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] sm:text-[11px] text-zinc-300">
                                        <button
                                            onClick={() => window.open(`${appBase}?room=${roomCode}&mode=tv`, '_blank', 'noopener,noreferrer')}
                                            className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 px-2.5 py-1 hover:bg-cyan-500/20"
                                        >
                                            <i className="fa-solid fa-tv text-[10px]"></i> Open TV
                                        </button>
                                        <button
                                            onClick={() => setAudiencePreviewVisible(prev => !prev)}
                                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${
                                                audiencePreviewVisible ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-white/15 bg-zinc-900 text-zinc-300'
                                            }`}
                                        >
                                            <i className="fa-solid fa-mobile-screen-button text-[10px]"></i>
                                            Audience Preview {audiencePreviewVisible ? 'On' : 'Off'}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5">
                        {settingsTab === 'general' && (
                        <>
                        <div className="mb-5 bg-zinc-950/60 border border-cyan-500/30 rounded-xl p-4">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                    <div className="text-sm uppercase tracking-widest text-cyan-300">Run Tonight</div>
                                    <div className="text-xs text-zinc-400 mt-1">Core controls first. Open advanced sections only as needed.</div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                                    <span className="px-2 py-1 rounded-full border border-white/15">Mode: {room?.activeMode || 'karaoke'}</span>
                                    <span className="px-2 py-1 rounded-full border border-white/15">Queue: {queuedSongs.length}</span>
                                    <span className="px-2 py-1 rounded-full border border-white/15">Preview: {audiencePreviewVisible ? 'On' : 'Off'}</span>
                                    <span className={`px-2 py-1 rounded-full border ${appleMusicAuthorized ? 'border-emerald-400/30 text-emerald-200 bg-emerald-500/10' : 'border-zinc-500/30 text-zinc-300 bg-zinc-900/70'}`}>
                                        Apple {appleMusicAuthorized ? 'Connected' : 'Not Connected'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mt-3">
                                <button
                                    onClick={() => leaveAdminWithTarget('stage')}
                                    className={`${STYLES.btnStd} ${STYLES.btnHighlight} justify-start`}
                                >
                                    1. Go to Stage
                                </button>
                                <button
                                    onClick={() => window.open(`${appBase}?room=${roomCode}&mode=tv`, '_blank', 'noopener,noreferrer')}
                                    className={`${STYLES.btnStd} ${STYLES.btnInfo} justify-start`}
                                >
                                    2. Open Public TV
                                </button>
                                <button
                                    onClick={async () => {
                                        const audienceUrl = `${appBase}?room=${roomCode}`;
                                        try {
                                            await navigator.clipboard.writeText(audienceUrl);
                                            toast('Audience join link copied.');
                                        } catch {
                                            toast(audienceUrl);
                                        }
                                    }}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} justify-start`}
                                >
                                    3. Copy Join Link
                                </button>
                                <button
                                    onClick={() => setSettingsTab('gamepad')}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} justify-start`}
                                >
                                    4. Open Live Modes
                                </button>
                                <button
                                    onClick={async () => {
                                        setSettingsTab('media');
                                        if (appleMusicAuthorized) {
                                            toast('Apple Music already connected.');
                                            return;
                                        }
                                        await connectAppleMusic();
                                    }}
                                    className={`${STYLES.btnStd} ${appleMusicAuthorized ? STYLES.btnSuccess : STYLES.btnSecondary} justify-start`}
                                >
                                    {appleMusicAuthorized ? 'Apple Music Connected' : 'Connect Apple Music'}
                                </button>
                                <button
                                    onClick={() => setSettingsTab('chat')}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} justify-start`}
                                >
                                    Chat + DMs
                                </button>
                                <button
                                    onClick={() => setSettingsTab('moderation')}
                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral} justify-start`}
                                >
                                    Review Approvals
                                </button>
                                <button
                                    onClick={() => {
                                        if (canGenerateAiContent) {
                                            setShowAiSetupGuide(true);
                                            return;
                                        }
                                        setSettingsTab('billing');
                                        toast('Enable AI in Billing to unlock AI tools.');
                                    }}
                                    className={`${STYLES.btnStd} ${canGenerateAiContent ? STYLES.btnInfo : STYLES.btnSecondary} justify-start`}
                                >
                                    {canGenerateAiContent ? 'AI Setup Guide' : 'Unlock AI Tools'}
                                </button>
                            </div>
                        </div>
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
                            <div className="text-sm uppercase tracking-widest text-zinc-400">Host presets</div>
                            <div className="host-form-helper">One-click tone control for how the night runs. Applies queue rules, overlays, and game defaults.</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {Object.values(HOST_NIGHT_PRESETS).map((preset) => {
                                    const active = hostNightPreset === preset.id;
                                    return (
                                        <button
                                            key={preset.id}
                                            onClick={() => applyHostPreset(preset.id)}
                                            className={`text-left rounded-xl border px-3 py-3 transition-all ${active ? 'border-cyan-400/50 bg-cyan-500/10' : 'border-zinc-700 bg-zinc-900/60 hover:border-cyan-400/30'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-sm font-bold text-white">{preset.label}</div>
                                                {active && <span className="text-[10px] uppercase tracking-widest text-cyan-200">Active</span>}
                                            </div>
                                            <div className="text-xs text-zinc-400 mt-1">{preset.description}</div>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                <button
                                    onClick={() => setAudiencePreviewVisible(prev => !prev)}
                                    className={`${STYLES.btnStd} ${audiencePreviewVisible ? STYLES.btnInfo : STYLES.btnNeutral}`}
                                >
                                    <i className="fa-solid fa-tv"></i>
                                    {audiencePreviewVisible ? 'Audience preview on' : 'Audience preview off'}
                                </button>
                                <button
                                    onClick={() => setAudiencePreviewCollapsed(prev => !prev)}
                                    disabled={!audiencePreviewVisible}
                                    className={`${STYLES.btnStd} ${audiencePreviewCollapsed ? STYLES.btnInfo : STYLES.btnNeutral} ${!audiencePreviewVisible ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <i className={`fa-solid ${audiencePreviewCollapsed ? 'fa-expand' : 'fa-compress'}`}></i>
                                    {audiencePreviewCollapsed ? 'Expand preview' : 'Compact preview'}
                                </button>
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
                              <label className="flex items-center gap-2 text-sm text-zinc-300 mt-2">
                                  <input
                                      type="checkbox"
                                      checked={audienceBingoReopenEnabled}
                                      onChange={e => setAudienceBingoReopenEnabled(e.target.checked)}
                                      className="accent-[#00C4D9]"
                                  />
                                  Let audience reopen Bingo board after closing it
                              </label>
                              <div className="host-form-helper">Adds a persistent "Bingo Live" button on singer phones while Bingo is active.</div>
                              <label className="flex items-center gap-2 text-sm text-zinc-300 mt-2">
                                  <input
                                      type="checkbox"
                                      checked={autoLyricsOnQueue}
                                      disabled={!capabilities?.[CAPABILITY_KEYS.AI_GENERATE_CONTENT]}
                                      onChange={e => setAutoLyricsOnQueue(e.target.checked)}
                                      className="accent-[#00C4D9]"
                                  />
                                  Auto-generate lyrics on queue (AI)
                              </label>
                              <div className="host-form-helper">
                                  {capabilities?.[CAPABILITY_KEYS.AI_GENERATE_CONTENT]
                                      ? 'When no lyrics are available, generate fallback lyrics for queued songs.'
                                      : 'AI lyric generation requires an active Host subscription.'}
                              </div>
                              <label className="flex items-center gap-2 text-sm text-zinc-300 mt-2">
                                  <input
                                      type="checkbox"
                                      checked={popTriviaEnabled}
                                      onChange={e => setPopTriviaEnabled(e.target.checked)}
                                      className="accent-[#00C4D9]"
                                  />
                                  Pop-up trivia side activity (AI)
                              </label>
                              <div className="host-form-helper">
                                  While songs are performing, show AI song trivia on TV and singer phones without leaving karaoke mode.
                              </div>
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
                                {['local', 'youtube', 'itunes'].map(src => {
                                    return (
                                    <button
                                        key={src}
                                        onClick={() => {
                                            setSearchSources(prev => ({ ...prev, [src]: !prev[src] }));
                                        }}
                                        className={`text-sm uppercase tracking-widest px-3 py-1 rounded-full border ${
                                            searchSources[src]
                                                ? 'bg-[#00C4D9]/20 text-[#00C4D9] border-[#00C4D9]/40'
                                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                        }`}
                                    >
                                        {src === 'youtube' ? 'YouTube' : src === 'itunes' ? 'Apple Music' : 'Local'}
                                    </button>
                                    );
                                })}
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

                        {settingsTab === 'gamepad' && (
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-cyan-500/10 via-zinc-950/60 to-fuchsia-500/10 border border-cyan-500/25 rounded-xl p-4">
                                    <div className="text-sm uppercase tracking-[0.25em] text-cyan-300">Live Gamepad</div>
                                    <div className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                                        <i className="fa-solid fa-dice-d20 text-cyan-300"></i>
                                        Host interactions by mode
                                    </div>
                                    <div className="text-sm text-zinc-400 mt-1">
                                        Keep this as your control layer while the game launcher handles setup.
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                                        <button onClick={() => leaveAdminWithTarget('games')} className={`${STYLES.btnStd} ${STYLES.btnHighlight} justify-start`}>
                                            <i className="fa-solid fa-rocket"></i>
                                            Open Launchpad
                                        </button>
                                        <button onClick={() => leaveAdminWithTarget('stage')} className={`${STYLES.btnStd} ${STYLES.btnNeutral} justify-start`}>
                                            <i className="fa-solid fa-microphone-lines"></i>
                                            Stage Controls
                                        </button>
                                        <button onClick={() => window.open(`${appBase}?room=${roomCode}&mode=tv`, '_blank', 'noopener,noreferrer')} className={`${STYLES.btnStd} ${STYLES.btnInfo} justify-start`}>
                                            <i className="fa-solid fa-tv"></i>
                                            Open Public TV
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-zinc-900/50 border border-cyan-500/15 rounded-xl p-4">
                                        <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Current Mode</div>
                                        <div className="text-2xl font-bold text-white mt-2">{room?.activeMode || 'karaoke'}</div>
                                        <div className="text-sm text-zinc-400 mt-1">Use mode-specific host controls from the main Games tab.</div>
                                    </div>
                                    <div className="bg-zinc-900/50 border border-cyan-500/15 rounded-xl p-4">
                                        <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Queue + Audience</div>
                                        <div className="text-sm text-zinc-300 mt-2">Queue: <span className="text-white font-bold">{queuedSongs.length}</span></div>
                                        <div className="text-sm text-zinc-300">Audience in room: <span className="text-white font-bold">{users.length}</span></div>
                                        <div className="text-sm text-zinc-300">Audience preview: <span className="text-white font-bold">{audiencePreviewVisible ? 'On' : 'Off'}</span></div>
                                    </div>
                                </div>
                                <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-4">
                                    <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Suggested host flow</div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-sm">
                                        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-zinc-300">
                                            <div className="text-cyan-300 font-bold mb-1">1. Prime the room</div>
                                            Set visuals and queue policy in Run Tonight before launching game rounds.
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-zinc-300">
                                            <div className="text-cyan-300 font-bold mb-1">2. Run active mode</div>
                                            Keep gamepad interactions visible so guests see host actions on TV.
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-zinc-300">
                                            <div className="text-cyan-300 font-bold mb-1">3. Return to stage</div>
                                            Use stage controls to re-enter karaoke flow without losing momentum.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {settingsTab === 'automations' && (
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-violet-500/10 via-zinc-950/60 to-cyan-500/10 border border-cyan-500/25 rounded-xl p-4">
                                    <div className="text-sm uppercase tracking-[0.25em] text-cyan-300">Night Profiles</div>
                                    <div className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                                        <i className="fa-solid fa-wand-magic-sparkles text-cyan-300"></i>
                                        Preset-driven control
                                    </div>
                                    <div className="text-sm text-zinc-400 mt-1">
                                        Use one-click host presets, then fine tune live automation behavior below.
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mt-3">
                                        {Object.values(HOST_NIGHT_PRESETS).map((preset) => {
                                            const active = hostNightPreset === preset.id;
                                            return (
                                                <button
                                                    key={`automation-preset-${preset.id}`}
                                                    onClick={() => applyHostPreset(preset.id)}
                                                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                                                        active
                                                            ? 'border-cyan-400/50 bg-cyan-500/10'
                                                            : 'border-zinc-700 bg-zinc-900/60 hover:border-cyan-400/30'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-sm font-bold text-white">{preset.label}</div>
                                                        {active && <span className="text-[10px] uppercase tracking-widest text-cyan-200">Active</span>}
                                                    </div>
                                                    <div className="text-xs text-zinc-400 mt-1">{preset.description}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button
                                        onClick={async () => {
                                            const next = !autoDj;
                                            setAutoDj(next);
                                            await updateRoom({ autoDj: next });
                                            toast(next ? 'Auto-DJ enabled' : 'Auto-DJ disabled');
                                        }}
                                        className={`${STYLES.btnStd} ${autoDj ? STYLES.btnInfo : STYLES.btnNeutral} justify-start`}
                                    >
                                        <i className="fa-solid fa-robot"></i>
                                        {autoDj ? 'Auto-DJ is ON' : 'Auto-DJ is OFF'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const next = !autoBgMusic;
                                            setAutoBgMusic(next);
                                            await updateRoom({ autoBgMusic: next });
                                            toast(next ? 'Auto BG music enabled' : 'Auto BG music disabled');
                                        }}
                                        className={`${STYLES.btnStd} ${autoBgMusic ? STYLES.btnInfo : STYLES.btnNeutral} justify-start`}
                                    >
                                        <i className="fa-solid fa-wave-square"></i>
                                        {autoBgMusic ? 'Auto background music ON' : 'Auto background music OFF'}
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const next = !autoPlayMedia;
                                            setAutoPlayMedia(next);
                                            await updateRoom({ autoPlayMedia: next });
                                            toast(next ? 'Auto-play media enabled' : 'Auto-play media disabled');
                                        }}
                                        className={`${STYLES.btnStd} ${autoPlayMedia ? STYLES.btnInfo : STYLES.btnNeutral} justify-start`}
                                    >
                                        <i className="fa-solid fa-forward-step"></i>
                                        {autoPlayMedia ? 'Auto stage playback ON' : 'Auto stage playback OFF'}
                                    </button>
                                    <button
                                        onClick={() => startReadyCheck?.()}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} justify-start`}
                                    >
                                        <i className="fa-solid fa-hourglass-half"></i>
                                        Trigger Ready Check
                                    </button>
                                </div>
                                <div className="bg-zinc-900/50 border border-cyan-500/15 rounded-xl p-4">
                                    <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Automation tuning</div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                                        <label className="text-sm text-zinc-300">
                                            Ready check duration (sec)
                                            <input value={readyCheckDurationSec} onChange={e => setReadyCheckDurationSec(e.target.value)} className={`${STYLES.input} mt-1`} />
                                        </label>
                                        <label className="text-sm text-zinc-300">
                                            Fade out (ms)
                                            <input value={autoBgFadeOutMs} onChange={e => setAutoBgFadeOutMs(e.target.value)} className={`${STYLES.input} mt-1`} />
                                        </label>
                                        <label className="text-sm text-zinc-300">
                                            Fade in (ms)
                                            <input value={autoBgFadeInMs} onChange={e => setAutoBgFadeInMs(e.target.value)} className={`${STYLES.input} mt-1`} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {settingsTab === 'moderation' && (
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-emerald-500/10 via-zinc-950/60 to-cyan-500/10 border border-emerald-500/25 rounded-xl p-4">
                                    <div className="text-sm uppercase tracking-[0.25em] text-cyan-300">Moderation Center</div>
                                    <div className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                                        <i className="fa-solid fa-shield-halved text-emerald-300"></i>
                                        Audience + submission policy
                                    </div>
                                    <div className="text-sm text-zinc-400 mt-1">
                                        Keep visibility and chat scope here. Handle game moderation in the Games queue.
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="bg-zinc-900/50 border border-emerald-500/15 rounded-xl p-4 space-y-3">
                                        <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Chat policy</div>
                                        <button
                                            onClick={async () => {
                                                const next = chatAudienceMode === 'vip' ? 'all' : 'vip';
                                                setChatAudienceMode(next);
                                                await updateRoom({ chatAudienceMode: next });
                                            }}
                                            className={`${STYLES.btnStd} ${chatAudienceMode === 'vip' ? STYLES.btnHighlight : STYLES.btnNeutral} justify-start`}
                                        >
                                            <i className="fa-solid fa-crown"></i>
                                            {chatAudienceMode === 'vip' ? 'VIP-only audience chat' : 'All audience chat enabled'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const next = !chatShowOnTv;
                                                setChatShowOnTv(next);
                                                await updateRoom({ chatShowOnTv: next });
                                            }}
                                            className={`${STYLES.btnStd} ${chatShowOnTv ? STYLES.btnInfo : STYLES.btnNeutral} justify-start`}
                                        >
                                            <i className="fa-solid fa-tv"></i>
                                            {chatShowOnTv ? 'Chat shown on TV' : 'Chat hidden from TV'}
                                        </button>
                                        <button
                                            onClick={() => selectSettingsTab('chat')}
                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} justify-start`}
                                        >
                                            <i className="fa-solid fa-comments"></i>
                                            Open full chat controls
                                        </button>
                                    </div>
                                    <div className="bg-zinc-900/50 border border-emerald-500/15 rounded-xl p-4 space-y-3">
                                        <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Incoming Queue Snapshot</div>
                                        <div className="text-sm text-zinc-300">Pending total: <span className="text-white font-bold">{moderationQueueState.totalPending}</span></div>
                                        <div className="text-sm text-zinc-300">Doodle pending: <span className="text-white font-bold">{moderationQueueState.doodlePending}</span></div>
                                        <div className="text-sm text-zinc-300">Selfie pending: <span className="text-white font-bold">{moderationQueueState.selfiePending}</span></div>
                                        <div className="text-sm text-zinc-300">Bingo suggestions: <span className="text-white font-bold">{moderationQueueState.bingoPending}</span></div>
                                        <div className="text-xs text-zinc-500 pt-1">
                                            Review and resolve queue items from the global inbox without leaving your current screen.
                                        </div>
                                        <button
                                            onClick={openModerationInbox}
                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} justify-start`}
                                        >
                                            <i className="fa-solid fa-inbox"></i>
                                            Open moderation inbox
                                        </button>
                                    </div>
                                </div>
                            </div>
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Billing Period</div>
                                            <select
                                                value={selectedUsagePeriod}
                                                onChange={(e) => setSelectedUsagePeriod(e.target.value)}
                                                className={STYLES.input}
                                            >
                                                {usagePeriodOptions.map((option) => (
                                                    <option key={`usage-period-${option.key}`} value={option.key}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Invoice Customer</div>
                                            <input
                                                value={invoiceCustomerName}
                                                onChange={(e) => setInvoiceCustomerName(e.target.value)}
                                                className={STYLES.input}
                                                placeholder="Customer / client name"
                                            />
                                        </div>
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
                                                    <th className="px-3 py-2">Pass-Through</th>
                                                    <th className="px-3 py-2">Markup</th>
                                                    <th className="px-3 py-2">Billable Rate</th>
                                                    <th className="px-3 py-2">Est. Overage</th>
                                                    <th className="px-3 py-2">Hard Limit</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usageMeters.length === 0 && (
                                                    <tr className="bg-zinc-900/40 text-zinc-500">
                                                        <td className="px-3 py-3" colSpan={9}>No usage data yet for this period.</td>
                                                    </tr>
                                                )}
                                                {usageMeters.map((meter) => (
                                                    <tr key={`usage-meter-${meter.meterId}`} className="border-t border-zinc-800 bg-zinc-900/30">
                                                        <td className="px-3 py-2 text-zinc-200">{meter.label}</td>
                                                        <td className="px-3 py-2 text-white">{Number(meter.used || 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{Number(meter.included || 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{Number(meter.overageUnits || 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{formatUsdFromCents(meter.passThroughUnitCostCents || 0)}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{Number(meter.markupMultiplier || 1).toFixed(2)}x</td>
                                                        <td className="px-3 py-2 text-zinc-300">{formatUsdFromCents(meter.billableUnitRateCents || meter.overageRateCents || 0)}</td>
                                                        <td className="px-3 py-2 text-zinc-300">{formatUsdFromCents(meter.estimatedOverageCents || 0)}</td>
                                                        <td className={`px-3 py-2 ${meter.hardLimitReached ? 'text-amber-200' : 'text-zinc-300'}`}>
                                                            {Number(meter.hardLimit || 0).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="text-[11px] text-zinc-500">
                                        Pass-through cost and markup are shown per meter so overages reflect provider cost plus your margin.
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
                                    <FeatureGate
                                        capabilities={capabilities}
                                        capability={CAPABILITY_KEYS.BILLING_INVOICE_DRAFTS}
                                        fallback={(
                                            <div className="text-sm text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2">
                                                Invoice draft tools are not available on this plan.
                                            </div>
                                        )}
                                    >
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <label className="flex items-center gap-2 text-xs text-zinc-300">
                                            <input
                                                type="checkbox"
                                                checked={invoiceIncludeBasePlan}
                                                onChange={(e) => setInvoiceIncludeBasePlan(e.target.checked)}
                                                className="accent-[#00C4D9]"
                                            />
                                            Include base plan line item
                                        </label>
                                        <div>
                                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Tax Rate %</div>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={invoiceTaxRatePercent}
                                                onChange={(e) => setInvoiceTaxRatePercent(e.target.value)}
                                                className={STYLES.input}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                onClick={() => generateUsageInvoiceDraft(true)}
                                                disabled={invoiceDraftLoading}
                                                className={`${STYLES.btnStd} ${STYLES.btnPrimary} w-full ${invoiceDraftLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                {invoiceDraftLoading ? 'Generating draft...' : 'Generate Invoice Draft'}
                                            </button>
                                        </div>
                                    </div>
                                    {invoiceDraft && (
                                        <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-2">
                                            <div className="text-xs uppercase tracking-widest text-zinc-500">Invoice Draft ({invoiceDraft.periodLabel || invoiceDraft.period})</div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                                <div className="text-zinc-300">Invoice ID: <span className="text-white font-mono">{invoiceDraft.invoiceId}</span></div>
                                                <div className="text-zinc-300">Line Items: <span className="text-white">{Number(invoiceDraft?.lineItems?.length || 0)}</span></div>
                                                <div className="text-zinc-300">Total: <span className="text-white">{formatUsdFromCents(invoiceDraft?.totals?.totalCents || 0)}</span></div>
                                            </div>
                                            <div className="max-h-40 overflow-y-auto custom-scrollbar border border-zinc-800 rounded">
                                                {(invoiceDraft?.lineItems || []).length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-zinc-500">No billable line items for this period.</div>
                                                )}
                                                {(invoiceDraft?.lineItems || []).map((line) => (
                                                    <div key={`invoice-line-${line.id}`} className="px-3 py-2 text-xs border-b border-zinc-800 flex items-center justify-between gap-2">
                                                        <div className="text-zinc-300 truncate">
                                                            {line.description}
                                                            {line.type === 'overage' && (
                                                                <div className="text-[10px] text-zinc-500 mt-1">
                                                                    Pass-through {formatUsdFromCents(line.passThroughUnitCostCents || 0)} x Markup {Number(line.markupMultiplier || 1).toFixed(2)}x
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-zinc-100 whitespace-nowrap text-right">
                                                            <div>{Number(line.quantity || 0).toLocaleString()} x {formatUsdFromCents(line.unitPriceCents || 0)} = {formatUsdFromCents(line.amountCents || 0)}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => downloadQbseCsv('line_items')}
                                                    className={`${STYLES.btnStd} ${STYLES.btnSecondary}`}
                                                >
                                                    Download Line-Item CSV
                                                </button>
                                                <button
                                                    onClick={() => downloadQbseCsv('transactions')}
                                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}
                                                >
                                                    Download QBSE Transaction CSV
                                                </button>
                                                <button
                                                    onClick={() => downloadJson(`bross-invoice-draft-${invoiceDraft?.period || selectedUsagePeriod}.json`, invoiceDraft)}
                                                    className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}
                                                >
                                                    Download Draft JSON
                                                </button>
                                            </div>
                                            <div className="text-[11px] text-zinc-500">
                                                QuickBooks Self-Employed flow: create invoice manually from Line-Item CSV, then reconcile payments with Transaction CSV import.
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                                <div>
                                                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Snapshot Status</div>
                                                    <select
                                                        value={invoiceStatusDraft}
                                                        onChange={(e) => setInvoiceStatusDraft(e.target.value)}
                                                        className={STYLES.input}
                                                    >
                                                        <option value="draft">Draft</option>
                                                        <option value="sent">Sent</option>
                                                        <option value="paid">Paid</option>
                                                        <option value="void">Void</option>
                                                    </select>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Notes</div>
                                                    <input
                                                        value={invoiceNotes}
                                                        onChange={(e) => setInvoiceNotes(e.target.value)}
                                                        className={STYLES.input}
                                                        placeholder="Optional notes for this invoice snapshot"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={saveInvoiceDraftSnapshot}
                                                    disabled={invoiceSaveLoading}
                                                    className={`${STYLES.btnStd} ${STYLES.btnPrimary} ${invoiceSaveLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                >
                                                    {invoiceSaveLoading ? 'Saving snapshot...' : 'Save Invoice Snapshot'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-zinc-950/70 border border-zinc-800 rounded-lg p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-xs uppercase tracking-widest text-zinc-500">Invoice History</div>
                                            <button
                                                onClick={() => refreshInvoiceHistory(true)}
                                                disabled={invoiceHistoryLoading}
                                                className={`${STYLES.btnStd} ${STYLES.btnNeutral} ${invoiceHistoryLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                {invoiceHistoryLoading ? 'Refreshing...' : 'Refresh History'}
                                            </button>
                                        </div>
                                        <div className="max-h-44 overflow-y-auto custom-scrollbar border border-zinc-800 rounded">
                                            {invoiceHistory.length === 0 && (
                                                <div className="px-3 py-2 text-xs text-zinc-500">No saved invoice snapshots yet.</div>
                                            )}
                                            {invoiceHistory.map((invoice) => (
                                                <div key={`invoice-history-${invoice.recordId}`} className="px-3 py-2 text-xs border-b border-zinc-800 grid grid-cols-1 md:grid-cols-5 gap-2">
                                                    <div className="text-zinc-300">
                                                        <div className="text-zinc-500">Invoice</div>
                                                        <div className="text-white font-mono">{invoice.invoiceId || invoice.recordId}</div>
                                                    </div>
                                                    <div className="text-zinc-300">
                                                        <div className="text-zinc-500">Period</div>
                                                        <div>{invoice.period || '--'}</div>
                                                    </div>
                                                    <div className="text-zinc-300">
                                                        <div className="text-zinc-500">Status</div>
                                                        <div className="uppercase">{invoice.status || 'draft'}</div>
                                                    </div>
                                                    <div className="text-zinc-300">
                                                        <div className="text-zinc-500">Total</div>
                                                        <div>{formatUsdFromCents(invoice?.totals?.totalCents || 0)}</div>
                                                    </div>
                                                    <div className="text-zinc-300">
                                                        <div className="text-zinc-500">Saved</div>
                                                        <div>{invoice?.createdAtMs ? new Date(invoice.createdAtMs).toLocaleString() : '--'}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    </FeatureGate>
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
                                        {subscriptionActionLoading === 'host_monthly'
                                            ? 'Opening checkout...'
                                            : `${hostMonthlyPlan?.label || 'Host Monthly'} (${hostMonthlyPlan?.priceLabel || '$15/mo'})`}
                                    </button>
                                    <button
                                        onClick={() => openSubscriptionCheckout('host_annual')}
                                        disabled={!!subscriptionActionLoading}
                                        className={`${STYLES.btnStd} ${STYLES.btnSecondary} ${subscriptionActionLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {subscriptionActionLoading === 'host_annual'
                                            ? 'Opening checkout...'
                                            : `${hostAnnualPlan?.label || 'Host Annual'} (${hostAnnualPlan?.priceLabel || '$150/yr'})`}
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
                                onClick={() => setTipCrates(prev => [...prev, { id: `crate_${nowMs()}`, label: '', amount: '', points: '', url: '' }])}
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
                                <button
                                    onClick={loadAndQueueYouTubePlaylist}
                                    disabled={ytPlaylistLoading || !roomCode}
                                    className={`${STYLES.btnStd} ${ytPlaylistLoading || !roomCode ? STYLES.btnNeutral : STYLES.btnPrimary} px-4 flex-shrink-0`}
                                    title={!roomCode ? 'Create or open a room first' : 'Index playlist and queue every track'}
                                >
                                    {ytPlaylistLoading ? EMOJI.refresh : 'INDEX + QUEUE ALL'}
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
                            <div className="host-form-helper">Indexes up to 150 videos per playlist load. INDEX + QUEUE ALL enables Auto-DJ and queues every indexed track.</div>
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
                                    <button onClick={closeSettingsSurface} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>{inAdminWorkspace ? 'Exit Admin' : 'Close'}</button>
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
                        {settingsTab === 'live_effects' && (
                            <div className="space-y-4">
                                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                                    <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Advanced Tools</div>
                                    <div className="text-xl font-bold text-white mt-1">Live Effects</div>
                                    <div className="text-sm text-zinc-400 mt-1">
                                        Special moment controls moved out of the primary queue workflow.
                                    </div>
                                </div>
                                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                                    <div className="text-xs uppercase tracking-[0.28em] text-zinc-500 mb-2">Scene Effects</div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        <button
                                            onClick={() => (room?.lightMode === 'strobe' ? updateRoom({ lightMode: 'off' }) : startBeatDrop())}
                                            className={`${STYLES.btnStd} ${room?.lightMode === 'strobe' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                        >
                                            Beat Drop
                                        </button>
                                        <button
                                            onClick={() => updateRoom({ lightMode: room?.lightMode === 'guitar' ? 'off' : 'guitar', guitarSessionId: Date.now(), guitarWinner: null, guitarVictory: null })}
                                            className={`${STYLES.btnStd} ${room?.lightMode === 'guitar' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                        >
                                            Guitar
                                        </button>
                                        <button
                                            onClick={() => updateRoom({ lightMode: room?.lightMode === 'banger' ? 'off' : 'banger' })}
                                            className={`${STYLES.btnStd} ${room?.lightMode === 'banger' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                        >
                                            Banger
                                        </button>
                                        <button
                                            onClick={() => updateRoom({ lightMode: room?.lightMode === 'ballad' ? 'off' : 'ballad' })}
                                            className={`${STYLES.btnStd} ${room?.lightMode === 'ballad' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                        >
                                            Ballad
                                        </button>
                                        <button
                                            onClick={() => (room?.lightMode === 'storm' ? stopStormSequence() : startStormSequence())}
                                            className={`${STYLES.btnStd} ${room?.lightMode === 'storm' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                        >
                                            Storm
                                        </button>
                                        <button
                                            onClick={() => updateRoom({ activeMode: room?.activeMode === 'selfie_cam' ? 'karaoke' : 'selfie_cam' })}
                                            className={`${STYLES.btnStd} ${room?.activeMode === 'selfie_cam' ? STYLES.btnHighlight : STYLES.btnNeutral}`}
                                        >
                                            Selfie Cam
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
                                    <div className="text-xs uppercase tracking-[0.28em] text-zinc-500 mb-2">Soundboard</div>
                                    <SoundboardControls
                                        soundboardOpen={true}
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
                                </div>
                            </div>
                        )}
                        {showYtIndex && (
                            <div className="fixed inset-0 z-[85] bg-[#0b0b10] text-white flex flex-col min-h-0">
                                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                                    <button onClick={() => { setShowYtIndex(false); setYtIndexFilter(''); }} className="text-zinc-400 text-sm">&larr; Back</button>
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
                                <div className="flex-1 min-h-0 px-6 pb-6 custom-scrollbar touch-scroll-y">
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
                                <div className="mb-3 text-xs text-zinc-400">
                                    Host UI version: <span className="text-cyan-300 font-semibold">v2 workspace</span>
                                </div>
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
                                                        {res.detail && <span className="text-zinc-500"> - {res.detail}</span>}
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

                                </div>
                                <div className="shrink-0 border-t border-white/10 bg-zinc-950/90 px-3 py-2 md:px-5">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="text-[11px] text-zinc-500">
                                            {hasPendingRoomSettings
                                                ? 'Unsaved settings detected. Save Room Settings before leaving Admin.'
                                                : (canSaveRoomSettings
                                                    ? 'Save persists host identity, queue policy, automation defaults, and room-level controls.'
                                                    : 'Billing and Diagnostics apply actions immediately; no extra save needed here.')}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => leaveAdminWithTarget('stage')}
                                                className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}
                                            >
                                                Go Stage
                                            </button>
                                            <button onClick={closeSettingsSurface} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>{inAdminWorkspace ? 'Exit Admin' : 'Close'}</button>
                                            {showSaveAction && (
                                                <button onClick={saveApiKeys} className={`${STYLES.btnStd} ${STYLES.btnPrimary}`}>Save Room Settings</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </HostWorkspaceShell>
                    </div>
                </div>
            )}
            {showNightSetupWizard && renderNightSetupWizard()}
            {showAiSetupGuide && (
                <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-700 rounded-2xl p-5 shadow-2xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">AI Setup</div>
                                <div className="text-xl font-bold text-white mt-1">Gemini API Key + Host AI Access</div>
                                <div className="text-sm text-zinc-400 mt-1">
                                    Use this once when onboarding new hosts or a fresh environment.
                                </div>
                            </div>
                            <button onClick={() => setShowAiSetupGuide(false)} className={`${STYLES.btnStd} ${STYLES.btnNeutral}`}>Close</button>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-zinc-200">
                            <div className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-3">
                                1. In <span className="text-white font-semibold">Billing</span>, enable AI access for the host workspace.
                            </div>
                            <div className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-3">
                                2. In Firebase Functions secrets, set <code>GEMINI_API_KEY</code>.
                            </div>
                            <div className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-3">
                                3. Deploy updated cloud function so AI calls resolve in production.
                            </div>
                            <div className="rounded-xl border border-cyan-400/20 bg-black/60 p-3">
                                <div className="text-xs uppercase tracking-[0.3em] text-cyan-300 mb-2">CLI Commands</div>
                                <pre className="text-xs text-zinc-200 whitespace-pre-wrap">firebase functions:secrets:set GEMINI_API_KEY{'\n'}firebase deploy --only functions:geminiGenerate</pre>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button onClick={copyAiSetupCommands} className={`${STYLES.btnStd} ${STYLES.btnHighlight}`}>
                                <i className="fa-solid fa-copy"></i>
                                Copy Commands
                            </button>
                            <button
                                onClick={() => {
                                    setShowAiSetupGuide(false);
                                    setSettingsTab('billing');
                                }}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary}`}
                            >
                                <i className="fa-solid fa-wallet"></i>
                                Open Billing
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {tight15Profile && (
                <div className="fixed inset-0 z-[95] bg-black/80 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-3xl p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="text-3xl">{tight15Profile.avatar || EMOJI.mic}</div>
                                <div>
                                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Singer Card</div>
                                    <div className="text-2xl font-bebas text-cyan-300">{tight15Profile.name || 'Singer'}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setTight15Profile(null)}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-xs`}
                            >
                                Close
                            </button>
                        </div>
                        <div className="mt-4 text-sm text-zinc-400">
                            Tight 15 songs ({tight15Profile.tight15?.length || 0}/{TIGHT15_MAX})
                        </div>
                        <div className="mt-3 space-y-2 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
                            {tight15Profile.tight15?.length ? (
                                tight15Profile.tight15.map((entry, idx) => (
                                    <div key={entry.id || `${entry.songTitle}_${entry.artist}_${idx}`} className="rounded-xl border border-zinc-700 bg-black/40 p-3 flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="font-bold text-white truncate">{entry.songTitle}</div>
                                            <div className="text-sm text-zinc-400 truncate">{entry.artist}</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => queueSelectedTight15ForUser(tight15Profile.roomUser, entry, 'tight15_profile_card')}
                                                disabled={tight15QueueBusyUid === tight15Profile.uid}
                                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-[10px] ${(tight15QueueBusyUid === tight15Profile.uid) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                Queue
                                            </button>
                                            <button
                                                onClick={() => sendUserMessage(tight15Profile.uid, `Tight 15 Pick: ${entry.songTitle}`, { tight15List: tight15Profile.tight15.slice(0, 3), challengeEntry: entry })}
                                                className={`${STYLES.btnStd} ${STYLES.btnHighlight} px-3 py-1 text-[10px]`}
                                            >
                                                Spotlight
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-xl border border-zinc-700 bg-black/40 p-4 text-sm text-zinc-500">
                                    No Tight 15 songs found for this singer yet.
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








