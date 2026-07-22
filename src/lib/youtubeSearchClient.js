import { callFunction } from './firebase';

const YOUTUBE_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const YOUTUBE_QUOTA_COOLDOWN_MS = 15 * 60 * 1000;
const YOUTUBE_TELEMETRY_WINDOW_MS = 15 * 60 * 1000;
const YOUTUBE_QUOTA_STORAGE_KEY = 'bross_youtube_quota_block_until_ms_v1';
const YOUTUBE_DAILY_BUDGET_STORAGE_KEY = 'bross_youtube_daily_budget_v1';
const readConfiguredQuotaLimit = (key = '', fallback = 1) => {
    const raw = import.meta.env?.[key] ?? globalThis.process?.env?.[key] ?? '';
    const parsed = Math.floor(Number(raw || 0));
    return {
        value: Number.isFinite(parsed) && parsed > 0 ? parsed : fallback,
        source: Number.isFinite(parsed) && parsed > 0 ? 'configured' : 'official_default',
    };
};
const youtubeSearchListLimit = readConfiguredQuotaLimit('VITE_YOUTUBE_DAILY_SEARCH_LIST_CALL_LIMIT', 100);
const youtubeGeneralDataUnitLimit = readConfiguredQuotaLimit('VITE_YOUTUBE_DAILY_GENERAL_DATA_UNIT_LIMIT', 10000);
const YOUTUBE_DAILY_SEARCH_LIST_CALLS = youtubeSearchListLimit.value;
const YOUTUBE_DAILY_GENERAL_DATA_UNITS = youtubeGeneralDataUnitLimit.value;
// YouTube Data API search.list costs 100 quota units per request.
const YOUTUBE_ESTIMATED_GENERAL_UNITS_PER_LIVE_SEARCH = 100;
const YOUTUBE_ESTIMATED_SEARCH_LIST_CALLS_PER_LIVE_SEARCH = 1;
const YOUTUBE_SEARCH_INTENT_STOPWORDS = new Set([
    'karaoke',
    'official',
    'instrumental',
    'backing',
    'track',
    'lyrics',
    'lyric',
    'video',
    'version',
    'audio',
    'hq',
    'hd',
    '4k',
    'remastered',
    'remaster',
    'feat',
    'featuring',
    'ft',
]);
const youtubeSearchCache = new Map();
const youtubeSearchTelemetrySubscribers = new Set();
const youtubeSearchTelemetryEvents = [];

const nowMs = () => Date.now();

const buildLocalDayKey = (value = nowMs()) => {
    const date = new Date(Number(value || nowMs()));
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeSearchQuery = (value = '') => (
    String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

const buildSearchIntentKey = (value = '') => {
    const uniqueTokens = [...new Set(
        String(value || '')
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, ' ')
            .split(' ')
            .map((token) => token.trim())
            .filter((token) => token && !YOUTUBE_SEARCH_INTENT_STOPWORDS.has(token))
    )];
    if (!uniqueTokens.length) return '';
    return uniqueTokens.sort().join(' ');
};

const buildSearchCacheKeys = ({
    query = '',
    maxResults = 10,
    playableOnly = false,
} = {}) => {
    const normalizedQuery = normalizeSearchQuery(query);
    const exactKey = `${normalizedQuery}|${Math.max(1, Number(maxResults || 10) || 10)}|${playableOnly ? 'playable' : 'all'}`;
    const intentKey = buildSearchIntentKey(query);
    return {
        exactKey,
        intentKey: intentKey && intentKey !== normalizedQuery
            ? `${intentKey}|${Math.max(1, Number(maxResults || 10) || 10)}|${playableOnly ? 'playable' : 'all'}`
            : '',
    };
};

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
let youtubeProviderQuotaStatus = {
    state: 'unknown',
    quotaBlocked: false,
    quotaKind: '',
    reason: '',
    blockedUntilMs: 0,
    checkedAtMs: 0,
    projectDayKey: '',
    projectSearchListCalls: 0,
    projectVideosListCalls: 0,
    projectPlaylistItemsListCalls: 0,
    projectTotalCalls: 0,
    projectDailySearchListCallLimit: YOUTUBE_DAILY_SEARCH_LIST_CALLS,
};

const readYouTubeDailyBudgetStats = () => {
    const base = {
        dayKey: buildLocalDayKey(),
        liveCalls: 0,
        clientCacheHits: 0,
        serverCacheHits: 0,
        quotaErrors: 0,
        lastUpdatedAtMs: 0,
    };
    if (typeof window === 'undefined') return base;
    try {
        const raw = window.localStorage.getItem(YOUTUBE_DAILY_BUDGET_STORAGE_KEY);
        if (!raw) return base;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return base;
        const dayKey = String(parsed.dayKey || '').trim() || base.dayKey;
        if (dayKey !== base.dayKey) return base;
        return {
            dayKey,
            liveCalls: Math.max(0, Number(parsed.liveCalls || 0)),
            clientCacheHits: Math.max(0, Number(parsed.clientCacheHits || 0)),
            serverCacheHits: Math.max(0, Number(parsed.serverCacheHits || 0)),
            quotaErrors: Math.max(0, Number(parsed.quotaErrors || 0)),
            lastUpdatedAtMs: Math.max(0, Number(parsed.lastUpdatedAtMs || 0)),
        };
    } catch {
        return base;
    }
};

let youtubeDailyBudgetStats = readYouTubeDailyBudgetStats();

const persistYouTubeDailyBudgetStats = () => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(
            YOUTUBE_DAILY_BUDGET_STORAGE_KEY,
            JSON.stringify(youtubeDailyBudgetStats)
        );
    } catch {
        // Ignore localStorage failures.
    }
};

const normalizeYouTubeDailyBudgetStats = () => {
    const todayKey = buildLocalDayKey();
    if (String(youtubeDailyBudgetStats?.dayKey || '') === todayKey) return;
    youtubeDailyBudgetStats = {
        dayKey: todayKey,
        liveCalls: 0,
        clientCacheHits: 0,
        serverCacheHits: 0,
        quotaErrors: 0,
        lastUpdatedAtMs: 0,
    };
    persistYouTubeDailyBudgetStats();
};

const pruneYouTubeSearchTelemetryEvents = (now = nowMs()) => {
    const cutoffMs = Number(now || nowMs()) - YOUTUBE_TELEMETRY_WINDOW_MS;
    while (youtubeSearchTelemetryEvents.length > 0 && Number(youtubeSearchTelemetryEvents[0]?.atMs || 0) < cutoffMs) {
        youtubeSearchTelemetryEvents.shift();
    }
};

const buildYouTubeSearchTelemetrySnapshot = () => {
    const now = nowMs();
    pruneYouTubeSearchTelemetryEvents(now);
    normalizeYouTubeDailyBudgetStats();
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
        dailySearchListCallLimit: YOUTUBE_DAILY_SEARCH_LIST_CALLS,
        dailySearchListCallLimitSource: youtubeSearchListLimit.source,
        dailyGeneralDataUnitLimit: YOUTUBE_DAILY_GENERAL_DATA_UNITS,
        dailyGeneralDataUnitLimitSource: youtubeGeneralDataUnitLimit.source,
        estimatedSearchListCallsPerLiveSearch: YOUTUBE_ESTIMATED_SEARCH_LIST_CALLS_PER_LIVE_SEARCH,
        estimatedGeneralUnitsPerLiveSearch: YOUTUBE_ESTIMATED_GENERAL_UNITS_PER_LIVE_SEARCH,
        dailyQuotaUnits: YOUTUBE_DAILY_GENERAL_DATA_UNITS,
        estimatedUnitsPerLiveSearch: YOUTUBE_ESTIMATED_GENERAL_UNITS_PER_LIVE_SEARCH,
        todayDayKey: youtubeDailyBudgetStats.dayKey,
        todayLiveCalls: Math.max(0, Number(youtubeDailyBudgetStats.liveCalls || 0)),
        todayClientCacheHits: Math.max(0, Number(youtubeDailyBudgetStats.clientCacheHits || 0)),
        todayServerCacheHits: Math.max(0, Number(youtubeDailyBudgetStats.serverCacheHits || 0)),
        todayQuotaErrors: Math.max(0, Number(youtubeDailyBudgetStats.quotaErrors || 0)),
        todaySearchListCallsUsed: 0,
        todaySearchListCallsRemaining: YOUTUBE_DAILY_SEARCH_LIST_CALLS,
        todayGeneralDataUnitsUsed: 0,
        todayGeneralDataUnitsRemaining: YOUTUBE_DAILY_GENERAL_DATA_UNITS,
        todayEstimatedUnitsUsed: 0,
        todayEstimatedUnitsRemaining: YOUTUBE_DAILY_GENERAL_DATA_UNITS,
        todayEstimatedFreshSearchesLeft: YOUTUBE_DAILY_SEARCH_LIST_CALLS,
        todayCacheHitPct: 0,
        providerState: youtubeProviderQuotaStatus.state,
        providerQuotaBlocked: youtubeProviderQuotaStatus.quotaBlocked === true,
        providerQuotaKind: youtubeProviderQuotaStatus.quotaKind,
        providerQuotaReason: youtubeProviderQuotaStatus.reason,
        providerBlockedUntilMs: Math.max(0, Number(youtubeProviderQuotaStatus.blockedUntilMs || 0)),
        providerCheckedAtMs: Math.max(0, Number(youtubeProviderQuotaStatus.checkedAtMs || 0)),
        projectDayKey: String(youtubeProviderQuotaStatus.projectDayKey || '').trim(),
        projectSearchListCalls: Math.max(0, Number(youtubeProviderQuotaStatus.projectSearchListCalls || 0)),
        projectVideosListCalls: Math.max(0, Number(youtubeProviderQuotaStatus.projectVideosListCalls || 0)),
        projectPlaylistItemsListCalls: Math.max(0, Number(youtubeProviderQuotaStatus.projectPlaylistItemsListCalls || 0)),
        projectTotalCalls: Math.max(0, Number(youtubeProviderQuotaStatus.projectTotalCalls || 0)),
        projectDailySearchListCallLimit: Math.max(1, Number(youtubeProviderQuotaStatus.projectDailySearchListCallLimit || YOUTUBE_DAILY_SEARCH_LIST_CALLS)),
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
    summary.todaySearchListCallsUsed = summary.todayLiveCalls * YOUTUBE_ESTIMATED_SEARCH_LIST_CALLS_PER_LIVE_SEARCH;
    summary.todaySearchListCallsRemaining = Math.max(0, YOUTUBE_DAILY_SEARCH_LIST_CALLS - summary.todaySearchListCallsUsed);
    summary.todayGeneralDataUnitsUsed = summary.todayLiveCalls * YOUTUBE_ESTIMATED_GENERAL_UNITS_PER_LIVE_SEARCH;
    summary.todayGeneralDataUnitsRemaining = Math.max(0, YOUTUBE_DAILY_GENERAL_DATA_UNITS - summary.todayGeneralDataUnitsUsed);
    summary.todayEstimatedUnitsUsed = summary.todayGeneralDataUnitsUsed;
    summary.todayEstimatedUnitsRemaining = summary.todayGeneralDataUnitsRemaining;
    summary.todayEstimatedFreshSearchesLeft = Math.min(
        summary.todaySearchListCallsRemaining,
        Math.floor(summary.todayGeneralDataUnitsRemaining / YOUTUBE_ESTIMATED_GENERAL_UNITS_PER_LIVE_SEARCH)
    );
    const todayTotalSearches = summary.todayLiveCalls + summary.todayClientCacheHits + summary.todayServerCacheHits;
    if (todayTotalSearches > 0) {
        summary.todayCacheHitPct = Math.round(
            ((summary.todayClientCacheHits + summary.todayServerCacheHits) / todayTotalSearches) * 100
        );
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
    normalizeYouTubeDailyBudgetStats();
    youtubeSearchTelemetryEvents.push({
        kind: safeKind,
        atMs: nowMs(),
    });
    if (safeKind === 'live') youtubeDailyBudgetStats.liveCalls += 1;
    if (safeKind === 'client_cache') youtubeDailyBudgetStats.clientCacheHits += 1;
    if (safeKind === 'server_cache') youtubeDailyBudgetStats.serverCacheHits += 1;
    if (safeKind === 'quota_error') youtubeDailyBudgetStats.quotaErrors += 1;
    youtubeDailyBudgetStats.lastUpdatedAtMs = nowMs();
    persistYouTubeDailyBudgetStats();
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

const normalizeYouTubeQuotaErrorDetails = (error = null) => {
    const details = error?.details && typeof error.details === 'object' ? error.details : {};
    return {
        provider: String(details.provider || '').trim().toLowerCase(),
        quotaBlocked: details.quotaBlocked === true,
        quotaKind: String(details.quotaKind || error?.quotaKind || '').trim().toLowerCase(),
        reason: String(details.reason || error?.quotaReason || '').trim(),
        blockedUntilMs: Math.max(0, Number(details.blockedUntilMs || error?.retryAtMs || 0)),
    };
};

const buildYouTubeQuotaBlockedError = (message = '', details = {}) => {
    const safeDetails = details && typeof details === 'object' ? details : {};
    const error = new Error(
        message || 'Live YouTube search is temporarily unavailable. Cached and indexed tracks still work.'
    );
    error.code = 'resource-exhausted';
    error.youtubeQuotaBlocked = true;
    error.quotaKind = String(safeDetails.quotaKind || '').trim().toLowerCase();
    error.quotaReason = String(safeDetails.reason || '').trim();
    error.retryAtMs = Math.max(
        Number(youtubeQuotaBlockedUntilMs || 0),
        Number(safeDetails.blockedUntilMs || 0)
    );
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
    const details = normalizeYouTubeQuotaErrorDetails(error);
    const message = String(error?.message || '').trim().toLowerCase();
    return (
        (details.provider === 'youtube' && details.quotaBlocked)
        || (
            message.includes('youtube')
            && (
                message.includes('quota')
                || message.includes('rate limit')
                || message.includes('rate_limit')
            )
        )
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

export const refreshYouTubeProviderQuotaStatus = async ({ roomCode = '' } = {}) => {
    const data = await callFunction('youtubeQuotaStatus', { roomCode });
    const checkedAtMs = Math.max(0, Number(data?.checkedAtMs || nowMs()));
    const blockedUntilMs = Math.max(0, Number(data?.blockedUntilMs || 0));
    const quotaBlocked = data?.quotaBlocked === true && blockedUntilMs > nowMs();
    const dailyUsage = data?.dailyUsage && typeof data.dailyUsage === 'object' ? data.dailyUsage : {};
    youtubeProviderQuotaStatus = {
        state: quotaBlocked ? 'paused' : 'available',
        quotaBlocked,
        quotaKind: String(data?.quotaKind || '').trim().toLowerCase(),
        reason: String(data?.reason || '').trim(),
        blockedUntilMs,
        checkedAtMs,
        projectDayKey: String(dailyUsage.dateKey || '').trim(),
        projectSearchListCalls: Math.max(0, Number(dailyUsage.searchListCalls || 0)),
        projectVideosListCalls: Math.max(0, Number(dailyUsage.videosListCalls || 0)),
        projectPlaylistItemsListCalls: Math.max(0, Number(dailyUsage.playlistItemsListCalls || 0)),
        projectTotalCalls: Math.max(0, Number(dailyUsage.totalCalls || 0)),
        projectDailySearchListCallLimit: Math.max(1, Number(data?.dailySearchListCallLimit || YOUTUBE_DAILY_SEARCH_LIST_CALLS)),
    };
    if (quotaBlocked) {
        persistYouTubeQuotaBlockedUntilMs(blockedUntilMs);
    } else {
        clearYouTubeQuotaBlocked();
    }
    notifyYouTubeSearchTelemetrySubscribers();
    return { ...youtubeProviderQuotaStatus };
};

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
    const { exactKey, intentKey } = buildSearchCacheKeys({ query: safeQuery, maxResults, playableOnly });
    const cachedItems = readCachedYouTubeSearch(exactKey);
    if (cachedItems !== null) {
        recordYouTubeSearchTelemetryEvent('client_cache');
        return { items: cachedItems, cached: true, cacheLayer: 'client' };
    }
    if (intentKey) {
        const intentCachedItems = readCachedYouTubeSearch(intentKey);
        if (intentCachedItems !== null) {
            writeCachedYouTubeSearch(exactKey, intentCachedItems, cacheTtlMs);
            recordYouTubeSearchTelemetryEvent('client_cache');
            return { items: intentCachedItems, cached: true, cacheLayer: 'client' };
        }
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
        writeCachedYouTubeSearch(exactKey, items, cacheTtlMs);
        if (items.length > 0 && intentKey) {
            writeCachedYouTubeSearch(intentKey, items, cacheTtlMs);
        }
        clearYouTubeQuotaBlocked();
        recordYouTubeSearchTelemetryEvent(data?.cached === true ? 'server_cache' : 'live');
        return {
            ...(data || {}),
            items,
            cached: data?.cached === true,
        };
    } catch (error) {
        if (isYouTubeQuotaError(error)) {
            const details = normalizeYouTubeQuotaErrorDetails(error);
            const retryDurationMs = details.blockedUntilMs > nowMs()
                ? details.blockedUntilMs - nowMs()
                : YOUTUBE_QUOTA_COOLDOWN_MS;
            markYouTubeQuotaBlocked(retryDurationMs);
            recordYouTubeSearchTelemetryEvent('quota_error');
            youtubeProviderQuotaStatus = {
                state: 'paused',
                quotaBlocked: true,
                quotaKind: details.quotaKind,
                reason: details.reason,
                blockedUntilMs: Math.max(details.blockedUntilMs, getYouTubeQuotaBlockedUntilMs()),
                checkedAtMs: nowMs(),
            };
            notifyYouTubeSearchTelemetrySubscribers();
            throw buildYouTubeQuotaBlockedError(
                details.quotaKind === 'daily'
                    ? 'The shared YouTube daily search allowance has been reached. Cached and indexed tracks still work.'
                    : 'Live YouTube search is temporarily unavailable. Cached and indexed tracks still work.',
                details
            );
        }
        throw error;
    }
};
