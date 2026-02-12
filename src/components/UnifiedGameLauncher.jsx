import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GAMES_META } from '../lib/gameRegistry';
import { db, doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from '../lib/firebase';
import { APP_ID } from '../lib/assets';
import { shuffleArray } from '../lib/utils';
import { TRIVIA_BANK, WYR_BANK } from '../lib/gameDataConstants';

const STYLES = {
    btnStd: "rounded-xl font-bold transition-all active:scale-95 shadow-md uppercase tracking-wider flex items-center justify-center border text-[11px] sm:text-xs py-2 px-3 cursor-pointer whitespace-nowrap backdrop-blur-sm gap-2 min-h-[34px] focus:outline-none focus-visible:outline-none focus-visible:ring-0",
    btnPrimary: "bg-[#00C4D9]/20 border-[#00C4D9]/40 text-[#00C4D9] hover:bg-[#00C4D9]/30",
    btnSecondary: "bg-zinc-900/60 border-zinc-700 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-600",
    btnDanger: "bg-red-600/20 border-red-600/40 text-red-300 hover:bg-red-600/30",
    btnNeutral: "bg-zinc-900/60 border-zinc-700 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-600",
    input: "bg-zinc-900/70 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00C4D9]/50",
    header: "text-xs uppercase tracking-[0.3em] text-zinc-500",
};

const KARAOKE_TROPES = [
    'Mic drop moment',
    'Divorce dad rock',
    'Crowd singalong',
    'Big power ballad',
    'Unexpected key change',
    'High note hero',
    'Duet surprise',
    'Air guitar solo',
    'Dance break',
    'Audience chant',
    'Host shout-out',
    'Phone lights up',
    'Slow clap build',
    'Costume or prop',
    'Birthday shout',
    'Encore chant',
    '90s throwback',
    'Boy band classic',
    '80s arena anthem',
    'Guilty pleasure pick',
    'First-time singer',
    'Full room harmony',
    'Epic falsetto',
    'Crowd cheer burst',
    'Wildcard moment'
];

const KARAOKE_PRESETS = {
    tropes: [...KARAOKE_TROPES]
};

const MYSTERY_PRESETS = {
    classics: [
        { title: 'Bohemian Rhapsody', artist: 'Queen', clue: 'Mamma Mia!' },
        { title: 'I Will Survive', artist: 'Gloria Gaynor', clue: 'Breakup anthem' },
        { title: 'Sweet Caroline', artist: 'Neil Diamond', clue: 'Ba ba ba!' },
        { title: 'Dont Stop Believin', artist: 'Journey', clue: 'Small town girl' },
        { title: 'Mr. Brightside', artist: 'The Killers', clue: 'Coming out of my cage' },
        { title: 'Billie Jean', artist: 'Michael Jackson', clue: 'Not my lover' },
        { title: 'Livin on a Prayer', artist: 'Bon Jovi', clue: 'Woah, we are halfway' },
        { title: 'Hey Ya', artist: 'OutKast', clue: 'Shake it like a Polaroid' }
    ]
};

const resolveRoomUserUid = (roomUser = {}) => roomUser?.uid || roomUser?.id?.split('_')[1] || '';

const getBracketMatchCrowdVotes = ({ users = [], bracketId = '', match = null }) => {
    const summary = {
        total: 0,
        aVotes: 0,
        bVotes: 0
    };
    if (!Array.isArray(users) || !users.length || !bracketId || !match?.id) return summary;
    users.forEach((entry) => {
        const voterUid = resolveRoomUserUid(entry);
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

const isHostCandidate = (room = {}, user = {}) => {
    const uid = resolveRoomUserUid(user);
    if (!uid) return false;
    if (room?.hostUid && uid === room.hostUid) return true;
    if (room?.hostName && String(user?.name || '').trim() === String(room.hostName).trim()) return true;
    return false;
};

const buildPresetTiles = (items, size, mode) => {
    const total = size * size;
    const tiles = [];
    for (let i = 0; i < total; i += 1) {
        const isFree = size % 2 === 1 && i === Math.floor(total / 2);
        const item = items[i % items.length];
        if (mode === 'mystery') {
            tiles.push({
                id: i,
                type: 'mystery',
                text: item.clue,
                status: 'hidden',
                content: { title: item.title, artist: item.artist, art: item.art || '' },
                free: false
            });
        } else {
            tiles.push({
                id: i,
                type: 'karaoke',
                text: isFree ? 'FREE' : item,
                status: 'hidden',
                content: null,
                free: isFree
            });
        }
    }
    return tiles;
};

const PRESET_BINGO_BOARDS = [
    {
        id: 'preset-karaoke-tropes',
        title: 'Karaoke Bingo: Tropes',
        mode: 'karaoke',
        size: '5',
        tiles: buildPresetTiles(KARAOKE_PRESETS.tropes, 5, 'karaoke')
    },
    {
        id: 'preset-mystery-classics',
        title: 'Mystery: Karaoke Classics',
        mode: 'mystery',
        size: '5',
        tiles: buildPresetTiles(MYSTERY_PRESETS.classics, 5, 'mystery')
    }
];

const defaultBingoVictory = () => ({
    line: { enabled: true, reward: '150' },
    corners: { enabled: false, reward: '' },
    blackout: { enabled: false, reward: '350' }
});

const normalizeBingoVictory = (victory) => ({
    line: { enabled: !!victory?.line?.enabled, reward: victory?.line?.reward || '' },
    corners: { enabled: !!victory?.corners?.enabled, reward: victory?.corners?.reward || '' },
    blackout: { enabled: !!victory?.blackout?.enabled, reward: victory?.blackout?.reward || '' }
});

const formatBingoVictorySummary = (victory) => {
    const safe = normalizeBingoVictory(victory);
    const parts = [];
    if (safe.line.enabled) parts.push('Line');
    if (safe.corners.enabled) parts.push('Corners');
    if (safe.blackout.enabled) parts.push('Blackout');
    return parts.length ? parts.join(' / ') : 'None';
};

const parseRewardPoints = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
    const asNumber = parseInt(String(value || '').replace(/[^0-9-]/g, ''), 10);
    if (!Number.isFinite(asNumber)) return 0;
    return Math.max(0, asNumber);
};

const buildInitialBingoRevealed = (tiles = []) => {
    const revealed = {};
    tiles.forEach((tile, idx) => {
        if (tile?.free) {
            revealed[idx] = true;
        }
    });
    return revealed;
};

const detectBingoWin = ({ tiles = [], size = 5, revealed = {}, victory = defaultBingoVictory() }) => {
    if (!Array.isArray(tiles) || !tiles.length) return null;
    const safeSize = Math.max(1, Number(size || Math.sqrt(tiles.length) || 5));
    const total = safeSize * safeSize;
    const marked = (idx) => {
        if (idx < 0 || idx >= total) return false;
        if (revealed?.[idx]) return true;
        return !!tiles[idx]?.free;
    };
    const safeVictory = normalizeBingoVictory(victory || defaultBingoVictory());

    const rowWin = () => {
        for (let r = 0; r < safeSize; r += 1) {
            let all = true;
            for (let c = 0; c < safeSize; c += 1) {
                if (!marked((r * safeSize) + c)) {
                    all = false;
                    break;
                }
            }
            if (all) return true;
        }
        return false;
    };
    const colWin = () => {
        for (let c = 0; c < safeSize; c += 1) {
            let all = true;
            for (let r = 0; r < safeSize; r += 1) {
                if (!marked((r * safeSize) + c)) {
                    all = false;
                    break;
                }
            }
            if (all) return true;
        }
        return false;
    };
    const diagWin = () => {
        let leftRight = true;
        let rightLeft = true;
        for (let i = 0; i < safeSize; i += 1) {
            if (!marked((i * safeSize) + i)) leftRight = false;
            if (!marked((i * safeSize) + (safeSize - 1 - i))) rightLeft = false;
        }
        return leftRight || rightLeft;
    };
    const cornersWin = () => {
        const corners = [0, safeSize - 1, (safeSize * (safeSize - 1)), (safeSize * safeSize) - 1];
        return corners.every((idx) => marked(idx));
    };
    const blackoutWin = () => {
        for (let i = 0; i < total; i += 1) {
            if (!marked(i)) return false;
        }
        return true;
    };

    if (safeVictory?.line?.enabled && (rowWin() || colWin() || diagWin())) {
        return { type: 'line', label: 'Line Complete', reward: safeVictory?.line?.reward || '' };
    }
    if (safeVictory?.corners?.enabled && cornersWin()) {
        return { type: 'corners', label: 'Four Corners', reward: safeVictory?.corners?.reward || '' };
    }
    if (safeVictory?.blackout?.enabled && blackoutWin()) {
        return { type: 'blackout', label: 'Blackout', reward: safeVictory?.blackout?.reward || '' };
    }
    return null;
};

const GameConfigShell = ({ title, subtitle, accentClass, onClose, children }) => {
    return (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6">
            <div className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Game Config</div>
                        <div className={`text-2xl font-bold ${accentClass || 'text-white'}`}>{title}</div>
                        {subtitle ? <div className="text-xs text-zinc-400 mt-1">{subtitle}</div> : null}
                    </div>
                    <button onClick={onClose} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-sm`}>Close</button>
                </div>
                {children}
            </div>
        </div>
    );
};

const UnifiedGameLauncher = ({
    room,
    roomCode,
    updateRoom,
    users,
    logActivity,
    songs,
    generateAIContent,
    callFunction,
    useToast,
    autoOpenGameId,
    capabilities = {},
    entitlementStatus = {},
    bracketBusy = false,
    onCreateSweet16Bracket,
    onQueueNextBracketMatch,
    onClearSweet16Bracket,
    onSetBracketMatchWinner,
    onSetBracketWinnerFromCrowdVotes,
    onToggleBracketCrowdVoting,
    onForfeitBracketContestant
}) => {
    const toast = useToast() || console.log;
    const canUseAiGeneration = !!capabilities?.['ai.generate_content'];
    const aiGateMessage = entitlementStatus?.loading
        ? 'Checking AI entitlement...'
        : 'AI tools require an active Host subscription.';
    const [subscriptionCheckoutLoading, setSubscriptionCheckoutLoading] = useState(false);
    const getTimestampMs = (value) => {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (typeof value?.toMillis === 'function') return value.toMillis();
        if (typeof value?.seconds === 'number') return value.seconds * 1000;
        return 0;
    };
    const [showGameConfig, setShowGameConfig] = useState(false);
    const [selectedGameForConfig, setSelectedGameForConfig] = useState(null);
    const [selectedSingerId, setSelectedSingerId] = useState('');
    const sortedUsers = [...users].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const allUserIds = useMemo(() => sortedUsers.map(u => u.id.split('_')[1]), [sortedUsers]);
    const [bracketSeedUids, setBracketSeedUids] = useState([]);
    const [bracketSeedRandomize, setBracketSeedRandomize] = useState(false);
    const bracketCandidates = useMemo(
        () => sortedUsers.filter((entry) => !isHostCandidate(room, entry)),
        [sortedUsers, room]
    );
    
    // Doodle-oke state
    const [doodlePromptsText, setDoodlePromptsText] = useState('');
    const [doodleDuration, setDoodleDuration] = useState(45);
    const [doodleGuessDuration, setDoodleGuessDuration] = useState(12);
    const [doodleAiTopic, setDoodleAiTopic] = useState('');
    const [doodleAiLoading, setDoodleAiLoading] = useState(false);
    const [doodleParticipants, setDoodleParticipants] = useState([]);
    const [doodleRoundRobin, setDoodleRoundRobin] = useState(true);
    const [doodleCustomPrompt, setDoodleCustomPrompt] = useState('');

    // Selfie challenge state
    const [selfieChallengeParticipants, setSelfieChallengeParticipants] = useState([]);
    const [selfiePrompt, setSelfiePrompt] = useState('');
    const [selfieRequireApproval, setSelfieRequireApproval] = useState(true);
    const [selfieAutoStartVoting, setSelfieAutoStartVoting] = useState(true);
    const [selfieAiLoading, setSelfieAiLoading] = useState(false);
    
    // Scale state
    const [scaleParticipants, setScaleParticipants] = useState([]);
    const [scaleDurationSec, setScaleDurationSec] = useState(30);
    const [scaleMaxStrikes, setScaleMaxStrikes] = useState(3);
    const [scaleRewardPerRound, setScaleRewardPerRound] = useState(50);
    const [scaleDifficulty, setScaleDifficulty] = useState('standard');
    const [scaleGuideTone, setScaleGuideTone] = useState(true);

    // Trivia / WYR / Bingo state
    const [triviaBank, setTriviaBank] = useState([]);
    const [wyrBank, setWyrBank] = useState([]);
    const [triviaFilter, setTriviaFilter] = useState('');
    const [wyrFilter, setWyrFilter] = useState('');
    const [selectedTriviaId, setSelectedTriviaId] = useState('');
    const [selectedWyrId, setSelectedWyrId] = useState('');
    const [triviaParticipants, setTriviaParticipants] = useState([]);
    const [triviaParticipantMode, setTriviaParticipantMode] = useState('all');
    const [triviaRoundSec, setTriviaRoundSec] = useState(20);
    const [triviaAutoReveal, setTriviaAutoReveal] = useState(true);
    const [wyrParticipants, setWyrParticipants] = useState([]);
    const [wyrParticipantMode, setWyrParticipantMode] = useState('all');
    const [bingoBoards, setBingoBoards] = useState([]);
    const [bingoParticipants, setBingoParticipants] = useState([]);
    const [bingoParticipantMode, setBingoParticipantMode] = useState('all');
    const bingoRngFinalizeRef = useRef(null);
    const bingoRngAppendRef = useRef({ startTime: null, uids: new Set() });
    const bingoWinResolveRef = useRef('');
    const [triviaAiTopic, setTriviaAiTopic] = useState('');
    const [triviaAiLoading, setTriviaAiLoading] = useState(false);
    const [wyrAiTopic, setWyrAiTopic] = useState('');
    const [wyrAiLoading, setWyrAiLoading] = useState(false);
    const autoOpenRef = useRef(false);
    
    // Vocal challenge state
    const [vocalParticipants, setVocalParticipants] = useState([]);
    const [vocalDurationSec, setVocalDurationSec] = useState(30);
    const [vocalDifficulty, setVocalDifficulty] = useState('standard');
    const [vocalGuideTone, setVocalGuideTone] = useState(true);

    const participantConfigs = useMemo(() => ({
        trivia_pop: {
            mode: triviaParticipantMode,
            count: triviaParticipants.length,
            setMode: setTriviaParticipantMode,
            setParticipants: setTriviaParticipants,
            participants: triviaParticipants
        },
        wyr: {
            mode: wyrParticipantMode,
            count: wyrParticipants.length,
            setMode: setWyrParticipantMode,
            setParticipants: setWyrParticipants,
            participants: wyrParticipants
        },
        bingo: {
            mode: bingoParticipantMode,
            count: bingoParticipants.length,
            setMode: setBingoParticipantMode,
            setParticipants: setBingoParticipants,
            participants: bingoParticipants
        },
        doodle_oke: {
            mode: doodleParticipants.length ? 'selected' : 'all',
            count: doodleParticipants.length,
            setMode: (mode) => { if (mode === 'all') setDoodleParticipants([]); },
            setParticipants: setDoodleParticipants,
            participants: doodleParticipants
        },
        selfie_challenge: {
            mode: selfieChallengeParticipants.length ? 'selected' : 'all',
            count: selfieChallengeParticipants.length,
            setMode: (mode) => { if (mode === 'all') setSelfieChallengeParticipants([]); },
            setParticipants: setSelfieChallengeParticipants,
            participants: selfieChallengeParticipants
        },
        vocal_challenge: {
            mode: vocalParticipants.length ? 'selected' : 'all',
            count: vocalParticipants.length,
            setMode: (mode) => { if (mode === 'all') setVocalParticipants([]); },
            setParticipants: setVocalParticipants,
            participants: vocalParticipants
        },
        riding_scales: {
            mode: scaleParticipants.length ? 'selected' : 'all',
            count: scaleParticipants.length,
            setMode: (mode) => { if (mode === 'all') setScaleParticipants([]); },
            setParticipants: setScaleParticipants,
            participants: scaleParticipants
        }
    }), [
        triviaParticipantMode,
        triviaParticipants,
        wyrParticipantMode,
        wyrParticipants,
        bingoParticipantMode,
        bingoParticipants,
        doodleParticipants,
        selfieChallengeParticipants,
        vocalParticipants,
        scaleParticipants
    ]);

    const getGameBadges = (game) => {
        const rewardMap = {
            trivia_pop: 'Rewards: 100 pts',
            wyr: 'Rewards: 50 pts',
            bingo: 'Rewards: Custom',
            karaoke_bracket: 'Rewards: Bracket champion',
            riding_scales: `Rewards: ${Math.max(10, Number(scaleRewardPerRound) || 50)} pts/round`,
            vocal_challenge: 'Rewards: Streak score',
            flappy_bird: 'Rewards: High score',
            doodle_oke: 'Rewards: Votes',
            selfie_challenge: 'Rewards: Votes'
        };
        const modeMap = {
            flappy_bird: 'Mode: Solo/Crowd',
            vocal_challenge: 'Mode: Turns/Crowd',
            riding_scales: 'Mode: Turns/Crowd',
            doodle_oke: 'Mode: Round robin',
            trivia_pop: 'Mode: Group',
            wyr: 'Mode: Group',
            bingo: 'Mode: Group',
            karaoke_bracket: 'Mode: 1v1 elimination',
            selfie_challenge: 'Mode: Group'
        };
        const config = participantConfigs[game.id];
        const playerLabel = config
            ? (config.mode === 'selected' && config.count ? `Players: ${config.count}` : 'Players: All')
            : 'Players: All';
        const badges = [
            { label: playerLabel, tone: 'border-white/10 bg-black/40 text-zinc-300' },
            { label: modeMap[game.id] || `Mode: ${game.category}`, tone: 'border-white/10 bg-black/40 text-zinc-300' }
        ];
        if (rewardMap[game.id]) {
            badges.push({ label: rewardMap[game.id], tone: 'border-white/10 bg-black/40 text-zinc-300' });
        }
        if (game.playModes && game.playModes.length) {
            badges.push({ label: `Plays: ${game.playModes.join('/')}`, tone: 'border-white/10 bg-black/40 text-zinc-300' });
        }
        return badges;
    };
    
    const activeGameLabel = {
        flappy_bird: 'Flappy Bird',
        vocal_challenge: 'Vocal Challenge',
        riding_scales: 'Riding Scales',
        selfie_challenge: 'Selfie Challenge',
        selfie_cam: 'Selfie Cam',
        doodle_oke: 'Doodle-oke',
        bingo: 'Bingo',
        karaoke_bracket: 'Sweet 16 Bracket',
        trivia_pop: 'Trivia',
        trivia_reveal: 'Trivia',
        wyr: 'Would You Rather',
        wyr_reveal: 'Would You Rather'
    }[room?.activeMode] || '';

    useEffect(() => {
        if (!roomCode) return () => {};
        const normalizeTrivia = (items) => items.map((t, idx) => ({ id: t.id || `${Date.now()}_${idx}`, asked: t.asked || false, ...t }));
        const normalizeWyr = (items) => items.map((w, idx) => ({ id: w.id || `${Date.now()}_${idx}`, asked: w.asked || false, ...w }));
        const unsub = onSnapshot(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), (snap) => {
            const data = snap.data() || {};
            const nextTrivia = Array.isArray(data.trivia) && data.trivia.length ? normalizeTrivia(data.trivia) : normalizeTrivia(TRIVIA_BANK);
            const nextWyr = Array.isArray(data.wyr) && data.wyr.length ? normalizeWyr(data.wyr) : normalizeWyr(WYR_BANK);
            if (!snap.exists()) {
                setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), { trivia: nextTrivia, wyr: nextWyr }, { merge: true }).catch(() => {});
            }
            setTriviaBank(nextTrivia);
            setWyrBank(nextWyr);
            setBingoBoards(Array.isArray(data.bingo) ? data.bingo : []);
        });
        return () => unsub();
    }, [roomCode]);

    useEffect(() => {
        if (!autoOpenGameId || autoOpenRef.current) return;
        const gameId = autoOpenGameId.toLowerCase();
        if (!GAMES_META.find(g => g.id === gameId)) return;
        setSelectedGameForConfig(gameId);
        setShowGameConfig(true);
        autoOpenRef.current = true;
    }, [autoOpenGameId]);

    useEffect(() => {
        if (!showGameConfig || selectedGameForConfig !== 'karaoke_bracket') return;
        const candidateUids = bracketCandidates.map((entry) => resolveRoomUserUid(entry)).filter(Boolean);
        const candidateSet = new Set(candidateUids);
        const bracketOrder = Array.isArray(room?.karaokeBracket?.contestantOrder)
            ? room.karaokeBracket.contestantOrder.filter((uid) => candidateSet.has(uid))
            : [];
        const fallback = candidateUids.slice(0, 16);
        setBracketSeedUids((prev) => {
            const cleanedPrev = Array.isArray(prev) ? prev.filter((uid) => candidateSet.has(uid)) : [];
            if (cleanedPrev.length) return cleanedPrev;
            if (bracketOrder.length) return bracketOrder;
            return fallback;
        });
    }, [showGameConfig, selectedGameForConfig, bracketCandidates, room?.karaokeBracket?.id, room?.karaokeBracket?.contestantOrder]);

    useEffect(() => {
        if (!selectedTriviaId && triviaBank.length) {
            setSelectedTriviaId(triviaBank[0].id);
        }
    }, [selectedTriviaId, triviaBank]);

    useEffect(() => {
        if (!selectedWyrId && wyrBank.length) {
            setSelectedWyrId(wyrBank[0].id);
        }
    }, [selectedWyrId, wyrBank]);

    useEffect(() => {
        const defaults = room?.gameDefaults || {};
        if (defaults?.triviaRoundSec !== undefined && defaults?.triviaRoundSec !== null) {
            setTriviaRoundSec(Math.max(5, Number(defaults.triviaRoundSec) || 20));
        }
        if (defaults?.triviaAutoReveal !== undefined && defaults?.triviaAutoReveal !== null) {
            setTriviaAutoReveal(!!defaults.triviaAutoReveal);
        }
    }, [room?.gameDefaults?.triviaRoundSec, room?.gameDefaults?.triviaAutoReveal, room?.gameDefaults]);
    
    const triggerGameRules = async () => {
        await updateRoom({ gameRulesId: Date.now() });
        toast("Game rules sent to screens");
    };
    
    const stopGame = async () => { 
        await updateRoom({ activeMode: 'karaoke', gameData: null, gameParticipantMode: null, gameParticipants: null }); 
        toast("Game Stopped"); 
    };

    const buildParticipantPayload = (mode, participants) => ({
        gameParticipantMode: mode === 'selected' ? 'selected' : 'all',
        gameParticipants: mode === 'selected' ? participants : null
    });

    const startGame = (gameId) => {
        setSelectedGameForConfig(gameId);
        setShowGameConfig(true);
    };

    const toggleGamePreview = async (gameId) => {
        const next = room?.gamePreviewId === gameId ? null : gameId;
        await updateRoom({ gamePreviewId: next, gamePreviewAt: Date.now() });
        toast(next ? 'Preview on TV enabled' : 'Preview cleared');
    };

    const getSmartDefaults = (gameId, config) => {
        const playerLabel = config
            ? (config.mode === 'selected' && config.count ? `${config.count} players` : 'All players')
            : 'All players';
        const durationMap = {
            doodle_oke: `${Math.max(10, Number(doodleDuration) || 45)}s`,
            vocal_challenge: `${Math.max(10, Number(vocalDurationSec) || 30)}s`,
            riding_scales: `${Math.max(10, Number(scaleDurationSec) || 30)}s`,
            selfie_challenge: 'Photo round',
            trivia_pop: `${Math.max(5, Number(triviaRoundSec) || 20)}s round`,
            wyr: '1 question',
            bingo: '1 board',
            karaoke_bracket: 'Sweet 16 flow',
            flappy_bird: 'Quick round'
        };
        const rewardMap = {
            trivia_pop: '100 pts',
            wyr: '50 pts',
            bingo: 'Custom',
            karaoke_bracket: 'Champion',
            riding_scales: `${Math.max(10, Number(scaleRewardPerRound) || 50)} pts`,
            vocal_challenge: 'Streak score',
            flappy_bird: 'High score',
            doodle_oke: 'Votes',
            selfie_challenge: 'Votes'
        };
        const duration = durationMap[gameId] || 'Quick round';
        const reward = rewardMap[gameId] || 'Points';
        return `Smart: ${playerLabel} · ${duration} · ${reward}`;
    };

    const quickLaunchGame = async (gameId, config) => {
        if (config?.setMode) {
            if (config.mode !== 'selected' || !config.count) {
                config.setMode('all');
                if (config.setParticipants) config.setParticipants([]);
            }
        }
        if (gameId === 'flappy_bird') return startFlappyAmbient();
        if (gameId === 'vocal_challenge') return startVocalAmbient();
        if (gameId === 'riding_scales') return startRidingScalesCrowd();
        if (gameId === 'trivia_pop') return startRandomTrivia();
        if (gameId === 'wyr') return startRandomWyr();
        if (gameId === 'bingo') {
            const board = bingoBoards[0];
            if (!board) {
                toast('Add a bingo board first.');
                return startGame(gameId);
            }
            return startBingo(board);
        }
        if (gameId === 'doodle_oke') {
            if (!doodlePromptsText.trim() && !doodleAiTopic.trim() && !doodleCustomPrompt.trim()) {
                toast('Add prompts or a topic first.');
                return startGame(gameId);
            }
            return startDoodleOke();
        }
        if (gameId === 'selfie_challenge') {
            if (!selfiePrompt.trim() || !selfieChallengeParticipants.length) {
                toast('Add a prompt and pick participants.');
                return startGame(gameId);
            }
            return startSelfieChallenge();
        }
        if (gameId === 'karaoke_bracket') {
            if (room?.karaokeBracket?.rounds?.length) {
                await updateRoom({
                    activeMode: 'karaoke_bracket',
                    karaokeBracket: room.karaokeBracket,
                    gameData: room.karaokeBracket,
                    gameParticipantMode: 'all',
                    gameParticipants: null
                });
                toast('Bracket launched');
                return;
            }
            if (onCreateSweet16Bracket) {
                return onCreateSweet16Bracket();
            }
            return startGame(gameId);
        }
        return startGame(gameId);
    };
    
    const startFlappyAmbient = async () => {
        await updateRoom({
            activeMode: 'flappy_bird',
            gameData: { playerId: 'AMBIENT', playerName: 'THE CROWD', playerAvatar: 'O', inputSource: 'ambient', status: 'waiting', score: 0, lives: 3, timestamp: Date.now() },
            ...buildParticipantPayload('all', [])
        });
        logActivity(roomCode, 'HOST', 'started Ambient Flappy (crowd mic).', 'GAME');
        toast("Ambient Flappy Started!");
        setShowGameConfig(false);
    };
    
    const startFlappySolo = async () => {
        const selected = users.find(u => u.id?.split('_')[1] === selectedSingerId);
        if (!selected) { toast("Pick a singer to start Solo Flappy."); return; }
        const uid = selected.id.split('_')[1];
        await updateRoom({
            activeMode: 'flappy_bird',
            gameData: { playerId: uid, playerName: selected.name || 'SINGER', playerAvatar: selected.avatar || 'O', inputSource: 'singer', status: 'waiting', score: 0, lives: 3, timestamp: Date.now() },
            ...buildParticipantPayload('selected', [uid])
        });
        logActivity(roomCode, 'HOST', `started Solo Flappy for ${selected.name || 'Singer'}.`, 'GAME');
        toast("Solo Flappy Started!");
        setShowGameConfig(false);
    };
    
    const startVocalAmbient = async () => {
        await updateRoom({
            activeMode: 'vocal_challenge',
            gameData: {
                playerId: 'AMBIENT',
                playerName: 'THE CROWD',
                playerAvatar: 'O',
                inputSource: 'ambient',
                mode: 'crowd',
                status: 'playing',
                score: 0,
                streak: 0,
                turnDurationMs: Math.max(10, Number(vocalDurationSec) || 30) * 1000,
                difficulty: vocalDifficulty,
                guideTone: vocalGuideTone,
                timestamp: Date.now()
            },
            ...buildParticipantPayload('all', [])
        });
        logActivity(roomCode, 'HOST', 'started Ambient Vocal Challenge.', 'GAME');
        toast("Ambient Vocal Challenge Started!");
        setShowGameConfig(false);
    };
    
    const startVocalSolo = async () => {
        const participants = vocalParticipants.length ? vocalParticipants : sortedUsers.map(u => u.id.split('_')[1]);
        if (!participants.length) { toast("Select at least one participant."); return; }
        const first = users.find(u => u.id?.split('_')[1] === participants[0]);
        const uid = participants[0];
        const participantMeta = participants.map((pid) => {
            const found = users.find(u => u.id?.split('_')[1] === pid);
            return { id: pid, name: found?.name || 'Singer', avatar: found?.avatar || 'O' };
        });
        await updateRoom({
            activeMode: 'vocal_challenge',
            gameData: {
                playerId: uid,
                playerName: first?.name || 'SINGER',
                playerAvatar: first?.avatar || 'O',
                inputSource: 'turns',
                mode: 'turns',
                participants,
                participantMeta,
                turnIndex: 0,
                status: 'playing',
                score: 0,
                streak: 0,
                turnDurationMs: Math.max(10, Number(vocalDurationSec) || 30) * 1000,
                difficulty: vocalDifficulty,
                guideTone: vocalGuideTone,
                timestamp: Date.now()
            },
            ...buildParticipantPayload('selected', participants)
        });
        logActivity(roomCode, 'HOST', 'started Vocal Challenge (turns).', 'GAME');
        toast("Vocal Challenge Started!");
        setShowGameConfig(false);
    };
    
    const SCALE_PATTERNS = [
        ['C', 'D', 'E', 'F', 'G', 'A', 'G', 'F', 'E', 'D'],
        ['C', 'E', 'G', 'A', 'G', 'F', 'E', 'D', 'C'],
        ['D', 'E', 'F', 'G', 'A', 'B', 'A', 'G', 'F', 'E'],
        ['E', 'F', 'G', 'A', 'B', 'A', 'G', 'F', 'E']
    ];
    const pickScalePattern = () => SCALE_PATTERNS[Math.floor(Math.random() * SCALE_PATTERNS.length)];
    
    const startRidingScalesCrowd = async () => {
        const now = Date.now();
        await updateRoom({
            activeMode: 'riding_scales',
            gameData: {
                playerId: 'GROUP',
                playerName: 'THE CROWD',
                playerAvatar: '🎤',
                inputSource: 'crowd',
                mode: 'crowd',
                startedAt: now,
                turnDurationMs: Math.max(10, Number(scaleDurationSec) || 30) * 1000,
                pattern: pickScalePattern(),
                difficulty: scaleDifficulty,
                guideTone: scaleGuideTone,
                maxStrikes: Math.max(1, Number(scaleMaxStrikes) || 3),
                rewardPerRound: Math.max(10, Number(scaleRewardPerRound) || 50),
                status: 'running'
            },
            ...buildParticipantPayload('all', [])
        });
        logActivity(roomCode, 'HOST', 'started Riding Scales (crowd).', 'GAME');
        toast("Riding Scales Started!");
        setShowGameConfig(false);
    };
    
    const startRidingScalesTurns = async () => {
        const participants = scaleParticipants.length ? scaleParticipants : sortedUsers.map(u => u.id.split('_')[1]);
        if (!participants.length) { toast("Select at least one participant."); return; }
        const first = users.find(u => u.id?.split('_')[1] === participants[0]);
        const now = Date.now();
        const participantMeta = participants.map((pid) => {
            const found = users.find(u => u.id?.split('_')[1] === pid);
            return { id: pid, name: found?.name || 'Singer', avatar: found?.avatar || '🎤' };
        });
        await updateRoom({
            activeMode: 'riding_scales',
            gameData: {
                playerId: participants[0],
                playerName: first?.name || 'Singer',
                playerAvatar: first?.avatar || '🎤',
                inputSource: 'turns',
                mode: 'turns',
                participants,
                participantMeta,
                turnIndex: 0,
                startedAt: now,
                turnDurationMs: Math.max(10, Number(scaleDurationSec) || 30) * 1000,
                pattern: pickScalePattern(),
                difficulty: scaleDifficulty,
                guideTone: scaleGuideTone,
                maxStrikes: Math.max(1, Number(scaleMaxStrikes) || 3),
                rewardPerRound: Math.max(10, Number(scaleRewardPerRound) || 50),
                status: 'running'
            },
            ...buildParticipantPayload('selected', participants)
        });
        logActivity(roomCode, 'HOST', 'started Riding Scales (turns).', 'GAME');
        toast("Riding Scales Started!");
        setShowGameConfig(false);
    };
    
    const startDoodleOke = async () => {
        if (!doodlePromptsText.trim() && !doodleAiTopic.trim() && !doodleCustomPrompt.trim()) {
            toast("Add prompts or a topic");
            return;
        }
        
        const prompts = doodlePromptsText.trim().split('\n').filter(p => p.trim());
        const allParticipants = doodleParticipants.length ? doodleParticipants : sortedUsers.map(u => u.id.split('_')[1]);
        
        if (!allParticipants.length) {
            toast("Select at least one participant");
            return;
        }
        
        const now = Date.now();
        const durationMs = Math.max(10, doodleDuration) * 1000;
        const guessMs = Math.max(5, doodleGuessDuration) * 1000;
        const index = Math.max(0, room?.doodleOkeIndex || 0);
        const prompt = doodleCustomPrompt.trim() || (doodleRoundRobin ? prompts[index % prompts.length] : prompts[Math.floor(Math.random() * prompts.length)]);
        const promptId = `${now}_${Math.random().toString(36).slice(2, 7)}`;
        const nextIndex = (index + 1) % allParticipants.length;
        
        await updateRoom({
            activeMode: 'doodle_oke',
            doodleOke: { status: 'drawing', prompt, promptId, durationMs, guessMs, startedAt: now, endsAt: now + durationMs, guessEndsAt: now + durationMs + guessMs, updatedAt: now },
            doodleOkeConfig: { prompts, durationMs, guessMs, participants: allParticipants, roundRobin: doodleRoundRobin },
            doodleOkeIndex: doodleRoundRobin ? nextIndex : index,
            ...buildParticipantPayload(allParticipants.length === allUserIds.length ? 'all' : 'selected', allParticipants)
        });
        
        setDoodleCustomPrompt('');
        logActivity(roomCode, 'HOST', 'started Doodle-oke round.', 'GAME');
        toast("Doodle-oke started!");
        setShowGameConfig(false);
    };
    
    const startSelfieChallenge = async () => {
        if (!selfiePrompt.trim()) {
            toast("Add a prompt");
            return;
        }
        if (!selfieChallengeParticipants.length) {
            toast("Select at least one participant");
            return;
        }
        
        const promptId = `${Date.now()}`;
        await updateRoom({
            activeMode: 'selfie_challenge',
            selfieChallenge: {
                prompt: selfiePrompt.trim(),
                promptId,
                participants: selfieChallengeParticipants,
                status: 'collecting',
                requireApproval: selfieRequireApproval,
                autoStartVoting: selfieAutoStartVoting,
                createdAt: Date.now()
            },
            ...buildParticipantPayload('selected', selfieChallengeParticipants)
        });
        
        logActivity(roomCode, 'HOST', 'started Selfie Challenge.', 'GAME');
        toast('Selfie Challenge started');
        setShowGameConfig(false);
    };
    
    const generateSelfieChallengePrompt = async () => {
        if (!canUseAiGeneration) {
            toast(aiGateMessage);
            return;
        }
        setSelfieAiLoading(true);
        try {
            const res = await generateAIContent('selfie_prompt', []);
            if (Array.isArray(res) && res.length) {
                setSelfiePrompt(res[0]);
            }
        } catch (err) {
            console.error("Failed to generate prompt:", err);
        }
        setSelfieAiLoading(false);
    };

    const updateBank = async (type, nextBank) => {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), { [type]: nextBank });
    };

    const appendTriviaFromAI = async () => {
        if (!canUseAiGeneration) {
            toast(aiGateMessage);
            return;
        }
        if (triviaAiLoading) return;
        setTriviaAiLoading(true);
        try {
            const context = triviaAiTopic.trim() ? { topic: triviaAiTopic.trim() } : songs.filter(s => s.status === 'performed').slice(0, 5);
            const result = await generateAIContent('trivia', context);
            if (Array.isArray(result) && result.length) {
                const mapped = result.map((i, idx) => ({
                    id: `${Date.now()}_${idx}`,
                    q: i.q,
                    correct: i.correct,
                    w1: i.w1,
                    w2: i.w2,
                    w3: i.w3,
                    points: 100,
                    asked: false
                }));
                const nextBank = [...triviaBank, ...mapped];
                setTriviaBank(nextBank);
                updateBank('trivia', nextBank).catch(() => {});
                setTriviaAiTopic('');
                toast('Trivia added');
            } else {
                toast('AI did not return trivia');
            }
        } catch (e) {
            console.error(e);
            toast('Trivia AI failed');
        } finally {
            setTriviaAiLoading(false);
        }
    };

    const appendWyrFromAI = async () => {
        if (!canUseAiGeneration) {
            toast(aiGateMessage);
            return;
        }
        if (wyrAiLoading) return;
        setWyrAiLoading(true);
        try {
            const context = wyrAiTopic.trim() ? { topic: wyrAiTopic.trim() } : songs.filter(s => s.status === 'performed').slice(0, 5);
            const result = await generateAIContent('wyr', context);
            if (Array.isArray(result) && result.length) {
                const mapped = result.map((i, idx) => ({
                    id: `${Date.now()}_${idx}`,
                    q: i.q,
                    a: i.a,
                    b: i.b,
                    points: 50,
                    asked: false
                }));
                const nextBank = [...wyrBank, ...mapped];
                setWyrBank(nextBank);
                updateBank('wyr', nextBank).catch(() => {});
                setWyrAiTopic('');
                toast('WYR added');
            } else {
                toast('AI did not return WYR');
            }
        } catch (e) {
            console.error(e);
            toast('WYR AI failed');
        } finally {
            setWyrAiLoading(false);
        }
    };

    const launchTrivia = async (item) => {
        if (!item) return;
        const durationSec = Math.max(5, Number(triviaRoundSec) || 20);
        const startedAt = Date.now();
        const autoReveal = !!triviaAutoReveal;
        const opts = shuffleArray([item.correct, item.w1, item.w2, item.w3].filter(Boolean));
        await updateRoom({
            activeMode: 'trivia_pop',
            triviaQuestion: {
                q: item.q,
                options: opts,
                correct: opts.indexOf(item.correct),
                id: Date.now().toString(),
                status: 'asking',
                rewarded: false,
                points: item.points || 100,
                startedAt,
                durationSec,
                autoReveal,
                revealAt: autoReveal ? startedAt + (durationSec * 1000) : null
            },
            ...buildParticipantPayload(triviaParticipantMode, triviaParticipantMode === 'selected' ? triviaParticipants : [])
        });
        const nextBank = triviaBank.map(t => (t.id === item.id ? { ...t, asked: true } : t));
        setTriviaBank(nextBank);
        updateBank('trivia', nextBank).catch(() => {});
        logActivity(roomCode, 'HOST', 'started Trivia round.', 'GAME');
        toast('Trivia started');
        setShowGameConfig(false);
    };

    const launchWyr = async (item) => {
        if (!item) return;
        await updateRoom({
            activeMode: 'wyr',
            wyrData: { question: item.q, optionA: item.a, optionB: item.b, id: Date.now().toString(), rewarded: false, points: item.points || 50 },
            ...buildParticipantPayload(wyrParticipantMode, wyrParticipantMode === 'selected' ? wyrParticipants : [])
        });
        const nextBank = wyrBank.map(w => (w.id === item.id ? { ...w, asked: true } : w));
        setWyrBank(nextBank);
        updateBank('wyr', nextBank).catch(() => {});
        logActivity(roomCode, 'HOST', 'started Would You Rather.', 'GAME');
        toast('Would You Rather started');
        setShowGameConfig(false);
    };

    const startBingo = async (board) => {
        if (!board?.tiles?.length) return;
        const size = board.size || Math.sqrt(board.tiles.length) || 5;
        const mode = board.mode || (board.tiles[0]?.type || 'karaoke');
        const bingoSessionId = `bingo_${Date.now()}`;
        const initialRevealed = buildInitialBingoRevealed(board.tiles);
        const participantPayload = mode === 'mystery'
            ? buildParticipantPayload(bingoParticipantMode, bingoParticipantMode === 'selected' ? bingoParticipants : [])
            : buildParticipantPayload('all', []);
        await updateRoom({
            activeMode: 'bingo',
            bingoData: board.tiles,
            bingoSize: size,
            bingoMode: mode,
            bingoSessionId,
            bingoBoardId: board.id || null,
            bingoVictory: board.victory || null,
            bingoWin: null,
            bingoRevealed: initialRevealed,
            bingoSuggestions: {},
            bingoVotingMode: mode === 'mystery' ? 'host' : (room?.bingoVotingMode || 'host+votes'),
            bingoAutoApprovePct: typeof room?.bingoAutoApprovePct === 'number' ? room.bingoAutoApprovePct : 50,
            bingoShowTv: room?.bingoShowTv !== false,
            bingoMysteryRng: mode === 'mystery'
                ? {
                    active: true,
                    finalized: false,
                    startTime: Date.now(),
                    durationSec: 12,
                    includeHost: !!room?.bingoIncludeHost,
                    results: {}
                }
                : null,
            bingoTurnPick: null,
            bingoTurnOrder: mode === 'mystery' ? [] : null,
            bingoTurnIndex: mode === 'mystery' ? 0 : null,
            bingoPickerUid: mode === 'mystery' ? null : null,
            bingoPickerName: mode === 'mystery' ? null : null,
            bingoFocus: null,
            ...participantPayload
        });
        logActivity(roomCode, 'HOST', 'started Bingo.', 'GAME');
        toast('Bingo started');
        setShowGameConfig(false);
    };


    const startRandomTrivia = () => {
        if (!filteredTrivia.length) return toast('No trivia questions available');
        const pick = filteredTrivia[Math.floor(Math.random() * filteredTrivia.length)];
        launchTrivia(pick);
    };

    const startRandomWyr = () => {
        if (!filteredWyr.length) return toast('No WYR prompts available');
        const pick = filteredWyr[Math.floor(Math.random() * filteredWyr.length)];
        launchWyr(pick);
    };

    
    const filteredTrivia = useMemo(() => {
        const q = triviaFilter.trim().toLowerCase();
        return triviaBank.filter(t => !q || `${t.q} ${t.correct} ${t.w1} ${t.w2} ${t.w3}`.toLowerCase().includes(q));
    }, [triviaBank, triviaFilter]);

    const filteredWyr = useMemo(() => {
        const q = wyrFilter.trim().toLowerCase();
        return wyrBank.filter(w => !q || `${w.q} ${w.a} ${w.b}`.toLowerCase().includes(q));
    }, [wyrBank, wyrFilter]);

    const startHostSubscriptionCheckout = async () => {
        if (subscriptionCheckoutLoading) return;
        setSubscriptionCheckoutLoading(true);
        try {
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const payload = await callFunction('createSubscriptionCheckout', {
                planId: 'host_monthly',
                origin
            });
            if (payload?.url) {
                window.location.href = payload.url;
                return;
            }
            toast('Subscription checkout is unavailable right now.');
        } catch (e) {
            console.error('Subscription checkout failed', e);
            toast('Could not open subscription checkout.');
        } finally {
            setSubscriptionCheckoutLoading(false);
        }
    };

    useEffect(() => {
        const rng = room?.bingoMysteryRng;
        if (!rng?.active || rng?.finalized || room?.bingoMode !== 'mystery') return;
        const start = rng.startTime || Date.now();
        const durationMs = Math.max(4000, Number(rng.durationSec || 12) * 1000);
        if (Date.now() < start + durationMs) return;
        if (bingoRngFinalizeRef.current === start) return;
        bingoRngFinalizeRef.current = start;
        const participantMode = room?.gameParticipantMode === 'selected' ? 'selected' : 'all';
        const participantUids = participantMode === 'selected' ? new Set(Array.isArray(room?.gameParticipants) ? room.gameParticipants : []) : null;
        const activeCutoff = Date.now() - 5 * 60 * 1000;
        const allScopedUsers = participantUids
            ? users.filter((u) => participantUids.has(u.uid))
            : users;
        const activeUsers = users.filter(u => {
            const ts = getTimestampMs(u.lastActiveAt || u.lastSeen);
            return ts && ts >= activeCutoff;
        });
        const scopedActiveUsers = participantUids
            ? activeUsers.filter((u) => participantUids.has(u.uid))
            : activeUsers;
        const results = rng.results || {};
        const resultsMap = { ...results };
        const resultList = Object.values(results);
        const makeEntry = (u) => ({
            uid: u.uid,
            name: u.name,
            avatar: u.avatar,
            value: Math.floor(Math.random() * 1000) + 1,
            at: Date.now()
        });
        let eligible = resultList.filter(r => scopedActiveUsers.some(u => u.uid === r.uid));
        if (rng.includeHost && room?.hostName) {
            const hostUser = users.find(u => u.uid === room?.hostUid || u.name === room.hostName);
            if (hostUser && !eligible.some(r => r.uid === hostUser.uid)) {
                const hostResult = makeEntry(hostUser);
                eligible = [...eligible, hostResult];
                resultsMap[hostUser.uid] = hostResult;
            }
        }
        if (!eligible.length) {
            eligible = scopedActiveUsers.map(u => {
                const entry = makeEntry(u);
                resultsMap[u.uid] = entry;
                return entry;
            });
        }
        // Fallback to full scoped roster so selected mystery rounds cannot stall when nobody is recently active.
        if (!eligible.length) {
            eligible = allScopedUsers.map((u) => {
                const entry = makeEntry(u);
                resultsMap[u.uid] = entry;
                return entry;
            });
        }
        // Last-resort fallback to all connected users if participant scope resolved to empty.
        if (!eligible.length) {
            eligible = users.map((u) => {
                const entry = makeEntry(u);
                resultsMap[u.uid] = entry;
                return entry;
            });
        }
        if (participantUids && participantUids.size && !eligible.length) {
            eligible = Array.from(participantUids).map((uid) => {
                const fromResult = resultList.find((r) => r.uid === uid);
                const fallback = fromResult || {
                    uid,
                    name: `Guest ${String(uid).slice(0, 4)}`,
                    avatar: '🎤',
                    value: Math.floor(Math.random() * 1000) + 1,
                    at: Date.now()
                };
                resultsMap[uid] = fallback;
                return fallback;
            });
        }
        const order = [...eligible]
            .sort((a, b) => (b.value || 0) - (a.value || 0) || String(a.name || '').localeCompare(String(b.name || '')))
            .map(r => r.uid);
        bingoRngAppendRef.current = { startTime: start, uids: new Set(order) };
        updateRoom({
            bingoMysteryRng: { ...rng, active: false, finalized: true, results: resultsMap, order, finishedAt: Date.now() },
            bingoTurnOrder: order,
            bingoTurnIndex: 0,
            bingoPickerUid: order[0] || null
        });
    }, [room?.bingoMysteryRng?.active, room?.bingoMysteryRng?.startTime, room?.bingoMysteryRng?.durationSec, room?.bingoMysteryRng?.finalized, room?.bingoMode, room?.bingoIncludeHost, room?.hostUid, room?.hostName, room?.gameParticipantMode, room?.gameParticipants, users, room?.bingoMysteryRng, updateRoom]);

    useEffect(() => {
        const rng = room?.bingoMysteryRng;
        const order = Array.isArray(room?.bingoTurnOrder) ? room.bingoTurnOrder : [];
        if (!rng?.finalized || room?.bingoMode !== 'mystery' || !order.length) return;
        const results = rng.results || {};
        const known = bingoRngAppendRef.current.startTime === rng.startTime
            ? bingoRngAppendRef.current.uids
            : new Set(order);
        const appendList = Object.values(results)
            .map(r => r.uid)
            .filter(uid => uid && !known.has(uid));
        if (!appendList.length) return;
        const nextOrder = [...order, ...appendList];
        bingoRngAppendRef.current = { startTime: rng.startTime, uids: new Set(nextOrder) };
        updateRoom({
            bingoTurnOrder: nextOrder,
            bingoMysteryRng: { ...(rng || {}), results: rng?.results || {}, order: nextOrder }
        });
    }, [room?.bingoMysteryRng?.results, room?.bingoMysteryRng?.finalized, room?.bingoMysteryRng?.startTime, room?.bingoMode, room?.bingoTurnOrder, room?.bingoMysteryRng, updateRoom]);

    useEffect(() => {
        if (room?.activeMode !== 'bingo') return;
        if (room?.bingoWin?.type) return;
        const tiles = Array.isArray(room?.bingoData) ? room.bingoData : [];
        if (!tiles.length) return;
        const size = Number(room?.bingoSize || Math.sqrt(tiles.length) || 5);
        const detected = detectBingoWin({
            tiles,
            size,
            revealed: room?.bingoRevealed || {},
            victory: room?.bingoVictory || defaultBingoVictory()
        });
        if (!detected) return;
        const sessionId = String(room?.bingoSessionId || room?.bingoBoardId || 'bingo');
        const resolveKey = `${sessionId}:${detected.type}`;
        if (bingoWinResolveRef.current === resolveKey) return;
        bingoWinResolveRef.current = resolveKey;

        const finalizeWin = async () => {
            const rewardPoints = parseRewardPoints(detected.reward);
            const now = Date.now();
            const winnerUid = room?.bingoMode === 'mystery'
                ? (room?.bingoTurnPick?.pickerUid || room?.bingoPickerUid || null)
                : null;
            const winnerName = winnerUid
                ? (users.find((u) => u.uid === winnerUid)?.name || room?.bingoPickerName || 'Picker')
                : null;
            const bingoWinPayload = {
                type: detected.type,
                label: detected.label,
                reward: detected.reward || '',
                rewardPoints,
                detectedAt: now,
                mode: room?.bingoMode || 'karaoke',
                winnerUid,
                winnerName
            };
            const updatePayload = { bingoWin: bingoWinPayload };

            if (rewardPoints > 0) {
                if (room?.bingoMode === 'mystery' && winnerUid && typeof callFunction === 'function') {
                    try {
                        await callFunction('awardRoomPoints', { roomCode, awards: [{ uid: winnerUid, points: rewardPoints }] });
                        updatePayload.bingoWin = {
                            ...bingoWinPayload,
                            awardedAt: Date.now(),
                            awardedPoints: rewardPoints,
                            awardMode: 'direct'
                        };
                        logActivity(roomCode, 'HOST', `awarded ${rewardPoints} pts to ${winnerName || 'picker'} for Mystery Bingo.`, 'GAME');
                    } catch (err) {
                        console.error('Bingo direct reward failed', err);
                        updatePayload.bingoWin = {
                            ...bingoWinPayload,
                            awardMode: 'failed',
                            awardError: 'Could not award winner points'
                        };
                    }
                } else {
                    updatePayload.bonusDrop = {
                        id: now,
                        by: `Bingo ${detected.label}`,
                        points: rewardPoints
                    };
                    updatePayload.bingoWin = {
                        ...bingoWinPayload,
                        awardedAt: now,
                        awardedPoints: rewardPoints,
                        awardMode: 'room_bonus'
                    };
                }
            }

            try {
                await updateRoom(updatePayload);
                logActivity(roomCode, 'HOST', `Bingo win: ${detected.label}.`, 'GAME');
                toast(`Bingo! ${detected.label}`);
            } catch (err) {
                console.error('Failed to write bingo win', err);
                bingoWinResolveRef.current = '';
            }
        };
        finalizeWin();
    }, [
        room?.activeMode,
        room?.bingoData,
        room?.bingoSize,
        room?.bingoRevealed,
        room?.bingoVictory,
        room?.bingoWin,
        room?.bingoMode,
        room?.bingoTurnPick,
        room?.bingoPickerUid,
        room?.bingoPickerName,
        room?.bingoSessionId,
        room?.bingoBoardId,
        users,
        callFunction,
        roomCode,
        logActivity,
        toast,
        updateRoom
    ]);

    return (
        <div className="h-full overflow-y-auto custom-scrollbar pr-2 flex flex-col">
            {/* Header */}
            <div className="px-8 pt-6 pb-0">
                <div className="flex items-center gap-3 text-sm uppercase tracking-[0.4em] text-zinc-500">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 border border-white/10">
                        <i className="fa-solid fa-gamepad text-cyan-300 text-xs"></i>
                    </span>
                    Game Launchpad
                </div>
                <h2 className="text-3xl font-bold text-white mt-3">Launch a crowd moment</h2>
                <div className="mt-3 h-px w-32 bg-gradient-to-r from-cyan-400/80 via-pink-500/70 to-transparent"></div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${canUseAiGeneration ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/40 bg-amber-500/10 text-amber-200'}`}>
                        <i className={`fa-solid ${canUseAiGeneration ? 'fa-bolt' : 'fa-lock'}`}></i>
                        {canUseAiGeneration ? 'AI tools enabled for this org' : aiGateMessage}
                    </div>
                    {!canUseAiGeneration && !entitlementStatus?.loading && (
                        <button
                            onClick={startHostSubscriptionCheckout}
                            disabled={subscriptionCheckoutLoading}
                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-2 text-xs ${subscriptionCheckoutLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {subscriptionCheckoutLoading ? 'Opening checkout...' : 'Upgrade for AI'}
                        </button>
                    )}
                </div>
                {activeGameLabel && (
                    <div className="mt-4 flex flex-wrap items-center justify-between bg-zinc-900/70 border border-white/10 rounded-2xl px-4 py-3 gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">Active Game</div>
                            <div className="text-sm font-bold text-white">{activeGameLabel}</div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={triggerGameRules} className={`${STYLES.btnStd} ${STYLES.btnNeutral} px-3 py-1 text-[10px]`}>
                                <i className="fa-solid fa-circle-question mr-1"></i> Show Rules
                            </button>
                            <button onClick={stopGame} className={`${STYLES.btnStd} ${STYLES.btnDanger} px-3 py-1 text-[10px]`}>
                                <i className="fa-solid fa-stop mr-1"></i> Stop
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Game Grid */}
            <div className="px-8 py-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {GAMES_META.map(game => {
                        const config = participantConfigs[game.id];
                        return (
                            <GameCardItem
                                key={game.id}
                                game={game}
                                room={room}
                                users={sortedUsers}
                                onLaunch={startGame}
                                onStop={stopGame}
                                participantConfig={config}
                                smartDefaults={getSmartDefaults(game.id, config)}
                                onQuickLaunch={() => quickLaunchGame(game.id, config)}
                                onPreview={() => toggleGamePreview(game.id)}
                                previewActive={room?.gamePreviewId === game.id}
                                onSelectAll={() => {
                                    if (!config) return;
                                    if (config.setMode) config.setMode('all');
                                    if (config.setParticipants) config.setParticipants([]);
                                }}
                                onSelectParticipants={() => {
                                    if (config?.setMode) config.setMode('selected');
                                }}
                                infoBadges={getGameBadges(game)}
                            />
                        );
                    })}
                </div>
            </div>
            
            {/* Configuration Modals */}
            {showGameConfig && <GameConfigModal 
                selectedGame={selectedGameForConfig}
                room={room}
                users={users}
                updateRoom={updateRoom}
                roomCode={roomCode}
                onClose={() => setShowGameConfig(false)}
                selectedSingerId={selectedSingerId}
                setSelectedSingerId={setSelectedSingerId}
                sortedUsers={sortedUsers}
                scaleDurationSec={scaleDurationSec}
                setScaleDurationSec={setScaleDurationSec}
                scaleMaxStrikes={scaleMaxStrikes}
                setScaleMaxStrikes={setScaleMaxStrikes}
                scaleRewardPerRound={scaleRewardPerRound}
                setScaleRewardPerRound={setScaleRewardPerRound}
                scaleDifficulty={scaleDifficulty}
                setScaleDifficulty={setScaleDifficulty}
                scaleGuideTone={scaleGuideTone}
                setScaleGuideTone={setScaleGuideTone}
                scaleParticipants={scaleParticipants}
                setScaleParticipants={setScaleParticipants}
                onStartFlappyAmbient={startFlappyAmbient}
                onStartFlappySolo={startFlappySolo}
                onStartVocalAmbient={startVocalAmbient}
                onStartVocalSolo={startVocalSolo}
                onStartRidingCrowd={startRidingScalesCrowd}
                onStartRidingTurns={startRidingScalesTurns}
                doodlePromptsText={doodlePromptsText}
                setDoodlePromptsText={setDoodlePromptsText}
                doodleDuration={doodleDuration}
                setDoodleDuration={setDoodleDuration}
                doodleGuessDuration={doodleGuessDuration}
                setDoodleGuessDuration={setDoodleGuessDuration}
                doodleParticipants={doodleParticipants}
                setDoodleParticipants={setDoodleParticipants}
                doodleRoundRobin={doodleRoundRobin}
                setDoodleRoundRobin={setDoodleRoundRobin}
                doodleAiTopic={doodleAiTopic}
                setDoodleAiTopic={setDoodleAiTopic}
                doodleAiLoading={doodleAiLoading}
                setDoodleAiLoading={setDoodleAiLoading}
                doodleCustomPrompt={doodleCustomPrompt}
                setDoodleCustomPrompt={setDoodleCustomPrompt}
                onStartDoodleOke={startDoodleOke}
                selfieChallengeParticipants={selfieChallengeParticipants}
                setSelfieChallengeParticipants={setSelfieChallengeParticipants}
                selfiePrompt={selfiePrompt}
                setSelfiePrompt={setSelfiePrompt}
                selfieRequireApproval={selfieRequireApproval}
                setSelfieRequireApproval={setSelfieRequireApproval}
                selfieAutoStartVoting={selfieAutoStartVoting}
                setSelfieAutoStartVoting={setSelfieAutoStartVoting}
                selfieAiLoading={selfieAiLoading}
                setSelfieAiLoading={setSelfieAiLoading}
                onStartSelfieChallenge={startSelfieChallenge}
                generateSelfieChallengePrompt={generateSelfieChallengePrompt}
                generateAIContent={generateAIContent}
                triviaFilter={triviaFilter}
                setTriviaFilter={setTriviaFilter}
                wyrFilter={wyrFilter}
                setWyrFilter={setWyrFilter}
                filteredTrivia={filteredTrivia}
                filteredWyr={filteredWyr}
                selectedTriviaId={selectedTriviaId}
                setSelectedTriviaId={setSelectedTriviaId}
                selectedWyrId={selectedWyrId}
                setSelectedWyrId={setSelectedWyrId}
                onStartTrivia={launchTrivia}
                onStartWyr={launchWyr}
                onStartRandomTrivia={startRandomTrivia}
                onStartRandomWyr={startRandomWyr}
                triviaAiTopic={triviaAiTopic}
                setTriviaAiTopic={setTriviaAiTopic}
                triviaAiLoading={triviaAiLoading}
                onAppendTriviaFromAI={appendTriviaFromAI}
                wyrAiTopic={wyrAiTopic}
                setWyrAiTopic={setWyrAiTopic}
                wyrAiLoading={wyrAiLoading}
                onAppendWyrFromAI={appendWyrFromAI}
                triviaParticipants={triviaParticipants}
                setTriviaParticipants={setTriviaParticipants}
                triviaParticipantMode={triviaParticipantMode}
                setTriviaParticipantMode={setTriviaParticipantMode}
                triviaRoundSec={triviaRoundSec}
                setTriviaRoundSec={setTriviaRoundSec}
                triviaAutoReveal={triviaAutoReveal}
                setTriviaAutoReveal={setTriviaAutoReveal}
                wyrParticipants={wyrParticipants}
                setWyrParticipants={setWyrParticipants}
                wyrParticipantMode={wyrParticipantMode}
                setWyrParticipantMode={setWyrParticipantMode}
                bingoBoards={bingoBoards}
                onStartBingo={startBingo}
                bingoParticipants={bingoParticipants}
                setBingoParticipants={setBingoParticipants}
                bingoParticipantMode={bingoParticipantMode}
                setBingoParticipantMode={setBingoParticipantMode}
                callFunction={callFunction}
                toast={toast}
                setBingoBoards={setBingoBoards}
                vocalDurationSec={vocalDurationSec}
                setVocalDurationSec={setVocalDurationSec}
                vocalDifficulty={vocalDifficulty}
                setVocalDifficulty={setVocalDifficulty}
                vocalGuideTone={vocalGuideTone}
                setVocalGuideTone={setVocalGuideTone}
                vocalParticipants={vocalParticipants}
                setVocalParticipants={setVocalParticipants}
                canUseAiGeneration={canUseAiGeneration}
                aiGateMessage={aiGateMessage}
                bracketBusy={bracketBusy}
                onCreateSweet16Bracket={onCreateSweet16Bracket}
                onQueueNextBracketMatch={onQueueNextBracketMatch}
                onClearSweet16Bracket={onClearSweet16Bracket}
                onSetBracketMatchWinner={onSetBracketMatchWinner}
                onSetBracketWinnerFromCrowdVotes={onSetBracketWinnerFromCrowdVotes}
                onToggleBracketCrowdVoting={onToggleBracketCrowdVoting}
                onForfeitBracketContestant={onForfeitBracketContestant}
                bracketSeedUids={bracketSeedUids}
                setBracketSeedUids={setBracketSeedUids}
                bracketSeedRandomize={bracketSeedRandomize}
                setBracketSeedRandomize={setBracketSeedRandomize}
                bracketCandidates={bracketCandidates}
            />}
        </div>
    );
};

const GameCardItem = ({ game, room, users, onLaunch, onStop, participantConfig, onSelectAll, onSelectParticipants, infoBadges, smartDefaults, onQuickLaunch, onPreview, previewActive }) => {
    const colorMap = {
        cyan: { border: 'border-cyan-400/30', badge: 'bg-cyan-500/10 border-cyan-400/30 text-cyan-200', text: 'text-cyan-300' },
        pink: { border: 'border-pink-400/30', badge: 'bg-pink-500/10 border-pink-400/30 text-pink-200', text: 'text-pink-300' },
        amber: { border: 'border-amber-400/30', badge: 'bg-amber-500/10 border-amber-400/30 text-amber-200', text: 'text-amber-300' },
        emerald: { border: 'border-emerald-400/30', badge: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200', text: 'text-emerald-300' },
        rose: { border: 'border-rose-400/30', badge: 'bg-rose-500/10 border-rose-400/30 text-rose-200', text: 'text-rose-300' },
    };
    const c = colorMap[game.color] || colorMap.cyan;
    const isActive = room?.activeMode === game.id;
    const [showPicker, setShowPicker] = useState(false);
    const playerCount = participantConfig?.count || 0;
    const playerLabel = participantConfig
        ? (participantConfig.mode === 'selected' && playerCount ? `Players: ${playerCount}` : 'Players: All')
        : 'Players: All';
    const toggleParticipant = (uid) => {
        if (!participantConfig?.setParticipants) return;
        participantConfig.setMode?.('selected');
        participantConfig.setParticipants(prev => (prev.includes(uid) ? prev.filter(v => v !== uid) : [...prev, uid]));
    };
    
    return (
        <div className={`relative overflow-hidden bg-gradient-to-b from-zinc-900/80 to-zinc-950 border ${c.border} rounded-2xl p-3 md:p-4 flex flex-col gap-2 md:gap-3 shadow-lg hover:shadow-xl transition-all`}>
            <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full blur-2xl opacity-10 bg-white"></div>
            <div className="absolute -left-4 bottom-0 w-16 h-16 rounded-full blur-2xl opacity-5 bg-white"></div>
            <div className="flex items-start justify-between relative z-10">
                <div>
                    <div className="text-2xl md:text-3xl mb-1">{game.icon}</div>
                    <h3 className={`text-lg md:text-xl font-bold ${c.text} mb-1`}>{game.name}</h3>
                    <p className="text-xs text-zinc-400 max-w-xs">{game.description}</p>
                </div>
                {game.badge && (
                    <span className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-full border ${c.badge} flex-shrink-0`}>
                        {game.badge}
                    </span>
                )}
            </div>
            <div className="space-y-1 text-xs text-zinc-300 relative z-10">
                {game.goal && (
                    <div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">Goal</div>
                        <div className="text-xs text-zinc-200">{game.goal}</div>
                    </div>
                )}
                {game.howToPlay && (
                    <div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">How to play</div>
                        <div className="text-xs text-zinc-200">{game.howToPlay}</div>
                    </div>
                )}
            </div>
            {isActive && (
                <div className="text-[11px] text-white bg-red-600 px-3 py-2 rounded-lg border border-red-500 font-bold animate-pulse">
                    🔴 LIVE NOW
                </div>
            )}
            <div className="grid grid-cols-2 gap-2 relative z-10">
                <div className="bg-black/40 border border-white/10 rounded-xl p-2">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Type</div>
                    <div className="text-xs font-bold text-white capitalize">{game.category}</div>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-xl p-2">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500">Voice</div>
                    <div className="text-xs font-bold text-white">{game.needsVoice ? 'Yes' : 'No'}</div>
                </div>
            </div>
            {Array.isArray(infoBadges) && infoBadges.length > 0 && (
                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-zinc-400 relative z-10">
                    {infoBadges.map((badge) => (
                        <span key={badge.label} className={`px-2 py-1 rounded-full border ${badge.tone}`}>
                            {badge.label}
                        </span>
                    ))}
                </div>
            )}
            {smartDefaults && (
                <div className="flex items-center justify-between gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] uppercase tracking-widest text-zinc-300 relative z-10">
                    <span>Smart Defaults</span>
                    <span className="text-zinc-400 normal-case">{smartDefaults}</span>
                </div>
            )}
            {participantConfig ? (
                <div className="relative z-10">
                    <button
                        onClick={() => setShowPicker(v => !v)}
                        className={`${STYLES.btnStd} ${participantConfig.mode === 'selected' ? STYLES.btnHighlight : STYLES.btnSecondary} w-full py-2 text-xs justify-between`}
                    >
                        <span>{playerLabel}</span>
                        <i className={`fa-solid fa-chevron-${showPicker ? 'up' : 'down'}`}></i>
                    </button>
                    {showPicker && (
                        <div className="mt-2 bg-black/40 border border-white/10 rounded-xl p-2 space-y-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={onSelectAll}
                                    className={`${STYLES.btnStd} ${participantConfig.mode === 'all' ? STYLES.btnHighlight : STYLES.btnSecondary} flex-1 py-2 text-xs`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={onSelectParticipants}
                                    className={`${STYLES.btnStd} ${participantConfig.mode === 'selected' ? STYLES.btnHighlight : STYLES.btnSecondary} flex-1 py-2 text-xs`}
                                >
                                    Select
                                </button>
                            </div>
                            {participantConfig.mode === 'selected' && (
                                <>
                                    <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto custom-scrollbar">
                                        {users.map(u => {
                                            const uid = u.id.split('_')[1];
                                            const selectedIds = participantConfig?.participants || [];
                                            const isSelected = selectedIds.includes(uid);
                                            return (
                                                <button
                                                    key={u.id}
                                                    onClick={() => toggleParticipant(uid)}
                                                    className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-left text-xs ${isSelected ? 'border-[#00C4D9] bg-[#00C4D9]/10' : 'border-zinc-700 bg-zinc-900/60'}`}
                                                >
                                                    <span className="text-lg">{u.avatar || 'O'}</span>
                                                    <span className="text-zinc-200 truncate">{u.name || 'Singer'}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => participantConfig?.setParticipants?.(users.map(u => u.id.split('_')[1]))} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-xs`}>Select all</button>
                                        <button onClick={() => participantConfig?.setParticipants?.([])} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-xs`}>Clear</button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="h-9"></div>
            )}
            <div className="flex gap-2 relative z-10">
                <button onClick={() => onLaunch(game.id)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm md:text-base`}>
                    <i className="fa-solid fa-sliders mr-1"></i> Configure
                </button>
                <button onClick={onQuickLaunch} className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1 py-2 text-sm md:text-base`}>
                    <i className="fa-solid fa-bolt mr-1"></i> Quick Launch
                </button>
            </div>
            <div className="flex gap-2 relative z-10">
                <button
                    onClick={onPreview}
                    className={`${STYLES.btnStd} ${previewActive ? STYLES.btnHighlight : STYLES.btnSecondary} flex-1 py-2 text-xs`}
                >
                    <i className="fa-solid fa-tv mr-1"></i> Preview on TV
                </button>
                {isActive && (
                    <button onClick={onStop} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3`} title="Stop">
                        <i className="fa-solid fa-stop"></i>
                    </button>
                )}
            </div>
        </div>
    );
};

const ParticipantSelector = ({ mode, setMode, participants, setParticipants, users }) => {
    const toggle = (uid) => {
        setParticipants(prev => (prev.includes(uid) ? prev.filter(v => v !== uid) : [...prev, uid]));
    };
    return (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="text-xs uppercase tracking-widest text-zinc-500">Participants</div>
            <div className="flex gap-2">
                <button
                    onClick={() => { setMode('all'); setParticipants([]); }}
                    className={`${STYLES.btnStd} ${mode === 'all' ? STYLES.btnPrimary : STYLES.btnSecondary} flex-1 py-2 text-sm`}
                >
                    All
                </button>
                <button
                    onClick={() => setMode('selected')}
                    className={`${STYLES.btnStd} ${mode === 'selected' ? STYLES.btnPrimary : STYLES.btnSecondary} flex-1 py-2 text-sm`}
                >
                    Selected
                </button>
            </div>
            {mode === 'selected' ? (
                <>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {users.map(u => {
                            const uid = u.id.split('_')[1];
                            const selected = participants.includes(uid);
                            return (
                                <button
                                    key={u.id}
                                    onClick={() => toggle(uid)}
                                    className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-left text-xs ${selected ? 'border-[#00C4D9] bg-[#00C4D9]/10' : 'border-zinc-700 bg-zinc-900/60'}`}
                                >
                                    <span className="text-lg">{u.avatar || 'O'}</span>
                                    <span className="text-zinc-200 truncate">{u.name || 'Singer'}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setParticipants(users.map(u => u.id.split('_')[1]))} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>Select all</button>
                        <button onClick={() => setParticipants([])} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>Clear</button>
                    </div>
                </>
            ) : (
                <div className="text-xs text-zinc-500">Everyone in the room can play.</div>
            )}
        </div>
    );
};

const BingoManager = ({
    roomCode,
    room,
    updateRoom,
    generateAIContent,
    callFunction,
    toast,
    bingoBoards,
    setBingoBoards,
    onStartBingo,
    canUseAiGeneration,
    aiGateMessage
}) => {
    const [newBoardForm, setNewBoardForm] = useState({ title: '', size: '5', mode: 'karaoke', victory: defaultBingoVictory() });
    const [bingoBoard, setBingoBoard] = useState([]);
    const [activeBoardId, setActiveBoardId] = useState(null);
    const [editTile, setEditTile] = useState(null);
    const [victoryDraft, setVictoryDraft] = useState(defaultBingoVictory());
    const [aiLoading, setAiLoading] = useState(false);
    const seededPresets = useRef(false);
    const itunesBackoffUntil = useRef(0);
    const itunesLoadingRef = useRef(false);
    const suggestionCounts = room?.bingoSuggestions || {};
    const revealedMap = room?.bingoRevealed || {};
    const bingoVotingMode = room?.bingoVotingMode || 'host+votes';
    const bingoAutoApprovePct = typeof room?.bingoAutoApprovePct === 'number' ? room.bingoAutoApprovePct : 50;
    const bingoShowTv = room?.bingoShowTv !== false;
    const isMysteryLive = room?.activeMode === 'bingo' && room?.bingoMode === 'mystery';
    const mysteryOrder = Array.isArray(room?.bingoTurnOrder) ? room.bingoTurnOrder : [];
    const mysteryTurnIndex = Math.max(0, Number(room?.bingoTurnIndex || 0));

    useEffect(() => {
        if (!roomCode || seededPresets.current) return;
        if (bingoBoards.length) return;
        seededPresets.current = true;
        setDoc(
            doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode),
            { bingo: PRESET_BINGO_BOARDS },
            { merge: true }
        ).then(() => setBingoBoards(PRESET_BINGO_BOARDS)).catch(() => {});
    }, [roomCode, bingoBoards, setBingoBoards]);

    const fetchItunesArt = async (title, artist) => {
        if (Date.now() < itunesBackoffUntil.current || itunesLoadingRef.current) return '';
        itunesLoadingRef.current = true;
        try {
            const data = await callFunction('itunesSearch', { term: `${title} ${artist || ''}`, limit: 1 });
            const art = data?.results?.[0]?.artworkUrl100?.replace('100x100', '600x600') || '';
            return art;
        } catch {
            itunesBackoffUntil.current = Date.now() + 15000;
            return '';
        } finally {
            itunesLoadingRef.current = false;
        }
    };

    const generateGrid = (size, mode) => {
        const tiles = [];
        const source = mode === 'mystery' ? MYSTERY_PRESETS.classics : KARAOKE_PRESETS.tropes;
        while (tiles.length < size * size) {
            const idx = tiles.length;
            const isFree = size % 2 === 1 && idx === Math.floor((size * size) / 2);
            const content = source[Math.floor(Math.random() * source.length)];
            tiles.push({
                id: idx,
                type: mode,
                text: mode === 'mystery' ? content.clue : (isFree ? 'FREE' : content),
                status: 'hidden',
                content: mode === 'mystery' ? content : null,
                free: isFree
            });
        }
        return tiles;
    };

    const createNewBoard = async () => {
        if (!newBoardForm.title.trim()) return toast('Enter a title');
        const size = [3, 5].includes(parseInt(newBoardForm.size, 10)) ? parseInt(newBoardForm.size, 10) : 5;
        const victory = normalizeBingoVictory(newBoardForm.victory);
        const tiles = generateGrid(size, newBoardForm.mode);
        const newBoard = { id: Date.now(), ...newBoardForm, size: String(size), victory, tiles };
        const updated = [...bingoBoards, newBoard];
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), { bingo: updated });
        setBingoBoards(updated);
        setBingoBoard(tiles);
        setActiveBoardId(newBoard.id);
        setVictoryDraft(victory);
        toast('Board created');
    };

    const handleAIGenerateBoard = async () => {
        if (!canUseAiGeneration) {
            toast(aiGateMessage);
            return;
        }
        if (!newBoardForm.title.trim()) return toast('Enter a theme title first');
        setAiLoading(true);
        try {
            const size = [3, 5].includes(parseInt(newBoardForm.size, 10)) ? parseInt(newBoardForm.size, 10) : 5;
            const content = await generateAIContent('bingo_board', { title: newBoardForm.title, size, mode: newBoardForm.mode });
            if (!Array.isArray(content)) {
                toast('AI generation failed');
                return;
            }
            const tiles = [];
            for (let i = 0; i < size * size; i += 1) {
                const isFree = size % 2 === 1 && i === Math.floor((size * size) / 2);
                const item = content[i % content.length];
                if (newBoardForm.mode === 'mystery') {
                    const title = item.title || 'Unknown';
                    const artist = item.artist || 'Unknown';
                    const art = await fetchItunesArt(title, artist);
                    tiles.push({ id: i, type: 'mystery', text: item.clue || 'Unknown', status: 'hidden', content: { title, artist, art }, free: false });
                } else {
                    tiles.push({ id: i, type: 'karaoke', text: isFree ? 'FREE' : (typeof item === 'string' ? item : 'Karaoke moment'), status: 'hidden', content: null, free: isFree });
                }
            }
            const victory = normalizeBingoVictory(newBoardForm.victory);
            const newBoard = { id: Date.now(), ...newBoardForm, size: String(size), victory, tiles };
            const updated = [...bingoBoards, newBoard];
            await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), { bingo: updated });
            setBingoBoards(updated);
            setBingoBoard(tiles);
            setActiveBoardId(newBoard.id);
            setVictoryDraft(victory);
            toast('AI board created');
        } finally {
            setAiLoading(false);
        }
    };

    const loadBoard = (board) => {
        setBingoBoard(board.tiles);
        setActiveBoardId(board.id);
        setVictoryDraft(normalizeBingoVictory(board.victory || defaultBingoVictory()));
    };

    const saveBoardEdits = async () => {
        if (!activeBoardId) return;
        const updated = bingoBoards.map(b => (String(b.id) === String(activeBoardId) ? { ...b, tiles: bingoBoard, victory: victoryDraft } : b));
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), { bingo: updated });
        setBingoBoards(updated);
        toast('Board saved');
    };

    const deleteBoard = async (id) => {
        const updated = bingoBoards.filter(b => String(b.id) !== String(id));
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'host_libraries', roomCode), { bingo: updated });
        setBingoBoards(updated);
        if (String(activeBoardId) === String(id)) {
            setActiveBoardId(null);
            setBingoBoard([]);
        }
    };

    const updateTile = (idx, next) => {
        const updated = [...bingoBoard];
        updated[idx] = { ...updated[idx], ...next };
        setBingoBoard(updated);
    };

    const approveSuggestion = async (idx) => {
        await updateRoom({
            [`bingoRevealed.${idx}`]: true,
            [`bingoSuggestions.${idx}.approvedAt`]: serverTimestamp()
        });
        toast('Tile approved');
    };

    const clearSuggestion = async (idx) => {
        await updateRoom({
            [`bingoSuggestions.${idx}.count`]: 0,
            [`bingoSuggestions.${idx}.lastNote`]: '',
            [`bingoSuggestions.${idx}.lastAt`]: null
        });
        toast('Votes cleared');
    };

    const skipMysteryPicker = async () => {
        if (!isMysteryLive) return;
        if (!mysteryOrder.length) {
            toast('No picker order yet.');
            return;
        }
        const nextIndex = (mysteryTurnIndex + 1) % mysteryOrder.length;
        await updateRoom({
            bingoTurnIndex: nextIndex,
            bingoPickerUid: mysteryOrder[nextIndex] || null,
            bingoTurnPick: null
        });
        toast('Advanced to next picker.');
    };

    const unlockMysteryTurn = async () => {
        if (!isMysteryLive) return;
        await updateRoom({ bingoTurnPick: null });
        toast('Turn unlocked.');
    };

    const rerollMysteryOrder = async () => {
        if (room?.activeMode !== 'bingo' || room?.bingoMode !== 'mystery') {
            toast('Start a mystery bingo round first.');
            return;
        }
        await updateRoom({
            bingoMysteryRng: {
                ...(room?.bingoMysteryRng || {}),
                active: true,
                finalized: false,
                startTime: Date.now(),
                durationSec: Math.max(8, Number(room?.bingoMysteryRng?.durationSec || 12)),
                results: {},
                order: []
            },
            bingoTurnOrder: [],
            bingoTurnIndex: 0,
            bingoPickerUid: null,
            bingoPickerName: null,
            bingoTurnPick: null
        });
        toast('Mystery order reset. Spinning again...');
    };

    return (
        <div className="space-y-4">
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="text-xs uppercase tracking-widest text-zinc-500">Bingo settings</div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                    <button
                        onClick={() => updateRoom({ bingoShowTv: !bingoShowTv })}
                        className={`${STYLES.btnStd} ${bingoShowTv ? STYLES.btnPrimary : STYLES.btnSecondary} px-3 py-2 text-sm`}
                    >
                        <i className="fa-solid fa-tv mr-2"></i>
                        TV Board {bingoShowTv ? 'On' : 'Off'}
                    </button>
                    {room?.bingoMode === 'mystery' ? (
                        <>
                            <button
                                onClick={() => updateRoom({ bingoIncludeHost: !room?.bingoIncludeHost })}
                                className={`${STYLES.btnStd} ${room?.bingoIncludeHost ? STYLES.btnPrimary : STYLES.btnSecondary} px-3 py-2 text-sm`}
                            >
                                <i className="fa-solid fa-user-crown mr-2"></i>
                                Include Host {room?.bingoIncludeHost ? 'On' : 'Off'}
                            </button>
                            <button
                                onClick={unlockMysteryTurn}
                                disabled={!room?.bingoTurnPick?.pickerUid}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-2 text-sm ${!room?.bingoTurnPick?.pickerUid ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <i className="fa-solid fa-lock-open mr-2"></i>
                                Unlock Turn
                            </button>
                            <button
                                onClick={skipMysteryPicker}
                                disabled={!mysteryOrder.length}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-2 text-sm ${!mysteryOrder.length ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                <i className="fa-solid fa-forward-step mr-2"></i>
                                Skip Picker
                            </button>
                            <button
                                onClick={rerollMysteryOrder}
                                className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-3 py-2 text-sm`}
                            >
                                <i className="fa-solid fa-dice mr-2"></i>
                                Re-Spin Order
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => updateRoom({ bingoVotingMode: bingoVotingMode === 'host+votes' ? 'host' : 'host+votes' })}
                                className={`${STYLES.btnStd} ${bingoVotingMode === 'host+votes' ? STYLES.btnPrimary : STYLES.btnSecondary} px-3 py-2 text-sm`}
                            >
                                <i className="fa-solid fa-check mr-2"></i>
                                {bingoVotingMode === 'host+votes' ? 'Host + Votes' : 'Host Only'}
                            </button>
                            <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-700 rounded-xl px-3 py-2">
                                <span className="text-xs uppercase tracking-widest text-zinc-400">Auto approve</span>
                                <input
                                    type="number"
                                    min="10"
                                    max="100"
                                    value={bingoAutoApprovePct}
                                    onChange={(e) => updateRoom({ bingoAutoApprovePct: Math.max(10, Math.min(100, parseInt(e.target.value, 10) || 50)) })}
                                    className="w-20 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-xs text-white"
                                />
                                <span className="text-xs text-zinc-400">% voters</span>
                            </div>
                        </>
                    )}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    <input
                        value={room?.bingoSponsorName || ''}
                        onChange={(e) => updateRoom({ bingoSponsorName: e.target.value })}
                        className={`${STYLES.input} w-full`}
                        placeholder="Sponsor name (optional)"
                    />
                    <input
                        value={room?.bingoSponsorLogo || ''}
                        onChange={(e) => updateRoom({ bingoSponsorLogo: e.target.value })}
                        className={`${STYLES.input} w-full`}
                        placeholder="Sponsor logo URL (optional)"
                    />
                </div>
                {room?.bingoMode === 'mystery' && (
                    <div className="text-[10px] text-zinc-400">
                        {room?.bingoTurnPick?.pickerUid
                            ? `Current turn locked by ${room?.bingoPickerName || 'picker'} on tile #${Number(room?.bingoTurnPick?.index ?? -1) + 1}.`
                            : `Current picker: ${room?.bingoPickerName || 'Not assigned yet'}.`}
                    </div>
                )}
                <div className="text-[10px] text-zinc-500">
                    {room?.bingoMode === 'mystery'
                        ? 'Mystery mode is turn-based. Picker locks one tile, then performs to pass the turn.'
                        : 'Karaoke mode supports host moderation or auto-approve voting.'}
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-500">Create board</div>
                    <input
                        value={newBoardForm.title}
                        onChange={(e) => setNewBoardForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Board title"
                        className={`${STYLES.input} w-full`}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <select value={newBoardForm.size} onChange={(e) => setNewBoardForm(prev => ({ ...prev, size: e.target.value }))} className={`${STYLES.input}`}>
                            {['3', '5'].map(size => (<option key={size} value={size}>{size} x {size}</option>))}
                        </select>
                        <select value={newBoardForm.mode} onChange={(e) => setNewBoardForm(prev => ({ ...prev, mode: e.target.value }))} className={`${STYLES.input}`}>
                            <option value="karaoke">Karaoke Bingo</option>
                            <option value="mystery">Mystery</option>
                        </select>
                    </div>
                    <div className="text-xs uppercase tracking-widest text-zinc-500">Victory rules</div>
                    {['line', 'corners', 'blackout'].map(rule => (
                        <label key={rule} className="flex items-center gap-2 text-xs text-zinc-300">
                            <input
                                type="checkbox"
                                checked={!!newBoardForm.victory?.[rule]?.enabled}
                                onChange={(e) => setNewBoardForm(prev => ({
                                    ...prev,
                                    victory: { ...prev.victory, [rule]: { ...prev.victory[rule], enabled: e.target.checked } }
                                }))}
                            />
                            <span className="capitalize">{rule}</span>
                            <input
                                value={newBoardForm.victory?.[rule]?.reward || ''}
                                onChange={(e) => setNewBoardForm(prev => ({
                                    ...prev,
                                    victory: { ...prev.victory, [rule]: { ...prev.victory[rule], reward: e.target.value } }
                                }))}
                                className={`${STYLES.input} flex-1`}
                                placeholder="Reward points"
                            />
                        </label>
                    ))}
                    <div className="flex gap-2">
                        <button onClick={createNewBoard} className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1 py-2 text-sm`}>Create</button>
                        <button
                            onClick={handleAIGenerateBoard}
                            disabled={aiLoading || !canUseAiGeneration}
                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm ${!canUseAiGeneration ? 'opacity-70 cursor-not-allowed' : ''}`}
                            title={canUseAiGeneration ? 'Generate board with AI' : aiGateMessage}
                        >
                            {aiLoading ? 'AI...' : 'AI Board'}
                        </button>
                    </div>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="text-xs uppercase tracking-widest text-zinc-500">Saved boards</div>
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {bingoBoards.map(board => (
                            <div key={board.id} className="flex items-center justify-between gap-2 bg-zinc-900/60 border border-zinc-700 rounded-xl p-3">
                                <div>
                                    <div className="text-sm text-white font-bold">{board.title}</div>
                                    <div className="text-[10px] text-zinc-500">{board.mode} • {formatBingoVictorySummary(board.victory)}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => loadBoard(board)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-2 py-1 text-[10px]`}>Load</button>
                                    <button onClick={() => onStartBingo(board)} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-2 py-1 text-[10px]`}>Start</button>
                                    <button onClick={() => deleteBoard(board.id)} className={`${STYLES.btnStd} ${STYLES.btnDanger} px-2 py-1 text-[10px]`} title="Delete">
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {!bingoBoards.length && <div className="text-xs text-zinc-500">No boards yet.</div>}
                    </div>
                </div>
            </div>

            {bingoBoard.length > 0 && (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-xs uppercase tracking-widest text-zinc-500">Loaded board</div>
                        <button onClick={saveBoardEdits} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-3 py-1 text-[10px]`}>Save changes</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {['line', 'corners', 'blackout'].map(rule => (
                            <label key={rule} className="flex items-center gap-2 text-[10px] text-zinc-300 bg-zinc-900/60 border border-zinc-800 rounded-lg p-2">
                                <input
                                    type="checkbox"
                                    checked={!!victoryDraft?.[rule]?.enabled}
                                    onChange={(e) => setVictoryDraft(prev => ({ ...prev, [rule]: { ...prev[rule], enabled: e.target.checked } }))}
                                />
                                <span className="capitalize">{rule}</span>
                                <input
                                    value={victoryDraft?.[rule]?.reward || ''}
                                    onChange={(e) => setVictoryDraft(prev => ({ ...prev, [rule]: { ...prev[rule], reward: e.target.value } }))}
                                    className={`${STYLES.input} flex-1`}
                                    placeholder="Reward"
                                />
                            </label>
                        ))}
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.sqrt(bingoBoard.length)}, minmax(0, 1fr))` }}>
                        {bingoBoard.map((tile, idx) => (
                            <button
                                key={tile.id || idx}
                                onClick={() => setEditTile({ idx, tile })}
                                className="bg-zinc-900/60 border border-zinc-700 rounded-lg p-2 text-[10px] text-zinc-200 text-center hover:border-cyan-400/40 relative"
                            >
                                {suggestionCounts?.[idx]?.count ? (
                                    <span className="absolute top-1 right-1 text-[9px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 border border-rose-400/40">
                                        {suggestionCounts[idx].count}
                                    </span>
                                ) : null}
                                {tile.text}
                                {revealedMap?.[idx] ? (
                                    <span className="block text-[9px] text-emerald-300 mt-1 uppercase tracking-widest">Approved</span>
                                ) : null}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] text-zinc-500">Click a tile to edit.</div>
                </div>
            )}

            {editTile && (
                <div className="fixed inset-0 z-[350] bg-black/80 flex items-center justify-center p-6">
                    <div className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-2xl p-6">
                        <div className="text-sm font-bold text-white mb-3">Edit tile</div>
                        <input
                            value={editTile.tile.text || ''}
                            onChange={(e) => setEditTile(prev => ({ ...prev, tile: { ...prev.tile, text: e.target.value } }))}
                            className={`${STYLES.input} w-full`}
                            placeholder="Tile text"
                        />
                        {editTile.tile.type === 'mystery' && (
                            <div className="mt-3 space-y-2">
                                <input
                                    value={editTile.tile.content?.title || ''}
                                    onChange={(e) => setEditTile(prev => ({ ...prev, tile: { ...prev.tile, content: { ...prev.tile.content, title: e.target.value } } }))}
                                    className={`${STYLES.input} w-full`}
                                    placeholder="Song title"
                                />
                                <input
                                    value={editTile.tile.content?.artist || ''}
                                    onChange={(e) => setEditTile(prev => ({ ...prev, tile: { ...prev.tile, content: { ...prev.tile.content, artist: e.target.value } } }))}
                                    className={`${STYLES.input} w-full`}
                                    placeholder="Artist"
                                />
                                <input
                                    value={editTile.tile.content?.art || ''}
                                    onChange={(e) => setEditTile(prev => ({ ...prev, tile: { ...prev.tile, content: { ...prev.tile.content, art: e.target.value } } }))}
                                    className={`${STYLES.input} w-full`}
                                    placeholder="Artwork URL (optional)"
                                />
                            </div>
                        )}
                        <div className="mt-4 bg-zinc-950/60 border border-zinc-800 rounded-xl p-3 space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Suggestions</div>
                            <div className="text-xs text-zinc-300">
                                Votes: <span className="text-white font-bold">{suggestionCounts?.[editTile.idx]?.count || 0}</span>
                            </div>
                            {suggestionCounts?.[editTile.idx]?.lastNote ? (
                                <div className="text-xs text-zinc-400 italic">“{suggestionCounts[editTile.idx].lastNote}”</div>
                            ) : (
                                <div className="text-[10px] text-zinc-500">No notes yet.</div>
                            )}
                            <div className="flex gap-2">
                                <button onClick={() => approveSuggestion(editTile.idx)} className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1 py-2 text-xs`}>Approve</button>
                                <button onClick={() => clearSuggestion(editTile.idx)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-xs`}>Clear votes</button>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setEditTile(null)} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>Cancel</button>
                            <button
                                onClick={() => {
                                    updateTile(editTile.idx, editTile.tile);
                                    setEditTile(null);
                                }}
                                className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1 py-2 text-sm`}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const GameConfigModal = ({
    selectedGame,
    room,
    users,
    updateRoom,
    roomCode,
    onClose,
    selectedSingerId,
    setSelectedSingerId,
    sortedUsers,
    scaleDurationSec,
    setScaleDurationSec,
    scaleMaxStrikes,
    setScaleMaxStrikes,
    scaleRewardPerRound,
    setScaleRewardPerRound,
    scaleDifficulty,
    setScaleDifficulty,
    scaleGuideTone,
    setScaleGuideTone,
    scaleParticipants,
    setScaleParticipants,
    onStartFlappyAmbient,
    onStartFlappySolo,
    onStartVocalAmbient,
    onStartVocalSolo,
    vocalDurationSec,
    setVocalDurationSec,
    vocalDifficulty,
    setVocalDifficulty,
    vocalGuideTone,
    setVocalGuideTone,
    vocalParticipants,
    setVocalParticipants,
    onStartRidingCrowd,
    onStartRidingTurns,
    doodlePromptsText,
    setDoodlePromptsText,
    doodleDuration,
    setDoodleDuration,
    doodleGuessDuration,
    setDoodleGuessDuration,
    doodleParticipants,
    setDoodleParticipants,
    doodleRoundRobin,
    setDoodleRoundRobin,
    doodleAiTopic,
    setDoodleAiTopic,
    doodleAiLoading,
    setDoodleAiLoading,
    doodleCustomPrompt,
    setDoodleCustomPrompt,
    onStartDoodleOke,
    selfieChallengeParticipants,
    setSelfieChallengeParticipants,
    selfiePrompt,
    setSelfiePrompt,
    selfieRequireApproval,
    setSelfieRequireApproval,
    selfieAutoStartVoting,
    setSelfieAutoStartVoting,
    selfieAiLoading,
    onStartSelfieChallenge,
    generateSelfieChallengePrompt,
    generateAIContent,
    triviaFilter,
    setTriviaFilter,
    wyrFilter,
    setWyrFilter,
    filteredTrivia,
    filteredWyr,
    selectedTriviaId,
    setSelectedTriviaId,
    selectedWyrId,
    setSelectedWyrId,
    onStartTrivia,
    onStartWyr,
    onStartRandomTrivia,
    onStartRandomWyr,
    triviaAiTopic,
    setTriviaAiTopic,
    triviaAiLoading,
    onAppendTriviaFromAI,
    wyrAiTopic,
    setWyrAiTopic,
    wyrAiLoading,
    onAppendWyrFromAI,
    triviaParticipants,
    setTriviaParticipants,
    triviaParticipantMode,
    setTriviaParticipantMode,
    triviaRoundSec,
    setTriviaRoundSec,
    triviaAutoReveal,
    setTriviaAutoReveal,
    wyrParticipants,
    setWyrParticipants,
    wyrParticipantMode,
    setWyrParticipantMode,
    bingoBoards,
    onStartBingo,
    bingoParticipants,
    setBingoParticipants,
    bingoParticipantMode,
    setBingoParticipantMode,
    callFunction,
    toast,
    setBingoBoards,
    canUseAiGeneration,
    aiGateMessage,
    bracketBusy = false,
    onCreateSweet16Bracket,
    onQueueNextBracketMatch,
    onClearSweet16Bracket,
    onSetBracketMatchWinner,
    onSetBracketWinnerFromCrowdVotes,
    onToggleBracketCrowdVoting,
    onForfeitBracketContestant,
    bracketSeedUids = [],
    setBracketSeedUids,
    bracketSeedRandomize = false,
    setBracketSeedRandomize,
    bracketCandidates = []
}) => {
    if (selectedGame === 'flappy_bird') {
        return (
            <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6">
                <div className="w-full max-w-3xl bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Flappy Bird</div>
                            <div className="text-2xl font-bold text-cyan-300">Configure game mode</div>
                        </div>
                        <button onClick={onClose} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-sm`}>Close</button>
                    </div>
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-4">
                        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Choose game mode</div>
                        <select value={selectedSingerId} onChange={e => setSelectedSingerId(e.target.value)} className={`${STYLES.input} w-full mb-3`}>
                            <option value="">Select singer or leave blank for crowd</option>
                            {sortedUsers.map(u => (
                                <option key={u.id} value={u.id.split('_')[1]}>{u.name || 'Singer'}</option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                            <button onClick={onStartFlappyAmbient} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>
                                <i className="fa-solid fa-microphone mr-1"></i> Ambient (Crowd)
                            </button>
                            <button onClick={onStartFlappySolo} className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1 py-2 text-sm`}>
                                <i className="fa-solid fa-user mr-1"></i> Solo Singer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    if (selectedGame === 'vocal_challenge') {
        return (
            <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6">
                <div className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Vocal Challenge</div>
                            <div className="text-2xl font-bold text-pink-300">Configure game mode</div>
                        </div>
                        <button onClick={onClose} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-sm`}>Close</button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-4">
                            <div className="text-xs uppercase tracking-widest text-zinc-500">Timing + Difficulty</div>
                            <label className="text-xs text-zinc-400 flex flex-col gap-2">
                                Turn length (seconds)
                                <input type="number" min="10" value={vocalDurationSec} onChange={(e) => setVocalDurationSec(e.target.value)} className={`${STYLES.input}`} />
                            </label>
                            <label className="text-xs text-zinc-400 flex flex-col gap-2">
                                Difficulty
                                <select value={vocalDifficulty} onChange={(e) => setVocalDifficulty(e.target.value)} className={STYLES.input}>
                                    <option value="easy">Easy</option>
                                    <option value="standard">Standard</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </label>
                            <label className="text-xs text-zinc-400 flex items-center gap-2">
                                <input type="checkbox" checked={vocalGuideTone} onChange={(e) => setVocalGuideTone(e.target.checked)} className="w-4 h-4" />
                                Guide tones (default on)
                            </label>
                        </div>
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                            <div className="text-xs uppercase tracking-widest text-zinc-500">Spotlight participants (turns)</div>
                            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                                {sortedUsers.map(u => {
                                    const uid = u.id.split('_')[1];
                                    const selected = vocalParticipants.includes(uid);
                                    return (
                                        <button key={u.id} onClick={() => setVocalParticipants(prev => (prev.includes(uid) ? prev.filter(v => v !== uid) : [...prev, uid]))} className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-left ${selected ? 'border-[#00C4D9] bg-[#00C4D9]/10' : 'border-zinc-700 bg-zinc-900/60'}`}>
                                            <span className="text-lg">{u.avatar || 'O'}</span>
                                            <span className="text-xs text-zinc-200 truncate">{u.name || 'Singer'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setVocalParticipants(sortedUsers.map(u => u.id.split('_')[1]))} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>
                                    Select all
                                </button>
                                <button onClick={() => setVocalParticipants([])} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button onClick={onStartVocalAmbient} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-6 py-3 text-sm`}>
                            <i className="fa-solid fa-users mr-1"></i> Start crowd mode
                        </button>
                        <button onClick={onStartVocalSolo} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-6 py-3 text-sm`}>
                            <i className="fa-solid fa-user-tie mr-1"></i> Start spotlight turns
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    if (selectedGame === 'riding_scales') {
        return (
            <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6">
                <div className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Riding Scales</div>
                            <div className="text-2xl font-bold text-cyan-300">Configure mode & settings</div>
                        </div>
                        <button onClick={onClose} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-sm`}>Close</button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-4">
                            <div className="text-xs uppercase tracking-widest text-zinc-500">Timing + Rules</div>
                            <label className="text-xs text-zinc-400 flex flex-col gap-2">
                                Round length (seconds)
                                <input type="number" min="10" value={scaleDurationSec} onChange={(e) => setScaleDurationSec(e.target.value)} className={`${STYLES.input}`} />
                            </label>
                            <label className="text-xs text-zinc-400 flex flex-col gap-2">
                                Strikes before game over
                                <input type="number" min="1" value={scaleMaxStrikes} onChange={(e) => setScaleMaxStrikes(e.target.value)} className={`${STYLES.input}`} />
                            </label>
                            <label className="text-xs text-zinc-400 flex flex-col gap-2">
                                Points per round survived
                                <input type="number" min="10" value={scaleRewardPerRound} onChange={(e) => setScaleRewardPerRound(e.target.value)} className={`${STYLES.input}`} />
                            </label>
                            <label className="text-xs text-zinc-400 flex flex-col gap-2">
                                Difficulty
                                <select value={scaleDifficulty} onChange={(e) => setScaleDifficulty(e.target.value)} className={STYLES.input}>
                                    <option value="easy">Easy</option>
                                    <option value="standard">Standard</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </label>
                            <label className="text-xs text-zinc-400 flex items-center gap-2">
                                <input type="checkbox" checked={scaleGuideTone} onChange={(e) => setScaleGuideTone(e.target.checked)} className="w-4 h-4" />
                                Guide tones (default on)
                            </label>
                        </div>
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                            <div className="text-xs uppercase tracking-widest text-zinc-500">Spotlight participants</div>
                            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                                {sortedUsers.map(u => {
                                    const uid = u.id.split('_')[1];
                                    const selected = scaleParticipants.includes(uid);
                                    return (
                                        <button key={u.id} onClick={() => setScaleParticipants(prev => (prev.includes(uid) ? prev.filter(v => v !== uid) : [...prev, uid]))} className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-left ${selected ? 'border-[#00C4D9] bg-[#00C4D9]/10' : 'border-zinc-700 bg-zinc-900/60'}`}>
                                            <span className="text-lg">{u.avatar || '🎤'}</span>
                                            <span className="text-xs text-zinc-200 truncate">{u.name || 'Singer'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setScaleParticipants(sortedUsers.map(u => u.id.split('_')[1]))} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>
                                    Select all
                                </button>
                                <button onClick={() => setScaleParticipants([])} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-6">
                        <button onClick={onStartRidingCrowd} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-6 py-3 text-sm`}>
                            <i className="fa-solid fa-users mr-1"></i> Start crowd mode
                        </button>
                        <button onClick={onStartRidingTurns} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-6 py-3 text-sm`}>
                            <i className="fa-solid fa-user-tie mr-1"></i> Start spotlight turns
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    if (selectedGame === 'doodle_oke') {
        return (
            <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6">
                <div className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Doodle-oke</div>
                            <div className="text-2xl font-bold text-cyan-300">Configure prompts & participants</div>
                        </div>
                        <button onClick={onClose} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-sm`}>Close</button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                            <div className="text-xs uppercase tracking-widest text-zinc-500">Prompts</div>
                            <textarea 
                                value={doodlePromptsText} 
                                onChange={(e) => setDoodlePromptsText(e.target.value)} 
                                placeholder="One prompt per line&#10;e.g. A funny cat&#10;A spaceship&#10;Dancing robot"
                                className={`${STYLES.input} w-full h-32 resize-none font-mono text-xs`}
                            />
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={doodleAiTopic}
                                    onChange={(e) => setDoodleAiTopic(e.target.value)}
                                    placeholder="Topic for AI prompts"
                                    className={`${STYLES.input} flex-1`}
                                />
                                <button 
                                    onClick={async () => {
                                        if (!canUseAiGeneration) {
                                            toast(aiGateMessage);
                                            return;
                                        }
                                        setDoodleAiLoading(true);
                                        try {
                                            const res = await generateAIContent('doodle_prompts', [doodleAiTopic || 'fun drawings']);
                                            if (Array.isArray(res) && res.length) {
                                                const newPrompts = res[0].split('\n').filter(p => p.trim());
                                                setDoodlePromptsText(prev => {
                                                    const existing = prev.trim() ? prev.trim().split('\n') : [];
                                                    return [...existing, ...newPrompts].join('\n');
                                                });
                                            }
                                        } catch (err) {
                                            console.error("Failed to generate prompts:", err);
                                        }
                                        setDoodleAiLoading(false);
                                    }} 
                                    disabled={doodleAiLoading || !canUseAiGeneration}
                                    className={`${STYLES.btnStd} ${canUseAiGeneration ? STYLES.btnPrimary : STYLES.btnSecondary} px-3 ${!canUseAiGeneration ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    title={canUseAiGeneration ? 'Generate prompts with AI' : aiGateMessage}
                                >
                                    {doodleAiLoading ? 'AI...' : 'AI'}
                                </button>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-400 flex flex-col gap-1">
                                    <span>Draw time (seconds)</span>
                                    <input type="number" min="5" value={doodleDuration} onChange={(e) => setDoodleDuration(e.target.value)} className={`${STYLES.input}`} />
                                </label>
                                <label className="text-xs text-zinc-400 flex flex-col gap-1">
                                    <span>Guess time (seconds)</span>
                                    <input type="number" min="5" value={doodleGuessDuration} onChange={(e) => setDoodleGuessDuration(e.target.value)} className={`${STYLES.input}`} />
                                </label>
                            </div>
                        </div>
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                            <div className="text-xs uppercase tracking-widest text-zinc-500">Settings & Participants</div>
                            <label className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded-lg">
                                <input type="checkbox" checked={doodleRoundRobin} onChange={(e) => setDoodleRoundRobin(e.target.checked)} className="w-4 h-4" />
                                <span>Round-robin (cycle through prompts)</span>
                            </label>
                            <div className="text-xs uppercase tracking-widest text-zinc-500 mt-3">Participants</div>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {sortedUsers.map(u => {
                                    const uid = u.id.split('_')[1];
                                    const selected = doodleParticipants.includes(uid);
                                    return (
                                        <button key={u.id} onClick={() => setDoodleParticipants(prev => (prev.includes(uid) ? prev.filter(v => v !== uid) : [...prev, uid]))} className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-left text-xs ${selected ? 'border-[#00C4D9] bg-[#00C4D9]/10' : 'border-zinc-700 bg-zinc-900/60'}`}>
                                            <span className="text-lg">{u.avatar || '🎤'}</span>
                                            <span className="text-zinc-200 truncate">{u.name || 'Singer'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setDoodleParticipants(sortedUsers.map(u => u.id.split('_')[1]))} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>Select all</button>
                                <button onClick={() => setDoodleParticipants([])} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>Clear</button>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <input 
                            type="text"
                            value={doodleCustomPrompt}
                            onChange={(e) => setDoodleCustomPrompt(e.target.value)}
                            placeholder="Or type a custom prompt for this round"
                            className={`${STYLES.input} flex-1`}
                        />
                        <button onClick={onStartDoodleOke} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-6 py-2 text-sm`}>
                            <i className="fa-solid fa-palette mr-1"></i> Start Doodle-oke
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    if (selectedGame === 'selfie_challenge') {
        return (
            <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6">
                <div className="w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Selfie Challenge</div>
                            <div className="text-2xl font-bold text-rose-300">Configure challenge</div>
                        </div>
                        <button onClick={onClose} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-sm`}>Close</button>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                            <div className="text-xs uppercase tracking-widest text-zinc-500">Challenge prompt</div>
                            <textarea 
                                value={selfiePrompt} 
                                onChange={(e) => setSelfiePrompt(e.target.value)}
                                placeholder="e.g. Make the silliest face possible"
                                className={`${STYLES.input} w-full h-24 resize-none`}
                            />
                            <button 
                                onClick={generateSelfieChallengePrompt}
                                disabled={selfieAiLoading || !canUseAiGeneration}
                                className={`${STYLES.btnStd} ${canUseAiGeneration ? STYLES.btnPrimary : STYLES.btnSecondary} w-full py-2 text-sm ${!canUseAiGeneration ? 'opacity-70 cursor-not-allowed' : ''}`}
                                title={canUseAiGeneration ? 'Generate selfie challenge prompt with AI' : aiGateMessage}
                            >
                                {selfieAiLoading ? 'Generating...' : 'Generate with AI'}
                            </button>
                        </div>
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                            <div className="text-xs uppercase tracking-widest text-zinc-500">Settings</div>
                            <label className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded-lg">
                                <input type="checkbox" checked={selfieRequireApproval} onChange={(e) => setSelfieRequireApproval(e.target.checked)} className="w-4 h-4" />
                                <span>Require approval before voting</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded-lg">
                                <input type="checkbox" checked={selfieAutoStartVoting} onChange={(e) => setSelfieAutoStartVoting(e.target.checked)} className="w-4 h-4" />
                                <span>Auto-start voting</span>
                            </label>
                            <div className="text-xs uppercase tracking-widest text-zinc-500 mt-3">Participants</div>
                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                {sortedUsers.map(u => {
                                    const uid = u.id.split('_')[1];
                                    const selected = selfieChallengeParticipants.includes(uid);
                                    return (
                                        <button key={u.id} onClick={() => setSelfieChallengeParticipants(prev => (prev.includes(uid) ? prev.filter(v => v !== uid) : [...prev, uid]))} className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-left text-xs ${selected ? 'border-rose-400 bg-rose-500/10' : 'border-zinc-700 bg-zinc-900/60'}`}>
                                            <span className="text-lg">{u.avatar || '📸'}</span>
                                            <span className="text-zinc-200 truncate">{u.name || 'Singer'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setSelfieChallengeParticipants(sortedUsers.map(u => u.id.split('_')[1]))} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>Select all</button>
                                <button onClick={() => setSelfieChallengeParticipants([])} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>Clear</button>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button onClick={onStartSelfieChallenge} className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-6 py-3 text-sm flex-1`}>
                            <i className="fa-solid fa-camera mr-1"></i> Start Selfie Challenge
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    if (selectedGame === 'trivia_pop') {
        return (
            <GameConfigShell
                title="Trivia"
                subtitle="Pick a question and launch it to the room."
                accentClass="text-amber-300"
                onClose={onClose}
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                        <div className="text-xs uppercase tracking-widest text-zinc-500">Round settings</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className="text-xs text-zinc-400 flex flex-col gap-2">
                                Round length (seconds)
                                <input
                                    type="number"
                                    min="5"
                                    max="180"
                                    value={triviaRoundSec}
                                    onChange={(e) => setTriviaRoundSec(e.target.value)}
                                    className={STYLES.input}
                                />
                            </label>
                            <label className="flex items-center gap-2 text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded-lg mt-[22px]">
                                <input
                                    type="checkbox"
                                    checked={triviaAutoReveal}
                                    onChange={(e) => setTriviaAutoReveal(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <span>Auto-reveal at timer end</span>
                            </label>
                        </div>
                        <div className="h-px bg-white/10"></div>
                        <div className="text-xs uppercase tracking-widest text-zinc-500">Question bank</div>
                        <input
                            value={triviaFilter}
                            onChange={(e) => setTriviaFilter(e.target.value)}
                            placeholder="Filter questions"
                            className={`${STYLES.input} w-full`}
                        />
                        <div className="flex gap-2">
                            <input
                                value={triviaAiTopic}
                                onChange={(e) => setTriviaAiTopic(e.target.value)}
                                placeholder="AI topic (optional)"
                                className={`${STYLES.input} flex-1`}
                            />
                            <button
                                onClick={onAppendTriviaFromAI}
                                disabled={triviaAiLoading || !canUseAiGeneration}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 ${!canUseAiGeneration ? 'opacity-70 cursor-not-allowed' : ''}`}
                                title={canUseAiGeneration ? 'Add AI trivia prompts' : aiGateMessage}
                            >
                                {triviaAiLoading ? 'AI...' : 'Add AI'}
                            </button>
                        </div>
                        <select
                            value={selectedTriviaId}
                            onChange={(e) => setSelectedTriviaId(e.target.value)}
                            className={`${STYLES.input} w-full`}
                        >
                            <option value="">Select a question</option>
                            {filteredTrivia.map(t => (
                                <option key={t.id} value={t.id}>{t.q}</option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const item = filteredTrivia.find(t => String(t.id) === String(selectedTriviaId));
                                    onStartTrivia(item);
                                }}
                                className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1 py-2 text-sm`}
                            >
                                Launch selected
                            </button>
                            <button onClick={onStartRandomTrivia} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>
                                Random
                            </button>
                        </div>
                    </div>
                    <ParticipantSelector
                        mode={triviaParticipantMode}
                        setMode={setTriviaParticipantMode}
                        participants={triviaParticipants}
                        setParticipants={setTriviaParticipants}
                        users={sortedUsers}
                    />
                </div>
            </GameConfigShell>
        );
    }
    if (selectedGame === 'wyr') {
        return (
            <GameConfigShell
                title="Would You Rather"
                subtitle="Pick a prompt and let the room vote."
                accentClass="text-amber-300"
                onClose={onClose}
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                        <div className="text-xs uppercase tracking-widest text-zinc-500">Prompt bank</div>
                        <input
                            value={wyrFilter}
                            onChange={(e) => setWyrFilter(e.target.value)}
                            placeholder="Filter prompts"
                            className={`${STYLES.input} w-full`}
                        />
                        <div className="flex gap-2">
                            <input
                                value={wyrAiTopic}
                                onChange={(e) => setWyrAiTopic(e.target.value)}
                                placeholder="AI topic (optional)"
                                className={`${STYLES.input} flex-1`}
                            />
                            <button
                                onClick={onAppendWyrFromAI}
                                disabled={wyrAiLoading || !canUseAiGeneration}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 ${!canUseAiGeneration ? 'opacity-70 cursor-not-allowed' : ''}`}
                                title={canUseAiGeneration ? 'Add AI WYR prompts' : aiGateMessage}
                            >
                                {wyrAiLoading ? 'AI...' : 'Add AI'}
                            </button>
                        </div>
                        <select
                            value={selectedWyrId}
                            onChange={(e) => setSelectedWyrId(e.target.value)}
                            className={`${STYLES.input} w-full`}
                        >
                            <option value="">Select a prompt</option>
                            {filteredWyr.map(w => (
                                <option key={w.id} value={w.id}>{w.q}</option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    const item = filteredWyr.find(w => String(w.id) === String(selectedWyrId));
                                    onStartWyr(item);
                                }}
                                className={`${STYLES.btnStd} ${STYLES.btnPrimary} flex-1 py-2 text-sm`}
                            >
                                Launch selected
                            </button>
                            <button onClick={onStartRandomWyr} className={`${STYLES.btnStd} ${STYLES.btnSecondary} flex-1 py-2 text-sm`}>
                                Random
                            </button>
                        </div>
                    </div>
                    <ParticipantSelector
                        mode={wyrParticipantMode}
                        setMode={setWyrParticipantMode}
                        participants={wyrParticipants}
                        setParticipants={setWyrParticipants}
                        users={sortedUsers}
                    />
                </div>
            </GameConfigShell>
        );
    }
    if (selectedGame === 'karaoke_bracket') {
        const activeBracket = room?.karaokeBracket || null;
        const activeRoundIndex = Math.max(0, Number(activeBracket?.activeRoundIndex || 0));
        const activeRound = activeBracket?.rounds?.[activeRoundIndex] || null;
        const matches = Array.isArray(activeRound?.matches) ? activeRound.matches : [];
        const canQueueNextMatch = !!activeBracket?.rounds?.length && activeBracket?.status !== 'complete';
        const crowdVotingEnabled = activeBracket?.crowdVotingEnabled !== false;
        const showAdvancePrompt = !!activeBracket?.roundTransition && activeBracket?.status !== 'complete' && !activeBracket?.activeMatchId;
        const candidateEntries = (Array.isArray(bracketCandidates) && bracketCandidates.length ? bracketCandidates : sortedUsers)
            .filter((entry) => !isHostCandidate(room, entry));
        const seedSet = new Set(bracketSeedUids);
        const selectedSeedEntries = bracketSeedUids
            .map((uid) => candidateEntries.find((entry) => resolveRoomUserUid(entry) === uid))
            .filter(Boolean);
        const availableCandidates = candidateEntries.filter((entry) => !seedSet.has(resolveRoomUserUid(entry)));
        const moveSeed = (fromIdx, toIdx) => {
            if (!setBracketSeedUids) return;
            if (fromIdx < 0 || toIdx < 0 || fromIdx >= bracketSeedUids.length || toIdx >= bracketSeedUids.length) return;
            const next = [...bracketSeedUids];
            const [item] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, item);
            setBracketSeedUids(next);
        };
        return (
            <GameConfigShell
                title="Sweet 16 Bracket"
                subtitle="Create or reseed a tournament, queue matches, and advance winners."
                accentClass="text-rose-300"
                onClose={onClose}
            >
                <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                        <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Participants + Seeding</div>
                        <div className="text-xs text-zinc-400 mt-2">Select singers and set seed order. Only singers with Tight 15 entries will be kept when bracket is created.</div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                            <div className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-3">
                                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Available</div>
                                <div className="space-y-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                                    {availableCandidates.map((entry) => {
                                        const uid = resolveRoomUserUid(entry);
                                        return (
                                            <button
                                                key={uid || entry.id}
                                                type="button"
                                                onClick={() => setBracketSeedUids?.([...(bracketSeedUids || []), uid])}
                                                className="w-full text-left rounded-lg border border-zinc-700 bg-black/30 px-2 py-2 hover:border-cyan-300/60"
                                            >
                                                <div className="text-sm text-white truncate">{entry?.name || 'Singer'}</div>
                                                <div className="text-[10px] text-zinc-500">Tap to add</div>
                                            </button>
                                        );
                                    })}
                                    {!availableCandidates.length && <div className="text-[11px] text-zinc-500">No additional singers available.</div>}
                                </div>
                            </div>
                            <div className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-3">
                                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Seed Order</div>
                                <div className="space-y-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                                    {selectedSeedEntries.map((entry, idx) => {
                                        const uid = resolveRoomUserUid(entry);
                                        return (
                                            <div key={uid || entry.id} className="rounded-lg border border-zinc-700 bg-black/30 px-2 py-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-sm text-white truncate">#{idx + 1} {entry?.name || 'Singer'}</div>
                                                    <div className="flex gap-1">
                                                        <button type="button" onClick={() => moveSeed(idx, idx - 1)} disabled={idx === 0} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-2 py-1 text-[10px] ${idx === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>Up</button>
                                                        <button type="button" onClick={() => moveSeed(idx, idx + 1)} disabled={idx === selectedSeedEntries.length - 1} className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-2 py-1 text-[10px] ${idx === selectedSeedEntries.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}`}>Down</button>
                                                        <button type="button" onClick={() => setBracketSeedUids?.(bracketSeedUids.filter((item) => item !== uid))} className={`${STYLES.btnStd} ${STYLES.btnDanger} px-2 py-1 text-[10px]`}>Remove</button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {!selectedSeedEntries.length && <div className="text-[11px] text-zinc-500">No seeded singers selected yet.</div>}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            <button
                                type="button"
                                onClick={() => setBracketSeedUids?.(candidateEntries.map((entry) => resolveRoomUserUid(entry)).filter(Boolean).slice(0, 16))}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-xs`}
                            >
                                Auto-fill Up To 16
                            </button>
                            <button
                                type="button"
                                onClick={() => setBracketSeedUids?.([])}
                                className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-3 py-1 text-xs`}
                            >
                                Clear Seeds
                            </button>
                            <label className="inline-flex items-center gap-2 text-xs text-zinc-300 ml-auto">
                                <input
                                    type="checkbox"
                                    checked={!!bracketSeedRandomize}
                                    onChange={(e) => setBracketSeedRandomize?.(e.target.checked)}
                                    className="accent-cyan-400"
                                />
                                Randomize selected seeds
                            </label>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => onCreateSweet16Bracket?.({
                                seedUids: bracketSeedUids,
                                randomize: !!bracketSeedRandomize
                            })}
                            disabled={bracketBusy || !onCreateSweet16Bracket}
                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-sm ${(bracketBusy || !onCreateSweet16Bracket) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {bracketBusy ? 'Working...' : 'Create / Reseed From Seeds'}
                        </button>
                        <button
                            onClick={() => onQueueNextBracketMatch?.()}
                            disabled={bracketBusy || !canQueueNextMatch || !onQueueNextBracketMatch}
                            className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-4 py-2 text-sm ${(bracketBusy || !canQueueNextMatch || !onQueueNextBracketMatch) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            Queue Next Match
                        </button>
                        <button
                            onClick={() => onClearSweet16Bracket?.()}
                            disabled={bracketBusy || !activeBracket || !onClearSweet16Bracket}
                            className={`${STYLES.btnStd} ${STYLES.btnDanger} px-4 py-2 text-sm ${(bracketBusy || !activeBracket || !onClearSweet16Bracket) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            Clear
                        </button>
                        <button
                            onClick={() => onToggleBracketCrowdVoting?.(!crowdVotingEnabled)}
                            disabled={bracketBusy || !activeBracket || !onToggleBracketCrowdVoting}
                            className={`${STYLES.btnStd} ${crowdVotingEnabled ? STYLES.btnSecondary : STYLES.btnPrimary} px-4 py-2 text-sm ${(bracketBusy || !activeBracket || !onToggleBracketCrowdVoting) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {crowdVotingEnabled ? 'Pause Crowd Vote' : 'Enable Crowd Vote'}
                        </button>
                        <button
                            onClick={async () => {
                                if (!activeBracket?.rounds?.length) return;
                                await updateRoom({
                                    activeMode: 'karaoke_bracket',
                                    karaokeBracket: activeBracket,
                                    gameData: activeBracket,
                                    gameParticipantMode: 'all',
                                    gameParticipants: null
                                });
                                toast('Bracket launched');
                            }}
                            disabled={!activeBracket?.rounds?.length}
                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} px-4 py-2 text-sm ${!activeBracket?.rounds?.length ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            Go Live
                        </button>
                    </div>
                    {!activeBracket?.rounds?.length ? (
                        <div className="text-sm text-zinc-400 bg-black/40 border border-white/10 rounded-2xl p-4">
                            Creates single-elimination 1v1 matches. Each match auto-picks random songs from each singer&apos;s Tight 15.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="text-sm text-zinc-400">
                                Round: <span className="text-zinc-200 font-bold">{activeRound?.name || 'Round'}</span>
                                {' '}| Bracket size: <span className="text-zinc-200 font-bold">{activeBracket?.size || 0}</span>
                                {' '}| Status: <span className="text-zinc-200 font-bold">{activeBracket?.status || 'setup'}</span>
                                {' '}| Crowd voting: <span className={`font-bold ${crowdVotingEnabled ? 'text-cyan-200' : 'text-zinc-500'}`}>{crowdVotingEnabled ? 'ON' : 'OFF'}</span>
                            </div>
                            {showAdvancePrompt && (
                                <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-3 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-200">Round Complete</div>
                                        <div className="text-sm text-zinc-100 mt-1">
                                            {activeBracket?.roundTransition?.fromRoundName || 'Round'} done. Next up: <span className="font-bold text-cyan-200">{activeBracket?.roundTransition?.toRoundName || 'Next round'}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onQueueNextBracketMatch?.()}
                                        disabled={bracketBusy || !onQueueNextBracketMatch}
                                        className={`${STYLES.btnStd} ${STYLES.btnPrimary} px-3 py-1 text-xs ${(bracketBusy || !onQueueNextBracketMatch) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        Start Next Round
                                    </button>
                                </div>
                            )}
                            {activeBracket?.status === 'complete' && (
                                <div className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-400/30 rounded-xl px-3 py-2">
                                    Champion: {activeBracket?.championName || 'Winner'}
                                </div>
                            )}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {matches.map((match) => {
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
                                                    <div className="font-bold text-white">{a?.name || 'TBD'}</div>
                                                    <div className="text-zinc-400 truncate">{match?.aSong?.songTitle || '-'} {match?.aSong?.artist ? `- ${match.aSong.artist}` : ''}</div>
                                                    <div className="text-[11px] text-cyan-200 mt-1">{voteSummary.aVotes || 0} crowd votes</div>
                                                    {a?.uid && (
                                                        <button
                                                            onClick={() => onSetBracketMatchWinner?.(match.id, a.uid)}
                                                            disabled={bracketBusy || !onSetBracketMatchWinner}
                                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} mt-2 px-2 py-1 text-[10px] ${(bracketBusy || !onSetBracketMatchWinner) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                        >
                                                            Mark Winner
                                                        </button>
                                                    )}
                                                    {a?.uid && b?.uid && (
                                                        <button
                                                            onClick={() => onForfeitBracketContestant?.(match.id, b.uid, 'host')}
                                                            disabled={bracketBusy || !onForfeitBracketContestant || !!winnerUid}
                                                            className={`${STYLES.btnStd} ${STYLES.btnDanger} mt-1 px-2 py-1 text-[10px] ${(bracketBusy || !onForfeitBracketContestant || !!winnerUid) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                        >
                                                            Opponent No-Show
                                                        </button>
                                                    )}
                                                </div>
                                                <div className={`rounded-lg border px-2 py-2 ${winnerUid && winnerUid === b?.uid ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-zinc-700 bg-black/30'}`}>
                                                    <div className="font-bold text-white">{b?.name || 'TBD'}</div>
                                                    <div className="text-zinc-400 truncate">{match?.bSong?.songTitle || '-'} {match?.bSong?.artist ? `- ${match.bSong.artist}` : ''}</div>
                                                    <div className="text-[11px] text-cyan-200 mt-1">{voteSummary.bVotes || 0} crowd votes</div>
                                                    {b?.uid && (
                                                        <button
                                                            onClick={() => onSetBracketMatchWinner?.(match.id, b.uid)}
                                                            disabled={bracketBusy || !onSetBracketMatchWinner}
                                                            className={`${STYLES.btnStd} ${STYLES.btnSecondary} mt-2 px-2 py-1 text-[10px] ${(bracketBusy || !onSetBracketMatchWinner) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                        >
                                                            Mark Winner
                                                        </button>
                                                    )}
                                                    {a?.uid && b?.uid && (
                                                        <button
                                                            onClick={() => onForfeitBracketContestant?.(match.id, a.uid, 'host')}
                                                            disabled={bracketBusy || !onForfeitBracketContestant || !!winnerUid}
                                                            className={`${STYLES.btnStd} ${STYLES.btnDanger} mt-1 px-2 py-1 text-[10px] ${(bracketBusy || !onForfeitBracketContestant || !!winnerUid) ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                        >
                                                            Opponent No-Show
                                                        </button>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => onSetBracketWinnerFromCrowdVotes?.(match.id)}
                                                    disabled={bracketBusy || !onSetBracketWinnerFromCrowdVotes || !crowdVotingEnabled}
                                                    className={`${STYLES.btnStd} ${STYLES.btnPrimary} mt-1 px-2 py-1 text-[10px] ${(bracketBusy || !onSetBracketWinnerFromCrowdVotes || !crowdVotingEnabled) ? 'opacity-60 cursor-not-allowed' : ''}`}
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
                                                <div className="text-[10px] text-zinc-500 mt-1">{new Date(Number(entry.at || 0)).toLocaleTimeString()}</div>
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
            </GameConfigShell>
        );
    }
    if (selectedGame === 'bingo') {
        return (
            <GameConfigShell
                title="Karaoke Bingo"
                subtitle="Build a tropes board, then launch it to the screens."
                accentClass="text-emerald-300"
                onClose={onClose}
            >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                        <BingoManager
                            roomCode={roomCode}
                            room={room}
                            updateRoom={updateRoom}
                            generateAIContent={generateAIContent}
                            callFunction={callFunction}
                            toast={toast}
                            bingoBoards={bingoBoards}
                            setBingoBoards={setBingoBoards}
                            onStartBingo={onStartBingo}
                            canUseAiGeneration={canUseAiGeneration}
                            aiGateMessage={aiGateMessage}
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <ParticipantSelector
                            mode={bingoParticipantMode}
                            setMode={setBingoParticipantMode}
                            participants={bingoParticipants}
                            setParticipants={setBingoParticipants}
                            users={sortedUsers}
                        />
                    </div>
                </div>
            </GameConfigShell>
        );
    }
    return null;
};

export default UnifiedGameLauncher;
