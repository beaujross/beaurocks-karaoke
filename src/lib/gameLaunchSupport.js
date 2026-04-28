export const extractRoomUserUidFromDocId = (docId = '') => {
    const safeId = String(docId || '').trim();
    if (!safeId) return '';
    const separatorIndex = safeId.indexOf('_');
    if (separatorIndex < 0 || separatorIndex === safeId.length - 1) return '';
    return safeId.slice(separatorIndex + 1);
};

export const resolveRoomUserUid = (roomUser = {}) => (
    String(roomUser?.uid || '').trim()
    || extractRoomUserUidFromDocId(roomUser?.id)
    || ''
);

export const getResolvedRoomUserUids = (roomUsers = []) => (
    Array.isArray(roomUsers)
        ? roomUsers.map((entry) => resolveRoomUserUid(entry)).filter(Boolean)
        : []
);

export const findRoomUserByUid = (roomUsers = [], uid = '') => {
    if (!uid || !Array.isArray(roomUsers)) return null;
    return roomUsers.find((entry) => resolveRoomUserUid(entry) === uid) || null;
};

const DEFAULT_BINGO_TROPES = Object.freeze([
    'Mic drop moment',
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
]);

const DEFAULT_SCALE_PATTERNS = Object.freeze([
    Object.freeze(['C', 'D', 'E', 'F', 'G', 'A', 'G', 'F', 'E', 'D']),
    Object.freeze(['C', 'E', 'G', 'A', 'G', 'F', 'E', 'D', 'C']),
    Object.freeze(['D', 'E', 'F', 'G', 'A', 'B', 'A', 'G', 'F', 'E']),
    Object.freeze(['E', 'F', 'G', 'A', 'B', 'A', 'G', 'F', 'E'])
]);

const clampNumber = (value, min, max, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
};

const cleanText = (value = '') => String(value || '').trim();

const uniqueCleanList = (values = []) => (
    [...new Set((Array.isArray(values) ? values : []).map(cleanText).filter(Boolean))]
);

export const buildParticipantPayload = (mode = 'all', participants = []) => {
    const safeMode = cleanText(mode).toLowerCase() === 'selected' ? 'selected' : 'all';
    const safeParticipants = safeMode === 'selected' ? uniqueCleanList(participants) : [];
    return {
        gameParticipantMode: safeMode,
        gameParticipants: safeParticipants
    };
};

const resolveParticipantsForLaunch = ({ launchConfig = {}, roomUsers = [] } = {}) => {
    const explicitParticipants = Array.isArray(launchConfig?.participants)
        ? uniqueCleanList(launchConfig.participants)
        : [];
    const allParticipants = uniqueCleanList(getResolvedRoomUserUids(roomUsers));
    const participantMode = cleanText(launchConfig?.participantMode).toLowerCase() === 'selected'
        ? 'selected'
        : explicitParticipants.length
            ? 'selected'
            : 'all';
    return {
        participantMode,
        participants: participantMode === 'selected' ? explicitParticipants : allParticipants
    };
};

export const buildDefaultBingoBoard = ({ size = 5, mode = 'karaoke', title = 'Karaoke Bingo' } = {}) => {
    const safeSize = Math.max(3, Math.min(7, Math.round(Number(size || 5) || 5)));
    const total = safeSize * safeSize;
    const safeMode = cleanText(mode).toLowerCase() === 'mystery' ? 'mystery' : 'karaoke';
    const tiles = Array.from({ length: total }, (_, index) => {
        const isFree = safeMode !== 'mystery' && safeSize % 2 === 1 && index === Math.floor(total / 2);
        const text = isFree ? 'FREE' : DEFAULT_BINGO_TROPES[index % DEFAULT_BINGO_TROPES.length];
        return {
            id: index,
            type: safeMode,
            text,
            status: 'hidden',
            content: null,
            free: isFree
        };
    });
    return {
        id: `ros_${safeMode}_bingo`,
        title,
        mode: safeMode,
        size: safeSize,
        tiles
    };
};

export const buildInitialBingoRevealed = (tiles = []) => {
    const revealed = {};
    (Array.isArray(tiles) ? tiles : []).forEach((tile, index) => {
        if (tile?.free) revealed[index] = true;
    });
    return revealed;
};

export const selectQuickLaunchBingoBoard = ({ bingoBoards = [], presetBoards = [] } = {}) => {
    const candidates = [
        ...(Array.isArray(bingoBoards) ? bingoBoards : []),
        ...(Array.isArray(presetBoards) ? presetBoards : [])
    ];
    return candidates.find((board) => Array.isArray(board?.tiles) && board.tiles.length > 0) || null;
};

export const buildRunOfShowGameLaunchRoomUpdates = ({
    item = {},
    room = {},
    roomUsers = [],
    startedAtMs = Date.now()
} = {}) => {
    const type = cleanText(item?.type).toLowerCase();
    const modeKey = cleanText(item?.modeLaunchPlan?.modeKey || item?.roomMomentPlan?.activeMode).toLowerCase();
    const launchConfig = item?.modeLaunchPlan?.launchConfig && typeof item.modeLaunchPlan.launchConfig === 'object'
        ? item.modeLaunchPlan.launchConfig
        : {};
    const durationSec = clampNumber(launchConfig.durationSec || item?.plannedDurationSec, 5, 3600, 60);
    const { participantMode, participants } = resolveParticipantsForLaunch({ launchConfig, roomUsers });
    const participantPayload = buildParticipantPayload(
        participantMode,
        participantMode === 'selected' ? participants : []
    );
    const baseGameData = {
        ...(launchConfig || {}),
        id: `${cleanText(item?.id) || modeKey || 'run_of_show'}_${startedAtMs}`,
        runOfShowItemId: cleanText(item?.id),
        source: 'run_of_show',
        startedAt: startedAtMs,
        durationSec
    };

    if (type === 'trivia_break') {
        return null;
    }
    if (type === 'would_you_rather_break') {
        return null;
    }
    if (type !== 'game_break' && !modeKey) return null;

    if (modeKey === 'bingo') {
        const configBoard = launchConfig.board && typeof launchConfig.board === 'object'
            ? launchConfig.board
            : null;
        const board = configBoard?.tiles?.length
            ? configBoard
            : buildDefaultBingoBoard({
                size: launchConfig.size || 5,
                mode: launchConfig.bingoMode || launchConfig.mode || 'karaoke',
                title: launchConfig.boardTitle || item?.title || 'Karaoke Bingo'
            });
        const size = Math.max(1, Number(board.size || Math.sqrt(board.tiles.length) || 5) || 5);
        const mode = cleanText(board.mode || board.tiles?.[0]?.type || 'karaoke').toLowerCase() || 'karaoke';
        const mysteryMode = mode === 'mystery';
        const mysteryParticipantPayload = mysteryMode
            ? buildParticipantPayload(participantMode, participantMode === 'selected' ? participants : [])
            : buildParticipantPayload('all', []);
        return {
            activeMode: 'bingo',
            activeScreen: 'stage',
            bingoData: board.tiles,
            bingoSize: size,
            bingoMode: mode,
            bingoSessionId: `bingo_${startedAtMs}`,
            bingoBoardId: board.id || cleanText(item?.id) || null,
            bingoVictory: board.victory || launchConfig.victory || null,
            bingoWin: null,
            bingoRevealed: buildInitialBingoRevealed(board.tiles),
            bingoSuggestions: {},
            bingoVotingMode: mysteryMode ? 'host' : (room?.bingoVotingMode || launchConfig.votingMode || 'host+votes'),
            bingoAutoApprovePct: typeof room?.bingoAutoApprovePct === 'number'
                ? room.bingoAutoApprovePct
                : clampNumber(launchConfig.autoApprovePct, 10, 100, 50),
            bingoShowTv: room?.bingoShowTv !== false,
            bingoMysteryRng: mysteryMode
                ? {
                    active: true,
                    finalized: false,
                    startTime: startedAtMs,
                    durationSec: clampNumber(launchConfig.rngDurationSec, 5, 60, 12),
                    includeHost: !!room?.bingoIncludeHost,
                    results: {}
                }
                : null,
            bingoTurnPick: null,
            bingoTurnOrder: mysteryMode ? [] : null,
            bingoTurnIndex: mysteryMode ? 0 : null,
            bingoPickerUid: null,
            bingoPickerName: null,
            bingoFocus: null,
            gameData: null,
            triviaQuestion: null,
            wyrData: null,
            ...mysteryParticipantPayload
        };
    }

    if (modeKey === 'team_pong') {
        return {
            activeMode: 'team_pong',
            activeScreen: 'stage',
            gameData: {
                ...baseGameData,
                sessionId: `team_pong_${startedAtMs}`,
                status: 'live',
                windowMs: clampNumber(launchConfig.windowMs, 5000, 120000, 18000),
                rallyTimeoutMs: clampNumber(launchConfig.rallyTimeoutMs, 1000, 10000, 3200),
                targetRally: clampNumber(launchConfig.targetRally, 5, 200, 45),
                inputSource: 'crowd'
            },
            triviaQuestion: null,
            wyrData: null,
            ...buildParticipantPayload('all', [])
        };
    }

    if (modeKey === 'doodle_oke') {
        const prompt = cleanText(launchConfig.prompt || launchConfig.question || item?.title) || 'Draw the karaoke moment';
        const promptId = `${startedAtMs}_${Math.random().toString(36).slice(2, 7)}`;
        const allParticipants = participants.length ? participants : getResolvedRoomUserUids(roomUsers);
        return {
            activeMode: 'doodle_oke',
            activeScreen: 'stage',
            doodleOke: {
                status: 'drawing',
                prompt,
                promptId,
                durationMs: clampNumber(launchConfig.drawingSec || launchConfig.durationSec, 10, 300, 45) * 1000,
                guessMs: clampNumber(launchConfig.guessSec, 5, 120, 12) * 1000,
                startedAt: startedAtMs,
                endsAt: startedAtMs + (clampNumber(launchConfig.drawingSec || launchConfig.durationSec, 10, 300, 45) * 1000),
                guessEndsAt: startedAtMs
                    + (clampNumber(launchConfig.drawingSec || launchConfig.durationSec, 10, 300, 45) * 1000)
                    + (clampNumber(launchConfig.guessSec, 5, 120, 12) * 1000),
                requireReview: launchConfig.requireReview === true,
                approvedUids: [],
                winner: null,
                winnerAwardedAt: null,
                updatedAt: startedAtMs
            },
            doodleOkeConfig: {
                prompts: [prompt],
                durationMs: clampNumber(launchConfig.drawingSec || launchConfig.durationSec, 10, 300, 45) * 1000,
                guessMs: clampNumber(launchConfig.guessSec, 5, 120, 12) * 1000,
                participants: allParticipants,
                roundRobin: false
            },
            gameData: null,
            triviaQuestion: null,
            wyrData: null,
            ...buildParticipantPayload(allParticipants.length ? 'selected' : 'all', allParticipants)
        };
    }

    if (modeKey === 'selfie_challenge') {
        const prompt = cleanText(launchConfig.prompt || launchConfig.question || item?.title) || 'Best karaoke face';
        const allParticipants = participants.length ? participants : getResolvedRoomUserUids(roomUsers);
        return {
            activeMode: 'selfie_challenge',
            activeScreen: 'stage',
            selfieChallenge: {
                prompt,
                promptId: `${startedAtMs}`,
                participants: allParticipants,
                status: 'collecting',
                requireApproval: launchConfig.requireApproval !== false,
                autoStartVoting: launchConfig.autoStartVoting !== false,
                createdAt: startedAtMs,
                runOfShowItemId: cleanText(item?.id)
            },
            gameData: null,
            triviaQuestion: null,
            wyrData: null,
            ...buildParticipantPayload(allParticipants.length ? 'selected' : 'all', allParticipants)
        };
    }

    if (modeKey === 'karaoke_bracket') {
        const existingBracket = room?.karaokeBracket || null;
        return {
            activeMode: 'karaoke_bracket',
            activeScreen: 'stage',
            karaokeBracket: existingBracket,
            gameData: existingBracket || {
                ...baseGameData,
                status: 'setup',
                style: 'sweet16',
                format: 'single_elimination'
            },
            ...buildParticipantPayload('all', [])
        };
    }

    if (modeKey === 'flappy_bird') {
        return {
            activeMode: 'flappy_bird',
            activeScreen: 'stage',
            gameData: {
                ...baseGameData,
                playerId: 'AMBIENT',
                playerName: 'THE CROWD',
                playerAvatar: 'O',
                inputSource: 'ambient',
                status: 'waiting',
                score: 0,
                lives: clampNumber(launchConfig.lives, 1, 9, 3),
                difficulty: cleanText(launchConfig.difficulty) || 'normal',
                timestamp: startedAtMs
            },
            ...buildParticipantPayload('all', [])
        };
    }

    if (modeKey === 'vocal_challenge') {
        return {
            activeMode: 'vocal_challenge',
            activeScreen: 'stage',
            gameData: {
                ...baseGameData,
                playerId: 'AMBIENT',
                playerName: 'THE CROWD',
                playerAvatar: 'O',
                inputSource: 'ambient',
                mode: 'crowd',
                status: 'playing',
                score: 0,
                streak: 0,
                turnDurationMs: durationSec * 1000,
                difficulty: cleanText(launchConfig.difficulty) || 'normal',
                guideTone: cleanText(launchConfig.guideTone) || 'C4',
                timestamp: startedAtMs
            },
            ...buildParticipantPayload('all', [])
        };
    }

    if (modeKey === 'riding_scales') {
        const patternIndex = Math.abs(Math.floor(Number(startedAtMs || 0))) % DEFAULT_SCALE_PATTERNS.length;
        return {
            activeMode: 'riding_scales',
            activeScreen: 'stage',
            gameData: {
                ...baseGameData,
                playerId: 'GROUP',
                playerName: 'THE CROWD',
                playerAvatar: 'O',
                inputSource: 'crowd',
                mode: 'crowd',
                startedAt: startedAtMs,
                turnDurationMs: durationSec * 1000,
                pattern: DEFAULT_SCALE_PATTERNS[patternIndex],
                difficulty: cleanText(launchConfig.difficulty) || 'normal',
                guideTone: cleanText(launchConfig.guideTone) || 'C4',
                maxStrikes: clampNumber(launchConfig.maxStrikes, 1, 9, 3),
                rewardPerRound: clampNumber(launchConfig.rewardPerRound, 10, 1000, 50),
                status: 'running'
            },
            ...buildParticipantPayload('all', [])
        };
    }

    if (modeKey === 'applause_countdown') {
        return {
            activeMode: 'applause_countdown',
            activeScreen: 'stage',
            applausePeak: 0,
            currentApplauseLevel: 0,
            gameData: null,
            triviaQuestion: null,
            wyrData: null
        };
    }

    return {
        activeMode: modeKey || 'karaoke',
        activeScreen: 'stage',
        gameData: baseGameData,
        triviaQuestion: null,
        wyrData: null,
        ...participantPayload
    };
};
