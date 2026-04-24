import { BROWSE_CATEGORIES } from '../../lib/browseLists.js';
import { decorateBrowseSongs } from '../../lib/browseCatalog.js';

export const DEAD_AIR_BROWSE_CATEGORY_IDS = Object.freeze(['popular_now', 'trending_classics', 'party_starters']);
export const DEAD_AIR_AUTOFILL_SOURCE = 'dead_air_autofill';

const normalizeText = (value = '') => String(value || '').trim();
const normalizeKeyText = (value = '') => normalizeText(value).toLowerCase();

const normalizeDeadAirBacking = (backing = null) => {
    if (!backing || typeof backing !== 'object' || Array.isArray(backing)) return null;
    const mediaUrl = normalizeText(backing.mediaUrl);
    if (!mediaUrl) return null;
    return {
        mediaUrl,
        trackSource: normalizeText(backing.trackSource || 'youtube').toLowerCase() || 'youtube',
        appleMusicId: normalizeText(backing.appleMusicId),
        label: normalizeText(backing.label),
        durationSec: Math.max(0, Math.round(Number(backing.durationSec || 0) || 0)),
        approved: backing.approved === true,
        playable: backing.playable === true,
        score: Math.max(0, Number(backing.score || 0) || 0)
    };
};

export const buildSongIdentityKey = (song = {}) => {
    const title = normalizeKeyText(song?.title || song?.songTitle);
    if (!title) return '';
    return `${title}__${normalizeKeyText(song?.artist || song?.artistName)}`;
};

export const isDeadAirAutoFillQueueItem = (song = {}) =>
    normalizeKeyText(song?.automationSource) === DEAD_AIR_AUTOFILL_SOURCE;

export const normalizeDeadAirFillerSong = (song = {}) => {
    const title = normalizeText(song?.title || song?.songTitle);
    if (!title) return null;
    const backing = normalizeDeadAirBacking(song?.backing);
    const normalized = {
        title,
        artist: normalizeText(song?.artist || song?.artistName),
        browseSongKey: normalizeText(song?.browseSongKey),
        hasApprovedBacking: song?.hasApprovedBacking === true
    };
    if (backing) {
        normalized.backing = backing;
        normalized.hasApprovedBacking = true;
    }
    return normalized;
};

export const buildDeadAirFillerSongPlan = ({
    categories = BROWSE_CATEGORIES,
    categoryIds = DEAD_AIR_BROWSE_CATEGORY_IDS,
    limit = 8,
} = {}) => {
    const allowedCategoryIds = new Set(Array.isArray(categoryIds) ? categoryIds : []);
    const songMap = new Map();
    (Array.isArray(categories) ? categories : [])
        .filter((category) => allowedCategoryIds.has(category?.id))
        .flatMap((category) => Array.isArray(category?.songs) ? category.songs : [])
        .forEach((song) => {
            const normalized = normalizeDeadAirFillerSong(song);
            if (!normalized) return;
            const key = buildSongIdentityKey(normalized);
            if (key && !songMap.has(key)) songMap.set(key, normalized);
        });

    const candidates = Array.from(songMap.values());
    const playable = decorateBrowseSongs(candidates, { playableOnly: true });
    const fallback = decorateBrowseSongs(candidates, { playableOnly: false });
    return (playable.length > 0 ? playable : fallback)
        .slice(0, Math.max(0, Number(limit || 0)))
        .map((song) => normalizeDeadAirFillerSong(song))
        .filter(Boolean);
};

export const getDeadAirFillerModeForAssist = (assistLevel = 'smart_assist') => {
    const safeAssistLevel = normalizeKeyText(assistLevel || 'smart_assist');
    if (safeAssistLevel === 'autopilot_first') return 'auto_fill';
    if (safeAssistLevel === 'manual_first') return 'off';
    return 'suggest';
};

export const buildDeadAirFillerPayload = ({
    assistLevel = 'smart_assist',
    delaySec = 10,
    songs = [],
    songLimit = 6,
} = {}) => {
    const mode = getDeadAirFillerModeForAssist(assistLevel);
    const safeDelaySec = Math.max(2, Math.min(45, Number(delaySec || 10) || 10));
    const normalizedSongs = (Array.isArray(songs) ? songs : [])
        .slice(0, Math.max(0, Number(songLimit || 0)))
        .map((song) => normalizeDeadAirFillerSong(song))
        .filter(Boolean);

    return {
        enabled: mode !== 'off',
        mode,
        source: 'browse_catalog_known_good',
        delaySec: safeDelaySec,
        songs: normalizedSongs,
    };
};

export const getDeadAirAutoFillIntent = ({
    roomCode = '',
    deadAirFiller = {},
    autoDjEnabled = false,
    queuedCount = 0,
    performingCount = 0,
    runOfShowEnabled = false,
    programMode = '',
    activeMode = '',
    sourceSongs = [],
    fallbackSongs = [],
    songs = [],
    lastPerformanceTs = 0,
    previousFillKey = '',
    autoDjDelaySec = 10,
} = {}) => {
    if (!normalizeText(roomCode)) return { shouldQueue: false, reason: 'missing_room' };
    if (deadAirFiller?.enabled === false || deadAirFiller?.mode !== 'auto_fill') {
        return { shouldQueue: false, reason: 'not_autopilot' };
    }
    if (!autoDjEnabled) return { shouldQueue: false, reason: 'auto_dj_off' };
    if (Number(queuedCount || 0) > 0 || Number(performingCount || 0) > 0) {
        return { shouldQueue: false, reason: 'queue_busy' };
    }
    if (runOfShowEnabled === true && normalizeKeyText(programMode) === 'run_of_show') {
        return { shouldQueue: false, reason: 'run_of_show_active' };
    }
    const safeActiveMode = normalizeKeyText(activeMode);
    if (safeActiveMode && safeActiveMode !== 'karaoke') {
        return { shouldQueue: false, reason: 'mode_busy' };
    }

    const persistedSongs = Array.isArray(deadAirFiller?.songs) ? deadAirFiller.songs : [];
    const candidates = Array.isArray(sourceSongs) && sourceSongs.length > 0
        ? sourceSongs
        : persistedSongs.length > 0
            ? persistedSongs
            : fallbackSongs;
    const queuedKeys = new Set((Array.isArray(songs) ? songs : [])
        .map((song) => buildSongIdentityKey(song))
        .filter(Boolean));
    const song = (Array.isArray(candidates) ? candidates : [])
        .map((candidate) => normalizeDeadAirFillerSong(candidate))
        .find((candidate) => candidate && !queuedKeys.has(buildSongIdentityKey(candidate)));

    if (!song) return { shouldQueue: false, reason: 'no_song' };

    const fillKey = `${normalizeText(roomCode)}:${Math.max(0, Number(lastPerformanceTs || 0))}:${song.title}:${song.artist || ''}`;
    if (previousFillKey && previousFillKey === fillKey) {
        return { shouldQueue: false, reason: 'already_queued', song, fillKey };
    }

    const delaySec = deadAirFiller?.delaySec ?? autoDjDelaySec;
    return {
        shouldQueue: true,
        reason: 'ready',
        song,
        fillKey,
        delayMs: Math.max(2, Math.min(45, Number(delaySec || 10) || 10)) * 1000,
    };
};
