import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { 
    db, doc, onSnapshot, setDoc, updateDoc, increment, serverTimestamp, 
    addDoc, collection, query, where, orderBy, limit, deleteDoc, arrayUnion,
    getDoc, getDocs, runTransaction,
    storage, storageRef, uploadBytesResumable, getDownloadURL,
    auth, ensureUserProfile, EmailAuthProvider, linkWithCredential, onAuthStateChanged,
    RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider,
    trackEvent,
    callFunction
} from '../../lib/firebase';
import { APP_ID, ASSETS, STORM_SFX } from '../../lib/assets';
import { emoji, EMOJI } from '../../lib/emoji';
import { BROWSE_CATEGORIES, TOPIC_HITS } from '../../lib/browseLists';
import { HOW_TO_PLAY } from '../../lib/howToPlay';
import { useToast } from '../../context/ToastContext';
import { averageBand } from '../../lib/utils';
import { PARTY_LIGHTS_STYLE, SINGER_APP_CONFIG } from '../../lib/uiConstants';
import { POINTS_PACKS, SUBSCRIPTIONS } from '../../billing/catalog';
import { BILLING_PLATFORMS, createBillingProvider, detectBillingPlatform } from '../../billing/provider';
import { ensureSong, ensureTrack, extractYouTubeId } from '../../lib/songCatalog';
import { normalizeBackingChoice, resolveStageMediaUrl } from '../../lib/playbackSource';
import GameContainer from '../../components/GameContainer';
import AppleLyricsRenderer from '../../components/AppleLyricsRenderer';
import { FameLevelProgressBar } from '../../components/FameLevelBadge';
import UserMetaCard from '../../components/UserMetaCard';
import { FAME_LEVELS, getLevelFromFame, getProgressToNextLevel } from '../../lib/fameConstants';
import { REACTION_COSTS } from '../../lib/reactionConstants';
import groupChatMessages from '../../lib/chatGrouping';
import {
    DEFAULT_POP_TRIVIA_ROUND_SEC,
    POP_TRIVIA_VOTE_TYPE,
    dedupeQuestionVotes,
    getActivePopTriviaQuestion
} from '../../lib/popTrivia';

// Helper Component for Animated Points
const AnimatedPoints = ({ value, onClick, className = '' }) => {
    const [display, setDisplay] = useState(value);

    useEffect(() => {
        if (display === value) return;
        const interval = setInterval(() => {
            setDisplay(prev => {
                const diff = value - prev;
                if (diff === 0) { clearInterval(interval); return value; }
                return prev + Math.ceil(diff / 5);
            });
        }, 30);
        return () => clearInterval(interval);
    }, [display, value]);

    return (
        <button onClick={onClick} className={`bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full border border-cyan-500/30 flex items-center gap-2 shadow-lg active:scale-95 transition-transform z-50 points-hint h-11 w-[120px] sm:w-[132px] justify-between ${className}`}>
            <span className="text-cyan-300 font-black text-xl font-mono">{display}</span>
            <span className="text-[11px] text-cyan-300 font-bold">PTS</span>
            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[12px] font-black relative overflow-hidden">
                <span className="absolute inset-0 flex items-center justify-center points-hint-i">i</span>
                <span className="absolute inset-0 flex items-center justify-center points-hint-plus">+</span>
            </div>
        </button>
    );
};

const DEFAULT_EMOJI = emoji(0x1F600);
const BRAND_ICON = 'https://beauross.com/wp-content/uploads/beaurocks-karaoke-logo-2.png';
const MOBILE_THEME_COLOR = '#7a2b76';
const MOBILE_APP_BG = '#090612';
const MOBILE_NAV_GRADIENT = 'linear-gradient(90deg, #4b1436 0%, #3a1b5c 52%, #15899a 100%)';
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

const VIP_TOS_SUMMARY = [
    'Keep it fun: no harassment, threats, hate speech, or illegal content.',
    'Only share content you own or have permission to use.',
    'We can remove content that breaks the rules or disrupts the party.',
    'VIP SMS alerts are optional and you can opt out any time.'
];

const VIP_BIRTH_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const VIP_BIRTH_DAYS = Array.from({ length: 31 }, (_, i) => `${i + 1}`);

const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
});

const normalizeVipForm = (vip = {}) => ({
    location: (vip.location || '').trim(),
    birthMonth: (vip.birthMonth || '').trim(),
    birthDay: (vip.birthDay || '').trim(),
    smsOptIn: !!vip.smsOptIn,
    tosAccepted: !!vip.tosAccepted
});

const getVipProfileValidationError = (vip = {}) => {
    const normalized = normalizeVipForm(vip);
    if (!normalized.location) return 'Add your location to complete VIP profile.';
    if (!normalized.birthMonth || !normalized.birthDay) return 'Add your birthday month and day to complete VIP profile.';
    if (!normalized.tosAccepted) return 'Please accept the VIP House Rules.';
    return '';
};

const isVipEntity = (entity = {}) => !!entity?.isVip || (Number(entity?.vipLevel || 0) > 0);

const getFameSnapshot = (entity = {}, fallbackTotal = 0) => {
    const hasRawLevel = typeof entity?.fameLevel === 'number';
    const rawTotal = Number(entity?.totalFamePoints);
    let total = Number.isFinite(rawTotal) ? rawTotal : Number(fallbackTotal || 0);
    if (!Number.isFinite(total)) total = 0;
    const level = hasRawLevel
        ? Math.max(0, Math.min(20, entity.fameLevel))
        : getLevelFromFame(total);
    if (!Number.isFinite(rawTotal) && hasRawLevel) {
        total = Math.max(total, FAME_LEVELS?.[level]?.minFame || 0);
    }
    return {
        level,
        total,
        levelName: FAME_LEVELS?.[level]?.name || 'Rising Star',
        progressToNext: getProgressToNextLevel(total, level)
    };
};

const getNextFameUnlockSnapshot = (totalFame = 0, currentLevel = 0) => {
    const safeTotal = Number.isFinite(Number(totalFame)) ? Math.max(0, Math.floor(Number(totalFame))) : 0;
    const safeLevel = Number.isFinite(Number(currentLevel)) ? Math.max(0, Math.min(20, Math.floor(Number(currentLevel)))) : 0;
    for (let level = safeLevel + 1; level <= 20; level += 1) {
        const levelData = FAME_LEVELS?.[level];
        if (!levelData) continue;
        const unlockLabel = String(levelData.unlock || levelData.reward || '').trim();
        if (!unlockLabel) continue;
        const targetFame = Number(levelData.minFame || 0);
        return {
            level,
            unlockLabel,
            targetFame,
            pointsNeeded: Math.max(0, targetFame - safeTotal)
        };
    }
    return null;
};

const AVATAR_CATALOG = [
    { id: 'smile', emoji: emoji(0x1F600), label: 'Smile', flavor: 'Easy crowd-pleaser.', unlock: { type: 'free' } },
    { id: 'cool', emoji: emoji(0x1F60E), label: 'Cool', flavor: 'Smooth and steady.', unlock: { type: 'free' } },
    { id: 'cowboy', emoji: emoji(0x1F920), label: 'Cowboy', flavor: 'Boots on, mic up.', unlock: { type: 'free' } },
    { id: 'alien', emoji: emoji(0x1F47D), label: 'Alien', flavor: 'Out-of-this-world.', unlock: { type: 'free' } },
    { id: 'robot', emoji: emoji(0x1F916), label: 'Robot', flavor: 'Auto-tune ready.', unlock: { type: 'free' } },
    { id: 'ghost', emoji: emoji(0x1F47B), label: 'Ghost', flavor: 'Spooky harmonies.', unlock: { type: 'free' } },
    { id: 'unicorn', emoji: emoji(0x1F984), label: 'Unicorn', flavor: 'Rare vocal magic.', unlock: { type: 'free' } },
    { id: 'tiger', emoji: emoji(0x1F42F), label: 'Tiger', flavor: 'Full stage energy.', unlock: { type: 'free' } },
    { id: 'dog', emoji: emoji(0x1F436), label: 'Dog', flavor: 'Loyal to the chorus.', unlock: { type: 'free' } },
    { id: 'mic', emoji: emoji(0x1F3A4), label: 'Mic', flavor: 'Ready for the spotlight.', unlock: { type: 'free' } },
    { id: 'headphones', emoji: emoji(0x1F3A7), label: 'Headphones', flavor: 'Locked in focus.', unlock: { type: 'free' } },
    { id: 'notes', emoji: emoji(0x1F3B6), label: 'Notes', flavor: 'Melody first.', unlock: { type: 'free' } },
    { id: 'piano', emoji: emoji(0x1F3B9), label: 'Piano', flavor: 'Soft keys, big feels.', unlock: { type: 'free' } },
    { id: 'drums', emoji: emoji(0x1F941), label: 'Drums', flavor: 'Pure rhythm power.', unlock: { type: 'free' } },
    { id: 'sax', emoji: emoji(0x1F3B7), label: 'Sax', flavor: 'Smooth and bold.', unlock: { type: 'free' } },
    { id: 'trumpet', emoji: emoji(0x1F3BA), label: 'Trumpet', flavor: 'Bright and loud.', unlock: { type: 'free' } },
    { id: 'cat', emoji: emoji(0x1F431), label: 'Cat', flavor: 'Sneaky harmony.', unlock: { type: 'fame', level: 2 } },
    { id: 'panda', emoji: emoji(0x1F43C), label: 'Panda', flavor: 'Soft but powerful.', unlock: { type: 'fame', level: 2 } },
    { id: 'penguin', emoji: emoji(0x1F427), label: 'Penguin', flavor: 'Cool tempo.', unlock: { type: 'fame', level: 3 } },
    { id: 'owl', emoji: emoji(0x1F989), label: 'Owl', flavor: 'Late-night legend.', unlock: { type: 'fame', level: 3 } },
    { id: 'raccoon', emoji: emoji(0x1F99D), label: 'Raccoon', flavor: 'Mischief on mic.', unlock: { type: 'fame', level: 4 } },
    { id: 'dolphin', emoji: emoji(0x1F42C), label: 'Dolphin', flavor: 'Bright hooks.', unlock: { type: 'fame', level: 4 } },
    { id: 'octopus', emoji: emoji(0x1F419), label: 'Octopus', flavor: 'Multi-genre magic.', unlock: { type: 'fame', level: 5 } },
    { id: 'whale', emoji: emoji(0x1F433), label: 'Whale', flavor: 'Deep power.', unlock: { type: 'fame', level: 5 } },
    { id: 'shark', emoji: emoji(0x1F988), label: 'Shark', flavor: 'Stage hunter.', unlock: { type: 'fame', level: 6 } },
    { id: 'fox', emoji: emoji(0x1F98A), label: 'Fox', flavor: 'Clever and quick.', unlock: { type: 'points', cost: 60 } },
    { id: 'bear', emoji: emoji(0x1F43B), label: 'Bear', flavor: 'Big voice energy.', unlock: { type: 'points', cost: 60 } },
    { id: 'koala', emoji: emoji(0x1F428), label: 'Koala', flavor: 'Chill until chorus.', unlock: { type: 'points', cost: 70 } },
    { id: 'lion', emoji: emoji(0x1F981), label: 'Lion', flavor: 'Own the stage.', unlock: { type: 'points', cost: 80 } },
    { id: 'sparkles', emoji: emoji(0x2728), label: 'Sparkles', flavor: 'Shine on cue.', unlock: { type: 'points', cost: 100 } },
    { id: 'star', emoji: emoji(0x2B50), label: 'Star', flavor: 'Main stage glow.', unlock: { type: 'points', cost: 150 } },
    { id: 'party', emoji: emoji(0x1F389), label: 'Party Popper', flavor: 'Confetti chorus.', unlock: { type: 'points', cost: 120 } },
    { id: 'sparkheart', emoji: emoji(0x1F496), label: 'Spark Heart', flavor: 'Crowd favorite.', unlock: { type: 'points', cost: 180 } },
    { id: 'rainbow', emoji: emoji(0x1F308), label: 'Rainbow', flavor: 'Bright refrains.', unlock: { type: 'points', cost: 220 } },
    { id: 'dragon', emoji: emoji(0x1F409), label: 'Dragon', flavor: 'Fire-breath hook.', unlock: { type: 'points', cost: 200 } },
    { id: 'phoenix', emoji: emoji(0x1F986), label: 'Phoenix', flavor: 'Rise for the chorus.', unlock: { type: 'points', cost: 250 } },
    { id: 'twilight_bat', emoji: emoji(0x1F987), label: 'Bat', flavor: 'Echo power.', unlock: { type: 'points', cost: 100 } },
    { id: 'twilight_apple', emoji: emoji(0x1F34E), label: 'Apple', flavor: 'Forbidden spotlight.', unlock: { type: 'points', cost: 150 } },
    { id: 'twilight_moon', emoji: emoji(0x1F319), label: 'Moon', flavor: 'Late night glow.', unlock: { type: 'points', cost: 200 } },
    { id: 'twilight_fullmoon', emoji: emoji(0x1F315), label: 'Full Moon', flavor: 'Peak night vibes.', unlock: { type: 'points', cost: 300 } },
    { id: 'twilight_wolf', emoji: emoji(0x1F43A), label: 'Wolf', flavor: 'Howl on the hook.', unlock: { type: 'first_performance' } },
    { id: 'twilight_book', emoji: emoji(0x1F4DA), label: 'Twilight', flavor: 'Storybook legend.', unlock: { type: 'first_performance' } },
    { id: 'rocket', emoji: emoji(0x1F680), label: 'Rocket', flavor: 'Lift-off vocals.', unlock: { type: 'first_performance' } },
    { id: 'guitar_glow', emoji: emoji(0x1F3B8), label: 'Neon Guitar', flavor: 'Guitar solo MVP.', unlock: { type: 'guitar_winner' } },
    { id: 'twilight_vamp_f', emoji: emoji(0x1F9DB, 0x200D, 0x2640, 0xFE0F), label: 'Vampire', flavor: 'Midnight vocals.', unlock: { type: 'vip' } },
    { id: 'twilight_vamp_m', emoji: emoji(0x1F9DB, 0x200D, 0x2642, 0xFE0F), label: 'Vampire', flavor: 'Night shift crooner.', unlock: { type: 'vip' } },
    { id: 'twilight_sparkle', emoji: emoji(0x1F48E), label: 'Sparkle', flavor: 'VIP shine.', unlock: { type: 'vip' } },
    { id: 'crown', emoji: emoji(0x1F451), label: 'Crown', flavor: 'Royal ad-lib.', unlock: { type: 'vip' } },
    { id: 'moonface', emoji: emoji(0x1F31A), label: 'Moon Face', flavor: 'Night set glow.', unlock: { type: 'vip' } }
];

const AvatarCoverflow = ({ items, value, onSelect, getStatus, loop = true, edgePadding }) => {
    const listRef = useRef(null);
    const [itemSize, setItemSize] = useState(108);
    const [containerWidth, setContainerWidth] = useState(0);
    const itemWidth = itemSize;
    const itemGap = 14;
    const stride = itemWidth + itemGap;
    const listWidth = items.length * stride - itemGap;
    const looped = loop ? [...items, ...items, ...items] : items;
    const [showArrows, setShowArrows] = useState(false);
    const visibleWidth = Math.round(itemWidth * 3.5 + itemGap * 3);
    const sidePad = typeof edgePadding === 'number'
        ? edgePadding
        : edgePadding === 'center'
            ? Math.max(0, ((containerWidth || visibleWidth) - itemWidth) / 2)
            : Math.max(0, (visibleWidth - itemWidth) / 2);
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollRafRef = useRef(null);
    const scrollToIndex = (idx, behavior = 'smooth') => {
        const el = listRef.current;
        if (!el || idx < 0) return;
        if (!loop) {
            const item = items[idx];
            const targetEl = item ? el.querySelector(`[data-emoji-id="${item.id}"]`) : null;
            if (targetEl) {
                const width = el.clientWidth || visibleWidth;
                const maxScroll = Math.max(0, el.scrollWidth - width);
                const target = targetEl.offsetLeft + targetEl.offsetWidth / 2 - width / 2;
                const clamped = Math.min(maxScroll, Math.max(0, target));
                el.scrollTo({ left: clamped, behavior });
            }
            return;
        }
        const width = Math.min(el.clientWidth || visibleWidth, visibleWidth);
        const base = loop ? listWidth : 0;
        let target = base + (idx * stride) - (width / 2 - itemWidth / 2);
        if (!loop) {
            const maxScroll = Math.max(0, listWidth - width);
            target = Math.min(maxScroll, Math.max(0, target));
        }
        el.scrollTo({ left: target, behavior });
    };
    const scrollToSelected = (behavior = 'auto') => {
        const el = listRef.current;
        if (!el) return;
        const idx = items.findIndex(item => item.emoji === value);
        if (idx < 0) return;
        if (!loop) {
            const item = items[idx];
            const targetEl = item ? el.querySelector(`[data-emoji-id="${item.id}"]`) : null;
            if (targetEl) {
                const width = el.clientWidth || visibleWidth;
                const maxScroll = Math.max(0, el.scrollWidth - width);
                const target = targetEl.offsetLeft + targetEl.offsetWidth / 2 - width / 2;
                const clamped = Math.min(maxScroll, Math.max(0, target));
                el.scrollTo({ left: clamped, behavior });
            }
            return;
        }
        const width = Math.min(el.clientWidth || visibleWidth, visibleWidth);
        const base = loop ? listWidth : 0;
        let target = base + (idx * stride) - (width / 2 - itemWidth / 2);
        if (!loop) {
            const maxScroll = Math.max(0, listWidth - width);
            target = Math.min(maxScroll, Math.max(0, target));
        }
        el.scrollTo({ left: target, behavior });
    };

    useEffect(() => {
        if (!listRef.current) return;
        if (loop) {
            listRef.current.scrollLeft = listWidth;
        }
        const raf = requestAnimationFrame(() => scrollToSelected());
        return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listWidth, loop]);

    useEffect(() => {
        const el = listRef.current;
        if (!el) return;
        const raf = requestAnimationFrame(() => scrollToSelected());
        const timeout = setTimeout(() => scrollToSelected(), 80);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(timeout);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, itemWidth, itemGap, listWidth, items]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(pointer: coarse)');
        const update = () => setShowArrows(!mq.matches);
        update();
        if (mq.addEventListener) mq.addEventListener('change', update);
        return () => {
            if (mq.removeEventListener) mq.removeEventListener('change', update);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const updateSize = () => {
            const available = Math.max(280, window.innerWidth - 96);
            const next = Math.max(86, Math.min(108, Math.floor(available / 3.5)));
            setItemSize(next);
            if (listRef.current) {
                setContainerWidth(listRef.current.clientWidth || window.innerWidth);
            } else {
                setContainerWidth(window.innerWidth);
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const handleScroll = () => {
        const el = listRef.current;
        if (!el) return;
        if (loop) {
            if (el.scrollLeft < listWidth * 0.5) el.scrollLeft += listWidth;
            if (el.scrollLeft > listWidth * 1.5) el.scrollLeft -= listWidth;
        }
        if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = requestAnimationFrame(() => {
            const stride = itemWidth + itemGap;
            const center = el.scrollLeft + el.clientWidth / 2 - (loop ? 0 : sidePad);
            const rawIndex = Math.round((center - itemWidth / 2) / stride);
            const normalized = ((rawIndex % looped.length) + looped.length) % looped.length;
            setActiveIndex(normalized);
        });
    };
    const scrollByDir = (dir) => {
        const el = listRef.current;
        if (!el) return;
        const step = (itemWidth + itemGap) * 2;
        el.scrollBy({ left: dir * step, behavior: 'smooth' });
    };

    return (
        <div className="w-full relative mx-auto overflow-visible" style={{ maxWidth: '100%', width: '100%' }}>
            {showArrows && (
                <>
                    <button type="button" onClick={() => scrollByDir(-1)} className="emoji-nav-btn left-2" aria-label="Scroll left">
                        <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <button type="button" onClick={() => scrollByDir(1)} className="emoji-nav-btn right-2" aria-label="Scroll right">
                        <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </>
            )}
            <div
                ref={listRef}
                onScroll={handleScroll}
                className="flex gap-4 overflow-x-auto overflow-y-visible snap-x snap-proximity scroll-smooth emoji-carousel py-4"
                style={{
                    paddingLeft: sidePad,
                    paddingRight: sidePad,
                    scrollPaddingLeft: sidePad,
                    scrollPaddingRight: sidePad
                }}
            >
                {looped.map((item, idx) => {
                    const status = getStatus(item);
                    const isSelected = value === item.emoji;
                    const isLockedSelected = isSelected && status.locked;
                    const glowClass = item.id === 'guitar_glow' ? 'drop-shadow-[0_0_18px_rgba(0,196,217,0.9)]' : '';
                    const delta = Math.abs(idx - activeIndex);
                    const dist = Math.min(delta, looped.length - delta);
                    const scale = dist === 0 ? 1.18 : dist === 1 ? 1.08 : 1;
                    const opacity = dist <= 2 ? 1 : 0.7;
                    return (
                        <button
                            key={`${item.id}-${idx}`}
                            onClick={() => {
                                onSelect(item, status);
                                const baseIdx = items.findIndex(entry => entry.id === item.id);
                                scrollToIndex(baseIdx);
                            }}
                            data-emoji-id={item.id}
                            className={`relative snap-center flex-shrink-0 rounded-3xl border ${
                                isSelected
                                    ? (isLockedSelected
                                        ? 'border-zinc-500 bg-zinc-800/70 shadow-[0_0_20px_rgba(113,113,122,0.45)] ring-4 ring-zinc-500/40'
                                        : 'border-[#00C4D9] bg-zinc-800 shadow-[0_0_28px_rgba(0,196,217,0.6)] ring-4 ring-[#00C4D9]/45')
                                    : 'border-zinc-700 bg-zinc-900/60'
                            } transition-all duration-300 ease-out`}
                            style={{ width: itemWidth, height: itemWidth, transform: `translateZ(0) scale(${scale})`, opacity, willChange: 'transform', backfaceVisibility: 'hidden' }}
                        >
                            {isSelected && !isLockedSelected ? (
                                <span className="absolute -inset-2 rounded-[28px] bg-[#00C4D9]/20 blur-lg -z-10"></span>
                            ) : null}
                            <div className={`font-emoji ${glowClass} ${status.locked ? 'opacity-40' : 'opacity-100'} select-none`} style={{ fontSize: Math.round(itemWidth * 0.55), transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}>{item.emoji}</div>
                            {status.locked && (
                                <div className="absolute inset-0 bg-black/60 rounded-3xl flex items-center justify-center text-xs text-zinc-300 font-bold">
                                    LOCKED
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const SingerApp = ({ roomCode, uid }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [allUsers, setAllUsers] = useState([]); // For Leaderboard
    const [room, setRoom] = useState(null);
    const [songs, setSongs] = useState([]);
    const [tab, setTab] = useState('home');
    const currentSinger = useMemo(() => songs.find(s => s.status === 'performing'), [songs]);
    const isAnon = !!auth?.currentUser?.isAnonymous;
    const isVipAccount = !!user?.isVip || !!profile?.isVip || (profile?.vipLevel || 0) > 0;
    const [songsTab, setSongsTab] = useState('requests');
    const [socialTab, setSocialTab] = useState('lounge'); // Sub-tab for Social
    const [profileSubTab, setProfileSubTab] = useState('overview');
    const [leaderboardMode, _setLeaderboardMode] = useState('performances');
    const [browseFilter, setBrowseFilter] = useState('');
    const [showTop100, setShowTop100] = useState(false);
    const [top100Art, setTop100Art] = useState({});
    const [top100ArtLoading, setTop100ArtLoading] = useState({});
    const [ytIndex, setYtIndex] = useState([]);
    const [showYtIndex, setShowYtIndex] = useState(false);
    const [ytIndexFilter, setYtIndexFilter] = useState('');
    const [_showLogoTitle, setShowLogoTitle] = useState(true);
    const [authReadyUid, setAuthReadyUid] = useState(null);
    const leaderboardModes = [
        { key: 'performances', label: 'Performances', unit: 'PERF', getValue: (u) => u.performances },
        { key: 'totalEmojis', label: 'Emojis Sent', unit: 'EMOJIS', getValue: (u) => u.totalEmojis },
        { key: 'loudest', label: 'Loudest dB', unit: 'dB', getValue: (u) => u.loudest },
        { key: 'totalPoints', label: 'Total Points', unit: 'PTS', getValue: (u) => u.totalPoints },
    ];
    const leaderboardStats = useMemo(() => {
        const stats = new Map();
        allUsers.forEach(u => {
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
            const matched = allUsers.find(u => u.uid === s.singerUid || u.name === s.singerName);
            const key = matched?.uid || s.singerUid || s.singerName;
            if (!stats.has(key)) {
                stats.set(key, {
                    uid: key,
                    name: s.singerName,
                    avatar: s.emoji || DEFAULT_EMOJI,
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
    }, [allUsers, songs]);
    const activeLeaderboardMode = leaderboardModes.find(m => m.key === leaderboardMode) || leaderboardModes[0];

    // Form state for profile editing
    const [form, setForm] = useState({ name: '', emoji: DEFAULT_EMOJI, song: '', artist: '', art: '', backingUrl: '' });
    const NAME_LIMIT = 18;
    const clampName = (value) => value.slice(0, NAME_LIMIT);
    const getRoomUserProjection = useMemo(() => {
        return (overrides = {}) => {
            const rawName = overrides.name ?? user?.name ?? form.name ?? 'Guest';
            const safeName = clampName(String(rawName || '').trim()) || 'Guest';
            const safeAvatar = overrides.avatar ?? user?.avatar ?? form.emoji ?? DEFAULT_EMOJI;
            const rawTotalFame = Number(overrides.totalFamePoints ?? profile?.totalFamePoints ?? 0);
            const totalFamePoints = Number.isFinite(rawTotalFame) ? Math.max(0, Math.floor(rawTotalFame)) : 0;
            const rawFameLevel = overrides.fameLevel ?? profile?.currentLevel;
            const fameLevel = typeof rawFameLevel === 'number'
                ? Math.max(0, Math.min(20, rawFameLevel))
                : getLevelFromFame(totalFamePoints);
            const rawVipLevel = Number(overrides.vipLevel ?? profile?.vipLevel ?? (isVipAccount ? 1 : 0));
            const vipLevel = Number.isFinite(rawVipLevel) ? Math.max(0, Math.floor(rawVipLevel)) : 0;
            const projection = {
                uid,
                roomCode,
                name: safeName,
                avatar: safeAvatar || DEFAULT_EMOJI,
                isVip: !!(overrides.isVip ?? isVipAccount),
                vipLevel,
                fameLevel,
                totalFamePoints,
                lastActiveAt: serverTimestamp()
            };
            if (overrides.phone !== undefined) {
                projection.phone = overrides.phone || '';
            }
            if (overrides.totalEmojis !== undefined) {
                projection.totalEmojis = Math.max(0, Number(overrides.totalEmojis) || 0);
            }
            if (overrides.points !== undefined) {
                projection.points = Math.max(0, Number(overrides.points) || 0);
            }
            if (overrides.lastSeen) {
                projection.lastSeen = serverTimestamp();
            }
            return projection;
        };
    }, [uid, roomCode, user?.name, user?.avatar, form.name, form.emoji, profile?.totalFamePoints, profile?.currentLevel, profile?.vipLevel, isVipAccount]);
    
    // UI State
    const [searchQ, setSearchQ] = useState('');
    const [results, setResults] = useState([]);
    const [tight15SearchQ, setTight15SearchQ] = useState('');
    const [tight15Results, setTight15Results] = useState([]);
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const tight15TouchRef = useRef(null);
    const tight15InputRef = useRef(null);
    const tight15SectionRef = useRef(null);
    const tight15MigrationDoneRef = useRef('');
    const [showProfile, setShowProfile] = useState(false);
    const [showAccount, setShowAccount] = useState(false);
    const [showPoints, setShowPoints] = useState(false);
    const [showPointsShop, setShowPointsShop] = useState(false);
    const [showHowToPlay, setShowHowToPlay] = useState(false);
    const [howToPlayIndex, setHowToPlayIndex] = useState(0);
    const howToPlayTouchStart = useRef(null);
    const [showBingoOverlay, setShowBingoOverlay] = useState(true);
    const [pendingBingoSuggest, setPendingBingoSuggest] = useState(null);
    const [bingoSuggestNote, setBingoSuggestNote] = useState('');
    const [bingoRngNow, setBingoRngNow] = useState(Date.now());
    const [popTriviaNow, setPopTriviaNow] = useState(Date.now());
    const [popTriviaVotes, setPopTriviaVotes] = useState([]);
    const [popTriviaSubmitting, setPopTriviaSubmitting] = useState(false);

    // Phone/SMS VIP state
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [smsSent, setSmsSent] = useState(false);
    const [verificationId, setVerificationId] = useState(null);
    const [smsCode, setSmsCode] = useState('');
    const [phoneLoading, setPhoneLoading] = useState(false);
    const [smsBypassEnabled, setSmsBypassEnabled] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [showFeedbackForm, setShowFeedbackForm] = useState(false);
    const [feedbackSending, setFeedbackSending] = useState(false);
    const [feedbackForm, setFeedbackForm] = useState({
        vibeScore: 3,
        readabilityScore: 3,
        vibeEmoji: '',
        moment: '',
        momentOther: '',
        fix: '',
        fixOther: '',
        fixNote: '',
        extra: ''
    });
    const [showFameLevels, setShowFameLevels] = useState(false);
    const [showVipOnboarding, setShowVipOnboarding] = useState(false);
    const [vipForm, setVipForm] = useState({
        location: '',
        birthMonth: '',
        birthDay: '',
        smsOptIn: false,
        tosAccepted: false
    });
    const [publicProfileOpen, setPublicProfileOpen] = useState(false);
    const [publicProfileLoading, setPublicProfileLoading] = useState(false);
    const [publicProfileUser, setPublicProfileUser] = useState(null);
    const [publicProfileData, setPublicProfileData] = useState(null);
    const [returningProfile, setReturningProfile] = useState(null);
    const [showReturningPrompt, setShowReturningPrompt] = useState(true);
    const [showRejoinModal, setShowRejoinModal] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [pendingJoin, setPendingJoin] = useState(null);
    const openVipUpgrade = () => setShowPhoneModal(true);
    const [nameFocused, setNameFocused] = useState(false);
    const joinContainerRef = useRef(null);
    const joinRayStageRef = useRef(null);
    const joinLogoRef = useRef(null);
    const [joinRayPos, setJoinRayPos] = useState({ x: '50%', y: '30%' });

    const [localReactions, setLocalReactions] = useState([]);
    const [composedPhoto, setComposedPhoto] = useState(null);
    const [dismissedPhotoTs, setDismissedPhotoTs] = useState(0);
    const [isComposing, setIsComposing] = useState(false);
    const [selfieSubmissions, setSelfieSubmissions] = useState([]);
    const [selfieVotes, setSelfieVotes] = useState([]);
    const [mySelfieVote, setMySelfieVote] = useState(null);
    const [guitarVictoryOpen, setGuitarVictoryOpen] = useState(false);
    const [guitarVictoryInfo, setGuitarVictoryInfo] = useState(null);
    const [strobeVictoryOpen, setStrobeVictoryOpen] = useState(false);
    const [strobeVictoryInfo, setStrobeVictoryInfo] = useState(null);
    const [strobeNow, setStrobeNow] = useState(Date.now());
    const [strobeLocalTaps, setStrobeLocalTaps] = useState(0);
    const [strobeMeter, setStrobeMeter] = useState(0);
    const [doodleNow, setDoodleNow] = useState(Date.now());
    const [doodleSubmissions, setDoodleSubmissions] = useState([]);
    const [doodleVotes, setDoodleVotes] = useState([]);
    const [doodleMyVote, setDoodleMyVote] = useState(null);
    const [doodleSubmitted, setDoodleSubmitted] = useState(false);
    const [doodleBrush, setDoodleBrush] = useState(6);
    const [doodleColor, setDoodleColor] = useState('#00C4D9');
    const [doodleEraser, setDoodleEraser] = useState(false);
    const doodleCanvasRef = useRef(null);
    const doodleDrawingRef = useRef(false);
    const doodleDirtyRef = useRef(false);
    const doodleLastPointRef = useRef(null);
    const [viewLyrics, setViewLyrics] = useState(false);
    const [inlineLyrics, setInlineLyrics] = useState(false);
    const [showAllLyrics, setShowAllLyrics] = useState(true);
    const [dismissedHostLyrics, setDismissedHostLyrics] = useState(false);
    const [showAudienceVideo, setShowAudienceVideo] = useState(false);
    const [showAudienceVideoFullscreen, setShowAudienceVideoFullscreen] = useState(false);
    const [isFormInitialized, setIsFormInitialized] = useState(false);
    const [cooldownFlash, setCooldownFlash] = useState(false);
    const [stormPhase, setStormPhase] = useState('off');
    const [stormJoined, setStormJoined] = useState(false);
    const [stormFlash, setStormFlash] = useState(false);
    const [localPointOffset, setLocalPointOffset] = useState(0);
    const [readyTimer, setReadyTimer] = useState(0);
    const [activeBrowseList, setActiveBrowseList] = useState(null);
    const stormAudioRef = useRef(null);
    const stormAudioCtxRef = useRef(null);
    const stormAnalyserRef = useRef(null);
    const stormSourceRef = useRef(null);
    const stormRafRef = useRef(null);
    const stormFlashCooldownRef = useRef(0);
    const stormThunderRefs = useRef([]);
    const lastHowToPlayId = useRef(null);
    const stormFlashTimerRef = useRef(null);
    const stormFlashTimeoutRef = useRef(null);
    const readyCheckStartRef = useRef(null);
    const strobeWinSeenRef = useRef(null);

    const vipProfileData = profile?.vipProfile || {};
    const vipTosAccepted = !!vipProfileData?.tosAccepted;
    const vipProfileComplete = useMemo(() => {
        if (!isVipAccount) return true;
        const err = getVipProfileValidationError({
            location: vipProfileData?.location || '',
            birthMonth: vipProfileData?.birthMonth || '',
            birthDay: vipProfileData?.birthDay || '',
            tosAccepted: !!vipProfileData?.tosAccepted
        });
        return !err;
    }, [isVipAccount, vipProfileData?.location, vipProfileData?.birthMonth, vipProfileData?.birthDay, vipProfileData?.tosAccepted]);
    const _vipCount = useMemo(() => allUsers.filter(u => u.isVip || (u.vipLevel || 0) > 0).length, [allUsers]);
    const chatLocked = !!room?.chatEnabled && room?.chatAudienceMode === 'vip' && !isVipAccount;
    const tipCrates = useMemo(() => (Array.isArray(room?.tipCrates) ? room.tipCrates : []), [room?.tipCrates]);
    const showBallad = room?.lightMode === 'ballad';
    const showBanger = room?.lightMode === 'banger';
    const motionSafeFx = !!room?.reduceMotionFx;

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const rootEl = document.documentElement;
        const bodyEl = document.body;
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        const msTileMeta = document.querySelector('meta[name="msapplication-TileColor"]');
        const previousThemeColor = themeMeta?.getAttribute('content') ?? '';
        const previousMsTileColor = msTileMeta?.getAttribute('content') ?? '';
        const previousRootBg = rootEl.style.backgroundColor;
        const previousBodyBg = bodyEl?.style.background ?? '';

        if (themeMeta) themeMeta.setAttribute('content', MOBILE_THEME_COLOR);
        if (msTileMeta) msTileMeta.setAttribute('content', MOBILE_THEME_COLOR);
        rootEl.style.backgroundColor = MOBILE_APP_BG;
        if (bodyEl) bodyEl.style.background = MOBILE_APP_BG;

        return () => {
            if (themeMeta) themeMeta.setAttribute('content', previousThemeColor || '#ec4899');
            if (msTileMeta) msTileMeta.setAttribute('content', previousMsTileColor || '#ec4899');
            rootEl.style.backgroundColor = previousRootBg;
            if (bodyEl) bodyEl.style.background = previousBodyBg;
        };
    }, []);

    useEffect(() => {
        if (!room?.showLyricsSinger) {
            setDismissedHostLyrics(false);
            return;
        }
        if (room?.showLyricsSinger && currentSinger?.lyrics && !dismissedHostLyrics) {
            setViewLyrics(true);
            if (room?.lyricsMode) setShowAllLyrics(room.lyricsMode === 'full');
        }
    }, [room?.showLyricsSinger, room?.lyricsMode, currentSinger?.lyrics, dismissedHostLyrics]);

    useEffect(() => {
        if (room?.lightMode !== 'storm') {
            setStormPhase('off');
            setStormJoined(false);
            setStormFlash(false);
            if (stormAudioRef.current) {
                stormAudioRef.current.pause();
                stormAudioRef.current.currentTime = 0;
            }
            if (stormRafRef.current) cancelAnimationFrame(stormRafRef.current);
            if (stormFlashTimerRef.current) clearTimeout(stormFlashTimerRef.current);
            if (stormFlashTimeoutRef.current) clearTimeout(stormFlashTimeoutRef.current);
            return;
        }

        const cfg = room?.stormConfig || { approachMs: 15000, peakMs: 20000, passMs: 12000, clearMs: 6000 };
        const getPhase = () => {
            if (!room?.stormStartedAt) return room?.stormPhase || 'approach';
            const elapsed = Date.now() - room.stormStartedAt;
            if (elapsed < cfg.approachMs) return 'approach';
            if (elapsed < cfg.approachMs + cfg.peakMs) return 'peak';
            if (elapsed < cfg.approachMs + cfg.peakMs + cfg.passMs) return 'pass';
            if (elapsed < cfg.approachMs + cfg.peakMs + cfg.passMs + cfg.clearMs) return 'clear';
            return 'clear';
        };

        const updatePhase = () => setStormPhase(getPhase());
        updatePhase();
        const timer = setInterval(updatePhase, 500);
        return () => clearInterval(timer);
    }, [room?.lightMode, room?.stormStartedAt, room?.stormConfig, room?.stormPhase]);

    useEffect(() => {
        if (room?.lightMode !== 'strobe') return;
        const tick = () => setStrobeNow(Date.now());
        tick();
        const timer = setInterval(tick, 200);
        return () => clearInterval(timer);
    }, [room?.lightMode, room?.strobeCountdownUntil, room?.strobeEndsAt]);

    useEffect(() => {
        if (!room?.strobeSessionId) return;
        setStrobeLocalTaps(0);
        setStrobeMeter(0);
    }, [room?.strobeSessionId]);

    useEffect(() => {
        const timer = setInterval(() => {
            setStrobeMeter(v => Math.max(0, v - 2));
        }, 120);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (room?.activeMode !== 'doodle_oke') return;
        const tick = () => setDoodleNow(Date.now());
        tick();
        const timer = setInterval(tick, 200);
        return () => clearInterval(timer);
    }, [room?.activeMode, room?.doodleOke?.endsAt, room?.doodleOke?.guessEndsAt]);

    useEffect(() => {
        if (room?.activeMode !== 'doodle_oke') {
            setDoodleSubmissions([]);
            setDoodleVotes([]);
            setDoodleMyVote(null);
            setDoodleSubmitted(false);
            return;
        }
        setDoodleSubmissions([]);
        setDoodleVotes([]);
        setDoodleMyVote(null);
        setDoodleSubmitted(false);
    }, [room?.activeMode, room?.doodleOke?.promptId]);

    useEffect(() => {
        if (room?.activeMode !== 'doodle_oke') return;
        const participants = room?.doodleOkeConfig?.participants || [];
        const eligible = !participants.length || participants.includes(uid);
        if (!eligible) return;
        initDoodleCanvas();
    }, [room?.activeMode, room?.doodleOke?.promptId, room?.doodleOkeConfig?.participants, uid]);

    useEffect(() => {
        if (room?.activeMode !== 'doodle_oke') return;
        const participants = room?.doodleOkeConfig?.participants || [];
        const eligible = !participants.length || participants.includes(uid);
        if (!eligible) return;
        if (room?.doodleOke?.status === 'voting' && !doodleSubmitted) {
            submitDoodleDrawing();
        }
        // submitDoodleDrawing is declared later; keep deps primitive to avoid TDZ at render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room?.activeMode, room?.doodleOke?.status, room?.doodleOkeConfig?.participants, uid, doodleSubmitted]);

    useEffect(() => {
        if (room?.activeMode !== 'doodle_oke' || !room?.doodleOke?.promptId) return;
        const subsQ = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'doodle_submissions'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', room.doodleOke.promptId),
            orderBy('timestamp', 'desc'),
            limit(40)
        );
        const votesQ = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'doodle_votes'),
            where('roomCode', '==', roomCode),
            where('promptId', '==', room.doodleOke.promptId),
            orderBy('timestamp', 'desc'),
            limit(80)
        );
        const unsubSubs = onSnapshot(subsQ, snap => {
            setDoodleSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubVotes = onSnapshot(votesQ, snap => {
            const votes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setDoodleVotes(votes);
            setDoodleMyVote(votes.find(v => v.uid === uid) || null);
        });
        return () => {
            unsubSubs();
            unsubVotes();
        };
    }, [room?.activeMode, room?.doodleOke?.promptId, roomCode, uid]);

    const getStormAmbientUrl = useCallback(() => {
        if (stormPhase === 'approach') return STORM_SFX.lightRain;
        if (stormPhase === 'peak') return STORM_SFX.stormLoop;
        if (stormPhase === 'pass') return STORM_SFX.bigDrops;
        if (stormPhase === 'clear') return STORM_SFX.lightRain;
        return STORM_SFX.lightRain;
    }, [stormPhase]);

    const triggerStormLightning = useCallback(() => {
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
        if (navigator.vibrate) navigator.vibrate(60);
        if (stormFlashTimeoutRef.current) clearTimeout(stormFlashTimeoutRef.current);
        stormFlashTimeoutRef.current = setTimeout(() => setStormFlash(false), 260);

        const choices = stormThunderRefs.current;
        if (choices.length) {
            const idx = Math.floor(Math.random() * choices.length);
            const fx = choices[idx];
            fx.currentTime = 0;
            fx.volume = stormPhase === 'peak' ? 0.85 : 0.6;
            fx.play().catch(() => {});
        }
    }, [stormPhase]);

    const setupStormAnalyser = async () => {
        if (!stormAudioRef.current) return;
        if (!stormAudioCtxRef.current) {
            stormAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = stormAudioCtxRef.current;
        if (!stormAnalyserRef.current) {
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            const src = ctx.createMediaElementSource(stormAudioRef.current);
            src.connect(analyser);
            analyser.connect(ctx.destination);
            stormAnalyserRef.current = analyser;
            stormSourceRef.current = src;
        }
        if (ctx.state === 'suspended') await ctx.resume();
    };

    useEffect(() => {
        if (room?.lightMode !== 'storm') return;
        if (stormJoined) return;
        if (!stormAudioRef.current) {
            stormAudioRef.current = new Audio(getStormAmbientUrl());
            stormAudioRef.current.loop = true;
        }
        stormAudioRef.current.play()
            .then(() => {
                setStormJoined(true);
                setupStormAnalyser().catch(() => {});
            })
            .catch(() => {});
    }, [room?.lightMode, stormJoined, getStormAmbientUrl]);

    useEffect(() => {
        if (room?.lightMode !== 'storm') return;
        if (!stormJoined) return;

        if (!stormAudioRef.current) {
            stormAudioRef.current = new Audio(getStormAmbientUrl());
            stormAudioRef.current.loop = true;
        }
        if (!stormThunderRefs.current.length) {
            stormThunderRefs.current = [
                new Audio(STORM_SFX.thunder),
                new Audio(STORM_SFX.rollingThunder)
            ];
        }
        const phaseVolume = {
            approach: 0.35,
            peak: 0.75,
            pass: 0.45,
            clear: 0.2
        }[stormPhase] || 0.5;
        const nextUrl = getStormAmbientUrl();
        if (stormAudioRef.current.src !== nextUrl) {
            stormAudioRef.current.src = nextUrl;
            stormAudioRef.current.load();
        }
        stormAudioRef.current.volume = phaseVolume;
        stormAudioRef.current.play().catch(() => {});

        setupStormAnalyser().then(() => {
            const analyser = stormAnalyserRef.current;
            if (!analyser) return;
            const data = new Uint8Array(analyser.frequencyBinCount);
            const loop = () => {
                analyser.getByteFrequencyData(data);
                const low = averageBand(data, 20, 140, analyser.context.sampleRate);
                const mid = averageBand(data, 500, 2000, analyser.context.sampleRate);
                const threshold = stormPhase === 'peak' ? 155 : 175;
                if (low > threshold && low > (mid * 1.4)) triggerStormLightning();
                stormRafRef.current = requestAnimationFrame(loop);
            };
            stormRafRef.current = requestAnimationFrame(loop);
        });

        const raf = stormRafRef.current;
        const flashTimer = stormFlashTimerRef.current;
        const flashTimeout = stormFlashTimeoutRef.current;
        return () => {
            if (raf) cancelAnimationFrame(raf);
            if (flashTimer) clearTimeout(flashTimer);
            if (flashTimeout) clearTimeout(flashTimeout);
        };
    }, [room?.lightMode, stormJoined, stormPhase, getStormAmbientUrl, triggerStormLightning]);
    const sampleArt = useMemo(() => ({
        neon: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=80',
        crowd: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=200&q=80',
        mic: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=200&q=80',
        stage: 'https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?auto=format&fit=crop&w=200&q=80',
        guitar: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=200&q=80',
        disco: 'https://images.unsplash.com/photo-1504805572947-34fad45aed93?auto=format&fit=crop&w=200&q=80',
        vinyl: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=200&q=80',
        lights: 'https://images.unsplash.com/photo-1485579149621-3123dd979885?auto=format&fit=crop&w=200&q=80'
    }), []);
    const top100Seed = useMemo(() => ([
        { title: 'Dont Stop Believin', artist: 'Journey' },
        { title: 'Bohemian Rhapsody', artist: 'Queen' },
        { title: 'Sweet Caroline', artist: 'Neil Diamond' },
        { title: 'I Will Survive', artist: 'Gloria Gaynor' },
        { title: 'Livin on a Prayer', artist: 'Bon Jovi' },
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
        { title: 'Dont Stop Me Now', artist: 'Queen' },
        { title: 'Summer of 69', artist: 'Bryan Adams' },
        { title: 'Like a Virgin', artist: 'Madonna' },
        { title: 'Total Eclipse of the Heart', artist: 'Bonnie Tyler' },
        { title: 'Sweet Child O Mine', artist: 'Guns N Roses' },
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
        { title: 'Sweet Dreams', artist: 'Eurythmics' },
        { title: 'Stand By Me', artist: 'Ben E King' },
        { title: 'Lean on Me', artist: 'Bill Withers' },
        { title: 'Take Me Home Country Roads', artist: 'John Denver' },
        { title: 'Shallow', artist: 'Lady Gaga' },
        { title: 'Halo', artist: 'Beyonce' },
        { title: 'Crazy in Love', artist: 'Beyonce' },
        { title: 'Since U Been Gone', artist: 'Kelly Clarkson' },
        { title: 'You Belong with Me', artist: 'Taylor Swift' },
        { title: 'Stayin Alive', artist: 'Bee Gees' },
        { title: 'Let It Be', artist: 'The Beatles' },
        { title: 'I Will Always Love You', artist: 'Whitney Houston' },
        { title: 'Torn', artist: 'Natalie Imbruglia' },
        { title: 'Hit Me with Your Best Shot', artist: 'Pat Benatar' },
        { title: 'The Time of My Life', artist: 'Bill Medley and Jennifer Warnes' },
        { title: 'Come Together', artist: 'The Beatles' },
        { title: 'Landslide', artist: 'Fleetwood Mac' },
        { title: 'Go Your Own Way', artist: 'Fleetwood Mac' },
        { title: 'Dreams', artist: 'Fleetwood Mac' },
        { title: 'Crazy', artist: 'Gnarls Barkley' },
        { title: 'Mr Brightside', artist: 'The Killers' },
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
        { title: 'Im Yours', artist: 'Jason Mraz' },
        { title: 'Say My Name', artist: 'Destinys Child' },
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
        { title: 'Hey Ya', artist: 'OutKast' },
        { title: 'Ms Jackson', artist: 'OutKast' },
        { title: 'I Gotta Feeling', artist: 'Black Eyed Peas' },
        { title: 'No Diggity', artist: 'Blackstreet' },
        { title: 'Yeah!', artist: 'Usher' },
        { title: 'Enter Sandman', artist: 'Metallica' },
        { title: 'Nothing Else Matters', artist: 'Metallica' },
        { title: 'Purple Rain', artist: 'Prince' },
        { title: 'Tennessee Whiskey', artist: 'Chris Stapleton' },
        { title: 'Before He Cheats', artist: 'Carrie Underwood' }
    ]), []);
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
        setTop100ArtLoading(prev => ({ ...prev, [artKey]: true }));
        try {
            const data = await callFunction('itunesSearch', { term: `${song.title} ${song.artist}`, limit: 1 });
            const art = data?.results?.[0]?.artworkUrl100;
            if (art) {
                const hiRes = art.replace('100x100', '600x600');
                setTop100Art(prev => ({ ...prev, [artKey]: hiRes }));
                return hiRes;
            }
        } catch (e) {
            console.error(e);
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
    const balladLights = [
        { left: '6%', bottom: '4%', size: '140px', sway: '7s', delay: '0s', opacity: '0.7' },
        { left: '18%', bottom: '10%', size: '170px', sway: '8s', delay: '0.6s', opacity: '0.75' },
        { left: '32%', bottom: '6%', size: '150px', sway: '6s', delay: '0.2s', opacity: '0.7' },
        { left: '48%', bottom: '12%', size: '180px', sway: '7.5s', delay: '1.1s', opacity: '0.8' },
        { left: '62%', bottom: '6%', size: '160px', sway: '6.5s', delay: '0.4s', opacity: '0.7' },
        { left: '74%', bottom: '10%', size: '140px', sway: '8.5s', delay: '1.4s', opacity: '0.75' },
        { left: '86%', bottom: '5%', size: '130px', sway: '7.2s', delay: '0.9s', opacity: '0.7' }
    ];

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const isDevHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const bypass = isDevHost && (params.has('sms_bypass') || localStorage.getItem('bross_sms_bypass') === '1');
        setSmsBypassEnabled(bypass);
    }, []);

    useEffect(() => {
        setShowLogoTitle(true);
        const timer = setTimeout(() => setShowLogoTitle(false), 10000);
        return () => clearTimeout(timer);
    }, []);
    
    // Chat & Selfie State
    const [chatMsg, setChatMsg] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [chatUnread, setChatUnread] = useState(false);
    const [chatTab, setChatTab] = useState('lounge');
    const chatLastSeenRef = useRef(0);
    const chatLastSentRef = useRef(0);
    const videoRef = useRef(null);
    const audienceVideoRef = useRef(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState('');

    useEffect(() => {
        if (socialTab === 'host') {
            setChatTab('host');
            return;
        }
        if (socialTab === 'lounge') {
            setChatTab('lounge');
        }
    }, [socialTab]);
    
    // Vibe State (Guitar)
    const [strings, setStrings] = useState([0,0,0,0,0]);
    const lastStrum = useRef(0);
    const stringTimers = useRef([]);
    const lastReactionAt = useRef(0);
    const reactionFlushTimer = useRef(null);
    const pendingReactions = useRef({});
    const pendingReactionCount = useRef(0);
    const pendingReactionCost = useRef(0);
    const strumFlushTimer = useRef(null);
    const pendingStrumHits = useRef(0);
    const strobeFlushTimer = useRef(null);
    const pendingStrobeTaps = useRef(0);
    const pendingPointDelta = useRef(0);
    const lastPointsSync = useRef(0);
    const lastBonusDropId = useRef(null);
    const cooldownTimer = useRef(null);
    const lastGuitarWin = useRef(null);
    const chatSendTimesRef = useRef([]);
    const lastActiveAtRef = useRef(0);

    const toast = useToast();
    const billingPlatform = useMemo(() => detectBillingPlatform(), []);
    const billingProvider = useMemo(() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return createBillingProvider({ platform: billingPlatform, callFunction, origin });
    }, [billingPlatform]);
    const isDirectChatMessage = useCallback((message = {}) => (
        !!message?.toHost
        || !!message?.toUid
        || message?.channel === 'host'
        || message?.channel === 'dm'
    ), []);
    const isLoungeChatMessage = useCallback((message = {}) => !isDirectChatMessage(message), [isDirectChatMessage]);
    const isDmForCurrentUser = useCallback((message = {}) => (
        (!!message?.toHost && message?.uid === uid)
        || message?.toUid === uid
    ), [uid]);
    const loungeMessages = useMemo(() => chatMessages.filter((msg) => isLoungeChatMessage(msg)), [chatMessages, isLoungeChatMessage]);
    const dmMessages = useMemo(() => chatMessages.filter((msg) => isDmForCurrentUser(msg)), [chatMessages, isDmForCurrentUser]);
    const [hallOfFameMode, setHallOfFameMode] = useState('all_time');
    const [hallOfFameEntries, setHallOfFameEntries] = useState([]);
    const [hallOfFameFilter, setHallOfFameFilter] = useState('');
    const filteredHallOfFame = useMemo(() => {
        const q = hallOfFameFilter.trim().toLowerCase();
        if (!q) return hallOfFameEntries;
        return hallOfFameEntries.filter(entry => (`${entry.songTitle || ''} ${entry.artist || ''}`).toLowerCase().includes(q));
    }, [hallOfFameEntries, hallOfFameFilter]);

    const markActive = () => {
        lastActiveAtRef.current = Date.now();
    };

    const queuePointDelta = useCallback((delta) => {
        pendingPointDelta.current += delta;
        setLocalPointOffset(prev => prev + delta);
    }, []);

    const syncPoints = useCallback(async (force = false) => {
        if (!user || !uid) return;
        const delta = pendingPointDelta.current;
        if (!delta) return;
        const now = Date.now();
        if (!force && Math.abs(delta) < 50 && now - lastPointsSync.current < 60000) return;
        pendingPointDelta.current = 0;
        lastPointsSync.current = now;
        try {
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), { points: increment(delta), lastActiveAt: serverTimestamp() });
            setLocalPointOffset(prev => prev - delta);
        } catch {
            pendingPointDelta.current += delta;
        }
    }, [user, uid, roomCode]);

    const getEffectivePoints = () => (user?.points || 0) + localPointOffset;

    const getWeekKey = (date = new Date()) => {
        const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const day = utc.getUTCDay();
        utc.setUTCDate(utc.getUTCDate() - day);
        const y = utc.getUTCFullYear();
        const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
        const d = String(utc.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    useEffect(() => {
        if (!roomCode || room?.chatEnabled === false) {
            setChatMessages([]);
            setChatUnread(false);
            return;
        }
        const viewingChat = tab === 'social' && ['lounge', 'host'].includes(socialTab);
        const q = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'),
            where('roomCode', '==', roomCode),
            orderBy('timestamp', 'desc'),
            limit(viewingChat ? 40 : 1)
        );
        const unsub = onSnapshot(q, snap => {
            const next = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (viewingChat) {
                setChatMessages(next);
            } else if (!next.length) {
                setChatMessages([]);
            }
            const newestRelevant = next.find((msg) => isLoungeChatMessage(msg) || isDmForCurrentUser(msg));
            const newest = newestRelevant?.timestamp?.seconds ? newestRelevant.timestamp.seconds * 1000 : 0;
            if (newest && newest > chatLastSeenRef.current && !viewingChat) {
                setChatUnread(true);
            }
        });
        return () => unsub();
    }, [roomCode, room?.chatEnabled, tab, socialTab, isLoungeChatMessage, isDmForCurrentUser]);

    useEffect(() => {
        const viewingLeaderboard = tab === 'social' && socialTab === 'leaderboard';
        if (!roomCode || !viewingLeaderboard) return () => {};
        const collectionName = hallOfFameMode === 'week' ? 'song_hall_of_fame_weeks' : 'song_hall_of_fame';
        const weekKey = getWeekKey();
        const q = hallOfFameMode === 'week'
            ? query(collection(db, collectionName), where('weekKey', '==', weekKey), orderBy('bestScore', 'desc'), limit(50))
            : query(collection(db, collectionName), orderBy('bestScore', 'desc'), limit(50));
        const unsub = onSnapshot(q, snap => {
            setHallOfFameEntries(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
        });
        return () => unsub();
    }, [roomCode, hallOfFameMode, tab, socialTab]);

    const flushReactionBuffer = useCallback(async () => {
        if (!roomCode || !user) return;
        const batch = pendingReactions.current;
        const totalCount = pendingReactionCount.current;
        const totalCost = pendingReactionCost.current;
        if (!totalCount) return;
        pendingReactions.current = {};
        pendingReactionCount.current = 0;
        pendingReactionCost.current = 0;
        try {
            const entries = Object.entries(batch);
            for (const [type, count] of entries) {
                await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), {
                    roomCode,
                    type,
                    count,
                    userName: user.name,
                    avatar: user.avatar,
                    isVip: !!user.isVip,
                    timestamp: serverTimestamp()
                });
            }
            trackEvent('reaction_sent', { room_code: roomCode, count: totalCount });
            const performanceId = currentSinger?.id || null;
            const boostedPoints = totalCost * (room?.multiplier || 1);
            const isSamePerformance = !!performanceId && user?.lastPerformanceId === performanceId;
            const updates = {
                totalEmojis: increment(totalCount)
            };
            if (performanceId && boostedPoints > 0) {
                updates.lastPerformanceId = performanceId;
                updates.performancePointsGifted = isSamePerformance
                    ? increment(boostedPoints)
                    : boostedPoints;
                updates.totalPointsGifted = increment(boostedPoints);
            }
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), updates);
            if (currentSinger && totalCost > 0) {
                try {
                    await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', currentSinger.id), {
                        hypeScore: increment(totalCost * (room?.multiplier || 1))
                    });
                } catch {
                    // Ignore hype update failures.
                }
            }
        } catch (e) {
            console.error(e);
        }
    }, [roomCode, user, currentSinger, room?.multiplier, uid]);

    const queueReactionWrite = (type, cost) => {
        pendingReactions.current[type] = (pendingReactions.current[type] || 0) + 1;
        pendingReactionCount.current += 1;
        pendingReactionCost.current += cost;
        if (reactionFlushTimer.current) return;
        reactionFlushTimer.current = setTimeout(async () => {
            reactionFlushTimer.current = null;
            await flushReactionBuffer();
        }, 800);
    };

    const flushStrumBuffer = useCallback(async () => {
        if (!roomCode || !user || pendingStrumHits.current <= 0) return;
        const count = pendingStrumHits.current;
        pendingStrumHits.current = 0;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), {
                roomCode,
                type: 'strum',
                count,
                userName: user.name,
                avatar: user.avatar,
                isVip: !!user.isVip,
                timestamp: serverTimestamp()
            });
            const sessionId = room?.guitarSessionId || Date.now();
            const isNewSession = user?.guitarSessionId !== sessionId;
            const payload = { guitarSessionId: sessionId, lastVibeAt: serverTimestamp() };
            payload.guitarHits = isNewSession ? count : increment(count);
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), payload);
        } catch (e) {
            console.error(e);
        }
    }, [roomCode, user, room?.guitarSessionId, uid]);

    const queueStrumWrite = () => {
        pendingStrumHits.current += 1;
        if (strumFlushTimer.current) return;
        strumFlushTimer.current = setTimeout(async () => {
            strumFlushTimer.current = null;
            await flushStrumBuffer();
        }, 600);
    };

    const flushStrobeBuffer = useCallback(async () => {
        if (!roomCode || !user || pendingStrobeTaps.current <= 0) return;
        const count = pendingStrobeTaps.current;
        pendingStrobeTaps.current = 0;
        try {
            const sessionId = room?.strobeSessionId || Date.now();
            const isNewSession = user?.strobeSessionId !== sessionId;
            const payload = { strobeSessionId: sessionId, lastVibeAt: serverTimestamp() };
            payload.strobeTaps = isNewSession ? count : increment(count);
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), payload);
        } catch (e) {
            console.error(e);
        }
    }, [roomCode, user, room?.strobeSessionId, uid]);

    const queueStrobeTap = () => {
        pendingStrobeTaps.current += 1;
        if (strobeFlushTimer.current) return;
        strobeFlushTimer.current = setTimeout(async () => {
            strobeFlushTimer.current = null;
            await flushStrobeBuffer();
        }, 700);
    };

    const initDoodleCanvas = () => {
        const canvas = doodleCanvasRef.current;
        if (!canvas) return;
        const size = 720;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#0b0b0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const getDoodlePoint = (e) => {
        const canvas = doodleCanvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const handleDoodleStart = (e) => {
        const canvas = doodleCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const point = getDoodlePoint(e);
        if (!ctx || !point) return;
        doodleDrawingRef.current = true;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = doodleEraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = doodleEraser ? '#000000' : doodleColor;
        ctx.lineWidth = doodleBrush;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        doodleLastPointRef.current = point;
        doodleDirtyRef.current = true;
    };

    const handleDoodleMove = (e) => {
        if (!doodleDrawingRef.current) return;
        const canvas = doodleCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const point = getDoodlePoint(e);
        if (!ctx || !point) return;
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        doodleLastPointRef.current = point;
        doodleDirtyRef.current = true;
    };

    const handleDoodleEnd = () => {
        if (!doodleDrawingRef.current) return;
        doodleDrawingRef.current = false;
    };

    const clearDoodle = () => {
        const canvas = doodleCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0b0b0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        doodleDirtyRef.current = true;
    };
    
    const copyInviteLink = async () => {
        const url = `${window.location.origin}?room=${roomCode}`;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
            } else {
                const input = document.createElement('input');
                input.value = url;
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
            }
            toast('Invite link copied');
        } catch (e) {
            console.error(e);
            toast('Copy failed');
        }
    };

    // Helpers
    const getReactionClass = (t) => ({
        rocket: 'animate-rocket-fly text-6xl', 
        diamond: 'animate-diamond-shine text-6xl', 
        crown: 'animate-crown-bounce text-6xl', 
        money: 'animate-money-wobble text-6xl', 
        drink: 'animate-drink-sway text-6xl',
        fire: 'animate-fire-flicker text-6xl',
        heart: 'animate-heart-beat text-6xl',
        clap: 'animate-clap-shake text-6xl'
    }[t] || 'animate-float text-6xl');

const getEmojiChar = (t) => (EMOJI[t] || EMOJI.heart);

    const getAvatarStatus = useCallback((item) => {
        const unlocked = profile?.unlockedEmojis || [];
        const isVip = !!user?.isVip || !!profile?.isVip || (profile?.vipLevel || 0) > 0;
        const fameLevel = getLevelFromFame(profile?.totalFamePoints || 0);

        if (item.unlock.type === 'free') return { locked: false, note: 'FREE' };
        if (item.unlock.type === 'vip') return { locked: !isVip, note: 'VIP' };
        if (item.unlock.type === 'fame') return { locked: fameLevel < item.unlock.level, note: `LV ${item.unlock.level}` };
        if (item.unlock.type === 'first_performance') {
            const unlockedByPerformance = !!profile?.firstPerformanceUnlocked;
            return { locked: !(unlockedByPerformance || unlocked.includes(item.id)), note: '1ST SONG' };
        }
        if (item.unlock.type === 'guitar_winner') return { locked: !unlocked.includes(item.id), note: 'WIN SOLO' };
        if (item.unlock.type === 'points') return { locked: !unlocked.includes(item.id), note: `${item.unlock.cost} PTS` };
        return { locked: false, note: '' };
    }, [profile, user]);

    const getUnlockHint = useCallback((item) => {
        if (item.unlock.type === 'vip') return 'VIP only - verify to unlock.';
        if (item.unlock.type === 'fame') return `Reach Fame Level ${item.unlock.level} to unlock.`;
        if (item.unlock.type === 'first_performance') return 'Sing one song to unlock.';
        if (item.unlock.type === 'guitar_winner') return 'Win Guitar Mode to unlock.';
        if (item.unlock.type === 'points') return `Unlock for ${item.unlock.cost} points.`;
        return '';
    }, []);

    const hasLyrics = !!currentSinger?.lyrics;
    const applePlayback = room?.appleMusicPlayback || null;
    const mediaUrl = resolveStageMediaUrl(currentSinger, room);
    const stageBacking = normalizeBackingChoice({
        mediaUrl,
        appleMusicId: currentSinger?.appleMusicId
    });
    const applePlaybackActive = !!applePlayback?.id && !stageBacking.mediaUrl;
    const isNativeVideo = !!stageBacking.mediaUrl && /\.(mp4|webm|ogg)$/i.test(stageBacking.mediaUrl);
    const isAudio = !!(currentSinger?.audioOnly) || (stageBacking.mediaUrl && /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(stageBacking.mediaUrl));
    const youtubeId = stageBacking.youtubeId;
    const isYoutube = stageBacking.isYouTube;
    const nowPlayingLabel = useMemo(() => {
        if (applePlaybackActive) {
            const title = applePlayback?.title || 'Apple Music';
            const state = applePlayback?.status === 'paused' ? 'Paused' : 'Live';
            return { source: 'Apple Music', title, state, sourceKey: 'apple' };
        }
        if (mediaUrl) {
            const state = room?.videoPlaying ? 'Playing' : 'Paused';
            const source = isYoutube ? 'YouTube' : isNativeVideo ? 'Local Video' : isAudio ? 'Local Audio' : 'Media';
            const title = currentSinger?.songTitle || 'Now Playing';
            const sourceKey = isYoutube ? 'youtube' : (isNativeVideo || isAudio) ? 'local' : 'media';
            return { source, title, state, sourceKey };
        }
        return null;
    }, [applePlaybackActive, applePlayback?.title, applePlayback?.status, mediaUrl, room?.videoPlaying, isYoutube, isNativeVideo, isAudio, currentSinger?.songTitle]);
    const hostLyricsActive = !!room?.showLyricsSinger && hasLyrics;
    const audienceVideoForced = room?.audienceVideoMode === 'force';
    const audienceIframeSrc = useMemo(() => {
        if (!youtubeId) return null;
        const start = room?.videoStartTimestamp ? (Date.now() - room.videoStartTimestamp) / 1000 : 0;
        return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&controls=1&playsinline=1&mute=1&start=${Math.floor(Math.max(0, start))}`;
    }, [youtubeId, room?.videoStartTimestamp]);
    const showAudienceVideoInline = (audienceVideoForced || showAudienceVideo) && !!mediaUrl && !isAudio;
    const showAudienceVideoActive = showAudienceVideoInline || showAudienceVideoFullscreen;

    const syncAudienceVideoNow = useCallback(() => {
        if (!audienceVideoRef.current || !room?.videoStartTimestamp) return;
        const vid = audienceVideoRef.current;
        const targetTime = (Date.now() - room.videoStartTimestamp) / 1000;
        vid.currentTime = targetTime;
        if (room?.videoPlaying) {
            vid.play().catch(() => {});
        }
    }, [room?.videoStartTimestamp, room?.videoPlaying]);

    const submitDoodleDrawing = useCallback(async () => {
        if (!roomCode || !user || !room?.doodleOke?.promptId) return;
        if (doodleSubmitted) return;
        const canvas = doodleCanvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        if (!dataUrl || dataUrl.length < 1000) return toast('Add a little more detail first');
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'doodle_submissions'), {
                roomCode,
                promptId: room.doodleOke.promptId,
                uid,
                name: user?.name || 'Guest',
                avatar: user?.avatar || '',
                image: dataUrl,
                approved: !room?.doodleOke?.requireReview,
                timestamp: serverTimestamp()
            });
            setDoodleSubmitted(true);
            toast(room?.doodleOke?.requireReview ? 'Drawing submitted for host review!' : 'Drawing submitted!');
        } catch (e) {
            console.error(e);
            toast('Submit failed');
        }
    }, [roomCode, user, room?.doodleOke?.promptId, room?.doodleOke?.requireReview, doodleSubmitted, uid, toast]);

    const submitDoodleVote = async (targetUid) => {
        if (!roomCode || !user || !room?.doodleOke?.promptId) return;
        if (doodleMyVote) return;
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'doodle_votes'), {
                roomCode,
                promptId: room.doodleOke.promptId,
                uid,
                name: user?.name || 'Guest',
                avatar: user?.avatar || '',
                targetUid,
                timestamp: serverTimestamp()
            });
            toast('Vote submitted!');
        } catch (e) {
            console.error(e);
            toast('Vote failed');
        }
    };

    useEffect(() => {
        if (audienceVideoForced) {
            setShowAudienceVideo(true);
            setTimeout(syncAudienceVideoNow, 60);
        }
    }, [audienceVideoForced, syncAudienceVideoNow]);
    useEffect(() => {
        if (!showAudienceVideoInline) {
            setShowAudienceVideoFullscreen(false);
        }
    }, [showAudienceVideoInline]);
    useEffect(() => {
        if (!showAudienceVideoActive || !isNativeVideo) return;
        const timer = setTimeout(syncAudienceVideoNow, 80);
        return () => clearTimeout(timer);
    }, [showAudienceVideoActive, isNativeVideo, room?.videoStartTimestamp, syncAudienceVideoNow]);

    useEffect(() => {
        if (!room?.howToPlay?.active || !room?.howToPlay?.id) return;
        if (lastHowToPlayId.current === room.howToPlay.id) return;
        lastHowToPlayId.current = room.howToPlay.id;
    }, [room?.howToPlay?.active, room?.howToPlay?.id]);
    useEffect(() => {
        if (!showHowToPlay) return undefined;
        setHowToPlayIndex(0);
        const timer = setInterval(() => {
            setHowToPlayIndex(prev => (prev + 1) % (HOW_TO_PLAY.sections?.length || 1));
        }, 5000);
        return () => clearInterval(timer);
    }, [showHowToPlay]);

    useEffect(() => {
        if (room?.activeMode === 'bingo') {
            setShowBingoOverlay(true);
        }
    }, [room?.activeMode]);

    useEffect(() => {
        if (!showAudienceVideoActive || !isNativeVideo || !audienceVideoRef.current || !room?.videoStartTimestamp) return;
        const syncTimer = setInterval(() => {
            const vid = audienceVideoRef.current;
            if (!vid) return;
            if (room?.videoPlaying) {
                const targetTime = (Date.now() - room.videoStartTimestamp) / 1000;
                if (Math.abs(vid.currentTime - targetTime) > 0.6) vid.currentTime = targetTime;
                if (vid.paused) vid.play().catch(() => {});
            } else if (!vid.paused) {
                vid.pause();
            }
        }, 1000);
        return () => clearInterval(syncTimer);
    }, [showAudienceVideoActive, isNativeVideo, room?.videoPlaying, room?.videoStartTimestamp]);
    const selectedAvatar = useMemo(() => {
        const selected = form.emoji || user?.avatar || DEFAULT_EMOJI;
        return AVATAR_CATALOG.find(a => a.emoji === selected) || AVATAR_CATALOG[0];
    }, [form.emoji, user?.avatar]);
    const selectedAvatarStatus = useMemo(() => getAvatarStatus(selectedAvatar), [selectedAvatar, getAvatarStatus]);
    const selectedAvatarUnlock = useMemo(() => getUnlockHint(selectedAvatar), [selectedAvatar, getUnlockHint]);
    const historyItems = useMemo(() => {
        const name = user?.name;
        return songs
            .filter(s => s.status === 'performed' && (s.singerUid === uid || s.singerName === name))
            .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
            .slice(0, 12);
    }, [songs, user?.name, uid]);
    const performanceStats = useMemo(() => {
        const name = user?.name;
        const performed = songs.filter(s => s.status === 'performed' && (s.singerUid === uid || s.singerName === name));
        const total = performed.length;
        const loudest = performed.reduce((max, s) => Math.max(max, s.applauseScore || 0), 0);
        const totalPoints = performed.reduce((sum, s) => sum + (s.applauseScore || 0) + (s.hypeScore || 0) + (s.hostBonus || 0), 0);
        const topSong = performed.reduce((best, s) => {
            const score = (s.applauseScore || 0) + (s.hypeScore || 0) + (s.hostBonus || 0);
            if (!best || score > best.score) return { score, songTitle: s.songTitle, artist: s.artist };
            return best;
        }, null);
        return { total, loudest, totalPoints, topSong };
    }, [songs, user?.name, uid]);
    const favoriteSongs = useMemo(() => {
        const counts = {};
        historyItems.forEach(item => {
            const key = `${item.songTitle} - ${item.artist}`;
            counts[key] = (counts[key] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([label, count]) => ({ label, count }));
    }, [historyItems]);

    const handleSelectAvatar = async (item, status) => {
        setForm(prev => ({ ...prev, emoji: item.emoji }));
        if (!status.locked) {
            return;
        }

        if (item.unlock.type !== 'points') {
            return;
        }

        if (!user) return;
        if (getEffectivePoints() < item.unlock.cost) return;

        try {
            queuePointDelta(-item.unlock.cost);
            await updateDoc(doc(db, 'users', uid), { unlockedEmojis: arrayUnion(item.id) });
            setForm(prev => ({ ...prev, emoji: item.emoji }));
            syncPoints(true);
            toast(`Unlocked ${item.label}!`);
        } catch (e) {
            console.error(e);
            toast('Unlock failed. Try again.');
        }
    };

    // Helper: Log Activity
    const logActivity = async (text, icon) => {
        try {
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'activities'), {
                roomCode, 
                user: user?.name || form.name, 
                text, 
                icon, 
                timestamp: serverTimestamp()
            });
        } catch(e) { console.error("Log error", e); }
    };
    const sendLobbySpark = async (targetName) => {
        if (!isVipAccount) {
            toast('VIPs can send Sparks in the lobby.');
            return;
        }
        const name = targetName || 'the crowd';
        await logActivity(`sparked ${name}`, EMOJI.sparkle);
        toast(`Spark sent to ${name}!`);
    };

    // Listeners
    useEffect(() => {
        const unsubRoom = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), s => setRoom(s.data()));
        
        const unsubUser = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), s => {
            if (s.exists()) {
                const u = s.data();
                setUser(u);
                if (u.avatar === '??' || u.avatar === '?') {
                    updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), { avatar: DEFAULT_EMOJI }).catch((e) => {
                        console.warn('Failed to set default avatar', e);
                    });
                }
                // Fix: Only set form on FIRST load, preventing the delete-bug
                if (!isFormInitialized) {
                    setForm(prev => ({ ...prev, name: clampName(u.name || ''), emoji: u.avatar }));
                    setIsFormInitialized(true);
                }
            }
        });
        
        // Subscribe to ALL users for Leaderboard
        const unsubAllUsers = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'room_users'), where('roomCode', '==', roomCode)), s => {
            const usersList = s.docs.map(d => d.data()).sort((a,b) => b.points - a.points);
            setAllUsers(usersList);
        });
        
        const unsubSongs = onSnapshot(query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), where('roomCode', '==', roomCode)), s => setSongs(s.docs.map(d => ({id:d.id, ...d.data()}))));
        
        return () => { unsubRoom(); unsubUser(); unsubAllUsers(); unsubSongs(); };
    }, [roomCode, uid, isFormInitialized]);
    useEffect(() => {
        if (uid && uid !== authReadyUid) {
            setAuthReadyUid(uid);
        }
    }, [uid, authReadyUid]);
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            if (!uid) setAuthReadyUid(u?.uid || null);
        });
        return () => unsub();
    }, [uid]);

    useEffect(() => {
        if (!roomCode) return;
        const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), s => {
            const data = s.data() || {};
            if (Array.isArray(data.ytIndex)) setYtIndex(data.ytIndex);
        });
        return () => unsub();
    }, [roomCode]);
    const popTriviaRoundSec = Math.max(8, Number(room?.popTriviaRoundSec || DEFAULT_POP_TRIVIA_ROUND_SEC));
    const popTriviaState = useMemo(() => {
        if (room?.activeMode !== 'karaoke') return null;
        if (room?.popTriviaEnabled === false) return null;
        if (!currentSinger) return null;
        return getActivePopTriviaQuestion({
            song: currentSinger,
            now: popTriviaNow,
            roundSec: popTriviaRoundSec
        });
    }, [currentSinger, popTriviaNow, popTriviaRoundSec, room?.activeMode, room?.popTriviaEnabled]);
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
    const popTriviaMyVote = useMemo(() => {
        if (!popTriviaVotes.length) return null;
        const mine = popTriviaVotes.find((vote) => (vote?.uid && uid ? vote.uid === uid : false));
        if (!mine) return null;
        const val = Number(mine.val);
        return Number.isInteger(val) ? val : null;
    }, [popTriviaVotes, uid]);

    useEffect(() => {
        if (!popTriviaQuestionId) {
            setPopTriviaVotes([]);
            return () => {};
        }
        const voteQuery = query(
            collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'),
            where('roomCode', '==', roomCode),
            where('questionId', '==', popTriviaQuestionId)
        );
        const unsub = onSnapshot(voteQuery, (snap) => {
            const deduped = dedupeQuestionVotes(
                snap.docs.map((docSnap) => docSnap.data()),
                POP_TRIVIA_VOTE_TYPE
            );
            setPopTriviaVotes(deduped);
        });
        return () => unsub();
    }, [roomCode, popTriviaQuestionId]);
    useEffect(() => {
        if (room?.activeMode !== 'karaoke') return;
        if (room?.popTriviaEnabled === false) return;
        if (!currentSinger?.id || !Array.isArray(currentSinger?.popTrivia) || currentSinger.popTrivia.length === 0) return;
        setPopTriviaNow(Date.now());
        const timer = setInterval(() => setPopTriviaNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [currentSinger?.id, currentSinger?.popTrivia, room?.activeMode, room?.popTriviaEnabled]);

    // Ensure a persistent user doc for account-level data (tight15, vipLevel)
    useEffect(() => {
        if (!authReadyUid || auth.currentUser?.uid !== authReadyUid) return;
        // Use current form values as hints for profile creation
        if (typeof window !== 'undefined') {
            const host = window.location?.hostname || 'unknown';
            console.info('[SingerApp] ensureUserProfile call host=%s authReadyUid=%s authUid=%s', host, authReadyUid, auth.currentUser?.uid || 'none');
        }
        ensureUserProfile(authReadyUid, { name: clampName((form.name || 'Guest').trim()), avatar: form.emoji || DEFAULT_EMOJI });
    }, [authReadyUid, form.emoji, form.name]);

    // Listen for top-level user profile (persistent across rooms)
    useEffect(() => {
        if (!authReadyUid || auth.currentUser?.uid !== authReadyUid) return;
        const uRef = doc(db, 'users', authReadyUid);
        const unsub = onSnapshot(uRef, s => setProfile(s.exists() ? s.data() : null));
        return () => unsub();
    }, [authReadyUid]);

    useEffect(() => {
        if (!uid || isAnon || !user || !profile) return;
        if (tight15MigrationDoneRef.current === uid) return;
        const tempList = Array.isArray(user?.tight15Temp) ? user.tight15Temp : [];
        const savedList = Array.isArray(profile?.tight15) ? profile.tight15 : [];
        if (!tempList.length || savedList.length) {
            tight15MigrationDoneRef.current = uid;
            return;
        }
        let cancelled = false;
        const migrate = async () => {
            try {
                const merged = sanitizeTight15List([...savedList, ...tempList]);
                await setDoc(doc(db, 'users', uid), { tight15: merged }, { merge: true });
                await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), { tight15Temp: [] }, { merge: true });
                if (!cancelled) toast('Tight 15 migrated to your account.');
            } catch (error) {
                console.error('Tight 15 migration failed', error);
            } finally {
                tight15MigrationDoneRef.current = uid;
            }
        };
        migrate();
        return () => {
            cancelled = true;
        };
    }, [uid, isAnon, user, profile, roomCode, toast]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const key = `beaurocks_returning_${uid || 'guest'}`;
        let stored = null;
        try {
            stored = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
            stored = null;
        }
        const profileName = profile?.name || stored?.name || '';
        const profileEmoji = profile?.avatar || stored?.emoji || DEFAULT_EMOJI;
        if (!profileName) return;
        setReturningProfile({ name: profileName, emoji: profileEmoji, lastRoom: stored?.lastRoom || '' });
    }, [uid, profile?.name, profile?.avatar]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const key = `beaurocks_rules_${uid || 'guest'}`;
        try {
            const stored = localStorage.getItem(key);
            if (stored === 'accepted') {
                setTermsAccepted(true);
            }
        } catch {
            // Ignore storage failures.
        }
    }, [uid]);

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return;
        if (user) return;
        const container = joinRayStageRef.current || joinContainerRef.current;
        const logo = joinLogoRef.current;
        if (!container || !logo) return;
        const update = () => {
            const containerRect = container.getBoundingClientRect();
            const logoRect = logo.getBoundingClientRect();
            const x = logoRect.left - containerRect.left + logoRect.width / 2;
            const y = logoRect.top - containerRect.top + logoRect.height / 2;
            setJoinRayPos({ x: `${Math.round(x)}px`, y: `${Math.round(y)}px` });
        };
        update();
        window.addEventListener('resize', update);
        const ro = new ResizeObserver(update);
        ro.observe(container);
        ro.observe(logo);
        return () => {
            window.removeEventListener('resize', update);
            ro.disconnect();
        };
    }, [user]);

    useEffect(() => {
        if (!uid || !profile) return;
        const fameLevel = typeof profile.currentLevel === 'number'
            ? profile.currentLevel
            : getLevelFromFame(profile.totalFamePoints || 0);
        updateDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`),
            getRoomUserProjection({
                fameLevel,
                totalFamePoints: profile.totalFamePoints || 0
            })
        ).catch(() => {});
    }, [profile, uid, roomCode, getRoomUserProjection]);

    useEffect(() => {
        if (!profile?.vipProfile) return;
        setVipForm(prev => ({
            ...prev,
            location: profile.vipProfile.location || '',
            birthMonth: profile.vipProfile.birthMonth || '',
            birthDay: profile.vipProfile.birthDay || '',
            smsOptIn: !!profile.vipProfile.smsOptIn,
            tosAccepted: !!profile.vipProfile.tosAccepted
        }));
    }, [profile?.vipProfile]);

    useEffect(() => {
        if (!isVipAccount || !profile) return;
        if (vipProfileComplete) return;
        if (showPhoneModal || showProfile || showAccount || showVipOnboarding) return;
        setShowVipOnboarding(true);
    }, [isVipAccount, profile, vipProfileComplete, showPhoneModal, showProfile, showAccount, showVipOnboarding]);

    useEffect(() => {
        if (!user || !uid || profile?.firstPerformanceUnlocked) return;
        const didPerform = songs.some(s => s.singerName === user.name && s.status === 'performed');
        if (!didPerform) return;
        updateDoc(doc(db, 'users', uid), { firstPerformanceUnlocked: true }).catch((e) => {
            console.warn('Failed to unlock first performance', e);
        });
    }, [songs, user, uid, profile?.firstPerformanceUnlocked]);

    useEffect(() => {
        const win = room?.guitarWinner;
        if (!win || win.uid !== uid) return;
        if (lastGuitarWin.current === win.sessionId) return;
        lastGuitarWin.current = win.sessionId;
        if (!profile?.unlockedEmojis?.includes('guitar_glow')) {
            updateDoc(doc(db, 'users', uid), { unlockedEmojis: arrayUnion('guitar_glow') }).catch((e) => {
                console.warn('Failed to unlock guitar glow emoji', e);
            });
        }
        toast(`You shredded the hardest! ${win.hits || 0} inputs.`);
    }, [room?.guitarWinner, uid, profile?.unlockedEmojis, toast]);

    useEffect(() => {
        const win = room?.strobeWinner;
        if (!win || win.uid !== uid) return;
        if (strobeWinSeenRef.current === win.sessionId) return;
        strobeWinSeenRef.current = win.sessionId;
        setStrobeVictoryInfo(win);
        setStrobeVictoryOpen(true);
        toast(`Beat Drop MVP! ${win.taps || 0} taps.`);
    }, [room?.strobeWinner, uid, toast]);

    useEffect(() => {
        const drop = room?.bonusDrop;
        if (!drop || !user) return;
        if (lastBonusDropId.current === drop.id) return;
        lastBonusDropId.current = drop.id;
        queuePointDelta(drop.points || 0);
        syncPoints(true);
        toast(`Bonus drop: +${drop.points || 0} PTS`);
    }, [room?.bonusDrop, user, queuePointDelta, syncPoints, toast]);

    useEffect(() => {
        if (!room?.photoOverlay?.url) {
            setComposedPhoto(null);
            return;
        }
        setIsComposing(true);
        composeSelfie(room.photoOverlay.url)
            .then(setComposedPhoto)
            .catch(() => setComposedPhoto(null))
            .finally(() => setIsComposing(false));
        // composeSelfie is declared later; keep deps primitive to avoid TDZ at render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room?.photoOverlay?.url]);

    useEffect(() => {
        if (room?.activeMode !== 'selfie_challenge' || !room?.selfieChallenge?.promptId) {
            setSelfieSubmissions([]);
            setSelfieVotes([]);
            setMySelfieVote(null);
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
            const votes = s.docs.map(d => ({ id: d.id, ...d.data() }));
            setSelfieVotes(votes);
            const mine = votes.find(v => v.voterUid === uid);
            setMySelfieVote(mine ? mine.targetUid : null);
        });
        return () => { unsubSubs(); unsubVotes(); };
    }, [room?.activeMode, room?.selfieChallenge?.promptId, roomCode, uid]);

    // Sync room VIP with account status
    useEffect(() => {
        if (!user || isAnon || user.isVip) return;
        updateDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`),
            getRoomUserProjection({
                isVip: true,
                vipLevel: Math.max(1, Number(profile?.vipLevel || 1))
            })
        )
            .catch(() => {});
    }, [user, isAnon, roomCode, uid, getRoomUserProjection, profile?.vipLevel]);

    // Points Drip (VIP only, requires recent activity; local accrual, sync on spend/events)
    useEffect(() => {
        if(!user) return;
        if (!isVipAccount) return;
        const interval = setInterval(() => {
            if (document.hidden) return;
            if (Date.now() - lastActiveAtRef.current > 10 * 60 * 1000) return;
            queuePointDelta(10);
        }, 60000); 
        return () => clearInterval(interval);
    }, [user, isVipAccount, queuePointDelta]);

    const triggerCooldownFlash = () => {
        setCooldownFlash(true);
        if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
        cooldownTimer.current = setTimeout(() => setCooldownFlash(false), 350);
    };

    useEffect(() => () => {
        if (reactionFlushTimer.current) clearTimeout(reactionFlushTimer.current);
        if (strumFlushTimer.current) clearTimeout(strumFlushTimer.current);
        if (strobeFlushTimer.current) clearTimeout(strobeFlushTimer.current);
    }, []);

    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            if (document.hidden) return;
            syncPoints(false);
        }, 60000);
        return () => clearInterval(interval);
    }, [user, syncPoints]);

    useEffect(() => {
        const onUnload = () => {
            syncPoints(true);
        };
        const onVisibility = () => {
            if (document.hidden) {
                flushReactionBuffer();
                flushStrumBuffer();
                flushStrobeBuffer();
            }
        };
        window.addEventListener('beforeunload', onUnload);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('beforeunload', onUnload);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [user, syncPoints, flushReactionBuffer, flushStrumBuffer, flushStrobeBuffer]);

    useEffect(() => {
        if (!room?.readyCheck?.active) {
            setReadyTimer(0);
            return;
        }
        const durationMs = Math.max(3000, Math.floor((room.readyCheck.durationSec || 10) * 1000));
        const start = room.readyCheck.startTime || Date.now();
        const startKey = `${start}-${durationMs}`;
        if (readyCheckStartRef.current !== startKey) {
            readyCheckStartRef.current = startKey;
            if (user?.isReady) {
                updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), { isReady: false }).catch(() => {});
            }
        }
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((durationMs - (Date.now() - start)) / 1000));
            setReadyTimer(remaining);
        };
        tick();
        const interval = setInterval(tick, 200);
        return () => clearInterval(interval);
    }, [room?.readyCheck?.active, room?.readyCheck?.startTime, room?.readyCheck?.durationSec, user?.isReady, roomCode, uid]);

    useEffect(() => {
        if (!room?.bingoMysteryRng?.active) return;
        const timer = setInterval(() => setBingoRngNow(Date.now()), 250);
        return () => clearInterval(timer);
    }, [room?.bingoMysteryRng?.active]);

    useEffect(() => {
        const victory = room?.guitarVictory;
        if (!victory || victory.uid !== uid) return;
        if (victory.status === 'pending') {
            setGuitarVictoryInfo(victory);
            setGuitarVictoryOpen(true);
        } else {
            setGuitarVictoryOpen(false);
        }
    }, [room?.guitarVictory?.id, room?.guitarVictory?.status, room?.guitarVictory, uid]);

    useEffect(() => {
        const victory = room?.strobeVictory;
        if (!victory || victory.uid !== uid) return;
        if (victory.status === 'pending') {
            setStrobeVictoryInfo(victory);
            setStrobeVictoryOpen(true);
        } else {
            setStrobeVictoryOpen(false);
        }
    }, [room?.strobeVictory?.id, room?.strobeVictory?.status, room?.strobeVictory, uid]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                try { await videoRef.current.play(); } catch {
                    // Autoplay can fail silently; ignore.
                }
            }
            setCameraActive(true);
            setCameraError('');
        } catch (err) {
            console.error(err);
            setCameraError('Camera permission is blocked. Enable it to continue.');
            setCameraActive(false);
        }
    };

    // Selfie Cam / Selfie Challenge
    useEffect(() => {
        if (!user) return;
        const isChallengeParticipant = room?.activeMode === 'selfie_challenge' && room?.selfieChallenge?.participants?.includes(uid);
        const isVictoryCapture = guitarVictoryOpen || strobeVictoryOpen;
        const shouldUseCamera = room?.activeMode === 'selfie_cam' || isChallengeParticipant || isVictoryCapture;
        if (shouldUseCamera && (!cameraActive || !videoRef.current?.srcObject)) {
            startCamera();
        } else if (!shouldUseCamera && cameraActive) {
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(t => t.stop());
                videoRef.current.srcObject = null;
            }
            setCameraActive(false);
        }
    }, [room?.activeMode, room?.selfieChallenge?.participants, guitarVictoryOpen, strobeVictoryOpen, user, cameraActive, uid]);

    useEffect(() => {
        const videoEl = videoRef.current;
        return () => {
            if (videoEl?.srcObject) {
                videoEl.srcObject.getTracks().forEach(t => t.stop());
                videoEl.srcObject = null;
            }
        };
    }, []);

    // Search via Functions to avoid CORS proxy failures
    useEffect(() => { 
        if(searchQ.length < 3) { setResults([]); return; } 
        let canceled = false;
        const t = setTimeout(async () => { 
            try {
                const data = await callFunction('itunesSearch', { term: searchQ, limit: 6 });
                if (canceled) return;
                setResults(data?.results || []);
            } catch {
                if (canceled) return;
                setResults([]);
            }
        }, 500); 
        return () => {
            clearTimeout(t);
            canceled = true;
        }; 
    }, [searchQ]);

    useEffect(() => {
        if (songsTab === 'browse') return;
        setActiveBrowseList(null);
        setShowTop100(false);
        setShowYtIndex(false);
    }, [songsTab]);

    useEffect(() => {
        if (tight15SearchQ.length < 3) { setTight15Results([]); return; }
        let canceled = false;
        const t = setTimeout(async () => {
            try {
                const data = await callFunction('itunesSearch', { term: tight15SearchQ, limit: 6 });
                if (canceled) return;
                setTight15Results(data?.results || []);
            } catch {
                if (canceled) return;
                setTight15Results([]);
            }
        }, 500);
        return () => {
            clearTimeout(t);
            canceled = true;
        };
    }, [tight15SearchQ]);

    // Guitar Handling
    const handleGuitarTouch = (e) => {
        if (!user) return;
        const touch = e.touches[0];
        const rect = e.currentTarget.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const stringWidth = rect.width / 5;
        const stringIdx = Math.floor(x / stringWidth);
        
        if (stringIdx >= 0 && stringIdx < 5) {
                handleStrum(stringIdx);
        }
    };

    const handleStrum = async (i) => {
        if(!user) return;
        setStrings(prev => { const next = [...prev]; next[i] = 1; return next; });
        if (stringTimers.current[i]) clearTimeout(stringTimers.current[i]);
        stringTimers.current[i] = setTimeout(() => {
            setStrings(prev => { const next = [...prev]; next[i] = 0; return next; });
        }, 500);
        try { if(window.navigator && window.navigator.vibrate) window.navigator.vibrate(80); } catch (_err) { /* ignore */ }

        const now = Date.now();
        if(now - lastStrum.current > 200) {
            // Emit a strum reaction for TV and other clients (throttled)
            queueStrumWrite();
            lastStrum.current = now;
            markActive();

            queuePointDelta(2);
        }
    };

    const join = async (override = null) => {
        const rawName = override?.name ?? form.name;
        const rawEmoji = override?.emoji ?? form.emoji;
        const safeName = clampName(rawName.trim());
        if(!safeName) return;
        markActive();
        const selectedStatus = getAvatarStatus(AVATAR_CATALOG.find(a => a.emoji === rawEmoji) || AVATAR_CATALOG[0]);
        const finalEmoji = selectedStatus.locked ? DEFAULT_EMOJI : rawEmoji;
        const userRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`);
        await setDoc(userRef, getRoomUserProjection({
            name: safeName,
            avatar: finalEmoji,
            points: 100,
            totalEmojis: 0,
            lastSeen: true
        }));
        try { await updateDoc(userRef, { visits: increment(1), lastSeen: serverTimestamp(), lastActiveAt: serverTimestamp() }); } catch {
            // Ignore visit tracking failures.
        }
        if (typeof window !== 'undefined') {
            const key = `beaurocks_returning_${uid || 'guest'}`;
            try {
                localStorage.setItem(key, JSON.stringify({ name: safeName, emoji: finalEmoji, lastRoom: roomCode || '' }));
            } catch {
                // Ignore storage failures.
            }
        }
        trackEvent('singer_join', { room_code: roomCode });
        logActivity('joined the party', EMOJI.wave);
    };
    
    const sendChatMessage = async (overrideText = null) => {
        const isEventLike = !!overrideText
            && typeof overrideText === 'object'
            && (
                typeof overrideText.preventDefault === 'function'
                || 'nativeEvent' in overrideText
                || 'target' in overrideText
            );
        const rawMessage = isEventLike ? chatMsg : (overrideText ?? chatMsg);
        const message = String(rawMessage ?? '').trim();
        if (!message) return;
        if (!roomCode || !user) return;
        if (room?.chatEnabled === false) {
            toast('Chat is off right now');
            return;
        }
        const localCooldownMs = 1500;
        const nowMs = Date.now();
        if (nowMs - chatLastSentRef.current < localCooldownMs) {
            toast('Slow down a sec');
            return;
        }
        const isLounge = chatTab === 'lounge';
        if (isLounge && room?.chatAudienceMode === 'vip' && !isVipAccount) {
            toast('VIP-only chat is live right now');
            return;
        }
        if (user?.chatMuted) {
            toast('You are muted by the host');
            return;
        }
        const capCount = Math.max(0, Number(room?.chatMessageCap || 0));
        const capWindowMin = Math.max(1, Number(room?.chatMessageWindowMin || 10));
        if (capCount > 0) {
            const windowMs = capWindowMin * 60 * 1000;
            chatSendTimesRef.current = chatSendTimesRef.current.filter(ts => nowMs - ts < windowMs);
            if (chatSendTimesRef.current.length >= capCount) {
                const waitMin = Math.ceil((windowMs - (nowMs - chatSendTimesRef.current[0])) / 60000);
                toast(`Chat limit reached. Try again in ${waitMin} min.`);
                return;
            }
            chatSendTimesRef.current.push(nowMs);
        }
        const slowSec = Math.max(0, Number(room?.chatSlowModeSec || 0));
        const now = Date.now();
        if (slowSec > 0 && now - chatLastSentRef.current < slowSec * 1000) {
            const wait = Math.ceil((slowSec * 1000 - (now - chatLastSentRef.current)) / 1000);
            toast(`Slow mode: wait ${wait}s`);
            return;
        }
        markActive();
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'chat_messages'), {
            roomCode,
            text: message,
            user: user.name,
            avatar: user.avatar,
            uid,
            isVip: !!user.isVip || (profile?.vipLevel || 0) > 0,
            toHost: !isLounge,
            channel: isLounge ? 'lounge' : 'host',
            timestamp: serverTimestamp()
        });
        chatLastSentRef.current = now;
        setChatMsg('');
    };

    const startTipCrateCheckout = async (crate) => {
        try {
            const payload = await billingProvider.purchaseTipCrate({
                crate,
                roomCode,
                userUid: uid,
                userName: user?.name || 'Guest'
            });
            if (payload?.url) {
                window.location.href = payload.url;
                return;
            }
            const fallback = room?.tipUrl || 'https://venmo.com/u/Beau-Ross-2';
            window.open(fallback);
        } catch (e) {
            console.error(e);
            if (billingPlatform === BILLING_PLATFORMS.IOS) {
                toast('iOS in-app purchases are unavailable in this build. Use web checkout.');
                return;
            }
            toast('Checkout is unavailable right now.');
            const fallback = room?.tipUrl || 'https://venmo.com/u/Beau-Ross-2';
            window.open(fallback);
        }
    };

    const startPersonalPackCheckout = async (pack) => {
        try {
            const payload = await billingProvider.purchasePointsPack({
                pack,
                roomCode,
                userUid: uid,
                userName: user?.name || 'Guest'
            });
            if (payload?.url) {
                window.location.href = payload.url;
                return;
            }
        } catch (e) {
            console.error(e);
            if (billingPlatform === BILLING_PLATFORMS.IOS) {
                toast('iOS in-app purchases are unavailable in this build. Use web checkout.');
                return;
            }
            toast('Checkout is unavailable right now.');
        }
    };

    const _startSubscriptionCheckout = async (plan) => {
        try {
            const payload = await billingProvider.purchaseSubscription({
                plan,
                userUid: uid,
                userName: user?.name || 'Guest'
            });
            if (payload?.url) {
                window.location.href = payload.url;
                return;
            }
        } catch (e) {
            console.error(e);
            if (billingPlatform === BILLING_PLATFORMS.IOS) {
                toast('iOS subscriptions are unavailable in this build. Use web checkout.');
                return;
            }
            toast('Subscriptions are unavailable right now.');
        }
    };

    const readyUp = async () => {
        if (!user || !room?.readyCheck?.active) return;
        if (user.isReady) return toast('Already marked ready.');
        const rewardPoints = Math.max(0, Number(room?.readyCheck?.rewardPoints ?? 100));
        markActive();
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), {
            isReady: true,
            points: increment(rewardPoints),
            lastActiveAt: serverTimestamp()
        });
        toast(`READY! +${rewardPoints} PTS`);
    };

    const captureSelfieCanvas = () => {
        if (!videoRef.current) return null;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 0;
        canvas.height = videoRef.current.videoHeight || 0;
        if (!canvas.width || !canvas.height) return null;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(videoRef.current, 0, 0);
        return canvas;
    };

    const canvasToJpegBlob = (canvas, quality = 0.6) => new Promise((resolve, reject) => {
        if (!canvas) {
            reject(new Error('Missing selfie canvas'));
            return;
        }
        if (canvas.toBlob) {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Failed to encode selfie image'));
            }, 'image/jpeg', quality);
            return;
        }
        try {
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            fetch(dataUrl).then((resp) => resp.blob()).then(resolve).catch(reject);
        } catch (err) {
            reject(err);
        }
    });

    const uploadSelfieBlob = async (blob, suffix = 'selfie') => {
        if (!blob || !roomCode) throw new Error('Missing selfie payload');
        const safeUid = (uid || user?.uid || auth?.currentUser?.uid || 'guest').trim() || 'guest';
        const storagePath = `room_photos/${roomCode}/${safeUid}/${Date.now()}_${suffix}_${Math.random().toString(36).slice(2, 8)}.jpg`;
        const fileRef = storageRef(storage, storagePath);
        const task = uploadBytesResumable(fileRef, blob, { contentType: 'image/jpeg' });
        await new Promise((resolve, reject) => {
            task.on('state_changed', undefined, reject, resolve);
        });
        const url = await getDownloadURL(task.snapshot.ref);
        return { url, storagePath };
    };

    const captureAndUploadSelfie = async ({ quality = 0.6, suffix = 'selfie' } = {}) => {
        const canvas = captureSelfieCanvas();
        if (!canvas) throw new Error('Camera frame unavailable');
        const blob = await canvasToJpegBlob(canvas, quality);
        return uploadSelfieBlob(blob, suffix);
    };

    const takeSelfie = async () => {
        if (!videoRef.current || !user) return;
        try {
            const photo = await captureAndUploadSelfie({ quality: 0.5, suffix: 'reaction' });
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), {
                roomCode,
                type: 'photo',
                url: photo.url,
                storagePath: photo.storagePath,
                userName: user.name,
                timestamp: serverTimestamp()
            });
            logActivity('shared a selfie', EMOJI.camera);
            toast(`Snapped & Sent! ${EMOJI.camera}`);
        } catch (e) {
            console.error(e);
            toast('Selfie upload failed');
        }
    };

    const takeGuitarVictorySelfie = async () => {
        if (!videoRef.current || !user || !guitarVictoryInfo) return;
        try {
            const photo = await captureAndUploadSelfie({ quality: 0.6, suffix: 'guitar_victory' });
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), {
                roomCode,
                type: 'photo',
                mode: 'guitar_victory',
                url: photo.url,
                storagePath: photo.storagePath,
                userName: user.name,
                avatar: user.avatar,
                timestamp: serverTimestamp()
            });
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
                photoOverlay: {
                    url: photo.url,
                    userName: user.name,
                    mode: 'guitar_victory',
                    copy: `Shredded ${guitarVictoryInfo.hits || 0} hits`,
                    timestamp: Date.now()
                },
                guitarVictory: {
                    ...guitarVictoryInfo,
                    status: 'captured',
                    photoUrl: photo.url,
                    capturedAt: Date.now()
                }
            });
            setGuitarVictoryOpen(false);
            toast('Victory selfie sent!');
        } catch (e) {
            console.error(e);
            toast('Failed to send victory selfie');
        }
    };

    const takeStrobeVictorySelfie = async () => {
        if (!videoRef.current || !user || !strobeVictoryInfo) return;
        try {
            const photo = await captureAndUploadSelfie({ quality: 0.6, suffix: 'strobe_victory' });
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), {
                roomCode,
                type: 'photo',
                mode: 'strobe_victory',
                url: photo.url,
                storagePath: photo.storagePath,
                userName: user.name,
                avatar: user.avatar,
                timestamp: serverTimestamp()
            });
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), {
                photoOverlay: {
                    url: photo.url,
                    userName: user.name,
                    mode: 'strobe_victory',
                    copy: `Beat Drop MVP: ${strobeVictoryInfo.taps || 0} taps`,
                    timestamp: Date.now()
                },
                strobeVictory: {
                    ...strobeVictoryInfo,
                    status: 'captured',
                    photoUrl: photo.url,
                    capturedAt: Date.now()
                }
            });
            setStrobeVictoryOpen(false);
            toast('Victory selfie sent!');
        } catch (e) {
            console.error(e);
            toast('Failed to send victory selfie');
        }
    };

    const submitSelfieChallenge = async () => {
        if (!videoRef.current || !user || !room?.selfieChallenge?.promptId) return;
        try {
            const photo = await captureAndUploadSelfie({ quality: 0.5, suffix: 'challenge' });
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_submissions'), {
                roomCode,
                promptId: room.selfieChallenge.promptId,
                uid,
                userName: user.name,
                avatar: user.avatar,
                url: photo.url,
                storagePath: photo.storagePath,
                approved: !room?.selfieChallenge?.requireApproval,
                timestamp: serverTimestamp()
            });
            toast('Selfie submitted');
        } catch (e) {
            console.error(e);
            toast('Selfie submit failed');
        }
    };

    const react = async (type, cost=10) => { 
        if ((room?.activeMode === 'applause' || room?.activeMode === 'applause_result') && type === 'clap') cost = 0;
        if(!user || getEffectivePoints() < cost) return toast(`Need ${cost} pts!`); 
        const now = Date.now();
        if (now - lastReactionAt.current < 350) {
            triggerCooldownFlash();
            return;
        }
        lastReactionAt.current = now;
        markActive();
        
        const id = Date.now(); 
        setLocalReactions(prev => [...prev, { id, type, left: Math.random() * 80 + 10 }]); 
        setTimeout(() => setLocalReactions(prev => prev.filter(r => r.id !== id)), 4000);

        try {
            queueReactionWrite(type, cost);
            if (cost > 0) { 
                queuePointDelta(-cost);
            }
        } catch (error) { console.error(error); }
    };

    const submitPopTriviaVote = async (optionIndex) => {
        if (!user || !roomCode || !popTriviaQuestionId) return;
        if (popTriviaSubmitting) return;
        if (popTriviaMyVote !== null) return;

        setPopTriviaSubmitting(true);
        try {
            const existingQuery = query(
                collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'),
                where('roomCode', '==', roomCode),
                where('questionId', '==', popTriviaQuestionId)
            );
            const existingSnap = await getDocs(existingQuery);
            const deduped = dedupeQuestionVotes(
                existingSnap.docs.map((docSnap) => docSnap.data()),
                POP_TRIVIA_VOTE_TYPE
            );
            const alreadyVoted = deduped.some((vote) => vote?.uid && uid && vote.uid === uid);
            if (alreadyVoted) {
                toast('Answer already locked.');
                return;
            }

            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'reactions'), {
                roomCode,
                type: POP_TRIVIA_VOTE_TYPE,
                val: optionIndex,
                questionId: popTriviaQuestionId,
                songId: currentSinger?.id || '',
                userName: user.name || 'Player',
                avatar: user.avatar || DEFAULT_EMOJI,
                uid: uid || null,
                isVote: true,
                timestamp: serverTimestamp()
            });
            toast('Answer locked.');
        } catch (error) {
            console.error('Failed to submit pop trivia vote', error);
            toast('Could not submit answer.');
        } finally {
            setPopTriviaSubmitting(false);
        }
    };
    
    const submitSong = async (s, a, art, options = {}) => { 
        if(!user) return; 
        const queueSettings = room?.queueSettings || {};
        const limitMode = queueSettings.limitMode || 'none';
        const limitCount = Math.max(0, Number(queueSettings.limitCount || 0));
        const nowMs = Date.now();
        const mySongs = songs.filter(song => song.singerUid === uid || song.singerName === user.name);
        const myRecentSongs = mySongs.filter(song => {
            const ts = song.timestamp?.seconds ? song.timestamp.seconds * 1000 : song.timestamp?.toMillis?.() || 0;
            return ts && nowMs - ts < 60 * 60 * 1000;
        });
        const myTotalCount = mySongs.length;
        const myHourCount = myRecentSongs.length;
        if (limitMode !== 'none' && limitCount > 0) {
            const exceeded = (limitMode === 'per_night' && myTotalCount >= limitCount) ||
                (limitMode === 'per_hour' && myHourCount >= limitCount);
            if (exceeded && limitMode !== 'soft') {
                toast('You have reached the host song limit.');
                return;
            }
        }
        try {
            const song = s || form.song; const artist = a || form.artist; const artwork = art || form.art; 
            if(!song) return; 
            markActive();
            const rotation = queueSettings.rotation || 'first_come';
            const firstTimeBoost = !!queueSettings.firstTimeBoost;
            const queuedCount = songs.filter(songItem => (songItem.singerUid === uid || songItem.singerName === user.name) && (songItem.status === 'requested' || songItem.status === 'pending' || songItem.status === 'performing')).length;
            const performedCount = songs.filter(songItem => (songItem.singerUid === uid || songItem.singerName === user.name) && songItem.status === 'performed').length;
            let priorityScore = Date.now();
            if (rotation === 'round_robin') {
                priorityScore += queuedCount * 60000;
            }
            if (firstTimeBoost && performedCount === 0) {
                priorityScore -= 120000;
            }
            const enforcePending = (limitMode === 'soft' && limitCount > 0 && myTotalCount >= limitCount);
            const allowTrack = !!room?.allowSingerTrackSelect || !!options.allowTrack || !!options.mediaUrl;
            const backingUrl = (options.mediaUrl || (allowTrack ? form.backingUrl : '') || '').trim();
            const trackSource = options.trackSource || 'youtube';
            if (backingUrl && trackSource === 'youtube' && !extractYouTubeId(backingUrl)) {
                toast('Use a valid YouTube URL for the backing track.');
                return;
            }

            const songRecord = await ensureSong({
                title: song,
                artist: artist || 'Unknown',
                artworkUrl: artwork || '',
                itunesId: options.itunesId || ''
            });

            const trackRecord = backingUrl ? await ensureTrack({
                songId: songRecord?.songId || '',
                source: trackSource,
                mediaUrl: backingUrl,
                label: options.trackLabel || (options.mediaUrl ? 'Host index' : 'Singer selected'),
                addedBy: uid
            }) : null;

            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs'), {
                roomCode,
                songTitle: song,
                artist: artist,
                albumArtUrl: artwork || '',
                singerName: user.name,
                singerUid: uid,
                emoji: user.avatar,
                status: (room?.bouncerMode || enforcePending) ? 'pending' : 'requested',
                timestamp: serverTimestamp(),
                priorityScore,
                songId: songRecord?.songId || null,
                trackId: trackRecord?.trackId || null,
                trackSource: backingUrl ? trackSource : null,
                mediaUrl: backingUrl || ''
            }); 
            trackEvent('song_request', { room_code: roomCode, source: room?.bouncerMode ? 'bouncer' : 'standard' });
            setForm(prev => ({...prev, song:'', artist:'', art:'', backingUrl: ''})); 
            setSearchQ(''); setResults([]); toast("Request Sent!"); 
            logActivity(`requested ${song}`, EMOJI.musicNotes);
            syncPoints(true);
        } catch (_err) { toast("Error sending request"); }
    };
    
    const deleteMyRequest = async (id) => { await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'karaoke_songs', id)); toast("Request Deleted"); };
    

    const updateProfile = async () => { 
        const safeName = clampName(form.name.trim());
        const oldName = user.name;
        const selectedStatus = getAvatarStatus(AVATAR_CATALOG.find(a => a.emoji === form.emoji) || AVATAR_CATALOG[0]);
        const nextAvatar = selectedStatus.locked ? user.avatar : form.emoji;
        const normalizedVipForm = normalizeVipForm(vipForm);
        const nextVipTosAccepted = vipTosAccepted || normalizedVipForm.tosAccepted;
        if (isVipAccount) {
            const vipErr = getVipProfileValidationError({
                ...normalizedVipForm,
                tosAccepted: nextVipTosAccepted
            });
            if (vipErr) {
                toast(vipErr);
                setShowVipOnboarding(true);
                return;
            }
        }
        const nameEmojiChanged = safeName !== oldName || nextAvatar !== user.avatar;
        const changeCost = getNameEmojiChangeCost();
        if (nameEmojiChanged && changeCost > 0 && getEffectivePoints() < changeCost) {
            toast(`Need ${changeCost} PTS to change name/emoji.`);
            return;
        }
        await updateDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`),
            getRoomUserProjection({ name: safeName, avatar: nextAvatar })
        );
        if (uid) {
            const vipProfileUpdate = isVipAccount ? {
                vipProfile: {
                    location: normalizedVipForm.location,
                    birthMonth: normalizedVipForm.birthMonth,
                    birthDay: normalizedVipForm.birthDay,
                    smsOptIn: normalizedVipForm.smsOptIn,
                    tosAccepted: nextVipTosAccepted,
                    tosAcceptedAt: nextVipTosAccepted
                        ? (profile?.vipProfile?.tosAcceptedAt || serverTimestamp())
                        : null
                }
            } : {};
            const nameEmojiUpdate = nameEmojiChanged ? {
                nameEmojiChangeCount: increment(1)
            } : {};
            await setDoc(doc(db, 'users', uid), { name: safeName, avatar: nextAvatar, ...vipProfileUpdate, ...nameEmojiUpdate }, { merge: true });
        }
        if (nameEmojiChanged && changeCost > 0) {
            queuePointDelta(-changeCost);
            syncPoints(true);
        }
        if(oldName !== safeName) logActivity(`changed name to ${safeName}`, EMOJI.pencil);
        setShowProfile(false); 
        toast("Profile Updated"); 
    };

    const saveVipOnboarding = async () => {
        if (!uid) return;
        const normalizedVipForm = normalizeVipForm(vipForm);
        const validationError = getVipProfileValidationError(normalizedVipForm);
        if (validationError) {
            toast(validationError);
            return;
        }
        const updates = {
            vipProfile: {
                location: normalizedVipForm.location,
                birthMonth: normalizedVipForm.birthMonth,
                birthDay: normalizedVipForm.birthDay,
                smsOptIn: normalizedVipForm.smsOptIn,
                tosAccepted: true,
                tosAcceptedAt: profile?.vipProfile?.tosAcceptedAt || serverTimestamp()
            }
        };
        await setDoc(doc(db, 'users', uid), updates, { merge: true });
        setShowVipOnboarding(false);
        toast('VIP profile saved');
    };

    const getNameEmojiChangeCost = () => {
        const count = profile?.nameEmojiChangeCount || 0;
        if (count === 0) return 0;
        return 500 * count;
    };
    const getNextNameEmojiChangeCost = () => {
        const count = profile?.nameEmojiChangeCount || 0;
        return 500 * (count + 1);
    };
    const openEditProfile = () => {
        setForm(prev => ({ ...prev, name: clampName(user.name || ''), emoji: user.avatar }));
        setShowProfile(true);
    };

    const openPublicProfile = async (u) => {
        if (!u) return;
        setPublicProfileOpen(true);
        setPublicProfileLoading(true);
        setPublicProfileUser(u);
        setPublicProfileData(null);
        try {
            if (u.uid) {
                const snap = await getDoc(doc(db, 'users', u.uid));
                if (snap.exists()) setPublicProfileData(snap.data());
            }
        } catch (e) {
            console.warn('Failed to load profile', e);
        } finally {
            setPublicProfileLoading(false);
        }
    };

    const canSaveTight15 = !isAnon;
    const getTight15List = () => {
        const persistent = Array.isArray(profile?.tight15) ? profile.tight15 : [];
        const temporary = Array.isArray(user?.tight15Temp) ? user.tight15Temp : [];
        if (canSaveTight15) {
            return sanitizeTight15List(persistent.length ? persistent : temporary);
        }
        return sanitizeTight15List(temporary);
    };

    const saveTight15List = async (next) => {
        if (!uid) return;
        const sanitized = sanitizeTight15List(next);
        if (!canSaveTight15) {
            await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), { tight15Temp: sanitized }, { merge: true });
            return;
        }
        await setDoc(doc(db, 'users', uid), { tight15: sanitized }, { merge: true });
    };

    const addToTight15 = async (item) => {
        if (!uid) return toast('Not signed in');
        try {
            const existing = getTight15List();
            const entry = normalizeTight15Entry(item);
            if (!entry) {
                toast('Add both song and artist.');
                return;
            }
            const nextKey = getTight15Key(entry);
            if (existing.find(s => getTight15Key(s) === nextKey)) return toast('Already in Tight 15');
            if (existing.length >= TIGHT15_MAX) {
                toast(`Tight 15 is full (${TIGHT15_MAX}/${TIGHT15_MAX}). Remove one first.`);
                return;
            }
            await saveTight15List([...existing, entry]);
            toast('Added to Tight 15');
        } catch (e) { console.error(e); toast('Add failed'); }
    };

    const removeFromTight15 = async (id) => {
        if (!uid) return;
        try {
            const cur = getTight15List();
            const next = cur.filter(i => i.id !== id);
            await saveTight15List(next);
            toast('Removed');
        } catch (e) { console.error(e); toast('Remove failed'); }
    };

    const reorderTight15 = async (fromIdx, toIdx) => {
        if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;
        const cur = [...getTight15List()];
        const [moved] = cur.splice(fromIdx, 1);
        cur.splice(toIdx, 0, moved);
        try {
            await saveTight15List(cur);
            toast('Order updated');
        } catch (e) {
            console.error(e);
            toast('Reorder failed');
        }
    };
    const handleTight15TouchStart = (idx) => {
        tight15TouchRef.current = idx;
        setDragIndex(idx);
    };
    const handleTight15TouchMove = (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const row = el?.closest('[data-tight15-index]');
        if (row) {
            const idx = parseInt(row.getAttribute('data-tight15-index'), 10);
            if (!Number.isNaN(idx)) setDragOverIndex(idx);
        }
    };
    const handleTight15TouchEnd = () => {
        if (tight15TouchRef.current !== null && dragOverIndex !== null) {
            reorderTight15(tight15TouchRef.current, dragOverIndex);
        }
        tight15TouchRef.current = null;
        setDragIndex(null);
        setDragOverIndex(null);
    };

    const getRecentMySongs = () => {
        const seen = new Set();
        const mine = songs
            .filter((s) => {
                if (uid && s.singerUid) return s.singerUid === uid;
                return s.singerName === user?.name;
            })
            .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        const unique = [];
        for (const s of mine) {
            const key = `${normalizeTight15Text(s.songTitle)}__${normalizeTight15Text(s.artist)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(s);
            if (unique.length >= 8) break;
        }
        return unique;
    };

    const importRecentToTight15 = async () => {
        const recent = getRecentMySongs();
        if (!recent.length) return toast('No recent songs');
        const existing = getTight15List();
        const next = [...existing];
        const slotsLeft = Math.max(0, TIGHT15_MAX - existing.length);
        if (slotsLeft <= 0) {
            toast(`Tight 15 is full (${TIGHT15_MAX}/${TIGHT15_MAX}).`);
            return;
        }
        const seen = new Set(existing.map((entry) => getTight15Key(entry)));
        let importedCount = 0;
        recent.forEach(s => {
            if (importedCount >= slotsLeft) return;
            const candidate = normalizeTight15Entry({
                songTitle: s.songTitle,
                artist: s.artist,
                albumArtUrl: s.albumArtUrl || ''
            });
            if (!candidate) return;
            const key = getTight15Key(candidate);
            if (seen.has(key)) return;
            seen.add(key);
            next.push(candidate);
            importedCount += 1;
        });
        if (!importedCount) {
            toast('No new songs to import.');
            return;
        }
        await saveTight15List(next);
        toast(`Imported ${importedCount} song${importedCount === 1 ? '' : 's'}.`);
    };

    const composeSelfie = useCallback(async (photoUrl) => {
        const base = await loadImage(photoUrl);
        const logo = await loadImage(room?.logoUrl || ASSETS.logo);
        const canvas = document.createElement('canvas');
        canvas.width = base.width;
        canvas.height = base.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(base, 0, 0);

        const maxLogoWidth = Math.max(120, Math.round(base.width * 0.25));
        const scale = Math.min(maxLogoWidth / logo.width, 1);
        const logoW = Math.round(logo.width * scale);
        const logoH = Math.round(logo.height * scale);
        const pad = Math.max(12, Math.round(base.width * 0.03));

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(base.width - logoW - pad * 2, base.height - logoH - pad * 2, logoW + pad, logoH + pad);
        ctx.drawImage(logo, base.width - logoW - pad, base.height - logoH - pad, logoW, logoH);

        return canvas.toDataURL('image/jpeg', 0.92);
    }, [room?.logoUrl]);

    const dataUrlToBlob = (dataUrl) => {
        const parts = dataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)[1];
        const binary = atob(parts[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) array[i] = binary.charCodeAt(i);
        return new Blob([array], { type: mime });
    };

    const saveComposedPhoto = () => {
        if (!composedPhoto) return;
        const link = document.createElement('a');
        link.href = composedPhoto;
        link.download = `bross-selfie-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const shareComposedPhoto = async () => {
        if (!composedPhoto) return;
        if (!navigator.share) return toast('Sharing not available');
        try {
            const blob = dataUrlToBlob(composedPhoto);
            const file = new File([blob], 'bross-selfie.jpg', { type: blob.type });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'BROSS selfie', text: 'My BROSS selfie' });
            } else {
                await navigator.share({ title: 'BROSS selfie', text: 'My BROSS selfie' });
            }
        } catch (e) {
            console.error(e);
            toast('Share failed');
        }
    };


    const recapVerifierRef = useRef(null);
    const recapReadyRef = useRef(false);
    const recapContainerIdRef = useRef('');

    const normalizePhoneNumber = (value = '') => {
        const trimmed = value.trim();
        if (!trimmed) return '';
        const cleaned = trimmed.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
        return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    };

    const initRecaptchaVerifier = async (containerId) => {
        if (typeof window === 'undefined') return false;
        const targetContainerId = containerId || 'recap-container-vip';
        const hasContainerChanged = recapContainerIdRef.current && recapContainerIdRef.current !== targetContainerId;
        if (hasContainerChanged && recapVerifierRef.current) {
            try { recapVerifierRef.current.clear(); } catch {
                // Ignore recaptcha cleanup errors.
            }
            recapVerifierRef.current = null;
            recapReadyRef.current = false;
            recapContainerIdRef.current = '';
        }
        if (recapReadyRef.current && recapVerifierRef.current && recapContainerIdRef.current === targetContainerId) return true;

        const el = document.getElementById(targetContainerId);
        if (!el) {
            console.warn('reCAPTCHA container missing', targetContainerId);
            return false;
        }
        if (recapVerifierRef.current) {
            try { recapVerifierRef.current.clear(); } catch {
                // Ignore recaptcha cleanup errors.
            }
        }
        recapVerifierRef.current = new RecaptchaVerifier(auth, targetContainerId, { size: 'invisible' });
        try {
            await recapVerifierRef.current.render();
            recapReadyRef.current = true;
            recapContainerIdRef.current = targetContainerId;
            return true;
        } catch (e) {
            console.warn('reCAPTCHA render failed', e);
            return false;
        }
    };

    // Phone/SMS VIP flow: send SMS and link phone to current (anonymous) user
    const startPhoneAuth = async (containerId) => {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        if (!/^\+\d{7,15}$/.test(normalizedPhone)) {
            toast('Enter a valid phone number in E.164 format (example: +15555555555)');
            return;
        }
        setPhoneLoading(true);
        try {
            if (!auth) {
                toast('Auth unavailable. Reload and try again.');
                setPhoneLoading(false);
                return;
            }
            const host = typeof window !== 'undefined' ? window.location?.hostname : '';
            if (auth.settings && (host === 'localhost' || host === '127.0.0.1')) {
                auth.settings.appVerificationDisabledForTesting = true;
            }
            const bypassActive = !!auth.settings?.appVerificationDisabledForTesting;
            let appVerifier = null;
            if (!bypassActive) {
                console.warn('App verification bypass is off; reCAPTCHA required.');
            }
            const ready = await initRecaptchaVerifier(containerId);
            if (!ready) {
                toast('reCAPTCHA failed to initialize. Reload and try again.');
                setPhoneLoading(false);
                return;
            }
            appVerifier = recapVerifierRef.current;
            const confirmation = await signInWithPhoneNumber(auth, normalizedPhone, appVerifier);
            // confirmation may expose verificationId
            const vid = confirmation.verificationId || null;
            setVerificationId(vid);
            // save confirmation for fallback confirm
            window._bross_confirmation = confirmation;
            setSmsSent(true);
            setPhoneNumber(normalizedPhone);
            toast('SMS sent - enter the code');
        } catch (e) {
            console.error('SMS send error', e);
            const code = e?.code || '';
            if (code.includes('too-many-requests')) {
                toast('Too many attempts. Wait a few minutes, then try again.');
            } else if (code.includes('invalid-phone-number')) {
                toast('Invalid phone number format. Use +countrycode then number.');
            } else if (code.includes('captcha-check-failed')) {
                toast('reCAPTCHA check failed. Refresh and retry.');
            } else {
                toast('Failed to send SMS');
            }
        } finally { setPhoneLoading(false); }
    };

    const confirmPhoneCode = async () => {
        if (!smsCode) return toast('Enter the SMS code');
        setPhoneLoading(true);
        try {
            const vid = verificationId || (window._bross_confirmation && window._bross_confirmation.verificationId);
            if (!vid) return toast('No verification id available');
            const cred = PhoneAuthProvider.credential(vid, smsCode);
            if (!auth.currentUser) return toast('No active session');
            await linkWithCredential(auth.currentUser, cred);
            // persist VIP state and phone
            const roomUserRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`);
            await updateDoc(roomUserRef, {
                ...getRoomUserProjection({ isVip: true, vipLevel: 1, phone: phoneNumber }),
                points: increment(5000)
            });
            await setDoc(doc(db, 'users', auth.currentUser.uid), { phone: phoneNumber, vipLevel: 1 }, { merge: true });
            setShowPhoneModal(false);
            setShowVipOnboarding(true);
            setTab('request');
            setSongsTab('tight15');
            toast('Phone linked - VIP unlocked! +5000 PTS');
        } catch (e) {
            console.error('confirm error', e);
            toast('Verification failed');
        } finally { setPhoneLoading(false); }
    };

    const bypassSmsVip = async () => {
        try {
            if (!auth.currentUser) return toast('No active session');
            const roomUserRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`);
            await updateDoc(roomUserRef, {
                ...getRoomUserProjection({ isVip: true, vipLevel: 1 }),
                points: increment(5000)
            });
            await setDoc(doc(db, 'users', auth.currentUser.uid), { vipLevel: 1, isVip: true }, { merge: true });
            setShowPhoneModal(false);
            setSmsSent(false);
            setSmsCode('');
            setShowVipOnboarding(true);
            setTab('request');
            setSongsTab('tight15');
            toast('VIP unlocked (bypass)');
        } catch (e) {
            console.error('Bypass error', e);
            toast('Bypass failed');
        }
    };

    const feedbackOptions = {
        moments: ['the crowd hype', 'the stage vibe', 'the song pick', 'the reactions', 'the games', 'the DJ flow'],
        fixes: [
            'text size + readability',
            'search + add to queue',
            'queue flow + order',
            'audio mix + levels',
            'video + lyrics sync',
            'game flow',
            'scoring + points',
            'visual layout + spacing'
        ],
        vibeEmojis: ['🙂', '😐', '🔥', '🤩', '🤯']
    };

    const resolveFeedbackValue = (value, other, fallback) => {
        if (value === '__other') return other?.trim() || fallback;
        return value || fallback;
    };
    const feedbackSummary = () => {
        const moment = resolveFeedbackValue(feedbackForm.moment, feedbackForm.momentOther, 'the vibe');
        const fix = resolveFeedbackValue(feedbackForm.fix, feedbackForm.fixOther, 'a bug');
        const vibeEmoji = feedbackForm.vibeEmoji ? ` ${feedbackForm.vibeEmoji}` : '';
        return `Vibe ${feedbackForm.vibeScore}/5${vibeEmoji}. Readability ${feedbackForm.readabilityScore}/5. Best part: ${moment}. Biggest fix: ${fix}.`;
    };

    const submitFeedback = async () => {
        if (feedbackSending) return;
        if (!roomCode) return toast('Join a room first');
        if (!feedbackForm.moment || !feedbackForm.fix) {
            toast('Pick a moment and a biggest fix');
            return;
        }
        setFeedbackSending(true);
        try {
            const moment = resolveFeedbackValue(feedbackForm.moment, feedbackForm.momentOther, 'other');
            const fix = resolveFeedbackValue(feedbackForm.fix, feedbackForm.fixOther, 'other');
            await addDoc(collection(db, 'feedback'), {
                roomCode,
                uid: uid || null,
                userName: user?.name || 'Guest',
                avatar: user?.emoji || DEFAULT_EMOJI,
                vibeScore: feedbackForm.vibeScore,
                readabilityScore: feedbackForm.readabilityScore,
                vibeEmoji: feedbackForm.vibeEmoji || '',
                moment,
                fix,
                momentOther: feedbackForm.momentOther || '',
                fixOther: feedbackForm.fixOther || '',
                fixNote: feedbackForm.fixNote || '',
                extra: feedbackForm.extra || '',
                summary: feedbackSummary(),
                source: 'singer',
                createdAt: serverTimestamp()
            });
            toast('Feedback sent');
            setShowFeedbackForm(false);
            setFeedbackForm({
                vibeScore: 3,
                readabilityScore: 3,
                vibeEmoji: '',
                moment: '',
                momentOther: '',
                fix: '',
                fixOther: '',
                fixNote: '',
                extra: ''
            });
        } catch (e) {
            console.error('feedback error', e);
            toast('Feedback failed');
        } finally {
            setFeedbackSending(false);
        }
    };

    const renderFeedbackModal = () => (
        <div className="fixed inset-0 bg-black/70 z-[160] flex items-center justify-center p-6 font-saira">
            <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-[#231426] p-6 rounded-3xl w-full max-w-md border border-cyan-400/30 text-left shadow-[0_0_60px_rgba(0,196,217,0.35)] max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Feedback</div>
                        <div className="text-2xl font-black text-white">Help us tune the night</div>
                    </div>
                    <button onClick={() => setShowFeedbackForm(false)} className="text-zinc-300 hover:text-white">
                        <i className="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>
                <div className="space-y-3">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-zinc-400">
                            <span>Vibe score</span>
                            <span className="text-zinc-200">{feedbackForm.vibeScore}/5</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={feedbackForm.vibeScore}
                            onChange={e => setFeedbackForm(prev => ({ ...prev, vibeScore: parseInt(e.target.value, 10) }))}
                            className="w-full accent-[#00C4D9]"
                        />
                        <div className="flex items-center gap-2">
                            {feedbackOptions.vibeEmojis.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => setFeedbackForm(prev => ({ ...prev, vibeEmoji: emoji }))}
                                    className={`text-xl px-2 py-1 rounded-lg border ${feedbackForm.vibeEmoji === emoji ? 'border-[#00C4D9] bg-[#00C4D9]/10' : 'border-white/10 bg-black/30'}`}
                                    type="button"
                                    title="Pick a vibe emoji"
                                >
                                    {emoji}
                                </button>
                            ))}
                            <span className="text-xs text-zinc-400">Pick a vibe</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-zinc-400">
                            <span>Text readability</span>
                            <span className="text-zinc-200">{feedbackForm.readabilityScore}/5</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={feedbackForm.readabilityScore}
                            onChange={e => setFeedbackForm(prev => ({ ...prev, readabilityScore: parseInt(e.target.value, 10) }))}
                            className="w-full accent-pink-400"
                        />
                    </div>
                    <select
                        value={feedbackForm.moment}
                        onChange={e => setFeedbackForm(prev => ({ ...prev, moment: e.target.value }))}
                        className="w-full bg-zinc-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                    >
                        <option value="">Best part was...</option>
                        {feedbackOptions.moments.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                        <option value="__other">Other...</option>
                    </select>
                    {feedbackForm.moment === '__other' && (
                        <input
                            value={feedbackForm.momentOther}
                            onChange={e => setFeedbackForm(prev => ({ ...prev, momentOther: e.target.value }))}
                            className="w-full bg-zinc-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="That moment..."
                        />
                    )}
                    <select
                        value={feedbackForm.fix}
                        onChange={e => setFeedbackForm(prev => ({ ...prev, fix: e.target.value }))}
                        className="w-full bg-zinc-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                    >
                        <option value="">Biggest fix needed...</option>
                        {feedbackOptions.fixes.map(f => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                        <option value="__other">Other...</option>
                    </select>
                    {feedbackForm.fix === '__other' && (
                        <input
                            value={feedbackForm.fixOther}
                            onChange={e => setFeedbackForm(prev => ({ ...prev, fixOther: e.target.value }))}
                            className="w-full bg-zinc-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                            placeholder="What should we fix?"
                        />
                    )}
                    <input
                        value={feedbackForm.fixNote}
                        onChange={e => setFeedbackForm(prev => ({ ...prev, fixNote: e.target.value }))}
                        className="w-full bg-zinc-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
                        placeholder="What would help most?"
                    />
                    <textarea
                        value={feedbackForm.extra}
                        onChange={e => setFeedbackForm(prev => ({ ...prev, extra: e.target.value }))}
                        className="w-full bg-zinc-900/70 border border-white/10 rounded-xl px-3 py-2 text-sm text-white min-h-[96px]"
                        placeholder="Optional extra details..."
                    />
                    <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300">
                        {feedbackSummary()}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                setShowFeedbackForm(false);
                                setFeedbackForm({
                                    vibeScore: 3,
                                    readabilityScore: 3,
                                    vibeEmoji: '',
                                    moment: '',
                                    momentOther: '',
                                    fix: '',
                                    fixOther: '',
                                    fixNote: '',
                                    extra: ''
                                });
                            }}
                            className="bg-zinc-700 hover:bg-zinc-600 text-white py-2.5 rounded-xl font-bold transition-colors text-sm"
                            type="button"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={submitFeedback}
                            disabled={feedbackSending}
                            className="bg-emerald-400 hover:bg-emerald-300 text-black py-2.5 rounded-xl font-bold transition-colors text-sm"
                            type="button"
                        >
                            {feedbackSending ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAboutModal = () => (
        <div className="fixed inset-0 bg-black/70 z-[150] flex items-center justify-center p-6 font-saira">
            <div className="bg-gradient-to-br from-zinc-800 via-zinc-900 to-[#231426] p-7 rounded-3xl w-full max-w-md border border-pink-400/30 text-left shadow-[0_0_60px_rgba(255,103,182,0.35)]">
                <div className="flex items-center gap-4 mb-5">
                    <img src={room?.logoUrl || ASSETS.logo} className="h-24 drop-shadow-[0_0_18px_rgba(255,103,182,0.7)]" alt="BEAUROCKS KARAOKE" />
                    <div>
                        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">About</div>
                        <div className="text-2xl font-black text-white">BEAUROCKS KARAOKE</div>
                    </div>
                </div>
                <div className="bg-black/30 border border-pink-400/40 rounded-2xl p-5 mb-4">
                    <div className="text-lg font-extrabold text-white mb-2">A game from BROSS Marketing &amp; Entertainment.</div>
                    <div className="text-base text-zinc-200 leading-relaxed">
                        Built for big nights, bold voices, and crowd energy. We blend karaoke, games, and live vibes into a shared party.
                    </div>
                </div>
                <button
                    onClick={() => window.open('https://beauross.com', '_blank')}
                    className="w-full bg-gradient-to-r from-cyan-500 to-sky-400 text-black py-3 rounded-xl font-bold transition-colors text-base tracking-wide min-h-[48px] mb-4"
                >
                    Visit beauross.com
                </button>
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 mb-4">
                    <div className="text-sm uppercase tracking-widest text-zinc-300 mb-2">Feedback</div>
                    <div className="text-sm text-zinc-300 mb-3">Help us tune the night. Build a quick madlibs and send it.</div>
                    <button
                        onClick={() => setShowFeedbackForm(true)}
                        className="w-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-black py-2.5 rounded-xl font-bold transition-colors text-sm tracking-wide min-h-[44px]"
                    >
                        Leave feedback
                    </button>
                </div>
                <button onClick={() => setShowAbout(false)} className="w-full bg-zinc-700 hover:bg-zinc-600 text-white py-3 rounded-xl font-bold transition-colors text-base tracking-wide min-h-[48px]">Close</button>
            </div>
        </div>
    );

    // --- RENDER ---
    if(!user) return (
        <>
        <div
            ref={joinContainerRef}
            className="h-screen w-full bg-zinc-900 flex flex-col items-center p-3 text-center font-saira justify-start overflow-y-auto overflow-x-hidden relative custom-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        >
            <style>{PARTY_LIGHTS_STYLE}</style>
            <div className="party-lights join-lights global z-[6]">
                {Array.from({ length: 10 }).map((_, idx) => (
                    <span key={`global-a-${idx}`} className={`spotlight s${idx + 1}`} />
                ))}
            </div>
            <div className="party-lights join-lights global alt z-[6]">
                {Array.from({ length: 10 }).map((_, idx) => (
                    <span key={`global-b-${idx}`} className={`spotlight s${idx + 1}`} />
                ))}
            </div>
            <div className="party-lights join-lights global third z-[6]">
                {Array.from({ length: 10 }).map((_, idx) => (
                    <span key={`global-c-${idx}`} className={`spotlight s${idx + 1}`} />
                ))}
            </div>
            <div ref={joinRayStageRef} className="absolute inset-0 overflow-hidden pointer-events-none z-[4]">
                <div
                    className="logo-rays join-rays"
                    style={{ '--ray-inner': '140px', left: joinRayPos.x, top: joinRayPos.y }}
                ></div>
            </div>
            <div className="rays-shield"></div>
            <div className="join-bottom-panel"></div>
            <div className="relative z-10 w-full flex flex-col items-center overflow-visible">
                <button type="button" onClick={() => setShowAbout(true)} className="relative mt-3 mb-2 flex items-center justify-center bg-transparent overflow-visible">
                    <img
                        ref={joinLogoRef}
                        src={BRAND_ICON}
                        onLoad={() => {
                            const container = joinRayStageRef.current || joinContainerRef.current;
                            if (!container || !joinLogoRef.current) return;
                            const containerRect = container.getBoundingClientRect();
                            const logoRect = joinLogoRef.current.getBoundingClientRect();
                            const x = logoRect.left - containerRect.left + logoRect.width / 2;
                            const y = logoRect.top - containerRect.top + logoRect.height / 2;
                            setJoinRayPos({ x: `${Math.round(x)}px`, y: `${Math.round(y)}px` });
                        }}
                        className="w-[230px] h-auto object-contain bg-transparent drop-shadow-[0_0_28px_rgba(255,255,255,0.6)] logo-bounce relative z-10"
                        alt="Beaurocks Karaoke"
                    />
                </button>
                {/* Removed header for tighter logo focus */}
                <div className="text-sm text-zinc-200 mb-1">Pick the emoji that feels most you.</div>
                {/* FULL EMOJI GRID FOR LOGIN */}
                <div className="w-screen -mx-6 px-0 relative">
                    <AvatarCoverflow items={AVATAR_CATALOG} value={form.emoji} onSelect={handleSelectAvatar} getStatus={getAvatarStatus} loop={false} edgePadding="center" />
                </div>
                <div className="w-full max-w-sm mt-1 rounded-3xl p-2.5 text-center bg-gradient-to-br from-[#252633] via-[#1b1f2a] to-[#151926] shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
                    <div className="text-xl font-black text-[#00C4D9] mt-1 drop-shadow">{selectedAvatar?.label}</div>
                    {selectedAvatarStatus?.locked ? (
                        <div className="text-base font-bold text-zinc-200 mt-1.5">Unlock: {selectedAvatarUnlock}</div>
                    ) : (
                        <div className="text-base font-bold text-zinc-200 mt-1.5">{selectedAvatar?.flavor}</div>
                    )}
                </div>
                <div className="relative w-full max-w-sm mt-2 mb-2.5">
                    <input
                        value={form.name}
                        maxLength={NAME_LIMIT}
                        onChange={e => setForm({ ...form, name: clampName(e.target.value) })}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!termsAccepted) {
                                    setPendingJoin({ type: 'join', payload: null });
                                    setShowRulesModal(true);
                                    return;
                                }
                                join();
                            }
                        }}
                        onFocus={() => setNameFocused(true)}
                        onBlur={() => setNameFocused(false)}
                        className="w-full bg-zinc-100/90 p-3 rounded-xl text-center text-zinc-900 text-lg font-semibold placeholder:font-semibold placeholder-zinc-500 focus:ring-2 ring-pink-500 outline-none"
                        placeholder="Enter Your Name"
                    />
                    {nameFocused && !form.name ? (
                        <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-6 bg-white/80 caret-blink"></span>
                    ) : null}
                </div>
                <button
                    onClick={() => {
                        if (!termsAccepted) {
                            setPendingJoin({ type: 'join', payload: null });
                            setShowRulesModal(true);
                            return;
                        }
                        join();
                    }}
                    className="w-full max-w-sm py-3.5 rounded-xl font-bold text-white shadow-lg text-lg transition-transform bg-gradient-to-r from-pink-600 to-purple-600 active:scale-95 border-[5px] border-white/90"
                >
                    JOIN THE PARTY
                </button>
                {returningProfile && showReturningPrompt ? (
                    <button
                        onClick={() => {
                            setForm(prev => ({
                                ...prev,
                                name: returningProfile.name || prev.name,
                                emoji: returningProfile.emoji || prev.emoji
                            }));
                            setShowRejoinModal(true);
                        }}
                        className="mt-3 text-lg font-semibold uppercase tracking-[0.2em] text-pink-100 drop-shadow-[0_0_10px_rgba(255,122,200,0.8)] hover:text-pink-50 transition-colors"
                    >
                        Rejoin
                    </button>
                ) : null}
                <div className="mt-4 text-xs text-zinc-200 tracking-[0.12em] uppercase">(c) 2026 BROSS Entertainment. All rights reserved.</div>
            </div>
        </div>
        {showRulesModal ? (
            <div className="fixed inset-0 bg-black/70 z-[170] flex items-center justify-center p-6 font-saira">
                <div className="bg-gradient-to-br from-[#1b0b1a] via-[#241233] to-[#0f1118] border border-pink-400/40 rounded-3xl p-6 w-full max-w-md shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
                    <div className="flex items-center gap-3 mb-4">
                        <img src={BRAND_ICON} className="h-12 w-12 object-contain" alt="Beaurocks Karaoke" />
                        <div className="text-left">
                            <div className="text-base uppercase tracking-[0.35em] text-pink-200">House Rules</div>
                            <div className="text-3xl font-black text-white">Sing loud. Be kind.</div>
                        </div>
                    </div>
                    <ul className="text-lg text-zinc-100 space-y-2 mb-4">
                        <li>Be kind. No hate, threats, or harassment.</li>
                        <li>Only share what you own or can use.</li>
                        <li>We can remove content or users to keep it fun.</li>
                    </ul>
                    <label className="flex items-center gap-2 mb-5 text-lg text-zinc-100">
                        <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={e => setTermsAccepted(e.target.checked)}
                            className="h-5 w-5 accent-pink-500"
                        />
                        I agree to the party rules.
                    </label>
                    <button
                        onClick={() => {
                            if (!termsAccepted) return;
                            if (typeof window !== 'undefined') {
                                const key = `beaurocks_rules_${uid || 'guest'}`;
                                try {
                                    localStorage.setItem(key, 'accepted');
                                } catch {
                                    // Ignore storage failures.
                                }
                            }
                            setShowRulesModal(false);
                            if (pendingJoin?.type === 'join') {
                                setPendingJoin(null);
                                join();
                                return;
                            }
                            if (pendingJoin?.type === 'rejoin') {
                                const payload = pendingJoin.payload;
                                setPendingJoin(null);
                                join(payload);
                                return;
                            }
                        }}
                        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg text-lg transition-transform ${termsAccepted ? 'bg-gradient-to-r from-pink-500 to-fuchsia-500 active:scale-95' : 'bg-zinc-700 text-zinc-300 cursor-not-allowed'}`}
                    >
                        Let&apos;s go
                    </button>
                    <button
                        onClick={() => { setShowRulesModal(false); }}
                        className="w-full mt-3 bg-white/10 border border-white/15 text-white py-2.5 rounded-xl font-semibold text-base"
                    >
                        Not right now
                    </button>
                        <button
                            onClick={() => {
                                const base = import.meta.env.BASE_URL || '/';
                                const termsUrl = `${window.location.origin}${base}karaoke/terms`;
                                window.open(termsUrl, '_blank');
                            }}
                            className="mt-3 text-xs text-pink-200/70 underline underline-offset-4 hover:text-pink-100"
                        >
                            View Terms of Service
                        </button>
                </div>
            </div>
        ) : null}
        {showRejoinModal && returningProfile ? (
            <div className="fixed inset-0 bg-black/70 z-[160] flex items-center justify-center p-6 font-saira">
                <div className="bg-gradient-to-br from-zinc-900 via-[#1a1422] to-[#0f1118] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 rounded-2xl bg-black/40 flex items-center justify-center text-2xl">
                            {returningProfile.emoji || DEFAULT_EMOJI}
                        </div>
                        <div className="text-left">
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">Welcome back</div>
                            <div className="text-xl font-black text-white">{returningProfile.name}</div>
                            {returningProfile.lastRoom ? (
                                <div className="text-xs text-zinc-400 mt-1">Last room: {returningProfile.lastRoom}</div>
                            ) : null}
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (!termsAccepted) {
                                setPendingJoin({ type: 'rejoin', payload: returningProfile });
                                setShowRejoinModal(false);
                                setShowRulesModal(true);
                                return;
                            }
                            setShowRejoinModal(false);
                            join(returningProfile);
                        }}
                        className="w-full py-3 rounded-xl font-bold text-white shadow-lg text-base transition-transform bg-gradient-to-r from-pink-600 to-purple-600 active:scale-95"
                    >
                        Rejoin as {returningProfile.name}
                    </button>
                    <button
                        onClick={() => {
                            setForm(prev => ({
                                ...prev,
                                name: returningProfile.name || prev.name,
                                emoji: returningProfile.emoji || prev.emoji
                            }));
                            setShowRejoinModal(false);
                            setShowReturningPrompt(false);
                        }}
                        className="w-full mt-3 bg-white/10 border border-white/15 text-white py-2.5 rounded-xl font-semibold text-sm"
                    >
                        Use a different name/emoji
                    </button>
                </div>
            </div>
        ) : null}
        {showAbout ? renderAboutModal() : null}
        {showFeedbackForm ? renderFeedbackModal() : null}
        </>
    );

    // --- VIBE SYNC OVERLAYS ---
    if (room?.lightMode === 'storm') {
        const phaseLabel = {
            approach: 'Storm approaching',
            peak: 'Lightning peak',
            pass: 'Storm passing',
            clear: 'Clearing skies',
            off: 'Storm'
        }[stormPhase] || 'Storm';

        const handleJoinStorm = () => {
            setStormJoined(true);
            if (!stormAudioRef.current) {
                stormAudioRef.current = new Audio(getStormAmbientUrl());
                stormAudioRef.current.loop = true;
            }
            stormAudioRef.current.play().catch(() => {});
        };

        return (
            <div className={`h-screen w-full relative overflow-hidden text-white font-saira storm-screen storm-phase-${stormPhase} ${motionSafeFx ? 'motion-safe-fx' : ''}`}>
                <div className="absolute inset-0 storm-clouds mix-blend-multiply"></div>
                <div className="absolute inset-0 vibe-lightning mix-blend-screen"></div>
                <div className="rain"></div>
                <div className={`absolute inset-0 storm-flash ${stormFlash ? 'storm-flash-active' : ''}`}></div>
                <div className="absolute inset-0 storm-glow mix-blend-screen"></div>

                <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center z-20 px-6">
                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-300">Vibe Sync</div>
                    <div className="text-3xl font-bebas text-white drop-shadow">{phaseLabel}</div>
                    <div className="text-sm text-cyan-200 mt-1">Turn up brightness and volume on your phone.</div>
                </div>

                <div className="absolute inset-x-0 top-28 flex items-center justify-center z-20 px-6">
                    <div className="bg-black/50 border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
                        {currentSinger?.albumArtUrl && (
                            <img src={currentSinger.albumArtUrl} className="w-12 h-12 rounded-lg object-cover border border-white/20" />
                        )}
                        <div className="min-w-0 text-left">
                            <div className="text-xs text-zinc-400 uppercase tracking-widest">Now Playing</div>
                            <div className="text-sm font-bold truncate">{currentSinger?.songTitle || 'Live track'}</div>
                            <div className="text-sm text-zinc-300 truncate">{currentSinger?.artist || 'Stay in sync'}</div>
                        </div>
                    </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center z-20 px-6">
                    <div className="w-full max-w-sm bg-black/60 border border-white/10 rounded-3xl p-6 text-center backdrop-blur">
                        <div className="text-xl font-bold mb-2">Storm Mode</div>
                        <p className="text-sm text-zinc-300 mb-4">Sway with the music. Tap to spark lightning and feel the rumble.</p>
                        {!stormJoined ? (
                            <button onClick={handleJoinStorm} className="w-full bg-[#00C4D9] text-black py-3 rounded-full font-bold">Join the Storm</button>
                        ) : (
                            <button
                                onClick={() => {
                                    setStormFlash(true);
                                    if (navigator.vibrate) navigator.vibrate(80);
                                    if (stormFlashTimeoutRef.current) clearTimeout(stormFlashTimeoutRef.current);
                                    stormFlashTimeoutRef.current = setTimeout(() => setStormFlash(false), 260);
                                }}
                                className="w-full bg-white/20 border border-white/20 text-white py-3 rounded-full font-bold"
                            >
                                Tap to Spark
                            </button>
                        )}
                        <div className="text-xs text-zinc-400 mt-3">Host controls the storm sequence.</div>
                    </div>
                </div>
            </div>
        );
    }

    if (room?.lightMode === 'guitar') {
        return (
            <div className="h-screen bg-black/90 flex flex-col relative overflow-hidden text-white font-saira justify-center">
                <div className="absolute inset-0 flex justify-around items-center px-8" 
                     onTouchStart={(e)=>handleGuitarTouch(e)} 
                     onTouchMove={(e)=>handleGuitarTouch(e)}
                >
                     {[0,1,2,3,4].map(i => (
                        <div
                            key={i}
                            onClick={() => handleStrum(i)}
                            className={`flex-1 h-full border-r border-white/10 flex items-center justify-center relative guitar-string-zone ${strings[i] ? 'active' : ''}`}
                        >
                            <div className={`guitar-string ${strings[i] ? 'vibrating' : ''}`}></div>
                        </div>
                     ))}
                </div>
                <div className="absolute top-10 w-full text-center pointer-events-none">
                     <h1 className="text-6xl font-bebas text-yellow-500 animate-pulse drop-shadow-lg">GUITAR HERO!</h1>
                     <p className="text-xl opacity-80">STRUM OR TAP!</p>
                </div>
                <button onClick={() => updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode), { lightMode: 'off' })} className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-[#EC4899] text-black px-4 py-2 rounded-full z-50 text-xs font-bold">EXIT MODE</button>
            </div>
        );
    }

    if (room?.lightMode === 'strobe') {
        const countdownUntil = room?.strobeCountdownUntil || 0;
        const endsAt = room?.strobeEndsAt || 0;
        const phase = strobeNow < countdownUntil ? 'countdown' : strobeNow < endsAt ? 'active' : 'ended';
        const countdown = Math.max(0, Math.ceil((countdownUntil - strobeNow) / 1000));
        const remaining = Math.max(0, Math.ceil((endsAt - strobeNow) / 1000));
        const handleBeatTap = () => {
            if (!user || phase !== 'active') return;
            setStrobeLocalTaps(v => v + 1);
            setStrobeMeter(v => Math.min(100, v + 10));
            queueStrobeTap();
            try { if (window.navigator?.vibrate) window.navigator.vibrate(40); } catch {
                // Ignore vibration failures.
            }
        };

        return (
            <div className={`h-screen w-full ${motionSafeFx ? 'motion-safe-fx' : ''} ${motionSafeFx ? '' : 'vibe-strobe'} flex flex-col items-center justify-center text-white relative overflow-hidden`}>
                <div className={`absolute inset-0 ${motionSafeFx ? 'bg-white/28' : 'bg-white/45'} mix-blend-screen`}></div>
                <div className={`absolute inset-0 ${motionSafeFx ? 'bg-gradient-to-b from-pink-500/12 via-transparent to-cyan-400/8' : 'bg-gradient-to-b from-pink-500/25 via-transparent to-cyan-400/20'}`}></div>
                <div className="relative z-10 w-full max-w-sm px-6 text-center">
                    <div className="text-xs uppercase tracking-[0.45em] text-white/80 mb-4 drop-shadow-lg">Beat Drop</div>
                    <div className="inline-block mb-3 px-3 py-1 rounded-full bg-black/65 border border-yellow-300/40 text-[10px] uppercase tracking-[0.2em] text-yellow-200">Sensitivity Warning</div>
                    {phase === 'countdown' && (
                        <>
                            <div className="text-8xl font-black drop-shadow-[0_0_25px_rgba(0,0,0,0.85)]">{countdown || 0}</div>
                            <div className="text-base font-bold mt-3 drop-shadow-lg">Get ready to tap</div>
                        </>
                    )}
                    {phase === 'active' && (
                        <>
                            <div className="text-5xl font-black mb-2 drop-shadow-lg">TAP THE BEAT</div>
                            <div className="text-base font-bold mb-5 drop-shadow-lg">Keep the crowd meter alive</div>
                            <button
                                onClick={handleBeatTap}
                                className="w-56 h-56 rounded-full bg-black text-white text-3xl font-black shadow-[0_0_40px_rgba(0,0,0,0.45)] active:scale-95 transition-transform border-4 border-cyan-300 drop-shadow-2xl"
                            >
                                TAP
                            </button>
                            <div className="mt-6 text-xs uppercase tracking-[0.35em] text-white/70 drop-shadow-lg">Time Left {remaining}s</div>
                            <div className="mt-3 h-4 w-full bg-black/40 rounded-full overflow-hidden border border-white/20">
                                <div className="h-full bg-cyan-300 transition-all" style={{ width: `${strobeMeter}%` }}></div>
                            </div>
                            <div className="mt-3 text-sm font-bold drop-shadow-lg">Your taps: {strobeLocalTaps}</div>
                        </>
                    )}
                    {phase === 'ended' && (
                        <>
                            <div className="text-4xl font-black mb-2 drop-shadow-lg">DROP COMPLETE</div>
                            <div className="text-base font-bold">Waiting on results...</div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (room?.activeMode === 'doodle_oke' && room?.doodleOke) {
        const doodle = room.doodleOke;
        const participants = room?.doodleOkeConfig?.participants || [];
        const eligibleToDraw = !participants.length || participants.includes(uid);
        const requireReview = !!doodle?.requireReview;
        const approvedUidSet = new Set(Array.isArray(doodle?.approvedUids) ? doodle.approvedUids.filter(Boolean) : []);
        let phase = doodle.status || 'drawing';
        if (phase === 'drawing' && doodle.endsAt && doodleNow >= doodle.endsAt) phase = 'voting';
        if (phase === 'voting' && doodle.guessEndsAt && doodleNow >= doodle.guessEndsAt) phase = 'reveal';
        const drawRemaining = Math.max(0, Math.ceil((doodle.endsAt - doodleNow) / 1000));
        const voteRemaining = Math.max(0, Math.ceil((doodle.guessEndsAt - doodleNow) / 1000));
        const promptVisible = phase === 'drawing' || phase === 'reveal';
        const visibleSubmissions = requireReview
            ? doodleSubmissions.filter((submission) => approvedUidSet.has(submission.uid))
            : doodleSubmissions;
        const pendingReviewCount = Math.max(0, doodleSubmissions.length - visibleSubmissions.length);
        const mySubmissionApproved = approvedUidSet.has(uid);
        const voteCounts = doodleVotes.reduce((acc, v) => {
            acc[v.targetUid] = (acc[v.targetUid] || 0) + 1;
            return acc;
        }, {});
        const submissionsSorted = [...visibleSubmissions].sort((a, b) => (voteCounts[b.uid] || 0) - (voteCounts[a.uid] || 0));

        return (
            <div className="h-screen w-full bg-zinc-950 text-white font-saira flex flex-col items-center justify-center px-5 py-6 overflow-hidden">
                <div className="w-full max-w-3xl text-center space-y-2">
                    <div className="text-[10px] uppercase tracking-[0.5em] text-zinc-500">Doodle-oke</div>
                    <div className="text-3xl font-bebas text-cyan-300">Lyric Line Showdown</div>
                    <div className="text-sm text-zinc-300">
                        {eligibleToDraw ? 'Draw the lyric line and sing it out loud.' : 'Vote for the best interpretation.'}
                    </div>
                </div>

                <div className="mt-6 w-full max-w-4xl grid gap-4">
                    <div className="bg-zinc-900/70 border border-white/10 rounded-3xl p-4">
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-zinc-500 mb-2">
                            <span>{phase === 'voting' ? 'Voting' : phase === 'reveal' ? 'Reveal' : 'Drawing'}</span>
                            <span className="text-cyan-300 font-bold">
                                {phase === 'drawing' && `Ends in ${drawRemaining}s`}
                                {phase === 'voting' && `Ends in ${voteRemaining}s`}
                                {phase === 'reveal' && 'Prompt revealed'}
                            </span>
                        </div>
                        <div className="text-lg font-bold text-white">
                            {promptVisible ? doodle.prompt : 'Prompt hidden - vote with your eyes.'}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">Karaoke twist: sing the line while you draw.</div>
                        {requireReview && (
                            <div className="text-xs text-amber-300 mt-2">
                                Host review is on. Sketches appear in gallery after approval.
                            </div>
                        )}
                    </div>

                    {phase === 'drawing' && (
                        <div className="bg-black/70 border border-white/10 rounded-3xl p-4">
                            {eligibleToDraw ? (
                                <>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Drawing Tools</div>
                                        <div className="text-xs text-zinc-400">{doodleSubmitted ? 'Submitted' : 'Draw + Submit'}</div>
                                    </div>
                                    <div className="flex gap-2 mb-3 flex-wrap">
                                        {['#00C4D9', '#EC4899', '#FACC15', '#FFFFFF'].map(color => (
                                            <button
                                                key={color}
                                                onClick={() => { setDoodleColor(color); setDoodleEraser(false); }}
                                                className={`w-8 h-8 rounded-full border ${doodleColor === color ? 'border-white' : 'border-white/20'}`}
                                                style={{ background: color }}
                                            />
                                        ))}
                                        {[4, 7, 10].map(size => (
                                            <button
                                                key={size}
                                                onClick={() => setDoodleBrush(size)}
                                                className={`px-3 py-1 rounded-full text-xs font-bold border ${doodleBrush === size ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40' : 'bg-zinc-900 text-zinc-400 border-zinc-700'}`}
                                            >
                                                {size}px
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setDoodleEraser(prev => !prev)}
                                            className={`px-3 py-1 rounded-full text-xs font-bold border ${doodleEraser ? 'bg-pink-500/20 text-pink-200 border-pink-400/40' : 'bg-zinc-900 text-zinc-400 border-zinc-700'}`}
                                        >
                                            Eraser
                                        </button>
                                        <button
                                            onClick={clearDoodle}
                                            className="px-3 py-1 rounded-full text-xs font-bold border bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    <div className="relative w-full aspect-square max-h-[60vh] bg-zinc-950 rounded-2xl overflow-hidden border border-white/10">
                                        <canvas
                                            ref={doodleCanvasRef}
                                            className="w-full h-full touch-none"
                                            onPointerDown={handleDoodleStart}
                                            onPointerMove={handleDoodleMove}
                                            onPointerUp={handleDoodleEnd}
                                            onPointerLeave={handleDoodleEnd}
                                        />
                                    </div>
                                    <button
                                        onClick={submitDoodleDrawing}
                                        disabled={doodleSubmitted}
                                        className={`mt-3 w-full py-3 rounded-xl font-bold ${doodleSubmitted ? 'bg-zinc-800 text-zinc-500' : 'bg-gradient-to-r from-cyan-500 to-pink-500 text-black'}`}
                                    >
                                        {doodleSubmitted ? 'Submitted' : 'Submit Drawing'}
                                    </button>
                                    {doodleSubmitted && requireReview && !mySubmissionApproved && (
                                        <div className="mt-2 text-xs text-amber-300 text-center">Awaiting host approval before your sketch appears.</div>
                                    )}
                                </>
                            ) : (
                                <div className="text-zinc-400 text-sm text-center py-10">You're in the audience for this round. Sit back and get ready to vote.</div>
                            )}
                        </div>
                    )}

                    {phase !== 'drawing' && (
                        <div className="bg-zinc-900/70 border border-white/10 rounded-3xl p-4">
                            <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-3">Gallery</div>
                            {submissionsSorted.length === 0 ? (
                                <div className="text-zinc-500 text-sm">
                                    {requireReview && pendingReviewCount > 0
                                        ? `Waiting for host approvals (${pendingReviewCount} pending)...`
                                        : 'Waiting for drawings...'}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {submissionsSorted.map(s => (
                                        <div key={s.id} className="bg-black/50 border border-white/10 rounded-2xl p-2 flex flex-col gap-2">
                                            <div className="text-xs text-zinc-400">{s.avatar ? `${s.avatar} ` : ''}{s.name || 'Guest'}</div>
                                            <div className="w-full aspect-square bg-zinc-950 rounded-xl overflow-hidden relative">
                                                <img src={s.image} alt={s.name} className="w-full h-full object-contain" />
                                                <img src={room?.logoUrl || ASSETS.logo} className="absolute top-2 right-2 w-10 opacity-70" alt="BROSS" />
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-zinc-400">
                                                <span>{voteCounts[s.uid] || 0} votes</span>
                                                {phase === 'voting' && (
                                                    <button
                                                        onClick={() => submitDoodleVote(s.uid)}
                                                        disabled={!!doodleMyVote}
                                                        className={`px-3 py-1 rounded-full border ${doodleMyVote ? 'border-zinc-700 text-zinc-500' : 'border-cyan-400/40 text-cyan-200'}`}
                                                    >
                                                        {doodleMyVote?.targetUid === s.uid ? 'Voted' : 'Vote'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {phase === 'reveal' && room?.doodleOke?.winner && (
                                <div className="mt-4 bg-black/60 border border-cyan-400/40 rounded-2xl p-3 text-center">
                                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-500 mb-1">Winner</div>
                                    <div className="text-xl font-bebas text-cyan-300">{room.doodleOke.winner.name || 'Guest'}</div>
                                    <div className="text-sm text-zinc-400">+{room.doodleOke.winner.points || 0} pts</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }
    
    // --- SELFIE CAM ---
    if (room?.activeMode === 'selfie_challenge') {
        const challenge = room?.selfieChallenge;
        const isParticipant = !!challenge?.participants?.includes(uid);
        const hasSubmitted = selfieSubmissions.some(s => s.uid === uid);
        const visibleSubmissions = challenge?.requireApproval
            ? selfieSubmissions.filter(s => s.approved)
            : selfieSubmissions;
        const voteCounts = selfieVotes.reduce((acc, v) => {
            acc[v.targetUid] = (acc[v.targetUid] || 0) + 1;
            return acc;
        }, {});

        const castVote = async (targetUid) => {
            if (!user || !challenge?.promptId) return;
            if (mySelfieVote) return toast('Vote already submitted');
            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'selfie_votes'), {
                roomCode,
                promptId: challenge.promptId,
                voterUid: uid,
                targetUid,
                timestamp: serverTimestamp()
            });
            toast('Vote submitted');
        };

        return (
            <div className="h-screen bg-black flex flex-col relative overflow-hidden text-white font-saira">
                <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center z-20">
                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">Selfie Challenge</div>
                    <div className="text-2xl font-bold text-white">{challenge?.prompt || 'Get ready'}</div>
                    {challenge?.status && <div className="text-xs text-cyan-400 mt-1">Status: {challenge.status}</div>}
                </div>

                {isParticipant ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover"></video>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40"></div>
                        <div className="absolute bottom-12 left-0 w-full flex justify-center z-30">
                            <button onClick={submitSelfieChallenge} disabled={hasSubmitted} className="w-24 h-24 bg-white rounded-full border-4 border-zinc-300 shadow-xl active:scale-95 transition-transform disabled:opacity-50"></button>
                        </div>
                        <div className="absolute bottom-4 left-0 w-full text-center text-xs text-zinc-300 z-30">
                            {hasSubmitted ? 'Submitted - waiting for votes' : 'Tap to submit your selfie'}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 p-6 mt-16">
                        {challenge?.status === 'voting' ? (
                            <div className="grid grid-cols-2 gap-4">
                                {visibleSubmissions.map(s => (
                                    <button key={s.id} onClick={() => castVote(s.uid)} className={`relative rounded-2xl overflow-hidden border ${mySelfieVote === s.uid ? 'border-[#00C4D9]' : 'border-zinc-700'} bg-zinc-900/60`}>
                                        <img src={s.url} alt={s.userName} className="w-full h-40 object-cover" />
                                        <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2 text-sm flex items-center justify-between">
                                            <span className="truncate">{s.userName}</span>
                                            <span className="text-cyan-300 font-bold">{voteCounts[s.uid] || 0}</span>
                                        </div>
                                    </button>
                                ))}
                                {visibleSubmissions.length === 0 && (
                                    <div className="col-span-2 text-center text-zinc-400">Waiting for selfies...</div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center text-zinc-400 h-full">
                                <div className="text-2xl font-bold text-white mb-2">Waiting for selfies</div>
                                <div className="text-sm">Voting opens once photos are submitted.</div>
                            </div>
                        )}
                    </div>
                )}
                {challenge?.status === 'ended' && challenge?.winner && (!challenge?.winnerExpiresAt || Date.now() < challenge.winnerExpiresAt) && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
                        <div className="bg-zinc-900 border border-[#00C4D9]/40 rounded-2xl p-6 text-center">
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Winner</div>
                            <div className="text-3xl font-bold text-white mb-3">{challenge.winner.name}</div>
                            <img src={challenge.winner.url} alt={challenge.winner.name} className="w-64 h-64 object-cover rounded-xl mx-auto border border-white/10" />
                            <div className="text-cyan-300 font-bold mt-3">{challenge.winner.votes || 0} votes</div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (strobeVictoryOpen) {
        return (
            <div className="fixed inset-0 z-[130] bg-black flex flex-col items-center justify-center p-6 text-white font-saira">
                <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300 mb-3">Beat Drop MVP</div>
                <div className="text-4xl font-bebas mb-2">YOU KEPT THE BEAT</div>
                <div className="text-sm text-zinc-400 mb-6">Snap a victory selfie for the big screen.</div>
                <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden border-4 border-cyan-400/60 shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover"></video>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>
                </div>
                <button onClick={takeStrobeVictorySelfie} className="mt-6 w-24 h-24 bg-white rounded-full border-4 border-zinc-300 shadow-xl active:scale-95 transition-transform"></button>
                <button onClick={() => setStrobeVictoryOpen(false)} className="mt-4 text-xs text-zinc-400 underline">Skip for now</button>
            </div>
        );
    }

    if (guitarVictoryOpen) {
        return (
            <div className="fixed inset-0 z-[130] bg-black flex flex-col items-center justify-center p-6 text-white font-saira">
                <div className="text-[10px] uppercase tracking-[0.4em] text-pink-400 mb-3">Victory Selfie</div>
                <div className="text-4xl font-bebas mb-2">GUITAR SOLO MVP</div>
                <div className="text-sm text-zinc-400 mb-6">Show off your shred face for the big screen.</div>
                <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden border-4 border-pink-500/50 shadow-2xl">
                    <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover"></video>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>
                </div>
                <button onClick={takeGuitarVictorySelfie} className="mt-6 w-24 h-24 bg-white rounded-full border-4 border-zinc-300 shadow-xl active:scale-95 transition-transform"></button>
                <button onClick={() => setGuitarVictoryOpen(false)} className="mt-4 text-xs text-zinc-400 underline">Skip for now</button>
            </div>
        );
    }

    if (room?.readyCheck?.active) {
        return (
            <div className="fixed inset-0 z-[120] bg-zinc-900 flex flex-col items-center justify-center p-6 text-white font-saira">
                <div className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 mb-3">Ready Check</div>
                <div className="text-[12rem] font-black text-white leading-none mb-4">{readyTimer || 0}</div>
                {user?.isReady ? (
                    <h1 className="text-4xl font-bebas text-green-400">YOU ARE READY!</h1>
                ) : (
                    <div className="text-center animate-pulse">
                        <h1 className="text-5xl font-bebas mb-8">ARE YOU READY?</h1>
                        <button onClick={readyUp} className="w-64 h-64 bg-green-500 rounded-full flex items-center justify-center border-8 border-green-300 shadow-2xl">
                            <span className="text-4xl font-bold">YES!</span>
                        </button>
                        <div className="text-sm text-zinc-400 mt-6">Earn +{Math.max(0, Number(room?.readyCheck?.rewardPoints ?? 100))} pts</div>
                    </div>
                )}
            </div>
        );
    }

    if (room?.activeMode === 'selfie_cam') {
        return (
            <div className="h-screen bg-black flex flex-col relative overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover"></video>
                {!cameraActive && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 text-center p-6">
                        <div className="text-3xl font-bebas text-white mb-3">Enable Camera</div>
                        <div className="text-sm text-zinc-300 mb-4">{cameraError || 'We need your camera to join selfie mode.'}</div>
                        <button onClick={startCamera} className="bg-[#00C4D9] text-black px-6 py-3 rounded-full font-bold text-sm">
                            Turn on Camera
                        </button>
                    </div>
                )}
                <div className="absolute inset-0 border-[20px] border-pink-500 opacity-50 pointer-events-none animate-pulse"></div>
                <div className="absolute bottom-10 left-0 w-full flex justify-center z-50">
                    <button onClick={takeSelfie} className="w-20 h-20 bg-white rounded-full border-4 border-zinc-300 shadow-xl active:scale-95 transition-transform"></button>
                </div>
                <div className="absolute top-10 w-full text-center">
                    <div className="bg-black/50 inline-block px-4 py-2 rounded-full text-white font-bebas text-2xl">SMILE FOR THE TV!</div>
                </div>
            </div>
        );
    }
    
    // --- GAME INTERCEPTION ---
    if (room?.activeMode && !['karaoke','applause','selfie_cam','selfie_challenge','applause_countdown','applause_result','doodle_oke'].includes(room.activeMode)) {
        // Correct payload mapping for Mobile
        const isTrivia = room.activeMode.includes('trivia');
        const isWyr = room.activeMode.includes('wyr');
        const isBingo = room.activeMode === 'bingo';
        const isBracket = room.activeMode === 'karaoke_bracket';
        const isMysteryBingo = isBingo && room?.bingoMode === 'mystery';
        const bingoSessionId = String(room?.bingoSessionId || room?.bingoBoardId || 'default');
        const mysteryParticipantMode = room?.gameParticipantMode === 'selected' ? 'selected' : 'all';
        const mysteryParticipantList = mysteryParticipantMode === 'selected' && Array.isArray(room?.gameParticipants)
            ? room.gameParticipants
            : [];
        const isMysteryParticipant = !isMysteryBingo || mysteryParticipantMode !== 'selected' || mysteryParticipantList.includes(uid);
        const bingoRng = room?.bingoMysteryRng;
        const bingoTurnIndex = Math.max(0, Number(room?.bingoTurnIndex || 0));
        const mysteryTurnLocked = isMysteryBingo
            && Number(room?.bingoTurnPick?.turnIndex ?? -1) === bingoTurnIndex;
        const rngActive = isMysteryBingo && bingoRng?.active;
        const canLateJoin = isMysteryBingo && isMysteryParticipant && !rngActive && bingoRng?.finalized && !bingoRng?.results?.[uid];
        const bingoSessionVotes = user?.bingoVotesBySession?.[bingoSessionId] || {};
        const hideBingoOverlay = isBingo && !showBingoOverlay;
        
        let gamePayload = room.gameData;
        if (isTrivia) gamePayload = room.triviaQuestion;
        if (isWyr) gamePayload = room.wyrData;
        if (isBracket) gamePayload = room.karaokeBracket || room.gameData;
        const pickerUser = isBingo ? allUsers.find(u => u.uid === room?.bingoPickerUid) : null;
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

        const submitMysterySpin = async ({ allowFinalized = false } = {}) => {
            if (!user || !uid) return false;
            const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
            const spinEntry = {
                uid,
                name: user.name,
                avatar: user.avatar,
                value: Math.floor(Math.random() * 1000) + 1,
                at: serverTimestamp()
            };
            const accepted = await runTransaction(db, async (tx) => {
                const snap = await tx.get(roomRef);
                if (!snap.exists()) return false;
                const roomData = snap.data() || {};
                const rngState = roomData?.bingoMysteryRng || {};
                const isOpen = !!rngState?.active || (allowFinalized && !!rngState?.finalized);
                if (!isOpen) return false;
                if (rngState?.results?.[uid]) return false;
                tx.update(roomRef, { [`bingoMysteryRng.results.${uid}`]: spinEntry });
                return true;
            });
            if (!accepted) return false;
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`), { lastActiveAt: serverTimestamp() });
            return true;
        };

        // PASS THE USER OBJECT HERE
        const suggestBingo = (idx) => {
            if (!user) return toast('Please join first');
            if (isMysteryBingo && !isMysteryParticipant) {
                toast('You are spectating this mystery round.');
                return;
            }
            if (isMysteryBingo && room?.bingoPickerUid && room.bingoPickerUid !== uid) {
                toast('Waiting for the picker.');
                return;
            }
            if (isMysteryBingo && mysteryTurnLocked && room?.bingoTurnPick?.pickerUid === uid) {
                toast('You already locked a pick this turn. Perform to pass the turn.');
                return;
            }
            if (room?.bingoRevealed?.[idx]) {
                toast('That tile is already revealed.');
                return;
            }
            setPendingBingoSuggest(idx);
            setBingoSuggestNote('');
        };

        const submitBingoSuggestion = async () => {
            if (!user || pendingBingoSuggest === null) return;
            const idx = pendingBingoSuggest;
            const note = bingoSuggestNote.trim().slice(0, 20);
            if (bingoSessionVotes?.[idx]) {
                toast('You already voted on that tile');
                setPendingBingoSuggest(null);
                return;
            }
            try {
                const userRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'room_users', `${roomCode}_${uid}`);
                const roomRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'rooms', roomCode);
                if (isMysteryBingo) {
                    if (!isMysteryParticipant) {
                        toast('You are spectating this mystery round.');
                        setPendingBingoSuggest(null);
                        return;
                    }
                    const latestSnap = await getDoc(roomRef);
                    if (!latestSnap.exists()) {
                        toast('Room unavailable.');
                        setPendingBingoSuggest(null);
                        return;
                    }
                    const latestRoom = latestSnap.data() || {};
                    const latestParticipantMode = latestRoom?.gameParticipantMode === 'selected' ? 'selected' : 'all';
                    const latestParticipants = latestParticipantMode === 'selected' && Array.isArray(latestRoom?.gameParticipants)
                        ? latestRoom.gameParticipants
                        : [];
                    if (latestParticipantMode === 'selected' && !latestParticipants.includes(uid)) {
                        toast('You are spectating this mystery round.');
                        setPendingBingoSuggest(null);
                        return;
                    }
                    const latestPickerUid = latestRoom?.bingoPickerUid || null;
                    const latestTurnIndex = Math.max(0, Number(latestRoom?.bingoTurnIndex || 0));
                    const latestTurnLocked = Number(latestRoom?.bingoTurnPick?.turnIndex ?? -1) === latestTurnIndex;
                    if (latestPickerUid && latestPickerUid !== uid) {
                        toast('Waiting for the picker.');
                        setPendingBingoSuggest(null);
                        return;
                    }
                    if (latestTurnLocked && latestRoom?.bingoTurnPick?.pickerUid === uid) {
                        toast('You already locked a pick this turn. Perform to pass the turn.');
                        setPendingBingoSuggest(null);
                        return;
                    }
                    if (latestRoom?.bingoRevealed?.[idx]) {
                        toast('That tile is already revealed.');
                        setPendingBingoSuggest(null);
                        return;
                    }
                    const tile = latestRoom?.bingoData?.[idx];
                    if (!tile) {
                        toast('Tile missing.');
                        setPendingBingoSuggest(null);
                        return;
                    }
                    const songTitle = tile.content?.title || tile.text || 'Mystery Song';
                    const artist = tile.content?.artist || 'Unknown';
                    const art = tile.content?.art || '';
                    await submitSong(songTitle, artist, art, { itunesId: tile.content?.itunesId || '' });
                    await updateDoc(roomRef, {
                        [`bingoRevealed.${idx}`]: true,
                        [`bingoSuggestions.${idx}.count`]: increment(1),
                        [`bingoSuggestions.${idx}.lastNote`]: note || '',
                        [`bingoSuggestions.${idx}.lastAt`]: serverTimestamp(),
                        highlightedTile: idx,
                        bingoFocus: { index: idx, pickerUid: uid, at: serverTimestamp() },
                        bingoTurnPick: { pickerUid: uid, turnIndex: latestTurnIndex, index: idx, at: serverTimestamp() }
                    });
                    setTimeout(() => updateDoc(roomRef, { highlightedTile: null }).catch(() => {}), 1000);
                    toast('Mystery pick locked.');
                    setPendingBingoSuggest(null);
                    return;
                }
                const result = await runTransaction(db, async (tx) => {
                    const roomSnap = await tx.get(roomRef);
                    const userSnap = await tx.get(userRef);
                    if (!roomSnap.exists()) {
                        throw new Error('ROOM_MISSING');
                    }
                    const latestRoom = roomSnap.data() || {};
                    if (latestRoom?.activeMode !== 'bingo' || latestRoom?.bingoMode === 'mystery') {
                        throw new Error('MODE_CHANGED');
                    }
                    if (latestRoom?.bingoRevealed?.[idx]) {
                        throw new Error('ALREADY_REVEALED');
                    }
                    const latestSessionId = String(latestRoom?.bingoSessionId || bingoSessionId || 'default');
                    const userData = userSnap.exists() ? userSnap.data() || {} : {};
                    const existingVotes = userData?.bingoVotesBySession?.[latestSessionId] || {};
                    if (existingVotes?.[idx]) {
                        throw new Error('ALREADY_VOTED');
                    }
                    const participantMode = latestRoom?.gameParticipantMode === 'selected' ? 'selected' : 'all';
                    const participantList = participantMode === 'selected' && Array.isArray(latestRoom?.gameParticipants)
                        ? latestRoom.gameParticipants
                        : [];
                    const eligibleVoters = participantMode === 'selected' && participantList.length
                        ? allUsers.filter((entry) => participantList.includes(entry.uid))
                        : allUsers;
                    const voterCount = Math.max(1, eligibleVoters.length || 1);
                    const currentCount = Number(latestRoom?.bingoSuggestions?.[idx]?.count || 0);
                    const nextCount = currentCount + 1;
                    const thresholdPct = typeof latestRoom?.bingoAutoApprovePct === 'number' ? latestRoom.bingoAutoApprovePct : 50;
                    const thresholdVotes = Math.max(1, Math.ceil((voterCount * thresholdPct) / 100));
                    const autoApprove = latestRoom?.bingoVotingMode === 'host+votes' && nextCount >= thresholdVotes;

                    tx.set(userRef, { [`bingoVotesBySession.${latestSessionId}.${idx}`]: true }, { merge: true });
                    tx.update(roomRef, {
                        [`bingoSuggestions.${idx}.count`]: nextCount,
                        [`bingoSuggestions.${idx}.lastNote`]: note || '',
                        [`bingoSuggestions.${idx}.lastAt`]: serverTimestamp(),
                        highlightedTile: idx,
                        ...(autoApprove ? { [`bingoRevealed.${idx}`]: true } : {})
                    });
                    return { autoApprove };
                });
                setTimeout(() => updateDoc(roomRef, { highlightedTile: null }).catch(() => {}), 1000);
                toast(result?.autoApprove ? 'Auto-approved!' : 'Suggested!');
            } catch (e) {
                console.error(e);
                if (String(e?.message || '').includes('ALREADY_VOTED')) {
                    toast('You already voted on that tile');
                } else if (String(e?.message || '').includes('ALREADY_REVEALED')) {
                    toast('That tile is already revealed.');
                } else {
                    toast('Suggest failed');
                }
            } finally {
                setPendingBingoSuggest(null);
            }
        };

        const isVoiceGame = room?.activeMode === 'flappy_bird' || room?.activeMode === 'vocal_challenge' || room?.activeMode === 'riding_scales';
        const playerId = gamePayload?.playerId;
        const isScaleGroup = room?.activeMode === 'riding_scales' && playerId === 'GROUP';
        const participantMode = room?.gameParticipantMode;
        const participantList = Array.isArray(room?.gameParticipants) ? room.gameParticipants : [];
        const isBingoParticipant = !isMysteryBingo ? true : (participantMode !== 'selected' || participantList.includes(uid));
        const isParticipant = isBingo ? isBingoParticipant : (participantMode !== 'selected' || participantList.includes(uid));
        const canSuggestBingo = isBingo && (!isMysteryBingo
            ? true
            : isBingoParticipant && room?.bingoPickerUid === uid && !(mysteryTurnLocked && room?.bingoTurnPick?.pickerUid === uid));
        const isLocalPlayer = isVoiceGame ? (!isScaleGroup && playerId === uid) : isParticipant;
        const inputSource = isVoiceGame ? gamePayload?.inputSource : undefined;
        const showSpectatorNotice = !isVoiceGame && !isParticipant;

        if (!hideBingoOverlay) {
            return (
            <div className="absolute inset-0">
                <GameContainer
                    activeMode={room.activeMode}
                    roomCode={roomCode}
                    isPlayer={isLocalPlayer}
                    inputSource={inputSource}
                    gameState={gamePayload}
                    playerData={gamePayload}
                    user={user}
                    users={allUsers}
                    onSuggest={isBingo && isParticipant && canSuggestBingo ? suggestBingo : undefined}
                    onClose={isBingo ? () => setShowBingoOverlay(false) : undefined}
                    rulesToken={room?.gameRulesId}
                    view="mobile"
                />
                {rngActive && isMysteryParticipant && (
                    <div className="absolute inset-0 z-[140] bg-black/80 flex items-center justify-center p-6">
                        <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6 text-center">
                            <div className="text-xs uppercase tracking-[0.4em] text-zinc-500">Mystery Bingo</div>
                            <div className="text-3xl font-bebas text-white mt-3">Spin for pick order</div>
                            <div className="mt-4 text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-500">
                                {bingoRng?.results?.[uid]?.value || '--'}
                            </div>
                            <div className="text-xs uppercase tracking-[0.35em] text-zinc-400 mt-2">
                                {Math.max(0, Math.ceil(((bingoRng?.startTime || 0) + (bingoRng?.durationSec || 12) * 1000 - bingoRngNow) / 1000))}s left
                            </div>
                            <button
                                onClick={async () => {
                                    if (!user || !uid || !rngActive || !isMysteryParticipant) return;
                                    if (bingoRng?.results?.[uid]) return;
                                    markActive();
                                    try {
                                        const wrote = await submitMysterySpin({ allowFinalized: false });
                                        if (!wrote) {
                                            toast('Spin already locked.');
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        toast('Spin failed');
                                    }
                                }}
                                className="mt-5 w-full bg-gradient-to-r from-cyan-400 to-pink-500 text-black font-black py-3 rounded-full text-sm uppercase tracking-widest"
                            >
                                {bingoRng?.results?.[uid] ? 'Waiting...' : 'Spin Now'}
                            </button>
                            <div className="text-[11px] text-zinc-400 mt-4">Highest number picks first.</div>
                        </div>
                    </div>
                )}
                {rngActive && !isMysteryParticipant && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[132] bg-black/75 border border-zinc-500/40 text-zinc-300 px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.25em]">
                        Spectating Mystery Round
                    </div>
                )}
                {canLateJoin && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[130] bg-black/70 border border-white/15 px-4 py-3 rounded-full flex items-center gap-3">
                        <div className="text-xs uppercase tracking-[0.35em] text-zinc-300">Join round</div>
                        <button
                            onClick={async () => {
                                if (!user || !uid) return;
                                if (bingoRng?.results?.[uid]) return;
                                markActive();
                                try {
                                    const wrote = await submitMysterySpin({ allowFinalized: true });
                                    if (!wrote) {
                                        toast('Round closed.');
                                    }
                                } catch (err) {
                                    console.error(err);
                                    toast('Join failed');
                                }
                            }}
                            className="bg-gradient-to-r from-cyan-400 to-pink-500 text-black font-bold px-4 py-2 rounded-full text-xs uppercase tracking-widest"
                        >
                            Spin In
                        </button>
                    </div>
                )}
                {isMysteryBingo && mysteryTurnLocked && room?.bingoTurnPick?.pickerUid && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[132] bg-black/75 border border-cyan-400/40 text-cyan-200 px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.25em]">
                        Pick Locked - Waiting For Performance
                    </div>
                )}
                {pendingBingoSuggest !== null && (
                    <div className="absolute inset-0 bg-black/70 z-[120] flex items-center justify-center p-6">
                        <div className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-2xl p-5">
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Suggest square</div>
                            <div className="text-lg font-bold text-white mt-2">Add a short note (optional)</div>
                            <input
                                value={bingoSuggestNote}
                                onChange={(e) => setBingoSuggestNote(e.target.value.slice(0, 20))}
                                placeholder="20 characters max"
                                className="mt-3 w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
                                maxLength={20}
                            />
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => setPendingBingoSuggest(null)} className="flex-1 bg-zinc-800 text-white rounded-lg py-2 text-sm font-bold">Cancel</button>
                                <button onClick={submitBingoSuggestion} className="flex-1 bg-[#00C4D9]/20 border border-[#00C4D9]/40 text-[#00C4D9] rounded-lg py-2 text-sm font-bold">Send</button>
                            </div>
                        </div>
                    </div>
                )}
                {showSpectatorNotice && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 border border-white/20 text-white text-xs uppercase tracking-widest px-4 py-2 rounded-full">
                        Spectating this round
                    </div>
                )}
            </div>
            );
        }
    }
    

    if (showAccount) return (
        <div className="fixed inset-0 bg-zinc-900 z-[110] p-6 flex flex-col text-white font-saira">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">VIP Account</div>
                    <div className="text-3xl font-bebas text-cyan-300">Your Performance History</div>
                </div>
                <button onClick={() => setShowAccount(false)} className="bg-zinc-800 px-4 py-2 rounded-full text-sm font-bold">Close</button>
            </div>
            <div className="grid gap-4">
                <div className="bg-zinc-800/70 border border-zinc-700 rounded-2xl p-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Account</div>
                    <div className="text-lg font-bold">{user?.name || 'VIP'}</div>
                    <div className="text-sm text-zinc-400">VIP Level: {profile?.vipLevel || 1}</div>
                    <div className="text-sm text-zinc-400">Phone: {profile?.phone || user?.phone || 'Not linked'}</div>
                    <div className="mt-3 flex gap-3 text-sm">
                        <div className="bg-black/30 px-3 py-2 rounded-xl">Performances: <span className="font-bold text-white">{performanceStats.total}</span></div>
                        <div className="bg-black/30 px-3 py-2 rounded-xl">Emojis: <span className="font-bold text-white">{user?.totalEmojis || 0}</span></div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-black/30 px-3 py-2 rounded-xl">Loudest dB: <span className="font-bold text-white">{performanceStats.loudest}</span></div>
                        <div className="bg-black/30 px-3 py-2 rounded-xl">Total Score: <span className="font-bold text-white">{performanceStats.totalPoints}</span></div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-black/30 px-3 py-2 rounded-xl">Location: <span className="font-bold text-white">{profile?.vipProfile?.location || '-'}</span></div>
                        <div className="bg-black/30 px-3 py-2 rounded-xl">Birthday: <span className="font-bold text-white">{profile?.vipProfile?.birthMonth && profile?.vipProfile?.birthDay ? `${profile.vipProfile.birthMonth} ${profile.vipProfile.birthDay}` : '-'}</span></div>
                    </div>
                    {performanceStats.topSong && (
                        <div className="mt-3 bg-black/30 px-3 py-2 rounded-xl text-sm">
                            Top Song: <span className="font-bold text-white">{performanceStats.topSong.songTitle}</span>
                            <span className="text-zinc-400"> - {performanceStats.topSong.artist}</span>
                        </div>
                    )}
                    {favoriteSongs.length > 0 && (
                        <div className="mt-3 bg-black/30 px-3 py-2 rounded-xl text-sm">
                            <div className="text-xs uppercase tracking-widest text-zinc-400 mb-1">Favorites</div>
                            <div className="space-y-1">
                                {favoriteSongs.map((fav, idx) => (
                                    <div key={`${fav.label}-${idx}`} className="text-zinc-200 text-xs">{fav.label} <span className="text-zinc-500">({fav.count}x)</span></div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="mt-3 bg-black/30 px-3 py-2 rounded-xl text-sm">
                        <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Fame Level</div>
                        <div className="text-sm text-zinc-200 mb-2">
                            Level {getLevelFromFame(profile?.totalFamePoints || 0)} - {FAME_LEVELS?.[getLevelFromFame(profile?.totalFamePoints || 0)]?.name || 'Rising Star'}
                        </div>
                        <FameLevelProgressBar level={getLevelFromFame(profile?.totalFamePoints || 0)} progressToNext={getProgressToNextLevel(profile?.totalFamePoints || 0, getLevelFromFame(profile?.totalFamePoints || 0))} />
                    </div>
                    <div className="mt-3 bg-black/30 px-3 py-2 rounded-xl text-sm">
                        <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">Top 3 from Tight 15</div>
                        {getTight15List().length === 0 ? (
                            <div className="text-xs text-zinc-400">Set your Tight 15 to show your signature songs.</div>
                        ) : (
                            <div className="space-y-2">
                                {getTight15List().slice(0, 3).map((song, idx) => (
                                    <div key={`${song.songTitle}-${idx}`} className="flex items-center gap-2">
                                        {song.albumArtUrl ? (
                                            <img src={song.albumArtUrl} className="w-10 h-10 rounded-lg object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center">{EMOJI.musicNotes}</div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-white truncate">{song.songTitle}</div>
                                            <div className="text-[10px] text-zinc-400 truncate">{song.artist}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="bg-zinc-800/70 border border-zinc-700 rounded-2xl p-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">Recent Performances</div>
                    {historyItems.length === 0 ? (
                        <div className="text-zinc-400 text-sm">No performances yet. Hit the stage!</div>
                    ) : (
                        <div className="space-y-2 max-h-[55vh] overflow-y-auto custom-scrollbar pr-2">
                            {historyItems.map(s => (
                                <div key={s.id} className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-700 rounded-xl p-3">
                                    {s.albumArtUrl ? (
                                        <img src={s.albumArtUrl} className="w-10 h-10 rounded-lg object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center text-lg">{DEFAULT_EMOJI}</div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-white truncate">{s.songTitle}</div>
                                        <div className="text-sm text-zinc-400 truncate">{s.artist}</div>
                                    </div>
                                    <div className="text-xs text-zinc-500 font-mono">
                                        {s.timestamp?.seconds ? new Date(s.timestamp.seconds * 1000).toLocaleDateString() : '-'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (showProfile) return (
        <div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center text-white font-saira"
            onClick={() => setShowProfile(false)}
        >
            <style>{PARTY_LIGHTS_STYLE}</style>
            <div
                className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-hidden rounded-t-[2rem] sm:rounded-3xl border border-fuchsia-300/30 bg-gradient-to-br from-[#1b1130] via-[#0d1423] to-[#0a0d12] shadow-[0_0_60px_rgba(236,72,153,0.28)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute -top-24 -left-12 w-56 h-56 rounded-full bg-fuchsia-500/25 blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-28 -right-12 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none"></div>
                <div className="sticky top-0 z-20 px-5 pt-4 pb-3 border-b border-white/10 bg-black/45 backdrop-blur">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.45em] text-zinc-400">Profile Studio</div>
                            <h2 className="text-3xl font-bebas text-transparent bg-clip-text bg-gradient-to-r from-[#00C4D9] to-[#EC4899] mt-1">
                                CHANGE NAME / EMOJI
                            </h2>
                            <div className="text-sm text-zinc-300">Neon synthwave mode for your identity.</div>
                        </div>
                        <button
                            onClick={() => setShowProfile(false)}
                            className="h-9 w-9 rounded-full border border-white/20 bg-black/50 text-zinc-200 text-sm font-black"
                            aria-label="Close profile editor"
                        >
                            X
                        </button>
                    </div>
                </div>
                <div className="overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
                    <div className="relative rounded-3xl border border-white/10 bg-black/35 p-3">
                        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
                            <div className="logo-rays join-rays profile-rays" style={{ '--ray-inner': '130px', left: '50%', top: '50%' }}></div>
                        </div>
                        <div className="party-lights"></div>
                        <div className="party-lights alt"></div>
                        <div className="party-lights third"></div>
                        <AvatarCoverflow items={AVATAR_CATALOG} value={form.emoji || user.avatar} onSelect={handleSelectAvatar} getStatus={getAvatarStatus} loop={false} />
                    </div>
                    <div className="rounded-3xl p-5 text-center bg-gradient-to-br from-[#1e1c2f] via-[#151827] to-[#101421] border border-fuchsia-300/20 shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
                        <div className="text-6xl mb-2 drop-shadow-[0_0_18px_rgba(236,72,153,0.5)]">{form.emoji || user.avatar}</div>
                        <div className="text-3xl font-black text-[#00C4D9] drop-shadow">{selectedAvatar?.label}</div>
                        {selectedAvatarStatus?.locked ? (
                            <div className="text-lg font-bold text-zinc-200 mt-2">Unlock: {selectedAvatarUnlock}</div>
                        ) : (
                            <div className="text-lg font-bold text-zinc-200 mt-2">{selectedAvatar?.flavor}</div>
                        )}
                    </div>
                    <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-center">
                        <div className="text-sm text-zinc-200">
                            Points: <span className="text-white font-black">{Math.max(0, getEffectivePoints())}</span>
                        </div>
                        <div className="text-sm text-zinc-300 mt-1">
                            {getNameEmojiChangeCost() === 0 ? 'First change is free.' : `This change costs ${getNameEmojiChangeCost()} PTS.`}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1">Next change: {getNextNameEmojiChangeCost()} PTS.</div>
                    </div>
                    <input
                        value={form.name}
                        maxLength={NAME_LIMIT}
                        onChange={e=>setForm({...form, name: clampName(e.target.value)})}
                        className="w-full bg-zinc-950/70 p-4 rounded-2xl text-center border border-zinc-600 text-xl"
                        placeholder="Your Name"
                    />
                    {isVipAccount && (
                        <div className="bg-black/40 border border-fuchsia-400/25 rounded-2xl p-4">
                            <div className="text-xs uppercase tracking-[0.45em] text-zinc-400 mb-3">VIP Profile</div>
                            <input
                                value={vipForm.location}
                                onChange={(e) => setVipForm(prev => ({ ...prev, location: e.target.value }))}
                                className="w-full bg-zinc-900 p-3 rounded-xl mb-3 text-center border border-zinc-700 text-base"
                                placeholder="Location (city, vibe, or wherever)"
                            />
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <select
                                    value={vipForm.birthMonth}
                                    onChange={(e) => setVipForm(prev => ({ ...prev, birthMonth: e.target.value }))}
                                    className="bg-zinc-900 p-3 rounded-xl border border-zinc-700 text-base"
                                >
                                    <option value="">Birth Month</option>
                                    {VIP_BIRTH_MONTHS.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                <select
                                    value={vipForm.birthDay}
                                    onChange={(e) => setVipForm(prev => ({ ...prev, birthDay: e.target.value }))}
                                    className="bg-zinc-900 p-3 rounded-xl border border-zinc-700 text-base"
                                >
                                    <option value="">Birth Day</option>
                                    {VIP_BIRTH_DAYS.map(day => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-zinc-200">
                                <input
                                    type="checkbox"
                                    checked={vipForm.smsOptIn}
                                    onChange={(e) => setVipForm(prev => ({ ...prev, smsOptIn: e.target.checked }))}
                                />
                                Text me when I am up next
                            </label>
                            <label className="flex items-center gap-2 text-sm text-zinc-200 mt-2">
                                <input
                                    type="checkbox"
                                    checked={vipForm.tosAccepted || vipTosAccepted}
                                    disabled={vipTosAccepted}
                                    onChange={(e) => setVipForm(prev => ({ ...prev, tosAccepted: e.target.checked }))}
                                />
                                {vipTosAccepted ? 'VIP House Rules accepted' : 'I agree to the VIP House Rules'}
                            </label>
                        </div>
                    )}
                    {isVipAccount && (
                        <button onClick={() => setShowAccount(true)} className="w-full bg-[#00C4D9]/20 border border-[#00C4D9]/40 text-[#00C4D9] py-3 rounded-xl font-bold">
                            VIP Account & History
                        </button>
                    )}
                    <div className="flex gap-2">
                        <button onClick={()=>setShowProfile(false)} className="flex-1 bg-zinc-700 py-3 rounded-xl font-bold">CANCEL</button>
                        <button onClick={updateProfile} className="flex-1 bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black py-3 rounded-xl font-black">SAVE</button>
                    </div>
                </div>
            </div>
        </div>
    );
    if (showVipOnboarding) return (
        <div className="fixed inset-0 bg-black/80 z-[140] flex items-center justify-center p-6 text-white font-saira">
            <div className="w-full max-w-md bg-gradient-to-br from-[#120b1a] via-[#0f1218] to-[#0a0d12] border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_40px_rgba(0,196,217,0.25)]">
                <div className="text-xs uppercase tracking-[0.45em] text-zinc-500">Welcome VIP</div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00C4D9] to-[#EC4899] mb-2">Build Your VIP Profile</h2>
                <p className="text-base text-zinc-300 mb-4">This info shows on your profile so the room can celebrate you.</p>
                <input
                    value={vipForm.location}
                    onChange={(e) => setVipForm(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full bg-zinc-900 p-4 rounded-xl mb-3 border border-zinc-700 text-lg"
                    placeholder="Location (city, vibe, or wherever)"
                />
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <select
                        value={vipForm.birthMonth}
                        onChange={(e) => setVipForm(prev => ({ ...prev, birthMonth: e.target.value }))}
                        className="bg-zinc-900 p-4 rounded-xl border border-zinc-700 text-lg"
                    >
                        <option value="">Birth Month</option>
                        {VIP_BIRTH_MONTHS.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                    <select
                        value={vipForm.birthDay}
                        onChange={(e) => setVipForm(prev => ({ ...prev, birthDay: e.target.value }))}
                        className="bg-zinc-900 p-4 rounded-xl border border-zinc-700 text-lg"
                    >
                        <option value="">Birth Day</option>
                        {VIP_BIRTH_DAYS.map(day => (
                            <option key={day} value={day}>{day}</option>
                        ))}
                    </select>
                </div>
                <label className="flex items-center gap-2 text-base text-zinc-300 mb-3">
                    <input
                        type="checkbox"
                        checked={vipForm.smsOptIn}
                        onChange={(e) => setVipForm(prev => ({ ...prev, smsOptIn: e.target.checked }))}
                    />
                    Text me when I'm up next (only if I opt in; host sets timing)
                </label>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-5 mb-4">
                    <div className="text-xs uppercase tracking-[0.45em] text-zinc-400 mb-2">VIP House Rules</div>
                    <ul className="text-base text-zinc-200 space-y-2">
                        {VIP_TOS_SUMMARY.map(item => (
                            <li key={item} className="flex gap-2">
                                <span className="text-cyan-300">-</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                    <label className="flex items-center gap-2 text-base text-zinc-300 mt-3">
                        <input
                            type="checkbox"
                            checked={vipForm.tosAccepted}
                            onChange={(e) => setVipForm(prev => ({ ...prev, tosAccepted: e.target.checked }))}
                        />
                        I agree to the VIP House Rules.
                    </label>
                </div>
                <button onClick={saveVipOnboarding} className="w-full bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black py-3 rounded-xl font-black text-lg">Save VIP Profile</button>
            </div>
        </div>
    );

    if (publicProfileOpen) {
        const data = publicProfileData || {};
        const profileIdentity = { ...(publicProfileUser || {}), ...data };
        const displayName = publicProfileUser?.name || data.name || 'Guest';
        const displayAvatar = publicProfileUser?.avatar || data.avatar || DEFAULT_EMOJI;
        const isPublicVip = isVipEntity(profileIdentity);
        const fame = getFameSnapshot(profileIdentity);
        const fameLevel = fame.level;
        const fameProgress = fame.progressToNext;
        const nextUnlock = getNextFameUnlockSnapshot(fame.total, fameLevel);
        const topTight15 = Array.isArray(data.tight15)
            ? data.tight15.slice(0, 3)
            : Array.isArray(data.tight15Temp)
                ? data.tight15Temp.slice(0, 3)
                : Array.isArray(publicProfileUser?.tight15Temp)
                    ? publicProfileUser.tight15Temp.slice(0, 3)
                    : [];
        const publicStats = leaderboardStats.find(s => s.uid === publicProfileUser?.uid || s.name === displayName) || {};
        const performanceBest = songs
            .filter(s => s.singerUid === publicProfileUser?.uid || s.singerName === displayName)
            .map(s => ({ ...s, score: (s.hypeScore || 0) + (s.applauseScore || 0) + (s.hostBonus || 0) }))
            .sort((a, b) => b.score - a.score)[0];
        return (
            <div
                className="fixed inset-0 bg-black/85 backdrop-blur-md z-[140] flex items-end sm:items-center justify-center text-white font-saira"
                onClick={() => setPublicProfileOpen(false)}
            >
                <div
                    className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-hidden rounded-t-[2rem] sm:rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-[#1a1030] via-[#111827] to-[#0a0d12] shadow-[0_0_55px_rgba(0,196,217,0.22)]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-20 -left-16 w-52 h-52 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none"></div>
                    <div className="sticky top-0 z-20 bg-black/45 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between gap-2">
                        <UserMetaCard
                            mode="full"
                            avatar={displayAvatar}
                            name={displayName}
                            isVip={isPublicVip}
                            showFame={false}
                        />
                        <button
                            onClick={() => setPublicProfileOpen(false)}
                            className="h-9 w-9 rounded-full border border-white/20 bg-black/50 text-zinc-200 text-sm font-black flex items-center justify-center"
                            aria-label="Close public profile"
                        >
                            X
                        </button>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar px-4 py-4">
                        {publicProfileLoading ? (
                            <div className="text-lg text-zinc-300">Loading profile...</div>
                        ) : (
                            <>
                                <div className="bg-black/40 border border-cyan-300/20 rounded-2xl p-4 mb-4">
                                    <div className="text-[10px] uppercase tracking-[0.45em] text-zinc-400 mb-2">Fame Level</div>
                                    <div className="text-xl text-zinc-100 font-bold mb-2">Level {fameLevel} - {fame.levelName}</div>
                                    <FameLevelProgressBar level={fameLevel} progressToNext={fameProgress} showLabel={false} />
                                    <div className="mt-2 text-xs text-zinc-300">{fame.total} fame points</div>
                                    {nextUnlock ? (
                                        <div className="mt-3 bg-black/30 border border-fuchsia-400/20 rounded-xl px-3 py-2">
                                            <div className="text-[10px] uppercase tracking-widest text-zinc-400">Next Unlock</div>
                                            <div className="text-sm text-zinc-100 mt-1">Lv {nextUnlock.level}: {nextUnlock.unlockLabel}</div>
                                            <div className="text-[11px] text-zinc-300 mt-1">
                                                {nextUnlock.pointsNeeded > 0
                                                    ? `${nextUnlock.pointsNeeded.toLocaleString()} fame points to go`
                                                    : 'Unlocked - refresh in-room stats if this does not show yet.'}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mt-3 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-zinc-300">
                                            Max fame tier reached. No further unlocks.
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-black/35 border border-white/10 rounded-xl p-3">
                                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Location</div>
                                        <div className="text-white text-base font-bold">{data.vipProfile?.location || '-'}</div>
                                    </div>
                                    <div className="bg-black/35 border border-white/10 rounded-xl p-3">
                                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Birthday</div>
                                        <div className="text-white text-base font-bold">{data.vipProfile?.birthMonth && data.vipProfile?.birthDay ? `${data.vipProfile.birthMonth} ${data.vipProfile.birthDay}` : '-'}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-black/35 border border-white/10 rounded-xl p-3">
                                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Performances</div>
                                        <div className="text-white font-black text-xl">{publicStats.performances || 0}</div>
                                    </div>
                                    <div className="bg-black/35 border border-white/10 rounded-xl p-3">
                                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Total Points</div>
                                        <div className="text-white font-black text-xl">{publicStats.totalPoints || 0}</div>
                                    </div>
                                    <div className="bg-black/35 border border-white/10 rounded-xl p-3">
                                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Loudest dB</div>
                                        <div className="text-white font-black text-xl">{publicStats.loudest || 0}</div>
                                    </div>
                                    <div className="bg-black/35 border border-white/10 rounded-xl p-3">
                                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Emojis</div>
                                        <div className="text-white font-black text-xl">{publicStats.totalEmojis || 0}</div>
                                    </div>
                                </div>
                                <div className="bg-black/35 border border-white/10 rounded-2xl p-4 mb-4">
                                    <div className="text-[10px] uppercase tracking-[0.45em] text-zinc-400 mb-2">Top 3 From Tight 15</div>
                                    {topTight15.length === 0 ? (
                                        <div className="text-sm text-zinc-300">No Tight 15 yet. Set one up to show your signature songs.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {topTight15.map((song, idx) => (
                                                <div key={`${song.songTitle}-${idx}`} className="flex items-center gap-3">
                                                    {song.albumArtUrl ? (
                                                        <img src={song.albumArtUrl} className="w-12 h-12 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-lg bg-zinc-700 flex items-center justify-center text-xl">{EMOJI.musicNotes}</div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold truncate">{song.songTitle}</div>
                                                        <div className="text-sm text-zinc-400 truncate">{song.artist}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="bg-black/35 border border-white/10 rounded-2xl p-4">
                                    <div className="text-[10px] uppercase tracking-[0.45em] text-zinc-400 mb-2">Performance Stats</div>
                                    <div className="text-sm text-zinc-200 mb-2">Total performances: {leaderboardStats.find(s => s.uid === publicProfileUser?.uid)?.performances || 0}</div>
                                    {performanceBest ? (
                                        <div className="text-sm text-zinc-300">Best moment: {performanceBest.songTitle} - {performanceBest.score} pts</div>
                                    ) : (
                                        <div className="text-sm text-zinc-400">No performances yet.</div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (showFeedbackForm) return renderFeedbackModal();
    if (showAbout) return renderAboutModal();

    if (showPhoneModal) return (
        <div className="fixed inset-0 bg-black/80 z-[130] flex items-center justify-center p-6">
            <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-2">Unlock VIP via SMS</h2>
                <p className="text-sm text-zinc-400 mb-4">Enter your phone number (include country code). We'll text a verification code. Alerts only send if you opt in.</p>
                <input value={phoneNumber} onChange={e=>setPhoneNumber(e.target.value)} placeholder="+1 555 555 5555" className="w-full p-3 mb-3 rounded bg-zinc-800 border border-zinc-700" />
                {!smsSent ? (
                    <div className="flex gap-2">
                        <button onClick={()=>setShowPhoneModal(false)} className="flex-1 bg-zinc-700 py-3 rounded">Cancel</button>
                        <button onClick={() => startPhoneAuth('recap-container-modal')} className="flex-1 bg-cyan-500 py-3 rounded font-bold">{phoneLoading ? 'Sending...' : 'Send SMS'}</button>
                    </div>
                ) : (
                    <>
                        <input value={smsCode} onChange={e=>setSmsCode(e.target.value)} placeholder="6-digit code" className="w-full p-3 mb-3 rounded bg-zinc-800 border border-zinc-700" />
                        <div className="flex gap-2">
                            <button onClick={()=>{ setSmsSent(false); setSmsCode(''); }} className="flex-1 bg-zinc-700 py-3 rounded">Back</button>
                            <button onClick={confirmPhoneCode} className="flex-1 bg-[#00C4D9] text-black py-3 rounded font-bold">{phoneLoading ? 'Verifying...' : 'Verify Code'}</button>
                        </div>
                    </>
                )}

                <button onClick={bypassSmsVip} className="mt-4 text-xs text-cyan-300 underline underline-offset-4">Skip SMS for QA</button>

                {/* reCAPTCHA container for invisible verifier */}
                <div id="recap-container-modal" className="mt-4"></div>
            </div>
        </div>
    );
    
    
    if ((viewLyrics || hostLyricsActive) && currentSinger?.lyrics) {
        return (
            <div className="h-screen relative overflow-hidden">
                <AppleLyricsRenderer 
                    lyrics={currentSinger.lyrics} 
                    timedLyrics={currentSinger.lyricsTimed}
                    duration={currentSinger.duration || 180} 
                    art={currentSinger.albumArtUrl} 
                    title={currentSinger.songTitle}
                    artist={currentSinger.artist}
                    isActive={true}
                    // Pass the Room state for sync
                    startTime={room.videoStartTimestamp}
                    pausedAt={room.pausedAt}
                    isPlaying={room.videoPlaying}
                    showAll={showAllLyrics}
                />
                <div className="absolute top-8 left-8 flex bg-black/50 border border-white/10 rounded-full p-1 gap-1 z-50">
                    <button onClick={()=>setShowAllLyrics(true)} className={"px-3 py-1 rounded-full text-xs font-bold " + (showAllLyrics ? 'bg-[#00C4D9] text-black' : 'text-white')} >FULL</button>
                    <button onClick={()=>setShowAllLyrics(false)} className={"px-3 py-1 rounded-full text-xs font-bold " + (!showAllLyrics ? 'bg-cyan-500 text-black' : 'text-white')} >AUTO</button>
                </div>
                <div className="absolute bottom-10 right-10 z-[100] flex flex-col items-end gap-2">
                    <button
                        onClick={() => {
                            setViewLyrics(false);
                            setInlineLyrics(false);
                            if (hostLyricsActive) setDismissedHostLyrics(true);
                        }}
                        className="bg-white/20 backdrop-blur-lg px-6 py-3 rounded-full font-bold border border-white/30 text-white"
                    >
                        CLOSE LYRICS
                    </button>
                </div>
            </div>
        );
    }

    if (showAudienceVideoFullscreen) {
        return (
            <div className="fixed inset-0 z-[120] bg-black flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/80">
                    <div className="text-xs uppercase tracking-[0.4em] text-zinc-400">Audience Video</div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowAudienceVideoFullscreen(false)} className="bg-white/20 px-4 py-1.5 rounded-full text-xs font-bold text-white border border-white/30">
                            Close
                        </button>
                    </div>
                </div>
                <div className="flex-1 relative">
                    {isNativeVideo && (
                        <video
                            ref={audienceVideoRef}
                            src={mediaUrl}
                            className="absolute inset-0 w-full h-full object-contain bg-black"
                            playsInline
                            muted
                        />
                    )}
                    {!isNativeVideo && youtubeId && (
                        <iframe
                            key={`${youtubeId}_${room?.videoStartTimestamp || 0}`}
                            className="absolute inset-0 w-full h-full"
                            src={audienceIframeSrc}
                            allow="autoplay; fullscreen"
                            title="Audience Video"
                            frameBorder="0"
                        ></iframe>
                    )}
                    {!isNativeVideo && !youtubeId && (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                            Video unavailable
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (showHowToPlay) {
        const slides = HOW_TO_PLAY.sections || [];
        const active = slides[howToPlayIndex] || { title: '', items: [] };
        const handleTouchStart = (e) => {
            howToPlayTouchStart.current = e.touches[0]?.clientX ?? null;
        };
        const handleTouchEnd = (e) => {
            if (howToPlayTouchStart.current === null) return;
            const endX = e.changedTouches[0]?.clientX ?? howToPlayTouchStart.current;
            const delta = endX - howToPlayTouchStart.current;
            howToPlayTouchStart.current = null;
            if (Math.abs(delta) < 40) return;
            if (delta < 0) {
                setHowToPlayIndex(prev => Math.min(slides.length - 1, prev + 1));
            } else {
                setHowToPlayIndex(prev => Math.max(0, prev - 1));
            }
        };
        return (
            <div className="fixed inset-0 bg-[#0b0e12] z-[110] p-6 flex flex-col items-center justify-center font-saira text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1a1f2b,transparent_55%),radial-gradient(circle_at_bottom,#1b0f22,transparent_45%)] opacity-90"></div>
                <div className="absolute -top-24 -left-16 w-64 h-64 rounded-full bg-cyan-500/20 blur-3xl"></div>
                <div className="absolute -bottom-28 -right-20 w-72 h-72 rounded-full bg-pink-500/20 blur-3xl"></div>
                <div
                    className="relative z-10 w-full max-w-xl bg-black/60 border border-white/10 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,196,217,0.25)]"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <img src={room?.logoUrl || ASSETS.logo} alt="Beaurocks Karaoke" className="h-12 w-12 rounded-2xl" />
                        <div>
                            <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">How to Play</div>
                            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00C4D9] to-[#EC4899]">
                                {HOW_TO_PLAY.title}
                            </h2>
                        </div>
                    </div>
                    <div className="text-base text-zinc-300 mb-5">{HOW_TO_PLAY.subtitle}</div>
                    <div className="bg-black/50 border border-white/10 rounded-2xl p-5">
                        <div className="text-sm font-bold text-cyan-200 uppercase tracking-widest mb-3">{active.title}</div>
                        <ul className="text-lg text-zinc-100 space-y-3">
                            {active.items.map(item => (
                                <li key={item} className="flex gap-2">
                                    <span className="text-pink-400">*</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                        <div>Swipe to browse - {howToPlayIndex + 1} of {slides.length || 1}</div>
                        <div className="flex gap-2">
                            {slides.map((_, i) => (
                                <span key={i} className={`h-1.5 w-6 rounded-full ${i === howToPlayIndex ? 'bg-gradient-to-r from-[#00C4D9] to-[#EC4899]' : 'bg-zinc-700'}`}></span>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => setShowHowToPlay(false)} className="w-full bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black py-3 rounded-xl font-black text-lg mt-5">
                        Back to Party
                    </button>
                </div>
            </div>
        );
    }
    if (showPoints) return (
        <div className="fixed inset-0 bg-black/70 z-[110] p-6 flex flex-col items-center justify-center font-saira text-white text-center">
            <div className="w-full max-w-sm bg-gradient-to-br from-zinc-800 via-zinc-900 to-[#231426] border border-pink-400/30 rounded-3xl p-6 shadow-[0_0_60px_rgba(255,103,182,0.35)] text-left max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="text-sm uppercase tracking-[0.35em] text-zinc-300">Points</div>
                        <h2 className="text-4xl font-black text-cyan-300">Fuel the show</h2>
                    </div>
                    <div className="bg-black/50 border border-cyan-500/30 rounded-full px-4 py-1.5 text-lg font-black text-cyan-300">
                        {Math.max(0, getEffectivePoints())} PTS
                    </div>
                </div>
                {!showPointsShop ? (
                    <>
                        <div className="grid gap-3">
                            <div className="bg-black/30 border border-pink-400/40 rounded-2xl p-4">
                                <div className="text-base uppercase tracking-widest text-pink-200 mb-2">Earn points</div>
                                <div className="flex items-center gap-3 text-lg text-zinc-100">
                                    <span className="text-2xl">{EMOJI.sparkle}</span>
                                    Win games, bonus drops, and crowd moments.
                                </div>
                                <div className="flex items-center gap-3 text-lg text-zinc-100 mt-2">
                                    <span className="text-2xl">{EMOJI.star}</span>
                                    VIP unlock = +5000 PTS boost.
                                </div>
                                <button
                                    onClick={() => openVipUpgrade()}
                                    className="mt-3 w-full bg-[#00C4D9]/20 border border-[#00C4D9]/40 text-cyan-200 py-2 rounded-xl font-bold text-base"
                                >
                                    Upgrade to VIP
                                </button>
                            </div>
                            <div className="bg-black/30 border border-cyan-400/40 rounded-2xl p-4">
                                <div className="text-base uppercase tracking-widest text-cyan-200 mb-2">Carry over?</div>
                                <div className="text-lg text-zinc-100">VIP points carry between sessions. Guest points stay in the room.</div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-4">
                            <button onClick={() => setShowPointsShop(true)} className="bg-gradient-to-r from-pink-600/40 to-cyan-500/40 border border-pink-400/50 px-6 py-3 rounded-xl font-bold text-white text-base tracking-wide min-h-[44px]">Add More Points</button>
                            <button onClick={() => { setShowPoints(false); setShowHowToPlay(true); }} className="bg-cyan-600/20 text-cyan-200 border border-cyan-400/40 px-6 py-2 rounded-xl font-bold text-base tracking-wide min-h-[44px]">How to Play</button>
                            <button onClick={() => { setShowPoints(false); setShowPointsShop(false); }} className="bg-zinc-700 px-6 py-2 rounded-xl text-base tracking-wide min-h-[44px]">Close</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-sm uppercase tracking-widest text-zinc-300 mb-2">Get more points</div>
                        <div className="grid gap-3">
                            {POINTS_PACKS.slice(0, 2).map((pack, idx) => {
                                const amount = pack.amount ? `$${pack.amount}` : '$';
                                const points = pack.points ? `+${pack.points} pts` : '';
                                const isBest = idx === 1;
                                return (
                                    <button
                                        key={pack.id || `${pack.label}-${idx}`}
                                        onClick={() => startPersonalPackCheckout(pack)}
                                        className={`w-full rounded-2xl px-5 py-4 text-left border transition-colors ${isBest ? 'bg-pink-500/20 border-pink-400/60 hover:border-pink-300/80' : 'bg-zinc-900/70 border-zinc-700 hover:border-zinc-500/60'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm uppercase tracking-widest text-zinc-300">{isBest ? 'Best value' : 'Quick boost'}</div>
                                                <div className="text-2xl font-bold text-white flex items-center gap-2">
                                                    <span className="text-2xl">{EMOJI.gift}</span>
                                                    {pack.label}
                                                </div>
                                                <div className="text-base text-zinc-200">You get {points}</div>
                                            </div>
                                            <div className="text-pink-200 font-black text-2xl">{amount}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="text-sm uppercase tracking-widest text-zinc-300 mt-5 mb-2">Room boosts</div>
                        <div className="grid gap-3">
                            {(tipCrates.length ? tipCrates : [{ id: 'tip_default', label: 'Room Boost', amount: 20, points: 2500 }]).slice(0, 1).map((crate, idx) => {
                                const label = crate.label || `Room Boost ${idx + 1}`;
                                const amount = crate.amount ? `$${crate.amount}` : '$';
                                const points = crate.points ? `+${crate.points} pts` : '';
                                return (
                                    <button
                                        key={crate.id || `${label}-${idx}`}
                                        onClick={() => startTipCrateCheckout(crate)}
                                        className="w-full bg-[#00C4D9]/15 border border-[#00C4D9]/50 rounded-2xl px-5 py-4 text-left hover:border-[#00C4D9]/80"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-sm uppercase tracking-widest text-cyan-200">Room boost - Earns a badge</div>
                                                <div className="text-2xl font-bold text-white flex items-center gap-2">
                                                    <span className="text-2xl">{EMOJI.crown}</span>
                                                    {label}
                                                </div>
                                                <div className="text-base text-zinc-200">Everyone gets {points} + Crowd Hero badge</div>
                                            </div>
                                            <div className="text-cyan-300 font-black text-2xl">{amount}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex flex-col gap-2 mt-4">
                            <button onClick={() => setShowPointsShop(false)} className="bg-zinc-800 px-6 py-2 rounded-xl font-bold text-base tracking-wide min-h-[44px]">Back</button>
                            <button onClick={() => { setShowPoints(false); setShowPointsShop(false); }} className="bg-zinc-700 px-6 py-2 rounded-xl text-base tracking-wide min-h-[44px]">Close</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    const fameLevelIcons = [
        EMOJI.musicNotes,
        EMOJI.mic,
        EMOJI.star,
        EMOJI.sparkle,
        EMOJI.fire,
        EMOJI.crown,
        EMOJI.diamond,
        EMOJI.rocket,
        EMOJI.lightning,
        EMOJI.guitar,
        EMOJI.coin,
        EMOJI.gift,
        EMOJI.radio
    ];
    const fameLevelEntries = Object.entries(FAME_LEVELS)
        .map(([level, data]) => ({ level: Number(level), ...data }))
        .sort((a, b) => a.level - b.level);
    const getFameIcon = (level) => fameLevelIcons[level % fameLevelIcons.length] || EMOJI.star;
    const totalFameLevels = fameLevelEntries.length;
    const currentFameTotal = profile?.totalFamePoints || 0;
    const currentFameLevel = getLevelFromFame(currentFameTotal);


    if (showFameLevels) return (
        <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[120] flex items-end sm:items-center justify-center text-white font-saira"
            onClick={() => setShowFameLevels(false)}
        >
            <div
                className="relative w-full sm:max-w-xl max-h-[94dvh] overflow-hidden rounded-t-[2rem] sm:rounded-3xl border border-cyan-300/35 bg-gradient-to-br from-[#1a1130] via-[#0f1726] to-[#0a0d12] shadow-[0_0_60px_rgba(34,211,238,0.22)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute -top-28 -left-20 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none"></div>
                <div className="sticky top-0 z-20 bg-black/45 backdrop-blur border-b border-white/10 px-5 py-4 flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.45em] text-zinc-400">Fame System</div>
                        <h2 className="text-3xl font-bebas text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-300 mt-1">FAME LEVELS</h2>
                        <div className="text-sm text-zinc-300">{totalFameLevels} total levels</div>
                    </div>
                    <button
                        onClick={() => setShowFameLevels(false)}
                        className="h-9 w-9 rounded-full border border-white/20 bg-black/50 text-zinc-200 text-sm font-black"
                        aria-label="Close fame levels"
                    >
                        X
                    </button>
                </div>
                <div className="overflow-y-auto custom-scrollbar px-5 py-4 space-y-3">
                    <div className="bg-black/40 border border-cyan-300/25 rounded-2xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(34,211,238,0.35)]" style={{ background: '#0f172a', border: '1px solid #22d3ee' }}>
                                {getFameIcon(currentFameLevel)}
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">Current Level</div>
                                <div className="text-xl font-bold text-white">Level {currentFameLevel} - {FAME_LEVELS?.[currentFameLevel]?.name || 'Rising Star'}</div>
                                <div className="text-sm text-zinc-300">{currentFameTotal} Fame Points</div>
                            </div>
                        </div>
                        <div className="mt-3">
                            <FameLevelProgressBar level={currentFameLevel} progressToNext={getProgressToNextLevel(currentFameTotal, currentFameLevel)} />
                        </div>
                    </div>
                    <div className="space-y-3 pb-2">
                        {fameLevelEntries.map(level => {
                            const isCurrent = level.level === currentFameLevel;
                            const isUnlocked = currentFameTotal >= level.minFame;
                            const nextLabel = level.nextThreshold === Infinity ? 'MAX' : `${level.nextThreshold} FP`;
                            return (
                                <div
                                    key={level.level}
                                    className={`rounded-2xl p-4 border ${isCurrent ? 'bg-white/5' : 'bg-zinc-900/70'}`}
                                    style={{ borderColor: `${level.color}55`, boxShadow: isCurrent ? `0 0 22px ${level.color}40` : 'none' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: `${level.color}20`, border: `1px solid ${level.color}70` }}>
                                            {getFameIcon(level.level)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">Level {level.level}</div>
                                                {isCurrent && <div className="text-[10px] uppercase tracking-widest text-cyan-200 bg-cyan-500/15 border border-cyan-400/30 px-2 py-0.5 rounded-full">Current</div>}
                                            </div>
                                            <div className="text-base font-bold text-white">{level.name}</div>
                                            <div className="text-xs text-zinc-300">Unlocks at {level.minFame} FP - Next {nextLabel}</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid gap-2">
                                        <div className="text-sm text-zinc-200">
                                            <span className="text-zinc-400">Reward:</span> {level.reward || '-'}
                                        </div>
                                        {level.unlock && (
                                            <div className="text-sm text-zinc-200">
                                                <span className="text-zinc-400">Unlock:</span> {level.unlock}
                                            </div>
                                        )}
                                        <div className={`text-xs uppercase tracking-widest px-2 py-1 rounded-full w-fit ${isUnlocked ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/30' : 'bg-white/5 text-zinc-400 border border-white/10'}`}>
                                            {isUnlocked ? 'Unlocked' : 'Locked'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );

    if (room?.activeMode === 'applause' || room?.activeMode === 'applause_countdown') {
        return (
            <div className="fixed inset-0 z-50 bg-[#00C4D9]/20 flex flex-col items-center justify-center p-6 text-white font-saira">
                <h1 className="text-5xl font-bebas mb-8 text-cyan-300 animate-bounce">APPLAUSE METER!</h1>
                <button onClick={()=>react('clap', 0)} className={`w-full h-64 bg-[#00C4D9] rounded-full flex items-center justify-center border-8 border-[#00C4D9]/60 shadow-2xl active:scale-95 transition-transform ${cooldownFlash ? 'ring-4 ring-red-300 animate-pulse' : ''}`}>
                    <span className="text-8xl">{String.fromCodePoint(0x1F44F)}</span>
                </button>
                <p className="mt-8 font-bold">TAP FAST! (Free)</p>
            </div>
        );
    }

    // --- MAIN LAYOUT ---
    const queueSettingsView = room?.queueSettings || {};
    const queueLimitModeView = queueSettingsView.limitMode || 'none';
    const queueLimitCountView = Math.max(0, Number(queueSettingsView.limitCount || 0));
    const queueRotationView = queueSettingsView.rotation || 'round_robin';
    const queueFirstTimeBoostView = queueSettingsView.firstTimeBoost !== false;
    const queueRuleIcons = [
        {
            icon: queueLimitModeView === 'none' || queueLimitCountView <= 0 ? 'fa-infinity' : 'fa-hourglass-half',
            title: queueLimitModeView === 'none' || queueLimitCountView <= 0
                ? 'No request limits'
                : queueLimitModeView === 'per_hour'
                    ? `Limit: ${queueLimitCountView} per hour`
                    : queueLimitModeView === 'per_night'
                        ? `Limit: ${queueLimitCountView} per night`
                        : `Soft limit: ${queueLimitCountView} per night`
        },
        {
            icon: queueRotationView === 'round_robin' ? 'fa-rotate-right' : 'fa-list',
            title: queueRotationView === 'round_robin' ? 'Round robin queue' : 'First come queue'
        },
        {
            icon: queueFirstTimeBoostView ? 'fa-star' : 'fa-user',
            title: queueFirstTimeBoostView ? 'First-time singers boosted' : 'No first-time boost'
        }
    ];
    const queueSongsView = [...songs]
        .filter(s => ['performing', 'requested', 'pending'].includes(s.status))
        .sort((a, b) => {
            const order = { performing: 0, requested: 1, pending: 2 };
            const aOrder = order[a.status] ?? 9;
            const bOrder = order[b.status] ?? 9;
            if (aOrder !== bOrder) return aOrder - bOrder;
            const aTime = a.timestamp?.seconds ? a.timestamp.seconds : 0;
            const bTime = b.timestamp?.seconds ? b.timestamp.seconds : 0;
            return aTime - bTime;
        });
    const queueWaitTimeSec = songs
        .filter(s => s.status === 'requested')
        .reduce((sum, s) => {
            const duration = Number(s.duration);
            return sum + (Number.isFinite(duration) && duration > 0 ? duration : 300);
        }, 0);
    const browseFilterLower = browseFilter.trim().toLowerCase();
    const activeBrowseSongsFiltered = activeBrowseList?.songs
        ? activeBrowseList.songs.filter((song) => (`${song.title} ${song.artist}`).toLowerCase().includes(browseFilterLower))
        : [];
    const top100SongsFiltered = top100Songs.filter((song) => (`${song.title} ${song.artist}`).toLowerCase().includes(browseFilterLower));
    const ytIndexFilterLower = ytIndexFilter.trim().toLowerCase();
    const ytIndexFiltered = ytIndex.filter((item) => (`${item.trackName} ${item.artistName}`).toLowerCase().includes(ytIndexFilterLower));
    const openTop100Browse = () => {
        setBrowseFilter('');
        setShowTop100(true);
    };
    const openYtIndexBrowse = () => {
        setYtIndexFilter('');
        setShowYtIndex(true);
    };
    const formatWaitTime = (seconds) => {
        if (!seconds) return '0m';
        const mins = Math.floor(seconds / 60);
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        if (hrs > 0) return `${hrs}h ${remMins}m`;
        return `${mins}m`;
    };
    const myFame = getFameSnapshot({
        fameLevel: typeof profile?.currentLevel === 'number' ? profile.currentLevel : undefined,
        totalFamePoints: profile?.totalFamePoints || 0
    });
    const myNextUnlock = getNextFameUnlockSnapshot(myFame.total, myFame.level);
    const sortedUsers = [...allUsers].sort((a, b) => (b.points || 0) - (a.points || 0));
    const lobbyUsers = (() => {
        const list = [...allUsers];
        const hostName = room?.hostName;
        const hostUid = room?.hostUid;
        const hasHost = hostName && list.some(u => u.uid === hostUid || u.name === hostName);
        if (hostName && !hasHost) {
            list.unshift({
                uid: hostUid || 'host',
                name: hostName,
                avatar: EMOJI.mic,
                isVip: true,
                isHost: true
            });
        }
        return list;
    })();
    const socialPrimaryTabs = [
        { key: 'lounge', label: 'VIP Lounge' },
        { key: 'host', label: 'DM Host' },
        { key: 'leaderboard', label: 'Leaderboard' },
        { key: 'lobby', label: 'Lobby' }
    ];
    if (isVipAccount) {
        socialPrimaryTabs.push({ key: 'history', label: 'History', fullWidth: true });
    }
    const showChatPanel = ['lounge', 'host'].includes(socialTab);
    const activeMessages = chatTab === 'host' ? dmMessages : loungeMessages;
    const groupedActiveMessages = groupChatMessages(activeMessages, { mergeWindowMs: 12 * 60 * 1000 });
    const chatTitle = socialTab === 'host' ? 'DM Host' : 'VIP Lounge';
    const chatStatusLabel = !room?.chatEnabled
        ? 'Chat paused'
        : socialTab === 'host'
            ? 'Private DM'
            : room?.chatAudienceMode === 'vip'
                ? 'VIP only'
                : 'Public lounge';
    const chatInputDisabled = room?.chatEnabled === false
        || (chatTab === 'lounge' && chatLocked)
        || (socialTab === 'lounge' && room?.chatAudienceMode === 'vip' && !isVipAccount);
    const quickActionMessages = socialTab === 'host'
        ? ['Mic check?', 'Can we bump the volume?', 'Any updates for the queue?']
        : ['Say hi!', 'Welcome to the party!', 'Mic check?'];
    const handleSocialTabChange = (nextTab) => {
        setSocialTab(nextTab);
        if (['lounge', 'host'].includes(nextTab)) {
            const source = nextTab === 'host' ? dmMessages : loungeMessages;
            const newest = source[0]?.timestamp?.seconds ? source[0].timestamp.seconds * 1000 : 0;
            if (newest) chatLastSeenRef.current = newest;
            setChatUnread(false);
        }
    };

    return (
        <div className="relative h-[100dvh] min-h-[100dvh] bg-[#090612] text-white font-saira flex flex-col overflow-hidden">
            {/* Header: Reorganized Layout */}
              <div className="pt-[calc(env(safe-area-inset-top)+12px)] bg-gradient-to-r from-[#4b1436] via-[#FF67B6] to-[#4b1436] shadow-lg z-20 relative h-24 overflow-visible">
                  <div className="relative h-full">
                      <button onClick={() => setShowAbout(true)} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer hover:opacity-90 transition-opacity overflow-visible z-[80]">
                          <img src={BRAND_ICON} className="w-[212px] h-[106px] object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.75)] logo-bounce relative z-[60]" alt="Beaurocks Karaoke" />
                      </button>
                      <div className="grid grid-cols-[minmax(0,140px)_auto_minmax(0,140px)] items-center h-full gap-2 px-4" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))' }}>
                      {/* Left: User Emoji & Name */}
                      <div className="flex items-center justify-start min-w-0 relative z-10">
                          <button onClick={() => { setTab('social'); setSocialTab('profile'); }} className="bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-lg h-11 w-[126px] sm:w-[140px] min-w-0">
                              <span className="text-2xl">{user?.avatar}</span>
                              <span className="font-bold truncate text-sm text-white">{user?.name}</span>
                          </button>
                      </div>
                      <div />
                      {/* Right: Points */}
                      <div className="flex items-center justify-end min-w-0 relative z-10">
                          <AnimatedPoints
                              value={Math.max(0, getEffectivePoints())}
                              onClick={() => setShowPoints(true)}
                              className="w-[126px] sm:w-[140px]"
                          />
                      </div>
                  </div>
                  </div>
              </div>

            {/* Local Reactions Layer */}
            <div className="absolute inset-0 z-[90] pointer-events-none overflow-hidden">{localReactions.map(r => (<div key={r.id} className={`absolute bottom-0 flex flex-col items-center ${getReactionClass(r.type)}`} style={{left: `${r.left}%`}}><div className="text-8xl filter drop-shadow-xl">{getEmojiChar(r.type)}</div></div>))}</div>
            {showBallad && (
                <div className="absolute inset-0 z-[80] pointer-events-none overflow-hidden">
                <div className="absolute inset-0 ballad-haze"></div>
                <div className="absolute inset-x-0 bottom-0 h-[70%] ballad-glow"></div>
                <div className="absolute inset-0 fire-overlay opacity-90"></div>
                <div className="absolute inset-0 pointer-events-none">
                    {[...Array(10)].map((_, i) => (
                        <div
                            key={`ballad-fire-${i}`}
                            className="fire-particle"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 2.5}s`,
                                animationDuration: `${1.6 + Math.random() * 1.4}s`,
                                fontSize: '2.5rem',
                                opacity: 0.8
                            }}
                        >
                            {EMOJI.fire}
                        </div>
                    ))}
                </div>
                <div className="absolute top-24 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[0.45em] text-white/80 uppercase">Lights Up - Sway</div>
                    {balladLights.map((light, idx) => (
                        <div
                            key={idx}
                            className="absolute ballad-orb"
                            style={{
                                left: light.left,
                                bottom: light.bottom,
                                '--orb-size': light.size,
                                '--sway-duration': light.sway,
                                '--float-delay': light.delay,
                                '--orb-alpha': light.opacity
                            }}
                        ></div>
                    ))}
                </div>
            )}
            {showBanger && (
                <div className="absolute inset-0 z-[80] pointer-events-none overflow-hidden">
                    <div className="absolute inset-0 vibe-banger"></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-pink-500/25 via-transparent to-cyan-500/25"></div>
                    <div className="absolute top-24 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-[0.45em] text-white/80 uppercase">Banger Mode - Feel The Bass</div>
                </div>
            )}

            {/* Omnipresent Stage Area */}
            {(tab === 'home' || tab === 'request' || tab === 'social') && (
                <div className="bg-black/40 border-b-4 border-[#00C4D9]/30 z-10 relative" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left))', paddingRight: 'max(16px, env(safe-area-inset-right))', paddingTop: '16px', paddingBottom: '16px' }}>
                    {currentSinger ? (
                        <div className="bg-indigo-900/80 rounded-2xl border border-indigo-500/30 shadow-lg backdrop-blur-md relative overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-black/70 via-black/30 to-black/70">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2 bg-black/50 border border-cyan-400/40 px-3 py-1.5 rounded-full">
                                            <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">ROOM</span>
                                            <span className="text-[1.2rem] font-bebas text-cyan-200 tracking-[0.25em]">{roomCode}</span>
                                        </div>
                                        <button onClick={() => { setTab('social'); setSocialTab('lobby'); }} className="flex items-center gap-1 text-base font-bold text-white/85 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full min-h-[28px] leading-none">
                                            <i className="fa-solid fa-users stage-icon text-white/70"></i>
                                            {allUsers.length || 0}
                                        </button>
                                        <button onClick={() => { setTab('request'); setSongsTab('queue'); }} className="flex items-center gap-1 text-base font-bold text-white/85 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full min-h-[28px] leading-none">
                                            <i className="fa-solid fa-list stage-icon text-white/70"></i>
                                            {queueSongsView.length}
                                        </button>
                                        <div className="flex items-center gap-1 text-base font-bold text-white/85 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full min-h-[28px] leading-none">
                                            <i className="fa-solid fa-clock stage-icon text-white/70"></i>
                                            {formatWaitTime(queueWaitTimeSec)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {room?.hostName && (
                                            <button
                                                onClick={() => { setTab('social'); setSocialTab('host'); }}
                                                className="flex items-center gap-1 text-base font-bold text-white/85 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full leading-none hover:bg-white/10"
                                            >
                                                <span className="inline-flex items-center text-base text-white/70 leading-none translate-y-[1px]">{EMOJI.crown}</span>
                                                <span className="text-white/85">{room.hostName}</span>
                                            </button>
                                        )}
                                        <button onClick={(e)=>{ e.stopPropagation(); copyInviteLink(); }} className="flex items-center gap-1 text-base font-bold text-white/85 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full leading-none hover:bg-white/10">
                                            <i className="fa-solid fa-link stage-icon text-white/70"></i>
                                            Share
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {room?.activeMode === 'bingo' && !showBingoOverlay && room?.bingoAudienceReopenEnabled !== false && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowBingoOverlay(true); }}
                                            className="flex items-center gap-1 bg-purple-500/20 text-purple-200 border border-purple-400/40 px-3 py-1.5 rounded-full text-base font-bold min-h-[28px] leading-none hover:bg-purple-500/30"
                                            title="View Bingo board"
                                        >
                                            <i className="fa-solid fa-table-cells stage-icon"></i>
                                            Bingo Live
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 border-t border-white/10">
                            <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1 text-left">
                                <div className="text-[12px] text-indigo-300 uppercase tracking-widest font-bold mb-1">NOW PERFORMING</div>
                                <div className="font-bold text-xl leading-none truncate text-white">{currentSinger.singerName}</div>
                                <div className="text-sm text-indigo-200 italic truncate">{currentSinger.songTitle}</div>
                                {nowPlayingLabel && (
                                    <div className="mt-1 inline-flex items-center gap-2 text-[11px] uppercase tracking-widest bg-black/40 border border-white/10 rounded-full px-3 py-1 text-zinc-200">
                                        <span className={`${
                                            nowPlayingLabel.sourceKey === 'apple'
                                                ? 'text-emerald-300'
                                                : nowPlayingLabel.sourceKey === 'youtube'
                                                    ? 'text-red-300'
                                                    : 'text-cyan-200'
                                        }`}>{nowPlayingLabel.source}</span>
                                        <span className="text-white/70">|</span>
                                        <span className="text-white/90 truncate max-w-[160px]">{nowPlayingLabel.title}</span>
                                        <span className="text-white/50">({nowPlayingLabel.state})</span>
                                    </div>
                                )}
                            </div>
                                {currentSinger.albumArtUrl ? (
                                    <img src={currentSinger.albumArtUrl} className="w-14 h-14 rounded-lg shadow-md object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-14 h-14 rounded-lg bg-indigo-700/50 flex items-center justify-center text-3xl shadow-md flex-shrink-0">{DEFAULT_EMOJI}</div>
                                )}
                            </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!mediaUrl || audienceVideoForced || isAudio) return;
                                            const next = !showAudienceVideo;
                                            if (next) {
                                                setInlineLyrics(false);
                                                setViewLyrics(false);
                                            }
                                            if (!next) setShowAudienceVideoFullscreen(false);
                                            setShowAudienceVideo(next);
                                        }}
                                        className={`px-3 py-1 rounded text-xs font-bold border ${mediaUrl && !isAudio ? 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200' : 'border-white/10 text-white/30 bg-white/5'} ${audienceVideoForced || isAudio ? 'cursor-not-allowed opacity-60' : 'hover:bg-fuchsia-500/25'}`}
                                    >
                                        <i className="fa-solid fa-tv mr-1"></i>
                                        {audienceVideoForced ? 'Synced' : isAudio ? 'Audio' : showAudienceVideo ? 'Video On' : 'Video'}
                                    </button>
                                    {applePlaybackActive && (
                                        <button
                                            disabled
                                            className={`px-3 py-1 rounded text-xs font-bold border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 opacity-90 cursor-default`}
                                        >
                                            <i className="fa-brands fa-apple mr-1"></i>
                                            Apple Music {applePlayback?.status === 'paused' ? 'Paused' : 'Live'}
                                        </button>
                                    )}
                                    <button
                                        disabled={!hasLyrics}
                                        onClick={() => {
                                            if (!hasLyrics) return;
                                            if (hostLyricsActive) {
                                                setViewLyrics(false);
                                                setDismissedHostLyrics(true);
                                                return;
                                            }
                                            setShowAudienceVideo(false);
                                            setShowAudienceVideoFullscreen(false);
                                            if (!inlineLyrics && !viewLyrics) {
                                                setInlineLyrics(true);
                                                return;
                                            }
                                            if (inlineLyrics && !viewLyrics) {
                                                setViewLyrics(true);
                                                return;
                                            }
                                            if (viewLyrics) {
                                                setViewLyrics(false);
                                                setInlineLyrics(false);
                                                setDismissedHostLyrics(true);
                                            }
                                        }}
                                        className={`px-3 py-1 rounded text-xs font-bold border ${hasLyrics ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25' : 'border-white/10 text-white/30 bg-white/5 cursor-not-allowed opacity-60'}`}
                                    >
                                        <i className="fa-solid fa-align-left mr-1"></i>
                                        {hostLyricsActive ? 'Host Lyrics' : viewLyrics ? 'Lyrics Full' : inlineLyrics ? 'Lyrics Inline' : 'Lyrics'}
                                    </button>
                                    <button onClick={()=>addToTight15(currentSinger)} className="px-3 py-1 rounded text-xs font-bold border bg-pink-500/20 text-pink-200 border-pink-400/30 hover:bg-pink-500/30">+ TIGHT 15</button>
                                </div>
                                {(showAudienceVideoInline || inlineLyrics) && (
                                    <div className="mt-3 space-y-3 -mx-4">
                                        {showAudienceVideoInline ? (
                                            <div className="bg-black/70 border-y border-white/10 overflow-hidden">
                                                <div className="flex items-center justify-between px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-zinc-400 bg-black/60">
                                                    <span>Audience Video</span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setShowAudienceVideoFullscreen(true)}
                                                            className="text-cyan-300 tracking-normal uppercase hover:text-cyan-200"
                                                        >
                                                            Full screen
                                                        </button>
                                                        <span className={`text-[10px] tracking-[0.25em] px-2 py-0.5 rounded-full border ${room?.videoPlaying ? 'border-emerald-400/40 text-emerald-200 bg-emerald-500/10' : 'border-zinc-500/40 text-zinc-300 bg-black/40'}`}>
                                                            {room?.videoPlaying ? 'SYNCED' : 'PAUSED'}
                                                        </span>
                                                        {audienceVideoForced && <span className="text-cyan-300 tracking-normal uppercase">Synced by host</span>}
                                                    </div>
                                                </div>
                                                <div className="relative w-full aspect-video bg-black">
                                                    {isNativeVideo && (
                                                        <video
                                                            ref={audienceVideoRef}
                                                            src={mediaUrl}
                                                            className="absolute inset-0 w-full h-full object-contain"
                                                            playsInline
                                                            muted
                                                        />
                                                    )}
                                                    {!isNativeVideo && youtubeId && (
                                                        <iframe
                                                            key={`${youtubeId}_${room?.videoStartTimestamp || 0}`}
                                                            className="absolute inset-0 w-full h-full"
                                                            src={audienceIframeSrc}
                                                            allow="autoplay; fullscreen"
                                                            title="Audience Video"
                                                            frameBorder="0"
                                                        ></iframe>
                                                    )}
                                                    {!isNativeVideo && !youtubeId && (
                                                        <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                                                            Video unavailable
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : inlineLyrics && currentSinger?.lyrics ? (
                                            <div className="bg-black/70 border-y border-white/10 overflow-hidden">
                                                <div className="flex items-center justify-between px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-zinc-400 bg-black/60">
                                                    <span>Lyrics</span>
                                                    <button
                                                        onClick={() => {
                                                            setShowAudienceVideo(false);
                                                            setShowAudienceVideoFullscreen(false);
                                                            setViewLyrics(true);
                                                        }}
                                                        className="text-cyan-300 tracking-normal uppercase hover:text-cyan-200"
                                                    >
                                                        Full screen
                                                    </button>
                                                </div>
                                                <div className="max-h-40 overflow-y-auto px-4 py-4 text-lg text-white/90 whitespace-pre-line font-bebas text-center leading-snug bg-gradient-to-b from-black/10 via-black/30 to-black/60">
                                                    {currentSinger.lyrics}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                                {popTriviaQuestion && (
                                    <div className="mt-3 rounded-2xl border border-cyan-400/40 bg-black/55 backdrop-blur p-3">
                                        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.28em] text-cyan-200">
                                            <span>Pop-up Trivia</span>
                                            <span>{popTriviaState?.index + 1}/{popTriviaState?.total} | {popTriviaState?.timeLeftSec}s</span>
                                        </div>
                                        <div className="mt-2 text-sm font-bold text-white leading-snug">{popTriviaQuestion.q}</div>
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            {popTriviaQuestion.options?.map((option, idx) => {
                                                const isSelected = popTriviaMyVote === idx;
                                                const optionVotes = popTriviaVoteCounts[idx] || 0;
                                                return (
                                                    <button
                                                        key={`${popTriviaQuestion.id}_${idx}`}
                                                        onClick={() => submitPopTriviaVote(idx)}
                                                        disabled={popTriviaMyVote !== null || popTriviaSubmitting}
                                                        className={`rounded-xl border px-3 py-2 text-left transition-all ${
                                                            isSelected
                                                                ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100'
                                                                : 'border-white/15 bg-black/35 text-white hover:border-cyan-400/60'
                                                        } ${(popTriviaMyVote !== null || popTriviaSubmitting) ? 'opacity-90' : ''}`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-[10px] font-bold tracking-[0.22em] text-cyan-300">{String.fromCharCode(65 + idx)}</span>
                                                            <span className="text-[11px] font-mono text-zinc-400">{optionVotes}</span>
                                                        </div>
                                                        <div className="mt-1 text-xs font-semibold leading-snug">{option}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-zinc-300">
                                            {popTriviaMyVote !== null ? 'Answer locked' : 'Tap an answer to play'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div onClick={()=>setTab('request')} className="bg-zinc-800 rounded-2xl border border-dashed border-zinc-600 text-center text-zinc-400 cursor-pointer hover:bg-zinc-700 active:scale-95 transition-all overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-black/70 via-black/30 to-black/70">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="text-sm font-bebas text-[#00C4D9] tracking-[0.3em] leading-none">ROOM</div>
                                        <div className="text-[1.45rem] font-bebas text-[#00C4D9] tracking-[0.3em] font-bold leading-none">{roomCode}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {room?.hostName && (
                                            <button
                                                onClick={() => { setTab('social'); setSocialTab('host'); }}
                                                className="flex items-center gap-1 text-base font-bold text-white/85 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full leading-none hover:bg-white/10"
                                            >
                                                <span className="text-base text-white/70">{EMOJI.crown}</span>
                                                <span className="text-white/85">{room.hostName}</span>
                                            </button>
                                        )}
                                        <button onClick={(e)=>{ e.stopPropagation(); copyInviteLink(); }} className="flex items-center gap-1 text-base font-bold text-white/85 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full leading-none hover:bg-white/10">
                                            <i className="fa-solid fa-link stage-icon text-white/70"></i>
                                            Share
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setTab('social'); setSocialTab('lobby'); }} className="flex items-center gap-1 text-base font-bold text-white/85 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full min-h-[28px] leading-none">
                                            <i className="fa-solid fa-users stage-icon text-white/70"></i>
                                            {allUsers.length || 0}
                                        </button>
                                        <button onClick={() => { setTab('request'); setSongsTab('queue'); }} className="flex items-center gap-1 text-base font-bold text-white/85 bg-black/40 border border-white/10 px-3 py-1.5 rounded-full min-h-[28px] leading-none">
                                            <i className="fa-solid fa-list stage-icon text-white/70"></i>
                                            {queueSongsView.length}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 justify-end">
                                        {room?.activeMode === 'bingo' && !showBingoOverlay && room?.bingoAudienceReopenEnabled !== false && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowBingoOverlay(true); }}
                                                className="flex items-center gap-1 bg-purple-500/20 text-purple-200 border border-purple-400/40 px-3 py-1.5 rounded-full text-base font-bold min-h-[28px] leading-none hover:bg-purple-500/30"
                                                title="View Bingo board"
                                            >
                                            <i className="fa-solid fa-table-cells stage-icon"></i>
                                            Bingo Live
                                        </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-t border-white/10">
                                <div className="text-2xl mb-1">{String.fromCodePoint(0x1F3A4)} Stage is Empty</div>
                                <div className="text-sm font-bold text-pink-500">TAP TO REQUEST A SONG</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar relative z-0">

                {tab === 'home' && (
                    <div className="space-y-5">
                         <div className="grid grid-cols-2 gap-4">
                            <button onClick={()=>react('fire', REACTION_COSTS.fire)} className={`relative overflow-hidden bg-gradient-to-b from-orange-500/20 via-orange-500/10 to-black/50 border-2 border-orange-500/80 rounded-2xl p-3 flex flex-col items-center active:bg-orange-500 active:scale-95 transition-all shadow-[0_10px_24px_rgba(0,0,0,0.45)] ${cooldownFlash ? 'ring-2 ring-red-400 animate-pulse' : ''}`}>
                                <span className="text-5xl mb-2">{getEmojiChar('fire')}</span>
                                <span className="font-bold text-orange-200 text-base">HYPE</span>
                                <div className="mt-1 px-2 py-0.5 rounded-full text-[12px] font-bold bg-orange-500/25 text-orange-100">{REACTION_COSTS.fire} PTS</div>
                            </button>
                            <button onClick={()=>react('heart', REACTION_COSTS.heart)} className={`relative overflow-hidden bg-gradient-to-b from-pink-500/20 via-pink-500/10 to-black/50 border-2 border-pink-500/80 rounded-2xl p-3 flex flex-col items-center active:bg-pink-500 active:scale-95 transition-all shadow-[0_10px_24px_rgba(0,0,0,0.45)] ${cooldownFlash ? 'ring-2 ring-red-400 animate-pulse' : ''}`}>
                                <span className="text-5xl mb-2">{getEmojiChar('heart')}</span>
                                <span className="font-bold text-pink-200 text-base">LOVE</span>
                                <div className="mt-1 px-2 py-0.5 rounded-full text-[12px] font-bold bg-pink-500/25 text-pink-100">{REACTION_COSTS.heart} PTS</div>
                            </button>
                            <button onClick={()=>react('clap', REACTION_COSTS.clap)} className={`relative overflow-hidden bg-gradient-to-b from-cyan-500/20 via-cyan-500/10 to-black/50 border-2 border-cyan-400/80 rounded-2xl p-3 flex flex-col items-center active:bg-[#00C4D9] active:scale-95 transition-all shadow-[0_10px_24px_rgba(0,0,0,0.45)] ${cooldownFlash ? 'ring-2 ring-red-400 animate-pulse' : ''}`}>
                                <span className="text-5xl mb-2">{getEmojiChar('clap')}</span>
                                <span className="font-bold text-cyan-200 text-base">CLAP</span>
                                <div className="mt-1 px-2 py-0.5 rounded-full text-[12px] font-bold bg-[#00C4D9]/25 text-cyan-100">{REACTION_COSTS.clap} PTS</div>
                            </button>
                            <button onClick={()=>react('drink', REACTION_COSTS.drink)} className={`relative overflow-hidden bg-gradient-to-b from-blue-500/20 via-blue-500/10 to-black/50 border-2 border-blue-400/80 rounded-2xl p-3 flex flex-col items-center active:bg-blue-500 active:scale-95 transition-all shadow-[0_10px_24px_rgba(0,0,0,0.45)] ${cooldownFlash ? 'ring-2 ring-red-400 animate-pulse' : ''}`}>
                                <span className="text-5xl mb-2">{getEmojiChar('drink')}</span>
                                <span className="font-bold text-blue-200 text-base">CHEERS</span>
                                <div className="mt-1 px-2 py-0.5 rounded-full text-[12px] font-bold bg-blue-500/25 text-blue-100">{REACTION_COSTS.drink} PTS</div>
                            </button>
                         </div>
                         <div className="grid grid-cols-2 gap-4">{['rocket','diamond','money','crown'].map(t => {
                             const accent = {
                                 rocket: 'border-pink-400/80 text-pink-200 bg-pink-500/10 shadow-[0_0_24px_rgba(236,72,153,0.45)]',
                                 diamond: 'border-cyan-300/80 text-cyan-200 bg-cyan-500/10 shadow-[0_0_24px_rgba(34,211,238,0.45)]',
                                 money: 'border-emerald-300/80 text-emerald-200 bg-emerald-500/10 shadow-[0_0_24px_rgba(52,211,153,0.45)]',
                                 crown: 'border-[#00C4D9]/60 text-cyan-100 bg-[#00C4D9]/10 shadow-[0_0_26px_rgba(0,196,217,0.4)]'
                             }[t];
                             const cost = REACTION_COSTS[t];
                             return (
                                 <button key={t} onClick={()=>user.isVip ? react(t, cost) : openVipUpgrade()} className={`relative overflow-hidden p-3 rounded-2xl flex flex-col items-center border transition-all active:scale-95 ${user.isVip ? `bg-gradient-to-b from-white/5 via-black/40 to-black/70 ${accent}` : 'bg-zinc-900 border-zinc-700 opacity-60'}`}>
                                     <span className={`text-5xl mb-2 animate-${t}`}>{getEmojiChar(t)}</span>
                                     <span className="font-bold text-base uppercase">{{rocket:'BOOST',diamond:'GEM',crown:'ROYAL',money:'RICH'}[t]}</span>
                                <div className={`mt-1 px-2 py-0.5 rounded-full text-[12px] font-bold ${accent} border-none`}>
                                    {cost} PTS
                                </div>
                                {!user.isVip && (
                                    <div className="absolute top-2 right-2 text-[11px] text-cyan-200 bg-black/60 border border-cyan-500/50 px-2 py-1 rounded-full flex items-center gap-1 leading-none">
                                        <i className="fa-solid fa-lock text-[11px]"></i>
                                        <span className="leading-none">VIP</span>
                                    </div>
                                )}
                            </button>
                             );
                         })}</div>
                         {!user.isVip && <button onClick={()=>openVipUpgrade()} className="w-full bg-gradient-to-r from-[#00C4D9] via-[#26D7E8] to-[#5BE8F2] text-black py-4 rounded-xl font-bold shadow-[0_0_25px_rgba(0,196,217,0.35)] mt-1 animate-pulse">UNLOCK VIP ACCOUNT +5000 PTS {EMOJI.phone}</button>}
                         {room?.multiplier >= 4 && <button onClick={()=>submitSong("Secret Track", "The Host", "")} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-xl font-bold animate-pulse shadow-lg border-2 border-white">SECRET SONG UNLOCKED! {EMOJI.gift}</button>}
                         <div className="flex gap-2 w-full">
                            <button onClick={() => setShowPoints(true)} className="flex-1 bg-zinc-800 border border-zinc-600 py-3 rounded-xl text-zinc-300 text-[11px]">{EMOJI.info} Points</button>
                            <button onClick={() => setShowHowToPlay(true)} className="flex-1 bg-zinc-800 border border-zinc-600 py-3 rounded-xl text-zinc-300 text-[11px]">How to Play</button>
                            <button onClick={openEditProfile} className="flex-1 bg-zinc-800 border border-zinc-600 py-3 rounded-xl text-zinc-300 text-[11px]">Change Name/Emoji</button>
                         </div>
                    </div>
                )}

                {tab === 'social' && (
                    <div className="h-full flex flex-col gap-4">
                        <div className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-2 bg-zinc-900/90 backdrop-blur">
                            <div className="bg-zinc-800 p-2 rounded-xl">
                                <div
                                    className="grid gap-2"
                                    style={{ gridTemplateColumns: `repeat(${socialPrimaryTabs.length}, minmax(0, 1fr))` }}
                                >
                                    {socialPrimaryTabs.map((tabItem) => {
                                        const isActive = socialTab === tabItem.key;
                                        return (
                                            <button
                                                key={tabItem.key}
                                                onClick={() => handleSocialTabChange(tabItem.key)}
                                                className={`py-2 rounded-lg text-base font-bold transition-all ${
                                                    isActive ? 'bg-pink-600 text-white shadow' : 'text-zinc-500'
                                                }`}
                                            >
                                                {tabItem.label.toUpperCase()}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        {showChatPanel && (
                            <div className="flex-1 flex flex-col gap-3">
                                <div className="bg-zinc-900/70 border border-zinc-700 rounded-2xl p-4 flex-1 overflow-hidden">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm uppercase tracking-widest text-pink-200">{chatTitle}</div>
                                        <div className="text-xs text-zinc-300">{chatStatusLabel}</div>
                                    </div>
                                    {chatTab === 'lounge' && chatLocked ? (
                                        <div className="mb-3 bg-pink-500/10 border border-pink-400/40 rounded-xl p-4 text-left">
                                            <div className="text-xs uppercase tracking-widest text-pink-200 mb-1">VIP Lounge</div>
                                            <div className="text-base text-zinc-100">VIP-only chat is live. Join the exclusive club to see the lounge.</div>
                                            <button onClick={() => openVipUpgrade()} className="mt-2 w-full bg-gradient-to-r from-[#00C4D9] to-[#26D7E8] text-black py-2 rounded-lg font-bold text-sm">Become a VIP</button>
                                        </div>
                                    ) : null}
                                    {!chatLocked && (
                                        <div className={`space-y-2 ${groupedActiveMessages.length > 0 ? 'max-h-[45vh] overflow-y-auto custom-scrollbar pr-2' : 'py-6'}`}>
                                            {groupedActiveMessages.length === 0 ? (
                                            <div className="text-center">
                                                <div className="text-base text-zinc-100 font-semibold">No messages yet</div>
                                                <div className="text-sm text-zinc-300 mt-1">Kick things off with a quick hello.</div>
                                                <div className="mt-3 flex flex-wrap justify-center gap-2">
                                                    {quickActionMessages.map((msg) => (
                                                        <button
                                                            key={msg}
                                                            onClick={() => sendChatMessage(msg)}
                                                            className="px-3 py-1.5 rounded-full text-xs font-bold bg-zinc-800 border border-pink-400/30 text-pink-100 hover:border-pink-400/60 transition disabled:opacity-50"
                                                            disabled={chatInputDisabled}
                                                        >
                                                            {msg}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            ) : (
                                                groupedActiveMessages.map((group) => (
                                                    <div key={group.id} className="bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 flex gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-lg">
                                                            {group.avatar || DEFAULT_EMOJI}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="text-xs text-pink-100">{group.user || 'Guest'}</div>
                                                                {group.isVip && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-400 text-black font-black tracking-widest">VIP</span>
                                                                )}
                                                                {group.isHost && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500 text-black font-black tracking-widest">HOST</span>
                                                                )}
                                                            </div>
                                                            <div className="mt-1 space-y-1">
                                                                {group.messages.map((message, idx) => (
                                                                    <div key={message.id || `${group.id}-${idx}`} className="text-zinc-100 text-base break-words leading-snug">
                                                                        {message.text}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={chatMsg}
                                        onChange={e=>setChatMsg(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendChatMessage();
                                            }
                                        }}
                                        className="flex-1 bg-zinc-800 border border-zinc-600 rounded-xl p-3 text-sm text-white placeholder:text-zinc-300"
                                        placeholder={socialTab === 'host' ? 'Send a private note to the host...' : 'Say something to the VIP lounge...'}
                                        disabled={chatInputDisabled}
                                    />
                                    <button
                                        onClick={() => sendChatMessage()}
                                        className="bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white px-4 rounded-xl font-bold shadow disabled:opacity-50"
                                        disabled={chatInputDisabled}
                                    >
                                        Send
                                    </button>
                                </div>
                            </div>
                        )}
                        {socialTab === 'leaderboard' && (
                            <div className="bg-zinc-800/60 rounded-2xl border border-zinc-700 p-4">
                                <div className="text-[11px] uppercase tracking-widest text-zinc-300 mb-3">Leaderboard</div>
                                <div className="space-y-2">
                                    {sortedUsers.map(u => {
                                        const fame = getFameSnapshot(u);
                                        const isVip = isVipEntity(u);
                                        return (
                                            <button
                                                key={u.uid || u.name}
                                                onClick={() => openPublicProfile(u)}
                                                className="w-full flex items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-700 rounded-xl p-3 text-left hover:border-cyan-400/40 transition"
                                            >
                                                <UserMetaCard
                                                    mode="compact"
                                                    avatar={u.avatar || DEFAULT_EMOJI}
                                                    name={u.name || 'Guest'}
                                                    isVip={isVip}
                                                    fameLevel={fame.level}
                                                    fameLevelName={fame.levelName}
                                                    fameProgressToNext={fame.progressToNext}
                                                    fameTotal={fame.total}
                                                    showFame={room?.showFameLevel !== false}
                                                    showProgress={room?.showFameLevel !== false}
                                                />
                                                <div className="text-xs text-zinc-300 whitespace-nowrap">{activeLeaderboardMode.getValue(u)} {activeLeaderboardMode.unit}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="mt-5 border-t border-zinc-700 pt-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm uppercase tracking-widest text-amber-200">Hall of Fame</div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setHallOfFameMode('all_time')}
                                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${hallOfFameMode === 'all_time' ? 'bg-amber-400 text-black' : 'bg-zinc-900/60 text-zinc-300 border border-zinc-700'}`}
                                            >
                                                All Time
                                            </button>
                                            <button
                                                onClick={() => setHallOfFameMode('week')}
                                                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${hallOfFameMode === 'week' ? 'bg-amber-400 text-black' : 'bg-zinc-900/60 text-zinc-300 border border-zinc-700'}`}
                                            >
                                                This Week
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        value={hallOfFameFilter}
                                        onChange={(e) => setHallOfFameFilter(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm text-white mb-3"
                                        placeholder="Filter by song or artist..."
                                    />
                                    <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                                        {filteredHallOfFame.map((entry) => (
                                                <div key={entry.id} className="flex items-center gap-3 bg-zinc-900/60 border border-zinc-700 rounded-xl p-3">
                                                    {entry.albumArtUrl ? (
                                                        <img src={entry.albumArtUrl} alt={entry.songTitle} className="w-12 h-12 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-xl">🏆</div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-base font-bold text-white truncate">{entry.songTitle || 'Unknown Song'}</div>
                                                        <div className="text-sm text-zinc-400 truncate">{entry.artist || 'Unknown Artist'}</div>
                                                        <div className="text-xs text-amber-200 mt-1">Best: {entry.singerName || 'Guest'}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-amber-300">{entry.bestScore || 0}</div>
                                                        <div className="text-xs text-zinc-500">PTS</div>
                                                    </div>
                                                </div>
                                            ))}
                                        {filteredHallOfFame.length === 0 && (
                                            <div className="text-center text-zinc-500 text-sm">
                                                {hallOfFameEntries.length === 0 ? 'No Hall of Fame entries yet.' : 'No songs match that filter.'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        {socialTab === 'profile' && (
                            <div className="bg-zinc-800/60 rounded-2xl border border-zinc-700 p-4 space-y-4">
                                <div className="flex items-center gap-2">
                                    {['overview', 'stats', 'vip'].map(section => (
                                        <button
                                            key={section}
                                            onClick={() => setProfileSubTab(section)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border transition-colors ${profileSubTab === section ? 'bg-gradient-to-r from-[#00C4D9] to-[#EC4899] text-black border-transparent' : 'bg-black/30 text-zinc-300 border-white/10'}`}
                                        >
                                            {section}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">{user?.avatar || DEFAULT_EMOJI}</span>
                                        <div className="min-w-0">
                                            <div className="text-base font-bold text-white truncate">{user?.name || 'Guest'}</div>
                                            <div className="text-sm text-zinc-300">
                                                Level {myFame.level} • {myFame.levelName}
                                            </div>
                                            <button onClick={() => setShowFameLevels(true)} className="mt-2 inline-flex items-center gap-2 text-[11px] font-bold text-cyan-200 bg-cyan-500/10 border border-cyan-400/30 px-2 py-1 rounded-full">
                                                {EMOJI.star} View Fame Levels
                                            </button>
                                        </div>
                                    </div>
                                    {isVipAccount && (
                                        <div className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border bg-[#00C4D9]/10 text-cyan-300 border-[#00C4D9]/40">
                                            VIP
                                        </div>
                                    )}
                                </div>
                                <div className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200">
                                    <div className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Next Unlock</div>
                                    {myNextUnlock ? (
                                        <>
                                            <div>Lv {myNextUnlock.level}: {myNextUnlock.unlockLabel}</div>
                                            <div className="text-zinc-400 mt-1">
                                                {myNextUnlock.pointsNeeded.toLocaleString()} fame points to go
                                            </div>
                                        </>
                                    ) : (
                                        <div>Max fame tier reached. No further unlocks.</div>
                                    )}
                                </div>
                                {profileSubTab === 'overview' && (
                                    <div className="grid grid-cols-2 gap-2 text-sm text-zinc-200">
                                        <div className="bg-black/30 px-3 py-2 rounded-xl">Performances: <span className="font-bold text-white">{performanceStats.total}</span></div>
                                        <div className="bg-black/30 px-3 py-2 rounded-xl">Total Points: <span className="font-bold text-white">{performanceStats.totalPoints}</span></div>
                                        <div className="bg-black/30 px-3 py-2 rounded-xl">Loudest dB: <span className="font-bold text-white">{performanceStats.loudest}</span></div>
                                        <div className="bg-black/30 px-3 py-2 rounded-xl">Emojis: <span className="font-bold text-white">{user?.totalEmojis || 0}</span></div>
                                    </div>
                                )}
                                {profileSubTab === 'vip' && (
                                    <div className="text-sm text-zinc-200">
                                        {isVipAccount ? (
                                            <div className="space-y-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-black/30 px-3 py-2 rounded-xl">Location: <span className="font-bold text-white">{profile?.vipProfile?.location || '-'}</span></div>
                                                    <div className="bg-black/30 px-3 py-2 rounded-xl">Birthday: <span className="font-bold text-white">{profile?.vipProfile?.birthMonth && profile?.vipProfile?.birthDay ? `${profile.vipProfile.birthMonth} ${profile.vipProfile.birthDay}` : '-'}</span></div>
                                                </div>
                                                {!vipProfileComplete && (
                                                    <div className="bg-amber-500/10 border border-amber-400/30 text-amber-200 px-3 py-2 rounded-xl text-xs">
                                                        VIP profile incomplete. Add required fields to keep your VIP profile active.
                                                    </div>
                                                )}
                                                <button onClick={openEditProfile} className="w-full bg-[#00C4D9]/20 border border-[#00C4D9]/40 text-[#00C4D9] py-2 rounded-xl text-sm font-bold">
                                                    Edit VIP Profile
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="bg-black/30 px-3 py-2 rounded-xl">Unlock VIP to show your profile details.</div>
                                        )}
                                    </div>
                                )}
                                {profileSubTab === 'stats' && (
                                    <div className="bg-black/30 px-3 py-2 rounded-xl text-sm">
                                        <div className="text-xs uppercase tracking-widest text-zinc-300 mb-2">Top 3 from Tight 15</div>
                                        {getTight15List().length === 0 ? (
                                            <div className="text-sm text-zinc-300">Set your Tight 15 to show your signature songs.</div>
                                        ) : (
                                            <div className="space-y-2">
                                                {getTight15List().slice(0, 3).map((song, idx) => (
                                                    <div key={`${song.songTitle}-${idx}`} className="flex items-center gap-2">
                                                        {song.albumArtUrl ? (
                                                            <img src={song.albumArtUrl} className="w-10 h-10 rounded-lg object-cover" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center">{EMOJI.musicNotes}</div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-white truncate">{song.songTitle}</div>
                                                            <div className="text-sm text-zinc-300 truncate">{song.artist}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="flex flex-col gap-2">
                                    <button onClick={openEditProfile} className="w-full bg-zinc-800 border border-zinc-600 py-2 rounded-xl text-zinc-200 text-sm">Change Name/Emoji</button>
                                    <button onClick={() => openPublicProfile({ ...user, uid, isVip: isVipAccount })} className="w-full bg-zinc-800 border border-zinc-600 py-2 rounded-xl text-zinc-200 text-sm">View Public Profile</button>
                                    {isVipAccount && (
                                        <button onClick={() => setShowAccount(true)} className="w-full bg-[#00C4D9]/20 border border-[#00C4D9]/40 text-[#00C4D9] py-2 rounded-xl text-sm font-bold">VIP Account & History</button>
                                    )}
                                    {!isVipAccount && (
                                        <button onClick={() => openVipUpgrade()} className="w-full bg-[#00C4D9]/20 border border-[#00C4D9]/40 text-cyan-200 py-2 rounded-xl text-sm font-bold">Unlock VIP</button>
                                    )}
                                    <button onClick={() => { setTab('request'); setSongsTab('tight15'); }} className="w-full bg-zinc-800 border border-zinc-600 py-2 rounded-xl text-zinc-200 text-sm">Edit Tight 15</button>
                                </div>
                            </div>
                        )}
                        {socialTab === 'lobby' && (
                            <div className="bg-zinc-800/60 rounded-2xl border border-zinc-700 p-4">
                                <div className="text-[11px] uppercase tracking-widest text-zinc-300 mb-3">Lobby</div>
                                <div className="space-y-2">
                                    {lobbyUsers.map(u => {
                                        const isHost = !!u.isHost || (!!room?.hostName && u.name === room.hostName);
                                        const isVip = isVipEntity(u);
                                        const hasRoomBoost = !!u.roomBoostBadge || !!u.roomBoosted || (u.roomBoosts || 0) > 0;
                                        const fame = getFameSnapshot(u);
                                        return (
                                            <div key={u.uid || u.name} className={`flex items-center gap-2 rounded-xl p-3 border ${isHost ? 'bg-cyan-500/10 border-cyan-400/40' : 'bg-zinc-900/60 border-zinc-700'}`}>
                                                <button onClick={() => openPublicProfile(u)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                                                    <div className="min-w-0 flex-1">
                                                        <UserMetaCard
                                                            mode="compact"
                                                            avatar={u.avatar || DEFAULT_EMOJI}
                                                            name={u.name || 'Guest'}
                                                            isVip={isVip}
                                                            fameLevel={fame.level}
                                                            fameLevelName={fame.levelName}
                                                            fameProgressToNext={fame.progressToNext}
                                                            fameTotal={fame.total}
                                                            showFame={room?.showFameLevel !== false}
                                                            showProgress={room?.showFameLevel !== false}
                                                        />
                                                        {(isHost || hasRoomBoost) && (
                                                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border bg-black/40 text-zinc-200 border-white/10 ml-8">
                                                                {isHost ? 'HOST' : `${EMOJI.money} BOOSTER`}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                                {isVipAccount && !isHost && (
                                                    <button
                                                        onClick={() => sendLobbySpark(u.name)}
                                                        className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border bg-zinc-900 text-cyan-200 border-cyan-400/40"
                                                    >
                                                        {EMOJI.sparkle} Spark
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {isVipAccount && socialTab === 'history' && (
                            <div className="bg-zinc-800/60 rounded-2xl border border-zinc-700 p-4">
                                <div className="text-[11px] uppercase tracking-widest text-zinc-300 mb-3">History / Stats</div>
                                <div className="text-sm text-zinc-300">Your stats and past performances will show here.</div>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'vip' && (
                    <div className="bg-zinc-800 p-6 rounded-2xl border border-cyan-500 text-center">
                        {isAnon ? (
                            <>
                                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#00C4D9]/20 text-cyan-300 text-[12px] font-black tracking-[0.3em] mb-3">
                                    VIP ACCESS
                                </div>
                                <h3 className="text-2xl font-bold text-cyan-300 mb-2">Upgrade to VIP</h3>
                                <p className="mb-4 text-zinc-300">Go full spotlight mode. VIPs get the loudest reactions, the flashiest visuals, and exclusive perks.</p>
                                <div className="bg-black/50 border border-cyan-500/30 rounded-xl p-4 mb-4 text-left">
                                    <div className="text-xs uppercase tracking-[0.35em] text-cyan-300 mb-3">VIP Benefits</div>
                                    <ul className="space-y-2 text-sm text-zinc-200">
                                        <li className="flex items-start gap-2"><span className="text-cyan-300">*</span> Exclusive VIP emojis + mega reaction animations.</li>
                                        <li className="flex items-start gap-2"><span className="text-cyan-300">*</span> VIP badge on TV, queue, and chat.</li>
                                        <li className="flex items-start gap-2"><span className="text-cyan-300">*</span> Instant +5000 bonus points on unlock.</li>
                                        <li className="flex items-start gap-2"><span className="text-cyan-300">*</span> VIP-only chat nights when enabled by the host.</li>
                                        <li className="flex items-start gap-2"><span className="text-cyan-300">*</span> Priority spotlight moments during the party.</li>
                                    </ul>
                                </div>
                                <div className="text-left bg-zinc-900/70 border border-zinc-700 rounded-xl p-4 mb-4">
                                    <label className="text-xs uppercase tracking-widest text-zinc-400">Phone Number</label>
                                    <input value={phoneNumber} onChange={e=>setPhoneNumber(e.target.value)} placeholder="+1 555 555 5555" className="w-full p-3 mt-2 rounded bg-zinc-800 border border-zinc-700 text-white" />
                                    {!smsSent ? (
                                        <button onClick={() => startPhoneAuth('recap-container-vip')} className="w-full bg-cyan-500 text-black py-3 rounded-lg font-bold mt-3">{phoneLoading ? 'Sending...' : 'Send SMS'}</button>
                                    ) : (
                                        <>
                                            <label className="text-xs uppercase tracking-widest text-zinc-400 mt-4 block">Verification Code</label>
                                            <input value={smsCode} onChange={e=>setSmsCode(e.target.value)} placeholder="6-digit code" className="w-full p-3 mt-2 rounded bg-zinc-800 border border-zinc-700 text-white" />
                                            <div className="flex gap-2 mt-3">
                                                <button onClick={()=>{ setSmsSent(false); setSmsCode(''); }} className="flex-1 bg-zinc-700 py-3 rounded">Back</button>
                                                <button onClick={confirmPhoneCode} className="flex-1 bg-[#00C4D9] text-black py-3 rounded font-bold">{phoneLoading ? 'Verifying...' : 'Verify Code'}</button>
                                            </div>
                                        </>
                                    )}
                                    <div id="recap-container-vip" className="mt-3"></div>
                                </div>
                                {smsBypassEnabled && (
                                    <button onClick={bypassSmsVip} className="w-full bg-zinc-700 text-white py-3 rounded-lg font-bold mb-3">Bypass SMS (QA)</button>
                                )}
                                <p className="text-xs text-zinc-400 mb-3">Fast SMS verification. No password needed.</p>
                                <button onClick={()=>setTab('home')} className="text-zinc-500 underline block">Maybe Later</button>
                            </>
                        ) : (
                            <>
                                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#00C4D9]/20 text-cyan-300 text-[12px] font-black tracking-[0.3em] mb-3">
                                    VIP ACTIVE
                                </div>
                                <h3 className="text-2xl font-bold text-cyan-300 mb-2">You are VIP</h3>
                                <p className="mb-4 text-zinc-300">Enjoy premium reactions, exclusive emojis, and a VIP badge everywhere.</p>
                                <div className="bg-black/50 border border-cyan-500/30 rounded-xl p-4 mb-5 text-left">
                                    <div className="text-xs uppercase tracking-[0.35em] text-cyan-300 mb-3">Your Perks</div>
                                    <ul className="space-y-2 text-sm text-zinc-200">
                                        <li className="flex items-start gap-2"><span className="text-cyan-300">*</span> VIP reactions and animated FX.</li>
                                        <li className="flex items-start gap-2"><span className="text-cyan-300">*</span> VIP badge on TV, queue, and chat.</li>
                                        <li className="flex items-start gap-2"><span className="text-cyan-300">*</span> Exclusive VIP emoji pack.</li>
                                    </ul>
                                </div>
                                <button onClick={()=>setTab('home')} className="w-full bg-[#00C4D9] text-black py-4 rounded-xl font-bold text-xl">Back to Party</button>
                            </>
                        )}
                    </div>
                )}

                {tab === 'request' && (
                    <div className="flex flex-col h-full">
                        <div className="sticky top-0 z-20 -mx-4 px-4 pb-3 pt-1 bg-zinc-900/95 backdrop-blur">
                            <div className="grid grid-cols-4 gap-2 bg-zinc-800 p-2 rounded-xl">
                                <button onClick={()=>setSongsTab('requests')} className={`py-2 rounded-lg text-base font-bold transition-all ${songsTab==='requests' ? 'bg-cyan-600 text-white shadow' : 'text-zinc-500'}`}>REQUESTS</button>
                                <button onClick={()=>setSongsTab('browse')} className={`py-2 rounded-lg text-base font-bold transition-all ${songsTab==='browse' ? 'bg-[#00C4D9] text-white shadow' : 'text-zinc-500'}`}>BROWSE</button>
                                <button onClick={()=>setSongsTab('queue')} className={`py-2 rounded-lg text-base font-bold transition-all ${songsTab==='queue' ? 'bg-[#00C4D9] text-white shadow' : 'text-zinc-500'}`}>QUEUE</button>
                                <button onClick={()=>setSongsTab('tight15')} className={`py-2 rounded-lg text-base font-bold transition-all ${songsTab==='tight15' ? 'bg-[#00C4D9] text-white shadow' : 'text-zinc-500'}`}>TIGHT 15</button>
                            </div>
                        </div>
                        {songsTab === 'requests' && (
                            <div className="flex flex-col h-full">
                                <div className="space-y-4">
                                    <div className="text-left">
                                        <div className="text-sm uppercase tracking-[0.35em] text-zinc-400">Requests</div>
                                        <h2 className="text-2xl font-bebas text-cyan-400">Request Song</h2>
                                    </div>
                                    <div className="relative z-50">
                                        <input id="song-search" value={searchQ} onChange={e=>setSearchQ(e.target.value)} className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-2.5 text-base text-white outline-none" placeholder="Search song..." />
                                        {results.length > 0 && <div className="absolute top-full left-0 w-full bg-zinc-900 border border-zinc-700 z-50 shadow-xl max-h-60 touch-scroll-y custom-scrollbar">{results.map(r=><div key={r.trackId} onClick={()=>{submitSong(r.trackName, r.artistName, r.artworkUrl100.replace('100x100','600x600'), { itunesId: r.trackId }); setResults([]); setSearchQ('');}} className="p-3 border-b border-zinc-800 hover:bg-zinc-800 flex gap-3"><img src={r.artworkUrl100} className="w-10 h-10 rounded"/><div><div className="font-bold text-base">{r.trackName}</div><div className="text-base text-zinc-400">{r.artistName}</div></div></div>)}</div>}
                                    </div>
                                    {room?.allowSingerTrackSelect && (
                                        <div className="space-y-2">
                                            <div className="text-sm uppercase tracking-[0.35em] text-zinc-500">Optional Backing Track</div>
                                            <input
                                                value={form.backingUrl}
                                                onChange={e => setForm(prev => ({ ...prev, backingUrl: e.target.value }))}
                                                className="w-full bg-zinc-800 p-3 rounded-xl border border-zinc-600 text-base"
                                                placeholder="YouTube URL for the backing track"
                                            />
                                            <div className="text-sm text-zinc-500">YouTube links only. Host still controls playback.</div>
                                        </div>
                                    )}
                                    <div className="text-base text-zinc-400 text-center my-2">- OR MANUAL -</div>
                                    <input value={form.song} onChange={e=>setForm({...form, song:e.target.value})} className="w-full bg-zinc-800 p-4 rounded-xl border border-zinc-600" placeholder="Song Title"/><input value={form.artist} onChange={e=>setForm({...form, artist:e.target.value})} className="w-full bg-zinc-800 p-4 rounded-xl border border-zinc-600" placeholder="Artist"/><button onClick={()=>submitSong()} className="w-full bg-[#00C4D9] text-black py-4 rounded-xl font-bold text-xl mt-4">SEND REQUEST</button>
                                </div>
                                <div className="mt-6 border-t border-zinc-800 pt-4 flex-1">
                                    <h3 className="text-sm uppercase tracking-[0.35em] text-zinc-400 mb-2">My Requests</h3>
                                    {songs.filter(s=>s.singerName===user.name).length===0 ? <div className="text-zinc-600 text-base italic">No active requests</div> : songs.filter(s=>s.singerName===user.name).map(s=><div key={s.id} className="flex justify-between items-center bg-zinc-800 p-2 rounded mb-1"><span className="text-base">{s.songTitle}</span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-base px-2 py-0.5 rounded ${s.status==='performed'?'bg-zinc-600':s.status==='performing'?'bg-[#00C4D9] animate-pulse':s.status==='requested'?'bg-blue-600':'bg-orange-600'}`}>{s.status.toUpperCase()}</span>
                                        {(s.status === 'requested' || s.status === 'pending') && <button onClick={()=>deleteMyRequest(s.id)} className="text-[#EC4899] hover:text-[#F472B6] px-2"><i className="fa-solid fa-trash"></i></button>}
                                    </div>
                                    </div>)}
                                </div>
                            </div>
                        )}
                        {songsTab === 'browse' && (
                            <div className="flex flex-col h-full gap-6 pt-2">
                                <div className="text-left">
                                    <div className="text-sm uppercase tracking-[0.35em] text-zinc-400">Browse</div>
                                    <div className="text-2xl font-bebas text-cyan-400">Popular Categories</div>
                                    <div className="text-base text-zinc-300">Tap a category to explore hits.</div>
                                </div>
                                <div className="relative z-50">
                                    <input
                                        value={searchQ}
                                        onChange={e => setSearchQ(e.target.value)}
                                        className="w-full bg-zinc-900/60 border border-zinc-700 rounded-2xl p-4 text-base text-white outline-none"
                                        placeholder="Search songs to request..."
                                    />
                                    {results.length > 0 && (
                                        <div className="absolute top-full left-0 w-full bg-zinc-900 border border-zinc-700 z-50 shadow-xl max-h-60 touch-scroll-y custom-scrollbar">
                                            {results.map(r => (
                                                <div
                                                    key={r.trackId}
                                                    onClick={() => {
                                                        submitSong(r.trackName, r.artistName, r.artworkUrl100.replace('100x100','600x600'), { itunesId: r.trackId });
                                                        setResults([]);
                                                        setSearchQ('');
                                                    }}
                                                    className="p-3 border-b border-zinc-800 hover:bg-zinc-800 flex gap-3 cursor-pointer"
                                                >
                                                    <img src={r.artworkUrl100} className="w-10 h-10 rounded" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-base truncate">{r.trackName}</div>
                                                        <div className="text-base text-zinc-400 truncate">{r.artistName}</div>
                                                    </div>
                                                    <div className="text-base font-bold text-cyan-300">+ Request</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {room?.allowSingerTrackSelect && (
                                    <div className="space-y-2">
                                        <div className="text-sm uppercase tracking-[0.35em] text-zinc-500">Optional Backing Track</div>
                                        <input
                                            value={form.backingUrl}
                                            onChange={e => setForm(prev => ({ ...prev, backingUrl: e.target.value }))}
                                            className="w-full bg-zinc-900/60 border border-zinc-700 rounded-2xl p-3 text-base text-white outline-none"
                                            placeholder="YouTube URL for the backing track"
                                        />
                                        <div className="text-sm text-zinc-500">Applies to the next request you send.</div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    {browseCategories.map((c) => (
                                        <div
                                            key={c.title}
                                            onClick={() => { setBrowseFilter(''); setActiveBrowseList(c); }}
                                            className="relative overflow-hidden rounded-2xl border border-zinc-700 hover:border-[#00C4D9]/40 transition-colors cursor-pointer h-40"
                                        >
                                            {c.samples?.[0]?.art && (
                                                <img src={c.samples[0].art} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90"></div>
                                            <div className="relative z-10 p-4 flex flex-col h-full justify-end">
                                                <div className="text-base font-bold text-white">{c.title}</div>
                                                <div className="text-base text-zinc-300 mt-1">{c.subtitle}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-left">
                                    <div className="text-sm uppercase tracking-[0.35em] text-zinc-400">Featured</div>
                                    <div className="text-xl font-bebas text-cyan-400 mb-2">Topic Hits</div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {topicHits.map((hit) => (
                                            <div
                                                key={hit.title}
                                                onClick={() => { setBrowseFilter(''); setActiveBrowseList(hit); }}
                                                className="relative overflow-hidden rounded-xl border border-zinc-800 hover:border-[#00C4D9]/40 transition-colors cursor-pointer h-32"
                                            >
                                                {hit.samples?.[0]?.art && (
                                                    <img src={hit.samples[0].art} alt={hit.title} className="absolute inset-0 w-full h-full object-cover" />
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black/90"></div>
                                                <div className="relative z-10 p-3 flex flex-col h-full justify-end">
                                                <div className="text-base font-bold text-white">{hit.title}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                </div>
                                {ytIndex.length > 0 && (
                                    <div className="bg-zinc-900/70 border border-zinc-700 rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <div className="text-sm uppercase tracking-[0.35em] text-zinc-400">YouTube Index</div>
                                                <div className="text-xl font-bebas text-cyan-400">Host-curated tracks</div>
                                            </div>
                                            <button onClick={openYtIndexBrowse} className="text-base font-bold bg-[#00C4D9] text-black px-3 py-1 rounded-full">Open List</button>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {ytIndex.slice(0, 6).map((item) => (
                                                <div key={item.videoId || item.trackName} onClick={openYtIndexBrowse} className="relative rounded-xl overflow-hidden border border-zinc-800 cursor-pointer">
                                                    <img src={item.artworkUrl100} alt={item.trackName} className="w-full aspect-square object-cover" />
                                                    <div className="absolute inset-0 bg-black/45"></div>
                                                    <div className="absolute bottom-1 left-1 right-1 text-sm text-white font-bold leading-tight">
                                                        {item.trackName}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-base text-zinc-500 mt-3">Tap to open the full YouTube index.</div>
                                    </div>
                                )}
                                {activeBrowseList && (
                                    <div className="fixed inset-0 z-[85] bg-[#0b0b10] text-white flex flex-col min-h-0">
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                                            <button onClick={() => { setActiveBrowseList(null); setBrowseFilter(''); }} className="text-zinc-400 text-base">&larr; Back</button>
                                            <div className="text-xl font-bold">{activeBrowseList.title}</div>
                                            <div className="text-base text-zinc-500">{activeBrowseList.subtitle || 'Browse list'}</div>
                                        </div>
                                        <div className="px-5 py-4">
                                            <div className="bg-zinc-900/60 border border-zinc-700 rounded-2xl p-3 flex items-center gap-3">
                                                <i className="fa-solid fa-magnifying-glass text-zinc-500"></i>
                                                <input
                                                    value={browseFilter}
                                                    onChange={e => setBrowseFilter(e.target.value)}
                                                    className="flex-1 bg-transparent text-base text-white outline-none"
                                                    placeholder="Filter by title or artist"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0 px-5 pb-6 custom-scrollbar touch-scroll-y">
                                            <div className="grid grid-cols-1 gap-3">
                                                {activeBrowseSongsFiltered.map((song, idx) => (
                                                        <div
                                                            key={`${song.title}-${song.artist}`}
                                                            className="flex items-center gap-3 bg-zinc-900/70 border border-zinc-800 rounded-xl p-3 hover:border-[#00C4D9]/40"
                                                        >
                                                            <div className="text-base text-zinc-500 font-mono w-6 text-center">{idx + 1}</div>
                                                            <div className="relative">
                                                                <img src={song.art} alt={song.title} className="w-10 h-10 rounded-lg object-cover" />
                                                            {top100ArtLoading[song.artKey] && (
                                                                <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center text-sm text-zinc-200">Loading</div>
                                                            )}
                                                        </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-bold text-white truncate text-base">{song.title}</div>
                                                                <div className="text-base text-zinc-400 truncate">{song.artist}</div>
                                                            </div>
                                                            <button
                                                                onClick={async () => {
                                                                    const art = await fetchTop100Art(song);
                                                                    submitSong(song.title, song.artist, art || song.art);
                                                                }}
                                                                className="text-base font-bold bg-[#00C4D9]/20 text-[#00C4D9] border border-[#00C4D9]/30 px-3 py-1 rounded-full"
                                                            >
                                                                + Request
                                                            </button>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    const art = await fetchTop100Art(song);
                                                                    addToTight15({ songTitle: song.title, artist: song.artist, albumArtUrl: art || song.art });
                                                                }}
                                                                className="text-base font-bold bg-amber-500/15 text-amber-300 border border-amber-600/30 px-3 py-1 rounded-full"
                                                            >
                                                                + Tight 15
                                                            </button>
                                                        </div>
                                                    ))}
                                                {activeBrowseSongsFiltered.length === 0 && (
                                                    <div className="text-center text-zinc-500 text-base">No matches</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="bg-zinc-900/70 border border-zinc-700 rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <div className="text-sm uppercase tracking-[0.35em] text-zinc-400">Top 100</div>
                                            <div className="text-xl font-bebas text-cyan-400">Karaoke Favorites</div>
                                        </div>
                                        <button onClick={openTop100Browse} className="text-base font-bold bg-[#00C4D9] text-black px-3 py-1 rounded-full">Open List</button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {top100Songs.slice(0, 6).map((song) => (
                                            <div key={`${song.title}-${song.artist}`} onClick={openTop100Browse} className="relative rounded-xl overflow-hidden border border-zinc-800 cursor-pointer">
                                                <img src={song.art} alt={song.title} className="w-full aspect-square object-cover" />
                                                <div className="absolute inset-0 bg-black/45"></div>
                                                <div className="absolute bottom-1 left-1 right-1 text-sm text-white font-bold leading-tight">
                                                    {song.title}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-base text-zinc-500 mt-3">Tap to open the full Top 100 list.</div>
                                </div>
                                {showTop100 && (
                                    <div className="fixed inset-0 z-[80] bg-[#0b0b10] text-white flex flex-col min-h-0">
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                                            <button onClick={() => { setShowTop100(false); setBrowseFilter(''); }} className="text-zinc-400 text-base">&larr; Back</button>
                                            <div className="text-xl font-bold">Top 100 Karaoke</div>
                                            <div className="text-base text-zinc-500">Full list</div>
                                        </div>
                                        <div className="px-5 py-4">
                                            <div className="bg-zinc-900/60 border border-zinc-700 rounded-2xl p-3 flex items-center gap-3">
                                                <i className="fa-solid fa-magnifying-glass text-zinc-500"></i>
                                                <input
                                                    value={browseFilter}
                                                    onChange={e => setBrowseFilter(e.target.value)}
                                                    className="flex-1 bg-transparent text-base text-white outline-none"
                                                    placeholder="Filter Top 100 by title or artist"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0 px-5 pb-6 custom-scrollbar touch-scroll-y">
                                            <div className="grid grid-cols-1 gap-3">
                                                {top100SongsFiltered.map((song, idx) => (
                                                    <div
                                                        key={`${song.title}-${song.artist}`}
                                                        className="flex items-center gap-3 bg-zinc-900/70 border border-zinc-800 rounded-xl p-3 hover:border-[#00C4D9]/40"
                                                    >
                                                        <div className="text-base text-zinc-500 font-mono w-6 text-center">{idx + 1}</div>
                                                        <div className="relative">
                                                            <img src={song.art} alt={song.title} className="w-10 h-10 rounded-lg object-cover" />
                                                            {top100ArtLoading[song.artKey] && (
                                                                <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center text-sm text-zinc-200">Loading</div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-bold text-white truncate text-base">{song.title}</div>
                                                            <div className="text-base text-zinc-400 truncate">{song.artist}</div>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                const art = await fetchTop100Art(song);
                                                                submitSong(song.title, song.artist, art || song.art);
                                                            }}
                                                            className="text-base font-bold bg-[#00C4D9]/20 text-[#00C4D9] border border-[#00C4D9]/30 px-3 py-1 rounded-full"
                                                        >
                                                            + Request
                                                        </button>
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const art = await fetchTop100Art(song);
                                                                addToTight15({ songTitle: song.title, artist: song.artist, albumArtUrl: art || song.art });
                                                            }}
                                                            className="text-base font-bold bg-amber-500/15 text-amber-300 border border-amber-600/30 px-3 py-1 rounded-full"
                                                        >
                                                            + Tight 15
                                                        </button>
                                                    </div>
                                                ))}
                                                {top100SongsFiltered.length === 0 && (
                                                    <div className="text-center text-zinc-500 text-base">No matches</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {showYtIndex && (
                                    <div className="fixed inset-0 z-[80] bg-[#0b0b10] text-white flex flex-col min-h-0">
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                                            <button onClick={() => { setShowYtIndex(false); setYtIndexFilter(''); }} className="text-zinc-400 text-base">&larr; Back</button>
                                            <div className="text-xl font-bold">YouTube Index</div>
                                            <div className="text-base text-zinc-500">Host curated</div>
                                        </div>
                                        <div className="px-5 py-4">
                                            <div className="bg-zinc-900/60 border border-zinc-700 rounded-2xl p-3 flex items-center gap-3">
                                                <i className="fa-solid fa-magnifying-glass text-zinc-500"></i>
                                                <input
                                                    value={ytIndexFilter}
                                                    onChange={e => setYtIndexFilter(e.target.value)}
                                                    className="flex-1 bg-transparent text-base text-white outline-none"
                                                    placeholder="Filter YouTube index"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-0 px-5 pb-6 custom-scrollbar touch-scroll-y">
                                            <div className="grid grid-cols-1 gap-3">
                                                {ytIndexFiltered.map((item, idx) => (
                                                        <div
                                                            key={`${item.videoId || item.trackName}-${idx}`}
                                                            className="flex items-center gap-3 bg-zinc-900/70 border border-zinc-800 rounded-xl p-3 hover:border-[#00C4D9]/40"
                                                        >
                                                                <div className="text-base text-zinc-500 font-mono w-6 text-center">{idx + 1}</div>
                                                                <img src={item.artworkUrl100} alt={item.trackName} className="w-10 h-10 rounded-lg object-cover" />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="font-bold text-white truncate text-base">{item.trackName}</div>
                                                                    <div className="text-base text-zinc-400 truncate">{item.artistName}</div>
                                                                </div>
                                                                <button
                                                                    onClick={() => submitSong(item.trackName, item.artistName, item.artworkUrl100, { mediaUrl: item.url, trackSource: 'youtube', allowTrack: true, trackLabel: 'Host index' })}
                                                                    className="text-base font-bold bg-[#00C4D9]/20 text-[#00C4D9] border border-[#00C4D9]/30 px-3 py-1 rounded-full"
                                                                >
                                                                    + Request
                                                                </button>
                                                            </div>
                                                        ))}
                                                {ytIndexFiltered.length === 0 && (
                                                    <div className="text-center text-zinc-500 text-base">No matches</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {songsTab === 'queue' && (
                            <div className="bg-zinc-800/60 rounded-2xl border border-zinc-800 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3 text-left mb-3">
                                    <div>
                                        <div className="text-sm uppercase tracking-[0.35em] text-zinc-400">Queue</div>
                                        <div className="text-xl font-bebas text-cyan-400">Up Next</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-sm text-zinc-200">
                                        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-full px-2 py-0.5">
                                            <i className="fa-solid fa-clock text-cyan-300 text-sm"></i>
                                            <span className="text-sm">{formatWaitTime(queueWaitTimeSec)} est wait</span>
                                        </div>
                                        {queueRuleIcons.map(rule => (
                                            <div key={rule.title} className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-full px-2 py-0.5">
                                                <i className={`fa-solid ${rule.icon} text-cyan-300 text-sm`}></i>
                                                <span className="text-sm">{rule.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {queueSongsView.length === 0 && (
                                        <div className="bg-zinc-900/60 border border-zinc-700 rounded-xl p-4 text-center">
                                            <div className="text-base text-white font-bold mb-2">Queue is empty</div>
                                            <div className="text-base text-zinc-300 mb-3">Add a song to get the party started.</div>
                                            <button onClick={() => { setTab('request'); setSongsTab('requests'); }} className="bg-[#00C4D9] text-black px-4 py-2 rounded-full text-base font-bold">
                                                Add a Song
                                            </button>
                                        </div>
                                    )}
                                    {queueSongsView.map((s, idx) => (
                                        <div key={s.id} className={`flex items-center gap-3 bg-zinc-900/60 rounded-xl p-3 border ${idx === 0 ? 'border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.25)]' : 'border-zinc-800'}`}>
                                            <div className="w-6 h-6 rounded-full bg-black/40 border border-white/10 text-sm font-bold text-white flex items-center justify-center">
                                                {idx + 1}
                                            </div>
                                            <span className="text-2xl">{s.emoji || DEFAULT_EMOJI}</span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-base text-white font-bold truncate">{s.songTitle}</div>
                                                <div className="text-base text-zinc-300 truncate">{s.singerName}</div>
                                            </div>
                                            {idx === 0 && (
                                                <div className="text-sm uppercase tracking-widest text-cyan-200 bg-cyan-500/15 border border-cyan-400/30 px-2 py-0.5 rounded-full">
                                                    Up next
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {songsTab === 'tight15' && (
                            <div ref={tight15SectionRef} className="bg-zinc-800 p-4 rounded-2xl border border-zinc-700">
                                <div className="text-left mb-2">
                                    <div className="text-sm uppercase tracking-[0.35em] text-zinc-400">Tight 15</div>
                                    <h3 className="text-2xl font-bebas text-cyan-400">Tight 15</h3>
                                    <p className="text-base text-zinc-400">Your personal 15-song setlist. Tap "Add New" or save songs during performances.</p>
                                    <div className="text-sm text-zinc-500 mt-1">{getTight15List().length}/{TIGHT15_MAX} songs</div>
                                </div>
                                <div className="flex gap-2 mb-2">
                                    <button onClick={importRecentToTight15} className="flex-1 bg-zinc-900/70 border border-zinc-700 text-zinc-200 py-1 rounded-md text-sm font-semibold uppercase tracking-widest">Import Recent</button>
                                    <button
                                        onClick={() => {
                                            setTight15SearchQ('');
                                            tight15SectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            setTimeout(() => tight15InputRef.current?.focus(), 120);
                                        }}
                                        className="flex-1 bg-[#00C4D9]/15 border border-[#00C4D9]/40 text-[#00C4D9] py-1 rounded-md text-sm font-semibold uppercase tracking-widest"
                                    >
                                        + Add New
                                    </button>
                                </div>
                                <div className="text-sm text-zinc-500 mb-2 text-left">Drag to reorder your setlist.</div>
                                <div className="relative z-30 mb-4">
                                    <input
                                        ref={tight15InputRef}
                                        value={tight15SearchQ}
                                        onChange={e => setTight15SearchQ(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-600 rounded-lg p-2.5 text-base text-white outline-none"
                                        placeholder="Search songs to add to your Tight 15..."
                                    />
                                    {tight15Results.length > 0 && (
                                        <div className="absolute top-full left-0 w-full bg-zinc-900 border border-zinc-700 z-50 shadow-xl max-h-60 touch-scroll-y custom-scrollbar">
                                            {tight15Results.map(r => (
                                                <div
                                                    key={r.trackId}
                                                    onClick={() => {
                                                        addToTight15({ songTitle: r.trackName, artist: r.artistName, albumArtUrl: r.artworkUrl100.replace('100x100','600x600') });
                                                        setTight15Results([]);
                                                        setTight15SearchQ('');
                                                    }}
                                                    className="p-3 border-b border-zinc-800 hover:bg-zinc-800 flex gap-3 cursor-pointer"
                                                >
                                                    <img src={r.artworkUrl100} className="w-10 h-10 rounded" />
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-base truncate">{r.trackName}</div>
                                                        <div className="text-base text-zinc-400 truncate">{r.artistName}</div>
                                                    </div>
                                                    <div className="ml-auto text-base text-cyan-300 font-bold">Add</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                {getTight15List().length === 0 && (
                                    <div className="text-left text-base text-zinc-500">No songs yet. Start with "Add New" or tap + TIGHT 15 during a performance.</div>
                                )}
                                    {getTight15List().map((item, idx) => (
                                        <div
                                            key={item.id}
                                            draggable
                                            onDragStart={() => setDragIndex(idx)}
                                            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                                            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                                            onDrop={() => { reorderTight15(dragIndex, idx); setDragIndex(null); setDragOverIndex(null); }}
                                            data-tight15-index={idx}
                                            onTouchStart={() => handleTight15TouchStart(idx)}
                                            onTouchMove={handleTight15TouchMove}
                                            onTouchEnd={handleTight15TouchEnd}
                                            className={`flex items-center justify-between bg-zinc-900/60 border rounded-xl p-3 gap-3 ${dragOverIndex === idx ? 'border-[#00C4D9]' : 'border-zinc-700'}`}
                                        >
                                            {item.albumArtUrl ? (
                                                <img src={item.albumArtUrl} className="w-10 h-10 rounded-lg object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-zinc-700 flex items-center justify-center text-lg">{DEFAULT_EMOJI}</div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-white text-base leading-snug line-clamp-2">{item.songTitle}</div>
                                                <div className="text-base text-zinc-400 truncate">{item.artist}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="text-zinc-500 text-sm font-bold">{idx + 1}</div>
                                                <button
                                                    onClick={() => submitSong(item.songTitle, item.artist, item.albumArtUrl)}
                                                    className="h-6 w-6 rounded-full bg-[#00C4D9]/20 text-[#00C4D9] border border-[#00C4D9]/30 flex items-center justify-center text-xs font-bold"
                                                    aria-label="Queue song"
                                                >
                                                    <i className="fa-solid fa-plus"></i>
                                                </button>
                                                <button
                                                    onClick={() => removeFromTight15(item.id)}
                                                    className="h-6 w-6 rounded-full bg-pink-500/15 text-pink-300 border border-pink-500/30 flex items-center justify-center text-xs font-bold"
                                                    aria-label="Remove from Tight 15"
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {!canSaveTight15 && (
                                    <button onClick={()=>setShowPhoneModal(true)} className="w-full bg-[#00C4D9] text-black py-3 rounded-xl font-bold mt-4">Create Account to Save Across Rooms</button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {room?.activeMode === 'bingo' && !showBingoOverlay && room?.bingoAudienceReopenEnabled !== false && (
                <button
                    onClick={() => setShowBingoOverlay(true)}
                    className="fixed right-4 bottom-28 z-[95] bg-purple-500/85 text-white border border-purple-300/40 shadow-[0_10px_28px_rgba(147,51,234,0.45)] px-4 py-2 rounded-full text-sm font-black uppercase tracking-[0.2em]"
                >
                    <i className="fa-solid fa-table-cells mr-2"></i>
                    Bingo Live
                </button>
            )}

            <div
                className="relative border-t border-pink-400/30 flex-none z-20"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div className="absolute inset-0" style={{ background: MOBILE_NAV_GRADIENT }}></div>
                <div
                    className="relative py-1.5 flex"
                    style={{ paddingLeft: 'max(8px, env(safe-area-inset-left))', paddingRight: 'max(8px, env(safe-area-inset-right))' }}
                >
                    <button onClick={()=>setTab('home')} className={`flex-1 py-3 flex flex-col items-center gap-1.5 leading-tight ${tab==='home'?'text-[#FF7AC8] drop-shadow-[0_0_12px_rgba(255,122,200,0.6)]':'text-zinc-300'}`}><i className="fa-solid fa-champagne-glasses text-[28px]"></i><span className="text-base font-semibold">PARTY</span></button>
                    <button onClick={()=>setTab('request')} className={`flex-1 py-3 flex flex-col items-center gap-1.5 leading-tight ${tab==='request'?'text-[#46D7E8] drop-shadow-[0_0_12px_rgba(70,215,232,0.55)]':'text-zinc-300'}`}><i className="fa-solid fa-music text-[28px]"></i><span className="text-base font-semibold">SONGS</span></button>
                    <button onClick={() => {
                        setTab('social');
                        setSocialTab('lounge');
                        const newest = chatMessages[0]?.timestamp?.seconds ? chatMessages[0].timestamp.seconds * 1000 : 0;
                        if (newest) chatLastSeenRef.current = newest;
                        setChatUnread(false);
                    }} className={`flex-1 py-3 flex flex-col items-center gap-1.5 leading-tight ${tab==='social'?'text-[#FF7AC8] drop-shadow-[0_0_12px_rgba(255,122,200,0.6)]':'text-zinc-300'} relative`}>
                        <i className="fa-solid fa-comments text-[28px]"></i>
                        {chatUnread && <span className="absolute top-2 right-8 w-2.5 h-2.5 rounded-full bg-pink-400 ring-2 ring-pink-300/60 shadow-[0_0_10px_rgba(255,103,182,0.8)]"></span>}
                        <span className="text-base font-semibold">SOCIAL</span>
                    </button>
                </div>
            </div>

            {/* Photo Overlay */}
            {room?.photoOverlay && (!dismissedPhotoTs || (room.photoOverlay.timestamp || 0) > dismissedPhotoTs) && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 animate-in zoom-in">
                    <div className="relative bg-white p-4 pb-20 shadow-2xl rounded-xl max-w-[90vw]">
                        <button onClick={() => setDismissedPhotoTs(room?.photoOverlay?.timestamp || Date.now())} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/70 text-white text-xl font-bold flex items-center justify-center border border-white/20">X</button>
                        <img src={composedPhoto || room.photoOverlay.url} className="max-h-[60vh] border-2 border-zinc-200 rounded-lg" />
                        <img src={room?.logoUrl || ASSETS.logo} className="absolute top-4 right-4 w-20 opacity-90" alt="BROSS" />
                        <div className="absolute bottom-10 left-0 w-full text-center text-2xl text-black font-bold font-mono">Photo by {room.photoOverlay.userName}</div>
                        <div className="absolute bottom-3 left-0 w-full flex items-center justify-center gap-3">
                            <button onClick={saveComposedPhoto} disabled={!composedPhoto} className="bg-[#00C4D9] text-black px-4 py-2 rounded-lg font-bold disabled:opacity-50">Save</button>
                            <button onClick={shareComposedPhoto} disabled={!composedPhoto} className="bg-cyan-500 text-black px-4 py-2 rounded-lg font-bold disabled:opacity-50">Share</button>
                            {isComposing && <div className="text-xs text-zinc-500">Preparing...</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SingerApp;

