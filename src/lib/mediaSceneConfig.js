import { getBgTrackById } from './bgTrackOptions.js';

export const MEDIA_SCENE_AUDIENCE_REACTION_MODES = Object.freeze({
    off: 'off',
    clap: 'free_clap',
});

export const MEDIA_SCENE_AUDIENCE_REACTION_OPTIONS = Object.freeze([
    {
        value: MEDIA_SCENE_AUDIENCE_REACTION_MODES.clap,
        label: 'Free Clap Voting',
        detail: 'Audience phones get the existing free clap vote button with cooldowns while this scene runs.'
    },
    {
        value: MEDIA_SCENE_AUDIENCE_REACTION_MODES.off,
        label: 'No Scene Voting',
        detail: 'Keep the audience app visual-only while this scene plays.'
    }
]);

export const MEDIA_SCENE_SOUNDTRACK_SOURCE_OPTIONS = Object.freeze([
    { value: '', label: 'None' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'apple_music', label: 'Apple Music' },
    { value: 'bg_track', label: 'Built-In BG Track' },
    { value: 'manual_external', label: 'Direct Media URL' }
]);

export const normalizeMediaSceneAudienceReactionMode = (value = '') => {
    const safeValue = String(value || '').trim().toLowerCase();
    if (MEDIA_SCENE_AUDIENCE_REACTION_OPTIONS.some((option) => option.value === safeValue)) {
        return safeValue;
    }
    if (['free_standard', 'free_all', 'blossom_only'].includes(safeValue)) {
        return MEDIA_SCENE_AUDIENCE_REACTION_MODES.clap;
    }
    return MEDIA_SCENE_AUDIENCE_REACTION_MODES.off;
};

export const getMediaSceneAudienceReactionMeta = (value = '') => {
    const mode = normalizeMediaSceneAudienceReactionMode(value);
    return MEDIA_SCENE_AUDIENCE_REACTION_OPTIONS.find((option) => option.value === mode)
        || MEDIA_SCENE_AUDIENCE_REACTION_OPTIONS[1];
};

export const getMediaSceneAllowedReactionTypes = (value = '') => {
    const mode = normalizeMediaSceneAudienceReactionMode(value);
    if (mode === MEDIA_SCENE_AUDIENCE_REACTION_MODES.off) return [];
    return ['clap'];
};

const extractYouTubeId = (input = '') => {
    const text = String(input || '').trim();
    if (!text) return '';
    const directMatch = text.match(/^[A-Za-z0-9_-]{11}$/);
    if (directMatch) return directMatch[0];
    const urlMatch = text.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
    return urlMatch?.[1] || '';
};

const extractAppleMusicTrackId = (input = '') => {
    const text = String(input || '').trim();
    if (!text) return '';
    if (/^\d{5,}$/.test(text)) return text;
    const queryMatch = text.match(/[?&]i=(\d{5,})/i);
    if (queryMatch?.[1]) return queryMatch[1];
    const songMatch = text.match(/\/song\/[^/?#]+\/(\d{5,})/i);
    if (songMatch?.[1]) return songMatch[1];
    return '';
};

export const getMediaSceneSoundtrackPrimaryValue = (sourceType = '', source = {}) => {
    const safeSourceType = String(sourceType || source?.soundtrackSourceType || '').trim().toLowerCase();
    if (safeSourceType === 'youtube') {
        return String(source?.soundtrackMediaUrl || source?.soundtrackYoutubeId || '').trim();
    }
    if (safeSourceType === 'apple_music') {
        return String(source?.soundtrackAppleMusicId || '').trim();
    }
    if (safeSourceType === 'bg_track') {
        return String(source?.soundtrackBgTrackId || '').trim();
    }
    if (safeSourceType === 'manual_external') {
        return String(source?.soundtrackMediaUrl || '').trim();
    }
    return '';
};

export const normalizeMediaSceneSoundtrackConfig = (input = {}) => {
    const sourceType = String(input?.soundtrackSourceType || '').trim().toLowerCase();
    const primaryValue = String(
        input?.soundtrackInputValue
        ?? getMediaSceneSoundtrackPrimaryValue(sourceType, input)
        ?? ''
    ).trim();
    const label = String(input?.soundtrackLabel || '').trim();
    if (!MEDIA_SCENE_SOUNDTRACK_SOURCE_OPTIONS.some((option) => option.value === sourceType) || !sourceType) {
        return {
            soundtrackSourceType: '',
            soundtrackLabel: label,
            soundtrackMediaUrl: '',
            soundtrackYoutubeId: '',
            soundtrackAppleMusicId: '',
            soundtrackBgTrackId: '',
        };
    }
    if (sourceType === 'youtube') {
        return {
            soundtrackSourceType: sourceType,
            soundtrackLabel: label,
            soundtrackMediaUrl: /^https?:\/\//i.test(primaryValue) ? primaryValue : '',
            soundtrackYoutubeId: extractYouTubeId(primaryValue),
            soundtrackAppleMusicId: '',
            soundtrackBgTrackId: '',
        };
    }
    if (sourceType === 'apple_music') {
        return {
            soundtrackSourceType: sourceType,
            soundtrackLabel: label,
            soundtrackMediaUrl: '',
            soundtrackYoutubeId: '',
            soundtrackAppleMusicId: extractAppleMusicTrackId(primaryValue),
            soundtrackBgTrackId: '',
        };
    }
    if (sourceType === 'bg_track') {
        const track = getBgTrackById(primaryValue);
        return {
            soundtrackSourceType: sourceType,
            soundtrackLabel: label,
            soundtrackMediaUrl: String(track?.url || '').trim(),
            soundtrackYoutubeId: '',
            soundtrackAppleMusicId: '',
            soundtrackBgTrackId: String(track?.id || primaryValue || '').trim().toLowerCase(),
        };
    }
    return {
        soundtrackSourceType: sourceType,
        soundtrackLabel: label,
        soundtrackMediaUrl: primaryValue,
        soundtrackYoutubeId: '',
        soundtrackAppleMusicId: '',
        soundtrackBgTrackId: '',
    };
};

export const hasMediaSceneConfiguredSoundtrack = (source = {}) => {
    const sourceType = String(source?.soundtrackSourceType || '').trim().toLowerCase();
    if (sourceType === 'youtube') {
        return !!String(source?.soundtrackYoutubeId || source?.soundtrackMediaUrl || '').trim();
    }
    if (sourceType === 'apple_music') {
        return !!String(source?.soundtrackAppleMusicId || '').trim();
    }
    if (sourceType === 'bg_track') {
        return !!String(source?.soundtrackBgTrackId || source?.soundtrackMediaUrl || '').trim();
    }
    if (sourceType === 'manual_external') {
        return !!String(source?.soundtrackMediaUrl || '').trim();
    }
    return false;
};

export const buildMediaSceneSoundtrackPayload = (source = {}, startedAtMs = 0, fallbackLabel = '', durationSec = 20) => {
    const soundtrack = normalizeMediaSceneSoundtrackConfig(source);
    if (!hasMediaSceneConfiguredSoundtrack(soundtrack)) return null;
    const sourceType = soundtrack.soundtrackSourceType;
    return {
        sourceType,
        label: String(soundtrack.soundtrackLabel || fallbackLabel || 'Scene Soundtrack').trim() || 'Scene Soundtrack',
        mediaUrl: String(soundtrack.soundtrackMediaUrl || '').trim(),
        youtubeId: String(soundtrack.soundtrackYoutubeId || '').trim(),
        appleMusicId: String(soundtrack.soundtrackAppleMusicId || '').trim(),
        bgTrackId: String(soundtrack.soundtrackBgTrackId || '').trim(),
        startedAtMs: Math.max(0, Number(startedAtMs || 0)),
        durationSec: Math.max(6, Math.min(600, Number(durationSec || 20) || 20)),
    };
};
