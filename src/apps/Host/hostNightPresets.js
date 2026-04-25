import { REQUEST_MODES } from '../../lib/requestModes';
import { getAudienceBrandThemePreset } from '../../lib/audienceBrandTheme';
import { AAHF_FESTIVAL_LOGO_URL } from './hostAppData';
import {
    AUDIENCE_FEATURE_ACCESS_LEVELS,
    normalizeAudienceFeatureAccess,
} from '../../lib/audienceFeatureAccess.js';

export const HOST_NIGHT_PRESET_STORAGE_KEY = 'bross_host_custom_presets_v1';

const PRESET_ID_MAX_LENGTH = 48;

const clampNumber = (value, min, max, fallback) => {
    const next = Number(value);
    if (!Number.isFinite(next)) return fallback;
    return Math.max(min, Math.min(max, next));
};

const normalizePresetId = (value = '', fallback = '') => {
    const token = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, PRESET_ID_MAX_LENGTH);
    return token || fallback;
};

const normalizeLabel = (value = '', fallback = 'Custom Preset') => {
    const trimmed = String(value || '').trim().slice(0, 64);
    return trimmed || fallback;
};

const normalizeDescription = (value = '', fallback = '') =>
    String(value || '').trim().slice(0, 240) || fallback;

const normalizeSearchSources = (value = {}, fallback = {}) => ({
    local: value?.local !== undefined ? !!value.local : !!fallback.local,
    youtube: value?.youtube !== undefined ? !!value.youtube : !!fallback.youtube,
    itunes: value?.itunes !== undefined ? !!value.itunes : !!fallback.itunes,
});

const normalizeQueueSettings = (value = {}, fallback = {}) => ({
    limitMode: String(value?.limitMode || fallback?.limitMode || 'none').trim() || 'none',
    limitCount: Math.max(0, Math.floor(Number(value?.limitCount ?? fallback?.limitCount ?? 0) || 0)),
    rotation: String(value?.rotation || fallback?.rotation || 'round_robin').trim() || 'round_robin',
    firstTimeBoost: value?.firstTimeBoost !== undefined ? value.firstTimeBoost !== false : fallback?.firstTimeBoost !== false,
});

const normalizeGameDefaults = (value = {}, fallback = {}) => ({
    triviaRoundSec: clampNumber(value?.triviaRoundSec ?? fallback?.triviaRoundSec ?? 20, 5, 90, 20),
    triviaAutoReveal: value?.triviaAutoReveal !== undefined ? value.triviaAutoReveal !== false : fallback?.triviaAutoReveal !== false,
    bingoVotingMode: String(value?.bingoVotingMode || fallback?.bingoVotingMode || 'host+votes').trim() || 'host+votes',
    bingoAutoApprovePct: clampNumber(value?.bingoAutoApprovePct ?? fallback?.bingoAutoApprovePct ?? 50, 10, 100, 50),
});

const normalizeAudienceShellVariant = (value = '', fallback = '') => {
    const token = String(value || fallback || '').trim().toLowerCase();
    return token === 'streamlined' ? 'streamlined' : token === 'classic' ? 'classic' : '';
};

const normalizeRequestMode = (value = '', fallback = REQUEST_MODES.canonicalOpen) => {
    const token = String(value || fallback || '').trim();
    return Object.values(REQUEST_MODES).includes(token) ? token : fallback;
};

const normalizePresetSettings = (value = {}, fallback = {}) => ({
    autoDj: value?.autoDj !== undefined ? !!value.autoDj : !!fallback.autoDj,
    autoBgMusic: value?.autoBgMusic !== undefined ? !!value.autoBgMusic : !!fallback.autoBgMusic,
    autoPlayMedia: value?.autoPlayMedia !== undefined ? !!value.autoPlayMedia : fallback?.autoPlayMedia !== false,
    autoEndOnTrackFinish: value?.autoEndOnTrackFinish !== undefined ? value.autoEndOnTrackFinish !== false : fallback?.autoEndOnTrackFinish !== false,
    autoBonusEnabled: value?.autoBonusEnabled !== undefined ? value.autoBonusEnabled !== false : fallback?.autoBonusEnabled !== false,
    autoBonusPoints: clampNumber(value?.autoBonusPoints ?? fallback?.autoBonusPoints ?? 25, 0, 1000, 25),
    autoDjDelaySec: clampNumber(value?.autoDjDelaySec ?? fallback?.autoDjDelaySec ?? 10, 2, 45, 10),
    showVisualizerTv: value?.showVisualizerTv !== undefined ? !!value.showVisualizerTv : !!fallback.showVisualizerTv,
    showLyricsTv: value?.showLyricsTv !== undefined ? !!value.showLyricsTv : !!fallback.showLyricsTv,
    showScoring: value?.showScoring !== undefined ? !!value.showScoring : !!fallback.showScoring,
    showFameLevel: value?.showFameLevel !== undefined ? !!value.showFameLevel : !!fallback.showFameLevel,
    requestMode: normalizeRequestMode(value?.requestMode, fallback?.requestMode || REQUEST_MODES.canonicalOpen),
    allowSingerTrackSelect: value?.allowSingerTrackSelect !== undefined ? !!value.allowSingerTrackSelect : !!fallback.allowSingerTrackSelect,
    marqueeEnabled: value?.marqueeEnabled !== undefined ? !!value.marqueeEnabled : !!fallback.marqueeEnabled,
    marqueeShowMode: String(value?.marqueeShowMode || fallback?.marqueeShowMode || 'idle').trim() || 'idle',
    chatShowOnTv: value?.chatShowOnTv !== undefined ? !!value.chatShowOnTv : !!fallback.chatShowOnTv,
    chatTvMode: String(value?.chatTvMode || fallback?.chatTvMode || 'auto').trim() || 'auto',
    bouncerMode: value?.bouncerMode !== undefined ? !!value.bouncerMode : !!fallback.bouncerMode,
    bingoShowTv: value?.bingoShowTv !== undefined ? value.bingoShowTv !== false : fallback?.bingoShowTv !== false,
    bingoVotingMode: String(value?.bingoVotingMode || fallback?.bingoVotingMode || 'host+votes').trim() || 'host+votes',
    bingoAutoApprovePct: clampNumber(value?.bingoAutoApprovePct ?? fallback?.bingoAutoApprovePct ?? 50, 10, 100, 50),
    bingoAudienceReopenEnabled: value?.bingoAudienceReopenEnabled !== undefined ? value.bingoAudienceReopenEnabled !== false : fallback?.bingoAudienceReopenEnabled !== false,
    autoLyricsOnQueue: value?.autoLyricsOnQueue !== undefined ? !!value.autoLyricsOnQueue : !!fallback.autoLyricsOnQueue,
    popTriviaEnabled: value?.popTriviaEnabled !== undefined ? value.popTriviaEnabled === true : fallback?.popTriviaEnabled === true,
    gamePreviewId: String(value?.gamePreviewId || fallback?.gamePreviewId || '').trim(),
    audienceShellVariant: normalizeAudienceShellVariant(value?.audienceShellVariant, fallback?.audienceShellVariant),
    audienceBrandThemePresetId: String(value?.audienceBrandThemePresetId || fallback?.audienceBrandThemePresetId || '').trim(),
    audienceBrandTitle: String(value?.audienceBrandTitle || fallback?.audienceBrandTitle || '').trim().slice(0, 64),
    audienceFeatureAccess: normalizeAudienceFeatureAccess(value?.audienceFeatureAccess || fallback?.audienceFeatureAccess || {}),
    queueSettings: normalizeQueueSettings(value?.queueSettings, fallback?.queueSettings),
    gameDefaults: normalizeGameDefaults(value?.gameDefaults, fallback?.gameDefaults),
});

export const BUILTIN_HOST_NIGHT_PRESETS = Object.freeze({
    casual: Object.freeze({
        id: 'casual',
        label: 'Casual Night',
        description: 'Apple playlist vibe with visualizer-forward TV.',
        isBuiltIn: true,
        searchSources: Object.freeze({ local: true, youtube: true, itunes: true }),
        settings: Object.freeze({
            autoDj: true,
            autoBgMusic: true,
            autoPlayMedia: true,
            autoEndOnTrackFinish: true,
            autoBonusEnabled: true,
            autoBonusPoints: 25,
            autoDjDelaySec: 10,
            showVisualizerTv: true,
            showLyricsTv: false,
            showScoring: false,
            showFameLevel: false,
            requestMode: REQUEST_MODES.guestBackingOptional,
            allowSingerTrackSelect: true,
            marqueeEnabled: false,
            marqueeShowMode: 'idle',
            chatShowOnTv: false,
            chatTvMode: 'auto',
            bouncerMode: false,
            bingoShowTv: true,
            bingoVotingMode: 'host+votes',
            bingoAutoApprovePct: 45,
            bingoAudienceReopenEnabled: true,
            autoLyricsOnQueue: false,
            popTriviaEnabled: false,
            queueSettings: {
                limitMode: 'none',
                limitCount: 0,
                rotation: 'round_robin',
                firstTimeBoost: true,
            },
            gameDefaults: {
                triviaRoundSec: 20,
                triviaAutoReveal: true,
                bingoVotingMode: 'host+votes',
                bingoAutoApprovePct: 45,
            },
        }),
        autoStartApplePlaylist: true,
    }),
    competition: Object.freeze({
        id: 'competition',
        label: 'Competition Night',
        description: 'Structured scoring, tighter queue, and AI lyric assist.',
        isBuiltIn: true,
        searchSources: Object.freeze({ local: false, youtube: false, itunes: true }),
        settings: Object.freeze({
            autoDj: false,
            autoBgMusic: false,
            autoPlayMedia: true,
            autoEndOnTrackFinish: true,
            autoBonusEnabled: true,
            autoBonusPoints: 25,
            autoDjDelaySec: 8,
            showVisualizerTv: false,
            showLyricsTv: true,
            showScoring: true,
            showFameLevel: true,
            requestMode: REQUEST_MODES.canonicalOpen,
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
            popTriviaEnabled: false,
            queueSettings: {
                limitMode: 'per_night',
                limitCount: 2,
                rotation: 'round_robin',
                firstTimeBoost: false,
            },
            gameDefaults: {
                triviaRoundSec: 15,
                triviaAutoReveal: true,
                bingoVotingMode: 'host',
                bingoAutoApprovePct: 60,
            },
        }),
        autoStartApplePlaylist: false,
    }),
    bingo: Object.freeze({
        id: 'bingo',
        label: 'Bingo Night',
        description: 'Crowd-observation flow with board-first interactions.',
        isBuiltIn: true,
        searchSources: Object.freeze({ local: true, youtube: true, itunes: false }),
        settings: Object.freeze({
            autoDj: false,
            autoBgMusic: true,
            autoPlayMedia: true,
            autoEndOnTrackFinish: true,
            autoBonusEnabled: true,
            autoBonusPoints: 25,
            autoDjDelaySec: 10,
            showVisualizerTv: false,
            showLyricsTv: false,
            showScoring: false,
            showFameLevel: false,
            requestMode: REQUEST_MODES.guestBackingOptional,
            allowSingerTrackSelect: true,
            marqueeEnabled: false,
            marqueeShowMode: 'always',
            chatShowOnTv: true,
            chatTvMode: 'activity',
            bouncerMode: false,
            bingoShowTv: true,
            bingoVotingMode: 'host+votes',
            bingoAutoApprovePct: 35,
            bingoAudienceReopenEnabled: true,
            autoLyricsOnQueue: false,
            popTriviaEnabled: false,
            gamePreviewId: 'bingo',
            queueSettings: {
                limitMode: 'none',
                limitCount: 0,
                rotation: 'round_robin',
                firstTimeBoost: true,
            },
            gameDefaults: {
                triviaRoundSec: 20,
                triviaAutoReveal: true,
                bingoVotingMode: 'host+votes',
                bingoAutoApprovePct: 35,
            },
        }),
        autoStartApplePlaylist: false,
    }),
    trivia: Object.freeze({
        id: 'trivia',
        label: 'Trivia Night',
        description: 'Question-first pacing with timed reveal defaults.',
        isBuiltIn: true,
        searchSources: Object.freeze({ local: false, youtube: false, itunes: false }),
        settings: Object.freeze({
            autoDj: false,
            autoBgMusic: true,
            autoPlayMedia: false,
            autoEndOnTrackFinish: true,
            autoBonusEnabled: true,
            autoBonusPoints: 25,
            autoDjDelaySec: 10,
            showVisualizerTv: false,
            showLyricsTv: false,
            showScoring: true,
            showFameLevel: false,
            requestMode: REQUEST_MODES.playableOnly,
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
            popTriviaEnabled: false,
            gamePreviewId: 'trivia_pop',
            queueSettings: {
                limitMode: 'per_night',
                limitCount: 1,
                rotation: 'round_robin',
                firstTimeBoost: true,
            },
            gameDefaults: {
                triviaRoundSec: 18,
                triviaAutoReveal: true,
                bingoVotingMode: 'host+votes',
                bingoAutoApprovePct: 50,
            },
        }),
        autoStartApplePlaylist: false,
    }),
    aahf: Object.freeze({
        id: 'aahf',
        label: 'AAHF',
        description: 'Festival-focused defaults with a streamlined audience shell and tighter host control.',
        isBuiltIn: true,
        brandingLogoUrl: AAHF_FESTIVAL_LOGO_URL,
        brandingOrbSkinUrl: AAHF_FESTIVAL_LOGO_URL,
        searchSources: Object.freeze({ local: false, youtube: true, itunes: true }),
        settings: Object.freeze({
            autoDj: false,
            autoBgMusic: false,
            autoPlayMedia: true,
            autoEndOnTrackFinish: true,
            autoBonusEnabled: true,
            autoBonusPoints: 25,
            autoDjDelaySec: 8,
            showVisualizerTv: false,
            showLyricsTv: true,
            showScoring: true,
            showFameLevel: true,
            requestMode: REQUEST_MODES.canonicalOpen,
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
            popTriviaEnabled: false,
            audienceShellVariant: 'streamlined',
            audienceBrandThemePresetId: 'festival_sunburst',
            audienceBrandTitle: 'AAHF Festival',
            audienceFeatureAccess: normalizeAudienceFeatureAccess({
                features: {
                    customEmoji: AUDIENCE_FEATURE_ACCESS_LEVELS.open,
                    premiumReactions: AUDIENCE_FEATURE_ACCESS_LEVELS.open,
                },
            }),
            queueSettings: {
                limitMode: 'per_night',
                limitCount: 2,
                rotation: 'round_robin',
                firstTimeBoost: false,
            },
            gameDefaults: {
                triviaRoundSec: 15,
                triviaAutoReveal: true,
                bingoVotingMode: 'host',
                bingoAutoApprovePct: 60,
            },
        }),
        autoStartApplePlaylist: false,
    }),
});

export const normalizeHostNightPresetRecord = (input = {}, fallbackPreset = BUILTIN_HOST_NIGHT_PRESETS.casual) => {
    const fallback = fallbackPreset && typeof fallbackPreset === 'object'
        ? fallbackPreset
        : BUILTIN_HOST_NIGHT_PRESETS.casual;
    const normalizedId = normalizePresetId(input?.id, '');
    if (!normalizedId) return null;
    const builtInPreset = BUILTIN_HOST_NIGHT_PRESETS[normalizedId] || null;
    const seed = builtInPreset || fallback;
    const label = normalizeLabel(input?.label, seed?.label || 'Custom Preset');
    return {
        id: normalizedId,
        label,
        description: normalizeDescription(input?.description, seed?.description || ''),
        basePresetId: normalizePresetId(input?.basePresetId, seed?.id || 'casual') || 'casual',
        isBuiltIn: !!builtInPreset,
        brandingLogoUrl: String(input?.brandingLogoUrl || seed?.brandingLogoUrl || '').trim() || '',
        brandingOrbSkinUrl: String(input?.brandingOrbSkinUrl || seed?.brandingOrbSkinUrl || '').trim() || '',
        searchSources: normalizeSearchSources(input?.searchSources || {}, seed?.searchSources || {}),
        settings: normalizePresetSettings(input?.settings || {}, seed?.settings || {}),
        autoStartApplePlaylist: input?.autoStartApplePlaylist !== undefined
            ? !!input.autoStartApplePlaylist
            : !!seed?.autoStartApplePlaylist,
        updatedAtMs: Math.max(0, Number(input?.updatedAtMs || Date.now()) || Date.now()),
    };
};

export const createHostNightPresetDraft = (presetInput = BUILTIN_HOST_NIGHT_PRESETS.casual) => {
    const preset = normalizeHostNightPresetRecord(presetInput, BUILTIN_HOST_NIGHT_PRESETS.casual) || BUILTIN_HOST_NIGHT_PRESETS.casual;
    return {
        id: preset.id,
        label: preset.label,
        description: preset.description,
        basePresetId: preset.basePresetId || preset.id || 'casual',
        isBuiltIn: !!preset.isBuiltIn,
        searchSources: { ...(preset.searchSources || {}) },
        settings: {
            ...(preset.settings || {}),
            audienceFeatureAccess: normalizeAudienceFeatureAccess(preset?.settings?.audienceFeatureAccess || {}),
            queueSettings: { ...(preset?.settings?.queueSettings || {}) },
            gameDefaults: { ...(preset?.settings?.gameDefaults || {}) },
        },
        autoStartApplePlaylist: !!preset.autoStartApplePlaylist,
    };
};

export const buildHostNightPresetConfig = (presetInput = BUILTIN_HOST_NIGHT_PRESETS.casual) => {
    const preset = normalizeHostNightPresetRecord(presetInput, BUILTIN_HOST_NIGHT_PRESETS.casual);
    if (!preset) return null;
    return {
        id: preset.id,
        label: preset.label,
        description: preset.description,
        basePresetId: preset.basePresetId || preset.id || 'casual',
        isBuiltIn: !!preset.isBuiltIn,
        searchSources: normalizeSearchSources(preset.searchSources || {}, preset.searchSources || {}),
        settings: normalizePresetSettings(preset.settings || {}, preset.settings || {}),
        audienceBrandTheme: buildAudienceThemeFromPreset(preset),
        brandingLogoUrl: String(preset?.brandingLogoUrl || '').trim() || null,
        brandingOrbSkinUrl: String(preset?.brandingOrbSkinUrl || '').trim() || null,
        autoStartApplePlaylist: !!preset.autoStartApplePlaylist,
        updatedAtMs: Math.max(0, Number(preset.updatedAtMs || Date.now()) || Date.now()),
    };
};

export const loadCustomHostNightPresets = (storage = globalThis?.localStorage) => {
    if (!storage?.getItem) return {};
    try {
        const raw = storage.getItem(HOST_NIGHT_PRESET_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        const entries = Array.isArray(parsed)
            ? parsed
            : Object.values(parsed || {});
        return entries.reduce((acc, entry) => {
            const normalized = normalizeHostNightPresetRecord(entry, BUILTIN_HOST_NIGHT_PRESETS[entry?.basePresetId] || BUILTIN_HOST_NIGHT_PRESETS.casual);
            if (!normalized || normalized.isBuiltIn || BUILTIN_HOST_NIGHT_PRESETS[normalized.id]) return acc;
            acc[normalized.id] = normalized;
            return acc;
        }, {});
    } catch {
        return {};
    }
};

export const persistCustomHostNightPresets = (presets = {}, storage = globalThis?.localStorage) => {
    if (!storage?.setItem) return;
    const entries = Object.values(presets || {})
        .map((entry) => normalizeHostNightPresetRecord(entry, BUILTIN_HOST_NIGHT_PRESETS[entry?.basePresetId] || BUILTIN_HOST_NIGHT_PRESETS.casual))
        .filter((entry) => entry && !entry.isBuiltIn && !BUILTIN_HOST_NIGHT_PRESETS[entry.id]);
    storage.setItem(HOST_NIGHT_PRESET_STORAGE_KEY, JSON.stringify(entries));
};

export const mergeHostNightPresets = (customPresets = {}, roomPresetConfig = null) => {
    const merged = { ...BUILTIN_HOST_NIGHT_PRESETS };
    Object.values(customPresets || {}).forEach((entry) => {
        const normalized = normalizeHostNightPresetRecord(entry, BUILTIN_HOST_NIGHT_PRESETS[entry?.basePresetId] || BUILTIN_HOST_NIGHT_PRESETS.casual);
        if (!normalized || normalized.isBuiltIn || BUILTIN_HOST_NIGHT_PRESETS[normalized.id]) return;
        merged[normalized.id] = normalized;
    });
    const roomPreset = normalizeHostNightPresetRecord(roomPresetConfig, BUILTIN_HOST_NIGHT_PRESETS[roomPresetConfig?.basePresetId] || BUILTIN_HOST_NIGHT_PRESETS.casual);
    if (roomPreset && !merged[roomPreset.id]) {
        merged[roomPreset.id] = roomPreset;
    }
    return merged;
};

export const listHostNightPresets = (presetMap = {}) => {
    const builtInOrder = Object.keys(BUILTIN_HOST_NIGHT_PRESETS);
    const builtIns = builtInOrder
        .map((key) => presetMap[key] || BUILTIN_HOST_NIGHT_PRESETS[key])
        .filter(Boolean);
    const custom = Object.values(presetMap || {})
        .filter((entry) => entry && !entry.isBuiltIn && !BUILTIN_HOST_NIGHT_PRESETS[entry.id])
        .sort((left, right) => {
            const leftTime = Number(left?.updatedAtMs || 0);
            const rightTime = Number(right?.updatedAtMs || 0);
            if (leftTime !== rightTime) return rightTime - leftTime;
            return String(left?.label || '').localeCompare(String(right?.label || ''));
        });
    return [...builtIns, ...custom];
};

export const buildAudienceThemeFromPreset = (presetInput = null) => {
    const preset = normalizeHostNightPresetRecord(presetInput || {}, BUILTIN_HOST_NIGHT_PRESETS.casual);
    const themePresetId = String(preset?.settings?.audienceBrandThemePresetId || '').trim();
    if (!themePresetId) return null;
    return getAudienceBrandThemePreset(themePresetId, {
        appTitle: String(preset?.settings?.audienceBrandTitle || '').trim() || undefined,
    });
};
