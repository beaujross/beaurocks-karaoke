import { resolveRoomUserUid } from './gameLaunchSupport.js';

export const BRACKET_SIGNUP_DEFAULT_DURATION_MIN = 15;
export const BRACKET_SIGNUP_DEFAULT_READY_COUNT = 5;
export const BRACKET_SIGNUP_MIN_READY_COUNT = 2;
export const BRACKET_SONG_SELECTION_MODES = {
    tight15Random: 'tight15_random',
    singerPickRound: 'singer_pick_round'
};

export const normalizeBracketSongSelectionMode = (value = '') => (
    String(value || '').trim() === BRACKET_SONG_SELECTION_MODES.singerPickRound
        ? BRACKET_SONG_SELECTION_MODES.singerPickRound
        : BRACKET_SONG_SELECTION_MODES.tight15Random
);

const clampInt = (value, min, max, fallback) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
};

const normalizeName = (value = '') => String(value || '').trim().toLowerCase();

const asTimestampMs = (value, fallback = 0) => {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
};

export const getRoomUserTight15Count = (roomUser = {}) => {
    const list = Array.isArray(roomUser?.tight15)
        ? roomUser.tight15
        : (Array.isArray(roomUser?.tight15Temp) ? roomUser.tight15Temp : []);
    return list.filter(Boolean).length;
};

export const buildBracketSignupState = (signup = {}, nowMs = Date.now()) => {
    const openedAt = asTimestampMs(signup?.openedAt, nowMs || Date.now());
    const durationMin = clampInt(signup?.durationMin, 1, 60, BRACKET_SIGNUP_DEFAULT_DURATION_MIN);
    const readySongMin = clampInt(signup?.readySongMin, 1, 15, BRACKET_SIGNUP_DEFAULT_READY_COUNT);
    const countdownStartedAt = asTimestampMs(signup?.countdownStartedAt, openedAt);
    const deadlineMs = asTimestampMs(signup?.deadlineMs, countdownStartedAt + (durationMin * 60 * 1000));
    return {
        status: 'open',
        openedAt,
        countdownStartedAt,
        deadlineMs,
        durationMin,
        readySongMin,
        songSelectionMode: normalizeBracketSongSelectionMode(signup?.songSelectionMode)
    };
};

export const getBracketSignupState = (bracket = null) => {
    if (!bracket?.signup) return null;
    return buildBracketSignupState(bracket.signup, asTimestampMs(bracket?.createdAt, Date.now()));
};

export const isBracketSignupOpen = (bracket = null) => {
    const signup = getBracketSignupState(bracket);
    if (!signup) return false;
    const status = String(bracket?.status || '').trim().toLowerCase();
    return !status || status === 'signup';
};

export const buildBracketSignupRoster = ({ roomUsers = [], room = {}, signup = null } = {}) => {
    const readySongMin = signup?.readySongMin || BRACKET_SIGNUP_DEFAULT_READY_COUNT;
    const singerPickRound = normalizeBracketSongSelectionMode(signup?.songSelectionMode) === BRACKET_SONG_SELECTION_MODES.singerPickRound;
    const hostUid = String(room?.hostUid || '').trim();
    const hostName = normalizeName(room?.hostName || '');
    return (Array.isArray(roomUsers) ? roomUsers : [])
        .map((entry) => {
            const uid = resolveRoomUserUid(entry);
            const name = String(entry?.name || 'Singer').trim() || 'Singer';
            const tight15Count = getRoomUserTight15Count(entry);
            return {
                uid,
                name,
                avatar: entry?.avatar || '',
                tight15Count,
                ready: singerPickRound || tight15Count >= readySongMin,
                songSelectionMode: signup?.songSelectionMode || BRACKET_SONG_SELECTION_MODES.tight15Random,
                roomUser: entry
            };
        })
        .filter((entry) => entry.uid)
        .filter((entry) => entry.uid !== hostUid)
        .filter((entry) => normalizeName(entry.name) !== hostName)
        .sort((a, b) => {
            if (b.ready !== a.ready) return Number(b.ready) - Number(a.ready);
            if (b.tight15Count !== a.tight15Count) return b.tight15Count - a.tight15Count;
            return a.name.localeCompare(b.name);
        });
};

export const summarizeBracketSignup = ({ roomUsers = [], room = {}, bracket = null, nowMs = Date.now() } = {}) => {
    const signup = getBracketSignupState(bracket);
    const roster = buildBracketSignupRoster({ roomUsers, room, signup });
    const readyCount = roster.filter((entry) => entry.ready).length;
    const deadlineMs = signup?.deadlineMs || 0;
    const remainingMs = deadlineMs ? Math.max(0, deadlineMs - nowMs) : 0;
    return {
        signup,
        roster,
        readyCount,
        totalCount: roster.length,
        launchUnlocked: readyCount >= BRACKET_SIGNUP_MIN_READY_COUNT,
        remainingMs
    };
};
