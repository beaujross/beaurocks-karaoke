export const YOUTUBE_PLAYBACK_STATUSES = Object.freeze({
    embeddable: 'embeddable',
    notEmbeddable: 'not_embeddable',
    unknown: 'unknown'
});

const READY_UPLOAD_STATUSES = new Set(['processed', 'uploaded']);
const ALLOWED_PRIVACY_STATUSES = new Set(['public', 'unlisted']);

const normalizeStatusValue = (value = '') => String(value || '').trim().toLowerCase();

export const normalizeYouTubePlaybackState = (value = {}) => {
    const input = value && typeof value === 'object' ? value : {};
    const explicitStatus = normalizeStatusValue(input.youtubePlaybackStatus);
    const uploadStatus = normalizeStatusValue(input.uploadStatus);
    const privacyStatus = normalizeStatusValue(input.privacyStatus);
    const embeddable = input.embeddable === true || explicitStatus === YOUTUBE_PLAYBACK_STATUSES.embeddable;
    const uploadReady = !uploadStatus || READY_UPLOAD_STATUSES.has(uploadStatus);
    const allowedPrivacy = !privacyStatus || ALLOWED_PRIVACY_STATUSES.has(privacyStatus);
    const playable = input.playable === true
        || explicitStatus === YOUTUBE_PLAYBACK_STATUSES.embeddable
        || (embeddable && uploadReady && allowedPrivacy);

    let youtubePlaybackStatus = YOUTUBE_PLAYBACK_STATUSES.unknown;
    if (explicitStatus === YOUTUBE_PLAYBACK_STATUSES.embeddable || playable) {
        youtubePlaybackStatus = YOUTUBE_PLAYBACK_STATUSES.embeddable;
    } else if (
        explicitStatus === YOUTUBE_PLAYBACK_STATUSES.notEmbeddable
        || input.backingAudioOnly === true
        || input.embeddable === false
        || !uploadReady
        || !allowedPrivacy
    ) {
        youtubePlaybackStatus = YOUTUBE_PLAYBACK_STATUSES.notEmbeddable;
    }

    return {
        embeddable,
        playable,
        uploadStatus,
        privacyStatus,
        uploadReady,
        allowedPrivacy,
        youtubePlaybackStatus,
        backingAudioOnly: youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES.notEmbeddable
    };
};

export const isYouTubeEmbeddable = (value = {}) => (
    normalizeYouTubePlaybackState(value).youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES.embeddable
);

export const getYouTubeEmbedCacheStatus = (value = {}) => {
    const normalized = normalizeYouTubePlaybackState(value);
    if (normalized.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES.embeddable) return 'ok';
    if (normalized.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES.notEmbeddable) return 'fail';
    return 'unknown';
};
