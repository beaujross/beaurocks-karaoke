/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization --
 * PublicTV is a legacy scene controller that still relies on effect-driven state sync and
 * narrowly scoped manual memoization. A safe refactor needs to be broken into smaller passes.
 */
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
import { resolveRoomUserUid } from '../../lib/gameLaunchSupport';
import { createLogger } from '../../lib/logger';
import groupChatMessages from '../../lib/chatGrouping';
import { buildPerformanceSessionPlaybackWrite } from '../../lib/performanceSessionPlayback';
import useTvVisualizerSettings from './hooks/useTvVisualizerSettings';
import {
    DEFAULT_POP_TRIVIA_ROUND_SEC,
    POP_TRIVIA_VOTE_TYPE,
    dedupeQuestionVotes,
    getActivePopTriviaQuestion
} from '../../lib/popTrivia';
import {
    createLobbyVolleyState,
    applyLobbyInteraction,
    deriveAirborneMs,
    deriveTeamworkMultiplier,
    deriveRelayObjective,
    getLobbyVolleyDecayPerSec,
    getLobbyVolleyDynamicTimeoutMs,
    getLobbyVolleyLevelMeta,
    getActiveParticipants,
    getTierTransitions,
    buildAwardPayload,
    quantizeToBeat,
    LOBBY_PLAYGROUND_ENGINE_CONSTANTS
} from './lobbyPlaygroundEngine';
import {
    deriveBangerModeState,
    deriveBalladModeState,
    deriveStrobeModeState
} from './vibeModeEngine';
import { watchQuerySnapshot } from '../../lib/firestoreWatch';
import {
    CROWD_OBJECTIVE_DEFAULT_MODE_ID,
    getCrowdObjectiveModeById,
    getCrowdObjectiveModeFromLightMode
} from '../../lib/crowdObjectiveModes';
import {
    getNextRunOfShowItem,
    getRunOfShowItemLabel,
    getRunOfShowLiveItem,
    getRunOfShowStagedItem,
    normalizeRunOfShowDirector
} from '../../lib/runOfShowDirector';
import { getSurfaceBaseHref } from '../../lib/surfaceDomains';
import {
    getVolleyOrbTvInstructionCopy,
    getVolleyOrbUltimate,
    getVolleyOrbResponsiveMetrics,
    isVolleyOrbSceneActive,
    isVolleyOrbTargetInteraction,
    normalizeVolleyOrbInteractionType,
    VOLLEY_ORB_BASE_ACTIONS,
    VOLLEY_ORB_ULTIMATES
} from '../../lib/volleyOrbUiState';
import { buildQaTvFixture } from './qaTvFixtures';
import {
    MONEYBAGS_BADGE_LABEL,
    SUPPORT_CELEBRATION_STYLES,
    normalizePurchaseCelebration,
} from '../../lib/roomMonetization';
import { buildAudienceBrandThemePalette, normalizeAudienceBrandTheme, withAudienceBrandAlpha } from '../../lib/audienceBrandTheme';

const DEFAULT_POP_TRIVIA_REVEAL_HOLD_SEC = 14;
const DEFAULT_POP_TRIVIA_CORRECT_POINTS = 40;

const buildSelfieChallengeProjectionId = (roomCodeValue = '', promptIdValue = '') => {
    const safeRoomCode = String(roomCodeValue || '').trim().toUpperCase();
    const safePromptId = String(promptIdValue || '').trim().replace(/[\\/]/g, '_').slice(0, 120);
    return safeRoomCode && safePromptId ? `${safeRoomCode}_${safePromptId}` : '';
};

const buildDoodleOkeProjectionId = (roomCodeValue = '', promptIdValue = '') => {
    const safeRoomCode = String(roomCodeValue || '').trim().toUpperCase();
    const safePromptId = String(promptIdValue || '').trim().replace(/[\\/]/g, '_').slice(0, 120);
    return safeRoomCode && safePromptId ? `${safeRoomCode}_${safePromptId}` : '';
};

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

const ROUND_WINNER_PRESENTATION = {
    gold: { label: 'Gold', medal: emoji(0x1F947), pedestalHeight: '15rem', accent: 'from-amber-300 via-yellow-200 to-amber-100' },
    silver: { label: 'Silver', medal: emoji(0x1F948), pedestalHeight: '11.5rem', accent: 'from-slate-200 via-zinc-100 to-slate-50' },
    bronze: { label: 'Bronze', medal: emoji(0x1F949), pedestalHeight: '8.5rem', accent: 'from-orange-300 via-amber-200 to-orange-100' },
};

const RoundWinnersPodiumOverlay = ({ moment = null }) => {
    const winners = Array.isArray(moment?.winners) ? moment.winners : [];
    if (!winners.length) return null;
    const prize = moment?.prize && typeof moment.prize === 'object' ? moment.prize : {};
    const prizeTitle = String(prize?.title || '').trim();
    const prizeImageUrl = String(prize?.imageUrl || '').trim();
    const metricLabel = String(moment?.leaderboardMetricLabel || '').trim();
    const winnersByPlace = winners.reduce((acc, entry) => {
        const place = String(entry?.place || '').trim().toLowerCase();
        if (place) acc[place] = entry;
        return acc;
    }, {});
    const displayOrder = ['silver', 'gold', 'bronze'];
    return (
        <div className="public-tv fixed inset-0 z-[204] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.24),rgba(0,0,0,0)_34%),radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.2),rgba(0,0,0,0)_24%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(9,9,11,0.98))] px-4 py-8 md:px-10 md:py-12 text-white">
            <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col justify-between">
                <div className="text-center">
                    <div className="text-sm font-black uppercase tracking-[0.36em] text-amber-100/80">Round Winners</div>
                    <div className="mt-3 text-5xl font-bebas tracking-[0.08em] text-white md:text-7xl">{moment?.title || 'Podium Time'}</div>
                    {moment?.subtitle ? (
                        <div className="mt-2 text-base text-cyan-100/80 md:text-xl">{moment.subtitle}</div>
                    ) : null}
                    {(prizeTitle || prizeImageUrl || metricLabel) ? (
                        <div className="mx-auto mt-5 flex w-fit max-w-full items-center gap-4 rounded-[1.5rem] border border-amber-200/25 bg-black/35 px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
                            {prizeImageUrl ? (
                                <img src={prizeImageUrl} alt={prizeTitle || 'Prize'} className="h-16 w-16 rounded-2xl border border-white/15 object-cover md:h-20 md:w-20" />
                            ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/8 text-3xl md:h-20 md:w-20">
                                    {EMOJI.gift}
                                </div>
                            )}
                            <div className="min-w-0 text-left">
                                <div className="text-xs font-black uppercase tracking-[0.28em] text-amber-100/70">Prize</div>
                                <div className="mt-1 max-w-[70vw] truncate text-2xl font-black text-white md:text-4xl">{prizeTitle || 'Door Prize'}</div>
                                {metricLabel ? <div className="mt-1 text-sm uppercase tracking-[0.22em] text-cyan-100/75">{metricLabel}</div> : null}
                            </div>
                        </div>
                    ) : null}
                </div>
                <div className="grid flex-1 items-end gap-4 md:grid-cols-3 md:gap-6">
                    {displayOrder.map((place) => {
                        const winner = winnersByPlace[place] || null;
                        const presentation = ROUND_WINNER_PRESENTATION[place];
                        const imageUrl = String(winner?.imageUrl || winner?.selfieUrl || winner?.photoUrl || '').trim();
                        return (
                            <div key={place} className={`flex flex-col items-center ${place === 'gold' ? 'md:-translate-y-8' : ''}`}>
                                <div className="relative mb-4 flex min-h-[11rem] w-full max-w-[22rem] flex-col items-center justify-end">
                                    <div className="absolute inset-x-6 bottom-8 h-16 rounded-full bg-white/10 blur-2xl" />
                                    {winner ? (
                                        <div className="relative flex flex-col items-center text-center">
                                            {imageUrl ? (
                                                <img
                                                    src={imageUrl}
                                                    alt={winner?.name || presentation.label}
                                                    className="h-32 w-32 rounded-[1.75rem] border-4 border-white/12 object-cover shadow-[0_20px_45px_rgba(0,0,0,0.42)] md:h-40 md:w-40"
                                                />
                                            ) : (
                                                <div className="flex h-32 w-32 items-center justify-center rounded-[1.75rem] border-4 border-white/12 bg-black/35 text-6xl shadow-[0_20px_45px_rgba(0,0,0,0.42)] md:h-40 md:w-40 md:text-7xl">
                                                    {winner?.avatar || presentation.medal}
                                                </div>
                                            )}
                                            <div className="mt-4 text-xl font-black uppercase tracking-[0.08em] text-white md:text-3xl">{winner?.name || presentation.label}</div>
                                            <div className="mt-1 text-2xl">{winner?.avatar || presentation.medal}</div>
                                            {winner?.statValue !== undefined && winner?.statValue !== null ? (
                                                <div className="mt-3 rounded-full border border-white/15 bg-black/35 px-4 py-1 text-sm font-black uppercase tracking-[0.2em] text-cyan-100">
                                                    {winner.statValue} {winner.statUnit || ''}
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div className="relative flex h-32 w-32 items-center justify-center rounded-[1.75rem] border border-dashed border-white/12 bg-black/20 text-5xl text-white/35 md:h-40 md:w-40 md:text-6xl">
                                            {presentation.medal}
                                        </div>
                                    )}
                                </div>
                                <div
                                    className={`flex w-full max-w-[22rem] flex-col items-center justify-center rounded-t-[2rem] border border-white/12 bg-gradient-to-b ${presentation.accent} px-5 pb-6 pt-5 text-center text-slate-950 shadow-[0_24px_50px_rgba(0,0,0,0.34)]`}
                                    style={{ minHeight: presentation.pedestalHeight }}
                                >
                                    <div className="text-sm font-black uppercase tracking-[0.34em]">{presentation.label}</div>
                                    <div className="mt-2 text-5xl">{presentation.medal}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

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
    if (key.startsWith('vote_')) return 'Vote';
    if (LOBBY_REACTION_LABELS[key]) return LOBBY_REACTION_LABELS[key];
    if (!key) return 'Reaction';
    return key
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

const isVoteReactionType = (type = '') => String(type || '').trim().toLowerCase().startsWith('vote_');

const decodeUriComponentSafe = (value = '') => {
    try {
        return decodeURIComponent(String(value || ''));
    } catch {
        return String(value || '');
    }
};

const decodeUriComponentLoop = (value = '', maxPasses = 3) => {
    let current = String(value || '');
    for (let pass = 0; pass < maxPasses; pass += 1) {
        const decoded = decodeUriComponentSafe(current);
        if (decoded === current) break;
        current = decoded;
    }
    return current;
};

const normalizeLobbyOrbPathname = (pathname = '') => {
    const rawPath = String(pathname || '').replace(/\\/g, '/');
    const segments = rawPath.split('/').map((segment, idx) => {
        if (idx === 0 && segment === '') return '';
        const decoded = decodeUriComponentLoop(segment);
        return encodeURIComponent(decoded);
    });
    const joined = segments.join('/');
    if (!joined) return '/';
    return joined.startsWith('/') ? joined : `/${joined}`;
};

const normalizeLobbyOrbSkinUrl = (rawValue = '') => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    const slashNormalized = raw.replace(/\\/g, '/');
    if (/^javascript:/i.test(slashNormalized) || /^data:/i.test(slashNormalized)) return '';
    let candidate = slashNormalized;
    const publicIndex = candidate.toLowerCase().indexOf('/public/');
    if (publicIndex >= 0) {
        const fromPublic = candidate.slice(publicIndex + '/public'.length);
        candidate = fromPublic.startsWith('/') ? fromPublic : `/${fromPublic}`;
    }
    if (/^[a-z]:\//i.test(candidate)) return '';
    if (/^https?:\/\//i.test(candidate)) {
        try {
            const parsed = new URL(candidate);
            const normalizedPathname = normalizeLobbyOrbPathname(parsed.pathname || '/');
            return `${parsed.origin}${normalizedPathname}${parsed.search}${parsed.hash}`;
        } catch {
            return '';
        }
    }
    if (candidate.startsWith('/')) {
        try {
            const parsed = new URL(candidate, 'https://beaurocks.local');
            const normalizedPathname = normalizeLobbyOrbPathname(parsed.pathname || '/');
            return `${normalizedPathname}${parsed.search}${parsed.hash}`;
        } catch {
            return '';
        }
    }
    return '';
};

const TV_EXPLORE_STORAGE_KEY = 'bross.tv.exploreProfile';

const normalizeTvExploreProfile = (value = '') => {
    const key = String(value || '').trim().toLowerCase();
    if (key === 'simple') return 'simple';
    if (key === 'cinema') return 'cinema';
    if (key === 'room' || key === 'default' || key === 'current' || key === 'host') return 'room';
    if (key === 'minimal') return 'simple';
    return '';
};

const parseTvExploreEnabled = (value = '') => {
    const key = String(value || '').trim().toLowerCase();
    return key === '1' || key === 'true' || key === 'yes' || key === 'on';
};

const getInitialTvExploreConfig = () => {
    if (typeof window === 'undefined') return { enabled: false, profile: 'room' };
    const params = new URLSearchParams(window.location.search || '');
    const enabled = parseTvExploreEnabled(params.get('tvExplore'));
    const queryProfile = normalizeTvExploreProfile(params.get('tvProfile') || params.get('tvLayout'));
    let storedProfile = '';
    try {
        storedProfile = normalizeTvExploreProfile(window.localStorage.getItem(TV_EXPLORE_STORAGE_KEY) || '');
    } catch (_) {
        storedProfile = '';
    }
    return {
        enabled,
        profile: queryProfile || storedProfile || 'room'
    };
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
    lobby_play_wave: {
        label: 'Save',
        icon: '🛟',
        accent: 'from-cyan-300/80 to-blue-400/80',
        motion: 'wave',
        aura: 'rgba(34,211,238,0.45)',
        particles: ['🛟', '🌊', '💫']
    },
    lobby_play_laser: {
        label: 'Lift',
        icon: '🚀',
        accent: 'from-fuchsia-300/80 to-cyan-300/80',
        motion: 'laser',
        aura: 'rgba(232,121,249,0.42)',
        particles: ['🚀', '✨', '💥']
    },
    lobby_play_echo: {
        label: 'Pass',
        icon: '🔁',
        accent: 'from-blue-300/80 to-indigo-400/80',
        motion: 'echo',
        aura: 'rgba(96,165,250,0.4)',
        particles: ['🔁', '🌊', '💫']
    },
    lobby_play_confetti: {
        label: 'Burst',
        icon: '💥',
        accent: 'from-pink-300/80 to-yellow-300/80',
        motion: 'confetti',
        aura: 'rgba(244,114,182,0.38)',
        particles: ['💥', '🎉', '🌟']
    },
    lobby_play_ultimate_feather: {
        label: 'Float',
        icon: '🪶',
        accent: 'from-emerald-300/80 to-cyan-300/80',
        motion: 'wave',
        aura: 'rgba(74,222,128,0.42)',
        particles: ['🪶', '💨']
    },
    lobby_play_ultimate_lens: {
        label: 'Shrink',
        icon: '🔍',
        accent: 'from-amber-300/80 to-yellow-200/80',
        motion: 'echo',
        aura: 'rgba(251,191,36,0.36)',
        particles: ['🔍', '✨']
    },
    lobby_play_ultimate_magnet: {
        label: 'Catch-All',
        icon: '🧲',
        accent: 'from-fuchsia-300/80 to-violet-300/80',
        motion: 'pulse_bloom',
        aura: 'rgba(217,70,239,0.38)',
        particles: ['🧲', '⚡']
    },
    lobby_play_ultimate_rocket: {
        label: 'Bounce',
        icon: '🚀',
        accent: 'from-rose-300/80 to-orange-300/80',
        motion: 'spark_shower_bridge',
        aura: 'rgba(251,113,133,0.4)',
        particles: ['🚀', '💥']
    }
};

const LOBBY_PLAY_GUIDE = VOLLEY_ORB_BASE_ACTIONS.map((item) => ({
    id: item.id,
    action: item.label,
    detail: item.cue,
    timing: item.shortCue
}));

const getLobbyPlayEffect = (type = '') => {
    const key = String(type || '').trim().toLowerCase();
    return LOBBY_PLAY_EFFECTS[key] || null;
};

const normalizeLobbyPlayInteractionType = normalizeVolleyOrbInteractionType;

const getLobbyPlayEffectByInteractionType = (interactionType = '') => {
    const key = normalizeLobbyPlayInteractionType(interactionType);
    if (!key) return null;
    return getLobbyPlayEffect(`lobby_play_${key}`);
};

const getReactionScoreContribution = (reaction = {}, fallbackMultiplier = 1) => {
    const type = String(reaction?.type || '').trim().toLowerCase();
    if (!type || type.startsWith('vote_')) return 0;
    const unitCost = Number(REACTION_COSTS[type] || 0);
    if (!Number.isFinite(unitCost) || unitCost <= 0) return 0;
    const rawCount = Number(reaction?.count || 1);
    const count = Math.max(1, Math.floor(Number.isFinite(rawCount) ? rawCount : 1));
    const rawMultiplier = Number(reaction?.multiplier);
    const multiplier = Number.isFinite(rawMultiplier) && rawMultiplier > 0
        ? rawMultiplier
        : Math.max(1, Number(fallbackMultiplier || 1));
    return Math.max(0, unitCost * count * multiplier);
};

const getLobbyScreenFxDurationMs = (motion = 'wave') => {
    if (motion === 'laser') return 1900;
    if (motion === 'confetti') return 2600;
    if (motion === 'echo') return 2200;
    if (motion === 'prism_sweep_link') return 2200;
    if (motion === 'ripple_tunnel') return 2400;
    if (motion === 'spark_shower_bridge') return 2500;
    if (motion === 'pulse_bloom') return 2300;
    return 2300;
};

const LOBBY_ANCHOR_BASE = {
    wave: { x: 34, y: 43 },
    laser: { x: 62, y: 42 },
    echo: { x: 42, y: 61 },
    confetti: { x: 59, y: 62 }
};

const getLobbyInteractionAnchor = (interactionType = '', seed = 1, index = 0) => {
    const type = normalizeLobbyPlayInteractionType(interactionType) || 'wave';
    const base = LOBBY_ANCHOR_BASE[type] || LOBBY_ANCHOR_BASE.wave;
    const orbit = 2 + (index % 3) * 1.3;
    const jitterX = (seededUnit(seed + (index * 5)) - 0.5) * orbit * 2;
    const jitterY = (seededUnit(seed + 11 + (index * 7)) - 0.5) * orbit * 1.65;
    return {
        x: Math.max(22, Math.min(78, base.x + jitterX)),
        y: Math.max(24, Math.min(78, base.y + jitterY))
    };
};

const quantizeLobbyStartTime = ({ now, micVolume, visualizerEnabled }) => {
    const hasRhythmSignal = !!visualizerEnabled && Number(micVolume || 0) >= 10;
    if (!hasRhythmSignal) return Math.round(now);
    const beatMs = Math.max(360, Math.min(760, 690 - (Number(micVolume || 0) * 2.8)));
    return quantizeToBeat(now, beatMs, 130);
};

const parseAwardFailureCode = (error = null) => {
    const raw = String(error?.code || error?.message || '').toLowerCase();
    if (!raw) return '';
    if (raw.includes('permission-denied')) return 'permission-denied';
    if (raw.includes('unauthenticated')) return 'unauthenticated';
    if (raw.includes('failed-precondition')) return 'failed-precondition';
    return raw;
};

const LOBBY_PLAYGROUND_REWARD_SOURCE = 'lobby_playground';
const LOBBY_AWARD_VISUAL_WINDOW_MS = 4200;
const LOBBY_COMBO_WINDOW_MS = 4600;
const LOBBY_ASSIST_WINDOW_MS = 4200;
const LOBBY_LINK_WINDOW_MS = 2500;
const LOBBY_BURST_WINDOW_MS = 3000;
const LOBBY_SCREEN_FX_WINDOW_MS = 3200;
const LOBBY_SCREEN_FX_CAP = 5;
const LOBBY_BURST_CAP = 8;
const LOBBY_LINK_CAP = 6;
const LOBBY_COMBO_CAP = 6;
const LOBBY_ASSIST_CAP = 4;
const LOBBY_TIER_CHIP_CAP = 8;
const LOBBY_ORB_EVENT_CAP = 14;
const LOBBY_PARTICLE_MAX = 10;
const LOBBY_ORB_MIN_TOP_PCT = 24;
const LOBBY_GROUND_LINE_TOP_PCT = 92;
const TV_REACTION_VISIBILITY_MS = 9200;
const FEATURED_REACTION_SPOTLIGHT_MS = 4200;
const SELFIE_ARRIVAL_SPOTLIGHT_MS = 6800;
const SELFIE_RECENT_BADGE_MS = 18000;
const DOODLE_RECENT_BADGE_MS = 18000;
const GUITAR_SYNC_DECAY_PER_SECOND = 14;
const GUITAR_SYNC_GAIN_PER_HIT = 11;
const GUITAR_SYNC_GROUND_THRESHOLD = 12;
const GUITAR_SYNC_ACTIVE_WINDOW_MS = 3400;
const GUITAR_SYNC_BASE_BEAT_MS = 620;
const GUITAR_SYNC_BEAT_WINDOW_MS = 130;
const GUITAR_SYNC_EVENT_WINDOW_MS = 12000;

const getLobbyTierDefinition = (tierNumber = 0) => (
    (LOBBY_PLAYGROUND_ENGINE_CONSTANTS?.TIER_DEFINITIONS || []).find((entry) => Number(entry?.tier || 0) === Number(tierNumber || 0)) || null
);

const clampLobby = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));

const createGuitarSyncState = () => ({
    meter: 0,
    streakMs: 0,
    airtimeMs: 0,
    drops: 0,
    cadenceScore: 0,
    perfectHits: 0,
    totalHits: 0,
    lastHitAt: 0,
    recentHits: []
});

const getGuitarBeatMs = ({ micVolume = 0, visualizerEnabled = false } = {}) => {
    const hasRhythmSignal = !!visualizerEnabled && Number(micVolume || 0) >= 10;
    if (!hasRhythmSignal) return GUITAR_SYNC_BASE_BEAT_MS;
    return Math.max(420, Math.min(760, 700 - (Number(micVolume || 0) * 2.6)));
};

const getBeatOffsetMs = (timestampMs, beatMs) => {
    const safeBeatMs = Math.max(260, Number(beatMs || GUITAR_SYNC_BASE_BEAT_MS));
    const mod = ((Number(timestampMs || 0) % safeBeatMs) + safeBeatMs) % safeBeatMs;
    return Math.min(mod, safeBeatMs - mod);
};

const shouldDisableLobbyMotion = (reduceMotion) => !!reduceMotion;

const toEpochMs = (ts) => {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts?.toMillis === 'function') return ts.toMillis();
    if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
    return 0;
};

const hashTvMotionSeed = (value = '') => {
    const source = String(value || '');
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
        hash = ((hash << 5) - hash) + source.charCodeAt(index);
        hash |= 0;
    }
    return Math.abs(hash);
};

const getTvReactionMotionSpec = ({ type = '', id = '', index = 0 } = {}) => {
    const key = String(type || '').trim().toLowerCase();
    const seed = hashTvMotionSeed(`${key}:${id}:${index}`);
    const pick = (items = []) => items[seed % items.length];
    const base = {
        variant: 'drift-right',
        durationMs: 8600 + (seed % 1400),
        driftX: 24 + (seed % 44),
        riseY: 88 + (seed % 90),
        rotateDeg: -6 + (seed % 13),
        scaleBoost: 1 + ((seed % 7) * 0.018),
    };
    if (key === 'clap') {
        return { ...base, variant: pick(['bounce', 'hover']), durationMs: 9400 + (seed % 1200), driftX: 8 + (seed % 12), riseY: 28 + (seed % 20), rotateDeg: -4 + (seed % 9) };
    }
    if (key === 'heart') {
        return { ...base, variant: 'hover', durationMs: 9800 + (seed % 1200), driftX: 10 + (seed % 16), riseY: 36 + (seed % 26), rotateDeg: -8 + (seed % 17) };
    }
    if (key === 'drink') {
        return { ...base, variant: pick(['drift-left', 'drift-right']), durationMs: 9000 + (seed % 1200), driftX: 30 + (seed % 36), riseY: 54 + (seed % 34), rotateDeg: -10 + (seed % 21) };
    }
    if (key === 'money') {
        return { ...base, variant: pick(['drift-left', 'sweep']), durationMs: 9600 + (seed % 1000), driftX: 46 + (seed % 46), riseY: 48 + (seed % 28), rotateDeg: -14 + (seed % 29) };
    }
    if (key === 'rocket') {
        return { ...base, variant: 'sweep', durationMs: 8200 + (seed % 900), driftX: 72 + (seed % 56), riseY: 108 + (seed % 46), rotateDeg: -18 + (seed % 37), scaleBoost: 1.08 + ((seed % 5) * 0.02) };
    }
    if (key === 'diamond' || key === 'crown') {
        return { ...base, variant: 'hover', durationMs: 10200 + (seed % 1200), driftX: 14 + (seed % 20), riseY: 42 + (seed % 24), rotateDeg: -6 + (seed % 13), scaleBoost: 1.04 + ((seed % 5) * 0.018) };
    }
    if (key === 'fire') {
        return { ...base, variant: pick(['bounce', 'drift-right']), durationMs: 8800 + (seed % 1000), driftX: 20 + (seed % 24), riseY: 102 + (seed % 44), rotateDeg: -8 + (seed % 17), scaleBoost: 1.08 + ((seed % 5) * 0.02) };
    }
    return { ...base, variant: pick(['drift-left', 'drift-right', 'hover']) };
};

const getLobbyEventTimestampMs = (event) => {
    const explicit = Number(event?.timestampMs || event?.createdAtMs || 0);
    if (explicit > 0) return explicit;
    const derived = toEpochMs(event?.timestamp);
    if (derived > 0) return derived;
    return nowMs();
};

const getLobbyContributionAlpha = (weight = 1) => clampLobby(0.25 + (Number(weight || 0) * 0.65), 0.25, 1);

const getLobbyOrbMeterValue = (state = null, now = nowMs()) => {
    if (!state) return 0;
    const elapsed = Math.max(0, now - Number(state.lastInteractionAtMs || now));
    const liveEnergy = Math.max(0, Number(state.energy || 0) - ((elapsed / 1000) * getLobbyVolleyDecayPerSec(state, now)));
    return clampLobby(liveEnergy, 0, 100);
};

const getLobbyOrbTopPct = ({
    hasStreak = false,
    streakDecayPct = 0,
    groundTopPct = LOBBY_GROUND_LINE_TOP_PCT,
    restCenterTopPct = null
}) => {
    const safeGroundTopPct = clampLobby(groundTopPct, LOBBY_ORB_MIN_TOP_PCT + 8, 99);
    const resolvedRestCenterTopPct = clampLobby(
        Number(restCenterTopPct ?? (safeGroundTopPct - 8)),
        LOBBY_ORB_MIN_TOP_PCT,
        safeGroundTopPct - 1
    );
    if (!hasStreak) return resolvedRestCenterTopPct;
    const decay = clampLobby(streakDecayPct, 0, 100);
    const fallProgress = 1 - (decay / 100);
    const maxTravel = Math.max(0, resolvedRestCenterTopPct - LOBBY_ORB_MIN_TOP_PCT);
    return clampLobby(
        LOBBY_ORB_MIN_TOP_PCT + (fallProgress * maxTravel),
        LOBBY_ORB_MIN_TOP_PCT,
        resolvedRestCenterTopPct
    );
};

const LOBBY_ALTITUDE_CAMERA_TARGET_TOP_PCT = 52;
const LOBBY_ALTITUDE_MAX_CAMERA_SHIFT_PCT = 42;
const LOBBY_ALTITUDE_MAX_TRACKED_FT = 140;
const LOBBY_ALTITUDE_MILESTONES = Object.freeze([
    Object.freeze({ id: 'roofbreak', minFt: 24, label: 'Roof Break', pointsBudget: 16, maxPointsPerUser: 6 }),
    Object.freeze({ id: 'skyline', minFt: 48, label: 'Skyline', pointsBudget: 24, maxPointsPerUser: 9 }),
    Object.freeze({ id: 'cloudline', minFt: 72, label: 'Cloudline', pointsBudget: 36, maxPointsPerUser: 12 }),
    Object.freeze({ id: 'stratosphere', minFt: 96, label: 'Stratosphere', pointsBudget: 52, maxPointsPerUser: 16 })
]);

const getLobbyVolleyAltitudeState = ({
    hasActiveVolley = false,
    state = null,
    now = nowMs(),
    energy = 0,
    levelSpeed = 1,
    baseTopPct = LOBBY_GROUND_LINE_TOP_PCT,
    restCenterTopPct = LOBBY_GROUND_LINE_TOP_PCT,
    shrinkActive = false
} = {}) => {
    if (!hasActiveVolley || !state) {
        return {
            climbPct: 0,
            altitudeFt: 0,
            worldTopPct: baseTopPct,
            cameraShiftPct: 0,
            renderTopPct: clampLobby(baseTopPct, 0, restCenterTopPct)
        };
    }
    const airborneMs = deriveAirborneMs(state, now);
    const teamworkMultiplier = deriveTeamworkMultiplier(state, now);
    const streakCount = Math.max(0, Number(state?.streakCount || 0));
    const energyNorm = clampLobby(energy, 0, 100) / 100;
    const climbPct = clampLobby(
        (Math.max(0, airborneMs - 1200) / 1000) * (0.86 + (energyNorm * 0.44))
        + (Math.max(0, teamworkMultiplier - 1) * 4.9)
        + (Math.max(0, streakCount - 4) * 0.46)
        + (energyNorm * 6.5)
        + (Math.max(0, Number(levelSpeed || 1) - 1) * 10)
        + (shrinkActive ? 4 : 0),
        0,
        64
    );
    const climbProgress = clampLobby(climbPct / 64, 0, 1);
    const worldTopPct = baseTopPct - climbPct;
    const desiredVisibleTopPct = clampLobby(
        LOBBY_ALTITUDE_CAMERA_TARGET_TOP_PCT + ((1 - energyNorm) * 4.5) - (climbProgress * 3.5),
        47,
        58
    );
    const proactiveCameraShiftPct = Math.max(0, climbPct - 8) * 0.15;
    const cameraShiftPct = clampLobby(
        Math.max(0, desiredVisibleTopPct - worldTopPct) + proactiveCameraShiftPct,
        0,
        LOBBY_ALTITUDE_MAX_CAMERA_SHIFT_PCT
    );
    const altitudeFt = Math.round(Math.min(LOBBY_ALTITUDE_MAX_TRACKED_FT, climbPct * 2.3));
    return {
        climbPct,
        altitudeFt,
        worldTopPct,
        cameraShiftPct,
        renderTopPct: clampLobby(worldTopPct + cameraShiftPct, 5, restCenterTopPct)
    };
};

const buildLobbyAltitudeAwardPayloads = ({
    state = null,
    peakAltitudeFt = 0,
    now = nowMs()
} = {}) => {
    const safeState = state || createLobbyVolleyState();
    const streakId = Number(safeState?.streakId || 0);
    const paidAltitudeKeys = { ...(safeState?.paidAltitudeKeys || {}) };
    const payloads = [];
    const activeParticipants = getActiveParticipants(safeState, now)
        .filter((participant) => !!participant?.uid)
        .slice(0, 6);

    LOBBY_ALTITUDE_MILESTONES.forEach((milestone) => {
        if (peakAltitudeFt < Number(milestone.minFt || 0)) return;
        const awardKey = `lobby_altitude_${streakId}_${milestone.id}`;
        if (paidAltitudeKeys[awardKey]) return;
        paidAltitudeKeys[awardKey] = true;

        const awards = [];
        let remainingBudget = Math.max(0, Number(milestone.pointsBudget || 0));
        activeParticipants.forEach((participant, idx) => {
            const slotsLeft = Math.max(1, activeParticipants.length - idx);
            const points = Math.min(
                Math.max(1, Math.floor(remainingBudget / slotsLeft)),
                Math.max(0, Number(milestone.maxPointsPerUser || 0))
            );
            if (points > 0) {
                awards.push({ uid: participant.uid, points });
                remainingBudget = Math.max(0, remainingBudget - points);
            }
        });

        payloads.push({
            milestone,
            awardKey,
            awards,
            visualOnly: awards.length === 0
        });
    });

    return {
        paidAltitudeKeys,
        payloads
    };
};

const getLobbyBurstParticleCount = ({ reduceMotion = false, loadFactor = 0 }) => {
    const maxCount = reduceMotion ? 8 : 14;
    const loadedCount = maxCount - Math.floor(clampLobby(loadFactor, 0, 1.5) * (reduceMotion ? 4 : 7));
    return clampLobby(loadedCount, reduceMotion ? 3 : 5, maxCount);
};

const getLobbyTrailLength = ({ reduceMotion = false, loadFactor = 0 }) => {
    const base = reduceMotion ? 1 : 2;
    return clampLobby(base - Math.floor(clampLobby(loadFactor, 0, 1.5)), 0, base);
};

const getLobbyRetentionMs = ({ reduceMotion = false, loadFactor = 0, defaultMs = 2400 }) => {
    const reduction = Math.floor(clampLobby(loadFactor, 0, 1.5) * (reduceMotion ? 280 : 420));
    return clampLobby(defaultMs - reduction, 1200, defaultMs);
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
const HOW_TO_PLAY_SLIDE_MS = 7000;
const HOW_TO_PLAY_EXIT_BUFFER_MS = 2500;
const HOW_TO_PLAY_AUTO_CLOSE_MS = ((HOW_TO_PLAY.sections || []).length * HOW_TO_PLAY_SLIDE_MS) + HOW_TO_PLAY_EXIT_BUFFER_MS;
const GAME_PREVIEW_AUTO_HIDE_MS = 20000;
const tvLogger = createLogger('PublicTV');
const seededUnit = (seed) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
};

const RUN_OF_SHOW_TAKEOVER_THEME_COLOR_ORDERS = Object.freeze({
    cyan: ['primaryColor', 'secondaryColor', 'accentColor'],
    pink: ['secondaryColor', 'primaryColor', 'accentColor'],
    amber: ['accentColor', 'secondaryColor', 'primaryColor'],
    emerald: ['primaryColor', 'accentColor', 'secondaryColor'],
    fuchsia: ['secondaryColor', 'accentColor', 'primaryColor'],
    violet: ['accentColor', 'primaryColor', 'secondaryColor'],
});

const getRunOfShowTakeoverTheme = (accentTheme = 'cyan', brandTheme = null) => {
    const normalizedBrandTheme = normalizeAudienceBrandTheme(brandTheme || {});
    const key = String(accentTheme || '').trim().toLowerCase();
    const order = RUN_OF_SHOW_TAKEOVER_THEME_COLOR_ORDERS[key] || RUN_OF_SHOW_TAKEOVER_THEME_COLOR_ORDERS.cyan;
    const [primaryColor, secondaryColor, accentColor] = order.map((field) => normalizedBrandTheme[field] || normalizedBrandTheme.primaryColor);
    return {
        primaryColor,
        secondaryColor,
        accentColor,
        chipStyle: {
            borderColor: withAudienceBrandAlpha(primaryColor, 0.4),
            backgroundColor: withAudienceBrandAlpha(primaryColor, 0.14),
            color: '#F8FAFC',
            boxShadow: `0 0 32px ${withAudienceBrandAlpha(primaryColor, 0.14)}`,
        },
        lineStyle: {
            backgroundImage: `linear-gradient(90deg, ${withAudienceBrandAlpha(primaryColor, 0.72)} 0%, ${withAudienceBrandAlpha(secondaryColor, 0.54)} 55%, rgba(255,255,255,0) 100%)`,
        },
        headlineStyle: {
            backgroundImage: `linear-gradient(90deg, ${secondaryColor} 0%, ${primaryColor} 52%, ${accentColor} 100%)`,
        },
        spotlightStyle: {
            background: `radial-gradient(circle, ${withAudienceBrandAlpha(primaryColor, 0.28)} 0%, ${withAudienceBrandAlpha(secondaryColor, 0.14)} 42%, transparent 72%)`,
        },
        progressStyle: {
            backgroundImage: `linear-gradient(90deg, ${secondaryColor} 0%, ${primaryColor} 50%, ${accentColor} 100%)`,
        },
    };
};

const RUN_OF_SHOW_TAKEOVER_SCENES = {
    intro: {
        eyebrow: 'Show Opening',
        shellClass: 'bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_42%),radial-gradient(circle_at_82%_18%,rgba(250,204,21,0.18),transparent_30%),linear-gradient(145deg,#020617_12%,#071225_52%,#12071f_100%)]',
        orbClass: 'bg-[radial-gradient(circle,rgba(250,204,21,0.3),transparent_66%)]',
        stripeClass: 'from-white/14 via-cyan-200/6 to-transparent',
        detailLabel: 'Cue'
    },
    announcement: {
        eyebrow: 'House Announcement',
        shellClass: 'bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_44%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.18),transparent_44%),linear-gradient(135deg,#04070c_10%,#0f172a_58%,#170b1f_100%)]',
        orbClass: 'bg-[radial-gradient(circle,rgba(34,211,238,0.26),transparent_66%)]',
        stripeClass: 'from-white/12 via-cyan-200/7 to-transparent',
        detailLabel: 'Control'
    },
    performance_intro: {
        eyebrow: 'Singer Transition',
        shellClass: 'bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_44%),radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.18),transparent_32%),linear-gradient(145deg,#09090b_10%,#140b1f_54%,#081825_100%)]',
        orbClass: 'bg-[radial-gradient(circle,rgba(244,114,182,0.28),transparent_66%)]',
        stripeClass: 'from-white/12 via-fuchsia-200/8 to-transparent',
        detailLabel: 'Mic Swap'
    },
    closing: {
        eyebrow: 'Closing Moment',
        shellClass: 'bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.16),transparent_40%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.16),transparent_42%),linear-gradient(145deg,#09090b_5%,#111827_48%,#1f1329_100%)]',
        orbClass: 'bg-[radial-gradient(circle,rgba(236,72,153,0.28),transparent_68%)]',
        stripeClass: 'from-white/12 via-amber-200/8 to-transparent',
        detailLabel: 'Finale'
    },
    trivia_break: {
        eyebrow: 'Trivia Break',
        shellClass: 'bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_44%),radial-gradient(circle_at_82%_16%,rgba(34,197,94,0.14),transparent_28%),linear-gradient(145deg,#020617_10%,#10213f_52%,#071a2a_100%)]',
        orbClass: 'bg-[radial-gradient(circle,rgba(59,130,246,0.28),transparent_66%)]',
        stripeClass: 'from-white/12 via-blue-200/8 to-transparent',
        detailLabel: 'Prompt'
    },
    would_you_rather_break: {
        eyebrow: 'Would You Rather',
        shellClass: 'bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_44%),radial-gradient(circle_at_82%_16%,rgba(34,211,238,0.16),transparent_30%),linear-gradient(145deg,#11081a_10%,#1f1030_56%,#081825_100%)]',
        orbClass: 'bg-[radial-gradient(circle,rgba(236,72,153,0.3),transparent_66%)]',
        stripeClass: 'from-white/12 via-fuchsia-200/8 to-transparent',
        detailLabel: 'Debate'
    },
    game_break: {
        eyebrow: 'Game Break',
        shellClass: 'bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_40%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.16),transparent_42%),linear-gradient(145deg,#09090b_8%,#172033_54%,#08111f_100%)]',
        orbClass: 'bg-[radial-gradient(circle,rgba(251,191,36,0.28),transparent_66%)]',
        stripeClass: 'from-white/12 via-amber-200/8 to-transparent',
        detailLabel: 'Challenge'
    },
    performance: {
        eyebrow: 'Performance Block',
        shellClass: 'bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.16),transparent_42%),radial-gradient(circle_at_80%_18%,rgba(34,211,238,0.16),transparent_28%),linear-gradient(145deg,#09090b_8%,#18181b_50%,#111827_100%)]',
        orbClass: 'bg-[radial-gradient(circle,rgba(244,114,182,0.26),transparent_66%)]',
        stripeClass: 'from-white/12 via-pink-200/8 to-transparent',
        detailLabel: 'Set'
    },
    default: {
        eyebrow: 'Run Of Show',
        shellClass: 'bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_44%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.14),transparent_44%),linear-gradient(145deg,#05070a_10%,#101827_52%,#0b1020_100%)]',
        orbClass: 'bg-[radial-gradient(circle,rgba(34,211,238,0.24),transparent_66%)]',
        stripeClass: 'from-white/12 via-cyan-200/6 to-transparent',
        detailLabel: 'Details'
    }
};

const getRunOfShowTakeoverScene = (scene = '') => {
    const key = String(scene || '').trim().toLowerCase();
    return RUN_OF_SHOW_TAKEOVER_SCENES[key] || RUN_OF_SHOW_TAKEOVER_SCENES.default;
};

const formatRunOfShowCountdown = (remainingMs = 0) => {
    const safeMs = Math.max(0, Number(remainingMs || 0));
    const totalSeconds = Math.ceil(safeMs / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
};

const formatRunOfShowRemainingTotal = (remainingMs = 0) => {
    const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
    if (!totalSeconds) return '0m';
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    if (mins > 0) return `${mins}m`;
    return `${totalSeconds}s`;
};

const toTitleCaseWords = (value = '') => String(value || '')
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const TakeoverSoundtrackPlayer = ({ soundtrack = null, nowValue = 0 }) => {
    const sourceType = String(soundtrack?.sourceType || '').trim().toLowerCase();
    const mediaUrl = String(soundtrack?.mediaUrl || '').trim();
    const youtubeId = String(soundtrack?.youtubeId || '').trim();
    const startedAtMs = Math.max(0, Number(soundtrack?.startedAtMs || 0));
    const pageOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://beau.rocks';
    const elapsedSec = startedAtMs > 0 ? Math.max(0, Math.floor((Number(nowValue || nowMs()) - startedAtMs) / 1000)) : 0;
    const youtubeSrc = useMemo(() => {
        if (sourceType !== 'youtube' || !youtubeId) return '';
        return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&controls=0&start=${elapsedSec}&enablejsapi=1&playsinline=1&origin=${pageOrigin}&rel=0&modestbranding=1`;
    }, [elapsedSec, pageOrigin, sourceType, youtubeId]);

    if (sourceType === 'youtube' && youtubeSrc) {
        return (
            <iframe
                key={`${youtubeId}_${startedAtMs || 0}`}
                title="Takeover soundtrack"
                src={youtubeSrc}
                allow="autoplay; encrypted-media"
                className="pointer-events-none absolute left-[-9999px] top-[-9999px] h-px w-px opacity-0"
            />
        );
    }

    if (!mediaUrl) return null;

    if (/\.(mp3|m4a|aac|wav|ogg)$/i.test(mediaUrl)) {
        return <audio key={`${mediaUrl}_${startedAtMs || 0}`} src={mediaUrl} autoPlay className="hidden" />;
    }

    return (
        <video
            key={`${mediaUrl}_${startedAtMs || 0}`}
            src={mediaUrl}
            autoPlay
            playsInline
            className="pointer-events-none absolute left-[-9999px] top-[-9999px] h-px w-px opacity-0"
        />
    );
};

const RunOfShowTakeoverOverlay = ({
    overlay = {},
    roomCode = '',
    logoUrl = '',
    brandTheme = null,
    zClass = 'z-[195]',
    preview = false,
    nowValue = 0
}) => {
    const theme = getRunOfShowTakeoverTheme(overlay?.accentTheme || 'cyan', brandTheme);
    const sceneKey = String(overlay?.takeoverScene || overlay?.type || 'default').trim().toLowerCase();
    const scene = getRunOfShowTakeoverScene(sceneKey);
    const overlayType = String(overlay?.type || '').trim().toLowerCase();
    const showAnnouncementBurst = overlayType === 'announcement' || sceneKey === 'announcement';
    const headline = String(overlay?.headline || overlay?.title || 'Run Of Show').trim() || 'Run Of Show';
    const subhead = String(overlay?.subhead || '').trim();
    const summary = String(overlay?.summary || '').trim();
    const soundtrack = overlay?.soundtrack && typeof overlay.soundtrack === 'object' ? overlay.soundtrack : null;
    const soundtrackLabel = String(soundtrack?.label || '').trim();
    const options = Array.isArray(overlay?.options) ? overlay.options.filter(Boolean).slice(0, 4) : [];
    const modeKey = String(overlay?.modeKey || '').trim();
    const durationSec = Math.max(0, Number(overlay?.durationSec || 0));
    const startedAtMs = Math.max(0, Number(overlay?.startedAtMs || 0));
    const endsAtMs = startedAtMs && durationSec ? startedAtMs + (durationSec * 1000) : 0;
    const remainingMs = endsAtMs ? Math.max(0, endsAtMs - Number(nowValue || nowMs())) : 0;
    const progressPct = endsAtMs && durationSec
        ? clampPct((remainingMs / (durationSec * 1000)) * 100)
        : 0;
    const roomLabel = String(roomCode || '').trim() ? `Room ${roomCode}` : 'Room Live';
    const brandLogoUrl = String(logoUrl || ASSETS.logo || '').trim() || ASSETS.logo;
    const detailModeLabel = preview ? 'TV Preview' : scene.detailLabel;
    const burstVars = useMemo(() => {
        const palette = buildAudienceBrandThemePalette({
            primaryColor: theme.primaryColor,
            secondaryColor: theme.secondaryColor,
            accentColor: theme.accentColor,
        });
        return {
            '--audience-brand-primary-rgb': palette.rootStyle['--audience-brand-primary-rgb'],
            '--audience-brand-secondary-rgb': palette.rootStyle['--audience-brand-secondary-rgb'],
            '--audience-brand-accent-rgb': palette.rootStyle['--audience-brand-accent-rgb'],
        };
    }, [theme.accentColor, theme.primaryColor, theme.secondaryColor]);
    const metaChips = [
        roomLabel,
        modeKey ? toTitleCaseWords(modeKey) : detailModeLabel,
    ].filter(Boolean);
    const bodyCopy = summary || subhead;
    const mediaScene = overlay?.mediaScene && typeof overlay.mediaScene === 'object' ? overlay.mediaScene : null;
    const mediaSceneUrl = String(mediaScene?.mediaUrl || '').trim();
    const mediaSceneType = String(mediaScene?.mediaType || '').trim().toLowerCase() === 'video' ? 'video' : 'image';
    if (sceneKey === 'media_scene' && mediaSceneUrl) {
        return (
            <div
                data-tv-takeover-scene={sceneKey}
                data-tv-room-code={String(roomCode || '').trim().toUpperCase()}
                className={`public-tv fixed inset-0 ${zClass} overflow-hidden bg-black text-white`}
            >
                {mediaSceneType === 'video' ? (
                    <video
                        key={`${mediaSceneUrl}_${startedAtMs || 0}`}
                        src={mediaSceneUrl}
                        autoPlay
                        playsInline
                        className="h-full w-full object-contain"
                    />
                ) : (
                    <img src={mediaSceneUrl} alt={headline || 'Scene'} className="h-full w-full object-contain" />
                )}
                <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 via-black/18 to-transparent px-8 py-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-100/75">Media Scene</div>
                            {headline ? <div className="mt-1 text-3xl font-bebas tracking-[0.08em] text-white md:text-5xl">{headline}</div> : null}
                        </div>
                        {remainingMs > 0 ? (
                            <div className="rounded-full border border-white/15 bg-black/45 px-5 py-2.5 text-sm font-black uppercase tracking-[0.22em] text-white/85">
                                {formatRunOfShowCountdown(remainingMs)}
                            </div>
                        ) : null}
                    </div>
                </div>
                {remainingMs > 0 ? (
                    <div className="absolute inset-x-8 bottom-8 h-3 overflow-hidden rounded-full border border-white/10 bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-pink-300" style={{ width: `${progressPct}%` }}></div>
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <div
            data-tv-takeover-scene={sceneKey}
            data-tv-room-code={String(roomCode || '').trim().toUpperCase()}
            data-tv-brand-logo={brandLogoUrl}
            className={`public-tv fixed inset-0 ${zClass} overflow-hidden ${scene.shellClass} text-white`}
            style={overlay?.backgroundMedia ? {
                backgroundImage: `linear-gradient(rgba(2,6,23,0.7), rgba(2,6,23,0.88)), url(${overlay.backgroundMedia})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            } : undefined}
        >
            <div className={`absolute -left-[12vw] top-[-12vh] h-[46vw] w-[46vw] rounded-full blur-3xl ${scene.orbClass}`}></div>
            <div className="absolute right-[-10vw] top-[20vh] h-[34vw] w-[34vw] rounded-full blur-3xl" style={theme.spotlightStyle}></div>
            {showAnnouncementBurst ? (
                <div
                    className="logo-rays join-rays tv-takeover-announcement-burst"
                    style={{
                        ...burstVars,
                        '--ray-inner': '280px',
                        left: '43%',
                        top: '52%',
                    }}
                ></div>
            ) : null}
            <div className="tv-takeover-ray-field"></div>
            <div className="tv-takeover-ray-field tv-takeover-ray-field-alt"></div>
            <div className={`absolute inset-0 bg-gradient-to-br ${scene.stripeClass}`}></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.08)_45%,rgba(2,6,23,0.55)_100%)]"></div>
            <div className="absolute inset-0 opacity-[0.14]" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
                backgroundSize: '36px 36px'
            }}></div>
            <TakeoverSoundtrackPlayer soundtrack={soundtrack} nowValue={nowValue} />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"></div>
            <div className="absolute right-8 top-8 opacity-[0.12] md:right-14 md:top-12">
                <img src={brandLogoUrl} alt="" className="h-auto w-[clamp(220px,20vw,360px)] object-contain" />
            </div>
            <div className="relative z-10 flex h-full flex-col justify-between gap-8 px-8 py-8 md:px-14 md:py-12">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3 rounded-full border border-white/12 bg-black/24 px-4 py-2.5 backdrop-blur">
                            <img src={brandLogoUrl} alt="Room brand" className="h-11 w-11 rounded-2xl object-contain" />
                            <span className="text-sm font-black uppercase tracking-[0.28em] text-white/80">{roomLabel}</span>
                        </div>
                        <div
                            className={`rounded-full border px-6 py-3.5 text-[0.95rem] font-black uppercase tracking-[0.3em] ${preview ? 'border-violet-300/35 bg-violet-500/14 text-violet-100' : ''}`}
                            style={preview ? undefined : theme.chipStyle}
                        >
                            {preview ? 'Preview Mode' : scene.eyebrow}
                        </div>
                        {soundtrackLabel ? (
                            <div className="rounded-full border border-white/12 bg-black/24 px-5 py-3 text-sm font-black uppercase tracking-[0.22em] text-white/72 backdrop-blur">
                                Now Playing {soundtrackLabel}
                            </div>
                        ) : null}
                    </div>
                    {remainingMs > 0 ? (
                        <div className="rounded-full border border-white/10 bg-black/25 px-6 py-3.5 text-[0.95rem] font-black uppercase tracking-[0.24em] text-white/80">
                            {preview ? 'Preview ' : 'Remaining '} {formatRunOfShowCountdown(remainingMs)}
                        </div>
                    ) : null}
                </div>
                <div className="relative flex min-h-0 flex-1 items-center">
                    <div className="max-w-[1520px]">
                        <div className={`mb-7 inline-flex items-center gap-4 rounded-full border border-white/12 bg-black/24 px-6 py-3 text-[0.95rem] font-black uppercase tracking-[0.26em] text-white/72 backdrop-blur`}>
                            <span className="h-3 w-20 rounded-full" style={theme.lineStyle}></span>
                            <span>{detailModeLabel}</span>
                        </div>
                        <div
                            data-tv-takeover-headline
                            className="bg-clip-text text-[clamp(7rem,16vw,18rem)] font-bebas leading-[0.82] text-transparent drop-shadow-[0_18px_60px_rgba(0,0,0,0.32)]"
                            style={theme.headlineStyle}
                        >
                            {headline}
                        </div>
                        {bodyCopy ? (
                            <div data-tv-takeover-body className="mt-6 max-w-[1220px] text-[clamp(2rem,3.3vw,3.8rem)] font-semibold leading-[1.04] text-zinc-100">
                                {bodyCopy}
                            </div>
                        ) : null}
                        {options.length ? (
                            <div className="mt-10 grid max-w-[1320px] gap-5 md:grid-cols-2">
                                {options.map((option, index) => (
                                    <div key={`${option}-${index}`} className="rounded-[1.9rem] border border-white/10 bg-black/24 px-7 py-6 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur">
                                        <div className="text-[0.95rem] uppercase tracking-[0.24em] text-white/52">Option {index + 1}</div>
                                        <div className="mt-3 text-[clamp(2.2rem,3.5vw,4rem)] font-semibold leading-tight text-zinc-50">{option}</div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4 rounded-[2rem] border border-white/10 bg-black/18 px-7 py-6 backdrop-blur">
                    <div className="flex flex-wrap gap-3">
                        {metaChips.map((chip) => (
                            <span key={chip} className="rounded-full border border-white/10 bg-black/25 px-5 py-2.5 text-[clamp(1rem,1.2vw,1.2rem)] font-black uppercase tracking-[0.2em] text-white/76">
                                {chip}
                            </span>
                        ))}
                    </div>
                    <div className="min-w-[380px]">
                        {remainingMs > 0 ? (
                            <>
                                <div className="flex items-center justify-between gap-4 text-[0.95rem] font-black uppercase tracking-[0.24em] text-white/58">
                                    <span>{preview ? 'Preview Window' : 'Public TV Live'}</span>
                                    <span className="text-white/88">{formatRunOfShowCountdown(remainingMs)}</span>
                                </div>
                                <div className="mt-3 h-4 overflow-hidden rounded-full border border-white/10 bg-white/8">
                                    <div className="h-full rounded-full" style={{ ...theme.progressStyle, width: `${progressPct}%` }}></div>
                                </div>
                            </>
                        ) : (
                            <div className="text-right text-[clamp(1.15rem,1.35vw,1.4rem)] font-semibold uppercase tracking-[0.18em] text-white/68">
                                {preview ? 'TV-only preview | audience unaffected' : 'Show graphics live on Public TV'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const RunOfShowStatusHud = ({ hud = null, fixed = true }) => {
    if (!hud) return null;
    return (
        <div className={`pointer-events-none ${fixed ? 'fixed left-3 right-3 top-3 z-[185]' : 'absolute left-3 right-3 top-3 z-[88]'} flex justify-center`}>
            <div className="w-full max-w-[min(56rem,calc(100vw-1.5rem))] rounded-[1.25rem] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(6,10,22,0.82),rgba(10,16,34,0.76))] px-3 py-2.5 shadow-[0_18px_34px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-[9px] font-black uppercase tracking-[0.24em] text-cyan-200/82">{hud.eyebrow || 'Run Of Show'}</span>
                            <span className="truncate text-[0.9rem] font-black text-white md:text-[1rem]">{hud.title}</span>
                            {hud.subtitle ? <span className="truncate text-[0.72rem] text-zinc-300/82 md:text-[0.78rem]">{hud.subtitle}</span> : null}
                        </div>
                        {hud.nextLabel ? (
                            <div className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300/72">{hud.nextLabel}</div>
                        ) : null}
                    </div>
                    {hud.remainingMs > 0 ? (
                        <div className="shrink-0 text-right">
                            <div className="text-[8px] font-black uppercase tracking-[0.22em] text-white/52">{hud.countdownLabel || 'Remaining'}</div>
                            <div className="mt-0.5 text-[1rem] font-black leading-none text-white md:text-[1.1rem]">{formatRunOfShowCountdown(hud.remainingMs)}</div>
                            {hud.showRemainingMs > 0 ? (
                                <div className="mt-1 text-[8px] font-black uppercase tracking-[0.2em] text-cyan-200/72">
                                    Show Left {formatRunOfShowRemainingTotal(hud.showRemainingMs)}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
                {hud.remainingMs > 0 ? (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, Number(hud.progressPct || 0)))}%` }}></div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---
const getRoomSupportSurface = (room = {}) => ({
    label: String(room?.eventCredits?.supportLabel || '').trim(),
    url: String(room?.eventCredits?.supportEmbedUrl || room?.eventCredits?.supportUrl || '').trim(),
});

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

const LEADERBOARD_MODE_DEFS = Object.freeze([
    Object.freeze({ key: 'performances', label: 'Most Performances', unit: 'PERF', getValue: (u) => u.performances }),
    Object.freeze({ key: 'totalEmojis', label: 'Most Emojis Sent', unit: 'EMOJIS', getValue: (u) => u.totalEmojis }),
    Object.freeze({ key: 'loudest', label: 'Loudest Performance', unit: 'dB', getValue: (u) => u.loudest }),
    Object.freeze({ key: 'totalPoints', label: 'Most Points', unit: 'PTS', getValue: (u) => u.totalPoints }),
]);

const getLeaderboardEntryKey = (entry = {}) =>
    String(entry?.entryKey || entry?.performanceKey || entry?.uid || entry?.name || '').trim();

const resolveTimestampMs = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
};

const stripLeaderboardSongDecorators = (value = '') =>
    String(value || '')
        .replace(/\s*-\s*Karaoke Version(?:\s+from\s+.*)?$/i, '')
        .replace(/\s*\((?:official\s+)?(?:karaoke|instrumental)(?:\s+version|\s+track|\s+video)?\)\s*$/i, '')
        .replace(/\s*\[(?:official\s+)?(?:karaoke|instrumental).*?\]\s*$/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

const buildPerformanceLeaderboardStats = (songs = [], users = [], recap = null) => {
    const userByUid = new Map(
        (Array.isArray(users) ? users : []).map((user) => [String(user?.uid || '').trim(), user]).filter(([uid]) => !!uid)
    );
    const performedSongs = Array.isArray(songs) ? songs.filter((song) => song?.status === 'performed') : [];
    const recapTs = resolveTimestampMs(recap?.timestamp);
    const recapSingerUid = String(recap?.singerUid || '').trim();
    const recapSongTitle = String(recap?.songTitle || '').trim().toLowerCase();
    const hasMatchingRecapSong = recap
        ? performedSongs.some((song) => {
            const songTs = resolveTimestampMs(song?.timestamp);
            const sameId = (
                (song?.id && recap?.id && String(song.id) === String(recap.id))
                || (song?.songId && recap?.songId && String(song.songId) === String(recap.songId))
            );
            const sameSinger = recapSingerUid && String(song?.singerUid || '').trim() === recapSingerUid;
            const sameTitle = recapSongTitle && String(song?.songTitle || '').trim().toLowerCase() === recapSongTitle;
            const closeTimestamp = recapTs && songTs ? Math.abs(songTs - recapTs) < 10000 : false;
            return sameId || (sameSinger && sameTitle) || closeTimestamp;
        })
        : false;
    const performanceSongs = recap && !hasMatchingRecapSong
        ? [...performedSongs, { ...recap, status: 'performed', isCurrentPerformance: true }]
        : performedSongs;

    return performanceSongs.map((song, index) => {
        const singerUid = String(song?.singerUid || '').trim();
        const roomUser = singerUid ? userByUid.get(singerUid) : null;
        const songTitle = stripLeaderboardSongDecorators(song?.displaySongTitle || song?.songTitle || song?.title || '') || 'Featured Performance';
        const artist = stripLeaderboardSongDecorators(song?.displayArtist || song?.artist || '');
        const totalPoints = Math.max(0, Number(song?.hypeScore || 0) + Number(song?.applauseScore || 0) + Number(song?.hostBonus || 0));
        const performanceKey = String(
            song?.id
            || song?.songId
            || `${singerUid || song?.singerName || 'guest'}_${songTitle}_${resolveTimestampMs(song?.timestamp) || index}`
        );
        const isCurrentPerformance = !!song?.isCurrentPerformance || (
            !!recap
            && (
                (recap?.id && song?.id && String(recap.id) === String(song.id))
                || (recap?.songId && song?.songId && String(recap.songId) === String(song.songId))
                || (
                    recapSingerUid
                    && singerUid
                    && recapSingerUid === singerUid
                    && recapSongTitle
                    && recapSongTitle === String(song?.songTitle || '').trim().toLowerCase()
                    && (!recapTs || !resolveTimestampMs(song?.timestamp) || Math.abs(resolveTimestampMs(song?.timestamp) - recapTs) < 10000)
                )
            )
        );

        return {
            entryKey: performanceKey,
            performanceKey,
            uid: singerUid || performanceKey,
            singerUid: singerUid || '',
            name: song?.singerName || roomUser?.name || 'Guest',
            avatar: roomUser?.avatar || song?.avatar || song?.emoji || roomUser?.emoji || EMOJI.sparkle,
            isVip: !!roomUser?.isVip || (Number(roomUser?.vipLevel || 0) > 0),
            totalEmojis: 0,
            performances: 1,
            loudest: Math.max(0, Number(song?.applauseScore || 0)),
            totalPoints,
            songTitle,
            artist,
            detailLine: artist ? `${songTitle} / ${artist}` : songTitle,
            summaryLine: `${Math.max(0, Number(song?.hypeScore || 0))} vibe | ${Math.max(0, Number(song?.applauseScore || 0))} applause${Number(song?.hostBonus || 0) > 0 ? ` | ${Math.max(0, Number(song?.hostBonus || 0))} bonus` : ''}`,
            hypeScore: Math.max(0, Number(song?.hypeScore || 0)),
            applauseScore: Math.max(0, Number(song?.applauseScore || 0)),
            hostBonus: Math.max(0, Number(song?.hostBonus || 0)),
            isCurrentPerformance,
        };
    });
};

const sortLeaderboardEntriesForMode = (entries = [], mode = LEADERBOARD_MODE_DEFS[0]) => (
    [...entries]
        .sort((a, b) =>
            (Number(mode?.getValue?.(b) || 0) - Number(mode?.getValue?.(a) || 0))
            || (Number(b?.totalPoints || 0) - Number(a?.totalPoints || 0))
            || (Number(b?.performances || 0) - Number(a?.performances || 0))
            || (Number(b?.totalEmojis || 0) - Number(a?.totalEmojis || 0))
            || (Number(b?.loudest || 0) - Number(a?.loudest || 0))
        )
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
);

const buildRecapLeaderboardWindow = (entries = [], highlightedEntryKey = '') => {
    if (!entries.length) return [];
    const performerIndex = entries.findIndex((entry) => getLeaderboardEntryKey(entry) === String(highlightedEntryKey || ''));
    if (performerIndex < 0) return entries.slice(0, 5);
    if (performerIndex < 5) return entries.slice(0, 5);
    const start = Math.max(0, Math.min(entries.length - 5, performerIndex - 2));
    return entries.slice(start, start + 5);
};

const LeaderboardCardStack = ({
    entries = [],
    mode = LEADERBOARD_MODE_DEFS[0],
    highlightedUid = '',
    highlightedEntryKey = '',
    rankDeltaByUid = null,
    animated = false,
    animationKey = '',
    premiumBadgeLabel = 'VIP'
}) => {
    const stableAnimationKey = animationKey || entries.map((entry) => getLeaderboardEntryKey(entry)).join('|');
    const animationStateKey = `${stableAnimationKey}:${String(highlightedUid || '')}:${String(highlightedEntryKey || '')}`;
    const [renderedAnimationKey, setRenderedAnimationKey] = useState(animated ? '' : animationStateKey);
    const ready = !animated || renderedAnimationKey === animationStateKey;

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            setRenderedAnimationKey(animated ? animationStateKey : '');
        });
        return () => cancelAnimationFrame(frame);
    }, [animated, animationStateKey]);

    return (
        <div className="space-y-2 md:space-y-4 2xl:space-y-6 w-full max-w-5xl">
            {entries.map((u, i) => {
                const delta = Number(rankDeltaByUid?.[getLeaderboardEntryKey(u)] || rankDeltaByUid?.[u.uid] || 0);
                const isHighlighted = (
                    (highlightedEntryKey && getLeaderboardEntryKey(u) === String(highlightedEntryKey || ''))
                    || String(highlightedUid || '') === String(u.uid || '')
                );
                const rankTone = i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-zinc-600';
                const highlightedShell = isHighlighted
                    ? 'border-yellow-300 bg-[linear-gradient(135deg,rgba(250,204,21,0.2),rgba(236,72,153,0.12),rgba(39,39,42,0.94))] shadow-[0_0_48px_rgba(250,204,21,0.18)]'
                    : 'border-zinc-700 bg-zinc-800';
                return (
                    <div
                        key={getLeaderboardEntryKey(u) || u.name || i}
                        className={`flex items-center justify-between p-3 md:p-5 2xl:p-8 rounded-2xl 2xl:rounded-3xl border-2 2xl:border-4 shadow-2xl relative overflow-hidden gap-3 transition-[transform,opacity,box-shadow] duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)] ${highlightedShell}`}
                        style={animated ? {
                            transform: ready
                                ? 'translate3d(0,0,0) scale(1)'
                                : `translate3d(0, ${Math.max(-4, Math.min(4, delta)) * 122}%, 0) scale(${isHighlighted ? 1.04 : 0.98})`,
                            opacity: ready ? 1 : 0.76,
                            transitionDelay: `${i * 90}ms`
                        } : undefined}
                    >
                        <div className="flex items-center gap-2 md:gap-4 2xl:gap-8 relative z-10 min-w-0">
                            <div className={`text-2xl md:text-4xl 2xl:text-7xl font-mono w-10 md:w-16 2xl:w-32 text-left ${rankTone}`}>#{u.rank || i + 1}</div>
                            <div className="text-3xl md:text-5xl 2xl:text-8xl">{u.avatar}</div>
                            <div className="min-w-0 max-w-[48vw] 2xl:max-w-lg">
                                <div className="text-lg md:text-3xl 2xl:text-6xl font-bold text-white truncate flex items-center gap-2 md:gap-4">
                                    <span className="truncate">{u.name}</span>
                                    {u.isVip && (
                                        <span className="px-2 py-0.5 md:px-3 md:py-1 rounded-full text-xs md:text-sm font-black tracking-widest bg-yellow-400 text-black shadow-[0_0_18px_rgba(253,224,71,0.6)]">{premiumBadgeLabel}</span>
                                    )}
                                    {isHighlighted && (
                                        <span className="px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-black tracking-[0.18em] uppercase bg-yellow-200 text-black shadow-[0_0_22px_rgba(250,204,21,0.5)]">Just sang</span>
                                    )}
                                </div>
                                {u.detailLine && (
                                    <div className="mt-1 text-xs md:text-base 2xl:text-2xl uppercase tracking-[0.14em] text-zinc-300 truncate">
                                        {u.detailLine}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-right relative z-10 flex-shrink-0">
                            <div className="text-2xl md:text-4xl 2xl:text-7xl font-black text-yellow-400">
                                {mode.getValue(u)} <span className="text-sm md:text-xl 2xl:text-3xl text-yellow-600">{mode.unit}</span>
                            </div>
                            <div className="text-xs md:text-sm 2xl:text-xl text-zinc-300 mt-1 md:mt-2">
                                {u.summaryLine || `${u.performances} perf | ${u.totalEmojis} emojis | ${u.loudest} dB`}
                            </div>
                        </div>
                        {i === 0 && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent animate-shimmer"></div>}
                    </div>
                );
            })}
        </div>
    );
};

const LeaderboardOverlay = ({ users, songs, premiumBadgeLabel = 'VIP' }) => {
    const [modeIndex, setModeIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setModeIndex(prev => (prev + 1) % LEADERBOARD_MODE_DEFS.length);
        }, 8000);
        return () => clearInterval(timer);
    }, []);

    const leaderboardStats = useMemo(() => buildRoomLeaderboardStats(users, songs), [users, songs]);
    const activeMode = LEADERBOARD_MODE_DEFS[modeIndex];
    const leaderboard = sortLeaderboardEntriesForMode(leaderboardStats, activeMode).slice(0, 5);

    return (
        <div className="public-tv fixed inset-0 z-[200] bg-zinc-900 flex flex-col items-center justify-center p-4 md:p-8 2xl:p-12 text-center animate-in zoom-in">
            <div className="text-center mb-6 md:mb-10 2xl:mb-12">
                <h1 className="text-[clamp(2.5rem,10vw,6rem)] 2xl:text-9xl font-bebas text-yellow-400 tracking-[0.12em] md:tracking-widest drop-shadow-[0_0_50px_rgba(234,179,8,0.5)]">LEADERBOARD</h1>
                <div className="text-sm md:text-2xl 2xl:text-3xl text-zinc-300 uppercase tracking-[0.24em] md:tracking-[0.4em] mt-2 md:mt-3">{activeMode.label}</div>
            </div>
            <LeaderboardCardStack entries={leaderboard} mode={activeMode} premiumBadgeLabel={premiumBadgeLabel} />
        </div>
    );
};

const DEFAULT_PERFORMANCE_RECAP_BREAKDOWN_MS = 7000;
const DEFAULT_PERFORMANCE_RECAP_LEADERBOARD_MS = 7000;
const DEFAULT_APPLAUSE_WARMUP_SEC = 5;
const DEFAULT_APPLAUSE_COUNTDOWN_SEC = 5;
const DEFAULT_APPLAUSE_MEASURE_SEC = 5;

const buildRoomLeaderboardStats = (users = [], songs = []) => {
    const stats = new Map();
    users.forEach((u) => {
        const key = u.uid || u.name;
        if (!key) return;
        stats.set(key, {
            uid: u.uid || key,
            name: u.name || 'Guest',
            avatar: u.avatar || u.emoji || EMOJI.sparkle,
            isVip: !!u.isVip || (u.vipLevel || 0) > 0,
            totalEmojis: u.totalEmojis || 0,
            performances: 0,
            loudest: 0,
            totalPoints: 0,
        });
    });
    songs.filter((s) => s.status === 'performed').forEach((s) => {
        const matched = users.find((u) => u.uid === s.singerUid || u.name === s.singerName);
        const key = matched?.uid || s.singerUid || s.singerName;
        if (!key) return;
        if (!stats.has(key)) {
            stats.set(key, {
                uid: key,
                name: s.singerName || 'Guest',
                avatar: s.emoji || EMOJI.sparkle,
                isVip: false,
                totalEmojis: 0,
                performances: 0,
                loudest: 0,
                totalPoints: 0,
            });
        }
        const entry = stats.get(key);
        entry.performances += 1;
        entry.loudest = Math.max(entry.loudest, s.applauseScore || 0);
        entry.totalPoints += (s.hypeScore || 0) + (s.applauseScore || 0) + (s.hostBonus || 0);
    });
    return Array.from(stats.values());
};

const TipOverlay = ({ room }) => {
    const supportSurface = getRoomSupportSurface(room);
    const qrImageUrl = String(room?.tipQrUrl || '').trim();
    const qrValue = String(room?.tipUrl || supportSurface.url || '').trim();
    const usesSupportFallback = !String(room?.tipUrl || '').trim() && !!supportSurface.url;
    const overlayHeadline = usesSupportFallback ? (supportSurface.label || 'Support the Room') : 'Show Some Love!';
    const overlaySubhead = usesSupportFallback ? 'Scan to support the fundraiser' : `Scan to tip the host ${EMOJI.tip}`;
    return (
        <div className="public-tv fixed inset-0 z-[200] bg-gradient-to-br from-green-900 to-emerald-950 flex flex-col items-center justify-center p-4 md:p-8 2xl:p-12 text-center animate-in zoom-in">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/money.png')] opacity-10"></div>
            <h1 className="text-[clamp(2.25rem,10vw,7.5rem)] 2xl:text-[10rem] font-bebas text-white mb-4 md:mb-8 drop-shadow-lg leading-none">{overlayHeadline}</h1>
            <div className="bg-white p-4 md:p-6 2xl:p-8 rounded-3xl shadow-[0_0_100px_rgba(255,255,255,0.2)] mb-4 md:mb-8 transform hover:scale-105 transition-transform duration-500">
                {qrImageUrl ? (
                    <img src={qrImageUrl} className="w-[68vw] h-[68vw] max-w-[500px] max-h-[500px] object-cover rounded-lg" alt="Support QR" />
                ) : (
                    <LocalQrImage
                        value={qrValue}
                        size={500}
                        className="w-[68vw] h-[68vw] max-w-[500px] max-h-[500px] object-cover rounded-lg"
                        alt="Support QR"
                    />
                )}
            </div>
            <div className="text-lg md:text-3xl 2xl:text-5xl text-green-200 font-bold bg-black/40 px-5 py-3 md:px-8 md:py-4 2xl:px-12 2xl:py-6 rounded-full border border-green-500/30 backdrop-blur-md">{overlaySubhead}</div>
        </div>
    );
};

const HowToPlayOverlay = ({
    roomCode,
    logoUrl,
    queueRules = [],
    startedAtMs = 0,
    brandEyebrow = 'BROSS Entertainment',
    poweredByLabel = '',
    brandTitle = ''
}) => {
    const slides = HOW_TO_PLAY.sections || [];
    const [clockMs, setClockMs] = useState(() => nowMs());

    useEffect(() => {
        if (!slides.length || !startedAtMs) return undefined;
        const initialTick = setTimeout(() => {
            setClockMs(nowMs());
        }, 0);
        const timer = setInterval(() => {
            setClockMs(nowMs());
        }, 500);
        return () => {
            clearTimeout(initialTick);
            clearInterval(timer);
        };
    }, [slides.length, startedAtMs]);

    const elapsedMs = Math.max(0, clockMs - Number(startedAtMs || 0));
    const index = slides.length ? Math.min(slides.length - 1, Math.floor(elapsedMs / HOW_TO_PLAY_SLIDE_MS)) : 0;
    const active = slides[index] || { title: '', items: [] };
    const audienceBase = typeof window !== 'undefined' ? getSurfaceBaseHref('app', window.location) : '/';
    const qrValue = `${audienceBase}?room=${roomCode}`;

    return (
        <div className="public-tv fixed inset-0 z-[200] bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.14),transparent_38%),#111115] flex flex-col items-center justify-center text-white font-saira p-2 md:p-4">
            <div className="flex h-[95vh] w-[98vw] max-w-[1800px] flex-col rounded-[2rem] border border-cyan-500/30 bg-black/70 px-6 py-5 shadow-[0_0_90px_rgba(34,211,238,0.22)] md:px-8 md:py-6 2xl:px-10 2xl:py-8">
                <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.8fr] lg:gap-8 items-stretch">
                    <div>
                        <div className="text-xs md:text-sm uppercase tracking-[0.3em] md:tracking-[0.5em] text-zinc-400">{brandEyebrow}</div>
                        <div className="mt-2 text-5xl font-bebas tracking-[0.12em] text-cyan-300 md:text-7xl 2xl:text-[6.5rem]">{HOW_TO_PLAY.title}</div>
                        <div className="mb-4 text-lg text-zinc-300 md:mb-6 md:text-2xl 2xl:text-3xl">{HOW_TO_PLAY.subtitle}</div>
                        {poweredByLabel ? (
                            <div className="mb-4 text-sm uppercase tracking-[0.24em] text-zinc-500 md:mb-5 md:text-base">{poweredByLabel}</div>
                        ) : null}

                        <div className="flex h-[calc(100%-6rem)] min-h-[420px] flex-col rounded-[2rem] border border-white/10 bg-black/55 p-6 md:min-h-[520px] md:p-8 2xl:p-10">
                            <div className="mb-5 text-4xl font-bold uppercase tracking-[0.08em] text-pink-300 md:mb-7 md:text-6xl 2xl:text-[4.75rem]">{active.title}</div>
                            <ul className="space-y-4 text-[2rem] leading-tight text-zinc-100 md:space-y-5 md:text-[2.65rem] 2xl:space-y-7 2xl:text-[3.5rem]">
                                {active.items.map(item => (
                                    <li key={item} className="flex gap-4">
                                        <span className="text-cyan-300">&gt;</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="flex h-full flex-col items-center justify-center gap-5">
                        <img src={logoUrl || ASSETS.logo} className="h-20 object-contain md:h-28 2xl:h-32" alt={brandTitle || 'Room brand'} />
                        <div className="flex items-center gap-5">
                            <div className="flex flex-col gap-3 text-sm uppercase tracking-[0.15em] text-zinc-200 md:text-lg md:tracking-[0.22em]">
                                {queueRules.map(rule => (
                                    <div key={rule.label} className="flex items-center gap-3 rounded-full border border-white/10 bg-black/50 px-4 py-3">
                                        <i className={`fa-solid ${rule.icon} text-cyan-300`}></i>
                                        {rule.label}
                                    </div>
                                ))}
                            </div>
                            <div className="rounded-[1.75rem] bg-white p-3 shadow-xl md:p-4">
                                <LocalQrImage value={qrValue} size={256} alt="Join QR" className="h-52 w-52 object-cover md:h-64 md:w-64 2xl:h-72 2xl:w-72" />
                            </div>
                        </div>
                        <div className="text-base uppercase tracking-[0.3em] text-zinc-300 md:text-xl 2xl:text-2xl">Room {roomCode}</div>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-zinc-400 md:text-base 2xl:text-lg">
                    <div>Slide {index + 1} of {slides.length}</div>
                    <div className="flex gap-2.5">
                        {slides.map((_, i) => (
                            <span key={i} className={`h-2.5 w-10 rounded-full ${i === index ? 'bg-cyan-400' : 'bg-zinc-700'}`}></span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const MiniVideoPane = ({ room, current, muted = false }) => {
    const mediaUrl = resolveStageMediaUrl(current, room);
    const isBackingAudioOnly = current?.backingAudioOnly || false;
    const stageBacking = normalizeBackingChoice({ mediaUrl });
    const isNativeVideo = /\.(mp4|webm|ogg)$/i.test(stageBacking.mediaUrl || '');
    const youtubeId = stageBacking.youtubeId;
    const isYoutube = stageBacking.isYouTube;

    const iframeRef = useRef(null);
    const nativeVideoRef = useRef(null);
    const youtubeFrameOrigin = 'https://www.youtube.com';
    const [youtubeIframeReadySrc, setYoutubeIframeReadySrc] = useState('');
    const iframeSrc = useMemo(() => {
        const start = room?.videoStartTimestamp ? (nowMs() - room.videoStartTimestamp) / 1000 : 0;
        const pageOrigin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
        return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&controls=0&start=${Math.floor(Math.max(0, start))}&enablejsapi=1&playsinline=1&origin=${pageOrigin}&rel=0&modestbranding=1`;
    }, [youtubeId, room?.videoStartTimestamp]);

    const postYoutubeCommand = useCallback((func, args = []) => {
        if (!iframeRef.current?.contentWindow) return false;
        iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func, args }),
            youtubeFrameOrigin
        );
        return true;
    }, []);
    const syncYoutubeNow = useCallback(() => {
        if (!iframeRef.current?.contentWindow || !youtubeId || !room?.videoStartTimestamp) return;
        const targetTime = Math.max(0, (Date.now() - room.videoStartTimestamp) / 1000);
        postYoutubeCommand('seekTo', [targetTime, true]);
        postYoutubeCommand(room?.videoPlaying ? 'playVideo' : 'pauseVideo', []);
    }, [postYoutubeCommand, room, youtubeId]);

    useEffect(() => {
        if (!isYoutube || !youtubeId || !room?.videoPlaying || !iframeSrc) return undefined;
        const timer = setTimeout(() => setYoutubeIframeReadySrc(iframeSrc), 900);
        return () => clearTimeout(timer);
    }, [isYoutube, youtubeId, room?.videoPlaying, iframeSrc]);

    const youtubeIframeReady = !!iframeSrc && youtubeIframeReadySrc === iframeSrc;

    useEffect(() => {
        if (!isYoutube || !youtubeId || !room?.videoPlaying || !youtubeIframeReady || room?.videoVolume === undefined) return;
        const nextVolume = muted ? 0 : Math.max(0, Math.min(100, Math.round(Number(room.videoVolume) || 0)));
        if (nextVolume <= 0) {
            postYoutubeCommand('mute');
            return;
        }
        postYoutubeCommand('unMute');
        postYoutubeCommand('setVolume', [nextVolume]);
    }, [isYoutube, youtubeId, room?.videoPlaying, room?.videoVolume, youtubeIframeReady, postYoutubeCommand, muted]);

    useEffect(() => {
        if (!isYoutube || !youtubeId || !youtubeIframeReady || !room?.videoStartTimestamp) return undefined;
        const initialSync = setTimeout(syncYoutubeNow, 180);
        const syncTimer = setInterval(syncYoutubeNow, room?.videoPlaying ? 1600 : 2400);
        return () => {
            clearTimeout(initialSync);
            clearInterval(syncTimer);
        };
    }, [isYoutube, room?.videoPlaying, room?.videoStartTimestamp, syncYoutubeNow, youtubeId, youtubeIframeReady]);

    useEffect(() => {
        if (nativeVideoRef.current && room?.videoVolume !== undefined) {
            nativeVideoRef.current.volume = muted ? 0 : room.videoVolume / 100;
        }
    }, [room?.videoVolume, muted]);

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
                    muted={muted}
                />
            ) : (isYoutube && youtubeId ? (
                room?.videoPlaying ? (
                    <iframe
                        key={`${youtubeId}_${room?.videoStartTimestamp || 0}`}
                        ref={iframeRef}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        src={iframeSrc}
                        allow="autoplay; encrypted-media"
                        title="YT"
                        frameBorder="0"
                        onLoad={() => setYoutubeIframeReadySrc(iframeSrc)}
                    ></iframe>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-zinc-400">VIDEO PAUSED</div>
                )
            ) : null)}
        </div>
    );
};

// --- MAIN TV COMPONENT ---

const PublicTV = ({ roomCode }) => {
    const initialTvExploreConfig = useMemo(() => getInitialTvExploreConfig(), []);
    const tvExploreEnabled = initialTvExploreConfig.enabled;
    const [tvExploreProfile, setTvExploreProfile] = useState(initialTvExploreConfig.profile);
    const isMarketingDemoEmbed = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return new URLSearchParams(window.location.search || '').get('mkDemoEmbed') === '1';
    }, []);
    const isHostPreviewEmbed = useMemo(() => {
        if (typeof window === 'undefined') return false;
        const params = new URLSearchParams(window.location.search || '');
        const flag = String(params.get('hostPreview') || '').trim().toLowerCase();
        return flag === '1' || flag === 'true' || flag === 'yes' || flag === 'on';
    }, []);
    const qaTvFixtureId = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return String(new URLSearchParams(window.location.search || '').get('qaTvFixture') || '').trim();
    }, []);
    const [demoFixture, setDemoFixture] = useState(() => (isMarketingDemoEmbed ? {} : null));
    const isMarketingDemoFixture = isMarketingDemoEmbed && !!demoFixture;
    const [room, setRoom] = useState(null);
    const [songs, setSongs] = useState([]);
    const [reactions, setReactions] = useState([]);
    const [lobbyPlayBursts, setLobbyPlayBursts] = useState([]);
    const [lobbyPlayScreenFx, setLobbyPlayScreenFx] = useState([]);
    const [lobbyVolleyState, setLobbyVolleyState] = useState(() => createLobbyVolleyState());
    const [lobbyVolleySceneMetrics, setLobbyVolleySceneMetrics] = useState(() => getVolleyOrbResponsiveMetrics());
    const [lobbyComboMoments, setLobbyComboMoments] = useState([]);
    const [lobbyAssistMoments, setLobbyAssistMoments] = useState([]);
    const [lobbyVolleyLinks, setLobbyVolleyLinks] = useState([]);
    const [lobbyLastInteraction, setLobbyLastInteraction] = useState(null);
    const [lobbyTierChips, setLobbyTierChips] = useState([]);
    const [lobbyTransitionPhase, setLobbyTransitionPhase] = useState('idle');
    const [messages, setMessages] = useState([]); 
    const [activities, setActivities] = useState([]);
    const [photoOverlay, setPhotoOverlay] = useState(null);
    const [crowdSelfieWall, setCrowdSelfieWall] = useState([]);
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
    const [celebrateCountdown, setCelebrateCountdown] = useState(5);
    const [countdown, setCountdown] = useState(5);
    const [measure, setMeasure] = useState(5);
    const [applauseMax, setApplauseMax] = useState(0);
    const [tipPulse, setTipPulse] = useState(false);
    const [micVolume, setMicVolume] = useState(0);
    const [vibeUsers, setVibeUsers] = useState([]);
    const [guitarWinner, setGuitarWinner] = useState(null);
    const [guitarSyncState, setGuitarSyncState] = useState(() => createGuitarSyncState());
    const [selfieSubmissions, setSelfieSubmissions] = useState([]);
    const [selfieVotes, setSelfieVotes] = useState([]);
    const [doodleNow, setDoodleNow] = useState(nowMs());
    const [doodleSubmissions, setDoodleSubmissions] = useState([]);
    const [doodleVotes, setDoodleVotes] = useState([]);
    const [doodleSubmittedUids, setDoodleSubmittedUids] = useState([]);
    const [roomUsers, setRoomUsers] = useState([]);
    const [stormPhase, setStormPhase] = useState('off');
    const [stormLayerMeters, setStormLayerMeters] = useState(() => makeStormLayerMeters());
    const [stormLayerEvents, setStormLayerEvents] = useState([]);
    const [showMarquee, setShowMarquee] = useState(false);
    const [marqueeIndex, setMarqueeIndex] = useState(-1);
    const [readyTimer, setReadyTimer] = useState(0);
    const [chatMessages, setChatMessages] = useState([]);
    const [showChatFeed, setShowChatFeed] = useState(false);
    const [sidebarFeatureView, setSidebarFeatureView] = useState('queue');
    const [, setLobbyLiveEvents] = useState([]);
    const [bingoRngNow, setBingoRngNow] = useState(nowMs());
    const [bonusDropBurst, setBonusDropBurst] = useState(null);
    const [purchaseCelebrationBurst, setPurchaseCelebrationBurst] = useState(null);
    const [popTriviaVotes, setPopTriviaVotes] = useState([]);
    const [popTriviaNow, setPopTriviaNow] = useState(nowMs());
    const [recapNowMs, setRecapNowMs] = useState(nowMs());
    const [popTriviaQuestionAnnounceUntilMs, setPopTriviaQuestionAnnounceUntilMs] = useState(0);
    const [popTriviaUrgencyPulseUntilMs, setPopTriviaUrgencyPulseUntilMs] = useState(0);
    const [popTriviaRevealSnapshot, setPopTriviaRevealSnapshot] = useState(null);
    const [previewNowMs, setPreviewNowMs] = useState(nowMs());
    const [previewSession, setPreviewSession] = useState({ key: '', startMs: 0 });
    const [takeoverNowMs, setTakeoverNowMs] = useState(nowMs());
    const [reactionScoreTotalsByPerformance, setReactionScoreTotalsByPerformance] = useState(() => new Map());
    const [featuredReaction, setFeaturedReaction] = useState(null);
    const [selfieArrivalSpotlight, setSelfieArrivalSpotlight] = useState(null);
    const tvAudienceBrandTheme = useMemo(
        () => normalizeAudienceBrandTheme(room?.audienceBrandTheme || {}),
        [room?.audienceBrandTheme]
    );
    const tvBrandTitle = tvAudienceBrandTheme.appTitle || 'BeauRocks Karaoke';
    const isCustomTvBrand = String(tvBrandTitle || '').trim().toLowerCase() !== 'beaurocks karaoke';
    const tvPoweredByLabel = isCustomTvBrand ? 'Powered by: BeauRocks Karaoke' : '';
    const tvBrandEyebrow = isCustomTvBrand ? tvBrandTitle : 'BROSS Entertainment';
    const tvPremiumBadgeLabel = isCustomTvBrand ? 'PASS' : 'VIP';
    const tvChatLockedLabel = isCustomTvBrand ? 'Chat is festival-pass only right now.' : 'Chat is VIP-only right now.';
    const tvScoreLabel = isCustomTvBrand ? `${tvBrandTitle} Score` : 'BeauRocks Score';
    const tvLogoAlt = tvBrandTitle;
    const performanceSessionWriteKeyRef = useRef('');

    useEffect(() => {
        performanceSessionWriteKeyRef.current = '';
    }, [room?.currentPerformanceSession?.sessionId]);

    const reportPerformanceSessionPlayback = useCallback(async (event = {}) => {
        if (!roomCode) return;
        const nextWrite = buildPerformanceSessionPlaybackWrite({
            event,
            session: room?.currentPerformanceSession,
            currentPerformanceMeta: room?.currentPerformanceMeta,
            mediaUrl: room?.mediaUrl,
            now: nowMs()
        });
        if (!nextWrite) return;
        if (performanceSessionWriteKeyRef.current === nextWrite.dedupeKey) return;
        performanceSessionWriteKeyRef.current = nextWrite.dedupeKey;

        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), nextWrite.patch);
        } catch (error) {
            console.warn('Failed to report performance session playback', error);
            performanceSessionWriteKeyRef.current = '';
        }
    }, [room?.currentPerformanceMeta?.backingDurationSec, room?.currentPerformanceMeta?.durationSec, room?.currentPerformanceMeta?.songId, room?.currentPerformanceSession, roomCode]);

    useEffect(() => {
        if (!isMarketingDemoEmbed) return;
        setStarted(true);
    }, [isMarketingDemoEmbed]);
    useEffect(() => {
        if (!isHostPreviewEmbed) return;
        setStarted(true);
    }, [isHostPreviewEmbed]);
    useEffect(() => {
        if (!isMarketingDemoEmbed || !qaTvFixtureId) return;
        const fixture = buildQaTvFixture(qaTvFixtureId, { roomCode, nowMs: nowMs() });
        if (!fixture) return;
        setDemoFixture(fixture);
    }, [isMarketingDemoEmbed, qaTvFixtureId, roomCode]);
    useEffect(() => {
        if (!isMarketingDemoEmbed || typeof window === 'undefined') return undefined;
        const handleMessage = (event) => {
            const payload = event?.data;
            if (!payload || payload.type !== 'beaurocks-demo-fixture' || payload.surface !== 'tv') return;
            setDemoFixture(payload.fixture || null);
        };
        window.addEventListener('message', handleMessage);
        try {
            window.parent?.postMessage({ type: 'beaurocks-demo-ready', surface: 'tv' }, '*');
        } catch (_) {
            // Ignore parent postMessage issues in standalone TV mode.
        }
        return () => window.removeEventListener('message', handleMessage);
    }, [isMarketingDemoEmbed]);
    useEffect(() => {
        const previewActive = room?.tvPreviewOverlay?.active === true;
        const announcementActive = !!room?.announcement?.active;
        const runOfShowClockActive = room?.runOfShowEnabled === true
            || (Number(room?.currentPerformanceMeta?.startedAtMs || 0) > 0 && Number(room?.currentPerformanceMeta?.durationSec || 0) > 0);
        if (!previewActive && !announcementActive && !runOfShowClockActive) return undefined;
        setTakeoverNowMs(nowMs());
        const timer = setInterval(() => setTakeoverNowMs(nowMs()), 500);
        return () => clearInterval(timer);
    }, [
        room?.currentPerformanceMeta?.durationSec,
        room?.currentPerformanceMeta?.startedAtMs,
        room?.runOfShowEnabled,
        room?.tvPreviewOverlay?.active,
        room?.tvPreviewOverlay?.startedAtMs,
        room?.tvPreviewOverlay?.durationSec,
        room?.announcement?.active,
        room?.announcement?.startedAtMs
    ]);
    useEffect(() => {
        if (!isMarketingDemoFixture) return;
        const fixture = demoFixture || {};
        if (fixture.room !== undefined) setRoom(fixture.room || null);
        if (Array.isArray(fixture.songs)) setSongs(fixture.songs);
        if (Array.isArray(fixture.activities)) setActivities(fixture.activities);
        if (Array.isArray(fixture.reactions)) setReactions(fixture.reactions);
        if (Array.isArray(fixture.messages)) setMessages(fixture.messages);
        if (Array.isArray(fixture.roomUsers)) setRoomUsers(fixture.roomUsers);
        if (Array.isArray(fixture.popTriviaVotes)) setPopTriviaVotes(fixture.popTriviaVotes);
        if (fixture.recap !== undefined) setRecap(fixture.recap || null);
        if (fixture.previewSession) setPreviewSession(fixture.previewSession);
        if (typeof fixture.started === 'boolean') setStarted(fixture.started);
        if (fixture.lobbyVolleyState !== undefined) {
            setLobbyVolleyState(fixture.lobbyVolleyState || createLobbyVolleyState());
        }
    }, [demoFixture, isMarketingDemoFixture]);
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
    const popTriviaPrevQuestionIdRef = useRef('');
    const popTriviaPrevTimeLeftRef = useRef(null);
    const popTriviaAwardedQuestionIdsRef = useRef(new Set());
    const playStormLayerPulseRef = useRef(() => {});
    const playLobbyVolleyCueRef = useRef(() => {});
    const lobbyVolleySceneRef = useRef(null);
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
    const lastPurchaseCelebrationRef = useRef(null);
    const lastGuitarModeRef = useRef(null);
    const activeGuitarSessionRef = useRef(null);
    const guitarSyncSessionRef = useRef(null);
    const lastStrobeSessionRef = useRef(null);
    const doodleWinnerAwardRef = useRef(null);
    const chatRotateRef = useRef(null);
    const sidebarRotateRef = useRef(null);
    const messageTimeoutsRef = useRef([]);
    const bgVisualizerAudioRef = useRef(null);
    const multiplierRef = useRef(1);
    const guitarSyncStateRef = useRef(createGuitarSyncState());
    const lobbyVolleyStateRef = useRef(createLobbyVolleyState());
    const lobbyLastAnchorRef = useRef(null);
    const lobbyAwardAuthLockedRef = useRef(false);
    const lobbyMicVolumeRef = useRef(0);
    const lobbyVisualizerEnabledRef = useRef(false);
    const lobbyReduceMotionRef = useRef(false);
    const lobbyPausedRef = useRef(false);
    const lobbyVisualOnlyRef = useRef(false);
    const reactionScoreByDocRef = useRef(new Map());
    const reactionScoreTotalsByPerformanceRef = useRef(new Map());
    const lobbyTransitionTimerRef = useRef(null);
    const chatFullscreenScrollRef = useRef(null);
    const chatSidebarScrollRef = useRef(null);
    const featuredReactionQueueRef = useRef([]);
    const featuredReactionTimerRef = useRef(null);
    const selfieArrivalQueueRef = useRef([]);
    const selfieArrivalTimerRef = useRef(null);
    const visibleSelfieSubmissionIdsRef = useRef(new Set());
    const lastSelfiePromptIdRef = useRef('');
    const currentPerformanceIdRef = useRef('');
    const enqueueFeaturedReaction = useCallback((entry) => {
        if (!entry?.id) return;
        featuredReactionQueueRef.current.push(entry);
        if (featuredReactionTimerRef.current) return;
        const showNext = () => {
            const next = featuredReactionQueueRef.current.shift();
            if (!next) {
                featuredReactionTimerRef.current = null;
                setFeaturedReaction(null);
                return;
            }
            setFeaturedReaction(next);
            featuredReactionTimerRef.current = setTimeout(() => {
                setFeaturedReaction(null);
                featuredReactionTimerRef.current = null;
                showNext();
            }, FEATURED_REACTION_SPOTLIGHT_MS);
        };
        showNext();
    }, []);
    const enqueueSelfieArrivalSpotlight = useCallback((entry) => {
        if (!entry?.id || !entry?.url) return;
        selfieArrivalQueueRef.current.push(entry);
        if (selfieArrivalTimerRef.current) return;
        const showNext = () => {
            const next = selfieArrivalQueueRef.current.shift();
            if (!next) {
                selfieArrivalTimerRef.current = null;
                setSelfieArrivalSpotlight(null);
                return;
            }
            setSelfieArrivalSpotlight(next);
            selfieArrivalTimerRef.current = setTimeout(() => {
                setSelfieArrivalSpotlight(null);
                selfieArrivalTimerRef.current = null;
                showNext();
            }, SELFIE_ARRIVAL_SPOTLIGHT_MS);
        };
        showNext();
    }, []);
    useEffect(() => () => {
        if (featuredReactionTimerRef.current) clearTimeout(featuredReactionTimerRef.current);
        if (selfieArrivalTimerRef.current) clearTimeout(selfieArrivalTimerRef.current);
    }, []);
    const selfieVoteCounts = useMemo(() => {
        return selfieVotes.reduce((acc, v) => {
            acc[v.targetUid] = (acc[v.targetUid] || 0) + 1;
            return acc;
        }, {});
    }, [selfieVotes]);
    const visibleSelfieSubmissions = useMemo(() => {
        const source = room?.selfieChallenge?.requireApproval
            ? selfieSubmissions.filter((submission) => submission?.approved)
            : selfieSubmissions;
        return [...source].sort((a, b) => toEpochMs(b?.timestamp) - toEpochMs(a?.timestamp));
    }, [room?.selfieChallenge?.requireApproval, selfieSubmissions]);
    const maxSelfieVotes = useMemo(
        () => Math.max(1, ...Object.values(selfieVoteCounts), 1),
        [selfieVoteCounts]
    );
    const selfieLeadingSubmission = useMemo(() => {
        return [...visibleSelfieSubmissions].sort((a, b) => {
            const voteDelta = (selfieVoteCounts[b?.uid] || 0) - (selfieVoteCounts[a?.uid] || 0);
            if (voteDelta !== 0) return voteDelta;
            return toEpochMs(b?.timestamp) - toEpochMs(a?.timestamp);
        })[0] || null;
    }, [selfieVoteCounts, visibleSelfieSubmissions]);
    const selfieRecentSubmissionIds = useMemo(() => {
        const cutoff = nowMs() - SELFIE_RECENT_BADGE_MS;
        return new Set(
            visibleSelfieSubmissions
                .filter((submission) => toEpochMs(submission?.timestamp) >= cutoff)
                .map((submission) => submission.id)
        );
    }, [visibleSelfieSubmissions]);
    const groupedChatMessages = useMemo(
        () => groupChatMessages(chatMessages, { mergeWindowMs: 12 * 60 * 1000 }),
        [chatMessages]
    );
    useEffect(() => {
        if (!tvExploreEnabled || typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(TV_EXPLORE_STORAGE_KEY, tvExploreProfile);
        } catch (_) {
            // Ignore storage failures in locked-down TV browsers.
        }
    }, [tvExploreEnabled, tvExploreProfile]);
    useEffect(() => {
        lobbyVolleyStateRef.current = lobbyVolleyState;
        lobbyAwardAuthLockedRef.current = !!lobbyVolleyState?.authFailureLocked;
    }, [lobbyVolleyState]);
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
    const upsertReactionScoreContribution = useCallback((change) => {
        const docId = String(change?.doc?.id || '');
        if (!docId || change?.type === 'removed') return false;
        const prevEntry = reactionScoreByDocRef.current.get(docId) || null;
        const prevPerformanceId = String(prevEntry?.performanceId || '').trim();
        const prevPoints = Math.max(0, Number(prevEntry?.points || 0));
        const nextData = change.doc.data() || {};
        const nextPerformanceId = String(nextData?.performanceId || '').trim();
        const nextPoints = nextPerformanceId
            ? getReactionScoreContribution(nextData, multiplierRef.current)
            : 0;
        if (prevPerformanceId === nextPerformanceId && prevPoints === nextPoints) return false;
        if (prevPerformanceId && prevPoints > 0) {
            const prevTotal = Math.max(0, Number(reactionScoreTotalsByPerformanceRef.current.get(prevPerformanceId) || 0) - prevPoints);
            if (prevTotal > 0) {
                reactionScoreTotalsByPerformanceRef.current.set(prevPerformanceId, prevTotal);
            } else {
                reactionScoreTotalsByPerformanceRef.current.delete(prevPerformanceId);
            }
        }
        reactionScoreByDocRef.current.delete(docId);
        if (nextPerformanceId && nextPoints > 0) {
            reactionScoreByDocRef.current.set(docId, {
                performanceId: nextPerformanceId,
                points: nextPoints
            });
            const nextTotal = Math.max(0, Number(reactionScoreTotalsByPerformanceRef.current.get(nextPerformanceId) || 0) + nextPoints);
            reactionScoreTotalsByPerformanceRef.current.set(nextPerformanceId, nextTotal);
        }
        return true;
    }, []);
    const doodleRequireReview = !!room?.doodleOke?.requireReview;
    const doodleVisibleSubmissions = doodleSubmissions;
    const doodleRecentSubmissionIds = useMemo(() => {
        const cutoff = nowMs() - DOODLE_RECENT_BADGE_MS;
        return new Set(
            doodleVisibleSubmissions
                .filter((submission) => toEpochMs(submission?.timestamp) >= cutoff)
                .map((submission) => submission.id)
        );
    }, [doodleVisibleSubmissions]);
    const doodlePendingReviewCount = doodleRequireReview
        ? Math.max(0, doodleSubmittedUids.length - doodleVisibleSubmissions.length)
        : 0;
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

    useEffect(() => {
        if (room?.lightMode !== 'guitar') {
            guitarSyncSessionRef.current = null;
            return;
        }
        const sessionId = room?.guitarSessionId || null;
        if (!sessionId) return;
        if (guitarSyncSessionRef.current === sessionId) return;
        guitarSyncSessionRef.current = sessionId;
        setGuitarSyncState(createGuitarSyncState());
    }, [room?.lightMode, room?.guitarSessionId]);

    useEffect(() => {
        guitarSyncStateRef.current = guitarSyncState;
    }, [guitarSyncState]);

    useEffect(() => {
        if (room?.lightMode !== 'guitar') {
            setGuitarSyncState(createGuitarSyncState());
            return;
        }
        let lastTickAt = nowMs();
        const timer = setInterval(() => {
            const tickNow = nowMs();
            const deltaMs = Math.max(0, tickNow - lastTickAt);
            lastTickAt = tickNow;
            setGuitarSyncState((prev) => {
                const decay = (deltaMs / 1000) * GUITAR_SYNC_DECAY_PER_SECOND;
                const prevAirborne = Number(prev?.meter || 0) > GUITAR_SYNC_GROUND_THRESHOLD;
                const meter = clampLobby(Number(prev?.meter || 0) - decay, 0, 100);
                const airborne = meter > GUITAR_SYNC_GROUND_THRESHOLD;
                const droppedToGround = prevAirborne && !airborne;
                return {
                    ...prev,
                    meter,
                    streakMs: airborne ? Number(prev?.streakMs || 0) + deltaMs : 0,
                    airtimeMs: airborne ? Number(prev?.airtimeMs || 0) + deltaMs : Number(prev?.airtimeMs || 0),
                    drops: droppedToGround ? Number(prev?.drops || 0) + 1 : Number(prev?.drops || 0),
                    recentHits: (prev?.recentHits || []).filter((entry) => (tickNow - Number(entry?.timestampMs || 0)) < GUITAR_SYNC_EVENT_WINDOW_MS)
                };
            });
        }, 120);
        return () => clearInterval(timer);
    }, [room?.lightMode, room?.guitarSessionId]);

    const awardRoomPointsOnce = useCallback(async ({ awardKey, awards = [], source = 'tv_mode' }) => {
        if (!roomCode || !awardKey || !Array.isArray(awards) || !awards.length) {
            return { ok: false, skipped: true };
        }
        try {
            await callFunction('awardRoomPoints', {
                roomCode,
                awardKey,
                source,
                awards
            });
            return { ok: true };
        } catch (err) {
            tvLogger.debug('awardRoomPoints callable failed', awardKey, err?.message || err);
            return { ok: false, error: err, code: parseAwardFailureCode(err) };
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

    const getStormPhase = useCallback(() => {
        if (room?.lightMode !== 'storm') return 'off';
        if (!room?.stormStartedAt) return room?.stormPhase || 'approach';
        const cfg = room?.stormConfig || { approachMs: 15000, peakMs: 20000, passMs: 12000, clearMs: 6000 };
        const elapsed = nowMs() - room.stormStartedAt;
        if (elapsed < cfg.approachMs) return 'approach';
        if (elapsed < cfg.approachMs + cfg.peakMs) return 'peak';
        if (elapsed < cfg.approachMs + cfg.peakMs + cfg.passMs) return 'pass';
        if (elapsed < cfg.approachMs + cfg.peakMs + cfg.passMs + cfg.clearMs) return 'clear';
        return 'clear';
    }, [room?.lightMode, room?.stormStartedAt, room?.stormPhase, room?.stormConfig]);

    useEffect(() => {
        if (room?.lightMode !== 'storm') {
            setStormPhase('off');
            return;
        }
        const updatePhase = () => setStormPhase(getStormPhase());
        updatePhase();
        const timer = setInterval(updatePhase, 500);
        return () => clearInterval(timer);
    }, [room?.lightMode, getStormPhase]);

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
            setDoodleSubmittedUids([]);
            return;
        }
        const promptId = String(room.doodleOke.promptId || '').trim();
        const projectionId = buildDoodleOkeProjectionId(roomCode, promptId);
        if (!projectionId) {
            setDoodleSubmissions([]);
            setDoodleVotes([]);
            setDoodleSubmittedUids([]);
            return;
        }
        const projectionRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'doodle_oke_public', projectionId);
        return onSnapshot(projectionRef, (snap) => {
            const data = snap.data() || {};
            const submissions = Array.isArray(data?.submissions) ? data.submissions : [];
            const submittedUids = Array.isArray(data?.submittedUids)
                ? data.submittedUids.filter((entry) => typeof entry === 'string' && entry.trim())
                : [];
            const voteMap = data?.votesByVoterUid && typeof data.votesByVoterUid === 'object'
                ? data.votesByVoterUid
                : {};
            const votes = Object.entries(voteMap)
                .map(([voterUid, targetUid]) => ({
                    id: voterUid,
                    voterUid,
                    targetUid: typeof targetUid === 'string' ? targetUid : ''
                }))
                .filter((vote) => vote.targetUid);
            setDoodleSubmissions(submissions);
            setDoodleVotes(votes);
            setDoodleSubmittedUids(submittedUids);
        }, () => {
            setDoodleSubmissions([]);
            setDoodleVotes([]);
            setDoodleSubmittedUids([]);
        });
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

    const lobbyCueLastPlayedRef = useRef({});
    const lobbyCueNoiseCacheRef = useRef({});
    const playLobbyVolleyCue = useCallback((cue = 'hit', { intensity = 1 } = {}) => {
        if (!audioCtx) return;
        const ctx = audioCtx;
        const nowMsValue = nowMs();
        const throttles = {
            launch: 220,
            hit: 130,
            relay: 110,
            tier: 260,
            warning: 1000,
            reset: 480
        };
        const minGapMs = Number(throttles[cue] || 140);
        const lastPlayedAt = Number(lobbyCueLastPlayedRef.current?.[cue] || 0);
        if (nowMsValue - lastPlayedAt < minGapMs) return;
        lobbyCueLastPlayedRef.current = {
            ...(lobbyCueLastPlayedRef.current || {}),
            [cue]: nowMsValue
        };
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const gainBoost = clampLobby(Number(intensity || 1), 0.65, 1.7);
        const scheduleTone = (freq, durationSec, startOffsetSec, gainScale = 1, type = 'triangle') => {
            const startAt = now + startOffsetSec;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(Math.max(70, Number(freq || 440)), startAt);
            gain.gain.setValueAtTime(0.0001, startAt);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainScale * gainBoost), startAt + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, startAt + Math.max(0.05, durationSec));
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startAt);
            osc.stop(startAt + Math.max(0.07, durationSec + 0.05));
        };
        const getNoiseBuffer = (kind = 'white', durationSec = 0.2) => {
            const cacheKey = `${kind}:${durationSec.toFixed(3)}`;
            if (lobbyCueNoiseCacheRef.current[cacheKey]) return lobbyCueNoiseCacheRef.current[cacheKey];
            const frameCount = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
            const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
            const channel = buffer.getChannelData(0);
            let lastBrown = 0;
            for (let i = 0; i < frameCount; i += 1) {
                const white = (Math.random() * 2) - 1;
                if (kind === 'brown') {
                    lastBrown = (lastBrown + (0.02 * white)) / 1.02;
                    channel[i] = lastBrown * 3.5;
                } else {
                    channel[i] = white;
                }
            }
            lobbyCueNoiseCacheRef.current[cacheKey] = buffer;
            return buffer;
        };
        const scheduleNoise = ({
            startOffsetSec = 0,
            durationSec = 0.18,
            gainScale = 0.01,
            type = 'bandpass',
            frequency = 1200,
            q = 0.8,
            sweepTo = 4200,
            sweepCurve = 'exponential',
            noiseKind = 'white'
        } = {}) => {
            const startAt = now + startOffsetSec;
            const source = ctx.createBufferSource();
            source.buffer = getNoiseBuffer(noiseKind, durationSec + 0.08);
            const filter = ctx.createBiquadFilter();
            filter.type = type;
            filter.frequency.setValueAtTime(Math.max(40, frequency), startAt);
            if (sweepTo && sweepTo !== frequency) {
                const targetAt = startAt + Math.max(0.04, durationSec);
                if (sweepCurve === 'linear') {
                    filter.frequency.linearRampToValueAtTime(Math.max(40, sweepTo), targetAt);
                } else {
                    filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), targetAt);
                }
            }
            filter.Q.setValueAtTime(Math.max(0.0001, q), startAt);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.0001, startAt);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.00015, gainScale * gainBoost), startAt + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, startAt + Math.max(0.05, durationSec));
            source.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            source.start(startAt);
            source.stop(startAt + durationSec + 0.08);
        };
        switch (cue) {
            case 'launch':
                scheduleTone(262, 0.38, 0, 0.022, 'sine');
                scheduleTone(392, 0.42, 0.04, 0.028, 'triangle');
                scheduleTone(523, 0.48, 0.08, 0.02, 'sine');
                scheduleNoise({ startOffsetSec: 0.02, durationSec: 0.28, gainScale: 0.008, frequency: 380, sweepTo: 2200, q: 0.8, noiseKind: 'brown' });
                break;
            case 'relay':
                scheduleTone(466, 0.12, 0, 0.022, 'triangle');
                scheduleTone(740, 0.16, 0.03, 0.025, 'sawtooth');
                scheduleTone(1174, 0.18, 0.085, 0.017, 'square');
                scheduleNoise({ startOffsetSec: 0, durationSec: 0.16, gainScale: 0.01, frequency: 980, sweepTo: 5200, q: 1.6 });
                scheduleNoise({ startOffsetSec: 0.12, durationSec: 0.09, gainScale: 0.006, frequency: 2600, sweepTo: 6200, q: 3.4 });
                break;
            case 'tier':
                scheduleTone(220, 0.2, 0, 0.018, 'sine');
                scheduleTone(330, 0.28, 0.03, 0.022, 'triangle');
                scheduleTone(494, 0.36, 0.08, 0.024, 'sine');
                scheduleNoise({ startOffsetSec: 0.04, durationSec: 0.22, gainScale: 0.005, frequency: 1400, sweepTo: 4600, q: 1.2 });
                break;
            case 'warning':
                scheduleTone(174, 0.18, 0, 0.013, 'sine');
                scheduleTone(207, 0.18, 0.16, 0.011, 'triangle');
                scheduleNoise({ startOffsetSec: 0.01, durationSec: 0.12, gainScale: 0.0035, frequency: 300, sweepTo: 900, q: 0.9, noiseKind: 'brown' });
                break;
            case 'reset':
                scheduleTone(392, 0.14, 0, 0.012, 'triangle');
                scheduleTone(262, 0.28, 0.08, 0.016, 'sine');
                scheduleTone(174, 0.34, 0.16, 0.012, 'triangle');
                scheduleNoise({ startOffsetSec: 0.03, durationSec: 0.18, gainScale: 0.007, frequency: 1900, sweepTo: 180, q: 1.4, noiseKind: 'brown' });
                break;
            case 'hit':
            default:
                scheduleTone(220, 0.12, 0, 0.012, 'sine');
                scheduleTone(330, 0.16, 0.04, 0.009, 'triangle');
                scheduleNoise({ startOffsetSec: 0.01, durationSec: 0.08, gainScale: 0.0038, frequency: 1500, sweepTo: 3400, q: 2.2 });
                break;
        }
    }, [audioCtx]);

    useEffect(() => {
        playStormLayerPulseRef.current = playStormLayerPulse;
    }, [playStormLayerPulse]);

    useEffect(() => {
        playLobbyVolleyCueRef.current = playLobbyVolleyCue;
    }, [playLobbyVolleyCue]);

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
        if(!roomCode || isMarketingDemoFixture) return;
        trackEvent('tv_view', { room_code: roomCode });
        reactionScoreByDocRef.current = new Map();
        reactionScoreTotalsByPerformanceRef.current = new Map();
        setReactionScoreTotalsByPerformance(new Map());
        const unsubRoom = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), s => setRoom(s.data()));
        const unsubSongs = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), where('roomCode', '==', roomCode)), s => setSongs(s.docs.map(d => ({id:d.id, ...d.data()}))));
        
        const unsubActivity = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), where('roomCode', '==', roomCode), limit(8)), s => {
             const sorted = s.docs.map(d => d.data()).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
             setActivities(sorted);
        });

        const reactionsCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions');
        const reactionsQuery = query(
            reactionsCol,
            where('roomCode', '==', roomCode),
            orderBy('timestamp', 'desc'),
            limit(250)
        );
        const reactionsFallbackQuery = query(
            reactionsCol,
            where('roomCode', '==', roomCode)
        );
        const handleReactionSnapshot = (s) => {
            let scoreChanged = false;
            s.docChanges().forEach(c => {
                if (upsertReactionScoreContribution(c)) scoreChanged = true;
                if(c.type === 'added') {
                    const d = c.doc.data();
                    // Filter old reactions (prevent flood on reload)
                    if(nowMs() - (d.timestamp?.seconds * 1000 || nowMs()) < 5000) {
                        if (isVoteReactionType(d.type)) {
                            const count = Math.min(Math.max(1, Number(d.count || 1)), 3);
                            const totalCount = Math.max(1, Number(d.count || 1));
                            for (let i = 0; i < count; i += 1) {
                                const left = Math.random() * 80 + 10;
                                const motion = getTvReactionMotionSpec({ type: d.type, id: c.doc.id, index: i });
                                setTimeout(() => {
                                    setReactions(prev => [...prev, {
                                        id: `${c.doc.id}_${i}`,
                                        ...d,
                                        left,
                                        emojiChar: d.avatar || emoji(0x1F5F3, 0xFE0F),
                                        labelOverride: 'Vote',
                                        isVoteReaction: true,
                                        motionVariant: motion.variant,
                                        motionDurationMs: motion.durationMs,
                                        motionDriftX: motion.driftX,
                                        motionRiseY: motion.riseY,
                                        motionRotateDeg: motion.rotateDeg,
                                        motionScaleBoost: motion.scaleBoost,
                                        points: 0,
                                        basePoints: 0,
                                        multiplier: 1,
                                        createdAtMs: nowMs()
                                    }]);
                                }, i * 80);
                            }
                            pushLobbyLiveEvent({
                                id: `reaction-vote-${c.doc.id}`,
                                avatar: d.avatar || emoji(0x1F5F3, 0xFE0F),
                                user: d.userName || d.user || 'Guest',
                                text: `cast a ${totalCount > 1 ? `${totalCount}x ` : ''}vote`,
                                timestampMs: nowMs()
                            });
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
                            if (lobbyPausedRef.current) return;
                            const interactionType = normalizeLobbyPlayInteractionType(d.type);
                            const effect = getLobbyPlayEffectByInteractionType(interactionType);
                            if (!effect) return;
                            const ultimateMeta = getVolleyOrbUltimate(interactionType);
                            const isUltimate = !!ultimateMeta;
                            const eventTimestamp = getLobbyEventTimestampMs(d);
                            const burstTime = quantizeLobbyStartTime({
                                now: eventTimestamp,
                                micVolume: lobbyMicVolumeRef.current,
                                visualizerEnabled: lobbyVisualizerEnabledRef.current
                            });
                            const totalCount = Math.max(1, Number(d.count || 1));
                            const previousVolleyState = lobbyVolleyStateRef.current || createLobbyVolleyState();
                            const nextVolleyStateRaw = applyLobbyInteraction(
                                previousVolleyState,
                                {
                                    type: interactionType,
                                    count: totalCount,
                                    uid: d.uid || '',
                                    userName: d.userName || d.user || 'Guest',
                                    avatar: d.avatar || effect.icon,
                                    timestampMs: burstTime
                                },
                                burstTime
                            );
                            const tierTransitions = getTierTransitions(previousVolleyState, nextVolleyStateRaw);
                            const relayObjectiveBefore = deriveRelayObjective(previousVolleyState, burstTime);
                            const relayObjectiveAfter = deriveRelayObjective(nextVolleyStateRaw, burstTime);
                            const relayHit = Number(nextVolleyStateRaw?.relayChainCount || 0) > Number(previousVolleyState?.relayChainCount || 0);
                            const relayChainCount = Number(nextVolleyStateRaw?.relayChainCount || 0);
                            const relayPasserName = relayHit
                                ? String(nextVolleyStateRaw?.lastRelayPasserName || 'Guest')
                                : '';
                            const relayReceiverName = relayHit
                                ? String(nextVolleyStateRaw?.lastRelayReceiverName || (d.userName || d.user || 'Guest'))
                                : '';
                            const previousVolleyExpired = Number(previousVolleyState?.lastInteractionAtMs || 0) > 0
                                && (burstTime - Number(previousVolleyState?.lastInteractionAtMs || 0)) >= Number(LOBBY_PLAYGROUND_ENGINE_CONSTANTS?.STREAK_TIMEOUT_MS || 6200);
                            const previousVolleyActive = Number(previousVolleyState?.streakCount || 0) > 0
                                && Number(previousVolleyState?.lastInteractionAtMs || 0) > 0
                                && !previousVolleyExpired;
                            const volleyCue = relayHit
                                ? 'relay'
                                : tierTransitions.length
                                    ? 'tier'
                                    : previousVolleyActive
                                        ? 'hit'
                                        : 'launch';
                            playLobbyVolleyCueRef.current(
                                volleyCue,
                                { intensity: Math.min(1.6, 0.85 + (totalCount * 0.08) + (relayHit ? 0.22 : 0)) }
                            );
                            setLobbyLastInteraction({
                                id: `lobby-last-${c.doc.id}`,
                                interactionType,
                                label: effect.label,
                                icon: effect.icon,
                                user: d.userName || d.user || 'Guest',
                                relayHit,
                                relayChainCount,
                                nextTargetType: relayObjectiveAfter?.targetType || relayObjectiveBefore?.targetType || '',
                                timestampMs: burstTime
                            });
                            const activeParticipants = getActiveParticipants(nextVolleyStateRaw, burstTime);
                            const loadFactor = clampLobby(
                                (Number(nextVolleyStateRaw.energy || 0) / 100) + (Number(nextVolleyStateRaw.streakCount || 0) / 44),
                                0,
                                1.4
                            );
                            const reduceMotion = shouldDisableLobbyMotion(lobbyReduceMotionRef.current);
                            const keepScreenFx = isUltimate || relayHit || tierTransitions.length > 0 || !previousVolleyActive;
                            const keepTrailFx = relayHit || isUltimate;
                            const retentionMs = getLobbyRetentionMs({
                                reduceMotion,
                                loadFactor,
                                defaultMs: LOBBY_BURST_WINDOW_MS
                            });
                            const anchorSeed = burstTime + (c.doc.id.length * 17);
                            const anchor = getLobbyInteractionAnchor(interactionType, anchorSeed, nextVolleyStateRaw.streakCount);
                            const previousAnchor = lobbyLastAnchorRef.current;
                            lobbyLastAnchorRef.current = anchor;
                            const particleCount = isUltimate
                                ? Math.max(4, Math.min(LOBBY_PARTICLE_MAX, getLobbyBurstParticleCount({ reduceMotion, loadFactor })))
                                : Math.min(4, getLobbyBurstParticleCount({ reduceMotion, loadFactor }));
                            const symbols = Array.isArray(effect.particles) && effect.particles.length
                                ? effect.particles
                                : [effect.icon];
                            const particles = Array.from({ length: Math.min(LOBBY_PARTICLE_MAX, particleCount) }, (_, idx) => {
                                const particleSeed = anchorSeed + (idx * 19);
                                const angle = (Math.PI * 2 * idx) / Math.max(1, particleCount);
                                const radius = 18 + (seededUnit(particleSeed + 3) * 26);
                                return {
                                    id: `${c.doc.id}-particle-${idx}`,
                                    icon: symbols[idx % symbols.length],
                                    x: Math.cos(angle) * radius,
                                    y: Math.sin(angle) * radius * 0.8,
                                    delayMs: idx * 35
                                };
                            });
                            const burstEntry = {
                                id: `lobby-play-${c.doc.id}`,
                                label: effect.label,
                                icon: effect.icon,
                                accent: effect.accent,
                                motion: effect.motion || interactionType || 'wave',
                                aura: effect.aura || 'rgba(34,211,238,0.4)',
                                user: d.userName || d.user || 'Guest',
                                count: totalCount,
                                createdAt: burstTime,
                                durationMs: retentionMs,
                                left: anchor.x,
                                top: anchor.y,
                                scale: 0.94 + (seededUnit(anchorSeed + 6) * 0.24),
                                rotationDeg: -8 + (seededUnit(anchorSeed + 9) * 16),
                                risePx: 14 + Math.round(seededUnit(anchorSeed + 12) * 20),
                                particles,
                                staggerMs: 0,
                                contributionAlpha: getLobbyContributionAlpha(nextVolleyStateRaw?.interactions?.[0]?.weight || 1),
                                streakCount: nextVolleyStateRaw.streakCount,
                                relayHit,
                                relayChainCount
                            };
                            setLobbyPlayBursts((prev) => {
                                const active = (prev || []).filter(
                                    (entry) => (burstTime - Number(entry?.createdAt || 0)) < LOBBY_BURST_WINDOW_MS
                                );
                                return [burstEntry, ...active].slice(0, LOBBY_BURST_CAP);
                            });
                            if (keepScreenFx) {
                                const baseScreenFx = {
                                    id: `lobby-play-screen-${c.doc.id}`,
                                    motion: effect.motion || interactionType || 'wave',
                                    createdAt: burstTime,
                                    durationMs: getLobbyScreenFxDurationMs(effect.motion || interactionType || 'wave'),
                                    intensity: Math.min(isUltimate ? 5 : 3, (isUltimate ? 2 : 1) + totalCount),
                                    seed: anchorSeed,
                                    symbols,
                                    anchorX: anchor.x,
                                    anchorY: anchor.y
                                };
                                setLobbyPlayScreenFx((prev) => {
                                    const active = (prev || []).filter(
                                        (entry) => (burstTime - Number(entry?.createdAt || 0)) < LOBBY_SCREEN_FX_WINDOW_MS
                                    );
                                    return [baseScreenFx, ...active].slice(0, LOBBY_SCREEN_FX_CAP);
                                });
                            }
                            if (previousAnchor && keepTrailFx) {
                                const trailLength = getLobbyTrailLength({ reduceMotion, loadFactor });
                                if (trailLength > 0) {
                                    const beamColor = relayHit ? 'rgba(52,211,153,0.86)' : 'rgba(125,211,252,0.7)';
                                    setLobbyVolleyLinks((prev) => {
                                        const active = (prev || []).filter(
                                            (entry) => (burstTime - Number(entry?.createdAt || 0)) < LOBBY_LINK_WINDOW_MS
                                        );
                                        const next = [{
                                            id: `lobby-link-${c.doc.id}`,
                                            from: previousAnchor,
                                            to: anchor,
                                            createdAt: burstTime,
                                            durationMs: getLobbyRetentionMs({
                                                reduceMotion,
                                                loadFactor,
                                                defaultMs: LOBBY_LINK_WINDOW_MS
                                            }),
                                            color: beamColor,
                                            width: relayHit ? 9 : (isUltimate ? 6 : 4),
                                            mode: relayHit ? 'relay_chain' : 'relay'
                                        }, ...active];
                                        return next.slice(0, LOBBY_LINK_CAP);
                                    });
                                }
                            }
                            if (relayHit) {
                                setLobbyPlayScreenFx((prev) => {
                                    const active = (prev || []).filter(
                                        (entry) => (burstTime - Number(entry?.createdAt || 0)) < LOBBY_SCREEN_FX_WINDOW_MS
                                    );
                                    const relayFx = {
                                        id: `lobby-relay-screen-${c.doc.id}`,
                                        motion: 'prism_sweep_link',
                                        createdAt: burstTime,
                                        durationMs: getLobbyScreenFxDurationMs('prism_sweep_link'),
                                        intensity: Math.min(5, 2 + relayChainCount),
                                        seed: anchorSeed + 149,
                                        symbols,
                                        anchorX: anchor.x,
                                        anchorY: anchor.y
                                    };
                                    return [relayFx, ...active].slice(0, LOBBY_SCREEN_FX_CAP);
                                });
                            }
                            if (tierTransitions.length) {
                                setLobbyTierChips((prev) => {
                                    const additions = tierTransitions.map((transition, idx) => ({
                                        id: `lobby-tier-${c.doc.id}-${transition.tier}-${idx}`,
                                        label: `Tier ${transition.tier}: ${transition.name}`,
                                        tier: transition.tier,
                                        createdAt: burstTime + idx,
                                        durationMs: LOBBY_AWARD_VISUAL_WINDOW_MS,
                                        accent: transition.visualOnly
                                            ? 'from-cyan-300/65 to-indigo-300/65'
                                            : 'from-pink-300/70 to-yellow-300/70',
                                        subtitle: transition.visualOnly ? 'Visual moment unlocked' : 'Points moment unlocked'
                                    }));
                                    const active = (prev || []).filter(
                                        (entry) => (burstTime - Number(entry?.createdAt || 0)) < LOBBY_AWARD_VISUAL_WINDOW_MS
                                    );
                                    return [...additions, ...active].slice(0, LOBBY_TIER_CHIP_CAP);
                                });
                            }
                            let nextVolleyState = {
                                ...nextVolleyStateRaw,
                                activeParticipantCount: activeParticipants.length
                            };
                            const awardPayload = buildAwardPayload(nextVolleyState, burstTime);
                            const forceVisualOnlyRewards = lobbyVisualOnlyRef.current || lobbyAwardAuthLockedRef.current;
                            if (awardPayload?.shouldProcess) {
                                nextVolleyState = {
                                    ...(awardPayload.nextState || nextVolleyState),
                                    activeParticipantCount: activeParticipants.length,
                                    authFailureLocked: lobbyAwardAuthLockedRef.current || !!nextVolleyState.authFailureLocked
                                };
                                const tierMeta = getLobbyTierDefinition(awardPayload.tier);
                                const totalAwardedPoints = (awardPayload.awards || []).reduce(
                                    (sum, entry) => sum + Number(entry?.points || 0),
                                    0
                                );
                                const awardMultiplierLabel = Number(
                                    awardPayload.rewardMultiplier || awardPayload.teamworkMultiplier || 1
                                ).toFixed(1);
                                setLobbyTierChips((prev) => {
                                    const active = (prev || []).filter(
                                        (entry) => (burstTime - Number(entry?.createdAt || 0)) < LOBBY_AWARD_VISUAL_WINDOW_MS
                                    );
                                    const awardChip = {
                                        id: `lobby-award-${c.doc.id}-${awardPayload.tier}`,
                                        label: `Tier ${awardPayload.tier}: ${awardPayload.tierName || tierMeta?.name || 'Volley'}`,
                                        subtitle: (awardPayload.visualOnly || forceVisualOnlyRewards)
                                            ? 'Visual reward'
                                            : `${totalAwardedPoints} pts to active players (x${awardMultiplierLabel})`,
                                        tier: awardPayload.tier,
                                        createdAt: burstTime,
                                        durationMs: LOBBY_AWARD_VISUAL_WINDOW_MS,
                                        accent: (awardPayload.visualOnly || forceVisualOnlyRewards)
                                            ? 'from-cyan-300/65 to-indigo-300/65'
                                            : 'from-emerald-300/70 to-yellow-300/70'
                                    };
                                    return [awardChip, ...active].slice(0, LOBBY_TIER_CHIP_CAP);
                                });
                                if (!forceVisualOnlyRewards && !awardPayload.visualOnly && Array.isArray(awardPayload.awards) && awardPayload.awards.length) {
                                    if (lobbyAwardAuthLockedRef.current) {
                                        nextVolleyState.authFailureLocked = true;
                                    } else {
                                        void awardRoomPointsOnce({
                                            awardKey: awardPayload.awardKey,
                                            awards: awardPayload.awards,
                                            source: LOBBY_PLAYGROUND_REWARD_SOURCE
                                        }).then((result) => {
                                            if (result?.ok) return;
                                            const code = String(result?.code || '');
                                            if (!['permission-denied', 'unauthenticated', 'failed-precondition'].includes(code)) {
                                                return;
                                            }
                                            if (lobbyAwardAuthLockedRef.current) return;
                                            lobbyAwardAuthLockedRef.current = true;
                                            setLobbyVolleyState((prev) => ({ ...(prev || createLobbyVolleyState()), authFailureLocked: true }));
                                        });
                                    }
                                }
                            }
                            lobbyVolleyStateRef.current = nextVolleyState;
                            setLobbyVolleyState(nextVolleyState);
                            pushLobbyLiveEvent({
                                id: `lobby-play-live-${c.doc.id}`,
                                avatar: d.avatar || effect.icon,
                                user: d.userName || d.user || 'Guest',
                                text: relayHit
                                    ? `relayed the orb from ${relayPasserName} to ${relayReceiverName} (${effect.label.toLowerCase()}) chain x${relayChainCount}`
                                    : `kept the volley alive with ${effect.label.toLowerCase()}${totalCount > 1 ? ` x${totalCount}` : ''} (x${Number(nextVolleyState.teamworkMultiplier || 1).toFixed(1)} teamwork)`,
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
                            const strumCount = Math.max(1, Number(d.count || 1));
                            const eventTimestamp = nowMs();
                            const beatMs = getGuitarBeatMs({
                                micVolume: lobbyMicVolumeRef.current,
                                visualizerEnabled: lobbyVisualizerEnabledRef.current
                            });
                            const beatOffsetMs = getBeatOffsetMs(eventTimestamp, beatMs);
                            const timingScore = clampLobby(100 - ((beatOffsetMs / Math.max(1, beatMs / 2)) * 100), 0, 100);
                            const inBeatWindow = beatOffsetMs <= GUITAR_SYNC_BEAT_WINDOW_MS;
                            setGuitarSyncState((prev) => {
                                const baseGain = strumCount * GUITAR_SYNC_GAIN_PER_HIT;
                                const timingBoost = 0.72 + (timingScore / 100) * 0.7;
                                const meter = clampLobby(Number(prev?.meter || 0) + (baseGain * timingBoost), 0, 100);
                                return {
                                    ...prev,
                                    meter,
                                    cadenceScore: clampLobby((Number(prev?.cadenceScore || 0) * 0.58) + (timingScore * 0.42), 0, 100),
                                    perfectHits: Number(prev?.perfectHits || 0) + (inBeatWindow ? strumCount : 0),
                                    totalHits: Number(prev?.totalHits || 0) + strumCount,
                                    lastHitAt: eventTimestamp,
                                    recentHits: [
                                        ...(prev?.recentHits || []),
                                        {
                                            timestampMs: eventTimestamp,
                                            count: strumCount,
                                            uid: d.uid || ''
                                        }
                                    ].filter((entry) => (eventTimestamp - Number(entry?.timestampMs || 0)) < GUITAR_SYNC_EVENT_WINDOW_MS)
                                };
                            });
                            pushLobbyLiveEvent({
                                id: `strum-${c.doc.id}`,
                                avatar: d.avatar || EMOJI.guitar,
                                user: d.userName || d.user || 'Guest',
                                text: `${inBeatWindow ? 'hit the groove with' : 'sent'} ${strumCount} ${getLobbyReactionLabel('strum').toLowerCase()}${strumCount > 1 ? 's' : ''}${inBeatWindow ? ' in the sync window' : ''}`,
                                timestampMs: eventTimestamp
                            });
                            // Guitar strums are reflected in the live guitar leaderboard instead.
                        } else if (d.type === 'strobe_tap') {
                            const strobeCount = Math.max(1, Number(d.count || 1));
                            pushLobbyLiveEvent({
                                id: `strobe-${c.doc.id}`,
                                avatar: d.avatar || emoji(0x26A1),
                                user: d.userName || d.user || 'Guest',
                                text: `dropped ${strobeCount} beat tap${strobeCount > 1 ? 's' : ''}`,
                                timestampMs: nowMs()
                            });
                            // Strobe taps are reflected via room_users aggregates and dedicated mode HUD.
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
                                  const motion = getTvReactionMotionSpec({ type: d.type, id: c.doc.id, index: i });
                                  setTimeout(() => {
                                      setReactions(prev => [...prev, {
                                          id: `${c.doc.id}_${i}`,
                                          ...d,
                                          left,
                                          motionVariant: motion.variant,
                                          motionDurationMs: motion.durationMs,
                                          motionDriftX: motion.driftX,
                                          motionRiseY: motion.riseY,
                                          motionRotateDeg: motion.rotateDeg,
                                          motionScaleBoost: motion.scaleBoost,
                                          points,
                                          basePoints,
                                          multiplier,
                                          isVip,
                                          createdAtMs: nowMs()
                                      }]);
                                  }, i * 80);
                              }
                              if (currentPerformanceIdRef.current && d.performanceId === currentPerformanceIdRef.current) {
                                  enqueueFeaturedReaction({
                                      id: `featured-${c.doc.id}`,
                                      type: d.type,
                                      count: totalCount,
                                      userName: d.userName || d.user || 'Guest',
                                      avatar: d.avatar || EMOJI.sparkle,
                                      isVip,
                                      points: totalVal * Math.max(1, Number(multiplier || 1))
                                  });
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
            if (scoreChanged) {
                setReactionScoreTotalsByPerformance(new Map(reactionScoreTotalsByPerformanceRef.current));
            }
        };
        let unsubReactFallback = null;
        const unsubReact = watchQuerySnapshot(
            reactionsQuery,
            handleReactionSnapshot,
            {
                label: `tv:reactions:${roomCode}`,
                onFallback: (error) => {
                    if (String(error?.code || '') !== 'failed-precondition') return;
                    if (typeof unsubReactFallback === 'function') return;
                    unsubReactFallback = onSnapshot(reactionsFallbackQuery, handleReactionSnapshot);
                }
            }
        );

        // Live listener to room_users so we can show vibe racers during guitar mode
        const unsubVibe = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_users'), where('roomCode', '==', roomCode)), s => {
            const raw = s.docs.map((docSnap) => {
                const data = docSnap.data() || {};
                return {
                    id: docSnap.id,
                    ...data,
                    uid: resolveRoomUserUid({ ...data, id: docSnap.id })
                };
            });
            setRoomUsers(raw);
            const list = raw.map(u => ({
                uid: u.uid,
                name: u.name,
                avatar: u.avatar,
                guitarHits: u.guitarHits || 0,
                guitarSessionId: u.guitarSessionId || null,
                lastVibeAt: toEpochMs(u.lastVibeAt),
                strobeTaps: u.strobeTaps || 0,
                strobeSessionId: u.strobeSessionId || null
            }));
            const sorted = list.sort((a,b) => (b.guitarHits || 0) - (a.guitarHits || 0));
            setVibeUsers(sorted);
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
            if (typeof unsubReactFallback === 'function') unsubReactFallback();
            unsubMsg();
            unsubActivity();
            unsubVibe();
            messageTimeoutsRef.current.forEach(t => clearTimeout(t));
            messageTimeoutsRef.current = [];
        };
    }, [roomCode, isMarketingDemoFixture, pushLobbyLiveEvent, awardRoomPointsOnce, upsertReactionScoreContribution, enqueueFeaturedReaction]);

    useEffect(() => {
        if (isMarketingDemoFixture) {
            setChatMessages([]);
            return () => {};
        }
        if (!roomCode || !room?.chatShowOnTv) {
            setChatMessages([]);
            return () => {};
        }
        const chatQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'),
            where('roomCode', '==', roomCode),
            orderBy('timestamp', 'desc'),
            limit(20)
        );
        const unsubChat = watchQuerySnapshot(
            chatQuery,
            (snap) => {
                const visibleMessages = snap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .reverse()
                    .filter(isTvVisibleChatMessage);
                setChatMessages(visibleMessages);
            },
            {
                label: `tv:chat_messages:${roomCode}`,
                onFallback: () => setChatMessages([])
            }
        );
        return () => unsubChat();
    }, [roomCode, room?.chatShowOnTv, isMarketingDemoFixture]);

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
        const promptId = String(room.selfieChallenge.promptId || '').trim();
        const projectionId = buildSelfieChallengeProjectionId(roomCode, promptId);
        if (!projectionId) {
            setSelfieSubmissions([]);
            setSelfieVotes([]);
            return;
        }
        const projectionRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_challenge_public', projectionId);
        return onSnapshot(projectionRef, (snap) => {
            const data = snap.data() || {};
            const submissions = Array.isArray(data?.submissions) ? data.submissions : [];
            const voteMap = data?.votesByVoterUid && typeof data.votesByVoterUid === 'object'
                ? data.votesByVoterUid
                : {};
            const votes = Object.entries(voteMap)
                .map(([voterUid, targetUid]) => ({
                    id: voterUid,
                    voterUid,
                    targetUid: typeof targetUid === 'string' ? targetUid : ''
                }))
                .filter((vote) => vote.targetUid);
            setSelfieSubmissions(submissions);
            setSelfieVotes(votes);
        }, () => {
            setSelfieSubmissions([]);
            setSelfieVotes([]);
        });
    }, [room?.activeMode, room?.selfieChallenge?.promptId, roomCode]);
    useEffect(() => {
        const promptId = String(room?.selfieChallenge?.promptId || '').trim();
        if (room?.activeMode !== 'selfie_challenge' || !promptId) {
            lastSelfiePromptIdRef.current = '';
            visibleSelfieSubmissionIdsRef.current = new Set();
            selfieArrivalQueueRef.current = [];
            if (selfieArrivalTimerRef.current) {
                clearTimeout(selfieArrivalTimerRef.current);
                selfieArrivalTimerRef.current = null;
            }
            setSelfieArrivalSpotlight(null);
            return;
        }
        if (lastSelfiePromptIdRef.current !== promptId) {
            lastSelfiePromptIdRef.current = promptId;
            visibleSelfieSubmissionIdsRef.current = new Set(visibleSelfieSubmissions.map((submission) => submission.id));
            selfieArrivalQueueRef.current = [];
            if (selfieArrivalTimerRef.current) {
                clearTimeout(selfieArrivalTimerRef.current);
                selfieArrivalTimerRef.current = null;
            }
            setSelfieArrivalSpotlight(null);
            return;
        }
        const seenIds = visibleSelfieSubmissionIdsRef.current;
        const freshSubmissions = visibleSelfieSubmissions.filter((submission) => submission?.id && !seenIds.has(submission.id));
        freshSubmissions.forEach((submission) => seenIds.add(submission.id));
        freshSubmissions
            .sort((a, b) => toEpochMs(a?.timestamp) - toEpochMs(b?.timestamp))
            .forEach((submission) => {
                enqueueSelfieArrivalSpotlight({
                    id: submission.id,
                    url: submission.url,
                    userName: submission.userName || 'Guest',
                    avatar: submission.avatar || EMOJI.camera,
                    votes: selfieVoteCounts[submission.uid] || 0
                });
            });
    }, [
        room?.activeMode,
        room?.selfieChallenge?.promptId,
        visibleSelfieSubmissions,
        selfieVoteCounts,
        enqueueSelfieArrivalSpotlight
    ]);

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
        if (!roomCode) {
            setCrowdSelfieWall([]);
            return undefined;
        }
        const submissionsQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'crowd_selfie_submissions'),
            where('roomCode', '==', roomCode)
        );
        const unsub = onSnapshot(
            submissionsQuery,
            (snap) => {
                const next = snap.docs
                    .map((entry) => ({ id: entry.id, ...entry.data() }))
                    .filter((entry) => String(entry.status || '').trim().toLowerCase() === 'approved')
                    .sort((a, b) => {
                        const aTs = typeof a?.timestamp?.toMillis === 'function' ? a.timestamp.toMillis() : Number(a?.timestamp || 0);
                        const bTs = typeof b?.timestamp?.toMillis === 'function' ? b.timestamp.toMillis() : Number(b?.timestamp || 0);
                        return bTs - aTs;
                    })
                    .slice(0, 12);
                setCrowdSelfieWall(next);
            },
            () => setCrowdSelfieWall([])
        );
        return () => unsub();
    }, [roomCode]);
    useEffect(() => {
        const drop = room?.bonusDrop;
        if (!drop?.id) return;
        if (lastBonusDropRef.current === drop.id) return;
        lastBonusDropRef.current = drop.id;
        setBonusDropBurst({ ...drop });
        const t = setTimeout(() => setBonusDropBurst(null), 6000);
        return () => clearTimeout(t);
    }, [room?.bonusDrop?.id, room?.bonusDrop]);
    useEffect(() => {
        const celebration = normalizePurchaseCelebration(room?.purchaseCelebration || {});
        if (!celebration.id) return;
        if (lastPurchaseCelebrationRef.current === celebration.id) return;
        if (celebration.createdAtMs > 0 && (Date.now() - celebration.createdAtMs) > 120000) {
            lastPurchaseCelebrationRef.current = celebration.id;
            return;
        }
        lastPurchaseCelebrationRef.current = celebration.id;
        setPurchaseCelebrationBurst(celebration);
        const t = setTimeout(() => setPurchaseCelebrationBurst(null), 6500);
        return () => clearTimeout(t);
    }, [room?.purchaseCelebration]);

    // --- EFFECT: Loop & Logic ---
    useEffect(() => { comboRef.current = combo; }, [combo]);
    useEffect(() => {
        const i = setInterval(() => {
            const tickNow = nowMs();
            const tickCurrentSong = songs.find((song) => song.status === 'performing');
            const tickLobbyObjectiveMode = getCrowdObjectiveModeFromLightMode(room?.lightMode)
                || getCrowdObjectiveModeById(CROWD_OBJECTIVE_DEFAULT_MODE_ID);
            const tickLobbyObjectiveIsTeamPong = tickLobbyObjectiveMode?.id === 'team_pong';
            const tickLobbySceneActive = isVolleyOrbSceneActive({
                hasCurrentSinger: !!tickCurrentSong,
                activeMode: room?.activeMode,
                lightMode: room?.lightMode
            });
            const tickGroundLineBottomPct = tickLobbySceneActive ? 3.2 : 4.4;
            const tickGroundLineTopPct = 100 - tickGroundLineBottomPct;
            setReactions(prev => prev.filter((r) => (tickNow - Number(r?.createdAtMs || toEpochMs(r?.timestamp) || 0)) < TV_REACTION_VISIBILITY_MS));
            setLobbyPlayBursts((prev) => prev.filter((burst) => (tickNow - Number(burst?.createdAt || 0)) < LOBBY_BURST_WINDOW_MS));
            setLobbyPlayScreenFx((prev) => prev.filter((entry) => (tickNow - Number(entry?.createdAt || 0)) < LOBBY_SCREEN_FX_WINDOW_MS));
            setLobbyComboMoments((prev) => prev.filter((entry) => (tickNow - Number(entry?.createdAtMs || 0)) < LOBBY_COMBO_WINDOW_MS));
            setLobbyAssistMoments((prev) => prev.filter((entry) => (tickNow - Number(entry?.createdAtMs || 0)) < LOBBY_ASSIST_WINDOW_MS));
            setLobbyVolleyLinks((prev) => prev.filter((entry) => (tickNow - Number(entry?.createdAt || 0)) < LOBBY_LINK_WINDOW_MS));
            setLobbyTierChips((prev) => prev.filter((entry) => (tickNow - Number(entry?.createdAt || 0)) < LOBBY_AWARD_VISUAL_WINDOW_MS));
            let groundedVolleySummary = null;
            let altitudeRewardPayloads = [];
            setLobbyVolleyState((prev) => {
                if (!prev) return prev;
                const lastAt = Number(prev.lastInteractionAtMs || 0);
                if (!lastAt) return prev;
                const elapsedMs = Math.max(0, tickNow - lastAt);
                const liveEnergy = Math.max(0, Number(prev.energy || 0) - ((elapsedMs / 1000) * getLobbyVolleyDecayPerSec(prev, tickNow)));
                const timeoutMs = getLobbyVolleyDynamicTimeoutMs(prev, tickNow);
                const groundedAtMs = timeoutMs + Number(LOBBY_PLAYGROUND_ENGINE_CONSTANTS?.GROUND_HIT_GRACE_MS || 360);
                if (elapsedMs > groundedAtMs && Number(prev.streakCount || 0) > 0) {
                    const resetState = {
                        ...createLobbyVolleyState(),
                        streakId: Number(prev.streakId || 0) + 1,
                        lastPayoutAtMs: Number(prev.lastPayoutAtMs || 0),
                        authFailureLocked: !!prev.authFailureLocked
                    };
                    groundedVolleySummary = {
                        streakCount: Number(prev.streakCount || 0),
                        teamworkMultiplier: Number(prev.teamworkMultiplier || 1),
                        peakAltitudeFt: Number(prev.peakAltitudeFt || 0)
                    };
                    lobbyVolleyStateRef.current = resetState;
                    lobbyLastAnchorRef.current = null;
                    return resetState;
                }
                const airborneMs = deriveAirborneMs(prev, tickNow);
                const teamworkMultiplier = deriveTeamworkMultiplier(prev, tickNow);
                const tickLobbyLevelMeta = getLobbyVolleyLevelMeta(prev, tickNow);
                const tickActiveUltimates = Array.isArray(prev?.activeUltimates)
                    ? prev.activeUltimates.filter((entry) => Number(entry?.expiresAtMs || 0) > tickNow)
                    : [];
                const tickOrbLensActive = tickActiveUltimates.some((entry) => entry?.type === 'ultimate_lens');
                const tickOrbDiameterPx = clampLobby((Number(viewportSize?.width || 1920) * 0.2), 198, 292);
                const tickOrbShrinkScale = tickOrbLensActive ? 0.76 : 1;
                const tickOrbRadiusPct = ((tickOrbDiameterPx * tickOrbShrinkScale) * 0.5 / Math.max(1, Number(viewportSize?.height || 1080))) * 100;
                const tickOrbRestCenterTopPct = clampLobby(
                    tickGroundLineTopPct - tickOrbRadiusPct,
                    LOBBY_ORB_MIN_TOP_PCT,
                    tickGroundLineTopPct - 1
                );
                const altitudeState = !tickLobbyObjectiveIsTeamPong
                    ? getLobbyVolleyAltitudeState({
                        hasActiveVolley: Number(prev.streakCount || 0) > 0,
                        state: prev,
                        now: tickNow,
                        energy: liveEnergy,
                        levelSpeed: Number(tickLobbyLevelMeta.speedMultiplier || 1),
                        baseTopPct: getLobbyOrbTopPct({
                            hasStreak: Number(prev.streakCount || 0) > 0,
                            streakDecayPct: clampLobby(
                                100 - ((elapsedMs / Math.max(1, getLobbyVolleyDynamicTimeoutMs(prev, tickNow))) * 100),
                                0,
                                100
                            ),
                            groundTopPct: tickGroundLineTopPct,
                            restCenterTopPct: tickOrbRestCenterTopPct
                        }),
                        restCenterTopPct: tickOrbRestCenterTopPct,
                        shrinkActive: tickOrbLensActive
                    })
                    : { altitudeFt: 0 };
                const peakAltitudeFt = Math.max(Number(prev.peakAltitudeFt || 0), Number(altitudeState.altitudeFt || 0));
                const altitudeAwards = !tickLobbyObjectiveIsTeamPong
                    ? buildLobbyAltitudeAwardPayloads({
                        state: prev,
                        peakAltitudeFt,
                        now: tickNow
                    })
                    : { paidAltitudeKeys: prev.paidAltitudeKeys || {}, payloads: [] };
                altitudeRewardPayloads = altitudeAwards.payloads || [];
                const needsEnergyUpdate = Math.abs(liveEnergy - Number(prev.energy || 0)) >= 0.05;
                const needsAirborneUpdate = Math.abs(airborneMs - Number(prev.airborneMs || 0)) >= 40;
                const needsMultiplierUpdate = Math.abs(teamworkMultiplier - Number(prev.teamworkMultiplier || 1)) >= 0.1;
                const needsPeakUpdate = peakAltitudeFt > Number(prev.peakAltitudeFt || 0);
                const needsAltitudeKeyUpdate = JSON.stringify(Object.keys(altitudeAwards.paidAltitudeKeys || {}).sort())
                    !== JSON.stringify(Object.keys(prev.paidAltitudeKeys || {}).sort());
                if (!needsEnergyUpdate && !needsAirborneUpdate && !needsMultiplierUpdate && !needsPeakUpdate && !needsAltitudeKeyUpdate) return prev;
                const next = {
                    ...prev,
                    energy: liveEnergy,
                    airborneMs,
                    peakAltitudeFt,
                    teamworkMultiplier,
                    paidAltitudeKeys: altitudeAwards.paidAltitudeKeys || prev.paidAltitudeKeys || {}
                };
                lobbyVolleyStateRef.current = next;
                return next;
            });
            if (groundedVolleySummary) {
                const groundedMode = tickLobbyObjectiveMode;
                const groundedModeLabel = groundedMode?.label || 'Volley Orb';
                const groundedCountLabel = groundedMode?.id === 'team_pong' ? 'rallies' : 'saves';
                setLobbyTierChips((prev) => {
                    const active = (prev || []).filter(
                        (entry) => (tickNow - Number(entry?.createdAt || 0)) < LOBBY_AWARD_VISUAL_WINDOW_MS
                    );
                    const groundChip = {
                        id: `lobby-ground-${tickNow}`,
                        label: groundedMode?.id === 'team_pong' ? 'Rally dropped' : 'Orb touched the ground',
                        subtitle: groundedMode?.id === 'team_pong'
                            ? `${groundedModeLabel} ended at ${groundedVolleySummary.streakCount} ${groundedCountLabel}`
                            : `${groundedModeLabel} ended at ${groundedVolleySummary.streakCount} ${groundedCountLabel} | peak ${Math.round(groundedVolleySummary.peakAltitudeFt || 0)}ft`,
                        tier: 0,
                        createdAt: tickNow,
                        durationMs: LOBBY_AWARD_VISUAL_WINDOW_MS,
                        accent: 'from-amber-300/70 to-red-300/70'
                    };
                    return [groundChip, ...active].slice(0, LOBBY_TIER_CHIP_CAP);
                });
                pushLobbyLiveEvent({
                    id: `lobby-ground-live-${tickNow}`,
                    avatar: EMOJI.warning || emoji(0x26A0),
                    user: groundedModeLabel,
                    text: groundedMode?.id === 'team_pong'
                        ? `rally dropped at x${Number(groundedVolleySummary.teamworkMultiplier || 1).toFixed(1)} teamwork. Restart the rally!`
                        : `touched the ground at x${Number(groundedVolleySummary.teamworkMultiplier || 1).toFixed(1)} teamwork. Rally again!`,
                    timestampMs: tickNow
                });
            }
            if (altitudeRewardPayloads.length) {
                setLobbyTierChips((prev) => {
                    const active = (prev || []).filter(
                        (entry) => (tickNow - Number(entry?.createdAt || 0)) < LOBBY_AWARD_VISUAL_WINDOW_MS
                    );
                    const additions = altitudeRewardPayloads.map((payload, idx) => ({
                        id: `lobby-altitude-${payload.milestone.id}-${tickNow}-${idx}`,
                        label: `${payload.milestone.label} reached`,
                        subtitle: payload.visualOnly
                            ? `${payload.milestone.minFt}ft peak unlocked`
                            : `${payload.milestone.minFt}ft peak: points to the active rally crew`,
                        tier: 0,
                        createdAt: tickNow + idx,
                        durationMs: LOBBY_AWARD_VISUAL_WINDOW_MS,
                        accent: payload.visualOnly
                            ? 'from-cyan-300/65 to-indigo-300/65'
                            : 'from-amber-300/70 to-emerald-300/70'
                    }));
                    return [...additions, ...active].slice(0, LOBBY_TIER_CHIP_CAP);
                });
                altitudeRewardPayloads.forEach((payload) => {
                    const pointsLocked = lobbyVisualOnlyRef.current || lobbyAwardAuthLockedRef.current;
                    pushLobbyLiveEvent({
                        id: `lobby-altitude-live-${payload.milestone.id}-${tickNow}`,
                        avatar: emoji(0x1F31F),
                        user: payload.milestone.label,
                        text: (payload.visualOnly || pointsLocked)
                            ? `the orb broke through ${payload.milestone.minFt}ft`
                            : `the orb broke through ${payload.milestone.minFt}ft and rewarded the active rally crew`,
                        timestampMs: tickNow
                    });
                    if (!pointsLocked && !payload.visualOnly && payload.awards.length) {
                        void awardRoomPointsOnce({
                            awardKey: payload.awardKey,
                            awards: payload.awards,
                            source: `${LOBBY_PLAYGROUND_REWARD_SOURCE}_altitude`
                        });
                    }
                });
            }
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
    }, [
        showHypeMeter,
        pushLobbyLiveEvent,
        room?.activeMode,
        room?.lightMode,
        songs,
        viewportSize?.height,
        viewportSize?.width,
        awardRoomPointsOnce
    ]);
    
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

    const performanceRecapBreakdownMs = Math.max(
        3000,
        Math.min(
            12000,
            Math.round(Number(room?.performanceRecapBreakdownMs ?? DEFAULT_PERFORMANCE_RECAP_BREAKDOWN_MS) || DEFAULT_PERFORMANCE_RECAP_BREAKDOWN_MS)
        )
    );
    const performanceRecapLeaderboardMs = Math.max(
        3000,
        Math.min(
            12000,
            Math.round(Number(room?.performanceRecapLeaderboardMs ?? DEFAULT_PERFORMANCE_RECAP_LEADERBOARD_MS) || DEFAULT_PERFORMANCE_RECAP_LEADERBOARD_MS)
        )
    );
    const performanceRecapTotalMs = performanceRecapBreakdownMs + performanceRecapLeaderboardMs;
    const applauseWarmupSec = Math.max(
        0,
        Math.min(8, Math.round(Number(room?.applauseWarmupSec ?? DEFAULT_APPLAUSE_WARMUP_SEC) || DEFAULT_APPLAUSE_WARMUP_SEC))
    );
    const applauseCountdownSec = Math.max(
        1,
        Math.min(8, Math.round(Number(room?.applauseCountdownSec ?? DEFAULT_APPLAUSE_COUNTDOWN_SEC) || DEFAULT_APPLAUSE_COUNTDOWN_SEC))
    );
    const applauseMeasureSec = Math.max(
        2,
        Math.min(10, Math.round(Number(room?.applauseMeasureSec ?? DEFAULT_APPLAUSE_MEASURE_SEC) || DEFAULT_APPLAUSE_MEASURE_SEC))
    );

    // Auto Recap
    useEffect(() => {
        if (room?.activeMode && room.activeMode !== 'karaoke') return;
        if (room?.activeScreen && room.activeScreen !== 'stage') return;
        if (room?.showPerformanceRecap === false) {
            if (recap && !recap.preview) setRecap(null);
            return;
        }
        if(room?.lastPerformance) {
            const lastTs = getTimestampMs(room.lastPerformance.timestamp);
            if (!lastTs) return undefined;
            const timeSinceEnd = nowMs() - lastTs;
            if (timeSinceEnd < performanceRecapTotalMs) {
                if (!recap || room.lastPerformance.timestamp !== recap.timestamp) {
                    setRecap(room.lastPerformance);
                }
                const remaining = performanceRecapTotalMs - timeSinceEnd;
                const t = setTimeout(() => setRecap(null), remaining);
                return () => clearTimeout(t);
            } else {
                if(recap) setRecap(null);
            }
        }
    }, [room?.lastPerformance, room?.activeMode, room?.activeScreen, room?.showPerformanceRecap, recap, performanceRecapTotalMs]);

    useEffect(() => {
        if (!room?.recapPreview?.timestamp) return;
        const previewTs = getTimestampMs(room.recapPreview.timestamp);
        if (!previewTs) return;
        if (recapPreviewRef.current === previewTs) return;
        recapPreviewRef.current = previewTs;
        setRecap(room.recapPreview);
        const t = setTimeout(() => setRecap(null), performanceRecapTotalMs);
        return () => clearTimeout(t);
    }, [room?.recapPreview?.timestamp, room?.recapPreview, performanceRecapTotalMs]);

    useEffect(() => {
        if (!recap) return undefined;
        setRecapNowMs(nowMs());
        const timer = setInterval(() => setRecapNowMs(nowMs()), 120);
        return () => clearInterval(timer);
    }, [recap]);

    const triggerTipPulse = useCallback((key) => {
        if (!room?.tipUrl && !room?.tipQrUrl && !getRoomSupportSurface(room).url) return;
        if (lastTipKey.current === key) return;
        lastTipKey.current = key;
        setTipPulse(true);
        if (tipPulseTimer.current) clearTimeout(tipPulseTimer.current);
        tipPulseTimer.current = setTimeout(() => setTipPulse(false), 9000);
    }, [room]);
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
            setApplauseStep(applauseWarmupSec > 0 ? 'celebrate' : 'countdown');
            setCelebrateCountdown(applauseWarmupSec);
            setCountdown(applauseCountdownSec);
            setMeasure(applauseMeasureSec);
            setApplauseMax(0);
        }
    }, [room?.activeMode, applauseStep, applauseCountdownSec, applauseMeasureSec, applauseWarmupSec]);
    useEffect(() => () => {
        if (applauseResetRef.current) clearTimeout(applauseResetRef.current);
    }, []);

    useEffect(() => {
        let timer;
        if (applauseStep === 'celebrate') {
            if (celebrateCountdown > 0) timer = setTimeout(() => setCelebrateCountdown((c) => c - 1), 1000);
            else setApplauseStep('countdown');
        } else if (applauseStep === 'countdown') {
            if (countdown > 0) timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
            else {
                setApplauseStep('measuring');
                setMeasure(applauseMeasureSec);
                updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { activeMode: 'applause' });
            }
        } else if (applauseStep === 'measuring') {
            if (measure > 0) timer = setTimeout(() => setMeasure((m) => m - 1), 1000);
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
    }, [applauseStep, celebrateCountdown, countdown, measure, applauseMax, roomCode, triggerTipPulse, applauseMeasureSec]);

    const current = songs.find(s => s.status === 'performing');
    const runOfShowDirector = useMemo(
        () => normalizeRunOfShowDirector(room?.runOfShowDirector || {}),
        [room?.runOfShowDirector]
    );
    const runOfShowLiveItem = useMemo(
        () => getRunOfShowLiveItem(runOfShowDirector),
        [runOfShowDirector]
    );
    const runOfShowStagedItem = useMemo(
        () => getRunOfShowStagedItem(runOfShowDirector),
        [runOfShowDirector]
    );
    const runOfShowNextItem = useMemo(
        () => getNextRunOfShowItem(runOfShowDirector),
        [runOfShowDirector]
    );
    const runOfShowHud = useMemo(() => {
        if (room?.runOfShowEnabled !== true) return null;
        const runOfShowItems = Array.isArray(runOfShowDirector?.items) ? runOfShowDirector.items : [];
        const liveItem = runOfShowLiveItem;
        const stagedOrNextItem = runOfShowStagedItem || (runOfShowNextItem?.id !== liveItem?.id ? runOfShowNextItem : null);
        if (!liveItem && !stagedOrNextItem) return null;
        const activeIndex = runOfShowItems.findIndex((item) => (
            item?.id
            && (
                item.id === liveItem?.id
                || item.id === runOfShowStagedItem?.id
                || item.id === runOfShowNextItem?.id
            )
        ));
        const fallbackIndex = runOfShowItems.findIndex((item) => {
            const status = String(item?.status || '').trim().toLowerCase();
            return !['complete', 'skipped'].includes(status);
        });
        const showRemainingMs = (() => {
            const startIndex = activeIndex >= 0 ? activeIndex : fallbackIndex;
            if (startIndex < 0) return 0;
            let totalMs = 0;
            runOfShowItems.forEach((item, index) => {
                const status = String(item?.status || '').trim().toLowerCase();
                if (index < startIndex || ['complete', 'skipped'].includes(status)) return;
                const isCurrentLive = item?.id && item.id === liveItem?.id;
                const isPerformanceItem = String(item?.type || '').trim().toLowerCase() === 'performance';
                const performanceIntroActive = isCurrentLive
                    && isPerformanceItem
                    && room?.announcement?.active
                    && String(room?.announcement?.runOfShowItemId || '').trim() === String(item?.id || '').trim()
                    && String(room?.announcement?.takeoverScene || room?.announcement?.type || '').trim().toLowerCase() === 'performance_intro';
                const plannedDurationSec = Math.max(
                    0,
                    Number(
                        isPerformanceItem
                            ? (String(item?.plannedDurationSource || '').trim().toLowerCase() === 'backing'
                                ? (item?.backingPlan?.durationSec || item?.plannedDurationSec || 0)
                                : (item?.plannedDurationSec || item?.backingPlan?.durationSec || 0))
                            : (item?.plannedDurationSec || 0)
                    ) || 0
                );
                if (!isCurrentLive) {
                    totalMs += plannedDurationSec * 1000;
                    return;
                }
                const liveDurationSec = Math.max(
                    0,
                    Number(
                        isPerformanceItem
                            ? (
                                performanceIntroActive
                                    ? (room?.announcement?.durationSec || plannedDurationSec)
                                    : (room?.currentPerformanceMeta?.durationSec || current?.performanceStartedDurationSec || current?.duration || plannedDurationSec)
                            )
                            : plannedDurationSec
                    ) || 0
                );
                const liveStartedAtMs = Math.max(
                    0,
                    Number(
                        isPerformanceItem
                            ? (
                                performanceIntroActive
                                    ? (room?.announcement?.startedAtMs || item?.liveStartedAtMs || 0)
                                    : (room?.currentPerformanceMeta?.startedAtMs || getTimestampMs(current?.performingStartedAt) || item?.liveStartedAtMs || 0)
                            )
                            : (item?.liveStartedAtMs || 0)
                    ) || 0
                );
                if (liveDurationSec > 0 && liveStartedAtMs > 0) {
                    totalMs += Math.max(0, (liveStartedAtMs + (liveDurationSec * 1000)) - takeoverNowMs);
                } else {
                    totalMs += liveDurationSec * 1000;
                }
            });
            return Math.max(0, totalMs);
        })();
        if (liveItem) {
            const isPerformance = liveItem.type === 'performance';
            const performanceIntroActive = isPerformance
                && room?.announcement?.active
                && String(room?.announcement?.runOfShowItemId || '').trim() === String(liveItem?.id || '').trim()
                && String(room?.announcement?.takeoverScene || room?.announcement?.type || '').trim().toLowerCase() === 'performance_intro';
            const liveTitle = isPerformance
                ? (String(liveItem?.assignedPerformerName || current?.singerName || 'Performance Live').trim() || 'Performance Live')
                : (String(liveItem?.presentationPlan?.headline || liveItem?.title || getRunOfShowItemLabel(liveItem?.type || '')).trim() || 'Run Of Show');
            const liveSubtitle = isPerformance
                ? [liveItem?.songTitle || current?.songTitle, liveItem?.artistName || current?.artist].filter(Boolean).join(' · ')
                : (String(
                    liveItem?.presentationPlan?.subhead
                    || liveItem?.notes
                    || formatExperienceLabel(liveItem?.roomMomentPlan?.activeScreen || liveItem?.roomMomentPlan?.activeMode || liveItem?.type || '')
                ).trim());
            const durationSec = Math.max(
                0,
                Number(
                    isPerformance
                        ? (performanceIntroActive
                            ? (room?.announcement?.durationSec || 0)
                            : (room?.currentPerformanceMeta?.durationSec || current?.performanceStartedDurationSec || current?.duration || liveItem?.plannedDurationSec || 0))
                        : (liveItem?.plannedDurationSec || 0)
                ) || 0
            );
            const startedAtMs = Math.max(
                0,
                Number(
                    isPerformance
                        ? (performanceIntroActive
                            ? (room?.announcement?.startedAtMs || liveItem?.liveStartedAtMs || 0)
                            : (room?.currentPerformanceMeta?.startedAtMs || getTimestampMs(current?.performingStartedAt) || liveItem?.liveStartedAtMs || 0))
                        : (liveItem?.liveStartedAtMs || 0)
                ) || 0
            );
            const remainingMs = durationSec > 0 && startedAtMs
                ? Math.max(0, (startedAtMs + (durationSec * 1000)) - takeoverNowMs)
                : 0;
            const progressPct = durationSec > 0 && startedAtMs
                ? Math.max(0, Math.min(100, ((durationSec * 1000) - remainingMs) / (durationSec * 10)))
                : 0;
            const nextLabel = stagedOrNextItem
                ? `Up next: ${String(stagedOrNextItem?.title || stagedOrNextItem?.songTitle || getRunOfShowItemLabel(stagedOrNextItem?.type || '')).trim() || 'Next block'}`
                : '';
            return {
                eyebrow: performanceIntroActive ? 'Run Of Show Singer Transition' : (isPerformance ? 'Run Of Show Live Performance' : 'Run Of Show Live'),
                title: liveTitle,
                subtitle: liveSubtitle,
                nextLabel,
                remainingMs,
                showRemainingMs,
                progressPct,
                countdownLabel: performanceIntroActive ? 'Song Starts In' : (isPerformance ? 'Song Ends In' : 'Screen Ends In')
            };
        }
        return {
            eyebrow: 'Run Of Show Staged',
            title: String(stagedOrNextItem?.title || stagedOrNextItem?.songTitle || getRunOfShowItemLabel(stagedOrNextItem?.type || '')).trim() || 'Next block',
            subtitle: String(
                stagedOrNextItem?.assignedPerformerName
                || stagedOrNextItem?.presentationPlan?.subhead
                || stagedOrNextItem?.notes
                || formatExperienceLabel(stagedOrNextItem?.roomMomentPlan?.activeScreen || stagedOrNextItem?.roomMomentPlan?.activeMode || stagedOrNextItem?.type || '')
            ).trim(),
            nextLabel: '',
            remainingMs: 0,
            showRemainingMs,
            progressPct: 0,
            countdownLabel: ''
        };
    }, [
        current,
        room?.announcement?.active,
        room?.announcement?.durationSec,
        room?.announcement?.runOfShowItemId,
        room?.announcement?.startedAtMs,
        room?.announcement?.takeoverScene,
        room?.announcement?.type,
        room?.currentPerformanceMeta?.durationSec,
        room?.currentPerformanceMeta?.startedAtMs,
        room?.runOfShowEnabled,
        runOfShowDirector?.items,
        runOfShowLiveItem,
        runOfShowNextItem,
        runOfShowStagedItem,
        takeoverNowMs
    ]);
    const currentPerformanceId = String(current?.id || '').trim();
    useEffect(() => {
        currentPerformanceIdRef.current = currentPerformanceId;
    }, [currentPerformanceId]);
    const applauseSubject = current || room?.lastPerformance || null;
    const applausePerformerName = String(
        applauseSubject?.singerName
        || applauseSubject?.performerName
        || applauseSubject?.displayName
        || 'Tonight\'s singer'
    ).trim();
    const applauseSongTitle = String(
        applauseSubject?.songTitle
        || applauseSubject?.title
        || ''
    ).trim();
    const popTriviaRoundSec = Math.max(
        8,
        Number(room?.popTriviaRoundSec || room?.gameDefaults?.triviaRoundSec || DEFAULT_POP_TRIVIA_ROUND_SEC)
    );
    const popTriviaRevealHoldMs = Math.max(
        6000,
        Number(room?.gameDefaults?.popTriviaRevealHoldSec || DEFAULT_POP_TRIVIA_REVEAL_HOLD_SEC) * 1000
    );
    const popTriviaCorrectPoints = Math.max(
        0,
        Number(room?.gameDefaults?.popTriviaCorrectPoints || DEFAULT_POP_TRIVIA_CORRECT_POINTS)
    );
    const popTriviaState = useMemo(() => {
        if (room?.activeMode !== 'karaoke') return null;
        if (room?.popTriviaEnabled !== true) return null;
        if (!current) return null;
        return getActivePopTriviaQuestion({
            song: current,
            now: popTriviaNow,
            roundSec: popTriviaRoundSec
        });
    }, [current, popTriviaNow, popTriviaRoundSec, room?.activeMode, room?.popTriviaEnabled]);
    const popTriviaQuestion = popTriviaState?.question || null;
    const popTriviaQuestionId = popTriviaQuestion?.id || '';
    const showPopTriviaEndState = (
        popTriviaState?.status === 'complete'
        && (popTriviaNow - Number(popTriviaState?.completedAtMs || 0)) < popTriviaRevealHoldMs
    );
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
    const popTriviaRevealQuestion = showPopTriviaEndState
        ? (popTriviaRevealSnapshot?.question || null)
        : null;
    const popTriviaRevealVotes = useMemo(
        () => (showPopTriviaEndState
            ? (Array.isArray(popTriviaRevealSnapshot?.votes) ? popTriviaRevealSnapshot.votes : [])
            : []),
        [showPopTriviaEndState, popTriviaRevealSnapshot?.votes]
    );
    const popTriviaRevealCorrectIndex = Number.isInteger(popTriviaRevealQuestion?.correct)
        ? Number(popTriviaRevealQuestion.correct)
        : -1;
    const popTriviaRevealCorrectOption = popTriviaRevealCorrectIndex >= 0
        ? String(popTriviaRevealQuestion?.options?.[popTriviaRevealCorrectIndex] || '').trim()
        : '';
    const popTriviaRevealCorrectResponders = useMemo(() => {
        if (!showPopTriviaEndState || popTriviaRevealCorrectIndex < 0) return [];
        return popTriviaRevealVotes
            .filter((vote) => Number(vote?.val) === popTriviaRevealCorrectIndex)
            .map((vote, idx) => ({
                id: vote?.uid || `${vote?.userName || 'guest'}_${idx}`,
                name: String(vote?.userName || vote?.user || 'Guest').trim() || 'Guest',
                avatar: String(vote?.avatar || EMOJI.sparkle || '').trim() || EMOJI.sparkle
            }))
            .slice(0, 12);
    }, [showPopTriviaEndState, popTriviaRevealCorrectIndex, popTriviaRevealVotes]);
    const popTriviaRevealAwardableResponders = useMemo(() => {
        if (!showPopTriviaEndState || popTriviaRevealCorrectIndex < 0 || !popTriviaCorrectPoints) return [];
        const seenUids = new Set();
        return popTriviaRevealVotes
            .filter((vote) => Number(vote?.val) === popTriviaRevealCorrectIndex)
            .map((vote) => ({
                uid: String(vote?.uid || '').trim(),
                name: String(vote?.userName || vote?.user || 'Guest').trim() || 'Guest',
                avatar: String(vote?.avatar || EMOJI.sparkle || '').trim() || EMOJI.sparkle
            }))
            .filter((entry) => {
                if (!entry.uid || seenUids.has(entry.uid)) return false;
                seenUids.add(entry.uid);
                return true;
            });
    }, [showPopTriviaEndState, popTriviaCorrectPoints, popTriviaRevealCorrectIndex, popTriviaRevealVotes]);
    const popTriviaRevealAnswerCount = popTriviaRevealVotes.length;
    const popTriviaRevealWinnerCount = popTriviaCorrectPoints > 0
        ? popTriviaRevealAwardableResponders.length
        : popTriviaRevealCorrectResponders.length;
    const popTriviaRevealTotalPointsAwarded = popTriviaCorrectPoints > 0
        ? popTriviaRevealAwardableResponders.length * popTriviaCorrectPoints
        : 0;
    const popTriviaRevealResolutionHeadline = popTriviaRevealWinnerCount > 0
        ? `${popTriviaRevealWinnerCount} ${popTriviaRevealWinnerCount === 1 ? 'player' : 'players'} won this round`
        : 'No winners this round';
    const popTriviaRevealResolutionDetail = popTriviaRevealWinnerCount > 0
        ? (
            popTriviaCorrectPoints > 0
                ? `Correct answers paid +${popTriviaCorrectPoints} pts each on audience phones.`
                : 'Correct answers earned the crowd shoutout.'
        )
        : 'Nobody landed the correct answer before the round closed.';
    const marqueeItems = (room?.marqueeItems || []).filter(i => i.enabled !== false);

    useEffect(() => {
        const enabled = room?.marqueeEnabled === true;
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
        if (room?.popTriviaEnabled !== true) return;
        if (!current?.id || !Array.isArray(current?.popTrivia) || current.popTrivia.length === 0) return;
        setPopTriviaNow(nowMs());
        const timer = setInterval(() => setPopTriviaNow(nowMs()), 1000);
        return () => clearInterval(timer);
    }, [current?.id, current?.popTrivia, room?.activeMode, room?.popTriviaEnabled]);
    useEffect(() => {
        if (isMarketingDemoFixture) {
            setPopTriviaVotes(Array.isArray(demoFixture?.popTriviaVotes) ? demoFixture.popTriviaVotes : []);
            return () => {};
        }
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
    }, [demoFixture?.popTriviaVotes, isMarketingDemoFixture, roomCode, popTriviaQuestionId]);
    useEffect(() => {
        if (!popTriviaQuestion) return;
        setPopTriviaRevealSnapshot({
            question: popTriviaQuestion,
            votes: Array.isArray(popTriviaVotes) ? [...popTriviaVotes] : [],
            capturedAtMs: popTriviaNow
        });
    }, [popTriviaNow, popTriviaQuestion, popTriviaVotes]);
    useEffect(() => {
        if (!popTriviaQuestionId) {
            popTriviaPrevQuestionIdRef.current = '';
            setPopTriviaQuestionAnnounceUntilMs(0);
            return;
        }
        const previousId = popTriviaPrevQuestionIdRef.current;
        if (previousId && previousId !== popTriviaQuestionId) {
            setPopTriviaQuestionAnnounceUntilMs(nowMs() + 1800);
        }
        popTriviaPrevQuestionIdRef.current = popTriviaQuestionId;
    }, [popTriviaQuestionId]);
    useEffect(() => {
        const timeLeftSec = Math.max(0, Number(popTriviaState?.timeLeftSec || 0));
        if (!popTriviaQuestionId || !timeLeftSec) {
            popTriviaPrevTimeLeftRef.current = timeLeftSec;
            setPopTriviaUrgencyPulseUntilMs(0);
            return;
        }
        const previous = Number(popTriviaPrevTimeLeftRef.current ?? timeLeftSec);
        if (timeLeftSec <= 5 && previous !== timeLeftSec) {
            setPopTriviaUrgencyPulseUntilMs(nowMs() + 900);
        }
        popTriviaPrevTimeLeftRef.current = timeLeftSec;
    }, [popTriviaQuestionId, popTriviaState?.timeLeftSec]);
    useEffect(() => {
        popTriviaAwardedQuestionIdsRef.current = new Set();
    }, [roomCode, isMarketingDemoFixture]);
    useEffect(() => {
        if (isMarketingDemoFixture) return;
        const revealQuestionId = String(popTriviaRevealQuestion?.id || '').trim();
        if (!showPopTriviaEndState || !revealQuestionId || !popTriviaCorrectPoints) return;
        if (!popTriviaRevealAwardableResponders.length) return;
        if (popTriviaAwardedQuestionIdsRef.current.has(revealQuestionId)) return;
        popTriviaAwardedQuestionIdsRef.current.add(revealQuestionId);
        const awards = popTriviaRevealAwardableResponders.map((entry) => ({
            uid: entry.uid,
            points: popTriviaCorrectPoints
        }));
        void awardRoomPointsOnce({
            awardKey: `pop_trivia_${roomCode}_${revealQuestionId}`,
            source: 'pop_trivia',
            awards
        }).then((result) => {
            if (result?.ok) return;
            popTriviaAwardedQuestionIdsRef.current.delete(revealQuestionId);
        });
    }, [
        awardRoomPointsOnce,
        isMarketingDemoFixture,
        popTriviaCorrectPoints,
        popTriviaRevealAwardableResponders,
        popTriviaRevealQuestion?.id,
        roomCode,
        showPopTriviaEndState
    ]);

    const handleVolume = (vol) => {
        const level = Math.min(100, Math.round(vol / 1.5));
        lobbyMicVolumeRef.current = level;
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
    const socialSidebarTitle = showChatFeed ? 'CHAT' : 'ACTIVITY';
    const hasSocialSidebarPane = !!room?.chatShowOnTv || activities.length > 0;
    const currentMarqueeItem = marqueeItems.length ? marqueeItems[(marqueeIndex + marqueeItems.length) % marqueeItems.length] : null;
    const marqueeText = currentMarqueeItem
        ? (typeof currentMarqueeItem === 'string' ? currentMarqueeItem : currentMarqueeItem.text)
        : null;
    const currentSinger = current
        ? roomUsers.find(u => u.uid === current.singerUid || u.name === current.singerName)
        : null;
    const currentSingerIsVip = !!currentSinger?.isVip || (currentSinger?.vipLevel || 0) > 0;
    const currentPerformanceCrowdPoints = useMemo(() => {
        const activePerformanceId = String(current?.id || '').trim();
        if (!activePerformanceId) return 0;
        return roomUsers.reduce((sum, userEntry) => {
            if (String(userEntry?.lastPerformanceId || '').trim() !== activePerformanceId) return sum;
            return sum + Math.max(0, Number(userEntry?.performancePointsGifted || 0));
        }, 0);
    }, [current?.id, roomUsers]);
    const currentPerformanceReactionPoints = useMemo(() => {
        const activePerformanceId = String(current?.id || '').trim();
        if (!activePerformanceId) return 0;
        return Math.max(
            0,
            Math.round(Number(reactionScoreTotalsByPerformance.get(activePerformanceId) || 0))
        );
    }, [current?.id, reactionScoreTotalsByPerformance]);
    const currentPerformanceHypeScore = current
        ? Math.max(
            0,
            Number(current?.hypeScore || 0),
            Math.round(currentPerformanceCrowdPoints),
            currentPerformanceReactionPoints
        )
        : 0;
    const currentPerformancePoints = current
        ? currentPerformanceHypeScore + Math.max(0, Number(current?.applauseScore || 0)) + Math.max(0, Number(current?.hostBonus || 0))
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
        ? roomUsers.find((u) => resolveRoomUserUid(u) === room.spotlightUser.id)
        : null;
    const spotlightTopTight15 = extractTopTight15({
        spotlightPayload: room?.spotlightUser || null,
        roomUser: spotlightUser || null
    });
    const lobbyForcedObjectiveMode = getCrowdObjectiveModeFromLightMode(room?.lightMode);
    const lobbyObjectiveMode = lobbyForcedObjectiveMode || getCrowdObjectiveModeById(CROWD_OBJECTIVE_DEFAULT_MODE_ID);
    const lobbyObjectiveIsTeamPong = lobbyObjectiveMode?.id === 'team_pong';
    const lobbyObjectiveLabel = lobbyObjectiveMode?.label || 'Volley Orb';
    const lobbyVolleySceneActive = isVolleyOrbSceneActive({
        hasCurrentSinger: !!current,
        activeMode: room?.activeMode,
        lightMode: room?.lightMode
    });
    const lobbyCompactHudMode = lobbyVolleySceneActive;
    useEffect(() => {
        if (sidebarRotateRef.current) {
            clearInterval(sidebarRotateRef.current);
            sidebarRotateRef.current = null;
        }
        if (lobbyVolleySceneActive || !hasSocialSidebarPane) {
            setSidebarFeatureView('queue');
            return undefined;
        }
        setSidebarFeatureView('queue');
        sidebarRotateRef.current = setInterval(() => {
            setSidebarFeatureView((prev) => (prev === 'queue' ? 'social' : 'queue'));
        }, 12000);
        return () => {
            if (sidebarRotateRef.current) {
                clearInterval(sidebarRotateRef.current);
                sidebarRotateRef.current = null;
            }
        };
    }, [hasSocialSidebarPane, lobbyVolleySceneActive]);
    const activeAutoCrowdMoment = room?.missionControl?.autoMoment;
    const autoCrowdMomentActive = activeAutoCrowdMoment?.status === 'live' && activeAutoCrowdMoment?.source === 'autopilot';
    const autoCrowdMomentType = String(activeAutoCrowdMoment?.type || '').trim().toLowerCase();
    const autoCrowdMomentTitle = String(activeAutoCrowdMoment?.title || '').trim()
        || (autoCrowdMomentType === 'volley' ? 'Auto Party: Volley Orb' : 'Auto Party: Ready Check');
    const autoCrowdMomentDetail = String(activeAutoCrowdMoment?.detail || '').trim()
        || (autoCrowdMomentType === 'volley'
            ? 'Audience relay is live between singers.'
            : 'Audience check-in is live before the next singer.');
    const lobbyGroundLineBottomPct = lobbyCompactHudMode ? 3.2 : 4.4;
    const lobbyGroundLineTopPct = 100 - lobbyGroundLineBottomPct;
    const lobbyNow = nowMs();
    const lobbyOrbEnergy = getLobbyOrbMeterValue(lobbyVolleyState, lobbyNow);
    const lobbyActiveParticipants = getActiveParticipants(lobbyVolleyState, lobbyNow).slice(0, LOBBY_ORB_EVENT_CAP);
    const lobbyRelayObjective = deriveRelayObjective(lobbyVolleyState, lobbyNow);
    const lobbyActiveUltimates = Array.isArray(lobbyVolleyState?.activeUltimates)
        ? lobbyVolleyState.activeUltimates.filter((entry) => Number(entry?.expiresAtMs || 0) > lobbyNow)
        : [];
    const lobbyCatchAllActive = lobbyActiveUltimates.some((entry) => entry?.type === 'ultimate_magnet');
    const lobbyRelayRemainingSec = Math.max(0, Math.ceil(Number(lobbyRelayObjective?.remainingMs || 0) / 100) / 10);
    const lobbyCurrentTierMeta = getLobbyTierDefinition(lobbyVolleyState?.currentTier || 0);
    const lobbyLevelMeta = getLobbyVolleyLevelMeta(lobbyVolleyState, lobbyNow);
    const motionSafeFx = !!room?.reduceMotionFx;
    const lobbyOrbSkinUrl = useMemo(
        () => normalizeLobbyOrbSkinUrl(room?.lobbyOrbSkinUrl || ''),
        [room?.lobbyOrbSkinUrl]
    );
    const lobbyHasCustomOrbSkin = !!lobbyOrbSkinUrl;
    const lobbyStreakTimeoutMs = getLobbyVolleyDynamicTimeoutMs(lobbyVolleyState, lobbyNow);
    const lobbyStreakAgeMs = Math.max(0, lobbyNow - Number(lobbyVolleyState?.lastInteractionAtMs || 0));
    const lobbyStreakDecayPct = clampLobby(
        100 - ((lobbyStreakAgeMs / Math.max(1, lobbyStreakTimeoutMs)) * 100),
        0,
        100
    );
    const lobbyVolleyExpired = Number(lobbyVolleyState?.lastInteractionAtMs || 0) > 0
        && lobbyStreakAgeMs >= lobbyStreakTimeoutMs;
    const lobbyHasActiveVolley = Number(lobbyVolleyState?.streakCount || 0) > 0
        && Number(lobbyVolleyState?.lastInteractionAtMs || 0) > 0
        && !lobbyVolleyExpired;
    const lobbyOrbDiameterPx = clampLobby((Number(viewportSize?.width || 1920) * 0.2), 198, 292);
    const lobbyOrbShrinkScale = lobbyActiveUltimates.some((entry) => entry?.type === 'ultimate_lens') ? 0.76 : 1;
    const lobbyOrbRadiusPct = ((lobbyOrbDiameterPx * lobbyOrbShrinkScale) * 0.5 / Math.max(1, Number(viewportSize?.height || 1080))) * 100;
    const lobbyOrbRestCenterTopPct = clampLobby(
        lobbyGroundLineTopPct - lobbyOrbRadiusPct,
        LOBBY_ORB_MIN_TOP_PCT,
        lobbyGroundLineTopPct - 1
    );
    const lobbyOrbTopPct = getLobbyOrbTopPct({
        hasStreak: lobbyHasActiveVolley,
        streakDecayPct: lobbyStreakDecayPct,
        groundTopPct: lobbyGroundLineTopPct,
        restCenterTopPct: lobbyOrbRestCenterTopPct
    });
    const lobbyAltitudeLensActive = lobbyActiveUltimates.some((entry) => entry?.type === 'ultimate_lens');
    const lobbyOrbAltitudeState = getLobbyVolleyAltitudeState({
        hasActiveVolley: lobbyHasActiveVolley,
        state: lobbyVolleyState,
        now: lobbyNow,
        energy: lobbyOrbEnergy,
        levelSpeed: Number(lobbyLevelMeta.speedMultiplier || 1),
        baseTopPct: lobbyOrbTopPct,
        restCenterTopPct: lobbyOrbRestCenterTopPct,
        shrinkActive: lobbyAltitudeLensActive
    });
    const lobbyPeakAltitudeFt = Math.max(
        Number(lobbyVolleyState?.peakAltitudeFt || 0),
        Number(lobbyOrbAltitudeState.altitudeFt || 0)
    );
    const lobbyOrbFloatDrift = useMemo(() => {
        if (!lobbyHasActiveVolley) {
            return {
                driftX: motionSafeFx ? 0 : Math.sin((lobbyNow / 1000) * 0.42) * 0.8,
                driftY: 0
            };
        }
        const seed = String(roomCode || '')
            .split('')
            .reduce((sum, char, index) => sum + (char.charCodeAt(0) * (index + 1)), 17);
        const tSec = lobbyNow / 1000;
        const motionDamp = motionSafeFx ? 0.56 : 1;
        const streakScale = 1;
        const levelSpeed = Number(lobbyLevelMeta.speedMultiplier || 1);
        const energyScale = (0.72 + (Math.max(0, Math.min(100, Number(lobbyOrbEnergy || 0))) / 185)) * (0.96 + ((levelSpeed - 1) * 0.28));
        const ampX = (3.8 + (seededUnit(seed + 23) * 2.5)) * motionDamp * streakScale * energyScale;
        const ampY = (1.6 + (seededUnit(seed + 37) * 1.4)) * motionDamp * streakScale * (0.82 + (Math.max(0, Math.min(100, Number(lobbyOrbEnergy || 0))) / 230));
        const phaseA = seededUnit(seed + 41) * Math.PI * 2;
        const phaseB = seededUnit(seed + 53) * Math.PI * 2;
        const phaseC = seededUnit(seed + 67) * Math.PI * 2;
        const phaseD = seededUnit(seed + 79) * Math.PI * 2;
        const driftX = (
            Math.sin((tSec * (0.55 + (seededUnit(seed + 89) * 0.22)) * levelSpeed) + phaseA) * ampX
            + Math.sin((tSec * (0.97 + (seededUnit(seed + 97) * 0.18)) * levelSpeed) + phaseB) * (ampX * 0.42)
        );
        const driftY = (
            Math.cos((tSec * (0.68 + (seededUnit(seed + 107) * 0.2)) * levelSpeed) + phaseC) * ampY
            + Math.sin((tSec * (1.18 + (seededUnit(seed + 113) * 0.17)) * levelSpeed) + phaseD) * (ampY * 0.36)
        );
        return { driftX, driftY };
    }, [roomCode, lobbyNow, motionSafeFx, lobbyHasActiveVolley, lobbyLevelMeta.speedMultiplier, lobbyOrbEnergy]);
    const lobbyOrbRenderLeftPct = clampLobby(50 + lobbyOrbFloatDrift.driftX, 16, 84);
    const lobbyVolleyAltitudeProgress = clampLobby(
        Number(lobbyOrbAltitudeState.altitudeFt || 0) / LOBBY_ALTITUDE_MAX_TRACKED_FT,
        0,
        1
    );
    const lobbyVolleyParallaxEase = 1 - ((1 - lobbyVolleyAltitudeProgress) ** 2);
    const lobbyVolleyCameraShiftPct = Number(lobbyOrbAltitudeState.cameraShiftPct || 0);
    const lobbyVolleyNearShiftPct = clampLobby(
        lobbyVolleyCameraShiftPct * (1.08 + (lobbyVolleyParallaxEase * 0.24)),
        0,
        58
    );
    const lobbyVolleyMidShiftPct = clampLobby(
        lobbyVolleyCameraShiftPct * (0.84 + (lobbyVolleyParallaxEase * 0.08)),
        0,
        46
    );
    const lobbyVolleyFarShiftPct = clampLobby(
        lobbyVolleyCameraShiftPct * (0.52 + (lobbyVolleyParallaxEase * 0.12)),
        0,
        32
    );
    const lobbyVolleySkyShiftPct = clampLobby(
        lobbyVolleyCameraShiftPct * (0.26 + (lobbyVolleyParallaxEase * 0.08)),
        0,
        16
    );
    const lobbyIdleOrbLiftPct = lobbyHasActiveVolley
        ? 0
        : clampLobby(Math.max(8, lobbyOrbRadiusPct * 0.55), 8, 16);
    const lobbyGuideVerticalShiftPct = lobbyVolleyMidShiftPct;
    const lobbyGroundLineRenderTopPct = clampLobby(lobbyGroundLineTopPct + lobbyVolleyNearShiftPct, -12, 158);
    const lobbyAltitudeMarkerBaseTopPct = clampLobby(lobbyGroundLineTopPct + lobbyVolleyFarShiftPct, -18, 146);
    const lobbyOrbRenderTopPct = clampLobby(
        lobbyOrbAltitudeState.renderTopPct + lobbyOrbFloatDrift.driftY - (lobbyAltitudeLensActive ? 4.5 : 0) - lobbyIdleOrbLiftPct,
        4,
        92
    );
    const lobbyAltitudeMarkers = useMemo(() => {
        if (lobbyObjectiveIsTeamPong) return [];
        const markerValues = [0, 50, 100, LOBBY_ALTITUDE_MAX_TRACKED_FT]
            .filter((value, index, list) => list.indexOf(value) === index)
            .sort((a, b) => a - b);
        return markerValues.map((altitudeFt) => {
            const topPct = clampLobby(lobbyAltitudeMarkerBaseTopPct - (altitudeFt / 2.3), -18, 142);
            return {
                altitudeFt,
                topPct,
                isMajor: altitudeFt === 0 || altitudeFt === LOBBY_ALTITUDE_MAX_TRACKED_FT || altitudeFt % 100 === 0
            };
        }).filter((marker) => marker.topPct >= -6 && marker.topPct <= 104);
    }, [lobbyObjectiveIsTeamPong, lobbyAltitudeMarkerBaseTopPct]);
    const lobbyVolleyParallaxPlatforms = useMemo(() => {
        if (lobbyObjectiveIsTeamPong) return [];
        const defs = [
            { id: 'platform-a', baseTopPct: 88, leftPct: 12, widthPct: 18, layer: 'near', tiltDeg: -2, glow: 'rgba(45,212,191,0.24)' },
            { id: 'platform-b', baseTopPct: 73, leftPct: 63, widthPct: 14, layer: 'mid', tiltDeg: 1.6, glow: 'rgba(125,211,252,0.2)' },
            { id: 'platform-c', baseTopPct: 58, leftPct: 27, widthPct: 16, layer: 'near', tiltDeg: -1.5, glow: 'rgba(236,72,153,0.22)' },
            { id: 'platform-d', baseTopPct: 42, leftPct: 70, widthPct: 19, layer: 'far', tiltDeg: 2.4, glow: 'rgba(125,211,252,0.16)' },
            { id: 'platform-e', baseTopPct: 26, leftPct: 18, widthPct: 13, layer: 'mid', tiltDeg: -2.2, glow: 'rgba(45,212,191,0.18)' },
            { id: 'platform-f', baseTopPct: 10, leftPct: 55, widthPct: 18, layer: 'far', tiltDeg: 1.2, glow: 'rgba(236,72,153,0.16)' }
        ];
        return defs.map((entry) => {
            const shiftPct = entry.layer === 'near'
                ? lobbyVolleyNearShiftPct
                : entry.layer === 'mid'
                    ? lobbyVolleyMidShiftPct
                    : lobbyVolleyFarShiftPct;
            return {
                ...entry,
                topPct: clampLobby(entry.baseTopPct + shiftPct, -10, 118)
            };
        }).filter((entry) => entry.topPct >= -8 && entry.topPct <= 110);
    }, [lobbyObjectiveIsTeamPong, lobbyVolleyFarShiftPct, lobbyVolleyMidShiftPct, lobbyVolleyNearShiftPct]);
    const lobbyVolleyCloudBands = useMemo(() => {
        if (lobbyObjectiveIsTeamPong) return [];
        const defs = [
            { id: 'cloud-a', baseTopPct: 76, leftPct: 8, widthPct: 24, heightPx: 84, layer: 'near', opacity: 0.22 },
            { id: 'cloud-b', baseTopPct: 60, leftPct: 58, widthPct: 20, heightPx: 70, layer: 'mid', opacity: 0.18 },
            { id: 'cloud-c', baseTopPct: 34, leftPct: 18, widthPct: 26, heightPx: 90, layer: 'far', opacity: 0.16 },
            { id: 'cloud-d', baseTopPct: 18, leftPct: 62, widthPct: 22, heightPx: 76, layer: 'mid', opacity: 0.14 }
        ];
        return defs.map((entry) => {
            const shiftPct = entry.layer === 'near'
                ? lobbyVolleyNearShiftPct * 0.72
                : entry.layer === 'mid'
                    ? lobbyVolleyMidShiftPct * 0.8
                    : lobbyVolleyFarShiftPct * 0.88;
            return {
                ...entry,
                topPct: clampLobby(entry.baseTopPct + shiftPct, -14, 118)
            };
        }).filter((entry) => entry.topPct >= -12 && entry.topPct <= 108);
    }, [lobbyObjectiveIsTeamPong, lobbyVolleyFarShiftPct, lobbyVolleyMidShiftPct, lobbyVolleyNearShiftPct]);
    const lobbyPongState = useMemo(() => {
        const seed = String(roomCode || '')
            .split('')
            .reduce((sum, char, index) => sum + (char.charCodeAt(0) * (index + 1)), 31);
        const tSec = lobbyNow / 1000;
        const energyNorm = clampLobby(lobbyOrbEnergy, 0, 100) / 100;
        const motionDamp = motionSafeFx ? 0.62 : 1;
        const levelSpeed = Number(lobbyLevelMeta.speedMultiplier || 1);
        const rallyScale = (lobbyHasActiveVolley ? 1 : 0.64) * (0.78 + (energyNorm * 0.56)) * (0.96 + ((levelSpeed - 1) * 0.3));
        const ampX = (20 + (seededUnit(seed + 7) * 18)) * motionDamp * rallyScale;
        const ampY = (10 + (seededUnit(seed + 13) * 12)) * motionDamp * (0.7 + (energyNorm * 0.42));
        const phaseA = seededUnit(seed + 19) * Math.PI * 2;
        const phaseB = seededUnit(seed + 23) * Math.PI * 2;
        const phaseC = seededUnit(seed + 29) * Math.PI * 2;
        const phaseD = seededUnit(seed + 31) * Math.PI * 2;
        const xWave = (
            Math.sin((tSec * (0.84 + (seededUnit(seed + 37) * 0.22)) * levelSpeed) + phaseA) * ampX
            + Math.sin((tSec * (1.52 + (seededUnit(seed + 41) * 0.27)) * levelSpeed) + phaseB) * (ampX * 0.42)
        );
        const yWave = (
            Math.cos((tSec * (1.03 + (seededUnit(seed + 43) * 0.24)) * levelSpeed) + phaseC) * ampY
            + Math.sin((tSec * (1.71 + (seededUnit(seed + 47) * 0.2)) * levelSpeed) + phaseD) * (ampY * 0.4)
        );
        const ballLeftPct = clampLobby(50 + xWave, 13, 87);
        const ballTopPct = clampLobby(50 + yWave, 20, 80);
        const paddleLead = 0.66 + (energyNorm * 0.16);
        const paddleOffsetA = Math.sin((tSec * (0.92 + (seededUnit(seed + 53) * 0.18))) + phaseA) * 5.4 * motionDamp;
        const paddleOffsetB = Math.cos((tSec * (0.88 + (seededUnit(seed + 59) * 0.2))) + phaseC) * 5.1 * motionDamp;
        const leftPaddleTopPct = clampLobby(50 + ((ballTopPct - 50) * paddleLead) + paddleOffsetA, 18, 82);
        const rightPaddleTopPct = clampLobby(50 + ((ballTopPct - 50) * paddleLead) + paddleOffsetB, 18, 82);
        const speedPct = clampLobby(
            (Math.abs(Math.sin((tSec * 1.6 * levelSpeed) + phaseA)) * 36)
            + 30
            + (energyNorm * 34)
            + (lobbyHasActiveVolley ? 8 : 0),
            0,
            100
        );
        return {
            ballLeftPct,
            ballTopPct,
            leftPaddleTopPct,
            rightPaddleTopPct,
            speedPct
        };
    }, [roomCode, lobbyNow, lobbyLevelMeta.speedMultiplier, lobbyOrbEnergy, motionSafeFx, lobbyHasActiveVolley]);
    const lobbyPongTeams = useMemo(() => {
        const left = [];
        const right = [];
        lobbyActiveParticipants.forEach((participant, index) => {
            if (index % 2 === 0) left.push(participant);
            else right.push(participant);
        });
        return {
            left: left.slice(0, 4),
            right: right.slice(0, 4)
        };
    }, [lobbyActiveParticipants]);
    const lobbyAirborneMs = deriveAirborneMs(lobbyVolleyState, lobbyNow);
    const lobbyTeamworkMultiplier = deriveTeamworkMultiplier(lobbyVolleyState, lobbyNow);
    const lobbyAirborneSec = Math.floor(lobbyAirborneMs / 1000);
    const lobbyLastInteractionAgeMs = Math.max(0, lobbyNow - Number(lobbyLastInteraction?.timestampMs || 0));
    const lobbyRecentInteractionType = lobbyLastInteractionAgeMs < 3200
        ? normalizeLobbyPlayInteractionType(lobbyLastInteraction?.interactionType || '')
        : '';
    const lobbyObjectiveStreakLabel = `${lobbyVolleyState?.streakCount || 0} ${lobbyObjectiveIsTeamPong ? 'rallies' : 'saves'}`;
    const lobbyObjectiveProgressLabel = lobbyObjectiveIsTeamPong
        ? `Pace ${Math.round(lobbyPongState.speedPct)}%`
        : `Height ${Math.round(lobbyOrbAltitudeState.altitudeFt)} ft`;
    const lobbyWarningState = lobbyHasActiveVolley
        && !room?.lobbyPlaygroundPaused
        && (lobbyRelayObjective?.urgency === 'danger' || lobbyStreakDecayPct <= 24);
    const lobbyInstructionCopy = getVolleyOrbTvInstructionCopy({
        warningState: lobbyWarningState,
        hasActiveVolley: lobbyHasActiveVolley,
        volleyExpired: lobbyVolleyExpired
    });
    const lobbyInstructionHeadline = lobbyInstructionCopy.headline;
    const lobbyInstructionSecondary = lobbyInstructionCopy.secondary;
    const lobbyGuideFocusEntries = useMemo(() => {
        if (lobbyObjectiveIsTeamPong) return [];
        return LOBBY_PLAY_GUIDE
            .filter((guide) => guide.id === lobbyRecentInteractionType || (lobbyRelayObjective.active && guide.id === lobbyRelayObjective.targetType))
            .filter((guide, index, list) => list.findIndex((entry) => entry.id === guide.id) === index);
    }, [lobbyObjectiveIsTeamPong, lobbyRecentInteractionType, lobbyRelayObjective.active, lobbyRelayObjective.targetType]);
    const showLobbyPlaygroundFx = (
        lobbyVolleySceneActive
        || lobbyTransitionPhase === 'exiting'
        || lobbyPlayBursts.length > 0
        || lobbyPlayScreenFx.length > 0
        || lobbyVolleyLinks.length > 0
        || lobbyComboMoments.length > 0
        || lobbyAssistMoments.length > 0
        || lobbyTierChips.length > 0
    );
    const lobbyWarningCueActiveRef = useRef(false);
    const lobbyResetCueActiveRef = useRef(false);
    useEffect(() => {
        const node = lobbyVolleySceneRef.current;
        if (!node) return undefined;

        const applyMetrics = () => {
            const rect = node.getBoundingClientRect();
            const next = getVolleyOrbResponsiveMetrics({
                sceneWidth: rect.width,
                sceneHeight: rect.height
            });
            setLobbyVolleySceneMetrics((prev) => {
                if (
                    Number(prev?.sceneWidthPx || 0) === Number(next.sceneWidthPx || 0)
                    && Number(prev?.sceneHeightPx || 0) === Number(next.sceneHeightPx || 0)
                    && 
                    Number(prev?.orbSizePx || 0) === next.orbSizePx
                    && Number(prev?.participantSizePx || 0) === next.participantSizePx
                    && Number(prev?.orbScale || 0) === next.orbScale
                    && Number(prev?.orbContentScale || 0) === next.orbContentScale
                ) {
                    return prev;
                }
                return next;
            });
        };

        applyMetrics();

        if (typeof ResizeObserver === 'function') {
            const observer = new ResizeObserver(() => applyMetrics());
            observer.observe(node);
            return () => observer.disconnect();
        }

        window.addEventListener('resize', applyMetrics);
        return () => window.removeEventListener('resize', applyMetrics);
    }, [lobbyVolleySceneActive, lobbyObjectiveIsTeamPong]);
    useEffect(() => {
        if (!lobbyVolleySceneActive) {
            setLobbyLastInteraction(null);
            lobbyWarningCueActiveRef.current = false;
            lobbyResetCueActiveRef.current = false;
            return;
        }
        if (lobbyWarningState) {
            if (!lobbyWarningCueActiveRef.current) {
                playLobbyVolleyCueRef.current('warning', { intensity: 0.82 });
            }
            lobbyWarningCueActiveRef.current = true;
        } else {
            lobbyWarningCueActiveRef.current = false;
        }
        if (lobbyVolleyExpired) {
            if (!lobbyResetCueActiveRef.current) {
                playLobbyVolleyCueRef.current('reset', { intensity: 0.9 });
            }
            lobbyResetCueActiveRef.current = true;
        } else {
            lobbyResetCueActiveRef.current = false;
        }
    }, [lobbyVolleySceneActive, lobbyWarningState, lobbyVolleyExpired]);
    useEffect(() => {
        if (lobbyTransitionTimerRef.current) {
            clearTimeout(lobbyTransitionTimerRef.current);
            lobbyTransitionTimerRef.current = null;
        }
        if (lobbyVolleySceneActive) {
            setLobbyTransitionPhase('idle');
            return undefined;
        }
        setLobbyTransitionPhase('exiting');
        lobbyTransitionTimerRef.current = setTimeout(() => {
            const resetState = createLobbyVolleyState();
            setLobbyPlayBursts([]);
            setLobbyPlayScreenFx([]);
            setLobbyComboMoments([]);
            setLobbyAssistMoments([]);
            setLobbyVolleyLinks([]);
            setLobbyTierChips([]);
            setLobbyVolleyState(resetState);
            lobbyVolleyStateRef.current = resetState;
            lobbyLastAnchorRef.current = null;
            setLobbyLastInteraction(null);
            setLobbyTransitionPhase('idle');
            lobbyTransitionTimerRef.current = null;
        }, 1200);
        return () => {
            if (lobbyTransitionTimerRef.current) {
                clearTimeout(lobbyTransitionTimerRef.current);
                lobbyTransitionTimerRef.current = null;
            }
        };
    }, [lobbyVolleySceneActive]);
    useEffect(() => {
        if (lobbyTransitionTimerRef.current) {
            clearTimeout(lobbyTransitionTimerRef.current);
            lobbyTransitionTimerRef.current = null;
        }
        const resetState = createLobbyVolleyState();
        setLobbyPlayBursts([]);
        setLobbyPlayScreenFx([]);
        setLobbyComboMoments([]);
        setLobbyAssistMoments([]);
        setLobbyVolleyLinks([]);
        setLobbyTierChips([]);
        setLobbyTransitionPhase('idle');
        setLobbyVolleyState(resetState);
        lobbyVolleyStateRef.current = resetState;
        lobbyLastAnchorRef.current = null;
        setLobbyLastInteraction(null);
        lobbyAwardAuthLockedRef.current = false;
        lobbyCueLastPlayedRef.current = {};
        lobbyWarningCueActiveRef.current = false;
        lobbyResetCueActiveRef.current = false;
    }, [roomCode, isMarketingDemoFixture]);
    useEffect(() => () => {
        if (lobbyTransitionTimerRef.current) {
            clearTimeout(lobbyTransitionTimerRef.current);
            lobbyTransitionTimerRef.current = null;
        }
    }, []);

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
    const [visualizerSourceElement, setVisualizerSourceElement] = useState(null);
    useEffect(() => {
        if (!shouldUseBgMediaElement) {
            setVisualizerSourceElement(null);
            return;
        }
        setVisualizerSourceElement(bgVisualizerAudioRef.current || null);
    }, [shouldUseBgMediaElement, started, room?.videoStartTimestamp]);
    const guitarSessionParticipants = useMemo(
        () => (room?.guitarSessionId
            ? roomUsers
                .filter((user) => user?.guitarSessionId === room.guitarSessionId)
                .map((user) => ({
                    uid: user?.uid || '',
                    name: user?.name || 'Guest',
                    avatar: user?.avatar || EMOJI.guitar,
                    guitarHits: Number(user?.guitarHits || 0),
                    lastVibeAt: toEpochMs(user?.lastVibeAt)
                }))
                .sort((a, b) => {
                    const activityGap = Number(b?.lastVibeAt || 0) - Number(a?.lastVibeAt || 0);
                    if (activityGap !== 0) return activityGap;
                    return Number(b?.guitarHits || 0) - Number(a?.guitarHits || 0);
                })
            : []),
        [roomUsers, room?.guitarSessionId]
    );
    const guitarLeaders = [...guitarSessionParticipants]
        .sort((a, b) => Number(b?.guitarHits || 0) - Number(a?.guitarHits || 0))
        .slice(0, 5);
    const guitarTopJammer = guitarLeaders[0] || null;
    const guitarRunnerUp = guitarLeaders[1] || null;
    const guitarLeaderMaxHits = Math.max(1, ...guitarSessionParticipants.map((user) => Number(user.guitarHits || 0)));
    const guitarRecentHitMap = useMemo(() => {
        const totals = new Map();
        (guitarSyncState?.recentHits || []).forEach((entry) => {
            const key = String(entry?.uid || '').trim();
            if (!key) return;
            totals.set(key, Number(totals.get(key) || 0) + Math.max(1, Number(entry?.count || 1)));
        });
        return totals;
    }, [guitarSyncState?.recentHits]);
    const guitarDisplayParticipants = guitarSessionParticipants.slice(0, 24);
    const strobeSessionId = room?.strobeSessionId;
    const strobeUsers = useMemo(
        () => (strobeSessionId
            ? roomUsers.filter(u => u.strobeSessionId === strobeSessionId)
            : []),
        [roomUsers, strobeSessionId]
    );
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
    const vibeReactionEvents = useMemo(
        () => reactions
            .filter((reaction) => reaction?.isVoteReaction !== true)
            .map((reaction, idx) => ({
                type: reaction?.type || '',
                count: Math.max(1, Number(reaction?.count || 1)),
                uid: reaction?.uid || `${reaction?.userName || reaction?.user || 'guest'}_${idx}`,
                userName: reaction?.userName || reaction?.user || 'Guest',
                timestampMs: toEpochMs(reaction?.timestamp) || nowMs()
            })),
        [reactions]
    );
    const strobeModeEvents = useMemo(() => {
        const strobeReactionEvents = vibeReactionEvents.filter((event) => event.type === 'strobe_tap');
        const userAggregateEvents = strobeUsers.map((user) => ({
            type: 'strobe_tap',
            count: Math.max(1, Number(user?.strobeTaps || 0)),
            uid: user?.uid || '',
            userName: user?.name || 'Guest',
            timestampMs: toEpochMs(user?.lastVibeAt) || nowMs()
        })).filter((event) => Number(event.count || 0) > 0);
        return [...strobeReactionEvents, ...userAggregateEvents];
    }, [strobeUsers, vibeReactionEvents]);
    const bangerModeState = useMemo(
        () => deriveBangerModeState({
            combo,
            events: vibeReactionEvents,
            nowMs: nowMs()
        }),
        [combo, vibeReactionEvents]
    );
    const balladModeState = useMemo(
        () => deriveBalladModeState({
            combo,
            chatCount: groupedChatMessages?.length || 0,
            events: vibeReactionEvents,
            nowMs: nowMs()
        }),
        [combo, groupedChatMessages?.length, vibeReactionEvents]
    );
    const strobeModeState = useMemo(
        () => deriveStrobeModeState({
            totalTaps: strobeTotalTaps,
            leaderCount: strobeLeaders.length,
            phase: strobePhase,
            events: strobeModeEvents,
            nowMs: nowMs()
        }),
        [strobeTotalTaps, strobeLeaders.length, strobePhase, strobeModeEvents]
    );
    const strobeEngagementScore = clampPct(Number(strobeModeState?.score || 0));
    const guitarPeakHits = guitarSessionParticipants.length
        ? Math.max(...guitarSessionParticipants.map((user) => Number(user.guitarHits || 0)))
        : 0;
    const guitarSessionTotalHits = guitarSessionParticipants.reduce((sum, user) => sum + Number(user?.guitarHits || 0), 0);
    const guitarActivePlayers = room?.guitarSessionId
        ? roomUsers.filter((user) => (
            user?.guitarSessionId === room.guitarSessionId
            && (nowMs() - toEpochMs(user?.lastVibeAt)) <= GUITAR_SYNC_ACTIVE_WINDOW_MS
        ))
        : [];
    const guitarActiveCount = guitarActivePlayers.length;
    const guitarSyncAccuracy = Number(guitarSyncState?.totalHits || 0) > 0
        ? Math.round((Number(guitarSyncState?.perfectHits || 0) / Number(guitarSyncState?.totalHits || 1)) * 100)
        : 0;
    const guitarSyncPower = clampPct(
        (Number(guitarSyncState?.meter || 0) * 0.5)
        + (Number(guitarSyncState?.cadenceScore || 0) * 0.28)
        + (guitarSyncAccuracy * 0.22)
        + (guitarActiveCount * 10)
    );
    const guitarEngagementScore = clampPct(
        (guitarSyncPower * 0.64)
        + (Math.min(100, guitarSessionTotalHits) * 0.2)
        + (Math.min(100, guitarPeakHits * 4) * 0.16)
    );
    const bangerHeatScore = clampPct(Number(bangerModeState?.score || 0));
    const balladGlowScore = clampPct(Number(balladModeState?.score || 0));
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
    useEffect(() => {
        lobbyVisualizerEnabledRef.current = !!visualizerEnabled;
    }, [visualizerEnabled]);
    useEffect(() => {
        lobbyReduceMotionRef.current = motionSafeFx;
    }, [motionSafeFx]);
    useEffect(() => {
        lobbyMicVolumeRef.current = Number(micVolume || 0);
    }, [micVolume]);
    useEffect(() => {
        lobbyPausedRef.current = !!room?.lobbyPlaygroundPaused;
        lobbyVisualOnlyRef.current = !!room?.lobbyPlaygroundVisualOnly;
    }, [room?.lobbyPlaygroundPaused, room?.lobbyPlaygroundVisualOnly]);
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
    const balladPhoneLights = useMemo(
        () => Array.from({ length: 12 }, (_, idx) => ({
            id: `ballad-phone-light-${idx}`,
            offsetPx: Math.round((seededUnit(particleSeedBase + idx * 19) - 0.5) * 20),
            delay: `${(seededUnit(particleSeedBase + idx * 37) * 1.8).toFixed(2)}s`,
            duration: `${(1.2 + seededUnit(particleSeedBase + idx * 41) * 1.1).toFixed(2)}s`,
            scale: (0.82 + (seededUnit(particleSeedBase + idx * 53) * 0.36)).toFixed(2)
        })),
        [particleSeedBase]
    );
    const audienceBase = typeof window !== 'undefined' ? getSurfaceBaseHref('app', window.location) : '/';
    const joinUrl = `${audienceBase}?room=${roomCode}`;
    const joinUrlDisplay = joinUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const joinUrlPieces = joinUrlDisplay.split('?');
    const joinUrlBaseDisplay = joinUrlPieces[0];
    const joinUrlQueryDisplay = joinUrlPieces[1] ? `?${joinUrlPieces[1]}` : `?room=${roomCode}`;
    const marketingJoinBase = (() => {
        const base = typeof window !== 'undefined' ? getSurfaceBaseHref('marketing', window.location) : '/';
        return `${String(base || '/').replace(/^https?:\/\//, '').replace(/\/$/, '')}/join`;
    })();
    useEffect(() => {
        if (!room?.gamePreviewId || room?.activeMode !== 'karaoke') {
            setPreviewSession((prev) => (prev.startMs || prev.key ? { key: '', startMs: 0 } : prev));
            return undefined;
        }
        const previewKey = String(room.gamePreviewId || '');
        const roomPreviewTs = getTimestampMs(room?.gamePreviewAt);
        setPreviewSession((prev) => {
            if (roomPreviewTs > 0) return { key: previewKey, startMs: roomPreviewTs };
            if (prev.key === previewKey && prev.startMs > 0) return prev;
            return { key: previewKey, startMs: nowMs() };
        });
        setPreviewNowMs(nowMs());
        const timer = setInterval(() => setPreviewNowMs(nowMs()), 500);
        return () => clearInterval(timer);
    }, [room?.gamePreviewId, room?.gamePreviewAt, room?.activeMode]);
    const previewGameId = room?.gamePreviewId || '';
    const previewStartMs = previewGameId ? Number(previewSession.startMs || 0) : 0;
    const previewAgeMs = previewStartMs ? Math.max(0, previewNowMs - previewStartMs) : 0;
    const previewActive = !!previewGameId
        && room?.activeMode === 'karaoke'
        && previewAgeMs < GAME_PREVIEW_AUTO_HIDE_MS;
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
    const _isNarrowViewport = viewportSize.width <= 1180;
    const isVeryNarrowViewport = viewportSize.width <= 760;
    const isTinyHostPreviewMode = isHostPreviewEmbed && (viewportSize.width <= 520 || viewportSize.height <= 430);
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
    const effectiveGridTopPaddingClass = lobbyCompactHudMode
        ? (isVeryShortViewport ? 'pt-5' : isShortViewport ? 'pt-6 md:pt-8' : 'pt-8 md:pt-10 2xl:pt-12')
        : gridTopPaddingClass;
    const effectiveStageMinHeightClass = lobbyCompactHudMode
        ? (isVeryShortViewport ? 'min-h-[48vh] md:min-h-[56vh]' : isShortViewport ? 'min-h-[52vh] md:min-h-[60vh]' : 'min-h-[58vh] md:min-h-[66vh]')
        : stageMinHeightClass;
    const sidebarGapClass = isTinyHostPreviewMode ? 'gap-1 pb-0.5' : isShortViewport ? 'gap-1.5 pb-1' : 'gap-2 pb-2';
    const isDistanceConstrained = viewportSize.width <= 1680 || viewportSize.height <= 900;
    const initialJoinProfile = normalizeTvExploreProfile(room?.tvPresentationProfile || '');
    const compactJoinCardMode = isTinyHostPreviewMode || lobbyCompactHudMode || isDistanceConstrained || initialJoinProfile === 'simple' || initialJoinProfile === 'cinema';
    const joinQrSize = isTinyHostPreviewMode
        ? 64
        : compactJoinCardMode
            ? (isVeryShortViewport ? 104 : isShortViewport ? 116 : 128)
            : (isVeryShortViewport ? 132 : isShortViewport ? 152 : 176);
    const joinQrClass = isTinyHostPreviewMode
        ? 'w-[64px] h-[64px]'
        : compactJoinCardMode
            ? (isVeryShortViewport
                ? 'w-[92px] h-[92px] md:w-[104px] md:h-[104px] 2xl:w-[132px] 2xl:h-[132px]'
                : isShortViewport
                    ? 'w-[100px] h-[100px] md:w-[116px] md:h-[116px] 2xl:w-[148px] 2xl:h-[148px]'
                    : 'w-[108px] h-[108px] md:w-[124px] md:h-[124px] 2xl:w-[160px] 2xl:h-[160px]')
            : (isVeryShortViewport
                ? 'w-[108px] h-[108px] md:w-[124px] md:h-[124px] 2xl:w-[168px] 2xl:h-[168px]'
                : isShortViewport
                    ? 'w-[120px] h-[120px] md:w-[140px] md:h-[140px] 2xl:w-[196px] 2xl:h-[196px]'
                    : 'w-[132px] h-[132px] md:w-[160px] md:h-[160px] 2xl:w-[220px] 2xl:h-[220px]');
    const lobbyObjectiveHudRight = viewportSize.width >= 1024
        ? (lobbyCompactHudMode ? '26.8%' : '34.6%')
        : '3%';
    const lobbyObjectiveHudWidth = viewportSize.width >= 1024
        ? (lobbyCompactHudMode ? 'min(20vw,360px)' : 'min(23vw,410px)')
        : 'min(90vw,560px)';
    const marqueeHeightClass = isTinyHostPreviewMode
        ? 'h-8'
        : isVeryShortViewport ? 'h-14 md:h-16' : isShortViewport ? 'h-16 md:h-20' : 'h-20 md:h-28 2xl:h-36';
    const marqueeTextSize = isTinyHostPreviewMode
        ? 'clamp(0.85rem, 2vw, 1.1rem)'
        : isVeryShortViewport
            ? 'clamp(1.5rem, 2.8vw, 2.4rem)'
            : isShortViewport
                ? 'clamp(1.8rem, 3.2vw, 3.2rem)'
                : 'clamp(2.5rem, 4vw, 5rem)';
    const marqueeUserSize = isTinyHostPreviewMode
        ? 'clamp(0.7rem, 1.4vw, 0.85rem)'
        : isVeryShortViewport
            ? 'clamp(0.95rem, 1.8vw, 1.9rem)'
            : isShortViewport
                ? 'clamp(1.05rem, 2vw, 2.3rem)'
                : 'clamp(1.2rem, 2.4vw, 3rem)';
    const marqueeGapClass = isTinyHostPreviewMode ? 'gap-6 px-3' : isVeryNarrowViewport ? 'gap-10 px-4' : 'gap-16 px-6';
    const showTinyJoinHint = isTinyHostPreviewMode || (isVeryNarrowViewport && compactJoinCardMode);
    const showVerboseJoinUrl = viewportSize.width >= 2100 && !isShortViewport && !lobbyCompactHudMode;
    const showExtendedSpotlightMeta = viewportSize.width >= 1760 && !isShortViewport;
    const chatTvFullscreenActive = !!room?.chatShowOnTv && room?.chatTvMode === 'fullscreen';

    // --- RENDER ---
    
    if (!started) {
        return (
            <div className="public-tv h-screen min-h-screen w-full bg-[#0b0e12] text-white font-saira flex items-center justify-center relative overflow-hidden" style={{ height: '100dvh' }}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1a1f2b,transparent_55%),radial-gradient(circle_at_bottom,#1b0f22,transparent_45%)] opacity-90"></div>
                <div className="absolute -top-32 -left-24 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl"></div>
                <div className="absolute -bottom-40 -right-24 w-80 h-80 rounded-full bg-pink-500/20 blur-3xl"></div>
                <div className="relative z-10 flex flex-col items-center gap-4 md:gap-6 px-4 text-center">
                    <img src={room?.logoUrl || ASSETS.logo} alt={tvLogoAlt} className="h-16 md:h-20 2xl:h-24 rounded-2xl drop-shadow-[0_0_30px_rgba(0,196,217,0.45)]" />
                    <div className="text-sm md:text-base uppercase tracking-[0.2em] md:tracking-[0.45em] text-zinc-300">{isCustomTvBrand ? `${tvBrandTitle} TV` : 'TV Dashboard'}</div>
                    <div className="text-3xl md:text-5xl 2xl:text-6xl font-bebas text-transparent bg-clip-text bg-gradient-to-r from-[#00C4D9] to-[#EC4899]">
                        Start the Show
                    </div>
                    {tvPoweredByLabel ? (
                        <div className="text-[11px] md:text-sm uppercase tracking-[0.22em] text-zinc-500">{tvPoweredByLabel}</div>
                    ) : null}
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
    const tvPreviewOverlay = room?.tvPreviewOverlay && room.tvPreviewOverlay.active ? room.tvPreviewOverlay : null;
    const tvPreviewExpired = tvPreviewOverlay
        ? (Number(tvPreviewOverlay.startedAtMs || 0) + (Math.max(3, Number(tvPreviewOverlay.durationSec || 8)) * 1000)) <= nowMs()
        : true;
    const roundWinnersMoment = room?.roundWinnersMoment?.active ? room.roundWinnersMoment : null;
    const roundWinnersMomentExpired = roundWinnersMoment
        ? (Number(roundWinnersMoment.expiresAtMs || 0) > 0 && Number(roundWinnersMoment.expiresAtMs || 0) <= nowMs())
        : true;
    if (tvPreviewOverlay && !tvPreviewExpired) {
        return <RunOfShowTakeoverOverlay overlay={tvPreviewOverlay} roomCode={roomCode} logoUrl={room?.logoUrl || ASSETS.logo} brandTheme={tvAudienceBrandTheme} zClass="z-[205]" preview nowValue={takeoverNowMs} />;
    }
    if (roundWinnersMoment && !roundWinnersMomentExpired) {
        return <RoundWinnersPodiumOverlay moment={roundWinnersMoment} />;
    }
    if (room?.activeScreen === 'leaderboard') {
        return (
            <>
                <RunOfShowStatusHud hud={runOfShowHud} />
                <LeaderboardOverlay users={roomUsers} songs={songs} premiumBadgeLabel={tvPremiumBadgeLabel} />
            </>
        );
    }
    if (room?.activeScreen === 'tipping') {
        return (
            <>
                <RunOfShowStatusHud hud={runOfShowHud} />
                <TipOverlay room={room} />
            </>
        );
    }
            if (room?.howToPlay?.active) return <HowToPlayOverlay roomCode={roomCode} logoUrl={room?.logoUrl} queueRules={queueRules} startedAtMs={Number(room?.howToPlay?.id || 0)} brandEyebrow={tvBrandEyebrow} poweredByLabel={tvPoweredByLabel} brandTitle={tvBrandTitle} />;
    if (room?.readyCheck?.active) {
        const readyCount = roomUsers.filter(u => u.isReady).length;
        const totalCount = roomUsers.length || 0;
        const readyPct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
        return (
            <div className="public-tv fixed inset-0 z-[200] bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.16),transparent_55%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.18),transparent_48%),#09090b] flex flex-col items-center justify-center p-4 md:p-8 2xl:p-12 text-center">
                <div className="flex items-center gap-3 mb-3 md:mb-4">
                    <div className="text-sm md:text-base uppercase tracking-[0.2em] md:tracking-[0.4em] text-zinc-200">Ready Check</div>
                    {autoCrowdMomentActive && (
                        <span className="px-3 py-1 rounded-full border border-cyan-300/45 bg-cyan-500/16 text-[10px] md:text-xs font-black tracking-[0.18em] text-cyan-100">
                            AUTO PARTY
                        </span>
                    )}
                </div>
                <div className="text-[clamp(5rem,24vw,18rem)] font-black text-white leading-none">{readyTimer || 0}</div>
                <div className="text-2xl md:text-4xl 2xl:text-5xl font-bebas text-cyan-300 mt-3 md:mt-6">ARE YOU READY?</div>
                <div className="text-base md:text-2xl text-zinc-200 mt-2 md:mt-4">{readyCount} / {totalCount} ready ({readyPct}%)</div>
                <div className="mt-4 md:mt-6 w-[86vw] max-w-[640px] h-3 md:h-4 rounded-full border border-white/20 bg-black/35 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-pink-400 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, readyPct))}%` }}></div>
                </div>
                {autoCrowdMomentActive && (
                    <div className="text-sm md:text-lg text-cyan-200 mt-4">{autoCrowdMomentDetail}</div>
                )}
                <div className="text-sm md:text-lg text-zinc-300 mt-3">Grab your phone and tap READY before the clock hits zero.</div>
            </div>
        );
    }
    const activeGameCartridgeMode = !!(room?.activeMode && !['karaoke','applause','selfie_cam','selfie_challenge','applause_countdown','applause_result','doodle_oke'].includes(room.activeMode));
    if (room?.announcement?.active && !activeGameCartridgeMode) {
        const announcement = room.announcement || {};
        const isExpiredMediaScene = String(announcement?.type || '').trim().toLowerCase() === 'media_scene'
            && Number(announcement?.durationSec || 0) > 0
            && Number(announcement?.startedAtMs || 0) > 0
            && (Number(announcement.startedAtMs) + (Number(announcement.durationSec) * 1000)) <= nowMs();
        if (!isExpiredMediaScene) {
            return <RunOfShowTakeoverOverlay overlay={announcement} roomCode={roomCode} logoUrl={room?.logoUrl || ASSETS.logo} brandTheme={tvAudienceBrandTheme} zClass="z-[195]" nowValue={takeoverNowMs} />;
        }
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
                                    ? tvChatLockedLabel
                                    : 'No chat yet.'}
                        </div>
                    )}
                    {groupedChatMessages.map((group) => (
                        <div key={group.id} className="rounded-2xl border border-white/10 bg-black/45 px-4 md:px-5 py-3 md:py-4">
                            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                <span className="text-2xl md:text-3xl">{group.avatar || EMOJI.sparkle}</span>
                                <span className="font-bold text-white text-lg md:text-2xl truncate">{group.user || 'Guest'}</span>
                                {group.isVip && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] md:text-xs font-black tracking-[0.12em] bg-yellow-400 text-black">{tvPremiumBadgeLabel}</span>
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
            <div data-feature-id="tv-doodle-oke" className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-4 md:p-6 2xl:p-10 text-white">
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
                                    {submissionsSorted.slice(0, 6).map(s => {
                                        const isFresh = doodleRecentSubmissionIds.has(s.id);
                                        return (
                                        <div key={s.id} className={`doodle-wall-card bg-black/70 border rounded-2xl p-3 relative overflow-hidden ${isFresh ? 'doodle-wall-card-fresh border-cyan-300/45' : 'border-white/10'}`}>
                                            {isFresh && (
                                                <div className="doodle-arrival-chip absolute right-3 top-3 z-10 rounded-full border border-cyan-200/45 bg-cyan-300/16 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100">
                                                    Fresh ink
                                                </div>
                                            )}
                                            <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),rgba(244,114,182,0.12)_48%,rgba(0,0,0,0)_80%)] pointer-events-none" />
                                            <div className="text-base md:text-lg text-zinc-300 mb-2">{s.avatar ? `${s.avatar} ` : ''}{s.name || 'Guest'}</div>
                                            <div className="aspect-square bg-zinc-950 rounded-xl overflow-hidden relative">
                                                <img src={s.image} alt={s.name} className="w-full h-full object-contain" />
                                                <img src={room?.logoUrl || ASSETS.logo} className="absolute top-2 right-2 md:top-3 md:right-3 w-10 md:w-16 opacity-70" alt={tvLogoAlt} />
                                            </div>
                                            <div className="mt-2 text-base md:text-lg font-semibold text-cyan-200">{voteCounts[s.uid] || 0} votes</div>
                                        </div>
                                    )})}
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
    if (activeGameCartridgeMode) {
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
                        <img src={room?.logoUrl || ASSETS.logo} className="w-40 mx-auto mb-4 opacity-80" alt={tvLogoAlt} />
                        <div className="text-3xl font-bebas text-cyan-300 mb-2">Bingo Live</div>
                        <div className="text-sm uppercase tracking-[0.4em] text-zinc-400">Check your phone to play</div>
                    </div>
                </div>
            );
        }

        return (
            <>
                <RunOfShowStatusHud hud={runOfShowHud} />
                <GameContainer
                    activeMode={room.activeMode}
                    roomCode={roomCode}
                    gameState={gamePayload}
                    playerData={room.gameData}
                    isPlayer={tvIsPlayer}
                    users={roomUsers}
                    room={room}
                    inputSource={inputSource}
                    rulesToken={room?.gameRulesId}
                    view="tv"
                />
            </>
        );
    }

    // 3. Recap Overlay
    if (recap) {
        const topFan = recap.topFan;
        const vibeStats = recap.vibeStats;
        const popTriviaSummary = recap.popTriviaSummary;
        const rawSongTitle = String(recap.songTitle || '').trim();
        const parseRecapSongTitle = (value, explicitArtist = '') => {
            const raw = String(value || '').trim();
            const normalizedExplicitArtist = String(explicitArtist || '').trim();
            if (!raw) {
                return {
                    title: 'Featured Performance',
                    artist: normalizedExplicitArtist,
                    source: ''
                };
            }
            const zoomMatch = raw.match(/^(.*?)\s*-\s*(.*?)\s*-\s*Karaoke Version(?: from (.*))?$/i);
            if (zoomMatch) {
                return {
                    title: String(zoomMatch[2] || '').trim() || raw,
                    artist: normalizedExplicitArtist || String(zoomMatch[1] || '').trim(),
                    source: String(zoomMatch[3] || '').trim()
                };
            }
            const pipeMatch = raw.match(/^(.*?)\s*\((?:karaoke|instrumental)\)\s*\|\s*(.*)$/i);
            if (pipeMatch) {
                return {
                    title: String(pipeMatch[1] || '').trim() || raw,
                    artist: normalizedExplicitArtist || String(pipeMatch[2] || '').trim(),
                    source: ''
                };
            }
            return {
                title: raw
                    .replace(/\s*-\s*Karaoke Version.*$/i, '')
                    .replace(/\s*\((?:karaoke|instrumental)\)\s*$/i, '')
                    .trim() || raw,
                artist: normalizedExplicitArtist,
                source: ''
            };
        };
        const recapSongMeta = parseRecapSongTitle(rawSongTitle, recap.artist || recap.displayArtist || '');
        const vibeScore = Math.max(0, Number(recap.hypeScore || 0));
        const applauseScore = Math.max(0, Math.round(recap.applauseScore || 0));
        const hostBonus = Math.max(0, Number(recap.hostBonus || 0));
        const totalPoints = vibeScore + applauseScore + hostBonus;
        const performanceTier = totalPoints >= 260
            ? 'Room Shaker'
            : totalPoints >= 190
                ? 'Crowd Favorite'
                : totalPoints >= 120
                    ? 'Strong Finish'
                    : 'Warm Applause';
        const guitarHits = Math.max(0, Number(vibeStats?.guitar?.totalHits || 0));
        const beatTaps = Math.max(0, Number(vibeStats?.strobe?.totalTaps || 0));
        const triviaQuestions = Math.max(0, Number(popTriviaSummary?.questionCount || 0));
        const triviaPlayers = Math.max(0, Number(popTriviaSummary?.participantCount || 0));
        const triviaAnswers = Math.max(0, Number(popTriviaSummary?.answerCount || 0));
        const topFanGifted = Math.max(0, Number(topFan?.pointsGifted || 0));
        const recapProgressPct = Math.max(16, Math.min(100, Math.round((totalPoints / 300) * 100)));
        const scoreBreakdownCards = [
            {
                key: 'vibe',
                label: 'Vibe Score',
                value: vibeScore,
                accent: 'from-fuchsia-400/30 via-fuchsia-400/14 to-transparent',
                tone: 'border-fuchsia-400/30 bg-fuchsia-400/12 text-fuchsia-100'
            },
            {
                key: 'applause',
                label: 'Applause',
                value: applauseScore,
                accent: 'from-amber-300/30 via-amber-300/14 to-transparent',
                tone: 'border-amber-300/30 bg-amber-300/12 text-amber-100'
            },
            hostBonus > 0 ? {
                key: 'bonus',
                label: 'Host Bonus',
                value: hostBonus,
                accent: 'from-emerald-300/30 via-emerald-300/14 to-transparent',
                tone: 'border-emerald-300/30 bg-emerald-300/12 text-emerald-100'
            } : null
        ].filter(Boolean);
        const crowdMomentCards = [
            topFanGifted > 0 ? {
                key: 'fan',
                label: 'Top Fan Gift',
                value: `${topFanGifted} pts`,
                detail: `${topFan?.avatar || EMOJI.sparkle} ${topFan?.name || 'Crowd favorite'}`,
                tone: 'border-cyan-300/24 bg-cyan-300/10 text-cyan-100'
            } : null,
            guitarHits > 0 ? {
                key: 'guitar',
                label: 'Guitar Hits',
                value: guitarHits,
                detail: 'Audience play landed on beat',
                tone: 'border-orange-300/24 bg-orange-300/10 text-orange-100'
            } : null,
            beatTaps > 0 ? {
                key: 'beat',
                label: 'Beat Taps',
                value: beatTaps,
                detail: 'Crowd kept the pulse moving',
                tone: 'border-pink-300/24 bg-pink-300/10 text-pink-100'
            } : null,
            triviaPlayers > 0 ? {
                key: 'trivia',
                label: 'Trivia Players',
                value: triviaPlayers,
                detail: triviaQuestions > 0 ? `${triviaQuestions} prompt${triviaQuestions === 1 ? '' : 's'} in play` : 'Audience joined the trivia recap',
                tone: 'border-sky-300/24 bg-sky-300/10 text-sky-100'
            } : null
        ].filter(Boolean).slice(0, 3);
        const recapStartMs = getTimestampMs(recap.timestamp) || recapNowMs;
        const recapAgeMs = Math.max(0, recapNowMs - recapStartMs);
        const recapLeaderboardPhase = recapAgeMs >= performanceRecapBreakdownMs;
        const rankedPerformanceLeaderboard = buildPerformanceLeaderboardStats(songs, roomUsers, recap);
        const recapLeaderboardMode = LEADERBOARD_MODE_DEFS.find((mode) => mode.key === 'totalPoints') || LEADERBOARD_MODE_DEFS[3];
        const rankedPerformanceLeaderboardWithRanks = sortLeaderboardEntriesForMode(rankedPerformanceLeaderboard, recapLeaderboardMode);
        const performerLeaderboardEntry = rankedPerformanceLeaderboardWithRanks.find((entry) => entry.isCurrentPerformance) || null;
        const performerEntryKey = getLeaderboardEntryKey(performerLeaderboardEntry);
        const performerRank = performerLeaderboardEntry?.rank || 0;
        const performerGapToLeader = performerLeaderboardEntry
            ? Math.max(0, Number(rankedPerformanceLeaderboardWithRanks[0]?.totalPoints || 0) - Number(performerLeaderboardEntry.totalPoints || 0))
            : 0;
        const preRecapLeaderboard = sortLeaderboardEntriesForMode(
            rankedPerformanceLeaderboard.filter((entry) => !entry.isCurrentPerformance),
            recapLeaderboardMode
        );
        const preRankByUid = preRecapLeaderboard.reduce((acc, entry) => {
            acc[getLeaderboardEntryKey(entry)] = entry.rank;
            return acc;
        }, {});
        const leaderboardShowcase = buildRecapLeaderboardWindow(
            rankedPerformanceLeaderboardWithRanks,
            performerEntryKey
        );
        const leaderboardRankDeltaByUid = leaderboardShowcase.reduce((acc, entry) => {
            const entryKey = getLeaderboardEntryKey(entry);
            const previousRank = Number(preRankByUid?.[entryKey] || (rankedPerformanceLeaderboardWithRanks.length + 1));
            acc[entryKey] = previousRank - Number(entry.rank || 0);
            return acc;
        }, {});
        if (recapLeaderboardPhase) {
            return (
                <div className="fixed inset-0 z-[200] overflow-hidden bg-[#04060e] text-white animate-in fade-in duration-500">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(251,191,36,0.18),transparent_24%),radial-gradient(circle_at_18%_22%,rgba(244,114,182,0.18),transparent_20%),radial-gradient(circle_at_82%_24%,rgba(34,211,238,0.2),transparent_18%),linear-gradient(180deg,rgba(7,10,18,0.98),rgba(4,6,14,1))]" />
                    <div className="absolute inset-x-[10%] top-[11%] h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
                    <div className="absolute inset-x-[12%] bottom-[13%] h-px bg-gradient-to-r from-transparent via-fuchsia-300/55 to-transparent" />
                    <div className="absolute left-[8%] top-[18%] h-56 w-56 rounded-full bg-fuchsia-400/15 blur-3xl" />
                    <div className="absolute right-[7%] top-[16%] h-64 w-64 rounded-full bg-cyan-400/14 blur-3xl" />
                    <div className="absolute bottom-[10%] left-[38%] h-56 w-56 rounded-full bg-yellow-300/12 blur-3xl" />

                    <div className="relative z-10 flex min-h-full flex-col justify-center px-6 py-8 md:px-10 2xl:px-14">
                        <div className="mx-auto w-full max-w-[1840px]">
                            <div className="flex flex-wrap items-end justify-between gap-6">
                                <div>
                                    <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/28 bg-cyan-300/10 px-4 py-2 text-[12px] uppercase tracking-[0.34em] text-cyan-100">
                                        <i className="fa-solid fa-ranking-star" />
                                        Performance Leaderboard
                                    </div>
                                    <div className="mt-5 text-5xl font-black uppercase leading-[0.88] text-white md:text-7xl 2xl:text-[7rem]">
                                        {performerRank > 0 ? `${recap.singerName} lands at #${performerRank}` : `${recap.singerName} hits tonight's board`}
                                    </div>
                                    <div className="mt-4 text-xl uppercase tracking-[0.24em] text-zinc-200 md:text-2xl 2xl:text-[2rem]">
                                        {performerLeaderboardEntry
                                            ? `${performerLeaderboardEntry.totalPoints} points for this song`
                                            : 'Performance standings refreshed'}
                                    </div>
                                </div>
                                <div className="rounded-[2rem] border border-yellow-300/24 bg-yellow-300/10 px-6 py-5 text-right shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
                                    <div className="text-[11px] uppercase tracking-[0.32em] text-yellow-100/85">This performance</div>
                                    <div className="mt-2 text-6xl font-black leading-none text-yellow-200 md:text-7xl 2xl:text-[6rem]">+{totalPoints}</div>
                                    <div className="mt-2 text-lg uppercase tracking-[0.24em] text-yellow-100/80">
                                        {performerRank === 1
                                            ? 'Top score tonight'
                                            : performerLeaderboardEntry
                                                ? `${performerGapToLeader} behind #1`
                                                : 'Score added'}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10">
                                <LeaderboardCardStack
                                    entries={leaderboardShowcase}
                                    mode={recapLeaderboardMode}
                                    highlightedEntryKey={performerEntryKey}
                                    rankDeltaByUid={leaderboardRankDeltaByUid}
                                    animated
                                    animationKey={`${recapTs || recap.songTitle || 'recap'}-performance-board`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return (
            <div className="fixed inset-0 z-[200] overflow-hidden bg-[#05070f] text-white animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.28),_transparent_32%),radial-gradient(circle_at_18%_30%,_rgba(244,114,182,0.18),_transparent_24%),radial-gradient(circle_at_82%_24%,_rgba(34,211,238,0.22),_transparent_22%),linear-gradient(180deg,_rgba(9,12,22,0.96),_rgba(3,5,10,0.98))]" />
                <div className="absolute -left-16 top-[14%] h-56 w-56 rounded-full bg-fuchsia-500/18 blur-3xl" />
                <div className="absolute right-[-4rem] top-[10%] h-72 w-72 rounded-full bg-cyan-400/16 blur-3xl" />
                <div className="absolute bottom-[-5rem] left-[28%] h-64 w-64 rounded-full bg-amber-300/12 blur-3xl" />

                <div className="relative z-10 flex min-h-full items-center justify-center px-4 py-3 md:px-6 md:py-5 2xl:px-10 2xl:py-8">
                    <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-[1800px] flex-col overflow-hidden rounded-[2.4rem] border border-white/12 bg-[linear-gradient(145deg,rgba(16,20,35,0.95),rgba(8,10,20,0.92))] shadow-[0_30px_120px_rgba(0,0,0,0.6)] md:max-h-[calc(100vh-2.5rem)]">
                        <div className="relative shrink-0 overflow-hidden border-b border-white/10 px-5 py-4 md:px-7 md:py-5">
                            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(251,191,36,0.16),rgba(244,114,182,0.08),rgba(34,211,238,0.12))]" />
                            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-yellow-300/35 bg-yellow-300/12 px-3 py-1.5 text-[11px] uppercase tracking-[0.3em] text-yellow-100">
                                        <i className="fa-solid fa-stars" />
                                        Performance Recap
                                    </div>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-zinc-200">
                                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
                                        {performanceTier}
                                    </div>
                                    {recap.preview && (
                                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
                                            Preview on TV
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    {recap.hallOfFame?.newAllTime && (
                                        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-300/45 bg-yellow-300/15 px-4 py-2 text-xs md:text-sm uppercase tracking-[0.28em] text-yellow-100 shadow-[0_0_32px_rgba(250,204,21,0.18)]">
                                            <i className="fa-solid fa-trophy" />
                                            New Global High Score
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="min-h-0 overflow-y-auto overscroll-contain">
                            <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.95fr)] md:gap-6 md:p-6 2xl:gap-8 2xl:p-8">
                            <div className="space-y-4 md:space-y-5">
                                <div className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(16,18,34,0.94),rgba(26,11,37,0.9),rgba(5,28,40,0.9))] p-5 md:p-6 2xl:p-8">
                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(250,204,21,0.18),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(34,211,238,0.18),transparent_18%)]" />
                                    <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:gap-8">
                                        <div className="relative shrink-0">
                                            {recap.albumArtUrl ? (
                                                <img
                                                    src={recap.albumArtUrl}
                                                    alt={recap.songTitle}
                                                    className="h-36 w-36 rounded-[1.8rem] border border-white/15 object-cover shadow-[0_18px_45px_rgba(0,0,0,0.4)] md:h-44 md:w-44 2xl:h-56 2xl:w-56"
                                                />
                                            ) : (
                                                <div className="flex h-36 w-36 items-center justify-center rounded-[1.8rem] border border-white/15 bg-white/6 text-6xl text-yellow-200 shadow-[0_18px_45px_rgba(0,0,0,0.35)] md:h-44 md:w-44 2xl:h-56 2xl:w-56 2xl:text-8xl">
                                                    <i className="fa-solid fa-microphone-lines" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1 text-left">
                                            <div className="text-[12px] uppercase tracking-[0.36em] text-cyan-100/90 md:text-sm">
                                                Just finished on stage
                                            </div>
                                            <div className="mt-4 text-4xl font-black leading-[0.9] text-white md:text-6xl xl:text-[4.8rem] 2xl:text-[6rem]">
                                                {recapSongMeta.title}
                                            </div>
                                            {(recapSongMeta.artist || recapSongMeta.source) && (
                                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-base uppercase tracking-[0.22em] text-cyan-100 md:text-lg 2xl:text-[1.45rem]">
                                                    {recapSongMeta.artist && <span>{recapSongMeta.artist}</span>}
                                                    {recapSongMeta.artist && recapSongMeta.source && <span className="text-white/30">/</span>}
                                                    {recapSongMeta.source && <span>{recapSongMeta.source}</span>}
                                                </div>
                                            )}
                                            <div className="mt-5 text-3xl font-black leading-none text-fuchsia-200 md:text-5xl xl:text-[3.7rem] 2xl:text-[4.5rem]">
                                                {recap.singerName}
                                            </div>
                                            <div className="mt-2 text-base uppercase tracking-[0.28em] text-zinc-300 md:text-lg 2xl:text-[1.35rem]">
                                                {performanceTier}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    {scoreBreakdownCards.map((item) => (
                                        <div
                                            key={item.key}
                                            className={`relative overflow-hidden rounded-[1.8rem] border px-5 py-4 md:px-6 md:py-5 2xl:px-7 2xl:py-6 ${item.tone}`}
                                        >
                                            <div className={`absolute inset-0 bg-gradient-to-br ${item.accent}`} />
                                            <div className="relative z-10">
                                                <div className="text-[12px] uppercase tracking-[0.28em] text-white/80">{item.label}</div>
                                                <div className="mt-3 text-5xl font-black leading-none text-white md:text-6xl 2xl:text-[5.2rem]">{item.value}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {crowdMomentCards.length > 0 && (
                                    <div className="grid gap-4 md:grid-cols-3">
                                        {crowdMomentCards.map((item) => (
                                            <div
                                                key={item.key}
                                                className={`rounded-[1.6rem] border px-5 py-4 md:px-6 md:py-5 ${item.tone}`}
                                            >
                                                <div className="text-[11px] uppercase tracking-[0.28em] text-white/75">{item.label}</div>
                                                <div className="mt-3 text-3xl font-black leading-none text-white md:text-4xl">{item.value}</div>
                                                {item.detail && (
                                                    <div className="mt-2 text-sm font-semibold text-white/80 md:text-base">{item.detail}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 md:space-y-5">
                                <div className="relative overflow-hidden rounded-[2.2rem] border border-yellow-300/24 bg-[linear-gradient(180deg,rgba(255,214,102,0.10),rgba(255,255,255,0.03),rgba(255,255,255,0.02))] p-5 md:p-6 2xl:p-8">
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-200/60 to-transparent" />
                                    <div className="absolute right-5 top-5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-cyan-100">
                                        {tvScoreLabel}
                                    </div>
                                    <div className="text-[12px] uppercase tracking-[0.38em] text-yellow-100">Final Score</div>
                                    <div className="mt-4 text-[5.5rem] font-black leading-none text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-white to-yellow-300 md:text-[8.5rem] xl:text-[10rem] 2xl:text-[12rem]">
                                        {totalPoints}
                                    </div>
                                    <div className="mt-2 text-xl font-black uppercase tracking-[0.34em] text-yellow-100/90 md:text-2xl 2xl:text-[1.8rem]">
                                        Total Points
                                    </div>
                                    <div className="mt-6 rounded-[1.8rem] border border-white/10 bg-black/25 p-5 md:p-6 2xl:p-7">
                                        <div className="flex items-center justify-between gap-4 text-base text-zinc-200 md:text-lg 2xl:text-[1.35rem]">
                                            <span>Room energy</span>
                                            <span className="font-black text-white">{performanceTier}</span>
                                        </div>
                                        <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/8 2xl:h-5">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-amber-300 to-cyan-300"
                                                style={{ width: `${recapProgressPct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[2rem] border border-white/10 bg-black/20 p-5 md:p-6 2xl:p-7">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-[11px] uppercase tracking-[0.34em] text-zinc-300">Crowd Snapshot</div>
                                            <div className="mt-2 text-xl font-black text-white md:text-2xl 2xl:text-[2rem]">Room moments from this performance</div>
                                        </div>
                                        <img
                                            src={room?.logoUrl || ASSETS.logo}
                                            alt={tvLogoAlt}
                                            className="h-14 w-auto object-contain opacity-90 drop-shadow-[0_0_24px_rgba(34,211,238,0.2)] 2xl:h-16"
                                        />
                                    </div>
                                    <div className="mt-5 grid grid-cols-1 gap-3">
                                        {topFanGifted > 0 && (
                                            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-4">
                                                <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-400">Top fan</div>
                                                <div className="mt-2 text-2xl font-black text-white md:text-3xl 2xl:text-[2.3rem]">
                                                    {topFan?.avatar || EMOJI.sparkle} {topFan?.name || 'Crowd favorite'} - {topFanGifted} pts
                                                </div>
                                            </div>
                                        )}
                                        {(guitarHits > 0 || beatTaps > 0 || triviaPlayers > 0) && (
                                            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-4">
                                                <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-400">Live interaction</div>
                                                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-3 text-lg font-black text-white md:text-2xl 2xl:text-[1.9rem]">
                                                    {guitarHits > 0 && <span>{guitarHits} guitar hits</span>}
                                                    {beatTaps > 0 && <span>{beatTaps} beat taps</span>}
                                                    {triviaPlayers > 0 && <span>{triviaPlayers} trivia players</span>}
                                                    {triviaAnswers > 0 && <span>{triviaAnswers} trivia answers</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    
    // 4. Main Stage Layout
    const roomLayoutMode = String(room?.layoutMode || '').trim().toLowerCase();
    const roomTvPresentationProfile = normalizeTvExploreProfile(room?.tvPresentationProfile || '') || 'room';
    const tvPresentationProfile = tvExploreEnabled
        ? (tvExploreProfile === 'room' ? roomTvPresentationProfile : tvExploreProfile)
        : roomTvPresentationProfile;
    const exploreSimple = tvPresentationProfile === 'simple';
    const exploreCinema = tvPresentationProfile === 'cinema';
    const isCinema = exploreCinema || roomLayoutMode === 'cinema';
    const isSimpleTvProfile = exploreSimple;
    const isMinimal = !exploreSimple && !exploreCinema && roomLayoutMode === 'minimal';
    const guitarTakeoverMode = room?.lightMode === 'guitar';
    const hasActivePopTriviaPanel = !!(popTriviaQuestion || showPopTriviaEndState);
    const popTriviaProgressPct = popTriviaQuestion
        ? Math.max(0, Math.min(100, (Number(popTriviaState?.timeLeftSec || 0) / Math.max(1, Number(popTriviaRoundSec || DEFAULT_POP_TRIVIA_ROUND_SEC))) * 100))
        : 100;
    const popTriviaQuestionFlashVisible = popTriviaQuestionAnnounceUntilMs > popTriviaNow;
    const popTriviaUrgencyPulseVisible = popTriviaUrgencyPulseUntilMs > popTriviaNow;
    const popTriviaUrgent = !!popTriviaQuestion && Number(popTriviaState?.timeLeftSec || 0) <= 5;
    const popTriviaStageSpanClass = isCinema
        ? 'col-span-12'
        : (lobbyCompactHudMode || isSimpleTvProfile ? 'col-span-12 lg:col-span-9' : 'col-span-12 lg:col-span-8');
    const popTriviaSidebarSpanClass = lobbyCompactHudMode || isSimpleTvProfile ? 'col-span-12 lg:col-span-3' : 'col-span-12 lg:col-span-4';
    const defaultStageSpanClass = isCinema
        ? 'col-span-12'
        : (lobbyCompactHudMode || isSimpleTvProfile ? 'col-span-12 lg:col-span-9' : 'col-span-12 lg:col-span-8');
    const defaultSidebarSpanClass = lobbyCompactHudMode || isSimpleTvProfile ? 'col-span-12 lg:col-span-3' : 'col-span-12 lg:col-span-4';
    const stageAreaSpanClass = hasActivePopTriviaPanel
        ? popTriviaStageSpanClass
        : (guitarTakeoverMode ? 'col-span-12' : defaultStageSpanClass);
    const sidebarAreaSpanClass = hasActivePopTriviaPanel ? popTriviaSidebarSpanClass : defaultSidebarSpanClass;
    const showAmbientFx = !exploreSimple;
    const showJoinOverlay = !room?.hideJoinOverlay;
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
            if (room?.lightMode === 'volley') return 'orb';
            if (combo >= 88) return 'halo';
            if (combo >= 65) return 'orb';
            return visualizerBaseMode;
        })()
        : visualizerBaseMode;
    const visualizerActive = (started || applauseStep !== 'idle') && visualizerEnabled;
    const renderJoinOverlayCard = ({ floating = false } = {}) => {
        if (!showJoinOverlay) return null;
        const shellClass = floating
            ? (isVeryShortViewport
                ? 'absolute right-3 top-3 z-[160] max-w-[min(34vw,17rem)]'
                : 'absolute right-3 top-3 md:right-5 md:top-5 2xl:right-8 2xl:top-8 z-[160] max-w-[min(30vw,20rem)]')
            : '';
        const cardClass = floating
            ? 'rounded-2xl border-[3px] border-fuchsia-300/45 bg-black/58 px-3 py-3 shadow-[0_0_30px_rgba(0,0,0,0.28)] backdrop-blur-xl'
            : `${isTinyHostPreviewMode ? 'p-2 rounded-xl' : lobbyCompactHudMode ? 'p-2 md:p-3 lg:-mt-1' : 'p-3 md:p-3.5 lg:-mt-2'} ${isTinyHostPreviewMode ? '' : 'md:rounded-3xl'} rounded-2xl shadow-lg border-[3px] border-fuchsia-400/45 bg-black/35 backdrop-blur-xl`;
        const qrFrameClass = floating
            ? 'shrink-0 rounded-2xl border-[3px] border-white/80 bg-white p-1.5 shadow-[0_0_22px_rgba(255,255,255,0.14)]'
            : `shrink-0 bg-white ${isTinyHostPreviewMode ? 'p-1 rounded-xl' : lobbyCompactHudMode ? 'p-1.5 md:p-2' : 'p-2 md:p-2.5'} ${isTinyHostPreviewMode ? '' : 'md:rounded-3xl'} rounded-2xl border-[3px] border-white/80 shadow-[0_0_28px_rgba(255,255,255,0.16)]`;
        const qrClass = floating
            ? 'w-[88px] h-[88px] md:w-[108px] md:h-[108px] 2xl:w-[124px] 2xl:h-[124px]'
            : joinQrClass;
        const qrSize = floating ? 124 : joinQrSize;
        return (
            <div className={shellClass}>
                <div className={cardClass}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 text-left">
                            <div className={`${floating ? 'text-[11px] tracking-[0.22em]' : isTinyHostPreviewMode ? 'text-[10px] tracking-[0.24em]' : lobbyCompactHudMode ? 'text-sm md:text-base tracking-[0.18em]' : 'text-base md:text-lg tracking-[0.2em]'} font-black text-cyan-100 uppercase`}>
                                Join
                            </div>
                            <div className={`${floating ? 'mt-1 text-2xl md:text-3xl tracking-[0.14em]' : isTinyHostPreviewMode ? 'mt-1 text-lg tracking-[0.18em]' : lobbyCompactHudMode ? 'mt-1 text-2xl md:text-3xl tracking-[0.12em]' : 'mt-1 text-3xl md:text-4xl tracking-[0.14em]'} font-bebas text-white`}>
                                {roomCode}
                            </div>
                            <div className={`${floating ? 'mt-1 text-[10px]' : isTinyHostPreviewMode ? 'mt-1 text-[9px]' : 'mt-1.5 text-[11px] md:text-xs'} uppercase font-semibold tracking-[0.14em] text-zinc-100/85`}>
                                {showTinyJoinHint ? 'Scan QR to join' : 'Scan or type this URL'}
                            </div>
                            <div className={`${floating ? 'mt-1 text-[11px] md:text-xs' : isTinyHostPreviewMode ? 'mt-1 text-[9px]' : lobbyCompactHudMode ? 'mt-1 text-xs md:text-sm' : 'mt-1.5 text-sm md:text-base'} font-black tracking-[0.03em] leading-tight text-cyan-100 break-all`}>
                                {showVerboseJoinUrl ? joinUrlDisplay : `${joinUrlBaseDisplay}${joinUrlQueryDisplay}`}
                            </div>
                        </div>
                        <div className={qrFrameClass}>
                            <LocalQrImage
                                value={joinUrl}
                                size={qrSize}
                                alt="QR"
                                className={qrClass}
                            />
                        </div>
                    </div>
                    {isMinimal && !floating && !isTinyHostPreviewMode ? <div className="mt-3"><MiniVideoPane room={room} current={current} muted={isHostPreviewEmbed} /></div> : null}
                </div>
                {!floating ? <div className="h-[2px] mx-4 rounded-full bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-40"></div> : null}
            </div>
        );
    };
    const bingoRng = room?.bingoMysteryRng;
    const showBingoRngOverlay = room?.bingoMode === 'mystery' && (
        bingoRng?.active ||
        (bingoRng?.finalized && (bingoRngNow - (bingoRng.finishedAt || 0) < 15000))
    );

    return (
        <div
            className={`public-tv h-screen min-h-screen w-full relative ${tvOverflowClass} font-saira text-white transition-colors duration-1000 ${bgClass} ${motionSafeFx ? 'motion-safe-fx' : ''}`}
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
            {!showVisualizerTv && showAmbientFx && (
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
                <img
                    src={room?.logoUrl || ASSETS.logo}
                    className={`tv-logo absolute top-3 left-3 md:top-5 md:left-5 2xl:top-8 2xl:left-8 ${lobbyCompactHudMode ? 'w-20 sm:w-28 md:w-36 lg:w-40 2xl:w-52' : logoSizeClass} z-50 drop-shadow-xl opacity-90`}
                    alt="Logo"
                />
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

            {showAmbientFx && tipPulse && (room?.tipUrl || room?.tipQrUrl || getRoomSupportSurface(room).url) && (
                <div className="absolute bottom-3 right-3 md:bottom-6 md:right-6 z-[120] bg-emerald-500/90 text-black px-3 py-2 md:px-6 md:py-4 rounded-2xl border-2 border-white shadow-[0_0_30px_rgba(16,185,129,0.6)] animate-pulse backdrop-blur">
                    <div className="text-xs md:text-sm font-bold uppercase tracking-[0.12em] md:tracking-widest">
                        {room?.tipUrl || room?.tipQrUrl ? 'Show some love' : (getRoomSupportSurface(room).label || 'Support the room')}
                    </div>
                    <div className="text-sm md:text-2xl font-black">
                        {room?.tipUrl || room?.tipQrUrl ? `Tip the host ${EMOJI.tip}` : 'Scan to support the fundraiser'}
                    </div>
                </div>
            )}
            {showAmbientFx && bonusDropBurst && (
                <div className="absolute inset-0 z-[210] pointer-events-none flex items-center justify-center">
                    <div className="bonus-drop-burst">
                        <div className="bonus-drop-title">{bonusDropBurst.by || 'Host'} made it rain</div>
                        <div className="bonus-drop-points">+{bonusDropBurst.points || 0} PTS</div>
                        <div className="bonus-drop-sub">for all lobby members</div>
                    </div>
                </div>
            )}
            {showAmbientFx && purchaseCelebrationBurst && (
                <div className="absolute inset-0 z-[212] pointer-events-none flex items-center justify-center">
                    <div className="bonus-drop-burst">
                        {purchaseCelebrationBurst.celebrationStyle === SUPPORT_CELEBRATION_STYLES.moneybagsBurst && (
                            <div className="bonus-drop-moneyline">
                                <span className="bonus-drop-avatar">{purchaseCelebrationBurst.buyerAvatar || '🤑'}</span>
                                <span>💰</span>
                                <span>💸</span>
                                <span>💰</span>
                                <span>🪩</span>
                            </div>
                        )}
                        <div className="bonus-drop-title">
                            {purchaseCelebrationBurst.title || `${purchaseCelebrationBurst.buyerName || 'Someone'} boosted the room`}
                        </div>
                        <div className="bonus-drop-points">
                            {purchaseCelebrationBurst.points > 0 ? `+${purchaseCelebrationBurst.points} PTS` : MONEYBAGS_BADGE_LABEL}
                        </div>
                        <div className="bonus-drop-sub">
                            {purchaseCelebrationBurst.amountCents > 0
                                ? `$${(purchaseCelebrationBurst.amountCents / 100).toFixed(2)} • `
                                : ''}
                            {purchaseCelebrationBurst.subtitle
                                || (purchaseCelebrationBurst.badgeAwarded
                                    ? `${purchaseCelebrationBurst.label || 'Room support'} - ${purchaseCelebrationBurst.badgeLabel || MONEYBAGS_BADGE_LABEL}`
                                    : (purchaseCelebrationBurst.label || 'Room support'))}
                        </div>
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
            
            {showAmbientFx && room?.lightMode === 'strobe' && (
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
            
            {showAmbientFx && room?.lightMode === 'storm' && (
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
            
            {showAmbientFx && room?.lightMode === 'banger' && (
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

            {showAmbientFx && room?.lightMode === 'ballad' && (
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
                    <div className="absolute top-6 md:top-8 2xl:top-10 left-1/2 -translate-x-1/2 text-center px-3">
                        <div className="text-xs md:text-sm font-bold tracking-[0.25em] md:tracking-[0.55em] text-white/80 uppercase">Lighter Wave</div>
                        <div className="mt-1 text-[11px] md:text-xs uppercase tracking-[0.18em] text-amber-100/90">Raise phones like zippos and sway with the chorus</div>
                    </div>
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 bg-black/65 border border-pink-300/40 rounded-2xl px-3 py-2 md:px-4 md:py-3 text-right min-w-[190px]">
                        <div className="text-xs md:text-sm uppercase tracking-[0.2em] text-pink-100">Singalong Glow</div>
                        <div className="mt-1 text-2xl md:text-3xl font-black text-white">{balladGlowScore}%</div>
                        <div className="mt-2 h-2 w-full bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-pink-300 to-cyan-300 transition-all duration-500" style={{ width: `${balladGlowScore}%` }}></div>
                        </div>
                    </div>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(92vw,940px)]">
                        <div className="rounded-2xl border border-amber-300/25 bg-black/45 backdrop-blur px-4 py-3">
                            <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-amber-100 mb-2 text-center">Audience Phone Lights</div>
                            <div className="flex items-end justify-center gap-1.5 md:gap-2">
                                {balladPhoneLights.map((light) => (
                                    <div
                                        key={light.id}
                                        className="relative w-6 h-10 md:w-7 md:h-12 rounded-md md:rounded-lg border border-white/25 bg-black/50 overflow-visible"
                                        style={{ transform: `translateY(${light.offsetPx}px)` }}
                                    >
                                        <div className="ballad-mini-flame" style={{ animationDelay: light.delay, animationDuration: light.duration, transform: `translateX(-50%) scale(${light.scale})` }}></div>
                                    </div>
                                ))}
                            </div>
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

            {showAmbientFx && room?.lightMode === 'guitar' && (
                <>
                    <div className="absolute inset-0 z-[80] pointer-events-none bg-gradient-to-b from-black/60 via-black/70 to-red-900/50"></div>
                    <div className="absolute inset-0 z-[81] pointer-events-none">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,59,120,0.15),transparent_55%)]"></div>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(255,140,0,0.1),transparent_60%)]"></div>
                    </div>
                    <div className="absolute inset-0 z-[85] pointer-events-none flex flex-col justify-between py-4 md:py-6 2xl:py-8">
                        <div className="px-4 md:px-8">
                            <div className="mx-auto max-w-[1480px] flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-5">
                                <div className="min-w-0">
                                    <div className={`${motionSafeFx ? 'text-5xl md:text-7xl' : 'text-[clamp(3.6rem,8.2vw,7.2rem)]'} font-bebas text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500 drop-shadow-[0_0_26px_rgba(255,120,0,0.8)] ${motionSafeFx ? '' : 'animate-pulse'}`}>GUITAR VIBE SYNC</div>
                                    <div className="mt-2 text-base md:text-[1.45rem] uppercase tracking-[0.18em] text-yellow-100/90">The room spotlight follows whoever is jamming hardest right now.</div>
                                    <div className="mt-4 flex flex-wrap items-center gap-3">
                                        <div className="bg-black/65 border border-yellow-300/35 rounded-full px-4 py-2 text-[13px] md:text-[15px] uppercase tracking-[0.16em] text-yellow-100">
                                            Top Jammer {guitarTopJammer ? `${guitarTopJammer.name} ${guitarTopJammer.guitarHits}` : 'Waiting'}
                                        </div>
                                        <div className="bg-black/65 border border-cyan-300/35 rounded-full px-4 py-2 text-[13px] md:text-[15px] uppercase tracking-[0.16em] text-cyan-100">{guitarActiveCount} Live Jammers</div>
                                        <div className="bg-black/65 border border-fuchsia-300/35 rounded-full px-4 py-2 text-[13px] md:text-[15px] uppercase tracking-[0.16em] text-fuchsia-100">{guitarSessionTotalHits} Total Hits</div>
                                    </div>
                                </div>
                                <div className="bg-black/65 border border-white/20 rounded-2xl px-4 py-4 min-w-[250px] md:min-w-[320px]">
                                    <div className="flex items-center justify-between gap-3 text-[12px] md:text-[13px] uppercase tracking-[0.2em] text-zinc-200">
                                        <span>Room Jam Intensity</span>
                                        <span className="font-black text-white text-lg md:text-2xl">{guitarSyncPower}%</span>
                                    </div>
                                    <div className="mt-2 h-3 w-full bg-white/20 rounded-full overflow-hidden border border-white/20">
                                        <div className="h-full bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-400 transition-all duration-200" style={{ width: `${guitarSyncPower}%` }}></div>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between text-[11px] md:text-[13px] uppercase tracking-[0.14em] text-zinc-200">
                                        <span>Accuracy {guitarSyncAccuracy}%</span>
                                        <span>Peak {guitarLeaderMaxHits} hits</span>
                                    </div>
                                    <div className="mt-2 text-[11px] md:text-[13px] uppercase tracking-[0.14em] text-zinc-300">
                                        {guitarTopJammer ? `Now leading: ${guitarTopJammer.name}` : `Energy ${guitarEngagementScore}%`}
                                    </div>
                                    {showJoinOverlay ? (
                                        <div className="mt-4 flex items-center gap-4">
                                            <div className="rounded-2xl bg-white p-2 shadow-[0_0_30px_rgba(255,255,255,0.18)]">
                                                <LocalQrImage
                                                    value={joinUrl}
                                                    size={86}
                                                    alt="QR"
                                                    className="h-[86px] w-[86px]"
                                                />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[11px] md:text-[13px] uppercase tracking-[0.18em] text-cyan-100">Join to Jam</div>
                                                <div className="mt-1 text-3xl md:text-4xl font-bebas text-white tracking-[0.14em]">{roomCode}</div>
                                                <div className="mt-1 text-[11px] md:text-[12px] uppercase tracking-[0.12em] text-zinc-200">Scan on your phone</div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <div className="w-full px-3 md:px-6 pb-2 md:pb-4">
                            <div className="mx-auto max-w-[1560px] grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_340px] gap-4 md:gap-5 items-stretch">
                                <div className="bg-black/62 border border-white/10 rounded-2xl md:rounded-3xl px-5 py-4 md:px-8 md:py-6 2xl:px-10 2xl:py-8 backdrop-blur-md min-w-0">
                                    <div className="flex items-center justify-between gap-3 mb-4 md:mb-5">
                                        <div>
                                            <div className="text-[13px] md:text-[15px] text-zinc-200 tracking-[0.28em] uppercase">Crowd Fretboard</div>
                                            <div className="text-[12px] md:text-[14px] uppercase tracking-[0.16em] text-zinc-300">Every phone in sync shows up here live.</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[11px] md:text-[13px] uppercase tracking-[0.16em] text-zinc-300">Players</div>
                                            <div className="text-3xl md:text-5xl font-bebas text-yellow-200">{guitarSessionParticipants.length}</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-3.5 md:gap-4">
                                        {guitarDisplayParticipants.length === 0 && (
                                            <div className="col-span-full text-zinc-300 text-xl md:text-[1.85rem] font-semibold border border-dashed border-white/15 rounded-2xl px-6 py-12 text-center">
                                                Start strumming to light up the crowd wall.
                                            </div>
                                        )}
                                        {guitarDisplayParticipants.map((p) => {
                                            const playerHits = Number(p?.guitarHits || 0);
                                            const recentBurst = Number(guitarRecentHitMap.get(p.uid) || 0);
                                            const isLive = (nowMs() - Number(p?.lastVibeAt || 0)) <= GUITAR_SYNC_ACTIVE_WINDOW_MS;
                                            const intensity = Math.min(1, ((recentBurst * 0.24) + (isLive ? 0.55 : 0.08)));
                                            const meterPct = Math.max(8, Math.round((playerHits / Math.max(1, guitarLeaderMaxHits)) * 100));
                                            return (
                                                <div
                                                    key={p.uid}
                                                    className={`relative overflow-hidden rounded-2xl border px-4 py-4 md:px-5 md:py-5 transition-all duration-200 ${isLive ? 'border-cyan-300/45 bg-cyan-400/[0.08] shadow-[0_0_28px_rgba(34,211,238,0.16)]' : 'border-white/10 bg-black/45'}`}
                                                    style={{
                                                        transform: `scale(${1 + Math.min(0.06, intensity * 0.06)})`
                                                    }}
                                                >
                                                    <div
                                                        className="absolute inset-0 pointer-events-none"
                                                        style={{
                                                            background: `radial-gradient(circle at 50% 0%, rgba(255,190,92,${0.18 + (intensity * 0.18)}), transparent 55%), radial-gradient(circle at 50% 100%, rgba(34,211,238,${0.08 + (intensity * 0.16)}), transparent 62%)`
                                                        }}
                                                    ></div>
                                                    <div className="relative flex items-start justify-between gap-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`h-14 w-14 md:h-16 md:w-16 rounded-2xl border border-white/15 bg-black/45 flex items-center justify-center text-4xl md:text-5xl ${isLive ? 'shadow-[0_0_20px_rgba(34,211,238,0.2)]' : ''}`}>
                                                                {p.avatar || EMOJI.guitar}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-white font-bold text-base md:text-[1.25rem] truncate">{p.name}</div>
                                                                <div className="text-[11px] md:text-[13px] uppercase tracking-[0.18em] text-zinc-300">
                                                                    {isLive ? 'Live on beat' : 'In session'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-300">Hits</div>
                                                            <div className="text-2xl md:text-3xl font-bebas text-yellow-200 leading-none">{playerHits}</div>
                                                        </div>
                                                    </div>
                                                    <div className="relative mt-4 h-3 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500"
                                                            style={{ width: `${meterPct}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="relative mt-3 flex items-center justify-between text-[11px] md:text-[13px] uppercase tracking-[0.16em] text-zinc-300">
                                                        <span>{recentBurst > 0 ? `Burst x${recentBurst}` : 'Ready'}</span>
                                                        <span>{isLive ? 'Active' : 'Standing by'}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:gap-5">
                                    <div className="bg-black/65 border border-white/15 rounded-2xl p-4 md:p-5 backdrop-blur-md">
                                        <div className="text-[11px] md:text-[13px] uppercase tracking-[0.2em] text-zinc-300 text-center">Jam Spotlight</div>
                                        {guitarTopJammer ? (
                                            <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-gradient-to-br from-yellow-300/10 via-orange-400/10 to-fuchsia-400/10 p-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-20 w-20 rounded-2xl border border-white/15 bg-black/45 flex items-center justify-center text-5xl shadow-[0_0_24px_rgba(250,204,21,0.18)]">
                                                        {guitarTopJammer.avatar || EMOJI.guitar}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[11px] md:text-[13px] uppercase tracking-[0.18em] text-yellow-100">Most active right now</div>
                                                        <div className="text-3xl md:text-4xl font-bebas text-white leading-none truncate">{guitarTopJammer.name}</div>
                                                        <div className="mt-2 text-base md:text-[1.2rem] uppercase tracking-[0.16em] text-zinc-200">{guitarTopJammer.guitarHits} hits</div>
                                                    </div>
                                                </div>
                                                <div className="mt-5 h-3.5 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
                                                    <div className="h-full rounded-full bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500" style={{ width: '100%' }}></div>
                                                </div>
                                                <div className="mt-4 flex items-center justify-between text-[11px] md:text-[13px] uppercase tracking-[0.16em] text-zinc-300">
                                                    <span>{guitarRunnerUp ? `Next up: ${guitarRunnerUp.name}` : 'No challenger yet'}</span>
                                                    <span>{guitarActiveCount} live</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-4 rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center text-base md:text-[1.2rem] text-zinc-400">
                                                Start strumming and the hottest jammer will take this spotlight.
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-black/60 border border-white/10 rounded-2xl p-4 md:p-5 backdrop-blur-md min-w-0">
                                        <div className="flex items-center justify-between gap-3 mb-4">
                                            <div className="text-[11px] md:text-[13px] uppercase tracking-[0.2em] text-zinc-200">Jam Leaderboard</div>
                                            <div className="text-[11px] md:text-[12px] uppercase tracking-[0.16em] text-zinc-300">Hits {guitarSessionTotalHits}</div>
                                        </div>
                                        <div className="space-y-3">
                                            {guitarLeaders.length === 0 && (
                                                <div className="text-zinc-400 text-base">No leaders yet.</div>
                                            )}
                                            {guitarLeaders.map((p, idx) => {
                                                const meterPct = Math.max(12, Math.round((Number(p?.guitarHits || 0) / Math.max(1, guitarLeaderMaxHits)) * 100));
                                                return (
                                                    <div key={p.uid} className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="h-12 w-12 rounded-xl border border-white/10 bg-black/55 flex items-center justify-center text-3xl">
                                                                    {p.avatar || EMOJI.guitar}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-white font-bold text-base truncate">{idx + 1}. {p.name}</div>
                                                                    <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-300">{p.guitarHits || 0} hits</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-2xl font-bebas text-yellow-200">{p.guitarHits || 0}</div>
                                                        </div>
                                                        <div className="mt-3 h-2.5 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
                                                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-yellow-300" style={{ width: `${meterPct}%` }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
            
            {multiplier >= 4 && <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_20%,#000_120%)] opacity-50 mix-blend-overlay pointer-events-none"></div>}

            {!isCinema && hasActivePopTriviaPanel && (
                <div className="absolute inset-y-3 left-3 right-3 md:inset-y-5 md:left-auto md:right-5 md:w-[min(46vw,920px)] 2xl:inset-y-8 2xl:right-8 z-[125] pointer-events-none">
                    <div
                        data-feature-id="tv-pop-trivia-overlay"
                        className={`h-full rounded-[1.75rem] md:rounded-[2.2rem] border backdrop-blur-xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${
                            popTriviaQuestion
                                ? 'border-cyan-300/55 bg-gradient-to-br from-[#030714]/96 via-[#07111f]/95 to-[#17091f]/94'
                                : 'border-emerald-300/35 bg-gradient-to-br from-[#07141a]/96 via-[#08151f]/96 to-[#102115]/96'
                        }`}
                    >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.18),transparent_34%)] pointer-events-none"></div>
                        <div className={`relative h-full flex flex-col ${popTriviaQuestionFlashVisible ? 'animate-pulse' : ''}`}>
                            <div className={`px-5 py-4 md:px-7 md:py-6 border-b text-[11px] md:text-xs uppercase tracking-[0.22em] flex items-start justify-between gap-4 ${
                                popTriviaQuestion ? 'border-cyan-300/15' : 'border-emerald-300/15'
                            }`}>
                                <div className="min-w-0">
                                    <div className={`text-[12px] md:text-[14px] ${popTriviaQuestion ? 'text-cyan-200' : 'text-emerald-200'}`}>
                                        {popTriviaQuestion ? 'Pop-up Trivia' : 'Pop-up Trivia Complete'}
                                    </div>
                                    <div className="mt-2 text-[11px] md:text-[13px] text-zinc-300 tracking-[0.18em]">
                                        {popTriviaQuestion
                                            ? `Question ${Number(popTriviaState?.index || 0) + 1} of ${popTriviaState?.total || 0}`
                                            : `${popTriviaState?.total || 0} questions finished`}
                                    </div>
                                </div>
                                <div className="shrink-0 text-right">
                                    {popTriviaQuestion ? (
                                        <div className={`rounded-[1.5rem] border px-4 py-3 md:px-5 md:py-4 ${popTriviaUrgent ? 'border-yellow-300/55 bg-yellow-300/12 shadow-[0_0_28px_rgba(253,224,71,0.2)]' : 'border-cyan-300/30 bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]'} ${popTriviaUrgencyPulseVisible ? 'animate-pulse' : ''}`}>
                                            <div className={`text-5xl md:text-7xl 2xl:text-[5.8rem] font-black font-mono leading-none ${popTriviaUrgent ? 'text-yellow-200 drop-shadow-[0_0_18px_rgba(253,224,71,0.55)]' : 'text-white'}`}>
                                                {Math.max(0, Number(popTriviaState?.timeLeftSec || 0))}
                                            </div>
                                            <div className={`mt-1 text-[11px] md:text-[13px] tracking-[0.18em] ${popTriviaUrgent ? 'text-yellow-100' : 'text-cyan-100'}`}>
                                                {popTriviaUrgent ? 'Answer now' : 'Seconds left'}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="text-3xl md:text-5xl font-black text-emerald-100 leading-none">
                                                Done
                                            </div>
                                            <div className="mt-1 text-[10px] md:text-[11px] tracking-[0.18em] text-emerald-100">
                                                Back to karaoke
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            {popTriviaQuestion ? (
                                <>
                                    <div className="px-5 md:px-7 pt-3 md:pt-4">
                                        <div className="h-2.5 md:h-3 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${popTriviaUrgent ? 'bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-500' : 'bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400'}`}
                                                style={{ width: `${popTriviaProgressPct}%` }}
                                            ></div>
                                        </div>
                                        {popTriviaQuestionFlashVisible && (
                                            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-300/12 px-3 py-1 text-[11px] md:text-[13px] font-black uppercase tracking-[0.2em] text-cyan-100">
                                                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]"></span>
                                                New Question
                                            </div>
                                        )}
                                    </div>
                                    <div className="px-5 py-5 md:px-7 md:py-6 flex min-h-0 flex-1 flex-col">
                                        <div className="text-[2rem] md:text-[3.25rem] 2xl:text-[4rem] font-black text-white leading-[0.98]">
                                            {popTriviaQuestion.q}
                                        </div>
                                        <div className="mt-3 flex items-center justify-between gap-4 text-[11px] md:text-[13px] uppercase tracking-[0.18em] text-cyan-100/90">
                                            <span>{popTriviaCorrectPoints > 0 ? `Correct answers earn +${popTriviaCorrectPoints} pts` : 'Correct answers earn a TV shoutout'}</span>
                                            <span>{popTriviaTotalVotes} answers locked</span>
                                        </div>
                                        <div className="mt-5 grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1">
                                            {popTriviaQuestion.options?.map((option, idx) => {
                                                const optionVotes = popTriviaVoteCounts[idx] || 0;
                                                const optionPct = popTriviaTotalVotes > 0
                                                    ? Math.max(6, Math.round((optionVotes / popTriviaTotalVotes) * 100))
                                                    : 0;
                                                return (
                                                    <div
                                                        key={`${popTriviaQuestion.id}_${idx}`}
                                                        className="relative rounded-[1.6rem] border border-white/12 bg-black/38 px-5 py-5 md:px-6 md:py-6 overflow-hidden"
                                                    >
                                                        <div
                                                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-300/22 via-cyan-200/12 to-transparent transition-all duration-500"
                                                            style={{ width: `${optionPct}%` }}
                                                        ></div>
                                                        <div className="relative flex items-start justify-between gap-4">
                                                            <div className="flex items-start gap-3 min-w-0">
                                                                <span className="shrink-0 text-cyan-300 font-black text-[1.8rem] md:text-[2.6rem] tracking-[0.16em] leading-none">
                                                                    {String.fromCharCode(65 + idx)}
                                                                </span>
                                                                <span className="min-w-0 flex-1 text-[1.55rem] md:text-[2.1rem] 2xl:text-[2.45rem] font-bold leading-[1.04] text-white">
                                                                    {option}
                                                                </span>
                                                            </div>
                                                            <div className="shrink-0 text-right">
                                                                <div className="text-[1.8rem] md:text-[2.6rem] font-black font-mono text-white leading-none">
                                                                    {optionVotes}
                                                                </div>
                                                                <div className="mt-1 text-[11px] md:text-[13px] uppercase tracking-[0.14em] text-zinc-300">
                                                                    {popTriviaTotalVotes > 0 ? `${optionPct}%` : 'No votes'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-4 flex items-center justify-between gap-4 text-[11px] md:text-sm uppercase tracking-[0.18em] text-zinc-200">
                                            <span>{popTriviaCorrectPoints > 0 ? `Correct responders bank +${popTriviaCorrectPoints} pts` : 'Correct responders get the spotlight next'}</span>
                                            <span className={popTriviaUrgent ? 'text-yellow-200' : 'text-cyan-100'}>
                                                {popTriviaUrgent ? 'Question closing' : 'Vote in Party app'}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="px-5 py-6 md:px-7 md:py-8 flex min-h-0 flex-1 flex-col">
                                    <div className="text-[12px] md:text-[14px] uppercase tracking-[0.22em] text-emerald-100/90">Correct answer</div>
                                    <div className="mt-3 rounded-[1.8rem] border border-emerald-300/30 bg-emerald-400/12 px-5 py-5 md:px-6 md:py-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-[11px] md:text-[13px] uppercase tracking-[0.16em] text-emerald-100/75">Winning choice</div>
                                                <div className="mt-2 text-[2rem] md:text-[3rem] 2xl:text-[3.5rem] font-black text-white leading-[0.96]">
                                                    {popTriviaRevealCorrectOption || 'Answer reveal unavailable'}
                                                </div>
                                            </div>
                                            <div className="shrink-0 rounded-full border border-emerald-200/40 bg-emerald-300/18 px-4 py-2 text-[11px] md:text-[13px] uppercase tracking-[0.18em] text-emerald-50">
                                                {popTriviaCorrectPoints > 0 ? `+${popTriviaCorrectPoints} pts each` : 'TV shoutout'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 rounded-[1.6rem] border border-fuchsia-300/24 bg-[linear-gradient(135deg,rgba(168,85,247,0.16),rgba(34,211,238,0.08))] px-5 py-4 md:px-6 md:py-5 shadow-[0_0_28px_rgba(168,85,247,0.14)]">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-[11px] md:text-[13px] uppercase tracking-[0.18em] text-fuchsia-100/80">Round resolution</div>
                                                <div className="mt-2 text-[1.45rem] md:text-[2.25rem] font-black text-white leading-[0.96]">
                                                    {popTriviaRevealResolutionHeadline}
                                                </div>
                                                <div className="mt-2 text-[11px] md:text-[13px] text-zinc-200 leading-relaxed">
                                                    {popTriviaRevealResolutionDetail}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <div className="rounded-full border border-fuchsia-200/30 bg-black/24 px-4 py-2 text-[11px] md:text-[13px] uppercase tracking-[0.18em] text-fuchsia-50">
                                                    {popTriviaCorrectPoints > 0
                                                        ? `+${popTriviaCorrectPoints} pts each`
                                                        : 'Crowd shoutout'}
                                                </div>
                                                {popTriviaRevealTotalPointsAwarded > 0 ? (
                                                    <div className="mt-2 text-[1.15rem] md:text-[1.65rem] font-black text-white leading-none">
                                                        {`${popTriviaRevealTotalPointsAwarded} pts total`}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-5 flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-[11px] md:text-[13px] uppercase tracking-[0.18em] text-emerald-100/75">Correct responders</div>
                                            <div className="mt-1 text-[1.3rem] md:text-[2rem] font-black text-white leading-none">
                                                {popTriviaRevealCorrectResponders.length > 0
                                                    ? `${popTriviaRevealCorrectResponders.length} nailed it`
                                                    : 'No correct answers yet'}
                                            </div>
                                            {popTriviaCorrectPoints > 0 && popTriviaRevealAwardableResponders.length > 0 ? (
                                                <div className="mt-2 text-[11px] md:text-[13px] uppercase tracking-[0.16em] text-emerald-100/75">
                                                    {`${popTriviaRevealAwardableResponders.length} credited at +${popTriviaCorrectPoints} pts`}
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[11px] md:text-[13px] uppercase tracking-[0.18em] text-zinc-300">Answers locked</div>
                                            <div className="mt-1 text-[1.35rem] md:text-[2rem] font-black text-white leading-none">{popTriviaRevealAnswerCount}</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                                        {popTriviaRevealCorrectResponders.length > 0 ? (
                                            popTriviaRevealCorrectResponders.map((entry) => (
                                                <div
                                                    key={entry.id}
                                                    className="rounded-[1.4rem] border border-white/12 bg-black/28 px-4 py-4 md:px-5 md:py-5"
                                                >
                                                    <div className="text-[1.8rem] md:text-[2.4rem] leading-none">{entry.avatar}</div>
                                                    <div className="mt-2 text-[1.05rem] md:text-[1.45rem] font-black text-white leading-tight break-words">
                                                        {entry.name}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-full rounded-[1.5rem] border border-white/10 bg-black/22 px-5 py-5 md:px-6 md:py-6 text-[1.1rem] md:text-[1.4rem] font-semibold text-emerald-100/90">
                                                Trivia complete. Karaoke keeps moving.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className={`relative z-10 h-full grid grid-cols-1 lg:grid-cols-12 ${gridSpacingClass} ${isCinema ? 'pt-0 pb-0' : `${effectiveGridTopPaddingClass} ${gridBottomPaddingClass}`}`}>
                {/* STAGE AREA */}
                <div className={`${stageAreaSpanClass} flex flex-col transition-all duration-500`}>
                    <div className={`flex-1 ${isMinimal || isCinema ? 'bg-black' : 'bg-black/30 backdrop-blur-md border border-white/10'} rounded-2xl md:rounded-3xl relative shadow-2xl overflow-hidden ${effectiveStageMinHeightClass}`}>
                        <div className="absolute inset-0 pointer-events-none tv-light-sweep"></div>
                          {current && showScoring && (
                              <div className="absolute top-8 right-3 md:top-10 md:right-4 2xl:top-12 2xl:right-6 z-[80] text-right">
                                  <AnimatedPoints value={Math.max(0, currentPerformancePoints)} />
                                  <div className="flex items-center justify-end gap-1 md:gap-2 mt-1 md:mt-2">
                                    <div className="text-sm md:text-base text-zinc-200 tracking-[0.1em] md:tracking-[0.15em]">PERFORMANCE TOTAL</div>
                                    {currentSingerIsVip && (
                                        <div className="px-2 py-0.5 rounded-full text-sm md:text-base font-bold tracking-[0.1em] md:tracking-[0.14em] bg-yellow-400 text-black shadow-[0_0_10px_rgba(253,224,71,0.6)]">
                                            {tvPremiumBadgeLabel}
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
                            <div className="absolute inset-0 z-50 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.24),rgba(0,0,0,0)_32%),radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.18),rgba(0,0,0,0)_22%),linear-gradient(180deg,rgba(3,7,18,0.76),rgba(2,6,23,0.9))]">
                                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_34%,rgba(255,255,255,0.03))]" />
                                <div className="absolute left-1/2 top-1/2 h-[54vw] w-[54vw] max-h-[640px] max-w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/18 bg-cyan-300/8 blur-3xl" />
                                <div className="absolute left-1/2 top-1/2 h-[34vw] w-[34vw] max-h-[420px] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 blur-2xl" />
                                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                                    <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-2 text-[11px] md:text-sm font-black uppercase tracking-[0.3em] text-cyan-100 shadow-[0_0_32px_rgba(34,211,238,0.16)]">
                                        <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.95)]" />
                                        Crowd Cam
                                    </div>
                                    <div className="relative mt-7">
                                        <div className="absolute inset-[-24px] rounded-full border border-white/10 selfie-cam-pulse-ring" />
                                        <div className="absolute inset-[-56px] rounded-full border border-cyan-300/15 selfie-cam-pulse-ring-delayed" />
                                        <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/12 bg-black/35 shadow-[0_0_40px_rgba(236,72,153,0.14)] md:h-36 md:w-36 2xl:h-44 2xl:w-44">
                                            <i className="fa-solid fa-camera text-5xl md:text-6xl 2xl:text-8xl text-white" />
                                        </div>
                                    </div>
                                    <h1 className="mt-8 text-[clamp(2.8rem,6vw,5.8rem)] font-bebas leading-[0.9] text-white">
                                        Selfie Cam Is Live
                                    </h1>
                                    <div className="mt-3 max-w-[920px] text-lg md:text-2xl text-cyan-100/90">
                                        Snap from your phone and watch the best crowd shots hit the big screen.
                                    </div>
                                    <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/28 bg-fuchsia-400/12 px-5 py-2 text-[11px] md:text-sm font-black uppercase tracking-[0.24em] text-fuchsia-100">
                                        <i className="fa-solid fa-sparkles" />
                                        Fresh photos drop live
                                    </div>
                                    {crowdSelfieWall.length > 0 && (
                                        <div data-tv-crowd-selfie-wall className="mt-8 w-full max-w-[980px]">
                                            <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Approved Crowd Wall</div>
                                            <div className="mt-3 flex flex-wrap items-center justify-center gap-4 md:gap-5">
                                                {crowdSelfieWall.slice(0, 6).map((entry) => (
                                                    <div key={entry.id} className="flex w-[108px] flex-col items-center text-center md:w-[132px]">
                                                        <div className="rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),rgba(255,255,255,0.02)_42%,rgba(0,0,0,0.18))] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.34)] md:p-2">
                                                            <div className="rounded-full bg-[linear-gradient(135deg,rgba(236,72,153,0.72),rgba(34,211,238,0.72))] p-[3px] md:p-1">
                                                                <div className="h-24 w-24 overflow-hidden rounded-full border border-white/12 bg-black/45 md:h-28 md:w-28">
                                                                    <img
                                                                        src={entry.url}
                                                                        alt={entry.userName || 'Crowd selfie'}
                                                                        className="h-full w-full object-cover"
                                                                        style={{ objectPosition: '50% 28%' }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 inline-flex max-w-full items-center justify-center rounded-full border border-white/12 bg-black/45 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white md:text-xs">
                                                            <span className="truncate">{entry.userName || 'Guest'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                                <Stage
                                    room={{
                                        ...(room || {}),
                                        roomCode,
                                        joinUrlLabel: marketingJoinBase
                                    }}
                                    current={current}
                                    started={started}
                                    combo={combo}
                                    minimalUI={isMinimal || lobbyVolleySceneActive || guitarTakeoverMode}
                                    fitToWindow
                                    showVideo
                                    runOfShowHud={runOfShowHud}
                                    onPlaybackEvent={reportPerformanceSessionPlayback}
                                />
                            </>
                        )}
                    </div>
                </div>
                
                {/* SIDEBAR: Hidden in Cinema Mode */}
                {isCinema && !guitarTakeoverMode ? renderJoinOverlayCard({ floating: true }) : null}

                {!isCinema && !guitarTakeoverMode && (
                    <div className={`${sidebarAreaSpanClass} flex flex-col ${sidebarGapClass} h-full min-h-0 overflow-hidden transition-all duration-500`}>
                        {renderJoinOverlayCard()}
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
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-black tracking-[0.08em] bg-yellow-400 text-black">{tvPremiumBadgeLabel}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                         ) : (
                             <div className="flex-1 min-h-0 bg-zinc-800/80 backdrop-blur rounded-2xl md:rounded-3xl p-3 md:p-5 border border-white/10 flex flex-col overflow-hidden">
                                {lobbyVolleySceneActive ? (
                                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
                                        <div className="flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                                            <h3 className="text-xl md:text-2xl 2xl:text-3xl font-bebas text-cyan-300">VOLLEY ORB</h3>
                                            {autoCrowdMomentActive && autoCrowdMomentType === 'volley' && (
                                                <span className="px-2 py-1 rounded-full border border-cyan-300/40 bg-cyan-500/15 text-[10px] uppercase tracking-[0.16em] text-cyan-100">
                                                    Auto Party
                                                </span>
                                            )}
                                        </div>
                                        <div className="rounded-[26px] border border-cyan-300/40 bg-black/40 px-4 py-4 mb-4 shadow-[0_0_30px_rgba(34,211,238,0.14)]">
                                            {autoCrowdMomentActive && autoCrowdMomentType === 'volley' && (
                                                <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200 mb-1">{autoCrowdMomentTitle}</div>
                                            )}
                                            <div className="text-[12px] md:text-[14px] uppercase tracking-[0.24em] text-cyan-100/90 mb-1.5">Now</div>
                                            <div className="text-lg md:text-2xl 2xl:text-3xl font-black text-white leading-tight">{lobbyInstructionHeadline}</div>
                                            <div className="mt-1.5 text-sm md:text-lg text-cyan-100/90 leading-snug">{lobbyInstructionSecondary}</div>
                                            {autoCrowdMomentActive && autoCrowdMomentType === 'volley' && (
                                                <div className="mt-2 text-[11px] md:text-xs text-cyan-100/85">{autoCrowdMomentDetail}</div>
                                            )}
                                        </div>
                                        <div className="rounded-[26px] border border-fuchsia-300/40 bg-gradient-to-r from-cyan-500/16 via-indigo-500/16 to-fuchsia-500/18 px-4 py-4 mb-4 shadow-[0_0_34px_rgba(236,72,153,0.12)]">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-[12px] md:text-[14px] uppercase tracking-[0.22em] text-cyan-100">Teamwork</div>
                                                <div className="px-3 py-1.5 rounded-full border border-white/25 bg-black/35 text-[11px] md:text-xs uppercase tracking-[0.17em] text-white">
                                                    Lvl {lobbyLevelMeta.level}{lobbyCurrentTierMeta?.name ? `: ${lobbyCurrentTierMeta.name}` : ''}
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-end justify-between gap-3">
                                                <div className="text-[2.5rem] md:text-[4rem] leading-none font-bebas text-white">x{Number(lobbyTeamworkMultiplier || 1).toFixed(1)}</div>
                                                <div className="text-sm md:text-lg text-cyan-100 text-right">
                                                    {lobbyHasActiveVolley ? `${lobbyAirborneSec}s airborne` : (lobbyVolleyExpired ? 'ready to relaunch' : 'waiting for launch')}
                                                </div>
                                            </div>
                                            <div className="mt-3 h-3 md:h-4 rounded-full overflow-hidden border border-white/20 bg-black/45">
                                                <div
                                                    className="h-full bg-gradient-to-r from-red-300 via-amber-300 to-emerald-300 transition-all duration-200"
                                                    style={{ width: `${lobbyStreakDecayPct}%` }}
                                                />
                                            </div>
                                            <div className="mt-1.5 flex items-center justify-between text-[11px] md:text-[13px] uppercase tracking-[0.16em] text-cyan-100/90">
                                                <span>{lobbyObjectiveStreakLabel}</span>
                                                <span>{lobbyActiveParticipants.length}/{lobbyLevelMeta.targetActivePlayers}+ active</span>
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-white/20 bg-black/35 px-3 py-3">
                                            <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-200">
                                                <span>Room {roomUsers.length}</span>
                                                <span>{lobbyRelayObjective.active ? `Relay ${lobbyRelayRemainingSec}s` : 'Relay idle'}</span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em]">
                                                {!!room?.lobbyPlaygroundVisualOnly && (
                                                    <span className="px-2 py-1 rounded-full border border-fuchsia-300/35 bg-fuchsia-500/12 text-fuchsia-100">
                                                        Visual only
                                                    </span>
                                                )}
                                                {!!room?.lobbyPlaygroundPaused && (
                                                    <span className="px-2 py-1 rounded-full border border-amber-300/40 bg-amber-500/12 text-amber-100">
                                                        Paused
                                                    </span>
                                                )}
                                                {lobbyVolleyState?.authFailureLocked && (
                                                    <span className="px-2 py-1 rounded-full border border-amber-300/40 bg-amber-500/12 text-amber-100">
                                                        Rewards locked
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                                            <h3 className={`text-xl md:text-2xl 2xl:text-3xl font-bebas ${sidebarFeatureView === 'queue' ? 'text-cyan-400' : 'text-green-400'}`}>
                                                {sidebarFeatureView === 'queue' ? 'UP NEXT' : socialSidebarTitle}
                                            </h3>
                                            {hasSocialSidebarPane && (
                                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-zinc-300">
                                                    <span className={`h-2.5 w-2.5 rounded-full ${sidebarFeatureView === 'queue' ? 'bg-cyan-300' : 'bg-white/20'}`}></span>
                                                    <span className={`h-2.5 w-2.5 rounded-full ${sidebarFeatureView === 'social' ? 'bg-green-300' : 'bg-white/20'}`}></span>
                                                </div>
                                            )}
                                        </div>
                                        {sidebarFeatureView === 'queue' ? (
                                            <>
                                                {!isDistanceConstrained && (
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        {queueRules.map(rule => (
                                                            <div key={rule.label} className="flex items-center gap-2 bg-black/45 border border-white/10 px-3 py-1.5 rounded-full text-sm md:text-base font-semibold uppercase tracking-[0.12em] text-zinc-100">
                                                                <i className={`fa-solid ${rule.icon} text-cyan-300`}></i>
                                                                <span>{rule.shortLabel || rule.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="mb-3 text-base md:text-lg uppercase tracking-[0.08em] md:tracking-[0.12em] text-zinc-100 font-semibold">
                                                    Queue: <span className="text-white font-bold">{allQueue.length}</span> songs
                                                    {' '}
                                                    | Est wait <span className="text-white font-bold">{formatWaitTime(queueWaitSec)}</span>
                                                </div>
                                                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                                                    {nextUp.length === 0 && (
                                                        <div className="bg-black/35 border border-white/10 rounded-2xl px-4 py-4 text-zinc-100 text-lg md:text-2xl font-bebas tracking-wide">
                                                            No singers yet. Scan the join code to get the queue moving.
                                                        </div>
                                                    )}
                                                    {nextUp.map((s, i) => {
                                                        const vip = isVipSong(s);
                                                        return (
                                                            <div key={s.id} className="bg-zinc-700/45 p-3 md:p-4 rounded-2xl flex items-center gap-3 md:gap-4 border-l-4 border-pink-500">
                                                                <div className="font-bebas text-3xl md:text-4xl text-zinc-400 leading-none">#{i+1}</div>
                                                                <div className="min-w-0">
                                                                    <div className="font-bold truncate text-lg md:text-2xl leading-tight text-white">{s.songTitle}</div>
                                                                    <div className="mt-1 text-base md:text-xl text-zinc-300 truncate flex items-center gap-2">
                                                                        <span>{s.singerName}</span>
                                                                        {vip && (
                                                                            <span className="px-2 py-0.5 rounded-full text-xs font-black tracking-[0.08em] bg-yellow-400 text-black">{tvPremiumBadgeLabel}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        ) : (
                                            <div ref={chatSidebarScrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                                                {showChatFeed ? (
                                                    <>
                                                        {chatMessages.length === 0 && (
                                                            <div className="rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-zinc-300 text-lg md:text-xl leading-snug">
                                                                {room?.chatEnabled === false
                                                                    ? 'Chat is paused by the host.'
                                                                    : room?.chatAudienceMode === 'vip'
                                                                        ? tvChatLockedLabel
                                                                        : 'No chat yet.'}
                                                            </div>
                                                        )}
                                                        {groupedChatMessages.map((group) => (
                                                            <div key={group.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-zinc-200">
                                                                <div className="flex gap-3 items-start">
                                                                    <span className="text-xl">{group.avatar || EMOJI.sparkle}</span>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="truncate text-lg md:text-xl">
                                                                            <span className="font-bold text-white">{group.user || 'Guest'}</span>
                                                                            {group.isVip && (
                                                                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-black tracking-widest bg-yellow-400 text-black">{tvPremiumBadgeLabel}</span>
                                                                            )}
                                                                            {group.isHost && (
                                                                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-black tracking-widest bg-cyan-500 text-black">HOST</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="mt-1.5 space-y-1 text-base md:text-lg leading-snug">
                                                                            {group.messages.map((message, idx) => (
                                                                                <div key={message.id || `${group.id}-${idx}`} className="break-words">{message.text}</div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <>
                                                        {activities.length === 0 && (
                                                            <div className="rounded-2xl border border-white/10 bg-black/28 px-4 py-4 text-zinc-200 text-lg md:text-2xl font-bebas tracking-wide">
                                                                Activity starts when the first singer joins.
                                                            </div>
                                                        )}
                                                        {activities.map((a, i) => (
                                                            <div key={i} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 flex gap-3 items-start text-zinc-200 text-base md:text-xl leading-snug">
                                                                <span className="text-xl md:text-2xl">{a.icon}</span>
                                                                <span className="min-w-0 break-words"><span className="font-bold text-white">{a.user}</span> {a.text}</span>
                                                            </div>
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                             </div>
                         )}
                    </div>
                )}
            </div>

            {room?.activeMode === 'selfie_challenge' && (
                <div data-feature-id="tv-selfie-challenge" className="absolute inset-0 z-[120] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.22),rgba(0,0,0,0)_34%),radial-gradient(circle_at_20%_0%,rgba(236,72,153,0.24),rgba(0,0,0,0)_30%),linear-gradient(180deg,rgba(2,6,23,0.82),rgba(1,3,10,0.94))] backdrop-blur-sm flex flex-col p-4 md:p-6 2xl:p-10">
                    <div className="absolute inset-0 pointer-events-none opacity-75" aria-hidden="true">
                        <div className="selfie-grid-sheen absolute inset-x-0 top-0 h-[45%]" />
                        <div className="absolute left-[8%] top-[16%] h-56 w-56 rounded-full bg-fuchsia-500/18 blur-3xl" />
                        <div className="absolute right-[10%] top-[8%] h-64 w-64 rounded-full bg-cyan-400/16 blur-3xl" />
                        <div className="absolute left-[30%] bottom-[10%] h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
                    </div>
                    <div className="relative z-10 mb-4 md:mb-6">
                        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 text-center">
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-cyan-100">
                                <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.85)]" />
                                Selfie Challenge
                            </div>
                            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] md:text-xs font-black uppercase tracking-[0.26em] text-zinc-100">
                                {visibleSelfieSubmissions.length} live on screen
                            </div>
                            {room?.selfieChallenge?.status && (
                                <div className="inline-flex items-center rounded-full border border-fuchsia-300/20 bg-fuchsia-400/10 px-4 py-2 text-[10px] md:text-xs font-black uppercase tracking-[0.26em] text-fuchsia-100">
                                    {room.selfieChallenge.status}
                                </div>
                            )}
                        </div>
                        <div className="mt-3 text-center text-2xl md:text-4xl 2xl:text-5xl font-bebas text-white">
                            {room?.selfieChallenge?.prompt || 'Get ready'}
                        </div>
                        {selfieLeadingSubmission && room?.selfieChallenge?.status === 'voting' && (
                            <div className="mt-3 text-center text-sm md:text-base text-cyan-200">
                                Leading right now: <span className="font-black text-white">{selfieLeadingSubmission.userName || 'Guest'}</span> with <span className="font-black text-fuchsia-200">{selfieVoteCounts[selfieLeadingSubmission.uid] || 0}</span> votes
                            </div>
                        )}
                    </div>
                    <div className="relative z-10 grid flex-1 min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.95fr)]">
                        <div className="grid auto-rows-[minmax(160px,1fr)] grid-cols-1 gap-3 md:grid-cols-2 md:gap-5">
                            {visibleSelfieSubmissions.map((submission, idx) => {
                                const voteCount = selfieVoteCounts[submission.uid] || 0;
                                const isLeader = selfieLeadingSubmission?.id === submission.id && room?.selfieChallenge?.status === 'voting';
                                const isFresh = selfieRecentSubmissionIds.has(submission.id);
                                return (
                                    <div
                                        key={submission.id}
                                        className={`selfie-wall-card group relative overflow-hidden rounded-[1.8rem] border bg-zinc-950/72 shadow-[0_18px_60px_rgba(0,0,0,0.35)] ${idx === 0 ? 'md:col-span-2 md:min-h-[320px]' : ''} ${isLeader ? 'border-fuchsia-300/60' : 'border-white/10'} ${isFresh ? 'selfie-wall-card-fresh' : ''}`}
                                        style={{ transform: idx === 0 ? 'rotate(-1deg)' : idx % 2 === 0 ? 'rotate(-0.65deg)' : 'rotate(0.85deg)' }}
                                    >
                                        <img
                                            src={submission.url}
                                            alt={submission.userName || 'Guest selfie'}
                                            className={`h-full w-full object-cover transition-transform duration-700 ${idx === 0 ? 'min-h-[320px]' : 'min-h-[190px]'} ${isFresh ? 'scale-[1.04]' : 'group-hover:scale-[1.03]'}`}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/18 to-transparent" />
                                        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                                            {isFresh && (
                                                <div className="rounded-full border border-cyan-300/40 bg-cyan-300/12 px-3 py-1 text-[10px] md:text-xs font-black uppercase tracking-[0.24em] text-cyan-100">
                                                    Just dropped
                                                </div>
                                            )}
                                            {isLeader && (
                                                <div className="rounded-full border border-fuchsia-300/45 bg-fuchsia-400/15 px-3 py-1 text-[10px] md:text-xs font-black uppercase tracking-[0.24em] text-fuchsia-100">
                                                    Leading
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-xs md:text-sm font-black text-cyan-200">
                                            {voteCount} votes
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                                            <div className="flex items-end justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 md:gap-3">
                                                        <span className="text-2xl md:text-3xl">{submission.avatar || EMOJI.camera}</span>
                                                        <div className="min-w-0 text-lg md:text-2xl font-black text-white truncate">
                                                            {submission.userName || 'Guest'}
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 h-2.5 w-28 md:w-36 overflow-hidden rounded-full bg-white/10">
                                                        <div className={`h-full rounded-full ${isLeader ? 'bg-gradient-to-r from-fuchsia-300 to-amber-200' : 'bg-gradient-to-r from-cyan-300 to-fuchsia-300'}`} style={{ width: `${Math.min(100, (voteCount / maxSelfieVotes) * 100)}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {visibleSelfieSubmissions.length === 0 && (
                                <div className="md:col-span-2 flex items-center justify-center rounded-[2rem] border border-white/10 bg-black/30 text-zinc-400 text-base md:text-xl">
                                    Waiting for selfies...
                                </div>
                            )}
                        </div>
                        <div className="grid grid-rows-[auto_minmax(0,1fr)] gap-4">
                            <div className="rounded-[1.8rem] border border-white/10 bg-black/35 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Big screen energy</div>
                                <div className="mt-2 text-xl md:text-2xl font-black text-white">
                                    New arrivals punch in live, then the room votes the wall.
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2 md:gap-3">
                                    <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-3 text-center">
                                        <div className="text-[10px] md:text-xs uppercase tracking-[0.24em] text-cyan-100">Submitted</div>
                                        <div className="mt-1 text-xl md:text-3xl font-black text-white">{visibleSelfieSubmissions.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-400/10 px-3 py-3 text-center">
                                        <div className="text-[10px] md:text-xs uppercase tracking-[0.24em] text-fuchsia-100">Top votes</div>
                                        <div className="mt-1 text-xl md:text-3xl font-black text-white">{selfieLeadingSubmission ? (selfieVoteCounts[selfieLeadingSubmission.uid] || 0) : 0}</div>
                                    </div>
                                    <div className="rounded-2xl border border-amber-200/15 bg-amber-300/10 px-3 py-3 text-center">
                                        <div className="text-[10px] md:text-xs uppercase tracking-[0.24em] text-amber-100">Fresh</div>
                                        <div className="mt-1 text-xl md:text-3xl font-black text-white">{selfieRecentSubmissionIds.size}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-[1.8rem] border border-white/10 bg-black/28 p-4 md:p-5">
                                <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Arrival queue</div>
                                <div className="mt-3 grid gap-3">
                                    {visibleSelfieSubmissions.slice(0, 4).map((submission, idx) => (
                                        <div key={`rail-${submission.id}`} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 p-2.5">
                                            <img src={submission.url} alt={submission.userName || 'Guest selfie'} className="h-14 w-14 rounded-2xl object-cover" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{submission.avatar || EMOJI.camera}</span>
                                                    <div className="truncate text-sm md:text-base font-black text-white">{submission.userName || 'Guest'}</div>
                                                </div>
                                                <div className="mt-1 text-[10px] md:text-xs uppercase tracking-[0.2em] text-zinc-400">
                                                    {idx === 0 ? 'Latest on the wall' : selfieRecentSubmissionIds.has(submission.id) ? 'Fresh arrival' : 'In the running'}
                                                </div>
                                            </div>
                                            <div className="text-sm md:text-base font-black text-cyan-200">{selfieVoteCounts[submission.uid] || 0}</div>
                                        </div>
                                    ))}
                                    {visibleSelfieSubmissions.length === 0 && (
                                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-8 text-center text-zinc-500">
                                            New selfies will slam into the wall here.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    {selfieArrivalSpotlight && (
                        <div className="absolute inset-0 z-[130] flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-none">
                            <div className="selfie-arrival-spotlight relative w-[min(92vw,920px)]">
                                <div className="selfie-arrival-radiance absolute inset-[-6%] rounded-[2.8rem] bg-[radial-gradient(circle,rgba(34,211,238,0.34),rgba(236,72,153,0.24)_38%,rgba(0,0,0,0)_72%)] blur-2xl" />
                                <div className="selfie-arrival-ring absolute inset-[-5%] rounded-[3rem] border border-cyan-200/30" />
                                <div className="selfie-arrival-ring selfie-arrival-ring-delayed absolute inset-[-10%] rounded-[3.4rem] border border-fuchsia-200/22" />
                                <div className="selfie-arrival-spark absolute left-[6%] top-[12%] text-4xl md:text-6xl">{emoji(0x2728)}</div>
                                <div className="selfie-arrival-spark selfie-arrival-spark-delayed absolute right-[7%] top-[18%] text-3xl md:text-5xl">{emoji(0x1F389)}</div>
                                <div className="selfie-arrival-spark absolute right-[12%] bottom-[18%] text-4xl md:text-5xl">{emoji(0x1F4F8)}</div>
                                <div className="relative mx-auto w-fit max-w-full -rotate-2 rounded-[2rem] border border-white/15 bg-[#fff7ef] p-3 md:p-4 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
                                    <img src={selfieArrivalSpotlight.url} alt={selfieArrivalSpotlight.userName || 'New selfie'} className="max-h-[62vh] w-auto max-w-[82vw] rounded-[1.5rem] border border-black/8 object-cover" />
                                    <div className="absolute right-4 top-4 rounded-full bg-black/72 px-3 py-1.5 text-[10px] md:text-xs font-black uppercase tracking-[0.28em] text-cyan-200">
                                        New on screen
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-8 text-center">
                                        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/88 px-4 py-2 text-xs md:text-sm font-black uppercase tracking-[0.24em] text-fuchsia-700">
                                            <span className="text-xl md:text-2xl">{selfieArrivalSpotlight.avatar || EMOJI.camera}</span>
                                            Fresh crowd shot
                                        </div>
                                        <div className="mt-3 text-2xl md:text-5xl font-black text-zinc-950">{selfieArrivalSpotlight.userName || 'Guest'}</div>
                                        <div className="mt-1 text-sm md:text-lg font-semibold text-zinc-600">
                                            {selfieArrivalSpotlight.votes ? `${selfieArrivalSpotlight.votes} early votes` : 'Just landed on the wall'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
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
                <div className={`marquee-shell absolute bottom-0 left-0 w-full ${marqueeHeightClass} bg-pink-600 overflow-hidden flex items-center z-40 ${isTinyHostPreviewMode ? 'border-t-2' : 'border-t-4'} border-white shadow-[0_-10px_30px_rgba(219,39,119,0.5)] ${showMarquee ? 'marquee-on' : 'marquee-off'}`}>
                    <div className={`whitespace-nowrap animate-marquee flex ${marqueeGapClass}`}>
                        {marqueeText ? (
                            <span className="font-bebas text-white flex items-center gap-3 leading-none" style={{ fontSize: marqueeTextSize }}>
                                {marqueeText}
                            </span>
                        ) : (
                            messages.map((m, i) => (
                                <span key={i} className="font-bebas text-white flex items-center gap-3 leading-none" style={{ fontSize: marqueeTextSize }}>
                                    {!isTinyHostPreviewMode && <span className="bg-black/20 px-3 rounded" style={{ fontSize: marqueeUserSize }}>{m.user}:</span>} {m.text}
                                </span>
                            ))
                        )}
                    </div>
                </div>
            )}
            
            {/* Selfie Overlay */}
            {photoOverlay && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),rgba(0,0,0,0)_28%),radial-gradient(circle_at_78%_20%,rgba(34,211,238,0.16),rgba(0,0,0,0)_24%),rgba(0,0,0,0.82)] animate-in fade-in duration-300">
                    <div className="absolute inset-0 selfie-flash-burst pointer-events-none" />
                    <div className="absolute inset-0 public-moment-burst pointer-events-none" />
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_30%,rgba(255,255,255,0.02))] pointer-events-none" />
                    <div className="relative max-w-[94vw]">
                        <div className="public-moment-radiance absolute inset-[-24px] rounded-[2.6rem] border border-white/12 bg-white/6 blur-xl" />
                        <div className="public-moment-card relative rotate-[-4deg] rounded-[2rem] border border-white/14 bg-[#fff8f1] p-3 md:p-4 pb-16 md:pb-20 shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
                            <div className="public-moment-ribbon absolute -right-3 top-5 rounded-full border border-fuchsia-200/45 bg-fuchsia-400/18 px-4 py-1.5 text-[10px] md:text-xs font-black uppercase tracking-[0.26em] text-white shadow-[0_0_22px_rgba(236,72,153,0.3)]">
                                On the big screen
                            </div>
                            <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/88 px-3 py-1.5 text-[10px] md:text-xs font-black uppercase tracking-[0.24em] text-zinc-700">
                                <span className="h-2 w-2 rounded-full bg-fuchsia-500" />
                                {photoOverlay.mode === 'guitar_victory'
                                    ? 'Guitar Solo MVP'
                                    : photoOverlay.mode === 'strobe_victory'
                                        ? 'Beat Drop MVP'
                                        : 'Crowd Cam Drop'}
                            </div>
                            <img src={photoOverlay.url} className="max-h-[68vh] max-w-[90vw] rounded-[1.4rem] border-2 border-zinc-200 object-cover" />
                            <img src={room?.logoUrl || ASSETS.logo} className="absolute right-3 top-3 w-14 opacity-90 md:right-4 md:top-4 md:w-24" alt={tvLogoAlt} />
                            <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-10 text-center">
                                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/88 px-4 py-2 text-[10px] md:text-xs font-black uppercase tracking-[0.24em] text-zinc-700">
                                    <span className="text-lg">{photoOverlay.mode === 'guitar_victory' ? EMOJI.guitar : photoOverlay.mode === 'strobe_victory' ? EMOJI.bolt : EMOJI.camera}</span>
                                    {photoOverlay.mode === 'guitar_victory'
                                        ? 'Solo Spotlight'
                                        : photoOverlay.mode === 'strobe_victory'
                                            ? 'Beat Spotlight'
                                            : 'Fresh From The Crowd'}
                                </div>
                                <div className="mt-3 text-2xl md:text-4xl font-black text-zinc-950">
                                    {photoOverlay.userName || 'Guest'}
                                </div>
                                <div className="mt-1 text-sm md:text-base font-semibold text-zinc-600">
                                    {photoOverlay.copy || (photoOverlay.mode ? 'Big screen moment captured.' : 'Just landed on the big screen.')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Applause Meter Overlay */}
            {applauseStep !== 'idle' && (
                <div className="absolute inset-0 z-[150] bg-black/95 flex flex-col items-center justify-center animate-in fade-in">
                    <div className="mb-4 md:mb-8 flex flex-col items-center gap-3 text-center px-8">
                        <div className="inline-flex items-center gap-3 rounded-full border border-cyan-400/35 bg-cyan-400/10 px-5 py-2 text-sm md:text-lg font-black uppercase tracking-[0.28em] text-cyan-200 shadow-[0_0_30px_rgba(34,211,238,0.16)]">
                            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]"></span>
                            Crowd Moment
                        </div>
                        <h1 className="text-[clamp(2.75rem,7vw,6.5rem)] font-bebas text-white tracking-[0.12em] md:tracking-[0.2em] leading-none">
                            {applauseStep === 'celebrate' ? 'WARM UP FOR' : applauseStep === 'countdown' ? 'GET READY FOR' : 'CHEER FOR'}
                        </h1>
                        <div className="text-[clamp(3rem,9vw,8rem)] font-black uppercase tracking-tight leading-[0.9] text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 via-white to-cyan-300 drop-shadow-[0_0_28px_rgba(236,72,153,0.22)]">
                            {applausePerformerName}
                        </div>
                        {applauseSongTitle ? (
                            <div className="text-lg md:text-3xl font-semibold text-zinc-300 max-w-[70vw] leading-tight">
                                {applauseSongTitle}
                            </div>
                        ) : null}
                    </div>
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
                                {Math.round(applauseStep === 'result' ? applauseMax : applauseStep === 'celebrate' ? 0 : micVolume)}
                            </div>
                            <div className="text-lg md:text-2xl text-zinc-500 font-bold">dB</div>
                        </div>
                    </div>
                    <div className="mt-4 md:mt-8 text-center px-4">
                        <div className="text-xl md:text-4xl text-cyan-300 font-bebas tracking-[0.1em] md:tracking-widest animate-bounce">
                            {applauseStep === 'celebrate'
                                ? `WARM-UP LIVE ${celebrateCountdown}`
                                : applauseStep === 'countdown'
                                    ? `METER OPENS IN ${countdown}`
                                    : applauseStep === 'measuring'
                                        ? `METER LIVE ${measure}`
                                        : 'PEAK LEVEL REACHED'}
                        </div>
                        {(applauseStep === 'celebrate' || applauseStep === 'countdown') ? (
                            <div className="mt-3 text-sm md:text-xl uppercase tracking-[0.24em] text-zinc-400">
                                {applauseStep === 'celebrate'
                                    ? 'Crowd warm-up before the meter opens'
                                    : 'Noise meter opens now'}
                            </div>
                        ) : null}
                        {applauseStep === 'countdown' ? (
                            <div className="mt-4 flex items-center justify-center gap-2 md:gap-3">
                                {Array.from({ length: applauseCountdownSec }, (_, idx) => {
                                    const active = idx < countdown;
                                    return (
                                        <span
                                            key={`applause-count-${idx}`}
                                            className={`h-2.5 w-8 md:h-3 md:w-12 rounded-full transition-all duration-300 ${
                                                active ? 'bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]' : 'bg-white/10'
                                            }`}
                                        />
                                    );
                                })}
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {showAmbientFx && showLobbyPlaygroundFx && (
            <>
            {/* Lobby Playground Full-Screen FX */}
            <div className={`absolute inset-0 z-[197] pointer-events-none overflow-hidden transition-opacity duration-700 ${lobbyTransitionPhase === 'exiting' ? 'opacity-0' : 'opacity-100'}`}>
                {lobbyPlayScreenFx.map((fx) => {
                    const ageMs = nowMs() - Number(fx.createdAt || 0);
                    if (ageMs < 0) return null;
                    const durationMs = Math.max(1200, Number(fx.durationMs || 2200));
                    const progress = Math.min(1, ageMs / durationMs);
                    if (progress >= 1) return null;
                    const opacity = Math.max(0, 1 - (progress * 0.95));
                    const intensity = Math.max(1, Number(fx.intensity || 1));
                    const baseSeed = Number(fx.seed || 0);
                    const motion = fx.motion || 'wave';
                    const centerX = clampLobby(Number(fx.anchorX || (30 + (seededUnit(baseSeed + 2) * 40))), 8, 92);
                    const centerY = clampLobby(Number(fx.anchorY || (28 + (seededUnit(baseSeed + 4) * 40))), 8, 92);
                    if (motion === 'laser' || motion === 'prism_sweep_link' || motion === 'spark_shower_bridge') {
                        const beamLength = motion === 'spark_shower_bridge' ? 4 : 3;
                        return (
                            <div key={fx.id} className="absolute inset-0" style={{ opacity }}>
                                {Array.from({ length: beamLength + Math.min(3, intensity) }, (_, idx) => {
                                    const localSeed = baseSeed + (idx * 37);
                                    const top = clampLobby(centerY - 10 + (seededUnit(localSeed + 1) * 20), 8, 92);
                                    const tilt = -22 + (seededUnit(localSeed + 5) * 44);
                                    const delayMs = idx * 80;
                                    const beamDur = 820 + Math.round(seededUnit(localSeed + 8) * 300);
                                    return (
                                        <span
                                            key={`${fx.id}-laser-${idx}`}
                                            className="lobby-screen-laser-beam"
                                            style={{
                                                top: `${top}%`,
                                                animationDelay: `${delayMs}ms`,
                                                '--beam-tilt': `${tilt}deg`,
                                                '--beam-dur': `${beamDur}ms`
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        );
                    }
                    if (motion === 'echo' || motion === 'ripple_tunnel' || motion === 'pulse_bloom') {
                        const ringBase = motion === 'pulse_bloom' ? 190 : 220;
                        return (
                            <div key={fx.id} className="absolute inset-0" style={{ opacity }}>
                                <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${centerX}%`, top: `${centerY}%` }}>
                                    {Array.from({ length: 3 + Math.min(2, intensity) }, (_, idx) => (
                                        <span
                                            key={`${fx.id}-echo-${idx}`}
                                            className="lobby-screen-echo-ring"
                                            style={{
                                                animationDelay: `${idx * 190}ms`,
                                                '--echo-size': `${ringBase + (idx * 130)}px`
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    }
                    if (motion === 'confetti' || motion === 'spark_shower_bridge') {
                        const symbols = Array.isArray(fx.symbols) && fx.symbols.length ? fx.symbols : [emoji(0x1F389), emoji(0x1F31F)];
                        return (
                            <div key={fx.id} className="absolute inset-0" style={{ opacity }}>
                                {Array.from({ length: 12 + (intensity * 4) }, (_, idx) => {
                                    const localSeed = baseSeed + (idx * 23);
                                    const left = clampLobby(centerX - 18 + (seededUnit(localSeed + 2) * 36), 3, 97);
                                    const delayMs = Math.round(seededUnit(localSeed + 4) * 320);
                                    const fallMs = 1200 + Math.round(seededUnit(localSeed + 6) * 1000);
                                    const swayPx = -28 + Math.round(seededUnit(localSeed + 9) * 56);
                                    const spinDeg = -80 + Math.round(seededUnit(localSeed + 12) * 160);
                                    return (
                                        <span
                                            key={`${fx.id}-confetti-${idx}`}
                                            className="lobby-screen-confetti-piece"
                                            style={{
                                                left: `${left}%`,
                                                animationDelay: `${delayMs}ms`,
                                                '--fall-dur': `${fallMs}ms`,
                                                '--fall-sway': `${swayPx}px`,
                                                '--fall-rot': `${spinDeg}deg`
                                            }}
                                        >
                                            {symbols[idx % symbols.length]}
                                        </span>
                                    );
                                })}
                            </div>
                        );
                    }
                    return (
                        <div key={fx.id} className="absolute inset-0" style={{ opacity }}>
                            <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${centerX}%`, top: `${centerY}%` }}>
                                {Array.from({ length: 3 + Math.min(3, intensity) }, (_, idx) => (
                                    <span
                                        key={`${fx.id}-wave-${idx}`}
                                        className="lobby-screen-wave-ring"
                                        style={{
                                            animationDelay: `${idx * 170}ms`,
                                            '--wave-size': `${240 + (idx * 115)}px`
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Lobby Playground Objective Visuals + Banners */}
            <div ref={lobbyVolleySceneRef} className={`absolute inset-0 z-[198] pointer-events-none overflow-hidden transition-opacity duration-700 ${lobbyTransitionPhase === 'exiting' ? 'opacity-0' : 'opacity-100'}`}>
                {lobbyVolleyLinks.length > 0 && (
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {lobbyVolleyLinks.map((link) => {
                            const ageMs = nowMs() - Number(link?.createdAt || 0);
                            if (ageMs < 0) return null;
                            const durationMs = Math.max(900, Number(link?.durationMs || LOBBY_LINK_WINDOW_MS));
                            const progress = Math.min(1, ageMs / durationMs);
                            if (progress >= 1) return null;
                            const opacity = Math.max(0, (1 - progress) * 0.95);
                            const fromX = clampLobby(Number(link?.from?.x || 50), 0, 100);
                            const fromY = clampLobby(Number(link?.from?.y || 50) + lobbyGuideVerticalShiftPct, -14, 136);
                            const toX = clampLobby(Number(link?.to?.x || 50), 0, 100);
                            const toY = clampLobby(Number(link?.to?.y || 50) + lobbyGuideVerticalShiftPct, -14, 136);
                            return (
                                <g key={link.id} style={{ opacity }}>
                                    <line
                                        x1={fromX}
                                        y1={fromY}
                                        x2={toX}
                                        y2={toY}
                                        stroke={link.color || 'rgba(125,211,252,0.32)'}
                                        strokeWidth={Math.max(8, Number(link.width || 4) * 1.9)}
                                        strokeLinecap="round"
                                        className="lobby-volley-link-glow"
                                    />
                                    <line
                                        x1={fromX}
                                        y1={fromY}
                                        x2={toX}
                                        y2={toY}
                                        stroke={link.color || 'rgba(125,211,252,0.75)'}
                                        strokeWidth={Math.max(2, Number(link.width || 4))}
                                        strokeLinecap="round"
                                        className="lobby-volley-link"
                                    />
                                    <circle
                                        cx={(fromX + toX) / 2}
                                        cy={(fromY + toY) / 2}
                                        r={Math.max(2.4, Number(link.width || 4) * 0.55)}
                                        fill={link.color || 'rgba(147,197,253,0.9)'}
                                        className="lobby-volley-link-node"
                                    />
                                    <circle
                                        cx={toX}
                                        cy={toY}
                                        r={Math.max(1.6, Number(link.width || 4) * 0.45)}
                                        fill={link.color || 'rgba(147,197,253,0.9)'}
                                        className="lobby-volley-link-node"
                                    />
                                </g>
                            );
                        })}
                    </svg>
                )}
                {(lobbyVolleySceneActive || lobbyTransitionPhase === 'exiting') && (
                    <>
                        {lobbyObjectiveIsTeamPong ? (
                            <>
                                <div className="absolute left-[8%] right-[8%] top-[16%] bottom-[10%] rounded-[26px] border border-cyan-300/35 bg-black/25 shadow-[inset_0_0_30px_rgba(34,211,238,0.12)]">
                                    <div className="absolute inset-y-[8%] left-1/2 -translate-x-1/2 w-[2px] bg-cyan-200/35"></div>
                                    <div className="absolute inset-x-[9%] top-[8%] h-[1px] bg-cyan-100/20"></div>
                                    <div className="absolute inset-x-[9%] bottom-[8%] h-[1px] bg-cyan-100/20"></div>
                                </div>
                                <div
                                    className="absolute left-[9.5%] w-[1.2%] min-w-[10px] h-[22%] min-h-[110px] -translate-y-1/2 rounded-full border border-cyan-200/45 bg-cyan-400/25 shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-[top] duration-180"
                                    style={{ top: `${lobbyPongState.leftPaddleTopPct}%` }}
                                />
                                <div
                                    className="absolute right-[9.5%] w-[1.2%] min-w-[10px] h-[22%] min-h-[110px] -translate-y-1/2 rounded-full border border-fuchsia-200/45 bg-fuchsia-400/25 shadow-[0_0_20px_rgba(217,70,239,0.35)] transition-[top] duration-180"
                                    style={{ top: `${lobbyPongState.rightPaddleTopPct}%` }}
                                />
                                <div
                                    className="absolute -translate-x-1/2 -translate-y-1/2 transition-[top,left] duration-160 ease-out"
                                    style={{ top: `${lobbyPongState.ballTopPct}%`, left: `${lobbyPongState.ballLeftPct}%` }}
                                >
                                    <div className="w-[118px] h-[118px] md:w-[138px] md:h-[138px] rounded-full border border-cyan-200/55 bg-gradient-to-br from-teal-300/45 via-cyan-300/42 to-pink-400/46 shadow-[0_0_40px_rgba(45,212,191,0.54),0_0_34px_rgba(236,72,153,0.46)] flex flex-col items-center justify-center">
                                        <div className="text-[12px] md:text-[13px] uppercase tracking-[0.2em] text-cyan-100">{lobbyObjectiveLabel}</div>
                                        <div className="text-4xl md:text-5xl font-bebas text-white leading-none">x{Number(lobbyTeamworkMultiplier || 1).toFixed(1)}</div>
                                        <div className="text-[11px] md:text-xs uppercase tracking-[0.14em] text-white/75">{lobbyObjectiveStreakLabel}</div>
                                    </div>
                                </div>
                                <div className="absolute top-[12%] left-[7.5%] rounded-xl border border-cyan-200/35 bg-black/45 px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-cyan-100 min-w-[86px]">
                                    <div className="font-black mb-1">Left Team</div>
                                    <div className="flex items-center gap-1">
                                        {(lobbyPongTeams.left.length ? lobbyPongTeams.left : [{ uid: 'left-empty', avatar: EMOJI.wave }]).map((participant, idx) => (
                                            <span key={`${participant.uid || 'left'}-${idx}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-200/40 bg-black/45 text-xs">
                                                {participant.avatar || EMOJI.wave}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="absolute top-[12%] right-[7.5%] rounded-xl border border-fuchsia-200/35 bg-black/45 px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-fuchsia-100 min-w-[86px]">
                                    <div className="font-black mb-1">Right Team</div>
                                    <div className="flex items-center justify-end gap-1">
                                        {(lobbyPongTeams.right.length ? lobbyPongTeams.right : [{ uid: 'right-empty', avatar: EMOJI.sparkle }]).map((participant, idx) => (
                                            <span key={`${participant.uid || 'right'}-${idx}`} className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-fuchsia-200/40 bg-black/45 text-xs">
                                                {participant.avatar || EMOJI.sparkle}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div
                                    className="absolute inset-[-10%] pointer-events-none"
                                    style={{
                                        transform: `translate3d(0, ${(-8 + (lobbyVolleySkyShiftPct * 0.48)).toFixed(4)}%, 0) scale(${(1.02 + (lobbyVolleyParallaxEase * 0.08)).toFixed(4)})`,
                                        background: `linear-gradient(180deg,
                                            rgba(8,15,42,0.98) 0%,
                                            rgba(20,40,88,0.92) 18%,
                                            rgba(12,63,106,0.82) ${32 + (lobbyVolleyAltitudeProgress * 10)}%,
                                            rgba(24,88,122,0.54) ${58 + (lobbyVolleyAltitudeProgress * 8)}%,
                                            rgba(10,14,28,0.22) 100%)`
                                    }}
                                />
                                <div
                                    className="absolute inset-[-8%] pointer-events-none"
                                    style={{
                                        transform: `translate3d(0, ${(lobbyVolleySkyShiftPct * 0.86).toFixed(4)}%, 0)`,
                                        opacity: 0.4 + (lobbyVolleyParallaxEase * 0.2),
                                        background: 'radial-gradient(circle at 12% 16%, rgba(255,255,255,0.18), rgba(255,255,255,0) 18%), radial-gradient(circle at 26% 22%, rgba(255,255,255,0.12), rgba(255,255,255,0) 14%), radial-gradient(circle at 52% 12%, rgba(255,255,255,0.14), rgba(255,255,255,0) 16%), radial-gradient(circle at 74% 18%, rgba(255,255,255,0.16), rgba(255,255,255,0) 18%), radial-gradient(circle at 88% 10%, rgba(255,255,255,0.12), rgba(255,255,255,0) 13%)'
                                    }}
                                />
                                <div
                                    className="absolute inset-x-[-10%] top-[-18%] h-[52%] pointer-events-none"
                                    style={{
                                        transform: `translate3d(0, ${lobbyVolleySkyShiftPct}%, 0) scale(${(1 + (lobbyVolleyParallaxEase * 0.08)).toFixed(4)})`,
                                        opacity: 0.16 + (lobbyVolleyParallaxEase * 0.24),
                                        background: 'radial-gradient(circle at 50% 42%, rgba(125,211,252,0.24) 0%, rgba(56,189,248,0.12) 26%, rgba(14,165,233,0.08) 42%, rgba(0,0,0,0) 74%)'
                                    }}
                                />
                                <div
                                    className="absolute inset-x-[-6%] top-[17%] h-[28%] pointer-events-none"
                                    style={{
                                        transform: `translate3d(0, ${(lobbyVolleySkyShiftPct * 1.55).toFixed(4)}%, 0)`,
                                        opacity: 0.08 + (lobbyVolleyParallaxEase * 0.16),
                                        background: 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 28%, rgba(0,0,0,0) 78%), radial-gradient(circle at 22% 48%, rgba(255,255,255,0.12), rgba(0,0,0,0) 54%), radial-gradient(circle at 74% 44%, rgba(255,255,255,0.1), rgba(0,0,0,0) 48%)',
                                        filter: 'blur(14px)'
                                    }}
                                />
                                <div
                                    className="absolute inset-x-[-8%] bottom-[6%] h-[26%] pointer-events-none"
                                    style={{
                                        transform: `translate3d(0, ${(lobbyVolleyNearShiftPct * 0.58).toFixed(4)}%, 0)`,
                                        opacity: Math.max(0.06, 0.24 - (lobbyVolleyAltitudeProgress * 0.14)),
                                        background: 'radial-gradient(circle at 50% 0%, rgba(250,204,21,0.22), rgba(244,114,182,0.12) 34%, rgba(0,0,0,0) 74%)',
                                        filter: 'blur(18px)'
                                    }}
                                />
                                <div
                                    className="absolute inset-x-[-5%] bottom-[-6%] h-[28%] pointer-events-none"
                                    style={{
                                        transform: `translate3d(0, ${(lobbyVolleyFarShiftPct * 0.22).toFixed(4)}%, 0)`,
                                        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(3,7,18,0.16) 12%, rgba(2,6,23,0.68) 100%)'
                                    }}
                                />
                                <div
                                    className="absolute left-[-4%] bottom-[5%] w-[62%] h-[24%] pointer-events-none opacity-80"
                                    style={{
                                        transform: `translate3d(0, ${(lobbyVolleyFarShiftPct * 0.56).toFixed(4)}%, 0)`,
                                        clipPath: 'polygon(0 100%, 0 62%, 12% 40%, 22% 58%, 34% 28%, 44% 50%, 56% 18%, 70% 48%, 84% 30%, 100% 54%, 100% 100%)',
                                        background: 'linear-gradient(180deg, rgba(34,211,238,0.18), rgba(15,23,42,0.12) 28%, rgba(7,10,26,0.92) 100%)',
                                        filter: 'drop-shadow(0 0 28px rgba(34,211,238,0.14))'
                                    }}
                                />
                                <div
                                    className="absolute right-[-8%] bottom-[4%] w-[56%] h-[26%] pointer-events-none opacity-92"
                                    style={{
                                        transform: `translate3d(0, ${(lobbyVolleyNearShiftPct * 0.48).toFixed(4)}%, 0)`,
                                        clipPath: 'polygon(0 100%, 0 54%, 14% 38%, 25% 60%, 38% 26%, 49% 50%, 61% 20%, 72% 42%, 84% 24%, 100% 58%, 100% 100%)',
                                        background: 'linear-gradient(180deg, rgba(236,72,153,0.18), rgba(8,10,26,0.16) 26%, rgba(2,6,23,0.96) 100%)',
                                        filter: 'drop-shadow(0 0 34px rgba(236,72,153,0.16))'
                                    }}
                                />
                                {lobbyVolleyCloudBands.map((cloud) => (
                                    <div
                                        key={cloud.id}
                                        className="absolute pointer-events-none"
                                        style={{
                                            top: `${cloud.topPct}%`,
                                            left: `${cloud.leftPct}%`,
                                            width: `${cloud.widthPct}%`,
                                            height: `${cloud.heightPx}px`,
                                            opacity: cloud.opacity + (lobbyVolleyParallaxEase * 0.08),
                                            filter: 'blur(10px)',
                                            background: 'radial-gradient(circle at 20% 60%, rgba(255,255,255,0.1), rgba(255,255,255,0) 42%), radial-gradient(circle at 46% 52%, rgba(255,255,255,0.16), rgba(255,255,255,0) 44%), radial-gradient(circle at 74% 58%, rgba(255,255,255,0.12), rgba(255,255,255,0) 40%)'
                                        }}
                                    />
                                ))}
                                {lobbyVolleyParallaxPlatforms.map((platform) => (
                                    <div
                                        key={platform.id}
                                        className="absolute pointer-events-none"
                                        style={{
                                            top: `${platform.topPct}%`,
                                            left: `${platform.leftPct}%`,
                                            width: `${platform.widthPct}%`,
                                            transform: `rotate(${platform.tiltDeg}deg)`,
                                            filter: `drop-shadow(0 0 14px ${platform.glow})`
                                        }}
                                    >
                                        <div className="h-[14px] rounded-full border border-cyan-100/35 bg-black/22 backdrop-blur-sm">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    background: 'linear-gradient(90deg, rgba(45,212,191,0.38), rgba(125,211,252,0.62) 44%, rgba(244,114,182,0.42) 100%)'
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <div className="absolute left-[6%] right-[6%] lobby-volley-ground-line" style={{ top: `${lobbyGroundLineRenderTopPct}%` }}>
                                    <div className="lobby-volley-ground-core" />
                                </div>
                                {LOBBY_PLAY_GUIDE.map((guide) => {
                                    const anchor = LOBBY_ANCHOR_BASE[guide.id] || LOBBY_ANCHOR_BASE.wave;
                                    const effect = getLobbyPlayEffectByInteractionType(guide.id);
                                    const isRelayTarget = isVolleyOrbTargetInteraction({
                                        relayActive: lobbyRelayObjective.active,
                                        targetType: lobbyRelayObjective.targetType,
                                        interactionId: guide.id
                                    });
                                    const isRecent = lobbyRecentInteractionType === guide.id;
                                    return (
                                        <div
                                            key={`lobby-guide-anchor-${guide.id}`}
                                            className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                                                isRelayTarget
                                                    ? 'scale-110'
                                                    : isRecent
                                                        ? 'scale-105'
                                                        : 'scale-100'
                                            }`}
                                            style={{ left: `${anchor.x}%`, top: `${clampLobby(anchor.y + lobbyGuideVerticalShiftPct, -8, 138)}%` }}
                                        >
                                            {(isRelayTarget || isRecent) ? (
                                                <div className={`rounded-full border font-black uppercase backdrop-blur shadow-[0_0_24px_rgba(0,0,0,0.18)] ${
                                                    lobbyHasCustomOrbSkin
                                                        ? 'px-2.5 py-1 text-[10px] md:text-[12px] tracking-[0.12em]'
                                                        : 'px-3 py-1.5 text-[11px] md:text-[14px] tracking-[0.14em]'
                                                } ${
                                                    isRelayTarget
                                                        ? 'border-emerald-200/80 bg-emerald-400/35 text-emerald-50 shadow-[0_0_20px_rgba(16,185,129,0.45)]'
                                                        : 'border-cyan-200/80 bg-cyan-400/30 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.38)]'
                                                }`}>
                                                    <span className="mr-1">{effect?.icon || EMOJI.sparkle}</span>
                                                    {guide.action}
                                                </div>
                                            ) : (
                                                <div className="h-4 w-4 rounded-full border border-white/28 bg-black/35 shadow-[0_0_14px_rgba(255,255,255,0.08)]" aria-hidden="true" />
                                            )}
                                        </div>
                                    );
                                })}
                                {lobbyAltitudeMarkers.map((marker) => (
                                    <div
                                        key={`lobby-altitude-marker-${marker.altitudeFt}`}
                                        className="absolute left-[8%] right-[22%] pointer-events-none"
                                        style={{ top: `${marker.topPct}%` }}
                                    >
                                        <div className={`relative h-px w-full ${marker.isMajor ? 'bg-cyan-200/46' : 'bg-white/16'}`}>
                                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-200/0 via-cyan-200/30 to-fuchsia-300/0" />
                                            <span className={`absolute right-0 -translate-y-1/2 rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] ${
                                                marker.isMajor
                                                    ? 'border border-cyan-200/42 bg-black/48 text-cyan-100'
                                                    : 'text-white/52'
                                            }`}>
                                                {marker.altitudeFt}ft
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                <div
                                    className="absolute z-[3] -translate-x-1/2 -translate-y-1/2 transition-[top,left] duration-200 ease-out"
                                    style={{ top: `${lobbyOrbRenderTopPct}%`, left: `${lobbyOrbRenderLeftPct}%` }}
                                >
                                    <div
                                        className={`lobby-volley-orb-shell ${motionSafeFx ? 'lobby-volley-orb-shell-safe' : ''} ${lobbyOrbSkinUrl ? 'lobby-volley-orb-shell-custom' : ''} ${lobbyRelayObjective.active ? 'lobby-volley-orb-shell-relay' : ''}`}
                                        style={{
                                            '--orb-energy-norm': `${Math.max(0, Math.min(1, lobbyOrbEnergy / 100))}`,
                                            '--lobby-volley-orb-size': `${Math.max(120, Number(lobbyVolleySceneMetrics?.orbSizePx || 280))}px`,
                                            '--lobby-volley-orb-scale': `${Number(lobbyVolleySceneMetrics?.orbScale || 0.78)}`,
                                            '--lobby-volley-orb-content-scale': `${Number(lobbyVolleySceneMetrics?.orbContentScale || 0.84)}`,
                                            '--lobby-volley-participant-size': `${Math.max(18, Number(lobbyVolleySceneMetrics?.participantSizePx || 27))}px`
                                        }}
                                    >
                                        {lobbyHasCustomOrbSkin && (
                                            <>
                                                <div className="lobby-volley-orb-custom-halo lobby-volley-orb-custom-halo-a" aria-hidden="true" />
                                                <div className="lobby-volley-orb-custom-halo lobby-volley-orb-custom-halo-b" aria-hidden="true" />
                                                <div
                                                    className="lobby-volley-orb-custom-progress"
                                                    style={{ '--orb-progress': `${Math.max(0, Math.min(100, lobbyStreakDecayPct))}` }}
                                                    aria-hidden="true"
                                                />
                                            </>
                                        )}
                                        {!lobbyOrbSkinUrl && (
                                            <div className="lobby-volley-orb-slat-overlay" aria-hidden="true">
                                                <span className="lobby-volley-orb-seam lobby-volley-orb-seam-main" />
                                                <span className="lobby-volley-orb-seam lobby-volley-orb-seam-left" />
                                                <span className="lobby-volley-orb-seam lobby-volley-orb-seam-right" />
                                                <span className="lobby-volley-orb-seam lobby-volley-orb-seam-band" />
                                                <span className="lobby-volley-orb-seam lobby-volley-orb-seam-top" />
                                                <span className="lobby-volley-orb-seam lobby-volley-orb-seam-bottom" />
                                            </div>
                                        )}
                                        <div
                                            className={`lobby-volley-orb-core ${lobbyOrbSkinUrl ? 'lobby-volley-orb-core-custom' : ''}`}
                                            style={{
                                                '--orb-glow': `${0.35 + (lobbyOrbEnergy / 140)}`,
                                                '--orb-scale': `${1 + (lobbyOrbEnergy / 360)}`
                                            }}
                                        >
                                            {lobbyHasCustomOrbSkin ? (
                                                <div className="lobby-volley-orb-custom-badge-wrap">
                                                    <img
                                                        src={lobbyOrbSkinUrl}
                                                        alt="Orb showcase badge"
                                                        className="lobby-volley-orb-custom-badge"
                                                        loading="lazy"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    {!!lobbyOrbSkinUrl && (
                                                        <>
                                                            <img
                                                                src={lobbyOrbSkinUrl}
                                                                alt="Orb core skin"
                                                                className="lobby-volley-orb-core-skin"
                                                                loading="lazy"
                                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                            />
                                                            <div className="lobby-volley-orb-core-skin-overlay" aria-hidden="true" />
                                                        </>
                                                    )}
                                                    <div className="lobby-volley-orb-core-content">
                                                        <div className="text-[14px] md:text-[16px] uppercase tracking-[0.24em] text-cyan-100">{lobbyObjectiveLabel}</div>
                                                        <div className="text-[3.5rem] md:text-[4.75rem] font-bebas text-white leading-none">x{Number(lobbyTeamworkMultiplier || 1).toFixed(1)}</div>
                                                        <div className="text-[12px] md:text-[14px] uppercase tracking-[0.18em] text-white/80">
                                                            {lobbyHasActiveVolley ? `${lobbyAirborneSec}s airborne` : 'tap to launch'}
                                                        </div>
                                                        <div className="text-[11px] md:text-[13px] uppercase tracking-[0.14em] text-white/70">
                                                            {lobbyObjectiveStreakLabel}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {!lobbyHasCustomOrbSkin && (
                                            <>
                                                <div className="lobby-volley-orb-ring">
                                                    <div
                                                        className="lobby-volley-orb-ring-fill"
                                                        style={{ '--orb-fill': `${lobbyStreakDecayPct}%` }}
                                                    />
                                                </div>
                                                <div className="lobby-volley-orb-activity">
                                                    {lobbyActiveParticipants.slice(0, 5).map((participant, idx) => (
                                                        <span key={`${participant.uid}-${idx}`} className="lobby-volley-participant">
                                                            {participant.avatar || EMOJI.sparkle}
                                                        </span>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="absolute left-[5%] bottom-[10.5%] rounded-[24px] border border-cyan-200/34 bg-[linear-gradient(180deg,rgba(2,6,23,0.74),rgba(8,15,42,0.58))] px-4 py-3 shadow-[0_0_28px_rgba(34,211,238,0.14)] backdrop-blur-md">
                                    <div className="flex items-end gap-3">
                                        <div>
                                            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/72">Current Height</div>
                                            <div className="mt-1 flex items-end gap-1.5">
                                                <span className="text-[38px] md:text-[54px] leading-none font-bebas text-white">
                                                    {Math.round(lobbyOrbAltitudeState.altitudeFt)}
                                                </span>
                                                <span className="mb-1 text-[14px] md:text-[18px] uppercase tracking-[0.16em] text-cyan-100/86">ft</span>
                                            </div>
                                        </div>
                                        <div className="pb-1 text-right">
                                            <div className="text-[10px] uppercase tracking-[0.2em] text-white/56">Peak</div>
                                            <div className="text-[20px] md:text-[24px] leading-none font-bebas text-white/90">
                                                {Math.round(lobbyPeakAltitudeFt)}ft
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 h-[5px] w-[180px] md:w-[220px] rounded-full bg-white/12 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-400 transition-all duration-200"
                                            style={{ width: `${Math.max(4, lobbyVolleyAltitudeProgress * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}
                <div
                    className="absolute top-[3.6%] text-right pointer-events-none"
                    style={{ right: lobbyObjectiveHudRight, width: lobbyObjectiveHudWidth }}
                >
                    <div className="text-[12px] md:text-[14px] uppercase tracking-[0.22em] text-cyan-200/90">
                        {lobbyObjectiveLabel}
                    </div>
                    <div className="mt-1 text-[36px] md:text-[56px] 2xl:text-[68px] leading-[0.9] font-bebas text-white drop-shadow-[0_0_16px_rgba(0,0,0,0.52)]">
                        {lobbyInstructionHeadline}
                    </div>
                    <div className="mt-1.5 text-[14px] md:text-[18px] text-cyan-100/90 leading-tight max-w-[22vw] ml-auto">
                        {lobbyInstructionSecondary}
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-white/18 bg-black/35 px-3 py-2.5 text-left">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">Team</div>
                            <div className="mt-1 text-[22px] md:text-[28px] leading-none font-bebas text-white">x{Number(lobbyTeamworkMultiplier || 1).toFixed(1)}</div>
                        </div>
                        <div className="rounded-2xl border border-white/18 bg-black/35 px-3 py-2.5 text-left">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">Energy</div>
                            <div className="mt-1 text-[22px] md:text-[28px] leading-none font-bebas text-white">{Math.round(lobbyOrbEnergy)}%</div>
                        </div>
                        <div className="rounded-2xl border border-white/18 bg-black/35 px-3 py-2.5 text-left">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">Peak</div>
                            <div className="mt-1 text-[22px] md:text-[28px] leading-none font-bebas text-white">{Math.round(lobbyPeakAltitudeFt)}ft</div>
                        </div>
                        <div className="rounded-2xl border border-white/18 bg-black/35 px-3 py-2.5 text-left">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">Relay</div>
                            <div className="mt-1 text-[22px] md:text-[28px] leading-none font-bebas text-white">
                                {lobbyRelayObjective.active ? `${lobbyRelayRemainingSec}s` : 'READY'}
                            </div>
                        </div>
                    </div>
                    {lobbyActiveUltimates.length > 0 && (
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                            {lobbyActiveUltimates.slice(0, 3).map((entry) => {
                                const ultimate = getVolleyOrbUltimate(entry?.type || '');
                                if (!ultimate) return null;
                                return (
                                    <div key={entry.id || `${entry.type}-${entry.uid || 'room'}`} className="rounded-full border border-emerald-300/45 bg-emerald-500/18 px-3 py-1 text-[12px] uppercase tracking-[0.16em] text-emerald-50 font-black">
                                        {ultimate.emoji} {ultimate.label}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="mt-3 space-y-2">
                        <div className="h-[10px] rounded-full overflow-hidden bg-white/14">
                            <div className="h-full bg-gradient-to-r from-red-300 via-amber-300 to-emerald-300 transition-all duration-200" style={{ width: `${lobbyStreakDecayPct}%` }} />
                        </div>
                        <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/75">
                            {lobbyObjectiveProgressLabel}
                        </div>
                    </div>
                </div>
                {!lobbyObjectiveIsTeamPong && (
                    <div className="absolute left-[3.8%] bottom-[13.5%] w-[min(29vw,420px)] rounded-[22px] border border-cyan-200/26 bg-black/40 backdrop-blur px-3.5 py-3 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="text-[12px] md:text-[14px] uppercase tracking-[0.2em] text-cyan-100/90 font-black">
                                {lobbyRelayObjective.active ? 'Current Target' : 'Volley Sync'}
                            </div>
                            <div className="text-[10px] md:text-[11px] uppercase tracking-[0.14em] text-zinc-200">
                                {lobbyCatchAllActive ? 'Catch-all live' : (lobbyRelayObjective.active ? 'Pass to the glow' : 'Any player can relaunch')}
                            </div>
                        </div>
                        {lobbyGuideFocusEntries.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2.5">
                                {lobbyGuideFocusEntries.map((guide) => {
                                    const effect = getLobbyPlayEffectByInteractionType(guide.id);
                                    const isRelayTarget = isVolleyOrbTargetInteraction({
                                        relayActive: lobbyRelayObjective.active,
                                        targetType: lobbyRelayObjective.targetType,
                                        interactionId: guide.id
                                    });
                                    return (
                                        <div
                                            key={`lobby-guide-card-${guide.id}`}
                                            className={`rounded-2xl border px-3 py-3 ${
                                                isRelayTarget
                                                    ? 'border-emerald-300/75 bg-emerald-500/18'
                                                    : 'border-cyan-300/65 bg-cyan-500/14'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span className="text-[18px] md:text-[22px]">{effect?.icon || EMOJI.sparkle}</span>
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">
                                                            {isRelayTarget ? 'Hit this now' : 'Last action'}
                                                        </div>
                                                        <div className="text-[14px] md:text-[18px] uppercase tracking-[0.1em] text-white/90 font-black truncate">{guide.action}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] md:text-[11px] uppercase tracking-[0.14em] text-white/65">
                                                        {isRelayTarget ? 'Target' : 'Volley'}
                                                    </div>
                                                    <div className="text-[10px] md:text-[12px] uppercase tracking-[0.1em] text-zinc-300">{guide.detail}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-white/18 bg-black/28 px-3.5 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">Keep it climbing</div>
                                        <div className="mt-1 text-base md:text-lg font-black text-white">Any tap keeps the orb moving up</div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xl md:text-2xl">
                                        {LOBBY_PLAY_GUIDE.map((guide) => {
                                            const effect = getLobbyPlayEffectByInteractionType(guide.id);
                                            return (
                                                <span key={`lobby-guide-icon-${guide.id}`} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/16 bg-white/8">
                                                    {effect?.icon || EMOJI.sparkle}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <div className="absolute top-5 right-5 flex flex-col items-end gap-2">
                    {lobbyTierChips.slice(0, 3).map((chip) => {
                        const ageMs = nowMs() - Number(chip?.createdAt || 0);
                        if (ageMs < 0) return null;
                        const durationMs = Math.max(1500, Number(chip?.durationMs || LOBBY_AWARD_VISUAL_WINDOW_MS));
                        const progress = Math.min(1, ageMs / durationMs);
                        if (progress >= 1) return null;
                        return (
                            <div
                                key={chip.id}
                                className={`rounded-xl border border-white/35 bg-gradient-to-r ${chip.accent || 'from-cyan-300/65 to-indigo-300/65'} px-3 py-2 min-w-[190px] text-black shadow-[0_0_26px_rgba(255,255,255,0.28)]`}
                                style={{ opacity: Math.max(0, 1 - (progress * 0.8)) }}
                            >
                                <div className="text-[10px] uppercase tracking-[0.16em] font-black">Lobby Reward</div>
                                <div className="text-sm font-black">{chip.label}</div>
                                {chip.subtitle && <div className="text-[10px] uppercase tracking-[0.1em] font-bold">{chip.subtitle}</div>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Lobby Playground Bursts */}
            <div className={`absolute inset-0 z-[199] pointer-events-none overflow-hidden transition-opacity duration-700 ${lobbyTransitionPhase === 'exiting' ? 'opacity-0' : 'opacity-100'}`}>
                {lobbyPlayBursts.map((burst) => {
                    const ageMs = nowMs() - Number(burst.createdAt || 0);
                    if (ageMs < 0) return null;
                    const durationMs = Math.max(2200, Number(burst.durationMs || 3600));
                    const progress = Math.min(1, ageMs / durationMs);
                    const opacity = Math.max(0, 1 - progress);
                    const particleOpacity = Math.max(0, 1 - (progress * 1.25));
                    const burstLeftPct = Number(burst.left || 50);
                    const burstTopPct = Number(burst.top || 50);
                    const burstSafeLeftPct = (
                        !lobbyObjectiveIsTeamPong
                        && burstLeftPct > 71
                        && burstTopPct > 4
                        && burstTopPct < 84
                    ) ? 68 : burstLeftPct;
                    return (
                        <div
                            key={burst.id}
                            className="absolute"
                            style={{
                                left: `${burstSafeLeftPct}%`,
                                top: `${burstTopPct}%`,
                                opacity
                            }}
                        >
                            <div className="lobby-burst-anchor">
                                <div
                                    className={`lobby-burst-motion lobby-burst-motion-${burst.motion || 'wave'}`}
                                    style={{
                                        animationDelay: `${Number(burst.staggerMs || 0)}ms`,
                                        '--lobby-rise': `${Math.max(18, Number(burst.risePx || 32))}px`
                                    }}
                                >
                                    <div
                                        className="relative"
                                        style={{
                                            transform: `scale(${Math.max(0.82, Number(burst.scale || 1))}) rotate(${Number(burst.rotationDeg || 0)}deg)`
                                        }}
                                    >
                                        <div
                                            className="absolute -inset-10 rounded-full lobby-burst-aura"
                                            style={{
                                                background: `radial-gradient(circle, ${burst.aura || 'rgba(34,211,238,0.42)'} 0%, rgba(0,0,0,0) 72%)`,
                                                opacity: Math.max(0.2, Number(burst.contributionAlpha || 1))
                                            }}
                                        />
                                        <div className={`relative rounded-[24px] border border-white/45 bg-gradient-to-r ${burst.accent} px-4 py-3 shadow-[0_0_34px_rgba(34,211,238,0.38)] backdrop-blur-sm lobby-burst-card`}>
                                            <div className="flex items-center gap-3">
                                                <span className="text-4xl md:text-5xl drop-shadow-[0_0_18px_rgba(255,255,255,0.65)]">{burst.icon}</span>
                                                <div className="min-w-0">
                                                    <div className="text-[11px] md:text-xs uppercase tracking-[0.2em] font-black text-black/85">{burst.label}</div>
                                                    <div className="text-sm md:text-base text-black/80 font-bold truncate max-w-[220px]">{burst.user}</div>
                                                </div>
                                                {!!burst.relayHit && (
                                                    <div className="rounded-full border border-black/45 bg-emerald-200/65 px-2 py-1 text-[10px] md:text-xs uppercase tracking-[0.16em] font-black text-black/90">
                                                        Assist x{Math.max(1, Number(burst.relayChainCount || 1))}
                                                    </div>
                                                )}
                                                {Number(burst.count || 1) > 1 && (
                                                    <div className="rounded-full border border-black/40 bg-black/20 px-2 py-1 text-[10px] md:text-xs uppercase tracking-[0.16em] font-black text-black/85">
                                                        x{Number(burst.count || 1)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 pointer-events-none">
                                            {(Array.isArray(burst.particles) ? burst.particles : []).map((particle) => (
                                                <span
                                                    key={`${burst.id}-${particle.id}`}
                                                    className="lobby-burst-particle"
                                                    style={{
                                                        marginLeft: `${Number(particle.x || 0)}px`,
                                                        marginTop: `${Number(particle.y || 0)}px`,
                                                        animationDelay: `${Number(particle.delayMs || 0)}ms`,
                                                        opacity: particleOpacity
                                                    }}
                                                >
                                                    {particle.icon}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            </>
            )}

            {/* Reactions */}
            {featuredReaction && currentPerformanceId && (
                <div className="absolute left-1/2 top-5 z-[210] w-[min(92vw,880px)] -translate-x-1/2 pointer-events-none">
                    <div className={`featured-reaction-spotlight relative overflow-hidden rounded-[2rem] border px-5 py-4 md:px-7 md:py-5 ${featuredReaction.isVip ? 'border-yellow-300/65 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.32),rgba(17,24,39,0.95)_55%,rgba(3,7,18,0.98)_100%)] shadow-[0_0_48px_rgba(251,191,36,0.24)]' : 'border-cyan-300/35 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.24),rgba(17,24,39,0.95)_55%,rgba(3,7,18,0.98)_100%)] shadow-[0_0_44px_rgba(34,211,238,0.18)]'}`}>
                        <div className="absolute inset-0 featured-reaction-sheen opacity-70" aria-hidden="true" />
                        <div className="relative flex items-center gap-4 md:gap-6">
                            <div className={`featured-reaction-avatar flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-[1.6rem] border text-4xl md:text-5xl ${featuredReaction.isVip ? 'border-yellow-300/55 bg-yellow-300/12' : 'border-white/12 bg-white/6'}`}>
                                {featuredReaction.avatar || EMOJI.sparkle}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className={`text-[10px] md:text-xs font-black uppercase tracking-[0.34em] ${featuredReaction.isVip ? 'text-yellow-200' : 'text-cyan-200'}`}>
                                    Crowd moment
                                </div>
                                <div className="mt-1 text-[clamp(1.6rem,4vw,3.35rem)] font-black leading-[0.92] text-white drop-shadow-[0_0_22px_rgba(255,255,255,0.12)]">
                                    {featuredReaction.userName || 'Guest'}
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 md:gap-3">
                                    <div className={`inline-flex items-center rounded-full px-3 py-1.5 md:px-4 md:py-2 text-sm md:text-lg font-black uppercase tracking-[0.22em] ${featuredReaction.isVip ? 'bg-yellow-300/12 text-yellow-100 border border-yellow-300/45' : 'bg-cyan-400/10 text-cyan-100 border border-cyan-300/30'}`}>
                                        {getLobbyReactionLabel(featuredReaction.type)}
                                        {featuredReaction.count > 1 ? ` x${featuredReaction.count}` : ''}
                                    </div>
                                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs md:text-sm font-semibold text-zinc-100">
                                        +{featuredReaction.points || 0} hype
                                    </div>
                                </div>
                            </div>
                            <div className="featured-reaction-emoji shrink-0 text-[3.8rem] leading-none md:text-[5.6rem] drop-shadow-[0_0_20px_rgba(255,255,255,0.18)]">
                                {featuredReaction.emojiChar || getEmojiChar(featuredReaction.type)}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="absolute inset-0 z-[200] pointer-events-none overflow-hidden">
                {reactions.map(r => (
                    <div
                        key={r.id}
                        className={`absolute bottom-0 flex flex-col items-center reaction-stack reaction-stack-${r.motionVariant || 'drift-right'}`}
                        style={{
                            left: `${r.left}%`,
                            '--reaction-duration': `${Math.max(6800, Number(r.motionDurationMs || TV_REACTION_VISIBILITY_MS))}ms`,
                            '--reaction-drift-x': `${Number(r.motionDriftX || 32)}px`,
                            '--reaction-rise-y': `${Number(r.motionRiseY || 96)}px`,
                            '--reaction-rotate': `${Number(r.motionRotateDeg || 0)}deg`,
                            '--reaction-scale': Number(r.motionScaleBoost || 1),
                        }}
                    >
                        {r.isVip && (
                            <div className="absolute -inset-10 rounded-full bg-gradient-to-tr from-yellow-400/30 via-pink-400/30 to-cyan-400/30 blur-xl animate-vip-glow"></div>
                        )}
                        <div className="relative flex flex-col items-center">
                            <div className={`relative ${getReactionClass(r.type)} ${r.isVip ? 'vip-reaction-emoji' : ''}`}>
                                {r.emojiChar || getEmojiChar(r.type)}
                                {r.isVip && (
                                    <span className="absolute -top-3 -right-3 md:-top-4 md:-right-4 text-xl md:text-3xl animate-vip-spin">{'\u2728'}</span>
                                )}
                            </div>
                            {isSimpleTvProfile ? (
                                <div className="mt-2 inline-flex items-center rounded-full border border-white/18 bg-black/68 px-3 py-1.5 text-sm font-black text-white shadow-[0_0_16px_rgba(255,255,255,0.08)]">
                                    <span className="text-lg leading-none">{r.avatar || EMOJI.sparkle}</span>
                                </div>
                            ) : (
                                <div className="mt-3 flex flex-col items-center gap-1 reaction-label">
                                    <div className={`px-4 py-2 md:px-6 md:py-3 rounded-[1.5rem] text-xl md:text-4xl font-black flex items-center gap-2.5 ${r.isVip ? 'text-yellow-200 border-2 border-yellow-300 bg-black/76 shadow-[0_0_22px_rgba(253,224,71,0.55)]' : 'text-white border-2 border-white/25 bg-black/68 shadow-[0_0_18px_rgba(255,255,255,0.08)]'}`}>
                                        <span className="text-2xl md:text-4xl leading-none">{r.avatar || EMOJI.sparkle}</span>
                                        <span className="truncate max-w-[13rem] md:max-w-[18rem]">{r.userName || 'Guest'}</span>
                                        {r.isVip && <span className="text-xs font-black tracking-widest">{tvPremiumBadgeLabel}</span>}
                                    </div>
                                    <div className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-xl font-bold tracking-[0.24em] uppercase ${r.isVip ? 'text-cyan-100 border border-cyan-300/45 bg-cyan-500/10' : 'text-cyan-200 border border-cyan-400/40 bg-black/60'}`}>
                                        {r.labelOverride || getLobbyReactionLabel(r.type)}
                                    </div>
                                    {Number(r.points || 0) > 0 && (
                                        <div className={`px-3 py-1 rounded-full text-[11px] md:text-sm font-semibold ${r.isVip ? 'text-yellow-200/90 bg-yellow-400/10 border border-yellow-300/35' : 'text-zinc-200 bg-white/5 border border-white/10'}`}>
                                            +{r.points || 0} pts
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {tvExploreEnabled && (
                <div className="absolute left-3 bottom-3 md:left-5 md:bottom-5 z-[245] pointer-events-auto">
                    <div className="rounded-2xl border border-cyan-300/45 bg-black/70 px-3 py-2 md:px-4 md:py-3 shadow-[0_0_24px_rgba(34,211,238,0.2)] backdrop-blur">
                        <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-cyan-200">TV Explore</div>
                        <div className="mt-1 text-[11px] md:text-xs text-zinc-300">
                            Active: <span className="font-bold text-white uppercase">{tvPresentationProfile}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 md:gap-2">
                            {[
                                { id: 'room', label: 'Room' },
                                { id: 'simple', label: 'Simple' },
                                { id: 'cinema', label: 'Cinema' }
                            ].map((option) => {
                                const active = tvPresentationProfile === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setTvExploreProfile(option.id)}
                                        className={`px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg border text-[10px] md:text-xs font-black uppercase tracking-[0.12em] transition-colors ${active ? 'bg-cyan-300 text-black border-cyan-100' : 'bg-black/35 text-zinc-200 border-white/20 hover:border-cyan-200/50'}`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

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
                                <div className="rounded-2xl border border-white/12 bg-[linear-gradient(145deg,rgba(8,10,18,0.96),rgba(15,23,42,0.94))] px-5 py-4 mb-3 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
                                    <div className="text-xs uppercase tracking-[0.22em] text-zinc-200 mb-2">Prompt</div>
                                    <div className="text-[clamp(1.1rem,2vw,1.8rem)] font-black leading-tight text-white">Pick your side before timer ends</div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xl text-white">
                                    <div className="bg-[linear-gradient(145deg,rgba(7,22,27,0.98),rgba(15,49,60,0.95))] border border-teal-300/35 rounded-xl px-4 py-6 text-center font-bold">Sing every duet</div>
                                    <div className="bg-[linear-gradient(145deg,rgba(24,10,22,0.98),rgba(64,20,47,0.95))] border border-pink-300/35 rounded-xl px-4 py-6 text-center font-bold">Run the DJ booth</div>
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
              @keyframes tv-takeover-ray-spin { 0% { transform: translate(-50%, -50%) rotate(0deg) scale(1); } 100% { transform: translate(-50%, -50%) rotate(360deg) scale(1); } }
              @keyframes tv-takeover-ray-pulse { 0%, 100% { opacity: 0.48; filter: blur(5px); } 50% { opacity: 0.82; filter: blur(7px); } }
              @keyframes tv-takeover-logo-float { 0%, 100% { transform: translateY(0px) scale(1); } 50% { transform: translateY(-5px) scale(1.012); } }
              @keyframes marquee { 0% { transform: translateX(100vw); } 100% { transform: translateX(-100%); } } 
              @keyframes marqueeFade { 0% { opacity: 0; transform: translateY(12px); } 100% { opacity: 1; transform: translateY(0); } }
              @keyframes reaction-drift-left {
                0% { opacity: 0; transform: translate3d(0, 22px, 0) rotate(calc(var(--reaction-rotate, 0deg) * -0.35)) scale(0.82); }
                12% { opacity: 1; transform: translate3d(-8px, 0, 0) rotate(calc(var(--reaction-rotate, 0deg) * 0.2)) scale(calc(var(--reaction-scale, 1) * 1.06)); }
                70% { opacity: 1; transform: translate3d(calc(var(--reaction-drift-x, 32px) * -0.72), calc(var(--reaction-rise-y, 96px) * -0.64), 0) rotate(calc(var(--reaction-rotate, 0deg) * 0.7)) scale(var(--reaction-scale, 1)); }
                100% { opacity: 0; transform: translate3d(calc(var(--reaction-drift-x, 32px) * -1), calc(var(--reaction-rise-y, 96px) * -1), 0) rotate(var(--reaction-rotate, 0deg)) scale(calc(var(--reaction-scale, 1) * 0.94)); }
              }
              @keyframes reaction-drift-right {
                0% { opacity: 0; transform: translate3d(0, 18px, 0) rotate(calc(var(--reaction-rotate, 0deg) * -0.35)) scale(0.84); }
                12% { opacity: 1; transform: translate3d(10px, -3px, 0) rotate(calc(var(--reaction-rotate, 0deg) * 0.18)) scale(calc(var(--reaction-scale, 1) * 1.07)); }
                72% { opacity: 1; transform: translate3d(calc(var(--reaction-drift-x, 32px) * 0.76), calc(var(--reaction-rise-y, 96px) * -0.68), 0) rotate(calc(var(--reaction-rotate, 0deg) * 0.72)) scale(var(--reaction-scale, 1)); }
                100% { opacity: 0; transform: translate3d(var(--reaction-drift-x, 32px), calc(var(--reaction-rise-y, 96px) * -1), 0) rotate(var(--reaction-rotate, 0deg)) scale(calc(var(--reaction-scale, 1) * 0.94)); }
              }
              @keyframes reaction-hover-burst {
                0% { opacity: 0; transform: translate3d(0, 24px, 0) scale(0.72) rotate(calc(var(--reaction-rotate, 0deg) * -0.2)); }
                12% { opacity: 1; transform: translate3d(0, -4px, 0) scale(calc(var(--reaction-scale, 1) * 1.08)) rotate(calc(var(--reaction-rotate, 0deg) * 0.18)); }
                30% { opacity: 1; transform: translate3d(calc(var(--reaction-drift-x, 32px) * 0.12), calc(var(--reaction-rise-y, 96px) * -0.16), 0) scale(calc(var(--reaction-scale, 1) * 1.02)) rotate(calc(var(--reaction-rotate, 0deg) * 0.32)); }
                72% { opacity: 0.96; transform: translate3d(calc(var(--reaction-drift-x, 32px) * -0.14), calc(var(--reaction-rise-y, 96px) * -0.28), 0) scale(var(--reaction-scale, 1)) rotate(calc(var(--reaction-rotate, 0deg) * -0.14)); }
                100% { opacity: 0; transform: translate3d(calc(var(--reaction-drift-x, 32px) * 0.2), calc(var(--reaction-rise-y, 96px) * -0.42), 0) scale(calc(var(--reaction-scale, 1) * 0.94)) rotate(calc(var(--reaction-rotate, 0deg) * 0.12)); }
              }
              @keyframes reaction-bounce-burst {
                0% { opacity: 0; transform: translate3d(0, 30px, 0) scale(0.68) rotate(calc(var(--reaction-rotate, 0deg) * -0.2)); }
                14% { opacity: 1; transform: translate3d(0, -12px, 0) scale(calc(var(--reaction-scale, 1) * 1.12)) rotate(calc(var(--reaction-rotate, 0deg) * 0.18)); }
                26% { opacity: 1; transform: translate3d(calc(var(--reaction-drift-x, 32px) * 0.16), 0, 0) scale(calc(var(--reaction-scale, 1) * 0.98)) rotate(calc(var(--reaction-rotate, 0deg) * -0.08)); }
                58% { opacity: 0.98; transform: translate3d(calc(var(--reaction-drift-x, 32px) * 0.24), calc(var(--reaction-rise-y, 96px) * -0.34), 0) scale(var(--reaction-scale, 1)) rotate(calc(var(--reaction-rotate, 0deg) * 0.32)); }
                100% { opacity: 0; transform: translate3d(calc(var(--reaction-drift-x, 32px) * 0.3), calc(var(--reaction-rise-y, 96px) * -0.56), 0) scale(calc(var(--reaction-scale, 1) * 0.92)) rotate(var(--reaction-rotate, 0deg)); }
              }
              @keyframes reaction-side-sweep {
                0% { opacity: 0; transform: translate3d(0, 26px, 0) scale(0.7) rotate(calc(var(--reaction-rotate, 0deg) * -0.22)); }
                12% { opacity: 1; transform: translate3d(calc(var(--reaction-drift-x, 32px) * -0.12), -2px, 0) scale(calc(var(--reaction-scale, 1) * 1.1)) rotate(calc(var(--reaction-rotate, 0deg) * 0.1)); }
                60% { opacity: 1; transform: translate3d(calc(var(--reaction-drift-x, 32px) * 0.72), calc(var(--reaction-rise-y, 96px) * -0.46), 0) scale(var(--reaction-scale, 1)) rotate(calc(var(--reaction-rotate, 0deg) * 0.72)); }
                100% { opacity: 0; transform: translate3d(calc(var(--reaction-drift-x, 32px) * 1.3), calc(var(--reaction-rise-y, 96px) * -0.72), 0) scale(calc(var(--reaction-scale, 1) * 0.9)) rotate(var(--reaction-rotate, 0deg)); }
              }
              @keyframes points-burst { 0% { opacity: 0; transform: translateY(10px) scale(0.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-18px) scale(1.2); } }
              @keyframes vip-glow { 0% { opacity: 0.6; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.08); } 100% { opacity: 0.6; transform: scale(0.95); } }
              @keyframes vip-jolt { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-2deg) scale(1.05); } 50% { transform: rotate(2deg) scale(1.08); } 75% { transform: rotate(-1deg) scale(1.04); } }
              @keyframes vip-spin { 0% { transform: rotate(0deg) scale(1); } 100% { transform: rotate(360deg) scale(1.2); } }
              @keyframes reaction-label-in { 0% { opacity: 0; transform: translateY(10px) scale(0.95); } 40% { opacity: 1; } 100% { opacity: 1; transform: translateY(0) scale(1); } }
              @keyframes featured-reaction-enter { 0% { opacity: 0; transform: translateY(-12px) scale(0.96); } 18% { opacity: 1; transform: translateY(0) scale(1.02); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
              @keyframes featured-reaction-sheen { 0% { transform: translateX(-120%); opacity: 0; } 18% { opacity: 0.5; } 55% { opacity: 0.18; } 100% { transform: translateX(130%); opacity: 0; } }
              @keyframes selfie-grid-sheen { 0% { transform: translateX(-30%) translateY(0%); opacity: 0.12; } 50% { transform: translateX(4%) translateY(8%); opacity: 0.32; } 100% { transform: translateX(-30%) translateY(0%); opacity: 0.12; } }
              @keyframes selfie-card-fresh { 0%, 100% { box-shadow: 0 0 0 rgba(34,211,238,0.0), 0 18px 60px rgba(0,0,0,0.35); } 50% { box-shadow: 0 0 36px rgba(34,211,238,0.18), 0 22px 70px rgba(0,0,0,0.42); } }
              @keyframes selfie-arrival-enter { 0% { opacity: 0; transform: translateY(36px) scale(0.72) rotate(-10deg); } 24% { opacity: 1; transform: translateY(-10px) scale(1.08) rotate(2deg); } 52% { opacity: 1; transform: translateY(2px) scale(0.98) rotate(-3deg); } 100% { opacity: 1; transform: translateY(0) scale(1) rotate(-2deg); } }
              @keyframes selfie-arrival-ring { 0% { opacity: 0.75; transform: scale(0.72); } 100% { opacity: 0; transform: scale(1.16); } }
              @keyframes selfie-arrival-spark { 0%, 100% { opacity: 0.25; transform: scale(0.84) rotate(0deg); } 40% { opacity: 1; transform: scale(1.16) rotate(8deg); } 70% { opacity: 0.72; transform: scale(1) rotate(-6deg); } }
              @keyframes selfie-cam-pulse { 0% { transform: scale(0.88); opacity: 0.52; } 70% { transform: scale(1.14); opacity: 0; } 100% { transform: scale(1.14); opacity: 0; } }
              @keyframes selfie-flash-burst { 0% { opacity: 0.95; } 30% { opacity: 0.42; } 100% { opacity: 0; } }
              @keyframes public-moment-card-enter { 0% { opacity: 0; transform: translateY(38px) scale(0.7) rotate(-12deg); } 18% { opacity: 1; transform: translateY(-12px) scale(1.08) rotate(4deg); } 46% { opacity: 1; transform: translateY(2px) scale(0.99) rotate(-5deg); } 100% { opacity: 1; transform: translateY(0) scale(1) rotate(-4deg); } }
              @keyframes public-moment-burst { 0% { opacity: 0.72; transform: scale(0.7); } 70% { opacity: 0.18; transform: scale(1.06); } 100% { opacity: 0; transform: scale(1.18); } }
              @keyframes public-moment-ribbon { 0%, 100% { transform: translateY(0) rotate(0deg); } 45% { transform: translateY(-2px) rotate(2deg); } }
              @keyframes doodle-card-fresh { 0%, 100% { transform: translateY(0px) rotate(0deg) scale(1); box-shadow: 0 18px 60px rgba(0,0,0,0.35); } 28% { transform: translateY(-6px) rotate(-1.2deg) scale(1.03); box-shadow: 0 18px 60px rgba(0,0,0,0.38), 0 0 34px rgba(34,211,238,0.18); } 58% { transform: translateY(0px) rotate(0.8deg) scale(1.01); box-shadow: 0 22px 68px rgba(0,0,0,0.42), 0 0 28px rgba(244,114,182,0.14); } }
              @keyframes doodle-arrival-chip { 0% { opacity: 0; transform: translateY(-8px) scale(0.8); } 30% { opacity: 1; transform: translateY(0) scale(1.06); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
              @keyframes tv-sweep { 0% { transform: translateX(-120%); opacity: 0; } 20% { opacity: 0.45; } 50% { opacity: 0.12; } 100% { transform: translateX(120%); opacity: 0; } }
              @keyframes bonus-pop { 0% { opacity: 0; transform: scale(0.7); } 20% { opacity: 1; transform: scale(1.02); } 100% { opacity: 0; transform: scale(1.08); } }
              @keyframes bonus-sheen { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
              @keyframes lobby-burst-rise { 0% { opacity: 0; transform: translateY(12px) scale(0.84); } 16% { opacity: 1; } 100% { opacity: 0; transform: translateY(calc(var(--lobby-rise, 32px) * -1)) scale(1.03); } }
              @keyframes lobby-wave-card { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-2.5deg) scale(1.03); } 50% { transform: rotate(2.2deg) scale(1.05); } 75% { transform: rotate(-1.5deg) scale(1.02); } }
              @keyframes lobby-laser-card { 0% { transform: scale(0.9); filter: brightness(0.95); } 35% { transform: scale(1.09); filter: brightness(1.28); } 70% { transform: scale(0.98); filter: brightness(1.08); } 100% { transform: scale(1); filter: brightness(1); } }
              @keyframes lobby-echo-card { 0% { transform: scale(0.94); box-shadow: 0 0 0 rgba(96,165,250,0.0); } 45% { transform: scale(1.08); box-shadow: 0 0 24px rgba(96,165,250,0.45), 0 0 42px rgba(99,102,241,0.34); } 100% { transform: scale(1); box-shadow: 0 0 0 rgba(96,165,250,0.0); } }
              @keyframes lobby-confetti-card { 0% { transform: translateY(8px) rotate(-4deg) scale(0.9); } 25% { transform: translateY(-6px) rotate(6deg) scale(1.08); } 55% { transform: translateY(0px) rotate(-2deg) scale(1.02); } 100% { transform: translateY(0px) rotate(0deg) scale(1); } }
              @keyframes lobby-aura-pulse { 0% { opacity: 0.35; transform: scale(0.72); } 35% { opacity: 0.85; transform: scale(1.05); } 100% { opacity: 0; transform: scale(1.28); } }
              @keyframes lobby-particle-pop { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.25); } 20% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); } 100% { opacity: 0; transform: translate(-50%, calc(-50% - 22px)) scale(0.72); } }
              @keyframes lobby-screen-wave-expand { 0% { opacity: 0.9; transform: translate(-50%, -50%) scale(0.42); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.22); } }
              @keyframes lobby-screen-echo-expand { 0% { opacity: 0.88; transform: translate(-50%, -50%) scale(0.36); } 65% { opacity: 0.52; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.34); } }
              @keyframes lobby-screen-laser-sweep { 0% { opacity: 0; transform: translateX(-110%) rotate(var(--beam-tilt, 0deg)); } 20% { opacity: 0.88; } 80% { opacity: 0.7; } 100% { opacity: 0; transform: translateX(130%) rotate(var(--beam-tilt, 0deg)); } }
              @keyframes lobby-screen-confetti-fall { 0% { opacity: 0; transform: translate3d(0, -12vh, 0) rotate(0deg) scale(0.8); } 12% { opacity: 0.95; } 100% { opacity: 0; transform: translate3d(var(--fall-sway, 0px), 108vh, 0) rotate(var(--fall-rot, 80deg)) scale(1.04); } }
              @keyframes lobby-link-pulse { 0% { stroke-dashoffset: 22; } 100% { stroke-dashoffset: 0; } }
              @keyframes lobby-link-node-pop { 0%, 100% { transform: scale(0.86); opacity: 0.8; } 50% { transform: scale(1.38); opacity: 1; } }
              @keyframes lobby-orb-float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
              @keyframes lobby-orb-glow { 0%, 100% { filter: drop-shadow(0 0 18px rgba(45,212,191,0.56)); } 50% { filter: drop-shadow(0 0 38px rgba(236,72,153,0.64)); } }
              @keyframes lobby-orb-relay-thrum { 0%, 100% { transform: scale(1); } 35% { transform: scale(1.035); } 70% { transform: scale(1.01); } }
              @keyframes lobby-orb-custom-aurora { 0%, 100% { opacity: 0.48; transform: scale(0.92); } 50% { opacity: 0.9; transform: scale(1.08); } }
              @keyframes lobby-orb-custom-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              @keyframes lobby-orb-custom-badge-drift { 0%, 100% { transform: translateY(0px) scale(1); } 50% { transform: translateY(-4px) scale(1.018); } }
              @keyframes lobby-combo-chip-pop { 0% { transform: translateY(8px) scale(0.92); opacity: 0; } 20% { transform: translateY(0) scale(1.02); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
              .tv-takeover-ray-field {
                position: absolute;
                left: 210px;
                top: 50%;
                width: 900px;
                height: 900px;
                border-radius: 9999px;
                transform: translate(-50%, -50%);
                background:
                  repeating-conic-gradient(
                    from 0deg,
                    rgba(255, 103, 182, 0.84) 0deg 10deg,
                    rgba(255, 103, 182, 0.1) 10deg 16deg,
                    rgba(0, 196, 217, 0.82) 16deg 28deg,
                    rgba(0, 196, 217, 0.08) 28deg 36deg
                  );
                -webkit-mask:
                  radial-gradient(circle, transparent 0 var(--ray-inner, 180px), rgba(0,0,0,1) calc(var(--ray-inner, 180px) + 26px) 100%);
                mask:
                  radial-gradient(circle, transparent 0 var(--ray-inner, 180px), rgba(0,0,0,1) calc(var(--ray-inner, 180px) + 26px) 100%);
                mix-blend-mode: screen;
                opacity: 0.6;
                pointer-events: none;
                animation: tv-takeover-ray-spin 56s linear infinite, tv-takeover-ray-pulse 8.4s ease-in-out infinite;
                will-change: transform, opacity;
              }
              .tv-takeover-ray-field-alt {
                width: 700px;
                height: 700px;
                opacity: 0.38;
                filter: blur(4px);
                animation-duration: 72s, 10.5s;
                animation-direction: reverse, normal;
              }
              .tv-takeover-announcement-burst {
                width: 2400px;
                height: 2400px;
                opacity: 0.44;
                filter: blur(8px);
                animation-duration: 92s;
                z-index: 0;
              }
              .tv-takeover-brand-shell::after {
                content: '';
                position: absolute;
                inset: 18px;
                border-radius: inherit;
                border: 1px solid rgba(255,255,255,0.12);
                box-shadow: inset 0 0 36px rgba(255,255,255,0.08);
                pointer-events: none;
              }
              .tv-takeover-logo {
                animation: tv-takeover-logo-float 5.5s ease-in-out infinite;
                transform-origin: center;
                will-change: transform;
              }
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
              .bonus-drop-moneyline { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 14px; font-size: clamp(2rem, 4vw, 4rem); filter: drop-shadow(0 0 20px rgba(250,204,21,0.3)); }
              .bonus-drop-avatar { display: inline-flex; align-items: center; justify-content: center; min-width: 1.4em; }
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
              .reaction-stack { will-change: transform, opacity; transform-origin: center bottom; }
              .reaction-stack-drift-left { animation: reaction-drift-left var(--reaction-duration, 8600ms) cubic-bezier(0.2, 0.72, 0.22, 1) forwards; }
              .reaction-stack-drift-right { animation: reaction-drift-right var(--reaction-duration, 8600ms) cubic-bezier(0.2, 0.72, 0.22, 1) forwards; }
              .reaction-stack-hover { animation: reaction-hover-burst var(--reaction-duration, 9000ms) ease-out forwards; }
              .reaction-stack-bounce { animation: reaction-bounce-burst var(--reaction-duration, 9000ms) cubic-bezier(0.22, 0.61, 0.36, 1) forwards; }
              .reaction-stack-sweep { animation: reaction-side-sweep var(--reaction-duration, 8200ms) cubic-bezier(0.18, 0.7, 0.22, 1) forwards; }
              .reaction-label { animation: reaction-label-in 0.35s ease-out forwards; }
              .animate-vip-glow { animation: vip-glow 1.2s ease-in-out infinite; }
              .vip-reaction-emoji { animation: vip-jolt 0.6s ease-in-out infinite; filter: drop-shadow(0 0 18px rgba(250, 204, 21, 0.75)); }
              .animate-vip-spin { animation: vip-spin 1.2s linear infinite; }
              .featured-reaction-spotlight { animation: featured-reaction-enter 0.36s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
              .featured-reaction-sheen { animation: featured-reaction-sheen 3s ease-in-out infinite; }
              .featured-reaction-avatar { backdrop-filter: blur(14px); }
              .featured-reaction-emoji { animation: vip-jolt 0.9s ease-in-out infinite; }
              .selfie-grid-sheen { background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.14) 40%, transparent 72%); animation: selfie-grid-sheen 8s ease-in-out infinite; mix-blend-mode: screen; }
              .selfie-wall-card { transition: transform 450ms ease, box-shadow 450ms ease, border-color 450ms ease; }
              .selfie-wall-card-fresh { animation: selfie-card-fresh 2.8s ease-in-out infinite; }
              .selfie-arrival-spotlight { animation: selfie-arrival-enter 0.38s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
              .selfie-arrival-radiance { animation: public-moment-burst 1.25s ease-out both; }
              .selfie-arrival-ring { animation: selfie-arrival-ring 1.3s ease-out both; }
              .selfie-arrival-ring-delayed { animation-delay: 0.18s; }
              .selfie-arrival-spark { animation: selfie-arrival-spark 1.6s ease-in-out infinite; filter: drop-shadow(0 0 14px rgba(255,255,255,0.45)); }
              .selfie-arrival-spark-delayed { animation-delay: 0.25s; }
              .selfie-cam-pulse-ring { animation: selfie-cam-pulse 2.4s ease-out infinite; }
              .selfie-cam-pulse-ring-delayed { animation: selfie-cam-pulse 2.4s ease-out infinite 0.9s; }
              .selfie-flash-burst { background: radial-gradient(circle at center, rgba(255,255,255,0.36), rgba(255,255,255,0.08) 32%, rgba(255,255,255,0) 62%); animation: selfie-flash-burst 0.65s ease-out both; }
              .public-moment-burst { background: radial-gradient(circle at center, rgba(255,255,255,0.18), rgba(34,211,238,0.12) 24%, rgba(236,72,153,0.16) 42%, rgba(255,255,255,0) 70%); animation: public-moment-burst 1.2s ease-out both; }
              .public-moment-radiance { animation: public-moment-burst 1.4s ease-out both; }
              .public-moment-card { animation: public-moment-card-enter 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
              .public-moment-ribbon { animation: public-moment-ribbon 2.2s ease-in-out infinite; }
              .doodle-wall-card { transition: transform 450ms ease, box-shadow 450ms ease, border-color 450ms ease; }
              .doodle-wall-card-fresh { animation: doodle-card-fresh 3.2s ease-in-out infinite; }
              .doodle-arrival-chip { animation: doodle-arrival-chip 0.42s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
              .tv-light-sweep { background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.12) 45%, transparent 80%); animation: tv-sweep 10s ease-in-out infinite; mix-blend-mode: screen; }
              .lobby-burst-anchor { transform: translate(-50%, -50%); }
              .lobby-burst-motion { animation: lobby-burst-rise 3.6s cubic-bezier(0.22, 0.61, 0.36, 1) forwards; }
              .lobby-burst-aura { animation: lobby-aura-pulse 1.2s ease-out forwards; mix-blend-mode: screen; }
              .lobby-burst-particle {
                position: absolute;
                left: 50%;
                top: 50%;
                font-size: clamp(1rem, 2.3vw, 1.5rem);
                filter: drop-shadow(0 0 10px rgba(255,255,255,0.5));
                animation: lobby-particle-pop 1.25s ease-out forwards;
                transform: translate(-50%, -50%);
              }
              .lobby-burst-motion-wave .lobby-burst-card { animation: lobby-wave-card 0.95s ease-in-out 2; }
              .lobby-burst-motion-laser .lobby-burst-card { animation: lobby-laser-card 0.9s ease-out 1; }
              .lobby-burst-motion-echo .lobby-burst-card { animation: lobby-echo-card 1s ease-out 1; }
              .lobby-burst-motion-confetti .lobby-burst-card { animation: lobby-confetti-card 1s ease-out 1; }
              .lobby-screen-wave-ring {
                position: absolute;
                width: var(--wave-size, 260px);
                height: var(--wave-size, 260px);
                border-radius: 9999px;
                border: 4px solid rgba(34,211,238,0.6);
                box-shadow: 0 0 26px rgba(34,211,238,0.45), inset 0 0 22px rgba(56,189,248,0.35);
                animation: lobby-screen-wave-expand 1s ease-out forwards;
              }
              .lobby-screen-echo-ring {
                position: absolute;
                width: var(--echo-size, 240px);
                height: var(--echo-size, 240px);
                border-radius: 9999px;
                border: 3px solid rgba(129,140,248,0.7);
                box-shadow: 0 0 30px rgba(129,140,248,0.48), inset 0 0 24px rgba(96,165,250,0.3);
                animation: lobby-screen-echo-expand 1.15s ease-out forwards;
              }
              .lobby-screen-laser-beam {
                position: absolute;
                left: -25%;
                width: 150%;
                height: 12px;
                border-radius: 9999px;
                background: linear-gradient(90deg, rgba(0,0,0,0), rgba(232,121,249,0.92), rgba(34,211,238,0.92), rgba(0,0,0,0));
                box-shadow: 0 0 24px rgba(232,121,249,0.72), 0 0 42px rgba(34,211,238,0.62);
                animation: lobby-screen-laser-sweep var(--beam-dur, 980ms) ease-out forwards;
                transform-origin: center;
              }
              .lobby-screen-confetti-piece {
                position: absolute;
                top: -10vh;
                font-size: clamp(1rem, 2.4vw, 1.65rem);
                filter: drop-shadow(0 0 8px rgba(255,255,255,0.45));
                animation: lobby-screen-confetti-fall var(--fall-dur, 1700ms) ease-in forwards;
              }
              .lobby-volley-link-glow {
                stroke-linecap: round;
                filter: blur(3px) drop-shadow(0 0 16px rgba(125,211,252,0.62));
              }
              .lobby-volley-link {
                stroke-dasharray: 16 12;
                animation: lobby-link-pulse 0.82s linear infinite;
                filter: drop-shadow(0 0 12px rgba(125,211,252,0.62));
              }
              .lobby-volley-link-node {
                filter: drop-shadow(0 0 12px rgba(134,239,172,0.75));
                animation: lobby-link-node-pop 0.82s ease-out infinite;
              }
              .lobby-volley-ground-line {
                position: absolute;
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: none;
              }
              .lobby-volley-ground-core {
                width: 100%;
                height: 8px;
                border-radius: 9999px;
                border: 1px solid rgba(253, 224, 71, 0.78);
                background: linear-gradient(90deg, rgba(244,114,182,0.24), rgba(250,204,21,0.98), rgba(244,114,182,0.24));
                box-shadow: 0 0 20px rgba(250,204,21,0.58), 0 0 44px rgba(236,72,153,0.3);
                position: relative;
              }
              .lobby-volley-ground-core::before {
                content: '';
                position: absolute;
                left: 0;
                right: 0;
                top: -11px;
                bottom: -11px;
                border-radius: 9999px;
                background: linear-gradient(90deg, rgba(250,204,21,0.2), rgba(253,186,116,0.42), rgba(250,204,21,0.2));
                filter: blur(7px);
                opacity: 0.82;
              }
              .lobby-volley-ground-label {
                position: absolute;
                top: -26px;
                padding: 3px 12px;
                border-radius: 9999px;
                border: 1px solid rgba(253,224,71,0.45);
                background: linear-gradient(180deg, rgba(15,23,42,0.88), rgba(2,6,23,0.78));
                color: rgba(254,243,199,0.95);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.14em;
                text-transform: uppercase;
                box-shadow: 0 0 14px rgba(250,204,21,0.26);
              }
              .lobby-volley-orb-shell {
                --orb-energy-norm: 0.4;
                --lobby-volley-orb-size: 320px;
                --lobby-volley-orb-scale: 0.88;
                --lobby-volley-orb-content-scale: 0.92;
                --lobby-volley-participant-size: 28px;
                width: var(--lobby-volley-orb-size);
                height: var(--lobby-volley-orb-size);
                border-radius: 9999px;
                background:
                  radial-gradient(circle at 24% 16%, rgba(255,255,255,0.95), rgba(255,255,255,0.14) 36%, rgba(0,0,0,0) 56%),
                  radial-gradient(circle at 70% 78%, rgba(7,10,26,0.26), rgba(7,10,26,0.04) 48%, rgba(0,0,0,0) 74%),
                  conic-gradient(
                    from -18deg,
                    rgba(45,212,191,0.98) 0deg 54deg,
                    rgba(226,232,240,0.96) 54deg 63deg,
                    rgba(236,72,153,0.98) 63deg 117deg,
                    rgba(226,232,240,0.96) 117deg 126deg,
                    rgba(45,212,191,0.98) 126deg 180deg,
                    rgba(226,232,240,0.96) 180deg 189deg,
                    rgba(236,72,153,0.98) 189deg 243deg,
                    rgba(226,232,240,0.96) 243deg 252deg,
                    rgba(45,212,191,0.98) 252deg 306deg,
                    rgba(226,232,240,0.96) 306deg 315deg,
                    rgba(236,72,153,0.98) 315deg 360deg
                  );
                border: 2px solid rgba(240,249,255,0.84);
                position: relative;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(6px);
                box-shadow:
                  inset 0 0 30px rgba(255,255,255,0.28),
                  inset 0 -14px 28px rgba(10,15,32,0.34),
                  0 0 calc(36px + (48px * var(--orb-energy-norm))) rgba(45,212,191,0.58),
                  0 0 calc(48px + (54px * var(--orb-energy-norm))) rgba(236,72,153,0.5);
                animation: lobby-orb-float 2.8s ease-in-out infinite, lobby-orb-glow 2.8s ease-in-out infinite;
              }
              .lobby-volley-orb-shell-relay {
                animation:
                  lobby-orb-float 2.2s ease-in-out infinite,
                  lobby-orb-glow 2.2s ease-in-out infinite,
                  lobby-orb-relay-thrum 0.9s ease-in-out infinite;
              }
              .lobby-volley-orb-shell::before {
                content: '';
                position: absolute;
                inset: -13%;
                border-radius: 9999px;
                background: radial-gradient(circle, rgba(45,212,191,0.34) 0%, rgba(236,72,153,0.28) 44%, rgba(226,232,240,0.16) 63%, rgba(0,0,0,0) 75%);
                filter: blur(7px);
                opacity: calc(0.65 + (var(--orb-energy-norm) * 0.35));
                pointer-events: none;
                z-index: 0;
              }
              .lobby-volley-orb-shell::after {
                content: '';
                position: absolute;
                inset: 8% 12% 43% 16%;
                border-radius: 9999px;
                background: radial-gradient(circle at top left, rgba(255,255,255,0.88), rgba(255,255,255,0) 72%);
                opacity: 0.78;
                pointer-events: none;
              }
              .lobby-volley-orb-shell-safe {
                animation-duration: 4.5s;
              }
              .lobby-volley-orb-shell-custom {
                background:
                  radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 48%, rgba(0,0,0,0) 72%),
                  radial-gradient(circle at 50% 112%, rgba(255,57,149,0.2), rgba(255,57,149,0) 44%),
                  linear-gradient(180deg, rgba(12,16,29,0.44), rgba(7,11,20,0.76));
                border-width: 3px;
                border-color: rgba(234,246,255,0.96);
                box-shadow:
                  inset 0 0 26px rgba(255,255,255,0.1),
                  inset 0 -22px 34px rgba(8,10,24,0.3),
                  0 0 calc(54px + (56px * var(--orb-energy-norm))) rgba(55,220,255,0.28),
                  0 0 calc(76px + (72px * var(--orb-energy-norm))) rgba(236,72,153,0.18);
              }
              .lobby-volley-orb-custom-halo {
                position: absolute;
                inset: -10%;
                border-radius: 9999px;
                pointer-events: none;
                mix-blend-mode: screen;
                z-index: 0;
              }
              .lobby-volley-orb-custom-halo-a {
                background: radial-gradient(circle, rgba(103,232,249,0.42) 0%, rgba(103,232,249,0.18) 34%, rgba(0,0,0,0) 72%);
                filter: blur(12px);
                animation: lobby-orb-custom-aurora 2.8s ease-in-out infinite;
              }
              .lobby-volley-orb-custom-halo-b {
                inset: 3%;
                border: 1px solid rgba(255,255,255,0.2);
                border-top-color: rgba(255,213,122,0.9);
                border-right-color: rgba(104,232,255,0.78);
                border-bottom-color: rgba(236,72,153,0.58);
                border-left-color: rgba(255,255,255,0.08);
                opacity: 0.8;
                animation: lobby-orb-custom-spin 10s linear infinite;
              }
              .lobby-volley-orb-custom-progress {
                --orb-progress: 0;
                position: absolute;
                inset: 1.75%;
                border-radius: 9999px;
                padding: 3px;
                background:
                  conic-gradient(
                    from -90deg,
                    rgba(255,205,117,0.98) 0 calc(var(--orb-progress) * 1%),
                    rgba(255,255,255,0.08) calc(var(--orb-progress) * 1%) 100%
                  );
                -webkit-mask:
                  radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
                mask:
                  radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
                opacity: 0.92;
                z-index: 1;
              }
              .lobby-volley-orb-slat-overlay {
                position: absolute;
                inset: 0;
                border-radius: inherit;
                overflow: hidden;
                pointer-events: none;
              }
              .lobby-volley-orb-slat-overlay::before {
                content: '';
                position: absolute;
                inset: -20%;
                background:
                  radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 54%, rgba(255,255,255,0.14) 60%, rgba(255,255,255,0) 68%),
                  conic-gradient(
                    from -10deg,
                    rgba(0,0,0,0) 0deg 56deg,
                    rgba(255,255,255,0.16) 56deg 62deg,
                    rgba(0,0,0,0) 62deg 118deg,
                    rgba(255,255,255,0.16) 118deg 124deg,
                    rgba(0,0,0,0) 124deg 180deg,
                    rgba(255,255,255,0.16) 180deg 186deg,
                    rgba(0,0,0,0) 186deg 242deg,
                    rgba(255,255,255,0.16) 242deg 248deg,
                    rgba(0,0,0,0) 248deg 304deg,
                    rgba(255,255,255,0.16) 304deg 310deg,
                    rgba(0,0,0,0) 310deg 360deg
                  );
                mix-blend-mode: screen;
                transform: rotate(-4deg);
              }
              .lobby-volley-orb-seam {
                position: absolute;
                border-radius: 9999px;
                border: 2.5px solid rgba(241,245,249,0.9);
                box-shadow:
                  0 0 0 1px rgba(8,10,26,0.24),
                  0 0 12px rgba(34,211,238,0.18),
                  0 0 12px rgba(236,72,153,0.18);
                opacity: 0.94;
              }
              .lobby-volley-orb-seam-main {
                width: 66%;
                height: 132%;
                top: -16%;
                left: 17%;
                transform: rotate(9deg);
              }
              .lobby-volley-orb-seam-left {
                width: 90%;
                height: 138%;
                top: -16%;
                left: -60%;
                transform: rotate(-24deg);
              }
              .lobby-volley-orb-seam-right {
                width: 90%;
                height: 138%;
                top: -16%;
                right: -60%;
                transform: rotate(24deg);
              }
              .lobby-volley-orb-seam-band {
                width: 138%;
                height: 68%;
                top: 16%;
                left: -19%;
                transform: rotate(-12deg);
              }
              .lobby-volley-orb-seam-top {
                width: 110%;
                height: 56%;
                top: -28%;
                left: -4%;
                transform: rotate(8deg);
                opacity: 0.7;
              }
              .lobby-volley-orb-seam-bottom {
                width: 112%;
                height: 58%;
                bottom: -30%;
                right: -6%;
                transform: rotate(8deg);
                opacity: 0.66;
              }
              .lobby-volley-orb-core {
                --orb-glow: 0.4;
                --orb-scale: 1;
                width: 62%;
                height: 62%;
                border-radius: 9999px;
                position: relative;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                background: radial-gradient(circle, rgba(25,20,52,0.83), rgba(8,10,30,0.93));
                border: 1px solid rgba(244,114,182,0.62);
                box-shadow:
                  0 0 calc(44px * var(--orb-glow)) rgba(45,212,191,0.62),
                  inset 0 0 24px rgba(236,72,153,0.3);
                transform: scale(var(--orb-scale));
                z-index: 2;
              }
              .lobby-volley-orb-core-custom {
                width: 76%;
                height: 76%;
                background:
                  radial-gradient(circle at 50% 24%, rgba(255,255,255,0.18), rgba(255,255,255,0.03) 34%, rgba(8,12,24,0.18) 62%, rgba(2,6,18,0.42) 100%);
                border-color: rgba(236,253,255,0.26);
                box-shadow:
                  inset 0 0 26px rgba(255,255,255,0.1),
                  0 0 32px rgba(103,232,249,0.18);
                backdrop-filter: blur(12px);
              }
              .lobby-volley-orb-core-skin {
                position: absolute;
                inset: 6%;
                width: 88%;
                height: 88%;
                object-fit: contain;
                z-index: 0;
                filter: saturate(1.14) contrast(1.06);
              }
              .lobby-volley-orb-core-skin-overlay {
                position: absolute;
                inset: 0;
                z-index: 1;
                background:
                  radial-gradient(circle at 22% 18%, rgba(255,255,255,0.32), rgba(255,255,255,0) 48%),
                  linear-gradient(180deg, rgba(2,6,23,0.06), rgba(2,6,23,0.28));
              }
              .lobby-volley-orb-core-content {
                position: relative;
                z-index: 2;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                text-shadow: 0 0 10px rgba(0,0,0,0.45);
                transform: scale(var(--lobby-volley-orb-content-scale));
                transform-origin: center;
              }
              .lobby-volley-orb-custom-badge-wrap {
                position: absolute;
                inset: 5%;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2;
              }
              .lobby-volley-orb-custom-badge-wrap::before {
                content: '';
                position: absolute;
                inset: 2%;
                border-radius: 9999px;
                background:
                  radial-gradient(circle at 50% 38%, rgba(255,255,255,0.3), rgba(255,255,255,0.08) 36%, rgba(0,0,0,0) 68%);
                filter: blur(16px);
                opacity: 0.8;
              }
              .lobby-volley-orb-custom-badge {
                position: relative;
                width: 92%;
                height: 92%;
                object-fit: contain;
                filter:
                  saturate(1.08)
                  contrast(1.04)
                  drop-shadow(0 16px 24px rgba(0,0,0,0.3))
                  drop-shadow(0 0 18px rgba(255,221,153,0.22));
                animation: lobby-orb-custom-badge-drift 3.2s ease-in-out infinite;
              }
              .lobby-volley-orb-ring {
                position: absolute;
                inset: 7%;
                border-radius: 9999px;
                border: 1px solid rgba(15,23,42,0.24);
                overflow: hidden;
                z-index: 1;
              }
              .lobby-volley-orb-ring-fill {
                --orb-fill: 0%;
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                height: var(--orb-fill);
                background: linear-gradient(180deg, rgba(45,212,191,0.92), rgba(236,72,153,0.9));
                transition: height 180ms ease;
              }
              .lobby-volley-orb-activity {
                position: absolute;
                bottom: 9%;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 8px;
                z-index: 3;
              }
              .lobby-volley-participant {
                width: var(--lobby-volley-participant-size);
                height: var(--lobby-volley-participant-size);
                border-radius: 9999px;
                border: 1px solid rgba(255,255,255,0.3);
                background: rgba(2,6,23,0.7);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: calc(var(--lobby-volley-participant-size) * 0.53);
                box-shadow: 0 0 14px rgba(34,211,238,0.16);
              }
              .lobby-combo-chip {
                animation: lobby-combo-chip-pop 0.36s ease-out;
                will-change: transform, opacity;
              }
              .motion-safe-fx .lobby-burst-motion {
                animation-duration: 2.8s;
              }
              .motion-safe-fx .lobby-volley-link {
                animation-duration: 1.6s;
              }
              .motion-safe-fx .lobby-volley-link-node {
                animation: none;
              }
              .motion-safe-fx .lobby-combo-chip {
                animation: none;
              }
            `}</style>
        </div>
    );
};

export default PublicTV;
