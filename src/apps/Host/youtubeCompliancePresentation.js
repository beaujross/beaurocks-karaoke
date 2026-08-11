import {
    YOUTUBE_PLAYBACK_STATUSES,
    normalizeYouTubePlaybackState,
} from '../../lib/youtubePlaybackStatus.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const isYouTubeTvReady = (value = {}) => {
    const state = normalizeYouTubePlaybackState(value);
    return state.playable === true
        && state.embeddable === true
        && state.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES.embeddable;
};

export const getYouTubePlaybackPresentation = (value = {}) => {
    const state = normalizeYouTubePlaybackState(value);
    if (isYouTubeTvReady(state)) {
        return {
            state: 'ready',
            label: 'Verified for Public TV',
            actionLabel: 'Add Performance',
            detail: 'Verified playable and embeddable in the synced Public TV player.',
            className: 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100',
        };
    }
    if (state.youtubePlaybackStatus === YOUTUBE_PLAYBACK_STATUSES.notEmbeddable) {
        return {
            state: 'external',
            label: 'External only',
            actionLabel: 'Add for Review',
            detail: 'This result can open on YouTube but cannot play inside Public TV.',
            className: 'border-orange-300/40 bg-orange-500/10 text-orange-100',
        };
    }
    return {
        state: 'unknown',
        label: 'Needs verification',
        actionLabel: 'Add for Review',
        detail: 'BeauRocks must verify this result before embedded Public TV playback.',
        className: 'border-amber-300/40 bg-amber-500/10 text-amber-100',
    };
};

export const getYouTubeProvenancePresentation = (value = {}) => {
    const source = String(
        value.sourceDiscovery
        || value.searchCacheLayer
        || value.cacheLayer
        || ''
    ).trim().toLowerCase();
    if (source.includes('client_cache') || source.includes('server_cache') || source === 'cache') {
        return { label: 'Cached YouTube search', detail: 'Reused a recent verified search response.' };
    }
    if (source.includes('live_youtube') || source === 'host_search') {
        return { label: 'Live YouTube search', detail: 'Discovered through a Host-initiated YouTube API search.' };
    }
    if (source.includes('playlist')) {
        return { label: 'Playlist index', detail: 'Imported from a Host-supplied YouTube playlist.' };
    }
    if (source.includes('paste')) {
        return { label: 'Host-provided URL', detail: 'Provided directly by the Host and checked before playback.' };
    }
    if (source.includes('feedback')) {
        return { label: 'Proven backing', detail: 'Previously used successfully by a Host.' };
    }
    if (
        source.includes('trusted')
        || source.includes('canonical')
        || source.includes('nightly')
        || source.includes('idle_refresh')
    ) {
        return { label: 'Known verified backing', detail: 'Reused from BeauRocks verified backing data.' };
    }
    return { label: 'Room Library', detail: 'Saved in this room for reuse before another live search.' };
};

export const getYouTubeVerificationFreshness = (value = {}, atMs = Date.now()) => {
    const playback = getYouTubePlaybackPresentation(value);
    if (playback.state !== 'ready') return playback.label;
    const expiresAtMs = Math.max(0, Number(value.expiresAtMs || 0));
    if (expiresAtMs > 0 && expiresAtMs <= atMs) return 'Refresh due';
    const validatedAtMs = Math.max(0, Number(value.lastValidatedAtMs || value.curatedAtMs || 0));
    if (!validatedAtMs) return 'Verified';
    const ageDays = Math.max(0, Math.floor((atMs - validatedAtMs) / DAY_MS));
    if (ageDays === 0) return 'Verified today';
    if (ageDays === 1) return 'Verified 1 day ago';
    return 'Verified ' + ageDays + ' days ago';
};
