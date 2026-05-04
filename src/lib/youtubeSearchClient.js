import { callFunction } from './firebase';

const YOUTUBE_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const YOUTUBE_QUOTA_COOLDOWN_MS = 15 * 60 * 1000;
const YOUTUBE_TELEMETRY_WINDOW_MS = 15 * 60 * 1000;
const YOUTUBE_QUOTA_STORAGE_KEY = 'bross_youtube_quota_block_until_ms_v1';
const youtubeSearchCache = new Map();
const youtubeSearchTelemetrySubscribers = new Set();
const youtubeSearchTelemetryEvents = [];

const nowMs = () => Date.now();

const normalizeSearchQuery = (value = '') => (
    String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const buildSearchCacheKey = ({
    query = '',
    maxResults = 10,
    playableOnly = false,
} = {}) => (
    `${normalizeSearchQuery(query)}|${Math.max(1, Number(maxResults || 10) || 10)}|${playableOnly ? 'playable' : 'all'}`
);

const readYouTubeQuotaBlockedUntilMs = () => {
    if (typeof window === 'undefined') return 0;
    try {
        const raw = window.localStorage.getItem(YOUTUBE_QUOTA_STORAGE_KEY);
        const parsed = Number(raw || 0);
        return Number.isFinite(parsed) ? parsed : 0;
    } catch {
        return 0;
    }
};

let youtubeQuotaBlockedUntilMs = readYouTubeQuotaBlockedUntilMs();

const pruneYouTubeSearchTelemetryEvents = (now = nowMs()) => {
    const cutoffMs = Number(now || nowMs()) - YOUTUBE_TELEMETRY_WINDOW_MS;
    while (youtubeSearchTelemetryEvents.length > 0 && Number(youtubeSearchTelemetryEvents[0]?.atMs || 0) < cutoffMs) {
        youtubeSearchTelemetryEvents.shift();
    }
};

const buildYouTubeSearchTelemetrySnapshot = () => {
    const now = nowMs();
    pruneYouTubeSearchTelemetryEvents(now);
    const summary = {
        windowMs: YOUTUBE_TELEMETRY_WINDOW_MS,
        windowLabel: '15m',
        totalSearches: 0,
        clientCacheHits: 0,
        serverCacheHits: 0,
        liveCalls: 0,
        quotaShortCircuits: 0,
        quotaErrors: 0,
        lastOutcome: '',
        lastUpdatedAtMs: 0,
        liveSharePct: 0,
        cacheSharePct: 0,
        cacheHitPct: 0,
        recentSearches: 0,
    };
    for (const event of youtubeSearchTelemetryEvents) {
        const kind = String(event?.kind || '').trim().toLowerCase();
        if (['client_cache', 'server_cache', 'live', 'quota_short_circuit', 'quota_error'].includes(kind)) {
            summary.totalSearches += 1;
            summary.lastOutcome = kind;
            summary.lastUpdatedAtMs = Math.max(summary.lastUpdatedAtMs, Number(event?.atMs || 0));
        }
        if (kind === 'client_cache') summary.clientCacheHits += 1;
        if (kind === 'server_cache') summary.serverCacheHits += 1;
        if (kind === 'live') summary.liveCalls += 1;
        if (kind === 'quota_short_circuit') summary.quotaShortCircuits += 1;
        if (kind === 'quota_error') summary.quotaErrors += 1;
    }
    summary.recentSearches = summary.totalSearches;
    const cacheHits = summary.clientCacheHits + summary.serverCacheHits;
    if (summary.totalSearches > 0) {
        summary.cacheSharePct = Math.round((cacheHits / summary.totalSearches) * 100);
        summary.cacheHitPct = summary.cacheSharePct;
        summary.liveSharePct = Math.round((summary.liveCalls / summary.totalSearches) * 100);
    }
    summary.quotaBlocked = Number(youtubeQuotaBlockedUntilMs || 0) > now;
    summary.quotaBlockedUntilMs = Number(youtubeQuotaBlockedUntilMs || 0);
    return summary;
};

const notifyYouTubeSearchTelemetrySubscribers = () => {
    const snapshot = buildYouTubeSearchTelemetrySnapshot();
    for (const subscriber of youtubeSearchTelemetrySubscribers) {
        try {
            subscriber(snapshot);
        } catch {
            // Ignore subscriber failures.
        }
    }
};

const recordYouTubeSearchTelemetryEvent = (kind = '') => {
    const safeKind = String(kind || '').trim().toLowerCase();
    if (!safeKind) return;
    youtubeSearchTelemetryEvents.push({
        kind: safeKind,
        atMs: nowMs(),
    });
    notifyYouTubeSearchTelemetrySubscribers();
};

const persistYouTubeQuotaBlockedUntilMs = (untilMs = 0) => {
    youtubeQuotaBlockedUntilMs = Math.max(0, Number(untilMs || 0));
    if (typeof window === 'undefined') return;
    try {
        if (youtubeQuotaBlockedUntilMs > 0) {
            window.localStorage.setItem(YOUTUBE_QUOTA_STORAGE_KEY, String(youtubeQuotaBlockedUntilMs));
        } else {
            window.localStorage.removeItem(YOUTUBE_QUOTA_STORAGE_KEY);
        }
    } catch {
        // Ignore localStorage failures.
    }
    notifyYouTubeSearchTelemetrySubscribers();
};

const clearExpiredSearchCacheEntries = () => {
    const now = nowMs();
    for (const [key, entry] of youtubeSearchCache.entries()) {
        if (Number(entry?.expiresAtMs || 0) <= now) {
            youtubeSearchCache.delete(key);
        }
    }
};

const readCachedYouTubeSearch = (key = '') => {
    if (!key) return null;
    clearExpiredSearchCacheEntries();
    const entry = youtubeSearchCache.get(key);
    if (!entry) return null;
    return Array.isArray(entry.items) ? entry.items : null;
};

const writeCachedYouTubeSearch = (key = '', items = [], ttlMs = YOUTUBE_SEARCH_CACHE_TTL_MS) => {
    if (!key) return;
    youtubeSearchCache.set(key, {
        items: Array.isArray(items) ? items : [],
        expiresAtMs: nowMs() + Math.max(5 * 1000, Number(ttlMs || YOUTUBE_SEARCH_CACHE_TTL_MS)),
    });
};

const isYouTubeQuotaBlocked = () => (
    Number(youtubeQuotaBlockedUntilMs || 0) > nowMs()
);

const buildYouTubeQuotaBlockedError = (message = '') => {
    const error = new Error(
        message || 'Live YouTube search is temporarily paused because the YouTube quota is exhausted.'
    );
    error.code = 'resource-exhausted';
    error.youtubeQuotaBlocked = true;
    error.retryAtMs = Number(youtubeQuotaBlockedUntilMs || 0);
    return error;
};

const markYouTubeQuotaBlocked = (durationMs = YOUTUBE_QUOTA_COOLDOWN_MS) => {
    persistYouTubeQuotaBlockedUntilMs(nowMs() + Math.max(60 * 1000, Number(durationMs || YOUTUBE_QUOTA_COOLDOWN_MS)));
};

const clearYouTubeQuotaBlocked = () => {
    persistYouTubeQuotaBlockedUntilMs(0);
};

const isYouTubeQuotaError = (error = null) => {
    if (error?.youtubeQuotaBlocked === true) return true;
    const code = String(error?.code || '').trim().toLowerCase();
    const message = String(error?.message || '').trim().toLowerCase();
    return (
        code.includes('resource-exhausted')
        || message.includes('quota')
        || message.includes('rate limit')
        || message.includes('rate_limit')
    );
};

const withTimeout = (promise, timeoutMs = 8000) => {
    const safeTimeoutMs = Math.max(1000, Number(timeoutMs || 8000));
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Search timed out.')), safeTimeoutMs);
        }),
    ]);
};

export const isYouTubeQuotaBlockedError = (error = null) => isYouTubeQuotaError(error);

export const getYouTubeQuotaBlockedUntilMs = () => Number(youtubeQuotaBlockedUntilMs || 0);

export const getYouTubeSearchTelemetrySnapshot = () => buildYouTubeSearchTelemetrySnapshot();

export const subscribeToYouTubeSearchTelemetry = (listener) => {
    if (typeof listener !== 'function') return () => {};
    youtubeSearchTelemetrySubscribers.add(listener);
    listener(buildYouTubeSearchTelemetrySnapshot());
    return () => {
        youtubeSearchTelemetrySubscribers.delete(listener);
    };
};

export const searchYouTubeCatalog = async ({
    query = '',
    maxResults = 10,
    playableOnly = false,
    roomCode = '',
    usageSource = 'youtube_search',
    usageSurface = '',
    timeoutMs = 8000,
    cacheTtlMs = YOUTUBE_SEARCH_CACHE_TTL_MS,
} = {}) => {
    const safeQuery = String(query || '').trim();
    if (!safeQuery) {
        return { items: [], cached: false };
    }
    if (isYouTubeQuotaBlocked()) {
        recordYouTubeSearchTelemetryEvent('quota_short_circuit');
        throw buildYouTubeQuotaBlockedError(
            'Live YouTube search is temporarily paused because the YouTube quota is exhausted. Use indexed tracks or paste a direct URL for now.'
        );
    }
    const cacheKey = buildSearchCacheKey({ query: safeQuery, maxResults, playableOnly });
    const cachedItems = readCachedYouTubeSearch(cacheKey);
    if (cachedItems !== null) {
        recordYouTubeSearchTelemetryEvent('client_cache');
        return { items: cachedItems, cached: true, cacheLayer: 'client' };
    }
    try {
        const data = await withTimeout(callFunction('youtubeSearch', {
            query: safeQuery,
            maxResults,
            playableOnly,
            roomCode,
            usageContext: {
                source: usageSource,
                ...(usageSurface ? { surface: usageSurface } : {}),
            },
        }), timeoutMs);
        const items = Array.isArray(data?.items) ? data.items : [];
        writeCachedYouTubeSearch(cacheKey, items, cacheTtlMs);
        clearYouTubeQuotaBlocked();
        recordYouTubeSearchTelemetryEvent(data?.cached === true ? 'server_cache' : 'live');
        return {
            ...(data || {}),
            items,
            cached: data?.cached === true,
        };
    } catch (error) {
        if (isYouTubeQuotaError(error)) {
            markYouTubeQuotaBlocked();
            recordYouTubeSearchTelemetryEvent('quota_error');
            throw buildYouTubeQuotaBlockedError(
                'Live YouTube search is temporarily paused because the YouTube quota is exhausted. Use indexed tracks or paste a direct URL for now.'
            );
        }
        throw error;
    }
};
